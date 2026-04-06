# Auditoría Categórica — OPL-First y el Isomorfismo OPL ↔ OPD

| Campo | Valor |
|-------|-------|
| Fecha | 2026-04-06 |
| Tipo | categorical review (re-audit) |
| Auditor | steipete (opm-modeler + senior-architect) |
| Scope | Pipeline OPL-first completo vs estructura categórica C_OPM |
| Corpus normativo | ISO 19450, `analysis/opm-analisis-categorico-360.md`, `audits/opm-audit-categorica.md` |

---

## 0. Pregunta central

> ¿El pipeline OPL-first implementado respeta las leyes categóricas de la bimodalidad OPD ↔ OPL (§6 del análisis 360), y en qué grado las fases completadas realizan el isomorfismo semántico entre ambas representaciones?

---

## 1. El isomorfismo teórico: qué dice la formalización

Del análisis 360 (§6.2):

```
La bimodalidad OPD↔OPL NO es un isomorfismo estricto.
Es un lens bidireccional (o un isomorfismo up-to-redundancia-presentacional).
```

```
C_OPD / ~_layout  ≃  C_Fact  ≃  C_OPL / ~_grammar
```

Es decir: OPD y OPL son equivalentes **módulo información presentacional**. OPD tiene layout (x, y, w, h) que OPL no tiene. OPL tiene gramática explícita que OPD solo implica visualmente. La **semántica** (model facts) es idéntica en ambas representaciones.

Las leyes que rigen esto son:

| Ley | Definición | Significado |
|-----|-----------|-------------|
| **PutGet** | `get(put(facts, opd)) = facts` | Si actualizo el modelo con facts y luego extraigo, obtengo los mismos facts |
| **GetPut** | `put(get(opd), opd) = opd` | Si extraigo facts y los re-inyecto, el modelo no cambia |
| **PutPut** | `put(f2, put(f1, opd)) = put(f2, opd)` | Doble update = último gana |

---

## 2. El pipeline implementado: qué existe en el código

### 2.1 Los 5 functores

El código implementa 5 funciones que corresponden a functores en C_OPM:

```
                    OPL text
                       │
              ┌────────▼─────────┐
              │  parseOplDocument │   F₁: C_OPL → C_AST
              │  (opl-parse.ts)  │   text → OplDocument
              └────────┬─────────┘
                       │
              ┌────────▼─────────────┐
              │  compileOplDocuments  │   F₂: C_AST → C_Fact
              │  (opl-compile.ts)    │   OplDocument → Model
              └────────┬─────────────┘
                       │
              ┌────────▼─────────┐
              │  validateOpl     │   F₃: C_Fact → C_Fact (idempotente)
              │  (opl-validate)  │   Model → ValidationResult
              └────────┬─────────┘
                       │
              ┌────────▼──────┐
              │    expose     │   F₄: C_Fact → C_AST
              │  (opl.ts)    │   Model → OplDocument
              └────────┬──────┘
                       │
              ┌────────▼──────┐
              │    render     │   F₅: C_AST → C_OPL
              │  (opl.ts)    │   OplDocument → text
              └──────────────┘
```

Composiciones relevantes:

```
Parse'  = F₂ ∘ F₁     :  C_OPL → C_Fact     (text → Model)
Render' = F₅ ∘ F₄     :  C_Fact → C_OPL     (Model → text)
```

### 2.2 Los 2 lens pre-existentes

El lens **legacy** (DA-6, pre-OPL-first) opera sobre `OplDocument` como AST intermedio:

```
expose:      Model × opdId → OplDocument         (get del lens)
applyOplEdit: Model × OplEdit → Result<Model>    (put del lens)
editsFrom:    OplDocument → OplEdit[]             (reverse del get)
```

Verificado en tests: PutGet (5 tests), GetPut (5 tests).

El lens **OPL-first** (nuevo) opera sobre text:

```
Parse' = compile ∘ parse :  text → Model          (get' del nuevo lens)
Render' = render ∘ expose :  Model → text          (put' inverso)
```

### 2.3 Composición total

El pipeline completo forma un **diamond**:

```
                     Model (C_Fact)
                    ╱              ╲
          expose  ╱                  ╲  compile
               ╱                      ╲
         OplDocument                OplDocument
         (from model)              (from text)
               ╲                      ╱
          render ╲                  ╱ parse
                  ╲              ╱
                     OPL text
```

La pregunta categórica central: **¿el diamond conmuta?**

---

## 3. Verificación de leyes

### 3.1 PutGet del nuevo pipeline: `Parse' ∘ Render' ≅ id_Fact`

**Significado:** Si renderizo un modelo a OPL y luego lo parseo/compilo de vuelta, obtengo el mismo modelo (módulo IDs generados y layout).

**Estado:** ✅ **VERIFICADO en 6 fixtures reales**.

El test `opl-roundtrip.test.ts` ejecuta exactamente esta ley:

```typescript
// Model → expose → render → parse → compile → expose → render → parse
// Verifica que las sentence signatures sean idénticas
expect(sortedSignatures(reparsed.value.sentences))
  .toEqual(sortedSignatures(parsed.value.sentences));
```

Las 6 fixtures pasan: coffee-making, driver-rescuing, hodom-v2, hodom-hsc, ev-ams, hospitalizacion-domiciliaria.

**Nota categórica:** La igualdad es up-to **signatures** (no textual). Esto es correcto: PutGet es igualdad en C_Fact (semántica), no en C_OPL (texto). Dos OPL textos pueden ser gramaticalmente distintos pero semánticamente idénticos.

### 3.2 GetPut del lens legacy: `put(get(m), m) = m`

**Significado:** Si extraigo OplDocument de un modelo y re-aplico los edits al mismo modelo, no cambia.

**Estado:** ✅ **VERIFICADO** (5 tests en `opl.test.ts` describe "GetPut").

### 3.3 GetPut del nuevo pipeline: `compile(parse(render(expose(m)))) ≅ m`

**Significado:** El ciclo completo text→model→text→model produce un modelo isomorfo al original.

**Estado:** ⚠️ **VERIFICADO PARCIALMENTE**.

El roundtrip test verifica igualdad de **sentence signatures**, no igualdad de **Model**. Hay información que se pierde en el ciclo:

| Información | ¿Sobrevive roundtrip? | Razón |
|-------------|----------------------|-------|
| Things (name, kind, essence, affiliation) | ✅ | Parse + compile reconstituyen |
| States (name, initial, final, default) | ✅ | Verificado explícitamente |
| Links (type, source, target, state-specified) | ✅ | Sentence signatures incluyen esto |
| Modifiers (event, condition) | ✅ | Compilados correctamente |
| Fans (XOR, OR, AND) | ✅ | Compilados con links implícitos |
| Requirements, assertions, scenarios | ✅ | Compilados |
| **Appearances (x, y, w, h)** | ⚠️ parcial | `preserveLayout` existe pero no es default |
| **OPD skeleton (jerarquía)** | ⚠️ parcial | Solo SD compilado, SD1+ requiere multi-doc |
| **Settings/Meta** | ❌ | No expresable en OPL |
| **Entity IDs** | ❌ | Se regeneran (correcto: IDs son implementacionales, no ontológicos) |

**Diagnóstico categórico:** El roundtrip es un **isomorfismo en C_Fact** pero NO en C_Model (que incluye layout + meta + IDs). Esto es exactamente lo que la teoría predice (§6.2): la equivalencia es `C_OPD / ~_layout ≃ C_Fact ≃ C_OPL / ~_grammar`.

### 3.4 PutPut: `compile(parse(t2)) = compile(parse(t2))` (último gana)

**Estado:** ✅ **TRIVIALMENTE SATISFECHO** — el compile es una función pura, idempotente por construcción.

---

## 4. Estructura categórica del pipeline

### 4.1 El Adjunction Diamond

La teoría (§6.3) predice:

```
Render ⊣ Parse    (Render es adjunto izquierdo de Parse)
```

En el código:

```
Render' = render ∘ expose  : C_Fact → C_OPL
Parse'  = compile ∘ parse  : C_OPL → C_Fact
```

¿Es una adjunción? Verificación:

```
Parse' ∘ Render' ≅ id_Fact     ← PutGet: ✅ verificado
Render' ∘ Parse' ≅ id_OPL     ← ¿se cumple?
```

**Render' ∘ Parse'** significa: tomar OPL text → parse → compile → expose → render → OPL text'. ¿Obtengo el mismo texto?

**NO.** El texto puede diferir en:
- Orden de sentencias
- Espaciado y formato
- Elección de variante gramatical ("consists of" vs "comprises")
- Capitalización menor

Pero las **sentence signatures** sí son idénticas (test opl-roundtrip).

**Diagnóstico:** `Render' ∘ Parse'` NO es `id_OPL`, pero SÍ es `id_{C_OPL/~_grammar}` (identidad módulo equivalencia gramatical). Esto confirma que la relación es una **equivalencia de categorías**, no un isomorfismo estricto — exactamente lo que la teoría predice.

### 4.2 OplDocument como Objeto Intermedio

`OplDocument` es el AST compartido entre ambos brazos del diamond. Categóricamente es el **object of facts** — el modelo semántico independiente de presentación:

```
OplDocument ∈ Ob(C_Fact)
```

Parse produce OplDocument. Expose produce OplDocument. El test roundtrip compara OplDocuments (via signatures). Esto confirma que `C_Fact` es la categoría correcta donde verificar las leyes.

### 4.3 La Fibración OPD (DA-9)

El código implementa la fibración del análisis 360 (§4.1):

```
π: C_OPM_total → I_OPD
```

Como `resolveOpdFiber(model, opdId)` en `simulation.ts:536`. Cada OPD es una fibra computada (no almacenada). El "God Diagram" (∫M, construcción de Grothendieck) es el `Model` completo; cada OPD es la fibra `π⁻¹(OPD_i)`.

**En el contexto OPL-first:** El OPL text se organiza por OPD (`=== SD ===`, `=== SD1 ===`). El parser `parseOplDocuments` produce un `OplDocument[]` — uno por sección. El compiler recompone el Model total (el colimite de Grothendieck).

**Verificación:** ✅ Correcto categóricamente. El pipeline respeta la fibración.

---

## 5. Lo que funciona: leyes satisfechas

| Ley/Propiedad | Estado | Evidencia |
|---------------|--------|-----------|
| PutGet (lens legacy) | ✅ | 5 tests en opl.test.ts |
| GetPut (lens legacy) | ✅ | 5 tests en opl.test.ts |
| PutGet (OPL-first) | ✅ | 6 fixtures roundtrip |
| Equivalencia C_Fact | ✅ | Sentence signatures idénticas |
| Fibración OPD | ✅ | `resolveOpdFiber` + multi-doc parse |
| Cascade deletion (DA-10) | ✅ | Link endpoints → link + mods + fans |
| Reified Morphisms (Yoneda) | ✅ | `collectAllIds` namespace plano |
| Layout preservation | ✅ parcial | `preserveLayout` option en compiler |
| Path equations PE-1..PE-4 | ✅ | 43 invariantes en api.ts |
| Coalgebra ECA | ✅ | simulation.ts implementation |

---

## 6. Gaps categóricos: qué falta

### GAP-C1: GetPut del OPL-first no verifica igualdad de Model — Severidad **MEDIA**

El roundtrip test compara sentence signatures, no Models. Esto verifica PutGet en C_Fact pero no GetPut en C_Model. Un test que cierre esto:

```typescript
// GetPut completo: Model → text → Model' → diff(Model, Model') = ∅ (semántico)
const model = loadFixture();
const text = renderAll(model);
const model2 = compile(parse(text));
expect(semanticDiff(model, model2)).toEqual([]);
```

Donde `semanticDiff` ignora IDs, layout, y meta — compara solo C_Fact.

**No es un bug funcional** (el pipeline funciona), pero la ley no está formalmente verificada end-to-end.

### GAP-C2: Multi-OPD roundtrip no verificado — Severidad **ALTA**

Los fixtures se testean por SD. El pipeline multi-doc (`parseOplDocuments` → `compileOplDocuments`) procesa secciones `=== SD ===`, `=== SD1 ===`, etc. Pero **no hay roundtrip test multi-OPD** que verifique:

```
renderAll(model) → parseOplDocuments → compileOplDocuments → renderAll → compare
```

Esto es relevante porque la fibración del OPD tree (§4.1 del 360) requiere que las fibras se recompongan correctamente. Si SD1 refiere things definidos en SD, la resolución de nombres cross-OPD es crítica.

**Impacto:** El isomorfismo está verificado **fibra por fibra** pero no como **colimite de Grothendieck** (∫M).

### GAP-C3: Layout como segunda representación no gobernada — Severidad **MEDIA**

La teoría dice:
```
C_OPD / ~_layout  ≃  C_Fact
```

El código implementa `preserveLayout` como opción del compiler — pero el layout no está gobernado por el lens. En la práctica:

1. OPL text → compile → Model (sin layout)
2. `preserveLayout` toma positions del Model anterior
3. Si no hay Model anterior → auto-layout

Esto significa que el layout vive **fuera** del isomorfismo — es un side-channel. Categóricamente correcto (el layout es ~_layout, información quotiented), pero operacionalmente frágil: un edit OPL que agrega un thing produce un Model sin position para ese thing.

**Decisión abierta en docs:** Layout Option A/B/C (05-phases.md). No resuelta.

### GAP-C4: `oplSlug` como dependency leak — Severidad **BAJA**

`opl-parse.ts` y `opl-compile.ts` importan `oplSlug` desde `opl.ts`. Categóricamente, esto significa que el functor Parse (F₁) depende del functor Render (F₅) — una dependencia circular en la estructura de módulos que viola la dirección natural del pipeline:

```
parse DEBERÍA ser:    C_OPL → C_AST    (independiente de render)
parse ACTUAL:         C_OPL → C_AST    (usa normalización de render para name matching)
```

No es un bug funcional, pero la separación de concerns categórica no es limpia.

### GAP-C5: Bisimulación ausente — Severidad **BAJA** (heredada del audit anterior)

Del audit categórico original (P1): no hay forma de verificar si dos Models son conductualmente equivalentes (bisimilares). Solo se verifica equivalencia estructural (sentence signatures). Para modelos complejos con ciclos y fans, esto no es suficiente.

---

## 7. Evaluación por propiedad categórica

| Propiedad | Esperada (teoría §6) | Implementada | Score |
|-----------|---------------------|-------------|-------|
| PutGet | ✅ | ✅ 6 fixtures | 10/10 |
| GetPut | ✅ | ⚠️ parcial (signatures, no Model) | 7/10 |
| Equivalencia up-to | `C_Fact ≃ C_OPL/~` | ✅ sentence signatures | 9/10 |
| Fibración OPD | ✅ | ✅ resolveOpdFiber | 9/10 |
| Colimite multi-OPD | ∫M | ⚠️ sin roundtrip test | 6/10 |
| Adjunción Render ⊣ Parse | ✅ | ✅ unidades verificadas | 8/10 |
| Layout como quotient | C_OPD/~_layout | ⚠️ side-channel | 6/10 |
| Cascade deletion | DA-10 | ✅ | 10/10 |
| Invariant guards | Path equations | ✅ 43 guards | 10/10 |

**Score global: 8.3/10**

---

## 8. El isomorfismo OPL ↔ OPD: veredicto

### 8.1 Lo que ya es isomorfismo

Para un **OPD individual** (fibra), el pipeline realiza el isomorfismo semántico:

```
OPD_i → expose → render → text_i → parse → compile → Model_i → resolveOpdFiber → OPD_i'
```

Donde `OPD_i' ≃ OPD_i` en C_Fact (módulo layout y IDs). **Verificado en 6 fixtures reales.**

### 8.2 Lo que aún no es isomorfismo

Para el **modelo completo** (colimite de Grothendieck sobre todas las fibras):

```
Model → renderAll → text_total → parseOplDocuments → compileOplDocuments → Model'
```

No hay test end-to-end que verifique `Model ≃ Model'`. La recomposición cross-OPD (name resolution entre fibras, refinement edges, things compartidos entre OPDs) no está formalmente verificada.

### 8.3 Lo que nunca será isomorfismo (y está bien)

- **Layout:** Información presentacional, legítimamente fuera del isomorfismo. `C_OPD / ~_layout ≃ C_Fact`.
- **IDs:** Implementacionales (Yoneda embedding), no ontológicos. Se regeneran correctamente.
- **Meta/Settings:** No expresables en OPL. Legítimamente fuera del dominio textual.

---

## 9. Recomendaciones

### R-C1: Test de GetPut end-to-end en C_Fact — **Prioridad Alta**

```typescript
for (fixture of FIXTURES) {
  const model = loadModel(readFileSync(fixture));
  const text = renderAll(model.value);
  const docs = parseOplDocuments(text);
  const model2 = compileOplDocuments(docs.value, { preserveLayout: model.value.appearances });
  // Compare semántico: things, states, links, modifiers, fans — ignorar IDs, layout
  expect(semanticEquals(model.value, model2.value)).toBe(true);
}
```

Blast radius: bajo. Solo tests nuevos.

### R-C2: Test de roundtrip multi-OPD — **Prioridad Alta**

Verificar que `renderAll → parseOplDocuments → compileOplDocuments` preserva la estructura del OPD tree, incluyendo refinement edges y things compartidos entre OPDs.

Blast radius: bajo-medio. Puede descubrir bugs en resolución cross-OPD.

### R-C3: Resolver la decisión de Layout — **Prioridad Media**

La decisión abierta (05-phases.md §1) sobre layout bloquea la limpieza del isomorfismo. Recomendación categórica: **Opción C** (`.opmodel` persiste layout, OPL manda sobre semántica). Razón: respeta la estructura `C_OPD / ~_layout ≃ C_Fact` — el layout vive en C_OPD, no en C_Fact ni en C_OPL.

### R-C4: Mover `oplSlug` a helpers — **Prioridad Baja**

Elimina la dependencia circular conceptual Parse → Render.

### R-C5: Source mapping bidireccional (Fase 4) — **Prioridad Media**

El source mapping (click línea OPL → cosa visual) es la **realización operacional** de la adjunción Render ⊣ Parse. Cada posición en OPL text mapea a un entity en C_Fact, que mapea a una position en OPD visual. Esto requiere un functor:

```
SourceMap: C_OPL_positions → C_OPD_positions
```

Ya existe parcialmente (`OplSourceSpan` en `opl-types.ts`, validation issues con línea/columna). Falta el inverso: click en OPD → highlight línea OPL.

---

## 10. Diagrama de estado del isomorfismo

```
     ┌─────────────────────────────────────────┐
     │          ISOMORFISMO OPL ↔ OPD          │
     │                                         │
     │  ✅ PutGet fibra individual  (6/6)      │
     │  ✅ GetPut lens legacy       (5 tests)  │
     │  ✅ Equivalencia C_Fact      (sigs)     │
     │  ✅ Fibración DA-9           (fiber)    │
     │  ✅ Cascade DA-10            (Yoneda)   │
     │  ✅ Invariantes PE-1..4      (43 guards)│
     │                                         │
     │  ⚠️ GetPut nuevo (Model, no sigs)       │
     │  ⚠️ Colimite multi-OPD (no test e2e)   │
     │  ⚠️ Layout decision abierta            │
     │  ⚠️ Source mapping incompleto          │
     │                                         │
     │  Score: 8.3/10                          │
     │  Veredicto: isomorfismo funcional       │
     │  en fibras, pendiente en colimite total │
     └─────────────────────────────────────────┘
```

---

## 11. Relación con el audit anterior (architecture-audit-2026-04-06.md)

El audit arquitectónico encontró que el core es A (9/10). Este audit categórico confirma y refina: el **pipeline OPL-first dentro de core** merece un 8.3/10 — el gap principal no es de implementación sino de **verificación formal** (faltan tests que cierren las leyes end-to-end).

Las recomendaciones R1-R3 del audit arquitectónico (Context providers, split OpdCanvas, split PropertiesPanel) son **ortogonales** a las de este audit. R-C1 y R-C2 de este audit son de core/tests y no tocan web.

Secuencia combinada sugerida:
1. **R-C1 + R-C2** (tests de leyes — bajo riesgo, alto valor formal)
2. **R1** del audit arquitectónico (Context providers — desbloquea web)
3. **R-C3** (decisión de layout — desbloquea Fase 4 completa)
4. **R-C5** (source mapping — realiza la adjunción operacionalmente)
