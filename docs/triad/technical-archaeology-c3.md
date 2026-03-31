# Technical Archaeology — Corte 3

Fecha: 2026-03-29
Origen: steipete
Ámbito: `/home/felix/projects/opmodel`

## Objetivo
Verificar el estado operativo actual real del repo: runner, tests, build web, dev local, deuda visible y bloqueos para pasar de workbench a herramienta principal estable.

## Runner canónico actual
### Lo que sí existe
En raíz se observan scripts:
- `test`: `vitest run`
- `test:watch`: `vitest`

Además, `vitest.config.ts` raíz incluye tests bajo `packages/*/tests/**/*.test.ts`.

Scripts por paquete mencionados por steipete:
- `core`: `test`, `test:watch`, `typecheck`
- `cli`: `test`, `test:watch`, `typecheck`
- `web`: `dev`, `build`, `preview`
- `nl`: sin scripts de test/build relevantes observados

### Lo que no existe
No se observó runner canónico integrado para:
- `build` de todo el monorepo
- `dev` raíz
- `typecheck` raíz
- CI/workflows (`.github` ausente)
- task orchestration (`turbo`, `just`, `make`, etc. ausentes)

## Estado real de tests
### Comando corrido
`bun run test`

### Resultado
Falla al arrancar, antes de ejecutar la suite.

### Falla reportada
Choque ESM/CJS al cargar `vitest.config.ts`, con error tipo:
- `Error [ERR_REQUIRE_ESM]`
- interacción problemática entre `vitest` y `vite`

### Lectura
La falla parece pertenecer al harness de test/tooling, no necesariamente a un test funcional del producto.

### Evidencia adicional reportada
- ~70 archivos `*.test.ts` encontrados
- contraste con narrativas previas que hablan de cientos de tests en verde

### Conclusión
El runner canónico de tests hoy no está sano en este checkout/runtime.

## Estado real del build web
### Comando corrido
`bun run --filter @opmodel/web build`

### Resultado
Falla por errores TypeScript en `core` y `web` antes del cierre del build.

### Tipos de fallas mencionadas
- casts problemáticos en `packages/core/src/api.ts`
- nulabilidad y propiedades faltantes en `packages/core/src/opl.ts`
- nulabilidad en `packages/core/src/simulation.ts`
- varios `possibly undefined` y problemas de tipos en componentes y librerías de `packages/web`

### Conclusión
El build web actual está roto de forma directa y reproducible.

## Estado real de dev/run local
### Comando corrido
`bun run --filter @opmodel/web dev --host 127.0.0.1 --strictPort`

### Resultado
No levanta.

### Falla reportada
Error de permisos al intentar limpiar/usar cache de Vite:
- `EACCES: permission denied, rmdir '.../packages/web/node_modules/.vite/deps'`

### Observación adicional
Hay directorios con ownership `root:root` dentro de `.vite`, mientras otras partes del árbol están bajo el usuario de trabajo.

### Conclusión
El entorno local aparece contaminado por permisos inconsistentes además de los problemas de build.

## Deuda visible
A partir del reporte de steipete, la deuda visible incluye:
- ausencia de orquestación canónica del monorepo
- baseline de test rota por tooling
- build web roto por TypeScript
- entorno dev roto por permisos/caches
- desalineación probable entre narrativa/documentación e integridad ejecutable actual

## Docs o narrativa desfasada
steipete marcó tensión entre el estado ejecutable observado y narrativas/handoffs que declaran suites grandes en verde o mayor estabilidad.

Lectura:
La documentación o relatos de estado parecen sobredeclarar salud en comparación con el checkout/runtime inspeccionado.

## Qué bloquea pasar de workbench a herramienta principal estable
Bloqueos principales:
1. Runner de tests no confiable
2. Build web no cierra
3. Dev local contaminado por permisos
4. Falta de superficie canónica de operación del monorepo
5. Posible drift entre docs y estado real

## Recomendación técnica mínima de siguiente fase
Consistente con el límite de autonomía definido por Allan:
1. Reparar runner canónico de tests
2. Dejar build web en verde
3. Limpiar permisos/caches del entorno local
4. Recién después validar los 3 casos reales exigidos por el intent contract

## Conclusión del corte 3
OPModel hoy no está listo como herramienta principal estable. Sí parece workbench potente con núcleo serio, pero con baseline técnica y operativa rota. La siguiente fase correcta no es expansión de capacidades, sino saneamiento de baseline.
