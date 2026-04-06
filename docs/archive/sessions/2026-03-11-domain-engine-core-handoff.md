# Handoff: Domain Engine Core Implementation

**Fecha:** 2026-03-11
**Branch:** master (merged from feat/domain-engine-core)
**Commits:** 17 (6960d16..890d900)

---

## Artefactos Producidos

### Codigo (`packages/core/`)

| Archivo | Lineas | Responsabilidad |
|---------|--------|-----------------|
| `src/types.ts` | 264 | 31 tipos OPM derivados de data model Rev.3 |
| `src/result.ts` | 23 | Result<T,E> monad (ok/err/isOk/isErr) |
| `src/model.ts` | 36 | createModel factory con SD root OPD |
| `src/helpers.ts` | 17 | collectAllIds (11 colecciones) |
| `src/serialization.ts` | 199 | loadModel/saveModel con convenciones §7.2 |
| `src/api.ts` | 548 | 26 funciones CRUD + validate() batch |
| `src/index.ts` | 19 | Barrel exports |

### Tests (9 archivos, 72 tests)

| Archivo | Tests | Cobertura |
|---------|-------|-----------|
| `types.test.ts` | 3 | Estructura de tipos |
| `model.test.ts` | 5 | createModel + defaults |
| `serialization.test.ts` | 14 | save/load + round-trip I-25 |
| `api.test.ts` | 17 | addThing/removeThing (I-02, I-08) + addState (I-01) |
| `api-links.test.ts` | 10 | addLink/removeLink (I-05, I-14, I-18, I-19) |
| `api-opds.test.ts` | 7 | addOPD/removeOPD (I-03 + cascade recursivo) |
| `api-appearances.test.ts` | 5 | addAppearance (I-04, I-15) |
| `api-secondary.test.ts` | 9 | Modifiers, fans, assertions + validate() |
| `integration.test.ts` | 2 | Coffee Making end-to-end + fixture load |

### Invariantes Implementados

| Tipo | Invariantes |
|------|-------------|
| Guards (pre-mutation) | I-01, I-03, I-04, I-05, I-06, I-07, I-08, I-09, I-10, I-11, I-12, I-13, I-14, I-15, I-18 |
| Effects (during mutation) | I-02 (cascade delete), I-19 (exhibition coerce) |
| Batch validate() | I-01 a I-15, I-18, I-19 |
| Test | I-25 (round-trip) |

### Documentos

- `docs/superpowers/specs/2026-03-11-domain-engine-stack-design.md` — Spec aprobada
- `docs/superpowers/plans/2026-03-11-domain-engine-core.md` — Plan ejecutado (15 tareas)

---

## Decisiones Tomadas

| Decision | Razon |
|----------|-------|
| Flat file layout (no subdirs) | ~1100 LOC no justifica directories; plan ya apuntaba a archivos individuales |
| `rootDir: "."` en tsconfig | `"src"` excluia tests/ del type-checking |
| `@types/bun` para fs/path/__dirname | Tests usan APIs Node que Bun soporta |
| `bun.lock -text` (no `bun.lockb binary`) | Bun v1.3.10 usa formato texto |
| null preservado en sortKeys | parent_opd es required+nullable, unico campo asi |

---

## Mejoras Identificadas (Code Review)

Para proximo pulso:

1. **Validar source_state/target_state en addLink** — actualmente no se verifica existencia ni pertenencia
2. **Validar thing/OPD existencia en addAppearance** — solo chequea I-04 y I-15
3. **removeState cascade a links** — links con source_state/target_state quedan huerfanos
4. **I-16** (unicidad enlace procedimental por par process+object)
5. **I-17** (proceso debe transformar >= 1 objeto) — nivel warning
6. **Refactor unwrap()** — compartir helper entre test files
7. **Split api.ts** — cuando crezca con update operations

---

## Siguiente Paso Recomendado

1. **Plan para `packages/cli`** — `opmod` command (Commander.js) con comandos P0: new, load, save, add, remove, list, show, validate
2. Alternativa: profundizar core con invariantes P1 (I-16, I-17) y validaciones faltantes antes de CLI

---

## Runtime

- Bun v1.3.10 en `~/.bun/bin/bun`
- Requiere PATH: `export BUN_INSTALL="$HOME/.bun" && export PATH="$BUN_INSTALL/bin:$PATH"`
- Tests: `bunx vitest run` (desde raiz del proyecto)
- Type check: `cd packages/core && bunx tsc --noEmit`
