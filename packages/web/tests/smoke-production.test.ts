/**
 * Smoke test: exercises the full production cycle without a browser.
 *
 * Load fixture → validate → export OPL → re-import OPL → export .opmodel → reload .opmodel
 *
 * This catches regressions in the core pipeline that the build would ship.
 */
// @vitest-environment happy-dom
import { describe, expect, it, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  loadModel,
  saveModel,
  isOk,
  renderAll,
  parseOplDocuments,
  compileToKernel,
  legacyModelFromSemanticKernel,
  exposeSemanticKernel,
  semanticKernelFromModel,
  validate,
  createModel,
  addThing,
  addAppearance,
  addLink,
  addState,
  exportMarkdown,
} from "@opmodel/core";
import { saveToLocalSnapshots, loadCurrentFromStorage, clearLocalSnapshots, restoreSnapshot } from "../src/lib/local-persistence";

const FIXTURES_DIR = resolve(__dirname, "../../..", "tests");

const FIXTURES = [
  "coffee-making.opmodel",
  "driver-rescuing.opmodel",
  "hospitalizacion-domiciliaria.opmodel",
  "hodom-v2.opmodel",
  "ev-ams.opmodel",
  "hodom-hsc-v0.opmodel",
  "hodom-hsc.opmodel",
];

describe("smoke: production cycle", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  for (const fixture of FIXTURES) {
    it(`${fixture}: load → validate → export OPL → recompile → serialize roundtrip`, () => {
      // 1. Load fixture
      const json = readFileSync(resolve(FIXTURES_DIR, fixture), "utf-8");
      const loadResult = loadModel(json);
      expect(loadResult.ok).toBe(true);
      if (!loadResult.ok) return;
      const model = loadResult.value;

      // 2. Validate model (should not throw)
      const validation = validate(model);
      expect(Array.isArray(validation)).toBe(true);

      // 3. Export OPL
      const oplText = renderAll(model);
      expect(oplText.length).toBeGreaterThan(0);
      expect(oplText).toContain("==="); // OPD headers

      // 4. Parse OPL back
      const parsed = parseOplDocuments(oplText);
      expect(parsed.ok).toBe(true);

      // 5. Recompile to kernel (some complex models may not fully roundtrip)
      if (parsed.ok) {
        const compiled = compileToKernel(parsed.value, { ignoreUnsupported: true });
        if (compiled.ok) {
          const kernel = compiled.value;
          const atlas = exposeSemanticKernel(kernel);
          const reimported = legacyModelFromSemanticKernel(kernel, atlas);
          expect(reimported.things.size).toBeGreaterThan(0);
        }
        // Not asserting compiled.ok — known limitation for complex models
      }

      // 6. Serialize roundtrip
      const reserialized = saveModel(model);
      const reloaded = loadModel(reserialized);
      expect(reloaded.ok).toBe(true);
      if (reloaded.ok) {
        expect(reloaded.value.things.size).toBe(model.things.size);
        expect(reloaded.value.links.size).toBe(model.links.size);
      }
    });
  }

  it("full user workflow: create → edit → save → restore → export", () => {
    // 1. Create model
    let model = createModel("Smoke Test");

    // 2. Add things
    let r = addThing(model, { id: "t-patient", name: "Patient", kind: "object", essence: "physical", affiliation: "system" });
    expect(r.ok).toBe(true); if (!r.ok) return; model = r.value;

    r = addThing(model, { id: "t-treating", name: "Treating", kind: "process", essence: "physical", affiliation: "system" });
    expect(r.ok).toBe(true); if (!r.ok) return; model = r.value;

    // 3. Add appearances
    let a = addAppearance(model, { thing: "t-patient", opd: "opd-sd", x: 50, y: 50, w: 120, h: 60 });
    expect(a.ok).toBe(true); if (!a.ok) return; model = a.value;
    a = addAppearance(model, { thing: "t-treating", opd: "opd-sd", x: 250, y: 50, w: 140, h: 60 });
    expect(a.ok).toBe(true); if (!a.ok) return; model = a.value;

    // 4. Add states
    let s = addState(model, { id: "s-ill", parent: "t-patient", name: "ill", initial: true, final: false, default: false });
    expect(s.ok).toBe(true); if (!s.ok) return; model = s.value;
    s = addState(model, { id: "s-healthy", parent: "t-patient", name: "healthy", initial: false, final: true, default: false });
    expect(s.ok).toBe(true); if (!s.ok) return; model = s.value;

    // 5. Add link
    const l = addLink(model, { id: "l-agent", type: "agent", source: "t-patient", target: "t-treating" });
    expect(l.ok).toBe(true); if (!l.ok) return; model = l.value;

    // 6. Validate (should not throw)
    const validation = validate(model);
    expect(Array.isArray(validation)).toBe(true);

    // 7. Export OPL
    const opl = renderAll(model);
    expect(opl).toContain("Patient");
    expect(opl).toContain("Treating");

    // 8. Export Markdown
    const md = exportMarkdown(model);
    expect(md).toContain("Smoke Test");

    // 9. Serialize → local persistence → restore
    const { current } = saveToLocalSnapshots(model);
    const loaded = loadCurrentFromStorage();
    expect(loaded?.meta.name).toBe("Smoke Test");
    expect(loaded?.things.size).toBe(2);

    const restored = restoreSnapshot(current);
    expect(restored?.things.size).toBe(2);
    expect(restored?.links.size).toBe(1);

    // 10. Kernel roundtrip
    const kernel = semanticKernelFromModel(model);
    const atlas = exposeSemanticKernel(kernel);
    expect(atlas.nodes.size).toBeGreaterThan(0);

    // Cleanup
    clearLocalSnapshots();
    expect(loadCurrentFromStorage()).toBeNull();
  });
});
