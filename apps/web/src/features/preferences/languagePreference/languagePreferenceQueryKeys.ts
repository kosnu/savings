export const languagePreferenceQueryKeys = {
  all: ["languagePreference"] as const,
  current: (authUserId: string) => ["languagePreference", "current", authUserId] as const,
}
