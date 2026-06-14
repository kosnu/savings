import { Badge, Box, Flex, Separator, Skeleton, Text } from "@radix-ui/themes"
import { Fragment, Suspense, use } from "react"
import { ErrorBoundary } from "react-error-boundary"

import { toCurrency } from "../../../../utils/toCurrency"
import { CreateCategoryModal } from "../../createCategory/CreateCategoryModal"
import { DeleteCategoryModal } from "../../deleteCategory/DeleteCategoryModal"
import type { CategorySettingsItem } from "../../listCategorySettings/types"
import { useCategorySettingsItems } from "../../listCategorySettings/useCategorySettingsItems"
import { UpdateCategoryNameModal } from "../../updateCategoryName/UpdateCategoryNameModal"

import styles from "./CategorySettingsList.module.css"

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
        <div className={styles.grid}>
          <CategorySettingsHeader />
          {items.map((item) => (
            <Fragment key={item.category.id}>
              <Separator className={styles.separator} orientation="horizontal" size="4" />
              <CategorySettingsRow item={item} currentPinnedCount={currentPinnedCount} />
            </Fragment>
          ))}
        </div>
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
    <div className={styles.header}>
      <Text color="gray">Name</Text>
      <Text color="gray">Budget</Text>
      <Box aria-hidden />
    </div>
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
      <div className={styles.grid}>
        <CategorySettingsHeader />
        <div className={styles.row} aria-hidden>
          <Skeleton loading>
            <Text>Category name</Text>
          </Skeleton>
          <Skeleton loading>
            <Text>￥0</Text>
          </Skeleton>
          <Skeleton loading>
            <Text>Edit</Text>
          </Skeleton>
        </div>
      </div>
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
    <div className={styles.row} aria-label={`${item.category.name} category settings`}>
      <CategoryNameWithMobileActionCell item={item} currentPinnedCount={currentPinnedCount} />
      <CategoryBudgetCell item={item} />
      <CategoryActionsCell
        item={item}
        currentPinnedCount={currentPinnedCount}
        placement="desktop"
      />
    </div>
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
    <Flex align="center" gap="3" justify="between">
      <Flex direction="column" gap="1" minWidth="0">
        <CategoryNameCell item={item} />
        <Box display={{ initial: "block", sm: "none" }}>
          <CategoryBudgetText item={item} />
        </Box>
      </Flex>
      <CategoryActionsCell item={item} currentPinnedCount={currentPinnedCount} placement="mobile" />
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

function CategoryBudgetCell({ item }: { item: CategorySettingsItem }) {
  return (
    <Box display={{ initial: "none", sm: "block" }}>
      <CategoryBudgetText item={item} />
    </Box>
  )
}

function CategoryBudgetText({ item }: { item: CategorySettingsItem }) {
  return (
    <Text color={item.budgetStatus === "amount" ? undefined : "gray"}>{formatBudget(item)}</Text>
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
        category={{
          ...item.category,
          pinned: item.pinned,
          budgetStatus: item.budgetStatus,
          budgetAmount: item.budgetAmount,
        }}
        currentPinnedCount={currentPinnedCount}
      />
      <DeleteCategoryModal category={item.category} />
    </Flex>
  )
}

function countPinnedItems(items: CategorySettingsItem[]): number {
  return items.filter((item) => item.pinned).length
}

function formatBudget(item: CategorySettingsItem): string {
  if (item.budgetStatus === "none") {
    return "No budget"
  }

  if (item.budgetStatus === "unset" || item.budgetAmount === null) {
    return "Not set"
  }

  return toCurrency(item.budgetAmount)
}

function PinBadge() {
  return (
    <Badge color="blue" variant="soft">
      Pin
    </Badge>
  )
}
