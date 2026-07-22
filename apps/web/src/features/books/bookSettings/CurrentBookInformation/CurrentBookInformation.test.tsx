import { composeStories } from "@storybook/react-vite"
import type { ReactElement } from "react"
import { describe, expect, test, vi } from "vite-plus/test"

import type { createBookHandlers } from "../../../../test/msw/handlers/books"
import { server } from "../../../../test/msw/server"
import { act, render, screen } from "../../../../test/test-utils"
import * as stories from "./CurrentBookInformation.stories"

const { Default, FetchError, Loading } = composeStories(stories)

type CurrentBookInformationStory = typeof Default

function resetHandlersForStory(story: CurrentBookInformationStory) {
  const createHandlers = story.parameters.bookHandlers as () => ReturnType<
    typeof createBookHandlers
  >
  server.resetHandlers(...createHandlers())
}

async function renderStory(story: ReactElement) {
  return await act(async () => render(story, { withProviders: false }))
}

describe("CurrentBookInformation", () => {
  test("現在のブック名と対象中であることを表示する", async () => {
    resetHandlersForStory(Default)

    await renderStory(<Default />)

    expect(await screen.findByRole("heading", { name: "Default Book" })).toBeInTheDocument()
    expect(screen.getByText("Current book")).toBeInTheDocument()
    expect(
      screen.getByText("The monthly budget and categories below belong to this book."),
    ).toBeInTheDocument()
  })

  test("読み込み中は現在のブック情報のskeletonを表示する", async () => {
    resetHandlersForStory(Loading)

    await renderStory(<Loading />)

    expect(screen.getByLabelText("loading current book")).toBeInTheDocument()
  })

  test("読み込み失敗時はエラーを表示する", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    resetHandlersForStory(FetchError)

    await renderStory(<FetchError />)

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not load current book information.",
    )
  })
})
