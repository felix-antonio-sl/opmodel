/**
 * Style pack iso-19450 — decisiones de implementación para los gaps declarados
 * como no-normativos por opm-visual-es.md (V-63 y tabla §1.1b).
 *
 * Rellena los siguientes gaps SSOT (ver docs/opl-first/21-ssot-visual-mapping.md):
 * - Colores de formas y enlaces (V-63 informativos).
 * - Dimensiones de Object, Process, State (no normadas).
 * - Tipografía (no normada).
 * - Grosor de contorno normal / grueso-refinamiento / doble-borde de estado.
 * - Offset de sombra para esencia física (§1.3).
 * - Dimensiones de markers (punta, piruleta, triángulo).
 *
 * Constructos normados por SSOT se aplican con fidelidad:
 * - V-71: afiliación environmental → stroke-dasharray.
 * - V-1 / §1.3: esencia physical → drop-shadow.
 * - V-33 / V-69: refined (in-zoom / unfold en OPD nuevo) → stroke-width mayor.
 * - §2.2: estados initial → borde grueso; final → doble borde; default → flecha diagonal.
 * - §3.1: marker de punta cerrada en consumption/result/effect.
 * - §3.3: agent → piruleta negra; instrument → piruleta blanca.
 * - §9: invocation → línea en zigzag/rayo.
 * - §1.7: structural links con markers de triángulo.
 */

export interface IsoStyle {
  dimensions: {
    object: { width: number; height: number; cornerRadius: number };
    process: { width: number; height: number };
    state: { width: number; height: number; cornerRadius: number };
    stroke: {
      normal: number;
      refined: number;
      stateInitial: number;
      stateFinalInner: number;
      stateFinalOuter: number;
    };
  };
  typography: {
    family: string;
    thingFontSize: number;
    thingFontWeightNormal: number;
    thingFontWeightMain: number;
    linkFontSize: number;
    stateFontSize: number;
    markerFontSize: number;
  };
  palette: {
    thingFill: string;
    thingFillObject: string;
    thingFillProcess: string;
    thingFillProcessMain: string;
    thingStrokeObject: string;
    thingStrokeProcess: string;
    thingStrokeEnvironmental: string;
    labelText: string;
    paperBackground: string;
    gridDot: string;
    stateFill: string;
    stateStroke: string;
  };
  affiliation: {
    environmentalDash: string;
    systemicDash: string;
  };
  essence: {
    physicalShadowOffsetX: number;
    physicalShadowOffsetY: number;
    physicalShadowBlur: number;
    physicalShadowColor: string;
  };
  links: {
    strokeWidthPrimary: number;
    strokeWidthSecondary: number;
    arrowSize: number;
    lollipopRadius: number;
    triangleSize: number;
    byKind: Record<
      string,
      {
        stroke: string;
        dash?: string;
        marker:
          | "closed-triangle"
          | "lollipop-black"
          | "lollipop-white"
          | "lightning"
          | "triangle-filled"
          | "triangle-hollow"
          | "triangle-hollow-with-filled-inner"
          | "triangle-hollow-with-circle-inner"
          | "open-arrow"
          | "harpoon"
          | "none";
      }
    >;
  };
  markers: {
    eventLabel: string;
    conditionLabel: string;
    suppressionGlyph: string;
    defaultArrow: string;
    splitEntryGlyph: string;    // V-40: enlace de entrada al in-zoom
    splitExitGlyph: string;     // V-41: enlace de salida del in-zoom
    semiFoldIcon: string;       // §10.12: semi-plegado
    incompletePartsBar: string; // §1.8: partes ocultas
  };
}

export const isoStyle: IsoStyle = {
  dimensions: {
    object: { width: 160, height: 64, cornerRadius: 2 },
    process: { width: 160, height: 72 },
    state: { width: 76, height: 22, cornerRadius: 10 },
    stroke: {
      normal: 1.5,
      refined: 3,
      stateInitial: 2.5,
      stateFinalInner: 1.5,
      stateFinalOuter: 1.5,
    },
  },
  typography: {
    family: '"Inter", "Plus Jakarta Sans", system-ui, -apple-system, sans-serif',
    thingFontSize: 13,
    thingFontWeightNormal: 500,
    thingFontWeightMain: 700,
    linkFontSize: 10,
    stateFontSize: 10,
    markerFontSize: 11,
  },
  palette: {
    thingFill: "#ffffff",
    thingFillObject: "#eef3fb",
    thingFillProcess: "#e8f7ee",
    thingFillProcessMain: "#c7ecd3",
    thingStrokeObject: "#1e3a8a",
    thingStrokeProcess: "#0f5132",
    thingStrokeEnvironmental: "#64748b",
    labelText: "#0f172a",
    paperBackground: "#f8fafc",
    gridDot: "#e2e8f0",
    stateFill: "#f1f5f9",
    stateStroke: "#475569",
  },
  affiliation: {
    environmentalDash: "6 4",
    systemicDash: "0",
  },
  essence: {
    physicalShadowOffsetX: 2,
    physicalShadowOffsetY: 2,
    physicalShadowBlur: 0,
    physicalShadowColor: "rgba(15,23,42,0.25)",
  },
  links: {
    strokeWidthPrimary: 1.8,
    strokeWidthSecondary: 1.3,
    arrowSize: 9,
    lollipopRadius: 5,
    triangleSize: 10,
    byKind: {
      consumption: { stroke: "#b91c1c", marker: "closed-triangle" },
      result: { stroke: "#0f5132", marker: "closed-triangle" },
      effect: { stroke: "#7c3aed", marker: "closed-triangle" },
      agent: { stroke: "#0f172a", marker: "lollipop-black" },
      instrument: { stroke: "#0f172a", marker: "lollipop-white" },
      invocation: { stroke: "#ea580c", dash: "2 3", marker: "lightning" },
      exception: { stroke: "#b91c1c", dash: "4 3", marker: "closed-triangle" },
      aggregation: { stroke: "#334155", marker: "triangle-filled" },
      exhibition: { stroke: "#334155", marker: "triangle-hollow-with-filled-inner" },
      generalization: { stroke: "#334155", marker: "triangle-hollow" },
      classification: { stroke: "#334155", marker: "triangle-hollow-with-circle-inner" },
      tagged: { stroke: "#334155", marker: "open-arrow" },
      "tagged-bidirectional": { stroke: "#334155", marker: "harpoon" },
      input: { stroke: "#b91c1c", marker: "closed-triangle" },
      output: { stroke: "#0f5132", marker: "closed-triangle" },
    },
  },
  markers: {
    eventLabel: "e",
    conditionLabel: "c",
    suppressionGlyph: "…",
    defaultArrow: "↘",
    splitEntryGlyph: "⤵",
    splitExitGlyph: "⤴",
    semiFoldIcon: "⊞",
    incompletePartsBar: "┄",
  },
};
