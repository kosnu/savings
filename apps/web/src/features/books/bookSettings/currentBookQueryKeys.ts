export const currentBookQueryKeys = {
  current: (authUserId: string) => ["books", "current", authUserId] as const,
}
