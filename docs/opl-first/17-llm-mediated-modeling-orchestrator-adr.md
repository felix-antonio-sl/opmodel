# ADR-007: LLM-mediated modeling orchestrator under SSOT

| Campo | Valor |
|-------|-------|
| Fecha | 2026-04-13 |
| Estado | Proposed |
| Precede | ADR-003, ADR-005, ADR-006 |
| Autor | Felix (Ominono) + steipete |

## Problema

`opmodel` ya tiene una direccion correcta en su pipeline semantico, pero la experiencia de authoring sigue demasiado fragmentada:

- wizard estructurado por un lado
- importacion OPL por otro
- refinamiento incremental todavia demasiado manual
- render premium ya mediado por LLM, pero authoring y evolucion del modelo aun no
- demasiado repo legacy alrededor de un nuevo centro de gravedad que ya cambio

La nueva direccion del producto ya no es "hacer calzar todo el repo".

La nueva direccion es:

```text
modelar sistemas OPM reales mediante una capa orquestada por LLMs,
siempre subordinada al corpus SSOT y al SemanticKernel.
```

## Corpus normativo vinculante

Toda decision de modelado, generacion, refinamiento, validacion y texto OPL DEBE respetar este orden de precedencia:

1. `/home/felix/kora/KNOWLEDGE/fxsl/opm/opm-ssot/opm-iso-19450.md`
2. `/home/felix/kora/KNOWLEDGE/fxsl/opm/opm-ssot/opm-opl-es.md`
3. `/home/felix/kora/KNOWLEDGE/fxsl/opm/opm-ssot/metodologia-modelamiento-opm.md`

Ningun LLM, grafo de agentes, prompt o UX puede redefinir semantica OPM fuera de este corpus.

## Decision

Introducir una nueva capa de producto:

```text
LLM-mediated modeling orchestrator
```

Esta capa gobernara:

- generacion desde wizard
- importacion y normalizacion desde OPL
- desarrollo gradual e incremental del modelo
- refinamiento SD -> SD1
- renderizacion premium derivada
- critique y propuesta de patches

Pero su autoridad estara restringida por este contrato:

```text
LLM = mediador, proponente y orquestador
SemanticKernel + SSOT validators = autoridad normativa
```

## Runtime elegido

La orquestacion se implementara con:

- **LangGraph** como runtime stateful y durable
- **Deep Agents** como harness para planificacion, subagentes, filesystem y memoria

## Regla central

No construir un "agentic toy" que improvise OPM.

Construir un sistema donde los LLMs:

- proponen
- normalizan
- descomponen
- traducen intencion en patches
- producen render premium

mientras que el sistema deterministicamente:

- valida contra SSOT
- protege invariantes del kernel
- rechaza propuestas semanticamente invalidas
- exige intervencion humana cuando el cambio no sea confiable

## Tesis

La superficie correcta ya no es:

```text
canvas-first editor
```

La superficie correcta pasa a ser:

```text
conversation / wizard / imported OPL / incremental intent
  -> LangGraph orchestration
  -> specialized LLM workers
  -> semantic patch proposal
  -> SSOT validation gate
  -> SemanticKernel
  -> OPL / VisualRenderSpec / SVG
```

## Invariantes

### I1. SemanticKernel sigue siendo SSOT operativo

Todo cambio aceptado debe terminar expresado en `SemanticKernel` o en un artefacto intermedio que compile sin perdida al kernel.

### I2. SSOT manda sobre los agentes

Si una propuesta LLM contradice el corpus:

- se rechaza
- o se degrada a propuesta para revision humana

### I3. Wizard, import OPL y edicion incremental convergen al mismo pipeline

No deben existir tres arquitecturas separadas.

Todo debe converger a:

```text
intent/input -> patch proposal -> validation -> kernel -> derived outputs
```

### I4. Los LLMs no editan el modelo libremente

Los LLMs no mutan el modelo final de forma opaca.

Deben producir uno de estos artefactos controlados:

- `SdDraft`
- `NormalizedOplDocument`
- `KernelPatchProposal`
- `RefinementProposal`
- `VisualRenderSpec`

### I5. El renderer premium sigue siendo derivado

`fireworks-tech-graph` se toma como referencia visual fuerte para:

- shape vocabulary
- grouping
- legends
- arrow semantics
- layout discipline
- SVG quality

pero no como autoridad semantica OPM.

### I6. Solo se conserva lo necesario del repo

No se intentara justificar retrospectivamente todo `opmodel`.

Se conserva solo lo que compre leverage para la nueva direccion.

## Componentes target

### 1. Modeling Orchestrator Service

Nuevo servicio Python, separado del frontend y del core TS.

Responsabilidades:

- correr LangGraph
- definir estado del flujo
- coordinar Deep Agents o subagentes especializados
- emitir propuestas de patch / draft / refinement
- registrar trazas y decisiones

No alberga semantica OPM canonica.

### 2. Semantic Guardrail Layer

Permanece en `packages/core`.

Responsabilidades:

- `SemanticKernel`
- parse / compile / validation
- metodologia SD/SD1
- chequeos de invariantes
- `kernelToOpl`
- `kernelToVisualRenderSpec`
- verificacion post-render

Esta es la capa que no se negocia.

### 3. Generator Workspace

Permanece en `packages/web`.

Responsabilidades:

- ser la superficie primaria del producto
- mostrar provenance del modelo (wizard, imported OPL, incremental)
- mostrar estado del agente/orquestador
- aceptar propuestas y diffs de modelado
- exponer render premium y fallback

### 4. Premium Visual Compiler

Mantener la linea:

```text
SemanticKernel -> VisualRenderSpec -> LLM renderer -> verified SVG
```

con vocabulario visual inspirado en `fireworks-tech-graph`.

## Workers especializados

El grafo inicial DEBERIA contener solo estos workers:

### W1. Intent Framer

Convierte input libre en objetivo estructurado de modelado.

Output:
- tipo de tarea
- entidad/proceso afectado
- alcance del cambio
- nivel de confianza

### W2. OPL Normalizer

Toma OPL importado y lo convierte en forma canonicamente parseable.

Puede:
- completar headers
- normalizar superficie ES/EN
- reordenar formato

No puede cambiar semantica arbitrariamente.

### W3. Kernel Patch Proposer

Propone operaciones concretas sobre el modelo.

Ejemplos:
- add thing
- refine process
- add state transition
- relabel for canonical naming
- split ambiguous transformee roles

### W4. Refinement Planner

Propone SD1 / in-zoom / unfolding segun reglas del corpus.

### W5. Render Compiler

Produce `VisualRenderSpec` o SVG premium derivado.

### W6. Critic / Validator

Evalua propuestas contra:
- ISO 19450
- OPL-ES
- metodologia
- invariantes del kernel

## Topologia LangGraph recomendada

```text
input router
  -> intent framer
  -> branch by task kind
      - wizard generation
      - opl import normalization
      - incremental edit
      - refinement
      - render
  -> patch proposal
  -> deterministic validation gate
      - pass -> apply to kernel
      - fail -> reject or request clarification
  -> derived outputs
      - OPL
      - ValidationReport
      - VisualRenderSpec
      - premium SVG
```

Interrupts / HITL:

- cambio de boundaries del sistema
- reinterpretacion de beneficiary/function
- colision de roles semanticos no resuelta con confianza
- refinamiento con multiples alternativas metodologicamente validas

## Minimalismo de repo

La direccion correcta no requiere rescatar todo `opmodel`.

### Conservar

- `packages/core/src/semantic-kernel.ts`
- parser / compiler / validation OPL
- generator pipeline nuevo
- `VisualRenderSpec`
- renderer determinista + premium renderer
- `OpmGraphGeneratorPanel` y workspace asociado

### Depriorizar

- canvas-first ergonomics como centro del producto
- grandes inversiones en editor visual libre legacy
- cualquier modulo cuya justificacion principal sea "ya existe"

### Aislar

- orquestacion agentica LangGraph/Deep Agents
- memoria de sesiones de modelado
- experimentacion LLM intensiva

## Direccion de implementacion

### Fase 1

Documentar el contrato y crear un servicio minimo de orquestacion.

Capacidades:
- `wizard intent -> draft proposal`
- `imported opl -> normalized opl -> parsed model`
- `incremental request -> kernel patch proposal`

### Fase 2

Integrar el generator web al orquestador.

Capacidades:
- chat/panel de modelado incremental
- acceptance/rejection de patches
- provenance visible
- replay simple del historial de decisiones

### Fase 3

Agregar refinement y memoria.

Capacidades:
- SD1 planner
- subagentes especializados
- memoria de decisiones de modelado
- evaluacion sistematica de calidad

## Criterio de exito

La nueva direccion se considera validada cuando el sistema puede, en casos reales:

1. crear un SD valido desde interaccion guiada con LLM
2. importar OPL y entrar al mismo workspace de modelado
3. aceptar pedidos incrementales tipo "agrega instrumento", "refina este proceso", "corrige naming"
4. producir patches trazables y validados
5. renderizar SVG premium verificado
6. rechazar o escalar cambios que violen el SSOT

## Resumen corto

La direccion correcta ya no es hacer que todo `opmodel` tenga sentido.

La direccion correcta es conservar solo el nucleo semantico y la nueva superficie generativa, y montar encima una capa LangGraph/Deep Agents donde los LLMs median todo el flujo, pero nunca mandan sobre OPM.
