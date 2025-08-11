import type { FirebaseOptions } from "firebase/app"
import { env } from "../env"

export const firebaseConfig: FirebaseOptions = {
  apiKey: env.FIREBASE_API_KEY,
  authDomain: env.FIREBASE_AUTH_DOMAIN,
  projectId: env.FIREBASE_PROJECT_ID,
}
