import "server-only";
import { randomInt } from "node:crypto";

// No 0/O, 1/I/L: students copy these from a whiteboard.
export const JOIN_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** A random 6-character class code. Uniqueness is enforced by the DB; callers retry on collision. */
export function generateJoinCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) code += JOIN_CODE_ALPHABET[randomInt(JOIN_CODE_ALPHABET.length)];
  return code;
}
