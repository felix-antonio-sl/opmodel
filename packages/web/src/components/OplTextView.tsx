import { useState, useRef, useEffect, useCallback } from "react";
import type { Model } from "@opmodel/core";
import { semanticKernelFromModel, exposeSemanticKernel, exposeFromKernel, render, renderAllFromKernelNative } from "@opmodel/core";

interface Props {
  model: Model;
  opdId: string;
  highlightThingId?: string;
  highlightLinkId?: string;
  onSelectThing?: (thingId: string) => void;
}

export function OplTextView({ model, opdId, highlightThingId, highlightLinkId, onSelectThing }: Props) {
  const [copied, setCopied] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const kernel = semanticKernelFromModel(model);
  const atlas = exposeSemanticKernel(kernel);
  const doc = exposeFromKernel(kernel, atlas, opdId);
  const text = showAll ? renderAllFromKernelNative(kernel, atlas) : render(doc);
  const lines = text.split("\n");

  // Build highlight names
  const highlightNames = useCallback((): string[] => {
    const names = new Set<string>();
    if (highlightThingId) {
      const thing = model.things.get(highlightThingId);
      if (thing) {
        names.add(thing.name);
        // Also add compound display names
        const exhibitors = [...model.links.values()].filter(
          l => l.type === "exhibition" && (l.target === highlightThingId || l.source === highlightThingId)
        );
        for (const ex of exhibitors) {
          const otherId = ex.source === highlightThingId ? ex.target : ex.source;
          const other = model.things.get(otherId);
          if (other) {
            names.add(`${thing.name} of ${other.name}`);
            names.add(`${thing.name} de ${other.name}`);
          }
        }
      }
    }
    if (highlightLinkId) {
      const link = model.links.get(highlightLinkId);
      if (link) {
        const src = model.things.get(link.source);
        const tgt = model.things.get(link.target);
        if (src) names.add(src.name);
        if (tgt) names.add(tgt.name);
      }
    }
    return [...names];
  }, [model, highlightThingId, highlightLinkId]);

  const hlNames = highlightNames();

  const isHighlighted = (line: string): boolean => {
    if (hlNames.length === 0) return false;
    return hlNames.some(name => line.includes(name));
  };

  // Auto-scroll to first highlighted line
  useEffect(() => {
    if (hlNames.length > 0 && containerRef.current) {
      const first = containerRef.current.querySelector(".opl-text__line--highlight");
      if (first) first.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightThingId, highlightLinkId]);

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      console.warn("Clipboard write failed");
    });
  };

  const handleLineClick = (line: string) => {
    if (!onSelectThing) return;
    // Match thing declaration lines: "X is an object" or "X is a process"
    const declMatch = line.match(/^(.+?)\s+is\s+(?:an?\s+)?(?:object|process)/i);
    if (declMatch) {
      const name = declMatch[1]!.trim();
      // Find thing by name
      for (const [id, thing] of model.things) {
        if (thing.name === name) {
          onSelectThing(id);
          return;
        }
      }
    }
    // Match state enumeration: "X can be ..."
    const stateMatch = line.match(/^(.+?)\s+(?:can be|puede estar)/i);
    if (stateMatch) {
      const name = stateMatch[1]!.trim();
      for (const [id, thing] of model.things) {
        if (thing.name === name) {
          onSelectThing(id);
          return;
        }
      }
    }
    // Generic: find any thing name in the line
    for (const [id, thing] of model.things) {
      if (line.includes(thing.name)) {
        onSelectThing(id);
        return;
      }
    }
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
      <div ref={containerRef} className="opl-text__lines">
        {lines.map((line, i) => {
          const highlighted = isHighlighted(line);
          return (
            <div
              key={i}
              className={`opl-text__line${highlighted ? " opl-text__line--highlight" : ""}`}
              onClick={() => handleLineClick(line)}
              style={highlighted ? {
                background: "rgba(88, 166, 255, 0.12)",
                borderLeft: "3px solid rgba(88, 166, 255, 0.6)",
                paddingLeft: 9,
                cursor: onSelectThing ? "pointer" : "default",
              } : {
                borderLeft: "3px solid transparent",
                paddingLeft: 9,
                cursor: onSelectThing ? "pointer" : "default",
              }}
            >
              {line}
            </div>
          );
        })}
      </div>
    </div>
  );
}
