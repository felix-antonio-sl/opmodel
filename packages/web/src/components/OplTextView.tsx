import { useState } from "react";
import type { Model } from "@opmodel/core";
import { expose, render } from "@opmodel/core";

interface Props {
  model: Model;
  opdId: string;
}

export function OplTextView({ model, opdId }: Props) {
  const [copied, setCopied] = useState(false);
  const doc = expose(model, opdId);
  const text = render(doc);

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="opl-panel__content">
      <div className="opl-text__header">
        <button className={`opl-text__copy${copied ? " opl-text__copy--copied" : ""}`} onClick={handleCopy}>
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre className="opl-text__pre">{text}</pre>
    </div>
  );
}
