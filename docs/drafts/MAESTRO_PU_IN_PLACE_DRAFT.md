# DRAFT v3 — Maestro AMFE Inyección PUR in place

**Estado:** Borrador para revisión Leonardo (NO aplicado a Supabase)
**Fecha:** 2026-05-22 (v3 — lenguaje simple aplicado, criterios CC/SC alineados a manual AIAG-VDA pag 129)
**Family code:** 17 (decidido por Fak)
**Family name:** Proceso de Inyección PUR in place
**AMFE master number:** AMFE-MAESTRO-PU-001
**Replicación:** HF-PAT / HRC-PAT / HRO-PAT (1 OP en cada uno, el maestro NO se alinea con HO)

---

## Cambios v2 → v3

1. **Modos de falla en lenguaje simple** (regla `amfe.md` "máximo 8-10 palabras, sin sinónimos rebuscados")
2. **FM-LEG** mantiene **CC ▽** (S=9, requerimiento legal)
3. **FM-8 reclasificado como OS** (Seguridad del Operador) si O≥4 — alineado a manual SETEC pag 129
4. **Criterios CC/SC/OS/HI alineados al manual oficial** — regla `amfe.md` actualizada en este mismo commit

---

## Cabecera del maestro

| Campo | Valor |
|---|---|
| family_id | 17 |
| family.name | Proceso de Inyección PUR in place |
| amfe_number | AMFE-MAESTRO-PU-001 |
| Organización | BARACK MERCOSUL |
| Aprobador (Ingeniería) | Carlos Baptista |
| Revisado (Calidad) | Manuel Meszaros |
| Aprobación planta | Gonzalo Cal |
| Core team | Carlos Baptista, Manuel Meszaros, Marianna Vera |

---

## Operación única — OP 10 INYECCIÓN PUR IN PLACE

**focusElementFunction** (Función del Item, 3 niveles AIAG-VDA):
> Interno: Proveer apoyacabezas con espuma PU consolidada, geometría conforme y funda sellada sin defectos visibles
> / Cliente: Permitir montaje en el respaldo del asiento VW sin interferencia ni desviación dimensional
> / Usuario Final: Brindar confort y soporte ergonómico al pasajero, con apariencia estética y vida útil prolongada

**operationFunction** (Función del Paso):
> Espumar el conjunto funda+varilla en molde mediante inyección de mezcla Poliol/Isocianato

---

## Work Elements (8, 6M completo)

| # | Tipo | Nombre | Función (lenguaje simple) |
|---|---|---|---|
| WE-1 | Material | Poliol (componente A) | Aportar el componente A para la reacción PU |
| WE-2 | Material | Isocianato (componente B) | Aportar el componente B para la reacción PU |
| WE-3 | Machine | Inyectora PU con dosificadora A:B | Mezclar y dosificar los componentes |
| WE-4 | Machine | Molde de espumado climatizado (carrusel automático) | Dar forma a la pieza durante el espumado y curado |
| WE-5 | Method | Dossier de parámetros del proceso | Documentar los parámetros del ciclo |
| WE-6 | Man | Operador de Producción | Cargar moldes, retirar piezas, accionar STOP en emergencia |
| WE-7 | Measurement | Balanza dosificación + cronómetro + termómetro de molde | Medir los parámetros del ciclo |
| WE-8 | Environment | Ventilación de gases + temperatura ambiente | Mantener condiciones de planta estables |

---

## Failure Modes — 9 totales en lenguaje simple

**Convención etiquetas (para Excel):**
- 🟢 [PPT] = PPT Woodbridge
- 🔵 [HO] = HO-968 AMAROK
- 🟡 [PLANO] = plano VW
- 🔴 [TBD-Leo] = confirmar con Leonardo

---

### FM-LEG — Pieza PU no cumple norma legal VW ▽ **CC**

| Campo | Valor |
|---|---|
| Modo de falla | Pieza no cumple flamabilidad TL 1010 o emisiones VW 50180 o ELV |
| Efecto local | Lote rechazado en ensayo de laboratorio. SCRAP. |
| Efecto siguiente | Rechazo PPAP, parada de lanzamiento, no conformidad mayor |
| Efecto usuario final | **Riesgo de incendio o inhalación de gases. Incumplimiento legal.** |
| **Severidad** | **9** |
| **Clasificación** | **CC ▽** (S=9, requerimiento legal VW) 🟡 |
| Causa 1 🟡 | Lote PU del proveedor fuera de espec |
| Causa 2 🔴 | Mezcla iso/poliol mal hecha en planta |
| Causa 3 🔴 | Contaminación con sustancias prohibidas REACH/ELV |
| Control preventivo | 🔴 TBD-Leo |
| Control detectivo | 🔴 TBD-Leo |

---

### FM-1 — Las capas de la pieza se despegan (delaminación)

| Campo | Valor |
|---|---|
| Modo de falla | Las capas funda/espuma/sustrato se despegan entre sí |
| Efecto local | Se nota una bolsa entre capas. La tela se mueve sola al apretar |
| Efecto siguiente | SCRAP. No se puede retrabajar. |
| Efecto usuario final | Apoyacabezas con defecto visible y estructura comprometida |
| Severidad | 6 |
| Clasificación | SC si O≥4 (depende de Leo) |
| Causa 1 🟢 | Superficie de funda contaminada antes del espumado |
| Causa 2 🟢 | Temperatura de molde fuera de rango |
| Causa 3 🟢 | Ratio iso/poliol fuera de especificación |
| Control preventivo | 🔴 TBD-Leo |
| Control detectivo | 🔴 TBD-Leo |

---

### FM-2 — Huecos dentro de la espuma

| Campo | Valor |
|---|---|
| Modo de falla | La espuma queda con cavidades vacías por dentro |
| Efecto local | Pieza con burbujas visibles o zonas que se hunden al palpar |
| Efecto siguiente | SCRAP |
| Efecto usuario final | Confort comprometido y pieza estructuralmente débil |
| Severidad | 6 |
| Clasificación | SC si O≥4 |
| Causa 1 🟢 | Peso de inyección insuficiente |
| Causa 2 🟢 | Mezcla A:B incompleta |
| Causa 3 🔴 | Venteo del molde obstruido |
| Control preventivo | 🔴 TBD-Leo |
| Control detectivo | 🔴 TBD-Leo |

---

### FM-3 — Espuma con partículas extrañas (contaminación)

| Campo | Valor |
|---|---|
| Modo de falla | Partículas extrañas o suciedad dentro de la espuma |
| Efecto local | Manchas oscuras o pintas visibles en la espuma |
| Efecto siguiente | SCRAP. Posible rechazo de lote por riesgo VOC |
| Efecto usuario final | Defecto estético + **riesgo VW 50180 emisiones** |
| Severidad | 7 |
| Clasificación | SC si O≥4 |
| Causa 1 🟢 | Molde sucio (restos de PU de ciclos anteriores) |
| Causa 2 🟢 | Bidones de poliol/isocianato contaminados |
| Causa 3 🔴 | Boquilla con residuos sin purgar entre ciclos |
| Control preventivo | 🔴 TBD-Leo |
| Control detectivo | 🔴 TBD-Leo (¿hay ensayo VOC por lote?) |

---

### FM-4 — Zonas duras en la espuma

| Campo | Valor |
|---|---|
| Modo de falla | Zonas localizadas más rígidas que el resto de la espuma |
| Efecto local | Dureza dispareja al apretar la pieza con la mano |
| Efecto siguiente | SCRAP |
| Efecto usuario final | Confort comprometido, sensación dispareja al apoyar la cabeza |
| Severidad | 5 |
| Clasificación | SC si O≥4 |
| Causa 1 🟢 | Mezclador desgastado o mantenimiento vencido |
| Causa 2 🟢 | Ratio iso/poliol incorrecto |
| Causa 3 🔴 | Temperatura de los componentes fuera de rango |
| Control preventivo | 🔴 TBD-Leo |
| Control detectivo | 🔴 TBD-Leo (¿test de dureza Shore por muestreo?) |

---

### FM-5 — Se escapa mezcla líquida del molde (fuga de PU)

| Campo | Valor |
|---|---|
| Modo de falla | La mezcla PU se escapa del molde durante la inyección |
| Efecto local | Pieza descartada + molde contaminado + parada para limpiar |
| Efecto siguiente | Productivo (no llega al cliente) |
| Efecto usuario final | N/A |
| Severidad | 4 |
| Clasificación | NO califica (S<5) |
| Causa 1 🔵 | El vinilo no abraza la varilla — sello deficiente |
| Causa 2 🟢 | Funda con apertura mal cosida (origen costura) |
| Causa 3 🔵 | Bolsa atrapada al cerrar el molde |
| Causa 4 🔵 | Boquilla queda fuera de la bolsa |
| Causa 5 🔵 | Clamps de fijación mal cerrados |
| Control preventivo | Verificación visual del operario al cerrar el molde |
| Control detectivo | Visual durante el ciclo (operario detecta la fuga) |

---

### FM-6 — Pieza queda fuera de posición o forma

| Campo | Valor |
|---|---|
| Modo de falla | Apoyacabezas queda descentrado o con geometría incorrecta tras el espumado |
| Efecto local | Pieza fuera de tolerancia dimensional |
| Efecto siguiente | SCRAP. No se monta en el respaldo del asiento |
| Efecto usuario final | Apoyacabezas desviado visible o no funcional |
| Severidad | 6 |
| Clasificación | SC si O≥4 |
| Causa 1 🔵 | Bolsita no colocada o mal orientada |
| Causa 2 🔵 | Astas mal calzadas en las guías del molde |
| Causa 3 🔵 | Marcas de las astas no coinciden con las del molde |
| Causa 4 🔵 | Vinilo o funda sobresale y queda atrapado al cerrar |
| Control preventivo | Verificación visual antes de cerrar molde (HO OP 60) |
| Control detectivo | 🔴 TBD-Leo (¿control dimensional al desmoldeo?) |

---

### FM-7 — Pieza sale del molde sin curar bien

| Campo | Valor |
|---|---|
| Modo de falla | El ciclo de inyección/curado se interrumpe o se completa fuera de condiciones |
| Efecto local | Pieza no consolidada o deformada al sacar del molde |
| Efecto siguiente | SCRAP |
| Efecto usuario final | Pieza con dureza, recuperación o durabilidad alteradas |
| Severidad | 6 |
| Clasificación | SC si O≥4 |
| Causa 1 🔵 | Máquina sale del modo automático sin que el operario lo detecte |
| Causa 2 🔵 | Operario interviene durante el curado |
| Causa 3 🔴 | Falla del PLC o temporizador del ciclo |
| Causa 4 🔴 | Corte de energía durante el ciclo |
| Control preventivo | 🔴 TBD-Leo |
| Control detectivo | 🔴 TBD-Leo |

---

### FM-8 — Riesgo al operario por mal uso del STOP **OS**

| Campo | Valor |
|---|---|
| Modo de falla | Ante emergencia, el operario no acciona el STOP de la máquina |
| Efecto local | Daño al equipo + **riesgo de lesión al operario** |
| Efecto siguiente | N/A (incidente interno de seguridad) |
| Efecto usuario final | N/A |
| Severidad | 8 |
| **Clasificación** | **OS** (Seguridad del Operador) si O≥4 — manual SETEC pag 129. Efecto en MANUFACTURA + seguridad. |
| Causa 1 🔵 | Instructivo de emergencia incompleto en la estación |
| Causa 2 🔴 | Botón STOP fuera del alcance inmediato del operario |
| Causa 3 🔴 | Señalética de emergencia no visible |
| Control preventivo | 🔴 TBD-Leo (¿protocolo escrito? ¿simulacros?) |
| Control detectivo | 🔴 TBD-Leo (¿observación supervisor?) |

⚠ **"Capacitación" prohibido como causa** por regla `amfe.md`. Por eso reformulé como causas del SISTEMA (instructivo, botón, señalética).

---

## Resumen severidades + clasificaciones

| FM | S | Clasif. | Cuándo se confirma |
|---|---|---|---|
| **FM-LEG** | **9** | **CC ▽** ✅ | Confirmado (S=9 legal) |
| FM-1 Delaminación | 6 | SC ? | Si O≥4 |
| FM-2 Huecos | 6 | SC ? | Si O≥4 |
| FM-3 Contaminación | 7 | SC ? | Si O≥4 |
| FM-4 Zonas duras | 5 | SC ? | Si O≥4 |
| FM-5 Fuga PU | 4 | Estándar | S<5 no califica |
| FM-6 Fuera de posición | 6 | SC ? | Si O≥4 |
| FM-7 Ciclo incompleto | 6 | SC ? | Si O≥4 |
| **FM-8 Riesgo operario** | **8** | **OS ?** | Si O≥4 |

**Total:** 9 FMs. 1 CC confirmado. 7 potenciales SC (depende de O). 1 potencial OS. 1 estándar.

→ **Las clasificaciones finales se cierran cuando Leonardo defina Ocurrencia (O) de cada causa.**

---

## Pendientes para Leonardo

Doc completo: `docs/drafts/PREGUNTAS_LEONARDO_PU.md`. Prioridades:

1. **Bloque F** — controles preventivos y detectivos (todos TBD hoy)
2. **Bloque D** — confirmar que los 5 defectos del PPT aplican a Patagonia
3. **O** de cada causa (no la sabemos sin Leo)
4. **Bloque G** — EPP químico adicional (respirador, antiparras, guantes térmicos)
5. **Bloque I** — reprocesos (¿retrabajables o siempre SCRAP?)

## Próximo paso técnico

Cuando Fak/Leonardo aprueben este v3: script `.mjs` con `supabase-safety` para crear family 17 + AMFE-MAESTRO-PU-001 en Supabase y replicar a los 3 Headrest. Ver `PLAN_APLICACION_MAESTRO_PU.md`.
