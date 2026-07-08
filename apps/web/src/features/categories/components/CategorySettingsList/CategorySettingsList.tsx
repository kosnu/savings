import { Badge, Box, Flex, Separator, Skeleton, Text } from "@radix-ui/themes"
import { Fragment, Suspense, use } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { useTranslation } from "react-i18next"

import { i18next } from "../../../../i18n"
import { toCurrency } from "../../../../utils/toCurrency"
import { CreateCategoryModal } from "../../createCategory/CreateCategoryModal"
import { DeleteCategoryModal } from "../../deleteCategory/DeleteCategoryModal"
import type { CategorySettingsItem } from "../../listCategorySettings/types"
import { useCategorySettingsItems } from "../../listCategorySettings/useCategorySettingsItems"
import { UpdateCategoryNameModal } from "../../updateCategoryName/UpdateCategoryNameModal"

import styles from "./CategorySettingsList.module.css"

export function CategorySettingsList() {
  const { promise } = useCategorySettingsItems()
  const { t } = useTranslation()

  return (
    <Flex direction="column" gap="3">
      <ErrorBoundary
        fallback={
          <Text color="red" role="alert">
            {t("categories.loadError")}
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
  const { t } = useTranslation()

  return (
    <Flex direction="column" gap="2">
      <CategorySettingsTitle currentPinnedCount={currentPinnedCount} />
      {items.length === 0 ? (
        <Text color="gray">{t("categories.empty")}</Text>
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
  const { t } = useTranslation()

  return (
    <Flex align="center" gap="3" justify="between">
      <Text as="p" size="4" weight="medium">
        {t("categories.title")}
      </Text>
      <CreateCategoryModal currentPinnedCount={currentPinnedCount} />
    </Flex>
  )
}

function CategorySettingsHeader() {
  const { t } = useTranslation()

  return (
    <div className={styles.header}>
      <Text color="gray">{t("categories.name")}</Text>
      <Text color="gray">{t("categories.budget")}</Text>
      <Box aria-hidden />
    </div>
  )
}

function CategorySettingsLoadingRows() {
  const { t } = useTranslation()

  return (
    <Flex aria-label={t("categories.loadingSettings")} direction="column" gap="2">
      <Flex align="center" gap="3" justify="between">
        <Skeleton loading>
          <Text as="p" size="4" weight="medium">
            {t("categories.title")}
          </Text>
        </Skeleton>
        <Skeleton loading>
          <Text>{t("categories.create")}</Text>
        </Skeleton>
      </Flex>
      <div className={styles.grid}>
        <CategorySettingsHeader />
        <div className={styles.row} aria-hidden>
          <Skeleton loading>
            <Text>{t("categories.namePlaceholder")}</Text>
          </Skeleton>
          <Skeleton loading>
            <Text>¥0</Text>
          </Skeleton>
          <Skeleton loading>
            <Text>{t("common.edit")}</Text>
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
  const { t } = useTranslation()

  return (
    <div
      className={styles.row}
      aria-label={t("categories.rowSettings", { name: item.category.name })}
    >
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
    return i18next.t("common.noBudget")
  }

  if (item.budgetStatus === "unset" || item.budgetAmount === null) {
    return i18next.t("common.notSet")
  }

  return toCurrency(item.budgetAmount)
}

function PinBadge() {
  const { t } = useTranslation()

  return (
    <Badge color="blue" variant="soft">
      {t("categories.pin")}
    </Badge>
  )
}
