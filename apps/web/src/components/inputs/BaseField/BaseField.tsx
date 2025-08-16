import { Flex, type FlexProps, Text } from "@radix-ui/themes"
import type { ReactNode } from "react"

export type BaseFieldProps = {
  children?: ReactNode
  required?: boolean
  label: ReactNode
  htmlFor?: string
  error?: boolean
  message?: ReactNode
} & FlexProps

export function BaseField({
  children,
  required = false,
  label,
  htmlFor,
  error,
  message,
  ...props
}: BaseFieldProps) {
  return (
    <Flex direction="column" gap="1" {...props}>
      <Label htmlFor={htmlFor} required={required}>
        {label}
      </Label>
      {children}
      {message && <FieldMessage error={error}>{message}</FieldMessage>}
    </Flex>
  )
}

type LabelProps = {
  children: ReactNode
  htmlFor?: string
  required?: boolean
}

function Label({ children, htmlFor, required = false, ...props }: LabelProps) {
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

interface FieldMessageProps {
  children: ReactNode
  error?: boolean
}

function FieldMessage({ children, error, ...props }: FieldMessageProps) {
  return (
    <Text as="span" size="1" color={error ? "red" : undefined} {...props}>
      {children}
    </Text>
  )
}
