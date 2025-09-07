/**
 * Split an array into `n` chunks as evenly as possible.
 * The returned array always has length `n` (some chunks may be empty).
 *
 * This distributes the remainder across the first chunks so sizes differ
 * by at most one element.
 *
 * Complexity: O(arr.length) time and O(arr.length) additional memory.
 */
function splitArray<T>(arr: T[], n: number): T[][] {
  if (!Number.isInteger(n) || n <= 0) {
    throw new RangeError("n must be a positive integer")
  }

  const len = arr.length
  const result: T[][] = new Array(n)

  const base = Math.floor(len / n)
  let remainder = len % n

  let offset = 0
  for (let i = 0; i < n; i++) {
    const size = base + (remainder > 0 ? 1 : 0)
    if (remainder > 0) remainder--

    if (size === 0) {
      result[i] = []
      continue
    }

    // Use slice which is implemented natively and copies the required range
    result[i] = arr.slice(offset, offset + size)
    offset += size
  }

  return result
}

export { splitArray }
