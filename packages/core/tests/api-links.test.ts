import { describe, it, expect } from "vitest";
import { createModel } from "../src/model";
import { addThing, addLink, removeLink, validate, addState } from "../src/api";
import { isOk, isErr } from "../src/result";
import type { Thing, Link } from "../src/types";

const barista: Thing = { id: "obj-barista", kind: "object", name: "Barista", essence: "physical", affiliation: "systemic" };
const water: Thing = { id: "obj-water", kind: "object", name: "Water", essence: "physical", affiliation: "systemic" };
const heating: Thing = { id: "proc-heating", kind: "process", name: "Heating", essence: "physical", affiliation: "systemic" };

function buildModel() {
  let m = createModel("Test");
  m = (addThing(m, barista) as any).value;
  m = (addThing(m, water) as any).value;
  m = (addThing(m, heating) as any).value;
  return m;
}

describe("addLink", () => {
  it("adds a valid link", () => {
    const m = buildModel();
    const link: Link = { id: "lnk-agent", type: "agent", source: "obj-barista", target: "proc-heating" };
    const r = addLink(m, link);
    expect(isOk(r)).toBe(true);
    if (isOk(r)) expect(r.value.links.size).toBe(1);
  });

  it("rejects link with non-existent source (I-05)", () => {
    const r = addLink(buildModel(), { id: "lnk-bad", type: "effect", source: "proc-ghost", target: "obj-water" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-05");
  });

  it("rejects link with non-existent target (I-05)", () => {
    const r = addLink(buildModel(), { id: "lnk-bad", type: "effect", source: "proc-heating", target: "obj-ghost" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-05");
  });

  it("rejects duplicate id (I-08)", () => {
    let m = buildModel();
    const link: Link = { id: "lnk-agent", type: "agent", source: "obj-barista", target: "proc-heating" };
    m = (addLink(m, link) as any).value;
    const r = addLink(m, { ...link });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-08");
  });

  it("exhibition link coerces source essence to informatical (I-19)", () => {
    const attr: Thing = { id: "obj-attr", kind: "object", name: "Color", essence: "physical", affiliation: "systemic" };
    let m = buildModel();
    m = (addThing(m, attr) as any).value;
    const link: Link = { id: "lnk-exhibit", type: "exhibition", source: "obj-attr", target: "obj-water" };
    const r = addLink(m, link);
    expect(isOk(r)).toBe(true);
    if (isOk(r)) expect(r.value.things.get("obj-attr")?.essence).toBe("informatical");
  });

  it("rejects agent link from informatical source (I-18)", () => {
    const infoObj: Thing = { id: "obj-info", kind: "object", name: "Info", essence: "informatical", affiliation: "systemic" };
    let m = buildModel();
    m = (addThing(m, infoObj) as any).value;
    const r = addLink(m, { id: "lnk-bad-agent", type: "agent", source: "obj-info", target: "proc-heating" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-18");
  });

  it("rejects exception link when source has no duration.max (I-14)", () => {
    const proc2: Thing = { id: "proc-main", kind: "process", name: "Main", essence: "physical", affiliation: "systemic" };
    let m = buildModel();
    m = (addThing(m, proc2) as any).value;
    const r = addLink(m, { id: "lnk-exc", type: "exception", source: "proc-heating", target: "proc-main" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-14");
  });

  it("allows exhibition link between object and process — ISO §7.2.2 exception (I-27 fix)", () => {
    const operation: Thing = { id: "proc-op", kind: "process", name: "GetColor", essence: "informatical", affiliation: "systemic" };
    let m = buildModel();
    m = (addThing(m, operation) as any).value;
    const link: Link = { id: "lnk-exhibit-cross", type: "exhibition", source: "proc-op", target: "obj-water" };
    const r = addLink(m, link);
    expect(isOk(r)).toBe(true);
    if (isOk(r)) {
      const errors = validate(r.value);
      const i27 = errors.filter(e => e.code === "I-27");
      expect(i27).toHaveLength(0);
    }
  });

  it("allows exception link when source has duration.max (I-14)", () => {
    const procWithMax: Thing = { id: "proc-timed", kind: "process", name: "Timed", essence: "physical", affiliation: "systemic", duration: { nominal: 60, max: 120, unit: "s" } };
    const proc2: Thing = { id: "proc-handler", kind: "process", name: "Handler", essence: "physical", affiliation: "systemic" };
    let m = createModel("Test");
    m = (addThing(m, procWithMax) as any).value;
    m = (addThing(m, proc2) as any).value;
    const r = addLink(m, { id: "lnk-exc", type: "exception", source: "proc-timed", target: "proc-handler" });
    expect(isOk(r)).toBe(true);
  });

  // --- I-33: Procedural link endpoint type validation ---

  it("rejects consumption link between two processes (I-33)", () => {
    const proc2: Thing = { id: "proc-2", kind: "process", name: "P2", essence: "physical", affiliation: "systemic" };
    let m = buildModel();
    m = (addThing(m, proc2) as any).value;
    const r = addLink(m, { id: "lnk-bad", type: "consumption", source: "proc-heating", target: "proc-2" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-33");
  });

  it("rejects consumption link between two objects (I-33)", () => {
    const r = addLink(buildModel(), { id: "lnk-bad", type: "consumption", source: "obj-barista", target: "obj-water" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-33");
  });

  it("rejects effect link between two objects (I-33)", () => {
    const r = addLink(buildModel(), { id: "lnk-bad", type: "effect", source: "obj-barista", target: "obj-water" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-33");
  });

  it("rejects instrument link between two processes (I-33)", () => {
    const proc2: Thing = { id: "proc-2", kind: "process", name: "P2", essence: "physical", affiliation: "systemic" };
    let m = buildModel();
    m = (addThing(m, proc2) as any).value;
    const r = addLink(m, { id: "lnk-bad", type: "instrument", source: "proc-heating", target: "proc-2" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-33");
  });

  it("allows consumption link from object to process (I-33 valid — ISO convention)", () => {
    const r = addLink(buildModel(), { id: "lnk-ok", type: "consumption", source: "obj-water", target: "proc-heating" });
    expect(isOk(r)).toBe(true);
  });

  it("allows effect link from process to object (I-33 valid)", () => {
    const r = addLink(buildModel(), { id: "lnk-ok", type: "effect", source: "proc-heating", target: "obj-water" });
    expect(isOk(r)).toBe(true);
  });

  it("allows result link from process to object (I-33 valid)", () => {
    const r = addLink(buildModel(), { id: "lnk-ok", type: "result", source: "proc-heating", target: "obj-water" });
    expect(isOk(r)).toBe(true);
  });

  it("does not apply I-33 to structural links (tagged between two objects is valid)", () => {
    const r = addLink(buildModel(), { id: "lnk-tagged", type: "tagged", source: "obj-barista", target: "obj-water", tag: "knows" });
    expect(isOk(r)).toBe(true);
  });

  // --- I-34: Self-loop prevention (except invocation) ---

  it("rejects self-loop aggregation link (I-34)", () => {
    const r = addLink(buildModel(), { id: "lnk-self", type: "aggregation", source: "obj-water", target: "obj-water" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-34");
  });

  it("rejects self-loop tagged link (I-34)", () => {
    const r = addLink(buildModel(), { id: "lnk-self-tag", type: "tagged", source: "obj-water", target: "obj-water", tag: "self" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-34");
  });

  it("allows self-invocation link (I-34 exception, ISO §8.5)", () => {
    const r = addLink(buildModel(), { id: "lnk-self-invoke", type: "invocation", source: "proc-heating", target: "proc-heating" });
    expect(isOk(r)).toBe(true);
  });

  // --- I-16-EXT: Enabling link uniqueness ---

  it("rejects duplicate enabling role for same (object, process) pair (I-16-EXT)", () => {
    let m = buildModel();
    m = (addLink(m, { id: "lnk-agent", type: "agent", source: "obj-barista", target: "proc-heating" }) as any).value;
    const r = addLink(m, { id: "lnk-instrument", type: "instrument", source: "obj-barista", target: "proc-heating" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-16");
  });

  it("rejects duplicate enabling — instrument then agent (I-16-EXT)", () => {
    let m = buildModel();
    m = (addLink(m, { id: "lnk-inst", type: "instrument", source: "obj-water", target: "proc-heating" }) as any).value;
    const r = addLink(m, { id: "lnk-agent2", type: "agent", source: "obj-water", target: "proc-heating" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-16");
  });

  it("allows different objects as enablers of same process (I-16-EXT valid)", () => {
    let m = buildModel();
    m = (addLink(m, { id: "lnk-agent", type: "agent", source: "obj-barista", target: "proc-heating" }) as any).value;
    const r = addLink(m, { id: "lnk-inst", type: "instrument", source: "obj-water", target: "proc-heating" });
    expect(isOk(r)).toBe(true);
  });

  // --- I-22..I-26: Structural invariants in addLink ---

  it("rejects generalization between object and process (I-22)", () => {
    const r = addLink(buildModel(), { id: "lnk-gen", type: "generalization", source: "obj-water", target: "proc-heating" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-22");
  });

  it("rejects classification between object and process (I-23)", () => {
    const r = addLink(buildModel(), { id: "lnk-cls", type: "classification", source: "obj-water", target: "proc-heating" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-23");
  });

  it("rejects invocation from object to process (I-24)", () => {
    const r = addLink(buildModel(), { id: "lnk-inv", type: "invocation", source: "obj-water", target: "proc-heating" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-24");
  });

  it("rejects exception between process and object (I-25)", () => {
    const procTimed: Thing = { id: "proc-timed", kind: "process", name: "Timed", essence: "physical", affiliation: "systemic", duration: { nominal: 60, max: 120, unit: "s" } };
    let m = buildModel();
    m = (addThing(m, procTimed) as any).value;
    const r = addLink(m, { id: "lnk-exc", type: "exception", source: "proc-timed", target: "obj-water" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-25");
  });

  it("rejects aggregation between object and process (I-26)", () => {
    const r = addLink(buildModel(), { id: "lnk-agg", type: "aggregation", source: "obj-water", target: "proc-heating" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-26");
  });

  it("allows generalization between two objects (I-22 valid)", () => {
    const r = addLink(buildModel(), { id: "lnk-gen-ok", type: "generalization", source: "obj-water", target: "obj-barista" });
    expect(isOk(r)).toBe(true);
  });

  // --- I-28: State-specified link validation in addLink ---

  it("rejects source_state not belonging to source thing (I-28)", () => {
    let m = buildModel();
    m = (addState(m, { id: "st-cold", parent: "obj-water", name: "cold", initial: false, final: false, default: false }) as any).value;
    // agent link: barista→heating with source_state=st-cold (belongs to water, not barista)
    const r = addLink(m, { id: "lnk-bad", type: "agent", source: "obj-barista", target: "proc-heating", source_state: "st-cold" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-28");
  });

  it("rejects non-existent source_state (I-28)", () => {
    const r = addLink(buildModel(), { id: "lnk-bad", type: "agent", source: "obj-barista", target: "proc-heating", source_state: "st-nonexistent" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-28");
  });

  it("rejects target_state not belonging to object endpoint (I-28)", () => {
    let m = buildModel();
    m = (addState(m, { id: "st-cold", parent: "obj-water", name: "cold", initial: false, final: false, default: false }) as any).value;
    m = (addState(m, { id: "st-ready", parent: "obj-barista", name: "ready", initial: false, final: false, default: false }) as any).value;
    // consumption: water→heating (ISO), source_state=st-ready (belongs to barista, not water)
    const r = addLink(m, { id: "lnk-bad", type: "consumption", source: "obj-water", target: "proc-heating", source_state: "st-ready" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-28");
  });

  it("allows valid source_state on enabling link (I-28 valid)", () => {
    let m = buildModel();
    m = (addState(m, { id: "st-awake", parent: "obj-barista", name: "awake", initial: false, final: false, default: false }) as any).value;
    const r = addLink(m, { id: "lnk-ok", type: "agent", source: "obj-barista", target: "proc-heating", source_state: "st-awake" });
    expect(isOk(r)).toBe(true);
  });
});

describe("removeLink", () => {
  it("removes an existing link", () => {
    let m = buildModel();
    m = (addLink(m, { id: "lnk-agent", type: "agent", source: "obj-barista", target: "proc-heating" }) as any).value;
    const r = removeLink(m, "lnk-agent");
    expect(isOk(r)).toBe(true);
    if (isOk(r)) expect(r.value.links.size).toBe(0);
  });

  it("cascade removes modifiers over the link", () => {
    let m = buildModel();
    m = (addLink(m, { id: "lnk-effect", type: "effect", source: "proc-heating", target: "obj-water" }) as any).value;
    m = { ...m, modifiers: new Map(m.modifiers).set("mod-ev", { id: "mod-ev", over: "lnk-effect", type: "event" as const }) };
    const r = removeLink(m, "lnk-effect");
    expect(isOk(r)).toBe(true);
    if (isOk(r)) expect(r.value.modifiers.size).toBe(0);
  });
});
