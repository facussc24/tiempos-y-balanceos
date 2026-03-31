# Auditoria PFD — Barack Mercosul

**Fecha:** 2026-03-31
**Tipo:** Solo lectura — no se modifico ningun dato ni codigo
**Alcance:** 8 documentos PFD (8 familias) + comparacion cruzada con AMFE/CP/HO + verificacion de exports SVG/PDF
**Fuentes:** Supabase (produccion), codigo fuente de exports

---

## Resumen Ejecutivo

| Severidad | Cantidad | Descripcion |
|-----------|----------|-------------|
| GRAVE | 5 | Links PFD→AMFE 0%, "$1" en headrests, desalineacion numerica headrests, linkedAmfeProject roto, nombres Insert divergen masivamente |
| MEDIO | 10 | Part numbers falsos, empresa/cliente inconsistentes, footer "Software", equipo truncado, ops faltantes en PFD o AMFE, tipo recepcion inconsistente, transportes faltantes, WIP faltante |
| MENOR | 8 | Top Roll nombres no estandar, decision text inconsistente, embalaje nombres distintos, Top Roll ingles, inspecciones sin numero |
| **TOTAL** | **23** | |

**Productos mas afectados:** Insert (nombres divergen masivamente con AMFE/CP/HO), Headrest Front/Rear Center/Rear Outer (numeracion completamente desalineada con AMFE, "$1" artifact, PFD identico para 3 productos distintos).

---

## 1. Inventario de Operaciones por PFD

### 1.1 Insert Patagonia (46 pasos)

| Nro | Descripcion | Tipo | Disposicion |
|-----|------------|------|-------------|
| 10 | RECEPCION DE MATERIA PRIMA | storage | none |
| — | ALMACENADO EN SECTOR DE RECEPCION DE MATERIA PRIMA PENDIENTE DE CONTROL | storage | none |
| — | INSPECCION DE MATERIA PRIMA | inspection | none |
| — | MATERIAL CONFORME? | decision | scrap |
| — | TRASLADO: MATERIAL APROBADO A ALMACEN TEMPORAL (FIFO) | transport | none |
| — | ALMACENADO EN SECTOR DE RECEPCION DE MATERIA PRIMA CONTROLADA E IDENTIFICADA | storage | none |
| — | TRASLADO: VINILOS Y TELAS A SECTOR DE MESA DE CORTE | transport | none |
| 15 | PREPARACION DE CORTE | operation | none |
| 20 | CORTAR COMPONENTES | operation | none |
| 25 | CONTROL CON MYLAR | inspection | none |
| — | PRODUCTO CONFORME? | decision | scrap |
| 30 | ALMACENAMIENTO EN MEDIOS WIP | storage | none |
| — | TRASLADO: KITS DE COMPONENTES A SECTOR DE COSTURA | transport | none |
| 40 | REFILADO | operation | none |
| 50 | COSTURA EN MAQUINA CNC | operation | none |
| — | TRASLADO: HILOS A SECTOR DE COSTURA | transport | none |
| 51 | ALMACENAMIENTO EN MEDIOS WIP | storage | none |
| — | TRASLADO: SEMITERMINADOS COSIDOS SECTOR DE COSTURA | transport | none |
| — | TRASLADO: ESPUMAS A SECTOR DE TROQUELADO | transport | none |
| 60 | TROQUELADO | operation | none |
| 61 | ALMACENAMIENTO EN MEDIOS WIP | storage | none |
| — | TRASLADO: PIEZAS TROQUELADAS A SECTOR DE PREARMADO | transport | none |
| — | TRASLADO: MATERIA PRIMA A SECTOR DE INYECCION PLASTICA | transport | none |
| 70 | INYECCION DE PIEZAS PLASTICAS | operation | none |
| 71 | ALMACENAMIENTO EN MEDIOS WIP | storage | none |
| — | TRASLADO: SUSTRATO A SECTOR DE PREARMADO DE ESPUMA | transport | none |
| 80 | PREARMADO DE ESPUMA | operation | none |
| 81 | ALMACENAMIENTO EN MEDIOS WIP | storage | none |
| — | TRASLADO: PIEZA PREARMADA AL SECTOR DE ADHESIVADO | transport | none |
| 90 | ADHESIVADO | operation | none |
| 91 | INSPECCION DE PIEZA ADHESIVADA | inspection | none |
| — | PRODUCTO CONFORME? | decision | none |
| 103 | REPROCESO: FALTA DE ADHESIVO | operation | rework |
| — | REPROCESO OK? | decision | scrap |
| 92 | ALMACENAMIENTO EN MEDIOS WIP | storage | none |
| — | TRASLADO: PIEZA PREARMADA AL SECTOR DE TAPIZADO | transport | none |
| 100 | TAPIZADO SEMIAUTOMATICO | operation | none |
| 110 | CONTROL FINAL DE CALIDAD | inspection | none |
| — | PRODUCTO CONFORME? | decision | none |
| — | CLASIFICACION Y SEGREGACION DE PRODUCTO NO CONFORME | operation | none |
| 111 | PIEZA IRRECUPERABLE SCRAP | operation | scrap |
| 104 | REPROCESO: PUNTADA FLOJA | operation | rework |
| — | TRASLADO A SECTOR DE PRODUCTO TERMINADO | transport | none |
| 120 | EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO | operation | none |
| — | TRASLADO A SECTOR DE ALMACENAMIENTO | transport | none |
| — | ALMACENAMIENTO: PRODUCTO TERMINADO (FIFO) | storage | none |

### 1.2 Armrest Door Panel Patagonia (43 pasos)

| Nro | Descripcion | Tipo | Disposicion |
|-----|------------|------|-------------|
| 10 | RECEPCION DE MATERIA PRIMA | storage | none |
| — | ALMACENADO EN SECTOR DE RECEPCION DE MATERIA PRIMA PENDIENTE DE CONTROL | storage | none |
| — | INSPECCION DE MATERIA PRIMA | inspection | none |
| — | MATERIAL CONFORME? | decision | scrap |
| — | TRASLADO: MATERIAL APROBADO A ALMACEN TEMPORAL (FIFO) | transport | none |
| — | ALMACENADO EN SECTOR DE RECEPCION DE MATERIA PRIMA CONTROLADA E IDENTIFICADA | storage | none |
| — | TRASLADO: VINILOS Y TELAS A SECTOR DE MESA DE CORTE | transport | none |
| 15 | PREPARACION DE CORTE | operation | none |
| 20 | CORTE DE COMPONENTES | operation | none |
| 25 | CONTROL CON MYLAR | inspection | none |
| — | PRODUCTO CONFORME? | decision | scrap |
| 30 | ALMACENAMIENTO EN MEDIOS WIP | storage | none |
| — | TRASLADO: KITS DE COMPONENTES A SECTOR DE COSTURA | transport | none |
| 40 | REFILADO | operation | none |
| 50 | COSTURA UNION | operation | none |
| — | TRASLADO: HILOS A SECTOR DE COSTURA | transport | none |
| 51 | COSTURA DOBLE | operation | none |
| 52 | ALMACENAMIENTO EN MEDIOS WIP | storage | none |
| — | TRASLADO: SEMITERMINADOS COSIDOS A SECTOR DE ADHESIVADO | transport | none |
| — | TRASLADO: MATERIA PRIMA A SECTOR DE INYECCION PLASTICA | transport | none |
| 60 | INYECCION DE PIEZAS PLASTICAS | operation | none |
| 61 | ALMACENAMIENTO EN MEDIOS WIP | storage | none |
| — | TRASLADO: SUSTRATO A SECTOR DE INYECCION PU | transport | none |
| — | TRASLADO: BARRIL AL SECTOR DE INYECCION PU | transport | none |
| 70 | INYECCION PU | operation | none |
| 71 | ALMACENAMIENTO EN MEDIOS WIP | storage | none |
| 72 | ENSAMBLE DE SUSTRATO CON ESPUMA | operation | none |
| — | TRASLADO: SUSTRATO + ESPUMA A SECTOR DE ADHESIVADO | transport | none |
| 80 | ADHESIVADO | operation | none |
| 81 | INSPECCION DE PIEZA ADHESIVADA | inspection | none |
| — | PRODUCTO CONFORME? | decision | none |
| 103 | REPROCESO: FALTA DE ADHESIVO | operation | rework |
| — | REPROCESO OK? | decision | scrap |
| 82 | ALMACENAMIENTO EN MEDIOS WIP | storage | none |
| — | TRASLADO: PIEZA ADHESIVADA AL SECTOR DE TAPIZADO | transport | none |
| 90 | TAPIZADO SEMIAUTOMATICO | operation | none |
| 100 | CONTROL FINAL DE CALIDAD | inspection | none |
| — | PRODUCTO CONFORME? | decision | none |
| — | CLASIFICACION Y SEGREGACION DE PRODUCTO NO CONFORME | operation | none |
| 101 | PIEZA IRRECUPERABLE SCRAP | operation | scrap |
| — | TRASLADO A SECTOR DE PRODUCTO TERMINADO | transport | none |
| 110 | EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO | operation | none |
| — | ALMACENAMIENTO: PRODUCTO TERMINADO (FIFO) | storage | none |

### 1.3 Top Roll Patagonia (25 pasos)

| Nro | Descripcion | Tipo | Disposicion |
|-----|------------|------|-------------|
| 5 | RECEPCION DE MATERIALES: TABLA DE MATERIALES | storage | none |
| — | ALMACENADO EN SECTOR DE RECEPCION DE MATERIA PRIMA PENDIENTE DE CONTROL | storage | none |
| — | INSPECCION DE MATERIALES | inspection | none |
| — | MATERIAL CONFORME? | decision | scrap |
| — | ALMACENADO EN SECTOR DE RECEPCION DE MATERIA PRIMA CONTROLADA E IDENTIFICADA | storage | none |
| — | TRASLADO DE MATERIA PRIMA AL SECTOR DE INYECCION | transport | none |
| 10 | INYECCION DE PIEZA PLASTICA | operation | none |
| — | ESTA OK LA PIEZA? | decision | scrap |
| 20 | ADHESIVADO HOT MELT | operation | none |
| — | ESTA OK LA PIEZA? | decision | scrap |
| 30 | PROCESO DE IMG (TERMOFORMADO) | operation | none |
| — | ESTA OK LA PIEZA? | decision | scrap |
| 40 | TRIMMING - CORTE FINAL | operation | none |
| — | ESTA OK LA PIEZA? | decision | scrap |
| 50 | EDGE FOLDING | operation | none |
| — | ESTA OK LA PIEZA? | decision | scrap |
| 60 | SOLDADO DE REFUERZOS INTERNOS | operation | none |
| — | ESTA OK LA PIEZA? | decision | scrap |
| 70 | SOLDADO TWEETER | operation | none |
| — | INSPECCION FINAL | inspection | none |
| — | ESTA OK LA PIEZA? | decision | scrap |
| — | TRASLADO DE PIEZAS AL SECTOR DE PRODUCTO TERMINADO | transport | none |
| 90 | EMBALAJE | operation | none |
| — | CONTROL DE LAS CANTIDADES DE DESPACHO | inspection | none |
| — | ALMACENADO EN SECTOR DE PRODUCTO TERMINADO | storage | none |

### 1.4 Headrest Front (23 pasos)

| Nro | Descripcion | Tipo | Disposicion |
|-----|------------|------|-------------|
| 10 | RECEPCION DE MATERIA PRIMA | storage | none |
| — | INSPECCION DE MATERIA PRIMA | inspection | scrap |
| — | ALMACENADO EN SECTOR DE RECEPCION DE MATERIA PRIMA CONTROLADA E IDENTIFICADA | storage | none |
| — | TRASLADO: VINILOS / TELAS A SECTOR DE MESA DE CORTE | transport | none |
| 20 | CORTE DE COMPONENTES | operation | none |
| 30 | PREPARACION DE KITS DE COMPONENTES DE COSTURA | operation | none |
| — | TRASLADO: KITS DE COMPONENTES DE COSTURA A SECTOR DE COSTURA | transport | none |
| 40 | COSTURA UNION | operation | none |
| 50 | COSTURA VISTA (Aplica solo a L1 Rennes Black, L2 Andino Gray, L3 Dark Slate — NO aplica a L0 Titan Black) | operation | none |
| — | TRASLADO: FUNDAS COSIDAS APROBADAS A AREA DE INYECCION | transport | none |
| 60 | ENSAMBLE ASTA - FUNDA | operation | none |
| 70 | INYECCION PUR | operation | none |
| 80 | CURADO Y ESTABILIZACION DE ESPUMA | operation | none |
| — | TRASLADO: MATERIAL APROBADO A ALMACEN TEMPORAL (FIFO) | transport | none |
| 90 | CONTROL FINAL DE CALIDAD Y PRUEBAS FUNCIONALES | inspection | sort |
| — | PRODUCTO CONFORME$1 | decision | none |
| 100 | CLASIFICACION Y SEGREGACION DE PRODUCTO NO CONFORME | operation | scrap |
| 110 | REPROCESO: ELIMINACION DE HILO SOBRANTE | operation | rework |
| 111 | REPROCESO: PUNTADA FLOJA | operation | rework |
| 112 | REPROCESO: ELIMINACION DE ARRUGAS EN HORNO | operation | rework |
| 120 | EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO | operation | none |
| — | ALMACENAMIENTO: PRODUCTO TERMINADO (FIFO) | storage | none |
| — | TRASLADO A SECTOR DE PRODUCTO TERMINADO | transport | none |

### 1.5 Headrest Rear Center (23 pasos)

Identico al Headrest Front (ver 1.4). Los 3 headrests comparten exactamente el mismo PFD.

### 1.6 Headrest Rear Outer (23 pasos)

Identico al Headrest Front (ver 1.4). Los 3 headrests comparten exactamente el mismo PFD.

### 1.7 Telas Planas PWA (17 pasos)

| Nro | Descripcion | Tipo | Disposicion |
|-----|------------|------|-------------|
| 10 | RECEPCION DE MATERIA PRIMA | **operation** | none |
| — | INSPECCION DE MATERIA PRIMA | inspection | scrap |
| — | ALMACENADO EN SECTOR DE MATERIA PRIMA CONTROLADA | storage | none |
| 15 | PREPARACION DE CORTE | operation | none |
| 20 | CORTE DE COMPONENTES | operation | none |
| 25 | CONTROL CON MYLAR | inspection | scrap |
| 30 | PREPARACION DE KITS DE COMPONENTES | operation | none |
| 40 | COSTURA RECTA | operation | none |
| 50 | TROQUELADO DE REFUERZOS | operation | none |
| 60 | TROQUELADO DE APLIX | operation | none |
| 70 | PEGADO DE DOTS APLIX | operation | none |
| 80 | CONTROL FINAL DE CALIDAD | inspection | sort |
| 90 | PRODUCTO CONFORME? | decision | none |
| 95 | CLASIFICACION Y SEGREGACION DE PRODUCTO NO CONFORME | operation | scrap |
| 100 | REPROCESO (ELIMINACION DE HILO / REUBICACION APLIX / CORRECCION COSTURA) | operation | rework |
| 110 | EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO | operation | none |
| — | ALMACENAMIENTO PRODUCTO TERMINADO (FIFO) | storage | none |

### 1.8 Telas Termoformadas PWA (21 pasos)

| Nro | Descripcion | Tipo | Disposicion |
|-----|------------|------|-------------|
| 10 | RECEPCION DE MATERIA PRIMA | **operation** | none |
| — | INSPECCION DE MATERIA PRIMA | inspection | scrap |
| — | ALMACENADO EN SECTOR DE MATERIA PRIMA CONTROLADA | storage | none |
| 15 | PREPARACION DE CORTE | operation | none |
| 20 | CORTE DE COMPONENTES | operation | none |
| 25 | CONTROL CON MYLAR | inspection | scrap |
| 30 | PREPARACION DE KITS DE COMPONENTES | operation | none |
| 40 | TERMOFORMADO DE TELAS | operation | none |
| 50 | CORTE LASER DE TELAS TERMOFORMADAS | operation | none |
| 60 | TROQUELADO DE REFUERZOS | operation | none |
| 70 | TROQUELADO DE APLIX | operation | none |
| 80 | COSTURA DE REFUERZOS | operation | none |
| 90 | APLICACION DE APLIX | operation | none |
| 100 | CONTROL FINAL DE CALIDAD | inspection | sort |
| 110 | PRODUCTO CONFORME? | decision | none |
| 111 | CLASIFICACION Y SEGREGACION DE PRODUCTO NO CONFORME | operation | scrap |
| 112 | REPROCESO: ELIMINACION DE HILO SOBRANTE | operation | rework |
| 113 | REPROCESO: REUBICACION DE APLIX | operation | rework |
| 114 | REPROCESO: CORRECCION DE COSTURA DESVIADA / FLOJA | operation | rework |
| 120 | EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO | operation | none |
| — | ALMACENAMIENTO PRODUCTO TERMINADO (FIFO) | storage | none |

---

## 2. Nombres de Operaciones — Inconsistencias entre PFDs

### 2.1 Recepcion: 4 variantes distintas | MEDIO

| PFD | Nombre | Tipo |
|-----|--------|------|
| Insert, Armrest, HR Front/Cen/Out | RECEPCION DE MATERIA PRIMA | storage |
| Top Roll | RECEPCION DE MATERIALES: TABLA DE MATERIALES | storage |
| Telas Planas | RECEPCION DE MATERIA PRIMA | **operation** |
| Telas Termoformadas | RECEPCION DE MATERIA PRIMA | **operation** |

**Problemas:**
- Top Roll usa nombre completamente distinto ("MATERIALES" + subtitulo "TABLA DE MATERIALES")
- Telas Planas y Termoformadas clasifican Recepcion como `operation` en vez de `storage` — inconsistente con los otros 6 PFDs

### 2.2 Control Final: 3 variantes | MENOR

| PFD | Nombre |
|-----|--------|
| Insert, Armrest, Telas Planas, Telas Termo | CONTROL FINAL DE CALIDAD |
| Headrests (3) | CONTROL FINAL DE CALIDAD Y PRUEBAS FUNCIONALES |
| Top Roll | INSPECCION FINAL (sin numero de operacion) |

### 2.3 Embalaje: 2 variantes | MENOR

| PFD | Nombre |
|-----|--------|
| Insert, Armrest, Headrests, Telas Planas, Telas Termo | EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO |
| Top Roll | EMBALAJE |

### 2.4 Corte: 2 variantes | MENOR

| PFD | Nombre |
|-----|--------|
| Insert | CORTAR COMPONENTES |
| Armrest, HR Front/Cen/Out, Telas Planas, Telas Termo | CORTE DE COMPONENTES |

### 2.5 Decision steps: 3 variantes | MENOR

| PFD | Texto decision |
|-----|---------------|
| Insert, Armrest | PRODUCTO CONFORME? / MATERIAL CONFORME? |
| Top Roll | ESTA OK LA PIEZA? (x7 veces) |
| Headrests | PRODUCTO CONFORME$1 (con artifact "$1") |

### 2.6 Transporte naming | MENOR

Los transportes son especificos por producto (destinos distintos por proceso), por lo que las diferencias de nombre son esperables. Sin embargo:
- Insert y Armrest: formato consistente "TRASLADO: [origen] A [destino]"
- Top Roll: formato "TRASLADO DE [material] AL SECTOR DE [destino]"
- Headrests: formato "TRASLADO: [material] A [destino]"
- Telas Planas y Termoformadas: **no tienen ningun paso de transporte**

---

## 3. Consistencia PFD ↔ AMFE ↔ CP ↔ HO

### 3.0 Hallazgo critico: 0% de links PFD→AMFE | GRAVE

**Ninguno de los 244 pasos PFD (sumados entre los 8 documentos) tiene `linkedAmfeOperationId` completado.** Todos los links estan vacios. Esto significa:
- No hay trazabilidad automatica PFD→AMFE a nivel de paso individual
- La validacion cruzada `pfdAmfeLinkValidation.ts` no puede funcionar (no hay links que validar)
- La auditoria anterior (2026-03-30) reporto "Links bidireccionales intactos" — pero eso era porque no habia links rotos; en realidad no hay NINGUN link

### 3.1 Insert Patagonia | GRAVE — nombres masivamente divergentes

El PFD usa nombres simples pero el AMFE/CP/HO usan formato "SECCION - OPERACION":

| OP | PFD | AMFE / CP / HO | Estado |
|----|-----|----------------|--------|
| 10 | RECEPCION DE MATERIA PRIMA | RECEPCION DE MATERIA PRIMA | OK |
| 15 | PREPARACION DE CORTE | CORTE DE COMPONENTES DE VINILO O TELA - PREPARACIÓN DE CORTE | DIVERGE |
| 20 | CORTAR COMPONENTES | CORTE DE COMPONENTES DE VINILO O TELA - CORTAR COMPONENTES | DIVERGE |
| 25 | CONTROL CON MYLAR | CORTE DE COMPONENTES DE VINILO O TELA - CONTROL CON MYLAR | DIVERGE |
| 30 | ALMACENAMIENTO EN MEDIOS WIP | CORTE DE COMPONENTES DE VINILO O TELA | DIVERGE (PFD=storage, AMFE=operation) |
| 40 | REFILADO | COSTURA - REFILADO | DIVERGE |
| 50 | COSTURA EN MAQUINA CNC | COSTURA - COSTURA CNC | DIVERGE |
| 60 | TROQUELADO | TROQUELADO - TROQUELADO DE ESPUMA | DIVERGE |
| 70 | INYECCION DE PIEZAS PLASTICAS | INYECCIÓN PLÁSTICA - INYECCIÓN DE PIEZAS PLÁSTICAS | DIVERGE (tildes) |
| 80 | PREARMADO DE ESPUMA | PREARMADO DE ESPUMA | OK |
| 90 | ADHESIVADO | ADHESIVADO - ADHESIVAR PIEZAS | DIVERGE |
| 100 | TAPIZADO SEMIAUTOMATICO | TAPIZADO - TAPIZADO SEMIAUTOMÁTICO | DIVERGE (tilde) |
| 103 | REPROCESO: FALTA DE ADHESIVO | REPROCESO: FALTA DE ADHESIVO | OK |
| 110 | CONTROL FINAL DE CALIDAD | CONTROL FINAL DE CALIDAD | OK |
| 120 | EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO | EMBALAJE | DIVERGE (PFD mas largo) |

**Ademas:** PFD tiene `linkedAmfeProject: "VWA/PATAGONIA/INSERTO"` pero el AMFE se llama `"VWA/PATAGONIA/INSERT"`. Link roto.

### 3.2 Armrest Door Panel | Casi limpio

| OP | PFD | AMFE / CP / HO | Estado |
|----|-----|----------------|--------|
| 10-103 | (todos) | (todos) | OK — nombres coinciden exactamente |
| 110 | EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO | EMBALAJE | DIVERGE |

**Unica divergencia:** Embalaje. PFD usa nombre largo, AMFE/CP/HO usan "EMBALAJE" corto.
**Ademas:** PFD tiene `linkedAmfeProject: "VWA/PATAGONIA/ARMREST"` pero el AMFE se llama `"VWA/PATAGONIA/ARMREST_DOOR_PANEL"`. Link roto.

### 3.3 Top Roll Patagonia | Mayormente limpio

| OP | PFD | AMFE / CP / HO | Estado |
|----|-----|----------------|--------|
| 5 | RECEPCION DE MATERIALES: TABLA DE MATERIALES | RECEPCION DE MATERIA PRIMA | DIVERGE |
| 10-70 | (todos) | (todos) | OK — nombres coinciden |
| — | INSPECCION FINAL (sin numero) | OP 80: CONTROL FINAL DE CALIDAD | DIVERGE (nombre y numero) |
| 90 | EMBALAJE | EMBALAJE | OK |

**Divergencias:** Recepcion (nombre distinto), Inspeccion Final (nombre y sin numero asignado en PFD vs OP 80 en AMFE).
**Extra en PFD:** "CONTROL DE LAS CANTIDADES DE DESPACHO" — no tiene equivalente en AMFE/CP/HO.

### 3.4 Headrest Front | GRAVE — numeracion completamente desalineada

El PFD y el AMFE describen el mismo proceso pero con numeracion de operaciones totalmente distinta:

| PFD OP | PFD Nombre | AMFE OP | AMFE Nombre | Estado |
|--------|-----------|---------|-------------|--------|
| 10 | RECEPCION DE MATERIA PRIMA | 10 | RECEPCION DE MATERIA PRIMA | OK |
| 20 | CORTE DE COMPONENTES | 20 | CORTE DEL VINILO / TELA (FUNDA) | DIVERGE nombre |
| 30 | PREPARACION DE KITS DE COMPONENTES DE COSTURA | — | (no existe en AMFE) | FALTA en AMFE |
| 40 | COSTURA UNION | 30 | COSTURA UNION ENTRE PANELES | DIVERGE nro y nombre |
| 50 | COSTURA VISTA (condicional) | 35 | COSTURA VISTA (condicional) | DIVERGE nro |
| 60 | ENSAMBLE ASTA - FUNDA | 50 | ENSAMBLE DE VARILLA + EPP | DIVERGE nro y nombre |
| 70 | INYECCION PUR | 60 | INYECCION PUR - APOYACABEZAS | DIVERGE nro y nombre |
| 80 | CURADO Y ESTABILIZACION DE ESPUMA | — | (no existe en AMFE) | FALTA en AMFE |
| 90 | CONTROL FINAL DE CALIDAD Y PRUEBAS FUNCIONALES | 70 | CONTROL FINAL DE CALIDAD | DIVERGE nro y nombre |
| 120 | EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO | 80 | EMBALAJE | DIVERGE nro y nombre |
| — | — | 90 | TEST DE LAY OUT | FALTA en PFD |

**Operaciones sin correspondencia:**
- PFD OP 30 (PREPARACION DE KITS) y PFD OP 80 (CURADO) no existen en AMFE
- AMFE OP 90 (TEST DE LAY OUT) no existe en PFD

### 3.5 Headrest Rear Center | GRAVE — mismos problemas que Front + peor

Misma tabla que 3.4 con un agravante: el AMFE de Rear Center NO tiene "ENSAMBLE DE VARILLA" (los traseros no tienen asta), pero el PFD SI incluye "ENSAMBLE ASTA - FUNDA" (OP 60). El PFD es una copia exacta del Front sin adaptaciones.

Diferencias adicionales vs Front:
- AMFE OP 50 = INYECCION PUR (no 60 como en Front)
- AMFE OP 60 = CONTROL FINAL (no 70 como en Front)
- AMFE OP 70 = EMBALAJE (no 80 como en Front)

### 3.6 Headrest Rear Outer | GRAVE

Identico al Rear Center (3.5). Mismo PFD copiado del Front sin adaptar.

### 3.7 Telas Planas PWA | Medio — ops asimetricas

| OP | PFD | AMFE / CP / HO | Estado |
|----|-----|----------------|--------|
| 10 | RECEPCION DE MATERIA PRIMA | RECEPCION DE MATERIA PRIMA | OK |
| 15 | PREPARACION DE CORTE | — | FALTA en AMFE/CP/HO |
| 20 | CORTE DE COMPONENTES | CORTE DE COMPONENTES | OK |
| 25 | CONTROL CON MYLAR | — | FALTA en AMFE/CP/HO |
| 30-80 | (todos) | (todos) | OK |
| — | — | 10b: RECEPCION DE PUNZONADO CON BI-COMPONENTE | FALTA en PFD |
| — | — | 10d: COLOCADO DE APLIX | FALTA en PFD |
| — | — | 20b: HORNO | FALTA en PFD |
| — | — | 21: CORTE POR MAQUINA, BLANK DE PIEZAS LATERALES | FALTA en PFD |

4 operaciones del AMFE no estan en el PFD. 2 operaciones del PFD no estan en el AMFE.

### 3.8 Telas Termoformadas PWA | Medio — ops asimetricas

| OP | PFD | AMFE / CP / HO | Estado |
|----|-----|----------------|--------|
| 10-70 | (todos) | (todos) | OK |
| 25 | CONTROL CON MYLAR | — | FALTA en AMFE/CP/HO |
| 80 | COSTURA DE REFUERZOS | — | FALTA en AMFE/CP/HO |
| 90 | APLICACION DE APLIX | — | FALTA en AMFE/CP/HO |
| 100 | CONTROL FINAL DE CALIDAD | OP 80: CONTROL FINAL DE CALIDAD | DIVERGE numero |

3 operaciones del PFD no estan en el AMFE. Control Final tiene numero distinto (PFD=100, AMFE=80).

---

## 4. Clasificacion de Productos Segregados (NG Paths)

### 4.1 Resumen por PFD

| PFD | Decisiones con NG | Scrap | Rework | Sort | Segregacion |
|-----|--------------------|-------|--------|------|-------------|
| Insert | 4 | 3 decisions + 1 op | 2 ops | 0 | 1 op |
| Armrest | 4 | 3 decisions + 1 op | 1 op | 0 | 1 op |
| Top Roll | 8 | 8 decisions (todas) | 0 | 0 | 0 |
| HR Front | 2 | 1 insp + 1 op | 3 ops | 1 insp | 0 |
| HR Rear Cen | 2 | 1 insp + 1 op | 3 ops | 1 insp | 0 |
| HR Rear Out | 2 | 1 insp + 1 op | 3 ops | 1 insp | 0 |
| Telas Planas | 3 | 1 insp + 1 op | 1 op | 1 insp | 0 |
| Telas Termo | 3 | 1 insp + 1 op | 3 ops | 1 insp | 0 |

### 4.2 Inconsistencias | MEDIO

1. **Top Roll: TODAS las decisiones son scrap, no hay rework ni sort.** Los otros productos tienen mix de scrap/rework/sort. Es improbable que el Top Roll no tenga ningun reproceso posible — probablemente falta definir NG paths detallados.

2. **Headrests: la Inspeccion de MP tiene disposicion `scrap` directamente** (sin paso de decision intermedio). Los otros productos usan una decision "MATERIAL CONFORME?" antes del scrap.

3. **Insert/Armrest tienen paso explicito "CLASIFICACION Y SEGREGACION DE PRODUCTO NO CONFORME"** pero los headrests y telas ponen la segregacion directamente en una operacion sin ese paso intermedio.

---

## 5. Almacenamiento WIP

### 5.1 Presencia de pasos de almacenamiento WIP

| PFD | Storage WIP | Detalle |
|-----|-------------|---------|
| Insert | 7 pasos | OP 30, 51, 61, 71, 81, 92 + PT final |
| Armrest | 6 pasos | OP 30, 52, 61, 71, 82 + PT final |
| Top Roll | 0 pasos WIP | Solo almacen recepcion y PT final |
| HR Front | 0 pasos WIP | Solo almacen recepcion y PT final |
| HR Rear Cen | 0 pasos WIP | Solo almacen recepcion y PT final |
| HR Rear Out | 0 pasos WIP | Solo almacen recepcion y PT final |
| Telas Planas | 0 pasos WIP | Solo almacen MP y PT final |
| Telas Termo | 0 pasos WIP | Solo almacen MP y PT final |

### 5.2 Inconsistencias | MEDIO

**Insert y Armrest tienen WIP detallado entre cada sector; los otros 6 productos no tienen ningun WIP intermedio.** Esto puede ser intencional (procesos mas cortos no necesitan WIP formal) o puede ser una omision. Nota: la regla de CLAUDE.md dice "Almacenamiento WIP NO es operacion de proceso" — por lo tanto incluirlo como operacion numerada (OP 30, 51, etc.) en el AMFE podria ser debatible.

---

## 6. Verificacion de Exports SVG/PDF

### 6.1 Footer "Software" | MEDIO

**Todos los exports** contienen en el footer: `"Generado por Barack Mercosul Software"`.

Esto expone el nombre del software en un documento que se entrega al cliente (VW/Toyota). Deberia decir algo como "Generado por Barack Mercosul" sin la palabra "Software", o bien no tener esta linea.

### 6.2 Equipo truncado a 60 caracteres | MEDIO

El header del SVG/PDF trunca el campo "Equipo" a 60 caracteres. El texto real es de 139 caracteres:

> Carlos Baptista (Ingenieria), Manuel Meszaros (Calidad), Facundo Santoro, Marianna Vera (Produccion), Cristina Rabago (Seguridad e Higiene)

Se ve como:

> Carlos Baptista (Ingenieria), Manuel Meszaros (Calidad), Fa...

**Se pierden 3 de 5 miembros del equipo** (Facundo Santoro, Marianna Vera, Cristina Rabago).

### 6.3 Part numbers | MEDIO

| PFD | Part Number en header | Problema |
|-----|-----------------------|----------|
| Insert | TBD-INS-PAT | Placeholder, no es part number real (N 227 a N 403) |
| Armrest | ARMREST DOOR PANEL | Es el nombre del producto, no el part number (N 231) |
| Top Roll | N 216 / N 256 / N 285 / N 315 | Correcto (4 variantes) — pero es largo |
| HR Front | 2HC.881.901 | OK (con puntos) |
| HR Rear Cen | 2HC.885.900 | OK (con puntos) |
| HR Rear Out | 2HC.885.901 | OK (con puntos) |
| Telas Planas | 21-8909 | Incorrecto — la familia dice 21-9463 |
| Telas Termo | Segun tabla | No es un part number real |

**5 de 8 PFDs tienen part numbers incorrectos o placeholder.**

### 6.4 Nombre de empresa inconsistente | MENOR

| PFD | companyName |
|-----|-------------|
| Insert, Top Roll | Barack Mercosul (minusculas) |
| Armrest, HR Front/Cen/Out, Telas Planas/Termo | BARACK MERCOSUL (mayusculas) |

### 6.5 Nombre de cliente inconsistente | MENOR

| PFD | customerName | Esperado |
|-----|-------------|----------|
| Insert | VWA | VWA |
| Armrest, HR Front/Cen/Out | VW | VWA |
| Top Roll | VW Argentina | VWA |
| Telas Planas, Telas Termo | PWA | PWA |

**3 variantes distintas para el mismo cliente VW:** "VWA", "VW", "VW Argentina".

### 6.6 "$1" en texto de decision — Headrests | GRAVE

Los 3 PFDs de headrests contienen el texto `"PRODUCTO CONFORME$1"` en el paso de decision posterior al Control Final. El `$1` es un artefacto de regex (reemplazo mal hecho con `$1` backreference). **Este texto se renderiza en el export SVG/PDF visible al cliente.**

### 6.7 linkedAmfeProject roto | GRAVE

| PFD | linkedAmfeProject | AMFE project_name real | Match? |
|-----|-------------------|----------------------|--------|
| Insert | VWA/PATAGONIA/INSERTO | VWA/PATAGONIA/INSERT | NO |
| Armrest | VWA/PATAGONIA/ARMREST | VWA/PATAGONIA/ARMREST_DOOR_PANEL | NO |
| Top Roll | VWA/PATAGONIA/TOP_ROLL | VWA/PATAGONIA/TOP_ROLL | OK |
| HR Front | VWA/PATAGONIA/HEADREST_FRONT | VWA/PATAGONIA/HEADREST_FRONT | OK |
| HR Rear Cen | VWA/PATAGONIA/HEADREST_REAR_CEN | VWA/PATAGONIA/HEADREST_REAR_CEN | OK |
| HR Rear Out | VWA/PATAGONIA/HEADREST_REAR_OUT | VWA/PATAGONIA/HEADREST_REAR_OUT | OK |
| Telas Planas | PWA/TELAS_PLANAS | PWA/TELAS_PLANAS | OK |
| Telas Termo | PWA/TELAS_TERMOFORMADAS | PWA/TELAS_TERMOFORMADAS | OK |

**2 de 8** PFDs tienen el campo `linkedAmfeProject` apuntando a un nombre inexistente. Esto rompe la correlacion automatica PFD→AMFE.

---

## 7. Hallazgos Consolidados

### GRAVE (5)

| # | Hallazgo | Productos | Impacto |
|---|---------|-----------|---------|
| G1 | 0% de pasos PFD tienen linkedAmfeOperationId — sin trazabilidad PFD→AMFE | Todos (8) | Validacion cruzada no funciona |
| G2 | Texto "$1" (artefacto regex) en paso de decision de headrests | HR Front, HR Rear Cen, HR Rear Out | Visible en export al cliente |
| G3 | Numeracion de operaciones PFD completamente desalineada con AMFE (10+ divergencias por producto) | HR Front, HR Rear Cen, HR Rear Out | Documentos no correlacionan |
| G4 | linkedAmfeProject roto (nombre inexistente) | Insert, Armrest | Correlacion automatica rota |
| G5 | Nombres de operaciones Insert masivamente divergentes entre PFD y AMFE/CP/HO (formato simple vs "SECCION - OPERACION") | Insert | 12 de 15 ops divergen |

### MEDIO (10)

| # | Hallazgo | Productos |
|---|---------|-----------|
| M1 | 5 de 8 PFDs con part numbers falsos/placeholder | Insert, Armrest, Telas Planas, Telas Termo, Top Roll (parcial) |
| M2 | Footer "Generado por Barack Mercosul Software" expone nombre de software | Todos (8) |
| M3 | Equipo truncado a 60 chars — se pierden 3 de 5 miembros | Todos (8) |
| M4 | Recepcion clasificada como `operation` en vez de `storage` | Telas Planas, Telas Termo |
| M5 | 0 pasos de transporte en 5 PFDs (headrests no cuentan — proceso mas corto) | Telas Planas, Telas Termo |
| M6 | 0 pasos WIP en 6 de 8 PFDs | Top Roll, HR Front/Cen/Out, Telas Planas/Termo |
| M7 | 4 operaciones AMFE (10b, 10d, 20b, 21) no representadas en PFD | Telas Planas |
| M8 | 3 operaciones PFD (25, 80, 90) no representadas en AMFE | Telas Termoformadas |
| M9 | Top Roll: todas las decisiones NG son scrap sin rework — probablemente incompleto | Top Roll |
| M10 | PFD identico copiado para 3 headrests distintos — Rear Center/Outer incluyen "ENSAMBLE ASTA-FUNDA" que no aplica a traseros | HR Rear Cen, HR Rear Out |

### MENOR (8)

| # | Hallazgo | Productos |
|---|---------|-----------|
| m1 | Empresa: "Barack Mercosul" vs "BARACK MERCOSUL" (mayusculas inconsistentes) | Insert/Top Roll vs resto |
| m2 | Cliente: "VWA" vs "VW" vs "VW Argentina" (3 variantes) | Todos VWA |
| m3 | Top Roll: recepcion "RECEPCION DE MATERIALES: TABLA DE MATERIALES" vs estandar | Top Roll |
| m4 | Top Roll: "INSPECCION FINAL" vs estandar "CONTROL FINAL DE CALIDAD" | Top Roll |
| m5 | Top Roll: decisiones "ESTA OK LA PIEZA?" vs "PRODUCTO CONFORME?" | Top Roll |
| m6 | Insert: "CORTAR COMPONENTES" vs "CORTE DE COMPONENTES" (verbo vs sustantivo) | Insert |
| m7 | Embalaje: "EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO" vs "EMBALAJE" | Insert/Armrest/HRs/Telas vs Top Roll |
| m8 | Top Roll: contiene terminos en ingles (EDGE FOLDING, TRIMMING) — consistente en 4 docs pero no en espanol | Top Roll |

---

## 8. Prioridades de Correccion Sugeridas

1. **G2 — "$1" en headrests**: Fix inmediato — es un bug visible en documentos que van al cliente
2. **G3/G4/G5 — Alineacion PFD↔AMFE**: Requiere decision del equipo — elegir si los nombres se alinean al formato PFD (simple) o al formato AMFE (con seccion)
3. **M1 — Part numbers**: Completar con part numbers reales antes de entrega a cliente
4. **M3 — Equipo truncado**: Aumentar limite de truncado de 60 a 140+ caracteres, o usar tooltip/wrapping
5. **M2 — Footer "Software"**: Decidir si se quita la palabra "Software" o se elimina la linea completa
6. **G1 — linkedAmfeOperationId**: Vincular cada paso PFD con su operacion AMFE correspondiente (si la app lo soporta)
