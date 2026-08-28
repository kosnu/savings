package phasecontract

import (
	"bytes"
	"context"
	"slices"
	"sort"
	"strings"

	"github.com/pelletier/go-toml/v2"

	"github.com/kosnu/savings/tools/aidd/checker/internal/diagnostic"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
)

const (
	ID                   = "aidd-phase-execution-v1"
	contractRelativePath = "docs/ai-driven-development/contracts/phase-execution-contract.toml"
	parentSkillPath      = ".agents/skills/aidd-cycle/SKILL.md"
	goalSettingSkillPath = ".agents/skills/goal-setting/SKILL.md"
	projectConfigPath    = ".codex/config.toml"
	operationsPath       = "docs/ai-driven-development/aidd-checker-operations.md"
	validatorCommand     = "/tmp/aidd-checker validate-phase-contract --repo-root ."
	toolchainRequirement = "Go 1.27.x"
)

var (
	delegatedPhases           = []string{"Requirements", "Design", "Build"}
	goalTools                 = []string{"get_goal", "create_goal", "update_goal"}
	delegatedResponsibilities = []string{"phase_outputs", "verification_evidence"}
	forbiddenResponsibilities = []string{"goal_lifecycle", "goal_setting", "phase_transition", "learn", "delegation"}
	commonForbidden           = []string{"get_goal", "create_goal", "update_goal", "goal-setting"}
	bootstrapCommands         = []string{
		"go env GOVERSION",
		"go build -C tools/aidd/checker -o /tmp/aidd-checker.next ./cmd/aidd-checker",
		"mv /tmp/aidd-checker.next /tmp/aidd-checker",
		"/tmp/aidd-checker version",
	}
	forbiddenByAgent = map[string][]string{
		"aidd-requirements-design": append(append([]string{}, commonForbidden...), "build", "ship", "learn", "commit", "push", "pull request", "pr", "spawn_agent", "delegate", "delegated", "delegation", "later phase", "next phase"),
		"aidd-build":               append(append([]string{}, commonForbidden...), "ship", "learn", "commit", "push", "pull request", "pr", "spawn_agent", "delegate", "delegated", "delegation", "later phase", "next phase"),
	}
	canonicalPhases = []phase{
		{Name: "Requirements", Executor: "aidd-requirements-design", Configuration: ".codex/agents/aidd-requirements-design.toml", Delegated: true, GoalAccess: "forbidden"},
		{Name: "Design", Executor: "aidd-requirements-design", Configuration: ".codex/agents/aidd-requirements-design.toml", Delegated: true, GoalAccess: "forbidden"},
		{Name: "Build", Executor: "aidd-build", Configuration: ".codex/agents/aidd-build.toml", Delegated: true, GoalAccess: "forbidden"},
		{Name: "Ship", Executor: "parent agent", Configuration: "current selection", Delegated: false, GoalAccess: "owner"},
	}
)

type contract struct {
	ID                                   string              `toml:"id"`
	Version                              int                 `toml:"version"`
	GoalLifecycle                        goalLifecycle       `toml:"goal_lifecycle"`
	GoalSetting                          goalSetting         `toml:"goal_setting"`
	Delegation                           delegation          `toml:"delegation"`
	AgentInstructions                    map[string]string   `toml:"agent_instructions"`
	AgentInstructionForbiddenIdentifiers map[string][]string `toml:"agent_instruction_forbidden_identifiers"`
	Phases                               []phase             `toml:"phases"`
}

type goalLifecycle struct {
	Owner string   `toml:"owner"`
	Tools []string `toml:"tools"`
}

type goalSetting struct {
	Owner      string `toml:"owner"`
	Entrypoint string `toml:"entrypoint"`
}

type delegation struct {
	Phases                    []string `toml:"phases"`
	AllowedResponsibilities   []string `toml:"allowed_responsibilities"`
	ForbiddenResponsibilities []string `toml:"forbidden_responsibilities"`
}

type phase struct {
	Name          string `toml:"name"`
	Executor      string `toml:"executor"`
	Configuration string `toml:"configuration"`
	Delegated     bool   `toml:"delegated"`
	GoalAccess    string `toml:"goal_access"`
}

type projectConfig struct {
	Agents map[string]agentRegistration `toml:"agents"`
}

type agentRegistration struct {
	Description string `toml:"description"`
	ConfigFile  string `toml:"config_file"`
}

type agentConfig struct {
	Name                  string `toml:"name"`
	Description           string `toml:"description"`
	Model                 string `toml:"model"`
	ModelReasoningEffort  string `toml:"model_reasoning_effort"`
	DeveloperInstructions string `toml:"developer_instructions"`
}

type assignment struct {
	Phase         string
	Executor      string
	Configuration string
}

func Validate(ctx context.Context, repoRoot string) error {
	snapshot, err := repository.Open(ctx, repoRoot)
	if err != nil {
		return err
	}
	defer snapshot.Close()
	value, err := loadContract(snapshot, contractRelativePath)
	if err != nil {
		return err
	}
	if err := validateContract(value); err != nil {
		return err
	}

	if _, err := snapshot.Read(operationsPath); err != nil {
		return err
	}
	parentSkill, err := readText(snapshot, parentSkillPath)
	if err != nil {
		return err
	}
	if err := requireContractReference(parentSkill, "parent skill"); err != nil {
		return err
	}
	if err := requireValidatorCommand(parentSkill, "parent skill"); err != nil {
		return err
	}
	if err := requireBootstrapCommands(parentSkill, "parent skill"); err != nil {
		return err
	}
	expectedAssignments := make([]assignment, 0, len(value.Phases))
	for _, item := range value.Phases {
		expectedAssignments = append(expectedAssignments, assignment{item.Name, item.Executor, item.Configuration})
	}
	actualAssignments, err := parseAssignmentTable(parentSkill)
	if err != nil {
		return err
	}
	if !slices.Equal(actualAssignments, expectedAssignments) {
		return failure(parentSkillPath, "phase assignment table does not match the canonical contract", expectedAssignments, actualAssignments)
	}

	goalSettingSkill, err := readText(snapshot, goalSettingSkillPath)
	if err != nil {
		return err
	}
	if err := requireContractReference(goalSettingSkill, "goal-setting skill"); err != nil {
		return err
	}
	if err := requireValidatorCommand(goalSettingSkill, "goal-setting skill"); err != nil {
		return err
	}
	if err := requireBootstrapCommands(goalSettingSkill, "goal-setting skill"); err != nil {
		return err
	}

	var config projectConfig
	if err := loadTOML(snapshot, projectConfigPath, &config, false); err != nil {
		return err
	}
	var rawConfig map[string]any
	if err := loadTOML(snapshot, projectConfigPath, &rawConfig, false); err != nil {
		return err
	}
	if config.Agents == nil {
		return failure(projectConfigPath, "project config must define agent registrations", "[agents]", nil)
	}
	checked := map[string]struct{}{}
	for _, item := range value.Phases {
		if !item.Delegated {
			continue
		}
		registration, ok := config.Agents[item.Executor]
		if !ok {
			return failure(projectConfigPath, "delegated agent is not registered", item.Executor, nil)
		}
		if err := validateRegistrationShape(rawConfig, item.Executor); err != nil {
			return err
		}
		expectedConfig := registrationPath(item.Configuration)
		if registration.ConfigFile != expectedConfig {
			return failure(projectConfigPath, "agent config_file does not match the phase contract", expectedConfig, registration.ConfigFile)
		}
		if strings.TrimSpace(registration.Description) == "" {
			return failure(projectConfigPath, "delegated agent registration must define description", "non-empty description", registration.Description)
		}
		if _, exists := checked[item.Executor]; exists {
			continue
		}
		checked[item.Executor] = struct{}{}

		if _, err := repository.ValidateRelativePath(item.Configuration); err != nil {
			return failure(item.Configuration, "agent configuration path is invalid", "canonical repository-relative path", err.Error())
		}
		var configured agentConfig
		if err := loadTOML(snapshot, item.Configuration, &configured, true); err != nil {
			return err
		}
		if configured.Name != item.Executor {
			return failure(item.Configuration, "agent config name does not match its executor", item.Executor, configured.Name)
		}
		if strings.TrimSpace(configured.DeveloperInstructions) == "" {
			return failure(item.Configuration, "agent must define developer_instructions", "non-empty instructions", configured.DeveloperInstructions)
		}
		if strings.TrimSpace(configured.Description) == "" || strings.TrimSpace(configured.Model) == "" || strings.TrimSpace(configured.ModelReasoningEffort) == "" {
			return failure(item.Configuration, "agent config must define description, model, and model_reasoning_effort", "non-empty known fields", configured)
		}
		if err := requireContractReference(configured.DeveloperInstructions, "agent "+item.Executor); err != nil {
			return err
		}
		if err := requireOperationsReference(configured.DeveloperInstructions, "agent "+item.Executor); err != nil {
			return err
		}
		for _, identifier := range value.AgentInstructionForbiddenIdentifiers[item.Executor] {
			if containsIdentifier(configured.DeveloperInstructions, identifier) {
				return failure(item.Configuration, "agent instructions contain forbidden identifier "+identifier, nil, identifier)
			}
		}
		if normalizeSpace(configured.DeveloperInstructions) != normalizeSpace(value.AgentInstructions[item.Executor]) {
			return failure(item.Configuration, "agent instructions do not match canonical instructions", normalizeSpace(value.AgentInstructions[item.Executor]), normalizeSpace(configured.DeveloperInstructions))
		}
	}
	return snapshot.AssertUnchanged()
}

func loadContract(snapshot *repository.Snapshot, path string) (*contract, error) {
	var value contract
	if err := loadTOML(snapshot, path, &value, true); err != nil {
		return nil, err
	}
	return &value, nil
}

func loadTOML(snapshot *repository.Snapshot, path string, target any, strict bool) error {
	content, err := snapshot.Read(path)
	if err != nil {
		return err
	}
	decoder := toml.NewDecoder(bytes.NewReader(content))
	if strict {
		decoder.DisallowUnknownFields()
	}
	if err := decoder.Decode(target); err != nil {
		return failure(path, "TOML file is invalid", nil, err.Error())
	}
	return nil
}

func validateContract(value *contract) error {
	if value.ID != ID || value.Version != 1 {
		return failure(contractRelativePath, "contract identity is invalid", map[string]any{"id": ID, "version": 1}, map[string]any{"id": value.ID, "version": value.Version})
	}
	if value.GoalLifecycle.Owner != "parent" {
		return failure(contractRelativePath, "goal_lifecycle.owner must remain parent-owned", "parent", value.GoalLifecycle.Owner)
	}
	if !equalStrings(value.GoalLifecycle.Tools, goalTools) {
		return failure(contractRelativePath, "goal_lifecycle.tools are invalid", goalTools, value.GoalLifecycle.Tools)
	}
	if value.GoalSetting.Owner != "parent" || value.GoalSetting.Entrypoint != "goal-setting" {
		return failure(contractRelativePath, "goal_setting must remain parent-owned", map[string]string{"owner": "parent", "entrypoint": "goal-setting"}, value.GoalSetting)
	}
	if !equalStrings(value.Delegation.Phases, delegatedPhases) || !equalStrings(value.Delegation.AllowedResponsibilities, delegatedResponsibilities) || !equalStrings(value.Delegation.ForbiddenResponsibilities, forbiddenResponsibilities) {
		return failure(contractRelativePath, "delegation contract is invalid", map[string][]string{"phases": delegatedPhases, "allowed": delegatedResponsibilities, "forbidden": forbiddenResponsibilities}, value.Delegation)
	}
	if !slices.Equal(value.Phases, canonicalPhases) {
		return failure(contractRelativePath, "phase assignments must match the fixed executor and configuration map", canonicalPhases, value.Phases)
	}
	agents := delegatedAgents(value.Phases)
	if err := requireMapKeys(value.AgentInstructions, agents, "agent_instructions"); err != nil {
		return err
	}
	if err := requireMapKeys(value.AgentInstructionForbiddenIdentifiers, agents, "agent_instruction_forbidden_identifiers"); err != nil {
		return err
	}
	for _, executor := range agents {
		instructions := value.AgentInstructions[executor]
		if strings.TrimSpace(instructions) == "" {
			return failure(contractRelativePath, "canonical agent instructions must be non-empty", executor, instructions)
		}
		if err := requireOperationsReference(instructions, "canonical agent "+executor); err != nil {
			return err
		}
		expectedForbidden := forbiddenByAgent[executor]
		actualForbidden := value.AgentInstructionForbiddenIdentifiers[executor]
		if !equalStrings(actualForbidden, expectedForbidden) {
			return failure(contractRelativePath, "agent forbidden identifiers are invalid", expectedForbidden, actualForbidden)
		}
		for _, identifier := range expectedForbidden {
			if containsIdentifier(instructions, identifier) {
				return failure(contractRelativePath, "canonical instructions for "+executor+" contain forbidden identifier "+identifier, nil, identifier)
			}
		}
	}
	return nil
}

func parseAssignmentTable(text string) ([]assignment, error) {
	const heading = "## Phase Execution Assignment"
	if strings.Count(text, heading) != 1 {
		return nil, failure(parentSkillPath, "parent skill must contain exactly one phase assignment heading", heading, strings.Count(text, heading))
	}
	section := strings.SplitN(text, heading, 2)[1]
	lines := strings.Split(section, "\n")
	header := -1
	for index, line := range lines {
		if strings.TrimSpace(line) == "| Phase | Executor | Configuration |" {
			header = index
			break
		}
	}
	if header < 0 {
		return nil, failure(parentSkillPath, "phase assignment table header is missing", "| Phase | Executor | Configuration |", nil)
	}
	rows := []assignment{}
	for _, line := range lines[header+2:] {
		trimmed := strings.TrimSpace(line)
		if !strings.HasPrefix(trimmed, "|") {
			break
		}
		cells := strings.Split(strings.Trim(trimmed, "|"), "|")
		if len(cells) != 3 {
			return nil, failure(parentSkillPath, "phase assignment row is invalid", 3, len(cells))
		}
		for index := range cells {
			cells[index] = strings.Trim(strings.TrimSpace(cells[index]), "`")
		}
		rows = append(rows, assignment{cells[0], cells[1], cells[2]})
	}
	return rows, nil
}

func requireContractReference(text, label string) error {
	normalized := normalizeSpace(text)
	if !strings.Contains(normalized, ID) || !strings.Contains(normalized, contractRelativePath) {
		return failure(label, "representation must reference the canonical phase contract", []string{ID, contractRelativePath}, nil)
	}
	return nil
}

func requireValidatorCommand(text, label string) error {
	if !strings.Contains(normalizeSpace(text), validatorCommand) {
		return failure(label, "representation must run the phase contract validator", validatorCommand, nil)
	}
	return nil
}

func requireBootstrapCommands(text, label string) error {
	normalized := normalizeSpace(text)
	if !strings.Contains(normalized, toolchainRequirement) {
		return failure(label, "representation must require the supported Go toolchain", toolchainRequirement, nil)
	}
	for _, command := range bootstrapCommands {
		if !strings.Contains(normalized, command) {
			return failure(label, "representation must build the current checker source before validation", bootstrapCommands, command)
		}
	}
	return nil
}

func requireOperationsReference(text, label string) error {
	if !strings.Contains(normalizeSpace(text), operationsPath) {
		return failure(label, "representation must reference the checker operations document", operationsPath, nil)
	}
	return nil
}

func readText(snapshot *repository.Snapshot, relative string) (string, error) {
	content, err := snapshot.Read(relative)
	if err != nil {
		return "", err
	}
	return string(content), nil
}

func validateRegistrationShape(rawConfig map[string]any, executor string) error {
	agents, ok := rawConfig["agents"].(map[string]any)
	if !ok {
		return failure(projectConfigPath, "project config agents table is invalid", "[agents] table", rawConfig["agents"])
	}
	rawRegistration, ok := agents[executor].(map[string]any)
	if !ok {
		return failure(projectConfigPath, "delegated agent registration is invalid", executor, agents[executor])
	}
	keys := make([]string, 0, len(rawRegistration))
	for key := range rawRegistration {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	expected := []string{"config_file", "description"}
	if !slices.Equal(keys, expected) {
		return failure(projectConfigPath, "delegated agent registration contains unknown or missing fields", expected, keys)
	}
	return nil
}

func registrationPath(configuration string) string {
	return "./" + strings.TrimPrefix(configuration, ".codex/")
}

func containsIdentifier(text, identifier string) bool {
	text = strings.ToLower(text)
	identifier = strings.ToLower(identifier)
	for offset := 0; ; {
		index := strings.Index(text[offset:], identifier)
		if index < 0 {
			return false
		}
		start := offset + index
		end := start + len(identifier)
		beforeOK := start == 0 || !identifierByte(text[start-1])
		afterOK := end == len(text) || !identifierByte(text[end])
		if beforeOK && afterOK {
			return true
		}
		offset = start + 1
	}
}

func identifierByte(value byte) bool {
	return value == '_' || value >= 'a' && value <= 'z' || value >= '0' && value <= '9'
}

func normalizeSpace(value string) string {
	return strings.Join(strings.Fields(value), " ")
}

func delegatedAgents(phases []phase) []string {
	seen := map[string]struct{}{}
	result := []string{}
	for _, item := range phases {
		if !item.Delegated {
			continue
		}
		if _, exists := seen[item.Executor]; exists {
			continue
		}
		seen[item.Executor] = struct{}{}
		result = append(result, item.Executor)
	}
	return result
}

func requireMapKeys[T any](value map[string]T, expected []string, label string) error {
	actual := make([]string, 0, len(value))
	for key := range value {
		actual = append(actual, key)
	}
	sort.Strings(actual)
	wanted := append([]string(nil), expected...)
	sort.Strings(wanted)
	if !equalStrings(actual, wanted) {
		return failure(contractRelativePath, label+" keys are invalid", wanted, actual)
	}
	return nil
}

func equalStrings(left, right []string) bool {
	if len(left) != len(right) {
		return false
	}
	for index := range left {
		if left[index] != right[index] {
			return false
		}
	}
	return true
}

func failure(path, message string, expected, actual any) error {
	return diagnostic.New("AIDD_PHASE_CONTRACT", path, "phase_execution_contract", message, expected, actual)
}
