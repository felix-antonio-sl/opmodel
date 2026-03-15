// packages/cli/tests/integration.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { executeNew } from "../src/commands/new";
import { executeAdd } from "../src/commands/add";
import { executeRemove } from "../src/commands/remove";
import { executeList } from "../src/commands/list";
import { executeShow } from "../src/commands/show";
import { executeValidate } from "../src/commands/validate";
import { loadModel, isOk } from "@opmodel/core";

describe("Coffee Making System (end-to-end CLI)", () => {
  let dir: string;
  let filePath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "opmod-integration-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true });
  });

  it("builds complete model via CLI commands", () => {
    // 1. Create model
    const newResult = executeNew("Coffee Making System", { type: "artificial", cwd: dir });
    filePath = newResult.filePath;
    expect(filePath).toContain("coffee-making-system.opmodel");

    // 2. Add things
    executeAdd("thing", { name: "Barista", kind: "object", essence: "physical", file: filePath });
    executeAdd("thing", { name: "Coffee", kind: "object", essence: "physical", file: filePath });
    executeAdd("thing", { name: "Coffee Beans", kind: "object", essence: "physical", file: filePath });
    executeAdd("thing", { name: "Water", kind: "object", essence: "physical", file: filePath });
    executeAdd("thing", { name: "Coffee Making", kind: "process", essence: "physical", file: filePath });

    // 3. Add states
    executeAdd("state", { name: "unmade", parent: "obj-coffee", initial: true, default: true, file: filePath });
    executeAdd("state", { name: "ready", parent: "obj-coffee", final: true, file: filePath });
    executeAdd("state", { name: "cold", parent: "obj-water", initial: true, default: true, file: filePath });
    executeAdd("state", { name: "hot", parent: "obj-water", final: true, file: filePath });

    // 4. Add OPD
    executeAdd("opd", { name: "SD1", parent: "opd-sd", refines: "proc-coffee-making", refinement: "in-zoom", file: filePath });

    // 5. Add links
    executeAdd("link", { type: "agent", source: "obj-barista", target: "proc-coffee-making", file: filePath });
    executeAdd("link", { type: "consumption", source: "obj-coffee-beans", target: "proc-coffee-making", file: filePath });
    executeAdd("link", { type: "consumption", source: "obj-water", target: "proc-coffee-making", file: filePath });
    executeAdd("link", { type: "result", source: "proc-coffee-making", target: "obj-coffee", file: filePath });

    // 6. Validate
    const validateResult = executeValidate({ file: filePath });
    expect(validateResult.valid).toBe(true);
    expect(validateResult.errors).toHaveLength(0);
    expect(validateResult.summary.things).toBe(5);
    expect(validateResult.summary.states).toBe(4);
    expect(validateResult.summary.links).toBe(4);
    expect(validateResult.summary.opds).toBe(2);

    // 7. List things
    const thingList = executeList("things", { file: filePath });
    expect(thingList.entities).toHaveLength(5);

    // 8. Show a thing
    const showResult = executeShow("obj-water", { file: filePath });
    expect(showResult.entityType).toBe("thing");
    expect(showResult.related?.states).toHaveLength(2);

    // 9. Verify file is valid loadable JSON
    const json = readFileSync(filePath, "utf-8");
    const loadResult = loadModel(json);
    expect(isOk(loadResult)).toBe(true);

    // 10. Remove and verify cascade
    const removeResult = executeRemove("thing", "obj-water", { file: filePath });
    expect(removeResult.cascade.states).toBe(2);
    expect(removeResult.cascade.links).toBe(1); // consumption link

    const afterRemove = executeValidate({ file: filePath });
    expect(afterRemove.valid).toBe(true);
    expect(afterRemove.summary.things).toBe(4);
  });
});
