from __future__ import annotations

import json
import subprocess
from pathlib import Path
from typing import Any

REPO_ROOT = Path("/home/felix/projects/opmodel")
SCRIPT_PATH = REPO_ROOT / "services/modeling-orchestrator/scripts/opl_import_bridge.ts"


class CoreBridgeError(RuntimeError):
    pass


def run_opl_import(opl_text: str, language: str = "mixed") -> dict[str, Any]:
    payload = {
        "kind": "opl-import",
        "oplText": opl_text,
        "language": language,
    }

    result = subprocess.run(
        ["bun", str(SCRIPT_PATH)],
        cwd=REPO_ROOT,
        input=json.dumps(payload),
        text=True,
        capture_output=True,
        check=False,
    )

    if result.returncode != 0:
        raise CoreBridgeError(
            "OPL import bridge failed"
            f"\nstdout:\n{result.stdout.strip()}"
            f"\nstderr:\n{result.stderr.strip()}"
        )

    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        raise CoreBridgeError(
            "OPL import bridge returned invalid JSON"
            f"\nstdout:\n{result.stdout.strip()}"
            f"\nstderr:\n{result.stderr.strip()}"
        ) from exc
