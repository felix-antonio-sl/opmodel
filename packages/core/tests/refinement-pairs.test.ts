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
  it("coffee-making SD1: identifies 1 pair (Water, Boiling) with cold→hot", () => {
    const model = loadFixture("coffee-making");
    const resolved = resolveLinksForOpd(model, "opd-sd1");
    const pairs = findConsumptionResultPairs(model, resolved);

    // Only (Water, Boiling) is a real pair:
    //   consumption water@cold → proc-boiling + result proc-boiling → water@hot
    // (Coffee Beans, Grinding) is NOT a pair because consumption is on Coffee Beans
    //   but result goes to Ground Coffee (different object!)
    expect(pairs).toHaveLength(1);

    const [pair] = pairs;
    expect(pair!.objectId).toBe("obj-water");
    expect(pair!.processId).toBe("proc-boiling");
    expect(pair!.fromStateName).toBe("cold");
    expect(pair!.toStateName).toBe("hot");
    expect(pair!.consumptionLink.type).toBe("consumption");
    expect(pair!.resultLink.type).toBe("result");
  });

  it("driver-rescuing SD1: identifies 2 pairs", () => {
    const model = loadFixture("driver-rescuing");
    const resolved = resolveLinksForOpd(model, "opd-sd1");
    const pairs = findConsumptionResultPairs(model, resolved);

    expect(pairs).toHaveLength(2);

    // Sort by objectId for deterministic assertion
    const sorted = [...pairs].sort((a, b) => a.objectId.localeCompare(b.objectId));

    // Pair 1: (Call, Call Transmitting) — requested → online
    expect(sorted[0]!.objectId).toBe("obj-call");
    expect(sorted[0]!.processId).toBe("proc-call-transmitting");
    expect(sorted[0]!.fromStateName).toBe("requested");
    expect(sorted[0]!.toStateName).toBe("online");

    // Pair 2: (Danger Status, Call Handling) — endangered → safe
    expect(sorted[1]!.objectId).toBe("obj-danger-status");
    expect(sorted[1]!.processId).toBe("proc-call-handling");
    expect(sorted[1]!.fromStateName).toBe("endangered");
    expect(sorted[1]!.toStateName).toBe("safe");
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
