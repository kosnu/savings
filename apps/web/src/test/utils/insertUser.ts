import { doc, type Firestore, setDoc } from "firebase/firestore"
import { collections } from "../../providers/firebase/store"
import type { User } from "../../types/user"

export async function insertUser(firestore: Firestore, user: User) {
  const userRef = doc(
    firestore,
    collections.users.path(),
    user.id,
  ).withConverter(collections.users.converter)
  await setDoc(userRef, user)
}
