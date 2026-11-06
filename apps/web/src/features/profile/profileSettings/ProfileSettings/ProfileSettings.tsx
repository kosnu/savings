import { Flex } from "@radix-ui/themes"

import { DeleteAccount } from "../../deleteAccount/DeleteAccount"
import { AccountInformation } from "../AccountInformation"

export function ProfileSettings() {
  return (
    <Flex direction="column" gap="6">
      <AccountInformation />
      <DeleteAccount />
    </Flex>
  )
}
