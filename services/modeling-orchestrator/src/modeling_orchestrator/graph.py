from __future__ import annotations

from langgraph.graph import END, START, StateGraph

from .contracts import GuardrailReport, ModelingTaskEnvelope, ModelingTaskResult
from .ssot import build_ssot_summary, load_ssot_corpus
from .state import OrchestratorState
from .workers import (
    apply_ssot_guardrail,
    incremental_change_worker,
    opl_import_worker,
    refine_process_worker,
    render_worker,
    route_task,
    wizard_worker,
)


def build_modeling_graph():
    graph = StateGraph(OrchestratorState)
    graph.add_node("route_task", route_task)
    graph.add_node("wizard_worker", wizard_worker)
    graph.add_node("opl_import_worker", opl_import_worker)
    graph.add_node("incremental_change_worker", incremental_change_worker)
    graph.add_node("refine_process_worker", refine_process_worker)
    graph.add_node("render_worker", render_worker)
    graph.add_node("apply_ssot_guardrail", apply_ssot_guardrail)

    graph.add_edge(START, "route_task")
    graph.add_conditional_edges(
        "route_task",
        _route_after_task,
        {
            "wizard": "wizard_worker",
            "opl-import": "opl_import_worker",
            "incremental": "incremental_change_worker",
            "refine": "refine_process_worker",
            "render": "render_worker",
        },
    )
    graph.add_edge("wizard_worker", "apply_ssot_guardrail")
    graph.add_edge("opl_import_worker", "apply_ssot_guardrail")
    graph.add_edge("incremental_change_worker", "apply_ssot_guardrail")
    graph.add_edge("refine_process_worker", "apply_ssot_guardrail")
    graph.add_edge("render_worker", "apply_ssot_guardrail")
    graph.add_edge("apply_ssot_guardrail", END)

    return graph.compile()


def run_modeling_task(envelope: ModelingTaskEnvelope) -> ModelingTaskResult:
    corpus = load_ssot_corpus()
    initial_state: OrchestratorState = {
        "task": envelope.task,
        "task_kind": envelope.task.kind,
        "trace": ["received-task"],
        "artifacts": [],
        "guardrail_checks": [],
        "guardrail_issues": [],
        "status": "needs-review",
        "metadata": {
            "session_id": envelope.session_id,
            "actor_id": envelope.actor_id,
        },
        "ssot_summary": build_ssot_summary(corpus),
    }

    app = build_modeling_graph()
    final_state = app.invoke(initial_state)

    return ModelingTaskResult(
        task_kind=envelope.task.kind,
        status=final_state["status"],
        artifacts=final_state.get("artifacts", []),
        guardrail=GuardrailReport(
            ok=not final_state.get("guardrail_issues"),
            checks=final_state.get("guardrail_checks", []),
            issues=final_state.get("guardrail_issues", []),
        ),
        trace=final_state.get("trace", []),
    )


def _route_after_task(state: OrchestratorState) -> str:
    return state["route"]
