// HODOM HSC v0 — Hospital de San Carlos
// Modelo OPM socio-técnico basado en DS 1/2022, NT MINSAL 2024 y documentación HSC real
import {
  createModel, addThing, addState, addLink, addOPD, addAppearance,
  addRequirement, addAssertion, updateSettings, saveModel, isOk, validate,
} from "../packages/core/src/index";
import { writeFileSync } from "fs";
import { resolve } from "path";
import type { Model } from "../packages/core/src/types";

function u<T>(r: { ok: true; value: T } | { ok: false; error: any }): T {
  if (!isOk(r)) throw new Error(`Failed: ${JSON.stringify(r.error)}`);
  return r.value;
}

let m = createModel("HODOM HSC — Hospital de San Carlos", "socio-technical");
m = u(updateSettings(m, { opl_language: "es" }));

// ============================================================
// SD — SYSTEM DIAGRAM (Nivel 0) — 10 pasos metodología OPM
// ============================================================

// === PASO 1: Proceso Principal (§6.1) ===
m = u(addThing(m, { id: "proc-hd-hsc", kind: "process", name: "Hospitalización Domiciliaria HSC Proveyendo", essence: "physical", affiliation: "systemic" }));

// === PASO 2: Grupo Beneficiario (§6.2) ===
m = u(addThing(m, { id: "obj-paciente-group", kind: "object", name: "Paciente Group", essence: "physical", affiliation: "environmental" }));

// === PASO 3: Atributo del Beneficiario + Estados (§6.3) ===
m = u(addThing(m, { id: "obj-estado-salud", kind: "object", name: "Estado de Salud", essence: "informatical", affiliation: "systemic" }));
m = u(addState(m, { id: "s-salud-deteriorado", parent: "obj-estado-salud", name: "deteriorado", initial: true, final: false, default: true }));
m = u(addState(m, { id: "s-salud-estabilizado", parent: "obj-estado-salud", name: "estabilizado", initial: false, final: true, default: false }));

// === PASO 4: Transformee + Benefit-Providing Attribute (§6.4) ===
m = u(addThing(m, { id: "obj-paciente", kind: "object", name: "Paciente", essence: "physical", affiliation: "systemic" }));
m = u(addState(m, { id: "s-pac-estable", parent: "obj-paciente", name: "estable", initial: true, final: false, default: true }));
m = u(addState(m, { id: "s-pac-inestable", parent: "obj-paciente", name: "inestable", initial: false, final: false, default: false }));
m = u(addState(m, { id: "s-pac-egresado", parent: "obj-paciente", name: "egresado", initial: false, final: true, default: false }));
m = u(addState(m, { id: "s-pac-fallecido", parent: "obj-paciente", name: "fallecido", initial: false, final: true, default: false }));

m = u(addThing(m, { id: "obj-condicion-clinica", kind: "object", name: "Condición Clínica", essence: "informatical", affiliation: "systemic" }));
m = u(addState(m, { id: "s-cond-agudo", parent: "obj-condicion-clinica", name: "agudo", initial: true, final: false, default: true }));
m = u(addState(m, { id: "s-cond-estable", parent: "obj-condicion-clinica", name: "estable", initial: false, final: false, default: false }));
m = u(addState(m, { id: "s-cond-egresado", parent: "obj-condicion-clinica", name: "egresado", initial: false, final: true, default: false }));

// === PASO 5: Agentes (§6.5) ===
m = u(addThing(m, { id: "obj-direccion-tecnica", kind: "object", name: "Dirección Técnica", essence: "physical", affiliation: "systemic" }));
m = u(addThing(m, { id: "obj-equipo-clinico", kind: "object", name: "Equipo Clínico Group", essence: "physical", affiliation: "systemic" }));
m = u(addThing(m, { id: "obj-coordinacion", kind: "object", name: "Coordinación", essence: "physical", affiliation: "systemic" }));
m = u(addThing(m, { id: "obj-cuidador", kind: "object", name: "Cuidador", essence: "physical", affiliation: "environmental" }));
m = u(addState(m, { id: "s-cuid-capacitado", parent: "obj-cuidador", name: "capacitado", initial: false, final: false, default: false }));
m = u(addState(m, { id: "s-cuid-no-capacitado", parent: "obj-cuidador", name: "no capacitado", initial: true, final: false, default: true }));

// === PASO 6: Sistema + Exhibition (§6.6) ===
m = u(addThing(m, { id: "obj-servicio-hd", kind: "object", name: "Servicio HODOM HSC", essence: "physical", affiliation: "systemic" }));
m = u(addState(m, { id: "s-serv-campana", parent: "obj-servicio-hd", name: "campaña", initial: true, final: false, default: true }));
m = u(addState(m, { id: "s-serv-permanente", parent: "obj-servicio-hd", name: "permanente", initial: false, final: false, default: false }));
m = u(addState(m, { id: "s-serv-suspendido", parent: "obj-servicio-hd", name: "suspendido", initial: false, final: true, default: false }));

// === PASO 7: Instrumentos (§6.7) ===
m = u(addThing(m, { id: "obj-vehiculo", kind: "object", name: "Vehículo Clínico", essence: "physical", affiliation: "systemic" }));
m = u(addThing(m, { id: "obj-ficha-clinica", kind: "object", name: "Ficha Clínica", essence: "informatical", affiliation: "systemic" }));
m = u(addThing(m, { id: "obj-protocolo-esc", kind: "object", name: "Protocolo Escalamiento PRO-002", essence: "informatical", affiliation: "systemic" }));
m = u(addThing(m, { id: "obj-hsc", kind: "object", name: "Hospital San Carlos", essence: "physical", affiliation: "systemic" }));

// === PASO 8: Input/Output (§6.8) ===
m = u(addThing(m, { id: "obj-derivacion", kind: "object", name: "Derivación", essence: "informatical", affiliation: "systemic" }));
m = u(addThing(m, { id: "obj-plan-terapeutico", kind: "object", name: "Plan Terapéutico", essence: "informatical", affiliation: "systemic" }));
m = u(addThing(m, { id: "obj-epicrisis", kind: "object", name: "Epicrisis", essence: "informatical", affiliation: "systemic" }));
m = u(addThing(m, { id: "obj-consentimiento", kind: "object", name: "Consentimiento Informado", essence: "informatical", affiliation: "systemic" }));
m = u(addState(m, { id: "s-cons-firmado", parent: "obj-consentimiento", name: "firmado", initial: false, final: false, default: false }));
m = u(addState(m, { id: "s-cons-pendiente", parent: "obj-consentimiento", name: "pendiente", initial: true, final: false, default: true }));

// === PASO 9: Environmental (§6.9) ===
m = u(addThing(m, { id: "obj-domicilio", kind: "object", name: "Domicilio", essence: "physical", affiliation: "environmental" }));
m = u(addState(m, { id: "s-dom-apto", parent: "obj-domicilio", name: "apto", initial: false, final: false, default: false }));
m = u(addState(m, { id: "s-dom-no-apto", parent: "obj-domicilio", name: "no apto", initial: true, final: false, default: true }));
m = u(addThing(m, { id: "obj-aps", kind: "object", name: "APS-CESFAM", essence: "physical", affiliation: "environmental" }));
m = u(addThing(m, { id: "obj-samu", kind: "object", name: "Red SAMU 131", essence: "physical", affiliation: "environmental" }));
m = u(addThing(m, { id: "obj-normativa", kind: "object", name: "Normativa Sanitaria", essence: "informatical", affiliation: "environmental" }));

// === PASO 10: Problem Occurrence (§6.10) ===
m = u(addThing(m, { id: "proc-hosp-conv", kind: "process", name: "Hospitalización Convencional Saturando", essence: "physical", affiliation: "environmental" }));

// ============================================================
// SD LINKS
// ============================================================
// Exhibition
m = u(addLink(m, { id: "lnk-exhibit-hd", type: "exhibition", source: "obj-servicio-hd", target: "proc-hd-hsc" }));
m = u(addLink(m, { id: "lnk-exhibit-salud", type: "exhibition", source: "obj-paciente-group", target: "obj-estado-salud" }));
m = u(addLink(m, { id: "lnk-exhibit-cond", type: "exhibition", source: "obj-paciente", target: "obj-condicion-clinica" }));

// Effect: main process
m = u(addLink(m, { id: "lnk-effect-salud", type: "effect", source: "proc-hd-hsc", target: "obj-estado-salud", source_state: "s-salud-deteriorado", target_state: "s-salud-estabilizado" }));
m = u(addLink(m, { id: "lnk-effect-cond", type: "effect", source: "proc-hd-hsc", target: "obj-condicion-clinica", source_state: "s-cond-agudo", target_state: "s-cond-egresado" }));

// Agents
m = u(addLink(m, { id: "lnk-agent-dt", type: "agent", source: "obj-direccion-tecnica", target: "proc-hd-hsc" }));
m = u(addLink(m, { id: "lnk-agent-equipo", type: "agent", source: "obj-equipo-clinico", target: "proc-hd-hsc" }));
m = u(addLink(m, { id: "lnk-agent-coord", type: "agent", source: "obj-coordinacion", target: "proc-hd-hsc" }));
m = u(addLink(m, { id: "lnk-agent-cuidador", type: "agent", source: "obj-cuidador", target: "proc-hd-hsc" }));

// Instruments
m = u(addLink(m, { id: "lnk-instr-servicio", type: "instrument", source: "obj-servicio-hd", target: "proc-hd-hsc" }));
m = u(addLink(m, { id: "lnk-instr-vehiculo", type: "instrument", source: "obj-vehiculo", target: "proc-hd-hsc" }));
m = u(addLink(m, { id: "lnk-instr-ficha", type: "instrument", source: "obj-ficha-clinica", target: "proc-hd-hsc" }));
m = u(addLink(m, { id: "lnk-instr-protocolo", type: "instrument", source: "obj-protocolo-esc", target: "proc-hd-hsc" }));
m = u(addLink(m, { id: "lnk-instr-normativa", type: "instrument", source: "obj-normativa", target: "proc-hd-hsc" }));
m = u(addLink(m, { id: "lnk-instr-domicilio", type: "instrument", source: "obj-domicilio", target: "proc-hd-hsc" }));

// Consumption + Result
m = u(addLink(m, { id: "lnk-consume-deriv", type: "consumption", source: "obj-derivacion", target: "proc-hd-hsc", distributed: true }));
m = u(addLink(m, { id: "lnk-result-plan", type: "result", source: "proc-hd-hsc", target: "obj-plan-terapeutico", distributed: true }));
m = u(addLink(m, { id: "lnk-result-epicrisis", type: "result", source: "proc-hd-hsc", target: "obj-epicrisis", distributed: true }));
m = u(addLink(m, { id: "lnk-result-consent", type: "result", source: "proc-hd-hsc", target: "obj-consentimiento", distributed: true }));

// Problem occurrence
m = u(addLink(m, { id: "lnk-problem", type: "effect", source: "proc-hosp-conv", target: "obj-estado-salud" }));

// ============================================================
// SD APPEARANCES
// ============================================================
const SD_APPS = [
  // Center: main process
  { id: "proc-hd-hsc", x: 380, y: 340, w: 340, h: 100 },
  // Top: beneficiary + attributes
  { id: "obj-paciente-group", x: 60, y: 40, w: 180, h: 50 },
  { id: "obj-estado-salud", x: 300, y: 40, w: 200, h: 60 },
  { id: "obj-paciente", x: 560, y: 40, w: 160, h: 60 },
  { id: "obj-condicion-clinica", x: 560, y: 130, w: 200, h: 60 },
  // Left: agents
  { id: "obj-direccion-tecnica", x: 60, y: 220, w: 180, h: 50 },
  { id: "obj-equipo-clinico", x: 60, y: 300, w: 200, h: 50 },
  { id: "obj-coordinacion", x: 60, y: 380, w: 160, h: 50 },
  { id: "obj-cuidador", x: 60, y: 460, w: 140, h: 60 },
  // Center-top: system
  { id: "obj-servicio-hd", x: 380, y: 200, w: 280, h: 60 },
  // Right: instruments
  { id: "obj-vehiculo", x: 800, y: 260, w: 180, h: 50 },
  { id: "obj-ficha-clinica", x: 800, y: 330, w: 160, h: 50 },
  { id: "obj-protocolo-esc", x: 800, y: 400, w: 260, h: 50 },
  { id: "obj-hsc", x: 800, y: 470, w: 200, h: 50 },
  // Bottom-left: I/O
  { id: "obj-derivacion", x: 60, y: 560, w: 150, h: 50 },
  { id: "obj-plan-terapeutico", x: 60, y: 630, w: 190, h: 50 },
  { id: "obj-epicrisis", x: 60, y: 700, w: 140, h: 50 },
  { id: "obj-consentimiento", x: 280, y: 560, w: 220, h: 60 },
  // Bottom: environmental
  { id: "obj-domicilio", x: 380, y: 500, w: 160, h: 60 },
  { id: "obj-aps", x: 580, y: 500, w: 160, h: 50 },
  { id: "obj-samu", x: 580, y: 570, w: 160, h: 50 },
  { id: "obj-normativa", x: 380, y: 640, w: 200, h: 50 },
  // Problem occurrence
  { id: "proc-hosp-conv", x: 380, y: 740, w: 340, h: 70 },
];
for (const a of SD_APPS) {
  m = u(addAppearance(m, { thing: a.id, opd: "opd-sd", x: a.x, y: a.y, w: a.w, h: a.h }));
}

// ============================================================
// SD1 — In-zoom: 13 subprocesos sincrónicos
// ============================================================
m = u(addOPD(m, { id: "opd-sd1", name: "SD1", opd_type: "hierarchical", parent_opd: "opd-sd", refines: "proc-hd-hsc", refinement_type: "in-zoom" }));

const SD1_PROCS: Array<{ id: string; name: string; y: number; h?: number; duration?: any }> = [
  // Admisión
  { id: "proc-deteccion", name: "Detección y Derivación", y: 60 },
  { id: "proc-evaluacion", name: "Evaluación de Elegibilidad", y: 140 },
  { id: "proc-ingreso", name: "Ingreso Formal", y: 220 },
  { id: "proc-prog-visita", name: "Programación Primera Visita", y: 300 },
  // Atención
  { id: "proc-visita", name: "Visita Domiciliaria Programada", y: 400, duration: { nominal: 45, unit: "min" } },
  { id: "proc-eval-clinica", name: "Evaluación Clínica Continua", y: 480 },
  { id: "proc-ejecucion", name: "Ejecución Plan de Cuidados", y: 560, h: 80, duration: { nominal: 14, min: 3, max: 90, unit: "d" } },
  { id: "proc-coord-inter", name: "Coordinación Interequipo", y: 660 },
  // Escalamiento
  { id: "proc-vigilancia", name: "Vigilancia y Detección de Deterioro", y: 760 },
  { id: "proc-escalamiento", name: "Escalamiento Clínico", y: 840 },
  { id: "proc-rescate", name: "Rescate y Derivación", y: 920 },
  // Egreso
  { id: "proc-alta", name: "Alta Formal y Contrarreferencia APS", y: 1020 },
  { id: "proc-seguimiento", name: "Seguimiento Post-Alta 48h", y: 1100 },
];

for (const sp of SD1_PROCS) {
  m = u(addThing(m, {
    id: sp.id, kind: "process", name: sp.name,
    essence: "physical", affiliation: "systemic",
    ...(sp.duration ? { duration: sp.duration } : {}),
  }));
  m = u(addAppearance(m, {
    thing: sp.id, opd: "opd-sd1",
    x: 280, y: sp.y, w: 280, h: sp.h ?? 60, internal: true,
  }));
}

// Container
m = u(addAppearance(m, { thing: "proc-hd-hsc", opd: "opd-sd1", x: 200, y: 10, w: 440, h: 1180, internal: true }));

// SD1 externals
const SD1_EXT = [
  { id: "obj-derivacion", x: 30, y: 60 },
  { id: "obj-paciente", x: 30, y: 180, w: 160 },
  { id: "obj-consentimiento", x: 30, y: 280, w: 220 },
  { id: "obj-plan-terapeutico", x: 30, y: 380, w: 190 },
  { id: "obj-ficha-clinica", x: 30, y: 520, w: 160 },
  { id: "obj-epicrisis", x: 30, y: 1020, w: 140 },
  { id: "obj-condicion-clinica", x: 720, y: 100, w: 200 },
  { id: "obj-equipo-clinico", x: 720, y: 220, w: 200 },
  { id: "obj-domicilio", x: 720, y: 360, w: 160 },
  { id: "obj-vehiculo", x: 720, y: 440, w: 180 },
  { id: "obj-protocolo-esc", x: 720, y: 720, w: 260 },
  { id: "obj-samu", x: 720, y: 820, w: 160 },
  { id: "obj-hsc", x: 720, y: 920, w: 200 },
  { id: "obj-aps", x: 720, y: 1020, w: 160 },
  { id: "obj-coordinacion", x: 720, y: 1100, w: 160 },
  { id: "obj-cuidador", x: 720, y: 560, w: 140 },
];
for (const e of SD1_EXT) {
  m = u(addAppearance(m, { thing: e.id, opd: "opd-sd1", x: e.x, y: e.y, w: e.w ?? 160, h: 50 }));
}

// ============================================================
// SD1 LINKS — each subprocess connected to at least one transformee
// ============================================================
// Admisión
m = u(addLink(m, { id: "lnk-det-consume", type: "consumption", source: "obj-derivacion", target: "proc-deteccion" }));
m = u(addLink(m, { id: "lnk-det-effect", type: "effect", source: "proc-deteccion", target: "obj-condicion-clinica" }));
m = u(addLink(m, { id: "lnk-eval-instr-dom", type: "instrument", source: "obj-domicilio", target: "proc-evaluacion" }));
m = u(addLink(m, { id: "lnk-eval-agent-eq", type: "agent", source: "obj-equipo-clinico", target: "proc-evaluacion" }));
m = u(addLink(m, { id: "lnk-eval-effect", type: "effect", source: "proc-evaluacion", target: "obj-paciente" }));
m = u(addLink(m, { id: "lnk-ingreso-result-cons", type: "result", source: "proc-ingreso", target: "obj-consentimiento" }));
m = u(addLink(m, { id: "lnk-ingreso-result-plan", type: "result", source: "proc-ingreso", target: "obj-plan-terapeutico" }));
m = u(addLink(m, { id: "lnk-prog-instr-vehiculo", type: "instrument", source: "obj-vehiculo", target: "proc-prog-visita" }));
m = u(addLink(m, { id: "lnk-prog-effect", type: "effect", source: "proc-prog-visita", target: "obj-paciente" }));

// Atención
m = u(addLink(m, { id: "lnk-visita-instr-vehiculo", type: "instrument", source: "obj-vehiculo", target: "proc-visita" }));
m = u(addLink(m, { id: "lnk-visita-instr-dom", type: "instrument", source: "obj-domicilio", target: "proc-visita" }));
m = u(addLink(m, { id: "lnk-visita-agent-eq", type: "agent", source: "obj-equipo-clinico", target: "proc-visita" }));
m = u(addLink(m, { id: "lnk-visita-effect", type: "effect", source: "proc-visita", target: "obj-paciente" }));
m = u(addLink(m, { id: "lnk-evalclin-effect", type: "effect", source: "proc-eval-clinica", target: "obj-condicion-clinica" }));
m = u(addLink(m, { id: "lnk-evalclin-instr-ficha", type: "instrument", source: "obj-ficha-clinica", target: "proc-eval-clinica" }));
m = u(addLink(m, { id: "lnk-ejec-effect-cond", type: "effect", source: "proc-ejecucion", target: "obj-condicion-clinica", source_state: "s-cond-agudo", target_state: "s-cond-estable" }));
m = u(addLink(m, { id: "lnk-ejec-instr-ficha", type: "instrument", source: "obj-ficha-clinica", target: "proc-ejecucion" }));
m = u(addLink(m, { id: "lnk-ejec-agent-cuidador", type: "agent", source: "obj-cuidador", target: "proc-ejecucion" }));
m = u(addLink(m, { id: "lnk-coord-effect", type: "effect", source: "proc-coord-inter", target: "obj-ficha-clinica" }));
m = u(addLink(m, { id: "lnk-coord-agent-coord", type: "agent", source: "obj-coordinacion", target: "proc-coord-inter" }));

// Escalamiento
m = u(addLink(m, { id: "lnk-vig-instr-proto", type: "instrument", source: "obj-protocolo-esc", target: "proc-vigilancia" }));
m = u(addLink(m, { id: "lnk-vig-effect", type: "effect", source: "proc-vigilancia", target: "obj-paciente" }));
m = u(addLink(m, { id: "lnk-esc-instr-samu", type: "instrument", source: "obj-samu", target: "proc-escalamiento" }));
m = u(addLink(m, { id: "lnk-esc-effect", type: "effect", source: "proc-escalamiento", target: "obj-paciente" }));
m = u(addLink(m, { id: "lnk-rescate-effect-pac", type: "effect", source: "proc-rescate", target: "obj-paciente", target_state: "s-pac-inestable" }));
m = u(addLink(m, { id: "lnk-rescate-instr-hsc", type: "instrument", source: "obj-hsc", target: "proc-rescate" }));
// Exception: overtime on Ejecución → Rescate
m = u(addLink(m, { id: "lnk-exception-rescate", type: "exception", source: "proc-ejecucion", target: "proc-rescate", exception_type: "overtime" }));

// Egreso
m = u(addLink(m, { id: "lnk-alta-result-epi", type: "result", source: "proc-alta", target: "obj-epicrisis" }));
m = u(addLink(m, { id: "lnk-alta-effect-cond", type: "effect", source: "proc-alta", target: "obj-condicion-clinica", source_state: "s-cond-estable", target_state: "s-cond-egresado" }));
m = u(addLink(m, { id: "lnk-alta-instr-aps", type: "instrument", source: "obj-aps", target: "proc-alta" }));
m = u(addLink(m, { id: "lnk-seg-agent-coord", type: "agent", source: "obj-coordinacion", target: "proc-seguimiento" }));
m = u(addLink(m, { id: "lnk-seg-instr-ficha", type: "instrument", source: "obj-ficha-clinica", target: "proc-seguimiento" }));
m = u(addLink(m, { id: "lnk-seg-effect", type: "effect", source: "proc-seguimiento", target: "obj-paciente" }));

// ============================================================
// REQUIREMENTS (13)
// ============================================================
m = u(addRequirement(m, { id: "req-01", target: "obj-paciente", name: "Condición clínica estable", req_id: "R-01", description: "DS 1/2022 Art. 15: patología aguda o crónica reagudizada, clínicamente estable" }));
m = u(addRequirement(m, { id: "req-02", target: "obj-derivacion", name: "Indicación médica", req_id: "R-02", description: "DS 1/2022 Art. 1: indicación médica + plan terapéutico + término determinado" }));
m = u(addRequirement(m, { id: "req-03", target: "obj-domicilio", name: "Evaluación sociosanitaria domicilio", req_id: "R-03", description: "DS 1/2022 Art. 15: condiciones sanitarias mínimas, servicios básicos, telefonía, radio cobertura" }));
m = u(addRequirement(m, { id: "req-04", target: "obj-consentimiento", name: "Consentimiento firmado", req_id: "R-04", description: "Ley 20.584: consentimiento informado escrito obligatorio" }));
m = u(addRequirement(m, { id: "req-05", target: "obj-servicio-hd", name: "Equivalencia con hospitalización cerrada", req_id: "R-05", description: "DS 1/2022 Art. 1: cuidados similares en calidad y cantidad a atención cerrada" }));
m = u(addRequirement(m, { id: "req-06", target: "obj-protocolo-esc", name: "Protocolo de escalamiento", req_id: "R-06", description: "NT 2024: protocolo de actuación ante emergencias aprobado por DT" }));
m = u(addRequirement(m, { id: "req-07", target: "obj-samu", name: "Acceso SAMU 24/7", req_id: "R-07", description: "DS 1/2022 Art. 7: traslado oportuno a establecimiento de atención cerrada" }));
m = u(addRequirement(m, { id: "req-08", target: "obj-epicrisis", name: "Epicrisis + contrarreferencia", req_id: "R-08", description: "DS 1/2022 Art. 18: epicrisis al alta + contrarreferencia a APS" }));
m = u(addRequirement(m, { id: "req-09", target: "obj-direccion-tecnica", name: "DT médico cirujano 22h/sem", req_id: "R-09", description: "DS 1/2022 Art. 7: médico cirujano habilitado, 22h/semana mínimo" }));
m = u(addRequirement(m, { id: "req-10", target: "obj-ficha-clinica", name: "Ficha clínica trazable", req_id: "R-10", description: "DS 41/2012: ficha clínica física o electrónica conforme a reglamento" }));
m = u(addRequirement(m, { id: "req-11", target: "obj-servicio-hd", name: "Manual organización interna", req_id: "R-11", description: "NT 2024: manual con organigrama, roles, horarios, reglamento higiene" }));
m = u(addRequirement(m, { id: "req-12", target: "obj-equipo-clinico", name: "PAC anual", req_id: "R-12", description: "NT 2024: plan de capacitación anual IAAS + RCP + inducción + humanización" }));
m = u(addRequirement(m, { id: "req-13", target: "obj-ficha-clinica", name: "Protección datos sensibles", req_id: "R-13", description: "Ley 19.628: datos de salud como dato sensible, confidencialidad y reserva" }));

// ============================================================
// ASSERTIONS (5)
// ============================================================
m = u(addAssertion(m, { id: "ast-01", target: "obj-paciente", predicate: "Paciente no puede estar simultáneamente en hospital y en domicilio HODOM", category: "safety", enabled: true }));
m = u(addAssertion(m, { id: "ast-02", target: "obj-consentimiento", predicate: "Consentimiento Informado debe estar firmado antes de primera visita domiciliaria", category: "correctness", enabled: true }));
m = u(addAssertion(m, { id: "ast-03", target: "obj-protocolo-esc", predicate: "Escalamiento clínico solo procede con deterioro documentado según PRO-002", category: "safety", enabled: true }));
m = u(addAssertion(m, { id: "ast-04", target: "obj-epicrisis", predicate: "Egreso requiere epicrisis completa y contrarreferencia a APS-CESFAM", category: "correctness", enabled: true }));
m = u(addAssertion(m, { id: "ast-05", target: "obj-direccion-tecnica", predicate: "Sin Dirección Técnica válida no se permite admisión de pacientes", category: "safety", enabled: true }));

// ============================================================
// SAVE + VALIDATE
// ============================================================
const outPath = resolve(__dirname, "../tests/hodom-hsc-v0.opmodel");
writeFileSync(outPath, saveModel(m));
const webPath = resolve(__dirname, "../packages/web/public/hodom-hsc-v0.opmodel");
writeFileSync(webPath, saveModel(m));

const errors = validate(m);
const hard = errors.filter(e => !e.severity || e.severity === "error");
const warnings = errors.filter(e => e.severity === "warning" || e.severity === "info");
console.log(`HODOM HSC v0 built: ${m.things.size} things, ${m.states.size} states, ${m.links.size} links, ${m.opds.size} OPDs`);
console.log(`Requirements: ${m.requirements.size}, Assertions: ${m.assertions.size}`);
console.log(`Validation: ${hard.length} errors, ${warnings.length} warnings`);
if (hard.length > 0) for (const e of hard) console.log(`  ERROR: ${e.code} — ${e.message}`);
for (const w of warnings.slice(0, 10)) console.log(`  ${w.severity}: ${w.code} — ${w.message}`);
console.log(`Saved to ${outPath}`);
console.log(`Saved to ${webPath}`);
