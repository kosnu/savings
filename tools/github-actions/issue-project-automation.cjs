module.exports = async ({
  github,
  context,
  core,
  token = process.env.PROJECT_AUTOMATION_TOKEN,
}) => {
  if (!token) {
    throw new Error(
      "Set repository secret PROJECT_AUTOMATION_TOKEN with project and issue write access.",
    )
  }
  const issueId = context.payload.issue.node_id
  if (!issueId) throw new Error("Issue ID was not provided")

  const { user, repository } = await github.graphql(`query {
    user(login: "kosnu") {
      projectV2(number: 2) { id }
    }
    repository(owner: "kosnu", name: "savings") {
      viewerCanSeeIssueFields
      issueFields(first: 25) {
        pageInfo { hasNextPage }
        nodes {
          ... on IssueFieldSingleSelect {
            id
            name
            options { id name }
          }
        }
      }
    }
  }`)
  const projectId = user?.projectV2?.id
  if (!projectId) throw new Error("Savings project is missing")
  const definitions = repository?.issueFields
  if (
    repository?.viewerCanSeeIssueFields !== true ||
    definitions?.pageInfo?.hasNextPage !== false ||
    !Array.isArray(definitions?.nodes)
  ) {
    throw new Error("Issue Field definitions could not be read")
  }

  const field = definitions.nodes.find((node) => node?.name === "Automation")
  const enabled = field?.options?.find((option) => option.name === "Enabled")
  if (!field?.id || !enabled?.id) {
    throw new Error("Automation single-select Issue Field or Enabled option is missing")
  }

  // 登録済みなら既存itemが返るため、再実行でも重複登録しない。
  const { addProjectV2ItemById } = await github.graphql(
    `mutation($project: ID!, $issue: ID!) {
    addProjectV2ItemById(input: {projectId: $project, contentId: $issue}) {
      item { id }
    }
  }`,
    { project: projectId, issue: issueId },
  )
  if (!addProjectV2ItemById?.item?.id) throw new Error("Project item was not returned")

  const readAutomation = async () => {
    const { node } = await github.graphql(
      `query($issue: ID!) {
      node(id: $issue) {
        ... on Issue {
          id
          issueFieldValues(first: 25) {
            pageInfo { hasNextPage }
            nodes {
              __typename
              ... on IssueFieldSingleSelectValue {
                name
                field { ... on IssueFieldSingleSelect { id } }
              }
            }
          }
        }
      }
    }`,
      { issue: issueId },
    )
    const values = node?.issueFieldValues
    if (
      node?.id !== issueId ||
      values?.pageInfo?.hasNextPage !== false ||
      !Array.isArray(values?.nodes) ||
      values.nodes.some(
        (value) =>
          !value?.__typename ||
          (value.__typename === "IssueFieldSingleSelectValue" && (!value.field?.id || !value.name)),
      )
    ) {
      throw new Error("Automation Issue Field value could not be read")
    }
    return values.nodes.find((value) => value.field?.id === field.id)?.name ?? null
  }

  if ((await readAutomation()) !== null) {
    core.info("Automation Issue Field is already set; preserving the current value.")
    return
  }

  const { setIssueFieldValue } = await github.graphql(
    `mutation($issue: ID!, $field: ID!, $option: ID!) {
    setIssueFieldValue(input: {
      issueId: $issue,
      issueFields: [{fieldId: $field, singleSelectOptionId: $option}]
    }) { issue { id } }
  }`,
    { issue: issueId, field: field.id, option: enabled.id },
  )
  if (setIssueFieldValue?.issue?.id !== issueId || (await readAutomation()) !== "Enabled") {
    throw new Error("Automation Issue Field = Enabled was not confirmed after updating")
  }
  core.info("Confirmed Automation Issue Field = Enabled.")
}
