package canonical

import (
	"strings"
	"testing"
)

func TestDecodeRejectsDuplicateKeys(t *testing.T) {
	var value map[string]any
	err := Decode([]byte(`{"id":"first","id":"second"}`), "fixture", &value)
	if err == nil || !strings.Contains(err.Error(), "AIDD_JSON_DUPLICATE_KEY") {
		t.Fatalf("expected duplicate-key diagnostic, got %v", err)
	}
}

func TestHashNormalizesNewlinesAndMapOrder(t *testing.T) {
	left, err := Hash(map[string]any{"b": "line\r\nnext", "a": 1})
	if err != nil {
		t.Fatal(err)
	}
	right, err := Hash(map[string]any{"a": 1, "b": "line\nnext"})
	if err != nil {
		t.Fatal(err)
	}
	if left != right {
		t.Fatalf("canonical hashes differ: %s != %s", left, right)
	}
}

func TestPrettyGolden(t *testing.T) {
	encoded, err := Pretty(map[string]any{"message": "日本語", "items": []string{"a", "b"}})
	if err != nil {
		t.Fatal(err)
	}
	expected := "{\n  \"items\": [\n    \"a\",\n    \"b\"\n  ],\n  \"message\": \"日本語\"\n}\n"
	if string(encoded) != expected {
		t.Fatalf("golden mismatch\nexpected:\n%s\nactual:\n%s", expected, encoded)
	}
}
