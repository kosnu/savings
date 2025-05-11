import {
  type FirebaseApp,
  type FirebaseOptions,
  initializeApp,
} from "firebase/app"
import { connectAuthEmulator, getAuth } from "firebase/auth"
import {
  type Firestore,
  connectFirestoreEmulator,
  getFirestore,
} from "firebase/firestore"

export const firebaseConfig: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}

export const firebaseTestConfig: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
}

interface InitFirebaseReturn {
  app: FirebaseApp
  firestore: Firestore
}

export function initFirebase(options: FirebaseOptions): InitFirebaseReturn {
  const app = initializeApp(options)
  const firestore = getFirestore(app)

  return {
    app: app,
    firestore: firestore,
  }
}

export function useEmulator(app: FirebaseApp) {
  const auth = getAuth(app)
  const db = getFirestore(app)

  //emulator設定
  connectAuthEmulator(auth, import.meta.env.VITE_FIREBASE_AUTH_DOMAIN)
  const [host, port] = import.meta.env.VITE_FIRESTORE_EMULATOR_HOST.split(":")
  connectFirestoreEmulator(db, host, port)
}
