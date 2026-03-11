// packages/cli/tests/slug.test.ts
import { describe, it, expect } from "vitest";
import { slug } from "../src/slug";

describe("slug", () => {
  it("lowercases", () => {
    expect(slug("Water")).toBe("water");
  });

  it("replaces spaces with hyphens", () => {
    expect(slug("Coffee Beans")).toBe("coffee-beans");
  });

  it("replaces non-alphanumeric with hyphens", () => {
    expect(slug("Hello@World!")).toBe("hello-world");
  });

  it("collapses multiple hyphens", () => {
    expect(slug("a--b---c")).toBe("a-b-c");
  });

  it("trims hyphens from ends", () => {
    expect(slug("-hello-")).toBe("hello");
  });

  it("handles mixed case with numbers", () => {
    expect(slug("SD1")).toBe("sd1");
  });

  it("handles Coffee Making System", () => {
    expect(slug("Coffee Making System")).toBe("coffee-making-system");
  });
});
