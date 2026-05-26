# DRAFT v4 — Maestro AMFE Inyección PUR in place

**Estado:** Borrador para revisión Leonardo + validación del Panel de 4 Validators (NO aplicado a Supabase)
**Fecha:** 2026-05-26 (v4 — hallazgos Liqin TP900 integrados)
**Family code:** 17 (decidido por Fak)
**Family name:** Proceso de Inyección PUR in place
**AMFE master number:** AMFE-MAESTRO-PU-001
**Replicación:** HF-PAT / HRC-PAT / HRO-PAT (1 OP en cada uno, el maestro NO se alinea con HO)

---

## Cambios v3 → v4

### Hallazgos Liqin integrados (4 reportes en `docs/drafts/liqin-analysis/`)

1. **+1 FM nuevo confirmado: FM-10 Ratio iso/poliol fuera de spec por falla del flujómetro POLY/ISO** (S=9, CC). Fuente: manual TP900 "alarma cuando el caudal supera la desviación, con parada de la pulverización".
2. **+1 FM nuevo TBD-Leo: FM-11 Atmósfera explosiva ATEX por vapores ISO/POLY**. Fuente: secuencia obs. técnicas (barreras Zener CSB519-EX22 pág 113). Severidad y controles TBD-Leo hasta confirmar ventilación forzada + sensores de gas en Barack.
3. **Causas nuevas en FMs existentes** (todas con fuente Liqin documentada):
   - FM-LEG +2 causas: agitador parado (E23/E24), variador desincronizado (FASE 5)
   - FM-1 +1 causa: arranque sin alcanzar setpoint temperatura (FASE 4 obs.)
   - FM-2 +1 causa: aire en línea por nivel bajo tanque (AI 2/AI 3)
   - FM-4 +2 causas: falla chiller (E34), agitador parado (E23/E24)
   - FM-5 +2 causas: sobrepresión bomba (E66/E67), sistema hidráulico degradado (aceite/enfriador)
   - FM-6 +2 causas: plato sin indexar (E56/E57), plataforma desnivelada (install paso 2)
   - FM-7 +3 causas: aceite degradado/>55°C, enfriador no operativo, 3 preselecciones no activas (manual 5.4.4)
   - FM-8 reformulado: 5 ESTOPs confirmados, causa 4 nueva (interlock valla inoperativo)

### Ajustes estructurales a Work Elements (corrección de regla 1M por línea)

4. **WE-7 v3 "Balanza dosificación + cronómetro + termómetro de molde" CONTRADICE el manual**. La dosificación es por flujómetros electrónicos (E0.0-E0.3) + variadores SINAMICS G120 (AQW0/AQW1). NO hay balanza.
5. **WE-7 y WE-8 v3 violan regla 1M por línea** (agrupan 2-3 items). Separados en v4:
   - WE-7: Flujómetros POLY/ISO (caudalímetros)
   - WE-8: Sensores RTD PT100 (temperatura)
   - WE-9: Sensores 4-20 mA (presión)
   - WE-10: Ventilación de gases POLY/ISO
   - WE-11: Temperatura ambiente planta
6. Total WEs: pasa de 8 a 11.

### Controles preventivos y detectivos concretos (Bloque F resuelto en parte)

7. **14 controles preventivos concretos** documentados (alarmas HMI, sensores PLC, módulo ES-FA-9AA, módulos seguridad) reemplazan los TBDs de v3.
8. **12 controles detectivos concretos** documentados (alarmas HMI desviación caudal/presión, RTD PT100, 4-20 mA, wire-break) reemplazan los TBDs de v3.

---

## Cabecera del maestro (sin cambios)

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
| Equipo de referencia | Inyectora TP900 Zhangjiagang Liqin Machinery Co. (PLC Siemens S7-1200) |

---

## Operación única — OP 10 INYECCIÓN PUR IN PLACE

**focusElementFunction** (Función del Item, 3 niveles AIAG-VDA — sin cambios):
> Interno: Proveer apoyacabezas con espuma PU consolidada, geometría conforme y funda sellada sin defectos visibles
> / Cliente: Permitir montaje en el respaldo del asiento VW sin interferencia ni desviación dimensional
> / Usuario Final: Brindar confort y soporte ergonómico al pasajero, con apariencia estética y vida útil prolongada

**operationFunction** (Función del Paso — sin cambios):
> Espumar el conjunto funda+varilla en molde mediante inyección de mezcla Poliol/Isocianato

---

## Work Elements (11, 6M ampliado por regla 1M por línea)

| # | Tipo | Nombre | Función (lenguaje simple) | Fuente |
|---|---|---|---|---|
| WE-1 | Material | Poliol (componente A) | Aportar el componente A para la reacción PU | v3 (sin cambio) |
| WE-2 | Material | Isocianato (componente B) | Aportar el componente B para la reacción PU | v3 (sin cambio) |
| WE-3 | Machine | Inyectora PU TP900 con dosificadora A:B | Mezclar y dosificar los componentes | v3 + ref. modelo (Liqin manual) |
| WE-4 | Machine | Molde de espumado climatizado en carrusel automático | Dar forma a la pieza durante el espumado y curado | v3 (sin cambio) |
| WE-5 | Method | Dossier de parámetros del proceso | Documentar los parámetros del ciclo | v3 (sin cambio) |
| WE-6 | Man | Operador de Producción | Cargar moldes, retirar piezas, accionar STOP en emergencia | v3 (sin cambio, rol canónico Barack) |
| WE-7 | Measurement | Flujómetros caudal POLY/ISO (E0.0-E0.3) | Medir el caudal real de cada componente y validar ratio A:B | **MOD v4** (reemplaza "balanza") |
| WE-8 | Measurement | Sensores RTD PT100 temperatura | Medir temperatura de mezcla en mixhead y tanques | **NUEVO v4** (regla 1M) |
| WE-9 | Measurement | Sensores 4-20 mA presión | Medir presión en mixhead y bombas durante el shot | **NUEVO v4** (regla 1M) |
| WE-10 | Environment | Ventilación de gases POLY/ISO | Controlar atmósfera en zona del operario (ATEX) | **NUEVO v4** (separado por regla 1M) |
| WE-11 | Environment | Temperatura ambiente planta | Mantener condiciones estables para el ciclo | **NUEVO v4** (separado por regla 1M) |

**Nota WE-1/WE-2:** Poliol e Isocianato se mantienen como Material directos en este maestro (excepción a regla `amfe.md` "materiales directos van en recepción") porque cumplen los 3 criterios excepcionales:
- Riesgo de operador cargar componente equivocado (intercambio POLY/ISO en tanques)
- Daño/contaminación durante manipuleo en la estación (recarga de tanques, mangueras)
- Historial recurrente de defectos del proveedor en composición química (causa típica de FM-LEG, FM-3, FM-4)

---

## Failure Modes — 11 totales en lenguaje simple

**Convención etiquetas:**
- 🟢 [PPT] = PPT Woodbridge
- 🔵 [HO] = HO-968 AMAROK
- 🟡 [PLANO] = plano VW
- 🟣 [LIQIN] = reportes Liqin TP900 (sensores/secuencia/manual/aceite+install)
- 🔴 [TBD-Leo] = confirmar con Leonardo

---

### FM-LEG — Pieza PU no cumple norma legal VW ▽ **CC**  `[=]` v3

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
| Causa 4 🟣 **NUEVA v4** | Agitador del tanque POLY o ISO parado durante producción (componente decantado) |
| Causa 5 🟣 **NUEVA v4** | Variador POLY o ISO desincronizado respecto a la referencia (AQW0/AQW1) |
| Control preventivo | Calibración periódica de flujómetros POLY/ISO (POL1=1, ISO1=1) + verificación setpoint HMI (densidad/proporción) + sincronización variadores SINAMICS G120 + agitadores POLY/ISO funcionando (KM65/KM66) 🟣 |
| Control detectivo | Alarma HMI desviación de caudal con parada automática + sensores RTD PT100 mixhead + presión mixhead AI4/AI5 + corriente bombas E21/E22 + variadores fault E27/E30 🟣 |

---

### FM-1 — Las capas de la pieza se despegan (delaminación) `[MOD]` v4

| Campo | Valor |
|---|---|
| Modo de falla | Las capas funda/espuma/sustrato se despegan entre sí |
| Efecto local | Se nota una bolsa entre capas. La tela se mueve sola al apretar |
| Efecto siguiente | SCRAP. No se puede retrabajar. |
| Efecto usuario final | Apoyacabezas con defecto visible y estructura comprometida |
| Severidad | 6 |
| Clasificación | SC si O≥4 (TBD-Leo) |
| Causa 1 🟢 | Superficie de funda contaminada antes del espumado |
| Causa 2 🟢 | Temperatura de molde fuera de rango |
| Causa 3 🟢 | Ratio iso/poliol fuera de especificación |
| Causa 4 🟣 **NUEVA v4** | Arranque de producción sin alcanzar setpoint de temperatura HMI (arranque prematuro en frío) |
| Control preventivo | Setpoints HMI temperatura POLY/ISO/agua tanques (PLC bloquea inyección hasta alcanzar setpoint) + sincronización variadores POLY/ISO via AQW0/AQW1 🟣 |
| Control detectivo | Sensores RTD PT100 mixhead (IW96, IW100) — lectura continua de temperatura mezcla 🟣 |

---

### FM-2 — Huecos dentro de la espuma `[MOD]` v4

| Campo | Valor |
|---|---|
| Modo de falla | La espuma queda con cavidades vacías por dentro |
| Efecto local | Pieza con burbujas visibles o zonas que se hunden al palpar |
| Efecto siguiente | SCRAP |
| Efecto usuario final | Confort comprometido y pieza estructuralmente débil |
| Severidad | 6 |
| Clasificación | SC si O≥4 (TBD-Leo) |
| Causa 1 🟢 | Peso de inyección insuficiente |
| Causa 2 🟢 | Mezcla A:B incompleta |
| Causa 3 🔴 | Venteo del molde obstruido |
| Causa 4 🟣 **NUEVA v4** | Aire aspirado en línea por nivel bajo en tanque POLY o ISO |
| Control preventivo | Sensor presión bombas POLY/ISO (AI6/AI7) + presión aire bajo en línea (E64/E65) + nivel aceite hidráulico (E35) + verificación posición cilindro mixhead E50/E51 antes del shot 🟣 |
| Control detectivo | Alarma HMI desviación de presión con parada automática de pulverización + nivel tanque analógico AI 2/AI 3 (corte recarga si baja) 🟣 |

---

### FM-3 — Espuma con partículas extrañas (contaminación) `[=]` v3

| Campo | Valor |
|---|---|
| Modo de falla | Partículas extrañas o suciedad dentro de la espuma |
| Efecto local | Manchas oscuras o pintas visibles en la espuma |
| Efecto siguiente | SCRAP. Posible rechazo de lote por riesgo VOC |
| Efecto usuario final | Defecto estético + **riesgo VW 50180 emisiones** |
| Severidad | 7 |
| Clasificación | SC si O≥4 (TBD-Leo) |
| Causa 1 🟢 | Molde sucio (restos de PU de ciclos anteriores) |
| Causa 2 🟢 | Bidones de poliol/isocianato contaminados |
| Causa 3 🔴 | Boquilla con residuos sin purgar entre ciclos |
| Control preventivo | Agitadores POLY/ISO funcionando (KM65/KM66) + purga automatizada del mixhead entre ciclos (sensores E1.4/E52/E53 + cilindro de cleaning shot E14/E15) 🟣 |
| Control detectivo | Sensor confirmación purga ejecutada (E1.4 + cylinder ejected/retracted E52/E53) — sistema confirma automáticamente que la purga se realizó 🟣 |

---

### FM-4 — Zonas duras en la espuma `[MOD]` v4

| Campo | Valor |
|---|---|
| Modo de falla | Zonas localizadas más rígidas que el resto de la espuma |
| Efecto local | Dureza dispareja al apretar la pieza con la mano |
| Efecto siguiente | SCRAP |
| Efecto usuario final | Confort comprometido, sensación dispareja al apoyar la cabeza |
| Severidad | 5 |
| Clasificación | SC si O≥4 (TBD-Leo) |
| Causa 1 🟢 | Mezclador desgastado o mantenimiento vencido |
| Causa 2 🟢 | Ratio iso/poliol incorrecto |
| Causa 3 🔴 | Temperatura de los componentes fuera de rango |
| Causa 4 🟣 **NUEVA v4** | Falla del chiller de refrigeración (componentes fuera de rango térmico) |
| Causa 5 🟣 **NUEVA v4** | Agitador POLY o ISO parado (componente decantado y dosificación irregular) |
| Control preventivo | Setpoints temperatura HMI (POLY/ISO/agua tanques) con bloqueo PLC + sincronización variadores POLY/ISO + chiller running flag (E34) verificado al arranque 🟣 |
| Control detectivo | PT100 mixhead (IW96, IW100) + PT100 agua tanques (IW104, IW108) + Tank Temperature AI 0/AI 1 + corriente calefacción E25/E26 🟣 |

---

### FM-5 — Se escapa mezcla líquida del molde (fuga de PU) `[MOD]` v4

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
| Causa 6 🟣 **NUEVA v4** | Sobrepresión en bomba dosificadora POLY o ISO |
| Causa 7 🟣 **NUEVA v4** | Sistema hidráulico de la inyectora degradado (aceite L-HM 46 fuera de spec, enfriador desconectado) |
| Control preventivo | Verificación posición cilindro mixhead E50/E51 antes del shot + sensor OverPressure bombas E66/E67 (corta ciclo) + nivelación plataforma giratoria con pernos químicos + 15 placas base fijadas 🟣 |
| Control detectivo | Monitoreo presión mixhead durante shot (AI4/AI5) — caída brusca = fuga + visual del operario al desmoldeo 🟣 |

---

### FM-6 — Pieza queda fuera de posición o forma `[MOD]` v4

| Campo | Valor |
|---|---|
| Modo de falla | Apoyacabezas queda descentrado o con geometría incorrecta tras el espumado |
| Efecto local | Pieza fuera de tolerancia dimensional |
| Efecto siguiente | SCRAP. No se monta en el respaldo del asiento |
| Efecto usuario final | Apoyacabezas desviado visible o no funcional |
| Severidad | 6 |
| Clasificación | SC si O≥4 (TBD-Leo) |
| Causa 1 🔵 | Bolsita no colocada o mal orientada |
| Causa 2 🔵 | Astas mal calzadas en las guías del molde |
| Causa 3 🔵 | Marcas de las astas no coinciden con las del molde |
| Causa 4 🔵 | Vinilo o funda sobresale y queda atrapado al cerrar |
| Causa 5 🟣 **NUEVA v4** | Plato del carrusel sin indexar correctamente al arranque (sensores E56/E57) |
| Causa 6 🟣 **NUEVA v4** | Plataforma giratoria desnivelada o pernos químicos sueltos |
| Control preventivo | Sensores posición plato rotativo E56/E57 (FASE 6 secuencia) + verificación chiller corriendo (E34) + anclaje 15 placas base verificado + RFID identification del molde (manual 5.4.1) 🟣 |
| Control detectivo | 🔴 TBD-Leo (¿control dimensional al desmoldeo? ¿plantilla de control?) |

---

### FM-7 — Pieza sale del molde sin curar bien `[MOD]` v4

| Campo | Valor |
|---|---|
| Modo de falla | El ciclo de inyección/curado se interrumpe o se completa fuera de condiciones |
| Efecto local | Pieza no consolidada o deformada al sacar del molde |
| Efecto siguiente | SCRAP |
| Efecto usuario final | Pieza con dureza, recuperación o durabilidad alteradas |
| Severidad | 6 |
| Clasificación | SC si O≥4 (TBD-Leo) |
| Causa 1 🔵 | Máquina sale del modo automático sin que el operario lo detecte |
| Causa 2 🔵 | Operario interviene durante el curado |
| Causa 3 🔴 | Falla del PLC o temporizador del ciclo |
| Causa 4 🔴 | Corte de energía durante el ciclo |
| Causa 5 🟣 **NUEVA v4** | Aceite hidráulico L-HM 46 degradado o sobre 55 °C (alarma) |
| Causa 6 🟣 **NUEVA v4** | Enfriador desconectado o no operativo |
| Causa 7 🟣 **NUEVA v4** | Una de las 3 preselecciones (auto + wet shot + cabezal mezclador) no activa al disparar |
| Control preventivo | Doble vía de cierre de ciclo (E0.7 Shot STOP por tiempo + E1.5 Sensor Shot por detección física) + wire-break detection 4-20 mA + módulo seguridad ES-FA-9AA + cambio aceite hidráulico L-HM 46 (frecuencia TBD-Leo) + enfriador verificado al arranque 🟣 |
| Control detectivo | Alarma temperatura aceite hidráulico 50-55 °C + alarma tiempo máx presurización (150 bar) + pantalla histórica de registros de inyección HMI + zumbador audible + marca parpadeante HMI 🟣 |

---

### FM-8 — Riesgo al operario por mal uso del STOP **OS** `[MOD]` v4 (REFORMULADO)

| Campo | Valor |
|---|---|
| Modo de falla | Ante emergencia, el operario no acciona el STOP correcto o no rearma la máquina correctamente |
| Efecto local | Daño al equipo + **riesgo de lesión al operario** |
| Efecto siguiente | N/A (incidente interno de seguridad) |
| Efecto usuario final | N/A |
| Severidad | 8 |
| **Clasificación** | **OS** (Seguridad del Operador) si O≥4 — manual SETEC pag 129 |
| Causa 1 🟣 **REFORMULADA v4** | Operario no sabe cuál de los 5 ESTOPs usar según la situación (armario eléctrico, mezcla, consola, caja botones, prensa) |
| Causa 2 🟣 **REFORMULADA v4** | Operario no sabe que el reset post-emergencia requiere acción manual (rearme + Button Reset E32) |
| Causa 3 🟣 **NUEVA v4** | Valla de protección o interlock de seguridad inoperativo (puerta o barrera de luz fotoeléctrica) |
| Causa 4 🟣 **NUEVA v4 TBD-Leo** | Atmósfera con vapores ISO/POLY sin ventilación forzada adecuada en zona del operario (conecta con FM-11 ATEX) |
| Control preventivo | Módulo de seguridad ES-FA-9AA con 3 E-STOPs en serie + 2 puertas + barrera de luz fotoeléctrica + procedimiento rearme con Button Reset E32 + 2 niveles de usuario HMI con contraseña (manager/gong) + valla de protección perimetral 🟣 |
| Control detectivo | 🔴 TBD-Leo (¿observación supervisor? ¿registros HMI de eventos STOP? ¿auditoría de seguridad?) |

⚠ **"Capacitación" prohibido como causa** por regla `amfe.md`. Las causas v4 hablan del SISTEMA (5 ESTOPs ambiguos, procedimiento de rearme, interlock, ventilación) — no del operario.

---

### FM-10 — Flujómetro POLY o ISO desviado entrega ratio fuera de spec **CC ▽ NUEVO v4 `[NEW]`**

| Campo | Valor |
|---|---|
| Modo de falla | El flujómetro POLY o ISO mide caudal incorrecto y entrega ratio A:B fuera de spec en la mezcla |
| Efecto local | Pieza con propiedades fuera de norma — SCRAP del lote del shot |
| Efecto siguiente | Rechazo PPAP si lote afectado llega al cliente, parada de lanzamiento |
| Efecto usuario final | **Riesgo de incendio o inhalación. Incumplimiento legal TL 1010 / VW 50180.** |
| **Severidad** | **9** |
| **Clasificación** | **CC ▽** (S=9, ratio fuera de spec causa incumplimiento legal) 🟣 |
| Causa 1 🟣 | Flujómetro POLY desviado (calibración perdida o atascamiento) |
| Causa 2 🟣 | Flujómetro ISO desviado (calibración perdida o atascamiento) |
| Causa 3 🟣 | Calibración del flujómetro fuera de spec (POL1/ISO1 ≠ 1 en HMI) |
| Control preventivo | Calibración periódica de flujómetros POLY/ISO (POL1=1, ISO1=1 en HMI) — frecuencia TBD-Leo 🟣 |
| Control detectivo | Alarma HMI por desviación de caudal con parada automática de pulverización (manual TP900 5.4.1) 🟣 |

**Diferencia respecto a FM-LEG:** FM-LEG cubre defectos de lote del proveedor o mezcla manual mal hecha. FM-10 cubre falla del **instrumento de medición en línea** (flujómetro como sensor). Ambos van a Validator D para confirmar separación.

---

### FM-11 — Atmósfera explosiva por vapores ISO/POLY (ATEX) **OS TBD-Leo NUEVO v4 `[NEW]`**

| Campo | Valor |
|---|---|
| Modo de falla | Concentración de vapores POLY/ISO en zona del operario supera límite de explosividad o de exposición |
| Efecto local | Riesgo de ignición + inhalación química |
| Efecto siguiente | N/A (incidente seguridad) |
| Efecto usuario final | N/A |
| **Severidad** | **9 TBD-Leo** (puede ser 10 si se confirma riesgo de explosión por concentración alta) |
| **Clasificación** | **OS TBD-Leo** (Seguridad del Operador, depende confirmar ventilación forzada Barack + sensores de gas) |
| Causa 1 🟣 | Ventilación de gases insuficiente en zona de inyección |
| Causa 2 🟣 | Acumulación de vapores por fuga no detectada (causa común con FM-5) |
| Causa 3 🔴 | Mantenimiento del sistema de extracción vencido |
| Control preventivo | 🔴 TBD-Leo (¿hay ventilación forzada Barack? ¿sensores de gas instalados?). Sensores ATEX en zona Ex con barreras Zener (E50/E51 pág 113) son protección intrínseca del equipo, NO de la atmósfera. 🟣 |
| Control detectivo | 🔴 TBD-Leo (¿hay detector de gases en zona del operario? ¿alarma de explosividad?) |

⚠ **Por qué TBD-Leo en bloque:** La máquina Liqin tiene clasificación ATEX en sensores (barreras Zener pág 113) lo que confirma que en operación normal puede haber vapores explosivos. Pero los reportes Liqin NO documentan si Barack tiene:
- Ventilación forzada en la zona de inyección
- Sensores de gas / detectores de explosividad
- Cert ATEX del puesto de trabajo
- Procedimiento de evacuación por concentración alta

Sin esos datos, todos los controles quedan TBD. Si la respuesta de Leonardo es "no hay nada", el FM-11 queda con riesgo residual alto.

---

## Resumen severidades + clasificaciones v4

| FM | S | Clasif. | Cuándo se confirma | Cambio v4 |
|---|---|---|---|---|
| **FM-LEG** | **9** | **CC ▽** ✅ | Confirmado (S=9 legal) | MOD: +2 causas |
| FM-1 Delaminación | 6 | SC si O≥4 (TBD-Leo) | Cuando O conocida | MOD: +1 causa |
| FM-2 Huecos | 6 | SC si O≥4 (TBD-Leo) | Cuando O conocida | MOD: +1 causa |
| FM-3 Contaminación | 7 | SC si O≥4 (TBD-Leo) | Cuando O conocida | = |
| FM-4 Zonas duras | 5 | SC si O≥4 (TBD-Leo) | Cuando O conocida | MOD: +2 causas |
| FM-5 Fuga PU | 4 | Estándar | S<5 no califica | MOD: +2 causas |
| FM-6 Fuera de posición | 6 | SC si O≥4 (TBD-Leo) | Cuando O conocida | MOD: +2 causas |
| FM-7 Ciclo incompleto | 6 | SC si O≥4 (TBD-Leo) | Cuando O conocida | MOD: +3 causas |
| **FM-8 Riesgo operario** | **8** | **OS si O≥4 (TBD-Leo)** | Cuando O conocida | MOD: reformulado completo |
| **FM-10 Flujómetro desv.** | **9** | **CC ▽** | Confirmado (S=9 legal por ratio fuera spec) | NEW v4 |
| **FM-11 ATEX** | **9 TBD-Leo** | **OS TBD-Leo** | Reunión Leonardo | NEW v4 TBD-Leo |

**Total:** 11 FMs (vs 9 en v3). 2 CC confirmados. 7 potenciales SC (depende O Leonardo). 1 potencial OS confirmado (FM-8). 1 OS TBD-Leo (FM-11). 1 estándar.

→ **Las clasificaciones finales se cierran cuando Leonardo defina Ocurrencia (O) de cada causa.**

---

## Para Plan de Control (NO al AMFE — regla `amfe.md` parámetros numéricos van al CP)

15 parámetros identificados en docs Liqin que pertenecen al CP:

| Parámetro | Valor según fuente | Fuente |
|---|---|---|
| Densidad POLY | 1.03 g/cm³ | Manual 5.4.1 |
| Densidad ISO | 1.22 g/cm³ | Manual 5.4.1 |
| Proporción POLY:ISO | 40-62 (rango configurable HMI) | Manual 5.4.1 |
| Caudal alta presión | 200-400 g/s | Manual 5.4.1 |
| Temperatura aceite hidráulico límite | 50-55 °C alarma | Manual + aceite.png |
| Tiempo max presurización hidráulica | hasta 150 bar | Manual |
| Tiempo establecimiento presión prueba | 5 segundos | Manual 5.4.3 |
| Tiempo establecimiento presión auto | 3 segundos | Manual 5.4.4 |
| Frecuencia plato giratorio | 20-50 Hz | Manual |
| Boquilla tiempo compensación | -0.089 segundos | Manual |
| Equivalente flujómetro | POL1=1, ISO1=1 | Manual 5.4.1 |
| Rampas variador SINAMICS G120 | P1120 (subida) / P1121 (bajada) | Secuencia obs. técnicas |
| Aceite hidráulico recomendado | Great Wall L-HM 46, ISO 11158 | Aceite.png |
| Frecuencia cambio aceite | TBD-Leo (no especificada en fuentes) | TBD |
| Cantidad carga depósito hidráulico | TBD-Leo | TBD |

---

## Pendientes para Leonardo (actualizado v4)

Doc completo: `docs/drafts/PREGUNTAS_LEONARDO_PU.md`. Estado v4:

### Bloque F — Controles preventivos y detectivos
**Estado v4: PARCIALMENTE RESUELTO** — 14 controles preventivos + 12 detectivos vienen documentados de Liqin. Quedan TBD-Leo:
- FM-6 control detectivo (¿control dimensional al desmoldeo? ¿plantilla?)
- FM-8 control detectivo (¿observación supervisor? ¿registros HMI de eventos STOP?)
- FM-11 ATEX controles preventivo y detectivo completos
- Frecuencia de calibración flujómetros (FM-LEG + FM-10)
- Frecuencia cambio aceite hidráulico (FM-7)
- Frecuencias de verificaciones periódicas V1-V6 install (FM-5, FM-6, FM-7, FM-8)

### Bloque D — Defectos PPT Woodbridge
Confirmar que los 5 defectos del PPT aplican a Patagonia y son los modelados en v4 (FM-1 a FM-5).

### Bloque G — EPP químico
**Estado v4: NO RESUELTO** — el manual TP900 NO menciona EPP. ¿Respirador? ¿Antiparras? ¿Guantes térmicos? ¿Otros?

### Bloque I — Reprocesos
¿Una pieza con FM-1 a FM-7 es retrabajable o siempre SCRAP?

### Nuevas preguntas v4

1. **FM-11 ATEX:** ¿Barack tiene ventilación forzada en zona PIP? ¿Sensores de gas? ¿Cert ATEX del puesto?
2. **FM-10 vs FM-LEG:** ¿Mantenemos como FMs separados o consolidamos? (Validator D decidirá)
3. **WE-7/8/9 desdoblamiento:** ¿La separación de Measurement en 3 WEs es razonable o agrupamos como "Sistema de sensores PLC"?
4. **WE-10/11:** ¿Mantenemos Ventilación y Temperatura ambiente como WEs separados?
5. **Ocurrencia (O) de todas las causas** — sin esto las clasificaciones SC no se cierran.

---

## Próximo paso (Workflow del Plan)

1. **Fase 1 — Panel de 4 validators paralelos** (A estructura, B trazabilidad, C cruz Supabase, D severidad/CC) sobre este draft v4
2. **Fase 2 — Consolidator** (matriz item×validator, detección disensos)
3. **Fase 3 — Listado AMFE v4 a Fak por chat** con 17 columnas
4. **Fase 4 (post-OK Fak)** — `supabase-safety` + script `.mjs` para crear family 17 + AMFE-MAESTRO-PU-001 + replicar a HF/HRC/HRO

**HARD GATE:** Nada toca Supabase sin "OK aplica" explícito de Fak por chat.
