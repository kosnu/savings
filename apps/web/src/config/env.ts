import * as z from "zod"

function emptyStringToUndefined(value: unknown) {
  return value === "" ? undefined : value
}

function createEnv() {
  const mode = import.meta.env.MODE

  const EnvSchema = z.object({
    MODE: z.enum(["development", "production", "test"]),

    FIRESTORE_DATABASE_ID: z.string().default("(default)"),

    FIRESTORE_EMULATOR_HOST: z.string().default("localhost:8080"),

    SENTRY_DSN: z.preprocess(emptyStringToUndefined, z.string().url().optional()),
    SENTRY_ENVIRONMENT: z.preprocess(emptyStringToUndefined, z.string().min(1).optional()),

    SUPABASE_URL: z.string().default("http://localhost:54321"),
    SUPABASE_PUBLISHABLE_KEY: z.string().min(1, "VITE_SUPABASE_PUBLISHABLE_KEY is required"),
  })

  const envVars = Object.entries(import.meta.env).reduce<Record<string, string>>((acc, curr) => {
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
