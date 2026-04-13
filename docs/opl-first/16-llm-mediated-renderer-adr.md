# ADR-006: LLM-mediated renderer as derived visual backend

| Campo | Valor |
|-------|-------|
| Fecha | 2026-04-12 |
| Estado | Proposed |
| Precede | ADR-003, ADR-004, ADR-005 |
| Autor | Felix (Ominono) + steipete |

## Problema

`opmodel` ha empujado demasiado peso hacia la capa visual web existente. El repo ya documenta y muestra varias fallas estructurales en esa zona:

- `OpdCanvas.tsx` sigue siendo demasiado grande y mezcla composición, interacción y compensaciones semánticas
- `spatial-layout.ts` funciona como choke point geométrico con demasiada responsabilidad
- distintos consumidores visuales han tendido a divergir, motivo por el cual se abrió ADR-004 (`EffectiveVisualSlice`)
- el renderer interno debe resolver demasiadas decisiones de layout, jerarquía visual, routing y presentación al mismo tiempo
- la visualización ha cargado más responsabilidad metodológica de la que debería

El resultado es una superficie visual frágil, cara de mantener y poco alineada con el nuevo centro de gravedad del producto:

```text
intent / OPL / SemanticKernel -> artefactos derivados
```

## Decisión

Introducir una nueva línea de desarrollo en `opmodel`:

```text
LLM-mediated renderer
```

Este renderer será un backend visual derivado, interno al producto, gobernado por un contrato explícito y verificable.

La arquitectura objetivo será:

```text
Intent / Wizard / OPL
  -> SemanticKernel
  -> Validation
  -> VisualRenderSpec
  -> renderer backend
       ├── deterministic-svg-renderer
       └── llm-mediated-renderer
  -> SVG / PNG
```

## Regla central

El LLM **no** pasa a ser autoridad semántica.

La semántica canónica sigue viviendo en:

```text
OPL/~ ≅ SemanticKernel ≅ Atlas/~
```

El LLM solo participa en la derivación visual, aguas abajo de un contrato semántico y visual ya cerrado.

## Beneficiario

El operador que necesita diagramas OPM visualmente fuertes, exportables y consistentes sin volver a pelear con un canvas pesado como superficie principal de autoría.

## Qué estamos reemplazando realmente

No se reemplaza OPM ni el core.

Se reemplaza la idea de que el renderer web actual debe ser la superficie principal y el lugar donde se resuelven demasiadas decisiones visuales de alto nivel.

## Tesis

La salida correcta no es “otro canvas”.

La salida correcta es:

1. semántica OPM fuerte y validada
2. contrato visual explícito y testeable
3. uno o más backends de render
4. verificación post-render

## Invariantes

### I1. SemanticKernel sigue siendo SSOT

Ningún backend de render puede introducir, borrar o reinterpretar semántica OPM.

### I2. El renderer LLM es derivado

Toda instrucción al backend LLM debe salir de un artefacto intermedio canónico:

```text
VisualRenderSpec
```

No se admite `texto libre -> diagrama OPM` como camino canónico del producto.

### I3. Debe existir backend determinista hermano

El LLM-mediated renderer no reemplaza totalmente al renderer determinista.

Debe coexistir con un backend interno determinista para:

- preview rápido
- tests
- debugging
- fallback
- benchmarking de consistencia

### I4. Verificación post-render obligatoria

Toda salida LLM debe poder verificarse al menos contra:

- nodos requeridos presentes
- edges requeridos presentes
- labels obligatorios presentes
- distinción visual object/process preservada
- lanes / grupos respetados
- ausencia de invención semántica obvia

### I5. Style packs versionados

La capa visual mediada por LLM debe operar con style packs y prompts versionados, no con prompting informal mutable.

### I6. El canvas deja de ser centro del producto

El canvas legacy puede seguir existiendo, pero no debe condicionar la forma de la nueva superficie principal.

## Artefacto nuevo: VisualRenderSpec

Se introduce un contrato visual intermedio, con intención explícita y verificable.

```ts
interface VisualRenderSpec {
  version: "v1";
  diagramKind: "opm-sd" | "opm-sd1";
  title: string;
  style: string;
  scene: {
    lanes: Array<{
      id: string;
      label: string;
      role: "context" | "function" | "system" | "refinement";
    }>;
    groups: Array<{
      id: string;
      label: string;
      kind: "cluster" | "legend" | "context-box";
    }>;
  };
  nodes: Array<{
    id: string;
    label: string;
    opmKind: "object" | "process";
    visualRole:
      | "beneficiary"
      | "system"
      | "main-process"
      | "value-object"
      | "agent"
      | "instrument"
      | "input"
      | "output"
      | "environment"
      | "subprocess"
      | "internal-object";
    affiliation: "systemic" | "environmental";
    laneId?: string;
    groupId?: string;
    importance?: 1 | 2 | 3;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    opmLinkKind: string;
    label?: string;
    semanticRole?: string;
    routingPriority?: "primary" | "secondary";
  }>;
  guardrails: string[];
  canonicalOpl: string;
}
```

## Backends iniciales

### B1. Deterministic SVG renderer

Responsabilidades:
- preview inmediato
- snapshots
- export básico
- benchmark estructural

### B2. LLM-mediated renderer

Responsabilidades:
- salida premium
- mejor jerarquía visual
- style packs avanzados
- export orientado a publicación / documentación

No decide semántica. Interpreta `VisualRenderSpec`.

## Integración con `fireworks-tech-graph`

El repo `fireworks-tech-graph` se toma como referencia útil para:

- shape vocabulary
- style packs
- SVG discipline
- layout heuristics
- legends y grouping

No se toma como fuente de verdad OPM.

Su valor principal para esta ADR es servir como antecedente de:

```text
promptable visual compiler
```

no como modelador OPM.

## Módulos nuevos propuestos

### Core
- `packages/core/src/generator/visual-render-spec.ts`
- `packages/core/src/generator/kernel-to-visual-render-spec.ts`
- `packages/core/src/generator/visual-render-verifier.ts`

### Web / app
- `packages/web/src/lib/renderers/deterministic-svg-renderer.ts`
- `packages/web/src/lib/renderers/llm-renderer/`
- `packages/web/src/lib/renderers/llm-renderer/style-packs/`
- `packages/web/src/lib/renderers/llm-renderer/prompts/`
- `packages/web/src/lib/renderers/llm-renderer/provider.ts`

## Proveedores LLM

El backend LLM no debe quedar acoplado a Claude.

Protocolo inicial sugerido:

```ts
interface DiagramLLMProvider {
  generateSvg(input: {
    spec: VisualRenderSpec;
    stylePack: string;
    systemPrompt: string;
  }): Promise<{
    svg: string;
    rationale?: string;
    warnings?: string[];
  }>;
}
```

Proveedores posibles:
- Anthropic
- OpenAI
- Gemini
- modelos locales posteriormente

## Eval mínima

La nueva línea se considera validada cuando, para al menos 3 casos reales (`coffee-making`, `hospitalizacion-domiciliaria`, `ev-ams`):

1. `SemanticKernel -> VisualRenderSpec` es estable
2. renderer determinista produce SVG legible
3. renderer LLM produce SVG mejorado sin inventar semántica
4. el verificador detecta faltas estructurales obvias
5. ambos outputs pueden compararse sobre el mismo input

## Riesgos

### R1. El LLM inventa relaciones
Mitigación: guardrails + verifier + prompt versionado + input cerrado.

### R2. El renderer premium vuelve irreproducible el producto
Mitigación: temperature baja, snapshots, fixtures, outputs guardados, style packs versionados.

### R3. El LLM-renderer reabsorbe la semántica por comodidad
Mitigación: prohibir caminos directos `texto -> diagrama` como superficie canónica.

### R4. Querer hacer reverse compilation desde SVG demasiado pronto
Mitigación: primero unidireccional `kernel -> visual`; roundtrip visual queda fuera del MVP.

## No objetivos inmediatos

- parsear SVG de vuelta a `SemanticKernel`
- reemplazar todo el canvas legacy de una vez
- abrir edición libre visual premium como nueva autoría
- delegar refinamiento SD1 al LLM
- reclamar isomorfismo formal entre LLM y semántica OPM

## Plan de implementación sugerido

### Fase 1
Definir `VisualRenderSpec` y `kernelToVisualRenderSpec()`.

### Fase 2
Conectar renderer determinista contra ese contrato.

### Fase 3
Implementar `DiagramLLMProvider` y un backend LLM mínimo.

### Fase 4
Agregar `visual-render-verifier`.

### Fase 5
Integrar export premium en `OPM Graph Generator`.

## Resumen corto

El próximo salto correcto no es seguir parchando el renderer web como centro del producto.

El próximo salto correcto es separar:

```text
semántica OPM canónica
vs
compilación visual premium
```

`opmodel` debe tratar al renderer LLM como backend derivado, gobernado por un contrato visual explícito, verificable y reemplazable.
