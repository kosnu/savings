---
title: AIDD v4 glossary
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
  - AIDD v4 glossaryを判断または変更するとき
---

# AIDD v4 glossary

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
