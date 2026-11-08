export function canViewCsePublicDetails(
  roles: readonly string[],
  userId: string | undefined,
  event: { created_by: string; is_public: boolean | null } | undefined,
): boolean {
  return Boolean(userId && roles.includes("cse") && event?.is_public && event.created_by === userId);
}