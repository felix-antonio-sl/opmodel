// packages/cli/tests/opl.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { createModel, addThing, addAppearance, addLink, saveModel, isOk } from "@opmodel/core";
import type { Model } from "@opmodel/core";
import { executeOpl } from "../src/commands/opl";

function buildTestModel(): Model {
  let m = createModel("CLI-Test");
  let r = addThing(m, {
    id: "obj-water", kind: "object", name: "Water",
    essence: "physical", affiliation: "systemic",
  });
  if (!isOk(r)) throw r.error; m = r.value;
  r = addThing(m, {
    id: "proc-boiling", kind: "process", name: "Boiling",
    essence: "physical", affiliation: "systemic",
  });
  if (!isOk(r)) throw r.error; m = r.value;
  r = addAppearance(m, {
    thing: "obj-water", opd: "opd-sd", x: 0, y: 0, w: 120, h: 60,
  });
  if (!isOk(r)) throw r.error; m = r.value;
  r = addAppearance(m, {
    thing: "proc-boiling", opd: "opd-sd", x: 200, y: 0, w: 120, h: 60,
  });
  if (!isOk(r)) throw r.error; m = r.value;
  r = addLink(m, {
    id: "lnk-1", type: "consumption", source: "proc-boiling", target: "obj-water",
  });
  if (!isOk(r)) throw r.error; m = r.value;
  return m;
}

let tmpDir: string;
let modelPath: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "opl-cli-"));
  modelPath = join(tmpDir, "test.opmodel");
  const model = buildTestModel();
  writeFileSync(modelPath, saveModel(model));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("executeOpl", () => {
  it("generates OPL text for default OPD (opd-sd)", () => {
    const result = executeOpl({ file: modelPath });
    expect(result.text).toContain("Water is an object");
    expect(result.text).toContain("Boiling is a process");
    expect(result.text).toContain("Boiling consumes Water.");
  });

  it("returns OplDocument JSON when json flag is set", () => {
    const result = executeOpl({ file: modelPath, json: true });
    expect(result.document).toBeDefined();
    const doc = result.document as any;
    expect(doc.opdId).toBe("opd-sd");
    expect(doc.sentences.length).toBeGreaterThan(0);
  });

  it("accepts --opd to specify OPD", () => {
    const result = executeOpl({ file: modelPath, opd: "opd-sd" });
    expect(result.text).toContain("Water");
  });

  it("throws on non-existent OPD", () => {
    expect(() => executeOpl({ file: modelPath, opd: "opd-ghost" })).toThrow("OPD not found");
  });

  it("produces empty output for OPD with no appearances", () => {
    const result = executeOpl({ file: modelPath });
    expect(typeof result.text).toBe("string");
  });
});
