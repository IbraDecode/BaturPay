import test from "node:test";
import assert from "node:assert/strict";
import {
  validateTaskContract,
  transitionTask,
  type TaskContract,
} from "../src/task-contract.mts";

const validTask = (): TaskContract => ({
  task_id: "demo-task-001",
  title: "Validate task IDs",
  objective: "Ensure task IDs follow the contract format.",
  owner: "OPENCODE",
  workspace: "/root/baturpay",
  dependencies: [],
  acceptance_criteria: ["Valid task IDs are accepted."],
  risk_level: "LOW",
  status: "PROPOSED",
  validation_commands: ["node --experimental-strip-types --test"],
  evidence: [],
  review_status: "NOT_REQUIRED",
  approval_required: false,
});

test("accepts a valid task contract", () => {
  const result = validateTaskContract(validTask());
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test("rejects a missing required field", () => {
  const task = { ...validTask(), title: "   " };
  const result = validateTaskContract(task);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.path === "title" && error.code === "REQUIRED"));
});

test("rejects a non-object task", () => {
  const result = validateTaskContract(null);
  assert.equal(result.ok, false);
  assert.equal(result.errors[0]?.code, "TYPE");
});

test("rejects task ID with invalid type or format", () => {
  for (const task_id of ["x", "bad id", "", 12, null]) {
    const result = validateTaskContract({ ...validTask(), task_id });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((error) => error.path === "task_id"));
  }
});

test("rejects unknown status, risk, owner, review status, and incorrect boolean", () => {
  const result = validateTaskContract({
    ...validTask(),
    status: "SUCCEEDED",
    risk_level: "URGENT",
    owner: "CLAUDE",
    review_status: "MAYBE",
    approval_required: "no",
  });
  assert.equal(result.ok, false);
  for (const path of ["status", "risk_level", "owner", "review_status", "approval_required"]) {
    assert.ok(result.errors.some((error) => error.path === path), `missing error for ${path}`);
  }
});

test("rejects empty owner and invalid workspace", () => {
  const result = validateTaskContract({ ...validTask(), owner: "", workspace: "relative/path" });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.path === "owner"));
  assert.ok(result.errors.some((error) => error.path === "workspace"));
});

test("rejects malformed and duplicate dependencies", () => {
  const malformed = validateTaskContract({ ...validTask(), dependencies: ["bad id"] });
  assert.ok(malformed.errors.some((error) => error.path === "dependencies"));
  const duplicate = validateTaskContract({ ...validTask(), dependencies: ["dep-task-01", "dep-task-01"] });
  assert.ok(duplicate.errors.some((error) => error.code === "DUPLICATE"));
});

test("rejects invalid acceptance criteria, command lists, and evidence shape", () => {
  const result = validateTaskContract({
    ...validTask(),
    acceptance_criteria: [],
    validation_commands: [""],
    evidence: [{ command: "test" }],
  });
  assert.equal(result.ok, false);
  for (const path of ["acceptance_criteria", "validation_commands", "evidence"]) {
    assert.ok(result.errors.some((error) => error.path === path));
  }
});

test("blocks READY until dependencies and workspace are confirmed", () => {
  const task = validTask();
  assert.equal(transitionTask(task, "READY", { dependenciesDone: false, workspaceValid: true }).error?.code, "DEPENDENCIES_PENDING");
  assert.equal(transitionTask(task, "READY", { dependenciesDone: true, workspaceValid: false }).error?.code, "WORKSPACE_INVALID");
  assert.deepEqual(transitionTask(task, "READY", { dependenciesDone: true, workspaceValid: true }), { ok: true, status: "READY" });
});

test("rejects arbitrary transitions and RUNNING without validated workspace", () => {
  const ready = { ...validTask(), status: "READY" as const };
  assert.equal(transitionTask(validTask(), "DONE").error?.code, "TRANSITION_NOT_ALLOWED");
  assert.equal(transitionTask(ready, "RUNNING").error?.code, "WORKSPACE_INVALID");
});

test("requires validation and evidence before REVIEW", () => {
  const running = { ...validTask(), status: "RUNNING" as const };
  assert.equal(transitionTask(running, "REVIEW", { validationPassed: false, evidenceComplete: true }).error?.code, "VALIDATION_FAILED");
  assert.equal(transitionTask(running, "REVIEW", { validationPassed: true, evidenceComplete: false }).error?.code, "EVIDENCE_INCOMPLETE");
  assert.deepEqual(transitionTask(running, "REVIEW", { validationPassed: true, evidenceComplete: true }), { ok: true, status: "REVIEW" });
});

test("requires review approval, passing validation, and evidence before DONE", () => {
  const review = { ...validTask(), status: "REVIEW" as const, review_status: "PENDING" as const };
  assert.equal(transitionTask(review, "DONE", { validationPassed: true, evidenceComplete: true }).error?.code, "REVIEW_PENDING");
  assert.equal(transitionTask({ ...review, review_status: "REJECTED" }, "DONE", { validationPassed: true, evidenceComplete: true }).error?.code, "REVIEW_REJECTED");
  assert.equal(transitionTask({ ...review, review_status: "APPROVED" }, "DONE", { validationPassed: false, evidenceComplete: true }).error?.code, "VERIFICATION_INCOMPLETE");
  assert.deepEqual(transitionTask({ ...review, review_status: "APPROVED" }, "DONE", { validationPassed: true, evidenceComplete: true }), { ok: true, status: "DONE" });
});

test("cannot pass human approval gate without an explicit grant", () => {
  const task = { ...validTask(), status: "REVIEW" as const, approval_required: true, review_status: "APPROVED" as const };
  assert.equal(transitionTask(task, "DONE", { validationPassed: true, evidenceComplete: true }).error?.code, "APPROVAL_REQUIRED");
  assert.deepEqual(transitionTask(task, "DONE", { validationPassed: true, evidenceComplete: true, approvalGranted: true }), { ok: true, status: "DONE" });
});

test("FAILED requires a reason and cannot be disguised as success", () => {
  const running = { ...validTask(), status: "RUNNING" as const };
  assert.equal(transitionTask(running, "FAILED").error?.code, "FAILURE_REASON_REQUIRED");
  assert.deepEqual(transitionTask(running, "FAILED", { failureReason: "test command exited 1" }), { ok: true, status: "FAILED" });
});
