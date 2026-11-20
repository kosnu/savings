// kosnu/savings の Issue Field 定義を GitHub API で確認した数値 ID。
const automationFieldId = 50147379
const valuesPath = "/repos/kosnu/savings/issues/{issue_number}/issue-field-values"
const headers = { accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2026-03-10" }

module.exports = async ({ github, context, core }) => {
  const issueNumber = context.payload.issue?.number
  if (
    context.repo?.owner !== "kosnu" ||
    context.repo?.repo !== "savings" ||
    !Number.isSafeInteger(issueNumber) ||
    issueNumber < 1
  ) {
    throw new Error("A valid kosnu/savings issue is required")
  }
  const request = { issue_number: issueNumber, headers }

  const readAutomation = async () => {
    const { data } = await github.request(`GET ${valuesPath}`, request)
    if (
      !Array.isArray(data) ||
      data.some((field) => !Number.isSafeInteger(field?.issue_field_id))
    ) {
      throw new Error("Issue Field values could not be read")
    }
    const matching = data.filter(
      (field) =>
        field.issue_field_id === automationFieldId || field.issue_field_name === "Automation",
    )
    if (matching.length === 0) return null
    const [field] = matching
    const name = field.single_select_option?.name
    if (
      matching.length !== 1 ||
      field.issue_field_id !== automationFieldId ||
      field.issue_field_name !== "Automation" ||
      field.data_type !== "single_select" ||
      typeof name !== "string" ||
      !name.trim()
    ) {
      throw new Error("Unexpected Automation Issue Field")
    }
    return name
  }

  if ((await readAutomation()) !== null) {
    core.info("Automation Issue Field is already set; preserving the current value.")
    return
  }

  // POSTは指定フィールドだけを追加し、PUTと異なり全フィールドを置換しない。
  await github.request(`POST ${valuesPath}`, {
    ...request,
    issue_field_values: [{ field_id: automationFieldId, value: "Enabled" }],
  })
  if ((await readAutomation()) !== "Enabled") {
    throw new Error("Automation Issue Field = Enabled was not confirmed after updating")
  }
  core.info("Confirmed Automation Issue Field = Enabled.")
}
