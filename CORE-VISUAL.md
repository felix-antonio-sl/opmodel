# opmodel — Core Visual 360°

## Architecture

```
@opmodel/core          → Model, OPL engine, simulation, validation
@opmodel/web           → Visual rendering (React + SVG)
  lib/
    spatial-layout.ts   → 6 layout strategies + auto-sizing
    auto-layout.ts      → From-scratch topology-aware positioning
    edge-router.ts      → Bézier curves + parallel link offset
    visual-lint.ts      → 6 finding types + quality scoring
    visual-report.ts    → Model-level quality report
    visual-rules.ts     → ISO constants, colors, sizing
    geometry.ts         → Point, Rect, edge point math
    commands.ts         → Command pattern for model mutations
  components/
    OpdCanvas.tsx       → Main SVG canvas compositor
    canvas/
      ThingNode.tsx     → Object/process shape rendering
      LinkLine.tsx      → 14 link types with ISO markers
      SvgDefs.tsx       → SVG markers and filters
      InlineRename.tsx  → In-place text editing
      canvas-helpers.ts → Shared utilities and types
```

## Visual Rendering — ISO 19450 Coverage

### Things (12/12)

| Concept | Visual | Implementation |
|---------|--------|----------------|
| Object | Rectangle | `<rect>` in ThingNode |
| Process | Ellipse | `<ellipse>` in ThingNode |
| Physical essence | Bold contour (3.5px) | `baseStroke = isPhysical ? 3.5 : 1.2` |
| Informatical essence | Thin contour (1.2px) | Default stroke |
| Environmental affiliation | Dashed contour (6,3) | `strokeDasharray="6,3"` |
| Container (refined) | Transparent fill, thick border | `isContainer` rendering |
| External (duplicate) | Shadow offset + ↑ badge | `isExternal` + R-VI-2 |
| Refined thing | ⊕ marker | Bottom-right indicator |
| Computational object | `d` badge | Top-left when `thing.computational` |
| Computational process | `f` badge | Top-left when `thing.computational` |
| Shared (sub-model) | ⇌ badge | Bottom-left |
| Implicit (ghost) | Dashed contour (4,3), 40% opacity | `isImplicit` rendering |

### States (6/6)

| Concept | Visual | Implementation |
|---------|--------|----------------|
| State pills | Rounded rects below thing | `state-pill` with layout math |
| Initial state | Thick border (2.5px) | `strokeWidth={state.initial ? 2.5 : 1}` |
| Final state | Double border | Inner rect at +2px inset |
| Default state | Diagonal arrow marker | Line from bottom-left |
| Current state | Highlighted fill | `state-current-bg` var |
| Suppressed states | "..." indicator | `hasSuppressedStates` |

### Links (14/14 types)

| Type | Category | Marker | Color |
|------|----------|--------|-------|
| effect | Procedural | ↔ arrows | #16794a |
| consumption | Procedural | → arrow | #16794a |
| result | Procedural | → arrow | #16794a |
| input | Procedural | → arrow | #16794a |
| output | Procedural | → arrow | #16794a |
| agent | Enabling | ● filled circle | #2b6cb0 |
| instrument | Enabling | ○ hollow circle | #2b6cb0 |
| aggregation | Structural | ▲ filled triangle | #6b5fad |
| exhibition | Structural | ▲ + inner triangle | #6b5fad |
| generalization | Structural | △ open triangle | #6b5fad |
| classification | Structural | △ + inner circle | #6b5fad |
| tagged | Structural | → purple arrow | #6b5fad |
| invocation | Control | ⚡ zigzag + arrow | #c05621 |
| exception | Control | bars + arrow | #c05621 |

### Link Decorations

| Decoration | Visual |
|------------|--------|
| Self-invocation | Bézier loop above process |
| Merged consumption+result | DA-7 double-headed arrow |
| State-specified effect | Routes to state pill + "effect (from → to)" label |
| Input/output split (DA-8) | Unidirectional arrows with "input"/"output" labels |
| Exception overtime | 1 perpendicular bar |
| Exception undertime | 2 perpendicular bars |
| Probability | "85%" label below link |
| Rate | "5/min" label below link |
| Multiplicity | Source/target multiplicity labels |
| Edge routing | Bézier curves for crossing links, offset for parallel |

### Modifiers (4/4)

| Modifier | Badge | Color |
|----------|-------|-------|
| Event | `e` circle | #d69e2e (gold) |
| Condition | `c` circle | #3182ce (blue) |
| Condition (skip) | `c` + diagonal | #c05621 (orange) |
| Condition (negated) | `¬c` circle | #9b2c2c (dark red) |

### Structural Rendering

| Concept | Visual |
|---------|--------|
| Fork triangles | 4 types: filled (aggregation), inner triangle (exhibition), open (generalization), inner circle (classification) |
| Ordered aggregation | `{ordered}` label + sequence numbers on branches |
| Fan arcs (XOR) | Single dashed arc |
| Fan arcs (OR) | Double dashed arc |
| Subprocess order | Numbered badges + dashed connectors |

### OPL Sentence → Visual Mapping (13/13)

| Sentence Type | Visual Element |
|---------------|----------------|
| thing-declaration | ThingNode shape with name label |
| state-enumeration | State pills below thing |
| state-description | State pill with attributes |
| link | LinkLine with ISO marker |
| grouped-structural | Fork triangle with branches |
| modifier | Event/condition badge on link |
| duration | Duration text below process name |
| fan | Dashed arc across links |
| in-zoom-sequence | Subprocess order badges |
| attribute-value | Computational d/f badge |
| requirement | Validation panel reference |
| assertion | Verification checklist reference |
| scenario | Path labels in OPL panel |

## Layout Engine

### 6 Strategies

| Strategy | When Used | Approach |
|----------|-----------|----------|
| `in-zoom-sequential` | In-zoom refinement OPDs | Vertical sequence, enablers left/right |
| `branching-control` | In-zoom with XOR/OR fans | Fan-aware branching layout |
| `unfold-grid` | Unfold refinement OPDs | Grid of structural children |
| `structural-cluster` | Structure-dominated OPDs | Parent-child cluster layout |
| `sd-balanced` | SD/root/view OPDs | Three-band: enablers, processes, objects |
| `none` | Fallback | No patches, just audit |

### Auto-Layout From Scratch

For models without positions (NL, API, import):

1. Classify things by role (main-process, enabler, transformer-object, structural)
2. Topological sort processes by dependency chain
3. Place in lanes: left (enablers), center (processes), right (objects)
4. Align connected things vertically
5. Apply layout engine refinement

### Post-Layout Processing

- Relaxation pass (lane-aware, iterative overlap resolution)
- Auto-sizing for state pills (ensures width ≥ min for visible states)
- Pin/lock-size respect
- Quality scoring (A-F grade per OPD)

## Edge Routing

- Straight paths for non-crossing links
- Quadratic Bézier curves for links with 2+ crossings
- Parallel link offset for same source↔target pairs
- Label point computation on curved paths

## Visual Lint

6 finding types:

| Finding | Severity | Description |
|---------|----------|-------------|
| overlap | error | Two things overlap |
| orphan | warning | Thing with no links |
| truncated-state | warning | State pill text doesn't fit |
| degenerate-bounds | warning | Extreme aspect ratio |
| crowded-diagram | info | Too many nodes in area |
| tight-spacing | info | Nodes too close together |

## Export Formats

| Format | Method | Notes |
|--------|--------|-------|
| .opmodel (JSON) | Save | Lossless round-trip |
| SVG | DOM clone + inline styles | Standalone, no external CSS needed |
| PNG | SVG → Canvas → Blob | 2× resolution |
| OPL text | renderAll() | Bilingüe EN/ES |
| Markdown | exportMarkdown() | Documentation format |

## Test Coverage

- **1,042 tests** across 70 files
- Visual correctness 360°: OPL↔OPD correspondence verified
- Visual audit: 0 errors across 5 fixtures (all grade A)
- OPL round-trip: expose is idempotent
- Edge router: crossing detection + parallel offset
- Auto-layout: topology-aware positioning
- OPL sentence coverage: all 13 types mapped to visual elements

## Fixtures

| Fixture | Things | Links | OPDs | Grade |
|---------|--------|-------|------|-------|
| Coffee Making | 10 | 8 | 2 | A |
| Driver Rescuing | 14 | 12 | 2 | A |
| HODOM | 48 | 82 | 6 | A (92-97) |
| HODOM V2 | ~30 | ~40 | 2 | A (97-99) |
| EV-AMS | 49 | 54 | 6 | A (95-100) |
