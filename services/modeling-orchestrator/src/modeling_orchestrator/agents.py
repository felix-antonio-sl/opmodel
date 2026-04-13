from __future__ import annotations

from typing import Any


def build_deep_agent_config(*, ssot_summary: str, task_kind: str) -> dict[str, Any]:
    """Return the future Deep Agents configuration.

    This first slice intentionally does not instantiate a live model provider.
    It captures the guardrail contract the eventual agent must obey.
    """

    system_prompt = "\n".join(
        [
            "You are an OPM modeling worker inside OPModel.",
            "You do not own OPM semantics.",
            "You must obey the external SSOT corpus in this precedence order:",
            ssot_summary,
            "You may propose drafts, normalized OPL, refinement ideas, render intents, or kernel patches.",
            "You may not silently redefine agents, instruments, transforms, refinement rules, or OPL semantics.",
            f"Current task kind: {task_kind}",
        ]
    )

    return {
        "model": "openai:gpt-5.4",
        "task_kind": task_kind,
        "system_prompt": system_prompt,
        "tools": [],
    }
