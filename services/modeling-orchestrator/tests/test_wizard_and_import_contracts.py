from modeling_orchestrator.contracts import ModelingTaskEnvelope
from modeling_orchestrator.main import run_task


def test_wizard_generate_uses_normalized_artifact_payload_shape():
    envelope = ModelingTaskEnvelope.model_validate(
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

    result = run_task(envelope)

    assert result.status == "proposed"
    payload = result.artifacts[0].payload
    assert payload.ok is True
    assert payload.proposal.requiresHumanReview is False
    assert payload.context["validation"]
    assert payload.context["kernel"]
    assert payload.outputs["canonicalOpl"]
    assert payload.outputs["modelJson"]
    assert payload.agent
    assert payload.inputs["draft"]["mainProcess"] == "Battery Charging"


def test_opl_import_uses_normalized_artifact_payload_shape():
    envelope = ModelingTaskEnvelope.model_validate(
        {
            "task": {
                "kind": "opl-import",
                "oplText": "Coffee Making is a process, physical.\nWater is an object, physical.\nCoffee Making consumes Water.",
                "language": "mixed",
                "source": "imported-opl",
            }
        }
    )

    result = run_task(envelope)

    assert result.status == "proposed"
    payload = result.artifacts[0].payload
    assert payload.ok is True
    assert payload.proposal.requiresHumanReview is False
    assert payload.context["language"] == "mixed"
    assert payload.context["kernel"]
    assert payload.outputs["canonicalOpl"]
    assert payload.outputs["modelJson"]
    assert payload.inputs["oplText"].startswith("Coffee Making")
