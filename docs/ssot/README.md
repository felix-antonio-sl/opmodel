# SSOT References

Este directorio expone el corpus normativo OPM al que se subordina `opmodel`.

## Vigente (canónico)

**`opm-ssot-es/`** — corpus OPM ES v2.x, 4 capas con URN estables.

- `opm-iso-19450-es.md` — núcleo conceptual. URN `urn:fxsl:kb:opm-es`.
- `opm-opl-es.md` — gramática OPL-ES + EBNF (Apéndice A). URN `urn:fxsl:kb:opl-es`.
- `opm-visual-es.md` — gramática visual OPD (123 reglas V-*). URN `urn:fxsl:kb:opd-es`.
- `metodologia-opm-es.md` — procedimientos y heurísticas. URN `urn:fxsl:kb:manual-metodologico-opm-es`.

Symlink vivo: [`opm-ssot-es`](./opm-ssot-es) → `/home/felix/kora/KNOWLEDGE/fxsl/opm/opm-ssot-es`.

## Histórico (referencia, no normativo)

**`opm-ssot/`** — corpus previo en inglés, fragmentado (p02..p05). Preservado para trazabilidad.

Symlink: [`opm-ssot`](./opm-ssot).

## Precedencia normativa

Dentro del corpus vigente, orden de autoridad:

1. Núcleo conceptual — `opm-iso-19450-es.md`
2. Realización textual — `opm-opl-es.md`
3. Realización gráfica — `opm-visual-es.md`
4. Procedimientos — `metodologia-opm-es.md`

## Regla de subordinación del repo

El repositorio `opmodel` es **implementación** de la SSOT. No redefine semántica OPM. Toda decisión del repo que tenga dimensión normativa debe:

1. Citar URN + sección de la capa propietaria.
2. Ante conflicto, ganar la SSOT y proponer corrección en el repo.
3. Si el repo descubre una regla o caso no cubierto por la SSOT, registrar en `candidate-extensions.md` para retorno a kora.

ADRs del repo deciden **implementación** (cómo se ejecuta OPM en TS), no semántica (qué ES OPM).

## Enriquecimiento reverso

Aprendizajes operacionales del repo que deben reflejarse en SSOT se registran en [`candidate-extensions.md`](./candidate-extensions.md). Son candidatos para PR contra kora.
