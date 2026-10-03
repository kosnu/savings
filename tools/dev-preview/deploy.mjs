import { execFileSync } from "node:child_process"
import { appendFileSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { developmentEnv, previewName, previewUrl, validateBuildOutput } from "./preview.mjs"

const root = fileURLToPath(new URL("../../", import.meta.url))
const args = process.argv.slice(2)
const buildOnly = args.includes("--build-only")
const branchArgs = args.filter((arg) => arg !== "--build-only")
if (branchArgs.length > 1 || branchArgs.some((arg) => arg.startsWith("-"))) {
  throw new Error("Usage: node tools/dev-preview/deploy.mjs [branch] [--build-only]")
}
const git = (...argv) => execFileSync("git", argv, { cwd: root, encoding: "utf8" }).trim()
const branch = branchArgs[0] ?? git("branch", "--show-current")
const name = previewName(branch)
const env = developmentEnv(process.env)
if (
  !buildOnly &&
  (!process.env.CLOUDFLARE_API_TOKEN ||
    !/^[a-f0-9]{32}$/u.test(process.env.CLOUDFLARE_ACCOUNT_ID ?? ""))
) {
  throw new Error("承認済み Dev 配信用 Cloudflare token / account ID が必要です。")
}
const run = (argv, options = {}) =>
  execFileSync("pnpm", argv, { cwd: root, env, stdio: "inherit", ...options })
console.log(`Dev Preview: ${name}; commit: ${git("rev-parse", "HEAD")}`)
run(["run", "web:build", "--mode", "development"])
// 前回の本番成果物の再利用や mode の取り違えを配信前に検出する。
const outputRoot = `${root}apps/web/.cloudflare/output/v0/`
const output = JSON.parse(readFileSync(`${outputRoot}config.json`, "utf8"))
const worker = JSON.parse(readFileSync(`${outputRoot}workers/default/worker.config.json`, "utf8"))
validateBuildOutput(output, worker)
if (buildOnly) {
  console.log("Preview build 完了。配信・DB接続は実行していません。")
} else {
  // ビルドには配信 token を渡さず、cf の実行時だけ渡す。
  const result = JSON.parse(
    run(
      [
        "--filter",
        "web",
        "exec",
        "cf",
        "previews",
        "deploy",
        name,
        "--prebuilt",
        "--mode",
        "development",
        "--quiet",
      ],
      {
        env: {
          ...env,
          CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN,
          CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID,
        },
        stdio: ["ignore", "pipe", "inherit"],
        encoding: "utf8",
      },
    ),
  )
  const url = previewUrl(result, name)
  const summary = `Preview: ${url}\nCommit: ${git("rev-parse", "HEAD")}\nDeployment: ${result.deployment_id}\n`
  console.log(summary)
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary)
}
