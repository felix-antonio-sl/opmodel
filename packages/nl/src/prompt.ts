import type { Model } from "@opmodel/core";
import { expose, render } from "@opmodel/core";

const SCHEMA_DESCRIPTION = `
1. Add a thing:
   {"kind":"add-thing","name":"...","thingKind":"object"|"process","essence":"informatical"|"physical","affiliation":"systemic"|"environmental"}
   - essence and affiliation are optional (default: informatical, systemic)

2. Remove a thing:
   {"kind":"remove-thing","name":"..."}

3. Add states to a thing:
   {"kind":"add-states","thingName":"...","stateNames":["state1","state2",...]}

4. Remove a state:
   {"kind":"remove-state","thingName":"...","stateName":"..."}

5. Add a link:
   {"kind":"add-link","sourceName":"...","targetName":"...","linkType":"agent"|"instrument"|"effect"|"consumption"|"result"|"input"|"output"|"aggregation"|"exhibition"|"generalization"|"classification"|"tagged"|"invocation"|"exception","sourceState":"...","targetState":"..."}
   - sourceState and targetState are optional (for state-specified links)

6. Remove a link:
   {"kind":"remove-link","sourceName":"...","targetName":"...","linkType":"..."}

7. Add a modifier:
   {"kind":"add-modifier","sourceName":"...","targetName":"...","linkType":"...","modifierType":"event"|"condition","negated":false}
   - negated is optional (default: false)

8. Remove a modifier:
   {"kind":"remove-modifier","sourceName":"...","targetName":"...","linkType":"...","modifierType":"event"|"condition"}
`;

export function buildSystemPrompt(): string {
  return `You are an OPM (Object Process Methodology, ISO 19450) modeling assistant.
Your task: convert natural language descriptions into structured JSON edits.

You MUST respond with a JSON array of edit descriptors. Nothing else — no explanation, no markdown.

Each descriptor is one of these 8 kinds:
${SCHEMA_DESCRIPTION}
Rules:
- Use the EXACT names of existing things when referencing them.
- For new things, choose clear descriptive names in the user's language.
- Default essence: "informatical", default affiliation: "systemic".
- Links require both source and target to exist or be created earlier in the array.
- Order matters: create things BEFORE referencing them in links or states.
- Preserve the user's language for entity names (do not translate names).
- Respond with the JSON array. You may optionally wrap it in \`\`\`json fences.`;
}

export function buildContextMessage(model: Model, opdId: string): string {
  const doc = expose(model, opdId);
  const text = render(doc);

  // Filter things by OPD fiber: only things with an appearance in this OPD
  const visibleThingIds = new Set(
    [...model.appearances.values()]
      .filter(a => a.opd === opdId)
      .map(a => a.thing),
  );
  const things = [...model.things.values()].filter(t => visibleThingIds.has(t.id));
  const thingList = things.length > 0
    ? things.map(t => `- ${t.name} (${t.kind}, ${t.essence}, ${t.affiliation})`).join("\n")
    : "(none)";

  // States scoped to visible things only
  const statesByThing = new Map<string, string[]>();
  for (const s of model.states.values()) {
    if (!visibleThingIds.has(s.parent)) continue;
    const parent = model.things.get(s.parent);
    if (parent) {
      const list = statesByThing.get(parent.name) ?? [];
      list.push(s.name);
      statesByThing.set(parent.name, list);
    }
  }
  const stateList = statesByThing.size > 0
    ? [...statesByThing.entries()].map(([thing, names]) => `- ${thing}: ${names.join(", ")}`).join("\n")
    : "(none)";

  return `Current model (OPD: "${doc.opdName}"):

Things:
${thingList}

States:
${stateList}

Current OPL:
${text || "(empty model)"}

Generate edits that integrate with the existing model. Reuse existing thing names when the user refers to them.`;
}

export function buildUserMessage(nl: string): string {
  return `User request:\n${nl}\n\nGenerate the JSON array of edit descriptors.`;
}
