import { TextField } from "@mui/material"
import { DatePicker } from "@mui/x-date-pickers"

export function CreatePaymentForm() {
  return (
    <>
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
    </>
  )
}
