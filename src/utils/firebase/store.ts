import {
  type DocumentData,
  type FirestoreDataConverter,
  Timestamp,
} from "firebase/firestore"
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
  title: string
  price: number
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
        title: data.title,
        price: data.price,
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
        title: data.title,
        price: data.price,
        date: (data.date as Timestamp).toDate(),
        userId: data.user_id,
        createdDate: data.created_date,
        updatedDate: data.updated_date,
      }
    },
  },
}

export const collections = {
  users: usersCollection,
  payments: paymentsCollection,
} as const
