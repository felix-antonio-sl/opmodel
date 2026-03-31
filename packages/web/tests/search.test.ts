import { describe, expect, it } from "vitest";
import { loadModel } from "@opmodel/core";
import { readFileSync } from "fs";
import { resolve } from "path";
import { buildSearchResults } from "../src/lib/search";

describe("buildSearchResults", () => {
  it("prioritizes current OPD and exact/prefix matches", () => {
    const fixture = readFileSync(resolve(process.cwd(), "tests/ev-ams.opmodel"), "utf8");
    const parsed = loadModel(fixture);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const report = buildSearchResults(parsed.value, "threat", "opd-sd1-1", 10);
    expect(report.length).toBeGreaterThan(0);
    expect(report[0]?.thing.name.toLowerCase()).toContain("threat");
    expect(report.some((item) => item.inCurrentOpd)).toBe(true);
  });

  it("finds things by matching state names", () => {
    const fixture = readFileSync(resolve(process.cwd(), "tests/ev-ams.opmodel"), "utf8");
    const parsed = loadModel(fixture);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const report = buildSearchResults(parsed.value, "warning", "opd-sd1-1-1", 20);
    expect(report.length).toBeGreaterThan(0);
    expect(report.some((item) => item.matchedStates.some((state) => state.toLowerCase() === "warning"))).toBe(true);
  });

  it("returns current-opd items first when query is empty", () => {
    const fixture = readFileSync(resolve(process.cwd(), "tests/ev-ams.opmodel"), "utf8");
    const parsed = loadModel(fixture);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const report = buildSearchResults(parsed.value, "", "opd-sd1-1-1", 20);
    expect(report.length).toBeGreaterThan(0);
    expect(report[0]?.inCurrentOpd).toBe(true);
  });
});
