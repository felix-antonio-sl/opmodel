#!/usr/bin/env bun
import {
  addAppearance,
  addFan,
  addLink,
  addModifier,
  addState,
  addThing,
  createModel,
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

let m = createModel("Process Control Visual Audit");
m = {
  ...m,
  meta: {
    ...m.meta,
    description: "Process-centric visual audit for fans, modifiers, and distributed links in process in-zooming",
    system_type: "socio-technical",
  },
};

const objects: Array<Thing> = [
  { id: "obj-duty-physician", kind: "object", name: "Duty Physician", essence: "physical", affiliation: "systemic" },
  { id: "obj-triage-console", kind: "object", name: "Triage Console", essence: "informatical", affiliation: "systemic" },
  { id: "obj-alert-signal", kind: "object", name: "Alert Signal", essence: "informatical", affiliation: "environmental" },
  { id: "obj-risk-status", kind: "object", name: "Risk Status", essence: "informatical", affiliation: "systemic" },
  { id: "obj-care-order", kind: "object", name: "Care Order", essence: "informatical", affiliation: "systemic" },
  { id: "obj-onsite-order", kind: "object", name: "Onsite Order", essence: "informatical", affiliation: "systemic" },
  { id: "obj-telecare-order", kind: "object", name: "Telecare Order", essence: "informatical", affiliation: "systemic" },
  { id: "obj-transfer-order", kind: "object", name: "Transfer Order", essence: "informatical", affiliation: "systemic" },
  { id: "obj-bed-board", kind: "object", name: "Bed Board", essence: "informatical", affiliation: "environmental" },
  { id: "obj-transport-window", kind: "object", name: "Transport Window", essence: "informatical", affiliation: "environmental" },
  { id: "obj-dispatch-team", kind: "object", name: "Dispatch Team", essence: "physical", affiliation: "systemic" },
  { id: "obj-visit-team", kind: "object", name: "Visit Team", essence: "physical", affiliation: "systemic" },
];
for (const thing of objects) m = withThing(m, thing);

m = must(addState(m, { id: "st-risk-low", parent: "obj-risk-status", name: "low", initial: true, default: true }));
m = must(addState(m, { id: "st-risk-high", parent: "obj-risk-status", name: "high" }));
m = must(addState(m, { id: "st-risk-critical", parent: "obj-risk-status", name: "critical" }));

const processes: Array<Thing> = [
  { id: "proc-emergency-coordinating", kind: "process", name: "Emergency Coordinating", essence: "informatical", affiliation: "systemic" },
  { id: "proc-signal-screening", kind: "process", name: "Signal Screening", essence: "informatical", affiliation: "systemic" },
  { id: "proc-risk-classifying", kind: "process", name: "Risk Classifying", essence: "informatical", affiliation: "systemic" },
  { id: "proc-onsite-dispatching", kind: "process", name: "Onsite Dispatching", essence: "informatical", affiliation: "systemic" },
  { id: "proc-telecare-launching", kind: "process", name: "Telecare Launching", essence: "informatical", affiliation: "systemic" },
  { id: "proc-hospital-transferring", kind: "process", name: "Hospital Transferring", essence: "informatical", affiliation: "systemic" },
];
for (const thing of processes) m = withThing(m, thing);

for (const [thing, x, y, w, h] of [
  ["proc-emergency-coordinating", 470, 160, 300, 90],
  ["obj-duty-physician", 120, 110, 180, 54],
  ["obj-triage-console", 120, 220, 190, 54],
  ["obj-alert-signal", 120, 330, 180, 54],
  ["obj-risk-status", 860, 120, 200, 60],
  ["obj-care-order", 860, 260, 190, 54],
] as const) {
  m = withAppearance(m, thing, "opd-sd", x, y, w, h);
}

for (const link of [
  { id: "sd-agent-physician", type: "agent", source: "obj-duty-physician", target: "proc-emergency-coordinating", distributed: true },
  { id: "sd-instr-console", type: "instrument", source: "obj-triage-console", target: "proc-emergency-coordinating", distributed: true },
  { id: "sd-event-signal", type: "consumption", source: "obj-alert-signal", target: "proc-emergency-coordinating" },
  { id: "sd-effect-risk", type: "effect", source: "proc-emergency-coordinating", target: "obj-risk-status", source_state: "st-risk-low", target_state: "st-risk-high" },
  { id: "sd-result-order", type: "result", source: "proc-emergency-coordinating", target: "obj-care-order" },
] as const satisfies Link[]) m = withLink(m, link);

m = must(addModifier(m, { id: "mod-sd-event-signal", over: "sd-event-signal", type: "event" }));

m = must(refineThing(m, "proc-emergency-coordinating", "opd-sd", "in-zoom", "opd-sd1", "SD1"));
for (const [thing, x, y, w, h, internal] of [
  ["proc-emergency-coordinating", 150, 40, 760, 560, true],
  ["proc-signal-screening", 310, 110, 260, 68, true],
  ["proc-risk-classifying", 310, 230, 260, 68, true],
  ["proc-onsite-dispatching", 200, 410, 240, 68, true],
  ["proc-telecare-launching", 470, 410, 240, 68, true],
  ["proc-hospital-transferring", 740, 410, 260, 68, true],
  ["obj-duty-physician", 20, 190, 180, 54, false],
  ["obj-triage-console", 20, 300, 190, 54, false],
  ["obj-alert-signal", 20, 90, 180, 54, false],
  ["obj-risk-status", 1040, 130, 200, 60, false],
  ["obj-dispatch-team", 1020, 260, 180, 54, false],
  ["obj-transport-window", 1020, 340, 190, 54, false],
  ["obj-onsite-order", 970, 430, 190, 54, false],
  ["obj-telecare-order", 970, 520, 190, 54, false],
  ["obj-transfer-order", 970, 610, 190, 54, false],
] as const) {
  m = withAppearance(m, thing, "opd-sd1", x, y, w, h, internal);
}

for (const link of [
  { id: "sd1-consume-signal", type: "consumption", source: "obj-alert-signal", target: "proc-signal-screening" },
  { id: "sd1-effect-risk", type: "effect", source: "proc-risk-classifying", target: "obj-risk-status", source_state: "st-risk-low", target_state: "st-risk-high" },
  { id: "sd1-agent-dispatch", type: "agent", source: "obj-dispatch-team", target: "proc-hospital-transferring", distributed: true },
  { id: "sd1-instr-window", type: "instrument", source: "obj-transport-window", target: "proc-hospital-transferring", distributed: true },
  { id: "sd1-result-onsite", type: "result", source: "proc-onsite-dispatching", target: "obj-onsite-order" },
  { id: "sd1-result-telecare", type: "result", source: "proc-telecare-launching", target: "obj-telecare-order" },
  { id: "sd1-result-transfer", type: "result", source: "proc-hospital-transferring", target: "obj-transfer-order" },
] as const satisfies Link[]) m = withLink(m, link);

m = must(addModifier(m, { id: "mod-sd1-consume-signal-event", over: "sd1-consume-signal", type: "event" }));
m = must(addModifier(m, { id: "mod-sd1-onsite-cond", over: "sd1-result-onsite", type: "condition", condition_mode: "wait" }));
m = must(addModifier(m, { id: "mod-sd1-telecare-cond", over: "sd1-result-telecare", type: "condition", condition_mode: "skip" }));
m = must(addModifier(m, { id: "mod-sd1-transfer-cond", over: "sd1-result-transfer", type: "condition", condition_mode: "wait" }));

m = must(addFan(m, {
  id: "fan-sd1-xor-results",
  type: "xor",
  direction: "diverging",
  members: ["sd1-result-onsite", "sd1-result-telecare", "sd1-result-transfer"],
}));

m = must(refineThing(m, "proc-hospital-transferring", "opd-sd1", "in-zoom", "opd-sd1-1", "SD1.1"));
for (const [thing, x, y, w, h, internal] of [
  ["proc-hospital-transferring", 180, 40, 640, 520, true],
  ["obj-dispatch-team", 20, 120, 180, 54, false],
  ["obj-visit-team", 20, 230, 170, 54, false],
  ["obj-bed-board", 860, 120, 180, 54, false],
  ["obj-transport-window", 860, 230, 190, 54, false],
  ["proc-onsite-dispatching", 320, 130, 250, 68, true],
  ["proc-telecare-launching", 320, 240, 250, 68, true],
  ["proc-hospital-transferring", 320, 380, 250, 68, true],
] as const) {
  m = withAppearance(m, thing, "opd-sd1-1", x, y, w, h, internal);
}

for (const link of [
  { id: "sd11-instr-bed-onsite", type: "instrument", source: "obj-bed-board", target: "proc-onsite-dispatching" },
  { id: "sd11-instr-bed-telecare", type: "instrument", source: "obj-bed-board", target: "proc-telecare-launching" },
  { id: "sd11-instr-bed-transfer", type: "instrument", source: "obj-bed-board", target: "proc-hospital-transferring" },
  { id: "sd11-agent-visit-onsite", type: "agent", source: "obj-visit-team", target: "proc-onsite-dispatching" },
  { id: "sd11-agent-visit-telecare", type: "agent", source: "obj-visit-team", target: "proc-telecare-launching" },
] as const satisfies Link[]) m = withLink(m, link);

m = must(addFan(m, {
  id: "fan-sd11-or-bed",
  type: "or",
  direction: "diverging",
  members: ["sd11-instr-bed-onsite", "sd11-instr-bed-telecare", "sd11-instr-bed-transfer"],
}));

const outPath = join(process.cwd(), "tests", "process-control-visual-audit.opmodel");
writeFileSync(outPath, saveModel(m));
console.log(outPath);
