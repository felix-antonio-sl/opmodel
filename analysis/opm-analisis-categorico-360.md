# Analisis Categorico 360 de OPM (ISO 19450)

**Autor:** fxsl/arquitecto-categorico
**Fecha:** 2026-03-10
**Fuentes:** ISO 19450, corpus OPM/KORA (01-05), OPM version felix.md
**Alcance:** Formalizacion completa de Object Process Methodology como sistema categorico

---

## PARTE I — MICROSCOPIO: Anatomia Categorica Granular

---

### 1. La Categoria C_OPM

#### 1.1 Definicion Formal

**Definicion 1.1** (Categoria C_OPM). Sea C_OPM la categoria cuyos:

- **Objetos:** Son *Things* de OPM, es decir, la union disjunta de Objects y Processes:
  ```
  Ob(C_OPM) = Obj ⊔ Proc
  ```
  donde Obj es la coleccion de todos los OPM Objects y Proc es la coleccion de todos los OPM Processes.

- **Morfismos:** Son *Links* de OPM. Para cualesquiera things T1, T2:
  ```
  Hom(T1, T2) = StructLinks(T1, T2) ∪ ProcLinks(T1, T2) ∪ ControlLinks(T1, T2)
  ```

- **Composicion:** Si f: T1 → T2 y g: T2 → T3 son enlaces, entonces g ∘ f: T1 → T3 existe cuando la composicion es semanticamente valida (ver restricciones abajo).

- **Identidades:** Para cada thing T, existe id_T: T → T (el thing persiste como si mismo a traves del tiempo).

#### 1.2 Restricciones sobre la composicion

La composicion en C_OPM NO es libre. Las restricciones de OPM imponen:

1. **Segregacion de dominios estructurales:** Los structural links conectan Obj-Obj o Proc-Proc, *excepto* Exhibition-Characterization (que puede conectar Obj-Proc para modelar operaciones). Esto significa que los morfismos estructurales viven mayoritariamente en subcategorias:
   ```
   C_OPM^struct ⊃ C_Obj^struct ⊔ C_Proc^struct ⊔ ExhChar(Obj, Proc)
   ```

2. **Segregacion procedimental:** Los procedural links SIEMPRE conectan un Object (o estado de Object) con un Process. Nunca Obj-Obj ni Proc-Proc (excepto invocacion Proc-Proc).
   ```
   ProcLinks ⊆ Hom(Obj, Proc) ∪ Hom(Proc, Obj) ∪ Invoc(Proc, Proc)
   ```

3. **Principio de unicidad del enlace procedimental:** Para cada par (Object o, Process p) a un nivel de abstraccion dado, existe *exactamente un* enlace procedimental. Esto es un constraint de arity-1 sobre Hom_proc(o, p).

#### 1.3 C_OPM como categoria enriquecida

La estructura de C_OPM no es una categoria simple (1-categoria). Hay al menos tres niveles de estructura:

- **Nivel 0:** Things (objetos de la categoria).
- **Nivel 1:** Links (morfismos entre things).
- **Nivel 2:** Refinamientos de links — el control modifier ('e', 'c') sobre un link es un 2-morfismo que enriquece un procedural link con semantica adicional.

```
  Agent Link ----[+e]----> Agent Event Link
       |                        |
       |      2-celda           |
       v                        v
  "handles"    ========>   "triggers and handles"
```

**Proposicion 1.1.** C_OPM es al menos una 2-categoria debil (bicategoria), donde:
- Los 0-celdas son Things.
- Las 1-celdas son Links.
- Las 2-celdas son Control Modifiers y refinamientos state-specified.

Alternativamente, C_OPM puede verse como una **categoria enriquecida sobre Cat**, donde cada Hom-set Hom(T1, T2) es el mismo una categoria pequeña cuyos objetos son los tipos de link disponibles y cuyos morfismos son las especializaciones (e.g., agent link → state-specified agent link → condition state-specified agent link).

#### 1.4 Path Equations

En C_OPM hay identidades de camino (path equations) derivadas de los invariantes semanticos:

**PE-1 (Conservacion de transformacion):**
```
consume ∘ create = id_∅  (objeto consumido + resultado = aniquilacion neta si es el mismo tipo)
```
Mas precisamente: si Process p consume Object A y produce Object B del mismo tipo, la composicion result_B ∘ consume_A factoriza a traves de p.

**PE-2 (Idempotencia del efecto):**
```
effect ∘ effect ≠ effect  (en general; cada efecto puede cambiar a distinto estado)
```
Pero si el estado de salida coincide con el de entrada:
```
effect(s→s) = id_s  (efecto trivial = identidad en el estado)
```

**PE-3 (Habilitacion es no-transformante):**
```
Para todo enabler link e: O → P,  el estado de O antes y despues de P es el mismo:
post(P) ∘ e = pre(P) ∘ e  (como proyecciones sobre O)
```

**PE-4 (In-zoom es composicion vertical):**
Si P se descompone en P1;P2;...;Pn via in-zooming:
```
P = Pn ∘ ... ∘ P2 ∘ P1  (composicion secuencial en la timeline)
```

---

### 2. Things como Objetos de C_OPM

#### 2.1 Objects y Processes: la dualidad fundamental

**Definicion 2.1** (Subcategorias de Things).
```
C_Obj = subcategoria plena de C_OPM restringida a Ob(C_OPM) ∩ Obj
C_Proc = subcategoria plena de C_OPM restringida a Ob(C_OPM) ∩ Proc
```

Hay un functor de "olvido de tipo":
```
U: C_OPM → C_Thing
```
donde C_Thing colapsa la distincion Object/Process. Este functor tiene una seccion (no un adjunto): la asignacion de tipo
```
T: C_Thing → C_OPM
```
que asigna a cada thing su clasificacion como Object o Process.

La relacion entre Objects y Processes no es una dualidad categorica estricta (no es op), sino una **complementariedad funcional**: Objects son lo que *persiste*; Processes son lo que *transforma*. Categorcamente:

```
Object : Algebra    ::   Process : Coalgebra
(estructura estable)     (dinamica generativa)
```

#### 2.2 States como subobjetos

**Definicion 2.2** (Functor de estados). Sea St: C_Obj → Set el functor que asigna a cada Object O su conjunto de estados:
```
St(O) = {s1, s2, ..., sn}    si O es stateful
St(O) = {*}                  si O es stateless (estado trivial/singleton)
```

Los estados de un Object O son **subobjetos** de O en el sentido preciso de la teoria de topoi: cada estado s_i define un monomorfismo
```
m_i: s_i ↪ O
```
La coleccion de todos los monomorfismos m_i forma un **reticulado de subobjetos** Sub(O).

**Proposicion 2.1.** Para un Object O stateful con estados {s1, ..., sn}, el reticulado Sub(O) satisface:
1. En todo instante t, exactamente un s_i es "activo" (O esta en s_i).
2. Los s_i son mutuamente excluyentes en tiempo: s_i ∧ s_j = ⊥ para i ≠ j (en el instante t).
3. La disyuncion es exhaustiva: s_1 ∨ ... ∨ s_n = O (siempre esta en algun estado).

Esto significa que Sub(O) tiene la estructura de un **espacio de estados exclusivo** — isomorfo al simplex estandar con vertices {s_i}.

**Estados especiales como morfismos distinguidos:**
```
initial: 1 → St(O)      (estado al crearse — morfismo desde terminal)
final:   St(O) → 1      (estado irreversible — morfismo al terminal)
default: 1 → St(O)      (estado asumido por defecto — seccion default)
```

El estado inicial y el default son ambos morfismos globales 1 → St(O), pero con semantica distinta: initial se activa en la creacion; default se activa en ausencia de especificacion.

#### 2.3 Attributes como exhibiciones

**Definicion 2.3** (Functor de exhibicion). Sea Exh: C_OPM → C_OPM el endofunctor que asigna a cada thing T la coleccion de sus features (atributos y operaciones):
```
Exh(T) = {f | T exhibits f}
```

Mas precisamente, Exh actua como una **fibra** sobre cada thing: el exhibition-characterization link define una fibracion
```
π: C_Feature → C_OPM
```
donde la fibra π⁻¹(T) sobre cada thing T es la categoria de features que caracterizan a T.

**Observacion critica:** Un atributo es *el mismo un Object* en OPM. Esto significa que Exh no sale de C_OPM — es un endofunctor. Pero no cualquier endofunctor: un atributo A de un Object O satisface:

1. A es un Object.
2. Los estados de A son los *valores* del atributo.
3. A esta ligado a O por un exhibition-characterization link.

Esto tiene la estructura de un **fibered product**: el atributo A vive en la fibra de O bajo el functor de exhibicion.

```
          C_Feature
            |
     π (fibracion)
            |
            v
          C_OPM

  Fibra sobre O:  π⁻¹(O) = {Attr1, Attr2, ..., Op1, Op2, ...}
```

#### 2.4 Operations como procesos exhibidos

Una Operation es un Process que caracteriza un Object exhibidor. El exhibition-characterization link para operaciones es el UNICO structural link que conecta Obj con Proc.

**Proposicion 2.2.** La exhibition-characterization de operaciones define un profunctor:
```
ExhOp: C_Obj^op × C_Proc → Set
ExhOp(O, P) = {exhibition-characterization links de O a P}
```

Este profunctor es la "bisagra" entre el mundo estatico (Obj) y el dinamico (Proc) de OPM.

#### 2.5 Perseverance, Essence, Affiliation como fibraciones clasificadoras

Los tres atributos genericos de todo Thing definen fibraciones:

**Definicion 2.4** (Fibracion de atributos genericos).
```
Pers: C_OPM → {Static, Dynamic}           (Perseverance)
Ess:  C_OPM → {Physical, Informatical}    (Essence)
Aff:  C_OPM → {Systemic, Environmental}   (Affiliation)
```

Cada uno de estos es un functor a una categoria discreta de 2 objetos (un clasificador booleano). La fibra Pers⁻¹(Static) contiene todos los things estaticos; Pers⁻¹(Dynamic) todos los dinamicos; etc.

Estos tres functores se combinan en un **producto de clasificadores**:
```
Classify: C_OPM → {S,D} × {P,I} × {Sys,Env}
```
que asigna a cada thing su "tipo generico" como un elemento del cubo {0,1}³. Hay 8 tipos genericos posibles de things en OPM.

La existencia de valores **default** para estos atributos define una **seccion** del functor de clasificacion:
```
default: {S,D} × {P,I} × {Sys,Env} → C_OPM
```
tal que Classify ∘ default = id. Esta seccion no es unica — depende de la esencia primaria del sistema.

---

### 3. Links como Morfismos

#### 3.1 Taxonomia categorica de links

Los links de OPM forman una **jerarquia de tipos de morfismo** en C_OPM. Esta jerarquia tiene la siguiente estructura:

```
                        Link
                       /    \
               Structural    Procedural
              /    |    \      /    |    \
          Agg  Exh  Gen   Trans  Enab  Control
          |    |    |      |      |      |
         Part Char Spec  Cons   Agent  Event
                   |     Eff    Instr  Cond
                   Inst  Res
                         |
                       I/O pair
```

#### 3.2 Transforming Links: Functores de destruccion/creacion/modificacion

Los tres tipos de transforming link implementan las tres operaciones primitivas sobre existencia:

**Consumption link** (consume: O → P):
```
∃(O) ∧ ¬∃(O')     [O deja de existir al inicio de P]
```
Categorcamente, consumption es un morfismo que factoriza a traves del **objeto cero** ∅:
```
O --[consume]--> P --[internal]--> ∅
```
Consumption *aniquila* el objeto. Es un "morfismo a ∅" mediado por el proceso.

**Result link** (result: P → O):
```
¬∃(O) ∧ ∃(O')     [O empieza a existir al final de P]
```
Result es dual a consumption: es un "morfismo desde ∅" mediado por el proceso:
```
∅ --[internal]--> P --[result]--> O
```
Result *crea ex nihilo*. Es un "morfismo desde ∅".

**Effect link** (effect: O ↔ P):
```
∃(O) ∧ ∃(O') ∧ state(O) ≠ state(O')    [O cambia de estado]
```
Effect preserva existencia pero modifica estado. Categorcamente es un **endomorfismo parcial** sobre O mediado por P:
```
O --[input]--> P --[output]--> O
           s_in              s_out
```

**Diagrama conmutativo de transformacion:**
```
          consume
    O_in ---------> P ---------> O_out
      |             |              |
      |  pre-       |   exec       | post-
      v  process    v              v process
    St_in -------> ∅/St -------> St_out
```

#### 3.3 Enabling Links: Comma Categories

Los enablers (Agent, Instrument) NO son transformados por el proceso. Categorcamente, un enabling link NO es un morfismo transformante sino un **morfismo de estructura** que existe en una comma category.

**Definicion 3.1** (Comma category de habilitacion). Sea P un proceso fijo. La comma category (Obj ↓ P) tiene:
- Objetos: pares (O, e) donde O es un Object y e: O → P es un enabling link.
- Morfismos: h: O1 → O2 tales que e2 ∘ h = e1.

La distincion Agent/Instrument es un **refinamiento del clasificador** dentro de esta comma category:
```
(Obj ↓ P)_enable = (Obj_Human ↓ P) ⊔ (Obj_NonHuman ↓ P)
                 = AgentLinks(P) ⊔ InstrumentLinks(P)
```

**Propiedad definitoria del enabler:**
```
Para todo enabling link e: O → P:
    pre_state(O) = post_state(O)    [invariancia de estado del enabler]
```

Esto es la condicion de **preservation de fibra**: el enabler O no se mueve dentro de su fibra de estados.

#### 3.4 Control Links: Monadas de control

Los control modifiers 'e' (event) y 'c' (condition) son **transformaciones naturales** que enriquecen un link base con semantica adicional.

**Definicion 3.2** (Monada de evento). Sea E: ProcLink → ProcLink el endofunctor que añade semantica de evento:
```
E(link) = link + trigger_semantics
```
con:
- η: Id → E (toda link puede recibir un evento — unit de la monada).
- μ: E² → E (un evento sobre un evento es un evento — multiplicacion).

La ley crucial de E es: **el evento se pierde si la precondicion falla**. Esto es una propiedad de *volatilidad* — el evento es un recurso consumible:
```
E(link)(precond_fails) = ∅    [evento consumido sin efecto]
```

**Definicion 3.3** (Monada de condicion). Sea C: ProcLink → ProcLink el endofunctor de bypass:
```
C(link) = link + bypass_semantics
```
La condicion implementa un **coproducto condicional**:
```
C(link)(O, P) = P    si condition(O) = true
C(link)(O, P) = skip  si condition(O) = false
```

Esto es exactamente la semantica de un **Maybe monad** (o Option):
```
C(link) : O → Maybe(P)
           = Just(P)   si O satisface condicion
           = Nothing    si O no satisface condicion
```

**Diferencia entre Condition y Enabling sin modifier:**
```
Instrument sin 'c':  O ausente → ejecucion BLOQUEADA (espera indefinida)
Instrument con 'c':  O ausente → proceso SALTADO (bypass)
```

Categorcamente, la diferencia es:
- Sin 'c': **limite** (el proceso espera a que el diagrama sea completo).
- Con 'c': **colimite parcial** (el proceso se ejecuta con lo que haya disponible).

#### 3.5 Structural Links: Subcategorias estaticas

##### 3.5.1 Aggregation-Participation: Productos

La relacion todo-parte es un **producto** (o mas generalmente, un **limite**):
```
Whole = Part_1 × Part_2 × ... × Part_n
```

El aggregation-participation link modela la proyeccion canonica:
```
π_i: Whole → Part_i
```

Pero hay una asimetria importante: en OPM, la relacion de agregacion es **directa** (las partes constituyen el todo), no una proyeccion en sentido categorico estricto. Es mas preciso modelar la agregacion como un **cono**:

```
           Whole
          / | | \
    π_1 /  π_2 π_3 \ π_n
       /   |   |    \
    Part_1 Part_2 ... Part_n
```

La propiedad universal: Whole es el limite (producto) del diagrama de partes.

**Restriccion OPM:** Aggregation-participation NO conecta Objects con Processes. Esto significa que los productos son **internos** a C_Obj y C_Proc respectivamente:
```
×_Obj : C_Obj × C_Obj → C_Obj
×_Proc: C_Proc × C_Proc → C_Proc
```
No hay un producto mixto Object × Process en C_OPM via agregacion.

##### 3.5.2 Exhibition-Characterization: Fibraciones

Ya tratado en §2.3. La exhibition-characterization define una **fibracion de Grothendieck**:
```
π_exh: C_Feature → C_OPM
```

**Proposicion 3.1.** La exhibition-characterization es una fibracion opcleavable. Para cada morphismo f: T1 → T2 en C_OPM y cada feature F ∈ π⁻¹(T1), existe un lifting opcartesiano f̃: F → F' con F' ∈ π⁻¹(T2) si y solo si T2 hereda la feature F de T1 (via generalizacion-especializacion con herencia).

##### 3.5.3 Generalization-Specialization: Functores de inclusion y pullbacks

La relacion General-Specialization define un **preorden** (orden parcial reflexivo y transitivo) sobre Things:
```
S ≤ G    ⟺    S es especializacion de G
```

Este preorden induce una **subcategoria de inclusion**:
```
i: C_Spec ↪ C_Gen    (functor de inclusion)
```

**Herencia como pullback.** Si G tiene features {F1, ..., Fk}, y S es especializacion de G, entonces S hereda esas features. Esto es un **pullback**:

```
    S -------> G
    |          |
    | π_exh    | π_exh
    v          v
  Feat(S) --> Feat(G)
```

El cuadrado es un pullback: Feat(S) = Feat(G) ×_G S (las features de S son las features de G "tiradas hacia atras" a S).

**Discriminating Attribute como kernel de la especializacion:**
```
disc: Attr → {values}
```
La especializacion restringe el rango de valores del discriminating attribute. Esto es un **equalizer** o un **kernel**:
```
S = eq(disc, v_i)    [S es el equalizer de disc con el valor v_i]
```

##### 3.5.4 Classification-Instantiation: Free ⊣ Forget

La relacion Class-Instance define una **adjuncion**:

```
Free: C_Instance → C_Class     (clasificacion: de instancias a patrones)
Forget: C_Class → C_Instance   (instanciacion: de patrones a instancias concretas)
```

**Proposicion 3.2.** Hay una adjuncion Free ⊣ Forget:
```
Hom_Class(Free(I), C) ≅ Hom_Instance(I, Forget(C))
```

Interpretacion: dar un morfismo de la clasificacion de una instancia I a una clase C es lo mismo que dar un morfismo de I al olvido de la estructura de clase de C (es decir, verificar que I satisface el patron de C).

La instanciacion en OPM corresponde a proveer **valores concretos** para todas las features del patron. Categorcamente, la instancia es el **punto** (morfismo desde el terminal 1) de la clase:
```
instance: 1 → Forget(C)
```

##### 3.5.5 Tagged Structural Links: Profunctores

Los tagged structural links tienen semantica definida por el modelador (user-defined). Categorcamente, esto es un **profunctor**:
```
Tag: C_OPM^op × C_OPM → Set
Tag(T1, T2) = {tags definidos entre T1 y T2}
```

Las variantes:
- **Unidireccional:** profunctor estandar Tag(T1, T2).
- **Bidireccional con dos tags:** par de profunctores Tag_fwd(T1, T2) y Tag_bwd(T2, T1), no necesariamente inversos.
- **Reciproco:** profunctor simetrico Tag(T1, T2) = Tag(T2, T1).
- **Null-tagged:** profunctor constante con valor default "relates to".

**Diagrama de variantes:**
```
Unidireccional:     T1 --[tag]--> T2
Bidireccional:      T1 --[tag_a]--> T2 --[tag_b]--> T1   (tag_a ≠ inverse(tag_b))
Reciproco:          T1 <--[tag]---> T2                    (tag simetrico)
Null-tagged:        T1 --["relates to"]--> T2             (tag default)
```

---

### 4. El OPD Tree como Estructura Categorica

#### 4.1 Fibracion sobre el arbol de diagramas

**Definicion 4.1** (Categoria indice I_OPD). Sea I_OPD la categoria cuyos:
- Objetos: OPDs individuales (SD, SD1, SD2, ..., vistas).
- Morfismos: relaciones de refinamiento (in-zooming, unfolding) entre OPDs.
- Composicion: refinamiento transitivo.

I_OPD es un **preorden arborescente** con SD como raiz:

```
         SD (nivel 0)
        / | \
     SD1a SD1b SD1c   (nivel 1)
      |       / \
    SD2a   SD2b SD2c   (nivel 2)
      ...
```

**Definicion 4.2** (Fibracion de OPDs). El modelo OPM completo define una fibracion:
```
π_tree: C_OPM_total → I_OPD
```
donde la fibra π⁻¹(OPD_i) contiene todos los things y links visibles en el OPD i-esimo.

**Proposicion 4.1.** El OPD tree es una **opfibracion** (Grothendieck opfibration), donde:
- El refinamiento (in-zooming, unfolding) es un **push-forward** (opcartesian lifting): llevar un thing del nivel n al nivel n+1 lo "despliega" en sus componentes.
- La abstraccion (folding, out-zooming) es el **pull-back** correspondiente: colapsar componentes al nivel superior.

#### 4.2 In-zooming como functor de inclusion

**Definicion 4.3.** Para cada par (OPD padre, OPD hijo) conectado por in-zooming de un thing T:
```
inzoom_T: π⁻¹(OPD_padre)|_T → π⁻¹(OPD_hijo)
```

Este functor "abre" T y revela su estructura interna. Es un **functor de inclusion** que satisface:
```
fold_T ∘ inzoom_T = id_T    (folding invierte in-zooming)
inzoom_T ∘ fold_T ⊇ id     (in-zooming luego folding puede perder contexto nuevo)
```

Esto NO es una adjuncion estricta porque fold ∘ inzoom = id pero inzoom ∘ fold ≠ id en general (se pierde informacion al foldear si se ha añadido contexto al OPD hijo).

**Proposicion 4.2.** La relacion inzoom ⊣ fold es una **retraccion** (no una adjuncion):
```
fold es una retraccion de inzoom:  fold ∘ inzoom = id
inzoom es una seccion de fold
```

#### 4.3 Unfolding como colimite

Unfolding revela things jeraquicamente subordinados al refinee. El resultado es un **arbol jerarquico** cuya raiz es el refinee.

**Proposicion 4.3.** El thing desplegado T, visto como la raiz de su arbol de refinamiento, es el **colimite** (coproducto etiquetado) de sus refineables:
```
T = colim(R_1, R_2, ..., R_k)    via las inyecciones de participacion
```

Para procesos asincronos, el unfolding es un coproducto genuino (partes sin orden). Para procesos sincronos via in-zooming, es un **colimite secuencial** (cadena):
```
P = P_1 ;→ P_2 ;→ ... ;→ P_n    (composicion temporal)
```

#### 4.4 SD como objeto inicial

**Proposicion 4.4.** El System Diagram (SD) es el **objeto inicial** del arbol I_OPD:
```
Para todo OPD X en I_OPD, existe exactamente un camino SD → X
(via secuencia de refinamientos)
```

El SD NO es un objeto terminal: no hay un unico morfismo *desde* cada OPD al SD (hay multiples formas de abstraer/foldear). El SD es estrictamente inicial.

#### 4.5 La relacion entre OPDs como categoria indice

**Definicion 4.4** (Diagrama OPM). Un modelo OPM completo es un **functor**:
```
M: I_OPD → Cat
```
que asigna a cada OPD su contenido como categoria, y a cada refinamiento el functor de inclusion/despliegue correspondiente. El modelo total es el **colimite de Grothendieck**:
```
C_OPM_total = ∫ M    (construccion de Grothendieck)
```

---

### 5. ECA como Coalgebra

#### 5.1 El paradigma Event-Condition-Action

El ciclo ECA de OPM tiene la estructura:

```
Estado_sistema --[evento]--> Evaluacion_precondicion --[decision]--> Ejecucion_proceso
                                      |                                    |
                                      | false                             | true
                                      v                                    v
                                  Evento_perdido                     Nuevo_Estado_sistema
```

#### 5.2 Formalizacion coalgebraica

**Definicion 5.1** (Coalgebra ECA). Sea S el espacio de estados del sistema OPM (conjuncion de todos los estados de todos los objects). El comportamiento ECA define una coalgebra:
```
α: S → F(S)
```
donde F es el functor de comportamiento:
```
F(S) = Event × (Precond → S + 1)
```

Aqui:
- Event es el tipo de eventos (creacion/aparicion de objeto, transicion de estado).
- Precond → S + 1 es la funcion de transicion condicionada: si la precondicion se satisface, produce un nuevo estado S; si no, produce 1 (falla/skip — el "+1" modela el evento perdido).

#### 5.3 Transiciones como morfismos de Kleisli

**Definicion 5.2.** Sea T = Maybe = (−) + 1 el functor Maybe (Option). Las transiciones ECA son **morfismos de Kleisli** en la categoria Kleisli de T:
```
transition: S → T(S) = S + 1
```

La composicion de transiciones en Kleisli(T):
```
(g ∘_K f)(s) = case f(s) of
                 Just(s')  → g(s')
                 Nothing   → Nothing    [fallo se propaga]
```

Esto captura exactamente la semantica OPM: si un evento falla su precondicion, no solo el proceso no ocurre sino que el evento se pierde (fallo no recuperable sin nuevo evento).

#### 5.4 Preprocess/Postprocess como functores de fibra

```
Pre: C_Proc → P(C_Obj)     [Preprocess Object Set]
Post: C_Proc → P(C_Obj)    [Postprocess Object Set]
```

donde P(C_Obj) es la categoria de subconjuntos de objetos. La transicion completa de un proceso es:
```
exec_P: Pre(P) → Post(P)
```

**Diagrama conmutativo de la ejecucion de proceso:**
```
    Pre(P)  ────exec_P────>  Post(P)
      |                        |
      | ∀ consumee:            | ∀ resultee:
      |   stop_existing        |   start_existing
      |                        |
      | ∀ affectee:            | ∀ affectee:
      |   exit_input_state     |   enter_output_state
      v                        v
    S_before ──────────────> S_after
```

#### 5.5 Evento-perdido-si-precondicion-falla: excepcion monadica

La perdida del evento cuando la precondicion falla NO es una excepcion en el sentido de manejo de errores. Es la **absorcion del elemento cero** en un monoide con cero:

```
event · ¬precond = 0    (el evento es absorbido — no queda traza)
```

Categorcamente, esto es la propiedad del **objeto cero** en una categoria pointed: el evento "va a cero" y desaparece. Para reintentar, se necesita un **nuevo** evento (un nuevo morfismo desde el exterior).

Esto contrasta con una excepcion monadica clasica (como en Haskell) donde el error se propaga por la composicion. En OPM, el evento no se propaga — simplemente se aniquila. Es una semantica de **recurso lineal** (logica lineal): el evento se usa exactamente una vez y luego desaparece, independientemente del resultado.

---

### 6. Bimodalidad OPD ↔ OPL

#### 6.1 Estructura de la bimodalidad

OPM afirma equivalencia completa entre OPD (grafico) y OPL (textual). Analicemos esta afirmacion categorcamente.

**Definicion 6.1** (Functores bimodales).
```
G: C_OPM → C_OPD     [functor de representacion grafica]
T: C_OPM → C_OPL     [functor de representacion textual]
```

La "equivalencia completa" afirmada por OPM seria, en CT:
```
C_OPD ≃ C_OPL    (equivalencia de categorias)
```
a traves del diagrama:
```
    C_OPM
   /     \
  G       T
 /         \
C_OPD ≃ C_OPL
```

#### 6.2 Es un lens, no un isomorfismo estricto

**Proposicion 6.1.** La bimodalidad OPD↔OPL NO es un isomorfismo estricto. Es un **lens bidireccional** (o un isomorfismo up-to-redundancia-presentacional).

Argumento:
1. OPD contiene informacion espacial (posicion, layout, color semantico) que OPL no contiene.
2. OPL contiene gramatica explicita ("Processing consumes Consumee") que OPD solo implica via convenciones graficas.
3. La informacion **semantica** (model facts) es la misma, pero la informacion **presentacional** difiere.

**Definicion 6.2** (Lens OPD↔OPL). Sea Sem: C_OPD → C_Fact y Sem': C_OPL → C_Fact los functores que extraen los model facts. La bimodalidad es un lens:
```
get: C_OPD → C_Fact     (extraer semantica del diagrama)
put: C_Fact × C_OPD → C_OPD  (actualizar diagrama con nuevos facts)

get': C_OPL → C_Fact
put': C_Fact × C_OPL → C_OPL
```

**Leyes del lens:**
```
GetPut:  put(get(opd), opd) = opd           [actualizar con lo que ya tienes = noop]
PutGet:  get(put(facts, opd)) = facts       [extraer lo que actualizaste = lo mismo]
PutPut:  put(f2, put(f1, opd)) = put(f2, opd)  [doble update = ultimo gana]
```

#### 6.3 Adjuncion subyacente

La relacion entre OPD y OPL puede expresarse como una adjuncion a traves de la categoria de model facts:

```
Render ⊣ Parse

Render: C_Fact → C_OPD    [de facts a diagrama — functor libre]
Parse:  C_OPD → C_Fact    [de diagrama a facts — functor de olvido]

Render': C_Fact → C_OPL
Parse':  C_OPL → C_Fact
```

La equivalencia semantica es entonces:
```
Parse ∘ Render ≅ id_Fact ≅ Parse' ∘ Render'
```

Render ∘ Parse ≠ id porque renderizar y re-parsear puede producir un diagrama diferente al original (distinto layout, pero misma semantica).

**Proposicion 6.2.** La bimodalidad OPD↔OPL es una **equivalencia de categorias up-to-isomorfismo** en la categoria de model facts:
```
C_OPD / ~_layout  ≃  C_Fact  ≃  C_OPL / ~_grammar
```
donde ~_layout identifica OPDs con mismo contenido semantico pero distinto layout, y ~_grammar identifica OPLs con mismas sentencias pero distinto ordenamiento.

---

### 7. El Procedimiento de Modelado SD como Diagrama

#### 7.1 Los 9 pasos como diagrama en C_OPM

El procedimiento de modelado define un diagrama secuencial (cadena) en la categoria de modelos parciales:

```
Definicion 7.1 (Categoria de modelos parciales). Sea C_Partial la categoria cuyos:
- Objetos: modelos OPM parciales (subconjuntos de un modelo completo).
- Morfismos: inclusiones (agregar things/links al modelo).
```

Los 9 pasos definen un diagrama:
```
∅ --[step1]--> M_1 --[step2]--> M_2 --[step3]--> ... --[step9]--> SD
```

Cada paso agrega componentes:

| Paso | Morfismo | Agrega |
|------|----------|--------|
| 1 | add_function | Proceso principal |
| 2 | add_beneficiary | Objeto beneficiario |
| 3 | add_benefit_attr | Atributo + estados entrada/salida |
| 4 | add_agent | Agente (enabler humano) |
| 5 | add_system | Sistema (instrumento principal) |
| 6 | add_instruments | Instrumentos adicionales |
| 7 | add_inputs | Objetos consumidos |
| 8 | add_outputs | Objetos creados/modificados |
| 9 | add_environment | Objetos ambientales |

#### 7.2 SD como colimite del procedimiento

**Proposicion 7.1.** El System Diagram SD es el **colimite** (union amalgamada) de la cadena de modelos parciales:
```
SD = colim(∅ → M_1 → M_2 → ... → M_9)
```

Dado que cada paso es una inclusion (monomorfismo), el colimite es simplemente la union:
```
SD = M_1 ∪ M_2 ∪ ... ∪ M_9
```

#### 7.3 El wizard como colimite secuencial dirigido

El procedimiento de modelado (wizard) tiene la estructura de un **sistema dirigido** (directed system): cada paso depende de los anteriores, y el SD es el colimite dirigido de la cadena.

La secuencia NO es conmutativa: el paso 3 (atributo del beneficiario) requiere el paso 2 (beneficiario); el paso 5 (nombre del sistema) requiere el paso 1 (proceso principal). Hay dependencias parciales:

```
    1 (funcion principal)
    |
    +----> 2 (beneficiario)
    |      |
    |      +----> 3 (atributo beneficiario)
    |
    +----> 4 (agente)
    |
    +----> 5 (sistema — depende de nombre de proceso)
    |
    +----> 6 (instrumentos)
    |
    +----> 7 (inputs — consumidos por proceso principal)
    |
    +----> 8 (outputs — creados por proceso principal)
    |
    +----> 9 (entorno)
```

**Proposicion 7.2.** El grafo de dependencias del wizard es un **DAG** (grafo aciclico dirigido) cuyo orden topologico es la secuencia 1-9. El SD es el colimite de este DAG en C_Partial.

---

## PARTE II — TELESCOPIO: Vision Macro

---

### 8. OPM vs Otras Formalizaciones

#### 8.1 OPM vs UML/SysML

| Dimension | OPM | UML/SysML |
|-----------|-----|-----------|
| Ontologia | Minima: 3 primitivas (Object, Process, Link) | Maxima: 14 tipos de diagrama, decenas de metaclases |
| Categoria subyacente | Una sola categoria C_OPM con subcategorias | Multiple categorias disjuntas (C_Class, C_Sequence, C_State, ...) |
| Bimodalidad | OPD ↔ OPL (isomorfismo semantico) | Diagrama + OCL (parcialmente) — NO equivalencia completa |
| Funtorialidad | Un solo functor de modelado | Multiples functores parciales entre diagramas |
| Coherencia | Garantizada por ontologia minima | Responsabilidad del modelador (cross-diagram consistency) |

**Lo que gana OPM:** La ontologia minima garantiza **coherencia interna** (un solo lenguaje, una sola semantica). No hay el problema de UML de que un diagrama de clases y un diagrama de secuencia pueden contradecirse.

**Lo que pierde OPM:** Expresividad especializada. UML tiene notaciones optimizadas para dominos especificos (diagramas de actividad para workflows, diagramas de estado para FSMs, diagramas de despliegue para infraestructura). OPM usa la misma notacion para todo, lo cual puede ser menos expresivo para dominios especificos.

**Formalizacion categorica de la diferencia:**
```
OPM:      F_opm: C_System → C_OPM           (un solo functor fiel)
UML:      F_uml: C_System → ∏_i C_Diag_i    (producto de functores parciales)
```

La ventaja de F_opm: es un functor unico (no hay perdida de informacion inter-diagrama). La ventaja de F_uml: cada C_Diag_i puede tener mayor expresividad local.

#### 8.2 OPM vs Petri Nets

Las Petri Nets son un formalismo de concurrencia basado en places (estados), transitions (procesos) y tokens (instancias).

| OPM | Petri Net |
|-----|-----------|
| Object | Place |
| State of Object | Marking (tokens in place) |
| Process | Transition |
| Consumption link | Input arc |
| Result link | Output arc |
| Effect link | Input+Output arc pair |
| Enabling link | Read arc (test arc) |
| AND | Fork/Join |
| XOR | Choice/Merge |

**Proposicion 8.1.** Existe un functor fiel (pero no pleno):
```
Petri: C_OPM_proc → C_PetriNet
```
que mapea la subcategoria procedimental de OPM a Petri Nets. El functor es fiel (inyectivo en morfismos) pero no pleno porque OPM tiene estructura adicional:
- Structural links (no existen en Petri Nets).
- OPD tree (jerarquia de refinamiento, no modelada en Petri Nets planas).
- Attributes/features (mas alla del concepto de token).

**Functor Information Loss:** Petri pierde la estructura de refinamiento, los structural links, y la distincion Agent/Instrument.

#### 8.3 OPM vs State Machines

Los estados de un Object OPM forman un **automata determinista parcial**:

**Definicion 8.1** (Automata de estados OPM). Para cada Object O stateful:
```
A_O = (St(O), Proc_O, δ, s_init, S_final)
```
donde:
- St(O) = conjunto de estados de O.
- Proc_O = procesos que afectan a O (alfabeto de entrada).
- δ: St(O) × Proc_O → St(O) es la funcion de transicion (parcial, definida por los effect links).
- s_init = estado inicial (si existe).
- S_final = conjunto de estados finales (si existen).

δ es **parcial** porque no todo proceso afecta a O desde todo estado.

**Proposicion 8.2.** El automata A_O es **no determinista** en general: un effect link sin estados especificados (effect sin input/output) produce una transicion no determinista (el output state es desconocido). El refinamiento de effect a input/output-specified effect reduce el no-determinismo.

**Diagrama de refinamiento del no-determinismo:**
```
Effect link:                  O ↔ P         (no-determinista: δ(s, P) = ?)
Input-specified effect:       s_in → P → ?   (parcialmente determinista)
Output-specified effect:      ? → P → s_out  (parcialmente determinista)
Input-output-specified:       s_in → P → s_out  (determinista)
```

---

### 9. Tensiones Fundamentales de OPM

Para cada tension, identifico la adjuncion subyacente, los polos, y una pregunta socratica.

#### 9.1 Objeto ↔ Proceso

**Polos:** Lo que persiste (Object) vs lo que transforma (Process).

**Adjuncion subyacente:** No es exactamente Ob ⊣ Morph (que seria la adjuncion identidad-morfismos de una categoria). Es mas profunda:

```
Algebra ⊣ Coalgebra

Alg: C_OPM → C_Obj     (olvidar la dinamica, quedarse con estructura)
Coalg: C_OPM → C_Proc   (olvidar la estructura, quedarse con comportamiento)
```

La unidad de la adjuncion: η_T: T → Coalg(Alg(T)) dice "de la estructura de T, genera su comportamiento potencial".
La counidad: ε_T: Alg(Coalg(T)) → T dice "del comportamiento de T, reconstituye su estructura".

**Pregunta socratica:** Si todo Object puede ser reinterpretado como un Process congelado (un proceso cuya duracion es indefinida y cuya transformacion es trivial), y todo Process puede ser reinterpretado como un Object efimero (un objeto cuyo ciclo de vida es la ejecucion), ¿es la distincion Object/Process una decision de *modelado* o una propiedad *intrinseca* del dominio?

**Respuesta categorica:** La distincion es una **fibra del clasificador** Pers (perseverance). No es intrinseca al dominio — es una decisión del observador que elige que modelar como persistente y que como transitorio. Esto explica por que OPM permite que un mismo concepto sea modelado como Object o como Process segun el contexto.

#### 9.2 Estructura ↔ Comportamiento

**Polos:** Relaciones estaticas (Structural Links) vs relaciones dinamicas (Procedural Links).

**Adjuncion:**
```
Struct ⊣ Behav

Struct: C_OPM → C_OPM^struct    (olvidar enlaces procedurales)
Behav:  C_OPM → C_OPM^proc     (olvidar enlaces estructurales)
```

Estas son **sub-categorias de localizacion**: Struct "congela" la dinamica; Behav "olvida" la estructura.

**Path equation clave:**
```
La funcion del sistema = Struct ∩ Behav
```
Es decir, la funcion es el **pullback** de estructura y comportamiento:
```
    Function ──────> Behaviour
       |                 |
       |                 |
       v                 v
   Structure ──────> C_OPM
```

Function = Structure ×_{C_OPM} Behaviour

**Pregunta socratica:** Si la funcion del sistema es exactamente la interseccion de estructura y comportamiento, ¿puede existir funcion sin estructura? ¿Puede existir funcion sin comportamiento? La respuesta de OPM es NO a ambas: la funcion es siempre un par (proceso-principal, objeto-principal) — necesita a ambos.

#### 9.3 OPD ↔ OPL

**Polos:** Representacion grafica vs textual.

**Adjuncion:** (ver §6.3)
```
Render ⊣ Parse

Render: C_Fact → C_OPD
Parse:  C_OPD → C_Fact
```

**Pregunta socratica:** Si OPD y OPL son "completamente equivalentes", ¿por que necesitamos ambos? La respuesta esta en las **propiedades cognitivas**, no en las propiedades categoricas: OPD aprovecha la cognicion espacial; OPL aprovecha la cognicion linguistica. La equivalencia categorica es perfecta; la equivalencia cognitiva no lo es — cada modalidad activa circuitos cerebrales distintos.

#### 9.4 Abstraccion ↔ Completitud

**Polos:** Clarity (menos detalle) vs Completeness (mas detalle).

**Adjuncion:**
```
Truncate ⊣ Include

Truncate: C_OPM_n+1 → C_OPM_n    (subir un nivel = abstraer)
Include:  C_OPM_n → C_OPM_n+1    (bajar un nivel = refinar)
```

**Adjuncion en el OPD tree:**
```
Hom(Truncate(M_detail), M_abstract) ≅ Hom(M_detail, Include(M_abstract))
```

"Un morfismo de un modelo truncado a un modelo abstracto es lo mismo que un morfismo del modelo detallado al modelo abstracto incluido en el nivel detallado."

**Pregunta socratica:** ¿Existe un nivel optimo de abstraccion? OPM responde pragmaticamente: "cuando el OPD se vuelve dificil de comprender, crea un OPD descendiente". Pero categorcamente, el optimo es un **punto fijo** de la adjuncion Truncate ⊣ Include — el nivel donde truncar e incluir no cambian nada.

#### 9.5 Estatico ↔ Dinamico

**Polos:** Structural relations (invariantes) vs Procedural relations (transientes).

**Adjuncion:**
```
FixPoint ⊣ Unfold

FixPoint: C_OPM^dynamic → C_OPM^static    (encontrar los invariantes de la dinamica)
Unfold:   C_OPM^static → C_OPM^dynamic    (generar comportamiento desde estructura)
```

Equivalentemente:
```
Algebra ⊣ Coalgebra

Alg:   C_Coalg → C_Alg    (de coalgebra a su algebra final)
Coalg: C_Alg → C_Coalg    (de algebra a su coalgebra inicial)
```

**Pregunta socratica:** ¿Puede una structural relation "convertirse" en una procedural relation? En OPM estricto, no — los tipos de link son fijos. Pero en la practica de modelado, un objeto stateless puede convertirse en stateful (agregar estados = agregar dinamica a algo que era estatico). La frontera entre lo estatico y lo dinamico es **permeable** a traves del refinamiento.

#### 9.6 SD ↔ SD1

**Polos:** Vista de alto nivel (SD) vs primer nivel de detalle (SD1).

**Adjuncion:**
```
Abstract ⊣ Refine

Abstract: C_SD1 → C_SD    (colapsar detalle al nivel 0)
Refine:   C_SD → C_SD1    (expandir al nivel 1)
```

**NO es Initial ⊣ Terminal.** El SD es el objeto inicial del OPD tree, pero el SD1 NO es un objeto terminal. No hay un objeto terminal natural en el OPD tree — el refinamiento puede continuar indefinidamente. La relacion SD↔SD1 es un caso particular de la adjuncion Truncate ⊣ Include (§9.4).

**Pregunta socratica:** ¿Es el SD unico? Para un sistema dado, ¿puede haber multiples SDs igualmente validos? OPM no lo prohibe explicitamente, pero la practica de modelado asume un unico SD por sistema. Categorcamente, la unicidad del SD es la propiedad del **objeto inicial**: unico up to isomorfismo.

#### 9.7 Sistemico ↔ Ambiental

**Polos:** Dentro del limite del sistema (Systemic) vs fuera (Environmental).

**Adjuncion:**
```
Internalize ⊣ Externalize

Internalize: C_OPM^env → C_OPM^sys    (absorber entorno en sistema)
Externalize: C_OPM^sys → C_OPM^env    (expulsar parte del sistema al entorno)
```

El limite del sistema define un **subtopo** de C_OPM: la subcategoria de things sistemicos es una subcategoria reflexiva de C_OPM, y la adjuncion Internalize ⊣ Externalize es la adjuncion de reflexion.

**Pregunta socratica:** ¿Es el limite del sistema una propiedad del sistema o una decision del observador? OPM modela la afiliacion como un atributo generico con default Systemic — es claramente una decision de modelado. Pero el SD *define* el scope: todo lo que aparece en el SD con contorno solido es sistemico. ¿Que pasa si cambiamos la frontera? La respuesta: cambiamos la fibra Aff⁻¹(Systemic), lo que cambia el modelo entero.

---

### 10. Limites de OPM desde CT

#### 10.1 Que NO puede expresar OPM que CT si puede

1. **Morfismos de alto orden entre links.** OPM tiene things y links, pero no "links entre links" (2-morfismos genuinos). Los control modifiers son una forma limitada de 2-celda, pero no hay una 2-categoria explicita.

2. **Composicion horizontal.** OPM no tiene un concepto de composicion de procesos en paralelo con sincronizacion (como el producto tensorial de una categoria monoidal). Los operadores logicos AND/XOR/OR son una aproximacion, pero no tienen la estructura completa de un producto tensorial.

3. **Functores naturales.** OPM no tiene un concepto explicito de transformacion natural entre modelos. No se puede expresar "este modelo OPM se transforma en ese otro modelo OPM de manera coherente" dentro del formalismo de OPM.

4. **Limites y colimites generales.** OPM tiene agregacion (≈ producto) y generalizacion (≈ coproducto), pero no equalizers, pullbacks, o pushouts generales. El modelador puede simularlos, pero no hay notacion nativa.

5. **Recursion y tipos inductivos.** La auto-invocacion modela ciclos, pero no hay tipos inductivos genuinos (listas, arboles, numeros naturales como estructura de datos dentro del modelo).

6. **Dependent types / fibras parametricas.** El tipo de un object no puede depender del estado de otro object dentro del formalismo (seria un dependent type). Las state-specified links son una aproximacion limitada.

#### 10.2 Invariantes de CT que OPM viola

1. **Clausura bajo composicion.** En OPM, la composicion de un structural link con un procedural link no esta definida. En una categoria general, la composicion de cualesquiera dos morfismos composables esta definida. OPM NO es una categoria con composicion libre — es una **categoria con restricciones de tipo** sobre la composicion (similar a una multicategoria o una categoria tipada).

2. **Existencia de todos los limites/colimites.** C_OPM no tiene todos los limites ni todos los colimites. En particular, no tiene equalizadores para links procedurales arbitrarios.

3. **Hom-sets como conjuntos.** El principio de unicidad del enlace procedimental implica |Hom_proc(O, P)| ≤ 1. Esto NO viola CT (un preorden es una categoria donde |Hom| ≤ 1), pero es una restriccion fuerte que hace que la subcategoria procedimental sea un preorden.

#### 10.3 La unicidad del enlace procedimental: universal o ad-hoc

**Pregunta:** ¿Es el principio de unicidad del enlace procedimental un constraint categorcamente necesario o una convencion de diseño?

**Analisis:** En CT, no hay restriccion intrinseca sobre la cardinalidad de Hom(A, B). Un preorden (|Hom| ≤ 1) es perfectamente valido pero es una **eleccion de diseño**, no una necesidad.

La justificacion OPM es pragmatica: evitar ambiguedad semántica. Si un Object tuviera dos enlaces procedurales distintos al mismo Process, su rol seria ambiguo (¿es consumee y instrument a la vez?).

**Proposicion 10.1.** La unicidad es **ad-hoc pero bien motivada**. Categorcamente, es equivalente a decir que la subcategoria procedimental de C_OPM es un **preorden**. Esto simplifica el razonamiento pero limita la expresividad: no se puede modelar un objeto que tenga multiples roles simultaneos respecto al mismo proceso (e.g., un catalizador que es parcialmente consumido).

**Nota:** OPM SI permite que un Object tenga un enlace procedimental y adicionalmente un control modifier (e, c). Pero no dos enlaces procedurales base distintos.

#### 10.4 "Proceso debe transformar al menos un objeto": necesaria o convencion

**La regla OPM:** Un proceso debe estar conectado via transforming link a al menos un objeto o estado de objeto.

**Analisis categorico:** En CT, un morfismo puede existir sin "transformar" nada — un endomorfismo identidad "transforma" trivialmente. La regla OPM excluye procesos sin efecto observable.

**Proposicion 10.2.** La regla es una **convencion ontologica**, no una necesidad categorica. Equivale a decir que no hay procesos "vacios" (mortismos a/desde el objeto cero). Categorcamente, es la exclusion del **morfismo cero** de la subcategoria de transforming links.

La justificacion es fuerte: un proceso que no transforma ningun objeto no tiene efecto observable y por lo tanto no tiene razon de existir en el modelo. Es un principio de **economia ontologica** (navaja de Ockham aplicada a procesos).

---

### 11. Property Graph como Categoria de Almacenamiento

#### 11.1 El functor de implementacion

**Definicion 11.1** (Categoria de Property Graphs). Sea C_PG la categoria cuyos:
- Objetos: nodos con propiedades (key-value pairs).
- Morfismos: aristas etiquetadas con propiedades.
- Composicion: concatenacion de caminos.

**Definicion 11.2** (Functor de implementacion). Sea F: C_OPM → C_PG definido por:

**Sobre objetos:**
```
F(Object O) = Nodo con label "Object" y propiedades:
  {name, essence, perseverance, affiliation, is_systemic, ...}

F(Process P) = Nodo con label "Process" y propiedades:
  {name, essence, perseverance, affiliation, ...}

F(State s of O) = Nodo con label "State" y propiedades:
  {name, is_initial, is_final, is_default} + arista (:BELONGS_TO) → F(O)
```

**Sobre morfismos:**
```
F(consumption_link(O, P)) = Arista (:CONSUMES) de F(O) a F(P)
F(result_link(P, O))      = Arista (:YIELDS) de F(P) a F(O)
F(effect_link(O, P))      = Arista (:AFFECTS) de F(O) a F(P)  [+ arista inversa]
F(agent_link(O, P))       = Arista (:HANDLES) de F(O) a F(P)
F(instrument_link(O, P))  = Arista (:REQUIRES) de F(P) a F(O)
F(aggregation(W, Part))   = Arista (:CONSISTS_OF) de F(W) a F(Part)
F(exhibition(E, Feat))    = Arista (:EXHIBITS) de F(E) a F(Feat)
F(generalization(G, S))   = Arista (:IS_A) de F(S) a F(G)
F(classification(C, I))   = Arista (:INSTANCE_OF) de F(I) a F(C)
F(tagged_link(T1, T2, tag)) = Arista (:TAGGED {tag: tag}) de F(T1) a F(T2)
```

#### 11.2 Functor Information Loss

**Proposicion 11.1.** F: C_OPM → C_PG es **fiel pero no pleno**:
- Fiel: distintos elementos OPM se mapean a distintos elementos del grafo.
- No pleno: hay aristas posibles en C_PG que no corresponden a links validos de OPM (e.g., una arista :CONSUMES entre dos Objects).

**Informacion perdida por F:**

| Aspecto OPM | Perdido en C_PG | Razon |
|-------------|-----------------|-------|
| Principio de unicidad procedimental | Si, parcialmente | El PG no impone restriccion de cardinalidad nativa |
| OPD tree (jerarquia) | Si | El PG es plano — no tiene nocion intrinseca de niveles |
| Timeline de in-zooming | Si | Orden temporal se pierde si no se codifica como propiedad |
| Bimodalidad OPD↔OPL | Completamente | El PG no genera OPL ni OPD |
| Control modifiers (e, c) | Parcialmente | Se pueden codificar como propiedades de arista |
| Path equations | Si | El PG no verifica ecuaciones de camino |
| Semantica ECA | Si | El PG no ejecuta la semantica operacional |

**Proposicion 11.2.** Para recuperar la informacion perdida, se necesitan **functores adicionales**:

```
F_tree:   C_OPM → C_PG     [codificar OPD tree como nodos :OPD y aristas :REFINES]
F_time:   C_OPM → C_PG     [codificar timeline como propiedad 'order' en aristas]
F_constr: C_OPM → C_PG     [codificar constraints como nodos :Constraint]
F_eca:    C_OPM → C_PG     [codificar ECA como nodos :Event, :Condition, :Action]
```

El functor total seria:
```
F_total = F × F_tree × F_time × F_constr × F_eca : C_OPM → C_PG^5
```

#### 11.3 OPDs como fibras del Property Graph

**Definicion 11.3.** Modelar OPDs como subgrafos del property graph:

```
Cada OPD_i  →  Nodo :OPD {name, level, parent_opd}
Cada thing T visible en OPD_i  →  Arista (:VISIBLE_IN) de F(T) a Nodo_OPD_i
```

La fibracion OPD tree se traduce como:
```
:OPD {name: "SD"}  <-[:PARENT_OF]-  :OPD {name: "SD1a"}
:OPD {name: "SD"}  <-[:PARENT_OF]-  :OPD {name: "SD1b"}
:OPD {name: "SD1a"} <-[:PARENT_OF]- :OPD {name: "SD2a"}
```

La fibra π⁻¹(OPD_i) se recupera con la query:
```
MATCH (t)-[:VISIBLE_IN]->(opd:OPD {name: "SD1a"}) RETURN t
```

**Proposicion 11.3.** La estructura de property graph con nodos :OPD y aristas :VISIBLE_IN reconstituye la opfibracion §4.1, pero sin las garantias categoricas (el PG no verifica que la fibracion sea coherente — eso requiere validacion por software).

---

## PARTE III — SINTESIS CATEGORICA

---

### 12. C_OPM como Sistema Formal: Resumen Estructural

```
C_OPM
├── 0-celdas (Things)
│   ├── Obj (Objects)
│   │   ├── Physical / Informatical           [Essence]
│   │   ├── Stateful / Stateless              [Perseverance]
│   │   ├── Systemic / Environmental          [Affiliation]
│   │   └── Sub(O) = {States}                 [Subobjetos]
│   └── Proc (Processes)
│       ├── Physical / Informatical
│       ├── Synchronous / Asynchronous        [Composicion temporal]
│       └── Operations (Proc exhibidos por Obj)
│
├── 1-celdas (Links)
│   ├── Structural (invariantes temporales)
│   │   ├── Aggregation-Participation          [≈ Producto]
│   │   ├── Exhibition-Characterization        [Fibracion]
│   │   ├── Generalization-Specialization      [Functor de inclusion]
│   │   ├── Classification-Instantiation       [Free ⊣ Forget]
│   │   └── Tagged (user-defined)              [Profunctor]
│   ├── Procedural (dependientes del tiempo)
│   │   ├── Transforming
│   │   │   ├── Consumption    [Morfismo a ∅]
│   │   │   ├── Result         [Morfismo desde ∅]
│   │   │   └── Effect         [Endomorfismo mediado]
│   │   ├── Enabling
│   │   │   ├── Agent          [Comma category, polo humano]
│   │   │   └── Instrument     [Comma category, polo no-humano]
│   │   └── Invocation         [Proc → Proc]
│   └── Control (enriquecimiento de procedurales)
│       ├── Event modifier 'e'  [Monada de trigger]
│       └── Condition modifier 'c' [Monada Maybe/bypass]
│
├── 2-celdas (refinamientos de links)
│   ├── State-specification    [link → state-specified link]
│   └── Control modification   [link → event/condition link]
│
├── Fibraciones
│   ├── OPD Tree               [Opfibracion sobre I_OPD]
│   ├── Exhibition              [Fibracion C_Feature → C_OPM]
│   └── Clasificadores          [Functores a categorias discretas]
│
├── Adjunciones
│   ├── Free ⊣ Forget          [Classification-Instantiation]
│   ├── Render ⊣ Parse         [OPD ↔ OPL bimodalidad]
│   ├── Truncate ⊣ Include     [Abstraccion ↔ Completitud]
│   ├── Internalize ⊣ Externalize [Sistemico ↔ Ambiental]
│   └── Struct ⊣ Behav         [Estructura ↔ Comportamiento]
│
├── Coalgebra
│   └── ECA: S → Event × (Precond → S + 1)   [Coalgebra de comportamiento]
│
├── Path Equations
│   ├── PE-1: Conservacion de transformacion
│   ├── PE-2: Idempotencia del efecto trivial
│   ├── PE-3: Invariancia del enabler
│   └── PE-4: In-zoom = composicion secuencial
│
└── Constraints (no-categoricos, impuestos por OPM)
    ├── Unicidad del enlace procedimental     [|Hom_proc(O,P)| ≤ 1]
    ├── Proceso debe transformar ≥ 1 objeto   [No morfismos cero]
    ├── Segregacion Obj/Proc en structural     [Excepto Exhibition]
    └── Segregacion Obj↔Proc en procedural     [Excepto Invocation]
```

### 13. Diagrama Conmutativo Maestro de C_OPM

```
                                    C_OPM
                                   /  |  \
                           Struct /   |   \ Proc
                                /    |    \
                      C_OPM^struct   |   C_OPM^proc
                       /   |   \     |    /   |   \
                     Agg  Exh  Gen   |  Trans Enab Ctrl
                      |    |    |    |    |     |    |
                 Prod Fibr Incl |  Cons  Comma  Monad
                                |  Res
                                |  Eff
                                |
                           C_Fact (model facts)
                           /          \
                     Render            Render'
                     /                    \
                C_OPD (grafico)      C_OPL (textual)
                     \                    /
                     Parse            Parse'
                        \              /
                         C_Fact ≃ C_Fact


                 I_OPD (indice de diagramas)
                    |
               Fibracion π
                    |
               C_OPM_total = ∫ M (construccion de Grothendieck)


          S (espacio de estados global)
          |
     α (coalgebra ECA)
          |
          v
    Event × (Precond → S + 1)
```

### 14. Tabla de Adjunciones Explícitas

| # | L | R | L ⊣ R | Dominio OPM | Interpretacion |
|---|---|---|-------|-------------|----------------|
| A1 | Free | Forget | Free ⊣ Forget | Classification-Instantiation | Crear instancias ↔ abstraer a patrones |
| A2 | Render | Parse | Render ⊣ Parse | OPD ↔ Facts | Generar diagrama ↔ extraer semantica |
| A3 | Render' | Parse' | Render' ⊣ Parse' | OPL ↔ Facts | Generar texto ↔ extraer semantica |
| A4 | Truncate | Include | Truncate ⊣ Include | Niveles de abstraccion | Subir nivel ↔ bajar nivel |
| A5 | Internalize | Externalize | Int ⊣ Ext | Scope del sistema | Absorber al sistema ↔ expulsar al entorno |
| A6 | Struct | Behav | Struct ⊣ Behav | Estructura ↔ Comportamiento | Congelar dinamica ↔ olvidar estructura |
| A7 | Inzoom | Fold | (retraccion) | Refinamiento de things | Expandir ↔ colapsar (no adjuncion estricta) |
| A8 | StateSuppress | StateExpress | Suppress ⊣ Express | Visibilidad de estados | Ocultar ↔ revelar estados |

### 15. Functor Information Loss: Tabla Resumen

| Functor | Fuente | Destino | Info Conservada | Info Perdida |
|---------|--------|---------|-----------------|--------------|
| F_PG: C_OPM → C_PG | OPM | Property Graph | Things, links, propiedades | Constraints, ECA, bimodalidad, path equations |
| Petri: C_OPM → C_PN | OPM | Petri Nets | Transforming links, estados | Structural links, refinamiento, atributos genericos |
| UML: C_OPM → C_UML | OPM | UML | Things, relaciones | Bimodalidad, ontologia minima, ECA unificada |
| Parse: C_OPD → C_Fact | OPD | Facts | Semantica completa | Layout espacial, colores, posiciones |
| Parse': C_OPL → C_Fact | OPL | Facts | Semantica completa | Ordenamiento de sentencias, gramatica redundante |
| Truncate: C_n+1 → C_n | Nivel n+1 | Nivel n | Vista de alto nivel | Detalle de refinamiento |

---

## PARTE IV — PREGUNTAS ABIERTAS Y PROGRAMA DE INVESTIGACION

### 16. Preguntas que este analisis abre

1. **¿Es C_OPM cartesianamente cerrada?** Es decir, ¿existen objetos exponenciales [P, O] en C_OPM? Si existieran, representarian "el espacio de todos los procesos que transforman O" — un meta-proceso. OPM no tiene esta nocion, lo que sugiere que C_OPM NO es cartesianamente cerrada.

2. **¿Existe un clasificador de subobjetos Ω en C_OPM?** Si existiera, C_OPM seria un topos. Los estados como subobjetos de Objects sugieren un proto-clasificador, pero la restriccion de segregacion Obj/Proc probablemente impide un Ω global.

3. **¿Puede definirse un homology functor para C_OPM?** Los "agujeros" en un modelo OPM (things referenciados pero no definidos, procesos sin transformees) podrian detectarse via un functor de homologia. Esto seria un "auditor categorico" de modelos OPM.

4. **¿Cuál es la 2-categoria libre generada por los tipos de link de OPM?** Es decir, ¿cuál es la presentacion de C_OPM como categoria libre con generadores (tipos de link) y relaciones (path equations + constraints)?

5. **¿Puede extenderse OPM a una doble categoria?** Con Things como 0-celdas, structural links como morfismos horizontales, procedural links como morfismos verticales, y control modifiers como 2-celdas. Esto daria una formalizacion mas natural de la segregacion Struct/Proc.

6. **¿Es la coalgebra ECA final?** Si la coalgebra ECA (§5) es final en su categoria de coalgebras, entonces el comportamiento de todo sistema OPM se factoriza unicamente a traves de ella. Esto daria una semantica denotacional canonica para OPM.

7. **¿Puede implementarse la bimodalidad como un Galois connection?** Si Parse ⊣ Render con Parse ∘ Render = id, tendriamos un Galois connection (adjuncion entre preordenes). La semantica de "equivalencia completa" se formalizaria como una **Galois connection perfecta** (bijection on closed elements).

---

## Apendice A: Glosario de Correspondencias OPM ↔ CT

| Concepto OPM | Concepto CT | Seccion |
|-------------|-------------|---------|
| Thing | 0-celda (objeto de categoria) | §1 |
| Object | Objeto de C_Obj ⊂ C_OPM | §2.1 |
| Process | Objeto de C_Proc ⊂ C_OPM | §2.1 |
| State | Subobjeto (monomorfismo) | §2.2 |
| Attribute | Objeto en fibra de Exhibition | §2.3 |
| Operation | Objeto en profunctor ExhOp | §2.4 |
| Perseverance/Essence/Affiliation | Fibracion clasificadora | §2.5 |
| Link | 1-celda (morfismo) | §3 |
| Consumption link | Morfismo al objeto cero | §3.2 |
| Result link | Morfismo desde objeto cero | §3.2 |
| Effect link | Endomorfismo mediado | §3.2 |
| Agent/Instrument link | Objeto de comma category | §3.3 |
| Event modifier | Monada de trigger | §3.4 |
| Condition modifier | Monada Maybe | §3.4 |
| Aggregation-Participation | Producto (limite) | §3.5.1 |
| Exhibition-Characterization | Fibracion | §3.5.2 |
| Generalization-Specialization | Functor de inclusion + pullback | §3.5.3 |
| Classification-Instantiation | Free ⊣ Forget | §3.5.4 |
| Tagged structural link | Profunctor | §3.5.5 |
| OPD Tree | Opfibracion sobre I_OPD | §4 |
| In-zooming | Retraccion (cuasi-adjuncion) | §4.2 |
| Unfolding | Colimite | §4.3 |
| SD | Objeto inicial de I_OPD | §4.4 |
| ECA | Coalgebra S → F(S) | §5 |
| Preprocess/Postprocess sets | Functores Pre, Post | §5.4 |
| Evento perdido | Absorcion del cero en logica lineal | §5.5 |
| Bimodalidad OPD↔OPL | Lens bidireccional / equivalencia up-to | §6 |
| Procedimiento de modelado | Colimite de cadena en C_Partial | §7 |

---

## Apendice B: Notacion Utilizada

| Simbolo | Significado |
|---------|-------------|
| C_OPM | Categoria OPM |
| Ob(C) | Objetos de la categoria C |
| Hom(A,B) | Morfismos de A a B |
| ⊔ | Coproducto (union disjunta) |
| × | Producto |
| ↪ | Monomorfismo (inclusion) |
| ⊣ | Adjuncion (L ⊣ R significa L es adjunto izquierdo de R) |
| ≃ | Equivalencia de categorias |
| ≅ | Isomorfismo |
| π | Fibracion / proyeccion |
| ∅ | Objeto inicial / vacio |
| 1 | Objeto terminal |
| ∫ | Construccion de Grothendieck |
| St(O) | Functor de estados |
| Sub(O) | Reticulado de subobjetos |
| F(S) | Aplicacion de functor F a S |
| (A ↓ B) | Comma category |
| C^op | Categoria opuesta |

---

*Fin del analisis categorico 360 de OPM (ISO 19450).*
*Producido por fxsl/arquitecto-categorico, 2026-03-10.*
