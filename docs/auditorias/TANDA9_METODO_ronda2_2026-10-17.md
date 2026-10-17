# Tanda 9 (método) — ronda 2: lo que marcó la revisión de la sesión madre, aplicado (17/10/2026)

Encargo E261017-e292 (continuidad de E261017-7846). La sesión madre revisó la punta `90dc21c6` con un workflow
adversarial (tres revisores Sonnet y un escéptico Opus) y el veredicto fue «fundir con arreglos»: 1 hallazgo Importante,
3 que entran antes de fundir y una lista de detalles. Todo en la rama `claude/metodo-tanda9`, sin push, un commit por
hallazgo, cada uno con su caso en el test. No se volvió a lanzar el auditor: la madre hace probar los arreglos por otro.

## Antes de fundir

| # | Hallazgo | Qué se cambió | Caso que lo prueba | Commit |
|---|---|---|---|---|
| 1 | El cierre daba `ok` con el candado verde y el deploy del HEAD en curso o en cola | `combinarCI` (`scripts/_cierreSesion.mjs`): un deploy sin terminar da aviso; el texto dice si es el del HEAD. **Distinto de lo propuesto**: aviso con cualquier deploy sin terminar, no solo el del HEAD, porque mientras corre no se sabe si lo publicado queda verde | `cierreSesion.test.mjs`: ROJO `in_progress` y `queued` → aviso; VERDE deploy terminado verde → ok | `b809bc4f` |
| 7 | El test de retiros ponía rojo el CI al fundir una rama que agrega o retira hooks | `retiros.data.json`: alta de `modelo-guard` (tanda 3, pieza 12) y `permiso-un-uso-guard` (pieza 9), vencimiento 2026-11-17; baja de `dev-server-guard` (P11: 4 frenos en el mes, los 4 falsos) y `timeout-guard` (P20: ~51.800 corridas y 6 avisos) en `retirados`, las cuatro con fecha 16/10/2026 y `pendienteDeFusion: claude/guardianes-tanda3`. `_retirosVencidos.mjs` las lista en «Pendientes de fusión» y no las cuenta como sin renglón / sin archivo. **Distinto de lo propuesto** (hacerlo en el merge): queda hecho ya, y el test pasa antes y después de fundir | `retirosVencidos.test.mjs`: VERDE con los hooks de hoy y con los del estado final; ROJO un alta sin la marca y una pieza nueva sin renglón. Simulado además contra los hooks reales del worktree `guardianes-tanda3`: sinRenglón [], sinArchivo [], pendientes 0 | `f4a045d3` |
| 8 | El contador «razón sin número» usaba `/d/` en vez de `/\d/` | `_retirosVencidos.mjs`: `/\d/`. Ahora da 46 (antes 6). La respuesta de la ronda 1 al Nit del auditor («6 por texto») estaba apoyada en ese error: el Nit sigue abierto, son 46 razones para completar al revisar cada pieza | `retirosVencidos.test.mjs`: ROJO una razón con la letra «d» y sin dígitos sale; VERDE una con fecha no | `d92965a0` |
| 9 | D7 `--despues` no validaba la fecha | `reapariciones()` tira error si no es `AAAA-MM-DD` válida; la línea de comandos sale con 2 y el motivo | `correccionD7.test.mjs`: ROJO `01/10/2026`, `28/09`, vacía y `2026-13-45`; la CLI sale con 2; VERDE `2026-10-02` | `9f3b1b37` |

`correccionGuard.mjs` lo lee un hook de mensajes de Fak: después del cambio se corrió `node scripts/_probarMejora.mjs
--mensaje "armaste un mail que no te pedi" --espera "CORRECCION-GUARD"`: sin fallas.

## Detalles (todos entraron)

| # | Qué se cambió | Commit |
|---|---|---|
| 2 | `ciWorkflows.test.mjs`: ROJO si el job `repo-publico` gana un `if:` o un paso del gate gana `continue-on-error`, en `candado.yml` y en `deploy.yml` | `ee1330fa` |
| 3 | El aviso del deploy rojo viejo dice «lo relanza Fak desde la web: Run workflow sobre main» (sin «un push que toque la app») | `ee1330fa` |
| 4 | El test de rutas del deploy chequea las 18 entradas | `ee1330fa` |
| 5 | `git-deploy.md`: un cambio de la app fuera de la lista se publica con Run workflow desde la web, y lo hace Fak | `ee1330fa` |
| 12 | Con `--lanzada`, el renglón autónomo dice «es el punto del cierre» (antes «el punto anterior», que ahora es el del revisor) | `5b6754b4` |
| 13 | `revisor-pedido.md`: la description entre comillas; `claude plugin validate .claude --strict` sin errores | `5b6754b4` |
| 15 | La memoria es `feedback_documento_no_confiesa_como_se_hizo`: corregida en `docs/review/mail.md` y en el caso `correccion-sin-confesar`; `coordinador.md` suma el renglón de `lineaRevisor` | `5b6754b4` |
| 16 | `bancos.json`: dice que el brazo «con» trae también la lista del revisor (`docs/review/<tipo>.md`), que una sesión real no carga. **Distinto de lo propuesto**: se corrige el texto y no se saca la lista, para no dejar sin sustento los números que ya corrieron | `f9f545f1` |
| 18 | La hoja dice «intento de reproducir el 15 de 54 (no reproduce: el turno se cuenta distinto)» | `f9f545f1` |
| 22 | La columna 6 cuenta «arreglado en parte» aparte y deja afuera los informes de prueba `REVISION_diff_plantado_*` (test) | `f9f545f1` |
| 25 | BANCADA: la frase de Boris se cita de donde salió, el plan general (tanda 9, «a bis»: «Boris 23/09…»), con la fuente original sin verificar. **Distinto de lo propuesto** («Boris 11/08, R2»): esa fuente no la pude verificar | `f9f545f1` |
| 26 | PODA: «3 corridas por brazo» | `f9f545f1` |
| 28 | `se-disparo.md` ya no dice que va marcado `with-only` | `f9f545f1` |

## Verificación

- `node --check` de `_cierreSesion.mjs`, `_retirosVencidos.mjs`, `correccionGuard.mjs`, `ppm.mjs`, `_cuatroNumeros.mjs`:
  sin errores. `.claude/workflows/revision-adversarial.js` da error en `node --check` por el `return` de nivel superior,
  que es lo normal en un guion de Workflow; su chequeo es el test que lo corre entero (verde).
- Los tests de la tanda: 14 archivos, 214 de 214 (`cierreSesion`, `revisionAdversarialWorkflow`, `revisorPedidoCierre`,
  `revisorCalibrar`, `ppm`, `retirosVencidos`, `ciWorkflows`, `encargo`, `evalBanco`, `reviewMd`, `correccionD7`,
  `stopHooksMedir`, `correccionGuard`, `coordinadorGuard`). La suite completa no se volvió a correr en esta ronda.

## Para la lista de Fak (no se tocó)

- Los números nuevos de la tanda son **propuestas** hasta que Fak los confirme: el umbral 0,8 del banco, el tope de 3 nits
  de `REVIEW.md` y el vencimiento por defecto 2026-11-17 de los retiros.
- Los dos adjuntos ya enviados con «claude» en partes ocultas (la planilla de códigos a Luca del 01/09 y el informe
  TryOut del día 4 a Carlos del 31/08) los decide él.
- Al fundir: si la rama de la tanda 3 cambia sus hooks respecto de lo que hoy tiene su worktree, ajustar
  `retiros.data.json`; después de las dos fusiones se puede sacar el campo `pendienteDeFusion`.
