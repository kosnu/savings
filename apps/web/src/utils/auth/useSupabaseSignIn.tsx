import { startExplicitLogin } from "../../lib/explicitLogin"

export function useSupabaseSignIn() {
  return { signIn: startExplicitLogin }
}
