# Auditoría tandas 1.2 («Propongo» en el cierre-guard) y 4 (subagentes y costo), 16/10/2026

Revisor independiente (agente `auditor`, Opus), regla `codigo-madre.md`, cambios MEDIANOS. Solo detección: no se tocó
ningún archivo del repo, del settings ni de las definiciones. Lo único que escribí es este informe.
Los archivos auditados tienen el mismo hash al empezar (13:59) y al terminar. Siguen sin commitear. El commit
`d1a2adf1` (tanda 1.1, 14:09) entró a mitad de la auditoría, pero no toca ninguno de ellos.

## Veredicto: APROBADO CON CAMBIOS

El código hace lo que dice:
- El aviso «Propongo» viaja adentro del freno del chequeo 5 y no agrega ningún freno nuevo.
- El cupo pasó de negar a avisar y **no se aflojó nada más**: comparé el `decidir()` viejo (HEAD) contra el nuevo en 163.296
  combinaciones y difieren solo en las que antes negaba por cupo.
- Las cuatro definiciones parsean, y el guardián bash y el mod las reconocen.

Pero hay **dos defectos que se ven solos**, y uno de ellos frena el deploy.

**Antes del commit (bloqueante):**
1. **H1**: arreglar `__tests__/mods/registroDelMod.test.mjs`. Hoy queda en rojo y el CI corre la suite entera: el push saldría
   rojo y el deploy no correría.
2. **H2**: rever los `maxTurns`, sobre todo el 80 del `auditor`. Con ese tope, 19 de las 144 auditorías del 01/10 al 16/10 se
   habrían cortado sin informe. Esta también: pasó las 120.
3. **H3**: la tanda 1.2 no se da por implementada sin el renglón «Propongo» de `CLAUDE.md`. El aviso sale dentro de un freno
   que no se disparó ni una vez desde el 13/09.

## Checks del protocolo

| Check | Estado | Detalle |
|---|---|---|
| TypeScript (`npx tsc --noEmit`) | OK | 0 errores |
| Build (`npm run build`) | OK | built in 1m 53s |
| Git local | — | los 10 archivos de estas tandas siguen sin commitear (es lo esperado: falta el veredicto) |
| GitHub sync | FALLO (CRÍTICO por protocolo) | 2 commits locales sin pushear: `23f914e1` (tanda 0/17) y `d1a2adf1` (tanda 1.1). Es trabajo en curso de la sesión madre, no de estas tandas |
| CI | OK | el último run (`f6dd6eaa`, 15/10 19:36Z) terminó en `completed success`; lo de hoy todavía no corrió |
| Dependencias (`npm ls --depth=0`) | OK | sin UNMET/missing |
| vitest de la tanda 1.2 | OK | `cierreGuardOrden` + `cierreGuard`: 107/107 |
| vitest de la tanda 4 | **FALLO** | `presupuesto-agentes.test.mjs` da 23/23, pero `registroDelMod.test.mjs` da 3/4 (H1). En el lote de 26 archivos relacionados (mods, cierre, agentes, tablero, probarMejora, hooksTienenTest): 790/791 |
| `claude plugin test` del mod (copia en el scratchpad) | OK | 20/20 con el `claude` del PATH (2.1.301) y 20/20 con el de la app (2.1.299); `plugin validate` pasa |
| Suite completa | FALLO por H1 | 5 rojos en 4 archivos; solo `registroDelMod` es de estas tandas (detalle en «Suite completa») |

## Hallazgos

### TRUE BUG

**H1. `__tests__/mods/registroDelMod.test.mjs:26-35` queda en rojo: el push sale con el CI en rojo y sin deploy.**
El test cruza el mod con el tablero y tiene un caso «negado por cupo»: un `fable` con la ventana de 5 h al 91 %
(línea 33). Desde este cambio ese lanzamiento es PERMITIR con peso 20. Por eso da `{ puntos: 33, lanzados: 5, tope: 40 }`
contra los `{ 13, 4, 40 }` esperados. El autor corrió los dos archivos que nombró, no este. El CI corre la suite entera
(`.github/workflows`, «Run vitest»). Arreglo: cambiar ese caso por uno que se niegue por la ventana de 10 min, o
actualizar lo esperado y el comentario «negado por cupo».

**H2. Los `maxTurns` nuevos cortan una parte grande del trabajo real, y en el `auditor` cortan la auditoría obligatoria.**
Conté las idas y vueltas con la API de cada subagente desde el 01/10 (los `message.id` únicos del asistente en
`~/.claude/projects/C--Dev-BarackMercosul*/<sesión>/subagents/*.jsonl`; es una aproximación). Contra el tope nuevo:

| Agente | tope nuevo | corridas | lo pasan | p50 / p90 / máx. |
|---|---|---|---|---|
| `auditor` (`.claude/agents/auditor.md:8`) | 80 | 144 | **19 (13 %)** | 37 / 94 / 233 |
| `explorador` (`~/.claude/agents/explorador.md:9`) | 60 | 107 | **36 (34 %)** | 47 / 99 / 154 |
| `investigador` (`~/.claude/agents/investigador.md:8`) | 80 | 282 | **60 (21 %)** | 33 / 124 / 448 |
| `buscador` (ya estaba en 30) | 30 | 54 | 3 | 8 / 28 / 42 |

Las auditorías más largas son justo las que encontraron defectos reales:
- «Auditar mods antes de instalar», 233.
- «Auditar arreglo control borrado», 163.
- «Auditar hooks fusionados P10», 161.

**Esta auditoría encontró H1 en la ida y vuelta 75 y escribió este informe pasada la 120.** Con la definición nueva se
habría cortado en la 80: con H1 encontrado y sin informe.

Qué hace la app al llegar al tope: en el binario 2.1.299, al aparecer `max_turns_reached` el ciclo del agente hace
`break` (`Reached max turns limit`). El informe y la línea de memoria, que el `auditor` deja al final, no se escriben.

Eso choca con dos cosas:
- La regla dice que la auditoría final «pasa siempre» (no descuenta y el mod la exime).
- El número no tiene fuente. Lo que midió `casa_subagentes_costo.md` es la cola cara: 22 agentes de más de US$ 10, el 9 % de 247,
  que corresponden a «más de ~100 herramientas o ~400k de contexto» (línea 188). Los topes 60 y 80 cortan mucho más que eso.

No propongo números. El tope se mide contra los turnos reales de cada tipo (regla de la casa
`feedback_umbral_se_prueba_contra_la_poblacion`) y lo decide la sesión madre o Fak.
Se ve solo en la primera auditoría larga de una sesión NUEVA (ver H9).

### ROBUSTNESS

**H3. El aviso «Propongo» viaja en un freno que no sale nunca, y la parte de `CLAUDE.md` que lo sostiene no existe.**

- `CLAUDE.md` no tiene ningún renglón «Propongo» (grep: 0). Sin embargo, tres lugares lo citan como si estuviera:
  - el aviso (`scripts/_lib/cierreGuard.mjs:1873`, «…(CLAUDE.md)»);
  - el canon (`cierreCanon.data.json:268`, `fuente`: «la forma que fija CLAUDE.md»);
  - el nombre del test (`cierreGuardOrden.test.mjs:204`, «la conducta la maneja CLAUDE.md»).
- La sesión madre ya lo sabe: el renglón va después de fundir la rama de la tanda 10.
- Lo que pesa es la medición. El chequeo 5 («el cierre es un informe») es el único lugar donde viaja el aviso, y en los
  registros reales:
  - su último freno («Stop hook feedback: … el cierre es un informe») es del **13/09**;
  - desde el 09/10, el cierre-guard frenó 354 veces (132 por el chequeo 3) y **0 por el chequeo 5**;
  - en el TEMP real hay 38 marcas del chequeo 3 entre el 07/10 y el 16/10 y **ninguna** `.largo`.
- O sea, con el código solo, el aviso no le llega a nadie. El objetivo del plan («más del 50 % de los cierres») depende
  entero del renglón de `CLAUDE.md`.
- Mientras tanto, el aviso cita una fuente que no está.

**H4. La ventana de 5 h también pasó de freno a aviso, y la regla `trabajar-hasta-la-hora.md` §5 sigue diciendo que no.**
- La decisión (4) del plan (§ tanda 4) habla del «freno por cupo semanal». El prompt de implementación dice en una línea
  «los subagentes no se frenan por cupo» (l. 28) y en otra «sin freno por cupo semanal» (l. 75).
- `presupuesto.mjs:142` también saca el freno de 5 h > 85 %.
- `trabajar-hasta-la-hora.md:48`, que es always-on y no se tocó, dice: «pasado el **85 %** de esa ventana no se lanzan
  subagentes». El 85 % lo escribió una sesión el 08/10 (`544508d2`); que es «de Fak» va pegado a la otra mitad de la frase.
- El mismo informe de costos (línea 127) cuenta 13 agentes cortados por «You've hit your session limit» y dice: «es lo que el
  freno de 5 horas > 85 % busca evitar». O sea que para la ventana de 5 h hay datos, a diferencia del 60 % semanal.
- Hoy dos reglas always-on dicen cosas distintas, y el comentario del mod (`presupuesto.mjs:8`) cita como fuente del aviso
  una regla que dice «no se lanzan».
- Es decisión de Fak si el «sin freno por cupo» incluye la ventana de 5 h. Va primero porque es un afloje sin la cita.

**H5. El «tope nativo» de 10 subagentes a la vez probablemente no corre en una sesión ultracode, y ultracode es el modo de este plan.**
- La variable existe y sube/baja bien: `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS` es `D.int({min:1,digitsOnly})`; con "10" el tope
  pasa de 20 (el default, `Q8o=20`) a 10.
- Pero la función que niega (`jn()` en el binario 2.1.299) retorna sin negar en dos casos:
  - si `uh(h.ultracode, modelo)` da verdadero, es decir, en modo ultracode;
  - si la bandera remota `tengu_amber_kestrel` está prendida.
- Fak eligió «Fable 5.1 con ultracode» para estas sesiones (prompt de implementación, l. 3 y 87).
- La regla (`techo-agentes.md:20`, «Lo que SI frena: … el tope nativo …=10») y el encabezado de `presupuesto.mjs:10` lo dan
  como freno vigente.
- Lo leí en UN binario y no lo vi en una sesión real: «probable».

**H6. Documentos que quedaron diciendo lo contrario.**
- `.claude/rules/techo-agentes.md:126`: «`.agent-cupo-ok` # 12 h: el mod deja de frenar por cupo real (5 h > 85 %, semana > 60 %)».
  Contradice el párrafo nuevo de la misma regla (l. 20: el escape «apaga el aviso»).
- `mods/presupuesto-agentes/README.md:6` («no sale ningún subagente nuevo») y `:25` («saltea el freno por cupo real»).
  Es la copia que viaja con el mod instalado.
- Sección nueva «Lanzar o no» (`techo-agentes.md:90`): el título dice «medidos en `casa_subagentes_costo.md`».
  - Los ítems 1, 2 y 4 coinciden con el informe, número por número: 71 %, US$ 2.197, US$ 888, 247, US$ 0,20, 469.000 tokens,
    US$ 0,14, 22 agentes y US$ 292 (un tercio), 30 de 247, 13 y 11.
  - El ítem 3 (Lydia Hallie, 10/10) sale del plan, que cita la captura `novedades_2026-10-15_1439.md`.
  - El ítem 5 («98.000 a 118.000» y «55.000») es una medición de la sesión del 16/10 y no está en ese informe.
  - El «54 de 62» es una estimación según el informe (l. 180); la regla y el mod lo dan como dato.

**H7. El aviso del cupo dice un peso que no es el que se descuenta, y el modelo no lo ve.**
- `presupuesto.mjs:147` arma el texto antes del ajuste por `.agent-opus-ok` (l. 151-152). Con el pase vigente, un Opus o un
  Fable aparecen con «peso 8» o «peso 20» y descuentan 4: lo vi en 288 combinaciones del barrido.
- El aviso va solo a `$.ui.log` (`register.js:158`) y al registro. Sin embargo, su última frase («si el trabajo no avanza en
  10 minutos, se mira, no se espera») le habla a la sesión, que no lo recibe.
- Es menor. El plan pedía además «el costo estimado del agente» y sale el peso.

**H8. Las reglas que el `auditor` y el `amfe-healer` dejan de cargar.**
- `auditor.md`, párrafo nuevo: las reglas «se leen cuando el prompt las nombra». Los checks 3 y 4 del cuerpo dependen de
  `amfe.md` §1/§13 y del §2bis de `caracteristicas-especiales.md`, que era always-on y con `omitClaudeMd` ya no entra.
  El cuerpo las nombra, así que el agente puede leerlas. Conviene decir en el párrafo que **el cuerpo** también cuenta como
  «el prompt».
- Falta también la excepción del repo público (`git-deploy.md`: un dato de la empresa en el repo no es hallazgo). Sin ella, un
  auditor sin `CLAUDE.md` puede volver a reportarlo.
- `amfe-healer.md`: el párrafo nuevo manda leer `amfe.md` «entera» antes de tocar contenido. El paso 1 del cuerpo dice «No leas
  … las reglas generales salvo que haga falta». No es contradicción fuerte, pero conviene alinear la frase.

**H9. El `omitClaudeMd` nuevo todavía no se vio funcionar (no verificado, no es defecto).**
- Los tres subagentes lanzados por la sesión madre después de editar las definiciones (13:48) arrancaron con el adjunto
  `instructions` (CLAUDE.md + LECCIONES):
  - el `investigador` de prueba de las 13:54, con 109.308 tokens de arranque;
  - este `auditor`, que corrió con el cuerpo VIEJO, sin el párrafo nuevo;
  - el auditor de la tanda 1.1.
- La sesión madre ya lo anotó: las definiciones se leen al arrancar y lo mide la próxima hija.
- Hasta esa medición, la ganancia de la tanda 4 (~41.000 tokens por agente) y los `maxTurns` de H2 solo existen en sesiones
  nuevas. El cierre tiene que decirlo (regla `mejora-implementada.md`, «sesiones abiertas»).

**H10. Menores de la tanda 1.2.**
- El medidor (`_cuatroNumeros.mjs:96`, `\**Propongo\**`) y el guardián (`(\*\*)?propongo(\*\*)?`) no definen igual «tiene el
  renglón»: `*Propongo:*` en cursiva cuenta para uno y no para el otro. Ninguno cuenta `- Propongo:` (viñeta) ni
  `Propongo` + lista sin dos puntos.
- La cabecera de `cierreGuard.mjs` (l. 12-47), que lista lo que mide cada chequeo, no menciona el aviso nuevo (sí el de orden, H5).
- El aviso pide «el último renglón», pero el regex acepta el renglón en cualquier lugar del mensaje.

**H11. La profundidad 3 se justifica con algo que las definiciones no permiten.**
`techo-agentes.md:20` dice: «con 2 los Sonnet no pueden lanzar Haiku y el ritual del viernes se rompe». Pero:
- `investigador.md:37` dice «No lances otros subagentes» (estaba desde el 30/09);
- `explorador.md:7` tiene `disallowedTools: … Agent`.

Hoy ningún Sonnet definido lanza Haiku. La razón del 3 está mal; el 3 en sí (default) no hace daño.

### FALSE POSITIVE / verificado sin acción

- **Escapes del canon (pedido 2).** `cierreCanon.data.json:267` tiene `\\n` y `\\s` bien escapados. `import()` de
  `cierreGuard.mjs` no tira, y `rx(PROP.re)` compila con la bandera `i`. `git diff` del canon muestra exactamente 6 líneas
  agregadas, LF y con salto final.
- **Cierre corto y «propongo» suelto (pedido 3).** Un cierre corto sin «Propongo» pasa (`ok: true`). «Lo que propongo: …» y
  «Te propongo …» no cuentan. `Propongo: nada.`, `**Propongo:**`, `**Propongo**:`, `PROPONGO:` y `\r\n` sí cuentan.
- **Hook Stop real (pedido 4).** Payloads armados con `JSON.stringify` y pasados a `bash .claude/hooks/cierre-guard.sh`, con
  TEMP, HOME y USERPROFILE desviados al scratchpad y la marca del chequeo 3 puesta. Resultados:
  - informe largo sin «Propongo»: **exit 2** con «ADEMAS, falta el ultimo renglon «Propongo…»;
  - con `Propongo: nada.`: exit 2 sin ese renglón;
  - cierre corto: **exit 0**;
  - `stop_hook_active`: exit 0.
- **El mod no aflojó otra cosa.** Barrido viejo contra nuevo de `decidir()`: 163.296 combinaciones (9 tipos × 7 modelos ×
  3 esfuerzos × definición propia/ninguna/error × 6 cupos × 8 escapes × 3 libros × fork). Resultado: 157.140 iguales, 6.156
  que antes negaban por cupo y ahora pasan con aviso (o las niega la ventana), y **0 diferencias más**. Siguen igual la
  ventana de 10 min, el pase de sesión, el `fork`, la auditoría final y `.agent-limit`.
- **`aviso` es `null` cuando no hay nada que avisar** en los caminos que permiten (59 % semanal: `null`). En los caminos que
  niegan y en el del auditor no existe (`undefined`). Todos los que lo usan miran si es verdadero, así que no cambia nada.
- **El registro con aviso lo sigue entendiendo el tablero.** Armé líneas como `asentarYAnotar` (`motivo · AVISO …`) y se las
  pasé a `leerAgentesMod`:
  - 5 h al 90 % con sonnet, opus y haiku: `{13,3,40}`;
  - semana 61 % y 86 %: `{24,2,40}`;
  - `.agent-limit = 15`: tope 60;
  - ventana llena: `{40,10,40}`.

  El regex toma el primer `peso=` y el primer `N/M puntos`, y el aviso no trae ninguno de los dos. `_modsInstalar.mjs` solo
  imprime las últimas 8 líneas y no parsea.
- **Copias instaladas.** `~/.claude/mods-casa/presupuesto-agentes` y `~/.claude/plugins/cache/mods-casa/presupuesto-agentes/0.1.0`
  son idénticas al repo, salvo `tests/` y `.gitignore`, que no se copian. El registro real muestra sesiones cargando desde `mods-casa`.
- **Frontmatter.** `auditor.md`, `amfe-healer.md`, `explorador.md` e `investigador.md` parsean con js-yaml y no tienen claves
  repetidas. Los tipos son `omitClaudeMd: true` (booleano) y `maxTurns` numérico. `leerFrontmatter` del mod y el guardián
  bash real (con casa falsa) los reconocen con el peso correcto: auditor 0, healer 4, explorador 4, investigador 4, opus 8,
  buscador 1. El built-in sigue rechazado. `claude plugin validate .claude --strict` y `~/.claude --strict` pasan.
- **Los campos existen en la app.** El esquema de definición de agente del binario 2.1.299 tiene
  `maxTurns: int().positive()` («Maximum number of agentic turns (API round-trips) before stopping»). `omitClaudeMd: true`
  lo usan los agentes de los plugins que trae la app.
- **Los párrafos nuevos de `explorador` e `investigador`** (los diferencié contra la copia de la nube del 30/09) no
  contradicen el cuerpo, salvo lo de H11, que es anterior.
- **`~/.claude/settings.json`**:
  - es JSON válido;
  - `CLAUDE_CODE_FORK_SUBAGENT: "1"` y `CLAUDE_CODE_SUBAGENT_MODEL: "claude-sonnet-5-5"` siguen intactos;
  - `AGENT_TEAMS: "0"` se lee como booleano falso (`D.bool`), igual que si no estuviera: no daña, y el plan ya dice que no
    ahorra nada;
  - `MAX_CONCURRENT_SUBAGENTS: "10"` se lee como 10.
- **CRLF.** `techo-agentes.md` está entero en CRLF en el disco (136 de 137 líneas; HEAD es LF). No tiene frontmatter y
  `.gitattributes` (`eol=lf`) lo normaliza al commitear.
- **`buscador.md`.** No se tocó hoy y no pasa js-yaml estricto (`: ` sin comillas en la `description`). Es LF y la app lo carga
  bien (el registro real lo pesa como haiku). No es de estas tandas.

## Fuera del alcance (un renglón cada uno)

- `techo-agentes.md:7`, `:34-35` y `:136` siguen diciendo que Workflow está deshabilitado y que `disableWorkflows: true`
  está puesto. Hoy a las 13:02 se sacó por ultracode, pedido de Fak (respaldo `settings.json.antes-ultracode-2026-10-16`), y
  `agentes-guard.sh:342` sigue negando Workflow sin pase.
- Otras diferencias del settings global de hoy que no son de la tanda 4: `cleanupPeriodDays` 90 → 365,
  `crossSessionInbound: "accept"` y el marketplace `claude-community`.
- Las copias de la nube (`Claude Fak\claude-config\agents\` y `settings.json`) quedan viejas hasta `_nube.mjs --sincronizar`.
- `_cuatroNumeros.mjs` cuenta «Propongo» en todo mensaje del asistente, pero divide por los cierres: el numerador puede pasar
  al denominador.

## Suite completa

`npx vitest run --pool=threads`, 14:32 a 14:46: **5 rojos en 4 archivos de 392** (7.907 tests pasan). Uno solo es de estas tandas:

| Archivo | ¿De estas tandas? | Por qué |
|---|---|---|
| `__tests__/mods/registroDelMod.test.mjs` | **SÍ (H1)** | el caso «negado por cupo» ahora pasa |
| `__tests__/scripts/powerpointQuit.test.mjs` | no | lo marca `scripts/hotmelt/_test_com.py:4`, un archivo **sin seguimiento** de otra sesión; en el CI no existe |
| `__tests__/scripts/xlsxComparar.test.mjs` | no | se pasó del tope de 15 s con la PC cargada; solo pasa (17/17 junto con el de abajo) |
| `__tests__/scripts/imprimirTemporal.test.mjs` (2) | no | mismo motivo (23 s y 20 s); solo pasa |

Hashes de los 10 archivos auditados al terminar: iguales a los del arranque. Lo que se commitee es lo auditado.
