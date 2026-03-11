import { useRef, useState, useCallback, useMemo } from "react";
import type { Model, Thing, State, Link, Appearance, Modifier } from "@opmodel/core";
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
  onSelectThing: (id: string | null) => void;
}

/* ─── Link type → color mapping ─── */

const LINK_COLORS: Record<string, string> = {
  agent: "#5b8fd9",
  instrument: "#5b8fd9",
  consumption: "#3fae96",
  effect: "#3fae96",
  result: "#3fae96",
  input: "#5b8fd9",
  output: "#3fae96",
  aggregation: "#8a7ec8",
  exhibition: "#8a7ec8",
  generalization: "#8a7ec8",
  instantiation: "#8a7ec8",
  classification: "#8a7ec8",
  invocation: "#d4804e",
  exception: "#d4804e",
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
      {/* Dot grid */}
      <pattern id="grid-dots" width="20" height="20" patternUnits="userSpaceOnUse">
        <circle cx="10" cy="10" r="0.6" fill="rgba(255,255,255,0.035)" />
      </pattern>

      {/* Arrowheads per category */}
      <marker id="arrow-proc" viewBox="0 0 10 8" refX="10" refY="4" markerWidth="8" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L10,4 L0,8Z" fill="#3fae96" />
      </marker>
      <marker id="arrow-enabling" viewBox="0 0 10 8" refX="10" refY="4" markerWidth="8" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L10,4 L0,8Z" fill="#5b8fd9" />
      </marker>
      <marker id="arrow-struct" viewBox="0 0 10 8" refX="10" refY="4" markerWidth="8" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L10,4 L0,8" fill="none" stroke="#8a7ec8" strokeWidth="1.5" />
      </marker>
      <marker id="arrow-control" viewBox="0 0 10 8" refX="10" refY="4" markerWidth="8" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L10,4 L0,8Z" fill="#d4804e" />
      </marker>

      {/* Consumption circle */}
      <marker id="dot-consumption" viewBox="0 0 8 8" refX="4" refY="4" markerWidth="6" markerHeight="6" orient="auto">
        <circle cx="4" cy="4" r="3" fill="#3fae96" />
      </marker>

      {/* Selection glow filter */}
      <filter id="glow-selected" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="4" result="blur" />
        <feFlood floodColor="#c8973e" floodOpacity="0.35" />
        <feComposite in2="blur" operator="in" />
        <feMerge>
          <feMergeNode />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  );
}

/* ─── Thing Renderer ─── */

function ThingNode({
  thing,
  appearance,
  states,
  isSelected,
  onSelect,
}: {
  thing: Thing;
  appearance: Appearance;
  states: State[];
  isSelected: boolean;
  onSelect: () => void;
}) {
  const { x, y, w, h } = appearance;
  const hasStates = states.length > 0;
  const extraH = hasStates ? 24 : 0;
  const totalH = h + extraH;

  const strokeColor = thing.kind === "process" ? "var(--process-stroke)" : "var(--object-stroke)";
  const fillColor = thing.kind === "process" ? "var(--process-fill)" : "var(--object-fill)";
  const strokeWidth = thing.essence === "physical" ? 2.5 : 1.5;
  const strokeDash = thing.affiliation === "environmental" ? "6,3" : undefined;

  return (
    <g
      className={`thing-group${isSelected ? " thing-group--selected" : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      filter={isSelected ? "url(#glow-selected)" : undefined}
    >
      {/* Shape */}
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

      {/* Name label */}
      <text
        className={`thing-label${thing.kind === "process" ? " thing-label--process" : ""}`}
        x={x + w / 2}
        y={y + (hasStates ? h / 2 - 2 : totalH / 2)}
      >
        {thing.name}
      </text>

      {/* States */}
      {hasStates && (
        <g>
          {states.map((state, i) => {
            const pillW = Math.min(50, (w - 12) / states.length - 4);
            const pillH = 16;
            const totalPillW = states.length * (pillW + 4) - 4;
            const startX = x + (w - totalPillW) / 2;
            const px = startX + i * (pillW + 4);
            const py = y + h - 4;
            const isCurrent = state.current === true;

            return (
              <g key={state.id}>
                <rect
                  className="state-pill"
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
    link.type === "aggregation" || link.type === "exhibition" || link.type === "generalization" || link.type === "instantiation" || link.type === "classification"
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
      {/* Link type label */}
      <text className="link-label" x={mid.x} y={mid.y - 7}>
        {link.type}
      </text>
      {/* Modifier badge */}
      {modifier && (
        <text className="modifier-badge" x={mid.x} y={mid.y + 8}>
          [{modifier.type}]
        </text>
      )}
    </g>
  );
}

/* ─── Main Canvas Component ─── */

export function OpdCanvas({ model, opdId, selectedThing, onSelectThing }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [pan, setPan] = useState({ x: 40, y: 20 });
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Collect appearances for this OPD
  const appearances = useMemo(() => {
    const map = new Map<string, Appearance>();
    for (const app of model.appearances.values()) {
      if (app.opd === opdId) map.set(app.thing, app);
    }
    return map;
  }, [model, opdId]);

  // Collect visible links (both endpoints have appearances)
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

  // Pan handlers
  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      setDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    },
    [pan],
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragging) return;
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    },
    [dragging, dragStart],
  );

  const onMouseUp = useCallback(() => setDragging(false), []);

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.92 : 1.08;
      setZoom((z) => Math.min(3, Math.max(0.3, z * delta)));
    },
    [],
  );

  const opd = model.opds.get(opdId);

  return (
    <div className="opd-canvas">
      <div className="canvas-opd-label">
        <span>{opd?.name ?? opdId}</span>
        {opd?.refines && ` — ${model.things.get(opd.refines)?.name ?? opd.refines}`}
      </div>
      <div className="canvas-zoom">{Math.round(zoom * 100)}%</div>

      <svg
        ref={svgRef}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onWheel={onWheel}
        onClick={() => onSelectThing(null)}
      >
        <SvgDefs />

        {/* Background grid */}
        <rect width="100%" height="100%" fill="var(--bg-canvas)" />
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          <rect x="-500" y="-500" width="3000" height="3000" fill="url(#grid-dots)" />

          {/* Links (behind things) */}
          {visibleLinks.map(({ link, modifier }) => {
            const srcApp = appearances.get(link.source)!;
            const tgtApp = appearances.get(link.target)!;
            const srcThing = model.things.get(link.source)!;
            const tgtThing = model.things.get(link.target)!;
            const srcStates = statesForThing(model, link.source);
            const tgtStates = statesForThing(model, link.target);
            const srcRect: Rect = { x: srcApp.x, y: srcApp.y, w: srcApp.w, h: srcApp.h + (srcStates.length > 0 ? 24 : 0) };
            const tgtRect: Rect = { x: tgtApp.x, y: tgtApp.y, w: tgtApp.w, h: tgtApp.h + (tgtStates.length > 0 ? 24 : 0) };

            return (
              <LinkLine
                key={link.id}
                link={link}
                sourceRect={srcRect}
                targetRect={tgtRect}
                sourceKind={srcThing.kind}
                targetKind={tgtThing.kind}
                modifier={modifier}
              />
            );
          })}

          {/* Things (on top) */}
          {[...appearances.entries()].map(([thingId, app]) => {
            const thing = model.things.get(thingId);
            if (!thing) return null;
            const states = statesForThing(model, thingId);

            return (
              <ThingNode
                key={thingId}
                thing={thing}
                appearance={app}
                states={states}
                isSelected={selectedThing === thingId}
                onSelect={() => onSelectThing(selectedThing === thingId ? null : thingId)}
              />
            );
          })}
        </g>
      </svg>
    </div>
  );
}
