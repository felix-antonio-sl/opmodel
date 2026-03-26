import { useRef, useEffect } from "react";

/* ─── Inline Rename Input ─── */

export function InlineRename({
  x,
  y,
  width,
  currentName,
  onCommit,
  onCancel,
}: {
  x: number;
  y: number;
  width: number;
  currentName: string;
  onCommit: (name: string) => void;
  onCancel: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = inputRef.current;
    if (el) {
      el.focus();
      el.select();
    }
  }, []);

  return (
    <foreignObject x={x} y={y} width={width} height={26}>
      <input
        ref={inputRef}
        className="inline-rename"
        defaultValue={currentName}
        onBlur={(e) => {
          const val = e.target.value.trim();
          if (val && val !== currentName) onCommit(val);
          else onCancel();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            const val = (e.target as HTMLInputElement).value.trim();
            if (val && val !== currentName) onCommit(val);
            else onCancel();
          }
          if (e.key === "Escape") onCancel();
        }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      />
    </foreignObject>
  );
}
