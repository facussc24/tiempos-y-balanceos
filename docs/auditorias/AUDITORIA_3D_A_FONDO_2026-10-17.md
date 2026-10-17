# Auditoría — tanda 11 «diseño 3D a fondo» (17/10/2026)

Revisor independiente, solo lectura. Rama `claude/3d-a-fondo-1017` (worktree `.claude/worktrees/3d-a-fondo-1017`), sin
push. Se revisaron los 7 commits `8eed9c79..78131ef4` y, como la rama siguió avanzando durante la auditoría, también lo
que cambió de la tanda 11 en `6fadd6a5..3dcaf37d` (sobre todo `8dd4a702`, el arreglo de lo que marcó el revisor del
pedido). El merge de `main` trajo bancos de otras áreas: esos no se revisaron. No se lanzó CATIA, no se imprimió nada, no
se tocó código ni datos: todo lo que corrí fue sobre copias en la carpeta temporal de la sesión o en modo lectura.
**Auditado hasta `3dcaf37d`** (08:51). Al lado de cada hallazgo hay un `respuesta: ____` para que quien lo reciba anote
arreglado / rechazado / a propósito / no importa (REVIEW.md).

## Resultado: FALLO · 4 Importante, 3 Nit (y 13 nits más contados abajo), 1 Preexistente

| Severidad | Cuántos | Cuáles |
|---|---|---|
| TRUE BUG | 2 | I1 (la «punta» de la simulación no mira la punta de la v16), I2 (CATIA midió otra geometría que la entregada) |
| ROBUSTNESS | 2 Importante + nits | I3 (el eval da OK sin datos), I4 (el freno de CATIA ajena falla abierto) |
| FALSE POSITIVE (revisado, está bien) | 14 | lista al final |

| Check | Estado | Detalle |
|---|---|---|
| TypeScript | OK | `npx tsc --noEmit` en `78131ef4` y otra vez en `3dcaf37d` (el merge trajo `scripts/_exportAmfeOficial.ts`): 0 errores |
| Build | OK | `npm run build` en `78131ef4` y en `3dcaf37d`: construye (solo el aviso de tamaño de chunks) |
| Git local | OK | árbol limpio |
| GitHub | a propósito | la rama no tiene upstream: el encargo dice «sin push». No es hallazgo |
| CI | no aplica | la rama no está en GitHub |
| Tests de la tanda | OK | `test_catia_medir.py` OK · `test_eval_casos_3d.py` OK · `vitest evalBanco.test.mjs` 7/7 · `_evalBanco.mjs --banco cad-design --seco` arma los 3 casos |
| Dependencias | OK | `npm ls --depth=0`: 0 problemas; la rama no toca `package.json` |
| Firma en los entregables | OK | `_sinFirmaIA.py` sobre los 8 archivos de la carpeta `v16 - 2026-10-17` (uno por uno): 0 bloqueantes, 0 avisos |

---

## Hallazgos Importantes

### I1 — [Importante] TRUE BUG: «apretando en la punta: 0,00 mm» de la v16 se midió con la mano adentro de los apoyos · respuesta: ____

**Dónde:** `C:\Dev\_utrim\sim_asiento_v16.py:95` (la línea `MANO` copiada del original `sim_asiento.py:89`: la mano
«en la punta» aprieta siempre en x = −30 y x = 120); el número va a `docs/PLAN_3D_A_FONDO_2026-10-17.md:135` y `:158`
(V4 VERDE, 0,00 mm), a `.claude/skills/cad-design/reference/ficha-utillajes.md:30` (B2, agregado en `8dd4a702`:
«la v16 … en 0 de 100 y 0,00 mm») y al PDF entregado (`C:\Dev\_utrim\entregar_v16.py:82`: «apretando en la punta:
1,69 mm -> 0,00 mm»).

**Qué pasa.** Las posiciones de la mano son coordenadas fijas pensadas para la placa de 164 mm de la v14/v15. La v16
tiene la placa de 172 mm y los apoyos en las esquinas: medido sobre `out\v16\virolador_v16_two.stl`, la placa va de
x = −41,107 a 130,893 y la cara plana de los apoyos (z −10,334) va de x = −37,0 a −34,0 (y de 123,8 a 126,8 del otro
lado). O sea, x = −30 y x = 120 quedan **adentro** del polígono de apoyos, y hay 4,1 mm de placa por punta afuera de él
que la simulación nunca aprieta. Por eso en la v16 la corrida «punta» da **exactamente** lo mismo que la normal
(`sim_v16_punta.json` y `sim_v16_normal.json`, fila v16: 0,0 / 0,16 / 0 % / 0,07; y el gemelo igual: 0,11 / 0,53 / 6 %),
mientras en la v15 dan distinto (0,13 contra 1,69). El prototipo de cuatro discos estaba en x = −30/120 y en la
«punta» daba 31 % (`proto_v16_punta.json`); al correr los apoyos a −35,5/125,3 la métrica pasó a cero porque los
apoyos se fueron más allá del lugar donde aprieta la mano, no porque se haya medido la punta.

**Caso medido** (misma simulación, mismo STL, misma semilla, 150 casos, listones tapados; solo cambian las x de la mano
«punta»):

| Mano en x | Hamaca mediana | Hamaca máx. | % > 0,3 mm |
|---|---|---|---|
| −30 / 120 (lo publicado; reproducido igual) | 0,00 | 0,16 | 0 % |
| −36 / 126 (sobre la cara del apoyo, cerca del borde) | 0,12 | 0,78 | 32 % |
| −38 / 128 (1 mm afuera de la cara del apoyo) | 32,13 | 32,38 | 100 % |
| −40 / 130 (1,1 mm adentro del borde de la placa) | 32,13 | 32,38 | 100 % |

**«Son los mismos puntos que en la v15»** es cierto y no alcanza: lo que importa no es la distancia al borde sino de qué
lado del polígono de apoyos cae la mano. En la v15, x = −30/120 quedaba **afuera** de los bloques (por eso volcaba hasta
la oreja, 1,69 mm); en la v16 queda **adentro**. La fila más firme de la tabla es la de x = −36/126 (la mano sobre el
apoyo): no depende del tope del programa lineal, pasa el umbral de V4 (mediana 0,12 ≤ 0,5) pero queda afuera de los de
V3 (32 % contra ≤ 10 %; máximo 0,78 contra ≤ 0,5).

Los 32 mm de las otras dos filas son el tope de giro del programa lineal de la simulación (0,2 rad × ~160 mm): en el
modelo **nada frena el vuelco**, porque la v16 ya no tiene las orejas antivuelco de la v15 (en la v15 la oreja lo paraba en 1,7 mm). Si eso
pasa en la pieza real **falta verificar**: la simulación no modela el anillo agarrado en el vinilo de la ranura, que
puede frenar el giro. Tampoco separé si el 32 % de x = −36 es físico o una degeneración del programa lineal cuando la
mano cae justo encima de un apoyo. Lo que sí está medido: el 0,00 mm que dicen el plan, la ficha B2 y el PDF no es de
la punta de la v16.

**Cómo reproducirlo** (sin tocar `sim_asiento_v16.py`): un lanzador que lee el archivo, reemplaza el texto
`for x in (-30, 120) for y in (-18, 0, 18)]` por `for x in (-40, 130) for y in (-18, 0, 18)]` y lo ejecuta con
`sys.argv = ["sim_asiento_v16.py", r"C:\Dev\_utrim", "<salida.json>", "--punta",
r"v16=C:\Dev\_utrim\out\v16\virolador_v16_two.stl"]`, con el Python del `.venv-cad`. Tarda unos 4,5 min por corrida.

**Qué haría.** (1) En la copia de la simulación, derivar la mano «punta» del borde real de la placa (por ejemplo a 2 mm
del borde, leído de `cotas_v10_two.json` → `huella`) en vez de un número fijo, y correr de nuevo V4; (2) con ese número,
decidir si la v16 necesita un tope antivuelco (regla B3 de la propia ficha) o acortar los 4 mm de voladizo; (3) corregir
el renglón del PDF, el V4 del plan y la cita de B2. La prueba física que pide el PDF (apretar «en las dos puntas») ya
va a mostrar el caso: conviene que diga **en el borde de la placa, afuera de los apoyos**.

### I2 — [Importante] TRUE BUG: la medición y el choque de CATIA son de la v16 anterior, no del STEP entregado · respuesta: ____

**Dónde:** `docs/PLAN_3D_A_FONDO_2026-10-17.md:159` (V5 VERDE: «CATIA: 91.206,744 mm³ = build123d 91.206,745; sin choque
contra el panel, solo contacto»); evidencia `.sgc-cache/catia-2026-10-17/catia_v16.json` (corrida de las 07:44).

**Qué pasa.** CATIA midió `out\v16\virolador_v16_two.step` a las 07:44, con los apoyos de 6 × 6. A las 07:50 se cambió
`apoyos_v16` a 6 × 10, se regeneró el STEP (`out\virolador_v10_two.step` 07:50, `out\v16\virolador_v16_two.step`
07:52) y eso es lo que se entregó. Medido con build123d:

| Archivo | Volumen |
|---|---|
| Lo que midió CATIA (07:44) | 91.206,744 mm³ |
| `out\v16\virolador_v16_two.step` de hoy | 91.890,292 mm³ |
| `v16 - 2026-10-17\VIROLADOR v16 - 2 ranuras (sin grabado).step` (la nube) | 91.890,292 mm³ |
| `verif_v16_two.json` (`vol_brep`) | 91.890,29 mm³ |

683,5 mm³ de diferencia: es el agrandado de los cuatro apoyos. El choque «sin choque, solo contacto» también es de la
geometría de 6 × 6. Y en `C:\Dev\_utrim` no hay ningún archivo de `check_collision` ni `manifest.json` de hoy (busqué
todo lo escrito después de las 06:00): el V5 del criterio pedía «`check_collision` 0 puntos dentro y asienta» y para
la pieza entregada no hay evidencia guardada. La entrega se hizo con `entregar_v16.py` (copia directa a la nube) y no
pasó por `export_deliverables.py` ni `gate_entregable.py`, que son los que frenan una entrega sin evidencia de choque del
archivo final (`cad-3d.md`, GATE 3: «se verifica el archivo que se entrega, no el diseño»). Que falta la simulación
grabada el plan sí lo dice; que el choque es de otra geometría, no.

**Qué haría.** Correr `check_collision` sobre el STEP entregado y guardar la salida; repetir `catia_medir.py medir
--step <entregado> --choque <panel en el marco local> <entregado> --cadlib` cuando la PC esté libre (es CATIA: con el OK
de Fak); mientras tanto, corregir V5 en el plan para que diga que la medición de CATIA es de la iteración 6 × 6.

### I3 — [Importante] ROBUSTNESS: `eval_casos_3d.py` dice «OK» cuando no pudo medir · respuesta: ____

**Dónde:** `.claude/skills/cad-design/scripts/eval_casos_3d.py:123` (cambio de `78131ef4`: un veredicto `SIN DATO` ya no
cuenta como contradicción), `:85` y `:87` (la comparación contra lo publicado se saltea si falta la fila o el archivo).

**Qué pasa.** REVIEW.md §1 y §9: un control que afloja sin test en las dos direcciones, y que falla abierto. Medido:

| Entrada | Lo que dice el eval |
|---|---|
| `--sim-normal vacio.json --sim-punta vacio.json` (`[]`) | A3 `SIN DATO` en las tres piezas · **RESULTADO: OK, código 0** |
| `--sim-normal sim_asiento_repro_1017.json` sin `--sim-punta` | v15 `reproduce_lo_publicado: true` sin haber comparado el 1,69 mm publicado · OK |
| corrida del gemelo (v15 66 % contra 28 %) | FALLA, código 1 (bien) |
| normal y punta cruzados | 2 fallas, código 1 (bien) |

Antes de `78131ef4` una pieza sin corrida hacía fallar el eval; el cambio se hizo para poder correr la simulación de la
v16 (que no trae la v14), pero `test_eval_casos_3d.py` no tiene ningún caso de «falta la corrida». Lo mismo vale para
el renglón nuevo A1b (`8dd4a702`): sin `apoyos_superficie` da `SIN DATO` y tampoco cuenta.

**Qué haría.** Que `SIN DATO` cuente como falla salvo que la pieza se excluya a propósito (`--solo v15,v16`), que
`reproduce_lo_publicado` sea `true` solo si se comparó **cada** número publicado (si falta, `null` y aviso), y dos tests:
simulación vacía → código 1; sin `--sim-punta` → no dice `true`.

### I4 — [Importante] ROBUSTNESS: el freno de «CATIA ajena» falla abierto · respuesta: ____

**Dónde:** `.claude/skills/cad-design/scripts/catia_medir.py:41-48` (`cnext_abiertos()` devuelve `[]` si `tasklist` da
error o tarda más de 20 s), `:146-149` (`arrancar()` sigue si la lista vino vacía), `:321` (después de `Open` toma
`c.ActiveDocument` sin comprobar que sea el que abrió) y `:338-342` (cierra todo lo de `abiertos`).

**Caso medido** (sin CATIA): `cnext_abiertos()` con el PATH vacío → `[]`; con `subprocess.run` que tira
`TimeoutExpired` → `[]`. O sea, «no pude mirar» se lee como «no hay CATIA». Según el propio script (su encabezado y el
plan), con una CATIA abierta `Dispatch("CATIA.Application")` se engancha a esa. Si además un `Open` falla callado
(`DisplayFileAlerts = False`), el documento activo de Fak entra a `abiertos` y se cierra al final, sin guardar. Son dos
cosas que tienen que pasar juntas: probabilidad baja, daño alto. La parte que no verifiqué es el enganche de `Dispatch`
(no lancé CATIA).

**Qué haría.** Si `tasklist` falla o tarda, negarse (fallar cerrado); después de `Dispatch`, comprobar que hay
exactamente un CNEXT nuevo y que `c.Documents.Count == 0`; y después de cada `Open`, comprobar que `Documents.Count`
subió en uno y que `ActiveDocument.FullName` es la copia que se abrió. Test: `cnext_abiertos` con `tasklist` caído
tiene que frenar.

---

## Nits (los 3 que más se notan)

- **[Nit] ROBUSTNESS: `.claude/skills/cad-design/SKILL.md:364`** · respuesta: ____ — sigue diciendo que la ficha de utillajes trae «tres apoyos con la
  mano adentro del triángulo». Desde `95e04d0e` la ficha dice tres **o cuatro** según dónde aprieta la mano (U8), y
  `8dd4a702` ya alineó el banco, `ingenieria-de-producto.md` y el informe; este renglón quedó viejo. Qué haría: «tres o
  cuatro apoyos (U8) según dónde aprieta la mano».
- **[Nit] ROBUSTNESS: `.claude/skills/cad-design/data/casos_3d.json:12-13`** · respuesta: ____ — `reproduccion_tol_pct: 5` y `reproduccion_tol_mm: 0,15`
  no tienen fuente (ni el plan ni las fichas los nombran). La simulación tiene semilla fija y hoy reprodujo exacto: la
  tolerancia que corresponde es 0, o se escribe de dónde sale.
- **[Nit] ROBUSTNESS: `.claude/skills/cad-design/reference/ficha-utillajes.md:55` (E3)** · respuesta: ____ — dice «≥ 100 mm (≈ 120 con guantes)».
  CCOHS (`ccohs.ca/oshanswers/ergonomics/handtools/tooldesign.html`, abierta hoy) dice «not less than 100 mm … around
  120 mm are generally recommended. Keep in mind that the use of gloves requires longer tool handles»: el 120 es lo
  recomendado en general, y con guantes «más largo» sin número.

**Y 13 nits más**, contados (todos ROBUSTNESS: ninguno cambia un veredicto):
1. U6 (`ficha-utillajes.md:17`) dice «cita a Henriksen»: en el PDF el 40 % es un «Rule-of-Thumb» sin cita (el autor
   citado en otras páginas es «Hendriksen»).
2. R2 (`ficha-fdm.md:54`) «ISO 4032 mide 0,83-0,85·D»: vale para M6 a M10; M5 da 0,94·D y M3-M4 0,80·D (fasten.it).
3. `catia_medir.py:131` anota «NO tocado (más de un botón)» al cuadro «Converting Data…», que tiene **un** botón
   (*Cancel*): la regla está bien, la etiqueta miente (`catia_v14.json`).
4. `catia.md:41` «64 s la primera vez del día»: no hay corrida con 64 s en `.sgc-cache/catia-2026-10-17/`.
5. `PLAN…:142` «todas las variantes de triángulo, con y sin topes, dieron 100 %»: es cierto para las 4 de
   `proto_v16.json`; las dos de `proto_gemelo2.json` (tres apoyos + tope a 0,05 / 0,10) dieron 32 % y 40 % en el gemelo,
   contra 26 % de los cuatro discos. No cambia la decisión, pero «todas» no es exacto.
6. La corrida de CATIA de la v16 terminó con `"catia_sigue_abierta": true` (todavía con la espera de 3 s); la espera de
   30 s se commiteó después (`95e04d0e`, 07:53) y no hay corrida que la pruebe. Hoy no hay ningún CNEXT corriendo.
7. La opción `--frame` (`catia_medir.py:259`) sigue andando y devuelve un choque que la propia `catia.md` dice que es
   falso: mejor que frene en vez de un comentario.
8. `copia_con_cabecera` lee con `errors="replace"` y escribe UTF-8 (un STEP con un nombre en Latin-1 sale cambiado en la
   copia) y descarta cualquier otra entidad de la cabecera; el test no tiene una cabecera con comentarios `/* */`.
9. El banco `cad-design` no separa «aprendió la regla» de «reconoce el caso»: la skill trae los tres casos con los mismos
   números del prompt (`ingenieria-de-producto.md` §5, `casos_3d.json`). Una variante con otros números lo separaría.
10. El PDF dice «La simulación trata el vinilo como rígido»: la simulación sí sortea cuánto cede (0 a 0,6 mm parejo);
    lo que no modela es el cedido local bajo cada apoyo.
11. Fuera del repo, comentarios viejos en la carpeta de trabajo: `build_v10.py` («TRES APOYOS CHICOS … TOPES con luz»),
    `verificar_v16.py` («tres chicos + topes»), `params_v10.json` `_apoyos_v16` («7x7»), `v16_two.json` (`vol_v13`).
12. **La v15 no se regenera con solo sacar `apoyos_v16`** (fuera del repo; detalle y medición en la respuesta 5): hay que
    volver `x_two` a 164, y la clave `x_two_v15` (`params_v10.json:112`) no la lee nadie.
13. `ficha-fdm.md:69`: la tracción del PLA Lite «32 ± 5 (tienda)» no dice qué tienda ni lleva ABIERTA / BUSCADOR / A
    MEDIR, el código de fuentes de la propia ficha.

## Preexistente

- **[Preexistente] `C:\Dev\_utrim\sim_asiento.py:89` y `:86`** (13/10, no es de esta tanda) · respuesta: ____ — las posiciones de la mano
  (`MANO`) y las esquinas que se miden (`ESQ`) son números fijos de la placa de 164 mm; no se recalculan para otra
  placa. Es la raíz de I1. Y su ceguera ante cuatro apoyos simétricos la encontró y la dijo esta misma tanda (gemelo
  `--error-local`): bien hecho.

---

## Respuestas a lo que pidió el encargo

**1. `catia_medir.py`.** Freno de CATIA ajena: anda cuando `tasklist` contesta, falla abierto cuando no (I4). El hilo de
cuadros solo toca ventanas de su propio PID, clase `#32770`, visibles, con un único botón OK/Aceptar/Cerrar/Close, y
manda `WM_COMMAND` al cuadro (sin teclas ni foco); en la evidencia aceptó solo los avisos de importación y dejó quieto el
«Converting Data…» (*Cancel*). No encontré un cuadro que acepte y no deba. Cierra solo lo que agregó a `abiertos`, salvo
el caso de `ActiveDocument` de I4. La cabecera STEP: el orden de la norma (FILE_DESCRIPTION, FILE_NAME, FILE_SCHEMA)
queda bien, DATA intacta, idempotente, y frena si falta una de las tres (test OK; `catia_v14.json` muestra que detectó
el orden de OpenCASCADE). Lo que no hace está en el nit 8.

**2. `eval_casos_3d.py`.** Los veredictos no están ajustados a la respuesta: A1 es «más de 3 apoyos rígidos = ROJO» sin
ninguna excepción por pieza; la v15 da ROJO aunque el plan esperaba verde, y la v16 ROJO por tener cuatro, y los dos
`_esperado` de `casos_3d.json` lo dicen con todas las letras. El A1b nuevo es un renglón aparte, informativo, con test en
las dos direcciones, y no toca A1. «Reproduce lo publicado» puede fallar (gemelo → código 1; archivos cruzados → código
1), pero puede pasar sin comparar (I3).

**3. Fichas.** Muestreé 17 reglas marcadas ABIERTA en 4 fuentes, abiertas hoy:

| Fuente | Reglas | ¿Dice eso? |
|---|---|---|
| Carr Lane, *Locating & Clamping Principles* | U2, U3, U7 (equalizing), A1, A2, A3, A4 (2 a 1) | sí, las 7 citas textuales |
| Applied Engineering, *Jig and Fixture Design* (PDF, 8 págs.) | U6 (40 %), U7 (3-2-1 / 4-2-1, p. 1; rockers, p. 5), A6 (cuña 1:20-1:15, leva 70-80°, p. 3) | sí (U6 con la atribución del nit 1) |
| CCOHS, *Hand Tool Ergonomics – Tool Design* | E1 (40 mm, 30-50), E2 (12 mm, 8-16), E3, E4 (1,4 kg; 0,4 kg) | sí, salvo la condición de E3 (nit) |
| Stratasys, guía FDM 07/2025 (PDF) | G3 (4 × capa), M3 (agujeros chicos, se escarian), R6 (0,15" = 3,8 mm; 0,080" = 2,03 mm alrededor del inserto) | sí |

Números sin fuente que no digan «A MEDIR» o «SIN FUENTE»: las tolerancias de reproducción (nit) y el «32 ± 5 (tienda)»
del PLA Lite (nit 13). El umbral nuevo de
A1b (0,05 mm) dice que es «sin fuente: A MEDIR», bien. Holgura por lado contra al diámetro: no encontré contradicción;
`ficha-fdm.md` escribe la unidad en cada renglón (M4 radio = por lado, M5 «tratar como al diámetro», M6 por lado, R1 al
diámetro) y el banco del tornillo usa «al diámetro» igual que R1.

**4. Banco.** `npx vitest run __tests__/scripts/evalBanco.test.mjs`: 7/7. `node scripts/_evalBanco.mjs --banco
cad-design --seco`: arma los 3 casos con la skill `cad-design` (después del merge el banco se llama `cad-design`). El
criterio del virolador ya acepta «tres» o «cuatro coplanares» (`8dd4a702`).

**5. La v16.**
- `sim_asiento.py` no está tocado (fecha 13/10 15:22) y reproduce exacto lo del 13/10 (`sim_asiento_repro_1017.json` =
  `sim_asiento.json`).
- El gemelo no rompe los sorteos del modelo original: el bloque nuevo está adentro del `if ERROR_LOCAL` y sortea después
  de los sorteos de siempre; la fila v15 de `sim_v16_normal.json` (corrida con la copia) es igual a la del original (28 %,
  0,63, 0,13). Con el flag, los casos siguientes ya no son los mismos 150 (son otros 50): por eso la comparación justa es
  dentro de la misma corrida (v15 66 % contra v16 6 %), que es como lo presenta el plan.
- **La v15 no se regenera igual con solo sacar el parámetro nuevo** (ROBUSTNESS, nit 12 de la lista):
  `build_v10.py:79` lee `x_two`, que ahora es 172, y la clave
  `x_two_v15: 164` (`params_v10.json:112`) no la lee nadie. Medido corriendo el generador sin tocar sobre dos copias:
  sin `apoyos_v16` da 117,54 cm³; sin `apoyos_v16` y con `x_two` = 164 da 115,0841 cm³, idéntico a la v15 guardada en
  `out\v15\cotas_v10_two.json`. La foto de `out\v15\` sí la regenera. Qué haría: que `x_two` salga de la versión, o
  anotar en `_x_two_v16` que para la v15 hay que volverlo a 164 (y borrar la clave muerta, regla de `cad-3d.md`).
- `verificar_v16.py` puede dar rojo: el gemelo de la pieza subida 0,10 mm da rojo (si no, agrega «control ciego» a las
  fallas; `verif_v16_two.json` tiene fallas vacías). Lo que no mira es el choque contra el panel (I2).
- El PDF: cada número coincide con su JSON (28 → 0 %, 66 → 6 %, 1,73 → 0,11, 1 h 26 min 49 s, 64 g, 142,9 a 143,3 mm,
  143,16); autor «Facundo Santoro», sin creador ni productor. Lo que afirma sin respaldo es la punta (I1).

**6. Números del plan y del informe contra los JSON.**

| Dato del plan | JSON | ¿Coincide? |
|---|---|---|
| v14 100 % · 6,27 · punta 5,91; abiertos 68 % | `sim_asiento_repro_1017.json`, `…_punta_1017.json` | sí |
| v15 28 % · 0,63 · punta 1,69 | ídem | sí |
| v16 0 % · 0,16 · punta 0,00 | `sim_v16_normal.json`, `sim_v16_punta.json` | sí el número; no lo que dice (I1) |
| gemelo v15 66 % · 1,31 · 1,73; v16 6 % · 0,53 · 0,11 | `sim_v16_gemelo_normal.json`, `…_punta.json` | sí |
| prototipo 1 % → 26 % con el gemelo | `proto_v16_normal.json`, `gemelo_normal.json` | sí |
| tres apoyos vuelcan hasta 10 mm | `proto_v16_normal.json` (`tres_izq2_der1` 10,44 / 10,66) | sí (con el nit 5) |
| topes −10,334 / −10,335, dispersión 0,000 | `cotas_v10_two.json` | sí |
| anillo = v15 a 0,0002 mm | `verif_v16_two.json` (0,00023) | sí |
| V6: 1 h 27 min, 62,1 + 1,9 g | `laminado_6x10\resumen.json` (1 h 26 min 49 s; 62,12 / 1,89) | sí |
| CATIA v16 91.206,744 = 91.206,745 | `catia_v16.json` | sí el número; es de otra geometría (I2) |
| CATIA v14 116.526,908 / 116.526,907; contacto 0,0; gemelo −0,14; 44 s y 20 s | `catia_v14.json`, `catia_v14_marco.json`, `catia_gemelo.json` | sí |
| v16 de la primera vuelta 6,3 mm; 0,92 mm de desnivel | — | sin evidencia guardada (los JSON se pisaron): no verificable |
| `V5Automation.chm` 16.067.621 bytes, mismo hash | la nube y la instalación | sí (mismo SHA-256) |

`docs/INVESTIGACION_3D_AFUERA_2026-10-17.md` no trae números de simulación; su receta «tres almohadillas, no más» (§d.3)
ya tiene la aclaración arriba (`8dd4a702`).

## Falsos positivos (lo que parecía y está bien)

1. `sim_asiento.py` sin tocar. 2. El gemelo no cambia los sorteos sin el flag. 3. `verificar_v16.py` puede dar rojo.
4. «Reproduce lo publicado» puede fallar. 5. v15 y v16 en ROJO por A1 dicho honestamente, sin excepción en el código.
6. El hilo de cuadros no acepta nada que no sea suyo y de un botón OK. 7. La cabecera STEP en el orden de la norma.
8. Holgura por lado / al diámetro sin contradicción. 9. Las 17 citas muestreadas existen. 10. `_sinFirmaIA.py` limpio en
los 8 archivos. 11. Los números del plan coinciden con los JSON. 12. El manual copiado es el original. 13. No hay ninguna
CATIA corriendo ahora. 14. La rama sin push es a propósito.

## Para la memoria del auditor (no la escribí: el encargo pidió solo este informe)

- Una simulación con posiciones de mano fijas se audita contra el borde de la pieza NUEVA: si la corrida «punta» da
  idéntico a la normal, la mano cayó adentro de los apoyos.
- En esta PC no hay WebFetch: las fuentes se bajan con `curl` a una carpeta nueva del scratchpad y se leen con pymupdf;
  `python -I` ignora `PYTHONIOENCODING` (usar `sys.stdout.reconfigure`), y la ruta de la nube con tilde se arma con
  `glob` y `Ingenier*a`.
