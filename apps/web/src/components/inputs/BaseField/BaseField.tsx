import { Flex, type FlexProps, Text } from "@radix-ui/themes"
import { Fragment, type ReactNode } from "react"

export type BaseFieldProps = {
  children?: ReactNode
} & FlexProps

export function BaseField({ children, ...props }: BaseFieldProps) {
  return (
    <Flex direction="column" gap="1" {...props}>
      {children}
    </Flex>
  )
}

export type FieldLabelProps = {
  children: ReactNode
  htmlFor?: string
  required?: boolean
}

export function FieldLabel({ children, htmlFor, required = false, ...props }: FieldLabelProps) {
  return (
    <Text as="label" htmlFor={htmlFor} size="2" weight="bold" {...props}>
      {children}
      {required && (
        <Text as="span" size="2" weight="bold" color="red" ml="1">
          *
        </Text>
      )}
    </Text>
  )
}

export interface FieldMessagesProps {
  error?: boolean
  messages?: string[]
}

export function FieldMessages({ error, messages }: FieldMessagesProps) {
  if (!messages || messages.length === 0) {
    return null
  }

  return (
    <Text as="span" size="1" color={error ? "red" : undefined}>
      {messages.map((message, index) => (
        <Fragment key={message}>
          {index > 0 && <br />}
          {message}
        </Fragment>
      ))}
    </Text>
  )
}
