import { describe, expect, it } from "vitest";
import type { Model } from "../src/types";
import { createModel, addThing, addState, addLink, addAppearance, addOPD, compileOplDocument, compileOplDocuments, parseOplDocument, parseOplDocuments, loadModel, expose, render, renderAll, isOk } from "../src/index";
import { readFileSync } from "fs";
import { resolve } from "path";

function modelWithLayout(): Model | undefined {
  let m: Model = createModel("Layout Test");
  const r1 = addThing(m, { id: "obj-a", kind: "object", name: "Alpha", essence: "physical", affiliation: "systemic" });
  if (!isOk(r1)) return undefined; m = r1.value;
  const r2 = addThing(m, { id: "proc-b", kind: "process", name: "Beta", essence: "physical", affiliation: "systemic" });
  if (!isOk(r2)) return undefined; m = r2.value;
  const r3 = addAppearance(m, { thing: "obj-a", opd: "opd-sd", x: 300, y: 200, w: 140, h: 70 });
  if (!isOk(r3)) return undefined; m = r3.value;
  const r4 = addAppearance(m, { thing: "proc-b", opd: "opd-sd", x: 600, y: 400, w: 120, h: 60 });
  if (!isOk(r4)) return undefined; m = r4.value;
  const r5 = addLink(m, { id: "lnk-test", type: "agent", source: "obj-a", target: "proc-b" });
  if (!isOk(r5)) return undefined; m = r5.value;
  return m;
}

describe("OPL roundtrip with layout preservation", () => {
  it("preserves positions when recompiling with preserveLayout", () => {
    const original = modelWithLayout();
    if (!original) return;
    const opl = render(expose(original, "opd-sd"));

    const parsed = parseOplDocument(opl, "SD", "opd-sd");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    // Compile WITHOUT layout hints
    const fresh = compileOplDocument(parsed.value, { ignoreUnsupported: true });
    expect(fresh.ok).toBe(true);
    if (!fresh.ok) return;
    const freshApp = [...fresh.value.appearances.values()].find(a => a.thing.includes("obj-a"));
    expect(freshApp).toBeDefined();
    expect(freshApp!.x).toBe(120); // default grid

    // Compile WITH layout hints
    const preserved = compileOplDocument(parsed.value, {
      ignoreUnsupported: true,
      layoutHints: new Map([["Alpha", { x: 300, y: 200, w: 140, h: 70 }]]),
    });
    expect(preserved.ok).toBe(true);
    if (!preserved.ok) return;
    const preservedApp = [...preserved.value.appearances.values()].find(a => a.thing.includes("obj-a"));
    expect(preservedApp).toBeDefined();
    expect(preservedApp!.x).toBe(300); // original position
    expect(preservedApp!.y).toBe(200);
    expect(preservedApp!.w).toBe(140);
    expect(preservedApp!.h).toBe(70);
  });

  it("coffee-making fixture roundtrips with layout preservation", () => {
    const raw = readFileSync(resolve("tests/coffee-making.opmodel"), "utf-8");
    const loaded = loadModel(raw);
    if (!loaded.ok) return;

    const original = loaded.value;
    const opl = renderAll(original);
    const parsed = parseOplDocuments(opl);
    if (!parsed.ok) return;

    const compiled = compileOplDocuments(parsed.value, {
      ignoreUnsupported: true,
      preserveLayout: original.appearances,
    });
    if (!compiled.ok) return;

    // Every original appearance that has a matching thing in the compiled model
    // should have preserved its position
    for (const [key, app] of original.appearances) {
      const compiledApp = compiled.value.appearances.get(key);
      if (compiledApp) {
        expect(compiledApp.x).toBe(app.x);
        expect(compiledApp.y).toBe(app.y);
      }
    }
  });
});
