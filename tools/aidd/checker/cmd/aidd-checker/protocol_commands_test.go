package main

import (
	"strings"
	"testing"

	"github.com/kosnu/savings/tools/aidd/checker/internal/diagnostic"
)

func TestProtocolDiagnosticBoundsDetails(t *testing.T) {
	original := diagnostic.New("AIDD_TEST", "path", "test", "unexpected state", strings.Repeat("日本語", 4000), nil)
	first := protocolDiagnostic(original, 0, 100)
	b := diagnostic.JSON(first)
	if len(b) > 1500 || !strings.Contains(string(b), "AIDD_TEST") || !strings.Contains(string(b), `"next_offset":100`) {
		t.Fatalf("unbounded or unmarked diagnostic: %s", b)
	}
	next := diagnostic.JSON(protocolDiagnostic(original, 100, 100))
	if len(next) > 1500 || !strings.Contains(string(next), `"offset":100`) {
		t.Fatalf("invalid continuation: %s", next)
	}
}
