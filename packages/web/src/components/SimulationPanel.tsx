/* ═══════════════════════════════════════════════════
   SimulationPanel — Simulation control & trace viewer

   Renders simulation controls, scrubber, trace log,
   and state snapshot. Dispatches simulation commands
   via the Command algebra.
   ═══════════════════════════════════════════════════ */

import { useState, useEffect, useRef, useMemo } from "react";
import type { Model } from "@opmodel/core";
import { createInitialState, runSimulation } from "@opmodel/core";
import type { Command, SimulationUIState } from "../lib/commands";

interface Props {
  model: Model;
  simulation: SimulationUIState | null;
  dispatch: (cmd: Command) => boolean;
}

export function SimulationPanel({ model, simulation, dispatch }: Props) {
  const currentStepRef = useRef<HTMLLIElement | null>(null);

  // Scroll current step into view whenever it changes
  useEffect(() => {
    currentStepRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [simulation?.currentStepIndex]);

  // Auto-run effect: advance simulation at configured speed
  useEffect(() => {
    if (simulation?.status !== "running") return;
    const id = setInterval(() => {
      dispatch({ tag: "stepSimulation", direction: 1 });
    }, simulation.speed);
    return () => clearInterval(id);
  }, [simulation?.status, simulation?.speed, dispatch]);

  // Derive current ModelState for snapshot
  const currentModelState = useMemo(() => {
    if (!simulation) return null;
    if (simulation.currentStepIndex === -1) {
      return createInitialState(model);
    }
    const step = simulation.trace.steps[simulation.currentStepIndex];
    return step ? step.newState : createInitialState(model);
  }, [simulation, simulation?.currentStepIndex, model]);

  /* ─── Inactive: show start button ─── */

  if (!simulation) {
    return (
      <div className="sim-panel">
        <button
          className="sim-panel__start-btn"
          onClick={() => dispatch({ tag: "startSimulation" })}
        >
          Start Simulation
        </button>
      </div>
    );
  }

  /* ─── Active simulation ─── */

  const { trace, currentStepIndex, status, speed } = simulation;
  const [mcResult, setMcResult] = useState<{ runs: number; completedCount: number; deadlockedCount: number; avgSteps: number; avgDuration: number | null; assertionPassRate: Record<string, number>; exceptionRate: Record<string, number> } | null>(null);
  const [mcRunning, setMcRunning] = useState(false);
  const atStart = currentStepIndex <= -1;
  const atEnd = currentStepIndex >= trace.steps.length - 1;
  const isTerminal = status === "completed" || status === "deadlocked";

  return (
    <div className="sim-panel">
      {/* ─── Controls bar ─── */}
      <div className="sim-panel__controls">
        <button
          disabled={atStart}
          onClick={() => dispatch({ tag: "stepSimulation", direction: -1 })}
          title="Step back"
        >
          |◄
        </button>
        <button
          disabled={atEnd}
          onClick={() => dispatch({ tag: "stepSimulation", direction: 1 })}
          title="Step forward"
        >
          ►|
        </button>
        <button
          disabled={isTerminal}
          onClick={() => dispatch({ tag: "toggleSimulationAutoRun" })}
          title={status === "running" ? "Pause" : "Auto-run"}
        >
          {status === "running" ? "⏸" : "►►"}
        </button>
        <button
          onClick={() => dispatch({ tag: "resetSimulation" })}
          title="Stop simulation"
        >
          ■
        </button>
      </div>

      {/* ─── Status line ─── */}
      <div className="sim-panel__status">
        <span>
          {currentStepIndex >= 0
            ? `Step ${currentStepIndex + 1} / ${trace.steps.length}`
            : "Initial State"}
        </span>
        <span className={`sim-panel__badge sim-panel__badge--${status}`}>
          {status}
        </span>
      </div>

      {/* ─── Speed slider + presets ─── */}
      <div className="sim-panel__speed">
        <label>
          Speed: {speed}ms
          <input
            type="range"
            min={100}
            max={2000}
            step={100}
            value={speed}
            onChange={(e) =>
              dispatch({ tag: "setSimulationSpeed", speed: Number(e.target.value) })
            }
          />
        </label>
        <div style={{ display: "flex", gap: 4, marginTop: 2 }}>
          {[{ label: "Fast", ms: 200 }, { label: "Normal", ms: 800 }, { label: "Slow", ms: 1500 }].map(p => (
            <button
              key={p.label}
              style={{ fontSize: 9, padding: "1px 6px", cursor: "pointer", opacity: speed === p.ms ? 1 : 0.6 }}
              onClick={() => dispatch({ tag: "setSimulationSpeed", speed: p.ms })}
            >{p.label}</button>
          ))}
        </div>
      </div>

      {/* ─── Scrubber ─── */}
      <div className="sim-panel__scrubber">
        <input
          type="range"
          min={-1}
          max={trace.steps.length - 1}
          value={currentStepIndex}
          onChange={(e) =>
            dispatch({ tag: "setSimulationStep", index: Number(e.target.value) })
          }
        />
      </div>

      {/* ─── Trace log ─── */}
      <ul className="sim-panel__trace">
        {trace.steps.map((step, i) => {
          const isCurrent = i === currentStepIndex;
          const isFuture = i > currentStepIndex;
          const classes = [
            "sim-panel__step",
            isCurrent ? "sim-panel__step--current" : "",
            isFuture ? "sim-panel__step--future" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <li
              key={i}
              className={classes}
              ref={isCurrent ? currentStepRef : undefined}
            >
              <div>
                Step {step.step}: {step.parentProcessId
                  ? `${model.things.get(step.parentProcessId)?.name} > ${step.processName}`
                  : step.processName ?? "—"}
                {step.invokedBy && (
                  <span style={{ fontSize: 9, color: "var(--text-muted)", marginLeft: 4 }}>
                    (invoked by {model.things.get(step.invokedBy)?.name ?? step.invokedBy})
                  </span>
                )}
                {step.duration != null && (
                  <span style={{ fontSize: 9, color: "var(--text-muted)", marginLeft: 4 }}>
                    [{step.duration.toFixed(1)}]
                  </span>
                )}
                {step.exceptionTriggered && (
                  <span style={{ fontSize: 9, color: "var(--error-stroke, #e53e3e)", marginLeft: 4, fontWeight: 600 }}>
                    ⚠ {step.exceptionTriggered}
                  </span>
                )}
              </div>
              <StepEffects step={step} model={model} />
            </li>
          );
        })}
      </ul>

      {/* ─── State snapshot ─── */}
      {currentModelState && (
        <div className="sim-panel__snapshot">
          <table>
            <thead>
              <tr>
                <th>Object</th>
                <th>Status</th>
                <th>State</th>
              </tr>
            </thead>
            <tbody>
              {[...currentModelState.objects.entries()].map(([objId, objState]) => {
                const thing = model.things.get(objId);
                const stateName = objState.currentState
                  ? model.states.get(objState.currentState)?.name
                  : undefined;

                return (
                  <tr key={objId}>
                    <td>{thing?.name ?? objId}</td>
                    <td className={objState.exists ? "" : "sim-panel__obj--consumed"}>
                      {objState.exists ? "exists" : "consumed"}
                    </td>
                    <td>{stateName ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Monte Carlo */}
      {isTerminal && (
          <div className="sim-panel__summary">
            <div className="sim-panel__summary-title">Monte Carlo</div>
            <button
              disabled={mcRunning}
              style={{ fontSize: 10, padding: "3px 8px", cursor: "pointer" }}
              onClick={() => {
                setMcRunning(true);
                setTimeout(() => {
                  const runs = 100;
                  let cc = 0, dc = 0, ts = 0, td = 0, dn = 0;
                  const ap: any = {}, at: any = {}, ec: any = {};
                  for (let i = 0; i < runs; i++) {
                    const t = runSimulation(model);
                    ts += t.steps.length;
                    if (t.completed) cc++;
                    if (t.deadlocked) dc++;
                    if (t.totalDuration != null) { td += t.totalDuration; dn++; }
                    if (t.assertionResults) for (const ar of t.assertionResults) {
                      at[ar.assertionId] = (at[ar.assertionId] ?? 0) + 1;
                      if (ar.passed) ap[ar.assertionId] = (ap[ar.assertionId] ?? 0) + 1;
                    }
                    for (const s of t.steps) if (s.exceptionTriggered && s.processName) {
                      const k = `${s.processName} (${s.exceptionTriggered})`;
                      ec[k] = (ec[k] ?? 0) + 1;
                    }
                  }
                  const apr: any = {};
                  for (const [id, total] of Object.entries(at)) apr[id] = (ap[id] ?? 0) / (total as number);
                  const er: any = {};
                  for (const [k, c] of Object.entries(ec)) er[k] = (c as number) / runs;
                  setMcResult({ runs, completedCount: cc, deadlockedCount: dc, avgSteps: ts / runs, avgDuration: dn > 0 ? td / dn : null, assertionPassRate: apr, exceptionRate: er });
                  setMcRunning(false);
                }, 10);
              }}
            >
              {mcRunning ? "Running..." : mcResult ? `Re-run (${mcResult.runs} runs)` : "Run 100x"}
            </button>
            {mcResult && (
              <div style={{ marginTop: 6, fontSize: 10 }}>
                <div>Completed: {mcResult.completedCount}/{mcResult.runs} ({Math.round(mcResult.completedCount/mcResult.runs*100)}%)</div>
                <div>Deadlocked: {mcResult.deadlockedCount}/{mcResult.runs}</div>
                <div>Avg steps: {mcResult.avgSteps.toFixed(1)}{mcResult.avgDuration != null ? ` | Avg duration: ${mcResult.avgDuration.toFixed(1)}` : ""}</div>
                {Object.entries(mcResult.assertionPassRate).length > 0 && (
                  <div style={{ marginTop: 4 }}>
                    <div style={{ fontWeight: 600 }}>Assertion pass rates:</div>
                    {Object.entries(mcResult.assertionPassRate).map(([id, rate]) => {
                      const assertion = model.assertions.get(id);
                      return (
                        <div key={id} style={{ color: rate >= 0.95 ? "#48bb78" : rate >= 0.5 ? "#ed8936" : "#f56565" }}>
                          {Math.round(rate * 100)}% — {assertion?.predicate ?? id}
                        </div>
                      );
                    })}
                  </div>
                )}
                {Object.entries(mcResult.exceptionRate).length > 0 && (
                  <div style={{ marginTop: 4 }}>
                    <div style={{ fontWeight: 600 }}>Exception rates:</div>
                    {Object.entries(mcResult.exceptionRate).map(([key, rate]) => (
                      <div key={key} style={{ color: "#f56565" }}>{Math.round(rate * 100)}% — {key}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
      )}

      {/* Simulation summary */}
      {isTerminal && (
        <div className="sim-panel__summary">
          <div className="sim-panel__summary-title">Summary</div>
          <div>Steps: {trace.steps.length} | Status: {status}{trace.totalDuration != null ? ` | Duration: ${trace.totalDuration.toFixed(1)}` : ""}
            {" | "}Consumed: {trace.steps.reduce((n, s) => n + s.consumptionIds.length, 0)}
            {" | "}Created: {trace.steps.reduce((n, s) => n + s.resultIds.length, 0)}
            {" | "}State changes: {trace.steps.reduce((n, s) => n + s.stateChanges.length, 0)}
          </div>
          {trace.steps.some(s => s.exceptionTriggered) && (
            <div style={{ color: "var(--error-stroke, #e53e3e)" }}>
              ⚠ Exceptions: {trace.steps.filter(s => s.exceptionTriggered).map(s => `${s.processName} (${s.exceptionTriggered})`).join(", ")}
            </div>
          )}
          {trace.assertionResults && trace.assertionResults.length > 0 && (
            <div style={{ marginTop: 6 }}>
              <div style={{ fontWeight: 600, fontSize: 10, marginBottom: 4 }}>Assertions</div>
              {trace.assertionResults.map(ar => (
                <div key={ar.assertionId} style={{ fontSize: 10, display: "flex", gap: 6 }}>
                  <span style={{ color: ar.passed ? "#48bb78" : "#f56565", fontWeight: 700 }}>
                    {ar.passed ? "✓" : "✗"}
                  </span>
                  <span>[{ar.category}] {ar.name}</span>
                  {ar.reason && <span style={{ color: "var(--text-muted)" }}>— {ar.reason}</span>}
                </div>
              ))}
            </div>
          )}
          <button
            style={{ marginTop: 6, fontSize: 10, padding: "3px 8px", cursor: "pointer" }}
            onClick={() => {
              const data = JSON.stringify({ trace, model: { name: model.meta.name } }, null, 2);
              const blob = new Blob([data], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `${model.meta.name.toLowerCase().replace(/\s+/g, "-")}-sim-trace.json`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            }}
          >Export Trace JSON</button>
        </div>
      )}
    </div>
  );
}

/* ─── Step Effects (sub-component) ─── */

function StepEffects({
  step,
  model,
}: {
  step: import("@opmodel/core").SimulationStep;
  model: Model;
}) {
  const consumed = step.consumptionIds;
  const yielded = step.resultIds;
  const changes = step.stateChanges;

  if (consumed.length === 0 && yielded.length === 0 && changes.length === 0) {
    return null;
  }

  return (
    <ul>
      {consumed.map((id) => (
        <li key={`c-${id}`}>consumed: {model.things.get(id)?.name ?? id}</li>
      ))}
      {yielded.map((id) => (
        <li key={`y-${id}`}>yielded: {model.things.get(id)?.name ?? id}</li>
      ))}
      {changes.map((ch, j) => {
        const objName = model.things.get(ch.objectId)?.name ?? ch.objectId;
        const from = ch.fromState ? model.states.get(ch.fromState)?.name ?? ch.fromState : "—";
        const to = ch.toState ? model.states.get(ch.toState)?.name ?? ch.toState : "—";
        return (
          <li key={`s-${j}`}>
            {objName}: {from} → {to}
          </li>
        );
      })}
    </ul>
  );
}
