---
title: AIDD v4の調査と採否
doc_type: overview
status: accepted
area: repository
applies_to:
  - tools/aidd
  - docs/ai-driven-development
topics:
  - ai-driven-development
  - aidd-v4
when_to_read:
  - AIDD v4の調査と採否を判断または変更するとき
---

# AIDD v4の調査と採否

調査日: 2026-09-25。以下は各提供者・著者の一次資料を比較した設計判断であり、
製品の優劣や一般的な成功率の測定ではない。資料の例を共通規約へ直輸入しない。
旧版との互換は要求されていない。Goという実装言語とリポジトリのガードレールはユーザー制約である。

## 比較と採否

| 手法・資料の時点                                                                                                                                                                                                                                                                      | 解決する問題・適用条件                                       | 限界・異なる見解                                                                              | v4の判断                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Harness engineering、OpenAI 2026-02-11 [資料](https://openai.com/index/harness-engineering/)                                                                                                                                                                                          | Intentを実行可能にする環境、ツール、観測可能性、ガードレール | 大規模な自律開発の経験。文書量やagent数がそのまま必要条件ではない                             | 短い入口、必要時の文脈取得、検査可能な不変条件を採用。固定工程は要求しない                     |
| モデル能力に応じたprompt、OpenAI 2026-09-11 [Astra](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra)、Anthropic [Fable](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5)（継続更新、調査日に確認） | 目的と完了条件を与え、範囲内の判断を委ねる                   | モデル依存の傾向。ガードレールを省く根拠ではない                                              | Intentと権限を明示。逐次指示、毎回の計画承認、全資料読込を不採用                               |
| Long-running harness、Anthropic [2025-11-26](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)、[2026-03-24](https://www.anthropic.com/engineering/harness-design-long-running-apps)                                                                 | 長期実行の進捗保持、実環境での評価                           | 後続モデルでは以前のsprint構成を省ける。評価agentも誤判断する                                 | 再開記録・動作証拠を採用。planner/generator/evaluatorの常設は不採用                            |
| Loop engineering、[IBM 2026-07-17](https://www.ibm.com/think/topics/loop-engineering)、[Huntley 2026-01-17](https://ghuntley.com/loop/)                                                                                                                                               | 行動・観測・調整と持続する状態で一回限りの生成から抜ける     | 名称は標準仕様ではない。反復数や自律性だけで品質は上がらない。単一agentの反復という設計もある | 失敗の修正・観測を継続し、証拠と権限を停止条件にする。無制限再試行は採用しない                 |
| Context engineering、[Anthropic 2025-09-29](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)                                                                                                                                                        | 有限contextで必要な情報を維持する                            | 圧縮は出典や未解決事項を落とし得る                                                            | Intent、判断、証拠の永続記録と再取得。要約を正本にしない                                       |
| 仕様駆動、[GitHub Agentic SDD](https://github.github.com/spec-kit/reference/agentic-sdd.html)（継続更新、調査日に確認）                                                                                                                                                               | 期待する動作と実装の照合                                     | 仕様を細かく固定すると誤った仕様にも忠実になる                                                | Intentの完了条件と実成果を照合。ツール固有コマンドや文書の定型段階は移植しない                 |
| 評価・フィードバック、[Anthropic 2026-01-09](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)                                                                                                                                                                  | 再現可能な条件と意味評価の使い分け                           | judgeの評価誤差・基準との不一致。手順への過適合                                               | 機械判定はGo、意味評価は基準と根拠。unknownを保持し、重要な不一致は人間へ                      |
| ツール設計、[Anthropic 2025-09-11](https://www.anthropic.com/engineering/writing-tools-for-agents)                                                                                                                                                                                    | agentが理解して修正できる結果・エラー                        | APIの多機能化や大量出力は理解を妨げる                                                         | 少数の操作、再開可能な状態、修復可能なエラー。外部評価サービス依存なし                         |
| 多agent、[Cursor 2026-01-14](https://cursor.com/blog/scaling-agents)、[2026-07-20](https://cursor.com/blog/agent-swarm-model-economics)                                                                                                                                               | 大規模実験の協調・context分離                                | flatな共有作業や調整コスト、規模と推論費の差。小規模Taskへの一般化はできない                  | 独立問題・重大リスクに具体的便益がある場合のみ分担。agent数や役割をprotocolに固定しない        |
| Behavioral eval、[Google 2026-09-09](https://developers.googleblog.com/the-anatomy-of-harness-engineering-how-to-evaluate-iterate-and-guard-ai-coding-agents/)                                                                                                                        | 全体スコアだけでは分からない失敗を観測・回帰検出             | 複雑な作業に厳密なtool sequenceは不適切。確率的な単発evalはPR gateを不安定にする              | 実際の利用と少数の重要な失敗シナリオから開始。Goの境界テストと意味評価を併用                   |
| 自動harness最適化の評価、[研究v2 2026-08-27](https://arxiv.org/abs/2607.12227)                                                                                                                                                                                                        | 改善が設計によるのか探索予算によるのかを区別                 | Terminal-Bench 2.1、GPT-5.4/Opus 4.6に限定したpreprint。一般化は未確定                        | 同じ事例で改善と評価を兼ねた成功宣言を避ける。新しい事例と費用も確認。自動自己改変は採用しない |

## リポジトリでの具体化

1. 成果と許可を人間が示し、手順をagentが選ぶ。Goは意味を理解したという判定をしない。
2. decisionの改訂、検証出力、内容とmodeの鮮度、stageとの一致を追跡する。状態を通すために証拠を書き換えない。
3. Ship後の振り返りをAuditとして明示する。Audit結果だけではガードレールを書き換えない。
4. 承認を特定提案と対象に結び付ける。同じTaskの下で改善し、別Task化で承認境界を回避しない。
5. 失敗した検証、古い証拠、承認なし、承認範囲外、再開をGoテストで確認する。
   それと別に、このIssue自身の変更・検証・レビュー・配信・Auditを記録する。
   テスト用承認は実際のユーザー承認とは区別する。

## 更新・廃止の扱い

調査時に上記ページの本文と公開日・更新表示を確認した。更新日を特定できない継続更新文書はその旨を示す。
OpenAIのgradersページは廃止案内への懸念があるため設計根拠と依存先から除外した。
ベンダーのEvals APIをprotocolの動作条件にしない。将来のmodel更新時には同じIntentと反例で
観測し、権限・停止条件を維持したまま不要になった仕組みを削減する。
この比較の採否はリポジトリ固有の推論であり、引用元がv4を検証したという主張ではない。
