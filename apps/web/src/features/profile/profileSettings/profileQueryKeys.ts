export const profileQueryKeys = {
  all: ["profile"] as const,
  current: (authUserId: string) => ["profile", "current", authUserId] as const,
}
