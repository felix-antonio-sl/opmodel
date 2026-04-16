# OPM Graph Generator MVP plan

| Campo | Valor |
|-------|-------|
| Fecha | 2026-04-11 |
| Estado | **Vigente con ajustes** — actualizado 2026-04-16 con ADR-008 |
| Base | ADR-005 — OPM Graph Generator as the primary product slice |
| Integrado con | `20-jointjs-execution-plan.md` (Fase 4) |

> **Actualizacion 2026-04-16**
>
> Los 4 cortes del MVP se mantienen. Los ajustes por ADR-008:
>
> **Corte 2 — Derived outputs**:
> - `DiagramSpec` ya existe en `packages/core/src/generator/diagram-spec-types.ts`; se mantiene como tipo, pero el rendering NO pasa por el
> - Pipeline activo: `SemanticKernel → kernelToVisualRenderSpec() → VisualRenderSpec → joint.dia.Graph`
> - `packages/web/src/features/generator/components/DiagramPreview.tsx` usa `<JointDiagramPreview spec={renderSpec} />`
> - `packages/web/src/lib/svg/render-diagram-spec.ts` queda como fallback SSR/CI, no es camino primario
> - Nuevo archivo: `packages/web/src/lib/renderers/jointjs/visual-render-spec-to-joint-graph.ts`
>
> **Corte 3 — Refinar proceso principal a SD1**:
> - Sin cambios en core
> - `RefinementWorkspace.tsx` renderiza SD1 via JointJS igual que SD
>
> **Corte 4 — Casos reales**:
> - Los 3 casos (coffee-making, hospitalizacion-domiciliaria, ev-ams) se extienden a las 7 fixtures por consistencia con plan JointJS
> - Los tests de generator incluyen snapshots JointJS en vez de SVG
>
> **Riesgo R4 del ADR original** ("Acoplar renderer con semantica") queda mas robusto: `VisualRenderSpec` es la frontera explicita, JointJS solo consume.
>
> Ver `20-jointjs-execution-plan.md` Fase 4 para el detalle de integracion.

---

## Texto original (2026-04-11, Proposed)

## Objetivo ejecutivo

Abrir en `opmodel` un vertical slice nuevo y pequeño que permita:

1. capturar una descripción corta o recorrer wizard SD
2. producir un `SemanticKernel` válido
3. mostrar OPL + validación + diagrama SVG derivado
4. refinar el proceso principal a SD1

## Resultado del MVP

Desde una descripción corta del sistema o desde un wizard estructurado, el usuario obtiene:

- SD válido
- OPL equivalente
- diagrama SVG exportable
- checklist de validación
- acción `Refinar proceso principal` para generar SD1

## Topología de implementación

No hacer rewrite total.

Hacer 4 cortes secuenciales, cada uno con salida visible y cierre verificable.

---

## Corte 1 — Modelo intermedio y wizard contract

### Intención

Crear una superficie de captura clara, pequeña y alineada al corpus.

### Artefactos nuevos

#### Core
- `packages/core/src/generator/sd-draft.ts`
- `packages/core/src/generator/sd-draft-types.ts`
- `packages/core/src/generator/sd-draft-to-kernel.ts`
- `packages/core/src/generator/sd-draft-validation.ts`

#### Web
- `packages/web/src/features/generator/types.ts`
- `packages/web/src/features/generator/state/useSdWizard.ts`
- `packages/web/src/features/generator/components/SdWizard.tsx`
- `packages/web/src/features/generator/components/StartScreen.tsx`

### Contratos mínimos

#### `SdDraft`
```ts
interface SdDraft {
  systemType?: "artificial" | "natural" | "social" | "socio-technical";
  systemName?: string;
  mainProcess?: string;
  beneficiary?: string;
  valueObject?: string;
  valueStateIn?: string;
  valueStateOut?: string;
  functionObject?: string;
  agents?: string[];
  instruments?: string[];
  inputs?: string[];
  outputs?: string[];
  environment?: string[];
  problemOccurrence?: string | null;
}
```

#### `ValidationReport`
```ts
interface ValidationIssue {
  severity: "crit" | "alta" | "media" | "baja";
  ruleId: string;
  message: string;
  elementRefs?: string[];
  suggestedFix?: string;
}
```

### Criterio de cierre

- existe `SdDraft`
- wizard SD produce `SdDraft`
- `SdDraft -> SemanticKernel` funciona para caso mínimo
- validación estructurada visible

### Blast radius

**Bajo-medio**

---

## Corte 2 — Derived outputs: OPL + DiagramSpec + SVG

### Intención

Convertir el kernel en salidas útiles sin pasar por edición visual libre.

### Artefactos nuevos

#### Core
- `packages/core/src/generator/kernel-to-opl.ts`
- `packages/core/src/generator/kernel-to-diagram-spec.ts`
- `packages/core/src/generator/diagram-spec-types.ts`

#### Web
- `packages/web/src/features/generator/components/ModelWorkspace.tsx`
- `packages/web/src/features/generator/components/OplPanel.tsx`
- `packages/web/src/features/generator/components/ValidationPanel.tsx`
- `packages/web/src/features/generator/components/DiagramPreview.tsx`
- `packages/web/src/lib/svg/render-diagram-spec.ts`

### Contrato mínimo

#### `DiagramSpec`
```ts
interface DiagramSpec {
  diagramId: string;
  title: string;
  nodes: Array<{
    id: string;
    label: string;
    kind: "object" | "process" | "state" | "system" | "external";
    groupId?: string;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    kind: string;
    label?: string;
  }>;
  groups: Array<{
    id: string;
    label: string;
  }>;
  layoutHints?: Record<string, unknown>;
}
```

### Criterio de cierre

- `SemanticKernel -> OPL` visible en UI
- `SemanticKernel -> DiagramSpec -> SVG` visible en UI
- export SVG operativo
- build web verde

### Blast radius

**Medio**

---

## Corte 3 — Refinar proceso principal a SD1

### Intención

Habilitar el segundo movimiento esencial de OPM: pasar de SD a SD1.

### Artefactos nuevos

#### Core
- `packages/core/src/generator/refine-main-process.ts`
- `packages/core/src/generator/refinement-draft-types.ts`
- `packages/core/src/generator/refinement-validation.ts`

#### Web
- `packages/web/src/features/generator/components/RefineProcessDialog.tsx`
- `packages/web/src/features/generator/components/RefinementWorkspace.tsx`

### Reglas duras

- la acción debe ser explícita
- distinguir `in-zooming` vs `unfolding`
- validar distribución mínima de links y contexto
- no abrir refinamiento profundo arbitrario todavía

### Criterio de cierre

- existe acción `Refinar proceso principal`
- genera SD1 básico válido
- renderiza OPL + SVG + validación de SD1

### Blast radius

**Medio**

---

## Corte 4 — Casos reales y cierre del vertical slice

### Intención

Probar que la dirección sirve en casos reales, no solo en demo mínima.

### Casos mínimos

- `coffee-making`
- `hospitalizacion-domiciliaria`
- `ev-ams`

### Tests nuevos sugeridos

#### Core
- `packages/core/tests/sd-draft-to-kernel.test.ts`
- `packages/core/tests/kernel-to-diagram-spec.test.ts`
- `packages/core/tests/refine-main-process.test.ts`

#### Web
- `packages/web/tests/generator-smoke.test.tsx`
- `packages/web/tests/sd-wizard.test.tsx`
- `packages/web/tests/generator-export.test.tsx`

### Criterio de cierre

- 3 casos reales punta a punta
- validación visible
- build web verde
- tests del vertical slice verdes
- export SVG correcto

### Blast radius

**Medio**

---

## Integración con el repo existente

### Reutilizar fuerte

#### `packages/core`
- parser / compiler / validation
- semantic kernel
- invariantes OPM
- partes reutilizables de OPL

#### `packages/web`
- paneles de validación existentes donde sirvan
- export surface
- layout/render reusable si no contamina semántica

#### fixtures
- `tests/coffee-making.opmodel`
- `tests/hospitalizacion-domiciliaria.opmodel`
- `tests/ev-ams.opmodel`

### Sacar del camino crítico

- editor visual libre como superficie primaria
- features de canvas que no ayuden al vertical slice
- UX pesada de edición geométrica
- features nuevas fuera de SD / SD1 / export / validación

---

## Ruta de archivos recomendada

```text
packages/core/src/generator/
  sd-draft.ts
  sd-draft-types.ts
  sd-draft-to-kernel.ts
  sd-draft-validation.ts
  kernel-to-opl.ts
  diagram-spec-types.ts
  kernel-to-diagram-spec.ts
  refine-main-process.ts
  refinement-draft-types.ts
  refinement-validation.ts

packages/web/src/features/generator/
  types.ts
  state/useSdWizard.ts
  components/
    StartScreen.tsx
    SdWizard.tsx
    ModelWorkspace.tsx
    OplPanel.tsx
    ValidationPanel.tsx
    DiagramPreview.tsx
    RefineProcessDialog.tsx
    RefinementWorkspace.tsx

packages/web/src/lib/svg/
  render-diagram-spec.ts
```

## Primer commit recomendado

```text
docs(opl-first): add ADR and MVP plan for OPM Graph Generator slice
```

## Segundo commit recomendado

```text
feat(generator): add SdDraft contract and SD wizard scaffold
```

## Tercer commit recomendado

```text
feat(generator): derive OPL and SVG from SemanticKernel
```

## Cuarto commit recomendado

```text
feat(generator): add SD1 refinement flow for main process
```

## Riesgos principales

### R1. Recaer en canvas-first
Mitigación: el vertical slice no depende de drag-and-drop para demostrar valor.

### R2. Generador bonito pero semánticamente flojo
Mitigación: validación visible y corpus SSOT como contrato.

### R3. Scope creep hacia “system mapping” genérico
Mitigación: limitar MVP a SD, SD1, OPL, validación y export.

### R4. Acoplar renderer con semántica
Mitigación: `DiagramSpec` como frontera explícita entre kernel y SVG.

## Resumen corto

El MVP correcto no es “mejorar el canvas”.

El MVP correcto es abrir un slice chico y útil:

```text
Describe / Wizard -> SemanticKernel -> OPL + Validation + SVG -> Refine to SD1
```

Eso nos da una dirección de producto mucho más clara y testeable.