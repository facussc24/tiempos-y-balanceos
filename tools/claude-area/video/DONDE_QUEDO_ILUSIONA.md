# Video "por sector" — donde quedo (02/10/2026, corte por apagado)

Salida prevista: `exports\CLAUDES_POR_AREA_20261001\Video por sector - Claude en Barack.mp4` (+ .srt). Tope 2:30.
**Todavia NO esta armado.** Lo que hay es la voz (primer pasada), los recortes de cada sector y `escenas_ilusiona.json`.

## Estado de la voz (`exports\CLAUDES_POR_AREA_20261001\fuentes\voz_ilusiona\`)

Los 14 parrafos estan grabados (`partes\01..14.wav` + `.json` con los tiempos por palabra). Dura 1:41. Se puede armar asi,
pero con estas palabras mal oidas (control con Whisper, no lo escuche a oido):

| Parrafo | Quedo | Que hay que repetir |
|---|---|---|
| 1, 2, 5, 8, 10, 11, 12 | bien | nada (2 dice «consecutivas» y el subtitulo «seguidas», como en la v1) |
| 3 Calidad | bien por frase; en el parrafo entero Whisper oye «Caridad» | revisar a oido la primera palabra |
| 4 Logistica | «racks» sale «enrax» y «fila» a veces «fia» | repetir con el selector nuevo (ya lee «2 a 5» como «dos a cinco») |
| 6 Mantenimiento | «el oido» se oye «el video» | **repetir** (DICCION nueva `oi do`); «con la vista» a veces se oye «con la mixta» |
| 7 Recursos Humanos | «como lo dice» se oye «como no dice»; «Recursos» a veces «Recusos» | **repetir** (frase nueva `como ló dice`) |
| 9 Ingenieria | «arb» se oye «arr/arv» (igual que en la v1, ya aprobada); «flujogramas» se oye «flujo ramas» | **repetir** (DICCION nueva `flujo gramas`) |
| 13 Controlado | «No borra nada» se oye «No gobra / No habra nada» | **sin resolver**: probe 15 escrituras («borrra», «bórra», «bo-rra», «bborra»...) y ninguna sale. Lo mejor fue 67 %. Si no se arregla, pedirle a Facundo si se puede decir «No elimina nada» (como la v2) |
| 14 | bien (copia del 18 de la v2) | nada |

Comando (despues de cambiar nada mas, ~15 min):

```
cd C:\Dev\BarackMercosul\exports\CLAUDES_POR_AREA_20261001\fuentes\voz_ilusiona
C:\Dev\BarackMercosul\.venv-audio\Scripts\python.exe narrar.py narracion.txt --solo 4 6 7 9 13 --mejor-de 8 --umbral 0.995
C:\Dev\BarackMercosul\.venv-audio\Scripts\python.exe transcribir.py --partes narracion.txt --solo 4 6 7 9 13
```

## Cambios que hice en `voz_ilusiona\narrar.py` (todavia no usados para grabar)

- Los de la v2: `abierta`→`abierrta`, `él`→`, él`, `decís`→`decís,` y el selector por palabras (`beam 5`).
- Nuevos: `oído`→`oi do` (4 de 4 bien), `flujogramas`→`flujo gramas` (2 de 5), lista `FRASES` con `como lo dice`→`como ló dice`
  (4 de 4 bien), `barack` como comodin, y `letras_a_los_numeros()` para que el selector entienda «2 a 5» = «dos a cinco».
- Sin resolver: `borra` (ver arriba) y `vista` (a veces «mixta»; probar `bista`, `vi sta`: la prueba no termino).

## Estado de `tools\claude-area\video\escenas_ilusiona.json` (14 escenas, sale de `ayudas_video\generar_escenas_ilusiona.py`)

- `--faltan` da «No falta ninguna toma» y sin avisos. Dura ~1:50 con la voz actual.
- Ubicadas y miradas con cuadros: 2 Produccion (la grabacion de las tres piezas), 4 Logistica, 5 Compras, 6 Mantenimiento,
  7 Recursos Humanos, 8 Direccion (cuadros bien; falta ver la 8 despues de subir la vista 1 a y=26).
- **Calidad (3): cambie el recorte despues de mirarla** (`sector-calidad-responde.mp4` nuevo, 176 de alto, sigue los 5 saltos de la
  pantalla). Falta ver sus cuadros: rectangulos en `generar_escenas_ilusiona.py` (R("cal", 16, 60...) y R("cal", 16, 144...)).
- Sin mirar todavia: 1 (apertura), 9 Ingenieria, 10 mail, 11 presentacion, 12 ensenar, 13 controlado, 14 cierre. Usan lo mismo
  que la v2, pero con otros tiempos.
- Todo lo que marca un recuadro depende de la voz: **al regrabar parrafos hay que volver a mirar esos cuadros**.

Comando que sigue, ya con la voz repetida:

```
cd C:\Dev\BarackMercosul\tools\claude-area\video
python armar_video.py --escenas escenas_ilusiona.json --faltan            (tiempos y avisos)
python armar_video.py --escenas escenas_ilusiona.json --cuadros 10,20,30  (cuadros sueltos, van a control_ilusiona\_cuadros)
python armar_video.py --escenas escenas_ilusiona.json                     (arma el MP4 y el control)
```
Despues: un cuadro cada 4 s del MP4 y un barrido cada 0,5 s de las escenas de sector; `armar_video.py` tiene que salir con 0.

## A cuidar en las tomas de sector (privacidad)

- `recortar_sectores_ilusiona.py` saca los recortes de `.sgc-cache\claude-por-area\tomas-crudas\sector-*.mp4` (no se copian al repo).
  Corta: lista de conversaciones, franja de abajo, primer globo («Hola. Antes de empezar...») y el renglon gris «Mensaje recibido de...».
- **Calidad**: el video crudo trae arriba la respuesta de OTRO examen. El recorte arranca en el segundo 6,0 (cuando aparece la segunda
  pregunta) y tapa con el color del fondo lo de arriba y la barra «upbeat-cannon... Confirmar cambios» (y 876-930). Si se toca
  `ts`, `tops` o `tapar`, mirar el cuadro 0 y el 1,5 de ese recorte: antes del segundo 5,75 se ve la respuesta ajena.
- **Recursos Humanos**: arranca en «El tramite, segun el P-18» (el parrafo de «otra sesion de Claude» queda afuera).
- **Direccion**: el borde de arriba corta una linea a medias a partir del segundo 46,95 del crudo; hay una franja que la tapa.
- En las respuestas se ve la ruta del servidor `Y:\BARACK\CALIDAD\DOCUMENTACION SGC\...` (la dice Claude en la «Fuente»). No lleva
  usuario de la PC; si Facundo la quiere afuera, hay que tapar esa parte en cada recorte.
- La pregunta de cada sector va como cartel arriba (`pregunta` en la toma), con las palabras de la narracion.
- Documento marcado en cada sector (de `.sgc-cache\claude-por-area\examen\sectores_respuestas_v3.md`): Produccion P-09.1 rev B.1,
  Calidad I-AC-010 rev A §5.3, Logistica I-LG-010 rev A §5, Compras I-CO-001 rev A §5.1.1, Mantenimiento I-MT-001 rev C §5.6,
  RRHH P-18 rev F §5.4 a §5.7, Direccion MC-09 rev F §9.3.2 (el «manual de calidad» de la narracion).

## Otras cosas
- `armar_video.py` ahora tiene: `tramos` en las grabaciones, `camara` (acercamiento y desplazamiento, con `alto` para vistas bajas),
  `pregunta` (cartel), `mas` (corre un instante), tope de duracion por `ajustes` y carpeta de control propia por version.
  La v1 se probo igual que antes (`--faltan` = 0, tabla identica, cuadros identicos).
- Los ayudantes (`ayudas_video\`) miden los saltos de pantalla (`medir_pasos.py`), sacan un cuadro con grilla (`grilla_clip.py`) y
  prueban como suena una escritura (`probar_multi.py`, usa el entorno `.venv-audio`).
- Version 2 del tutorial: terminada (ver el informe), `Video tutorial - Claude en Barack (version 2).mp4`.
