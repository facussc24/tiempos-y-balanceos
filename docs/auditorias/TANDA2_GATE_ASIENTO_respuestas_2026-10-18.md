# Respuestas de la hija — tanda 2, gate de asiento (18/10/2026)

Las respuestas van acá y no adentro de los informes (pedido de la sesión madre, encargo E261017-91f6 continuidad
E261018-fe5f). Los informes quedan como los escribió cada revisor:
- Auditor Opus, ronda 1 (HEAD 0b89475a): `TANDA2_GATE_ASIENTO_auditor_2026-10-17.md`.
- Auditor Opus, ronda 2 (diff 0b89475a..392fa217): `TANDA2_GATE_ASIENTO_auditor_ronda2_2026-10-18.md`.
- Revisor por API (Opus, diff completo contra main), lo trajo la madre: su informe vive en el scratchpad de la madre
  (`revision_api\revision_tanda2.md`); sus puntos van abajo con el número del encargo.

## Ronda 1 del auditor — arreglada en 392fa217 y recalibrada

| Hallazgo | Respuesta |
|---|---|
| I1 luz absoluta, «0 apoyos» VERDE | Corte relativo: la luz más chica de las zonas no metidas + 0,10; las metidas se cuentan siempre; 0 zonas o poca cobertura: SIN DATO. v14 7, v15 4, v16 4 también alejadas 0,06 y 0,10 mm |
| I2 regiones, no movimientos | Primero con restricciones sumadas (ronda 1); la ronda 2 y el revisor por API mostraron que sumar no alcanza: ver «Esta ronda», punto 1 |
| I3 «rígido» apagaba el gate | Fuentes que no coinciden (pliego, escena, `--etiqueta`): código 2; G-E5 avisa la omisión |
| I4 G-E5 sin firma de la pieza | `check_signature` de `pieza_firma` contra `pieza_archivo` |
| I5 candado de dos archivos | La firma cubre `asiento.py`, `gate_asiento.py`, `eval_casos_3d.py` y los umbrales; el registro guarda la firma de la escena y del panel y `verificar` las compara |
| I6 peor variante por cantidad | Por veredicto y, entre iguales, por cantidad |
| I7 punta NO APLICA con metidos | Polígono solo con apoyos visibles y no metidos (la punta de la v14 se mide: 5,92 mm). El AVISO que se agregó lo sacó esta ronda (punto 3) |
| I8 sesiones abiertas | Renglón en el plan, sección «Qué necesita de Fak» |
| N1 relleno en G-E7 | Rechaza menos de 2 letras o números y «pendiente», «a definir», etc. (con 2 pasan «sí», «no», «OK»: ronda 2, N-b) |
| N2 cabecera reescrita entera | Intercambio en su lugar con un lector que respeta comillas y paréntesis |
| N3 calibrar corto pisaba el registro | Con otra cantidad de casos que la de la escena, no escribe el registro |
| P1, P2 | Preexistentes, no de esta rama; no se tocan |

## Esta ronda (ronda 2 del auditor + revisor por API) — la última

| # | Qué | Qué se hizo |
|---|---|---|
| 1 (API, confirmado) + R2-I1 | Sumar restricciones daba VERDE a tres apoyos en línea; el 0,25 no tenía caso que lo pusiera en rojo | **Arreglado.** Cada zona se mide por su eje principal: chica = un punto, larga = un riel con dos puntos (sus extremos), larga y ancha = superficie grande (ROJO). Con los puntos: más de 3, menos de 3 o **en línea** (se apartan de su recta menos de un cuarto del largo menor de la pieza) dan ROJO. Casos nuevos en el test: tres apoyos en línea ROJO, triángulo VERDE, riel + apoyo fuera de su eje VERDE, riel + apoyo sobre su eje ROJO, dos rieles + apoyo ROJO, riel en diagonal = riel (N-a). El 0,25 sigue sin fuente externa y queda escrito así en el código, en SKILL.md y acá: «fijado contra los casos conocidos, a revisar con una pieza nueva»; ahora el riel + apoyo de un lado y del otro del umbral está en el test |
| 2 (API) | El máximo hacía de mínimo | **Arreglado.** `PUNTOS_MIN = 3` (Z y los dos giros: tres grados de libertad, Carr Lane 3-2-1) separado de `apoyos_z_max` |
| 3 (API) | `calibrar` juzgaba el asiento solo con el porcentaje | **Arreglado.** `veredicto_asiento()` es la única función que juzga el asiento: la usan `verificar` y `calibrar`. Recalibrado: la v14 y la v15 siguen dando lo publicado |
| 4 (API) | `poses.max(0)` con la mano sin reposo | **Arreglado.** Un caso sin reposo en ningún punto queda sin medir; si todos, la simulación devuelve SIN DATO con motivo. Con al menos un reposo las cuentas son las mismas (por eso reproduce) |
| 5 (API) | `--completo` pisaba el registro; el test leía del JSON | **Arreglado.** `--completo` calibra con el registro en un temporal; sin `--completo` el test dice «se LEE de la calibración guardada, no se vuelve a simular» |
| 6 (API, a verificar) | `export_deliverables` con una cabecera rota o larga | **Medido y arreglado.** Era cierto: `arreglar_archivo` tiraba ValueError sin capturar y `orden_de_archivo` leía 20.000 bytes. Ahora la entrega sigue con un AVISO si no se puede leer o arreglar, y la cabecera se lee hasta su `ENDSEC;` (hasta 2 MB). Test: cabecera de 30.000 bytes y cabecera rota |
| 7 (API, a verificar) | `cabecera_step.py arreglar` descargaba de la nube | **Medido y arreglado.** Era cierto. Ahora no toca un archivo solo en la nube y no reemplaza uno de una carpeta de OneDrive (la biblioteca de Ingeniería o la personal) sin `--ok-fak "<frase de Fak>"`. Se sumó el atributo `RECALL_ON_OPEN` (0x40000) a la detección de «solo en la nube» |
| 8 (API, a verificar) | Valores sin fuente; 50 contra 150 casos | **Explicado en el código y en SKILL.md**: `metido` −0,02, `largo_frac` 0,25, `paso` 0,01 y `tol` 0,02 de la banda, la búsqueda de la banda en los 8 mm de abajo de la punta: «fijados contra los casos conocidos, a revisar con una pieza nueva». La tolerancia de ventana 0,05 está explicada en `asiento_casos.json` (es la holgura de asiento, la diferencia de definición entre las dos cifras publicadas) y se fijó antes de medir. El NO APLICA con ≤ 0,05 mm desapareció (punto R2-I3). Con 50 casos el renglón del asiento dice el ruido (±7 puntos en el peor caso) y cómo correr 150 |
| 9 (API, a verificar) | v15 «apoyos ROJO» contra el plan; fuentes del caso del banco | La v15 en ROJO es **decisión** de la tanda 11 que esta tanda mantuvo, con la evidencia (cuatro bloques rígidos controlan la altura; la simulación da 28 de 100): está en «Decidí distinto del plan» y va en el cierre para Fak. Las fuentes del 0,78° y del 0,25 del caso v15 quedaron escritas en su `graders/criterio.md` (el prompt sigue hablando como Fak) |
| 10 (API, a verificar) | `make_screw_nut.py` y la salida de las entregas | **Medido**: ningún script, ejemplo ni caso del banco del repo ni de `C:\Dev\_utrim` llama a `make_screw_nut.py`; el único caso real conocido (tornillo de 7 mm del 14/10: tuerca 5 con rosca 4,70) pasa el piso. G-E5, G-E6 y G-E7 suman renglones AVISO a toda entrega: dicho en SKILL.md (el veredicto no cambia; el día del freno, G-E7 frena toda entrega sin criterio) |
| 11 | Ronda 2 del auditor, respuestas aparte | Este archivo |
| R2-I2 | La cobertura solo miraba adentro de la grilla | **Arreglado.** Si algún vértice de la pieza cae afuera de la grilla de la escena: SIN DATO. Caso en el test |
| R2-I3 | El AVISO de la punta dependía del resultado y frenaba para siempre | **Arreglado.** NO APLICA se decide solo por la geometría (la mano de la escena cae adentro de los apoyos visibles), se simula igual y queda escrito, y **no** deja el asiento en AVISO. La pieza puede declarar su `mano_punta` (como `esquinas`); si no, la punta la decide la prueba física, y así lo dice el renglón |
| N-a | Riel en diagonal = «superficie» | **Arreglado** con el eje principal (punto 1) |
| N-b | G-E7 rechazaba «sí», «no», «OK» | **Arreglado** (mínimo 2) |
| N-c | Sumar una pieza descalibraba | **Arreglado**: la firma de la escena solo cuenta las piezas con números publicados |
| Nits sin número | G-E5 no ata el STL juzgado al STEP entregado; un `FILE_NAME(` en un comentario | **Abiertos**, se dicen en el cierre: el primero necesita saber qué STL sale de qué STEP (no hay hoy cómo); el segundo es teórico (OpenCASCADE 7.8 no escribe comentarios) |

Puntos del revisor por API que no estaban en el encargo y se responden igual:
- «La escena del posicionador es solo una etiqueta»: es a propósito; sobre rígido el gate no mira geometría. En el repo
  no hay STEP del posicionador (sus fuentes viven fuera, `examples/posicionador/README.md`).
- «Ficha de fijaciones no es un documento»: el plan del sistema la define así (decisión 3: «`make_screw_nut.py` chequea el
  piso» y las reglas de roscas), y las reglas ya vivían en `ficha-fdm.md` §4 desde la tanda 11; no se duplicó la ficha.
- «`cad-3d.md` cambia más que su renglón»: lo de la Elegoo y el enlace a la ficha FDM los pide el plan del sistema
  (decisión 4: «`cad-3d.md` y `SKILL.md` la enlazan»; contradicción `cad-3d.md:337` del informe `afuera_3d.md`).
- «`catia_medir.py` cambia de comportamiento»: usa la función compartida; para CATIA el resultado es el mismo orden ISO y
  `test_catia_medir.py` da lo mismo que en main.
- «Riesgo al fundir por la firma»: la madre ya midió que `eval_casos_3d.py` y `casos_3d.json` de main son iguales a los de
  la base (2da5783a). Si main los cambia antes de fundir, el gate sale con código 3 hasta recalibrar (20 min): es lo que
  tiene que pasar.
