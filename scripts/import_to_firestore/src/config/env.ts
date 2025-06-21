function createEnv() {
  const serviceAccountKeyPath = Deno.env.get("SERVICE_ACCOUNT_KEY_PATH")
  const projectId = Deno.env.get("FIRESTORE_PROJECT_ID")
  const userId = Deno.env.get("SAVINGS_USER_ID")

  return {
    serviceAccountKeyPath: serviceAccountKeyPath,
    projectId: projectId,
    userId: userId,
  }
}

export const env = createEnv()
