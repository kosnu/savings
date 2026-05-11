import { ExclamationTriangleIcon } from "@radix-ui/react-icons"
import { Button, Container, Flex, Heading, Text } from "@radix-ui/themes"
import { Link, type ErrorComponentProps } from "@tanstack/react-router"
import { useEffect, useId } from "react"

import { Paper } from "../../../components/misc/Paper"

export function ErrorPage({ error }: ErrorComponentProps) {
  const id = useId()

  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <Container id={`error-page-${id}`} size="2">
      <Paper>
        <Flex align="start" direction="column" gap="4">
          <Flex align="center" gap="2">
            <ExclamationTriangleIcon aria-hidden width="22" height="22" />
            <Heading as="h1" size="5">
              Something went wrong
            </Heading>
          </Flex>
          <Text as="p" color="gray" size="3">
            The page could not be displayed. Try reloading the page, or go back home.
          </Text>
          <Flex gap="3" wrap="wrap">
            <Button type="button" onClick={() => window.location.reload()}>
              Reload page
            </Button>
            <Button asChild variant="soft">
              <Link to="/">Go home</Link>
            </Button>
          </Flex>
        </Flex>
      </Paper>
    </Container>
  )
}
