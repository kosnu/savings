const versionPattern = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/
const start = "<!-- production-release-draft:start -->"
const end = "<!-- production-release-draft:end -->"

function version(tag) {
  const match = versionPattern.exec(tag)
  const parts = match?.slice(1).map(Number)
  if (match?.[0] !== tag || !parts || parts.some((part) => !Number.isSafeInteger(part))) {
    throw new Error("バージョンは vMAJOR.MINOR.PATCH で指定してください。")
  }
  return parts
}

function compare(left, right) {
  const a = version(left),
    b = version(right)
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2]
}

export function nextVersion(previousTag, commits, requestedVersion = "") {
  if (!previousTag) {
    if (requestedVersion && compare(requestedVersion, "v0.1.0") < 0) {
      throw new Error("初回は v0.1.0 以降を指定してください。")
    }
    return requestedVersion || "v0.1.0"
  }
  const [major, minor, patch] = version(previousTag)
  if (requestedVersion) {
    if (compare(requestedVersion, previousTag) <= 0) {
      throw new Error("公開済みのバージョンより大きい番号が必要です。")
    }
    return requestedVersion
  }
  let level = 0
  for (const { commit, parents } of commits) {
    const message = commit.message
    const lines = message.split("\n")
    // 通常 merge の本文先頭には PR title が入る。squash/rebase は commit の header を使う。
    const header =
      parents.length > 1 && lines[0].startsWith("Merge ")
        ? (lines.slice(1).find((line) => line.trim()) ?? "")
        : lines[0]
    const match =
      /^(feat|fix|perf|refactor|build|ci|chore|docs|test|style|revert)(?:\([^\n)]+\))?(!)?: .+/.exec(
        header,
      )
    if (!match) {
      if (parents.length > 1) continue
      throw new Error(
        "採番できない commit があります。変更を確認し version を指定して再実行してください。",
      )
    }
    const breaking = match[2] || /^BREAKING[ -]CHANGE: .+/m.test(message)
    level = Math.max(level, breaking ? 3 : match[1] === "feat" ? 2 : 1)
  }
  if (level === 0) return null
  if (level === 3 && major > 0) return `v${major + 1}.0.0`
  if (level >= 2) return `v${major}.${minor + 1}.0`
  return `v${major}.${minor}.${patch + 1}`
}

export async function draftRelease({ github, context, requestedVersion = "" }) {
  if (context.ref !== "refs/heads/main" || !/^[a-f0-9]{40}$/.test(context.sha)) {
    throw new Error("main の固定 SHA からだけ Draft を準備できます。")
  }
  const releases = await github.paginate(github.rest.repos.listReleases, {
    ...context.repo,
    per_page: 100,
  })
  const published = releases.filter(
    (release) =>
      !release.draft &&
      !release.prerelease &&
      release.published_at &&
      versionPattern.test(release.tag_name),
  )
  published.sort((a, b) => compare(b.tag_name, a.tag_name))
  const previous = published[0]
  const commits = []
  if (previous) {
    const { data: base } = await github.rest.repos.getCommit({
      ...context.repo,
      ref: `refs/tags/${previous.tag_name}`,
    })
    for (let page = 1; ; page++) {
      const { data } = await github.rest.repos.compareCommitsWithBasehead({
        ...context.repo,
        basehead: `${base.sha}...${context.sha}`,
        per_page: 100,
        page,
      })
      if (data.merge_base_commit.sha !== base.sha) {
        throw new Error("前回 Release の commit が配信対象の履歴に含まれていません。")
      }
      commits.push(...data.commits)
      if (commits.length >= data.total_commits) break
      if (data.commits.length === 0) throw new Error("commit 一覧を最後まで取得できませんでした。")
    }
    if (commits.length === 0 && !requestedVersion) return null
  }
  const tag = nextVersion(previous?.tag_name, commits, requestedVersion)
  if (!tag) return null
  version(tag)
  // タグだけを既に作成した番号も再利用しない。Draft の保存ではタグを作らない。
  try {
    await github.rest.git.getRef({ ...context.repo, ref: `tags/${tag}` })
    throw new Error("提案するタグが既に存在します。新しい番号を指定してください。")
  } catch (error) {
    if (error.status !== 404) throw error
  }
  const managed = releases.filter((release) => release.draft && release.body?.includes(start))
  if (
    managed.length > 1 ||
    releases.some((release) => release.tag_name === tag && !managed.includes(release))
  ) {
    throw new Error("重複する Draft / Release があるため自動更新できません。")
  }
  const { data: notes } = await github.rest.repos.generateReleaseNotes({
    ...context.repo,
    tag_name: tag,
    target_commitish: context.sha,
    ...(previous ? { previous_tag_name: previous.tag_name } : {}),
  })
  const block = `${start}\n## リリース候補 ${tag}\n\n前回正式版: ${previous?.tag_name ?? "初回"}\n\n採番: ${requestedVersion ? "担当者の明示指定" : "コミット形式による自動候補"}\n\n対象 commit: ${context.sha}\n\n${notes.body}\n${end}`
  const { data: main } = await github.rest.repos.getBranch({ ...context.repo, branch: "main" })
  // 過去 run の再実行で最新 Draft を古い main へ戻さない。
  if (main.commit.sha !== context.sha) return null
  const fields = { ...context.repo, tag_name: tag, target_commitish: context.sha, name: tag }
  if (managed[0]) {
    const { data: current } = await github.rest.repos.getRelease({
      ...context.repo,
      release_id: managed[0].id,
    })
    const region =
      /<!-- production-release-draft:start -->[\s\S]*?<!-- production-release-draft:end -->/
    if (!current.draft || !region.test(current.body ?? "")) {
      throw new Error("Draft が公開・編集されています。状態を確認してください。")
    }
    return (
      await github.rest.repos.updateRelease({
        ...fields,
        release_id: current.id,
        body: current.body.replace(region, () => block),
      })
    ).data
  }
  return (
    await github.rest.repos.createRelease({
      ...fields,
      draft: true,
      prerelease: false,
      body: `${block}\n\n## 公開前の確認\n\n互換性・DB への影響・復旧方法を確認し、この対象 commit と内容への承認後に正式公開してください。`,
    })
  ).data
}
