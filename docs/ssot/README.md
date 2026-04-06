# SSOT References

This directory exposes the authoritative OPM reference corpus used by OPModel.

## Canonical link

- [`opm-ssot`](./opm-ssot) → symlink to `/home/felix/kora/KNOWLEDGE/fxsl/opm/opm-ssot`

## Contents of the SSOT corpus

- `opm-iso-19450.md` — normative OPM semantics and OPL-EN surface
- `opm-opl-es.md` — normative OPL-ES linguistic surface
- `metodologia-modelamiento-opm.md` — operational modelling methodology

## Precedence

When there is any conflict or ambiguity, use this order:

1. **ISO 19450**
2. **OPL-ES**
3. **Metodología de Modelamiento OPM**

## Repo rule

All OPM / OPL modelling, parsing, rendering, validation, and refinement work in this repo should be checked against this SSOT corpus.

The symlink exists so the corpus stays visible from inside the repo and can be referenced consistently in code, docs, and future tooling.
