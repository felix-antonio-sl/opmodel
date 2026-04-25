#!/usr/bin/env bun
import {
  addAppearance,
  addLink,
  addState,
  addThing,
  createModel,
  isOk,
  refineThing,
  saveModel,
  type Link,
  type Model,
  type Thing,
} from "../packages/core/src/index";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

function must<T>(result: { ok: boolean; value?: T; error?: { message: string } }): T {
  if (!result.ok) throw new Error(result.error?.message ?? "unknown error");
  return result.value as T;
}

function withThing(model: Model, thing: Thing): Model {
  return must(addThing(model, thing));
}

function withAppearance(
  model: Model,
  thing: string,
  opd: string,
  x: number,
  y: number,
  w: number,
  h: number,
  internal = false,
): Model {
  if (model.appearances.has(`${thing}::${opd}`)) return model;
  return must(addAppearance(model, { thing, opd, x, y, w, h, ...(internal ? { internal: true } : {}) }));
}

function withLink(model: Model, link: Link): Model {
  return must(addLink(model, link));
}

let m = createModel("Object Visual Audit");
m = {
  ...m,
  meta: {
    ...m.meta,
    description: "Object-centric visual audit battery for ISO 19450 human visual debugging",
    system_type: "socio-technical",
  },
};

const objectThings: Array<Thing> = [
  { id: "obj-hub", kind: "object", name: "Care Coordination Hub", essence: "informatical", affiliation: "systemic" },
  { id: "obj-record", kind: "object", name: "Patient Record", essence: "informatical", affiliation: "systemic" },
  { id: "obj-schedule", kind: "object", name: "Visit Schedule", essence: "informatical", affiliation: "systemic" },
  { id: "obj-team", kind: "object", name: "Care Team", essence: "physical", affiliation: "systemic" },
  { id: "obj-inventory", kind: "object", name: "Device Inventory", essence: "physical", affiliation: "systemic" },
  { id: "obj-status", kind: "object", name: "Coordination Status", essence: "informatical", affiliation: "systemic" },
  { id: "obj-portal", kind: "object", name: "Patient Portal", essence: "informatical", affiliation: "environmental" },
  { id: "obj-alert-queue", kind: "object", name: "Alert Queue", essence: "informatical", affiliation: "systemic" },
  { id: "obj-device", kind: "object", name: "Medical Device", essence: "physical", affiliation: "systemic" },
  { id: "obj-defib", kind: "object", name: "Defibrillator", essence: "physical", affiliation: "systemic" },
  { id: "obj-vent", kind: "object", name: "Ventilator", essence: "physical", affiliation: "systemic" },
  { id: "obj-pump", kind: "object", name: "Infusion Pump", essence: "physical", affiliation: "systemic" },
  { id: "obj-home-kit", kind: "object", name: "Home Care Kit", essence: "physical", affiliation: "systemic" },
  { id: "obj-med-pack", kind: "object", name: "Medication Pack", essence: "physical", affiliation: "systemic" },
  { id: "obj-dressing-set", kind: "object", name: "Dressing Set", essence: "physical", affiliation: "systemic" },
  { id: "obj-sensor", kind: "object", name: "Home Sensor", essence: "physical", affiliation: "environmental" },
];

for (const thing of objectThings) m = withThing(m, thing);

m = must(addState(m, { id: "st-status-idle", parent: "obj-status", name: "idle", initial: true, final: false, default: true }));
m = must(addState(m, { id: "st-status-coordinated", parent: "obj-status", name: "coordinated", initial: false, final: false, default: false }));
m = must(addState(m, { id: "st-status-alerted", parent: "obj-status", name: "alerted", initial: false, final: false, default: false }));

const processThings: Array<Thing> = [
  { id: "proc-sync", kind: "process", name: "Record Synchronizing", essence: "informatical", affiliation: "systemic" },
  { id: "proc-schedule", kind: "process", name: "Visit Scheduling", essence: "informatical", affiliation: "systemic" },
  { id: "proc-alert", kind: "process", name: "Alert Publishing", essence: "informatical", affiliation: "systemic" },
];
for (const thing of processThings) m = withThing(m, thing);

// SD — structural/object protagonist
for (const [thing, x, y, w, h] of [
  ["obj-hub", 380, 80, 220, 70],
  ["obj-record", 120, 250, 170, 54],
  ["obj-schedule", 330, 250, 170, 54],
  ["obj-team", 560, 250, 150, 54],
  ["obj-inventory", 760, 250, 170, 54],
  ["obj-status", 620, 100, 170, 54],
  ["obj-portal", 80, 100, 160, 54],
  ["obj-device", 980, 80, 170, 54],
  ["obj-defib", 920, 250, 150, 54],
  ["obj-vent", 1100, 250, 140, 54],
  ["obj-pump", 1010, 340, 150, 54],
] as const) {
  m = withAppearance(m, thing, "opd-sd", x, y, w, h);
}

for (const link of [
  { id: "agg-record", type: "aggregation", source: "obj-hub", target: "obj-record" },
  { id: "agg-schedule", type: "aggregation", source: "obj-hub", target: "obj-schedule" },
  { id: "agg-team", type: "aggregation", source: "obj-hub", target: "obj-team" },
  { id: "agg-inventory", type: "aggregation", source: "obj-hub", target: "obj-inventory" },
  { id: "exh-status", type: "exhibition", source: "obj-hub", target: "obj-status" },
  { id: "tag-portal", type: "tagged", source: "obj-hub", target: "obj-portal", tag: "serves", direction: "unidirectional" },
  { id: "gen-defib", type: "generalization", source: "obj-defib", target: "obj-device" },
  { id: "gen-vent", type: "generalization", source: "obj-vent", target: "obj-device" },
  { id: "gen-pump", type: "generalization", source: "obj-pump", target: "obj-device" },
] as const satisfies Link[]) m = withLink(m, link);

// Object in-zoom of Care Coordination Hub
m = must(refineThing(m, "obj-hub", "opd-sd", "in-zoom", "opd-sd1", "SD1"));
for (const [thing, x, y, w, h, internal] of [
  ["obj-record", 70, 120, 170, 54, true],
  ["obj-schedule", 690, 120, 170, 54, true],
  ["obj-alert-queue", 690, 320, 170, 54, true],
  ["proc-sync", 330, 110, 220, 64, true],
  ["proc-schedule", 330, 220, 220, 64, true],
  ["proc-alert", 330, 330, 220, 64, true],
  ["obj-status", 70, 330, 170, 54, false],
  ["obj-team", 70, 430, 150, 54, false],
  ["obj-portal", 690, 430, 160, 54, false],
] as const) {
  m = withAppearance(m, thing, "opd-sd1", x, y, w, h, internal);
}
for (const link of [
  { id: "sd1-instr-record", type: "instrument", source: "obj-record", target: "proc-sync" },
  { id: "sd1-result-schedule", type: "result", source: "proc-schedule", target: "obj-schedule" },
  { id: "sd1-result-alertq", type: "result", source: "proc-alert", target: "obj-alert-queue" },
  { id: "sd1-instr-team", type: "instrument", source: "obj-team", target: "proc-schedule" },
  { id: "sd1-instr-portal", type: "instrument", source: "obj-portal", target: "proc-alert" },
  { id: "sd1-effect-status", type: "effect", source: "proc-alert", target: "obj-status", source_state: "st-status-idle", target_state: "st-status-alerted" },
  { id: "sd1-cross-record", type: "instrument", source: "obj-record", target: "proc-schedule" },
  { id: "sd1-cross-status", type: "instrument", source: "obj-status", target: "proc-alert" },
] as const satisfies Link[]) m = withLink(m, link);

// Object unfold of Home Care Kit
m = withAppearance(m, "obj-home-kit", "opd-sd", 1280, 80, 180, 60);
m = must(refineThing(m, "obj-home-kit", "opd-sd", "unfold", "opd-sd2", "SD2"));
for (const [thing, x, y, w, h, internal] of [
  ["obj-home-kit", 120, 40, 300, 300, true],
  ["obj-med-pack", 160, 100, 150, 54, true],
  ["obj-dressing-set", 160, 210, 150, 54, true],
  ["obj-defib", 160, 320, 150, 54, true],
  ["obj-sensor", 520, 210, 150, 54, false],
] as const) {
  m = withAppearance(m, thing, "opd-sd2", x, y, w, h, internal);
}
for (const link of [
  { id: "sd-root-agg-kit-med", type: "aggregation", source: "obj-home-kit", target: "obj-med-pack" },
  { id: "sd-root-agg-kit-dress", type: "aggregation", source: "obj-home-kit", target: "obj-dressing-set" },
  { id: "sd-root-agg-kit-defib", type: "aggregation", source: "obj-home-kit", target: "obj-defib" },
  { id: "sd2-tag-sensor", type: "tagged", source: "obj-home-kit", target: "obj-sensor", tag: "monitors with", direction: "unidirectional" },
] as const satisfies Link[]) m = withLink(m, link);

m = {
  ...m,
  meta: {
    ...m.meta,
    created: "2026-04-10T05:40:52.065Z",
    modified: "2026-04-10T05:40:52.068Z",
  },
};

const outPath = join(process.cwd(), "tests", "object-visual-audit.opmodel");
writeFileSync(outPath, saveModel(m));
console.log(outPath);
