import { useEffect, useRef, useState } from "react";
import type { Model } from "@opmodel/core";
import type { Command } from "../lib/commands";
import { OplSentencesView } from "./OplSentencesView";
import { OplTextView } from "./OplTextView";
import { OplLiveEditor } from "./OplLiveEditor";

type OplTab = "edit" | "text" | "sentences";

type FocusEntry = { key: string; label: string; cmd: Command; kind: "thing" | "link" };

interface Props {
  model: Model;
  opdId: string;
  selectedThing: string | null;
  selectedLink: string | null;
  dispatch: (cmd: Command) => boolean;
}

export function OplPanel({ model, opdId, selectedThing, selectedLink, dispatch }: Props) {
  const [activeTab, setActiveTab] = useState<OplTab>("edit");
  const [focusTrail, setFocusTrail] = useState<FocusEntry[]>([]);
  const opd = model.opds.get(opdId);
  const currentLang = model.settings.opl_language === "es" ? "es" : "en";
  const previousSelectionRef = useRef<string>("");

  useEffect(() => {
    const currentSelection = `${selectedThing ?? ""}|${selectedLink ?? ""}`;
    if (previousSelectionRef.current && currentSelection !== previousSelectionRef.current && (selectedThing || selectedLink)) {
      setActiveTab("edit");
    }
    previousSelectionRef.current = currentSelection;
  }, [selectedThing, selectedLink]);

  useEffect(() => {
    let entry: FocusEntry | null = null;
    if (selectedThing) {
      const thing = model.things.get(selectedThing);
      if (thing) {
        entry = {
          key: `thing:${thing.id}`,
          label: thing.name,
          cmd: { tag: "selectThing", thingId: thing.id },
          kind: "thing",
        };
      }
    } else if (selectedLink) {
      const link = model.links.get(selectedLink);
      if (link) {
        const src = model.things.get(link.source)?.name ?? link.source;
        const tgt = model.things.get(link.target)?.name ?? link.target;
        entry = {
          key: `link:${link.id}`,
          label: `${src} → ${tgt}`,
          cmd: { tag: "selectLink", linkId: link.id },
          kind: "link",
        };
      }
    }
    if (!entry) return;
    setFocusTrail((current) => [entry!, ...current.filter((item) => item.key !== entry!.key)].slice(0, 6));
  }, [model, selectedThing, selectedLink]);

  const handleStructuredSelect = (cmd: Command) => {
    dispatch(cmd);
    setActiveTab("edit");
  };

  const handleTrailSelect = (cmd: Command) => {
    dispatch(cmd);
    setActiveTab("edit");
  };

  return (
    <aside className="opl-panel">
      <div className="opl-panel__title">
        <span>OPL Workspace — {opd?.name ?? opdId}</span>
        <button
          className="opl-lang-toggle"
          onClick={() => dispatch({ tag: "updateSettings", patch: { opl_language: currentLang === "en" ? "es" : "en" } })}
          title={currentLang === "en" ? "Switch to Spanish OPL" : "Switch to English OPL"}
        >
          {currentLang.toUpperCase()}
        </button>
      </div>
      <div className="opl-tabs">
        {(["edit", "text", "sentences"] as const).map((tab) => (
          <button
            key={tab}
            className={`opl-tab${activeTab === tab ? " opl-tab--active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === "edit" ? "Author" : tab === "text" ? "Read" : "Structured"}
          </button>
        ))}
      </div>
      <div className="opl-panel__subtitle" style={{ padding: "0 12px 8px", fontSize: 12, color: "var(--text-muted)" }}>
        {activeTab === "edit"
          ? "Author OPL directly, then apply back to the model."
          : activeTab === "text"
            ? "Inspect the current canonical OPL for this OPD."
            : "Browse generated OPL sentences by entity."}
      </div>
      {focusTrail.length > 0 && (
        <div className="opl-focus-trail">
          <div className="opl-focus-trail__label">Recent focus</div>
          <div className="opl-focus-trail__items">
            {focusTrail.map((entry) => (
              <button
                key={entry.key}
                type="button"
                className={`opl-focus-trail__item opl-focus-trail__item--${entry.kind}`}
                onClick={() => handleTrailSelect(entry.cmd)}
                title={entry.label}
              >
                {entry.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {activeTab === "edit" && (
        <OplLiveEditor
          model={model}
          opdId={opdId}
          selectedThing={selectedThing}
          selectedLink={selectedLink}
          dispatch={dispatch}
        />
      )}
      {activeTab === "text" && (
        <OplTextView
          model={model}
          opdId={opdId}
          highlightThingId={selectedThing ?? undefined}
          highlightLinkId={selectedLink ?? undefined}
          dispatch={dispatch}
        />
      )}
      {activeTab === "sentences" && (
        <OplSentencesView
          model={model}
          opdId={opdId}
          selectedThing={selectedThing}
          selectedLink={selectedLink}
          onSelectEntity={handleStructuredSelect}
        />
      )}
    </aside>
  );
}
