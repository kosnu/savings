module.exports = function delta(values) {
  return values.at(-1) - values[1]
}
