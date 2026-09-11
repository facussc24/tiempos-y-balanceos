---
name: editar-video
description: Editar video en Barack — armar un institucional/recorrida de planta a partir de tomas crudas (dron o mano), elegir que sirve y que se descarta con criterio medido, mejorar la calidad (color, ruido, nitidez), y entregar un master que se abra en cualquier lado. Usar cuando Fak pase videos para editar, pida "mejorar la calidad" de un video, un video para un cliente o para la direccion, un recorrido de planta, o cortar/unir tomas. Incluye lo que NO sirve (upscaling con IA, estabilizacion sobre material de gimbal) medido en esta maquina, no leido.
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

### 6.1 Si va musica, se sintetiza aca — y se mide (10/09/2026, tres vueltas)

En el disco no hay musica de libreria, y **un tema de terceros no entra en un video de Barack
que se va a mostrar a un cliente**: no hay licencia que respalde el uso. La salida es generar
la cama con numpy + scipy (`scripts/video/musica.py`). Se rinde a la duracion exacta del
armado y se regenera en ~80 s si a Fak no le pega.

Costo tres vueltas con Fak. Las tres criticas fueron distintas y las tres tenian razon:

| Vuelta | Lo que dijo Fak | El defecto medible |
|---|---|---|
| v1, 88 BPM | *"ese sonido me hace dormir"* | mediana espectral 329 Hz · 79 pulsos/min |
| v2, 112 BPM | *"la cancion es una mierda"* | **el nivel se movia 3 dB en todo el video** |
| v3, 101 BPM | — | — |

#### Lo que hace que suene a stock (y se arregla)

1. **Sin ARCO no hay tema.** El defecto de la v2: una plancha pareja de punta a punta. Un
   arreglo corporativo arranca abajo, suma un elemento cada 4 compases y llega al pico
   entre el **70 y el 80% del metraje**, y ademas **BAJA la apertura** — sumar instrumentos
   no alcanza, porque el gancho solo ya suena casi tan fuerte como la mezcla entera. La v3
   sube 7,4 dB desde la apertura y cae 7,6 dB en la camara lenta. Los escalones van en
   COMPASES (`ARCO_DB`), no en segundos, asi sobreviven un cambio de corte.
2. **El gancho es un MALLET, no una sierra.** Marimba: los parciales de una barra real se
   afinan a la relacion **1 : 4 : 10** (amplitudes 1,0 / 0,42 / 0,16 acá), ataque de 2 ms,
   caida exponencial de 0,18 s, mas 3 ms de ruido de 2-5 kHz que es el golpe del mazo. Y el
   acorde se desgrana en **semicorcheas**: una sola voz rinde textura de pad.
3. **El REGISTRO del gancho manda mas que su volumen.** Con el gancho en 165-392 Hz la
   mediana daba 329 Hz (el numero de la version que adormecia) y la banda de brillo quedaba
   en 2,3%: peleaba con el bajo y el pad en la misma banda. Subiendolo **una octava** —
   fundamental 330-784, parcial x4 en 1,3-3,1 kHz, parcial x9,8 en 3,2-7,7 kHz — la mediana
   salto a 495 Hz sin tocar un solo nivel.
4. **Dos notas nunca pueden salir bit-identicas** (efecto ametralladora). En sintesis esto
   es gratis: **fase inicial aleatoria por nota**, detune +-1,5 cents, decaimiento +-5%,
   semilla de ruido distinta. Es lo que mas rinde por linea de codigo.
5. **Jitter de tiempo proporcional a lo filoso del ataque**: percusion sigma 2-4 ms, bajo
   4-6, melodia 8-12, pad 15-25. Un hat con 15 ms suena borracho; un pad con 15 ms suena
   vivo. Mas acentos por posicion metrica de 3-6 dB, que es lo que suena humano — el ruido
   aleatorio solo, no.
6. **Sidechain que NO se oiga**: en corporativo son 3-5 dB, no 8. Curva dibujada desde la
   grilla (no hace falta compresor): caida vertical y recuperacion **convexa** `1-(1-t)^2`.
7. **La saturacion se SOBREMUESTREA x4.** `tanh` sin sobremuestrear genera armonicos arriba
   de Nyquist que se pliegan como aliasing, y el aliasing *es* el sonido barato.
8. **Nada de `np.convolve(..., mode="same")` para filtrar.** Centra la salida, o sea que
   corre la señal HACIA ATRAS media longitud del kernel — con cutoffs distintos por
   instrumento, cada uno se corre distinto (hasta 21 ms) y la mezcla se embarra sin que se
   vea por que. Van filtros causales (`scipy.signal.sosfilt` con `butter`). Y ese mismo
   `convolve` con kernels largos es convolucion directa: un suavizado de 12.000 taps sobre
   2,9 M de muestras llevo un render de 1m15 a **7 minutos**.

#### El tempo sale del CORTE, no de un BPM lindo

Ningun tempo constante cae en 16 cortes elegidos por imagen — se probaron 580 BPM distintos
y el error medio no bajaba de 0,22 tiempos. Lo que SI se puede es clavar los estructurales:
se toma el compas que hace caer **el momento clave exactamente en una linea de compas**
(`COMPASES_AL_GESTO`), y el resto cae donde cae. Aca dio 101 BPM y con eso el gesto quedo en
el compas 19, la vuelta en el 21 y la placa final en el 23, mas cuatro cortes a menos de
60 ms de un tiempo. La banda documentada para video de fabrica es **100-112 BPM**;
corporativo generico va 112-128.

**Y NINGUN GOLPE VA ADELANTADO.** ITU-R BT.1359-1: el oido detecta el audio adelantado a
partir de **+45 ms** y el atrasado recien a **-125 ms** — casi tres veces mas tolerancia
para llegar tarde. Por eso la grilla entera va corrida **un cuadro (40 ms) DESPUES** del
corte. Si dudas, sobre el cuadro o un cuadro despues; nunca antes.

**Pocos acentos, no todos.** Marcar los 16 cortes es *mickey-mousing* y cansa: se marcan los
de seccion. `armar.py` deja la lista completa en `armado.json` (`cortes[]`), pero elegir es
del que arma.

#### El momento especial (camara lenta, reveal, gesto)

La receta que pidio Fak —*"que la musica tenga un efecto distinto ahi"*— se llama
**stopdown** y es esto, en orden:

1. La musica **se corta 0,24 s antes** del cuadro. Ese silencio es lo que le da al golpe
   donde aterrizar. **Corto**: si se estira, la escena se queda sin musica (paso: 1,4 s
   mudos a -40 dB en el medio del plano, y hubo que arreglarlo).
2. Un **swell invertido** ocupa el hueco: se invierte el material, se le pone la cola y se
   vuelve a invertir, asi TERMINA en el ataque en vez de empezar ahi.
3. Sobre el cuadro caen un **impacto de 5 capas** (click / punch / sub / metal inarmonico /
   cola) y un **sub drop** que baja de 110 a 30 Hz saturado con `tanh` — un seno puro a
   30 Hz no existe en el parlante de un celular.
4. **Durante** la camara lenta: se va la bateria, queda el pad filtrado a 700 Hz, 6 dB
   abajo, con la cola larga abierta. El low end es la base de una escena en camara lenta.
5. **Al volver**: un riser que **muere 0,18 s antes** (el riser no tapa el golpe), el filtro
   se abre y entra todo de nuevo.

Verificado midiendo el MP4 final cada 100 ms: -14,4 dB antes, -29 dB en el hueco, -10,2 dB
en el golpe — y el pico del golpe 30 ms DESPUES del cuadro del corte.

#### La percusion puede salir de la propia maquina

Es lo que hacen las marcas que Fak nombro: Skoda mando a Parv Thind (Wave Studios) a grabar
la linea de montaje para el spot del Roomster, Ford armo *"Sounds of Fusion"* con portazos y
chicharras del propio auto, y Diego Stocco hizo *"Music From A Dry Cleaner"* con la prensa de
una tintoreria. **Es lo unico que ninguna libreria de stock puede dar.**

Como se sacan (`scripts/video/golpes_prensa.wav`, armado con los scripts del scratchpad):
buscar transitorios con **salto de 6 dB en la banda de 2-8 kHz**, que sobresalgan 5 dB del
ambiente, que **decaigan 20 dB en menos de 350 ms**, y donde la banda alta le gane a la de
voz (200-1200 Hz). Despues **mirar el fotograma de cada candidato**: solo sirven los que
tienen en cuadro la maquina sola — con gente cerca del microfono el golpe es una persona, no
la prensa. De 13 candidatos quedaron 5. Se alternan (round-robin) para que no suenen dos
iguales seguidos.

#### Mezcla y entrega

- **Pasa-altos de arreglo a todo lo que no sea bombo ni bajo.** La acumulacion de graves es
  el error mas citado. Bombo 42 Hz, bajo 45, gancho 260, pad 180, perc 220, hats 400.
- **El bajo se cuida por el DECAIMIENTO, no por el volumen.** Notas de 320 ms sobre corcheas
  de 297 ms se solapan: el bajo deja de ser ritmico y se vuelve un colchon de sub. Paso:
  **67% de la energia del tema abajo de 120 Hz**. Con tau 0,13 s quedo en 15%.
- **El grave va MONO**: `M/S` con pasa-altos del canal Side en 120 Hz. Se verifica sumando a
  mono y comparando RMS por banda de octava: **si alguna pierde mas de 3 dB, hay cancelacion
  de fase** (esta version pierde 0,3).
- **Dos envios de reverb, no doce convoluciones**: sala 0,6 s (predelay 8 ms) para lo
  percutido, hall 2,4 s (predelay 35 ms) para pad y gancho. Los dos con pasa-altos 280 y
  pasa-bajos 7 kHz en el retorno, y duckeados por el bombo.
- **Compresion de bus: 2:1, ataque 20 ms, tope 3 dB de reduccion.** Mas es aplastar.
- **La correccion final de espectro va TOPEADA** (aca, 5 dB). Si hiciera falta mas, el
  problema esta en el arreglo y hay que arreglarlo ahi, no taparlo con un ecualizador. En
  la v3 terminó pidiendo -0,3 / +1,0 / +2,9 dB: gentil, que es como tiene que quedar.
- **Nivel de entrega: se MIDE, nunca se hereda el numero de la vez pasada.** Una cama sola,
  sin locucion ni ambiente, va en **-15/-16 LUFS**. El mismo `volume=-2.2dB` que dejaba una
  cama en -15,4 dejo la siguiente en **-19,5**: a igual pico, una mezcla con bateria mide
  mucho menos. `master.py` mide con `ebur128=peak=true` y calcula la ganancia sola.
- **El pico lo sostiene un limitador con lookahead** (erosion por minimo movil + suavizado;
  sin el suavizado es un recortador), y el techo se pone con margen porque **el AAC agrega
  sobrepico entre muestras**: con el limitador en -2,0 dBFS el MP4 salio en **+0,2 dBFS**.
  Con -4,0 quedo en -1,8. **El pico se verifica sobre el MP4 final, no sobre el WAV.**

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
   (`verify-before-close.md`).
2. Verificar duracion, resolucion, fps y que **abra** (`sondeo` sobre el entregable).
3. Chequear que no haya salto de color entre planos consecutivos (se ve en la hoja).
4. **Los originales no se tocan.** Todo sobre copias, en `.video/` o `C:\tmp`.
5. El entregable va a su carpeta por tipo de la biblioteca de Ingenieria
   (`5- VIDEOS Y FOTOS`), no al Escritorio (`escritorio-tareas.md`).

## 9. Estado de la maquina (verificado 02/09/2026)

- **ffmpeg 8.1-full_build** (Gyan, via winget) en `%LOCALAPPDATA%\Microsoft\WinGet\Packages\...\bin`.
  **No esta en el PATH** — `_video.py` lo resuelve solo. Trae `libvidstab`, `libx264/265`,
  `drawtext` con fuentes del sistema, `vulkan`, `opencl`.
- **Sin GPU dedicada**: Intel Iris Xe. `h264_qsv` (Quick Sync) funciona; `nvenc` y `amf`
  estan compilados pero **no hay hardware detras** — cualquier receta de internet que use
  NVENC no corre aca.
- Python 3.13 con `opencv-python` y `numpy` ya instalados.
- **Disco C: al 98%** (~7 GB libres). Un render de 1080p come rapido: borrar intermedios no,
  pero trabajar solo sobre los recortes elegidos si.
- Fuentes para `drawtext`: `C:/Windows/Fonts/`. Dentro de un filtro hay que escapar los dos
  puntos, **tambien los del texto**: `text='00\:12'`, `fontfile='C\:/Windows/Fonts/arialbd.ttf'`.

## 10. No existe skill publica que sirva para esto

Buscado el 02/09/2026: el repo oficial `anthropics/skills` no tiene nada de video. De 9
proyectos comunitarios, el mas popular (`browser-use/video-use`, 23k estrellas) **decide que
cortar leyendo la transcripcion del audio** — sobre b-roll mudo de dron no tiene con que
trabajar, y pide una API paga. Ninguno cubre a la vez seleccion por criterio visual +
estabilizacion + color. Por eso esta skill se escribio de cero. Si aparece algo mejor, lo que
hay que conservar de aca es la **medicion** (secciones 2 y 3), que es lo que ninguna trae.
