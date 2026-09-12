// Package storybookはStorybook sourceから検証対象判定に用いる事実を抽出する。
package storybook

import "bytes"

// ContainsTagTextは保守的な文字列観測。動的評価やtagの意味的所属を証明しない。
// コメント等も一致し得る既存保証を維持し、必須profileの選択はpolicyに委ねる。
func ContainsTagText(source []byte, tag string) bool { return bytes.Contains(source, []byte(tag)) }
