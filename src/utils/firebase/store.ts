import type {
  DocumentData,
  FirestoreDataConverter,
  QueryDocumentSnapshot,
} from "firebase/firestore"
import type { Payment } from "../../types/payment"
import type { User } from "../../types/user"
import { formatDateToIsoString } from "../formatter/formatDateToIsoString"

interface Collection<
  AppData extends object,
  FirestoreData extends DocumentData,
  PathParam = unknown,
> {
  path: (params: PathParam) => string
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
  id: string
  title: string
  price: number
  date: string
  user_id: string
  created_date: Date
  updated_date: Date
}

const paymentsCollection: Collection<Payment, PaymentDocument, string> = {
  path: (userId: string) => `users/${userId}/payments`,
  converter: {
    toFirestore: (data: Payment) => {
      return {
        id: data.id ?? "",
        title: data.title,
        price: data.price,
        date: formatDateToIsoString(data.date),
        user_id: data.userId,
        created_date: data.createdDate,
        updated_date: data.updatedDate,
      }
    },
    fromFirestore: (snapshot: QueryDocumentSnapshot): Payment => {
      const data = snapshot.data()
      return {
        id: snapshot.id,
        title: data.title,
        price: data.price,
        date: new Date(data.date),
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
