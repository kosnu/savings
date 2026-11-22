import { execFileSync } from "node:child_process"

const phase = process.argv[2]
const {
  EXPECTED_HEAD,
  CONTEXT_HEAD,
  GITHUB_EVENT_NAME,
  GITHUB_SHA,
  GITHUB_REPOSITORY,
  GITHUB_SERVER_URL,
  GITHUB_RUN_ID,
  CANDIDATE_RESULT,
  INTEGRATION_RESULT,
} = process.env

if (
  !/^[0-9a-f]{40}$/.test(CONTEXT_HEAD) ||
  CONTEXT_HEAD !== EXPECTED_HEAD ||
  (GITHUB_EVENT_NAME !== "pull_request" &&
    (GITHUB_EVENT_NAME !== "workflow_dispatch" || GITHUB_SHA !== CONTEXT_HEAD))
) {
  throw new Error("Harness gate requires a validated PR head SHA")
}

let state
switch (phase) {
  case "pending":
    state = "pending"
    break
  case "finish":
    state =
      CANDIDATE_RESULT === "success" && INTEGRATION_RESULT === "success" ? "success" : "failure"
    break
  default:
    throw new Error("Invalid Harness gate phase")
}

execFileSync(
  "gh",
  [
    "api",
    "--method",
    "POST",
    `repos/${GITHUB_REPOSITORY}/statuses/${CONTEXT_HEAD}`,
    "-f",
    `state=${state}`,
    "-f",
    "context=harness-gate",
    "-f",
    `description=Harness CI: ${state}`,
    "-f",
    `target_url=${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`,
  ],
  { stdio: ["ignore", "ignore", "inherit"] },
)
