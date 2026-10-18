# Tanda 14 · La gente de Barack: el paquete por persona (17/10/2026)

Puntos 11 a 20 del plan del sistema (tanda 14, parte D; informe `D_gente_barack.md` del 15/10). Para Federico, Carlos y
Pedro: qué le preguntan a Fak, qué hacían con su asistente de área antes de la cuarentena y qué les daría el suyo. Más
los puntos 16 a 19 como diseño. Nada de esto tocó el arb, el servidor `Y:`, Outlook ni Supabase; ningún mail salió.

**De dónde sale cada número** (medido el 17/10 entre las 19:30 y las 20:15):

- **Mails**: la copia local `.mail-cache/mails.jsonl` (6.165 renglones, del 01/09/2023 al 16/10/2026 16:49), sin
  repetidos (un mismo mail en la Bandeja y en Eliminados cuenta una vez: `scripts/_lib/lectorMails.mjs`). Solo se leyó
  el asunto, el remitente y el principio del cuerpo; de los mails de Pedro, solo el asunto (uno trae su clave de API).
- **Lo que hacía cada asistente**: los 109 avisos que dejaron en
  `Ingeniería y Proyecto - General\_CUARENTENA_CLAUDE POR AREA\4- BUZON\avisos\` (del 03/10 al 13/10), sus archivos de
  salud (`…\4- BUZON\salud\`) y el aporte de Federico (`…\4- BUZON\aportes\Federico Kipersain - Producción\`).
- **La BOM**: el export local del arb que ya estaba en la PC (`C:\tmp\RELACIONES.TXT`, hecho el 13/10 08:42), leído con
  `scripts/_consumo.py`, que no abre el arb. Tiene 4 días: lo que diga de un consumo «puede estar viejo».
- Los conteos «de BOM o consumos» son por palabras del asunto y del principio del cuerpo (bom, arb, consumo, código,
  insumo, semielaborado, unidad, MRP): sirven de orden de magnitud, no son una clasificación leída mail por mail.

Las tres herramientas nuevas de esta tanda (solo leen la copia de mails; salidas en `exports/` del checkout principal):

| Herramienta | Qué contesta | Lo que dio hoy |
|---|---|---|
| `node scripts/_adjuntosIndice.mjs [--buscar "<palabras>"]` | En qué mail está un 3D o un DXF, por pieza y versión, con los asuntos al lado | 311 adjuntos de diseño y 120 comprimidos sin abrir; «estanteria inserto» trae los dos mails de agosto (25/08 `ESTANTERIA INSERTO -1.rar`, 28/08 `ESTANTERIA ARMADA ESPUMA INSERTO.rar`) → `exports/adjuntos_3d_dxf_2026-10-17.md` |
| `node scripts/_plannerCarlos.mjs` | Las tareas del Planner «Actividades Ingenieria» de Carlos, de los avisos por mail: vencimiento y estado según el último aviso (asignada, por vencer, vence hoy o vencida; los mails no dicen si se completó) | 38 tareas asignadas a Fak (12/11/2025 al 23/06/2026), 33 con aviso de vencida, último aviso de vencida el 08/07. El «50 avisos de vencidas» del informe D son los 50 mails en inglés con asunto «You have late tasks» (34 dicen eso adentro y 16 «You have a late task»); con los otros avisos de vencimiento (por vencer, vence hoy, en castellano) son 76 mails → `exports/planner_carlos_2026-10-17.md` |
| `node scripts/_incaParte.mjs` | El parte semanal de VW (INCA): piezas sin acuerdo de capacidad y acuerdos en rojo | 29 partes (11/03 al 14/10); el del 14/10 trae 6 piezas sin acuerdo; el B00000330933 (apoyabrazos trasero) estuvo en rojo en 17 partes, del 15/04 al 26/08. A la copia le faltan los partes del 27/05, 03/06 y 10/06: son 17 partes, no 17 semanas corridas → `exports/inca_parte_2026-10-17.md` |

---

## Federico Kipersain — Planificación (PCP), PC `DESKTOP-OV373UE`

### Qué le pregunta a Fak

- **20 mails suyos desde el 01/06**, todos a Fak en «Para». **12 son de BOM, consumos o materiales**: «TRO-TEL0001-V1 -
  Refuerzo troquelado telas termoformadas: consumo verificado» (31/08, dos), «ERROR BOM» (31/08 y su respuesta del
  01/09), «Consulta Carcasa IP PAD» y «BOM IP Pad» (02/09), «Consulta BOM 21-9902» y «Consulta BOM» (04/09),
  «Consulta Consumo Hilos» (21/09), «Material Felpa 21-6416» (22/09), «BOM - reunión hoy» (13/10: *«Encontré una BOM en
  un archivo. ¿Querés que nos reunamos hoy…?»*), «TNT80 uso post EOP Amarok» (16/10). Los otros 8: los datos de PCP
  que le pidió Fak (20/08, dos), demanda (02 y 03/09), «Consulta Material» (09/09), un saludo (06/10), un pedido para
  su asistente (06/10) y la confirmación de que instaló la última versión (13/10).
- **El pedido abierto desde el 06/10 no está en un mail: está en su aporte** (`Conocimiento PCP para compartir -
  2026-10-06.md`, al final, «Qué falta para publicarlo»): *«Que Ingeniería valide el punto 5»* (cómo se saca y se lee
  la bajada de consumos del arb). Pide además que Producción confirme los puntos 3 y 4 (reglas del programa y
  capacidades), que hoy son solo lo que dijo PCP.
- **Un pedido para su asistente, por mail del 06/10 10:35**: que pueda armar mails con una tabla con formato en el
  cuerpo (rango de un Excel pegado como tabla), para las difusiones «MRP …». Hoy la tabla la pega él a mano.

### Qué usaba su asistente (51 avisos, del 06/10 al 13/10)

| Freno | Cuántos | Qué estaba haciendo |
|---|---|---|
| sobre la PC (`pc`, `manejo-pc`) | 23 | tareas de la PC y programas |
| se iba a cerrar con «no puedo» o «no me dejan» (`derivo`) | 10 | — |
| guardar en el servidor (`servidor`) | 8 | copiar a su carpeta de `Y:` el plan de entrega (`PE_W42.xlsx`, 09/10), el programa de la semana (`26W42 PP v2.xlsx`, 09/10) y el MRP (`MRP Valerio Noviembre.xlsx`, 13/10); un `Save()` sobre un libro del servidor (13/10) |
| cerrar un programa de Office (`office`) | 4 | cerrar un programa de Office abierto sin que él lo pidiera (06 y 09/10) |
| otros (`otras`, `mail`, `sin-persona`) | 6 | armar mails (06 y 09/10) |

Salud al 13/10: versión 21 instalada = la publicada; ve `Y:` y `Z:`; tiene Python; la lectura de mails apagada.

**Sus habilidades ya están en la cuenta**: las cinco que nombra en el aporte («foto a tabla, auditoría de consumos,
planes de entrega, firme y forecast, carga de programas») figuran hoy como skills habilitadas de la cuenta de Fak en
claude.ai: `foto-a-tabla`, `auditoria-consumos-arb`, `armado-planes-entrega-v2`, `extraccion-firme-forecast`,
`carga-programas-arb`, y una sexta, `resumen-contexto-mrp`. **«Foto a tabla» ya existe en la cuenta, así que no hay
skill candidata que documentar ni que construir**: pasa a un Excel una foto o captura de una tabla (su descripción en la
cuenta); no está en `.claude/skills/` del repo. Lo que sí queda como trabajo: comparar `auditoria-consumos-arb` con la
`verificacion-consumos` de la casa antes de que dos skills digan cosas distintas sobre el mismo consumo.

### El punto 5 de Federico, contra los papeles de la casa

Papeles: la memoria `reference_arb_export_estructura` (cómo se lee el export RELACIONES), el lector de la casa
`scripts/_lib/arbRelaciones.py` (su encabezado describe el formato, verificado contra el export del 30/09) y la skill
`arb-operar` (`reference/fallas-modales-y-export.md`, cómo se exporta).

| Lo que dice Federico | Lo que dicen los papeles | ¿Coincide? |
|---|---|---|
| Se saca desde Producción → solapa «Menú de Insumos» → «Relación de Consumo de Prod. Terminados» → «Listado de Relaciones»; con salida «Tabla Excel» abre la hoja «RELACIONES» | La skill confirma la solapa «Menú de Insumos», la salida «Tabla EXcel», la ventana «ARB Editor - Listado de Relaciones» y el archivo `C:\tmp\RELACIONES.TXT`. La casa entra por otro botón (`Listado de Insumos de Un Producto`) | **A medias**: el nombre exacto de sus botones no está en ningún papel; se valida mirando la pantalla |
| Columna A = producto, C = código del insumo, D = descripción, E = unidad, F = cantidad | `arbRelaciones.py`: cada bloque es [padre, rubro, medida (= código del insumo), descripción, unidad, consumo] | **Sí** |
| Columna B «no se usa» | B es el **rubro** (un número) y el lector de la casa lo usa para distinguir una fila de verdad de la continuación de una descripción partida | **No**, aunque para leer a mano se puede saltear |
| G y H = sector o proceso (COS/PRDCOS, TAP/PRDTAP…) | Módulo y proceso, con esos mismos códigos (ej. `COS · PRDCOS`) | **Sí** (cambia el nombre de G) |
| Los títulos de la fila 1 no coinciden con lo que trae cada columna | La columna «Medida» trae el código; el encabezado usa otro corrimiento que los datos (memoria, §2) | **Sí** |
| Los códigos vienen con espacios de más | El campo de código tiene 15 caracteres rellenos con espacios en el `.TXT` (memoria, §3 y §3b: «siempre `strip()`») | **Sí** para el `.TXT`; que la hoja de Excel los traiga igual se infiere (Excel abre ese mismo `.TXT`), no se miró |
| Los semielaborados vienen corridos a la derecha, con la columna A vacía | Cada nivel corre **7 columnas** en los datos y la columna A no se repite (memoria §2; `arbRelaciones.py`) | **Sí**, con una advertencia que su punto no dice: en el **encabezado** el bloque corre 9 columnas; leer el corrimiento del encabezado pierde los sub-ensambles (incidente del 27/07: 858 filas) |
| Los archivos internos del arb no se abren directo | Igual en la skill `arb-operar` y en la memoria `reference_arb_erp_btrieve` | **Sí** |
| PD270 y APLIX-A999R8395 tienen BOM propia y son materia prima comprada | Export local del 13/10: `PD270` tiene una BOM que se lleva a sí mismo (0,03 KG) y aparece en la BOM de 11 códigos (entre ellos el propio PD270 y 3 semielaborados); `APLIX-A999R8395` tiene una BOM de 1 rollo de `APLIX ROLLO` | **Sí** (con el export de hace 4 días) |
| — (no lo dice) | Una descripción de más de 40 caracteres parte la fila en dos renglones y corre unidad y consumo (memoria §1; 144 insumos usan los dos renglones) | Falta en su punto 5 |
| — (no lo dice) | Con el combo de salida vacío, tres flechas abajo caen en «Impresora», no en «Tabla EXcel»: se manda el listado entero a la impresora (skill, «el GATE de la foto») | Falta en su punto 5 |

**Contra los papeles, sus 9 afirmaciones dan: 7 coinciden, 1 no (la columna B) y 1 a medias (el nombre de los
botones). Además, a su punto le faltan 2 cosas que los papeles sí dicen** (las dos últimas filas). **Lo que no se puede
validar sin mirar el arb:** el nombre exacto de los botones de su camino y que la hoja de Excel traiga los espacios
(esa fila coincide para el `.TXT`; para el Excel es una inferencia). Contestarle a Federico es un mail: lo decide Fak.

### Qué le daría su asistente

- **Las consultas de BOM contestadas solas**: el export del arb con su sello dejado en la nube (diseño abajo) más
  `python scripts/_consumo.py --donde-se-usa <código>` y `python scripts/_consumo.py <producto>`, que ya existen y dicen
  arriba de qué fecha es el dato (con más de 24 h: «PUEDE ESTAR VIEJO»). Su PC tiene Python. Prueba: sus cuatro
  consultas reales («ERROR BOM» de los hilos del 31/08, «BOM IP Pad» del 02/09, «Consulta BOM 21-9902» del 04/09,
  «Consulta Consumo Hilos» del 21/09) hechas a `_consumo.py` con el export del día tienen que dar lo mismo que contestó
  Fak por mail. `_consumo.py` lee el `RELACIONES.TXT` del arb (y sus copias en `.arb-cache`), **no el Excel que saca
  Federico**: el paquete tiene que llevar el `.TXT`.
- **Guardar en su carpeta del servidor** (8 de sus 51 frenos): la línea la pone Fak (qué carpeta de cada uno sí).
- **La tabla en el cuerpo del mail** (su pedido del 06/10): queda en la lista de Fak; no se tocó el asistente de área.

---

## Carlos Baptista — Gerente de Ingeniería, PC `CARLOS`

### Qué le pregunta a Fak

- **279 mails con su nombre de remitente desde el 01/06** (el que más le escribe; uno es un aviso de «Carlos Baptista en
  Teams» y otro solo quedó en Eliminados). **De los 278 de la Bandeja, 85 nombran BOM, arb, códigos o consumos.** Los asuntos
  que más se repiten ahí: «Consumo actualizado aplix» (6), «Vinilos proyecto» (4), «Consumos P703 TOP ROLL & APB» (3),
  «CONSUMOS P703», «Consulta códigos de compra – BOM Ductos», «Códigos y colores - Proyecto Patagonia (VW427)»,
  «BOM-AMFE 21-9902-8944-9689» y «Forecast sansuy proyecto» (2 cada uno).
- **Las tareas que le asigna en Planner**: 38 en el plan «Actividades Ingenieria», del 12/11/2025 al 23/06/2026; 33
  tuvieron aviso de vencida; el último aviso llegó el 08/07 y después ninguno (con los mails solos no se sabe si el
  plan se dejó de usar). Los mails no avisan cuando una tarea se completa: el listado dice «asignada el …, último aviso
  de vencida el …», nunca «abierta». Detalle: `exports/planner_carlos_2026-10-17.md`.
- **Los 3D de Pablo Gamboa le llegan a Fak siempre y a Carlos en la mitad**: de los 431 adjuntos de diseño y
  comprimidos del índice, 193 los mandó Pablo y 58 Carlos (recontado el 17/10 con los `.jt` y el `.tar` ya sumados: los
  6 archivos nuevos no son de Pablo ni de Carlos, y los números no cambian). Los mails de Pablo con esos adjuntos son 91: los 91 llevan a
  Fak (en «Para» 26, solo en copia 65) y 46 llevan a Carlos (23 en «Para» y 23 en copia). El «casi siempre con Fak en
  copia» del informe D se sostiene (65 de 91); el «a Carlos» vale para la mitad.

### Qué usaba su asistente (25 avisos, del 05/10 al 07/10)

| Freno | Cuántos | Qué estaba haciendo |
|---|---|---|
| se iba a cerrar con «no puedo», «no me dejan» o «hacelo vos» (`derivo`) | 9 | — |
| sobre la PC (`manejo-pc`, `pc`) | 7 | — |
| otros (`otras`, `sin-persona`) | 4 | — |
| imprimir (`imprimir`) | 2 | hojas («EN_BLANCO», «To Roll IMG», «To Armrest ABP», «insert», 06/10) |
| guardar en el servidor (`servidor`) | 2 | la ficha de embalaje `GE - 277 TOP ROLL - caja carton v2.pdf` (07/10) y un `EPP.pdf` (06/10) |
| cerrar Office (`office`) | 1 | — |

Salud al 07/10: versión 23 = la publicada; ve `Y:` y `Z:`; **sin Python**; mails por el Outlook nuevo.

### Qué le daría su asistente

- **Las mismas consultas de BOM**, con una condición: en su PC no hay Python, y `_consumo.py` es Python. O el
  instalador le suma Python, o hace falta un lector en Node. Lo decide quien arme su paquete; acá no se instaló nada.
- **El índice de los 3D** (`_adjuntosIndice.mjs`): le llegan 46 de los 91 mails de Pablo con 3D, y él mismo mandó 58 de
  los 431 adjuntos.
- **Sus fichas de embalaje y el servidor**: ya las armaba; guardarlas en `Y:` es la línea que pone Fak.

---

## Pedro Ergo — Dirección, PC `DESKTOP-G7CJF7R`

### Qué le pregunta a Fak

- **Casi nada por mail**: 3 mails suyos a Fak desde 2025 (10/04/2025 «RV: APC Embalajes», 15/05/2025 «RV: IMG
  Supplier - Project Patagonia», y uno del 09/10/2026 sin asunto: el que trae su clave de API). Aparece en
  105 mails de 2026 (casi siempre en copia: cotizaciones, nominaciones, BeOn, cumpleaños). Lo que pide de verdad está en su nota de
  automatización (tanda 8): una mejora cada dos semanas, mostrada con el antes y el después.

### Qué usaba su asistente

- **Casi nada**: 3 avisos, todos de la instalación (05/10). Salud al 07/10: **versión 16 instalada con la 23
  publicada**, «OneDrive todavía está bajando la base»; no ve `Y:` ni `Z:`; sin Python.

### Qué le daría su asistente

- No consultas de BOM: no las hace.
- **El parte de INCA** (`_incaParte.mjs`): las 6 piezas que el último parte muestra sin acuerdo de capacidad (3 desde el
  primer parte de la copia, el 11/03, y 3 desde el 01/04). El texto del parte dice que pasadas 2 semanas INCA le avisa
  al comprador de VW. Si esas piezas le tocan a Barack, y a quién de Barack, no se decide acá: lo mira Fak en INCA.
- **El borrador quincenal de la tanda 8** (`AUTOMATIZACION BARACK\` en la nube), que ya se arma.
- **Ponerle la versión 23**: su asistente quedó en la 16.
- **La clave de API**: sigue en texto plano en su mail del 09/10 (copia local). Lo seguro es que Pedro genere una nueva
  y dé de baja esa. Es su decisión; ningún archivo de esta tanda la copia ni la imprime.

---

## El export del arb con sello en la nube (diseño; no se tocó el arb)

- **Qué se publica**: los tres archivos que el arb ya exporta a `C:\tmp` (`RELACIONES.TXT`, `ARTICULO.TXT`,
  `INSUMOS.TXT`) y un `sello.json` con la fecha real del export (la del archivo, no la de la copia), la PC, el hash de
  cada archivo y si hubo cargas al arb después (el registro `.arb-cache/carga_*.jsonl` que `_consumo.py` ya lee).
- **Quién y cuándo**: la PC principal, **después de un export que ya se hizo** por otra tarea. No se agrega ningún
  export ni se abre el arb para esto (regla `arb-no-cerrar.md`). Un paso más de `scripts/_refreshArb.mjs` (que ya lee
  `C:\tmp`) o un hermano `_arbPublicar.mjs`, con los candados que ya tiene `scripts/_lib/datosNube.mjs` para la copia de
  Supabase: temporal y renombrar (nunca un archivo a medias), hash, no pisa un archivo que cambió del otro lado, frena
  con una copia en conflicto de OneDrive, y nada con forma de clave llega al archivo.
- **Dónde**: en la nube de Ingeniería, adentro de la carpeta de los asistentes, en una subcarpeta `datos\arb\`. Cuál
  carpeta exactamente depende de la mudanza a la carpeta única que espera el sí de Fak (tanda 7, «ASISTENTE
  INGENIERIA»): se decide ahí, no acá.
- **Cómo lo lee cada asistente**: `python scripts/_consumo.py --export <ruta en la nube>` (la opción `--export` ya
  existe). Federico tiene Python; Carlos y Pedro no.
- **Lo que no hace**: no corrige ni carga nada en la BOM; la BOM sigue siendo de Ingeniería y el asistente contesta, no
  corrige. Un consumo de material de corte no sale de acá (regla `consumos-entregables.md` §6).
- **Tamaño**: mediano (cambia lo que sale a la nube y lo que lleva el instalador por persona). **Prueba**: las cuatro
  consultas reales de Federico de arriba.

---

## Puntos 16 a 19 (solo lo que se puede sin `Y:` ni el arb)

### 16 · Consumo real contra la BOM — diseño

- **Datos** (los junta PCP; viven en `Y:\PRODUCCION\PCP`, memoria `reference_datos_produccion_pcp_federico`):
  `db_produccion.xlsx` (producido OK por día, artículo y proceso) y `db_mov_depositos.xlsx`, hoja `KARDEX` (egresos de
  cada insumo). Se leen **copias**, nunca el original (lo usa Producción).
- **La cuenta**: egresos de un insumo a planta en un mes (solo los movimientos `EI`, con orden de producción; los pases
  entre depósitos `MD` son dos filas que se anulan) ÷ las piezas OK de los artículos que lo usan según la BOM
  explotada (`_consumo.py --donde-se-usa`), repartido por la cantidad de cada BOM.
- **El aviso**: una lista corta, una vez por mes, de los insumos donde lo real y la BOM se separan más que un margen.
  **El margen no se fija acá**: es un número para Fak, con la medición del primer mes al lado.
- **Lo que nunca es**: un consumo para cargar. Es un aviso para ir a preguntar, como `_tizadaVsArb.py`; en material de
  corte manda la planilla de Mesa de Corte o Pablo Gamboa (`consumos-entregables.md` §6).
- **Trampas que ya se conocen** (misma memoria): el kardex dice lo que se cargó, no lo que pasó en planta; fechas rotas
  (de 1921 a 2126); un código corto aparece en otras columnas (se filtra por la columna del código, con `strip()`).
- **Prueba**: un insumo de consumo conocido (el Aplix, o un hilo de la matriz de hilos) en un mes: lo real tiene que
  caer cerca de la BOM más la merma; si no, ya es un hallazgo. **Queda para la PC principal con `Y:`.**

### 17 · La capacidad con la que programa PCP contra los tiempos medidos — diseño

- **Las dos columnas**: la tabla del §4 del aporte de Federico (*«las capacidades son teóricas, no medidas (dadas por
  PCP el 01/10/2026)»*; P21 costura y tapizado: módulo 20, 40 carset) y lo que dicen los tiempos medidos de Ingeniería,
  llevados a piezas por turno de 8,25 h (el turno que da el mismo aporte, §3).
- **Fuente de los tiempos**: para P21, `HT-P21-R3.xlsx` (vigente, agosto 2024; memoria `project_p21_tiempos_balanceos`:
  6,21 minutos por pieza sumando las operaciones). Para pasar a piezas por turno hace falta la dotación y el balanceo de
  esa hoja, que está en `Y:`: **la cuenta no se hace acá**.
- **Lo que muestra**: las dos columnas lado a lado, sector por sector, con la fuente de cada número. No dice «está mal».
- **Prueba**: P21 primero. Si las dos columnas dan parecido, la tabla de PCP está bien; si no, ese es el hallazgo.

### 18 · Artemis — mirar en el servidor con Fak

`Y:\Ingenieria\Documentacion Gestion Ingenieria\20 - Desarrollo Interno\` tiene una «Matriz interactiva de productos»
(Artemis v0.4) y un `Recrear app Artemis.zip` del 01/10 (por nombre, en el catálogo del servidor del 01/10). El
asistente de `PABLO-LAPTOP` trabajaba ahí el 06/10: 7 de sus 20 frenos fueron por guardar presentaciones de embalaje en
`…\Artemis\Artemis Gamma\Entregables\` y en `…\Artemis\.claude\agents\artemis.md`. **No se abrió.** Se mira con Fak,
antes de construir la ficha de configuración por pieza (tanda 13), para contestar tres cosas: qué datos tiene la matriz,
de dónde los saca y si se mantiene. A Pablo no se le pregunta nada (decisión de Fak).

### 19 · Optitex — lo que hay en la nube

`INGENIERIA BARACK (NUNCA BORRAR)\4- MANUALES\OPTITEX\` (listado el 17/10, sin abrir los archivos grandes):

| Archivo | Tamaño | Fecha |
|---|---|---|
| `Manual Optitex (Parte 02).pdf` | 92,9 MB | 11/03/2022 |
| `MAXI EXPLICACION PASAR ARCHIVOS A MESA DE CORTE.mp4` | 72,0 MB | 05/09/2024 |
| `instructivo reinicio de optitex\` — `REINICIO DE OPTITEX.txt` (pasos 5 a 9: «Solucionar problemas» → «Opciones avanzadas» → «Configuración de inicio» → «Reiniciar» → F7) y cuatro capturas `1.bmp` a `4.bmp` | 214 bytes + 4 × 6,2 MB | 25/11/2022 |

En la misma carpeta de manuales está `Audaces\` (dos textos: tutorial de patrones y de tizadas). Del manual de Optitex
hay solo la **parte 02**.

**Lo que falta saber** (no se puede contestar desde acá): en qué PC está instalado Optitex; si la licencia trae el
módulo de tizada automática (Marker); y si esa PC es de Ingeniería o la de Corte (si es la de Corte, es de Pablo y no se
le pregunta). El F7 del instructivo es la opción de Windows que deja arrancar sin exigir controladores firmados: sugiere
que esa PC usa un controlador sin firma (una llave de licencia o la mesa de corte). Es una lectura del instructivo, no
está verificado.

---

## Decidí distinto de lo pedido

- **«Foto a tabla» no queda como skill candidata**: ya existe como skill habilitada de la cuenta (junto con las otras
  cuatro de Federico). Fuente: la lista de skills de la cuenta, leída el 17/10.
- **El pedido «que Ingeniería valide el punto 5» está en el aporte de Federico, no en un mail suyo**: se leyó de ahí.
- **En el índice, un número pegado con guion, guion bajo o punto es parte del nombre de la pieza**; separado por un
  espacio o entre paréntesis es una versión o una copia. Medido el 17/10 sobre los 40 grupos que juntaban más de un
  nombre: 2 juntaban cosas distintas y los dos por un número pegado («ESTANTERIA-1» con «ESTANTERIA», que son dos
  estanterías con asuntos distintos el 21/08, y «MYLAR MP7315-16» con «MYLAR MP7315»). La regla nueva separa 5 grupos,
  no solo esos 2 (medido por el auditor): también las hojas 3 y 4 de «Insonos_Sheet» (bien separadas), el fixture
  «Dispositivo_SAB1740_fixture_1» (sin abrir el archivo no se sabe si es otra pieza) y «Definitivo.2» y «Definitivo.3»,
  que por el hilo «DXF TRASERO» son dos versiones del mismo DXF y ahora quedan en dos filas. No se esconde nada: las
  filas están a la vista, la búsqueda las trae y los asuntos de los mails siguen al lado de cada pieza.
- **El índice de adjuntos incluye más que la lista pedida**: `.catpart`, `.catproduct`, `.sldprt`, `.sldasm`, `.3mf`,
  `.x_t`, `.f3d`, y los comprimidos (`.rar`, `.zip`, `.7z`) aparte, «sin abrir»: el 3D de la estantería del inserto
  estaba en dos `.rar`, y sin ellos el caso de respuesta conocida no aparecía.
- **Los repetidos se cuentan con el cuerpo y el destinatario**, no solo por fecha, remitente y asunto: el 28/04/2026 a
  las 17:21 Carlos asignó 8 tareas distintas con el mismo asunto y la misma hora. Con la regla del informe D (fecha,
  remitente y asunto) esos avisos se juntaban, y de las 38 tareas solo 29 quedaban con su aviso de asignación.
- **El índice suma `.jt` (3D) y `.tar` (comprimido)** además de lo de arriba, por un detalle del auditor: con `.jt`
  entra el mail del 02/09/2025 «Conjunto tela FSC RH / LH P2X (208) 2D Y 3D», que sin eso no aparecía.

## No pude verificar

- Si las 6 piezas sin acuerdo de capacidad le tocan a Barack o están así a propósito (se mira en INCA).
- Si el plan de Planner de Carlos se sigue usando (los avisos se cortan el 08/07).
- El nombre exacto de los botones del camino de Federico en el arb y que su hoja de Excel traiga espacios.
- Quién usa la PC `PABLO-LAPTOP` (el usuario de Windows es «carlos» y el área declarada, Ingeniería).
- Los números de capacidad del `HT-P21-R3` y el kardex: están en `Y:`.
- En qué PC está Optitex y con qué módulos.
- Los conteos de 377 adjuntos, 253 mails de Carlos y «13 de 17» de Federico del informe D salieron de la copia de la
  notebook al 11/10 y con otra regla de repetidos; los de este documento son de la copia de la PC principal al 16/10.
