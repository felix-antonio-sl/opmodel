import { describe, expect, it } from "vitest";
import { existsSync } from "fs";
import { resolve } from "path";
import { EXAMPLES } from "../src/App";

describe("example fixtures", () => {
  it("includes HODOM HSC v0 in the file menu examples", () => {
    expect(EXAMPLES.some((ex) => ex.file === "hodom-hsc-v0.opmodel")).toBe(true);
  });

  it("all referenced example files exist in web public", () => {
    for (const example of EXAMPLES) {
      const fullPath = resolve(process.cwd(), "packages/web/public", example.file);
      expect(existsSync(fullPath)).toBe(true);
    }
  });
});
