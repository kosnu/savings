import type { PaymentRecord } from "../utils/types.ts"

export async function addToCollection(
  token: string,
  projectId: string,
  userId: string,
  record: PaymentRecord,
) {
  const dateObject = new Date(record.date.replace(/\//g, "-")) // YYYY-MM-DD 形式に統一
  const timestampValue = dateObject.toISOString()

  const currentDate = new Date()
  const timestampCurrent = currentDate.toISOString()

  const doc = {
    fields: {
      date: { timestampValue: timestampValue },
      note: { stringValue: record.note },
      amount: { integerValue: parsePrice(record.amount) },
      user_id: { stringValue: userId },
      created_at: { timestampValue: timestampCurrent },
      updated_at: { timestampValue: timestampCurrent },
    },
  }

  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${userId}/payments`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(doc),
    },
  )

  if (!res.ok) {
    throw new Error(`Firestore 追加失敗: ${await res.text()}`)
  }
}

function parsePrice(str: string): number {
  return Number.parseInt(str.replace(/[¥,]/g, ""), 10)
}
