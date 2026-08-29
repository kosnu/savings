package catalog

import (
	"regexp"
	"slices"
	"sort"
	"strconv"
	"strings"

	"github.com/kosnu/savings/tools/aidd/checker/internal/canonical"
	"github.com/kosnu/savings/tools/aidd/checker/internal/diagnostic"
	"github.com/kosnu/savings/tools/aidd/checker/internal/model"
	"github.com/kosnu/savings/tools/aidd/checker/internal/pathcontract"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
)

const DefaultPath = "docs/ai-driven-development/contracts/verification-profiles.json"

var profileIDPattern = regexp.MustCompile(`^[a-z0-9]+(?:-[a-z0-9]+)*$`)

type Resolved struct {
	Path        string
	SHA256      string
	Profiles    map[string]model.VerificationProfile
	ProfileHash map[string]string
}

func Load(snapshot *repository.Snapshot, path string) (*Resolved, error) {
	if path != DefaultPath {
		return nil, diagnostic.New("AIDD_PROFILE_PATH", "verification_profiles.path", "verification_profile_catalog", "verification profile catalog must use the canonical repository path", DefaultPath, path)
	}
	content, err := snapshot.Read(path)
	if err != nil {
		return nil, err
	}
	var source model.ProfileCatalog
	if err := canonical.Decode(content, "verification_profile_catalog", &source); err != nil {
		return nil, err
	}
	if source.SchemaVersion != model.ProfileSchemaVersion {
		return nil, diagnostic.New(
			"AIDD_PROFILE_SCHEMA", "schema_version", "verification_profile_catalog",
			"verification profile catalog schema is unsupported",
			model.ProfileSchemaVersion, source.SchemaVersion,
		)
	}
	profiles := make(map[string]model.VerificationProfile, len(source.Profiles))
	profileHashes := make(map[string]string, len(source.Profiles))
	ids := make([]string, 0, len(source.Profiles))
	for index, profile := range source.Profiles {
		location := "profiles[" + strconv.Itoa(index) + "]"
		if !profileIDPattern.MatchString(profile.ID) {
			return nil, diagnostic.New("AIDD_PROFILE_ID", location+".id", "verification_profile_catalog", "profile ID must use lowercase ASCII kebab-case", nil, profile.ID)
		}
		if _, exists := profiles[profile.ID]; exists {
			return nil, diagnostic.New("AIDD_PROFILE_DUPLICATE", location+".id", "verification_profile_catalog", "profile ID must be unique", "unique ID", profile.ID)
		}
		if profile.Contract != "suite" && profile.Contract != "test_case" {
			return nil, diagnostic.New("AIDD_PROFILE_CONTRACT", location+".contract", "verification_profile_catalog", "profile contract is unsupported", []string{"suite", "test_case"}, profile.Contract)
		}
		if profile.Contract == "suite" && profile.SelectorKind != "suite" {
			return nil, diagnostic.New("AIDD_PROFILE_SELECTOR", location+".selector_kind", "verification_profile_catalog", "suite profile must use suite selector", "suite", profile.SelectorKind)
		}
		if profile.Contract == "test_case" && profile.SelectorKind != "test_case" {
			return nil, diagnostic.New("AIDD_PROFILE_SELECTOR", location+".selector_kind", "verification_profile_catalog", "test-case profile must use test_case selector", "test_case", profile.SelectorKind)
		}
		supportedRunner := map[string]bool{
			"command_suite":   true,
			"vitest_json":     true,
			"python_unittest": true,
		}
		if !supportedRunner[profile.Runner] {
			return nil, diagnostic.New("AIDD_PROFILE_RUNNER", location+".runner", "verification_profile_catalog", "profile runner is unsupported", nil, profile.Runner)
		}
		if (profile.Runner == "command_suite") != (profile.Contract == "suite") {
			return nil, diagnostic.New("AIDD_PROFILE_RUNNER_CONTRACT", location+".runner", "verification_profile_catalog", "runner and profile contract do not match", profile.Contract, profile.Runner)
		}
		if len(profile.Argv) == 0 {
			return nil, diagnostic.New("AIDD_PROFILE_ARGV", location+".argv", "verification_profile_catalog", "profile argv must be non-empty", nil, profile.Argv)
		}
		if profile.WorkingDirectory != "" {
			if _, err := pathcontract.ValidateRelativePath(profile.WorkingDirectory); err != nil {
				return nil, diagnostic.New("AIDD_PROFILE_WORKDIR", location+".working_directory", "verification_profile_catalog", "profile working directory is invalid", "canonical repository-relative path or empty", profile.WorkingDirectory)
			}
		}
		if profile.SelectorRoot != "" {
			if _, err := pathcontract.ValidateRelativePath(profile.SelectorRoot); err != nil {
				return nil, diagnostic.New("AIDD_PROFILE_SELECTOR_ROOT", location+".selector_root", "verification_profile_catalog", "profile selector root is invalid", "canonical repository-relative path or empty", profile.SelectorRoot)
			}
		}
		if profile.Contract == "test_case" && profile.SelectorRoot != "" && profile.WorkingDirectory != profile.SelectorRoot {
			return nil, diagnostic.New("AIDD_PROFILE_SELECTOR_ROOT", location+".selector_root", "verification_profile_catalog", "test runner selector root must match its working directory", profile.WorkingDirectory, profile.SelectorRoot)
		}
		for argumentIndex, argument := range profile.Argv {
			if argument == "" || strings.TrimSpace(argument) != argument || strings.ContainsAny(argument, "\x00\r\n") {
				return nil, diagnostic.New("AIDD_PROFILE_ARGV", location+".argv["+strconv.Itoa(argumentIndex)+"]", "verification_profile_catalog", "profile argv contains an invalid argument", "non-empty single-line argv", argument)
			}
		}
		if err := validateRunnerArgv(profile, location); err != nil {
			return nil, err
		}
		profileHash, hashErr := canonical.Hash(profile)
		if hashErr != nil {
			return nil, hashErr
		}
		profiles[profile.ID] = profile
		profileHashes[profile.ID] = profileHash
		ids = append(ids, profile.ID)
	}
	canonicalIDs := append([]string(nil), ids...)
	sort.Strings(canonicalIDs)
	for index := range ids {
		if ids[index] != canonicalIDs[index] {
			return nil, diagnostic.New("AIDD_PROFILE_ORDER", "profiles", "verification_profile_catalog", "profiles must be sorted by ID", canonicalIDs, ids)
		}
	}
	return &Resolved{
		Path:        path,
		SHA256:      canonical.HashBytes(content),
		Profiles:    profiles,
		ProfileHash: profileHashes,
	}, nil
}

func validateRunnerArgv(profile model.VerificationProfile, location string) error {
	if profile.ID == "git-diff-check" {
		expected := []string{"git", "diff", "--no-ext-diff", "HEAD", "--check", "--"}
		if profile.Runner != "command_suite" || profile.WorkingDirectory != "" || !slices.Equal(profile.Argv, expected) {
			return diagnostic.New("AIDD_PROFILE_ARGV", location, "verification_profile_catalog", "Git diff check must inspect the receipt-pinned HEAD through the final worktree", map[string]any{"runner": "command_suite", "working_directory": "", "argv": expected}, profile)
		}
	}
	switch profile.Runner {
	case "python_unittest":
		expected := []string{"python3", "-m", "unittest", "-v"}
		if !slices.Equal(profile.Argv, expected) {
			return diagnostic.New("AIDD_PROFILE_ARGV", location+".argv", "verification_profile_catalog", "Python unittest runner argv must match the fixed adapter shape", expected, profile.Argv)
		}
	case "vitest_json":
		valid := len(profile.Argv) == 3 && profile.Argv[0] == "pnpm" && profile.Argv[1] == "run" && !strings.HasPrefix(profile.Argv[2], "-")
		if !valid {
			return diagnostic.New("AIDD_PROFILE_ARGV", location+".argv", "verification_profile_catalog", "Vitest runner argv must be exactly pnpm run <repo-owned-script>", []string{"pnpm", "run", "<repo-owned-script>"}, profile.Argv)
		}
	}
	return nil
}

func Resolve(catalog *Resolved, cases []model.VerificationCase) ([]model.SelectedProfile, error) {
	selected := map[string]model.SelectedProfile{}
	for index, verificationCase := range cases {
		if verificationCase.Type != "automated" {
			continue
		}
		profile, ok := catalog.Profiles[verificationCase.VerificationProfileID]
		if !ok {
			return nil, diagnostic.New("AIDD_PROFILE_UNKNOWN", "verification_cases["+strconv.Itoa(index)+"].verification_profile_id", "target_state", "verification profile is not present in the repository catalog", nil, verificationCase.VerificationProfileID)
		}
		if verificationCase.Selector == nil || verificationCase.Selector.Kind != profile.SelectorKind {
			actual := any(nil)
			if verificationCase.Selector != nil {
				actual = verificationCase.Selector.Kind
			}
			return nil, diagnostic.New("AIDD_SELECTOR_KIND", "verification_cases["+strconv.Itoa(index)+"].selector.kind", "target_state", "selector kind does not match the profile contract", profile.SelectorKind, actual)
		}
		if profile.Contract == "test_case" && profile.SelectorRoot != "" {
			prefix := profile.SelectorRoot + "/"
			if !strings.HasPrefix(verificationCase.Selector.Path, prefix) {
				return nil, diagnostic.New("AIDD_SELECTOR_ROOT", "verification_cases["+strconv.Itoa(index)+"].selector.path", "target_state", "test-case selector path is outside the profile selector root", profile.SelectorRoot, verificationCase.Selector.Path)
			}
		}
		selected[profile.ID] = model.SelectedProfile{ID: profile.ID, SHA256: catalog.ProfileHash[profile.ID]}
	}
	ids := make([]string, 0, len(selected))
	for id := range selected {
		ids = append(ids, id)
	}
	sort.Strings(ids)
	result := make([]model.SelectedProfile, 0, len(ids))
	for _, id := range ids {
		result = append(result, selected[id])
	}
	return result, nil
}
