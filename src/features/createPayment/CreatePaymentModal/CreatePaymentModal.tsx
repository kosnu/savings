import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from "@mui/material"
import { useCallback } from "react"
import { useAuthCurrentUser } from "../../../utils/auth/useAuthCurrentUser"
import { useFirestore } from "../../../utils/firebase"
import { formatDateToIsoString } from "../../../utils/formatter/formatDateToIsoString"
import { CreatePaymentForm } from "../CreatePaymentForm/CreatePaymentForm"
import { addPayment } from "../addPayment"

interface CreatePaymentModalProps {
  open: boolean
  onClose: () => void
}

export function CreatePaymentModal({ open, onClose }: CreatePaymentModalProps) {
  const { currentUser } = useAuthCurrentUser()
  const db = useFirestore()

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (!currentUser) return

      const formData = new FormData(event.currentTarget)
      const formJson = Object.fromEntries(formData.entries())
      console.debug("formJson)", formJson)

      try {
        await addPayment({
          db: db,
          userId: currentUser.uid,
          value: {
            date: formatDateToIsoString(formJson.date as string),
            title: formJson.title.toString(),
            price: Number.parseInt(formJson.price.toString(), 10),
          },
        })
      } catch (e) {
        console.error("Error adding document: ", e)
      }

      onClose()
    },
    [db, onClose, currentUser],
  )

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        PaperProps={{
          component: "form",
          onSubmit: handleSubmit,
        }}
      >
        <DialogTitle>Create payment</DialogTitle>
        <DialogContent>
          <CreatePaymentForm />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit">Create payment</Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
