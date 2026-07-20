import * as z from "zod"

import { getSupabaseClient } from "../../../lib/supabase"

const currentBookColumns = `
  book_id,
  is_default,
  books!book_members_book_id_fkey (
    id,
    name
  )
`

const currentBookMembershipSchema = z
  .object({
    book_id: z.number(),
    is_default: z.literal(true),
    books: z.object({
      id: z.number(),
      name: z.string(),
    }),
  })
  .refine((membership) => membership.book_id === membership.books.id)

export interface CurrentBook {
  id: number
  name: string
}

export async function fetchCurrentBook(): Promise<CurrentBook> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from("book_members")
    .select(currentBookColumns)
    .eq("is_default", true)
    .single()

  if (error) {
    throw error
  }

  const result = currentBookMembershipSchema.safeParse(data)
  if (!result.success) {
    throw new Error("Invalid current book response")
  }

  return result.data.books
}
