import { appendFileSync, readFileSync } from "node:fs"
import { pathToFileURL } from "node:url"

// ラベルは特定の SHA への配信要求。Environment の承認とは別に扱う。
export function deploymentRequest(event, eventName, ref, repository) {
  let number
  let sha
  if (eventName === "pull_request") {
    number = event.number
    sha = /^preview:([a-f0-9]{40})$/.exec(event.label?.name ?? "")?.[1]
    if (
      event.action !== "labeled" ||
      event.pull_request?.head?.repo?.full_name !== repository ||
      event.pull_request?.base?.ref !== "main" ||
      event.pull_request?.head?.sha !== sha
    ) {
      throw new Error("PR event is not an explicit request for this head SHA")
    }
  } else if (eventName === "workflow_dispatch" && ref === "refs/heads/main") {
    number = event.inputs?.pr_number
    sha = event.inputs?.head_sha
  } else {
    throw new Error("Unsupported deployment event/ref")
  }
  if (!/^[1-9][0-9]*$/.test(String(number)) || !/^[a-f0-9]{40}$/.test(sha ?? "")) {
    throw new Error("PR number and full head SHA are required")
  }
  return { number: String(number), sha, labeled: eventName === "pull_request" }
}

export async function authorize(request, repository, get) {
  const pr = await get(`/repos/${repository}/pulls/${request.number}`)
  if (
    pr.state !== "open" ||
    pr.base?.ref !== "main" ||
    pr.head?.repo?.full_name !== repository ||
    pr.head?.sha !== request.sha ||
    !pr.head?.ref ||
    [...pr.head.ref].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127) ||
    (request.labeled && !pr.labels?.some((label) => label.name === `preview:${request.sha}`))
  ) {
    throw new Error("PR is closed, changed, foreign, or no longer opted in")
  }
  const environment = await get(`/repos/${repository}/environments/development`)
  if (
    environment.name !== "development" ||
    !environment.protection_rules?.some(
      (rule) =>
        rule.type === "required_reviewers" &&
        rule.prevent_self_review === false &&
        rule.reviewers?.length === 1 &&
        rule.reviewers[0].type === "User" &&
        rule.reviewers[0].reviewer?.login === repository.split("/")[0],
    )
  ) {
    throw new Error("development requires its sole owner as reviewer with self-review allowed")
  }
  return { branch: pr.head.ref, sha: request.sha }
}

async function main() {
  const { GITHUB_EVENT_PATH, GITHUB_EVENT_NAME, GITHUB_REF, GITHUB_REPOSITORY, GH_TOKEN } =
    process.env
  if (!GH_TOKEN || !/^[\w.-]+\/[\w.-]+$/.test(GITHUB_REPOSITORY ?? "")) {
    throw new Error("GitHub read token and repository are required")
  }
  const request = deploymentRequest(
    JSON.parse(readFileSync(GITHUB_EVENT_PATH, "utf8")),
    GITHUB_EVENT_NAME,
    GITHUB_REF,
    GITHUB_REPOSITORY,
  )
  const approved = await authorize(request, GITHUB_REPOSITORY, async (path) => {
    const response = await fetch(`https://api.github.com${path}`, {
      headers: { Authorization: `Bearer ${GH_TOKEN}`, Accept: "application/vnd.github+json" },
      redirect: "error",
    })
    // 未設定・Forbidden・通信障害を成功として扱わず、レスポンス本文も出力しない。
    if (!response.ok) throw new Error(`GitHub prerequisite read failed (${response.status})`)
    return response.json()
  })
  if (process.env.EXPECTED_SHA && approved.sha !== process.env.EXPECTED_SHA) {
    throw new Error("Resolved SHA changed after approval")
  }
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `sha=${approved.sha}\nbranch=${approved.branch}\n`)
  }
  console.log(`Validated PR #${request.number} head ${approved.sha}; development approval required`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}
