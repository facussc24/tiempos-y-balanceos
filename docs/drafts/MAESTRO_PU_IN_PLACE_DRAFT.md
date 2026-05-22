# DRAFT — Maestro AMFE Inyección PUR in place (v2)

**Estado:** Borrador para revisión Fak/Leonardo (NO aplicado a Supabase)
**Fecha:** 2026-05-22 (actualizado v2)
**Family code propuesto:** 17
**Family name propuesto:** Proceso de Inyección PUR in place
**AMFE master number propuesto:** AMFE-MAESTRO-PU-001
**Replicación destino:** HF-PAT (1 OP local), HRC-PAT (1 OP local), HRO-PAT (1 OP local)

---

## Decisiones cerradas (Fak 2026-05-22)

| # | Tema | Valor |
|---|---|---|
| 1 | Alcance | Solo 3 Headrest Patagonia |
| 2 | Granularidad del maestro | **1 sola OP "INYECCIÓN PUR IN PLACE"** |
| 3 | Familias | family code **17** (siguiente libre) |
| 4 | Defectos del PPT Woodbridge | Todos los 5 producto-orientados se incluyen (no se descartan) |
| 5 | Numeración HO vs AMFE | El maestro NO se alinea con HO (HOs son externas a Barack — ver regla `no-ho-barack.md`) |
| 6 | CC del PU (TL 1010 / VW 50180 / EU ELV) | 3 normas → 1 FM consolidado **CC** (FM-LEG) |
| 7 | Parámetros numéricos (ratio, T, tiempos, presión) | NO van en AMFE — van en CP futuro |

---

## Estructura del maestro

### Cabecera (header)

| Campo | Valor |
|---|---|
| `family_id` | 17 |
| `family.name` | Proceso de Inyección PUR in place |
| `amfe_number` | AMFE-MAESTRO-PU-001 |
| Organización | BARACK MERCOSUL |
| Cliente del maestro | N/A (genérico, no vinculado a cliente único) |
| Aprobador (Ingeniería) | Carlos Baptista |
| Revisado (Calidad) | Manuel Meszaros |
| Aprobación planta | Gonzalo Cal |
| Core team | Carlos Baptista, Manuel Meszaros, Marianna Vera |

### Operación única — INYECCIÓN PUR IN PLACE

**focusElementFunction** (3 niveles AIAG-VDA):
> Interno: Proveer apoyacabezas con espuma PU consolidada, geometría conforme y funda sellada sin defectos visibles
> / Cliente: Permitir montaje en el respaldo del asiento VW sin interferencia ni desviación dimensional
> / Usuario Final: Brindar confort y soporte ergonómico al pasajero, con apariencia estética y vida útil prolongada

**operationFunction:**
> Espumar el conjunto funda+varilla en molde mediante inyección de mezcla Poliol/Isocianato, asegurando consolidación de la pieza sin fugas, huecos ni defectos

### Work Elements (8 — siguiendo 6M + 1M por línea)

| # | Tipo | Nombre | Función |
|---|---|---|---|
| WE-1 | Material | Poliol (componente A) | Aportar componente reactivo de la mezcla PU |
| WE-2 | Material | Isocianato (componente B) | Aportar componente reactivo para la polimerización |
| WE-3 | Machine | Inyectora PU con dosificadora A:B | Mezclar y dosificar componentes |
| WE-4 | Machine | Molde de espumado climatizado (carrusel automático) | Conformar la geometría durante el espumado y curado |
| WE-5 | Method | Dossier de parámetros del proceso | Documentar parámetros validados (ratio, temperaturas, tiempos, presión) |
| WE-6 | Man | Operador de Producción | Cargar moldes, verificar arranque, retirar piezas, STOP de emergencia |
| WE-7 | Measurement | Balanza de dosificación + cronómetro + termómetro de molde | Medir parámetros críticos del ciclo |
| WE-8 | Environment | Ventilación de gases + temperatura ambiente controlada | Condiciones de planta estables + protección operario |

---

## 9 Failure Modes consolidados

**Convención de etiquetas (para Excel):**
- 🟢 **[PPT]** = del documento Woodbridge oficial → en verde
- 🔵 **[HO]** = de la HO-968 oficial AMAROK → en verde
- 🟡 **[PLANO]** = del plano VW de Fak → en verde
- 🔴 **[TBD-Leo]** = propuesta mía → en **rojo** con TBD al lado

### FM-LEG — Pieza espumada no cumple norma legal VW (**CC**)

| Campo | Valor |
|---|---|
| Modo de falla | Pieza PU terminada no cumple TL 1010 (flamabilidad) Y/O VW 50180 (emisiones VOC) Y/O EU 2000/53/EG (sustancias prohibidas ELV) |
| Efecto local | Lote rechazado en ensayo → SCRAP del lote completo |
| Efecto siguiente nivel | Rechazo PPAP, detención del lanzamiento, no conformidad mayor, multa contractual |
| Efecto usuario final | **Riesgo de incendio / inhalación VOC / incumplimiento legal regulatorio** |
| **Severidad** | **9** |
| **Clasificación** | **CC** (Crítica) 🟡[PLANO] |
| Causa 1 🟡[PLANO] | Fórmula PU del proveedor fuera de espec |
| Causa 2 🔴[TBD-Leo] | Mezcla incorrecta iso/poliol que altera comportamiento al fuego |
| Causa 3 🔴[TBD-Leo] | Contaminación con sustancias prohibidas REACH/ELV |
| Control preventivo | 🔴[TBD-Leo] — F2 a Leonardo |
| Control detectivo | 🔴[TBD-Leo] — ensayo TL 1010 + VOC + IMDS |

### FM-1 — Delaminación entre capas funda/espuma/sustrato

| Campo | Valor |
|---|---|
| Modo de falla | Desunión visible entre cobertura, espuma y/o sustrato |
| Efecto local | Pieza con delaminación |
| Efecto siguiente nivel | SCRAP, no retrabajable |
| Efecto usuario final | Defecto estético + falla estructural |
| Severidad | 6 |
| Causa 1 🟢[PPT] | Adhesión PU/funda insuficiente por contaminación de superficie |
| Causa 2 🟢[PPT] | Temperatura de molde fuera de rango |
| Causa 3 🟢[PPT] | Ratio Iso/Poliol fuera de especificación |
| Control preventivo | 🔴[TBD-Leo] |
| Control detectivo | 🔴[TBD-Leo] |

### FM-2 — Huecos en la espuma (Voids)

| Campo | Valor |
|---|---|
| Modo de falla | Huecos / burbujas internas en la espuma PU |
| Efecto local | Cavidades visibles o palpables |
| Efecto siguiente nivel | SCRAP |
| Efecto usuario final | Confort comprometido, pérdida estructural |
| Severidad | 6 |
| Causa 1 🟢[PPT] | Dosificación corta (peso shot insuficiente) |
| Causa 2 🟢[PPT] | Mezcla incompleta de componentes A:B |
| Causa 3 🔴[TBD-Leo] | Venteo del molde obstruido |
| Control preventivo | 🔴[TBD-Leo] |
| Control detectivo | 🔴[TBD-Leo] |

### FM-3 — Contaminación en la espuma

| Campo | Valor |
|---|---|
| Modo de falla | Partículas extrañas / suciedad visible |
| Efecto local | Pieza con contaminación visible |
| Efecto siguiente nivel | SCRAP. Posible rechazo de lote por riesgo VOC. |
| Efecto usuario final | Defecto estético + **riesgo VW 50180** |
| Severidad | 7 |
| Causa 1 🟢[PPT] | Molde sucio (residuos de PU de ciclos anteriores) |
| Causa 2 🟢[PPT] | Bidones poliol/isocianato contaminados en recepción |
| Causa 3 🔴[TBD-Leo] | Boquilla con residuos no purgada entre ciclos |
| Control preventivo | 🔴[TBD-Leo] |
| Control detectivo | 🔴[TBD-Leo] |

### FM-4 — Zonas duras en la espuma (Hard spots)

| Campo | Valor |
|---|---|
| Modo de falla | Endurecimientos localizados en la espuma |
| Efecto local | Dureza dispareja al tacto |
| Efecto siguiente nivel | SCRAP |
| Efecto usuario final | Confort comprometido, sensación dispareja |
| Severidad | 5 |
| Causa 1 🟢[PPT] | Mal mezclado de componentes A:B |
| Causa 2 🟢[PPT] | Ratio Iso/Poliol incorrecto |
| Causa 3 🔴[TBD-Leo] | Temperatura de componentes fuera de rango operativo |
| Control preventivo | 🔴[TBD-Leo] |
| Control detectivo | 🔴[TBD-Leo] |

### FM-5 — Fuga de espuma PU durante inyección

| Campo | Valor |
|---|---|
| Modo de falla | Mezcla PU escapa del molde durante el ciclo |
| Efecto local | Pieza descartada + contaminación del molde + parada para limpieza |
| Efecto siguiente nivel | No llega al cliente (productivo) |
| Efecto usuario final | N/A |
| Severidad | 4 |
| Causa 1 🔵[HO] | Sello vinilo/varilla deficiente (OP previa de tapizado) |
| Causa 2 🟢[PPT] | Funda con apertura mal cosida (origen costura) |
| Causa 3 🔵[HO] | Bolsa atrapada al cerrar molde |
| Causa 4 🔵[HO] | Boquilla queda fuera de la bolsa |
| Causa 5 🔵[HO] | Clamps de fijación mal cerrados |
| Control preventivo | Inspección visual operario al cerrar molde |
| Control detectivo | Visual durante ciclo |

### FM-6 — Apoyacabezas fuera de posición / geometría

| Campo | Valor |
|---|---|
| Modo de falla | Pieza queda mal posicionada o con geometría incorrecta tras el espumado |
| Efecto local | Pieza descentrada, fuera de tolerancia dimensional |
| Efecto siguiente nivel | SCRAP — no monta en respaldo del asiento |
| Efecto usuario final | Apoyacabezas con desviación visible o no funcional |
| Severidad | 6 |
| Causa 1 🔵[HO] | Bolsita no colocada o mal orientada |
| Causa 2 🔵[HO] | Astas mal calzadas en guías del molde |
| Causa 3 🔵[HO] | Marca de astas no coincide con marca del molde |
| Causa 4 🔵[HO] | Vinilo/funda sobresalen y son atrapados al cerrar |
| Control preventivo | Verificación visual operario antes de cerrar molde |
| Control detectivo | 🔴[TBD-Leo] — control dimensional al desmoldeo |

### FM-7 — Ciclo automático incompleto / curado defectuoso

| Campo | Valor |
|---|---|
| Modo de falla | Ciclo se interrumpe o se completa fuera de condiciones requeridas |
| Efecto local | Pieza no consolidada, deformación al sacar |
| Efecto siguiente nivel | SCRAP |
| Efecto usuario final | Pieza con propiedades alteradas (dureza, recuperación, durabilidad) |
| Severidad | 6 |
| Causa 1 🔵[HO] | Máquina sale del modo automático sin que el operario detecte |
| Causa 2 🔵[HO] | Operario interviene durante el curado |
| Causa 3 🔴[TBD-Leo] | Falla del PLC / temporizador del ciclo |
| Causa 4 🔴[TBD-Leo] | Corte de energía durante el ciclo |
| Control preventivo | 🔴[TBD-Leo] |
| Control detectivo | 🔴[TBD-Leo] |

### FM-8 — Riesgo al operario por mal uso del STOP de emergencia (Seguridad)

| Campo | Valor |
|---|---|
| Modo de falla | Ante anomalía/emergencia, el operario no acciona el STOP de emergencia |
| Efecto local | Daño a equipo + **riesgo de lesión al operario** |
| Efecto siguiente nivel | N/A (incidente interno) |
| Efecto usuario final | N/A |
| Severidad | 8 |
| Causa 1 🔵[HO] | Operario no aplica el protocolo de emergencia (instructivo incompleto) |
| Causa 2 🔴[TBD-Leo] | Botón STOP fuera del alcance inmediato del operario |
| Causa 3 🔴[TBD-Leo] | Señalética de emergencia no visible en la estación |
| Control preventivo | 🔴[TBD-Leo] — G3 a Leonardo |
| Control detectivo | 🔴[TBD-Leo] — supervisor + simulacros periódicos |

---

## Resumen severidades

| FM | Severidad | CC/SC | Notas |
|---|---|---|---|
| FM-LEG | **9** | **CC** ✅ | Norma legal VW |
| FM-1 Delaminación | 6 | — | |
| FM-2 Huecos | 6 | — | |
| FM-3 Contaminación | 7 | — | Puede tocar VW 50180 |
| FM-4 Zonas duras | 5 | — | |
| FM-5 Fuga PU | 4 | — | Productivo, no usuario |
| FM-6 Fuera de posición | 6 | — | |
| FM-7 Ciclo incompleto | 6 | — | |
| FM-8 Riesgo operario | 8 | — | Seguridad personal |

**Total:** 9 FMs, 1 CC (FM-LEG), 0 SC.

---

## Pendientes para Leonardo (resumen)

Doc completo: `docs/drafts/PREGUNTAS_LEONARDO_PU.md` (12 bloques, ~50 preguntas).

**Priorizadas para esta reunión:**

1. **Controles preventivos y detectivos** (bloque F) — TODOS los FMs los necesitan
2. Confirmar/agregar causas 🔴[TBD-Leo]
3. Validar severidades propuestas
4. ¿Hay CC/SC adicionales marcados por VW en el PPAP oficial?
5. Decidir Etapa 2: ¿Maestro de Recepción de químicos PU separado?

---

## Próximo paso técnico

Cuando Fak/Leonardo aprueben el AMFE: script `.mjs` con `supabase-safety` (backup + dry-run + runWithValidation) para crear family 17 + AMFE-MAESTRO-PU-001 en Supabase y replicar a HF-PAT/HRC-PAT/HRO-PAT.
