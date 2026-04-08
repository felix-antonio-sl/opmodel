import { useState } from "react";
import type { Model, OPD, Thing } from "@opmodel/core";

interface Props {
  model: Model;
  currentOpd: string;
  selectedThing: string | null;
  onSelectOpd: (id: string) => void;
  onSelectThing: (id: string | null) => void;
  onRenameOpd?: (opdId: string, name: string) => void;
  onCreateViewOpd?: () => void;
  onRemoveViewOpd?: (opdId: string) => void;
  onAddThingToView?: (thingId: string, opdId: string) => void;
}

interface TreeNode {
  opd: OPD;
  children: TreeNode[];
}

function buildTree(model: Model): TreeNode[] {
  const roots: TreeNode[] = [];
  const nodeMap = new Map<string, TreeNode>();

  for (const opd of model.opds.values()) {
    if (opd.opd_type === "view") continue; // R-NT-4: views are separate
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

/** R-NT-2: Build object tree — OPDs grouped by the object they refine (ISO §3.44). */
function buildObjectTree(model: Model): Map<string, OPD[]> {
  const byObject = new Map<string, OPD[]>();
  for (const opd of model.opds.values()) {
    if (!opd.refines || opd.opd_type === "view") continue;
    const thing = model.things.get(opd.refines);
    if (!thing || thing.kind !== "object") continue;
    const list = byObject.get(opd.refines) ?? [];
    list.push(opd);
    byObject.set(opd.refines, list);
  }
  return byObject;
}

/** R-NT-4: Collect view OPDs. */
function getViewOpds(model: Model): OPD[] {
  return [...model.opds.values()]
    .filter(o => o.opd_type === "view")
    .sort((a, b) => a.name.localeCompare(b.name));
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
  onRenameOpd,
}: {
  node: TreeNode;
  depth: number;
  currentOpd: string;
  model: Model;
  onSelectOpd: (id: string) => void;
  onRenameOpd?: (opdId: string, name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(node.opd.name);
  const isActive = node.opd.id === currentOpd;
  const hasChildren = node.children.length > 0;

  const commitRename = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== node.opd.name && onRenameOpd) {
      onRenameOpd(node.opd.id, trimmed);
    }
    setEditing(false);
  };

  return (
    <>
      <div
        className={`opd-tree__node${isActive ? " opd-tree__node--active" : ""}${depth > 0 ? " opd-tree__node--child" : ""}`}
        style={{ paddingLeft: `${14 + depth * 18}px` }}
        role="treeitem"
        tabIndex={0}
        aria-selected={isActive}
        aria-expanded={hasChildren ? true : undefined}
        onClick={() => onSelectOpd(node.opd.id)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelectOpd(node.opd.id); } }}
        onDoubleClick={(e) => { e.stopPropagation(); setEditName(node.opd.name); setEditing(true); }}
      >
        <span className="opd-tree__icon">{hasChildren ? "▾" : "◇"}</span>
        <div>
          {editing ? (
            <input
              className="opd-tree__rename-input"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setEditing(false); }}
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <div className="opd-tree__label">
              {node.opd.name}
              <span className="opd-tree__count">
                {[...model.appearances.values()].filter(a => a.opd === node.opd.id).length}
              </span>
            </div>
          )}
          {node.opd.refines && !editing && (
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
          onRenameOpd={onRenameOpd}
        />
      ))}
    </>
  );
}

export function OpdTree({ model, currentOpd, selectedThing, onSelectOpd, onSelectThing, onRenameOpd, onCreateViewOpd, onRemoveViewOpd, onAddThingToView }: Props) {
  const tree = buildTree(model);
  const objectTree = buildObjectTree(model);
  const viewOpds = getViewOpds(model);
  const things = visibleThings(model, currentOpd);
  const [showThingPicker, setShowThingPicker] = useState(false);
  const currentOpdObj = model.opds.get(currentOpd);
  const isViewOpd = currentOpdObj?.opd_type === "view";

  return (
    <aside className="opd-tree" role="navigation" aria-label="OPD tree navigation">
      <div className="opd-tree__title">OPD TREE</div>
      {tree.map((node) => (
        <TreeNodeItem
          key={node.opd.id}
          node={node}
          depth={0}
          currentOpd={currentOpd}
          model={model}
          onSelectOpd={onSelectOpd}
          onRenameOpd={onRenameOpd}
        />
      ))}

      {/* R-NT-2: Object Tree (ISO §3.44) — OPDs that refine objects */}
      {objectTree.size > 0 && (
        <>
          <div className="opd-tree__section">Object Tree</div>
          {[...objectTree.entries()].map(([thingId, opds]) => {
            const thing = model.things.get(thingId);
            return (
              <div key={thingId}>
                <div className="opd-tree__object-root" style={{ paddingLeft: "14px" }}>
                  <div className={`opd-tree__thing-dot opd-tree__thing-dot--object`} />
                  <span className="opd-tree__label">{thing?.name ?? thingId}</span>
                </div>
                {opds.map((opd) => (
                  <div
                    key={opd.id}
                    className={`opd-tree__node${opd.id === currentOpd ? " opd-tree__node--active" : ""} opd-tree__node--child`}
                    style={{ paddingLeft: "32px" }}
                    onClick={() => onSelectOpd(opd.id)}
                  >
                    <span className="opd-tree__icon">◇</span>
                    <div>
                      <div className="opd-tree__label">{opd.name}</div>
                      <div className="opd-tree__refines">{opd.refinement_type}</div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </>
      )}

      {/* R-NT-4: View OPDs (ISO §14 line 726) — ad-hoc collections */}
      <div className="opd-tree__section opd-tree__section--views">
        Views
        {onCreateViewOpd && (
          <button className="opd-tree__add-view" onClick={onCreateViewOpd} title="New View OPD">+</button>
        )}
      </div>
      {viewOpds.length === 0 && (
        <div className="opd-tree__empty">No views</div>
      )}
      {viewOpds.map((opd) => (
        <div
          key={opd.id}
          className={`opd-tree__node opd-tree__node--view${opd.id === currentOpd ? " opd-tree__node--active" : ""}`}
          style={{ paddingLeft: "14px" }}
          onClick={() => onSelectOpd(opd.id)}
        >
          <span className="opd-tree__icon">◈</span>
          <div className="opd-tree__label">{opd.name}</div>
          {onRemoveViewOpd && (
            <button
              className="opd-tree__remove-view"
              onClick={(e) => { e.stopPropagation(); onRemoveViewOpd(opd.id); }}
              title="Delete view"
            >×</button>
          )}
        </div>
      ))}

      <div className="opd-tree__section opd-tree__section--views">
        Things in View
        {isViewOpd && onAddThingToView && (
          <button
            className="opd-tree__add-view"
            onClick={() => setShowThingPicker(!showThingPicker)}
            title="Add existing thing to this view"
          >{showThingPicker ? "−" : "+"}</button>
        )}
      </div>
      {/* R-NT-4: Thing picker for view OPDs */}
      {showThingPicker && isViewOpd && onAddThingToView && (() => {
        const existingIds = new Set(things.map(t => t.id));
        const available = [...model.things.values()]
          .filter(t => !existingIds.has(t.id))
          .sort((a, b) => {
            if (a.kind !== b.kind) return a.kind === "object" ? -1 : 1;
            return a.name.localeCompare(b.name);
          });
        if (available.length === 0) return <div className="opd-tree__empty">All things already in view</div>;
        return (
          <div className="opd-tree__picker">
            {available.map(t => (
              <div
                key={t.id}
                className="opd-tree__thing opd-tree__thing--pickable"
                onClick={() => { onAddThingToView(t.id, currentOpd); }}
              >
                <div className={`opd-tree__thing-dot opd-tree__thing-dot--${t.kind}`} />
                <span>{t.name}</span>
              </div>
            ))}
          </div>
        );
      })()}
      {things.map((t) => (
        <div
          key={t.id}
          className={`opd-tree__thing${selectedThing === t.id ? " opd-tree__thing--selected" : ""}`}
          role="option"
          tabIndex={0}
          aria-selected={selectedThing === t.id}
          onClick={() => onSelectThing(selectedThing === t.id ? null : t.id)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelectThing(selectedThing === t.id ? null : t.id); } }}
        >
          <div className={`opd-tree__thing-dot opd-tree__thing-dot--${t.kind}`} />
          <span>{t.name}</span>
        </div>
      ))}
    </aside>
  );
}
