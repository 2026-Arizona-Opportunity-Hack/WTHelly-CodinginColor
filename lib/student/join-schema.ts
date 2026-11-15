import { z } from "zod";

// Shared by the /join form, the class-lookup server action and
// POST /api/student/join, so all three validate the same way.

/** Uppercase and drop spaces/dashes, so "loops 1" and "LOOPS-1" both work. */
export function normalizeClassCode(raw: string) {
  return raw.toUpperCase().replace(/[\s-]/g, "");
}

export const classCodeSchema = z
  .string()
  .transform(normalizeClassCode)
  .pipe(z.string().regex(/^[A-Z0-9]{6}$/, "Class codes are 6 letters or numbers."));

export const pinSchema = z.string().regex(/^\d{4}$/, "Your PIN is 4 numbers.");

export const joinRequestSchema = z.object({
  classCode: classCodeSchema,
  studentId: z.uuid(),
  pin: pinSchema,
});

export type JoinRequest = z.input<typeof joinRequestSchema>;

/** What the browser learns about a roster: never pin_hash. */
export type RosterStudent = { id: string; name: string; hasPin: boolean };

export type ClassLookup =
  | { status: "found"; classCode: string; className: string; students: RosterStudent[] }
  | { status: "error"; message: string };

export type JoinResponse = { ok: true } | { ok: false; error: string; locked?: boolean };
