// Build EV-AMS canonical example programmatically
import { createModel, addThing, addState, addLink, addOPD, addAppearance, addAssertion, addRequirement, addScenario, addFan, addModifier, refineThing, saveModel, isOk, validate } from "../packages/core/src/index";
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
m = unwrap(addLink(m, { id: "lnk-consume-raw", type: "consumption", source: "obj-raw-materials", target: "proc-aev-providing", distributed: true }));
m = unwrap(addLink(m, { id: "lnk-consume-energy", type: "consumption", source: "obj-electric-energy", target: "proc-aev-providing", distributed: true }));

// Result
m = unwrap(addLink(m, { id: "lnk-result-trips", type: "result", source: "proc-aev-providing", target: "obj-urban-trips", distributed: true }));

// Problem occurrence
m = unwrap(addLink(m, { id: "lnk-problem-mob", type: "effect", source: "proc-fossil-using", target: "obj-mobility-convenience" }));

// ===== SD APPEARANCES =====
const SD_THINGS = [
  { id: "proc-aev-providing", x: 360, y: 285, w: 320, h: 110 },
  { id: "obj-commuter-group", x: 50, y: 40, w: 220, h: 60 },
  { id: "obj-mobility-convenience", x: 320, y: 40, w: 230, h: 70 },
  { id: "obj-aev", x: 650, y: 40, w: 280, h: 60 },
  { id: "obj-op-readiness", x: 650, y: 140, w: 250, h: 72 },
  { id: "obj-mfg-eng-group", x: 40, y: 190, w: 240, h: 50 },
  { id: "obj-fleet-op-group", x: 40, y: 290, w: 220, h: 50 },
  { id: "obj-ev-ams", x: 390, y: 150, w: 200, h: 60 },
  { id: "obj-robot-line", x: 760, y: 240, w: 220, h: 50 },
  { id: "obj-nav-software", x: 760, y: 310, w: 270, h: 50 },
  { id: "obj-charging-stations", x: 760, y: 380, w: 250, h: 50 },
  { id: "obj-raw-materials", x: 40, y: 440, w: 190, h: 50 },
  { id: "obj-electric-energy", x: 250, y: 440, w: 170, h: 50 },
  { id: "obj-urban-trips", x: 580, y: 455, w: 200, h: 50 },
  { id: "obj-road-network", x: 790, y: 525, w: 220, h: 50 },
  { id: "obj-regulations", x: 40, y: 540, w: 180, h: 50 },
  { id: "obj-weather", x: 250, y: 540, w: 160, h: 50 },
  { id: "proc-fossil-using", x: 430, y: 575, w: 340, h: 70 },
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
  m = unwrap(addAppearance(m, { thing: sp.id, opd: "opd-sd1", x: 335, y: sp.y, w: 230, h: 60, internal: true }));
}

// Container
m = unwrap(addAppearance(m, { thing: "proc-aev-providing", opd: "opd-sd1", x: 230, y: 20, w: 430, h: 540, internal: true }));

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
const qualityEngineer: Thing = { id: "obj-quality-engineer", kind: "object", name: "Quality Engineer", essence: "physical", affiliation: "systemic" };
m = unwrap(addThing(m, qualityEngineer));
const testEquipment: Thing = { id: "obj-test-equipment", kind: "object", name: "Test Equipment Set", essence: "physical", affiliation: "systemic" };
m = unwrap(addThing(m, testEquipment));

// SD1 external appearances
m = unwrap(addAppearance(m, { thing: "obj-aev-assembly", opd: "opd-sd1", x: 735, y: 90, w: 195, h: 60 }));
m = unwrap(addAppearance(m, { thing: "obj-mfg-quality", opd: "opd-sd1", x: 715, y: 190, w: 270, h: 76 }));
m = unwrap(addAppearance(m, { thing: "obj-test-report", opd: "opd-sd1", x: 745, y: 315, w: 180, h: 50 }));
m = unwrap(addAppearance(m, { thing: "obj-raw-materials", opd: "opd-sd1", x: 30, y: 75, w: 165, h: 50 }));
m = unwrap(addAppearance(m, { thing: "obj-robot-line", opd: "opd-sd1", x: 30, y: 145, w: 200, h: 50 }));
m = unwrap(addAppearance(m, { thing: "obj-mfg-eng-group", opd: "opd-sd1", x: 30, y: 215, w: 210, h: 50 }));
m = unwrap(addAppearance(m, { thing: "obj-quality-engineer", opd: "opd-sd1", x: 30, y: 285, w: 195, h: 50 }));
m = unwrap(addAppearance(m, { thing: "obj-test-equipment", opd: "opd-sd1", x: 30, y: 355, w: 190, h: 50 }));
m = unwrap(addAppearance(m, { thing: "obj-fleet-op-group", opd: "opd-sd1", x: 30, y: 445, w: 195, h: 50 }));
m = unwrap(addAppearance(m, { thing: "obj-nav-software", opd: "opd-sd1", x: 30, y: 515, w: 215, h: 50 }));
m = unwrap(addAppearance(m, { thing: "obj-road-network", opd: "opd-sd1", x: 30, y: 585, w: 220, h: 50 }));

// SD1 links
m = unwrap(addLink(m, { id: "lnk-mfg-consume-raw", type: "consumption", source: "obj-raw-materials", target: "proc-mfg", distributed: true }));
m = unwrap(addLink(m, { id: "lnk-mfg-result-assembly", type: "result", source: "proc-mfg", target: "obj-aev-assembly", distributed: true }));
m = unwrap(addLink(m, { id: "lnk-mfg-agent", type: "agent", source: "obj-mfg-eng-group", target: "proc-mfg" }));
m = unwrap(addLink(m, { id: "lnk-mfg-instrument", type: "instrument", source: "obj-robot-line", target: "proc-mfg" }));
m = unwrap(addLink(m, { id: "lnk-mfg-effect-quality", type: "effect", source: "proc-mfg", target: "obj-mfg-quality", target_state: "s-qual-assembled" }));

m = unwrap(addLink(m, { id: "lnk-test-effect-quality", type: "effect", source: "proc-testing", target: "obj-mfg-quality", source_state: "s-qual-assembled", target_state: "s-qual-certified" }));
m = unwrap(addLink(m, { id: "lnk-test-result-report", type: "result", source: "proc-testing", target: "obj-test-report" }));
m = unwrap(addLink(m, { id: "lnk-test-agent", type: "agent", source: "obj-quality-engineer", target: "proc-testing" }));
m = unwrap(addLink(m, { id: "lnk-test-instrument", type: "instrument", source: "obj-test-equipment", target: "proc-testing" }));

m = unwrap(addLink(m, { id: "lnk-deploy-quality-condition", type: "instrument", source: "obj-mfg-quality", target: "proc-deploying", source_state: "s-qual-certified" }));
m = unwrap(addModifier(m, { id: "mod-deploy-quality-condition", over: "lnk-deploy-quality-condition", type: "condition", condition_mode: "wait" }));
m = unwrap(addLink(m, { id: "lnk-deploy-effect-readiness", type: "effect", source: "proc-deploying", target: "obj-op-readiness", source_state: "s-op-undeployed", target_state: "s-op-fleet-active" }));
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

// ===== SD1.1 — AEV Fleet Operating Unfold (Gen-Spec, async) =====
m = unwrap(addOPD(m, { id: "opd-sd1-1", name: "SD1.1", opd_type: "hierarchical", parent_opd: "opd-sd1", refines: "proc-fleet-op", refinement_type: "unfold" }));

// 4 specializations of AEV Fleet Operating (generalization-specialization)
const sd11Procs = [
  { id: "proc-trip-req", name: "Trip Requesting", x: 90, y: 120 },
  { id: "proc-charging", name: "Battery Fast Charging", x: 370, y: 120 },
  { id: "proc-nav", name: "Autonomous Navigating", x: 700, y: 120 },
  { id: "proc-danger-mon", name: "Road Danger Monitoring", x: 700, y: 320 },
];

for (const sp of sd11Procs) {
  m = unwrap(addThing(m, { id: sp.id, kind: "process", name: sp.name, essence: "physical", affiliation: "systemic" }));
  m = unwrap(addAppearance(m, { thing: sp.id, opd: "opd-sd1-1", x: sp.x, y: sp.y, w: 250, h: 60, internal: true }));
}

// Container
m = unwrap(addAppearance(m, { thing: "proc-fleet-op", opd: "opd-sd1-1", x: 40, y: 50, w: 980, h: 420, internal: true }));

// Generalization links: each specialization IS-A Fleet Operating
for (const sp of sd11Procs) {
  m = unwrap(addLink(m, { id: `lnk-gen-${sp.id}`, type: "generalization", source: sp.id, target: "proc-fleet-op" }));
}

// SD1.1 objects
const tripAssignment: Thing = { id: "obj-trip-assignment", kind: "object", name: "Trip Assignment", essence: "informatical", affiliation: "systemic" };
m = unwrap(addThing(m, tripAssignment));
const tripStatus: Thing = { id: "obj-trip-status", kind: "object", name: "Trip Status", essence: "informatical", affiliation: "systemic" };
m = unwrap(addThing(m, tripStatus));
m = unwrap(addState(m, { id: "s-trip-requested", parent: "obj-trip-status", name: "requested", initial: true, final: false, default: true }));
m = unwrap(addState(m, { id: "s-trip-assigned", parent: "obj-trip-status", name: "assigned", initial: false, final: false, default: false }));
m = unwrap(addState(m, { id: "s-trip-completed", parent: "obj-trip-status", name: "completed", initial: false, final: true, default: false }));
const batteryPack: Thing = { id: "obj-battery-pack", kind: "object", name: "Battery Pack", essence: "physical", affiliation: "systemic" };
m = unwrap(addThing(m, batteryPack));
const chargeLevel: Thing = { id: "obj-charge-level", kind: "object", name: "Charge Level", essence: "informatical", affiliation: "systemic" };
m = unwrap(addThing(m, chargeLevel));
m = unwrap(addState(m, { id: "s-charge-depleted", parent: "obj-charge-level", name: "depleted", initial: true, final: false, default: true }));
m = unwrap(addState(m, { id: "s-charge-charging", parent: "obj-charge-level", name: "charging", initial: false, final: false, default: false }));
m = unwrap(addState(m, { id: "s-charge-full", parent: "obj-charge-level", name: "fully charged", initial: false, final: true, default: false }));
const batteryTemperature: Thing = { id: "obj-battery-temperature", kind: "object", name: "Temperature", essence: "informatical", affiliation: "systemic" };
m = unwrap(addThing(m, batteryTemperature));
m = unwrap(addState(m, { id: "s-temp-cold", parent: "obj-battery-temperature", name: "cold", initial: true, final: false, default: true }));
m = unwrap(addState(m, { id: "s-temp-nominal", parent: "obj-battery-temperature", name: "nominal", initial: false, final: false, default: false }));
m = unwrap(addState(m, { id: "s-temp-overheating", parent: "obj-battery-temperature", name: "overheating", initial: false, final: true, default: false }));
const cycleCount: Thing = { id: "obj-cycle-count", kind: "object", name: "Cycle Count", essence: "informatical", affiliation: "systemic" };
m = unwrap(addThing(m, cycleCount));
const coolingSystem: Thing = { id: "obj-cooling-system", kind: "object", name: "Cooling System", essence: "physical", affiliation: "systemic" };
m = unwrap(addThing(m, coolingSystem));
const thermalEnergy: Thing = { id: "obj-thermal-energy", kind: "object", name: "Thermal Energy", essence: "physical", affiliation: "systemic" };
m = unwrap(addThing(m, thermalEnergy));
const chargingStation: Thing = { id: "obj-charging-station", kind: "object", name: "Battery Charging Station", essence: "physical", affiliation: "systemic" };
m = unwrap(addThing(m, chargingStation));
const sensorSuite: Thing = { id: "obj-sensor-suite", kind: "object", name: "Sensor Suite", essence: "physical", affiliation: "systemic" };
m = unwrap(addThing(m, sensorSuite));
for (const sensor of [
  { id: "obj-camera-set", name: "Camera Set" },
  { id: "obj-lidar-set", name: "LiDAR Set" },
  { id: "obj-radar-set", name: "Radar Set" },
  { id: "obj-ultrasonic-set", name: "Ultrasonic Sensor Set" },
]) {
  m = unwrap(addThing(m, { id: sensor.id, kind: "object", name: sensor.name, essence: "physical", affiliation: "systemic" }));
}
const roadDangerRep: Thing = { id: "obj-road-danger", kind: "object", name: "Road Danger Representation", essence: "informatical", affiliation: "systemic" };
m = unwrap(addThing(m, roadDangerRep));
m = unwrap(addState(m, { id: "s-danger-none", parent: "obj-road-danger", name: "not detected", initial: true, final: false, default: true }));
m = unwrap(addState(m, { id: "s-danger-alert", parent: "obj-road-danger", name: "alert issued", initial: false, final: true, default: false }));
const mobileApp: Thing = { id: "obj-mobile-app", kind: "object", name: "Mobile Application", essence: "informatical", affiliation: "systemic" };
m = unwrap(addThing(m, mobileApp));
const gpsSat: Thing = { id: "obj-gps-sat", kind: "object", name: "GPS Satellite Set", essence: "physical", affiliation: "environmental" };
m = unwrap(addThing(m, gpsSat));
const location: Thing = { id: "obj-location", kind: "object", name: "Location", essence: "informatical", affiliation: "systemic" };
m = unwrap(addThing(m, location));
m = unwrap(addState(m, { id: "s-loc-origin", parent: "obj-location", name: "origin", initial: true, final: false, default: true }));
m = unwrap(addState(m, { id: "s-loc-dest", parent: "obj-location", name: "destination", initial: false, final: true, default: false }));
const electricGrid: Thing = { id: "obj-electric-grid", kind: "object", name: "Electric Grid", essence: "physical", affiliation: "environmental" };
m = unwrap(addThing(m, electricGrid));

// SD1.1 appearances — trip lane (left), battery lane (center), nav/safety lane (right)
const sd11Objs = [
  { id: "obj-mobile-app", x: 40, y: 520, w: 190, h: 50 },
  { id: "obj-commuter-group", x: 40, y: 600, w: 200, h: 50 },
  { id: "obj-trip-status", x: 60, y: 690, w: 210, h: 64 },
  { id: "obj-trip-assignment", x: 60, y: 780, w: 210, h: 50 },
  { id: "obj-urban-trips", x: 60, y: 860, w: 210, h: 50 },

  { id: "obj-battery-pack", x: 390, y: 520, w: 220, h: 56 },
  { id: "obj-charge-level", x: 310, y: 620, w: 180, h: 64 },
  { id: "obj-battery-temperature", x: 520, y: 620, w: 190, h: 64 },
  { id: "obj-cycle-count", x: 410, y: 715, w: 180, h: 50 },
  { id: "obj-cooling-system", x: 310, y: 810, w: 180, h: 50 },
  { id: "obj-thermal-energy", x: 520, y: 810, w: 180, h: 50 },
  { id: "obj-charging-station", x: 420, y: 900, w: 210, h: 50 },

  { id: "obj-nav-software", x: 860, y: 40, w: 220, h: 50 },
  { id: "obj-gps-sat", x: 880, y: 120, w: 210, h: 50 },
  { id: "obj-road-network", x: 880, y: 200, w: 220, h: 50 },
  { id: "obj-electric-grid", x: 880, y: 280, w: 200, h: 50 },
  { id: "obj-location", x: 880, y: 360, w: 210, h: 64 },
  { id: "obj-sensor-suite", x: 860, y: 520, w: 210, h: 50 },
  { id: "obj-road-danger", x: 860, y: 620, w: 230, h: 64 },
];
for (const o of sd11Objs) {
  m = unwrap(addAppearance(m, { thing: o.id, opd: "opd-sd1-1", x: o.x, y: o.y, w: o.w, h: o.h }));
}

// SD1.1 links
m = unwrap(addLink(m, { id: "lnk-trip-result", type: "result", source: "proc-trip-req", target: "obj-trip-assignment" }));
m = unwrap(addLink(m, { id: "lnk-trip-effect-status", type: "effect", source: "proc-trip-req", target: "obj-trip-status", source_state: "s-trip-requested", target_state: "s-trip-assigned" }));
m = unwrap(addLink(m, { id: "lnk-trip-agent", type: "agent", source: "obj-commuter-group", target: "proc-trip-req" }));
m = unwrap(addLink(m, { id: "lnk-trip-instrument", type: "instrument", source: "obj-mobile-app", target: "proc-trip-req" }));
m = unwrap(addLink(m, { id: "lnk-nav-effect-loc", type: "effect", source: "proc-nav", target: "obj-location", source_state: "s-loc-origin", target_state: "s-loc-dest" }));
m = unwrap(addLink(m, { id: "lnk-nav-effect-trip", type: "effect", source: "proc-nav", target: "obj-trip-status", source_state: "s-trip-assigned", target_state: "s-trip-completed" }));
m = unwrap(addLink(m, { id: "lnk-nav-instrument-sw", type: "instrument", source: "obj-nav-software", target: "proc-nav" }));

m = unwrap(addLink(m, { id: "lnk-nav-instrument-road", type: "instrument", source: "obj-road-network", target: "proc-nav" }));
m = unwrap(addLink(m, { id: "lnk-nav-instrument-gps", type: "instrument", source: "obj-gps-sat", target: "proc-nav", multiplicity_source: "+" }));
m = unwrap(addLink(m, { id: "lnk-charging-effect", type: "effect", source: "proc-charging", target: "obj-charge-level", source_state: "s-charge-depleted", target_state: "s-charge-full" }));
m = unwrap(addLink(m, { id: "lnk-charging-consume-energy", type: "consumption", source: "obj-electric-energy", target: "proc-charging" }));
m = unwrap(addLink(m, { id: "lnk-charging-result-thermal", type: "result", source: "proc-charging", target: "obj-thermal-energy" }));
m = unwrap(addLink(m, { id: "lnk-charging-station-instrument", type: "instrument", source: "obj-charging-station", target: "proc-charging" }));
m = unwrap(addLink(m, { id: "lnk-charging-instrument-grid", type: "instrument", source: "obj-electric-grid", target: "proc-charging" }));
m = unwrap(addLink(m, { id: "lnk-charging-temp-condition", type: "instrument", source: "obj-battery-temperature", target: "proc-charging", source_state: "s-temp-nominal" }));
m = unwrap(addModifier(m, { id: "mod-charging-temp-condition", over: "lnk-charging-temp-condition", type: "condition", condition_mode: "wait" }));
m = unwrap(addLink(m, { id: "lnk-danger-effect", type: "effect", source: "proc-danger-mon", target: "obj-road-danger", source_state: "s-danger-none", target_state: "s-danger-alert" }));
m = unwrap(addLink(m, { id: "lnk-danger-instrument", type: "instrument", source: "obj-sensor-suite", target: "proc-danger-mon" }));
// Exhibition: Battery Pack exhibits Charge Level, Temperature, Cycle Count
m = unwrap(addLink(m, { id: "lnk-exhibit-charge", type: "exhibition", source: "obj-battery-pack", target: "obj-charge-level" }));
m = unwrap(addLink(m, { id: "lnk-exhibit-temperature", type: "exhibition", source: "obj-battery-pack", target: "obj-battery-temperature" }));
m = unwrap(addLink(m, { id: "lnk-exhibit-cycle", type: "exhibition", source: "obj-battery-pack", target: "obj-cycle-count" }));
// Exhibition: AEV exhibits Location
m = unwrap(addLink(m, { id: "lnk-exhibit-location", type: "exhibition", source: "obj-aev", target: "obj-location" }));
// Ordered aggregation: Sensor Suite consists of Camera, LiDAR, Radar, Ultrasonic sensors
m = unwrap(addLink(m, { id: "lnk-sensor-camera", type: "aggregation", source: "obj-sensor-suite", target: "obj-camera-set", ordered: true }));
m = unwrap(addLink(m, { id: "lnk-sensor-lidar", type: "aggregation", source: "obj-sensor-suite", target: "obj-lidar-set", ordered: true }));
m = unwrap(addLink(m, { id: "lnk-sensor-radar", type: "aggregation", source: "obj-sensor-suite", target: "obj-radar-set", ordered: true }));
m = unwrap(addLink(m, { id: "lnk-sensor-ultrasonic", type: "aggregation", source: "obj-sensor-suite", target: "obj-ultrasonic-set", ordered: true }));
// Tagged: Trip Assignment represents Urban Trip; Cooling System cools Battery Pack
m = unwrap(addLink(m, { id: "lnk-tagged-represents", type: "tagged", source: "obj-trip-assignment", target: "obj-urban-trips", tag: "represents" }));
m = unwrap(addLink(m, { id: "lnk-tagged-cools", type: "tagged", source: "obj-cooling-system", target: "obj-battery-pack", tag: "cools" }));

// ===== SD1.1.1 — Road Danger Monitoring In-Zoom (sync + XOR) =====
m = unwrap(addOPD(m, { id: "opd-sd1-1-1", name: "SD1.1.1", opd_type: "hierarchical", parent_opd: "opd-sd1-1", refines: "proc-danger-mon", refinement_type: "in-zoom" }));

const sd111Procs = [
  { id: "proc-sensing", name: "Environment Sensing", x: 120, y: 110, w: 220 },
  { id: "proc-detecting", name: "Object Detecting", x: 120, y: 220, w: 220 },
  { id: "proc-assessing", name: "Threat Assessing", x: 420, y: 220, w: 220 },
  { id: "proc-alerting", name: "Alert Issuing", x: 420, y: 360, w: 200 },
  { id: "proc-visual-warning", name: "Visual Warning Displaying", x: 180, y: 500, w: 250 },
  { id: "proc-emergency-braking", name: "Emergency Braking Initiating", x: 610, y: 500, w: 250 },
];

for (const sp of sd111Procs) {
  m = unwrap(addThing(m, { id: sp.id, kind: "process", name: sp.name, essence: "informatical", affiliation: "systemic" }));
  m = unwrap(addAppearance(m, { thing: sp.id, opd: "opd-sd1-1-1", x: sp.x, y: sp.y, w: sp.w, h: 60, internal: true }));
}

m = unwrap(addAppearance(m, { thing: "proc-danger-mon", opd: "opd-sd1-1-1", x: 70, y: 50, w: 870, h: 560, internal: true }));

// Threat Level object with XOR states
const threatLevel: Thing = { id: "obj-threat-level", kind: "object", name: "Threat Level", essence: "informatical", affiliation: "systemic" };
m = unwrap(addThing(m, threatLevel));
m = unwrap(addState(m, { id: "s-threat-unassessed", parent: "obj-threat-level", name: "unassessed", initial: true, final: false, default: true }));
m = unwrap(addState(m, { id: "s-threat-none", parent: "obj-threat-level", name: "none", initial: false, final: false, default: false }));
m = unwrap(addState(m, { id: "s-threat-warning", parent: "obj-threat-level", name: "warning", initial: false, final: false, default: false }));
m = unwrap(addState(m, { id: "s-threat-critical", parent: "obj-threat-level", name: "critical", initial: false, final: true, default: false }));
const detectionSignal: Thing = { id: "obj-detection-signal", kind: "object", name: "Detection Signal", essence: "informatical", affiliation: "systemic" };
m = unwrap(addThing(m, detectionSignal));
const warningDisplay: Thing = { id: "obj-warning-display", kind: "object", name: "Visual Warning", essence: "informatical", affiliation: "systemic" };
m = unwrap(addThing(m, warningDisplay));
const brakeStatus: Thing = { id: "obj-brake-status", kind: "object", name: "Brake Status", essence: "informatical", affiliation: "systemic" };
m = unwrap(addThing(m, brakeStatus));
m = unwrap(addState(m, { id: "s-brake-idle", parent: "obj-brake-status", name: "idle", initial: true, final: false, default: true }));
m = unwrap(addState(m, { id: "s-brake-engaged", parent: "obj-brake-status", name: "engaged", initial: false, final: true, default: false }));

m = unwrap(addAppearance(m, { thing: "obj-sensor-suite", opd: "opd-sd1-1-1", x: 690, y: 90, w: 200, h: 50 }));
m = unwrap(addAppearance(m, { thing: "obj-detection-signal", opd: "opd-sd1-1-1", x: 395, y: 120, w: 200, h: 50 }));
m = unwrap(addAppearance(m, { thing: "obj-threat-level", opd: "opd-sd1-1-1", x: 690, y: 235, w: 220, h: 72 }));
m = unwrap(addAppearance(m, { thing: "obj-road-danger", opd: "opd-sd1-1-1", x: 690, y: 360, w: 230, h: 64 }));
m = unwrap(addAppearance(m, { thing: "obj-warning-display", opd: "opd-sd1-1-1", x: 170, y: 420, w: 210, h: 50 }));
m = unwrap(addAppearance(m, { thing: "obj-brake-status", opd: "opd-sd1-1-1", x: 700, y: 440, w: 220, h: 68 }));
for (const [thing, y] of [["obj-camera-set", 90], ["obj-lidar-set", 150], ["obj-radar-set", 210], ["obj-ultrasonic-set", 270]] as const) {
  m = unwrap(addAppearance(m, { thing, opd: "opd-sd1-1-1", x: 940, y, w: 180, h: 44 }));
}

// Detection chain + invocation
m = unwrap(addLink(m, { id: "lnk-sensing-instrument", type: "instrument", source: "obj-sensor-suite", target: "proc-sensing" }));
m = unwrap(addLink(m, { id: "lnk-sensing-result-signal", type: "result", source: "proc-sensing", target: "obj-detection-signal" }));
m = unwrap(addLink(m, { id: "lnk-detecting-consume-signal", type: "consumption", source: "obj-detection-signal", target: "proc-detecting" }));
m = unwrap(addLink(m, { id: "lnk-invocation-detect-assess", type: "invocation", source: "proc-detecting", target: "proc-assessing" }));

// Threat Assessing updates Threat Level; branching is modeled via XOR over state-specified downstream links
m = unwrap(addLink(m, { id: "lnk-assess-effect", type: "effect", source: "proc-assessing", target: "obj-threat-level", source_state: "s-threat-unassessed", target_state: "s-threat-warning" }));

// Alerting / warning / braking branching
m = unwrap(addLink(m, { id: "lnk-alert-none-condition", type: "instrument", source: "obj-threat-level", target: "proc-alerting", source_state: "s-threat-none" }));
m = unwrap(addModifier(m, { id: "mod-alert-none-skip", over: "lnk-alert-none-condition", type: "condition", condition_mode: "skip" }));
m = unwrap(addLink(m, { id: "lnk-alert-effect", type: "effect", source: "proc-alerting", target: "obj-road-danger", target_state: "s-danger-alert" }));
m = unwrap(addLink(m, { id: "lnk-visual-warning-condition", type: "instrument", source: "obj-threat-level", target: "proc-visual-warning", source_state: "s-threat-warning" }));
m = unwrap(addModifier(m, { id: "mod-visual-warning-condition", over: "lnk-visual-warning-condition", type: "condition", condition_mode: "wait" }));
m = unwrap(addLink(m, { id: "lnk-visual-warning-result", type: "result", source: "proc-visual-warning", target: "obj-warning-display" }));
m = unwrap(addLink(m, { id: "lnk-braking-critical-event", type: "instrument", source: "obj-threat-level", target: "proc-emergency-braking", source_state: "s-threat-critical" }));
m = unwrap(addModifier(m, { id: "mod-braking-critical-event", over: "lnk-braking-critical-event", type: "event" }));
m = unwrap(addLink(m, { id: "lnk-braking-effect", type: "effect", source: "proc-emergency-braking", target: "obj-brake-status", source_state: "s-brake-idle", target_state: "s-brake-engaged" }));
m = unwrap(addFan(m, { id: "fan-threat-xor", type: "xor", direction: "diverging", members: ["lnk-alert-none-condition", "lnk-visual-warning-condition", "lnk-braking-critical-event"] }));

// ===== SD1.2 — AEV Manufacturing In-Zoom (sync + parallel) =====
m = unwrap(addOPD(m, { id: "opd-sd1-2", name: "SD1.2", opd_type: "hierarchical", parent_opd: "opd-sd1", refines: "proc-mfg", refinement_type: "in-zoom" }));

const sd12Procs = [
  { id: "proc-chassis", name: "Chassis Assembling", y: 80 },
  { id: "proc-battery-install", name: "Battery Pack Installing", y: 200 },
  { id: "proc-sw-loading", name: "Software Loading", y: 320 },
  { id: "proc-final-inspect", name: "Final Inspecting", y: 440 },
];

for (const sp of sd12Procs) {
  m = unwrap(addThing(m, { id: sp.id, kind: "process", name: sp.name, essence: "physical", affiliation: "systemic" }));
  m = unwrap(addAppearance(m, { thing: sp.id, opd: "opd-sd1-2", x: 220, y: sp.y, w: 240, h: 60, internal: true }));
}

m = unwrap(addAppearance(m, { thing: "proc-mfg", opd: "opd-sd1-2", x: 140, y: 20, w: 420, h: 540, internal: true }));

// Generalization: robots + robot line aggregation
const weldingRobot: Thing = { id: "obj-welding-robot", kind: "object", name: "Welding Robot", essence: "physical", affiliation: "systemic" };
const assemblyRobot: Thing = { id: "obj-assembly-robot", kind: "object", name: "Assembly Robot", essence: "physical", affiliation: "systemic" };
const paintingRobot: Thing = { id: "obj-painting-robot", kind: "object", name: "Painting Robot Set", essence: "physical", affiliation: "systemic" };
m = unwrap(addThing(m, weldingRobot));
m = unwrap(addThing(m, assemblyRobot));
m = unwrap(addThing(m, paintingRobot));
m = unwrap(addAppearance(m, { thing: "obj-raw-materials", opd: "opd-sd1-2", x: 30, y: 85, w: 175, h: 50 }));
m = unwrap(addAppearance(m, { thing: "obj-welding-robot", opd: "opd-sd1-2", x: 670, y: 70, w: 180, h: 50 }));
m = unwrap(addAppearance(m, { thing: "obj-assembly-robot", opd: "opd-sd1-2", x: 670, y: 140, w: 180, h: 50 }));
m = unwrap(addAppearance(m, { thing: "obj-painting-robot", opd: "opd-sd1-2", x: 670, y: 210, w: 190, h: 50 }));
m = unwrap(addAppearance(m, { thing: "obj-robot-line", opd: "opd-sd1-2", x: 670, y: 300, w: 220, h: 56 }));
m = unwrap(addAppearance(m, { thing: "obj-aev-assembly", opd: "opd-sd1-2", x: 670, y: 445, w: 210, h: 52 }));

// Generalization links: Welding Robot and Assembly Robot are Industrial Robot (using robot-line as general)
m = unwrap(addLink(m, { id: "lnk-gen-welding", type: "generalization", source: "obj-welding-robot", target: "obj-robot-line" }));
m = unwrap(addLink(m, { id: "lnk-gen-assembly", type: "generalization", source: "obj-assembly-robot", target: "obj-robot-line" }));
m = unwrap(addLink(m, { id: "lnk-gen-painting", type: "generalization", source: "obj-painting-robot", target: "obj-robot-line" }));
m = unwrap(addLink(m, { id: "lnk-agg-welding", type: "aggregation", source: "obj-robot-line", target: "obj-welding-robot", incomplete: true }));
m = unwrap(addLink(m, { id: "lnk-agg-assembly", type: "aggregation", source: "obj-robot-line", target: "obj-assembly-robot", incomplete: true }));
m = unwrap(addLink(m, { id: "lnk-agg-painting", type: "aggregation", source: "obj-robot-line", target: "obj-painting-robot", incomplete: true }));

// Agent links for robots
m = unwrap(addLink(m, { id: "lnk-welding-agent", type: "agent", source: "obj-welding-robot", target: "proc-chassis" }));
m = unwrap(addLink(m, { id: "lnk-assembly-agent", type: "agent", source: "obj-assembly-robot", target: "proc-battery-install" }));

// Consumption: Chassis Assembling consumes Raw Material Set
m = unwrap(addLink(m, { id: "lnk-chassis-consume", type: "consumption", source: "obj-raw-materials", target: "proc-chassis" }));
// Result: Final Inspecting yields AEV Assembly
m = unwrap(addLink(m, { id: "lnk-inspect-result", type: "result", source: "proc-final-inspect", target: "obj-aev-assembly", distributed: true }));

// Classification-instantiation: AEV-001 and AEV-002 are instances of AEV
const aev001: Thing = { id: "obj-aev-001", kind: "object", name: "AEV-001", essence: "physical", affiliation: "systemic" };
const aev002: Thing = { id: "obj-aev-002", kind: "object", name: "AEV-002", essence: "physical", affiliation: "systemic" };
const vin: Thing = { id: "obj-vin", kind: "object", name: "VIN", essence: "informatical", affiliation: "systemic" };
m = unwrap(addThing(m, aev001));
m = unwrap(addThing(m, aev002));
m = unwrap(addThing(m, vin));

m = unwrap(addLink(m, { id: "lnk-cls-aev-001", type: "classification", source: "obj-aev", target: "obj-aev-001" }));
m = unwrap(addLink(m, { id: "lnk-cls-aev-002", type: "classification", source: "obj-aev", target: "obj-aev-002" }));
m = unwrap(addLink(m, { id: "lnk-exhibit-vin", type: "exhibition", source: "obj-aev-001", target: "obj-vin" }));

// Final Inspecting in-zoom with parallel subprocesses
m = unwrap(addOPD(m, { id: "opd-sd1-2-1", name: "SD1.2.1", opd_type: "hierarchical", parent_opd: "opd-sd1-2", refines: "proc-final-inspect", refinement_type: "in-zoom" }));
for (const sp of [
  { id: "proc-mechanical-inspecting", name: "Mechanical Inspecting", x: 210, y: 135 },
  { id: "proc-software-validating", name: "Software Validating", x: 510, y: 135 },
] as const) {
  m = unwrap(addThing(m, { id: sp.id, kind: "process", name: sp.name, essence: "physical", affiliation: "systemic" }));
  m = unwrap(addAppearance(m, { thing: sp.id, opd: "opd-sd1-2-1", x: sp.x, y: sp.y, w: 220, h: 60, internal: true }));
}
m = unwrap(addAppearance(m, { thing: "proc-final-inspect", opd: "opd-sd1-2-1", x: 170, y: 70, w: 610, h: 200, internal: true }));
const inspectionStatus: Thing = { id: "obj-inspection-status", kind: "object", name: "Inspection Status", essence: "informatical", affiliation: "systemic" };
m = unwrap(addThing(m, inspectionStatus));
m = unwrap(addState(m, { id: "s-inspection-pending", parent: "obj-inspection-status", name: "pending", initial: true, final: false, default: true }));
m = unwrap(addState(m, { id: "s-inspection-approved", parent: "obj-inspection-status", name: "approved", initial: false, final: true, default: false }));
m = unwrap(addAppearance(m, { thing: "obj-inspection-status", opd: "opd-sd1-2-1", x: 830, y: 130, w: 210, h: 68 }));
m = unwrap(addAppearance(m, { thing: "obj-aev-assembly", opd: "opd-sd1-2-1", x: 835, y: 225, w: 195, h: 52 }));
m = unwrap(addLink(m, { id: "lnk-mech-inspection-effect", type: "effect", source: "proc-mechanical-inspecting", target: "obj-inspection-status", source_state: "s-inspection-pending", target_state: "s-inspection-approved" }));
m = unwrap(addLink(m, { id: "lnk-sw-validation-effect", type: "effect", source: "proc-software-validating", target: "obj-aev-assembly" }));

// Fix: Add transformee links for processes that lack them
m = unwrap(addLink(m, { id: "lnk-battery-install-effect", type: "effect", source: "proc-battery-install", target: "obj-aev-assembly" }));
m = unwrap(addLink(m, { id: "lnk-detecting-effect", type: "effect", source: "proc-detecting", target: "obj-threat-level" }));
m = unwrap(addLink(m, { id: "lnk-fleet-effect-mob", type: "effect", source: "proc-fleet-op", target: "obj-mobility-convenience", source_state: "s-mob-limited", target_state: "s-mob-enhanced" }));
m = unwrap(addLink(m, { id: "lnk-sensing-effect", type: "effect", source: "proc-sensing", target: "obj-road-danger" }));
m = unwrap(addLink(m, { id: "lnk-sw-loading-effect", type: "effect", source: "proc-sw-loading", target: "obj-aev-assembly" }));
// Fix: connect environmental objects to main process
m = unwrap(addLink(m, { id: "lnk-instrument-regulations", type: "instrument", source: "obj-regulations", target: "proc-aev-providing" }));
m = unwrap(addLink(m, { id: "lnk-instrument-weather", type: "instrument", source: "obj-weather", target: "proc-aev-providing" }));
// ===== SAVE =====
const outPath = resolve(__dirname, "../tests/ev-ams.opmodel");
writeFileSync(outPath, saveModel(m));
const webPath = resolve(__dirname, "../packages/web/public/ev-ams.opmodel");
writeFileSync(webPath, saveModel(m));

const errors = validate(m);
const hard = errors.filter(e => !e.severity || e.severity === "error");
const warnings = errors.filter(e => e.severity === "warning" || e.severity === "info");
console.log(`EV-AMS built: ${m.things.size} things, ${m.states.size} states, ${m.links.size} links, ${m.opds.size} OPDs`);
console.log(`Validation: ${hard.length} errors, ${warnings.length} warnings`);
if (hard.length > 0) for (const e of hard) console.log(`  ERROR: ${e.code} — ${e.message}`);
for (const w of warnings.slice(0, 5)) console.log(`  ${w.severity}: ${w.code} — ${w.message}`);
console.log(`Saved to ${outPath}`);
