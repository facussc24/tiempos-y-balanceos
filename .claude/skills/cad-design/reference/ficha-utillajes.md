# Ficha de utillajes — ubicar, apoyar, apretar y que lo use una mano

Ficha de la casa, 17/10/2026 (tanda 11). Mismo código de fuentes que `ficha-fdm.md`: **ABIERTA**, **BUSCADOR**, **CASA**,
**A MEDIR**. Lo que ya está como gate en `SKILL.md` no se repite: acá va el criterio de diseño que va ANTES de los gates.
El concepto de un utillaje que aprieta (de dónde sale la elasticidad, re-derivar en vez de parchear) sigue en
`utillajes-de-apriete.md`.

## 1. Ubicar: un solo modo de montar

| # | Regla | Fuente |
|---|---|---|
| U1 | **3-2-1**: tres apoyos en la cara primaria (Z y los dos giros), dos en la secundaria, uno de tope. Es el mínimo para ubicar | Carr Lane, *Locating & Clamping Principles* (ABIERTA, 15 y 17/10) |
| U2 | **Nada de ubicadores redundantes**: dos elementos no controlan el mismo movimiento. Carr Lane: «A general rule of thumb is always to avoid redundant location» | Carr Lane (ABIERTA, cita releída el 17/10) |
| U3 | **Separarlos lo más posible**: juntos, la pieza se bambolea. «This close spacing can cause the part to wobble on the locators» | Carr Lane (ABIERTA, 17/10) |
| U4 | **Un solo ubicador preciso por movimiento; el resto con holgura que no mande.** Caso: los pasadores de 1,10 del virolador le peleaban la posición al anillo (stack 0,28 > 0,19); a 0,90 capturan sin ubicar | CASA (memoria `project_uppertrim_pisador_utillaje`, 19/08, pregunta de Fak *«¿está hiperestático?»*) |
| U5 | Antes de modelar, **escribir el inventario de apoyos**: cada superficie que toca la pieza del cliente y qué movimiento controla (traslación X/Y/Z, giro X/Y/Z). Si dos renglones controlan lo mismo, es rojo | U2 aplicado (criterio de esta ficha; el gate automático es el de la tanda 2, `PLAN_3D_GATE_ASIENTO`, pendiente del sí de Fak) |
| U6 | Tolerancia del dispositivo ≈ 40 % de la de la pieza | Applied Engineering, *Jig and Fixture Design* (cita a Henriksen) (ABIERTA, PDF) |
| U7 | **3-2-1 da equilibrio, no estabilidad; 4-2-1 da las dos**: «3-2-1 locating, is the minimum requirement for location. It provides equilibrium but not necessarily stability. The second, 4-2-1 provides both». El cuarto apoyo es redundante: su redundancia se paga con **coplanaridad** (los cuatro sobre una misma superficie medida) o con un **compensador** («Rockers, double movement clamps, floating screws… eliminate redundancy») | Applied Engineering, *Jig and Fixture Design*, p. 1 y 5 (ABIERTA, PDF leído el 17/10); Carr Lane: «equalizing supports typically float to accommodate workpiece variations» (ABIERTA) |
| U8 | **Tres o cuatro, según dónde aprieta la mano.** Si la fuerza cae siempre adentro del triángulo de tres apoyos, tres (3-2-1). Si puede caer en cualquier lado de una placa larga, tres vuelcan (virolador, simulación del 17/10: tres apoyos se mueven hasta 10 mm apretando afuera del triángulo) y van cuatro (4-2-1) chicos, separados, **sobre UN mismo plano medido**, con lo que absorbe el desnivel dicho por escrito (la capa blanda, un compensador). Cuánto desnivel absorbe un tapizado de 0,5 mm bajo la mano: **SIN FUENTE, A MEDIR** | U1, U7; CASA (simulación del 17/10, `docs/PLAN_3D_A_FONDO_2026-10-17.md` §Resultados) |
| U9 | Dónde aprieta el operario es un **dato del proceso** (GATE P), no un supuesto del diseño: se mira en el video o se pregunta, y se escribe | CASA (`SKILL.md` GATE P) |

## 2. Apoyar sobre algo blando (tapizado, espuma, goma, chapa fina)

No hay ninguna guía publicada con reglas para apoyar un utillaje rígido sobre tapizado (buscado el 13/10, 15/10 y 17/10;
informe `docs/INVESTIGACION_3D_AFUERA_2026-10-17.md`). Lo que sigue es de la casa, con los números medidos.

| # | Regla | Fuente |
|---|---|---|
| B1 | El contacto se referencia a la **superficie del tapizado**, no al plástico desnudo (capa de 0,500 medida en el 100 % de las zonas de apoyo del Upper Trim). Contra el plástico, el apoyo queda metido en el vinilo y la pieza «flota» | CASA, v13 del virolador (20/08) |
| B2 | **Apoyos chicos, bien separados y sobre UNA misma superficie medida del tapizado** (no repartidos entre mesetas distintas). Tres si la mano aprieta siempre adentro de su triángulo; cuatro (4-2-1) si puede apretar en cualquier lado (U8). Afuera del polígono de apoyos la pieza vuelca hasta que algo la frena | U1, U3, U7, U8; CASA: la v15 (cuatro bloques grandes sobre dos mesetas, una inclinada 0,78°) se hamaca en 28 de 100 casos y 1,7 mm en la punta; cuatro apoyos chicos sobre el mismo plano, en 1 de 100 y 0,15 mm (simulación del 17/10) |
| B3 | Si la mano puede apretar afuera del triángulo, ahí va un **tope antivuelco con luz** (no apoya en reposo; frena el vuelco). Su luz es lo que la pieza puede moverse | CASA, v15 (orejas a 0,25 bajo el tapizado) |
| B4 | **Ventana de asiento**: cuánto puede estar el panel más cerca o más lejos y la pieza sigue apretando sin tocar plástico. Hipótesis declarada mientras no se mida con el escáner: el tapizado cede 0 a 0,6 mm y su espesor varía ±0,2. **Si la ventana es de décimas, el diseño está mal aunque el choque dé cero** (v14: +0,20 / −0,24 → falló en la mano) | CASA (memoria `feedback_diseno_3d_medir_antes_de_explicar_y_simular_el_uso`, 13/10) |
| B5 | Se **simula apoyado y apretado** antes de imprimir: la mano en varios lugares y el blando variando; la simulación nueva reproduce primero la falla conocida (v14 se hamaca en 68-100 de 100 casos) | CASA, `C:\Dev\_utrim\sim_asiento.py` (13/10) |
| B6 | Apoyos rígidos sobre una superficie pintada o clase A: cuerpo rígido con almohadilla de TPU 95A en el contacto | Siraya Tech y UltiMaker (ABIERTA según el informe del 17/10; no releída). Para el tapizado de Barack el blando ya es el vinilo: no hace falta otra almohadilla (GATE 1 punto 6 de `cad-3d.md`) |
| B7 | Presión máxima de contacto sobre tapizado o una pieza clase A: **SIN FUENTE** (Kipp, Halder, Misumi no publican un número abierto) | A MEDIR |

## 3. Apretar

| # | Regla | Fuente |
|---|---|---|
| A1 | La fuerza de apriete va **contra los apoyos o los ubicadores**: «Clamps should always be positioned to direct the clamping force into the supports or locators» | Carr Lane (ABIERTA, 17/10) |
| A2 | Se aprieta **sobre un apoyo**, nunca en el aire: «Position clamps over strong support points to avoid deformation» | Carr Lane (ABIERTA, 17/10) |
| A3 | Almohadillas giratorias o blandas para no marcar: «Use clamps with rotating pads or softer materials to avoid damage» | Carr Lane (ABIERTA, 17/10) |
| A4 | Coeficiente de seguridad del apriete en el ejemplo de Carr Lane (fuerzas de mecanizado): 2 a 1 | Carr Lane (ABIERTA) |
| A5 | Si el panel trae material blando, **el elástico es ese material** y el utillaje va rígido (el resorte del virolador v9 era el 84 % de la pieza y sobraba) | CASA, `utillajes-de-apriete.md` |
| A6 | Cuña autobloqueante 1:20 a 1:15 (con vibración no pasar de 1:15); leva con rango de trabajo de 70 a 80° | Applied Engineering (ABIERTA, PDF) |
| A7 | Un utillaje de PLA que queda **cargado horas** se diseña con poca tensión sostenida (creep: 10 MPa a 30 °C rompe a las 723 h) | `ficha-fdm.md` T4 |

## 4. Que lo use una mano (ergonomía)

| # | Regla | Número | Fuente |
|---|---|---|---|
| E1 | Mango para agarre de fuerza | 40 mm (30 a 50) | CCOHS, *Hand Tools — Design* (ABIERTA, cita releída el 17/10) |
| E2 | Mango o perilla para agarre de precisión | 12 mm (8 a 16) | CCOHS (ABIERTA, 17/10) |
| E3 | Largo mínimo del mango | ≥ 100 mm (≈ 120 con guantes) | CCOHS (ABIERTA, 17/10) |
| E4 | Peso a una mano | ≤ 1,4 kg (0,4 kg si es de precisión) | CCOHS (ABIERTA, 17/10) |
| E5 | Ningún canto que toque la mano o la pieza del cliente sin redondear: los rectángulos del virolador marcaban el vinilo (R1,5 desde el 18/08) y todo tope que enfrenta al panel nace redondeado | CASA (memoria del virolador). Radio mínimo publicado para la mano: SIN FUENTE |
| E6 | Lo que el operario tiene que encontrar a ciegas se marca por **forma** (una entrada, un tope que cae) y no por cuidado: *«es difícil darse cuenta cuál es el punto»* (Fak, 18/08) | CASA |
| E7 | **La versión grabada** en la pieza («v16 / 17-10»), así una foto dice qué se imprimió (Fak no sabía qué versión tenía en la mano, 13/10) | CASA, plan del sistema tanda 13 punto 3 |

## 5. Aceptar el utillaje

| # | Regla | Fuente |
|---|---|---|
| K1 | **El criterio de aceptación se escribe antes de imprimir**: qué se mide en la pieza impresa, con qué instrumento y con qué valor se acepta. Ejemplo vivo: `examples/gancho_mochila/verificar_gancho.py` | CASA (`afuera_3d.md` §5 punto 3) |
| K2 | Primera pieza: se inspecciona la primera pieza o una muestra del primer lote; ninguna norma abierta fija cuántas para un utillaje impreso | Inspección de primera pieza / AS9102 (ABIERTA, Wikipedia: referencia general); para utillajes: SIN FUENTE |
| K3 | Si se mide con calibre algo que decide, el sistema de medición tiene que poder verlo: %GRR < 10 % adecuado, > 30 % inaceptable (AIAG MSA) | spcforexcel, *Acceptance Criteria for MSA* (ABIERTA, PDF) |
| K4 | Un ensayo funcional con la pieza del cliente, en la secuencia real (apoyar, apretar en varios lugares, esperar lo que dura el proceso, sacar) | CASA (GATE P de `SKILL.md`) |
| K5 | El resultado de la prueba vuelve al registro de versiones de esa pieza el mismo día y se convierte en la próxima iteración | CASA (`utillajes-de-apriete.md`) |
