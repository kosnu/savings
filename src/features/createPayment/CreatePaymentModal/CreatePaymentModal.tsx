import { Button, Dialog, Flex } from "@radix-ui/themes"
import { useCallback } from "react"
import { DatePicker } from "../../../components/inputs/DatePicker"
import { Textfield } from "../../../components/inputs/Textfield"
import { useAuthCurrentUser } from "../../../utils/auth/useAuthCurrentUser"
import { useFirestore } from "../../../utils/firebase"
import { addPayment } from "../addPayment"

export function CreatePaymentModal() {
  const { currentUser } = useAuthCurrentUser()
  const db = useFirestore()

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (!currentUser) return

      const formData = new FormData(event.currentTarget)
      const formJson = Object.fromEntries(formData.entries())

      try {
        await addPayment({
          db: db,
          userId: currentUser.uid,
          value: {
            date: formJson.date.toString(),
            title: formJson.title.toString(),
            price: Number.parseInt(formJson.price.toString(), 10),
          },
        })
      } catch (e) {
        console.error("Error adding document: ", e)
      }
    },
    [db, currentUser],
  )

  return (
    <>
      <Dialog.Root>
        <Dialog.Trigger>
          <Button>Create payment</Button>
        </Dialog.Trigger>
        <Dialog.Content>
          <Dialog.Title>Create payment</Dialog.Title>
          <Dialog.Description size="2" mb="4">
            Create a new payment. Please fill in the details below.
          </Dialog.Description>
          <form onSubmit={handleSubmit}>
            <Flex direction="column" gap="3">
              <DatePicker label="Date" name="date" mode="single" required />
              <Textfield label="Title" name="title" type="text" required />
              <Textfield label="Price" name="price" type="number" required />
            </Flex>
            <Flex gap="3" mt="4" justify="end">
              <Dialog.Close>
                <Button variant="soft" color="gray">
                  Cancel
                </Button>
              </Dialog.Close>
              <Dialog.Close>
                <Button type="submit">Create payment</Button>
              </Dialog.Close>
            </Flex>
          </form>
        </Dialog.Content>
      </Dialog.Root>
    </>
  )
}
