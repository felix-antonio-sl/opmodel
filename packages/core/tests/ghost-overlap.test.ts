import { describe, it, expect } from "vitest";
import { loadModel } from "../src/serialization";
import { resolveOpdFiber } from "../src/simulation";
import { readFileSync } from "fs";
import { resolve } from "path";

const fixture = readFileSync(
  resolve(__dirname, "../../../tests/hospitalizacion-domiciliaria.opmodel"),
  "utf8",
);

describe("Ghost positioning — no overlap with explicit things", () => {
  it("ghosts never overlap explicit things in any OPD", () => {
    const r = loadModel(fixture);
    if (!r.ok) throw new Error("load failed");
    const m = r.value;

    for (const [opdId, opd] of m.opds) {
      const fiber = resolveOpdFiber(m, opdId);
      const explicit = [...fiber.things.values()].filter(e => !e.implicit);
      const implicit = [...fiber.things.values()].filter(e => e.implicit);

      for (const ghost of implicit) {
        const gx = ghost.appearance.x;
        const gy = ghost.appearance.y;
        const gw = ghost.appearance.w;
        const gh = ghost.appearance.h;

        for (const ex of explicit) {
          const ex2 = ex.appearance;
          const overlaps =
            gx < ex2.x + ex2.w &&
            gx + gw > ex2.x &&
            gy < ex2.y + ex2.h &&
            gy + gh > ex2.y;

          expect(overlaps, `ghost ${ghost.thing.name} overlaps explicit ${ex.thing.name} in ${opd.name}`).toBe(false);
        }
      }
    }
  });

  it("ghosts are placed to the right of all explicit things", () => {
    const r = loadModel(fixture);
    if (!r.ok) throw new Error("load failed");
    const m = r.value;

    for (const [opdId, opd] of m.opds) {
      const fiber = resolveOpdFiber(m, opdId);
      const explicit = [...fiber.things.values()].filter(e => !e.implicit);
      const implicit = [...fiber.things.values()].filter(e => e.implicit);

      if (implicit.length === 0) continue;

      const maxRight = Math.max(...explicit.map(e => e.appearance.x + e.appearance.w));

      for (const ghost of implicit) {
        expect(ghost.appearance.x, `ghost ${ghost.thing.name} in ${opd.name} should be right of explicit max (${maxRight})`).toBeGreaterThanOrEqual(maxRight);
      }
    }
  });

  it("ghosts never overlap each other", () => {
    const r = loadModel(fixture);
    if (!r.ok) throw new Error("load failed");
    const m = r.value;

    for (const [opdId, opd] of m.opds) {
      const fiber = resolveOpdFiber(m, opdId);
      const implicit = [...fiber.things.values()].filter(e => e.implicit);

      for (let i = 0; i < implicit.length; i++) {
        for (let j = i + 1; j < implicit.length; j++) {
          const a = implicit[i].appearance;
          const b = implicit[j].appearance;
          const overlaps =
            a.x < b.x + b.w &&
            a.x + a.w > b.x &&
            a.y < b.y + b.h &&
            a.y + a.h > b.y;

          expect(overlaps, `ghost ${implicit[i].thing.name} overlaps ghost ${implicit[j].thing.name} in ${opd.name}`).toBe(false);
        }
      }
    }
  });
});
