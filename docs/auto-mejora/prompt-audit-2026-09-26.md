# Prompt-audit 26/09/2026 — resumen y nucleo siempre cargado

Guia: `claude-api/shared/prompt-audit.md` (Claude Code 2.1.281), pasos 0-7, mas las secciones
"Behavioral shifts" de Claude Opus 5, Claude Opus 5.5 y Claude Fable 5.1 de `model-migration.md`.
Formato calcado del audit del 10-11/09 (`prompt-audit-2026-09-10.parte*.md`). **No se edito nada**:
informe + diff propuesto, hunk por hallazgo.

## 1. Supuestos

- **Por que se repite a los 16 dias.** El audit del 10/09 apuntaba a Fable 5.1 / Opus 5 y sus partes
  1-3 se aplicaron (`b579b465`, `31c205c8`, `1695d553`; la parte 4 global tambien, archivos del 11/09).
  Desde entonces: (1) las sesiones de "el resto" corren en **Claude Opus 5.5** (CLAUDE.md, decision de
  Fak del 04/09), y la guia pide re-auditar en cada lanzamiento; (2) entraron ~6.600 lineas de prompt
  (64 archivos: 5 skills nuevos, `hojas-de-proceso` +440, `mail-envio` +180, una regla siempre cargada
  nueva). **Modelo destino: Opus 5.5 y Fable 5.1**, los dos.
- **Alcance.** Toda la superficie de prompt del repo mas lo global que carga en estas sesiones:
  nucleo siempre cargado y globales (esta parte, sesion principal); reglas con `paths:`, agentes y
  texto de hooks (parte A); skills de documentos APQP y las 29 `description` (parte B); resto de los
  skills y los 4 comandos (parte C). Las partes A-C solo auditan lo que cambio desde el 11/09, salvo
  datos volatiles y los patrones nuevos de Opus 5.5, que se buscaron en todo.
- **Grupo 4 no aplica:** el repo no llama a la API de Claude en ningun lado (sin SDK, sin `claude -p`,
  sin `budget_tokens` ni pins de modelo en codigo). Modelo y esfuerzo los fija Claude Desktop.
- **Tension de la guia entre modelos.** Para Opus 5 dice borrar las instrucciones de auto-verificacion
  ("delete your verification scaffolding"); para Fable 5.1, mantenerlas (tentativo). Como el repo usa
  los dos, y cada verificacion de la casa tiene una caza real con los modelos actuales (15/09, 21/09,
  22/09), **todas quedaron como `flag`**, ninguna como `remove`.
- **Keep list aplicada:** decisiones fechadas de Fak con su cita, fallas demostradas desde el 13/09 (ya
  con los modelos actuales), scripts exactos de operaciones fragiles (arb, mail, IMDS), datos de la
  empresa en el repo publico (decision de Fak del 18/08).
- **Subagentes:** 3 (A, B, C), con la guia entera como vara. Sus hallazgos de confianza alta se
  re-verificaron contra el archivo antes de escribir este resumen (16 de 16 confirmados; lista al final).

## 2. Resumen

| Parte | Alta | Media | Baja / flag | Archivo |
|---|---|---|---|---|
| N — nucleo siempre cargado + globales | 3 | 5 | 2 | este |
| A — reglas con `paths:`, agentes, hooks | 11 | 21 | 15 | `prompt-audit-2026-09-26.parteA-reglas-agentes-hooks.md` |
| B — skills APQP + las 29 `description` | 9 | 23 | 10 | `prompt-audit-2026-09-26.parteB-skills-apqp-y-descripciones.md` |
| C — resto de los skills + comandos | 16 | 13 | 16 | `prompt-audit-2026-09-26.parteC-skills-resto-y-comandos.md` |

Tres hallazgos aparecen en dos partes y se cuentan una vez (N1 = B-M14, N2 = B-L7, N7 = A "HO-GUARD").

**Lo que dejo el cambio a Opus 5.5: casi nada propio del modelo.** No hay "think step by step", ni
prefill, ni supresores de narracion, ni reglas anti-formato, ni pedidos de reproducir el razonamiento
(riesgo `reasoning_extraction`). El andamiaje visual que la guia pide re-testear (leer planos, mirar
renders) resulto ser herramientas de recorte y medicion, que la guia dice que se quedan. **Lo que
sobra es de la casa, no del modelo**: casi 4 de cada 10 hallazgos son **duplicados que discrepan**,
y el patron se repite — una regla se corrigio entre el 21 y el 25/09 y el texto que la repite en un
hook, un skill o un `reference/` no. Es la leccion del 22/09 (*"un cambio de criterio se barre por su
FRASE en todo el repo"*) sin su barrido.

### Los de mas impacto

1. **Lo que Fak corrigio entre el 21 y el 25/09 sigue dicho al reves en otro lado.**
   - arb: el SKILL `arb-operar`, su `reference/` y **el mensaje del bloqueo del hook** sugieren cerrar
     `Maestro de Relaciones` y `_arbVer.py reset`, lo que desde el 25/09 crashea el arb (A, C-H1..H4).
   - Hojas de proceso: `no-pfd-no-ho.md:37` (siempre cargada), el canon §4.4 y el recordatorio
     `HO-GUARD` mandan poner TBD en los pasos; Fak 24/09: *"no puede haber ni 1 TBD"* (B-H4, A).
   - `flujogramas:272-273` manda transcribir las siglas CC/SC de la revision anterior, que es
     exactamente lo que `caracteristicas-especiales.md` §1 prohibe (B-H2).
   - `/auditoria-cliente` y `/audit-amfe` presentan la tabla AP como "decision pendiente" / "en
     revision": se aplico la oficial el 23/09 (C-H12, H13).
   - El agente `auditor` dice "CC/SC — NO auditar" (`auditor.md:159`) y `caracteristicas-especiales.md:71`
     cuenta con ese agente para cazar una S inflada (A).
2. **"No preguntes" contra "pregunta primero".** `CLAUDE.md:42` ("La respuesta es siempre si"),
   `pregunta-guard.sh` y el chequeo 1 de `cierreGuard.mjs:721` ("la respuesta es SI. Hacelo ahora")
   no conocen las filas de confirmar del contrato de autonomia (Supabase, listado maestro, primera
   vez). Y en la direccion contraria, la `description` global de `propose-before-do` —que viaja en
   cada sesion de cada proyecto— todavia manda pedir OK para "mas de 1 archivo o mas de 5 minutos",
   cuando su cuerpo se corrigio el 11/09 (N3, N4, A).
3. **Datos rotos que llevan a hacer algo mal:** el maestro PU es la familia **19**, no la 17
   (`injection-process`, 3 lugares; C-H10, H11); `amfe-export-oficial` nombra dos scripts sin el
   freno de `.audit-cliente/` y no nombra el que lo tiene (C-H14); `supabase-safety:128` usa de
   ejemplo el placeholder prohibido el 21/09 (C-H15); dos comandos que no corren como estan escritos
   (`carga-arb:76` sin `--piezas`, `hojalib.py` sin `main`; B-H1, H6) y un script citado que no
   existe (`tel_indice.ps1`, `video-maquina.md:66`; A).
4. **La HO tiene dos domicilios en el nucleo** (`autonomy-contract.md:73` vs `no-pfd-no-ho.md:31`) y
   `CLAUDE.md:8` dice que "no se hacen aca" (N1, N2).

### Lo que decide Fak (no lo contesta ningun documento)

- **Quien es dueño del IMDS.** `apqp-legajo` fila 23 e `imds:20` dicen Ingenieria (*"paso a
  Ingenieria"* tras la renuncia de Marcelo Nieve); `autonomy-contract.md:93`, `ppap-motherson` y la
  cita de Fak del 08/09 (*"el imds es de calidad"*) dicen Calidad. Los hunks propuestos siguen la cita.
- **El listado maestro de HO: ¿se escribe en la misma tanda o se pregunta?** `no-pfd-no-ho.md:38-40`
  (18/08) y `HO-GUARD` punto 6 dicen "se actualiza en la misma tanda"; `autonomy-contract.md:75`
  (21/09, mas nuevo) dice "Preguntar — es registro compartido". Los hunks siguen el contrato.
- **Una celda que el arb rechazo, con Relaciones prohibida de cerrar.** El `reference/` de
  `arb-operar` dice que solo se limpia cerrando Relaciones; la regla del 25/09 lo prohibe. No hay
  texto que proponer: sale de una prueba o de Fak (C-L16).

## 3. Como se verifica lo que se aplique (paso 7)

Sacar texto es una hipotesis. Para los que cambian conducta: N4/N3 (preguntar o no) se miden con el
mismo relevamiento del 22/09 (`cierreCanon.data.json`, `_medicion_22_09`): cuantos fines de turno
piden permiso por trabajo propio y cuantas escrituras a Supabase o al servidor salen sin OK, antes y
despues. N5 (cierre), con la misma tasa de objecion de Fak por turno. Los duplicados que discrepan no
necesitan prueba de conducta: se verifican con un `grep` de la frase vieja que de 0. Los hunks que
tocan codigo de hooks (N5, N7b, y los de A) llevan su caso en el test del hook.

---

## 4. Parte N — nucleo siempre cargado y globales

### Inventario (siempre cargado en cada sesion de este repo)

| Archivo | Bytes | Cuando |
|---|---|---|
| `CLAUDE.md` | 9.903 | siempre |
| `docs/LECCIONES_APRENDIDAS.md` | 26.999 | siempre (`@import`) |
| `autonomy-contract.md` | 7.377 | siempre |
| `caracteristicas-especiales.md` | 5.584 | siempre (nueva desde el 11/09, a pedido de Fak) |
| `no-pfd-no-ho.md` | 4.175 | siempre |
| `git-deploy.md` | 3.624 | siempre |
| `core-prohibiciones.md` | 2.903 | siempre |
| `techo-agentes.md` | 2.009 | siempre |
| `consumos-entregables.md` | 1.992 | siempre |
| `MEMORY.md` (indice de memorias) | 16.500 | siempre |
| `description` de 24 skills del repo + 5 globales invocables | 9.945 | siempre (lista de skills) |

Total medido: 91.366 B antes de la primera palabra de trabajo. El largo por si solo no es hallazgo (keep #2).

Grupo 4 (llamadas a la API): **no hay ningun sitio de llamada** en el repo (sin SDK, sin `claude -p`, sin
`budget_tokens`, sin pins de modelo en codigo). El modelo y el esfuerzo los fija Claude Desktop, no el repo.
Hay contabilidad de tokens (`scripts/_tokens.mjs`) y log de carga de instrucciones (`instrucciones-log.sh`).
Nada que auditar ahi.

Verificado contra disco: las referencias a archivos, scripts, hooks, reglas y memorias de CLAUDE.md,
LECCIONES y las 7 reglas siempre cargadas (unas 250 menciones entre backticks) existen todas; lo que el
chequeo marco eran globs (`scripts/_arb*.py`) y nombres de tabla, y 4 memorias citadas por el nombre
abreviado que se resuelven por prefijo. `_cerebroLint.mjs` LIMPIO; las 18 reglas con `paths:` de la
tabla de CLAUDE.md = las 18 del disco; los 10 guardianes que nombran las reglas estan cableados en
`scripts/_lib/guardianes.mjs`; `CLAUDE_CODE_AUTO_COMPACT_WINDOW=1000000` y `defaultMode: plan` existen
como dice CLAUDE.md.

### Hallazgos

| # | Ubicacion | Evidencia | Patron | Por que | Conf. | Accion |
|---|---|---|---|---|---|---|
| N1 | `autonomy-contract.md:73` y `:79` vs `no-pfd-no-ho.md:31-34` (y skill `hojas-de-proceso` §3 bis) | contrato: `Emitir un documento controlado (flujograma, AMFE, HO) en Gestion Ingenieria` · `El maestro vive en Gestion Ingenieria` — regla HO: `Se guardan en Y:\BARACK\CALIDAD\DOCUMENTACION SGC\HOJAS DE OPERACIONES\ ... nunca en la biblioteca de Ingenieria` | Duplicados que discrepan (keep #8, excepcion) | Dos reglas siempre cargadas mandan la HO a dos lugares distintos. La del contrato es del 21/09 (blame `7a403550`); la de HO, del 24-25/09 (`a69be358`, `1d94bc9f`), con cita de Fak. Un modelo que sigue instrucciones al pie de la letra elige una sin avisar | alta | rewrite (hunk N1) |
| N2 | `CLAUDE.md:8-9` y `core-prohibiciones.md:10` vs `no-pfd-no-ho.md` | `PFDs y Hojas de Operaciones no se hacen aca` · `Barack ya NO hace PFDs ni HOs en este software` — la regla: `los flujogramas los hago yo` · `Cuando Fak lo pide, las HO se arman aca` | Duplicados que discrepan + 1d frase relativa ("ya NO") | "aca" dice lo contrario en dos archivos del mismo prompt. Lo que es cierto es que **la app** no tiene modulo PFD/HO; el item de prohibiciones no dice la prohibicion real (no resucitar el modulo, no ofrecer HO) | alta | rewrite (hunk N2) |
| N3 | `propose-before-do` global: `description` (`~/.claude/skills/propose-before-do/SKILL.md:3`) vs su cuerpo (`:29-42`) | description: `Activar antes de ... (mas de 1 archivo a editar, mas de 5 minutos de trabajo ...). Forzar a Claude a proponer un plan corto y esperar luz verde de Fak ANTES de tocar nada` — cuerpo: `Lo que no dispara esta skill: trabajo propio del repo con el plan ya aprobado` y el SI activar ya no tiene ">1 archivo / >5 min" | Grupo 3 trigger text desactualizado respecto del cuerpo + duplicado que discrepa con `CLAUDE.md:42` | El 11/09 se corrigio el cuerpo y no la `description`, que es lo que viaja en **cada** sesion de **cada** proyecto y decide cuando se activa. Con Fable 5.1 (que ya tiende a pedir permiso por pasos cubiertos, guia §Maximizing long-horizon execution) el trigger empuja justo lo que `cierre-guard.sh` corta | alta | rewrite (hunk N3). Es setup global: se aplica con OK de Fak |
| N4 | `CLAUDE.md:42-44` vs `autonomy-contract.md` A, B, C y §F | `No preguntar "¿queres que haga X?": se hace y se reporta. La respuesta es siempre si` — el contrato: `Escribir 1 documento: Confirmar antes`, `Siempre preguntar`, `La PRIMERA VEZ se pregunta` | Duplicados que discrepan (absoluto vs tabla) | Leido literal, "siempre si" pisa las filas de confirmar/preguntar; el limite que Fak fijo (reversible y propio = se hace; datos, servidor, primera vez = se pregunta con la ruta) esta en otro archivo. Una frase lo une | media | rewrite (hunk N4) |
| N5 | `LECCIONES:98`, memoria `feedback_no_hacer_informes` (corolario 08/09) y titulo del hook `scripts/_lib/cierreGuard.mjs:788` | `El cierre de una tarea se escribe en cinco lineas` · `una tarea se cierra en cinco lineas` | 1f tope numerico de salida + duplicado que discrepa (el gate real corta en 3.000 c / 35 lineas / 2 tablas, `cierreCanon.data.json` `cierre_largo`) | El 5 no es de Fak (su frase: *"podes sintetizar que recomendas"*) y la medicion de la casa del 22/09 (`_medicion_22_09`, 187 transcripts) dice que **ningun corte de largo separa** los cierres que Fak objeto: *"No te entendi un carajo"* vino despues de 4 lineas. La guia pide lo mismo para Opus 5.5 / Fable 5.1: el tope numerico se reemplaza por el objetivo ("que se entienda de una lectura"); legible le gana a corto | media | rewrite en los tres lugares (hunk N5) |
| N6 | memoria `feedback_no_edito_excel_lo_hace_agente_excel` + `MEMORY.md` + 7 wikilinks | nombre `no_edito_excel_lo_hace_agente_excel`; description `MODIFICADA por Fak el 19/08/2026 — ... ahora los edito YO ... (antes iba instructivo al agente de Excel)`; cuerpo: `editar con el MISMO programa ... (Excel), que preserva todo`; indice: `(ya no: lo edito YO por COM)` | 1d frase relativa + el nombre dice lo contrario de la regla + dato desmentido | El nombre y los 7 `[[...]]` que lo citan dicen la regla vieja; y el 25/09 guardar por COM un libro ajeno se tiro imagenes "en celda" en 17 HO (LECCIONES 25/09, skill `hojas-de-proceso` §3): "preserva todo" ya no es cierto | media | rewrite + rename (hunk N6) |
| N7 | Hook HO (`scripts/_lib/guardianes.mjs` ~1200-1244, `ho-numeracion-guard`) | (a) disparo en esta misma sesion sobre un `grep` de solo lectura que nombraba `HOJAS DE OPERACIONES`; (b) punto 5 `el analisis va en el informe aparte`; (c) punto 4 `Al duplicar una hoja como plantilla, BORRAR sus imagenes` (formato Excel viejo); (d) punto 7 `El .xlsx del SGC lo edito YO con Excel COM` sin el limite del 25/09 | 1c acrecion de parches + duplicados que discrepan | (b) contradice `no_hacer_informes`; (c) describe el Excel pestaña por pestaña que Fak descarto el 24/09 (hoy el generador PowerPoint); (d) contradice `hojas-de-proceso` §3 ("cambiar el numero no pasa por Excel"); (a) 2,4 KB de recordatorio en comandos que no arman ninguna hoja | media | ver parte A (hooks) — se unifica alla |
| N7b | `.claude/hooks/caracteristicas-especiales-prompt.sh:29-34` (UserPromptSubmit) | inyecto el recordatorio de CC/SC (1,5 KB) **dos veces en esta sesion sobre avisos automaticos de fin de agente** (`<task-notification>`), que nombraban "CC/SC" en el texto del agente | 1d instruction re-insertion, disparo de mas | El hook dice en su cabecera que dispara "cuando el mensaje **de Fak** nombra" el tema; hoy dispara con cualquier texto que llegue como turno de usuario, incluidos los avisos del sistema. La guia (Fable 5.1 / Opus 5.5): lo que se repite sin necesidad cuesta tokens y ensucia el turno; el recordatorio pedido por Fak se queda para SUS mensajes | media | rewrite (hunk N7b) |
| N8 | `CLAUDE.md:27`, `consumos-entregables.md:8` | `Lanzar agente auditor al cerrar tareas de codigo` · `un agente independiente ademas del script` | Verificacion por subagente (Opus 5: "delete verification scaffolding") | La guia se contradice entre modelos: para Opus 5/5.5 sacar, para Fable 5.1 mantener (tentativo). Y los dos tienen caza real con modelos actuales (15/09 y 21/09 los encontro el agente, no yo) | baja | flag — no se toca |
| N9 | `CLAUDE.md:97` | `Opus (hoy Opus 5.5) para el resto` | Grupo 2 pinned model name, "hoy" | Decision fechada de Fak sobre el selector: se queda. Se re-lee en cada lanzamiento de modelo | baja | flag |
| N10 | `CLAUDE.md:58` y `core-prohibiciones.md:8` | `13 al 22/09/2026 ... el numero se lee live` | volatile specific | Ya lleva fecha y la instruccion de leerlo live: forma correcta | — | keep |
| N11 | `caracteristicas-especiales.md:44-54` (§2bis) | narrativa del AMFE 173 (21/09) | Grupo 2 history narrative | Falla con el modelo actual, pedido de Fak "para siempre", y es el unico porque de una regla sin check automatico (`:69`): keep list #5 | — | keep |

Lo que se miro y esta bien: hay poca presion en mayusculas en el nucleo (14, en 5 de los 9 archivos), y
casi toda describe un hecho ("NO frena el push", "NO tiene check automatico") o lleva su porque al lado; no hay "think step by step", ni supresores de narracion, ni reglas anti-formato; el
contrato de autonomia coincide con lo que la guia recomienda para Fable 5.1 (reversible = se hace;
destructivo o de otro = se pregunta), y `techo-agentes.md` es el tope determinista que la guia pide para
Opus 5.x. La memoria `si_hay_error_se_corrige_no_se_menciona` ya es la instruccion de "Corrections" que
la guia recomienda.

### Hunks propuestos

#### N1 — `.claude/rules/autonomy-contract.md`
```diff
-| Emitir un documento controlado (flujograma, AMFE, HO) en `Gestion Ingenieria` | **Preguntar** — el documento lo firma Fak |
+| Emitir un documento controlado: flujograma o AMFE en `Gestion Ingenieria`; HO en `HOJAS DE OPERACIONES` del SGC (regla `no-pfd-no-ho.md`) | **Preguntar** — el documento lo firma Fak |
```
```diff
-**Un documento vivo tiene UN solo lugar.** El maestro vive en `Gestion Ingenieria`; lo que se
+**Un documento vivo tiene UN solo lugar.** El maestro vive en `Gestion Ingenieria` (la HO, en
+`HOJAS DE OPERACIONES` del SGC); lo que se
```

#### N2 — `CLAUDE.md` y `.claude/rules/core-prohibiciones.md`
```diff
-PFDs y Hojas de Operaciones no se hacen aca (regla `no-pfd-no-ho.md`);
-sus documentos en Supabase son referencia historica de solo lectura.
+La app no tiene modulo de PFD ni de HO: sus documentos en Supabase son referencia historica de
+solo lectura. Los flujogramas los genero yo por script y las HO se arman a pedido de Fak
+(regla `no-pfd-no-ho.md`).
```
```diff
-7. **Barack ya NO hace PFDs ni HOs** en este software (regla `no-pfd-no-ho.md`).
+7. **No se resucita el modulo PFD/HO de la app ni se ofrece una HO por cuenta propia**: los
+   flujogramas salen del generador del repo y las HO solo a pedido de Fak (regla `no-pfd-no-ho.md`).
```

#### N3 — `~/.claude/skills/propose-before-do/SKILL.md` (global, no va al repo)
```diff
-description: Activar antes de empezar cualquier tarea de implementacion no trivial (mas de 1 archivo a editar, mas de 5 minutos de trabajo, decision de arquitectura, instalacion de plugin/skill, cambio que afecte produccion Barack o setup global de Claude Code). Forzar a Claude a proponer un plan corto y esperar luz verde de Fak ANTES de tocar nada. Fak no programa: necesita ver el plan en castellano antes de que yo me ponga a hacer cosas. NO activar para tareas triviales (un edit puntual, una pregunta, un fix obvio que Fak ya describio en detalle).
+description: Activar antes de algo que no puedo revertir solo en una hora — instalar un plugin o un skill, cambiar el setup global de Claude Code (~/.claude), agregar o cambiar una dependencia, escribir en produccion o en datos sin backup del dia. Propone el cambio en castellano, en pocas lineas, y espera el OK de Fak. No activar para trabajo propio del repo (lo cubren el modo plan y el contrato de autonomia del proyecto), ni para leer, auditar o editar archivos del proyecto.
```
```diff
-Lo que **no** dispara esta skill: trabajo propio del repo con el plan ya aprobado. `CLAUDE.md` de
-Barack es explicito — *"NUNCA preguntar '¿queres que haga X?' — HACERLO y reportar"* — y el hook Stop
+Lo que **no** dispara esta skill: trabajo propio del repo con el plan ya aprobado. `CLAUDE.md` de
+Barack es explicito — *"No preguntar '¿queres que haga X?': se hace y se reporta"* — y el hook Stop
```

#### N4 — `CLAUDE.md`
```diff
-- No preguntar "¿queres que haga X?": se hace y se reporta. La respuesta es siempre si, y cada
-  pregunta le cuesta un turno a Fak (37 por semana antes de los hooks `pregunta-guard.sh` y
-  `cierre-guard.sh`; 2 despues).
+- No preguntar "¿queres que haga X?" por trabajo propio y reversible: se hace y se reporta. Cada
+  pregunta le cuesta un turno a Fak (37 por semana antes de los hooks `pregunta-guard.sh` y
+  `cierre-guard.sh`; 2 despues). Lo que el contrato de autonomia marca "confirmar" o "preguntar"
+  (datos en Supabase, servidor de la empresa, primera vez) se pregunta como "esto va aca, ¿esta bien?",
+  con la ruta concreta.
```

#### N5 — cierre "en cinco lineas" (tres lugares)
`docs/LECCIONES_APRENDIDAS.md:98`
```diff
-- **El cierre de una tarea se escribe en cinco lineas: que recomiendo, el comando, y lo que le cambia una decision; el chat pasa el mismo test que un mail.** Graduado entero a la memoria `no_hacer_informes` + hook Stop `cierre-guard.sh` (chequeo 5).
+- **El cierre de una tarea dice que recomiendo, el comando y lo que le cambia una decision, con las palabras de Fak y para leerse una vez; el chat pasa el mismo test que un mail.** Graduado entero a la memoria `no_hacer_informes` + hook Stop `cierre-guard.sh` (chequeo 5).
```
`scripts/_lib/cierreGuard.mjs:788-792`
```diff
-      titulo: 'CIERRE-GUARD: el cierre es un informe, y una tarea se cierra en cinco lineas',
+      titulo: 'CIERRE-GUARD: el cierre es un informe',
 ...
-        + 'no aplica (se lee su ultimo mensaje). No se repite por 20 minutos.',
+        + 'no aplica (se lee su ultimo mensaje). Lo que Fak objeta no es el largo sino lo que no se entiende de una lectura '
+        + '(medicion 22/09, cierreCanon cierre_largo): palabras de planta, sin siglas ni rotulos inventados. No se repite por 20 minutos.',
```
memoria `feedback_no_hacer_informes.md` (corolario 08/09)
```diff
-El cierre de una tarea va en **cinco líneas: qué recomiendo hacer, el comando si hay que correr
-algo, y lo único que le cambia una decisión**. El detalle ya vive en el `.txt` de la carpeta y en
+El cierre de una tarea dice **qué recomiendo hacer, el comando si hay que correr algo, y lo único
+que le cambia una decisión**, escrito para leerse una vez (la medición del 22/09 sobre 187
+transcripts: ningún corte de largo separa lo que Fak objeta; lo separa que se entienda). El detalle ya vive en el `.txt` de la carpeta y en
```
(el titulo lo asserta solo un comentario de `__tests__/scripts/cierreGuard.test.mjs:189`; no hay test que rompa)

#### N6 — memoria de Excel por COM
Renombrar `feedback_no_edito_excel_lo_hace_agente_excel.md` → `feedback_excel_de_la_empresa_lo_edito_yo_por_com.md`
y reemplazar el nombre en `MEMORY.md` y en los 7 `[[...]]` (`feedback_usar_formatos_oficiales_no_inventar`,
`project_armrest_costura_vista`, `project_legajos_apqp_pdf_pendiente`, `reference_circuito_cambios_ecr_eco_barack`,
`reference_excel_com_argumentos_posicionales`, `reference_gate3_capacity_check_vw`, `reference_openpyxl_excel2016_funciones`).
```diff
-name: feedback_no_edito_excel_lo_hace_agente_excel
-description: MODIFICADA por Fak el 19/08/2026 — los Excel existentes de la empresa ahora los edito YO con Excel COM (antes iba instructivo al agente de Excel)
+name: feedback_excel_de_la_empresa_lo_edito_yo_por_com
+description: Los Excel existentes de la empresa los edito yo con Excel por COM (Fak, 19/08/2026); un libro con imagenes "en celda" no se guarda por COM para cambiar una celda (25/09)
```
```diff
 **Historia:** la regla original (27/07, "demasiado muy importante") nació porque una
 edición por librería rompía los archivos. Lo que la reemplaza no es "editar a mano", es
-editar con el MISMO programa que usa la empresa (Excel), que preserva todo. El hook
-`ho-numeracion-guard.sh` (punto 7) quedó actualizado el 19/08.
+editar con el MISMO programa que usa la empresa (Excel).
+
+**Límite (25/09/2026):** guardar por COM un libro ajeno para cambiar UNA celda se tiró imágenes
+"en celda" en 17 HO. Un cambio chico en un libro con imágenes se hace en el XML (skill
+`hojas-de-proceso` §3), y el respaldo se compara contra las imágenes, no contra el conteo.
```
`MEMORY.md`:
```diff
-feedback_no_edito_excel_lo_hace_agente_excel.md (ya no: lo edito YO por COM)
+feedback_excel_de_la_empresa_lo_edito_yo_por_com.md
```

#### N7b — `.claude/hooks/caracteristicas-especiales-prompt.sh`
```diff
   let prompt = "";
   try { prompt = String(JSON.parse(s).prompt ?? ""); } catch { prompt = s; }
+  // Los avisos automaticos (fin de un agente o de un comando de fondo) llegan como turno de usuario
+  // pero no son palabras de Fak: el recordatorio es para cuando EL nombra el tema.
+  if (/^\s*<task-notification>|\[SYSTEM NOTIFICATION/.test(prompt)) return;
   let canon = null;
```
Con un caso nuevo en `__tests__/scripts/hooksVarios.test.mjs`: un `prompt` que empieza con
`<task-notification>` y dice "CC/SC" no inyecta nada; el mismo texto sin el envoltorio si.

## 5. Hallazgos de los agentes re-verificados contra el archivo (16 de 16)

- C-H1/H2: `arb-operar/SKILL.md:47` y `:73-76` contra `arb-no-cerrar.md:37-40`.
- C-H7: `imds/SKILL.md:8-12` contra `:455-458`. C-H9: `imds/SKILL.md:20` contra `autonomy-contract.md:93`.
- C-H10: `injection-process/SKILL.md:14` y `:26` (familia 17) contra la memoria `project_maestro_pu_headrest` (19, cambiado el 26/05).
- C-H12: `commands/auditoria-cliente.md:43-45`. C-H14: `grep -c audit-cliente` da 2 en `_exportAmfeOficial.ts`, 0 en `_exportOficial.ts` y 0 en `_exportAmfeAmarok.ts`. C-H15: `supabase-safety/SKILL.md:128`.
- B-H1: `carga-arb:76` contra el docstring de `_pdfBomArb.py:12` (`--verificar-vigencia --piezas`). B-H2: `flujogramas:272-273`. B-H4: `no-pfd-no-ho.md:37` contra `hojas-de-proceso:540` (cita del 24/09).
- A: `cierreGuard.mjs:721` ("la respuesta es SI. Hacelo ahora"); `guardianes.mjs:1600-1601` (sugiere `WM_CLOSE` sobre Relaciones y `_arbVer.py reset`); `video-maquina.md:66` cita `tel_indice.ps1`, que no esta en `scripts/`; `auditor.md:159` ("CC/SC — NO auditar") contra `caracteristicas-especiales.md:71`; `coordinadorCanon.data.json`, `plantillaArranque.conCarpeta` ("Todo lo que produzcas queda ahi").
