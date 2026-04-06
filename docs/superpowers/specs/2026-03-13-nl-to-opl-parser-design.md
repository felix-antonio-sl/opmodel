# NL → OPL Parser via LLM — Design Spec

**Fecha:** 2026-03-13
**Estado:** Aprobado
**Autor:** fxsl/arquitecto-categorico
**Sub-proyecto:** B (L-M2-03)

---

## Resumen

Construir un pipeline que transforme lenguaje natural en `OplEdit[]` aplicables al modelo OPM. El LLM actúa como profunctor aproximado `P: C_opm^op × C_nl → Set`, confinando la impureza en un solo morfismo. Dos modos: descripción completa de sistema y edits incrementales.

## Justificación categórica

### Diagrama principal

```
                    F (impuro)                α (puro)                G (puro)
NL × Context ────────────────→ NlEditDescriptor[] ──────────→ OplEdit[] ──────────→ Result<Model>
               (LLM)                              (resolve)              (applyOplEdit*)
```

### Path equations

```
PE-1: render ∘ expose ∘ apply* ∘ resolve ∘ generate ≈ "NL intent"  (aproximada — LLM boundary)
PE-2: editsFrom ∘ expose ∘ apply*(edits, m) = edits                (PutGet, heredada DA-6)
PE-3: apply*(editsFrom(expose(m)), m) = m                          (GetPut, heredada DA-6)
```

PE-1 es la única ecuación no estricta. Corresponde al boundary impuro (el LLM). Todo downstream conmuta exactamente.

### Tensiones resueltas

| Tensión | Categoría | Colapso |
|---------|-----------|---------|
| Formal ↔ Informal (A4) | `NlEditDescriptor` como coequalizador — forma normal de la intención | Hacia Formal |
| Estático ↔ Dinámico (A2) | `resolveAll` como coalgebra `State<Model, OplEdit[]>` — fold monádico | State monad |
| Token ↔ Type (A1) | `resolve` como counit ε de adjunción `Free ⊣ Forget` — nombres → IDs | Evaluación |

### El LLM como profunctor

```
P: C_opm^op × C_nl → Set
P(model, nl) = { descriptor[] | interpretaciones plausibles de nl dado model }
```

Contravariante en model (más contexto → output más refinado), covariante en NL (más texto → más descriptors). Single-best mode colapsa al objeto terminal del Set de interpretaciones.

---

## Decisiones de diseño

| Decisión | Alternativas descartadas | Justificación |
|----------|--------------------------|---------------|
| NlEditDescriptor (name-space) | OplEdit directo, OPL text + parser | Pullback correcto Name/ID; LLM no necesita conocer IDs internos |
| LLM provider agnóstico | Claude-only, OpenAI-only | Interfaz minimal `complete(messages) → string`; no acopla a tool use |
| Paquete `@opmodel/nl` aislado | En core, en web | Core permanece zero-dep; reutilizable desde tooling/script surfaces |
| Single-best con preview | Multi-candidate, clarification loop | YAGNI; preview existente es gate de validación humana |
| API key: env var + UI | Solo env, solo UI | tooling local necesita env; web necesita UI; localStorage no contamina Model |
| Input multilingüe, output preserva idioma | English-only, traducción forzada | OPL no prescribe idioma de nombres; LLM maneja multilingüe nativamente |
| No rollback en partial apply | Transacción batch | Consistente con undo/redo existente; cada dispatch = pushHistory. Batch undo planificado V1.1 |
| Exceptions en pipeline (no Result) | Result<NlResult, NlError> | Boundary async/impuro: `Promise` ya usa throw/catch nativamente. Result se usa dentro de parse y resolve (puros). La frontera impura (LLM API) lanza excepciones que pipeline propaga. |

---

## Tipos centrales

### NlEditDescriptor — OplEdit en name-space

```typescript
type NlEditDescriptor =
  | { kind: "add-thing"; name: string; thingKind: "object" | "process";
      essence?: Essence; affiliation?: Affiliation }
  | { kind: "remove-thing"; name: string }
  | { kind: "add-states"; thingName: string; stateNames: string[] }
  | { kind: "remove-state"; thingName: string; stateName: string }
  | { kind: "add-link"; sourceName: string; targetName: string;
      linkType: LinkType; sourceState?: string; targetState?: string }
  | { kind: "remove-link"; sourceName: string; targetName: string;
      linkType: LinkType }
  | { kind: "add-modifier"; sourceName: string; targetName: string;
      linkType: LinkType; modifierType: ModifierType; negated?: boolean }
  | { kind: "remove-modifier"; sourceName: string; targetName: string;
      linkType: LinkType; modifierType: ModifierType }
```

### LLMProvider — interfaz agnóstica

```typescript
interface LLMProvider {
  complete(messages: LLMMessage[], options?: LLMOptions): Promise<string>;
}

interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
}
```

### NlPipeline — orquestador

```typescript
interface NlPipeline {
  generate(nl: string, context: NlContext): Promise<NlResult>;
}

interface NlContext {
  model: Model;
  opdId: string;
}

interface NlResult {
  edits: OplEdit[];                // listos para dispatch
  descriptors: NlEditDescriptor[]; // para inspección
  preview: string;                 // OPL text del modelo proyectado
}
```

### NlConfig — configuración

```typescript
interface NlConfig {
  provider: "claude" | "openai";
  apiKey: string;
  model?: string;
}
```

### Error types

```typescript
interface ParseError {
  raw: string;
  message: string;
  index?: number;        // posición del descriptor problemático
}

interface ResolveError {
  descriptor: NlEditDescriptor;
  message: string;
  index: number;
}
```

---

## Arquitectura de componentes

### Estructura de archivos

```
packages/nl/
├── src/
│   ├── types.ts           ← NlEditDescriptor, LLMProvider, NlResult, errors
│   ├── provider.ts        ← ClaudeProvider, OpenAIProvider, createProvider
│   ├── prompt.ts          ← buildSystemPrompt, buildContextMessage, SCHEMA_DESCRIPTION
│   ├── parse.ts           ← parse(raw: string) → Result<NlEditDescriptor[], ParseError>
│   ├── resolve.ts         ← resolve(descs, model, opdId) → Result<OplEdit[], ResolveError>
│   ├── pipeline.ts        ← createPipeline(config) → NlPipeline
│   └── index.ts           ← exports públicos
├── tests/
│   ├── parse.test.ts
│   ├── resolve.test.ts
│   ├── prompt.test.ts
│   └── pipeline.test.ts
├── package.json
└── tsconfig.json
```

### Diagrama de dependencias

```
@opmodel/core (types, expose, render, applyOplEdit)
       ↑
@opmodel/nl (pipeline, resolve, parse, prompt, provider)
       ↑                    ↑
@opmodel/web            tooling/script surfaces (futuro)
```

### package.json

```json
{
  "name": "@opmodel/nl",
  "version": "0.1.0",
  "type": "module",
  "main": "src/index.ts",
  "dependencies": {
    "@opmodel/core": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.8.2"
  }
}
```

Sin dependencia directa en SDK de Anthropic u OpenAI. Los providers usan `fetch` nativo (disponible en Bun y browsers modernos). Esto evita dependencias pesadas y mantiene el paquete ligero.

---

## Componente 1: prompt.ts

**Responsabilidad:** Construir los mensajes para el LLM.

### buildSystemPrompt()

Prompt fijo que establece:
- Rol: OPM modeling assistant
- Output format: JSON array de NlEditDescriptor
- Los 8 kinds con sus campos y defaults
- Reglas de ordenamiento (things antes de links/states)
- Preservar idioma del usuario para nombres

### buildContextMessage(model, opdId)

Contexto dinámico que incluye:
- Lista de things existentes: `"- Water (object, physical, systemic)"`
- Lista de states por thing: `"- Water: cold, hot"`
- OPL text actual via `render(expose(model, opdId))`
- Instrucción de reusar nombres existentes

Opera sobre la fibra `π⁻¹(opdId)` — solo expone entidades visibles en el OPD actual.

### buildUserMessage(nl)

Simplemente wrappea el input del usuario con instrucción de generar edits.

**Estimación:** ~80 líneas.

---

## Componente 2: parse.ts

**Responsabilidad:** Validar y normalizar el output del LLM.

### parse(raw: string): Result<NlEditDescriptor[], ParseError>

1. Extraer JSON del response: buscar primer array JSON con regex `/\[[\s\S]*\]/`, fallback al string completo. Maneja markdown fences, texto explicativo antes/después del JSON.
2. `JSON.parse` → `unknown`
3. Validar: es array
4. Por cada elemento:
   - `kind` es uno de los 8 válidos
   - Campos requeridos presentes según kind
   - Tipos correctos (string, array de strings, etc.)
5. Aplicar defaults: `essence → "informatical"`, `affiliation → "systemic"`, `negated → false`
6. Normalizar: `trim()` todos los nombres

**Estimación:** ~100 líneas.

---

## Componente 3: resolve.ts

**Responsabilidad:** Mapear name-space → ID-space.

### resolve(descriptors, model, opdId): Result<OplEdit[], ResolveError>

Fold secuencial con modelo acumulado (State coalgebra):

```typescript
function resolve(
  descriptors: NlEditDescriptor[],
  model: Model,
  opdId: string
): Result<OplEdit[], ResolveError> {
  const edits: OplEdit[] = [];
  let current = model;

  for (let i = 0; i < descriptors.length; i++) {
    const desc = descriptors[i];
    const editResult = resolveOne(desc, current, opdId);
    if (!editResult.ok) return err({ ...editResult.error, index: i });

    const edit = editResult.value;
    edits.push(edit);

    const nextModel = applyOplEdit(current, edit);
    if (!nextModel.ok) return err({
      descriptor: desc, index: i,
      message: `Edit application failed: ${nextModel.error.code}`
    });
    current = nextModel.value;
  }

  return ok(edits);
}
```

### resolveOne(desc, model, opdId): Result<OplEdit, ResolveError>

Reglas de resolución por kind:

| Kind | Resolución | Notas de mapeo |
|------|-----------|----------------|
| `add-thing` | No resuelve — entidad nueva. Position incremental: `{x: 100 + (addThingCount * 150), y: 100}`. Defaults: essence→"informatical", affiliation→"systemic". | **Mapeo campo:** `desc.thingKind` → `thing.kind` (el descriptor usa `thingKind` para claridad LLM, `Thing` type usa `kind`) |
| `remove-thing` | `findThingByName(model, desc.name)` → `thingId` | |
| `add-states` | `findThingByName(model, desc.thingName)` → `thingId` | |
| `remove-state` | `findThingByName` → `findStateByName(model, thingId, desc.stateName)` → `stateId` | |
| `add-link` | `findThingByName` para source y target. States opcionales: `sourceState` se resuelve en los states del source thing, `targetState` en los del target thing. Si no se encuentra en el thing correspondiente → error. | State resolution es parent-scoped |
| `remove-link` | Busca link por `sourceName + targetName + linkType` | |
| `add-modifier` | Busca link → `linkId` | |
| `remove-modifier` | Busca modifier por link + tipo | |

`resolveOne` mantiene un counter interno (`addThingCount`) para posicionamiento incremental de entidades nuevas, evitando que se apilen en el mismo punto.

### resolveOne error construction

Cuando `resolveOne` falla (e.g., nombre no encontrado), retorna:

```typescript
return err({
  descriptor: desc,
  message: `Thing not found: "${name}"`,
  index: -1,  // placeholder, overridden by resolve() caller
});
```

El caller `resolve()` aplica el `index` correcto via spread: `{ ...editResult.error, index: i }`.

### findThingByName(model, name): case-insensitive match

```typescript
// O(n) linear scan — acceptable for typical model sizes (<500 things).
// Consider name index Map<string, string> if perf needed.
function findThingByName(model: Model, name: string): Thing | undefined {
  return [...model.things.values()].find(
    t => t.name.toLowerCase() === name.toLowerCase()
  );
}
```

### findStateByName, findLinkByEndpoints, findModifier

Helpers análogos con la misma estrategia: scan lineal, case-insensitive para nombres, exact match para tipos.

**Estimación:** ~130 líneas.

---

## Componente 4: provider.ts

**Responsabilidad:** Implementations de LLMProvider.

### ClaudeProvider

```typescript
class ClaudeProvider implements LLMProvider {
  constructor(private apiKey: string, private model = "claude-sonnet-4-20250514") {}

  async complete(messages: LLMMessage[], options?: LLMOptions): Promise<string> {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: options?.maxTokens ?? 4096,
        messages: messages
          .filter(m => m.role !== "system")
          .map(m => ({ role: m.role, content: m.content })),
        system: messages.find(m => m.role === "system")?.content,
        temperature: options?.temperature ?? 0,
      }),
    });
    if (!response.ok) throw new Error(`Claude API error: ${response.status}`);
    const data = await response.json();
    return data.content[0].text;
  }
}
```

### OpenAIProvider

```typescript
class OpenAIProvider implements LLMProvider {
  constructor(private apiKey: string, private model = "gpt-4o") {}

  async complete(messages: LLMMessage[], options?: LLMOptions): Promise<string> {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        max_completion_tokens: options?.maxTokens ?? 4096,
        temperature: options?.temperature ?? 0,
      }),
    });
    if (!response.ok) throw new Error(`OpenAI API error: ${response.status}`);
    const data = await response.json();
    return data.choices[0].message.content;
  }
}
```

### createProvider(config): LLMProvider

```typescript
function createProvider(config: NlConfig): LLMProvider {
  switch (config.provider) {
    case "claude": return new ClaudeProvider(config.apiKey, config.model);
    case "openai": return new OpenAIProvider(config.apiKey, config.model);
  }
}
```

**Estimación:** ~80 líneas.

---

## Componente 5: pipeline.ts

**Responsabilidad:** Orquestar generate → parse → resolve.

```typescript
function createPipeline(config: { provider: LLMProvider }): NlPipeline {
  return {
    async generate(nl: string, context: NlContext): Promise<NlResult> {
      // Context + user input merged in single user message
      // (Anthropic API requires strict user/assistant alternation)
      const messages: LLMMessage[] = [
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: buildContextMessage(context.model, context.opdId)
            + "\n\n" + buildUserMessage(nl) },
      ];

      // Input validation
      const trimmed = nl.trim();
      if (!trimmed) throw new Error("Empty input");
      if (trimmed.length > 10000) throw new Error("Input too long (max 10000 chars)");
      // Note: prompt injection is an accepted risk for single-user tool (no adversarial threat model)

      const raw = await config.provider.complete(messages, { temperature: 0 });

      const parseResult = parse(raw);
      if (!parseResult.ok) throw new Error(parseResult.error.message);

      const descriptors = parseResult.value;
      const resolveResult = resolve(descriptors, context.model, context.opdId);
      if (!resolveResult.ok) throw new Error(resolveResult.error.message);

      const edits = resolveResult.value;

      // Compute preview: apply all edits to get projected model
      let projected = context.model;
      for (const edit of edits) {
        const r = applyOplEdit(projected, edit);
        if (r.ok) projected = r.value;
      }
      const preview = render(expose(projected, context.opdId));

      return { edits, descriptors, preview };
    },
  };
}
```

**Estimación:** ~40 líneas.

---

## Integración Web

### OplEditorView.tsx — extensión

El textarea NL se agrega **arriba** del formulario estructurado existente, separados por un divider. Ambos son inyecciones del coproducto `Input = NL ⊔ Form`.

**Nuevas props:**

```typescript
interface Props {
  model: Model;
  opdId: string;
  dispatch: (cmd: Command) => boolean;
  nlPipeline?: NlPipeline;  // opcional — graceful degradation sin API key
}
```

**Nuevo estado:**

```typescript
const [nlText, setNlText] = useState("");
const [nlResult, setNlResult] = useState<NlResult | null>(null);
const [nlLoading, setNlLoading] = useState(false);
const [nlError, setNlError] = useState<string | null>(null);
```

**Handlers:**

- `handleGenerate`: calls `pipeline.generate(nlText, {model, opdId})`, sets result/error
- `handleApplyAll`: forEach `nlResult.edits` → `dispatch({ tag: "applyOplEdit", edit })`, clears on success
- `handleClearNl`: resets nlText, nlResult, nlError

**Layout:**

```
┌─────────────────────────────────┐
│ [textarea NL]                   │
│ [Generate]                      │
│ [Preview text]                  │
│ [Apply All] [Clear]             │
│ ── or use structured form ────  │
│ [Action dropdown + fields]      │
│ [Apply Edit]                    │
└─────────────────────────────────┘
```

Si `nlPipeline` es undefined, la sección NL se oculta.

### OplPanel.tsx — props extendidos

```typescript
interface OplPanelProps {
  model: Model;
  opdId: string;
  selectedThing: string | null;
  dispatch: (cmd: Command) => boolean;
  nlPipeline?: NlPipeline;
}
```

Pasa `nlPipeline` al `OplEditorView`.

### App.tsx — pipeline creation

```typescript
// State (not memo) so NlSettingsModal can trigger re-creation
const [nlConfig, setNlConfig] = useState<NlConfig | null>(() => {
  // 1. Check localStorage
  const stored = localStorage.getItem("opmodel:nl-config");
  if (stored) return JSON.parse(stored) as NlConfig;
  // 2. Check env var
  const key = import.meta.env.VITE_ANTHROPIC_API_KEY;
  if (key) return { provider: "claude" as const, apiKey: key };
  return null;
});

const nlPipeline = useMemo(() => {
  if (!nlConfig) return undefined;
  const provider = createProvider(nlConfig);
  return createPipeline({ provider });
}, [nlConfig]);

// NlSettingsModal receives setNlConfig to update config on save
```

### NlSettingsModal — nuevo componente minimal

Modal accesible desde un icono ⚙ en el header. Campos: provider dropdown, API key input (password type) con validación de formato (`sk-ant-*` para Claude, `sk-*` para OpenAI), modelo opcional. Guarda en `localStorage opmodel:nl-config`. Recibe `setNlConfig` como prop para actualizar el pipeline al guardar. ~60 líneas.

### CSS additions

```css
.opl-editor__nl-section { }
.opl-editor__nl-textarea { }
.opl-editor__nl-generate { }
.opl-editor__nl-generate--loading { }
.opl-editor__nl-preview { }
.opl-editor__nl-actions { }
.opl-editor__nl-divider { }
.nl-settings { }
.nl-settings__field { }
```

---

## Testing

### Estrategia por capa

| Archivo test | Capa | Mock | Tests estimados |
|-------------|------|------|-----------------|
| `parse.test.ts` | parse | Ninguno | ~12 (válidos, defaults, fences, errores) |
| `resolve.test.ts` | resolve | Ninguno | ~15 (por kind, batch, case-insensitive, errores) |
| `pipeline.test.ts` | pipeline | LLMProvider mock | ~5 (end-to-end, errors, empty) |
| `prompt.test.ts` | prompt | Ninguno | ~4 (system, context, empty model) |

**Total:** ~36 tests.

### Smoke test round-trip (PE-1)

Test que solo se ejecuta con API key real (skip en CI):

```typescript
test("round-trip: render(model) → generate → resolve ≈ model", async () => {
  const text = render(expose(baseModel, opdId));
  const result = await pipeline.generate(text, { model: emptyModel, opdId });
  expect(result.descriptors.some(d => d.kind === "add-thing" && d.name === "Water")).toBe(true);
});
```

---

## Error handling

| Punto de fallo | Error type | Acción en UI |
|----------------|-----------|--------------|
| LLM API (network, auth, rate limit) | `Error` from provider | "API error: {message}" |
| LLM retorna JSON inválido | `ParseError` | "Could not parse response" + raw excerpt |
| Descriptor con kind inválido | `ParseError` | "Unknown edit kind: {kind}" |
| Nombre no encontrado en modelo | `ResolveError` | "Thing not found: {name}" con index |
| applyOplEdit rechaza invariante | `InvariantError` | "Edit rejected: {code}" — partial apply, user can undo |

No hay rollback automático. Cada `dispatch` es un `pushHistory` independiente. El usuario revierte con Ctrl+Z.

---

## Resumen de cambios

| Archivo | Tipo | Cambio |
|---------|------|--------|
| `packages/nl/src/types.ts` | Nuevo | NlEditDescriptor, LLMProvider, NlResult, errors |
| `packages/nl/src/prompt.ts` | Nuevo | System prompt, context builder |
| `packages/nl/src/parse.ts` | Nuevo | JSON validation + normalization |
| `packages/nl/src/resolve.ts` | Nuevo | Name→ID resolution with accumulated model |
| `packages/nl/src/provider.ts` | Nuevo | Claude + OpenAI providers via fetch |
| `packages/nl/src/pipeline.ts` | Nuevo | Orchestrator: generate → parse → resolve |
| `packages/nl/src/index.ts` | Nuevo | Public exports |
| `packages/nl/package.json` | Nuevo | Workspace package |
| `packages/nl/tsconfig.json` | Nuevo | TypeScript config |
| `packages/web/src/components/OplEditorView.tsx` | Extend | NL textarea + generate + apply all |
| `packages/web/src/components/OplPanel.tsx` | Minor | Pass nlPipeline prop |
| `packages/web/src/components/NlSettingsModal.tsx` | Nuevo | API key config (~60 líneas) |
| `packages/web/src/App.tsx` | Minor | Create pipeline, pass to OplPanel |
| `packages/web/src/App.css` | Extend | NL section + settings styles |
| `packages/web/package.json` | Extend | Add @opmodel/nl dependency |
| `package.json` (root) | Extend | Add packages/nl to workspaces |

**Total estimado:** ~420 líneas código NL + ~300 líneas tests + ~120 líneas web integration.

---

## Limitaciones conocidas (V1)

- **No hay descriptor "set-duration":** El LLM no puede expresar "Heating takes 5 minutes" para things existentes. Solo add-thing con duration funciona para cosas nuevas. Requiere un futuro `update-thing` descriptor.
- **No hay descriptor "rename-thing":** "Rename Water to H2O" no es posible sin remove + add (pierde links/states). Requiere un `rename-thing` OplEdit en core.
- **No retry en API failures:** 429/5xx fallan inmediatamente. Retry con backoff planificado para V1.1.
- **Batch undo:** N edits = N history entries. Ctrl+Z N veces para revertir una generación. Batch undo planificado V1.1.

---

## Mejoras futuras (fuera de scope V1)

- **Multi-candidate mode:** Retornar N interpretaciones rankeadas para selección
- **Clarification loop:** Multi-turn si ambigüedad alta
- **Streaming:** Mostrar descriptors conforme el LLM los genera
- **Tooling integration:** flujo scriptable `nl:describe` usando @opmodel/nl
- **Retry with backoff:** 1 retry tras 1s para 429/5xx
- **Batch undo:** Command `applyOplEditBatch` con un solo pushHistory para rollback atómico
- **update-thing / rename-thing:** Nuevos OplEdit kinds en core para edits de modificación
