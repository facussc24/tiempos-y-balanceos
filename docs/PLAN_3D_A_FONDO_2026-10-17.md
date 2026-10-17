# Plan — tanda 11 del plan del sistema: diseño 3D a fondo (17/10/2026)

Encargo `E261017-ce34` (origen: Fak, audio del 15/10 13:12, sección «Tanda 11» de
`Claude Fak\viernes-17-plan-sistema\10-PLAN_SISTEMA_2026-10-16.md`). Sesión hija lanzada sola, sin Fak en la ventana.
Rama `claude/3d-a-fondo-1017`, worktree `.claude/worktrees/3d-a-fondo-1017`, sin push.
**Es un cambio GRANDE** (`codigo-madre.md`): este plan va primero y se commitea antes del trabajo; al final, tests,
auditor Opus y el agente `revisor-pedido`.

Lo que NO hace esta tanda (y por qué):
- **No construye el gate de asiento** (`gate_asiento.py`): su plan (`docs/PLAN_3D_GATE_ASIENTO_2026-10-16.md`) espera el sí
  de Fak. La v16 se diseña con los gates actuales de `cad-design` y con la simulación de asiento de la carpeta de trabajo
  (`C:\Dev\_utrim\sim_asiento.py`, que **no se toca**: una copia aparte corre la v16). Queda escrito que a la v16 le falta
  pasar por el gate nuevo cuando exista.
- **No imprime** (regla dura de Fak del 13/10: se imprime solo con su pedido). La v16 queda laminada y lista.
- **No instala nada de terceros** ni toca el settings global ni `.mcp.json`. Lo que conviene instalar queda como lista
  con recomendación, para el sí de Fak.
- **No baja archivos de internet a `4- MANUALES`** sin el OK de Fak para ese archivo (`documentacion-oficial.md`, regla 7).
  Lo que sale de la instalación local de CATIA no es una descarga: se copia tal cual. Lo de build123d queda anotado con
  nombre, fuente y tamaño para su OK.
- Nada de Supabase, arb, `Y:`, Outlook ni mails.

## Los tres frentes

1. **CATIA (ya instalada, V5 R21, licencia oficial confirmada por Fak el 13/10).** Partir de lo que ya anduvo
   (memoria `reference_catia_por_com`, `.sgc-cache/investigacion-2026-10-11/`, `.sgc-cache/catia-2026-10-13/`, entorno
   `C:\Dev\_catia_env`). Medir qué módulos responden **creando un elemento de cada uno, con un nombre inventado al lado
   como control negativo** (`IsProductAuthorized` / `StartWorkbench` contestan que sí a cualquier nombre: no sirven de
   prueba). Script `catia_medir.py` en la skill: abre un STEP (con la cabecera arreglada en una COPIA), mide volumen,
   caja y choque contra el panel, cierra solo lo que abrió, y se niega a correr si hay una CATIA de Fak abierta.
2. **Cómo lo hacen otros** (GitHub, papers, Blender sin interfaz, skills, empresas): informe con estrellas, licencia,
   Windows y si sirve para utillajes sobre tapizado. Sin instalar nada.
3. **El conocimiento de un ingeniero de producto, en fichas de la casa** (dentro de `cad-design/reference/`):
   `ingenieria-de-producto.md` (nueva: el método y los criterios), `ficha-fdm.md` (diseño para impresión FDM y
   materiales) y `ficha-utillajes.md` (dispositivos: 3-2-1, apriete, apoyos no redundantes, asiento sobre blando,
   ergonomía). Cada regla con fuente y fecha; sin fuente, «a medir en la A2L». Las tres contradicciones medidas el 15/10
   se zanjan ahí: holgura **por lado / al diámetro** (la unidad siempre escrita), rosca **1,5×D contra 2,5×D** (a medir),
   y la Elegoo que sigue nombrada en `cad-3d.md:337` (se reporta, no se toca: es otra regla).

## Casos de respuesta conocida (escritos ANTES de correr nada)

### Caso 1 — virolador v14 contra v15 (dos preguntas de las fichas y una simulación)

| Pregunta | v14 (13/10, impresa, se hamaca en la mano) | v15 (13/10, no impresa) |
|---|---|---|
| A1 Apoyos (ficha de utillajes): ¿dos apoyos rígidos controlan el mismo movimiento? | **ROJO**: anillo + pasadores ubican a la vez X/Y; cuatro zonas de pedestal + orejas controlan Z y los giros | **VERDE**: sin pasadores (el anillo ubica solo X/Y) |
| A2 Ventana de asiento: ¿cuánto puede variar la altura del panel sin tocar plástico ni dejar de apretar? Umbral: **≥ 1,0 mm hacia abajo y ≥ 0,6 mm hacia arriba** (cubre que el tapizado ceda 0 a 0,6 mm y ±0,2 mm de espesor, la hipótesis declarada del 13/10) | **ROJO**: +0,20 / −0,24 mm (`params_v10.json`, `_v15`) | **VERDE**: +1,19 / −0,75 mm |
| A3 Simulación de asiento (`sim_asiento.py` sin tocar, 150 casos, semilla 7): **se tiene que REPRODUCIR** lo publicado el 13/10 | se hamaca > 0,3 mm en **100 %** (ranuras de listón tapadas) y **68 %** (abiertas) | **28 %**; apretando en la punta, hamaca mediana **1,69 mm** |

La v15 no es «verde en asiento»: la simulación dice que todavía se hamaca en 28 de 100 casos y 1,7 mm en la punta.
Lo que tiene que pasar el umbral es la **v16**.

### Caso 2 — tornillo de 7 mm impreso (memoria `project_tornillo_cabeza_ancha_impreso`)

Lo que la ficha FDM tiene que decir, con lo que pasó: impreso **parado** se parte bajo la cabeza por la línea de capa
(14/10) → la carga de flexión va paralela a las capas: **acostado**; gana la holgura **0,50 al diámetro** cuando la
diferencia entre 0,30 / 0,40 / 0,50 cae dentro del error de la impresora (GATE 5: medir que el proceso repite); los
primeros milímetros no enroscan (16/10) y el largo útil se cuenta sin ellos; la tuerca impresa ≥ D (regla de Leo).

### Caso 3 — pines del insert en la costura CNC (memoria `project_pines_costura_cnc_insert`)

Lo que la ficha de ingeniería de producto tiene que decir: la cota del pin salió del DXF (agujero Ø3) y en planta el
agujero se hace con **sacabocado Ø2** → **la cota sale del proceso real**, no del dibujo; y el requisito mismo era
falso (*«la CNC no cose con pines»*, 16/10) → antes de diseñar, confirmar que la función existe en el proceso de hoy.

### Cómo se corren

- **Banco de casos** con el formato de la tanda 9 (`evals/banco/cad/<caso>/prompt.md` + `graders/criterio.md`,
  registrado en `evals/banco/bancos.json`, corre con `node scripts/_evalBanco.mjs --banco cad`). Esta noche se arma y se
  corre `--seco` (no gasta cupo ni lanza otra sesión); la corrida real la decide la madre o Fak.
- **Parte determinista** (`.claude/skills/cad-design/scripts/eval_casos_3d.py`): lee los JSON de la simulación y los
  parámetros de cada versión y aplica A1/A2/A3; v14 tiene que dar rojo, v15 verde en A1/A2 y el número en A3. Si no
  reproduce, el eval sale con código 1. Corre con sus propios datos de prueba en un test (`test_eval_casos_3d.py`).

## La v16 del virolador — criterio de aceptación escrito antes de diseñarla

Diagnóstico de partida (medido el 13/10, no se vuelve a medir): la v15 apoya en **cuatro** zonas de pedestal: con el
tapizado cediendo distinto en cada una, la pose depende de dónde se aprieta (28 %); y la placa sobresale de los apoyos en
las puntas: apretando ahí vuelca hasta que la oreja antivuelco toca (1,7 mm).

Criterio (la v16 tiene que pasar todo; si no pasa, se dice qué no pasó y no se entrega como lista):

| # | Qué | Umbral |
|---|---|---|
| V1 | A1 apoyos | Z y los dos giros por **exactamente tres** apoyos rígidos; X/Y/giro en Z por **un solo** ubicador preciso (el anillo); lo demás con holgura que no manda |
| V2 | A2 ventana | ≥ 1,0 mm abajo y ≥ 0,6 mm arriba (no peor que la v15) |
| V3 | Simulación normal (copia de `sim_asiento.py`, mismos sorteos, 150 casos, semilla 7) | se hamaca > 0,3 mm en **≤ 10 %** de los casos; hamaca máxima ≤ 0,5 mm; el anillo no toca plástico en ningún caso |
| V4 | Simulación apretando en la punta | hamaca mediana **≤ 0,5 mm** (v15: 1,69) |
| V5 | Gates actuales | `check_collision` 0 puntos dentro y asienta; un solo cuerpo, estanco; aristas cóncavas con radio; versión grabada «v16» en la placa |
| V6 | Laminado | `laminar_bambu.py` sin errores en la A2L con PLA Lite; nunca `bambu_red.py --apply` |
| V7 | Firma | `_sinFirmaIA.py` limpio en STEP, 3MF y PDF |

**Lo que Fak mide en la pieza impresa** (va en el PDF de la entrega): la medida de control con calibre (punta a punta de
los anillos, ventana de la v14: 142,9 a 143,3 mm, se recalcula para la v16); apoyada sobre el panel y apretada en cinco
lugares (las dos puntas, el medio y los dos lados), **no hace «clic» ni se mueve**; y el vinilo queda apretado en todo el
contorno de la ranura. Si alguna falla, se mide antes de dar una teoría (memoria
`feedback_diseno_3d_medir_antes_de_explicar_y_simular_el_uso`).

Antes de tocar el generador se guarda la v15 (params, STL y STEP) en `C:\Dev\_utrim\out\v15\`, como se hizo con la v13.
La entrega va a una carpeta nueva `v16 - 2026-10-17\` al lado de la `v14 - 2026-10-13\` en la nube de Ingeniería; el
registro de versiones (`.xlsx`, lo anota Fak) no se toca: el renglón queda escrito en la síntesis.

## CATIA — caso de respuesta conocida

Abrir el STEP de la v14 (copia con la cabecera arreglada) y el panel del cliente `two_wireless.stp`, y medir en CATIA:
volumen y caja de la v14 tienen que **coincidir con `cadlib`** (tolerancia 0,1 %), y el choque v14 contra el panel tiene
que salir en un número. Tiempo: se informa el arranque de CATIA (≈ 54 s el 10/10) aparte de la medición, que tiene que
tardar **menos de 1 minuto**. Si algo no lo permite la licencia, se dice con lo que devolvió COM.

## Entregables

1. Este plan.
2. `.claude/skills/cad-design/reference/ingenieria-de-producto.md`, `ficha-fdm.md`, `ficha-utillajes.md`, y la decisión
   sobre una skill `catia` (`reference/catia.md` dentro de `cad-design`, salvo que la evidencia diga otra cosa).
3. `evals/banco/cad/` (3 casos) + `eval_casos_3d.py` y su test.
4. `catia_medir.py` (o la evidencia de por qué no).
5. Informe «cómo lo hacen otros» en `docs/` (`docs/INVESTIGACION_3D_AFUERA_2026-10-17.md`).
6. Manuales: `V5Automation.chm` (la ayuda oficial de automatización de CATIA, de la instalación) a `4- MANUALES\CATIA V5\`;
   build123d anotado para el OK de Fak.
7. v16 diseñada, simulada, laminada, con su PDF y el criterio de aceptación.
8. Informe del auditor Opus en `docs/auditorias/`.

## Qué puede romper

- Las fichas y `SKILL.md`: otra hija (`claude/skills-1017`, tanda 12) puede tocar `cad-design` a la vez. Por eso
  `SKILL.md` se toca en pocas líneas (enlaces a las fichas) y el resto va en archivos nuevos.
- CATIA: con una CATIA de Fak abierta el script le cerraría sus documentos → el script se niega si encuentra `CNEXT.exe`
  corriendo que no lanzó él.
- La suite de tests: se agregan archivos al repo → corre la suite entera antes de cerrar.
