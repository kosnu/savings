// Package protocolは実行agentやGoalに依存しないAIDD vNext契約を所有する。
package protocol

import (
	"github.com/kosnu/savings/tools/aidd/checker/internal/model"
)

const Version = 5
const PolicyPath = "docs/ai-driven-development/contracts/protocol.json"
const TaskRoot = ".aidd/tasks"
const Generator = "aidd-checker/v5"

type Intent struct {
	Kind       string `json:"kind"`
	Reference  string `json:"reference"`
	Body       string `json:"body"`
	BodySHA256 string `json:"body_sha256"`
}

type Spec struct {
	Action        string   `json:"action"`
	SchemaVersion int      `json:"schema_version"`
	Kind          string   `json:"kind"`
	ID            string   `json:"id"`
	Intent        Intent   `json:"intent"`
	Objective     string   `json:"objective"`
	Constraints   []string `json:"constraints"`
	Done          []string `json:"done"`
	Verification  []string `json:"verification"`
	Delivery      string   `json:"delivery"`
	// Learnの変更許可は明示された依頼と有限scopeに固定する。
	Authorization    string                 `json:"authorization,omitempty"`
	AuthorizedScopes []model.OwnershipScope `json:"authorized_scopes,omitempty"`
}

type Policy struct {
	SchemaVersion        int                 `json:"schema_version"`
	Kind                 string              `json:"kind"`
	GuardrailPaths       []string            `json:"guardrail_paths"`
	ProductPaths         []string            `json:"product_paths"`
	RequiredVerification []VerificationRoute `json:"required_verification"`
	MixedJSON            []MixedJSONRule     `json:"mixed_json,omitempty"`
}

type MixedJSONRule struct {
	Path          string   `json:"path"`
	ProductFields []string `json:"product_fields"`
	GuardFields   []string `json:"guard_fields"`
}

type VerificationRoute struct {
	Paths    []string `json:"paths"`
	Profiles []string `json:"profiles"`
}

type File struct {
	Path   string `json:"path"`
	Type   string `json:"type"`
	Mode   string `json:"mode"`
	SHA256 string `json:"sha256"`
}

type Task struct {
	SchemaVersion int    `json:"schema_version"`
	Kind          string `json:"kind"`
	Spec          Spec   `json:"spec"`
	BaselineHead  string `json:"baseline_head"`
	Baseline      []File `json:"baseline"`
	Policy        []byte `json:"policy"`
	RuleMap       []byte `json:"rule_map"`
	Catalog       []byte `json:"catalog"`
	CheckerSHA256 string `json:"checker_sha256"`
}

type Requirement struct {
	ID       string `json:"id"`
	Text     string `json:"text"`
	Origin   string `json:"origin"`
	Evidence string `json:"evidence"`
}

type Decision struct {
	SchemaVersion   int               `json:"schema_version"`
	Kind            string            `json:"kind"`
	TaskSHA256      string            `json:"task_sha256"`
	Reason          string            `json:"reason"`
	Requirements    []Requirement     `json:"requirements"`
	Target          model.TargetState `json:"target_state"`
	AdditionalRules []string          `json:"additional_rules"`
}

type Checkpoint struct {
	SchemaVersion int      `json:"schema_version"`
	Kind          string   `json:"kind"`
	TaskSHA256    string   `json:"task_sha256"`
	Revision      int      `json:"revision"`
	ParentSHA256  string   `json:"parent_sha256"`
	Decision      Decision `json:"decision"`
	Rules         []string `json:"rules"`
}

type Evidence struct {
	SchemaVersion    int      `json:"schema_version"`
	Kind             string   `json:"kind"`
	TaskSHA256       string   `json:"task_sha256"`
	CheckpointSHA256 string   `json:"checkpoint_sha256"`
	RepositorySHA256 string   `json:"repository_sha256"`
	Files            []File   `json:"files"`
	ChangedPaths     []string `json:"changed_paths"`
	Verification     []byte   `json:"verification"`
	CheckerSHA256    string   `json:"checker_sha256"`
}

type Review struct {
	SchemaVersion    int    `json:"schema_version"`
	Kind             string `json:"kind"`
	TaskSHA256       string `json:"task_sha256"`
	CheckpointSHA256 string `json:"checkpoint_sha256"`
	EvidenceSHA256   string `json:"evidence_sha256"`
	Reviewer         string `json:"reviewer"`
	Authorization    string `json:"authorization"`
	Observations     string `json:"observations"`
}
