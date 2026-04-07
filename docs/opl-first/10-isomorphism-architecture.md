# ADR-003: Arquitectura categorial para isomorfismo OPL ↔ OPD

| Campo | Valor |
|-------|-------|
| Fecha | 2026-04-07 |
| Estado | **Vinculante** |
| Precede | ADR-002 (Semantic Kernel + Fibrated OPD Atlas) |
| Autor | Felix (Ominono) |

## Problema

El pipeline actual rompe el isomorfismo entre OPL y OPD en tres puntos:

| Ruptura | Dónde | Efecto |
|---------|-------|--------|
| R1 | `compileOplDocument → Model` | Pierde `sourceInfo`, `InZoomStep[]`, `origin` de invocations |
| R2 | `semanticKernelFromModel` | Reconstruye refinements como `completeness: "partial"`, steps vacíos |
| R3 | `exposeFromSemanticKernel` / `renderAllFromSemanticKernel` | Round-trip por Model para usar funciones legacy de render |

El compiler targeta `Model` (tipo legacy con appearances, fans, modifiers planos), no `SemanticKernel`. Toda función que opera sobre el kernel pasa por `legacyModelFromSemanticKernel(kernel)`, re-inyectando la mezcla semántica/geometría.

## Tesis categorial

### Lo que NO es isomorfo

```
OPL text ≇ OPD visual
```

OPL no contiene layout (x,y,w,h). OPD no contiene spans textuales. Son representaciones en categorías distintas.

### Lo que SÍ es isomorfo

```
OPL/~ ≅ SemanticKernel ≅ Atlas/~
```

Donde `~` es la relación de equivalencia que identifica representaciones del mismo sistema OPM (normalización sintáctica para OPL, normalización visual/estructural para Atlas).

### Propiedad universal

`SemanticKernel` es el **ecualizador** de las dos representaciones:

```
Para todo par (opl, opd) tales que denotan el mismo sistema OPM,
existe un único S : SemanticKernel tal que:
  Render(S) = normalize(opl)
  Expose(S) = normalize_visual(opd)
```

Esto es un **span de equivalencias**:

```
          S
         / \
    ≅  /     \  ≅
      /         \
    𝒫/~        𝒜/~
 (OPL mod      (Atlas mod
  syntax)       layout)
```

## Las cinco categorías

| Categoría | Objetos | Rol |
|-----------|---------|-----|
| **𝒫** (Presentación) | `OplDocument[]` con spans | Entrada textual |
| **𝒮** (Semántica) | `SemanticKernel` | **SSOT** — fuente de verdad única |
| **ℛ** (Refinamiento) | Árbol SD → SD1 → SD1.1 | Estructura jerárquica |
| **𝒜** (Atlas) | `OpdAtlas` = `[ℛ, 𝒱]` | Vistas indexadas por refinamiento |
| **𝓛** (Layout) | `LayoutModel` = `Map<OpdId, OpdLayout>` | Geometría regenerable |

## Los cinco funtores

```typescript
// F1: Parse — 𝒫 → 𝒮
compileToKernel(docs: OplDocument[]): SemanticKernel

// F2: Render — 𝒮 → 𝒫
renderFromKernel(kernel: SemanticKernel): OplDocument[]

// F3: Expose — 𝒮 → 𝒜  (ya existe: exposeSemanticKernel)
exposeSemanticKernel(kernel: SemanticKernel): OpdAtlas

// F4: Collect — 𝒜 → 𝒮  (adjunto izquierdo de Expose)
collectSemanticPatches(atlas: OpdAtlas, edit: AtlasEdit): KernelPatch

// F5: Layout — 𝒜 → 𝒜 × 𝓛
layoutAtlas(atlas: OpdAtlas, hints?: LayoutModel): LayoutModel
```

## Diagrama del pipeline target

```
                        ┌─────────────────────┐
                        │   SemanticKernel     │
                        │   (objeto universal) │
                        └──────────┬──────────┘
                       /           │           \
                 Parse /            │            \ Expose
             (F1) /               │              \ (F3)
                /                  │                \
  ┌────────────┐          Render (F2)         ┌──────────┐
  │ OplDocument│<──────────────────────────── │ OpdAtlas  │
  │   (AST)    │                              │ (fibrado) │
  └──────┬─────┘                              └─────┬─────┘
         │                                          │
    text │                                   Layout │ (F5)
         │                                          │
  ┌──────v─────┐                              ┌─────v──────┐
  │  OPL text  │                              │LayoutModel │
  │  (string)  │                              │ (x,y,w,h)  │
  └────────────┘                              └─────┬──────┘
                                                    │
                                             Project │
                                                    │
                                              ┌─────v──────┐
                                              │   Canvas    │
                                              │  (visual)   │
                                              └─────────────┘
```

Parse y Render son inversas a nivel de SemanticKernel. Expose es un funtor fibrado. Layout enriquece sin alterar semántica.

## Leyes de isomorfismo

### Ley 1 — Roundtrip textual (PutGet)

```
renderFromKernel(compileToKernel(parse(opl))) ≡_normalize opl
```

### Ley 2 — Colímite del atlas

```
colim(exposeSemanticKernel(S)) ≅ S
```

El colímite del atlas recupera el kernel completo.

### Ley 3 — Conmutatividad del diamante

```
compileToKernel(renderFromKernel(S)) ≅ S
```

Compilar lo que renderizas te devuelve al mismo kernel.

### Ley 4 — Ortogonalidad layout/semántica

```
compileToKernel(renderFromKernel(S)) = compileToKernel(renderFromKernel(S'))
cuando S y S' difieren solo en LayoutModel
```

Mover una caja sin cambiar relaciones semánticas no altera S.

## Diferencia concreta vs estado actual

### Compiler: cambiar target de Model a SemanticKernel

**Hoy** (`opl-compile.ts`):
```typescript
import { createModel } from "./model";
import { addThing, addLink, addState, ... } from "./api";
// compile → Model (tipo legacy con appearances, fans, modifiers planos)
```

**Target**:
```typescript
import { createSemanticKernel } from "./semantic-kernel";
// compile → SemanticKernel directamente, preservando sourceInfo
export function compileToKernel(docs: OplDocument[]): Result<SemanticKernel, OplCompileError>
```

Diferencia clave: cada `SemanticThing`, `SemanticLink`, etc. preserva `sourceInfo` con el span OPL original. Esto habilita source mapping bidireccional (Fase 4).

### Render: operar directamente sobre SemanticKernel

**Hoy** (`opl.ts`):
```typescript
export function exposeFromSemanticKernel(kernel, opdId, atlas?, layout?): OplDocument {
  const model = legacyModelFromSemanticKernel(kernel, atlas, layout); // round-trip
  return expose(model, opdId);
}
```

**Target**:
```typescript
export function renderFromKernel(kernel: SemanticKernel, opdId: string): OplDocument {
  // Render directamente desde el kernel, sin pasar por Model
}
```

### Model como vista derivada

`Model` sigue existiendo como tipo de compatibilidad:
```typescript
export function materializeModel(kernel: SemanticKernel, atlas: OpdAtlas, layout: LayoutModel): Model {
  return legacyModelFromSemanticKernel(kernel, atlas, layout);
}
```

## Componentes que se reutilizan

| Componente | Estado | Acción |
|------------|--------|--------|
| `SemanticKernel` type | Implementado | Reutilizar |
| `exposeSemanticKernel` | Implementado | Reutilizar (F3) |
| `OpdAtlas`, `OpdSlice`, `ViewOccurrence` | Implementado | Reutilizar |
| `LayoutModel`, `LayoutNode`, `LayoutEdge` | Implementado | Reutilizar |
| `legacyModelFromSemanticKernel` | Implementado | Mantener como adapter |
| `parseOplDocument(s)` | Implementado | Reutilizar (F1 primera mitad) |
| `compileOplDocument(s)` | Implementado | Refactorizar target |
| `render()` / `renderAll()` | Implementado | Nueva versión kernel-native |
| `projectLegacyModel` | Implementado | Reemplazar gradualmente |

## Plan de implementación (3 slices)

### Slice A — compileToKernel (cierra R1+R2)

1. Nuevo `compileToKernel()` en `opl-compile.ts` que targeta `SemanticKernel` directamente
2. Preserva `sourceInfo` en cada entidad
3. Construye `InZoomStep[]` e `internalObjects` desde `in-zoom-sequence` sentences
4. Marca `origin: "derived-in-zoom"` en invocations implícitas
5. Test: `compileToKernel(parse(fixture)).refinements` tiene steps no vacíos para las 6 fixtures

### Slice B — renderFromKernel (cierra R3)

1. Nuevo `renderFromKernel()` que opera directamente sobre `SemanticKernel`
2. Sin paso por `legacyModelFromSemanticKernel`
3. Test roundtrip: `renderFromKernel(compileToKernel(parse(opl))) ≡_normalize opl` para 6 fixtures

### Slice C — Source mapping bidireccional (cierra Fase 4)

1. `sourceInfo.span` viaja de OPL → Kernel → Atlas → View
2. Click en canvas → lookup `ViewOccurrence.thingId` → `kernel.things.get(id).sourceInfo.span`
3. Click en OPL → lookup span → match against `kernel.things/links/states` → highlight en canvas
4. Test: para cada cosa visible en el canvas, existe un span OPL válido

## Verificación del isomorfismo

```typescript
describe("OPL <-> OPD isomorphism", () => {
  for (const fixture of ALL_FIXTURES) {
    it(`Ley 1 — roundtrip textual: ${fixture}`, () => {
      const opl = readFixtureOpl(fixture);
      const docs = parseOplDocuments(opl);
      const kernel = compileToKernel(docs);
      const opl2 = renderFromKernel(kernel);
      expect(normalizeOpl(opl2)).toEqual(normalizeOpl(opl));
    });

    it(`Ley 2 — colimite del atlas: ${fixture}`, () => {
      const kernel = compileToKernel(parseOplDocuments(readFixtureOpl(fixture)));
      const atlas = exposeSemanticKernel(kernel);
      const recovered = collectFromAtlas(atlas, kernel.opds);
      expect(recovered.things.size).toBe(kernel.things.size);
      expect(recovered.links.size).toBe(kernel.links.size);
    });

    it(`Ley 3 — conmutatividad del diamante: ${fixture}`, () => {
      const kernel1 = compileToKernel(parseOplDocuments(readFixtureOpl(fixture)));
      const opl = renderFromKernel(kernel1);
      const kernel2 = compileToKernel(parseOplDocuments(opl));
      expectKernelEquivalent(kernel1, kernel2);
    });

    it(`Ley 4 — ortogonalidad: layout no altera semantica`, () => {
      const kernel = compileToKernel(parseOplDocuments(readFixtureOpl(fixture)));
      const atlas = exposeSemanticKernel(kernel);
      const layout1 = autoLayout(atlas);
      const layout2 = autoLayout(atlas, { seed: 42 });
      const model1 = materializeModel(kernel, atlas, layout1);
      const model2 = materializeModel(kernel, atlas, layout2);
      expectSemanticallyEqual(model1, model2);
      expect(layout1).not.toEqual(layout2);
    });
  }
});
```

## Frase de producto

> OPModel no renderiza diagramas desde coordenadas.
> Proyecta un sistema semantico canonico a un atlas de OPDs y luego lo dispone visualmente.
> El isomorfismo vive en el SemanticKernel, no entre pixeles y texto.
