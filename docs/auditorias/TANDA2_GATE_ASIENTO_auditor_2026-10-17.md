# Auditoría — tanda 2 del plan del sistema: gate de asiento sobre blando (17/10/2026)

Rama `claude/gate-asiento-tanda2` (10 commits sobre `main` 2da5783a, HEAD 0b89475a), worktree
`C:\Dev\BarackMercosul\.claude\worktrees\gate-asiento-tanda2`. Auditor (solo lee y corre; no se tocó código, datos, Supabase,
la impresora ni `C:\Dev\_utrim` fuera de `gate_asiento\`). Intérprete `.venv-cad` con `PYTHONIOENCODING=utf-8`.

## Resultado: el gate hace las mismas cuentas que el 13/10 y los tests pasan, pero el inventario de apoyos y la activación se pueden esquivar

**8 Importante, 3 Nit (y 4 nits más), 2 Preexistente.**

Ninguno frena la fusión mientras el gate esté en modo AVISO: así nació y así lo dice `procesoCanon.data.json`. Pero
**cada uno de I1 a I7 frena el paso a freno del 24/10**. I8 es de texto y ya está en camino. Con el gate como está, una pieza nueva igual a la v16 pero 0,10 mm
más lejos del panel da VERDE en todos los renglones. La v16 tal como está da ROJO.

Lo que está bien, verificado corriendo:
- La simulación de `cadlib/asiento.py` es la de `sim_asiento.py`: mismas alturas del panel, mismas máscaras, mismo
  orden de sorteos y mismos números.
- El candado de la firma salta cuando cambia el código, y los finales de línea no lo mueven.
- Regresión cero en los gates viejos.
- La cabecera STEP no toca un byte fuera de la cabecera.
- El piso de la tuerca anda.
- Lo que la ficha FDM dice del perfil de la A2L es cierto.

| Check | Estado | Detalle |
|---|---|---|
| Simulación = `sim_asiento.py` | OK | Corrida propia con 8 casos y semilla 7: v15 tapados, abiertos, punta y gemelo; v14 tapados, abiertos y punta. Todos los números iguales. `Hs`, `Ht`, la grilla, las zonas de plástico, el tapizado, los listones abiertos y la altura de la pieza dan igual elemento a elemento contra `out/sim_asiento_panel.npz` del 13/10. El registro de 150 casos coincide campo a campo con `out/sim_asiento.json` y `out/sim_asiento_punta.json` del 13/10, y el gemelo con `out/sim_v16_gemelo_normal.json`. |
| Candado de calibración (código) | OK | Un comentario de más en `asiento.py`, o un 0,3 cambiado a 0,31 en `gate_asiento.py`: `verificar` sale con código 3. Pasar los dos archivos de CRLF a LF o al revés no cambia la firma (393dcd58). La firma calculada desde HEAD coincide con la del registro. |
| Candado de calibración (datos) | FALLA | Ver I5 |
| Tests de la tanda | OK | `test_gate_asiento`, `test_step_cabecera`, `test_fijaciones` y `test_gate_entregable_tanda2`: los cuatro salen 0 |
| Regresión de los gates viejos | OK | En `main` y en la rama dieron exit 0 los mismos tests: `test_gates_entrega`, `test_gates_proceso`, `test_eval_casos_3d`, `test_catia_medir`, `test_criterios`, `test_gate_cuerpos` y `test_build123d_mcp`. Las salidas comparadas renglón por renglón difieren solo en rutas y horas. |
| vitest `evalBanco` | OK | 7 de 7 |
| GitHub / CI | no aplica | Rama sin push por diseño (la madre funde y publica) |
| TypeScript / build / dependencias | no corrido | El cambio no toca la app: es Python, Markdown, JSON y un `.test.mjs` del banco |

---

## Hallazgos Importante

**I1 · [Importante] TRUE BUG — el inventario usa una luz ABSOLUTA de 0,10 mm, y «0 apoyos» da VERDE.**
`cadlib/asiento.py:183` (`gap <= delta`) y `eval_casos_3d.py:30-41` (con 0 apoyos `a1_apoyos` da VERDE).
- Qué pasa: un apoyo cuenta solo si en la pose de diseño queda a 0,10 mm o menos del panel. Si la pieza se diseña con
  todos los apoyos a 0,11 mm, el renglón dice «0 apoyos en Z», VERDE.
- Caso medido: la v15 o la v16 bajadas 0,06 mm (`apply_translation([0,0,-0.06])`) dan A1 VERDE con 0 apoyos. Tal cual,
  las dos dan ROJO con 4.
- Caso medido: la v16 bajada 0,10 mm y pasada como pieza nueva (`evaluar(..., nombre=None)`, 10 casos) da total VERDE:
  apoyos VERDE, ventana 1,108 / 0,851 VERDE, asiento VERDE. Es la misma pieza que hoy da ROJO. Con `--pieza v16` la
  segunda fuente (`casos_3d.json` declara 4) frena con código 2, pero una pieza nueva no tiene renglón ahí.
- Caso medido: una pieza fuera del frame (v16 corrida 1000 mm en x) da apoyos VERDE, «0 apoyos en Z». El total sale
  ROJO de casualidad: el programa lineal sin restricciones da 42,8 mm. Tampoco se informa qué parte de la grilla tocó
  la pieza, que la regla de la casa pide para todo barrido de rayos (`cad-3d.md` GATE 3: «menos de ~40 % = la medición
  no es válida»).
- Por qué importa: la simulación normal no ve hamacarse cuatro apoyos simétricos (tanda 11, `PLAN_3D_A_FONDO`
  punto 3). Para un diseño simétrico, este renglón es el único que caza la redundancia. Y «0 apoyos» es «no pude
  medir»: según REVIEW.md punto 9 eso es aviso, nunca verde.
- Arreglo propuesto:
  1. Medir la base sobre las celdas NO metidas: `base = nanmin(gap[gap >= metido])`. Contar como apoyo lo que cumple
     `gap <= max(base, 0) + delta`.
  2. Las regiones metidas se cuentan siempre, aparte.
  3. Ojo: un `nanmin(gap) + delta` pelado rompe la calibración. En la v14 la luz mínima es −3,75 (los pasadores), así
     que el corte queda en −3,65 y la cuenta baja de 7 a 3 apoyos.
  4. Menos de 3 apoyos nunca da VERDE (SIN DATO o ROJO).
  5. Informar el % de la grilla con pieza enfrente; por debajo de un mínimo, SIN DATO.
  6. El test tiene que mantener v14 = 7, v15 = 4 y v16 = 4, también con la v16 bajada 0,10 mm.
  7. Cambia `asiento.py`: cambia la firma y hay que recalibrar entero (150 casos, unos 20 min).
- respuesta: ARREGLADO (ronda 1). La luz base es la más chica de las zonas no metidas y el corte es base + 0,10; las metidas se cuentan siempre; menos de tres restricciones da ROJO (vuelca); 0 zonas o menos del 40 % de la pieza con panel enfrente dan SIN DATO; se informa la cobertura. Medido: v14 7, v15 4, v16 4, también alejadas 0,06 y 0,10 mm (antes 0 y VERDE). Casos en `test_gate_asiento.py` 2b (cuatro apoyos 0,11 más lejos: ROJO; pieza fuera del frame: SIN DATO). Recalibrado.

**I2 · [Importante] TRUE BUG + TEXTO — el inventario cuenta regiones que se tocan, no qué movimiento controla cada una.**
`cadlib/asiento.py:184` (`ndimage.label` con 8 vecinos sobre la grilla de 0,25 mm).
- Qué pasa: toda región conectada a 0,10 mm o menos del panel es UN apoyo «tipo apoyo_z». Lo que no tiene forma de
  punto no se ve.
- Caso medido, escena sintética del test con la mano del test y 20 casos:

  | Pieza | Apoyos que cuenta | A1 | Simulación |
  |---|---|---|---|
  | cuatro apoyos 6 × 6 | 4 | ROJO | 0 % |
  | dos rieles a lo largo | 2 | VERDE | 5 % |
  | una placa entera apoyada | 1 | VERDE | 5 % |
  | los cuatro apoyos unidos por un nervio 0,04 mm más bajo (luz 0,09) | 1 | VERDE | 0 % |
  | dos rieles sobre dos mesetas | 2 | VERDE | 50 % (ROJO) |
  | los cuatro apoyos sobre las mismas dos mesetas | 4 | ROJO (A1b también ROJO) | 10 % |

  Con el nervio se pasa de ROJO a VERDE sin cambiar los apoyos. En estos casos la simulación caza algunos (los rieles
  sobre dos mesetas), pero sobre el panel real no ve los apoyos simétricos (ver I1).
- TEXTO:
  - El plan pedía (punto 2) «qué movimiento controla cada una (traslación en Z, giro en X, giro en Y)». No está hecho,
    y no figura en «Decidí distinto».
  - `cad-3d.md` (renglón nuevo del GATE A) dice «ROJO si más de tres controlan Z y los giros», y `SKILL.md` dice
    «cuántas superficies tocan». El código cuenta regiones a 0,10 mm o menos, y el 0,10 no está escrito en ningún
    documento.
- Arreglo propuesto:
  1. Por cada región, medir el largo en x y en y (o el rango de su huella). Una región más larga que N veces el ancho
     del apoyo cuenta por dos o más (un riel controla Z y un giro), y una placa entera cuenta por tres o más. N no se
     inventa: se fija contra los casos. El nervio y los rieles tienen que dar ROJO, y la v16 tiene que seguir en 4.
  2. O, más simple: que el renglón cuente «puntos extremos de la huella de contacto» en vez de componentes.
  3. Caso ROJO del nervio y de los rieles en `test_gate_asiento.py`.
  4. Corregir el texto de `cad-3d.md` y `SKILL.md` a lo que mide.
- respuesta: ARREGLADO (ronda 1). Cada zona dice qué controla: Z y, si su huella mide un cuarto del largo de la pieza o más en x o en y, el giro correspondiente; las restricciones se suman y Z más los dos giros necesitan tres; una zona larga en las dos direcciones es una superficie grande y da ROJO. El 0,25 se fijó contra los casos (deja v14 = 7, v15 = 4, v16 = 4). Casos ROJO en el test: dos rieles, placa entera, nervio de luz 0,09, dos apoyos. Textos de SKILL.md y cad-3d.md corregidos a lo que mide.

**I3 · [Importante] TRUE BUG — la activación falla abierta: «rígido» en el pliego o en `--etiqueta` apaga el gate sobre una escena declarada blanda, y sin ninguna de las dos etiquetas G-E5 calla.**
`gate_asiento.py:146-159` (orden: `--etiqueta`, después el pliego, después la escena) y `473-479`.
- Caso medido: la v14 (el caso que el gate tiene que dar ROJO) sobre la escena `upper_trim_two`, que dice
  `"apoya_sobre": "blando"`, sale «GATE DE ASIENTO — NO CORRE», código 0, en los dos casos:
  - con un pliego que dice `apoya-sobre-rigido`;
  - con `--etiqueta rigido`.
- `test_gate_asiento.py:133` prueba justamente esa dirección (el pliego le gana a la escena).
- Caso medido: con un pliego que no declara ni `apoya-sobre-blando` ni `apoya-sobre-rigido` (por ejemplo solo
  `hay-apriete`), G-E5 no dice nada. La regla de la casa es que lo que hay que cazar es la omisión (`cad-3d.md`,
  GATE P (b)).
- En el resto del gate, dos fuentes que no coinciden dan código 2 (`evaluar`, apoyos medidos contra declarados). Acá se
  resuelven a favor de apagarse.
- Arreglo propuesto:
  1. Si la escena declara `apoya_sobre` y el pliego o `--etiqueta` dicen otra cosa: código 2, «dos fuentes no
     coinciden».
  2. En `gate_entregable.py`, G-E5 avisa cuando el pliego no declara ninguna de las dos etiquetas.
  3. Dar vuelta el caso del test: rígido contra una escena blanda da 2.
- respuesta: ARREGLADO (ronda 1). `etiqueta_de` junta las tres fuentes (--etiqueta, pliego, escena) y si no coinciden devuelve el conflicto: `verificar` sale con código 2 sin elegir; un pliego con las dos etiquetas también. G-E5 avisa si el pliego no declara ninguna de las dos, si no hay pliego o si el workdir no tiene manifest. El caso del test se dio vuelta (rígido contra escena blanda: 2) y se sumaron los de --etiqueta y de G-E5.

**I4 · [Importante] TRUE BUG — G-E5 acepta la última evidencia de asiento sin mirar si habla de la pieza que se entrega.**
`gate_entregable.py:313` (`find_evidence(workdir_path, "asiento", corre=True)`, sin `check_signature`).
- Caso medido: una evidencia VERDE con `pieza_archivo` y `pieza_firma`, y después la pieza retocada: G-E5 no avisa.
  Con la pieza borrada, tampoco.
- Es el patrón del 24/08 que `workdir.check_signature` vino a cerrar. `export_deliverables.py:247/282/318` lo usa
  para el pliego, el choque y el ensamble; G-E5 no.
- `SKILL.md` («G-E5 … corrió el GATE A y dio VERDE») promete más de lo que el código mira.
- Arreglo propuesto: `workdir.check_signature(ea, "pieza_firma", ea["pieza_archivo"])`. Si no coincide, o el archivo
  no existe: el mismo aviso (o rojo, en modo freno). Más un caso en `test_gate_entregable_tanda2.py`.
- respuesta: ARREGLADO (ronda 1). G-E5 coteja `pieza_firma` contra `pieza_archivo` con `workdir.check_signature`; retocada, borrada o sin archivo en la evidencia: aviso (rojo en modo freno). Caso en `test_gate_entregable_tanda2.py`.

**I5 · [Importante] ROBUSTNESS — el candado de calibración firma solo dos archivos: la escena, los umbrales y lo que decide el veredicto pueden cambiar sin recalibrar.**
`cadlib/asiento.py:399-405` (firma de `asiento.py` y `gate_asiento.py`) y `gate_asiento.py:446-455`.
- Caso medido sobre una copia en el scratchpad: cambié a la vez
  - en `data/asiento_casos.json`, el sorteo de `upper_trim_two`: cede [0, 0], espesor 0, alabeo 0, umbral de hamaca
    5 mm;
  - en `data/casos_3d.json`: `apoyos_z_max` 99 y `hamaca_pct_max` 100;
  - y `eval_casos_3d.a1_apoyos` reemplazado por uno que siempre da VERDE.
- `calibracion_vigente()` siguió diciendo «calibrada el 2026-10-17 23:15 (firma 393dcd58…): reprodujo v14 y v15».
- Tampoco se mira la firma del panel: está en el registro (`panel_firma`), pero `verificar` no la compara.
- Es decir: la simulación que juzga puede no ser la que reprodujo la v14 y la v15.
- Arreglo propuesto:
  1. Guardar en el registro la firma de lo que entra a las cuentas: la escena calibrada sin las claves `_`, los
     umbrales de `casos_3d.json`, `eval_casos_3d.py` y el panel.
  2. Que `verificar` la compare cuando usa esa escena, y para otra escena exija al menos la firma de los umbrales y de
     `eval_casos_3d.py`.
  3. Un caso en el test que cambie un número de la escena y espere código 3.
- respuesta: ARREGLADO (ronda 1). La firma de las cuentas cubre `cadlib/asiento.py`, `gate_asiento.py`, `eval_casos_3d.py` y los umbrales de `casos_3d.json`; el registro guarda además la firma de la escena (sin las notas `_`) y la del panel, y `verificar` las compara sobre la escena calibrada (otra escena: se juzga con las cuentas calibradas y se dice). Casos en el test (un número de la escena cambiado, otro panel: no vigente).

**I6 · [Importante] TRUE BUG (latente) — la «peor» variante se elige por cantidad de apoyos, no por veredicto.**
`gate_asiento.py:226-227` (`if peor is None or r1["apoyos_z"] > ...`), y `evaluar` informa solo `pv[peor]["A1"]`.
- Caso medido (sintético, dos variantes que abren zonas distintas):
  - `abre_R1`: 3 apoyos, VERDE.
  - `abre_R2`: 3 apoyos con uno metido 0,40 mm en el blando, ROJO.
  - `evaluar` informa `abre_R1` → VERDE.
- Hoy ninguna escena lo dispara (en `upper_trim_two`, «abiertos» es un subconjunto de «tapados»), pero la próxima escena
  con variantes que no se contienen esconde el ROJO.
- Arreglo propuesto: elegir la variante con el peor veredicto (ROJO antes que VERDE) y, entre iguales, la de más
  apoyos. O informar el A1 de cada variante y que el total tome el peor.
- respuesta: ARREGLADO (ronda 1). La peor variante se elige por veredicto (ROJO > SIN DATO > AVISO > VERDE) y, entre iguales, por cantidad de apoyos. Caso de dos variantes disjuntas con un metido en el test.

**I7 · [Importante] ROBUSTNESS — «punta NO APLICA» se decide con el polígono de TODAS las celdas de apoyo, y en la v14 tapa 5,9 mm que la simulación sí mide; además NO APLICA no pesa en el total.**
`gate_asiento.py:261-267`, `cadlib/asiento.py:159-168`, y `veredicto_total` (`gate_asiento.py:317-324`), que no mira la
punta.
- Caso medido: en la v14 con los listones tapados, los 6 puntos de la mano «punta» caen adentro del polígono. Ese
  polígono lo agrandan los tres pasadores metidos en x −44,9 / 44,9 / 134,7, y el de x 134,7 la simulación ni lo ve.
  El gate escribe «NO APLICA … no es la punta».
- Con esos mismos 6 puntos, la simulación da mediana 5,92 mm (5 casos). El 13/10 midió 5,91 en 150 casos
  (`out/sim_asiento_punta.json`).
- Con los listones abiertos, la v14 sí mide la punta: 1,86 mm.
- La premisa de la regla («adentro del polígono da 0,00 mm, no es la punta») vale para la v16, no en general. Y con
  NO APLICA, el renglón de asiento puede dar VERDE con la punta sin medir. Según REVIEW.md punto 9, lo que no se pudo
  medir es aviso, no verde.
- La mano «punta» es de la escena, no de la pieza: con otra placa queda en otro lugar relativo (lo que `esquinas` ya
  resolvió por pieza).
- Arreglo propuesto:
  1. Armar el polígono solo con los apoyos que la simulación ve y que no están metidos.
  2. Correr la simulación igual y declarar NO APLICA solo si da cerca de 0.
  3. Que NO APLICA haga del total un AVISO (no VERDE).
  4. Permitir `mano_punta` por pieza, como `esquinas`.
- respuesta: ARREGLADO (ronda 1). El polígono se arma solo con los apoyos que la simulación ve y que no están metidos; la punta se simula siempre y es NO APLICA solo si además da 0,05 mm o menos; un NO APLICA deja el renglón de asiento en AVISO y el total no da VERDE. `mano_punta` puede ir por pieza, como `esquinas`.

**I8 · [Importante] TEXTO (REVIEW.md punto 10) — se cambió una regla y nadie dice si las sesiones abiertas la toman.**
`.claude/rules/cad-3d.md` (renglón del GATE A en PRE-ENTREGA, la Elegoo / A2L y la cabecera STEP).
- La regla tiene `paths:` (`.claude/skills/cad-design/**`, `**/*.step`, …). Ni los 10 commits ni la sección
  «Resultados» del plan dicen lo que pide `mejora-implementada.md` punto 2: entra en la sesión que toque esas rutas, y
  la que ya la cargó sigue con la vieja hasta reabrirse. Y solo llega a las sesiones cuando esté en el checkout principal.
- Arreglo propuesto: un renglón en el mensaje de fusión o en el cierre de la madre. No es código.
- Actualización a las 23:55: el árbol tiene un cambio SIN COMMITEAR en el plan, guardado a las 23:52 y que no es mío
  («Qué necesita de Fak, pieza por pieza»). Agrega ese renglón. Con el commit, I8 queda resuelto.
- respuesta: RESUELTO en el plan (sección «Qué necesita de Fak, pieza por pieza»: las sesiones no ven nada hasta que la madre funda la rama; después la regla entra al tocar un archivo 3D y la sesión que ya la cargó sigue con la vieja hasta reabrirse). El cambio sin commitear del plan era de la propia hija: va en el commit de la ronda 1.

## Hallazgos Nit y Preexistente

- **N1 · [Nit] ROBUSTNESS — G-E7 acepta textos de relleno.**
  - Lugar: `gate_entregable.py:78-87` (`_texto_ok` solo rechaza vacío y lo que empieza con «TBD»).
  - Caso medido, los tres sin aviso G-E7:
    - `{"que": "?", "con": "?", "acepta": "?"}`
    - `{"que": "x", "con": "x", "acepta": 0}`
    - `{"que": "-", "con": "a definir", "acepta": "pendiente"}`
  - Hay precedente en la casa: `minCaracteresComo` 25 del pliego.
  - Arreglo: un largo mínimo y una lista de literales («?», «-», «x», «pendiente», «a definir», «N/A»), con su caso en
    el test. Pesa el 24/10, si pasa a freno.
  - respuesta: ARREGLADO (ronda 1). `_texto_ok` rechaza menos de 3 letras o números (salvo que traiga un número) y «pendiente», «a definir», «n/a», «tbd» y parecidos. Los tres casos del informe avisan en el test.
- **N2 · [Nit] ROBUSTNESS + TEXTO — `cabecera_en_orden` reescribe la cabecera entera.**
  - Lugar: `cadlib/step_cabecera.py:21-33`. La expresión regular es la de `catia_medir.py`, que ya existía; lo nuevo es
    usarla con los entregables.
  - Caso medido con una cabecera CRLF que trae un comentario y `FILE_POPULATION`:
    - el comentario y `FILE_POPULATION` desaparecen;
    - la cabecera queda en LF dentro de un archivo CRLF (el docstring dice «finales de línea como estaban»).
  - Caso medido: un `FILE_NAME('pieza);v2',…)` se corta en `FILE_NAME('pieza);` y el resto se pierde. La relectura de
    `export_deliverables.py:377` solo mira el orden, así que la entrega sale con la cabecera rota.
  - Sobre el STEP real de OpenCASCADE 7.8 (`out/v15/virolador_v10_two.step`, 4,6 MB) quedó bien:
    - el resto del archivo, byte a byte igual;
    - las mismas tres entidades;
    - la fecha, igual a 100 ns.
  - Ningún test ejercita el reordenado dentro de `export_deliverables.py`: la `.venv-cad` trae OpenCASCADE 7.9, que ya
    escribe en orden. El STEP de `test_gates_entrega` salió en orden.
  - Arreglo: intercambiar las tres entidades en su lugar y dejar el resto de la cabecera intacto. Comparar el texto de
    las tres antes y después. Un caso con `);` adentro de un texto.
  - respuesta: ARREGLADO (ronda 1). `cabecera_en_orden` intercambia las tres entidades EN SU LUGAR con un lector que respeta comillas y paréntesis; comentarios, FILE_POPULATION y finales de línea quedan como estaban, y compara el texto de las tres antes y después. Casos en `test_step_cabecera.py` (comentario + FILE_POPULATION + CRLF, y «);» adentro de un texto).
- **N3 · [Nit] ROBUSTNESS — `calibrar --casos-sim N` pisa el registro commiteado.**
  - Lugar: `gate_asiento.py:436-437`.
  - Qué pasa: con menos de 150 casos no puede reproducir (el 68 % no sale con 20), así que escribe `reproduce: false`
    en `data/asiento_calibracion.json`. Deja el gate en código 3 y un archivo del repo modificado.
  - Es por diseño seguro (falla cerrado), pero una prueba rápida no debería escribir el registro.
  - Arreglo: escribir el registro solo con los casos de la escena, o con `--registrar`.
  - respuesta: ARREGLADO (ronda 1). `calibrar` con otra cantidad de casos que la de la escena corre y dice si reproduce, pero NO escribe el registro.
- Y 4 nits más, sin detalle:
  - `os.utime` con flotantes pierde 100 ns (inofensivo para G-E2, que tolera 1 s);
  - `gate_proceso.py plantilla` acepta `apoya-sobre-blando,apoya-sobre-rigido` juntas;
  - el `esperado` de la v16 en `asiento_casos.json` no lo compara nada;
  - el test de fijaciones no prueba que `--tuerca-baja` deje el motivo en el `_datos.json`.
- **P1 · [Preexistente]** `test_gates_entrega.py:4`: `SyntaxWarning: invalid escape sequence '\S'`, igual en `main`.
  - respuesta: No se toca: es de `main` (tanda anterior) y no de esta rama.
- **P2 · [Preexistente] FALSE POSITIVE del detector** — `python scripts/_sinFirmaIA.py docs/PLAN_3D_GATE_ASIENTO_2026-10-16.md`
  marca BLOQUEANTE por la ruta `.claude/skills/...` de la parte de arriba (escrita antes de la hija).
  - Lo mismo pasa en `main` con `docs/PLAN_3D_A_FONDO_2026-10-17.md`.
  - Es un plan interno, no un documento de Barack. Ningún archivo de la rama lleva «Claude» en el nombre. Los JSON
    nuevos, la ficha y el banco dan 0.
  - respuesta: Coincido: falso positivo del detector sobre un plan interno que nombra rutas `.claude/`; no se toca acá.

## Lo que se miró y está bien (sin hallazgo)

**La simulación hace las mismas cuentas que el 13/10.**
- Comparé el código renglón por renglón contra `sim_asiento.py` y `sim_asiento_v16.py --error-local`:
  - el orden de sorteos es el mismo (cede, espesor ×3, alabeo; en el gemelo, x, y y amplitud ×6, y después xc);
  - las fórmulas son las mismas;
  - con `cy = 0` y `Ly = 30`, `e2 * (y − cy) / Ly` es exacto;
  - `+ 0.0` no cambia ningún bit;
  - los límites del programa lineal y la tolerancia de contacto 1e-6 son iguales.
- Lo confirmé con la corrida propia de arriba.

**Calibración.** Lo que dice el registro está en los JSON del 13/10:
- v14: 100 y 68;
- v15: 28, con la punta en 1,69 de mediana y 2,37 de máxima;
- gemelo: 66 % con 1,31 de máxima.

La ventana medida (v14 0,228 / 0,243; v15 1,208 / 0,751) cae dentro de la tolerancia de 0,05.

**Escenas sin variantes, y `apriete` ausente.**
- Una escena sin `variantes` corre sin romperse: 3 apoyos, VERDE.
- Sin `apriete`, la ventana queda SIN DATO y el total no da VERDE.

**La pieza en STEP.** `cargar_pieza` usa `caras_libres=False`, que es lo correcto para la pieza. La pieza tiene que
estar en el frame de la escena: si no lo está, ver I1.

**Cabecera y G-E2.**
- G-E2 no se rompe: `export_deliverables.py` copia con `copy2` y `arreglar_archivo` vuelve a poner la fecha.
- El test 7 de `test_gates_entrega` pasa.
- `catia_medir.py` importa la función compartida y `test_catia_medir` da lo mismo que en `main`.

**`make_screw_nut.py`.** El diff solo agrega:
- el docstring;
- `piso_tuerca()`;
- el freno antes de crear la carpeta de salida (lo comprueba el test);
- tres campos en `_datos.json`.

`build_nut` no cambió, y nadie más llama al script.

**Textos.**
- Perfil «0.20mm Standard @BBL A2L», con la herencia leída en
  `%APPDATA%\BambuStudio\system\BBL\process`:
  - `xy_hole_compensation` y `xy_contour_compensation` valen 0 en `fdm_process_common`;
  - `elefant_foot_compensation` vale 0,15 en `fdm_process_single_0.20`;
  - ningún perfil A2L cambia la compensación de agujeros ni la de contorno.
  - Coincide con la ficha FDM M4 y con `impresion-3d-bambu/SKILL.md`.
- En la caché de `uv` está solo la 0.3.83 de build123d-mcp. El `.mcp.json` sin commitear del checkout principal tiene
  `build123d-mcp==0.3.83`. Coincide con `reference/build123d-mcp.md`.
- Los números de SKILL.md, del plan y del banco coinciden con lo medido:
  - v14 0,23 / 0,24;
  - v15 28 y 1,69;
  - v16 0 % con máxima 0,16, punta NO APLICA y gemelo 8 % / 0,54 (`out/sim_v16b_*.json`).
- Lo único que no coincide con el código es lo de I2 y lo de N2.

**La v16 de punta a punta.** `gate_asiento.py verificar --escena upper_trim_two --pieza v16 --workdir C:\Dev\_utrim\gate_asiento`:
ver la tabla de abajo.

## Lo que se corrió

| Qué | Dónde | Resultado |
|---|---|---|
| `test_gate_asiento.py` | rama | exit 0 (36 s) |
| `test_step_cabecera.py` | rama | exit 0 |
| `test_fijaciones.py` | rama | exit 0 |
| `test_gate_entregable_tanda2.py` | rama | exit 0 |
| `test_gates_entrega.py` | rama / main | exit 0 / exit 0; misma salida salvo rutas y horas |
| `test_gates_proceso.py` | rama / main | exit 0 / exit 0; ídem |
| `test_eval_casos_3d.py` | rama / main | exit 0 / exit 0; ídem |
| `test_catia_medir.py` | rama / main | exit 0 / exit 0; idéntica |
| `test_criterios.py`, `test_gate_cuerpos.py`, `test_build123d_mcp.py` (0.3.83, ya en caché) | rama / main | exit 0 en los dos; idénticas |
| `npx vitest run __tests__/scripts/evalBanco.test.mjs` | rama | 7 de 7 |
| Simulación de `sim_asiento.py` copiada, contra `cadlib` (8 casos, semilla 7) | scratchpad, cache del gate | 7 comparaciones iguales; alturas, máscaras y pieza iguales elemento a elemento |
| Candado: copia con un comentario de más / con un umbral cambiado / CRLF↔LF | scratchpad | vigente False / False / True; `verificar` código 3 |
| Candado: escena, umbrales y `a1_apoyos` cambiados | scratchpad | vigente True (I5) |
| v14, v15 y v16 bajadas 0 / 0,06 / 0,10 / 0,20 mm (`fila_apoyos`) | cache del gate | v15 y v16: 4 → 0 apoyos, de ROJO a VERDE (I1) |
| v16 bajada 0,10 como pieza nueva (`evaluar`, 10 casos) | cache del gate | total VERDE (I1) |
| v16 corrida 1000 mm en x | cache del gate | apoyos VERDE «0 apoyos» (I1) |
| Sintéticos: rieles, placa, nervio, dos mesetas, sin variantes | scratchpad | ver I2 |
| Variantes disjuntas con un apoyo metido | scratchpad | informa VERDE (I6) |
| Punta de la v14 (`fila_asiento` y `correr_sim`, 5 casos) | cache del gate | NO APLICA contra 5,92 mm medidos (I7) |
| G-E5 y G-E7 con carpetas temporales; etiqueta rígido contra escena blanda | scratchpad | I3, I4, N1 |
| `arreglar_archivo` sobre un STEP real de OpenCASCADE 7.8 y sobre casos borde | scratchpad | resto igual; N2 |
| `gate_proceso.py plantilla --tags apoya-sobre-blando,apoya-sobre-rigido` | scratchpad | acepta las dos |
| `_sinFirmaIA.py` sobre los archivos nuevos | rama | 0, salvo el plan (P2) |
| `gate_asiento.py verificar --escena upper_trim_two --pieza v16` (50 casos, CLI) | `C:\Dev\_utrim\gate_asiento` | Código 1 (ROJO, modo AVISO): apoyos ROJO (4), 4-2-1 VERDE, no vistos VERDE, ventana 1,21 / 0,75 VERDE, asiento 0 de 100 con máxima 0,16 y punta NO APLICA en las dos variantes, gemelo 8 % con máxima 0,54. Coincide con «Resultados». Agregó un renglón de evidencia al `manifest.json` de ese workdir y escribió `out\auditor_v16_20261017.json` |

Alcance: se auditó HEAD 0b89475a. Al terminar, `git status` mostraba dos archivos modificados que no son de esta
auditoría ni están commiteados:
- `docs/LECCIONES_APRENDIDAS.md` (23:23);
- `docs/PLAN_3D_GATE_ASIENTO_2026-10-16.md` (23:52; ver I8).

No se revisaron.

Archivos de la auditoría: los scripts quedaron en el scratchpad de la sesión (`cmp_sim.py`, `ataque_apoyos.py`,
`ataque_sintetico*.py`, `ataque_variantes.py`, `ataque_entregable.py`, `ataque_nueva.py`, `ataque_frame.py`). No se
modificó ningún archivo del repo salvo este informe.
