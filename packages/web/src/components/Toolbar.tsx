import type { EditorMode, Command } from "../lib/commands";

interface Props {
  mode: EditorMode;
  dispatch: (cmd: Command) => void;
}

export function Toolbar({ mode, dispatch }: Props) {
  const btn = (m: EditorMode, label: string, title: string) => (
    <button
      className={`toolbar__btn${mode === m ? " toolbar__btn--active" : ""}`}
      onClick={() => dispatch({ tag: "setMode", mode: mode === m ? "select" : m })}
      title={title}
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
      </div>
      {mode !== "select" && (
        <div className="toolbar__hint">
          {mode === "addLink" ? "Click source thing, then target" : "Click on canvas to place"}
          <button
            className="toolbar__cancel"
            onClick={() => dispatch({ tag: "setMode", mode: "select" })}
          >
            Esc to cancel
          </button>
        </div>
      )}
    </div>
  );
}
