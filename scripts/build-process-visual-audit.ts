#!/usr/bin/env bun
import {
  addAppearance,
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

let m = createModel("Process Visual Audit");
m = {
  ...m,
  meta: {
    ...m.meta,
    description: "Process-centric visual audit battery for ISO 19450 human visual debugging under stress",
    system_type: "socio-technical",
  },
};

const objects: Array<Thing> = [
  { id: "obj-case-manager", kind: "object", name: "Case Manager", essence: "physical", affiliation: "systemic" },
  { id: "obj-clinical-team", kind: "object", name: "Clinical Team", essence: "physical", affiliation: "systemic" },
  { id: "obj-monitoring-console", kind: "object", name: "Monitoring Console", essence: "informatical", affiliation: "systemic" },
  { id: "obj-protocol-checklist", kind: "object", name: "Protocol Checklist", essence: "informatical", affiliation: "systemic" },
  { id: "obj-patient-record", kind: "object", name: "Patient Record", essence: "informatical", affiliation: "systemic" },
  { id: "obj-vital-snapshot", kind: "object", name: "Vital Sign Snapshot", essence: "informatical", affiliation: "systemic" },
  { id: "obj-care-status", kind: "object", name: "Care Status", essence: "informatical", affiliation: "systemic" },
  { id: "obj-care-plan", kind: "object", name: "Care Plan", essence: "informatical", affiliation: "systemic" },
  { id: "obj-escalation-ticket", kind: "object", name: "Escalation Ticket", essence: "informatical", affiliation: "systemic" },
  { id: "obj-home-visit", kind: "object", name: "Home Visit", essence: "physical", affiliation: "systemic" },
  { id: "obj-emergency-channel", kind: "object", name: "Emergency Channel", essence: "informatical", affiliation: "environmental" },
  { id: "obj-dispatch-queue", kind: "object", name: "Dispatch Queue", essence: "informatical", affiliation: "systemic" },
  { id: "obj-device-kit", kind: "object", name: "Device Kit", essence: "physical", affiliation: "systemic" },
  { id: "obj-transport-window", kind: "object", name: "Transport Window", essence: "informatical", affiliation: "environmental" },
  { id: "obj-bed-availability", kind: "object", name: "Bed Availability", essence: "informatical", affiliation: "environmental" },
];
for (const thing of objects) m = withThing(m, thing);

m = must(addState(m, { id: "st-care-stable", parent: "obj-care-status", name: "stable", initial: true, default: true }));
m = must(addState(m, { id: "st-care-unstable", parent: "obj-care-status", name: "unstable" }));
m = must(addState(m, { id: "st-care-stabilizing", parent: "obj-care-status", name: "stabilizing" }));
m = must(addState(m, { id: "st-care-escalated", parent: "obj-care-status", name: "escalated" }));
m = must(addState(m, { id: "st-bed-open", parent: "obj-bed-availability", name: "open", initial: true, default: true }));
m = must(addState(m, { id: "st-bed-full", parent: "obj-bed-availability", name: "full" }));

const processes: Array<Thing> = [
  { id: "proc-care-stabilizing", kind: "process", name: "Care Stabilizing", essence: "informatical", affiliation: "systemic" },
  { id: "proc-signal-interpreting", kind: "process", name: "Signal Interpreting", essence: "informatical", affiliation: "systemic" },
  { id: "proc-priority-assessing", kind: "process", name: "Priority Assessing", essence: "informatical", affiliation: "systemic" },
  { id: "proc-intervention-coordinating", kind: "process", name: "Intervention Coordinating", essence: "informatical", affiliation: "systemic" },
  { id: "proc-outcome-verifying", kind: "process", name: "Outcome Verifying", essence: "informatical", affiliation: "systemic" },
  { id: "proc-device-dispatching", kind: "process", name: "Device Dispatching", essence: "informatical", affiliation: "systemic" },
  { id: "proc-visit-preparing", kind: "process", name: "Visit Preparing", essence: "informatical", affiliation: "systemic" },
  { id: "proc-visit-launching", kind: "process", name: "Visit Launching", essence: "informatical", affiliation: "systemic", duration: { nominal: 30, min: 10, max: 45, unit: "min" } },
  { id: "proc-emergency-escalating", kind: "process", name: "Emergency Escalating", essence: "informatical", affiliation: "systemic" },
];
for (const thing of processes) m = withThing(m, thing);

// SD
for (const [thing, x, y, w, h] of [
  ["proc-care-stabilizing", 500, 160, 260, 84],
  ["obj-case-manager", 100, 90, 170, 54],
  ["obj-monitoring-console", 100, 200, 190, 54],
  ["obj-patient-record", 100, 310, 170, 54],
  ["obj-vital-snapshot", 360, 340, 180, 54],
  ["obj-care-status", 810, 120, 180, 54],
  ["obj-care-plan", 830, 240, 160, 54],
  ["obj-escalation-ticket", 820, 350, 200, 54],
  ["obj-emergency-channel", 1070, 220, 200, 54],
] as const) {
  m = withAppearance(m, thing, "opd-sd", x, y, w, h);
}

for (const link of [
  { id: "sd-agent-manager", type: "agent", source: "obj-case-manager", target: "proc-care-stabilizing", distributed: true },
  { id: "sd-instr-console", type: "instrument", source: "obj-monitoring-console", target: "proc-care-stabilizing" },
  { id: "sd-instr-record", type: "instrument", source: "obj-patient-record", target: "proc-care-stabilizing" },
  { id: "sd-consume-snapshot", type: "consumption", source: "obj-vital-snapshot", target: "proc-care-stabilizing" },
  { id: "sd-effect-status", type: "effect", source: "proc-care-stabilizing", target: "obj-care-status", source_state: "st-care-unstable", target_state: "st-care-stabilizing" },
  { id: "sd-result-plan", type: "result", source: "proc-care-stabilizing", target: "obj-care-plan" },
  { id: "sd-result-ticket", type: "result", source: "proc-care-stabilizing", target: "obj-escalation-ticket" },
  { id: "sd-instr-channel", type: "instrument", source: "obj-emergency-channel", target: "proc-care-stabilizing" },
] as const satisfies Link[]) {
  m = withLink(m, link);
}

// SD1 - in-zoom of Care Stabilizing
m = must(refineThing(m, "proc-care-stabilizing", "opd-sd", "in-zoom", "opd-sd1", "SD1"));
for (const [thing, x, y, w, h, internal] of [
  ["proc-care-stabilizing", 170, 30, 520, 560, true],
  ["proc-signal-interpreting", 300, 90, 260, 70, true],
  ["proc-priority-assessing", 300, 200, 260, 70, true],
  ["proc-intervention-coordinating", 300, 330, 260, 70, true],
  ["proc-outcome-verifying", 300, 460, 260, 70, true],
  ["obj-case-manager", 40, 120, 180, 54, false],
  ["obj-monitoring-console", 40, 235, 200, 54, false],
  ["obj-protocol-checklist", 40, 350, 200, 54, false],
  ["obj-vital-snapshot", 40, 470, 180, 54, false],
  ["obj-patient-record", 650, 110, 180, 54, false],
  ["obj-care-status", 650, 250, 180, 54, false],
  ["obj-care-plan", 650, 390, 170, 54, false],
  ["obj-escalation-ticket", 650, 500, 210, 54, false],
] as const) {
  m = withAppearance(m, thing, "opd-sd1", x, y, w, h, internal);
}

for (const link of [
  { id: "sd1-instr-console", type: "instrument", source: "obj-monitoring-console", target: "proc-signal-interpreting" },
  { id: "sd1-instr-record", type: "instrument", source: "obj-patient-record", target: "proc-priority-assessing" },
  { id: "sd1-instr-checklist", type: "instrument", source: "obj-protocol-checklist", target: "proc-intervention-coordinating" },
  { id: "sd1-consume-snapshot", type: "consumption", source: "obj-vital-snapshot", target: "proc-signal-interpreting" },
  { id: "sd1-effect-status-a", type: "effect", source: "proc-priority-assessing", target: "obj-care-status", source_state: "st-care-unstable", target_state: "st-care-stabilizing" },
  { id: "sd1-result-plan", type: "result", source: "proc-intervention-coordinating", target: "obj-care-plan" },
  { id: "sd1-result-ticket", type: "result", source: "proc-outcome-verifying", target: "obj-escalation-ticket" },
] as const satisfies Link[]) {
  m = withLink(m, link);
}
m = must(addModifier(m, { id: "mod-sd1-event-snapshot", over: "sd1-consume-snapshot", type: "event" }));
m = must(addModifier(m, { id: "mod-sd1-condition-checklist", over: "sd1-instr-checklist", type: "condition", condition_mode: "wait" }));

// SD1.1 - in-zoom of Intervention Coordinating
m = must(refineThing(m, "proc-intervention-coordinating", "opd-sd1", "in-zoom", "opd-sd1-1", "SD1.1"));
for (const [thing, x, y, w, h, internal] of [
  ["proc-intervention-coordinating", 140, 30, 660, 560, true],
  ["proc-device-dispatching", 220, 110, 240, 68, true],
  ["proc-visit-preparing", 490, 110, 240, 68, true],
  ["proc-visit-launching", 360, 300, 240, 68, true],
  ["proc-emergency-escalating", 360, 450, 250, 68, true],
  ["obj-clinical-team", 20, 110, 170, 54, false],
  ["obj-dispatch-queue", 20, 250, 180, 54, false],
  ["obj-device-kit", 20, 390, 170, 54, false],
  ["obj-transport-window", 840, 110, 190, 54, false],
  ["obj-home-visit", 840, 300, 170, 54, false],
  ["obj-bed-availability", 840, 450, 190, 54, false],
] as const) {
  m = withAppearance(m, thing, "opd-sd1-1", x, y, w, h, internal);
}

for (const link of [
  { id: "sd11-agent-team", type: "agent", source: "obj-clinical-team", target: "proc-intervention-coordinating", distributed: true },
  { id: "sd11-instr-queue", type: "instrument", source: "obj-dispatch-queue", target: "proc-device-dispatching" },
  { id: "sd11-consume-kit", type: "consumption", source: "obj-device-kit", target: "proc-device-dispatching" },
  { id: "sd11-instr-window", type: "instrument", source: "obj-transport-window", target: "proc-visit-preparing" },
  { id: "sd11-result-visit", type: "result", source: "proc-visit-launching", target: "obj-home-visit" },
  { id: "sd11-effect-bed", type: "effect", source: "proc-emergency-escalating", target: "obj-bed-availability", source_state: "st-bed-open", target_state: "st-bed-full" },
  { id: "sd11-exception-escalate", type: "exception", source: "proc-visit-launching", target: "proc-emergency-escalating", exception_type: "overtime" },
] as const satisfies Link[]) {
  m = withLink(m, link);
}
m = must(addLink(m, { id: "sd11-invoke-dispatch-launch", type: "invocation", source: "proc-device-dispatching", target: "proc-visit-launching" }));
m = must(addLink(m, { id: "sd11-invoke-prepare-launch", type: "invocation", source: "proc-visit-preparing", target: "proc-visit-launching" }));
m = must(addModifier(m, { id: "mod-sd11-condition-window", over: "sd11-instr-window", type: "condition", condition_mode: "skip" }));
m = must(addModifier(m, { id: "mod-sd11-event-kit", over: "sd11-consume-kit", type: "event" }));

const outPath = join(process.cwd(), "tests", "process-visual-audit.opmodel");
writeFileSync(outPath, saveModel(m));
console.log(outPath);
