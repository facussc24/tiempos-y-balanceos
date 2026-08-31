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

## Hallazgo 7bis - las 4 HO comparten la hoja de corte, y eso es A PROPOSITO

> [CORREGIDO EL 24/08/2026] Este hallazgo estaba mal planteado. Los HECHOS de abajo son
> correctos; la conclusion original ("arrastre por copia", "hallazgo de auditoria") era falsa.
> Fak: *"las hojas 20 si se repiten porque son genericas... las tenemos 'generales' para que
> sea mas facil, porque son tantas veces; si no, tendria que hacerlas desde 0, y si se
> actualiza algo en mesa de corte tendria que actualizar 1 por 1 todas las HO"*. La hoja
> compartida es el DISEÑO, no el defecto: el listado maestro tiene un bloque GENERAL con
> `10 RECEPCION DE MATERIALES`, `025/027 CORTE`, `926 ADHESIVADO DE PIEZAS`,
> `914 ESPUMAS TROQUELADAS` y `956 TELA DE TNT`, que es justamente esta. Memoria:
> `reference_ho_generales_compartidas`. **Corolario: antes de reportar "a esta operacion le
> falta la HO", buscarla en el bloque GENERAL del listado.**

En `PROYECTO\26 - Instrucciones de Proceso\` hay HO de MP8146, MP8147 (CENTRAL y LATERAL) y
MP8148. **Las cuatro reusan la misma hoja `20`**, la HO general de mesa de corte, que dice:

```
21-7339 / TELA DE TNT
Cortar 60 capas de pliegos de TNT PP 60 GRS/M2 A 1,5, segun el largo informado en el programa
Seleccionar el programa de corte "217339-ECN06"
```

El cajetin de esa hoja general nombra `21-7339 / TELA DE TNT` (FIAT X6S, PWA, `HO-956`,
rev 2, 27/11/2024) y su material es TNT PP de **60 g/m2**, no el thinsulate de **400 g/m2**
(`427TEL002COR01`) que se corta para ductos. Eso **no la invalida**: es la hoja general del
puesto, escrita sobre el caso de esa pieza. Lo que si conviene registrar es que su programa
de corte (`217339-ECN06`) es el de aquella pieza. **No hay HO propia de MP8137, MP8149,
MP8150 ni MP8151** - los cuatro que solo se cortan quedan cubiertos por la hoja general.

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
  distinguen entre si. Va corregido con las descripciones del arb: **MP8150 = FRONT EXTEND
  PANEL** (chica) y **MP8151 = CNSL_SIDE PANEL** (grande).
  ✅ **CERRADO por decision de Fak el 24/08/2026: gana el arb, y no se vuelve a plantear** —
  ni como pregunta ni como nota al pie. Que la Nota de Pedido de Cozzuol use esos numeros
  para otra cosa (y tenga MP8152/MP8153, que no existen aca) es historia de por que existio
  la duda, no una tarea. Detalle en la memoria `project_patagonia_ductos_insonos_arb`.
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

### Y los 28 remaches del arb NO estaban mal: 28 = 16 + 12

`APQP-Lista de materiales\BOM\Obsoleto\INSUMOS_DUCTOS_CODIGOS_ARB.xlsx`, hoja
`Consumptions`, lo dice literal:

> `Remaches | 427VAR001MON01 | TBD | 28 | pcs | 28 | **16 remaches + 12 remaches**`

Y el sinoptico `PROYECTO\INSONOS_AIR_DUCT_SINOP_PRODCUTO_y _FLUJOGRAMA_REV05.xlsx` los
desglosa por nivel: **16** en el *Defroster Duct Ctr Substrate SubAss2* (justo debajo de los 4
braquets) y **12** en el *Air Duct Connect Bracket* (= MP7457).

**El ERP esta bien. La que esta incompleta es la HO**, que solo documenta los 16 del defroster;
los 12 del connect bracket no aparecen en ninguna hoja de operaciones. Tipo de remache segun el
AMFE: **REMACHES POP 7,6 x 3,6 mm**; ademas Carlos mando crear el codigo `AD529EC` "remache POP
aluminio de 4x7,4" el 01/07/2026 — **son dos codigos distintos para el mismo insumo**, a aclarar.

### Y las 8 "visagras" son los 8 BRACKETS — la cuenta cierra exacta

| Codigo | Descripcion | Cant. |
|---|---|---|
| 427VAR002MON01 | Defroster Duct Ctr Braquet 1 | 4 |
| 427VAR003MON01 | Defroster Duct Ctr Braquet 2 | 1 |
| 427VAR004MON01 | Defroster Duct Ctr Braquet 3 | 1 |
| 427VAR005MON01 | Defroster Duct Ctr Braquet 4 | 2 |
| | **TOTAL** | **8** |

Coincide con *"juego de 8 visagras"* y con *"zonas del 1 al 8"* de la HO. **En el AMFE nuevo no
se les dice "visagras": se les dice Braquet 1 a 4 con su codigo**, que es como estan en la BOM.
Lo que NO se pudo confirmar es su forma fisica (no hay plano ni despiece).

## 2. CORRECCION: la CVTC **52171 SI EXISTE** — y es LA norma de estos productos

Lo que este documento decia antes ("52171 no existe") era falso. No estaba en los mails, pero
**esta en el legajo desde el 05/01/2026**:
`PROYECTO\SPEC\SPEC\CVTC_52171-2023_INSONOS.pdf` (26 pag.) —
**"Technical requirements for fiber sound absorbing materials"**. Es la norma especifica de los
materiales fibrosos absorbentes de sonido, o sea la que gobierna estos insonos.

La carpeta tiene **cinco** normas CVTC, no cuatro:

| Norma | Que fija | Aplicacion |
|---|---|---|
| **52171-2023** | requisitos de materiales fibrosos absorbentes | **la norma madre del producto** |
| **52034-2021** | flamabilidad de no metalicos | via 52171 §5.2.4 |
| 52088-2019 | emisiones de interior | via 52171 §5.2.3 |
| 22001-2020 | sustancias prohibidas y limitadas | materiales |
| 52167-2017 | dust-out de fiber sound absorber pad | contenido de polvo |

**Requisitos duros que salen de ahi, para el AMFE:**
- **Densidad superficial: 400 ± 30 g/m2** — `PP-PET SOR MATERIAL REQUIREMENT 52171.docx`:
  *"Surface density | CVTC 52171 5.1.1 | 350±30 o 400±30"*. Metodo: Anexo A de la 52171,
  **promedio de 3 probetas, con precision de 1 g/m2**. El **"430 GR" del AMFE es el limite
  superior de la tolerancia, no un nominal** — el valor es 400.
- **Flamabilidad: CVTC 52034-2021 §4.2.1.2 — velocidad de combustion <= 70 mm/min**, ensayo
  horizontal segun **GB 8410-2006**, probeta **356 x 100 mm, espesor <= 13 mm, minimo 5
  probetas**. El AMFE actual dice solo *"Probeta de flamabilidad"*: sin norma, sin limite y sin
  frecuencia.
- **Contenido de polvo <= 1%** segun CVTC 52167.

🔴 **GAP DE PPAP que hay que levantar:** la ficha del material comprado
(`APQP\8- Ficha tecnica\Transulate-A 400 gM².pdf`, SINOYQX, junio 2025) declara **UL 94 V-0,
DIN 4102 B1, EN 45545-2 y FMVSS 302** — **ninguna es CVTC 52034 ni GB 8410**. No hay en el
legajo ningun ensayo de flamabilidad contra la norma que pide el cliente.

## 3. La hoja de corte que comparten las 4 HO es la GENERAL de mesa de corte

> [CORREGIDO EL 24/08/2026] Se escribio como "es de otra pieza, confirmado con 6 pruebas".
> Las 6 pruebas eran hechos correctos y la conclusion estaba mal: la hoja se comparte a
> proposito. Ver el Hallazgo 7bis y la memoria `reference_ho_generales_compartidas`.

Las 4 hojas "20" son identicas entre si (mismo MD5 de contenido) y estan `state="hidden"` en
el workbook. Su cajetin dice `21-7339 / TELA DE TNT`, modelo `FIAT X6S`, cliente `PWA`,
`HO-956`, Rev 2, 27/11/2024, y de thinsulate no hay ni una letra. Es la **HO general de mesa
de corte** (`956` en el bloque GENERAL del listado maestro), reusada dentro de cada libro de
producto para no tener que actualizar HO por HO cuando cambia el puesto.

**Fak, 24/08/2026: esas hojas ocultas se ELIMINAN de los 4 libros de ductos** (*"elimina esas
hojas ocultas, no las quiero"*). La hoja general sigue existiendo por su cuenta como HO-956.
Y no hay HO propia de MP8137, MP8149, MP8150 ni MP8151.

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


---

# RELEVAMIENTO DEL LEGAJO COMPLETO — 24/08/2026

## 🔴 NO EXISTE EL PLAN DE CONTROL. Y el AMFE lo cita 8 veces.

Las tres carpetas de plan de control del legajo estan **vacias** (`APQP
-Plan de Control`,
`24- Plan de control de Pre lanzamiento`, `32- Plan de control de Produccion`), y una busqueda
de `*plan*control*` / `*I-AC-005*` en todo `PPAP CLIENTES\COZZUOL\` no devuelve **ningun**
archivo del legajo de ductos.

Mientras tanto el AMFE REVA-4 apoya su **control de deteccion** en el, ocho veces —
celdas `D58`, `D109`, `D182`, `D214`, `D246`, `D270`, `D320`, `D380`:

> "Registros de control en calidad segun plan de control"

y `F29` (OP10): *"4- Utilizar plan de control de recepcion y formatos estandar para ensayos"*.

**Un AMFE cuya deteccion se apoya en un documento inexistente no detecta nada.** Es el hallazgo
mas grave del legajo y es de auditoria inmediata.

## 🔴 La OP41 no es una operacion: es un TRASLADO promovido a numero

Veredicto con evidencia (filas 224-249):

1. **No transforma el producto.** Sus funciones son manipular: *"1- Tomar espumas y colocarlas
   en cajon definido"*, *"2- Colocar piezas hasta completar la cantidad requerida"*,
   *"3- **Transportar cajon al sector de prearmado**"*. Su unico material es `Cajon plastico`,
   que es material INDIRECTO.
2. **Es literalmente una flecha del flujograma**: entre la 40 y la 50 el flujograma tiene
   *"TRASLADO DE PIEZAS TROQUELADAS AL SECTOR DE PREARMADO"* — el mismo texto. En su propia
   simbologia eso es TRASLADO, no OPERACION.
3. **Ninguna HO la respalda** — y sin embargo se auto-referencia: su control preventivo es
   *"1 - Hoja de operaciones"*, de una HO que no existe.
4. **Se contradice sola**: la cabecera dice *"piezas troqueladas"* y el nombre dice *"espumas
   adhesivadas"*. Si fuera desdoblamiento de la 40 iria como `40.1`, como hacen las HO.

**Se elimina** y sus dos modos de falla (cantidad incorrecta / posicionado NOK) se absorben en
la 40 o la 50.

## 🔴 Cinco colisiones de numeracion entre los documentos

| N° | Significados en conflicto | Documentos |
|---|---|---|
| **30** | Laminado/adhesivado ↔ Posicionamiento ↔ Remachado | Flujograma+AMFE ↔ HO MP8146 ↔ HO MP8147 CTR |
| **40** | Troquelado ↔ **Soldado** | Flujograma+AMFE ↔ las 4 HO |
| **50** | Prearmado de espuma ↔ Pegado de espuma | Flujograma+AMFE ↔ HO MP8147 CTR |
| **80** | Embalaje ↔ Inspeccion final | Flujograma ↔ AMFE |
| **90** | Control de cantidades ↔ Embalaje | Flujograma ↔ AMFE |

Ademas, **los numeros de las HO no existen en el formulario**: son solo nombres de pestaña de
Excel. La celda `B6` (N° DE OPERACION) vale `-` en TODAS las hojas propias de ductos, y `Q3`
(N° de HO) tambien. La unica con numero real es la hoja general de mesa de corte (`HO-956`).

## 🔴 Hay una QUINTA fuente de numeracion en el legajo

`PROYECTO\INSONOS_AIR_DUCT_SINOP_PRODCUTO_y _FLUJOGRAMA_REV05.xlsx` (04/02/2026), hoja
"Flujograma Proceso", numera **OP 10 a OP 120 con otro criterio** (*"OP: 10 Se une el substrato
a los 8 Brackets Metalicos"*, *"OP: 20 Se suelda por ultrasonido los insonos 1A-2A"*, ...), y
**colisiona con los 7 numeros**. Es un flujograma de celda/balanceo, no del SGC — pero se llama
"FLUJOGRAMA" y esta en el legajo. **Si se entrega junto con el resto es un hallazgo seguro:
mandarlo a OBSOLETO o renombrarlo a "Balanceo de celda".**

## El legajo APQP esta 30/34 vacio

Existen y sirven: `8- Ficha tecnica` (`Transulate-A 400 gM².pdf`), `14-Especificaciones de
Materiales` (`BOM Insonos Ductos_20260821.pdf`), `PROYECTO\SPEC\SPEC\` (las 5 normas CVTC),
fichas de embalaje, 2D/3D. **Vacias las 30 restantes**, incluidas `6-Planos de la pieza`,
`12-Plan de Control`, `17-Caracteristicas Especiales` y `13-Especificaciones de Ingenieria`.

**No hay ni un plano del cliente en todo el arbol**, y por lo tanto **no hay part number de
cliente para ningun MP81xx**. Lo unico trazable es del header de un STEP:
`CNSL_AIR_DUCT = C00752827_02`.

## Estado real del PPAP: 1 de 11 completo

Del `ACSA_AIR DUCT_ Seguimiento APQP_11082025.xlsx`, hoja "PPAP Resumido": unico item completo
= **ficha de embalaje**. Parciales: PFMEA (sin numero, sin registro de revision) y certificados
de material (solo ficha del proveedor). Los otros 8 sin evidencia. El Gantt del mismo archivo
quedo congelado en **35,6% al 11/08/2025**, con responsables que ya no son los que firman.

## Lo que sigue SIN RESOLVER despues de leer todo

| Duda | Estado |
|---|---|
| **Espesor de espuma: 7 mm (ERP+BOM) vs 6 mm (AMFE)** | 🔴 **ABIERTO** — no hay plano ni ficha del proveedor Mentvil. La densidad 60 kg/m3 si es unanime. Dato coherente entre HO y AMFE: **2 tiras de 670 mm** |
| **Part number del cliente por MP** | 🔴 **NO EXISTE** en ninguna fuente del legajo |
| Forma fisica de los braquets | sin plano ni despiece |
| Dos codigos de remache (`427VAR001MON01` y `AD529EC`) | a aclarar cual queda |

Para cerrarlos hay que **pedirle a Cozzuol/ACSA los planos 2D liberados** del
`CC 4917-00 F_AG_I_24_23_IP` con su lista de materiales.

---

# TANDA DEL 24/08/2026 (tarde) - HO alineadas y la espuma de vuelta en la OP50

## 1. Las 4 HO se alinearon al Flujograma 158 (script `scripts/_alinearHoDuctos.py`)

Numeradas por lo que HACEN los pasos, no por el numero que traian. Quedaron 17 hojas:

| Libro | HO N | Pestañas antes | Pestañas ahora |
|---|---|---|---|
| MP8146 | **987** | 20 (oculta) · 30 · 40 · 40.1 · 40,2 · 40.3 · 40.4 | 60 · 60.1 · 60.2 · 60.3 · 60.4 · 60.5 |
| MP8147 CENTRAL | **988** | 20 (oculta) · 30 · 40 · 40.1 · 40.2 · 50 | 50 · 60 · 60.1 · 60.2 · **50.1** |
| MP8147 LATERAL | **988** | 20 (oculta) · 40 · 40.1 · 40.2 · 40.3 · 40.4 | 60 · 60.1 · 60.2 · 60.3 · **70** |
| MP8148 | **989** | 20 (oculta) · 40 | 60 |

Ademas, en las 17 hojas: `B6` = numero de operacion (estaba VACIA en todas), `Q3` = numero de
HO (idem), `K6` = PATAGONIA, `K8` = COZZUOL, `Q7` = 24/08/2026 y `Q8` = **A** (las revisiones de
HO van con LETRA, no con numero; antes decian `1`). `Q2` no se toco: sigue `I-IN-002.4-R01`.
**Los pasos no se modificaron.** Realizo/Aprobo siguen siendo P.GAMBOA / C.BAPTISTA.

Registradas en el listado maestro de hojas de proceso (filas 88-90 del bloque GENERAL, columna
`#` re-secuenciada) y en su hoja oculta `_CONTEXTO_CLAUDE`, que ahora dice **proximo libre 990**.
Copias previas en `26 - Instrucciones de Proceso\OBSOLETO\` con su `Detalle Rev..txt`.

Se saco de los 4 libros la pestaña oculta "20" (la HO general de mesa de corte, HO-956): se
fueron exactamente **15 imagenes y 1 hoja por libro**, y los dibujos e imagenes de las hojas
propias quedaron intactos. Verificado abriendo el MP8147 CENTRAL en PDF.

## 2. La espuma volvio a la OP50 del AMFE 172 y del flujograma 158

Alinear las HO destapo que la rederivacion del 24/08 dejo la OP50 como "PREARMADO Y REMACHADO DE
BRAQUETS" y perdio la colocacion de las tiras de espuma. El AMFE REVA-4 numeraba esa misma
operacion «Prearmado de Espuma + Remachado» y su celda `F251` dice textual
«Indexa componentes (visagra, remaches, tiras de espuma) a la pieza»; la OP40 del propio AMFE
172 troquela "las tiras que se aplican en las bocas del defroster" y ninguna operacion las
aplicaba.

Corregido (`scripts/_corregirOp50EspumaDuctos.mjs`, gate `runWithValidation`: 0 criticos):
la OP50 es **PREARMADO DE ESPUMA Y REMACHADO DE BRAQUETS**, con un work element nuevo
`Tiras de espuma 427ESP003TRO01 (2 tiras de 670 mm)`. El flujograma 158 dice ahora
*PREARMADO: COLOCACION DE TIRAS DE ESPUMA Y REMACHADO DE BRAQUETS*. PNG, PDF y export del AMFE
regenerados, y los 3 adjuntos del borrador reemplazados.

**Queda abierto:** ese work element no tiene modo de falla. El REVA-4 tenia uno
("5 - Mal posicionado de espuma troquelada en pieza plastica") pero su causa era
"Error fuera de estandar", el tipo de causa generica que esta rederivacion saco a proposito.
Una causa concreta la tiene que dar la planta.

## 3. El remache quedo cerrado con fuente primaria

El plano `AD529S.pdf` que Carlos reenvio el 10/08/2026 es el catalogo de remaches POP de Stanley.
Fila resaltada: **AD 529-S**, diametro nominal **4,0 mm (5/32")**, largo **7,4 mm**, espesor
remachable **2,1 a 3,6 mm**, diametro de cuerpo montado 3,90/4,08, diametro de broca 4,1/4,3.

La OC **15990 del 04/08/2026** a **Black y Decker Argentina** compra contra el codigo
`427VAR001MON01` en dos lineas: `AD529S Remache POP Aluminio 4,00 mm x 7,4 mm` y
`AD529SPR ... esmalte negro`. El codigo `AD529EC` existe en el maestro con **0 lineas de BOM y
0 OC** en las 10.635 ordenes barridas. Cual queda lo define Carlos.

## 4. Estado de los codigos de la BOM (maestro del arb + 10.635 OC del disco Z)

El maestro `INSUMOS.TXT` **no tiene campo de proveedor**: la columna sin encabezado esta vacia en
las 3048 filas. El proveedor sale unicamente de las OC.

| Situacion | Codigos |
|---|---|
| Proveedor si, codigo de proveedor no | `427TEL002COR01` (SINOYQX) · `427VAR002/003/004/005MON01` (Establecimientos Gamar) |
| Proveedor si, codigo de proveedor si | `427VAR001MON01` (Black y Decker, `AD529-S` / `AD529-SPR`) |
| Sin proveedor definido | `427ESP003TRO01` (0 OC; la BOM del legajo dice Mentvil, la lista de Calidad del 14/05 dice Cortipol) · `AD529EC` (0 OC y 0 BOM) |
| Consignados | `MP8156/57/58/59/60` (Testori, OC a 0,0001) · `MP7457` (Cozzuol) |
| No son provisorios | `52110` (el codigo ARB ya es el del fabricante tesa) · `ET-SATO-100X60` (13 OC a Gabriel Iriarte) |
| No son item de compra | `CORDUC0001V1` a `CORDUC0007V1` - codigos internos de corte, sin BOM y sin OC |

Fechas de los exports usados: `RELACIONES.TXT` 21/08/2026 · `INSUMOS.TXT` 04/08/2026 ·
`ARTICULO.TXT` 03/08/2026.
