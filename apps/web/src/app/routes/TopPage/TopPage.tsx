import { Button, Container, Flex, Text } from "@radix-ui/themes"
import { Link } from "@tanstack/react-router"

import { Paper } from "../../../components/misc/Paper"

export function TopPage() {
  return (
    <>
      <Container size="2">
        <Paper>
          <Flex direction="column" gap="3">
            <Text asChild size="5" weight="bold">
              <h2>My Savings</h2>
            </Text>
            <Flex direction="column" gap="2">
              <Button asChild>
                <Link to="/auth">Go to Auth</Link>
              </Button>
            </Flex>
          </Flex>
        </Paper>
      </Container>
    </>
  )
}
