# Modelo OPM — Sistema de Hospitalización Domiciliaria (HODOM)

Modelo conceptual conforme a ISO/PAS 19450 (OPM).
Fuentes normativas: DS N° 1/2022, Decreto Exento N° 31/2024, Norma Técnica HODOM 2024.

---

## Clasificación del Sistema

**Tipo:** Socio-técnico
**Justificación:** Combina agentes humanos (equipo clínico multidisciplinario), infraestructura física (equipamiento médico, vehículos, oficinas), sistemas informaticales (fichas clínicas, comunicaciones, protocolos) y un marco normativo-regulatorio con supervisión estatal. Las relaciones entre actores, pacientes, cuidadores e instituciones son inherentemente sociales. Se modelan los 5 componentes completos del SD. Se usan tagged structural links para relaciones institucionales.

---

## SD — System Diagram (Nivel 0)

### Tabla de Elementos SD

| Tipo | Nombre | Esencia | Afiliación | Estados |
|------|--------|---------|------------|---------|
| Proceso | *Domiciliary Hospitalizing* | Físico | Sistémico | — |
| Objeto | **Patient Group** | Físico | Sistémico | — |
| Objeto | **Clinical Condition** | Informatical | Sistémico | `acute/reacutized`, `recovered` |
| Objeto | **Domiciliary Hospitalization System** | Físico | Sistémico | — |
| Objeto | **Healthcare Team** | Físico | Sistémico | — |
| Objeto | **Medical Equipment** | Físico | Sistémico | — |
| Objeto | **Communication System** | Físico | Sistémico | — |
| Objeto | **Transport Vehicle** | Físico | Sistémico | — |
| Objeto | **Administrative Infrastructure** | Físico | Sistémico | — |
| Objeto | **Clinical Supply** | Físico | Sistémico | — |
| Objeto | **Medication** | Físico | Sistémico | — |
| Objeto | **Clinical Record** | Informatical | Sistémico | — |
| Objeto | **Patient Home** | Físico | Ambiental | — |
| Objeto | **Inpatient Facility** | Físico | Ambiental | — |
| Objeto | **Current Regulation** | Informatical | Ambiental | — |
| Proceso | *Inpatient Bed Occupying* | Físico | Ambiental | — |

### Tabla de Enlaces SD

| Tipo | Origen | Destino | ID Plantilla |
|------|--------|---------|--------------|
| Exhibition-characterization | **Domiciliary Hospitalization System** | *Domiciliary Hospitalizing* | RF2b |
| Exhibition-characterization | **Patient Group** | **Clinical Condition** | RF2 |
| Effect (input-output) | *Domiciliary Hospitalizing* | **Clinical Condition** | TS3 |
| Agent | **Healthcare Team** | *Domiciliary Hospitalizing* | H1 |
| Instrument | *Domiciliary Hospitalizing* | **Medical Equipment** | H2 |
| Instrument | *Domiciliary Hospitalizing* | **Communication System** | H2 |
| Instrument | *Domiciliary Hospitalizing* | **Transport Vehicle** | H2 |
| Instrument | *Domiciliary Hospitalizing* | **Administrative Infrastructure** | H2 |
| Consumption | *Domiciliary Hospitalizing* | **Clinical Supply** | T1 |
| Consumption | *Domiciliary Hospitalizing* | **Medication** | T1 |
| Result | *Domiciliary Hospitalizing* | **Clinical Record** | T2 |
| Tagged structural | **Patient Home** | *Domiciliary Hospitalizing* | SE1 |
| Tagged structural | **Current Regulation** | **Domiciliary Hospitalization System** | SE1 |
| Tagged structural | **Inpatient Facility** | *Domiciliary Hospitalizing* | SE1 |
| Effect (env) | *Inpatient Bed Occupying* | **Clinical Condition** | TS5 |

### OPL-EN del SD

```
Domiciliary Hospitalization System is physical.
Domiciliary Hospitalization System exhibits Domiciliary Hospitalizing.
Patient Group is physical.
Patient Group exhibits Clinical Condition.
Clinical Condition can be acute/reacutized or recovered.
State acute/reacutized of Clinical Condition is initial.
State recovered of Clinical Condition is final.
Domiciliary Hospitalizing changes Clinical Condition from acute/reacutized to recovered.
Healthcare Team handles Domiciliary Hospitalizing.
Domiciliary Hospitalizing requires Medical Equipment.
Domiciliary Hospitalizing requires Communication System.
Domiciliary Hospitalizing requires Transport Vehicle.
Domiciliary Hospitalizing requires Administrative Infrastructure.
Domiciliary Hospitalizing consumes Clinical Supply.
Domiciliary Hospitalizing consumes Medication.
Domiciliary Hospitalizing yields Clinical Record.
Patient Home is environmental.
Patient Home hosts Domiciliary Hospitalizing.
Inpatient Facility is environmental.
Inpatient Facility refers Domiciliary Hospitalizing.
Current Regulation is environmental.
Current Regulation governs Domiciliary Hospitalization System.
Inpatient Bed Occupying is environmental.
Inpatient Bed Occupying changes Clinical Condition to acute/reacutized.
```

### OPL-ES del SD

```
**Sistema de Hospitalización Domiciliaria** es físico.
**Sistema de Hospitalización Domiciliaria** exhibe *Hospitalizar en Domicilio*.
**Grupo de Pacientes** es físico.
**Grupo de Pacientes** exhibe **Condición Clínica**.
**Condición Clínica** puede estar `agudo/reagudizado` o `recuperado`.
Estado `agudo/reagudizado` de **Condición Clínica** es inicial.
Estado `recuperado` de **Condición Clínica** es final.
*Hospitalizar en Domicilio* cambia **Condición Clínica** de `agudo/reagudizado` a `recuperado`.
**Equipo de Salud** maneja *Hospitalizar en Domicilio*.
*Hospitalizar en Domicilio* requiere **Equipamiento Médico**.
*Hospitalizar en Domicilio* requiere **Sistema de Comunicación**.
*Hospitalizar en Domicilio* requiere **Vehículo de Transporte**.
*Hospitalizar en Domicilio* requiere **Infraestructura Administrativa**.
*Hospitalizar en Domicilio* consume **Insumo Clínico**.
*Hospitalizar en Domicilio* consume **Medicamento**.
*Hospitalizar en Domicilio* genera **Ficha Clínica**.
**Domicilio del Paciente** es ambiental.
**Domicilio del Paciente** alberga *Hospitalizar en Domicilio*.
**Establecimiento de Atención Cerrada** es ambiental.
**Establecimiento de Atención Cerrada** deriva a *Hospitalizar en Domicilio*.
**Normativa Vigente** es ambiental.
**Normativa Vigente** rige **Sistema de Hospitalización Domiciliaria**.
*Ocupar Cama Hospitalaria* es ambiental.
*Ocupar Cama Hospitalaria* cambia **Condición Clínica** a `agudo/reagudizado`.
```

---

## SD1 — Descomposición de *Domiciliary Hospitalizing*

Refinamiento: in-zooming (subprocesos secuenciales, con paralelismo en pasos 4-5).

### Tabla de Elementos SD1

| Tipo | Nombre | Esencia | Afiliación | Estados |
|------|--------|---------|------------|---------|
| Proceso | *Eligibility Evaluating* | Informatical | Sistémico | — |
| Proceso | *Patient Admitting* | Informatical | Sistémico | — |
| Proceso | *Care Planning* | Informatical | Sistémico | — |
| Proceso | *Therapeutic Plan Executing* | Físico | Sistémico | — |
| Proceso | *Clinical Evolution Monitoring* | Informatical | Sistémico | — |
| Proceso | *Patient Discharging* | Informatical | Sistémico | — |
| Objeto | **Eligibility Status** | Informatical | Sistémico | `pending`, `eligible`, `ineligible` |
| Objeto | **Informed Consent** | Informatical | Sistémico | `unsigned`, `signed` |
| Objeto | **Therapeutic Plan** | Informatical | Sistémico | `draft`, `active`, `completed` |
| Objeto | **Nursing Care Plan** | Informatical | Sistémico | `draft`, `active`, `completed` |
| Objeto | **Social Report** | Informatical | Sistémico | — |
| Objeto | **Admission Form** | Informatical | Sistémico | — |
| Objeto | **Domiciliary Clinical Summary** | Informatical | Sistémico | — |
| Objeto | **Epicrisis** | Informatical | Sistémico | — |
| Objeto | **Satisfaction Survey** | Informatical | Sistémico | — |
| Objeto | **Continuity Decision** | Informatical | Sistémico | `continue-treatment`, `proceed-discharge` |
| Objeto | **Hospitalization Status** | Informatical | Sistémico | `active`, `discharged` |
| Objeto | **Caregiver** | Físico | Sistémico | `available`, `unavailable` |
| Objeto | **Support Network** | Físico | Sistémico | `verified`, `insufficient` |

### OPL-EN del SD1

```
SD is refined by in-zooming Domiciliary Hospitalizing in SD1.
Domiciliary Hospitalizing zooms into Eligibility Evaluating, Patient Admitting, Care Planning, Therapeutic Plan Executing, Clinical Evolution Monitoring and Patient Discharging, in that sequence.

Eligibility Status can be pending, eligible or ineligible.
State pending of Eligibility Status is initial.
State eligible of Eligibility Status is final.

Eligibility Evaluating changes Eligibility Status from pending to eligible.
Eligibility Evaluating requires Inpatient Facility.
Patient Admitting occurs if Eligibility Status is eligible, in which case Patient Admitting changes Eligibility Status from eligible, otherwise Patient Admitting is skipped.

Informed Consent can be unsigned or signed.
State unsigned of Informed Consent is initial.
State signed of Informed Consent is final.
Patient Admitting changes Informed Consent from unsigned to signed.
Patient Admitting yields Admission Form.
Patient Admitting yields Social Report.
Patient Admitting consumes Clinical Supply.

Caregiver can be available or unavailable.
Eligibility Evaluating requires Caregiver in available.
Support Network can be verified or insufficient.
Eligibility Evaluating changes Support Network from insufficient to verified.

Therapeutic Plan can be draft, active or completed.
State draft of Therapeutic Plan is initial.
State active of Therapeutic Plan is default.
State completed of Therapeutic Plan is final.
Care Planning yields Therapeutic Plan in draft.
Care Planning yields Nursing Care Plan.

Nursing Care Plan can be draft, active or completed.
State draft of Nursing Care Plan is initial.

Therapeutic Plan Executing requires Therapeutic Plan in active.
Therapeutic Plan Executing requires Nursing Care Plan in active.
Therapeutic Plan Executing consumes Clinical Supply.
Therapeutic Plan Executing consumes Medication.
Therapeutic Plan Executing requires Medical Equipment.
Therapeutic Plan Executing requires Transport Vehicle.

Clinical Evolution Monitoring changes Clinical Condition from acute/reacutized to recovered.
Clinical Evolution Monitoring yields Domiciliary Clinical Summary.

Continuity Decision can be continue-treatment or proceed-discharge.
Clinical Evolution Monitoring yields Continuity Decision.

Patient Discharging occurs if Continuity Decision is proceed-discharge, in which case Patient Discharging changes Hospitalization Status from active to discharged, otherwise Patient Discharging is skipped.

Hospitalization Status can be active or discharged.
State active of Hospitalization Status is initial.
State discharged of Hospitalization Status is final.

Patient Discharging changes Therapeutic Plan from active to completed.
Patient Discharging changes Nursing Care Plan from active to completed.
Patient Discharging yields Epicrisis.
Patient Discharging yields Satisfaction Survey.
Patient Discharging yields Clinical Record.

Healthcare Team handles Eligibility Evaluating.
Healthcare Team handles Patient Admitting.
Healthcare Team handles Care Planning.
Healthcare Team handles Therapeutic Plan Executing.
Healthcare Team handles Clinical Evolution Monitoring.
Healthcare Team handles Patient Discharging.
```

### OPL-ES del SD1

```
SD se refina por descomposición de *Hospitalizar en Domicilio* en SD1.
*Hospitalizar en Domicilio* se descompone en *Evaluar Elegibilidad*, *Ingresar Paciente*, *Planificar Atención*, *Ejecutar Plan Terapéutico*, *Monitorear Evolución Clínica* y *Egresar de Hospitalización Domiciliaria*, en esa secuencia.

**Estado de Elegibilidad** puede estar `pendiente`, `elegible` o `no elegible`.
Estado `pendiente` de **Estado de Elegibilidad** es inicial.
Estado `elegible` de **Estado de Elegibilidad** es final.

*Evaluar Elegibilidad* cambia **Estado de Elegibilidad** de `pendiente` a `elegible`.
*Evaluar Elegibilidad* requiere **Establecimiento de Atención Cerrada**.
*Ingresar Paciente* ocurre si **Estado de Elegibilidad** está en `elegible`, en cuyo caso *Ingresar Paciente* cambia **Estado de Elegibilidad** de `elegible`, de lo contrario *Ingresar Paciente* se omite.

**Consentimiento Informado** puede estar `sin firmar` o `firmado`.
Estado `sin firmar` de **Consentimiento Informado** es inicial.
Estado `firmado` de **Consentimiento Informado** es final.
*Ingresar Paciente* cambia **Consentimiento Informado** de `sin firmar` a `firmado`.
*Ingresar Paciente* genera **Formulario de Ingreso**.
*Ingresar Paciente* genera **Informe Social**.
*Ingresar Paciente* consume **Insumo Clínico**.

**Cuidador** puede estar `disponible` o `no disponible`.
*Evaluar Elegibilidad* requiere **Cuidador** en `disponible`.
**Red de Apoyo** puede estar `verificada` o `insuficiente`.
*Evaluar Elegibilidad* cambia **Red de Apoyo** de `insuficiente` a `verificada`.

**Plan Terapéutico** puede estar `borrador`, `activo` o `completado`.
Estado `borrador` de **Plan Terapéutico** es inicial.
Estado `activo` de **Plan Terapéutico** es por defecto.
Estado `completado` de **Plan Terapéutico** es final.
*Planificar Atención* genera **Plan Terapéutico** en `borrador`.
*Planificar Atención* genera **Plan de Cuidados de Enfermería**.

**Plan de Cuidados de Enfermería** puede estar `borrador`, `activo` o `completado`.
Estado `borrador` de **Plan de Cuidados de Enfermería** es inicial.

*Ejecutar Plan Terapéutico* requiere **Plan Terapéutico** en `activo`.
*Ejecutar Plan Terapéutico* requiere **Plan de Cuidados de Enfermería** en `activo`.
*Ejecutar Plan Terapéutico* consume **Insumo Clínico**.
*Ejecutar Plan Terapéutico* consume **Medicamento**.
*Ejecutar Plan Terapéutico* requiere **Equipamiento Médico**.
*Ejecutar Plan Terapéutico* requiere **Vehículo de Transporte**.

*Monitorear Evolución Clínica* cambia **Condición Clínica** de `agudo/reagudizado` a `recuperado`.
*Monitorear Evolución Clínica* genera **Resumen Clínico Domiciliario**.

**Decisión de Continuidad** puede estar `continuar tratamiento` o `proceder egreso`.
*Monitorear Evolución Clínica* genera **Decisión de Continuidad**.

*Egresar de Hospitalización Domiciliaria* ocurre si **Decisión de Continuidad** está en `proceder egreso`, en cuyo caso *Egresar de Hospitalización Domiciliaria* cambia **Estado de Hospitalización** de `activa` a `egresado`, de lo contrario *Egresar de Hospitalización Domiciliaria* se omite.

**Estado de Hospitalización** puede estar `activa` o `egresado`.
Estado `activa` de **Estado de Hospitalización** es inicial.
Estado `egresado` de **Estado de Hospitalización** es final.

*Egresar de Hospitalización Domiciliaria* cambia **Plan Terapéutico** de `activo` a `completado`.
*Egresar de Hospitalización Domiciliaria* cambia **Plan de Cuidados de Enfermería** de `activo` a `completado`.
*Egresar de Hospitalización Domiciliaria* genera **Epicrisis**.
*Egresar de Hospitalización Domiciliaria* genera **Encuesta de Satisfacción**.
*Egresar de Hospitalización Domiciliaria* genera **Ficha Clínica**.

**Equipo de Salud** maneja *Evaluar Elegibilidad*.
**Equipo de Salud** maneja *Ingresar Paciente*.
**Equipo de Salud** maneja *Planificar Atención*.
**Equipo de Salud** maneja *Ejecutar Plan Terapéutico*.
**Equipo de Salud** maneja *Monitorear Evolución Clínica*.
**Equipo de Salud** maneja *Egresar de Hospitalización Domiciliaria*.
```

---

## SD1.1 — Descomposición de *Eligibility Evaluating*

Refinamiento: in-zooming (secuencial).

### OPL-EN

```
SD1 is refined by in-zooming Eligibility Evaluating in SD1.1.
Eligibility Evaluating zooms into Clinical Condition Evaluating, Home Condition Evaluating, Support Network Verifying and Informed Consent Obtaining, in that sequence.

Clinical Condition Evaluating affects Patient Group.
Clinical Condition Evaluating changes Clinical Condition from acute/reacutized.
Clinical Condition Evaluating requires Inpatient Facility.
Attending Physician handles Clinical Condition Evaluating.

Home Condition Evaluating yields Social Report.
Home Condition Evaluating affects Patient Home.
Social Worker handles Home Condition Evaluating.

Home Condition can be adequate or inadequate.
Patient Home exhibits Home Condition.
Home Condition Evaluating changes Home Condition from inadequate to adequate.

Support Network Verifying changes Support Network from insufficient to verified.
Support Network Verifying requires Caregiver in available.
Social Worker handles Support Network Verifying.

Informed Consent Obtaining changes Informed Consent from unsigned to signed.
Informed Consent Obtaining requires Patient Group.
Clinical Nurse handles Informed Consent Obtaining.

Rights and Duties Charter is informatical.
Informed Consent Obtaining yields Rights and Duties Charter.
```

### OPL-ES

```
SD1 se refina por descomposición de *Evaluar Elegibilidad* en SD1.1.
*Evaluar Elegibilidad* se descompone en *Evaluar Condición Clínica*, *Evaluar Condiciones del Domicilio*, *Verificar Red de Apoyo* y *Obtener Consentimiento Informado*, en esa secuencia.

*Evaluar Condición Clínica* afecta **Grupo de Pacientes**.
*Evaluar Condición Clínica* cambia **Condición Clínica** de `agudo/reagudizado`.
*Evaluar Condición Clínica* requiere **Establecimiento de Atención Cerrada**.
**Médico de Atención Directa** maneja *Evaluar Condición Clínica*.

*Evaluar Condiciones del Domicilio* genera **Informe Social**.
*Evaluar Condiciones del Domicilio* afecta **Domicilio del Paciente**.
**Trabajador Social** maneja *Evaluar Condiciones del Domicilio*.

**Condición del Domicilio** puede estar `adecuada` o `inadecuada`.
**Domicilio del Paciente** exhibe **Condición del Domicilio**.
*Evaluar Condiciones del Domicilio* cambia **Condición del Domicilio** de `inadecuada` a `adecuada`.

*Verificar Red de Apoyo* cambia **Red de Apoyo** de `insuficiente` a `verificada`.
*Verificar Red de Apoyo* requiere **Cuidador** en `disponible`.
**Trabajador Social** maneja *Verificar Red de Apoyo*.

*Obtener Consentimiento Informado* cambia **Consentimiento Informado** de `sin firmar` a `firmado`.
*Obtener Consentimiento Informado* requiere **Grupo de Pacientes**.
**Enfermero Clínico** maneja *Obtener Consentimiento Informado*.

**Carta de Derechos y Deberes** es informatical.
*Obtener Consentimiento Informado* genera **Carta de Derechos y Deberes**.
```

---

## SD1.2 — Descomposición de *Patient Admitting*

Refinamiento: in-zooming (secuencial).

### OPL-EN

```
SD1 is refined by in-zooming Patient Admitting in SD1.2.
Patient Admitting zooms into Admission Registering, Social Diagnosis Elaborating, Patient Documentation Delivering and Referral Facility Coordinating, in that sequence.

Admission Registering yields Admission Form.
Admission Registering requires Communication System.
Administrative Staff handles Admission Registering.

Social Diagnosis Elaborating yields Social Report.
Social Diagnosis Elaborating affects Patient Home.
Social Worker handles Social Diagnosis Elaborating.

Socioeconomic Status is informatical.
Social Diagnosis Elaborating yields Socioeconomic Status.

Patient Documentation Delivering affects Patient Group.
Patient Documentation Delivering requires Informed Consent in signed.
Patient Documentation Delivering yields Care Indication Document.
Clinical Nurse handles Patient Documentation Delivering.

Care Indication Document is informatical.

Referral Facility Coordinating requires Inpatient Facility.
Referral Facility Coordinating requires Communication System.
Coordination Professional handles Referral Facility Coordinating.
```

### OPL-ES

```
SD1 se refina por descomposición de *Ingresar Paciente* en SD1.2.
*Ingresar Paciente* se descompone en *Registrar Ingreso*, *Elaborar Diagnóstico Social*, *Entregar Documentación al Paciente* y *Coordinar con Establecimiento Derivador*, en esa secuencia.

*Registrar Ingreso* genera **Formulario de Ingreso**.
*Registrar Ingreso* requiere **Sistema de Comunicación**.
**Personal Administrativo** maneja *Registrar Ingreso*.

*Elaborar Diagnóstico Social* genera **Informe Social**.
*Elaborar Diagnóstico Social* afecta **Domicilio del Paciente**.
**Trabajador Social** maneja *Elaborar Diagnóstico Social*.

**Situación Socioeconómica** es informatical.
*Elaborar Diagnóstico Social* genera **Situación Socioeconómica**.

*Entregar Documentación al Paciente* afecta **Grupo de Pacientes**.
*Entregar Documentación al Paciente* requiere **Consentimiento Informado** en `firmado`.
*Entregar Documentación al Paciente* genera **Documento de Indicaciones de Cuidado**.
**Enfermero Clínico** maneja *Entregar Documentación al Paciente*.

**Documento de Indicaciones de Cuidado** es informatical.

*Coordinar con Establecimiento Derivador* requiere **Establecimiento de Atención Cerrada**.
*Coordinar con Establecimiento Derivador* requiere **Sistema de Comunicación**.
**Profesional Coordinador** maneja *Coordinar con Establecimiento Derivador*.
```

---

## SD1.3 — Descomposición de *Care Planning*

Refinamiento: in-zooming (secuencial).

### OPL-EN

```
SD1 is refined by in-zooming Care Planning in SD1.3.
Care Planning zooms into Therapeutic Plan Elaborating, Nursing Care Plan Elaborating, Home Visit Scheduling and Transport Route Programming, in that sequence.

Therapeutic Plan Elaborating yields Therapeutic Plan in draft.
Therapeutic Plan Elaborating requires Clinical Condition.
Attending Physician handles Therapeutic Plan Elaborating.

Nursing Care Plan Elaborating yields Nursing Care Plan in draft.
Nursing Care Plan Elaborating requires Therapeutic Plan in draft.
Clinical Nurse handles Nursing Care Plan Elaborating.

Visit Schedule is informatical.
Home Visit Scheduling yields Visit Schedule.
Home Visit Scheduling requires Therapeutic Plan in draft.
Coordination Professional handles Home Visit Scheduling.

Transport Route is informatical.
Transport Route Programming yields Transport Route.
Transport Route Programming requires Visit Schedule.
Transport Route Programming requires Patient Home.
Administrative Staff handles Transport Route Programming.
```

### OPL-ES

```
SD1 se refina por descomposición de *Planificar Atención* en SD1.3.
*Planificar Atención* se descompone en *Elaborar Plan Terapéutico*, *Elaborar Plan de Cuidados de Enfermería*, *Programar Visitas Domiciliarias* y *Programar Rutas de Transporte*, en esa secuencia.

*Elaborar Plan Terapéutico* genera **Plan Terapéutico** en `borrador`.
*Elaborar Plan Terapéutico* requiere **Condición Clínica**.
**Médico de Atención Directa** maneja *Elaborar Plan Terapéutico*.

*Elaborar Plan de Cuidados de Enfermería* genera **Plan de Cuidados de Enfermería** en `borrador`.
*Elaborar Plan de Cuidados de Enfermería* requiere **Plan Terapéutico** en `borrador`.
**Enfermero Clínico** maneja *Elaborar Plan de Cuidados de Enfermería*.

**Programa de Visitas** es informatical.
*Programar Visitas Domiciliarias* genera **Programa de Visitas**.
*Programar Visitas Domiciliarias* requiere **Plan Terapéutico** en `borrador`.
**Profesional Coordinador** maneja *Programar Visitas Domiciliarias*.

**Ruta de Transporte** es informatical.
*Programar Rutas de Transporte* genera **Ruta de Transporte**.
*Programar Rutas de Transporte* requiere **Programa de Visitas**.
*Programar Rutas de Transporte* requiere **Domicilio del Paciente**.
**Personal Administrativo** maneja *Programar Rutas de Transporte*.
```

---

## SD1.4 — Descomposición de *Therapeutic Plan Executing*

Refinamiento: unfolding por agregación (subprocesos asíncronos — ocurren en orden variable según plan de cada paciente).

### OPL-EN

```
SD1 is refined by in-zooming Therapeutic Plan Executing in SD1.4.
Therapeutic Plan Executing zooms into parallel Medical Visit Performing, Nursing Care Executing, Kinesiological Therapy Executing, Medication Administering, Remote Care Regulating and Patient and Caregiver Educating.

Medical Visit Performing affects Patient Group.
Medical Visit Performing requires Therapeutic Plan in active.
Medical Visit Performing requires Medical Equipment.
Medical Visit Performing requires Transport Vehicle.
Medical Visit Performing yields Domiciliary Clinical Summary.
Attending Physician handles Medical Visit Performing.

Nursing Care Executing affects Patient Group.
Nursing Care Executing requires Nursing Care Plan in active.
Nursing Care Executing requires Medical Equipment.
Nursing Care Executing consumes Clinical Supply.
Clinical Nurse handles Nursing Care Executing.
Nursing Technician handles Nursing Care Executing.

Kinesiological Therapy Executing affects Patient Group.
Kinesiological Therapy Executing requires Therapeutic Plan in active.
Kinesiological Therapy Executing requires Medical Equipment.
Kinesiologist handles Kinesiological Therapy Executing.

Motor Therapy is informatical.
Respiratory Therapy is informatical.
Kinesiological Therapy Executing yields Motor Therapy.
Kinesiological Therapy Executing yields Respiratory Therapy.

Medication Administering consumes Medication.
Medication Administering affects Patient Group.
Medication Administering requires Therapeutic Plan in active.
Clinical Nurse handles Medication Administering.
Nursing Technician handles Medication Administering.

Prescription is informatical.
Medication Administering requires Prescription.

Remote Care Regulating affects Patient Group.
Remote Care Regulating requires Communication System.
Regulating Physician handles Remote Care Regulating.

Telehealth Record is informatical.
Remote Care Regulating yields Telehealth Record.

Patient and Caregiver Educating affects Patient Group.
Patient and Caregiver Educating affects Caregiver.
Patient and Caregiver Educating requires Therapeutic Plan in active.
Clinical Nurse handles Patient and Caregiver Educating.

Self-Care Knowledge is informatical.
Patient Group exhibits Self-Care Knowledge.
Self-Care Knowledge can be insufficient or sufficient.
State insufficient of Self-Care Knowledge is initial.
Patient and Caregiver Educating changes Self-Care Knowledge from insufficient to sufficient.
```

### OPL-ES

```
SD1 se refina por descomposición de *Ejecutar Plan Terapéutico* en SD1.4.
*Ejecutar Plan Terapéutico* se descompone en paralelo *Realizar Visita Médica*, *Ejecutar Cuidados de Enfermería*, *Ejecutar Terapia Kinesiológica*, *Administrar Medicamentos*, *Regular Atención a Distancia* y *Educar a Paciente y Cuidador*.

*Realizar Visita Médica* afecta **Grupo de Pacientes**.
*Realizar Visita Médica* requiere **Plan Terapéutico** en `activo`.
*Realizar Visita Médica* requiere **Equipamiento Médico**.
*Realizar Visita Médica* requiere **Vehículo de Transporte**.
*Realizar Visita Médica* genera **Resumen Clínico Domiciliario**.
**Médico de Atención Directa** maneja *Realizar Visita Médica*.

*Ejecutar Cuidados de Enfermería* afecta **Grupo de Pacientes**.
*Ejecutar Cuidados de Enfermería* requiere **Plan de Cuidados de Enfermería** en `activo`.
*Ejecutar Cuidados de Enfermería* requiere **Equipamiento Médico**.
*Ejecutar Cuidados de Enfermería* consume **Insumo Clínico**.
**Enfermero Clínico** maneja *Ejecutar Cuidados de Enfermería*.
**Técnico de Enfermería** maneja *Ejecutar Cuidados de Enfermería*.

*Ejecutar Terapia Kinesiológica* afecta **Grupo de Pacientes**.
*Ejecutar Terapia Kinesiológica* requiere **Plan Terapéutico** en `activo`.
*Ejecutar Terapia Kinesiológica* requiere **Equipamiento Médico**.
**Kinesiólogo** maneja *Ejecutar Terapia Kinesiológica*.

**Terapia Motora** es informatical.
**Terapia Respiratoria** es informatical.
*Ejecutar Terapia Kinesiológica* genera **Terapia Motora**.
*Ejecutar Terapia Kinesiológica* genera **Terapia Respiratoria**.

*Administrar Medicamentos* consume **Medicamento**.
*Administrar Medicamentos* afecta **Grupo de Pacientes**.
*Administrar Medicamentos* requiere **Plan Terapéutico** en `activo`.
**Enfermero Clínico** maneja *Administrar Medicamentos*.
**Técnico de Enfermería** maneja *Administrar Medicamentos*.

**Receta Médica** es informatical.
*Administrar Medicamentos* requiere **Receta Médica**.

*Regular Atención a Distancia* afecta **Grupo de Pacientes**.
*Regular Atención a Distancia* requiere **Sistema de Comunicación**.
**Médico Regulador** maneja *Regular Atención a Distancia*.

**Registro de Telesalud** es informatical.
*Regular Atención a Distancia* genera **Registro de Telesalud**.

*Educar a Paciente y Cuidador* afecta **Grupo de Pacientes**.
*Educar a Paciente y Cuidador* afecta **Cuidador**.
*Educar a Paciente y Cuidador* requiere **Plan Terapéutico** en `activo`.
**Enfermero Clínico** maneja *Educar a Paciente y Cuidador*.

**Conocimiento de Autocuidado** es informatical.
**Grupo de Pacientes** exhibe **Conocimiento de Autocuidado**.
**Conocimiento de Autocuidado** puede estar `insuficiente` o `suficiente`.
Estado `insuficiente` de **Conocimiento de Autocuidado** es inicial.
*Educar a Paciente y Cuidador* cambia **Conocimiento de Autocuidado** de `insuficiente` a `suficiente`.
```

---

## SD1.5 — Descomposición de *Clinical Evolution Monitoring*

Refinamiento: in-zooming (secuencial con decisión).

### OPL-EN

```
SD1 is refined by in-zooming Clinical Evolution Monitoring in SD1.5.
Clinical Evolution Monitoring zooms into Vital Signs Evaluating, Clinical Record Updating, Patient Categorizing and Continuity Deciding, in that sequence.

Vital Signs Evaluating affects Patient Group.
Vital Signs Evaluating requires Medical Equipment.
Clinical Nurse handles Vital Signs Evaluating.

Vital Signs Data is informatical.
Vital Signs Evaluating yields Vital Signs Data.

Blood Pressure is informatical.
Heart Rate is informatical.
Respiratory Rate is informatical.
Oxygen Saturation is informatical.
Vital Signs Data consists of Blood Pressure, Heart Rate, Respiratory Rate and Oxygen Saturation.

Clinical Record Updating consumes Vital Signs Data.
Clinical Record Updating affects Clinical Record.
Clinical Record Updating requires Communication System.
Clinical Nurse handles Clinical Record Updating.

Patient Category is informatical.
Patient Category can be stable, improving or deteriorating.
State stable of Patient Category is default.
Patient Categorizing yields Patient Category.
Patient Categorizing requires Vital Signs Data.
Attending Physician handles Patient Categorizing.

Continuity Deciding yields Continuity Decision.
Continuity Deciding requires Patient Category.
Attending Physician handles Continuity Deciding.

Continuity Decision can be continue-treatment or proceed-discharge.
Continuity Deciding changes Continuity Decision to continue-treatment.
Continuity Deciding changes Continuity Decision to proceed-discharge.
```

### OPL-ES

```
SD1 se refina por descomposición de *Monitorear Evolución Clínica* en SD1.5.
*Monitorear Evolución Clínica* se descompone en *Evaluar Signos Vitales*, *Actualizar Registro Clínico*, *Categorizar Paciente* y *Decidir Continuidad*, en esa secuencia.

*Evaluar Signos Vitales* afecta **Grupo de Pacientes**.
*Evaluar Signos Vitales* requiere **Equipamiento Médico**.
**Enfermero Clínico** maneja *Evaluar Signos Vitales*.

**Datos de Signos Vitales** es informatical.
*Evaluar Signos Vitales* genera **Datos de Signos Vitales**.

**Presión Arterial** es informatical.
**Frecuencia Cardíaca** es informatical.
**Frecuencia Respiratoria** es informatical.
**Saturación de Oxígeno** es informatical.
**Datos de Signos Vitales** consta de **Presión Arterial**, **Frecuencia Cardíaca**, **Frecuencia Respiratoria** y **Saturación de Oxígeno**.

*Actualizar Registro Clínico* consume **Datos de Signos Vitales**.
*Actualizar Registro Clínico* afecta **Ficha Clínica**.
*Actualizar Registro Clínico* requiere **Sistema de Comunicación**.
**Enfermero Clínico** maneja *Actualizar Registro Clínico*.

**Categoría del Paciente** es informatical.
**Categoría del Paciente** puede estar `estable`, `mejorando` o `deteriorándose`.
Estado `estable` de **Categoría del Paciente** es por defecto.
*Categorizar Paciente* genera **Categoría del Paciente**.
*Categorizar Paciente* requiere **Datos de Signos Vitales**.
**Médico de Atención Directa** maneja *Categorizar Paciente*.

*Decidir Continuidad* genera **Decisión de Continuidad**.
*Decidir Continuidad* requiere **Categoría del Paciente**.
**Médico de Atención Directa** maneja *Decidir Continuidad*.

**Decisión de Continuidad** puede estar `continuar tratamiento` o `proceder egreso`.
*Decidir Continuidad* cambia **Decisión de Continuidad** a `continuar tratamiento`.
*Decidir Continuidad* cambia **Decisión de Continuidad** a `proceder egreso`.
```

---

## SD1.6 — Despliegue de *Patient Discharging*

Refinamiento: unfolding por generalización-especialización (tipos de egreso mutuamente excluyentes).

### OPL-EN

```
Medical Discharge, Hospital Readmission Discharge, Death Discharge, Voluntary Withdrawal Discharge and Disciplinary Discharge are Patient Discharging.

Medical Discharge changes Clinical Condition to recovered.
Medical Discharge changes Hospitalization Status from active to discharged.
Medical Discharge yields Epicrisis.
Attending Physician handles Medical Discharge.

Hospital Readmission Discharge changes Hospitalization Status from active to discharged.
Hospital Readmission Discharge requires Inpatient Facility.
Hospital Readmission Discharge requires Transport Vehicle.
Hospital Readmission Discharge yields Epicrisis.
Attending Physician handles Hospital Readmission Discharge.

Clinical Instability is informatical.
Clinical Instability can be absent or present.
Hospital Readmission Discharge occurs if Clinical Instability is present, in which case Hospital Readmission Discharge changes Clinical Instability from present, otherwise Hospital Readmission Discharge is skipped.

Death Discharge changes Hospitalization Status from active to discharged.
Death Discharge yields Epicrisis.
Attending Physician handles Death Discharge.

Death Protocol is informatical.
Death Discharge yields Death Protocol.

Voluntary Withdrawal Discharge changes Hospitalization Status from active to discharged.
Voluntary Withdrawal Discharge requires Informed Consent.
Voluntary Withdrawal Discharge yields Epicrisis.

Withdrawal Statement is informatical.
Voluntary Withdrawal Discharge yields Withdrawal Statement.

Disciplinary Discharge changes Hospitalization Status from active to discharged.
Technical Director handles Disciplinary Discharge.
Disciplinary Discharge yields Epicrisis.

Treatment Adherence is informatical.
Treatment Adherence can be adherent or non-adherent.
Disciplinary Discharge occurs if Treatment Adherence is non-adherent, in which case Disciplinary Discharge changes Hospitalization Status from active to discharged, otherwise Disciplinary Discharge is skipped.
```

### OPL-ES

```
*Egresar por Alta Médica*, *Egresar por Reingreso Hospitalario*, *Egresar por Fallecimiento*, *Egresar por Renuncia Voluntaria* y *Egresar por Alta Disciplinaria* son *Egresar de Hospitalización Domiciliaria*.

*Egresar por Alta Médica* cambia **Condición Clínica** a `recuperado`.
*Egresar por Alta Médica* cambia **Estado de Hospitalización** de `activa` a `egresado`.
*Egresar por Alta Médica* genera **Epicrisis**.
**Médico de Atención Directa** maneja *Egresar por Alta Médica*.

*Egresar por Reingreso Hospitalario* cambia **Estado de Hospitalización** de `activa` a `egresado`.
*Egresar por Reingreso Hospitalario* requiere **Establecimiento de Atención Cerrada**.
*Egresar por Reingreso Hospitalario* requiere **Vehículo de Transporte**.
*Egresar por Reingreso Hospitalario* genera **Epicrisis**.
**Médico de Atención Directa** maneja *Egresar por Reingreso Hospitalario*.

**Inestabilidad Clínica** es informatical.
**Inestabilidad Clínica** puede estar `ausente` o `presente`.
*Egresar por Reingreso Hospitalario* ocurre si **Inestabilidad Clínica** está en `presente`, en cuyo caso *Egresar por Reingreso Hospitalario* cambia **Inestabilidad Clínica** de `presente`, de lo contrario *Egresar por Reingreso Hospitalario* se omite.

*Egresar por Fallecimiento* cambia **Estado de Hospitalización** de `activa` a `egresado`.
*Egresar por Fallecimiento* genera **Epicrisis**.
**Médico de Atención Directa** maneja *Egresar por Fallecimiento*.

**Protocolo de Fallecimiento** es informatical.
*Egresar por Fallecimiento* genera **Protocolo de Fallecimiento**.

*Egresar por Renuncia Voluntaria* cambia **Estado de Hospitalización** de `activa` a `egresado`.
*Egresar por Renuncia Voluntaria* requiere **Consentimiento Informado**.
*Egresar por Renuncia Voluntaria* genera **Epicrisis**.

**Declaración de Retiro** es informatical.
*Egresar por Renuncia Voluntaria* genera **Declaración de Retiro**.

*Egresar por Alta Disciplinaria* cambia **Estado de Hospitalización** de `activa` a `egresado`.
**Director Técnico** maneja *Egresar por Alta Disciplinaria*.
*Egresar por Alta Disciplinaria* genera **Epicrisis**.

**Adherencia al Tratamiento** es informatical.
**Adherencia al Tratamiento** puede estar `adherente` o `no adherente`.
*Egresar por Alta Disciplinaria* ocurre si **Adherencia al Tratamiento** está en `no adherente`, en cuyo caso *Egresar por Alta Disciplinaria* cambia **Estado de Hospitalización** de `activa` a `egresado`, de lo contrario *Egresar por Alta Disciplinaria* se omite.
```

---

## SD2 — Despliegue Estructural del Equipo de Salud

Refinamiento: unfolding por agregación-participación.

### OPL-EN

```
Healthcare Team consists of Technical Director, Coordination Professional, Attending Physician, Regulating Physician, Clinical Nurse, Kinesiologist, Nursing Technician, Social Worker and Administrative Staff.

Technical Director is physical.
Coordination Professional is physical.
Attending Physician is physical.
Regulating Physician is physical.
Clinical Nurse is physical.
Kinesiologist is physical.
Nursing Technician is physical.
Social Worker is physical.
Administrative Staff is physical.

Technical Director exhibits Clinical Experience.
Clinical Experience of Technical Director ranges from 2 to 40 years.
Technical Director exhibits Postgraduate Management Training.
Technical Director exhibits IAAS Prevention Course.
Technical Director exhibits Weekly Dedication.
Weekly Dedication of Technical Director ranges from 22 to 44 hours.

Coordination Professional exhibits Clinical Experience.
Clinical Experience of Coordination Professional ranges from 5 to 40 years.
Coordination Professional exhibits Management Training.
Coordination Professional exhibits IAAS Course.

Attending Physician exhibits Clinical Experience.
Clinical Experience of Attending Physician ranges from 2 to 40 years.
Attending Physician exhibits IAAS Course.
Attending Physician exhibits BLS Certification.

Regulating Physician exhibits Regulation Experience.
Regulation Experience of Regulating Physician ranges from 2 to 40 years.
Regulating Physician exhibits BLS Certification.

Clinical Nurse exhibits Clinical Experience.
Clinical Experience of Clinical Nurse ranges from 2 to 40 years.
Clinical Nurse exhibits BLS Certification.

Kinesiologist exhibits Clinical Experience.
Clinical Experience of Kinesiologist ranges from 2 to 40 years.
Kinesiologist exhibits BLS Certification.

Nursing Technician exhibits Clinical Experience.
Clinical Experience of Nursing Technician ranges from 1 to 40 years.
Nursing Technician exhibits BLS Certification.
```

### OPL-ES

```
**Equipo de Salud** consta de **Director Técnico**, **Profesional Coordinador**, **Médico de Atención Directa**, **Médico Regulador**, **Enfermero Clínico**, **Kinesiólogo**, **Técnico de Enfermería**, **Trabajador Social** y **Personal Administrativo**.

**Director Técnico** es físico.
**Profesional Coordinador** es físico.
**Médico de Atención Directa** es físico.
**Médico Regulador** es físico.
**Enfermero Clínico** es físico.
**Kinesiólogo** es físico.
**Técnico de Enfermería** es físico.
**Trabajador Social** es físico.
**Personal Administrativo** es físico.

**Director Técnico** exhibe **Experiencia Clínica**.
**Experiencia Clínica** de **Director Técnico** varía de 2 a 40 años.
**Director Técnico** exhibe **Formación de Postgrado en Gestión**.
**Director Técnico** exhibe **Curso de Prevención de IAAS**.
**Director Técnico** exhibe **Dedicación Semanal**.
**Dedicación Semanal** de **Director Técnico** varía de 22 a 44 horas.

**Profesional Coordinador** exhibe **Experiencia Clínica**.
**Experiencia Clínica** de **Profesional Coordinador** varía de 5 a 40 años.
**Profesional Coordinador** exhibe **Formación en Gestión**.
**Profesional Coordinador** exhibe **Curso IAAS**.

**Médico de Atención Directa** exhibe **Experiencia Clínica**.
**Experiencia Clínica** de **Médico de Atención Directa** varía de 2 a 40 años.
**Médico de Atención Directa** exhibe **Curso IAAS**.
**Médico de Atención Directa** exhibe **Certificación SVB**.

**Médico Regulador** exhibe **Experiencia en Regulación**.
**Experiencia en Regulación** de **Médico Regulador** varía de 2 a 40 años.
**Médico Regulador** exhibe **Certificación SVB**.

**Enfermero Clínico** exhibe **Experiencia Clínica**.
**Experiencia Clínica** de **Enfermero Clínico** varía de 2 a 40 años.
**Enfermero Clínico** exhibe **Certificación SVB**.

**Kinesiólogo** exhibe **Experiencia Clínica**.
**Experiencia Clínica** de **Kinesiólogo** varía de 2 a 40 años.
**Kinesiólogo** exhibe **Certificación SVB**.

**Técnico de Enfermería** exhibe **Experiencia Clínica**.
**Experiencia Clínica** de **Técnico de Enfermería** varía de 1 a 40 años.
**Técnico de Enfermería** exhibe **Certificación SVB**.
```

---

## SD3 — Despliegue Estructural de Infraestructura Administrativa

Refinamiento: unfolding por agregación-participación.

### OPL-EN

```
Administrative Infrastructure consists of Telephone System, IT System, Electrical Backup System, Clinical Archive Area, Pharmacy or Authorized Dispensary, Supply Storage, Waste Disposal Area, Cleaning Supply Room, Staff Welfare Area, Vehicle Parking and Evacuation Signage System.

Telephone System is physical.
Telephone System exhibits Availability.
Availability of Telephone System can be 24/7 or partial.
State 24/7 of Availability of Telephone System is initial.

IT System is informatical.
IT System exhibits Internet Connectivity.

Electrical Backup System is physical.
Electrical Backup System exhibits SEC Authorization.

Clinical Archive Area is physical.
Clinical Archive Area exhibits Security Level.
Security Level can be secured or unsecured.

Pharmacy or Authorized Dispensary is physical.
Pharmacy or Authorized Dispensary exhibits Cold Chain Compliance.
Cold Chain Compliance can be compliant or non-compliant.
State compliant of Cold Chain Compliance is initial.

Supply Storage is physical.
Supply Storage exhibits Temperature Control.

Waste Disposal Area is physical.
Waste Disposal Area exhibits REAS Compliance.
REAS Compliance can be compliant or non-compliant.

Staff Welfare Area is physical.
Staff Welfare Area consists of Dining Access, Hygiene Facilities, Lockers and Break Room.
```

### OPL-ES

```
**Infraestructura Administrativa** consta de **Sistema Telefónico**, **Sistema Informático**, **Respaldo Eléctrico**, **Área de Archivo Clínico**, **Farmacia o Botiquín Autorizado**, **Bodega de Insumos**, **Área de Disposición de Residuos**, **Recinto de Aseo**, **Área de Bienestar del Personal**, **Estacionamiento de Vehículos** y **Sistema de Señalización y Evacuación**.

**Sistema Telefónico** es físico.
**Sistema Telefónico** exhibe **Disponibilidad**.
**Disponibilidad** de **Sistema Telefónico** puede estar `24/7` o `parcial`.
Estado `24/7` de **Disponibilidad** de **Sistema Telefónico** es inicial.

**Sistema Informático** es informatical.
**Sistema Informático** exhibe **Conectividad Internet**.

**Respaldo Eléctrico** es físico.
**Respaldo Eléctrico** exhibe **Autorización SEC**.

**Área de Archivo Clínico** es físico.
**Área de Archivo Clínico** exhibe **Nivel de Seguridad**.
**Nivel de Seguridad** puede estar `seguro` o `no seguro`.

**Farmacia o Botiquín Autorizado** es físico.
**Farmacia o Botiquín Autorizado** exhibe **Cumplimiento de Cadena de Frío**.
**Cumplimiento de Cadena de Frío** puede estar `cumple` o `no cumple`.
Estado `cumple` de **Cumplimiento de Cadena de Frío** es inicial.

**Bodega de Insumos** es físico.
**Bodega de Insumos** exhibe **Control de Temperatura**.

**Área de Disposición de Residuos** es físico.
**Área de Disposición de Residuos** exhibe **Cumplimiento REAS**.
**Cumplimiento REAS** puede estar `cumple` o `no cumple`.

**Área de Bienestar del Personal** es físico.
**Área de Bienestar del Personal** consta de **Acceso a Alimentación**, **Servicios Higiénicos**, **Casilleros** y **Sala de Estar**.
```

---

## SD4 — Despliegue Estructural de Equipamiento Médico

Refinamiento: unfolding por agregación-participación.

### OPL-EN

```
Medical Equipment consists of Blood Pressure Monitor, Pulse Oximeter, Cardiac Monitor, Thermometer, Defibrillator and Specialty Instrument Set.

Blood Pressure Monitor is physical.
Pulse Oximeter is physical.
Cardiac Monitor is physical.
Thermometer is physical.
Defibrillator is physical.
Specialty Instrument Set is physical.

Medical Equipment exhibits Maintenance Status.
Maintenance Status can be current or overdue.
State current of Maintenance Status is initial.

Medical Equipment exhibits Sanitary Authorization.
Sanitary Authorization can be authorized or unauthorized.
State authorized of Sanitary Authorization is initial.
```

### OPL-ES

```
**Equipamiento Médico** consta de **Monitor de Presión Arterial**, **Oxímetro de Pulso**, **Monitor Cardíaco**, **Termómetro**, **Desfibrilador** y **Conjunto de Instrumentos Especializados**.

**Monitor de Presión Arterial** es físico.
**Oxímetro de Pulso** es físico.
**Monitor Cardíaco** es físico.
**Termómetro** es físico.
**Desfibrilador** es físico.
**Conjunto de Instrumentos Especializados** es físico.

**Equipamiento Médico** exhibe **Estado de Mantención**.
**Estado de Mantención** puede estar `vigente` o `vencido`.
Estado `vigente` de **Estado de Mantención** es inicial.

**Equipamiento Médico** exhibe **Autorización Sanitaria**.
**Autorización Sanitaria** puede estar `autorizado` o `no autorizado`.
Estado `autorizado` de **Autorización Sanitaria** es inicial.
```

---

## SD5 — Despliegue Estructural del Sistema de Documentación (Protocolos y Manuales)

Refinamiento: unfolding por agregación del sistema documental.

### OPL-EN

```
Domiciliary Hospitalization System exhibits Documentation System as well as Domiciliary Hospitalizing.

Documentation System is informatical.
Documentation System consists of Internal Organization Manual, Clinical Protocol Set, Procedures Manual, Waste Management Protocol and Annual Training Plan.

Internal Organization Manual is informatical.
Internal Organization Manual consists of Organizational Chart, Role Definition Set, Schedule Definition and Hygiene Regulation.

Clinical Protocol Set is informatical.
Clinical Protocol Set consists of Admission Evaluation Protocol, Visit and Route Scheduling Protocol, Categorization and Discharge Protocol, Prescription and Referral Management Protocol, Emergency Response Protocol and Staff Aggression Protocol.

Procedures Manual is informatical.
Procedures Manual consists of Peripheral Venous Line Procedure, Central Venous Line Procedure, Urinary Catheter Procedure, Tracheostomy Procedure, Sample Collection Procedure and Isolation Precaution Procedure.

Waste Management Protocol is informatical.
Waste Management Protocol exhibits REAS Decree Compliance.

Annual Training Plan is informatical.
Annual Training Plan consists of IAAS Training, BLS Training, Staff Induction Program and Humanized Care Training.

Staff Induction Program is informatical.
Staff Induction Program exhibits Minimum Duration.
Minimum Duration of Staff Induction Program ranges from 44 to 200 hours.
```

### OPL-ES

```
**Sistema de Hospitalización Domiciliaria** exhibe **Sistema Documental** así como *Hospitalizar en Domicilio*.

**Sistema Documental** es informatical.
**Sistema Documental** consta de **Manual de Organización Interna**, **Conjunto de Protocolos Clínicos**, **Manual de Procedimientos**, **Protocolo de Manejo de Residuos** y **Plan Anual de Capacitación**.

**Manual de Organización Interna** es informatical.
**Manual de Organización Interna** consta de **Organigrama**, **Conjunto de Definiciones de Rol**, **Definición de Horarios** y **Reglamento de Higiene**.

**Conjunto de Protocolos Clínicos** es informatical.
**Conjunto de Protocolos Clínicos** consta de **Protocolo de Evaluación e Ingreso**, **Protocolo de Programación de Visitas y Rutas**, **Protocolo de Categorización y Egreso**, **Protocolo de Gestión de Recetas e Interconsultas**, **Protocolo de Actuación ante Emergencias** y **Protocolo ante Agresiones al Personal**.

**Manual de Procedimientos** es informatical.
**Manual de Procedimientos** consta de **Procedimiento de Vía Venosa Periférica**, **Procedimiento de Vía Venosa Central**, **Procedimiento de Catéter Urinario**, **Procedimiento de Traqueostomía**, **Procedimiento de Toma de Muestras** y **Procedimiento de Precauciones de Aislamiento**.

**Protocolo de Manejo de Residuos** es informatical.
**Protocolo de Manejo de Residuos** exhibe **Cumplimiento Decreto REAS**.

**Plan Anual de Capacitación** es informatical.
**Plan Anual de Capacitación** consta de **Capacitación IAAS**, **Capacitación SVB**, **Programa de Inducción** y **Capacitación en Humanización del Cuidado**.

**Programa de Inducción** es informatical.
**Programa de Inducción** exhibe **Duración Mínima**.
**Duración Mínima** de **Programa de Inducción** varía de 44 a 200 horas.
```

---

## SD6 — Procesos de Gobernanza del Sistema

Operaciones del sistema modeladas como exhibition-characterization (operaciones del sistema).

### OPL-EN

```
Domiciliary Hospitalization System exhibits Sanitary Authorization Managing as well as Quality and Safety Managing as well as Staff Training Managing as well as Supply Chain Managing as well as Waste Managing as well as Equipment Maintenance Managing.

Sanitary Authorization Managing affects Domiciliary Hospitalization System.
Sanitary Authorization Managing requires Current Regulation.
Technical Director handles Sanitary Authorization Managing.

Sanitary Authorization Status is informatical.
Domiciliary Hospitalization System exhibits Sanitary Authorization Status.
Sanitary Authorization Status can be pending, authorized or expired.
State pending of Sanitary Authorization Status is initial.
Sanitary Authorization Managing changes Sanitary Authorization Status from pending to authorized.

Authorization Validity is informatical.
Sanitary Authorization Status exhibits Authorization Validity.
Authorization Validity of Sanitary Authorization Status ranges from 0 to 3 years.

SEREMI is physical.
SEREMI is environmental.
SEREMI supervises Domiciliary Hospitalization System.
Sanitary Authorization Managing requires SEREMI.

Quality and Safety Managing affects Domiciliary Hospitalization System.
Quality and Safety Managing requires Documentation System.
Coordination Professional handles Quality and Safety Managing.

Quality Level is informatical.
Domiciliary Hospitalization System exhibits Quality Level.
Quality and Safety Managing affects Quality Level.

Adverse Reaction Audit is informatical.
Quality and Safety Managing yields Adverse Reaction Audit.
Mortality Audit is informatical.
Quality and Safety Managing yields Mortality Audit.

Staff Training Managing affects Healthcare Team.
Staff Training Managing requires Annual Training Plan.
Coordination Professional handles Staff Training Managing.

Training Compliance is informatical.
Healthcare Team exhibits Training Compliance.
Training Compliance can be compliant or non-compliant.
Staff Training Managing changes Training Compliance from non-compliant to compliant.

Supply Chain Managing affects Clinical Supply.
Supply Chain Managing affects Medication.
Supply Chain Managing requires Pharmacy or Authorized Dispensary.
Coordination Professional handles Supply Chain Managing.

Waste Managing consumes Biomedical Waste.
Waste Managing requires Waste Disposal Area.
Waste Managing requires Waste Management Protocol.

Biomedical Waste is physical.

Sharps Disposal Protocol is informatical.
Waste Managing requires Sharps Disposal Protocol.

Equipment Maintenance Managing affects Medical Equipment.
Equipment Maintenance Managing changes Maintenance Status from overdue to current.
Technical Director handles Equipment Maintenance Managing.

Preventive Maintenance Program is informatical.
Equipment Maintenance Managing requires Preventive Maintenance Program.
```

### OPL-ES

```
**Sistema de Hospitalización Domiciliaria** exhibe *Gestionar Autorización Sanitaria* así como *Gestionar Calidad y Seguridad* así como *Gestionar Capacitación del Personal* así como *Gestionar Cadena de Abastecimiento* así como *Gestionar Residuos* así como *Gestionar Mantención de Equipos*.

*Gestionar Autorización Sanitaria* afecta **Sistema de Hospitalización Domiciliaria**.
*Gestionar Autorización Sanitaria* requiere **Normativa Vigente**.
**Director Técnico** maneja *Gestionar Autorización Sanitaria*.

**Estado de Autorización Sanitaria** es informatical.
**Sistema de Hospitalización Domiciliaria** exhibe **Estado de Autorización Sanitaria**.
**Estado de Autorización Sanitaria** puede estar `pendiente`, `autorizado` o `vencido`.
Estado `pendiente` de **Estado de Autorización Sanitaria** es inicial.
*Gestionar Autorización Sanitaria* cambia **Estado de Autorización Sanitaria** de `pendiente` a `autorizado`.

**Vigencia de Autorización** es informatical.
**Estado de Autorización Sanitaria** exhibe **Vigencia de Autorización**.
**Vigencia de Autorización** de **Estado de Autorización Sanitaria** varía de 0 a 3 años.

**SEREMI** es físico.
**SEREMI** es ambiental.
**SEREMI** supervisa **Sistema de Hospitalización Domiciliaria**.
*Gestionar Autorización Sanitaria* requiere **SEREMI**.

*Gestionar Calidad y Seguridad* afecta **Sistema de Hospitalización Domiciliaria**.
*Gestionar Calidad y Seguridad* requiere **Sistema Documental**.
**Profesional Coordinador** maneja *Gestionar Calidad y Seguridad*.

**Nivel de Calidad** es informatical.
**Sistema de Hospitalización Domiciliaria** exhibe **Nivel de Calidad**.
*Gestionar Calidad y Seguridad* afecta **Nivel de Calidad**.

**Auditoría de Reacciones Adversas** es informatical.
*Gestionar Calidad y Seguridad* genera **Auditoría de Reacciones Adversas**.
**Auditoría de Mortalidad** es informatical.
*Gestionar Calidad y Seguridad* genera **Auditoría de Mortalidad**.

*Gestionar Capacitación del Personal* afecta **Equipo de Salud**.
*Gestionar Capacitación del Personal* requiere **Plan Anual de Capacitación**.
**Profesional Coordinador** maneja *Gestionar Capacitación del Personal*.

**Cumplimiento de Capacitación** es informatical.
**Equipo de Salud** exhibe **Cumplimiento de Capacitación**.
**Cumplimiento de Capacitación** puede estar `cumple` o `no cumple`.
*Gestionar Capacitación del Personal* cambia **Cumplimiento de Capacitación** de `no cumple` a `cumple`.

*Gestionar Cadena de Abastecimiento* afecta **Insumo Clínico**.
*Gestionar Cadena de Abastecimiento* afecta **Medicamento**.
*Gestionar Cadena de Abastecimiento* requiere **Farmacia o Botiquín Autorizado**.
**Profesional Coordinador** maneja *Gestionar Cadena de Abastecimiento*.

*Gestionar Residuos* consume **Residuo Biomédico**.
*Gestionar Residuos* requiere **Área de Disposición de Residuos**.
*Gestionar Residuos* requiere **Protocolo de Manejo de Residuos**.

**Residuo Biomédico** es físico.

**Protocolo de Desecho de Cortopunzantes** es informatical.
*Gestionar Residuos* requiere **Protocolo de Desecho de Cortopunzantes**.

*Gestionar Mantención de Equipos* afecta **Equipamiento Médico**.
*Gestionar Mantención de Equipos* cambia **Estado de Mantención** de `vencido` a `vigente`.
**Director Técnico** maneja *Gestionar Mantención de Equipos*.

**Programa de Mantención Preventiva** es informatical.
*Gestionar Mantención de Equipos* requiere **Programa de Mantención Preventiva**.
```

---

## SD7 — Despliegue del Domicilio del Paciente (Condiciones de Elegibilidad)

### OPL-EN

```
Patient Home exhibits Home Condition as well as Basic Services as well as Telephony Access as well as Road Access.

Home Condition can be adequate or inadequate.
State adequate of Home Condition is final.

Basic Services is informatical.
Basic Services can be available or unavailable.
State available of Basic Services is initial.

Telephony Access is informatical.
Telephony Access can be available or unavailable.

Road Access is informatical.
Road Access can be within-coverage-radius or outside-coverage-radius.
State within-coverage-radius of Road Access is initial.

Patient Home exhibits Coverage Radius Compliance.
Coverage Radius Compliance is informatical.
Coverage Radius Compliance can be compliant or non-compliant.
```

### OPL-ES

```
**Domicilio del Paciente** exhibe **Condición del Domicilio** así como **Servicios Básicos** así como **Acceso a Telefonía** así como **Acceso Vial**.

**Condición del Domicilio** puede estar `adecuada` o `inadecuada`.
Estado `adecuada` de **Condición del Domicilio** es final.

**Servicios Básicos** es informatical.
**Servicios Básicos** puede estar `disponible` o `no disponible`.
Estado `disponible` de **Servicios Básicos** es inicial.

**Acceso a Telefonía** es informatical.
**Acceso a Telefonía** puede estar `disponible` o `no disponible`.

**Acceso Vial** es informatical.
**Acceso Vial** puede estar `dentro del radio de cobertura` o `fuera del radio de cobertura`.
Estado `dentro del radio de cobertura` de **Acceso Vial** es inicial.

**Domicilio del Paciente** exhibe **Cumplimiento de Radio de Cobertura**.
**Cumplimiento de Radio de Cobertura** es informatical.
**Cumplimiento de Radio de Cobertura** puede estar `cumple` o `no cumple`.
```

---

## SD8 — Exclusiones del Sistema (Condiciones que Impiden Ingreso)

### OPL-EN

```
Exclusion Condition is informatical.
Exclusion Condition can be absent or present.
State absent of Exclusion Condition is initial.

Clinical Instability Exclusion, Unestablished Diagnosis Exclusion, Decompensated Mental Health Exclusion, Unlisted Service Exclusion and Prior Disciplinary Discharge Exclusion are Exclusion Condition.

Eligibility Evaluating occurs if Exclusion Condition is absent, in which case Eligibility Evaluating changes Eligibility Status from pending to eligible, otherwise Eligibility Evaluating is skipped.
```

### OPL-ES

```
**Condición de Exclusión** es informatical.
**Condición de Exclusión** puede estar `ausente` o `presente`.
Estado `ausente` de **Condición de Exclusión** es inicial.

**Exclusión por Inestabilidad Clínica**, **Exclusión por Diagnóstico no Establecido**, **Exclusión por Salud Mental Descompensada**, **Exclusión por Prestación no Listada** y **Exclusión por Alta Disciplinaria Previa** son **Condición de Exclusión**.

*Evaluar Elegibilidad* ocurre si **Condición de Exclusión** está en `ausente`, en cuyo caso *Evaluar Elegibilidad* cambia **Estado de Elegibilidad** de `pendiente` a `elegible`, de lo contrario *Evaluar Elegibilidad* se omite.
```

---

## SD9 — Relaciones Estructurales Etiquetadas (Tagged Structural Links)

### OPL-EN

```
Inpatient Facility refers Patient Group.
Patient Home hosts Patient Group.
SEREMI supervises Domiciliary Hospitalization System.
Current Regulation governs Domiciliary Hospitalization System.
Technical Director represents Domiciliary Hospitalization System.
Domiciliary Hospitalization System guarantees Continuity of Care.
Continuity of Care is informatical.
Attending Physician coordinates Inpatient Facility.
Regulating Physician supports Attending Physician.
Caregiver cares-for Patient Group.
```

### OPL-ES

```
**Establecimiento de Atención Cerrada** deriva **Grupo de Pacientes**.
**Domicilio del Paciente** alberga **Grupo de Pacientes**.
**SEREMI** supervisa **Sistema de Hospitalización Domiciliaria**.
**Normativa Vigente** rige **Sistema de Hospitalización Domiciliaria**.
**Director Técnico** representa **Sistema de Hospitalización Domiciliaria**.
**Sistema de Hospitalización Domiciliaria** garantiza **Continuidad de la Atención**.
**Continuidad de la Atención** es informatical.
**Médico de Atención Directa** coordina con **Establecimiento de Atención Cerrada**.
**Médico Regulador** apoya a **Médico de Atención Directa**.
**Cuidador** cuida a **Grupo de Pacientes**.
```

---

## Validación del Modelo

### Checklist SD

| Check | Condición | Resultado | Severidad |
|-------|-----------|-----------|-----------|
| Sistema clasificado | Socio-técnico determinado | PASS | CRÍTICA |
| Purpose definido | Grupo de Pacientes + Condición Clínica + agudo/reagudizado → recuperado | PASS | CRÍTICA |
| Función definida | Hospitalizar en Domicilio + Grupo de Pacientes (transformee) | PASS | CRÍTICA |
| Enablers presentes | 1 agente (Equipo de Salud) + 4 instrumentos | PASS | ALTA |
| Environment identificado | 3 objetos ambientales (Domicilio, Establecimiento, Normativa) | PASS | MEDIA |
| Problem occurrence | Ocupar Cama Hospitalaria (proceso ambiental) → estado agudo/reagudizado | PASS | MEDIA |
| OPL legible | Sentencias OPL correctas en EN y ES | PASS | ALTA |
| Naming compliant | Gerundio EN / Infinitivo ES + singular + Group | PASS | ALTA |
| Exhibition | Sistema exhibe proceso principal | PASS | ALTA |
| Agents = humanos | Equipo de Salud es grupo humano; equipos y sistemas son instrumentos | PASS | ALTA |

### Checklist SD1

| Check | Condición | Resultado | Severidad |
|-------|-----------|-----------|-----------|
| Subprocesos transforman | Cada subproceso ≥1 transformee | PASS | CRÍTICA |
| Refinamiento correcto | Secuencial → in-zooming | PASS | ALTA |
| Links distribuidos | Consumption/result NO en outer contour | PASS | CRÍTICA |
| Split links resueltos | Effect sobre Condición Clínica asignado a Monitorear Evolución | PASS | ALTA |
| Estados expresados | Estados de Plan Terapéutico, Consentimiento, etc. visibles | PASS | ALTA |
| Sin redundancia | Hechos no duplicados innecesariamente | PASS | MEDIA |

### Checklist Global

| Check | Condición | Resultado | Severidad |
|-------|-----------|-----------|-----------|
| Claridad | Ningún OPD excede 20 entidades | PASS | MEDIA |
| Name coherency | Sin nombres duplicados | PASS | ALTA |
| Implicit objects | Objetos implícitos en normativa identificados (Cuidador, Red de Apoyo, Condición de Exclusión) | PASS | ALTA |
| Emergencia arquitectural | El sistema produce atención hospitalaria en domicilio — capacidad emergente que ningún componente individual exhibe | PASS | MEDIA |

---

## Resumen de OPDs del Modelo

| OPD | Contenido | Entidades |
|-----|-----------|-----------|
| SD | Sistema HODOM — función, propósito, habilitadores, ambiente, problem occurrence | 16 |
| SD1 | Descomposición de Hospitalizar en Domicilio — 6 subprocesos secuenciales | 19 |
| SD1.1 | Evaluar Elegibilidad — 4 subprocesos | 12 |
| SD1.2 | Ingresar Paciente — 4 subprocesos | 11 |
| SD1.3 | Planificar Atención — 4 subprocesos | 10 |
| SD1.4 | Ejecutar Plan Terapéutico — 6 subprocesos paralelos | 22 |
| SD1.5 | Monitorear Evolución Clínica — 4 subprocesos con decisión | 14 |
| SD1.6 | Egresar (generalización) — 5 tipos de egreso | 16 |
| SD2 | Equipo de Salud — 9 roles con atributos | 20 |
| SD3 | Infraestructura Administrativa — 11 componentes con atributos | 18 |
| SD4 | Equipamiento Médico — 6 dispositivos con atributos | 10 |
| SD5 | Sistema Documental — manuales, protocolos, plan de capacitación | 22 |
| SD6 | Procesos de Gobernanza — 6 operaciones del sistema | 20 |
| SD7 | Domicilio del Paciente — condiciones de elegibilidad | 8 |
| SD8 | Exclusiones — 5 tipos de condición excluyente | 7 |
| SD9 | Relaciones estructurales etiquetadas inter-entidad | 10 |
| **Total** | **16 OPDs** | **~235 entidades** |
