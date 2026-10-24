# Cola del banco de CATIA — tanda del 24/10/2026 (dos sesiones, una por PC)

Pedido de Fak, 24/10/2026: *"dejar un opus en cada notobok digamos con disnitos ejrecidios no? que esta notobok le pase
no lo ses examanees y que la otra avance en pararlo juntoa est ay cada tanto se curzen la data y las correcciones no? y
centralicen"*. Encargos E261024-de9f (principal) y E261024-1e56 (CATA), carpeta `catia-tanda-24-10` de la nube.

**Reparto: los IMPARES los hace la PC principal (DESKTOP-14JG95B); los PARES, CATA.** Nadie toca el ejercicio del otro.
La principal centraliza: `scripts/catia/LECCIONES_CATIA.md`, la fila de cada ejercicio en `README_obrero.md` y lo que
cambie de método en la skill `cad-design` (`reference/catia.md`). CATA deja sus lecciones en `LECCIONES.md` adentro de su
carpeta de ejercicio y no toca el README ni la skill.

## Qué es un ejercicio (el contrato, igual para los dos)

Carpeta `scripts/catia/ejercicios/NN_nombre/` con:

- `catia.py <carpeta de trabajo>`: el contrato de `README_obrero.md` (lee `asignado.json` si está, escribe `salida.json`
  con `ok`, medidas y `archivos`; sale con 0 / 3 / 4). Se arma con `juez_comun.correr_ejercicio(<id del banco>, construir)`
  como el 05 y el 07: build123d mide el `bien.py` del banco 3D, CATIA rehace la pieza, y el ok es el cruce (0,5 mm³ y 0,01 mm
  de centro de gravedad por parte) **más la respuesta del papel** (masa a 1 g, o lo que diga el ejercicio). El nombre de
  cada parte en CATIA es el del `.step` que escribe el `bien.py` (o se renombra como hace el 07).
- `ejercicio.json`: `usa_catia`, `descripcion`, `banco` (id del ejercicio del banco 3D que da el cruce) y
  `respuesta_conocida`: `{"que", "valor", "unidad", "tolerancia", "fuente"}`. **La respuesta sale de un papel** (examen,
  guía, plano, fórmula de geometría con su nombre): nada inventado. Si para una superficie no hay papel, el juez mide el
  área y la respuesta la da build123d sobre la misma pieza, y el json lo dice.
- Un test en `scripts/catia/tests/test_<nombre>.py` que corre SIN CATIA (CATIA falsa como `test_tool_block_07.py`: croquis
  cerrados, operaciones encadenadas, la cuenta contra el volumen del bien.py, verde y rojo del control).
- Una corrida real con `salida.json → ok: true` (la ruta y la fecha van en el commit y en la fila del README).

Ciclo por ejercicio: `git pull` → construir → correr en CATIA (principal: `C:\Dev\_catia_env\Scripts\python.exe`, sin otra
CATIA abierta; CATA: su CATIA R21 (B21, 32 bits) con el Python de `obrero.py`, una pieza por vez) → juez verde → revisor `explorador`
con un modelo DISTINTO del que construyó (las dos sesiones corren en Opus: el revisor va con `model: fable`) → commit con rutas (solo la carpeta del ejercicio y su test) → push. Los `ej*.py` de la práctica del 19/10
que se citan viven en `C:\Dev\_catia_practica\` de la PC principal; el método está escrito en `reference/catia.md` de la
skill (en el repo). Si CATA necesita uno, lo pide por `6- PEDIDOS ENTRE PC (FACUNDO)`.

## La lista

| N | Quién | Carpeta | Qué se construye en CATIA | Papel y respuesta conocida | Cruce build123d | Método ya probado |
|---|---|---|---|---|---|---|
| 08 | CATA | `08_c_clamp_base` | Too Tall Toby PPP01-03 C Clamp Base en Part Design: perfil del brazo, R18 de las esquinas de abajo, agujero 5,5 pasante con avellanado 11,2 × 90°, tope del brazo derecho en medio cilindro R8 | Guía de build123d `tttt.html#ttt-ppp0103`: **96,13 g**, aleación 1060, 2 700 kg/m³, ±1 g (`evals/banco3d/ejercicios/14_ttt_c_clamp_base/tarea.yaml`) | `14_ttt_c_clamp_base/bien.py` (sólido `ppp0103`, 35 605,5 mm³) | `catia.md` 19/10 tarde: `croquis.dibujar` + avellanado `AddNewHole` `Type 3`, `HeadAngle 90` (ej33: 96,13 = 96,13) |
| 09 | principal | `09_paste_sleeve_gsd` | PPP01-05 Paste Sleeve por **superficies (GSD)**: tramo recto 30 (oblonga 51 × 44), transición reglada a 66 × 10 en z 133 por loft vértice a vértice + Fill + Join (`SetDeviation 0,01`, `Invert`) + CloseSurface; hueco (45 × 38 → 60 × 4, pared 3 en el plano horizontal) como segundo cuerpo y Remove | Guía `tttt.html#ttt-ppp0105`: **57,08 g**, ABS 1 020 kg/m³, ±1 g (`15_ttt_paste_sleeve/tarea.yaml`; la lectura (a) de la pared da 56,73 g y es la del bien.py). Además el **área** total de la piel de CATIA contra build123d (mismo bien.py), el STEP de CATIA sin caras sueltas y su STL cerrado | `15_ttt_paste_sleeve/bien.py` (sólido `ppp0105`, 55 617,5 mm³) | ej29 de la práctica (55 617,524 = build123d 55 617,528); `catia.md` «Superficies» |
| 10 | CATA | `10_flanged_hub` | PPP01-07 Flanged Hub en Part Design: Shaft escalonado, nervio con Stiffener + CircPattern ×3, 6 agujeros de 6 con caja; techo del rebaje en z 18 (la cota manda sobre el ojo) | Guía `tttt.html#ttt-ppp0107`: **372,99 g**, aleación 1060, 2 700 kg/m³, ±1 g (`16_ttt_flanged_hub/tarea.yaml`) | `16_ttt_flanged_hub/bien.py` (sólido `ppp0107`, 138 144,7 mm³) | ej32 dio 373,51 (el nervio de 20° leído parejo, dicho como dudoso): la geometría se toma de `_flanged_hub.py` del banco, que ya la resolvió |
| 11 | principal | `11_tool_block_parametrico` | El Tool Block del examen Associate en UN CATPart **paramétrico (Knowledgeware)**: parámetros A, B, C, croquis restringido contra los ejes y fórmulas; con A 81 / B 57 / C 43 es la pregunta 3 y cambiando SOLO los parámetros a 84 / 59 / 45 es la 4; material Steel y masa de CATIA | Láminas 04, 05, 06 y 12 del examen (carpeta en la nube, sha256 en `13_examen_catia_associate/tarea.yaml`): **934,78 g y 1 027,09 g**, ±1 g | `13_examen_catia_associate/bien.py` (q3 118 929,059 y q4 130 673,503 mm³) | ej27 de la práctica (CSWP: parámetros + fórmulas, las 3 respuestas cambiando solo los parámetros); `croquis.py` (`a_eje_V`, `a_eje_H`, `radio`, `CreateDimension`, `CreateFormula`); el 07 para el perfil |
| 12 | CATA | `12_tool_block_mutantes` | Los tres mutantes del 13 en CATIA (el 07 con la operación salteada): `mal_1` q3 sin el agujero de 14, `mal_2` q5 sin la ranura R41, `mal_3` q6 con el vaciado sin paredes. **El juez tiene que dar ROJO** contra la lámina 12 en los tres (y VERDE el cruce contra el `mal_*.py` correspondiente: CATIA reproduce el modelo) | Lámina 12: 934,78 / 625,00 / 430,39 g; `mal_1`: +52,03 g **a mano** (π·7²·43·0,00786, `tarea.yaml` del 13); `mal_2` 798,54 g y `mal_3` 416,20 g (del modelo, no del examen: lo dice el json) | `13_examen_catia_associate/mal_1_q3_sin_agujero_14.py`, `mal_2_q5_sin_corte_r41.py`, `mal_3_q6_vaciado_sin_paredes.py` | El 07 entero (`catia.py` + `perfil_2d.py`); el banco 3D: «un control sirve si deja pasar la BIEN y frena las MAL» |
| 13 | principal | `13_superficies_exactas` | **GSD contra fórmulas**: tronco de cono r1 20 / r2 10 / h 30 por revolución y por multi-sección (área lateral), tapas con Fill, Join + CloseSurface (volumen), tubo barrido r 5 sobre un arco R 50 de 90° (Pappus), offset 3 y ThickSurface 2 de un cilindro r 20 h 30, split con un plano | Fórmulas de geometría: π(r1+r2)·s con s = √((r1−r2)²+h²); πr²; πh(r1²+r1·r2+r2²)/3; teorema de Pappus (área de la sección × largo de la guía); 2π·23·30; π(22²−20²)·30; 2π·20·20. Tolerancia 0,01 % | Las mismas piezas en build123d, medidas con `.venv-cad` en la propia carpeta (sin bien.py del banco: el cruce es área y volumen por superficie) | ej51 y ej52 de la práctica (todas a menos de 0,0001 %); `catia.md` «Superficies con respuesta exacta» |
| 14 | CATA | `14_reglas_knowledgeware` | Las reglas del banco como **controles adentro de la pieza** (`CreateCheck`): el 05 con «R ≥ 1,5 en todas las aristas» y el 04 con «luz 0,2 por lado»; VERDE con la BIEN y ROJO con un mutante de cada uno (05: `mal_1_sin_radio`, `mal_2_radio_0_5`; 04: `mal_1_luz_cero`, `mal_2_luz_1mm`) | `tarea.yaml` del 04 y del 05 (la regla y qué mutante tiene que caer) | `04_nido_holgura/` y `05_canto_vivo/` (bien y mal) | ej17 de la práctica (`CreateCheck("Pared >= 2mm")` en verde y en rojo); los `catia.py` 04 y 05 del juez |
| 15 | principal | `15_plano_tool_block` | **Drafting** del Tool Block q3 (lámina 04): croquis ACOTADO, vistas frente / planta / lateral + isométrica + corte, `GenerateDimensions`, más una **Clipping View Profile** y una **Breakout View** (las preguntas 1 y 2 del examen), PDF | Lámina 04: los valores de las cotas (81, 57, 43, Ø14, R19, R29, R5, 10°, 29, 24, 19, 32, 7, 5…) tienen que estar entre las cotas generadas; lámina 12: pregunta 1 = b) Clipping View Profile, pregunta 2 = c) Breakout View (las dos vistas existen con su tipo) | `13_examen_catia_associate/bien.py` (q3) para el sólido | ej44 (plano de taller), ej11, ej18 (corte y cotas), `acomodar_cotas.py`; `catia.md` «Plano de taller» |
| 16 | CATA | `16_palanca_ensamble` | El 06 como **ensamble** (CATProduct): base, soporte y palanca cada una en su CATPart, con restricciones (eje de la palanca coaxial con el del soporte, contacto: no va, en el banco hay 2 mm de luz; ver su LECCIONES); pose 0° | `_conjunto.py` del 06: eje en (0, 0, 80) dirección −Y, palanca horizontal hacia +X; el centro de gravedad del conjunto contra build123d (`Analyze.GetGravityCenter` por VBScript) | `06_palanca_0_60/bien.py` (base, soporte, palanca) | ej42 (ensamble bracket + eje: dos coincidencias punto-punto; cdg al milésimo); el `catia.py` 06 del juez |
| 17 | principal | `17_palanca_dmu` | El 16 con **DMU Kinematics**: junta de revolución, comando de ángulo 0 → 60°; en 0, 30 y 60° la punta de la palanca contra la trigonometría; choque exacto (`AddNewIntersect`, nunca `Clashes`) contra la base de `mal_1` (choca entre ~25 y 45°, libre en 0 y 60) y de `mal_3` (choca a 60); luz de `mal_2` a 50° (15 mm) | `tarea.yaml` del 06 (los tres mutantes dicen dónde chocan y a cuánto pasan; el `_conjunto.py` lo verifica al construir) | `06_palanca_0_60/mal_1_choca_a_35.py`, `mal_2_pellizco_15_a_50.py`, `mal_3_choca_a_60.py` | ej49 (biela-manivela: juntas y comando en UNA macro VBScript, exacta en 6 ángulos); `choque_exacto_en_catia.py`; `catia.md` «DMU» |

### Filas 18, 19 y 22 a 31 (agregadas el 24/10/2026 cerca de las 10:05, mismo reparto; las 20 y 21 son de otra sesion de la PC principal, el constructor de la casa: no son de esta tanda)

Dassault publica UN solo examen de muestra con respuestas (el de Part Design: 07, 11, 12 y 15 lo cubren entero; Assembly
y Surface Design no tienen muestra publicada, búsqueda del 24/10). Siguen las piezas de afuera con la respuesta escrita,
todas ya resueltas en la práctica del 19/10 (`C:\Dev\_catia_practica\ejNN_*.py` de la PC principal: si CATA necesita
uno, PEDIDO y se copia a `6- PEDIDOS ENTRE PC (FACUNDO)\para CATA - practica 19-10\`). La geometría sale del `ejNN` (su
lectura del plano y su gemelo de build123d); la respuesta, del papel. Sin `bien.py` en el banco 3D se usa
`correr_ejercicio(..., con_bien=False)` y el post-proceso compara contra la masa del papel (y contra el gemelo del ejNN
si está). Las planchas de Too Tall Toby: guía de build123d, https://build123d.readthedocs.io/en/stable/tttt.html (libres
para uso educativo); la del CSWP: https://sites.ualberta.ca/~dnobes/CSWA/CSWP_Material/CSWP_SampleExam_2.pdf.

| N | Quién | Carpeta | Qué se construye | Papel y respuesta | Base en la práctica |
|---|---|---|---|---|---|
| 18 | CATA | `18_cswp_etapa1` | CSWP Sample Exam 2 de SolidWorks, etapa 1, PARAMÉTRICA (A..E + X = A/3, Y = B/3 + 10) con las 3 respuestas cambiando solo los parámetros | PDF de la U. de Alberta, pág. 18-19 y 27: 14 207,34 / 16 490,45 / 15 100,47 g, densidad 0,0077 g/mm³ | ej26, ej27 (las 3 a ≤ 0,02 g) |
| 19 | principal | `19_cswp_etapa2` | CSWP etapa 2 (preguntas 4 y 5): modificar la pieza de la etapa 1 (sacar un bloque, bolsillo nuevo, garganta) | mismo PDF: 13 206,40 y 14 208,00 g | ej28 |
| 22 | CATA | `22_ttt_post_cap` | TTT 01-02 Post Cap: Shaft con cuarto de elipse, asa con Rib, Groove con desmolde 4°, R3 | guía: 43,09 g, ABS 1 020 | ej30 |
| 23 | principal | `23_ttt_light_cap` | TTT 01-10 Light Cap: sección de pared extruida simétrica + revoluciones de 180° | guía: 211,30 g | ej31b |
| 24 | CATA | `24_ttt_angle_bracket` | TTT 01-04 Angle Bracket: R4 corrido y recortado, pata, ranuras | guía: 310,00 g, acero 7 800 | ej34 |
| 25 | principal | `25_ttt_bearing_jig` | TTT 01-06 Bearing Jig: perfil con tangencias (de_build123d) + Intersect, chavetero | guía: 328,02 g | ej36 |
| 26 | CATA | `26_ttt_tie_plate` | TTT 01-08 Tie Plate: oreja + Mirror antes de la placa | guía: 3 387,06 g | ej35 |
| 27 | principal | `27_ttt_curved_support` | TTT 23-T-24 Curved Support: puente con tangencias encadenadas R30 / R66 / 8° | guía: 1 294 g ± 3, acero 7 800 | ej38 |
| 28 | CATA | `28_ttt_bearing_bracket` | TTT 01-01 Bearing Bracket: punta en dos arcos de 90°, cola de milano | guía: 797,15 g | ej37 |
| 29 | principal | `29_ttt_buffer_stand` | TTT 24-SPO-06 Buffer Stand, plano en PULGADAS (× 25,4) | guía: 3,923 lb ± 0,02 (ojo con la unidad) | ej39 |
| 30 | CATA | `30_ttt_corner_tie` | TTT 01-09 Corner Tie: pestaña armada plana + Rotate + Split | guía: 307,23 g | ej40 |
| 31 | CATA (era de la principal: pedido 8, 24/10 11:05) | `31_ttt_sm_hanger` | TTT 23-02-02 SM Hanger (chapa de 4) como sólido: la R21 no tiene la biblioteca de chapa por COM | guía: 1 028 g ± 10 | ej54 |

### Fase 3: diseños reales de Barack (Fak: «los reales de Barack al final»), propuesta del 24/10 11:15

La respuesta conocida acá no es un papel de afuera: es la MEDICIÓN de las piezas reales (el STEP del cliente y el del
dispositivo entregado, con su sha256) con otro motor (OpenCASCADE / build123d), y lo que ya se midió el 19/10 en la
práctica (`reference/catia.md`, «Qué dio»). Base: los ej de la práctica que ya lo hicieron. Se arman de a uno, con el
mismo contrato; los archivos de cliente NO se copian al repo (se citan con ruta y sha256, como el banco 3D).

| N | Quién | Qué | Respuesta conocida | Base |
|---|---|---|---|---|
| 32 | principal | El virolador v16 (dispositivo entregado del Upper Trim) rehecho EN CATIA desde sus datos | El STEP entregado: sobra 0, falta 0, distancia ≤ 0,002 mm (compara.py) y su volumen | ej13_v16 |
| 33 | CATA | El panel del cliente (Upper Trim) abierto en CATIA: volumen y área contra build123d sobre el MISMO STEP | 91 765,561 mm³ (build123d; CATIA dio 91 791,099 el 17/10: la diferencia, 0,03 %, es parte de lo que se juzga) | catia.md «Qué dio» |
| 34 | principal | Choque EXACTO en CATIA de la v16 contra el panel (y el gemelo subido 1 mm) | OpenCASCADE: v16 sin choque (luz 0,0455); gemelo 69,573 mm³ | ej16_choque_catia_real |
| 35 | CATA | Nido que copia el panel del cliente (bloque menos el panel) | intersección 0 y distancia ~0 con OpenCASCADE | ej24_nido_cliente |

## Lo que sigue, en este orden (Fak, 24/10/2026 a la mañana)

*"quiero que hagas todos los ejercicios oficiales de catia no? y luego diseños reales"*; *"te decía diseños reales de
algún otro lado que estén las respuestas escritas así tenés una referencia para automejorarte"*; *"los reales de Barack
al final"*.

1. **Todos los ejercicios OFICIALES de CATIA** (Dassault): los exámenes de muestra de cada módulo que publiquen la
   respuesta, más allá del de Part Design que ya está (07). La lista sale de una búsqueda en curso y entra acá como
   filas 18 en adelante, con el mismo reparto (impares principal, pares CATA).
2. **Piezas COMPLEJAS de afuera con la respuesta ESCRITA** (por ejemplo los Model Mania de SolidWorks, que publican la
   masa de cada etapa; los CSWA/CSWP de muestra; los Too Tall Toby más difíciles): superficies curvas, nervios,
   patrones, vaciados. Cada una con su plano citado (URL y fecha) y su respuesta; si el plano no se puede guardar en el
   repo, como el 13, el `tarea.yaml` cita dónde está.
   Candidatos ya resueltos en la práctica del 19/10 que todavía no tienen `bien.py` en el banco: Post Cap 43,09 g,
   Light Cap 211,30 g, Angle Bracket 310,00 g, Tie Plate 3 387,06 g, Bearing Jig 328,02 g, Bearing Bracket 797,15 g,
   Corner Tie 307,23 g; y chapa (Sheet Metal, el SM Hanger), que por COM en R21 sigue sin probar.
3. **Al final, los diseños reales de Barack**: la piel de un STEP de cliente (área y espesor en CATIA contra build123d,
   con sha256), los dispositivos que ya tienen su 3D medido.

**Verlo en vivo** (Fak, 24/10: *"cuando vuelva de la salida te quiero ver en tiempo real diseñándolo en CATIA"*): con
Fak en la ventana, el ejercicio corre con CATIA visible en su segunda pantalla y una pausa por paso (`CATIA_MIRAR=lento`
de `catia_base`, como en la práctica del 19/10). Solo en la PC principal y con su OK de ese momento.

## Estado (lo actualiza cada uno en su fila al hacer el commit)

| N | Estado | Corrida real (PC, fecha, resultado) | Commit |
|---|---|---|---|
| 08 | hecho (CATA) | CATA, R21, 24/10/2026 09:25 (`08_r2`, código del commit; la primera, 09:10, igual): ok true; 35 605,547 mm³ = build123d, cdg a 0,0003 mm, masa de CATIA 96,135 g (Aluminium del catálogo pasado a 2 700 kg/m³) contra 96,13 ± 1; Hole avellanado del ej33; 30 s | (este commit) |
| 09 | hecho | PC principal, R21, 24/10 09:18: 19 pasos sin falla, −0,004 mm³ y 0,0004 mm de build123d, 56,73 g (guía 57,08 ± 1), área −3e-8, STEP 1 sólido sin caras sueltas, STL cerrado a −0,24 %; revisor Fable: 1 bug real (el control del sentido de las caras) y 3 de robustez, arreglados | (este commit) |
| 10 | hecho (CATA) | CATA, R21, 24/10/2026 09:26 (`10_r3`, código del commit): ok true; 138 144,669 mm³ = build123d, cdg a 0,0005 mm, masa de CATIA 372,991 g contra 372,99 ± 1. El nervio NO va con Stiffener (espesor parejo: el ej32 dio 373,51): prisma trapecial en un plano normal al filo + patrón x3, como `_flanged_hub.nervio()`; la primera corrida (09:19) dio rojo por redondeo del centro medido, arreglado midiendo con todos los decimales | (este commit) |
| 11 | hecho | PC principal, R21, 24/10 09:28: croquis de 34 restricciones resuelto en q3 y q4, 0,000 mm³ de build123d, masas a 0,002 y 0,004 g de la lámina 12; revisor Fable: sin bugs, 4 de robustez aplicados (rango 40/40 y solver simulado en la prueba, ángulo −10, coherencia de masa, desplazamiento por parte) | (este commit) |
| 12 | hecho (CATA) | CATA, R21, 24/10/2026 09:33 (`12_r1`): ok true; CATIA = cada mal_*.py del 13 (125 548,395 / 101 595,13 / 52 951,827 mm³, cdg ≤ 0,0005 mm) y el juez da ROJO contra la lámina 12 en los tres (986,81 / 798,54 / 416,20 g contra 934,78 / 625,00 / 430,39); el juez exige el cruce de los tres (revisor Fable) | (este commit) |
| 13 | hecho | PC principal, R21, 24/10 09:59: 22 pasos, 13 fórmulas a < 1e-6 (media esfera y toro nuevos), STEP 1/1/0, STL orientados; revisor Fable: el 5 % del STL era aflojar el control (bug real): el STL ahora se juzga por orientación y cuerpos negativos; robustez: ok provisorio en falso sin bien.py, borrar lo probado siempre, mensajes | (este commit) |
| 14 | hecho (CATA) | CATA, R21, 24/10/2026 09:59 (`14_r2`, código del commit): ok true; Radio, Redondeado (Activity de los redondeos) y Luz como parámetros propios que mueven la geometría; controles «Radio >= 1.5mm and Redondeado == true» y «Luz >= 0.1mm and Luz <= 0.4mm» verdes con la buena y rojos con los cuatro mutantes; las seis variantes con el volumen del banco a 0,000 mm³ | (este commit) |
| 15 | hecho | PC principal, R21, 24/10 10:25: las dos vistas del examen (recorte y arranque) medidas en el PDF, cotas legibles, q3 = build123d; revisor Fable: el ok de las vistas era «no tiro error» (bug real) y la cota de 10° cruzaba la hoja: ahora se mide el PDF y la cota se borra | (este commit) |
| 16 | hecho (CATA) | CATA, R21, 24/10/2026 10:09 (`16_r2`, código del commit): ok true; soporte y palanca dibujados en su sistema y llevados a la pose por 7 restricciones (estado 0): (0; −21; 10) y (0; 0; 80), rotación exacta; conjunto 478 517,325 mm³ y cdg = build123d; gemelo en la misma corrida: con el paralelo en orientación opuesta la barra va a −X | (este commit) |
| 17 | hecho | PC principal, R21, 24/10 10:36: la pose la da CATIA (revolución + comando, punta exacta en 0, 35, 50 y 60°) y el choque OpenCASCADE sobre los STEP de CATIA (no AddNewIntersect); 12 de 12 chequeos del 06; revisor Fable: sin bugs, robustez aplicada (signo −1 exigido, NbDof solo se anota, la resta del soporte se controla) | (este commit) |
| 18 | hecho (CATA) | CATA, R21, 24/10/2026 10:15 (`18_r1`): ok true; la pieza paramétrica del ej27 (A..E, X = A/3, Y = B/3 + 10) da las tres respuestas cambiando solo los parámetros: 14 207,340 / 16 490,467 / 15 100,464 g contra 14 207,34 / 16 490,45 / 15 100,47 (masa de CATIA con Steel a 7 700 kg/m³); gemelo build123d a ≤ 0,1 mm³; revisor Fable: 0 graves, huecos de la prueba arreglados | (este commit) |
| 19 | hecho | PC principal, R21, 24/10 10:49: 13 206,387 y 14 208,004 g (papel 13 206,40 y 14 208,00); revisor Fable: citas confirmadas en el PDF (pág. 19, 24, 26, 27); tolerancia bajada a 0,1 g (un chaflán faltante pasaba con 1 g), A..E verificados, el caso sin build123d ya no revienta | (este commit) |
| 22 | hecho (CATA) | CATA, R21, 24/10/2026 10:52 (`22_final`, código del commit; la primera 10:20, igual): ok true; 43,093 g contra 43,09 (sin ABS en el catálogo: Steel con Density 1 020); antes del R1 a 0,023 mm³ del gemelo; STEP a 0,15 mm³ | (este commit) |
| 23 | hecho | PC principal, R21, 24/10 10:51: 211,303 g contra 211,30, volumen = gemelo de la práctica; revisor Fable: sin bugs (0,1 g ve cada falta: sin R8 −0,49 g); límite anotado: planos visibles al STEP | (este commit) |
| 24 | hecho (CATA) | CATA, R21, 24/10/2026 10:52 (`24_final`, código del commit): ok true; 309,997 g contra 310,00; gemelo a 0,002 mm³; es el MOLDE de 26, 28 y 30 (catia.py con CFG); el doblez prueba cada arista candidata (CAMBIO 4: el orden de la topología cambia entre corridas) | (este commit) |
| 25 | hecho | PC principal, R21, 24/10 11:2x (corrida con el código final): verde contra la guía; el ej de la práctica copiado sin cambios + practica_en_juez.py; revisor Fable: el cierre no era idempotente (bug real, arreglado y corrido de nuevo), la tolerancia de volumen relativa es medida, límites de la tolerancia de la guía anotados | (este commit) |
| 26 | hecho (CATA) | CATA, R21, 24/10/2026 10:53 (`26_final`): ok true; 3 387,058 g contra 3 387,06; gemelo y STEP a 0,000 mm³; molde del 24 | (este commit) |
| 27 | hecho | PC principal, R21, 24/10 11:2x (corrida con el código final): verde contra la guía; el ej de la práctica copiado sin cambios + practica_en_juez.py; revisor Fable: el cierre no era idempotente (bug real, arreglado y corrido de nuevo), la tolerancia de volumen relativa es medida, límites de la tolerancia de la guía anotados | (este commit) |
| 28 | hecho (CATA) | CATA, R21, 24/10/2026 10:54 (`28_final`): ok true; 797,146 g contra 797,15; gemelo a 0,027 mm³; molde del 24 | (este commit) |
| 29 | hecho | PC principal, R21, 24/10 11:2x (corrida con el código final): verde contra la guía; el ej de la práctica copiado sin cambios + practica_en_juez.py; revisor Fable: el cierre no era idempotente (bug real, arreglado y corrido de nuevo), la tolerancia de volumen relativa es medida, límites de la tolerancia de la guía anotados | (este commit) |
| 30 | hecho (CATA) | CATA, R21, 24/10/2026 10:54 (`30_final`): ok true; 307,231 g contra 307,23 (Aluminium pasado a 2 700); gemelo y STEP a 0,000 mm³; molde del 24 | (este commit) |
| 31 | hecho (CATA) | CATA, R21, 24/10/2026 11:28 (`31_final3`, código del commit; la primera 11:13, igual): ok true; chapa de 4 como sólido; 1 027,70 g contra 1 028 ± 10 (Steel con Density 7 800); 0,003 mm³ contra la REFERENCIA de la guía (constante con su fuente, no un gemelo independiente); STEP igual; molde del 24 (con tol_masa_g y volumen_referencia) | (este commit) |
| 32 | pendiente | | |
| 33 | hecho (CATA) | CATA, R21, 24/10/2026 12:10 (`33_final2`, código del commit; la primera 11:49, igual): ok true; la copia verificada (sha256 fb74d977…4e1e) de v14_choque/panel_marco_local.step: CATIA 91 770,060 mm³ / 96 035,359 mm² contra OpenCASCADE fino (eps 1e-6) 91 766,750 / 96 034,395 (+0,0036 % / +0,0010 %, centro 0,0036 mm); el STEP de CATIA 1 sólido, 0 caras sueltas, −0,0040 %. Los 91 765,561 / 91 791,099 de la fila son de two_wireless.stp, no de esta copia (build123d por defecto: 91 767,169). Hallazgo: medir_b123d sin eps sobre el STEP de CATIA da −0,052 % y el centro 0,058 mm corrido (LECCIONES.md 2); revisor Fable: sin graves | (este commit) |
| 34 | pendiente | | |
| 35 | pendiente | | |
