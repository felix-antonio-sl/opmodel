# Handoff: CLI `opmod update` Command

**Fecha:** 2026-03-11
**Branch:** master
**Commit:** a4e5fca (merge commit)

---

## Artefactos Producidos

### Codigo Nuevo/Modificado (`packages/cli/`)

| Archivo | Accion | Responsabilidad |
|---------|--------|-----------------|
| `src/commands/update.ts` | Creado (191 LOC) | 6 handlers de update + `parseInputPatch<T>` + `executeUpdate` entry point |
| `tests/update.test.ts` | Creado (248 LOC) | 16 tests cubriendo todos los handlers, edge cases y errores |
| `src/cli.ts` | Modificado | Registro de 6 subcomandos `update` en Commander con flags tipados |
| `src/index.ts` | Modificado | Barrel export de `executeUpdate` |

### Documentacion

| Archivo | Accion |
|---------|--------|
| `docs/superpowers/specs/2026-03-11-cli-opmod-update-design.md` | Design spec con analisis categorico |
| `docs/superpowers/plans/2026-03-11-cli-opmod-update.md` | Plan de implementacion (4 tasks, 2 chunks) |

---

## Decisiones de Diseno

### Hybrid Selective Input Mode
- **Flags individuales** para campos comunes (--name, --kind, --essence, etc.)
- **`--input` JSON** para patches complejos o modo agente
- `--input` toma precedencia sobre flags cuando ambos presentes

### Entidades Soportadas (6)
1. **thing** — name, kind, essence, affiliation
2. **state** — name, parent, initial/final/default (booleans)
3. **link** — type, source, target, source-state, target-state
4. **opd** — name, opd-type, parent, refines, refinement
5. **meta** (singleton) — name, description, system-type
6. **settings** (singleton) — solo via `--input`

### Patrones Clave

- **`parseInputPatch<T>`**: Parser generico que valida JSON, rechaza non-object (arrays, primitivos, null), y stripea campos inmutables (id, thing, opd, created, modified)
- **Map-based dispatch**: `Map<string, UpdateHandler>` para entidades con ID + `Map<string, SingletonUpdateHandler>` para meta/settings
- **camelCase → snake_case mapping**: Commander produce camelCase de flags kebab-case, core API usa snake_case (e.g., `opts.sourceState` → `patch.source_state`)
- **Boolean flags explicitos**: Commander NO auto-genera `--no-*` variants — registrados como `.option()` separados para `--initial/--no-initial`, `--final/--no-final`, `--default/--no-default`

### Analisis Categorico
- Update como endomorfismo en Model: `u: M → M` (preserva identidad)
- id inmutable = preservacion de identidad en la categoria
- Coherencia fibracional via invariante I-03 (view guard)
- Patch rejection (no cascade) preserva estructura del grafo

---

## Fixes durante implementacion

| Fix | Causa |
|-----|-------|
| Essence `"informational"` → `"informatical"` | Typo heredado del spec — tipo correcto segun types.ts |
| Settings description `"(required)"` faltante | Spec requiere indicar que `--input` es obligatorio |
| Guard non-object JSON en `parseInputPatch` | `JSON.parse("42")` no falla pero `delete parsed.id` silenciosamente no opera |
| Boolean `--no-*` flags re-agregados | Plan reviewer incorrectamente dijo que Commander auto-genera; no lo hace |
| Link test adaptado para DANGLING_STATE | `source_state` debe pertenecer al thing fuente — test ajustado a solo `targetState` |

---

## Metricas

| Metrica | Valor |
|---------|-------|
| Tests totales (proyecto) | 232 |
| Tests nuevos (update) | 16 |
| Archivos CLI fuente | 12 |
| Archivos CLI test | 11 |
| LOC nuevas | ~439 |
| Comandos CLI total | 7 (new, add, remove, list, show, validate, update) |

---

## Estado del CLI Post-Merge

```
opmod new          — Crear modelo nuevo
opmod add <type>   — Agregar entidad
opmod remove <type> <id> — Eliminar entidad
opmod list <type>  — Listar entidades
opmod show <type> <id> — Mostrar detalle
opmod validate     — Validar modelo
opmod update <type> <id> [flags|--input] — Actualizar entidad  ← NUEVO
```

---

## Proximos Pasos Recomendados

1. **`opmod undo`/`opmod redo`** — Integrar History<T> al CLI (ya existe en core)
2. **`opmod export`/`opmod import`** — Exportar a OPL, importar desde JSON
3. **Mas invariantes P1**: I-16 (unique procedural link), I-17 (process must transform)
4. **Properties panel (web)** — Editing de propiedades inline en el editor visual
5. **Coverage HU backlog** — L-M1-02.a (update thing), L-M1-06.a (update state) ahora cubiertos via CLI
