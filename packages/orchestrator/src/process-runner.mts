import { spawn } from "node:child_process";

export interface ProcessRequest {
  executable: string;
  args: string[];
  cwd: string;
  timeoutMs: number;
  maxOutputBytes?: number;
  env?: Record<string, string>;
}

export interface ProcessResult {
  executable: string;
  args: string[];
  cwd: string;
  exit_code: number | null;
  signal: string | null;
  timed_out: boolean;
  output_truncated: boolean;
  stdout: string;
  stderr: string;
  started_at: string;
  finished_at: string;
  duration_ms: number;
}

const DEFAULT_OUTPUT_LIMIT = 256 * 1024;

export function redactCommonSecrets(value: string): string {
  return value
    .replace(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g, "[REDACTED_PRIVATE_KEY]")
    .replace(/\b(?:ghp|github_pat)_[A-Za-z0-9_]{20,}\b/g, "[REDACTED_TOKEN]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi, "Bearer [REDACTED_TOKEN]")
    .replace(/([\"']?(?:api[_-]?key|access[_-]?token|refresh[_-]?token|password|secret)[\"']?\s*[:=]\s*[\"']?)[^\s\"'&,}]+/gi, "$1[REDACTED]");
}

function appendBounded(current: Buffer, chunk: Buffer, limit: number): { value: Buffer; truncated: boolean } {
  if (current.length >= limit) return { value: current, truncated: true };
  const remaining = limit - current.length;
  if (chunk.length <= remaining) return { value: Buffer.concat([current, chunk]), truncated: false };
  return { value: Buffer.concat([current, chunk.subarray(0, remaining)]), truncated: true };
}

export function buildMinimalEnvironment(extra: Record<string, string> = {}): Record<string, string> {
  const env: Record<string, string> = {};
  for (const name of ["PATH", "HOME", "TMPDIR", "LANG", "LC_ALL", "TERM"]) {
    const value = process.env[name];
    if (value !== undefined) env[name] = value;
  }
  for (const [name, value] of Object.entries(extra)) {
    if (/^(?:API_KEY|.*TOKEN|.*SECRET|.*PASSWORD|CREDENTIALS?)$/i.test(name)) {
      throw new Error(`Environment variable ${name} is not allowed in the minimal process environment.`);
    }
    env[name] = value;
  }
  return env;
}

export function runBoundedProcess(request: ProcessRequest): Promise<ProcessResult> {
  if (!request.executable.trim()) throw new Error("executable must be non-empty.");
  if (!request.cwd.startsWith("/")) throw new Error("cwd must be an absolute path.");
  if (!Number.isSafeInteger(request.timeoutMs) || request.timeoutMs <= 0) throw new Error("timeoutMs must be a positive integer.");
  if (request.args.some((argument) => typeof argument !== "string")) throw new Error("args must contain only strings.");

  const maxOutput = request.maxOutputBytes ?? DEFAULT_OUTPUT_LIMIT;
  if (!Number.isSafeInteger(maxOutput) || maxOutput < 1024) throw new Error("maxOutputBytes must be at least 1024.");
  const started = new Date();
  const startedMs = Date.now();
  const env = buildMinimalEnvironment(request.env);

  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(request.executable, request.args, {
        cwd: request.cwd,
        env,
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
    } catch (error) {
      reject(error);
      return;
    }

    let stdout = Buffer.alloc(0);
    let stderr = Buffer.alloc(0);
    let truncated = false;
    let timedOut = false;
    let settled = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => {
        if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
      }, 500).unref();
    }, request.timeoutMs);
    timer.unref();

    child.stdout.on("data", (chunk: Buffer) => {
      const result = appendBounded(stdout, chunk, maxOutput);
      stdout = result.value;
      truncated ||= result.truncated;
    });
    child.stderr.on("data", (chunk: Buffer) => {
      const result = appendBounded(stderr, chunk, maxOutput);
      stderr = result.value;
      truncated ||= result.truncated;
    });
    child.once("error", (error: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.once("close", (code: number | null, signal: NodeJS.Signals | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const finished = new Date();
      resolve({
        executable: request.executable,
        args: [...request.args],
        cwd: request.cwd,
        exit_code: code,
        signal,
        timed_out: timedOut,
        output_truncated: truncated,
        stdout: redactCommonSecrets(stdout.toString("utf8")),
        stderr: redactCommonSecrets(stderr.toString("utf8")),
        started_at: started.toISOString(),
        finished_at: finished.toISOString(),
        duration_ms: Date.now() - startedMs,
      });
    });
  });
}
