---
title: Google OAuth の公開準備
doc_type: overview
status: accepted
area: infrastructure
applies_to:
  - docs/infrastructure.md
topics:
  - google
  - oauth
  - authentication
  - publication
when_to_read:
  - Google OAuth の一般公開設定を確認または変更するとき
  - Google のブランド審査と環境分離を確認するとき
---

# Google OAuth の公開準備

[Issue #1891](https://github.com/kosnu/savings/issues/1891) の対象は Google 側の OAuth 設定と文書整合である。
公開状態変更・審査提出・project/client 作成や切替・secret 再発行・本番設定変更は、具体案への所有者承認後に行う。
以下の変更案は未反映であり、一般公開・審査・初回ログインの完了を示さない。
Supabase 設定や利用者データは変更せず、現行の Google → Supabase callback → `/auth` → `/payments` を維持する。

## 2026-10-19 の照合結果

Google Auth Platform の Audience・Branding・Clients・Data Access・Verification Center を読み取りで確認した。
本番 Supabase の認可開始応答も、アカウントの選択・同意をせずに確認した。
秘密値、認可要求の state、token、個人の連絡先は記録しない。

| 対象                   | 実設定・観測                                                                                                                                | 文書との差・判断                                                                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 本番 project/client    | project ID `burneto`、表示名 `burneto-prd`、Web application client `Supabase`                                                               | 開発とは分離済み。作成・切替不要                                                                                                                 |
| 開発 project/client    | project ID・表示名 `burneto-dev`、Web application client `supabase-dev`                                                                     | 既存構成を維持し、新規 client や secret を作らない                                                                                               |
| 本番 origin / callback | `https://burneto.com` / `https://izuzqvgvgquqqimwuygw.supabase.co/auth/v1/callback` の各1件                                                 | 旧文書と異なり localhost は登録されていない。変更不要                                                                                            |
| 開発 origin            | `http://localhost:54321`                                                                                                                    | 本番 origin と混在していない。Web は Supabase 経由で認証し、Google の JavaScript SDK を使っていないため、この差だけで `:5173` の追加を要求しない |
| 開発 callback          | `http://localhost:54321/auth/v1/callback` と `https://ufekmuxkmodwydxmdbln.supabase.co/auth/v1/callback`                                    | ローカル・共有 Dev を開発 project 内で管理。本番へ移す必要なし                                                                                   |
| Audience               | External / Testing、テストユーザー0件。Branding 未完了により Publish app は無効                                                             | 公開状態変更は未実施。Testing だけで一般ユーザーのログイン不可とは断定しない                                                                     |
| 実際の scope           | 本番の認可開始応答は `email profile`。client は本番 `Supabase` と一致し、callback も上記と一致                                              | Web の `signInWithOAuth` は追加 scope を指定していない。基本プロフィール・メール以外を追加しない                                                 |
| Data Access            | 非機密・機密・制限付き scope の申告一覧はいずれも空                                                                                         | 空欄は「scope を要求していない」の証拠ではない。実要求に対応する2つを申告する案とする                                                            |
| アプリ名・ロゴ         | `Burneto`、ロゴ登録あり                                                                                                                     | 名称は一致。登録画像は原本と炎の形状が異なるため、ブランド原本への差し替え案。公開同意画面での表示は未確認                                       |
| 公開ページ             | Branding の homepage・privacy・terms URL は空欄                                                                                             | homepage と privacy の設定が必要。terms は専用公開ページがないため空欄を維持する案                                                               |
| 連絡先                 | support と developer contact は管理者の個人 Gmail。support の候補は同 Gmail のみ、管理する Google Group なし                                | 所有者は `support@burneto.com` への統一を指定。Google で選択可能にする準備は未実施                                                               |
| Authorized domains     | `kosnu.dev`、`izuzqvgvgquqqimwuygw.supabase.co`、`burneto.com`                                                                              | 本番 client と公開ページに不要な `kosnu.dev` は削除案。Supabase callback domain と `burneto.com` は維持                                          |
| ドメイン所有確認       | 現在の管理アカウントから Search Console の `burneto.com` domain property へアクセスできず、選択可能な property もなし。所有者も未実施と回答 | project の Owner/Editor と関連する所有確認が必要。DNS 変更は未実施                                                                               |
| 審査                   | Verification Center は Testing を理由に「不要」と表示                                                                                       | 公開時のブランド審査完了を意味しない。以下の基準で別途判断する                                                                                   |
| アプリ遷移             | repository の `useSupabaseSignIn` は現在の origin の `/auth` を指定し、session 確認後 `/payments` へ遷移                                    | 旧文書の `/` を訂正。本番で開いた `/auth` は認証済みの `/` へ到達したため、配信済みコードでの `/payments` 到達は未確認                           |

本番の `/privacy` にはプロフィール情報の利用、外部認証基盤との送受信、保存・アクセス・削除、
`support@burneto.com` の案内が表示されている。ただし未ログインの独立した環境での公開トップ・privacy の確認は残る。
今回のブラウザには既存の認証状態があったため、管理者・テストユーザーでないアカウントの初回ログインの証拠には使わない。

## scope と審査の判断

[Google の Audience 説明](https://support.google.com/cloud/answer/15549945)では、Testing でも
名前・メール・プロフィールだけの要求は、テストユーザー登録と7日失効の制限の例外となる。
現在の `email profile` はこの範囲に当たるが、未登録アカウントでの実機成功は別途確認する。

Data Access の申告案は `https://www.googleapis.com/auth/userinfo.email` と
`https://www.googleapis.com/auth/userinfo.profile` の2つだけとする。
認可要求の `email profile` に対応する非機密 scope であり、機密・制限付き scope の審査は不要と判断する。
`openid` を含め、要求していない scope をこの整備だけの理由で追加しない。
[Supabase の Google 認証説明](https://supabase.com/docs/guides/auth/social-login/auth-google)と実要求を照合し、
Google API への追加アクセス権を与えない。

[Google のブランド審査基準](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification)では、
External / 公開済みのアプリで名称・ロゴを表示するにはブランド確認が必要となる。
基本 scope だけであることを、Burneto の名称・ロゴの審査免除理由にしない。
審査後も Draft Branding の保存と Published Branding への反映を区別して確認する。

## 承認対象と反映順序

対象は本番 Google project `burneto` の既存設定とする。現在は次の具体案が未承認である。

1. homepage を `https://burneto.com/`、privacy を `https://burneto.com/privacy` に設定する。
   アプリ名は維持し、ロゴは[ブランド原本](../apps/web/public/brand/icon-master.png)へ差し替える。terms は空欄を維持する。
2. support は所有者の指定どおり `support@burneto.com` へ統一する。
   [Google の選択条件](https://support.google.com/cloud/answer/15544987)は、ログイン中の Google アカウントか、
   そのアカウントが管理する Google Group である。既存メールを使う Google アカウントの用意と project 権限付与、
   または既存 Workspace の Group 利用を検討し、方法と権限への承認後に準備する。
   窓口統一の指定だけを新規アカウント作成・権限付与・有料契約への承認と扱わない。
   developer contact は到達可能な既存の管理連絡先を維持する。
3. 上記2つの非機密 scope を Data Access に申告し、不要な Authorized domain `kosnu.dev` を外す。
   本番 client の origin/callback、開発 project/client は変更しない。
4. project の Owner/Editor に関連する `burneto.com` の所有確認を確認する。
   Supabase callback domain の扱いも Google の検証結果で確認し、所有できない domain について虚偽の申告をしない。
   DNS 登録・新規権限付与・有料 custom domain は別途承認対象とし、検証が要求されたら未解決として止める。
5. 未ログインで公開トップの機能説明・privacy リンクと privacy 本文を確認する。
   必須情報とドメイン条件が揃った後、承認済みの公開状態変更・ブランド確認/審査提出・ブランド公開を
   管理画面が示す順序で行う。審査が必要な状態を「不要」「完了」に置き換えない。

[Google の公開前基準](https://developers.google.com/identity/protocols/oauth2/production-readiness/policy-compliance)に従い、
本番・開発は project 単位で分離する。今回は既に分離済みなので、client の移行・Supabase 側の切替は不要である。
変更直前に実値と承認内容を再照合し、異なる場合は旧案で反映しない。

### 影響と切り戻し

homepage・privacy・scope の申告・ブランド公開は Google 側の表示や公開状態へ影響する。
不要 domain の削除前に、client や公開 URL で使われていないことを再確認する。
今回の案では client ID/secret・callback・Supabase project・session の保存先を変えないが、
既存 session の維持を設定不変だけで検証済みにはしない。

承認時に変更前の非秘密設定を確認し、設定不一致や障害があれば追加変更を止める。
Branding の下書きは未反映として扱い、必要なら変更前の値へ戻す。
公開済み情報の復元は再審査が必要になる場合があり、即時復元を保証しない。
公開状態を Testing に戻す場合は利用者への影響を確認し、切り戻しも承認範囲内で行う。
secret 再発行や client 切替を切り戻し手段にしない。

## 反映後の合格条件と残る確認

- Audience、Data Access、Published Branding、Verification Center、client URI を読み戻し、承認した値と一致する。
- 管理者でも登録テストユーザーでもない、所有者が用意した Google アカウントで初回ログインし、
  Google → 本番 Supabase callback → `https://burneto.com/auth` → `/payments` に到達する。
  同意画面の名称・ロゴ・リンク・scope と、警告や拒否の有無を確認する。
- 既存 session で認証済み画面を利用でき、開発側も既存 callback で認証できる。
  既存利用者をログアウトさせたり、検証用アカウントを勝手に作ったりしない。
- 審査待ち、下書きのみ、未反映、未確認は別々に残す。現在は外部変更・審査・ドメイン所有確認・
  未登録アカウントの初回ログイン・反映後 session/Dev 確認が未完了であり、Issue を close しない。

記録には確認日、対象 project/client、変更した非秘密項目、審査状態、遷移先と成否だけを残す。
client secret、token、認証 URL 全体、検証アカウントの個人情報、利用者データを Issue・PR・repository へ保存しない。
