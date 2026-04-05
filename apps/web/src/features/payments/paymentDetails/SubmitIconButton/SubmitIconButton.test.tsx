import { composeStories } from "@storybook/react-vite"
import { describe, expect, test } from "vitest"

import { render, screen } from "../../../../test/test-utils"
import * as stories from "./SubmitIconButton.stories"

const { Default, Loading } = composeStories(stories)

describe("SubmitIconButton", () => {
  test("通常状態では送信ボタンを表示する", () => {
    render(<Default />)

    expect(screen.getByRole("button", { name: /save amount/i })).toBeInTheDocument()
  })

  test("読み込み中は spinner を表示して無効化する", () => {
    render(<Loading />)

    expect(screen.getByLabelText("saving")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /save amount/i })).toBeDisabled()
  })
})
