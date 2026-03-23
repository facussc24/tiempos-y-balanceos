# 2A - Plan de Normalizacion: AMFE y CP

**Fecha**: 2026-03-23
**Basado en**: Reportes 1A (AMFE Style) y 1B (CP Style)
**Criterio**: El PDF original de la empresa es siempre la referencia correcta.

---

## PARTE 1: AMFE — Plan de Normalizacion

---

### Prioridad 1: CORREGIR (errores vs referencia PDF)

Estos items tienen datos en Supabase que **no coinciden** con el PDF original y deben corregirse porque afectan la validez tecnica del documento (ratings de riesgo, operaciones inexistentes, contenido inventado).

#### 1.1 Operaciones inventadas (no existen en PDF)

| Producto | OP# Supabase | Texto Supabase (actual) | Accion |
|---|---|---|---|
| Insert Patagonia | OP 60 | "TROQUELADO - Troquelado de espuma" | **ELIMINAR**: No existe en PDF. Verificar con ingenieria si el proceso real la requiere antes de borrar. |
| Insert Patagonia | OP 100 | "Tapizado - Tapizado semiautomatico" (con poka-yoke fabricado) | **ELIMINAR**: No existe en PDF. La operacion tiene causas/controles fabricados. |
| Insert Patagonia | OP 105 | "REFILADO POST-TAPIZADO" | **ELIMINAR**: No aparece en PDF. |
| Top Roll | (nueva FM) | Falla "Condiciones ambientales inadecuadas" en OP5 | **ELIMINAR falla**: El PDF tiene "Iluminacion/Ruido" como item ambiental, no como modo de falla del AMFE. |

#### 1.2 Causas inventadas (no existen en PDF)

| Producto | Operacion | Texto Supabase (actual) | Accion |
|---|---|---|---|
| Insert Patagonia | OP 10 | "No se verifica color del Hilo Needle thread Linanhyl segun variante" | **ELIMINAR**: Causa especifica de variante que no existe en el PDF original del master. |
| Insert Patagonia | OP 10 | "No se verifica fecha de vencimiento del adhesivo SikaMelt" | **ELIMINAR**: Causa de material especifica no presente en el PDF. |
| Insert Patagonia | OP 20 | Falla "Seleccion incorrecta del material (vinilo mal identificado)" como falla separada | **RECLASIFICAR**: En el PDF esto es una causa ("Falta de verificacion del codigo"), no un modo de falla independiente. Mover a causa de la falla de corte existente. |

#### 1.3 Fallas elevadas de categoria (causa convertida en falla)

| Producto | Operacion | PDF Original | Supabase (actual) | Accion |
|---|---|---|---|---|
| Top Roll | OP 5 | "No se utiliza el sistema ARB" es una **causa** | Aparece como **modo de falla** separado | **RECLASIFICAR**: Devolver a categoria "causa" dentro de la falla "Falta de documentacion o trazabilidad". |

#### 1.4 Discrepancias de ratings S/O/D

Estos son errores numericos que afectan directamente el calculo de NRP y la clasificacion de Action Priority (AP).

| Producto | Operacion / Falla | Rating | PDF (correcto) | Supabase (actual) | Impacto |
|---|---|---|---|---|---|
| **Insert** | OP10, FM2 "Falta documentacion", Causa "Procesos admin" | D | **4** | 7 | NRP sube artificialmente; AP puede cambiar |
| **Insert** | OP10, FM2, Causa "Proveedor sin trazabilidad" | AP | **H** | M | AP bajado incorrectamente |
| **Insert** | OP10, FM1 "Material golpeada", Causa "Mala estiba" | AP | **M** | H | AP subido incorrectamente |
| **Insert** | OP15, FM1 "Corte fuera de medida", Causa "Error operario" | O | **8** | 7 | Subestima probabilidad de ocurrencia |
| **Insert** | OP15, FM1 "Corte fuera de medida", Causa "Error operario" | D | **7** | 10 | Sobreestima dificultad de deteccion |
| **Armrest** | OP10, FM "Identificacion incorrecta" | S | **7** | 6 | Subestima severidad |
| **Armrest** | OP10, Causa "Falta de capacitacion" | O | **2** | 6 | **CRITICO**: O triplicado, NRP sube de 84 a 216 |
| **Armrest** | OP30, Causa "Tension hilo" | O | **2** | 4 | Duplicado vs PDF |
| **Armrest** | OP30, Deteccion | D | **6** | 4 | Cambiado vs PDF |

#### 1.5 Textos truncados (controles)

| Producto | Operacion | Campo | Texto PDF (correcto, completo) | Texto Supabase (truncado a ~80 chars) |
|---|---|---|---|---|
| Insert | OP10 | Prevencion | "Existencia de instrucciones de trabajo que definen como debe estibarse y manipularse el material" | "Existencia de instrucciones de trabajo que definen como debe estibarse y manipul" |
| Insert | OP10 | Deteccion | "Verificacion del estado del embalaje antes de que el camion salga o inmediatamente cuando llega a su destino" | "Verificacion del estado del embalaje antes de que el camion salga o inmediatamen" |
| Insert | OP10 | Prevencion | "El sistema [ARB] obliga a registrar lote y codigo en recepcion y verifica contra base de datos" | "El sistema [ARB] obliga a registrar lote y codigo en recepcion y verifica contra" |
| Insert | OP10 | Prevencion | "Procedimiento Operacional Estandar que exige y documenta la obligatoriedad del uso del sistema ARB." | "Procedimiento Operacional Estandar que exige y documenta la obligatoriedad del u" |

**Accion**: Restaurar el texto completo del PDF en cada campo truncado. Verificar si el truncamiento es del dato en Supabase o de la extraccion JSON (si es de la extraccion, el dato puede estar bien en la DB).

#### 1.6 Fallas/causas del PDF ausentes en Supabase

| Producto | Operacion PDF | Texto PDF (faltante) | Accion |
|---|---|---|---|
| Armrest | OP30 Costura | Falla: "Costura salteada" | **AGREGAR**: Falla del PDF no reflejada en Supabase |
| Armrest | OP30 Costura | Causa: "Peine danado" | **AGREGAR**: Causa del PDF ausente |
| Armrest | OP30 Costura | Causa: "Aguja despuntada" | **AGREGAR**: Causa del PDF ausente |
| Armrest | OP30 Costura | Causa: "Hilo enredado" | **AGREGAR**: Causa del PDF ausente |

#### 1.7 Contenido completamente diferente entre PDF y Supabase (Armrest)

El Armrest tiene un caso especial: el PDF cubre solo el proceso textil, pero Supabase tiene el proceso integral (inyeccion plastica, PU, tapizado, etc.). Las siguientes operaciones en Supabase no tienen equivalente en el PDF:

| OP# Supabase | Nombre Supabase | En PDF? | Accion |
|---|---|---|---|
| OP 60 | "INYECCION PLASTICA - INYECCION DE PIEZAS PLASTICAS" | NO (PDF OP60 = "Inspeccion final") | **VERIFICAR CON INGENIERIA**: Si el proceso real incluye inyeccion, mantener. Si no, corregir. |
| OP 70 | "INYECCION PU" | NO (PDF OP70 = "Embalaje") | **VERIFICAR CON INGENIERIA**: idem |
| OP 80 | TAPIZADO | No en PDF textil | **VERIFICAR**: Proceso extendido vs PDF limitado |
| OP 90 | TAPIZADO (renumerado) | No en PDF textil | **VERIFICAR** |

**Nota**: Es posible que el PDF solo cubra una parte del proceso y Supabase tenga el proceso completo correcto. Requiere verificacion con ingenieria de proceso.

---

### Prioridad 2: MEJORAR (unificacion de estilo)

Estas variaciones no son errores pero generan inconsistencia entre productos. Se propone un estilo unico.

#### 2.1 Capitalizacion de nombres de operacion

| Aspecto | Estilo actual | Propuesta unificada | Productos afectados |
|---|---|---|---|
| Capitalizacion | Insert/Top Roll usan MAYUSCULAS ("RECEPCIONAR MATERIA PRIMA"); Telas Planas/Termoformadas usan mixed case ("Recepcion de Punzonado") | **Usar Title Case** (primera letra mayuscula por palabra): "Recepcionar Materia Prima", "Corte de Componentes" | Insert, Top Roll, Telas Planas, Telas Termoformadas |

**Justificacion**: Los PDFs originales usan mixed case o Title Case. Las MAYUSCULAS completas fueron un artefacto de la carga en Supabase.

#### 2.2 Verbo infinitivo vs sustantivo en operaciones

| Aspecto | Estilo actual | Propuesta unificada | Productos afectados |
|---|---|---|---|
| Forma verbal | Insert/Top Roll: infinitivo ("RECEPCIONAR"); Telas: sustantivo ("Recepcion"); Armrest: mixto | **Respetar la forma del PDF de cada producto**. No forzar una convencion unica ya que cada PDF tiene su propio estilo historico. | Todos |

**Justificacion**: Los PDFs no comparten convencion, y forzar un estilo unico crearia diferencias con el documento oficial.

#### 2.3 Prefijo de seccion padre en nombres de operacion

| Aspecto | Estilo actual | Propuesta unificada | Productos afectados |
|---|---|---|---|
| Prefijo de seccion | Insert agrega prefijo: "CORTE DE COMPONENTES DE VINILO O TELA - Preparacion de corte" | **Eliminar prefijo de seccion**. Usar solo el nombre de la operacion: "Preparacion de corte" (como en el PDF). La jerarquia se maneja por la estructura del documento, no por el nombre. | Insert Patagonia |

#### 2.4 Puntos finales inconsistentes

| Aspecto | Estilo actual | Propuesta unificada | Productos afectados |
|---|---|---|---|
| Punto final en fallas/causas | Algunos textos terminan con "." y otros no (ej: Insert OP15 FM1 "...especificacion).") | **Sin punto final** en fallas, causas y controles. Estandarizar removiendo puntos finales sueltos. | Insert, Telas Planas |

#### 2.5 Nombre de OP 90 en Top Roll

| Aspecto | Estilo actual | Propuesta unificada | Productos afectados |
|---|---|---|---|
| Nombre extendido | Supabase: "EMPAQUE FINAL Y ETIQUETADO DE PRODUCTO TERMINADO" vs PDF: "Empaque final y etiquetado" | Usar texto del PDF: **"Empaque Final y Etiquetado"** (sin agregado "DE PRODUCTO TERMINADO") | Top Roll |

#### 2.6 Expansion de fallas con parentesis

| Aspecto | Estilo actual | Propuesta unificada | Productos afectados |
|---|---|---|---|
| Parentesis aclaratorio | Top Roll OP5 FM3: PDF dice "Material con especificacion erronea", Supabase agrega "(dimensiones, color, dureza, etc.)" | **Mantener el parentesis** ya que agrega claridad sin contradecir el PDF | Top Roll |

---

### Prioridad 3: ACEPTABLE (no requiere accion)

Las siguientes variaciones se consideran aceptables y no requieren correccion:

1. **Remocion del prefijo "OP. XX" en Telas Planas y Termoformadas**: El PDF incluye "OP. 10", "OP.20", etc. en el nombre. Supabase los omite porque el numero de operacion ya es un campo separado. Esto es correcto; el nombre no necesita repetir el numero.

2. **Cambio de formato de codigos de pieza en Telas Planas**: PDF dice "Perforado. Cod: 21-8875 R y 21-8876 L", Supabase dice "Perforado (21-8875 R y 21-8876 L)". Misma informacion, distinto formato de presentacion.

3. **Typos conservados del PDF original en Telas Planas**: "termonada" (OP70 FM) y "cimplir" (OP60 causa) son errores que vienen del PDF original. Mantenerlos preserva la fidelidad al documento. Si se quiere corregir, debe ser una decision documental formal (revision del AMFE), no de normalizacion de sistema.

4. **Simplificacion "Recepcion de Punzonado con gramaje" a "Recepcion de Punzonado" (Telas Planas)**: Variacion menor. El "con gramaje" es contexto que aparece en los controles/fallas del mismo item.

5. **Simplificacion de OP10 en Telas Termoformadas**: PDF dice "Recepcion de materiales con identificacion correcta en sector indicado y distinto al plan de control de recepcion"; Supabase dice "Recepcion de materiales con identificacion correcta". El texto cortado es descriptivo pero la operacion se identifica igual.

6. **Textos identicos con diferencia de punto final**: Multiples fallas/causas en Insert y Telas donde la unica diferencia es un "." al final en el PDF que no esta en Supabase. Esto es cosmetico.

7. **Telas Planas y Termoformadas son la referencia de calidad**: Estas dos son ~95% literales del PDF, conservan typos, y los S/O/D coinciden casi al 100%. No requieren ningun cambio.

8. **Headrest (x3) no verificable**: Sin herramienta para leer los PDFs, no se puede clasificar como correcto o incorrecto. Quedan pendientes hasta que se pueda comparar.

---

## PARTE 2: CP — Plan de Normalizacion

---

### Contexto critico

Los CPs en Supabase tienen **dos poblaciones completamente distintas**:

- **Poblacion A (Headrest x6)**: Parseados del PDF. Alta fidelidad. Diferencias menores.
- **Poblacion B (Insert, Top Roll, Armrest, Telas)**: **Generados automaticamente desde AMFE**. Estilo completamente distinto al PDF. Contenido tecnico diferente.

La Poblacion B es un **reemplazo** del documento original, no una copia. La normalizacion de estos CPs requiere decision de negocio: mantener el CP generado-AMFE (valido para trazabilidad) o re-cargarlo desde el PDF (valido para especificaciones tecnicas).

---

### Prioridad 1: CORREGIR (errores vs referencia PDF)

#### 1.1 Perdida de valores numericos de especificacion (Insert y Top Roll)

Estos valores concretos del PDF se perdieron al generar el CP desde AMFE. Son datos tecnicos criticos para el control de produccion.

| Producto | Operacion | Parametro | Valor PDF (correcto) | Valor Supabase (actual) | Accion |
|---|---|---|---|---|---|
| Insert | Recepcion | Espesor vinilo | "min 1,5 - max 2,5" | "Segun instruccion de proceso" | **RESTAURAR** valor numerico |
| Insert | Recepcion | Gramaje vinilo | "min 800 - max 1000 GMS/MT2" | No presente | **AGREGAR** item con especificacion |
| Insert | Recepcion | Viscosidad adhesivo | "950cPoise +/- 15%" | No presente | **AGREGAR** item |
| Insert | Recepcion | Flamabilidad | "<100 mm/min" | Generico | **RESTAURAR** valor numerico |
| Insert | Adhesivado | Temperatura | "85C +/- 5C" | No presente | **AGREGAR** item |
| Insert | Adhesivado | Velocidad | "4 mts/min" | No presente | **AGREGAR** item |
| Insert | Costura | Puntadas | "11 +/- 1 puntadas / 5 cm" | No presente | **AGREGAR** item |
| Insert | Costura | Ancho costura | "6 +/- 0,5 mm" | No presente | **AGREGAR** item |
| Insert | Tapizado | Tolerancia costura | "100mm +/- 1mm" | No presente | **AGREGAR** item |
| Insert | Corte | Capas de corte | "10" | No presente | **AGREGAR** item |
| Insert | Corte | Cuchilla minima | ">= 4mm" | No presente | **AGREGAR** item |
| Insert | Embalaje | Cantidad | "6 piezas por cajon" | No presente | **AGREGAR** item |
| Top Roll | Recepcion | Espesor vinilo | "2,1 mm min 1,8 - max 2,4" | No presente | **AGREGAR** item |
| Top Roll | Recepcion | Gramaje | "740 +/- 10% min 670 - max 820 GMS/MT2" | No presente | **AGREGAR** item |
| Top Roll | Recepcion | Viscosidad adhesivo | "950cPoise +/- 15%" | No presente | **AGREGAR** item |
| Top Roll | Recepcion | Flamabilidad | "SC <100 mm/min" | Sin valor numerico | **RESTAURAR** valor |
| Top Roll | Adhesivado | Temperatura horno | "60-70C" | No presente | **AGREGAR** item |
| Top Roll | Tapizado | Tiempo horno | "60-65 segundos" | No presente | **AGREGAR** item |
| Top Roll | Tapizado | Tolerancia costura | "100mm +/- 1mm" | No presente | **AGREGAR** item |
| Top Roll | Corte | Capas de corte | "2" | No presente | **AGREGAR** item |
| Top Roll | Corte | Cuchilla minima | "4mm" | No presente | **AGREGAR** item |
| Top Roll | Embalaje | Cantidad | "8 piezas por cajon en bolsa" | No presente | **AGREGAR** item |
| Top Roll | Inspeccion | Muestreo | "5 piezas por lote de inyeccion de sustrato plastico" | Generico | **RESTAURAR** valor |

**Nota**: Esta tabla tiene 22 items faltantes. La correccion requiere agregar manualmente cada item al CP en Supabase con el valor del PDF.

#### 1.2 Enfoque de caracteristicas incorrecto (Insert y Top Roll)

| Producto | Operacion | PDF (correcto): Caracteristicas de PRODUCTO | Supabase (actual): Causas de FALLA (AMFE) | Accion |
|---|---|---|---|---|
| Insert | Recepcion | "Tipo de Producto", "Color", "Torres de sujecion", "Dimensional de control", "Aspecto", "Espesor" | "Mala estiba y embalaje inadecuado", "Manipulacion incorrecta en transito", etc. | **DECISION DE NEGOCIO**: Mantener trazabilidad AMFE o restaurar enfoque PDF. Ver nota abajo. |
| Insert | Corte | "Cantidad de Capas: 10", "Medir cuchilla >= 4mm", "Dimensional de Corte segun Myler" | "Falta de verificacion del filo de la cuchilla", "No se coloca la cantidad correcta de capas" | **Idem** |
| Insert | Costura | "Sin costura salteada", "Sin arrugas", "Sin falta de costura" (aspectos) | "Error en la configuracion de la maquina de coser", "Operario sin capacitacion" | **Idem** |
| Top Roll | Recepcion | "Sustrato Plastico ABS", "Espesor 2,1mm", "Gramaje 740" | Causas AMFE genericas | **Idem** |
| Top Roll | Corte | "Cantidad de Capas: 2", "Cuchilla 4mm" | Causas AMFE genericas | **Idem** |

**Nota de decision de negocio**: El CP del PDF lista "que se controla" (caracteristicas de producto medibles). El CP de Supabase lista "que puede salir mal" (causas de falla del AMFE). Ambos enfoques son validos en AIAG, pero representan documentos diferentes. Se recomienda:
- **Opcion A (recomendada)**: Complementar el CP generado-AMFE con items de especificacion del PDF. Mantener los items AMFE (dan trazabilidad) y agregar items de producto con sus valores numericos.
- **Opcion B**: Re-cargar el CP completo desde el PDF, perdiendo la trazabilidad automatica AMFE-CP.

#### 1.3 Plan de reaccion: referencia SGC vs texto descriptivo

| Producto | PDF (correcto) | Supabase (actual) | Accion |
|---|---|---|---|
| Insert (Recepcion) | "P-10/I. Recepcion de materiales. P-14." | "Ajustar proceso. Reinspeccionar ultimo lote. Registrar desvio." | **AGREGAR referencia SGC**: El plan de reaccion debe incluir la referencia al procedimiento. Propuesta: "Segun P-10/I y P-14. Ajustar proceso. Reinspeccionar ultimo lote." |
| Top Roll (Recepcion) | "P-10/I. Recepcion de materiales. P-14." | Texto descriptivo generico | **AGREGAR referencia SGC**: idem Insert |
| Insert/Top Roll (Proceso) | "Segun P-09/I." | Texto descriptivo | **AGREGAR referencia SGC**: Incluir "Segun P-09/I." al inicio del plan de reaccion |

#### 1.4 Tecnica de evaluacion: instrumentos especificos vs metodos genericos

| Producto | Operacion | PDF (correcto) | Supabase (actual) | Accion |
|---|---|---|---|---|
| Insert | Recepcion | "Patron de Aspecto", "Medidor de espesor", "Balanza", "Certificado del proveedor", "Calibre digital" | "Inspeccion visual", "Verificacion operativa", "Control dimensional" | **MEJORAR**: Agregar los instrumentos especificos del PDF a los items correspondientes |
| Top Roll | Recepcion | "Medidor de espesor", "Certificado del proveedor", "Balanza" | "Inspeccion visual", "Verificacion operativa" | **MEJORAR**: idem |
| Insert | Corte | "Myler" (plantilla de corte) | Generico | **AGREGAR** instrumento |

#### 1.5 Discrepancias menores en Headrest

| Producto | Elemento | PDF (correcto) | Supabase (actual) | Accion |
|---|---|---|---|---|
| Headrest (x6) | Frecuencia recepcion | "Por entrega." | "Cada recepcion" | **CORREGIR** a "Por entrega" (sin punto) |
| Headrest (x6) | Plan de reaccion recepcion | "P-10/I. Recepcion de materiales. P-14." | "Segun P-09/I." | **VERIFICAR**: Posible error de mapeo de columna. El PDF tiene P-10/P-14 para recepcion, no P-09. |

#### 1.6 Clasificacion CC/SC excesiva en CPs generados de AMFE

| Producto | PDF (correcto) | Supabase (actual) | Accion |
|---|---|---|---|
| Insert | SC solo en Flamabilidad vinilo y costuras SC1 | SC en TODOS los items con AP=H y AP=M del AMFE | **REVISAR**: El CP generado marca como SC muchos mas items que el PDF original. Reducir SC solo a los items que el PDF marca como SC. |
| Top Roll | SC solo en Flamabilidad vinilo | SC en todos los items generados | **REVISAR**: idem |

---

### Prioridad 2: MEJORAR (unificacion de estilo)

#### 2.1 Nombres de operacion

| Aspecto | Estilo CPs parseados (Headrest) | Estilo CPs generados (Insert/Top Roll) | Propuesta unificada |
|---|---|---|---|
| Capitalizacion | Mixed case: "Recepcion", "Costura Union" | MAYUSCULAS: "RECEPCIONAR MATERIA PRIMA", "COSTURA UNION" | **Usar el nombre del PDF de cada producto**. No forzar MAYUSCULAS. |
| Forma verbal | Sustantivo: "Recepcion" | Infinitivo: "RECEPCIONAR" | **Respetar la forma del PDF**. |
| Descripcion | Corta+descriptiva: "Set up de Maquina / Corte de Vinilo" | Generica: "CORTAR VINILO (MESA AUTOMATICA)" | **Usar nombre del PDF** de cada producto |

#### 2.2 Tamano de muestra y frecuencia

| Aspecto | Estilo PDF | Estilo Supabase generado | Propuesta |
|---|---|---|---|
| Tamano muestra | "1 muestra" (consistente en Insert/Top Roll PDF) | Variado: "100%", "3 piezas", "5 piezas" | **Respetar PDF**: Si el PDF dice "1 muestra", mantener. Los valores variados del CP generado no vienen del PDF. |
| Frecuencia | "Por entrega." (Insert/Top Roll/Headrest) | "Cada recepcion", "Cada lote" | **Estandarizar** a "Por entrega" para recepcion (como dice el PDF). |

#### 2.3 Formato de plan de reaccion

| Aspecto | Estilo PDF | Estilo Supabase generado | Propuesta |
|---|---|---|---|
| Referencia SGC | "P-10/I. Recepcion de materiales. P-14." | "Contener producto sospechoso. Verificar ultimas N piezas. Notificar a Lider." | **Hibrido**: Incluir referencia al procedimiento SGC del PDF + las acciones descriptivas del CP generado. Formato: "Segun P-XX/I. [acciones especificas]." |

---

### Prioridad 3: ACEPTABLE (no requiere accion)

1. **Headrest L0 (x3) son la referencia de calidad para CPs**: Fidelidad alta al PDF. Diferencias solo cosmeticas (acentos, formato frecuencia). No requieren cambios.

2. **Headrest variantes L1/L2/L3**: Heredados del L0. Si el L0 esta bien, las variantes estan bien. Verificar que la herencia funcione correctamente.

3. **CPs sin PDF (Telas Planas, Telas Termoformadas, Armrest)**: No hay PDF de CP original contra el cual comparar. Los CPs generados desde AMFE son la unica version y se aceptan como estan. Si en el futuro aparecen PDFs, re-auditar.

4. **Diferencias de acentos/tildes en Headrest**: "Recepcion" vs "Recepcion" (con/sin acento). Es un artefacto del encoding. No afecta la funcionalidad.

5. **Mapeo de columnas en Headrest**: El "control method" de Supabase contiene lo que en el PDF era el "plan de reaccion" ("P-10/I. Recepcion de materiales. P-14."). Esto es un mapeo de columnas diferente pero el dato esta presente en el documento. Aceptable si la interpretacion es consistente.

---

## PARTE 3: Estadisticas

---

### Items a CORREGIR por producto (AMFE)

| Producto | Ops inventadas | Causas inventadas | Fallas reclasificar | S/O/D a corregir | Textos truncados | Fallas/causas faltantes | Total items CORREGIR |
|---|---|---|---|---|---|---|---|
| Insert Patagonia | 3 | 2 | 1 | 5 ratings | 4 textos | 0 | **15** |
| Armrest Door Panel | 0 | 0 | 0 | 4 ratings | 0 | 4 (fallas+causas) | **8** |
| Top Roll | 0 | 0 | 1 (falla→causa) + 1 (falla inventada) | 0 | 0 | 0 | **2** |
| Telas Planas | 0 | 0 | 0 | 0 | 0 | 0 | **0** |
| Telas Termoformadas | 0 | 0 | 0 | 0 | 0 | 0 | **0** |
| Headrest (x3) | No verificable | No verificable | No verificable | No verificable | No verificable | No verificable | **N/A** |
| **TOTAL AMFE** | **3** | **2** | **3** | **9** | **4** | **4** | **25** |

### Items a CORREGIR por producto (CP)

| Producto | Specs numericas faltantes | Enfoque a decidir | Refs SGC faltantes | CC/SC a revisar | Frecuencia a corregir | Total items CORREGIR |
|---|---|---|---|---|---|---|
| Insert | 12 valores | 5 operaciones | 3 planes | Si (exceso SC) | 0 | **~20+** |
| Top Roll | 10 valores | 5 operaciones | 3 planes | Si (exceso SC) | 0 | **~18+** |
| Headrest Front L0 | 0 | 0 | 1 (verificar P-10 vs P-09) | 0 | 1 | **2** |
| Headrest Rear Cen L0 | 0 | 0 | 1 | 0 | 1 | **2** |
| Headrest Rear Out L0 | 0 | 0 | 1 | 0 | 1 | **2** |
| Headrest variantes (x9) | 0 | 0 | Heredado de L0 | 0 | Heredado | **(heredado)** |
| Armrest | Sin PDF para comparar | N/A | N/A | N/A | N/A | **N/A** |
| Telas Planas | Sin PDF para comparar | N/A | N/A | N/A | N/A | **N/A** |
| Telas Termoformadas | Sin PDF para comparar | N/A | N/A | N/A | N/A | **N/A** |
| **TOTAL CP** | **22** | **10 ops** | **9** | **2 productos** | **3** | **~44+** |

### Items a MEJORAR por producto

| Aspecto | Productos afectados | Cantidad de items estimada |
|---|---|---|
| Capitalizacion de operaciones (AMFE) | Insert, Top Roll | ~22 + ~11 = 33 nombres |
| Prefijo de seccion padre (AMFE) | Insert | ~8 operaciones |
| Puntos finales (AMFE) | Insert, Telas Planas | ~10 textos |
| Nombre OP90 extendido (AMFE) | Top Roll | 1 nombre |
| Nombres operacion (CP) | Insert, Top Roll | ~30 items |
| Tamano muestra / frecuencia (CP) | Insert, Top Roll | ~50 items |
| Plan reaccion hibrido (CP) | Insert, Top Roll | ~30 items |

### Estimacion de documentos afectados

| Tipo de correccion | Documentos master | Documentos variante (cascada) | Total |
|---|---|---|---|
| AMFE Insert: eliminar ops inventadas | 1 (AMFE-00001) | 1 (AMFE Insert L0) | 2 |
| AMFE Insert: corregir S/O/D | 1 | 1 | 2 |
| AMFE Armrest: corregir S/O/D + agregar fallas | 1 (AMFE-ARMREST-001) | 0 | 1 |
| AMFE Top Roll: reclasificar falla | 1 (AMFE-TOPROLL-001) | 0 | 1 |
| CP Insert: agregar specs + refs SGC | 1 (CP-INSERT-001) | 1 (CP-INSERT L0) | 2 |
| CP Top Roll: agregar specs + refs SGC | 1 (CP-TOPROLL-001) | 0 | 1 |
| CP Headrest L0 x3: verificar ref SGC | 3 | 9 (L1/L2/L3 heredan) | 12 |
| **TOTAL documentos a tocar** | **9** | **12** | **21** |

---

## Apendice: Orden de ejecucion recomendado

1. **Primero**: Decisiones de negocio
   - Decidir si las 3 operaciones inventadas de Insert se eliminan o se mantienen (consultar ingenieria).
   - Decidir estrategia para CPs de Insert/Top Roll: Opcion A (complementar) vs Opcion B (re-cargar).
   - Decidir si las operaciones extendidas de Armrest (inyeccion, PU) son correctas o del PDF.

2. **Segundo**: Correcciones de ratings S/O/D (AMFE)
   - Insert: 5 ratings a corregir.
   - Armrest: 4 ratings a corregir.
   - Son cambios de numeros puntuales, bajo riesgo.

3. **Tercero**: Correcciones de contenido (AMFE)
   - Insert: restaurar textos truncados, eliminar causas inventadas.
   - Armrest: agregar fallas/causas del PDF que faltan.
   - Top Roll: reclasificar falla→causa.

4. **Cuarto**: Enriquecimiento de CPs
   - Agregar 22 valores numericos de especificacion a Insert y Top Roll.
   - Agregar referencias SGC a planes de reaccion.
   - Revisar clasificacion CC/SC excesiva.

5. **Quinto**: Mejoras de estilo (baja prioridad)
   - Normalizacion de capitalizacion.
   - Limpieza de puntos finales.
   - Estandarizacion de frecuencias.

6. **Pendiente**: Headrest (x3)
   - Resolver lectura de PDFs para auditar contenido.
