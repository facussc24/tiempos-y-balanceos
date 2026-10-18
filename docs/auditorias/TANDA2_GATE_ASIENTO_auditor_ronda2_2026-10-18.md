# Auditoría, ronda 2 (la última) — tanda 2: gate de asiento sobre blando (18/10/2026)

Solo el diff `0b89475a..392fa217` (commit «ronda 1 del auditor»), en el worktree
`C:\Dev\BarackMercosul\.claude\worktrees\gate-asiento-tanda2`. Volví a correr mis scripts de ataque de la ronda 1 contra
el código nuevo y sumé ataques a lo que cambió. No se tocó código ni datos, y no se commiteó nada.
- Se escribieron este informe y, en el scratchpad, las copias del código con sus cambios de prueba (ahí también corrió
  la calibración corta).
- Se leyeron la caché del panel en `C:\Dev\_utrim\gate_asiento` y los STEP locales.

## Resultado

**3 Importante, 3 Nit (y 3 nits más), 2 Preexistente.**

- **Cierre de la ronda 1:** los 8 Importante y los 3 Nit quedaron cerrados, cada uno con el número que lo prueba (tabla
  de abajo).
- **Lo que el arreglo dejó abierto o rompió:** tres Importante nuevos. Son el 0,25 del largo de zona (R2-I1), la grilla
  que no cubre la pieza (R2-I2) y el AVISO de la punta (R2-I3).
- **¿Frena la fusión?** Nada frena la fusión en modo AVISO. R2-I1 y R2-I3 frenan el paso a freno del 24/10. R2-I2 se
  arregla en una línea, y conviene hacerlo antes de juzgar una pieza más grande que la v14.
- **Regresión cero:** los siete tests viejos dan la misma salida que en `main`, salvo rutas y horas. Los tres de la
  tanda salen 0, sin una sola FALLA.

## La ronda 1, una por una

| # | Estado | El número que lo prueba |
|---|---|---|
| I1 luz absoluta, «0 apoyos» VERDE | **CERRADO** | La v15 bajada 0,06 / 0,10 / 0,20 mm sigue en 4 apoyos ROJO; la v16 igual, 4 ROJO (antes 0 y VERDE). La v14 queda en 7 en las cuatro. La v16 bajada 0,10 como pieza nueva (`evaluar`, `nombre=None`, 10 casos) da total **ROJO**: apoyos ROJO, asiento AVISO (antes VERDE en todo). La pieza fuera del frame (x+1000) da apoyos **SIN DATO**, «0 % de la pieza con panel». En el sintético, cuatro apoyos bajados 0,11 cortan en 0,26 y siguen siendo 4, ROJO. El corte relativo no rompió nada de lo medido: la v14 queda en 7 porque las zonas metidas se cuentan aparte. Un cuarto apoyo 0,09 por encima de la base cuenta (4, ROJO) y uno a 0,11 no (3, VERDE): es el mismo criterio que deja como antivuelco las orejas de la v15, a 0,25 |
| I2 regiones y no movimientos | **CERRADO** en los casos medidos | Sintético con la mano del test. Dos rieles: 2 zonas, 4 restricciones, ROJO. Placa entera: 1 zona, 3 restricciones, ROJO (superficie grande). Cuatro apoyos unidos por un nervio: 1 zona, 3, ROJO. Dos rieles sobre dos mesetas: ROJO. Lo que queda: R2-I1 y el nit N-a |
| I3 «rígido» apagaba el gate | **CERRADO** | La v14 con el pliego `apoya-sobre-rigido` sale con código 2, «DOS FUENTES NO COINCIDEN»; con `--etiqueta rigido`, código 2. Un pliego sin etiqueta de apoyo deja aviso G-E5 |
| I4 G-E5 con evidencia vieja | **CERRADO** en el caso medido | Pieza retocada después del VERDE: G-E5 avisa «no habla de la pieza de hoy» y muestra las dos firmas. Pieza borrada: avisa. Lo que queda: un nit (la evidencia no se ata al STEP que se entrega) |
| I5 candado de dos archivos | **CERRADO** | En una copia: `cede` [0,0] en la escena da no vigente (firma de escena); un umbral de `casos_3d.json` cambiado da no vigente (firma de las cuentas); `a1_apoyos` cambiado en `eval_casos_3d.py`, no vigente; por CLI, `verificar` sale con código 3. Lo que NO lo invalida, y está bien: una nota `_`, pasar el archivo a CRLF, cambiar las versiones declaradas de `casos_3d.json`. La firma del registro (1f6b58fe / e0420620) coincide con la que calcula el código commiteado. Lo que queda: el nit N-c |
| I6 peor variante por cantidad | **CERRADO** | Dos variantes disjuntas: el gate informa `abre_R2`, la ROJO (antes `abre_R1`, la VERDE) |
| I7 la punta de la v14 tapada | **CERRADO** para la v14; abre R2-I3 | La v14 con los listones tapados ahora tiene 2 de 6 puntos adentro del polígono, sin los metidos ni los no vistos. La punta se mide: 5,92 mm de mediana (antes NO APLICA). Con los listones abiertos, 1,86 mm. La v16 da NO APLICA y su asiento queda en AVISO |
| I8 sesiones abiertas | **CERRADO** | El renglón está commiteado en el plan («Qué necesita de Fak, pieza por pieza») |
| N1 G-E7 con relleno | **CERRADO**; abre N-b | «?», «x» con 0, y «-» / «a definir» / «pendiente»: los tres avisan |
| N2 la cabecera reescrita entera | **CERRADO** | Sobre 108 STEP locales, la versión vieja y la nueva dan el mismo orden en todos: 95 al revés, 13 en orden. Sobre el STEP real de OpenCASCADE 7.8, la salida nueva es byte a byte la de la versión vieja. Quedan como estaban el comentario, `FILE_POPULATION`, los CRLF, el `);` dentro de un texto y la comilla doble `''` |
| N3 calibrar corto pisaba el registro | **CERRADO** | `calibrar --casos-sim 2` sobre una copia: «El registro NO se escribe», y el sha1 del registro antes y después es el mismo |
| P1, P2 | sin cambio | Siguen siendo de `main` y del detector |

## Importante nuevos

**R2-I1 · [Importante] TEXTO + ROBUSTNESS — el 0,25 del largo de zona es un número sin fuente, presentado como «fijado contra los casos».**
`cadlib/asiento.py:174-213` (`largo_frac=0.25`, `ex >= largo_frac * Lx`); docstring y respuesta a I2 («deja la v14 en 7,
la v15 en 4 y la v16 en 4»).
- Los casos no lo fijan:
  - La cantidad de zonas no depende de `largo_frac`: con 0,10 / 0,20 / 0,25 / 0,30 / 0,50 la v14 da siempre 7 zonas, la
    v15 4 y la v16 4.
  - Solo cambian las restricciones: la v16 da 8 con 0,10 (sus apoyos miden 8,0 mm en y, más que 0,10 × 57,8) y 4 de
    0,20 para arriba.
- Barrido de `largo_frac` sobre los cinco sintéticos del test (`r2_barrido_largo.py`):
  - con 0,17 o menos, los tres apoyos del caso BIEN dan ROJO, porque cada apoyo de 6 mm pasa a ser «largo» en y. Ese es
    el único tope de abajo;
  - de 0,18 hasta 10 (o sea, sin contar nunca un giro), los cinco dan lo que tienen que dar. Los rieles, la placa y el
    nervio son ROJO igual, por «menos de tres restricciones».
- O sea: **ningún caso del test se pone rojo POR el mecanismo de los giros**. Si se apagara, el test seguiría verde
  (REVIEW.md punto 1, además del punto 2).
- Donde el giro sí decide es en los casos mixtos, que el test no tiene:
  - un riel largo más un apoyo (isostático) da VERDE solo con `largo_frac` de 0,66 para abajo;
  - dos rieles de 40 mm más un apoyo dan ROJO solo con 0,44 para abajo (con 0,5 dan VERDE).
- Es un escalón:
  - Dos rieles de 22 mm (0,244 del largo) más un apoyo: 3 restricciones, VERDE.
  - Con rieles de 23 mm (0,256): 5 restricciones, ROJO.
  - La simulación da lo mismo en los dos casos: 5 %, 0,33 mm.
- En la v15, dos bloques de 45,8 y 46,0 mm cuentan como un punto y los de 62,0 mm como riel. El corte está en 48,0
  (0,25 × 191,8): los primeros quedan a 2 mm.
- El largo de referencia es el de toda la pieza: en la v14 y la v15 el STL mide 191,8 mm, no los 164 de la placa. No es
  la distancia entre apoyos, que es lo que decide si una zona larga controla un giro.
- Arreglo propuesto:
  1. Escribirlo como número de la casa sin fuente («a medir»), igual que el 0,05 de coplanaridad, y decir que los casos
     solo lo acotan por abajo (0,18).
  2. Poner en el test los dos casos mixtos («riel + apoyo» VERDE, «dos rieles cortos + apoyo» ROJO) y un caso a cada
     lado del escalón.
  3. Si se quiere un criterio con sentido físico: el largo de la zona contra la distancia a la zona más cercana, o la
     relación largo/ancho de la propia zona.
- Frena el paso a freno, no la fusión.
- respuesta: ____

**R2-I2 · [Importante] TRUE BUG — la cobertura del 40 % no ve una pieza más grande que la grilla.**
`cadlib/asiento.py` (`info["pct_pieza_con_panel"]`) y `gate_asiento.py` (`COBERTURA_MIN_PCT`).
- Qué pasa: el % se calcula sobre los puntos de la pieza que caen ADENTRO de la grilla. Lo que queda afuera no existe
  ni para el inventario ni para la simulación. El mensaje de SIN DATO dice «o la grilla no la cubre», pero eso no se
  mide.
- Caso medido (sintético, grilla x 0 a 100):
  - Una pieza de x 5 a 110 con 4 apoyos, uno en x 103: A1 **VERDE**, 3 apoyos, cobertura **100 %**.
  - La misma pieza con la grilla hasta 120: A1 ROJO, 4.
- El umbral del 40 % en sí está bien puesto: la v14, la v15 y la v16 miden 80,1 / 80,0 / 79,3 % de cobertura, así
  que las piezas reales tienen el doble de margen. El problema es lo que no mide: la grilla.
- Margen real: el STL de la v14 y la v15 ocupa x −51,16 a 140,91 e y −32,47 a 29,0. Los puntos extremos de la grilla de
  la simulación son x −51,863 / 141,137 e y −32,863 / 29,137: quedan 0,70 / 0,23 mm en x y 0,39 / 0,14 mm en y. Una
  pieza nueva apenas más larga queda cortada sin aviso.
- Arreglo propuesto: comparar `malla.bounds` (x, y) con los bordes de la grilla. Si la pieza se sale: SIN DATO, «la
  grilla de la escena no cubre la pieza (sale hasta x …)». Más su caso en el test.
- Agrandar la grilla de `upper_trim_two` cambia la firma de la escena y obliga a recalibrar.
- respuesta: ____

**R2-I3 · [Importante] TRUE BUG — el AVISO de la punta depende del resultado, no de la geometría, y en freno bloquea el diseño bueno.**
`gate_asiento.py` `fila_asiento` (NO APLICA si los puntos caen adentro Y `hamaca_mediana_mm <= 0.05`),
`gate_asiento.py:614` (`return OK if vt == "VERDE" else ROJO_`) y `gate_entregable.py:330`
(`ea.get("veredicto") != "VERDE"`).
- No es monótono. Sintético, con la mano «punta» adentro de los cuatro apoyos:
  - cuatro apoyos sobre una superficie: punta 0,00, NO APLICA, asiento **AVISO**;
  - los mismos cuatro sobre DOS mesetas (peor: normal 10 %, máxima 0,40): punta 0,10 medida, asiento **VERDE**.
  - La configuración mejor sale con el peor renglón.
- Con tres apoyos (el diseño correcto, A1 VERDE) y la mano punta adentro, la punta siempre da 0,00. Queda NO APLICA,
  asiento AVISO y total AVISO.
- `verificar` sale con código 1 para AVISO, igual que ROJO. G-E5 trata todo lo que no es VERDE como falla, así que en
  modo freno eso es **ROJO**.
- Toda pieza isostática con los apoyos en las puntas de la placa queda frenada para siempre en freno. Es justo lo que
  la tanda 11 aprendió con la v16 («los apoyos van a 0,3 mm de los extremos»). Y no hay dónde anotar la prueba física
  que según el propio mensaje «decide la punta».
- En modo aviso, hoy, solo deja un aviso.
- Arreglo propuesto:
  1. Que NO APLICA dependa solo de la geometría (puntos adentro del polígono de los apoyos que la simulación ve). El
     número va como informativo.
  2. Mejor todavía: puntos de la punta adentro de los apoyos = la mano está mal puesta para esa pieza. Eso es SIN DATO,
     «declarar `mano_punta` en la pieza», ya que ahora existe por pieza.
  3. Darle salida al AVISO: una evidencia `prueba_fisica` en el manifest (quién, cuándo, qué se apretó), que G-E5 acepte
     en freno. O un código distinto de 1 para AVISO.
  4. Decidirlo antes del 24/10.
- respuesta: ____

## Nit (3) y los demás

- **N-a · [Nit] ROBUSTNESS — la huella se mide por su caja, no por su forma.**
  - Un riel derecho a lo largo más un apoyo: 3 restricciones, VERDE.
  - El mismo riel girado 20°: «largo en x y en y», 4 restricciones, ROJO «superficie grande».
  - Falla cerrado (falso ROJO) con rieles en diagonal o nervios en L.
  - respuesta: ____
- **N-b · [Nit] ROBUSTNESS — G-E7 ahora rechaza respuestas cortas legítimas.** `gate_entregable.py:87`:
  - `_texto_ok` da False para «sí», «no», «OK» (menos de 3 letras sin número).
  - Un `"acepta": "sí"` (¿entra sin forzar? sí) avisa, y en freno sería rojo.
  - «1» y «entra» pasan.
  - respuesta: ____
- **N-c · [Nit] ROBUSTNESS — sumar una pieza a la escena calibrada la descalibra.**
  - `firma_escena` incluye `piezas`. Agregar una `v17` a `upper_trim_two` en `asiento_casos.json` da «la escena cambió»
    y código 3 hasta recalibrar (150 casos, unos 20 min).
  - Mientras tanto se puede juzgar con `--stl` sin agregarla. Conviene firmar las piezas que tienen `publicado`, no todas.
  - Tampoco entra a la firma `cadlib/geom.py`, que malla el panel.
  - respuesta: ____
- Y 3 nits más:
  - G-E5 coteja la firma del STL que juzgó el gate, pero no lo ata al STEP que se entrega. El caso «todo en regla» de
    `test_gate_entregable_tanda2.py` pasa con un STEP que no tiene nada que ver.
  - Un `FILE_NAME(` adentro de un comentario, antes de la entidad, hace que el lector la tome desde el comentario y deje
    `FILE_DESCRIPTION` adentro del comentario. La comprobación pasa igual. Es teórico: solo se reescriben los STEP de
    OpenCASCADE 7.8, que no escriben comentarios.
  - `os.utime` sigue perdiendo 100 ns.
- **P1, P2 · [Preexistente]** sin cambio (el `SyntaxWarning` de `test_gates_entrega.py:4`; el detector
  `_sinFirmaIA.py` sobre los planes con rutas `.claude/`).

## Lo que se corrió (ronda 2)

| Qué | Resultado |
|---|---|
| Los 4 tests de la tanda en la rama | exit 0, 0 FALLA |
| Los 7 tests viejos en la rama | exit 0; la salida de `test_gates_entrega`, `test_gates_proceso`, `test_eval_casos_3d`, `test_catia_medir`, `test_criterios` y `test_gate_cuerpos` es igual a la de `main` (corrida del 17/10, sin cambios en `main`) |
| `ataque_apoyos.py` (v14, v15, v16 bajadas 0 / 0,06 / 0,10 / 0,20) | 7 / 4 / 4 en todos; v16 bajada 0,10: total ROJO |
| `ataque_nueva.py` (v16 bajada como pieza nueva; punta de la v14) | total ROJO; punta de la v14 tapada 5,92 medida |
| `ataque_frame.py` | apoyos SIN DATO (0 %) |
| `ataque_variantes.py` | informa `abre_R2`, ROJO |
| `ataque_entregable.py` | G-E7: los 4 rellenos avisan; G-E5: pieza retocada o borrada, y pliego sin etiqueta: avisa; rígido contra blando: código 2 (pliego y `--etiqueta`) |
| `r2_sintetico.py` (los de la ronda 1 + bordes) | ver I2, R2-I1 y R2-I2 |
| `r2_largos.py` (huella de cada zona real, `largo_frac` de 0,10 a 0,50) | ver R2-I1 |
| `r2_barrido_largo.py` (`largo_frac` de 0,10 a 10 sobre los cinco casos del test y dos mixtos) | ver R2-I1 |
| `r2_punta.py`, `r2_punta3.py` | ver R2-I3 |
| `r2_diagonal.py` | ver N-a |
| `r2_cabecera.py` (108 STEP locales, la versión vieja contra la nueva; casos borde; G-E7 corto) | ver N2, N-b y el nit del comentario |
| Candado en copias (`mutar.py` + `vigente2.py`, y el CLI) | ver I5 y N-c |
| `calibrar --casos-sim 2` sobre una copia | Código 1. «CALIBRACION de prueba con 2 casos (la escena pide 150): 2 diferencia(s). El registro NO se escribe.» El sha1 del registro antes y después: igual (cierra N3) |

Scripts en el scratchpad de la sesión del auditor. No se modificó ningún archivo del repo salvo este informe.
