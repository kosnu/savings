import componentGenerator from "./generators/component/index.mjs"

export default function (plop) {
  plop.setGenerator("component", componentGenerator)
}
