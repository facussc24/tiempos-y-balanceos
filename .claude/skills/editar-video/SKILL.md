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

## 4.1 Video de celular (no de dron): HDR y vertical — sondear ANTES de gradar

Un iPhone grabando en su modo por defecto no es SDR 8-bit como el dron. `sondeo` no lo
avisa todavia (queda pendiente agregarlo al script) — verificar a mano con:

```bash
ffprobe -v error -select_streams v:0 -show_entries stream=pix_fmt,color_transfer,color_primaries "$F"
ffprobe -v error -select_streams v:0 -show_entries stream_side_data "$F"   # rotation y Dolby Vision
```

- **`color_transfer=arib-std-b67` (HLG) o similar, `pix_fmt=yuv420p10le`: es HDR.** Si se le
  aplica una correccion de color normal y despues se le pone la etiqueta `-color_trc bt709`
  sin convertir la curva real, el video sale **CASI NEGRO** — no es un error de exposicion,
  es HDR mal convertido a SDR. El tag no cambia los valores de los pixeles, solo miente sobre
  que curva tienen. Se corrige con un tone-map real ANTES de cualquier otro filtro:
  ```
  zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p
  ```
  Un `side_data_type: DOVI configuration record` (Dolby Vision) es el mismo caso: ffmpeg usa
  la capa base HLG/HDR10 igual, el tonemap de arriba alcanza.
- **`side_data_type: Display Matrix` con `rotation: -90` (o -270): esta grabado VERTICAL**
  (telefono en mano), aunque `width`/`height` reporten 1920x1080 apaisado — la rotacion se
  aplica al mostrar. ffmpeg la auto-aplica (`autorotate` por defecto), no hace falta
  `transpose` a mano; verificar extrayendo un frame y mirandolo.
- **Insertar un clip vertical en un video horizontal: NUNCA franjas negras.** Se ve amateur
  y tira la mitad del cuadro. Rellenar los costados con una copia de la MISMA imagen,
  escalada para tapar el cuadro entero y desenfocada — no franjas negras, no un color
  solido:
  ```
  split[bg][fg];
  [bg]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,gblur=sigma=25,eq=brightness=-0.08:saturation=0.75[bgb];
  [fg]scale=-2:1080:flags=lanczos,<grade liviana>[fgs];
  [bgb][fgs]overlay=(W-w)/2:(H-h)/2,format=yuv420p[v]
  ```
- **Costo real**: tonemap + pillarbox + grade en un solo filtro, medido el 03/09/2026 sobre
  clips de celular de ~80-100 s: ronda **3,5x tiempo real** en esta CPU (i5-1135G7, sin GPU
  dedicada) — mas lento que el material de dron (que no necesita tonemap).
- **Streams fantasma**: el .MOV de iPhone trae de mas — sensores, metadata Apple — que
  `-map 0:a` puede intentar mapear y fallar ("no decoder for: none"). Mapear el audio por
  **indice explicito** (`-map 0:1`, verificado con `ffprobe -show_entries stream=index,codec_type`),
  nunca por letra.
- **Corregir color de celular con la misma formula del dron es EXCESIVO.** El negro de
  celular en interior bien iluminado suele estar en 5-8% (no 12% como el dron): la misma
  correccion agresiva (gamma empujado a 0,57) le oscurece la cara a la persona en cuadro.
  Comparar SIEMPRE una version liviana (solo recuperar negro + contraste/saturacion suaves,
  sin empujar gamma) contra la agresiva antes de elegir — ver seccion 3.1, el numero de
  negro cambia la respuesta.

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

## 10. No existe skill publica que sirva para esto

Buscado el 02/09/2026: el repo oficial `anthropics/skills` no tiene nada de video. De 9
proyectos comunitarios, el mas popular (`browser-use/video-use`, 23k estrellas) **decide que
cortar leyendo la transcripcion del audio** — sobre b-roll mudo de dron no tiene con que
trabajar, y pide una API paga. Ninguno cubre a la vez seleccion por criterio visual +
estabilizacion + color. Por eso esta skill se escribio de cero. Si aparece algo mejor, lo que
hay que conservar de aca es la **medicion** (secciones 2 y 3), que es lo que ninguna trae.
