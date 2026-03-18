import { useRef, useState, useCallback, useMemo, useEffect } from "react";
import type { Model, Thing, State, Link, Appearance, Modifier, OPD } from "@opmodel/core";
import { createInitialState, resolveLinksForOpd, findConsumptionResultPairs, transformingMode, type ModelState } from "@opmodel/core";
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
  tagged: "#6b5fad",
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

/* State pill rect — matches ThingNode rendering layout exactly */
function statePillRect(
  app: { x: number; y: number; w: number; h: number },
  visibleStates: State[],
  stateId: string,
): Rect | null {
  const idx = visibleStates.findIndex((s) => s.id === stateId);
  if (idx === -1) return null;
  const pillW = Math.min(50, (app.w - 12) / visibleStates.length - 4);
  const pillH = 16;
  const totalPillW = visibleStates.length * (pillW + 4) - 4;
  const startX = app.x + (app.w - totalPillW) / 2;
  return {
    x: startX + idx * (pillW + 4),
    y: app.y + app.h - 4,
    w: pillW,
    h: pillH,
  };
}

/* ─── DA-8: Adjust effect link endpoints per transformingMode ─── */

function adjustEffectEndpoints(
  entries: {
    link: Link;
    modifier: Modifier | undefined;
    visualSource: string;
    visualTarget: string;
    labelOverride: string | undefined;
    isMergedPair: boolean;
    isInputHalf?: boolean;
    isOutputHalf?: boolean;
  }[],
  model: Model,
) {
  return entries.flatMap(entry => {
    const mode = transformingMode(entry.link);
    if (!mode || mode === "effect") return [entry];

    // Resolve object/process endpoints (I-33 guarantees object↔process)
    const srcThing = model.things.get(entry.visualSource);
    const objectId = srcThing?.kind === "object" ? entry.visualSource : entry.visualTarget;
    const processId = srcThing?.kind === "process" ? entry.visualSource : entry.visualTarget;

    switch (mode) {
      case "input-specified":
        return [
          {
            ...entry,
            link: { ...entry.link },
            visualSource: objectId,
            visualTarget: processId,
            isInputHalf: true as const,
          },
          {
            ...entry,
            link: { ...entry.link, source_state: undefined },
            visualSource: processId,
            visualTarget: objectId,
            isOutputHalf: true as const,
          },
        ];

      case "output-specified":
        return [
          {
            ...entry,
            link: { ...entry.link, target_state: undefined },
            visualSource: objectId,
            visualTarget: processId,
            isInputHalf: true as const,
          },
          {
            ...entry,
            link: { ...entry.link },
            visualSource: processId,
            visualTarget: objectId,
            isOutputHalf: true as const,
          },
        ];

      case "input-output":
        return [
          {
            ...entry,
            link: { ...entry.link, target_state: undefined },
            visualSource: objectId,
            visualTarget: processId,
            isInputHalf: true as const,
          },
          {
            ...entry,
            link: { ...entry.link, source_state: undefined },
            visualSource: processId,
            visualTarget: objectId,
            isOutputHalf: true as const,
          },
        ];

      default:
        return [entry];
    }
  });
}

/* ─── SVG Defs ─── */

function SvgDefs() {
  return (
    <defs>
      <pattern id="grid-dots" width="20" height="20" patternUnits="userSpaceOnUse">
        <circle cx="10" cy="10" r="0.6" fill="rgba(0,0,0,0.06)" />
      </pattern>

      {/* Procedural transforming: filled arrowhead (consumption→, result→, effect↔) */}
      <marker id="arrow-proc" viewBox="0 0 10 8" refX="10" refY="4" markerWidth="8" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L10,4 L0,8Z" fill="#16794a" />
      </marker>

      {/* Enabling: Agent = filled circle ● (ISO §8.1.1) */}
      <marker id="dot-agent" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="8" markerHeight="8" orient="auto">
        <circle cx="5" cy="5" r="4" fill="#2b6cb0" />
      </marker>

      {/* Enabling: Instrument = hollow circle ○ (ISO §8.1.2) */}
      <marker id="circle-instrument" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="8" markerHeight="8" orient="auto">
        <circle cx="5" cy="5" r="3.5" fill="white" stroke="#2b6cb0" strokeWidth="1.5" />
      </marker>

      {/* Structural: Aggregation = filled triangle ▲ (ISO §6) */}
      <marker id="triangle-filled" viewBox="0 0 12 12" refX="12" refY="6" markerWidth="12" markerHeight="12" orient="auto-start-reverse">
        <path d="M0,0 L12,6 L0,12Z" fill="#6b5fad" />
      </marker>

      {/* Structural: Exhibition = filled triangle with inner line (ISO §6) */}
      <marker id="triangle-exhibit" viewBox="0 0 12 12" refX="12" refY="6" markerWidth="12" markerHeight="12" orient="auto-start-reverse">
        <path d="M0,0 L12,6 L0,12Z" fill="#6b5fad" />
        <line x1="3" y1="4" x2="3" y2="8" stroke="white" strokeWidth="1.5" />
      </marker>

      {/* Structural: Generalization = open triangle △ (ISO §6) */}
      <marker id="triangle-open" viewBox="0 0 12 12" refX="12" refY="6" markerWidth="12" markerHeight="12" orient="auto-start-reverse">
        <path d="M0,0 L12,6 L0,12Z" fill="white" stroke="#6b5fad" strokeWidth="1.5" />
      </marker>

      {/* Structural: Classification = open triangle on baseline (ISO §6) */}
      <marker id="triangle-classify" viewBox="0 0 14 14" refX="14" refY="7" markerWidth="14" markerHeight="14" orient="auto-start-reverse">
        <path d="M0,2 L12,7 L0,12Z" fill="white" stroke="#6b5fad" strokeWidth="1.5" />
        <line x1="0" y1="12" x2="12" y2="12" stroke="#6b5fad" strokeWidth="1.5" />
      </marker>

      {/* Structural: Tagged = purple arrow (ISO §10.2) */}
      <marker id="arrow-tagged" viewBox="0 0 10 8" refX="10" refY="4" markerWidth="8" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L10,4 L0,8Z" fill="#6b5fad" />
      </marker>

      {/* Control: invocation/exception = filled arrowhead */}
      <marker id="arrow-control" viewBox="0 0 10 8" refX="10" refY="4" markerWidth="8" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L10,4 L0,8Z" fill="#c05621" />
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

  // ISO 19450: color always follows kind (object=green, process=blue), regardless of external/container
  const strokeColor = thing.kind === "process" ? "var(--process-stroke)" : "var(--object-stroke)";
  const isPhysical = thing.essence === "physical";
  const kindFill = thing.kind === "process"
    ? (isPhysical ? "var(--process-fill-physical)" : "var(--process-fill)")
    : (isPhysical ? "var(--object-fill-physical)" : "var(--object-fill)");
  const fillColor = kindFill;
  const strokeWidth = isContainer ? 2.0 : isExternal ? 1.0 : isPhysical ? 3.5 : 1.2;
  const strokeDash = thing.affiliation === "environmental" ? "6,3" : undefined;

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
  labelOverride,
  isMergedPair,
  isInputHalf,
  isOutputHalf,
}: {
  link: Link;
  sourceRect: Rect;
  targetRect: Rect;
  sourceKind: "object" | "process";
  targetKind: "object" | "process";
  modifier?: Modifier;
  labelOverride?: string;
  isMergedPair?: boolean;
  isInputHalf?: boolean;
  isOutputHalf?: boolean;
}) {
  const srcCenter = center(sourceRect);
  const tgtCenter = center(targetRect);
  const p1 = edgePoint(sourceKind, sourceRect, tgtCenter);
  const p2 = edgePoint(targetKind, targetRect, srcCenter);
  const mid = midpoint(p1, p2);
  const color = LINK_COLORS[link.type] ?? "#505878";

  // ISO 19450 marker assignment per link type
  let markerEnd: string | undefined;
  let markerStart: string | undefined;

  if (isMergedPair) {
    // DA-7 merged consumption+result: arrows at both ends (process→object direction)
    markerEnd = "url(#arrow-proc)";
    markerStart = "url(#arrow-proc)";
  } else switch (link.type) {
    // Enabling links: ISO §8.1 — circle markers at process end
    case "agent":
      markerEnd = "url(#dot-agent)";       // ● filled circle
      break;
    case "instrument":
      markerEnd = "url(#circle-instrument)"; // ○ hollow circle
      break;
    // Transforming links: ISO §7.2
    case "consumption":
    case "result":
      markerEnd = "url(#arrow-proc)";       // → single arrowhead
      break;
    case "effect": {
      const isDirected = isInputHalf || isOutputHalf;
      if (isDirected) {
        markerEnd = "url(#arrow-proc)";       // → unidirectional
      } else {
        markerEnd = "url(#arrow-proc)";       // ↔ bidirectional
        markerStart = "url(#arrow-proc)";
      }
      break;
    }
    case "input":
      markerEnd = "url(#arrow-proc)";
      break;
    case "output":
      markerEnd = "url(#arrow-proc)";
      break;
    // Structural links: ISO §6 — distinct markers per type
    case "aggregation":
      markerEnd = "url(#triangle-filled)";    // ▲ filled triangle
      break;
    case "exhibition":
      markerEnd = "url(#triangle-exhibit)";   // ▲ filled + inner line
      break;
    case "generalization":
      markerEnd = "url(#triangle-open)";      // △ open triangle
      break;
    case "classification":
      markerEnd = "url(#triangle-classify)";  // △ open + baseline
      break;
    case "tagged": {
      markerEnd = "url(#arrow-tagged)";       // → structural purple
      if (link.direction === "bidirectional" || link.direction === "reciprocal") {
        markerStart = "url(#arrow-tagged)";   // ↔
      }
      break;
    }
    // Control links
    case "invocation":
    case "exception":
      markerEnd = "url(#arrow-control)";
      break;
    default:
      markerEnd = "url(#arrow-proc)";
  }

  return (
    <g>
      <line
        className="link-line"
        x1={p1.x}
        y1={p1.y}
        x2={p2.x}
        y2={p2.y}
        stroke={color}
        markerEnd={markerEnd}
        markerStart={markerStart}
      />
      <text className="link-label" x={mid.x} y={mid.y - 7}>
        {labelOverride ?? (link.type === "tagged" && link.tag ? link.tag : link.type)}
      </text>
      {modifier && (
        <text className="modifier-badge" x={mid.x} y={mid.y + 8}>
          {modifier.type === "event" ? "e" : "c"}
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

  // Container drag coupling: when dragging the container of an in-zoom OPD,
  // all internal things move together (ISO: container encapsulates contents).
  const containerThingId = useMemo(() => {
    const opd = model.opds.get(opdId);
    return opd?.refines ?? null;
  }, [model, opdId]);

  // Set of things that move during drag (container + all siblings, or just the single thing)
  const draggedThings = useMemo(() => {
    if (!dragTarget) return new Set<string>();
    if (dragTarget === containerThingId) {
      // Container drag: move all things in this OPD
      const set = new Set<string>();
      for (const app of model.appearances.values()) {
        if (app.opd === opdId) set.add(app.thing);
      }
      return set;
    }
    return new Set([dragTarget]);
  }, [dragTarget, containerThingId, model, opdId]);

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

  // Collect visible links (with endpoint resolution for in-zoom containers)
  const visibleLinks = useMemo(() => {
    const resolved = resolveLinksForOpd(model, opdId);
    const entries = resolved.map(rl => ({
      link: rl.link,
      modifier: [...model.modifiers.values()].find((m) => m.over === rl.link.id),
      visualSource: rl.visualSource,
      visualTarget: rl.visualTarget,
      labelOverride: undefined as string | undefined,
      isMergedPair: false,
    }));

    // Merge consumption+result pairs into single visual link (DA-7).
    // Keeps type as "consumption" — NOT "effect". Marked as mergedPair for distinct rendering.
    const pairs = findConsumptionResultPairs(model, resolved);
    const consumptionIds = new Set(pairs.map(p => p.consumptionLink.id));
    const resultIds = new Set(pairs.map(p => p.resultLink.id));

    // Build a lookup from consumption link ID → merged visual entry
    const mergedEntries = new Map<string, typeof entries[number]>();
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
  }, [model, opdId]);

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
      if (Math.abs(dragDelta.x) > 1 || Math.abs(dragDelta.y) > 1) {
        if (draggedThings.size > 1) {
          // Container drag: batch-move all things in the OPD
          const moves: Array<{ thingId: string; opdId: string; x: number; y: number }> = [];
          for (const thingId of draggedThings) {
            const app = appearances.get(thingId);
            if (app) {
              moves.push({ thingId, opdId, x: Math.round(app.x + dragDelta.x), y: Math.round(app.y + dragDelta.y) });
            }
          }
          if (moves.length > 0) dispatch({ tag: "moveThings", moves });
        } else {
          // Single thing drag
          const app = appearances.get(dragTarget);
          if (app) {
            dispatch({ tag: "moveThing", thingId: dragTarget, opdId, x: Math.round(app.x + dragDelta.x), y: Math.round(app.y + dragDelta.y) });
          }
        }
      }
      setDragTarget(null);
      setDragDelta({ x: 0, y: 0 });
      return;
    }
    setPanning(false);
  }, [dragTarget, dragDelta, draggedThings, appearances, opdId, dispatch]);

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
      const ox = draggedThings.has(thingId) ? dragDelta.x : 0;
      const oy = draggedThings.has(thingId) ? dragDelta.y : 0;
      return {
        x: app.x + ox,
        y: app.y + oy,
        w: app.w,
        h: app.h + (states.length > 0 ? 24 : 0),
      };
    },
    [appearances, model, draggedThings, dragDelta],
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
          {visibleLinks.map(({ link, modifier, visualSource, visualTarget, labelOverride, isMergedPair, isInputHalf, isOutputHalf }) => {
            let srcRect = getEffectiveRect(visualSource);
            let tgtRect = getEffectiveRect(visualTarget);
            const srcThing = model.things.get(visualSource);
            const tgtThing = model.things.get(visualTarget);
            if (!srcRect || !tgtRect || !srcThing || !tgtThing) return null;

            // Route to state pill when link has source_state/target_state
            // Use drag-adjusted position so pills follow the thing during drag
            //
            // For effect links, both source_state (FROM) and target_state (TO) refer to the
            // OBJECT endpoint, not to the link's source/target. Route the object end to
            // source_state (the pre-condition state) only.
            let srcKindOverride: "object" | "process" | undefined;
            let tgtKindOverride: "object" | "process" | undefined;

            if (link.type === "effect" || isMergedPair) {
              // Effect / merged consumption+result: route state-specified endpoints to pills
              const objectEnd = srcThing.kind === "object" ? visualSource : visualTarget;
              // Route source_state (FROM state) to object endpoint — used by isInputHalf and basic effect
              if (link.source_state) {
                const objApp = appearances.get(objectEnd);
                if (objApp) {
                  const ox = draggedThings.has(objectEnd) ? dragDelta.x : 0;
                  const oy = draggedThings.has(objectEnd) ? dragDelta.y : 0;
                  const adj = { x: objApp.x + ox, y: objApp.y + oy, w: objApp.w, h: objApp.h };
                  const allObjStates = statesForThing(model, objectEnd);
                  const visObjStates = objApp.suppressed_states
                    ? allObjStates.filter((s) => !objApp.suppressed_states!.includes(s.id))
                    : allObjStates;
                  const pill = statePillRect(adj, visObjStates, link.source_state);
                  if (pill) {
                    if (objectEnd === visualSource) { srcRect = pill; srcKindOverride = "object"; }
                    else { tgtRect = pill; tgtKindOverride = "object"; }
                  }
                }
              }
              // Route target_state (TO state) to object endpoint — used by isOutputHalf (DA-8)
              if (isOutputHalf && link.target_state) {
                const objApp = appearances.get(objectEnd);
                if (objApp) {
                  const ox = draggedThings.has(objectEnd) ? dragDelta.x : 0;
                  const oy = draggedThings.has(objectEnd) ? dragDelta.y : 0;
                  const adj = { x: objApp.x + ox, y: objApp.y + oy, w: objApp.w, h: objApp.h };
                  const allObjStates = statesForThing(model, objectEnd);
                  const visObjStates = objApp.suppressed_states
                    ? allObjStates.filter((s) => !objApp.suppressed_states!.includes(s.id))
                    : allObjStates;
                  const pill = statePillRect(adj, visObjStates, link.target_state);
                  if (pill) {
                    if (objectEnd === visualTarget) { tgtRect = pill; tgtKindOverride = "object"; }
                    else { srcRect = pill; srcKindOverride = "object"; }
                  }
                }
              }
            } else {
              // Non-effect links: source_state belongs to source, target_state to target
              if (link.source_state) {
                const srcApp = appearances.get(visualSource);
                if (srcApp) {
                  const ox = draggedThings.has(visualSource) ? dragDelta.x : 0;
                  const oy = draggedThings.has(visualSource) ? dragDelta.y : 0;
                  const adj = { x: srcApp.x + ox, y: srcApp.y + oy, w: srcApp.w, h: srcApp.h };
                  const allSrcStates = statesForThing(model, visualSource);
                  const visSrcStates = srcApp.suppressed_states
                    ? allSrcStates.filter((s) => !srcApp.suppressed_states!.includes(s.id))
                    : allSrcStates;
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
                  const visTgtStates = tgtApp.suppressed_states
                    ? allTgtStates.filter((s) => !tgtApp.suppressed_states!.includes(s.id))
                    : allTgtStates;
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
              <g key={isInputHalf ? `${link.id}__in` : isOutputHalf ? `${link.id}__out` : link.id} className={linkSimClass || undefined}>
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
            const allStates = statesForThing(model, thingId);
            const states = app.suppressed_states
              ? allStates.filter(s => !app.suppressed_states!.includes(s.id))
              : allStates;
            const isDragging = draggedThings.has(thingId);
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
