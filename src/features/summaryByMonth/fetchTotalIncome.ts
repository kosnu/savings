import type { User } from "firebase/auth"
import type { Firestore } from "firebase/firestore"

export async function fetchTotalIncome(
  _db: Firestore,
  user: User | null,
  [startDate, endDate]: [Date | null, Date | null],
): Promise<number | null> {
  if (!user || !startDate || !endDate) {
    return null
  }

  // TODO: コレクションを作成してから実装する

  return Promise.resolve(1000000)
}
