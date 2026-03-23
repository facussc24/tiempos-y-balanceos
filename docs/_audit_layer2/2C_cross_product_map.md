# 2C - Mapa de Normalizacion Cross-Product

**Fecha**: 2026-03-23
**Fuente**: Layer 1E - Auditoria de Consistencia Cross-Product
**Alcance**: 8 familias de producto, 18 AMFEs, 18 CPs, 17 HOs
**Objetivo**: Tabla unificada de inconsistencias con propuestas de normalizacion

---

## 1. Tabla de Normalizacion por Tipo de Operacion

Leyenda: Cada celda muestra el nombre exacto tal como aparece en el AMFE del producto. "---" = operacion no aplica a ese producto.

### 1.1 Recepcion de Materia Prima

| Producto | Nombre actual en AMFE | Op# |
|----------|----------------------|-----|
| Insert | RECEPCIONAR MATERIA PRIMA | 10 |
| Armrest | RECEPCIONAR MATERIA PRIMA | 10 |
| Top Roll | RECEPCIONAR MATERIA PRIMA | 5 |
| Headrest Front | RECEPCIONAR MATERIA PRIMA | 10 |
| Headrest Rear Cen | RECEPCIONAR MATERIA PRIMA | 10 |
| Headrest Rear Out | RECEPCIONAR MATERIA PRIMA | 10 |
| Telas Planas | Recepcion de Punzonado | 10 |
| Telas Termoformadas | Recepcion de materiales con identificacion correcta | 10 |

**Inconsistencias detectadas**:
- 6 productos VWA: "RECEPCIONAR MATERIA PRIMA" (MAYUSCULAS, verbo infinitivo)
- Telas Planas: "Recepcion de Punzonado" (mixed case, nombra el material en vez de la operacion generica)
- Telas Termoformadas: "Recepcion de materiales con identificacion correcta" (mixed case, describe el resultado esperado)
- Top Roll usa Op 5, todos los demas usan Op 10

| PROPUESTA UNIFICADA |
|---------------------|
| **RECEPCION DE MATERIA PRIMA** — Op 10 para todos (Top Roll mantiene Op 5 por diferencia de proceso, pero nombre unificado) |

**Justificacion**: "RECEPCION" (sustantivo) es mas natural que "RECEPCIONAR" (infinitivo). Eliminar nombre de material del titulo de operacion (va en el detalle/sub-operacion, no en el nombre generico). Eliminar descripcion de resultado esperado del nombre.

---

### 1.2 Corte / Troquelado

| Producto | Nombre actual en AMFE | Op# |
|----------|----------------------|-----|
| Insert | CORTE DE COMPONENTES DE VINILO O TELA - Preparacion / Cortar / Control | 15/20/25 |
| Armrest | CORTE DE COMPONENTES - PREPARACION DE CORTE / DE VINILO O TELA / CONTROL CON MYLAR | 15/20/25 |
| Headrest Front | CORTE DEL VINILO / TELA (FUNDA) | 20 |
| Headrest Rear Cen | CORTE DEL VINILO / TELA (FUNDA) | 20 |
| Headrest Rear Out | CORTE DEL VINILO / TELA (FUNDA) | 20 |
| Telas Planas | Corte por maquina de pieza Central / Blank de piezas laterales | 20/21 |
| Telas Termoformadas | Corte por maquina automatica segun dimensional | 20 |
| Top Roll | --- (no tiene operacion de corte) | --- |

**Inconsistencias detectadas**:
- Insert incluye "DE VINILO O TELA" en cada sub-operacion; Armrest lo omite en algunas
- Insert usa mixed case en subtitulos ("Preparacion de corte"); Armrest todo MAYUSCULAS
- Headrests usan nombre generico sin sub-operaciones
- Telas Planas nombra piezas especificas ("pieza Central", "piezas laterales")
- Telas Termoformadas describe el metodo ("por maquina automatica segun dimensional")

| Sub-operacion | PROPUESTA UNIFICADA |
|---------------|---------------------|
| Preparacion | **CORTE DE COMPONENTES - PREPARACION** |
| Corte propiamente | **CORTE DE COMPONENTES - CORTE DE VINILO / TELA** |
| Control | **CORTE DE COMPONENTES - CONTROL CON MYLAR** |
| Corte simple (Headrests) | **CORTE DE COMPONENTES - CORTE DE VINILO / TELA** |
| Corte Telas | **CORTE DE COMPONENTES - CORTE POR MAQUINA** |

**Justificacion**: Patron "CATEGORIA - DETALLE". No nombrar piezas especificas ni part numbers en el titulo. El material (vinilo/tela) se mantiene donde aplica porque distingue el proceso.

---

### 1.3 Costura

| Producto | Nombre actual en AMFE | Op# |
|----------|----------------------|-----|
| Insert | Costura - Refilado / Costura - Costura CNC | 40/50 |
| Armrest | COSTURA - REFILADO / COSTURA UNION / COSTURA DOBLE | 40/50/51 |
| Headrest Front | COSTURA UNION ENTRE PANELES / COSTURA VISTA | 30/40 |
| Headrest Rear Cen | COSTURA UNION ENTRE PANELES / COSTURA VISTA | 30/40 |
| Headrest Rear Out | COSTURA UNION ENTRE PANELES / COSTURA VISTA | 30/40 |
| Telas Termoformadas | Costura fuerte, sin arruga ni pliegues | 30 |
| Telas Planas | --- | --- |

**Inconsistencias detectadas**:
- Insert usa mixed case ("Costura - Refilado"); Armrest usa MAYUSCULAS ("COSTURA - REFILADO")
- Insert dice "Costura CNC" (describe maquina); Armrest dice "COSTURA UNION" / "COSTURA DOBLE" (describe tipo)
- Telas Termoformadas describe resultado esperado, no la operacion
- Headrests no usan patron "CATEGORIA - DETALLE", usan nombre plano

| Sub-operacion | PROPUESTA UNIFICADA |
|---------------|---------------------|
| Refilado | **COSTURA - REFILADO** |
| Union de paneles | **COSTURA - UNION DE PANELES** |
| Costura vista | **COSTURA - COSTURA VISTA** |
| Costura doble | **COSTURA - COSTURA DOBLE** |
| Costura CNC | **COSTURA - COSTURA CNC** |
| Costura Telas Termo | **COSTURA - UNION** |

**Justificacion**: Siempre patron "COSTURA - [tipo]". Eliminar descripciones de resultado del nombre. Mantener diferenciacion CNC/union/doble/vista porque son procesos fisicamente diferentes.

---

### 1.4 Adhesivado

| Producto | Nombre actual en AMFE | Op# |
|----------|----------------------|-----|
| Insert | ADHESIVADO - ADHESIVAR PIEZAS / INSPECCIONAR / ALMACENAMIENTO WIP | 90/91/92 |
| Armrest | ADHESIVADO - ADHESIVAR PIEZAS / INSPECCIONAR / ALMACENAMIENTO WIP | 80/81/82 |
| Top Roll | ADHESIVADO HOT MELT | 20 |
| Headrests | --- | --- |
| Telas | --- | --- |

**Inconsistencias detectadas**:
- Insert y Armrest tienen estructura identica (3 sub-ops), solo difiere el case mixing en Insert
- Top Roll simplifica en 1 sola operacion y agrega tipo de adhesivo ("HOT MELT")

| Sub-operacion | PROPUESTA UNIFICADA |
|---------------|---------------------|
| Adhesivado | **ADHESIVADO - APLICACION** |
| Inspeccion post-adhesivado | **ADHESIVADO - INSPECCION** |
| Almacenamiento WIP | **ADHESIVADO - ALMACENAMIENTO WIP** |
| Adhesivado simple (Top Roll) | **ADHESIVADO - APLICACION HOT MELT** |

**Justificacion**: "ADHESIVAR PIEZAS" es redundante con "ADHESIVADO". Usar "APLICACION" como sub-detalle. Top Roll mantiene "HOT MELT" porque distingue el tipo de adhesivo.

---

### 1.5 Inyeccion / Espumado

| Producto | Nombre actual en AMFE | Op# |
|----------|----------------------|-----|
| Insert | TAPIZADO - TAPIZADO SEMIAUTOMATICO | 100 |
| Armrest | TAPIZADO - TAPIZADO SEMIAUTOMATICO | 90 |
| Top Roll | ADHESIVADO HOT MELT (ya cubierto arriba) | --- |
| Headrest Front | INYECCION PUR - APOYACABEZAS | 60 |
| Headrest Rear Cen | INYECCION PUR - APOYACABEZAS | 50 |
| Headrest Rear Out | INYECCION PUR - APOYACABEZAS | 50 |
| Telas Planas | Termoformado | 30 |
| Telas Termoformadas | --- | --- |

**Inconsistencias detectadas**:
- Insert y Armrest: "TAPIZADO SEMIAUTOMATICO" — consistente entre si
- Headrests: "INYECCION PUR - APOYACABEZAS" — nombre de producto en titulo
- Telas Planas: "Termoformado" — mixed case, sin patron CATEGORIA-DETALLE

| Producto | PROPUESTA UNIFICADA |
|----------|---------------------|
| Insert/Armrest | **TAPIZADO - SEMIAUTOMATICO** (eliminar redundancia) |
| Headrests | **INYECCION PUR - ESPUMADO** (eliminar nombre de producto) |
| Telas Planas | **TERMOFORMADO** (solo MAYUSCULAS) |

---

### 1.6 Ensamble

| Producto | Nombre actual en AMFE | Op# |
|----------|----------------------|-----|
| Headrest Front | ENSAMBLE DE VARILLA + EPP | 50 |
| Headrest Rear Cen | --- (no tiene) | --- |
| Headrest Rear Out | --- (no tiene) | --- |
| Insert/Armrest/Top Roll/Telas | --- | --- |

**Nota**: Operacion exclusiva de Headrest Front. No necesita normalizacion cross-product. Propuesta: mantener como **ENSAMBLE - VARILLA + EPP** (patron CATEGORIA - DETALLE).

---

### 1.7 Inspeccion Final

| Producto | Nombre actual en AMFE | Op# |
|----------|----------------------|-----|
| Insert | Inspeccion Final - CONTROL FINAL DE CALIDAD | 110 |
| Armrest | INSPECCION FINAL - CONTROL FINAL DE CALIDAD | 100 |
| Top Roll | INSPECCION FINAL Y EMPAQUE | 80 |
| Headrest Front | INSPECCION FINAL - APOYACABEZAS INYECTADO | 70 |
| Headrest Rear Cen | INSPECCION FINAL - APOYACABEZAS INYECTADO | 60 |
| Headrest Rear Out | INSPECCION FINAL - APOYACABEZAS INYECTADO | 60 |
| Telas Planas | Control de pieza final | 70 |
| Telas Termoformadas | Inspeccion final de la pieza | 60 |

**Inconsistencias detectadas** (5 estilos diferentes):
1. Insert: mixed case antes del guion + MAYUSCULAS despues
2. Armrest: todo MAYUSCULAS, coincide con Insert en contenido
3. Top Roll: combina inspeccion + empaque en una sola operacion
4. Headrests: agrega nombre de producto ("APOYACABEZAS INYECTADO")
5. Telas Planas: "Control" en vez de "Inspeccion"
6. Telas Termoformadas: "Inspeccion final de la pieza" (patron descriptivo)

| PROPUESTA UNIFICADA |
|---------------------|
| **INSPECCION FINAL** — Sin sufijo de producto, sin combinacion con empaque. Simple y universal. |

**Justificacion**: "Inspeccion" (no "Control") como vocabulario estandar. Sin nombre de producto en el titulo. Top Roll debe separar inspeccion de empaque en dos operaciones.

---

### 1.8 Embalaje

| Producto | Nombre actual en AMFE | Op# |
|----------|----------------------|-----|
| Insert | Embalaje - EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO | 120 |
| Armrest | EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO | 110 |
| Top Roll | EMPAQUE FINAL Y ETIQUETADO DE PRODUCTO TERMINADO | 90 |
| Headrest Front | EMBALAJE | 80 |
| Headrest Rear Cen | EMBALAJE | 70 |
| Headrest Rear Out | EMBALAJE | 70 |
| Telas Planas | Embalaje | 80 |
| Telas Termoformadas | Embalaje identificado con cantidad de piezas especificas | 70 |

**Inconsistencias detectadas** (4 estilos):
1. Insert: prefijo tautologico "Embalaje - EMBALAJE..."
2. Top Roll: usa "EMPAQUE" en vez de "EMBALAJE"
3. Headrests/Telas Planas: minimalista "EMBALAJE"
4. Telas Termoformadas: descriptivo de resultado

| PROPUESTA UNIFICADA |
|---------------------|
| **EMBALAJE Y ETIQUETADO** — "Embalaje" (no "Empaque") como vocabulario estandar. Incluir "Etiquetado" porque es parte integral del proceso. Sin "de producto terminado" (redundante). |

---

### 1.9 Almacenamiento / Despacho (WIP)

| Producto | Cantidad de ops WIP | Patron de nombre |
|----------|---------------------|-----------------|
| Insert | 6 ops | "ALMACENAMIENTO EN MEDIOS WIP" / "Almacenamiento WIP" (HO) |
| Armrest | 6 ops | "ALMACENAMIENTO EN MEDIOS WIP" |
| Top Roll | 1 op | "ALMACENAMIENTO WIP" |
| Headrests | 0 ops | --- |
| Telas Planas | 0 ops | --- |
| Telas Termoformadas | 0 ops | --- |

**Inconsistencias detectadas**:
- Insert AMFE: "ALMACENAMIENTO EN MEDIOS WIP" / Insert HO: "Almacenamiento WIP"
- Solo Insert, Armrest, Top Roll documentan WIP; headrests y telas no

| PROPUESTA UNIFICADA |
|---------------------|
| **ALMACENAMIENTO WIP** — Sin "EN MEDIOS" (redundante). Si headrests/telas tienen WIP fisico, documentarlo. |

---

### Tabla Resumen Consolidada

| Operacion | PROPUESTA UNIFICADA | Productos que la usan |
|-----------|---------------------|-----------------------|
| Recepcion | RECEPCION DE MATERIA PRIMA | Todos (8) |
| Corte | CORTE DE COMPONENTES - [DETALLE] | 7 (no Top Roll) |
| Costura | COSTURA - [TIPO] | 6 (no Telas Planas, no Top Roll) |
| Adhesivado | ADHESIVADO - [DETALLE] | 3 (Insert, Armrest, Top Roll) |
| Tapizado | TAPIZADO - SEMIAUTOMATICO | 2 (Insert, Armrest) |
| Inyeccion | INYECCION PUR - ESPUMADO | 3 (Headrests) |
| Termoformado | TERMOFORMADO | 1 (Telas Planas) |
| Ensamble | ENSAMBLE - [DETALLE] | 1 (Headrest Front) |
| Inspeccion | INSPECCION FINAL | Todos (8) |
| Embalaje | EMBALAJE Y ETIQUETADO | Todos (8) |
| Almacenamiento WIP | ALMACENAMIENTO WIP | 3 (Insert, Armrest, Top Roll) |

---

## 2. Modos de Falla Comunes — Propuesta Unificada

### 2.1 Modos de falla en Recepcion

| Modo de falla | Variantes encontradas | Propuesta unificada |
|---------------|----------------------|---------------------|
| Material fuera de especificacion | Insert/Armrest: "Material fuera de especificacion (color, espesor, gramaje)" / Headrests: "Tipo incorrecto", "Color incorrecto", "Espesor fuera de rango", "Gramaje fuera de rango" (items separados) / Telas Planas: "Material no conforme" / Telas Termoformadas: "Material con identificacion incorrecta" | **Material fuera de especificacion** — con sub-items: tipo, color, espesor, gramaje, densidad, flamabilidad segun aplique |
| Falta de trazabilidad | Insert/Armrest: "Falta de trazabilidad en lote de MP" / Headrests: no mencionan explicitamente / Telas: no mencionan | **Falta de trazabilidad en materia prima** |
| Dano por manipulacion | Insert/Armrest: "Material danado por mala estiba o transporte" / Top Roll: "Material danado en transporte" / Headrests: no mencionan / Telas: no mencionan | **Material danado por manipulacion/transporte** |
| Material no identificado | Telas Termoformadas: "Material con identificacion incorrecta" / Insert/Armrest: incluido en trazabilidad / Headrests: no mencionan | **Material sin identificacion o identificacion incorrecta** |

### 2.2 Modos de falla en Corte

| Modo de falla | Variantes encontradas | Propuesta unificada |
|---------------|----------------------|---------------------|
| Pieza fuera de dimensional | Insert: "Pieza cortada fuera de dimensional" / Armrest: "Corte fuera de dimensional" / Headrests: "Corte fuera de medida" / Telas Planas: "Pieza con medida fuera de tolerancia" / Telas Termoformadas: "Corte fuera de dimensional" | **Pieza cortada fuera de dimensional** |
| Corte con defecto visual | Insert/Armrest: "Corte con rebaba o deshilachado" / Headrests: "Corte con defecto de borde" / Telas: no mencionan | **Corte con defecto de borde (rebaba/deshilachado)** |
| Mylar incorrecto | Insert: "Uso de mylar incorrecto" / Armrest: "Mylar equivocado o danado" | **Uso de mylar incorrecto o danado** |

### 2.3 Modos de falla en Costura

| Modo de falla | Variantes encontradas | Propuesta unificada |
|---------------|----------------------|---------------------|
| Puntada salteada | Insert: "Puntada salteada" / Armrest: "Costura con puntada salteada" / Headrests: "Sin salteada" (como criterio de control) / Telas Termoformadas: no mencionan como modo separado | **Puntada salteada** |
| Costura floja | Insert: "Costura floja" / Armrest: "Tension de hilo inadecuada" / Headrests: "Sin floja" (como criterio) / Telas Termoformadas: "Costura debil (sin fuerza)" | **Costura floja / tension de hilo inadecuada** |
| Costura con arrugas | Armrest: "Costura con arrugas" / Headrests: "Sin arrugas" (como criterio) / Telas Termoformadas: "Sin arruga ni pliegues" (en nombre de operacion) | **Costura con arrugas o pliegues** |
| Rotura de hilo | Insert: "Rotura de hilo durante costura" / Armrest: "Hilo inadecuado o danado" / Telas Termoformadas: "Falla en carreteles" | **Rotura de hilo / hilo inadecuado** |
| Aguja inadecuada | Armrest: "Aguja rota o inadecuada" / Telas Termoformadas: "Aguja inadecuada" | **Aguja inadecuada o danada** |
| Paralelismo de costura | Headrests: "Paralelismo fuera de tolerancia" / Insert: "Costura fuera de linea" | **Costura fuera de paralelismo / linea** |

### 2.4 Modos de falla en Inspeccion Final

| Modo de falla | Variantes encontradas | Propuesta unificada |
|---------------|----------------------|---------------------|
| Defecto visual no detectado | Insert: "Pieza con defecto visual no detectada" / Armrest: "Defecto visual no detectado en inspeccion" / Headrests: "Defecto no detectado" / Telas Planas: "Pieza con defecto no detectado" / Telas Termoformadas: "Pieza final con defecto" | **Pieza con defecto visual no detectado en inspeccion** |
| Error de identificacion | Insert/Armrest: "Error de etiquetado" / Headrests: "Identificacion incorrecta" / Telas: "Error en identificacion" | **Error de identificacion / etiquetado** |

### 2.5 Modos de falla en Embalaje

| Modo de falla | Variantes encontradas | Propuesta unificada |
|---------------|----------------------|---------------------|
| Cantidad incorrecta | Insert: "Cantidad incorrecta en caja" / Armrest: "Cantidad erronea" / Top Roll: "Cantidad incorrecta" / Headrests: "Cantidad" (item minimal) / Telas Planas: "Error conteo" / Telas Termoformadas: "Error en cantidad" | **Cantidad incorrecta en embalaje** |
| Identificacion incorrecta | Insert: "Etiqueta incorrecta o faltante" / Armrest: "Etiqueta erronea" / Top Roll: "Etiqueta incorrecta" / Headrests: "Identificacion" / Telas Planas: "Identificacion erronea" / Telas Termoformadas: "Identificacion incorrecta" | **Etiqueta / identificacion incorrecta o faltante** |
| Dano en embalaje | Insert: "Producto danado por mal posicionamiento" / Armrest: "Deformacion por posicionamiento" / Top Roll: "Dano por separadores" | **Producto danado por posicionamiento en embalaje** |

---

## 3. Controles Comunes — Propuesta Unificada

### 3.1 Controles de Prevencion

| Control | Variantes encontradas | Propuesta unificada |
|---------|----------------------|---------------------|
| Set-up de maquina | Insert: "Verificacion de set-up" / Armrest: "Puesta a Punto (Set-up)" / Top Roll: "Set-up verificado" / Headrests: "Visual / Muestra patron" (no mencionan set-up) / Telas: "Control de parametros maquina" | **Verificacion de set-up / puesta a punto** |
| Instruccion de trabajo | Insert: "Instruccion de trabajo disponible" / Armrest: "IT documentada" / Headrests: "Hoja de operaciones" / Telas: "Instruccion de trabajo" | **Instruccion de trabajo / Hoja de operaciones disponible** |
| Capacitacion operario | Insert: "Operario capacitado y habilitado" / Armrest: "Capacitacion registrada" / Telas Termoformadas: "Operario capacitado" / Headrests: no mencionan explicitamente | **Operario capacitado y habilitado (registro vigente)** |
| Mantenimiento preventivo | Insert: "Plan de mantenimiento preventivo" / Armrest: "Mantenimiento preventivo" / Top Roll: "Plan MP" | **Plan de mantenimiento preventivo** |

### 3.2 Controles de Deteccion

| Control | Variantes encontradas | Propuesta unificada |
|---------|----------------------|---------------------|
| Inspeccion visual | Insert: "Inspeccion visual 100%" / Armrest: "Control visual" / Headrests: "Visual / Muestra patron" / Telas Planas: "Control visual 100%" / Telas Termoformadas: "Inspeccion visual" | **Inspeccion visual** (+ frecuencia y sample size como campos separados) |
| Muestra patron | Insert: "Comparacion con muestra patron" / Armrest: "Muestra patron aprobada" / Headrests: "Visual / Muestra patron" / Telas: no mencionan | **Comparacion contra muestra patron aprobada** |
| Galga / calibre | Insert: "Verificacion con galga o calibre" / Armrest: "Medicion con calibre" / Top Roll: "Galga de control" / Headrests: no mencionan | **Verificacion con galga / calibre** |
| Sensor / poka-yoke | Top Roll: "Sensor fixture" / Insert: "Poka-yoke" / Armrest: "Dispositivo anti-error" | **Poka-yoke / dispositivo anti-error** |
| Auditoria de proceso | Insert: "Auditoria de proceso" / Armrest: "Auditoria layered" / Top Roll: "LPA" | **Auditoria de proceso (LPA)** |

### 3.3 Frecuencias de Muestreo — Armonizacion

| Operacion | Insert | Armrest | Top Roll | Headrests | Telas Planas | Telas Termo | PROPUESTA |
|-----------|--------|---------|----------|-----------|--------------|-------------|-----------|
| Recepcion | 3 pzas / 100% mix | 3 pzas / 100% mix | 100% / 3 pzas mix | 1 muestra | 100% | 100% | **100% en recepcion + 3 pzas por lote para dimensional** |
| Corte | 3 pzas / inicio-fin turno | 5 pzas / inicio-fin turno | --- | 1 muestra | 3 pzas / cont. | 5 pzas | **5 pzas / inicio y fin de turno** |
| Costura | 100% / inicio-fin turno | 5 pzas / inicio-fin turno | --- | 1 pza / inicio-fin turno / 100% lote | --- | 5 pzas | **5 pzas / inicio y fin de turno + 100% visual** |
| Inspeccion Final | 100% | 100% | 100% | 100% | 100% | 100% | **100%** (ya armonizado) |
| Embalaje | 3 pzas / cada caja | 100% / cada caja | 100% / sensor | 100% / cada caja | 3 pzas / contenedor | 5 pzas / cada caja | **100% / cada contenedor o caja** |

---

## 4. Nomenclatura de Operaciones — Convencion Propuesta

### 4.1 Reglas de Estilo

| Aspecto | Convencion propuesta | Justificacion |
|---------|---------------------|---------------|
| Case | **TODO MAYUSCULAS** | 6 de 8 productos (todos los VWA) ya lo usan. Standard industrial. |
| Con numero de OP | **Si, "OP XX — NOMBRE"** en documentos formales (AMFE, CP); solo nombre en HO | Facilita trazabilidad AMFE-CP. HO ya tiene numero en el header. |
| Patron de nombre | **CATEGORIA - DETALLE** cuando hay sub-operaciones | Ej: "COSTURA - UNION DE PANELES", "ADHESIVADO - APLICACION". Si la operacion no tiene sub-ops, nombre plano: "INSPECCION FINAL". |
| Abreviaciones permitidas | **WIP** (Work In Progress), **PUR** (poliuretano), **CNC**, **EPP**, **MP** (materia prima) | Solo abreviaciones estandar de la industria. No abreviar nombres de operaciones. |
| Lo que NO va en el nombre | Part numbers, descripciones de resultado esperado, nombres de producto | Part numbers van en campo separado. Resultados van en criterio de aceptacion. |
| Separador | **Guion con espacios " - "** entre categoria y detalle | Ej: "CORTE DE COMPONENTES - CONTROL CON MYLAR" |

### 4.2 Formato Propuesto

```
Documentos AMFE/CP:   OP [##] — [CATEGORIA] - [DETALLE]
                      Ej: OP 20 — CORTE DE COMPONENTES - CORTE DE VINILO / TELA

Documentos HO:        [CATEGORIA] - [DETALLE]  (el numero de OP va en el header de la hoja)
                      Ej: CORTE DE COMPONENTES - CORTE DE VINILO / TELA
```

### 4.3 Vocabulario Estandar

| Usar | NO usar | Razon |
|------|---------|-------|
| EMBALAJE | Empaque | "Embalaje" es el termino predominante (7 de 8 productos) |
| INSPECCION | Control (de pieza final) | "Inspeccion" es mas especifico. "Control" es ambiguo (puede ser control de proceso). |
| RECEPCION | Recepcionar | Sustantivo, no infinitivo. Mas conciso. |
| COSTURA | Costura fuerte... | Nombre de operacion, no descripcion de resultado. |
| ALMACENAMIENTO WIP | Almacenamiento en medios WIP | Simplificar. "En medios" es redundante. |

---

## 5. Casos Especiales (Diferencias Legitimas)

### 5.1 Headrest Front (L0) vs L1/L2/L3

| Aspecto | L0 (maestro) | L1/L2/L3 (variantes) | Legitimidad |
|---------|-------------|----------------------|-------------|
| Costura Vista en CP | NO tiene step Costura Vista | SI tiene Step 30.2 Costura Vista (9 items) | **PROBLEMA**: El AMFE de L0 SI tiene Costura Vista (Op 40, 8 modos de falla) pero el CP L0 no la controla. Esto es un gap, no una diferencia legitima. |
| CP items totales | 54/52/54 | 63/61/63 | Diferencia de 9 items = los items de Costura Vista. |

**Accion requerida**: Agregar Step Costura Vista al CP L0 de los 3 headrests para cerrar el gap AMFE-CP.

### 5.2 Headrest Front vs Rear Center vs Rear Outer

| Aspecto | Front | Rear Center | Rear Outer | Legitimidad |
|---------|-------|-------------|------------|-------------|
| Ensamble de varilla (AMFE Op 50) | SI | NO | NO | **LEGITIMO**: Front tiene varilla+EPP, Rear no |
| Numeracion AMFE (desde Op 50) | 50/60/70/80 | 50/60/70 (offset -10) | 50/60/70 (offset -10) | **LEGITIMO**: Consecuencia de la op extra |
| CP Step 40 nombre | Ensamble Asta + Insert + Enfundado (4 items) | Ensamble Asta + Enfundado (2 items, sin Insert) | Ensamble Asta + Insert + Enfundado (4 items) | **LEGITIMO**: Rear Center no usa inserto plastico |
| AMFE/CP desalineacion | Desde Op 40 los nombres difieren | Idem | Idem | **PROBLEMA**: Numeracion CP no coincide con AMFE (ver seccion 6 hallazgo CP-NAME-1) |

### 5.3 Telas Planas vs Telas Termoformadas

| Aspecto | Telas Planas | Telas Termoformadas | Legitimidad |
|---------|-------------|---------------------|-------------|
| Termoformado (Op 30) | SI | NO | **LEGITIMO**: Solo Planas se termoforman |
| Horno (Op 20b) | SI | NO | **LEGITIMO**: Horno es parte del proceso de Planas |
| Corte en prensa (Op 40) | SI | NO | **LEGITIMO**: Solo Planas tienen troquelado en prensa |
| Perforado (Op 50) | SI | NO | **LEGITIMO**: Solo Planas requieren perforado |
| Soldadura (Op 60) | SI | NO | **LEGITIMO**: Solo Planas tienen soldadura |
| Costura | NO | SI (Op 30) | **LEGITIMO**: Solo Termoformadas se cosen |
| Dots (Op 50) | NO | SI | **LEGITIMO**: Solo Termoformadas llevan dots |
| Profundidad documental | 12 ops, 38 causas, 43 CP items | 8 ops, 21 causas, 22 CP items | **PARCIALMENTE LEGITIMO**: Planas tiene mas operaciones, pero la ratio causas/op (3.2 vs 2.6) sugiere analisis menos exhaustivo en Termoformadas |

### 5.4 Operaciones Unicas (No Requieren Unificacion)

| Operacion | Producto unico | Razon de exclusividad |
|-----------|---------------|----------------------|
| ENSAMBLE DE VARILLA + EPP | Headrest Front | Solo Front lleva varilla |
| TERMOFORMADO | Telas Planas | Proceso exclusivo de telas planas |
| HORNO | Telas Planas | Pre-calentamiento para termoformado |
| CORTE EN PRENSA | Telas Planas | Troquelado exclusivo |
| PERFORADO | Telas Planas | Agujeros para fijacion |
| SOLDADURA | Telas Planas | Union de paneles por soldadura |
| PEGADO DE DOTS | Telas Termoformadas | Fijacion con adhesivos puntuales |
| TAPIZADO SEMIAUTOMATICO | Insert / Armrest | Solo estos productos se tapizan |
| ADHESIVADO HOT MELT | Top Roll | Adhesivado exclusivo por proceso |
| COSTURA VISTA | Headrests (L1/L2/L3) | Solo variantes con costura decorativa |

---

## 6. Priorizacion de Inconsistencias

### CRITICO — Afecta auditorias, trazabilidad, o gaps de control

| # | Hallazgo | Productos | Descripcion | Accion |
|---|----------|-----------|-------------|--------|
| C1 | CP-NAME-1 | 3 Headrests | Numeracion AMFE no coincide con CP steps desde Op 40. Nombres diferentes para la misma operacion en AMFE vs CP. | **Re-numerar o re-nombrar CP steps para alinear con AMFE** |
| C2 | HR-3 | 3 Headrests L0 | AMFE tiene Costura Vista (Op 40, 8 modos de falla) pero CP L0 no tiene Step Costura Vista. Gap de control documentado. | **Agregar Step Costura Vista al CP L0** |
| C3 | HO-QC-1 | Top Roll, Telas Planas, Telas Termoformadas | 0 quality checks en todas las hojas de operaciones. HOs incompletas. | **Cargar QCs en las HOs de estos 3 productos** |
| C4 | CP-REC-1 | 3 Headrests | Sample size "1 muestra" para recepcion vs "100%/3 pzas" en otros productos. Misma planta, mismo material. | **Armonizar a "3 pzas + 100% visual" para todos** |
| C5 | EST-1 | Insert | AMFE mezcla MAYUSCULAS y mixed case dentro del mismo documento. Apariencia no profesional, confunde auditorias. | **Uniformizar a TODO MAYUSCULAS** |

### IMPORTANTE — Afecta 3+ productos, consistencia inter-documental

| # | Hallazgo | Productos | Descripcion | Accion |
|---|----------|-----------|-------------|--------|
| I1 | EST-2/EST-3 | 8 productos | PWA usa mixed case, VWA usa mayusculas. 3 patrones de nomenclatura coexisten. | **Adoptar TODO MAYUSCULAS + patron CATEGORIA - DETALLE** |
| I2 | INS-1 | 8 productos | 5 estilos diferentes para "Inspeccion Final" | **Uniformizar a "INSPECCION FINAL"** |
| I3 | EMB-1/EMB-3 | 8 productos | 4 estilos de "Embalaje" + Top Roll dice "EMPAQUE" | **Uniformizar a "EMBALAJE Y ETIQUETADO"** |
| I4 | TEL-1/TEL-2 | 2 Telas | 4 operaciones equivalentes con nombres completamente diferentes entre Telas Planas y Termoformadas | **Unificar nombres de operaciones compartidas** |
| I5 | CP-COS-3 | Insert/Armrest/Headrests | 3 criterios de muestreo diferentes para costura | **Armonizar a "5 pzas / inicio y fin de turno"** |
| I6 | HO-1 | Insert | HO simplifica nombres vs AMFE/CP (ej: "REFILADO DE PIEZA" vs "REFILADO POST-TAPIZADO") | **Alinear HO a mismos nombres que AMFE/CP** |
| I7 | HO-QC-2 | 3 Headrests | QCs solo en Corte y Costura, no en Recepcion/Ensamble/Espumado/Inspeccion/Embalaje | **Completar QCs en operaciones faltantes** |
| I8 | REC-1 | Telas Planas, Telas Termoformadas | Nombre de recepcion describe material o resultado, no la operacion | **Renombrar a "RECEPCION DE MATERIA PRIMA"** |
| I9 | CP-REC-2 | Insert/Armrest vs Headrests | Dos filosofias de CP para recepcion: causas de falla del proceso vs caracteristicas del material | **Combinar ambos enfoques: causas de proceso + caracteristicas clave del material** |
| I10 | CP-EMB-2 | Telas Planas vs Termoformadas | Sample size "3 pzas/contenedor" vs "5 pzas/caja" para productos similares del mismo cliente | **Armonizar a "5 pzas / cada contenedor"** |

### MENOR — Afecta 1-2 productos, cosmetico o de mantenimiento

| # | Hallazgo | Productos | Descripcion | Accion |
|---|----------|-----------|-------------|--------|
| M1 | REC-2 | Top Roll | Usa Op 5 para recepcion, todos los demas usan Op 10 | Correcto por proceso. Solo documentar la diferencia. |
| M2 | PN-1 | Telas Planas | Part numbers en nombres de operacion | Eliminar part numbers del nombre. Poner en campo dedicado. |
| M3 | EMB-2 | Insert | Prefijo tautologico "Embalaje - EMBALAJE..." | Eliminar prefijo redundante. |
| M4 | COR-1 | Insert/Armrest | Diferencia en "DE VINILO O TELA" en nombre de corte | Uniformizar: ambos incluyen o ambos omiten. |
| M5 | COS-3 | Telas Termoformadas | "Costura fuerte, sin arruga ni pliegues" describe resultado, no operacion | Renombrar a "COSTURA - UNION". |
| M6 | ADH-1 | Insert | Case mixing en sub-operaciones de adhesivado (mixed vs MAYUSCULAS) | Uniformizar a MAYUSCULAS. |
| M7 | TEL-3 | Telas Termoformadas | Patron de agregar resultado esperado a nombre de operacion | Eliminar resultados de los nombres de operacion. |
| M8 | TEL-4 | Telas Termoformadas | Ratio causas/operacion (2.6) menor que Telas Planas (3.2) | Revisar si faltan causas en Termoformadas. Baja prioridad. |

---

## 7. Roadmap de Implementacion Sugerido

### Fase 1 — Criticos (impacto en auditorias)
1. **C1**: Alinear numeracion AMFE-CP en Headrests
2. **C2**: Agregar Costura Vista al CP L0 de Headrests
3. **C3**: Cargar QCs en HOs de Top Roll, Telas Planas, Telas Termoformadas
4. **C4**: Armonizar sample size de recepcion en Headrests
5. **C5**: Uniformizar case en AMFE de Insert

### Fase 2 — Importantes (consistencia cross-product)
6. **I1**: Aplicar convencion de nomenclatura MAYUSCULAS + CATEGORIA-DETALLE a todos
7. **I2/I3**: Uniformizar nombres de Inspeccion Final y Embalaje
8. **I4/I8**: Unificar nombres de operaciones en Telas
9. **I5/I10**: Armonizar sample sizes cross-product
10. **I6/I7**: Alinear nombres HO-Insert + completar QCs HO-Headrests

### Fase 3 — Menores (mantenimiento y limpieza)
11. Aplicar correcciones cosmeticas (M1-M8)
12. Eliminar part numbers de nombres de operacion
13. Documentar casos especiales y diferencias legitimas

---

## Apendice: Matriz Completa Producto x Operacion

```
Operacion               | Insert | Armrest | Top Roll | HR Front | HR Rear Cen | HR Rear Out | Telas Planas | Telas Termo |
------------------------|--------|---------|----------|----------|-------------|-------------|--------------|-------------|
Recepcion MP            |  Op 10 |  Op 10  |  Op  5   |  Op 10   |   Op 10     |   Op 10     |    Op 10     |   Op 10     |
Corte - Preparacion     |  Op 15 |  Op 15  |   ---    |   ---    |    ---      |    ---      |     ---      |    ---      |
Corte - Corte           |  Op 20 |  Op 20  |   ---    |  Op 20   |   Op 20     |   Op 20     |    Op 20     |   Op 20     |
Corte - Control Mylar   |  Op 25 |  Op 25  |   ---    |   ---    |    ---      |    ---      |     ---      |    ---      |
Almacenamiento WIP (1)  |  Op 30 |  Op 30  |  Op 11   |   ---    |    ---      |    ---      |     ---      |    ---      |
Costura - Refilado      |  Op 40 |  Op 40  |   ---    |   ---    |    ---      |    ---      |     ---      |    ---      |
Costura - Union         |  Op 50 |  Op 50  |   ---    |  Op 30   |   Op 30     |   Op 30     |     ---      |   Op 30     |
Costura - Doble         |   ---  |  Op 51  |   ---    |   ---    |    ---      |    ---      |     ---      |    ---      |
Costura - Vista         |   ---  |   ---   |   ---    |  Op 40   |   Op 40     |   Op 40     |     ---      |    ---      |
Adhesivado              |  Op 90 |  Op 80  |  Op 20   |   ---    |    ---      |    ---      |     ---      |    ---      |
Tapizado                | Op 100 |  Op 90  |   ---    |   ---    |    ---      |    ---      |     ---      |    ---      |
Ensamble Varilla+EPP    |   ---  |   ---   |   ---    |  Op 50   |    ---      |    ---      |     ---      |    ---      |
Inyeccion PUR           |   ---  |   ---   |   ---    |  Op 60   |   Op 50     |   Op 50     |     ---      |    ---      |
Termoformado            |   ---  |   ---   |   ---    |   ---    |    ---      |    ---      |    Op 30     |    ---      |
Inspeccion Final        | Op 110 | Op 100  |  Op 80   |  Op 70   |   Op 60     |   Op 60     |    Op 70     |   Op 60     |
Embalaje                | Op 120 | Op 110  |  Op 90   |  Op 80   |   Op 70     |   Op 70     |    Op 80     |   Op 70     |
```

Nota: Operaciones exclusivas de Telas (Horno, Prensa, Perforado, Soldadura, Dots, Clips/Aplix) omitidas por claridad. Ver seccion 5.3 para detalle.

---

*Documento generado a partir de Layer 1E (Auditoria de Consistencia Cross-Product). Todas las propuestas estan sujetas a validacion contra los PDFs originales de proceso.*
