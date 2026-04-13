from modeling_orchestrator.contracts import ModelingTaskEnvelope
from modeling_orchestrator.main import run_task


def test_incremental_change_builds_stable_patch_proposal():
    envelope = ModelingTaskEnvelope.model_validate(
        {
            "task": {
                "kind": "incremental-change",
                "request": "add instrument Backup Generator to Battery Charging",
                "currentOpl": "Battery Charging is a process, physical.\nBattery is an object, physical.\nBattery Charging consumes Battery.",
                "modelSnapshot": {},
                "source": "incremental-session",
            }
        }
    )

    result = run_task(envelope)

    assert result.status == "proposed"
    assert result.guardrail.ok is True
    assert result.artifacts[0].artifact_kind == "kernel-patch-proposal"

    payload = result.artifacts[0].payload
    assert payload.ok is True
    assert payload.proposal.confidence >= 0.9
    assert payload.proposal.requiresHumanReview is False
    assert payload.proposal.operations[0]["kind"] == "add-enabler"
    assert payload.proposal.operations[0]["role"] == "instrument"


def test_incremental_change_marks_ambiguous_requests_for_review():
    envelope = ModelingTaskEnvelope.model_validate(
        {
            "task": {
                "kind": "incremental-change",
                "request": "make it better somehow",
                "source": "incremental-session",
            }
        }
    )

    result = run_task(envelope)

    assert result.status == "needs-review"
    assert result.guardrail.ok is False

    payload = result.artifacts[0].payload
    assert payload.ok is False
    assert payload.proposal.requiresHumanReview is True
    assert payload.proposal.operations[0]["kind"] == "manual-review"
