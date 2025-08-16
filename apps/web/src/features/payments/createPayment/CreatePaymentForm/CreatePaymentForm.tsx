import { Button, Flex } from "@radix-ui/themes"
import { useCallback, useState } from "react"
import { CancelButton } from "../../../../components/buttons/CancelButton"
import { DatePicker } from "../../../../components/inputs/DatePicker"
import { Textfield } from "../../../../components/inputs/Textfield"
import { useFirestore } from "../../../../providers/firebase/useFirestore"
import { useAuthCurrentUser } from "../../../../utils/auth/useAuthCurrentUser"
import { findZodError } from "../../../../utils/findZodError"
import { addPayment } from "../addPayment"
import { CategorySelect } from "../CategorySelect"
import { type FormError, formShema } from "../formSchema"

interface CreatePaymentFormProps {
  onSuccess?: () => void
  onCancel: () => void
}

export function CreatePaymentForm({
  onSuccess,
  onCancel,
}: CreatePaymentFormProps) {
  const { currentUser } = useAuthCurrentUser()
  const db = useFirestore()

  const [error, setError] = useState<FormError>()

  // TODO: 何度も findZodError() をするのは効率が悪いので修正する
  const dateError = findZodError(error, "date")
  const categoryError = findZodError(error, "category")
  const noteError = findZodError(error, "note")
  const amountError = findZodError(error, "amount")

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (!currentUser) return

      const formData = new FormData(event.currentTarget)
      const formObject = Object.fromEntries(formData.entries())
      const result = formShema.safeParse(formObject)
      if (result.error) {
        setError(result.error)
        return
      }

      try {
        await addPayment({
          db: db,
          userId: currentUser.uid,
          value: {
            categoryId: result.data.category,
            date: result.data.date,
            note: result.data.note,
            amount: result.data.amount,
          },
        })
        onSuccess?.()
      } catch (e) {
        console.error("Error adding document: ", e)
      }
    },
    [db, currentUser, onSuccess],
  )

  const handleCancel = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault()
      onCancel()
    },
    [onCancel],
  )

  return (
    <form onSubmit={handleSubmit}>
      <Flex direction="column" gap="3">
        <DatePicker
          label="Date"
          name="date"
          mode="single"
          error={dateError}
          helperText={dateError?.message}
        />
        <CategorySelect
          error={categoryError}
          helperText={categoryError?.message}
        />
        <Textfield
          label="Note"
          name="note"
          type="text"
          error={noteError}
          helperText={noteError?.message}
        />
        <Textfield
          label="Amount"
          name="amount"
          type="text"
          inputMode="numeric"
          error={amountError}
          helperText={amountError?.message}
        />
      </Flex>
      <Flex gap="3" mt="4" justify="end">
        <CancelButton onClick={handleCancel} />
        <Button type="submit">Create payment</Button>
      </Flex>
    </form>
  )
}
