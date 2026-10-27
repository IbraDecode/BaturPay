import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ValidationExecutor } from "../src/validation-executor.mts";

const packageRoot = process.cwd();

test("blocks arbitrary validation commands before execution", async () => {
  const executor = new ValidationExecutor({ packageRoot });
  const result = await executor.run(["node -e process.exit(0)"], packageRoot);
  assert.equal(result.status, "BLOCKED");
  assert.equal(result.steps[0]?.status, "BLOCKED");
  assert.match(result.steps[0]?.reason ?? "", /allowlist/);
});

test("blocks workspace traversal and symlink escapes", async () => {
  const executor = new ValidationExecutor({ packageRoot });
  const outside = await mkdtemp(join(tmpdir(), "baturpay-validation-outside-"));
  const link = join(tmpdir(), `baturpay-validation-link-${Date.now()}`);
  try {
    await symlink(outside, link, "dir");
    const result = await executor.run(["ORCHESTRATOR_TYPECHECK"], link);
    assert.equal(result.status, "BLOCKED");
    assert.match(result.steps[0]?.reason ?? "", /resolve exactly/);
  } finally {
    await rm(link, { force: true });
    await rm(outside, { recursive: true, force: true });
  }
});

test("executes an allowlisted typecheck and records real exit status", async () => {
  const executor = new ValidationExecutor({ packageRoot, timeoutMs: 30_000 });
  const result = await executor.run(["ORCHESTRATOR_TYPECHECK"], packageRoot);
  assert.equal(result.status, "VERIFIED");
  assert.equal(result.steps[0]?.status, "VERIFIED");
  assert.equal(result.steps[0]?.exit_code, 0);
  assert.ok(result.steps[0]?.started_at);
  assert.ok(result.steps[0]?.finished_at);
});

test("reports nonzero typecheck exit rather than treating it as verified", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "baturpay-validation-failure-"));
  try {
    await mkdir(join(workspace, "src"));
    await writeFile(join(workspace, "tsconfig.json"), JSON.stringify({
      compilerOptions: { target: "ES2022", module: "NodeNext", moduleResolution: "NodeNext", strict: true, noEmit: true, types: [] },
      include: ["src/**/*.ts"],
    }));
    await writeFile(join(workspace, "src", "broken.ts"), "const x: string = 1;\n");
    await symlink(join(packageRoot, "node_modules"), join(workspace, "node_modules"), "dir");
    const executor = new ValidationExecutor({ packageRoot: workspace, timeoutMs: 30_000 });
    const result = await executor.run(["ORCHESTRATOR_TYPECHECK"], workspace);
    assert.equal(result.status, "FAILED");
    assert.equal(result.steps[0]?.status, "FAILED");
    assert.notEqual(result.steps[0]?.exit_code, 0);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("reports executor timeout as a failed validation", async () => {
  const executor = new ValidationExecutor({ packageRoot, timeoutMs: 1 });
  const result = await executor.run(["ORCHESTRATOR_TYPECHECK"], packageRoot);
  assert.equal(result.status, "FAILED");
  assert.equal(result.steps[0]?.status, "FAILED");
  assert.equal(result.steps[0]?.timed_out, true);
});
