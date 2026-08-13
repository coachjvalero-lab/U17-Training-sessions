export function shouldSurfaceSessionSubscriptionError({
  hasCachedSessions,
  hasLoadedRemoteSession,
}: {
  hasCachedSessions: boolean;
  hasLoadedRemoteSession: boolean;
}): boolean {
  return !hasCachedSessions && !hasLoadedRemoteSession;
}
