import { type Firestore, doc, setDoc } from "firebase/firestore"
import type { User } from "../../types/user"
import { collections } from "../../utils/firebase/store"

export async function insertUser(firestore: Firestore, user: User) {
  const userRef = doc(
    firestore,
    collections.users.path(),
    user.id,
  ).withConverter(collections.users.converter)
  await setDoc(userRef, user)
}
