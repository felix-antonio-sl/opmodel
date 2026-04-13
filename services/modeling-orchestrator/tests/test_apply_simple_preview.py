import json

from modeling_orchestrator.contracts import ApplySimplePreviewRequest, ModelingTaskEnvelope
from modeling_orchestrator.main import apply_simple_preview, run_task


def _build_incremental_artifact():
    envelope = ModelingTaskEnvelope.model_validate(
        {
            "task": {
                "kind": "incremental-change",
                "request": "add instrument Backup Generator to Battery Charging",
                "currentOpl": "Battery Charging is a process, physical.\nBattery is an object, physical.\nBattery Charging consumes Battery.",
                "source": "incremental-session",
            }
        }
    )
    result = run_task(envelope)
    return result.artifacts[0]


def test_apply_simple_preview_returns_renderable_workspace_payload():
    artifact = _build_incremental_artifact()

    result = apply_simple_preview(ApplySimplePreviewRequest(artifact=artifact))

    assert result.ok is True
    assert result.artifact_kind == "kernel-patch-proposal"
    assert result.appliedFromTaskKind == "incremental-change"
    assert result.modelJson
    assert result.canonicalOpl
    assert result.visualSpec
    assert result.visualSpec["nodes"]

    loaded = json.loads(result.modelJson)
    assert loaded["things"]
