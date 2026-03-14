import { useRef, useState, useCallback, useMemo, useEffect } from "react";
import type { Model, Thing, State, Link, Appearance, Modifier, OPD } from "@opmodel/core";
import { createInitialState, type ModelState } from "@opmodel/core";
import type { Command, EditorMode, LinkTypeChoice, SimulationUIState } from "../lib/commands";
import { genId } from "../lib/ids";
import {
  center,
  rectEdgePoint,
  ellipseEdgePoint,
  midpoint,
  type Point,
  type Rect,
} from "../lib/geometry";

/* ─── Props ─── */

interface Props {
  model: Model;
  opdId: string;
  selectedThing: string | null;
  mode: EditorMode;
  linkType: LinkTypeChoice;
  dispatch: (cmd: Command) => boolean;
  simulation: SimulationUIState | null;
}

/* ─── Breadcrumb: OPD ancestor chain ─── */

function opdAncestors(model: Model, opdId: string): OPD[] {
  const chain: OPD[] = [];
  let current = model.opds.get(opdId);
  while (current) {
    chain.unshift(current);
    current = current.parent_opd ? model.opds.get(current.parent_opd) : undefined;
  }
  return chain;
}

/* ─── Link type → color mapping ─── */

const LINK_COLORS: Record<string, string> = {
  agent: "#2b6cb0",
  instrument: "#2b6cb0",
  consumption: "#16794a",
  effect: "#16794a",
  result: "#16794a",
  input: "#2b6cb0",
  output: "#16794a",
  aggregation: "#6b5fad",
  exhibition: "#6b5fad",
  generalization: "#6b5fad",
  classification: "#6b5fad",
  invocation: "#c05621",
  exception: "#c05621",
};

/* ─── Helpers ─── */

function edgePoint(kind: "object" | "process", rect: Rect, target: Point): Point {
  return kind === "process" ? ellipseEdgePoint(rect, target) : rectEdgePoint(rect, target);
}

function statesForThing(model: Model, thingId: string): State[] {
  return [...model.states.values()]
    .filter((s) => s.parent === thingId)
    .sort((a, b) => {
      if (a.initial && !b.initial) return -1;
      if (!a.initial && b.initial) return 1;
      return a.name.localeCompare(b.name);
    });
}

/* ─── SVG Defs ─── */

function SvgDefs() {
  return (
    <defs>
      <pattern id="grid-dots" width="20" height="20" patternUnits="userSpaceOnUse">
        <circle cx="10" cy="10" r="0.6" fill="rgba(0,0,0,0.06)" />
      </pattern>

      <marker id="arrow-proc" viewBox="0 0 10 8" refX="10" refY="4" markerWidth="8" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L10,4 L0,8Z" fill="#16794a" />
      </marker>
      <marker id="arrow-enabling" viewBox="0 0 10 8" refX="10" refY="4" markerWidth="8" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L10,4 L0,8Z" fill="#2b6cb0" />
      </marker>
      <marker id="arrow-struct" viewBox="0 0 10 8" refX="10" refY="4" markerWidth="8" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L10,4 L0,8" fill="none" stroke="#6b5fad" strokeWidth="1.5" />
      </marker>
      <marker id="arrow-control" viewBox="0 0 10 8" refX="10" refY="4" markerWidth="8" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L10,4 L0,8Z" fill="#c05621" />
      </marker>

      <marker id="dot-consumption" viewBox="0 0 8 8" refX="4" refY="4" markerWidth="6" markerHeight="6" orient="auto">
        <circle cx="4" cy="4" r="3" fill="#16794a" />
      </marker>

      <filter id="glow-selected" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feFlood floodColor="#2b6cb0" floodOpacity="0.25" />
        <feComposite in2="blur" operator="in" />
        <feMerge>
          <feMergeNode />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      <filter id="glow-drag" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="5" result="blur" />
        <feFlood floodColor="#2b6cb0" floodOpacity="0.35" />
        <feComposite in2="blur" operator="in" />
        <feMerge>
          <feMergeNode />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      <filter id="glow-sim-active" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="4" result="blur" />
        <feFlood floodColor="#16794a" floodOpacity="0.3" />
        <feComposite in2="blur" operator="in" />
        <feMerge>
          <feMergeNode />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      <filter id="glow-sim-waiting" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feFlood floodColor="#c05621" floodOpacity="0.25" />
        <feComposite in2="blur" operator="in" />
        <feMerge>
          <feMergeNode />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  );
}

/* ─── Inline Rename Input ─── */

function InlineRename({
  x,
  y,
  width,
  currentName,
  onCommit,
  onCancel,
}: {
  x: number;
  y: number;
  width: number;
  currentName: string;
  onCommit: (name: string) => void;
  onCancel: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = inputRef.current;
    if (el) {
      el.focus();
      el.select();
    }
  }, []);

  return (
    <foreignObject x={x} y={y} width={width} height={26}>
      <input
        ref={inputRef}
        className="inline-rename"
        defaultValue={currentName}
        onBlur={(e) => {
          const val = e.target.value.trim();
          if (val && val !== currentName) onCommit(val);
          else onCancel();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            const val = (e.target as HTMLInputElement).value.trim();
            if (val && val !== currentName) onCommit(val);
            else onCancel();
          }
          if (e.key === "Escape") onCancel();
        }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      />
    </foreignObject>
  );
}

/* ─── Thing Renderer ─── */

function ThingNode({
  thing,
  appearance,
  states,
  isSelected,
  isDragging,
  isLinkSource,
  isExternal,
  isContainer,
  dragDelta,
  simFilter,
  simStatePillOverride,
  onMouseDown,
  onSelect,
  onDoubleClick,
}: {
  thing: Thing;
  appearance: Appearance;
  states: State[];
  isSelected: boolean;
  isDragging: boolean;
  isLinkSource: boolean;
  isExternal: boolean;
  isContainer: boolean;
  dragDelta: Point;
  simFilter?: string;
  simStatePillOverride?: string;
  onMouseDown: (e: React.MouseEvent) => void;
  onSelect: () => void;
  onDoubleClick: () => void;
}) {
  const ox = isDragging ? dragDelta.x : 0;
  const oy = isDragging ? dragDelta.y : 0;
  const x = appearance.x + ox;
  const y = appearance.y + oy;
  const { w, h } = appearance;
  const hasStates = states.length > 0;
  const extraH = hasStates ? 24 : 0;
  const totalH = h + extraH;

  const strokeColor = isExternal
    ? "var(--text-muted)"
    : thing.kind === "process" ? "var(--process-stroke)" : "var(--object-stroke)";
  const isPhysical = thing.essence === "physical";
  const fillColor = isContainer
    ? "rgba(43, 108, 176, 0.03)"
    : isExternal
      ? "var(--bg-panel)"
      : thing.kind === "process"
        ? (isPhysical ? "var(--process-fill-physical)" : "var(--process-fill)")
        : (isPhysical ? "var(--object-fill-physical)" : "var(--object-fill)");
  const strokeWidth = isContainer ? 2.0 : isExternal ? 1.0 : isPhysical ? 3.5 : 1.2;
  const strokeDash = isExternal ? "4,3" : thing.affiliation === "environmental" ? "6,3" : undefined;

  const filterStr = isDragging
    ? "url(#glow-drag)"
    : simFilter
      ? simFilter
      : isSelected
        ? "url(#glow-selected)"
        : undefined;

  const className = `thing-group${isSelected ? " thing-group--selected" : ""}${isDragging ? " thing-group--dragging" : ""}${isLinkSource ? " thing-group--link-source" : ""}`;

  return (
    <g
      className={className}
      filter={filterStr}
      onMouseDown={(e) => {
        e.stopPropagation();
        onMouseDown(e);
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onDoubleClick();
      }}
    >
      {thing.kind === "process" ? (
        <ellipse
          className="thing-shape"
          cx={x + w / 2}
          cy={y + totalH / 2}
          rx={w / 2}
          ry={totalH / 2}
          fill={fillColor}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDash}
        />
      ) : (
        <rect
          className="thing-shape"
          x={x}
          y={y}
          width={w}
          height={totalH}
          rx={3}
          ry={3}
          fill={fillColor}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDash}
        />
      )}

      <text
        className={`thing-label${thing.kind === "process" ? " thing-label--process" : ""}${isContainer ? " thing-label--container" : ""}`}
        x={x + w / 2}
        y={isContainer ? y + 16 : y + (hasStates ? h / 2 - 2 : totalH / 2)}
      >
        {thing.name}
      </text>
      {isExternal && (
        <text className="thing-badge-external" x={x + w - 8} y={y + 12}>↑</text>
      )}

      {hasStates && (
        <g>
          {states.map((state, i) => {
            const pillW = Math.min(50, (w - 12) / states.length - 4);
            const pillH = 16;
            const totalPillW = states.length * (pillW + 4) - 4;
            const startX = x + (w - totalPillW) / 2;
            const px = startX + i * (pillW + 4);
            const py = y + h - 4;
            const isCurrent = simStatePillOverride
              ? state.id === simStatePillOverride
              : state.current === true;
            const isSimCurrent = simStatePillOverride ? state.id === simStatePillOverride : false;

            return (
              <g key={state.id}>
                <rect
                  className={`state-pill${isSimCurrent ? " state-pill--sim-current" : ""}`}
                  x={px}
                  y={py}
                  width={pillW}
                  height={pillH}
                  fill={isCurrent ? "var(--state-current-bg)" : "var(--state-bg)"}
                  stroke={isCurrent ? "var(--accent)" : "var(--state-border)"}
                  strokeWidth={1}
                />
                <text
                  className={`state-label${isCurrent ? " state-label--current" : ""}`}
                  x={px + pillW / 2}
                  y={py + pillH / 2}
                >
                  {state.name}
                </text>
              </g>
            );
          })}
        </g>
      )}
    </g>
  );
}

/* ─── Link Renderer ─── */

function LinkLine({
  link,
  sourceRect,
  targetRect,
  sourceKind,
  targetKind,
  modifier,
}: {
  link: Link;
  sourceRect: Rect;
  targetRect: Rect;
  sourceKind: "object" | "process";
  targetKind: "object" | "process";
  modifier?: Modifier;
}) {
  const srcCenter = center(sourceRect);
  const tgtCenter = center(targetRect);
  const p1 = edgePoint(sourceKind, sourceRect, tgtCenter);
  const p2 = edgePoint(targetKind, targetRect, srcCenter);
  const mid = midpoint(p1, p2);
  const color = LINK_COLORS[link.type] ?? "#505878";

  const arrowId =
    link.type === "aggregation" || link.type === "exhibition" || link.type === "generalization" || link.type === "classification"
      ? "arrow-struct"
      : link.type === "invocation" || link.type === "exception"
        ? "arrow-control"
        : link.type === "agent" || link.type === "instrument" || link.type === "input"
          ? "arrow-enabling"
          : "arrow-proc";

  return (
    <g>
      <line
        className="link-line"
        x1={p1.x}
        y1={p1.y}
        x2={p2.x}
        y2={p2.y}
        stroke={color}
        markerEnd={`url(#${arrowId})`}
        markerStart={link.type === "consumption" ? "url(#dot-consumption)" : undefined}
      />
      <text className="link-label" x={mid.x} y={mid.y - 7}>
        {link.type}
      </text>
      {modifier && (
        <text className="modifier-badge" x={mid.x} y={mid.y + 8}>
          [{modifier.type}]
        </text>
      )}
    </g>
  );
}

/* ─── Main Canvas Component ─── */

export function OpdCanvas({ model, opdId, selectedThing, mode, linkType, dispatch, simulation }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [pan, setPan] = useState({ x: 40, y: 20 });
  const [zoom, setZoom] = useState(1);

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

  // Inline rename state
  const [renaming, setRenaming] = useState<string | null>(null);

  // Link creation state
  const [linkSource, setLinkSource] = useState<string | null>(null);

  // Reset linkSource when mode changes away from addLink
  useEffect(() => {
    if (mode !== "addLink") setLinkSource(null);
  }, [mode]);

  // Collect appearances for this OPD
  const appearances = useMemo(() => {
    const map = new Map<string, Appearance>();
    for (const app of model.appearances.values()) {
      if (app.opd === opdId) map.set(app.thing, app);
    }
    return map;
  }, [model, opdId]);

  // Collect visible links
  const visibleLinks = useMemo(() => {
    const links: { link: Link; modifier?: Modifier }[] = [];
    for (const link of model.links.values()) {
      if (appearances.has(link.source) && appearances.has(link.target)) {
        const mod = [...model.modifiers.values()].find((m) => m.over === link.id);
        links.push({ link, modifier: mod });
      }
    }
    return links;
  }, [model, opdId, appearances]);

  // Convert client coords to SVG model coords
  const clientToModel = useCallback(
    (clientX: number, clientY: number): Point => {
      return {
        x: (clientX - pan.x) / zoom,
        y: (clientY - pan.y) / zoom,
      };
    },
    [pan, zoom],
  );

  /* ─── Mouse handlers ─── */

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      // Only start pan if not dragging a thing
      setPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    },
    [pan],
  );

  const onThingMouseDown = useCallback(
    (thingId: string, e: React.MouseEvent) => {
      if (e.button !== 0) return;
      if (simulation) {
        // During simulation: only allow select, not drag
        dispatch({ tag: "selectThing", thingId });
        return;
      }
      e.stopPropagation();
      const svgRect = svgRef.current?.getBoundingClientRect();
      if (!svgRect) return;
      setDragTarget(thingId);
      setDragDelta({ x: 0, y: 0 });
      setDragOrigin({ x: e.clientX, y: e.clientY });
      setPanning(false);
      dispatch({ tag: "selectThing", thingId });
    },
    [dispatch, simulation],
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
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
    [dragTarget, dragOrigin, zoom, panning, panStart],
  );

  const onMouseUp = useCallback(() => {
    if (dragTarget) {
      // Commit drag as a single model mutation
      const app = appearances.get(dragTarget);
      if (app && (Math.abs(dragDelta.x) > 1 || Math.abs(dragDelta.y) > 1)) {
        dispatch({
          tag: "moveThing",
          thingId: dragTarget,
          opdId,
          x: Math.round(app.x + dragDelta.x),
          y: Math.round(app.y + dragDelta.y),
        });
      }
      setDragTarget(null);
      setDragDelta({ x: 0, y: 0 });
      return;
    }
    setPanning(false);
  }, [dragTarget, dragDelta, appearances, opdId, dispatch]);

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
          x: Math.round(x - 60),
          y: Math.round(y - 25),
          w: 120,
          h: 50,
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
      setRenaming(null);
    },
    [dragTarget, simulation, mode, pan, zoom, opdId, dispatch],
  );

  const onThingDoubleClick = useCallback((thingId: string) => {
    if (simulation) return; // No rename during simulation
    setRenaming(thingId);
  }, [simulation]);

  const commitRename = useCallback(
    (name: string) => {
      if (renaming) {
        dispatch({ tag: "renameThing", thingId: renaming, name });
      }
      setRenaming(null);
    },
    [renaming, dispatch],
  );

  const opd = model.opds.get(opdId);

  // Build effective rects for links, accounting for drag delta
  const getEffectiveRect = useCallback(
    (thingId: string): Rect | null => {
      const app = appearances.get(thingId);
      if (!app) return null;
      const states = statesForThing(model, thingId);
      const ox = dragTarget === thingId ? dragDelta.x : 0;
      const oy = dragTarget === thingId ? dragDelta.y : 0;
      return {
        x: app.x + ox,
        y: app.y + oy,
        w: app.w,
        h: app.h + (states.length > 0 ? 24 : 0),
      };
    },
    [appearances, model, dragTarget, dragDelta],
  );

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
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onWheel={onWheel}
        onClick={onCanvasClick}
      >
        <SvgDefs />

        <rect width="100%" height="100%" fill="var(--bg-canvas)" />
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          <rect x="-500" y="-500" width="3000" height="3000" fill="url(#grid-dots)" />

          {/* Links (behind things) — re-route during drag */}
          {visibleLinks.map(({ link, modifier }) => {
            const srcRect = getEffectiveRect(link.source);
            const tgtRect = getEffectiveRect(link.target);
            const srcThing = model.things.get(link.source);
            const tgtThing = model.things.get(link.target);
            if (!srcRect || !tgtRect || !srcThing || !tgtThing) return null;

            let linkSimClass = "";
            if (simModelState) {
              const isActiveLink = simActiveProcessId && (link.source === simActiveProcessId || link.target === simActiveProcessId);
              if (isActiveLink) {
                linkSimClass = " link-line--sim-active";
              } else {
                const srcObj = simModelState.objects.get(link.source);
                const tgtObj = simModelState.objects.get(link.target);
                if ((srcObj && !srcObj.exists) || (tgtObj && !tgtObj.exists)) {
                  linkSimClass = " link-line--sim-dimmed";
                }
              }
            }

            return (
              <g key={link.id} className={linkSimClass || undefined}>
                <LinkLine
                  link={link}
                  sourceRect={srcRect}
                  targetRect={tgtRect}
                  sourceKind={srcThing.kind}
                  targetKind={tgtThing.kind}
                  modifier={modifier}
                />
              </g>
            );
          })}

          {/* Things (on top) — container first (behind), then others */}
          {[...appearances.entries()]
            .sort(([, a], [, b]) => {
              // Render the container (refined thing) first so it appears behind other things
              const aIsContainer = a.internal === true && opd?.refines === a.thing;
              const bIsContainer = b.internal === true && opd?.refines === b.thing;
              if (aIsContainer && !bIsContainer) return -1;
              if (!aIsContainer && bIsContainer) return 1;
              return 0;
            })
            .map(([thingId, app]) => {
            const thing = model.things.get(thingId);
            if (!thing) return null;
            const states = statesForThing(model, thingId);
            const isDragging = dragTarget === thingId;
            const isLinkSource = linkSource === thingId;
            const isAppExternal = app.internal === false;
            const isAppContainer = app.internal === true && opd?.refines === thingId;

            // Simulation visual overlay
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
                  states={isAppContainer ? [] : states}
                  isSelected={selectedThing === thingId}
                  isDragging={isDragging}
                  isLinkSource={isLinkSource}
                  isExternal={isAppExternal}
                  isContainer={isAppContainer}
                  dragDelta={isDragging ? dragDelta : { x: 0, y: 0 }}
                  simFilter={simFilter}
                  simStatePillOverride={simModelState && thing.kind === "object" ? simModelState.objects.get(thingId)?.currentState : undefined}
                  onMouseDown={(e) => onThingMouseDown(thingId, e)}
                  onSelect={() => {
                    if (mode === "addLink") {
                      if (!linkSource) {
                        setLinkSource(thingId);
                        dispatch({ tag: "selectThing", thingId });
                      } else if (linkSource !== thingId) {
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
