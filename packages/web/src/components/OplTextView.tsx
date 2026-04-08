import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import type { Model } from "@opmodel/core";
import { semanticKernelFromModel, exposeSemanticKernel, exposeFromKernel, render, renderAllFromKernelNative } from "@opmodel/core";
import type { Command } from "../lib/commands";
import { findFirstLinkIdByPathLabels, findLinkIdByNames, findOpdIdByName, findSentenceAtLine, findSentenceForSelection, findThingIdByName, findThingOrLinkTarget, parseSentenceRefs } from "../lib/opl-navigation";

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
  const sentenceRefs = useMemo(() => parseSentenceRefs(text, doc.opdName), [text, doc.opdName]);
  const activeSentenceRef = useMemo(
    () => findSentenceForSelection(sentenceRefs, model, highlightThingId ?? null, highlightLinkId ?? null, opdId),
    [sentenceRefs, model, highlightThingId, highlightLinkId, opdId],
  );

  const highlightNames = useCallback((): string[] => {
    const names = new Set<string>();
    if (highlightThingId) {
      const thing = model.things.get(highlightThingId);
      if (thing) {
        names.add(thing.name);
        const exhibitors = [...model.links.values()].filter(
          (l) => l.type === "exhibition" && (l.target === highlightThingId || l.source === highlightThingId),
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

  const lineState = (line: string, lineNumber: number): "active" | "related" | "plain" => {
    if (activeSentenceRef && lineNumber >= activeSentenceRef.span.line && lineNumber <= activeSentenceRef.span.endLine) {
      return "active";
    }
    if (hlNames.length > 0 && hlNames.some((name) => line.includes(name))) {
      return "related";
    }
    return "plain";
  };

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
          const state = lineState(line, i + 1);
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
