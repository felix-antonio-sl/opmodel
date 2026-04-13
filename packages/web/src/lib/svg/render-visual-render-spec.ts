import type { VisualRenderEdge, VisualRenderNode, VisualRenderSpec } from "@opmodel/core";

function escapeXml(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function laneX(laneId: string) {
  switch (laneId) {
    case "lane-context": return 70;
    case "lane-function": return 370;
    case "lane-system": return 670;
    default: return 370;
  }
}

function laneTitle(laneId: string) {
  switch (laneId) {
    case "lane-context": return "Context";
    case "lane-function": return "Function";
    case "lane-system": return "System";
    default: return laneId;
  }
}

function nodeSize(node: VisualRenderNode) {
  if (node.opmKind === "process") return { w: 220, h: node.importance === 1 ? 92 : 78 };
  return { w: node.visualRole === "system" ? 220 : 210, h: 58 };
}

function nodeFill(node: VisualRenderNode) {
  if (node.visualRole === "main-process") return { fill: "#1d4ed8", stroke: "#93c5fd", text: "#eff6ff" };
  if (node.opmKind === "process") return { fill: "#312e81", stroke: "#a78bfa", text: "#f5f3ff" };
  if (node.visualRole === "system") return { fill: "#065f46", stroke: "#34d399", text: "#ecfdf5" };
  if (node.affiliation === "environmental") return { fill: "#1f2937", stroke: "#94a3b8", text: "#f8fafc" };
  if (node.visualRole === "agent") return { fill: "#7c2d12", stroke: "#fdba74", text: "#fff7ed" };
  if (node.visualRole === "instrument") return { fill: "#0f766e", stroke: "#5eead4", text: "#ecfeff" };
  if (node.visualRole === "input") return { fill: "#1e3a8a", stroke: "#93c5fd", text: "#eff6ff" };
  if (node.visualRole === "output") return { fill: "#14532d", stroke: "#86efac", text: "#f0fdf4" };
  return { fill: "#374151", stroke: "#cbd5e1", text: "#f8fafc" };
}

function edgeStroke(edge: VisualRenderEdge) {
  switch (edge.semanticRole) {
    case "human-enabler": return { stroke: "#f97316", dash: "none" };
    case "instrument-enabler": return { stroke: "#14b8a6", dash: "none" };
    case "input": return { stroke: "#3b82f6", dash: "none" };
    case "output": return { stroke: "#22c55e", dash: "none" };
    case "state-change": return { stroke: "#a855f7", dash: "4,3" };
    default: return { stroke: "#94a3b8", dash: edge.routingPriority === "secondary" ? "4,3" : "none" };
  }
}

function legendEntries(spec: VisualRenderSpec) {
  const entries = new Map<string, string>();
  for (const edge of spec.edges) {
    entries.set(edge.semanticRole ?? edge.opmLinkKind, edge.label ?? edge.opmLinkKind);
  }
  return [...entries.entries()].slice(0, 5);
}

export function renderVisualRenderSpec(spec: VisualRenderSpec): string {
  const laneIds = spec.scene.lanes.map((lane) => lane.id);
  const laneBuckets = new Map<string, VisualRenderNode[]>();
  for (const laneId of laneIds) laneBuckets.set(laneId, []);
  for (const node of spec.nodes) {
    const bucket = laneBuckets.get(node.laneId) ?? laneBuckets.get("lane-function");
    bucket?.push(node);
  }

  const geometry = new Map<string, { x: number; y: number; w: number; h: number }>();
  for (const laneId of laneIds) {
    const nodes = laneBuckets.get(laneId) ?? [];
    nodes
      .sort((a, b) => a.importance - b.importance || a.label.localeCompare(b.label))
      .forEach((node, index) => {
        const { w, h } = nodeSize(node);
        geometry.set(node.id, {
          x: laneX(laneId),
          y: 112 + index * (node.opmKind === "process" ? 106 : 84),
          w,
          h,
        });
      });
  }

  const maxLaneHeight = Math.max(...[...laneBuckets.values()].map((nodes) => 170 + nodes.length * 106), 520);
  const viewHeight = Math.max(640, maxLaneHeight + 48);

  const laneMarkup = laneIds.map((laneId) => {
    const x = laneX(laneId);
    const title = spec.scene.lanes.find((lane) => lane.id === laneId)?.label ?? laneTitle(laneId);
    return `
      <rect x="${x - 24}" y="72" width="260" height="${viewHeight - 120}" rx="18" ry="18" fill="#0f172a" stroke="#334155" stroke-width="1.5" opacity="0.95" />
      <text x="${x}" y="98" font-size="12" font-weight="700" fill="#94a3b8">${escapeXml(title)}</text>
    `;
  }).join("");

  const edgeMarkup = spec.edges.map((edge) => {
    const source = geometry.get(edge.source);
    const target = geometry.get(edge.target);
    if (!source || !target) return "";
    const x1 = source.x + source.w / 2;
    const y1 = source.y + source.h;
    const x2 = target.x + target.w / 2;
    const y2 = target.y;
    const midY = (y1 + y2) / 2;
    const style = edgeStroke(edge);
    return [
      `<path d="M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}" fill="none" stroke="${style.stroke}" stroke-width="2" stroke-dasharray="${style.dash}" marker-end="url(#arrow)" opacity="0.95" />`,
      `<rect x="${(x1 + x2) / 2 - 42}" y="${midY - 20}" width="84" height="16" rx="8" ry="8" fill="#020617" opacity="0.9" />`,
      `<text x="${(x1 + x2) / 2}" y="${midY - 8}" text-anchor="middle" font-size="11" fill="#cbd5e1">${escapeXml(edge.label ?? edge.opmLinkKind)}</text>`,
    ].join("");
  }).join("");

  const nodeMarkup = spec.nodes.map((node) => {
    const box = geometry.get(node.id);
    if (!box) return "";
    const { fill, stroke, text } = nodeFill(node);
    const shape = node.opmKind === "process"
      ? `<rect x="${box.x}" y="${box.y}" rx="24" ry="24" width="${box.w}" height="${box.h}" fill="${fill}" stroke="${stroke}" stroke-width="2" />`
      : `<rect x="${box.x}" y="${box.y}" rx="14" ry="14" width="${box.w}" height="${box.h}" fill="${fill}" stroke="${stroke}" stroke-width="2" />`;
    const roleLabel = node.visualRole.replace(/-/g, " ");
    return [
      shape,
      `<text x="${box.x + box.w / 2}" y="${box.y + box.h / 2 - 4}" text-anchor="middle" font-size="14" font-weight="700" fill="${text}">${escapeXml(node.label)}</text>`,
      `<text x="${box.x + box.w / 2}" y="${box.y + box.h / 2 + 14}" text-anchor="middle" font-size="10" fill="#cbd5e1" opacity="0.85">${escapeXml(roleLabel)}</text>`,
    ].join("");
  }).join("");

  const legend = legendEntries(spec);
  const legendMarkup = legend.map(([semanticRole, label], index) => {
    const style = edgeStroke({ id: semanticRole, source: "", target: "", opmLinkKind: semanticRole, semanticRole, routingPriority: "secondary" });
    const y = 98 + index * 22;
    return [
      `<path d="M 730 ${y} L 770 ${y}" fill="none" stroke="${style.stroke}" stroke-width="2" stroke-dasharray="${style.dash}" marker-end="url(#arrow-small)" />`,
      `<text x="780" y="${y + 4}" font-size="11" fill="#cbd5e1">${escapeXml(label)}</text>`,
    ].join("");
  }).join("");

  return `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 ${viewHeight}" width="960" height="${viewHeight}" role="img" aria-label="${escapeXml(spec.title)}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#020617" />
        <stop offset="100%" stop-color="#0f172a" />
      </linearGradient>
      <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
        <path d="M0,0 L0,6 L9,3 z" fill="#cbd5e1" />
      </marker>
      <marker id="arrow-small" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto" markerUnits="strokeWidth">
        <path d="M0,0 L0,6 L8,3 z" fill="#cbd5e1" />
      </marker>
    </defs>
    <rect x="0" y="0" width="960" height="${viewHeight}" fill="url(#bg)" />
    <text x="48" y="44" font-size="22" font-weight="700" fill="#f8fafc">${escapeXml(spec.title)}</text>
    <text x="48" y="64" font-size="12" fill="#94a3b8">Derived ${escapeXml(spec.diagramKind)} preview via VisualRenderSpec</text>
    ${laneMarkup}
    <rect x="712" y="72" width="208" height="${Math.max(96, legend.length * 22 + 26)}" rx="12" ry="12" fill="#111827" stroke="#334155" stroke-width="1" opacity="0.92" />
    <text x="728" y="90" font-size="11" font-weight="700" fill="#94a3b8">Legend</text>
    ${legendMarkup}
    ${edgeMarkup}
    ${nodeMarkup}
  </svg>`;
}
