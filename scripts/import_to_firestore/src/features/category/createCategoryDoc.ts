import { CategoryRecord } from "./types.ts"
import { addDoc } from "../../services/firebase/addDoc.ts"

export async function createCategoryDoc(
  token: string,
  database: string,
  projectId: string,
  category: CategoryRecord,
) {
  await addDoc({
    token,
    database,
    projectId,
    path: `categories`,
    doc: category,
  })
}
