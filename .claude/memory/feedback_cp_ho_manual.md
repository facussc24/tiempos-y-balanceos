---
name: CP y HO se regeneran manualmente
description: NUNCA regenerar CP desde AMFE ni HO desde CP de forma automatica. Solo alertas de desincronizacion.
type: feedback
---

CP y HO se regeneran MANUALMENTE, no de forma automatica.

**Why:** Fak necesita control total sobre que items pasan del AMFE al CP y del CP a la HO. La regeneracion automatica puede sobreescribir ajustes manuales que el equipo APQP ya hizo (filtrados, responsables, frecuencias de muestreo, planes de reaccion).

**How to apply:**
- NUNCA ejecutar scripts que regeneren CP desde AMFE automaticamente
- NUNCA ejecutar scripts que regeneren HO desde CP automaticamente
- SI implementar/mantener un sistema de ALERTAS que notifique cuando:
  - El AMFE tiene operaciones o modos de falla nuevos que no estan cubiertos en el CP
  - El CP tiene items nuevos que no estan reflejados en la HO
  - Los nombres de operacion difieren entre AMFE/CP/HO
  - Los responsables no coinciden entre CP y HO
- Las alertas existentes ya estan en:
  - `utils/crossDocumentAlerts.ts` (cascada PFD->AMFE->CP->HO)
  - `utils/pfdAmfeLinkValidation.ts` (PFD <-> AMFE)
  - `utils/hoCpLinkValidation.ts` (HO <-> CP)
  - `modules/controlPlan/cpCrossValidation.ts` (CP interna + vs AMFE)
- Cuando Fak pida "regenerar CP" o "actualizar HO": hacerlo MANUALMENTE, item por item, con su revision
