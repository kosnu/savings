import { Badge, Box, Flex, Grid, Separator, Skeleton, Text } from "@radix-ui/themes"
import { Fragment, Suspense, use } from "react"
import { ErrorBoundary } from "react-error-boundary"

import { toCurrency } from "../../../../utils/toCurrency"
import type { CategorySettingsItem } from "../../listCategorySettings/types"
import { useCategorySettingsItems } from "../../listCategorySettings/useCategorySettingsItems"
import { UpdateCategoryNameModal } from "../../updateCategoryName/UpdateCategoryNameModal"

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
      <Grid columns="1fr minmax(120px, auto) minmax(64px, auto)" gap="3">
        <Text color="gray">Name</Text>
        <Text color="gray">Monthly budget</Text>
        <Box aria-hidden />
      </Grid>
    </Box>
  )
}

function CategorySettingsLoadingRows() {
  return (
    <Flex aria-label="loading category settings" direction="column" gap="2">
      <CategorySettingsHeader />
      <Grid
        columns={{
          initial: "1fr",
          sm: "1fr minmax(120px, auto) minmax(64px, auto)",
        }}
        gap="2"
      >
        <Skeleton loading>
          <Text>Category name</Text>
        </Skeleton>
        <Skeleton loading>
          <Text>Monthly budget ￥000,000</Text>
        </Skeleton>
        <Skeleton loading>
          <Text>Edit</Text>
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
      columns={{
        initial: "1fr",
        sm: "1fr minmax(120px, auto) minmax(64px, auto)",
      }}
      gap="2"
    >
      <CategoryNameWithMobileActionCell item={item} />
      <CategoryBudgetCell item={item} budgetText={budgetText} />
      <CategoryActionsCell category={item.category} placement="desktop" />
    </Grid>
  )
}

function CategoryNameWithMobileActionCell({ item }: { item: CategorySettingsItem }) {
  return (
    <Flex align="center" gap="3" justify="between">
      <CategoryNameCell item={item} />
      <CategoryActionsCell category={item.category} placement="mobile" />
    </Flex>
  )
}

function CategoryNameCell({ item }: { item: CategorySettingsItem }) {
  return (
    <Flex align="center" gap="2" minWidth="0">
      <Text>{item.category.name}</Text>
      {item.pinned && <PinBadge />}
    </Flex>
  )
}

function CategoryBudgetCell({
  item,
  budgetText,
}: {
  item: CategorySettingsItem
  budgetText: string
}) {
  return (
    <Flex align="center" gap="3" justify={{ initial: "between", sm: "start" }}>
      <Box display={{ initial: "block", sm: "none" }}>
        <Text color="gray" size="2">
          Monthly budget
        </Text>
      </Box>
      <Text color={item.latestCategoryBudget ? undefined : "gray"}>{budgetText}</Text>
    </Flex>
  )
}

function CategoryActionsCell({
  category,
  placement,
}: {
  category: CategorySettingsItem["category"]
  placement: "mobile" | "desktop"
}) {
  const display =
    placement === "mobile"
      ? { initial: "flex" as const, sm: "none" as const }
      : { initial: "none" as const, sm: "flex" as const }

  return (
    <Flex align="center" display={display} flexShrink="0">
      <UpdateCategoryNameModal category={category} />
    </Flex>
  )
}

function PinBadge() {
  return (
    <Badge color="blue" variant="soft">
      Pin
    </Badge>
  )
}
