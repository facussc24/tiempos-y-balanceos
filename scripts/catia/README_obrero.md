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
| `10_flanged_hub` (CATA) | Too Tall Toby PPP01-07 Flanged Hub (ejercicio 16 del banco): exterior por Shaft con los R3 como arcos del croquis, nervios en CUÑA como prisma (no Stiffener: da espesor parejo) en un plano por ecuación + patrón ×3, Groove del rebaje después de los nervios, 6 agujeros con caja (Hole Type 2 + patrón); masa de CATIA contra la guía (372,99 g ± 1); el centro de lo agregado se lee con todos los decimales (`GetCOG` por VBScript). | Sí, R21 de CATA 24/10 09:26: 13 pasos, 138 144,669 mm³ = build123d, cdg 0,0005 mm, 372,991 g |
| `11_tool_block_parametrico` | El Tool Block del examen (preguntas 3 y 4) como UNA pieza PARAMÉTRICA: parámetros A, B, C; el croquis de la lámina 04 declarado en una tabla (18 puntos, 11 rectas, 3 arcos, el agujero, 34 restricciones: tangencias, puntos sobre rectas, ángulo, distancias a los ejes y 8 fórmulas sobre A y B) y totalmente restringido; pad de largo C (fórmula). Se construye la q3 y se cambian SOLO los parámetros a la q4: CATIA regenera. Steel y masa de CATIA contra la lámina 12 (con la coherencia masa/volumen/densidad); cruce con bien.py del 13 (la q4 de bien.py está corrida 150 en x: el cdg se corre y el crudo queda en salida.json). Prueba sin CATIA: `tests/test_tool_block_parametrico_11.py`, con el solver simulado (rango 40 de 40, y la q3 llevada a la q4 por Newton da perfil_2d). | Sí, R21 de la PC principal 24/10 09:28 (`_catia_env`): 10 pasos sin falla, 34 restricciones resueltas antes y después del cambio, volumen = build123d (0,000 mm³) en las dos, cdg a ≤ 0,0006 mm, masas a 0,002 y 0,004 g de la lámina 12 |
| `12_tool_block_mutantes` (CATA) | Los tres mutantes del Tool Block (el 07 importado entero, salteando una operación): q3 sin el agujero de 14, q5 sin la ranura R41, q6 con el vaciado sin paredes. El juez exige tres cosas: CATIA = el `mal_*.py` (cruce de los tres), ROJO contra la lámina 12 y la masa del mutante. Prueba: `tests/test_tool_block_mutantes_12.py` (gemelo: la pieza buena no la aprueba). | Sí, R21 de CATA 24/10 09:33: CATIA = cada mutante (cdg ≤ 0,0005 mm), rojo en los tres (986,81 / 798,54 / 416,20 g) |
| `13_superficies_exactas` | SUPERFICIES (GSD) contra fórmulas exactas, sin `bien.py` (`correr_ejercicio(..., con_bien=False)`: el ok queda en falso hasta que el post-proceso compara): tronco de cono por revolución y por multi-sección (macro VBScript), tapas con Fill, Join + CloseSurface, tubo barrido (Pappus), media esfera y toro por revolución (nuevos), cilindro extruido, offset, split, thicksurface y empalme bitangente; cada lado elegido por la medida probando TODOS (el otro lado medido queda como gemelo) y borrando siempre lo probado. STEP de cada pieza 1/1/0 y con el volumen de su fórmula; STL con `veredicto_stl`. Prueba sin CATIA: `tests/test_superficies_13.py`, `tests/test_juez_sin_bien.py`, `tests/test_medir_stl.py` (el detector de caras dadas vuelta con mallas de verdad). | Sí, R21 de la PC principal 24/10 09:59 (`_catia_env`): 22 pasos sin falla en 83 s, las 13 medidas a < 1e-6 de su fórmula, STEP 1/1/0 en las dos piezas, STL cerrados y orientados (facetado −1,2 %) |
| `14_reglas_knowledgeware` (CATA) | Las reglas del banco como controles adentro de la pieza: parámetros propios que mueven la geometría (`Radio`, `Redondeado` atado al `Activity` de los redondeos, `Luz` en las cotas del croquis) y `CreateCheck` («Radio >= 1.5mm and Redondeado == true», «Luz >= 0.1mm and Luz <= 0.4mm»); verde con la buena y rojo con los cuatro mutantes del 04 y el 05, cada variante = build123d. | Sí, R21 de CATA 24/10 09:59 |
| `15_plano_tool_block` | Preguntas 1 y 2 del examen de muestra (planos): la q3 paramétrica del 11 en un plano A3 con frente, costado, isométrica, «Recorte» (`DefinePolygonalClippingView` sobre una copia del frente: respuesta b) y «Arranque» (`DefineBreakout` hasta el eje del agujero de 14: respuesta c); cotas con `GenerateDimensions` (trae los radios y el largo C; las distancias a los ejes del croquis no, y la de 10° se borra porque cruza la hoja); PDF medido con `medir_plano.py` (pymupdf): el recorte no pasa de 46 mm de ancho, el arranque tiene 8 trazos o más que el costado (el rayado) y el texto de cada cota esperada está. Prueba sin CATIA: `tests/test_plano_15.py`. | Sí, R21 de la PC principal 24/10 10:25: q3 = build123d, recorte 45 mm (frente 97,7 con cotas), arranque 31 trazos contra 13, cotas 19 / 29 / 5 / 7 / 43 en el PDF |
| `16_palanca_ensamble` (CATA) | La palanca del 06 como ENSAMBLE: soporte y palanca dibujados en su sistema y llevados a la pose por restricciones (dos puntos sobre el eje + paralelismo de planos con su orientación); gemelo con la orientación opuesta (la barra a −X); cdg del conjunto = build123d. | Sí, R21 de CATA 24/10 10:09: 7 restricciones en estado 0, 478 517,325 mm³, cdg = build123d |
| `17_palanca_dmu` | La palanca del 06 con DMU Kinematics: una pieza fija por variante (placa + soporte + el brazo de cada mutante) y la palanca, cada una con su «Eje» y «Plano»; CATProduct con una revolución y un comando de ángulo (macros VBScript, como el ej49). En 0, 35, 50 y 60°: la punta de la palanca contra la trigonometría (signo del comando −1: el eje va hacia +Y y el banco gira alrededor de −Y) y los choques y luces medidos con OpenCASCADE (`medir_choques.py`) sobre los STEP de CATIA movidos con la `Position` del mecanismo; la luz, como el banco, sin el soporte del eje. Respuesta: los chequeos del bien.py y los mal_*.py del 06. Prueba sin CATIA: `tests/test_palanca_dmu_17.py` (lee los chequeos del banco con ast). | Sí, R21 de la PC principal 24/10 10:36: punta a 0,000 mm en las cuatro poses, 12 de 12 chequeos (mal_1 choca 4 491,6 mm³ a 35°, mal_3 562,7 a 60°, mal_2 a 15,0 mm a 50°, la buena libre) |
| `18_cswp_etapa1` (CATA) | CSWP Sample Exam 2 de SolidWorks, etapa 1, PARAMÉTRICA: la pieza del ej27 de la práctica (`pieza_ej27.py`, portada con `portar_ej27.py`), parámetros A..E con X = A/3 e Y = B/3 + 10, las tres respuestas cambiando solo los parámetros; masa de CATIA con Steel a 7 700 kg/m³ (la densidad del examen); gemelo de build123d (`gemelo_b123d.py`). Prueba: `tests/test_cswp_etapa1_18.py`. | Sí, R21 de CATA 24/10 10:15: 14 207,340 / 16 490,467 / 15 100,464 g contra 14 207,34 / 16 490,45 / 15 100,47 |
| `19_cswp_etapa2` | CSWP Sample Exam 2, etapa 2 (preguntas 4 y 5): el ej28 de la práctica (y el ej27 del que importa el croquis) copiado SIN cambios y corrido dentro del juez (`con_bien=False`); las dos masas (volumen × 0,0077) contra el papel a 0,1 g (un chaflán faltante pesa ~1 g) y el STEP de CATIA contra el volumen de CATIA. Prueba: `tests/test_cswp_etapa2_19.py`. | Sí, R21 de la PC principal 24/10 10:49: 13 206,387 y 14 208,004 g contra 13 206,40 y 14 208,00 |
| `22_ttt_post_cap` (CATA) | Too Tall Toby 01-02 Post Cap: la pieza del ej30 copiada con cambios mínimos anotados (`pieza_ej30.py`); masa de CATIA con Steel a 1 020 kg/m³ (el catálogo de la B21 no trae ABS); el gemelo (sin el R1 del asa) se cruza ANTES del R1. | Sí, R21 de CATA 24/10 10:52: 43,093 g contra 43,09 |
| `23_ttt_light_cap` | Too Tall Toby 01-10 Light Cap por la sección de pared: el ej31b de la práctica copiado SIN cambios y corrido dentro del juez; masa contra la guía a 0,1 g (la guía tolera 1 g: sin el R8 faltan 0,49 g), volumen contra el gemelo de build123d de la práctica y el STEP de CATIA. Límite: los planos que el ej31b deja visibles salen al STEP como caras sueltas (no se controla acá). Prueba: `tests/test_light_cap_23.py`. | Sí, R21 de la PC principal 24/10 10:51: 211,303 g (guía 211,30), volumen = gemelo |
| `24_ttt_angle_bracket` (CATA) | Too Tall Toby 01-04 Angle Bracket: el MOLDE de las piezas de afuera de CATA (`portar_ej.py` + `catia.py` con su CFG); el doblez prueba cada arista candidata y controla el volumen del redondeo (el orden de la topología cambia entre corridas). | Sí, R21 de CATA 24/10 10:52: 309,997 g contra 310,00 |
| `25_ttt_bearing_jig` | Too Tall Toby 01-06 Bearing Jig: el ej36 de la práctica (y su croquis.py y contorno JSON) copiado SIN cambios y corrido con `practica_en_juez.py`; masa contra la guía a 0,1 g (la guía tolera 1 g), volumen contra el gemelo de build123d de la práctica, STEP de CATIA. Prueba: `tests/test_practica_en_juez.py`. | Sí, R21 de la PC principal 24/10 11:21: 328,0199 g contra 328,02 |
| `26_ttt_tie_plate` (CATA) | Too Tall Toby 01-08 Tie Plate con el molde del 24. | Sí, R21 de CATA 24/10 10:53: 3 387,058 g contra 3 387,06 |
| `27_ttt_curved_support` | Too Tall Toby 23-T-24 Curved Support (ej38 de la práctica copiado sin cambios, `practica_en_juez.py`); masa con la tolerancia de la guía (± 3 g; una falta de ~1 g pasa sin verse: límite anotado). | Sí, R21 de la PC principal 24/10 11:22: 1 295,675 g contra 1 294 ± 3 |
| `28_ttt_bearing_bracket` (CATA) | Too Tall Toby 01-01 Bearing Bracket con el molde del 24. | Sí, R21 de CATA 24/10 10:54: 797,146 g contra 797,15 |
| `29_ttt_buffer_stand` | Too Tall Toby 24-SPO-06 Buffer Stand, plano en PULGADAS (ej39 de la práctica copiado sin cambios, `practica_en_juez.py`); masa en libras con la tolerancia de la guía (± 0,02 lb); el cruce de volumen va a 0,5 mm³ o 1e-5 del volumen (medido: pasar por STEP mueve 0,9 mm³ en esta pieza). | Sí, R21 de la PC principal 24/10 11:23: 3,9327 lb contra 3,923 ± 0,02 |
| `30_ttt_corner_tie` (CATA) | Too Tall Toby 01-09 Corner Tie con el molde del 24 (Aluminium pasado a 2 700). | Sí, R21 de CATA 24/10 10:54: 307,231 g contra 307,23 |
| `31_ttt_sm_hanger` (CATA) | Too Tall Toby 23-02-02 SM Hanger, chapa de 4 como SÓLIDO (la R21 no tiene Sheet Metal por COM): perfiles gruesos, Fill + ThickSurface y dos simetrías, con el molde del 24; masa con la tolerancia de la guía (± 10 g); cruce contra el volumen de la referencia de la guía corrida aparte. | Sí, R21 de CATA 24/10 11:28: 1 027,70 g contra 1 028 ± 10 |
| `32_virolador_v16` | El virolador v16 del Upper Trim (dispositivo entregado, dos ranuras) rehecho EN CATIA desde sus datos: `ej13_v16.py` de la práctica con dos cambios anotados (etapa 5 fija y los polígonos junto al script, `v16_ref/poligonos.json`); el STEP de CATIA contra el STEP ENTREGADO (sha256, no va al repo) con `compara.py` de OpenCASCADE: sobra, falta, distancia máxima en los dos sentidos, volumen, booleana que cierra y un sólido de cada lado. La comparación tarda 16 a 19 min: con el obrero hace falta `--timeout-seg 3000`. Solo en la PC principal. Prueba sin CATIA: `tests/test_virolador_v16_32.py`. | Sí, principal 24/10 11:27 (CATIA) y cierre 13:05 con el código del commit: sobra 0, falta 0, 0,0016 mm |
| `33_panel_upper_trim` (CATA) | El panel del cliente del Upper Trim abierto en CATIA desde una copia verificada por sha256 (la pieza no entra al repo; ruta por `CATIA_PANEL_UPPER_TRIM` o la nube): volumen, área y centro contra OpenCASCADE con integración fina (`medir_fino.py`, eps 1e-6) sobre el MISMO archivo, y el STEP que exporta CATIA con 1 sólido y 0 caras sueltas. | Sí, R21 de CATA 24/10 12:10: 91 770,060 mm³ / 96 035,359 mm² contra 91 766,750 / 96 034,395 (+0,0036 %) |
| `34_choque_v16_panel` | Choque EXACTO en CATIA del virolador v16 entregado contra el panel del cliente del Upper Trim y del gemelo subido 1 mm (va DESPUÉS y tiene que chocar): cada utillaje pegado como cuerpo en una copia del panel y `AddNewIntersect`; el panel se mide en CATIA en cada apertura (91 770,060, el del 33). Entradas por sha256 (no van al repo), copias con la cabecera STEP en orden (el v16 entregado la trae al revés y CATIA lo leía VACÍO). Respuesta: `choque_exacto.py` de OpenCASCADE sobre los mismos archivos, en `referencia_occ.json`. `GetMinimumDistance` falla entre dos cuerpos de una pieza: la luz la mide OpenCASCADE. Prueba sin CATIA: `tests/test_choque_v16_panel_34.py`. Solo en la PC principal. | Sí, principal 24/10 12:48: v16 sin intersección (OpenCASCADE: luz 0,0455), gemelo 69,561 mm³ contra 69,5649 |
| `35_nido_upper_trim` (CATA) | Nido que copia el panel del cliente: bloque 170 × 58 × 19 menos el panel verificado del 33 pegado sin vínculo; volumen del nido contra la práctica del 19/10 y choque exacto con OpenCASCADE (`choque_exacto.py` de la skill, por `jc.REPO`). Informa los sólidos del nido (5: el bloque y 4 islas que el panel encierra) y no decide por ellos. | Sí, R21 de CATA 24/10 12:17: nido 171 459,136 mm³ = la práctica; OpenCASCADE −0,0012 %; «toca (luz 0)», intersección 0 |
| `36_cswa_tool_block_e12` (CATA) | CSWA Sample Exam 2013 oficial, «Tool Block» etapas 1 y 2 (preguntas 3 y 4), cada una en su CATPart con su masa: el ej41 de la práctica con los perfiles que `de_build123d.py` saca del gemelo (la prueba los regenera y compara tramo por tramo); masa contra el papel y centro de gravedad contra el gemelo (la masa no ve un agujero corrido ni un perfil espejado). | Sí, R21 de CATA 24/10 13:04: 939,540 y 1 032,321 g contra 939,54 y 1 032,32; centro a 0,0004 mm |
| `37_cswa_tool_block_e34` | CSWA Sample Exam 2013 oficial, «Tool Block» etapas 3 y 4 (preguntas 5 y 6): el ej41b de la práctica copiado sin cambios con `croquis.py` y sus contornos; masa de CATIA de cada etapa contra el papel (`EDU_CSWA_Sample_Exam_2013_ENG.pdf`, pág. 9: 628,18 y 432,58 g), volumen y CENTRO DE GRAVEDAD de cada etapa contra el gemelo de build123d (el volumen no ve la altura de la ranura ni el lado del bolsillo; el centro sí), STEP 1/1/0 con su volumen y su centro. Prueba sin CATIA: `tests/test_cswa_tool_block_e34_37.py`. | Sí, principal 24/10 12:58: 628,184 y 432,583 g; centros a 0,0004 y 0,0006 mm del gemelo |
| `38_resorte_helice` (CATA) | Resorte por GSD: círculo R2 barrido por una hélice R20, paso 10, alto 50 (`AddNewHelix` + plano normal + `AddNewRibFromRef`), y el control que la práctica nombraba y no corría: el perfil inclinado 4,54987° (atan del paso) da área × largo × cos. | Sí, R21 de CATA 24/10 12:56: 7 920,665 y 7 895,705 mm³ contra 7 920,644 y 7 895,684 (+0,021) |
| `39_biela_manivela_dmu` | Biela-manivela con DMU Kinematics (r 30, l 80, tres revoluciones y una prismática, comando de ángulo por macro VBScript): el ej49 de la práctica copiado sin cambios y, sobre el mismo mecanismo, la posición completa de la biela y de la corredera en 0, 30, 60, 90, 120 y 180 grados contra la cinemática (corredera x = r cos t + √(l² − r² sen² t), botón de la manivela a r en el ángulo pedido, mecanismo «1;4;1»). Prueba sin CATIA: `tests/test_biela_manivela_39.py`. | Sí, principal 24/10 12:41: corredera a 0,0000 mm en los seis ángulos; botón en (30 cos t, 30 sen t) |
| `40_bloque_en_v` (CATA) | Bloque en V de 90° como ENSAMBLE: el solucionador de CATIA asienta el eje (a distancia R de los dos planos del V; arranca en z 200 para que un solucionador quieto dé rojo); la altura para D 160 y D 159,86 contra R·√2 y el error de desplazamiento ΔY del papel (Shuping Lv, Atlantis Press, Example 1). | Sí, R21 de CATA 24/10 13:00: z 113,1371 y 113,0381; ΔY 0,0990 contra 0,099 |
| `41_fem_viga` | Elementos finitos en CATIA (Generative Structural Analysis, `fem.py` de la skill): viga de acero 200 × 20 × 10 en Part Design, empotrada en x = 0; estática con 100 N en la punta (flecha = promedio de C3 de los nodos de la punta, que tienen que bajar parejo) y las dos primeras frecuencias, contra Timoshenko (0,8015 mm) y Euler-Bernoulli (203,71 y 407,43 Hz) a 1,5 %; el acero se lee de la pieza REABIERTA (la frecuencia sola no ve acero contra aluminio). Prueba sin CATIA: `tests/test_fem_viga_41.py`. | Sí, principal 24/10 13:16: 0,79707 mm (−0,56 %), 204,07 y 405,29 Hz |
| `43_gancho_bayer` | Gancho de encastre del manual de Bayer (ejemplo de cálculo I: espesor 3,28 → 1,64, l 19, b 9,5, E 1 815 N/mm²) en Part Design y simulado en CATIA (`fem.py`): empotrado en la raíz, 32,5 N en la punta; flecha contra el papel (2,4 mm) y contra Castigliano (2,3969) a 1,5 %; volumen y centro de gravedad (el trapecio dado vuelta tiene el mismo volumen), E de la pieza reabierta y la punta que baja pareja. Prueba sin CATIA: `tests/test_gancho_bayer_43.py`. | Sí, principal 24/10 13:37: 2,39668 mm (−0,14 % del papel) |
| `45_ajuste_contraccion` | Ajuste por contracción de dos anillos de aluminio (MIT 2.008, examen práctico 1 de 2023, problema 4) en CATIA (`fem.py`): un cuarto de cada anillo con simetrías y la presión de interfaz; el desplazamiento radial de cada anillo en r = 45 contra Lamé (tensión plana) a 0,1 % y la suma contra la interferencia del papel (0,18 mm); presión cargada, nodos de la cara de contacto que se mueven parejo, geometría y material. El FEM no simula el contacto: se le impone la presión. Prueba sin CATIA: `tests/test_ajuste_contraccion_45.py`. | Sí, principal 24/10 13:38: −0,147042 y +0,032958 mm = Lamé; suma 0,18 |

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
