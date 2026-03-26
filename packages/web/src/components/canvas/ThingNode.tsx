import type { Thing, Appearance, State } from "@opmodel/core";
import type { Point } from "../../lib/geometry";
import { statePillLayout } from "../../lib/visual-rules";

/* ─── Thing Renderer ─── */

export function ThingNode({
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
  onContextMenu,
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
  onContextMenu?: (e: React.MouseEvent) => void;
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
  const semiFoldH = hasSemiFold ? semiFoldEntries.length * 16 + (semiFoldHidden ? 16 : 0) + 10 : 0;
  const extraH = (hasStates ? 24 : 0) + semiFoldH;
  const totalH = h + extraH;

  // ISO 19450: color always follows kind (object=green, process=blue), regardless of external/container
  // WP-4: error things get red stroke
  const strokeColor = isError ? "var(--error-stroke, #e53e3e)" : thing.kind === "process" ? "var(--process-stroke)" : "var(--object-stroke)";
  const isPhysical = thing.essence === "physical";
  const kindFill = thing.kind === "process"
    ? (isPhysical ? "var(--process-fill-physical)" : "var(--process-fill)")
    : (isPhysical ? "var(--object-fill-physical)" : "var(--object-fill)");
  const fillColor = isContainer
    ? (thing.kind === "process" ? "rgba(43, 108, 176, 0.03)" : "rgba(22, 121, 74, 0.03)")
    : isExternal ? "var(--bg-canvas, #f0f1f4)"
    : kindFill;
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

  const tooltip = `${thing.name} (${thing.kind}, ${thing.essence}${thing.affiliation === "environmental" ? ", environmental" : ""})${thing.duration ? ` — ${thing.duration.nominal}${thing.duration.unit}` : ""}`;

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
      onContextMenu={onContextMenu}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onDoubleClick();
      }}
    >
      <title>{tooltip}</title>
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
        y={isContainer ? y - 6 : y + (hasStates ? h / 2 - 2 : totalH / 2)}
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
      {/* R-VI-2: Duplicate indicator — shadow offset for things in multiple OPDs */}
      {isExternal && !isContainer && (
        thing.kind === "process" ? (
          <ellipse
            cx={x + w / 2 + 3} cy={y + totalH / 2 + 3}
            rx={w / 2} ry={totalH / 2}
            fill="none" stroke={strokeColor} strokeWidth={1} opacity={0.3}
            strokeDasharray={strokeDash}
          />
        ) : (
          <rect
            x={x + 3} y={y + 3} width={w} height={totalH}
            fill="none" stroke={strokeColor} strokeWidth={1} opacity={0.3}
            strokeDasharray={strokeDash}
          />
        )
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
            <text key={i} x={x + 14} y={y + h + 12 + i * 16}
              fontSize={9} fill="var(--text-secondary)" textAnchor="start" dominantBaseline="middle"
              style={{ cursor: onExtractPart ? "pointer" : undefined }}
              onClick={onExtractPart ? (e) => { e.stopPropagation(); onExtractPart(entry.thingId); } : undefined}>
              {entry.linkType === "aggregation" ? "◇ " : "◈ "}{entry.name}
            </text>
          ))}
          {semiFoldHidden! > 0 && (
            <text x={x + 14} y={y + h + 12 + semiFoldEntries!.length * 16}
              fontSize={9} fill="var(--text-muted)" fontStyle="italic" textAnchor="start" dominantBaseline="middle">
              + {semiFoldHidden} more
            </text>
          )}
        </g>
      )}

      {hasStates && (
        <g>
          {states.map((state, i) => {
            const minPillW = 30;
            const maxVisibleH = Math.min(states.length, Math.max(2, Math.floor((w - 8) / (minPillW + 4))));
            const layout = statePillLayout(w, maxVisibleH, "default");
            const pillW = layout.pillW;
            const pillH = layout.pillH;
            const visibleCount = Math.min(states.length, maxVisibleH);
            if (i >= visibleCount) return null; // overflow — truncated
            const totalPillW = visibleCount * (pillW + 4) - 4;
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
                  {state.name.length > Math.floor(pillW / 5) ? state.name.substring(0, Math.floor(pillW / 5)) + "…" : state.name}
                </text>
              </g>
            );
          })}
          {states.length > Math.min(states.length, Math.max(2, Math.floor((w - 8) / 34))) && (
            <text fontSize={8} fill="var(--text-muted)" x={x + w - 8} y={y + h + 6} textAnchor="end">
              +{states.length - Math.min(states.length, Math.max(2, Math.floor((w - 8) / 34)))}
            </text>
          )}
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
