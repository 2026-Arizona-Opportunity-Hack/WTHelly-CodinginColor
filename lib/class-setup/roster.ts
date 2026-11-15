// Roster rules for class setup (CLS-2, CLS-3). Pure functions, used by the
// CSV preview in the browser and again by the server action before inserting.
// Students are minors: we store a display name (first name + last initial)
// and an optional school, nothing else.

export const NAME_MAX = 40;
export const SCHOOL_MAX = 80;
export const MAX_IMPORT_ROWS = 200;

export type ActionResult = { ok: boolean; message: string };

export type RosterRowInput = { name: string; school: string };
export type CheckedRow = RosterRowInput & { row: number; problem: string | null };

const NAME_HINT = "Use first name + last initial (e.g. Maya R).";

/** Trim and collapse inner whitespace. Non-strings become "". */
export function cleanText(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

export const nameKey = (name: string) => cleanText(name).toLowerCase();

/** Why this display name can't be used, or null when it's fine. */
export function nameProblem(name: string): string | null {
  if (!name) return "Name is empty.";
  if (name.length > NAME_MAX) return `Name is longer than ${NAME_MAX} characters.`;
  if (name.includes("@")) return `Looks like an email. ${NAME_HINT}`;
  const words = name.split(" ");
  // "Maya" and "Maya R" / "Mary Ann R." are fine; "Maya Rodriguez" is a full name.
  if (words.length > 1 && !/^\p{L}\.?$/u.test(words[words.length - 1])) {
    return `Looks like a full name. ${NAME_HINT}`;
  }
  return null;
}

export function schoolProblem(school: string): string | null {
  return school.length > SCHOOL_MAX ? `School is longer than ${SCHOOL_MAX} characters.` : null;
}

/**
 * Check every row: empty, invalid name, duplicate within the file, or already
 * in the class (names compare case-insensitively). Only rows with
 * problem === null get imported.
 */
export function checkRoster(rows: RosterRowInput[], existingNames: Iterable<string>): CheckedRow[] {
  const inClass = new Set(Array.from(existingNames, nameKey));
  const seen = new Set<string>();
  return rows.map((input, i) => {
    const name = cleanText(input.name);
    const school = cleanText(input.school);
    const key = name.toLowerCase();
    let problem = nameProblem(name) ?? schoolProblem(school);
    if (!problem && seen.has(key)) problem = "Duplicate of an earlier row in this file.";
    if (!problem && inClass.has(key)) problem = "Already in this class.";
    if (name) seen.add(key);
    return { row: i + 1, name, school, problem };
  });
}
