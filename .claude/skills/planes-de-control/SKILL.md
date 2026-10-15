---
name: planes-de-control
description: Armar, corregir o revisar un PLAN DE CONTROL de Barack (formulario I-AC-005.1 de Calidad, prelanzamiento o produccion, y el de recepcion I-AC-005.2) — de donde sale cada fila, que va en cada columna, como lo hace Calidad cuando lo hace bien (los planes que reviso Cecilia Rodriguez), lo que exigen IATF 16949 8.5.1.1 + Anexo A y el checklist A-10 del APQP 3a ed., y los errores que ya nos marcaron. Usar cuando Fak o Calidad pidan un plan de control ("PC", "PdC", "plan de contorl"), cuando haya que corregir uno de Calidad, cruzarlo con el AMFE o el flujograma, o completar el ciclo de control de una hoja de proceso desde un plan.
---

# Planes de control (I-AC-005.1)

Pedido de Fak, 15/10/2026: *"necesito estar seguro de que sabemos armar planes de control... mira planes
de control bien hechos con revisiones hechas por Cecilia"*. Antes de esto, el 09/10 un plan salio con el
formato de la app, sobre un borrador de marzo que nadie habia comparado con planta (*"¿como te
aseguraste de hacerlos bien?"*). Esta skill junta lo que hace bien Calidad, lo que pide la norma y lo que
ya nos marcaron. Las fuentes con su ruta estan en `referencias.md`, al lado de este archivo.

## 0. De quien es el plan

- **El plan de control es de Calidad** (`autonomy-contract.md` §F; Fak 08/09: *"ingenieria no hace planes
  de control... que lo actualice calidad"*). Ingenieria arma una **base preliminar** o **corrige** uno de
  Calidad **cuando Fak lo pide** (06/10: *"le modificamos solo lo seguro, asi le adelantamos laburo"*;
  13/10: *"armemos lo que podamos con lo que tengamos, la idea es avanzar"*).
- Nada sale a Calidad ni al cliente sin el OK de Fak para ese mail (`mail-envio.md`).
- Ningun documento dice que lo hizo Claude: `python scripts/_sinFirmaIA.py <archivo>` antes de mostrarlo
  (`core-prohibiciones.md` §9). Autor `F.Santoro`.

## 1. Antes de escribir una fila: las entradas

Un plan de control **no se escribe desde el AMFE solo**: el AMFE puede tener controles genericos o
inventados (Fak 10/10). La verdad es lo que se hace en planta y tiene papel. Juntar, con ruta y revision:

| Entrada | De donde | Para que |
|---|---|---|
| **Flujograma vigente** | `tools/flowchart/data/*.json` | manda la numeracion y la lista de operaciones (`no-pfd-no-ho.md`) |
| **AMFE vigente** | Supabase live (`amfe_documents`), nunca un PDF | siglas asignadas por Fak, controles de deteccion, retrabajos |
| **Hoja de proceso (HO) vigente** | `HOJAS DE OPERACIONES` del SGC (skill `hojas-de-proceso`) | maquinas, parametros, set up, ciclo de control |
| **Planes de recepcion por material** | `Y:\BARACK\CALIDAD\DOCUMENTACION SGC\Recepcion De Materiales\1 - Planes de control\<familia>\NNNN - ...` | caracteristica, especificacion, instrumento y muestra de cada material (ver §3.1) |
| **BOM ultimo nivel del arb** | `exports/BOM_OFICIAL_PATAGONIA_ULTIMO_NIVEL_ARB.xlsx` o `_bomLegajo.py` | que materiales se reciben (los semielaborados propios no) |
| **Plano y especificaciones del cliente** | legajo `6-Planos` / `13-Especificaciones`, normas VW en `docs-local\normas-vw` | caracteristicas especiales designadas (TLD, CC), cotas, ensayos PV/TL |
| **Cronograma de calibracion** | `Y:\...\CALIBRACION\Cronograma calibracion\13-Cronograma de calibracion <año> REV.N.xls` | el codigo MC existe, esta en ese sector y vigente |
| **Fichas de embalaje vigentes** | `Y:\...\Fichas Embalaje` / legajo `19-` | todas las vigentes de la pieza (GE-xxx) |
| **Plan existente y sus versiones** | mails de Calidad, legajo `12-` / `24-` / `32-` | **se listan todas y manda la mas nueva validada** (LECCIONES 14/10) |
| **Reclamos, 8D, alertas de la pieza o la familia** | `8D`, `Alertas de calidad`, KPM | IATF 8.5.1.1 f/h: el control que nacio de un reclamo va al plan, con el reclamo nombrado |
| **Auditorias del cliente** | `Plan de acción - VW - VDA 6.3 - 2025.xlsx` y siguientes | lo que el cliente ya marco no se repite (ver §6) |
| **Fase** | la dice Fak o el pedido | prototipo / prelanzamiento / produccion (§2.3) |

**El proceso del plan es el de la HO mas nueva, y si la HO no coincide con lo que dice la persona del
sector, se pregunta antes de escribir.** El 09/10 el plan de termoformadas decia corte laser y refuerzo
cosido; la hoja 984 y Pablo Gamboa decian tijera de retrabajo y refuerzo pegado.

**Un registro de pruebas no es una especificacion.** Una planilla de parametria de prueba (HTO, corrida
de prueba) dice QUE variables se controlan; el VALOR sale de la HO, la hoja de set up o la parametria
liberada. Si ninguna lo dice: `TBD` y la pregunta a quien corresponde (mismo criterio que "una tizada
sola puede ser una prueba", `consumos-entregables.md` §6).

## 2. El formulario

Plantilla oficial: `Y:\...\SISTEMA\SISTEMA SGC\Instructivos\CALIDAD\Anexos\I-AC-005.1  Plan de Control de
Prelanzamiento y Produccion A.xls` (recepcion: `I-AC-005.2 ... Recepcion A.xls`). Calidad trabaja sobre
sus propios planes como base (p. ej. `PC PWA.xlsx`); lo que importa es que sea **su** formulario, nunca el
export de la app (09/10).

### 2.1 Primera hoja

- El formulario oficial rev A dice `FECHA VDA` y firmas `INGENIERIA · CALIDAD · PRODUCCION · SQA CLIENTE`; los
  planes que Calidad usa hoy (Rev 0 de Nicolas, PWA) dicen `FECHA PSW` y `CALIDAD · PRODUCCION · INGENIERIA ·
  CLIENTE`. Se respeta el archivo de Calidad sobre el que se trabaja.
- **REVISIONES** (`REV. | FECHA | ITEM CAMBIADO | DETALLES | FECHA PSW | MODIFICO`): una fila por cambio,
  con la operacion tocada en ITEM y el porque en DETALLES (ej. Cecilia: *"OP20 · Se agrega control de
  apilado"*). La revision va con **letra empezando en A** (I-AC-005 §5.2.1) y el nivel de actualizacion
  **en rojo**. Una correccion antes de que el documento salga no abre revision (LECCIONES 09/10).
- **FIRMAS**: Calidad · Produccion · Ingenieria · Cliente, vacias.

### 2.2 Encabezado del plan

Fase tildada (una sola) · contacto · fecha original y de revision · numero y nombre de la pieza (todas
las variantes de color/codigo) · equipo (`C.RODRIGUEZ / A.AGUAYO / ...` como lo pone Calidad) · cliente y
codigo del cliente · **Caracteristica S/R: una sola marca** (SI si hay alguna CC o D/TLD asignada; la Rev 0
del APC tenia SI y NO marcados) · aprobacion del cliente.

### 2.3 Fase

- **Prelanzamiento**: el de produccion + **mas muestreo y mas puntos de control** hasta validar el
  proceso (I-AC-005 §5.2 nota; APQP 3a ed. §3.6: mas frecuencia, mas controles en proceso y final,
  auditorias reforzadas, dispositivos a prueba de error identificados). VW puede pedir **Safe Launch**.
- **Produccion**: el plan vivo; se revisa ante producto no conforme enviado, cualquier cambio de
  producto/proceso/logistica/proveedor/volumen/AMFE, reclamo, y por frecuencia segun riesgo (IATF 8.5.1.1
  f-i). Un plan de pieza puede ser **por familia** si el proceso es comun (IATF 8.5.1.1, Anexo A.1).

### 2.4 Columnas (letras del formulario oficial)

| Col | Que va | Como lo escribe Calidad cuando esta bien |
|---|---|---|
| A | Nº de operacion | `Operación 20.` en la primera fila del grupo; recepcion = 10; el numero es el del **flujograma** |
| B | Nombre del proceso | el del flujograma (`Preparación de corte`, `Costura de union`) |
| C | Maquina / equipo / herramienta | con su codigo: `Maquina de corte N° BMA 089`, `Maquina de costura recta N° BM 211`, `Dispositivo N° BM 033/34` |
| D | Nº de caracteristica | `1.0`, `2.0`...; si el plano tiene globo, el del globo |
| E | Caracteristica de PRODUCTO | algo medible de la pieza: `Margen de costura`, `Diametro de agujeros`, `Peso / Gramaje` |
| F | Caracteristica de PROCESO | un parametro de la maquina: `Temperatura horno`, `Programa de tizada`, `Tension`. Producto y proceso **nunca** en la misma fila |
| G | Clasif. carac. especial | **se copia**, no se calcula (§4) |
| H | Especificacion / tolerancia | valor + tolerancia + unidad: `4 ± 1 mm`, `140 gr/m2 ± 10 %`, `< 100 mm/min`, `Cantidad de orificios ø 4 ± 0,5 = 30` |
| I | Calibre o tecnica | instrumento con codigo: `Regla MC N° 334`, `Mylar de control MC345`, `Calibre MC 212`, `Camara de flamabilidad MC184`, `Visual / muestra patron` |
| J-K | Muestra: tamaño y frecuencia | concretos: `1 Pieza · Inicio de turno / Falla mantenimiento / Corte de energía / Problema de calidad`, `100% · Por lote`, `1 Muestra · Por entrega`, `3% del lote`, `5 piezas · Anual` |
| L | Metodo de control y registro | el registro real: `Registro de set up`, `Autocontrol`, `P-10/I.` + `Sistema ARB`, `I-AC-027.I` (ensayo), `Informe de laboratorio` |
| M | Responsable | por fila: `Auditor de recepcion`, `Operador de produccion`, `Inspector de calidad`, `Laboratorio`. Nunca el mismo rol en todas (09/10: "Lider de produccion" en las 24 filas) |
| N | Plan de reaccion | `Según P-09/I.` en proceso, `P-14.` en recepcion (ver §3.5) |

Al final, **`TEST DE LAY OUT`**: el control anual de cotas y ensayos del cliente (Cecilia: cotas del plano
con cinta/calibre, 5 piezas, anual, laboratorio; Amarok APC: PV2005 cambio de climas, 1 muestra por
referencia, anual). VW lo exige como *Layout inspection and functional testing* (CSR VW; la VDA 6.3 de
2025 lo marco como incompleto, §6).

## 3. Como se escribe cada fila

### 3.1 Recepcion (operacion 10)

- **Una fila por material de la BOM** que se compra (los semielaborados propios no se reciben), con el
  codigo del arb y el del proveedor.
- Las caracteristicas, especificaciones, instrumento y muestra **salen del plan de recepcion de ese
  material** (`NNNN - Plan de Control de Recepcion ...`): se copian o se escribe `Ver plan de control de
  recepcion N° NNNN` (asi lo hacen los TBA). Si el material no tiene plan de recepcion, la fila va con
  `TBD` y a la lista para Calidad: no se inventa (el 15/10 `VINILO\Patagonia\` estaba vacia).
- Lo que Barack **ensaya** se escribe como ensayo, no como certificado: flamabilidad con camara MC184,
  peso con balanza, ancho con cinta (memoria `reference_planes_control_recepcion_barack`). "Por
  certificado" solo cuando el plan de recepcion dice certificado.
- Responsable `Auditor de recepcion`, frecuencia `Por entrega`, registro `P-10/I.` (y `ARB`), reaccion `P-14.`

### 3.2 Proceso

- **Una fila = una caracteristica con criterio, nunca un modo de falla.** ✗ `Costura descosida o débil`,
  `Varilla desalineada` (Rev 0 APC) → ✓ `Costura completa, sin saltos` con `Visual / muestra patron`, o
  `Posicion de la varilla` con su cota y su dispositivo.
- **Set up** por maquina, con lo que se verifica (programa cargado, parametros, cuchilla, aguja, hilo,
  capas) y la frecuencia completa de Calidad: **inicio de turno / falla de mantenimiento / corte de
  energia / problema de calidad** (IATF 8.5.1.3 y 8.5.1.4). Si existe hoja de set up, se nombra con su
  numero y se copian los valores; `Ver hoja de set up` sin valores en ninguna parte = celda vacia
  disfrazada (06/10).
- **Primera y ultima pieza** cuando aplica (IATF 8.5.1.1 b, 8.5.1.3 d): el patron Toyota/TBA es `1 Pieza ·
  Inicio y fin de turno · Registro de control · Operador de calidad` + `100% · Por lote · Autocontrol ·
  Operador de produccion`, dos filas por caracteristica.
- **Parametros de proceso con valor y tolerancia** (IATF Anexo A: "parametros de proceso, incluyendo
  ajustes y tolerancias"): temperaturas, tiempos, presiones, caudales, relaciones de mezcla, velocidades.
  Si dos papeles dan valores distintos, la celda va `CONFLICTO: <A> (fuente) / <B> (fuente)` y a la lista.
- **Acondicionamiento de quimicos** (mezcla, agitacion, temperatura de componentes, vencimiento, FIFO):
  la VDA 6.3 de VW nos marco *"la mezcla y agitacion de adhesivo y reticulante no estan descriptos en el
  Plan de Control, tampoco se definieron los tiempos de agitacion"*.
- **Valores medibles se registran**: VW marco *"deben ser registrados los valores para las verificaciones
  no atributivas en costura"*. Una variable (mm, °C, puntadas) no va con `Autocontrol` solo: va con su
  registro.
- **Dispositivos a prueba de error (poka-yoke)**: cada uno con su metodo y frecuencia de verificacion
  (IATF 10.2.4; A-10 preguntas 13-14; I-AC-032). La frecuencia tiene que permitir contener lo producido
  desde la ultima verificacion buena.
- **Retrabajo**: si existe, va en el plan (o en uno vinculado) con sus controles (A-10 preg. 10; Amarok
  APC op 37). Si el cliente no lo aprobo, se dice (preg. 11; IATF 8.7.1.4).
- **Lecciones aprendidas y reclamos**: el control que nacio de un reclamo lleva el reclamo en la celda
  (Cecilia: *"Reclamo SAS - SC_PAC_24102-8-020 - 28/10/24 Se incorpora regulacion de velocidad-largo y
  tension"*; A-10 preg. 21).

### 3.3 Control final y embalaje

- El control final mira la caracteristica **visible o funcional** que una fuente marca asi (plano, HO de
  la operacion, especificacion), nunca la oculta (06/10: el final miraba la costura de union en vez de la
  vista). Inspector de calidad.
- Embalaje: identificacion (codigo, ARB) y cantidad por medio **de cada ficha vigente** (06/10: dos fichas
  vigentes y una sola en el plan).
- No copiar el final de otra pieza (Rev 0 APC: *"5 piezas por lote de inyeccion de sustrato plastico"* en
  un apoyacabezas).

### 3.4 Instrumentos

Cada codigo MC se cruza con el cronograma de calibracion: que exista, que este en el sector donde se
usa y que este vigente. Lo que no cierra va a la lista para Calidad, sin decidir por ellos. Medido el
15/10 en el cronograma 2026 Rev. 7: MC184 (camara) vencida desde el 11/09/2026; MC212 asignado a Conversion
de Cintas con checklist NO OK; MC334 y MC413 vencidos. Un instrumento sin codigo (`Regla Metalica N° MC`) es
una celda incompleta. **Antes de poner `TBD` en un calibre, buscarlo en el cronograma**: los calibres de forma
de los APC Patagonia estan (MC506/507/508) y el 15/10 los deje en TBD hasta que el auditor los encontro.

### 3.5 Plan de reaccion

`Según P-09/I.` es una referencia valida (IATF Anexo A: "incluido o referencia"): el P-09/I (sinoptico,
rev B.1) detiene el proceso, controla hacia atras hasta piezas buenas, segrega, y con 3 no conformes
consecutivas del mismo defecto para la linea y escala. Para un poka-yoke que falla y para una
caracteristica CC/D, verificar que el P-09/I alcance; si hace falta algo mas, va a la lista para Calidad.

### 3.6 Lo que falta no se rellena

Celda sin papel = `TBD`, y la lista "lo que necesito de Calidad / de planta" al lado del archivo. Nunca
un valor parecido de otra pieza, ni "segun especificacion" generico (`core-prohibiciones.md` §1).

## 4. Cruce con el AMFE y el flujograma

- **Siglas (columna G)**: se COPIAN del `specialChar` de las causas del AMFE que asigno Fak y de lo que el
  cliente designo en el plano. La `D` (Barack) / `D/TLD` (VW) de flamabilidad sale de la designacion del
  plano o la norma, no de la palabra. Lo que el criterio marca y nadie asigno va a una hoja aparte
  "propuesta de siglas" con S y O (`caracteristicas-especiales.md`). Dos limites (auditor, 15/10):
  - la sigla va en la fila de **esa caracteristica**: la SC de "seleccion incorrecta del hilo" de la op 30
    va en el hilo de la costura, no en la recepcion del hilo; una causa de la op 52 no le pone sigla a la op 10;
  - una sigla del AMFE que **no cumple el criterio** (SC con O < 4, que el validador marca
    `CAUSE_SC_FUERA_DE_REGLA`) no se propaga al plan: se lista para que Fak la asigne o la saque.
- **Toda operacion del flujograma tiene filas** en el plan; las que el plan no tiene se listan (06/10:
  51, 60, 71, 81, 82, 101 del APB faltaban en el plan de Calidad).
- **Los controles del AMFE y los del plan son los mismos** (Fak 10/10): mismo instrumento, misma
  frecuencia. El control de deteccion puede estar aguas abajo (una causa de la 41 detectada en el final).
- **Un parametro con papel entra al plan aunque el AMFE no lo tenga** (Fak 15/10: *"aunque no coincida
  perfectamente con el AMFE o flujograma... debemos asegurarnos de que quede muy bien con todos los
  parametros disponibles"*). Esa diferencia va a la lista de **devolucion al AMFE**, no se saca la fila.
- Herramienta: `node scripts/_planControl.mjs <PIEZA>` arma la base desde flujograma + AMFE + HO con la
  fuente de cada celda y corre los gates 0-8 (plan `docs/PLAN_P6_PLANES_DE_CONTROL_2026-10-10.md`). Hoy
  tiene cargado solo el APB; una pieza nueva se agrega en `scripts/_lib/planControlEntradas.data.json`.

## 5. Corregir un plan de Calidad (el camino que Fak ya aprobo, 06/10 con Nicolas)

1. Listar las versiones del plan y tomar la mas nueva (mails, legajo, Escritorio). **Y justo antes de
   generar, confirmar el flujograma vigente** (`git log -1 -- tools/flowchart/data/<NNN>*.json`) y releer el
   AMFE live: el 15/10/2026 otra sesion emitio el 152 Rev.A a las 10:59, mientras se armaba el plan de los APC
   con la numeracion vieja, y el auditor lo encontro con colisiones de numero.
2. Trabajar sobre una **copia** (`exports/<TEMA>_<AAAAMMDD>/... - correcciones de Ingenieria <fecha>.xls`),
   nunca sobre el original.
3. **Si se corrigen pocas celdas**: cada una en amarillo con su comentario (fuente + ANTES), como el PC de
   Nicolas del 06/10. **Si el plan se rearma entero**: archivo limpio, sin amarillo ni notas, y los cambios en
   la lista aparte. Fak, 15/10/2026, al abrir el de los APC con casi todo amarillo: *"todo amarillo con
   demasiadas notas... no me gusta"*. Si Calidad ya cambio una celda en una version posterior, se saltea. En
   una celda combinada se escribe en la de arriba a la izquierda (`MergeArea.Cells(1,1)`): escribir en otra
   no muestra nada (el N° de parte del 15/10 salio vacio).
4. **Una caracteristica por fila**, como los planes de Calidad: asi cada fila lleva una sola marca (con varias
   en la misma celda se lee "SC SC SC").
5. **La marca critica en el plan es la `D` en rojo**, como en los planes de Calidad y como pidio VW en la VDA
   6.3 ("con la letra D"); D y TLD son la misma marca (Formel Q §7.5). Fak, 15/10: *"¿por que no solo D?"*.
6. Lo que pide una fila nueva o un dato sin papel va a un `.txt` aparte ("que queda para la reunion").
7. Auditor antes de mostrar; se le muestra a Fak abierto; el mail a Calidad, con su OK.
   Script de referencia: `scripts/novax/_pcNicoCorrecciones.py`. Render sobre la plantilla por Excel COM:
   `scripts/_cpFormatoCalidadPwa.py` (abre la plantilla en solo lectura).

## 6. Checklist antes de mostrarlo (A-10 del APQP 3a ed. + lo que ya nos marcaron)

1. ¿Esta en el formulario de Calidad y no en el de la app?
2. ¿Una sola fase tildada, S/R con una sola marca, nivel de actualizacion en rojo, revision con letra?
3. ¿Cada operacion del flujograma tiene filas, con su numero y nombre?
4. ¿Cada material comprado de la BOM tiene recepcion, con lo que dice su plan de recepcion?
5. ¿Cada fila es una caracteristica con criterio (no un modo de falla) y producto/proceso separados?
6. ¿Cada especificacion tiene valor, tolerancia y unidad, o `TBD`/`CONFLICTO` en la lista?
7. ¿Cada instrumento tiene codigo MC, y ese codigo esta en el cronograma, en ese sector y vigente?
8. ¿Set up por maquina con las cuatro situaciones de arranque? ¿Primera/ultima pieza donde aplica?
9. ¿Parametros de proceso con valor, y acondicionamiento de quimicos (mezcla, agitacion, temperatura)?
10. ¿Cada poka-yoke con metodo y frecuencia de verificacion?
11. ¿Retrabajos incluidos? ¿Aprobados por el cliente?
12. ¿Siglas copiadas del AMFE asignado y del plano, D/TLD en flamabilidad si el plano la designa?
13. ¿Los controles del AMFE estan en el plan con el mismo metodo y frecuencia? ¿Las diferencias listadas?
14. ¿Responsable por fila (no el mismo en todas)? ¿Plan de reaccion en todas?
15. ¿Valores medibles con registro (no solo autocontrol)?
16. ¿Control final sobre lo visible/funcional? ¿Embalaje con todas las fichas vigentes?
17. ¿Test de lay out anual con cotas del plano y ensayos del cliente?
18. ¿Reclamos y alertas de la pieza o familia incorporados con su numero?
19. ¿Nada copiado de otra pieza (textos de otro producto, "TRASERO CENTRAL" en la hoja del delantero)?
20. ¿`_sinFirmaIA.py` limpio y el archivo abierto y mirado impreso?

## 7. Apoyacabezas (APC) — lo especifico

Proceso tipico (Patagonia, flujograma 152): recepcion · corte de tela/vinilo · refilado · costura de
union · costura vista · (horno de ablande de funda) · inyeccion PU en molde con funda (PIP) · inspeccion
final · embalaje. Lo que un plan de APC tiene que tener, ademas de lo general:

- **Inyeccion PU (PIP)**: las variables que se registran en la planilla de parametria de Patagonia son
  temperatura de POLY y de ISO, caudal (g/s), relacion de mezcla, peso del shot (g), tiempo de inyeccion,
  temperatura y humedad ambiente y peso de la pieza (`PIP Process - Planilla de parametria.xlsx`, legajo
  `28- Corrida de Produccion\HTO`). **Esa planilla es un registro de pruebas**: sirve para saber que
  parametros van; los valores salen de la HO-968/969/970 o de la parametria liberada. El componente del
  plan (POLI-PLUS FF-629 en la Rev 0) se cruza con el de la planilla de pruebas (F636/FF636): si no es el
  mismo, es `CONFLICTO` a preguntar.
- **Componentes PU**: planes de recepcion 818 (ISO-PLUS 1290: NCO 25,5-26,5 %, viscosidad, densidad) y
  822 (POLI-PLUS FF-629: viscosidad, densidad libre, tiempos de crema y pegajosidad), vencimiento y FIFO
  (VW marco *"el FIFO para espumas de apoyacabezas no es asegurado"*).
- **Estructura (varilla/soporte)**: planes de recepcion 1063/1064/1065 (Patagonia), p. ej. delantero
  2HC.885.915: Ø14 +0,05/-0,1 mm, cota 130 mm, Ø90 mm, cromado, 3 % del lote con calibre digital.
- **Costura**: largo de puntada, margen y atraque con los valores confirmados de Patagonia (memoria
  `reference_valores_costura_patagonia_confirmados`; usa la tabla vigente, no el pptx de mayo).
- **Horno de ablande de funda** (si el proceso lo usa): temperatura y velocidad con pirometro calibrado
  (Amarok APC op 40: 250-280 °C; la VDA 6.3 de VW marco el pirometro del horno de los apoyacabezas danado,
  item 6.4.1, y sin calibrar, item 6.4.3).
- **Calibres de forma del control final**: MC506 (delantero), MC507 (trasero central), MC508 (trasero
  lateral), cronograma 2026 Rev. 7, sector Inyeccion VWA.
- Primera aplicacion completa: `scripts/apc/_pcApcPatagonia.py` y `exports/PC_APC_PATAGONIA_20261015/`
  (auditoria en `.sgc-cache/auditorias/planes_control_skill_apc_2026-10-15.md`).
- **Final y lay out**: funda alineada, sin espuma a la vista ni migraciones por costura, cerrado completo,
  distancia entre astas contra calibre/respaldo; anual: PV2005 cambio de climas, compresion PV 3410 del
  conjunto (VW lo pidio en la VDA 6.3), dureza/indentacion y extraccion de funda si el cliente los pide.
- **Flamabilidad**: D/TLD solo si el plano la designa; ensayo en camara MC184 en recepcion.
