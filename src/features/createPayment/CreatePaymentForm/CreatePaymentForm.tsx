import { Button, Flex } from "@radix-ui/themes"
import { useCallback } from "react"
import { CancelButton } from "../../../components/buttons/CancelButton"
import { DatePicker } from "../../../components/inputs/DatePicker"
import { Textfield } from "../../../components/inputs/Textfield"
import { useAuthCurrentUser } from "../../../utils/auth/useAuthCurrentUser"
import { useFirestore } from "../../../utils/firebase/useFirestore"
import { addPayment } from "../addPayment"

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

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (!currentUser) return

      const formData = new FormData(event.currentTarget)
      const formJson = Object.fromEntries(formData.entries())

      // TODO: zodでオブジェクトを検証する

      try {
        await addPayment({
          db: db,
          userId: currentUser.uid,
          value: {
            date: formJson.date.toString(),
            note: formJson.note.toString(),
            amount: Number.parseInt(formJson.amount.toString(), 10),
          },
        })
        onSuccess?.()
      } catch (e) {
        console.error("Error adding document: ", e)
      }
    },
    [db, currentUser, onSuccess],
  )

  const handleCancel = useCallback(() => {
    onCancel()
  }, [onCancel])

  return (
    <form onSubmit={handleSubmit}>
      <Flex direction="column" gap="3">
        <DatePicker label="Date" name="date" mode="single" required />
        <Textfield label="Note" name="note" type="text" required />
        <Textfield label="Amount" name="amount" type="number" required />
      </Flex>
      <Flex gap="3" mt="4" justify="end">
        <CancelButton onClick={handleCancel} />
        <Button type="submit">Create payment</Button>
      </Flex>
    </form>
  )
}
