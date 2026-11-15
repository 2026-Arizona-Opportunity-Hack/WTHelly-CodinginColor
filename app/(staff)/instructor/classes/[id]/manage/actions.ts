"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getManagedClass, idSchema, isAssignableInstructor, type ManagedClass } from "@/lib/class-setup/access";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  checkRoster,
  cleanText,
  MAX_IMPORT_ROWS,
  type ActionResult,
} from "@/lib/class-setup/roster";

// Every action: validate input → check role + class ownership (getManagedClass)
// → write with the user's own client so RLS enforces the same rule.

const NO_ACCESS: ActionResult = { ok: false, message: "You can't manage this class." };
const FAILED: ActionResult = { ok: false, message: "Something went wrong. Try again in a moment." };

const refresh = () => revalidatePath("/instructor", "layout");
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

async function classNames(access: ManagedClass, classId: string) {
  const { data, error } = await access.supabase
    .from("students")
    .select("display_name")
    .eq("class_id", classId);
  return error ? null : (data ?? []).map((s) => s.display_name);
}

const rowsSchema = z
  .array(z.object({ name: z.string().max(200), school: z.string().max(200) }))
  .min(1)
  .max(MAX_IMPORT_ROWS);

/** CLS-2: import the valid rows of a previewed roster CSV, in one insert. */
export async function importRoster(classId: string, rows: unknown): Promise<ActionResult> {
  const parsed = rowsSchema.safeParse(rows);
  if (!parsed.success) return { ok: false, message: `Import 1 to ${MAX_IMPORT_ROWS} rows at a time.` };
  const access = await getManagedClass(classId);
  if (!access) return NO_ACCESS;

  const existing = await classNames(access, classId);
  if (!existing) return FAILED;
  // Re-check on the server: the roster may have changed since the preview.
  const checked = checkRoster(parsed.data, existing);
  const valid = checked.filter((r) => !r.problem);
  const skipped = checked.length - valid.length;
  if (!valid.length) return { ok: false, message: "No valid rows to import. Fix the CSV and try again." };

  const { error } = await access.supabase.from("students").insert(
    valid.map((r) => ({ class_id: classId, display_name: r.name, school: r.school || null })),
  );
  if (error) {
    console.error("importRoster failed", error.code);
    return error.code === "23505"
      ? { ok: false, message: "Some of these names were just added to the class. Upload the file again." }
      : FAILED;
  }
  refresh();
  return {
    ok: true,
    message: `Imported ${plural(valid.length, "student")}.${skipped ? ` Skipped ${plural(skipped, "row")} with problems.` : ""}`,
  };
}

/** CLS-3: add one student by name. Used with useActionState. */
export async function addStudent(
  classId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const name = cleanText(formData.get("name"));
  const school = cleanText(formData.get("school"));
  const access = await getManagedClass(classId);
  if (!access) return NO_ACCESS;

  const existing = await classNames(access, classId);
  if (!existing) return FAILED;
  const [row] = checkRoster([{ name, school }], existing);
  if (row.problem) return { ok: false, message: row.problem };

  const { error } = await access.supabase
    .from("students")
    .insert({ class_id: classId, display_name: row.name, school: row.school || null });
  if (error) {
    console.error("addStudent failed", error.code);
    return error.code === "23505" ? { ok: false, message: "Already in this class." } : FAILED;
  }
  refresh();
  return { ok: true, message: `Added ${row.name}.` };
}

/** Load one student of this class (named columns only: pin_hash is never readable). */
async function findStudent(classId: string, studentId: string) {
  if (!idSchema.safeParse(studentId).success) return null;
  const access = await getManagedClass(classId);
  if (!access) return null;
  const { data: student } = await access.supabase
    .from("students")
    .select("id, display_name")
    .eq("id", studentId)
    .eq("class_id", classId)
    .maybeSingle();
  return student ? { ...access, student } : null;
}

/** CLS-3: remove a student. Their submissions and test results cascade-delete. */
export async function removeStudent(classId: string, studentId: string): Promise<ActionResult> {
  const found = await findStudent(classId, studentId);
  if (!found) return { ok: false, message: "That student isn't in this class anymore." };
  const { error } = await found.supabase.from("students").delete().eq("id", studentId).eq("class_id", classId);
  if (error) {
    console.error("removeStudent failed", error.code);
    return FAILED;
  }
  refresh();
  return { ok: true, message: `Removed ${found.student.display_name} and their progress.` };
}

/**
 * Clear a student's PIN and lockout so they choose a new PIN next time they
 * join, and sign out every device linked to them (e.g. someone who claimed
 * their name).
 */
export async function resetPin(classId: string, studentId: string): Promise<ActionResult> {
  const found = await findStudent(classId, studentId);
  if (!found) return { ok: false, message: "That student isn't in this class anymore." };

  // The one service-role write in class setup. student_devices has no grants or
  // policies for `authenticated` (only server code links devices), so the
  // user's client can't delete from it. It's safe here because findStudent()
  // has just verified, with the caller's own RLS-bound client and
  // getManagedClass(), that the caller is an instructor/admin who owns this
  // student's class, and the delete is scoped to that one student_id.
  const { error: devicesError } = await createAdminClient()
    .from("student_devices")
    .delete()
    .eq("student_id", found.student.id);
  if (devicesError) {
    console.error("resetPin: device sign-out failed", devicesError.code);
    return FAILED;
  }

  const { error } = await found.supabase
    .from("students")
    .update({ pin_hash: null, failed_pin_attempts: 0, pin_locked_until: null })
    .eq("id", studentId)
    .eq("class_id", classId);
  if (error) {
    console.error("resetPin failed", error.code);
    return FAILED;
  }
  refresh();
  return {
    ok: true,
    message: `PIN reset for ${found.student.display_name}. All their devices are signed out; they'll choose a new PIN next time they join.`,
  };
}

async function assignedModules(access: ManagedClass, classId: string) {
  const { data, error } = await access.supabase
    .from("assignments")
    .select("module_id, position")
    .eq("class_id", classId)
    .order("position");
  return error ? null : (data ?? []);
}

/** CLS-4: add a published module to the end of the class's list. */
export async function assignModule(classId: string, moduleId: string): Promise<ActionResult> {
  if (!idSchema.safeParse(moduleId).success) return FAILED;
  const access = await getManagedClass(classId);
  if (!access) return NO_ACCESS;

  const { data: mod } = await access.supabase
    .from("modules")
    .select("id, title")
    .eq("id", moduleId)
    .eq("status", "published")
    .maybeSingle();
  if (!mod) return { ok: false, message: "That module isn't published." };

  const current = await assignedModules(access, classId);
  if (!current) return FAILED;
  if (current.some((a) => a.module_id === moduleId)) return { ok: false, message: `${mod.title} is already assigned.` };
  const position = current.reduce((max, a) => Math.max(max, a.position), 0) + 1;

  const { error } = await access.supabase
    .from("assignments")
    .insert({ class_id: classId, module_id: moduleId, position });
  if (error) {
    console.error("assignModule failed", error.code);
    return FAILED;
  }
  refresh();
  return { ok: true, message: `Assigned ${mod.title}.` };
}

/** CLS-4: remove a module from the class. Student work on it is kept. */
export async function unassignModule(classId: string, moduleId: string): Promise<ActionResult> {
  if (!idSchema.safeParse(moduleId).success) return FAILED;
  const access = await getManagedClass(classId);
  if (!access) return NO_ACCESS;
  const { error } = await access.supabase
    .from("assignments")
    .delete()
    .eq("class_id", classId)
    .eq("module_id", moduleId);
  if (error) {
    console.error("unassignModule failed", error.code);
    return FAILED;
  }
  refresh();
  return { ok: true, message: "Module unassigned. Student work on it is kept." };
}

/** CLS-4: move a module one place up or down, then renumber positions 1..n. */
export async function moveModule(
  classId: string,
  moduleId: string,
  direction: "up" | "down",
): Promise<ActionResult> {
  if (!idSchema.safeParse(moduleId).success || (direction !== "up" && direction !== "down")) return FAILED;
  const access = await getManagedClass(classId);
  if (!access) return NO_ACCESS;

  const current = await assignedModules(access, classId);
  if (!current) return FAILED;
  const order = current.map((a) => a.module_id);
  const from = order.indexOf(moduleId);
  const to = direction === "up" ? from - 1 : from + 1;
  if (from === -1 || to < 0 || to >= order.length) return { ok: false, message: "That module can't move further." };
  [order[from], order[to]] = [order[to], order[from]];

  const results = await Promise.all(
    order.flatMap((id, i) =>
      current.find((a) => a.module_id === id)?.position === i + 1
        ? []
        : [access.supabase.from("assignments").update({ position: i + 1 }).eq("class_id", classId).eq("module_id", id)],
    ),
  );
  if (results.some((r) => r.error)) {
    console.error("moveModule failed");
    return FAILED;
  }
  refresh();
  return { ok: true, message: `Moved to position ${to + 1}.` };
}

/** Admins only: hand the class to another instructor or admin. */
export async function changeInstructor(classId: string, instructorId: string): Promise<ActionResult> {
  const access = await getManagedClass(classId);
  if (!access || access.role !== "admin") return { ok: false, message: "Only admins can change a class's instructor." };
  if (instructorId === access.cls.instructor_id) return { ok: true, message: "That instructor already teaches this class." };
  if (!(await isAssignableInstructor(access.supabase, instructorId))) {
    return { ok: false, message: "Pick an instructor from the list." };
  }
  const { error } = await access.supabase.from("classes").update({ instructor_id: instructorId }).eq("id", classId);
  if (error) {
    console.error("changeInstructor failed", error.code);
    return FAILED;
  }
  refresh();
  revalidatePath("/admin");
  return { ok: true, message: "Instructor changed." };
}
