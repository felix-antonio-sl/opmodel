export interface FanOverlayGeometry {
  primaryPath: string;
  secondaryPath: string | null;
}

export interface FanOverlayPoint {
  x: number;
  y: number;
}

export function buildFanOverlayGeometry(
  sharedCenter: FanOverlayPoint,
  arcPoints: FanOverlayPoint[],
  fanType: "xor" | "or",
): FanOverlayGeometry | null {
  if (arcPoints.length < 2) return null;

  const polar = arcPoints.map((p) => ({
    angle: Math.atan2(p.y - sharedCenter.y, p.x - sharedCenter.x),
    r: Math.sqrt((p.x - sharedCenter.x) ** 2 + (p.y - sharedCenter.y) ** 2),
  }));
  polar.sort((a, b) => a.angle - b.angle);

  let maxGap = 0;
  let maxGapIdx = 0;
  for (let i = 0; i < polar.length; i++) {
    const next = (i + 1) % polar.length;
    let gap = polar[next]!.angle - polar[i]!.angle;
    if (gap <= 0) gap += 2 * Math.PI;
    if (gap > maxGap) {
      maxGap = gap;
      maxGapIdx = i;
    }
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

  const avgR = ordered.reduce((sum, p) => sum + p.r, 0) / ordered.length;
  const baseRadius = Math.max(avgR + 10, 26);
  const minAngle = ordered[0]!.angle;
  const maxAngle = ordered[ordered.length - 1]!.angle;
  const steps = 36;

  function arcPath(radius: number): string {
    const points: string[] = [];
    for (let i = 0; i <= steps; i++) {
      const a = minAngle + ((maxAngle - minAngle) * i) / steps;
      const x = sharedCenter.x + radius * Math.cos(a);
      const y = sharedCenter.y + radius * Math.sin(a);
      points.push(`${x},${y}`);
    }
    return `M ${points.join(" L ")}`;
  }

  return {
    primaryPath: arcPath(baseRadius),
    secondaryPath: fanType === "or" ? arcPath(baseRadius + 10) : null,
  };
}
