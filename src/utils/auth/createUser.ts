import { type Firestore, doc, getDoc, setDoc } from "firebase/firestore"

interface CreateUserProps {
  db: Firestore
  value: {
    id: string
    email: string
    name: string
  }
}

export async function createUser({ db, value }: CreateUserProps) {
  const userRef = doc(db, "users", value.id)
  const userSnap = await getDoc(userRef)

  if (!userSnap.exists()) {
    // Firestore にユーザー用のドキュメントが作られていなければ作る
    await setDoc(userRef, value)
  }
}
