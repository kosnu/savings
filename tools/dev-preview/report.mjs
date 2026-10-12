import { appendFileSync, readFileSync } from "node:fs"
import { pathToFileURL } from "node:url"

import { previewName, prPreviewName } from "./preview.mjs"

export function deploymentReport(deployment, env, completedAt = new Date().toISOString()) {
  const { PREVIEW_BRANCH, DEPLOYED_SHA, PR_NUMBER, GITHUB_RUN_NUMBER, GITHUB_RUN_ATTEMPT } = env
  if (
    !/^[a-f0-9]{40}$/u.test(DEPLOYED_SHA ?? "") ||
    [PR_NUMBER, GITHUB_RUN_NUMBER, GITHUB_RUN_ATTEMPT].some(
      (value) => !/^[1-9][0-9]*$/u.test(value ?? ""),
    ) ||
    !/^[\w.-]+\/[\w.-]+$/u.test(env.GITHUB_REPOSITORY ?? "") ||
    !/^[1-9][0-9]*$/u.test(env.GITHUB_RUN_ID ?? "")
  ) {
    throw new Error("PR、配信 SHA、Actions 実行の識別子が必要です。")
  }
  if (
    deployment.type !== "preview" ||
    deployment.preview_name !== prPreviewName(PR_NUMBER) ||
    typeof deployment.deployment_id !== "string" ||
    !deployment.deployment_id ||
    [...deployment.deployment_id].some(
      (char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127,
    ) ||
    !Array.isArray(deployment.preview_urls) ||
    deployment.preview_urls.length === 0
  ) {
    throw new Error("対象ブランチの成功した Preview 配信結果が必要です。")
  }
  previewName(PREVIEW_BRANCH)
  const urls = deployment.preview_urls.map((value) => {
    if (typeof value !== "string" || /[\s<>]/u.test(value)) {
      throw new Error("Preview URL が不正です。")
    }
    const url = new URL(value)
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      !url.hostname.endsWith(".workers.dev") ||
      (value !== url.origin && value !== `${url.origin}/`)
    ) {
      throw new Error("HTTPS の workers.dev Preview URL が必要です。")
    }
    return url.href
  })
  const escape = (value) =>
    value.replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;")
  const run = `${GITHUB_RUN_NUMBER}.${GITHUB_RUN_ATTEMPT}`
  const repoUrl = `https://github.com/${env.GITHUB_REPOSITORY}`
  return {
    url: urls[0],
    completedAt,
    description: `${completedAt} | PR #${PR_NUMBER} | run ${run} | ${PREVIEW_BRANCH}`.slice(0, 140),
    summary: [
      "## Dev Preview 配信成功",
      "",
      ...urls.map((url) => `[Preview を開く](<${url}>)`),
      "",
      `- PR: [#${PR_NUMBER}](${repoUrl}/pull/${PR_NUMBER})`,
      `- Branch: <code>${escape(PREVIEW_BRANCH)}</code>`,
      `- Commit: [${DEPLOYED_SHA}](${repoUrl}/commit/${DEPLOYED_SHA})`,
      `- Deployment: <code>${escape(deployment.deployment_id)}</code>`,
      `- 配信結果の確認時刻 (UTC): ${completedAt}`,
      `- Actions: [run ${run}](${repoUrl}/actions/runs/${env.GITHUB_RUN_ID}/attempts/${GITHUB_RUN_ATTEMPT})`,
      "",
    ].join("\n"),
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = deploymentReport(JSON.parse(readFileSync(process.argv[2], "utf8")), process.env)
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `url=${report.url}\ndescription=${report.description}\ncompleted_at=${report.completedAt}\n`,
  )
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, report.summary)
}
