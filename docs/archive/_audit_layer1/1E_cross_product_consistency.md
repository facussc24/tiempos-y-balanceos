# 1E - Auditoria de Consistencia Cross-Product

**Fecha**: 2026-03-23
**Alcance**: 8 familias de producto, 18 AMFEs, 18 CPs, 17 HOs
**Objetivo**: Detectar inconsistencias de redaccion entre productos para operaciones equivalentes

---

## 1. Mapa de Operaciones Comunes (AMFE)

### 1.1 Recepcion de Materia Prima

| Producto | Op# | Nombre en AMFE | Estilo |
|----------|-----|----------------|--------|
| Insert | 10 | RECEPCIONAR MATERIA PRIMA | MAYUSCULAS |
| Armrest | 10 | RECEPCIONAR MATERIA PRIMA | MAYUSCULAS |
| Top Roll | 5 | RECEPCIONAR MATERIA PRIMA | MAYUSCULAS |
| Headrest Front | 10 | RECEPCIONAR MATERIA PRIMA | MAYUSCULAS |
| Headrest Rear Cen | 10 | RECEPCIONAR MATERIA PRIMA | MAYUSCULAS |
| Headrest Rear Out | 10 | RECEPCIONAR MATERIA PRIMA | MAYUSCULAS |
| Telas Planas | 10 | Recepcion de Punzonado | Mixed case |
| Telas Termoformadas | 10 | Recepcion de materiales con identificacion correcta | Mixed case |

**Hallazgo REC-1**: Los 6 productos VWA usan "RECEPCIONAR MATERIA PRIMA" en mayusculas. Los 2 productos PWA usan nombres descriptivos en mixed case que ademas difieren entre si. Telas Planas dice "Recepcion de Punzonado" (nombre del material) y Telas Termoformadas dice "Recepcion de materiales con identificacion correcta" (describe el resultado esperado, no la operacion).

**Hallazgo REC-2**: Top Roll usa Op 5 para recepcion, todos los demas usan Op 10. No es un error (el proceso de Top Roll es diferente) pero rompe el patron numerico.

### 1.2 Corte

| Producto | Op# | Nombre en AMFE |
|----------|-----|----------------|
| Insert | 15/20/25 | CORTE DE COMPONENTES DE VINILO O TELA - Preparacion/Cortar/Control |
| Armrest | 15/20/25 | CORTE DE COMPONENTES - PREPARACION DE CORTE / DE VINILO O TELA / CONTROL CON MYLAR |
| Headrest Front | 20 | CORTE DEL VINILO / TELA (FUNDA) |
| Headrest Rear Cen | 20 | CORTE DEL VINILO / TELA (FUNDA) |
| Headrest Rear Out | 20 | CORTE DEL VINILO / TELA (FUNDA) |
| Telas Planas | 20/21 | Corte por maquina de pieza Central / Blank de piezas laterales |
| Telas Termoformadas | 20 | Corte por maquina automatica segun dimensional |

**Hallazgo COR-1**: Insert y Armrest desglosan el corte en sub-operaciones (15/20/25/30) pero con nombres levemente diferentes:
- Insert Op 15: "CORTE DE COMPONENTES DE VINILO O TELA - Preparacion de corte" (mixed case en subtitulo)
- Armrest Op 15: "CORTE DE COMPONENTES - PREPARACION DE CORTE" (todo mayusculas, omite "DE VINILO O TELA")
- Insert Op 25: "CORTE DE COMPONENTES DE VINILO O TELA - Control con mylar" (mixed)
- Armrest Op 25: "CORTE DE COMPONENTES - CONTROL CON MYLAR" (mayusculas, omite material)

**Hallazgo COR-2**: Headrests usan un nombre generico "CORTE DEL VINILO / TELA (FUNDA)" sin sub-operaciones. Telas Planas usa nombres especificos con part numbers.

### 1.3 Costura

| Producto | Op# | Nombre en AMFE |
|----------|-----|----------------|
| Insert | 40/50 | Costura - Refilado / Costura - Costura CNC |
| Armrest | 40/50/51 | COSTURA - REFILADO / COSTURA UNION / COSTURA DOBLE |
| Headrest Front | 30/40 | COSTURA UNION ENTRE PANELES / COSTURA VISTA |
| Headrest Rear Cen | 30/40 | COSTURA UNION ENTRE PANELES / COSTURA VISTA |
| Headrest Rear Out | 30/40 | COSTURA UNION ENTRE PANELES / COSTURA VISTA |
| Telas Termoformadas | 30 | Costura fuerte, sin arruga ni pliegues |

**Hallazgo COS-1**: Insert usa "Costura - Refilado" en mixed case mientras Armrest usa "COSTURA - REFILADO" todo en mayusculas para la misma operacion.

**Hallazgo COS-2**: Insert dice "Costura CNC" (describe la maquina) mientras Armrest dice "COSTURA UNION" y "COSTURA DOBLE" (describe el tipo de costura). Son procesos fisicamente diferentes pero el nivel de detalle descriptivo es inconsistente.

**Hallazgo COS-3**: Telas Termoformadas usa un estilo completamente diferente: "Costura fuerte, sin arruga ni pliegues" - esto describe el resultado esperado, no la operacion. Ninguno de los otros productos usa este patron.

### 1.4 Inspeccion Final

| Producto | Op# | Nombre en AMFE |
|----------|-----|----------------|
| Insert | 110 | Inspeccion Final - CONTROL FINAL DE CALIDAD |
| Armrest | 100 | INSPECCION FINAL - CONTROL FINAL DE CALIDAD |
| Top Roll | 80 | INSPECCION FINAL Y EMPAQUE |
| Headrest Front | 70 | INSPECCION FINAL - APOYACABEZAS INYECTADO |
| Headrest Rear Cen | 60 | INSPECCION FINAL - APOYACABEZAS INYECTADO |
| Headrest Rear Out | 60 | INSPECCION FINAL - APOYACABEZAS INYECTADO |
| Telas Planas | 70 | Control de pieza final |
| Telas Termoformadas | 60 | Inspeccion final de la pieza |

**Hallazgo INS-1**: Cinco estilos diferentes para la misma operacion conceptual:
1. "INSPECCION FINAL - CONTROL FINAL DE CALIDAD" (Insert/Armrest)
2. "INSPECCION FINAL Y EMPAQUE" (Top Roll - combina dos operaciones en una)
3. "INSPECCION FINAL - APOYACABEZAS INYECTADO" (Headrests - agrega nombre producto)
4. "Control de pieza final" (Telas Planas - mixed case, distinto vocabulario)
5. "Inspeccion final de la pieza" (Telas Termoformadas - mixed case, distinto patron)

**Hallazgo INS-2**: Insert usa "Inspeccion Final" en mixed case antes del guion, Armrest usa "INSPECCION FINAL" en mayusculas. Misma operacion, distinto case.

### 1.5 Embalaje

| Producto | Op# | Nombre en AMFE |
|----------|-----|----------------|
| Insert | 120 | Embalaje - EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO |
| Armrest | 110 | EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO |
| Top Roll | 90 | EMPAQUE FINAL Y ETIQUETADO DE PRODUCTO TERMINADO |
| Headrest Front | 80 | EMBALAJE |
| Headrest Rear Cen | 70 | EMBALAJE |
| Headrest Rear Out | 70 | EMBALAJE |
| Telas Planas | 80 | Embalaje |
| Telas Termoformadas | 70 | Embalaje identificado con cantidad de piezas especificas |

**Hallazgo EMB-1**: Cuatro estilos:
1. "EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO" (Insert/Armrest - completo)
2. "EMPAQUE FINAL Y ETIQUETADO DE PRODUCTO TERMINADO" (Top Roll - usa "EMPAQUE" en vez de "EMBALAJE")
3. "EMBALAJE" (Headrests/Telas Planas - minimo)
4. "Embalaje identificado con cantidad de piezas especificas" (Telas Termoformadas - describe resultado)

**Hallazgo EMB-2**: Insert usa prefijo redundante "Embalaje - " antes de "EMBALAJE Y ETIQUETADO..." lo cual es una tautologia.

**Hallazgo EMB-3**: Top Roll dice "EMPAQUE" donde todos los demas dicen "EMBALAJE". Vocabulario inconsistente para la misma accion.

### 1.6 Adhesivado

| Producto | Op# | Nombre en AMFE |
|----------|-----|----------------|
| Insert | 90/91/92 | ADHESIVADO - ADHESIVAR PIEZAS / INSPECCIONAR / ALMACENAMIENTO WIP |
| Armrest | 80/81/82 | ADHESIVADO - ADHESIVAR PIEZAS / INSPECCIONAR / ALMACENAMIENTO WIP |
| Top Roll | 20 | ADHESIVADO HOT MELT |

**Hallazgo ADH-1**: Insert y Armrest tienen la misma estructura de 3 sub-operaciones con nombres identicos (salvo case mixing en Insert). Top Roll lo simplifica en una sola operacion "ADHESIVADO HOT MELT" que especifica el tipo de adhesivo.

### 1.7 Almacenamiento WIP

| Producto | Cantidad de ops WIP |
|----------|---------------------|
| Insert | 6 ops (30, 61, 71, 81, 92, mas en costura) |
| Armrest | 6 ops (30, 52, 61, 72, 82) |
| Top Roll | 1 op (11) |
| Headrests | 0 ops |
| Telas Planas | 0 ops |
| Telas Termoformadas | 0 ops |

**Hallazgo WIP-1**: Solo Insert, Armrest y Top Roll incluyen operaciones de almacenamiento WIP. Los headrests y telas no las tienen. Esto puede ser correcto por diferencias de proceso, pero si el WIP existe fisicamente en headrests, falta documentarlo.

---

## 2. Inconsistencias de Estilo General

### 2.1 Case (Mayusculas vs Mixed)

| Producto | Estilo predominante | Ops en mixed case |
|----------|---------------------|-------------------|
| Insert | MIXTO | 10 de 22 ops usan mixed case (Costura, Tapizado, Inspeccion Final, Embalaje) |
| Armrest | TODO MAYUSCULAS | 0 de 22 |
| Top Roll | TODO MAYUSCULAS | 0 de 11 |
| Headrest Front | TODO MAYUSCULAS | 0 de 8 |
| Headrest Rear Cen | TODO MAYUSCULAS | 0 de 7 |
| Headrest Rear Out | TODO MAYUSCULAS | 0 de 7 |
| Telas Planas | TODO MIXED | 12 de 12 |
| Telas Termoformadas | TODO MIXED | 8 de 8 |

**Hallazgo EST-1 (CRITICO)**: Insert mezcla mayusculas y mixed case dentro del mismo documento. Ejemplo:
- Op 10: "RECEPCIONAR MATERIA PRIMA" (mayusculas)
- Op 40: "Costura - Refilado" (mixed)
- Op 110: "Inspeccion Final - CONTROL FINAL DE CALIDAD" (mixed + mayusculas en subtitulo)

Esto sugiere que fue editado por diferentes personas o en diferentes momentos sin uniformizar.

**Hallazgo EST-2**: PWA (Telas) usa mixed case consistentemente, VWA (Patagonia) usa mayusculas consistentemente EXCEPTO Insert que es hibrido.

### 2.2 Patron de nombres: "Operacion genial - Detalle especifico"

| Producto | Usa patron "CATEGORIA - DETALLE" | Ejemplo |
|----------|----------------------------------|---------|
| Insert | Si, parcialmente | "ADHESIVADO - ADHESIVAR PIEZAS" |
| Armrest | Si, siempre | "COSTURA - COSTURA UNION" |
| Top Roll | No | "ADHESIVADO HOT MELT" (sin guion) |
| Headrests | No | "COSTURA UNION ENTRE PANELES" (sin guion) |
| Telas Planas | No | "Corte por maquina de pieza Central" (descriptivo) |
| Telas Termoformadas | No | "Costura fuerte, sin arruga ni pliegues" (resultado) |

**Hallazgo EST-3**: Tres patrones de nomenclatura coexisten:
1. **Categoria - Detalle**: Insert y Armrest (ej: "COSTURA - REFILADO")
2. **Nombre plano**: Top Roll y Headrests (ej: "COSTURA UNION ENTRE PANELES")
3. **Descriptivo de resultado**: Telas (ej: "Costura fuerte, sin arruga ni pliegues")

### 2.3 Nombres con Part Numbers

**Hallazgo PN-1**: Telas Planas incluye part numbers en los nombres de operacion:
- "Perforado (21-8875 R y 21-8876 L)"
- "Soldadura (21-8877, 21-8875 y 21-8876)"

Ningun otro producto hace esto. Si cambian los part numbers, hay que actualizar los nombres de operacion.

---

## 3. Inconsistencias en CP Items

### 3.1 Recepcion: Enfoque de los Items

| Producto | # Items CP Recepcion | Enfoque | Sample Size predominante |
|----------|---------------------|---------|--------------------------|
| Telas Planas | 4 | Especificacion material + flamabilidad | 100% |
| Telas Termoformadas | 2 | Control recepcion + material distinto | 100% |
| Armrest | 19 | Causas de falla detalladas (estiba, transporte, trazabilidad) | 3 pzas / 100% mix |
| Insert | 45 | Causas + materiales especificos por nombre | 3 pzas / 100% mix |
| Headrest Front | 15 | Caracteristicas de material (tipo, color, espesor, densidad) | 1 muestra |
| Headrest Rear Cen | 15 | Identico a Front | 1 muestra |
| Headrest Rear Out | 15 | Identico a Front | 1 muestra |
| Top Roll | 24 | Causas de falla + caracteristicas material | 100% / 3 pzas mix |

**Hallazgo CP-REC-1 (CRITICO)**: Los headrests usan "1 muestra" como sample size para recepcion mientras Insert/Armrest/Top Roll usan "100%" o "3 piezas". Para la misma planta y el mismo tipo de material (vinilo PVC), el criterio de muestreo deberia ser equivalente.

**Hallazgo CP-REC-2**: Los headrests enfocan sus items CP en caracteristicas del material (Tipo, Color, Espesor, Gramaje, Densidad, Flamabilidad) mientras Insert/Armrest enfocan en causas de falla del proceso de recepcion (Mala estiba, Manipulacion incorrecta, Falta trazabilidad). Son dos filosofias de CP completamente diferentes para la misma operacion.

**Hallazgo CP-REC-3**: Insert tiene 45 items de recepcion vs Telas Termoformadas con solo 2. La profundidad del analisis es desproporcionada.

### 3.2 Costura: Items de Control

| Producto | Operacion | # Items | Tipo de items |
|----------|-----------|---------|---------------|
| Armrest | COSTURA UNION | 12 | Causas: tension hilo, puntadas, hilo inadecuado |
| Armrest | COSTURA DOBLE | 21 | Causas: + rotura vinilo, seleccion hilo, largo puntada |
| Insert | Costura CNC | 45 | Causas 4M: Mano obra, Maquina, Material, Metodo |
| Headrest Front | Costura Union | 7 | Apariencia: sin salteada, sin floja, sin arrugas |
| Headrest Rear Cen | Costura Union | 7 | Identico a Front |
| Headrest Rear Out | Costura Union | 7 | Identico a Front |
| Telas Termoformadas | Costura | 4 | Falla operario, carreteles, aguja, tension |

**Hallazgo CP-COS-1**: Insert tiene 45 items de costura CNC con clasificacion 4M explicita (Mano de Obra, Maquina, Material, Metodo). Armrest tiene 12+21 items con causas de falla simples. Headrests tienen solo 7 items con enfoque en apariencia. El nivel de detalle es radicalmente diferente para operaciones analogas.

**Hallazgo CP-COS-2**: Headrests usan "Visual / Muestra patron" como evaluation technique para casi todo, mientras Insert detalla "Verificacion de set-up", "Auditoria de proceso", "Puesta a Punto (Set-up)" etc. Diferente nivel de especificidad.

**Hallazgo CP-COS-3**: Armrest usa "5 piezas / Inicio y fin de turno" para costura. Headrests usan "1 pieza / Inicio y fin de turno / 100% Por lote". Insert usa "100% / Inicio y fin de turno" y "3 piezas / Inicio y fin de turno". Tres criterios de muestreo diferentes.

### 3.3 Embalaje: Items de Control

| Producto | # Items | Enfoque |
|----------|---------|---------|
| Telas Planas | 4 | Error conteo, identificacion, etiqueta |
| Telas Termoformadas | 6 | Error conteo, identificacion, cantidad, falla operario |
| Armrest | 6 | Posicionamiento, cantidad, hilos, deformacion |
| Insert | 8 | Posicionamiento, cantidad, apilado, etiqueta |
| Headrest Front | 2 | Solo: Identificacion y Cantidad |
| Headrest Rear Cen | 2 | Solo: Identificacion y Cantidad |
| Headrest Rear Out | 2 | Solo: Identificacion y Cantidad |
| Top Roll | 14 | Sensor fixture, etiqueta, fatiga visual, separadores, cantidad |

**Hallazgo CP-EMB-1**: Headrests tienen solo 2 items de embalaje (Identificacion + Cantidad) con evaluacion "Visual / 100% / Cada caja". Top Roll tiene 14 items con controles sofisticados (sensor fixture, escaneo validacion). La diferencia es desproporcionada.

**Hallazgo CP-EMB-2**: Telas Planas usa "3 piezas / Cada contenedor", Telas Termoformadas usa "5 piezas / Cada caja". Para productos similares del mismo cliente (PWA), el sample size deberia ser igual.

### 3.4 Naming CP vs AMFE (Headrests)

**Hallazgo CP-NAME-1 (CRITICO)**: En los headrests, la numeracion de AMFE y CP no coincide:

| AMFE Op# | AMFE Nombre | CP Step# | CP Nombre |
|----------|-------------|----------|-----------|
| 10 | RECEPCIONAR MATERIA PRIMA | 10 | Recepcion |
| 20 | CORTE DEL VINILO / TELA (FUNDA) | 20 | Corte de Vinilo SANSUY PVC (TITAN Black) |
| 30 | COSTURA UNION ENTRE PANELES | 30 | Operacion Costura Union |
| 40 | COSTURA VISTA | 40 | Ensamble Asta + Insert + Enfundado |
| 50 | ENSAMBLE DE VARILLA + EPP | 50 | Espumado (llenado de molde con mezcla) |
| 60 | INYECCION PUR - APOYACABEZAS | 60 | Inspeccion final + Sistema ARB |
| 70 | INSPECCION FINAL | 70 | Embalaje |
| 80 | EMBALAJE | 80 | TEST DE LAY OUT |

Desde Op 40 en adelante, los nombres de AMFE y CP difieren completamente. Esto ocurre porque el CP tiene su propia numeracion (que si coincide con HO) pero no esta alineada con AMFE. Ademas, el AMFE tiene "COSTURA VISTA" como Op 40 pero el CP no tiene un step equivalente (en L0; los L1/L2/L3 agregan Step 30.2 "Costura Vista").

---

## 4. Inconsistencias en HO Sheets

### 4.1 Naming HO vs AMFE/CP

**Hallazgo HO-1**: En Insert, la HO usa nombres simplificados respecto al AMFE/CP:

| Op# | AMFE/CP | HO |
|-----|---------|-----|
| 10 | RECEPCIONAR MATERIA PRIMA | RECEPCION DE MATERIA PRIMA |
| 15 | CORTE DE COMPONENTES DE VINILO O TELA - Preparacion de corte | CORTE DE COMPONENTES - Preparacion de corte |
| 30 | ...ALMACENAMIENTO EN MEDIOS WIP | ...Almacenamiento WIP |
| 100 | Tapizado - Tapizado semiautomatico | TAPIZADO SEMIAUTOMATICO |
| 105 | REFILADO POST-TAPIZADO | REFILADO DE PIEZA |
| 110 | Inspeccion Final - CONTROL FINAL DE CALIDAD | INSPECCION DE LA PIEZA TERMINADA |
| 120 | Embalaje - EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO | EMBALAJE |

La HO elimina la parte "DE VINILO O TELA" de los cortes, simplifica "ALMACENAMIENTO EN MEDIOS WIP" a "Almacenamiento WIP", y renombra operaciones (ej: "REFILADO POST-TAPIZADO" vs "REFILADO DE PIEZA"). Son diferencias menores pero acumulativas.

**Hallazgo HO-2**: Armrest tiene consistencia perfecta entre AMFE/CP/HO (los 3 documentos usan nombres identicos para las 22 operaciones). Top Roll tambien tiene consistencia perfecta. Los headrests tienen consistencia CP=HO pero no AMFE=CP (ver hallazgo CP-NAME-1).

### 4.2 Quality Checks en HO

| Producto | Operaciones con QC > 0 | Ejemplo QC counts |
|----------|------------------------|-------------------|
| Armrest | 22 de 22 (100%) | 2-21 QCs por sheet |
| Insert | 22 de 22 (100%) | 1-30 QCs por sheet |
| Top Roll | 0 de 11 (0%) | Todos 0 |
| Headrests (todos) | 2 de 8 (solo Corte y Costura) | 7 y 14 QCs |
| Telas Planas | 0 de 12 (0%) | Todos 0 |
| Telas Termoformadas | 0 de 8 (0%) | Todos 0 |

**Hallazgo HO-QC-1 (CRITICO)**: Top Roll, Telas Planas y Telas Termoformadas tienen CERO quality checks en todas sus hojas de operaciones. Esto puede significar que no se cargaron, o que fueron creadas con un template que no incluye QCs.

**Hallazgo HO-QC-2**: Los headrests solo tienen QCs en Corte (7) y Costura (14), pero no en Recepcion, Ensamble, Espumado, Inspeccion Final ni Embalaje. En contraste, Armrest e Insert tienen QCs en todas las operaciones.

---

## 5. Seccion Especial: Headrests (Front / Rear Center / Rear Outer)

### 5.1 Diferencias Estructurales

| Aspecto | Front | Rear Center | Rear Outer |
|---------|-------|-------------|------------|
| AMFE ops | 8 | 7 | 7 |
| AMFE causes | 60 | 55 | 55 |
| CP items (L0) | 54 | 52 | 54 |
| CP items (L1/L2/L3) | 63 | 61 | 63 |
| HO sheets | 8 | 8 | 8 |
| Op exclusiva | Op 50: ENSAMBLE DE VARILLA + EPP | --- | --- |

**Hallazgo HR-1**: Headrest Front tiene 8 operaciones AMFE (incluye "ENSAMBLE DE VARILLA + EPP" como Op 50) mientras Rear Center y Rear Outer tienen 7 (no tienen ensamble de varilla). Esto es correcto por diferencia de proceso, pero genera un desfase en la numeracion de operaciones AMFE:

| Operacion | Front Op# | Rear Cen Op# | Rear Out Op# |
|-----------|-----------|--------------|--------------|
| Recepcion | 10 | 10 | 10 |
| Corte | 20 | 20 | 20 |
| Costura Union | 30 | 30 | 30 |
| Costura Vista | 40 | 40 | 40 |
| Ensamble Varilla | 50 | (no existe) | (no existe) |
| Inyeccion PUR | 60 | 50 | 50 |
| Inspeccion Final | 70 | 60 | 60 |
| Embalaje | 80 | 70 | 70 |

### 5.2 CP: Front vs Rear Center (Step 40 - Ensamble)

**Hallazgo HR-2**: El nombre del Step 40 difiere entre variantes:
- Front: "Ensamble Asta + **Insert** + Enfundado" (4 items)
- Rear Center: "Ensamble Asta + Enfundado" (2 items - sin Insert)
- Rear Outer: "Ensamble Asta + **Insert** + Enfundado" (4 items)

Rear Center no usa inserto plastico, por eso tiene menos items y distinto nombre. Rear Outer SI usa inserto y coincide con Front. Esto es **correcto y justificado**.

### 5.3 CP L0 vs L1: Costura Vista

**Hallazgo HR-3**: Los L0 de los 3 headrests NO tienen Step "Costura Vista" en el CP. Los L1/L2/L3 SI tienen un Step 30.2 "Operacion Costura Vista" con 9 items (set-up, apariencia, paralelismo, margen, largo puntada, aguja). Esto genera:
- L0: 54/52/54 items
- L1: 63/61/63 items (9 items mas)

Sin embargo, el AMFE de todos los headrests (L0 y variantes) SI tiene "COSTURA VISTA" como Op 40 con 8 modos de falla. Hay una desconexion: el AMFE analiza Costura Vista pero el CP L0 no la controla.

### 5.4 Consistencia entre los 3 Headrests

**Hallazgo HR-4 (POSITIVO)**: Las operaciones comunes entre los 3 headrests (Recepcion, Corte, Costura Union, Costura Vista, Inyeccion PUR, Inspeccion, Embalaje) tienen nombres IDENTICOS en AMFE, items IDENTICOS en CP, y sheets IDENTICAS en HO. La herencia maestro-variante funciona correctamente.

**Hallazgo HR-5**: Los 3 headrests tienen exactamente los mismos failure counts por operacion:
- Recepcion: 4 failures, 12 causes
- Corte: 4 failures, 6 causes
- Costura Union: 7 failures, 12 causes
- Costura Vista: 8 failures, 13 causes

Esto es consistente. La unica diferencia justificada es la presencia/ausencia de la operacion de Ensamble.

---

## 6. Seccion Especial: Telas Planas vs Termoformadas

### 6.1 Operaciones Compartidas

| Tipo Operacion | Telas Planas | Telas Termoformadas | Compartida? |
|----------------|--------------|---------------------|-------------|
| Recepcion | Op 10: Recepcion de Punzonado | Op 10: Recepcion de materiales... | Equivalente, distinto nombre |
| Preparacion corte | (no existe) | Op 15: Preparacion de corte | Solo Termoformadas |
| Corte | Op 20: Corte por maquina de pieza Central | Op 20: Corte por maquina automatica segun dimensional | Equivalente, distinto nombre |
| Costura | (no existe) | Op 30: Costura fuerte, sin arruga ni pliegues | Solo Termoformadas |
| Clips/Aplix | Op 10d: Colocado de Aplix | Op 40: Colocado de clips en posicion correcta | Equivalente, distinto componente |
| Horno | Op 20b: Horno | (no existe) | Solo Planas |
| Termoformado | Op 30: Termoformado | (no existe) | Solo Planas |
| Corte prensa | Op 40: Corte de la pieza en prensa | (no existe) | Solo Planas |
| Perforado | Op 50: Perforado | (no existe) | Solo Planas |
| Soldadura | Op 60: Soldadura | (no existe) | Solo Planas |
| Dots | (no existe) | Op 50: Pegado de dots en posicion correcta | Solo Termoformadas |
| Inspeccion | Op 70: Control de pieza final | Op 60: Inspeccion final de la pieza | Equivalente, distinto nombre |
| Embalaje | Op 80: Embalaje | Op 70: Embalaje identificado con cantidad... | Equivalente, distinto nombre |

### 6.2 Diferencias de Nomenclatura

**Hallazgo TEL-1**: Las 4 operaciones equivalentes usan nombres diferentes:
1. Recepcion: "Recepcion de Punzonado" vs "Recepcion de materiales con identificacion correcta"
2. Corte: "Corte por maquina de pieza Central" vs "Corte por maquina automatica segun dimensional"
3. Inspeccion: "Control de pieza final" vs "Inspeccion final de la pieza"
4. Embalaje: "Embalaje" vs "Embalaje identificado con cantidad de piezas especificas"

**Hallazgo TEL-2**: Telas Planas usa "Control de pieza final" mientras Telas Termoformadas usa "Inspeccion final de la pieza". "Control" vs "Inspeccion" son sinonimos pero deberian uniformizarse.

**Hallazgo TEL-3**: Telas Termoformadas agrega descripciones de resultado esperado en los nombres de operacion (ej: "...sin arruga ni pliegues", "...en posicion correcta", "...con cantidad de piezas especificas"). Telas Planas no lo hace. Son estilos de documentacion diferentes.

### 6.3 Profundidad de Analisis

| Metrica | Telas Planas | Telas Termoformadas |
|---------|--------------|---------------------|
| AMFE ops | 12 | 8 |
| AMFE causes | 38 | 21 |
| CP items | 43 | 22 |
| HO sheets | 12 | 8 |
| HO QCs | 0 | 0 |

**Hallazgo TEL-4**: Telas Planas tiene el doble de profundidad documental que Telas Termoformadas (38 vs 21 causas, 43 vs 22 items CP). Esto puede ser correcto (Planas tiene mas operaciones) pero la ratio causas/operacion es 3.2 para Planas y 2.6 para Termoformadas, sugiriendo un analisis menos exhaustivo en Termoformadas.

---

## 7. Resumen de Hallazgos Priorizados

### Criticos (requieren correccion)

| # | Hallazgo | Productos Afectados | Impacto |
|---|----------|---------------------|---------|
| 1 | EST-1: Insert AMFE mezcla MAYUSCULAS y mixed case inconsistentemente | Insert | Apariencia no profesional |
| 2 | CP-NAME-1: Headrests AMFE ops no coinciden con CP steps (numeracion desfasada desde Op 40) | 3 Headrests | Trazabilidad AMFE-CP rota |
| 3 | HR-3: CP L0 headrests no controla Costura Vista que si esta en AMFE | 3 Headrests L0 | Gap de control |
| 4 | HO-QC-1: Top Roll, Telas Planas y Telas Termoformadas con 0 QCs en HO | 3 productos | HOs incompletas |
| 5 | CP-REC-1: Headrests usan "1 muestra" vs otros "100%/3pzas" para misma recepcion | 3 Headrests | Criterio no armonizado |

### Importantes (mejorar consistencia)

| # | Hallazgo | Productos Afectados | Recomendacion |
|---|----------|---------------------|---------------|
| 6 | EST-2: PWA usa mixed case, VWA usa mayusculas | 8 productos | Definir un estandar unico |
| 7 | EST-3: 3 patrones de nomenclatura coexisten | 8 productos | Elegir uno y aplicar a todos |
| 8 | TEL-1: 4 operaciones equivalentes con nombres diferentes entre Telas | 2 Telas | Uniformizar nombres |
| 9 | INS-1: 5 estilos diferentes para "Inspeccion Final" | 8 productos | Uniformizar |
| 10 | EMB-1/3: "Embalaje" vs "Empaque" entre productos | Top Roll vs resto | Usar un solo termino |
| 11 | CP-COS-3: 3 criterios de muestreo diferentes para costura | Insert/Armrest/Headrests | Armonizar sample sizes |
| 12 | HO-1: Insert HO simplifica nombres vs AMFE/CP | Insert | Alinear nombres exactos |

### Menores (cosmeticos)

| # | Hallazgo | Nota |
|---|----------|------|
| 13 | REC-2: Top Roll usa Op 5 para recepcion, otros usan Op 10 | Correcto por proceso, solo documentar |
| 14 | PN-1: Telas Planas incluye part numbers en nombres de operacion | Evitar para facilitar mantenimiento |
| 15 | EMB-2: Insert usa prefijo redundante "Embalaje - EMBALAJE..." | Cosmetic, eliminar tautologia |
| 16 | COR-1: Insert/Armrest difieren en "DE VINILO O TELA" en nombre de corte | Uniformizar |

---

## 8. Recomendaciones de Estandarizacion

### 8.1 Definir Estandar de Nomenclatura
- **Case**: Elegir entre MAYUSCULAS (VWA) o Mixed case (PWA) y aplicar a TODOS los productos
- **Patron**: Usar "CATEGORIA - Detalle" consistentemente (ej: "COSTURA - Union entre paneles")
- **Vocabulario**: "Embalaje" (no "Empaque"), "Inspeccion" (no "Control"), "Recepcion de materia prima" (generico, no material especifico)
- **Sin resultados esperados en el nombre**: El nombre debe ser la operacion, no el resultado (ej: "Costura" no "Costura fuerte, sin arruga ni pliegues")

### 8.2 Armonizar Muestreo
- Definir sample sizes y frequencies por tipo de operacion, no por producto
- Recepcion: mismo criterio para todos los productos que reciben el mismo tipo de material
- Costura: mismo criterio para todos los productos con operacion de costura manual
- Embalaje: mismo criterio para todos

### 8.3 Alinear AMFE-CP-HO
- Los headrests necesitan revision de numeracion AMFE vs CP para que coincidan
- Las HOs del Insert deben usar los mismos nombres exactos que AMFE/CP
- Verificar que toda operacion en AMFE tenga su step correspondiente en CP (especialmente Costura Vista en headrests L0)

### 8.4 Completar QCs en HO
- Top Roll, Telas Planas y Telas Termoformadas necesitan quality checks en sus hojas de operaciones
- Los headrests necesitan QCs en Recepcion, Ensamble, Espumado, Inspeccion Final y Embalaje
