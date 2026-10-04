# Video unico «Claude en Barack» — donde quedo (04/10/2026)

**Armado.** `exports\CLAUDES_POR_AREA_20261001\Video - Claude en Barack.mp4` (+ `.srt`, 73 subtitulos), **3:59,7**, 18 escenas, 21 parrafos
de voz. `armar_video.py --escenas escenas_unico.json` salio con 0 y el control tecnico dio todo OK (1920x1080, 30 fps, h264/aac,
-16,1 LUFS, video y sonido de igual largo). Junta el tutorial (version 3) y el video por sector en uno solo. No se tocaron los
dos videos viejos, sus `.srt`, sus `.json` ni sus carpetas de voz.

Para volver a armarlo: `cd C:\Dev\BarackMercosul\tools\claude-area\video` y `python armar_video.py --escenas escenas_unico.json`
(tardo 10 min). Cuadros sueltos: `... --cuadros 10,20,30` (van a `control_unico\_cuadros`). Las escenas salen de
`ayudas_video\generar_escenas_unico.py` (lee `escenas_v3.json` y `escenas_ilusiona.json`, no los cambia, y reescribe `escenas_unico.json`).

## Cambios de texto pedidos hoy (Facundo, via la sesion principal)

- **Parrafo 7**: «Cada sector tiene sus preguntas.» (antes «…pregunta lo suyo», que Whisper oia «los uso» en 3 de 3 tomas). La lamina de esa escena
  dice lo mismo. Quedo escrito en `voz_unico\narracion.txt` y en `.sgc-cache\claude-por-area\examen\video_unico_narracion.txt`.
- **Parrafo 19** (lo que Claude no hace solo): quedo en tres frases, **sin la del correo**. La lamina «Claude no hace esto solo» tiene tres renglones:
  «No borra archivos si no se lo pedís», «No manda mails si no se lo pedís», «No cambia nada en el servidor». El WAV se recorto (se corto la frase 4;
  el original esta en `partes\anterior_recorte19\`). Ni la voz, ni los subtitulos, ni la lamina nombran el correo (`grep correo` del `.srt` y de `escenas_unico.json`: 0).

## La voz (`exports\CLAUDES_POR_AREA_20261001\fuentes\voz_unico\`)

- Velocidad: **`--lentitud 1.30 --pausa-frase 0.6`** (antes 1.18 y 0.35). En el video: 0,9 s entre parrafos y 0,6 s de aire entre escenas
  (antes 0,4 y 0,3). `narrar.py` y `transcribir.py` son los de `voz_ilusiona` (traen `oído`, `flujogramas`, `FRASES`, `letras_a_los_numeros()`).
  No hizo falta tocar `DICCION`.
- **Como se grabo (distinto de las notas).** Con la PC al 100 % una frase con `--mejor-de 8 --umbral 0.995` tardaba mas de 5 minutos. Se grabo
  **una toma por frase** (`--mejor-de 1`), se paso Whisper por los 21 parrafos (`transcribir.py --partes`) y las frases mal oidas se repitieron con
  **`reparar.py`** (en esa carpeta): repite solo esas frases, hasta N tomas, se queda con la mejor y la empalma en el WAV del parrafo (lo anterior
  queda en `partes\anterior_reparar\`). El parrafo 7 se regrabo entero con `narrar.py --solo 7 --mejor-de 6` (100 % a la primera toma).
  Rondas de `reparar.py` (`reparar_log.txt`): 1.a P1 f2, P5 f3-5, P7, P8 f1, P10 f4, P12 f1 y f4, P18 f4, P19 f1 y f4; 2.a (mejor de 6) P4 f4, P6 f5,
  P10 f4, P12 f1, P20 f1, P5 f4, P19 f1; 3.a P20 f1 (mejor de 8: «Claude» salio bien recien a la toma 8). Cada una quedo en 100 % **sola**.
- **Palabras dudosas, como quedaron** (lo que oye Whisper en el PARRAFO ENTERO, ultima pasada; a oido no se escucho). Una frase que sola sale 100 %
  a veces dentro del parrafo se oye distinto: es Whisper, no la voz.

| Parrafo | Palabra | Que oye Whisper en el parrafo | Nota |
|---|---|---|---|
| 6 | «si hay duda» | «si le hay duda» | sola, 100 % (toma 5 de 6); la primera frase se oyo «Por la pregunta» en esta pasada y «Otra pregunta» en la anterior |
| 10 | embarque | «embaque» | sola, 100 % (toma 3 de 3) |
| 5 | «¿Qué funciones tiene mi puesto?» | «…tiene en mi puesto» | sobra una «en» |
| 5 | F-24 / «la revisión I» | «F24» / «la revisión y» | se le da «efe veinticuatro»; la «I» suena como «y» |
| 19 | hace | «haces» | |
| 14 | Outlook | «YouTube» | igual que en los videos anteriores (se le da «Áutluc»); no se repitio |
| 17 | BOM | «bomba» | igual que antes |
| 3 | Code | «Coul» | se le da «Coud»; no se repitio |
| 21 | preguntá | «pregunta» | el acento |
| 18 | «que es el recomendado» | «que eres el recomendado» | |
| 5, 19, 20 | Claude | ahora «Claude» | antes «Claudia/Claudio»: salio a la 3.a, 5.a y 8.a toma; **no se respeleo** |
| 12 | Recursos | «Recursos» | arreglado (toma 6) |

## Lo que se saco de cuadro (sin tarjetas de archivo, «Deshacer», «+7 -0» / «+29 -0», cartel de permiso ni «Confirmar cambios»)

No se retoca ninguna pantalla: se elige que parte de la grabacion real se ve (`generar_escenas_unico.py`).
- **Mail.** En `demo-02oct-mail-mandalo.mp4` y `demo-02oct-mail-listo.mp4` la tarjeta `mail_borrador.json  Deshacer +7 -0` esta entre y = 355 y 383
  y la linea «Creado mail_borrador.json … +7 -0» en y = 107: la camara pasa a una ventana que **empieza en y = 392** (`alto` 210 y 198), asi que
  quedan «mandalo», «Enviando…» y «Listo: salió a Facundo Santoro…» y nada de arriba. En `demo-02oct-mail-se-abre.mp4` el tramo termina a los
  4,4 s (a los 4,5 s se asoma la ventana de Claude con la tarjeta).
- **Presentacion.** El tramo de espera arranca a los 4,2 s (a los 3 s de esa grabacion se lee «Creando presentacion.json»).
- **Ensenar una tarea.** `demo-02oct-aprende-propone.mp4` no tenia tarjeta (se usa igual). En `demo-02oct-aprende-guardado.mp4` desde los 10 s
  sale «Guardado 2 memorias, creado SKILL.md +29 -0» y desde los 12 s la tarjeta `SKILL.md Deshacer +29 -0` (y entre medio las lineas «Creando
  SKILL.md / MEMORY.md»): se muestran los **primeros 1,9 s** (la persona dice «sí guardalo así») y, **desde los 13,2 s, una ventana de 48 px de alto
  (y = 189 a 237)** que deja solo el renglon «Listo, la dejé guardada como «parte-fin-de-turno»…». Esa escena no muestra la espera acelerada.

## Control mirado (`control_unico\`)

Segunda pasada (con todos los cambios): `hoja_cada_2s_01…07.jpg` (un cuadro cada 2 s de los 3:59 enteros; se leyeron la 2 a la 6, que son
todas las escenas con cambios o con grabaciones; la 1 y la 7 son apertura, menu, botones, carpeta y placa final, sin cambios de imagen),
`hoja_mail_cada_0.5s_01…02.jpg` (147 a 166 s) y `hoja_ensenar_cada_0.5s_01…02.jpg` (174,5 a 187 s), mas los cuadros por toma y
`hoja_de_contacto.jpg`. Vistos: ninguna tarjeta de archivo, «Deshacer», «+N -0», cartel de permiso ni «Confirmar cambios»; la lamina del
parrafo 7 dice «Cada sector tiene sus preguntas»; la lamina «Claude no hace esto solo» tiene los tres renglones; los subtitulos coinciden con la
voz y ninguno nombra el correo; sin texto cortado ni lamina «FALTA LA TOMA»; la ruta `Y:\BARACK\CALIDAD\...` sigue visible en la «Fuente» de los sectores
(decidido antes); la placa final lleva el credito de la voz.
OCR con `ayudas_video\buscar_tarjetas.py` (Tesseract; probado contra las grabaciones originales: encuentra «mail_borrador», «+7 -0», «Deshacer», «SKILL.md», «+29»):
primera version del video, 0 hallazgos en el mail (147-166 s), en ensenar (174-187 s) y en todo el video (un cuadro cada 3 s). **Version final (3:59,7): 0 hallazgos** en los 80 cuadros de 147 a 187 s (uno cada 0,5 s: mail, presentacion y ensenar); el barrido de todo el video cada 3 s no se repitio con la version final (las otras escenas no cambiaron de imagen).
Avisos del programa: la primera toma de Calidad va a 0,26x (la respuesta que se escribe sale en camara lenta, 1,4 s de grabacion en 5,6 s) y la camara
de la presentacion se corre adentro de la grabacion (igual que en el tutorial).

## Lo que queda

- Oirlo entero: nadie lo oyo (solo Whisper). Las palabras dudosas de arriba son lo primero.
- Para repetir una frase: `reparar.py "P:F" --mejor-de 6` (por ejemplo `"10:4"`), despues `transcribir.py --partes narracion.txt --solo P` y volver a armar.
- El video viejo «por sector» y el tutorial v3 siguen donde estaban; `narracion_completa.mp3` de `voz_unico` es de antes de los ultimos cambios
  (no se usa para armar el video: el programa lee `partes\NN.wav`).
