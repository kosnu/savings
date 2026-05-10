import { Badge, Box, Flex, Grid, Separator, Skeleton, Text } from "@radix-ui/themes"
import { Fragment, Suspense, use } from "react"
import { ErrorBoundary } from "react-error-boundary"

import { toCurrency } from "../../../../utils/toCurrency"
import type { CategorySettingsItem } from "../../listCategorySettings/types"
import { useCategorySettingsItems } from "../../listCategorySettings/useCategorySettingsItems"

export function CategorySettingsList() {
  const { promise } = useCategorySettingsItems()

  return (
    <Flex direction="column" gap="3">
      <Text as="p" size="4" weight="medium">
        Categories
      </Text>
      <ErrorBoundary
        fallback={
          <Text color="red" role="alert">
            Could not load categories.
          </Text>
        }
      >
        <Suspense fallback={<CategorySettingsLoadingRows />}>
          <CategorySettingsListContent promise={promise} />
        </Suspense>
      </ErrorBoundary>
    </Flex>
  )
}

interface CategorySettingsListContentProps {
  promise: Promise<CategorySettingsItem[]>
}

function CategorySettingsListContent({ promise }: CategorySettingsListContentProps) {
  const items = use(promise)

  if (items.length === 0) {
    return <Text color="gray">No categories.</Text>
  }

  return (
    <Flex direction="column" gap="2">
      <CategorySettingsHeader />
      {items.map((item) => (
        <Fragment key={item.category.id}>
          <Separator orientation="horizontal" size="4" />
          <CategorySettingsRow item={item} />
        </Fragment>
      ))}
    </Flex>
  )
}

function CategorySettingsHeader() {
  return (
    <Box display={{ initial: "none", sm: "block" }}>
      <Grid columns="1fr minmax(120px, auto) minmax(56px, auto)" gap="3">
        <Text color="gray">Name</Text>
        <Text color="gray">Monthly budget</Text>
        <Text color="gray">Pin</Text>
      </Grid>
    </Box>
  )
}

function CategorySettingsLoadingRows() {
  return (
    <Flex aria-label="loading category settings" direction="column" gap="2">
      <CategorySettingsHeader />
      <Grid columns={{ initial: "1fr", sm: "1fr minmax(120px, auto) minmax(56px, auto)" }} gap="2">
        <Skeleton loading>
          <Text>Category name</Text>
        </Skeleton>
        <Skeleton loading>
          <Text>Monthly budget ￥000,000</Text>
        </Skeleton>
        <Skeleton loading>
          <Text>Pin</Text>
        </Skeleton>
      </Grid>
    </Flex>
  )
}

function CategorySettingsRow({ item }: { item: CategorySettingsItem }) {
  const budgetText = item.latestCategoryBudget
    ? toCurrency(item.latestCategoryBudget.amount)
    : "Not set"

  return (
    <Grid
      align="center"
      aria-label={`${item.category.name} category settings`}
      columns={{ initial: "1fr", sm: "1fr minmax(120px, auto) minmax(56px, auto)" }}
      gap="2"
    >
      <Flex align="center" gap="2" justify="between">
        <Text>{item.category.name}</Text>
        <Box display={{ initial: "block", sm: "none" }}>{item.pinned && <PinBadge />}</Box>
      </Flex>
      <Flex align="center" gap="3" justify={{ initial: "between", sm: "start" }}>
        <Box display={{ initial: "block", sm: "none" }}>
          <Text color="gray" size="2">
            Monthly budget
          </Text>
        </Box>
        <Text color={item.latestCategoryBudget ? undefined : "gray"}>{budgetText}</Text>
      </Flex>
      <Box display={{ initial: "none", sm: "block" }}>{item.pinned && <PinBadge />}</Box>
    </Grid>
  )
}

function PinBadge() {
  return (
    <Badge color="blue" variant="soft">
      Pin
    </Badge>
  )
}
