import type { Thing, Appearance, State } from "@opmodel/core";
import type { Point } from "../../lib/geometry";
import type { ProjectionStatePill } from "../../lib/projection-view";
import { statePillLayout } from "../../lib/visual-rules";

/* ─── Thing Renderer ─── */

export function ThingNode({
  thing,
  appearance,
  states,
  isSelected,
  isAttention,
  isDragging,
  isLinkSource,
  isExternal,
  isContainer,
  isRefined,
  isImplicit,
  isError,
  isShared,
  hasSuppressedStates,
  statePills,
  hiddenStateCount,
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
  isAttention?: boolean;
  isDragging: boolean;
  isLinkSource: boolean;
  isExternal: boolean;
  isContainer: boolean;
  isRefined: boolean;
  isImplicit?: boolean;
  isError?: boolean;
  isShared?: boolean;
  hasSuppressedStates?: boolean;
  statePills?: ProjectionStatePill[];
  hiddenStateCount?: number;
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
  const fallbackMaxVisible = Math.min(states.length, Math.max(2, Math.floor((w - 8) / (30 + 4))));
  const pills = statePills ?? [];
  const effectiveHiddenStateCount = hiddenStateCount ?? Math.max(0, states.length - fallbackMaxVisible);
  const hasStates = (pills.length > 0) || states.length > 0;
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
  const strokeDash = thing.affiliation === "environmental" ? "6,3" : undefined;
  const groupOpacity = isImplicit ? 0.55 : 1;

  const filterStr = isDragging
    ? "url(#glow-drag)"
    : simFilter
      ? simFilter
      : isSelected
        ? "url(#glow-selected)"
        : undefined;

  const className = `thing-group${isSelected ? " thing-group--selected" : ""}${isAttention ? " thing-group--attention" : ""}${isDragging ? " thing-group--dragging" : ""}${isLinkSource ? " thing-group--link-source" : ""}`;

  const tooltip = `${thing.name} (${thing.kind}, ${thing.essence}${thing.affiliation === "environmental" ? ", environmental" : ""})${thing.duration ? ` — ${thing.duration.nominal}${thing.duration.unit}` : ""}${thing.notes ? `\n\n${thing.notes}` : ""}`;

  return (
    <g
      className={className}
      filter={filterStr}
      opacity={groupOpacity}
      role="button"
      aria-label={thing.name}
      tabIndex={-1}
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
          x={x + 3} y={y + totalH - 3}><title>Shared with sub-model</title>⇌</text>
      )}

      {hasSemiFold && (
        <g>
          <line x1={x + 8} y1={y + h - 2} x2={x + w - 8} y2={y + h - 2}
            stroke="var(--border)" strokeWidth={0.5} />
          {semiFoldEntries!.map((entry, i) => (
            <text key={i} x={x + 14} y={y + h + 12 + i * 16}
              fontSize={9} fill="var(--text-secondary)" textAnchor="start" dominantBaseline="middle"
              style={{ cursor: onExtractPart ? "pointer" : undefined }}
              onDoubleClick={onExtractPart ? (e) => { e.stopPropagation(); onExtractPart(entry.thingId); } : undefined}>
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
          {(pills.length > 0 ? pills : states.slice(0, fallbackMaxVisible).map((state, i) => {
            const layout = statePillLayout(w, fallbackMaxVisible, "default");
            const visibleCount = Math.min(states.length, fallbackMaxVisible);
            const totalPillW = visibleCount * (layout.pillW + 4) - 4;
            const startX = x + (w - totalPillW) / 2;
            return {
              state,
              x: startX + i * (layout.pillW + 4),
              y: y + h - 4,
              w: layout.pillW,
              h: layout.pillH,
            };
          })).map((pill) => {
            const isCurrent = simStatePillOverride
              ? pill.state.id === simStatePillOverride
              : pill.state.current === true;
            const isSimCurrent = simStatePillOverride ? pill.state.id === simStatePillOverride : false;

            return (
              <g key={pill.state.id}>
                <rect
                  className={`state-pill${isSimCurrent ? " state-pill--sim-current" : ""}`}
                  x={pill.x}
                  y={pill.y}
                  width={pill.w}
                  height={pill.h}
                  fill={isCurrent ? "var(--state-current-bg)" : "var(--state-bg)"}
                  stroke={isCurrent ? "var(--accent)" : "var(--state-border)"}
                  strokeWidth={pill.state.initial ? 2.5 : 1}
                />
                {pill.state.final && (
                  <rect
                    x={pill.x + 2} y={pill.y + 2} width={pill.w - 4} height={pill.h - 4}
                    fill="none" stroke={isCurrent ? "var(--accent)" : "var(--state-border)"}
                    strokeWidth={1} rx={2}
                  />
                )}
                {pill.state.default && (
                  <line
                    x1={pill.x + 1} y1={pill.y + pill.h - 1}
                    x2={pill.x + 9} y2={pill.y + pill.h - 9}
                    stroke="var(--accent)" strokeWidth={2}
                  />
                )}
                <text
                  className={`state-label${isCurrent ? " state-label--current" : ""}`}
                  x={pill.x + pill.w / 2}
                  y={pill.y + pill.h / 2}
                >
                  {pill.state.name.length > Math.floor(pill.w / 5) ? pill.state.name.substring(0, Math.floor(pill.w / 5)) + "…" : pill.state.name}
                </text>
              </g>
            );
          })}
          {effectiveHiddenStateCount > 0 && (
            <text fontSize={8} fill="var(--text-muted)" x={x + w - 8} y={y + h + 6} textAnchor="end">
              +{effectiveHiddenStateCount}
            </text>
          )}
        </g>
      )}

      {/* R-SS-8: suppressed states indicator "..." */}
      {hasSuppressedStates && thing.kind === "object" && (
        <text
          x={x + w - 8} y={y + totalH - 4}
          fontSize={10} fill="var(--text-muted)" textAnchor="end"
          fontWeight="bold"><title>Hidden states</title>...</text>
      )}
    </g>
  );
}
