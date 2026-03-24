import { describe, it, expect } from "vitest";
import { createModel, addThing, addState, addLink, addAppearance, updateSettings, isOk, type Model, type Thing, type State, type Link } from "../src/index";
import { expose, render, renderAll } from "../src/opl";

function buildModelWithLang(lang: "en" | "es"): Model {
  let m = createModel("Test");
  const r0 = updateSettings(m, { opl_language: lang });
  if (!isOk(r0)) throw new Error("updateSettings failed");
  m = r0.value;

  const obj: Thing = { id: "obj-1", kind: "object", name: "Water", essence: "physical", affiliation: "systemic" };
  const proc: Thing = { id: "proc-1", kind: "process", name: "Heating", essence: "informatical", affiliation: "systemic" };
  let r = addThing(m, obj); m = isOk(r) ? r.value : m;
  r = addThing(m, proc); m = isOk(r) ? r.value : m;

  const s1: State = { id: "s-cold", parent: "obj-1", name: "cold", initial: true, final: false, default: true };
  const s2: State = { id: "s-hot", parent: "obj-1", name: "hot", initial: false, final: true, default: false };
  r = addState(m, s1); m = isOk(r) ? r.value : m;
  r = addState(m, s2); m = isOk(r) ? r.value : m;

  const link: Link = { id: "lnk-1", type: "effect", source: "proc-1", target: "obj-1" };
  r = addLink(m, link); m = isOk(r) ? r.value : m;

  const agent: Link = { id: "lnk-2", type: "agent", source: "obj-1", target: "proc-1" };
  r = addLink(m, agent); m = isOk(r) ? r.value : m;

  r = addAppearance(m, { thing: "obj-1", opd: "opd-sd", x: 50, y: 50, w: 120, h: 60 });
  m = isOk(r) ? r.value : m;
  r = addAppearance(m, { thing: "proc-1", opd: "opd-sd", x: 250, y: 50, w: 120, h: 60 });
  m = isOk(r) ? r.value : m;

  return m;
}

describe("OPL locale toggle", () => {
  it("renders in English by default", () => {
    const m = buildModelWithLang("en");
    const text = render(expose(m, "opd-sd"));
    expect(text).toContain("Water is an object, physical.");
    expect(text).toContain("Water can be cold or hot.");
    expect(text).toContain("Heating is a process, informatical.");
  });

  it("renders in Spanish when opl_language=es", () => {
    const m = buildModelWithLang("es");
    const text = render(expose(m, "opd-sd"));
    expect(text).toContain("Water es un objeto, físico.");
    expect(text).toContain("Water puede estar cold o hot.");
    expect(text).toContain("Heating es un proceso, informático.");
  });

  it("toggles language via updateSettings", () => {
    let m = buildModelWithLang("en");
    let text = render(expose(m, "opd-sd"));
    expect(text).toContain("is an object");

    const r = updateSettings(m, { opl_language: "es" });
    expect(isOk(r)).toBe(true);
    if (!isOk(r)) return;
    m = r.value;
    text = render(expose(m, "opd-sd"));
    expect(text).toContain("es un objeto");
    expect(text).not.toContain("is an object");
  });

  it("renderAll respects locale", () => {
    const m = buildModelWithLang("es");
    const full = renderAll(m);
    expect(full).toContain("=== SD ===");
    expect(full).toContain("es un objeto");
    expect(full).not.toContain("is an object");
  });

  it("expose sets locale in renderSettings", () => {
    const mEn = buildModelWithLang("en");
    const mEs = buildModelWithLang("es");
    expect(expose(mEn, "opd-sd").renderSettings.locale).toBe("en");
    expect(expose(mEs, "opd-sd").renderSettings.locale).toBe("es");
  });
});

describe("OPL computational rendering", () => {
  it("renders value_type and unit for computational objects", () => {
    let m = buildModelWithLang("en");
    // Add computational property to Water
    const water = m.things.get("obj-1")!;
    m = { ...m, things: new Map(m.things).set("obj-1", {
      ...water,
      computational: { value: 0, value_type: "float", unit: "°C" },
    }) };
    const text = render(expose(m, "opd-sd"));
    expect(text).toContain("of type float [°C]");
  });

  it("renders value_type in Spanish", () => {
    let m = buildModelWithLang("es");
    const water = m.things.get("obj-1")!;
    m = { ...m, things: new Map(m.things).set("obj-1", {
      ...water,
      computational: { value: 0, value_type: "integer", unit: "kg" },
    }) };
    const text = render(expose(m, "opd-sd"));
    expect(text).toContain("de tipo integer [kg]");
  });

  it("renders perseverance dynamic", () => {
    let m = buildModelWithLang("en");
    const water = m.things.get("obj-1")!;
    m = { ...m, things: new Map(m.things).set("obj-1", { ...water, perseverance: "dynamic" }) };
    const text = render(expose(m, "opd-sd"));
    expect(text).toContain("dynamic");
  });

  it("renders perseverance dynamic in Spanish", () => {
    let m = buildModelWithLang("es");
    const water = m.things.get("obj-1")!;
    m = { ...m, things: new Map(m.things).set("obj-1", { ...water, perseverance: "dynamic" }) };
    const text = render(expose(m, "opd-sd"));
    expect(text).toContain("dinámico");
  });
});
