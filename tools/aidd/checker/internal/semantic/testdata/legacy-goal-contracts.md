# Historical Goal contracts

移行前の `354876bebd81bc53ab2c8ed0657d0f9d24740dcc:docs/ai-driven-development/workflow.md`
から保存した旧Requirements/Design Goal契約表。履歴形式の互換性検証だけに使用し、新規実行へ適用しない。

| Phase | Field | ID | Contract |
| --- | --- | --- | --- |
| Requirements | constraints | `task-context` | 最新Issue本文だけをTask Context正本として扱う。 |
| Requirements | constraints | `phase-boundary` | Requirements Goal内では実装しない。 |
| Requirements | stop | `validation-failure` | workspaceまたはRequirements Gateの検証が失敗した場合は停止する。 |
| Requirements | stop | `scope-ambiguity` | Issue本文から要求scopeを一意に決められない場合は停止する。 |
| Requirements | done | `complete-scope` | 最新Issue全体を覆うRequirementsと全要求IDを定義する。 |
| Requirements | done | `validated-artifact` | Requirements Gateと生成成果物の同期検証を成功させる。 |
| Design | constraints | `canonical-input` | 検証済みのcanonical requirements.jsonをread-only入力として扱う。 |
| Design | constraints | `phase-boundary` | Design Goal内では実装しない。 |
| Design | stop | `validation-failure` | Requirements再検証またはDesign Coverage Gateが失敗した場合は停止する。 |
| Design | stop | `scope-ambiguity` | 要求ごとの設計・検証scopeを一意に決められない場合は停止する。 |
| Design | done | `complete-scope` | 全Requirements IDとtask-owned範囲の完成状態を定義する。 |
| Design | done | `validated-artifact` | Design Coverage Gateと生成成果物の同期検証後にcompletion receiptを固定する。 |
