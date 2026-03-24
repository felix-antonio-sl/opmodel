import { describe, it, expect } from "vitest";
import { loadModel } from "../src/serialization";
import { readFileSync } from "fs";
import { resolve } from "path";
const fixture = readFileSync(resolve(__dirname, "../../../tests/hospitalizacion-domiciliaria.opmodel"), "utf8");
describe("HODOM semantic checks", () => {
  it("all link endpoints exist", () => {
    const r = loadModel(fixture);
    if (!r.ok) throw new Error("load failed");
    for (const [, link] of r.value.links) {
      expect(r.value.things.has(link.source), `source ${link.source} of ${link.id}`).toBe(true);
      expect(r.value.things.has(link.target), `target ${link.target} of ${link.id}`).toBe(true);
    }
  });

  it("all state parents exist", () => {
    const r = loadModel(fixture);
    if (!r.ok) throw new Error("load failed");
    for (const [, state] of r.value.states) {
      expect(r.value.things.has(state.parent), `parent ${state.parent} of state ${state.id}`).toBe(true);
    }
  });

  it("all appearances reference valid things and OPDs", () => {
    const r = loadModel(fixture);
    if (!r.ok) throw new Error("load failed");
    for (const app of r.value.appearances.values()) {
      expect(r.value.things.has(app.thing), `thing ${app.thing}`).toBe(true);
      expect(r.value.opds.has(app.opd), `opd ${app.opd}`).toBe(true);
    }
  });

  it("all fan members exist as links", () => {
    const r = loadModel(fixture);
    if (!r.ok) throw new Error("load failed");
    for (const fan of r.value.fans.values()) {
      for (const memberId of fan.members) {
        expect(r.value.links.has(memberId), `fan member ${memberId} of ${fan.id}`).toBe(true);
      }
    }
  });

  it("all modifier targets exist as links", () => {
    const r = loadModel(fixture);
    if (!r.ok) throw new Error("load failed");
    for (const mod of r.value.modifiers.values()) {
      expect(r.value.links.has(mod.over), `modifier target ${mod.over} of ${mod.id}`).toBe(true);
    }
  });

  it("every object with states has at least one initial state", () => {
    const r = loadModel(fixture);
    if (!r.ok) throw new Error("load failed");
    const objectsWithStates = new Set<string>();
    for (const state of r.value.states.values()) {
      objectsWithStates.add(state.parent);
    }
    for (const objId of objectsWithStates) {
      const states = [...r.value.states.values()].filter(s => s.parent === objId);
      const hasInitial = states.some(s => s.initial);
      expect(hasInitial, `${r.value.things.get(objId)?.name} has no initial state`).toBe(true);
    }
  });
});
