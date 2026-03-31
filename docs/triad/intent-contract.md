# Intent Contract — OPModel / siguiente fase

Fecha: 2026-03-29
Origen: Allan Kelly
Ámbito: `/home/felix/projects/opmodel`

## Beneficiario
El operador que necesita una herramienta principal confiable para modelar sistemas reales y coordinar handoff con steipete y Clawforge.

## Cambio deseado
Llevar OPModel de workbench OPM sofisticado a superficie operativa estable para 3 flujos reales:
- modelar **as-is**
- diseñar **to-be**
- encuadrar **proyectos nuevos**

## Beneficio esperado
- Menos ambigüedad estructural
- Mejor calidad de handoff
- Una base única de modelamiento que soporte decisiones e implementación sin reinterpretación constante

## Criterio de éxito
OPModel puede usarse de punta a punta en 3 casos reales del operador, con:
- build web funcional
- suite canónica en verde
- artefacto de salida utilizable por steipete y visible para Clawforge

## Eval mínima
1. Cerrar baseline técnica:
   - runner canónico funcionando
   - tests críticos en verde
   - web buildando
2. Ejecutar 3 casos reales:
   - un **as-is**
   - un **to-be**
   - un **proyecto nuevo**
3. En los 3 casos, el modelo debe producir:
   - una decisión concreta
   - un handoff usable sin reexplicar desde cero

## Límite de autonomía
steipete puede:
- estabilizar
- reparar
- simplificar
- definir el flujo canónico dentro del monorepo

steipete no debe:
- expandir nuevas capacidades grandes
- rediseñar el producto desde cero
- abrir nuevas superficies sin validación humana

## Riesgo principal
Seguir agregando sofisticación metodológica o visual sobre una base que todavía no está cerrada como herramienta principal, convirtiendo OPModel en laboratorio brillante pero no en instrumento operativo confiable.
