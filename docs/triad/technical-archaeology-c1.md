# Technical Archaeology — Corte 1

Fecha: 2026-03-29
Origen: steipete
Ámbito: `/home/felix/projects/opmodel`

## Objetivo
Levantar la topología real del sistema, sus paquetes, dependencias internas, entrypoints y fuente de verdad efectiva.

## Topología real del sistema
El repo vivo aparece como un monorepo TypeScript con cuatro paquetes activos:
- `packages/core`
- `packages/cli`
- `packages/nl`
- `packages/web`

Forma efectiva observada:
- `@opmodel/core` <- `@opmodel/cli`
- `@opmodel/core` <- `@opmodel/nl`
- `@opmodel/core` <- `@opmodel/web`
- `@opmodel/nl` <- `@opmodel/web`

Lectura fuerte:
- `core` actúa como plataforma semántica
- `web`, `cli` y `nl` actúan como adaptadores operativos
- la raíz del repo funciona más como contenedor de workspace que como aplicación integrada

## Mapa de paquetes

### `packages/core`
Rol real: núcleo del sistema.

Archivos clave identificados:
- `src/types.ts`
- `src/model.ts`
- `src/api.ts`
- `src/serialization.ts`
- `src/opl.ts`
- `src/simulation.ts`
- `src/structural.ts`
- `src/index.ts`

Lectura:
Aquí vive casi toda la semántica real.

### `packages/cli`
Rol real: interfaz shell para operar archivos `.opmodel`.

Archivos clave identificados:
- `src/cli.ts`
- `src/io.ts`
- `src/commands/*`

Comandos observados:
- `new`
- `add`
- `remove`
- `list`
- `show`
- `validate`
- `update`
- `refine`
- `opl`

Nota:
Existe `commands/stats.ts`, pero no aparece expuesto en `cli.ts`.

### `packages/nl`
Rol real: capa de lenguaje natural.

Archivos clave identificados:
- `src/parse.ts`
- `src/resolve.ts`
- `src/pipeline.ts`
- `src/provider.ts`
- `src/prompt.ts`
- `src/index.ts`

Lectura:
No define semántica propia; resuelve operaciones contra `@opmodel/core`.

### `packages/web`
Rol real: aplicación interactiva principal.

Archivos clave identificados:
- `src/main.tsx`
- `src/App.tsx`
- `src/hooks/useModelStore.ts`
- `src/lib/commands.ts`
- `src/components/*`
- `src/lib/*`
- `vite.config.ts`

Lectura:
No es solo viewer; funciona como editor serio con simulación, validación, OPL y export.

## Dependencias internas
Declaradas y/o visibles:
- `@opmodel/cli` depende de `@opmodel/core`
- `@opmodel/nl` depende de `@opmodel/core`
- `@opmodel/web` depende de `@opmodel/core` y `@opmodel/nl`

No se observó dependencia de `cli` hacia `nl` ni acoplamiento directo `cli` <-> `web`.

Conclusión:
`core` no es accesorio; es el centro efectivo del sistema.

## Entrypoints reales

### Raíz
`package.json` raíz observado con scripts:
- `test`
- `test:watch`

Ausencias relevantes en raíz:
- `dev`
- `build`
- `typecheck`
- `start`

### Core
Entrypoint de librería:
- `packages/core/src/index.ts`

### CLI
Entrypoint real:
- `packages/cli/src/cli.ts`

Observación:
El bin apunta a `src/cli.ts`, no a un artefacto compilado en `dist/`.

### NL
Entrypoint real:
- `packages/nl/src/index.ts`

### Web
Entrypoints reales:
- `packages/web/src/main.tsx`
- `packages/web/src/App.tsx`
- `packages/web/vite.config.ts`

Observación:
La web incorpora infraestructura dev embebida, incluyendo persistencia de bugs en `dev-data/test-bugs.json`.

## Tensiones visibles
- La semántica del dominio parece más madura que la orquestación del monorepo.
- La raíz agrupa, pero no gobierna bien el ciclo operativo completo del producto.
- El sistema tiene un núcleo fuerte (`core`), pero la superficie integrada de trabajo aún no aparece como flujo único claramente cerrado.

## Conclusión del corte 1
OPModel sí se comporta como sistema real con núcleo semántico central y múltiples superficies encima. No luce como app aislada ni demo visual, sino como workbench con arquitectura centrada en `core`.
