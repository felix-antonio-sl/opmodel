export interface History<T> {
  past: T[];
  present: T;
  future: T[];
}

export function createHistory<T>(initial: T): History<T> {
  return { past: [], present: initial, future: [] };
}

export function pushHistory<T>(h: History<T>, snapshot: T): History<T> {
  return {
    past: [...h.past, h.present],
    present: snapshot,
    future: [],
  };
}

export function undo<T>(h: History<T>): History<T> | null {
  if (h.past.length === 0) return null;
  const past = [...h.past];
  const prev = past.pop()!;
  return { past, present: prev, future: [h.present, ...h.future] };
}

export function redo<T>(h: History<T>): History<T> | null {
  if (h.future.length === 0) return null;
  const [next, ...rest] = h.future;
  return { past: [...h.past, h.present], present: next!, future: rest };
}
