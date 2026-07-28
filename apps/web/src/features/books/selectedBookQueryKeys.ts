export const selectedBookQueryKeys = {
  selected: (authUserId: string | undefined) => ["books", "selected", authUserId] as const,
}
