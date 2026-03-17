import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { loadModel } from "../src/serialization";
import { createModel } from "../src/model";
import { addThing, addLink, addAppearance, findConsumptionResultPairs } from "../src/api";
import { resolveLinksForOpd } from "../src/simulation";
import type { Thing, Link } from "../src/types";
import { isOk } from "../src/result";

// === Helpers ===

const obj = (id: string, name: string): Thing => ({
  id, kind: "object", name, essence: "physical", affiliation: "systemic",
});

const proc = (id: string, name: string): Thing => ({
  id, kind: "process", name, essence: "physical", affiliation: "systemic",
});

function loadFixture(name: string) {
  const raw = readFileSync(resolve(__dirname, `../../../tests/${name}.opmodel`), "utf-8");
  const r = loadModel(raw);
  if (!isOk(r)) throw new Error(`Failed to load fixture: ${name}`);
  return r.value;
}

// === Tests ===

describe("findConsumptionResultPairs", () => {
  it("coffee-making SD1: no pairs (Water/Boiling is an effect link)", () => {
    const model = loadFixture("coffee-making");
    const resolved = resolveLinksForOpd(model, "opd-sd1");
    const pairs = findConsumptionResultPairs(model, resolved);

    // Water/Boiling is now an effect link, not consumption+result → no pairs
    expect(pairs).toHaveLength(0);
  });

  it("driver-rescuing SD1: no pairs (Call/CallTransmitting and DangerStatus/CallHandling are effect links)", () => {
    const model = loadFixture("driver-rescuing");
    const resolved = resolveLinksForOpd(model, "opd-sd1");
    const pairs = findConsumptionResultPairs(model, resolved);

    // Call/CallTransmitting and DangerStatus/CallHandling are now effect links → no pairs
    expect(pairs).toHaveLength(0);
  });

  it("stateless pair: consumption + result without states → valid pair", () => {
    // Build a minimal model with one stateless consumption+result pair
    let m = createModel("StatelessTest");
    const o = obj("o1", "Thing");
    const p = proc("p1", "Process");
    const consLink: Link = { id: "lnk-cons", type: "consumption", source: "o1", target: "p1" };
    const resLink: Link = { id: "lnk-res", type: "result", source: "p1", target: "o1" };

    let r = addThing(m, o); if (!isOk(r)) throw r.error; m = r.value;
    r = addThing(m, p); if (!isOk(r)) throw r.error; m = r.value;
    r = addAppearance(m, { thing: "o1", opd: "opd-sd", x: 0, y: 0, w: 100, h: 50 });
    if (!isOk(r)) throw r.error; m = r.value;
    r = addAppearance(m, { thing: "p1", opd: "opd-sd", x: 200, y: 0, w: 100, h: 50 });
    if (!isOk(r)) throw r.error; m = r.value;
    r = addLink(m, consLink); if (!isOk(r)) throw r.error; m = r.value;
    r = addLink(m, resLink); if (!isOk(r)) throw r.error; m = r.value;

    const resolved = resolveLinksForOpd(m, "opd-sd");
    const pairs = findConsumptionResultPairs(m, resolved);

    expect(pairs).toHaveLength(1);
    expect(pairs[0]!.objectId).toBe("o1");
    expect(pairs[0]!.processId).toBe("p1");
    expect(pairs[0]!.fromStateName).toBeUndefined();
    expect(pairs[0]!.toStateName).toBeUndefined();
  });

  it("consumption only (no matching result) → no pair", () => {
    let m = createModel("ConsOnly");
    const o = obj("o1", "Thing");
    const p = proc("p1", "Process");
    const consLink: Link = { id: "lnk-cons", type: "consumption", source: "o1", target: "p1" };

    let r = addThing(m, o); if (!isOk(r)) throw r.error; m = r.value;
    r = addThing(m, p); if (!isOk(r)) throw r.error; m = r.value;
    r = addAppearance(m, { thing: "o1", opd: "opd-sd", x: 0, y: 0, w: 100, h: 50 });
    if (!isOk(r)) throw r.error; m = r.value;
    r = addAppearance(m, { thing: "p1", opd: "opd-sd", x: 200, y: 0, w: 100, h: 50 });
    if (!isOk(r)) throw r.error; m = r.value;
    r = addLink(m, consLink); if (!isOk(r)) throw r.error; m = r.value;

    const resolved = resolveLinksForOpd(m, "opd-sd");
    const pairs = findConsumptionResultPairs(m, resolved);

    expect(pairs).toHaveLength(0);
  });

  it("result only (no matching consumption) → no pair", () => {
    let m = createModel("ResOnly");
    const o = obj("o1", "Thing");
    const p = proc("p1", "Process");
    const resLink: Link = { id: "lnk-res", type: "result", source: "p1", target: "o1" };

    let r = addThing(m, o); if (!isOk(r)) throw r.error; m = r.value;
    r = addThing(m, p); if (!isOk(r)) throw r.error; m = r.value;
    r = addAppearance(m, { thing: "o1", opd: "opd-sd", x: 0, y: 0, w: 100, h: 50 });
    if (!isOk(r)) throw r.error; m = r.value;
    r = addAppearance(m, { thing: "p1", opd: "opd-sd", x: 200, y: 0, w: 100, h: 50 });
    if (!isOk(r)) throw r.error; m = r.value;
    r = addLink(m, resLink); if (!isOk(r)) throw r.error; m = r.value;

    const resolved = resolveLinksForOpd(m, "opd-sd");
    const pairs = findConsumptionResultPairs(m, resolved);

    expect(pairs).toHaveLength(0);
  });

  it("OPD with no links → empty array", () => {
    let m = createModel("Empty");
    const o = obj("o1", "Thing");

    let r = addThing(m, o); if (!isOk(r)) throw r.error; m = r.value;
    r = addAppearance(m, { thing: "o1", opd: "opd-sd", x: 0, y: 0, w: 100, h: 50 });
    if (!isOk(r)) throw r.error; m = r.value;

    const resolved = resolveLinksForOpd(m, "opd-sd");
    const pairs = findConsumptionResultPairs(m, resolved);

    expect(pairs).toHaveLength(0);
  });
});
