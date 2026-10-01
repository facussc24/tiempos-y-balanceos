---
name: lamina-de-proceso
description: Lámina A3 con fotos del proceso de fabricación de una pieza, para un cliente o para gente que no es de proceso (Costos de VW, dirección) — una tarjeta por paso con su foto, la pieza que sale y el uso de material por pieza. Usar cuando pidan "el proceso con fotos", "una lámina / infografía del proceso", "que costos entienda cómo se hace", o cuando llegue un PowerPoint con fotos sueltas de cada operación. No es el flujograma I-IN-002/III (ese es el skill `flujogramas`) ni una hoja de proceso para el operario (skill `hojas-de-proceso`).
---

# Lámina de proceso con fotos

Armado el 01/10/2026 con el Insert Patagonia (pedido de Carlos Baptista para Costos de VW).
Motor y ejemplo en `scripts/lamina_proceso/`; el caso entero está en
`exports/LAMINA_PROCESO_INSERT_20261001/` (datos, fotos elegidas y las dos investigaciones).

## 1. La regla de diseño (lo que Fak corrigió)

La primera versión ponía las tres ramas en tres filas y el armado repartido: el 3 saltaba al 9 y
dos flechas subían. Fak: *"es medio confuso… me marea… pensé que iba a respetar un patrón, hacia
la derecha avanza"*. Y cuando le pregunté qué números lo mareaban: *"no me podés preguntar estas
cosas, simplemente debés saber hacerlas"*. **El diseño no se pregunta: se decide con estas reglas.**

1. **Todo avanza hacia la derecha.** Ninguna flecha sube ni vuelve. Las únicas verticales son las
   bajadas cortas de una franja a la siguiente.
2. **La numeración va de corrido en el orden en que se lee** (izquierda a derecha, de arriba a abajo).
   Si para leer 1, 2, 3… hay que saltar de fila, el armado está mal.
3. **Proceso con ramas que se juntan = dos franjas.** Arriba, los componentes uno al lado del otro,
   cada uno en su banda de color (vinilo 1-2-3 · sustrato 4 · espuma 5-6). Abajo, el armado
   (7-8-9-10) y la pieza terminada al final, a la derecha. La unión no se dibuja con flechas que
   cruzan: se marca con pastillas de color en la tarjeta donde se juntan ("Sustrato + Espuma").
4. Máximo 3 componentes y unos 12 pasos por hoja. Con más, dos láminas (componentes / armado).
5. Una tarjeta = número, título, foto de la máquina o el puesto, la pieza que sale, y el dato.
   Nada de párrafos. El dato de costos ("USO POR PIEZA") va en una tira al pie de la tarjeta.
6. Colores de Barack (azul del logo `004E98`), fondo claro, fotos grandes. Sin marcas de IA, sin
   notas explicativas, sin metadatos de python-pptx (el armado ya pone autor y título).

Las 15 reglas con sus fuentes: `_trabajo/investigacion_layout.md` del caso Insert.

## 2. De dónde sale cada cosa

| Qué | Fuente | Ojo |
|---|---|---|
| Los pasos y sus nombres | El pedido (el PowerPoint o mail de quien lo pide) cotejado con el flujograma de la pieza (`tools/flowchart/data/`) | No se agrega una operación que ningún documento respalda |
| Fotos de máquina | Presentaciones ya hechas para el cliente (LSR), HO del servidor, biblioteca `5- VIDEOS Y FOTOS` | Ver §3: qué NO se usa |
| Fotos de pieza | Las que manda el que pide | Se recortan del fondo, no se redibujan |
| Uso por pieza | Export de relaciones del arb del día (`.arb-cache/RELACIONES_*.TXT`) + planilla `USOS` del legajo (`13-Especificaciones de Ingenieria F\02 -Computo…\USOS`) | "Usos" = consumo de material por pieza. Los m² de vinilo y espuma son consumo de tizada (con demasía), no superficie de la pieza |

Un material que el arb carga en una sola línea para dos pasos (el adhesivo) va **una sola vez**,
con la aclaración "(incluye el paso N)": repetido en los dos, costos lo suma dos veces.

## 3. Fotos: qué se descarta sin discutir

- **Hechas o retocadas con IA** (estrellita de Gemini abajo a la derecha): las de Hot Press, virolado
  e Insert sobre blanco de la HO-990 y la HO215 lo son. No se presentan como fotos de planta.
- **De catálogo o de feria** (la costura CNC del fabricante, la inyectora con gente con credencial).
- **De otra pieza o de otro proyecto** mostradas como de este (Taos, P703, Amarok).
- **Con personas de frente, objetos personales o marcas ajenas**: se recorta o se cambia.
- Si no hay foto real de un puesto, la tarjeta va solo con la pieza y se le dice a Fak cuál falta.

Mejora permitida (no redibuja nada): luz, color, nitidez, recorte y sacar el fondo de la pieza.

```bash
# con el entorno .venv-fotos (rembg + opencv; los modelos quedan en scripts/lamina_proceso/modelos)
.venv-fotos/Scripts/python.exe scripts/lamina_proceso/mejorar_foto.py pieza   <foto> <salida.png> --x 3
.venv-fotos/Scripts/python.exe scripts/lamina_proceso/mejorar_foto.py maquina <foto> <salida.jpg> --x 2 --sin-enderezar
python scripts/lamina_proceso/contacto.py <carpeta> <plancha.png>     # para MIRAR las candidatas
```

`pieza` tarda de 30 a 90 s por foto en esta notebook. El agrandado con redes pesadas (EDSR) no
sirve acá; el enderezado automático tampoco (`--sin-enderezar`).

## 4. Armar

La lámina de cada pieza es un archivo corto que importa el motor y dice qué tarjeta va dónde:
copiar `scripts/lamina_proceso/insert_patagonia.py` y cambiar pasos, bandas y fotos.

```bash
python scripts/lamina_proceso/insert_patagonia.py <salida.pptx> <carpeta de datos>
python scripts/lamina_proceso/exportar.py <salida.pptx> <control.png>      # PowerPoint → PNG a 300 dpi
python scripts/lamina_proceso/png_a_pdf.py <control.png> <salida.pdf>      # PDF A3
```

La carpeta de datos trae `fotos.json` (qué foto va en cada paso; `<clave>_op` admite `recorte`,
`foco`, `rotar`, `corte_abajo`), `usos.json` (los renglones de cada recuadro, con `_fuente`) y las fotos.

- **El PDF sale del PNG, no de PowerPoint**: su exportación baja las fotos a 200 ppp y las comprime.
- El PowerPoint queda editable: para cambiar una foto alcanza con "Cambiar imagen".

## 5. Antes de entregar

1. Mirar la hoja entera y por zonas a 300 dpi (no alcanza con que el script termine).
2. Dos revisiones independientes en paralelo (agentes `investigador`), sin pasarles mis cuentas:
   una de **números** (cada valor contra el arb y la planilla, los 16 códigos y no uno) y una
   **visual** (texto chico o pisado, fotos que dejan mal a la planta, y que cuente en tres
   renglones qué proceso entiende mirando solo la lámina). Lo que encuentren se verifica y se aplica.
3. Hoja de respaldo interna con los usos, la captura de la planilla y los renglones del arb
   (`insert_patagonia_respaldo.py`): Fak tiene que poder decir de dónde salió cada número. No va al cliente.
4. Entrega: PowerPoint editable + PDF A3 + respaldo, en
   `1- GENERAL\FORMATOS GENERAL\PRESENTACION VW\<PIEZA Y PROYECTO>\` de la biblioteca de Ingeniería,
   y los tres archivos mandados al chat con la imagen de la hoja.
5. Decirle a Fak, en pocos renglones, qué fotos convendría volver a sacar y cualquier valor del arb
   que se vea raro al lado de otro (en el Insert: la cinta de la espuma, 0,101 m² también en el trasero).
