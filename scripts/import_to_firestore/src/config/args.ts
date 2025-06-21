import { parseArgs } from "jsr:@std/cli/parse-args"

export const args = parseArgs(Deno.args, {
  string: ["file"],
  alias: { f: "file" },
})
