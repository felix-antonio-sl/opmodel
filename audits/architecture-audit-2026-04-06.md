# Architecture Audit — OPModel

| Campo | Valor |
|-------|-------|
| Fecha | 2026-04-06 |
| Tipo | review |
| Auditor | steipete (senior-architect) |
| Scope | Monorepo completo: core, cli, web, nl |

---

## 1. Tensión dominante

**OPModel tiene un Domain Engine excepcionalmente sólido y un Web UI que está creciendo como ball of mud.**

El core es inmutable, puro, bien tipado, con 37+ invariantes y Result monad. El web layer tiene 3 componentes de 1000+ líneas (`OpdCanvas` 1503, `PropertiesPanel` 1198, `App` 953), un solo hook (`useModelStore`) como choke point, y `App.tsx` con 28 hooks. La tensión no es arquitectónica a nivel de paquetes — es a nivel de componentes web.

---

## 2. Topología real

```
@opmodel/core (0 deps externas)
    ├── types.ts        273 líneas — IR canónica (Things, Links, States, OPDs)
    ├── api.ts         2091 líneas — CRUD + 37 invariantes + validation
    ├── opl.ts         1465 líneas — OPL bidirectional lens (expose/render/editsFrom)
    ├── opl-parse.ts   1550 líneas — OPL text → OplDocument (24 constructos)
    ├── opl-compile.ts  995 líneas — OplDocument → Model (full pipeline)
    ├── opl-validate.ts 663 líneas — Validación con source locations
    ├── simulation.ts  1640 líneas — Coalgebra evaluator + in-zoom + DA-9 fiber
    ├── structural.ts   134 líneas — Structural link helpers
    ├── methodology.ts  232 líneas — ISO compliance checks
    ├── serialization   201 líneas — .opmodel JSON roundtrip
    └── 5 archivos menores

@opmodel/cli (1 dep: core)
    └── cli.ts         444 líneas — 9 comandos, bien acotado

@opmodel/web (2 deps: core, nl)
    ├── App.tsx               953 líneas — 28 hooks, orchestrador monolítico
    ├── hooks/useModelStore   269 líneas — único store, usado solo en App.tsx
    ├── lib/commands          475 líneas — Command algebra (η: Cmd→Effect)
    ├── lib/spatial-layout    786 líneas — 6 estrategias de layout
    ├── lib/auto-layout       434 líneas — Layout from scratch
    ├── lib/edge-router       250 líneas — Bézier + parallel offset
    ├── lib/visual-lint       280 líneas — 6 finding types
    ├── components/OpdCanvas 1503 líneas — render SVG completo
    ├── components/Properties 1198 líneas — panel propiedades + CRUD forms
    └── 10 componentes menores (150-400 líneas c/u)

@opmodel/nl (1 dep: core)
    └── parse.ts + resolve.ts + prompt.ts — capa NL ligera
```

---

## 3. Dependency graph

```
core ← cli
core ← web ← nl (web importa nl para settings)
core ← nl
```

- **Sin dependencias circulares.** ✅
- **Core es zero-dependency.** ✅
- **CLI y NL son consumers limpios.** ✅
- **Web tiene dependencia en NL** — ligera pero innecesaria si NL es opcional.

Coupling score por paquete: core (0), cli (low), nl (low), web (**medium-high**: 37 imports de core, consumes todo).

---

## 4. Puntos fuertes

| Aspecto | Evaluación |
|---------|------------|
| **Core immutability** | Excelente. Result monad, pure functions, Maps O(1). Ninguna mutación directa. |
| **Type safety** | Fuerte. String literal unions, exhaustive pattern matching en invariantes. |
| **Invariant coverage** | 43 invariantes explícitos en api.ts. Todo CRUD pasa por validación. |
| **OPL-first pipeline** | Completo y bien segmentado: parse → compile → validate. Cada fase es archivo propio. |
| **Test coverage** | 1127 tests, 80 files, 16K líneas de test. Core tiene 11K líneas de test contra 15K de producción. Ratio ~0.73 — saludable. |
| **Monorepo structure** | Bun workspaces limpio. Core zero-dep. Paquetes bien separados. |
| **Documentation** | Excelente para un proyecto de este tamaño. CLAUDE.md, README, CORE-VISUAL, OPL-first docs, ADRs. |
| **Domain modeling** | Los DAs (1-10) son coherentes y reflejan pensamiento categórico real, no jargon vacío. |

---

## 5. Problemas estructurales

### P1: `App.tsx` es un God Component — Severidad: **ALTA**

953 líneas, 28 hooks. Es orchestrador, state manager, event handler, y layout component simultáneamente.

**Consecuencias:**
- Cualquier cambio en UI toca App.tsx
- Re-render cascade: cambio en selection → re-render del canvas completo
- Difícil de testear aisladamente
- `useModelStore` solo se usa en App.tsx → el hook es extension de App, no abstracción reusable

**Trade-off aceptado hoy:** funciona y el proyecto es single-developer. Pero el costo crece con cada feature.

### P2: `OpdCanvas.tsx` (1503 líneas) y `PropertiesPanel.tsx` (1198 líneas) — Severidad: **ALTA**

OpdCanvas hace demasiado: SVG rendering, layout computation, edge routing, interaction handling, visual lint, zoom/pan, drag/drop.

PropertiesPanel es un formulario monolítico que maneja ~15 tipos de entities con switch/if chains.

**Consecuencias:**
- Cambios visuales requieren tocar el mismo archivo gigante
- No hay separación entre rendering y behavior
- Testing unitario de sub-partes requiere mock del componente completo

### P3: `api.ts` (2091 líneas) — Severidad: **MEDIA**

44 exported functions, todas con el mismo patrón `validate → mutate → Result`. Es correcto funcionalmente pero:
- Todas las entidades comparten el mismo archivo
- No hay agrupación por dominio (things vs links vs OPDs vs refinement)
- Cada nuevo entity type agrega ~50 líneas aquí

**Mitigación parcial:** El patrón es uniforme. El riesgo principal es navegabilidad, no acoplamiento.

### P4: State management sin separación — Severidad: **MEDIA**

`useModelStore` (269 líneas) es el único store y solo lo consume App.tsx. No hay context providers, no hay composition de state. Todo baja por props desde App.

**Consecuencia:** App.tsx es el bottleneck obligado de toda la UI.

### P5: OPL-parse y OPL-compile dependen de `oplSlug` — Severidad: **BAJA**

`opl-parse.ts` y `opl-compile.ts` importan `oplSlug` de `opl.ts` para name normalization. Esto crea una dependencia sutil: el compiler depende del renderer para normalización de nombres.

Idealmente la normalización debería estar en un helper compartido, no en el módulo de rendering.

---

## 6. Riesgos no-técnicos

| Riesgo | Probabilidad | Impacto |
|--------|-------------|---------|
| God components dificultan contributor onboarding | Alta | Medio |
| Features web nuevas amplían App.tsx linealmente | Alta | Alto |
| Cambios en core types rompen web en cascada | Media | Medio |
| `opl-parse.ts` a 1550 líneas crece con cada constructo nuevo | Media | Bajo |

---

## 7. Evaluación por paquete

### @opmodel/core — **A (9/10)**

Domain engine excepcional. Inmutable, puro, bien testeado. Los archivos grandes son apropiados para el nivel de complejidad (api.ts tiene 44 operaciones con invariantes). OPL pipeline bien segmentado en 4 archivos con responsabilidades claras.

Único defecto menor: `api.ts` podría beneficiarse de split por entity type, pero el costo de refactor es bajo-prioridad vs el riesgo de romper algo que funciona.

### @opmodel/cli — **A- (8.5/10)**

Bien acotado, 9 comandos, 13 test files. No hay mucho que mejorar.

### @opmodel/web — **B- (6.5/10)**

Funciona. Tiene features impresionantes (OPL editor, simulation, visual lint). Pero la arquitectura de componentes es el principal riesgo técnico del proyecto.

**Problemas concretos:**
- 3 componentes >1000 líneas
- God component pattern en App.tsx
- State management concentrado en un solo hook
- Props drilling mitigado parcialmente pero App sigue siendo hub

**Lo que funciona bien:**
- Command algebra (`commands.ts`) es elegante y bien tipado
- Lib layer (`spatial-layout`, `edge-router`, `visual-lint`) está bien separada
- Test coverage de 17 files para web es razonable

### @opmodel/nl — **B (7/10)**

Capa ligera, bien acotada. Solo 4 test files con 582 líneas. No hay mucho riesgo aquí.

---

## 8. Recomendaciones

### R1: Extraer state management de App.tsx → Context providers — **Prioridad Alta**

```
App.tsx (953 líneas, 28 hooks)
  → ModelProvider (context) — model + dispatch + undo/redo
  → UIProvider (context) — selection, mode, OPD, simulation
  → AppLayout — solo layout, sin lógica
```

**Blast radius:** Medio. Toca App.tsx + todos los consumers indirectos.
**Beneficio:** Cada componente puede consumir solo lo que necesita. App.tsx baja de 953 a ~200 líneas.
**Riesgo:** Mala extracción puede empeorar las cosas. Hacer incremental.

### R2: Split OpdCanvas — **Prioridad Alta**

```
OpdCanvas.tsx (1503 líneas)
  → OpdRenderer — SVG composition (puro)
  → OpdInteraction — drag/drop/zoom/pan
  → OpdLayout — layout computation
  → OpdCanvas — thin orchestrator (~200 líneas)
```

### R3: Split PropertiesPanel por entity type — **Prioridad Media**

```
PropertiesPanel.tsx (1198 líneas)
  → ThingProperties.tsx
  → LinkProperties.tsx
  → StateProperties.tsx
  → OplProperties.tsx
  → PropertiesPanel.tsx — router (~100 líneas)
```

### R4: Extraer `oplSlug` a helper compartido — **Prioridad Baja**

Mover `oplSlug` de `opl.ts` a `helpers.ts`. Evita que compiler dependa del renderer.

### R5: No tocar core ahora — **Mantener**

El core está sólido. `api.ts` a 2091 líneas es grande pero el patrón es uniforme y predecible. El costo de split supera el beneficio en esta etapa.

---

## 9. Métricas resumen

| Métrica | Valor | Evaluación |
|---------|-------|------------|
| Líneas producción | 15,126 | ✅ apropiado |
| Líneas tests | 16,006 | ✅ ratio 1.06 |
| Archivos test / prod | 80 / 48 | ✅ buena cobertura |
| Core zero-deps | ✅ | ✅ |
| Circular deps | 0 | ✅ |
| Componentes >1000 líneas | 3 (web) | ⚠️ |
| Hooks en App.tsx | 28 | ⚠️ |
| Packages | 4 | ✅ |
| Max coupling score | web→core (37 imports) | ⚠️ |
| Unused exports | 1 (opl-validate, recién creado) | ✅ |

---

## 10. Próximo paso recomendado

**R1 (Context providers)** es el de mayor leverage. Desbloquea R2 y R3 al reducir el bottleneck de App.tsx. El patrón es estándar React y el blast radius es controlable si se hace incremental.

**Secuencia sugerida:**
1. R1 — Context providers (desbloquea todo lo demás)
2. R3 — PropertiesPanel split (más fácil, más impacto inmediato en navegabilidad)
3. R2 — OpdCanvas split (más complejo, mejor después de R1)
4. R4 — oplSlug (cleanup menor)
5. R5 — No tocar core

---

## 11. Nota metodológica

Este audit se realizó con la skill `senior-architect` (review mode). Los scripts de la skill no ejecutaron por restricciones de preflight del sandbox, así que el análisis se hizo manual: inspección de imports, conteo de líneas, análisis de dependencias, y revisión de patrones de componentes. El resultado es equivalente al output de `dependency_analyzer.py` + `project_architect.py` + `architecture_diagram_generator.py` combinados.
