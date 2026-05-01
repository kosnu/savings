import { Text } from "@radix-ui/themes"
import {
  type KeyboardEvent,
  type ReactNode,
  Suspense,
  use,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react"
import { ErrorBoundary } from "react-error-boundary"

import { useSnackbar } from "../../../../providers/snackbar"
import type { Category } from "../../../../types/category"
import type { PaymentId } from "../../../../types/payment"
import {
  CategoryOption,
  CategorySelect,
  ErrorCategoryOption,
  LoadingCategoryOption,
} from "../../../categories/components/CategorySelect"
import { useCategories } from "../../../categories/listCategory/useCategories"
import { useUpdatePayment } from "../../updatePayment/useUpdatePayment"
import { EditableField } from "../EditableField"

interface CategoryFieldProps {
  paymentId: PaymentId
  categoryId: number | null
  categoryName: string
  disabled?: boolean
  onEditStart: () => void
  onEditEnd: () => void
}

export function CategoryField({
  paymentId,
  categoryId,
  categoryName,
  disabled = false,
  onEditStart,
  onEditEnd,
}: CategoryFieldProps) {
  const id = useId()
  const { openSnackbar } = useSnackbar()
  const { updatePayment, isPending } = useUpdatePayment()
  const { promise: categoriesPromise } = useCategories()
  const currentCategoryValue = toCategoryValue(categoryId)
  const [editing, setEditing] = useState(false)
  const editingRef = useRef(false)
  const [draftCategoryId, setDraftCategoryId] = useState(currentCategoryValue)
  const [messages, setMessages] = useState<string[] | undefined>()

  useEffect(() => {
    return () => {
      if (editingRef.current) {
        onEditEnd()
      }
    }
  }, [onEditEnd])

  const closeEditor = useCallback(() => {
    if (!editingRef.current) return

    editingRef.current = false
    setEditing(false)
    onEditEnd()
  }, [onEditEnd])

  const handleEdit = useCallback(() => {
    setDraftCategoryId(currentCategoryValue)
    setMessages(undefined)
    editingRef.current = true
    setEditing(true)
    onEditStart()
  }, [currentCategoryValue, onEditStart])

  const handleCancel = useCallback(() => {
    if (isPending) return

    setDraftCategoryId(currentCategoryValue)
    setMessages(undefined)
    closeEditor()
  }, [closeEditor, currentCategoryValue, isPending])

  const handleChange = useCallback(
    async (nextCategoryId: string) => {
      if (isPending) return

      setDraftCategoryId(nextCategoryId)

      if (nextCategoryId === currentCategoryValue) {
        setMessages(undefined)
        closeEditor()
        return
      }

      try {
        setMessages(undefined)
        await updatePayment({
          paymentId,
          patch: { categoryId: nextCategoryId },
        })
        closeEditor()
      } catch {
        const message = "Failed to update category."

        setMessages([message])
        openSnackbar("error", message)
      }
    },
    [closeEditor, currentCategoryValue, isPending, openSnackbar, paymentId, updatePayment],
  )

  const handleSelectOpenChange = useCallback(
    (open: boolean) => {
      if (open) return
      if (isPending) return
      if (draftCategoryId !== currentCategoryValue) return

      setMessages(undefined)
      closeEditor()
    },
    [closeEditor, currentCategoryValue, draftCategoryId, isPending],
  )

  return (
    <EditableField
      label="Category"
      htmlFor={id}
      editing={editing}
      disabled={disabled && !editing}
      editButtonLabel="Edit category"
      onEdit={handleEdit}
      error={Boolean(messages?.length)}
      messages={messages}
      view={
        <Text size="4" style={{ flex: 1 }}>
          {categoryName}
        </Text>
      }
      editor={
        <InlineEditor onCancel={handleCancel} saving={isPending}>
          <CategorySelect
            autoFocus
            disabled={isPending}
            id={id}
            value={draftCategoryId}
            width="100%"
            onChange={handleChange}
            onOpenChange={handleSelectOpenChange}
          >
            <ErrorBoundary fallback={<ErrorCategoryOption />}>
              <Suspense fallback={<LoadingCategoryOption />}>
                <CategoryOptions categoriesPromise={categoriesPromise} />
              </Suspense>
            </ErrorBoundary>
          </CategorySelect>
        </InlineEditor>
      }
    />
  )
}

interface CategoryOptionsProps {
  categoriesPromise: Promise<Category[]>
}

function CategoryOptions({ categoriesPromise }: CategoryOptionsProps) {
  const categories = use(categoriesPromise)

  return (
    <>
      {categories.map((category) => (
        <CategoryOption key={category.id} category={category} />
      ))}
    </>
  )
}

interface InlineEditorProps {
  children: ReactNode
  onCancel?: () => void
  saving?: boolean
}

function InlineEditor({ children, onCancel, saving = false }: InlineEditorProps) {
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Escape") return

    event.preventDefault()
    event.stopPropagation()
    if (!saving) {
      onCancel?.()
    }
  }

  return (
    <div onKeyDownCapture={handleKeyDown} style={{ width: "100%" }}>
      {children}
    </div>
  )
}

function toCategoryValue(categoryId: number | null): string {
  return categoryId === null ? "" : String(categoryId)
}
