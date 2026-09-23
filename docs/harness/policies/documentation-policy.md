---
title: Documentation Policy
doc_type: policy
status: accepted
area: repository
applies_to:
  - docs
  - docs/harness
  - apps/web/docs
  - apps/api/docs
topics:
  - documentation
  - front-matter
  - agent-guidance
when_to_read:
  - ドキュメントを追加または更新するとき
  - Codexが参照するドキュメントを判断するとき
  - AGENTS.mdやdocs/harnessのドキュメント参照方針を変更するとき
---

# Documentation Policy

このリポジトリの恒常的なドキュメントは、front matter を使って対象領域と参照タイミングを明示します。

`AGENTS.md` は強制ルールとドキュメント探索の入口を定義します。`docs/harness/` は、AI agent が作業対象に応じて参照するガードレール文書と索引を定義します。各ドキュメントの front matter は、Codex や他の AI agent が現在の作業セッションで読むべき文書を選ぶための探索用メタデータとして扱います。

## 対象

front matter を付ける対象は、`docs/` と `apps/*/docs/` 配下の恒常ドキュメントです。

README、`AGENTS.md`、ローカルメモ、作業途中の一時ファイル、`.agents/skills/**` のskill定義は対象外です。

`docs/**` 配下のJSONやTOMLなど、Markdown正本から参照される機械可読contractもfront matterの対象外です。
機械可読contractはformat自身に`schema_version`と`kind`を持ち、その責務、更新条件、参照関係を
所有するMarkdown正本で定義します。機械可読contractをrule-mapの`rules[].file`へ直接登録して、
ルール本文の代わりにしてはいけません。

skill定義は正本ドキュメントではありません。workflow、policy、ADR、domain docs などの正本を作業時に適用させるための agent instruction として扱います。正本ドキュメント本文からskill定義を参照しません。`rule-map.json` で `.agents/skills/**` を扱う場合は、`rules[].file` ではなく `applies_to.paths` の作業対象 trigger に限定します。

## 標準項目

```yaml
---
title: Document Title
doc_type: overview
status: accepted
area: repository
applies_to:
  - docs
topics:
  - documentation
when_to_read:
  - ドキュメントを追加または更新するとき
---
```

- `title`: ドキュメント名。
- `doc_type`: `overview`, `adr`, `policy` などの文書種別。
- `status`: `accepted`, `draft`, `deprecated` などの状態。
- `area`: 主な対象領域。例: `repository`, `web`, `api`, `infrastructure`。
- `applies_to`: 関連するディレクトリ、アプリ、設定面。
- `topics`: 検索や関連判断に使う技術・概念。
- `when_to_read`: その文書を読むべき作業状況。

## 参照ルール

作業対象と判断に必要な文書を、`docs/harness/rule-map.json` と該当領域の front matter（`area`, `applies_to`, `topics`, `when_to_read`, `status`）から選びます。毎回すべてのdocsを走査したり、参照先を一括で読んだりせず、対象・判断・実行段階に応じて必要な本文を読みます。path/surface直接一致、`depends_on`、レビュー必須の参照は省略しません。

`status: deprecated` の文書は、廃止済みの挙動や移行経緯を調べる場合を除き、現在の実装方針の根拠にしません。

front matter は探索用メタデータであり、強制ルールではありません。必ず守るべきルールは `AGENTS.md` に置きます。複数文書の関係や依存を agent に辿らせる場合は、`docs/harness/rule-map.json` で索引化します。

## 文書の責務

恒常ドキュメントは、同じタイミングで参照される内容ではなく、同じ責務や判断対象に属する内容でまとめます。

複数の責務にまたがる内容は、1つの文書にまとめず、責務ごとに文書を分けて相互リンクします。

### 現行仕様と履歴

現在適用する仕様を所有する本文・契約・実装は、変更後の仕様へ直接更新します。無効になった前提や重複説明を現行ルールとして残し、末尾の例外・補足を順に読み合わせて現在の仕様を復元する構成にしません。関連する正本も同期し、現在の本文と必要な参照先から適用すべき仕様を理解できるようにします。

意思決定・検証時点を保存するGit履歴、採択済みADR、Task・checkpoint・検証証拠などは、その時点の内容を保持します。履歴の保存はADRに限定しません。固定記録は各契約に従う追記改訂や置き換え関係で新しい判断へ接続し、現在方針に合わせて過去の内容を削除・上書きしません。履歴が同じ文書にある場合も、現行仕様を示す本文・参照と履歴の責務を明確に分けます。

### 判断の移動・分割・置換と適用経路

判断を別文書へ移動・分割・置換するときは、対象作業から新しい正本へ到達する経路と、旧判断との優先関係を確認します。本文リンクは案内、`depends_on`は必須参照、`overrides`は競合解決を担います。本文リンクだけで必須選択や置換関係を同期したとは扱いません。

変更者は、移した判断の対象作業を基に、関係する索引の選択条件・依存・置換関係を同期します。レビューでは代表的な対象pathから選ばれる文書と依存closureを確認し、競合する判断は本文と置換関係を照合します。適用範囲を変更する場合は、その理由と対象外の例も確認します。

- 既存判断を新ADRで置き換える場合は、対象作業で新ADRが選ばれ、旧ADRの履歴を保持したまま競合する判断の優先関係が分かる状態にします。
- 正本を分割する場合は、それぞれの判断が必要な作業から対応する正本へ到達できる状態にします。単なる分割を競合や置換として扱いません。
- 説明や例の追加で判断の所有・適用経路が変わらない場合は、文書追加だけを理由に必須登録や置換関係を増やしません。

選択・参照関係を機械判定できる箇所は既存resolverの検証を使い、判断の意味と適用範囲は担当agentがレビューします。AIDDではこの確認を既存の[変更Coverage](../../ai-driven-development/change-coverage.md)とverification caseへ記録します。索引を変更しない場合も、関連する索引を検討対象に含め、既存経路で十分な理由を示します。

## Agent向け定義

`AGENTS.md` は共通の制約と作業別の入口、skillは特定の依頼を扱うためのadapter、正本文書は継続的な判断と契約を所有します。正本の手順を各入口へ複製せず、参照先と読む条件を示します。

- skillのdescriptionは主要な用途と発火条件を先頭に短く書きます。非発火条件は隣接skillとの誤選択を防ぐものに絞り、本文の手順や能力一覧を詰め込みません。
- 本文には成果、非自明な制約、判断に必要な情報を残します。複数modeの詳細は該当時に参照し、短い自己完結したskillに不要なrouterや別文書を増やしません。
- 手順の固定は権限、順序依存、検証証拠などの不変条件に限ります。委任内の技術判断や範囲内の修正・再検証を、追加承認や初回実装後の停止へ置き換えません。
- 定義の更新では、発火する依頼と隣接する非発火の依頼を照合し、参照先、権限、必須検証、完了条件を維持できているか確認します。文字数削減だけを品質や速度改善の証拠にしません。

参考: [Astra向けskillsとpromptsの見直し](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra)、[Build skills](https://learn.chatgpt.com/docs/build-skills)、[AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md)（2026-09-13確認）。複数modelが使う共通定義では、model固有の期待を根拠にrepositoryの不変条件を外しません。

## ADRの変更

ADRは意思決定時点の記録です。採択済みADRのDecision、Context、Consequences本文を後から現在方針に合わせて書き換えてはいけません。

既存ADRの補足が必要な場合は、日付付きのClarificationとして追記します。意思決定が変わる場合は、既存ADRを改変せず、新しいADRを作成して置き換え関係を明示します。

採択済みADRを含む差分では、PRのbase branchとのmerge-baseを基準に次を実行します。

```bash
python3 -B docs/harness/scripts/validate_accepted_adrs.py --repo-root . --base-ref origin/<base-branch>
```

validatorは指定したorigin remote-tracking branchとの単一merge-baseをbaselineにし、shallow historyと任意commit指定を拒否します。baselineで`doc_type: adr`かつ`status: accepted`の全文書を対象に、Context、Decision、Consequences、既存Clarificationのsource変更と文書の削除・移動を拒否します。既存履歴の末尾への日付付きClarification追記と、新しいADRの追加は許可します。
