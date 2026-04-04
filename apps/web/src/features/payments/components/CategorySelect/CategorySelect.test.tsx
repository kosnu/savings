import { act, cleanup, render, screen } from "@testing-library/react"
import type { ComponentProps } from "react"
import { afterEach, describe, expect, test, vi } from "vitest"

import { CategorySelect, NoneCategoryOption } from "./CategorySelect"

const { mockSelectRoot, mockSelectTrigger, mockSelectContent, mockSelectItem } = vi.hoisted(() => ({
  mockSelectRoot: vi.fn(),
  mockSelectTrigger: vi.fn(),
  mockSelectContent: vi.fn(),
  mockSelectItem: vi.fn(),
}))

vi.mock("@radix-ui/themes", () => ({
  Select: {
    Root: (
      props: ComponentProps<"div"> & { value?: string; onValueChange?: (value: string) => void },
    ) => {
      mockSelectRoot(props)
      return <div data-testid="select-root">{props.children}</div>
    },
    Trigger: (props: ComponentProps<"button"> & { placeholder?: string }) => {
      mockSelectTrigger(props)
      return <button type="button">{props.placeholder}</button>
    },
    Content: (props: ComponentProps<"div">) => {
      mockSelectContent(props)
      return <div>{props.children}</div>
    },
    Item: (props: ComponentProps<"div"> & { value: string }) => {
      mockSelectItem(props)
      return (
        <div
          role="option"
          aria-label={props["aria-label"]}
          aria-selected="false"
          data-value={props.value}
        >
          {props.children}
        </div>
      )
    },
  },
}))

function getLastRootProps() {
  const [props] = mockSelectRoot.mock.lastCall ?? []

  return props as { value?: string; onValueChange?: (value: string) => void }
}

describe("CategorySelect", () => {
  afterEach(() => {
    cleanup()
    mockSelectRoot.mockReset()
    mockSelectTrigger.mockReset()
    mockSelectContent.mockReset()
    mockSelectItem.mockReset()
  })

  test("allowEmptyOption が false のとき空文字は未選択として扱う", () => {
    render(<CategorySelect value="" />)

    expect(getLastRootProps().value).toBeUndefined()
  })

  test("allowEmptyOption が true のとき空文字は None を選択値にする", () => {
    render(
      <CategorySelect value="" allowEmptyOption>
        <NoneCategoryOption />
      </CategorySelect>,
    )

    expect(getLastRootProps().value).toBe("none")
    expect(screen.getByRole("option", { name: /none/i })).toBeInTheDocument()
  })

  test("none を選ぶと空文字へ変換して通知する", () => {
    const onChange = vi.fn()

    render(
      <CategorySelect value="" allowEmptyOption onChange={onChange}>
        <NoneCategoryOption />
      </CategorySelect>,
    )

    act(() => {
      getLastRootProps().onValueChange?.("none")
    })

    expect(onChange).toHaveBeenCalledWith("")
  })
})
