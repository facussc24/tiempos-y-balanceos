# Auditoría, ronda 2 (la última) — tanda 11 «diseño 3D a fondo» (17/10/2026)

Revisor independiente, solo lectura. Revisé **solo lo nuevo**: `git diff 3dcaf37d..HEAD` (commits `d04e696a` y
`53ff38ff`) y lo que cambió en `C:\Dev\_utrim` (`build_v10.py`, `params_v10.json`, `sim_asiento_v16.py`,
`choque_v16.py`, `entregar_v16.py`, `verificar_v16.py`). No lancé CATIA, no imprimí y no toqué código ni datos. Todo
lo que corrí fue sobre copias en la carpeta temporal de la sesión (`scratchpad\r2\`) o leyendo nada más. Para saber
qué comando dio cada JSON usé el registro de la sesión (`5849b15b-….jsonl`). Al lado de cada hallazgo hay un
`respuesta: ____` (REVIEW.md).

**Auditado hasta `53ff38ff`.** Mientras escribía entró `7a2dcd20` (09:41), que ya arregla R2-I1, R2-I2 y dos nits. Ese
commit se llevó una versión anterior de este informe, **sin R2-I3**: la medición que lo sostiene terminó a las 09:42 y
a las 09:45. `7a2dcd20` no lo revisé, porque después de la ronda 2 va al cierre. Lo único que miré: la frase de R2-I3
sigue en `docs/PLAN_3D_A_FONDO_2026-10-17.md:162`.

## Resultado: FALLO · 3 Importante, 3 Nit (y 4 más contados), 0 Preexistente

| Severidad | Cuántos | Cuáles |
|---|---|---|
| TRUE BUG | 2 | R2-I2 (la evidencia guardada de CATIA es la corrida que falló), R2-I3 (el «33 %, indeterminado, no físico» no es indeterminado) |
| ROBUSTNESS | 1 Importante + nits | R2-I1 (el eval sigue dando OK sin datos por otras dos puertas) |
| FALSE POSITIVE (revisado, está bien) | 17 | lista al final |

| Check | Estado | Detalle |
|---|---|---|
| Tests de la tanda | OK | `test_eval_casos_3d.py` OK · `test_catia_medir.py` OK (los dos con código 0) |
| Freno de CATIA sin CATIA | OK | `arrancar()` con un `win32com` de mentira: frena si tasklist no contesta (ni llama a `Dispatch`) y frena si la CATIA que contesta tiene 2 documentos (sin `Close` ni `Quit`) |
| La v16 se regenera | OK | `build_v10.py` sobre una copia de los parámetros: la sección DATA del STEP es **idéntica** (md5 `032637ee6951`) a la de la nube, a `out\v16` y a `out\virolador_v10_two.step`; `verificar_v16.py` sobre la copia: TODO OK |
| Choque del entregado | OK | `choque_v16.py` sobre una copia: 0 de 64.343 puntos adentro; luz de los cuatro apoyos 0,55; gemelo 1.031 adentro; TODO OK |
| Firma en los entregables | OK | `_sinFirmaIA.py` sobre los 8 archivos de `v16 - 2026-10-17`, uno por uno: 0 bloqueantes, 0 avisos |
| TypeScript, build, GitHub y CI | no aplica | la ronda solo trae Python y Markdown; la rama sigue sin push, a propósito |

---

## Hallazgos Importantes

### R2-I1 — [Importante] ROBUSTNESS: `eval_casos_3d.py` sigue dando OK sin datos (I3 cerrado para `[]`, abierto por otras dos puertas) · respuesta: ____

**Dónde:** `.claude/skills/cad-design/scripts/eval_casos_3d.py:129` (A3 se calcula solo `if normal is not None`),
`:136-141` (si el veredicto esperado es `None` no hay falla: `elif got is not None …`), `:124` (`--solo` con un
nombre que no existe no evalúa nada) y `:21` (el encabezado dice «2 si faltan datos»; el script no tiene ningún
`exit(2)`: `:170` devuelve solo 1 o 0).

**Qué pasa.** El arreglo hace fallar la simulación **vacía** (`[]`), pero no la simulación que **no se pasó**, y la v16
no tiene `esperado.A3_asiento` ni `sim_publicada`, así que su «SIN DATO» no cuenta nunca. Medido:

| Comando (`python eval_casos_3d.py --casos ../data/casos_3d.json …`) | Resultado |
|---|---|
| `--sim-normal vacio.json --sim-punta vacio.json` | 4 fallas, código 1 (bien: es lo que arregló I3) |
| `--sim-normal sim_asiento_repro_1017.json` sin `--sim-punta` | v15 `reproduce_lo_publicado: null` y 1 falla, código 1 (bien) |
| **sin ningún `--sim-…`** (la llamada que sugiere `SKILL.md:367`) | **RESULTADO: OK, código 0**. v14 y v15 esperan `A3_asiento: ROJO` y no se compara |
| `--sim-normal sim_asiento_repro_1017.json --sim-punta sim_asiento_repro_punta_1017.json`, sin `--solo` | **OK, código 0**. La v16 da `A3 SIN DATO` y no falla |
| `--solo v16` sin ninguna corrida | **OK, código 0** (no imprime ni la línea de A3) |
| `--solo v61` (mal escrito) | **OK, código 0** sin evaluar ninguna pieza |

El test nuevo no lo ve. «Simulación vacía» se prueba con `[]` y nunca con `None` (`test_eval_casos_3d.py:68`). Y
«sin --solo, vY sin corrida es FALLA» (`:72-76`) usa una vY de mentira que **sí** tiene `esperado.A3_asiento`, y la v16
real no lo tiene. El mensaje del commit (`d04e696a`: «SIN DATO falla salvo --solo») no se cumple para la pieza que se
está diseñando. REVIEW.md §9: no pudo medir es aviso, nunca verde.

**Qué haría.** Si una versión tiene `A3_asiento` en `esperado` o tiene `sim_publicada`, que una corrida que falta (no
solo una vacía) cuente como falla. Para la v16, o se le agrega `esperado.A3_asiento`, o el SIN DATO de cualquier pieza
que no se excluyó con `--solo` cuenta como falla. Que `--solo` con un nombre que no está en `casos_3d.json` salga con
error. Y que el código 2 del encabezado exista, o que el encabezado no lo prometa. Faltan tres tests: sin `--sim-normal`
→ código ≠ 0; la v16 real sin corrida → falla; `--solo` desconocido → error.

### R2-I2 — [Importante] TRUE BUG: el JSON de CATIA guardado para la v16 entregada es el de la corrida que falló · respuesta: ____

**Dónde:** `docs/PLAN_3D_A_FONDO_2026-10-17.md:172` (V5: «CATIA: 89.278,482 mm³ = build123d 89.278,483, sin choque,
solo contacto») y `.claude/skills/cad-design/reference/catia.md:36` (renglón nuevo «v16 entregada (placa 168)»). La
evidencia la ubica `catia.md:4` en `.sgc-cache/catia-2026-10-17/`. Lo que reporto es la **cita**: la carpeta
`.sgc-cache` no la reviso como código.

**Qué pasa.** `.sgc-cache\catia-2026-10-17\catia_v16_final.json` (09:14:06) dice `"archivos": []`,
`"documentos_que_quedaron": 1` y `"catia_sigue_abierta": true`. Es la corrida de las 09:11, que se frenó en el
chequeo de nombre de `d04e696a` («Abri virolador_v16_two_cabecera.step y el documento activo es
virolador_v16_two_cabecera.CATPart»). El registro de la sesión muestra que la copia a `.sgc-cache` se hizo a las
09:14:05, **antes** de la segunda corrida (09:14:49). Esa segunda corrida, la buena (89.278,482 contra 89.278,483;
contacto 0,0; 53,9 s; CATIA cerrada, 0 documentos), quedó solo en
`C:\Users\FACUND~1\AppData\Local\Temp\claude\…\5849b15b-…\scratchpad\catia_v16_final.json` (09:16:10). Ese archivo
temporal se borra con la sesión. Después, la cifra del plan y de `catia.md` queda sin fuente, y el único archivo
guardado dice lo contrario: que no midió y que CATIA quedó abierta.

**El número está bien.** Lo confirmé: build123d sobre el STEP de la nube da 89.278,483 mm³, y la sección DATA de la
nube es la misma que la del archivo que midió CATIA (md5 igual, arriba).

**Qué haría.** Copiar el JSON de las 09:16 encima del de `.sgc-cache` (o guardarlo al lado con otro nombre y dejar el
fallido como `…_fallida_0911.json`), y nombrar el archivo en V5 del plan.

### R2-I3 — [Importante] TRUE BUG: «con la mano justo encima de un apoyo el programa lineal queda indeterminado (33 %, no físico)» no es indeterminado · respuesta: ____

**Dónde:** `docs/PLAN_3D_A_FONDO_2026-10-17.md:161-162` (punto 5). Es la única frase de la rama que todavía afirma de
la punta algo que los datos no dicen: la causa que da no se midió, y medida no es esa.

**Caso medido 1, ¿es indeterminado?** Armé un lanzador, `scratchpad\r2\degen.py`, que corre en memoria la misma copia de
`sim_asiento_v16.py` sin tocar el archivo. Solo le agrega una medición a `reposo()`: después de encontrar el óptimo, por cada
una de las 4 esquinas calcula la altura mínima y la máxima entre **todas** las poses que dan ese mismo óptimo
(tolerancia 1e-6 mm, 8 programas lineales más por mano). Lo corrí con 30 casos, la mano en x −35,8 / 125,6 (las de
`sim_v16b_punta_apoyos.json`) y las esquinas en −38,1 / 127,9. Resultado: 360 soluciones, y entre poses óptimas las
esquinas varían **0,0003 mm de mediana y 0,0035 mm como máximo** (0 % arriba de 0,01 mm). La pose está determinada. La
misma corrida da la métrica publicada (30 % > 0,3 mm, máximo 0,81; el archivo de 150 casos da 33 % y 0,81). El 33 % es
una salida del modelo con el mismo peso que el 0 % y el 28 %.

**Caso medido 2, ¿de dónde sale?** Con el lanzador `scratchpad\r2\sin_alabeo.py` cambio una sola línea por corrida.
Mismos 30 casos, misma mano:

| Corrida | % > 0,3 mm | Máx. |
|---|---|---|
| igual (control) | 30 % | 0,81 |
| sin el alabeo de la pieza impresa (`g = H - T`; el sorteo se hace igual, no se aplica) | **0 %** | 0,16 |
| sin el tope del plástico bajo el tapizado | 27 % | 0,88 |

Lo que lo mueve es el **alabeo**: con la mano encima del apoyo de una punta, el modelo rígido apoya la cara plana de 3 mm
de ese apoyo, que el alabeo dejó inclinada, y lleva esa inclinación hasta la otra punta. ¿Es físico? **Falta
verificar.** Esa cara inclinada es de centésimas sobre 3 mm, el tapizado la puede absorber, y el modelo no lo sabe.
Con la mano adentro (la corrida normal) no pasa: 0 %.

**Qué cambia.** El veredicto no: la punta igual la decide la prueba física, y el PDF no usa el 33 %. Lo que cambia es
lo que queda escrito. De las corridas de la rama, es el único caso de «apretar en la punta» que el modelo resuelve sin
llegar al tope de giro, y queda afuera de los umbrales de V3 (33 % contra ≤ 10 %; 0,81 contra ≤ 0,5). Su mediana
(0,13) cumple la de V4 (≤ 0,5). **Qué haría:** reemplazar la frase por lo medido: «con la mano encima de los apoyos de
las puntas da 33 % y 0,81 mm (150 casos); lo mueve el alabeo sorteado de la pieza (sin alabeo, 0 % en 30 casos); si el
tapizado lo absorbe, lo dice la prueba 2».

---

## Nits (los 3 que más se notan)

- **[Nit] ROBUSTNESS: `catia_medir.py:333` y `:357`** · respuesta: ____. **Ningún camino nuevo cierra un documento
  ajeno**, pero el corte por nombre o por cantidad de documentos deja **nuestra** CATIA abierta a propósito («no lo
  cierro»: `quedan` ≠ 0, no hay `Quit`). Pasó de verdad a las 09:11: el CNEXT 21016 quedó con
  `virolador_v16_two_cabecera.CATPart` y la sesión lo cerró a mano a las 09:14 con un `GetActiveObject` armado en el
  momento, que no está en el script ni en `catia.md`. Falla cerrado (la corrida siguiente se niega), pero no dice cómo
  salir. Qué haría: que el mensaje dé el pid y el nombre del documento, y que `catia.md` diga cómo cerrarla. **Pregunta
  (falta verificar, sin CATIA no se puede):** un STEP que CATIA abra como producto con piezas adentro (el caso que
  `medir_documento` contempla) ¿sube `Documents.Count` en más de uno? Si sube, el chequeo de `:332` lo corta siempre.
  Todos los STEP medidos hoy entraron como `pieza`.
- **[Nit] ROBUSTNESS: las corridas de la v16 miden otras esquinas que las de la v15** · respuesta: ____. Las seis
  corridas `sim_v16b_*` se lanzaron con `--esq-x=-38.1,127.9` (registro, 12:04:54Z y 12:07:51Z), y las de la v15 con las que se
  comparan («28 % → 0 %», «66 % → 8 %» en el plan y el PDF) miden en −35 / 125. Esto **favorece a la v15**: con las
  esquinas más afuera, el mismo giro da más hamaca, así que la comparación sigue valiendo. Lo que falta: el plan no lo
  dice y `sim_asiento_v16.py` no anota en el JSON dónde puso la mano ni las esquinas, así que el archivo solo no alcanza
  para saber qué se midió. Qué haría: agregar `mano` y `esquinas` al JSON de salida.
- **[Nit] `docs/PLAN_3D_A_FONDO_2026-10-17.md:160`** · respuesta: ____. Dice que en la iteración de 172 mm «esos puntos
  caían **sobre** los apoyos». Caían **adentro del polígono** de apoyos, entre ellos: x = −30 contra una cara plana
  de −37,0 a −34,0 (ronda 1). Lo dice bien la tabla del mismo plan («caen adentro de los apoyos») y el `_x_two_v16`.
  Así escrito se mezcla con el otro caso, el de la mano justo encima de un apoyo (el 33 %).

**Y 4 nits más**, contados (ninguno cambia un veredicto):
1. El A3 de la v16 en el eval sale **VERDE** con `sim_v16b_punta_apoyos.json`, el 33 % que el plan llama «no físico»
   (la sesión lo corrió así a las 12:18:34Z y no lo publicó), y **ROJO** con `sim_v16b_punta.json` (33,34 mm).
   `casos_3d.json` no marca que la punta de la v16 no se puede medir. El veredicto depende de qué archivo se le pasa.
2. `choque_v16.py` muestrea sin semilla: el gemelo dio 1.006 en el archivo y 1.031 en mi corrida. No cambia el
   veredicto (> 0), pero el número del plan no se reproduce exacto.
3. `entregar_v16.py --reemplazar` pisó la carpeta de la nube con la iteración de 172 mm adentro. El comentario dice
   «nadie la uso», sin nada que lo respalde. No quedaron archivos viejos: los 8 son de 09:09-09:16.
4. Cuando el corte por nombre deja CATIA abierta, el bucle de `:359` espera los 30 s completos a un pid que no se va
   a cerrar.

---

## Lo que pidió el encargo, punto por punto

**1. ¿I1 quedó bien dicho?** En el PDF y en B2, sí. En la rama queda una frase, la del 33 % «indeterminado» (R2-I3).
El «0,00 en la punta» no aparece más: busqué «0,00» y «punta» en `cad-design`, el plan y la investigación, y lo único
con 0,00 es `gate_giro` (lecciones-caras, otro tema). Contra los JSON:

| Lo que dice | JSON | ¿Coincide? |
|---|---|---|
| v16, mano 1 mm adentro del borde (x −38,1 / 127,9): 33,34 mm | `sim_v16b_punta.json` (33,34 / 33,57 / 100 %) | sí |
| v15 en su borde (x −36,1 / 125,9): 35,79 mm | `sim_v15_punta_borde.json` (35,79 / 36,06) | sí |
| Mano encima de los apoyos (x −35,8 / 125,6): 33 % | `sim_v16b_punta_apoyos.json` (0,13 / 0,81 / 33 %) | sí el número |
| «1 mm adentro del extremo» | placa −39,107 a 128,893 (STEP de la nube) | sí (1,007 / 0,993) |
| apoyos a 0,3 mm de los extremos | apoyos −38,807 a −32,807 y 122,593 a 128,593 | sí |
| voladizo más allá de la cara plana 4,1 → 1,8 mm | nominal 0,3 + R1,5 = 1,8. En el STL, la cara a menos de 3 µm del tope arranca en −37,394: los primeros 0,09 mm del redondeo bajan menos de 3 µm | sí |
| «vuelca hasta su tope» | 33-36 mm = el tope de giro del programa (0,2 rad por ~165-180 mm) | sí |

El PDF de la nube (página 1, autor «Facundo Santoro», sin creador ni productor) dice: «Apretando en el borde mismo de
la placa: la simulación no lo puede decir (vuelca a la v15 y a la v16 por igual: no ve el anillo agarrado en el
vinilo). Lo dice la prueba 2.» Y la prueba 2 pide apretar «en el borde de las dos puntas». Que el modelo no ve el
agarre del anillo es cierto: el programa lineal solo impide atravesar (`A_ub`), y nada sujeta la pieza contra el panel.
B2 de `ficha-utillajes.md` está alineado.

**Lo que sigue abierto de I1:** la frase del plan `:161-162`, que dice que el 33 % con la mano encima de un apoyo es
«indeterminado, no físico». Medido, no es indeterminado; lo mueve el alabeo (R2-I3).

**2. ¿I2?** La geometría está cerrada. Nube = `out\v16` = `out\virolador_v10_two.step` = mi regeneración (misma DATA).
build123d da 89.278,483, CATIA 89.278,482 (en la corrida de las 09:16). `choque_v16.py` reproduce: 0 adentro, 0,55 en
los cuatro apoyos, gemelo > 0. El STL que usan el choque y la simulación (`out\v16\virolador_v16_two.stl`, 89.278,729
mm³ de malla) sale del mismo B-Rep. Lo que no está cerrado es dónde quedó guardada la evidencia de CATIA: R2-I2.

**3. ¿I3?** Para `[]`, sí: falla. Sin `--sim-punta`, da `null` y falla. `--solo` excluye y lo dice. Pero sin
`--sim-normal`, con la v16 sin corrida y con un `--solo` mal escrito sigue dando OK (R2-I1).

**4. ¿I4?** Sí, falla cerrado. Si tasklist no contesta, `arrancar()` se niega antes de importar COM (probado con un
`win32com` de mentira: ni llama a `Dispatch`). Si la CATIA que contesta ya tiene documentos, se niega sin `Close` ni
`Quit` (probado). Comparar el nombre sin extensión anduvo en la corrida real de las 09:14 (0 documentos, CATIA
cerrada). **Ningún camino nuevo cierra un documento ajeno.** El único `Quit` sobre una CATIA que no es nuestra sería
que `Dispatch` se enganche a una CATIA ajena **sin documentos** en el segundo que pasa entre tasklist y `Dispatch`:
no hay nada que perder. Sí hay un camino que **deja CATIA abierta**, y pasó (nit 1).

**5. La v16 final.** `params_v10.json`: `x_two` 168, `apoyos_v16` en x −35,807 / 125,593, `pie: false`, y ya no está la
clave muerta `x_two_v15`. Se regenera idéntica y `verificar_v16.py` da verde (arriba). Números del plan contra los JSON:

| Plan | JSON | ¿Coincide? |
|---|---|---|
| 0 % · 0,16 | `sim_v16b_normal.json` (0 / 0,16 / mediana 0,0) | sí |
| gemelo 8 % · 0,54 | `sim_v16b_gemelo_normal.json` | sí |
| 1 h 25 min · 60,6 + 1,9 g | `laminado_final\resumen.json` (1h 25m 30s; 60,61 / 1,89) | sí |
| PDF «62 g» | 62,50 redondeado | sí |
| anillo = v15 a 0,0004 mm | `verif_v16_two.json` (0,000358; mi corrida 0,0002, el muestreo no tiene semilla) | sí |
| 0 de 64.343 · 0,55 · gemelo 1.006 | `out\v16\choque_v16.json` | sí (gemelo: nit 2) |
| CATIA 89.278,482 = 89.278,483 · 54 s | solo en el scratchpad de la sesión | sí el número; R2-I2 |
| gcode entregado | md5 `7d8b021694`, igual al de `laminado_final` | sí |

**Lo que queda abierto para Fak (no es nuevo de esta ronda):** la entrega sigue sin pasar por `export_deliverables.py`
ni por `gate_entregable.py`. `choque_v16.py` es un chequeo propio y está bien hecho, pero no es el `check_collision`
del GATE 3. La punta la decide la prueba física (V4 no se puede medir en la simulación). Y falta la simulación grabada
del GATE E.

## Falsos positivos (lo que parecía y está bien)

1. Ninguna frase de la rama ni del PDF afirma «0,00 en la punta». 2. 33,34 / 35,79 / 33 % coinciden con sus JSON.
3. El «1 mm adentro» coincide con el borde real. 4. Apoyos a 0,3 mm. 5. El voladizo 1,8 nominal (el 1,71 es el redondeo
visto en la malla). 6. «Vuelca hasta su tope» es el tope de giro del programa. 7. El modelo no tiene nada que sujete la
pieza: «no ve el anillo agarrado» es cierto. 8. La v16 se regenera idéntica. 9. `verificar_v16.py` en verde y su gemelo
en rojo. 10. El choque reproduce. 11. La nube tiene la misma geometría que midió CATIA. 12. El STL del choque y de la
simulación sale del mismo B-Rep. 13. Gcode entregado = el laminado final. 14. `_sinFirmaIA` limpio en 8 de 8.
15. `arrancar()` falla cerrado, probado sin CATIA. 16. Esquinas distintas entre la v15 y la v16: favorece a la v15
(nit 2). 17. Se arreglaron los nits de la ronda 1 que se tocaron: `SKILL.md:364`, la tolerancia 0 / 0,01 con su
fuente, E3, U6, R2, la etiqueta del cuadro *Cancel*, `--frame`, que ahora frena, la regeneración de la v15 escrita y
la clave muerta borrada.
