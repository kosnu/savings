import { doc, type Firestore, setDoc } from "firebase/firestore"
import { collections } from "../../providers/firebase/store"
import type { User } from "../../types/user"

interface CreateUserProps {
  db: Firestore
  value: User
}

export async function createUser({ db, value }: CreateUserProps) {
  const userRef = doc(db, collections.users.path(), value.id).withConverter(
    collections.users.converter,
  )
  // Firestore にユーザー用のドキュメントが作られていなければ作る
  await setDoc(userRef, value)
}
