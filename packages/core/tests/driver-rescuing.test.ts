// packages/core/tests/driver-rescuing.test.ts
// OnStar Driver Rescuing System — integration, OPL, and simulation tests
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { loadModel } from "../src/serialization";
import { validate } from "../src/api";
import { expose, render } from "../src/opl";
import {
  createInitialState,
  runSimulation,
  getExecutableProcesses,
  resolveLinksForOpd,
} from "../src/simulation";
import { isOk } from "../src/result";
import type { Model } from "../src/types";

function loadDriverRescuingModel(): Model {
  const json = readFileSync(resolve(__dirname, "../../../tests/driver-rescuing.opmodel"), "utf-8");
  const result = loadModel(json);
  if (!isOk(result)) throw new Error("Failed to load fixture: " + JSON.stringify(result.error));
  return result.value;
}

// === Fixture loading & validation ===

describe("OnStar Driver Rescuing System", () => {
  describe("Fixture loading & validation", () => {
    it("loads fixture and validates with 0 errors", () => {
      const m = loadDriverRescuingModel();
      const errors = validate(m);
      expect(errors).toEqual([]);
    });

    it("has correct entity counts", () => {
      const m = loadDriverRescuingModel();
      expect(m.things.size).toBe(15);   // 10 objects + 5 processes
      expect(m.states.size).toBe(4);
      expect(m.opds.size).toBe(2);
      expect(m.links.size).toBe(21);
      expect(m.appearances.size).toBe(21);
    });

    it("Danger Status is informatical (I-19 exhibition)", () => {
      const m = loadDriverRescuingModel();
      const ds = m.things.get("obj-danger-status")!;
      expect(ds.essence).toBe("informatical");
    });

    it("Driver is environmental", () => {
      const m = loadDriverRescuingModel();
      const driver = m.things.get("obj-driver")!;
      expect(driver.affiliation).toBe("environmental");
    });
  });

  // === OPL rendering — SD ===

  describe("OPL rendering — SD", () => {
    it("renders thing declarations for all 8 SD things", () => {
      const m = loadDriverRescuingModel();
      const doc = expose(m, "opd-sd");
      const declarations = doc.sentences.filter(s => s.kind === "thing-declaration");
      // 7 objects + 1 process visible in SD
      expect(declarations).toHaveLength(8);
    });

    it('renders "OnStar Advisor handles Driver Rescuing."', () => {
      const m = loadDriverRescuingModel();
      const text = render(expose(m, "opd-sd"));
      expect(text).toContain("OnStar Advisor handles Driver Rescuing.");
    });

    it('renders instrument link for OnStar System', () => {
      const m = loadDriverRescuingModel();
      const text = render(expose(m, "opd-sd"));
      // ISO §9.2.3: "Processing requires Instrument."
      expect(text).toContain("Driver Rescuing requires OnStar System.");
    });

    it('renders effect "Driver Rescuing affects Driver."', () => {
      const m = loadDriverRescuingModel();
      const text = render(expose(m, "opd-sd"));
      expect(text).toContain("Driver Rescuing affects Driver.");
    });

    it('renders grouped aggregation "OnStar System consists of ..."', () => {
      const m = loadDriverRescuingModel();
      const text = render(expose(m, "opd-sd"));
      // GAP-OPL-04: grouped structural — 4 parts in one sentence
      expect(text).toContain("OnStar System consists of");
      expect(text).toContain("GPS");
      expect(text).toContain("Cellular Network");
      expect(text).toContain("OnStar Console");
      expect(text).toContain("VCIM");
      // Should NOT be individual sentences
      expect(text).not.toContain("OnStar System consists of GPS.");
    });

    it('renders tagged link "Driver communicates via OnStar Console."', () => {
      const m = loadDriverRescuingModel();
      const text = render(expose(m, "opd-sd"));
      expect(text).toContain("Driver communicates via OnStar Console.");
    });
  });

  // === OPL rendering — SD1 ===

  describe("OPL rendering — SD1", () => {
    it('renders exhibition "Driver exhibits Danger Status." (BUG-OPL-01 fix)', () => {
      const m = loadDriverRescuingModel();
      const text = render(expose(m, "opd-sd1"));
      expect(text).toContain("Driver exhibits Danger Status.");
    });

    it('renders effect for Call Transmitting ↔ Call', () => {
      const m = loadDriverRescuingModel();
      const text = render(expose(m, "opd-sd1"));
      expect(text).toContain("Call Transmitting changes Call from requested to online.");
    });

    it('renders result "Call Making yields Call."', () => {
      const m = loadDriverRescuingModel();
      const text = render(expose(m, "opd-sd1"));
      expect(text).toContain("Call Making yields Call.");
    });

    it('renders effect for Call Handling ↔ Danger Status', () => {
      const m = loadDriverRescuingModel();
      const text = render(expose(m, "opd-sd1"));
      expect(text).toContain("Call Handling changes Danger Status from endangered to safe.");
    });

    it("renders state enumerations for Call and Danger Status", () => {
      const m = loadDriverRescuingModel();
      const doc = expose(m, "opd-sd1");
      const stateEnums = doc.sentences.filter(s => s.kind === "state-enumeration");
      // Call (requested, online) and Danger Status (endangered, safe)
      expect(stateEnums).toHaveLength(2);
    });

    it("excludes parent-level links from in-zoom OPL (OPL-EXPOSE-01)", () => {
      const m = loadDriverRescuingModel();
      const text = render(expose(m, "opd-sd1"));
      // These are SD-level links that should NOT appear in the in-zoom SD1
      expect(text).not.toContain("OnStar Advisor handles Driver Rescuing.");
      expect(text).not.toContain("Driver Rescuing affects Driver.");
      expect(text).not.toContain("Driver communicates via OnStar Console.");
    });

    it('renders in-zoom sequence for Driver Rescuing (GAP-OPL-03/05)', () => {
      const m = loadDriverRescuingModel();
      const text = render(expose(m, "opd-sd1"));
      expect(text).toContain("Driver Rescuing zooms into");
      expect(text).toContain("Call Making");
      expect(text).toContain("Call Transmitting");
      expect(text).toContain("Vehicle Location Calculating");
      expect(text).toContain("Call Handling");
      expect(text).toContain("in that sequence");
    });

    it('renders state descriptions for Call and Danger Status (GAP-OPL-02)', () => {
      const m = loadDriverRescuingModel();
      const text = render(expose(m, "opd-sd1"));
      expect(text).toContain("State requested of Call is initial.");
      // Danger Status is a feature of Driver — state descriptions include the exhibitor form
      expect(text).toContain("State safe of Danger Status of Driver is final.");
      expect(text).toContain("State endangered of Danger Status of Driver is initial.");
    });

    it('renders exhibition feature with "of Exhibitor" form (GAP-OPL-07)', () => {
      const m = loadDriverRescuingModel();
      const doc = expose(m, "opd-sd1");
      const text = render(doc);
      expect(text).toContain("Danger Status of Driver");
    });
  });

  // === Simulation — in-zoom expansion ===

  describe("Simulation — in-zoom expansion", () => {
    it("expands Driver Rescuing into 4 leaf subprocesses", () => {
      const m = loadDriverRescuingModel();
      const procs = getExecutableProcesses(m);

      // Parent process should NOT appear
      expect(procs.find(p => p.id === "proc-driver-rescuing")).toBeUndefined();
      // 4 subprocesses
      const subIds = procs.map(p => p.id);
      expect(subIds).toContain("proc-call-making");
      expect(subIds).toContain("proc-call-transmitting");
      expect(subIds).toContain("proc-vehicle-location-calc");
      expect(subIds).toContain("proc-call-handling");
    });

    it("orders subprocesses by Y-coordinate (time sequence)", () => {
      const m = loadDriverRescuingModel();
      const procs = getExecutableProcesses(m);
      const ids = procs.map(p => p.id);
      expect(ids.indexOf("proc-call-making")).toBeLessThan(ids.indexOf("proc-call-transmitting"));
      expect(ids.indexOf("proc-call-transmitting")).toBeLessThan(ids.indexOf("proc-vehicle-location-calc"));
      expect(ids.indexOf("proc-vehicle-location-calc")).toBeLessThan(ids.indexOf("proc-call-handling"));
    });

    it("simulation completes in 4 steps without deadlock", () => {
      const m = loadDriverRescuingModel();
      const trace = runSimulation(m);

      expect(trace.steps).toHaveLength(4);
      expect(trace.completed).toBe(true);
      expect(trace.deadlocked).toBe(false);
    });

    it("subprocess steps carry parentProcessId and opdContext", () => {
      const m = loadDriverRescuingModel();
      const trace = runSimulation(m);

      for (const step of trace.steps) {
        expect(step.parentProcessId).toBe("proc-driver-rescuing");
        expect(step.opdContext).toBe("opd-sd1");
      }
    });

    it("step 1: Call Making yields Call", () => {
      const m = loadDriverRescuingModel();
      const trace = runSimulation(m);
      const step = trace.steps[0];

      expect(step.processId).toBe("proc-call-making");
      expect(step.preconditionMet).toBe(true);
    });

    it("step 2: Call Transmitting changes Call from requested to online", () => {
      const m = loadDriverRescuingModel();
      const trace = runSimulation(m);
      const step = trace.steps[1];

      expect(step.processId).toBe("proc-call-transmitting");
      expect(step.stateChanges).toContainEqual({
        objectId: "obj-call",
        fromState: "state-call-requested",
        toState: "state-call-online",
      });
    });

    it("step 3: Vehicle Location Calculating requires Call at state online", () => {
      const m = loadDriverRescuingModel();
      const trace = runSimulation(m);
      const step = trace.steps[2];

      expect(step.processId).toBe("proc-vehicle-location-calc");
      expect(step.preconditionMet).toBe(true);
    });

    it("step 4: Call Handling changes Danger Status from endangered to safe", () => {
      const m = loadDriverRescuingModel();
      const trace = runSimulation(m);
      const step = trace.steps[3];

      expect(step.processId).toBe("proc-call-handling");
      expect(step.stateChanges).toContainEqual({
        objectId: "obj-danger-status",
        fromState: "state-danger-endangered",
        toState: "state-danger-safe",
      });
    });

    it("final state: Call=online, Danger Status=safe", () => {
      const m = loadDriverRescuingModel();
      const trace = runSimulation(m);

      expect(trace.finalState.objects.get("obj-call")?.currentState).toBe("state-call-online");
      expect(trace.finalState.objects.get("obj-danger-status")?.currentState).toBe("state-danger-safe");
    });
  });

  // === resolveLinksForOpd ===

  describe("resolveLinksForOpd", () => {
    it("SD: resolves aggregation, agent, instrument, effect, and tagged links", () => {
      const m = loadDriverRescuingModel();
      const resolved = resolveLinksForOpd(m, "opd-sd");

      const types = new Set(resolved.map(r => r.link.type));
      expect(types.has("aggregation")).toBe(true);
      expect(types.has("agent")).toBe(true);
      expect(types.has("instrument")).toBe(true);
      expect(types.has("effect")).toBe(true);
      expect(types.has("tagged")).toBe(true);
    });

    it("SD1: includes exhibition link", () => {
      const m = loadDriverRescuingModel();
      const resolved = resolveLinksForOpd(m, "opd-sd1");

      const exhibitionLinks = resolved.filter(r => r.link.type === "exhibition");
      expect(exhibitionLinks.length).toBeGreaterThanOrEqual(1);
    });

    it("SD1: includes all subprocess links", () => {
      const m = loadDriverRescuingModel();
      const resolved = resolveLinksForOpd(m, "opd-sd1");

      // Should include agent, instrument, result, and effect links
      const types = new Set(resolved.map(r => r.link.type));
      expect(types.has("agent")).toBe(true);
      expect(types.has("instrument")).toBe(true);
      expect(types.has("result")).toBe(true);
      expect(types.has("effect")).toBe(true);
    });

    it("SD1: distributes parent-level links to subprocesses (C-01)", () => {
      const m = loadDriverRescuingModel();
      const resolved = resolveLinksForOpd(m, "opd-sd1");
      const linkIds = resolved.map(r => r.link.id);
      // Agent/effect links are now DISTRIBUTED to subprocesses (not excluded)
      // They appear with visualTarget pointing to subprocesses, not container
      const agentLinks = resolved.filter(r => r.link.id === "lnk-advisor-agent-rescuing");
      expect(agentLinks.length).toBeGreaterThan(0); // distributed to subprocesses
      for (const al of agentLinks) {
        expect(al.visualTarget).not.toBe("proc-rescuing"); // not container
      }
      // Tagged links between externals still excluded (no internal endpoint)
      expect(linkIds).not.toContain("lnk-driver-tagged-console");
    });

    it("SD: suppresses all aggregated enabling links (VISUAL-03)", () => {
      const m = loadDriverRescuingModel();
      const resolved = resolveLinksForOpd(m, "opd-sd");
      // Direct instrument: OnStar System → Driver Rescuing (should exist)
      expect(resolved.some(r => r.link.id === "lnk-rescuing-instrument-system")).toBe(true);
      // Direct agent: OnStar Advisor → Driver Rescuing (should exist)
      expect(resolved.some(r => r.link.id === "lnk-advisor-agent-rescuing")).toBe(true);
      // Aggregated part-level instruments should be suppressed
      const instrumentSources = resolved
        .filter(r => r.link.type === "instrument")
        .map(r => r.visualSource);
      expect(instrumentSources).not.toContain("obj-cellular-network");
      expect(instrumentSources).not.toContain("obj-gps");
      expect(instrumentSources).not.toContain("obj-onstar-console");
      // With effect link restored, Driver's aggregated agent links are suppressed (VISUAL-03)
      const agentSources = resolved
        .filter(r => r.link.type === "agent")
        .map(r => r.visualSource);
      expect(agentSources).not.toContain("obj-driver");
    });
  });
});
