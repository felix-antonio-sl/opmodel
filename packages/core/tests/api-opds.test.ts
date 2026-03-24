import { describe, it, expect } from "vitest";
import { createModel } from "../src/model";
import { addOPD, removeOPD } from "../src/api";
import { isOk, isErr } from "../src/result";
import type { OPD } from "../src/types";

describe("addOPD", () => {
  it("adds a hierarchical child OPD", () => {
    const r = addOPD(createModel("Test"), { id: "opd-sd1", name: "SD1", opd_type: "hierarchical", parent_opd: "opd-sd" });
    expect(isOk(r)).toBe(true);
    if (isOk(r)) expect(r.value.opds.size).toBe(2);
  });

  it("rejects hierarchical OPD with non-existent parent (I-03)", () => {
    const r = addOPD(createModel("Test"), { id: "opd-orphan", name: "Orphan", opd_type: "hierarchical", parent_opd: "opd-ghost" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-03");
  });

  it("adds a view OPD with parent_opd=null", () => {
    const r = addOPD(createModel("Test"), { id: "opd-view1", name: "View 1", opd_type: "view", parent_opd: null });
    expect(isOk(r)).toBe(true);
  });

  it("rejects duplicate id (I-08)", () => {
    const r = addOPD(createModel("Test"), { id: "opd-sd", name: "Clash", opd_type: "hierarchical", parent_opd: null });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-08");
  });
});

describe("removeOPD", () => {
  it("removes an OPD", () => {
    let m = createModel("Test");
    m = (addOPD(m, { id: "opd-sd1", name: "SD1", opd_type: "hierarchical", parent_opd: "opd-sd" }) as any).value;
    const r = removeOPD(m, "opd-sd1");
    expect(isOk(r)).toBe(true);
    if (isOk(r)) expect(r.value.opds.size).toBe(1);
  });

  it("cascade removes appearances in removed OPD", () => {
    let m = createModel("Test");
    m = (addOPD(m, { id: "opd-sd1", name: "SD1", opd_type: "hierarchical", parent_opd: "opd-sd" }) as any).value;
    m = { ...m, appearances: new Map(m.appearances).set("obj-x::opd-sd1", { thing: "obj-x", opd: "opd-sd1", x: 0, y: 0, w: 100, h: 50 }) };
    const r = removeOPD(m, "opd-sd1");
    expect(isOk(r)).toBe(true);
    if (isOk(r)) expect(r.value.appearances.size).toBe(0);
  });

  // R-NT-3: only leaf OPDs are deletable
  it("rejects deletion of non-leaf OPD (R-NT-3)", () => {
    let m = createModel("Test");
    m = (addOPD(m, { id: "opd-sd1", name: "SD1", opd_type: "hierarchical", parent_opd: "opd-sd" }) as any).value;
    m = (addOPD(m, { id: "opd-sd1-1", name: "SD1.1", opd_type: "hierarchical", parent_opd: "opd-sd1" }) as any).value;
    const r = removeOPD(m, "opd-sd1");
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("NON_LEAF_OPD");
  });

  it("allows deletion of leaf OPD that previously had children removed", () => {
    let m = createModel("Test");
    m = (addOPD(m, { id: "opd-sd1", name: "SD1", opd_type: "hierarchical", parent_opd: "opd-sd" }) as any).value;
    m = (addOPD(m, { id: "opd-sd1-1", name: "SD1.1", opd_type: "hierarchical", parent_opd: "opd-sd1" }) as any).value;
    // Remove child first (leaf), then parent becomes leaf
    m = (removeOPD(m, "opd-sd1-1") as any).value;
    const r = removeOPD(m, "opd-sd1");
    expect(isOk(r)).toBe(true);
    if (isOk(r)) expect(r.value.opds.size).toBe(1);
  });
});
