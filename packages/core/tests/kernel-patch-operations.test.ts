import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  loadModel,
  isOk,
  applyKernelPatch,
  validateKernelPatch,
  type KernelPatchOperation,
} from "../src/index";

function load(name: string) {
  const raw = readFileSync(resolve(__dirname, "../../../tests", name), "utf-8");
  const r = loadModel(raw);
  if (!isOk(r)) throw new Error("load failed");
  return r.value;
}

describe("KernelPatchOperation", () => {
  it("addThing creates a new thing with generated id", () => {
    const model = load("coffee-making.opmodel");
    const patch: KernelPatchOperation = {
      op: "addThing",
      payload: { kind: "object", name: "Test Object" },
    };
    const result = applyKernelPatch(model, patch);
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.createdId).toBeDefined();
    expect(result.value.model.things.get(result.value.createdId!)?.name).toBe("Test Object");
  });

  it("deleteThing cascades states and links", () => {
    const model = load("coffee-making.opmodel");
    const linkCountBefore = model.links.size;
    const patch: KernelPatchOperation = {
      op: "deleteThing",
      payload: { thingId: "obj-barista" },
    };
    const result = applyKernelPatch(model, patch);
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.model.things.has("obj-barista")).toBe(false);
    expect(result.value.model.links.size).toBeLessThan(linkCountBefore);
  });

  it("renameThing updates name without changing id", () => {
    const model = load("coffee-making.opmodel");
    const patch: KernelPatchOperation = {
      op: "renameThing",
      payload: { thingId: "obj-coffee", newName: "Espresso" },
    };
    const result = applyKernelPatch(model, patch);
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.model.things.get("obj-coffee")?.name).toBe("Espresso");
  });

  it("addLink creates a new link with generated id", () => {
    const model = load("coffee-making.opmodel");
    const patch: KernelPatchOperation = {
      op: "addLink",
      payload: {
        source: "obj-barista",
        target: "proc-coffee-making",
        type: "agent",
      },
    };
    const result = applyKernelPatch(model, patch);
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.createdId).toBeDefined();
    expect(result.value.model.links.get(result.value.createdId!)?.type).toBe("agent");
  });

  it("deleteLink removes the link", () => {
    const model = load("coffee-making.opmodel");
    const anyLinkId = [...model.links.keys()][0];
    const patch: KernelPatchOperation = { op: "deleteLink", payload: { linkId: anyLinkId } };
    const result = applyKernelPatch(model, patch);
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.model.links.has(anyLinkId)).toBe(false);
  });

  it("changeLinkKind updates type", () => {
    const model = load("coffee-making.opmodel");
    const anyLinkId = [...model.links.keys()][0];
    const patch: KernelPatchOperation = {
      op: "changeLinkKind",
      payload: { linkId: anyLinkId, newKind: "instrument" },
    };
    const result = applyKernelPatch(model, patch);
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.model.links.get(anyLinkId)?.type).toBe("instrument");
  });

  it("validateKernelPatch reports NOT_FOUND when thing missing", () => {
    const model = load("coffee-making.opmodel");
    const patch: KernelPatchOperation = {
      op: "deleteThing",
      payload: { thingId: "does-not-exist" },
    };
    const validation = validateKernelPatch(model, patch);
    expect(validation.ok).toBe(false);
    expect(validation.issues[0]?.code).toBe("NOT_FOUND");
  });

  it("addThing with duplicate id rejected (I-08)", () => {
    const model = load("coffee-making.opmodel");
    const patch: KernelPatchOperation = {
      op: "addThing",
      payload: { id: "obj-barista", kind: "object", name: "Duplicate" },
    };
    const validation = validateKernelPatch(model, patch);
    expect(validation.ok).toBe(false);
    expect(validation.issues[0]?.code).toBe("I-08");
  });

  it("applying patch does not mutate original model", () => {
    const model = load("coffee-making.opmodel");
    const thingCountBefore = model.things.size;
    applyKernelPatch(model, {
      op: "addThing",
      payload: { kind: "object", name: "Ghost" },
    });
    expect(model.things.size).toBe(thingCountBefore);
  });
});
