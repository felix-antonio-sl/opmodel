import { describe, it, expect } from "vitest";
import { loadModel } from "../src/serialization";
import { createInitialState, runSimulation } from "../src/simulation";
import { readFileSync } from "fs";
import { resolve } from "path";

const fixture = readFileSync(
  resolve(__dirname, "../../../tests/hospitalizacion-domiciliaria.opmodel"),
  "utf8",
);

describe("HODOM simulation", () => {
  it("creates initial state with all objects", () => {
    const r = loadModel(fixture);
    if (!r.ok) throw new Error("load failed");
    const state = createInitialState(r.value);
    
    // All objects should exist in initial state
    const objects = [...r.value.things.values()].filter(t => t.kind === "object");
    for (const obj of objects) {
      const objState = state.objects.get(obj.id);
      expect(objState, `${obj.name} should have state`).toBeDefined();
      expect(objState!.exists).toBe(true);
    }
    
    // Paciente should be in 'estable' state
    const paciente = state.objects.get("obj-paciente");
    expect(paciente?.currentState).toBe("state-pac-estable");
    
    // Autorización Sanitaria should be in 'vencida' state
    const autSan = state.objects.get("obj-autorizacion-sanitaria");
    expect(autSan?.currentState).toBe("state-aut-vencida");
  });

  it("runs simulation on SD1 without crashing", () => {
    const r = loadModel(fixture);
    if (!r.ok) throw new Error("load failed");
    // Simulation should not throw
    const trace = runSimulation(r.value, "opd-sd1", undefined, 10);
    console.log(`SD1 simulation: ${trace.steps.length} steps, completed=${trace.completed}, deadlocked=${trace.deadlocked}`);
  });

  it("runs simulation on SD2 without crashing", () => {
    const r = loadModel(fixture);
    if (!r.ok) throw new Error("load failed");
    const trace = runSimulation(r.value, "opd-sd2", undefined, 10);
    console.log(`SD2 simulation: ${trace.steps.length} steps, completed=${trace.completed}, deadlocked=${trace.deadlocked}`);
  });
});
