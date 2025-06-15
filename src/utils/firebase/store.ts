import {
  type DocumentData,
  type FirestoreDataConverter,
  Timestamp,
} from "firebase/firestore"
import type { Income } from "../../types/income"
import type { Payment } from "../../types/payment"
import type { User } from "../../types/user"

interface Collection<
  AppData extends object,
  FirestoreData extends DocumentData,
  PathParam = undefined,
> {
  path: PathParam extends undefined
    ? () => string
    : (params: PathParam) => string
  converter: FirestoreDataConverter<AppData, FirestoreData>
}

export interface UserDocument extends DocumentData {
  id: string
  name: string
  email: string
}

const usersCollection: Collection<User, UserDocument> = {
  path: () => "users",
  converter: {
    toFirestore: (data: User) => {
      return {
        id: data.id,
        name: data.name,
        email: data.email,
      }
    },
    fromFirestore: (snapshot): User => {
      const data = snapshot.data()
      return {
        id: snapshot.id,
        name: data.name,
        email: data.email,
      }
    },
  },
}

export interface PaymentDocument extends DocumentData {
  note: string
  amount: number
  date: Timestamp
  user_id: string
  created_date: Date
  updated_date: Date
}

const paymentsCollection: Collection<Payment, PaymentDocument, string> = {
  path: (userId: string) => `users/${userId}/payments`,
  converter: {
    toFirestore: (data: Payment): PaymentDocument => {
      return {
        note: data.note,
        amount: data.amount,
        date: Timestamp.fromDate(data.date),
        user_id: data.userId,
        created_date: data.createdDate,
        updated_date: data.updatedDate,
      }
    },
    fromFirestore: (snapshot): Payment => {
      const data = snapshot.data()

      return {
        id: snapshot.id,
        note: data.note,
        amount: data.amount,
        date: (data.date as Timestamp).toDate(),
        userId: data.user_id,
        createdDate: data.created_date,
        updatedDate: data.updated_date,
      }
    },
  },
}

export interface IncomeDocument extends DocumentData {
  date: Timestamp
  note: string
  amount: number
  user_id: string
  created_date: Timestamp
  updated_date: Timestamp
}

const incomesCollection: Collection<Income, IncomeDocument, string> = {
  path: (userId: string) => `users/${userId}/incomes`,
  converter: {
    toFirestore: (data: Income): IncomeDocument => {
      return {
        date: Timestamp.fromDate(data.date),
        note: data.note,
        amount: data.amount,
        user_id: data.userId,
        created_date: Timestamp.fromDate(data.createdDate),
        updated_date: Timestamp.fromDate(data.updatedDate),
      }
    },
    fromFirestore: (snapshot): Income => {
      const data = snapshot.data()

      return {
        id: snapshot.id,
        date: (data.date as Timestamp).toDate(),
        note: data.note,
        amount: data.amount,
        userId: data.user_id,
        createdDate: (data.created_date as Timestamp).toDate(),
        updatedDate: (data.updated_date as Timestamp).toDate(),
      }
    },
  },
}

export const collections = {
  users: usersCollection,
  payments: paymentsCollection,
  incomes: incomesCollection,
} as const
