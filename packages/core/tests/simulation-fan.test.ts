// packages/core/tests/simulation-fan.test.ts
import { describe, it, expect } from "vitest";
import { createModel } from "../src/model";
import {
  addThing, addState, addLink, addAppearance, addFan,
} from "../src/api";
import { isOk } from "../src/result";
import {
  createInitialState, evaluatePrecondition, simulationStep, runSimulation,
  type ModelState, type SimulationEvent,
} from "../src/simulation";
import type { Thing } from "../src/types";

// === Helpers ===

function ok<T>(r: { ok: boolean; value?: T; error?: unknown }): T {
  if (!isOk(r)) throw new Error(`Expected ok: ${JSON.stringify((r as any).error)}`);
  return r.value;
}

// === Fixtures ===

const procP: Thing = { id: "proc-p", kind: "process", name: "Producing", essence: "informatical", affiliation: "systemic" };
const objA: Thing = { id: "obj-a", kind: "object", name: "Alpha", essence: "physical", affiliation: "systemic" };
const objB: Thing = { id: "obj-b", kind: "object", name: "Beta", essence: "physical", affiliation: "systemic" };
const objC: Thing = { id: "obj-c", kind: "object", name: "Gamma", essence: "physical", affiliation: "systemic" };

function buildModel() {
  let m = createModel("SimFanTest");
  m = ok(addThing(m, procP));
  m = ok(addThing(m, objA));
  m = ok(addThing(m, objB));
  m = ok(addThing(m, objC));
  m = ok(addAppearance(m, { thing: "proc-p", opd: "opd-sd", x: 300, y: 200, w: 120, h: 60 }));
  m = ok(addAppearance(m, { thing: "obj-a", opd: "opd-sd", x: 100, y: 100, w: 120, h: 60 }));
  m = ok(addAppearance(m, { thing: "obj-b", opd: "opd-sd", x: 100, y: 200, w: 120, h: 60 }));
  m = ok(addAppearance(m, { thing: "obj-c", opd: "opd-sd", x: 100, y: 300, w: 120, h: 60 }));
  return m;
}

describe("Simulation Fan Branching", () => {

  describe("XOR converging consumption fan — precondition", () => {
    it("is satisfied when only 1 of N fan member objects exists", () => {
      let m = buildModel();
      m = ok(addLink(m, { id: "lnk-a-cons", type: "consumption", source: "obj-a", target: "proc-p" }));
      m = ok(addLink(m, { id: "lnk-b-cons", type: "consumption", source: "obj-b", target: "proc-p" }));
      m = ok(addFan(m, { id: "fan-xor", type: "xor", members: ["lnk-a-cons", "lnk-b-cons"] }));

      const state = createInitialState(m);
      // Remove Beta — only Alpha exists
      state.objects.get("obj-b")!.exists = false;

      const result = evaluatePrecondition(m, state, "proc-p");
      expect(result.satisfied).toBe(true);
    });

    it("is not satisfied when none of the fan member objects exist", () => {
      let m = buildModel();
      m = ok(addLink(m, { id: "lnk-a-cons", type: "consumption", source: "obj-a", target: "proc-p" }));
      m = ok(addLink(m, { id: "lnk-b-cons", type: "consumption", source: "obj-b", target: "proc-p" }));
      m = ok(addFan(m, { id: "fan-xor", type: "xor", members: ["lnk-a-cons", "lnk-b-cons"] }));

      const state = createInitialState(m);
      state.objects.get("obj-a")!.exists = false;
      state.objects.get("obj-b")!.exists = false;

      const result = evaluatePrecondition(m, state, "proc-p");
      expect(result.satisfied).toBe(false);
    });
  });

  describe("OR converging consumption fan — precondition", () => {
    it("is satisfied when at least 1 of N fan member objects exists", () => {
      let m = buildModel();
      m = ok(addLink(m, { id: "lnk-a-cons", type: "consumption", source: "obj-a", target: "proc-p" }));
      m = ok(addLink(m, { id: "lnk-b-cons", type: "consumption", source: "obj-b", target: "proc-p" }));
      m = ok(addLink(m, { id: "lnk-c-cons", type: "consumption", source: "obj-c", target: "proc-p" }));
      m = ok(addFan(m, { id: "fan-or", type: "or", members: ["lnk-a-cons", "lnk-b-cons", "lnk-c-cons"] }));

      const state = createInitialState(m);
      state.objects.get("obj-a")!.exists = false;
      state.objects.get("obj-b")!.exists = false;
      // Only Gamma exists

      const result = evaluatePrecondition(m, state, "proc-p");
      expect(result.satisfied).toBe(true);
    });
  });

  describe("AND fan — precondition (regression)", () => {
    it("requires ALL members to be satisfied", () => {
      let m = buildModel();
      m = ok(addLink(m, { id: "lnk-a-cons", type: "consumption", source: "obj-a", target: "proc-p" }));
      m = ok(addLink(m, { id: "lnk-b-cons", type: "consumption", source: "obj-b", target: "proc-p" }));
      m = ok(addFan(m, { id: "fan-and", type: "and", members: ["lnk-a-cons", "lnk-b-cons"] }));

      const state = createInitialState(m);
      state.objects.get("obj-b")!.exists = false;

      const result = evaluatePrecondition(m, state, "proc-p");
      // AND = all must be satisfied → fail because Beta missing
      expect(result.satisfied).toBe(false);
    });
  });

  describe("XOR diverging result fan — postcondition", () => {
    it("produces exactly 1 result object", () => {
      let m = buildModel();
      // Remove objects from initial state (they'll be produced)
      m = ok(addLink(m, { id: "lnk-p-res-a", type: "result", source: "proc-p", target: "obj-a" }));
      m = ok(addLink(m, { id: "lnk-p-res-b", type: "result", source: "proc-p", target: "obj-b" }));
      m = ok(addLink(m, { id: "lnk-p-res-c", type: "result", source: "proc-p", target: "obj-c" }));
      m = ok(addFan(m, { id: "fan-xor-res", type: "xor", members: ["lnk-p-res-a", "lnk-p-res-b", "lnk-p-res-c"] }));

      const state = createInitialState(m);
      // Mark all objects as non-existent (they'll be created by result)
      state.objects.get("obj-a")!.exists = false;
      state.objects.get("obj-b")!.exists = false;
      state.objects.get("obj-c")!.exists = false;

      const event: SimulationEvent = { kind: "manual", targetId: "proc-p" };
      // Use deterministic rng
      const step = simulationStep(m, state, event, () => 0.0);

      expect(step.preconditionMet).toBe(true);
      // XOR: exactly 1 result
      expect(step.resultIds).toHaveLength(1);
    });
  });

  describe("XOR diverging result fan with probabilities", () => {
    it("selects based on probability weights", () => {
      let m = buildModel();
      m = ok(addLink(m, { id: "lnk-p-res-a", type: "result", source: "proc-p", target: "obj-a", probability: 0.8 }));
      m = ok(addLink(m, { id: "lnk-p-res-b", type: "result", source: "proc-p", target: "obj-b", probability: 0.2 }));
      m = ok(addFan(m, { id: "fan-xor-res", type: "xor", members: ["lnk-p-res-a", "lnk-p-res-b"] }));

      const state = createInitialState(m);
      state.objects.get("obj-a")!.exists = false;
      state.objects.get("obj-b")!.exists = false;

      const event: SimulationEvent = { kind: "manual", targetId: "proc-p" };
      // rng=0.0 → should pick first (Alpha, p=0.8)
      const step1 = simulationStep(m, state, event, () => 0.0);
      expect(step1.resultIds).toEqual(["obj-a"]);

      // rng=0.9 → should pick second (Beta, cumulative > 0.8)
      const step2 = simulationStep(m, state, event, () => 0.9);
      expect(step2.resultIds).toEqual(["obj-b"]);
    });
  });

  describe("XOR converging consumption fan — execution", () => {
    it("consumes exactly 1 object", () => {
      let m = buildModel();
      m = ok(addLink(m, { id: "lnk-a-cons", type: "consumption", source: "obj-a", target: "proc-p" }));
      m = ok(addLink(m, { id: "lnk-b-cons", type: "consumption", source: "obj-b", target: "proc-p" }));
      m = ok(addFan(m, { id: "fan-xor-cons", type: "xor", members: ["lnk-a-cons", "lnk-b-cons"] }));

      const state = createInitialState(m);
      const event: SimulationEvent = { kind: "manual", targetId: "proc-p" };
      const step = simulationStep(m, state, event, () => 0.0);

      expect(step.preconditionMet).toBe(true);
      expect(step.consumptionIds).toHaveLength(1);
    });
  });

  describe("runSimulation with XOR fan", () => {
    it("completes without errors", () => {
      let m = buildModel();
      m = ok(addLink(m, { id: "lnk-a-cons", type: "consumption", source: "obj-a", target: "proc-p" }));
      m = ok(addLink(m, { id: "lnk-b-cons", type: "consumption", source: "obj-b", target: "proc-p" }));
      m = ok(addFan(m, { id: "fan-xor-cons", type: "xor", members: ["lnk-a-cons", "lnk-b-cons"] }));

      const trace = runSimulation(m);
      expect(trace.completed).toBe(true);
      expect(trace.deadlocked).toBe(false);
      // Process should have executed
      expect(trace.steps.length).toBeGreaterThan(0);
    });
  });
});
