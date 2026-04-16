import { useEffect, useRef } from "react";
import type { VisualRenderSpec } from "@opmodel/core";
import { createPaper, visualRenderSpecToJointGraph } from "../lib/renderers/jointjs";

interface JointDiagramPreviewProps {
  spec: VisualRenderSpec;
  height?: number;
  width?: number;
}

export function JointDiagramPreview({ spec, height = 640, width = 1100 }: JointDiagramPreviewProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    // JointJS v4 paper.remove() destroys the element it was mounted on. We mount
    // it on a disposable inner div so the React-managed ref div survives cleanup.
    const inner = document.createElement("div");
    inner.style.width = "100%";
    inner.style.height = "100%";
    host.appendChild(inner);

    const { graph } = visualRenderSpecToJointGraph(spec);
    const paper = createPaper({ el: inner, graph, width, height });

    try {
      paper.scaleContentToFit({ padding: 20, minScale: 0.2, maxScale: 1.5 });
    } catch {
      // scaleContentToFit fails on empty graphs; harmless.
    }

    return () => {
      paper.remove();
      if (inner.parentNode === host) host.removeChild(inner);
    };
  }, [spec, height, width]);

  return (
    <div
      ref={hostRef}
      style={{
        width,
        height,
        border: "1px solid #e2e8f0",
        borderRadius: 6,
        overflow: "hidden",
        background: "#f8fafc",
      }}
    />
  );
}
