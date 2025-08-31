import { parseArgs } from "@std/cli/parse-args"

export const args = parseArgs(Deno.args, {
  string: ["collection", "file"],
  alias: {
    c: "collection",
    f: "file",
  },
})
