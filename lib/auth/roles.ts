// Staff roles and which areas each may open. Pure data: imported by both
// proxy.ts (edge of every request) and the server-side guards, so the two
// checks can never disagree.

export const STAFF_ROLES = ["admin", "instructor", "reviewer"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export function isStaffRole(value: unknown): value is StaffRole {
  return STAFF_ROLES.includes(value as StaffRole);
}

// Where each role lands after signing in.
export const ROLE_HOME: Record<StaffRole, string> = {
  admin: "/admin",
  instructor: "/instructor",
  reviewer: "/review",
};

// Roles allowed in each staff area (the path and everything under it).
export const AREA_ROLES = {
  "/admin": ["admin"],
  "/instructor": ["instructor", "admin"],
  "/review": ["reviewer", "admin"],
} as const satisfies Record<string, readonly StaffRole[]>;

/** Roles allowed on this path, or null when the path is not a staff area. */
export function rolesForPath(pathname: string): readonly StaffRole[] | null {
  for (const [prefix, roles] of Object.entries(AREA_ROLES)) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return roles;
  }
  return null;
}
