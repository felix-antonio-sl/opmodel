import { useState } from "react";
import type { Model } from "@opmodel/core";
import type { Command } from "../lib/commands";
import { OplSentencesView } from "./OplSentencesView";
import { OplTextView } from "./OplTextView";
import { OplLiveEditor } from "./OplLiveEditor";

type OplTab = "edit" | "text" | "sentences";

interface Props {
  model: Model;
  opdId: string;
  selectedThing: string | null;
  selectedLink: string | null;
  dispatch: (cmd: Command) => boolean;
}

export function OplPanel({ model, opdId, selectedThing, selectedLink, dispatch }: Props) {
  const [activeTab, setActiveTab] = useState<OplTab>("edit");
  const opd = model.opds.get(opdId);
  const currentLang = model.settings.opl_language === "es" ? "es" : "en";

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
        <OplSentencesView model={model} opdId={opdId} selectedThing={selectedThing}
          onSelectThing={(id) => id && dispatch({ tag: "selectThing", thingId: id })} />
      )}
    </aside>
  );
}
