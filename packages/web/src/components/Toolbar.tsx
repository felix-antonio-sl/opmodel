import type { EditorMode, Command, LinkTypeChoice } from "../lib/commands";

const LINK_TYPES: { value: LinkTypeChoice; label: string; group: string }[] = [
  { value: "auto", label: "Auto-detect", group: "" },
  { value: "agent", label: "Agent", group: "Enabling" },
  { value: "instrument", label: "Instrument", group: "Enabling" },
  { value: "effect", label: "Effect", group: "Transforming" },
  { value: "result", label: "Result", group: "Transforming" },
  { value: "consumption", label: "Consumption", group: "Transforming" },
  { value: "input", label: "Input", group: "Transforming" },
  { value: "output", label: "Output", group: "Transforming" },
  { value: "aggregation", label: "Aggregation", group: "Structural" },
  { value: "exhibition", label: "Exhibition", group: "Structural" },
  { value: "generalization", label: "Generalization", group: "Structural" },
  { value: "classification", label: "Classification", group: "Structural" },
  { value: "invocation", label: "Invocation", group: "Control" },
  { value: "exception", label: "Exception", group: "Control" },
  { value: "tagged", label: "Tagged", group: "Ad-hoc" },
];

interface Props {
  mode: EditorMode;
  linkType: LinkTypeChoice;
  dispatch: (cmd: Command) => boolean;
}

export function Toolbar({ mode, linkType, dispatch }: Props) {
  const btn = (m: EditorMode, label: string, title: string) => (
    <button
      className={`toolbar__btn${mode === m ? " toolbar__btn--active" : ""}`}
      onClick={() => dispatch({ tag: "setMode", mode: mode === m ? "select" : m })}
      title={title}
      aria-label={title}
      aria-pressed={mode === m}
    >
      {label}
    </button>
  );

  return (
    <div className="toolbar">
      <div className="toolbar__group">
        {btn("addObject", "▭ Object", "Add Object (O)")}
        {btn("addProcess", "⬭ Process", "Add Process (P)")}
      </div>
      <div className="toolbar__sep" />
      <div className="toolbar__group">
        {btn("addLink", "↗ Link", "Add Link (L)")}
        {mode === "addLink" && (
          <select
            className="toolbar__link-select"
            value={linkType}
            aria-label="Link type selector"
            onChange={(e) => dispatch({ tag: "setLinkType", linkType: e.target.value as LinkTypeChoice })}
          >
            {LINK_TYPES.map((lt) => (
              <option key={lt.value} value={lt.value}>
                {lt.value === "auto" ? "Auto" : `${lt.label} (${lt.group})`}
              </option>
            ))}
          </select>
        )}
      </div>
      {mode !== "select" && (
        <div className="toolbar__hint">
          {mode === "addLink" ? "Click source, then target" : "Click on canvas to place"}
          <button
            className="toolbar__cancel"
            onClick={() => dispatch({ tag: "setMode", mode: "select" })}
          >
            Esc
          </button>
        </div>
      )}
    </div>
  );
}
