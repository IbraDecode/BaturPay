export const TASK_STATUSES = [
  "PROPOSED",
  "READY",
  "RUNNING",
  "BLOCKED",
  "REVIEW",
  "DONE",
  "FAILED",
] as const;

export const RISK_LEVELS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export const OWNERS = ["HERMES", "OPENCODE"] as const;
export const REVIEW_STATUSES = ["NOT_REQUIRED", "PENDING", "APPROVED", "REJECTED"] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];
export type RiskLevel = (typeof RISK_LEVELS)[number];
export type TaskOwner = (typeof OWNERS)[number];
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const EVIDENCE_SOURCES = ["CALLER", "EXECUTED", "HERMES_REVIEW"] as const;
export type EvidenceSource = (typeof EVIDENCE_SOURCES)[number];

export interface TaskEvidence {
  command: string;
  exit_code: number;
  summary: string;
  recorded_at: string;
  agent: TaskOwner;
  source: EvidenceSource;
  files_changed: string[];
}

export interface TaskContract {
  task_id: string;
  title: string;
  objective: string;
  owner: TaskOwner;
  workspace: string;
  dependencies: string[];
  acceptance_criteria: string[];
  risk_level: RiskLevel;
  status: TaskStatus;
  validation_commands: string[];
  evidence: TaskEvidence[];
  review_status: ReviewStatus;
  approval_required: boolean;
}

export interface ValidationIssue {
  path: string;
  code: string;
  message: string;
}

export interface ValidationResult<T> {
  ok: boolean;
  value?: T;
  errors: ValidationIssue[];
}

const TASK_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{2,127}$/;
const REQUIRED_TEXT = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;
const isOneOf = <T extends readonly string[]>(values: T, value: unknown): value is T[number] =>
  typeof value === "string" && values.includes(value);

export function isTaskEvidence(value: unknown): value is TaskEvidence {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return (
    REQUIRED_TEXT(item.command) &&
    Number.isInteger(item.exit_code) &&
    REQUIRED_TEXT(item.summary) &&
    typeof item.recorded_at === "string" &&
    !Number.isNaN(Date.parse(item.recorded_at)) &&
    isOneOf(OWNERS, item.agent) &&
    isOneOf(EVIDENCE_SOURCES, item.source) &&
    Array.isArray(item.files_changed) &&
    item.files_changed.every(REQUIRED_TEXT)
  );
}

export function validateTaskContract(input: unknown): ValidationResult<TaskContract> {
  const errors: ValidationIssue[] = [];
  const add = (path: string, code: string, message: string): void => {
    errors.push({ path, code, message });
  };

  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, errors: [{ path: "$", code: "TYPE", message: "Task must be an object." }] };
  }

  const task = input as Record<string, unknown>;
  if (!REQUIRED_TEXT(task.task_id) || !TASK_ID_PATTERN.test(task.task_id)) {
    add("task_id", "FORMAT", "task_id must be 3-128 characters using letters, digits, dot, underscore, colon, or hyphen.");
  }
  if (!REQUIRED_TEXT(task.title)) add("title", "REQUIRED", "title must be a non-empty string.");
  if (!REQUIRED_TEXT(task.objective)) add("objective", "REQUIRED", "objective must be a non-empty string.");
  if (!isOneOf(OWNERS, task.owner)) add("owner", "ENUM", "owner must be HERMES or OPENCODE.");
  if (!REQUIRED_TEXT(task.workspace) || !task.workspace.startsWith("/")) {
    add("workspace", "PATH", "workspace must be a non-empty absolute path.");
  }
  if (!Array.isArray(task.dependencies) || !task.dependencies.every((item) => typeof item === "string" && TASK_ID_PATTERN.test(item))) {
    add("dependencies", "TYPE_OR_FORMAT", "dependencies must be an array of valid task IDs.");
  } else if (new Set(task.dependencies).size !== task.dependencies.length) {
    add("dependencies", "DUPLICATE", "dependencies must not contain duplicate task IDs.");
  }
  if (!Array.isArray(task.acceptance_criteria) || task.acceptance_criteria.length === 0 || !task.acceptance_criteria.every(REQUIRED_TEXT)) {
    add("acceptance_criteria", "REQUIRED", "acceptance_criteria must be a non-empty array of non-empty strings.");
  }
  if (!isOneOf(RISK_LEVELS, task.risk_level)) add("risk_level", "ENUM", "risk_level is not recognized.");
  if (!isOneOf(TASK_STATUSES, task.status)) add("status", "ENUM", "status is not recognized.");
  if (!Array.isArray(task.validation_commands) || !task.validation_commands.every(REQUIRED_TEXT)) {
    add("validation_commands", "TYPE", "validation_commands must be an array of non-empty strings.");
  }
  if (!Array.isArray(task.evidence) || !task.evidence.every(isTaskEvidence)) {
    add("evidence", "SHAPE", "evidence must be an array of valid evidence records.");
  }
  if (!isOneOf(REVIEW_STATUSES, task.review_status)) add("review_status", "ENUM", "review_status is not recognized.");
  if (typeof task.approval_required !== "boolean") add("approval_required", "TYPE", "approval_required must be a boolean.");

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: task as unknown as TaskContract, errors };
}

export interface TransitionContext {
  dependenciesDone?: boolean;
  workspaceValid?: boolean;
  validationPassed?: boolean;
  evidenceComplete?: boolean;
  reviewStatus?: ReviewStatus;
  approvalGranted?: boolean;
  failureReason?: string;
}

export interface TransitionResult {
  ok: boolean;
  status?: TaskStatus;
  error?: { code: string; message: string };
}

const TRANSITIONS: Readonly<Record<TaskStatus, readonly TaskStatus[]>> = {
  PROPOSED: ["READY", "BLOCKED", "FAILED"],
  READY: ["RUNNING", "BLOCKED", "FAILED"],
  RUNNING: ["REVIEW", "BLOCKED", "FAILED"],
  BLOCKED: ["PROPOSED", "FAILED"],
  REVIEW: ["DONE", "READY", "BLOCKED", "FAILED"],
  DONE: [],
  FAILED: ["PROPOSED"],
};

export function transitionTask(
  task: TaskContract,
  next: TaskStatus,
  context: TransitionContext = {},
): TransitionResult {
  if (!TRANSITIONS[task.status].includes(next)) {
    return { ok: false, error: { code: "TRANSITION_NOT_ALLOWED", message: `Cannot transition from ${task.status} to ${next}.` } };
  }

  if (task.status === "PROPOSED" && next === "READY") {
    if (context.dependenciesDone !== true) return { ok: false, error: { code: "DEPENDENCIES_PENDING", message: "All dependencies must be complete before READY." } };
    if (context.workspaceValid !== true) return { ok: false, error: { code: "WORKSPACE_INVALID", message: "A validated workspace is required before READY." } };
  }
  if (task.status === "READY" && next === "RUNNING" && context.workspaceValid !== true) {
    return { ok: false, error: { code: "WORKSPACE_INVALID", message: "A validated workspace is required before RUNNING." } };
  }
  if (task.status === "RUNNING" && next === "REVIEW") {
    if (context.validationPassed !== true) return { ok: false, error: { code: "VALIDATION_FAILED", message: "Validation must pass before REVIEW." } };
    if (context.evidenceComplete !== true) return { ok: false, error: { code: "EVIDENCE_INCOMPLETE", message: "Complete evidence is required before REVIEW." } };
  }
  if (task.status === "REVIEW" && next === "DONE") {
    const effectiveReview = context.reviewStatus ?? task.review_status;
    if (effectiveReview === "REJECTED") return { ok: false, error: { code: "REVIEW_REJECTED", message: "A rejected review cannot be completed." } };
    if (effectiveReview === "PENDING") return { ok: false, error: { code: "REVIEW_PENDING", message: "Review must be approved or not required before DONE." } };
    if (context.validationPassed !== true || context.evidenceComplete !== true) {
      return { ok: false, error: { code: "VERIFICATION_INCOMPLETE", message: "Passing validation and complete evidence are required before DONE." } };
    }
    if (task.approval_required && context.approvalGranted !== true) {
      return { ok: false, error: { code: "APPROVAL_REQUIRED", message: "Human approval is required before DONE." } };
    }
  }
  if (next === "FAILED" && !REQUIRED_TEXT(context.failureReason)) {
    return { ok: false, error: { code: "FAILURE_REASON_REQUIRED", message: "A failure reason is required for FAILED." } };
  }
  return { ok: true, status: next };
}

export function isTaskContract(input: unknown): input is TaskContract {
  return validateTaskContract(input).ok;
}
