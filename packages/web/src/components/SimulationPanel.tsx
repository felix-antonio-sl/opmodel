/* ═══════════════════════════════════════════════════
   SimulationPanel — Simulation control & trace viewer

   Renders simulation controls, scrubber, trace log,
   and state snapshot. Dispatches simulation commands
   via the Command algebra.
   ═══════════════════════════════════════════════════ */

import { useEffect, useRef, useMemo } from "react";
import type { Model } from "@opmodel/core";
import { createInitialState } from "@opmodel/core";
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

      {/* ─── Speed slider ─── */}
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
