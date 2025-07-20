import type { Payment } from "../../types/payment"

export const longPayment: Payment = {
  id: "IadZXL3y4triLDhPP5hd",
  categoryId: "Pdgee5Sp6vhRanU3gEv0",
  userId: "",
  date: new Date(1999, 2, 1),
  note: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
  amount: 1234567890,
  createdDate: new Date(1999, 2, 1),
  updatedDate: new Date(1999, 2, 1),
}

export const payments: Payment[] = [
  {
    id: "1ksjdJK9CDYBHbWe2FmU",
    categoryId: "VgtuFszVjxOlwM040cyf",
    userId: "",
    date: new Date(2025, 5, 1),
    note: "コンビニ",
    amount: 1000,
    createdDate: new Date(2025, 5, 1),
    updatedDate: new Date(2025, 5, 1),
  },
  {
    id: "0GRbtELIWmRT1biPdusF",
    categoryId: "eq1duDRDUKJTFZac1Ztp",
    userId: "",
    date: new Date(2025, 5, 2),
    note: "コンビニ",
    amount: 4000,
    createdDate: new Date(2025, 5, 2),
    updatedDate: new Date(2025, 5, 2),
  },
  {
    id: "5PPuNUCWE2Sf7ZoOJ6VM",
    categoryId: "VgtuFszVjxOlwM040cyf",
    userId: "",
    date: new Date(2025, 3, 1),
    note: "スーパー",
    amount: 4000,
    createdDate: new Date(2025, 3, 1),
    updatedDate: new Date(2025, 3, 1),
  },
  {
    id: "IadZXL3y4triLDhPP5hd",
    categoryId: "Pdgee5Sp6vhRanU3gEv0",
    userId: "",
    date: new Date(2025, 2, 1),
    note: "コンビニ",
    amount: 1000,
    createdDate: new Date(2025, 2, 1),
    updatedDate: new Date(2025, 2, 1),
  },
]
