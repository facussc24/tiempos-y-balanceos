# Receta: hoja de proceso desde un video, en 3 momentos con Fak (meta ~20 min, mismos gates)

**No releer ni rehacer:** `SKILL.md` entero (solo GATE 0.1 y 0.7), LECCIONES y reglas (ya estan en contexto), Whisper, el cuadro mas nitido, la hoja de contacto, `rotular.py`, el pptx a PNG: todo existe y esta probado. Canon `docs/CRITERIOS_HOJAS_DE_PROCESO.md`: abrirlo una vez, secciones 3.2, 4.4 y 6.

## Minuto 0 — un comando, y se sigue leyendo mientras corre
```bash
S=.claude/skills/hojas-de-proceso/scripts
py -3 $S/preparar_video.py "<video>" --vocab "<palabras de la pieza>" [--idiomas es,zh] [--rot 90]
```
Deja en `tmp/preparar_video/<IMG_xxxx>/`: `contacto_NN.jpg` (cuadros numerados, con segundo), `preparado.json` y `transcripcion.txt` (sola, en segundo plano). Seguimiento: `--estado <carpeta> [--esperar]`; si murio: `--retranscribir <carpeta>`; si un cuadro sale acostado: `--rehacer --rot N`. `--vocab` va siempre: sin eso Whisper oye "gran paz" donde se dijo "grampas".

## Minuto ~8 — "esto entendi" (mensaje corto a Fak, sin archivos)
1. Mirar TODAS las hojas de contacto y leer `transcripcion.txt` ENTERA (GATE 0.7; `(ALUCINA)` y `(?)` no son fuente; un numero sale de la pantalla).
2. Decir que pieza o maquina es, la jornada del operario de punta a punta (una linea por paso, empieza con el verbo del operario) y de que minuto sale cada paso.
3. Preguntar **solo** lo que ningun papel ni el video contestan, con ruta cuando es "esto va aca, ¿esta bien?". Antes: `py -3 scripts/_hoNumeros.py`, el legajo y la hoja de la maquina hermana.

## Minuto ~15 — plancha de fotos elegidas
```bash
py -3 $S/fotodevideo.py sacar --video "<video>" --seg 83.5 --radio 0.5 [--rot N] [--crop x,y,w,h] --ancho 1600 --out <carpeta>/f01.jpg --nota "..."
py -3 $S/rotular.py --foto f01.jpg --out r01.jpg --banda ninguna --marca "color:verde|texto"   # solo si el paso manda mirar un control
py -3 $S/fotodevideo.py contacto <carpeta>/f*.jpg --plancha plancha.jpg                       # MIRARLA: rotacion, recorte, foco
```
El segundo sale de la hoja de contacto (`#07  83.5 s`); la foto final se saca del video a resolucion completa, no del cuadro de la hoja. Una foto por paso, recortada. Mostrarle la plancha a Fak con el paso al lado.

## Minuto ~20 — la hoja renderizada y donde va
1. Armar con el generador de la maquina hermana (`scripts/img/`, `scripts/p21/`, `scripts/hotmelt/`): corre `gate_redaccion` (vocabulario, voz, TBD).
2. `py -3 $S/hoja_proceso_check.py "<deck.pptx>"` en verde.
3. `py -3 scripts/img/exportar_png.py "<deck.pptx>" "<carpeta>"` y MIRAR el PNG como va impreso en A4.
4. Decirle a Fak: ruta final `Y:\...\HOJAS DE OPERACIONES\1- CLIENTES\<cliente>\<proyecto>\HO NNN - <pieza>\`, numero de `py -3 scripts/_hoNumeros.py` y la fila del listado ya preparada (se escribe con su OK).

## Al cerrar
La transcripcion va a `<MAQUINA>\.claude\transcripciones\` de la biblioteca (`video-maquina.md`); el video master no se toca y `tmp/` queda como esta.
