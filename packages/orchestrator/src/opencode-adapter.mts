import { runBoundedProcess, type ProcessResult } from "./process-runner.mts";

export interface OpenCodeReadiness {
  version: string | null;
  cli_available: boolean;
  authenticated_integration: boolean;
  selected_model_present: boolean;
  model_label?: string;
  ready_for_remote_task: boolean;
  blockers: string[];
  checks: Array<{ name: string; exit_code: number | null; outcome: string }>;
}

function firstLine(text: string): string | null {
  return text.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? null;
}

export async function inspectOpenCode(executable = "opencode", cwd = "/root/baturpay"): Promise<OpenCodeReadiness> {
  const blockers: string[] = [];
  const checks: OpenCodeReadiness["checks"] = [];
  let version: string | null = null;
  let cliAvailable = false;
  let authenticated = false;
  let modelLabel: string | undefined;

  try {
    const result: ProcessResult = await runBoundedProcess({ executable, args: ["--version"], cwd, timeoutMs: 8_000, maxOutputBytes: 16_384 });
    cliAvailable = result.exit_code === 0 && !result.timed_out;
    version = cliAvailable ? firstLine(result.stdout) : null;
    checks.push({ name: "version", exit_code: result.exit_code, outcome: cliAvailable ? "ok" : "failed" });
  } catch {
    checks.push({ name: "version", exit_code: null, outcome: "spawn_failed" });
  }
  if (!cliAvailable) blockers.push("OpenCode CLI unavailable or version check failed.");

  if (cliAvailable) {
    try {
      const auth = await runBoundedProcess({ executable, args: ["auth", "list"], cwd, timeoutMs: 8_000, maxOutputBytes: 16_384 });
      const safeStatus = `${auth.stdout}\n${auth.stderr}`;
      authenticated = auth.exit_code === 0 && !auth.timed_out && !/no authenticated integrations/i.test(safeStatus);
      checks.push({ name: "auth_status", exit_code: auth.exit_code, outcome: authenticated ? "integration_reported" : "none_or_failed" });
      if (!authenticated) blockers.push("OpenCode reports no authenticated integration; remote execution not considered ready.");
    } catch {
      checks.push({ name: "auth_status", exit_code: null, outcome: "spawn_failed" });
      blockers.push("Could not determine OpenCode authentication status.");
    }
    try {
      const models = await runBoundedProcess({ executable, args: ["models"], cwd, timeoutMs: 12_000, maxOutputBytes: 64 * 1024 });
      const modelLines = models.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      const customModel = modelLines.find((line) => line.includes("ibra-studio/"));
      modelLabel = customModel;
      const modelPresent = models.exit_code === 0 && modelLines.length > 0;
      checks.push({ name: "model_catalog", exit_code: models.exit_code, outcome: modelPresent ? "catalog_returned" : "failed_or_empty" });
      if (!modelPresent) blockers.push("OpenCode model catalog is empty or failed.");
      if (customModel) blockers.push("Configured custom model endpoint is not verified for ownership, data handling, or cost; do not send project context until owner verifies it.");
    } catch {
      checks.push({ name: "model_catalog", exit_code: null, outcome: "spawn_failed" });
      blockers.push("Could not inspect OpenCode model catalog.");
    }
  }

  const selectedModelPresent = checks.some((check) => check.name === "model_catalog" && check.outcome === "catalog_returned");
  return {
    version,
    cli_available: cliAvailable,
    authenticated_integration: authenticated,
    selected_model_present: selectedModelPresent,
    ...(modelLabel ? { model_label: modelLabel } : {}),
    ready_for_remote_task: cliAvailable && authenticated && selectedModelPresent && blockers.length === 0,
    blockers,
    checks,
  };
}

export interface OpenCodeTaskRequest {
  executable?: string;
  cwd: string;
  workspaceRoot: string;
  taskId: string;
  prompt: string;
  timeoutMs: number;
  explicitOwnerAuthorization: boolean;
  sandboxValidated: boolean;
  maxOutputBytes?: number;
}

export async function runOpenCodeTask(request: OpenCodeTaskRequest): Promise<ProcessResult> {
  if (!request.explicitOwnerAuthorization) throw new Error("OpenCode task execution requires explicit owner authorization for the selected account/cost.");
  if (!request.sandboxValidated) throw new Error("OpenCode task execution requires a validated least-privilege sandbox.");
  if (!request.taskId.trim() || !request.prompt.trim()) throw new Error("taskId and prompt must be non-empty.");
  const root = request.workspaceRoot.endsWith("/") ? request.workspaceRoot : `${request.workspaceRoot}/`;
  if (request.cwd !== request.workspaceRoot && !request.cwd.startsWith(root)) throw new Error("OpenCode cwd must be within the configured task workspace root.");

  const readiness = await inspectOpenCode(request.executable, request.cwd);
  if (!readiness.ready_for_remote_task) throw new Error(`OpenCode not ready: ${readiness.blockers.join("; ")}`);

  return runBoundedProcess({
    executable: request.executable ?? "opencode",
    args: ["run", "--format", "json", "--title", `BaturPay ${request.taskId}`, request.prompt],
    cwd: request.cwd,
    timeoutMs: request.timeoutMs,
    ...(request.maxOutputBytes !== undefined ? { maxOutputBytes: request.maxOutputBytes } : {}),
  });
}
