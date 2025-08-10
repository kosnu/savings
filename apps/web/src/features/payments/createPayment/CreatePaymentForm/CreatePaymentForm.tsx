import { Button, Flex } from "@radix-ui/themes"
import { useCallback } from "react"
import { CancelButton } from "../../../../components/buttons/CancelButton"
import { DatePicker } from "../../../../components/inputs/DatePicker"
import { Textfield } from "../../../../components/inputs/Textfield"
import { useAuthCurrentUser } from "../../../../utils/auth/useAuthCurrentUser"
import { useFirestore } from "../../../../utils/firebase/useFirestore"
import { addPayment } from "../addPayment"
import { CategorySelect } from "../CategorySelect"
import { formShema } from "../formSchema"

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
      const formObject = Object.fromEntries(formData.entries())
      // TODO: parse に失敗したときにエラーメッセージをStateに格納して各フォームで表示させる
      const parsedFormObject = formShema.parse(formObject)

      try {
        await addPayment({
          db: db,
          userId: currentUser.uid,
          value: {
            categoryId: parsedFormObject.category,
            date: parsedFormObject.date,
            note: parsedFormObject.note,
            amount: parsedFormObject.amount,
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
        <CategorySelect />
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
