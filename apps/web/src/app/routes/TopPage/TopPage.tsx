import { Button, Container, Flex, Text } from "@radix-ui/themes"
import { Link } from "react-router-dom"
import { Paper } from "../../../components/misc/Paper"
import { paths } from "../../../config/paths"

export function TopPage() {
  return (
    <>
      {/* TODO: ログインしていたらダッシュボードを表示する */}
      <Container size="2">
        <Paper>
          <Flex direction="column" gap="3">
            <Text asChild size="5" weight="bold">
              <h2>My Savings</h2>
            </Text>
            <Flex direction="column" gap="2">
              <Button asChild>
                <Link to={paths.auth.getHref()}>Go to Auth</Link>
              </Button>
            </Flex>
          </Flex>
        </Paper>
      </Container>
    </>
  )
}
