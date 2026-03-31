# Comparacion Telas Termoformadas — Referencia vs Supabase

Fecha: 2026-03-31
Familia: **Telas Termoformadas PWA**
Part number Supabase: Segun tabla (21-9640 en catalogo)
Part numbers referencia: 21-8908 (RH) / 21-8909 (LH)

**NOTA:** Los AMFEs de referencia usan NPR (sistema viejo). Nosotros usamos AP (AIAG-VDA 2019). NO se comparan valores NPR — solo estructura.
**NOTA:** Los valores numericos pueden estar desactualizados en la referencia. Se reportan discrepancias para que Fak decida.

---

## Fuentes

| Tipo | Documento referencia | Documento Supabase |
|------|---------------------|--------------------|
| AMFE | AMFE 148 REV.2 (21-8909 CONJ TELA FSC LH P2X) | AMFE-PWA-113 (PWA/TELAS_TERMOFORMADAS) |
| PC | PC 21-8908 RH rev 1 + PC 21-8909 LH rev 1 | CP-TELAS-TERMO-001 (27 items) |
| PFD | FLUJOGRAMA_156_ASIENTO_RESPALDO_REV.pdf (no leido) | PFD Telas Termoformadas PWA (21 pasos) |
| HO | HO 909 DERECHO 218908 REV.7 + HO IZQUIERDO 218909 957 REV.7 (no leidos) | HO Telas Termoformadas (9 sheets) |

---

## 3A — Operaciones

### Referencia (AMFE 148)

| OP Ref | Nombre referencia |
|--------|-------------------|
| 10 | Recepcion de Punzonado con gramaje (120g/m2) |
| 10 | Recepcion de Punzonado CON BI-COMPONENTE (280g/m2) |
| 10 | Recepcion de Rollo de Aplix |
| 20 | Corte por maquina de pieza Central |
| 21 | Corte por maquina, Blanck de piezas laterales |
| 10 | Colocado de Aplix |
| **11** | **Retrabajo de la pieza (Aplix)** |
| 20 | Horno |
| 30 | Termoformado |
| 40 | Corte de la pieza en prensa |
| 50 | Perforado (Cod: 21-8875 R y 21-8876 L) |
| 60 | Soldadura (Cod: 21-8877, 21-8875 y 21-8876) |
| **61** | **Retrabajo soldadura (Cod: 21-8800, 21-8878 y 21-8879)** |
| 70 | Control de pieza final |
| 80 | Embalaje |

**Nota:** La referencia usa numeracion repetida (ej: OP 10 para recepcion Y para colocado de aplix, OP 20 para corte Y para horno). Es un formato viejo con numeracion no secuencial.

### Referencia (PC 21-8908 / 21-8909)

| OP Ref | Nombre en PC |
|--------|-------------|
| 10 | Recepcion de materiales |
| 20.1 | Corte por maquina de pieza Central con 17 agujeros de diametro 4.0mm |
| 20.2 | Corte por maquina, Blanck de piezas laterales 500mmx500mm |
| 30 | Colocado de 9 aplix en cada agujero |
| 40 | Horno de Calentado (200 grados C +/-10 grados C, 30 seg) |
| 50 | Marcado de perimetro piezas laterales |
| 60 | Perforado (4 agujeros en laterales) |
| 70 | Corte de perimetro de piezas laterales |
| 80 | Soldadura (5 puntos en cada extremo) |
| 90 | Inspeccion de la pieza (9 aplix, 10 puntos soldadura) |
| 100 | Embalaje (25 piezas por medio) |
| — | TEST DE LAY OUT (anual, laboratorio) |

### Supabase (AMFE)

| OP Sub | Nombre Supabase |
|--------|-----------------|
| 10 | RECEPCION DE MATERIA PRIMA |
| 15 | PREPARACION DE CORTE |
| 20 | CORTE DE COMPONENTES |
| 30 | PREPARACION DE KITS DE COMPONENTES |
| 40 | TERMOFORMADO DE TELAS |
| 50 | CORTE LASER DE TELAS TERMOFORMADAS |
| 60 | TROQUELADO DE REFUERZOS |
| 70 | TROQUELADO DE APLIX |
| 80 | CONTROL FINAL DE CALIDAD |

### Supabase (PFD — 21 pasos)

| OP Sub | Nombre PFD |
|--------|------------|
| 10 | RECEPCION DE MATERIA PRIMA |
| — | INSPECCION DE MATERIA PRIMA |
| — | ALMACENADO EN SECTOR DE MP CONTROLADA |
| 15 | PREPARACION DE CORTE |
| 20 | CORTE DE COMPONENTES |
| 25 | CONTROL CON MYLAR |
| 30 | PREPARACION DE KITS DE COMPONENTES |
| 40 | TERMOFORMADO DE TELAS |
| 50 | CORTE LASER DE TELAS TERMOFORMADAS |
| 60 | TROQUELADO DE REFUERZOS |
| 70 | TROQUELADO DE APLIX |
| 80 | COSTURA DE REFUERZOS |
| 90 | APLICACION DE APLIX |
| 100 | CONTROL FINAL DE CALIDAD |
| 110 | PRODUCTO CONFORME? |
| 111 | CLASIFICACION Y SEGREGACION DE PNC |
| 112 | REPROCESO: ELIMINACION DE HILO SOBRANTE |
| 113 | REPROCESO: REUBICACION DE APLIX |
| 114 | REPROCESO: CORRECCION DE COSTURA DESVIADA |
| 120 | EMBALAJE Y ETIQUETADO DE PT |
| — | ALMACENAMIENTO PT (FIFO) |

### Tabla comparativa de operaciones

| Concepto referencia | OP Ref | OP Supabase AMFE | OP Supabase PFD | Status |
|---------------------|--------|-------------------|-----------------|--------|
| Recepcion MP | 10 | 10 | 10 | MATCH |
| Preparacion de corte | — | 15 | 15 | FALTA EN REFERENCIA (nueva en Supabase) |
| Corte central | 20 | 20 | 20 | NOMBRE DISTINTO (ref: "Corte por maquina de pieza Central" vs sub: "CORTE DE COMPONENTES") |
| Control con Mylar | — | — | 25 | SOLO EN PFD (no en AMFE Supabase) |
| Corte laterales | 21 | — | — | FALTA EN SUPABASE (ref tiene OP separada para laterales) |
| Colocado de Aplix | 10/30 | 30 (parcial) | 30/90 | NOMBRE DISTINTO (ref: "Colocado de Aplix" vs sub: "PREPARACION DE KITS" y "APLICACION DE APLIX") |
| Horno | 20/40 | 40 (parcial) | 40 | NOMBRE DISTINTO (ref: "Horno" vs sub: "TERMOFORMADO DE TELAS" — Supabase combina horno+termoformado) |
| Termoformado | 30 | 40 (combinado) | 40 | COMBINADO en Supabase con Horno |
| Corte en prensa | 40 | — | — | FALTA EN SUPABASE (ref tiene corte en prensa separado) |
| Marcado perimetro | 50 | — | — | FALTA EN SUPABASE |
| Perforado | 50/60 | — | — | FALTA EN SUPABASE (ref perfora 4 agujeros en laterales) |
| Corte perimetro laterales | 70 | — | — | FALTA EN SUPABASE |
| Corte laser | — | 50 | 50 | FALTA EN REFERENCIA (nueva en Supabase: CORTE LASER) |
| Troquelado de refuerzos | — | 60 | 60 | FALTA EN REFERENCIA (nueva en Supabase) |
| Troquelado de aplix | — | 70 | 70 | FALTA EN REFERENCIA (nueva en Supabase) |
| Costura de refuerzos | — | — | 80 | SOLO EN PFD (no en AMFE Supabase) |
| Soldadura | 60/80 | — | — | FALTA EN SUPABASE (ref tiene soldadura por ultrasonido) |
| **Retrabajo Aplix** | **11** | **—** | **—** | **FALTA EN SUPABASE** |
| **Retrabajo soldadura** | **61** | **—** | **113** | **PARCIAL — PFD tiene "REUBICACION DE APLIX" pero NO retrabajo soldadura** |
| Control final | 70/90 | 80 | 100 | MATCH (nombres distintos: ref "Inspeccion de la pieza" vs sub "CONTROL FINAL DE CALIDAD") |
| Embalaje | 80/100 | — (en AMFE 80 hay embalaje-like FMs) | 120 | PARCIAL — AMFE OP 80 tiene FMs de embalaje pero se llama "CONTROL FINAL DE CALIDAD" |
| Test de Lay Out | Si (anual) | — | — | FALTA EN SUPABASE |

**RESUMEN OPERACIONES:**
- **FALTAN EN SUPABASE:** Corte laterales (OP 21), Corte en prensa, Marcado perimetro, Perforado, Corte perimetro laterales, Soldadura, Retrabajo Aplix (OP 11), Retrabajo soldadura (OP 61), Test de Lay Out
- **NUEVAS EN SUPABASE (no en referencia):** Preparacion de corte (15), Corte laser (50), Troquelado de refuerzos (60), Troquelado de aplix (70), Costura de refuerzos (80 PFD), Reprocesos PFD (112-114)
- **POSIBLE EXPLICACION:** El proceso puede haber cambiado significativamente entre la referencia (2022-2024) y lo cargado en Supabase. La referencia describe un proceso con soldadura por ultrasonido y corte en prensa; Supabase describe un proceso con corte laser, troquelado y costura.

---

## 3B — Materiales en recepcion

| Material referencia | Material Supabase | Status |
|--------------------|-------------------|--------|
| Punzonado 120g/m2 +-15% (rollo 2m ancho), flamabilidad <=100mm/min | "Tela termoformada" (flamabilidad segun requisito PWA) | NOMBRE DISTINTO — ref dice "Punzonado 120g/m2", Supabase dice "Tela termoformada" |
| Punzonado CON BICOMPONENTE 280g/m2 +-15% (rollo 1,5m ancho), flamabilidad <=100mm/min | No especificado como material separado | FALTA EN SUPABASE — no hay item de recepcion especifico para bicomponente 280g/m2 |
| Aplix (rollo 0,25m ancho) | No especificado como material separado | FALTA EN SUPABASE — no hay item de recepcion especifico para Aplix |
| — | Refuerzo TBD (2 items, pendiente confirmacion ingenieria) | NUEVO EN SUPABASE (no en referencia) |

**DISCREPANCIAS CRITICAS:**
1. La referencia controla 3 materiales separados en recepcion (Punzonado, Bicomponente, Aplix). Supabase tiene 1 material generico ("Tela termoformada") + 2 items TBD para "Refuerzo".
2. La referencia especifica gramajes exactos (120g/m2, 280g/m2) y anchos de rollo (2m, 1,5m, 0,25m). Supabase no tiene estos valores.
3. Flamabilidad: referencia dice "<=100 mm/min" como CC. Supabase tiene flamabilidad pero sin clasificacion CC.

---

## 3C — Failure modes por operacion

| Operacion | FM Referencia (AMFE 148) | FM Supabase (AMFE-PWA-113) | Status |
|-----------|------------------------|---------------------------|--------|
| OP 10 Recepcion | Gramaje mayor/menor (x2 materiales), Ancho distinto (x2), Flamabilidad fuera de espec (x2, CC), Agujeros (cant/posicion/diametro en corte auto) | Identificacion incorrecta, Material distinto, Omision de recepcion, Flamabilidad, Refuerzo TBD fuera de espec (x2) | **DIFERENTE** — Ref tiene FM especificos por material (gramaje, ancho). Supabase es generico. |
| OP 20 Corte | Material distinto, Forma fuera de espec, Medida mayor/menor a 550x500mm, Orificios fuera de posicion, Agujeros de 4mm fuera de espec | Largo distinto, Falta de orificios, Orificios fuera de posicion | **PARCIAL** — Supabase cubre 3 FM pero ref tiene ~6 FM mas detallados incluyendo forma y material. |
| OP 20 Horno (ref) / OP 40 Termoformado (sub) | Temperatura distinta a 150C +-20C, Tiempo distinto a 60s, Calentamiento no uniforme (x2), Termoformado desprolijo, Termoformado incompleto, Pieza con roturas | Clips posicion incorrecta, Falta de clips | **MUY DIFERENTE** — Ref tiene 7 FM de horno/termoformado. Supabase tiene 2 FM sobre clips. |
| OP 30 Termoformado (ref) → ya combinado arriba | Ver arriba | — | — |
| OP 40 Corte prensa (ref) | Pieza con roturas, Corte desprolijo, Corte perimetral incompleto | — | **FALTA EN SUPABASE** (operacion no existe) |
| OP 50 Perforado (ref) | Apertura de agujeros (menos/mas de 9, desprolija, no pasante, con arrastres) — x6 FM | — | **FALTA EN SUPABASE** (operacion no existe) |
| OP 60 Soldadura (ref) | Piezas distintas, Mas/menos de 5 puntos, Pieza distinta a patron, No union, soldadura con piezas distintas — x6 FM | — | **FALTA EN SUPABASE** (operacion no existe) |
| OP 30 Kit componentes (sub) | — | Refuerzo invertido, Falta de costura, Costura floja | **NUEVA EN SUPABASE** |
| OP 50 Corte laser (sub) | — | Dots posicion incorrecta, Falta de dots | **NUEVA EN SUPABASE** |
| OP 60 Troquelado refuerzos (sub) | — | Dimensional fuera de espec | **NUEVA EN SUPABASE** |
| OP 70 Control final (ref) / OP 70+80 (sub) | Pieza con aplix mayor/menor a 9, Pieza con mas/menos de 10 puntos soldadura, Pieza desunida | Mayor/menor cant piezas, Error/falta identificacion (x2 ops) | **DIFERENTE** — Ref controla resultado final del producto. Supabase controla embalaje/identificacion. |
| OP 80 Embalaje (ref) | Mayor/menor de 25 piezas por medio, Error/falta identificacion | Mayor/menor de 25 piezas por medio, Error/falta identificacion | **MATCH** — Contenido muy similar. |

**RESUMEN FM:**
- Referencia total: ~40+ failure modes
- Supabase total: ~27 failure modes
- FM de referencia sin cobertura en Supabase: ~20+ (corte prensa, perforado, soldadura, horno detallado, termoformado detallado)
- FM nuevos en Supabase sin equivalente en referencia: ~8 (costura, corte laser, troquelado, clips)

---

## 3D — Controles CP

| Control referencia (PC) | Control Supabase (CP) | Status |
|------------------------|----------------------|--------|
| Punzonado 120g/m2 flamabilidad CC | Flamabilidad del material (sin clasif CC) | **FALTA CC** en Supabase |
| Bicomponente 280g/m2 flamabilidad CC | No existe | **FALTA EN SUPABASE** |
| Aplix rollo 0,25m | No existe | **FALTA EN SUPABASE** |
| Diametro 17 agujeros de 4mm (visual plantilla, inicio/fin turno) | Programacion maquina corte (pieza patron, inicio/fin turno) | **PARCIAL** — Supabase no menciona 17 agujeros ni diametro 4mm |
| Posicion de orificios (visual plantilla) | Orificios fuera de posicion (control visual) | MATCH parcial |
| Forma del corte (visual plantilla) | No existe como item separado | **FALTA EN SUPABASE** |
| Dimension del corte 500x600mm (central) | No existe | **FALTA EN SUPABASE** |
| Presencia de 9 aplix (visual 100% lote) | No existe | **FALTA EN SUPABASE** |
| Temperatura horno 200C +-10C (visual PLC 100%) | No existe | **FALTA EN SUPABASE** |
| Marcado de pieza (visual 100%) | No existe | **FALTA EN SUPABASE** |
| Cant agujeros laterales (4 agujeros, visual 100%) | No existe | **FALTA EN SUPABASE** |
| Aspecto del corte perimetro (visual 100%) | No existe | **FALTA EN SUPABASE** |
| Cant puntos soldadura (5 por extremo, visual/manual 100%) | No existe | **FALTA EN SUPABASE** |
| Aspecto final pieza (9 aplix, 10 puntos, visual 100%) | No existe | **FALTA EN SUPABASE** |
| Cant piezas por bolsa (25 piezas, visual 100%) | Mayor/menor de 25 piezas (autocontrol/audit) | MATCH parcial |
| Gramaje tela central 120g/m2 (balanza, anual, lab) | No existe | **FALTA EN SUPABASE** (Test Lay Out) |
| Dimension/tipo material tela central TNT 13x13mm (visual/calibre, anual, lab) | No existe | **FALTA EN SUPABASE** (Test Lay Out) |
| Combustibilidad tela central <=100mm/min FMVSS302 (camara combustion, anual, lab) | No existe | **FALTA EN SUPABASE** (Test Lay Out) |
| Gramaje tela lateral 270g/m2 +-15% (balanza, anual, lab) | No existe | **FALTA EN SUPABASE** (Test Lay Out) |
| Espesor tela lateral termoformada 3mm +-15% (medidor espesores, anual, lab) | No existe | **FALTA EN SUPABASE** (Test Lay Out) |
| Tensile Strength tela lateral >400N/5cm (maq traccion, anual, lab) | No existe | **FALTA EN SUPABASE** (Test Lay Out) |
| Elongation tela lateral >50% dir maquina (maq traccion, anual, lab) | No existe | **FALTA EN SUPABASE** (Test Lay Out) |
| Elongation tela lateral >70% cross dir (maq traccion, anual, lab) | No existe | **FALTA EN SUPABASE** (Test Lay Out) |

**RESUMEN:**
- La referencia tiene ~23 controles. Supabase tiene 27 items pero la mayoria son genericos (mapeo 1:1 desde AMFE).
- **Faltan en Supabase:** controles especificos de proceso (temperatura horno, presencia aplix, soldadura) y TODO el Test de Lay Out (8 ensayos de laboratorio anuales).
- **CC faltante:** Flamabilidad deberia ser CC en Supabase y no lo es.

---

## 3E — Operaciones de retrabajo

| Retrabajo referencia | OP Ref | En Supabase AMFE? | En Supabase PFD? |
|---------------------|--------|-------------------|-----------------|
| Retrabajo de la pieza (Aplix) | 11 | NO | NO (pero PFD tiene OP 113: "REUBICACION DE APLIX") |
| Retrabajo soldadura | 61 | NO | NO |

**Retrabajos en Supabase PFD sin equivalente en referencia:**

| OP PFD | Nombre | En referencia? |
|--------|--------|---------------|
| 111 | CLASIFICACION Y SEGREGACION DE PNC | NO (generico) |
| 112 | REPROCESO: ELIMINACION DE HILO SOBRANTE | NO |
| 113 | REPROCESO: REUBICACION DE APLIX | PARCIAL (ref tiene OP 11 retrabajo aplix) |
| 114 | REPROCESO: CORRECCION DE COSTURA DESVIADA | NO |

**NOTA:** La referencia tiene retrabajos especificos para aplix (OP 11) y soldadura (OP 61) con failure modes detallados en el AMFE. Supabase tiene reprocesos en el PFD pero NO en el AMFE — es decir, no hay analisis de riesgo de los reprocesos.

---

## 3F — Discrepancias de valores numericos

**IMPORTANTE: Fak debe decidir cual valor es correcto. Los valores de referencia pueden estar desactualizados.**

| Parametro | Valor referencia | Valor Supabase | Donde |
|-----------|-----------------|----------------|-------|
| Gramaje punzonado (tela central) | 120 g/m2 +-15% | No especificado | Recepcion |
| Gramaje bicomponente (tela lateral) | 280 g/m2 +-15% | No especificado | Recepcion |
| Ancho rollo punzonado | 2m | No especificado | Recepcion |
| Ancho rollo bicomponente | 1,5m | No especificado | Recepcion |
| Ancho rollo aplix | 0,25m | No especificado | Recepcion |
| Flamabilidad | <=100 mm/min | "Segun requisito de flamabilidad PWA" | Recepcion |
| Cantidad agujeros pieza central | 17 agujeros de diametro 4mm | No especificado | Corte |
| Dimension corte central | 500mm x 600mm | No especificado | Corte |
| Dimension corte laterales | 500mm x 500mm | No especificado | Corte |
| Temperatura horno | 200 grados C +-10 grados C (PC) vs 150 grados C +-20 grados C (AMFE) | No especificado | Horno |
| Tiempo calentamiento | 30 seg (PC) vs 60 seg (AMFE) | No especificado | Horno |
| Cantidad aplix por pieza | 9 unidades | No especificado | Colocado aplix |
| Cantidad puntos soldadura | 5 por extremo (10 total) | No existe (no hay soldadura) | Soldadura |
| Cantidad piezas por medio embalaje | 25 piezas | 25 piezas | Embalaje |
| Gramaje tela lateral (lab) | 270 g/m2 +-15% | No especificado | Test Lay Out |
| Espesor tela lateral termoformada (lab) | 3mm +-15% | No especificado | Test Lay Out |
| Tensile Strength tela lateral (lab) | >400 N/5cm | No especificado | Test Lay Out |
| Elongation dir maquina (lab) | >50% | No especificado | Test Lay Out |
| Elongation cross dir (lab) | >70% | No especificado | Test Lay Out |
| Norma flamabilidad (lab) | FMVSS302 (ISO 3795) | No especificado | Test Lay Out |

**DISCREPANCIA INTERNA EN REFERENCIA:**
- Temperatura horno: AMFE dice 150 grados C +-20 grados C, PC dice 200 grados C +-10 grados C. **Fak debe confirmar cual es correcto.**
- Tiempo calentamiento: AMFE dice 60 seg, PC dice 30 seg. **Fak debe confirmar.**

---

## Conclusiones

### Diferencias estructurales mayores

1. **Proceso fundamentalmente distinto**: La referencia describe un proceso con horno + termoformado + corte en prensa + perforado manual + soldadura por ultrasonido. Supabase describe un proceso con corte laser + troquelado + costura. Parece que el proceso se rediseno significativamente.

2. **Operaciones que faltan en Supabase (del proceso viejo):**
   - Corte separado de laterales (OP 21)
   - Horno como operacion separada
   - Corte en prensa
   - Marcado de perimetro
   - Perforado manual de laterales
   - Corte de perimetro de laterales
   - Soldadura por ultrasonido
   - Retrabajo aplix (OP 11) y retrabajo soldadura (OP 61)

3. **Operaciones nuevas en Supabase (proceso nuevo):**
   - Preparacion de corte (OP 15)
   - Corte laser (OP 50)
   - Troquelado de refuerzos (OP 60)
   - Troquelado de aplix (OP 70)
   - Costura de refuerzos (OP 80 PFD)
   - Aplicacion de aplix (OP 90 PFD)
   - Reprocesos especificos (OP 112-114 PFD)

4. **Flamabilidad sin CC**: En la referencia es CC. En Supabase no tiene clasificacion.

5. **Materiales en recepcion incompletos**: Supabase no detalla los 3 materiales por separado (punzonado, bicomponente, aplix).

6. **Test de Lay Out completo falta en Supabase**: 8 ensayos de laboratorio anuales.

7. **Valores numericos completamente ausentes en Supabase**: Temperaturas, tiempos, gramajes, dimensiones, cantidades especificas.

8. **Incoherencia AMFE vs PFD en Supabase**: El PFD tiene 21 pasos (incluyendo costura OP 80, aplicacion aplix OP 90) pero el AMFE solo tiene 9 operaciones — faltan OP 80 (costura) y OP 90 (aplicacion aplix) en el AMFE.

### Para decision de Fak

- Confirmar si el proceso cambio (laser/troquelado reemplazo prensa/perforado/soldadura) o si ambos procesos coexisten.
- Confirmar temperatura y tiempo de horno (discrepancia entre AMFE viejo y PC viejo).
- Confirmar si el Test de Lay Out debe incluirse en el CP de Supabase.
- Definir los materiales especificos de recepcion con gramajes y dimensiones.
- Confirmar que flamabilidad debe ser CC.
