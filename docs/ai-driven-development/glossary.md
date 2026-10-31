---
title: 開発用語と命名指針
doc_type: overview
status: accepted
area: repository
applies_to:
  - tools/harness
  - docs/ai-driven-development
topics:
  - ai-driven-development
  - aidd-v4
when_to_read:
  - 開発用語と命名の使い分けを判断するとき
---

# 開発用語と命名指針

## 開発方法・実行基盤・評価・改善

以下は公式用例を参考にした、このリポジトリでの使い分けである。各社共通の規格や一括置換の指示ではない。

| 概念                                                             | 呼称                                                              | このリポジトリで指すもの                                                         |
| ---------------------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| エージェントが調査・設計・実装・検証を進める開発                 | Agentic software development / エージェント中心のソフトウェア開発 | 開発全体の進め方。人が目的・制約を示し、成果を確認する                           |
| エージェントへの委任を前提に環境や仕事を設計する方針             | Agent-first development                                           | 開発の方針。すべての操作の自動承認を意味しない                                   |
| モデルを指示・ツール・作業環境・実行制御へつなぐ基盤             | Agent harness / エージェントハーネス                              | AGENTS.md、skills、規約索引、検査CLI、hook、CIなどの接続された仕組み             |
| 基盤や周辺環境を設計・改善する活動                               | Harness engineering / ハーネスエンジニアリング                    | ハーネスを作り、実行と評価から改善する仕事。開発方法全体の別名ではない           |
| 判断・動作を課題と観測結果に照合すること                         | Evaluation / 評価                                                 | 決定的な検査、意味レビュー、行動・分析evalを、それぞれの保証範囲で使う           |
| 結果やフィードバックから次回の指示・スキル・仕組みを更新する処理 | Self-improvement / 自己改善                                       | AuditやRetrospectiveの提案と、承認された更新。分析・evalだけで更新済みとはしない |

AI-driven development / AI駆動開発はAIを使う開発の広い説明語として扱う。
AIDDは従来のリポジトリ固有の略称であり、各社共通の標準略語とはしない。
AWSのAI-DLCはAWSが提示する方法論名で、このリポジトリの工程名へ採用しない。
自己改善はモデル再学習や無承認の自己書換えを必須とせず、実行権限は[Workflow](workflow.md)に従う。

## コードと文書の命名

名前は対象の責務から選ぶ。開発全体を表す`development`、基盤を表す`harness`、
検査の`checker`、評価の`evals`、指摘分析の`audit`、作業過程の振り返りの`retrospective`を使い分ける。
変数・関数も対象を示す名前にし、単に関連していることだけで`aidd`や`harness`を付けない。
名前の変更時はimport、CLI呼出し、hook、CIの呼出元、規約索引、文書の参照を同期する。
命名整理から、実行順序・保存契約・承認境界・アプリ機能の変更を導かない。

| 対象                                                                                       | 採用する名前・維持する名前                                | 理由                                                                                                                      |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 実行基盤のツール群                                                                         | `tools/aidd/`から`tools/harness/`へ改名                   | 検査CLI、評価器、任意の計測を含む基盤の実装で、開発方法そのものではない                                                   |
| Go moduleとimport                                                                          | `github.com/kosnu/savings/tools/harness/...`              | 実体の配置と一致させる                                                                                                    |
| 検査CLI                                                                                    | `cmd/aidd-checker`から`cmd/harness-checker`へ改名         | 規約・差分・検証・工程結果・stage・配信先を検査する。ハーネス全体を実行するCLIではない                                    |
| 検査CI                                                                                     | `harness_checker_ci.yaml` / Harness Checker CI            | CLIの配置、Vite+同期からのdispatch、テストを揃える                                                                        |
| CIのcommit status context                                                                  | `vite-plus/aidd-checker-ci`を維持                         | 外部から参照されうる識別子。workflow名の変更だけでstatus契約を変えない                                                    |
| 指摘分析と改善の正本                                                                       | `learning-extraction.md`から`audit.md`へ改名              | 旧Learn工程の抽出に限定しない。旧URLは現行正本への案内として残す                                                          |
| 規約索引の指摘分析ID                                                                       | `policy.audit`                                            | 正本の現在の責務に合わせ、依存edgeも同期する                                                                              |
| 内部識別子                                                                                 | `taskNamePattern`、`HARNESS_TEST_PR`、CIテストの`harness` | 作業名の受理条件と検査fixtureの役割を示す                                                                                 |
| `checker/internal/core`、`evals`、`session-metrics`                                        | 維持                                                      | 検査、評価、任意計測という別々の責務を既に表す                                                                            |
| `docs/harness/`、`.agents/skills/`、`.codex/`                                              | 維持                                                      | 規約と索引、skills、host設定という配置・ホスト契約に合う                                                                  |
| `docs/ai-driven-development/`、`aidd-checker*.md`、`ai-driven.*`のrule IDと`aidd-v4` topic | 維持                                                      | AIを使う開発の契約を所有する既存の文書群。公開リンク・採択済みADR・索引IDの互換性を保ち、表示名は現在の責務に合わせる     |
| `.aidd/v4/.../events/`、`aidd-phase-result-v1`、`aidd-metrics/usage.jsonl`                 | 維持                                                      | 既存の保存先・データ形式とその読取側の互換性を保つ。`events`は現行では工程結果の配置名で、操作eventの記録義務を意味しない |
| 採択済みADR、旧仕様、調査・移行・作業履歴                                                  | 当時の名前・本文・配置を維持                              | 過去の判断と証拠の保存であり、現在の命名へ書き換えない                                                                    |

## 運用上の用語

| 用語                  | 意味                                                                                |
| --------------------- | ----------------------------------------------------------------------------------- |
| Intent                | 人間が求める目的・成果・制約・完了条件・委任範囲とその出典                          |
| Task                  | 同じ成果への開発、Audit、承認された改善を保持する作業境界                           |
| Decision / checkpoint | 現在の採用判断と再開に必要な短い要約。作業工程の固定ではない                        |
| Evidence              | 実際の観測と実行結果。対象の内容・modeと結び付け、成否を要約する                    |
| Semantic review       | 意図・設計・規則の意味を基準と根拠で判断する評価                                    |
| Core                  | 実データと工程結果の鮮度・更新範囲を照合するGo検査                                  |
| Ship                  | 検証した担当差分のcommit・push・PR作成または更新と配信確認                          |
| Audit                 | Ship後の指摘と原因を分析し改善案を提示すること                                      |
| Retrospective         | Merge / Close後に作業過程を振り返り改善案を提示する独立工程。通常サイクルの外にある |
| ガードレール改善      | Audit提案への手動承認後、対象を改善して検証すること                                 |
| Goal                  | hostの進捗機能。Taskの権限や証拠、完了の代替ではない                                |

## 公式用例

- [OpenAI: Harness engineering](https://openai.com/index/harness-engineering/): agent-firstな開発で、環境・制約・フィードバックを設計する活動を説明する。
- [Anthropic: Harness design](https://www.anthropic.com/research/harness-design-long-running-apps): 長時間のagentic codingを支えるharnessの構成と評価を説明する。
- [Microsoft: Agent-first development](https://code.visualstudio.com/learn/foundations/introduction-to-agent-first-development): エージェントへ作業を委任する進め方と、モデルをツールや環境へつなぐharnessを説明する。
- [AWS: AI-Driven Development Life Cycle](https://aws.amazon.com/blogs/devops/ai-driven-development-life-cycle/): AIを中心にした独自の開発方法論AI-DLCを説明する。
