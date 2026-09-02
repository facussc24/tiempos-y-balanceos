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

**Lo que aca NO se inventa:** una placa que nombre una operacion, un dato de produccion, una
certificacion o el nombre de una planta es contenido tecnico. Si no esta confirmado por Fak
o por un documento, **no va** (`core-prohibiciones.md` §1). Se entrega la version sin texto y
se le pregunta. Poner "Inyeccion" sobre una nave porque las maquinas *parecen* inyectoras es
exactamente lo prohibido.

## 6. Sin musica no es lo mismo que en silencio

Si Fak pide "sin musica", **preguntar por el sonido ambiente antes de entregar**. Un video
industrial de 2 minutos en silencio absoluto se lee como archivo roto, no como decision
estetica: quien lo abre revisa el volumen en vez de mirar la planta.

- Si el material **tiene** audio: dejar el ambiente sincronizado, nivelado parejo entre
  cortes. Eso cumple "sin musica" y se ve profesional.
- Si el material **no tiene** audio (el `sondeo` lo dice): avisarlo. La unica salida es que
  Fak grabe 30–60 s de ambiente de planta con el telefono y se acuesta debajo.
- La decision es de Fak. Lo que no se hace es entregar el mudo sin mencionarlo.

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
mano y es donde se rompe todo; con 3–4 disolvencias es manejable.

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
