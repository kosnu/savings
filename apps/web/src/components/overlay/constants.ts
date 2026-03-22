// Radix Themes は JS から参照できる breakpoint token を公開していないため、
// overlay 用の media query はアプリ側で定義する。
// 768px から Radix Themes の `sm` が始まるため、ここでは `sm` 未満を mobile とみなす。
export const MOBILE_OVERLAY_MEDIA_QUERY = "(max-width: 767px)"
