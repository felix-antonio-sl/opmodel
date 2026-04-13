from __future__ import annotations

import json
import subprocess
from pathlib import Path
from typing import Any

REPO_ROOT = Path("/home/felix/projects/opmodel")
OPL_IMPORT_SCRIPT_PATH = REPO_ROOT / "services/modeling-orchestrator/scripts/opl_import_bridge.ts"
WIZARD_GENERATE_SCRIPT_PATH = REPO_ROOT / "services/modeling-orchestrator/scripts/wizard_generate_bridge.ts"
INCREMENTAL_CHANGE_SCRIPT_PATH = REPO_ROOT / "services/modeling-orchestrator/scripts/incremental_change_bridge.ts"


class CoreBridgeError(RuntimeError):
    pass


def run_opl_import(opl_text: str, language: str = "mixed") -> dict[str, Any]:
    payload = {
        "kind": "opl-import",
        "oplText": opl_text,
        "language": language,
    }
    return _run_bun_bridge(OPL_IMPORT_SCRIPT_PATH, payload, "OPL import")



def run_wizard_generate(draft: dict[str, Any]) -> dict[str, Any]:
    payload = {
        "kind": "wizard-generate",
        "draft": draft,
    }
    return _run_bun_bridge(WIZARD_GENERATE_SCRIPT_PATH, payload, "wizard generate")



def run_incremental_change(
    request: str,
    *,
    current_opl: str | None = None,
    model_snapshot: dict[str, Any] | None = None,
) -> dict[str, Any]:
    payload = {
        "kind": "incremental-change",
        "request": request,
        "currentOpl": current_opl,
        "modelSnapshot": model_snapshot,
    }
    return _run_bun_bridge(INCREMENTAL_CHANGE_SCRIPT_PATH, payload, "incremental change")



def _run_bun_bridge(script_path: Path, payload: dict[str, Any], label: str) -> dict[str, Any]:
    result = subprocess.run(
        ["bun", str(script_path)],
        cwd=REPO_ROOT,
        input=json.dumps(payload),
        text=True,
        capture_output=True,
        check=False,
    )

    if result.returncode != 0:
        raise CoreBridgeError(
            f"{label} bridge failed"
            f"\nstdout:\n{result.stdout.strip()}"
            f"\nstderr:\n{result.stderr.strip()}"
        )

    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        raise CoreBridgeError(
            f"{label} bridge returned invalid JSON"
            f"\nstdout:\n{result.stdout.strip()}"
            f"\nstderr:\n{result.stderr.strip()}"
        ) from exc
