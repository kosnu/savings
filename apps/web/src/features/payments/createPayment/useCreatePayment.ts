import { useMutation } from "@tanstack/react-query"
import {
  addDoc,
  collection,
  type Firestore,
  serverTimestamp,
} from "firebase/firestore"
import { useCallback } from "react"
import { useFirestore } from "../../../providers/firebase"
import { collections } from "../../../providers/firebase/store"
import type { Payment } from "../../../types/payment"
import { useAuthCurrentUser } from "../../../utils/auth/useAuthCurrentUser"

type PaymentValue = Omit<
  Payment,
  "id" | "userId" | "createdDate" | "updatedDate"
>

interface AddPaymentProps {
  db: Firestore
  userId: string
  value: PaymentValue
}

export async function addPayment({ db, userId, value }: AddPaymentProps) {
  return await addDoc(
    collection(db, collections.payments.path(userId)).withConverter(
      collections.payments.converter,
    ),
    {
      ...value,
      userId: userId,
      createdDate: serverTimestamp(),
      updatedDate: serverTimestamp(),
    },
  )
}

export function useCreatePayment(
  onSuccess?: () => void,
  onError?: (error?: Error) => void,
) {
  const { currentUser } = useAuthCurrentUser()
  const db = useFirestore()

  const { mutateAsync } = useMutation({
    mutationFn: async (value: PaymentValue & { userId: string }) => {
      return await addPayment({
        db: db,
        userId: value.userId,
        value: {
          categoryId: value.categoryId,
          date: value.date,
          note: value.note,
          amount: value.amount,
        },
      })
    },
    onSuccess: () => {
      onSuccess?.()
    },
    onError: (error) => {
      onError?.(error)
    },
  })

  const createPayment = useCallback(
    async (value: PaymentValue) => {
      if (!currentUser) return
      await mutateAsync({ ...value, userId: currentUser.uid })
    },
    [currentUser, mutateAsync],
  )

  return { createPayment }
}
