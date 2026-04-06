import { useRef, useState, useCallback, useMemo, useEffect } from "react";
import {
  buildPatchableOpdProjectionSlice,
  type PatchableOpdProjectionSlice,
  type ProjectionVisualLinkEntry,
} from "../lib/projection-view";
import type { Model, Appearance, Fan } from "@opmodel/core";
import { createInitialState, resolveOpdFiber, findConsumptionResultPairs, findStructuralForks, getSemiFoldedParts, type ModelState, type StructuralFork, type OpdFiber } from "@opmodel/core";
import type { Command, EditorMode, LinkTypeChoice, SimulationUIState } from "../lib/commands";
import { genId } from "../lib/ids";
import {
  center,
  type Point,
  type Rect,
} from "../lib/geometry";
import { LINK_COLORS, paddedBounds } from "../lib/visual-rules";
import { suggestLayoutForOpd } from "../lib/spatial-layout";
import { auditVisualOpd, computeVisualQuality } from "../lib/visual-lint";
import { routeEdges, type EdgePath } from "../lib/edge-router";

import { ThingNode } from "./canvas/ThingNode";
import { LinkLine } from "./canvas/LinkLine";
import { SvgDefs } from "./canvas/SvgDefs";
import { InlineRename } from "./canvas/InlineRename";
import {
  opdAncestors,
  edgePoint,
  statesForThing,
  statePillRect,
  adjustEffectEndpoints,
  snap,
  LINK_CATEGORIES,
} from "./canvas/canvas-helpers";

/* ─── Props ─── */

interface Props {
  model: Model;
  projectionSlice?: PatchableOpdProjectionSlice;
  opdId: string;
  selectedThing: string | null;
  mode: EditorMode;
  linkType: LinkTypeChoice;
  dispatch: (cmd: Command) => boolean;
  simulation: SimulationUIState | null;
  errorEntities?: Set<string>;
}

/* ─── Main Canvas Component ─── */

export function OpdCanvas({ model, projectionSlice, opdId, selectedThing, mode, linkType, dispatch, simulation, errorEntities }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [pan, setPan] = useState({ x: 40, y: 20 });
  const [zoom, setZoom] = useState(1);
  const [hiddenLinkTypes, setHiddenLinkTypes] = useState<Set<string>>(new Set());
  const [showLinkFilter, setShowLinkFilter] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; thingId: string } | null>(null);
  const [hideLinkLabels, setHideLinkLabels] = useState(false);
  const [showGhosts, setShowGhosts] = useState(false);
  const [attentionThingId, setAttentionThingId] = useState<string | null>(null);

  const toggleLinkCategory = (category: string) => {
    setHiddenLinkTypes(prev => {
      const next = new Set(prev);
      const types = LINK_CATEGORIES[category] ?? [];
      const allHidden = types.every(t => prev.has(t));
      for (const t of types) {
        if (allHidden) next.delete(t);
        else next.add(t);
      }
      return next;
    });
  };

  // Derive simulation ModelState for current step
  const simModelState = useMemo(() => {
    if (!simulation) return null;
    if (simulation.currentStepIndex === -1) return createInitialState(simulation.frozenModel);
    const step = simulation.trace.steps[simulation.currentStepIndex];
    return step ? step.newState : null;
  }, [simulation]);

  // Active process in current step (for highlighting)
  const simActiveProcessId = useMemo(() => {
    if (!simulation || simulation.currentStepIndex < 0) return null;
    const step = simulation.trace.steps[simulation.currentStepIndex];
    return step?.processId ?? null;
  }, [simulation]);

  // Pan state
  const [panning, setPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Drag thing state (visual delta, not model mutation until drop)
  const [dragTarget, setDragTarget] = useState<string | null>(null);
  const [dragDelta, setDragDelta] = useState<Point>({ x: 0, y: 0 });
  const [dragOrigin, setDragOrigin] = useState<Point>({ x: 0, y: 0 });

  // Multi-select state (H-04)
  const [multiSelect, setMultiSelect] = useState<Set<string>>(new Set());
  const skipNextClick = useRef(false);

  // Lasso selection state
  const [lasso, setLasso] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);

  // Clear multi-select when OPD changes
  useEffect(() => { setMultiSelect(new Set()); }, [opdId]);

  useEffect(() => {
    if (!selectedThing) {
      setAttentionThingId(null);
      return;
    }
    setAttentionThingId(selectedThing);
    const timer = window.setTimeout(() => setAttentionThingId((current) => current === selectedThing ? null : current), 1400);
    return () => window.clearTimeout(timer);
  }, [selectedThing, opdId]);

  // Batch delete for multi-select
  useEffect(() => {
    if (multiSelect.size < 2) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && !e.metaKey && !e.ctrlKey) {
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "SELECT" || target.tagName === "TEXTAREA") return;
        e.preventDefault();
        e.stopImmediatePropagation();
        for (const id of multiSelect) dispatch({ tag: "removeThing", thingId: id });
        setMultiSelect(new Set());
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [multiSelect, dispatch]);

  // Resize state
  type ResizeHandle = "nw" | "ne" | "sw" | "se";
  const [resizeTarget, setResizeTarget] = useState<string | null>(null);
  const [resizeHandle, setResizeHandle] = useState<ResizeHandle | null>(null);
  const [resizeOrigin, setResizeOrigin] = useState<Point>({ x: 0, y: 0 });
  const [resizeDelta, setResizeDelta] = useState<Point>({ x: 0, y: 0 });

  // Container drag coupling
  const containerThingId = useMemo(() => {
    const opd = model.opds.get(opdId);
    return opd?.refines ?? null;
  }, [model, opdId]);

  const projectedSlice = useMemo(
    () => projectionSlice ?? buildPatchableOpdProjectionSlice(model, opdId),
    [projectionSlice, model, opdId],
  );

  // Set of things that move during drag
  const draggedThings = useMemo(() => {
    if (!dragTarget) return new Set<string>();
    if (dragTarget === containerThingId) {
      const set = new Set<string>();
      for (const app of projectedSlice.appearancesByThing.values()) {
        if (app.opd === opdId) set.add(app.thing);
      }
      return set;
    }
    if (multiSelect.size > 0 && multiSelect.has(dragTarget)) {
      const set = new Set(multiSelect);
      set.add(dragTarget);
      return set;
    }
    return new Set([dragTarget]);
  }, [dragTarget, containerThingId, opdId, multiSelect, projectedSlice]);

  // Inline rename state
  const [renaming, setRenaming] = useState<string | null>(null);

  // Link creation state
  const [linkSource, setLinkSource] = useState<string | null>(null);

  // Reset linkSource when mode changes away from addLink
  useEffect(() => {
    if (mode !== "addLink") setLinkSource(null);
  }, [mode]);

  // DA-9: Compute fiber (derived OPD view)
  const fiber = useMemo(() => resolveOpdFiber(model, opdId), [model, opdId]);

  // SubModel shared things
  const sharedThingIds = useMemo(() => {
    const set = new Set<string>();
    if (model.subModels) {
      for (const sub of model.subModels.values()) {
        for (const id of sub.shared_things) set.add(id);
      }
    }
    return set;
  }, [model.subModels]);

  // R-VI-2: Things appearing in multiple OPDs
  const multiOpdThings = useMemo(() => projectedSlice.multiOpdThings, [projectedSlice]);

  const appearances = useMemo(() => {
    const projectionThings = projectedSlice.visualGraph?.thingsById;
    if (projectionThings) {
      const map = new Map<string, Appearance>();
      for (const [thingId, entry] of projectionThings) {
        if (entry.implicit) continue;
        map.set(thingId, entry.appearance);
      }
      return map;
    }

    const map = new Map<string, Appearance>();
    for (const [id, entry] of fiber.things) {
      if (entry.implicit) continue;
      map.set(id, projectedSlice.appearancesByThing.get(id) ?? entry.appearance);
    }
    return map;
  }, [fiber, projectedSlice]);

  // Select all (Ctrl+A)
  useEffect(() => {
    const handler = () => {
      if (simulation) return;
      setMultiSelect(new Set(appearances.keys()));
    };
    window.addEventListener("opmodel:selectAll", handler);
    return () => window.removeEventListener("opmodel:selectAll", handler);
  }, [appearances, simulation]);

  // Implicit things set
  const implicitThings = useMemo(() => {
    if (projectedSlice.visualGraph) {
      return projectedSlice.visualGraph.implicitThingIds;
    }
    const set = new Set<string>();
    for (const [id, entry] of fiber.things) {
      if (entry.implicit) set.add(id);
    }
    return set;
  }, [projectedSlice, fiber]);

  // DA-9: filter suppressed states
  const visibleStatesFor = useCallback((allStates: ReturnType<typeof statesForThing>, thingId: string) => {
    const projectedThing = projectedSlice.visualGraph?.thingsById.get(thingId);
    if (projectedThing?.visibleStates) return projectedThing.visibleStates;

    const projectionSuppressed = projectedThing?.suppressedStateIds;
    const fiberSuppressed = fiber.suppressedStates.get(thingId);
    const app = fiber.things.get(thingId)?.appearance;
    const storedSuppressed = app?.suppressed_states;
    if (!fiberSuppressed && !projectionSuppressed && !storedSuppressed) return allStates;
    return allStates.filter(s => {
      if (fiberSuppressed?.has(s.id)) return false;
      if (projectionSuppressed?.has(s.id)) return false;
      if (storedSuppressed?.includes(s.id)) return false;
      return true;
    });
  }, [projectedSlice, fiber]);

  // Collect visible links
  const visibleLinks = useMemo((): ProjectionVisualLinkEntry[] => {
    if (projectedSlice.visualGraph?.links) {
      return projectedSlice.visualGraph.links;
    }

    const resolved = projectionSlice?.visualLinks ?? fiber.links;
    const entries: ProjectionVisualLinkEntry[] = resolved.map(rl => {
      // Enrich label with state transition for effect links
      let labelOverride = rl.splitHalf as string | undefined;
      if (!labelOverride && rl.link.source_state && rl.link.target_state) {
        const fromState = model.states.get(rl.link.source_state);
        const toState = model.states.get(rl.link.target_state);
        if (fromState && toState) {
          labelOverride = `${rl.link.type} (${fromState.name} → ${toState.name})`;
        }
      }
      return {
        link: rl.link,
        modifier: [...model.modifiers.values()].find((m) => m.over === rl.link.id),
        visualSource: rl.visualSource,
        visualTarget: rl.visualTarget,
        labelOverride,
        isMergedPair: false,
        aggregated: rl.aggregated,
      };
    });

    // Merge consumption+result pairs (DA-7)
    const pairs = findConsumptionResultPairs(model, resolved);
    const consumptionIds = new Set(pairs.map(p => p.consumptionLink.id));
    const resultIds = new Set(pairs.map(p => p.resultLink.id));

    const mergedEntries = new Map<string, ProjectionVisualLinkEntry>();
    for (const pair of pairs) {
      const consEntry = entries.find(e => e.link.id === pair.consumptionLink.id);
      const resEntry = entries.find(e => e.link.id === pair.resultLink.id);
      if (!consEntry) continue;
      const label = pair.fromStateName && pair.toStateName
        ? `${pair.fromStateName} → ${pair.toStateName}` : "consumption+result";
      mergedEntries.set(pair.consumptionLink.id, {
        link: { ...consEntry.link, source: pair.processId, target: pair.objectId, source_state: pair.consumptionLink.source_state, target_state: pair.resultLink.target_state },
        modifier: consEntry.modifier ?? resEntry?.modifier,
        visualSource: pair.processId,
        visualTarget: pair.objectId,
        labelOverride: label,
        isMergedPair: true,
      });
    }

    const filtered = entries
      .filter(e => !resultIds.has(e.link.id))
      .map(e => mergedEntries.get(e.link.id) ?? e);

    return adjustEffectEndpoints(filtered, model);
  }, [projectedSlice, projectionSlice, fiber, model]);

  // Link type filter
  const filteredVisibleLinks = useMemo(() => {
    if (hiddenLinkTypes.size === 0) return visibleLinks;
    return visibleLinks.filter(vl => !hiddenLinkTypes.has(vl.link.type));
  }, [visibleLinks, hiddenLinkTypes]);

  // Fan arcs
  const ARC_DIST = 65;
  const visibleFans = useMemo(() => {
    const visibleLinkIds = new Set(visibleLinks.map(vl => vl.link.id));
    const result: Array<{
      fan: Fan;
      arcPoints: Point[];
      sharedCenter: Point;
    }> = [];

    for (const fan of projectedSlice.fans) {
      if (fan.type === "and") continue;
      const allVisible = fan.members.every(mid => visibleLinkIds.has(mid));
      if (!allVisible) continue;

      const memberLinks = fan.members.map(mid => model.links.get(mid)!).filter(Boolean);
      if (memberLinks.length < 2) continue;
      const allSameSource = memberLinks.every(l => l.source === memberLinks[0]!.source);
      const direction = fan.direction ?? (allSameSource ? "diverging" : "converging");
      const sharedId = direction === "converging"
        ? memberLinks[0]!.target
        : memberLinks[0]!.source;

      const sharedApp = appearances.get(sharedId);
      const sharedThing = model.things.get(sharedId);
      if (!sharedApp || !sharedThing) continue;

      const sharedRect: Rect = { x: sharedApp.x, y: sharedApp.y, w: sharedApp.w, h: sharedApp.h };
      const sharedCtr = center(sharedRect);

      const arcPoints: Point[] = [];
      for (const ml of memberLinks) {
        const otherId = direction === "converging" ? ml.source : ml.target;
        const otherApp = appearances.get(otherId);
        const otherThing = model.things.get(otherId);
        if (!otherApp || !otherThing) continue;
        const otherRect: Rect = { x: otherApp.x, y: otherApp.y, w: otherApp.w, h: otherApp.h };
        const otherCtr = center(otherRect);

        const ep = edgePoint(sharedThing.kind, sharedRect, otherCtr);

        const dx = otherCtr.x - ep.x;
        const dy = otherCtr.y - ep.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 1) continue;

        arcPoints.push({
          x: ep.x + (dx / len) * ARC_DIST,
          y: ep.y + (dy / len) * ARC_DIST,
        });
      }
      if (arcPoints.length < 2) continue;

      result.push({ fan, arcPoints, sharedCenter: sharedCtr });
    }
    return result;
  }, [projectedSlice, model, visibleLinks, appearances]);

  // Structural fork triangles
  const visibleForks = useMemo((): StructuralFork[] => {
    const resolved = filteredVisibleLinks.map(vl => ({
      link: vl.link,
      visualSource: vl.visualSource,
      visualTarget: vl.visualTarget,
      aggregated: false,
    }));
    return findStructuralForks(resolved, 1);
  }, [filteredVisibleLinks]);

  // Link IDs belonging to forks
  const forkedLinkIds = useMemo(() => {
    const ids = new Set<string>();
    for (const fork of visibleForks) {
      for (const child of fork.children) ids.add(child.link.id);
    }
    return ids;
  }, [visibleForks]);

    /* ─── Mouse handlers ─── */

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      setPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    },
    [pan, zoom, simulation],
  );

  const onThingMouseDown = useCallback(
    (thingId: string, e: React.MouseEvent) => {
      if (e.button !== 0) return;
      if (simulation) {
        dispatch({ tag: "selectThing", thingId });
        return;
      }
      e.stopPropagation();

      if (e.ctrlKey || e.metaKey) {
        setMultiSelect((prev) => {
          const next = new Set(prev);
          if (next.has(thingId)) next.delete(thingId);
          else next.add(thingId);
          return next;
        });
        dispatch({ tag: "selectThing", thingId });
        return;
      }

      if (!multiSelect.has(thingId)) {
        setMultiSelect(new Set());
      }

      setDragTarget(thingId);
      setDragDelta({ x: 0, y: 0 });
      setDragOrigin({ x: e.clientX, y: e.clientY });
      setPanning(false);
      dispatch({ tag: "selectThing", thingId });
    },
    [dispatch, simulation, multiSelect],
  );

  const onResizeHandleMouseDown = useCallback(
    (thingId: string, handle: ResizeHandle, e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setResizeTarget(thingId);
      setResizeHandle(handle);
      setResizeOrigin({ x: e.clientX, y: e.clientY });
      setResizeDelta({ x: 0, y: 0 });
      setPanning(false);
    },
    [],
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (lasso) {
        const svgRect = svgRef.current?.getBoundingClientRect();
        if (!svgRect) return;
        const mx = (e.clientX - svgRect.left - pan.x) / zoom;
        const my = (e.clientY - svgRect.top - pan.y) / zoom;
        setLasso((prev) => prev ? { ...prev, x2: mx, y2: my } : null);
        return;
      }
      if (resizeTarget) {
        const dx = (e.clientX - resizeOrigin.x) / zoom;
        const dy = (e.clientY - resizeOrigin.y) / zoom;
        setResizeDelta({ x: dx, y: dy });
        return;
      }
      if (dragTarget) {
        const dx = (e.clientX - dragOrigin.x) / zoom;
        const dy = (e.clientY - dragOrigin.y) / zoom;
        setDragDelta({ x: dx, y: dy });
        return;
      }
      if (panning) {
        setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
      }
    },
    [lasso, pan, zoom, resizeTarget, resizeOrigin, dragTarget, dragOrigin, panning, panStart],
  );

  const onMouseUp = useCallback(() => {
    if (lasso) {
      const lx = Math.min(lasso.x1, lasso.x2);
      const ly = Math.min(lasso.y1, lasso.y2);
      const lw = Math.abs(lasso.x2 - lasso.x1);
      const lh = Math.abs(lasso.y2 - lasso.y1);
      if (lw > 5 || lh > 5) {
        const selected = new Set<string>();
        for (const [thingId, app] of appearances) {
          const cx = app.x + app.w / 2;
          const cy = app.y + app.h / 2;
          if (cx >= lx && cx <= lx + lw && cy >= ly && cy <= ly + lh) {
            selected.add(thingId);
          }
        }
        setMultiSelect(selected);
        if (selected.size === 1) {
          dispatch({ tag: "selectThing", thingId: [...selected][0]! });
        }
      }
      setLasso(null);
      skipNextClick.current = true;
      return;
    }
    if (resizeTarget && resizeHandle) {
      const app = appearances.get(resizeTarget);
      if (app && (Math.abs(resizeDelta.x) > 1 || Math.abs(resizeDelta.y) > 1)) {
        const MIN_W = 60, MIN_H = 30;
        let { x, y, w, h } = app;
        const dx = resizeDelta.x, dy = resizeDelta.y;
        if (resizeHandle === "se") { w += dx; h += dy; }
        else if (resizeHandle === "sw") { x += dx; w -= dx; h += dy; }
        else if (resizeHandle === "ne") { w += dx; y += dy; h -= dy; }
        else if (resizeHandle === "nw") { x += dx; y += dy; w -= dx; h -= dy; }
        w = Math.max(MIN_W, snap(w));
        h = Math.max(MIN_H, snap(h));
        x = snap(x); y = snap(y);
        if (resizeHandle === "sw" || resizeHandle === "nw") x = Math.min(x, app.x + app.w - MIN_W);
        if (resizeHandle === "ne" || resizeHandle === "nw") y = Math.min(y, app.y + app.h - MIN_H);
        dispatch({ tag: "resizeThing", thingId: resizeTarget, opdId, w, h });
        if (x !== app.x || y !== app.y) {
          dispatch({ tag: "moveThing", thingId: resizeTarget, opdId, x, y });
        }
      }
      setResizeTarget(null);
      setResizeHandle(null);
      setResizeDelta({ x: 0, y: 0 });
      return;
    }
    if (dragTarget) {
      if (Math.abs(dragDelta.x) > 1 || Math.abs(dragDelta.y) > 1) {
        if (draggedThings.size > 1) {
          const moves: Array<{ thingId: string; opdId: string; x: number; y: number }> = [];
          for (const thingId of draggedThings) {
            const app = appearances.get(thingId);
            if (app) {
              moves.push({ thingId, opdId, x: snap(app.x + dragDelta.x), y: snap(app.y + dragDelta.y) });
            }
          }
          if (moves.length > 0) dispatch({ tag: "moveThings", moves });
        } else {
          const app = appearances.get(dragTarget);
          if (app) {
            dispatch({ tag: "moveThing", thingId: dragTarget, opdId, x: snap(app.x + dragDelta.x), y: snap(app.y + dragDelta.y) });
          }
        }
      }
      if (Math.abs(dragDelta.x) <= 1 && Math.abs(dragDelta.y) <= 1) {
        setMultiSelect(new Set());
      } else {
        skipNextClick.current = true;
      }
      setDragTarget(null);
      setDragDelta({ x: 0, y: 0 });
      return;
    }
    setPanning(false);
  }, [dragTarget, dragDelta, draggedThings, appearances, opdId, dispatch, lasso, resizeTarget, resizeHandle, resizeDelta, resizeOrigin]);

  const fitToContent = useCallback(() => {
    if (!svgRef.current || appearances.size === 0) return;
    const svgRect = svgRef.current.getBoundingClientRect();
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const app of appearances.values()) {
      minX = Math.min(minX, app.x);
      minY = Math.min(minY, app.y);
      maxX = Math.max(maxX, app.x + app.w);
      maxY = Math.max(maxY, app.y + app.h);
    }
    if (minX === Infinity) return;
    const bounds = paddedBounds({ x: minX, y: minY, w: maxX - minX, h: maxY - minY });
    const scaleX = svgRect.width / bounds.w;
    const scaleY = svgRect.height / bounds.h;
    const newZoom = Math.min(2, Math.max(0.3, Math.min(scaleX, scaleY)));
    const newPanX = (svgRect.width - bounds.w * newZoom) / 2 - bounds.x * newZoom;
    const newPanY = (svgRect.height - bounds.h * newZoom) / 2 - bounds.y * newZoom;
    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  }, [appearances]);

  const bringThingIntoView = useCallback((thingId: string) => {
    const app = appearances.get(thingId);
    const svgRect = svgRef.current?.getBoundingClientRect();
    if (!app || !svgRect) return;

    const marginX = Math.min(140, svgRect.width * 0.18);
    const marginY = Math.min(110, svgRect.height * 0.18);
    const left = pan.x + app.x * zoom;
    const top = pan.y + app.y * zoom;
    const right = left + app.w * zoom;
    const bottom = top + app.h * zoom;

    const comfortablyVisible =
      left >= marginX &&
      top >= marginY &&
      right <= svgRect.width - marginX &&
      bottom <= svgRect.height - marginY;

    if (comfortablyVisible) return;

    const centerX = app.x + app.w / 2;
    const centerY = app.y + app.h / 2;
    setPan({
      x: svgRect.width / 2 - centerX * zoom,
      y: svgRect.height / 2 - centerY * zoom,
    });
  }, [appearances, pan.x, pan.y, zoom]);

  useEffect(() => {
    if (!selectedThing || dragTarget || resizeTarget) return;
    const timer = window.setTimeout(() => bringThingIntoView(selectedThing), 40);
    return () => window.clearTimeout(timer);
  }, [selectedThing, opdId, dragTarget, resizeTarget, bringThingIntoView]);

  const [layoutToast, setLayoutToast] = useState<string | null>(null);

  const autoLayoutCurrentOpd = useCallback(() => {
    const currentApps = [...model.appearances.values()].filter((a) => a.opd === opdId);
    const ids = new Set(currentApps.map((a) => a.thing));
    const currentLinks = [...model.links.values()].filter((l) => ids.has(l.source) && ids.has(l.target));
    const beforeFindings = auditVisualOpd({ appearances: currentApps, links: currentLinks, things: model.things.values(), states: model.states.values() });
    const before = computeVisualQuality(beforeFindings);

    const suggestion = suggestLayoutForOpd(model, opdId);
    if (suggestion.patches.length === 0) {
      setLayoutToast(`Already optimal — ${before.grade} ${before.score}`);
      setTimeout(() => setLayoutToast(null), 3000);
      return;
    }
    const after = computeVisualQuality(suggestion.findings);
    const ok = dispatch({
      tag: "updateAppearancesBatch",
      updates: suggestion.patches.map((p) => ({ thingId: p.thingId, opdId: p.opdId, patch: p.patch as Record<string, unknown> })),
    });
    if (ok) {
      const delta = after.score - before.score;
      const arrow = delta > 0 ? "↑" : delta < 0 ? "↓" : "→";
      setLayoutToast(`${before.grade} ${before.score} ${arrow} ${after.grade} ${after.score}`);
      setTimeout(() => setLayoutToast(null), 4000);
      setTimeout(() => fitToContent(), 0);
    }
  }, [model, opdId, dispatch, fitToContent]);

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.92 : 1.08;
      setZoom((z) => Math.min(3, Math.max(0.3, z * delta)));
    },
    [],
  );

  const onCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      if (skipNextClick.current) { skipNextClick.current = false; return; }
      if (dragTarget) return;
      if (simulation) {
        dispatch({ tag: "selectThing", thingId: null });
        return;
      }

      if (mode === "addObject" || mode === "addProcess") {
        const svgRect = svgRef.current?.getBoundingClientRect();
        if (!svgRect) return;
        const x = (e.clientX - svgRect.left - pan.x) / zoom;
        const y = (e.clientY - svgRect.top - pan.y) / zoom;
        const kind = mode === "addObject" ? "object" : "process";
        const prefix = kind === "object" ? "obj" : "proc";
        const id = genId(prefix);

        dispatch({
          tag: "addThing",
          thing: {
            id,
            kind,
            name: `New ${kind.charAt(0).toUpperCase() + kind.slice(1)}`,
            essence: "informatical" as const,
            affiliation: "systemic" as const,
          },
          opdId,
          x: snap(x - 60),
          y: snap(y - 25),
          w: 120,
          h: 60,
        });
        dispatch({ tag: "selectThing", thingId: id });
        dispatch({ tag: "setMode", mode: "select" });
        return;
      }

      if (mode === "addLink") {
        setLinkSource(null);
        return;
      }

      dispatch({ tag: "selectThing", thingId: null });
      setMultiSelect(new Set());
      setRenaming(null);
    },
    [dragTarget, simulation, mode, pan, zoom, opdId, dispatch],
  );

  const onThingDoubleClick = useCallback((thingId: string) => {
    if (simulation) return;
    const refinementOpd = [...model.opds.values()].find(
      o => o.refines === thingId && o.parent_opd === opdId
    );
    if (refinementOpd) {
      dispatch({ tag: "selectOpd", opdId: refinementOpd.id });
      return;
    }
    setRenaming(thingId);
  }, [simulation, model, opdId, dispatch]);

  const commitRename = useCallback(
    (name: string) => {
      if (renaming) {
        const existing = [...model.things.values()].find(
          (t) => t.name === name && t.id !== renaming
        );
        if (existing) {
          if (!window.confirm(`A ${existing.kind} named "${name}" already exists. Use this name anyway?`)) {
            return;
          }
        }
        dispatch({ tag: "renameThing", thingId: renaming, name });
      }
      setRenaming(null);
    },
    [renaming, dispatch, model],
  );

  const opd = model.opds.get(opdId);

  // Semi-fold part rects
  const semiFoldPartRects = useMemo(() => {
    const map = new Map<string, Rect>();
    for (const [containerId, app] of appearances) {
      if (!app.semi_folded) continue;
      const thing = model.things.get(containerId);
      if (thing?.kind !== "object") continue;
      const sf = getSemiFoldedParts(model, containerId);
      for (let i = 0; i < sf.visible.length; i++) {
        const entry = sf.visible[i]!;
        map.set(entry.thingId, {
          x: app.x + 12, y: app.y + app.h + 3 + i * 14,
          w: app.w - 24, h: 14,
        });
      }
    }
    return map;
  }, [appearances, model]);

  const getEffectiveRect = useCallback(
    (thingId: string): Rect | null => {
      const app = appearances.get(thingId);
      if (!app) {
        return semiFoldPartRects.get(thingId) ?? null;
      }
      const thing = model.things.get(thingId);
      const states = statesForThing(model, thingId);
      const ox = draggedThings.has(thingId) ? dragDelta.x : 0;
      const oy = draggedThings.has(thingId) ? dragDelta.y : 0;
      let extraH = states.length > 0 ? 24 : 0;
      if (app.semi_folded && thing?.kind === "object") {
        const sf = getSemiFoldedParts(model, thingId);
        const count = sf.visible.length + (sf.hiddenCount > 0 ? 1 : 0);
        extraH += count * 14 + 8;
      }
      return {
        x: app.x + ox,
        y: app.y + oy,
        w: app.w,
        h: app.h + extraH,
      };
    },
    [appearances, model, draggedThings, dragDelta, semiFoldPartRects],
  );

  // Edge routing: compute curved paths for links with crossings
  const edgeRoutes = useMemo((): Map<string, EdgePath> => {
    const routeInputs = filteredVisibleLinks
      .filter(vl => !forkedLinkIds.has(vl.link.id))
      .map(vl => {
        const srcRect = getEffectiveRect(vl.visualSource);
        const tgtRect = getEffectiveRect(vl.visualTarget);
        const srcThing = model.things.get(vl.visualSource);
        const tgtThing = model.things.get(vl.visualTarget);
        if (!srcRect || !tgtRect || !srcThing || !tgtThing) return null;
        const p1 = edgePoint(srcThing.kind, srcRect, center(tgtRect));
        const p2 = edgePoint(tgtThing.kind, tgtRect, center(srcRect));
        const key = vl.isInputHalf ? `${vl.link.id}__in` : vl.isOutputHalf ? `${vl.link.id}__out` : vl.link.id;
        return { id: key, sourceId: vl.visualSource, targetId: vl.visualTarget, p1, p2 };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    return routeEdges(routeInputs);
  }, [filteredVisibleLinks, forkedLinkIds, model, getEffectiveRect]);

  // Cursor
  const cursorClass = dragTarget
    ? "opd-canvas--dragging"
    : mode === "addObject" || mode === "addProcess"
      ? "opd-canvas--placing"
      : mode === "addLink"
        ? "opd-canvas--linking"
        : "";

  return (
    <div className={`opd-canvas ${cursorClass}`}>
      {multiSelect.size >= 2 && (
        <div className="canvas-align-toolbar">
          <button title="Align Left" onClick={() => {
            const apps = [...multiSelect].map(id => ({ id, app: appearances.get(id) })).filter(e => e.app);
            const minX = Math.min(...apps.map(e => e.app!.x));
            const moves = apps.filter(e => e.app!.x !== minX).map(e => ({ thingId: e.id, opdId, x: minX, y: e.app!.y }));
            if (moves.length > 0) dispatch({ tag: "moveThings", moves });
          }}>⫷</button>
          <button title="Align Right" onClick={() => {
            const apps = [...multiSelect].map(id => ({ id, app: appearances.get(id) })).filter(e => e.app);
            const maxR = Math.max(...apps.map(e => e.app!.x + e.app!.w));
            const moves = apps.filter(e => e.app!.x + e.app!.w !== maxR).map(e => ({ thingId: e.id, opdId, x: maxR - e.app!.w, y: e.app!.y }));
            if (moves.length > 0) dispatch({ tag: "moveThings", moves });
          }}>⫸</button>
          <button title="Align Top" onClick={() => {
            const apps = [...multiSelect].map(id => ({ id, app: appearances.get(id) })).filter(e => e.app);
            const minY = Math.min(...apps.map(e => e.app!.y));
            const moves = apps.filter(e => e.app!.y !== minY).map(e => ({ thingId: e.id, opdId, x: e.app!.x, y: minY }));
            if (moves.length > 0) dispatch({ tag: "moveThings", moves });
          }}>⊤</button>
          <button title="Align Bottom" onClick={() => {
            const apps = [...multiSelect].map(id => ({ id, app: appearances.get(id) })).filter(e => e.app);
            const maxB = Math.max(...apps.map(e => e.app!.y + e.app!.h));
            const moves = apps.filter(e => e.app!.y + e.app!.h !== maxB).map(e => ({ thingId: e.id, opdId, x: e.app!.x, y: maxB - e.app!.h }));
            if (moves.length > 0) dispatch({ tag: "moveThings", moves });
          }}>⊥</button>
          <button title="Distribute Horizontally" onClick={() => {
            const apps = [...multiSelect].map(id => ({ id, app: appearances.get(id) })).filter(e => e.app).sort((a, b) => a.app!.x - b.app!.x);
            if (apps.length < 3) return;
            const firstApp = apps[0]?.app;
            const lastApp = apps[apps.length - 1]?.app;
            if (!firstApp || !lastApp) return;
            const first = firstApp.x;
            const last = lastApp.x;
            const step = (last - first) / (apps.length - 1);
            const moves = apps.slice(1, -1).map((e, i) => ({ thingId: e.id, opdId, x: snap(first + step * (i + 1)), y: e.app!.y }));
            if (moves.length > 0) dispatch({ tag: "moveThings", moves });
          }}>⫴</button>
          <span className="canvas-align-toolbar__count">{multiSelect.size}</span>
        </div>
      )}
      <div className="canvas-zoom-controls">
        <button title="Zoom In" onClick={() => setZoom(z => Math.min(3, z * 1.2))}>+</button>
        <button title="Zoom Out" onClick={() => setZoom(z => Math.max(0.3, z * 0.83))}>−</button>
        <button title="Fit to Content (F)" onClick={fitToContent}>⊡</button>
        <button title="Auto Layout Current OPD" onClick={autoLayoutCurrentOpd}>⇄</button>
        {layoutToast && <span className="layout-toast">{layoutToast}</span>}
        <button title="Reset Zoom" onClick={() => { setZoom(1); setPan({ x: 40, y: 20 }); }}>1:1</button>
        <button
          title="Filter Links"
          className={hiddenLinkTypes.size > 0 ? "canvas-zoom-controls__active" : ""}
          onClick={() => setShowLinkFilter(v => !v)}
        >⫘</button>
      </div>
      {showLinkFilter && (
        <div className="canvas-link-filter">
          <div className="canvas-link-filter__title">Link Visibility</div>
          {Object.entries(LINK_CATEGORIES).map(([cat, types]) => {
            const allHidden = types.every(t => hiddenLinkTypes.has(t));
            const someHidden = types.some(t => hiddenLinkTypes.has(t));
            return (
              <label key={cat} className="canvas-link-filter__row">
                <input
                  type="checkbox"
                  checked={!allHidden}
                  ref={(el) => { if (el) el.indeterminate = someHidden && !allHidden; }}
                  onChange={() => toggleLinkCategory(cat)}
                />
                <span>{cat}</span>
                <span className="canvas-link-filter__count">
                  {types.reduce((n, t) => n + visibleLinks.filter(vl => vl.link.type === t).length, 0)}
                </span>
              </label>
            );
          })}
          <label className="canvas-link-filter__row" style={{ marginTop: 4, borderTop: "1px solid var(--border)", paddingTop: 4 }}>
            <input type="checkbox" checked={hideLinkLabels} onChange={(e) => setHideLinkLabels(e.target.checked)} />
            <span>Hide labels</span>
          </label>
            <label className="canvas-link-filter__row">
            <input type="checkbox" checked={showGhosts} onChange={(e) => setShowGhosts(e.target.checked)} />
            <span>Show ghosts</span>
            <span className="canvas-link-filter__count">{implicitThings.size}</span>
          </label>
          {hiddenLinkTypes.size > 0 && (
            <button className="canvas-link-filter__reset" onClick={() => setHiddenLinkTypes(new Set())}>
              Show All
            </button>
          )}
        </div>
      )}
      {contextMenu && (() => {
        const app = [...model.appearances.values()].find((a) => a.thing === contextMenu.thingId && a.opd === opdId);
        const thing = model.things.get(contextMenu.thingId);
        if (!app || !thing) return null;
        return (
          <div
            className="canvas-context-menu"
            style={{ position: "fixed", left: contextMenu.x, top: contextMenu.y, zIndex: 200 }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="canvas-context-menu__title">{thing.name}</div>
            <button
              className="canvas-context-menu__item"
              onClick={() => {
                dispatch({ tag: "updateAppearance", thingId: contextMenu.thingId, opdId, patch: { pinned: !app.pinned } });
                setContextMenu(null);
              }}
            >
              {app.pinned ? "📌 Unpin" : "📌 Pin position"}
            </button>
            <button
              className="canvas-context-menu__item"
              onClick={() => {
                dispatch({ tag: "updateAppearance", thingId: contextMenu.thingId, opdId, patch: { auto_sizing: app.auto_sizing === false ? undefined : false } });
                setContextMenu(null);
              }}
            >
              {app.auto_sizing === false ? "📐 Enable auto-sizing" : "📐 Lock size"}
            </button>
          </div>
        );
      })()}
      <div className="canvas-breadcrumb">
        {opdAncestors(model, opdId).map((ancestor, i, arr) => (
          <span key={ancestor.id}>
            {i > 0 && <span className="canvas-breadcrumb__sep"> › </span>}
            <span
              className={`canvas-breadcrumb__item${ancestor.id === opdId ? " canvas-breadcrumb__item--current" : ""}`}
              onClick={() => { if (ancestor.id !== opdId) dispatch({ tag: "selectOpd", opdId: ancestor.id }); }}
            >
              {ancestor.name}
            </span>
          </span>
        ))}
        {opd?.refines && (
          <span className="canvas-breadcrumb__refines">
            {" "}— {opd.refinement_type}: {model.things.get(opd.refines)?.name ?? opd.refines}
          </span>
        )}
      </div>
      <div className="canvas-zoom">{Math.round(zoom * 100)}%</div>

      <svg
        ref={svgRef}
        onMouseDown={(e) => { setContextMenu(null); onMouseDown(e); }}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onWheel={onWheel}
        onClick={(e) => { setContextMenu(null); onCanvasClick(e); }}
      >
        <SvgDefs />

        <rect width="100%" height="100%" fill="var(--bg-canvas)" />
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          <rect x="-500" y="-500" width="3000" height="3000" fill="url(#grid-dots)" />

          {/* Links (behind things) */}
          {filteredVisibleLinks.map(({ link, modifier, visualSource, visualTarget, labelOverride, isMergedPair, isInputHalf, isOutputHalf }) => {
            if (forkedLinkIds.has(link.id)) return null;
            let srcRect = getEffectiveRect(visualSource);
            let tgtRect = getEffectiveRect(visualTarget);
            const srcThing = model.things.get(visualSource);
            const tgtThing = model.things.get(visualTarget);
            if (!srcRect || !tgtRect || !srcThing || !tgtThing) return null;

            let srcKindOverride: "object" | "process" | undefined;
            let tgtKindOverride: "object" | "process" | undefined;

            if (link.type === "effect" || isMergedPair) {
              const objectEnd = srcThing.kind === "object" ? visualSource : visualTarget;
              if (link.source_state) {
                const objApp = appearances.get(objectEnd);
                if (objApp) {
                  const ox = draggedThings.has(objectEnd) ? dragDelta.x : 0;
                  const oy = draggedThings.has(objectEnd) ? dragDelta.y : 0;
                  const adj = { x: objApp.x + ox, y: objApp.y + oy, w: objApp.w, h: objApp.h };
                  const allObjStates = statesForThing(model, objectEnd);
                  const visObjStates = visibleStatesFor(allObjStates, objectEnd);
                  const pill = statePillRect(adj, visObjStates, link.source_state);
                  if (pill) {
                    if (objectEnd === visualSource) { srcRect = pill; srcKindOverride = "object"; }
                    else { tgtRect = pill; tgtKindOverride = "object"; }
                  }
                }
              }
              if (isOutputHalf && link.target_state) {
                const objApp = appearances.get(objectEnd);
                if (objApp) {
                  const ox = draggedThings.has(objectEnd) ? dragDelta.x : 0;
                  const oy = draggedThings.has(objectEnd) ? dragDelta.y : 0;
                  const adj = { x: objApp.x + ox, y: objApp.y + oy, w: objApp.w, h: objApp.h };
                  const allObjStates = statesForThing(model, objectEnd);
                  const visObjStates = visibleStatesFor(allObjStates, objectEnd);
                  const pill = statePillRect(adj, visObjStates, link.target_state);
                  if (pill) {
                    if (objectEnd === visualTarget) { tgtRect = pill; tgtKindOverride = "object"; }
                    else { srcRect = pill; srcKindOverride = "object"; }
                  }
                }
              }
            } else {
              if (link.source_state) {
                const srcApp = appearances.get(visualSource);
                if (srcApp) {
                  const ox = draggedThings.has(visualSource) ? dragDelta.x : 0;
                  const oy = draggedThings.has(visualSource) ? dragDelta.y : 0;
                  const adj = { x: srcApp.x + ox, y: srcApp.y + oy, w: srcApp.w, h: srcApp.h };
                  const allSrcStates = statesForThing(model, visualSource);
                  const visSrcStates = visibleStatesFor(allSrcStates, visualSource);
                  const pill = statePillRect(adj, visSrcStates, link.source_state);
                  if (pill) { srcRect = pill; srcKindOverride = "object"; }
                }
              }
              if (link.target_state) {
                const tgtApp = appearances.get(visualTarget);
                if (tgtApp) {
                  const ox = draggedThings.has(visualTarget) ? dragDelta.x : 0;
                  const oy = draggedThings.has(visualTarget) ? dragDelta.y : 0;
                  const adj = { x: tgtApp.x + ox, y: tgtApp.y + oy, w: tgtApp.w, h: tgtApp.h };
                  const allTgtStates = statesForThing(model, visualTarget);
                  const visTgtStates = visibleStatesFor(allTgtStates, visualTarget);
                  const pill = statePillRect(adj, visTgtStates, link.target_state);
                  if (pill) { tgtRect = pill; tgtKindOverride = "object"; }
                }
              }
            }

            let linkSimClass = "";
            if (simModelState) {
              const isActiveLink = simActiveProcessId && (visualSource === simActiveProcessId || visualTarget === simActiveProcessId);
              if (isActiveLink) {
                linkSimClass = " link-line--sim-active";
              } else {
                const srcObj = simModelState.objects.get(visualSource);
                const tgtObj = simModelState.objects.get(visualTarget);
                if ((srcObj && !srcObj.exists) || (tgtObj && !tgtObj.exists)) {
                  linkSimClass = " link-line--sim-dimmed";
                }
              }
            }

            return (
              <g key={isInputHalf ? `${link.id}__in__${visualSource}__${visualTarget}` : isOutputHalf ? `${link.id}__out__${visualSource}__${visualTarget}` : `${link.id}__${visualSource}__${visualTarget}`} className={linkSimClass || undefined}>
                <title>{`${link.type}: ${srcThing.name}${link.source_state ? ` [${model.states.get(link.source_state)?.name ?? ""}]` : ""} → ${tgtThing.name}${link.target_state ? ` [${model.states.get(link.target_state)?.name ?? ""}]` : ""}${link.probability != null ? ` (${Math.round(link.probability * 100)}%)` : ""}${link.rate ? ` ${link.rate.value}${link.rate.unit}` : ""}`}</title>
                <LinkLine
                  link={link}
                  sourceRect={srcRect}
                  targetRect={tgtRect}
                  sourceKind={srcKindOverride ?? srcThing.kind}
                  targetKind={tgtKindOverride ?? tgtThing.kind}
                  modifier={modifier}
                  labelOverride={labelOverride}
                  isMergedPair={isMergedPair}
                  isInputHalf={isInputHalf}
                  isOutputHalf={isOutputHalf}
                  isError={errorEntities?.has(link.id)}
                  hideLabel={hideLinkLabels}
                  edgePath={edgeRoutes.get(isInputHalf ? `${link.id}__in` : isOutputHalf ? `${link.id}__out` : link.id)}
                />
              </g>
            );
          })}

          {/* Structural fork triangles */}
          {visibleForks.map(fork => {
            const parentRect = getEffectiveRect(fork.parentId);
            const parentThing = model.things.get(fork.parentId);
            if (!parentRect || !parentThing) return null;

            const childrenData = fork.children.map(c => {
              const rect = getEffectiveRect(c.childId);
              const thing = model.things.get(c.childId);
              return rect && thing ? { ...c, rect, thing } : null;
            }).filter((c): c is NonNullable<typeof c> => c !== null);
            if (childrenData.length < 1) return null;

            const cx = childrenData.reduce((s, c) => s + c.rect.x + c.rect.w / 2, 0) / childrenData.length;
            const cy = childrenData.reduce((s, c) => s + c.rect.y + c.rect.h / 2, 0) / childrenData.length;
            const centroid = { x: cx, y: cy };
            const parentCtr = center(parentRect);

            const dx = centroid.x - parentCtr.x;
            const dy = centroid.y - parentCtr.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len < 1) return null;
            const dir = { x: dx / len, y: dy / len };
            const perp = { x: -dir.y, y: dir.x };

            const hasInner = fork.type === "exhibition" || fork.type === "classification";
            const TRUNK = 10;
            // Scale triangle with number of children so branches don't bunch up
            const nChildren = childrenData.length;
            const scaleFactor = nChildren > 3 ? 1 + (nChildren - 3) * 0.25 : 1;
            const TRI_H = (hasInner ? 14 : 12) * scaleFactor;
            const TRI_HALF = (hasInner ? 9 : 7) * scaleFactor;

            const isParentContainer = fork.parentId === containerThingId;
            const trunkStart = isParentContainer
              ? { x: parentCtr.x + dir.x * 20, y: parentCtr.y + dir.y * 20 }
              : edgePoint(parentThing.kind, parentRect, centroid);
            const apex = { x: trunkStart.x + dir.x * TRUNK, y: trunkStart.y + dir.y * TRUNK };
            const baseCtr = { x: apex.x + dir.x * TRI_H, y: apex.y + dir.y * TRI_H };
            const baseL = { x: baseCtr.x - perp.x * TRI_HALF, y: baseCtr.y - perp.y * TRI_HALF };
            const baseR = { x: baseCtr.x + perp.x * TRI_HALF, y: baseCtr.y + perp.y * TRI_HALF };

            const branches = childrenData.map((c, idx) => {
              const t = childrenData.length === 1 ? 0 : (idx / (childrenData.length - 1)) * 2 - 1;
              const origin = { x: baseCtr.x + perp.x * TRI_HALF * t, y: baseCtr.y + perp.y * TRI_HALF * t };
              // CV-4/CV-5: distribute anchor points along child edge to avoid convergence
              const endpoint = edgePoint(c.thing.kind, c.rect, { x: origin.x, y: origin.y });
              // Nudge endpoint along edge if multiple branches target same child
              const ep = childrenData.length > 2
                ? { x: endpoint.x + perp.x * t * 4, y: endpoint.y + perp.y * t * 4 }
                : endpoint;
              return { ...c, origin, endpoint: ep };
            });

            const color = "#6b5fad";
            const triPoints = `${apex.x},${apex.y} ${baseL.x},${baseL.y} ${baseR.x},${baseR.y}`;
            const innerCtr = { x: apex.x * 0.4 + baseCtr.x * 0.6, y: apex.y * 0.4 + baseCtr.y * 0.6 };
            let triangleSvg: React.ReactNode;
            switch (fork.type) {
              case "aggregation":
                triangleSvg = <polygon points={triPoints} fill={color} />;
                break;
              case "exhibition": {
                const s = 0.55;
                const outerCentroid = { x: (apex.x + baseL.x + baseR.x) / 3, y: (apex.y + baseL.y + baseR.y) / 3 };
                const iApex = { x: outerCentroid.x + (apex.x - outerCentroid.x) * s, y: outerCentroid.y + (apex.y - outerCentroid.y) * s };
                const iL = { x: outerCentroid.x + (baseL.x - outerCentroid.x) * s, y: outerCentroid.y + (baseL.y - outerCentroid.y) * s };
                const iR = { x: outerCentroid.x + (baseR.x - outerCentroid.x) * s, y: outerCentroid.y + (baseR.y - outerCentroid.y) * s };
                triangleSvg = (<>
                  <polygon points={triPoints} fill="white" stroke={color} strokeWidth="1.5" />
                  <polygon points={`${iApex.x},${iApex.y} ${iL.x},${iL.y} ${iR.x},${iR.y}`} fill={color} />
                </>);
                break;
              }
              case "generalization":
                triangleSvg = <polygon points={triPoints} fill="white" stroke={color} strokeWidth="1.5" />;
                break;
              case "classification": {
                const r = Math.max(3, TRI_H * 0.18);
                triangleSvg = (<>
                  <polygon points={triPoints} fill="white" stroke={color} strokeWidth="1.5" />
                  <circle cx={innerCtr.x} cy={innerCtr.y} r={r} fill={color} />
                </>);
                break;
              }
            }

            return (
              <g key={`fork-${fork.type}-${fork.parentId}`}>
                <line x1={trunkStart.x} y1={trunkStart.y} x2={apex.x} y2={apex.y}
                  className="link-line" stroke={color} />
                {triangleSvg}
                {branches.map((b, bi) => (
                  <g key={`${b.link.id}__${bi}`}>
                    <line x1={b.origin.x} y1={b.origin.y} x2={b.endpoint.x} y2={b.endpoint.y}
                      className="link-line" stroke={color}
                      onClick={(e) => { e.stopPropagation(); dispatch({ tag: "selectLink", linkId: b.link.id }); }}
                    />
                    {b === branches[0] && (
                      <text className="link-label"
                        x={baseCtr.x + dir.x * 8} y={baseCtr.y + dir.y * 8 - 7}>
                        {fork.type}{fork.children.some(c => c.link.ordered) ? " {ordered}" : ""}
                      </text>
                    )}
                    {/* Ordered aggregation: sequence number on branch */}
                    {b.link.ordered && branches.length > 1 && (
                      <text fontSize={8} fill={color} fontWeight="bold"
                        x={b.origin.x + (b.endpoint.x - b.origin.x) * 0.3}
                        y={b.origin.y + (b.endpoint.y - b.origin.y) * 0.3 - 6}
                        textAnchor="middle">
                        {bi + 1}
                      </text>
                    )}
                    {(() => {
                      const ml = b.childIsTarget ? b.link.multiplicity_target : b.link.multiplicity_source;
                      if (!ml) return null;
                      const mx = b.origin.x + (b.endpoint.x - b.origin.x) * 0.88;
                      const my = b.origin.y + (b.endpoint.y - b.origin.y) * 0.88 - 6;
                      return <text fontSize={9} fill="#666" fontWeight="bold" x={mx} y={my} textAnchor="middle">{ml}</text>;
                    })()}
                  </g>
                ))}
              </g>
            );
          })}

          {/* Fan arcs */}
          {visibleFans.map(({ fan, arcPoints, sharedCenter }) => {
            if (arcPoints.length < 2) return null;
            const color = LINK_COLORS[fan.members[0] ? model.links.get(fan.members[0])?.type ?? "effect" : "effect"] ?? "#666";
            const polar = arcPoints.map(p => ({
              angle: Math.atan2(p.y - sharedCenter.y, p.x - sharedCenter.x),
              r: Math.sqrt((p.x - sharedCenter.x) ** 2 + (p.y - sharedCenter.y) ** 2),
            }));
            polar.sort((a, b) => a.angle - b.angle);
            let maxGap = 0, maxGapIdx = 0;
            for (let i = 0; i < polar.length; i++) {
              const next = (i + 1) % polar.length;
              let gap = polar[next]!.angle - polar[i]!.angle;
              if (gap <= 0) gap += 2 * Math.PI;
              if (gap > maxGap) { maxGap = gap; maxGapIdx = i; }
            }
            const startIdx = (maxGapIdx + 1) % polar.length;
            const ordered: Array<{ angle: number; r: number }> = [];
            for (let i = 0; i < polar.length; i++) {
              const idx = (startIdx + i) % polar.length;
              let angle = polar[idx]!.angle;
              if (ordered.length > 0 && angle < ordered[ordered.length - 1]!.angle) {
                angle += 2 * Math.PI;
              }
              ordered.push({ angle, r: polar[idx]!.r });
            }
            const avgR = ordered.reduce((s, p) => s + p.r, 0) / ordered.length;
            const minAngle = ordered[0]!.angle;
            const maxAngle = ordered[ordered.length - 1]!.angle;
            const N = 30;
            function arcPath(radius: number): string {
              const points: string[] = [];
              for (let i = 0; i <= N; i++) {
                const a = minAngle + (maxAngle - minAngle) * i / N;
                const x = sharedCenter.x + radius * Math.cos(a);
                const y = sharedCenter.y + radius * Math.sin(a);
                points.push(`${x},${y}`);
              }
              return `M ${points.join(" L ")}`;
            }
            const d = arcPath(avgR);
            const d2 = fan.type === "or" ? arcPath(avgR + 6) : null;
            return (
              <g key={fan.id}>
                <path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeDasharray="5,3" />
                {d2 && <path d={d2} fill="none" stroke={color} strokeWidth={1.5} strokeDasharray="5,3" />}
              </g>
            );
          })}

          {/* Things (on top) */}
          {[...appearances.entries()]
            .sort(([, a], [, b]) => {
              const aIsContainer = a.internal === true && opd?.refines === a.thing;
              const bIsContainer = b.internal === true && opd?.refines === b.thing;
              if (aIsContainer && !bIsContainer) return -1;
              if (!aIsContainer && bIsContainer) return 1;
              return 0;
            })
            .map(([thingId, app]) => {
            const projectedThing = projectedSlice.visualGraph?.thingsById.get(thingId);
            const thing = projectedThing?.thing ?? model.things.get(thingId);
            if (!thing) return null;
            const allStates = statesForThing(model, thingId);
            const states = projectedThing?.visibleStates ?? visibleStatesFor(allStates, thingId);
            const isDragging = draggedThings.has(thingId);
            const isLinkSource = linkSource === thingId;
            const isAppExternal = app.internal === false;
            const isAppContainer = projectedThing?.isContainer ?? (app.internal === true && opd?.refines === thingId);

            let simClass = "";
            let simFilter: string | undefined;
            let simOpacity = 1;
            if (simModelState && thing.kind === "object") {
              const objState = simModelState.objects.get(thingId);
              if (objState && !objState.exists) {
                simClass = " thing-group--sim-consumed";
                simOpacity = 0.3;
              }
            }
            if (simModelState && thing.kind === "process") {
              if (simActiveProcessId === thingId) {
                simClass = " thing-group--sim-active";
                simFilter = "url(#glow-sim-active)";
              } else if (simModelState.waitingProcesses.has(thingId)) {
                simClass = " thing-group--sim-waiting";
                simFilter = "url(#glow-sim-waiting)";
              }
            }

            const simWrapStyle = simOpacity < 1 ? { opacity: simOpacity } : undefined;
            return (
              <g key={thingId} className={simClass || undefined} style={simWrapStyle}>
                <ThingNode
                  thing={thing}
                  appearance={app}
                  states={(isAppContainer && thing.kind === "process") ? [] : states}
                  isSelected={selectedThing === thingId || multiSelect.has(thingId)}
                  isAttention={attentionThingId === thingId}
                  isDragging={isDragging}
                  isLinkSource={isLinkSource}
                  isExternal={isAppExternal && !opd?.refines}
                  isContainer={isAppContainer}
                  isRefined={projectedThing?.isRefined ?? [...model.opds.values()].some(o => o.refines === thingId)}
                  isError={errorEntities?.has(thingId)}
                  isShared={sharedThingIds.has(thingId)}
                  hasSuppressedStates={projectedThing ? projectedThing.hasSuppressedStates : allStates.length > states.length}
                  dragDelta={isDragging ? dragDelta : { x: 0, y: 0 }}
                  simFilter={simFilter}
                  simStatePillOverride={simModelState && thing.kind === "object" ? simModelState.objects.get(thingId)?.currentState : undefined}
                  {...(app.semi_folded && thing.kind === "object" ? (() => {
                    const sf = getSemiFoldedParts(model, thingId);
                    return { semiFoldEntries: sf.visible, semiFoldHidden: sf.hiddenCount };
                  })() : {})}
                  onExtractPart={(partThingId) => {
                    dispatch({ tag: "extractPart", partThingId, opdId, x: app.x + app.w + 40, y: app.y });
                  }}
                  onMouseDown={(e) => onThingMouseDown(thingId, e)}
                  onContextMenu={(e: React.MouseEvent) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setContextMenu({ x: e.clientX, y: e.clientY, thingId });
                    dispatch({ tag: "selectThing", thingId });
                  }}
                  onSelect={() => {
                    if (mode === "addLink") {
                      if (!linkSource) {
                        setLinkSource(thingId);
                        dispatch({ tag: "selectThing", thingId });
                      } else if (linkSource !== thingId || linkType === "invocation") {
                        let resolvedType: string;
                        if (linkType === "auto") {
                          const srcThing = model.things.get(linkSource);
                          const tgtThing = model.things.get(thingId);
                          resolvedType = "agent";
                          if (srcThing?.kind === "process") resolvedType = "effect";
                          if (srcThing?.kind === "object" && tgtThing?.kind === "object") resolvedType = "aggregation";
                        } else {
                          resolvedType = linkType;
                        }
                        dispatch({
                          tag: "addLink",
                          link: {
                            id: genId("lnk"),
                            type: resolvedType as any,
                            source: linkSource,
                            target: thingId,
                          },
                        });
                        setLinkSource(null);
                        dispatch({ tag: "setMode", mode: "select" });
                      }
                      return;
                    }
                    dispatch({ tag: "selectThing", thingId });
                  }}
                  onDoubleClick={() => onThingDoubleClick(thingId)}
                />
              </g>
            );
          })}

          {/* Subprocess execution order indicators */}
          {containerThingId && (() => {
            const opd = model.opds.get(opdId);
            if (!opd || opd.refinement_type !== "in-zoom") return null;
            const subs: Array<{ id: string; name: string; x: number; y: number; w: number; h: number }> = [];
            for (const [id, app] of appearances) {
              if (id === containerThingId) continue;
              const thing = model.things.get(id);
              if (thing?.kind === "process") {
                subs.push({ id, name: thing.name, x: app.x, y: app.y, w: app.w, h: app.h });
              }
            }
            subs.sort((a, b) => a.y - b.y || a.x - b.x);
            if (subs.length < 2) return null;

            const groups: Array<typeof subs> = [];
            for (const s of subs) {
              const last = groups[groups.length - 1];
              if (last && Math.abs(last[0]!.y - s.y) < 10) {
                last.push(s);
              } else {
                groups.push([s]);
              }
            }

            return (
              <g className="subprocess-order">
                {groups.map((group, gi) => group.map((s, si) => (
                  <g key={s.id}>
                    <circle cx={s.x - 12} cy={s.y + s.h / 2} r={8}
                      fill="var(--accent)" opacity={0.8} />
                    <text x={s.x - 12} y={s.y + s.h / 2 + 1} textAnchor="middle"
                      dominantBaseline="central" fontSize={9} fontWeight="bold" fill="white">
                      {gi + 1}{group.length > 1 ? String.fromCharCode(97 + si) : ""}
                    </text>
                  </g>
                )))}
                {groups.slice(0, -1).map((group, gi) => {
                  const nextGroup = groups[gi + 1]!;
                  const fromY = Math.max(...group.map(s => s.y + s.h));
                  const toY = Math.min(...nextGroup.map(s => s.y));
                  const midX = (group[0]!.x + group[0]!.w / 2 + nextGroup[0]!.x + nextGroup[0]!.w / 2) / 2;
                  if (toY - fromY < 10) return null;
                  return (
                    <g key={`seq-${gi}`}>
                      <line x1={midX} y1={fromY + 4} x2={midX} y2={toY - 4}
                        stroke="var(--accent)" strokeWidth={1} strokeDasharray="4,3" opacity={0.5} />
                      <polygon points={`${midX - 3},${toY - 8} ${midX + 3},${toY - 8} ${midX},${toY - 3}`}
                        fill="var(--accent)" opacity={0.5} />
                    </g>
                  );
                })}
              </g>
            );
          })()}

          {/* Implicit things (ghosts) */}
          {showGhosts && [...(projectedSlice.visualGraph?.thingsById.entries() ?? [])]
            .filter(([, entry]) => entry.implicit)
            .map(([thingId, entry]) => {
            const thing = model.things.get(thingId);
            if (!thing) return null;
            const app = entry.appearance;
            const allStates = statesForThing(model, thingId);
            const states = visibleStatesFor(allStates, thingId);
            return (
              <g key={`implicit-${thingId}`} style={{ opacity: 0.4 }}>
                <ThingNode
                  thing={thing}
                  appearance={app}
                  states={states}
                  isSelected={false}
                  isDragging={false}
                  isLinkSource={false}
                  isExternal={false}
                  isContainer={false}
                  isRefined={false}
                  isImplicit={true}
                  dragDelta={{ x: 0, y: 0 }}
                  onMouseDown={() => {}}
                  onSelect={() => dispatch({ tag: "selectThing", thingId })}
                  onDoubleClick={() => {}}
                />
              </g>
            );
          })}
          {showGhosts && !projectedSlice.visualGraph && [...fiber.things.entries()]
            .filter(([, entry]) => entry.implicit)
            .map(([thingId, entry]) => {
            const { thing, appearance: app } = entry;
            const allStates = statesForThing(model, thingId);
            const states = visibleStatesFor(allStates, thingId);
            return (
              <g key={`implicit-fallback-${thingId}`} style={{ opacity: 0.4 }}>
                <ThingNode
                  thing={thing}
                  appearance={app}
                  states={states}
                  isSelected={false}
                  isDragging={false}
                  isLinkSource={false}
                  isExternal={false}
                  isContainer={false}
                  isRefined={false}
                  isImplicit={true}
                  dragDelta={{ x: 0, y: 0 }}
                  onMouseDown={() => {}}
                  onSelect={() => dispatch({ tag: "selectThing", thingId })}
                  onDoubleClick={() => {}}
                />
              </g>
            );
          })}

          {/* Resize handles */}
          {selectedThing && !simulation && mode === "select" && (() => {
            const app = appearances.get(selectedThing);
            if (!app) return null;
            const thing = model.things.get(selectedThing);
            if (!thing) return null;
            const allStates = statesForThing(model, selectedThing);
            const visStates = visibleStatesFor(allStates, selectedThing);
            const extraH = visStates.length > 0 ? 24 : 0;
            const rx = resizeTarget === selectedThing ? resizeDelta.x : 0;
            const ry = resizeTarget === selectedThing ? resizeDelta.y : 0;
            let { x, y, w, h } = app;
            h += extraH;
            if (resizeTarget === selectedThing && resizeHandle) {
              if (resizeHandle === "se") { w += rx; h += ry; }
              else if (resizeHandle === "sw") { x += rx; w -= rx; h += ry; }
              else if (resizeHandle === "ne") { w += rx; y += ry; h -= ry; }
              else if (resizeHandle === "nw") { x += rx; y += ry; w -= rx; h -= ry; }
              w = Math.max(60, w); h = Math.max(30, h);
            }
            const S = 6;
            const handles: Array<{ hx: number; hy: number; handle: ResizeHandle; cursor: string }> = [
              { hx: x - S / 2, hy: y - S / 2, handle: "nw", cursor: "nwse-resize" },
              { hx: x + w - S / 2, hy: y - S / 2, handle: "ne", cursor: "nesw-resize" },
              { hx: x - S / 2, hy: y + h - S / 2, handle: "sw", cursor: "nesw-resize" },
              { hx: x + w - S / 2, hy: y + h - S / 2, handle: "se", cursor: "nwse-resize" },
            ];
            return (
              <g>
                {handles.map(({ hx, hy, handle, cursor }) => (
                  <rect
                    key={handle}
                    className="resize-handle"
                    x={hx} y={hy} width={S} height={S}
                    fill="var(--accent)" stroke="white" strokeWidth={1}
                    style={{ cursor }}
                    onMouseDown={(e) => onResizeHandleMouseDown(selectedThing, handle, e)}
                  />
                ))}
              </g>
            );
          })()}

          {/* Lasso selection rectangle */}
          {lasso && (
            <rect
              className="lasso-rect"
              x={Math.min(lasso.x1, lasso.x2)}
              y={Math.min(lasso.y1, lasso.y2)}
              width={Math.abs(lasso.x2 - lasso.x1)}
              height={Math.abs(lasso.y2 - lasso.y1)}
            />
          )}

          {/* Inline rename overlay */}
          {renaming && (() => {
            const app = appearances.get(renaming);
            const thing = model.things.get(renaming);
            if (!app || !thing) return null;
            return (
              <InlineRename
                x={app.x}
                y={app.y + app.h / 2 - 13}
                width={app.w}
                currentName={thing.name}
                onCommit={commitRename}
                onCancel={() => setRenaming(null)}
              />
            );
          })()}
        </g>
      </svg>
    </div>
  );
}
