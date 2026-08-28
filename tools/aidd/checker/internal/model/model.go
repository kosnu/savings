package model

import "encoding/json"

const (
	CurrentSchemaVersion  = 4
	ProfileSchemaVersion  = 1
	ReceiptSchemaVersion  = 4
	EvidenceSchemaVersion = 4
)

type Source struct {
	SchemaVersion int             `json:"schema_version"`
	Kind          string          `json:"kind"`
	Workspace     string          `json:"workspace"`
	Display       json.RawMessage `json:"display"`
	Validation    json.RawMessage `json:"validation"`
}

type RequirementsValidation struct {
	Mode                 string          `json:"mode"`
	CycleStartIssueTitle string          `json:"cycle_start_issue_title"`
	InputGate            json.RawMessage `json:"input_gate"`
	CompletenessGate     json.RawMessage `json:"completeness_gate"`
	Requirements         []Requirement   `json:"requirements"`
	Sections             json.RawMessage `json:"sections"`
}

type Requirement struct {
	ID        string `json:"id"`
	SectionID string `json:"section_id,omitempty"`
	Text      string `json:"text"`
}

type DesignValidation struct {
	Mode           string          `json:"mode"`
	Sections       json.RawMessage `json:"sections,omitempty"`
	TargetState    TargetState     `json:"target_state"`
	RuleCoverage   RuleCoverage    `json:"rule_coverage"`
	CoverageGate   json.RawMessage `json:"coverage_gate"`
	Scopes         json.RawMessage `json:"scopes,omitempty"`
	BaselineScopes json.RawMessage `json:"baseline_scopes,omitempty"`
}

type RuleCoverage struct {
	ImplementationSurfaces []string         `json:"implementation_surfaces"`
	AdditionalRules        []AdditionalRule `json:"additional_rules"`
}

type AdditionalRule struct {
	ID     string `json:"id"`
	Reason string `json:"reason"`
}

type TargetState struct {
	ProductBehaviors  []ProductBehavior  `json:"product_behaviors"`
	VerificationCases []VerificationCase `json:"verification_cases"`
	OwnershipScopes   []OwnershipScope   `json:"ownership_scopes"`
	Representations   []Representation   `json:"representations"`
}

type ProductBehavior struct {
	ID            string `json:"id"`
	Type          string `json:"type"`
	Description   string `json:"description"`
	RequirementID string `json:"requirement_id"`
}

type VerificationCase struct {
	ID                    string    `json:"id"`
	Type                  string    `json:"type"`
	RequirementID         string    `json:"requirement_id"`
	ProductBehaviorIDs    []string  `json:"product_behavior_ids"`
	VerificationProfileID string    `json:"verification_profile_id,omitempty"`
	Selector              *Selector `json:"selector,omitempty"`
	Procedure             string    `json:"procedure,omitempty"`
}

type Selector struct {
	Kind string `json:"kind"`
	Path string `json:"path,omitempty"`
	Name string `json:"name,omitempty"`
}

type OwnershipScope struct {
	Path string `json:"path"`
	Kind string `json:"kind"`
}

type Representation struct {
	ID                  string   `json:"id"`
	Kind                string   `json:"kind"`
	Path                string   `json:"path"`
	Locator             Locator  `json:"locator"`
	RequirementID       string   `json:"requirement_id"`
	ProductBehaviorIDs  []string `json:"product_behavior_ids"`
	VerificationCaseIDs []string `json:"verification_case_ids"`
}

type Locator struct {
	Kind string `json:"kind"`
	Name string `json:"name,omitempty"`
}

type ProfileCatalog struct {
	SchemaVersion int                   `json:"schema_version"`
	Profiles      []VerificationProfile `json:"profiles"`
}

type VerificationProfile struct {
	ID               string   `json:"id"`
	Contract         string   `json:"contract"`
	Runner           string   `json:"runner"`
	SelectorKind     string   `json:"selector_kind"`
	SelectorRoot     string   `json:"selector_root"`
	WorkingDirectory string   `json:"working_directory"`
	Argv             []string `json:"argv"`
}

type HashValue[T any] struct {
	SHA256 string `json:"sha256"`
	Value  T      `json:"value"`
}

type PathHash struct {
	Path   string `json:"path"`
	SHA256 string `json:"sha256"`
}

type SelectedProfile struct {
	ID     string `json:"id"`
	SHA256 string `json:"sha256"`
}

type ProfileReceipt struct {
	Path     string            `json:"path"`
	SHA256   string            `json:"sha256"`
	Selected []SelectedProfile `json:"selected"`
}

type IssueReceipt struct {
	ID         string `json:"id"`
	Title      string `json:"title"`
	URL        string `json:"url"`
	UpdatedAt  string `json:"updated_at"`
	BodySHA256 string `json:"body_sha256"`
}

type SelectedRule struct {
	ID     string `json:"id"`
	Path   string `json:"path"`
	SHA256 string `json:"sha256"`
}

type BuildBaseline struct {
	Head string `json:"head"`
}

type UntrackedEntry struct {
	Path   string `json:"path"`
	Type   string `json:"type"`
	Mode   string `json:"mode"`
	SHA256 string `json:"sha256"`
}

type ArtifactPair struct {
	Source  PathHash `json:"source"`
	Display PathHash `json:"display"`
}

type ReceiptArtifacts struct {
	Requirements ArtifactPair `json:"requirements"`
	Design       ArtifactPair `json:"design"`
}

type Receipt struct {
	SchemaVersion        int                         `json:"schema_version"`
	Kind                 string                      `json:"kind"`
	Workspace            string                      `json:"workspace"`
	Issue                IssueReceipt                `json:"issue"`
	DesignGoalSHA256     string                      `json:"design_goal_sha256"`
	RuleMap              PathHash                    `json:"rule_map"`
	SelectedRules        []SelectedRule              `json:"selected_rules"`
	VerificationProfiles ProfileReceipt              `json:"verification_profiles"`
	RuleCoverage         HashValue[RuleCoverage]     `json:"rule_coverage"`
	TargetState          HashValue[TargetState]      `json:"target_state"`
	OwnershipScopes      HashValue[[]OwnershipScope] `json:"ownership_scopes"`
	BaselineInventory    HashValue[[]string]         `json:"baseline_inventory"`
	UntrackedBaseline    HashValue[[]UntrackedEntry] `json:"untracked_baseline"`
	BuildBaseline        BuildBaseline               `json:"build_baseline"`
	Artifacts            ReceiptArtifacts            `json:"artifacts"`
}

type RuntimeIdentity struct {
	Kind string `json:"kind"`
	Path string `json:"path,omitempty"`
	Name string `json:"name,omitempty"`
	ID   string `json:"id,omitempty"`
}

type VerificationResult struct {
	ID                    string            `json:"id"`
	Type                  string            `json:"type"`
	Status                string            `json:"status"`
	VerificationProfileID string            `json:"verification_profile_id,omitempty"`
	ProfileSHA256         string            `json:"profile_sha256,omitempty"`
	Selector              *Selector         `json:"selector,omitempty"`
	ExecutedIdentities    []RuntimeIdentity `json:"executed_identities,omitempty"`
	ExitCode              *int              `json:"exit_code,omitempty"`
	StdoutBytes           *int              `json:"stdout_bytes,omitempty"`
	StderrBytes           *int              `json:"stderr_bytes,omitempty"`
	OutputSHA256          string            `json:"output_sha256,omitempty"`
	FinalStateSHA256      string            `json:"final_state_sha256"`
	Procedure             string            `json:"procedure,omitempty"`
	Observation           string            `json:"observation,omitempty"`
}

type BuildEvidence struct {
	SchemaVersion    int                  `json:"schema_version"`
	Kind             string               `json:"kind"`
	Workspace        string               `json:"workspace"`
	ReceiptSHA256    string               `json:"receipt_sha256"`
	CatalogSHA256    string               `json:"catalog_sha256"`
	FinalStateSHA256 string               `json:"final_state_sha256"`
	Generator        string               `json:"generator"`
	Results          []VerificationResult `json:"results"`
}
