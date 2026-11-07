import { Flex } from "@radix-ui/themes"

import { DeleteAccount } from "../../deleteAccount/DeleteAccount"
import { AccountInformation } from "../AccountInformation"

export function AccountSettings() {
  return (
    <Flex direction="column" gap="4">
      <AccountInformation section="account" />
      <DeleteAccount headingLevel="h3" />
    </Flex>
  )
}
