import { describe, expect, it } from "vitest";
import { createObjectShape } from "../src/lib/renderers/jointjs/joint-shapes/object-shape";
import { createProcessShape } from "../src/lib/renderers/jointjs/joint-shapes/process-shape";
import { createStateShape } from "../src/lib/renderers/jointjs/joint-shapes/state-shape";
import { createFanShape } from "../src/lib/renderers/jointjs/joint-shapes/fan-shape";

describe("joint-shapes factories", () => {
  it("object shape is a Rectangle with systemic solid border by default", () => {
    const el = createObjectShape({
      id: "obj-1", label: "Thing", x: 0, y: 0, width: 160, height: 64, affiliation: "systemic",
    });
    expect(el.get("type")).toContain("Rectangle");
    expect(el.attr("body/strokeDasharray")).toBe("0");
  });

  it("object shape with environmental affiliation has dashed border (V-71)", () => {
    const el = createObjectShape({
      id: "obj-2", label: "X", x: 0, y: 0, width: 160, height: 64, affiliation: "environmental",
    });
    expect(el.attr("body/strokeDasharray")).toBe("6 4");
  });

  it("physical essence adds dropShadow filter (§1.3/V-1)", () => {
    const el = createObjectShape({
      id: "obj-3", label: "X", x: 0, y: 0, width: 160, height: 64, affiliation: "systemic", essence: "physical",
    });
    expect(el.attr("body/filter")).toBeDefined();
  });

  it("isRefined makes stroke thicker (V-69)", () => {
    const normal = createObjectShape({
      id: "obj-normal", label: "X", x: 0, y: 0, width: 160, height: 64, affiliation: "systemic",
    });
    const refined = createObjectShape({
      id: "obj-refined", label: "X", x: 0, y: 0, width: 160, height: 64, affiliation: "systemic", isRefined: true,
    });
    expect(Number(refined.attr("body/strokeWidth"))).toBeGreaterThan(Number(normal.attr("body/strokeWidth")));
  });

  it("process shape is an Ellipse", () => {
    const el = createProcessShape({
      id: "p-1", label: "P", x: 0, y: 0, width: 160, height: 72, affiliation: "systemic", isMainProcess: false,
    });
    expect(el.get("type")).toContain("Ellipse");
  });

  it("main process has heavier font weight", () => {
    const main = createProcessShape({
      id: "p-m", label: "M", x: 0, y: 0, width: 160, height: 72, affiliation: "systemic", isMainProcess: true,
    });
    const sub = createProcessShape({
      id: "p-s", label: "S", x: 0, y: 0, width: 160, height: 72, affiliation: "systemic", isMainProcess: false,
    });
    expect(Number(main.attr("label/fontWeight"))).toBeGreaterThan(Number(sub.attr("label/fontWeight")));
  });

  it("state shape initial has heavier stroke (§2.2)", () => {
    const normal = createStateShape({ id: "s1", label: "a", initial: false, final: false, default: false });
    const initial = createStateShape({ id: "s2", label: "b", initial: true, final: false, default: false });
    expect(Number(initial.attr("body/strokeWidth"))).toBeGreaterThan(Number(normal.attr("body/strokeWidth")));
  });

  it("state shape default prepends diagonal arrow glyph", () => {
    const s = createStateShape({ id: "s3", label: "c", initial: false, final: false, default: true });
    expect(String(s.attr("label/text"))).toContain("↘");
  });

  it("fan shape XOR renders a solid-bordered badge", () => {
    const f = createFanShape({ id: "f1", operator: "xor", x: 100, y: 100 });
    expect(f.attr("body/strokeDasharray")).toBe("0");
    expect(String(f.attr("label/text"))).toBe("XOR");
  });

  it("fan shape OR renders a dashed badge", () => {
    const f = createFanShape({ id: "f2", operator: "or", x: 100, y: 100 });
    expect(f.attr("body/strokeDasharray")).toBe("4 2");
  });

  it("fan shape AND throws (V-14 no explicit marker)", () => {
    expect(() => createFanShape({ id: "f3", operator: "and", x: 0, y: 0 })).toThrow();
  });
});
