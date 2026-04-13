from modeling_orchestrator.contracts import ModelingTaskEnvelope
from modeling_orchestrator.main import run_task


def test_refine_process_builds_real_refinement_proposal_from_current_opl():
    envelope = ModelingTaskEnvelope.model_validate(
        {
            "task": {
                "kind": "refine-process",
                "processId": "Battery Charging",
                "request": "subprocesses: Authorize Charge, Transfer Energy, Confirm Completion; internal objects: Charging Session, Charge Status",
                "currentOpl": "Battery Charging is a process, physical.\nBattery is an object, physical.\nBattery Charging consumes Battery.",
                "source": "incremental-session",
            }
        }
    )

    result = run_task(envelope)

    assert result.status == "needs-review"
    assert result.guardrail.ok is False
    assert result.artifacts[0].artifact_kind == "refinement-proposal"

    payload = result.artifacts[0].payload
    assert payload["ok"] is False
    assert payload["proposal"]["refinementKind"] == "in-zoom"
    assert payload["proposal"]["requiresHumanReview"] is True
    assert payload["proposal"]["draft"]["subprocesses"] == [
        "Authorize Charge",
        "Transfer Energy",
        "Confirm Completion",
    ]
    assert payload["context"]["methodology"]["issues"]
    assert "=== SD1 ===" in payload["outputs"]["canonicalOpl"]
