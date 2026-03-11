import { describe, it, expect } from "vitest";
import { createHistory, pushHistory, undo, redo } from "../src/history";

describe("createHistory", () => {
  it("creates history with initial present and empty stacks", () => {
    const h = createHistory("A");
    expect(h.present).toBe("A");
    expect(h.past).toEqual([]);
    expect(h.future).toEqual([]);
  });
});

describe("pushHistory", () => {
  it("moves present to past and sets new present", () => {
    const h = createHistory("A");
    const h2 = pushHistory(h, "B");
    expect(h2.present).toBe("B");
    expect(h2.past).toEqual(["A"]);
    expect(h2.future).toEqual([]);
  });

  it("clears future on push", () => {
    let h = createHistory("A");
    h = pushHistory(h, "B");
    h = pushHistory(h, "C");
    h = undo(h)!; // present=B, future=[C]
    const h2 = pushHistory(h, "D"); // should clear future
    expect(h2.present).toBe("D");
    expect(h2.past).toEqual(["A", "B"]);
    expect(h2.future).toEqual([]);
  });

  it("preserves immutability", () => {
    const h = createHistory("A");
    pushHistory(h, "B");
    expect(h.present).toBe("A");
    expect(h.past).toEqual([]);
  });
});

describe("undo", () => {
  it("returns null when no past", () => {
    const h = createHistory("A");
    expect(undo(h)).toBeNull();
  });

  it("moves present to future and pops past", () => {
    let h = createHistory("A");
    h = pushHistory(h, "B");
    h = pushHistory(h, "C");
    const u = undo(h);
    expect(u).not.toBeNull();
    expect(u!.present).toBe("B");
    expect(u!.past).toEqual(["A"]);
    expect(u!.future).toEqual(["C"]);
  });

  it("supports multiple undos", () => {
    let h = createHistory("A");
    h = pushHistory(h, "B");
    h = pushHistory(h, "C");
    h = undo(h)!;
    h = undo(h)!;
    expect(h.present).toBe("A");
    expect(h.past).toEqual([]);
    expect(h.future).toEqual(["B", "C"]);
  });
});

describe("redo", () => {
  it("returns null when no future", () => {
    const h = createHistory("A");
    expect(redo(h)).toBeNull();
  });

  it("moves present to past and pops future", () => {
    let h = createHistory("A");
    h = pushHistory(h, "B");
    h = pushHistory(h, "C");
    h = undo(h)!;
    h = undo(h)!;
    const r = redo(h);
    expect(r).not.toBeNull();
    expect(r!.present).toBe("B");
    expect(r!.past).toEqual(["A"]);
    expect(r!.future).toEqual(["C"]);
  });

  it("supports undo-redo-undo roundtrip", () => {
    let h = createHistory("A");
    h = pushHistory(h, "B");
    h = undo(h)!;      // present=A
    h = redo(h)!;      // present=B
    h = undo(h)!;      // present=A
    expect(h.present).toBe("A");
    expect(h.future).toEqual(["B"]);
  });
});

describe("structural sharing", () => {
  it("History<object> shares unchanged references", () => {
    const objA = { things: new Map([["a", 1]]), settings: { x: true } };
    const objB = { ...objA, things: new Map([["a", 1], ["b", 2]]) };
    const h = createHistory(objA);
    const h2 = pushHistory(h, objB);
    // Settings is same reference in both snapshots
    expect(h2.past[0]!.settings).toBe(objA.settings);
    expect(h2.present.settings).toBe(objA.settings);
  });
});
