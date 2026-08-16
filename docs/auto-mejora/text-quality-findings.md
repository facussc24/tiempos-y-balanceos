# Text Quality Audit (L2) — 2026-08-16T14:30:31.342Z

**Resumen global**: 0 CRITICAL, 129 WARNING en 17/17 AMFEs.

**Por tipo**: OP_FUNCTION_SEMANTIC_MISMATCH=12, FN_NO_VERB=100, FN_TOO_SHORT=12, WE_NAME_FOREIGN_TYPE=5

## Top 5 AMFEs con mas issues

- **AMFE-HRC-PAT** (VWA/PATAGONIA/HEADREST_REAR_CEN): 19 issues
- **AMFE-HRO-PAT** (VWA/PATAGONIA/HEADREST_REAR_OUT): 19 issues
- **AMFE-HF-PAT** (VWA/PATAGONIA/HEADREST_FRONT): 18 issues
- **VWA-PAT-IPPADS-001** (VWA/PATAGONIA/IP_PADS): 10 issues
- **AMFE-MAESTRO-INY-001** (MAESTRO/INYECCION_PLASTICA): 10 issues

## Detalle por AMFE

### AMFE-HRC-PAT (VWA/PATAGONIA/HEADREST_REAR_CEN)
0 CRITICAL + 19 WARNING

| Type | OP | Detalle |
|---|---|---|
| WARNING OP_FUNCTION_SEMANTIC_MISMATCH | 10 RECEPCION DE MATERIA PRIMA | OP "RECEPCION DE MATERIA PRIMA" debería contener alguno de [verificar, conformidad, trazabilidad] en su función |
| WARNING FN_NO_VERB | 10 RECEPCION DE MATERIA PRIMA | function.description "Material resiste ciclo termico cabina" no comienza con verbo |
| WARNING FN_NO_VERB | 10 RECEPCION DE MATERIA PRIMA | function.description "Material supera 50 ciclos ambientales sin alteracion" no comienza con verbo |
| WARNING FN_TOO_SHORT | 10 RECEPCION DE MATERIA PRIMA | function.description "Material resiste intemperie" muy corta (< 30 chars) |
| WARNING FN_NO_VERB | 10 RECEPCION DE MATERIA PRIMA | function.description "Material resiste intemperie" no comienza con verbo |
| WARNING FN_NO_VERB | 10 RECEPCION DE MATERIA PRIMA | function.description "Material mantiene color lote a lote" no comienza con verbo |
| WARNING FN_NO_VERB | 10 RECEPCION DE MATERIA PRIMA | function.description "Material mantiene color bajo radiacion solar" no comienza con verbo |
| WARNING FN_NO_VERB | 10 RECEPCION DE MATERIA PRIMA | function.description "Material cumple solidez color escala grises >= 4" no comienza con verbo |
| WARNING FN_NO_VERB | 40 COSTURA VISTA | function.description "Costura Y cubierta simple con largo puntada especificado" no comienza con verbo |
| WARNING FN_NO_VERB | 40 COSTURA VISTA | function.description "Ancho cubierta costura Y dentro de tolerancia" no comienza con verbo |
| WARNING OP_FUNCTION_SEMANTIC_MISMATCH | 50 INYECCION DE PU | OP "INYECCION DE PU" debería contener alguno de [inyectar, conformar] en su función |
| WARNING FN_NO_VERB | 50 INYECCION DE PU | function.description "Dar forma a la pieza durante el espumado y curado" no comienza con verbo |
| WARNING FN_NO_VERB | 100 EMBALAJE Y ETIQUETADO DE PRODU | function.description "Pieza identificada segun VW 10500" no comienza con verbo |
| WARNING FN_NO_VERB | 100 EMBALAJE Y ETIQUETADO DE PRODU | function.description "Pieza identificada con logotipo segun VW 10514-C10" no comienza con verbo |
| WARNING FN_NO_VERB | 100 EMBALAJE Y ETIQUETADO DE PRODU | function.description "Pieza identificada con pais de origen segun VW 10550" no comienza con verbo |
| WARNING FN_NO_VERB | 100 EMBALAJE Y ETIQUETADO DE PRODU | function.description "Pieza identificada con codigo fabricante segun VW 10540" no comienza con verbo |
| WARNING FN_NO_VERB | 100 EMBALAJE Y ETIQUETADO DE PRODU | function.description "Numero de pieza con tipografia DIN 1451-4-3" no comienza con verbo |
| WARNING FN_NO_VERB | 100 EMBALAJE Y ETIQUETADO DE PRODU | function.description "Pieza identificada con fecha segun VW 10560" no comienza con verbo |
| WARNING FN_NO_VERB | 100 EMBALAJE Y ETIQUETADO DE PRODU | function.description "Pieza identificada con material segun VDA 260" no comienza con verbo |

### AMFE-HRO-PAT (VWA/PATAGONIA/HEADREST_REAR_OUT)
0 CRITICAL + 19 WARNING

| Type | OP | Detalle |
|---|---|---|
| WARNING OP_FUNCTION_SEMANTIC_MISMATCH | 10 RECEPCION DE MATERIA PRIMA | OP "RECEPCION DE MATERIA PRIMA" debería contener alguno de [verificar, conformidad, trazabilidad] en su función |
| WARNING FN_NO_VERB | 10 RECEPCION DE MATERIA PRIMA | function.description "Material resiste ciclo termico cabina" no comienza con verbo |
| WARNING FN_NO_VERB | 10 RECEPCION DE MATERIA PRIMA | function.description "Material supera 50 ciclos ambientales sin alteracion" no comienza con verbo |
| WARNING FN_TOO_SHORT | 10 RECEPCION DE MATERIA PRIMA | function.description "Material resiste intemperie" muy corta (< 30 chars) |
| WARNING FN_NO_VERB | 10 RECEPCION DE MATERIA PRIMA | function.description "Material resiste intemperie" no comienza con verbo |
| WARNING FN_NO_VERB | 10 RECEPCION DE MATERIA PRIMA | function.description "Material mantiene color lote a lote" no comienza con verbo |
| WARNING FN_NO_VERB | 10 RECEPCION DE MATERIA PRIMA | function.description "Material mantiene color bajo radiacion solar" no comienza con verbo |
| WARNING FN_NO_VERB | 10 RECEPCION DE MATERIA PRIMA | function.description "Material cumple solidez color escala grises >= 4" no comienza con verbo |
| WARNING FN_NO_VERB | 40 COSTURA VISTA | function.description "Costura Y cubierta simple con largo puntada especificado" no comienza con verbo |
| WARNING FN_NO_VERB | 40 COSTURA VISTA | function.description "Ancho cubierta costura Y dentro de tolerancia" no comienza con verbo |
| WARNING OP_FUNCTION_SEMANTIC_MISMATCH | 50 INYECCION DE PU | OP "INYECCION DE PU" debería contener alguno de [inyectar, conformar] en su función |
| WARNING FN_NO_VERB | 50 INYECCION DE PU | function.description "Dar forma a la pieza durante el espumado y curado" no comienza con verbo |
| WARNING FN_NO_VERB | 100 EMBALAJE Y ETIQUETADO DE PRODU | function.description "Pieza identificada segun VW 10500" no comienza con verbo |
| WARNING FN_NO_VERB | 100 EMBALAJE Y ETIQUETADO DE PRODU | function.description "Pieza identificada con logotipo segun VW 10514-C10" no comienza con verbo |
| WARNING FN_NO_VERB | 100 EMBALAJE Y ETIQUETADO DE PRODU | function.description "Pieza identificada con pais de origen segun VW 10550" no comienza con verbo |
| WARNING FN_NO_VERB | 100 EMBALAJE Y ETIQUETADO DE PRODU | function.description "Pieza identificada con codigo fabricante segun VW 10540" no comienza con verbo |
| WARNING FN_NO_VERB | 100 EMBALAJE Y ETIQUETADO DE PRODU | function.description "Numero de pieza con tipografia DIN 1451-4-3" no comienza con verbo |
| WARNING FN_NO_VERB | 100 EMBALAJE Y ETIQUETADO DE PRODU | function.description "Pieza identificada con fecha segun VW 10560" no comienza con verbo |
| WARNING FN_NO_VERB | 100 EMBALAJE Y ETIQUETADO DE PRODU | function.description "Pieza identificada con material segun VDA 260" no comienza con verbo |

### AMFE-HF-PAT (VWA/PATAGONIA/HEADREST_FRONT)
0 CRITICAL + 18 WARNING

| Type | OP | Detalle |
|---|---|---|
| WARNING FN_NO_VERB | 10 RECEPCION DE MATERIA PRIMA | function.description "Material resiste ciclo termico cabina" no comienza con verbo |
| WARNING FN_NO_VERB | 10 RECEPCION DE MATERIA PRIMA | function.description "Material supera 50 ciclos ambientales sin alteracion" no comienza con verbo |
| WARNING FN_TOO_SHORT | 10 RECEPCION DE MATERIA PRIMA | function.description "Material resiste intemperie" muy corta (< 30 chars) |
| WARNING FN_NO_VERB | 10 RECEPCION DE MATERIA PRIMA | function.description "Material resiste intemperie" no comienza con verbo |
| WARNING FN_NO_VERB | 10 RECEPCION DE MATERIA PRIMA | function.description "Material mantiene color lote a lote" no comienza con verbo |
| WARNING FN_NO_VERB | 10 RECEPCION DE MATERIA PRIMA | function.description "Material mantiene color bajo radiacion solar" no comienza con verbo |
| WARNING FN_NO_VERB | 10 RECEPCION DE MATERIA PRIMA | function.description "Material cumple solidez color escala grises >= 4" no comienza con verbo |
| WARNING FN_NO_VERB | 40 COSTURA VISTA | function.description "Costura Y cubierta simple con largo puntada especificado" no comienza con verbo |
| WARNING FN_NO_VERB | 40 COSTURA VISTA | function.description "Ancho cubierta costura Y dentro de tolerancia" no comienza con verbo |
| WARNING OP_FUNCTION_SEMANTIC_MISMATCH | 63 INYECCION DE PU | OP "INYECCION DE PU" debería contener alguno de [inyectar, conformar] en su función |
| WARNING FN_NO_VERB | 63 INYECCION DE PU | function.description "Dar forma a la pieza durante el espumado y curado" no comienza con verbo |
| WARNING FN_NO_VERB | 90 EMBALAJE Y ETIQUETADO DE PRODU | function.description "Pieza identificada segun VW 10500" no comienza con verbo |
| WARNING FN_NO_VERB | 90 EMBALAJE Y ETIQUETADO DE PRODU | function.description "Pieza identificada con logotipo segun VW 10514-C10" no comienza con verbo |
| WARNING FN_NO_VERB | 90 EMBALAJE Y ETIQUETADO DE PRODU | function.description "Pieza identificada con pais de origen segun VW 10550" no comienza con verbo |
| WARNING FN_NO_VERB | 90 EMBALAJE Y ETIQUETADO DE PRODU | function.description "Pieza identificada con codigo fabricante segun VW 10540" no comienza con verbo |
| WARNING FN_NO_VERB | 90 EMBALAJE Y ETIQUETADO DE PRODU | function.description "Numero de pieza con tipografia DIN 1451-4-3" no comienza con verbo |
| WARNING FN_NO_VERB | 90 EMBALAJE Y ETIQUETADO DE PRODU | function.description "Pieza identificada con fecha segun VW 10560" no comienza con verbo |
| WARNING FN_NO_VERB | 90 EMBALAJE Y ETIQUETADO DE PRODU | function.description "Pieza identificada con material segun VDA 260" no comienza con verbo |

### VWA-PAT-IPPADS-001 (VWA/PATAGONIA/IP_PADS)
0 CRITICAL + 10 WARNING

| Type | OP | Detalle |
|---|---|---|
| WARNING FN_NO_VERB | 20 INYECCION DE SUSTRATOS Y CONTR | function.description "Parámetros validados por producto" no comienza con verbo |
| WARNING FN_NO_VERB | 20 INYECCION DE SUSTRATOS Y CONTR | function.description "Aire comprimido filtrado y seco" no comienza con verbo |
| WARNING WE_NAME_FOREIGN_TYPE | 30 CORTE (CARGA, AJUSTE Y CORTE A | WE.name "Cuchilla de corte" no corresponde a WE.type "Material" (patrón: MaterialShouldBeMachine) |
| WARNING FN_NO_VERB | 40 COSTURA UNION | function.description "Permite la unión de los paneles. Costura unión entre paneles" no comienza con verbo |
| WARNING FN_NO_VERB | 42 COSTURA VISTA | function.description "Permite la costura decorativa. Realiza costura decorativa" no comienza con verbo |
| WARNING FN_TOO_SHORT | 60 ENSAMBLE SUSTRATO + ESPUMA | function.description "Adherir la espuma al sustrato" muy corta (< 30 chars) |
| WARNING FN_NO_VERB | 70 ADHESIVADO | function.description "Rocía la mezcla de adhesivado sobre el vinilo. Adhesivado de" no comienza con verbo |
| WARNING FN_TOO_SHORT | 120 TERMINACION | function.description "Verificar tolerancias" muy corta (< 30 chars) |
| WARNING FN_TOO_SHORT | 150 EMBALAJE DE PRODUCTO TERMINADO | function.description "Embalar correctamente" muy corta (< 30 chars) |
| WARNING FN_TOO_SHORT | 150 EMBALAJE DE PRODUCTO TERMINADO | function.description "Embalar sin deformaciones" muy corta (< 30 chars) |

### AMFE-MAESTRO-INY-001 (MAESTRO/INYECCION_PLASTICA)
0 CRITICAL + 10 WARNING

| Type | OP | Detalle |
|---|---|---|
| WARNING FN_NO_VERB | 20 Inyección | function.description "Parámetros validados por producto" no comienza con verbo |
| WARNING FN_NO_VERB | 20 Inyección | function.description "Inspección visual al 100% de cada pieza inyectada con compar" no comienza con verbo |
| WARNING FN_NO_VERB | 20 Inyección | function.description "Aire comprimido filtrado y seco" no comienza con verbo |
| WARNING OP_FUNCTION_SEMANTIC_MISMATCH | 30 CONTROL DIMENSIONAL POST-Inyec | OP "CONTROL DIMENSIONAL POST-Inyección Y CORTE DE COLADA" debería contener alguno de [inyectar, conformar] en su función |
| WARNING FN_TOO_SHORT | 30 CONTROL DIMENSIONAL POST-Inyec | function.description "Mesa de control con buena luz" muy corta (< 30 chars) |
| WARNING FN_NO_VERB | 30 CONTROL DIMENSIONAL POST-Inyec | function.description "Mesa de control con buena luz" no comienza con verbo |
| WARNING FN_NO_VERB | 30 CONTROL DIMENSIONAL POST-Inyec | function.description "Inspección 100% y liberacion de piezas" no comienza con verbo |
| WARNING FN_TOO_SHORT | 30 CONTROL DIMENSIONAL POST-Inyec | function.description "Referencia visual de defectos" muy corta (< 30 chars) |
| WARNING FN_NO_VERB | 30 CONTROL DIMENSIONAL POST-Inyec | function.description "Referencia visual de defectos" no comienza con verbo |
| WARNING FN_NO_VERB | 30 CONTROL DIMENSIONAL POST-Inyec | function.description "Iluminacion adecuada para inspección visual" no comienza con verbo |

### AMFE-TR-PAT (VWA/PATAGONIA/TOP_ROLL)
0 CRITICAL + 8 WARNING

| Type | OP | Detalle |
|---|---|---|
| WARNING OP_FUNCTION_SEMANTIC_MISMATCH | 20 Inyección DE PIEZA Plástica | OP "Inyección DE PIEZA Plástica" debería contener alguno de [inyectar, conformar] en su función |
| WARNING FN_NO_VERB | 20 Inyección DE PIEZA Plástica | function.description "Iluminacion adecuada para inspección visual" no comienza con verbo |
| WARNING FN_NO_VERB | 20 Inyección DE PIEZA Plástica | function.description "Parámetros validados por producto" no comienza con verbo |
| WARNING FN_NO_VERB | 20 Inyección DE PIEZA Plástica | function.description "Inspección visual al 100% de cada pieza inyectada con compar" no comienza con verbo |
| WARNING FN_NO_VERB | 20 Inyección DE PIEZA Plástica | function.description "Aire comprimido filtrado y seco" no comienza con verbo |
| WARNING FN_NO_VERB | 40 TERMOFORMADO | function.description "Base receptora del adhesivo con tensión superficial correcta" no comienza con verbo |
| WARNING FN_NO_VERB | 40 TERMOFORMADO | function.description "Base receptora del adhesivo con tensión superficial correcta" no comienza con verbo |
| WARNING FN_NO_VERB | 60 PLEGADO DE BORDES | function.description "Plegado de bordes: revertir los bordes sobrantes de TPO sobr" no comienza con verbo |

### 150 (VWA/PATAGONIA/ARMREST_REAR_CEN)
0 CRITICAL + 7 WARNING

| Type | OP | Detalle |
|---|---|---|
| WARNING FN_NO_VERB | 20 CORTE DE COMPONENTES | function.description "3. Configurar: Ingresar capas y largo, medir cuchilla si apl" no comienza con verbo |
| WARNING FN_NO_VERB | 30 PREPARACION DE KITS DE COMPONE | function.description "2- Realizar una revisión visual de cada componente para dete" no comienza con verbo |
| WARNING FN_NO_VERB | 30 PREPARACION DE KITS DE COMPONE | function.description "3- Colocar todos los componentes necesarios para una unidad " no comienza con verbo |
| WARNING FN_NO_VERB | 50 INYECCION DE PUR IN SITU | function.description "2- Verter material de poliuretano líquido a través de la abe" no comienza con verbo |
| WARNING FN_NO_VERB | 60 TAPIZADO | function.description "3- Se enfunda (coloca la funda de PVC o tela) sobre ambas." no comienza con verbo |
| WARNING FN_NO_VERB | 70 CONTROL FINAL DE CALIDAD Y PRU | function.description "3- Revisa que el orificio inferior esté correctamente sellad" no comienza con verbo |
| WARNING FN_NO_VERB | 90 EMBALAJE Y ETIQUETADO DE PRODU | function.description "3- Acomodar piezas dentro del medio de embalaje" no comienza con verbo |

### AMFE-1 (PWA/HILUX/TELAS_PLANAS)
0 CRITICAL + 7 WARNING

| Type | OP | Detalle |
|---|---|---|
| WARNING OP_FUNCTION_SEMANTIC_MISMATCH | 10 RECEPCION DE MATERIA PRIMA | OP "RECEPCION DE MATERIA PRIMA" debería contener alguno de [verificar, conformidad, trazabilidad] en su función |
| WARNING FN_NO_VERB | 10 RECEPCION DE MATERIA PRIMA | function.description "Refuerzo con carga hierro dentro de tolerancia dimensional" no comienza con verbo |
| WARNING FN_NO_VERB | 10 RECEPCION DE MATERIA PRIMA | function.description "Material conforme EU 2000/53/CE" no comienza con verbo |
| WARNING FN_NO_VERB | 10 RECEPCION DE MATERIA PRIMA | function.description "Material compatible con inyeccion espuma PU" no comienza con verbo |
| WARNING FN_NO_VERB | 40 COSTURA | function.description "Costura fuerte, sin arruga ni pliegues con hilo según especi" no comienza con verbo |
| WARNING FN_NO_VERB | 80 CONTROL FINAL DE CALIDAD | function.description "Pieza cumple tolerancia forma/posicion +/-3mm" no comienza con verbo |
| WARNING FN_NO_VERB | 110 EMBALAJE | function.description "Embalar, identificar y proteger producto para despacho" no comienza con verbo |

### AMFE-2 (PWA/HILUX/TELAS_TERMOFORMADAS)
0 CRITICAL + 6 WARNING

| Type | OP | Detalle |
|---|---|---|
| WARNING FN_NO_VERB | 10 RECEPCION DE MATERIA PRIMA | function.description "Identificar, registrar y almacenar materiales correctamente " no comienza con verbo |
| WARNING FN_NO_VERB | 10 RECEPCION DE MATERIA PRIMA | function.description "Refuerzo con carga hierro dentro de tolerancia dimensional" no comienza con verbo |
| WARNING FN_NO_VERB | 10 RECEPCION DE MATERIA PRIMA | function.description "Material conforme EU 2000/53/CE" no comienza con verbo |
| WARNING FN_NO_VERB | 10 RECEPCION DE MATERIA PRIMA | function.description "Material compatible con inyeccion espuma PU" no comienza con verbo |
| WARNING WE_NAME_FOREIGN_TYPE | 20 CORTE DE COMPONENTES | WE.name "Cuchilla de corte" no corresponde a WE.type "Material" (patrón: MaterialShouldBeMachine) |
| WARNING FN_NO_VERB | 80 COSTURA DE REFUERZOS | function.description "Pieza cumple tolerancia forma/posicion +/-3mm" no comienza con verbo |

### AMFE-INS-PAT (VWA/PATAGONIA/INSERT)
0 CRITICAL + 6 WARNING

| Type | OP | Detalle |
|---|---|---|
| WARNING WE_NAME_FOREIGN_TYPE | 20 CORTE DE COMPONENTES | WE.name "Cuchilla de corte" no corresponde a WE.type "Material" (patrón: MaterialShouldBeMachine) |
| WARNING FN_NO_VERB | 50 COSTURA CNC | function.description "Colocacion de material dentro de la plantilla. Operador de c" no comienza con verbo |
| WARNING OP_FUNCTION_SEMANTIC_MISMATCH | 70 Inyección DE PIEZAS PLASTICAS | OP "Inyección DE PIEZAS PLASTICAS" debería contener alguno de [inyectar, conformar] en su función |
| WARNING FN_NO_VERB | 70 Inyección DE PIEZAS PLASTICAS | function.description "Parámetros validados por producto" no comienza con verbo |
| WARNING FN_NO_VERB | 70 Inyección DE PIEZAS PLASTICAS | function.description "Inspección visual al 100% de cada pieza inyectada con compar" no comienza con verbo |
| WARNING FN_NO_VERB | 70 Inyección DE PIEZAS PLASTICAS | function.description "Aire comprimido filtrado y seco" no comienza con verbo |

### 160 (PWA/SERIE/TELAS_PLANAS)
0 CRITICAL + 6 WARNING

| Type | OP | Detalle |
|---|---|---|
| WARNING FN_NO_VERB | 10 RECEPCION DE MATERIA PRIMA | function.description "Refuerzo con carga hierro dentro de tolerancia dimensional" no comienza con verbo |
| WARNING FN_NO_VERB | 10 RECEPCION DE MATERIA PRIMA | function.description "Material conforme EU 2000/53/CE" no comienza con verbo |
| WARNING FN_NO_VERB | 10 RECEPCION DE MATERIA PRIMA | function.description "Material compatible con inyeccion espuma PU" no comienza con verbo |
| WARNING FN_NO_VERB | 40 COSTURA (aplica solo a Aplix 2 | function.description "Costura fuerte, sin arruga ni pliegues con hilo según especi" no comienza con verbo |
| WARNING FN_NO_VERB | 80 CONTROL FINAL DE CALIDAD | function.description "Pieza cumple tolerancia forma/posicion" no comienza con verbo |
| WARNING FN_NO_VERB | 110 EMBALAJE | function.description "Embalar, identificar y proteger producto para despacho" no comienza con verbo |

### AMFE-ARM-PAT (VWA/PATAGONIA/ARMREST_DOOR_PANEL)
0 CRITICAL + 5 WARNING

| Type | OP | Detalle |
|---|---|---|
| WARNING WE_NAME_FOREIGN_TYPE | 15 PREPARACION DE CORTE | WE.name "Cuchilla de corte" no corresponde a WE.type "Material" (patrón: MaterialShouldBeMachine) |
| WARNING WE_NAME_FOREIGN_TYPE | 20 CORTE DE COMPONENTES | WE.name "Cuchilla de corte" no corresponde a WE.type "Material" (patrón: MaterialShouldBeMachine) |
| WARNING OP_FUNCTION_SEMANTIC_MISMATCH | 60 Inyección DE PIEZAS PLASTICAS | OP "Inyección DE PIEZAS PLASTICAS" debería contener alguno de [inyectar, conformar] en su función |
| WARNING FN_NO_VERB | 60 Inyección DE PIEZAS PLASTICAS | function.description "Parámetros validados por producto" no comienza con verbo |
| WARNING FN_NO_VERB | 60 Inyección DE PIEZAS PLASTICAS | function.description "Aire comprimido filtrado y seco" no comienza con verbo |

### AMFE-MAESTRO-PU-001 (MAESTRO/INYECCION_PUR_IN_PLACE)
0 CRITICAL + 2 WARNING

| Type | OP | Detalle |
|---|---|---|
| WARNING OP_FUNCTION_SEMANTIC_MISMATCH | 10 INYECCION PUR IN PLACE | OP "INYECCION PUR IN PLACE" debería contener alguno de [inyectar, conformar] en su función |
| WARNING FN_NO_VERB | 10 INYECCION PUR IN PLACE | function.description "Dar forma a la pieza durante el espumado y curado" no comienza con verbo |

### 159 (PWA/SERIE/TELAS_PLANAS_GRAMPAS)
0 CRITICAL + 2 WARNING

| Type | OP | Detalle |
|---|---|---|
| WARNING FN_NO_VERB | 10 RECEPCION DE MATERIA PRIMA | function.description "Material conforme EU 2000/53/CE" no comienza con verbo |
| WARNING FN_NO_VERB | 40 COSTURA | function.description "Costura fuerte sin arrugas con hilo segun especificacion" no comienza con verbo |

### 129 (VWA/AMAROK_PA2/IP_DECORATIVE_116)
0 CRITICAL + 2 WARNING

| Type | OP | Detalle |
|---|---|---|
| WARNING FN_TOO_SHORT | 20 CORTAR VINILO / TELA | function.description "Verificar con Calibre y Mylar" muy corta (< 30 chars) |
| WARNING FN_TOO_SHORT | 60 CONTROL FINAL DE CALIDAD | function.description "Verificar con Calibre MC257" muy corta (< 30 chars) |

### 128 (VWA/AMAROK_PA2/IP_DECORATIVE_115)
0 CRITICAL + 1 WARNING

| Type | OP | Detalle |
|---|---|---|
| WARNING FN_TOO_SHORT | 20 CORTAR VINILO / TELA | function.description "Verificar con Calibre y Mylar" muy corta (< 30 chars) |

### AMFE-MAESTRO-LOG-REC-001 (MAESTRO/LOGISTICA_RECEPCION)
0 CRITICAL + 1 WARNING

| Type | OP | Detalle |
|---|---|---|
| WARNING OP_FUNCTION_SEMANTIC_MISMATCH | 10 RECEPCION Y PREPARACION DE MAT | OP "RECEPCION Y PREPARACION DE MATERIA PRIMA" debería contener alguno de [verificar, conformidad, trazabilidad] en su función |

