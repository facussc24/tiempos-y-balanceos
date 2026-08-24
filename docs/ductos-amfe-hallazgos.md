# AMFE + Flujograma de DUCTOS (Insonos VW427 Patagonia) — hallazgos para la sesion de AMFEs

> Anotado el 2026-08-21 a pedido de Fak: *"vamos a arreglar el formato y todos esos AMFEs
> pero por ahora no, tengo una sesion abierta de AMFEs — quiero que tomes todo ese
> conocimiento pero anotalo"*. **Nada de esto se aplico todavia.** Este documento es la
> munición para cuando se abra esa sesion.
>
> Todo lo de abajo esta verificado contra la fuente. No hay que volver a investigarlo.

## De quien es el AMFE

Lo hace **Pablo Gamboa**; Fak esta en copia. **No tiene numero de AMFE asignado** (el
resto de Patagonia va del 149 al 162; ductos quedo fuera del listado maestro).

Archivo vigente en el servidor:
`Y:\BARACK\CALIDAD\DOCUMENTACION SGC\PPAP CLIENTES\COZZUOL\00_VW427-1LA_K-PATAGONIA\01- Insonos Ductos de Calefacción\PROYECTO\22 - FMEA de proceso\AMFE DUCTOS REVA-4.xlsx`
(guardado 2026-08-21 09:11). El flujograma vive al lado, en
`...\20 - Flujograma del proceso\FLUJOGRAMA DUCTOS.pdf` + `.vsdx` (Visio, 2026-08-21 09:09).

Historial de rechazos de Carlos Baptista:

- **2026-08-10 10:21** — *"El de ductos dice informacion que a mi parecer no esta bien,
  tenemos que tener los materiales directos, que materia prima usa cada cosa, si no
  Calidad de donde saca info para el PC? Por favor ver las BOM y modificar los AMFE."*
- **2026-08-20 16:50** — 5 puntos: (1) foto que no corresponde; (2) no se ve el corte de
  tela, el proceso debe representar que se corta internamente; (3) falta planilla de
  codigos indicando que pieza aplica a cada operacion — *"hay algunas que no van
  remachadas"*; (4) en mesa de corte faltan los codigos que solo se cortan y se envian;
  (5) el flujograma tampoco tiene tabla de codigos.

## Resumen de los 5 puntos de Carlos: que se corrigio y que no

| Punto | Estado al 21/08 10:00 |
|---|---|
| 1 — foto que no corresponde | Sin verificar (la carátula del AMFE solo tiene el logo Barack; la foto puede estar en otro entregable) |
| 2 — no se ve el corte de tela | **NO corregido.** Se renombro la OP20 a "Corte de Tela" pero su contenido sigue siendo el corte de vinilo del apoyacabezas |
| 3 — planilla de codigos por operacion | **NO existe.** El AMFE no nombra ni un codigo |
| 4 — codigos que solo se cortan y se envian | **NO estan** en la OP20 |
| 5 — el flujograma no tiene tabla de codigos | **CORREGIDO el 21/08 09:09**, pero la tabla no cierra con el arb (ver seccion del flujograma) |

## Hallazgo 1 — la REVA-4 cambio UNA sola celda

Diff celda por celda de `AMFE DUCTOS REVA-3.xlsx` (14/08) contra `AMFE DUCTOS REVA-4.xlsx`
(21/08 09:11): **3 celdas distintas, y 2 son un `#VALUE!` que desaparecio**.

| Celda | REVA-3 | REVA-4 |
|---|---|---|
| `DUCTOS!C85` | Corte de thinsulate | **Corte de Tela** |
| `Caratula!B6` | `#VALUE!` | (vacia) |
| `DUCTOS!B5` | `#VALUE!` | (vacia) |

De los 5 puntos de Carlos **no se corrigio ninguno**. Solo se renombro la operacion 20.

## Hallazgo 2 — la operacion 20 esta copiada del AMFE de apoyacabezas

Textual en la REVA-4, hoja `DUCTOS`:

| Fila | Texto |
|---|---|
| 82 col D | `BMA090 / BMA089` (maquinas de corte de apoyacabezas) |
| 82 col F | *"Se obtienen los paneles que formaran la funda del apoyacabezas"* |
| 82 col G | *"Corte de paneles utilizando programa cutter control"* |
| 81 col L | *"La maquina alinea y corta automaticamente el vinilo / tela"* |
| 91 col G | *"2. Preparar: Pasar vinilo bajo rodillos y descartar sobrante"* |
| 98 col L | *"...orden de produccion con codigo y descripcion del vinilo"* |
| 103 col G | *"5. Retirar: ... extraer el vinilo cortado"* |
| 106 col J | *"2- Vinilo mal identificado"* |
| 110 col L | *"Etiquetado de vinilo por logistica"* |
| 165 col G | (OP30) *"Adhesivar vinilo para poder realizar el tapizado"* |

**Ese es el punto 2 de Carlos.** La operacion existe y ahora se llama "Corte de Tela",
pero su contenido sigue describiendo el corte de vinilo para fundas de apoyacabezas, no
el corte de thinsulate en mesa de corte.

## Hallazgo 3 — el AMFE no nombra ni un solo codigo de pieza

Cero apariciones de `MP81xx` en las 436 filas con datos. La unica mencion a mesa de corte
es la fila 104 col L: *"El operario verifica esa orden contra una planilla de mesa de
corte."* — la planilla que Carlos pide en el punto 3 no existe en ningun lado.

## Hallazgo 4 — la planilla de codigos, derivada del arb

Fuente: export del arb `C:\tmp\RELACIONES.TXT` del **2026-08-20 14:28** + `ARTICULO.TXT`.
Es dato crudo del ERP, no interpretacion.

| Codigo | Descripcion en el arb | Corte de tela | Laminado + troquelado | Remachado | Ultrasonido | Ensamble |
|---|---|---|---|---|---|---|
| MP8137 | HUSH_PANEL ASS | SI | — | — | — | — |
| MP8149 | IP_UPPER_SUBSTRATE | SI | — | — | — | — |
| MP8150 | FRONT EXTEND PANEL LH y RH | SI | — | — | — | — |
| MP8151 | CNSL_SIDE PANEL LH y RH | SI | — | — | — | — |
| MP8146 | AIR DUCT SUB ASS1 | SI | — | — | SI (el cliente lo llama "US WELDED") | SI — `MP8156` x1 |
| MP8148 | CONSL AIR DUCT ASS | SI | — | — | SI (confirmado por su HO, hoja 40) | SI — `MP8160` x1 |
| MP8147 | DEFROSTER DUCT CTR SUBSTRATE ASS | SI | SI (espuma + tesa) | SI (28 remaches) | SI | SI — 3 sustratos + 4 brackets + connect |

- **Los 4 primeros son los "codigos que solo se cortan y se envian"** del punto 4 de Carlos.
- **El unico remachado es el MP8147** — esa es la aclaracion del punto 3 (*"hay algunas
  que no van remachadas"*).
- El ultrasonido del **MP8148 quedo CONFIRMADO** por su hoja de operaciones (hoja 40,
  SOLDADO) — ver hallazgo 7bis. Estuvo TBD hasta que se leyo esa HO: el nombre del codigo no
  lo dice, a diferencia del MP8146, que el cliente llama "US WELDED".

BOM completa por padre, tal cual sale del arb (consumo por pieza):

- **MP8137** — `427TEL002COR01` 0,1066 MT2 · `ET-SATO-100X60` 0,0833
- **MP8149** — `427TEL002COR01` 0,1330 MT2 · `ET-SATO-100X60` 0,0294
- **MP8150** — `427TEL002COR01` 0,0353 MT2 · `ET-SATO-100X60` 0,0167
- **MP8151** — `427TEL002COR01` 0,2520 MT2 · `ET-SATO-100X60` 0,0167
- **MP8146** — `427TEL002COR01` 1,0687 MT2 · `ET-SATO-100X60` 0,1250 · `MP8156` AIR DUCT x1
- **MP8148** — `427TEL002COR01` 1,1830 MT2 · `ET-SATO-100X60` 0,0833 · `MP8160` AIR DUCT ASSY CTR CNSL x1
- **MP8147** — `427TEL002COR01` 0,7420 MT2 · `427ESP003TRO01` ESPUMA 7MM 0,03714 MT2 ·
  `52110` ROLLO TESA 0,03714 MT2 · `427VAR001MON01` REMACHES x28 ·
  `427VAR002MON01` x4 · `427VAR003MON01` x1 · `427VAR004MON01` x1 · `427VAR005MON01` x2 ·
  `MP7457` AIR DUCT CONNECT BRACKET x1 · `MP8157` DEFROSTER DUCT CENTRAL x1 ·
  `MP8158` DEFROSTER DUCT RH x1 · `MP8159` DEFROSTER DUCT LH x1 · `ET-SATO-100X60` 0,0667

## Hallazgo 5 — datos del AMFE que no cierran con el arb

| Dato en el AMFE | Fuente real | Donde |
|---|---|---|
| *"THINSULATE 430 GR"* (fila 33 col C) | **400 g/m²** — spec cliente CVTC 52171 y ficha `Transulate-A 400 gM².pdf` cargada el 19/08 en `APQP\8- Ficha tecnica\` | insumo `427TEL002COR01` |
| *"Espuma PU 60 kg/m3 Espesor 6 mm"* (filas 170 y 203) y *"Adhiere espuma de 6mm"* (fila 163) | **7 mm** — `427ESP003TRO01 ESPUMA (FOAM) 7MM ESPESOR 60 KG/M^3` | arb, `RELACIONES.TXT` |

## Hallazgo 6 — TBD sin resolver dentro del AMFE

- fila 196 col G — *"2- Troquelar 5 capas con **TBD** (cutting depth 18-22)."*
- fila 208 col F — *"6- Troquel **TBD**"*
- fila 211 col F — *"7- Troquel **TBD**"*

## Hallazgo 7 — operaciones que describen otra pieza

- **OP50 (Prearmado + Remachado)** habla de *"visagras"* en 4 celdas (filas 251, 256, 260,
  261: *"Indexa componentes (visagra, remaches, tiras de espuma)"*, *"Remachar las
  visagras segun indica HO"*). **Ninguna BOM de los 7 ductos tiene bisagras.**
- **OP80 (Inspeccion final)** controla *"1 - Alineacion de costura"* (fila 368).
  **Los ductos no se cosen.**

## Hallazgo 7bis — las 4 hojas de operaciones tienen la MISMA hoja de corte, y es de otra pieza

En `PROYECTO\26 - Instrucciones de Proceso\` hay HO de MP8146, MP8147 (CENTRAL y LATERAL) y
MP8148. **Las cuatro tienen la hoja `20` identica**, y textual dice:

```
21-7339 / TELA DE TNT
Cortar 60 capas de pliegos de TNT PP 60 GRS/M2 A 1,5, segun el largo informado en el programa
Seleccionar el programa de corte "217339-ECN06"
```

**Eso no es el material de los ductos.** El insumo real es `427TEL002COR01`, thinsulate de
**400 g/m²**; ahi dice TNT PP de **60 g/m²**, y `21-7339` es un codigo de producto de otra
familia (los `21-xxxx` son Toyota/PWA). Es el mismo arrastre por copia que el hallazgo 2 del
AMFE, pero en las HO. **No hay HO de MP8137, MP8149, MP8150 ni MP8151.**

Lo que si sirve de esas HO (verificado, y resuelve el TBD del hallazgo 4):

| Pieza | Operaciones segun su HO |
|---|---|
| MP8146 | 20 corte · 30 posicionamiento · 40 a 40.4 **SOLDADO** |
| MP8147 CENTRAL | 20 corte · 30 **REMACHADO** · 40 a 40.2 **SOLDADO (ultrasonido)** · 50 pegado de espuma |
| MP8147 LATERAL | 20 corte · 40 a 40.3 **SOLDADO (remachado + ultrasonido)** · 40.4 ensamble |
| MP8148 | 20 corte · 40 **SOLDADO** — textual: *"Soldamos con la pistola de ultrasonido los puntos indicados con un circulo amarillo"* |

→ **El MP8148 SI lleva ultrasonido.** El TBD del hallazgo 4 queda cerrado con fuente.

## Hallazgo 8 — falta la marca VDA "D" roja

Cristian Añel (Cozzuol), 2026-06-09: *"Al tratarse de componentes para el interior del
vehiculo, estos materiales requieren ensayos de inflamabilidad y estan catalogados como
piezas de seguridad y reglamentacion. Por tal motivo, toda la documentacion (diagrama de
flujo, AMFE, plan de control, etc.) debe estar identificada segun la norma VDA con una
letra 'D' de color rojo."*

En el AMFE no hay ninguna "D" ni mencion a inflamabilidad como caracteristica de
seguridad (la unica aparicion de "flamabilidad" es la fila 43: *"Probeta de flamabilidad"*
como equipo de medicion en recepcion). Carlos lo viene pidiendo desde el **22/06/2026**:
*"no encuentro el plano para categorizarlo en D? Necesitamos para armar bien el
FLUJO/AMFE"*. **La clasificacion la define Fak o el cliente, no se asigna por cuenta
propia** (`core-prohibiciones.md` §2).

## Hallazgo 9 — codigos CORDUC dados de alta y vacios

En `ARTICULO.TXT` del arb existen:

```
CORDUC0001V1  CORTES INSONO (MP8146)      CORDUC0005V1  CORTE INSONO (MP8137)
CORDUC0002V1  CORTES INSONO (MP8147)      CORDUC0006V1  CORTE INSONO (MP8151)
CORDUC0003V1  CORTES INSONO (MP8148)      CORDUC0007V1  CORTE INSONO (MP8150)
CORDUC0004V1  CORTE INSONO (MP8149)
```

**Cero lineas en `RELACIONES.TXT`**: los 7 tienen la BOM vacia. Si mesa de corte produce
contra esos codigos, hoy no descargan nada de stock. Es la capa intermedia de corte que
Carlos pide representar en el AMFE (punto 4) y esta a medio dar de alta.

## Sobre el flujograma

Es un **Visio** (`.vsdx`) de Gamboa, **no** sale del generador del repo
(`scripts/_flujograma.mjs`). Los 5 que si genera el repo son 151-APB-TRASERO-CENTRAL,
152-APOYACABEZAS, 153-ARMREST-DOOR-PANEL, 155-TOP-ROLL y 157-IP-PAD; **ductos no esta**.

### La tabla de codigos YA SE LLENO — el TBD del punto 5 esta resuelto

El recorte que mando Carlos el 20/08 mostraba el recuadro "TABLA DE CODIGOS" con **"TBD"**
adentro. En el PDF vigente (21/08 09:09) **ya esta llena**. Contenido textual:

```
MP8137 HUSH PANEL RH INSULATOR
MP8146 AIR DUCT ASSY CENTRAL
MP8146 AIR DUCT ASSY LH-RH
MP8147 DEFROSTER DUCT ASSY CENTRAL
MP8147 DEFROSTER DUCT ASSY LH-RH
MP8148 AIR DUCT  ASSY CENTRAL CONSOLE
MP8149IP INSULATOR PAD
MP8150 ACOUSTIC FOAM LH-RH
MP8151 ACOUSTIC FOAM LH-RH
```

Pero **no cierra con el arb**:

- **MP8146 y MP8147 aparecen dos veces cada uno**, partidos en "CENTRAL" y "LH-RH". En el
  arb son **un solo codigo cada uno**. El MP8147 es 1 padre que consume sus 3 sustratos
  (`MP8157` Central + `MP8158` RH + `MP8159` LH) como componentes — se sueldan por
  ultrasonido y se remachan en una sola pieza. **No se parte por lado.**
- **MP8150 y MP8151 tienen la MISMA descripcion** ("ACOUSTIC FOAM LH-RH"), asi que no se
  distinguen entre si. ⚠️ **Esto NO es un error de Gamboa**: es literalmente el nombre que
  usa el cliente en su Nota de Pedido (`MP8150 ACOUSTIC FOAM_RH` / `MP8151 ACOUSTIC
  FOAM_LH`). El problema es mas profundo y **no esta resuelto**: para Cozzuol los dos son
  el **CNSL Side** y el Front Extend tiene codigos propios `MP8152`/`MP8153` (que no
  existen en el arb), mientras que el arb, la tizada y las OC al proveedor tratan a
  MP8150 como el Front Extend chico. Detalle y evidencia en la memoria
  `project_patagonia_ductos_insonos_arb`. **No alinear el AMFE por este punto hasta que
  Paulo/Carlos definan.**
- `MP8149IP INSULATOR PAD` va pegado, sin espacio.

### Colision de numeracion flujograma vs AMFE

| N° | Flujograma (21/08) | AMFE REVA-4 |
|---|---|---|
| 10 | Recepcion de materiales | Recepcion de materiales |
| 20 | **Corte de vinilo y tela** | Corte de Tela |
| 30 | Laminado / adhesivado | Laminado / adhesivado de espuma |
| 40 | Troquelado | Troquelado de espuma |
| 41 | *(no existe)* | **Colocacion de espumas adhesivadas en medios intermedios** |
| 50 | Prearmado de espuma | Prearmado de espuma + remachado |
| 60 | Soldado por ultrasonido | Cerrado de piezas con ultrasonido |
| 70 | Ensamblado | Ensamblaje |
| — | Inspeccion final *(caja sin numero)* | — |
| 80 | **EMBALAJE** | **Inspeccion final** |
| 90 | **Control de las cantidades de despacho** | **Embalaje** |

🔴 **El 80 y el 90 significan cosas distintas en cada documento**, y el 41 del AMFE no
existe en el flujograma. Es exactamente la colision que manda mirar `no-pfd-no-ho.md`
("mismo numero, distinta operacion"): la numeracion la manda el **flujograma**.

### Otros dos puntos del flujograma

- **La OP20 dice "CORTE DE VINILO Y TELA"** y el traslado previo dice "TRASLADO DE VINILOS
  Y TELAS A MESA DE CORTE". En ductos **no hay vinilo**: se corta thinsulate. Mismo arrastre
  del AMFE de apoyacabezas (hallazgo 2).
- **El cajetin quedo sin actualizar.** El archivo se guardo hoy 21/08 09:09 pero sigue
  diciendo `FECHA DE REALIZACION: 12/02/2026` · `FECHA DE REVISIÓN: 12/02/2026` · `REV.01`.
  La revision va en el cajetin ([[reference_donde_viven_archivos_proyecto_vs_serie]]).

### Si algun dia se rehace con el generador del repo

El bloque equivalente se llama `CÓDIGOS PROD. TERMINADO` y se llena con el array
`products` (`tools/flowchart/Flowchart.jsx:462-486`), campos
`{ code, level, description, version }`. **El generador no tiene campo para mapear
operacion → pieza**: para 7 piezas con rutas distintas hoy solo se puede con ramas
(`branches`) o una columna extra en `products`; una matriz operacion × pieza requiere tocar
el motor. Ademas habria que dar de alta la entrada en
`scripts/_lib/numeracionPatagonia.data.json` (su test exige `secuenciaConfirmadaPor` con
2+ fuentes) — y del generador sale **el dibujo, no el contenido** (`no-pfd-no-ho.md`).

## Contexto del que cuelga esto

El AMFE es 1 de los 12 casilleros de la matriz PPAP de Cozzuol. Estado completo, reparto
Ingenieria/Calidad y que le toca a Fak: memoria `project_ductos_ppap_cozzuol`.


---

# ACTUALIZACION 24/08/2026 — correcciones a este mismo documento y trabajo hecho

Se leyeron las fuentes que faltaban (las 4 HO completas, el `.vsdx` del flujograma y el buzon).
**Tres cosas que este documento afirmaba quedaron corregidas:**

## 1. Las "visagras" NO son arrastre — existen en el proceso real

El hallazgo 7 decia que la OP50 hablaba de visagras y que "ninguna BOM de los 7 ductos tiene
bisagras". Es cierto que no estan en la BOM, pero **la HO MP8147 CENTRAL op30 (REMACHADO) dice
textual: "juego de 8 visagras y 16 remaches"**. La operacion existe. En el arb no tienen codigo
propio; los candidatos son los brackets `427VAR002/003/004/005MON01` (Defroster Duct Ctr Braquet
1 a 4). **No borrar las visagras del AMFE: confirmar que son.**

Divergencia abierta que sale de esto: **el arb carga 28 remaches y la HO dice 16.**

## 2. La norma de flamabilidad es la CVTC **52034**, no la 52171

"CVTC 52171" no existe en ningun mail. Cozzuol adjunto el 16/06/2026 cuatro normas:
**22001** (sustancias prohibidas), **35005** (instrument panel), **52034 "Flammability of
automotive nonmetal materials"** y **52088** (emisiones). El gramaje de 400 g/m2 del thinsulate
sale del insumo del arb y de la ficha del proveedor, no de una norma.

## 3. La hoja de corte de las HO esta OCULTA y es de otra pieza — confirmado con 6 pruebas

Las 4 hojas "20" son identicas entre si (mismo MD5 de contenido) y estan marcadas
`state="hidden"` en el workbook. Su cajetin dice `21-7339 / TELA DE TNT`, modelo `FIAT X6S`,
cliente `PWA`, `HO-956`, Rev 2, 2024-11-27. De thinsulate no hay ni una letra en ninguna HO.
**Para los ductos VW427 no existe hoja de corte propia**, y no hay HO de MP8137, MP8149, MP8150
ni MP8151.

## Secuencia REAL de las HO (no coincide con la del flujograma)

| Pieza | Operaciones segun su HO |
|---|---|
| MP8146 | 20 (ajena) · 30 POSICIONAMIENTO · 40/40.1 SOLDADO (AIR DUCT RH/LH) · 40,2/40.3/40.4 SOLDADO (AIR DUCT CTR) |
| MP8147 CENTRAL | 20 (ajena) · 30 REMACHADO · 40/40.1/40.2 SOLDADO · **50 PEGADO DE ESPUMA** |
| MP8147 LATERAL | 20 (ajena) · 40/40.1 SOLDADO (RH) · 40.2/40.3 SOLDADO (LH) · **40.4 ENSAMBLE** (no soldado; no tiene op30) |
| MP8148 | 20 (ajena) · 40 SOLDADO |

🔴 **La espuma va DESPUES del soldado en la HO (op50) y ANTES en el flujograma/AMFE (op30-40).**
Se numera contra el flujograma (`no-pfd-no-ho`) y se reporta la divergencia. El MP8146 ademas
mezcla dos piezas en un mismo libro.

Detalle integro de las tres lecturas: `tmp/ductos/HO_volcado.md`, `tmp/ductos/FLUJOGRAMA_volcado.md`
y `tmp/ductos/REVA4_volcado.md`.

## Hallazgos nuevos sobre el AMFE REVA-4

- Son **10 operaciones**: 10, 20, 30, 40, **41**, 50, 60, 70, 80, 90. La 41 es "Colocacion de
  espumas adhesivadas en medios intermedios" y **el flujograma no la tiene**.
- **El Paso 6 (Optimizacion) esta completamente vacio**: 0 celdas con datos en las columnas R a AC
  de las 436 filas. Ni una accion, responsable ni fecha.
- La **OP70 "Ensamblaje" repite el modo de falla de la OP60** (misma celda, mismos controles).
- **Contradiccion interna de la espuma**: la recepcion dice "ESPUMA (FOAM) 7MM"; laminado y
  troquelado dicen 6 mm. El arb dice 7 mm.
- Los codigos MP81xx **si estan**, pero en una tabla lateral `AF5:AG13` fuera del formulario.
- Los encabezados dicen "AP **DFMEA**" siendo un AMFE de proceso, y la hoja rotula "RESPONSABLE
  DEL **DISEÑO**" mientras la caratula dice "RESPONSABLE DEL **PROCESO**".
- "Organismos regulatorios" aparece 9 veces como destinatario de efecto y **las 9 veces el efecto
  esta vacio**.
- El log de revisiones tiene **una sola linea** ("EMISION INICIAL", 13/02/2026) pese a llamarse REVA-4.

## Estado del hilo (Outlook, verificado en vivo)

**No hay ningun mail de ductos posterior al 21/08/2026 15:23.** No existe REVA-5, Carlos no volvio
a rechazar y Cozzuol no reclamo desde el 11/08. La REVA-4 **nunca se mailéo**: la ultima que
circulo es la REVA-3 (Gamboa, 14/08 16:25). Del flujograma, **el unico cambio del 21/08 fue llenar
la TABLA DE CODIGOS, que antes decia TBD** — el resto, cajetin incluido, quedo igual.

## Lo que se hizo el 24/08

- **Flujograma 158 - INSONOS / DUCTOS DE CALEFACCION, Rev.A**, con el generador del repo
  (`tools/flowchart/data/158-INSONOS-DUCTOS.json`). Formulario I-IN-002/III, tabla de codigos con
  columna de operaciones, tres ramas segun el camino de cada pieza, y la "D" roja de VDA en
  recepcion y control de material. El **158** es el siguiente libre (el listado llega al 157).
- **Planilla de codigos por operacion** en Excel.
- **Numero de AMFE asignado: 172.** Verificado contra el listado maestro (llega al 160) Y contra
  las carpetas reales del maestro (llegan al 171, incluido `COZZUOL/167 - INSONORIZANTES`, que
  **NO es este**: es de enero 2024 y no menciona MP81xx, VW427, Patagonia ni thinsulate).
- Dos cambios al motor del flujograma: columna de operaciones opcional en la tabla de codigos, y
  `criticalType` en rojo para la marca VDA. Los 5 flujogramas ya emitidos no cambian.
