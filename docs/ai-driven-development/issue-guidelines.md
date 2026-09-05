---
title: AI Driven Development Issue Guidelines
doc_type: guide
status: accepted
area: repository
applies_to:
  - docs/ai-driven-development
  - tools/aidd
  - apps
topics:
  - ai-driven-development
when_to_read:
  - AIDDの実行契約と責務を確認するとき
---

# Issueの責務

Issueは人間がagentへ委任するintent、problem、desired outcomeの正本である。
背景、期待する結果、scope、制約、成功条件、任せる範囲を必要な精度で記載する。
実装ファイル、関数名、詳細手順、rule-mapと同じ語句の記載を必須にしない。

agentはrepositoryとguardrailを探索してTask contractとDecisionへ具体化する。
Issueが技術的な設計詳細を持たないことだけを停止理由にしない。
意図や受け入れ条件が複数に解釈でき、選択で成果が変わる場合は不足点を確認する。

技術選択、検証profile、representationはDecisionが所有する。新しいproduct intentは
既存Issueへ明示反映し、別Developmentから実装する。Learn用Issueは作らない。
Feature Request / Bug / Taskのテンプレート種別は意図を表すために選び、AIDD利用の選択肢にはしない。

## 記入と具体化の境界

Feature Requestには、背景・課題、期待する状態、対象／対象外、制約、成功条件、
委任範囲・完了地点を書く。ユーザーが判断したいことは期待する状態に含める。
参考案と必須条件を区別し、追加制約がない欄は「なし」「追加なし」と明記する。
未決事項は未決として残し、agentが推測したproduct intentを完成済みの要件にしない。

成功条件は「状況・操作に対して観測できる結果」として記載する。
例えば「月を切り替えると、その月の支払いだけが表示される」のように合否を判定できる粒度にする。
「期待挙動を満たす」「必要な検証ができる」だけでは、そのIssueの成功条件を定義したことにならない。
失敗時・空状態・維持する挙動は、その要望に関係する場合に記載する。
agentは記載された結果を具体的な検証caseへ展開し、実装手順や全テストケースの事前記入を要求しない。

実行依頼を受けたagentは、Issueの意図とrepositoryのguardrailをTask contractとDecisionへ具体化する。
通常の自律判断、確認条件、deliveryの既定値は[workflow](workflow.md)を正本とし、
Issueへ工程別の許可チェックや一律のStop一覧を複製しない。
空欄や未決事項はそれだけで停止理由にせず、成果や権限を変える不足かをworkflowの境界で判断する。
起票時点では実行を開始しない。既存Issueの明示された制限を記入漏れとみなして解除しない。

テンプレートや入力規則を変更するときは、技術詳細が未定でも成果が明確な場合、
委任内でDB/API変更が必要な場合、成果が変わる曖昧さ、スコープ・権限超過、
既存Issueの個別制限、完了地点の省略とPR提出指定を照合し、自律継続と確認の境界が一致するかレビューする。
