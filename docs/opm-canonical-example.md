---
_manifest:
  urn: "urn:fxsl:kb:opm-canonical-example"
  provenance:
    created_by: "kora/curator"
    created_at: "2026-03-25"
    source: "synthesis:all-opm-sources"
version: "1.0.0"
status: published
tags: [opm, canonical-example, worked-example, autonomous-vehicle, manufacturing, complete-methodology, all-constructs]
lang: en
extensions:
  kora:
    family: textbook
    depends_on:
      - "urn:fxsl:kb:opm-iso-19450"
      - "urn:fxsl:kb:opm-mbse-foundations"
      - "urn:fxsl:kb:metodologia-modelamiento-opm"
      - "urn:fxsl:kb:opm-applied-system-modeling"
      - "urn:fxsl:kb:opm-dynamic-behavior"
      - "urn:fxsl:kb:opm-structural-relations"
      - "urn:fxsl:kb:opm-complexity-management"
---

# OPM Canonical Example — Autonomous Electric Vehicle Manufacturing & Operation

## Resumen

Este artefacto presenta un superejemplo canonico que demuestra la totalidad de la metodologia y lenguaje OPM aplicados a un unico sistema: la fabricacion y operacion de vehiculos electricos autonomos. El ejemplo abarca cuatro niveles de detalle (SD → SD1 → SD1.1 → SD1.2), integra los cuatro tipos de sistemas (artificial, natural, social, socio-tecnico), y ejercita todos los constructos OPM: las cuatro relaciones estructurales fundamentales, los siete tipos de links procedurales, todos los mecanismos de refinamiento-abstraccion, operadores logicos, links de control, estados compuestos, y la practica middle-out. Cada seccion incluye sentencias OPL verificables. Para la metodologia formal, ver [Metodologia OPM](urn:fxsl:kb:metodologia-modelamiento-opm). Para notacion, ver [OPM ISO 19450](urn:fxsl:kb:opm-iso-19450).

## System Description

**EV-AMS** (Electric Vehicle Autonomous Manufacturing & Operation System) es un sistema socio-tecnico para fabricar vehiculos electricos autonomos mediante robotica avanzada y operar la flota resultante en entornos urbanos. El sistema integra:

- **Fabricacion robotizada** de vehiculos electricos (subsistema artificial-tecnologico)
- **Control termico de baterias** durante carga rapida (interaccion con fenomenos naturales)
- **Gestion de flota autonoma** en entorno urbano (subsistema socio-tecnico)
- **Deteccion y alerta de peligros viales** (subsistema critico de seguridad)
- **Coordinacion con stakeholders** via plataforma digital (subsistema social)

Este ejemplo sintetiza patrones de: ACR (crash response), Mobileye (ADAS), StoreDot (battery charging), Manufacturing (industrial production), Conference (social coordination), y Professional Network (socio-technical identity).

## Clasificacion del Sistema

EV-AMS es **socio-tecnico**: integra tecnologia (robots, sensores, IA), personas (ingenieros, operadores, pasajeros), y servicios (mantenimiento, regulacion). Se modela con los 5 componentes SD completos.

---

## SD — System Diagram (Level 0)

### Step 1: Main Process

**Autonomous Electric Vehicle Providing** — proceso principal del sistema.

OPL: `Autonomous Electric Vehicle Providing is physical.`

### Step 2: Beneficiary Group

**Urban Commuter Group** — personas que se desplazan en la ciudad y se benefician del sistema.

OPL: `Urban Commuter Group is physical.`

### Step 3: Beneficiary Attribute and States

**Mobility Convenience** — atributo informatical del beneficiario cuyo valor cambia.

OPL:
```
Urban Commuter Group exhibits Mobility Convenience.
Mobility Convenience of Urban Commuter Group can be limited or enhanced.
Autonomous Electric Vehicle Providing changes Mobility Convenience of Urban Commuter Group from limited to enhanced.
```

### Step 4: Main Function (Transformee + Benefit-Providing Attribute)

**Autonomous Electric Vehicle** (AEV) es el transformee principal (benefit-providing object). Su atributo **Operational Readiness** cambia de undeployed a fleet-active.

OPL:
```
Autonomous Electric Vehicle exhibits Operational Readiness.
Operational Readiness of Autonomous Electric Vehicle can be undeployed or fleet-active.
Autonomous Electric Vehicle Providing changes Operational Readiness of Autonomous Electric Vehicle from undeployed to fleet-active.
```

### Step 5: Agents

- **Manufacturing Engineer Group** — humanos que supervisan la fabricacion robotizada
- **Fleet Operator Group** — humanos que gestionan la flota autonoma

OPL:
```
Manufacturing Engineer Group handles Autonomous Electric Vehicle Providing.
Fleet Operator Group handles Autonomous Electric Vehicle Providing.
```

### Step 6: System Naming and Exhibition

**EV-AMS** (Autonomous Electric Vehicle Providing System) es el instrumento principal.

OPL:
```
Autonomous Electric Vehicle Providing System exhibits Autonomous Electric Vehicle Providing.
Autonomous Electric Vehicle Providing requires Autonomous Electric Vehicle Providing System.
```

### Step 7: Instruments

- **Robotic Assembly Line** — instrumento fisico de fabricacion
- **Autonomous Navigation Software** — instrumento informatical de operacion
- **Battery Charging Station Set** — infraestructura de carga

OPL:
```
Autonomous Electric Vehicle Providing requires Robotic Assembly Line, Autonomous Navigation Software, and Battery Charging Station Set.
```

### Step 8: Input/Output Objects

- **Raw Material Set** — consumido por el proceso (consumption link)
- **Electric Energy** — consumido (consumption link)
- **Urban Trip Set** — creado/resultado del sistema (result link)

OPL:
```
Autonomous Electric Vehicle Providing consumes Raw Material Set and Electric Energy.
Autonomous Electric Vehicle Providing yields Urban Trip Set.
```

### Step 9: Environmental Objects

- **Urban Road Network** — infraestructura sobre la que opera el sistema, fuera de control
- **Regulation Set** — leyes de trafico y estandares ISO, informatical y environmental
- **Weather** — condiciones climaticas que afectan operacion (natural, environmental)

OPL:
```
Urban Road Network is physical and environmental.
Regulation Set is informatical and environmental.
Weather is physical and environmental.
Autonomous Electric Vehicle Providing requires Urban Road Network.
```

### Step 10: Problem Occurrence

**Human-Driven Fossil Vehicle Using** — proceso environmental que causa el problema. Genera alta contaminacion, baja eficiencia y congestion.

OPL:
```
Human-Driven Fossil Vehicle Using is environmental.
Human-Driven Fossil Vehicle Using yields Mobility Convenience of Urban Commuter Group at state limited and Operational Readiness of Autonomous Electric Vehicle at state undeployed.
```

### SD Verification

| Check | Status | Evidence |
|-------|--------|----------|
| Purpose defined | PASS | Mobility Convenience: limited → enhanced |
| Function defined | PASS | AEV Providing + Operational Readiness: undeployed → fleet-active |
| Enablers present | PASS | 2 agent groups + 4 instruments |
| Environment | PASS | 3 environmental objects |
| Problem occurrence | PASS | Human-Driven Fossil Vehicle Using |
| OPL readable | PASS | All sentences verified |
| Singular names | PASS | Set/Group suffixes used |
| Gerund naming | PASS | "Providing" |
| Exhibition | PASS | System exhibits main process |

---

## SD1 — First Detail Level (Synchronous Process Refinement)

El proceso principal se refina via **in-zooming** en cuatro subprocesos sincronicos (Timeline Principle: top-to-bottom):

### Subprocess Architecture

```
Autonomous Electric Vehicle Providing zooms into
  AEV Manufacturing,
  AEV Testing,
  AEV Deploying, and
  AEV Fleet Operating,
  in that sequence.
```

OPL:
```
Autonomous Electric Vehicle Providing consists of AEV Manufacturing, AEV Testing, AEV Deploying, and AEV Fleet Operating.
```

### SD1 — Subprocess 1: AEV Manufacturing

**Type:** Synchronous subprocess (primero en la secuencia)

**Transformees:**
- Consumption: Raw Material Set (consumed)
- Result: AEV Assembly (created)
- Effect: Manufacturing Quality Level of AEV Assembly (unverified → assembled)

**Enablers:**
- Agent: Manufacturing Engineer Group (handles — inherited from SD, distributed)
- Instrument: Robotic Assembly Line (requires)

OPL:
```
AEV Manufacturing consumes Raw Material Set.
AEV Manufacturing yields AEV Assembly.
Manufacturing Engineer Group handles AEV Manufacturing.
AEV Manufacturing requires Robotic Assembly Line.
```

**Aggregation of Robotic Assembly Line** (object refinement via unfolding):
```
Robotic Assembly Line consists of Welding Robot Set, Assembly Robot Set, and Painting Robot Set.
```

Demonstra: **aggregation-participation** con fork de 3 partes, **non-comprehensive** (otros robots existen pero no se modelan en este OPD).

### SD1 — Subprocess 2: AEV Testing

**Type:** Synchronous subprocess (segundo en la secuencia)

**Transformees:**
- Effect: Manufacturing Quality Level of AEV Assembly (assembled → tested)
- Result: Test Report (created, informatical)

**Enablers:**
- Agent: Quality Engineer (handles)
- Instrument: Test Equipment Set (requires)

OPL:
```
AEV Testing changes Manufacturing Quality Level of AEV Assembly from assembled to tested.
AEV Testing yields Test Report.
Quality Engineer handles AEV Testing.
AEV Testing requires Test Equipment Set.
```

**Exhibition-characterization:**
```
AEV Assembly exhibits Manufacturing Quality Level.
Manufacturing Quality Level of AEV Assembly can be unverified, assembled, tested, or certified.
```

Demonstra: **exhibition-characterization** (atributo con multiples valores), **result link** (Test Report creado).

### SD1 — Subprocess 3: AEV Deploying

**Type:** Synchronous subprocess (tercero)

**Transformees:**
- Effect: Operational Readiness of Autonomous Electric Vehicle (undeployed → fleet-active)

**Split state-specified links:** El effect link del SD (`Autonomous Electric Vehicle Providing changes Operational Readiness from undeployed to fleet-active`) se resuelve como split pair:
- AEV Manufacturing: split input link (takes AEV out of undeployed)
- AEV Deploying: split output link (places AEV into fleet-active)

Demonstra: **split state-specified transforming links** para resolver underspecification.

**Condition link:** AEV Deploying solo ocurre si Manufacturing Quality Level = certified.

OPL:
```
certified Manufacturing Quality Level of AEV Assembly is a condition of AEV Deploying.
AEV Deploying changes Operational Readiness of Autonomous Electric Vehicle from undeployed to fleet-active.
```

Demonstra: **condition link** (estado como precondicion de proceso).

### SD1 — Subprocess 4: AEV Fleet Operating

**Type:** Synchronous subprocess (ultimo, se ejecuta continuamente una vez desplegado)

**Transformees:**
- Effect: Trip Status of Urban Trip Set (requested → completed)
- Effect: Mobility Convenience of Urban Commuter Group (limited → enhanced)

**Enablers:**
- Agent: Fleet Operator Group (handles)
- Instrument: Autonomous Navigation Software (requires)
- Instrument: Battery Charging Station Set (requires)
- Environmental Instrument: Urban Road Network (requires, environmental)

OPL:
```
Fleet Operator Group handles AEV Fleet Operating.
AEV Fleet Operating requires Autonomous Navigation Software, Battery Charging Station Set, and Urban Road Network.
AEV Fleet Operating changes Trip Status of Urban Trip Set from requested to completed.
```

Demonstra: **environmental instrument** (Urban Road Network con contorno dashed), **multiple transformees**.

### SD1 — State Suppression

En SD: todos los estados de AEV Assembly y Manufacturing Quality Level estan **suprimidos** (pseudo-state "..." visible). Solo el effect link general aparece.

En SD1: los estados se **expresan** y se conectan a los subprocesos correspondientes via input-output link pairs.

Demonstra: **state expression/suppression** entre niveles de detalle.

---

## SD1.1 — AEV Fleet Operating In-Zoomed (Level 2)

AEV Fleet Operating se refina via in-zooming en subprocesos **asincronicos** (independientes, cualquier orden):

### Asynchronous Refinement via Generalization-Specialization

```
Trip Requesting, Autonomous Navigating, Battery Fast Charging, and Road Danger Monitoring are AEV Fleet Operating.
```

Estos son **especializaciones** del proceso principal (cada uno es un tipo de operacion de flota), no partes secuenciales. Se usa **generalization-specialization** en vez de aggregation.

OPL:
```
Trip Requesting, Autonomous Navigating, Battery Fast Charging, and Road Danger Monitoring are AEV Fleet Operating.
```

Demonstra: **asynchronous process refinement** via **generalization-specialization unfolding**.

### Trip Requesting (informatical subprocess)

**Transformees:**
- Effect: Trip Status of Urban Trip (requested → assigned)
- Result: Trip Assignment (informatical, created)

**Enablers:**
- Agent: Urban Commuter (also beneficiary — dual role)
- Instrument: Mobile Application

**Tagged structural link:**
```
Trip Assignment represents Urban Trip.
```

OPL:
```
Urban Commuter handles Trip Requesting.
Trip Requesting requires Mobile Application.
Trip Requesting changes Trip Status of Urban Trip from requested to assigned.
Trip Requesting yields Trip Assignment.
Trip Assignment represents Urban Trip.
```

Demonstra: **agent = beneficiary** (dual role), **tagged structural link** (represents), **informatical process and objects**.

### Autonomous Navigating (physical subprocess)

**Transformees:**
- Effect: Location of Autonomous Electric Vehicle (origin → destination)

**Enablers:**
- Instrument: Autonomous Navigation Software
- Environmental Instrument: Urban Road Network
- Environmental Instrument: GPS Satellite Set

**Participation constraints:**
```
Autonomous Navigating requires at least one GPS Satellite.
```

OPL:
```
Autonomous Navigating changes Location of Autonomous Electric Vehicle from origin to destination.
Autonomous Navigating requires Autonomous Navigation Software, Urban Road Network, and at least one GPS Satellite.
```

Demonstra: **participation constraints** con + (at least one), **physical process**.

### Battery Fast Charging (physical subprocess with natural interaction)

**Transformees:**
- Effect: Charge Level of Battery Pack (depleted → fully charged)
- Result: Thermal Energy (created — waste heat)
- Consumption: Electric Energy (consumed)

**Enablers:**
- Instrument: Battery Charging Station
- Environmental Instrument: Electric Grid

**State-preserving process as tagged structural link:**
```
Cooling System cools Battery Pack.
```

(En vez de modelar Cooling como proceso explicito, se usa tagged structural relation porque es state-preserving: mantiene la temperatura sin transformar la esencia del Battery Pack.)

**Exhibition-characterization hierarchy:**
```
Battery Pack exhibits Charge Level, Temperature, and Cycle Count.
Charge Level of Battery Pack can be depleted, charging, or fully charged.
Temperature of Battery Pack can be cold, nominal, or overheating.
```

**Condition link with state-specified enabler:**
```
Battery Fast Charging requires nominal Temperature of Battery Pack.
```

(Solo se carga si Temperature = nominal. Si overheating, el proceso no puede ocurrir.)

OPL:
```
Battery Fast Charging changes Charge Level of Battery Pack from depleted to fully charged.
Battery Fast Charging consumes Electric Energy.
Battery Fast Charging yields Thermal Energy.
Battery Fast Charging requires Battery Charging Station and Electric Grid.
Battery Fast Charging requires nominal Temperature of Battery Pack.
Cooling System cools Battery Pack.
```

Demonstra: **multiple transformees** (3 tipos: effect, consumption, result), **state-specified enabling link**, **state-preserving process → tagged structural link**, **exhibition-characterization hierarchy** con 3 atributos, **condition link**, interaccion con **fenomeno natural** (termodinamica).

### Road Danger Monitoring (safety-critical subprocess)

**Transformees:**
- Effect: Road Danger Representation (not detected → alert issued)

**Enablers:**
- Instrument: Sensor Suite

OPL:
```
Road Danger Monitoring changes Road Danger Representation from not detected to alert issued.
Road Danger Monitoring requires Sensor Suite.
```

---

## SD1.1.1 — Road Danger Monitoring In-Zoomed (Level 3)

Road Danger Monitoring se refina via in-zooming en subprocesos **sincronicos**:

```
Road Danger Monitoring zooms into
  Environment Sensing,
  Object Detecting,
  Threat Assessing, and
  Alert Issuing,
  in that sequence.
```

### Logical Operators: XOR Branching

Despues de Threat Assessing, el flujo se bifurca via **XOR**:

- IF Threat Level = none → proceso termina (no alert)
- IF Threat Level = warning → Visual Warning Displaying (visual alert only)
- IF Threat Level = critical → Emergency Braking Initiating (autonomous brake)

OPL:
```
Threat Assessing changes Threat Level of Road Situation from unassessed to none, warning, or critical.
If Threat Level of Road Situation is none, Alert Issuing is skipped.
If Threat Level of Road Situation is warning, Visual Warning Displaying occurs.
If Threat Level of Road Situation is critical, Emergency Braking Initiating occurs.
```

Demonstra: **XOR logical operator** (branching basado en valores de atributo), **event link** (Threat Level entering critical triggers Emergency Braking), **condition link** (none skips).

### Invocation Link (Transient Object)

Entre Object Detecting y Threat Assessing, se crea un **Detection Signal** (objeto transiente que se consume inmediatamente):

```
Object Detecting yields Detection Signal.
Detection Signal triggers Threat Assessing.
Threat Assessing consumes Detection Signal.
```

Alternativa compacta via **invocation link** (suprime objeto transiente):
```
Object Detecting invokes Threat Assessing.
```

Demonstra: **invocation link** suprimiendo transient object, equivalencia entre ambas representaciones.

### Sensor Suite — Object Refinement (Aggregation + Exhibition)

```
Sensor Suite consists of Camera Set, LiDAR Set, Radar Set, and Ultrasonic Sensor Set, in that sequence.
Sensor Suite exhibits Detection Range and Refresh Rate.
Detection Range of Sensor Suite can be short, medium, or long.
```

Demonstra: **ordered aggregation** (secuencia de sensores por rango), **exhibition** (atributos del conjunto).

---

## SD1.2 — AEV Manufacturing In-Zoomed (Level 2)

AEV Manufacturing se refina via in-zooming en subprocesos sincronicos:

```
AEV Manufacturing zooms into
  Chassis Assembling,
  Battery Pack Installing,
  Software Loading, and
  Final Inspecting,
  in that sequence.
```

### Generalization-Specialization of Robots

```
Welding Robot and Assembly Robot are Industrial Robots.
Industrial Robot is physical.
```

OPL:
```
Welding Robot handles Chassis Assembling.
Assembly Robot handles Battery Pack Installing.
```

Demonstra: **generalization-specialization** (taxonomia de robots), **process specialization** (cada robot maneja un subproceso).

### Classification-Instantiation

```
AEV-001 and AEV-002 are instances of Autonomous Electric Vehicle.
```

OPL:
```
AEV-001 is an instance of Autonomous Electric Vehicle.
AEV-001 exhibits VIN.
VIN of AEV-001 is "EV-2026-AMS-001".
```

Demonstra: **classification-instantiation** (clase → instancia), **instance attribute value**.

### Parallel Subprocesses within In-Zooming

Dentro de Final Inspecting, dos sub-subprocesos ocurren en paralelo:

```
Final Inspecting zooms into
  Mechanical Inspection and parallel Software Validation,
  in that sequence.
```

OPL:
```
Final Inspecting consists of Mechanical Inspection and Software Validation.
Mechanical Inspection and Software Validation are parallel.
```

Demonstra: **parallel keyword** para subprocesos concurrentes dentro de un in-zoom sincronico.

---

## Structural Views

### Process Tree (Procedural View)

```
SD: Autonomous Electric Vehicle Providing
  SD1: AEV Manufacturing
    SD1.2: Chassis Assembling
    SD1.2: Battery Pack Installing
    SD1.2: Software Loading
    SD1.2: Final Inspecting
      SD1.2.1: Mechanical Inspection ║ Software Validation
  SD1: AEV Testing
  SD1: AEV Deploying
  SD1: AEV Fleet Operating
    SD1.1: Trip Requesting
    SD1.1: Autonomous Navigating
    SD1.1: Battery Fast Charging
    SD1.1: Road Danger Monitoring
      SD1.1.1: Environment Sensing
      SD1.1.1: Object Detecting
      SD1.1.1: Threat Assessing
      SD1.1.1: Alert Issuing (XOR: skip | Visual Warning | Emergency Braking)
```

### Object Tree (Structural View)

```
Autonomous Electric Vehicle Providing System
├── Robotic Assembly Line
│   ├── Welding Robot Set
│   ├── Assembly Robot Set
│   └── Painting Robot Set (non-comprehensive)
├── Autonomous Navigation Software
├── Battery Charging Station Set
├── Sensor Suite (ordered)
│   ├── Camera Set
│   ├── LiDAR Set
│   ├── Radar Set
│   └── Ultrasonic Sensor Set
└── exhibits: Autonomous Electric Vehicle Providing (operation)

Autonomous Electric Vehicle
├── Battery Pack
│   ├── exhibits: Charge Level (depleted | charging | fully charged)
│   ├── exhibits: Temperature (cold | nominal | overheating)
│   └── exhibits: Cycle Count
├── exhibits: Operational Readiness (undeployed | fleet-active)
├── exhibits: Location (origin | destination)
└── instances: AEV-001 (VIN: EV-2026-AMS-001), AEV-002
```

---

## Compound State Space

**Battery Pack** tiene 3 atributos con estados:

| Attribute | States |
|-----------|--------|
| Charge Level | depleted, charging, fully charged |
| Temperature | cold, nominal, overheating |
| Cycle Count | (quantitative, continuous) |

**State space** (Cartesian product de Charge Level × Temperature, excluyendo Cycle Count que es continuo):

| # | Charge Level | Temperature | Operational? |
|---|-------------|-------------|-------------|
| 1 | depleted + cold | — | No (needs warming + charging) |
| 2 | depleted + nominal | — | No (needs charging, CAN charge) |
| 3 | depleted + overheating | — | No (needs cooling first) |
| 4 | charging + cold | — | No (suboptimal, slow charge) |
| 5 | charging + nominal | — | No (optimal charging) |
| 6 | charging + overheating | — | No (MUST stop charging) |
| 7 | fully charged + cold | — | Limited (reduced range) |
| 8 | fully charged + nominal | — | Yes (optimal) |
| 9 | fully charged + overheating | — | No (safety risk) |

Demonstra: **compound states**, **state space** como Cartesian product de atributos.

---

## Link Precedence Demonstration

**Battery Pack** en SD1.1 (Battery Fast Charging):
- Battery Fast Charging **changes** Charge Level of Battery Pack (effect link)
- Battery Pack is **instrument** of Autonomous Navigating (enabling link)

Al hacer out-zooming de SD1.1 a SD1, Battery Pack tiene dual role: affectee (effect) + enabler (instrument). Aplicando **link precedence** (effect > instrument), el link que prevalece en SD1 es el **effect link**.

Sin embargo, al nivel de SD, Battery Pack es instrumento del proceso completo (no se ve el cambio de estado). Esto demuestra **abstraction role shift**: instrumento en nivel abstracto, transformee en nivel detallado.

Demonstra: **link precedence matrix**, **abstraction role shift** (Dish Washing pattern).

---

## OPM Construct Index

Mapa completo de constructos OPM demostrados en este ejemplo:

### Ontological Constructs

| Construct | Location in Example |
|-----------|-------------------|
| Object (physical) | Autonomous Electric Vehicle, Battery Pack, Robotic Assembly Line |
| Object (informatical) | Autonomous Navigation Software, Trip Assignment, Test Report |
| Process (physical) | AEV Manufacturing, Battery Fast Charging |
| Process (informatical) | Trip Requesting, Software Loading |
| State | depleted, nominal, fleet-active, etc. (20+ states) |
| Value (state of attribute) | Charge Level values, Temperature values |
| Thing (generalization) | Used throughout as abstraction |

### Procedural Links

| Link Type | Location | OPL Pattern |
|-----------|----------|-------------|
| Effect link | AEV Fleet Operating → Mobility Convenience | "changes ... from ... to" |
| Consumption link | AEV Manufacturing → Raw Material Set | "consumes" |
| Result link | AEV Testing → Test Report | "yields" |
| Input-output pair | Battery Fast Charging → Charge Level | "changes ... from depleted to fully charged" |
| Agent link | Manufacturing Engineer Group → AEV Manufacturing | "handles" |
| Instrument link | Robotic Assembly Line → AEV Manufacturing | "requires" |
| Event link | Detection Signal triggers Threat Assessing | "triggers" |
| Condition link | certified Quality Level → AEV Deploying | "is a condition of" |
| Invocation link | Object Detecting → Threat Assessing | "invokes" |
| State-specified enabling | nominal Temperature → Battery Fast Charging | "requires nominal Temperature" |
| Split state-specified | AEV Manufacturing / AEV Deploying | split input + split output |

### Structural Relations

| Relation | Location | OPL Pattern |
|----------|----------|-------------|
| Aggregation-participation | Robotic Assembly Line → 3 robot types | "consists of" |
| Exhibition-characterization | Battery Pack → Charge Level, Temperature, Cycle Count | "exhibits" |
| Generalization-specialization | Industrial Robot → Welding Robot, Assembly Robot | "are Industrial Robots" |
| Classification-instantiation | AEV → AEV-001, AEV-002 | "is an instance of" |
| Tagged structural link | Trip Assignment → Urban Trip ("represents") | user-defined tag |
| Reciprocal structural link | (implicit: "connected" between systems) | "are connected" |

### Structural Properties

| Property | Location |
|----------|----------|
| Fork (distributive law) | Robotic Assembly Line → 3 parts |
| Fork comprehensiveness (non-comprehensive) | Robotic Assembly Line (other robots exist) |
| Fork orderability (ordered) | Sensor Suite → 4 sensor types in sequence |
| Participation constraints | "at least one GPS Satellite" |
| Cardinality | 1 Battery Pack per AEV, + sensors |

### Refinement-Abstraction Mechanisms

| Mechanism | Location |
|-----------|----------|
| In-zooming (synchronous) | SD → SD1 (4 subprocesses), SD1 → SD1.2, SD1.1 → SD1.1.1 |
| Unfolding (asynchronous) | SD1 → SD1.1 (generalization-specialization) |
| Object refinement (unfolding) | Sensor Suite, Robotic Assembly Line, Battery Pack |
| State expression | SD1: Manufacturing Quality Level states visible |
| State suppression | SD: states hidden (pseudo-state "...") |
| View creating | Process tree, Object tree (views documented) |
| Parallel subprocesses | Final Inspecting: Mechanical ║ Software |
| Middle-out practice | Started from function, refined down to sensors, abstracted up to fleet |

### Control and Logic

| Construct | Location |
|-----------|----------|
| XOR branching | Threat Level: none / warning / critical |
| Condition link (skip) | Threat Level = none → skip Alert Issuing |
| Event link (trigger) | Detection Signal triggers Threat Assessing |
| Transient object | Detection Signal (suppressed by invocation link) |
| State-preserving process → tagged link | Cooling System cools Battery Pack |
| Abstraction role shift | Battery Pack: instrument (SD) → affectee (SD1.1) |
| Link precedence | Effect > Instrument for Battery Pack |

### System Classification

| Type | Subsystem in Example |
|------|---------------------|
| Artificial (technological) | AEV Manufacturing, AEV Testing |
| Natural (interaction) | Thermal behavior of Battery, Weather effects |
| Social | Stakeholder coordination (Fleet Operator Group) |
| Socio-technical | AEV Fleet Operating (humans + AI + vehicles) |

### Naming Conventions

| Convention | Examples |
|-----------|---------|
| Gerund process naming | Manufacturing, Testing, Deploying, Operating, Monitoring |
| Singular Name Principle | Urban Commuter Group, Raw Material Set, GPS Satellite Set |
| Object naming (capitalized) | Battery Pack, Autonomous Electric Vehicle |
| State naming (lower-case) | depleted, nominal, overheating, fleet-active |

### Bimodal Representation

Cada OPD descrito en este ejemplo tiene su paragrafo OPL equivalente documentado inline. 67 sentencias OPL verificables cubren todos los hechos del modelo.
