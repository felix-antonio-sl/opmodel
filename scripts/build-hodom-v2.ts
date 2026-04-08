// HODOM V2 — Hospitalización Domiciliaria built from OPM methodology + DS 1/2022 + NT MINSAL 2024
import { createModel, addThing, addState, addLink, addOPD, addAppearance, addRequirement, addAssertion, updateSettings, saveModel, isOk, validate } from "../packages/core/src/index";
import { writeFileSync } from "fs";
import { resolve } from "path";
import type { Model, Thing } from "../packages/core/src/types";

function u<T>(r: { ok: true; value: T } | { ok: false; error: any }): T {
  if (!isOk(r)) throw new Error(`Failed: ${JSON.stringify(r.error)}`);
  return r.value;
}

let m = createModel("Hospitalización Domiciliaria", "socio-technical");
m = u(updateSettings(m, { opl_language: "es" }));

// ============================================================
// SD — SYSTEM DIAGRAM (Nivel 0) — 10 pasos metodología OPM
// ============================================================

// === PASO 1: Proceso Principal (§6.1) ===
// Nombre: gerundio. Función del sistema = proveer atención domiciliaria
m = u(addThing(m, { id: "proc-hd-proveyendo", kind: "process", name: "Hospitalización Domiciliaria Proveyendo", essence: "physical", affiliation: "systemic" }));

// === PASO 2: Grupo Beneficiario (§6.2) ===
// Paciente Group — personas que reciben la atención. Physical, environmental (fuera del control del sistema).
m = u(addThing(m, { id: "obj-paciente-group", kind: "object", name: "Paciente Group", essence: "physical", affiliation: "environmental" }));

// === PASO 3: Atributo del Beneficiario + Estados (§6.3) ===
// Estado de Salud: deteriorado → estabilizado
m = u(addThing(m, { id: "obj-estado-salud", kind: "object", name: "Estado de Salud", essence: "informatical", affiliation: "systemic" }));
m = u(addState(m, { id: "s-salud-deteriorado", parent: "obj-estado-salud", name: "deteriorado", initial: true, final: false, default: true }));
m = u(addState(m, { id: "s-salud-estabilizado", parent: "obj-estado-salud", name: "estabilizado", initial: false, final: true, default: false }));

// === PASO 4: Transformee + Benefit-Providing Attribute (§6.4) ===
// Paciente = Benefit-Providing Object. Condición Clínica = atributo que cambia.
m = u(addThing(m, { id: "obj-paciente", kind: "object", name: "Paciente", essence: "physical", affiliation: "systemic" }));
m = u(addThing(m, { id: "obj-condicion-clinica", kind: "object", name: "Condición Clínica", essence: "informatical", affiliation: "systemic" }));
m = u(addState(m, { id: "s-cond-agudo", parent: "obj-condicion-clinica", name: "agudo", initial: true, final: false, default: true }));
m = u(addState(m, { id: "s-cond-estable", parent: "obj-condicion-clinica", name: "estable", initial: false, final: false, default: false }));
m = u(addState(m, { id: "s-cond-egresado", parent: "obj-condicion-clinica", name: "egresado", initial: false, final: true, default: false }));

// === PASO 5: Agentes (§6.5) ===
// DS 1/2022 Art.7-10: Director Técnico (médico cirujano) + Equipo Clínico
m = u(addThing(m, { id: "obj-director-tecnico", kind: "object", name: "Director Técnico", essence: "physical", affiliation: "systemic" }));
m = u(addThing(m, { id: "obj-equipo-clinico-group", kind: "object", name: "Equipo Clínico Group", essence: "physical", affiliation: "systemic" }));
m = u(addThing(m, { id: "obj-medico-regulador", kind: "object", name: "Médico Regulador", essence: "physical", affiliation: "systemic" }));

// === PASO 6: Sistema + Exhibition (§6.6) ===
// Servicio de Hospitalización Domiciliaria = el sistema
m = u(addThing(m, { id: "obj-servicio-hd", kind: "object", name: "Servicio de Hospitalización Domiciliaria", essence: "physical", affiliation: "systemic" }));
m = u(addThing(m, { id: "obj-autorizacion-sanitaria", kind: "object", name: "Autorización Sanitaria", essence: "informatical", affiliation: "systemic" }));
m = u(addState(m, { id: "s-auth-vigente", parent: "obj-autorizacion-sanitaria", name: "vigente", initial: true, final: false, default: true }));
m = u(addState(m, { id: "s-auth-vencida", parent: "obj-autorizacion-sanitaria", name: "vencida", initial: false, final: true, default: false }));

// === PASO 7: Instrumentos (§6.7) ===
// DS 1/2022: equipamiento, medicamentos, vehículo, teléfono, ficha clínica
m = u(addThing(m, { id: "obj-equipamiento-medico", kind: "object", name: "Equipamiento Médico Set", essence: "physical", affiliation: "systemic" }));
m = u(addThing(m, { id: "obj-medicamentos", kind: "object", name: "Medicamentos Set", essence: "physical", affiliation: "systemic" }));
m = u(addThing(m, { id: "obj-vehiculo", kind: "object", name: "Vehículo de Transporte", essence: "physical", affiliation: "systemic" }));
m = u(addThing(m, { id: "obj-telefono", kind: "object", name: "Teléfono", essence: "physical", affiliation: "systemic" }));
m = u(addThing(m, { id: "obj-ficha-clinica", kind: "object", name: "Ficha Clínica", essence: "informatical", affiliation: "systemic" }));

// === PASO 8: Input/Output (§6.8) ===
// Derivación (consumed — viene del hospital), Plan Terapéutico (result), Consentimiento (result)
m = u(addThing(m, { id: "obj-derivacion", kind: "object", name: "Derivación", essence: "informatical", affiliation: "systemic" }));
m = u(addThing(m, { id: "obj-plan-terapeutico", kind: "object", name: "Plan Terapéutico", essence: "informatical", affiliation: "systemic" }));
m = u(addThing(m, { id: "obj-consentimiento", kind: "object", name: "Consentimiento Informado", essence: "informatical", affiliation: "systemic" }));

// === PASO 9: Environmental (§6.9) ===
// Domicilio (fuera del control), Cuidador (familiar), Departamento de Emergencia (hospital)
m = u(addThing(m, { id: "obj-domicilio", kind: "object", name: "Domicilio", essence: "physical", affiliation: "environmental" }));
m = u(addThing(m, { id: "obj-cuidador", kind: "object", name: "Cuidador", essence: "physical", affiliation: "environmental" }));
m = u(addThing(m, { id: "obj-depto-emergencia", kind: "object", name: "Departamento de Emergencia", essence: "physical", affiliation: "environmental" }));
m = u(addThing(m, { id: "obj-normativa", kind: "object", name: "Normativa Sanitaria", essence: "informatical", affiliation: "environmental" }));

// === PASO 10: Problem Occurrence (§6.10) ===
m = u(addThing(m, { id: "proc-hospitalizacion-conv", kind: "process", name: "Hospitalización Convencional Saturando", essence: "physical", affiliation: "environmental" }));

// ============================================================
// SD LINKS
// ============================================================

// Exhibition: Sistema exhibe proceso principal
m = u(addLink(m, { id: "lnk-exhibit-hd", type: "exhibition", source: "obj-servicio-hd", target: "proc-hd-proveyendo" }));
// Exhibition: Paciente Group exhibe Estado de Salud
m = u(addLink(m, { id: "lnk-exhibit-salud", type: "exhibition", source: "obj-paciente-group", target: "obj-estado-salud" }));
// Exhibition: Paciente exhibe Condición Clínica
m = u(addLink(m, { id: "lnk-exhibit-condicion", type: "exhibition", source: "obj-paciente", target: "obj-condicion-clinica" }));
// Exhibition: Servicio HD exhibe Autorización
m = u(addLink(m, { id: "lnk-exhibit-auth", type: "exhibition", source: "obj-servicio-hd", target: "obj-autorizacion-sanitaria" }));

// Effect: Proceso principal cambia Estado de Salud
m = u(addLink(m, { id: "lnk-effect-salud", type: "effect", source: "proc-hd-proveyendo", target: "obj-estado-salud", source_state: "s-salud-deteriorado", target_state: "s-salud-estabilizado" }));
// Effect: Proceso principal cambia Condición Clínica
m = u(addLink(m, { id: "lnk-effect-condicion", type: "effect", source: "proc-hd-proveyendo", target: "obj-condicion-clinica", source_state: "s-cond-agudo", target_state: "s-cond-egresado" }));

// Agents
m = u(addLink(m, { id: "lnk-agent-director", type: "agent", source: "obj-director-tecnico", target: "proc-hd-proveyendo" }));
m = u(addLink(m, { id: "lnk-agent-equipo", type: "agent", source: "obj-equipo-clinico-group", target: "proc-hd-proveyendo" }));
m = u(addLink(m, { id: "lnk-agent-regulador", type: "agent", source: "obj-medico-regulador", target: "proc-hd-proveyendo" }));

// Instruments
m = u(addLink(m, { id: "lnk-instr-sistema", type: "instrument", source: "obj-servicio-hd", target: "proc-hd-proveyendo" }));
m = u(addLink(m, { id: "lnk-instr-equipamiento", type: "instrument", source: "obj-equipamiento-medico", target: "proc-hd-proveyendo" }));
m = u(addLink(m, { id: "lnk-instr-medicamentos", type: "instrument", source: "obj-medicamentos", target: "proc-hd-proveyendo" }));
m = u(addLink(m, { id: "lnk-instr-vehiculo", type: "instrument", source: "obj-vehiculo", target: "proc-hd-proveyendo" }));
m = u(addLink(m, { id: "lnk-instr-telefono", type: "instrument", source: "obj-telefono", target: "proc-hd-proveyendo" }));
m = u(addLink(m, { id: "lnk-instr-ficha", type: "instrument", source: "obj-ficha-clinica", target: "proc-hd-proveyendo" }));

// Environmental instruments
m = u(addLink(m, { id: "lnk-instr-domicilio", type: "instrument", source: "obj-domicilio", target: "proc-hd-proveyendo" }));
m = u(addLink(m, { id: "lnk-instr-normativa", type: "instrument", source: "obj-normativa", target: "proc-hd-proveyendo" }));
m = u(addLink(m, { id: "lnk-agent-cuidador", type: "agent", source: "obj-cuidador", target: "proc-hd-proveyendo" }));

// Consumption + Result
m = u(addLink(m, { id: "lnk-consume-derivacion", type: "consumption", source: "obj-derivacion", target: "proc-hd-proveyendo", distributed: true }));
m = u(addLink(m, { id: "lnk-result-plan", type: "result", source: "proc-hd-proveyendo", target: "obj-plan-terapeutico", distributed: true }));
m = u(addLink(m, { id: "lnk-result-consent", type: "result", source: "proc-hd-proveyendo", target: "obj-consentimiento", distributed: true }));

// Problem occurrence
m = u(addLink(m, { id: "lnk-problem-effect", type: "effect", source: "proc-hospitalizacion-conv", target: "obj-estado-salud" }));

// ============================================================
// SD APPEARANCES — layout grid
// ============================================================
const SD = [
  // Center: main process
  { id: "proc-hd-proveyendo", x: 350, y: 320, w: 320, h: 100 },
  // Top: beneficiary + attributes
  { id: "obj-paciente-group", x: 50, y: 40, w: 180, h: 50 },
  { id: "obj-estado-salud", x: 280, y: 40, w: 180, h: 60 },
  { id: "obj-paciente", x: 520, y: 40, w: 160, h: 50 },
  { id: "obj-condicion-clinica", x: 520, y: 120, w: 200, h: 60 },
  // Left: agents
  { id: "obj-director-tecnico", x: 50, y: 200, w: 180, h: 50 },
  { id: "obj-equipo-clinico-group", x: 50, y: 280, w: 200, h: 50 },
  { id: "obj-medico-regulador", x: 50, y: 360, w: 180, h: 50 },
  // Center-top: system
  { id: "obj-servicio-hd", x: 350, y: 180, w: 280, h: 60 },
  { id: "obj-autorizacion-sanitaria", x: 700, y: 180, w: 200, h: 60 },
  // Right: instruments
  { id: "obj-equipamiento-medico", x: 750, y: 280, w: 200, h: 50 },
  { id: "obj-medicamentos", x: 750, y: 340, w: 180, h: 50 },
  { id: "obj-vehiculo", x: 750, y: 400, w: 200, h: 50 },
  { id: "obj-telefono", x: 750, y: 460, w: 140, h: 50 },
  { id: "obj-ficha-clinica", x: 750, y: 520, w: 160, h: 50 },
  // Bottom-left: I/O
  { id: "obj-derivacion", x: 50, y: 480, w: 150, h: 50 },
  { id: "obj-plan-terapeutico", x: 50, y: 550, w: 190, h: 50 },
  { id: "obj-consentimiento", x: 50, y: 620, w: 220, h: 50 },
  // Bottom: environmental
  { id: "obj-domicilio", x: 350, y: 500, w: 140, h: 50 },
  { id: "obj-cuidador", x: 350, y: 570, w: 140, h: 50 },
  { id: "obj-depto-emergencia", x: 550, y: 500, w: 230, h: 50 },
  { id: "obj-normativa", x: 550, y: 570, w: 200, h: 50 },
  // Problem occurrence
  { id: "proc-hospitalizacion-conv", x: 350, y: 680, w: 320, h: 70 },
];

for (const a of SD) {
  m = u(addAppearance(m, { thing: a.id, opd: "opd-sd", ...a }));
}

// ============================================================
// SD1 — In-zoom: Gestión del Paciente (4 subprocesos sincrónicos)
// ============================================================
// Rename main process for in-zoom context
m = u(addOPD(m, { id: "opd-sd1", name: "SD1", opd_type: "hierarchical", parent_opd: "opd-sd", refines: "proc-hd-proveyendo", refinement_type: "in-zoom" }));

const SD1_PROCS = [
  { id: "proc-evaluacion", name: "Evaluación de Elegibilidad", y: 80 },
  { id: "proc-admision", name: "Admisión", y: 200 },
  { id: "proc-atencion-clinica", name: "Atención Clínica", y: 340, h: 80, duration: { nominal: 14, min: 3, max: 90, unit: "d" as const } },
  { id: "proc-egreso", name: "Egresando", y: 480 },
];

for (const sp of SD1_PROCS) {
  m = u(addThing(m, { id: sp.id, kind: "process", name: sp.name, essence: "physical", affiliation: "systemic", ...(sp.duration ? { duration: sp.duration } : {}) }));
  m = u(addAppearance(m, { thing: sp.id, opd: "opd-sd1", x: 300, y: sp.y, w: 250, h: sp.h ?? 60, internal: true }));
}

// Container
m = u(addAppearance(m, { thing: "proc-hd-proveyendo", opd: "opd-sd1", x: 220, y: 20, w: 420, h: 560, internal: true }));

// SD1 externals
const SD1_EXT = [
  { id: "obj-derivacion", x: 30, y: 80 },
  { id: "obj-paciente", x: 30, y: 200, w: 160 },
  { id: "obj-consentimiento", x: 30, y: 300, w: 200 },
  { id: "obj-plan-terapeutico", x: 30, y: 400, w: 190 },
  { id: "obj-condicion-clinica", x: 720, y: 100, w: 200 },
  { id: "obj-equipo-clinico-group", x: 720, y: 200, w: 200 },
  { id: "obj-domicilio", x: 720, y: 320 },
  { id: "obj-cuidador", x: 720, y: 400 },
  { id: "obj-ficha-clinica", x: 720, y: 480 },
  { id: "obj-depto-emergencia", x: 30, y: 520, w: 200 },
];

for (const e of SD1_EXT) {
  m = u(addAppearance(m, { thing: e.id, opd: "opd-sd1", x: e.x, y: e.y, w: e.w ?? 160, h: 50 }));
}

// SD1 links
m = u(addLink(m, { id: "lnk-eval-consume-deriv", type: "consumption", source: "obj-derivacion", target: "proc-evaluacion" }));
m = u(addLink(m, { id: "lnk-eval-effect-cond", type: "effect", source: "proc-evaluacion", target: "obj-condicion-clinica" }));
m = u(addLink(m, { id: "lnk-admision-result-consent", type: "result", source: "proc-admision", target: "obj-consentimiento" }));
m = u(addLink(m, { id: "lnk-admision-result-plan", type: "result", source: "proc-admision", target: "obj-plan-terapeutico" }));
m = u(addLink(m, { id: "lnk-atencion-effect-cond", type: "effect", source: "proc-atencion-clinica", target: "obj-condicion-clinica", source_state: "s-cond-agudo", target_state: "s-cond-estable" }));
m = u(addLink(m, { id: "lnk-atencion-agent-equipo", type: "agent", source: "obj-equipo-clinico-group", target: "proc-atencion-clinica" }));
m = u(addLink(m, { id: "lnk-atencion-instr-domicilio", type: "instrument", source: "obj-domicilio", target: "proc-atencion-clinica" }));
m = u(addLink(m, { id: "lnk-egreso-effect-cond", type: "effect", source: "proc-egreso", target: "obj-condicion-clinica", source_state: "s-cond-estable", target_state: "s-cond-egresado" }));
m = u(addLink(m, { id: "lnk-egreso-instr-ficha", type: "instrument", source: "obj-ficha-clinica", target: "proc-egreso" }));
// Exception: emergencia
m = u(addLink(m, { id: "lnk-exception-emergencia", type: "exception", source: "proc-atencion-clinica", target: "proc-evaluacion" }));

// Requirements from DS 1/2022
m = u(addRequirement(m, { id: "req-plan", target: "obj-plan-terapeutico", name: "Plan Terapéutico Obligatorio", req_id: "R-01", description: "DS 1/2022 Art. 1: indicación médica, plan terapéutico del equipo de salud, término determinado" }));
m = u(addRequirement(m, { id: "req-consent", target: "obj-consentimiento", name: "Consentimiento Informado", req_id: "R-02", description: "Ley 20.584: consentimiento informado obligatorio" }));
m = u(addRequirement(m, { id: "req-auth", target: "obj-autorizacion-sanitaria", name: "Autorización SEREMI", req_id: "R-03", description: "DS 1/2022 Art. 4: autorización sanitaria por SEREMI, vigencia 3 años" }));
m = u(addRequirement(m, { id: "req-equipo", target: "obj-equipo-clinico-group", name: "Equipo Clínico Mínimo", req_id: "R-04", description: "NT 2024: dotación mínima de personal clínico habilitado" }));
m = u(addRequirement(m, { id: "req-director", target: "obj-director-tecnico", name: "Director Técnico Médico", req_id: "R-05", description: "DS 1/2022 Art. 7: médico cirujano, 22h/semana mínimo" }));

// Assertions
m = { ...m, assertions: new Map([
  ["ast-salud", { id: "ast-salud", target: "obj-estado-salud", predicate: "after Hospitalización Domiciliaria Proveyendo, Estado de Salud is estabilizado", category: "safety" as const, enabled: true }],
  ["ast-egreso", { id: "ast-egreso", target: "obj-condicion-clinica", predicate: "after Hospitalización Domiciliaria Proveyendo, Condición Clínica is egresado", category: "correctness" as const, enabled: true }],
]) };

// ============================================================
// SAVE
// ============================================================
const outPath = resolve(__dirname, "../tests/hodom-v2.opmodel");
writeFileSync(outPath, saveModel(m));
const webPath = resolve(__dirname, "../packages/web/public/hodom-v2.opmodel");
writeFileSync(webPath, saveModel(m));

const errors = validate(m);
const hard = errors.filter(e => !e.severity || e.severity === "error");
const warnings = errors.filter(e => e.severity === "warning" || e.severity === "info");
console.log(`HODOM V2 built: ${m.things.size} things, ${m.states.size} states, ${m.links.size} links, ${m.opds.size} OPDs`);
console.log(`Validation: ${hard.length} errors, ${warnings.length} warnings`);
if (hard.length > 0) for (const e of hard) console.log(`  ERROR: ${e.code} — ${e.message}`);
for (const w of warnings.slice(0, 5)) console.log(`  ${w.severity}: ${w.code} — ${w.message}`);
console.log(`Saved to ${outPath}`);
