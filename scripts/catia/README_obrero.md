# Obrero de CATIA (notebook que trabaja sola)

Pedido de Fak, 23/10/2026 14:25-14:30: «puedo dejar una notebook gamer y vos en paralelo vas resolviendo otras cosas...
me gusta la idea». Una notebook con CATIA V5 corre `obrero.py` sin nadie adelante; la PC principal le deja trabajo en la
nube y lee lo que vuelve.

## Carpetas (todo adentro de `...\viernes-23-plan-sistema\COLA 3D\`)

| Carpeta | Quién escribe | Qué hay |
|---|---|---|
| `asignados\` | SOLO la principal | `<item>-<NOMBRE-PC>.txt`, JSON `{"item", "ejercicio", "instrucciones", "asignado"}` |
| `<NOMBRE-PC>\` | SOLO la notebook | `resultado-<item>.txt`, `<item>\` (STEP, BMP, PNG, `salida.json`), `latido.json`, `obrero.log` |
| `obrero\` | la principal (con `armar_obrero.py`) | este paquete: `obrero.py`, `catia_base.py`, `ejercicios\`, `Arrancar-obrero.cmd`, `LEEME.txt`, `requisitos.txt` |

- `<NOMBRE-PC>` = `socket.gethostname()` en mayúsculas (el que figura en `latido.json` → `hostname`). Puede tener guiones:
  el ítem es lo que queda al sacar el final `-<NOMBRE-PC>.txt`. El ítem solo lleva letras, números, `_`, `.` y `-`.
- El obrero nunca renombra ni borra nada en `asignados\`: un ítem está hecho cuando existe su `resultado-<item>.txt`.
  Para volver a correr un ítem, la principal le asigna un ítem nuevo (otro nombre).
- No toma un asignado modificado hace menos de 90 s (puede estar a medio sincronizar) y reintenta la lectura 3 veces.
  Si el JSON sigue roto, deja `resultado-<item>.txt` con `"estado": "error"` y sigue.
- Si el asignado trae `"hostname"` y no es el de esta PC, no lo toma.

## Ciclo

1. Cada 60 s lista `asignados\`, ordena por nombre y toma el primero pendiente de esta PC (de a uno).
2. RAM libre (psutil si está; si no, `GlobalMemoryStatusEx`): con menos de 0,8 GB (`--ram-min-gb`; Fak 23/10/2026: «si hay 1 gb libre se hace con eso»; CATA midió 0,9 a 2,0 GB libres), o si no se pudo medir, espera.
3. Si el ejercicio usa CATIA (`ejercicios\<id>\ejercicio.json` → `usa_catia`, si falta se toma que sí) y hay cualquier
   CATIA abierta (`CNEXT.exe`), no corre: espera a que se cierre. Nunca toca una CATIA que no arrancó la corrida.
4. Corre `python -u -B ejercicios\<id>\catia.py <trabajo>` con `<trabajo>` = `%LOCALAPPDATA%\obrero_catia\trabajo\<item>__<fecha>__<intento>`
   (local, fuera de la nube) y `CATIA_TRABAJO=<trabajo>`; 20 min como mucho (lo corta). Salida y errores a archivos.
5. Después de cada corrida con CATIA: si quedó abierta la de esa corrida (pid + hora de arranque de
   `<trabajo>\mi_catia.json`, y es la única), la cierra; cualquier otra, no.
6. Código 3 (CATIA no arrancó o no conectó): reintenta hasta 3 veces, 30 s entre intentos; después, resultado con error.
   Código 4 (CATIA ajena): queda pendiente. Otro código: resultado con error y las últimas 40 líneas de stderr.
7. Copia a `<NOMBRE-PC>\<item>\` lo que el ejercicio declaró en `salida.json → archivos` (solo de adentro de su carpeta de
   trabajo; .stp .step .stl .bmp .png .jpg .pdf .json .txt .csv; hasta 50 MB) y escribe `resultado-<item>.txt` al final.
8. `latido.json` al arrancar, al empezar y terminar cada ítem y cada 15 min (también durante una corrida y mientras
   espera RAM): hora, ítem en curso, estado, RAM libre, CATIA abierta sí/no, versión del obrero.

Un solo obrero por PC (candado en `%LOCALAPPDATA%\obrero_catia\obrero.lock`). Todo lo que pasa va a `obrero.log`
(en la nube y una copia local). Ninguna falla de la nube lo tumba: reintenta y sigue.

## Contrato de un ejercicio (`ejercicios\<id>\catia.py <trabajo>`)

- Lee `<trabajo>\asignado.json` (el asignado tal cual).
- Escribe `<trabajo>\salida.json`: `{"ok": true|false, "error": "...", "medidas"/"volumen_catia": {...}, "archivos": [rutas relativas a <trabajo>]}`.
- Si usa CATIA: `os.environ["CATIA_TRABAJO"] = <trabajo>` ANTES de `import catia_base`, `catia_base.conectar()`, y
  `catia_base.apagar(c)` en el `finally`. Sale con 0 (terminó), 3 (CATIA no arrancó), 4 (CATIA ajena) u otro (error).
- `ejercicio.json`: `{"usa_catia": true|false, "descripcion": "..."}`.

| Ejercicio | Qué hace | Probado |
|---|---|---|
| `00_prueba_sin_catia` | Cuenta trivial (caja 60×40×20 = 48 000 mm³), PNG de 100×100 sin bibliotecas y diagnóstico: ¿pywin32 importa? ¿la clase COM `CATIA.Application` está registrada? No abre CATIA. | Sí, en seco (23/10) |
| `04_nido_holgura` | Pieza 60×40×20 y nido 100×80×25 con bolsillo 60,4×40,4×15 (0,2 de luz por lado) de `evals/banco3d/ejercicios/04_nido_holgura/_conjunto.py`, en CATIA Part Design (pad desde XY, plano desplazado + vaciado, sentido controlado con el centro de gravedad). Todo 10 mm más arriba que en build123d. Volumen y centro de gravedad de cada uno, STEP y BMP. Esperado por cuenta: pieza 48 000, nido 163 397,6 mm³. | Sí, en la R21 de la PC principal (23/10, juez): = build123d (se escribió antes de poder correrlo; el encabezado ya lo dice) |
| `03_apoyo_321` | Placa 200×120×10 y los 6 pernos R5×20 del 3-2-1 (`_conjunto.py` del 03) en las MISMAS coordenadas que build123d; pernos en un cuerpo, tres extrusiones (XY, ZX, YZ) hacia afuera, sentido por el centro de lo agregado. | Sí, R21 23/10: = build123d |
| `05_canto_vivo` | Mango 100×30×20 centrado, 2 agujeros de 8 pasantes, R1,5 en todas las aristas en DOS pasos (4 verticales; después contorno con propagación + bordes de los agujeros). | Sí, R21 23/10: = build123d |
| `06_palanca_0_60` | Base, soporte del eje y palanca (cubo R15 + barra 150×20×20) en la pose de 0°, cada una en su CATPart; la palanca con extrusiones simétricas desde ZX. | Sí, R21 23/10: = build123d |
| `07_tool_block_examen` | Tool Block del examen de muestra CATIA V5 Associate (preguntas 3 a 6 = ejercicio 13 del banco), una CATPart por pregunta reconstruida con sus A, B, C y corrida i×150 en x como el STEP de `bien.py`; croquis de `perfil_2d.py` (la cuenta de `_tool_block.py` en Python puro), todas las extrusiones simétricas desde un plano y cada una medida contra la cuenta; material Steel del catálogo y masa de CATIA (SPA Inertias) contra la lámina 12 (1 g). `correr_ejercicio` recibe el id del BANCO (`13_examen_catia_associate`); las partes de build123d se renombran a q3..q6 adentro de `construir`. Prueba sin CATIA: `tests/test_tool_block_07.py`. | Sí, R21 de la PC principal 24/10 05:05 (una corrida, `_catia_env`): 32 pasos sin falla, volumen = build123d (0,000 mm³), cdg a ≤ 0,0006 mm, Steel 7 860 kg/m³, masa a ≤ 0,004 g de la lámina 12 |
| `08_c_clamp_base` (CATA) | Too Tall Toby PPP01-03 C Clamp Base (ejercicio 14 del banco) en Part Design: U de perfil en ZX con los R18 y R7 como arcos del croquis, topes R8 desde planos paralelos a YZ (posición leída con `GetPlane`), avellanado con el Hole del ej33, Aluminium del catálogo pasado a 2 700 kg/m³ por su parámetro `Density`; masa de CATIA contra la guía (96,13 g ± 1). Prueba sin CATIA: `tests/test_c_clamp_base_08.py`. Lecciones: `ejercicios/08_c_clamp_base/LECCIONES.md` (centralizadas en `LECCIONES_CATIA.md`). | Sí, R21 de CATA 24/10 09:25: 9 pasos sin falla en 30 s, 35 605,547 mm³ = build123d, cdg a 0,0003 mm, masa 96,135 g |
| `09_paste_sleeve_gsd` | Too Tall Toby PPP01-05 Paste Sleeve (ejercicio 15 del banco) por SUPERFICIES (GSD): pad del tramo recto, transición reglada con loft vértice a vértice + Fill + Join (0,01, `Invert`) + CloseSurface, hueco en un segundo cuerpo restado con Remove; cada operación medida contra una cuenta de Simpson en Python puro. Masa (volumen × 1 020 kg/m³ del rótulo) contra la guía (57,08 g ± 1), área de la piel contra build123d (0,01 %), STEP de CATIA con 1 sólido / 1 cáscara / 0 caras sueltas, y el STL de CATIA cerrado, con la orientación de los triángulos consistente y sin cuerpos negativos (`juez_comun.veredicto_stl`: las caras hacia adentro no las ve el volumen de CATIA). `medir_b123d.py` mide además área, cáscaras, caras sueltas y STL. Prueba sin CATIA: `tests/test_paste_sleeve_09.py`. | Sí, R21 de la PC principal 24/10 09:18 (`_catia_env`): 19 pasos sin falla, volumen −0,004 mm³ de build123d, cdg a 0,0004 mm, área −3e-8, masa 56,73 g (−0,35 de la guía: lectura (a) de la pared), STEP 1/1/0, STL cerrado a −0,24 % |
| `11_tool_block_parametrico` | El Tool Block del examen (preguntas 3 y 4) como UNA pieza PARAMÉTRICA: parámetros A, B, C; el croquis de la lámina 04 declarado en una tabla (18 puntos, 11 rectas, 3 arcos, el agujero, 34 restricciones: tangencias, puntos sobre rectas, ángulo, distancias a los ejes y 8 fórmulas sobre A y B) y totalmente restringido; pad de largo C (fórmula). Se construye la q3 y se cambian SOLO los parámetros a la q4: CATIA regenera. Steel y masa de CATIA contra la lámina 12 (con la coherencia masa/volumen/densidad); cruce con bien.py del 13 (la q4 de bien.py está corrida 150 en x: el cdg se corre y el crudo queda en salida.json). Prueba sin CATIA: `tests/test_tool_block_parametrico_11.py`, con el solver simulado (rango 40 de 40, y la q3 llevada a la q4 por Newton da perfil_2d). | Sí, R21 de la PC principal 24/10 09:28 (`_catia_env`): 10 pasos sin falla, 34 restricciones resueltas antes y después del cambio, volumen = build123d (0,000 mm³) en las dos, cdg a ≤ 0,0006 mm, masas a 0,002 y 0,004 g de la lámina 12 |
| `13_superficies_exactas` | SUPERFICIES (GSD) contra fórmulas exactas, sin `bien.py` (`correr_ejercicio(..., con_bien=False)`: el ok queda en falso hasta que el post-proceso compara): tronco de cono por revolución y por multi-sección (macro VBScript), tapas con Fill, Join + CloseSurface, tubo barrido (Pappus), media esfera y toro por revolución (nuevos), cilindro extruido, offset, split, thicksurface y empalme bitangente; cada lado elegido por la medida probando TODOS (el otro lado medido queda como gemelo) y borrando siempre lo probado. STEP de cada pieza 1/1/0 y con el volumen de su fórmula; STL con `veredicto_stl`. Prueba sin CATIA: `tests/test_superficies_13.py`, `tests/test_juez_sin_bien.py`, `tests/test_medir_stl.py` (el detector de caras dadas vuelta con mallas de verdad). | Sí, R21 de la PC principal 24/10 09:59 (`_catia_env`): 22 pasos sin falla en 83 s, las 13 medidas a < 1e-6 de su fórmula, STEP 1/1/0 en las dos piezas, STL cerrados y orientados (facetado −1,2 %) |

Los ejercicios 03, 05 y 06 importan `juez_comun.py` (por eso `armar_obrero.py` lo copia junto con `medir_b123d.py`). En la
notebook no hay `.venv-cad`: corren igual, pero sin build123d la salida queda con `ok: false` y el motivo («no está el
entorno CAD»); la comparación la hace la PC principal.

`de_build123d.py` (convierte el contorno de una cara de build123d a tramos de croquis) no entra en el paquete: necesita
build123d y la notebook no lo tiene; para rectángulos alcanza `catia_base.poligono`.

## Armar, probar

```
python scripts/catia/armar_obrero.py --destino "<...>\viernes-23-plan-sistema\COLA 3D\obrero"
C:/Dev/BarackMercosul/.venv-cad/Scripts/python.exe -I -m unittest discover -s scripts/catia/tests
python scripts/catia/obrero.py --cola <carpeta temporal> --hostname PRUEBA --una-vuelta --edad-min-seg 0
```

`armar_obrero.py` nunca borra en el destino y no reescribe un archivo que ya está igual (no toca el `.cmd` que corre).
`catia_base.py` es copia de `C:\Dev\_catia_practica\catia_base.py` (base del 19/10) con los cambios anotados arriba de todo.

## CATIA como segundo juez (23/10/2026, ítem 5f)

Pedido de Fak: «sin catia no vas a poder aprender a usar catia». Decisión: de noche, en la PC principal, con la CATIA de
Fak cerrada. CATIA rehace la pieza BIEN de cada ejercicio del banco 3D y su volumen se compara con el de build123d
medido sobre el MISMO `bien.py`.

```
C:\Dev\_catia_env\Scripts\python.exe scripts\catia\juez.py <carpeta fuera del repo>
```

- `juez.py` corre uno por vez `ejercicios\<ej>\catia.py <carpeta>\<ej>` para 04, 03, 05 y 06. Antes de cada uno no puede
  haber ninguna CATIA (si hay, espera 5 min sin tocarla y frena); tope de 10 min por ejercicio (corta y cierra SOLO la
  CATIA de esa corrida, por pid + hora de arranque); después espera que no quede ninguna. Deja `<carpeta>\juez.json` con el
  cuadro, el detalle por parte, CNEXT antes y después de cada ejercicio y las rutas de los STEP y BMP.
- `juez_comun.py`: esqueleto de los `catia.py` nuevos y ayudas de Part Design (croquis con rectángulos y círculos en
  coordenadas del plano, plano desplazado, extrusión con el sentido MEDIDO por el centro de lo agregado, ocultar, captura
  BMP). `medir_b123d.py` (con `.venv-cad`): corre el `bien.py` y mide el STEP de cada parte; también mide el STEP que
  exportó CATIA (tercer cruce).
- Cada `catia.py` deja `salida.json` con `volumen_catia`, `cdg_catia_mm`, `volumen_build123d`, `cdg_build123d_mm`,
  `diferencia_mm3` y `dif_cdg_mm` por parte, y un STEP y una captura BMP por parte. ok = todos los pasos en CATIA sin falla,
  |volumen CATIA − build123d| ≤ 0,5 mm³ y centros de gravedad a ≤ 0,01 mm en cada parte (tolerancias del juez, del banco,
  sin fuente de Barack).

**Lo que midió (R21 de esta PC, 23/10 21:22-21:28, CNEXT 0 antes y después de cada ejercicio):**

| Ejercicio | Partes | build123d (mm³) | CATIA (mm³) | Diferencia | Segundos | ok |
|---|---|---:|---:|---:|---:|---|
| 04_nido_holgura | pieza + nido | 211.397,6 | 211.397,6 | 0,0 | 36,9 | sí |
| 03_apoyo_321 | placa + 6 pernos | 249.424,778 | 249.424,778 | 0,0 | 99,6 | sí |
| 05_canto_vivo | mango R1,5 | 57.651,58 | 57.651,58 | 0,0 | 93,6 | sí |
| 06_palanca_0_60 | base + soporte + palanca | 478.517,325 | 478.517,325 | 0,0 | 97,0 | sí |

Total 359,4 s; CNEXT 0 al final.

Segundos = la corrida del `catia.py` (en 03, 05 y 06 incluye ~25 s de build123d y ~10 s de medir el STEP de CATIA; en el
04 el juez mide build123d aparte). Diferencia 0,000 mm³ en cada parte; centros de gravedad a ≤ 0,0005 mm.

Lo que se aprendió en la corrida (cuesta un intento cada uno):
- **La topología de un vaciado trae solo las aristas que creó** (los 4 bordes de los agujeros): las aristas de la barra se
  buscan en el pad. Primer intento del 05: «aristas verticales: 0 (de 4 aristas)».
- **La extrusión simétrica (`IsSymmetric`) toma el largo por lado**: largo 10 → 20 de espesor (06 y 05, medido).
- **Croquis en ZX e YZ**: con los ejes de catia.md (ZX: H→Z, V→X; YZ: H→Y, V→Z) los pernos y la palanca cayeron donde
  build123d; los pads desde ZX e YZ crecen hacia +Y y +X (los 3 grupos de pernos se invirtieron, control por el centro de
  lo agregado).
- **Redondeo en dos pasos** (4 verticales; después una arista de arriba y una de abajo con propagación 1 más los 4 bordes de
  los agujeros): 57.651,58 = build123d, la esquina esférica.

### Lo que CATIA tiene y build123d no

| Qué | Probado antes (fuente) | Usado hoy en el juez | Qué haría falta para usarlo |
|---|---|---|---|
| Superficies GSD (transición, relleno, unir con desviación, cerrar, espesor, reparar) | Sí: TTT Paste Sleeve, ej51/52 a menos de 0,0001 % (`.claude/skills/cad-design/reference/catia.md` l.116, 187, 297) | Nada | Un ejercicio del banco con una piel curva real (el tapizado de un STEP de cliente, con sha256) y su respuesta; medir área y espesor en CATIA contra build123d |
| DMU / cinemática (KIN) | Biela-manivela con 3 revoluciones + 1 prismática por macro, exacta en 6 ángulos (catia.md l.251); sobre un mecanismo real «queda para probar» (catia.md l.526). El choque `Clashes` no distingue 0,3 mm (catia.md l.119) | Nada | El 06 como ensamble (base + soporte + palanca) con una junta de revolución y el comando de 0 a 60°; en cada pose, choque exacto con `AddNewIntersect` (no `Clashes`) y la luz con una medición de distancia (sin probar) |
| Planos / Drafting | Sí: vistas, cortes, cotas desde el croquis, PDF (catia.md l.121, 270) | Nada | Croquis ACOTADOS (hoy se dibujan por coordenadas: sin cotas no hay `GenerateDimensions`) y un plano por pieza del banco comparado contra las medidas del `_conjunto.py` |
| Knowledgeware (parámetros, fórmulas, controles) | Sí: parámetros y fórmulas del CSWP (ej27), `CreateCheck("Pared >= 2mm")` en verde y en rojo (ej17; catia.md l.137, 197) | Nada | Las reglas del banco como controles adentro de la pieza (R ≥ 1,5 en el 05, luz 0,2 en el 04) y correr también los `mal_*.py` para ver el rojo |
