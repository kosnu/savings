import { validationError } from "../../shared/errors.ts"

const DATE_FORMAT_REGEX = /^\d{4}-\d{2}-\d{2}$/

type DateParamName = "dateFrom" | "dateTo"

export function validateCriteria(
  dateFrom?: string,
  dateTo?: string,
) {
  const dateFromError = validateDateParam("dateFrom", dateFrom)
  if (dateFromError) {
    return dateFromError
  }

  return validateDateParam("dateTo", dateTo)
}

function validateDateParam(
  name: DateParamName,
  value?: string,
) {
  if (value === undefined) {
    return undefined
  }

  if (!DATE_FORMAT_REGEX.test(value)) {
    return validationError(`${name} must be YYYY-MM-DD`, { [name]: value })
  }

  return undefined
}
