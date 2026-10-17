# Ingeniería de producto — cómo piensa el que diseña una pieza o un utillaje

Ficha de la casa, 17/10/2026 (tanda 11, pedido de Fak del 15/10: *«reemplazar el rol de un ingeniero de producto o un
diseñador 3D: los criterios que ellos tienen a la hora de diseñar»*). Es el **método**; los números viven en
`ficha-fdm.md` (fabricar en la A2L y materiales) y `ficha-utillajes.md` (ubicar, apoyar, apretar, ergonomía). Mismo
código de fuentes: ABIERTA / BUSCADOR / CASA / A MEDIR.

## 1. El orden de las preguntas (antes de abrir un CAD)

1. **¿Qué función cumple y en qué proceso, HOY?** Se confirma que la función existe en la planta, no en un papel viejo.
   Caso de la casa: los pines del insert se diseñaron para la costura CNC y *«la CNC no cose con pines»* (Fak, 16/10).
2. **¿De dónde sale cada cota que gobierna?** Del proceso real y de la pieza real, en ese orden; el dibujo es la tercera
   fuente. Caso: el pin salió Ø2,8 por un agujero Ø3 del DXF y en planta el agujero se hace con **sacabocado Ø2**.
3. **¿Qué fuerzas actúan, en qué etapa y qué pieza del dispositivo resuelve cada una?** (GATE P de `SKILL.md`.)
4. **¿Cómo se apoya y cómo se ubica?** Inventario de apoyos: un solo modo de montar (`ficha-utillajes.md` §1-2).
5. **¿Cómo se fabrica?** Orientación contra la carga, voladizos, holguras con su unidad (`ficha-fdm.md` §1-3).
6. **¿Con qué se acepta?** El criterio de aceptación escrito antes de imprimir (`ficha-utillajes.md` §5).
7. **¿Qué ya existe?** Lo que Barack ya tiene andando (`indice_dispositivos.py`) y lo que publicó otro (manual del
   fabricante en `4- MANUALES`, un repo bien valorado): antes de inventar.

## 2. Las preguntas que la ficha hace a un utillaje que apoya sobre blando (las corren los casos de `evals/banco/cad/`)

| Pregunta | Rojo cuando | Fuente de la regla |
|---|---|---|
| **A1 Apoyos** — ¿más de tres elementos rígidos controlan la altura y los dos giros, o más de uno ubica en el plano? | sí (v14: cuatro bloques en dos mesetas + tres pasadores parados sobre las ranuras tapadas; v15: los cuatro bloques). Es el criterio estricto (3-2-1) y no se afloja | Carr Lane U2/U3 (`ficha-utillajes.md`) |
| **A1b 4-2-1 coplanar** (renglón aparte, informativo) — si son cuatro, ¿están los cuatro sobre UNA misma superficie medida (dispersión ≤ 0,05 mm bajo y entre las huellas) y la mano puede apretar afuera de un triángulo? | cuatro repartidos en superficies distintas (v15: dos mesetas, una inclinada 0,78°). La v16 lo cumple; **igual la valida la prueba física**: cuánto desnivel absorbe el tapizado no tiene fuente | Applied Engineering U7; U8 (`ficha-utillajes.md`); umbral 0,05 mm fijado el 17/10, sin fuente: A MEDIR |
| **A2 Ventana de asiento** — ¿cuánto puede variar la altura del panel sin tocar plástico ni dejar de apretar? | menos de **1,0 mm hacia abajo o 0,6 mm hacia arriba** (cubre que el tapizado ceda 0 a 0,6 mm y ±0,2 de espesor: hipótesis del 13/10 hasta medir con el escáner) | CASA, B4 |
| **A3 Asiento simulado** — apretando en varios lugares con el blando variando, ¿cambia la pose? | la simulación no reproduce primero la falla conocida, o la pieza nueva se hamaca más de 0,3 mm en más del 10 % de los casos | CASA, B5; umbral fijado el 17/10 en `docs/PLAN_3D_A_FONDO_2026-10-17.md` antes de correr la v16 |

## 3. Tolerancias y GD&T básico

| # | Regla | Fuente |
|---|---|---|
| T1 | **ISO 2768-1** (tolerancias generales lineales, ±mm): clase **m** de 6 a 30 mm ±0,2; de 30 a 120 ±0,3; de 120 a 400 ±0,5. Clase **f**: ±0,1 / ±0,15 / ±0,2 en esos rangos | amesweb, ISO 2768 (ABIERTA, web, 17/10) |
| T2 | Lo que da una FDM de escritorio (±0,1 a ±0,3 mm) cae entre la clase f y la m: **una pieza impresa sin calibrar no se le promete «f»** | euspen ICE26126 (ABIERTA) + T1 (cuenta mía) |
| T3 | En un plano se escribe «ISO 2768-mK»: clase media de la parte 1 y clase K de la parte 2 (forma y posición) | Xometry, ISO 2768 (ABIERTA, web) |
| T4 | Las tres familias de GD&T que más usa un utillaje: **forma** (planitud de la cara que apoya), **orientación** (perpendicularidad de un tope contra su cara), **ubicación** (posición de un ubicador respecto de los datums). Los datums son los mismos apoyos del 3-2-1 | Keyence, *GD&T symbol list* (ABIERTA, web) + U1 |
| T5 | Piezas plásticas moldeadas: ISO 20457 (antes DIN 16742). Las tablas son pagas: no se citan números de memoria | iso.org (BUSCADOR) |
| T6 | Una cota que depende de otra se **deriva** en el código, nunca se escribe como número; y un parámetro heredado se recalcula con su fórmula antes de usarlo | CASA, `cad-3d.md` GATE 4 |

## 4. Caminos de carga y pared

| # | Regla | Fuente |
|---|---|---|
| C1 | Dibujar por dónde va la fuerza desde la mano hasta el apoyo: el material va **en ese camino** y la unión entre capas **no** lo cruza | `ficha-fdm.md` O1 |
| C2 | Comparar el tamaño de lo diseñado con lo que hace: un utillaje que aprieta 6 N no pesa medio kilo | CASA, `cad-3d.md` GATE 4 |
| C3 | Un elástico impreso se diseña a **fatiga**, no a deformación: ε ≤ 0,35 % en PLA | CASA, `cad-3d.md` GATE 4 |
| C4 | Donde hay flexión, sin esquina interna viva (Kt 2,2 → 1,2 con R ≥ 0,5·t) | CASA (FEM propio) |
| C5 | Pared con carga 1,5 a 2 mm; panza ≥ 2 mm alrededor de lo que entra en un vano | `ficha-fdm.md` G3; CASA `SKILL.md` §4 |

## 5. Los tres casos de la casa que esta ficha tiene que explicar (los corre `eval_casos_3d.py` y el banco `cad`)

| Caso | Qué pasó | Qué regla lo caza |
|---|---|---|
| **Virolador v14** (Upper Trim, 13/10) | pasó todos los gates y se hamacó en la mano | A1 (cuatro bloques en dos mesetas + tres pasadores parados sobre las ranuras de listón tapadas por el tapizado), A2 (ventana 0,20 / 0,24), A3 (100 % / 68 % de casos) |
| **Tornillo de 7 mm** (costura CNC, 14-16/10) | parado se partió bajo la cabeza; la holgura ganadora (0,50) estaba dentro del error de la máquina; los primeros mm no enroscan | `ficha-fdm.md` O1/O4, M7, R2, R4 |
| **Pines del insert** (costura CNC, 14-16/10) | la cota salió del DXF (Ø3) y en planta el agujero es de sacabocado Ø2; y la CNC ya no cose con pines | §1 preguntas 1 y 2 |

## 6. Cuándo se usa CATIA y cuándo el código

`catia.md` (en esta misma carpeta). En corto: se diseña con build123d y los gates; CATIA mide, controla el choque y
abre lo que manda el cliente; no tiene IA propia.
