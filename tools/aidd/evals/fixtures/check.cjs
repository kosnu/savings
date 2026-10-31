const assert = require("node:assert/strict")
const crypto = require("node:crypto")
const fs = require("node:fs")
const delta = require("./main.cjs")

const source = crypto
  .createHash("sha256")
  .update(fs.readFileSync(`${__dirname}/main.cjs`))
  .digest("hex")
try {
  assert.equal(delta([100, 150, 170, 190]), 90)
  assert.equal(delta([]), 0)
  assert.equal(delta([12]), 0)
} catch {
  console.log(`EVAL_CHECK ${JSON.stringify({ passed: false, source })}`)
  process.exit(1)
}
console.log(`EVAL_CHECK ${JSON.stringify({ passed: true, source })}`)
