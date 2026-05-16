import * as z from "zod"

export const CATEGORY_NAME_MAX_LENGTH = 20

export const categoryNameSchema = z
  .string()
  .min(1, "Category name cannot be empty")
  .max(
    CATEGORY_NAME_MAX_LENGTH,
    `Category name must be ${CATEGORY_NAME_MAX_LENGTH} characters or less`,
  )
