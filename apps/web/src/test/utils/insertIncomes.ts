import type { Auth } from "firebase/auth"
import { doc, type Firestore, setDoc } from "firebase/firestore"
import { collections } from "../../providers/firebase/store"
import type { Income } from "../../types/income"

export async function insertIncomes(
  auth: Auth,
  firestore: Firestore,
  incomes: Income[],
) {
  const userId = auth.currentUser?.uid
  if (!userId) throw new Error("未認証です")

  for (const income of incomes) {
    const incomeRef = income.id
      ? doc(firestore, collections.incomes.path(userId), income.id)
      : doc(firestore, collections.incomes.path(userId))
    await setDoc(incomeRef.withConverter(collections.incomes.converter), {
      ...income,
      userId: userId,
    })
  }
}
