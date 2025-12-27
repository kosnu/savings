// Result 型（簡易） — クラス不使用で成功/失敗を表現するユーティリティ
export type Result<T, E = DomainError> =
  | { isOk: true; value: T }
  | { isOk: false; error: E }

export const ok = <T>(value: T): Result<T> => ({ isOk: true, value })
export const err = <E>(error: E): Result<never, E> => ({ isOk: false, error })

// ヘルパー
export const isOk = <T, E>(r: Result<T, E>): r is { isOk: true; value: T } =>
  r.isOk
export const isErr = <T, E>(r: Result<T, E>): r is { isOk: false; error: E } =>
  !r.isOk

// DomainError の型を参照するために遅延インポート的に型名を宣言（実体は shared/errors.ts）
import type { DomainError } from "../shared/errors.ts"
