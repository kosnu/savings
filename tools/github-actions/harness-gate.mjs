import { execFileSync } from "node:child_process"
import { setTimeout } from "node:timers/promises"
import { pathToFileURL } from "node:url"

const workflow = "harness_checker_ci.yaml"
const runIdPattern = /^[1-9][0-9]*$/

function isHarnessRun(run, repo) {
  return (
    Number.isSafeInteger(run?.id) &&
    runIdPattern.test(String(run.id)) &&
    run.path === `.github/workflows/${workflow}` &&
    run.repository?.full_name === repo &&
    /^[0-9a-f]{40}$/i.test(run.head_sha) &&
    (run.event === "pull_request" ||
      (run.event === "workflow_dispatch" && run.triggering_actor?.id === 41898282))
  )
}

export async function resolveGate({ api, wait, triggerId, repo, serverUrl }) {
  if (!runIdPattern.test(triggerId)) return

  const runsPath = `repos/${repo}/actions/runs`
  const trigger = api(`${runsPath}/${triggerId}`)
  if (!isHarnessRun(trigger, repo) || String(trigger.id) !== triggerId) return

  const readJobs = (id) => api(`${runsPath}/${id}/jobs?filter=latest&per_page=100`).jobs
  let remainingPolls = 24

  async function inspect(run) {
    // 完了通知と再実行が交差しても現在のattemptを読む。
    let jobs = readJobs(run.id)
    while (run.event === "pull_request") {
      const context = jobs.find((job) => job.name === "context")
      if (context?.conclusion === "skipped") {
        // 起動失敗・キャンセルで検証が省かれたrunは失敗として扱う。
        return {
          run,
          jobs,
          metadata:
            run.status !== "completed" || ["success", "skipped"].includes(run.conclusion),
        }
      }
      if (
        context?.conclusion ||
        context?.status === "in_progress" ||
        run.status === "completed" ||
        remainingPolls === 0
      ) {
        break
      }
      remainingPolls--
      await wait(5000)
      run = api(`${runsPath}/${run.id}`)
      jobs = readJobs(run.id)
    }
    return { run, jobs, metadata: false }
  }

  const source = await inspect(trigger)

  const sha = trigger.head_sha
  const { workflow_runs: runs } = api(
    `repos/${repo}/actions/workflows/${workflow}/runs?head_sha=${sha}&per_page=100`,
  )
  const candidates = runs
    .filter((run) => isHarnessRun(run, repo) && run.head_sha === sha && run.id !== trigger.id)
    // 編集runの完了通知でも有効runを選び直し、判定待ちで投稿したpendingを復旧する。
    .concat(source.metadata ? [] : [source.run])
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || b.id - a.id)

  // 起動元に限定すると、待機中の通知が失われた場合に最新runのpendingが残りうる。
  // 古いrunの通知でも同じSHAの採用runを読み直し、その状態を投稿する。
  for (const candidate of candidates) {
    const current = api(`${runsPath}/${candidate.id}`)
    if (!isHarnessRun(current, repo) || current.id !== candidate.id || current.head_sha !== sha) {
      continue
    }
    const { run, jobs, metadata } = await inspect(current)
    if (metadata) continue

    let state = "pending"
    if (run.status === "completed") {
      const succeeded =
        run.conclusion === "success" &&
        ["candidate", "integration"].every((name) =>
          jobs.some((job) => job.name === name && job.conclusion === "success"),
        )
      state = succeeded ? "success" : "failure"
    }
    return {
      sha,
      status: {
        state,
        context: "harness-gate",
        description: `Harness CI: ${state} (run ${run.id})`,
        target_url: `${serverUrl}/${repo}/actions/runs/${run.id}`,
      },
    }
  }
}

function ghApi(endpoint, fields) {
  const args = ["api", endpoint]
  if (fields) {
    args.push("--method", "POST")
    for (const [name, value] of Object.entries(fields)) args.push("-f", `${name}=${value}`)
  }
  const response = execFileSync("gh", args, {
    encoding: "utf8",
    stdio: ["ignore", fields ? "ignore" : "pipe", "ignore"],
  })
  if (!fields) return JSON.parse(response)
}

async function main() {
  const repo = process.env.GITHUB_REPOSITORY
  const gate = await resolveGate({
    api: ghApi,
    wait: setTimeout,
    triggerId: process.env.TRIGGER_RUN_ID,
    repo,
    serverUrl: process.env.GITHUB_SERVER_URL,
  })
  if (gate) ghApi(`repos/${repo}/statuses/${gate.sha}`, gate.status)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await main()
  } catch {
    console.error("Harness gate: ステータスの判定または投稿に失敗しました")
    process.exitCode = 1
  }
}
