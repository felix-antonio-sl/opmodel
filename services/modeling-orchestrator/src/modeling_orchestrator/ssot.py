from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

SSOT_ROOT = Path("/home/felix/kora/KNOWLEDGE/fxsl/opm/opm-ssot")
ISO_PATH = SSOT_ROOT / "opm-iso-19450.md"
OPL_ES_PATH = SSOT_ROOT / "opm-opl-es.md"
METHODOLOGY_PATH = SSOT_ROOT / "metodologia-modelamiento-opm.md"


@dataclass(frozen=True)
class SsotCorpus:
    iso_19450: str
    opl_es: str
    methodology: str


def load_ssot_corpus() -> SsotCorpus:
    return SsotCorpus(
        iso_19450=ISO_PATH.read_text(encoding="utf-8"),
        opl_es=OPL_ES_PATH.read_text(encoding="utf-8"),
        methodology=METHODOLOGY_PATH.read_text(encoding="utf-8"),
    )


def build_ssot_summary(corpus: SsotCorpus) -> str:
    return "\n".join(
        [
            "Normative precedence:",
            "1. ISO 19450",
            "2. OPL-ES",
            "3. Metodologia de Modelamiento OPM",
            "Hard rules extracted for the orchestrator:",
            "- Agent means human only; non-human enablers are instruments.",
            "- Every process must transform at least one object.",
            "- OPL and OPD are semantically equivalent modalities.",
            "- SD starts from the main function/process, not from free visual layout.",
            "- Refinement must respect SD/SD1 methodology and role distribution.",
        ]
    )
