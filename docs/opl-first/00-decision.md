# ADR-001: OPL-First Architecture

| Campo | Valor |
|-------|-------|
| Fecha | 2026-04-06 |
| Estado | Accepted |
| Autor | Felix (Ominono) |

## Contexto

OPModel es un model engine + visual editor + OPL exporter.
La fuente de verdad actual es el grafo `.opmodel` (JSON con Maps de things, states, links, etc.).
El OPL es una proyección derivada vía `expose()` → `render()`.

El flujo actual es:

```
Model (.opmodel) → expose → render → OPL text
```

## Decisión

Invertir la dirección:

```
OPL text → parse → compile → Model (IR) → validate → visual render
```

El OPL pasa a ser la fuente de verdad de autoría.
El modelo semántico y la representación visual pasan a ser derivados.

## Reglas

1. El artefacto canónico de autoría es el OPL.
2. La validación ocurre antes del render visual.
3. La vista visual representa; no define.
4. Toda modificación entra por OPL.
5. La edición visual futura deberá traducirse a cambios OPL válidos.

## Consecuencias

| Qué cambia | Detalle |
|------------|---------|
| Se necesita parser OPL | No existe hoy |
| Se necesita compiler OPL → Model | No existe hoy |
| Errores deben referenciar OPL source | Hoy referencian IDs internos |
| Render visual pasa a derivado | Hoy es la superficie principal |
| `.opmodel` puede seguir como persistencia | Pero no como fuente de autoría |

## Edición visual futura

Diferida. Cuando exista, debe cumplir:

> Toda edición visual se compila a OPL válido y se revalida.

No al revés.

## Frase de producto

> OPModel no es un editor gráfico con exportación textual.
> Es un compilador/validador de OPL con representación visual derivada.
