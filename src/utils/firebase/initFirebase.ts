import {
  type FirebaseApp,
  type FirebaseOptions,
  initializeApp,
} from "firebase/app"
import { type Firestore, getFirestore } from "firebase/firestore"

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
