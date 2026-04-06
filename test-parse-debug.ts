import { parseOplDocument } from "./packages/core/src/opl-parse.ts";

const result = parseOplDocument("Boiling is a process, physical.\nBoiling requires 5min.", "SD");
if (result.ok) {
  console.log("OK:", result.value.sentences.length);
  for (const s of result.value.sentences) console.log(" ", s.kind);
} else {
  console.log("FAIL:", JSON.stringify(result.error));
}
