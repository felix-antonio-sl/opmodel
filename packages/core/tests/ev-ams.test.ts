import { describe, it, expect } from "vitest";
import { loadModel } from "../src/serialization";
import { validate } from "../src/api";
import { expose, render, renderAll, modelStats } from "../src/opl";
import { runSimulation } from "../src/simulation";
import { getCompoundStates } from "../src/compound-states";
import { readFileSync } from "fs";
import { resolve } from "path";

const fixture = readFileSync(resolve(__dirname, "../../../tests/ev-ams.opmodel"), "utf8");

describe("EV-AMS Canonical Example", () => {
  it("loads without errors", () => {
    const r = loadModel(fixture);
    expect(r.ok).toBe(true);
  });

  it("has correct thing counts", () => {
    const r = loadModel(fixture);
    if (!r.ok) throw new Error("load failed");
    const stats = modelStats(r.value);
    expect(stats.things.total).toBeGreaterThanOrEqual(49);
    expect(stats.things.objects).toBeGreaterThanOrEqual(30);
    expect(stats.things.processes).toBeGreaterThanOrEqual(15);
  });

  it("has 6 OPDs (SD + SD1 + SD1.1 + SD1.1.1 + SD1.2 + SD1.2.1)", () => {
    const r = loadModel(fixture);
    if (!r.ok) throw new Error("load failed");
    expect(r.value.opds.size).toBe(6);
  });

  it("has states for key objects", () => {
    const r = loadModel(fixture);
    if (!r.ok) throw new Error("load failed");
    expect(r.value.states.size).toBeGreaterThanOrEqual(8);
    // Mobility Convenience: limited, enhanced
    const mobStates = [...r.value.states.values()].filter(s => s.parent === "obj-mobility-convenience");
    expect(mobStates.length).toBe(2);
    // Manufacturing Quality Level: 4 states
    const qualStates = [...r.value.states.values()].filter(s => s.parent === "obj-mfg-quality");
    expect(qualStates.length).toBe(4);
  });

  it("has exhibition links (system exhibits main process)", () => {
    const r = loadModel(fixture);
    if (!r.ok) throw new Error("load failed");
    const exhibitions = [...r.value.links.values()].filter(l => l.type === "exhibition");
    expect(exhibitions.length).toBeGreaterThanOrEqual(3);
  });

  it("has agent links", () => {
    const r = loadModel(fixture);
    if (!r.ok) throw new Error("load failed");
    const agents = [...r.value.links.values()].filter(l => l.type === "agent");
    expect(agents.length).toBeGreaterThanOrEqual(3);
  });

  it("has environmental objects", () => {
    const r = loadModel(fixture);
    if (!r.ok) throw new Error("load failed");
    const envObjects = [...r.value.things.values()].filter(t => t.affiliation === "environmental");
    expect(envObjects.length).toBeGreaterThanOrEqual(3);
  });

  it("has problem occurrence process", () => {
    const r = loadModel(fixture);
    if (!r.ok) throw new Error("load failed");
    const fossilProc = r.value.things.get("proc-fossil-using");
    expect(fossilProc).toBeDefined();
    expect(fossilProc?.affiliation).toBe("environmental");
  });

  it("SD OPL contains key sentences", () => {
    const r = loadModel(fixture);
    if (!r.ok) throw new Error("load failed");
    const text = render(expose(r.value, "opd-sd"));
    expect(text).toContain("Autonomous Electric Vehicle Providing");
    expect(text).toContain("Urban Commuter Group is an object");
    // Environmental objects have "environmental" in their OPL declaration
    expect(text).toMatch(/environmental|ambiental/);
    expect(text).toContain("limited");
    expect(text).toContain("enhanced");
    expect(text).toContain("exhibits");
    expect(text).toContain("handles");
    expect(text).toContain("requires");
    expect(text).toContain("consumes");
    expect(text).toContain("yields");
  });

  it("SD1 OPL contains subprocess sequence", () => {
    const r = loadModel(fixture);
    if (!r.ok) throw new Error("load failed");
    const text = render(expose(r.value, "opd-sd1"));
    expect(text).toContain("AEV Manufacturing");
    expect(text).toContain("AEV Testing");
    expect(text).toContain("AEV Deploying");
    expect(text).toContain("AEV Fleet Operating");
    expect(text).toContain("in that sequence");
  });

  it("renderAll produces complete model text", () => {
    const r = loadModel(fixture);
    if (!r.ok) throw new Error("load failed");
    const full = renderAll(r.value);
    expect(full).toContain("=== SD ===");
    expect(full).toContain("=== SD1 ===");
    const wordCount = full.split(/\s+/).length;
    expect(wordCount).toBeGreaterThan(500);
  });

  it("simulation runs without crashing", () => {
    const r = loadModel(fixture);
    if (!r.ok) throw new Error("load failed");
    const trace = runSimulation(r.value);
    expect(trace.steps.length).toBeGreaterThan(0);
    expect(trace.completed || trace.deadlocked).toBe(true);
  });

  it("SD1.1 OPL has generalization specializations", () => {
    const r = loadModel(fixture);
    if (!r.ok) throw new Error("load failed");
    const text = render(expose(r.value, "opd-sd1-1"));
    expect(text).toContain("Trip Requesting");
    expect(text).toContain("Road Danger Monitoring");
    expect(text).toContain("Battery Fast Charging");
  });

  it("SD1.1.1 OPL has invocation and threat assessment", () => {
    const r = loadModel(fixture);
    if (!r.ok) throw new Error("load failed");
    const text = render(expose(r.value, "opd-sd1-1-1"));
    expect(text).toContain("Environment Sensing");
    expect(text).toContain("Threat Assessing");
    expect(text).toContain("Threat Level");
  });

  it("SD1.2 has robot generalization + AEV classification", () => {
    const r = loadModel(fixture);
    if (!r.ok) throw new Error("load failed");
    const text = render(expose(r.value, "opd-sd1-2"));
    expect(text).toContain("Welding Robot");
    expect(text).toContain("Assembly Robot");
    expect(text).toContain("Chassis Assembling");
    const cls = [...r.value.links.values()].filter(l => l.type === "classification" && l.source === "obj-aev");
    expect(cls).toHaveLength(2);
  });

  it("SD1.2.1 has parallel final inspection subprocesses", () => {
    const r = loadModel(fixture);
    if (!r.ok) throw new Error("load failed");
    const text = render(expose(r.value, "opd-sd1-2-1"));
    expect(text).toContain("Mechanical Inspecting");
    expect(text).toContain("Software Validating");
    expect(text).toMatch(/parallel|paralelo/);
  });

  it("has tagged structural links (represents, cools)", () => {
    const r = loadModel(fixture);
    if (!r.ok) throw new Error("load failed");
    const tagged = [...r.value.links.values()].filter(l => l.type === "tagged");
    expect(tagged.some(l => l.tag === "represents")).toBe(true);
    expect(tagged.some(l => l.tag === "cools")).toBe(true);
  });

  it("has Battery Pack exhibition hierarchy", () => {
    const r = loadModel(fixture);
    if (!r.ok) throw new Error("load failed");
    const exhibits = [...r.value.links.values()].filter(l => l.type === "exhibition" && l.source === "obj-battery-pack");
    expect(exhibits.map(l => l.target)).toEqual(expect.arrayContaining(["obj-charge-level", "obj-battery-temperature", "obj-cycle-count"]));
  });

  it("has classification instances for AEV", () => {
    const r = loadModel(fixture);
    if (!r.ok) throw new Error("load failed");
    const cls = [...r.value.links.values()].filter(l => l.type === "classification" && l.source === "obj-aev");
    expect(cls.map(l => l.target)).toEqual(expect.arrayContaining(["obj-aev-001", "obj-aev-002"]));
  });

  it("has XOR fan for threat assessment outcomes", () => {
    const r = loadModel(fixture);
    if (!r.ok) throw new Error("load failed");
    const fans = [...r.value.fans.values()].filter(f => f.type === "xor");
    expect(fans.some(f => f.members.includes("lnk-alert-none-condition") && f.members.includes("lnk-visual-warning-condition") && f.members.includes("lnk-braking-critical-event"))).toBe(true);
  });

  it("has invocation link", () => {
    const r = loadModel(fixture);
    if (!r.ok) throw new Error("load failed");
    const invocations = [...r.value.links.values()].filter(l => l.type === "invocation");
    expect(invocations.length).toBeGreaterThanOrEqual(1);
  });

  it("has generalization links", () => {
    const r = loadModel(fixture);
    if (!r.ok) throw new Error("load failed");
    const gens = [...r.value.links.values()].filter(l => l.type === "generalization");
    expect(gens.length).toBeGreaterThanOrEqual(4); // 4 fleet specializations + 2 robot generalizations
  });

  it("no hard validation errors", () => {
    const r = loadModel(fixture);
    if (!r.ok) throw new Error("load failed");
    const errors = validate(r.value);
    const hard = errors.filter(e => !e.severity || e.severity === "error");
    // I-CONTOUR-RESTRICT expected for SD consumption/result links
    const nonContour = hard.filter(e => e.code !== "I-CONTOUR-RESTRICT");
    expect(nonContour).toHaveLength(0);
  });
});

  it("computes compound states for Battery Pack (if exhibited)", () => {
    const r = loadModel(fixture);
    if (!r.ok) throw new Error("load failed");
    // Battery Pack exhibits Charge Level which has 2 states
    const cs = getCompoundStates(r.value, "obj-battery-pack");
    // Should have at least the Charge Level states
    expect(cs.length).toBeGreaterThanOrEqual(2);
  });
