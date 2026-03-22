# Auditoria: Plan de Control (CP) en Supabase vs. PDF Fuente

**Fecha**: 2026-03-22
**Productos auditados**: Insert, Armrest Door Panel, Top Roll
**Fuentes PDF**: PdC Insertos Rev.1, PC 2GJ.867.165-166 Rev.0, PC TOP ROLL Rev.0

---

## Resumen Ejecutivo

| Producto | Items Supabase | Items PDF (aprox) | Estructura | Fidelidad |
|----------|---------------|-------------------|------------|-----------|
| Insert (CP-INSERT-001) | 209 | ~65 | AMFE-derived | BAJA |
| Armrest (CP-ARMREST-001) | 174 | ~28 | AMFE-derived | BAJA |
| Top Roll (CP-TOPROLL-001) | 94 | ~45 | AMFE-derived | BAJA |

**Hallazgo principal**: Los CPs en Supabase NO son transcripciones de los Planes de Control PDF reales. Son CPs generados automaticamente a partir de las causas del AMFE (cross-generation AMFE->CP). Esto explica las diferencias sistematicas en estructura, contenido y volumen.

---

## 1. INSERT (CP-INSERT-001)

### 1.1 Estructura PDF (PdC Insertos Rev.1)

El PDF tiene las siguientes operaciones con caracteristicas reales de proceso/producto:

| Operacion PDF | Nombre | Caracteristicas clave |
|--------------|--------|----------------------|
| Op 10 | Recepcion | Tipo producto (PP), Color, Torres sujecion, Dimensional, Aspecto, Espesor (1.5-2.5mm), Flamabilidad SC (<100mm/min), Color vinilo, Gramaje (800-1000 GMS/MT2), Hilos (15/3 y 30/3 cabos), Certificado calidad, Viscosidad adhesivo (950cP +/-15%) |
| Op 0.25 | Corte de Vinilo (Set up) | Hoja de set-up, Cantidad de capas (10), Cuchilla >= 4mm, Dimensional segun Myler |
| Op 30 | Costura Union | Apariencia, Sin costura salteada/floja/falta, Aguja correcta, Hilo union (30/3) 4 puntadas/16mm, toma 6+/-1mm |
| Op 31 | Costura Vista (Set up + Proceso) | Puntada vista (15/3) 11+/-1 puntadas/5cm, ancho 6+/-0.5mm SC1, Paralelismo, Apariencia |
| Op 40 | Primer | Fecha vencimiento >6 meses |
| Op 50 | Adhesivado | Adhesivo buen estado, Adhesivado completo, Fecha vencimiento, Temp horno 60-70C |
| Op 60 | Tapizado semi-automatico | Temp 85C+/-5C, Velocidad 4mts/min, Vinilo posicionado, Sin arrugas, Sin marcas, Talon costura, Adherencia, Costura alineada 100mm+/-1mm |
| Op 70 | Virolado + Refilado | Virolado contorno completo, Pegado pliegues, Zonas criticas, Sin quemado |
| Op 80 | Inspeccion final | Dimensional calibre, Apariencia (despegues, cortes, soldadura, manchas) |
| Op 90 | Embalaje | Identificacion, Cantidad 6 piezas/cajon |
| Op 100 | Test Layout | Flamabilidad <=100mm, Dimensional completo (30 muestras) |

### 1.2 Estructura Supabase (CP-INSERT-001)

| Operacion Supabase | Items | Contenido |
|-------------------|-------|-----------|
| OP 10 | 28 | Causas AMFE recepcion (estiba, transito, ARB, trazabilidad, materiales especificos) |
| OP 15 | 6 | Causas AMFE corte manual |
| OP 20 | 10 | Causas AMFE corte automatico |
| OP 25 | 2 | Causas AMFE verificacion |
| OP 30 | 6 | Causas AMFE armado de kit |
| OP 40 | 6 | Causas AMFE refilado |
| OP 50 | 30 | Causas AMFE costura automatica |
| OP 60 | 8 | Causas AMFE troquelado |
| OP 61 | 6 | Causas AMFE armado kit post-troquelado |
| OP 70 | 16 | Causas AMFE inyeccion |
| OP 71 | 6 | Causas AMFE armado kit post-inyeccion |
| OP 80 | 4 | Causas AMFE separador espuma |
| OP 81 | 6 | Causas AMFE armado kit |
| OP 90 | 6 | Causas AMFE adhesivado |
| OP 91 | 6 | Causas AMFE adhesivado 2 |
| OP 92 | 6 | Causas AMFE armado kit |
| OP 100 | 12 | Causas AMFE tapizado |
| OP 103 | 7 | Causas AMFE retrabajo |
| OP 105 | 9 | Causas AMFE refilado final |
| OP 110 | 10 | Causas AMFE inspeccion final |
| OP 111 | 12 | Causas AMFE segregacion |
| OP 120 | 7 | Causas AMFE embalaje |

### 1.3 Diferencias Insert

**A. Operaciones no coinciden**:
- PDF usa: 10, 0.25, 30, 31, 40, 50, 60, 70, 80, 90, 100
- Supabase usa: 10, 15, 20, 25, 30, 40, 50, 60, 61, 70, 71, 80, 81, 90, 91, 92, 100, 103, 105, 110, 111, 120
- Las operaciones de Supabase vienen del AMFE/PFD (numeracion propia), no del CP PDF

**B. Contenido fundamentalmente diferente**:
- PDF: "Tipo de Producto = Plastico PP" (caracteristica de producto, con metodo "Visual identificacion en pieza", frecuencia "1 muestra por entrega")
- Supabase: "Mala estiba y embalaje inadecuado" (causa AMFE, con metodo "Medios de embalaje validados", frecuencia "Cada recepcion")

**C. Especificaciones**:
- PDF tiene valores concretos: "Espesor min 1.5 - max 2.5", "Flamabilidad <100 mm/min SC", "Gramaje 800-1000 GMS/MT2", "Viscosidad 950cP +/-15%", "11+/-1 puntadas/5cm", "Temp 85C+/-5C"
- Supabase: 65% items tienen spec generica "Segun instruccion de proceso" o "Conforme a especificacion de proceso"

**D. Caracteristicas especiales (SC/CC)**:
- PDF tiene SC1 en costura vista (puntadas/5cm y ancho entre costuras) y SC en flamabilidad vinilo
- Supabase: 0 items con specialChar marcado

**E. Items del PDF ausentes en Supabase**:
- Todas las verificaciones de recepcion especificas (Tipo producto, Color, Torres, Espesor, Gramaje, Viscosidad) con sus valores concretos
- Set up de corte (capas=10, cuchilla>=4mm, Myler)
- Parametros costura (puntadas/cm, ancho mm, cabos hilo)
- Parametros tapizado (temperatura, velocidad)
- Test Layout (flamabilidad, dimensional 30 muestras)

**F. Items en Supabase que NO existen en el PDF**:
- 209 items totales, TODOS generados desde causas AMFE
- Operaciones enteras (OP 61, 71, 81, 92 - armado de kit, OP 103 - retrabajo, OP 111 - segregacion) no existen en el PDF

---

## 2. ARMREST DOOR PANEL (CP-ARMREST-001)

### 2.1 Estructura PDF (PC 2GJ.867.165-166 Rev.0)

| Operacion PDF | Nombre | Caracteristicas clave |
|--------------|--------|----------------------|
| Op 0.10 | Recepcion | Tipo producto (PP), Color negro, Dimensional, Aspecto (libre de rebaba/marcas/deformaciones), Espesor vinilo (5+/-0.05mm), Flamabilidad SC (<100mm/min), Color vinilo, Gramaje (>430/>550 g/m2), Certificado calidad, Fecha vencimiento adhesivo (>6 meses), Lote, Viscosidad adhesivo Hot Melt (16000-21000 mPas) |
| Op 0.25 / HO-MC-025 | Corte (Set up) | Hoja set-up, Cantidad capas segun instructivo, Cuchilla >4mm, Dimensional segun Myler |
| Op 10 | Adhesivado de piezas | Set up (Rollor 170C+/-5, Batea 200C+/-10), Adhesivo buen estado (>6 meses), Adhesivado completo, Fecha vencimiento, Temp horno 60-70C, Pieza calentada 60-65 seg |
| Op 20 | Tapizado automatico | Vinilo posicionado, Tapizado sin arrugas, Sin marcas, Posicion blank OK, Talon costura en canaleta, Adherencia correcta |
| Op 30 | Inspeccion final | Dimensional (calibre, 5 piezas/lote inyeccion), Peeling (dinamometro, 1 pieza/lote), Apariencia (despegues, cortes, adhesivado, manchas, etiqueta) |
| Op 40 | Embalaje | Identificacion (codigo pieza + etiqueta), Cantidad 16 piezas/cajon |

### 2.2 Estructura Supabase (CP-ARMREST-001)

| Operacion Supabase | Items | Contenido |
|-------------------|-------|-----------|
| OP 10 | 19 | Causas AMFE recepcion |
| OP 15 | 6 | Causas AMFE corte manual |
| OP 20 | 6 | Causas AMFE corte automatico |
| OP 25 | 2 | Causas AMFE verificacion |
| OP 30 | 6 | Causas AMFE armado kit |
| OP 40 | 4 | Causas AMFE refilado |
| OP 50 | 12 | Causas AMFE costura 1 |
| OP 51 | 21 | Causas AMFE costura 2 |
| OP 52 | 6 | Causas AMFE armado kit |
| OP 60 | 15 | Causas AMFE inyeccion |
| OP 61 | 6 | Causas AMFE armado kit |
| OP 70 | 12 | Causas AMFE espumado PU |
| OP 71 | 2 | Causas AMFE separador |
| OP 72 | 6 | Causas AMFE embalaje PU |
| OP 80-82 | 18 | Causas AMFE adhesivado |
| OP 90 | 4 | Causas AMFE tapizado |
| OP 100-103 | 23 | Causas AMFE inspeccion/retrabajo |
| OP 110 | 6 | Causas AMFE embalaje |

### 2.3 Diferencias Armrest

**A. Operaciones**:
- PDF: 0.10, 0.25, 10, 20, 30, 40 (6 operaciones)
- Supabase: 10, 15, 20, 25, 30, 40, 50, 51, 52, 60, 61, 70, 71, 72, 80, 81, 82, 90, 100, 101, 103, 110 (22 operaciones)
- El PDF del Armrest es mucho mas simple (producto adhesivado sin costura); Supabase tiene 22 ops del AMFE que incluyen costura, inyeccion, espumado PU

**B. Contenido del PDF ausente**:
- Espesor vinilo "5 +/- 0.05 mm" (valor especifico)
- Flamabilidad SC "<100 mm/min"
- Gramaje ">430 g/m2 > 550 g/m2"
- Viscosidad adhesivo Hot Melt "16000-21000 mPas"
- Parametros adhesivado: Rollor 170C+/-5, Batea 200C+/-10
- Parametros horno: 60-70C, 60-65 segundos
- Peeling con dinamometro (ensayo de resistencia adhesivado)
- Cantidad embalaje: 16 piezas/cajon

**C. Items en Supabase que NO existen en PDF**:
- Costura (OP 50, 51) - El Armrest NO tiene costura segun el PDF
- Inyeccion (OP 60) - Proceso externo, no en el CP del Armrest
- Espumado PU (OP 70) - Proceso externo/integrado
- Retrabajo (OP 103) - No existe en CP real
- Segregacion (OP 101) - No existe en CP real

**D. SC/CC**: PDF marca Flamabilidad como SC; Supabase tiene 0 SC items

---

## 3. TOP ROLL (CP-TOPROLL-001)

### 3.1 Estructura PDF (PC TOP ROLL Rev.0)

| Operacion PDF | Nombre | Caracteristicas clave |
|--------------|--------|----------------------|
| Op 0.10 | Recepcion | Sustrato izq (ABS, Color negro, Torres, Dimensional, Aspecto), Sustrato der (idem), Vinilo SANVEO (Espesor 2.1mm min1.8-max2.4, Flamabilidad SC <100mm/min, Color, Gramaje 740+/-10% = 670-820 GMS/MT2), Certificado calidad, Fecha vencimiento (>6 meses), Lote, Adhesivo (Viscosidad 950cP +/-15%) |
| Op 10 / HO-MC-025 | Corte SANVEO (Set up) | Hoja set-up, Capas=2, Cuchilla 4mm, Dimensional segun Myler |
| Op 20 | Adhesivado | Adhesivo buen estado (>6 meses), Adhesivado completo, Fecha vencimiento, Temp horno 60-70C, 60-65 seg |
| Op 30 | Tapizado semi-automatico | Vinilo posicionado, Sin arrugas, Sin marcas, Posicion blank, Talon costura, Adherencia, Costura alineada 100mm+/-1mm |
| Op 40 | Virolado + Refilado | Virolado contorno completo, Pegado pliegues, Zonas criticas, Sin quemado vinilo |
| Op 50 | Inspeccion final | Dimensional (calibre, 5 piezas/lote inyeccion), Apariencia (despegues, cortes, soldadura ultrasonido, manchas) |
| Op 60 | Embalaje | Identificacion (codigo pieza), Cantidad 8 piezas/cajon en bolsa |

### 3.2 Estructura Supabase (CP-TOPROLL-001)

| Operacion Supabase | Items | Contenido |
|-------------------|-------|-----------|
| OP 5 | 24 | Causas AMFE recepcion + 2 items con datos reales del PDF (aspecto/flamabilidad) |
| OP 10 | 19 | Causas AMFE inyeccion (!) + set-up |
| OP 11 | 6 | Causas AMFE armado kit |
| OP 20 | 11 | Causas AMFE adhesivado |
| OP 30 | 5 | Causas AMFE tapizado |
| OP 40 | 5 | Causas AMFE virolado/refilado |
| OP 50 | 4 | Causas AMFE plegado |
| OP 60 | 2 | Causas AMFE soldadura |
| OP 70 | 4 | Causas AMFE tweeter |
| OP 80 | 7 | Causas AMFE inspeccion + 1 item real |
| OP 90 | 7 | Causas AMFE embalaje + 1 item real |

### 3.3 Diferencias Top Roll

**A. Operaciones**:
- PDF: 0.10, 10, 20, 30, 40, 50, 60 (7 operaciones)
- Supabase: 5, 10, 11, 20, 30, 40, 50, 60, 70, 80, 90 (11 operaciones)
- Supabase incluye OP 60 (soldadura), OP 70 (tweeter) que NO estan en el PDF del CP

**B. Top Roll tiene mejor cobertura parcial**:
- OP 5 incluye 2 items que SÍ reflejan el PDF: "Tipo de Producto, Color, Torres" y "Flamabilidad <100 mm/min"
- OP 80 incluye "Apariencia sin despegues, cortes, soldadura OK, sin manchas"
- OP 90 incluye "Identificacion correcta, Cantidad 8 piezas por cajon en bolsa"
- Estos son los UNICOS items en los 3 CPs que contienen datos reales del PDF

**C. Items del PDF ausentes**:
- Valores dimensionales especificos: Espesor vinilo 2.1mm (1.8-2.4), Gramaje 670-820 GMS/MT2
- Viscosidad adhesivo 950cP +/-15%
- Parametros adhesivado horno (60-70C, 60-65 seg)
- Parametros tapizado (Costura alineada 100mm+/-1mm)
- Capas de corte (2), Cuchilla 4mm
- Inspeccion calibre (5 piezas/lote)

**D. Items inventados**:
- OP 70 (Tweeter) - 4 items sobre soldadura de Tweeter que NO aparecen en el PDF
- OP 60 (Soldadura) - 2 items sobre soldadura que pueden ser parte del proceso real pero no del CP PDF

---

## 4. Diagnostico General

### 4.1 Raiz del problema

Los CPs en Supabase fueron generados automaticamente por el sistema de cross-generation AMFE->CP (`cpGenerator`). Este sistema toma las **causas de falla** del AMFE y las convierte en items del CP. Esto produce un documento que:

1. **Tiene la estructura de un CP** (items con caracteristica, spec, metodo, frecuencia)
2. **Pero el contenido viene del AMFE** (causas de falla como "caracteristicas")
3. **No contiene los datos reales del CP PDF** (valores de espesor, temperatura, gramaje, puntadas, etc.)

### 4.2 Tabla de diferencias sistematicas

| Aspecto | PDF Real | Supabase |
|---------|----------|----------|
| Caracteristicas | Producto/proceso reales (Espesor, Color, Gramaje, Puntadas) | Causas de falla AMFE (Mala estiba, Error operario, Falla maquina) |
| Especificaciones | Valores concretos (1.5-2.5mm, 950cP, 11+/-1 puntadas) | Genericas ("Segun instruccion de proceso") en 65-91% |
| Metodos control | Del CP real (Visual, Patron aspecto, Calibre, Medidor espesor) | Del AMFE (Instrucciones de trabajo, Ayudas visuales, Auditorias) |
| Frecuencias | Especificas (Por entrega, Inicio turno, 100%/lote) | Genericas (Cada recepcion, Inicio y fin de turno) |
| Muestras | Concretas (1 muestra, 5 piezas/lote, 30 muestras) | Genericas (100%, 3 piezas, 5 piezas) |
| SC/CC | Marcadas en flamabilidad y costura | 0 items marcados |
| Volumen | ~28-65 items | 94-209 items (inflado 2x-7x) |
| Operaciones | Numeracion del CP real | Numeracion del PFD/AMFE |

### 4.3 Que funciona correctamente

- La **estructura** del CP es valida (items agrupados por operacion con todos los campos AIAG)
- La **trazabilidad AMFE->CP** funciona (cada item vincula a causas/fallas del AMFE)
- Las **cross-validations** (V1-V8) funcionan correctamente contra estos datos
- Los 4 items "reales" en Top Roll demuestran que es posible incluir datos del PDF

### 4.4 Que NO funciona

- Los CPs NO son utiles como **documentos de produccion** (un operador no puede usarlos en planta)
- Las **especificaciones** son genericas en lugar de tener los valores reales
- Las **caracteristicas especiales** (SC/CC) del PDF no estan reflejadas
- El **volumen** esta inflado (174-209 items vs 28-65 del PDF real)
- Los **metodos de control** reales (patron aspecto, calibre, medidor espesor, Myler, dinamometro) no estan

---

## 5. Impacto y Recomendacion

### Impacto en el sistema actual

El CP auto-generado cumple su funcion **dentro del sistema APQP digital** (trazabilidad, cross-validation, alertas). Para uso como **documento de referencia para auditorias VW o para planta**, no es adecuado en su estado actual.

### Que se necesitaria para que los CPs sean fidedignos al PDF

1. **Transcripcion manual o carga directa** de los items del CP PDF, con:
   - Valores especificos de especificacion (temperaturas, espesores, gramajes, puntadas)
   - Metodos de control reales (patron aspecto, calibre, medidor, Myler, dinamometro)
   - Frecuencias y tamanos de muestra reales
   - Marcacion SC/CC donde corresponda
   - Numeracion de operaciones del CP PDF real

2. **Mantener la trazabilidad AMFE** como metadata (amfeCauseIds) pero usar datos del CP real como contenido visible.

3. **Separar conceptualmente** el "CP auto-generado desde AMFE" (util para gap analysis) del "CP de produccion" (transcripcion del PDF real).

---

## Anexo: Items del PDF por producto

### Insert - 65 items aprox en 11 operaciones
- Op 10 Recepcion: ~28 items (sustrato PP, vinilo negro/gris x2, hilos vista/union x4, adhesivo)
- Op 0.25 Corte: 4 items (set-up, capas, cuchilla, dimensional)
- Op 30 Costura Union: ~7 items (apariencia, aguja, puntada/toma)
- Op 31 Costura Vista: ~7 items (set-up, puntada SC1, paralelismo)
- Op 40 Primer: 1 item (fecha vencimiento)
- Op 50 Adhesivado: 3 items
- Op 60 Tapizado: ~8 items (temp, velocidad, posicion, arrugas, talon, alineacion)
- Op 70 Virolado: ~5 items
- Op 80 Inspeccion: 2 items (dimensional, apariencia)
- Op 90 Embalaje: 2 items
- Op 100 Test Layout: 2 items (flamabilidad, dimensional 30 muestras)

### Armrest - 28 items aprox en 6 operaciones
- Op 0.10 Recepcion: ~12 items (sustrato PP, vinilo 5mm, flamabilidad SC, gramaje, adhesivo Hot Melt viscosidad)
- Op 0.25 Corte: 4 items (set-up, capas, cuchilla, dimensional)
- Op 10 Adhesivado: ~6 items (set-up Rollor/Batea, adhesivo, adhesivado completo, horno)
- Op 20 Tapizado: ~6 items (posicion, arrugas, marcas, talon, adherencia)
- Op 30 Inspeccion: 3 items (dimensional, peeling, apariencia)
- Op 40 Embalaje: 2 items (identificacion, cantidad 16 piezas)

### Top Roll - 45 items aprox en 7 operaciones
- Op 0.10 Recepcion: ~17 items (sustrato izq ABS, sustrato der ABS, vinilo SANVEO espesor/flamabilidad/gramaje, adhesivo)
- Op 10 Corte: 4 items (set-up, capas=2, cuchilla, dimensional)
- Op 20 Adhesivado: ~5 items (adhesivo, adhesivado completo, horno 60-70C)
- Op 30 Tapizado: ~8 items (posicion, arrugas, marcas, talon, adherencia, costura 100mm+/-1mm)
- Op 40 Virolado: ~5 items
- Op 50 Inspeccion: 2 items (dimensional 5 piezas/lote, apariencia)
- Op 60 Embalaje: 2 items (identificacion, cantidad 8 piezas)
