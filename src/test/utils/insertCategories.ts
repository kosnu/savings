import type { Auth } from "firebase/auth"
import { type Firestore, doc, setDoc } from "firebase/firestore"
import type { Category } from "../../types/category"
import { collections } from "../../utils/firebase/store"

export async function insertCategories(
  auth: Auth,
  firestore: Firestore,
  categories: Category[],
) {
  const userId = auth.currentUser?.uid
  if (!userId) throw new Error("未認証です")

  for (const category of categories) {
    const categoryRef = category.id
      ? doc(firestore, collections.categories.path(userId), category.id)
      : doc(firestore, collections.categories.path(userId))
    await setDoc(categoryRef.withConverter(collections.categories.converter), {
      ...category,
      userId: userId,
    })
  }
}
