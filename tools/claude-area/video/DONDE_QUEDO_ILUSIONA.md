# Video "por sector" — donde quedo (02/10/2026, noche)

**Armado.** `exports\CLAUDES_POR_AREA_20261001\Video por sector - Claude en Barack.mp4` (+ `.srt`), 2:03,1 (tope 2:30).
`armar_video.py --escenas escenas_ilusiona.json` sale con 0 y el control tecnico da todo OK. Control mirado: un cuadro cada 4 s
del MP4 entero y un barrido cada 0,5 s de los 14 sectores/escenas (privacidad, documento marcado, cartel de la pregunta).

Para volver a armarlo: `cd C:\Dev\BarackMercosul\tools\claude-area\video` y `python armar_video.py --escenas escenas_ilusiona.json`
(tarda ~7 min). Cuadros sueltos: `... --cuadros 10,20,30` (van a `control_ilusiona\_cuadros`). Las escenas salen de
`ayudas_video\generar_escenas_ilusiona.py` (se corre desde donde este y reescribe `escenas_ilusiona.json`; hoy tiene la ruta del
cuaderno de trabajo adentro: si se mueve, cambiar `VID`).

## La voz (`exports\CLAUDES_POR_AREA_20261001\fuentes\voz_ilusiona\`)

14 parrafos grabados, 1:44. El 13 dice «No borra nada si no se lo pedís» desde el 03/10
(antes «No elimina nada»: el tutorial dice que borra si se lo piden, que es lo que deja pasar el control `pc-guard`). Se grabo SOLO esa frase y se empalmo: las
otras cuatro del parrafo son las tomas de antes, muestra por muestra (`empalmar_13.py`, en la carpeta de la voz; lo anterior quedo
ahi mismo, en `anterior_03-10_parrafo13_no_elimina_nada`). El parrafo paso de 9,14 a 9,75 s y el video de 2:02,5 a 2:03,1.
Control con Whisper (no se escucho a oido). Con una palabra dudosa:

| Parrafo | Palabra | Que se oye | Que se probo |
|---|---|---|---|
| 4 Logistica | — | bien | 03/10: la frase paso a «De dos a cinco por fila, según la altura.» (sin «racks»); Whisper la oye entera |
| 7 RRHH | — | bien, 100 % | 03/10: «Me piden una capacitación. ¿Cómo sigue el trámite?» (mas cerca de la pregunta real); el cartel dice lo mismo |
| 6 Mantenimiento | — | bien, 100 % | 03/10: «lo que se ve, lo que se oye, lo que se huele y lo que se toca»; los recuadros van con `ve`, `oye`, `huele`, `toca` |
| 9 Ingenieria | «arb» | «art» | igual que la v1 ya aprobada |
| 9 Ingenieria | «flujogramas» | bien con `flujo gramas` | — |
| 3 Calidad | «Calidad.» | en el parrafo entero Whisper oye «Caridad» | por frase sale bien |

Si Facundo oye mal alguna, se repite solo ese parrafo:
`cd ...\voz_ilusiona` y `...\.venv-audio\Scripts\python.exe narrar.py narracion.txt --solo 4 --mejor-de 8 --umbral 0.995`, despues
`transcribir.py --partes narracion.txt --solo 4` y volver a armar el MP4 (los recuadros dependen de las palabras de la voz).

Cambios en `voz_ilusiona\narrar.py`: los de la v2 (`abierta`, `él`, `decís`, selector por palabras) mas `oído`→`oi do`,
`flujogramas`→`flujo gramas`, la lista `FRASES` (`como lo dice`→`como ló dice`), `barack` como comodin y `letras_a_los_numeros()`
(el selector entiende «2 a 5» como «dos a cinco»).

## Escenas (`escenas_ilusiona.json`, 14)

1 apertura (documentos que suben + foto de pregunta) · 2 Produccion (grabacion de las tres piezas, P-09.1) · 3 Calidad (I-AC-010) ·
4 Logistica (I-LG-010) · 5 Compras (I-CO-001) · 6 Mantenimiento (I-MT-001) · 7 RRHH (P-18) · 8 Direccion (MC-09) · 9 Ingenieria (arb,
mas hoja de operaciones, lamina y flujograma) · 10 mail · 11 presentacion · 12 ensenar una tarea · 13 controlado (fuente marcada,
lamina «No borra nada si no se lo pedís / No muestra lo reservado», la conversacion del mail con «mandalo» marcado) · 14 cierre.
03/10: la ultima toma de la 13 era el cartel de permiso; con «Omitir permisos» en todas las PC ese cartel ya no aparece y se cambio
por la grabacion real `tomas\demo-02oct-mail-listo.mp4` (misma voz, mismos tiempos). El video anterior quedo en
`versiones anteriores (no mostrar)\Video por sector - Claude en Barack (hasta 03-10, con el cartel de permiso).mp4`.
Todas estan ubicadas y miradas con cuadros.

## A cuidar (privacidad)

- `recortar_sectores_ilusiona.py` saca los recortes `tomas\sector-*.mp4` de `.sgc-cache\claude-por-area\tomas-crudas\sector-*.mp4`
  (las crudas no van al repo). Corta la lista de conversaciones, la franja de abajo, el primer globo y el renglon gris
  «Mensaje recibido de» / «Recibido un mensaje». Se comprobo en los 7 recortes, cuadro por cuadro (30 por segundo), que ese renglon
  no aparece (parecido con la plantilla 14,7 a 15,8; cuando esta, da menos de 2).
- **Calidad**: la grabacion cruda trae arriba la respuesta de otro examen; el recorte empieza en el segundo 6,0 y tapa con el color
  del fondo lo de arriba y la barra «Confirmar cambios». Si se toca `ts`, `tops` o `tapar` de ese recorte, mirar sus primeros cuadros.
- **RRHH**: arranca en «El tramite, segun el P-18» (el parrafo de «otra sesion de Claude» queda afuera).
- La ruta `Y:\BARACK\CALIDAD\DOCUMENTACION SGC\...` queda visible en la «Fuente» de cada respuesta (no lleva el usuario de la PC; decidido).
- La pregunta de cada sector va como cartel arriba (`pregunta` en la toma), con las palabras de la narracion.

## Otras cosas

- `armar_video.py` ahora tiene: `tramos` y `camara` (acercamiento y desplazamiento) en las grabaciones, `pregunta` (cartel), `mas` (corre
  un instante), tope de duracion por `ajustes`, carpeta de control propia por version y titulos de triptico que se achican si no entran.
  La v1 se probo de nuevo al final: `--faltan` = 0, tabla de tomas identica, cuadros identicos.
- Ayudantes en `ayudas_video\`: `medir_pasos.py` (instante en que salta la pantalla), `grilla_clip.py` (cuadro con cuadricula),
  `probar_multi.py` (como suena una escritura; usa `.venv-audio`), `hoja.py` (hoja de contacto de un video).
- Version 2 del tutorial: terminada, `Video tutorial - Claude en Barack (version 2).mp4` (2:36,8, con el recorte a la columna de texto).
  Desde el 03/10 esta en `versiones anteriores (no mostrar)`: la reemplaza la version 3.
- Version 3 del tutorial (03/10): `Video tutorial - Claude en Barack (version 3).mp4` (2:32,4). Igual que la 2 menos la escena 10: ya no
  muestra el cartel de permiso ni dice «te pide permiso». Dice «No borra archivos ni manda un mail, salvo que se lo pidas con tus
  palabras. En el servidor solo lee: no cambia nada.» y la escena es una sola lamina. Voz en `fuentes\voz_v3` (se regrabaron los
  parrafos 15 y 16), escenas en `escenas_v3.json` (las arma `ayudas_video\generar_escenas_v3.py` desde `escenas_v2.json`).
