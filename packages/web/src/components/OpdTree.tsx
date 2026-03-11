import type { Model, OPD, Thing } from "@opmodel/core";

interface Props {
  model: Model;
  currentOpd: string;
  selectedThing: string | null;
  onSelectOpd: (id: string) => void;
  onSelectThing: (id: string | null) => void;
}

interface TreeNode {
  opd: OPD;
  children: TreeNode[];
}

function buildTree(model: Model): TreeNode[] {
  const roots: TreeNode[] = [];
  const nodeMap = new Map<string, TreeNode>();

  for (const opd of model.opds.values()) {
    nodeMap.set(opd.id, { opd, children: [] });
  }

  for (const node of nodeMap.values()) {
    if (node.opd.parent_opd === null) {
      roots.push(node);
    } else {
      const parent = nodeMap.get(node.opd.parent_opd);
      if (parent) parent.children.push(node);
    }
  }

  return roots;
}

function visibleThings(model: Model, opdId: string): Thing[] {
  const things: Thing[] = [];
  for (const app of model.appearances.values()) {
    if (app.opd === opdId) {
      const thing = model.things.get(app.thing);
      if (thing) things.push(thing);
    }
  }
  return things.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "object" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

function TreeNodeItem({
  node,
  depth,
  currentOpd,
  model,
  onSelectOpd,
}: {
  node: TreeNode;
  depth: number;
  currentOpd: string;
  model: Model;
  onSelectOpd: (id: string) => void;
}) {
  const isActive = node.opd.id === currentOpd;
  const hasChildren = node.children.length > 0;

  return (
    <>
      <div
        className={`opd-tree__node${isActive ? " opd-tree__node--active" : ""}${depth > 0 ? " opd-tree__node--child" : ""}`}
        style={{ paddingLeft: `${14 + depth * 18}px` }}
        onClick={() => onSelectOpd(node.opd.id)}
      >
        <span className="opd-tree__icon">{hasChildren ? "▾" : "◇"}</span>
        <div>
          <div className="opd-tree__label">{node.opd.name}</div>
          {node.opd.refines && (
            <div className="opd-tree__refines">
              {node.opd.refinement_type}: {model.things.get(node.opd.refines)?.name ?? node.opd.refines}
            </div>
          )}
        </div>
      </div>
      {node.children.map((child) => (
        <TreeNodeItem
          key={child.opd.id}
          node={child}
          depth={depth + 1}
          currentOpd={currentOpd}
          model={model}
          onSelectOpd={onSelectOpd}
        />
      ))}
    </>
  );
}

export function OpdTree({ model, currentOpd, selectedThing, onSelectOpd, onSelectThing }: Props) {
  const tree = buildTree(model);
  const things = visibleThings(model, currentOpd);

  return (
    <aside className="opd-tree">
      <div className="opd-tree__title">OPD Tree</div>
      {tree.map((node) => (
        <TreeNodeItem
          key={node.opd.id}
          node={node}
          depth={0}
          currentOpd={currentOpd}
          model={model}
          onSelectOpd={onSelectOpd}
        />
      ))}

      <div className="opd-tree__section">Things in View</div>
      {things.map((t) => (
        <div
          key={t.id}
          className={`opd-tree__thing${selectedThing === t.id ? " opd-tree__thing--selected" : ""}`}
          onClick={() => onSelectThing(selectedThing === t.id ? null : t.id)}
        >
          <div className={`opd-tree__thing-dot opd-tree__thing-dot--${t.kind}`} />
          <span>{t.name}</span>
        </div>
      ))}
    </aside>
  );
}
