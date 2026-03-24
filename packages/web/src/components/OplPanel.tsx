import { useState } from "react";
import type { Model } from "@opmodel/core";
import type { NlPipeline } from "@opmodel/nl";
import type { Command } from "../lib/commands";
import { OplSentencesView } from "./OplSentencesView";
import { OplTextView } from "./OplTextView";
import { OplEditorView } from "./OplEditorView";

type OplTab = "sentences" | "text" | "editor";

interface Props {
  model: Model;
  opdId: string;
  selectedThing: string | null;
  dispatch: (cmd: Command) => boolean;
  nlPipeline?: NlPipeline;
  lastError?: string | null;
}

export function OplPanel({ model, opdId, selectedThing, dispatch, nlPipeline, lastError }: Props) {
  const [activeTab, setActiveTab] = useState<OplTab>("sentences");
  const opd = model.opds.get(opdId);
  const currentLang = model.settings.opl_language === "es" ? "es" : "en";

  return (
    <aside className="opl-panel">
      <div className="opl-panel__title">
        <span>OPL — {opd?.name ?? opdId}</span>
        <button
          className="opl-lang-toggle"
          onClick={() => dispatch({ tag: "updateSettings", patch: { opl_language: currentLang === "en" ? "es" : "en" } })}
          title={currentLang === "en" ? "Switch to Spanish OPL" : "Switch to English OPL"}
        >
          {currentLang.toUpperCase()}
        </button>
      </div>
      <div className="opl-tabs">
        {(["sentences", "text", "editor"] as const).map((tab) => (
          <button
            key={tab}
            className={`opl-tab${activeTab === tab ? " opl-tab--active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === "sentences" ? "Sentences" : tab === "text" ? "Text" : "Editor"}
          </button>
        ))}
      </div>
      {activeTab === "sentences" && (
        <OplSentencesView model={model} opdId={opdId} selectedThing={selectedThing} />
      )}
      {activeTab === "text" && (
        <OplTextView model={model} opdId={opdId} />
      )}
      {activeTab === "editor" && (
        <OplEditorView model={model} opdId={opdId} dispatch={dispatch} nlPipeline={nlPipeline} lastError={lastError} />
      )}
    </aside>
  );
}
