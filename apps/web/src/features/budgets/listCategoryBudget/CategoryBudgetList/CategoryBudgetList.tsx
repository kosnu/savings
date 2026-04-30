import { DotsVerticalIcon, PlusIcon } from "@radix-ui/react-icons"
import { Button, Flex, IconButton, Skeleton, Text } from "@radix-ui/themes"
import { Suspense, use } from "react"
import { ErrorBoundary } from "react-error-boundary"

import { toCurrency } from "../../../../utils/toCurrency"
import { CreateCategoryBudgetModal } from "../../createCategoryBudget/CreateCategoryBudgetModal"
import type { CategoryBudget } from "../../types"
import { useCategoryBudgets } from "../useCategoryBudgets"

export function CategoryBudgetList() {
  const { promise } = useCategoryBudgets()

  return (
    <Flex direction="column" gap="3">
      <Flex align="center" justify="between" gap="3">
        <Text as="p" size="4" weight="medium">
          Category Budgets
        </Text>
        <CreateCategoryBudgetModal
          trigger={
            <Button aria-label="Add category budget" size="2" variant="ghost">
              <PlusIcon />
            </Button>
          }
        />
      </Flex>
      <ErrorBoundary
        fallback={
          <Text color="red" role="alert">
            Could not load category budgets.
          </Text>
        }
      >
        <Suspense fallback={<CategoryBudgetListLoading />}>
          <CategoryBudgetListContent promise={promise} />
        </Suspense>
      </ErrorBoundary>
    </Flex>
  )
}

function CategoryBudgetListContent({ promise }: { promise: Promise<CategoryBudget[]> }) {
  const categoryBudgets = use(promise)

  if (categoryBudgets.length === 0) {
    return (
      <CreateCategoryBudgetModal
        trigger={
          <Button variant="soft">
            <PlusIcon /> Create category budget
          </Button>
        }
      />
    )
  }

  return (
    <Flex direction="column" gap="2">
      {categoryBudgets.map((categoryBudget) => (
        <CategoryBudgetRow key={categoryBudget.id} categoryBudget={categoryBudget} />
      ))}
    </Flex>
  )
}

function CategoryBudgetListLoading() {
  return (
    <Flex aria-label="loading category budgets" direction="column" gap="2">
      <CategoryBudgetLoadingRow />
      <CategoryBudgetLoadingRow />
    </Flex>
  )
}

function CategoryBudgetLoadingRow() {
  return (
    <Flex align="center" justify="between" gap="3">
      <Skeleton loading>
        <Text>Category name</Text>
      </Skeleton>
      <Skeleton loading>
        <Text>￥000,000</Text>
      </Skeleton>
    </Flex>
  )
}

function CategoryBudgetRow({ categoryBudget }: { categoryBudget: CategoryBudget }) {
  return (
    <Flex align="center" justify="between" gap="3">
      <Text>
        {categoryBudget.categoryName} {toCurrency(categoryBudget.amount)}
      </Text>
      <IconButton
        aria-label={`${categoryBudget.categoryName} category budget menu`}
        disabled
        size="2"
        variant="ghost"
      >
        <DotsVerticalIcon />
      </IconButton>
    </Flex>
  )
}
