package protocol

import (
	"strings"

	"github.com/kosnu/savings/tools/aidd/checker/internal/canonical"
)

// 出典の真正性と実行依頼の意味はagentが確認し、Coreは形式と本文の同一性を検査する。
func validIntent(intent Intent) bool {
	if strings.TrimSpace(intent.Reference) == "" || strings.TrimSpace(intent.Body) == "" || canonical.HashBytes([]byte(intent.Body)) != intent.BodySHA256 {
		return false
	}
	switch intent.Kind {
	case "issue":
		return issuePattern.MatchString(intent.Reference)
	case "message", "feedback":
		return true
	default:
		return false
	}
}

func validExecutionIntent(intent Intent) bool {
	return validIntent(intent) && (intent.Kind == "issue" || intent.Kind == "message")
}

func (l *Loaded) intentSources() map[int]Intent {
	if l.IntentSources == nil {
		l.IntentSources = map[int]Intent{0: l.Task.Spec.Intent}
	}
	return l.IntentSources
}

func (l *Loaded) selectIntentRevision(update *IntentRevision, revision int) error {
	if update == nil {
		return nil
	}
	if revision < 1 || !validIntent(update.Intent) || strings.TrimSpace(update.Reason) == "" {
		return fail("INTENT", l.Task.Spec.ID, "Intentの追記には出典・本文・hashと補足/訂正理由が必要です")
	}
	if _, exists := l.intentSources()[revision]; exists {
		return fail("INTENT", l.Task.Spec.ID, "記録済みIntentは上書きできません")
	}
	l.IntentSources[revision] = update.Intent
	return nil
}
