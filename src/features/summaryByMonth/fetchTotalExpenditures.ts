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

export async function fetchTotalExpenditures(
  db: Firestore,
  user: User | null,
  [startDate, endDate]: [Date | null, Date | null],
): Promise<number | null> {
  if (!user || !startDate || !endDate) {
    return null
  }

  const paymentsRef = collection(
    db,
    collections.payments.path(user.uid),
  ).withConverter(collections.payments.converter)
  const querySnapshot = query(
    paymentsRef,
    where("user_id", "==", user.uid),
    where("date", ">=", startDate),
    where("date", "<=", endDate),
  )

  const snapshot = await getAggregateFromServer(querySnapshot, {
    totalPopulation: sum("amount"),
  })

  return snapshot.data().totalPopulation
}
