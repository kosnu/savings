---
title: "Requirements / PRD: 言語設定のアカウント同期と初期登録"
doc_type: requirements
status: draft
area: repository
applies_to:
  - docs/ai-driven-development
  - apps/web
  - apps/api
topics:
  - ai-driven-development
  - requirements
  - user
  - auth
  - language
  - profile
---

# Requirements / PRD: 言語設定のアカウント同期と初期登録

## 背景と課題

Issue #1563では、ブラウザの`localStorage`だけに保存されていた言語設定をアカウントへ保存し、端末やブラウザをまたいで引き継ぐことを求めている。既存実装後、DBに言語がない状態でアプリを開くと「前回の言語設定が保存されていない」と表示され、言語を設定しても受け付けられない体験が確認された。

言語設定の永続的な正本は`public.users.language`とする。新規登録時はユーザーに選択を要求せず、`navigator.languages`に既存対応言語が含まれる場合だけ、配列順で最初の対応言語を初期値としてDBへ登録する必要がある。

## ありたい状態

認証済みユーザーの言語設定はアカウントに保存され、別端末でも引き継がれる。新規ユーザーは登録時に言語を選ばなくても、ブラウザが提示する言語候補のうち最初の対応言語で利用を開始できる。登録後はDBの値が正本であり、ブラウザ候補や`localStorage`が既存値を自動的に上書きしない。

## 対象ユーザーと利用シーン

- 新規登録後、追加の言語選択操作なしでアプリを利用し始める認証済みユーザー。
- 既存の言語設定を別端末または別ブラウザで引き継ぐ認証済みユーザー。
- 設定画面で日本語または英語へ変更し、アカウントへ保存するユーザー。

## ユーザーストーリー

- 新規ユーザーとして、登録時に言語を選択せず、自分のブラウザ候補に含まれる対応言語で利用を開始したい。
- 認証済みユーザーとして、自分で保存した言語を端末間で一貫して使いたい。
- 既存ユーザーとして、ブラウザ候補によって保存済みの言語を勝手に変更されたくない。
- 言語が未設定または取得・保存に失敗した場合も、アプリ全体を利用不能にせず状態を理解したい。

## スコープ

### 対象

- `public.users.language`を言語設定の永続的な正本とすること。
- ログイン時の保存済み言語取得と表示への反映。
- 言語変更時のアカウント保存と`localStorage`同期。
- 新規ユーザー作成時の`navigator.languages`からの初期言語候補選択。
- 初期言語をユーザー作成と同じ認証同期境界で保存すること。
- 必要なDB migration、型・API境界、RLS・更新条件、回帰テストの同期。

### 対象外

- 日本語・英語以外の対応言語追加。
- 登録時の言語選択UI。
- 保存済みの`public.users.language`をブラウザ候補で自動上書きすること。
- `navigator.languages`に対応言語がない場合の新しいfallback値。
- `name`と`language`以外のプロフィール列のクライアント更新。
- テーマ設定またはその他プロフィール設定の同期。
- Learnによる学び・ルール・ポリシーの追加更新。

## Rule Selection

- Rule map: `docs/harness/rule-map.json`
- Classification:
  - path: `docs/ai-driven-development/**`, `apps/web/**`, `apps/api/**`
  - domain: `user`, `auth`
  - activity: `requirements`, `change_user_behavior`
  - topic: `language`, `profile`, `supabase`
- Selected nodes:
  - `ai-driven.workflow` -> `docs/ai-driven-development/workflow.md`: AIDDのphase、成果物、Stop境界を確認するため。
  - `domain.user` -> `docs/harness/domain/user.md`: 言語の正本、初期登録、更新可能なプロフィール列を確認するため。
- Depends-on nodes:
  - `ai-driven.overview` -> `docs/ai-driven-development/overview.md`: Requirementsと後続phaseの責務を確認するため。
- Conflict decision: none。

## Domain Value Intent

| 値 | ユーザーが判断したいこと | Requirements上の境界 |
| --- | --- | --- |
| `public.users.language` | 現在アカウントに保存され、端末間で使われる言語 | `en`、`ja`、未設定のいずれか。登録後の正本とする。 |
| `navigator.languages` | 新規登録時にどの対応言語を初期候補にできるか | 配列順で最初の対応言語だけを初期登録候補とし、登録後の正本にはしない。 |
| `localStorage`の言語 | 現在のブラウザ表示を継続するための値 | DB正本を補助するローカルキャッシュであり、保存済みDB値より優先しない。 |
| 取得・保存状態 | 言語が確定済みか、処理に失敗したか | 失敗してもアプリ全体を利用不能にせず、成功と失敗を混同させない。 |

## 機能要件

### FR-1: アカウントの言語を正本として同期する

- 認証済みユーザーの保存済み`public.users.language`を取得し、現在の表示言語へ反映する。
- ユーザーが日本語または英語へ変更したとき、自身の`public.users.language`を更新する。
- DB値がある場合は、`localStorage`やブラウザ候補より優先する。
- DBへの保存成功後は、同じ言語を`localStorage`へ反映して現在のブラウザ表示を同期する。

### FR-2: 新規登録時に初期言語を保存する

- 新規ユーザーのアプリ内ユーザー作成時に、`navigator.languages`を配列順に評価する。
- 候補は既存対応言語の`en`または`ja`へ正規化できる値に限る。
- 配列順で最初に見つかった対応言語を、作成する`public.users.language`の初期値として保存する。
- 初期言語のためのユーザー選択UIを追加しない。
- 初期言語の保存とアプリ内ユーザー作成を分離して、中間的な未保存状態を作らない。

### FR-3: 既存値と未設定状態を保護する

- 既存のアプリ内ユーザーには、`navigator.languages`由来の候補を自動保存しない。
- 保存済みの`public.users.language`を`navigator.languages`で上書きしない。
- `navigator.languages`に対応言語がない場合、新しいfallbackを推測して保存しない。既存ドメインで許容される未設定状態を維持する。
- 既存ユーザーへ設定値を強制的に推測して保存しない。

### FR-4: 更新境界と失敗状態を維持する

- クライアントが更新できるプロフィール列は自身の`name`と`language`だけとし、他の列を追加しない。
- 言語更新では、認証中のユーザーに対応する1件が更新されたことを確認し、対象なしを成功扱いしない。
- 言語取得または保存に失敗してもアプリ全体を利用不能にしない。
- 失敗時は、ユーザーが保存済みと誤認しない状態を示す。

## 非機能要件と制約

- 対応言語は既存の日本語と英語を維持する。
- DB、API、Webの型とvalidationは`en`、`ja`、未設定の境界で一致させる。
- 初期値候補の取得はブラウザ環境に閉じ、DBには正規化後の対応言語だけを渡す。
- 言語の初期登録は認証同期処理の責務内で行い、クライアントから`public.users`を直接作成しない。
- Issue #1563、監督入力、`domain.user`から追跡できない要求を追加しない。

## 受け入れ条件

- AC-1: 新規ユーザーの`navigator.languages`が`["fr-FR", "ja-JP", "en-US"]`の場合、`public.users.language`へ`ja`が初期登録される。
- AC-2: 新規ユーザーの`navigator.languages`が`["en-GB", "ja-JP"]`の場合、`public.users.language`へ`en`が初期登録される。
- AC-3: 対応言語を含まない候補だけの場合、新しいfallback言語を推測保存しない。
- AC-4: 既存ユーザーの`public.users.language`が`ja`の場合、`navigator.languages`の先頭が`en-US`でも`ja`を上書きしない。
- AC-5: DBに保存済みの言語がログイン時に反映され、別端末でも同じ値が使われる。
- AC-6: 言語変更時、自身の`public.users.language`が更新され、成功後に現在のブラウザ表示と`localStorage`が同期する。
- AC-7: 自身の`name`と`language`以外のプロフィール列をクライアントから更新可能にしない。
- AC-8: 言語更新対象が0件の場合、保存成功として扱わない。
- AC-9: 言語取得または保存失敗時もアプリ全体を利用でき、未保存を成功済みと表示しない。
- AC-10: 既存の日本語・英語表示と既存ユーザーの保存値が壊れていないことを回帰テストで確認できる。

## Q&Aログ

- Q: 初期登録時にユーザーへ言語を選ばせるか？
  - A: 選ばせない。`navigator.languages`の対応候補を使用する。
- Q: 候補の先頭が未対応で、後続に対応言語がある場合はどうするか？
  - A: 配列順に評価し、最初に見つかった対応言語を使う。
- Q: DBに保存済みの値とブラウザ候補のどちらを優先するか？
  - A: DBを優先する。ブラウザ候補は新規ユーザーの初期登録に限る。
- Q: 対応言語が候補にない場合は英語にするか？
  - A: しない。fallbackは未決定であり、今回推測して追加しない。
- Q: 既存ユーザーの未設定値をブラウザ候補で補完するか？
  - A: 補完しない。既存ユーザーに推測値を強制保存しないというIssue制約を維持する。

## 技術的考慮事項

- 後続Designでは、ブラウザ候補を正規化する責務、認証同期APIへ渡す契約、既存ユーザーを更新しないDB境界を決める。
- 新規ユーザー作成と初期言語保存の原子性を保つため、既存の認証同期処理内で扱う。
- 回帰テストは、候補順序、地域付き言語タグ、対応候補なし、既存ユーザー非上書き、保存失敗を対象にする。
- 具体的な関数名、migration名、コンポーネント構成はDesignで決める。

## Verification

この成果物はdocumentation-onlyのためアプリ検証は実行しない。次を手動確認する。

- Issue #1563、Task Context、`docs/harness/domain/user.md`から各要求を追跡できる。
- 未決定fallback、対応言語追加、登録時UIを要求へ追加していない。
- `git diff --check`が成功する。

## Stop条件

- `navigator.languages`からの初期候補、DB正本、既存値非上書きの境界が複数解釈になる。
- 対応言語がない場合のfallbackを決めなければ今回の必須成功条件を満たせない。
- `name`と`language`以外のプロフィール列、対応言語追加、登録時UIが必要になる。
- Requirementsがselected rule-map subgraphと矛盾する。
