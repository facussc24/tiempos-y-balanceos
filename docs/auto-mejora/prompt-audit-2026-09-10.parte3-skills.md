# Prompt-audit 10/09/2026 — parte 3: los 19 skills del repo

Guia: `claude-api/shared/prompt-audit.md` (Claude Code 2.1.266), pasos 0-7. Modelo objetivo: **Claude Fable 5.1 / Opus 5**.
Parte 1 (nucleo siempre cargado): `docs/auto-mejora/prompt-audit-2026-09-10.parte1-nucleo.md`.
Auditor: subagente dedicado. **No se edito ningun skill**: este informe propone, no aplica.

## 1. Supuestos

- Alcance: los 19 `.claude/skills/*/SKILL.md` y sus archivos de apoyo. No se auditan las reglas
  (`.claude/rules/`) ni el nucleo, salvo donde un hallazgo del skill no cierra sin tocar la regla
  (se marca `↗ fuera de alcance` y se nombra el archivo).
- Keep list aplicada sin excepcion: contexto que solo el autor sabe, scripts exactos para
  operaciones fragiles (arb, DXF, Supabase, plotter), decisiones fechadas de Fak, correcciones
  de Fak con su cita textual. Ningun bullet con cita de Fak se propone borrar — se propone
  mover o reencuadrar.
- **Uso bajo no es motivo de borrado.** Se señala y nada mas.
- Verificacion: los datos volatiles se cruzaron contra el disco. **63 verificaciones**: 51
  archivos/scripts citados (`ls`), 23 memorias (`~/.claude/projects/C--Dev-BarackMercosul/memory/`),
  las 4 tablas APQP contra **Supabase live** (query read-only), el interprete `.venv-cad` con
  sus 9 librerias, el espacio en disco, `ffmpeg` en el PATH, el usuario de Windows y el
  frontmatter `paths:` de las reglas que conviven con cada skill.

## 2. Inventario

`description` = largo en caracteres del campo del frontmatter, que se inyecta en **cada sesion**,
se use o no el skill. `Skill()` = sesiones donde se invoco por la tool Skill; `Read` = sesiones
donde se leyo el SKILL.md (sobre 165 transcripts).

| Skill | Lineas | Bytes | description | Skill() | Read | Archivos propios |
|---|---:|---:|---:|---:|---:|---|
| arb-operar | 1190 | 66.059 | 427 | 7 | 30 | — |
| cad-design | 970 | 77.144 | 516 | 9 | 32 | `scripts/` (39) + `examples/` + `data/` + `ROADMAP.md` |
| editar-video | 736 | 46.149 | 548 | 1 | 8 | — (usa `scripts/video/`) |
| patrones-corte-plotter | 411 | 26.388 | 543 | 2 | 9 | `scripts/` (3) |
| apqp-schema | 248 | 9.820 | 352 | 1 | 4 | — |
| carga-arb | 229 | 12.877 | 462 | 1 | 15 | — |
| hojas-de-proceso | 216 | 12.541 | 631 | 0 | 7 | `scripts/` (3) |
| flujogramas | 200 | 11.080 | 581 | 0 | 4 | — (usa `tools/flowchart/`) |
| supabase-safety | 193 | 8.715 | 286 | 1 | 3 | — |
| amfe-cookbook | 189 | 10.723 | 317 | 0 | 2 | — |
| amfe-domain | 146 | 10.538 | 490 | 0 | 3 | — |
| rule-enforcement-gate | 124 | 6.056 | 528 | 2 | 4 | — |
| amfe-export-oficial | 104 | 8.344 | 379 | 1 | 7 | — |
| autocad-verificar | 98 | 5.793 | 337 | 0 | 6 | — |
| leer-planos | 91 | 4.347 | 414 | 0 | 4 | — |
| verificacion-consumos | 88 | 5.534 | 348 | 1 | 7 | — |
| docs-empresa | 73 | 5.747 | 428 | 0 | 9 | — |
| injection-process | 67 | 6.050 | 449 | 0 | 3 | — |
| product-map | 43 | 2.272 | 297 | 0 | 6 | — |
| **TOTAL** | **5.416** | **336.177** | **8.333** | | | |

**Ninguna `description` pasa de 1.000 caracteres** (la mas larga, `hojas-de-proceso`, 631). El
costo fijo de las 19 es **~8,3 KB (~2,1k tokens) por sesion**, y ninguna sesion usa mas de dos
skills. Ningun skill tiene todavia carpeta `reference/`: la particion que se propone en §5
estrena el patron.

Tres skills pasan el techo de 500 lineas de la doc: **arb-operar (1190), cad-design (970),
editar-video (736)** — juntos son el **72 % de los bytes** de todo el conjunto.

## 3. Resumen

Conteo: **16 alta · 20 media · 9 baja/flag** (45 hallazgos).

Por grupo de la guia: **Grupo 2 — volatile specifics rotos o vencidos** 11 alta / 8 media ·
**Grupo 2 — narrativa historica y recency trap** 4 alta / 6 media · **1d frases relativas
("esta seccion decia...")** 0 alta / 5 media · **Grupo 3 descripciones** 0 alta / 2 media /
1 baja · **1a presion / marcadores** 0 alta / 0 media / 2 baja · **1c sobre-especificacion**
1 alta / 0 media / 2 baja · **keep-list #8 (redundancia que funciona)** 4 flags.

Los tres de mas impacto:

1. **Dos skills enseñan lo contrario de lo que el codigo y la base hacen con la columna `data`.**
   `supabase-safety` (el skill de uso **obligatorio** antes de cualquier escritura) y
   `apqp-schema` dicen que `amfe/cp/ho/pfd_documents.data` es **JSONB** y que hay que pasar el
   objeto crudo; `amfe-cookbook` dice que es **TEXT** y que va `JSON.stringify`. Verificado
   contra **Supabase live** (query read-only, 11/09/2026): las cuatro tablas devuelven
   `typeof data === 'string'`. Y `scripts/_lib/amfeIo.mjs` tiene un WRITE GUARD que **lanza
   excepcion** si `data` no es string, mas un verify post-escritura que exige lo mismo. O sea
   que el skill de seguridad describe el camino que el helper bloquea. `.claude/rules/database.md:25`
   repite el error (↗ fuera de alcance, pero el fix no cierra sin el).

2. **`arb-operar` es una bitacora, no un manual: se contradice a si misma en cinco lugares y una
   de las contradicciones cuesta lineas sin cargar.** El §RECETA (lineas 349-358) y el orden de
   arranque (796) mandan **sacar del lote toda linea que caiga en la fila ≥6** "porque la grilla
   muestra 6 y no se alcanza"; 280 lineas mas abajo (635-646) dice que eso era *"una limitacion
   inventada: 13 lineas quedaron sin cargar por eso"* y que la grilla scrollea sola. El codigo
   (`scripts/_arbCargar.py:793,826-837`) ya implementa el scroll. Lo mismo con las altas
   (encabezado: "31/31 el 07/08"; §Seguridad:1170: "fuera de alcance"), con el modal, con la
   ventana, con `&Cancela` y con los `RichEdit20A`.

3. **Cuatro rutas de script que no existen tal como estan escritas** — y las cuatro estan en las
   secciones ejecutables, no en la prosa: `scripts/patronlib.py` (patrones-corte-plotter:69),
   `scripts/foto3d.py` y `scripts/cadlib/` (cad-design:16,239,356), `scratchpad/mono.py` y
   `scratchpad/mono2.py` (editar-video:614,623), `C:\Users\facun\...` (docs-empresa:45, un
   usuario de Windows que en esta notebook no existe). Las tres primeras son skills con carpeta
   `scripts/` propia cuyo texto escribe la ruta como si colgara de la raiz del repo, donde hay
   **otro** `scripts/`.

Lo que **no** se propone tocar: los tres skills de dominio puro (`product-map`,
`injection-process`, `leer-planos`) y `verificacion-consumos`, `autocad-verificar`,
`flujogramas`: superficie limpia, todos sus datos verificados, forma correcta.

---

## 4. Hallazgos

Campos: Ubicacion · Evidencia · Patron · Por que · Confianza · Accion.

### 4.1 La contradiccion JSONB / TEXT (cruza 3 skills)

Evidencia comun, verificada el 11/09/2026:

```
Supabase live (query read-only, select * limit 1):
  amfe_documents -> typeof data = string      cp_documents -> typeof data = string
  ho_documents   -> typeof data = string      pfd_documents -> typeof data = string
scripts/_lib/amfeIo.mjs:6-8   "Las columnas `data` de amfe/cp/ho/pfd_documents son TEXT (no JSONB)."
scripts/_lib/amfeIo.mjs:262   if (typeof payload.data !== 'string') throw new Error('saveAmfe WRITE GUARD: ...')
scripts/_lib/amfeIo.mjs:271   if (typeof verify.data !== 'string') throw new Error('VERIFY ...: data is not string')
```

| # | Ubicacion | Evidencia | Patron | Por que | Conf. | Accion |
|---|---|---|---|---|---|---|
| 1 | `supabase-safety/SKILL.md:37-45` | `### 3. NUNCA double-serializar JSONB` · `Las columnas data son JSONB. Pasar el OBJETO directo` · `// INCORRECTO — convierte a string dentro de JSONB` | volatile specific invertido | Es exactamente al reves para las 4 tablas APQP. El skill es de **uso obligatorio antes de escribir**: es el peor lugar posible para el error, y el helper que la casa usa aborta si se le hace caso | alta | rewrite |
| 2 | `supabase-safety/SKILL.md:150-152` | fila 1 del checklist: `` `data` como string (double-serialization) `` → `` typeof row.data === 'object' debe ser true `` | idem | El verify real exige `=== 'string'`. Un chequeo que da rojo sobre la base sana | alta | rewrite |
| 3 | `apqp-schema/SKILL.md:11` | `Todos los documentos APQP guardan sus datos en una columna data de tipo JSONB` | volatile specific falso | Verificado contra live: string en las 4 | alta | rewrite |
| 4 | `apqp-schema/SKILL.md:220-246` | `await supabase.from('cp_documents').update({ data: updatedData })` con el objeto crudo | idem | El patron que enseña es el que `saveCp()` rechaza (`data must be string`) | alta | rewrite |
| 5 | `apqp-schema/SKILL.md:248` | `Para documentos grandes (>100KB), usar updateDocDirect() del helper **si existe**.` | volatile specific + hedge | `grep -rn updateDocDirect` sobre `.ts/.tsx/.mjs`: **0 resultados**. Y "si existe" es un dato sin verificar escrito como instruccion | media | remove |
| ↗ | `.claude/rules/database.md:25` | `NUNCA double-serializar JSONB: .update({ data: objeto }) ... JAMAS JSON.stringify(objeto)` | idem | Fuera del alcance de esta parte, pero el fix de #1-#4 no cierra sin el: es la regla que carga sola al tocar `utils/repositories/` y `scripts/` | alta | ↗ parte 2 |

### 4.2 arb-operar (1190 lineas)

| # | Ubicacion | Evidencia | Patron | Por que | Conf. | Accion |
|---|---|---|---|---|---|---|
| 6 | `arb-operar:349-358` y `:796` | `El scroll SÍ es un problema ... una línea en la fila 7 o más abajo **no se alcanza**` · `Gate obligatorio antes de correr una tanda: ... las de índice 6 en adelante van a mano` · orden de arranque paso 3: `¿alguna linea cae en fila >= 6? -> sacarla del lote, va a mano` | Grupo 2: recency trap + contradiccion interna | El mismo archivo lo desmiente en `:635-646` (*"era una limitacion inventada: 13 lineas quedaron sin cargar por eso"*, dato de Fak) y el codigo lo resuelve: `_arbCargar.py:793` *"al pasar de la ultima, la grilla scrollea sola y el recorrido continua"* + `:826-837` el anclaje. La instruccion vigente **saca del lote lineas que el robot carga bien** | alta | rewrite |
| 7 | `arb-operar:1165-1171` | `no alcanzaría para altas ni bajas de líneas — **por eso están fuera de alcance** (decisión de Fak 05/08)` | Grupo 2: texto que sobrevivio a su version | El encabezado del mismo archivo (`:11-12`) dice `Dar de alta líneas: ANDA (scripts/_arbAlta.py) — 31/31 el 07/08`, y existen `_arbAlta.py` y `_arbAltaLote.py` (verificados, con sus gates). Lo que sigue fuera de alcance es **borrar** | alta | rewrite |
| 8 | `arb-operar:576` y `:594` | `📋 DAR DE ALTA UNA LÍNEA — la secuencia, dictada por Fak **2026-08-07, SIN PROBAR**` · `⚠️ **Esto NO se ejecutó todavía.**` | idem | Se ejecuto: 31/31 el mismo dia y 12/12 el 28/08. Un skill que se declara sin probar frena la operacion que ya es rutina | alta | rewrite |
| 9 | `arb-operar:708-730`, `:768-777`, `:818-845`, `:964-969` vs `:1094-1103`, `:993-996`, `:23-27` | `~~🔴 LAS TECLAS SINTÉTICAS NO ABREN EL MENÚ~~ — **ERA FALSO**` · `~~El modal lo tiene que cerrar una persona~~ **CORREGIDO 20/08**` · `🟢🟢 ... — corrige lo que dice arriba` · `🟢🟢 LOS RichEdit20A SÍ DEVUELVEN TEXTO ... **CORRIGE lo de arriba**` · `~~Se sale con &Cancela, no con ESC~~ — **FALSO, corregido 31/08 por Fak**` | Grupo 2: history narratives + 1d frases relativas | Seis pares tachado/corregido. El lector tiene que reconciliar la version vieja y la nueva **en cada lectura**, y el texto tachado sigue siendo texto que entra al contexto. La correccion se integra en el enunciado vigente; el par (lo que se creia / lo que era) va al reference de bitacora, que es donde tiene valor | alta | move + rewrite |
| 10 | `arb-operar:430-889` | `## Tanda del 2026-08-06 — 16 de 16, y lo que costó llegar` · `## Tanda del 2026-08-07 — 0 de 12` · `## Tanda del 2026-08-20 — 31 de 31` | Grupo 2 + tamaño | 460 lineas ordenadas por **fecha de descubrimiento**, no por tema. Dentro de cada tanda conviven la cronica y reglas operativas vigentes (modal, coma, celda sucia, combo). Se reordena por tema: ver la particion en §5.A | alta | move |
| 11 | `arb-operar:532` | `Helper: **arbver.py** (scratchpad) — foto rel\|prod, click X Y, estado` | volatile specific roto | Verificado: no existe `arbver.py` ni en el repo ni en ningun scratchpad vivo. La herramienta real es `scripts/_arbVer.py`, que el propio skill usa 9 veces mas abajo | alta | rewrite |
| 12 | `arb-operar:47-62` | `## 🔴🔴 EL arb NO SE CIERRA SIN CONSULTARLE A FAK (regla dura, 31/08/2026)` + 15 lineas | duplicado de una regla que carga sola | `arb-no-cerrar.md` tiene `paths: [".claude/skills/arb-operar/**", "scripts/_arb*.py", ...]` (verificado en su frontmatter): **siempre que se usa este skill, la regla ya esta en el contexto**, con el incidente, la tabla de permitido/prohibido, el escape y el enforcement. No disienten, asi que no es un error — es la misma pagina dos veces | media | rewrite a puntero de 3 lineas |
| 13 | `arb-operar:190-192` | `**POR CONFIRMAR:** cuántos TAB hasta Cantidad, cómo bajar de fila, y cómo se graba (¿ACEPTA, F-key?)` | Grupo 2: pregunta ya contestada | Contestado en el mismo archivo: `:333-342` da la formula medida (`3 + 5*i`, `5*N + 2`) y `:330` dice que graba `ENTER sobre &Acepta`. Un "por confirmar" resuelto invita a re-medir lo que ya se midio | media | remove |
| 14 | 20 titulos con `🔴🔴` / `🟢🟢` | `### 🔴🔴 EL KEYTIP DEL PANEL ES DE TRES CARACTERES` · `### 🟢🟢 MIRAR LA PANTALLA` ... | 1a presion | Cuando casi todo esta marcado, el marcador deja de informar (la guia: *"when several instructions are each marked critical, the markers stop carrying information"*). No hace daño medible; se señala | baja | flag |

### 4.3 cad-design (970 lineas)

| # | Ubicacion | Evidencia | Patron | Por que | Conf. | Accion |
|---|---|---|---|---|---|---|
| 15 | `cad-design:16`, `:239`, `:356` | `La librería vive en **scripts/cadlib/**` · `El motor bueno vive ahora **acá**: scripts/foto3d.py` · `los renders con foto3d.py` | volatile specific ambiguo | Verificado: **no existe** `scripts/foto3d.py` ni `scripts/cadlib/` desde la raiz del repo. Viven en `.claude/skills/cad-design/scripts/`. La raiz tiene otro `scripts/` (el que CLAUDE.md documenta), asi que la ruta corta resuelve al lugar equivocado. La regla `cad-3d.md` si escribe la ruta larga — las dos fuentes no coinciden | alta | rewrite |
| 16 | `cad-design:409-646` y `:709-953` | `## 5. Lecciones caras (el porqué de todo esto)` — lecciones 1 a 39 | Grupo 2 + tamaño | **483 lineas, ~44 KB**: el 57 % del skill. Cada leccion es un caso fechado con su enforcement al lado; el valor esta, pero se paga entero en cada trigger. Es el caso de libro de progressive disclosure | alta | move |
| 17 | `cad-design:220-237` | `> **DOS hipótesis mías que los datos refutaron el mismo día, para que nadie las reinvente.**` + 17 lineas de histograma y saturacion | Grupo 2 narrativa | El enunciado vigente (G-E3b se informa, no bloquea) cabe en 2 lineas y ya esta arriba. La cronica de los dos umbrales caidos es valiosa y va al reference | media | move |
| 18 | `cad-design:166-182` | `**Los 3 agujeros que tenía ese enforcement, cerrados el 2026-08-24** (auditoría independiente; los tres se demostraron EN CORRIDA...)` + 17 lineas | Grupo 2 narrativa | Lo vigente es lo que `export_deliverables.py` exige hoy (ya dicho en `:157-164`); el relato de los tres agujeros cerrados es historia con su test de regresion nombrado | media | move |
| 19 | `cad-design:955-967` | `**LIMITE CONOCIDO de G-E2, encontrado el 04/09/2026 (anotado, NO parcheado).**` | — | **Keep**: es un limite vigente del gate con su rodeo operativo y el motivo explicito de por que no se parcheo. Solo se reubica junto al bloque de entrega | baja | keep (reubicar) |
| 20 | `cad-design` ↔ `.claude/rules/cad-3d.md` | GATE P, GATE 0, GATE 1, GATE 2, GATE 3, GATE 4 y GATE E aparecen completos en los dos archivos | keep-list #8 (redundancia que funciona) | `cad-3d.md` carga sola al tocar `.step/.stl/.glb` o el skill; el hook `cad-guard.sh` inyecta un tercer resumen 1×/h. **No disienten** — la unica divergencia es la ruta de `foto3d.py` (#15), donde la regla tiene razon. No se propone deduplicar: se señala que hay tres copias y que la regla es la que esta bien escrita | baja | flag |

### 4.4 editar-video (736 lineas)

| # | Ubicacion | Evidencia | Patron | Por que | Conf. | Accion |
|---|---|---|---|---|---|---|
| 21 | `editar-video:614`, `:623`, `:569-570` | `scratchpad/mono.py decia "compatible en mono..."` · `Corregido en scratchpad/mono2.py` · `# el flujo que se uso, en scratchpad/: ver_cancion.py (mapa por segundo) -> grilla.py ... -> zonas.py` | volatile specific roto | Verificado: ninguno de los 5 existe — ni en el repo ni en los 4 scratchpads que sobreviven en `%TEMP%\claude\C--Dev-BarackMercosul\`. El scratchpad es por sesion: **nada citado ahi sobrevive**. El skill manda a usar herramientas que ya no estan | alta | rewrite |
| 22 | `editar-video:304-556` | `### 6.1 Si la musica se sintetiza, el objetivo se MIDE de una referencia real` (253 lineas), precedida de `> **Primero mirar §6.2.** Desde el 11/09/2026 el camino vivo es montar el tema que elige Fak` | Grupo 2 + tamaño + menu de alternativas | El propio skill declara que esta seccion **no** es el camino por defecto, y ocupa el 34 % del archivo. La guia: *"one default plus an escape hatch"*. El metodo (medir una referencia real) y el nivel de entrega (−20 LUFS) valen para las dos ramas y se quedan; el recetario de sintesis va al reference | alta | move |
| 23 | `editar-video:724` | `**Disco C: al 98%** (~7 GB libres)` | volatile specific vencido | Medido 11/09/2026: `238G total, 206G usados, 33G libres` = **87 %**. El consejo operativo sigue valiendo; el numero no | media | rewrite |
| 24 | `editar-video:717-718` | `ffmpeg 8.1-full_build ... **No esta en el PATH** — _video.py lo resuelve solo` | volatile specific vencido | `which ffmpeg` (Git Bash, 11/09/2026) lo encuentra: `.../Gyan.FFmpeg.../ffmpeg-8.1-full_build/bin/ffmpeg`. La version y el build son correctos; la frase del PATH no | media | rewrite |
| 25 | `editar-video:177-178` | `sondeo no lo avisa todavia (**queda pendiente agregarlo al script**)` | TODO en prosa | Es exactamente lo que el skill `rule-enforcement-gate` prohibe aceptar como cierre. Son 4 lineas de `ffprobe` que ya estan escritas al lado: o se agregan a `_video.py`, o la frase se escribe como "se verifica a mano asi" sin el "pendiente" | baja | flag |
| 26 | `editar-video:729-736` | `## 10. No existe skill publica que sirva para esto` — busqueda del 02/09, 9 proyectos comunitarios, `browser-use/video-use` 23k estrellas | Grupo 2 narrativa | No prescribe ninguna conducta: documenta por que se escribio el skill. El dato ("si aparece algo mejor, conservar la medicion") cabe en una linea | baja | move |

### 4.5 Rutas de scripts propios de skill (una sola familia)

| # | Ubicacion | Evidencia | Patron | Por que | Conf. | Accion |
|---|---|---|---|---|---|---|
| 27 | `patrones-corte-plotter:69` | `\| Libreria propia \| **scripts/patronlib.py** — importar desde ahi, no reescribir \|` | volatile specific roto | Verificado: `scripts/patronlib.py` **no existe**; esta en `.claude/skills/patrones-corte-plotter/scripts/patronlib.py`. Y en el mismo skill, `:109` cita `scripts/_mixPlotter.py`, que **si** existe en la raiz: dos rutas con la misma forma que resuelven a lugares distintos | alta | rewrite |
| 28 | `hojas-de-proceso:185-186` | tabla Enforcement, columna Donde: `scripts/hoja_proceso_check.py` · `scripts/hojalib.py` | idem | Los comandos de `:40`, `:52` y `:191-192` si llevan la ruta larga (`.claude/skills/hojas-de-proceso/scripts/...`). La tabla del final la pierde | media | rewrite |
| 29 | `hojas-de-proceso:107` | `(elegir_frame.py ordena candidatos del mismo video por foco...)` | idem | Verificado: vive en `scripts/hotmelt/elegir_frame.py`, no en los scripts del skill | media | rewrite |

### 4.6 Punteros vencidos y datos de maquina

| # | Ubicacion | Evidencia | Patron | Por que | Conf. | Accion |
|---|---|---|---|---|---|---|
| 30 | `docs-empresa:45` | `esta PC (**facun**): C:\Users\facun\BARACK ARGENTINA SRL\...` | volatile specific roto | Verificado: `ls /c/Users/` no tiene `facun`. Hay una sola PC desde el 02/08/2026 y su usuario es `FacundoS-PC` (memoria `reference_una_sola_pc_facu`, textual: *"Usuario Windows: FacundoS-PC — **no** facun"*). La fila ofrece dos rutas y la primera no existe | alta | rewrite |
| 31 | `docs-empresa:47` | `docs-local/ (junction OneDrive; **en ESTA PC el junction NO esta creado** — setup one-time...)` | volatile specific vencido | Verificado: `docs-local/` existe y lista `INDEX.md`, `normas-vw`, `projects`, `shared`. La advertencia manda a un setup que ya esta hecho | media | rewrite |
| 32 | `rule-enforcement-gate:16` y `:121` | `Patron documentado en **feedback_rule_enforcement_gap.md** (memoria 2026-05-14)` · `feedback_rule_enforcement_gap.md — memoria fuente` | puntero a memoria retirada | Verificado: no esta en el indice vivo; esta en `memory/_archive_2026-08-20_consolidacion/`. MEMORY.md declara ese directorio como "Retiradas" | media | rewrite |
| 33 | `amfe-cookbook:97` y `:98` | `Verificar fallas/causas del hermano antes de propagar (regla **feedback_verify_content_not_name**)` · `siempre JSON.stringify(doc) ... Regla **feedback_amfe_data_is_text**` | punteros rotos | Verificado: ninguna de las dos existe, ni en el indice vivo ni en los tres `_archive_*`. La segunda es justamente la que respalda el unico enunciado correcto de la contradiccion #1-#4 — y `amfeIo.mjs:8` la cita con otra ruta rota (`.claude/memory/...`, que tampoco existe) | media | rewrite |
| 34 | `supabase-safety:182` | `agregarlo a _auditAmfeIntegrity.mjs / **_auditFinal*.mjs** y correrlo como paso de CI` | volatile specific roto | Verificado: `_auditAmfeIntegrity.mjs` existe; **no hay ningun `scripts/_auditFinal*.mjs`** | media | rewrite |
| 35 | `apqp-schema:185` | `Detalle: memoria **project-registro-tiempos-inyeccion**` | puntero mal escrito | El archivo es `project_registro_tiempos_inyeccion.md` (guiones bajos, como todas). Con guiones medios no resuelve | baja | rewrite |
| 36 | `amfe-export-oficial:60-62` | `**Quedan 11 documentos en Supabase con approvedBy = 'Gonzalo Cal'**: corregirlos requiere OK de Fak` | volatile specific sin fecha de re-verificacion | Es un conteo sobre datos vivos escrito el 03/08/2026. No se verifico (requiere query de contenido, y el pendiente es de Fak). Se marca para que la proxima entrega lo cuente antes de citarlo | baja | flag |

### 4.7 Frases relativas: "esta seccion decia X y estaba mal" (patron 1d)

Cinco skills llevan la version anterior de su propio texto adentro. El modelo nunca leyo esa
version: la frase relativa solo agrega una alternativa fantasma. En los cinco casos **la cita
de Fak se conserva** (keep list #5) y lo que se saca es el "hasta hoy esto decia".

| # | Ubicacion | Evidencia | Conf. | Accion |
|---|---|---|---|---|
| 37 | `carga-arb:121-122` | `⚠ Esta seccion decia **"Fak carga. Yo no cargo"** y estaba DESACTUALIZADA — corregido el 31/08/2026.` | media | rewrite |
| 38 | `carga-arb:173-175` | `⚠ Esta linea decia **"va suelto en el Escritorio"** y estaba DESACTUALIZADA: desde el incidente del 28/08 ... Lo descubri el 31/08 comiendome el bloqueo.` | media | rewrite |
| 39 | `amfe-export-oficial:55-58` | `> **Corrección 2026-08-03.** **Hasta hoy esta sección decía** approvedBy = "Gonzalo Cal", en contra de control-plan.md ... Consecuencia: la carátula imprimía "CALIDAD / Gonzalo Cal" en 11 documentos.` | media | rewrite |
| 40 | `amfe-domain:110-115` | `> ⚠️ **Numeracion corregida el 23/08/2026...** **Hasta hoy esta seccion decia** que HRC/HRO *"van directo a OP50 INYECCION DE PU"* — **eso es falso desde el 18/08/2026** ... **Este skill se auto-carga al editar AMFEs, asi que estaba inyectando el error corregido**` | media | rewrite |
| 41 | `hojas-de-proceso:98-101` | `**Corregido por Fak el 08/09/2026.** Yo habia redibujado la pantalla ... **Es lo contrario de lo que decia esta seccion hasta ese dia**` | media | rewrite |

### 4.8 Descripciones (Grupo 3)

| # | Ubicacion | Evidencia | Patron | Por que | Conf. | Accion |
|---|---|---|---|---|---|---|
| 42 | `rule-enforcement-gate` frontmatter | `... Tambien activar al detectar "TODO: agregar check" en una rule existente — implementar EN LA SESION ACTUAL o no aceptar la regla. **Patron recurrente Barack 2026-04/05: 3 incidentes con regla + auditor read-only pero nunca gate.**` (528 car.) | Grupo 3: comportamiento y archaeologia dentro del texto de routing | La description es texto de **enrutado** y se inyecta en cada sesion. La ultima frase es historia (esta completa en el cuerpo) y la del medio es una instruccion de conducta. Las dos pagan peaje en cada request sin ayudar a disparar | media | rewrite |
| 43 | `hojas-de-proceso` (631), `flujogramas` (581), `editar-video` (548), `patrones-corte-plotter` (543) | `Usar cuando Fak pida armar, corregir o revisar hojas de proceso de una maquina o de una operacion, cuando haya que elegir o acomodar las fotos de una hoja, o cuando haya que preparar una pantalla de HMI ...` | Grupo 2: trigger-case enumeration | Las cuatro enumeran 3-5 frases casi sinonimas. La guia: las categorias de intencion generalizan mejor que la lista de ejemplos, y la lista solo crece. **Ninguna esta cerca del techo de ~1.000**, asi que esto es afinado, no rescate | media | rewrite (versiones en §5.E) |
| 44 | `injection-process` (449), `amfe-domain` (490), `cad-design` (516) | `Conocimiento del proceso de inyeccion Barack (plastica y PU) — 6M obligatorio, defectos tipicos validados por el gerente, retrabajos tipificados, controles de deteccion diferenciados, maestros Supabase (families 15/16/17), materiales higroscopicos, refrigeracion de tornillo, mantenimiento de molde.` | Grupo 3 | La primera mitad es el **indice** del skill, no lo que decide si se carga. Funciona igual; se señala | baja | flag |

### 4.9 Forma y registro (Grupo 1a/1c) — bajo impacto

| # | Ubicacion | Evidencia | Patron | Conf. | Accion |
|---|---|---|---|---|---|
| 45 | `rule-enforcement-gate:8-12` y `:81-103` | `## Iron Law` · `## Anti-patron clasico` con un guion de 8 pasos (`1. Incidente / 2. Fak frustrado → ... / 7. Incidente similar repite / 8. Fak: "¿no estaba la regla?"`) y su contrafigura de 6 | 1a (titulo en ingles: `core-prohibiciones` §4 pide español AR) + 1c (guion narrado de un juicio que el modelo ya hace) | baja | flag |

### 4.10 Superficie limpia — sin hallazgos

`product-map` (43), `injection-process` (67), `leer-planos` (91), `verificacion-consumos` (88),
`autocad-verificar` (98), `flujogramas` (200). Los 27 archivos y rutas que citan entre los seis
se verificaron uno por uno y **todos existen** (`_leerPlano.py`, `_validarDxf.py`,
`_validarDxfSelftest.py`, `accoreconsole.exe` de AutoCAD 2026, `_validarConsumos.mjs`,
`unidadesArb.mjs`, `consumosCanon.data.json`, `_flujograma.mjs`, `tools/flowchart/*`,
`numeracionPatagonia.data.json`, `GUIA_INYECCION.md`, `C:\Dev\_lsr_patagonia\_scripts\plot_dwg.py`).
`flujogramas` repite en `:12-14` la decision del 18/08 que ya trae `no-pfd-no-ho.md` (siempre
cargada), pero son 3 lineas con la cita textual de Fak: keep list #5 + #8.

También verificado y **correcto** (no se toca): `cad-design:250-261` — el interprete
`.venv-cad` es Py **3.12.13** con gmsh 4.15.2, build123d 0.11.1, cadquery 2.8.0, trimesh 5.0.0,
rtree 1.4.1, scipy 1.18.0, matplotlib 3.11.1, **embreex 4.4.0** y ezdxf 1.4.4; y
`cad-design:272-283` — `build123d-mcp` efectivamente **no** esta en `.mcp.json` (el archivo no
existe en la raiz) ni en `enabledMcpjsonServers` de `.claude/settings.json`.

---

## 5. Diff propuesto

### 5.A Particion de `arb-operar` (1190 → ~455 lineas + 4 reference)

Criterio: en SKILL.md queda **el flujo, los gates y el mapa de la interfaz**; a `reference/` van
**los modos de falla del programa**, **el maestro de insumos** y **la cronica**. Todo se mueve
integro — no se resume una sola linea.

| Secciones (por titulo y rango) | Destino |
|---|---|
| `:1-4` frontmatter · `:6-30` encabezado de estado (reescrito, #9) · `:32-45` Qué es · `:47-62` regla dura → puntero (#12) · `:64-69` Regla de oro · `:71-84` Antes de decir "no se puede" · `:86-134` Pantalla principal + Maestro de Relaciones · `:136-156` Traer la BOM · `:158-192` Mapa de teclas (sin el POR CONFIRMAR, #13) · `:194-218` Segundo plano LEER/ESCRIBIR · `:220-253` Exportar para verificar · `:255-313` Navegación 100% por teclado · `:315-365` RECETA QUE FUNCIONA (corregido, #6) · `:367-428` Qué necesita foco / TAB de a dos / Dos botones &Acepta / Los controles no son tab stops / Errores propios · `:791-802` el orden de arranque (6 pasos, corregido) · `:871-888` El orden que salió bien · `:1163-1190` Seguridad (corregido, #7) + Exports + Relacionado | **SKILL.md** |
| `:465-485` El arb puede tirar HEAP CORRUPTION · `:486-498` Reintentar es seguro · `:504-525` El tope del arb es 99,999999 · `:555-575` EL EXPORT DEJA EL ARCHIVO TOMADO POR EXCEL · `:648-674` EXPORTAR: el combo se RESETEA · `:675-692` UNA CELDA SUCIA ENVENENA · `:693-707` EL SEPARADOR DECIMAL · `:731-745` LA CAUSA RAÍZ DE LA COMA · `:746-767` LA GRILLA NO ARRANCA SIEMPRE EN LA FILA 1 · `:768-783` EL MODAL BLOQUEA TODO · `:809-817` LA GRILLA GUARDA 7 DECIMALES · `:818-828` EL MODAL LO PUEDO CERRAR YO · `:829-845` LA VENTANA LA PUEDO REABRIR YO · `:846-864` MODAL NUEVO: No Ingreso Procesos · `:865-870` Después de exportar, la ventana queda en Listado | **`reference/fallas-modales-y-export.md`** |
| `:576-605` DAR DE ALTA UNA LÍNEA · `:606-620` ALTAS EN LOTE `_arbAltaLote.py` · `:621-634` DOS COSAS QUE FRENABAN EL ARRANQUE · `:635-647` EL SCROLL DE LA GRILLA | **`reference/altas-de-linea.md`** |
| `:890-1161` completo: ABM de Insumos / Cómo se llega / Mapa de campos / La secuencia del alta / Tres cosas que rompen el método / Verificar un alta / MODIFICAR UN CAMPO DEL MAESTRO / MODIFICAR LA Descripción / &Acepta deshabilitado / FIN va al fin del RENGLÓN / La receta que funcionó / Los RichEdit20A SÍ devuelven texto / El gate de handle / WM_CLOSE descarta / Abrir ABM de Insumos / Exportar el maestro | **`reference/maestro-de-insumos.md`** |
| `:430-464` Tanda 06/08 (encabezado + Pararse en Parte Superior + activar() + Dos bugs del parser) · `:499-503` Tanda 07/08 encabezado · `:526-554` MIRAR LA PANTALLA + FOREGROUND NO ES FOCO · `:708-730` LAS TECLAS SINTÉTICAS (era falso) · `:784-790` La lección de método · `:804-808` Tanda 20/08 encabezado | **`reference/bitacora-tandas-2026-08.md`** |

Linea de puntero que queda en SKILL.md, despues de `## Regla de oro`:

```markdown
## Cuándo leer qué

| Si voy a... | Leer antes |
|---|---|
| dar de alta una línea o un lote en una BOM | `reference/altas-de-linea.md` |
| tocar un código del maestro (alta, descripción, un flag) | `reference/maestro-de-insumos.md` |
| una tanda falló, o apareció un cartel que no reconozco | `reference/fallas-modales-y-export.md` |
| entender por qué un gate está donde está | `reference/bitacora-tandas-2026-08.md` |
```

### 5.B Particion de `cad-design` (970 → ~375 lineas + 4 reference)

| Secciones (por titulo y rango) | Destino |
|---|---|
| `:1-165` GATES P/0/1/2/3 (menos `:166-182`) · `:183-219` GATE 5 + GATE E G-E1/2/3a/3b · `:238-247` el motor foto3d + lo que los gates NO cubren · `:248-271` Entorno · `:312-321` Convención de workdir · `:322-365` Flujo punta a punta · `:366-400` Antes de mallar: LEER LA TOPOLOGÍA · `:401-408` Verificar antes de cerrar · `:955-967` LÍMITE CONOCIDO de G-E2 · `:969-970` Mejoras candidatas | **SKILL.md** |
| `:409-646` §5 Lecciones caras 1-26 (integro) · `:709-953` lecciones 27-39 (integro) | **`reference/lecciones-caras.md`** |
| `:648-707` §6 Utillajes de apriete — las decisiones de CONCEPTO | **`reference/utillajes-de-apriete.md`** |
| `:272-311` §1bis Segunda opinión independiente — build123d-mcp | **`reference/build123d-mcp.md`** |
| `:166-182` Los 3 agujeros del enforcement, cerrados el 24/08 · `:220-237` DOS hipótesis que los datos refutaron | **`reference/enforcement-como-se-cerro.md`** |

Punteros que quedan:

```markdown
> Por qué cada gate dice lo que dice — 39 casos con su enforcement al lado:
> `reference/lecciones-caras.md`. Se lee **antes de modelar**, no después de que un gate dé rojo.
> Decisiones de concepto de un utillaje que aprieta (de dónde sale la elasticidad, isostática,
> re-derivar en vez de parchear): `reference/utillajes-de-apriete.md`.
> Cómo se cerraron los agujeros del enforcement y los dos umbrales que se cayeron contra datos:
> `reference/enforcement-como-se-cerro.md`.
> Segunda opinión con `build123d-mcp` (apagado por defecto, se levanta a demanda):
> `reference/build123d-mcp.md`.
```

### 5.C Particion de `editar-video` (736 → ~476 lineas + 2 reference)

| Secciones (por titulo y rango) | Destino |
|---|---|
| `:1-174` gates, scripts, flujo, elegir, mejorar calidad, upscaling · `:223-303` §5 El corte + §6 Sin musica · `:373-403` **Nivel de entrega: -20 LUFS** (vale para las dos ramas) · `:557-624` §6.2 montaje + §6.3 el chequeo que compara dos cosas distintas · `:625-728` §7 Render y entrega + §8 Antes de decir listo + §9 Estado de la maquina | **SKILL.md** |
| `:304-372` §6.1 encabezado + las 4 vueltas + El metodo: el objetivo sale de medir una referencia real · `:404-556` Que hace que suene TRANQUILA / Lo que hace que suene a stock / El tempo sale del CORTE / El momento especial / La percusion de la maquina / Mezcla y entrega | **`reference/musica-sintetizada.md`** |
| `:175-222` §4.1 Video de celular: HDR y vertical | **`reference/celular-hdr-y-vertical.md`** |
| `:729-736` §10 No existe skill publica que sirva para esto | **`reference/por-que-existe-este-skill.md`** |

Puntero que queda en §6.1:

```markdown
### 6.1 Si la musica se sintetiza

El camino vivo es §6.2: montar el tema que elige Fak. `scripts/video/musica.py` es la salida
cuando no se puede depender de la licencia de nadie — la receta entera (el metodo de medir una
referencia real, las 4 vueltas con Fak, timbre, tempo, el momento especial, mezcla) esta en
`reference/musica-sintetizada.md`. **Lo que se aprendio midiendo es el criterio con el que se
juzga cualquier musica, propia o ajena**, y el nivel de entrega de abajo vale para las dos.
```

Y en §4:

```markdown
Si el material es de celular y no de dron (HDR/HLG, vertical, streams fantasma), sondear antes
de gradar: `reference/celular-hdr-y-vertical.md`.
```

### 5.D Hunks de texto (uno por hallazgo)

#### Hunk 1 — `supabase-safety/SKILL.md:37-45` (#1)

```diff
-### 3. NUNCA double-serializar JSONB
-Las columnas `data` son JSONB. Pasar el OBJETO directo:
-```js
-// CORRECTO
-await sb.from('amfe_documents').update({ data: obj }).eq('id', id);
-// INCORRECTO — convierte a string dentro de JSONB
-await sb.from('amfe_documents').update({ data: JSON.stringify(obj) }).eq('id', id);
-```
-Verificar despues: `typeof row.data === 'object'`. Si es `string`, esta roto.
+### 3. La columna `data` de los documentos APQP es TEXT, no JSONB
+En `amfe_documents`, `cp_documents`, `ho_documents` y `pfd_documents` la columna `data` guarda
+el JSON como **texto**: al leer va `JSON.parse`, al escribir `JSON.stringify` (verificado contra
+Supabase live el 11/09/2026: las cuatro devuelven `typeof data === 'string'`).
+```js
+// CORRECTO
+await sb.from('amfe_documents').update({ data: JSON.stringify(obj) }).eq('id', id);
+// INCORRECTO — PostgREST no serializa por vos y el documento queda ilegible
+await sb.from('amfe_documents').update({ data: obj }).eq('id', id);
+```
+Mejor todavia: no escribir a mano. `saveAmfe()/saveCp()/saveHo()` de `_lib/amfeIo.mjs` hacen el
+`stringify`, abortan si les llega un objeto y verifican la escritura releyendo.
+Lo que `parseData()` sigue cuidando es la **double-serialization** (un JSON dentro de otro JSON,
+incidente 2026-04-06): eso es un bug distinto y sigue siendo malo.
```

#### Hunk 2 — `supabase-safety/SKILL.md:150-152` (#2)

```diff
-| 1 | `data` como string (double-serialization) | `typeof row.data === 'object'` debe ser true |
+| 1 | `data` doble-serializado (un JSON adentro de otro) | `JSON.parse(row.data)` tiene que dar un objeto con `operations`/`items`, no otro string |
```

#### Hunk 3 — `apqp-schema/SKILL.md:11` (#3)

```diff
-Todos los documentos APQP guardan sus datos en una columna `data` de tipo JSONB. La estructura es:
+Todos los documentos APQP guardan sus datos en una columna `data` de tipo **TEXT** (JSON
+stringificado, igual que `projects.data`): al leer `JSON.parse`, al escribir `JSON.stringify`.
+Verificado contra Supabase live el 11/09/2026. La estructura es:
```

#### Hunk 4 — `apqp-schema/SKILL.md:220-248` (#4 y #5)

```diff
-// 3. Guardar el documento completo
-await supabase
-  .from('cp_documents')
-  .update({ data: updatedData })
-  .eq('id', docId);
-```
-
-Para documentos grandes (>100KB), usar `updateDocDirect()` del helper si existe.
+// 3. Guardar el documento completo — `data` es TEXT: va stringificado
+await supabase
+  .from('cp_documents')
+  .update({ data: JSON.stringify(updatedData) })
+  .eq('id', docId);
+```
+
+En un script `.mjs` esto no se escribe a mano: `saveCp()` (y `saveAmfe`, `saveHo`, `savePfd`) de
+`scripts/_lib/amfeIo.mjs` hacen el `stringify`, abortan si les llega un objeto, mantienen
+`updated_at` y los contadores derivados, y releen para verificar.
```

#### Hunk 5 — `arb-operar:349-362` (#6)

```diff
-**El scroll SÍ es un problema, y la versión vieja de esta línea estaba mal.** Decía "el scroll
-no es un problema: se grabaron piezas de 6 y 7 insumos sin drama" — y es cierto que una pieza
-puede tener 7, 9 u 11 insumos sin drama, pero eso **no es lo que importa**. Lo que importa es
-en qué fila cae **la línea que hay que escribir**: la grilla muestra **6 filas** y una línea en
-la fila 7 o más abajo **no se alcanza**. El cargador aborta con *"está en la fila N y la grilla
-muestra 6: hay que scrollear para escribirla, y eso no está resuelto"*.
-
-**Gate obligatorio antes de correr una tanda** (2026-08-07: 7 de 36 líneas fallaron por esto,
-todas en piezas de 11 insumos): calcular del export el **índice de fila de cada línea objetivo**
-y partir la tabla en dos — las de índice 0-5 van al robot, las de 6 en adelante van a mano.
-
-```python
-idx = [f[2] for f in boms[pn]].index(codigo_insumo)   # 0-based; >=6 => a mano
-```
-
-El índice depende del **orden del arb**, no del orden de la tabla: los materiales de corte suelen
-quedar arriba (índices 0-1) y los hilos abajo. En el lote del 07/08 dio 23 alcanzables y 13 fuera.
+**El scroll no saca ninguna línea del lote.** La grilla muestra 6 filas pero **scrollea sola al
+tabular** (dato de Fak, 07/08: *"llegás a la última línea de la sexta y le das TAB: automáticamente
+baja a la número 7"*), y `cargar_producto()` lo implementa: si la primera celda a cambiar cae
+fuera de vista, se ancla en la última fila visible y sigue tabulando. Lo único que no se puede
+hacer con una fila fuera de vista es **leer** su valor viejo — el control no existe todavía —, así
+que la verificación por contenido pasa de ser previa a ser *al llegar*.
```

(Y en el orden de arranque, `:796`:)

```diff
-3. ¿alguna linea cae en fila >= 6?    -> sacarla del lote, va a mano
+3. ¿el export que generó la tabla es el PRE-CAMBIO?  -> si se regeneró a mitad de lote, rehacerla
```

#### Hunk 6 — `arb-operar:1165-1171` (#7)

```diff
-   **El único respaldo es el export**: guarda el valor anterior de cada celda, así que un
-   consumo mal cargado se deshace tipeando el viejo. Alcanza para consumos porque son
-   reversibles; **no alcanzaría para altas ni bajas de líneas** — por eso están fuera de
-   alcance (decisión de Fak 05/08). Antes de una tanda: exportar y guardar ese export.
+   **El único respaldo es el export**: guarda el valor anterior de cada celda, así que un
+   consumo mal cargado se deshace tipeando el viejo. **Un alta no se deshace así**, por eso va
+   de a una, con foto antes del ENTER y verificada contra el export (`_arbAlta.py`,
+   `_arbAltaLote.py`). **Borrar una línea sigue fuera de alcance.** Antes de una tanda:
+   exportar y guardar ese export.
```

#### Hunk 7 — `arb-operar:576` y `:594-604` (#8)

```diff
-### 📋 DAR DE ALTA UNA LÍNEA — la secuencia, dictada por Fak `2026-08-07, SIN PROBAR`
+### 📋 DAR DE ALTA UNA LÍNEA — la secuencia `dictada por Fak 2026-08-07 · 31/31 el mismo día`
...
-⚠️ **Esto NO se ejecutó todavía.** Está escrito para no perderlo, pero antes de correrlo sobre
-producción hay que confirmar dos cosas mirando la pantalla (`_arbVer.py foto rel`):
-
-1. si al tabular desde la última fila cargada la grilla **abre sola** el renglón vacío, o si
-   hay que bajar con flecha primero;
-2. cuántas celdas tabulables tiene la fila en blanco — la fórmula `5*N + 2` para llegar al
-   botón asume N filas con datos y cambia al agregar una.
-
-Recordar que **el alta NO es reversible con el export** (a diferencia de un consumo, que se
-deshace tipeando el valor viejo). Por eso se prueba con UNA sola línea y se verifica contra el
-export antes de seguir.
+Lo hace `scripts/_arbAlta.py` (una línea por invocación) con sus gates: verifica cada celda
+contra lo esperado antes de escribir la siguiente, saca una **foto** y lee las 5 celdas del
+renglón nuevo antes del ENTER, y sin `--apply` no aprieta ENTER (el renglón queda escrito en
+pantalla y se descarta con CANCELA).
+
+**El alta NO es reversible con el export** (a diferencia de un consumo, que se deshace tipeando
+el valor viejo). Por eso se prueba con UNA sola línea y se verifica contra el export antes de
+seguir con el resto.
```

#### Hunk 8 — `arb-operar:532` (#11)

```diff
-Helper: `arbver.py` (scratchpad) — `foto rel|prod`, `click X Y`, `estado`. Las coordenadas del
+Helper: `scripts/_arbVer.py` — `foto rel|prod`, `click X Y`, `estado`. Las coordenadas del
```

#### Hunk 9 — `arb-operar:47-62` (#12)

```diff
-## 🔴🔴 EL arb NO SE CIERRA SIN CONSULTARLE A FAK (regla dura, 31/08/2026)
-
-Ni al terminar una tarea, ni "para dejar limpio", ni porque una instrucción de otra sesión
-lo diga. **El estado por defecto es abierto.** Motivo: reabrirlo pide **usuario y
-contraseña**, y la sesión no tipea contraseñas — cerrarlo cuesta un segundo y destrabarlo
-depende de que Fak esté disponible.
-
-El 31/08 lo cerré al terminar de leer el maestro, veinte minutos después había que cargar el
-remache, y la tarea se frenó dos veces esperándolo. Fak: *"fue gravísimo eso"*.
-
-Lo que **sí** sigue permitido, porque es el método documentado: `WM_CLOSE` sobre `Maestro de
-Insumos` / `Maestro de Relaciones` (descarta una edición sin grabar) y `_arbVer.py reset`
-(cierra y **reabre** la de Relaciones).
-
-Enforcement: regla `arb-no-cerrar.md` + hook `arb-cerrar-guard.sh` (exit 2). Escape de Fak,
-un solo uso: `touch ~/.claude/.arb-cerrar-ok`.
+## El arb no se cierra sin consultarle a Fak
+
+Regla dura (31/08/2026). **El estado por defecto es abierto**: cerrarlo lo puedo hacer yo,
+reabrirlo no. Lo que sí está permitido es `WM_CLOSE` sobre `Maestro de Insumos` / `Maestro de
+Relaciones` y `_arbVer.py reset`. El incidente, la tabla de lo prohibido y lo permitido, el
+escape y el hook: regla `arb-no-cerrar.md`, que carga sola al abrir este skill.
```

#### Hunk 10 — `arb-operar:190-192` (#13)

```diff
-**POR CONFIRMAR:** cuántos TAB hasta `Cantidad`, cómo bajar de fila, y cómo se graba
-(¿`ACEPTA`, F-key?). No se prueba dentro de una fila con datos reales sin OK de Fak — un
-tabulador de más y se pisa un renglón.
+Cuántos TAB hasta `Cantidad` y cómo se graba están medidos abajo (`3 + 5*i` y `ENTER` sobre
+`&Acepta`). Lo que no está medido no se prueba dentro de una fila con datos reales sin OK de
+Fak: un tabulador de más y se pisa un renglón.
```

#### Hunk 11 — `arb-operar:23-27` (#9, encabezado)

```diff
->
-> ⚠ El encabezado de esta skill dijo durante medio día "sólo si la línea cae en las 6 filas
-> visibles" y "dar de alta está fuera de alcance". **Las dos eran falsas**: la grilla scrollea
-> sola al tabular, y las altas se resolvieron el mismo día. Quedó escrito acá porque el error
-> costó 13 líneas sin cargar y un "terminado" que no lo era — **una limitación escrita por uno
-> mismo no es un hecho verificado**.
->
+>
+> **Una limitación escrita por mí no es un hecho verificado.** Antes de anotar que algo "no se
+> puede", probarlo y fecharlo; los cuatro casos en que esa frase costó trabajo están en
+> `reference/bitacora-tandas-2026-08.md`.
+>
```

#### Hunk 12 — `cad-design:16` y `:239` (#15)

```diff
-la librería vive en `scripts/cadlib/`. La librería vive en `scripts/cadlib/` + CLIs genéricos con `--help`.
+La librería y los CLIs viven en `.claude/skills/cad-design/scripts/` (`cadlib/` + un CLI por
+gate, todos con `--help`). En este archivo se los nombra pelados (`gate_zona.py`); la ruta
+completa es esa, **no** el `scripts/` de la raíz del repo, que es otro.
...
-El motor bueno vive ahora **acá**: `scripts/foto3d.py` (trazado de rayos ortográfico, ...
+El motor bueno vive ahora **acá**: `.claude/skills/cad-design/scripts/foto3d.py` (trazado de
+rayos ortográfico, ...
```

#### Hunk 13 — `editar-video:569-570`, `:614` y `:623` (#21)

```diff
-```bash
-# el flujo que se uso, en scratchpad/: ver_cancion.py (mapa por segundo) -> grilla.py
-# (periodo, fase, golpes grandes) -> zonas.py (lupa de 25 ms sobre las zonas elegidas)
-```
+El flujo son tres pasadas y las hace `scripts/video/cancion.py`: mapa por segundo (dB +
+centroide) → grilla (período, fase, golpes grandes) → lupa de 25 ms sobre las zonas elegidas.
...
-`scratchpad/mono.py` decia "compatible en mono, la peor banda pierde 0,36 dB" y con eso se
-certifico una entrega. Estaba comparando el espectro de la **envolvente** ...
+Un chequeo de compatibilidad en mono dijo "la peor banda pierde 0,36 dB" y con eso se certificó
+una entrega. Estaba comparando el espectro de la **envolvente** ...
...
-mayoria de la musica comercial; va en **-6,0**. Corregido en `scratchpad/mono2.py`.
+mayoria de la musica comercial; va en **-6,0**. El chequeo se rehace cada vez: vive en el
+scratchpad de la sesión, que no sobrevive — lo que sobrevive es el criterio de esta sección.
```

#### Hunk 14 — `editar-video:717-718` y `:724` (#23, #24)

```diff
-- **ffmpeg 8.1-full_build** (Gyan, via winget) en `%LOCALAPPDATA%\Microsoft\WinGet\Packages\...\bin`.
-  **No esta en el PATH** — `_video.py` lo resuelve solo. Trae `libvidstab`, ...
+- **ffmpeg 8.1-full_build** (Gyan, via winget) en `%LOCALAPPDATA%\Microsoft\WinGet\Packages\...\bin`,
+  resoluble por PATH desde Git Bash (verificado 11/09/2026); `_video.py` lo resuelve igual por su
+  cuenta, así que no depende del shell. Trae `libvidstab`, ...
...
-- **Disco C: al 98%** (~7 GB libres). Un render de 1080p come rapido: borrar intermedios no,
-  pero trabajar solo sobre los recortes elegidos si.
+- **Disco C ajustado** (11/09/2026: 33 GB libres de 238, 87 % usado; llegó a estar al 98 %).
+  Un render de 1080p come rápido: medir antes de arrancar una tanda larga, y trabajar solo sobre
+  los recortes elegidos.
```

#### Hunk 15 — `patrones-corte-plotter:69` (#27)

```diff
-| Libreria propia | `scripts/patronlib.py` — importar desde ahi, no reescribir |
+| Libreria propia | `.claude/skills/patrones-corte-plotter/scripts/patronlib.py` (+ `costuralib.py`, `patronlib_selftest.py`) — importar desde ahi, no reescribir. **Ojo:** `scripts/_mixPlotter.py` sí cuelga de la raíz del repo; son dos carpetas distintas |
```

#### Hunk 16 — `hojas-de-proceso:185-186` y `:107` (#28, #29)

```diff
-| **Dura** | `hoja_proceso_check.py` sale con codigo 1 y la hoja no se entrega | `scripts/hoja_proceso_check.py` |
-| **Dura** | los umbrales viven **solo** en `hojalib.py` ... | `scripts/hojalib.py` |
-| **Regresion** | 25 casos, cada criterio en ROJO y en VERDE | `scripts/hojalib_selftest.py` |
+| **Dura** | `hoja_proceso_check.py` sale con codigo 1 y la hoja no se entrega | `.claude/skills/hojas-de-proceso/scripts/hoja_proceso_check.py` |
+| **Dura** | los umbrales viven **solo** en `hojalib.py` ... | `.claude/skills/hojas-de-proceso/scripts/hojalib.py` |
+| **Regresion** | 25 casos, cada criterio en ROJO y en VERDE | `.claude/skills/hojas-de-proceso/scripts/hojalib_selftest.py` |
...
-1. **Elegir el fotograma** donde la pantalla se lee (`elegir_frame.py` ordena candidatos del
+1. **Elegir el fotograma** donde la pantalla se lee (`scripts/hotmelt/elegir_frame.py` ordena candidatos del
```

#### Hunk 17 — `docs-empresa:45` y `:47` (#30, #31)

```diff
-| Manuales oficiales (AIAG-VDA FMEA 2019, SETEC p129 CC/SC, VDA, MSA, IMDS, Formel Q, IATF) | OneDrive `4- MANUALES\` — esta PC (`facun`): `C:\Users\facun\BARACK ARGENTINA SRL\Ingeniería y Proyecto - INGENIERIA BARACK (NUNCA BORRAR)\4- MANUALES\`; PC `FacundoS-PC`: `...\Ingeniería y Proyecto - General\INGENIERIA BARACK (NUNCA BORRAR)\4- MANUALES\` | leer directo (PDF; escaneados → memoria `reference_leer_pdfs_escaneados`) |
+| Manuales oficiales (AIAG-VDA FMEA 2019, SETEC p129 CC/SC, VDA, MSA, IMDS, Formel Q, IATF) | OneDrive: `C:\Users\FacundoS-PC\BARACK ARGENTINA SRL\Ingeniería y Proyecto - General\INGENIERIA BARACK (NUNCA BORRAR)\4- MANUALES\` — ojo que hay **dos** carpetas de Barack sincronizadas y la buena es `- General` (memoria `reference_onedrive_dos_carpetas_barack`) | leer directo (PDF; escaneados → memoria `reference_leer_pdfs_escaneados`) |
-| Docs Patagonia curados (36) | `docs-local/` (junction OneDrive; en ESTA PC el junction NO esta creado — setup one-time en memoria `reference_docs_local_onedrive_junction`) | leer directo |
+| Docs Patagonia curados (36) | `docs-local/` (junction a OneDrive, ya creado y verificado 11/09/2026: `INDEX.md`, `normas-vw/`, `projects/`, `shared/`; cómo se rehace si se rompe: memoria `reference_docs_local_onedrive_junction`) | leer directo |
```

#### Hunk 18 — `rule-enforcement-gate:16` y `:121` (#32)

```diff
-Patron documentado en `feedback_rule_enforcement_gap.md` (memoria 2026-05-14):
+Patron documentado el 2026-05-14 (memoria retirada en la consolidacion del 20/08; el texto
+completo queda en `memory/_archive_2026-08-20_consolidacion/feedback_rule_enforcement_gap.md`):
...
-- `feedback_rule_enforcement_gap.md` — memoria fuente
+- `memory/_archive_2026-08-20_consolidacion/feedback_rule_enforcement_gap.md` — memoria fuente (retirada)
```

#### Hunk 19 — `amfe-cookbook:97-98` (#33)

```diff
-5. **NO propagar entre familias con proceso distinto**: inyeccion plastica != inyeccion PU. Verificar fallas/causas del hermano antes de propagar (regla `feedback_verify_content_not_name`).
-6. **data es TEXT** — siempre `JSON.stringify(doc)` al escribir (helper `saveAmfe` lo hace automatico). Regla `feedback_amfe_data_is_text`.
+5. **NO propagar entre familias con proceso distinto**: inyeccion plastica != inyeccion PU. Verificar fallas/causas del hermano antes de propagar — el nombre no es el contenido (memoria `feedback_el_nombre_no_es_el_contenido`, skill `injection-process`).
+6. **data es TEXT** — siempre `JSON.stringify(doc)` al escribir; el helper `saveAmfe` lo hace solo y **aborta** si le llega un objeto (`scripts/_lib/amfeIo.mjs`, cabecera y WRITE GUARD).
```

#### Hunk 20 — `supabase-safety:182` (#34)

```diff
-2. Si el patron es automatizable, agregarlo a `_auditAmfeIntegrity.mjs` / `_auditFinal*.mjs` y correrlo como paso de CI.
+2. Si el patron es automatizable, agregarlo a `scripts/_lib/amfeValidator.mjs` (lo consume `_auditAll.mjs`) o a `scripts/_auditAmfeIntegrity.mjs`, y correrlo como paso de CI.
```

#### Hunk 21 — `apqp-schema:185` (#35)

```diff
-Detalle: memoria `project-registro-tiempos-inyeccion`.
+Detalle: memoria `project_registro_tiempos_inyeccion`.
```

#### Hunk 22 — `carga-arb:121-127` (#37)

```diff
-⚠ Esta seccion decia **"Fak carga. Yo no cargo"** y estaba DESACTUALIZADA — corregido el
-31/08/2026. Las cargas las hace la sesion desde el 05/08 (skill `arb-operar`, memoria
-`feedback_arb_lo_opero_yo_y_lo_mejoro`): consumos con `_arbCargar.py`, altas con
+Las cargas las hace la sesion desde el 05/08/2026 (skill `arb-operar`, memoria
+`feedback_arb_lo_opero_yo_y_lo_mejoro`): consumos con `_arbCargar.py`, altas con
```

#### Hunk 23 — `carga-arb:173-175` (#38)

```diff
-  ⚠ Esta linea decia **"va suelto en el Escritorio"** y estaba DESACTUALIZADA: desde el
-  incidente del 28/08 (*"no me dejes cosas en el escritorio"*) el `escritorio-guard.sh`
-  **bloquea** generar un entregable ahi. Lo descubri el 31/08 comiendome el bloqueo.
+  ⚠ En el Escritorio no queda nada: `escritorio-guard.sh` **bloquea** generar un entregable ahi
+  (Fak, 28/08: *"no me dejes cosas en el escritorio"*).
```

#### Hunk 24 — `amfe-export-oficial:55-62` (#39)

```diff
-> **Corrección 2026-08-03.** Hasta hoy esta sección decía `approvedBy = "Gonzalo Cal"`, en
-> contra de `control-plan.md` (approvedBy = Ingeniería) y de `product-map` (Gonzalo Cal firma
-> **HO**, no AMFE). Consecuencia: la carátula imprimía "CALIDAD / Gonzalo Cal" en 11 documentos.
-> Fak lo reportó. La evidencia son los AMFE reales hechos a mano más recientes (105 y 107,
-> oct/nov 2025), cuyo equipo dice `Paulo Centurión - INGENIERIA | Manuel Meszaros - CALIDAD |
+> **Gonzalo Cal firma HO, no AMFE** (`product-map`; `approvedBy` = Ingeniería por
+> `control-plan.md`). La evidencia son los AMFE reales hechos a mano más recientes (105 y 107,
+> oct/nov 2025), cuyo equipo dice `Paulo Centurión - INGENIERIA | Manuel Meszaros - CALIDAD |
 > Cristina Rabago - SEGURIDAD E HIGIENE`. **Quedan 11 documentos en Supabase con
-> `approvedBy = 'Gonzalo Cal'`**: corregirlos requiere OK de Fak (ver
+> `approvedBy = 'Gonzalo Cal'` al 03/08/2026 — contarlos de nuevo antes de citar el número**:
+> corregirlos requiere OK de Fak (ver
 > `scripts/_pendiente_amfe150_supabase.sql`).
```

#### Hunk 25 — `amfe-domain:110-115` (#40)

```diff
-> ⚠️ **Numeracion corregida el 23/08/2026 contra Supabase live.** Hasta hoy esta seccion decia
-> que HRC/HRO *"van directo a OP50 INYECCION DE PU"* — **eso es falso desde el 18/08/2026**
-> (Fak, sobre el puesto: *"es imposible que se inyecte sin la funda, se saldria todo el
-> material"*), y la numeracion citada era la previa a la renumeracion del 18-20/08. Este skill
-> se auto-carga al editar AMFEs, asi que estaba inyectando el error corregido en las sesiones
-> que renumeran. **La numeracion se lee de Supabase o de `_verificarNumeracion.mjs`, nunca de aca.**
+> ⚠️ **La numeracion se lee de Supabase live o de `_verificarNumeracion.mjs`, nunca de aca.**
+> Los numeros de abajo son de la renumeracion del 18-20/08/2026 y sirven para entender la
+> diferencia entre delantero y traseros, no para renumerar. Los tres **enfundan antes de
+> espumar** — Fak, sobre el puesto: *"es imposible que se inyecte sin la funda, se saldria todo
+> el material"*.
```

#### Hunk 26 — `hojas-de-proceso:98-103` (#41)

```diff
-**Corregido por Fak el 08/09/2026.** Yo habia redibujado la pantalla de seguridad entera, en
-castellano, prolija. Su respuesta: *"intenta poner la foto de la pantalla real y metele un
-edit y ponele encima el dato que vos queres"*. Es lo contrario de lo que decia esta seccion
-hasta ese dia, y tiene razon: **el operario tiene adelante la pantalla en chino**. Un dibujo
+**Fak, 08/09/2026:** *"intenta poner la foto de la pantalla real y metele un edit y ponele
+encima el dato que vos queres"* — después de que yo entregara la pantalla de seguridad
+redibujada entera, en castellano y prolija. El motivo: **el operario tiene adelante la pantalla
+en chino**. Un dibujo
 en castellano que no se le parece no le sirve para encontrarla entre menus; la foto de la
 pantalla que el ve, con el rotulo puesto encima, si.
```

### 5.E Descripciones reescritas por categorias de intencion (#42, #43)

Las cuatro mas largas + `rule-enforcement-gate`. Criterio: **una frase de qué hace + una de
cuándo, por categoría de intención, no por ejemplo de frase**; lo que enseña queda en el cuerpo.

```yaml
# hojas-de-proceso  (631 -> 268)
description: Hojas de proceso / hojas de operaciones de Barack (formulario I-IN-002.4-R01) en
  PPTX o Excel — qué imagen manda, cómo se acomodan y cómo se prepara una pantalla de HMI para
  que se lea impresa. Trae la librería `hojalib`, el gate que rechaza la hoja y su selftest.

# flujogramas  (581 -> 249)
description: Flujogramas de proceso de Barack (formulario I-IN-002/III) con el generador de
  `tools/flowchart/` — criterio de numeración, convenciones de dibujo validadas por Fak,
  trampas del motor y cómo se entrega. También cuando el AMFE y el Plan de Control no cierran
  con el flujograma.

# editar-video  (548 -> 262)
description: Editar video en Barack — armar un institucional o una recorrida de planta desde
  tomas crudas, elegir qué sirve con criterio medido, mejorar color y nitidez, y entregar un
  master que abra en cualquier lado. Incluye lo que NO sirve (upscaling con IA, estabilizar
  material de gimbal), medido en esta máquina.

# patrones-corte-plotter  (543 -> 264)
description: Patrones de corte 2D en DXF y PLT/HPGL para mesa de corte y plotter — leer el DXF,
  mover puntos de anclaje y piquetes, generar el PLT y demostrar con números que el cambio salió
  exacto. Cubre también tizadas, mix de plotter y comparar las dos manos. Trae los 3 gates que
  evitan los errores caros.

# rule-enforcement-gate  (528 -> 236)
description: Toda regla nueva con una heurística, validación o check nace con enforcement
  ejecutable en la misma sesión. Usar al crear o modificar una regla de `.claude/rules/`, al
  encontrar un "TODO: agregar check" en una existente, y al cerrar una tarea que tocó una regla.
```

---

## 6. Lo que NO se toco, y por que

- **Los seis skills de superficie limpia** (`product-map`, `injection-process`, `leer-planos`,
  `verificacion-consumos`, `autocad-verificar`, `flujogramas`): sus 27 rutas y scripts se
  verificaron uno por uno y todos existen. *"An audit that finds nothing should change nothing."*
- **Toda cita textual de Fak** (conté 41 en los 19 skills). Son la procedencia de las reglas
  (keep list #5) y varias son correcciones repetidas. En los hunks 22-26 se conserva la cita y
  se saca el andamiaje de "esto antes decía otra cosa".
- **Los scripts exactos de operaciones frágiles** (keep list #3): las secuencias de teclas del
  arb, los gates de `patronlib.entregar()` / `export_deliverables.py` / `hoja_proceso_check.py`,
  el protocolo dry-run → backup → apply, la secuencia de `accoreconsole`. Ahí la prescripción
  paso a paso es la forma correcta, no sobre-especificación.
- **Los números con su porqué medido** (umbral 45 %/1,6×, 7 pt, −20 LUFS, tolerancia 0,1 %,
  99,999999, 259 caracteres, 15,0 mm): son contexto que solo el autor sabe, cada uno con la
  población contra la que se calibró al lado.
- **La redundancia entre skill y regla** (`cad-design`↔`cad-3d.md`, `patrones-corte-plotter`↔
  `patrones-corte.md`, `autocad-verificar`↔`dxf-entregable.md`): keep list #8 — está funcionando
  y **no disiente**. Se señala en #20 y solo se propone reducir `arb-operar`↔`arb-no-cerrar.md`
  (#12), donde son 15 líneas idénticas dentro del mismo contexto.
- **`.claude/rules/database.md:25`** y **`.claude/agents/amfe-healer.md`**: caen en otra parte
  de la auditoría. Se dejan nombrados porque el hunk 1-4 no cierra sin el primero.
- **El bajo uso** de 8 skills con `Skill()` en 0 (`amfe-cookbook`, `amfe-domain`,
  `autocad-verificar`, `docs-empresa`, `flujogramas`, `hojas-de-proceso`, `injection-process`,
  `leer-planos`, `product-map`): todos se **leyeron** por Read en 2 a 9 sesiones, o sea que
  funcionan como referencia aunque no se invoquen. No se propone quitar ninguno.

## 7. Verificacion (paso 7 de la guia)

- **63 verificaciones contra el disco y la base**, ninguna contra la documentación de la
  herramienta: 51 archivos/scripts citados, 23 memorias, 4 tablas de Supabase live, versiones
  reales del intérprete y sus 9 librerías, espacio en disco, PATH de ffmpeg, usuario de Windows,
  `paths:` de las 20 reglas.
- **9 volatile specifics rotos** confirmados: `arbver.py`, `scripts/patronlib.py`,
  `scripts/foto3d.py` + `scripts/cadlib/`, `scratchpad/mono.py` + `mono2.py` +
  `ver_cancion.py`/`grilla.py`/`zonas.py`, `C:\Users\facun\...`, `_auditFinal*.mjs`,
  `updateDocDirect()`, `feedback_verify_content_not_name`, `feedback_amfe_data_is_text`.
  **2 vencidos**: disco al 98 %, ffmpeg fuera del PATH. **1 retirado**:
  `feedback_rule_enforcement_gap` (archivado, no borrado).
- Antes de aplicar los hunks 1-4 conviene correr una escritura de prueba con `saveAmfe()` en
  dry-run sobre un AMFE real (`scripts/_demoValidator.mjs`, read-only) para dejar la evidencia
  de que el guard es el que manda.
- La partición de §5.A-C es la única propuesta que cambia el comportamiento de carga: se aplica
  de a un skill, y el control es que el SKILL.md resultante siga contestando solo las preguntas
  del día a día — si una tarea corriente necesita abrir un `reference/`, la partición quedó mal
  cortada y se mueve esa sección de vuelta.
