---
title: AI Driven Development Workflow
doc_type: guide
status: accepted
area: repository
applies_to:
  - docs
  - apps/web
  - apps/api
topics:
  - ai-driven-development
  - codex-goal
  - workflow
  - prd
  - design-doc
  - pull-request
when_to_read:
  - AI駆動開発の工程を選ぶとき
  - Codex GoalをPRD、Design Doc、実装、提出準備、学習整理に分けるとき
  - ShipとLearn skillの役割を確認するとき
---

# AI Driven Development Workflow

このリポジトリでは、AI駆動開発のGoalを次の4工程に分けます。

1. Intent / Requirements Goal
2. Design / Plan Goal
3. Build / Verify Goal
4. Ship Goal

AIDDサイクルのTask Context正本は、サイクル開始時に取得した最新のIssue本文そのものとします。会話、レビューコメント、現在のdiff、前回のRequirements / Design Doc、直前に変更されたルール・ポリシーを、Issue本文に反映されていないTask Contextとして追加してはいけません。

この4工程と、Learnで対象Issue本文の変更案を整理する扱いは、Requirements / PRDとDesign Docを使うAI Driven Developmentサイクルに適用します。現在のタスクに関する既存のRequirements / PRDやDesign Docを入力にしない通常タスクでは、Build / Verify完了後という理由だけでレビュー修正をStopせず、[Review Feedback Classification](../harness/policies/review-feedback-classification.md) に従ってコメントごとに修正要否を判断します。

Build / Verifyは、Requirements / PRDとDesign Docを満たす実装と検証を完了する工程です。正常終了時に要件未達は残しません。工程中の検証失敗、型エラー、lint、実装整合性、変更漏れは工程内で解消します。Requirements / PRDまたはDesign Docが不足・矛盾して満たせない場合は、解釈で埋めずStop条件として扱います。

Shipは、Build / Verify済みの成果をPR、説明、レビュー返信ができる形へ整える工程です。要件充足の一次確認はBuild / Verifyで完了している前提にします。Shipは実装成果物へのレビュー指摘を修正する工程ではありません。

LearnはGoalではなく、Ship完了後、または上流成果物の不足・誤り・矛盾によってサイクルをStopした後に、ユーザーが必要に応じて手動実行するskillです。Build / Verifyが正常に完了した場合の次工程はShipであり、正常系の途中にLearnを挟みません。成果物レビュー、レビューコメント、検証結果、運用知見を、次のAIDD Task Context正本であるIssue本文の追加・変更案、ルール・ポリシーの追加・変更、または既存ルール・ポリシーのsharp化へ整理します。Issue本文の変更案は、Issueへ適用されるまで次サイクルのTask Contextではありません。

Stop条件を検出したphase Goalは、Goal tool contractが`status: blocked`への遷移を許可するまで未完了のまま同じblockerを報告し、Learnまたは別の工程を開始しません。許可された時点で`update_goal`を`status: blocked`で呼び出して終端化してからLearnへ進みます。新しいサイクルを回す場合は、前回の続きとして途中工程から再開せず、最新のIssue本文をTask Contextとして取得し、必ずIntent / Requirements Goalから始めます。最新ルールはTask Contextとは別にrule-mapから選択します。

同じIssueまたはタスクでは、サイクルをまたいで同じworkspaceとcanonical artifact pathを使います。新しいサイクルには新しいcycle IDだけを発行し、workspace名へ`v2`、`v3`、`version`、`revision`、`cycle`、`retry`、`rerun`などの派生markerを含めません。Issue-based cycleの開始前にGit `HEAD`とworktreeから同じIssue番号のworkspaceを検証し、1件なら必ず再利用、0件なら`<Issue番号>-<短いtitle>`で新規作成、複数なら統合先を暗黙に決めずStopします。Intent / Requirements Goalは`requirements.md`、Design / Plan Goalは`design-doc.md`への書き込みを所有し、新しいサイクルでは各pathの前サイクル内容を置き換えます。各生成工程は現在の上流入力全体を満たすcomplete replacementを作り、今回増えた内容やPR指摘だけへGoalまたは成果物のscopeを狭めません。Ship済みのサイクルはcommit済みであり、その内容はGit履歴で参照します。Stopしたサイクルの成果物はunstagedのまま保持し、次サイクルの生成工程で置き換えます。

前回成果物は新しいRequirementsのTask Contextではありません。ただし、作り直しで既存内容を意図せず欠落させないため、validatorは同じworkspaceのcanonical Requirements / Design DocをGit `HEAD`から自動取得してcontinuity baselineにします。呼び出し側はbaselineの有無や別ファイルを指定できません。差分は変更点を特定する補助情報であり、生成対象の全体scopeを置き換えません。

read-only境界は同一サイクルの後続工程にだけ適用します。現在サイクルで生成した`requirements.md`はDesign / Plan以降、`design-doc.md`はBuild / Verify以降でread-onlyです。成果物の不足、誤り、矛盾、レビュー指摘、検証結果、運用知見を反映する必要がある場合は、現在の工程で上流成果物を直さずStopし、`$learn`で対象Issue本文の変更案、ルール・ポリシーの追加・変更、または既存ルール・ポリシーのsharp化へ整理します。次サイクルの各生成工程では、対応する前サイクルの成果物を同じpathへ上書きします。

このフローはHuman on the loopを前提にします。AIはStop条件に当たらない限り次工程へ進み、人間は各工程の逐次承認ではなく、リスク監督、例外処理、最終的な公開可否を担います。

起点になるIssue本文は、Requirements / PRDのTask Context正本です。Issueには意図、境界、成功条件、Stop条件を書き、実装方針や作業手順はDesign / Plan Goalへ寄せます。詳細は [issue-guidelines.md](./issue-guidelines.md) を参照します。

## Harness Context

各Goalでは、作業対象を `path`, `domain`, `activity`, `topic` に分類し、[../harness/rule-map.json](../harness/rule-map.json) から読むべき文書サブグラフを選びます。

Goal本文には、選んだ関連ドキュメントと、選択理由を入力として含めます。すべての `docs/` を読むのではなく、`depends_on` で追加される前提文書を含む最小のサブグラフだけを参照します。

Intent / Requirementsでは、Issue本文から抽出した分類だけをdirect node選択の根拠にします。各direct nodeについて、根拠となるIssue本文の箇所、根拠内に同じ文字列で存在する`applies_to`の一致fieldと値、選択理由を記録します。`depends_on` nodeはdirect nodeからの推移的閉包を満たし、選択済みnodeからのedgeを記録します。候補実装、現在diff、前回artifact、review、会話上の近さ、ルールの更新時刻は選択根拠にしません。

実装・テスト・mockなどの具体的なsurfaceにだけ適用するpolicyは、Issue本文がそのsurfaceを明示的な制約として指定している場合を除き、Requirementsで先回りして選びません。Design / Plan以降は、現在サイクルのread-only artifactと具体化した変更対象pathから追加のnodeを選択できますが、そのnodeを根拠にRequirementsへ要求を遡及追加してはいけません。

各工程の完了時には、選択した文書サブグラフを使って、その工程の成果物、判断、差分、検証結果がルール・ポリシーに違反していないかを確認します。違反または違反の可能性がある場合、その工程は完了扱いにせず、工程内で解消できないものはStop条件として扱います。

## Context Packet

非自明なGoalでは、本文に長い調査メモやドキュメント本文をコピーせず、実行開始時の入力をContext Packetに圧縮します。

Context Packetは、Goal実行者が最初に読むべき最小の作業文脈です。広い探索を始める前に、決定的に絞れる情報は `rule-map.json`、front matter、path、Issue / PR番号、`rg` などで候補化します。必要な場合だけ、低コストの探索用サブエージェントに候補の確認や要約を任せます。

Context Packetには次だけを含めます。

- Scope: 対象成果物、対象外、変更してよい範囲。
- Task context: サイクル開始時に取得した最新Issue本文。Issue番号、URL、`updatedAt`、本文SHA-256を併記する。
- Selected refs: 読むべきファイル、rule-map ID、選択理由。
- Constraints: Issue、PRD、Design Doc、policy、domain ruleから来る制約。
- Known risks: 既知の不確実性、影響範囲、検証上の注意。
- Stop checks: 実行者が止まるべき条件。
- Verification expectations: 該当する検証の種類。コマンド全文は同じリポジトリ指示を読める場合は重複させません。

実行者はContext Packetから開始し、引用されたファイルだけを読むことを基本にします。Packetが不足、矛盾、またはStop条件を示す場合だけ、追加探索または人間への確認に進みます。

## Requirements Provenance / Completeness Gates

Intent / Requirements Goalを作成する前に、Task ContextとRule Selectionのprovenanceを検証します。

- Issue番号とworkspaceをworkspace identity validatorへ渡す。同じIssue番号の既存workspaceが1件ならその名前との完全一致を要求し、0件ならIssue番号prefixとversion/retry派生markerの不在を要求する。複数件は既存状態が曖昧なためStopする。
- GitHubから最新Issueの`owner/repo#number`、正規URL、`updatedAt`、本文を取得し、本文SHA-256を計算する。取得した識別子、URL、`updatedAt`をvalidatorへ独立した入力として渡し、Goalおよび成果物のmanifestと完全一致させる。
- GoalのTask Context sourceを`issue_body`だけに固定する。
- Issue本文以外のTask Context sourceが含まれる場合はGoalを作成しない。
- Goalと生成する`requirements.md`に同じRequirements Input Gateを記録し、両方をvalidatorで検証する。
- validatorへrepo rootとworkspaceを渡し、Git `HEAD`のcanonical `requirements.md`からbaselineを自動取得する。Goal作成者がbaselineの有無や取得元を選ばない。
- Requirements Goalと生成する`requirements.md`は最新Issue全体をscopeとし、今回追加または変更された内容だけへ狭めない。
- 前回と現在の各要求項目、および背景、対象ユーザー、ユーザーストーリー、スコープ、機能要件、非機能要件、受け入れ条件、Q&A、技術的考慮事項を`unchanged`、`changed`、`new`として追跡する。`unchanged`は正規化した内容hashの一致、`changed`と`new`は最新Issueの原文根拠を必須とする。
- 前回の要求IDを削除する場合は、ID自体と明示的な廃止・対象外表現を含む最新Issue原文をGateへ記録する。根拠なしの欠落をvalidatorで拒否する。
- validatorによる文字列存在確認は必要条件であり、意味的な十分条件ではない。引用したIssue原文がその要求項目またはsectionの変更・追加・廃止を一意に正当化しない場合はStopする。
- 最新Issue本文自身に安定要求IDがある場合、新Requirementsからの欠落をvalidatorで拒否する。
- Requirementsで選ぶ各direct rule-map nodeに、Issue本文中の根拠、`applies_to`の一致fieldと値、選択理由を付ける。一致値は正規化後のIssue根拠内に同じ文字列として存在しなければならず、翻訳、類義語、選択理由で補完しない。
- direct nodeの根拠をIssue本文へ追跡できない場合、そのnodeを除外する。必要なnodeか判断できなければStopする。
- direct nodeからの推移的`depends_on`閉包をすべて含める。各非direct dependencyは一度だけ記録し、選択済み`via` nodeからの実在edgeでdirect nodeへ接続する。閉包外のnodeは含めない。
- Requirementsのscope、機能要件、非機能要件、受け入れ条件、Q&A判断を、Issue本文または上記手順で選択したproduct / domain ruleへ追跡する。
- Requirements / PRDの各機能要件、非機能要件、受け入れ条件へ、それぞれ一意な`FR-*`、`NFR-*`、`AC-*`識別子と実質的な要約を付ける。IDだけの空定義や、Design / Planで全体coverageを機械検証できない無印の要求を残さない。
- 実装、テスト、mock、運用のpolicyはRequirementsの作り方を制約できるが、Issue本文から追跡できない新しいプロダクト要求や受け入れ条件を作ってはいけない。
- Requirements完了前にIssueの`updatedAt`または本文SHA-256が変わった場合は、古いsnapshotで完了せず、最新Issue本文からRequirementsをやり直す。

会話上の補足はOversight InputとしてStop判断やIssue更新要否の確認に使えます。意図、scope、制約、成功条件を変える場合は、先にIssue本文へ適用し、再取得した本文をTask Contextにします。

## 1. Intent / Requirements Goal

何を作るかを定義します。

この段階では、実装手順に寄せすぎません。AIはTask Context正本である最新Issue本文全体、既存仕様、コード、選択したドキュメントを調査してRequirements / PRDの完成版を作成します。今回追加・変更されたIssue内容はRequirementsへ統合する差分であり、Requirements Goalや成果物のscopeではありません。人間からの追加情報が意図、scope、制約、成功条件を変える場合は、Issue本文へ適用されるまでRequirements入力にしません。成果物は同じworkspaceのcanonical pathである`requirements.md`へ書き込みます。

error、empty、権限不足などの状態で、ユーザーに再試行、取消、確認、画面遷移などの操作を提供するかはRequirements / PRDで決めるプロダクト判断です。状態や失敗理由を表示する要求だけを、復帰操作も要求しているものとして扱ってはいけません。

主な成果物:

- 背景と課題
- 対象ユーザーと利用シーン
- ユーザーストーリー
- スコープ内 / 外
- 機能要件
- 非機能要件と制約
- 受け入れ条件
- Q&Aログ
- 技術的考慮事項

完了時チェック:

- snapshotしたIssue本文、選択したrule-mapサブグラフから、要求、制約、対象外、受け入れ条件が逸脱していないか確認する。
- Issue番号、URL、`updatedAt`、本文SHA-256が取得値、成果物、Goalで一致しているか確認する。
- Goalと成果物のRequirements Input Gateが同じIssue本文に対するvalidatorを通るか確認する。
- Goalと成果物のRequirements Completeness GateがGit `HEAD`のcanonical baselineと最新Issueに対するvalidatorを通り、要求項目または主要sectionを根拠なく欠落・変更していないか確認する。
- scope、機能要件、非機能要件、受け入れ条件、Q&A判断のsource provenanceが欠落していないか確認する。
- Requirements / PRD内のRule Selectionが、成果物内の判断と矛盾していないか確認する。
- 成果物が同じworkspaceのcanonical pathである`requirements.md`にあるか確認する。

止まる条件:

- 要件の意図が複数解釈できる
- 対象ユーザーや成功条件が不明
- 既存仕様と矛盾する
- スコープ外の変更が必要そう
- Requirements Goalまたは成果物が今回の差分だけへ狭められている、前回要求項目・主要sectionが根拠なく欠落または変更されている、またはRequirements Completeness Gateが失敗する

## 2. Design / Plan Goal

どう作るかを定義します。

現在サイクルの最新Requirements / PRD全体をもとに、AIが既存実装を調査し、実装方針、影響範囲、テスト方針、リスクを整理します。今回追加、変更された要求は設計へ統合する差分であり、Design / Plan GoalやDesign Docのscopeではありません。入力の`requirements.md`はread-onlyとし、Design / Planの都合で追記、修正、整形、リネームしてはいけません。成果物は同じworkspaceのcanonical pathである`design-doc.md`へ書き込みます。

Design / Plan Goalを作成する前に、現在の`requirements.md`のSHA-256と全`FR-*`、`NFR-*`、`AC-*`識別子をDesign Coverage Gateへ記録し、各ID専用の実質的な設計scopeと検証scopeをGate外へ記載します。Design Doc完了時は、各IDを専用の設計根拠と検証根拠へ一度ずつ対応付けます。複数IDの一括coverage、IDを含まない共通文、Gate内にしかない根拠は拒否します。

IDまたはheadingの文字列が根拠に含まれることは必要条件であり、意味的な十分条件ではありません。その根拠が特定要求または前回sectionを実際に解決していると判断できない場合はStopします。

validatorは前回Design Docも同じworkspaceのcanonical pathからGit `HEAD`で自動取得します。前回の全level-two sectionを、内容hashが一致する`preserved`または新Design根拠を持つ`replaced`として追跡します。前回Designは現在のRequirementsを拡張するTask Contextではなく、引き継ぐ判断は現在のRequirements、選択したrule-mapサブグラフ、既存実装に対して再検証します。

ユーザーが実行できる操作、画面遷移、再試行・取消・確認などの復帰経路を追加、変更、削除する判断は、プロダクト判断として扱います。Requirements / PRDの機能要件・受け入れ条件、または明示された正本ルールに追跡できない場合、Design / Planは一般的なUX、既存実装、既存パターンを根拠に補わずStopします。

主な成果物:

- 変更対象ファイル・モジュール
- 採用する実装方針
- 採用しない案と理由
- 既存挙動への影響
- 受け入れ条件と対応するテスト方針
- 全`FR-*`、`NFR-*`、`AC-*`と設計根拠・検証根拠の対応
- リスクと確認事項

完了時チェック:

- Requirements / PRD、選択したrule-mapサブグラフ、Design Docの実装判断が矛盾していないか確認する。
- Design Coverage GateがRequirementsの全識別子を含み、各識別子が専用の設計根拠と検証根拠へ一度ずつ対応し、Git baselineの全sectionが維持または置換として追跡されているか確認する。
- Design / Planで追加した実装方針、テスト方針、文言、操作境界がルール・ポリシーに違反していないか確認する。
- Design Docで追加、変更、削除するユーザー向け操作が、Requirements / PRDの機能要件・受け入れ条件、または明示された正本ルールに追跡できるか確認する。
- Design Docが同じworkspaceのcanonical pathである`design-doc.md`にあるか確認する。

止まる条件:

- 実装方針がプロダクト判断を含む
- ユーザー向け操作の根拠をRequirements / PRDまたは明示された正本ルールに追跡できない
- PRDの受け入れ条件が曖昧
- Requirementsの識別子が不足している、Design Goalが差分だけへ狭められている、要求別coverageや前回Design sectionの追跡が欠けている、またはDesign Coverage Gateが失敗する
- 影響範囲が想定より広い
- DB / API / 認証 / 権限変更が必要

## 3. Build / Verify Goal

最新のDesign Docに従って実装し、検証まで完了します。Build / Verify Goalを作成する前にRequirements Completeness GateとDesign Coverage Gateのartifact検証が成功していることを確認し、現在の上流入力全体を覆わない成果物から実装を開始しません。入力の `requirements.md` と `design-doc.md` は read-only とし、Build / Verify の都合で追記、修正、整形、リネームしてはいけません。

この段階では、AIに既存パターンに沿った実装判断、必要なテスト追加、小さな型修正や呼び出し側調整を任せます。一方で、新規依存、DB変更、API仕様変更、破壊的git操作が必要になった場合はStop条件としてエスカレーションします。

Build / Verifyは、Requirements / PRDとDesign Docを満たすまで実装と検証を行う工程です。正常終了時に要件未達は残しません。工程中のテスト失敗、型エラー、lint、実装整合性、変更漏れ、呼び出し側調整はこの工程内で修正して再検証します。Requirements / PRDまたはDesign Docの不足・矛盾で満たせない場合は、勝手に仕様を補わずStopします。

Build / Verifyが正常に完了した場合の次工程はShipです。Ship後の成果物フィードバックは、ユーザーが手動で`$learn`を実行して対象Issue本文の変更案、ルール・ポリシーの追加・変更、または既存ルール・ポリシーのsharp化へ整理します。Task Context変更案をIssueへ適用してから、新しいサイクルをRequirementsから始めます。

主な成果物:

- 実装差分
- 追加・更新されたテスト
- 検証結果

完了時チェック:

- Requirements / PRD、Design Doc、選択したrule-mapサブグラフ、実装差分、検証結果が矛盾していないか確認する。
- Requirements Completeness GateとDesign Coverage Gateが成功したRequirements / Design Docの組み合わせを入力にしているか確認する。
- ルール・ポリシー違反または違反の可能性がある場合、Build / Verifyは完了扱いにせず、この工程内で修正またはStopする。

止まる条件:

- Design Docと違う実装が必要
- Requirements Completeness GateまたはDesign Coverage Gateが失敗する、または生成成果物が上流入力全体を覆っていない
- スコープ外の変更が必要
- 受け入れ条件に矛盾がある
- 新規依存、DB変更、API仕様変更、破壊的git操作が必要
- 検証失敗が今回の変更と無関係

## 4. Ship Goal

Build / Verify済みの成果を提出できる形に整えます。

この工程は、PR作成、変更内容の要約、検証結果の記録、Ship範囲のレビューコメントへの返信、完了済みthreadのresolveを扱います。Requirements / PRDやDesign Docの判断を作り直したり、実装成果物へのレビュー指摘を修正したり、タスクコンテキストを整理したりしません。

Requirements、Design、Build / Verifyは各工程の成果物と検証を所有します。Shipは、フルサイクルまたは明示された提出作業で許可されたstage、commit、push、PRの状態遷移を所有します。AIDDフルサイクルでは対象差分のcommitまでをShipに含め、commit完了後にShip済みとして扱います。Ship Goalは定義済みのDoneとVerificationが満たされた時点で完了し、定義外の観測結果は補足情報として報告します。

主な成果物:

- PR本文
- 変更内容の要約
- PRD / Design Doc / 実装差分 / 検証結果の接続
- 受け入れ条件との対応
- 未確認事項・残リスク

完了時チェック:

- PR本文、変更要約、検証結果、レビュー返信、thread resolve判断が、Build / Verify済み成果と選択したrule-mapサブグラフに違反していないか確認する。
- Shipで要件充足判断、仕様判断、タスクコンテキストの作成をしていないか確認する。

止まる条件:

- 未解決の仕様判断が残っている
- 検証が未完了
- 差分にスコープ外変更が混じっている
- PR作成先、対象ブランチ、関連Issueが曖昧
- レビューコメントの対応が現在の差分やcommitに明確に紐づかない
- review threadをresolveすると未解決の追従作業や確認事項を隠すおそれがある

## Learn Skill

Ship完了後、または上流成果物の不足・誤り・矛盾によるサイクルStop後に、レビューコメント、検証結果、運用知見、変更された制約を、Issue本文の追加・変更案、ルール・ポリシーの追加・変更、または既存ルール・ポリシーのsharp化へ整理します。Learnはユーザーが手動で実行し、AIDDサイクルから自動実行しません。

このセクションはAI Driven DevelopmentサイクルでのLearnの使い方を定義します。AIDDに限定されない学びの定義と整理先は、[Learning Extraction](../harness/policies/learning-extraction.md) を正本とします。

LearnはGoalではないため、Goalを設定せず、実装もしません。LearnはPRDやDesign Docを直接変更せず、Task Context変更に分類したfindingは対象Issue本文への具体的な追加・変更案として返します。Issueへ適用されるまでAIDD Task Contextは変わりません。ルール・ポリシーの追加・変更または既存ルール・ポリシーのsharp化は、ユーザーが反映を明示した場合だけ正本へ適用します。前回実装コード、前回UI挙動、現在diff形状、前回実装由来の設計判断は、Requirements / Designの入力にしません。

Learnへ渡された各findingは学びとして扱い、次のうち1つを主な振り分け先にします。

1. タスクコンテキストの追加・変更としてのIssue本文変更案
2. ルール・ポリシーの追加・変更
3. 既存ルール・ポリシーのsharp化

同じ内容をIssue本文変更案とルールへ重複して記載しません。Issue本文変更案が新規または変更されたルールへ依存する場合は、内容を複製せず参照関係だけを示します。各findingは、指摘と理由、振り分け、反映先、具体的な変更が追跡できる関係構造で整理します。

workflow上の責務定義、工程上の位置づけ、禁止事項はこのセクションを正本とします。`$learn` の実行手順は、この責務定義に従います。

主な成果物:

- RequirementsのTask Context正本へ反映するIssue本文変更案
- 参照するレビューコメント、検証結果、監督制約
- 追加・変更またはsharp化するルール・ポリシー
- 入力findingと振り分け先の対応関係

完了時チェック:

- 対象Issue本文の変更案、参照するルール・ポリシー、監督制約が、選択したrule-mapサブグラフとLearnの禁止事項に違反していないか確認する。
- 前回実装コード、前回UI挙動、現在diff形状、前回実装由来の設計判断を入力化していないか確認する。
- 入力findingを欠落させず、各findingを3つの振り分け先のいずれかへ関係付けているか確認する。
- 対象Issue本文の変更案とルールに同じ内容を重複していないか確認する。

止まる条件:

- 3つの振り分け先から主な振り分けを選べない
- ルール・ポリシー更新が必要だが、更新対象が曖昧
- 前回実装を根拠にしないと入力を説明できない
- memory更新が必要だがユーザーの明示依頼がない

## 小さな変更では省略する

すべての変更を4工程に分ける必要はありません。

typo修正、軽微なログ追加、1文で差分を説明できる小さな変更など、現在のタスクに関する既存のRequirements / PRDやDesign Docを入力にしない変更は、PRDやDesign Docを独立Goalにしなくてよいです。

このような通常タスクのレビューコメントは、現在のIssueや依頼の範囲で修正要否を判断し、必要な修正だけをそのタスクまたはPR内で実施します。AI Driven Developmentサイクルの成果物フィードバックをLearnへ送るルールは適用しません。

通常タスクでも、レビューや検証から再利用可能な学びを抽出できます。harness-task内でタスクコンテキストの追加・変更、ルール・ポリシーの追加・変更、または既存ルール・ポリシーのsharp化へ整理しても、専用handoffとしてLearn skillを使っても構いません。

逆に、複数ファイルにまたがる変更、仕様判断を含む変更、初見の領域を触る変更、検証方法が重要な変更では、探索と計画を実装から分離します。
