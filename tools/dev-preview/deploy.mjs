import { spawnSync } from "node:child_process"
import { pathToFileURL } from "node:url"

import { prPreviewName } from "./preview.mjs"

export function deploymentArgs(help, name) {
  const modern =
    /^cf previews deploy \[directory\]\s*$/mu.test(help) && /^\s+--preview-name\s+/mu.test(help)
  const legacy = /^cf previews deploy \[preview-name\]\s*$/mu.test(help)
  if (modern === legacy) {
    throw new Error("cf の Preview 名指定を確認できないため配信しません。")
  }
  return [
    "--filter",
    "web",
    "exec",
    "cf",
    "previews",
    "deploy",
    ...(modern ? ["--preview-name", name] : [name]),
    "--prebuilt",
    "--mode",
    "development",
  ]
}

export function deployPreview(env = process.env, run = spawnSync) {
  const name = prPreviewName(env.PR_NUMBER)
  if (env.PREVIEW_NAME !== name) {
    throw new Error("配信対象の PR と Preview 名が一致しません。")
  }
  // help は配信結果へ混ぜず、失敗時も内容をログへ転載しない。
  const helpEnv = { ...env, NO_COLOR: "1", CF_SEND_TELEMETRY: "false" }
  delete helpEnv.CLOUDFLARE_API_TOKEN
  const help = run("pnpm", ["--filter", "web", "exec", "cf", "previews", "deploy", "--help"], {
    env: helpEnv,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 15000,
    maxBuffer: 65536,
  })
  if (help.error || help.status !== 0 || help.signal) {
    throw new Error("cf の help を取得できないため配信しません。")
  }
  const result = run("pnpm", deploymentArgs(help.stdout, name), {
    env,
    stdio: ["ignore", "inherit", "inherit"],
  })
  // 失敗後は配信済みの可能性があるため自動で再試行しない。
  if (result.error || result.signal) throw new Error("Preview 配信の終了を確認できません。")
  return result.status ?? 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exitCode = deployPreview()
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
