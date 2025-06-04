import type { User } from "firebase/auth"
import {
  type Firestore,
  collection,
  getAggregateFromServer,
  query,
  sum,
  where,
} from "firebase/firestore"
import { collections } from "../../utils/firebase/store"

export async function fetchTotalIncome(
  db: Firestore,
  user: User | null,
  [startDate, endDate]: [Date | null, Date | null],
): Promise<number | null> {
  if (!user || !startDate || !endDate) {
    return null
  }

  const incomesRef = collection(
    db,
    collections.incomes.path(user.uid),
  ).withConverter(collections.incomes.converter)
  const querySnapshot = query(
    incomesRef,
    where("user_id", "==", user.uid),
    where("date", ">=", startDate),
    where("date", "<=", endDate),
  )

  const snapshot = await getAggregateFromServer(querySnapshot, {
    totalPopulation: sum("amount"),
  })

  return snapshot.data().totalPopulation
}
