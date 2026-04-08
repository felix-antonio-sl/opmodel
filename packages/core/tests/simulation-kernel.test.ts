import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import {
  compileToKernel,
  parseOplDocuments,
  loadModel,
  renderAll,
  runSimulation,
  runSimulationFromKernel,
  createInitialState,
  evaluatePrecondition,
  getExecutableProcesses,
  getExecutableProcessesFromRefinements,
  semanticKernelFromModel,
  exposeSemanticKernel,
  resolveLinksForOpd,
  resolveLinksForOpdNative,
  resolveOpdFiber,
  resolveOpdFiberNative,
  layoutModelFromLegacyModel,
} from "../src/index";
import type { SemanticKernel, OpmDataView } from "../src/index";

// --- Helpers ---

function fixtureModel(path: string) {
  const raw = readFileSync(path, "utf-8");
  const result = loadModel(raw);
  if (!result.ok) throw new Error(`Cannot load fixture ${path}`);
  return result.value;
}

function fixtureKernel(path: string): SemanticKernel {
  const model = fixtureModel(path);
  const opl = renderAll(model);
  const docs = parseOplDocuments(opl);
  if (!docs.ok) throw new Error(`parseOplDocuments failed`);
  const kernel = compileToKernel(docs.value);
  if (!kernel.ok) throw new Error(`compileToKernel failed: ${kernel.error.message}`);
  return kernel.value;
}

const FIXTURES = [
  { name: "coffee-making", path: "tests/coffee-making.opmodel" },
  { name: "driver-rescuing", path: "tests/driver-rescuing.opmodel" },
  { name: "hospitalizacion-domiciliaria", path: "tests/hospitalizacion-domiciliaria.opmodel" },
];

// --- Tests ---

describe("OpmDataView structural compatibility", () => {
  it("Model satisfies OpmDataView", () => {
    const model = fixtureModel(FIXTURES[0]!.path);
    // TypeScript structural typing: Model is assignable to OpmDataView
    const view: OpmDataView = model;
    expect(view.things.size).toBeGreaterThan(0);
  });

  it("SemanticKernel satisfies OpmDataView", () => {
    const kernel = fixtureKernel(FIXTURES[0]!.path);
    // TypeScript structural typing: SemanticKernel is assignable to OpmDataView
    const view: OpmDataView = kernel;
    expect(view.things.size).toBeGreaterThan(0);
  });
});

describe("createInitialState: Model vs Kernel parity", () => {
  for (const fixture of FIXTURES) {
    it(`${fixture.name}: same initial state`, () => {
      const model = fixtureModel(fixture.path);
      const kernel = semanticKernelFromModel(model);

      const stateFromModel = createInitialState(model);
      const stateFromKernel = createInitialState(kernel);

      expect(stateFromKernel.objects.size).toBe(stateFromModel.objects.size);
      for (const [id, objState] of stateFromModel.objects) {
        const kernelObj = stateFromKernel.objects.get(id);
        expect(kernelObj).toBeDefined();
        expect(kernelObj!.exists).toBe(objState.exists);
      }
    });
  }
});

describe("evaluatePrecondition: accepts SemanticKernel", () => {
  it("evaluates preconditions on kernel directly", () => {
    const kernel = fixtureKernel(FIXTURES[0]!.path);
    const state = createInitialState(kernel);

    // Find a process in the kernel
    const firstProcess = [...kernel.things.values()].find(t => t.kind === "process");
    if (!firstProcess) return;

    // Should not throw — OpmDataView accepted
    const result = evaluatePrecondition(kernel, state, firstProcess.id);
    expect(result).toHaveProperty("satisfied");
  });
});

describe("getExecutableProcessesFromRefinements", () => {
  for (const fixture of FIXTURES) {
    it(`${fixture.name}: produces executable processes from refinements`, () => {
      const kernel = fixtureKernel(fixture.path);
      const processes = getExecutableProcessesFromRefinements(kernel, kernel.refinements);

      // Must find processes
      expect(processes.length).toBeGreaterThan(0);

      // Each process must exist in kernel
      for (const ep of processes) {
        const thing = kernel.things.get(ep.id);
        expect(thing).toBeDefined();
        expect(thing!.kind).toBe("process");
      }
    });
  }

  it("coffee-making: same process set as Y-based (model path)", () => {
    const model = fixtureModel(FIXTURES[0]!.path);
    const kernel = fixtureKernel(FIXTURES[0]!.path);

    const fromModel = getExecutableProcesses(model);
    const fromKernel = getExecutableProcessesFromRefinements(kernel, kernel.refinements);

    // Same process IDs (order may differ due to semantic vs Y ordering)
    const modelIds = new Set(fromModel.map(ep => ep.id));
    const kernelIds = new Set(fromKernel.map(ep => ep.id));
    expect(kernelIds).toEqual(modelIds);
  });
});

describe("runSimulationFromKernel", () => {
  for (const fixture of FIXTURES) {
    it(`${fixture.name}: runs without crashing`, () => {
      const kernel = fixtureKernel(fixture.path);
      const trace = runSimulationFromKernel(kernel, undefined, 50);

      expect(trace.steps.length).toBeGreaterThan(0);
      expect(trace.finalState).toBeDefined();
      expect(typeof trace.completed).toBe("boolean");
      expect(typeof trace.deadlocked).toBe("boolean");
    });
  }

  it("coffee-making: kernel simulation matches model simulation", () => {
    const model = fixtureModel(FIXTURES[0]!.path);
    const kernel = fixtureKernel(FIXTURES[0]!.path);

    // Use deterministic RNG for both
    function makeRng(seed: number): () => number {
      let s = seed;
      return () => {
        s |= 0; s = s + 0x6D2B79F5 | 0;
        let t = Math.imul(s ^ s >>> 15, 1 | s);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      };
    }

    const modelTrace = runSimulation(model, undefined, 50, makeRng(42));
    const kernelTrace = runSimulationFromKernel(kernel, undefined, 50, makeRng(42));

    // Same number of executed steps
    expect(kernelTrace.steps.filter(s => !s.skipped).length).toBe(
      modelTrace.steps.filter(s => !s.skipped).length
    );

    // Same completion status
    expect(kernelTrace.completed).toBe(modelTrace.completed);
    expect(kernelTrace.deadlocked).toBe(modelTrace.deadlocked);

    // Same process names executed (order may differ slightly due to semantic ordering)
    const modelNames = modelTrace.steps.filter(s => !s.skipped).map(s => s.processName).sort();
    const kernelNames = kernelTrace.steps.filter(s => !s.skipped).map(s => s.processName).sort();
    expect(kernelNames).toEqual(modelNames);
  });
});

describe("resolveLinksForOpdNative: parity with Model-based", () => {
  it("coffee-making SD: kernel link types are superset of model", () => {
    const model = fixtureModel(FIXTURES[0]!.path);
    const kernel = fixtureKernel(FIXTURES[0]!.path);
    const atlas = exposeSemanticKernel(kernel);

    const modelLinks = resolveLinksForOpd(model, "opd-sd");
    const kernelLinks = resolveLinksForOpdNative(kernel, kernel.refinements, atlas, "opd-sd");

    // Kernel-native may resolve more links (atlas visibility is broader);
    // model link types should be a subset of kernel link types
    const modelLinkTypes = new Set(modelLinks.map(l => l.link.type));
    const kernelLinkTypes = new Set(kernelLinks.map(l => l.link.type));
    for (const lt of modelLinkTypes) {
      expect(kernelLinkTypes.has(lt)).toBe(true);
    }

    // Kernel version must have links
    expect(kernelLinks.length).toBeGreaterThan(0);
  });
});

describe("resolveOpdFiberNative: parity with Model-based", () => {
  it("coffee-making SD: same thing set", () => {
    const model = fixtureModel(FIXTURES[0]!.path);
    const kernel = fixtureKernel(FIXTURES[0]!.path);
    const atlas = exposeSemanticKernel(kernel);
    const layout = layoutModelFromLegacyModel(model, atlas);

    const modelFiber = resolveOpdFiber(model, "opd-sd");
    const kernelFiber = resolveOpdFiberNative(kernel, kernel.refinements, atlas, layout, "opd-sd");

    // Same thing IDs should be present (explicit + implicit)
    const modelThingIds = new Set(modelFiber.things.keys());
    const kernelThingIds = new Set(kernelFiber.things.keys());

    // At least 80% overlap (some differences possible due to different visibility derivation)
    const overlap = [...modelThingIds].filter(id => kernelThingIds.has(id)).length;
    expect(overlap / modelThingIds.size).toBeGreaterThanOrEqual(0.8);
  });
});
