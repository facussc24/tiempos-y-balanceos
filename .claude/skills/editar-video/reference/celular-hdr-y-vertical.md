# Material de celular (no de dron): HDR y vertical

Se sondea **antes** de gradar. Un clip de iPhone puede venir en HLG/HDR y con streams fantasma:
gradarlo como si fuera SDR lo deja lavado o quemado, y el vertical no se arregla recortando sin
mirar que queda adentro. El flujo general esta en `../SKILL.md`.

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
