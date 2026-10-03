import { appendFileSync, readFileSync } from "node:fs"
import { pathToFileURL } from "node:url"

export const deploymentProfiles = {
  preview: { label: "preview" },
  database: { label: "dev-db" },
}

// PR の明示操作時点の SHA を内部で固定する。入力としてコピーさせない。
export function deploymentRequest(event, eventName, ref, repository, kind = "preview") {
  const profile = deploymentProfiles[kind]
  if (!profile) throw new Error("Unsupported deployment kind")
  let number
  let sha
  if (eventName === "pull_request") {
    number = event.number
    sha = event.pull_request?.head?.sha
    if (
      event.action !== "labeled" ||
      event.label?.name !== profile.label ||
      event.pull_request?.head?.repo?.full_name !== repository ||
      event.pull_request?.base?.ref !== "main"
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
  return { number: String(number), sha, labeled: eventName === "pull_request", kind }
}

export async function authorize(request, repository, get) {
  const profile = deploymentProfiles[request.kind ?? "preview"]
  if (!profile) throw new Error("Unsupported deployment kind")
  const pr = await get(`/repos/${repository}/pulls/${request.number}`)
  if (
    pr.state !== "open" ||
    pr.base?.ref !== "main" ||
    pr.head?.repo?.full_name !== repository ||
    pr.head?.sha !== request.sha ||
    (request.branch && pr.head?.ref !== request.branch) ||
    !pr.head?.ref ||
    [...pr.head.ref].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127) ||
    (request.labeled && !pr.labels?.some((label) => label.name === profile.label))
  ) {
    throw new Error("PR is closed, changed, foreign, or no longer opted in")
  }
  return { branch: pr.head.ref, sha: request.sha }
}

async function main() {
  const { GITHUB_EVENT_PATH, GITHUB_EVENT_NAME, GITHUB_REF, GITHUB_REPOSITORY, GH_TOKEN } =
    process.env
  if (!GH_TOKEN || !/^[\w.-]+\/[\w.-]+$/.test(GITHUB_REPOSITORY ?? "")) {
    throw new Error("GitHub read token and repository are required")
  }
  const get = async (path) => {
    const response = await fetch(`https://api.github.com${path}`, {
      headers: { Authorization: `Bearer ${GH_TOKEN}`, Accept: "application/vnd.github+json" },
      redirect: "error",
    })
    if (!response.ok) throw new Error(`GitHub prerequisite read failed (${response.status})`)
    return response.json()
  }
  const event = JSON.parse(readFileSync(GITHUB_EVENT_PATH, "utf8"))
  if (GITHUB_EVENT_NAME === "workflow_dispatch") {
    if (!/^[1-9][0-9]*$/.test(event.inputs?.pr_number ?? "")) throw new Error("PR number required")
    // main の手動実行でも SHA は取得して固定し、二度目は承認前の値を使う。
    event.inputs.head_sha =
      process.env.EXPECTED_SHA ??
      (await get(`/repos/${GITHUB_REPOSITORY}/pulls/${event.inputs.pr_number}`)).head.sha
  }
  const request = deploymentRequest(
    event,
    GITHUB_EVENT_NAME,
    GITHUB_REF,
    GITHUB_REPOSITORY,
    process.env.DEPLOYMENT_KIND ?? "preview",
  )
  request.branch = process.env.EXPECTED_BRANCH
  const approved = await authorize(request, GITHUB_REPOSITORY, get)
  if (process.env.EXPECTED_SHA && approved.sha !== process.env.EXPECTED_SHA) {
    throw new Error("Resolved SHA changed after approval")
  }
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `sha=${approved.sha}\nbranch=${approved.branch}\n`)
  }
  console.log(`Validated PR #${request.number} head ${approved.sha}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}
