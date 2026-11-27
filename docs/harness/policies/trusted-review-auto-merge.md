---
title: 信頼済みレビューによる Auto-merge
doc_type: policy
status: accepted
area: repository
applies_to:
  - .github/CODEOWNERS
  - .github/workflows/harness_checker_ci.yaml
  - GitHub main Ruleset
topics:
  - github
  - codeowners
  - auto-merge
when_to_read:
  - main 向け PR の Auto-merge を有効化または確認するとき
  - main の必須チェックを設定、検証、復旧するとき
---

# 信頼済みレビューによる Auto-merge

対象は `kosnu/savings` 内のブランチから `main` に向けた PR。GitHub が保護条件を評価し、PR ごとに有効化した Auto-merge を実行する。操作の権限と保護ルールの適用は [Git Workflow](git-workflow.md#マージ可否の判断と結果報告) に従い、通常の保護が適用される経路を使う。fork 由来の PR は対象外とする。

## 承認と再レビュー

- `main` の [CODEOWNERS](../../../.github/CODEOWNERS) で変更パスごとの所有者を確認する。最後に一致した指定が有効で、既定では `@kosnu` または `@kosnu-bot`、高リスクパスでは `@kosnu` の正式な `APPROVED` が必要。低リスクと高リスクの混在でも高リスクパスに対する `@kosnu` の承認が必要。
- 既存の承認 1 件、CODEOWNER review、古い承認の破棄、レビュー会話の解決を要求する設定を使う。コメント、自由文、Copilot や Codex のレビューシグナルは承認として数えない。
- レビュー提出時の対象は review の `commit_id` で確認する。GitHub が記録した承認時の PR 差分が push やベース更新などで変わると、古い承認は失効し、変更後の差分に対する正式な承認が必要になる。
- 差分が同じまま HEAD SHA だけ変わった場合は再承認を必須にしない。承認の `commit_id` とマージ直前の HEAD が異なり得ることは、Kosuke が受け入れた残留リスク。Auto-merge のマージ条件に SHA をピン止めしない。必須チェックは更新後に GitHub が評価するコミットで必要になる。

仕様は [GitHub の CODEOWNERS](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners) と [Ruleset のルール](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets) を参照。

## main Ruleset への設定と復旧

Kosuke が GitHub の管理画面で設定する。リポジトリの必須チェックは **`verify` 1 件、発行元 GitHub Actions** とする。[Harness Checker CI](../../../.github/workflows/harness_checker_ci.yaml) の同名ジョブは `candidate` と `integration` の両方の成功を確認する。対象別 CI や `vite-plus/aidd-checker-ci` はこの条件に含まれない。発行元の指定は GitHub Actions に限定するもので、個別 workflow の識別までは行わない。

1. 直近 7 日以内の同一リポジトリの `main` 向け PR で、Checks に表示される `verify` の詳細を開き、Harness Checker CI の成功と発行元を確認する。履歴がなければ、設定前に対象 PR の通常の CI で成功実績を作る。
2. `kosnu/savings` の **Settings → Rules → Rulesets** で `main` に適用される既存の有効な Ruleset を開く。変更前のルール・対象・bypass を確認し、復旧用に設定をエクスポートする。既に Auto-merge 待機中の PR があれば、設定変更で意図せずマージされないよう先に確認する。
3. **Require status checks to pass** を有効化し、**Add checks** で正確に `verify` を選ぶ。発行元を **GitHub Actions** に設定する。選べない場合は `Any source` のまま運用開始せず、成功履歴とチェックの詳細を確認する。既存のレビュー条件・適用範囲・bypass は維持する。最新ベースへの更新を求める追加オプションは選ばない。
4. 保存後に再度設定を開き、状態が Active で、対象が `main`、必須チェックが `verify` で発行元が GitHub Actions であることを確認する。PR のマージ欄でも `verify` が必須として評価されることを確認し、下記の試験を行う。
5. 復旧する場合は、先に待機中の Auto-merge を無効にする。チェックを外すと待機中の PR がマージ可能になるため、待機が解除されたことを PR で確認してから、追加した `verify` を削除する。この作業で初めて必須チェックを有効にした場合は、そのルール項目も変更前に戻す。保存後に設定と PR のマージ欄を再確認し、既存のレビュー保護が適用されていることを確認する。

画面操作とチェックの照合は [Ruleset の管理](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/managing-rulesets-for-a-repository) と [必須チェックのトラブルシューティング](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks) を参照。

## PR ごとの有効化

リポジトリの Auto-merge は許可済み。Ruleset の反映後、対象 PR とマージの依頼を確認した Kosuke が、PR のマージ欄で許可された方式を選び、**Enable auto-merge → Confirm auto-merge** を実行できる。GitHub はマージ条件の充足待ちの PR にこの選択肢を表示する。既に即時マージ可能な場合の実行は Git Workflow の手動マージ手順に従う。

`kosnu-bot` は write 権限を持つユーザーなので、既存の認証でマージ操作が許可されるフローでは、同じ操作で有効化できる。CLI を使う場合は `gh pr merge <PR番号> --repo kosnu/savings --auto --squash` が操作例で、`--squash` はリポジトリで許可された方式に合わせる。既存認証での実行は未確認。CLI は条件充足済みの場合に即時マージし得るため、待機させる目的では UI の Auto-merge 表示を確認して操作する。PR の作成や Auto-merge の有効化そのものは CODEOWNER の承認にならず、PR 作者は自分の PR を承認できない。

`kosnu-dev[bot]` は既存フローで push と PR 作成に使われる GitHub App。既存のインストール権限・認証で Auto-merge を有効化できるか、公開フローが有効化まで行うかは未確認。確認できるまでは公開後に Kosuke が PR 上で有効化する。新規認証情報や権限の追加、Actions による承認代行はこの運用に含めない。

有効化後は PR のマージ欄で待機状態を確認する。取り消しは **Disable auto-merge** を使う。write 権限のない主体による head への push や base の切り替えで GitHub が有効化を解除するため、更新後に PR の状態を読み直す。手順は [GitHub の Auto-merge](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/automatically-merging-a-pull-request) と [GitHub CLI](https://cli.github.com/manual/gh_pr_merge) を参照。

## 実環境での検証

Ruleset 変更と実 GitHub での Auto-merge 試験は Kosuke の作業であり、Issue #1700 の文書実装時点では未実施。

設定反映後、Kosuke が同一リポジトリの試験ブランチから `main` 向け PR をケースごとに作る。成功時にマージしてよい軽微な変更を使い、意図的な失敗や競合を含む PR は試験後に Auto-merge を無効化して閉じる。bypass を使わず、原則としてレビューや CI を一つ保留している間に Auto-merge を有効にし、試験対象以外の条件を充足させて PR のマージ欄を確認する。設定された状態を作れない場合や観測できなかった場合は未確認として扱う。

| ケース                 | 再現操作と期待結果                                                                                                                                                                                                                                                     |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 正常                   | 低リスクパスの PR を別主体が作成し、`@kosnu-bot` が承認する。別の PR では高リスクパスの無害な変更を `@kosnu` が承認する。各 PR で必要なレビューと `verify` の成功、会話解決、Ready、競合なしが揃うと自動マージされる。                                                 |
| 未知ユーザー・非所有者 | CODEOWNER 外の既存アカウントで正式な Approve を試す。送信可能でも CODEOWNER 要件は待機のまま。送信できない場合は拒否を確認し、正式承認が存在する場合の挙動は未確認とする。高リスクパスでは別主体作成の PR に `@kosnu-bot` だけが Approve しても待機する。              |
| コメントのみ           | CODEOWNER が通常コメントまたは Comment レビューで「問題なし」と投稿する。正式承認を要求したまま待機する。                                                                                                                                                              |
| 差分変更後の古い承認   | 承認済みの HEAD A を未解決スレッドで待機させる。PR のファイル差分を変える commit B を write 権限のある PR 作者が push し、旧承認の `DISMISSED` と再評価を確認する。スレッドを解決し B の CI が成功しても再承認まで待機し、B をレビューして承認すると自動マージされる。 |
| 差分同一で HEAD 更新   | 上と同様に待機させ、空 commit で HEAD を更新する。Files changed が同じことを確認し、旧承認の状態と新しいチェック結果を観測する。GitHub が承認を有効と判断した場合に再承認は不要。                                                                                      |
| `verify` 失敗          | 試験 PR で `tools/harness/checker` 下の Go ファイルに gofmt が検出する整形違反を入れる。チェックの詳細で `candidate` の失敗と `verify` の failure を確認し、レビュー条件を揃えても待機することを確認する。                                                             |
| `verify` 実行中        | 検証 PR を開いてすぐに有効化し、Harness Checker CI の実行中に CODEOWNER が承認する。マージ欄でチェック待ちと未マージを確認し、成功後の遷移を追う。                                                                                                                     |
| `verify` 未実行        | 固有の HEAD を持つ試験 PR を、HEAD commit のメッセージに `[skip ci]` を含めて開く。Checks で通常の workflow が起動せず、マージ欄で必須チェックが未報告のまま待機することを確認する。                                                                                   |
| 未解決スレッド         | Files changed にインラインのレビュー会話を作り、未解決のまま承認と CI を揃える。会話解決までは待機する。                                                                                                                                                               |
| `CHANGES_REQUESTED`    | write 権限のある非作者が Request changes を提出する。低リスク PR を `kosnu-dev[bot]` で作り、例えば `@kosnu-bot` が変更を要求し `@kosnu` が承認する。CI が成功しても、有効な変更要求がある間は待機する。                                                               |
| Draft                  | 承認または CI 待ちで有効化した PR を Draft に戻し、ほかの条件を満たせる場合は揃え、Draft の間はマージされないことを確認する。Auto-merge の表示も記録し、Ready 復帰時は有効化状態を再確認する。                                                                         |
| 競合                   | 同じ行を異なる内容へ変更した二つの試験 PR を用意する。一方を待機させ、他方を通常の保護を通して先に `main` にマージする。待機側で競合が表示され、マージされないことを確認する。                                                                                         |

GitHub はテストマージコミットにチェックがある場合にその結果を評価するため、PR のマージ欄でどのコミットのチェックか確認する。GitHub が `skipped` や `neutral` を合格として扱う場合もある。未報告の確認では workflow 全体の未起動とジョブ単体の skip を区別する。

## GitHub 記録での確認

- **判定主体とレビュー対象**は、PR の Reviews とタイムライン、または REST の PR reviews にある `user.login`、`state`、`commit_id` で照合する。PR の `head.sha` とベースの CODEOWNERS を合わせて確認し、承認後に差分が変わった場合は push と承認の失効をタイムラインで追う。
- **CI の対象と理由**は PR のマージ欄と Checks の詳細にある必須チェック名、発行元、対象 SHA、状態、workflow run を確認する。`verify` が失敗したときは `candidate` と `integration` の結果まで辿る。PR のマージ欄で会話・レビュー・Draft・競合などの他の阻止条件を確認する。
- **操作主体と結果**は、PR のタイムラインの Auto-merge 有効化・解除とマージのイベント、PR のマージ状態・時刻・マージコミット SHA から確認する。マージコミットを開き、採用された変更を照合する。レビュー時の HEAD、チェック対象 SHA、最終マージコミット SHA はそれぞれの記録から取得する。GitHub のマージ可否は適用設定とこれらの記録を突き合わせて判断する。
