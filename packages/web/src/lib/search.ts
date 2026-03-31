import type { Model, Thing } from "@opmodel/core";

export interface SearchResult {
  thing: Thing;
  matchedStates: string[];
  opdNames: string[];
  inCurrentOpd: boolean;
  score: number;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

export function buildSearchResults(
  model: Model,
  query: string,
  currentOpd: string,
  limit = 20,
): SearchResult[] {
  const q = query.trim().toLowerCase();

  return [...model.things.values()]
    .map((thing) => {
      const name = thing.name.toLowerCase();
      const notes = thing.notes?.toLowerCase() ?? "";
      const matchedStates = [...model.states.values()]
        .filter((state) => state.parent === thing.id && state.name.toLowerCase().includes(q))
        .map((state) => state.name);

      const appearances = [...model.appearances.values()].filter((app) => app.thing === thing.id);
      const opdNames = uniqueStrings(
        appearances
          .map((app) => model.opds.get(app.opd)?.name)
          .filter((name): name is string => Boolean(name)),
      );
      const inCurrentOpd = appearances.some((app) => app.opd === currentOpd);

      let score = 0;
      if (q.length === 0) {
        score = inCurrentOpd ? 20 : 0;
      } else {
        if (name === q) score += 120;
        else if (name.startsWith(q)) score += 80;
        else if (name.includes(q)) score += 50;

        if (matchedStates.length > 0) score += 45 + matchedStates.length * 5;
        if (notes.includes(q)) score += 15;
        if (inCurrentOpd) score += 25;
      }

      return { thing, matchedStates, opdNames, inCurrentOpd, score };
    })
    .filter((result) => q.length === 0 || result.score > 0)
    .sort((a, b) => b.score - a.score || a.thing.name.localeCompare(b.thing.name))
    .slice(0, limit);
}
