---
version: alpha
name: Savings
description: 予算達成を支援する家計簿サービスのブランドと視覚方針。
colors:
  primary: "#9b86ea"
  primary-contrast: "#ffffff"
  primary-soft: "#f2f0ff"
  primary-strong: "#341f67"
  neutral: "#fcfcfd"
  surface: "#ffffff"
  text: "#1e1f24"
  text-subtle: "#62636c"
  border-subtle: "#d8d9e0"
  feedback-success: "green"
  feedback-warning: "yellow"
  feedback-info-light: "gray"
  feedback-info-dark: "gray"
  feedback-danger: "#e5484d"
typography:
  heading:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: 24px
    fontWeight: 600
    lineHeight: 1.25
  body:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: 14px
    fontWeight: 600
    lineHeight: 1.4
  value:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: 20px
    fontWeight: 600
    lineHeight: 1.3
rounded:
  sm: 4px
  md: 8px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
---

# Savings Design System

## Overview

Savings は、支出を責める家計簿ではない。予算達成を支援しながら、使って
よいお金を安心して使えるようにする家計簿サービスである。

主な利用者は、日々の支払い直後や月途中の確認で、短時間に判断したい個人
ユーザーである。画面は、長い分析よりも「今どう使えるか」をすぐ掴めること
を優先する。

UI は、節約を強制する警告や罪悪感ではなく、残額、差分、達成状況、次に
取れる操作を落ち着いて示す。ユーザーには「今どのくらい使えるか分かる」
「予算に近づけている」「必要な支出を判断できる」と感じてほしい。

この文書は、ブランドイメージと視覚トーンの上位方針を定義する。詳細な
Web UI のルールは `apps/web/docs/policies/design-rules.md`、ドメイン値の
意味は `apps/web/docs/policies/domain-ui-rules.md`、コンポーネント配置は
`apps/web/docs/policies/component-structure.md` に従う。実装の具体的な
構造、余白、variant、状態表現で迷う場合は、ブランド方針を保ったまま詳細
ルールを優先する。

## Colors

Savings は Radix Themes を実装上の UI 基盤として使う。手書きの色指定より
も、Radix のプロパティ、意味色、既存 CSS 変数を優先する。

Violet は Savings のブランドカラーであり、主要アクセント色である。お金を
使う体験に、高級感、高貴さ、スマートさを添えるために使う。支出を軽く見せ
るためではなく、予算内で使えるお金を前向きに、少し上質に感じられるように
するための色である。

主要操作、現在の選択、予算達成へ向かう状態に使う。装飾色ではなく、前向き
な行動を支える色として扱う。

Gray は静かなシステム色である。補助テキスト、未設定、低優先度操作、
区切り、スケルトン表示、主役にしない状態表示に使う。

Green は成功通知と、予算内に残額がある状態に使う。ユーザーを褒めすぎる
演出ではなく、計画内に余裕があることを落ち着いて示す色として扱う。

Yellow は注意を促す通知や、ユーザーが確認すべき状態に使う。失敗や危険の
色ではなく、予算超過のように安心して使える状態ではないことを知らせるため
の色として扱う。

Info の通知は中立的なお知らせとして扱い、成功、注意、失敗の意味を持たせ
ない。現行実装では `data-accent-color` を light/dark のテーマに応じて選ぶ。
現在はどちらも `gray` を使い、実際の明暗は Radix のテーマ変数に従う。

Red は危険操作、保存失敗、入力不正、実際の制約違反に限定する。支出を責め
るため、通常の超過を大げさに見せるため、すべての予算差分を警告化するため
には使わない。

## Typography

数字は装飾ではなくプロダクトの中核情報である。金額、残額、差分、月次合計
は、表情よりも先に読めることを優先する。

太い文字や大きな文字は、比較や判断を助ける場合だけ使う。ラベルや
補助テキストは、説明対象の金額と競合しない強さに抑える。

過大な見出し、大文字だけの強調、数字の装飾的なアニメーションは避ける。
日常的に使う明快な道具として見えることを優先する。

## Layout

レイアウトは、支払い登録、当月確認、カテゴリ別支出確認、予算調整といった
短く繰り返す流れを支える。判断に必要な値は、その値が影響する操作や比較
の近くに置く。

装飾カードや大きな空白よりも、一覧しやすい行、簡潔なフォーム、安定
した余白を優先する。モバイルでは読み順を保つ 1 列を基本にし、広い画面
では比較が容易になる場合だけ列を増やす。

予算に関わる画面では、実績額、予算額、残額、超過、未設定の関係を明確に
する。これらの状態が同じ意味に見えてはいけない。

## Elevation & Depth

奥行きは控えめに使う。通常のページ区画を、浮いた宣伝パネルのように見せ
ない。影や浮上表現は、ダイアログ、オーバーレイ、ポップオーバー、
スナックバーなどの一時的な面に限定する。

通常画面の階層は、余白、区切り線、文字階層、Radix の色調で表す。
重要な金額を見つけやすくしつつ、画面全体は落ち着かせる。

## Shapes

形状は Radix の `radius="medium"` を基本にする。角丸は近寄りやすさを持たせ
るために使い、UI を過度に遊び寄りにしたり、輪郭を弱めすぎたりしない。

完全な円形は、アイコンだけの円形操作など、形状そのものに意味がある場合
だけ使う。画面単位で独自の角丸を増やさない。

## Components

新しい見た目の基礎部品を作る前に、既存の Radix Themes コンポーネントと
ローカルの共有コンポーネントを使う。コンポーネントはデザインシステムを
再実装するのではなく、既存のプロパティ、トークン、レイアウトパターンで
プロダクト判断を表す。

この文書の `components` は、部品を作り直すための詳細仕様ではない。実装では
既存コンポーネントの import、props、variant を優先し、足りない場合だけ
機能別 Design Doc で理由を明示する。

主ボタンは、ユーザーが意図した予算管理や記録の流れを前へ進める操作に使う。
Gray や ghost の操作は、低優先度の移動、展開、取消に使う。危険操作は
破壊的操作や失敗状態に限定し、局所的に使う。

フォームは直接的な道具として見せる。明確なラベル、失敗時に消えない入力、
見えるエラー、1つの主送信操作を持つ。一覧とサマリーは、装飾の多様性より
比較と認識を優先する。

## Do's and Don'ts

- Do: 残り、変化、次に取れる操作を分かるようにする。
- Do: 使える範囲、残り、達成状況を前向きに表す。
- Do: ユーザーの計画内にある通常の支出は中立的に扱う。
- Do: violet は前向きな操作に、gray は落ち着いた補助文脈に使う。
- Don't: 支出を道徳的に悪いものとして見せない。
- Don't: 警告色を予算可視化の既定にしない。
- Don't: 通常画面に装飾的なヒーロー、宣伝文句、過大なカードを追加しない。
- Don't: この文書、`design-rules.md`、または明示的な機能別 Design Doc で
  説明できない視覚スタイルを導入しない。
