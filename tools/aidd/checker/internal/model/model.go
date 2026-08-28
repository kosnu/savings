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

type ArtifactDisplay struct {
	Path     string `json:"path"`
	Preamble string `json:"preamble"`
}

type GoalDisplay struct {
	Path    string              `json:"path"`
	Title   string              `json:"title"`
	Goal    string              `json:"goal"`
	Context GoalContext         `json:"context"`
	Done    []GoalContractEntry `json:"done"`
}

type GoalContext struct {
	Body        []string            `json:"body"`
	Constraints []GoalContractEntry `json:"constraints"`
	Stop        []GoalContractEntry `json:"stop"`
}

type GoalContractEntry struct {
	ID   string `json:"id"`
	Text string `json:"text"`
}

type RequirementsValidation struct {
	Mode                 string                       `json:"mode"`
	CycleStartIssueTitle string                       `json:"cycle_start_issue_title"`
	InputGate            RequirementsInputGate        `json:"input_gate"`
	CompletenessGate     RequirementsCompletenessGate `json:"completeness_gate"`
	Requirements         []Requirement                `json:"requirements"`
	Sections             []Section                    `json:"sections"`
}

type Requirement struct {
	ID        string `json:"id"`
	SectionID string `json:"section_id,omitempty"`
	Text      string `json:"text"`
}

type DesignValidation struct {
	Mode         string             `json:"mode"`
	Sections     []Section          `json:"sections"`
	TargetState  TargetState        `json:"target_state"`
	RuleCoverage RuleCoverage       `json:"rule_coverage"`
	CoverageGate DesignCoverageGate `json:"coverage_gate"`
}

type RequirementsInputGate struct {
	TaskContext TaskContext      `json:"task_context"`
	DirectRules []DirectRule     `json:"direct_rules"`
	DependsOn   []RuleDependency `json:"depends_on"`
}

type TaskContext struct {
	Source     string `json:"source"`
	Issue      string `json:"issue"`
	URL        string `json:"url"`
	UpdatedAt  string `json:"updated_at"`
	BodySHA256 string `json:"body_sha256"`
}

type DirectRule struct {
	ID              string    `json:"id"`
	IssueEvidence   string    `json:"issue_evidence"`
	Match           RuleMatch `json:"match"`
	Reason          string    `json:"reason"`
	ExplicitSurface string    `json:"explicit_surface,omitempty"`
}

type RuleMatch struct {
	Field string `json:"field"`
	Value string `json:"value"`
}

type RuleDependency struct {
	ID  string `json:"id"`
	Via string `json:"via"`
}

type Baseline struct {
	Source     string  `json:"source"`
	BodySHA256 *string `json:"body_sha256"`
}

type RequirementTransition struct {
	ID            string  `json:"id"`
	Status        string  `json:"status"`
	IssueEvidence *string `json:"issue_evidence"`
}

type RequirementRetirement struct {
	ID            string `json:"id"`
	IssueEvidence string `json:"issue_evidence"`
}

type RequirementsCompletenessGate struct {
	IssueBodySHA256 string                  `json:"issue_body_sha256"`
	Workspace       string                  `json:"workspace"`
	Baseline        Baseline                `json:"baseline"`
	Requirements    []RequirementTransition `json:"requirements"`
	Sections        []RequirementTransition `json:"sections"`
	Retired         []RequirementRetirement `json:"retired"`
}

type Section struct {
	ID      string  `json:"id"`
	Heading string  `json:"heading"`
	Blocks  []Block `json:"blocks"`
}

type Block struct {
	ID                 string   `json:"id"`
	Type               string   `json:"type"`
	Markdown           string   `json:"markdown,omitempty"`
	Role               string   `json:"role,omitempty"`
	OwnerID            string   `json:"owner_id,omitempty"`
	Text               string   `json:"text,omitempty"`
	ProductBehaviorIDs []string `json:"product_behavior_ids,omitempty"`
}

type DesignCoverageGate struct {
	RequirementsSHA256 string            `json:"requirements_sha256"`
	Workspace          string            `json:"workspace"`
	RequirementIDs     []string          `json:"requirement_ids"`
	Baseline           Baseline          `json:"baseline"`
	Coverage           []CoverageEntry   `json:"coverage"`
	BaselineSections   []BaselineSection `json:"baseline_sections"`
}

type CoverageEntry struct {
	ID                  string `json:"id"`
	DesignBlockID       string `json:"design_block_id"`
	VerificationBlockID string `json:"verification_block_id"`
}

type BaselineSection struct {
	SectionID     *string `json:"section_id"`
	Heading       string  `json:"heading"`
	ContentSHA256 string  `json:"content_sha256"`
	Status        string  `json:"status"`
	DesignBlockID string  `json:"design_block_id,omitempty"`
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
