export type AppRole = "admin" | "preparer" | "client";

export function roleFromAppMetadata(
  user: { app_metadata?: Record<string, unknown> },
): AppRole | undefined {
  const role = user.app_metadata?.role;
  if (role === "admin" || role === "preparer" || role === "client") return role;
  return undefined;
}

export function isAdminUser(user: { app_metadata?: Record<string, unknown> }): boolean {
  return roleFromAppMetadata(user) === "admin";
}

/** Copy legacy user_metadata.role → app_metadata.role when missing (idempotent). */
export function buildAppMetadataBackfill(
  user: {
    app_metadata?: Record<string, unknown>;
    user_metadata?: Record<string, unknown>;
  },
): Record<string, unknown> | null {
  const existing = user.app_metadata?.role;
  if (typeof existing === "string" && existing.length > 0) return null;

  const legacy = user.user_metadata?.role;
  if (legacy !== "admin" && legacy !== "preparer" && legacy !== "client") return null;

  return {
    ...(user.app_metadata ?? {}),
    role: legacy,
  };
}
