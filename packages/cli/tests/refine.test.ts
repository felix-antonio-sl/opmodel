// packages/cli/tests/refine.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  createModel, addThing, addOPD, addAppearance, addLink,
  saveModel,
} from "@opmodel/core";
import { executeRefine } from "../src/commands/refine";
import { readModel } from "../src/io";

function unwrap<T, E>(result: { ok: boolean; value?: T; error?: E }): T {
  if (!result.ok) throw new Error(`Expected ok, got: ${JSON.stringify((result as any).error)}`);
  return result.value as T;
}

let dir: string;
let TEST_FILE: string;

function setupModel(): void {
  let m = createModel("test");
  // createModel already creates opd-sd
  m = unwrap(addThing(m, { id: "proc-heat", kind: "process", name: "Heating", essence: "physical", affiliation: "systemic" }));
  m = unwrap(addThing(m, { id: "obj-water", kind: "object", name: "Water", essence: "physical", affiliation: "systemic" }));
  m = unwrap(addAppearance(m, { thing: "proc-heat", opd: "opd-sd", x: 100, y: 100, w: 150, h: 80 }));
  m = unwrap(addAppearance(m, { thing: "obj-water", opd: "opd-sd", x: 50, y: 50, w: 120, h: 60 }));
  m = unwrap(addLink(m, { id: "lnk-1", type: "effect", source: "obj-water", target: "proc-heat" }));
  const json = saveModel(m);
  writeFileSync(TEST_FILE, json);
}

describe("executeRefine", () => {
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "opmod-test-"));
    TEST_FILE = join(dir, "test-refine.opmodel");
    setupModel();
  });
  afterEach(() => rmSync(dir, { recursive: true }));

  it("creates refinement OPD with auto-generated ID and name", () => {
    const result = executeRefine("proc-heat", {
      opd: "opd-sd",
      type: "in-zoom",
      file: TEST_FILE,
    });
    expect(result.type).toBe("refinement");
    expect(result.opd.refinement_type).toBe("in-zoom");
    expect(result.opd.refines).toBe("proc-heat");
    expect(result.opd.name).toBe("SD1");
    expect(result.opd.parent_opd).toBe("opd-sd");
    expect(result.appearancesCreated).toBeGreaterThan(0);
  });

  it("persists the model after refinement", () => {
    executeRefine("proc-heat", { opd: "opd-sd", type: "in-zoom", file: TEST_FILE });
    const { model: loaded } = readModel(TEST_FILE);
    const refinementOpds = [...loaded.opds.values()].filter(o => o.refines === "proc-heat");
    expect(refinementOpds.length).toBe(1);
  });

  it("auto-names with dot notation for sub-levels", () => {
    executeRefine("proc-heat", { opd: "opd-sd", type: "in-zoom", file: TEST_FILE });
    const { model } = readModel(TEST_FILE);
    const sd1 = [...model.opds.values()].find(o => o.name === "SD1");
    expect(sd1).toBeDefined();
  });

  it("throws on non-existent thing", () => {
    expect(() => executeRefine("proc-nonexistent", { opd: "opd-sd", type: "in-zoom", file: TEST_FILE })).toThrow();
  });

  it("allows unfold on process (ISO §14.3)", () => {
    // ISO 19450: unfold applies to both objects and processes
    executeRefine("proc-heat", { opd: "opd-sd", type: "unfold", file: TEST_FILE });
    const { model } = readModel(TEST_FILE);
    const unfold = [...model.opds.values()].find(o => o.refinement_type === "unfold");
    expect(unfold).toBeDefined();
  });
});
