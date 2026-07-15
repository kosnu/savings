---
title: "Requirements / PRD: プロフィールで登録情報を確認・編集できるようにする"
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
  - profile
  - settings
  - user
  - auth
when_to_read:
  - Issue #1552 のプロフィール情報表示・編集要求を確認するとき
  - Auth user とアプリ内ユーザーの表示責務を設計するとき
---

# Requirements / PRD: プロフィールで登録情報を確認・編集できるようにする

## 背景と課題

Issue #1552 は、ユーザーが設定画面で自分の登録情報とログイン情報を確認し、変更可能な情報を識別できるようにする要求である。現在のプロフィール画面は言語設定だけを扱っており、表示名を確認・変更する導線、登録メールアドレスとログイン方法を確認する導線がない。

この要求では、認証プロバイダーのユーザー情報とアプリ内ユーザー情報の責務を混同しないことが重要である。Issue は最終仕様ではなく、意図、境界、成功条件、Stop 条件を Requirements / PRD に展開するための入力として扱う。

## Current State / Current Gaps

- `/settings/profile` は `ProfileSettings` を表示する route である。
- `ProfileSettings` は現在、`LanguageSelect` による言語設定だけを表示している。プロフィール情報の取得、表示、更新は行っていない。
- `SupabaseSessionProvider` は Supabase Auth の session を取得し、認証済みユーザーの確認後に `Session` を保持する。Auth user には email と認証メタデータがある。
- 現行のサインイン導線は Supabase OAuth の Google provider を使用している。これは現在のログイン導線の事実であり、プロフィール画面でログイン方法を変更できることを意味しない。
- `public.users` は Auth user と `auth_user_id` で対応し、アプリ内ユーザーの `name` と `email` を保持する。`auth_user_id` は一意で `auth.users(id)` を参照する。
- 既存のユーザードメインルールでは、クライアントが更新できるプロフィール列は `name` のみである。RLS と権限設定も `public.users` の `name` 更新だけを許可し、email や Auth 情報の更新を許可していない。
- 現在のプロフィール画面には、Auth user とアプリ内ユーザーの値を同じ画面で一貫して確認するための表示責務がまだ定義されていない。

## Future Behavior

認証済みユーザーは `/settings/profile` で、現在ログインしている自分のアカウントに対応する表示名、登録メールアドレス、ログイン方法を確認できる。表示名だけが編集可能であり、保存結果を確認できる。email とログイン方法は読み取り専用として識別でき、編集・追加・変更の操作にはならない。

プロフィール情報の取得中、取得失敗、表示名の保存中、保存成功、保存失敗は、ユーザーが現在の状態と次に取れる行動を誤解しない形で扱う。失敗した更新が成功済み、または古い値が新しい値として確定したように見えてはいけない。既存の言語設定は同じプロフィール画面で引き続き利用できる。

## 対象ユーザーと利用シーン

- 対象ユーザー: Savings に認証済みで、自分の設定を確認・変更するユーザー。
- 登録情報の確認: 現在ログインしているアカウントの表示名と登録メールアドレスを確認したい。
- ログイン情報の確認: 現在のログイン方法を確認し、表示名やemailと区別したい。
- 表示名の変更: 編集可能な表示名だけを変更して保存結果を確認したい。
- 設定の継続利用: アカウント情報を確認・編集しても、既存の言語設定を使い続けたい。

## ユーザーストーリー

- 認証済みユーザーとして、自分の表示名を確認したい。そうすることで、アプリ内プロフィールとして登録されている表示情報を把握できる。
- 認証済みユーザーとして、表示名を変更して保存結果を確認したい。そうすることで、アプリ内で表示される自分の名前を管理できる。
- 認証済みユーザーとして、登録メールアドレスを確認したい。そうすることで、現在のアカウントを識別できる。
- 認証済みユーザーとして、ログイン方法を確認したい。そうすることで、どの認証情報でログインしているかを理解できる。
- 認証済みユーザーとして、どの情報が編集可能かを識別したい。そうすることで、変更できない認証情報を誤って変更しようとしない。

## スコープ

### 対象

- `/settings/profile` におけるプロフィール情報の確認。
- 表示名の確認、編集、保存結果の確認。
- 登録メールアドレスの読み取り専用表示。
- 現在のログイン方法の読み取り専用表示。
- Auth user とアプリ内ユーザー情報の表示責務の整理。
- 取得中、取得失敗、保存中、保存成功、保存失敗のユーザー向け状態。
- 既存の言語設定を維持すること。

### 対象外

- メールアドレスの変更。
- ログイン方法の追加、変更、再認証、連携解除。
- アカウント削除。
- 言語設定の仕様変更。
- 表示名以外のプロフィール情報の更新。
- DB スキーマ、API 契約、認証方式、認証設定、権限モデル、RLS の変更を前提にした要求。
- Requirements / PRD での具体的なレイアウト、表示順、component、API 名、最終文言、実装手順の固定。
- この Goal 内での Design Doc 作成、実装、commit、PR 作成。

## Rule Selection

- Rule map: `docs/harness/rule-map.json`
- Classification:
  - path: `docs/ai-driven-development/workspaces/1552-profile-account-edit/requirements.md`, `apps/web/src/features/profile/**`, `apps/web/src/providers/supabase/**`, `apps/api/supabase/**`
  - domain: `user`, `auth`, `web-ui`
  - activity: `refine_requirements`, `change_user_behavior`, `change_auth_assumption`, `change_ui`, `change_form`
  - topic: `requirements`, `profile`, `settings`, `user`, `auth`, `forms`, `error-state`
- Selected:
  - `ai-driven.overview`: Goal、Requirements、Design の責務と成果物の関係を守るため。
  - `ai-driven.workflow`: Requirements で要求を定義し、後続 Design / Build へ渡す工程境界を守るため。
  - `ai-driven.issue-guidelines`: Issue #1552 を意図・境界の入力として扱い、実装詳細を Requirements に持ち込まないため。
  - `ai-driven.goal-templates`: Requirements の必須要素、Done、Verification、Stop を満たすため。
  - `architecture.overview`: Web と Supabase/API の役割分担を確認するため。
  - `infrastructure.overview`: Supabase Auth と PostgreSQL の利用前提を確認するため。
  - `domain.user`: Auth user、アプリ内ユーザー、email、`name`、`auth_user_id` の責務と更新可能範囲を守るため。
  - `policy.transaction-boundaries`: 1回の表示名保存で複数のデータ変更を勝手に追加せず、操作境界を後続 Design で判断するため。
  - `web.design-system-brand`: プロフィールと失敗状態を、安心して使える Savings の視覚・体験方針に整合させるため。
  - `web.design-rules`: UI の密度、状態表現、フォーム・エラーの詳細を後続 Design でルールに沿って決めるため。
- Depends-on:
  - `ai-driven.workflow` の前提として `ai-driven.overview`。
  - `ai-driven.issue-guidelines` と `ai-driven.goal-templates` の前提として `ai-driven.workflow`。
  - `infrastructure.overview` と `policy.transaction-boundaries` の前提として `architecture.overview`。
- Conflict decision: none。

## Domain Value Intent

| 値 | ユーザーが判断したいこと | Requirements 上の境界 |
| --- | --- | --- |
| 表示名 (`public.users.name`) | アプリ内で自分がどの名前として表示されるか、変更可能か | 表示用のプロフィール値として確認・編集する。本人確認、認証、権限判定には使わない。 |
| 登録メールアドレス | 現在ログインしているアカウントを識別できるか | 登録済みのemailを確認する。読み取り専用とし、変更やAuth userとの同期処理は対象外。 |
| ログイン方法 | 現在のアカウントがどの認証方法でログインしているか | 現在の認証方法を識別する。追加、変更、連携解除、再認証の操作は対象外。 |
| `auth_user_id` | Auth userとアプリ内ユーザーが同じアカウントに対応しているか | 内部の対応付けに使う値であり、ユーザー向けプロフィール値として表示しない。 |
| 編集可否・取得/保存状態 | どの情報を変更でき、操作が完了したか | 状態表示と操作を混同しない。失敗や未確定値を成功済みの値として見せない。 |

表示名、email、ログイン方法の具体的な表示順、レイアウト、コンポーネント、表示文言は Design / Plan で決める。email の表示元は、Auth user と `public.users` の責務を確認したうえで一貫した単一の値として扱い、2つの値を別々に表示して混乱を生まない。

## 機能要件

### FR-1: 現在のアカウント情報を確認できる

- 認証済みユーザーは、現在の Auth user に対応する自分のプロフィール情報だけを確認できる。
- 表示名、登録メールアドレス、ログイン方法は、それぞれの意味と編集可否を混同しない形で扱う。
- 別のユーザーの値、対応付けできない値、取得不能な値を現在のアカウント情報として表示してはいけない。

### FR-2: 表示名を確認・編集できる

- ユーザーは現在の表示名を確認できる。
- ユーザーは表示名だけを編集対象として変更できる。
- 保存操作の完了後、保存された表示名を確認できる。
- 表示名の変更はアプリ内の表示用プロフィール値に限り、Auth userの識別子、email、認証方式、権限、本人確認情報を変更しない。
- 保存失敗時は、変更が確定していないことを理解でき、成功済みの表示にならない。

### FR-3: 登録メールアドレスを読み取り専用で確認できる

- ユーザーは現在のアカウントに対応する登録メールアドレスを確認できる。
- email は読み取り専用として識別でき、編集・保存の対象にならない。
- email を表示名、ログイン方法、内部IDと同じ意味で扱ってはいけない。

### FR-4: ログイン方法を読み取り専用で確認できる

- ユーザーは現在のアカウントのログイン方法を確認できる。
- 現行のログイン導線である Google OAuth を、プロフィール上で変更可能な設定として扱わない。
- ログイン方法の追加、変更、連携解除、再認証に誘導する要求を追加しない。

### FR-5: 取得・更新状態を理解できる

- プロフィール情報の取得中は、未取得の値を確定済みの値として表示しない。
- プロフィール情報の取得に失敗した場合は、情報を確認できない状態と、必要な次の行動を理解できる。
- 表示名の保存中は、重複保存を防ぎ、保存が完了していないことを理解できる。
- 保存成功時は、変更が反映されたことを確認できる。
- 保存失敗時は、変更前の確定値と未保存の入力値を混同せず、入力値を不意に失わない。

### FR-6: 既存の言語設定を維持する

- プロフィール情報の追加表示・編集によって、既存の言語選択を利用できなくしてはいけない。
- 言語設定の値、保存方法、仕様は Issue #1552 の要求として変更しない。

### FR-7: データ責務と更新境界を拡張しない

- Auth user とアプリ内ユーザーの対応付けは既存の `auth_user_id` の責務を前提とする。
- クライアントから更新するプロフィール列は既存ルールどおり `name` に限る。
- 1回の表示名保存のために email、Auth user metadata、認証設定、権限、複数のユーザー情報を更新する要求を追加しない。
- 既存の読み取り・更新境界で実現できない場合は、Requirements の解釈で補わず Stop する。

## 非機能要件と制約

- 認証済みユーザーの情報だけを表示し、ユーザー間の情報混入を起こさない。
- 読み取り専用情報は、操作可能な入力や保存操作と誤認されない。
- loading、error、未確定、保存成功を、同じ状態に見せない。
- エラーは色だけに依存せず、ユーザーが何に失敗したかを理解できる状態にする。
- 既存の Savings の落ち着いた視覚トーンと、短く繰り返し使える設定画面の密度を守る。
- 新規依存、DBスキーマ変更、API契約変更、認証方式・設定変更、権限モデル変更をこのRequirementsの前提にしない。
- Issue #1552、selected refs、既存仕様から追跡できない要求や成功条件を追加しない。

## 受け入れ条件

- AC-1: 認証済みユーザーが `/settings/profile` を開くと、自分の表示名、登録メールアドレス、ログイン方法を確認できる。
- AC-2: 表示名の現在値を確認でき、表示名だけが編集可能だと識別できる。
- AC-3: 表示名を保存すると、保存結果を確認できる。保存に失敗した場合は成功済みの表示にならない。
- AC-4: 登録メールアドレスは確認できるが、編集・保存の操作対象にならない。
- AC-5: ログイン方法は確認できるが、追加・変更・連携解除の操作対象にならない。
- AC-6: 取得中、取得失敗、保存中、保存成功、保存失敗をユーザーが区別できる。
- AC-7: 取得・更新の失敗時に、別ユーザーの値や未確定値を現在のプロフィールとして表示しない。
- AC-8: 既存の言語設定を引き続き利用でき、Issue #1552 の変更によって言語設定の仕様が変わらない。
- AC-9: `name` は表示用プロフィール値として扱われ、認証、本人確認、権限判定の値として扱われない。
- AC-10: DBスキーマ、API契約、認証方式・設定、権限モデルの変更を必要とする場合は、このRequirementsを完了扱いにせず Stop できる。

## Q&Aログ

- Q: Issue #1552 はプロフィール画面を言語設定から置き換える要求か？
  - A: 置き換えではなく拡張である。既存の言語設定を維持し、アカウント情報の確認・表示名編集を追加する。
- Q: emailを変更できるようにするか？
  - A: しない。email変更はIssueの対象外であり、読み取り専用で確認する。
- Q: ログイン方法をプロフィールから変更できるようにするか？
  - A: しない。現在のログイン方法を確認するだけで、追加・変更・連携解除は対象外である。
- Q: 表示名はAuth userの名前や権限情報として扱うか？
  - A: 扱わない。`public.users.name` の表示用プロフィール値として扱い、本人確認・認証・権限判定には使わない。
- Q: emailの表示元はAuth userとアプリ内ユーザーのどちらか？
  - A: Requirementsでは、現在のAuth userに対応する登録メールアドレスを一貫した単一の値として確認できることを要求する。既存の責務と整合する具体的な読み取り元はDesign / Planで決める。同期やemail変更が必要になるならStopする。
- Q: 現行のGoogle OAuthを将来のログイン方法拡張まで要求するか？
  - A: しない。現行ログイン方法を識別できることだけを要求し、認証方式の追加・変更は対象外とする。
- Q: プロフィール情報の取得・保存に新しいDB/API/Auth変更が必要な場合はどうするか？
  - A: IssueのStop条件に従い、Requirements内で仕様を補完せず監督者へエスカレーションする。

## 技術的考慮事項

- Current Stateの根拠は、`apps/web/src/app/routes.ts`、`apps/web/src/features/profile/profileSettings/ProfileSettings/ProfileSettings.tsx`、`apps/web/src/providers/supabase/SupabaseSessionProvider.tsx`、`apps/web/src/utils/auth/useSupabaseSignIn.tsx` にある。
- Auth user とアプリ内ユーザーの対応付け、emailの一意性、`name` の更新可能範囲は `docs/harness/domain/user.md` と `apps/api/supabase/migrations/20260621000000_link_users_to_auth_users.sql` を根拠にする。
- 後続 Design / Plan では、既存の読み取り・更新境界で表示名の保存を完結できるか、Auth userとアプリ内ユーザーのemailの整合をどう確認するか、取得・保存失敗時の状態をどう表現するかを決める。
- 後続 Design / Plan では、具体的な表示順、フォーム構造、編集開始操作、保存操作、アクセシブルな名前、最終文言を決める。Requirementsではこれらを固定しない。
- Webアプリケーションコードを変更するBuild / Verifyでは、AGENTS.mdのWeb verification batchを実行する。Requirements作成自体にはアプリ検証を適用しない。

## Verification

この成果物はdocumentation-onlyのRequirements / PRDであり、アプリのformat、lint、typecheck、testは実行しない。次を手動確認する。

- Issue #1552の対象、対象外、制約、成功条件、Stop条件から要求が追跡できる。
- Current State / Current Gaps と Future Behavior が分離され、将来機能を現行動作として記述していない。
- 表示名、email、ログイン方法、編集可否、取得・保存状態のDomain Value Intentが整理されている。
- `domain.user`、Auth/PostgreSQLの前提、Web UIルールとの整合性を確認している。
- Requirements内で具体的なUI形状、実装方式、API名、スコープ外のデータ変更を決めていない。

## Stop条件

- 要件の意図、対象ユーザー、成功条件が複数解釈になり、Requirementsで一意に整理できない。
- Auth userとアプリ内ユーザーの責務、またはemailの表示元が既存仕様と矛盾する。
- 表示名以外の更新、DBスキーマ変更、API契約変更、認証方式・設定変更、権限モデル変更、RLS変更が必要になる。
- Auth userとアプリ内ユーザーのemailを一貫して扱うために、新しい同期処理や複数データ更新が必要になる。
- Issue #1552、Oversight Inputs、selected refsから追跡できない要求や成功条件を追加する必要がある。
- selected rule-map subgraphの選択が曖昧、またはRequirementsが選択したルール・ポリシーに違反する可能性がある。
