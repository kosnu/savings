import { getTimestamp } from "./utils/getTimestamp.ts"
import { convertDocData } from "./utils/convertDocData.ts"
import { Doc } from "./types.ts"

interface AddDocParams<
  TDoc extends Doc,
> {
  token: string
  projectId: string
  database?: string
  path: string
  doc: TDoc
}

export async function addDoc<TDoc extends Doc>(
  {
    token,
    projectId,
    database = "(default)",
    path,
    doc,
  }: AddDocParams<TDoc>,
) {
  if (!token) {
    throw new Error("Token is required")
  }

  if (!projectId) {
    throw new Error("Project ID is required")
  }

  if (!database) {
    throw new Error("Database is required")
  }

  if (!path) {
    throw new Error("Path is required")
  }

  const docWithTimestamps = {
    ...doc,
    created_date: getTimestamp(),
    updated_date: getTimestamp(),
  }

  const docForRequestBody = {
    fields: convertDocData(docWithTimestamps),
  }

  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${database}/documents/${path}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(docForRequestBody),
    },
  )
  if (!res.ok) {
    throw new Error(`Firestore 追加失敗: ${await res.text()}`)
  }

  return res
}
