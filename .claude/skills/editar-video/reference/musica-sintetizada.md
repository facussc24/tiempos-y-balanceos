# Sintetizar la musica de un institucional

**El camino vivo es el montaje del tema que elige Fak** (`../SKILL.md` §6.2). Esto es la salida
para cuando no se puede depender de la licencia de nadie: `scripts/video/musica.py`.

Lo que se aprendio midiendo aca es **el criterio con el que se juzga cualquier musica, propia o
ajena**, asi que sirve igual cuando el tema lo trae Fak. El nivel de entrega (-20 LUFS) vive en
`../SKILL.md` porque vale para las dos ramas.

### 6.1 Si la musica se sintetiza, el objetivo se MIDE de una referencia real

> **Primero mirar §6.2.** Desde el 11/09/2026 el camino vivo es montar el tema que elige
> Fak. Esta seccion vale igual: **lo que se aprendio midiendo sigue siendo el criterio con
> el que se juzga cualquier musica**, propia o ajena, y `musica.py` sigue siendo la salida
> cuando no se puede depender de la licencia de nadie.

En el disco no hay musica de libreria. Si hay que generarla, se hace con numpy + scipy
(`scripts/video/musica.py`): se rinde a la duracion exacta del armado y se regenera en ~70 s
si a Fak no le pega.

Costo **cuatro vueltas** con Fak en un mismo dia. Las cuatro criticas fueron distintas y las
cuatro tenian razon; en las cuatro habia un numero que la capturaba y que yo no habia mirado:

| Vuelta | Lo que dijo Fak | El defecto medible |
|---|---|---|
| v1, 88 BPM | *"ese sonido me hace dormir"* | mediana espectral 329 Hz · 79 pulsos/min |
| v2, 112 BPM | *"la cancion es una mierda"* | **el nivel se movia 3 dB de punta a punta**: no tenia arco |
| v3, 101 BPM | *"tiene el volumen al maximo... despertar a toda su familia"* | **-15,5 LUFS** y el **49% de la energia entre 400 y 3.000 Hz**, la banda donde el oido es mas sensible |
| v4, 101 BPM | — | — |

#### 🔴 El metodo: el objetivo sale de medir una referencia real, no de mi criterio

**Esta es la leccion que vale mas que todas las recetas de abajo.** En la v3 yo habia subido
el gancho una octava *a proposito* para llevar la mediana espectral de 329 a 495 Hz, con un
argumento que sonaba razonable ("el gancho tiene que leerse en el parlante de una notebook").
Cuando por fin baje las referencias y las medi, resulto que **las corporativas de verdad
tienen la mediana en 54-135 Hz**: habia corregido en la direccion contraria, y con conviccion.
El numero objetivo lo habia elegido yo.

Fak lo dijo en una linea: *"busca ejemplos reales de YouTube, de Volkswagen, de Ford"*, y
despues nombro un canal concreto. **Se baja y se mide.**

```bash
python -m yt_dlp "ytsearch4:<marca> factory corporate film" --flat-playlist \
    --print "%(duration)s|%(channel)s|%(title)s|%(id)s"
python -m yt_dlp -f bestaudio -x --audio-format wav -o "REF_%(id)s.%(ext)s" "<url>"
```

- **yt-dlp se actualiza ANTES de usarlo** (`pip install -U yt-dlp`): con la version de hace
  un mes todas las descargas dieron **HTTP 403** y parecia un bloqueo.
- **Elegir por canal oficial y por duracion** (60-300 s). Un documental de 45 min no es
  comparable.
- **Separar las que tienen locucion.** Se ve en la medicion, no en el titulo: con voz encima
  la mediana espectral salta a 460-730 Hz porque la voz ocupa el medio. Para comparar balance
  espectral sirven solo las de musica sola.
- Lo que YouTube devuelve es el **master que subio el productor**, no la version normalizada
  del reproductor: el balance espectral es exacto, el nivel absoluto no (YouTube baja a -14).

Lo que midieron las referencias de musica sola (5 temas de *Morning Light Music* + los
institucionales oficiales de TRUMPF, VW Group y Siemens), contra las dos versiones mias:

| | referencias | v3 (rechazada) | v4 (entregada) |
|---|---|---|---|
| energia < 120 Hz | 44 – 76 % | 14 % | **63 %** |
| 120 – 400 Hz | 13 – 39 % | 32 % | 14 % |
| 400 – 1.200 Hz | 6 – 19 % | 49 % (400-3k) | 18 % |
| 1.200 – 3.000 Hz | 1,9 – 13 % | — | 3,1 % |
| 3.000 – 8.000 Hz | 0,25 – 2,3 % | 4,7 % | 1,3 % |
| mediana espectral | 54 – 135 Hz | 479 Hz | **108 Hz** |
| LRA | 4,9 – 9,8 LU | 6,9 | 7,9 |
| tempo | 60 – 129 BPM | 101 | 101 |

**Una cama corporativa se apoya ABAJO y deja el medio casi vacio.** Ese es el hallazgo: el
oido es mas sensible entre 400 Hz y 5 kHz, asi que una mezcla con la energia ahi se percibe
"a fondo" aunque el LUFS sea normal. Si hay que empezar de cero, el orden de importancia es
**balance espectral > nivel > arreglo > tempo** — el tempo no fue el problema en ninguna de
las cuatro vueltas.

#### Que hace que suene TRANQUILA (y no es el tempo)

1. **Lo que sube la energia percibida es cuan marcado esta el pulso, no la velocidad.** La v3
   tenia bombo en cada negra, golpe de prensa en el 2 y el 4, y charles en semicorcheas: eso
   es lo agitado. En la v4 no hay bateria — queda un **latido** de seno a 58 Hz en el 1 y el
   3, pasa-bajos a 110 Hz, **sin click y sin saturar**.
2. **Ataque largo = suave.** El tiempo de ataque es una de las dimensiones del timbre: corto
   se lee percusivo/agresivo. Mallet 2 ms → **8 ms**, caida 0,18 s → **0,55 s**, y afuera los
   3 ms de ruido de mazo. Con la caida larga las notas se pisan y queda **ligado**.
3. **La mitad de notas.** El gancho pasa de semicorcheas a **corcheas**. Y los acentos por
   posicion metrica bajan de 3-6 dB a **2 dB**: acentuar fuerte los tiempos es marcar el pulso.
4. **Arco de 4-5 dB, no de 10.** Con el techo de short-term en objetivo +5 LU, 10 dB de arco
   no entran en una pieza de 60 s.
5. **Sin sidechain.** Sin bombo no hay que duckear nada, y el bombeo del sidechain es una
   firma de pista energica.
6. **Sin saturacion de bus.** El `tanh` agrega armonicos, y los armonicos caen justo en la
   banda que hay que vaciar. Compresion de bus a **1,5 dB** de reduccion como tope, no 3.
7. **El grave lo llevan un SUB y un bajo, separados.** El sub es un seno puro **en la misma
   octava que la fundamental del bajo** (65-110 Hz), sostenido todo el compas. Una octava mas
   abajo (33-55 Hz) se come el **97% de la energia**, deja la mediana en 49 Hz y encima el
   parlante de un celular no reproduce esa banda.

#### Lo que hace que suene a stock (sigue valiendo)

1. **Sin ARCO no hay tema.** Arranca abajo, suma un elemento cada 2-4 compases y llega al pico
   entre el **70 y el 80% del metraje**. Los escalones van en COMPASES (`ARCO_DB`), no en
   segundos, asi sobreviven un cambio de corte.
2. **El gancho es un MALLET, no una sierra.** Marimba: los parciales de una barra real se
   afinan a la relacion **1 : 4 : 10**. Para una cama tranquila las amplitudes van 1,0 /
   **0,20** / **0,07** (para una energica, 0,42 / 0,16).
3. **El registro se decide midiendo, no razonando** — ver arriba. Lo que SI vale: si la mezcla
   queda con **menos de 1,9% entre 1,2 y 3 kHz** suena tapada en un parlante chico. La
   solucion no es mover la fundamental: es **doblar el gancho una octava arriba 10 dB abajo**.
   Asi la mediana se queda donde estaba y aparece la banda que faltaba.
4. **Dos notas nunca pueden salir bit-identicas** (efecto ametralladora): **fase inicial
   aleatoria por nota**, detune ±1,5 cents, decaimiento ±5%, semilla de ruido distinta. Es lo
   que mas rinde por linea de codigo.
5. **Jitter de tiempo proporcional a lo filoso del ataque**: percusion sigma 2-4 ms, bajo 4-6,
   melodia 8-12, pad 15-25. Un hat con 15 ms suena borracho; un pad con 15 ms suena vivo.
6. **La saturacion se SOBREMUESTREA x4.** `tanh` sin sobremuestrear genera armonicos arriba de
   Nyquist que se pliegan como aliasing, y el aliasing *es* el sonido barato.
7. **Nada de `np.convolve(..., mode="same")` para filtrar.** Centra la salida, o sea que corre
   la señal HACIA ATRAS media longitud del kernel — con cutoffs distintos por instrumento cada
   uno se corre distinto (hasta 21 ms) y la mezcla se embarra sin que se vea por que. Van
   filtros causales (`scipy.signal.sosfilt` con `butter`). Y ese mismo `convolve` con kernels
   largos es convolucion directa: un suavizado de 12.000 taps sobre 2,9 M de muestras llevo un
   render de 1m15 a **7 minutos**.
8. **Una suma de senos NO TIENE AIRE, y ningun filtro se lo puede dar.** El defecto mas
   dificil de ver de toda la tanda, y lo caza una sola medida: **cuanto cae la banda de
   12,5-15 kHz respecto de la de 8-10 kHz**. En las 8 referencias de musica sola ese escalon
   va de **1,1 a 7,5 dB**; la v4 daba **31 dB** — arriba de 11 kHz no habia nada. El motivo es
   estructural: el parcial mas alto del mallet es 9,8x la fundamental (7,7 kHz) y el pad suma
   armonicos de notas de 165-392 Hz. **Subir los pasa-bajos no sirve (un filtro saca, no
   inventa) y la reverb tampoco (convolucionar multiplica espectros)**. Lo que lo arregla es
   una capa de **ruido pasa-altos en 6,5 kHz con techo en 15 kHz, modulada por la envolvente
   de la cama ya editada** — asi respira con la musica, sigue el arco, se oscurece en la
   camara lenta y se apaga sola en el hueco del gesto, sin una linea extra. Escalon
   resultante: **3,8 dB**. Ojo tambien con la **guarda de Nyquist** en los parciales: arriba
   de 24 kHz se pliegan y ESO es el sonido digital barato.
9. **El video NO arranca mudo, y el arranque tampoco se queda atras.** Hasta la v3 la placa
   del logo se comia 2,7 s de silencio absoluto (-120 dB) porque la grilla empezaba en el
   primer corte: se lee como archivo roto, el que lo abre revisa el volumen en vez de mirar.
   Pero no alcanza con que suene: **la ventana de 4 a 8 s tiene que estar a menos de ~8 dB
   del maximo short-term**, medido en las 8 referencias (van de **2,2 a 8,6 dB**, mediana 6).
   Si esta 12 dB abajo el modo de falla es peor que el silencio: el destinatario sube el
   volumen y despues le llega el cuerpo. **Y el escalon no se arregla con ganancia: se
   arregla haciendo entrar los elementos antes** — en las referencias la ventana de 4-8 s y
   la de 8-12 s son planas entre si, el arco lo hace el climax, no el arranque.

#### El tempo sale del CORTE, no de un BPM lindo

Ningun tempo constante cae en 16 cortes elegidos por imagen — se probaron 580 BPM distintos y
el error medio no bajaba de 0,22 tiempos. Lo que SI se puede es clavar los estructurales: se
toma el compas que hace caer **el momento clave exactamente en una linea de compas**
(`COMPASES_AL_GESTO`), y el resto cae donde cae. Aca dio 101 BPM y con eso el gesto quedo en
el compas 19, la vuelta en el 21 y la placa final en el 23, mas cuatro cortes a menos de 60 ms
de un tiempo. **La banda medida en institucionales reales es 60-129 BPM**, mucho mas ancha que
la que yo daba por buena (100-112): el tempo casi nunca es el problema, y cambiarlo tira abajo
toda la sincronizacion.

**Y NINGUN GOLPE VA ADELANTADO.** ITU-R BT.1359-1: el oido detecta el audio adelantado a
partir de **+45 ms** y el atrasado recien a **-125 ms** — casi tres veces mas tolerancia para
llegar tarde. Por eso la grilla entera va corrida **un cuadro (40 ms) DESPUES** del corte. Ojo
con el ATAQUE del sonido que cae ahi: con 90 ms de ataque el pico terminaba 130 ms despues del
cuadro, o sea afuera de la ventana; con 60 ms queda en 100.

**Pocos acentos, no todos.** Marcar los 16 cortes es *mickey-mousing* y cansa: se marcan los de
seccion. `armar.py` deja la lista completa en `armado.json` (`cortes[]`), pero elegir es del
que arma.

#### El momento especial (camara lenta, reveal, gesto)

La receta que pidio Fak —*"que la musica tenga un efecto distinto ahi"*— se llama **stopdown**,
y le gusto: *"en la parte de Manuel me gusto eso que hiciste"*. Es esto, en orden:

1. La musica **se corta 0,24 s antes** del cuadro. Ese silencio es lo que le da al golpe donde
   aterrizar. **Corto**: si se estira, la escena se queda sin musica (paso: 1,4 s mudos a
   -40 dB en el medio del plano, y hubo que arreglarlo).
2. **El grave no se corta del todo** — baja a 0,15 y sigue. Si desaparece todo, el hueco se lee
   como un error del archivo en vez de como un efecto.
3. Un **swell invertido** ocupa el hueco: se invierte el material, se le pone la cola y se
   vuelve a invertir, asi TERMINA en el ataque en vez de empezar ahi.
4. Sobre el cuadro cae el golpe. **La version tranquila no lleva impacto**: en vez de las
   5 capas (click / punch / sub / metal inarmonico / cola) va una **floracion** — cuerpo grave
   que crece en 60 ms, dos armonicos, nada arriba de 900 Hz — mas un sub que baja de 80 a
   34 Hz **sin saturar**.
5. **Durante** la camara lenta: se va el latido y la contramelodia, queda el pad filtrado a
   700 Hz, 5 dB abajo, con la cola larga abierta.
6. **Al volver**: otro swell que muere en el cuadro y una segunda floracion. **Nada de riser**:
   es la figura mas "trailer" que hay y no va en una cama tranquila.

Verificado midiendo el MP4 final cada 100 ms: **-21,5 dB antes, -31,5 dB en el hueco,
-19,4 dB cuando florece**, y el pico 100 ms DESPUES del cuadro del corte. La referencia de cuanto tiene
que bajar: **10 dB de hueco y 2 dB por encima del entorno** cuando florece. Con 6 dB de hueco
el efecto no se lee.

#### La percusion puede salir de la propia maquina

Es lo que hacen las marcas que Fak nombro: Skoda mando a Parv Thind (Wave Studios) a grabar la
linea de montaje para el spot del Roomster, Ford armo *"Sounds of Fusion"* con portazos y
chicharras del propio auto, y Diego Stocco hizo *"Music From A Dry Cleaner"* con la prensa de
una tintoreria. **Es lo unico que ninguna libreria de stock puede dar.**

Como se sacan (`scripts/video/golpes_prensa.wav`): buscar transitorios con **salto de 6 dB en
la banda de 2-8 kHz**, que sobresalgan 5 dB del ambiente, que **decaigan 20 dB en menos de
350 ms**, y donde la banda alta le gane a la de voz (200-1200 Hz). Despues **mirar el fotograma
de cada candidato**: solo sirven los que tienen en cuadro la maquina sola — con gente cerca del
microfono el golpe es una persona, no la prensa. De 13 candidatos quedaron 5.

**En una cama tranquila van como COLOR, no como tambor**: en tres cortes de seccion, filtrados
abajo de 600 Hz y mandados a la reverb. Se oye la maquina, no se oye una bateria.

#### Mezcla y entrega

- **Pasa-altos de arreglo a todo lo que no lleve el grave.** La acumulacion de graves es el
  error mas citado. En la v4: sub pasa-bajos 140 Hz, bajo 40, pad 150, gancho 200, melodia 230.
- **El bajo se cuida por el DECAIMIENTO, no por el volumen.** Notas de 320 ms sobre corcheas de
  297 ms se solapan: el bajo deja de ser ritmico y se vuelve un colchon de sub. En una cama
  tranquila eso se resuelve al reves — **una nota por compas, legato**, y el sub aparte.
- **El grave va MONO**: `M/S` con pasa-altos del canal Side en 120 Hz. Con una mezcla apoyada
  abajo esto pesa mas que antes: se verifica sumando a mono y comparando RMS por banda de
  octava, y **si alguna pierde mas de 3 dB hay cancelacion de fase**.
- **Dos envios de reverb, no doce convoluciones**: sala 0,8 s (predelay 12 ms) y hall 3,0 s
  (predelay 45 ms), los dos con pasa-altos 220 y pasa-bajos 6 kHz en el retorno.
- **La correccion final de espectro va TOPEADA** (aca, 5 dB). **Si toca el tope, el arreglo
  esta mal y hay que arreglarlo ahi**: en la v4 el estante de 3,5 kHz pidio +5,0 dB (o sea,
  tope) y aun asi la banda quedaba en 0,03% — la respuesta no era subir el tope, era que al
  arreglo le faltaba un elemento en ese registro.
- **El nivel de entrega se MIDE, nunca se hereda el numero de la vez pasada.** El mismo
  `volume=-2.2dB` que dejaba una cama en -15,4 dejo la siguiente en **-19,5**: a igual pico,
  una mezcla con bateria mide mucho menos que una de pad largo. `master.py` mide con
  `ebur128=peak=true` y calcula la ganancia sola.
