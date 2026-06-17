import type { AppRole } from "./authRoles.ts";

/** Service-role writes: role in app_metadata; display fields in user_metadata only. */
export function authUserUpdateForRole(
  role: AppRole,
  userMetadata: Record<string, unknown>,
): {
  app_metadata: { role: AppRole };
  user_metadata: Record<string, unknown>;
} {
  const { role: _strip, ...safeMeta } = userMetadata;
  return {
    app_metadata: { role },
    user_metadata: safeMeta,
  };
}
