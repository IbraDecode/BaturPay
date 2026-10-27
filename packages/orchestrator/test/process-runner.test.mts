import test from "node:test";
import assert from "node:assert/strict";
import { runBoundedProcess, buildMinimalEnvironment, redactCommonSecrets } from "../src/process-runner.mts";
import { inspectOpenCode, runOpenCodeTask } from "../src/opencode-adapter.mts";

test("runs a local process without a shell and captures its exit code", async () => {
  const result = await runBoundedProcess({ executable: process.execPath, args: ["-e", "process.stdout.write('process-runner-ok')"], cwd: process.cwd(), timeoutMs: 5_000 });
  assert.equal(result.exit_code, 0);
  assert.equal(result.stdout, "process-runner-ok");
  assert.equal(result.timed_out, false);
});

test("reports nonzero exit status without pretending success", async () => {
  const result = await runBoundedProcess({ executable: process.execPath, args: ["-e", "process.exit(7)"], cwd: process.cwd(), timeoutMs: 5_000 });
  assert.equal(result.exit_code, 7);
});

test("terminates a timed-out process", async () => {
  const result = await runBoundedProcess({ executable: process.execPath, args: ["-e", "setInterval(() => {}, 1000)"], cwd: process.cwd(), timeoutMs: 100 });
  assert.equal(result.timed_out, true);
  assert.notEqual(result.exit_code, 0);
});

test("bounds captured output", async () => {
  const result = await runBoundedProcess({ executable: process.execPath, args: ["-e", "process.stdout.write('x'.repeat(5000))"], cwd: process.cwd(), timeoutMs: 5_000, maxOutputBytes: 1024 });
  assert.equal(result.stdout.length, 1024);
  assert.equal(result.output_truncated, true);
});

test("minimal environment does not pass credential-like variables", () => {
  assert.throws(() => buildMinimalEnvironment({ TEST_TOKEN: "do-not-pass" }), /not allowed/);
  assert.throws(() => buildMinimalEnvironment({ API_KEY: "do-not-pass" }), /not allowed/);
  assert.equal(buildMinimalEnvironment({ BaturPayTask: "demo" }).BaturPayTask, "demo");
});

test("readiness inspection reports no OpenCode authenticated integration without leaking provider data", async () => {
  const status = await inspectOpenCode("opencode", process.cwd());
  assert.equal(status.cli_available, true);
  assert.equal(status.version, "opencode v2.2.0");
  assert.equal(status.authenticated_integration, false);
  assert.equal(status.ready_for_remote_task, false);
  assert.equal(status.blockers.some((blocker) => blocker.includes("not verified")), true);
  assert.ok(!JSON.stringify(status).includes("apiKey"));
});

test("refuses actual OpenCode task without owner authorization or validated sandbox", async () => {
  await assert.rejects(() => runOpenCodeTask({
    cwd: process.cwd(), workspaceRoot: process.cwd(), taskId: "demo-task-001", prompt: "safe demo",
    timeoutMs: 1000, explicitOwnerAuthorization: false, sandboxValidated: false,
  }), /explicit owner authorization/);
});
