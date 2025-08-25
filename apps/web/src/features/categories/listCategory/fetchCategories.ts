import {
  collection,
  type Firestore,
  getDocs,
  orderBy,
  query,
} from "firebase/firestore"
import { collections } from "../../../providers/firebase/store"
import type { Category } from "../../../types/category"

export async function fetchCategories(db: Firestore): Promise<Category[]> {
  const categoriesRef = collection(
    db,
    collections.categories.path(),
  ).withConverter(collections.categories.converter)
  const querySnapshot = await getDocs(
    query(categoriesRef, orderBy("name", "desc")),
  )
  const categories = querySnapshot.docs.map((doc) => doc.data())

  return categories
}
