# P6 — Skill `planes-de-control`: investigación (parte hecha desde esta PC) y plan

Escrito el 10/10/2026 por el orquestador (Fable 5.1). Fak, 09/10/2026 16:55: **SÍ, empezar la investigación en el
servidor** (*"no somos muy buenos haciéndolos"*). El servidor no está visible desde esta red (el nombre `server` no
resuelve: la PC está en otra red, no en la de Barack), así que esta nota cubre lo que hay en esta PC y deja marcado lo
que falta mirar en `Y:`. Regla de rol (`autonomy-contract.md`): **el Plan de Control es de Calidad**; Ingeniería arma
una base preliminar alineada con el flujograma y el AMFE **solo si Fak la pide**. La skill es para eso: que esa base
salga en el formato de Calidad, completa y sin los errores que Calidad ya nos marcó.

## 1. El formato actual de Calidad (medido en `PC APB PATAGONIA Rev 0.xls`, N. Pérez, 25/09/2026)

Formulario `I-AC-005.1` (la hoja `Rev.` del archivo dice la revisión del FORMULARIO, no la del documento: trampa
conocida, memoria `project_planes_control_patagonia_estado`). Un libro `.xls`, **una hoja por pieza** (`PC APB`,
`PC INSERTO`, `PC Top Roll`), cada hoja con:

- **Carátula** (filas 1-46): PLAN DE CONTROL · proveedor BARACK, código, teléfono · descripción · Nº de parte · tabla
  **REVISIONES** (`REV. | FECHA | ITEM CAMBIADO | DETALLES | FECHA PSW | MODIFICO`; la emisión inicial es `0` con
  `N/A` y `EMISION INICIAL`) · **FIRMAS DE APROBACIÓN**: CALIDAD · PRODUCCION · INGENIERIA · CLIENTE.
- **Encabezado del plan** (filas 59-68): PROTOTIPO / PRELANZAMIENTO / PRODUCCIÓN · Núm. de plan de control · Núm. de
  la pieza · Nombre de la pieza · Proveedor/fábrica · Contacto/teléfono · Equipo (`PEREZ/BAPTISTA/MESZAROS`) · Cliente
  · Código del cliente · Fecha (orig) · Fecha (rev) · Fecha FUM · **Característica S/R: SI / NO** · Aprobación del
  cliente.
- **Columnas** (filas 69-72): `Nº PIEZA / PROCESO` · `NOMBRE DEL PROCESO` · `MÁQUINA, EQUIPAMIENTO, HERRAMIENTAS` ·
  CARACTERÍSTICAS (`Nº` · `PRODUCTO` · `PROCESO`) · `CLASIF. CARAC. ESPEC.` · MÉTODOS (`ESPECIFICACIONES / TOLERANCIAS`
  · `CALIBRES O TÉCNICAS DE EVALUACIÓN` · MUESTRAS `TAM` · `FREC` · `MÉTODOS DE CONTROL Y REGISTRO`) · `RESPONSABLES`
  · `PLAN DE REACCIÓN`.
- **Filas**: una por característica; la operación va en la primera fila del grupo (`Operación 10.` / `Recepción de
  materiales.`), los materiales de recepción numerados (`1.0 Vinilo…`, `2.0 Hilo…`) y debajo sus características
  (color, espesor, flamabilidad `<100mm/min` con cámara, ancho con cinta métrica, gramaje con balanza, cabos, artículo,
  certificado, vencimiento, lote). Recepción: `1 Pieza · Por entrega · P-10/I · Recepción de materiales · P-14`.

Esto coincide con el esquema `cp_documents.items[]` de la app (skill `apqp-schema`), salvo que la app no tiene
`Nº` de característica, `Característica S/R`, `FECHA PSW` ni las firmas; y `classification` de la app acepta `CC`/`SC`
mientras los planes de la casa usan **`D`** para flamabilidad (memoria `reference_planes_control_recepcion_barack`).

## 2. Lo que el instructivo exige (`I-AC-005` rev. B, §5.2, caché `.sgc-cache/sgc/`)

El plan de control **contiene**: todas las características y operaciones del flujograma, hojas de proceso o fichas
técnicas; las acciones recomendadas salidas del AMFE; las características especiales del cliente y de la organización;
los planes de muestreo según `P-10`. Hay tres: Recepción (Anexo II, aprobación interna), Prelanzamiento (más muestreo,
menos frecuencia) y Producción (Anexo I; aprobación del cliente si la pide). La revisión va en rojo; los cambios se
registran en la primera hoja del propio formato (recepción: al pie). Criterio de siglas: el de `caracteristicas-especiales.md`.

## 3. Lo que Calidad y la auditoría de Ingeniería nos marcaron (evidencia de errores a evitar)

De `exports/PC_NICO_20261006/QUE QUEDA PARA LA REUNION CON NICO.txt` (06/10/2026, 36 celdas corregidas, cuatro
revisores): operaciones del flujograma que faltan en el plan (51, 60, 71, 81, 82, 101 del 153 Rev. E; 111 del 154);
control final que mira la costura equivocada (la oculta en vez de la vista); costura vista sin fila de atraque; set up
con texto de otra máquina; parámetros de máquina sin valor; dos fichas de embalaje vigentes y una sola en el plan;
etiquetas en la BOM y en ninguna recepción; columna de características especiales vacía (siglas del AMFE 161);
`Característica S/R` con SI y NO marcados; un calibre (MC212) con certificado externo NO OK; códigos de hilo del arb
sin color. **Son los chequeos de la skill.**

## 4. La skill (plan; se escribe cuando Fak pida la primera base preliminar)

- **Entradas**: flujograma vigente (`tools/flowchart/data/*.json`), AMFE vigente (Supabase live), BOM del arb (último
  nivel), planes de recepción por familia de material (servidor), hoja de proceso (parámetros y set up), fichas de
  embalaje vigentes.
- **Salida**: el `.xls` en el formulario de Calidad, una hoja por pieza, con la tabla de revisiones en `0 / EMISION
  INICIAL`, las firmas vacías y **sin nada que diga que lo hizo Claude** (`_sinFirmaIA.py`).
- **Gates ejecutables** (`scripts/_lib/planControlCheck.mjs`, cada uno con gemelo rojo): (1) toda operación del
  flujograma tiene al menos una fila; (2) todo material de la BOM tiene su recepción, con el instrumento del plan de
  recepción de su familia; (3) la columna de clasificación = unión de las siglas de las causas del AMFE de esa
  operación, y `D` para flamabilidad; (4) ninguna especificación numérica sin papel (hoja de proceso, ficha, plano);
  lo que no tenga papel va `TBD` y a la lista para Calidad; (5) `Característica S/R` una sola marca; (6) frecuencias
  según `P-10`, nunca inventadas; (7) el control final mira la característica visible/funcional, no la oculta.
- **Gate 8 (Fak, 10/10 18:58)**: *"los controles de detección del AMFE no coinciden con los del plan de control, o
  los AMFE tienen controles medio inventados o genéricos"* → el control de detección de cada causa del AMFE tiene que
  ser el método del plan de control de esa operación (mismo instrumento, misma frecuencia), y al revés: una fila del
  plan sin causa en el AMFE o una causa con un control que el plan no tiene se listan como diferencia. La app ya
  tiene el vínculo (`cp.items[].amfeCauseIds`): se usa. Y la skill de AMFE recibe el mismo gate (fila nueva en la cola).
- **Lo que no hace**: no asigna siglas (las calcula y las muestra con S y O; asigna Fak), no inventa parámetros, no
  manda nada a Calidad (eso lo decide Fak, por mail con `_mailEnviar.py`).

## 5. Lo que necesita el servidor (no se pudo hoy)

- Los **31 planes de recepción** por familia (`Y:\BARACK\CALIDAD\DOCUMENTACION SGC\Recepcion De Materiales\1 - Planes
  de control\<familia>\`) y `LISTADO PC PATAGONIA.xlsx`: para la tabla instrumento ↔ característica ↔ criterio.
- El formulario oficial vacío `I-AC-005.1` (Rev. C, Jun.26) para generar sobre la plantilla y no sobre un plan ajeno.
- Los planes de Cecilia Rodríguez de otros clientes (PWA, Toyota, Mirgor: instructivos `I-AC-034`, `I-AC-041`,
  `I-AC-042` ya están en caché) para ver si el formato cambia por cliente.
- `P-10` (muestreo) en caché: verificar que esté en `.sgc-cache/sgc/`.

## 6. Qué necesita a Fak

Nada urgente: ya dijo que sí. Cuando pida la primera base preliminar, se le muestra el `.xls` generado sobre la
plantilla oficial con los TBD listados, y él decide si va a Calidad.

## 7. Revisión por la API (Opus, 10/10/2026 20:38, US$0,33; informe completo en `.sgc-cache/sesion-2026-10-10/API_P6_revision_opus.md`)

Lo que cambia del plan de arriba. Verificado contra el código donde la API no lo veía: la sigla de una causa SÍ
existe en el AMFE (`specialChar` de la causa; `amfeValidator.mjs:978`), y el flujograma vigente es UNO solo,
`tools/flowchart/data/*.json` (`pfd_documents` es histórico de solo lectura, regla `no-pfd-no-ho.md`).

### 7.1 Gates corregidos y nuevos

- **Gate 0 (nuevo, antes de generar)**: revisión de cada entrada registrada, y la lista de operaciones del
  flujograma que no tienen operación en el AMFE (el 153 Rev. E tiene 51, 60, 71, 81, 82 y 101 que el AMFE 161
  no analiza). Esas filas salen igual, con la característica de la HO o `TBD`, marcadas «sin análisis AMFE»:
  la diferencia es del AMFE, no del plan.
- **Gate 1 (corregido)**: «una fila por operación» da verde con la 41 de una sola fila y faltan atraque y
  alineación. Cada `qcItem` o punto clave de calidad de la HO tiene su fila; cada causa del AMFE con control
  de detección tiene su fila (gate 8). Transporte y almacenamiento sin característica van a la lista para Fak,
  no a una fila forzada.
- **Gate 2 (corregido)**: el mapeo material → familia de recepción no existe (las ET-SATO no tienen familia;
  el último nivel del arb trae semielaborados propios que no se reciben). Tabla explícita código → familia con
  marca compra/fabricación; lo que no está en la tabla va a recepción con instrumento `TBD`.
- **Gate 3 (corregido, el error más grave del plan)**: la sigla es de la CARACTERÍSTICA, no de la operación, y
  en el plan **no se calcula: se copia** del `specialChar` de las causas vinculadas por id (`amfeCauseIds`),
  que asignó Fak en el AMFE, más lo que el cliente designó en el plano (hoja de características especiales:
  entrada que faltaba, I-AC-005 §5.2). El cálculo por S/O va a una hoja aparte «Propuesta de siglas»
  (característica, causa, S máxima de la falla, O, regla) y la columna del plan queda vacía donde no hay
  asignación. La `D` no sale de la palabra «flamabilidad»: sale del plano o de la norma del cliente.
- **Gate 4 (corregido)**: «sin papel» miraba solo números y solo presencia. Toda celda de contenido
  (especificación, instrumento, frecuencia, parámetro, máquina) lleva `sourceRef` (documento, revisión,
  ubicación); texto inventado («5 capas», «sello WQ») cae igual que un número; si dos papeles difieren
  (HO-971 190-210 °C vs receta 185 °C; vencimiento 6 meses vs 179 días) el valor es `CONFLICTO` con los dos
  valores en la lista. **El AMFE no es papel para una especificación** (Fak 18:58: tiene controles inventados).
- **Gates nuevos por los errores del 06/10 que ninguno cubría**: (a) instrumento contra el cronograma de
  calibración (existe, área correcta, certificado OK: el MC212); (b) la máquina de la fila y su set up son los de
  esa operación en la HO o el flujograma (el set up de la 30 con texto de máquina de coser); (c) todas las
  fichas de embalaje vigentes de la pieza tienen fila (GE-280 y GE-276); (d) código de la BOM contra código de
  la HO (`FX284TK` vs `FX284` → `CONFLICTO`); (e) celda vacía prohibida: vale o `TBD` (parámetros de la 70 y
  la 80).
- **Gate 6 (corregido)**: `P-10/I` es de recepción. Para proceso la frecuencia sale de la HO; si no está,
  `TBD`. La fase (prototipo / prelanzamiento / producción) es una ENTRADA: sin ella no se sabe qué muestreo
  aplica.
- **Gate 7 (corregido)**: «la costura vista» no está en ningún dato. El control final acepta solo
  características marcadas apariencia/función en una fuente (plano, HO de la 100, especificación del cliente);
  nada de heurística por palabras.
- **Gate 9 (nuevo)**: las acciones recomendadas del AMFE entran al plan solo con estado implementado; una
  `Pendiente` copiada declara un control que no se hace. Las demás van a la lista.
- **S/R**: SI/NO sale de la asignación (hay CC o D de seguridad/reglamentaria); sin asignación, `TBD`.
- **`.xls`**: xlutils pierde logo y formato; completar la plantilla oficial por Excel COM. `_sinFirmaIA.py`
  limpia también Autor, Guardado por, autor de comentarios, propiedades personalizadas y hojas ocultas.

### 7.2 Gate 8 (AMFE ↔ plan): diseño

Tres capas, en este orden: (1) **vínculo por id** (`amfeCauseIds`; las filas de HO, recepción o embalaje con
`sourceRef`): la herramienta **nunca** vincula por parecido de texto; (2) **instrumento + frecuencia + tamaño de
muestra**: el instrumento se identifica por código de catálogo o calibración (MC212, cámara de flamabilidad,
Mylar) o término exacto del catálogo; (3) **texto**: se muestra, nunca decide.

Cuatro correcciones al gate 8 del §4: el control de detección puede estar **aguas abajo** (una causa de la 41
detectada en el control final 100: AIAG-VDA 2019 paso 5), así que el vínculo cruza operaciones; «actual» =
implementado (lo planificado es acción del paso 6 y no entra como control); las filas de set up, parámetros y
poka-yoke se vinculan al control de **prevención**, no al de detección; la frecuencia se compara solo si el
`detectionControl` la trae.

| Estado | Condición | Qué hace |
|---|---|---|
| OK | vínculo + instrumento coincide + frecuencia coincide o el AMFE no la tiene | nada |
| GENÉRICO | el AMFE dice «inspección visual» y no hay instrumento identificable | propone cambiar el AMFE (y re-evaluar la D: una inspección visual no sostiene una D baja, puede cambiar el AP) |
| DIFERENTE | los dos concretos y distintos | frena; decide Fak |
| SIN FILA | causa con control y el plan sin fila | lista (se agrega la fila solo si hay papel; si no, el AMFE declara un control que no existe) |
| SIN CAUSA | fila del plan sin causa | lista, separando recepción y requisito de cliente |

Quién manda: ninguno por default (IATF 8.5.1.1: el plan incorpora las salidas del análisis de riesgo y se
revisa cuando cambia). La verdad es lo que se hace y tiene papel. La herramienta no toca el AMFE.

### 7.3 Modelo de datos: JSON intermedio, no Supabase

Un JSON propio, superconjunto de `cp_documents.items` (mismos nombres más campos opcionales), y un render al
`.xls`; los gates corren sobre el JSON (directo al `.xls` no se testea). **No se escribe en `cp_documents`**: el
plan es de Calidad y quedarían dos «vigentes». Lo que falta: `productCharacteristic` / `processCharacteristic`
separados (columnas PRODUCTO y PROCESO del formulario), `characteristicNumber` (globo del plano o `TBD`;
recepción `1.0`, `2.0`), `classification` como lista (`CC` + `D`), encabezado (`phase`, `cpNumber`, proveedor,
contacto, equipo, código de cliente, fechas original/revisión/FUM, `srCharacteristic`), `revisions[]`,
`approvals`, y por fila `sourceRef[]`, `status` (`OK` / `TBD` / `CONFLICTO`), `hoQcItemId`, `materialCode`,
`materialFamily`.

### 7.4 Etapas con respuesta conocida (el APB Patagonia que Calidad corrigió el 06/10)

1. **Lectura de fuentes, JSON intermedio y gates 0, 1, 2, 4, 6 y los del 06/10. Sin `.xls`.** Tiene que
   salir: operaciones 51, 60, 71, 81, 82, 101 sin análisis; GE-280 y GE-276; ET-SATO con instrumento `TBD`;
   `CONFLICTO` hotmelera y hilo; `TBD` parámetros 70 y 80; filas de atraque y alineación de la 41 desde la
   HO-971; MC212 marcado; set up de la 30 sin texto de costura. Aprobación: cero celdas con valor sin
   `sourceRef`.
   **Hecha el 10/10/2026 (hija 6, Fable; commit en `git log` con «P6 etapa 1»)**: `scripts/_lib/planControlFuentes.mjs`
   (lectores), `scripts/_lib/planControlCheck.mjs` (`armarPlan()` + los gates, cada uno con gemelo rojo),
   `scripts/_planControl.mjs APB` (Supabase solo lectura), `scripts/_lib/planControlEntradas.data.json` (las
   entradas declaradas del APB), `__tests__/scripts/planControlCheck.test.mjs` (31 tests sobre fixtures de
   `__tests__/fixtures/planControl/`, sin Supabase; 31 tests). Diseño del JSON revisado por la API (Opus, US$0,17,
   `.sgc-cache/sesion-2026-10-10/API_P6_diseno_json_opus.md`): se tomaron el `catalog` por fuente (los gates
   leen solo el JSON), `sourceRef.loc` estructurado, `rowOrigin`, `instrumentCode`, ids deterministas, el
   estado de fila derivado y la mutación comparada por `sourceRef`; lo de IATF 8.5.1.1 (primera/última
   pieza, error proofing) queda para la etapa 2. Diff revisado por la API antes del auditor (Opus, US$0,31,
   `.sgc-cache/sesion-2026-10-10/API_P6_revision_diff_opus.md`, 25 puntos): se aplicaron los reales (el plan de
   reacción se lee del bloque de la HO en vez de un texto fijo; cada convención del formulario entra solo con su
   clave escrita en las entradas; el encabezado, el origen de fila, los conflictos y los pendientes colgados
   entran al gate 4; el gate 1 frena con una HO sin ítems; el vínculo causa→fila es solo por tabla explícita, nunca
   por el número 1.0/2.0 del formulario; la descripción de las fichas se recortó a lo que dice el txt; el ciclo de
   control se cierra en el pie de la hoja; rangos «90 al 93» y «92-90»). Límites que quedaron escritos en el código:
   `codigosEnHo` solo reconoce códigos con la forma de los hilos (FX284-E0PTO) y `codigoInstrumento` solo MC + 3
   cifras.
   Auditor Opus al final (`.sgc-cache/auditorias/P6_etapa1_auditor_2026-10-10.md`): tres errores reales, aplicados
   (un rol «OP / CC» expandido sin leyenda en la HO; la columna B combinada duplicaba el plan de reacción en las
   hojas 51; la característica de la hotmelera seguía mostrando «190 y 210» con la especificación en CONFLICTO:
   ahora las dos celdas van a CONFLICTO). Lo que dejó como riesgo y queda abierto: el gate de calibración lee el
   plan viejo por fuera del JSON (diagnóstico), el gate 0 solo avisa (por diseño), «Según plan de control» puede
   entrar como frecuencia si la HO lo escribe ahí, los flujogramas 152 y 158 tienen números de paso repetidos (ids
   repetidos si se usaran), recepción = 10 y embalaje = 110 están fijos.
   **Lo medido sobre el APB live (75 filas, 373 pendientes, 2 FRENO, 198 avisos, cero celdas con valor sin
   `sourceRef`; `exports/PLAN_CONTROL_APB_20261010/`)**, contra lo que esperaba esta sección:
   - **51, 60, 71, 81, 82, 101**: el AMFE 161 vivo (`AMFE-ARM-PAT`, rev A del 05/10/2026) **sí las analiza**: el
     gate 0 da cero. Las seis faltaban en el **plan de Calidad**, no en el AMFE (el 06/10 lo dijo así y el §7.1
     lo leyó al revés). Salen del cruce flujograma ↔ plan existente, junto con la 21 y la 22 (que Calidad tenía
     adentro de la 20); el gemelo rojo del gate 0 (AMFE sin esas seis) las lista exactas.
   - **GE-280 y GE-276**: una fila cada una con el nombre (lo dice el txt del 06/10, leído) y el contenido TBD.
   - **ET-SATO**: dos filas de recepción con instrumento TBD y sin familia; los INY-APB000x no se reciben.
   - **CONFLICTO hotmelera**: la HO-971 (Excel del 07/10, hoja 80) dice 190-210 y la receta de la máquina
     (pantalla HMI del 26/08, fuente declarada) 185 °C: la fila queda en CONFLICTO con los dos valores.
   - **CONFLICTO hilo**: la HO-971 de esta PC **ya dice FX284-E0PTO** (se corrigió el 07/10): hoy no hay
     conflicto; con el texto del 06/10 (FX284TK-E0PTO) la fila del hilo queda en CONFLICTO (probado en el test).
   - **70 y 80**: la HO tiene la 70 en «PENDIENTE / TBD» y en la 80 solo la temperatura: todo lo demás TBD; el
     plan de Calidad tiene 9 parámetros de la 70 y 4 de la 80 en «Ver hoja de operaciones».
   - **41**: atraque (3 a 4 puntadas) y alineación de la línea vista salen de la hoja 41 de la HO, con su celda.
   - **MC212**: FRENO (certificado externo NO OK, control de proceso en Conversión de Cintas; el dato es del txt
     del 06/10, el cronograma no se ve desde acá). Es el único FRENO del APB: el plan «no aprueba» hasta que
     Calidad lo confirme. MC167 (cuchilla) queda como aviso sin dato.
   - **Set up de la 30**: la fila sale TBD sin ninguna referencia a la 40/41; el set up del plan de Calidad
     (30, 40 y 41 con el mismo texto) no tiene ni una palabra en la HO de su operación.
   - **Mutación sin HO**: cero celdas citan la HO, lo que solo venía de ella pasa a TBD, no aparece ningún valor
     nuevo y el gate 1 frena por «fuente HO ausente» (no aprueba en vacío).
   - **Siglas**: en el APB vivo ninguna causa tiene `characteristicNumber` y no hay tabla de vínculos, así que
     las 171 causas con control quedan listadas «sin fila» (aviso) y la columna de siglas vacía: es lo esperado
     de la etapa 1; vincularlas es el gate 8 (etapa 2).
   - **Lo que no se vio desde esta red** (sigue): planes de recepción por familia (tabla código → familia de
     EJEMPLO en las entradas), fichas GE-280/GE-276, cronograma de calibración, plantilla I-AC-005.1 vacía.
2. **Propuesta de siglas, gate 7 y gate 8.** La propuesta sobre el AMFE 161 en la hoja aparte y la columna
   vacía; con la asignación, la columna igual a la asignación; el control final marcado («4 en 16 mm» es la
   costura de unión, no la vista «6 en 25 ±0,5»); el reporte del gate 8 con un gemelo rojo por estado.
3. **Render sobre la plantilla oficial I-AC-005.1 Rev. C, limpieza y lectura de vuelta.** Bloqueada hasta el
   servidor. Respuesta conocida: en las 36 celdas del 06/10 el `.xls` nunca trae el valor ANTES.

### 7.5 Las tres pruebas antes de mostrarle el primer `.xls` a Fak

1. **No inventa (mutación)**: sin la HO-971 en las entradas, todo lo que venía de ella pasa a `TBD` y no
   sobrevive ninguno; lo mismo sin una ficha de embalaje y sin el plan de recepción de una familia.
2. **Regresión contra el 06/10**: ningún valor ANTES reaparece; cada ítem pendiente del APB aparece como fila,
   `TBD`, `CONFLICTO` o diferencia del gate 8.
3. **Archivo entregable**: se abre en el Excel de Calidad; plantilla intacta (logo, celdas combinadas, área de
   impresión, revisión en rojo); S/R una marca o `TBD`; siglas solo desde la asignación; «Claude», «IA»,
   «Fable», «Anthropic» en celdas, comentarios, metadatos y hojas ocultas: cero.

Lo que la revisión confirmó que está bien: la trampa de la hoja `Rev.`, que la herramienta no mande nada a
Calidad, y los `TBD` listados.

### 7.6 Seis casos de prueba más para el gate 8 (cola HOY-18e, 10/10/2026)

Tomados de la lista de chequeos de `migmcc/quality-docs-validator` (MIT; leído el 10/10/2026 en la segunda pasada
por GitHub, `docs/PLAN_HOY18_GITHUB_SEGUNDA_PASADA_2026-10-10.md` §4). **No se toma su programa**: se toman los seis
casos como pruebas del gate 8 y de los gates de arriba, cada uno con el criterio de la casa. Ese repo corta la
«severidad alta» en S ≥ 8 y declara sus hallazgos «potenciales, para que los juzgue un ingeniero»; acá la crítica
es S 9-10 (`caracteristicas-especiales.md`) y lo que decide es el estado del reporte del §7.2.

| Caso del repo | Lo que mira | Cómo entra acá |
|---|---|---|
| `UNMATCHED_PROCESS_STEP` | una operación que está en uno solo de los dos documentos, en los dos sentidos | gate 0 (flujograma → AMFE) y gate 8 `SIN FILA` / `SIN CAUSA` por operación; aviso, no freno |
| `MISSING_CONTROL` | fila del plan sin método de control | gate «celda vacía prohibida» (§7.1, errores del 06/10): vale o `TBD`; freno |
| `SPECIAL_CHARACTERISTIC_NOT_CONTROLLED` | característica especial del AMFE que el plan no marca | gate 3: la sigla del plan se copia del `specialChar` de las causas vinculadas; una causa con sigla y fila sin sigla es `DIFERENTE`; freno |
| `MISSING_REACTION_PLAN` | severidad alta sin plan de reacción | toda fila lleva plan de reacción (el formulario lo exige, columna `PLAN DE REACCIÓN`); sin papel va `TBD`; para S 9-10 es freno, para el resto aviso |
| `WEAK_DETECTION_METHOD` | el control de detección es «inspección visual» | estado `GENÉRICO` del §7.2 (propone cambiar el AMFE y re-evaluar la D) |
| `HIGH_SEVERITY_WEAK_CONTROL` | severidad alta con control débil | `GENÉRICO` sobre una causa con S 9-10: sube a freno (`DIFERENTE`) porque una CC no puede quedar con un control que no se puede identificar |

Caso de respuesta conocida (el APB del 06/10, §7.4): el `UNMATCHED` tiene que listar 51, 60, 71, 81, 82 y 101; el
`SPECIAL_CHARACTERISTIC_NOT_CONTROLLED`, la columna de características especiales vacía frente a las siglas del AMFE
161; el `MISSING_CONTROL`, los parámetros de la 70 y la 80. Lo que pidió Fak el 10/10 18:58 (que los controles de
detección del AMFE y los del plan sean los mismos) no está en ese repo: es el §7.2 entero.
