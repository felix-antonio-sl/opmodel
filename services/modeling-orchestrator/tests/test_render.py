import json

from modeling_orchestrator.contracts import ModelingTaskEnvelope
from modeling_orchestrator.main import run_task


def _build_wizard_model_snapshot() -> dict:
    wizard_envelope = ModelingTaskEnvelope.model_validate(
        {
            "task": {
                "kind": "wizard-generate",
                "systemName": "Battery Charging System",
                "mainProcess": "Battery Charging",
                "beneficiary": "Driver Group",
                "beneficiaryAttribute": "Mobility Convenience",
                "beneficiaryStateIn": "limited",
                "beneficiaryStateOut": "enhanced",
                "valueObject": "Battery",
                "valueStateIn": "depleted",
                "valueStateOut": "charged",
                "agents": ["Operator"],
                "instruments": ["Charging Station"],
                "inputs": ["Electrical Energy"],
                "outputs": ["Charged Battery"],
                "source": "wizard",
            }
        }
    )
    wizard_result = run_task(wizard_envelope)
    model_json = wizard_result.artifacts[0].payload.outputs["modelJson"]
    return json.loads(model_json)


def test_render_generates_visual_render_spec_from_model_snapshot():
    model_snapshot = _build_wizard_model_snapshot()

    envelope = ModelingTaskEnvelope.model_validate(
        {
            "task": {
                "kind": "render",
                "modelSnapshot": model_snapshot,
                "source": "system",
            }
        }
    )

    result = run_task(envelope)

    assert result.status == "proposed"
    assert result.guardrail.ok is True
    assert result.artifacts[0].artifact_kind == "render-intent"

    payload = result.artifacts[0].payload
    assert payload.ok is True
    assert payload.proposal.requiresHumanReview is False
    assert payload.context["diagramKind"] == "opm-sd"
    assert payload.outputs["visualSpec"]["nodes"]
    assert payload.outputs["canonicalOpl"]


def test_render_marks_invalid_visual_spec_for_review():
    envelope = ModelingTaskEnvelope.model_validate(
        {
            "task": {
                "kind": "render",
                "visualSpec": {
                    "version": "v1",
                    "diagramKind": "opm-sd",
                    "title": "Broken",
                    "style": "dark-terminal",
                    "scene": {"lanes": [], "groups": []},
                    "nodes": [],
                    "edges": [],
                    "guardrails": [],
                    "canonicalOpl": "",
                },
                "source": "system",
            }
        }
    )

    result = run_task(envelope)

    assert result.status == "needs-review"
    assert result.guardrail.ok is False

    payload = result.artifacts[0].payload
    assert payload.ok is False
    assert payload.proposal.requiresHumanReview is True
    assert payload.context["verification"]["issues"]
