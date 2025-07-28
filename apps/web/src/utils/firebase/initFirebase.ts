import {
  type FirebaseApp,
  type FirebaseOptions,
  initializeApp,
} from "firebase/app"
import { type Auth, connectAuthEmulator, getAuth } from "firebase/auth"
import {
  connectFirestoreEmulator,
  type Firestore,
  getFirestore,
} from "firebase/firestore"
import { env } from "../../config/env"

interface InitFirebaseReturn {
  app: FirebaseApp
  firestore: Firestore
  auth: Auth
}

export function initFirebase(
  options: FirebaseOptions,
  mode: typeof env.MODE = env.MODE,
): InitFirebaseReturn {
  const app = initializeApp(options)
  const auth = getAuth(app)

  const databaseId = `savings-${mode}`
  const firestore = getFirestore(app, databaseId)

  if (mode === "development" || mode === "test") {
    connectEmulator(auth, firestore)
  }

  return {
    app: app,
    firestore: firestore,
    auth: auth,
  }
}

// Emulator 設定
function connectEmulator(auth: Auth, firestore: Firestore) {
  connectAuthEmulator(auth, env.FIREBASE_AUTH_DOMAIN, {
    disableWarnings: true,
  })

  const [host, port] = env.FIRESTORE_EMULATOR_HOST.split(":")
  connectFirestoreEmulator(firestore, host, Number.parseInt(port, 10))
}
