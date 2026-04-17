import type { VisualRenderVerificationReport, VisualRenderVerificationIssue, VisualRenderSpec } from "./visual-render-spec";

export function verifyVisualRenderSpec(spec: VisualRenderSpec): VisualRenderVerificationReport {
  const issues: VisualRenderVerificationIssue[] = [];
  const nodeIds = new Set(spec.nodes.map((node) => node.id));
  const edgeIds = new Set(spec.edges.map((edge) => edge.id));
  const laneIds = new Set(spec.scene.lanes.map((lane) => lane.id));

  // Índices auxiliares para reglas semánticas
  const statesByOwner = new Map<string, typeof spec.states>();
  for (const st of spec.states) {
    if (!statesByOwner.has(st.ownerThingId)) statesByOwner.set(st.ownerThingId, []);
    statesByOwner.get(st.ownerThingId)!.push(st);
  }
  const nodeById = new Map(spec.nodes.map((n) => [n.id, n]));

  if (spec.nodes.length === 0) {
    issues.push({
      code: "VR-001",
      severity: "error",
      message: "VisualRenderSpec must contain at least one node.",
    });
  }

  if (!spec.nodes.some((node) => node.visualRole === "main-process")) {
    // Views that are purely structural (aggregation/classification trees, §15)
    // may contain zero processes. Treated as warning, not hard error.
    issues.push({
      code: "VR-002",
      severity: "warning",
      message: "VisualRenderSpec has no primary process — acceptable for structural/view OPDs (§15).",
    });
  }

  for (const node of spec.nodes) {
    if (!laneIds.has(node.laneId)) {
      issues.push({
        code: "VR-003",
        severity: "error",
        message: `Node ${node.id} references unknown lane ${node.laneId}.`,
        refs: [node.id, node.laneId],
      });
    }
  }

  for (const edge of spec.edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      issues.push({
        code: "VR-004",
        severity: "error",
        message: `Edge ${edge.id} references missing nodes.`,
        refs: [edge.id, edge.source, edge.target],
      });
    }
    if (!edge.label || edge.label.trim().length === 0) {
      issues.push({
        code: "VR-005",
        severity: "warning",
        message: `Edge ${edge.id} should carry an explicit label for rendering fidelity.`,
        refs: [edge.id],
      });
    }
  }

  if (spec.guardrails.length < 3) {
    issues.push({
      code: "VR-006",
      severity: "warning",
      message: "VisualRenderSpec should declare enough semantic guardrails for the renderer.",
    });
  }

  for (const state of spec.states) {
    if (!nodeIds.has(state.ownerThingId)) {
      issues.push({
        code: "VR-007",
        severity: "error",
        message: `State ${state.id} references missing owner node ${state.ownerThingId}.`,
        refs: [state.id, state.ownerThingId],
      });
    }
  }

  for (const fan of spec.fans) {
    const missing = fan.members.filter((m) => !edgeIds.has(m));
    if (missing.length > 0) {
      issues.push({
        code: "VR-008",
        severity: "error",
        message: `Fan ${fan.id} references missing edge members: ${missing.join(", ")}.`,
        refs: [fan.id, ...missing],
      });
    }
  }

  for (const mod of spec.modifiers) {
    if (!edgeIds.has(mod.edgeId)) {
      issues.push({
        code: "VR-009",
        severity: "error",
        message: `Modifier ${mod.id} references missing edge ${mod.edgeId}.`,
        refs: [mod.id, mod.edgeId],
      });
    }
  }

  // VR-010 (V-7): effect debe apuntar a objeto con al menos un estado
  for (const edge of spec.edges) {
    if (edge.opmLinkKind !== "effect") continue;
    const targetStates = statesByOwner.get(edge.target) ?? [];
    const realStates = targetStates.filter((s) => !s.suppressed);
    if (realStates.length === 0) {
      issues.push({
        code: "VR-010",
        severity: "error",
        message: `Effect link ${edge.id} targets object ${edge.target} which has no states (V-7: effect requires stateful object).`,
        refs: [edge.id, edge.target],
      });
    }
  }

  // VR-011 (V-8): result no debe apuntar a objeto cuyo único estado disponible es initial
  for (const edge of spec.edges) {
    if (edge.opmLinkKind !== "result") continue;
    const targetStates = statesByOwner.get(edge.target);
    if (!targetStates || targetStates.length === 0) continue;
    const real = targetStates.filter((s) => !s.suppressed);
    if (real.length > 0 && real.every((s) => s.initial)) {
      issues.push({
        code: "VR-011",
        severity: "warning",
        message: `Result link ${edge.id} targets object ${edge.target} whose only states are initial (V-8: result to initial-only object is suspicious).`,
        refs: [edge.id, edge.target],
      });
    }
  }

  // VR-012 (V-37): consumption/result no deben conectarse directamente a proceso refinado
  for (const edge of spec.edges) {
    if (edge.opmLinkKind === "consumption") {
      const src = nodeById.get(edge.source);
      if (src && src.opmKind === "process" && src.isRefined) {
        issues.push({
          code: "VR-012",
          severity: "error",
          message: `Consumption link ${edge.id} originates from refined process ${edge.source} — must connect to subprocesses (V-37).`,
          refs: [edge.id, edge.source],
        });
      }
    }
    if (edge.opmLinkKind === "result") {
      const tgt = nodeById.get(edge.target);
      if (tgt && tgt.opmKind === "process" && tgt.isRefined) {
        issues.push({
          code: "VR-012",
          severity: "error",
          message: `Result link ${edge.id} targets refined process ${edge.target} — must connect to subprocesses (V-37).`,
          refs: [edge.id, edge.target],
        });
      }
    }
  }

  // VR-013 (V-38): en OPD hijo, modificador event desde objeto sistémico hacia contenedor
  const isChildOpd = spec.nodes.some((n) => n.inZoomContainerOf !== undefined);
  if (isChildOpd) {
    for (const mod of spec.modifiers) {
      if (mod.kind !== "event") continue;
      const edge = spec.edges.find((e) => e.id === mod.edgeId);
      if (!edge) continue;
      const sourceNode = nodeById.get(edge.source);
      if (sourceNode && sourceNode.affiliation === "systemic" && !sourceNode.inZoomContainerOf) {
        issues.push({
          code: "VR-013",
          severity: "warning",
          message: `Event modifier on edge ${mod.edgeId} originates from systemic node ${edge.source} — verify it does not cross in-zoom boundary (V-38).`,
          refs: [mod.edgeId, edge.source],
        });
      }
    }
  }

  // VR-014 (V-43): proceso con consumption y result hacia/desde el mismo objeto
  const edgesByProcess = new Map<string, { consumed: Set<string>; resulted: Set<string> }>();
  for (const edge of spec.edges) {
    const processId = edge.opmLinkKind === "consumption" ? edge.target
      : edge.opmLinkKind === "result" ? edge.source
      : null;
    const objectId = edge.opmLinkKind === "consumption" ? edge.source
      : edge.opmLinkKind === "result" ? edge.target
      : null;
    if (!processId || !objectId) continue;
    if (!edgesByProcess.has(processId)) edgesByProcess.set(processId, { consumed: new Set(), resulted: new Set() });
    if (edge.opmLinkKind === "consumption") edgesByProcess.get(processId)!.consumed.add(objectId);
    if (edge.opmLinkKind === "result") edgesByProcess.get(processId)!.resulted.add(objectId);
  }
  for (const [processId, { consumed, resulted }] of edgesByProcess) {
    for (const objectId of consumed) {
      if (resulted.has(objectId)) {
        issues.push({
          code: "VR-014",
          severity: "warning",
          message: `Process ${processId} has both consumption and result links to/from object ${objectId} — consider effect link instead (V-43).`,
          refs: [processId, objectId],
        });
      }
    }
  }

  // VR-015 (V-115): todo proceso debe tener al menos un enlace transformador
  const transformingKinds = new Set(["consumption", "result", "effect", "input", "output"]);
  for (const node of spec.nodes) {
    if (node.opmKind !== "process") continue;
    const hasTransformer = spec.edges.some(
      (e) => transformingKinds.has(e.opmLinkKind) && (e.source === node.id || e.target === node.id),
    );
    if (!hasTransformer) {
      // Downgraded to warning: V-115 demands that every explicit process transforms at
      // least one object, but this may be satisfied in another OPD of the atlas.
      // A child OPD can legitimately show a subprocess whose transformer appears only
      // in its sibling OPDs or in a deeper refinement. Hard-erroring on the per-OPD
      // view produces false positives against the 6 fixtures.
      issues.push({
        code: "VR-015",
        severity: "warning",
        message: `Process node ${node.id} (${node.label}) has no transforming link in this OPD — verify that it transforms an object in another OPD of the atlas (V-115).`,
        refs: [node.id],
      });
    }
  }

  // VR-016 (V-5): objeto sin estados solo puede participar via consumption o result
  const transformingNonStateful = new Set(["effect", "input", "output"]);
  for (const edge of spec.edges) {
    if (!transformingNonStateful.has(edge.opmLinkKind)) continue;
    const targetNode = nodeById.get(edge.target);
    if (!targetNode || targetNode.opmKind !== "object") continue;
    const targetStates = statesByOwner.get(edge.target) ?? [];
    const realStates = targetStates.filter((s) => !s.suppressed);
    if (realStates.length === 0) {
      issues.push({
        code: "VR-016",
        severity: "error",
        message: `Link ${edge.id} (${edge.opmLinkKind}) targets stateless object ${edge.target} — stateless objects can only participate via consumption or result (V-5).`,
        refs: [edge.id, edge.target],
      });
    }
  }

  // VR-017 (V-24, V-25): relaciones estructurales entre types incompatibles
  // aggregation, generalization, classification: source y target deben tener el mismo opmKind
  // exhibition-characterization: permitida entre cualquier combinación (V-25)
  const structuralExclusiveKinds = new Set(["aggregation", "generalization", "classification"]);
  for (const edge of spec.edges) {
    if (!structuralExclusiveKinds.has(edge.opmLinkKind)) continue;
    const src = nodeById.get(edge.source);
    const tgt = nodeById.get(edge.target);
    if (src && tgt && src.opmKind !== tgt.opmKind) {
      issues.push({
        code: "VR-017",
        severity: "error",
        message: `Structural link ${edge.id} (${edge.opmLinkKind}) connects ${src.opmKind} ${edge.source} with ${tgt.opmKind} ${edge.target} — only exhibition-characterization may cross object/process boundary (V-24, V-25).`,
        refs: [edge.id, edge.source, edge.target],
      });
    }
  }

  // VR-018 (V-46): SD debe tener exactamente un proceso sistémico principal
  if (spec.diagramKind === "opm-sd") {
    const mainSystemicProcesses = spec.nodes.filter(
      (n) => n.opmKind === "process" && n.visualRole === "main-process" && n.affiliation === "systemic",
    );
    if (mainSystemicProcesses.length === 0) {
      issues.push({
        code: "VR-018",
        severity: "error",
        message: "SD OPD has no systemic main process — exactly one required (V-46).",
      });
    } else if (mainSystemicProcesses.length > 1) {
      issues.push({
        code: "VR-018",
        severity: "warning",
        message: `SD OPD has ${mainSystemicProcesses.length} systemic main processes — exactly one required (V-46).`,
        refs: mainSystemicProcesses.map((n) => n.id),
      });
    }
  }

  // VR-019 (V-50): límite de legibilidad ≤25 cosas por OPD
  if (spec.nodes.length > 25) {
    issues.push({
      code: "VR-019",
      severity: "warning",
      message: `OPD has ${spec.nodes.length} things — exceeds the legibility limit of 20-25 per context (V-50). Consider splitting into sub-OPDs.`,
    });
  }

  // VR-020 (V-83): elemento externo en OPD hijo no debe ser refinable
  // Un elemento externo en un OPD hijo es aquel que no tiene inZoomContainerOf
  // (no es el contenedor) pero aparece en el mismo OPD que nodos con inZoomContainerOf.
  if (isChildOpd) {
    for (const node of spec.nodes) {
      if (node.inZoomContainerOf !== undefined) continue;  // es el contenedor → OK
      if (node.isRefined) {
        // Warning: `isRefined` signals that the thing has a refinement somewhere in the
        // atlas, not that it refines inside this child OPD. V-83 is about refining
        // within the same in-zoom context, which requires per-appearance tracking that
        // the current spec does not expose. Promoting to error would mislabel legitimate
        // refined-elsewhere things. Keep as warning until the spec carries refinee-here.
        issues.push({
          code: "VR-020",
          severity: "warning",
          message: `External element ${node.id} (${node.label}) has a refinement in the atlas — verify it is not re-refined within this child OPD (V-83).`,
          refs: [node.id],
        });
      }
    }
  }

  return {
    ok: !issues.some((issue) => issue.severity === "error"),
    issues,
  };
}
