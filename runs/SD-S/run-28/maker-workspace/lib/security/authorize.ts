export function ownedResourceWhere(userId: string, resourceId: string): { userId: string; resourceId: string } {
  return { userId, resourceId };
}
