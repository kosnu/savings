import z from "zod"

function createEnv() {
  const mode = import.meta.env.MODE

  const EnvSchema = z.object({
    MODE: z.enum(["development", "production", "test"]),

    FIREBASE_API_KEY: z.string().default("xxx"),
    FIREBASE_AUTH_DOMAIN: z.string().default("http://localhost:9099"),
    FIREBASE_PROJECT_ID: z.string(),
    FIREBASE_STORAGE_BUCKET: z.string().optional(),
    FIREBASE_MESSAGING_SENDER_ID: z.string().optional(),
    FIREBASE_APP_ID: z.string().optional(),
    FIREBASE_MEASUREMENT_ID: z.string().optional(),

    FIRESTORE_EMULATOR_HOST: z.string().default("localhost:8080"),
  })

  const envVars = Object.entries(import.meta.env).reduce<
    Record<string, string>
  >((acc, curr) => {
    const [key, value] = curr
    if (key.startsWith("VITE_")) {
      acc[key.replace("VITE_", "")] = value
    }
    return acc
  }, {})

  const parsedEnv = EnvSchema.safeParse({ ...envVars, MODE: mode })

  if (!parsedEnv.success) {
    throw new Error(
      `Invalid env provided.
The following variables are missing or invalid:
${Object.entries(parsedEnv.error.flatten().fieldErrors)
  .map(([k, v]) => `- ${k}: ${v}`)
  .join("\n")}
`,
    )
  }

  return parsedEnv.data
}

export const env = createEnv()
