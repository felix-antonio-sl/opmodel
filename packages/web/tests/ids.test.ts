import { describe, it, expect } from "vitest";
import { genId } from "../src/lib/ids";

describe("genId", () => {
  it("returns a string starting with the given prefix followed by a hyphen", () => {
    const id = genId("usr");
    expect(id.startsWith("usr-")).toBe(true);
  });

  it("different prefixes produce different prefixes in output", () => {
    const a = genId("foo");
    const b = genId("bar");
    expect(a.startsWith("foo-")).toBe(true);
    expect(b.startsWith("bar-")).toBe(true);
    expect(a.slice(0, 4)).not.toBe(b.slice(0, 4));
  });

  it("consecutive calls produce different IDs", () => {
    const ids = new Set(Array.from({ length: 20 }, () => genId("x")));
    expect(ids.size).toBe(20);
  });

  it("suffix is alphanumeric (base-36 characters only)", () => {
    for (let i = 0; i < 50; i++) {
      const id = genId("test");
      const suffix = id.slice("test-".length);
      expect(suffix).toMatch(/^[a-z0-9]+$/);
    }
  });

  it("suffix length is between 1 and 8 characters", () => {
    for (let i = 0; i < 50; i++) {
      const id = genId("pfx");
      const suffix = id.slice("pfx-".length);
      expect(suffix.length).toBeGreaterThanOrEqual(1);
      expect(suffix.length).toBeLessThanOrEqual(8);
    }
  });
});
