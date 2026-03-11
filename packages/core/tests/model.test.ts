import { describe, it, expect } from "vitest";
import { ok, err, isOk, isErr } from "../src/result";
import { createModel } from "../src/model";

describe("Result", () => {
  it("ok wraps a value", () => {
    const r = ok(42);
    expect(isOk(r)).toBe(true);
    if (isOk(r)) expect(r.value).toBe(42);
  });

  it("err wraps an error", () => {
    const r = err({ code: "I-08", message: "duplicate id" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.code).toBe("I-08");
  });
});

describe("createModel", () => {
  it("creates empty model with name and defaults", () => {
    const model = createModel("Test System");
    expect(model.meta.name).toBe("Test System");
    expect(model.opmodel).toBe("1.1.0");
    expect(model.things.size).toBe(0);
    expect(model.states.size).toBe(0);
    expect(model.links.size).toBe(0);
    expect(model.opds.size).toBe(1);
    expect(model.opds.get("opd-sd")?.name).toBe("SD");
  });

  it("accepts optional system_type", () => {
    const model = createModel("Coffee", "artificial");
    expect(model.meta.system_type).toBe("artificial");
  });

  it("creates SD root OPD automatically", () => {
    const model = createModel("Test");
    const sd = model.opds.get("opd-sd");
    expect(sd).toBeDefined();
    expect(sd?.opd_type).toBe("hierarchical");
    expect(sd?.parent_opd).toBeNull();
  });
});
