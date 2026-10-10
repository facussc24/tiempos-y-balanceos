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
