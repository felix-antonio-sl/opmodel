export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function center(r: Rect): Point {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

/** Where a line from rect center toward `target` exits the rectangle boundary */
export function rectEdgePoint(rect: Rect, target: Point): Point {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const dx = target.x - cx;
  const dy = target.y - cy;

  if (dx === 0 && dy === 0) return { x: cx, y: cy };

  const halfW = rect.w / 2;
  const halfH = rect.h / 2;

  if (Math.abs(dx) * halfH > Math.abs(dy) * halfW) {
    const sign = dx > 0 ? 1 : -1;
    return { x: cx + sign * halfW, y: cy + (dy * halfW) / Math.abs(dx) };
  } else {
    const sign = dy > 0 ? 1 : -1;
    return { x: cx + (dx * halfH) / Math.abs(dy), y: cy + sign * halfH };
  }
}

/** Where a line from ellipse center toward `target` exits the ellipse boundary */
export function ellipseEdgePoint(rect: Rect, target: Point): Point {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const a = rect.w / 2;
  const b = rect.h / 2;
  const dx = target.x - cx;
  const dy = target.y - cy;

  if (dx === 0 && dy === 0) return { x: cx, y: cy };

  const angle = Math.atan2(dy, dx);
  return {
    x: cx + a * Math.cos(angle),
    y: cy + b * Math.sin(angle),
  };
}

/** Midpoint between two points */
export function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Distance between two points */
export function distance(a: Point, b: Point): number {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
}

/** Angle from a to b in degrees */
export function angleDeg(a: Point, b: Point): number {
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
}
