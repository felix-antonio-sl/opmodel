import { describe, expect, it } from "vitest";
import { existsSync } from "fs";
import { resolve } from "path";
import { EXAMPLES } from "../src/App";

describe("example fixtures", () => {
  it("includes HODOM HSC v0 in the example registry", () => {
    expect(EXAMPLES.some((ex) => ex.file === "hodom-hsc-v0.opmodel")).toBe(true);
  });

  it("keeps the quick-open example list stable enough for daily use", () => {
    expect(EXAMPLES).toHaveLength(6);
    expect(EXAMPLES.map((ex) => ex.file)).toEqual([
      "coffee-making.opmodel",
      "driver-rescuing.opmodel",
      "hospitalizacion-domiciliaria.opmodel",
      "hodom-v2.opmodel",
      "hodom-hsc-v0.opmodel",
      "ev-ams.opmodel",
    ]);
  });

  it("all referenced example files exist in web public", () => {
    for (const example of EXAMPLES) {
      const fullPath = resolve(process.cwd(), "packages/web/public", example.file);
      expect(existsSync(fullPath)).toBe(true);
    }
  });
});
