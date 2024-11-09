import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from "@mui/material"
import { DatePicker } from "@mui/x-date-pickers"
import { useCallback } from "react"
import { useAuthCurrentUser } from "../../../utils/auth/useAuthCurrentUser"
import { useFirestore } from "../../../utils/firebase"
import { formatDateToIsoString } from "../../../utils/formatter/formatDateToIsoString"
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
          <DatePicker
            label="Date"
            format="yyyy/MM/dd"
            name="date"
            slotProps={{
              textField: {
                variant: "standard",
              },
              field: { readOnly: true },
            }}
          />
          <TextField
            autoFocus
            required
            id="name"
            name="title"
            label="Title"
            fullWidth
            variant="standard"
          />
          <TextField
            autoFocus
            required
            id="name"
            name="price"
            label="Price"
            type="number"
            fullWidth
            variant="standard"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit">Create payment</Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
