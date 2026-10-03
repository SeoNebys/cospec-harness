export type OwnerScope = { userId: string };

export function assertOwnerScope(scope: OwnerScope): string {
  if (!scope.userId) throw new Error("Owner-scoped repository call requires a userId");
  return scope.userId;
}
