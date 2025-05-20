import { composeStories } from "@storybook/react"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import {
  type Firestore,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore"
import { expect, test } from "vitest"
import { user } from "../../../test/data/users"
import { insertUser } from "../../../test/utils/insertUser"
import { signInMockUser } from "../../../test/utils/signInByMockUser"
import type { Payment } from "../../../types/payment"
import { initEmulatedFirebase } from "../../../utils/firebase/FirebaseTestProvider"
import { collections } from "../../../utils/firebase/store"
import * as stories from "./CreatePaymentForm.stories"

const { Fiiled } = composeStories(stories)

test("Create payment", async () => {
  // FIXME: FiresotreTestProvider と処理が重複している
  //        上記を解決したいけど、テストデータ挿入処理前にFirebaseを初期化しないといけないので、
  //        FiresotreTestProvider の描画タイミングだと間に合わない
  const { firestore, auth } = initEmulatedFirebase()
  await signInMockUser(auth, user)

  const userId = auth.currentUser?.uid ?? user.id
  await insertUser(firestore, { ...user, id: userId })

  await Fiiled.run()

  const submitButton = screen.getByRole("button", { name: /create payment/i })
  await userEvent.click(submitButton)

  const payment = await getLastPayment(firestore, userId)
  expect(payment?.date === new Date())

  deletePaymentById(firestore, userId, payment?.id)
})

async function getLastPayment(
  firestore: Firestore,
  userId: string,
): Promise<Payment | undefined> {
  const paymentsRef = collection(firestore, collections.payments.path(userId))
  const q = query(
    paymentsRef.withConverter(collections.payments.converter),
    where("user_id", "==", userId),
    orderBy("created_date", "desc"),
    limit(1),
  )
  const snapshot = await getDocs(q)
  const doc = snapshot.docs[0]

  return {
    ...doc?.data(),
    id: doc?.id,
  }
}

async function deletePaymentById(
  firestore: Firestore,
  userId: string,
  paymentId: string | undefined,
): Promise<void> {
  if (paymentId === undefined) throw new Error("paymentId is undefined.")

  const paymentRef = doc(
    firestore,
    collections.payments.path(userId),
    paymentId,
  ).withConverter(collections.payments.converter)
  await deleteDoc(paymentRef)
}
