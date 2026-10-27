import { readFile } from "node:fs/promises";
import { TaskRegistry } from "./task-registry.mts";
import { ValidationExecutor } from "./validation-executor.mts";
import { REVIEW_STATUSES, TASK_STATUSES, type ReviewStatus, type TaskStatus, type TransitionContext } from "./task-contract.mts";

function usage(): string {
  return [
    "BaturPay local task registry (no agent dispatch)",
    "Usage:",
    "  node --experimental-strip-types src/cli.mts --registry <absolute-file> --workspace-root <absolute-dir> create <task-json-file>",
    "  node --experimental-strip-types src/cli.mts --registry <absolute-file> --workspace-root <absolute-dir> list",
    "  node --experimental-strip-types src/cli.mts --registry <absolute-file> --workspace-root <absolute-dir> validate <task-id>",
    "  node --experimental-strip-types src/cli.mts --registry <absolute-file> --workspace-root <absolute-dir> transition <task-id> <status> [--dependencies-done] [--workspace-valid] [--validation-passed] [--evidence-complete] [--review-status <value>] [--approval-granted] [--failure-reason <text>]",
    "  node --experimental-strip-types src/cli.mts --registry <absolute-file> --workspace-root <absolute-dir> evidence <task-id> <evidence-json-file>",
    "  node --experimental-strip-types src/cli.mts --registry <absolute-file> --workspace-root <absolute-dir> review <task-id> <APPROVED|REJECTED|NOT_REQUIRED> <evidence-json-file>",
  ].join("\n");
}

function valueAfter(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function flag(args: string[], name: string): boolean {
  return args.includes(name);
}

function json(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

async function main(args: string[]): Promise<number> {
  const registryPath = valueAfter(args, "--registry");
  const workspaceRoot = valueAfter(args, "--workspace-root");
  const commandIndex = args.findIndex((arg) => !arg.startsWith("--") && arg !== registryPath && arg !== workspaceRoot);
  const command = commandIndex >= 0 ? args[commandIndex] : undefined;
  const commandArgs = commandIndex >= 0 ? args.slice(commandIndex + 1) : [];
  if (!registryPath || !workspaceRoot || !command) {
    process.stderr.write(`${usage()}\n`);
    return 2;
  }

  const registry = new TaskRegistry({ filePath: registryPath, allowedWorkspaceRoot: workspaceRoot });
  if (command === "create") {
    const taskFile = commandArgs[0];
    if (!taskFile) return 2;
    const result = await registry.create(JSON.parse(await readFile(taskFile, "utf8")));
    json(result);
    return result.ok ? 0 : 1;
  }
  if (command === "list") {
    json(await registry.list());
    return 0;
  }
  if (command === "validate") {
    const taskId = commandArgs[0];
    if (!taskId) return 2;
    const found = await registry.get(taskId);
    if (!found.ok || !found.value) { json(found); return 1; }
    if (found.value.status !== "RUNNING") {
      json({ ok: false, error: { code: "TASK_NOT_RUNNING", message: "Only RUNNING tasks may enter validation." } });
      return 1;
    }
    const executor = new ValidationExecutor({ packageRoot: found.value.workspace });
    const run = await executor.run(found.value.validation_commands, found.value.workspace);
    if (run.status === "BLOCKED") {
      json({ ok: false, validation: run, evidence_persisted: false });
      return 1;
    }
    const persisted = await registry.appendValidationRun(taskId, run);
    json({ ok: persisted.ok, validation: run, task: persisted.value, error: persisted.error, evidence_persisted: persisted.ok });
    return persisted.ok && run.status === "VERIFIED" ? 0 : 1;
  }
  if (command === "evidence") {
    const [taskId, evidenceFile] = commandArgs;
    if (!taskId || !evidenceFile) return 2;
    const result = await registry.appendEvidence(taskId, JSON.parse(await readFile(evidenceFile, "utf8")));
    json(result);
    return result.ok ? 0 : 1;
  }
  if (command === "review") {
    const [taskId, outcome, evidenceFile] = commandArgs;
    if (!taskId || !outcome || !evidenceFile || !["APPROVED", "REJECTED", "NOT_REQUIRED"].includes(outcome)) return 2;
    const result = await registry.recordReview(taskId, outcome as "APPROVED" | "REJECTED" | "NOT_REQUIRED", JSON.parse(await readFile(evidenceFile, "utf8")));
    json(result);
    return result.ok ? 0 : 1;
  }
  if (command === "transition") {
    const [taskId, nextRaw] = commandArgs;
    if (!taskId || !nextRaw || !(TASK_STATUSES as readonly string[]).includes(nextRaw)) return 2;
    const reviewRaw = valueAfter(commandArgs, "--review-status");
    if (reviewRaw && !(REVIEW_STATUSES as readonly string[]).includes(reviewRaw)) {
      process.stderr.write(`Unknown review status: ${reviewRaw}\\n`);
      return 2;
    }
    const context: TransitionContext = {
      dependenciesDone: flag(commandArgs, "--dependencies-done"),
      workspaceValid: flag(commandArgs, "--workspace-valid"),
      validationPassed: flag(commandArgs, "--validation-passed"),
      evidenceComplete: flag(commandArgs, "--evidence-complete"),
      approvalGranted: flag(commandArgs, "--approval-granted"),
      ...(reviewRaw ? { reviewStatus: reviewRaw as ReviewStatus } : {}),
      ...(valueAfter(commandArgs, "--failure-reason") ? { failureReason: valueAfter(commandArgs, "--failure-reason")! } : {}),
    };
    const result = await registry.transition(taskId, nextRaw as TaskStatus, context);
    json(result);
    return result.ok ? 0 : 1;
  }
  process.stderr.write(`${usage()}\n`);
  return 2;
}

main(process.argv.slice(2)).then((code) => { process.exitCode = code; }).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown task registry error.";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
