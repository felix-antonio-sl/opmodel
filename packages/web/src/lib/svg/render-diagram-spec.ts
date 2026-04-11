import type { DiagramSpec } from "@opmodel/core";

function escapeXml(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderDiagramSpec(spec: DiagramSpec): string {
  const lanes = {
    left: { x: 70, title: "Context" },
    center: { x: 370, title: "Function" },
    right: { x: 670, title: "System" },
  } as const;

  const laneBuckets = {
    left: spec.nodes.filter((node) => node.lane === "left"),
    center: spec.nodes.filter((node) => node.lane === "center"),
    right: spec.nodes.filter((node) => node.lane === "right" || !node.lane),
  };

  const geometry = new Map<string, { x: number; y: number; w: number; h: number }>();
  (Object.keys(laneBuckets) as Array<keyof typeof laneBuckets>).forEach((laneKey) => {
    laneBuckets[laneKey].forEach((node, index) => {
      const h = node.kind === "process" ? 88 : 58;
      const w = node.kind === "process" ? 220 : 210;
      geometry.set(node.id, {
        x: lanes[laneKey].x,
        y: 110 + index * 96,
        w,
        h,
      });
    });
  });

  const nodeMarkup = spec.nodes.map((node) => {
    const box = geometry.get(node.id);
    if (!box) return "";
    const isProcess = node.kind === "process";
    const fill = isProcess ? "#1f6feb" : node.kind === "external" ? "#2d333b" : node.kind === "system" ? "#0f766e" : "#374151";
    const shape = isProcess
      ? `<rect x="${box.x}" y="${box.y}" rx="24" ry="24" width="${box.w}" height="${box.h}" fill="${fill}" stroke="#94a3b8" stroke-width="2" />`
      : `<rect x="${box.x}" y="${box.y}" rx="14" ry="14" width="${box.w}" height="${box.h}" fill="${fill}" stroke="#94a3b8" stroke-width="2" />`;
    return `${shape}<text x="${box.x + box.w / 2}" y="${box.y + box.h / 2 + 4}" text-anchor="middle" font-size="14" font-weight="600" fill="#f8fafc">${escapeXml(node.label)}</text>`;
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
    return [
      `<path d="M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}" fill="none" stroke="#93c5fd" stroke-width="2" marker-end="url(#arrow)" opacity="0.9" />`,
      `<text x="${(x1 + x2) / 2}" y="${midY - 8}" text-anchor="middle" font-size="11" fill="#cbd5e1">${escapeXml(edge.label ?? edge.kind)}</text>`,
    ].join("");
  }).join("");

  const laneMarkup = (Object.keys(lanes) as Array<keyof typeof lanes>).map((laneKey) => {
    const lane = lanes[laneKey];
    return `
      <rect x="${lane.x - 24}" y="72" width="260" height="${Math.max(460, spec.nodes.length * 96)}" rx="18" ry="18" fill="#111827" stroke="#334155" stroke-width="1.5" opacity="0.95" />
      <text x="${lane.x}" y="98" font-size="12" font-weight="700" fill="#94a3b8">${lane.title}</text>
    `;
  }).join("");

  return `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 640" width="960" height="640" role="img" aria-label="${escapeXml(spec.title)}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#020617" />
        <stop offset="100%" stop-color="#0f172a" />
      </linearGradient>
      <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
        <path d="M0,0 L0,6 L9,3 z" fill="#93c5fd" />
      </marker>
    </defs>
    <rect x="0" y="0" width="960" height="640" fill="url(#bg)" />
    <text x="48" y="44" font-size="22" font-weight="700" fill="#f8fafc">${escapeXml(spec.title)}</text>
    <text x="48" y="64" font-size="12" fill="#94a3b8">Derived SD preview</text>
    ${laneMarkup}
    ${edgeMarkup}
    ${nodeMarkup}
  </svg>`;
}
