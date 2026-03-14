import { describe, it, expect } from "vitest";
import { createModel } from "../src/model";
import { addThing, addLink, removeLink, validate } from "../src/api";
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
