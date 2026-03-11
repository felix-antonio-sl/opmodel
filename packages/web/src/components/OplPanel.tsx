import type { Model } from "@opmodel/core";
import { generateOpl, type OplBlock } from "../lib/opl";

interface Props {
  model: Model;
  opdId: string;
  selectedThing: string | null;
}

function blockClass(block: OplBlock, selectedThing: string | null): string {
  const base = `opl-sentence opl-sentence--${block.category}`;
  if (selectedThing && block.entityId === selectedThing) {
    return `${base} opl-sentence--highlighted`;
  }
  return base;
}

export function OplPanel({ model, opdId, selectedThing }: Props) {
  const blocks = generateOpl(model, opdId);

  // Group: things+states first, then divider, then links+modifiers
  const thingBlocks = blocks.filter((b) => b.category === "thing" || b.category === "state");
  const linkBlocks = blocks.filter((b) => b.category === "link" || b.category === "modifier");

  const opd = model.opds.get(opdId);

  return (
    <aside className="opl-panel">
      <div className="opl-panel__title">
        OPL — {opd?.name ?? opdId}
      </div>
      <div className="opl-panel__content">
        {thingBlocks.map((block, i) => (
          <div key={`t-${i}`} className={blockClass(block, selectedThing)}>
            {block.text}
          </div>
        ))}
        {thingBlocks.length > 0 && linkBlocks.length > 0 && <div className="opl-divider" />}
        {linkBlocks.map((block, i) => (
          <div key={`l-${i}`} className={blockClass(block, selectedThing)}>
            {block.text}
          </div>
        ))}
      </div>
    </aside>
  );
}
