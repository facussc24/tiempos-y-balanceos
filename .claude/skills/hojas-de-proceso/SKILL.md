---
name: hojas-de-proceso
description: Hoja de proceso / hoja de operaciones («la hoja», «la HO», «la filmina») de Barack, formulario I-IN-002.4-R01 en PowerPoint A4 o A3 de una foto por paso — que le manda cada paso al operario y con que palabras, que foto va, pantallas de HMI legibles impresas, donde se guarda y que numero de HO lleva, y los errores que Fak ya marco (logo, plan de reaccion, numero, TBD, ciclo de control lleno, pieza rara sin aclarar, hoja cortada). Usar al armar, corregir o revisar una hoja de proceso, y siempre antes de mostrar o imprimir un paquete de hojas para planta. Canon: `docs/CRITERIOS_HOJAS_DE_PROCESO.md`.
---

# Una hoja de proceso se lee de pie, al lado de la maquina, impresa en A4

> **El que decide si una hoja sirve no es como se ve en el monitor: es como se lee en el papel.**

Cada gate de abajo nacio de una hoja que Fak devolvio; los casos, con fecha y cita, estan en
`reference/casos.md`.

---

> **Lo crítico va primero: §7 (antes de entregar) y §7 bis (los errores que Fak ya marcó), y después los
> gates.** Si ves esta skill cortada (pasa tras un compactado), hacé `Read` del SKILL.md entero antes de entregar
> o imprimir. Al entregar: `hojalib_selftest.py` y `hoja_proceso_check.py` en verde; las láminas miradas una por
> una; ningún `TBD` en la descripción (solo en el cajetín); y **todo PDF de hojas que va a Fak o a planta, propio,
> del servidor o de otro autor, pasa por `python scripts/_revisarPaqueteHO.py <pdf>` sin ROJO** (tanda 1.5).

**Un número por PIEZA, no por sector** (decisión de Carlos Baptista, contada por Fak el
01/10/2026: *"las hojas de proceso ahora están unificadas, no se separan más por sectores,
número único"*). 971 = APB de puerta, 990 = Insert, 992 = Top Roll, 994 = Upper Trim: todas las
operaciones de la pieza van en ese número y cada hoja lleva el **N° de operación del flujograma**.
Una operación no tiene un número de HO aparte.

**Lo crítico, en cinco renglones** (el detalle está en cada gate y en `reference/`):
- El EPP sale del riesgo real del puesto: **cada hoja declara su `epp=`**; los generadores no tienen set por
  defecto y frenan sin él (16/10/2026). Anteojos donde Fak dijo que no se usan es ROJO del revisor.
- CICLO DE CONTROL **vacío** hasta que Calidad emita su plan de control (canon 1.1 y 1.2). Registro: `Set up` o `-`,
  nunca "RC". Sin foto, el recuadro va vacío.
- La pieza de nombre raro y cada herramienta del puesto se aclaran y se marcan (0.8 b bis).
- El plan de reacción es el estándar y el ARMADO es el de la última hoja aprobada (canon 4.5; el revisor compara).
- Dónde se guarda y qué número lleva: `reference/guardado-y-numero.md` (§3 bis).

**Dónde quedó cada sección** (los números no cambiaron; las reglas y otros skills los citan asi):

| Sección | Archivo |
|---|---|
| §0 (gates 0.1 a 0.8, 1 a 3), §7, §7 bis | este `SKILL.md` |
| §1, §1 bis, §1 ter (criterios de imagen; la hoja A3 de una foto por paso) | `reference/criterios-de-foto.md` |
| §2 a §2 sexies, §3 (pantallas, foto del video, rotular, marcas, nota, castellano) | `reference/pantallas-y-fotos.md` |
| §3 bis (dónde se guarda, número de HO, listado maestro) | `reference/guardado-y-numero.md` |
| §4 (lo fijo del formulario), §5 (de dónde sale cada gate) | `reference/formulario-y-origen.md` |
| §6 (qué control frena qué, y dónde vive) | `reference/enforcement.md` |
| Los casos de cada gate, con fecha y cita | `reference/casos.md` |

---

<!-- paso0:inicio -->
**Paso 0 — qué formato se usa, antes de armar nada** (detalle en `docs/FORMATO_CASA.md`). En este orden: (1) si hay **formulario oficial del SGC** para esto, se usa ese; (2) si el **cliente tiene plantilla propia** (VW, BeOn, SMRC), se clona la suya; (3) si un **compañero ya usa un formato** para esto (Leo, Carlos, Gamboa) o hay uno en `FORMATOS GENERAL`, se copia ese; (4) recién ahí, el **formato de la casa** (`scripts/_lib/tema.json`). Y dos modos que no se mezclan: **corregir el archivo de otro** lleva color propio y «ANTES: …» en cada celda tocada (06/10); **rearmarlo entero** va limpio, sin amarillo ni notas (15/10). Antes de mostrarlo: `python scripts/revisar.py <archivo>`.
<!-- paso0:fin -->

## 7. Antes de entregar

- [ ] **lo que ya le marcaron a una hoja**: `node scripts/_observaciones.mjs --antes-de-mandar "hoja de proceso"` (libro
      de observaciones recibidas, tanda 13); lo que sale «A MANO» no lo caza ningún control.
- [ ] **todo PDF de hojas que va a Fak o a planta pasa por `python scripts/_revisarPaqueteHO.py <pdf>` sin ROJO**,
      también las del servidor y las de otro autor (tanda 1.5, 16/10/2026: el error entraba por lo que no pasaba por
      ningún control). Mide además el ciclo lleno, la pieza rara sin paréntesis, el EPP que no es del sector, el
      herramental sin marcar, la reacción del plan de control pegada, el texto tachado, la cantidad con "×", el camino
      de inspección y el ARMADO contra la última hoja aprobada de ese tamaño. `_imprimir.py` no imprime con un ROJO
      y `_pdfPorPieza.py` dice que no se muestra
- [ ] **si es un PAQUETE para imprimir o pasar a planta: la tabla de §7 bis, fila por fila, sobre el PDF**
      (y `python scripts/_revisarPaqueteHO.py <pdf>`, skill `imprimir`)
- [ ] `hojalib_selftest.py` en verde ("0 fallan")
- [ ] `hoja_proceso_check.py` en verde sobre el deck
- [ ] **las laminas miradas una por una**, renderizadas — no el script, el archivo publicado
- [ ] las pantallas miradas **al ancho que van a tener impresas**, no ampliadas
- [ ] PowerPoint cerrado antes de generar, y el texto verificado sobre el archivo guardado
- [ ] si el archivo lo venia editando Fak: su texto **intacto**, verificado con diff
- [ ] `fotodevideo.py leer` en verde: **ninguna foto sin decir de que video salio**
- [ ] **ninguna foto repetida con dos nombres** (`md5sum *.jpg | sort | uniq -d` sobre el hash)
- [ ] cada hoja con 2 a 4 pasos, una foto por paso, y las partidas con su (HOJA n DE m)
- [ ] **cada foto rotulada, mirada a tamaño completo DESPUES del ultimo cambio de recorte**
- [ ] **cada elemento de maquina que se ve en la foto de un paso (sensor, perilla, boton, guia)
      esta nombrado en algun renglon, o se decidio que el operario no lo toca** (criterio 15,
      23/09/2026: el sensor de la mesa estaba en la foto y ningun paso lo nombraba)
- [ ] **cada pieza de nombre raro que nombra un paso (acumulador, guiador, fusor, expulsores, sonotrodo…) tiene
      su aclaracion entre parentesis la primera vez Y su recuadro con el nombre en la foto** (0.8 b bis, Fak
      13/10/2026). Se recorre paso por paso con la pregunta "¿un operario nuevo sabe que es esto y donde esta?";
      vale tambien para las hojas de otro autor y las de Excel
- [ ] cada nota pasa el test: ¿le cambia algo al que esta al lado de la maquina?
- [ ] lo que falta filmar, en su lista aparte — **no se escribe por analogia**
- [ ] ningun `TBD` en la descripcion (solo en el cajetin), ninguna foto sin mirar, ningun numero sin fuente citada
- [ ] **revision ciega** (22/09/2026): UN `Agent` recibe SOLO el PDF impreso de las hojas (ni el
      spec, ni la transcripcion, ni mi razonamiento) y contesta como operario nuevo: *"¿Que tengo
      que hacer yo en este puesto, paso por paso? ¿Que no se entiende?"*. Si su respuesta no es el
      proceso real, la hoja no se entiende y no se entrega. Los gates verdes no vieron lo que Fak
      vio a ojo (08/09, tres veces el 21/09 — *"no me explicas que debo hacer yo"* —, 22/09). Es un
      paso de proceso, sin gate automatico: por eso esta en esta lista. Un agente al que le paso mis
      supuestos no es independiente (memoria `un_agente_no_es_independiente_si_le_paso_mis_supuestos`)

---

## 7 bis. Los errores que Fak ya marcó en el paquete de planta (07/10/2026)

Salieron de revisar a ojo el paquete de hojas que se iba a imprimir. Los gates de arriba miran una
hoja por vez y no ven nada de esto: varias hojas vienen de otro autor o de Excel. Horas de Buenos
Aires; las citas llevan el tipeo corregido, las palabras son de Fak. Los números de hoja que él cita (48,
55, 173) coinciden con el paquete de 175 páginas de esa mañana
(`exports\IMPRESION_0710_FINAL\3_HOJAS_DE_PROCESO_A4_depurado.pdf`: la 48 es el armado de espuma del inserto de
Pablo, con logo violeta; la 55, la HO-985 OP 21; la 173, la HO-983 OP 40 costura de planas, cortada abajo).

**Si al revisar aparece uno de estos errores, se le dice a Fak en una línea («ojo, la hoja X tiene
tal error») y se corrige antes de la auditoría** (Fak, 15:58: *«así las próximas ya los conocés y me
decís: ojo, acá hay aún un error»*). Se miran sobre el PDF, no sobre el script ni el generador.

| # | Error (como se ve impreso) | Fak (fecha y hora) | Qué se hace |
|---|---|---|---|
| **E1** | **El plan de reacción no es el estándar**: un disparador propio (la 55 era la HO-985 OP 21 con *«SI DETECTA 3 PIEZAS NO CONFORMES CONSECUTIVAS (REBABAS/FLASHES)…»*; el embossing, *«SI LA PRENSA NO ENCIENDE O LA PANTALLA NO RESPONDE»*), una columna de acciones propias a la derecha, o una franja angosta con media hoja en blanco | 13:24: *«el plan de reacción no conforme, como que algunas hojas no están respetando el formato estándar»* · 14:37: *«en la 55 sigue mal el plan de no conforme… habíamos dicho que eso se debía corregir»* · 15:22: *«te lo dije 300 veces, no es el estándar que decidimos… a la derecha queda todo blanco, está mal aprovechado el espacio de estas HO»* | Armado y texto del **canon 4.5** (`bloque_plan()` de `scripts/img/generar_hojas_img.py`). Se compara con una HO de Excel del servidor, nunca con la hoja anterior (LECCIONES 07/10). Vale también para las hojas de otro autor |
| **E2** | **Logo que no es el oficial**: el violeta con MERCOSUL en letra grande (el oficial es azul, con MERCOSUL chico debajo de una línea). Lo traían 18 páginas del paquete: las hojas A3 de Pablo Gamboa y los caminos de grampas | 14:37: *«la hoja 48 tiene mal el logo, ese violeta no es el oficial de Barack, error grave… sí o sí hay que corregirlo»* | El único es `barack_logo.png`, carpeta `INGENIERIA BARACK (NUNCA BORRAR)` de la nube de Ingeniería (constante `LOGO_BARACK` del generador), sobre celda blanca (canon 4.2). Se mira la esquina de TODAS las hojas, también las ajenas |
| **E3** | **La hoja no llena su página**: sale chica con franja blanca, **cortada abajo**, o con la marca *«Página 1»* del Excel | 14:37: tres capturas, una con la HO-971 OP 80 ocupando poco más de la mitad del ancho del papel (la frase que la acompaña está ilegible; se leyó de la captura) y *«en la 54 se ve la página 1 del Excel»* · 14:47: *«en la hoja 173 veo cortada la parte de abajo… hay que corregir eso también»* | Se juzga sobre el PDF: lo IMPRESO llena el papel, nada queda cortado, sin restos de la interfaz de Excel. Se mide lo que no es blanco, no la caja de dibujo (hallazgo técnico del 07/10, no frase de Fak: un elemento invisible lejos de la hoja engañaba la cuenta en 4 hojas del APB) |
| **E4** | **Falta el N° de operación o el N° de HO (arriba a la derecha)**, o el N° no coincide con el flujograma | 12:43: *«hojas sin número»* · 13:24: *«hojas sin número de operación, hojas sin número arriba a la derecha también»* · 14:39: *«fijate si tiene número, etcétera»* · 09:53 pidió la tabla de si *«los números de AMFEs, flujogramas y HO coinciden»* | Toda hoja lleva los dos. El N° de operación sale del flujograma (`no-pfd-no-ho.md`, `node scripts/_verificarNumeracion.mjs`); el de HO, del listado (`python scripts/_hoNumeros.py`, §3 bis). Un decimal (60.1) tiene que poder explicarse: *«¿por qué están en 60.1?… no me lo explicaste»* (14:37; antes, 13:24: *«antes no lo hacíamos, no digo que esté mal, pero me llamó la atención»*). Qué se hace con las de máquina: sin decidir, ver skill `imprimir` |
| **E5** | **Dice TBD, PENDIENTE, FOTOS PENDIENTES o PRELIMINAR** | 10:39, sobre la HO-971 OP 70 (foto *«FOTOS PENDIENTES / TBD»*, paso *«PENDIENTE / TBD - Cargar descripción»*, ciclo *«PENDIENTE / TBD»*): *«esa está mal puesta, encima dice todo TBD, o sea al pedo la vamos a imprimir… revisá eso y otro tipo de errores»* · 14:46: *«debemos eliminar la palabra preliminar de las hojas, fue una orden de Carlos Baptista y debemos respetarla»* | Una hoja esqueleto (sin fotos ni pasos) **no se imprime ni se pasa a planta**: se hace de verdad o queda afuera, y va a la lista de lo que falta. A planta ni el cajetín lleva TBD (sin N° no se imprime, E4); el `TBD` del cajetín es solo para trabajar (§4). CICLO DE CONTROL vacío (canon 1.2), no *«PENDIENTE / TBD»*. Ni «PRELIMINAR» en ningún lado |
| **E6** | **Hoja de otro autor que entra sin revisar** (la costura del APB trasero central de Pablo Gamboa, que él le pasó a Carlos) | 14:39: *«buscala, así actualizamos, por favor, y revisá errores conocidos antes de pasarlas… o sea, fijate si tiene número, etcétera»* | Pasa por E1 a E5 igual que las propias. Lo que se corrija en un archivo ajeno se le muestra a Fak con el ANTES de cada cambio, ya auditado (LECCIONES 06/10) |

Lo que va y lo que no va en el paquete (portada, esquema de palletizado, embalaje WIP, hojas repetidas
por producto, hojas de Pablo) y los pasos para imprimir: skill `imprimir`.

---

## 0. LOS GATES (bloqueantes). Los 0.x se contestan antes de escribir; 1 a 3, al armar y al entregar

### GATE 0.1 — el canon se abre ANTES de escribir el primer paso

**El documento maestro de estas hojas es `docs/CRITERIOS_HOJAS_DE_PROCESO.md`.** Lo escribio
Fak corrigiendo hoja por hoja. No es material de consulta: es lo primero que se lee, y sus
secciones ganan sobre cualquier criterio que yo derive solo.

| Seccion del canon | Lo que zanja |
|---|---|
| **1.1 y 1.2** | Procesos **no** emite hojas de Calidad. El bloque CICLO DE CONTROL va **vacio** hasta que Calidad emita su Plan de Control aprobado para ese part number |
| **1.3** | El punto critico (airbag / Top Roll) lleva alerta visual en la foto, no protocolo de ensayo |
| **2.x** | Fotografia operativa: paso a paso, nada de imagenes sinteticas, pantallas legibles, cero fotos invertidas |
| **3.2** | **La tabla de terminos prohibidos**: el castellano de planta argentino |
| **4.1 a 4.3** | Geometria, paleta y tipografias del formulario |
| **4.4** | **Infinitivo obligatorio**, tono sobrio; `TBD` solo en el cajetin, nunca en la descripcion (Fak 24/09/2026) |
| **4.5** | El plan de reaccion: su texto fijo **y el ARMADO de la hoja** (abajo a la izquierda, el ciclo de control a su derecha). Lo corrigio Fak tres veces el 07/10/2026: ver §7 bis, E1 |
| **6** | El checklist de auditoria pre-entrega |

**Un canon huerfano no gobierna nada** (21/09/2026: 26 de 27 pasos narrando la maquina y una
hoja que decia SETA).

### GATE 0.2 — ¿este paso le dice al operario que HACER?

La pregunta que decide si una hoja sirve: **si el que la lee hace exactamente lo que dice
cada renglon, ¿queda el trabajo hecho?** Si el renglon describe la maquina, la respuesta es no.

| Asi NO (lo que entregue) | Asi SI |
|---|---|
| *"La mesa entra con el molde y el portico queda arriba."* | *"Esperar afuera del cerco hasta que la mesa termine de entrar."* |
| *"Selector AUTOMATICO (自动) / MANUAL (手动)."* | *"Poner el selector en AUTOMATICO (自动)."* |
| *"El campo de arriba dice que se esta alimentando."* | *"Verificar que la alimentacion diga Cuero en rollo antes de arrancar."* |
| *"Seta de emergencia: corta todo en el acto."* | *"Ante cualquier riesgo, golpear el boton de parada de emergencia."* |

Reglas duras, las tres del canon 4.4:

1. **Cada paso arranca con un verbo en infinitivo.** Poner, Verificar, Apretar, Esperar,
   Retirar. Nunca con articulo, nunca con el nombre de una pieza, nunca narrando.
2. **El sujeto del paso es el operario, no la maquina.** Lo que la maquina hace sola solo se
   escribe cuando le cambia algo al operario: que espere, que no se acerque, que mire.
3. **Un rotulo no es un paso.** La foto lleva el numero (`rotular.py`); el renglon de la
   DESCRIPCION nombra el comando y dice que hacer con el.

**Un panel que el operario no toca no lleva hoja.** Fak, 21/09/2026, sobre la lamina de los
manometros: *"el panel de los no se que, ¿para que hace falta eso? al pedo esta"*. Antes de
poner una foto: **¿que hace el operario con esto, hoy, en su turno?** Sin respuesta, se cae.

**Lo que pide la norma, para no discutirlo de nuevo** (barrido de los manuales oficiales,
21/09/2026):

| Requisito | Fuente |
|---|---|
| La clausula se titula **"Trabajo estandarizado — instrucciones para el OPERARIO y ayudas visuales"**, y sus cuatro incisos hablan del que **ejecuta**: se comunican y **son entendidos** por los responsables de su ejecucion · **legibles** · **en idioma entendible** · **accesibles en el puesto** | IATF 16949:2016 §8.5.1.2, pag. 55 |
| La hoja **debe incluir las normas para la seguridad del operario** (ultima frase de la clausula). El EPP sale del **riesgo real del puesto**, no de un set copiado | IATF §8.5.1.2, pag. 55 · Res. SRT 299/2011 punto 10 |
| Las instrucciones dan detalle "for the **operation** of the processes" y llevan los **parametros** (velocidades, tiempos de ciclo, herramental) | AIAG APQP 3ª ed. §3.7, pag. 34 |
| En el puesto van **instrucciones Y plan de reaccion**, y las instrucciones se cotejan contra el plan de control, el AMFE y el flujograma | APQP A-9 preg. 42, pag. 66 · APQP cap. 4, pag. 42 |
| *"Hoja de proceso: documento donde se explica **como realizar una operacion** incluyendo secuencias de trabajo, controles a realizar, elementos a utilizar, parametros de proceso"* | I-IN-002 rev.A §4, el SGC de Barack |

**La norma NO fija la forma gramatical** —eso lo fija Barack y es el infinitivo del canon
4.4—, pero si fija el efecto: **entendido por el que lo ejecuta**. Cualquiera que diga que
IATF exige imperativo esta inventando.

**Un paso completo cierra el lazo en un solo renglon: ACCION + CRITERIO + QUE HACER SI NO.**
*"Verificar en la pantalla que la alimentacion diga Cuero en rollo antes de arrancar. Si no
lo dice, no arrancar: avisar al lider."* Sin criterio no se sabe cuando esta bien hecho; sin
la reaccion, el operario queda solo con el problema.

**Y una hoja de "conocer la pantalla" tampoco es una hoja de proceso.** Fak, sobre la lamina
del HMI: *"no se de que me sirve conocer esa pantalla... quiero saber como empezar"*. La
pantalla entra cuando el paso manda **mirarla o tocarla**, y entra dentro de ese paso.

### GATE 0.3 — la operacion se llama como Barack las llama

**`SUSTANTIVO DE ACCION [+ calificador] [+ DE/EN/CON + objeto]`**, en mayusculas, 20 a 40
caracteres, tope real 64. Contado sobre **113 denominaciones reales** (los nodos de los 8
flujogramas, `data.operations[].name` de los 20 AMFE de Supabase live y el campo
DENOMINACION del cajetin de las HO limpias):

- **110 de 113 arrancan con sustantivo de accion.** Las 3 excepciones son infinitivos del
  mismo AMFE.
- **0 de 113 arrancan con articulo. 0 llevan dos puntos con una pregunta atras.**
- El **objeto de la pieza NO va en el titulo**: HO-71 se llama *"EMBALAJE APB DEL CONTENEDOR
  PLASTICO"* en el nombre del archivo, y su denominacion dice **`EMBALAJE`** a secas. La
  pieza vive en el campo COD. DE PIEZA del cajetin.
- **Parte 2 de una operacion**: guion largo + calificador (`LAMINADO - CONTROL DURANTE LA
  MARCHA`), mismo sustantivo + calificador (`TAPIZADO AUTOMATICO`), o decimal (`20.1`).

**Antes de inventar una forma se abre la maquina hermana** (Fak: *"eso es cualquier cosa"*).
En el spec, `etapa=` es el **banner que agrupa** y SI va en infinitivo (`PREPARAR Y ARRANCAR`);
`denominacion` es el cajetin y va con sustantivo de accion.

Lo frena `redaccion.revisar_denominacion()` contra la **lista canonica de primeras palabras
reales** (`vocabulario.data.json` → `denominacion.primera_palabra`), no contra un sufijo. Una
palabra nueva da **aviso**, no rojo, para agregarla mirando un documento real.

### GATE 0.4 — la lista de hojas sale del TRABAJO, no de lo que hay filmado

**Antes de decidir cuantas hojas son, se escribe la jornada del operario de punta a punta**,
y recien despues se busca con que fotos se cuenta cada parte. Al reves —mirar el material y
armar hojas con lo que se puede mostrar— **lo que no esta filmado deja de existir** (21/09/2026:
faltaba el vinilo entero con todos los gates en verde, porque cada gate mira una hoja por vez).

Lo que si se puede chequear a nivel DECK es el **balance de materiales**:

> **Todo lo que ENTRA y todo lo que SALE de la operacion tiene que estar nombrado en alguna
> hoja.** La lista no sale de los videos: sale del **flujograma y del AMFE**, que existen
> antes que las hojas.

Lo frena `gate_materiales_del_deck()`, que corre sobre el deck entero antes de compilar y nombra
lo que falta con la fuente de por que existe. No prueba que las hojas esten completas: prueba
que no falta un bloque entero.

**Las tres preguntas del arranque, en este orden:**

1. ¿Que hace esta persona desde que llega hasta que se va? (la jornada, escrita antes que nada)
2. ¿Que entra y que sale de la operacion? (del flujograma y del AMFE, no de los videos)
3. ¿Con que material cuento para mostrar cada parte? — y lo que falta filmar **va a la lista
   de lo que falta**, no se borra del alcance.

### GATE 0.5 — el castellano de planta

Antes de escribir, el vocabulario: **`vocabulario.data.json`** (la tabla 3.2 del canon, en
forma de dato) y el gate **`redaccion.py`**, que lee los dos y frena la hoja.

- `seta` → **boton de parada de emergencia** · `izaje` → maniobra con el puente grua ·
  `chumacera` → soporte del desbobinador · `contenedor de rechazo` → cajon de scrap ·
  `par de apriete` → torque · `mandril` → eje neumatico expansible.
- **Termino nuevo se agrega con su FUENTE**, nunca de memoria: una palabra prohibida que Fak
  si usa es tan mala como una inventada que no usa nadie (el 12/09 un gate de estilo salio
  invertido y marcaba en rojo los mails de Fak).

```bash
py -3 .claude/skills/hojas-de-proceso/scripts/redaccion.py texto "La mesa entra con el molde"
py -3 .claude/skills/hojas-de-proceso/scripts/redaccion.py spec <generador.py> HOJAS_X
py -3 .claude/skills/hojas-de-proceso/scripts/redaccion_selftest.py   # tiene que dar "0 fallan"
```

### GATE 0.6 — ¿cuantos pasos tiene esta hoja, y entran?

**Un paso es UNA accion que alguien hace y que se ve en UNA foto.** Lo que no se puede
fotografiar no es un paso: una condicion va en la NOTA, un valor va en PARAMETROS.

- **De 2 a 4 pasos por hoja, con una foto cada uno.** Cuatro es el tope: en A4 con mas de
  cuatro fotos no se ve ninguna. Menos de dos no es una hoja, es una foto con epigrafe.
  La excepcion es `modo="rotulada"` (un panel, una pantalla): ahi la foto es una sola y
  entran hasta **6** items, porque partir el panel en dos hojas se ve peor que mostrarlo
  entero una vez.
- **La operacion que no entra se PARTE, no se comprime**: `SET UP INICIAL (HOJA 1 DE 2)`,
  `(HOJA 2 DE 2)`. **El N° de operacion no cambia** — lo manda el flujograma
  (`no-pfd-no-ho.md`). Sale solo del campo `hoja_de=(1, 2)`.
- Si al partir queda un paso suelto, se reparte: **3+2 antes que 4+1**.

Fak, 21/09/2026: *"en el flujograma lo que nos paso es que en algunos casos pusimos muy
pocos pasos, a veces muchisimos, esta medio confuso"*. Lo frena `_gate_una_foto_por_paso()`
de `scripts/img/generar_hojas_img.py`.

**La hoja es operativa, no un manual** (Fak, mismo dia): *"con las fotos se entienda
rapidamente de que va el paso, y solo haga falta leer para entender mas a fondo"*. La foto
cuenta el paso; el renglon lo precisa; los parametros van en la hoja, no aparte.

### GATE 0.7 — la transcripcion del video se lee ENTERA, siempre

Fak, 21/09/2026: *"siempre leer las transcripciones si o si, ¿entendiste?"*. Y antes:
*"si no sabes algo no lo asumas vos, lees las transcripciones de audio para entender lo que
pasa en vez de inventar"*.

**Los fotogramas dicen QUE HAY. La transcripcion dice QUE PASA.** Un paso es lo segundo.

- **Cada paso declara su `fuentes`**: un video con su minuto, un documento, o quien lo dijo
  y cuando. Sin fuente, el paso no va. Lo frena `_gate_cada_paso_con_fuente()`.
- **Si la fuente es un video, tiene que existir su transcripcion.** Lo frena
  `_gate_transcripcion_leida()`; sacarla es una linea:
  `py -3 scripts/video/_infoDeVideos.py audio "<carpeta>" --solo 0869`.
- **Del audio de planta sirve lo que narra Facundo**, no lo que sale del traductor: es chino
  traducido por celular y el transcriptor inventa. Un numero sale de la PANTALLA.
- Y una charla con el tecnico **no es un procedimiento**: sirve para saber que preguntar.
  Si lo unico que hay es esa charla, la hoja dice QUE ES CADA COSA y lo que ninguna fuente
  dice se escribe generico o no se escribe: sin TBD en la descripcion (Fak, 24/09/2026, §4).

### GATE 0.8 — las tres preguntas que Fak hizo con la hoja en la mano (02/10/2026)

Salieron de la hoja del hot melt, que habia pasado todos los controles, dos revisiones y una
auditoria. Las tres se contestan ANTES de numerar las hojas y cada una tiene su control.

**a) ¿Esto se hace TODOS LOS DIAS, o es una excepcion?** El juego de produccion cuenta el trabajo
normal; lo que pasa una vez cada tanto va a la hoja de la maquina, con un cartel que diga cuando.
El hot melt salio con el enhebrado completo (dos hojas) en fila con el trabajo diario, porque
estaba filmado en la puesta en marcha, con la maquina vacia. Fak: *"lo unico que hay que hacer es
un empalme con el rollo viejo y listo... lo complejizaste al pedo"*. **Lo filmado en la instalacion
no es la jornada.** Cada hoja de produccion declara `cuando=` y una excepcion no entra:
`gate_lo_normal_en_produccion()`.

**b) ¿La foto MUESTRA la pieza que el paso nombra?** *"Girar el volante cromado... ¿que es el
volante cromado? es como que te diga gira esta nave espacial, ¿cual es? pone una foto del
volante"*. El paso llevaba la foto del tubo vacio, y en la otra foto dos manos tapaban el volante.
Una pieza o un aparato que un operario nuevo no conoce por el nombre va **en la foto y marcado**
(recuadro o numero); el pie lo nombra. Un paso que nombra una pieza y va sin foto lo declara con
`sin_foto="por que"`, y eso va a lo que falta filmar: `gate_pieza_nombrada_se_ve()`.

**b bis) Una palabra rara lleva su aclaración entre paréntesis Y su recuadro con el nombre en la foto** (Fak,
13/10/2026, leyendo la 20.6 del hot melt: *"Verificar que los acumuladores... cuando encontramos una palabra así
extraña, ¿no vale la pena entre paréntesis aclarar qué carajo es eso? porque no entiendo; y si podés marcar con un
rectángulo o círculo en la foto y poner 'acumuladores', mejor aún... es increíble que sigamos fallando en esto"*).
El pie de foto solo no alcanza: la primera vez que la hoja nombra una pieza que un operario nuevo no conoce
(acumulador, guiador, desbobinador, fusor, enrollador, expulsores, atemperador...) el paso dice qué es en palabras
simples, con su fuente (*"los acumuladores (los rodillos por donde el material sube y baja)"*), y la foto la lleva
marcada con recuadro y nombre. Medido ese día en las hojas del hot melt: 39 de 44 piezas nombradas estaban sin
marcar, y el control no veía los plurales (`acumuladores`). **Lo mismo para las HERRAMIENTAS del puesto** (Fak,
13/10/2026, hoja de tapizado del Top Roll, paso *"Verificar el herramental: engrampadora neumática con grampas,
pistola de calor, tijera, pinza y cutter"* con una foto de la mesa y el pie *"Herramental del puesto"*: *"no se
entiende bien cuáles son las herramientas, deberíamos nombrarlas y mostrarlas mejor... lo vamos a tener que incluir
como criterio general"*): cada herramienta que el paso nombra va señalada en la foto con su nombre y su flecha; una
foto de la mesa con todo junto y un pie genérico no alcanza. Vale en todas las hojas.
**La forma que pidió Fak ese mismo día** (*"pongamos las herramientas con fondo blanco, más lindo... así queda feo"*,
sobre los carteles con flecha encima de la foto de la mesa): una **tira de herramientas**, una baldosa por
herramienta, la herramienta ENTERA sobre fondo blanco y su nombre abajo en letra grande. Sale de una foto real de
cada herramienta (sobre una hoja o una mesa blanca); nada generado ni dibujado. Probado el 13/10 recortando de la
foto de la mesa: sirve solo si la herramienta se ve entera (el cutter salió bien; la pistola de calor y la
engrampadora, cortadas por el borde de la foto, no). Si no hay foto de la herramienta entera, se pide; mientras
tanto va el cartel con flecha sobre la foto, y lo que no se ve (la pinza) no se marca. Lo que no se puede explicar con una fuente va a la
lista de lo que falta preguntar, no se inventa.

**c) ¿Yo entiendo lo que estoy mandando hacer?** *"Pegar una cinta adhesiva como indicador para el
cambio de rollo: no se entiende ni la foto ni el texto"*. El paso salia de un audio traducido que
yo tampoco entendia (no se ve la cinta, ni donde se pega, ni quien, ni cuando). **Lo que no puedo
explicar con mis palabras no se escribe como paso**: va a la lista de lo que falta preguntar. Vale
igual para un paso traducido del manual (*"soltar la punta del material"*) y para un "verificar"
que no dice contra que. Esto no tiene control automatico: lo caza una **lectura a ciegas** (un
agente con SOLO el PDF, haciendo de operario nuevo, que dice paso por paso que haria y marca
"no entiendo"). Se corre antes de mostrarle la hoja a Fak, no despues.

Los tres controles viven en `scripts/hotmelt/generar_hojas_v3.py` (prueba:
`scripts/hotmelt/gates_v3_selftest.py`), junto con `gate_foto_no_es_de_falla()` (una foto de un
video titulado "MODO DE FALLA" no ilustra un paso como si fuera lo correcto). Un generador nuevo
los importa de ahi.

### GATE 1 — antes de acomodar: ¿cual es la imagen PRINCIPAL de esta hoja?

Se contesta **por hoja y por escrito**, antes de tocar el layout: *la imagen que el paso
manda mirar o leer*. No la mas linda, no la que quedo mejor encuadrada.

Sin esta respuesta el reparto vuelve a ser geometrico, y el resultado ya se conoce: en 11 de
las 17 hojas de la HOTMELT las tres imagenes salieron **exactamente del mismo tamaño**.

En el spec de la maquina va como `principal=<indice>` y `leer=[<indices>]`.

### GATE 2 — antes de dibujar una pantalla: ¿a cuantos cm va a salir impresa?

```bash
py -3 -c "import sys; sys.path.insert(0, '.claude/skills/hojas-de-proceso/scripts'); import hojalib; print(hojalib.ancho_que_le_toca_cm(1600, 900, 2))"   # ancho_px, alto_px, n_imagenes -> cm
```

Lo contraintuitivo: **la imagen se acomoda por su ALTURA dentro del bloque**, asi que una
pantalla mas alta termina mas ANGOSTA impresa. Agrandar el dibujo la achica en el papel.

Del ancho salen los pixeles: `ancho_px <= cuerpo_px x ancho_cm / (7 x 0,0352778)`.
Si los campos no entran, **no se achica la letra: se sacan campos** — los que el paso no nombra.

### GATE 3 — antes de entregar: el chequeo, en verde

```bash
py -3 .claude/skills/hojas-de-proceso/scripts/hoja_proceso_check.py "<deck.pptx>" --spec <spec.py>
```

Sale con codigo 1 y no se entrega. `--jerarquia 20.2=0,20.4=0` sirve para chequear sin spec.

**Ese gate mira UNA hoja por vez.** Antes de mostrar o imprimir un **paquete** (varias hojas, de varios
autores, algunas salidas de Excel) se busca ademas lo de §7 bis y se corre
`python scripts/_revisarPaqueteHO.py <pdf>` (pasos en el skill `imprimir`). El 07/10/2026 Fak
encontro a ojo, en el paquete de planta, hojas con el logo viejo, con otro plan de reaccion y cortadas abajo.

---

Ver: `.claude/rules/no-pfd-no-ho.md` (cuando se hace una HO y quien numera) ·
`.claude/rules/git-deploy.md` (antes de decir listo) · `.claude/rules/core-prohibiciones.md` (§1, no
inventar) · skill `editar-video` (sacar material de video) · skill `leer-planos` (recortar
para que se lea) · memorias `pantalla_se_redibuja_no_se_mejora_con_ia`,
`dos_lecturas_del_mismo_dia_no_son_comparables`, `entregables_para_fak`.
