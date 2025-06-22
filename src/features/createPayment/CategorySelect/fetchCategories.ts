import type { User } from "firebase/auth"
import {
  type Firestore,
  collection,
  getDocs,
  orderBy,
  query,
  where,
} from "firebase/firestore"
import type { Category } from "../../../types/category"
import { collections } from "../../../utils/firebase/store"

export async function fetchCategories(
  db: Firestore,
  user: User | null,
): Promise<Category[]> {
  if (!user) {
    return []
  }

  const queryConstrations = [where("user_id", "==", user.uid)]

  const categoriesRef = collection(
    db,
    collections.categories.path(user.uid),
  ).withConverter(collections.categories.converter)
  const querySnapshot = await getDocs(
    query(categoriesRef, ...queryConstrations, orderBy("name", "desc")),
  )

  const categories = querySnapshot.docs.map((doc) => doc.data())

  return categories
}
