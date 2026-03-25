import { describe, it, expect } from "vitest";
import { createModel } from "../src/model";
import { addThing, addLink, addAppearance, validate } from "../src/api";
import { isOk } from "../src/result";
import { verifyMethodology } from "../src/methodology";
import { loadModel } from "../src/serialization";
import { readFileSync } from "fs";
import { resolve } from "path";
import type { Thing, Link } from "../src/types";

function buildModel() {
  let m = createModel("Test");
  const proc: Thing = { id: "proc-1", kind: "process", name: "Coffee Making", essence: "physical", affiliation: "systemic" };
  const obj: Thing = { id: "obj-1", kind: "object", name: "Coffee", essence: "physical", affiliation: "systemic" };
  let r = addThing(m, proc); m = isOk(r) ? r.value : m;
  r = addThing(m, obj); m = isOk(r) ? r.value : m;
  r = addAppearance(m, { thing: "proc-1", opd: "opd-sd", x: 0, y: 0, w: 120, h: 60 }); m = isOk(r) ? r.value : m;
  r = addAppearance(m, { thing: "obj-1", opd: "opd-sd", x: 200, y: 0, w: 120, h: 60 }); m = isOk(r) ? r.value : m;
  return m;
}

describe("Methodology validation (P0)", () => {
  it("I-GERUND: warns when process name lacks gerund", () => {
    const m = buildModel();
    const errors = validate(m);
    const gerund = errors.filter(e => e.code === "I-GERUND");
    // "Coffee Making" ends in "ing" — should NOT trigger
    expect(gerund).toHaveLength(0);
  });

  it("I-GERUND: warns for non-gerund process name", () => {
    let m = createModel("Test");
    const proc: Thing = { id: "proc-1", kind: "process", name: "Brew Coffee", essence: "physical", affiliation: "systemic" };
    let r = addThing(m, proc); m = isOk(r) ? r.value : m;
    r = addAppearance(m, { thing: "proc-1", opd: "opd-sd", x: 0, y: 0, w: 120, h: 60 }); m = isOk(r) ? r.value : m;
    const errors = validate(m);
    expect(errors.some(e => e.code === "I-GERUND")).toBe(true);
  });

  it("I-TRANSFORMEE: warns when process has no transforming link", () => {
    const m = buildModel();
    const errors = validate(m);
    // proc-1 has no effect/consumption/result links
    expect(errors.some(e => e.code === "I-TRANSFORMEE" && e.entity === "proc-1")).toBe(true);
  });

  it("I-TRANSFORMEE: no warning when process has effect link", () => {
    let m = buildModel();
    const link: Link = { id: "lnk-1", type: "effect", source: "proc-1", target: "obj-1" };
    let r = addLink(m, link); m = isOk(r) ? r.value : m;
    const errors = validate(m);
    expect(errors.some(e => e.code === "I-TRANSFORMEE" && e.entity === "proc-1")).toBe(false);
  });

  it("I-ENVIRONMENT: info when no environmental objects", () => {
    let m = buildModel();
    // Add more things to trigger (threshold is >3 things)
    const obj2: Thing = { id: "obj-2", kind: "object", name: "Water", essence: "physical", affiliation: "systemic" };
    const obj3: Thing = { id: "obj-3", kind: "object", name: "Cup", essence: "physical", affiliation: "systemic" };
    let r = addThing(m, obj2); m = isOk(r) ? r.value : m;
    r = addThing(m, obj3); m = isOk(r) ? r.value : m;
    const errors = validate(m);
    expect(errors.some(e => e.code === "I-ENVIRONMENT")).toBe(true);
  });

  it("I-ENVIRONMENT: no warning when environmental object exists", () => {
    let m = buildModel();
    const env: Thing = { id: "obj-env", kind: "object", name: "Weather", essence: "physical", affiliation: "environmental" };
    let r = addThing(m, env); m = isOk(r) ? r.value : m;
    // Need >3 things total
    const obj2: Thing = { id: "obj-2", kind: "object", name: "Water", essence: "physical", affiliation: "systemic" };
    r = addThing(m, obj2); m = isOk(r) ? r.value : m;
    const errors = validate(m);
    expect(errors.some(e => e.code === "I-ENVIRONMENT")).toBe(false);
  });

  it("I-SINGULAR: info for plural-looking names without Set/Group", () => {
    let m = createModel("Test");
    const obj: Thing = { id: "obj-1", kind: "object", name: "Passengers", essence: "physical", affiliation: "systemic" };
    let r = addThing(m, obj); m = isOk(r) ? r.value : m;
    const errors = validate(m);
    expect(errors.some(e => e.code === "I-SINGULAR")).toBe(true);
  });

  it("I-SINGULAR: no warning for Set/Group suffix", () => {
    let m = createModel("Test");
    const obj: Thing = { id: "obj-1", kind: "object", name: "Passenger Group", essence: "physical", affiliation: "systemic" };
    let r = addThing(m, obj); m = isOk(r) ? r.value : m;
    const errors = validate(m);
    expect(errors.some(e => e.code === "I-SINGULAR" && e.entity === "obj-1")).toBe(false);
  });

  it("all methodology warnings have non-error severity", () => {
    const m = buildModel();
    const errors = validate(m);
    const methodology = errors.filter(e =>
      ["I-GERUND", "I-TRANSFORMEE", "I-ENVIRONMENT", "I-SINGULAR", "I-EXHIBITION"].includes(e.code)
    );
    for (const e of methodology) {
      expect(e.severity).toBeDefined();
      expect(e.severity).not.toBe("error");
    }
  });
});

describe("verifyMethodology checklist", () => {
  it("returns checks for SD, SD1, and global levels", () => {
    const m = buildModel();
    const checks = verifyMethodology(m);
    expect(checks.length).toBeGreaterThanOrEqual(10);
    expect(checks.some(c => c.level === "SD")).toBe(true);
    expect(checks.some(c => c.level === "global")).toBe(true);
  });

  it("EV-AMS passes most SD checks", () => {
    const fixture = readFileSync(resolve(__dirname, "../../../tests/ev-ams.opmodel"), "utf8");
    const r = loadModel(fixture);
    if (!r.ok) throw new Error("load failed");
    const checks = verifyMethodology(r.value);
    const sdChecks = checks.filter(c => c.level === "SD");
    const sdPassed = sdChecks.filter(c => c.passed).length;
    expect(sdPassed).toBeGreaterThanOrEqual(7);
  });
});
