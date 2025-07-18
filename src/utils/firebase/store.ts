import {
  type DocumentData,
  type FirestoreDataConverter,
  Timestamp,
} from "firebase/firestore"
import type { Category } from "../../types/category"
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
  category_id: string
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
        category_id: data.categoryId ?? "",
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
        categoryId: data.category_id,
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

export interface CategoryDocument extends DocumentData {
  name: string
  user_id: string
  created_at: Timestamp // TODO: created_date に変更する
  updated_at: Timestamp // TODO: updated_date に変更する
}

const categoriesCollection: Collection<Category, CategoryDocument, string> = {
  path: (userId: string) => `users/${userId}/categories`,
  converter: {
    toFirestore: (data: Category): CategoryDocument => {
      return {
        name: data.name,
        user_id: data.userId,
        created_at: Timestamp.fromDate(data.createdDate),
        updated_at: Timestamp.fromDate(data.updatedDate),
      }
    },
    fromFirestore: (snapshot): Category => {
      const data = snapshot.data()

      return {
        id: snapshot.id,
        name: data.name,
        userId: data.user_id,
        createdDate: (data.created_at as Timestamp).toDate(),
        updatedDate: (data.updated_at as Timestamp).toDate(),
      }
    },
  },
}

export const collections = {
  users: usersCollection,
  payments: paymentsCollection,
  incomes: incomesCollection,
  categories: categoriesCollection,
} as const
