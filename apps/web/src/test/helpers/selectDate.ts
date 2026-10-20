import { within } from "@testing-library/react"
import type { UserEvent } from "@testing-library/user-event"
import { differenceInCalendarMonths, format, parse } from "date-fns"
import { enUS } from "date-fns/locale"

import { parseDateOnlyStringToLocalDate } from "../../domain/date"

export async function selectDate(
  user: Pick<UserEvent, "click">,
  input: HTMLElement,
  value: string,
) {
  const body = within(document.body)
  const target = parseDateOnlyStringToLocalDate(value)
  await user.click(input)
  const grid = await body.findByRole("grid")
  const displayedMonth = parse(grid.getAttribute("aria-label") ?? "", "LLLL yyyy", target, {
    locale: enUS,
  })
  const months = differenceInCalendarMonths(target, displayedMonth)
  if (!Number.isFinite(months)) throw new Error("Calendar month could not be read")
  for (let index = 0; index < Math.abs(months); index++) {
    await user.click(
      body.getByRole("button", {
        name: months < 0 ? /previous month/i : /next month/i,
      }),
    )
  }
  await user.click(
    body.getByRole("button", {
      name: new RegExp(format(target, "EEEE, MMMM do, yyyy", { locale: enUS })),
    }),
  )
}
