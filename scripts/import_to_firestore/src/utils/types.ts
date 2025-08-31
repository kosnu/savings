export const collectionMap = {
  payments: {
    name: "payments",
    columns: ["date", "category", "note", "amount"],
  },
} as const
export type CollectionName = keyof typeof collectionMap

export function isCollectionKey(
  key: string,
): key is keyof typeof collectionMap {
  return key in collectionMap
}
