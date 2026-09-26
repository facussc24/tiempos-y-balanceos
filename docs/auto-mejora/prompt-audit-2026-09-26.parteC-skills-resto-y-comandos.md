# Prompt-audit C — skills, tanda 2 (26/09/2026)

**Alcance.** Lo del encargo: `imds` (+ `reference/manual-destilado.md`), `render-a-foto-real`,
`arb-operar` / `cad-design` / `editar-video` después de la partición (de sus `reference/` solo
las citas, salvo donde apareció una discrepancia con el SKILL o con una regla), los otros 13
skills (solo lo que cambió desde `1695d553` y los datos volátiles) y los 4 `.claude/commands/`.
Los `description` y los skills del otro auditor no se tocaron.
**Modelo destino.** Claude Opus 5.5 y Claude Fable 5.1 (los dos corren en el repo). Las
instrucciones de verificación van como `flag` (la guía dice borrarlas para Opus 5 y mantenerlas
para Fable 5.1). El andamiaje visual del prompt es candidato a re-test; las herramientas de
recorte/medición y la resolución alta para planos se quedan.
**Solo lectura.** No se editó nada del repo. Las lecturas de Supabase fueron `select` con los
helpers del repo (`connectSupabase()`), sin escribir.

## Resumen

| Confianza | Hallazgos |
|---|---|
| Alta | 16 |
| Media | 13 |
| Baja / flag | 16 |

Por grupo: **duplicados que discrepan** (skill vs regla, skill vs reference, skill vs skill,
skill vs Supabase) 17 · **datos volátiles rotos** (Grupo 2) 7 · **fósiles / frases relativas**
(1d) 8 · **historia en el lugar de la regla** (Grupo 2) 3 · **verificación** (flag por la tensión
Opus/Fable) 6 · otros 4.

Los tres de más impacto:

1. **`arb-operar` contradice la regla nueva del 25/09 en cinco lugares** (H1-H4, H17). El SKILL
   todavía dice que el `WM_CLOSE` sobre `Maestro de Relaciones` y el `reset` "están permitidos",
   manda hacer `reset` después de cada export, y trae como "la secuencia que funciona" la de
   KeyTips `Alt V Y 0 3`, que es la que abrió `Selección de Empresa` el 23/09. El `reference/`
   que se lee "cuando una tanda falló" dice además "ante la duda, reabrir por teclado". La regla
   `arb-no-cerrar.md` y el código (`reset_relaciones()` se niega sin `--forzar`) ya cambiaron:
   el texto no. Y la receta de export del SKILL (`TAB TAB ↓↓↓ ENTER×3`, "lo primero que hay que
   probar") es la que, con el combo vacío, **manda el listado entero a la impresora** según su
   propio `reference/` y el docstring de `_arbVer.export()` (H5).
2. **El maestro de inyección PU está en la familia 19, no en la 17** (H10, H11). Leído live:
   17 = `IP PAD Patagonia - Tapizado`, 19 = `Proceso de Inyeccion PUR in place`
   (`AMFE-MAESTRO-PU-001`). `injection-process` dice 17 en tres lugares (uno es el
   `description`), y `amfe-cookbook` dice que el PU "no tiene maestro — pedir a Fak".
3. **Los dos comandos de auditoría AMFE y el skill de export quedaron atrás de la tabla AP
   oficial y del gate de auditoría** (H12-H14). `/auditoria-cliente` le dice al auditor que usar
   el borrador 2017 "es una decisión pendiente de Fak" — lo mismo que Fak corrigió el 23/09
   (*"obviamente vamos a usar la tabla oficial"*); `/audit-amfe` dice que la tabla "está en
   revisión". Y `amfe-export-oficial` manda a exportar con `_exportOficial.ts` /
   `_exportAmfeAmarok.ts`, que **no tienen** el gate de `.audit-cliente/` que `amfe.md` da por
   hecho; el que lo tiene, `_exportAmfeOficial.ts`, no está nombrado en el skill.

---

## (a) Inventario

| Archivo | Bytes | Cambió desde `1695d553` | Auditado |
|---|---:|---|---|
| `.claude/skills/imds/SKILL.md` | 24.271 | nuevo | entero |
| `.claude/skills/imds/reference/manual-destilado.md` | 21.784 | nuevo | entero |
| `.claude/skills/render-a-foto-real/SKILL.md` | 8.923 | nuevo | entero |
| `.claude/skills/arb-operar/SKILL.md` | 32.672 | partido + 25/09 | entero |
| `arb-operar/reference/altas-de-linea.md` | 4.291 | nuevo (partición) | citas |
| `arb-operar/reference/bitacora-tandas-2026-08.md` | 6.873 | nuevo (partición) | citas |
| `arb-operar/reference/fallas-modales-y-export.md` | 20.444 | nuevo (partición) | citas + discrepancias |
| `arb-operar/reference/maestro-de-insumos.md` | 14.832 | nuevo (partición) | citas + discrepancias |
| `.claude/skills/cad-design/SKILL.md` | 28.626 | partido + G-E4 | entero |
| `cad-design/reference/*.md` (4) | 51.716 | nuevos (partición) | citas + conteo de lecciones |
| `.claude/skills/editar-video/SKILL.md` | 28.128 | partido | entero |
| `editar-video/reference/*.md` (3) | 20.505 | nuevos (partición) | citas |
| `.claude/skills/patrones-corte-plotter/SKILL.md` | 26.317 | sin cambios | datos volátiles |
| `.claude/skills/leer-planos/SKILL.md` | 4.347 | sin cambios | entero (andamiaje visual) |
| `.claude/skills/autocad-verificar/SKILL.md` | 5.793 | sin cambios | datos volátiles |
| `.claude/skills/docs-empresa/SKILL.md` | 5.814 | sin cambios | datos volátiles |
| `.claude/skills/rule-enforcement-gate/SKILL.md` | 5.833 | sin cambios | datos volátiles |
| `.claude/skills/product-map/SKILL.md` | 2.700 | sí (13 familias) | entero |
| `.claude/skills/amfe-cookbook/SKILL.md` | 10.684 | 1 línea | diff + datos volátiles |
| `.claude/skills/amfe-domain/SKILL.md` | 10.367 | sin cambios | datos volátiles |
| `.claude/skills/apqp-schema/SKILL.md` | 9.999 | 2 líneas | diff + datos volátiles |
| `.claude/skills/supabase-safety/SKILL.md` | 9.240 | sin cambios | datos volátiles |
| `.claude/skills/amfe-export-oficial/SKILL.md` | 8.103 | sin cambios | datos volátiles |
| `.claude/skills/injection-process/SKILL.md` | 5.983 | sin cambios | entero (datos) |
| `.claude/skills/verificacion-consumos/SKILL.md` | 5.534 | sin cambios | datos volátiles |
| `.claude/commands/audit-amfe.md` | 2.680 | sí | entero |
| `.claude/commands/auditoria-cliente.md` | 5.504 | sí | entero |
| `.claude/commands/backup.md` | 1.959 | sí | entero |
| `.claude/commands/fix-amfe-gaps.md` | 2.304 | sin cambios | entero |

No se encontró texto específico de Opus 5 / Fable 5 ni nombres de modelo en el alcance, ni
topes numéricos de salida, ni "think step by step", ni supresores de narración.

---

## (b) Hallazgos

Ordenados por confianza. "Discrepa" = duplicado que discrepa (lo que la consigna pide buscar
primero). Las acciones con texto están en (c).

| # | Ubicación | Evidencia | Patrón | Por qué está roto / obsoleto | Conf. | Acción |
|---|---|---|---|---|---|---|
| H1 | `arb-operar/SKILL.md:73-76` | "Lo que sí está permitido es `WM_CLOSE` sobre `Maestro de Insumos` / `Maestro de Relaciones` y `_arbVer.py reset`." | Discrepa con la regla (`arb-no-cerrar.md`, tabla, 25/09) · G2 volátil | La regla dice ❌ cerrar Relaciones abierta ("crashea el arb", dos veces el 25/09) y ✅ `reset` **solo con Relaciones cerrada**; `reset_relaciones()` ya se niega sin `--forzar`. El skill carga junto con la regla y dice lo contrario. | Alta | rewrite |
| H2 | `arb-operar/SKILL.md:47` | "El export deja Relaciones en la solapa `Listado`: **`reset` DESPUÉS de exportar**, no antes." | Discrepa con la regla y con `SKILL.md:470-471` | Manda justo lo que la regla prohíbe (después del export Relaciones está abierta). El propio SKILL, 420 líneas abajo, dice "NO reset". La receta de la línea 466 ya usa `click 118 68`. | Alta | rewrite (si se toma M1, ya viene adentro) |
| H3 | `arb-operar/SKILL.md:360` | "`_arbVer.py reset` abrir por CLICK (solapa + boton)" como primer paso de la receta | Discrepa con la regla | El estado por defecto del arb es abierto con Relaciones abierta: ahí `reset` sale con código 1 y la receta arranca en falso. Falta la condición "con Relaciones CERRADA" y el camino con Relaciones abierta. | Alta | rewrite |
| H4 | `arb-operar/reference/fallas-modales-y-export.md:264, 294, 298, 345-346` y `reference/maestro-de-insumos.md:233` | "`_arbVer.py reset` # cierra modales + WM_CLOSE + reabre" · "El comando `reset` ya lo hace." · "**`abrir()` de `_arbCargar.py` (teclado: `Alt V Y 0 3`) sí la abrió.** Ante la duda, reabrir por teclado." · "Mismo comportamiento que ya estaba documentado para `Maestro de Relaciones`." | Discrepa: reference vs regla, vs `SKILL.md:42-44/360` y vs el código | Es el archivo que el SKILL manda leer "si una tanda falló" — el momento exacto en que se tienta un reset. `abrir()` ya no teclea (docstring de `_arbCargar.py:228-236`: "NUNCA por KeyTips a ciegas"). | Alta | rewrite (5 hunks) |
| H5 | `arb-operar/SKILL.md:244-262` | "`TAB TAB` / `↓ ↓ ↓` / `ENTER ENTER ENTER`… **Esto es lo primero que hay que probar.**" · "Tabular tampoco…" · "lo probé por teclado sintético (`keybd_event`) y **no disparó el export**… hay que medirlo" | Discrepa con `reference/fallas-modales-y-export.md:121-141` y con `_arbVer.export()` · G2 volátil | El reference: el combo vuelve a vacío al entrar a `Listado` y "desde el combo vacío `↓↓↓` cae en **`Impresora`**… manda **todo** el listado… a la impresora"; la receta buena es click en `Desde Artículo` + `TAB TAB` + `↑`×8 + `↓`×3 + gate. `_arbVer.export()` lo automatiza con `keybd_event` (y la receta de la línea 464 lo usa). El texto del SKILL es el de antes del 07/08. | Alta | rewrite |
| H6 | `arb-operar/SKILL.md:535` | "1. ¿hay un #32770 abierto? -> abortar, pedir el click real" | Discrepa con `SKILL.md:8-10` y con `reference/fallas-modales-y-export.md:243-251` | El mismo SKILL dice que el robot "cierra el modal"; el reference, "EL MODAL LO PUEDO CERRAR YO" con `_arbVer.py modal`. `cerrar_modales()` imprime el cartel y solo aprieta `Aceptar`/`OK`. "Pedir el click real" le carga a Fak algo que no le toca. | Alta | rewrite |
| H17 | `arb-operar/SKILL.md:312-320` | "La secuencia que **funciona**… `Alt` / `V` / `Y 0 3`" | Discrepa con `SKILL.md:42-44`, `:360` y con el docstring de `_arbCargar.abrir()` | Es literalmente la secuencia que `abrir()` mandaba hasta el 23/09 y que, con el ribbon en otra solapa, apretó `Selección de Empresa` (pidió la contraseña de Fak) y `About`. El SKILL la sigue presentando como el camino que funciona. | Alta | rewrite (agregar la advertencia) |
| H7 | `imds/SKILL.md:8-12` | "**Estado al 21/09/2026**… El checker bajo de **2 errores a 1**. El que queda no es mio: **no hay Contact Person valido**" | Contradicción interna · G2 historia/estado | `imds/SKILL.md:457` dice "0 errores" y la memoria `project_imds_barack` dice check **0/0** y MDS **reenviado** el 21/09. Un estado fechado arriba de todo, desactualizado el mismo día. | Alta | rewrite |
| H8 | `imds/SKILL.md:157-167` vs `:359-362` | "Si el material ya esta released y le falta la norma — NO hace falta versionar… la que conviene" vs "**La via recipient-specific para normas no aparece**… versionar el material fue el camino que funciono" | Contradicción interna | La primera sección manda al modelo por un camino que la segunda dice que en Release 15.4 no existe en pantalla. | Alta | rewrite |
| H9 | `imds/SKILL.md:20` | "Lo cargaba Calidad (Marcelo Nieve). Renuncio el 02/09/2026 y paso a Ingenieria." | Discrepa con `autonomy-contract.md:93` ("**PPAP/PSW e IMDS**: Calidad") y `mail-envio.md:94-97` (Fak 08/09: *"el imds es de calidad"*). `apqp-legajo/SKILL.md:78` dice INGENIERIA (skill del otro auditor) | La regla es del 22/09 (commit `667cbab8`), posterior al skill (21/09) y a la memoria. Uno le dice al modelo que el IMDS es trabajo de Fak; el otro, que no se le lleva como tarea suya. | Alta (la discrepancia) | rewrite propuesto; **lo decide Fak** |
| H10 | `injection-process/SKILL.md:3, 14, 26` | "maestros Supabase (families 15/16/17)" · "maestro family 17 (Iny PUR Headrest)" · "\| Iny PUR Headrest \| 17 \|" | Discrepa con Supabase live y con `product-map` · G2 volátil | Live: 17 = `IP PAD Patagonia - Tapizado`, 19 = `Proceso de Inyeccion PUR in place`, AMFE `AMFE-MAESTRO-PU-001` (`d32de6b8-…`). La memoria `project_maestro_pu_headrest` dice 19 desde el 26/05. Un sync "hacia el maestro 17" apuntaría al IP PAD. La línea 3 es `description` (del otro auditor): el dato es el mismo. | Alta | rewrite |
| H11 | `amfe-cookbook/SKILL.md:82` | "\| INYECCION PU / ESPUMADO \| **Sin maestro** — pedir a Fak \|" | Discrepa con Supabase live · G2 volátil | La familia 19 tiene maestro AMFE (`AMFE-MAESTRO-PU-001`). El skill le hace preguntarle a Fak algo que la base contesta. | Alta | rewrite |
| H12 | `commands/auditoria-cliente.md:43-45` | "que la casa siga usando el borrador es una decision pendiente de Fak" | Discrepa con la memoria `project_tabla_ap_de_la_casa_es_el_borrador_2017` y con LECCIONES 23/09 · fósil | Decidido y aplicado el 23/09 (812 AP en 19 AMFE). Fak se quejó justo de que se le presentara como pendiente. Lo que sigue pendiente son las escalas O/D de `amfe.md` §13. | Alta | rewrite |
| H13 | `commands/audit-amfe.md:29` | "(the table's own source is under review, memory …: report, don't recalculate)" | Fósil / volátil | `apTable.ts` es la tabla SETEC desde el 23/09 (commit `7e8d1a74`, docstring del archivo). | Alta | rewrite |
| H14 | `amfe-export-oficial/SKILL.md:18, 81-84` | Scripts de referencia: `_exportOficial.ts` (159/160), `_exportAmfeAmarok.ts` (128/129). No nombra `_exportAmfeOficial.ts`. | Discrepa con `amfe.md:349-351` y `:390-391`, y con `auditoria-cliente.md` §5 | `amfe.md` da por hecho que el export oficial pasa por los gates de `_exportAmfeOficial.ts` (`scanRevisionMeta()`, marcador `.audit-cliente/` de 7 días). Los dos scripts que nombra el skill no tienen el gate (grep `audit-cliente`: 0 y 0). El skill que se usa "SIEMPRE al exportar" lleva por el camino sin gate. | Alta | rewrite + add |
| H15 | `supabase-safety/SKILL.md:128` | "**Override:** si el script intencionalmente deja algunos issues (ej: placeholder para que el equipo APQP complete), usar `{ allowNewCritical: true }`" | Discrepa con `amfe.md` §4 y `autonomy-contract.md` §B · fósil | El placeholder está prohibido desde el 21/09; es el caso de LECCIONES 22/09 (*"un cambio de criterio se barre por su FRASE en todo el repo"*). El ejemplo autoriza justo el override prohibido. | Alta | rewrite |
| H16 | `cad-design/SKILL.md:173` (+ `scripts/gate_giro.py:3`) vs `rules/cad-3d.md:321` | "**GATE 5 — TRAYECTORIA**" vs "**GATE 5 — antes de rediseñar, medir si el PROCESO repite.**" | Discrepa: skill vs regla (mismo nombre, dos gates distintos) | La regla y el skill cargan juntos; "el GATE 5" nombra dos cosas. | Media | rewrite (renombrar el del skill) |
| M1 | `arb-operar/SKILL.md:8-54` | Bloque de estado: "14/14 el 05/08 · 16/16 el 06/08 · 36/36 el 07/08 · **31/31 el 20/08**…", "(ver la seccion nueva del 31/08)", "(ver la seccion del 01/09)", seis viñetas "23/09/2026 — …" | G2: historia en el lugar de la regla · G2 volátil | Es lo primero que lee el modelo y es un tablero de conteos con fechas; las tres reglas operativas del 23/09 están enterradas en una crónica, una ya está mal (H2), y dos punteros apuntan a "secciones" que no están en este archivo (la del 31/08 vive en `reference/maestro-de-insumos.md`). | Media | rewrite (tabla de capacidades + 3 reglas) |
| M2 | `arb-operar/SKILL.md:176-180, 381, 404-405, 551` | "~~ni `Alt` (el ribbon no tiene KeyTips)…~~ — **las tres afirmaciones eran falsas**" · "La versión vieja decía 'insumos × 7 columnas': estaba mal." · "La versión vieja de esta tabla decía que escribir NO necesitaba foco. Estaba mal" · "La versión vieja de esta skill lo daba por backup." | 1d fósiles (diff contra una versión que el modelo nunca vio) | El tachado se lee igual (los `~~` son tokens): pone delante la afirmación falsa. Las reglas quedan mejor dichas en positivo. | Media | rewrite (4 hunks) |
| M3 | `imds/SKILL.md:410` | "El buscador del arbol vive en un IFRAME y tiene dos trampas" (lista 3) | Dato interno inconsistente | Trivial, pero la tercera trampa (el `Search` no se dispara con Enter) es la que más cuesta. | Media | rewrite |
| M4 | `cad-design/SKILL.md:32` | "Por eso el primer gate ya no es el 0." | 1d frase relativa | Implica una versión anterior. | Media | rewrite |
| M5 | `cad-design/SKILL.md:121-127` | "**De vuelta en servicio (2026-08-09)** tras dos falsos verdes: la concavidad ya no se le pregunta a una malla… — ése era el bug que quedaba" | 1d + G2 arqueología | Historia de implementación del gate; lo que el modelo necesita es el contrato (par BIEN/MAL, código 3, `--verificar-material`). | Media | rewrite |
| M6 | `cad-design/SKILL.md:182` | "(b) el autotest nació fallado: su caso MAL también chocaba a 0°… Ahora los dos postes…" | G2 historia | Cómo se construyó el autotest de `gate_giro.py`; no cambia cómo se usa. Encaja en `reference/enforcement-como-se-cerro.md`. | Media | move |
| M7 | `cad-design/SKILL.md:218-223` | "El motor bueno vive ahora **acá**… Nació suelto en la carpeta de trabajo del carro; vivir ahí significaba…" | 1d frase relativa | La regla (usar `foto3d.py`, nunca matplotlib) ya está en G-E3a y en el paso 7. | Media | rewrite |
| M8 | `cad-design/SKILL.md:225` | "los siete nacieron cada uno DESPUÉS de que una persona encontrara el bug" | G2 volátil (conteo) | El skill lista ocho gates (P, 0, 1, 2, 3, 4, 5, E). | Media | rewrite |
| M9 | `cad-design/SKILL.md:209-216` (G-E4) | "Lanzar UN `Agent` que reciba **solo** el PDF y los renders… Es un paso de proceso, sin gate automático" | Falta de contrato (reusar antes de crear, `core-prohibiciones` §6) | `scripts/revision_ciega.py` existe desde el 08/08 y hace eso: "arma el expediente para que otro juzgue la pieza SIN ver como se hizo… escribe un PROMPT listo". Ni el SKILL, ni sus `reference/`, ni `cad-3d.md` lo nombran. | Media | add |
| M10 | `docs-empresa/SKILL.md:45` | "Manuales oficiales (AIAG-VDA FMEA 2019, SETEC p129 CC/SC, …)" | G2 volátil | El PDF AIAG-VDA de `4- MANUALES\AMFE\FMEA-AMFE-VDA-AIAG\` es el **borrador de 2017** (memoria `project_tabla_ap_…`, `auditoria-cliente.md:40-42`). Rotularlo "2019" manda a buscar la tabla AP al lugar equivocado. | Media | rewrite |
| M11 | `docs-empresa/SKILL.md:59` | "Escribir/mover archivos EN el servidor u OneDrive = confirmar con Fak antes (autonomy-contract)." | Discrepa con `autonomy-contract.md` §D (solo nombra `Y:\`) y con `CLAUDE.md`, fin de sesión §5 | El protocolo manda dejar el entregable en su carpeta de la biblioteca de Ingeniería (OneDrive) al cerrar, sin preguntar (`editar-video` §8.5 también). El skill cita la regla para algo que la regla no dice. | Media | rewrite |
| M12 | `supabase-safety/SKILL.md:66` | "Guarda snapshot de 12 tablas en `backups/<timestamp>/`." | G2 volátil (conteo) | `_backup.mjs` respalda lo que lee del inventario live; el último `_manifest.json` (23/09 19:12) trae 38 tablas inventariadas, 28 con filas. `backup.md` ya dice "no comparar contra conteos fijos". | Media | rewrite |
| L1 | `cad-design/SKILL.md:113, 345` | "Render + **MIRAR yo** el resultado." · "Render → MIRARLO → corregir, DESPUÉS de cada cambio" | Verificación (tensión Opus 5 / Fable 5.1) + andamiaje visual (Opus 5.5) | Para Opus 5 la guía la borra; para Fable 5.1 la mantiene. `cad-3d.md` ya dice que lo que decide es el número de `gate_ensamble`, no la imagen. Fallas demostradas: se queda. | Baja | flag |
| L2 | `cad-design/SKILL.md:209-216` | G-E4: subagente revisor | Verificación con subagente (la guía de Opus 5 lo nombra como sobre-verificación) | Falla demostrada el 22/09 con los modelos actuales (el dispositivo del Insert volvió 5 veces): keep list #5. | Baja | flag |
| L3 | `verificacion-consumos/SKILL.md:55` (y `consumos-entregables.md` §2) | "**Agente independiente**: ademas del script propio, lanzar UN agente" | Verificación con subagente | Misma tensión; está en una regla always-on, así que el skill no es el lugar para cambiarla. | Baja | flag |
| L4 | `commands/auditoria-cliente.md:55` | "Los subagentes tienen ~40-50% de falsos positivos" | Número medido con modelos anteriores | La guía documenta que Opus 5.5 cita fuentes que el material no respalda mucho menos que Opus 5. El paso de verificar se queda (regla de `CLAUDE.md`); el número conviene re-medirlo. | Baja | flag |
| L5 | `editar-video/SKILL.md:446-448` | "**Mirar el video generado de punta a punta.**" | Verificación | Misma tensión. | Baja | flag |
| L6 | `imds/SKILL.md:307-308` | "Capturada la pantalla final y **comparada carácter por carácter** contra la fuente" | Verificación | Es una declaración legal hacia un cliente, irreversible una vez aceptada: se queda. | Baja | flag |
| L7 | `arb-operar/SKILL.md` (todo) | ~25 títulos con 🔴🔴 / 🟢🟢 / mayúsculas | 1a densidad de énfasis | Operación frágil de un ERP (keep list #3): no se propone tocarlo; solo se registra que el rojo dejó de distinguir. | Baja | flag |
| L8 | `product-map/SKILL.md:38-45` vs `amfe.md` §9 | 7 roles "válidos para controles" vs "Roles canonicos Man — EXACTAMENTE 4" | Posible discrepancia | Son campos distintos (CP/HO vs WE Man del AMFE) y el CP ya es de Calidad; los acentos difieren ("producción" / "Produccion"). | Baja | flag |
| L9 | `leer-planos/SKILL.md:90` (y `carga-arb:195`) vs `imds/SKILL.md:240, 259` | "`7-Lista de materiales preliminares`" vs "`…\APQP\7-Lista de materiales\`" | Posible discrepancia (nombre de carpeta) | `Y:` no está montado en esta sesión: no verificable. | Baja | flag |
| L10 | `editar-video/SKILL.md:40-50` | Tabla "Los scripts que ya estan escritos" | Lista incompleta | Falta `cancion.py` (lo usa §6.2) y `_transcribirChino.py`. | Baja | flag |
| L11 | `editar-video/SKILL.md:77` | "Por plano, `>= 70`" | Umbral vs código | `_video.py candidatos --nitidez-min` tiene 60 por defecto; mide el mínimo de la ventana, no el plano, así que no es necesariamente contradictorio. | Baja | flag |
| L12 | `apqp-schema/SKILL.md:179` | "## Tabla `projects` (… OJO: NO es JSONB)" | 1d | Desde el 11/09 todas las `data` son TEXT; el "OJO" contrasta con algo que ya no existe. | Baja | flag |
| L13 | `imds/SKILL.md:424-427` | "`x_clic = rect.x * (800 / window.innerWidth)`" | G2 volátil | El 800 es el ancho de captura de esa sesión. El panel del navegador informa el marco de cada captura, y el clic por `ref` no depende de la escala; en el iframe de IMDS no está probado. | Baja | flag |
| L14 | `editar-video/SKILL.md:278` | "La v4 va a -20,0 LUFS" | Referencia colgada tras la partición | "La v4" se define en `reference/musica-sintetizada.md`. | Baja | flag |
| L15 | `cad-design/SKILL.md:232-239` | benchmark de `embreex` (5,106 s → 0,038 s, 36.530 impactos…) | G2 historia | La regla (rejilla corrida hacia adentro) está en negrita; la medición es contexto. Por el largo solo no es hallazgo. | Baja | flag |
| L16 | `arb-operar/reference/fallas-modales-y-export.md:148-165, 267-269` vs `arb-no-cerrar.md` | "UNA CELDA SUCIA ENVENENA TODAS LAS CORRIDAS" · "Lo único que la saca es `WM_CLOSE`." | Hueco operativo, no de prompt | Con la regla del 25/09 ese `WM_CLOSE` es justo lo prohibido. El commit `f7dd8612` dice que ante un corte alcanzó `--solo`, pero no dice si eso limpia una celda que el arb **rechazó**. No se propone texto: lo decide Fak o una prueba. | Baja | flag |

---

## (c) Hunks propuestos (alta y media)

Un hunk por hallazgo. "Antes" es el texto literal del archivo.

### H1 — `.claude/skills/arb-operar/SKILL.md:73-76`

Antes:
```
Regla dura (31/08/2026). **El estado por defecto es abierto**: cerrarlo lo puedo hacer yo,
reabrirlo no. Lo que sí está permitido es `WM_CLOSE` sobre `Maestro de Insumos` / `Maestro de
Relaciones` y `_arbVer.py reset`. El incidente, la tabla de lo prohibido y lo permitido, el escape
y el hook: regla `arb-no-cerrar.md`, que carga sola al abrir este skill.
```
Después:
```
Regla dura (31/08/2026). **El estado por defecto es abierto**: cerrarlo lo puedo hacer yo,
reabrirlo no. Permitido: `WM_CLOSE` sobre `Maestro de Insumos` (descarta sin grabar) y
`_arbVer.py reset` con `Maestro de Relaciones` CERRADA (solo la abre por click). **Cerrar
Relaciones abierta crashea el arb** (dos veces el 25/09/2026): `reset` se niega sin `--forzar`,
y `--forzar` va solo con OK de Fak. El incidente, la tabla completa, el escape y el hook: regla
`arb-no-cerrar.md`, que carga sola al abrir este skill.
```

### H2 — `.claude/skills/arb-operar/SKILL.md:47`

Antes:
```
> - El export deja Relaciones en la solapa `Listado`: **`reset` DESPUÉS de exportar**, no antes.
```
Después:
```
> - El export deja Relaciones en la solapa `Listado`: se vuelve a `Altas` con `_arbVer.py click 118 68`.
>   **No con `reset`**: con Relaciones abierta se niega, y cerrarla crashea el arb (`arb-no-cerrar.md`).
```

### H3 — `.claude/skills/arb-operar/SKILL.md:360`

Antes:
```
_arbVer.py reset                   abrir por CLICK (solapa + boton). NUNCA KeyTips a ciegas (23/09, arriba)
```
Después:
```
Relaciones CERRADA: _arbVer.py reset        la abre por CLICK (solapa + boton). NUNCA KeyTips a ciegas
Relaciones ABIERTA: _arbVer.py click 118 68 solapa Altas (reset se niega: cerrarla crashea el arb)
```

### H4 — `arb-operar/reference/`: los cinco lugares viejos del `reset`

(a) `fallas-modales-y-export.md:263-265`

Antes:
````
```bash
python scripts/_arbVer.py reset      # cierra modales + WM_CLOSE + reabre + solapa Altas
```
````
Después:
````
```bash
python scripts/_arbVer.py reset      # con Relaciones CERRADA: la abre por click y va a Altas
```
⚠️ 25/09/2026: con Relaciones ABIERTA `reset` se niega. Cerrarla y reabrirla crasheó el arb dos
veces (regla `arb-no-cerrar.md`); `reset --forzar` solo con OK de Fak.
````

(b) `fallas-modales-y-export.md:294`

Antes: `` `--apply` va siempre un `click 118 68` (solapa `Altas`). El comando `reset` ya lo hace. ``
Después: `` `--apply` va siempre un `click 118 68` (solapa `Altas`). `reset` no: con Relaciones abierta se niega. ``

(c) `fallas-modales-y-export.md:297-298`

Antes: `grilla; se ve en `_arbVer.py foto rel`). Ir a `Listado` y volver no la redibujó. Lo que la arregló fue cerrar y reabrir la ventana, y eso desató las dos fallas de abajo.`
Después: `(igual) … Lo que la arregló ese día fue cerrar y reabrir la ventana, y eso desató las dos fallas de abajo. Desde el 25/09 cerrar Relaciones abierta pide OK de Fak (`reset --forzar`).`

(d) `fallas-modales-y-export.md:345-346`

Antes:
```
(296,98) no abrió `Relaciones`, y no apareció ningún cartel. **`abrir()` de `_arbCargar.py`
(teclado: `Alt V Y 0 3`) sí la abrió.** Ante la duda, reabrir por teclado.
```
Después:
```
(296,98) no abrió `Relaciones`, y no apareció ningún cartel. Ese día la abrió `abrir()` de
`_arbCargar.py`, que entonces tecleaba `Alt V Y 0 3`. Desde el 23/09 `abrir()` va por click:
esas teclas mandadas sin mirar abrieron `Selección de Empresa`. Si el click no abre, mirar si el
ribbon está minimizado (SKILL.md) o si `Producción` está chica, y preguntar antes de volver a
los KeyTips.
```

(e) `maestro-de-insumos.md:233`

Antes: `` estaba intacta. Mismo comportamiento que ya estaba documentado para `Maestro de Relaciones`. ``
Después: `` estaba intacta. En `Maestro de Relaciones` no: cerrarla abierta crashea el arb (regla `arb-no-cerrar.md`). ``

### H5 — `.claude/skills/arb-operar/SKILL.md:244-262`

Antes:
````
## Exportar para verificar `CONFIRMADO`

### La secuencia, en cuatro teclas `dato de Fak 2026-08-06`

Estando en la solapa `Listado de Insumos de Un Producto`:

```
TAB  TAB            ← Desde Artículo → Hasta Artículo → combo Salida
↓  ↓  ↓             ← baja 3 en el combo
ENTER  ENTER  ENTER ← genera el archivo
```

**Esto es lo primero que hay que probar. Nada de pelearse con el combo.** Perdí ~10 minutos
mandándole clicks y `WM_CHAR` al ComboBox: el click no le mueve el foco (el arb se lo queda
en `Desde Artículo`) y la letra que tipeé terminó **escrita en el campo de filtro**. Tabular
tampoco: el TAB desde ahí cae en un botón y se queda. Fak lo hace en cuatro teclas.

> Ojo: lo probé por teclado sintético (`keybd_event`) y **no disparó el export**. Con teclado
> real de Fak sí anda. Si hace falta automatizarlo, hay que medirlo — no darlo por hecho.
````
Después:
````
## Exportar para verificar `CONFIRMADO`

```bash
python scripts/_arbVer.py export     # reintentar: el combo falla ~1 de cada 2
```

Lo que hace, por si hay que hacerlo a mano: click en la solapa `Listado`, click en `Desde
Artículo` (el click sobre el combo no le da el foco), `TAB TAB` hasta el combo `Salida`, `↑`×8
para pararse en la opción 0 venga de donde venga, `↓`×3 hasta `Tabla EXcel`, y **recién con el
combo diciendo `Tabla EXcel`**, `ENTER ENTER ENTER`. El combo vuelve a vacío cada vez que se
entra a `Listado`, y desde vacío `↓↓↓` cae en **`Impresora`**: aceptar ahí manda el listado
entero a la impresora de la oficina. El detalle y la espera hasta que el archivo termina de
escribirse: `reference/fallas-modales-y-export.md` §"EXPORTAR: el combo se RESETEA".
````

### H6 — `.claude/skills/arb-operar/SKILL.md:535`

Antes:
```
1. ¿hay un #32770 abierto?            -> abortar, pedir el click real
```
Después:
```
1. ¿hay un #32770 abierto?            -> abortar y LEER el cartel. `_arbVer.py modal` lo imprime y
                                         cierra los que tienen Aceptar/OK; el que no (Visual C++),
                                         con la tabla de reference/fallas-modales-y-export.md
                                         (`Omitir`, nunca `Anular`)
```

### H17 — `.claude/skills/arb-operar/SKILL.md:312-320`

Antes:
```
La secuencia que **funciona** (probada de punta a punta el 25/08, abrió `Maestro de
Relaciones - BA` sin un solo click sobre un control):
```
Después (y se agrega el párrafo después del bloque de código de la línea 320):
```
La secuencia (probada de punta a punta el 25/08, abrió `Maestro de Relaciones - BA` sin un
solo click sobre un control):
```
```
⚠️ **Para ABRIR Relaciones no se usa** (23/09/2026): mandada sin mirar dónde caía, con el ribbon
en otra solapa, apretó `Selección de Empresa` (pide la contraseña de Fak) y `About`. Se abre por
click (`_arbCargar.abrir()` → `reset_relaciones()`). Los KeyTips sirven leídos en vivo
(`_arbKeytips.py`), no tecleados de memoria.
```

### H7 — `.claude/skills/imds/SKILL.md:8-14`

Antes:
```
> **Estado al 21/09/2026: CARGAR UNA NORMA EN UN MATERIAL, ANDA.** Primera corrida real ese
> dia sobre `NO TEJIDO 100 Gr` (1017903710): version nueva 1.01 + norma Toyota
> `TSL2603G-2BN-100g/m²` + recyclate, guardado y verificado reabriendo el MDS desde la base.
> El checker bajo de **2 errores a 1**. El que queda no es mio: **no hay Contact Person
> valido** (ver §"Los tres muros" mas abajo).
> **Una limitacion que escribi yo no es un hecho verificado**: antes de anotar que algo
> "no se puede", probarlo y fecharlo.
```
Después:
```
> **Una limitacion escrita aca no es un hecho verificado**: antes de anotar que algo "no se
> puede", probarlo y fecharlo. El estado de cada carga (que se mando, que acepto el cliente,
> que falta) vive en la memoria `project_imds_barack`, no en este skill.
```

### H8 — `.claude/skills/imds/SKILL.md:157-159`

Antes:
```
### Si el material ya esta released y le falta la norma — NO hace falta versionar

Esta es la salida que el manual contempla y la que conviene (pag. 55-56):
```
Después:
```
### Si el material ya esta released y le falta la norma

El manual contempla una salida sin versionar (pag. 55-56), pero **en Release 15.4 no aparecio**
en la pestaña *Recipient data* del componente (21/09/2026): lo que funciono fue versionar el
material ("Los tres muros", muro 2). Lo que dice el manual, por si aparece:
```

### H9 — `.claude/skills/imds/SKILL.md:20` (propuesta: la confirma Fak)

Antes:
```
Lo cargaba Calidad (Marcelo Nieve). Renuncio el 02/09/2026 y paso a Ingenieria.
```
Después:
```
El IMDS es de Calidad (regla `autonomy-contract.md` §F; Fak, 08/09/2026: *"el imds es de
calidad"*). Lo cargaba Marcelo Nieve, que renuncio el 02/09/2026; Fak hizo la primera carga el
21/09/2026 a pedido suyo. No se le lista como pendiente propio ni se nombra en un mail de
Ingenieria. [CONFIRMAR CON FAK: si el IMDS pasó a Ingeniería, lo que cambia es la fila de
`autonomy-contract.md:93` y `mail-envio.md:97`, no este skill.]
```
Nota: `apqp-legajo/SKILL.md:78` (del otro auditor) pone el casillero 23 como "INGENIERIA". El
arreglo tiene que quedar igual en los cuatro lugares.

### H10 — `.claude/skills/injection-process/SKILL.md:3, 14, 26`

(a) línea 3 (`description`, compartida con el otro auditor): `maestros Supabase (families 15/16/17)` → `maestros Supabase (families 15/16/19)`

(b) línea 14:
Antes: `**Inyeccion PU (espuma poliuretano)** — maestro family 17 (Iny PUR Headrest).`
Después: `**Inyeccion PU (espuma poliuretano)** — maestro family 19 (Proceso de Inyeccion PUR in place; la 17 es IP PAD Patagonia - Tapizado).`

(c) línea 26:
Antes: ``| Iny PUR Headrest | 17 | ver memoria `project_maestro_pu_headrest` | — | 1 OP, aplica a 3 Headrest |``
Después: ``| Inyeccion PUR in place | 19 | d32de6b8-b240-43fc-9e45-1e6fe3b83c27 (AMFE-MAESTRO-PU-001; decisiones: memoria `project_maestro_pu_headrest`) | — | 1 OP, aplica a 3 Headrest |``

### H11 — `.claude/skills/amfe-cookbook/SKILL.md:82`

Antes: ``| INYECCION PU / ESPUMADO | **Sin maestro** — pedir a Fak | Headrest OP ESPUMADO |``
Después: ``| INYECCION PU / ESPUMADO | `AMFE-MAESTRO-PU-001` (family 19) | Headrest OP ESPUMADO |``

### H12 — `.claude/commands/auditoria-cliente.md:40-45`

Antes:
```
  - AIAG-VDA: `AMFE\FMEA-AMFE-VDA-AIAG\446076670-FMEA-AIAG-VDA-First-Edition-pdf.pdf` — ⚠️ es un
    BORRADOR (Word del 05/12/2017; el manual salio en junio de 2019): su tabla AP y sus escalas
    no son las publicadas. Para AP, P1, P2 y P3 manda el SETEC 2020 (abajo). Decirselo al auditor;
    que la casa siga usando el borrador es una decision pendiente de Fak (memoria
    `project_tabla_ap_de_la_casa_es_el_borrador_2017`), no un hallazgo a repetir en cada auditoria.
```
Después:
```
  - AIAG-VDA: `AMFE\FMEA-AMFE-VDA-AIAG\446076670-FMEA-AIAG-VDA-First-Edition-pdf.pdf` — ⚠️ es un
    BORRADOR (Word del 05/12/2017; el manual salio en junio de 2019): su tabla AP y sus escalas
    no son las publicadas. Para AP, P1, P2 y P3 manda el SETEC 2020 (abajo). Decirselo al auditor.
    La tabla AP de la casa ya es la del SETEC (23/09/2026); las escalas O/D de `amfe.md` §13
    todavia citan el borrador y falta transcribir las del SETEC (memoria
    `project_tabla_ap_de_la_casa_es_el_borrador_2017`): eso no es un hallazgo a repetir en cada auditoria.
```

### H13 — `.claude/commands/audit-amfe.md:29`

Antes:
```
- AP matches `calculateAP` (`modules/amfe/apTable.ts`), NOT S*O*D formula (the table's own source is under review, memory `project_tabla_ap_de_la_casa_es_el_borrador_2017`: report, don't recalculate)
```
Después:
```
- AP matches `calculateAP` (`modules/amfe/apTable.ts` = the official AIAG-VDA table, SETEC 2020 pp. 116-118, in force since 23/09/2026), NOT an S*O*D formula
```

### H14 — `.claude/skills/amfe-export-oficial/SKILL.md:81-83`

Antes:
```
## 5. Scripts de referencia
- `scripts/_buildAmfeBarack.mjs` — construye doc con header canónico + FM secuencial + O/D.
- `scripts/_exportOficial.ts` (159/160) y `scripts/_exportAmfeAmarok.ts` (128/129) — usan `buildAmfeOficialWorkbook`. Amarok corre con `SUPABASE_SERVICE_ROLE_KEY=... VITE_SUPABASE_URL=... npx tsx`.
```
Después:
```
## 5. Scripts de referencia
- **El export oficial de cualquier AMFE:** `npx tsx scripts/_exportAmfeOficial.ts --amfe <numero> --out <carpeta>`.
  Tiene los gates de `amfe.md`: no exporta sin marcador `.audit-cliente/<amfe>.json` de menos de
  7 dias (`/auditoria-cliente`; `--sin-auditoria` solo para trabajo interno) ni con metadatos de
  redaccion en el log de revisiones (`scanRevisionMeta()`).
- `scripts/_buildAmfeBarack.mjs` — construye doc con header canónico + FM secuencial + O/D.
- `scripts/_exportOficial.ts` (159/160) y `scripts/_exportAmfeAmarok.ts` (128/129) — exports
  puntuales anteriores: usan `buildAmfeOficialWorkbook` pero **no** tienen el gate de auditoria.
  Amarok corre con `SUPABASE_SERVICE_ROLE_KEY=... VITE_SUPABASE_URL=... npx tsx`.
```
(Línea 18 queda: es un dato cierto sobre esos dos scripts.)

### H15 — `.claude/skills/supabase-safety/SKILL.md:128`

Antes:
```
**Override:** si el script intencionalmente deja algunos issues (ej: placeholder para que el equipo APQP complete), usar `{ allowNewCritical: true }` como cuarto argumento y documentar por que.
```
Después:
```
**Override:** si el script deja a proposito un issue CRITICAL que Fak acepto, usar `{ allowNewCritical: true }` como cuarto argumento y escribir en el script el porque, con la frase de Fak. El placeholder `Pendiente definicion equipo APQP` nunca es ese motivo: esta prohibido (`amfe.md` §4) y un AP=H sin accion va con la celda vacia.
```

### H16 — `.claude/skills/cad-design/SKILL.md:173` y `scripts/gate_giro.py:3`

Antes (SKILL): `**GATE 5 — TRAYECTORIA** (`gate_giro.py`, 24/08/2026).`
Después (SKILL): `**GATE 6 — TRAYECTORIA** (`gate_giro.py`, 24/08/2026; el GATE 5 de `cad-3d.md` es "medir si el PROCESO repite").`
Antes (`gate_giro.py:3`): `"""GATE 5 — TRAYECTORIA: …`
Después: `"""GATE 6 — TRAYECTORIA: …`

### M1 — `.claude/skills/arb-operar/SKILL.md:8-54` (incluye H2)

Después (reemplaza el bloque entero):
```
> **Qué anda, con qué script y cuándo se probó** (cada fila contra el export de la base entera;
> la crónica de agosto: `reference/bitacora-tandas-2026-08.md`):
>
> | Operación | Cómo | Probado |
> |---|---|---|
> | Cambiar consumos | `_arbCargar.py`; un modal con `Aceptar` lo cierra `_arbVer.py modal` | 31/31 el 20/08 |
> | Cambiar la `Unidad` | `_arbUnidad.py`, en la MISMA tanda que la conversión de consumos: la unidad es una sola para OC y BOM | 11/11 el 22/09 |
> | Dar de alta líneas | `_arbAlta.py`; en lote `_arbAltaLote.py`; en un producto SIN BOM `_arbAlta.traer_vacio()` | 31/31 el 07/08 · 12/12 el 28/08 |
> | Sustituir el código de una línea (y, opcional, cantidad/módulo/proceso) | `_arbSustituir.py` | 5/5 el 15/09 · 31/31 el 23/09 |
> | Alta de CÓDIGOS en el maestro, leer la ficha, `Es Sub-Producto` | `_arbInsumoCampos.py` (`--leer`, `--alta tabla.csv --como <HERMANO>`, `--subproducto`) | 12/12 y 2/2 el 23/09 |
> | Cambiar la `Descripción` del maestro | `_arbDescripcion.py`; dentro del formulario se TABULA (`reference/maestro-de-insumos.md`) | 3/3 el 01/09 |
> | Borrar líneas | — | fuera de alcance |
>
> Tres reglas de las tandas de septiembre:
> - **Una tecla a ciegas aprieta lo que esté abajo; un click fallido no abre nada.** Las
>   ventanas se abren por click (`_arbCargar.abrir()` → `reset_relaciones()`). Si el arb se
>   reabrió con el ribbon **minimizado**, el click al botón no abre nada: desplegarlo con
>   `click (1474, 42)` de `Producción`.
> - El export deja Relaciones en la solapa `Listado`: se vuelve a `Altas` con
>   `_arbVer.py click 118 68`, **no con `reset`** (con Relaciones abierta se niega; cerrarla
>   crashea el arb).
> - El cartel de Visual C++ sale en cada alta del maestro y el registro graba igual: el script
>   aprieta `Omitir`.
>
> **Una limitación escrita por mí no es un hecho verificado.** Antes de anotar que algo "no se
> puede", probarlo y fecharlo: las dos veces que esta skill lo dio por imposible (el scroll de la
> grilla, las altas) costaron 13 líneas sin cargar y un "terminado" que no lo era.
>
> Sale con reintentos, y reintentar es seguro. Lo marcado `CONFIRMADO`/`medido` se probó; lo
> demás es hipótesis y **no se ejecuta sin verificar antes**.
```
Los conteos intermedios (14/14, 16/16, 36/36, diffs 6257→6257, 7348→7348, 5503→5531) ya están en
la bitácora o en los commits; si se quieren conservar, van a una sección "Tandas de septiembre"
de `reference/bitacora-tandas-2026-08.md`.

### M2 — `.claude/skills/arb-operar/SKILL.md`, cuatro frases "la versión vieja"

(a) 176-180. Antes:
```
**No es `Shift`+`↑`** (probado dos veces, no hace nada). ~~ni `Alt` (el ribbon no tiene
KeyTips) ni las flechas para cambiar de solapa. La navegación del ribbon es con mouse~~ —
**las tres afirmaciones eran falsas, corregido el 25/08/2026**: el ribbon SÍ tiene KeyTips
(son ventanas `KbxLabelClass` y se leen), las flechas SÍ cambian de solapa una vez que `Alt`
lo activó, y la navegación entera se hace por teclado. Ver "Navegación 100% por teclado".
```
Después:
```
**No es `Shift`+`↑`** (probado dos veces, no hace nada). El ribbon tiene KeyTips (ventanas
`KbxLabelClass`, se leen) y las flechas cambian de solapa una vez que `Alt` lo activó: ver
"Navegación 100% por teclado".
```
(b) 380-381. Antes: `` pero **no reciben el foco**. La versión vieja decía "insumos × 7 columnas": estaba mal. `` → Después: `` pero **no reciben el foco**. ``

(c) 404-405. Antes:
```
> ⚠️ **La versión vieja de esta tabla decía que escribir NO necesitaba foco. Estaba mal, y
> era la razón de fondo por la que las cargas "entraban" y no grababan.** Medido el
```
Después:
```
> ⚠️ **Sin foco, lo escrito se ve en pantalla y no se graba** (era la razón de las cargas que
> "entraban" y no grababan). Medido el
```
(d) 550-551. Antes: `(definiciones de tabla, 1996-2019) — **no datos**; los datos viven en el servidor Pervasive, fuera de alcance por red. La versión vieja de esta skill lo daba por backup.` → Después: se borra la última oración.

### M3 — `.claude/skills/imds/SKILL.md:410`

`### El buscador del arbol vive en un IFRAME y tiene dos trampas` → `### El buscador del arbol vive en un IFRAME y tiene tres trampas`

### M4 — `.claude/skills/cad-design/SKILL.md:31-32`

Antes: `> y no servir, porque lo que lo hace fallar pasa **mientras el operario trabaja**. Por eso` / `> el primer gate ya no es el 0.`
Después: `> y no servir, porque lo que lo hace fallar pasa **mientras el operario trabaja**. Por eso` / `> el primer gate es el P, antes que el 0.`

### M5 — `.claude/skills/cad-design/SKILL.md:121-127`

Antes:
```
  **De vuelta en servicio (2026-08-09)** tras dos falsos verdes: la concavidad ya no se le
  pregunta a una malla sino a la topología OCC (normal invertida si la cara es `REVERSED`;
  la tangente **con el signo que la arista tiene dentro del wire de la cara** — ése era el
  bug que quedaba). Trae par sintético BIEN/MAL propio que corre en **cada** invocación: si
  no separa, sale con **código 3** y no juzga nada. `--verificar-material` da una segunda
  opinión con un método que no comparte una línea de código (fracción de material alrededor
  de la arista, `BRepClass3d_SolidClassifier`); sobre 5 piezas coincidieron en 1094/1094.
```
Después:
```
  La concavidad la decide la topología OCC, no una malla. Trae par sintético BIEN/MAL propio
  que corre en **cada** invocación: si no separa, sale con **código 3** y no juzga nada.
  `--verificar-material` da una segunda opinión con un método que no comparte código (fracción
  de material alrededor de la arista); sobre 5 piezas coincidieron en 1094/1094.
```

### M6 — `.claude/skills/cad-design/SKILL.md:182` → `reference/enforcement-como-se-cerro.md`

Antes: `Dos cosas que enseñó escribirlo: (a) sin decimar, … y se informa; (b) el autotest nació fallado: … y sólo la vuelta entera los separa.`
Después (SKILL):
```
Sin decimar, una base de 620×480 con `lc=3` da millones de puntos y el barrido **no termina**:
la celda de decimación (`--celda`) es además **la resolución del resultado** y se informa. Cómo
se armó su autotest para que separe de verdad: `reference/enforcement-como-se-cerro.md`.
```
Y el texto de "(b)" pasa tal cual al final de `reference/enforcement-como-se-cerro.md`, bajo
"### El autotest de `gate_giro.py` (24/08/2026)".

### M7 — `.claude/skills/cad-design/SKILL.md:218-223`

Antes: `El motor bueno vive ahora **acá**: `.claude/skills/cad-design/scripts/foto3d.py` (… fondo blanco — Fak 02/09: …). Nació suelto en la carpeta de trabajo del carro; vivir ahí significaba que la tarea siguiente volvía a matplotlib, que es el fallo que existe para no repetir.`
Después: `El motor es `.claude/skills/cad-design/scripts/foto3d.py` (… fondo blanco — Fak 02/09: …).` (queda el paréntesis entero; sale la última oración).

### M8 — `.claude/skills/cad-design/SKILL.md:225`

`los siete nacieron cada uno DESPUÉS de que una persona encontrara el bug` → `todos nacieron DESPUÉS de que una persona encontrara el bug`

### M9 — `.claude/skills/cad-design/SKILL.md:215` (agregar al final de G-E4)

Después de `…entiende?"*. Cada objeción se resuelve o se le dice a Fak.` agregar:
```
  `revision_ciega.py --step <pieza>.step --workdir W --funcion "<para qué sirve>"` arma ese
  expediente (renders con escala, magnitudes y ratios, sin la derivación) y el prompt para el
  `Agent`; sale siempre con 0: prepara el juicio, no lo da.
```

### M10 — `.claude/skills/docs-empresa/SKILL.md:45`

Antes: `| Manuales oficiales (AIAG-VDA FMEA 2019, SETEC p129 CC/SC, VDA, MSA, IMDS, Formel Q, IATF) | OneDrive: …`
Después: `| Manuales oficiales (SETEC 2020 = AIAG-VDA publicado: tabla AP p116-118, P1-P3 p101-111, CC/SC p129; VDA, MSA, IMDS, Formel Q, IATF). ⚠️ El PDF de `AMFE\FMEA-AMFE-VDA-AIAG\` es un BORRADOR de 2017, no el manual 2019 | OneDrive: …` (el resto de la fila igual)

### M11 — `.claude/skills/docs-empresa/SKILL.md:59`

Antes: `- Escribir/mover archivos EN el servidor u OneDrive = confirmar con Fak antes (autonomy-contract).`
Después: `- Escribir/mover en el servidor `Y:` = confirmar con Fak antes, y solo lo oficial en el lugar que el SGC ya tiene (`autonomy-contract.md` §D y §F). En OneDrive, el entregable propio va a su carpeta por tipo de la biblioteca de Ingeniería al cerrar la tarea (`CLAUDE.md`, fin de sesión §5).`

### M12 — `.claude/skills/supabase-safety/SKILL.md:66`

Antes: `Guarda snapshot de 12 tablas en `backups/<timestamp>/`. Lo corre solo el hook …`
Después: `Guarda un JSON por cada tabla con filas en `backups/<timestamp>/` (el inventario lo lee live: no hay un número fijo) y compara filas esperadas contra respaldadas en `_manifest.json`. Lo corre solo el hook …`

---

## (d) Lo verificado contra disco / base

- **Rutas de archivos citadas**: 104 nombres de archivo de los 22 archivos del alcance, buscados
  en el repo (`git ls-files` + `find`). 4 no existen y son salidas generadas (`manifest.json`
  del workdir, `armado.json`, `_manifest.json` del backup, `tmp/we_placeholders_audit.json`,
  que genera `_auditWePlaceholdersAndAllocation.mjs`). Las rutas con carpeta: 3 que no existen
  son ejemplos a propósito (`rules/foo.md`, `_auditFoo.mjs`, `_miFix.mjs`).
- **Flags de CLI**: 93 flags citados junto a su script, buscados en el fuente: 0 faltan. Aparte,
  `argparse` de los 18 CLIs de `cad-design/scripts/` (todos los flags del SKILL existen, incluido
  `gate_giro.py --celda` que propone M6), subcomandos de `_video.py` (`sondeo hojas analizar
  candidatos temblor niveles`), `master.py --cancion`, `capturarModelo3d.cjs`
  (`--html --out --tomas --ocultar`) y los campos de `tomas-ejemplo.json`,
  `_exportAmfeOficial.ts` (`--amfe --out --nombre --sin-auditoria`),
  `_arbVer.py` (`estado foto click export modal reset [--forzar] excel`).
- **Memorias**: 29 citadas con prefijo + las citadas como "memoria X": todas existen; la
  archivada de `rule-enforcement-gate` está en `_archive_2026-08-20_consolidacion/`.
- **Funciones**: `cadlib.geom` (`contains_batched`, `extract_cylinder_axes`, `fit_plane`,
  `orthonormal_frame`, `_load(keep=)`), `cadlib.topo.measure_offset`, `_lib/amfeIo.mjs`
  (`connectSupabase`, `listAmfes`, `saveAmfe`, `countAmfeStats`, `calculateAP`),
  `runWithValidation(plan, apply, commitFn, opts)` (el 4.º argumento de H15 es correcto),
  `_arbAlta.traer_vacio`, `_arbCargar.abrir` (docstring citado en H4/H17),
  `_arbVer.reset_relaciones(forzar)` y `cerrar_modales()` (citados en H1-H6),
  `_arbVer.export()` (receta ↑×8 ↓×3 + gate, citada en H5).
- **Secciones de `reference/` citadas desde los SKILL**: `arb-operar` (bitácora: "Pararse en
  Parte Superior es con CLICK"; altas-de-linea: "EL SCROLL…"; maestro: alta por robot, 31/08,
  01/09) existen; lo único roto son los punteros "la sección nueva del 31/08" y "la sección del
  01/09" del bloque de estado (M1), que no están en el SKILL. `cad-design`: las 4 referencias
  existen y `lecciones-caras.md` tiene exactamente **39** lecciones. `editar-video`: las 3
  existen.
- **Supabase live** (solo `select`): 13 familias (2, 5-11, 15-19; la 17 = IP PAD, la 19 = PUR);
  **20** `amfe_documents` (el "20 on 22/09" de `audit-amfe.md` sigue bien); `family_documents`
  de 15/16/17/19; `d32de6b8…` = `AMFE-MAESTRO-PU-001`.
- **Código**: `apTable.ts` = tabla SETEC desde el commit `7e8d1a74` (23/09);
  `_exportAmfeOficial.ts` tiene el gate de 7 días y `--sin-auditoria`; `_exportOficial.ts` y
  `_exportAmfeAmarok.ts` no nombran `.audit-cliente` (0 y 0); G-E2 de `gate_entregable.py`
  sigue comparando `mtime` (el "LÍMITE CONOCIDO" de `cad-design` §5 sigue siendo cierto);
  `revision_ciega.py` existe (commit `44663190`, 08/08) y ningún skill ni regla lo nombra.
- **Backup**: `_backup.mjs` escribe `_manifest.json`, imprime `✓ Backup valido` y `DESCUADRE`
  (lo que dice `backup.md` está bien); último manifest: 38 tablas inventariadas, 28 con filas.
- **Herramientas**: ffmpeg `8.1-full_build` (gyan.dev), Python 3.13.12,
  `C:\Program Files\Autodesk\AutoCAD 2026\`, `C:\Dev\_lsr_patagonia\_scripts\plot_dwg.py`,
  `.claude/agents/auditor-cliente.md` con `omitClaudeMd: true`.
- **OneDrive** (un solo nivel, sin recursión): `4- MANUALES\IMDS\` (los 4 PDF del manual
  destilado + `IMDS CURSO`), `4- MANUALES\AMFE\` (`FMEA-AMFE-VDA-AIAG`, el SETEC 2020);
  `docs-local/` (junction con `INDEX.md normas-vw projects shared`), `.sgc-cache/`.
- **No verificable en esta sesión** (`Y:` y `Z:` no están montados): `Z:\arb\prod\produc.exe`
  y su versión 14.05.26, las rutas `Z:\arb\…`, los nombres de casillero de los legajos en `Y:`
  (L9) y `…\APQP\23- IMDS\`.
