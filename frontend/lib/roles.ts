/**
 * Role hierarchy — mirrors the backend `require_role` levels in
 * backend/app/auth.py. Frontend checks are for UX only; the backend
 * enforces access independently.
 */
export type Role = "read" | "write" | "admin";

export const ROLE_LEVELS: Record<Role, number> = {
  read: 0,
  write: 1,
  admin: 2,
};

/** True if `role` meets or exceeds `minimum` in the hierarchy. */
export function hasRole(role: Role | null | undefined, minimum: Role): boolean {
  if (!role) return false;
  return ROLE_LEVELS[role] >= ROLE_LEVELS[minimum];
}
