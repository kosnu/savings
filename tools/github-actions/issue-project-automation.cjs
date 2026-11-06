module.exports = async ({
  github,
  context,
  core,
  token = process.env.PROJECT_AUTOMATION_TOKEN,
}) => {
  if (!token) {
    throw new Error("Set repository secret PROJECT_AUTOMATION_TOKEN with project write access.")
  }

  const { user } = await github.graphql(`query {
    user(login: "kosnu") {
      projectV2(number: 2) {
        id
        field(name: "Automation") {
          ... on ProjectV2SingleSelectField {
            id
            options { id name }
          }
        }
      }
    }
  }`)
  const project = user?.projectV2
  const field = project?.field
  const enabled = field?.options?.find((option) => option.name === "Enabled")
  if (!project?.id || !field?.id || !enabled?.id) {
    throw new Error("savings project, Automation single-select field, or Enabled option is missing")
  }

  // 登録済みなら既存itemが返るため、再実行でも重複登録しない。
  const { addProjectV2ItemById } = await github.graphql(
    `mutation($project: ID!, $issue: ID!) {
    addProjectV2ItemById(input: {projectId: $project, contentId: $issue}) {
      item { id }
    }
  }`,
    { project: project.id, issue: context.payload.issue.node_id },
  )
  const itemId = addProjectV2ItemById?.item?.id
  if (!itemId) throw new Error("Project item was not returned")

  const readAutomation = async () => {
    const { node } = await github.graphql(
      `query($item: ID!) {
      node(id: $item) {
        ... on ProjectV2Item {
          id
          fieldValueByName(name: "Automation") {
            ... on ProjectV2ItemFieldSingleSelectValue { optionId }
          }
        }
      }
    }`,
      { item: itemId },
    )
    if (node?.id !== itemId) throw new Error("Project item could not be read")
    const value = node.fieldValueByName
    if (value === null) return null
    if (!value?.optionId) throw new Error("Automation value could not be read")
    return value.optionId
  }

  const current = await readAutomation()
  if (current !== null) {
    core.info("Automation is already set; preserving the current value.")
    return
  }

  await github.graphql(
    `mutation($project: ID!, $item: ID!, $field: ID!, $option: String!) {
    updateProjectV2ItemFieldValue(input: {
      projectId: $project, itemId: $item, fieldId: $field,
      value: {singleSelectOptionId: $option}
    }) { projectV2Item { id } }
  }`,
    { project: project.id, item: itemId, field: field.id, option: enabled.id },
  )
  if ((await readAutomation()) !== enabled.id) {
    throw new Error("Automation = Enabled was not confirmed after updating")
  }
  core.info("Confirmed Automation = Enabled.")
}
