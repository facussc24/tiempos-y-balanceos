---
name: plotter-aol
description: "Plotter de corte AOL («el plotter de corte», «el de cuchilla», «el succionador», software «Xiao»): la mesa negra con vacio y cuchilla oscilante junto a las mesas de corte, donde se cortan los Insert — prender, origen, cuchilla y profundidad, DXF en Xiao, herramientas SP, agujeros chicos, acomodar piezas en columnas, mantenimiento y que hacer si corta mal. Usar cuando Fak hable de ese plotter, de cortar Insert u otras piezas finas ahi, o pregunte como se usa o por que corta mal. El DXF lo prepara `patrones-corte-plotter`; el HTV2A es otro plotter."
---

# Plotter AOL — de prender la maquina a sacar las piezas

**Que maquina es (confirmada por Fak el 15/10/2026 con la foto del manual):** el **AOL Digital
Cutter** de *Jinan AOL CNC Equipment Co., Ltd.* (China, marca 奥镭). Mesa plana negra con **fieltro
y aspiracion por vacio** (la bomba chupa el material contra la mesa), un puente con el cabezal de
herramientas (cuchilla oscilante, lapicera, laser rojo para posicionar), **panel tactil** al costado
y una PC con el software **Xiao**. Esta **junto a las mesas de corte** y con ella se cortan los Insert
y otras piezas finas (vinilo, tela, espuma fina, fieltro, carton).

**Cual NO es** (Fak, 14/10: *"es grave que no sepas a que plotter me refiero"*):
- El **HTV2A** (`2- SOFTWARE\INKJET PLOTTER\`): otro plotter de cuchilla de arrastre, con PLT; su
  detalle esta en la memoria `reference_plotter_inkjet_software_htv2a` y en `patrones-corte-plotter` §4.
- La **mesa de corte** (tizadas, Mesa de Corte de Pablo Gamboa) y la **maquina de corte YIN**
  (`2- SOFTWARE\MAQUINA DE CORTE YIN\`, sacabocados): son otras maquinas.
- Si Fak dice "el plotter" para cortar Insert o vinilo, es este (memoria `reference_plotter_aol_corte_insert`).

**Fuentes y como se marcan.** `[M p.N]` = *Manual of the AOL Digital Cutter (20241023)*, 48 pag.;
`[X p.N]` = *AOL Digital Cutter Control Software-Xiao Manual (20211209)*, 30 pag. Los dos, originales,
en `INGENIERIA BARACK (NUNCA BORRAR)\4- MANUALES\PLOTTER AOL\` (no se tocan; regla
`documentacion-oficial.md`). `[web]` = internet, con su URL en §12. `[planta]` = visto en la maquina
de Barack. **Todo lo que dice `[M]` o `[X]` es del manual generico del fabricante: los numeros de
ESTA maquina (area, IP, herramientas montadas) se miden en el panel, §11.**

---

## 0. Lo que rompe la maquina o el corte (leer antes de tocar nada)

1. **La bajada rapida de cuchilla** (flecha roja ↓ de la pagina *adjust*) baja la cuchilla de una
   vez a la profundidad guardada. **Si se cambio la cuchilla por una mas larga o la profundidad esta
   mal, atraviesa el fieltro y la mesa y rompe la cuchilla** [M p.23, p.32]. Despues de cambiar una
   cuchilla, bajar de a poco (paso 1 o 0,1 mm), nunca con la bajada rapida.
   **Ya paso en Barack** [mail 27/01/2026]: *"al cortar un material con una profundidad incorrecta,
   la herramienta perforo y corto la base de la cinta transportadora"*; en esa zona se perdio la
   succion y el material dejo de quedar firme. Fak pidio a Carlos usarla igual sin mover mas la
   cinta, y el reporte con fotos fue a Mantenimiento (`6- ARCHIVO DE CORREO\ADJUNTOS\INGENIERIA Y
   PROYECTOS\2026\Reporte de dano en cinta transportadora Plotter.pdf`). Que ese mail sea de esta
   maquina se deduce porque Fak le dice "plotter de corte" y la foto muestra mesa con cinta y vacio:
   **a confirmar**, §11.
2. **Las paradas de emergencia (una en cada esquina) PAUSAN el movimiento, no cortan la luz** [M p.4].
3. **Todas las herramientas se sacan del portaherramientas al terminar el dia**: si quedan puestas se
   oxidan y no salen mas [M p.31, p.48].
4. **Ir al origen despues de prender** (*work → origin*): al encender las coordenadas arrancan en 0
   pero el cabezal puede no estar en 0; sin origen corta corrido [M p.21].
5. **En el panel, las paginas de fabrica no se cambian**: *config → machine* tiene los datos de
   fabrica ("all factory settings and data on this page can not be changed") [M p.14, X p.5]. El
   codigo para desbloquear *test* es el de fabrica que figura en el manual [M p.29]; no se cambia.
6. **Un agujero = un solo CIRCLE; un contorno = una polilinea cerrada; agujeros antes que contornos.**
   Lo aprendido cortando los Insert el 13/08/2026 (`patrones-corte-plotter` §3 bis): con polilineas de
   72 lados la cuchilla "bajaba, se quedaba quieta y no hacia el circulo"; con 3 circulos superpuestos
   salio "cortado de a pedazos"; con segmentos sueltos "la cuchilla se levanta muchas veces"; y si el
   contorno se corta antes, la pieza se suelta y "algunos circulos el plotter no los esta haciendo".

---

## 1. Las partes [M p.4-6]

| Parte | Que es |
|---|---|
| Mesa con fieltro | Superficie de corte. El fieltro es de sacrificio: la cuchilla entra 0,5-1 mm en el. Debajo, la mesa de aspiracion |
| Bomba de vacio | Chupa el material contra la mesa. Distinta potencia segun modelo (2,2 kW x4 / 5 / 7,5 / 9 / 12,5 kW) [M p.4] |
| Puente (eje X) y carro (eje Y) | Mueven el cabezal. Ejes: **X** a lo largo de la mesa, **Y** a lo ancho, **Z** sube/baja la herramienta, **W** gira la cuchilla, **A** gira el punzon [M p.22] |
| Head1 / Head2 | Portaherramientas. En maquina de un cabezal, Head1 es el de Y+ [X p.9]. La cuchilla oscilante va en Head1 con SP4 [M p.31] |
| Laser rojo | Marca el punto que se toma como cero (*set zero*) [M p.21] |
| Panel tactil | Paginas *work / adjust / speed / config / test* (§3) |
| Interruptor de encendido | Se **gira en sentido horario para prender** y se **aprieta para apagar** [M p.5] |
| Paradas de emergencia | 4, una por esquina; pausan, no cortan la luz [M p.4] |
| Interruptor de seguridad | Si esta activo (*have safe*), la maquina pausa si se lo toca durante el corte [M p.27] |
| Compresor (solo si hay cuchilla neumatica) | 0,6 MPa normal; 0,8 MPa con cuchilla oscilante neumatica; purgar agua cada 1 a 7 dias [M p.11, p.48] |
| Pinza (*clamp*) y arrastre (*drag*) | Solo en maquinas con alimentacion automatica de rollo [M p.5, p.22] |

Electrica: maquina 220 V monofasica, 2,5-3 kW; con la bomba el total es de al menos 14 kW, cable de
8 mm² y termica de 63 A [M p.3-6]. No se abren los tableros sin un electricista [M p.3].

---

## 2. El corte de punta a punta (checklist)

**A. Antes de prender (todos los dias)** [M p.48]: limpiar el fieltro con aire (sin restos ni
bultos), mirar que la cadena portacables no tenga nada, limpiar el cabezal, revisar tornillos del
cabezal y las herramientas, con compresor purgar agua.

**B. Prender**
1. Girar el interruptor en sentido horario [M p.5]. El panel arranca en el **protector de pantalla**:
   se despierta tocando la **esquina de arriba a la izquierda** (no tiene botones a proposito) [M p.19-20].
2. *work → origin*: el cabezal va a los fines de carrera y el panel dice "go origin succeed" [M p.21].
3. En la PC, abrir **Xiao** (icono 聪, `xiao.exe`) [X p.3-4].

**C. Poner la cuchilla oscilante (SP4, Head1)** [M p.31-32]
1. Separar la tapa de la barra (tomar las partes 1 y 2 y tirar hacia los costados).
2. La cuchilla va **hasta el fondo de la ranura**, con el filo del mismo lado que los tornillos.
3. En *work*, el eje **W tiene que estar en 0.00**; si no, tocar el numero de W y vuelve a 0 [M p.31-32].
4. **El filo mirando a X+**; apretar el anillo. Enganchar la ranura negra en la varilla y enchufar el
   cable de la herramienta en el conector izquierdo.

**D. Profundidad de cuchilla** (pagina *adjust*) [M p.23-24, p.32-34]
1. *adjust* → tocar el SP hasta que diga **SP:4** (cut). El numero de *down* es la profundidad guardada.
2. Bajar con ▲/▼ eligiendo el paso con el boton de numero (5 / 1 / 0,1 / 0,03 mm).
3. Dos formas de juzgarla:
   - **Metodo 1**: girar la pieza de la herramienta hasta que la cuchilla quede en lo mas bajo; esta
     bien cuando **la punta entra 0,5-1 mm en el fieltro** [M p.33].
   - **Metodo 2** (con papel): dejar la punta a 5 mm de la mesa (10 mm la neumatica), *adjust2 → cut*
     (la cuchilla vibra), poner una hoja de papel y arrastrarla con la mano: si **el papel se corta
     justo**, esta; si no, bajar de a poco hasta que corte [M p.33].
4. **Guardar con el tilde verde** ✓ (la X roja descarta) [M p.24, p.33].
5. **`up`** = altura a la que sube la cuchilla entre cortes: tiene que ser **mayor que el espesor del
   material** y cumplir *profundidad > up > 10*; con 0 sube hasta el origen de Z [M p.24, p.33].
6. Probar: los botones de prueba cortan un rectangulo. Si no atraviesa, bajar 0,1 mm y probar otra
   vez: el material cortado y el fieltro sano = profundidad bien [M p.34].

**E. Preparar el archivo en Xiao** [X p.5-10]
1. Abrir el DXF o PLT: *file → open* (Ctrl+O), o arrastrarlo a la ventana [X p.6].
2. **El dibujo tiene que quedar pegado a la esquina de abajo a la izquierda**: si no, tecla **C** [X p.8].
   El origen (0,0) de Xiao es abajo a la izquierda, unidades **mm** [X p.5].
3. **Asignar herramientas (SP)**: seleccionar las lineas y apretar el numero (tecla 1-8 o el boton).
   En maquina de un cabezal [X p.8-9]: **SP4 = cuchilla oscilante (cortar)**, SP1 = lapicera,
   SP2 = rueda de marcar / punzon, SP3 = V-cut grande / punzon, SP5 = V-cut chica, SP6/SP8 = fresa,
   SP7 = punto de marca, **SP0 = no se procesa**. La tecla del numero selecciona todo lo de ese SP [X p.20].
   El fabricante aclara que la tabla cambia segun el modelo: **la de ESTA maquina se confirma en planta** (§11).
4. **Optimizar** (boton verde ⬤ u *optimize*) [X p.10]: borra lineas repetidas, puntos muy cercanos y
   nodos intermedios, une tramos cercanos, borra lo aislado. Ojo: **revisar despues el orden**.
5. **Orden de corte**: por defecto, lo que se dibujo primero se corta primero [X p.22]. Para que los
   agujeros salgan antes que el contorno, `patrones-corte-plotter` ya los escribe asi; en Xiao se
   verifica con **simulate → show sequence** (numera el orden) [X p.23] y se cambia en *6.2/6.3* [X p.22-23].
6. Para agujeros y arcos chicos, §5.
7. **Guardar como `.pce`** (*save*): guarda el dibujo con todos sus SP y ajustes para repetirlo sin
   rehacer nada [X p.8].

**F. Poner el material y cortar** [M p.21-22, p.27]
1. Extender el material sobre el fieltro. *vacuum* prende/apaga la bomba: con material que cuesta que
   se pegue, **prender el vacio primero**, esperar que quede firme y despues *repeat* [M p.22].
   Si en *config* esta *auto vacuum*, la bomba arranca sola antes de cortar [M p.27].
2. Llevar el cabezal con las flechas hasta donde arranca el corte (el laser marca) y apretar
   **set zero**: ese punto es el cero del corte [M p.21]. *fast/slow* cambia la velocidad para afinar.
3. Apretar **[ ]** (marco): el cabezal recorre el rectangulo que ocupa el trabajo. **Mirar que entre
   en el material** [M p.21-22].
4. Mandar desde Xiao: boton de **flecha verde ↓**, *send*, o tecla **Z** [X p.10].
5. Segun *config*: con **auto run** corta apenas recibe; con **no auto run** espera: se aprieta dos
   veces *to zero* para ver la posicion y **repeat** para cortar [M p.27]. *repeat* = arrancar [M p.21].
6. **Pausar**: tocar la barra de estado (abajo) o *pause*; *continue* sigue; **cancel** cancela todo
   [M p.21-22].
7. Repetir el mismo trabajo: *test → times* (cantidad) y **continuous** [M p.29].
8. Sacar las piezas. Al terminar el cabezal va a la posicion de *goto* (o se queda donde termino con
   *still*) [M p.29].

**G. Apagar**: sacar **todas** las herramientas del portaherramientas [M p.31], limpiar el cabezal y
la cuchilla (trapo con alcohol), limpiar rieles X/Y y engrasar (1-3 bombeadas de aceitera) [M p.48],
y apretar el interruptor [M p.5].

---

## 3. El panel, pagina por pagina

| Pagina | Que se hace ahi | Fuente |
|---|---|---|
| **work** | Mover el cabezal (flechas; el numero del medio = cuanto se mueve si se mantiene apretado 2-5 s), subir/bajar y girar la herramienta, ir a los bordes, **origin**, **repeat** (arrancar) / pause / continue, **set zero** (laser), **[ ]** marco, **cancel**, **vacuum**, clamp/drag (solo con alimentacion). Muestra X, Y, Z, W, A | [M p.20-22] |
| **adjust** | Profundidad de cada herramienta por SP, `up`, paso de bajada, bajada rapida (peligrosa, §0.1), ✓ guardar / ✗ descartar. **adjust2**: hacer vibrar la cuchilla a mano | [M p.22-24] |
| **speed** | Velocidades: *null* (en vacio), *cut1* (cuchilla), *pen*, *Tcut*, *cut2*, *mill*; columnas speed / acc-dec / curve / small; subida y bajada por herramienta; velocidades de *origin* y *jog*; `vib delay` (espera entre vibrar y cortar), `absorbdelay` (espera entre prender el vacio y arrancar), `corner` (precision en esquinas, ~1,5 para lo exigente), `up angle` (sobre ese angulo la cuchilla sube, gira y baja), **`limit dia`** (circulos menores a ese diametro van mas lentos, §5), arrastre de rollo | [M p.24-26] |
| **config** | auto vacuum / no auto vacuum, auto vibrate / no vibrate (sin vibrar = cuchilla oscilante desenchufada), have safe / no safe, hole / line (punzon), auto run / no auto run, drag / no drag (rollo), cut line / no cut line (se recomienda *no cut line*), extensiones de corte (*down extend* / *up extend*: corta de mas o de menos al bajar y al subir), *machine* (datos de fabrica, no se tocan), board id / code / expire | [M p.26-28] |
| **test** | Desbloqueo con el codigo de fabrica, **seguir despues de un corte de luz** (*save index*, §6), *times* + *continuous*, *goto* / *still*, *save graph* / *load graph*, zonas de vacio (si la maquina las tiene), test de angulo y de offset | [M p.28-30, p.45-47] |

---

## 4. Calibraciones (cuando corta torcido o corrido)

- **Angulo de la cuchilla** [M p.46-47]: con la profundidad ya puesta y un carton sobre la mesa, el
  test de angulo corta una cruz. Si las lineas se inclinan en sentido antihorario, corregir girando en
  sentido horario: elegir el paso (50 / 10 / 1 / 0,1 / 0,03), mover W, y **guardar**. Repetir hasta
  que la cruz salga derecha.
- **Offset laser ↔ cuchilla** [M p.47]: el test de offset corta una cruz y lleva el punto rojo al
  centro. Si no cae en el centro, moverlo con las flechas hasta el centro y guardar. Todos los offsets
  se toman respecto de la cuchilla oscilante (Head1).
- **Corta de mas o de menos en los extremos** (sobrecorte): *config* → *down extend* / *up extend*
  (positivo corta mas; negativo menos). Ej.: linea de 50 mm con 2 y 3 sale de 55 mm [M p.28, p.35].

---

## 5. Agujeros y circulos chicos

**Lo que dice el fabricante** [X p.30]:
- En **Xiao**: *Optimize → config…*, cambiar **`near dist` de 0,3 a 0,05** y optimizar de nuevo.
- En el **panel**: *speed* → **`limit dia` de 10 a 80**: los circulos menores a ese diametro se
  cortan mas lentos (proporcional) [M p.26, X p.30].

**Lo que ya aprendimos en Barack** (`patrones-corte-plotter` §3 bis, cortes de Insert del 13/08/2026):
un agujero es **UN** `CIRCLE` (no polilinea, no circulos superpuestos), se cortan **todos los agujeros
antes que los contornos**, y el contorno va como una polilinea cerrada sin segmentos menores a 0,3 mm.
En planta el agujero del Insert hoy se hace **Ø2 con sacabocado** (memoria
`project_agujero_insert_sacabocado_2mm`): si se vuelve a pedir cortarlo con la cuchilla, se prueba
primero en un retazo con los dos ajustes de arriba.

---

## 6. Situaciones especiales

- **Corte de luz a mitad de trabajo** [M p.29]: solo funciona si antes se activo *config → machine →
  save index* (con la pagina desbloqueada). Al volver: *work → origin*, *test → load graph*, *work →
  repeat* y sigue desde donde quedo.
- **Pieza mas larga que la mesa / alimentacion de rollo** (solo si la maquina tiene arrastre)
  [X p.29-30, M p.25-26]: *config → drag*, el cero en el extremo X−, `rolldist` = largo a avanzar,
  *times* y *continuous*. `roll add` corrige si el avance real no coincide (ej. avanza 990 en vez
  de 1000 → poner 10).
- **Exportar PLT para la maquina**: *Save As plt by machine…* solo anda con la maquina conectada [X p.8].
- **Lapicera / punteadas**: Xiao convierte una linea llena en punteada (*line* y *gap*); una punteada
  dibujada en otro programa la toma como llena [X p.12-13].
- **Copias en grilla**: *array copy* (cantidad en X e Y y separacion) o *arrcopy fill workrect* para
  llenar la mesa [X p.27-28].

---

## 7. Cuando corta mal

| Sintoma | Que mirar primero | Fuente |
|---|---|---|
| No atraviesa el material | Profundidad (bajar 0,1 y probar), cuchilla gastada, *auto vibrate* activo | [M p.27, p.34] |
| Marca o rompe el fieltro | Profundidad de mas; subir 0,1 | [M p.34] |
| El material se mueve | Vacio prendido y firme antes de *repeat*; `absorbdelay`; tapar la zona de mesa libre (§12) | [M p.22, p.25] |
| Cortes corridos respecto del dibujo | Origen hecho al prender; offset laser↔cuchilla (§4) | [M p.21, p.47] |
| Cruz o esquinas torcidas | Test de angulo (§4); `corner` | [M p.26, p.46] |
| Circulos chicos deformes o que no aparecen | §5; orden de corte (agujeros primero); un solo CIRCLE | [X p.30], `patrones-corte-plotter` |
| La cuchilla sube y baja todo el tiempo | Contornos en segmentos sueltos: unirlos en una polilinea cerrada | `patrones-corte-plotter` §3 bis |
| Arranca o termina corto el trazo | *down/up extend* | [M p.28] |
| "Out of XY" en el panel | El dibujo no entra desde el cero puesto; mover el cero o la pieza | [X p.29] |
| Xiao no conecta | IP de la PC en la misma red y distinta de la de la maquina (fabrica: 192.168.0.252); el area y la IP de Xiao iguales a las del panel | [M p.13-14, X p.4] |

---

## 8. Mantenimiento [M p.48]

| Cada | Que |
|---|---|
| **Dia** | Sacar las herramientas al irse · limpiar la pinza de la cuchilla · limpiar la maquina con aire y trapo · cadena portacables libre · X e Y sin ruidos antes de cortar · limpiar rieles X/Y y engrasar · limpiar las herramientas con alcohol · probar cabezal y herramientas antes de arrancar · purgar compresor · presion 0,6 MPa (0,8 con neumatica) · tornillos del cabezal · fieltro limpio con aire |
| **Semana** | Sensores de fin de carrera X/Y firmes y sin polvo · rodamientos · cables firmes · aspirar el tablero |
| **Mes** | Correas (tension y desgaste) · consumibles · probar la termica (boton amarillo) |
| **Cuando haga falta** | Fieltro: reparar lo dañado para que no se despegue en las uniones y corte mal |

---

## 9. Seguridad [M p.3-4]

No poner las manos en la zona de corte con la maquina moviendose; no tocar lo electrificado; no apoyar
nada pesado sobre la mesa o el puente; sobre la mesa, solo el material a cortar; el piso firme y
nivelado, sin sol directo ni humedad.

---

## 10. Desde Claude: que hago yo y que no

- **Yo preparo el archivo** (DXF con `patrones-corte-plotter`: `_mixPlotter.py`, `_validarDxf.py`
  antes de entregar). Lo que Xiao hace (SP, optimizar, mandar) lo hace el operario en la PC de la
  maquina: **en esta PC Xiao no esta instalado** (buscado el 15/10/2026 en Program Files, Escritorio
  y Descargas; lo unico parecido es `CutPlan`, que es otro programa).
- **Como le llega el archivo hoy**: los DXF "para cortar en Plotter" van por mail a **Pablo Gamboa**
  (Mesa de Corte) [mails 13 y 27/05/2026, headrest trasero central]. Los de Insert/APB para plotter
  viven en `...\02 -Computo Tizada de Corte- Consumo de Materiales\NOVAX PLOTTER\`. Que esos mails
  sean de esta maquina y no del HTV2A: a confirmar, §11.
- **Acomodar varias piezas en una hoja** (Fak, 15/10/2026): **en COLUMNAS a lo ancho del material** (eje Y de Xiao),
  la mano derecha en una columna y la izquierda en la otra, sin girar y sin espejar, con **25 mm reales entre piezas**.
  Fak reacomodaba a mano las grillas 2 x 2 y el encastre en diagonal de 1233 x 478 que le arme ese dia: *"lo que hago
  cuando sube el archivo al plotter es tomar los 2 de la derecha y ponerlos, los 4 en una sola columna"*. Una hoja por
  tipo (el delantero y el trasero no entran juntos en el largo): 5 + 5 piezas dan 1380 x 1187 (delantero) y
  1293 x 1285 (trasero). El ancho del material lo dice Fak (el 15/10 penso en 1,8 m, vinilo obsoleto para la prueba);
  el area de esta maquina sigue sin medir (§11). Script: `py -3 .claude/skills/plotter-aol/scripts/acomodar_columnas.py <dxf 4 piezas> DEL|TRA <N> 25 <salida>`.
  **Frena solo** (tanda 12, 17/10/2026): si el origen trae algo que no sea una polilinea (un agujero CIRCLE se perderia en
  silencio: para eso va `_mixPlotter.py`, que los conserva y los pone antes que los contornos), y si el DXF escrito,
  releido, no tiene 2N contornos cerrados o queda con menos de 25 mm reales entre piezas. Probado el 17/10 con el DXF de
  4 piezas del 15/10: verde (1380,4 x 1187,1 y 1293,1 x 1284,6, 25,00 mm); con un agujero agregado al origen, frena.
  Selftest con DXF sinteticos: `py -3 .claude/skills/plotter-aol/scripts/acomodar_columnas_selftest.py` ("0 fallan"; no
  corre en `npm test` porque el CI no instala ezdxf ni shapely).
  Al lado va siempre un PNG **"cual es cual"** con el nombre de cada mano: el DXF no lleva texto.
  **Cuanto material deja la regla** (tanda 13, 17/10/2026): `py -3 .claude/skills/plotter-aol/scripts/medir_regla_columnas.py
  <dxf 4 piezas> DEL|TRA 5 25 [--ancho W] [--png salida.png]` arma la hoja de columnas con el script de arriba y busca otro
  acomodo con las mismas condiciones (sin girar, sin espejar, 25 mm), mas una cota de abajo. Con el DXF del 15/10 y el
  mismo ancho que ocupan las columnas, ningun acomodo que encontro es mas corto (sobra 28,6 % DEL y 32,7 % TRA). Con un
  rollo mas ancho que la columna, cuanto se gana se mide con `--ancho` y el ancho de un papel (OC o planilla de la mesa
  de corte): **el ancho real del rollo es TBD** (para el Insert hay tres en circulacion, 1400, 1200 y 1500 mm, mas los 1150 de las tizadas) y no se pone uno de
  ejemplo. **No es un consumo** (`consumos-entregables.md` §6) y no se le pregunta a Pablo. Selftest:
  `medir_regla_columnas_selftest.py` ("0 fallan"; el DXF real no esta en git: con otra ruta, `BARACK_DXF_INSERT_15_10`).
- Si Fak pregunta como se hace algo de la maquina: contestar con esta skill y su pagina del manual;
  si no esta, **decir que el manual no lo dice** y no inventar un valor (`core-prohibiciones` §1).
- Ningun parametro de fabrica (*config → machine*) se recomienda cambiar.

---

## 11. Lo que falta confirmar en planta (pendiente con Fak, viernes 16/10/2026)

Los manuales son genericos. De **esta** maquina falta medir, en el panel y la PC:
- Modelo exacto (placa) y area de trabajo (*config → machine*: X size / Y size) — el ejemplo del
  manual dice 2500 x 1330, la foto de tapa dice "1625".
- IP de la maquina y donde esta instalado Xiao (que PC).
- Que herramientas tiene montadas y la tabla SP ↔ herramienta real.
- Si tiene alimentacion automatica (clamp/drag) y zonas de vacio. El reporte del 27/01/2026 habla de
  "cinta transportadora" con un rollo al final, lo que sugiere que si (a confirmar que es esta).
- Si la cinta perforada en enero 2026 se reparo.
- Valores actuales de *speed* (cut1, `limit dia`) y de Xiao (`near dist`), y que cuchilla usa.
- Quien la opera y que archivo le llega (DXF directo o `.pce` guardado).
Cuando se mida, va aca con `[planta]` y la fecha, y se saca de esta lista.

---

## 12. Lo que se encontro afuera de los manuales

- Mails y archivo de correo (15/10/2026): no hay compra, factura, numero de serie ni contacto del
  fabricante. Lo que hay esta citado en §0.1 y §10.
- Internet (fabricante, ficha del modelo, videos, cuchillas, problemas comunes): **no se hizo**; la
  busqueda se corto el 15/10/2026 al cerrar la tarea. Si hace falta, es lo proximo para sumar aca.
