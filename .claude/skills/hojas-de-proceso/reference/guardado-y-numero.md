# hojas-de-proceso / reference — §3 bis — donde se guarda la hoja (HOJAS DE OPERACIONES del SGC) y que numero de HO lleva

Parte del skill `hojas-de-proceso` (se partio el 16/10/2026, tanda 1.5 del plan del sistema, porque el
SKILL.md tenia 779 renglones). Los gates, la lista de §7 y los errores de §7 bis siguen en `SKILL.md`:
esto se lee cuando el trabajo llega a esta parte, no en vez de aquellos.

---

## 3 bis. Dónde se guarda la hoja — `HOJAS DE OPERACIONES` del SGC, nunca en Ingeniería

**Se entrega UN PDF por pieza, con las hojas ordenadas por operación y sin la portada** (Fak,
02/10/2026: *"deberían estar unidas las de Top Roll en una hoja sola... sin la hoja esa primera
que hacés de intro... no la elimines, me gustó, pero por ahora no se la pasamos... la idea es que
sea un PDF por pieza, y organizadas"*). Las hojas de varios autores y generadores de la misma
pieza van juntas en ese PDF; la hoja de una máquina (sector) va en el suyo. Lo arma
`scripts/novax/_pdfPorPieza.py` (lista cada hoja en el orden en que quedó); el generador del hot
melt saca la portada con `--sin-portada`.

Fak, 24/09/2026, cuando dejé la HO-991 del P21 en la biblioteca de Ingeniería
(`1- GENERAL\INSTRUCTIVOS\INSTRUCCIONES OPERATIVAS\`): *"ahí no van las hojas de proceso, hay
que ir guardándolas donde sí van, o sea `Y:\BARACK\CALIDAD\DOCUMENTACION SGC\HOJAS DE OPERACIONES`"*.

| Qué | Dónde |
|---|---|
| Hoja de un producto de cliente | `...\HOJAS DE OPERACIONES\1- CLIENTES\<CLIENTE>\<proyecto>\HO NNN - <pieza o sector>\` — **una carpeta por HO** (Fak, 24/09/2026), con la vigente y una sola `OBSOLETO\` adentro. **Cliente y proyecto se llaman igual que en `PPAP CLIENTES`** (Fak, 25/09/2026: *"igualalos al PPAP"*). Ej. `REYDEL-SMRC\APB P21\HO 991 - APB P21 HILO NARANJA\` |
| Lo viejo (2011-2024) | `...\HOJAS DE OPERACIONES\9- HISTORICO (NO USAR)\` (era `Revisar`): no se toca ni se usa |
| Hoja de un sector / máquina | `...\HOJAS DE OPERACIONES\2- SECTORES\<sector>\` |
| Retrabajo | `...\HOJAS DE OPERACIONES\4- RETRABAJOS\` |
| El número | `...\HOJAS DE OPERACIONES\3- LISTADO\Listado hojas de proceso.xlsx` (pestañas INDICE y CRITERIO; el próximo libre lo da `python scripts/_hoNumeros.py`). CREADO POR = la persona (`F.Santoro`), nunca "Claude", y en el libro no va ninguna pestaña ni nota para mí (Fak, 08/10/2026; la historia que vivía en la pestaña oculta borrada está en la memoria `reference_listado_ho_historia_numeracion`) |

**El número** (Fak, 25/09/2026, al resolver 13 números repetidos: *"no quiero pasar de 999"*):
- **Es de la HOJA, no del código.** Si varias piezas se hacen igual, van en la misma HO, con una
  página (o subcarpeta) por código: 025, 952, 984 y la **913**, que junta las 17 telas de costura
  blanco PWA (`...\PWA\HO 913 - COSTURA BLANCO\<código>\`). No se abre un número por tela.
- Si dos hojas tienen el mismo número, **se lo queda la fila del listado**; la otra cambia.
  Un número que se deja de usar no se reusa (queda su fila OBSOLETO "pasó a HO N").
- **No se pasa de 999**: las hojas completas (GENERAL) siguen 992…999, después los huecos que
  nunca tuvieron hoja (903, 921-925, 928, 930, 936, 947) y después la **serie 800**. La 300-899
  no se usó nunca (300 y 400 quedan sugeridas para inyección y mesa de corte).
- Antes de dar un número y al cerrar: `python scripts/_hoNumeros.py` (choques entre carpetas,
  números sin fila en el listado, próximo libre; `--q3` lee además el cajetín).
- **El listado maestro es registro compartido**: la fila de la hoja nueva (o de su cambio de
  revisión) se **prepara** en la misma tanda en que se arma la hoja, se le muestra a Fak y se
  **escribe con su OK** (`autonomy-contract.md` §F; el hook `apqp-cliente-guard` frena copiar o
  escribir `Listado hojas de proceso.xlsx` sin ese OK, pero no ve el camino por Excel COM: el OK
  se pide igual; escape `~/.claude/.apqp-listado-ok`, vale una carga). En el cierre se dice qué
  fila quedó preparada y si ya se escribió.
- **Cambiar el número de una hoja existente no pasa por Excel**: se toca solo el texto `HO-NNN`
  de `xl/sharedStrings.xml`. Guardarla con Excel por COM se tiró de 1 a 3 imágenes "en celda"
  por libro en las telas PWA (25/09/2026; se volvió al respaldo).

(«Un número por PIEZA, no por sector» está arriba, antes de los gates.)

**Lo único que va con número propio es lo que queda AFUERA del proceso de la pieza** (Fak,
08/10/2026: *"lo que queda aparte son las hojas que aclaran cosas aparte... que no están dentro
del proceso, como un cambio de molde"*; *"no quiero que me vuelvas a preguntar"*). Cómo se decide,
sin preguntarle:

| Pregunta | Sí → | Ejemplos |
|---|---|---|
| ¿Es lo que el operario hace para producir la pieza en ese puesto (cargar, operar, controlar, sacar, reponer material)? | Hoja de la **pieza**: número de la pieza, N° de operación del flujograma (60; si se parte, 60.1, 60.2) | embossing del logo (994 · 60); control de receta, montaje y cambio de rollo, empalme, arranque y parada de la laminadora (992 · 20.1 a 20.8) |
| ¿Prepara, ajusta o cambia la MÁQUINA y no es el paso a paso de la pieza? | Hoja de **máquina**: número propio, en `2- SECTORES`, operaciones 10, 20, 30… | prender y calentar, set-up y parámetros, cambio de molde o de herramienta, limpieza, alarmas: laminadora hot melt (993), prensa de embossing (995), costura CNC (118) |

La hoja de la pieza nombra la de máquina cuando la necesita (*"La prensa se prende y se prepara
con la HO-995"*; *"el encendido... está en la HO-993"*). Las dos filas van al listado con el OK
de Fak (§F), como cualquier número nuevo.

**¿Cada hoja puede tener su revisión dentro del mismo número?** Ni el SGC ni las normas lo
obligan ni lo prohíben (barrido del 01/10/2026: I-IN-002, P-05, P-09, I-AC-008, IATF 16949,
ISO 9001, APQP 3ª, VDA 6.3 P6). Lo que sí está escrito: la revisión es una **letra** y sube al
modificar (I-IN-002 §5.1); la instrucción lleva nivel y fecha (P-09 §5.2); la regla de "todas
las hojas con la misma revisión y fecha" (P-05 §5.1.2) es para manuales, procedimientos e
instructivos, no para las HO. Hoy conviven las dos formas (HO 971 y 927 con pestañas en
distinta revisión; 968 a 991 con una revisión por libro) y el listado tiene una sola columna
de revisión por HO. **Es criterio de Barack: lo define Carlos Baptista** (Fak se lo va a
preguntar). Hasta que conteste, no se unifica ni se cambia la revisión de lo que ya está.

Van el `.pptx` y su `.pdf`, con nombre `HO-<N> - HOJAS DE PROCESO - <PIEZA> - Rev.<letra>`. El
generador puede escribir en el scratchpad para mirarla, pero la entrega va ahí. Los decks de
HOTMELT y MOLDEADORA IMG se mudaron el 25/09 de `INSTRUCCIONES OPERATIVAS` a
`1- CLIENTES\NOVAX\Tapizadas puerta\TOP ROLL\` (son del Top Roll Patagonia, N 216/256/285/315); el de
la PRENSA EMBOSSING se mudo el mismo 24/09 a `1- CLIENTES\COZZUOL\00_VW427-1LA_K-PATAGONIA\00- Upper Trimming\`;
el 08/10/2026 se partio en HO-994 (la pieza, operacion 60) y HO-995 (la maquina, a `2- SECTORES`),
las dos sin fila en el listado todavia.
