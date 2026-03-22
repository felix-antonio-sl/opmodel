// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  createModel,
  addThing,
  addAppearance,
  addLink,
  isOk,
} from "@opmodel/core";
import type { Thing } from "@opmodel/core";
import { useModelStore } from "../src/hooks/useModelStore";

/* ─── Helper: create a Thing literal ─── */

function makeThing(
  id: string,
  kind: "object" | "process",
  name: string,
): Thing {
  return {
    id,
    kind,
    name,
    essence: "informatical",
    affiliation: "systemic",
  };
}

/* ─── Helper: build a model with an object, a process, and an effect link (simulatable) ─── */

function modelWithEffectLink() {
  let m = createModel("SimTest");
  const obj = makeThing("obj-1", "object", "Data");
  const proc = makeThing("proc-1", "process", "Processing");
  let r = addThing(m, obj);
  m = isOk(r) ? r.value : m;
  r = addThing(m, proc);
  m = isOk(r) ? r.value : m;
  r = addAppearance(m, {
    thing: "obj-1",
    opd: "opd-sd",
    x: 50,
    y: 50,
    w: 120,
    h: 60,
  });
  m = isOk(r) ? r.value : m;
  r = addAppearance(m, {
    thing: "proc-1",
    opd: "opd-sd",
    x: 200,
    y: 50,
    w: 120,
    h: 60,
  });
  m = isOk(r) ? r.value : m;
  // effect link: process → object (process consumes/results object)
  r = addLink(m, {
    id: "link-eff",
    type: "effect",
    source: "proc-1",
    target: "obj-1",
  });
  m = isOk(r) ? r.value : m;
  return m;
}

/* ═══════════════════════════════════════════════════
   useModelStore tests
   ═══════════════════════════════════════════════════ */

describe("useModelStore", () => {
  it("initial state", () => {
    const m = createModel("Test");
    const { result } = renderHook(() => useModelStore(m));

    expect(result.current.model.meta.name).toBe("Test");
    expect(result.current.ui.currentOpd).toBe("opd-sd");
    expect(result.current.ui.selectedThing).toBeNull();
    expect(result.current.ui.mode).toBe("select");
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
    expect(result.current.lastError).toBeNull();
  });

  it("dispatch modelMutation — addThing", () => {
    const m = createModel("Test");
    const { result } = renderHook(() => useModelStore(m));

    const thing = makeThing("obj-1", "object", "Water");

    act(() => {
      result.current.dispatch({
        tag: "addThing",
        thing,
        opdId: "opd-sd",
        x: 100,
        y: 100,
        w: 120,
        h: 60,
      });
    });

    expect(result.current.model.things.has("obj-1")).toBe(true);
    expect(result.current.model.things.get("obj-1")!.name).toBe("Water");
    expect(result.current.canUndo).toBe(true);
  });

  it("dispatch uiTransition — selectThing", () => {
    const m = createModel("Test");
    const { result } = renderHook(() => useModelStore(m));

    act(() => {
      result.current.dispatch({ tag: "selectThing", thingId: "obj-1" });
    });

    expect(result.current.ui.selectedThing).toBe("obj-1");
  });

  it("dispatch uiTransition — setMode", () => {
    const m = createModel("Test");
    const { result } = renderHook(() => useModelStore(m));

    act(() => {
      result.current.dispatch({ tag: "setMode", mode: "addObject" });
    });

    expect(result.current.ui.mode).toBe("addObject");
  });

  it("undo/redo", () => {
    const m = createModel("Test");
    const { result } = renderHook(() => useModelStore(m));

    const thing = makeThing("obj-1", "object", "Water");

    act(() => {
      result.current.dispatch({
        tag: "addThing",
        thing,
        opdId: "opd-sd",
        x: 100,
        y: 100,
        w: 120,
        h: 60,
      });
    });

    expect(result.current.canUndo).toBe(true);
    expect(result.current.model.things.has("obj-1")).toBe(true);

    act(() => {
      result.current.doUndo();
    });

    expect(result.current.model.things.has("obj-1")).toBe(false);
    expect(result.current.canRedo).toBe(true);

    act(() => {
      result.current.doRedo();
    });

    expect(result.current.model.things.has("obj-1")).toBe(true);
  });

  it("lastError on invalid mutation", () => {
    const m = createModel("Test");
    const { result } = renderHook(() => useModelStore(m));

    let returnValue: boolean | undefined;
    act(() => {
      returnValue = result.current.dispatch({
        tag: "removeThing",
        thingId: "nonexistent-id",
      });
    });

    expect(result.current.lastError).not.toBeNull();
    expect(returnValue).toBe(false);
  });

  it("dispatch success — no lastError and model updated", () => {
    const m = createModel("Test");
    const { result } = renderHook(() => useModelStore(m));

    const thing = makeThing("obj-1", "object", "Water");

    act(() => {
      result.current.dispatch({
        tag: "addThing",
        thing,
        opdId: "opd-sd",
        x: 100,
        y: 100,
        w: 120,
        h: 60,
      });
    });

    // Successful dispatch leaves no error and applies the mutation
    expect(result.current.lastError).toBeNull();
    expect(result.current.model.things.has("obj-1")).toBe(true);
  });

  it("multiple mutations and undo", () => {
    const m = createModel("Test");
    const { result } = renderHook(() => useModelStore(m));

    const thing1 = makeThing("obj-1", "object", "Water");
    const thing2 = makeThing("obj-2", "object", "Fire");

    act(() => {
      result.current.dispatch({
        tag: "addThing",
        thing: thing1,
        opdId: "opd-sd",
        x: 100,
        y: 100,
        w: 120,
        h: 60,
      });
    });

    act(() => {
      result.current.dispatch({
        tag: "addThing",
        thing: thing2,
        opdId: "opd-sd",
        x: 300,
        y: 100,
        w: 120,
        h: 60,
      });
    });

    expect(result.current.model.things.has("obj-1")).toBe(true);
    expect(result.current.model.things.has("obj-2")).toBe(true);

    act(() => {
      result.current.doUndo();
    });

    expect(result.current.model.things.has("obj-1")).toBe(true);
    expect(result.current.model.things.has("obj-2")).toBe(false);
  });

  it("selectOpd", () => {
    const m = createModel("Test");
    const { result } = renderHook(() => useModelStore(m));

    act(() => {
      result.current.dispatch({ tag: "selectOpd", opdId: "opd-custom" });
    });

    expect(result.current.ui.currentOpd).toBe("opd-custom");
  });

  it("simulation commands — start with no processes sets lastError", () => {
    const m = createModel("Test");
    const { result } = renderHook(() => useModelStore(m));

    act(() => {
      result.current.dispatch({ tag: "startSimulation" });
    });

    expect(result.current.lastError).toBe("No executable processes found");
    expect(result.current.ui.simulation).toBeNull();
  });

  it("model mutations blocked during simulation", () => {
    const m = modelWithEffectLink();
    const { result } = renderHook(() => useModelStore(m));

    // Start simulation — this model has a process with an effect link
    act(() => {
      result.current.dispatch({ tag: "startSimulation" });
    });

    // Verify simulation started
    expect(result.current.ui.simulation).not.toBeNull();

    // Try to dispatch a model mutation during simulation
    const newThing = makeThing("obj-blocked", "object", "Blocked");
    let returnValue: boolean | undefined;
    act(() => {
      returnValue = result.current.dispatch({
        tag: "addThing",
        thing: newThing,
        opdId: "opd-sd",
        x: 400,
        y: 400,
        w: 120,
        h: 60,
      });
    });

    expect(returnValue).toBe(false);
    expect(result.current.lastError).toBe(
      "Exit simulation to edit the model",
    );
    expect(result.current.model.things.has("obj-blocked")).toBe(false);
  });

  it("setLinkType", () => {
    const m = createModel("Test");
    const { result } = renderHook(() => useModelStore(m));

    act(() => {
      result.current.dispatch({ tag: "setLinkType", linkType: "agent" });
    });

    expect(result.current.ui.linkType).toBe("agent");
  });
});
