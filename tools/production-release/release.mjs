const stableVersion = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/

export async function resolveRelease({ github, context, releaseId, expectedSha }) {
  if (
    context.ref !== "refs/heads/main" ||
    !/^[1-9]\d*$/.test(releaseId) ||
    !/^[a-f0-9]{40}$/.test(expectedSha)
  ) {
    throw new Error("main 上で Release ID と対象 commit SHA を指定してください。")
  }
  const { data: release } = await github.rest.repos.getRelease({
    ...context.repo,
    release_id: Number(releaseId),
  })
  if (
    release.draft ||
    release.prerelease ||
    !release.published_at ||
    !stableVersion.test(release.tag_name)
  ) {
    throw new Error("公開済みの正式 Release（vMAJOR.MINOR.PATCH）だけを配信できます。")
  }
  // target_commitish はタグ作成後に実 commit を示すとは限らない。
  const { data: commit } = await github.rest.repos.getCommit({
    ...context.repo,
    ref: `refs/tags/${release.tag_name}`,
  })
  if (commit.sha !== expectedSha) {
    throw new Error("Release のタグと公開時の commit SHA が一致しません。")
  }
  const { data: comparison } = await github.rest.repos.compareCommitsWithBasehead({
    ...context.repo,
    basehead: `${expectedSha}...main`,
  })
  if (comparison.merge_base_commit.sha !== expectedSha) {
    throw new Error("main に含まれる commit だけを配信できます。")
  }
  return { id: release.id, tag: release.tag_name, sha: expectedSha, url: release.html_url }
}

export async function reportRelease({
  github,
  context,
  releaseId,
  expectedSha,
  apiResult,
  webResult,
  runAttempt,
  core,
}) {
  const release = await resolveRelease({ github, context, releaseId, expectedSha })
  const runUrl = `${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}/attempts/${runAttempt}`
  const result = apiResult === "success" && webResult === "success" ? "success" : "未完了"
  const summary = [
    `### Production deployment: ${result}`,
    `- Commit: [${release.sha}](${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/commit/${release.sha})`,
    `- Run: [配信実行](${runUrl})`,
    `- Database: ${apiResult}`,
    `- Web: ${webResult}`,
    "- この結果は workflow の実行結果です。反映後の実機確認はリリース手順に従ってください。",
  ].join("\n")
  await core.summary.addRaw(summary).write()
  // 人が編集した変更内容は維持し、この workflow が所有する結果だけを更新する。
  const { data: current } = await github.rest.repos.getRelease({
    ...context.repo,
    release_id: release.id,
  })
  const start = "<!-- production-deployment:start -->"
  const end = "<!-- production-deployment:end -->"
  const block = `${start}\n${summary}\n${end}`
  const body = current.body ?? ""
  const previous = /<!-- production-deployment:start -->[\s\S]*?<!-- production-deployment:end -->/g
  await github.rest.repos.updateRelease({
    ...context.repo,
    release_id: release.id,
    body: previous.test(body) ? body.replace(previous, () => block) : `${body}\n\n${block}`,
  })
}
