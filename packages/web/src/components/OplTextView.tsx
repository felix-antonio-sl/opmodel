import { useState, useRef, useEffect } from "react";
import type { Model } from "@opmodel/core";
import { semanticKernelFromModel, exposeSemanticKernel, exposeFromKernel, render, renderAllFromKernelNative } from "@opmodel/core";
import type { Command } from "../lib/commands";
import { findFirstLinkIdByPathLabels, findLinkIdByNames, findOpdIdByName, findSentenceAtLine, findThingIdByName, findThingOrLinkTarget, getLineState } from "../lib/opl-navigation";
import { useOplContext } from "../hooks/useOplContext";

interface Props {
  model: Model;
  opdId: string;
  highlightThingId?: string;
  highlightLinkId?: string;
  dispatch: (cmd: Command) => boolean;
}

export function OplTextView({ model, opdId, highlightThingId, highlightLinkId, dispatch }: Props) {
  const [copied, setCopied] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const kernel = semanticKernelFromModel(model);
  const atlas = exposeSemanticKernel(kernel);
  const doc = exposeFromKernel(kernel, atlas, opdId);
  const text = showAll ? renderAllFromKernelNative(kernel, atlas) : render(doc);
  const lines = text.split("\n");
  const { sentenceRefs, activeSentenceRef, relatedHighlightNames } = useOplContext({
    model,
    opdId,
    text,
    selectedThing: highlightThingId,
    selectedLink: highlightLinkId,
    fallbackOpdName: doc.opdName,
  });

  useEffect(() => {
    if (containerRef.current) {
      const first = containerRef.current.querySelector(".opl-text__line--active, .opl-text__line--highlight");
      if (first) first.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeSentenceRef, highlightThingId, highlightLinkId]);

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      console.warn("Clipboard write failed");
    });
  };

  const handleLineClick = (lineIndex: number) => {
    const ref = findSentenceAtLine(sentenceRefs, lineIndex + 1);
    if (!ref) return;

    const targetOpdId = findOpdIdByName(model, ref.doc.opdName);
    if (targetOpdId && targetOpdId !== opdId) dispatch({ tag: "selectOpd", opdId: targetOpdId });

    switch (ref.sentence.kind) {
      case "thing-declaration":
        dispatch({ tag: "selectThing", thingId: findThingIdByName(model, ref.sentence.name) });
        return;
      case "state-enumeration":
      case "state-description":
      case "duration":
        dispatch({ tag: "selectThing", thingId: findThingIdByName(model, ref.sentence.thingName) });
        return;
      case "attribute-value":
        dispatch({ tag: "selectThing", thingId: findThingIdByName(model, ref.sentence.thingName) });
        return;
      case "link": {
        const linkId = findLinkIdByNames(model, ref.sentence.sourceName, ref.sentence.targetName);
        if (linkId) dispatch({ tag: "selectLink", linkId });
        else dispatch({ tag: "selectThing", thingId: findThingIdByName(model, ref.sentence.sourceName) });
        return;
      }
      case "modifier": {
        const linkId = findLinkIdByNames(model, ref.sentence.sourceName, ref.sentence.targetName);
        if (linkId) dispatch({ tag: "selectLink", linkId });
        else dispatch({ tag: "selectThing", thingId: findThingIdByName(model, ref.sentence.sourceName) });
        return;
      }
      case "grouped-structural":
      case "in-zoom-sequence":
        dispatch({ tag: "selectThing", thingId: findThingIdByName(model, ref.sentence.parentName) });
        return;
      case "fan":
        dispatch({ tag: "selectThing", thingId: findThingIdByName(model, ref.sentence.sharedEndpointName) });
        return;
      case "requirement":
      case "assertion": {
        const target = findThingOrLinkTarget(model, ref.sentence.targetName);
        if (target?.kind === "link") dispatch({ tag: "selectLink", linkId: target.id });
        else dispatch({ tag: "selectThing", thingId: target?.id ?? findThingIdByName(model, ref.sentence.targetName) });
        return;
      }
      case "scenario": {
        const linkId = findFirstLinkIdByPathLabels(model, ref.sentence.pathLabels);
        if (linkId) dispatch({ tag: "selectLink", linkId });
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
          const state = getLineState(line, i + 1, activeSentenceRef, relatedHighlightNames);
          const active = state === "active";
          const highlighted = state !== "plain";
          return (
            <div
              key={i}
              className={`opl-text__line${highlighted ? " opl-text__line--highlight" : ""}${active ? " opl-text__line--active" : ""}`}
              onClick={() => handleLineClick(i)}
              style={active ? {
                background: "rgba(124, 92, 255, 0.16)",
                borderLeft: "3px solid rgba(124, 92, 255, 0.85)",
                paddingLeft: 9,
                cursor: "pointer",
                fontWeight: 600,
              } : highlighted ? {
                background: "rgba(88, 166, 255, 0.12)",
                borderLeft: "3px solid rgba(88, 166, 255, 0.6)",
                paddingLeft: 9,
                cursor: "pointer",
              } : {
                borderLeft: "3px solid transparent",
                paddingLeft: 9,
                cursor: "pointer",
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
