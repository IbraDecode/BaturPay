import { realpath } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { runBoundedProcess, type ProcessResult } from "./process-runner.mts";

export const VALIDATION_COMMANDS = ["ORCHESTRATOR_TESTS", "ORCHESTRATOR_TYPECHECK"] as const;
export type ValidationCommand = (typeof VALIDATION_COMMANDS)[number];
export type ValidationStatus = "REQUESTED" | "RUNNING" | "VERIFIED" | "FAILED" | "BLOCKED";

export interface ValidationStep {
  command: string;
  status: ValidationStatus;
  requested_at: string;
  started_at?: string;
  finished_at?: string;
  exit_code?: number | null;
  timed_out?: boolean;
  output_truncated?: boolean;
  stdout?: string;
  stderr?: string;
  reason?: string;
}

export interface ValidationRun {
  workspace: string;
  status: "VERIFIED" | "FAILED" | "BLOCKED";
  steps: ValidationStep[];
  started_at: string;
  finished_at: string;
}

export interface ValidationExecutorOptions {
  packageRoot: string;
  timeoutMs?: number;
  maxOutputBytes?: number;
}

export class ValidationExecutor {
  private readonly packageRoot: string;
  private readonly timeoutMs: number;
  private readonly maxOutputBytes: number;

  constructor(options: ValidationExecutorOptions) {
    if (!isAbsolute(options.packageRoot)) throw new Error("packageRoot must be an absolute path.");
    this.packageRoot = resolve(options.packageRoot);
    this.timeoutMs = options.timeoutMs ?? 60_000;
    this.maxOutputBytes = options.maxOutputBytes ?? 128 * 1024;
    if (!Number.isSafeInteger(this.timeoutMs) || this.timeoutMs < 1) throw new Error("timeoutMs must be a positive integer.");
    if (!Number.isSafeInteger(this.maxOutputBytes) || this.maxOutputBytes < 1024) throw new Error("maxOutputBytes must be at least 1024.");
  }

  async run(requestedCommands: readonly string[], workspace: string): Promise<ValidationRun> {
    const startedAt = new Date().toISOString();
    const steps: ValidationStep[] = [];
    const known = requestedCommands.map((command) => VALIDATION_COMMANDS.includes(command as ValidationCommand));
    if (known.some((isKnown) => !isKnown)) {
      for (const command of requestedCommands) {
        steps.push({
          command,
          status: "BLOCKED",
          requested_at: startedAt,
          ...(!VALIDATION_COMMANDS.includes(command as ValidationCommand) ? { reason: "Command is not in the fixed validation allowlist." } : {}),
        });
      }
      return { workspace, status: "BLOCKED", steps, started_at: startedAt, finished_at: new Date().toISOString() };
    }
    if (!isAbsolute(workspace)) {
      for (const command of requestedCommands as readonly ValidationCommand[]) {
        steps.push({ command, status: "BLOCKED", requested_at: startedAt, reason: "Workspace must be an absolute path." });
      }
      return { workspace, status: "BLOCKED", steps, started_at: startedAt, finished_at: new Date().toISOString() };
    }

    let canonicalRoot: string;
    let canonicalWorkspace: string;
    try {
      [canonicalRoot, canonicalWorkspace] = await Promise.all([realpath(this.packageRoot), realpath(workspace)]);
    } catch {
      for (const command of requestedCommands as readonly ValidationCommand[]) {
        steps.push({ command, status: "BLOCKED", requested_at: startedAt, reason: "Package root or workspace cannot be resolved." });
      }
      return { workspace, status: "BLOCKED", steps, started_at: startedAt, finished_at: new Date().toISOString() };
    }
    if (canonicalWorkspace !== canonicalRoot) {
      for (const command of requestedCommands as readonly ValidationCommand[]) {
        steps.push({ command, status: "BLOCKED", requested_at: startedAt, reason: "Validation workspace must resolve exactly to the orchestrator package root." });
      }
      return { workspace, status: "BLOCKED", steps, started_at: startedAt, finished_at: new Date().toISOString() };
    }

    let overall: ValidationRun["status"] = "VERIFIED";
    for (const command of requestedCommands as readonly ValidationCommand[]) {
      const requestedAt = new Date().toISOString();
      const running: ValidationStep = { command, status: "RUNNING", requested_at: requestedAt, started_at: new Date().toISOString() };
      steps.push(running);
      const invocation = this.invocation(command);
      let result: ProcessResult;
      try {
        result = await runBoundedProcess({
          executable: invocation.executable,
          args: invocation.args,
          cwd: canonicalRoot,
          timeoutMs: this.timeoutMs,
          maxOutputBytes: this.maxOutputBytes,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Validation process could not start.";
        Object.assign(running, { status: "FAILED", finished_at: new Date().toISOString(), reason: message });
        overall = "FAILED";
        continue;
      }
      const verified = result.exit_code === 0 && !result.timed_out;
      Object.assign(running, {
        status: verified ? "VERIFIED" : "FAILED",
        finished_at: result.finished_at,
        exit_code: result.exit_code,
        timed_out: result.timed_out,
        output_truncated: result.output_truncated,
        stdout: result.stdout,
        stderr: result.stderr,
        ...(!verified ? { reason: result.timed_out ? "Validation timed out." : `Validation exited with code ${String(result.exit_code)}.` } : {}),
      });
      if (!verified) overall = "FAILED";
    }
    if (requestedCommands.length === 0) overall = "BLOCKED";
    return { workspace: canonicalWorkspace, status: overall, steps, started_at: startedAt, finished_at: new Date().toISOString() };
  }

  private invocation(command: ValidationCommand): { executable: string; args: string[] } {
    const nodePath = process.execPath;
    if (command === "ORCHESTRATOR_TESTS") {
      return {
        executable: nodePath,
        args: ["--experimental-strip-types", "--test", "test/process-runner.test.mts", "test/task-contract.test.mts", "test/task-registry-gates.test.mts", "test/task-registry.test.mts", "test/validation-executor.test.mts", "../domain/test/payment-state.test.mts"],
      };
    }
    return {
      executable: nodePath,
      args: ["./node_modules/typescript/bin/tsc", "--project", "tsconfig.json"],
    };
  }
}
