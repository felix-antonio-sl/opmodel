// Build EV-AMS canonical example programmatically
import { createModel, addThing, addState, addLink, addOPD, addAppearance, addAssertion, addRequirement, addScenario, addFan, refineThing, saveModel, isOk, validate } from "../packages/core/src/index";
import { writeFileSync } from "fs";
import { resolve } from "path";
import type { Model, Thing, State, Link } from "../packages/core/src/types";

function unwrap<T>(r: { ok: true; value: T } | { ok: false; error: any }): T {
  if (!isOk(r)) throw new Error(`Failed: ${JSON.stringify(r.error)}`);
  return r.value;
}

let m = createModel("EV-AMS: Autonomous Electric Vehicle Manufacturing & Operation", "socio-technical");

// ===== SD — SYSTEM DIAGRAM (Level 0) =====

// Step 1: Main Process
const mainProc: Thing = { id: "proc-aev-providing", kind: "process", name: "Autonomous Electric Vehicle Providing", essence: "physical", affiliation: "systemic" };
m = unwrap(addThing(m, mainProc));

// Step 2: Beneficiary Group
const beneficiary: Thing = { id: "obj-commuter-group", kind: "object", name: "Urban Commuter Group", essence: "physical", affiliation: "environmental" };
m = unwrap(addThing(m, beneficiary));

// Step 3: Beneficiary Attribute + States
const mobilityConv: Thing = { id: "obj-mobility-convenience", kind: "object", name: "Mobility Convenience", essence: "informatical", affiliation: "systemic" };
m = unwrap(addThing(m, mobilityConv));
m = unwrap(addState(m, { id: "s-mob-limited", parent: "obj-mobility-convenience", name: "limited", initial: true, final: false, default: true }));
m = unwrap(addState(m, { id: "s-mob-enhanced", parent: "obj-mobility-convenience", name: "enhanced", initial: false, final: true, default: false }));

// Step 4: Main Transformee + Benefit-Providing Attribute
const aev: Thing = { id: "obj-aev", kind: "object", name: "Autonomous Electric Vehicle", essence: "physical", affiliation: "systemic" };
m = unwrap(addThing(m, aev));
const opReadiness: Thing = { id: "obj-op-readiness", kind: "object", name: "Operational Readiness", essence: "informatical", affiliation: "systemic" };
m = unwrap(addThing(m, opReadiness));
m = unwrap(addState(m, { id: "s-op-undeployed", parent: "obj-op-readiness", name: "undeployed", initial: true, final: false, default: true }));
m = unwrap(addState(m, { id: "s-op-fleet-active", parent: "obj-op-readiness", name: "fleet-active", initial: false, final: true, default: false }));

// Step 5: Agents
const mfgEngGroup: Thing = { id: "obj-mfg-eng-group", kind: "object", name: "Manufacturing Engineer Group", essence: "physical", affiliation: "systemic" };
m = unwrap(addThing(m, mfgEngGroup));
const fleetOpGroup: Thing = { id: "obj-fleet-op-group", kind: "object", name: "Fleet Operator Group", essence: "physical", affiliation: "systemic" };
m = unwrap(addThing(m, fleetOpGroup));

// Step 6: System + Exhibition
const system: Thing = { id: "obj-ev-ams", kind: "object", name: "EV-AMS", essence: "physical", affiliation: "systemic" };
m = unwrap(addThing(m, system));

// Step 7: Instruments
const robotLine: Thing = { id: "obj-robot-line", kind: "object", name: "Robotic Assembly Line", essence: "physical", affiliation: "systemic" };
m = unwrap(addThing(m, robotLine));
const navSoftware: Thing = { id: "obj-nav-software", kind: "object", name: "Autonomous Navigation Software", essence: "informatical", affiliation: "systemic" };
m = unwrap(addThing(m, navSoftware));
const chargingStations: Thing = { id: "obj-charging-stations", kind: "object", name: "Battery Charging Station Set", essence: "physical", affiliation: "systemic" };
m = unwrap(addThing(m, chargingStations));

// Step 8: Input/Output
const rawMaterials: Thing = { id: "obj-raw-materials", kind: "object", name: "Raw Material Set", essence: "physical", affiliation: "systemic" };
m = unwrap(addThing(m, rawMaterials));
const electricEnergy: Thing = { id: "obj-electric-energy", kind: "object", name: "Electric Energy", essence: "physical", affiliation: "systemic" };
m = unwrap(addThing(m, electricEnergy));
const urbanTrips: Thing = { id: "obj-urban-trips", kind: "object", name: "Urban Trip Set", essence: "informatical", affiliation: "systemic" };
m = unwrap(addThing(m, urbanTrips));

// Step 9: Environmental Objects
const roadNetwork: Thing = { id: "obj-road-network", kind: "object", name: "Urban Road Network", essence: "physical", affiliation: "environmental" };
m = unwrap(addThing(m, roadNetwork));
const regulations: Thing = { id: "obj-regulations", kind: "object", name: "Regulation Set", essence: "informatical", affiliation: "environmental" };
m = unwrap(addThing(m, regulations));
const weather: Thing = { id: "obj-weather", kind: "object", name: "Weather", essence: "physical", affiliation: "environmental" };
m = unwrap(addThing(m, weather));

// Step 10: Problem Occurrence
const fossilUsing: Thing = { id: "proc-fossil-using", kind: "process", name: "Human-Driven Fossil Vehicle Using", essence: "physical", affiliation: "environmental" };
m = unwrap(addThing(m, fossilUsing));

// ===== SD LINKS =====

// Exhibition: System exhibits main process
m = unwrap(addLink(m, { id: "lnk-exhibition-main", type: "exhibition", source: "obj-ev-ams", target: "proc-aev-providing" }));
// Exhibition: Beneficiary exhibits attribute
m = unwrap(addLink(m, { id: "lnk-exhibition-mob", type: "exhibition", source: "obj-commuter-group", target: "obj-mobility-convenience" }));
// Exhibition: AEV exhibits readiness
m = unwrap(addLink(m, { id: "lnk-exhibition-readiness", type: "exhibition", source: "obj-aev", target: "obj-op-readiness" }));

// Effect: Main process changes mobility convenience
m = unwrap(addLink(m, { id: "lnk-effect-mobility", type: "effect", source: "proc-aev-providing", target: "obj-mobility-convenience", source_state: "s-mob-limited", target_state: "s-mob-enhanced" }));
// Effect: Main process changes operational readiness
m = unwrap(addLink(m, { id: "lnk-effect-readiness", type: "effect", source: "proc-aev-providing", target: "obj-op-readiness", source_state: "s-op-undeployed", target_state: "s-op-fleet-active" }));

// Agents
m = unwrap(addLink(m, { id: "lnk-agent-mfg", type: "agent", source: "obj-mfg-eng-group", target: "proc-aev-providing" }));
m = unwrap(addLink(m, { id: "lnk-agent-fleet", type: "agent", source: "obj-fleet-op-group", target: "proc-aev-providing" }));

// Instrument: System
m = unwrap(addLink(m, { id: "lnk-instrument-system", type: "instrument", source: "obj-ev-ams", target: "proc-aev-providing" }));
// Instruments
m = unwrap(addLink(m, { id: "lnk-instrument-robot", type: "instrument", source: "obj-robot-line", target: "proc-aev-providing" }));
m = unwrap(addLink(m, { id: "lnk-instrument-nav", type: "instrument", source: "obj-nav-software", target: "proc-aev-providing" }));
m = unwrap(addLink(m, { id: "lnk-instrument-charging", type: "instrument", source: "obj-charging-stations", target: "proc-aev-providing" }));
m = unwrap(addLink(m, { id: "lnk-instrument-road", type: "instrument", source: "obj-road-network", target: "proc-aev-providing" }));

// Consumption
m = unwrap(addLink(m, { id: "lnk-consume-raw", type: "consumption", source: "obj-raw-materials", target: "proc-aev-providing" }));
m = unwrap(addLink(m, { id: "lnk-consume-energy", type: "consumption", source: "obj-electric-energy", target: "proc-aev-providing" }));

// Result
m = unwrap(addLink(m, { id: "lnk-result-trips", type: "result", source: "proc-aev-providing", target: "obj-urban-trips" }));

// Problem occurrence
m = unwrap(addLink(m, { id: "lnk-problem-mob", type: "effect", source: "proc-fossil-using", target: "obj-mobility-convenience" }));

// ===== SD APPEARANCES =====
const SD_THINGS = [
  { id: "proc-aev-providing", x: 350, y: 300, w: 300, h: 100 },
  { id: "obj-commuter-group", x: 50, y: 50, w: 200, h: 60 },
  { id: "obj-mobility-convenience", x: 300, y: 50, w: 200, h: 60 },
  { id: "obj-aev", x: 600, y: 50, w: 250, h: 60 },
  { id: "obj-op-readiness", x: 600, y: 150, w: 200, h: 60 },
  { id: "obj-mfg-eng-group", x: 50, y: 200, w: 220, h: 50 },
  { id: "obj-fleet-op-group", x: 50, y: 300, w: 200, h: 50 },
  { id: "obj-ev-ams", x: 350, y: 150, w: 180, h: 60 },
  { id: "obj-robot-line", x: 700, y: 250, w: 200, h: 50 },
  { id: "obj-nav-software", x: 700, y: 320, w: 250, h: 50 },
  { id: "obj-charging-stations", x: 700, y: 390, w: 230, h: 50 },
  { id: "obj-raw-materials", x: 50, y: 450, w: 180, h: 50 },
  { id: "obj-electric-energy", x: 250, y: 450, w: 160, h: 50 },
  { id: "obj-urban-trips", x: 600, y: 450, w: 180, h: 50 },
  { id: "obj-road-network", x: 700, y: 460, w: 200, h: 50 },
  { id: "obj-regulations", x: 50, y: 550, w: 160, h: 50 },
  { id: "obj-weather", x: 250, y: 550, w: 140, h: 50 },
  { id: "proc-fossil-using", x: 450, y: 550, w: 300, h: 70 },
];

for (const a of SD_THINGS) {
  m = unwrap(addAppearance(m, { thing: a.id, opd: "opd-sd", ...a }));
}

// ===== SD1 — In-zoom of Main Process =====
m = unwrap(addOPD(m, { id: "opd-sd1", name: "SD1", opd_type: "hierarchical", parent_opd: "opd-sd", refines: "proc-aev-providing", refinement_type: "in-zoom" }));

// 4 subprocesses
const sd1Procs = [
  { id: "proc-mfg", name: "AEV Manufacturing", y: 80 },
  { id: "proc-testing", name: "AEV Testing", y: 200 },
  { id: "proc-deploying", name: "AEV Deploying", y: 320 },
  { id: "proc-fleet-op", name: "AEV Fleet Operating", y: 440 },
];

for (const sp of sd1Procs) {
  m = unwrap(addThing(m, { id: sp.id, kind: "process", name: sp.name, essence: "physical", affiliation: "systemic" }));
  m = unwrap(addAppearance(m, { thing: sp.id, opd: "opd-sd1", x: 280, y: sp.y, w: 240, h: 60, internal: true }));
}

// Container
m = unwrap(addAppearance(m, { thing: "proc-aev-providing", opd: "opd-sd1", x: 200, y: 20, w: 400, h: 540, internal: true }));

// SD1 objects
const aevAssembly: Thing = { id: "obj-aev-assembly", kind: "object", name: "AEV Assembly", essence: "physical", affiliation: "systemic" };
m = unwrap(addThing(m, aevAssembly));
const mfgQuality: Thing = { id: "obj-mfg-quality", kind: "object", name: "Manufacturing Quality Level", essence: "informatical", affiliation: "systemic" };
m = unwrap(addThing(m, mfgQuality));
m = unwrap(addState(m, { id: "s-qual-unverified", parent: "obj-mfg-quality", name: "unverified", initial: true, final: false, default: true }));
m = unwrap(addState(m, { id: "s-qual-assembled", parent: "obj-mfg-quality", name: "assembled", initial: false, final: false, default: false }));
m = unwrap(addState(m, { id: "s-qual-tested", parent: "obj-mfg-quality", name: "tested", initial: false, final: false, default: false }));
m = unwrap(addState(m, { id: "s-qual-certified", parent: "obj-mfg-quality", name: "certified", initial: false, final: true, default: false }));

const testReport: Thing = { id: "obj-test-report", kind: "object", name: "Test Report", essence: "informatical", affiliation: "systemic" };
m = unwrap(addThing(m, testReport));

// SD1 external appearances
m = unwrap(addAppearance(m, { thing: "obj-aev-assembly", opd: "opd-sd1", x: 700, y: 100, w: 180, h: 60 }));
m = unwrap(addAppearance(m, { thing: "obj-mfg-quality", opd: "opd-sd1", x: 700, y: 200, w: 220, h: 60 }));
m = unwrap(addAppearance(m, { thing: "obj-test-report", opd: "opd-sd1", x: 700, y: 320, w: 160, h: 50 }));
m = unwrap(addAppearance(m, { thing: "obj-raw-materials", opd: "opd-sd1", x: 30, y: 80, w: 150, h: 50 }));
m = unwrap(addAppearance(m, { thing: "obj-robot-line", opd: "opd-sd1", x: 30, y: 160, w: 180, h: 50 }));
m = unwrap(addAppearance(m, { thing: "obj-mfg-eng-group", opd: "opd-sd1", x: 30, y: 240, w: 200, h: 50 }));
m = unwrap(addAppearance(m, { thing: "obj-fleet-op-group", opd: "opd-sd1", x: 30, y: 440, w: 180, h: 50 }));
m = unwrap(addAppearance(m, { thing: "obj-nav-software", opd: "opd-sd1", x: 30, y: 360, w: 170, h: 50 }));
m = unwrap(addAppearance(m, { thing: "obj-road-network", opd: "opd-sd1", x: 30, y: 520, w: 180, h: 50 }));
m = unwrap(addAppearance(m, { thing: "obj-aev", opd: "opd-sd1", x: 700, y: 400, w: 200, h: 60 }));

// SD1 links
m = unwrap(addLink(m, { id: "lnk-mfg-consume-raw", type: "consumption", source: "obj-raw-materials", target: "proc-mfg" }));
m = unwrap(addLink(m, { id: "lnk-mfg-result-assembly", type: "result", source: "proc-mfg", target: "obj-aev-assembly" }));
m = unwrap(addLink(m, { id: "lnk-mfg-agent", type: "agent", source: "obj-mfg-eng-group", target: "proc-mfg" }));
m = unwrap(addLink(m, { id: "lnk-mfg-instrument", type: "instrument", source: "obj-robot-line", target: "proc-mfg" }));
m = unwrap(addLink(m, { id: "lnk-mfg-effect-quality", type: "effect", source: "proc-mfg", target: "obj-mfg-quality", target_state: "s-qual-assembled" }));

m = unwrap(addLink(m, { id: "lnk-test-effect-quality", type: "effect", source: "proc-testing", target: "obj-mfg-quality", source_state: "s-qual-assembled", target_state: "s-qual-tested" }));
m = unwrap(addLink(m, { id: "lnk-test-result-report", type: "result", source: "proc-testing", target: "obj-test-report" }));

m = unwrap(addLink(m, { id: "lnk-deploy-effect-readiness", type: "effect", source: "proc-deploying", target: "obj-op-readiness", target_state: "s-op-fleet-active" }));
m = unwrap(addLink(m, { id: "lnk-fleet-agent", type: "agent", source: "obj-fleet-op-group", target: "proc-fleet-op" }));
m = unwrap(addLink(m, { id: "lnk-fleet-instrument-nav", type: "instrument", source: "obj-nav-software", target: "proc-fleet-op" }));
m = unwrap(addLink(m, { id: "lnk-fleet-instrument-road", type: "instrument", source: "obj-road-network", target: "proc-fleet-op" }));

// Exhibition: AEV Assembly exhibits Quality
m = unwrap(addLink(m, { id: "lnk-exhibit-quality", type: "exhibition", source: "obj-aev-assembly", target: "obj-mfg-quality" }));

// ===== ASSERTIONS =====
m = { ...m, assertions: new Map([
  ["ast-mobility", { id: "ast-mobility", target: "obj-mobility-convenience", predicate: "after Autonomous Electric Vehicle Providing, Mobility Convenience is enhanced", category: "correctness" as const, enabled: true }],
  ["ast-readiness", { id: "ast-readiness", target: "obj-op-readiness", predicate: "after Autonomous Electric Vehicle Providing, Operational Readiness is fleet-active", category: "correctness" as const, enabled: true }],
]) };

// ===== SAVE =====
const outPath = resolve(__dirname, "../tests/ev-ams.opmodel");
writeFileSync(outPath, saveModel(m));
const webPath = resolve(__dirname, "../packages/web/public/ev-ams.opmodel");
writeFileSync(webPath, saveModel(m));

// Validate
const errors = validate(m);
const hard = errors.filter(e => !e.severity || e.severity === "error");
const warnings = errors.filter(e => e.severity === "warning" || e.severity === "info");
console.log(`EV-AMS built: ${m.things.size} things, ${m.states.size} states, ${m.links.size} links, ${m.opds.size} OPDs`);
console.log(`Validation: ${hard.length} errors, ${warnings.length} warnings`);
if (hard.length > 0) {
  for (const e of hard) console.log(`  ERROR: ${e.code} — ${e.message}`);
}
for (const w of warnings.slice(0, 5)) console.log(`  ${w.severity}: ${w.code} — ${w.message}`);
console.log(`Saved to ${outPath}`);
