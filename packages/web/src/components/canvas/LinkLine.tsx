import type { Link, Modifier } from "@opmodel/core";
import {
  center,
  midpoint,
  type Point,
  type Rect,
} from "../../lib/geometry";
import { LINK_COLORS } from "../../lib/visual-rules";
import { edgePoint } from "./canvas-helpers";
import type { EdgePath } from "../../lib/edge-router";

/* ─── Link Renderer ─── */

export function LinkLine({
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
  hideLabel,
  edgePath,
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
  hideLabel?: boolean;
  edgePath?: EdgePath;
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
  const mid = edgePath ? edgePath.labelPoint : midpoint(p1, p2);

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
  if (edgePath && !isLightning) {
    // Use pre-computed edge path (curved or straight)
    linkElement = (
      <path className="link-line" d={edgePath.d} fill="none" stroke={color}
        markerEnd={markerEnd} markerStart={markerStart} />
    );
  } else if (isLightning) {
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
      {!hideLabel && (
        <text className="link-label" x={mid.x} y={mid.y - 7}>
          {labelOverride ?? (link.type === "tagged" && link.tag ? link.tag : link.type)}
        </text>
      )}
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
