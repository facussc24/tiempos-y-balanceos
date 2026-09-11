---
name: editar-video
description: Editar video en Barack — armar un institucional o una recorrida de planta desde tomas crudas, elegir que sirve con criterio medido, mejorar color y nitidez, y entregar un master que abra en cualquier lado. Incluye lo que NO sirve (upscaling con IA, estabilizar material de gimbal), medido en esta maquina.
---

# editar-video — armar un video que se pueda mostrar

> **El error caro de este trabajo es procesar antes de mirar.** Yo no puedo reproducir un
> `.mov`. Si no lo convierto en algo que pueda leer, estoy editando a ciegas y el resultado
> es un video con 40 minutos de render encima de tomas que no servian.
>
> Y el segundo error caro: **aplicar el filtro que el pedido nombra en vez del que el
> material necesita.** "Estabilizalo" sobre material de dron con gimbal lo EMPEORA. Medir
> primero. Siempre.

## 0. Los 3 gates (en este orden, bloqueantes)

**GATE 1 — SONDEAR antes de tocar.** `python scripts/_video.py sondeo "<carpeta>/*.mov"`
Sale la resolucion real, fps, bitrate, si hay audio y los avisos. Tres cosas que cambian
todo el plan y no se ven abriendo el archivo:
- **La resolucion real.** Si ya es 1080p, el upscaling con IA no aporta nada (seccion 4).
- **fps no entero / PTS duplicados** -> hay que conformar a CFR, y `fps=1` pierde cuadros
  en silencio (te da 153 cuadros de un video de 289 s y no avisa).
- **Si hay pista de audio.** Sin audio no hay sonido ambiente que poner: eso hay que
  decirselo a Fak ANTES de armar nada (seccion 6).

**GATE 2 — MIRAR el material entero.** `python scripts/_video.py hojas "<carpeta>/*.mov" --cada 8`
Genera grillas de miniaturas con la hora quemada. **Leerlas con la tool Read, una por una.**
Recien despues de mirarlas se decide que se usa. En el trabajo del 02/09/2026 esto solo ya
descarto un archivo entero de 101 s que era 100% piso desenfocado.

**GATE 3 — MEDIR antes de elegir el filtro.** Nitidez, temblor y niveles se miden
(`analizar`, `temblor`, `niveles`). El filtro sale del numero, no del pedido.

## 0.1 Los scripts que ya estan escritos (`scripts/video/`)

No rehacerlos. Salieron del institucional del 10/09/2026 y estan versionados (`.video/` esta
gitignoreado, asi que ahi adentro nada sobrevive):

| Script | Que hace |
|---|---|
| `_infoDeVideos.py` | fotogramas deduplicados + transcripcion, al lado de los videos |
| `planos.py` | la lista de planos (con su rotulo de etapa) y el render por plano desde el original: tonemap + CFR + grade medido + nitidez + velocidad. `listar` / `render <clave\|todos>`; otro video: `VIDEO_ORIGEN=` |
| `preview.py` | carrete de verificacion desde el proxy, sin grade ni camara lenta — **se mira ANTES del render caro** |
| `armar.py` | une los planos: corte seco por bloque (concat `-c copy`) + `xfade` entre bloques, y deja las MARCAS del corte en `armado.json` |
| `logo_hd.py` | agranda el logo de Barack (151x75) a arte plano limpio |
| `placa.py` | placa de apertura y de cierre con el logo, barrido de luz y fundido |
| `musica.py` | cama musical original: saca el TEMPO del corte, pone el efecto en el momento clave y mide su propio espectro. Pide `numpy` + `scipy` |
| `golpes_prensa.wav` | cinco golpes metalicos del master del 10/09, que hacen de percusion (§6.1) |
| `master.py` | genera la musica, MIDE su sonoridad, y saca el master H.264 + faststart + tags de color |

`planos.py` trae la lista de planos de ESE video: para uno nuevo se cambia la tabla `PLANOS`,
el resto vale igual.

## 1. El flujo completo

```bash
python scripts/_video.py sondeo     "D:/tomas/*.mov"
python scripts/_video.py hojas      "D:/tomas/*.mov" --cada 8 --out .video/hojas
#   <-- MIRAR las hojas con Read antes de seguir
python scripts/_video.py analizar   "D:/tomas/*.mov" --out .video
python scripts/_video.py candidatos --csv .video/analisis.csv --ventana 6 --json .video/cand.json
#   <-- cortar cada candidato a un clip corto, medirle el temblor, y MIRARLO como tira
python scripts/_video.py temblor    ".video/clips/*.mp4"
python scripts/_video.py niveles    ".video/clips/*.mp4"
#   <-- recien aca se arma la lista de planos y se renderiza
```

`.video/` va al `.gitignore`: son cuadros y clips intermedios, pesan y se regeneran.

## 2. Elegir que se usa — con numeros, no a ojo

Tres metricas, las tres necesarias:

| Metrica | Como se mide | Umbral |
|---|---|---|
| **Nitidez** | varianza del laplaciano sobre el cuadro | mediana `< 20` = archivo fuera de foco, se descarta entero. Por plano, `>= 70` |
| **Temblor** | `phaseCorrelate` cuadro a cuadro, menos la media movil de 9 (= el paneo intencional) | `< 1,2 px` estable · `< 2,0 px` aceptable · mas = descartar |
| **Exposicion** | percentiles de luma + % de pixeles quemados | `p1 > 20` = negros levantados (aspecto lavado) · `quemado > 3%` = ventanas reventadas |

Medidas sobre 640x360; escalan con la resolucion de analisis, no con la del original.

**El paneo NO es temblor.** Un dron que barre la planta se mueve mucho y esta perfecto. Por
eso el temblor es el *residuo* despues de sacarle el movimiento suave. Un plano con
`paneo=2,7 px/cuadro` y `temblor=0,3 px` es un plano hermoso; uno con `paneo=0,4` y
`temblor=4,9` es basura.

**Picos > 100 px no son temblor: son latigazos.** El dron giro de golpe. No hay filtro que
lo arregle — se corta.

**Trampa del salto (jump cut).** Dos candidatos del mismo archivo separados por pocos
segundos son *el mismo plano con un pedazo sacado del medio*. Puestos uno detras del otro se
ven como un error de continuidad. O se usa uno, o se los separa con otros planos en el medio.
El script avisa, pero la separacion la decide el que arma el corte.

## 3. Mejorar la calidad — que mueve la aguja y que no

Medido el 02/09/2026 sobre material real (i5-1135G7, Iris Xe, sin GPU dedicada):

| Que | Ganancia real | Costo | Veredicto |
|---|---|---|---|
| **Correccion de color** | negros 33 -> 2, contraste +22%, saturacion x2 | ~4x tiempo real | **lo que mas se nota, por lejos** |
| `hqdn3d` + `cas` (ruido + nitidez) | nitidez medida +87% | +2x | **si** |
| `vidstab` (estabilizar) | temblor **+200%** (empeora) | +5,4x | **no** — ver seccion 3.2 |
| `nlmeans` (denoise fino) | marginal | **>24x**, no termina | no |
| Upscaling con IA (Real-ESRGAN etc.) | ninguna sobre 1080p | horas | **no** — ver seccion 4 |

### 3.1 Correccion de color: el "lavado" son los negros levantados

El sintoma que Fak describe como *"la calidad es muy mala"* casi nunca es resolucion. En el
material del 02/09 el negro mas oscuro estaba en **31/255 (12%)** — nada en el cuadro llegaba
a negro. Eso es la neblina. Se arregla mapeando ese piso a 0:

```
colorlevels=rimin=0.118:gimin=0.118:bimin=0.118:rimax=0.985:gimax=0.985:bimax=0.985,
eq=contrast=1.06:saturation=1.35:gamma=1.02
```

`rimin` sale de `niveles` (p1/255 menos un margen). `rimax` **no se sube** si `p99` ya esta
cerca de 255: las luces ya estan al borde de quemarse.

**Igualacion plano por plano, no un filtro global.** Cada plano tiene su `rimin` y su `gamma`
para que todos caigan en la misma luma media (0,57 funciona bien en planta). La
inconsistencia de color entre planos consecutivos es de los que mas delatan un video amateur.
Formula de la gamma, para que todos lleguen al mismo medio:

```
m' = (p50/255 - rimin) / (rimax - rimin)      # el medio despues de estirar
gamma = ln(m') / ln(objetivo)                 # eq aplica out = in^(1/gamma)
```

### 3.2 Estabilizacion: medir SIEMPRE antes, casi siempre no va

**Un dron moderno estabiliza por gimbal.** El material ya viene con 0,4–1,2 px de temblor —
mejor de lo que `vidstab` puede dar. Aplicarselo lo empeora: el filtro pelea contra el paneo
intencional del piloto e inyecta movimiento propio.

Medido el 02/09/2026, tres pruebas independientes:

| Clip | Temblor original | Con `vidstab` | Resultado |
|---|---|---|---|
| V3 (gimbal, suave) | 0,68 px | 2,39 px (`smoothing=18`) | **+250%** |
| V5 (el mas movido de los elegidos) | 1,93 px | 5,79 px (`smoothing=10`) | **+200%** |
| V5, idem | 1,93 px | 5,91 px (`smoothing=30`) | **+206%** |

Ademas cuesta nitidez (el remuestreo ablanda: 60 -> 44 de laplaciano) y recorta imagen con
`optzoom`. **Regla: no se estabiliza sin medir antes y despues.** Si `temblor < 2,0 px`, no
se estabiliza. Si la toma tiene 5 px o mas, casi seguro tambien tiene latigazos: se descarta,
no se estabiliza.

Si algun dia hace falta de verdad (camara en mano, sin gimbal):
```bash
# ojo: dentro de un filtro, en Windows, la ruta con ":" rompe el parseo.
# Solucion: cd al directorio y usar nombres relativos.
cd .video/work
ffmpeg -i in.mp4 -vf "vidstabdetect=shakiness=7:accuracy=15:result=t.trf" -f null -
ffmpeg -i in.mp4 -vf "vidstabtransform=input=t.trf:smoothing=18:optzoom=1:interpol=bicubic" ... out.mp4
```

## 4. Upscaling con IA: para material 1080p es humo

- Si el original **ya es 1080p**, no hay resolucion que ganar. Los modelos de
  super-resolucion **inventan** textura, y sobre motion blur generan artefactos en vez de
  corregirlo.
- En una GPU integrada (Iris Xe) el costo va de **20-35 minutos de proceso por minuto de
  video** hacia arriba. La notebook es la maquina de trabajo de Fak: eso no se hace.
- El filtro `sr` de ffmpeg no esta compilado en el build de esta maquina, y la propia
  comunidad lo da por debil.
- **Cuando SI**: original genuinamente chico (480p/720p) que hay que llevar a 1080p, o
  recorte fuerte dentro del cuadro. Ahi se evalua; en 1080p no.

**El motion blur no se arregla con nada.** Es informacion perdida en la exposicion. Afilar lo
hace mas evidente, no lo corrige. Tomas con blur: se descartan en la seleccion.

Si el material es de celular y no de dron (HDR/HLG, vertical, streams fantasma), sondear antes
de gradar: `reference/celular-hdr-y-vertical.md`.

## 5. El corte — criterio de institucional industrial

Sacado de guias de productoras de video corporativo e industrial (investigado 02/09/2026):

| Que | Valor |
|---|---|
| **Duracion total** | 1,5–2,5 min es el punto optimo para mostrarle a un directivo |
| **Duracion de plano** | corporativo 10–20 s · documental 7–25 s · **plano de dron 3–6 s**. Para una pieza toda de dron: **6–8 s** |
| **Estructura** | general/establecedor -> linea y proceso -> detalle -> gente -> producto o cierre |
| **Transiciones** | corte seco adentro de cada bloque · disolvencia corta (0,5–0,8 s) entre bloques · fundido a negro al abrir y cerrar. **Nada de transiciones de efecto** |
| **Placas de texto** | breves, de seccion, no parrafos. Mas necesarias cuanto menos audio haya |
| **Color** | la consistencia entre planos importa mas que elegir frio o calido |

**Errores que delatan a un amateur:** transiciones de efecto · zoom digital · planos
temblorosos · saltos de continuidad · color distinto entre plano y plano · falta de variedad
(todo wide o todo detalle) · texto de mas.

**El corte cuenta una SECUENCIA; no es una seleccion de planos lindos.** Es la correccion
mas cara de este trabajo. La primera version tenia los mejores planos, bien gradados y bien
ordenados por bloque tematico, y Fak igual dijo: *"se repetia mucho lo mismo y no entendias
la secuencia... cualquiera lo debe entender asi rapidamente"*. Lo que fallaba:

- **Cinco planos del mismo gesto no son cinco planos: son uno repetido.** Siete "gente
  trabajando sobre el molde" se leen como relleno. Lo que se lee como proceso es una cadena
  donde **cada plano adelanta la accion**: la pieza esta en el molde -> la levantan -> la
  sacan -> la llevan -> la apoyan en la fila -> la controlan.
- **Buscar en el material una toma continua larga y usarla como columna vertebral.** En este
  video el tramo 486-507 s tenia la accion entera. Tramos sucesivos de una misma toma, en
  orden y con la accion avanzando, se leen como accion condensada — no como salto (la trampa
  del salto de la seccion 2 es para tramos con el MISMO encuadre y nada distinto en el medio).
- **Lo manipulativo va acelerado 1,2x a 1,4x** (`setpts` con factor < 1, y `fps=25` DESPUES
  para volver a fijar el CFR). Sacar una pieza a mano en tiempo real se hace largo.
- **Un establecedor largo de una maquina quieta mata el arranque.** Abri con 18 s de prensa
  estatica; quedo en 10 s y con una persona en el tercer plano. Si la maquina no se mueve, el
  plano no aguanta 5 s.
- **Rotulos numerados de etapa (`01 LA PRENSA`, `02 LA PIEZA`...) resuelven la comprension en
  un segundo** y no violan la regla de no inventar, siempre que **describan lo que se ve** y
  no un dato de proceso, un tiempo de ciclo ni una norma.

**Lo que el material no tiene, no se cuenta.** Fak describio el proceso como *"darle al boton
que arranque"*; en los 9:25 filmados **la prensa no cierra nunca y nadie aprieta ningun
boton** — era una puesta a punto del molde. Se verifico siguiendo la posicion del plato
superior en las 558 muestras, no a ojo. Eso se dice en el `.txt` y se ofrece la salida real
(filmar 20-30 s del ciclo), no se disimula con un plano que insinue otra cosa.

**"Que todos tengan su momento" se verifica con una lista, no con la sensacion.** Se escribe
el padron de las personas que aparecen en la filmacion, descriptas por como se las reconoce
("buzo gris y negro", "campera azul con cola de caballo"), y al lado los planos en los que
sale cada una. La lista va al `.txt` de la carpeta: es lo que Fak puede chequear. En el
institucional del 10/09 eran siete personas y ninguna quedaba sin plano propio.

**Un video largo de planta es casi todo el mismo encuadre.** De los 9:25 de ese material,
mas de la mitad era la prensa quieta sin que pasara nada, y el corte final uso el **16%**
(90,7 s). Medirlo antes de armar evita buscar variedad donde no la hay.

**Lo que aca NO se inventa:** una placa que nombre una operacion, un dato de produccion, una
certificacion o el nombre de una planta es contenido tecnico. Si no esta confirmado por Fak
o por un documento, **no va** (`core-prohibiciones.md` §1). Se entrega la version sin texto y
se le pregunta. Poner "Inyeccion" sobre una nave porque las maquinas *parecen* inyectoras es
exactamente lo prohibido.

**La marca de un tercero en cuadro se mira antes de elegir el encuadre.** En la planta hay
logos del fabricante de la maquina (en la prensa del 10/09, "KINGPOWER" proyectado en verde
sobre la pared), de proveedores y de clientes. El video es de Barack: esa marca **no va en el
plano de apertura ni en el de cierre**, que son los dos que quedan en la cabeza. Si aparece
en planos del medio y no se puede evitar, se entrega igual pero se dice en el `.txt`, para
que Fak decida. Lo mismo vale para una pieza de cliente reconocible en un video que se va a
mostrar afuera.

## 6. Sin musica no es lo mismo que en silencio

Si Fak pide "sin musica", **preguntar por el sonido ambiente antes de entregar**. Un video
industrial de 2 minutos en silencio absoluto se lee como archivo roto, no como decision
estetica: quien lo abre revisa el volumen en vez de mirar la planta.

- Si el material **tiene** audio: dejar el ambiente sincronizado, nivelado parejo entre
  cortes. Eso cumple "sin musica" y se ve profesional.
- Si el material **no tiene** audio (el `sondeo` lo dice): avisarlo. La unica salida es que
  Fak grabe 30–60 s de ambiente de planta con el telefono y se acuesta debajo.
- La decision es de Fak. Lo que no se hace es entregar el mudo sin mencionarlo.

### 6.1 Si la musica se sintetiza

El camino vivo es §6.2: montar el tema que elige Fak. `scripts/video/musica.py` es la salida
cuando no se puede depender de la licencia de nadie — la receta entera (el metodo de medir una
referencia real, las 4 vueltas con Fak, timbre, tempo, el momento especial, mezcla) esta en
`reference/musica-sintetizada.md`. **Lo que se aprendio midiendo es el criterio con el que se
juzga cualquier musica, propia o ajena**, y el nivel de entrega de abajo vale para las dos.

#### 🔴 Nivel de entrega: -20 LUFS para un archivo suelto

| Donde se reproduce | Objetivo | Fuente |
|---|---|---|
| **Archivo que se manda** (OneDrive, WhatsApp, adjunto) | **-20 LUFS**, true peak **-1,5 dBTP** | AES **TD1008 §5** pone -20 LUFS como piso para material sin normalizacion de plataforma; **EBU R128 s2 §g** sanciona el rango -20 a -16 |
| Maximo short-term (ventana 3 s) | **objetivo + 5 LU** como techo | **EBU R128 s1 §d** |
| YouTube / Spotify / Amazon | -14 | normalizan ellos |
| Apple Music | -16 | idem |
| Broadcast EBU | -23 | cadena calibrada, no aplica a un archivo |

- **El reproductor del celular y el de Windows NO normalizan nada.** Un archivo a -15,5 LUFS
  tiene la altura de un master de Spotify y con el volumen al 100 revienta. La v4 va a -20,0
  LUFS con el maximo short-term en -17,1 (objetivo +2,9 LU, adentro del techo de 5).
- **4,5 dB no es un retoque**: 10 dB es la mitad de sonoridad percibida, asi que 4,5 son
  ~27% menos. El umbral de deteccion es 1 dB: se nota seguro.
- **Sin locucion la musica NO va mas baja, va al objetivo completo.** El "-18 a -25 dB de
  musica bajo dialogo" que circula en blogs es para musica DEBAJO de una voz. TD1008 §5 mide
  ademas que la voz, al mismo LUFS que la musica, se percibe 2-3 dB mas fuerte — o sea que
  una musica a -20 equivale a un programa hablado a -22/-23.
- **El pico que importa es el TRUE PEAK, no el de muestra**, y el AAC agrega sobrepico entre
  muestras (medido: hasta +2,2 dB). Con el limitador en -2,0 dBFS el MP4 salio en **+0,2**.
  Se mide con `ebur128=peak=true` **sobre el MP4 final**, nunca sobre el WAV.

Como se mide todo esto de una (short-term pide `-loglevel verbose`, si no el frame log no
sale):

```bash
ffmpeg -loglevel verbose -nostats -i entrega.mp4 \
  -af "ebur128=peak=true:framelog=verbose" -f null -   # I, LRA, TPK y la curva S:
```

### 6.2 Si Fak pasa un tema, el trabajo es de MONTAJE (y es el camino bueno)

Fak, 11/09/2026, despues de cuatro vueltas de musica sintetizada: *"usa esa cancion, las
tuyas son malisimas"*, con el MP3 adjunto. **Cuando pasa eso no se discute ni se ofrece la
propia**: se monta la suya. El sintetizador tiene un techo que ninguna cantidad de medicion
levanta — un tema producido tiene instrumentos grabados, y eso no se emula.

Lo que cambia es la naturaleza del trabajo: ya no es elegir timbres, es **cortar**. Y cortar
musica tiene una sola regla dura: **lo que se saca tiene que medir un numero entero de
compases**, o la musica tropieza. Asi que lo primero es medir el compas, no estimarlo:

El flujo son tres pasadas y las hace `scripts/video/cancion.py`: mapa por segundo (dB +
centroide) -> grilla (periodo, fase, golpes grandes) -> lupa de 25 ms sobre las zonas elegidas.

- El **periodo** sale de la autocorrelacion de la envolvente de novedad, pero **el numero
  fino sale de dos golpes lejanos**: 56 compases entre 18,454 s y 135,320 s dan 2,086893 s,
  o sea 115,0 BPM exactos. La autocorrelacion sola daba 2,0870 — con 0,1% de error, a los
  60 s ya se corrio 60 ms.
- El **mapa por segundo** (dB + centroide espectral) dice donde cambia de seccion sin tener
  que escucharla: un centroide que salta a 3.000-4.000 Hz en un solo segundo es un platillo,
  o sea el 1 de una seccion nueva.

**El montaje que salio, para un video de 60,8 s con un tema de 144 s: dos pedazos y UN
empalme.** Tres cosas que hay que hacer coincidir, en este orden de prioridad:

| Que | Con que | Por que |
|---|---|---|
| El **bajon** del tema | El corte al plano del gesto | El efecto que a Fak le gusto ya existe adentro de la cancion: no hay que duckear nada |
| El **final** del tema | La placa de cierre | Un video que corta la musica al medio se lee como archivo roto |
| El **arranque** | La placa del logo | Que no arranque mudo (§6.1) |

El empalme se busca donde **el tema esta mas callado y entra en un tiempo fuerte con
acento**: ahi la oreja esta esperando que pase algo, y lo que pasa tapa el corte. Verificar
que no quedo click NO es escucharlo: es medir el **salto maximo entre muestras seguidas** en
±50 ms del empalme y compararlo con el percentil 99,99 del archivo entero. Si el del empalme
es menor, no hay click.

**Dos cosas que muerden y no avisan:**

1. **Un tema comercial viene masterizado tocando 0 dBFS**, y remuestrear de 44,1 a 48 kHz lo
   pasa (medido: 1,004). Escrito tal cual, el WAV intermedio recorta y ese recorte queda
   adentro para siempre. Se baja a -2 dBFS antes de escribirlo; el nivel final no se pierde
   porque `master.py` lo repone por SONORIDAD, no por pico.
2. **El MP3 no se commitea** (repo publico, licencia de un tercero). Va a la carpeta del
   entregable en la biblioteca, al lado del video, y el `_LEEME` dice de donde salio.

`scripts/video/cancion.py` hace todo esto; las cuatro constantes medidas del tema estan
arriba del archivo, con el comentario de que se vuelven a medir si se cambia de tema.

```bash
python scripts/video/master.py "<destino>.mp4" --cancion "<el MP3>"
```

### 6.3 Un chequeo que compara dos cosas distintas da verde o rojo por la razon equivocada

Un chequeo de compatibilidad en mono dijo "la peor banda pierde 0,36 dB" y con eso se certifico
una entrega. Estaba comparando el espectro de la **envolvente** `sqrt((L²+R²)/2)`
—una señal rectificada, llena de continua— contra el de la señal mono. Por eso daba **+13 dB
en los graves**, que no significa nada. Lo correcto es filtrar cada canal por separado y
comparar `RMS((L+R)/2)` contra `sqrt((RMS_L² + RMS_R²)/2)`.

Y el umbral tampoco se elige: **0 dB es contenido igual en los dos canales y -3 dB es
contenido independiente** — geometria, no un defecto. Medidas las 13 referencias reales, su
peor banda va de **-0,0 a -5,5 dB** (mediana -2,6). Poner el aviso en -3 reprueba a la
mayoria de la musica comercial; va en **-6,0**. El chequeo se rehace cada vez: vive en el
scratchpad de la sesion, que no sobrevive — lo que sobrevive es el criterio de esta seccion.

## 7. Render y entrega

**Conformar siempre a CFR** antes de cualquier filtro (`fps=25`): con fps variable el corte
se desincroniza y `xfade` tira flashes negros.

Por plano:
```bash
ffmpeg -ss <t0> -t <dur> -i "<origen>" \
  -vf "fps=25,scale=1920:1080:flags=lanczos,hqdn3d=2:1.5:3:2.5,<colorlevels+eq del plano>,cas=strength=0.45" \
  -c:v libx264 -crf 17 -preset medium -pix_fmt yuv420p \
  -color_primaries bt709 -color_trc bt709 -colorspace bt709 -an -y p01.mp4
```

Armado: **concat demuxer** (`-c copy`) para los cortes secos dentro de un bloque, y `xfade`
solo entre bloques. Encadenar 15 `xfade` en un filtro obliga a calcular offsets acumulados a
mano y es donde se rompe todo; con 3–4 disolvencias es manejable. Los offsets se calculan de
la duracion **medida** de cada bloque (`ffprobe format=duration`), nunca de la nominal.

**Los tags de color no los escribe `-color_trc`.** Con `-color_primaries bt709 -color_trc
bt709 -colorspace bt709` solos, el MP4 sale con `color_transfer: unknown` y
`color_primaries: unknown`, y el reproductor adivina. Hay que pasarlos tambien por el codec:
```
-x264-params colorprim=bt709:transfer=bt709:colormatrix=bt709
```
Se verifica con `ffprobe -show_entries stream=color_primaries,color_transfer,color_space`.

### 7.1 Placas de logo (apertura y cierre)

- **Se rinden a los MISMOS fps que el montaje.** Una placa a 30 y los planos a 25 rompe el
  `xfade` (el filtro no reconforma). Hay una sola constante de fps y la comparten los dos.
- **El logo de la casa no tiene version grande**: el unico `barack_logo.png` que existe en
  todo el disco es de 151x75. Para una placa de 1080p se agranda con **arte plano**, no con
  IA: LANCZOS 4x arriba y 4x abajo, se endurece el alfa con una rampa y el RGB se pisa con el
  color solido de la marca. Queda limpio porque es un logo de dos colores, no una foto.
- **Fondo claro**, no oscuro: el logo es azul sobre transparencia y no existe en blanco.
  Ademas empalma sin salto de luminancia con una planta muy blanca.
- **El barrido de luz va aplicado sobre la MASCARA del logo**, no parejo sobre el cuadro: una
  banda pareja sobre un fondo claro se satura en 255 y se ve como una mancha curva, no como
  un reflejo. Mezcla tipo screen, `img + banda*(255-img)`, con ~0,90 sobre las letras y ~0,10
  en el fondo.

### 7.1b Rotulos quemados: dos trampas que fallan EN SILENCIO

- **En `drawbox`, `w` y `h` son las de LA CAJA, no las del cuadro.** `y=h-158` con una caja de
  64 px da -94 y la barra se dibuja fuera de pantalla, sin error, sin aviso. Va `ih`/`iw`.
  En `drawtext`, en cambio, `w`/`h` SI son las del cuadro (`text_w`/`text_h` son las del
  texto). Dos filtros de la misma familia con convenciones distintas.
- **La planta es blanca: texto blanco con sombra no se lee.** Va con borde oscuro
  (`borderw=4:bordercolor=0x102A3F@0.90`), que ademas funciona sobre la maquina oscura.
- `drawbox` no tiene opcion de alfa, asi que para que el rotulo no aparezca de golpe se le
  anima la **altura** con una expresion (`h=64*min(1\,max(0\,(t-0.2)/0.3))*...`), no el alfa.
- Al probar un rotulo, **no probar con `-ss` sobre el clip ya rendido**: el `enable`/`alpha`
  se evaluan contra un `t` que arranca en 0 y el rotulo no aparece; ademas el clip YA tiene
  el rotulo quemado y se confunde con el nuevo. Probar sobre un plano sin rotulo, sin `-ss`,
  eligiendo el cuadro con `select=eq(n\,40)`.

### 7.2 Camara lenta que no se ve a tirones

Bajar la velocidad con `setpts` sola repite cuadros y se ve entrecortado. Va con
interpolacion de movimiento, y se **mira a resolucion completa** antes de darla por buena
(los artefactos de `minterpolate` no se ven en un proxy de 960x540):
```
setpts=2.5*PTS,minterpolate=fps=25:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1
```
Para encontrar el cuadro exacto de un gesto en un video largo se baja por pasos —recortes
cada 5 s, despues a 2 fps, despues a 6 fps a resolucion completa—, no se estima de la hoja
de contacto.

Master de entrega — H.264 en MP4, que abre en cualquier lado:
```bash
ffmpeg -i armado.mp4 -c:v libx264 -crf 18 -preset slow -pix_fmt yuv420p \
  -movflags +faststart -y entrega.mp4
```
`+faststart` mueve el indice al principio: el video empieza a verse sin bajarlo entero
(importa en WeTransfer, OneDrive, Gmail).

**H.264, no H.265**, aunque pese mas: HEVC puede no abrir en un Windows sin el codec de la
Store, y el destinatario es un directivo abriendo un adjunto, no un editor.

## 8. Antes de decir "listo"

1. **Mirar el video generado de punta a punta.** Extraer una hoja de contacto del
   ENTREGABLE (`hojas --cada 3`) y leerla. Un video que no se miro no se entrega
   (`git-deploy.md`, "Antes de decir listo").
2. Verificar duracion, resolucion, fps y que **abra** (`sondeo` sobre el entregable).
3. Chequear que no haya salto de color entre planos consecutivos (se ve en la hoja).
4. **Los originales no se tocan.** Todo sobre copias, en `.video/` o `C:\tmp`.
5. El entregable va a su carpeta por tipo de la biblioteca de Ingenieria
   (`5- VIDEOS Y FOTOS`), no al Escritorio (`escritorio-tareas.md`).

## 9. Estado de la maquina (verificado 02/09/2026)

- **ffmpeg 8.1-full_build** (Gyan, via winget) en `%LOCALAPPDATA%\Microsoft\WinGet\Packages\...\bin`,
  resoluble por PATH desde Git Bash (verificado 11/09/2026); `_video.py` lo resuelve igual por su
  cuenta, asi que no depende del shell. Trae `libvidstab`, `libx264/265`,
  `drawtext` con fuentes del sistema, `vulkan`, `opencl`.
- **Sin GPU dedicada**: Intel Iris Xe. `h264_qsv` (Quick Sync) funciona; `nvenc` y `amf`
  estan compilados pero **no hay hardware detras** — cualquier receta de internet que use
  NVENC no corre aca.
- Python 3.13 con `opencv-python` y `numpy` ya instalados.
- **Disco C ajustado** (11/09/2026: 27,6 GB libres de 237; llego a estar al 98 %). Un render de
  1080p come rapido: **medir antes** de arrancar una tanda larga y trabajar solo sobre los
  recortes elegidos.
- Fuentes para `drawtext`: `C:/Windows/Fonts/`. Dentro de un filtro hay que escapar los dos
  puntos, **tambien los del texto**: `text='00\:12'`, `fontfile='C\:/Windows/Fonts/arialbd.ttf'`.

## 10. Por que existe este skill

Lo que se busco antes de escribirlo y por que ninguna skill publica servia:
`reference/por-que-existe-este-skill.md`.
