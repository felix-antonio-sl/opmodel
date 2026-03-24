import { useState } from "react";
import type { Model } from "@opmodel/core";
import { expose, render, renderAll } from "@opmodel/core";

interface Props {
  model: Model;
  opdId: string;
}

export function OplTextView({ model, opdId }: Props) {
  const [copied, setCopied] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const doc = expose(model, opdId);
  const text = showAll ? renderAll(model) : render(doc);

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      console.warn("Clipboard write failed");
    });
  };

  return (
    <div className="opl-panel__content">
      <div className="opl-text__header">
        <button
          className={`opl-text__scope${showAll ? " opl-text__scope--active" : ""}`}
          onClick={() => setShowAll(!showAll)}
          title={showAll ? "Show current OPD only" : "Show all OPDs"}
        >
          {showAll ? "All" : "OPD"}
        </button>
        <button className={`opl-text__copy${copied ? " opl-text__copy--copied" : ""}`} onClick={handleCopy}>
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre className="opl-text__pre">{text}</pre>
    </div>
  );
}
