package storybook

import "testing"

func TestConservativeTagFactDoesNotChoosePathOrSuite(t *testing.T) {
	for _, c := range []struct {
		source, tag string
		want        bool
	}{{"tags: ['browser-test']", "browser-test", true}, {"tags: ['custom-browser']", "custom-browser", true}, {"tags: []", "browser-test", false}, {"// browser-test", "browser-test", true}} {
		if got := ContainsTagText([]byte(c.source), c.tag); got != c.want {
			t.Fatalf("%q: %v", c.source, got)
		}
	}
}
