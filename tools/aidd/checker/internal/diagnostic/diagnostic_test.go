package diagnostic

import (
	"strings"
	"testing"
)

func TestJSONAlwaysIncludesStableDiagnosticFields(t *testing.T) {
	encoded := string(JSON(New("AIDD_TEST", "", "cli", "failed", nil, nil)))
	for _, field := range []string{`"code"`, `"path"`, `"artifact"`, `"expected"`, `"actual"`, `"message"`} {
		if !strings.Contains(encoded, field) {
			t.Fatalf("diagnostic omits %s: %s", field, encoded)
		}
	}
}
