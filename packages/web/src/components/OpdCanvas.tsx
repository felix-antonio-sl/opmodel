import { useRef, useState, useCallback, useMemo, useEffect } from "react";
import type { Model, Thing, State, Link, Appearance, Modifier, OPD, Fan } from "@opmodel/core";
import { createInitialState, resolveOpdFiber, findConsumptionResultPairs, findStructuralForks, transformingMode, getSemiFoldedParts, type ModelState, type StructuralFork, type OpdFiber } from "@opmodel/core";
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
  errorEntities?: Set<string>;
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
  input: "#16794a",
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
    aggregated?: boolean;
  }[],
  model: Model,
) {
  return entries.flatMap(entry => {
    // Aggregated (distributed) links show as simple effect — no input/output split
    if (entry.aggregated) return [entry];
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
            labelOverride: "input",
            visualSource: objectId,
            visualTarget: processId,
            isInputHalf: true as const,
          },
          {
            ...entry,
            link: { ...entry.link, source_state: undefined },
            labelOverride: "output",
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
            labelOverride: "input",
            visualSource: objectId,
            visualTarget: processId,
            isInputHalf: true as const,
          },
          {
            ...entry,
            link: { ...entry.link },
            labelOverride: "output",
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
            labelOverride: "input",
            visualSource: objectId,
            visualTarget: processId,
            isInputHalf: true as const,
          },
          {
            ...entry,
            link: { ...entry.link, source_state: undefined },
            labelOverride: "output",
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

      {/* Structural: Exhibition = small filled triangle inside open triangle (ISO §6) */}
      <marker id="triangle-exhibit" viewBox="0 0 12 12" refX="12" refY="6" markerWidth="12" markerHeight="12" orient="auto-start-reverse">
        <path d="M0,0 L12,6 L0,12Z" fill="white" stroke="#6b5fad" strokeWidth="1.2" />
        <path d="M2,3.5 L7,6 L2,8.5Z" fill="#6b5fad" />
      </marker>

      {/* Structural: Generalization = open triangle △ (ISO §6) */}
      <marker id="triangle-open" viewBox="0 0 12 12" refX="12" refY="6" markerWidth="12" markerHeight="12" orient="auto-start-reverse">
        <path d="M0,0 L12,6 L0,12Z" fill="white" stroke="#6b5fad" strokeWidth="1.5" />
      </marker>

      {/* Structural: Classification = small filled circle inside open triangle (ISO §6) */}
      <marker id="triangle-classify" viewBox="0 0 12 12" refX="12" refY="6" markerWidth="12" markerHeight="12" orient="auto-start-reverse">
        <path d="M0,0 L12,6 L0,12Z" fill="white" stroke="#6b5fad" strokeWidth="1.5" />
        <circle cx="4" cy="6" r="2" fill="#6b5fad" />
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
  isRefined,
  isImplicit,
  isError,
  isShared,
  hasSuppressedStates,
  dragDelta,
  simFilter,
  simStatePillOverride,
  semiFoldEntries,
  semiFoldHidden,
  onExtractPart,
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
  isRefined: boolean;
  isImplicit?: boolean;
  isError?: boolean;
  isShared?: boolean;
  hasSuppressedStates?: boolean;
  dragDelta: Point;
  simFilter?: string;
  simStatePillOverride?: string;
  semiFoldEntries?: Array<{ thingId: string; name: string; linkType: string }>;
  semiFoldHidden?: number;
  onExtractPart?: (partThingId: string) => void;
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
  const hasSemiFold = semiFoldEntries && semiFoldEntries.length > 0;
  const semiFoldH = hasSemiFold ? semiFoldEntries.length * 14 + (semiFoldHidden ? 14 : 0) + 8 : 0;
  const extraH = (hasStates ? 24 : 0) + semiFoldH;
  const totalH = h + extraH;

  // ISO 19450: color always follows kind (object=green, process=blue), regardless of external/container
  // WP-4: error things get red stroke
  const strokeColor = isError ? "var(--error-stroke, #e53e3e)" : thing.kind === "process" ? "var(--process-stroke)" : "var(--object-stroke)";
  const isPhysical = thing.essence === "physical";
  const kindFill = thing.kind === "process"
    ? (isPhysical ? "var(--process-fill-physical)" : "var(--process-fill)")
    : (isPhysical ? "var(--object-fill-physical)" : "var(--object-fill)");
  const fillColor = kindFill;
  // ISO §14.2: refined things show thick contour in both parent and child OPD
  const baseStroke = isPhysical ? 3.5 : 1.2;
  const strokeWidth = isContainer ? 2.5 : isExternal ? 1.0 : isRefined ? Math.max(baseStroke, 2.5) : baseStroke;
  const strokeDash = isImplicit ? "4,3" : thing.affiliation === "environmental" ? "6,3" : undefined;

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
      {thing.duration && thing.kind === "process" && (
        <text
          className="thing-duration"
          x={x + w / 2}
          y={isContainer ? y + 28 : y + (hasStates ? h / 2 + 10 : totalH / 2 + 12)}
        >
          {thing.duration.min != null && (
            <tspan className="thing-duration__bound">{thing.duration.min}–</tspan>
          )}
          <tspan>{thing.duration.nominal}</tspan>
          {thing.duration.max != null && (
            <tspan className="thing-duration__bound">–{thing.duration.max}</tspan>
          )}
          <tspan> {thing.duration.unit}</tspan>
        </text>
      )}
      {isExternal && (
        <text className="thing-badge-external" x={x + w - 8} y={y + 12}>↑</text>
      )}
      {thing.computational && (
        <text className="thing-badge-computational" x={x + 8} y={y + 12}>
          {"value_type" in thing.computational ? "d" : "f"}
        </text>
      )}
      {isRefined && !isContainer && (
        <text fontSize={10} fill="var(--accent)" pointerEvents="none"
          x={x + w - 10} y={y + totalH - 5}>⊕</text>
      )}
      {isShared && (
        <text fontSize={8} fill="var(--accent-dim, #3a7bc8)" pointerEvents="none"
          x={x + 3} y={y + totalH - 3} title="Shared with sub-model">⇌</text>
      )}

      {hasSemiFold && (
        <g>
          <line x1={x + 8} y1={y + h - 2} x2={x + w - 8} y2={y + h - 2}
            stroke="var(--border)" strokeWidth={0.5} />
          {semiFoldEntries!.map((entry, i) => (
            <text key={i} x={x + 12} y={y + h + 10 + i * 14}
              fontSize={9} fill="var(--text-muted)" textAnchor="start" dominantBaseline="middle"
              style={{ cursor: onExtractPart ? "pointer" : undefined }}
              onClick={onExtractPart ? (e) => { e.stopPropagation(); onExtractPart(entry.thingId); } : undefined}>
              {entry.linkType === "aggregation" ? "◇ " : "◈ "}{entry.name}
            </text>
          ))}
          {semiFoldHidden! > 0 && (
            <text x={x + 12} y={y + h + 10 + semiFoldEntries!.length * 14}
              fontSize={9} fill="var(--text-muted)" fontStyle="italic" textAnchor="start" dominantBaseline="middle">
              + {semiFoldHidden} more
            </text>
          )}
        </g>
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
                  strokeWidth={state.initial ? 2.5 : 1}
                />
                {/* R-TC-8: final state — double border */}
                {state.final && (
                  <rect
                    x={px + 2} y={py + 2} width={pillW - 4} height={pillH - 4}
                    fill="none" stroke={isCurrent ? "var(--accent)" : "var(--state-border)"}
                    strokeWidth={1} rx={2}
                  />
                )}
                {/* R-TC-8: default state — diagonal arrow marker (ISO §4 line 329) */}
                {state.default && (
                  <line
                    x1={px + 1} y1={py + pillH - 1}
                    x2={px + 9} y2={py + pillH - 9}
                    stroke="var(--accent)" strokeWidth={2}
                  />
                )}
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

      {/* R-SS-8: suppressed states indicator "..." */}
      {hasSuppressedStates && thing.kind === "object" && (
        <text
          x={x + w - 8} y={y + totalH - 4}
          fontSize={10} fill="var(--text-muted)" textAnchor="end"
          fontWeight="bold" title="Hidden states">...</text>
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
  isError,
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
  isError?: boolean;
}) {
  const srcCenter = center(sourceRect);
  const tgtCenter = center(targetRect);
  const color = isError ? "var(--error-stroke, #e53e3e)" : LINK_COLORS[link.type] ?? "#505878";

  // Self-loop (invocation self-invocation): bezier arc above the process
  if (link.type === "invocation" && sourceRect.x === targetRect.x && sourceRect.y === targetRect.y) {
    const cx = srcCenter.x;
    const topY = sourceRect.y;
    const loopH = 35;
    const loopW = 25;
    const d = `M ${cx - loopW},${topY} C ${cx - loopW},${topY - loopH * 2} ${cx + loopW},${topY - loopH * 2} ${cx + loopW},${topY}`;
    return (
      <g>
        <path className="link-line" d={d} fill="none" stroke={color} markerEnd="url(#arrow-control)" />
        <text className="link-label" x={cx} y={topY - loopH * 1.6} textAnchor="middle">
          self-invocation
        </text>
      </g>
    );
  }

  const p1 = edgePoint(sourceKind, sourceRect, tgtCenter);
  const p2 = edgePoint(targetKind, targetRect, srcCenter);
  const mid = midpoint(p1, p2);

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

  // Invocation links: ISO "lightning jagged line with arrowhead"
  const isLightning = link.type === "invocation";

  let linkElement: React.ReactNode;
  if (isLightning) {
    // Zigzag path from p1 to p2
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const segments = Math.max(3, Math.round(len / 30));
    // Perpendicular unit vector
    const px = -dy / len;
    const py = dx / len;
    const amp = 7; // zigzag amplitude
    let d = `M ${p1.x},${p1.y}`;
    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      const bx = p1.x + dx * t;
      const by = p1.y + dy * t;
      const offset = (i % 2 === 1 ? amp : -amp);
      d += ` L ${bx + px * offset},${by + py * offset}`;
    }
    d += ` L ${p2.x},${p2.y}`;
    linkElement = (
      <path className="link-line" d={d} fill="none" stroke={color} markerEnd={markerEnd} />
    );
  } else {
    linkElement = (
      <line
        className="link-line"
        x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
        stroke={color}
        markerEnd={markerEnd}
        markerStart={markerStart}
      />
    );
  }

  return (
    <g>
      {linkElement}
      <text className="link-label" x={mid.x} y={mid.y - 7}>
        {labelOverride ?? (link.type === "tagged" && link.tag ? link.tag : link.type)}
      </text>
      {link.rate && (
        <text className="link-rate" x={mid.x} y={mid.y + 5}>
          {link.rate.value}{link.rate.unit}
        </text>
      )}
      {link.probability != null && (
        <text fontSize={9} fill="#ed8936" fontWeight="bold"
          x={mid.x} y={mid.y + (link.rate ? 14 : 5)}
          textAnchor="middle">
          {Math.round(link.probability * 100)}%
        </text>
      )}
      {link.multiplicity_source && (
        <text fontSize={9} fill="#666" fontWeight="bold"
          x={p1.x + (p2.x - p1.x) * 0.12} y={p1.y + (p2.y - p1.y) * 0.12 - 6}
          textAnchor="middle">
          {link.multiplicity_source}
        </text>
      )}
      {link.multiplicity_target && (
        <text fontSize={9} fill="#666" fontWeight="bold"
          x={p1.x + (p2.x - p1.x) * 0.88} y={p1.y + (p2.y - p1.y) * 0.88 - 6}
          textAnchor="middle">
          {link.multiplicity_target}
        </text>
      )}
      {modifier && (() => {
        const isEvent = modifier.type === "event";
        const isSkip = !isEvent && modifier.condition_mode === "skip";
        const badgeColor = isEvent ? "#d69e2e" : isSkip ? "#c05621" : "#3182ce";
        const bx = mid.x + 12;
        const by = mid.y + 2;
        return (
          <g>
            <circle cx={bx} cy={by} r={8} fill={badgeColor} stroke="white" strokeWidth={1} />
            <text x={bx} y={by + 1} textAnchor="middle" dominantBaseline="central"
              fill="white" fontSize={10} fontWeight="bold">
              {isEvent ? "e" : "c"}
            </text>
            {isSkip && (
              <line x1={bx - 3} y1={by + 4} x2={bx + 3} y2={by - 4}
                stroke="white" strokeWidth={1.5} />
            )}
          </g>
        );
      })()}
      {/* ISO §9.5.4: exception bars — 1 bar = overtime, 2 bars = undertime */}
      {link.type === "exception" && (() => {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 1) return null;
        // Perpendicular unit vector
        const px = -dy / len;
        const py = dx / len;
        // Position bars at 40% along the link
        const bx = p1.x + dx * 0.4;
        const by = p1.y + dy * 0.4;
        const barLen = 6;
        const isUndertime = link.exception_type === "undertime";
        return (
          <g>
            <line x1={bx + px * barLen} y1={by + py * barLen}
                  x2={bx - px * barLen} y2={by - py * barLen}
                  stroke={color} strokeWidth={2} />
            {isUndertime && (
              <line x1={bx + dx / len * 4 + px * barLen} y1={by + dy / len * 4 + py * barLen}
                    x2={bx + dx / len * 4 - px * barLen} y2={by + dy / len * 4 - py * barLen}
                    stroke={color} strokeWidth={2} />
            )}
          </g>
        );
      })()}
    </g>
  );
}

/* ─── Main Canvas Component ─── */

const GRID_SIZE = 20;
function snap(v: number): number { return Math.round(v / GRID_SIZE) * GRID_SIZE; }

const LINK_CATEGORIES: Record<string, string[]> = {
  "Procedural": ["effect", "consumption", "result", "input", "output"],
  "Enabling": ["agent", "instrument"],
  "Structural": ["aggregation", "exhibition", "generalization", "classification", "tagged"],
  "Control": ["invocation", "exception"],
};

export function OpdCanvas({ model, opdId, selectedThing, mode, linkType, dispatch, simulation, errorEntities }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [pan, setPan] = useState({ x: 40, y: 20 });
  const [zoom, setZoom] = useState(1);
  const [hiddenLinkTypes, setHiddenLinkTypes] = useState<Set<string>>(new Set());
  const [showLinkFilter, setShowLinkFilter] = useState(false);

  const toggleLinkCategory = (category: string) => {
    setHiddenLinkTypes(prev => {
      const next = new Set(prev);
      const types = LINK_CATEGORIES[category];
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
  const skipNextClick = useRef(false); // guard: lasso mouseUp → don't let onClick clear selection

  // Lasso selection state
  const [lasso, setLasso] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [lassoOrigin, setLassoOrigin] = useState<Point>({ x: 0, y: 0 });

  // Clear multi-select when OPD changes
  useEffect(() => { setMultiSelect(new Set()); }, [opdId]);

  // Select all (Ctrl+A)
  useEffect(() => {
    const handler = () => {
      if (simulation) return;
      setMultiSelect(new Set(appearances.keys()));
    };
    window.addEventListener("opmodel:selectAll", handler);
    return () => window.removeEventListener("opmodel:selectAll", handler);
  }, [appearances, simulation]);

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
    window.addEventListener("keydown", handler, true); // capture phase = first
    return () => window.removeEventListener("keydown", handler, true);
  }, [multiSelect, dispatch]);

  // Resize state
  type ResizeHandle = "nw" | "ne" | "sw" | "se";
  const [resizeTarget, setResizeTarget] = useState<string | null>(null);
  const [resizeHandle, setResizeHandle] = useState<ResizeHandle | null>(null);
  const [resizeOrigin, setResizeOrigin] = useState<Point>({ x: 0, y: 0 });
  const [resizeDelta, setResizeDelta] = useState<Point>({ x: 0, y: 0 });

  // Container drag coupling: when dragging the container of an in-zoom OPD,
  // all internal things move together (ISO: container encapsulates contents).
  const containerThingId = useMemo(() => {
    const opd = model.opds.get(opdId);
    return opd?.refines ?? null;
  }, [model, opdId]);

  // Set of things that move during drag (container + all siblings, multi-select, or single thing)
  const draggedThings = useMemo(() => {
    if (!dragTarget) return new Set<string>();
    if (dragTarget === containerThingId) {
      const set = new Set<string>();
      for (const app of model.appearances.values()) {
        if (app.opd === opdId) set.add(app.thing);
      }
      return set;
    }
    // Multi-select drag: move all selected things
    if (multiSelect.size > 0 && multiSelect.has(dragTarget)) {
      const set = new Set(multiSelect);
      set.add(dragTarget);
      return set;
    }
    return new Set([dragTarget]);
  }, [dragTarget, containerThingId, model, opdId, multiSelect]);

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

  // Derive appearances map from fiber (explicit only — implicit things rendered separately)
  // SubModel shared things — for visual badge
  const sharedThingIds = useMemo(() => {
    const set = new Set<string>();
    for (const sub of model.subModels.values()) {
      for (const id of sub.shared_things) set.add(id);
    }
    return set;
  }, [model.subModels]);

  const appearances = useMemo(() => {
    const map = new Map<string, Appearance>();
    for (const [id, entry] of fiber.things) {
      if (!entry.implicit) map.set(id, entry.appearance);
    }
    return map;
  }, [fiber]);

  // Implicit things set (DA-9: connected but no stored appearance)
  const implicitThings = useMemo(() => {
    const set = new Set<string>();
    for (const [id, entry] of fiber.things) {
      if (entry.implicit) set.add(id);
    }
    return set;
  }, [fiber]);

  // DA-9: filter suppressed states — merge fiber (auto) + stored (manual)
  const visibleStatesFor = useCallback((allStates: State[], thingId: string) => {
    const fiberSuppressed = fiber.suppressedStates.get(thingId);
    const app = fiber.things.get(thingId)?.appearance;
    const storedSuppressed = app?.suppressed_states;
    if (!fiberSuppressed && !storedSuppressed) return allStates;
    return allStates.filter(s => {
      if (fiberSuppressed?.has(s.id)) return false;
      if (storedSuppressed?.includes(s.id)) return false;
      return true;
    });
  }, [fiber]);

  // Collect visible links (with endpoint resolution for in-zoom containers)
  const visibleLinks = useMemo(() => {
    const resolved = fiber.links;
    const entries = resolved.map(rl => ({
      link: rl.link,
      modifier: [...model.modifiers.values()].find((m) => m.over === rl.link.id),
      visualSource: rl.visualSource,
      visualTarget: rl.visualTarget,
      labelOverride: rl.splitHalf as string | undefined,  // R-ES: "input" or "output"
      isMergedPair: false,
      aggregated: rl.aggregated,
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

  // Link type filter — applied after computation to avoid recomputing fiber
  const filteredVisibleLinks = useMemo(() => {
    if (hiddenLinkTypes.size === 0) return visibleLinks;
    return visibleLinks.filter(vl => !hiddenLinkTypes.has(vl.link.type));
  }, [visibleLinks, hiddenLinkTypes]);

  // Fan arcs: compute points along each link line at fixed distance from shared endpoint edge.
  // ISO 19450: "dashed arc across links of the fan, focal point at convergent endpoint"
  const ARC_DIST = 65; // distance along each link line from the edge point
  const visibleFans = useMemo(() => {
    const visibleLinkIds = new Set(visibleLinks.map(vl => vl.link.id));
    const result: Array<{
      fan: Fan;
      arcPoints: Point[]; // points on the link lines where the arc crosses
      sharedCenter: Point;
    }> = [];

    for (const fan of model.fans.values()) {
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

      // For each member link, compute a point on the link line at ARC_DIST from the edge
      const arcPoints: Point[] = [];
      for (const ml of memberLinks) {
        const otherId = direction === "converging" ? ml.source : ml.target;
        const otherApp = appearances.get(otherId);
        const otherThing = model.things.get(otherId);
        if (!otherApp || !otherThing) continue;
        const otherRect: Rect = { x: otherApp.x, y: otherApp.y, w: otherApp.w, h: otherApp.h };
        const otherCtr = center(otherRect);

        // Edge point on shared endpoint contour toward the other thing
        const ep = edgePoint(sharedThing.kind, sharedRect, otherCtr);

        // Direction vector from edge toward other thing, normalized
        const dx = otherCtr.x - ep.x;
        const dy = otherCtr.y - ep.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 1) continue;

        // Point on the link line at ARC_DIST from edge
        arcPoints.push({
          x: ep.x + (dx / len) * ARC_DIST,
          y: ep.y + (dy / len) * ARC_DIST,
        });
      }
      if (arcPoints.length < 2) continue;

      result.push({ fan, arcPoints, sharedCenter: sharedCtr });
    }
    return result;
  }, [model, visibleLinks, appearances]);

  // Structural link groups: ALL structural links rendered as fork triangles (ISO §6).
  // minChildren=1 so even single structural links get trunk+triangle+branch rendering.
  const visibleForks = useMemo((): StructuralFork[] => {
    const resolved = filteredVisibleLinks.map(vl => ({
      link: vl.link,
      visualSource: vl.visualSource,
      visualTarget: vl.visualTarget,
      aggregated: false,
    }));
    return findStructuralForks(resolved, 1);
  }, [filteredVisibleLinks]);

  // Link IDs belonging to forks — suppress from individual rendering
  const forkedLinkIds = useMemo(() => {
    const ids = new Set<string>();
    for (const fork of visibleForks) {
      for (const child of fork.children) ids.add(child.link.id);
    }
    return ids;
  }, [visibleForks]);

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
      // Normal drag on canvas: pan
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

      // Ctrl/Cmd+Click: toggle multi-select
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

      // Normal click: if thing is in multi-select, drag all; otherwise clear multi-select
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
      // Resolve lasso rectangle to selected things
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
      skipNextClick.current = true; // prevent onClick from clearing multiSelect
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
        // Clamp position so that shrinking doesn't move beyond original edges
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
          // Container drag: batch-move all things in the OPD
          const moves: Array<{ thingId: string; opdId: string; x: number; y: number }> = [];
          for (const thingId of draggedThings) {
            const app = appearances.get(thingId);
            if (app) {
              moves.push({ thingId, opdId, x: snap(app.x + dragDelta.x), y: snap(app.y + dragDelta.y) });
            }
          }
          if (moves.length > 0) dispatch({ tag: "moveThings", moves });
        } else {
          // Single thing drag
          const app = appearances.get(dragTarget);
          if (app) {
            dispatch({ tag: "moveThing", thingId: dragTarget, opdId, x: snap(app.x + dragDelta.x), y: snap(app.y + dragDelta.y) });
          }
        }
      }
      // Clear multi-select on simple click (no significant drag movement)
      if (Math.abs(dragDelta.x) <= 1 && Math.abs(dragDelta.y) <= 1) {
        setMultiSelect(new Set());
      } else {
        skipNextClick.current = true; // dragged — don't let onClick interfere
      }
      setDragTarget(null);
      setDragDelta({ x: 0, y: 0 });
      return;
    }
    setPanning(false);
  }, [dragTarget, dragDelta, draggedThings, appearances, opdId, dispatch]);

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
    const pad = 60;
    const contentW = maxX - minX + pad * 2;
    const contentH = maxY - minY + pad * 2;
    const scaleX = svgRect.width / contentW;
    const scaleY = svgRect.height / contentH;
    const newZoom = Math.min(2, Math.max(0.3, Math.min(scaleX, scaleY)));
    const newPanX = (svgRect.width - contentW * newZoom) / 2 - (minX - pad) * newZoom;
    const newPanY = (svgRect.height - contentH * newZoom) / 2 - (minY - pad) * newZoom;
    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  }, [appearances]);

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
    // If thing has refinement from this OPD, navigate into it
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
        // H-06: Name duplicate detection — warn if another thing has the same name
        const existing = [...model.things.values()].find(
          (t) => t.name === name && t.id !== renaming
        );
        if (existing) {
          if (!window.confirm(`A ${existing.kind} named "${name}" already exists. Use this name anyway?`)) {
            return; // keep InlineRename open (don't setRenaming(null))
          }
        }
        dispatch({ tag: "renameThing", thingId: renaming, name });
      }
      setRenaming(null);
    },
    [renaming, dispatch, model],
  );

  const opd = model.opds.get(opdId);

  // Build effective rects for links, accounting for drag delta
  // R-SF-6/9: Build map of semi-folded part → virtual rect (position inside container)
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
        // R-SF-6/9: fallback to semi-fold part virtual rect
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
            const first = apps[0].app!.x;
            const last = apps[apps.length - 1].app!.x;
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
          {hiddenLinkTypes.size > 0 && (
            <button className="canvas-link-filter__reset" onClick={() => setHiddenLinkTypes(new Set())}>
              Show All
            </button>
          )}
        </div>
      )}
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
          {filteredVisibleLinks.map(({ link, modifier, visualSource, visualTarget, labelOverride, isMergedPair, isInputHalf, isOutputHalf }) => {
            // C-05: skip links rendered as part of a fork triangle
            if (forkedLinkIds.has(link.id)) return null;
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
                  const visObjStates = visibleStatesFor(allObjStates, objectEnd);
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
                  const visObjStates = visibleStatesFor(allObjStates, objectEnd);
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
                <title>{`${link.type}: ${srcThing.name} → ${tgtThing.name}`}</title>
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
                />
              </g>
            );
          })}

          {/* Structural fork triangles (C-05 ISO §6): shared triangle + trunk + branches.
              When 2+ structural links of the same type share a parent, render one triangle
              instead of individual markers. Apex → parent, base → children. */}
          {visibleForks.map(fork => {
            const parentRect = getEffectiveRect(fork.parentId);
            const parentThing = model.things.get(fork.parentId);
            if (!parentRect || !parentThing) return null;

            // Resolve children rects and things
            const childrenData = fork.children.map(c => {
              const rect = getEffectiveRect(c.childId);
              const thing = model.things.get(c.childId);
              return rect && thing ? { ...c, rect, thing } : null;
            }).filter((c): c is NonNullable<typeof c> => c !== null);
            if (childrenData.length < 1) return null;

            // Centroid of children centers
            const cx = childrenData.reduce((s, c) => s + c.rect.x + c.rect.w / 2, 0) / childrenData.length;
            const cy = childrenData.reduce((s, c) => s + c.rect.y + c.rect.h / 2, 0) / childrenData.length;
            const centroid = { x: cx, y: cy };
            const parentCtr = center(parentRect);

            // Direction from parent toward children
            const dx = centroid.x - parentCtr.x;
            const dy = centroid.y - parentCtr.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len < 1) return null;
            const dir = { x: dx / len, y: dy / len };
            const perp = { x: -dir.y, y: dir.x };

            // Geometry constants
            const isSingle = childrenData.length === 1;
            const hasInner = fork.type === "exhibition" || fork.type === "classification";
            const TRUNK = isSingle ? 8 : 14;             // closer to parent edge
            const TRI_H = hasInner ? (isSingle ? 18 : 22) : (isSingle ? 14 : 18);
            const TRI_HALF = isSingle ? (hasInner ? 10 : 8) : Math.max(hasInner ? 12 : 10, childrenData.length * 5);

            // Trunk: parent edge → apex
            const trunkStart = edgePoint(parentThing.kind, parentRect, centroid);
            const apex = { x: trunkStart.x + dir.x * TRUNK, y: trunkStart.y + dir.y * TRUNK };
            const baseCtr = { x: apex.x + dir.x * TRI_H, y: apex.y + dir.y * TRI_H };
            const baseL = { x: baseCtr.x - perp.x * TRI_HALF, y: baseCtr.y - perp.y * TRI_HALF };
            const baseR = { x: baseCtr.x + perp.x * TRI_HALF, y: baseCtr.y + perp.y * TRI_HALF };

            // Branch origins: project each child onto base line, clamp to base extent
            const branches = childrenData.map(c => {
              const childCtr = center(c.rect);
              const projOffset = (childCtr.x - baseCtr.x) * perp.x + (childCtr.y - baseCtr.y) * perp.y;
              const clamped = Math.max(-TRI_HALF, Math.min(TRI_HALF, projOffset));
              const origin = { x: baseCtr.x + perp.x * clamped, y: baseCtr.y + perp.y * clamped };
              const endpoint = edgePoint(c.thing.kind, c.rect, origin);
              return { ...c, origin, endpoint };
            });

            // Triangle shape per type (ISO §6 canonical symbols)
            const color = "#6b5fad";
            const triPoints = `${apex.x},${apex.y} ${baseL.x},${baseL.y} ${baseR.x},${baseR.y}`;
            // Inner triangle/circle centroid (60% from apex toward base center)
            const innerCtr = { x: apex.x * 0.4 + baseCtr.x * 0.6, y: apex.y * 0.4 + baseCtr.y * 0.6 };
            let triangleSvg: React.ReactNode;
            switch (fork.type) {
              case "aggregation":
                // Filled black triangle ▲
                triangleSvg = <polygon points={triPoints} fill={color} />;
                break;
              case "exhibition": {
                // Filled triangle inside open triangle, concentric (ISO §6)
                const s = 0.55; // inner triangle scale
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
                // Open/empty triangle △
                triangleSvg = <polygon points={triPoints} fill="white" stroke={color} strokeWidth="1.5" />;
                break;
              case "classification": {
                // Small filled circle inside open triangle (ISO §6)
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
                {/* Trunk: parent edge → triangle apex */}
                <line x1={trunkStart.x} y1={trunkStart.y} x2={apex.x} y2={apex.y}
                  className="link-line" stroke={color} />
                {/* Triangle symbol */}
                {triangleSvg}
                {/* Branches: base → each child */}
                {branches.map((b, bi) => (
                  <g key={`${b.link.id}__${bi}`}>
                    <line x1={b.origin.x} y1={b.origin.y} x2={b.endpoint.x} y2={b.endpoint.y}
                      className="link-line" stroke={color}
                      onClick={(e) => { e.stopPropagation(); dispatch({ tag: "selectThing", thingId: b.link.id }); }}
                    />
                    {/* Type label at midpoint of first branch only */}
                    {b === branches[0] && (
                      <text className="link-label"
                        x={baseCtr.x + dir.x * 8} y={baseCtr.y + dir.y * 8 - 7}>
                        {fork.type}
                      </text>
                    )}
                    {/* Multiplicity labels per branch */}
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

          {/* Fan arcs (XOR=single dashed, OR=double dashed) — across link lines.
              ISO: "dashed arc across links, focal point at convergent endpoint."
              Implementation: circular arc centered on sharedCenter, radius = avg distance to crossing points. */}
          {visibleFans.map(({ fan, arcPoints, sharedCenter }) => {
            if (arcPoints.length < 2) return null;

            const color = LINK_COLORS[fan.members[0] ? model.links.get(fan.members[0])?.type ?? "effect" : "effect"] ?? "#666";

            // Convert arc crossing points to polar (angle, radius) relative to sharedCenter
            const polar = arcPoints.map(p => ({
              angle: Math.atan2(p.y - sharedCenter.y, p.x - sharedCenter.x),
              r: Math.sqrt((p.x - sharedCenter.x) ** 2 + (p.y - sharedCenter.y) ** 2),
            }));
            polar.sort((a, b) => a.angle - b.angle);

            // Find the largest angular gap — that's the region WITHOUT links (outside the arc).
            // The arc spans everything EXCEPT that gap.
            let maxGap = 0, maxGapIdx = 0;
            for (let i = 0; i < polar.length; i++) {
              const next = (i + 1) % polar.length;
              let gap = polar[next]!.angle - polar[i]!.angle;
              if (gap <= 0) gap += 2 * Math.PI;
              if (gap > maxGap) { maxGap = gap; maxGapIdx = i; }
            }

            // Rebuild array starting AFTER the largest gap, with monotonically increasing angles
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

            // Generate arc as polyline points on circle centered at sharedCenter
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
            const states = visibleStatesFor(allStates, thingId);
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
                  states={(isAppContainer && thing.kind === "process") ? [] : states}
                  isSelected={selectedThing === thingId || multiSelect.has(thingId)}
                  isDragging={isDragging}
                  isLinkSource={isLinkSource}
                  isExternal={isAppExternal && !opd?.refines}
                  isContainer={isAppContainer}
                  isRefined={[...model.opds.values()].some(o => o.refines === thingId)}
                  isError={errorEntities?.has(thingId)}
                  isShared={sharedThingIds.has(thingId)}
                  hasSuppressedStates={allStates.length > states.length}
                  dragDelta={isDragging ? dragDelta : { x: 0, y: 0 }}
                  simFilter={simFilter}
                  simStatePillOverride={simModelState && thing.kind === "object" ? simModelState.objects.get(thingId)?.currentState : undefined}
                  {...(app.semi_folded && thing.kind === "object" ? (() => {
                    const sf = getSemiFoldedParts(model, thingId);
                    return { semiFoldEntries: sf.visible, semiFoldHidden: sf.hiddenCount };
                  })() : {})}
                  onExtractPart={(partThingId) => {
                    // R-SF-3: Extract part — add appearance for the part outside the container
                    dispatch({ tag: "extractPart", partThingId, opdId, x: app.x + app.w + 40, y: app.y });
                  }}
                  onMouseDown={(e) => onThingMouseDown(thingId, e)}
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

                        // Invariant: source = parent (first click), target = child (second click).
                        // No swap for any type — user's click order IS the direction.
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

          {/* DA-9: Implicit things (connected but no stored appearance) — ghosted */}
          {[...fiber.things.entries()]
            .filter(([, entry]) => entry.implicit)
            .map(([thingId, entry]) => {
            const { thing, appearance: app } = entry;
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

          {/* Resize handles — on selected thing, when not in sim or link mode */}
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
            // Apply live resize preview
            if (resizeTarget === selectedThing && resizeHandle) {
              if (resizeHandle === "se") { w += rx; h += ry; }
              else if (resizeHandle === "sw") { x += rx; w -= rx; h += ry; }
              else if (resizeHandle === "ne") { w += rx; y += ry; h -= ry; }
              else if (resizeHandle === "nw") { x += rx; y += ry; w -= rx; h -= ry; }
              w = Math.max(60, w); h = Math.max(30, h);
            }
            const S = 6; // handle size
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
