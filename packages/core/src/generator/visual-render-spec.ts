export type VisualRendererStyle =
  | "flat-icon"
  | "dark-terminal"
  | "blueprint"
  | "notion-clean"
  | "glassmorphism";

export type VisualDiagramKind = "opm-sd" | "opm-sd1";

export type VisualLaneRole = "context" | "function" | "system" | "refinement";

export type VisualNodeRole =
  | "beneficiary"
  | "system"
  | "main-process"
  | "value-object"
  | "agent"
  | "instrument"
  | "input"
  | "output"
  | "environment"
  | "subprocess"
  | "internal-object"
  | "external-object";

export interface VisualRenderLane {
  id: string;
  label: string;
  role: VisualLaneRole;
}

export interface VisualRenderGroup {
  id: string;
  label: string;
  kind: "cluster" | "legend" | "context-box";
}

export interface VisualRenderNodeDuration {
  min?: number;
  expected?: number;
  max?: number;
  unit?: string;
  distribution?: string;
}

export interface VisualRenderNode {
  id: string;
  label: string;
  alias?: string;                // V-122: alias breve junto al nombre, e.g. "(tes)"
  opmKind: "object" | "process";
  visualRole: VisualNodeRole;
  affiliation: "systemic" | "environmental";
  essence?: "physical" | "informational";
  laneId: string;
  groupId?: string;
  importance: 1 | 2 | 3;
  isRefined?: boolean;
  inZoomContainerOf?: string;
  hasIncompleteParts?: boolean;  // §1.8: partes ocultas → barra indicadora
  isSemiFolded?: boolean;        // §10.12: semi-plegado, íconos de partes inline
  duration?: VisualRenderNodeDuration;  // V-45: duración del proceso (min/expected/max)
}

export interface VisualRenderEdge {
  id: string;
  source: string;
  target: string;
  opmLinkKind: string;
  label?: string;
  semanticRole?: string;
  routingPriority: "primary" | "secondary";
  exceptionKind?: "overtime" | "undertime";
  multiplicitySource?: string;
  multiplicityTarget?: string;
  pathLabel?: string;
  probability?: number;
  tag?: string;
  tagReverse?: string;
  bidirectional?: boolean;       // §8.1 V-56: tagged bidireccional → arpones en ambos extremos
  isSplit?: boolean;             // V-40, V-41: enlace escindido en descomposición
  splitRole?: "entry" | "exit"; // V-40: entrada al in-zoom, V-41: salida
}

export interface VisualRenderState {
  id: string;
  ownerThingId: string;
  label: string;
  initial: boolean;
  final: boolean;
  default: boolean;
  current?: boolean;
  suppressed?: boolean;  // V-86–V-90: estado oculto en este OPD, renderizar como "…"
}

export interface VisualRenderFan {
  id: string;
  operator: "xor" | "or" | "and";
  direction?: "converging" | "diverging";
  members: string[];
  incomplete?: boolean;
  memberMultiplicities?: Record<string, string>;
  isProbabilistic?: boolean;      // §5.8, V-18: fan probabilístico con anotaciones Pr=p
  hiddenRefinersCount?: number;   // V-118: cuántos refinadores permanecen ocultos en semi-plegado
}

export interface VisualRenderModifier {
  id: string;
  edgeId: string;
  kind: "event" | "condition";
  negated?: boolean;
  conditionMode?: "skip" | "wait";
}

export interface VisualRenderSpec {
  version: "v1";
  diagramKind: VisualDiagramKind;
  title: string;
  style: VisualRendererStyle;
  scene: {
    lanes: VisualRenderLane[];
    groups: VisualRenderGroup[];
  };
  nodes: VisualRenderNode[];
  edges: VisualRenderEdge[];
  states: VisualRenderState[];
  fans: VisualRenderFan[];
  modifiers: VisualRenderModifier[];
  guardrails: string[];
  canonicalOpl: string;
}

export interface VisualRenderVerificationIssue {
  code:
    | "VR-001"
    | "VR-002"
    | "VR-003"
    | "VR-004"
    | "VR-005"
    | "VR-006"
    | "VR-007"
    | "VR-008"
    | "VR-009"
    | "VR-010"  // V-7: effect sobre objeto sin estados
    | "VR-011"  // V-8: result a objeto con solo estados iniciales
    | "VR-012"  // V-37: consumo/resultado conectado a proceso refinado
    | "VR-013"  // V-38: evento sistémico cruza frontera in-zoom
    | "VR-014"  // V-43: proceso tiene consumption+result del mismo objeto (usar effect)
    | "VR-015"  // V-115: proceso sin ningún enlace transformador
    | "VR-016"  // V-5: objeto sin estados conectado por enlace distinto de consumption/result
    | "VR-017"  // V-24/V-25: relación estructural entre tipos incompatibles de thing
    | "VR-018"  // V-46: SD debe tener exactamente un proceso sistémico principal
    | "VR-019"  // V-50: OPD supera límite de legibilidad (>25 cosas)
    | "VR-020"; // V-83: elemento externo en OPD hijo marcado como refinable
  severity: "error" | "warning";
  message: string;
  refs?: string[];
}

export interface VisualRenderVerificationReport {
  ok: boolean;
  issues: VisualRenderVerificationIssue[];
}
