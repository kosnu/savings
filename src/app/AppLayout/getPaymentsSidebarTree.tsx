import { CalendarIcon } from "@radix-ui/react-icons"
import { paths } from "../../config/paths"

export function getPaymentsSidebarTree(now: Date) {
  const startYear = 2022
  const startMonth = 1
  const endYear = now.getFullYear()
  const endMonth = now.getMonth() + 1 // 1-based

  const years = []
  for (let year = endYear; year >= startYear; year--) {
    const months = []
    const fromMonth = year === startYear ? startMonth : 1
    const toMonth = year === endYear ? endMonth : 12
    for (let m = fromMonth; m <= toMonth; m++) {
      const month = String(m).padStart(2, "0")
      months.push({
        id: `M${month}`,
        label: month,
        href: paths.payments.getHref(String(year), month),
      })
    }
    years.push({
      id: `Y${year}`,
      label: String(year),
      children: months,
    })
  }
  return {
    id: "title",
    icon: <CalendarIcon />,
    label: "Payments",
    children: years,
  }
}
