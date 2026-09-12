package pnpm

import (
	"strings"
	"testing"
)

const sample = `lockfileVersion: '9.0'
settings: {autoInstallPeers: true}
importers:
  .:
    dependencies:
      product: {specifier: '1', version: '1'}
    devDependencies:
      tool: {specifier: '1', version: '1'}
packages:
  product@1: {resolution: {integrity: product-old}}
  tool@1: {resolution: {integrity: tool-old}}
snapshots:
  product@1: {}
  tool@1: {}
`

func TestComparisonReportsFactsForEitherProtectedSide(t *testing.T) {
	for _, tools := range []bool{false, true} {
		for _, name := range []string{"product", "tool"} {
			c, err := Compare([]byte(sample), []byte(strings.ReplaceAll(sample, name+"-old", name+"-new")), map[string]bool{"tool": true}, tools)
			if err != nil {
				t.Fatal(err)
			}
			if c.ClosureChanged != (tools == (name == "tool")) {
				t.Fatalf("side=%v name=%s: %+v", tools, name, c)
			}
		}
	}
	c, err := Compare([]byte(sample), []byte(strings.ReplaceAll(sample, "autoInstallPeers: true", "autoInstallPeers: false")), map[string]bool{"tool": true}, true)
	if err != nil || !c.SettingsChanged || c.ClosureChanged {
		t.Fatalf("%+v %v", c, err)
	}
}
func TestUnknownFormatIsNotAnUnchangedFact(t *testing.T) {
	if _, err := Compare([]byte(sample), []byte("lockfileVersion: 42"), nil, true); err == nil {
		t.Fatal("unknown format accepted")
	}
}
