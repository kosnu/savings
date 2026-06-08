import { Badge, Box, Flex, Grid, Separator, Skeleton, Text } from "@radix-ui/themes"
import { Fragment, Suspense, use } from "react"
import { ErrorBoundary } from "react-error-boundary"

import { toCurrency } from "../../../../utils/toCurrency"
import { CreateCategoryModal } from "../../createCategory/CreateCategoryModal"
import { DeleteCategoryModal } from "../../deleteCategory/DeleteCategoryModal"
import type { CategorySettingsItem } from "../../listCategorySettings/types"
import { useCategorySettingsItems } from "../../listCategorySettings/useCategorySettingsItems"
import { UpdateCategoryNameModal } from "../../updateCategoryName/UpdateCategoryNameModal"

export function CategorySettingsList() {
  const { promise } = useCategorySettingsItems()

  return (
    <Flex direction="column" gap="3">
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
  const currentPinnedCount = countPinnedItems(items)

  return (
    <Flex direction="column" gap="2">
      <CategorySettingsTitle currentPinnedCount={currentPinnedCount} />
      {items.length === 0 ? (
        <Text color="gray">No categories.</Text>
      ) : (
        <>
          <CategorySettingsHeader />
          {items.map((item) => (
            <Fragment key={item.category.id}>
              <Separator orientation="horizontal" size="4" />
              <CategorySettingsRow item={item} currentPinnedCount={currentPinnedCount} />
            </Fragment>
          ))}
        </>
      )}
    </Flex>
  )
}

function CategorySettingsTitle({ currentPinnedCount }: { currentPinnedCount: number }) {
  return (
    <Flex align="center" gap="3" justify="between">
      <Text as="p" size="4" weight="medium">
        Categories
      </Text>
      <CreateCategoryModal currentPinnedCount={currentPinnedCount} />
    </Flex>
  )
}

function CategorySettingsHeader() {
  return (
    <Box display={{ initial: "none", sm: "block" }}>
      <Grid columns="1fr minmax(64px, auto)" gap="3">
        <Text color="gray">Name</Text>
        <Box aria-hidden />
      </Grid>
    </Box>
  )
}

function CategorySettingsLoadingRows() {
  return (
    <Flex aria-label="loading category settings" direction="column" gap="2">
      <Flex align="center" gap="3" justify="between">
        <Skeleton loading>
          <Text as="p" size="4" weight="medium">
            Categories
          </Text>
        </Skeleton>
        <Skeleton loading>
          <Text>Create category</Text>
        </Skeleton>
      </Flex>
      <CategorySettingsHeader />
      <Grid
        columns={{
          initial: "1fr",
          sm: "1fr minmax(64px, auto)",
        }}
        gap="2"
      >
        <Skeleton loading>
          <Text>Category name</Text>
        </Skeleton>
        <Skeleton loading>
          <Text>Edit</Text>
        </Skeleton>
      </Grid>
    </Flex>
  )
}

function CategorySettingsRow({
  item,
  currentPinnedCount,
}: {
  item: CategorySettingsItem
  currentPinnedCount: number
}) {
  return (
    <Grid
      align="center"
      aria-label={`${item.category.name} category settings`}
      columns={{
        initial: "1fr",
        sm: "1fr minmax(64px, auto)",
      }}
      gap="2"
    >
      <CategoryNameWithMobileActionCell item={item} currentPinnedCount={currentPinnedCount} />
      <CategoryActionsCell
        item={item}
        currentPinnedCount={currentPinnedCount}
        placement="desktop"
      />
    </Grid>
  )
}

function CategoryNameWithMobileActionCell({
  item,
  currentPinnedCount,
}: {
  item: CategorySettingsItem
  currentPinnedCount: number
}) {
  return (
    <Flex align="center" gap="3" justify="between" minWidth="0">
      <CategoryNameCell item={item} />
      <CategoryActionsCell item={item} currentPinnedCount={currentPinnedCount} placement="mobile" />
    </Flex>
  )
}

function CategoryNameCell({ item }: { item: CategorySettingsItem }) {
  const budgetAmount =
    item.category.budget.state === "amount" && item.category.budget.amount !== null
      ? toCurrency(item.category.budget.amount)
      : null

  return (
    <Flex direction="column" gap="1" minWidth="0">
      <Flex align="center" gap="2" minWidth="0">
        <Text>{item.category.name}</Text>
        {item.pinned && <PinBadge />}
      </Flex>
      {budgetAmount !== null && (
        <Text color="gray" size="2">
          Budget {budgetAmount}
        </Text>
      )}
    </Flex>
  )
}

function CategoryActionsCell({
  item,
  currentPinnedCount,
  placement,
}: {
  item: CategorySettingsItem
  currentPinnedCount: number
  placement: "mobile" | "desktop"
}) {
  const display =
    placement === "mobile"
      ? { initial: "flex" as const, sm: "none" as const }
      : { initial: "none" as const, sm: "flex" as const }

  return (
    <Flex align="center" display={display} flexShrink="0" gap="2">
      <UpdateCategoryNameModal
        category={{ ...item.category, pinned: item.pinned }}
        currentPinnedCount={currentPinnedCount}
      />
      <DeleteCategoryModal category={item.category} />
    </Flex>
  )
}

function countPinnedItems(items: CategorySettingsItem[]): number {
  return items.filter((item) => item.pinned).length
}

function PinBadge() {
  return (
    <Badge color="blue" variant="soft">
      Pin
    </Badge>
  )
}
