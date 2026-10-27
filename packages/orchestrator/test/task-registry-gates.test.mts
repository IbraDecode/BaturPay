import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TaskRegistry } from "../src/task-registry.mts";
import type { TaskContract } from "../src/task-contract.mts";

test("registry requires persisted passing evidence for each validation command", async () => {
  const root = await mkdtemp(join(tmpdir(), "baturpay-evidence-gate-"));
  const workspace = join(root, "workspace");
  await mkdir(workspace);
  const registry = new TaskRegistry({ filePath: join(root, "state", "tasks.json"), allowedWorkspaceRoot: root });
  const task: TaskContract = {
    task_id: "task-evidence-001", title: "Evidence gate", objective: "Require test evidence before completion.", owner: "HERMES",
    workspace, dependencies: [], acceptance_criteria: ["Recorded test evidence is required."], risk_level: "LOW", status: "PROPOSED",
    validation_commands: ["npm test", "npm run typecheck"], evidence: [], review_status: "PENDING", approval_required: false,
  };
  try {
    await registry.create(task);
    await registry.transition(task.task_id, "READY", { dependenciesDone: true, workspaceValid: true });
    await registry.transition(task.task_id, "RUNNING", { workspaceValid: true });
    assert.equal((await registry.transition(task.task_id, "REVIEW", { validationPassed: true, evidenceComplete: true })).error?.code, "VALIDATION_FAILED");
    await registry.appendEvidence(task.task_id, { command: "npm test", exit_code: 0, summary: "passed", recorded_at: new Date().toISOString(), agent: "HERMES", files_changed: [] });
    assert.equal((await registry.transition(task.task_id, "REVIEW", { validationPassed: true, evidenceComplete: true })).error?.code, "VALIDATION_FAILED");
    await registry.appendEvidence(task.task_id, { command: "npm run typecheck", exit_code: 1, summary: "failed", recorded_at: new Date().toISOString(), agent: "HERMES", files_changed: [] });
    assert.equal((await registry.transition(task.task_id, "REVIEW", { validationPassed: true, evidenceComplete: true })).error?.code, "VALIDATION_FAILED");
    await registry.appendEvidence(task.task_id, { command: "npm run typecheck", exit_code: 0, summary: "passed", recorded_at: new Date().toISOString(), agent: "HERMES", files_changed: [] });
    assert.equal((await registry.transition(task.task_id, "REVIEW", { validationPassed: false, evidenceComplete: false })).ok, true);
    assert.equal((await registry.transition(task.task_id, "DONE", { validationPassed: true, evidenceComplete: true })).error?.code, "REVIEW_PENDING");
    assert.equal((await registry.recordReview(task.task_id, "APPROVED", { command: "Hermes diff review", exit_code: 0, summary: "acceptance criteria verified", recorded_at: new Date().toISOString(), agent: "HERMES", files_changed: [] })).ok, true);
    assert.equal((await registry.transition(task.task_id, "DONE", { validationPassed: true, evidenceComplete: true })).ok, true);
  } finally { await rm(root, { recursive: true, force: true }); }
});
