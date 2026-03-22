// packages/core/tests/opl-fan.test.ts
import { describe, it, expect } from "vitest";
import { createModel } from "../src/model";
import {
  addThing, addState, addLink, addAppearance, addFan,
} from "../src/api";
import { isOk } from "../src/result";
import { expose, render } from "../src/opl";
import type { Thing, Appearance, Fan } from "../src/types";

// === Fixtures ===

const processP: Thing = {
  id: "proc-p", kind: "process", name: "Producing",
  essence: "informatical", affiliation: "systemic",
};
const objA: Thing = {
  id: "obj-a", kind: "object", name: "Alpha",
  essence: "physical", affiliation: "systemic",
};
const objB: Thing = {
  id: "obj-b", kind: "object", name: "Beta",
  essence: "physical", affiliation: "systemic",
};
const objC: Thing = {
  id: "obj-c", kind: "object", name: "Gamma",
  essence: "physical", affiliation: "systemic",
};

const procQ: Thing = {
  id: "proc-q", kind: "process", name: "Querying",
  essence: "informatical", affiliation: "systemic",
};
const procR: Thing = {
  id: "proc-r", kind: "process", name: "Reporting",
  essence: "informatical", affiliation: "systemic",
};

function ok<T>(r: { ok: boolean; value?: T; error?: unknown }): T {
  if (!isOk(r)) throw new Error(`Expected ok, got error: ${JSON.stringify((r as any).error)}`);
  return r.value;
}

/** Build model with process P and objects A, B, C, all visible in opd-sd */
function buildBaseModel() {
  let m = createModel("FanTest");
  m = ok(addThing(m, processP));
  m = ok(addThing(m, objA));
  m = ok(addThing(m, objB));
  m = ok(addThing(m, objC));
  m = ok(addAppearance(m, { thing: "proc-p", opd: "opd-sd", x: 300, y: 200, w: 120, h: 60 }));
  m = ok(addAppearance(m, { thing: "obj-a", opd: "opd-sd", x: 100, y: 100, w: 120, h: 60 }));
  m = ok(addAppearance(m, { thing: "obj-b", opd: "opd-sd", x: 100, y: 200, w: 120, h: 60 }));
  m = ok(addAppearance(m, { thing: "obj-c", opd: "opd-sd", x: 100, y: 300, w: 120, h: 60 }));
  return m;
}

/** Build model with P and processes Q, R, all visible */
function buildProcessModel() {
  let m = createModel("FanProcessTest");
  m = ok(addThing(m, processP));
  m = ok(addThing(m, procQ));
  m = ok(addThing(m, procR));
  m = ok(addAppearance(m, { thing: "proc-p", opd: "opd-sd", x: 300, y: 200, w: 120, h: 60 }));
  m = ok(addAppearance(m, { thing: "proc-q", opd: "opd-sd", x: 100, y: 100, w: 120, h: 60 }));
  m = ok(addAppearance(m, { thing: "proc-r", opd: "opd-sd", x: 100, y: 300, w: 120, h: 60 }));
  return m;
}

// === XOR Converging Consumption ===

describe("OPL Fan Sentences", () => {
  describe("XOR converging consumption", () => {
    it("renders 'P consumes exactly one of A, B, or C.'", () => {
      let m = buildBaseModel();
      // consumption: source=object, target=process (ISO direction)
      m = ok(addLink(m, { id: "lnk-a-cons-p", type: "consumption", source: "obj-a", target: "proc-p" }));
      m = ok(addLink(m, { id: "lnk-b-cons-p", type: "consumption", source: "obj-b", target: "proc-p" }));
      m = ok(addLink(m, { id: "lnk-c-cons-p", type: "consumption", source: "obj-c", target: "proc-p" }));
      m = ok(addFan(m, {
        id: "fan-xor-cons",
        type: "xor",
        members: ["lnk-a-cons-p", "lnk-b-cons-p", "lnk-c-cons-p"],
      }));

      const doc = expose(m, "opd-sd");
      const text = render(doc);
      expect(text).toContain("Producing consumes exactly one of Alpha, Beta, or Gamma.");
      // Individual consumption sentences should NOT appear
      expect(text).not.toContain("Producing consumes Alpha.");
      expect(text).not.toContain("Producing consumes Beta.");
      expect(text).not.toContain("Producing consumes Gamma.");
    });
  });

  describe("XOR diverging result", () => {
    it("renders 'P yields exactly one of A, B, or C.'", () => {
      let m = buildBaseModel();
      // result: source=process, target=object
      m = ok(addLink(m, { id: "lnk-p-res-a", type: "result", source: "proc-p", target: "obj-a" }));
      m = ok(addLink(m, { id: "lnk-p-res-b", type: "result", source: "proc-p", target: "obj-b" }));
      m = ok(addLink(m, { id: "lnk-p-res-c", type: "result", source: "proc-p", target: "obj-c" }));
      m = ok(addFan(m, {
        id: "fan-xor-result",
        type: "xor",
        members: ["lnk-p-res-a", "lnk-p-res-b", "lnk-p-res-c"],
      }));

      const doc = expose(m, "opd-sd");
      const text = render(doc);
      expect(text).toContain("Producing yields exactly one of Alpha, Beta, or Gamma.");
    });
  });

  describe("OR converging agent", () => {
    it("renders 'At least one of A, B, or C handles P.'", () => {
      let m = buildBaseModel();
      // agent: source=object (agent), target=process
      m = ok(addLink(m, { id: "lnk-a-agent-p", type: "agent", source: "obj-a", target: "proc-p" }));
      m = ok(addLink(m, { id: "lnk-b-agent-p", type: "agent", source: "obj-b", target: "proc-p" }));
      m = ok(addLink(m, { id: "lnk-c-agent-p", type: "agent", source: "obj-c", target: "proc-p" }));
      m = ok(addFan(m, {
        id: "fan-or-agent",
        type: "or",
        members: ["lnk-a-agent-p", "lnk-b-agent-p", "lnk-c-agent-p"],
      }));

      const doc = expose(m, "opd-sd");
      const text = render(doc);
      expect(text).toContain("At least one of Alpha, Beta, or Gamma handles Producing.");
    });
  });

  describe("OR converging instrument", () => {
    it("renders 'Producing requires at least one of Alpha, Beta, or Gamma.'", () => {
      let m = buildBaseModel();
      // instrument: source=object, target=process
      m = ok(addLink(m, { id: "lnk-a-inst-p", type: "instrument", source: "obj-a", target: "proc-p" }));
      m = ok(addLink(m, { id: "lnk-b-inst-p", type: "instrument", source: "obj-b", target: "proc-p" }));
      m = ok(addLink(m, { id: "lnk-c-inst-p", type: "instrument", source: "obj-c", target: "proc-p" }));
      m = ok(addFan(m, {
        id: "fan-or-inst",
        type: "or",
        members: ["lnk-a-inst-p", "lnk-b-inst-p", "lnk-c-inst-p"],
      }));

      const doc = expose(m, "opd-sd");
      const text = render(doc);
      expect(text).toContain("Producing requires at least one of Alpha, Beta, or Gamma.");
    });
  });

  describe("OR converging effect", () => {
    it("renders 'Producing affects at least one of Alpha, Beta, or Gamma.'", () => {
      let m = buildBaseModel();
      // effect: source=process, target=object
      m = ok(addLink(m, { id: "lnk-p-eff-a", type: "effect", source: "proc-p", target: "obj-a" }));
      m = ok(addLink(m, { id: "lnk-p-eff-b", type: "effect", source: "proc-p", target: "obj-b" }));
      m = ok(addLink(m, { id: "lnk-p-eff-c", type: "effect", source: "proc-p", target: "obj-c" }));
      m = ok(addFan(m, {
        id: "fan-or-effect",
        type: "or",
        members: ["lnk-p-eff-a", "lnk-p-eff-b", "lnk-p-eff-c"],
      }));

      const doc = expose(m, "opd-sd");
      const text = render(doc);
      expect(text).toContain("Producing affects at least one of Alpha, Beta, or Gamma.");
    });
  });

  describe("XOR diverging invocation", () => {
    it("renders 'Producing invokes exactly one of Querying or Reporting.'", () => {
      let m = buildProcessModel();
      // invocation: source=invoker, target=invoked
      m = ok(addLink(m, { id: "lnk-p-inv-q", type: "invocation", source: "proc-p", target: "proc-q" }));
      m = ok(addLink(m, { id: "lnk-p-inv-r", type: "invocation", source: "proc-p", target: "proc-r" }));
      m = ok(addFan(m, {
        id: "fan-xor-inv",
        type: "xor",
        members: ["lnk-p-inv-q", "lnk-p-inv-r"],
      }));

      const doc = expose(m, "opd-sd");
      const text = render(doc);
      expect(text).toContain("Producing invokes exactly one of Querying or Reporting.");
    });
  });

  describe("AND fan", () => {
    it("produces individual link sentences (no fan sentence)", () => {
      let m = buildBaseModel();
      m = ok(addLink(m, { id: "lnk-a-cons-p", type: "consumption", source: "obj-a", target: "proc-p" }));
      m = ok(addLink(m, { id: "lnk-b-cons-p", type: "consumption", source: "obj-b", target: "proc-p" }));
      m = ok(addFan(m, {
        id: "fan-and-cons",
        type: "and",
        members: ["lnk-a-cons-p", "lnk-b-cons-p"],
      }));

      const doc = expose(m, "opd-sd");
      const text = render(doc);
      // AND = default OPM behavior — individual sentences
      expect(text).toContain("Producing consumes Alpha.");
      expect(text).toContain("Producing consumes Beta.");
      // No "exactly one" or "at least one"
      expect(text).not.toContain("exactly one");
      expect(text).not.toContain("at least one");
    });
  });

  describe("fan with 2 members", () => {
    it("renders 'P consumes exactly one of A or B.'", () => {
      let m = buildBaseModel();
      m = ok(addLink(m, { id: "lnk-a-cons-p", type: "consumption", source: "obj-a", target: "proc-p" }));
      m = ok(addLink(m, { id: "lnk-b-cons-p", type: "consumption", source: "obj-b", target: "proc-p" }));
      m = ok(addFan(m, {
        id: "fan-xor-2",
        type: "xor",
        members: ["lnk-a-cons-p", "lnk-b-cons-p"],
      }));

      const doc = expose(m, "opd-sd");
      const text = render(doc);
      expect(text).toContain("Producing consumes exactly one of Alpha or Beta.");
    });
  });

  describe("expose produces OplFanSentence for XOR/OR", () => {
    it("emits kind='fan' sentence", () => {
      let m = buildBaseModel();
      m = ok(addLink(m, { id: "lnk-a-cons-p", type: "consumption", source: "obj-a", target: "proc-p" }));
      m = ok(addLink(m, { id: "lnk-b-cons-p", type: "consumption", source: "obj-b", target: "proc-p" }));
      m = ok(addLink(m, { id: "lnk-c-cons-p", type: "consumption", source: "obj-c", target: "proc-p" }));
      m = ok(addFan(m, {
        id: "fan-xor-cons",
        type: "xor",
        members: ["lnk-a-cons-p", "lnk-b-cons-p", "lnk-c-cons-p"],
      }));

      const doc = expose(m, "opd-sd");
      const fanSentences = doc.sentences.filter(s => s.kind === "fan");
      expect(fanSentences).toHaveLength(1);
      const fan = fanSentences[0] as any;
      expect(fan.fanType).toBe("xor");
      expect(fan.linkType).toBe("consumption");
      expect(fan.direction).toBe("converging");
      expect(fan.sharedEndpointName).toBe("Producing");
      expect(fan.memberNames).toEqual(["Alpha", "Beta", "Gamma"]);
    });
  });

  describe("fan with state-specified consumption", () => {
    it("renders state qualifiers in fan sentence", () => {
      let m = buildBaseModel();
      // Add states to Alpha
      m = ok(addState(m, { id: "state-raw", parent: "obj-a", name: "raw", initial: true, final: false, default: false }));
      m = ok(addState(m, { id: "state-ready", parent: "obj-b", name: "ready", initial: true, final: false, default: false }));

      m = ok(addLink(m, { id: "lnk-a-cons-p", type: "consumption", source: "obj-a", target: "proc-p", source_state: "state-raw" }));
      m = ok(addLink(m, { id: "lnk-b-cons-p", type: "consumption", source: "obj-b", target: "proc-p", source_state: "state-ready" }));
      m = ok(addFan(m, {
        id: "fan-xor-state",
        type: "xor",
        members: ["lnk-a-cons-p", "lnk-b-cons-p"],
      }));

      const doc = expose(m, "opd-sd");
      const text = render(doc);
      expect(text).toContain("Producing consumes exactly one of raw Alpha or ready Beta.");
    });
  });

  describe("XOR diverging consumption", () => {
    it("renders 'Exactly one of Q or R consumes Alpha.'", () => {
      let m = buildBaseModel();
      m = ok(addThing(m, procQ));
      m = ok(addThing(m, procR));
      m = ok(addAppearance(m, { thing: "proc-q", opd: "opd-sd", x: 400, y: 100, w: 120, h: 60 }));
      m = ok(addAppearance(m, { thing: "proc-r", opd: "opd-sd", x: 400, y: 300, w: 120, h: 60 }));

      // consumption: source=object, target=process — same object to multiple processes
      m = ok(addLink(m, { id: "lnk-a-cons-q", type: "consumption", source: "obj-a", target: "proc-q" }));
      m = ok(addLink(m, { id: "lnk-a-cons-r", type: "consumption", source: "obj-a", target: "proc-r" }));
      m = ok(addFan(m, {
        id: "fan-xor-div-cons",
        type: "xor",
        direction: "diverging",
        members: ["lnk-a-cons-q", "lnk-a-cons-r"],
      }));

      const doc = expose(m, "opd-sd");
      const text = render(doc);
      expect(text).toContain("Exactly one of Querying or Reporting consumes Alpha.");
    });
  });
});
