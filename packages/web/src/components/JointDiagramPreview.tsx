import { useEffect, useRef } from "react";
import type { VisualRenderSpec } from "@opmodel/core";
import { createPaper, visualRenderSpecToJointGraph } from "../lib/renderers/jointjs";

interface JointDiagramPreviewProps {
  spec: VisualRenderSpec;
  height?: number | string;
}

export function JointDiagramPreview({ spec, height = 600 }: JointDiagramPreviewProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.innerHTML = "";

    const { graph } = visualRenderSpecToJointGraph(spec);
    const paper = createPaper({ el: host, graph, height });

    return () => {
      paper.remove();
      host.innerHTML = "";
    };
  }, [spec, height]);

  return (
    <div
      ref={hostRef}
      style={{
        width: "100%",
        height,
        border: "1px solid #e2e8f0",
        borderRadius: 6,
        overflow: "hidden",
        background: "#f8fafc",
      }}
    />
  );
}
