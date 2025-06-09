import { DotsVerticalIcon } from "@radix-ui/react-icons"
import { DropdownMenu, IconButton } from "@radix-ui/themes"

interface ActionMenuButtonProps {
  payment_id: string
}

export function ActionMenuButton({ payment_id }: ActionMenuButtonProps) {
  console.debug("Payment id:", payment_id)

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger>
          <IconButton>
            <DotsVerticalIcon />
          </IconButton>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content aria-label="Payment actions">
          {/* <DropdownMenu.Item>Edit</DropdownMenu.Item> */}
          <DropdownMenu.Item color="red">Delete</DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </>
  )
}
