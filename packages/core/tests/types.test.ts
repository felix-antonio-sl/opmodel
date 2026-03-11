import { describe, it, expect } from "vitest";
import type { Thing, State, Link, Model } from "../src/types";

describe("types", () => {
  it("Thing with kind=object compiles", () => {
    const t: Thing = {
      id: "obj-water", kind: "object", name: "Water",
      essence: "physical", affiliation: "systemic",
    };
    expect(t.kind).toBe("object");
  });

  it("Thing with kind=process and duration compiles", () => {
    const t: Thing = {
      id: "proc-heating", kind: "process", name: "Heating",
      essence: "physical", affiliation: "systemic",
      duration: { nominal: 60, unit: "s" },
    };
    expect(t.duration?.nominal).toBe(60);
  });

  it("Link with type=tagged requires tag", () => {
    const l: Link = {
      id: "lnk-foo", type: "tagged", source: "obj-a", target: "obj-b",
      tag: "relates-to",
    };
    expect(l.tag).toBe("relates-to");
  });
});
