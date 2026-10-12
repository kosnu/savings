import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"

import { prPreviewName } from "./preview.mjs"
import { deploymentReport } from "./report.mjs"

const env = {
  PREVIEW_BRANCH: "issue-1918/preview-check-link",
  DEPLOYED_SHA: "a".repeat(40),
  PR_NUMBER: "1918",
  GITHUB_REPOSITORY: "kosnu/savings",
  GITHUB_RUN_ID: "123456",
  GITHUB_RUN_NUMBER: "42",
  GITHUB_RUN_ATTEMPT: "1",
}
const deployment = {
  type: "preview",
  preview_name: prPreviewName(env.PR_NUMBER),
  preview_urls: ["https://preview-burneto-dev.example.workers.dev"],
  deployment_id: "deployment-one",
}

test("成功結果にリンクと PR・branch・承認済み SHA・deployment・run/attempt を含める", () => {
  const completedAt = "2026-10-12T19:00:00.000Z"
  const report = deploymentReport(deployment, env, completedAt)
  assert.equal(report.url, `${deployment.preview_urls[0]}/`)
  assert.equal(
    report.description,
    `${completedAt} | PR #1918 | run 42.1 | issue-1918/preview-check-link`,
  )
  for (const value of [
    `[Preview を開く](<${report.url}>)`,
    "https://github.com/kosnu/savings/pull/1918",
    env.PREVIEW_BRANCH,
    env.DEPLOYED_SHA,
    deployment.deployment_id,
    completedAt,
    "actions/runs/123456/attempts/1",
  ])
    assert.ok(report.summary.includes(value), value)
  const otherUrl = "https://another-burneto-dev.example.workers.dev"
  assert.ok(
    deploymentReport(
      { ...deployment, preview_urls: [...deployment.preview_urls, otherUrl] },
      env,
    ).summary.includes(`[Preview を開く](<${otherUrl}/>)`),
  )
})

test("空・本番・別branch・不正 URL / metadata の結果を通知に使わない", () => {
  for (const patch of [
    { type: "deployment" },
    { preview_name: "another-branch" },
    { deployment_id: null },
    { deployment_id: "" },
    { deployment_id: "bad\nmetadata" },
    { preview_urls: [] },
    { preview_urls: [null] },
    { preview_urls: ["https://burneto.com"] },
    { preview_urls: ["javascript:alert(1)"] },
    { preview_urls: ["http://preview.example.workers.dev"] },
    { preview_urls: ["https://user:password@preview.example.workers.dev"] },
    { preview_urls: ["https://preview.example.workers.dev/#fragment"] },
    { preview_urls: ["https://preview.example.workers.dev\nurl=other"] },
    { preview_urls: [deployment.preview_urls[0], "not-a-url"] },
  ])
    assert.throws(() => deploymentReport({ ...deployment, ...patch }, env))
  for (const patch of [
    { DEPLOYED_SHA: "main" },
    { PR_NUMBER: "0" },
    { GITHUB_RUN_ATTEMPT: "0" },
    { GITHUB_RUN_ID: "bad\nvalue" },
    { PREVIEW_BRANCH: "bad\nbranch" },
  ])
    assert.throws(() => deploymentReport(deployment, { ...env, ...patch }))
})

test("長いbranchもサマリーに残し、status description は API 上限内に収める", () => {
  const branch = `feature/${"x".repeat(200)}<details>&`
  const report = deploymentReport(
    { ...deployment, preview_name: prPreviewName(env.PR_NUMBER) },
    { ...env, PREVIEW_BRANCH: branch },
  )
  assert.equal(report.description.length, 140)
  assert.ok(report.description.includes("run 42.1"))
  assert.ok(report.summary.includes(`${"x".repeat(200)}&lt;details&gt;&amp;`))
})

test("CLI → job outputs → report shell は手動実行でも PR SHA へ成功 status だけを登録する", () => {
  const dir = mkdtempSync(join(tmpdir(), "preview-report-"))
  try {
    const json = join(dir, "preview.json")
    const output = join(dir, "output")
    const summary = join(dir, "summary")
    const calls = join(dir, "calls.jsonl")
    writeFileSync(
      join(dir, "gh"),
      `#!${process.execPath}\nimport { appendFileSync } from 'node:fs'; const args = process.argv.slice(2); if (args.includes('POST')) appendFileSync(process.env.CALLS, JSON.stringify(args) + '\\n'); else console.log(process.env.LATEST ?? '');\n`,
      { mode: 0o755 },
    )
    const workflow = readFileSync(
      new URL("../../.github/workflows/deploy_preview.yaml", import.meta.url),
      "utf8",
    )
    const job = workflow.split("\n  report:\n")[1]
    assert.ok(job.includes("needs: [resolve, deploy, reconcile]"))
    assert.ok(job.includes("statuses: write"))
    assert.ok(!job.includes("checkout" + "@"))
    assert.ok(!job.includes("if: always()"))
    assert.equal((workflow.match(/statuses: write/gu) ?? []).length, 1)
    assert.ok(job.includes("DEPLOYED_SHA: ${{ needs.resolve.outputs.sha }}"))
    const script = job
      .split("        run: |\n")[1]
      .split("\n")
      .map((line) => line.replace(/^          /u, ""))
      .join("\n")
    for (const [runNumber, attempt, id] of [
      ["42", "1", "first"],
      ["42", "2", "retry"],
      ["43", "1", "redeploy"],
    ]) {
      writeFileSync(json, JSON.stringify({ ...deployment, deployment_id: id }))
      writeFileSync(output, "")
      writeFileSync(summary, "")
      const processEnv = {
        ...process.env,
        ...env,
        GITHUB_SHA: "b".repeat(40),
        GITHUB_EVENT_NAME: "workflow_dispatch",
        GITHUB_REF: "refs/heads/main",
        GITHUB_RUN_NUMBER: runNumber,
        GITHUB_RUN_ATTEMPT: attempt,
        GITHUB_OUTPUT: output,
        GITHUB_STEP_SUMMARY: summary,
      }
      execFileSync(process.execPath, [new URL("report.mjs", import.meta.url).pathname, json], {
        env: processEnv,
      })
      const outputs = Object.fromEntries(
        readFileSync(output, "utf8")
          .trim()
          .split("\n")
          .map((line) => {
            const index = line.indexOf("=")
            return [line.slice(0, index), line.slice(index + 1)]
          }),
      )
      execFileSync("bash", ["-c", script], {
        env: {
          ...processEnv,
          PATH: `${dir}:${process.env.PATH}`,
          CALLS: calls,
          PREVIEW_URL: outputs.url,
          DESCRIPTION: outputs.description,
          COMPLETED_AT: outputs.completed_at,
        },
      })
      const args = JSON.parse(readFileSync(calls, "utf8").trim().split("\n").at(-1))
      assert.ok(args.includes(`repos/kosnu/savings/statuses/${env.DEPLOYED_SHA}`))
      assert.ok(args.includes("state=success"))
      assert.ok(args.includes("context=Dev Preview URL / PR #1918"))
      assert.ok(
        args.includes(
          `description=${outputs.completed_at} | PR #1918 | run ${runNumber}.${attempt} | ${env.PREVIEW_BRANCH}`,
        ),
      )
      assert.ok(args.includes(`target_url=${deployment.preview_urls[0]}/`))
      assert.ok(readFileSync(summary, "utf8").includes(`<code>${id}</code>`))
    }
    assert.equal(readFileSync(calls, "utf8").trim().split("\n").length, 3)
    // 通知jobだけの遅れた再実行は、新しい成功配信を上書きしない。
    execFileSync("bash", ["-c", script], {
      env: {
        ...process.env,
        ...env,
        PATH: `${dir}:${process.env.PATH}`,
        CALLS: calls,
        PREVIEW_URL: deployment.preview_urls[0],
        DESCRIPTION: "old deployment",
        COMPLETED_AT: "2026-10-12T18:00:00.000Z",
        LATEST: "2026-10-12T19:00:00.000Z | PR #1918 | run 43.1",
      },
    })
    assert.equal(readFileSync(calls, "utf8").trim().split("\n").length, 3)
    writeFileSync(json, JSON.stringify({ ...deployment, preview_urls: [] }))
    assert.throws(() =>
      execFileSync(process.execPath, [new URL("report.mjs", import.meta.url).pathname, json], {
        env: { ...process.env, ...env, GITHUB_OUTPUT: output, GITHUB_STEP_SUMMARY: summary },
        stdio: "pipe",
      }),
    )
    assert.equal(readFileSync(calls, "utf8").trim().split("\n").length, 3)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
