import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TaskRegistry } from "../src/task-registry.mts";
import type { TaskContract } from "../src/task-contract.mts";
import { ValidationExecutor } from "../src/validation-executor.mts";

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "baturpay-task-registry-"));
  const workspace = process.cwd();
  const registry = new TaskRegistry({ filePath: join(root, "state", "tasks.json"), allowedWorkspaceRoot: workspace });
  const task: TaskContract = {
    task_id: "task-registry-01", title: "Registry test", objective: "Exercise local task storage.", owner: "HERMES",
    workspace, dependencies: [], acceptance_criteria: ["Task stored safely."], risk_level: "LOW", status: "PROPOSED",
    validation_commands: ["ORCHESTRATOR_TYPECHECK"], evidence: [], review_status: "NOT_REQUIRED", approval_required: false,
  };
  return { root, workspace, registry, task };
}

test("creates and reads a validated task in atomic local JSON storage", async () => {
  const f = await fixture();
  try {
    const created = await f.registry.create(f.task);
    assert.equal(created.ok, true);
    const read = await f.registry.get(f.task.task_id);
    assert.equal(read.ok, true);
    assert.equal(read.value?.task_id, f.task.task_id);
    const raw = await readFile(join(f.root, "state", "tasks.json"), "utf8");
    assert.equal(JSON.parse(raw).schema_version, 1);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test("rejects forged initial task status, review, or evidence", async () => {
  const f = await fixture();
  try {
    assert.equal((await f.registry.create({ ...f.task, status: "DONE" })).error?.code, "INVALID_INITIAL_STATE");
    assert.equal((await f.registry.create({ ...f.task, review_status: "APPROVED" })).error?.code, "INVALID_INITIAL_STATE");
    assert.equal((await f.registry.create({ ...f.task, evidence: [{ command: "ORCHESTRATOR_TYPECHECK", exit_code: 0, summary: "fake", recorded_at: new Date().toISOString(), agent: "HERMES", source: "EXECUTED", files_changed: [] }] })).error?.code, "INVALID_INITIAL_STATE");
    assert.equal((await f.registry.create(f.task)).ok, true);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test("rejects duplicate task IDs, outside workspaces, and symlink escapes", async () => {
  const f = await fixture();
  const outsideRoot = await mkdtemp(join(tmpdir(), "baturpay-outside-"));
  try {
    assert.equal((await f.registry.create(f.task)).ok, true);
    assert.equal((await f.registry.create(f.task)).error?.code, "DUPLICATE_TASK_ID");
    const outside = { ...f.task, task_id: "task-outside-01", workspace: outsideRoot };
    assert.equal((await f.registry.create(outside)).error?.code, "WORKSPACE_OUTSIDE_ROOT");
    const linkPath = join(f.root, "work-link");
    await (await import("node:fs/promises")).symlink(outsideRoot, linkPath, "dir");
    const symlink = { ...f.task, task_id: "task-symlink-01", workspace: linkPath };
    assert.equal((await f.registry.create(symlink)).error?.code, "WORKSPACE_OUTSIDE_ROOT");
  } finally {
    await rm(f.root, { recursive: true, force: true });
    await rm(outsideRoot, { recursive: true, force: true });
  }
});

test("gates READY on completed dependencies and RUNNING on workspace ownership", async () => {
  const f = await fixture();
  try {
    const dependency = { ...f.task, task_id: "task-dependency-01" };
    assert.equal((await f.registry.create(dependency)).ok, true);
    const dependent = { ...f.task, task_id: "task-dependent-01", dependencies: [dependency.task_id] };
    assert.equal((await f.registry.create(dependent)).ok, true);
    assert.equal((await f.registry.transition(dependent.task_id, "READY", { workspaceValid: true })).error?.code, "DEPENDENCIES_PENDING");
    await f.registry.transition(dependency.task_id, "READY", { dependenciesDone: true, workspaceValid: true });
    await f.registry.transition(dependency.task_id, "RUNNING", { workspaceValid: true });
    assert.equal((await f.registry.transition(dependent.task_id, "READY", { workspaceValid: true })).error?.code, "DEPENDENCIES_PENDING");
    assert.equal((await f.registry.transition(dependent.task_id, "RUNNING", { workspaceValid: true })).error?.code, "TRANSITION_NOT_ALLOWED");
    const validation = await new ValidationExecutor({ packageRoot: f.workspace }).run(dependency.validation_commands, f.workspace);
    assert.equal(validation.status, "VERIFIED");
    assert.equal((await f.registry.appendValidationRun(dependency.task_id, validation)).ok, true);
    assert.equal((await f.registry.transition(dependency.task_id, "REVIEW", { validationPassed: true, evidenceComplete: true })).ok, true);
    assert.equal((await f.registry.transition(dependency.task_id, "DONE", { validationPassed: true, evidenceComplete: true })).ok, true);
    assert.equal((await f.registry.transition(dependent.task_id, "READY", { workspaceValid: true })).ok, true);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test("rejects concurrent RUNNING tasks that own the same workspace", async () => {
  const f = await fixture();
  try {
    const first = f.task;
    const second = { ...f.task, task_id: "task-registry-02" };
    await f.registry.create(first); await f.registry.create(second);
    await f.registry.transition(first.task_id, "READY", { dependenciesDone: true, workspaceValid: true });
    await f.registry.transition(first.task_id, "RUNNING", { workspaceValid: true });
    await f.registry.transition(second.task_id, "READY", { dependenciesDone: true, workspaceValid: true });
    assert.equal((await f.registry.transition(second.task_id, "RUNNING", { workspaceValid: true })).error?.code, "WORKSPACE_BUSY");
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test("evidence is appended without changing task status", async () => {
  const f = await fixture();
  try {
    await f.registry.create(f.task);
    const result = await f.registry.appendEvidence(f.task.task_id, {
      command: "node --test", exit_code: 0, summary: "all tests passed", recorded_at: new Date().toISOString(), agent: "HERMES", files_changed: [],
    });
    assert.equal(result.ok, true);
    assert.equal(result.value?.status, "PROPOSED");
    assert.equal(result.value?.evidence.length, 1);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});
