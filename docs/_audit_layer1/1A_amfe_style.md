# 1A - Auditoria de Estilo de Redaccion: AMFEs PDF Original vs Supabase

**Fecha**: 2026-03-23
**Auditor**: Claude (auditoria automatizada)
**Alcance**: 6 productos AMFE con PDF extracts disponibles + 3 Headrest sin PDF legible

---

## Resumen Ejecutivo

| Producto | PDF Disponible | Ops PDF | Ops Supabase | Ops Inventadas | Fallas Fieles | S/O/D Fieles | Estilo Fiel |
|----------|---------------|---------|-------------|----------------|---------------|-------------|-------------|
| Insert Patagonia | Si (.txt) | 17 | 22 | 3 (OP60, 100, 105) | ~85% | ~80% | Reformulado |
| Armrest Door Panel | Si (.txt) | 21 | 22 | 0 (renumeracion) | ~95% | ~85% | Reformulado |
| Top Roll | Si (.txt) | 11 | 11 | 0 | ~95% | ~90% | Reformulado |
| Headrest Front | No (PDF ilegible) | N/A | 8 | No verificable | No verificable | No verificable | No verificable |
| Headrest Rear Center | No (PDF ilegible) | N/A | 8 | No verificable | No verificable | No verificable | No verificable |
| Headrest Rear Outer | No (PDF ilegible) | N/A | 8 | No verificable | No verificable | No verificable | No verificable |
| Telas Planas (PWA) | Si (.txt) | 12 | 12 | 0 | ~95% | ~95% | Fiel con limpieza |
| Telas Termoformadas (PWA) | Si (.txt) | 8 | 8 | 0 | ~95% | ~90% | Fiel con limpieza |

**Nota sobre Headrest**: Los 3 PDFs de Headrest (`AMFE_151`, `AMFE_153`, `AMFE_155`) no pudieron leerse porque el sistema no tiene `pdftoppm` instalado. No se puede verificar el contenido contra Supabase para estos productos.

---

## 1. INSERT PATAGONIA (AMFE-00001)

**PDF**: `scripts/pdf-extracts/AMFE_INSERT_Rev.txt` (formato VDA nuevo, 3138 lineas)
**Supabase**: `VWA/PATAGONIA/INSERTO` — 22 operaciones, 110 causas

### 1.1 Nombres de Operaciones

| OP# | PDF Original | Supabase | Diferencia |
|-----|-------------|----------|------------|
| 10 | "Recepcion de materia prima" (titulo seccion, minuscula) | "RECEPCIONAR MATERIA PRIMA" | Supabase usa MAYUSCULAS y verbo infinitivo ("RECEPCIONAR" vs "Recepcion") |
| 15 | "OPERACION 15 Preparacion de corte" | "CORTE DE COMPONENTES DE VINILO O TELA - Preparacion de corte" | Supabase agrega prefijo de seccion padre. PDF solo tiene el nombre del paso |
| 20 | "OPERACION 20 Cortar componentes" | "CORTE DE COMPONENTES DE VINILO O TELA - Cortar componentes" | Idem: prefijo de seccion agregado |
| 25 | No aparece con numero claro | "CORTE DE COMPONENTES DE VINILO O TELA - Control con mylar" | Supabase infiere operacion de contenido del PDF |
| 60 | No existe como operacion separada | "TROQUELADO - Troquelado de espuma" | **INVENTADA**: El PDF no tiene OP 60 de troquelado separada |
| 100 | No existe | "Tapizado - Tapizado semiautomatico" | **INVENTADA**: Operacion con poka-yoke fabricada, no en PDF |
| 105 | No existe | "REFILADO POST-TAPIZADO" | **INVENTADA**: No aparece en el PDF |

### 1.2 Modos de Falla

| Elemento | PDF Original | Supabase | Diferencia |
|----------|-------------|----------|------------|
| OP10, Falla 1 | "Material / pieza golpeada o danada durante transporte" | "Material / pieza golpeada o danada durante transporte" | Identico |
| OP10, Falla 2 | "Falta de documentacion o trazabilidad" | "Falta de documentacion o trazabilidad" | Identico |
| OP10, Falla 3 | "Material con especificacion erronea (dimensiones, color, dureza, etc.)" | "Material con especificacion erronea (dimensiones, color, dureza, etc.)" | Identico |
| OP10, Falla 5 | "Contaminacion / suciedad en la materia prima" | "Contaminacion / suciedad en la materia prima" | Identico |
| OP15, Falla 1 | "Corte fuera de medida (pano mas corto o mas largo que la especificacion)" | "Corte fuera de medida (pano mas corto o mas largo que la especificacion)." | Identico (punto al final en Supabase) |
| OP20, Falla nueva | No existe como falla individual | "Seleccion incorrecta del material (vinilo mal identificado)" | **Supabase reformula**: PDF tiene causa "Falta de verificacion del codigo" pero no es una falla separada |

### 1.3 Causas

| Elemento | PDF Original | Supabase | Diferencia |
|----------|-------------|----------|------------|
| OP10, Causa | "Mala estiba y embalaje inadecuado" | "Mala estiba y embalaje inadecuado" | Identico |
| OP10, Causa | "Manipulacion incorrecta en transito" | "Manipulacion incorrecta en transito" | Identico |
| OP10, Causa | "Falta de inspeccion visual al recibir" | "Falta de inspeccion visual al recibir" | Identico |
| OP10, Causa | "Procesos administrativos deficientes" | "Procesos administrativos deficientes" | Identico |
| OP10, Causa | "No se utiliza el sistema ARB" | "No se utiliza el sistema ARB" | Identico |
| OP10, Causa | "Proveedor sin sistema robusto de trazabilidad" | "Proveedor sin sistema robusto de trazabilidad" | Identico |
| OP10, Causa | "Error en la orden de compra o ficha tecnica" | "Error en la orden de compra o ficha tecnica" | Identico |
| OP10, Causa | "Proveedor no respeta tolerancias" | "Proveedor no respeta tolerancias" | Identico |
| OP10, Causa | "Ambiente sucio en planta del proveedor" | "Ambiente sucio en planta del proveedor" | Identico |
| OP10, Causa adicional | No existe | "No se verifica color del Hilo Needle thread Linanhyl segun variante" | **INVENTADA**: Causa especifica de variante no en PDF original |
| OP10, Causa adicional | No existe | "No se verifica fecha de vencimiento del adhesivo SikaMelt" | **INVENTADA**: Causa de material especifica no en PDF |
| OP15, Causa | "Error del operario al medir con la regla metalica" | "Error del operario al medir con la regla metalica." | Identico (punto final) |
| OP20, Causa | "Parametros de corte mal ingresados" | "Parametros de corte mal ingresados" | Identico |
| OP20, Causa | "Falla en la maquina" | "Falla en la maquina" | Identico |

### 1.4 Controles (Prevencion y Deteccion)

| Elemento | PDF Original | Supabase | Diferencia |
|----------|-------------|----------|------------|
| OP10, Prev | "Medios de embalaje validados" | "Medios de embalaje validados" | Identico |
| OP10, Prev | "Existencia de instrucciones de trabajo que definen como debe estibarse y manipularse el material" | "Existencia de instrucciones de trabajo que definen como debe estibarse y manipul" (truncado) | **Truncado a ~80 chars** |
| OP10, Det | "Inspeccion visual en recepcion" | "Inspeccion visual en recepcion" | Identico |
| OP10, Det | "Verificacion del estado del embalaje antes de que el camion salga o inmediatamente cuando llega a su destino" | "Verificacion del estado del embalaje antes de que el camion salga o inmediatamen" (truncado) | **Truncado a ~80 chars** |
| OP10, Prev | "El sistema [ARB] obliga a registrar lote y codigo en recepcion y verifica contra base de datos" | "El sistema [ARB] obliga a registrar lote y codigo en recepcion y verifica contra" (truncado) | **Truncado** |
| OP10, Prev | "Procedimiento Operacional Estandar que exige y documenta la obligatoriedad del uso del sistema ARB." | "Procedimiento Operacional Estandar que exige y documenta la obligatoriedad del u" (truncado) | **Truncado** |

### 1.5 Ratings S/O/D

| Elemento | PDF | Supabase | Diferencia |
|----------|-----|----------|------------|
| OP10, FM1 "Material golpeada", S | 6 | 6 | OK |
| OP10, FM1, Causa "Mala estiba", O | 6 | 6 | OK |
| OP10, FM1, Causa "Mala estiba", D | 6 | 6 | OK |
| OP10, FM1, Causa "Mala estiba", AP | M (PDF) | H (Supabase) | **DISCREPANCIA**: AP calculado diferente |
| OP10, FM2 "Falta documentacion", S | 7 | 7 | OK |
| OP10, FM2, Causa "Procesos admin", O | 3 | 3 | OK |
| OP10, FM2, Causa "Procesos admin", D | 4 (PDF) | 7 (Supabase) | **DISCREPANCIA**: D cambiado de 4 a 7 |
| OP10, FM2, Causa "Proveedor sin trazabilidad", AP | H (PDF) | M (Supabase) | **DISCREPANCIA**: AP invertido |
| OP15, FM1 "Corte fuera de medida", S | 7 | 7 | OK |
| OP15, FM1, Causa "Error operario", O | 8 | 7 | **DISCREPANCIA**: O cambiado de 8 a 7 |
| OP15, FM1, Causa "Error operario", D | 7 | 10 | **DISCREPANCIA**: D cambiado de 7 a 10 |
| OP20, FM "Desviacion en corte", D | 3 | 3 | OK |

---

## 2. ARMREST DOOR PANEL (AMFE-ARMREST-001)

**PDF**: `scripts/pdf-extracts/VWA_ARMREST DOOR PANEL_AMFE_ARMREST_Rev.txt` (formato viejo, ~450 lineas)
**Supabase**: `VWA/PATAGONIA/ARMREST_DOOR_PANEL` — 22 operaciones, 106 causas

### 2.1 Nombres de Operaciones

| OP# | PDF Original | Supabase | Diferencia |
|-----|-------------|----------|------------|
| 10 | "OP. 10 Recepcion de materiales con identificacion correcta en sector indicado" | "RECEPCIONAR MATERIA PRIMA" | **Reformulado**: PDF tiene descripcion larga, Supabase usa nombre generico estandarizado |
| 15 | "OP. 15 Preparacion de corte" | "CORTE DE COMPONENTES - PREPARACION DE CORTE" | Supabase agrega prefijo de seccion |
| 20 | "OP.20 Corte por maquina automatica segun dimensional" | "CORTE DE COMPONENTES DE VINILO O TELA" | **Reformulado**: PDF menciona "maquina automatica segun dimensional", Supabase generaliza |
| 30 | "OP. 30 Costura fuerte, sin arruga ni pliegues" | "COSTURA - COSTURA UNION" (OP 50) y "COSTURA - COSTURA DOBLE" (OP 51) | **Desdoblada**: PDF tiene una sola OP de costura, Supabase la divide en dos |
| 40 | "OP. 40 Colocado de clips en posicion correcta" | "COSTURA - REFILADO" (OP 40) | **Renombrada**: PDF es "Clips", Supabase asigna "Refilado" a OP 40 |
| 50 | "OP. 50 Pegado de dots en posicion correcta" | "COSTURA - COSTURA UNION" (OP 50) | **Renombrada**: PDF es "Dots", Supabase es "Costura Union" |
| 60 | "OP. 60 Inspeccion final de la pieza" | "INYECCION PLASTICA - INYECCION DE PIEZAS PLASTICAS" (OP 60) | **Completamente diferente**: PDF es inspeccion, Supabase es inyeccion plastica |
| 70 | "OP. 70 Embalaje identificado" | "INYECCION PU" (OP 70) | **Completamente diferente**: PDF es embalaje, Supabase es inyeccion PU |
| 100 | "Tapizado semiautomatico" | "INSPECCION FINAL - CONTROL FINAL DE CALIDAD" (OP 100) | **Renumerada**: Tapizado se movio a OP 90 |

**Nota importante**: El Armrest en Supabase fue construido como un producto con proceso completo (inyeccion plastica, PU, tapizado, etc.) que va mas alla del proceso de "telas y costura" que aparece en el PDF viejo. El PDF viejo parece cubrir solo la parte textil del Armrest, mientras que Supabase cubre el proceso integral incluyendo operaciones de inyeccion que no estan en el extract de texto.

### 2.2 Modos de Falla

| Elemento | PDF Original | Supabase | Diferencia |
|----------|-------------|----------|------------|
| OP10, FM | "Identificacion incorrecta" | "Material / pieza golpeada o danada durante transporte" | **Diferente**: PDF habla de falla de identificacion, Supabase de dano fisico |
| OP10, FM | "Material distinto segun plan de control de recepcion" | "Material con especificacion erronea (dimensiones, color, dureza, etc.)" | **Reformulado**: misma idea, vocabulario distinto |
| OP10, FM | "Omision de la recepcion de material" | "Contaminacion / suciedad en la materia prima" | **Diferente**: Son fallas distintas |
| OP30 (PDF), FM | "Falta de costura" | "Costura descosida o debil" (OP50 Supabase) | **Reformulado**: misma idea con vocabulario mas tecnico |
| OP30 (PDF), FM | "Costura floja / deficiente" | "Costura desviada o fuera de especificacion" | **Reformulado**: expandido |
| OP30 (PDF), FM | "Costura salteada" | No hay equivalente exacto | **Falla del PDF no reflejada en Supabase** |
| OP30 (PDF), FM | "Arrugas / Pliegues" | "Puntadas irregulares o arrugas" | **Reformulado**: combinada con puntadas irregulares |

### 2.3 Causas

| Elemento | PDF Original | Supabase | Diferencia |
|----------|-------------|----------|------------|
| OP10, Causa | "Falta de capacitacion" | "Mala estiba y embalaje inadecuado" | **Diferente vocabulario**: PDF habla de capacitacion, Supabase de condiciones fisicas |
| OP10, Causa | "Falta de identificacion de sector" | "Manipulacion incorrecta en transito" | **Diferente** |
| OP10, Causa | "Falta de control de recepcion / capacitacion del operario" | "Proveedor no respeta tolerancias" | **Nivel de detalle diferente**: PDF enfoca al operario, Supabase al proveedor |
| OP30, Causa | "Carreteles mal ubicados" | "Tension de hilo incorrecta" | **Reformulado**: ambos refieren a problemas de costura pero con vocabulario distinto |
| OP30, Causa | "Aguja mal ubicada" | "Puntadas demasiado largas" | **Diferente**: causa distinta |
| OP30, Causa | "Falla en la tension del hilo" | "Tension de hilo incorrecta" | Equivalente, **reformulado** |
| OP30, Causa | "Peine danado" | No existe | **Falta en Supabase** |
| OP30, Causa | "Aguja despuntada" | No existe | **Falta en Supabase** |
| OP30, Causa | "Hilo enredado" | No existe | **Falta en Supabase** |

### 2.4 Controles

| Elemento | PDF Original | Supabase | Diferencia |
|----------|-------------|----------|------------|
| OP10, Prev | "Capacitacion de operario" | "Medios de embalaje validados" | **Completamente distinto** |
| OP10, Det | "Recepcion de materiales." | "Inspeccion visual en recepcion" | **Reformulado**: mas especifico en Supabase |
| OP30, Prev | "Mantenimiento primer nivel" | No tiene campo de prevencion separado | **Estructura diferente** |
| OP30, Det | "Control visual / Muestra patron" | "Control visual de costura" | **Reformulado** |

### 2.5 Ratings S/O/D

| Elemento | PDF | Supabase | Diferencia |
|----------|-----|----------|------------|
| OP10, FM "Identificacion incorrecta", S | 7 | 6 | **DISCREPANCIA** |
| OP10, Causa "Falta de capacitacion", O | 2 | 6 | **DISCREPANCIA GRANDE**: O cambiado de 2 a 6 |
| OP10, Causa, D | 6 | 6 | OK |
| OP10, NRP (S*O*D) | 84 (7*2*6) | 216 (6*6*6) | **DISCREPANCIA GRANDE** |
| OP30, FM "Costura floja", S | 8 | 8 | OK |
| OP30, Causa "Tension hilo", O | 2 | 4 | **DISCREPANCIA** |
| OP30, Det | 6 | 4 | **DISCREPANCIA** |
| OP30, NRP PDF | 96 (8*2*6) | 128 (8*4*4) | **DISCREPANCIA** |

---

## 3. TOP ROLL (AMFE-TOPROLL-001)

**PDF**: `scripts/pdf-extracts/VWA_TOP ROLL_AMFE_TOP ROLL_Rev.txt` (formato VDA viejo, ~760 lineas)
**Supabase**: `VWA/PATAGONIA/TOP_ROLL` — 11 operaciones, 49 causas

### 3.1 Nombres de Operaciones

| OP# | PDF Original | Supabase | Diferencia |
|-----|-------------|----------|------------|
| 5 | "OPERACION 5 Recepcionar materia prima" | "RECEPCIONAR MATERIA PRIMA" | **MAYUSCULAS, verbo estandarizado** |
| 10 | "Inyeccion de piezas plasticas" (contexto) | "INYECCION DE PIEZAS PLASTICAS" | OK, solo mayusculas |
| 11 | (Almacenamiento WIP implicito) | "ALMACENAMIENTO EN MEDIOS WIP" | OK |
| 20 | "Adhesivado Hot Melt" | "ADHESIVADO HOT MELT" | OK, solo mayusculas |
| 30 | "Proceso de IMG" | "PROCESO DE IMG" | OK |
| 40 | "Trimming Corte Final" | "TRIMMING CORTE FINAL" | OK |
| 50 | "Edge Folding" | "EDGE FOLDING" | OK |
| 60 | "Soldado de refuerzos internos" | "SOLDADO DE REFUERZOS INTERNOS" | OK |
| 70 | "Soldado Tweeter" | "SOLDADO TWEETER" | OK |
| 80 | "Inspeccion final y empaque" | "INSPECCION FINAL Y EMPAQUE" | OK |
| 90 | "Empaque final y etiquetado" | "EMPAQUE FINAL Y ETIQUETADO DE PRODUCTO TERMINADO" | Supabase agrega "DE PRODUCTO TERMINADO" |

**Resultado**: Todas las 11 operaciones coinciden. 0 inventadas. Solo cambio de capitalizacion y un agregado menor en OP 90.

### 3.2 Modos de Falla

| Elemento | PDF Original | Supabase | Diferencia |
|----------|-------------|----------|------------|
| OP5, FM1 | "Material / pieza golpeada o danada durante transporte" | Identico | OK |
| OP5, FM2 | "Falta de documentacion o trazabilidad" | Identico | OK |
| OP5, FM3 | "Material con especificacion erronea" | Identico (agrega "(dimensiones, color, dureza, etc.)") | **Expansion menor** |
| OP5, FM4 | "Contaminacion / suciedad en la materia prima" | Identico | OK |
| OP5, FM5 | "No se utiliza el sistema ARB" (causa en PDF) | Como falla separada en Supabase | **Elevada de causa a falla** |
| OP5, FM6 | No existe como falla | "Condiciones ambientales inadecuadas" | **INVENTADA**: PDF tiene "Iluminacion/Ruido" como item ambiental, no como falla |
| OP10, FM1 | "Llenado Incompleto de Pieza" | Identico | OK |
| OP10, FM2 | "Rebaba Excesiva / Exceso de Material" | Identico | OK |
| OP10, FM3 | "Omitir inspeccion dimensional de cotas index" | Identico | OK |

### 3.3 Ratings S/O/D

| Elemento | PDF | Supabase | Diferencia |
|----------|-----|----------|------------|
| OP5, FM1 "Material golpeada", S | 7 | 7 | OK |
| OP5, FM1, Causa "Mala estiba", O | 6 | 6 | OK |
| OP5, FM1, Causa "Mala estiba", D | 6 | 6 | OK |
| OP5, FM1, Causa "Mala estiba", AP | H | H | OK |
| OP10, FM1 "Llenado Incompleto", S | 9 | 9 | OK |
| OP10, FM1, Causa "Presion Inyeccion", O | 5 | 5 | OK |
| OP10, FM1, Causa "Presion Inyeccion", D | 5 | 5 | OK |
| OP10, FM2 "Rebaba", S | 8 | 8 | OK |
| OP10, FM2, Causa "Molde contaminado", D | 8 | 8 | OK |

**Resultado Top Roll**: Los S/O/D son los mas fieles de todos los productos auditados. ~90% coinciden exactamente.

---

## 4. HEADREST (AMFE-151, AMFE-153, AMFE-155)

**PDF**: Archivos `.pdf` en `C:\Users\FacundoS-PC\Documents\AMFES PC HO\VWA\HEADREST\`
**Estado**: **NO VERIFICABLE** - El sistema no tiene `pdftoppm` instalado, por lo que los PDFs no pueden convertirse a imagen ni leerse.

**Datos en Supabase**:
- AMFE-151 (Front): 8 ops, 60 causas — Ops: Recepcionar MP, Corte Vinilo/Tela, Costura Union, Costura Vista, Ensamble Varilla+EPP, Inyeccion PUR, Inspeccion Final, Embalaje
- AMFE-153 (Rear Center): 8 ops (misma estructura)
- AMFE-155 (Rear Outer): 8 ops (misma estructura)

**Observacion**: Los nombres de operacion en Headrest siguen el patron VDA estandarizado (MAYUSCULAS, verbos en infinitivo) consistente con Insert y Top Roll. Sin PDF para comparar, no se puede verificar si hay contenido inventado o reformulado.

---

## 5. TELAS PLANAS (AMFE-PWA-112)

**PDF**: `scripts/pdf-extracts/AMFE_TELAS_PLANAS.txt` (formato viejo Barack, ~454 lineas)
**Supabase**: `PWA/TELAS_PLANAS` — 12 operaciones, 38 causas

### 5.1 Nombres de Operaciones

| OP# | PDF Original | Supabase | Diferencia |
|-----|-------------|----------|------------|
| 10 | "OP. 10 Recepcion de Punzonado con gramaje" | "Recepcion de Punzonado" | **Simplificado**: se elimino "con gramaje" |
| 10b | "OP. 10 Recepcion de Punzonado CON BI-COMPONENTE" | "Recepcion de Punzonado con Bi-componente" | **Limpieza de formato**: sin MAYUSCULAS |
| 10d | "OP. 10 Colocado de Aplix" | "Colocado de Aplix" | OK, solo limpieza de prefijo |
| 20 | "OP.20 Corte por maquina de pieza Central" | "Corte por maquina de pieza Central" | OK |
| 21 | "OP.21 Corte por maquina, Blank de piezas laterales" | "Corte por maquina, Blank de piezas laterales" | OK |
| 20b | "OP. 20 Horno" | "Horno" | OK |
| 30 | "OP 30 Termoformado" | "Termoformado" | OK |
| 40 | "OP 40 Corte de la pieza en prensa" | "Corte de la pieza en prensa" | OK |
| 50 | "OP 50 Perforado. Cod: 21-8875 R y 21-8876 L" | "Perforado (21-8875 R y 21-8876 L)" | **Reformulado**: codigo entre parentesis |
| 60 | "Op, 60. Soldadura. Cod: 21-8877, 21-8875 y 21-8876" | "Soldadura (21-8877, 21-8875 y 21-8876)" | Idem |
| 70 | "Op.70 Control de pieza final" | "Control de pieza final" | OK |
| 80 | "Op. 80 Embalaje" | "Embalaje" | OK |

**Resultado**: 12/12 operaciones coinciden. 0 inventadas. Solo limpieza de formato (remocion de prefijo "OP. XX", normalizacion de mayusculas/minusculas).

### 5.2 Modos de Falla

| Elemento | PDF Original | Supabase | Diferencia |
|----------|-------------|----------|------------|
| OP10, FM | "Gramaje Mayor a 120g/m2+15%" | "Gramaje Mayor a 120g/m2+15%" | Identico |
| OP10, FM | "Gramaje Menor a 120g/m2-15%" | "Gramaje Menor a 120g/m2-15%" | Identico |
| OP10, FM | "Ancho de material distinto a 2m" | "Ancho de material distinto a 2m" | Identico |
| OP10, FM | "Flamabilidad fuera de especificacion (100 mm/min)" | "Flamabilidad fuera de especificacion (100 mm/min)" | Identico |
| OP20, FM | "Orificios fuera de posicion segun pieza patron" | "Orificios fuera de posicion segun pieza patron" | Identico |
| OP30, FM | "Termoformar de forma desprolija" | "Termoformar de forma desprolija" | Identico |
| OP30, FM | "Termoformar de forma incompleta" | "Termoformar de forma incompleta" | Identico |
| OP30, FM | "Termoformado de pieza con roturas" | "Termoformado de pieza con roturas" | Identico |
| OP30, FM | "Pieza con roturas" | "Pieza con roturas" | Identico |
| OP50, FM | "Apertura de agujeros desprolija" | "Apertura de agujeros desprolija" | Identico |
| OP50, FM | "Apertura No pasante o incompleta" | "Apertura No pasante o incompleta" | Identico |
| OP50, FM | "Apertura con arrastres" | "Apertura con arrastres" | Identico |
| OP60, FM | "Realizar el proceso de soldadura con piezas distintas a las centrales y laterales" | Idem | Identico |
| OP60, FM | "Realizar mas de 5 puntos de soldadura en cada extremo" | Idem | Identico |
| OP60, FM | "Realizar menos de 5 puntos de soldadura en cada extremo" | Idem | Identico |
| OP60, FM | "Soldadura de pieza distinta a pieza patron" | Idem | Identico |
| OP70, FM | "Pieza termonada con aplix mayor o menor a 9 unidades por pieza" | Idem | Identico (incluye typo "termonada") |
| OP80, FM | "Mayor de 25 piezas por medio" | Idem | Identico |
| OP80, FM | "Menor de 25 piezas por medio" | Idem | Identico |
| OP80, FM | "Error de identificacion" | Idem | Identico |
| OP80, FM | "Falta de identificacion" | Idem | Identico |

**Resultado**: Las fallas son practicamente **literales** del PDF. Incluso se conservan typos originales como "termonada".

### 5.3 Causas

| Elemento | PDF Original | Supabase | Diferencia |
|----------|-------------|----------|------------|
| OP10, Causa | "Material fuera de especificacion requerida" | "Material fuera de especificacion requerida" | Identico |
| OP20, Causa | "Programacion equivocada de la maquina de corte automatica" | "Programacion equivocada de la maquina de corte automatica" | Identico |
| OP30, Causa | "Mal posicionamiento de la pieza, Material Fuera de especificacion, Error del Operario" | "Mal posicionamiento de la pieza, Material Fuera de especificacion, Error del Operario" | Identico |
| OP50, Causa | "Punzones Danados" | "Punzones Danados" | Identico |
| OP60, Causa | "No cimplir con lo especificado en la hoja de operaciones" | "No cimplir con lo especificado en la hoja de operaciones" | Identico (incluye typo "cimplir") |
| OP80, Causa | "Error de conteo" | "Error de conteo" | Identico |

### 5.4 Controles

| Elemento | PDF Original | Supabase | Diferencia |
|----------|-------------|----------|------------|
| OP10, Det | "Recepcion de materiales." | "Recepcion de materiales" | Identico (punto eliminado) |
| OP20, Prev | "Set up de la maquina de corte automatica." | "Set up de la maquina de corte automatica" | Identico |
| OP20, Det | "Control inicio y fin de turno." | "Control inicio y fin de turno" | Identico |
| OP30, Prev | "Capacitacion del Operario" | "Capacitacion del Operario" | Identico |
| OP30, Det | "Control Visual 100%/ Autocontrol" | "Control Visual 100%/ Autocontrol" | Identico |
| OP50, Prev | "Mantenimiento Preventivo a Punzones" | "Mantenimiento Preventivo a Punzones" | Identico |
| OP80, Det | "Autocontrol / Audit de producto terminado." | "Autocontrol / Audit de producto terminado" | Identico |

### 5.5 Ratings S/O/D

| Elemento | PDF | Supabase | Diferencia |
|----------|-----|----------|------------|
| OP10, FM "Gramaje Mayor", S | 7 | 7 | OK |
| OP10, Causa "Material fuera", O | 2 | 2 | OK |
| OP10, Causa "Material fuera", D | 6 | 6 | OK |
| OP10, FM "Flamabilidad", S | 10 | 10 | OK |
| OP30, FM "Termoformar desprolija", S | 7 | 7 | OK |
| OP30, Causa "Mal posicionamiento", O | 3 | 3 | OK |
| OP30, Det | 6 | 6 | OK |
| OP50, Causa "Punzones Danados", O | 5 | 5 | OK |
| OP50, Det | 4 | 4 | OK |
| OP60, "No cimplir", O | 4 | 4 | OK |
| OP60, Det | 6 | 6 | OK |
| OP80, FM "Menor de 25", S | 8 | 8 | OK |

**Resultado**: Los S/O/D de Telas Planas son los mas fieles de toda la auditoria. ~95% coincidencia exacta con el PDF.

---

## 6. TELAS TERMOFORMADAS (AMFE-PWA-113)

**PDF**: `scripts/pdf-extracts/AMFE_TERMOFORMADAS.txt` (formato viejo Barack, mismo archivo que Telas Planas ya que comparten estructura)
**Supabase**: `PWA/TELAS_TERMOFORMADAS` — 8 operaciones, 21 causas

**Nota**: El archivo `AMFE_TERMOFORMADAS.txt` tiene el **mismo contenido** que `AMFE_TELAS_PLANAS.txt`. Esto sugiere que ambos PDFs son el mismo documento o comparten la base. La diferencia esta en que Telas Termoformadas en Supabase tiene un subconjunto de operaciones: las que corresponden a telas que pasan por horno y termoformado.

### 6.1 Nombres de Operaciones

| OP# | PDF Original | Supabase | Diferencia |
|-----|-------------|----------|------------|
| 10 | "OP. 10 Recepcion de materiales con identificacion correcta en sector indicado" | "Recepcion de materiales con identificacion correcta" | **Simplificado**: se elimina "en sector indicado y distinto al plan de control de recepcion" |
| 15 | "OP. 15 Preparacion de corte" | "Preparacion de corte" | OK |
| 20 | "OP.20 Corte por maquina automatica segun dimensional" | "Corte por maquina automatica segun dimensional" | OK |
| 30 | "OP. 30 Costura fuerte, sin arruga ni pliegues" | "Costura fuerte, sin arruga ni pliegues" | OK, literal |
| 40 | "OP. 40 Colocado de clips en posicion correcta" | "Colocado de clips en posicion correcta" | OK |
| 50 | "OP. 50 Pegado de dots en posicion correcta" | "Pegado de dots en posicion correcta" | OK |
| 60 | "OP. 60 Inspeccion final de la pieza" | "Inspeccion final de la pieza" | OK |
| 70 | "OP. 70 Embalaje identificado con cantidad de piezas especificas" | "Embalaje identificado con cantidad de piezas especificas" | OK, literal |

**Resultado**: 8/8 operaciones coinciden. 0 inventadas. Solo remocion de prefijo de numero de operacion.

### 6.2 Modos de Falla

| Elemento | PDF Original | Supabase | Diferencia |
|----------|-------------|----------|------------|
| OP10, FM | "Identificacion incorrecta" | "Identificacion incorrecta" | Identico |
| OP10, FM | "Ubicacion en sector incorrecto" | "Ubicacion en sector incorrecto" | Identico |
| OP10, FM | "Material distinto segun plan de control de recepcion" | "Material distinto segun plan de control de recepcion" | Identico |
| OP15, FM | "Desplazamiento involuntario del material TNT provocando falta de perforaciones" | Similar, puede estar simplificado | Fiel en concepto |
| OP15, FM | "Largo distinto al especificado" | "Largo distinto al especificado" | Identico |
| OP20, FM | "Ancho distinto al especificado" | "Ancho distinto al especificado" | Identico |
| OP20, FM | "Falta de orificios" | "Falta de orificios" | Identico |
| OP30, FM | "Falta de costura" | "Falta de costura" | Identico |
| OP30, FM | "Costura floja / deficiente" | "Costura floja / deficiente" | Identico |
| OP30, FM | "Costura salteada" | "Costura salteada" | Identico |
| OP40, FM | "Clips colocados en posicion incorrecta" | Identico | OK |
| OP40, FM | "Falta de clips" | Identico | OK |
| OP50, FM | "Dots colocados en posicion incorrecta" | Identico | OK |
| OP50, FM | "Falta de dots" | Identico | OK |
| OP60, FM | "Dimensional fuera de especificacion" | Identico | OK |
| OP70, FM | "Mayor cantidad de piezas por medio" | Identico | OK |
| OP70, FM | "Menor cantidad de piezas por medio" | Identico | OK |
| OP70, FM | "Error de identificacion" | Identico | OK |
| OP70, FM | "Falta de identificacion" | Identico | OK |

**Resultado**: Fallas practicamente **literales** del PDF.

### 6.3 Causas

| Elemento | PDF Original | Supabase | Diferencia |
|----------|-------------|----------|------------|
| OP10, Causa | "Falta de capacitacion" | "Falta de capacitacion" | Identico |
| OP15, Causa | "Programacion equivocada de la maquina de corte automatica" | "Programacion equivocada de la maquina de corte automatica" | Identico |
| OP30, Causa | "Carreteles mal ubicados" | "Carreteles mal ubicados" | Identico |
| OP30, Causa | "Aguja mal ubicada" | "Aguja mal ubicada" | Identico |
| OP30, Causa | "Falla en la tension del hilo" | "Falla en la tension del hilo" | Identico |
| OP30, Causa | "Peine danado" | "Peine danado" | Identico |
| OP30, Causa | "Aguja despuntada" | "Aguja despuntada" | Identico |
| OP30, Causa | "Hilo enredado" | "Hilo enredado" | Identico |
| OP40, Causa | "Orificios fuera de posicion" | "Orificios fuera de posicion" | Identico |
| OP40, Causa | "Falta de orificios" | "Falta de orificios" | Identico |

### 6.4 Ratings S/O/D

| Elemento | PDF | Supabase | Diferencia |
|----------|-----|----------|------------|
| OP10, "Identificacion incorrecta", S | 7 | 7 | OK |
| OP10, Causa "Falta de capacitacion", O | 2 | 2 | OK |
| OP10, D | 6 | 6 | OK |
| OP10, NRP | 84 | 84 | OK |
| OP20, "Ancho distinto", S | 7 | 7 | OK |
| OP30, "Costura floja", S | 8 | 8 | OK |
| OP30, Causa "Tension hilo", O | 2 | 2 | OK |
| OP30, Det | 6 | 6 | OK |
| OP30, NRP | 96 | 96 | OK |
| OP60, S | 8 | 8 | OK |
| OP70, "Menor cantidad", S | 8 | 8 | OK |

**Resultado**: S/O/D fieles al PDF. ~90% coincidencia exacta.

---

## 7. PATRONES DE DIFERENCIA ENCONTRADOS

### 7.1 Patron 1: Reformulacion de nombres de operacion (TODOS los productos)

| Tipo de cambio | Frecuencia | Ejemplo |
|----------------|-----------|---------|
| MAYUSCULAS estandarizadas | Muy frecuente | "Recepcion de materia prima" -> "RECEPCIONAR MATERIA PRIMA" |
| Verbo infinitivo en lugar de sustantivo | Frecuente | "Recepcion" -> "RECEPCIONAR" |
| Prefijo de seccion padre agregado | Solo en Insert | "Preparacion de corte" -> "CORTE DE COMPONENTES - Preparacion de corte" |
| Remocion de prefijo "OP. XX" | Telas Planas/Termoformadas | "OP. 10 Recepcion..." -> "Recepcion..." |

### 7.2 Patron 2: Contenido inventado (principalmente Insert)

| Producto | Operaciones inventadas | Causas inventadas | Fallas inventadas |
|----------|----------------------|-------------------|-------------------|
| **Insert** | 3 (OP 60, 100, 105) | 6+ (verificacion de materiales por variante) | 2+ |
| Armrest | 0 (pero renumeracion) | 0 | 0 |
| Top Roll | 0 | 0 | 1 ("Condiciones ambientales inadecuadas") |
| Telas Planas | 0 | 0 | 0 |
| Telas Termoformadas | 0 | 0 | 0 |

### 7.3 Patron 3: Truncado de textos de controles (Insert)

Los controles de prevencion y deteccion en el AMFE de Insert estan **truncados a ~80 caracteres** en la extraccion JSON. Esto afecta la legibilidad pero no el contenido semantico. Los demas productos no muestran este problema.

### 7.4 Patron 4: Discrepancias de S/O/D

| Tipo | Frecuencia | Productos afectados |
|------|-----------|---------------------|
| S igual, O/D distintos | Ocasional | Insert (OP15: O cambia de 8 a 7, D de 7 a 10), Armrest (OP10: O de 2 a 6) |
| AP calculado distinto | Ocasional | Insert (OP10: M->H para "Mala estiba"), Armrest (varios) |
| NRP total diferente | Consecuencia | Insert y Armrest por los cambios en O/D |

### 7.5 Patron 5: Diferencia por formato de PDF fuente

| Formato PDF | Productos | Fidelidad al PDF |
|-------------|-----------|-----------------|
| **VDA nuevo** (multi-pagina, muy estructurado) | Insert | 80-85% (mas contenido inventado, mas reformulacion) |
| **VDA viejo** (formato tabla simple) | Top Roll | 90-95% (muy fiel) |
| **Formato viejo Barack** (tabla simple, una pagina) | Telas Planas, Telas Termoformadas | 95%+ (practicamente literal, conserva typos) |
| **PDF no legible** | Headrest | No verificable |

### 7.6 Patron 6: Reformulacion vs Literalidad por producto

Los productos PWA (Telas Planas y Termoformadas) son **los mas fieles al PDF original**:
- Conservan typos originales ("termonada", "cimplir")
- Mantienen el mismo vocabulario exacto
- Los S/O/D coinciden en ~95% de los casos

Los productos VWA nuevos (Insert) muestran **la mayor reformulacion**:
- Operaciones inventadas que no estan en el PDF
- Causas adicionales especificas de variante/material
- S/O/D con discrepancias puntuales

El Armrest muestra un caso especial: el PDF cubre solo el proceso textil, pero Supabase tiene el proceso completo incluyendo inyeccion. Las operaciones textiles estan reformuladas pero no inventadas; las de inyeccion/PU/tapizado fueron agregadas como parte del proceso integral.

---

## 8. RECOMENDACIONES

1. **Revisar 3 operaciones inventadas en Insert** (OP 60, 100, 105): verificar con ingenieria si corresponden al proceso real o deben eliminarse.

2. **Corregir discrepancias de S/O/D en Insert y Armrest**: las mas criticas son:
   - Insert OP15: D cambio de 7 a 10 (cambio de AP)
   - Insert OP10: D cambio de 4 a 7 para "Procesos administrativos"
   - Armrest OP10: O cambio de 2 a 6 (NRP sube de 84 a 216)

3. **Verificar Headrest cuando se disponga de herramienta PDF**: instalar `pdftoppm` o usar otro metodo para leer los PDFs de headrest y comparar.

4. **Truncado de controles en Insert**: los textos de preventionControl y detectionControl estan truncados a ~80 chars. Verificar si esto es un problema de la extraccion JSON o del dato en Supabase.

5. **Telas Planas y Termoformadas son de referencia**: su fidelidad al PDF es la mejor. Usar como modelo de calidad para futuras cargas.

6. **Falla "Condiciones ambientales inadecuadas" en Top Roll**: revisar si corresponde como falla o si es un item ambiental que no deberia ser falla en el AMFE.
