// Business rules (docs/requirements.md → "Business rules and formulas").
// The single place that decides completion, unlocking, the current module and
// the next step. Pure functions over plain data: no database calls, no React,
// so pages, server routes and the dashboard all agree.

export type AssessmentKind = "pre" | "post";

/** One activity in a module, in student order (lesson position, then activity position). */
export type ActivityRef = {
  id: string;
  type: "video" | "check" | "worksheet" | "exit" | "code";
  required: boolean;
};

/** Everything the rules need to know about one assigned module for one student. */
export type ModuleProgressInput = {
  moduleId: string;
  /** Ordered as the student sees them. */
  activities: ActivityRef[];
  /** False only if the module has no pretest / post-test row (ASM-1 says it should). */
  hasPretest: boolean;
  hasPosttest: boolean;
  pretestTaken: boolean;
  posttestTaken: boolean;
  /** Activity ids this student has a submission for. */
  submitted: ReadonlySet<string>;
};

export type ModuleStatus = "locked" | "available" | "in_progress" | "complete";

export type NextStep =
  | { kind: "pretest" }
  | { kind: "activity"; activityId: string }
  | { kind: "posttest" }
  | { kind: "done" };

// ---------------------------------------------------------------------------
// Completion

/** Activity complete: a submission exists. Auto-scored items need not be correct. */
export function isActivityComplete(m: ModuleProgressInput, activityId: string): boolean {
  return m.submitted.has(activityId);
}

/** Activities that must be done before the post-test: every required one, plus every exit question. */
export function mustDo(a: ActivityRef): boolean {
  return a.required || a.type === "exit";
}

function pretestDone(m: ModuleProgressInput): boolean {
  return !m.hasPretest || m.pretestTaken;
}

function posttestDone(m: ModuleProgressInput): boolean {
  return !m.hasPosttest || m.posttestTaken;
}

/** All required activities and the exit question are submitted (pretest not considered). */
function activitiesDone(m: ModuleProgressInput): boolean {
  return m.activities.every((a) => !mustDo(a) || m.submitted.has(a.id));
}

/** Module complete: pretest, every required activity, the exit question and the post-test all submitted. */
export function isModuleComplete(m: ModuleProgressInput): boolean {
  return pretestDone(m) && activitiesDone(m) && posttestDone(m);
}

// ---------------------------------------------------------------------------
// Unlocking

/**
 * Module unlock: module 1 of the class's assignment list is always available;
 * module N+1 unlocks when module N is complete. `modules` is in assignment order.
 */
export function isModuleUnlocked(modules: ModuleProgressInput[], index: number): boolean {
  if (index < 0 || index >= modules.length) return false;
  return index === 0 || isModuleComplete(modules[index - 1]);
}

/** Pretest: open while the module is unlocked and the pretest hasn't been taken (ASM-3: once). */
export function canTakePretest(m: ModuleProgressInput, moduleUnlocked: boolean): boolean {
  return moduleUnlocked && m.hasPretest && !m.pretestTaken;
}

/**
 * Activities unlock in order, and none unlock until the pretest is submitted (ASM-2).
 * An activity is open when every earlier must-do activity is complete. Optional
 * activities never block the ones after them. Already-submitted activities stay
 * open so a student can look back at them.
 */
export function isActivityUnlocked(
  m: ModuleProgressInput,
  moduleUnlocked: boolean,
  activityId: string,
): boolean {
  if (!moduleUnlocked || !pretestDone(m)) return false;
  for (const a of m.activities) {
    if (a.id === activityId) return true;
    if (mustDo(a) && !m.submitted.has(a.id)) return false;
  }
  return false; // not in this module
}

/** Post-test unlocks after the exit question (and every required activity) is submitted (ASM-2). */
export function isPosttestUnlocked(m: ModuleProgressInput, moduleUnlocked: boolean): boolean {
  return moduleUnlocked && m.hasPosttest && pretestDone(m) && activitiesDone(m);
}

// ---------------------------------------------------------------------------
// Status, next step, current module

export function moduleStatus(m: ModuleProgressInput, moduleUnlocked: boolean): ModuleStatus {
  if (isModuleComplete(m)) return "complete";
  if (!moduleUnlocked) return "locked";
  const started = m.pretestTaken || m.posttestTaken || m.submitted.size > 0;
  return started ? "in_progress" : "available";
}

/**
 * Where "Continue" goes inside one module: pretest → first incomplete must-do
 * activity → post-test → done. Optional activities are reachable but never
 * the Continue target.
 */
export function nextStepInModule(m: ModuleProgressInput): NextStep {
  if (!pretestDone(m)) return { kind: "pretest" };
  const next = m.activities.find((a) => mustDo(a) && !m.submitted.has(a.id));
  if (next) return { kind: "activity", activityId: next.id };
  if (!posttestDone(m)) return { kind: "posttest" };
  return { kind: "done" };
}

/**
 * The activity after `activityId` in module order (for the player's Next
 * button), or null when it is the last one.
 */
export function activityAfter(m: ModuleProgressInput, activityId: string): string | null {
  const i = m.activities.findIndex((a) => a.id === activityId);
  if (i === -1 || i === m.activities.length - 1) return null;
  return m.activities[i + 1].id;
}

/**
 * Current module: the first assigned module that is not complete, or -1 when
 * all are complete (or none are assigned). Because module N+1 only unlocks when
 * N is complete, this is also where a late joiner starts (STU-5).
 */
export function currentModuleIndex(modules: ModuleProgressInput[]): number {
  return modules.findIndex((m) => !isModuleComplete(m));
}

// ---------------------------------------------------------------------------
// Scores

/** Test score: correct / total × 100, rounded to 1 decimal. 0 questions → 0. */
export function percentScore(correct: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((correct / total) * 1000) / 10;
}
