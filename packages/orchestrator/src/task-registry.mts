import { mkdir, open, readFile, realpath, rename, rm, stat } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import {
  transitionTask,
  validateTaskContract,
  isTaskEvidence,
  type TaskContract,
  type TaskStatus,
  type TransitionContext,
} from "./task-contract.mts";

export interface TaskRegistryOptions {
  filePath: string;
  allowedWorkspaceRoot: string;
}

export interface RegistryResult<T> {
  ok: boolean;
  value?: T;
  error?: { code: string; message: string };
}

interface RegistryFile {
  schema_version: 1;
  tasks: TaskContract[];
}

const emptyRegistry = (): RegistryFile => ({ schema_version: 1, tasks: [] });

function isWithinRoot(root: string, candidate: string): boolean {
  const relativePath = relative(resolve(root), resolve(candidate));
  return relativePath === "" || (!relativePath.startsWith(`..${sep}`) && relativePath !== ".." && !isAbsolute(relativePath));
}

export class TaskRegistry {
  readonly filePath: string;
  readonly workspaceRoot: string;
  private readonly lockPath: string;

  constructor(options: TaskRegistryOptions) {
    if (!isAbsolute(options.filePath) || !isAbsolute(options.allowedWorkspaceRoot)) {
      throw new Error("Registry path and allowed workspace root must be absolute paths.");
    }
    this.filePath = resolve(options.filePath);
    this.workspaceRoot = resolve(options.allowedWorkspaceRoot);
    this.lockPath = `${this.filePath}.lock`;
  }

  async create(input: unknown): Promise<RegistryResult<TaskContract>> {
    const validation = validateTaskContract(input);
    if (!validation.ok || !validation.value) {
      return { ok: false, error: { code: "INVALID_TASK", message: validation.errors.map((issue) => `${issue.path}: ${issue.message}`).join("; ") } };
    }
    const task = validation.value;
    if (!(await this.workspaceIsAllowed(task.workspace))) {
      return { ok: false, error: { code: "WORKSPACE_OUTSIDE_ROOT", message: "Task workspace must resolve within the configured workspace root." } };
    }
    const workspace = await stat(task.workspace).catch(() => undefined);
    if (!workspace?.isDirectory()) {
      return { ok: false, error: { code: "WORKSPACE_NOT_DIRECTORY", message: "Task workspace must exist and be a directory." } };
    }
    return this.withLock(async () => {
      const registry = await this.readRegistry();
      if (registry.tasks.some((existing) => existing.task_id === task.task_id)) {
        return { ok: false, error: { code: "DUPLICATE_TASK_ID", message: "A task with this task_id already exists." } };
      }
      registry.tasks.push(structuredClone(task));
      await this.writeRegistry(registry);
      return { ok: true, value: task };
    });
  }

  async get(taskId: string): Promise<RegistryResult<TaskContract>> {
    const registry = await this.readRegistry();
    const task = registry.tasks.find((item) => item.task_id === taskId);
    return task
      ? { ok: true, value: task }
      : { ok: false, error: { code: "TASK_NOT_FOUND", message: "Task was not found." } };
  }

  async list(): Promise<RegistryResult<TaskContract[]>> {
    const registry = await this.readRegistry();
    return { ok: true, value: registry.tasks };
  }

  async transition(taskId: string, next: TaskStatus, context: TransitionContext = {}): Promise<RegistryResult<TaskContract>> {
    return this.withLock(async () => {
      const registry = await this.readRegistry();
      const index = registry.tasks.findIndex((task) => task.task_id === taskId);
      if (index < 0) return { ok: false, error: { code: "TASK_NOT_FOUND", message: "Task was not found." } };
      const task = registry.tasks[index]!;

      const effectiveContext = { ...context };
      if (next === "READY") {
        effectiveContext.dependenciesDone = task.dependencies.every((dependencyId) =>
          registry.tasks.some((dependency) => dependency.task_id === dependencyId && dependency.status === "DONE"),
        );
        const workspace = await stat(task.workspace).catch(() => undefined);
        effectiveContext.workspaceValid = workspace?.isDirectory() === true && await this.workspaceIsAllowed(task.workspace);
      }
      if (next === "RUNNING") {
        const workspace = await stat(task.workspace).catch(() => undefined);
        effectiveContext.workspaceValid = workspace?.isDirectory() === true && await this.workspaceIsAllowed(task.workspace);
        if (task.status === "READY") {
          const competing = registry.tasks.find((other) => other.task_id !== task.task_id && other.status === "RUNNING" && other.workspace === task.workspace);
          if (competing) return { ok: false, error: { code: "WORKSPACE_BUSY", message: "Another RUNNING task owns this workspace." } };
        }
      }

      if (task.status === "RUNNING" && next === "REVIEW") {
        effectiveContext.validationPassed = task.validation_commands.length > 0 && task.validation_commands.every((command) =>
          task.evidence.some((item) => item.command === command && item.exit_code === 0),
        );
        effectiveContext.evidenceComplete = effectiveContext.validationPassed;
      }
      if (task.status === "REVIEW" && next === "DONE") {
        effectiveContext.reviewStatus = task.review_status;
        effectiveContext.validationPassed = task.validation_commands.length > 0 && task.validation_commands.every((command) =>
          task.evidence.some((item) => item.command === command && item.exit_code === 0),
        );
        effectiveContext.evidenceComplete = effectiveContext.validationPassed;
      }
      if (task.status === "REVIEW" && next === "DONE" && task.review_status === "PENDING") {
        return { ok: false, error: { code: "REVIEW_PENDING", message: "Record an explicit review outcome before DONE." } };
      }

      const transition = transitionTask(task, next, effectiveContext);
      if (!transition.ok || !transition.status) return { ok: false, error: transition.error };
      const updated: TaskContract = { ...task, status: transition.status };
      if (next === "REVIEW" && task.review_status === "NOT_REQUIRED") updated.review_status = "NOT_REQUIRED";
      else if (next === "REVIEW") updated.review_status = "PENDING";
      registry.tasks[index] = updated;
      await this.writeRegistry(registry);
      return { ok: true, value: updated };
    });
  }

  async recordReview(taskId: string, reviewStatus: "APPROVED" | "REJECTED" | "NOT_REQUIRED", evidence: TaskContract["evidence"][number]): Promise<RegistryResult<TaskContract>> {
    if (!isTaskEvidence(evidence) || evidence.agent !== "HERMES" || evidence.exit_code !== 0) {
      return { ok: false, error: { code: "INVALID_REVIEW_EVIDENCE", message: "Review evidence must be a valid successful HERMES verification record." } };
    }
    return this.withLock(async () => {
      const registry = await this.readRegistry();
      const index = registry.tasks.findIndex((task) => task.task_id === taskId);
      if (index < 0) return { ok: false, error: { code: "TASK_NOT_FOUND", message: "Task was not found." } };
      const task = registry.tasks[index]!;
      if (task.status !== "REVIEW") return { ok: false, error: { code: "NOT_IN_REVIEW", message: "Review outcome can only be recorded while task status is REVIEW." } };
      registry.tasks[index] = { ...task, review_status: reviewStatus, evidence: [...task.evidence, structuredClone(evidence)] };
      await this.writeRegistry(registry);
      return { ok: true, value: registry.tasks[index] };
    });
  }

  async appendEvidence(taskId: string, evidence: TaskContract["evidence"][number]): Promise<RegistryResult<TaskContract>> {
    const candidate = {
      command: evidence.command,
      exit_code: evidence.exit_code,
      summary: evidence.summary,
      recorded_at: evidence.recorded_at,
      agent: evidence.agent,
      files_changed: evidence.files_changed,
    };
    const validation = validateTaskContract({
      task_id: "evidence-check-001", title: "check", objective: "check", owner: "HERMES", workspace: this.workspaceRoot,
      dependencies: [], acceptance_criteria: ["check"], risk_level: "LOW", status: "PROPOSED", validation_commands: [],
      evidence: [candidate], review_status: "NOT_REQUIRED", approval_required: false,
    });
    if (!validation.ok) return { ok: false, error: { code: "INVALID_EVIDENCE", message: validation.errors.map((issue) => issue.message).join("; ") } };
    return this.withLock(async () => {
      const registry = await this.readRegistry();
      const index = registry.tasks.findIndex((task) => task.task_id === taskId);
      if (index < 0) return { ok: false, error: { code: "TASK_NOT_FOUND", message: "Task was not found." } };
      const task = registry.tasks[index]!;
      registry.tasks[index] = { ...task, evidence: [...task.evidence, structuredClone(candidate)] };
      await this.writeRegistry(registry);
      return { ok: true, value: registry.tasks[index] };
    });
  }

  private async workspaceIsAllowed(workspace: string): Promise<boolean> {
    try {
      const [rootPath, workspacePath] = await Promise.all([realpath(this.workspaceRoot), realpath(workspace)]);
      return isWithinRoot(rootPath, workspacePath);
    } catch {
      return false;
    }
  }

  private async withLock<T>(operation: () => Promise<RegistryResult<T>>): Promise<RegistryResult<T>> {
    await mkdir(dirname(this.filePath), { recursive: true });
    let lock;
    try {
      lock = await open(this.lockPath, "wx", 0o600);
    } catch {
      return { ok: false, error: { code: "REGISTRY_LOCKED", message: "Task registry is already locked; retry after resolving the active writer." } };
    }
    try {
      return await operation();
    } finally {
      await lock.close();
      await rm(this.lockPath, { force: true });
    }
  }

  private async readRegistry(): Promise<RegistryFile> {
    const data = await readFile(this.filePath, "utf8").catch((error: unknown) => {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") return undefined;
      throw error;
    });
    if (data === undefined) return emptyRegistry();
    let parsed: unknown;
    try {
      parsed = JSON.parse(data);
    } catch {
      throw new Error("Task registry JSON is invalid; refusing to overwrite it.");
    }
    if (typeof parsed !== "object" || parsed === null || !("schema_version" in parsed) || parsed.schema_version !== 1 || !Array.isArray(parsed.tasks)) {
      throw new Error("Task registry shape or schema_version is unsupported; refusing to overwrite it.");
    }
    const tasks: TaskContract[] = [];
    for (const item of parsed.tasks) {
      const result = validateTaskContract(item);
      if (!result.ok || !result.value) throw new Error("Task registry contains an invalid task; refusing to overwrite it.");
      tasks.push(result.value);
    }
    return { schema_version: 1, tasks };
  }

  private async writeRegistry(registry: RegistryFile): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const temporary = `${this.filePath}.${randomUUID()}.tmp`;
    const handle = await open(temporary, "wx", 0o600);
    try {
      await handle.writeFile(`${JSON.stringify(registry, null, 2)}\n`, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temporary, this.filePath);
  }
}

export function isWorkspaceWithinRoot(root: string, workspace: string): boolean {
  return isAbsolute(root) && isAbsolute(workspace) && isWithinRoot(root, workspace);
}
