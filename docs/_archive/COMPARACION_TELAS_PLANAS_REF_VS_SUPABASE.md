# Comparacion Telas Planas — Referencia vs Supabase

Fecha: 2026-03-31
Familia: **Telas Planas PWA**
Part number Supabase: 21-8909 (header AMFE/CP/PFD/HO) / 21-9463 (familia en landing)
Part number referencia: 21-6567 (TELA ENCOSTO DELANTERO, Rev F)

**NOTA:** La referencia (PdC 21-6567 Rev F) usa NPR (sistema viejo). Nosotros usamos AP (AIAG-VDA 2019). NO se comparan valores NPR — solo estructura.
**NOTA:** Los valores numericos pueden estar desactualizados en la referencia. Se reportan discrepancias para que Fak decida.
**NOTA:** El part number en Supabase (21-8909) NO coincide con el de la familia (21-9463) ni con la referencia (21-6567). Esto requiere clarificacion.

---

## Fuentes

| Tipo | Documento referencia | Documento Supabase |
|------|---------------------|--------------------|
| AMFE | No hay AMFE de referencia para 21-6567 | AMFE PWA/TELAS_PLANAS (12 operaciones, 41 FM) |
| PC | PdC 21-6567 PLAN DE CONTROL - Rev F (13/6/2025) | CP-TELAS-PLANAS-001 (50 items) |
| PFD | No hay PFD de referencia | PFD Telas Planas PWA - HILUX 581D (17 pasos) |
| HO | No hay HO de referencia | HO Telas Planas (12 sheets, 3 QC items) |

---

## 3A — Operaciones

### Referencia (PdC 21-6567 Rev F)

| OP Ref | Nombre referencia |
|--------|-------------------|
| 10 | Recepcion de materiales |
| 15 | Control de apilado de punzonado |
| Set-up | Preparacion de corte (Maq. cortadora BMA 089/1) |
| 20 | Corte (Maquina BMA 089) |
| 30 | Costura |
| 40 | Pegado de Aplix |
| 50 | Inspeccion final |
| Test Lay Out | Control Dimensional (anual, laboratorio) |
| 70 | Embalaje |

### Supabase (AMFE — 12 operaciones)

| OP Sub | Nombre Supabase |
|--------|-----------------|
| 10 | RECEPCION DE MATERIA PRIMA |
| 10b | RECEPCION DE PUNZONADO CON BI-COMPONENTE |
| 10d | COLOCADO DE APLIX |
| 20 | CORTE DE COMPONENTES |
| 20b | HORNO |
| 21 | CORTE POR MAQUINA, BLANK DE PIEZAS LATERALES |
| 30 | PREPARACION DE KITS DE COMPONENTES |
| 40 | COSTURA RECTA |
| 50 | TROQUELADO DE REFUERZOS |
| 60 | TROQUELADO DE APLIX |
| 70 | PEGADO DE DOTS APLIX |
| 80 | CONTROL FINAL DE CALIDAD |

### Supabase (PFD — 17 pasos)

| OP Sub | Nombre PFD | Tipo |
|--------|------------|------|
| 10 | RECEPCION DE MATERIA PRIMA | storage |
| — | INSPECCION DE MATERIA PRIMA | inspection |
| — | ALMACENADO EN SECTOR DE MP CONTROLADA | storage |
| 15 | PREPARACION DE CORTE | operation |
| 20 | CORTE DE COMPONENTES | operation |
| 25 | CONTROL CON MYLAR | inspection |
| 30 | PREPARACION DE KITS DE COMPONENTES | operation |
| 40 | COSTURA RECTA | operation |
| 50 | TROQUELADO DE REFUERZOS | operation |
| 60 | TROQUELADO DE APLIX | operation |
| 70 | PEGADO DE DOTS APLIX | operation |
| 80 | CONTROL FINAL DE CALIDAD | inspection |
| 90 | PRODUCTO CONFORME? | decision |
| 95 | CLASIFICACION Y SEGREGACION DE PNC | operation |
| 100 | REPROCESO (ELIMINACION HILO / REUBICACION APLIX / CORRECCION COSTURA) | operation (rework) |
| 110 | EMBALAJE Y ETIQUETADO DE PT | operation |
| — | ALMACENAMIENTO PT (FIFO) | storage |

### Tabla comparativa de operaciones

| Concepto referencia | OP Ref | OP Sub AMFE | OP Sub PFD | Status |
|---------------------|--------|-------------|------------|--------|
| Recepcion de materiales | 10 | 10 | 10 | MATCH |
| — | — | 10b | — | **SOLO EN AMFE** (OP 10b no esta en PFD) |
| — | — | 10d | — | **SOLO EN AMFE** (OP 10d no esta en PFD) |
| — | — | 20b | — | **SOLO EN AMFE** (OP 20b no esta en PFD) |
| — | — | 21 | — | **SOLO EN AMFE** (OP 21 no esta en PFD) |
| Control de apilado de punzonado | 15 | — | 15 (PREPARACION DE CORTE) | **NOMBRE DISTINTO** — ref: apilado de punzonado, PFD: preparacion de corte. FALTA en AMFE. |
| Preparacion de corte (Set-up) | Set-up | — | 15 | **PARCIAL** — ref tiene set-up como seccion separada con 3 controles. PFD solo tiene nombre. FALTA en AMFE. |
| Corte (Maquina BMA 089) | 20 | 20 | 20 | MATCH |
| — | — | — | 25 (CONTROL CON MYLAR) | **SOLO EN PFD** — inspeccion con mylar no esta en AMFE ni en referencia como OP separada. Referencia lo incluye como control dentro de OP 20. |
| Costura | 30 | 40 (COSTURA RECTA) | 40 | **NUMERO DISTINTO** — ref OP 30, Supabase OP 40 |
| Pegado de Aplix | 40 | 70 (PEGADO DE DOTS APLIX) | 70 | **NUMERO DISTINTO** — ref OP 40, Supabase OP 70 |
| Inspeccion final | 50 | 80 (CONTROL FINAL DE CALIDAD) | 80 | **NUMERO DISTINTO** — ref OP 50, Supabase OP 80 |
| Test de Lay Out | Test Lay Out | — | — | **FALTA EN SUPABASE** |
| Embalaje | 70 | — | 110 | **FALTA EN AMFE** — PFD tiene OP 110 pero AMFE no tiene operacion de embalaje. Los FM de embalaje estan en AMFE OP 80 (Control Final). |
| — | — | 21 | — | **SOLO EN AMFE** — Corte de laterales no esta en PFD ni en referencia como OP separada |
| — | — | 30 (PREPARACION DE KITS) | 30 | **NUEVA** — No existe en referencia |
| — | — | 50 (TROQUELADO DE REFUERZOS) | 50 | **NUEVA** — No existe en referencia. FM son de perforado (de la referencia). |
| — | — | 60 (TROQUELADO DE APLIX) | 60 | **NUEVA** — No existe en referencia. FM son de soldadura (de la referencia). |

**RESUMEN OPERACIONES:**
- **FALTAN EN SUPABASE:** Preparacion de corte / Control de apilado (OP 15 ref), Test de Lay Out, Embalaje como operacion separada en AMFE
- **OPERACIONES EN AMFE SIN PFD:** 10b, 10d, 20b, 21 (4 operaciones del AMFE no estan representadas en el PFD)
- **OPERACIONES EN PFD SIN AMFE:** 15 (Preparacion de corte), 25 (Control con Mylar), 110 (Embalaje)
- **NUMERACION ATIPICA:** Se usan numeros con letras (10b, 10d, 20b) — fuera de la convencion de numeracion secuencial (10, 20, 30...)

---

## 3B — Materiales en recepcion

### Referencia (PdC 21-6567)

| # | Material | Especificacion | Evaluacion |
|---|----------|----------------|------------|
| 1 | Tela TNT 140 | 140 gr/m2 +/- 10% | Balanza electronica |
| 2 | Tela TNT (ancho) | 2000 mm +/- 20 mm | Cinta metrica |
| 3 | Tela TNT (flamabilidad) | < 100 mm/min | Camara de flamabilidad |
| 4 | Hilo (tipo) | Hilo poliester texturizado | Visual |
| 5 | Hilo (color) | Blanco | Visual / Patron |
| 6 | Aplix (espesor) | 0,8 +/- 0,1 | Calibre |

### Supabase (AMFE + CP combinados)

| Material | FM/Control | Especificacion | Status vs referencia |
|----------|-----------|----------------|---------------------|
| Tela principal (Gramaje) | Gramaje Mayor/Menor a TBD | Pendiente confirmacion | **TBD** — ref dice 140 gr/m2 +/- 10% |
| Tela principal (Ancho) | Ancho distinto a 2m | Segun especificacion | MATCH parcial — ref dice 2000 mm +/- 20 mm |
| Tela principal (Flamabilidad) | TBD (CC) | TBD | **TBD** — ref dice < 100 mm/min |
| Punzonado bi-componente (Gramaje) | Gramaje Mayor a TBD | Pendiente confirmacion | **MATERIAL NUEVO** — no en referencia |
| Punzonado bi-componente (Flamabilidad) | TBD (CC) | TBD | **MATERIAL NUEVO** — no en referencia |
| APLIX Metal Resin | Fuera de espec (adhesion, dimensiones) | TBD | **DISTINTO** — ref controla espesor 0,8 +/- 0,1, Supabase controla adhesion y dimensiones generico |
| Hilo Caiman 120 | Fuera de espec (titulo, color, resistencia) | Poliester 120, blanco | MATCH parcial — ref dice "poliester texturizado blanco" |
| Hilo poliester texturizado | Fuera de espec (titulo, resistencia) | Poliester texturizado blanco | MATCH |
| Refuerzo TBD (x2) | Fuera de espec (gramaje, dimension) | TBD | **NUEVO** — no existe en referencia |

**DISCREPANCIAS:**
1. Referencia especifica 6 materiales con valores concretos. Supabase tiene 9+ items pero con muchos valores TBD.
2. Hilo: referencia controla tipo y color. Supabase separa en 2 hilos (Caiman 120 y poliester texturizado).
3. Aplix: referencia controla espesor (0,8 +/- 0,1). Supabase controla adhesion y dimensiones sin valores concretos.
4. Flamabilidad: referencia dice "< 100 mm/min" y clasifica como "D". Supabase dice "TBD" con CC.

---

## 3C — Failure modes por operacion

| Operacion | FM Referencia (inferidos del PdC) | FM Supabase (AMFE) | Status |
|-----------|----------------------------------|---------------------|--------|
| OP 10 Recepcion | Gramaje, Ancho, Flamabilidad de TNT; Tipo/Color de Hilo; Espesor de Aplix (6 controles) | 9 FM: Gramaje mayor/menor TBD, Ancho distinto 2m, TBD flamabilidad CC, APLIX fuera espec, Hilo Caiman 120, Hilo poliester, Refuerzo TBD x2 | **PARCIAL** — Supabase tiene mas items (incluye bi-componente y refuerzos) pero con muchos TBD |
| OP 10b Recepcion bi-componente | No existe | 2 FM: Gramaje Mayor TBD (S=7), TBD flamabilidad CC (S=10) | **NUEVO EN SUPABASE** |
| OP 15 Control apilado / Prep corte | Alineacion entre pilones (1 control) | — | **FALTA EN SUPABASE** |
| Set-up Corte | Capas, Largo material, Hoja set-up (3 controles) | — | **FALTA EN SUPABASE** como seccion separada |
| OP 20 Corte | Programa+parametros, Capas, Cuchilla, Diametro agujeros, Forma, Aspecto (6 controles) | 3 FM: Agujeros O4 menor a 17, Orificios fuera posicion, Material distinto | **PARCIAL** — ref tiene 6 controles con set-up. Supabase tiene 3 FM sin set-up |
| OP 21 Corte laterales | No existe | 1 FM: TBD (S=7) | **NUEVO EN SUPABASE** — FM es solo "TBD" |
| OP 30 Costura (ref) / OP 40 Costura Recta (sub) | Aspecto costura, Aguja N16 (2 controles + 10 controles detallados) | 3 FM: Corte desprolijo, Corte perimetral incompleto, Orientacion incorrecta tela | **MUY DIFERENTE** — ref tiene 12 controles detallados de costura. Supabase tiene FM de **corte** (no costura) bajo nombre "COSTURA RECTA" |
| OP 10d Colocado Aplix | — | 2 FM: Menos de 9 aplix, Aplix posicion incorrecta | **NUEVO EN SUPABASE** |
| OP 20b Horno | — | 2 FM: Temperatura 150C +/-20C, Calentamiento no uniforme | **NUEVO EN SUPABASE** |
| OP 30 Prep Kits (sub) | — | 4 FM: Termoformado desprolijo/incompleto/roturas, Pieza con roturas | **CONTENIDO INCONGRUENTE** — nombre dice "Prep Kits" pero FM son de termoformado |
| OP 40 Pegado Aplix (ref) / OP 70 Pegado Dots (sub) | Aspecto posicion y cantidad (35 aplix correctos) | 3 FM: Aplix mayor/menor a 9, 10 puntos soldadura, Pieza desunida | **DIFERENTE** — ref: 35 aplix. Sub: 9 aplix + 10 puntos soldadura (de otra operacion) |
| OP 50 Inspeccion final (ref) / OP 80 Control Final (sub) | 35 aplix correctos (1 control) | 4 FM: Mayor/menor 25 piezas, Error/falta identificacion | **MUY DIFERENTE** — ref controla aspecto final. Supabase tiene FM de embalaje |
| OP 50 Troquelado Refuerzos (sub) | — | 4 FM: Menos de 9 agujeros, Agujeros desprolija, No pasante, Arrastres | **CONTENIDO INCONGRUENTE** — nombre dice "Troquelado Refuerzos" pero FM son de perforado (OP 50 ref Telas Termo) |
| OP 60 Troquelado Aplix (sub) | — | 4 FM: Piezas distintas, Mas/menos 5 puntos soldadura, No union | **CONTENIDO INCONGRUENTE** — nombre dice "Troquelado Aplix" pero FM son de soldadura (OP 60 ref Telas Termo) |
| Test de Lay Out | Cota 1 (782mm), Cota 2 (866mm), 40 agujeros 4mm (3 controles lab) | — | **FALTA EN SUPABASE** |
| OP 70 Embalaje (ref) | Identificacion, Cantidad 50 por medio | — | **FALTA EN AMFE** — FM de embalaje estan en OP 80 pero con 25 pzs en vez de 50 |

**RESUMEN FM:**
- Referencia: ~28 controles (incluyendo set-up y test de lay out)
- Supabase AMFE: 41 failure modes en 12 operaciones
- **HALLAZGO CRITICO:** Los FM de las operaciones 30-70 del AMFE Supabase NO corresponden a los nombres de las operaciones. Los FM parecen copiados del AMFE de Telas Termoformadas (referencia 148) en vez de reflejar el proceso real de Telas Planas.

---

## 3D — Controles CP

| Control referencia (PdC 21-6567) | Control Supabase (CP) | Status |
|----------------------------------|----------------------|--------|
| Gramaje TNT 140 g/m2 +/- 10% (Balanza, 1 muestra, por entrega) | Gramaje Mayor/Menor a TBD (Certificado, 1 cert, cada recepcion) | **VALOR TBD** — ref tiene valor concreto |
| Ancho TNT 2000 mm +/- 20 mm (Cinta metrica, 1 muestra, por entrega) | Ancho distinto a 2m (Certificado, 1 cert, cada recepcion) | MATCH parcial — metodo distinto (ref: cinta metrica, sub: certificado) |
| Flamabilidad TNT < 100 mm/min, clasif D (Camara flamabilidad, 1 muestra, por entrega) | TBD, clasif CC (Recepcion materiales, 1 cert, cada recepcion) | **VALOR TBD** — clasif ref: D, sub: CC |
| Hilo poliester texturizado (Visual, 1 muestra) | Hilo Caiman 120 fuera espec + Hilo poliester texturizado fuera espec (Certificado) | MATCH parcial — sub separa en 2 controles |
| Color hilo blanco (Visual/Patron) | Incluido en control de hilo | MATCH parcial |
| Espesor Aplix 0,8 +/- 0,1 (Calibre, 1 muestra) | APLIX Metal Resin fuera espec adhesion/dimensiones (Certificado) | **DISTINTO** — ref: espesor con calibre; sub: adhesion/dimensiones con certificado |
| Alineacion pilones (Visual, N/A, por lote) | — | **FALTA EN SUPABASE** |
| Tender 30 capas (Visual, 100%, por lote) | — | **FALTA EN SUPABASE** |
| Largo material segun tizada (Regla MC N 334) | — | **FALTA EN SUPABASE** |
| Hoja de set-up (Visual, inicio turno) | — | **FALTA EN SUPABASE** |
| Set-up: Programa + parametros (Visual, 100%, por lote) | Programacion equivocada (Control inicio/fin turno) | MATCH parcial |
| Set-up: Cantidad capas 30 (Visual, 1 control, inicio turno) | — | **FALTA EN SUPABASE** |
| Set-up: Cuchilla min 4mm (Calibre Vernier) | — | **FALTA EN SUPABASE** |
| Diametro 40 agujeros de 4 +/- 0,5 mm (Pieza patron, inicio turno) | Agujeros O4 menor a 17 por pieza | **DISCREPANCIA** — ref: 40 agujeros. Sub: 17 agujeros. |
| Control de forma con Mylar MC344/MC3886 (Inspector calidad) | — | **FALTA EN SUPABASE** (PFD tiene OP 25 Control con Mylar pero AMFE/CP no) |
| Aspecto/Apariencia (Pieza patron, inspector calidad) | — | **FALTA EN SUPABASE** |
| Costura: Aspecto + Aguja N16 + 10 controles detallados (Visual/Patron, inicio turno) | Costura: 3 FM de corte (no costura) + 1 orientacion | **MUY DIFERENTE** — ref tiene 12 controles de costura. Sub tiene FM de corte. |
| Pegado Aplix: 35 aplix posicion correcta (Pieza patron) | Pegado Dots: 9 aplix + 10 puntos soldadura | **DISCREPANCIA** — ref: 35 aplix. Sub: 9 aplix (de Telas Termo) |
| Inspeccion final: 35 aplix (Pieza patron, inspector calidad) | Control Final: 4 FM de embalaje | **MUY DIFERENTE** — ref: inspeccion final de producto. Sub: embalaje |
| Cota 1: 782 mm +/- 3 (Cinta metalica, 5 pzs, anual, lab) | — | **FALTA EN SUPABASE** |
| Cota 2: 866 mm +/- 3 (Cinta metalica, 5 pzs, anual, lab) | — | **FALTA EN SUPABASE** |
| 40 agujeros 4 +/- 0,5 mm (Calibre Vernier, 5 pzs, anual, lab) | — | **FALTA EN SUPABASE** |
| Embalaje: Identificacion segun ARB (Visual, 1 medio, fin turno) | Error/Falta identificacion (Autocontrol/Audit, 3 pzs, cada contenedor) | MATCH parcial |
| Embalaje: Cantidad 50 por medio (Visual, 1 medio, fin turno) | Mayor/menor 25 piezas por medio (Autocontrol/Audit, 3 pzs, cada contenedor) | **DISCREPANCIA** — ref: 50 pzs/medio. Sub: 25 pzs/medio. |

**RESUMEN:**
- Referencia: ~25 controles con valores concretos, metodos de evaluacion especificos, responsables claros.
- Supabase: 50 items CP pero muchos con valores TBD, especificaciones genericas, y FM que no corresponden al proceso de Telas Planas.
- **Faltan en Supabase:** Set-up completo (4 controles), Control de apilado, Control de forma con Mylar, Aspecto general, Costura detallada (12 controles), Test de Lay Out (3 ensayos), controles de inspeccion final real.
- **CC/SC en CP:** 4 items CC (flamabilidad x2, material fuera espec x2), 5 items SC (termoformado x3, costura x2). Ref solo clasifica flamabilidad como "D".

---

## 3E — Operaciones de retrabajo

| Retrabajo | En referencia? | En Supabase AMFE? | En Supabase PFD? |
|-----------|---------------|-------------------|-----------------|
| Eliminacion de hilo sobrante | NO | NO | SI (OP 100 consolidado) |
| Reubicacion de aplix | NO | NO | SI (OP 100 consolidado) |
| Correccion de costura | NO | NO | SI (OP 100 consolidado) |

**NOTA:** La referencia no tiene operaciones de retrabajo documentadas. El PFD Supabase tiene un unico paso de reproceso consolidado (OP 100) con 3 tipos de retrabajo, precedido por decision (OP 90) y segregacion (OP 95). El AMFE no tiene analisis de riesgo para ningun retrabajo.

---

## 3F — Discrepancias de valores numericos

**IMPORTANTE: Fak debe decidir cual valor es correcto. Los valores de referencia pueden estar desactualizados.**

| Parametro | Valor referencia | Valor Supabase | Donde |
|-----------|-----------------|----------------|-------|
| Gramaje tela TNT | 140 g/m2 +/- 10% | TBD | Recepcion |
| Ancho tela TNT | 2000 mm +/- 20 mm | 2m (sin tolerancia) | Recepcion |
| Flamabilidad | < 100 mm/min | TBD | Recepcion |
| Espesor Aplix | 0,8 +/- 0,1 | TBD (adhesion/dimensiones) | Recepcion |
| Hilo tipo | Poliester texturizado | Hilo Caiman 120 + Hilo poliester texturizado (2 hilos) | Recepcion |
| Cantidad de agujeros en corte | 40 agujeros de 4 +/- 0,5 mm | 17 agujeros de O4 | Corte |
| Cantidad de aplix | 35 unidades | 9 unidades | Pegado de Aplix |
| Cantidad puntos soldadura | No aplica (no hay soldadura en ref) | 5 por extremo (10 total) | Soldadura (solo en Supabase) |
| Largo puntada costura | 4 mm en 16 mm +/- 1 | No especificado | Costura |
| Aguja costura | N 16 | No especificado | Costura |
| Cantidad capas corte | 30 capas | No especificado | Set-up corte |
| Ancho cuchilla corte | Minimo 4 mm | No especificado | Set-up corte |
| Cantidad pzs por medio embalaje | 50 piezas | 25 piezas | Embalaje |
| Temperatura horno | No aplica (no hay horno en ref) | 150C +/- 20C | Horno (solo en Supabase) |
| Cota 1 dimensional | 782 mm +/- 3 | No especificado | Test Lay Out |
| Cota 2 dimensional | 866 mm +/- 3 | No especificado | Test Lay Out |

**DISCREPANCIA CRITICA — Cantidad de agujeros:** Referencia dice 40, Supabase dice 17. Estos son numeros muy distintos que cambian todo el proceso de corte.
**DISCREPANCIA CRITICA — Cantidad de aplix:** Referencia dice 35, Supabase dice 9. Parece que los datos de Supabase son de Telas Termoformadas.

---

## Verificaciones adicionales (problemas detectados en Telas Termo)

### FM con descripcion solo "TBD"

| OP | FM | Severidad | Tiene contexto? |
|----|----|-----------|----------------|
| 10 | TBD | S=9, CC | NO — solo "TBD" sin mas contexto. El controlMethod del CP dice "Ensayo de flamabilidad" asi que se infiere que es flamabilidad, pero el FM deberia decirlo. |
| 10b | TBD | S=10, CC | NO — identico al anterior. Se infiere flamabilidad. |
| 21 | TBD | S=7 | NO — solo "TBD" sin ningun contexto. No se puede inferir que falla representa. |

**3 FM con descripcion solo "TBD".** Los 2 de flamabilidad son inferibles por el CP pero deberian tener descripcion propia. El de OP 21 es completamente opaco.

### focusElementFunction y operationFunction vacios

Todas las 12 operaciones tienen el campo `requirements` (function requirements) VACIO.

### HALLAZGO CRITICO — Work elements y funciones NO corresponden a las operaciones

| OP | Nombre operacion | WE (workElement.name) | Funcion (function.description) | Corresponde? |
|----|------------------|-----------------------|-------------------------------|-------------|
| 10 | RECEPCION DE MATERIA PRIMA | Recepcion de materiales | Recibir y verificar material punzonado | OK |
| 10b | RECEPCION DE PUNZONADO CON BI-COMPONENTE | Recepcion de materiales | Recibir y verificar bi-componente | OK |
| 20 | CORTE DE COMPONENTES | Maquina de corte automatica | Cortar piezas centrales segun especificacion | OK |
| 21 | CORTE POR MAQUINA, BLANK LATERALES | Maquina de corte automatica | Cortar blanks de piezas laterales | OK |
| 10d | COLOCADO DE APLIX | Colocacion manual de aplix | Colocar aplix en posicion y cantidad correcta | OK |
| 20b | HORNO | Horno de calentamiento | Calentar material para termoformado | OK |
| **30** | **PREPARACION DE KITS** | **Termoformadora** | **Termoformar piezas segun especificacion** | **NO** |
| **40** | **COSTURA RECTA** | **Prensa de corte** | **Cortar pieza termoformada en prensa** | **NO** |
| **50** | **TROQUELADO DE REFUERZOS** | **Perforadora** | **Perforar piezas laterales con 9 agujeros** | **NO** |
| **60** | **TROQUELADO DE APLIX** | **Soldadura por puntos** | **Unir piezas mediante soldadura** | **NO** |
| **70** | **PEGADO DE DOTS APLIX** | **Inspeccion visual y control dimensional** | **Verificar conformidad pieza terminada** | **NO** |
| **80** | **CONTROL FINAL DE CALIDAD** | **Embalaje e identificacion** | **Embalar y rotular producto terminado** | **NO** |

**6 de 12 operaciones** tienen WE y funciones que NO corresponden al nombre de la operacion. Los WE y funciones describen el proceso viejo (termoformado, prensa, perforado, soldadura) mientras que los nombres de operacion fueron actualizados a un proceso nuevo (costura, troquelado, pegado). Esto indica que se renombraron las operaciones pero no se actualizaron los work elements ni las funciones.

### Flamabilidad con clasificacion CC

- AMFE: 2 FM de flamabilidad (OP 10 y OP 10b) tienen CC en `specialChar` de la causa.
- CP: 4 items con CC — 2 son de flamabilidad (TBD), 2 son "Material fuera de especificacion" con S=10 y AP=H.
- Referencia: Clasifica flamabilidad como "D" (no CC).
- **Flamabilidad tiene CC en Supabase** pero la descripcion del FM es solo "TBD".

### Formato de fechas

| Documento | Campo | Valor | Formato correcto? |
|-----------|-------|-------|-------------------|
| AMFE header | startDate | 2022-10-31 | SI (YYYY-MM-DD) |
| AMFE header | revDate | 2024-12-02 | SI (YYYY-MM-DD) |
| CP header | date | 2026-03-17 | SI (YYYY-MM-DD) |
| PFD header | revisionDate | 2026-03-17 | SI (YYYY-MM-DD) |

Fechas en formato correcto.

### Numeracion con letras (10a/10b/10c)

Operaciones con letras en el AMFE, CP y HO: **10b, 10d, 20b**. No hay 10a, 10c, 20a. La numeracion no es secuencial — va 10, 10b, 10d, 20, 20b, 21 lo cual es confuso.

El PFD NO tiene estas operaciones (10b, 10d, 20b, 21). Solo usa numeracion secuencial: 10, 15, 20, 25, 30, 40...

### Transporte y almacenamiento WIP en PFD

- **Transporte:** NO hay ningun paso de transporte en el PFD.
- **Almacenamiento WIP:** NO hay ningun paso de almacenamiento intermedio. Solo almacen de MP controlada al inicio y PT (FIFO) al final.

### AMFE y PFD con las mismas operaciones?

**NO.** Hay asimetria significativa:

| En AMFE pero NO en PFD | En PFD pero NO en AMFE |
|------------------------|------------------------|
| 10b: RECEPCION DE PUNZONADO CON BI-COMPONENTE | 15: PREPARACION DE CORTE |
| 10d: COLOCADO DE APLIX | 25: CONTROL CON MYLAR |
| 20b: HORNO | 90: PRODUCTO CONFORME? |
| 21: CORTE POR MAQUINA, BLANK LATERALES | 95: CLASIFICACION Y SEGREGACION PNC |
| | 100: REPROCESO |
| | 110: EMBALAJE Y ETIQUETADO PT |

4 operaciones del AMFE no estan en el PFD. 6 pasos del PFD (incluyendo decision, segregacion y reproceso) no estan en el AMFE.

---

## Conclusiones

### Hallazgo principal: AMFE de Telas Planas es un hibrido incorrecto

El AMFE de Telas Planas en Supabase contiene datos mezclados de dos fuentes:
1. **Operaciones 10-21** (recepcion, corte, aplix, horno): Datos que parecen provenir de la referencia 21-6567 (Tela Encosto) adaptada parcialmente.
2. **Operaciones 30-80**: Los nombres fueron actualizados (Prep Kits, Costura, Troquelado, Pegado Dots) pero los **work elements**, **funciones** y **failure modes** siguen describiendo el proceso de Telas Termoformadas (termoformado, prensa, perforado, soldadura).

Esto genera un documento donde:
- OP 40 se llama "COSTURA RECTA" pero sus FM dicen "Corte desprolijo" y "Corte perimetral incompleto"
- OP 50 se llama "TROQUELADO DE REFUERZOS" pero sus FM dicen "Apertura de menos de 9 agujeros"
- OP 60 se llama "TROQUELADO DE APLIX" pero sus FM hablan de "5 puntos de soldadura"
- OP 80 se llama "CONTROL FINAL" pero sus FM son de embalaje (25 piezas por medio)

### Diferencias estructurales mayores

1. **Part number inconsistente:** Header dice 21-8909, familia dice 21-9463, referencia es 21-6567.

2. **Operaciones del AMFE no reflejan el proceso real:** 6 de 12 operaciones tienen WE y funciones que no corresponden al nombre.

3. **AMFE vs PFD desalineados:** 4 operaciones del AMFE no estan en el PFD, y 6 pasos del PFD no estan en el AMFE.

4. **Valores criticos TBD:** Gramaje, flamabilidad, y especificaciones de materiales sin valores concretos.

5. **Cantidades inconsistentes con referencia:** 17 agujeros vs 40, 9 aplix vs 35, 25 pzs/medio vs 50.

6. **FM sin contexto:** 3 failure modes con descripcion solo "TBD".

7. **Test de Lay Out falta:** 3 ensayos dimensionales anuales de laboratorio no existen en Supabase.

8. **Costura no tiene controles propios:** La referencia tiene 12 controles detallados de costura. Supabase no tiene ningun FM de costura real.

9. **Set-up de corte falta:** La referencia tiene 4 controles de set-up (capas, largo, cuchilla, hoja). Supabase no los tiene.

10. **HO con solo 3 QC items:** De 12 sheets, solo la OP 10 tiene items de control de calidad vinculados. Las otras 11 sheets tienen 0 QC items.

11. **PPE vacio en todas las HO:** Ninguna de las 12 sheets tiene EPP asignado.

12. **Sin pasos de transporte ni WIP en PFD.**

### Para decision de Fak

- Confirmar si 21-6567, 21-8909 y 21-9463 son el mismo producto o distintos.
- Confirmar cantidad real de agujeros en corte (40 ref vs 17 Supabase).
- Confirmar cantidad real de aplix (35 ref vs 9 Supabase).
- Confirmar cantidad real por medio de embalaje (50 ref vs 25 Supabase).
- Confirmar si el proceso incluye horno/termoformado/soldadura (como sugieren los WE del AMFE) o costura/troquelado/pegado (como dicen los nombres de las operaciones).
- Definir valores concretos para gramaje, flamabilidad y especificaciones TBD.
- Decidir si el AMFE debe rehacerse completamente para reflejar el proceso real.
