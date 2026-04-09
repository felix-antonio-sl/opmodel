interface Props {
  items: string[];
  activeIndex: number;
  position: { top: number; left: number };
  onSelect: (name: string) => void;
}

export function OplAutocomplete({ items, activeIndex, position, onSelect }: Props) {
  return (
    <div className="opl-autocomplete" style={{ position: "fixed", top: position.top, left: position.left }}>
      {items.map((item, i) => (
        <div
          key={item}
          className={`opl-autocomplete__item${i === activeIndex ? " opl-autocomplete__item--active" : ""}`}
          onMouseDown={(e) => { e.preventDefault(); onSelect(item); }}
        >
          {item}
        </div>
      ))}
    </div>
  );
}
