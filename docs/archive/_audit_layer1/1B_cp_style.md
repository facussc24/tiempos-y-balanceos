# 1B - Auditoria de Estilo: Planes de Control (CP)

**Fecha**: 2026-03-23
**Comparacion**: PDFs originales vs datos en Supabase (JSON export)
**PDFs analizados**: 8 (Insert, Top Roll, Headrest Front L0/L1-L2-L3, Headrest Rear Center L0/L1-L2-L3, Headrest Rear Outer L0/L1-L2-L3)
**CPs en Supabase**: 18

---

## Hallazgo Principal

Los CPs de Supabase se dividen en **dos poblaciones de estilo completamente diferentes**:

1. **CPs con PDF de referencia (Headrest x6)**: Estos siguen fielmente el formato del PDF original. Los datos fueron parseados/copiados del PDF con minimas diferencias de estilo.

2. **CPs sin PDF de referencia / generados desde AMFE (Insert master, Top Roll, Armrest, Telas)**: Estos fueron generados automaticamente a partir de datos de AMFE/PFD con un estilo completamente distinto al de los PDFs originales de Insert y Top Roll.

---

## A. CP INSERT: PDF Original vs Supabase (CP-INSERT-001, master)

El PDF del Insert es un CP de produccion clasico estilo AIAG con items de recepcion de materia prima detallados por componente. El CP en Supabase (CP-INSERT-001, 314 items) fue **generado desde AMFE**, NO parseado del PDF.

### Tabla Comparativa - Operacion 10 (Recepcion)

| Elemento | PDF Original (PdC Insertos) | Supabase (CP-INSERT-001) | Diferencia |
|---|---|---|---|
| **Nombre de operacion** | "Recepcion" (sin numero explicito) | "RECEPCIONAR MATERIA PRIMA" (Op 10) | Supabase usa nombre de AMFE en MAYUSCULAS; PDF usa titulo corto |
| **Caracteristicas** | Caracteristicas de producto: "Tipo de Producto", "Color", "Torres de sujecion", "Dimensional de control", "Aspecto", "Espesor" | Caracteristicas de proceso: "Mala estiba y embalaje inadecuado", "Manipulacion incorrecta en transito", etc. | **DIFERENCIA CRITICA**: PDF lista caracteristicas de producto medibles; Supabase lista causas de falla del AMFE |
| **Especificaciones** | Valores concretos: "Plastico PP", "Negro", "min 1,5 - max 2,5", "<100 mm/min", "950cPoise +/- 15%" | Genericas: "Segun instruccion de proceso", "Color/variante segun OP" | **Se perdieron valores numericos** |
| **Tecnica de evaluacion** | Instrumentos especificos: "Patron de Aspecto", "Medidor de espesor", "Balanza", "Certificado del proveedor", "Calibre digital" | Metodos genericos: "Inspeccion visual", "Verificacion operativa", "Control dimensional" | PDF es mas especifico en instrumentos |
| **Tamano muestra** | "1 muestra" (consistente) | Variado: "100%", "3 piezas", "5 piezas", "1 pieza" | Supabase tiene mas variacion; PDF estandariza en "1 muestra por entrega" |
| **Frecuencia** | "Por entrega." (con punto final) | "Cada recepcion" (sin punto) | Diferente formato de frecuencia |
| **Plan de reaccion** | Referencia a procedimiento: "P-10/I. Recepcion de materiales. P-14." | Texto descriptivo largo: "Ajustar proceso. Reinspeccionar ultimo lote. Registrar desvio." | **DIFERENCIA CRITICA**: PDF referencia SGC; Supabase describe acciones |
| **Responsable** | No explicitado por item (implicito) | No incluido como campo separado | Consistente |
| **CC/SC** | SC solo en vinilo Flamabilidad | SC en todos los items de AMFE-AP H y M | Supabase tiene mas items clasificados |

### Tabla Comparativa - Operaciones de Proceso (Corte, Costura, etc.)

| Elemento | PDF Original | Supabase (CP-INSERT-001) | Diferencia |
|---|---|---|---|
| **Operacion Corte** | "Set up de Maquina (segun programa) - CORTE DE VINILO SANSUY PVC" con items: "Cantidad de Capas: 10", "Medir cuchilla >= 4mm", "Dimensional de Corte segun Myler" | Items tipo causa AMFE: "Falta de verificacion del filo de la cuchilla", "No se coloca la cantidad correcta de capas", etc. | PDF tiene params de set-up; Supabase tiene causas de falla |
| **Costura** | Items de aspecto visual: "Sin costura salteada", "Sin arrugas", "Sin falta de costura", "Sin costura floja", con spec "SC1" para puntadas/ancho | Items causa AMFE: "Error en la configuracion de la maquina de coser", "Operario sin capacitacion", etc. | Misma divergencia: PDF = que controlar; Supabase = que puede fallar |
| **Adhesivado** | "Adhesivo en buen estado", "Adhesivado completo", "Temperatura 85C +/-5C", "Velocidad: 4 mts/min" | Causas AMFE del adhesivado | **Se perdieron parametros criticos de temperatura y velocidad** |
| **Tapizado** | "Vinilo correctamente posicionado en matriz", "Tapizado sin arrugas", "Costura alineada 100mm +/-1mm" | Causas AMFE del tapizado | Se perdieron tolerancias dimensionales |
| **Inspeccion final** | "Control dimensional de piezas tapizadas" con calibre de control, "5 piezas por lote" | Items genericos de inspeccion | Diferente nivel de detalle |

---

## B. CP TOP ROLL: PDF Original vs Supabase (CP-TOPROLL-001)

Mismo patron que Insert: el PDF tiene un CP clasico con controles de producto, mientras que Supabase tiene un CP generado desde AMFE.

### Diferencias clave

| Elemento | PDF Original (PC_TOP ROLL) | Supabase (CP-TOPROLL-001, 94 items) | Diferencia |
|---|---|---|---|
| **Numero de operacion** | "Operacion 0.10 Recepcion" | Op "5" RECEPCIONAR MATERIA PRIMA | Numeracion diferente |
| **Material** | "Sustrato Plastico ABS" (item explicito) | No hay items de tipo de material | PDF especifica tipo de plastico |
| **Espesor vinilo** | "2,1 mm min 1,8 - max 2,4" | No hay especificacion numerica de espesor | Se perdio valor numerico |
| **Gramaje** | "740 +/- 10% min. 670 - max.820GMS/MT2" | No hay item de gramaje | Se perdio valor numerico |
| **Viscosidad adhesivo** | "950cPoise +/- 15%" | No hay item de viscosidad | Se perdio valor numerico |
| **Flamabilidad** | "SC <100 mm/min" con "Certificado del proveedor" | Items con SC pero sin valor numerico explicito | Se perdio valor de spec |
| **Corte** | "Cantidad de Capas: 2", "Medir cuchilla 4mm", "Dimensional segun Myler" | Causas AMFE genericas | Se perdieron params de set-up |
| **Adhesivado** | "Temperatura de horno seteada a 60-70C" | No hay item de temperatura | Se perdio parametro critico |
| **Tapizado** | "Pieza calentada 60 a 65 segundos dentro de horno", "Costura alineada 100mm +/-1mm" | Causas AMFE | Se perdieron tiempos y tolerancias |
| **Inspeccion** | "5 piezas por lote de inyeccion de sustrato plastico" | Item generico | Se perdio muestreo especifico |
| **Embalaje** | "8 piezas por cajon en bolsa" | Item generico | Se perdio cantidad especifica |

---

## C. CPs HEADREST (x6): PDF Original vs Supabase

Los Headrest PDFs son **preliminares** (muchos valores "TBD") y los CPs en Supabase fueron **parseados directamente del PDF**. La consistencia es mucho mejor.

### Headrest Front L0 (CP-HR-FRONT-L0, 54 items)

| Elemento | PDF Original | Supabase | Diferencia |
|---|---|---|---|
| **Operacion Recepcion** | "Recepcion" (Op 10) | "Recepcion" (Op 10) | COINCIDE |
| **Caracteristicas** | "Tipo de Producto", "Color", "Dimensional de control", "Aspecto", "Espesor" | "Tipo de Producto", "Color", "Dimensional de control", "Aspecto", "Espesor" | COINCIDE |
| **Especificaciones** | "TBD", "min 2,0 - max 2,5", "<100 mm/min", "min 800 - max 1000GMS/MT2" | "TBD", "min 2,0 - max 2,5", "<100 mm/min", "min 800 - max 1000GMS/MT2" | COINCIDE (valores preservados) |
| **SC Flamabilidad** | "SC" marcado en vinilo | "SC" en flamabilidad | COINCIDE |
| **Tecnica evaluacion** | "Medidor de espesor", "Certificado del proveedor", "Balanza", "Patron de Aspecto" | "Medidor de espesor", "Certificado del proveedor", "Balanza", "Patron de Aspecto" | COINCIDE |
| **Frecuencia** | "Por entrega." | "Cada recepcion" | DIFERENCIA MENOR: reformateo de "Por entrega" a "Cada recepcion" |
| **Plan de reaccion** | "P-10/I. Recepcion de materiales. P-14." | No visible como campo; referencia a "Segun P-09/I." | DIFERENCIA: PDF referencia P-10/P-14; Supabase usa "Segun P-09/I." |
| **Control method** | Implicito en columna "METODOS DE CONTROL" | "P-10/I. Recepcion de materiales. P-14." | OK: el plan de reaccion del PDF se mapeo al campo controlMethod |
| **Set-up maquina corte** | "Cantidad de Capas: TBD", "Medir cuchilla 4mm", "Segun Myler" | Items de set-up preservados | COINCIDE |
| **Costura** | "Sin costura salteada", "Sin arrugas", "Sin falta de costura", "Sin costura floja" | Items de costura preservados | COINCIDE |
| **Virolado** | "Virolado de todo el contorno", "Pegado correcto de pliegues", "Zonas criticas" | Items preservados | COINCIDE |
| **Ensamble** | "Correcta colocacion de Inserto en Funda", "Correcta colocacion de Asta" | Items preservados | COINCIDE |
| **Espumado** | Parametros TBD: Temperatura molde, Tiempo colada, Caudal, Relacion Poliol/Iso, etc. | Items preservados con TBD | COINCIDE |

### Diferencias menores en Headrests (aplica a los 6 PDFs)

| Elemento | PDF | Supabase | Tipo de diferencia |
|---|---|---|---|
| **Acentos/tildes** | "Recepcion" con acento en PDF | "Recepcion" sin acento en Supabase | Normalizacion de acentos |
| **Formato "min/max"** | "min 2,0 - max 2,5" con acento en min/max | "min 2,0 - max 2,5" sin acento | Normalizacion |
| **Frecuencia recepcion** | "Por entrega." | "Cada recepcion" | Reformulacion |
| **Plan reaccion** | "P-10/I. Recepcion de materiales. P-14." como control method | "Segun P-09/I." como reaction plan | Mapeo de columnas correcto |
| **Peso espuma** | "289" (Front), "62 gramos" (Rear Cen), "102" (Rear Out) | Valores preservados | COINCIDE |
| **Densidad** | ">= 65 km/m3" (Front), ">= 55 km/m3" (Rear) | Valores preservados | COINCIDE |

---

## D. Patrones Globales de Diferencia

### Patron 1: Dos origenes de datos completamente distintos

| Aspecto | CPs parseados de PDF (Headrest x6) | CPs generados de AMFE (Insert, Top Roll, Armrest, Telas) |
|---|---|---|
| **Fuente** | PDF original copiado a Supabase | Auto-generado desde causas de AMFE |
| **Estilo de caracteristicas** | Caracteristicas de PRODUCTO (que se mide) | Caracteristicas de PROCESO / causas de falla (que puede salir mal) |
| **Especificaciones** | Valores numericos del PDF: "min 2,0 - max 2,5", "<100 mm/min" | Genericas: "Segun instruccion de proceso", "Conforme a especificacion" |
| **Tecnica evaluacion** | Instrumentos: "Medidor de espesor", "Calibre digital", "Myler" | Metodos: "Inspeccion visual", "Verificacion operativa" |
| **Plan de reaccion** | Referencia SGC: "P-10/I. P-14." o "Segun P-09/I." | Acciones: "Contener producto. Verificar ultimas N piezas. Notificar a Lider." |
| **Cantidad de items** | 54-105 items (parseados del PDF) | 94-314 items (uno por causa AMFE) |
| **Estructura** | Agrupa por componente (sustrato, vinilo, hilo, adhesivo) | Agrupa por operacion AMFE |

### Patron 2: Perdida de valores numericos criticos

Los CPs generados desde AMFE NO transfieren los valores de especificacion que aparecen en los PDFs originales de Insert y Top Roll. Ejemplos de informacion perdida:

| Parametro | Valor en PDF | Valor en Supabase |
|---|---|---|
| Espesor vinilo Insert | "min 1,5 - max 2,5" | "Segun instruccion de proceso" |
| Gramaje vinilo Insert | "min 800 - max 1000 GMS/MT2" | No presente |
| Viscosidad adhesivo | "950cPoise +/- 15%" | No presente |
| Temperatura adhesivado Insert | "85C +/- 5C" | No presente |
| Velocidad adhesivado Insert | "4 mts/min" | No presente |
| Temperatura horno Top Roll | "60-70C" | No presente |
| Tiempo horno Top Roll | "60-65 segundos" | No presente |
| Tolerancia costura | "100mm +/- 1mm" | No presente |
| Capas de corte Insert | "10" | No presente |
| Capas de corte Top Roll | "2" | No presente |
| Puntadas costura Insert | "11 +/- 1 puntadas / 5 cm" | No presente |
| Ancho costura Insert | "6 +/- 0,5 mm" | No presente |
| Embalaje Top Roll | "8 piezas por cajon en bolsa" | No presente |
| Embalaje Insert | "6 piezas por cajon" | No presente |

### Patron 3: Clasificacion CC/SC

| Producto | PDF | Supabase | Observacion |
|---|---|---|---|
| Insert (PDF) | SC solo en Flamabilidad vinilo y costuras SC1 | SC en todos los items AP=H y AP=M del AMFE | Supabase tiene MAS items SC que el PDF; ninguno marcado CC |
| Top Roll (PDF) | SC solo en Flamabilidad vinilo | SC en todos los items generados | Mismo patron |
| Headrest L0 (PDF) | SC en Flamabilidad vinilo | SC en flamabilidad (si presente) | COINCIDE (pero mucho TBD) |
| Headrest L1-L3 (PDF) | SC en Flamabilidad vinilo | SC en flamabilidad (si presente) | COINCIDE |

### Patron 4: Nombres de operacion

| PDF Insert | PDF Top Roll | PDF Headrest | Supabase Insert (AMFE) | Supabase Top Roll (AMFE) | Supabase Headrest (parseado) |
|---|---|---|---|---|---|
| "Recepcion" | "Recepcion" | "Recepcion" | "RECEPCIONAR MATERIA PRIMA" | "RECEPCIONAR MATERIA PRIMA" | "Recepcion" |
| "CORTE DE VINILO SANSUY PVC" | "Corte de SANVEO PP PR CL81..." | "Corte de Vinilo SANSUY PVC" | "CORTAR VINILO (MESA AUTOMATICA)" | "CORTAR VINILO (MESA AUTOMATICA)" | "Set up de Maquina / Corte de Vinilo" |
| "Costura Union" | N/A | "Costura Union" | "COSTURA UNION" | N/A | "Costura Union" |
| "Adhesivado" | "Adhesivado de piezas" | N/A | "APLICAR ADHESIVO" | "APLICAR ADHESIVO" | N/A |
| "Tapizado semi-automatico" | "Tapizado semi-automatico" | N/A | "TAPIZAR (CONFORMADO SEMIAUTOMATICO)" | "TAPIZAR (CONFORMADO SEMIAUTOMATICO)" | N/A |
| "Virolado + Refilado" | "Virolado + Refilado" | "Virolado + Refilado" | "VIROLAR Y REFILAR" | "VIROLAR Y REFILAR" | "Virolado + Refilado de piezas" |
| "Inspeccion final" | "Inspeccion final" | "Inspeccion final + Sistema ARB" | "INSPECCION FINAL" | "INSPECCION FINAL" | "Inspeccion final + Sistema ARB" |

### Patron 5: Plan de reaccion - roles vs acciones

| Fuente | Estilo | Ejemplo |
|---|---|---|
| PDF Insert | Referencia a procedimiento SGC | "P-10/I. Recepcion de materiales. P-14." / "Segun P-09/I." |
| PDF Top Roll | Referencia a procedimiento SGC | "P-10/I. Recepcion de materiales. P-14." / "Segun P-09/I." |
| PDF Headrest | Referencia a procedimiento SGC | "Segun P-09/I." |
| Supabase (generados AMFE) | Texto descriptivo con roles | "Contener producto sospechoso. Verificar ultimas N piezas. Ajustar proceso. Notificar a Lider." |
| Supabase (parseados PDF) | Referencia SGC del PDF | "Segun P-09/I." |

---

## E. CPs sin PDF de Referencia

Los siguientes CPs en Supabase **NO tienen PDF original** con el cual comparar. Fueron generados integramente desde datos de AMFE:

| CP en Supabase | Items | Observacion |
|---|---|---|
| CP-TELAS-PLANAS-001 | 43 | Producto PWA, no hay PDF de CP en pdf-extracts |
| CP-TELAS-TERMO-001 | 22 | Producto PWA, no hay PDF de CP en pdf-extracts |
| CP-ARMREST-001 | ~170 | Producto VWA, no hay PDF de CP en pdf-extracts |
| CP-INSERT-001 [L0] | ~280 | Variante Insert, heredado del master (que a su vez es generado AMFE) |
| CP-HR-FRONT-L1 a L3 | ~105 c/u | Variantes de HR Front, heredadas del L0 (que si fue parseado del PDF) |
| CP-HR-REAR_CEN-L1 a L3 | ~60 c/u | Variantes de HR Rear Center, heredadas del L0 |
| CP-HR-REAR_OUT-L1 a L3 | ~60 c/u | Variantes de HR Rear Outer, heredadas del L0 |

**Nota**: Las variantes L1/L2/L3 de Headrest si tienen PDF de referencia (los PDFs "L1-L2-L3" cubren las tres variantes en un solo documento). Pero en Supabase se separaron en documentos individuales por variante.

---

## F. Resumen de Hallazgos

### Hallazgos Criticos (afectan contenido tecnico)

1. **Insert y Top Roll en Supabase NO reflejan el contenido del PDF original**. Fueron reemplazados por CPs auto-generados desde AMFE que tienen un enfoque diferente (causas de falla vs caracteristicas de producto).

2. **Se perdieron todos los valores numericos de especificacion** de los PDFs de Insert y Top Roll: espesores, gramajes, viscosidades, temperaturas, velocidades, tolerancias dimensionales, conteos de puntadas, cantidades de embalaje.

3. **La clasificacion CC/SC en los CPs generados de AMFE es mas amplia** que en los PDFs originales (todos los items con AP alto se marcan SC, mientras que el PDF solo marca SC en flamabilidad y algunas costuras).

### Hallazgos Menores (cosmeticos/formato)

4. **Nombres de operacion en MAYUSCULAS** en CPs generados vs mixed case en PDFs.

5. **Acentos y tildes** removidos en algunos campos de Supabase ("Recepcion" vs "Recepcion").

6. **Frecuencia de muestreo** reformateada: "Por entrega." (PDF) vs "Cada recepcion" (Supabase).

7. **Plan de reaccion** usa texto descriptivo en CPs generados vs referencia a procedimiento SGC en PDFs.

### Recomendacion

Si se necesita que los CPs de Insert y Top Roll en Supabase reflejen fielmente los PDFs originales, se requiere un trabajo manual de re-carga. Los CPs actuales generados desde AMFE son documentos validos desde la perspectiva de trazabilidad AMFE-CP, pero no contienen las especificaciones tecnicas concretas que el PDF original incluye.

Los CPs de Headrest (L0 x3) son los mas fieles a los PDFs originales, con diferencias solo cosmeticas.
