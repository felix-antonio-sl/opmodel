import { describe, expect, it } from "vitest";
import { isoStyle } from "../src/lib/renderers/jointjs/style-packs/iso-19450";

describe("iso-19450 style pack — SSOT-guided constants", () => {
  it("exposes all axes required by opm-visual-es.md", () => {
    expect(isoStyle.dimensions).toBeDefined();
    expect(isoStyle.typography).toBeDefined();
    expect(isoStyle.palette).toBeDefined();
    expect(isoStyle.affiliation).toBeDefined();
    expect(isoStyle.essence).toBeDefined();
    expect(isoStyle.links).toBeDefined();
    expect(isoStyle.markers).toBeDefined();
  });

  it("V-71: environmental dash is not equivalent to systemic solid line", () => {
    expect(isoStyle.affiliation.environmentalDash).not.toBe(isoStyle.affiliation.systemicDash);
    expect(isoStyle.affiliation.systemicDash).toBe("0");
  });

  it("V-69: refined stroke is strictly heavier than normal stroke", () => {
    expect(isoStyle.dimensions.stroke.refined).toBeGreaterThan(isoStyle.dimensions.stroke.normal);
  });

  it("§2.2: initial state stroke is heavier than normal", () => {
    expect(isoStyle.dimensions.stroke.stateInitial).toBeGreaterThan(isoStyle.dimensions.stroke.stateFinalInner);
  });

  it("link kinds catalogued cover SSOT normative set", () => {
    const required = [
      "consumption", "result", "effect",
      "agent", "instrument",
      "invocation", "exception",
      "aggregation", "exhibition", "generalization", "classification",
      "tagged",
    ];
    for (const kind of required) {
      expect(isoStyle.links.byKind[kind], `missing link kind ${kind}`).toBeDefined();
    }
  });

  it("agent uses lollipop-black, instrument uses lollipop-white (§3.3)", () => {
    expect(isoStyle.links.byKind.agent.marker).toBe("lollipop-black");
    expect(isoStyle.links.byKind.instrument.marker).toBe("lollipop-white");
  });

  it("aggregation uses filled triangle, generalization uses hollow (§1.7)", () => {
    expect(isoStyle.links.byKind.aggregation.marker).toBe("triangle-filled");
    expect(isoStyle.links.byKind.generalization.marker).toBe("triangle-hollow");
  });

  it("event / condition marker labels are 'e' and 'c' (§4.1–§4.2)", () => {
    expect(isoStyle.markers.eventLabel).toBe("e");
    expect(isoStyle.markers.conditionLabel).toBe("c");
  });
});
