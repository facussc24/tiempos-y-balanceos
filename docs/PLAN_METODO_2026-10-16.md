# Plan — tanda 9 del plan del sistema: método (revisor contra el pedido, bancos de casos, poda medida, retiros con vencimiento) (16/10/2026)

Lo escribió la sesión Fable 5.1 de la PC principal (`34df5f0e`) a partir de `10-PLAN_SISTEMA_2026-10-16.md` (tanda 9: las 5 ideas de
Gemini, las 3 de Fable, lo que la industria aplica; más lo que agregó `anthropic_a_fondo.md`), del informe
`20-informes\afuera_industria_metodo.md` (31 fuentes) y del post de claude.dev del 15/10 «How the Claude Code team does code review»
(leído entero el 16/10 16:05; resumen en `exports/explicaciones/novedades_x_2026-10-16.md`). La implementa una hija Opus 5.5 en su
worktree, sin push; cada pieza es mediana (plan corto en el chat de la hija, test en las dos direcciones, auditor Opus al final),
un commit por pieza. Lo que ya se hizo el 16/10 en otras tandas no se repite: la plantilla de hijas con los bloques oficiales de
Fable 5.1 y el cierre de Alex Albert (1.1), el renglón «Propongo» (1.2), el tope de 2 rondas hija↔revisor (aplicado en la
impresora), «Probado / Riesgo / Vuelta atrás» en los commits medianos (se usa desde la 1.7).

## Lo medido que manda (no se vuelve a medir)
- `correccionGuard --medir`: en 15 de 54 sesiones con entrega, lo mismo se reentregó 3 veces o más. Ningún paso de la casa compara
  el entregable contra el PEDIDO (el `auditor` mira TypeScript, build, git, CI).
- La casa carga siempre 101,6 KB / 1.092 renglones (CLAUDE.md 13,9 KB, LECCIONES 26,7 KB, 10 reglas sin `paths:` 61 KB); la doc
  oficial pide menos de 200 renglones por archivo y Anthropic sacó más del 80 % de su system prompt sin perder (claude.dev 24/07).
  ICLR 2026 (arXiv 2602.11988): los archivos de contexto no mejoran el éxito en general y suben el costo > 20 %, pero sirven para
  prácticas no estándar (lo de Barack: sin firma de IA, CC/SC solo de Fak, logo oficial).
- 48 hooks y una lección por incidente = sobreajuste según la guía oficial de evals (07/10/2026): separar casos de entrenamiento y
  de prueba, juez distinto del medido, correr el evaluador dos veces, medir el ruido antes de ajustar.
- `claude plugin eval` existe en esta PC pero falla con el repo entero como plugin (más de 20.000 entradas): hay que apuntarlo a
  una carpeta chica (`evals/` o la skill) y no a la raíz.
- 0 de 442 cierres traían «Propongo» el 16/10 (ya corregido en 1.2); la hoja de los 4 números (`_cuatroNumeros.mjs`) existe.

## Piezas (un commit cada una, en este orden)

1. **Definición de hecho + revisor contra el pedido** (G3; mediano). Antes de cada mediano/grande con entregable, 3 a 5 renglones
   de «qué tiene que ser verdad» y un quiz de 3 preguntas que el entregable tiene que contestar perfecto (Thariq, «Field Guide
   to Fable»). Un agente `revisor-pedido` (definición propia, Sonnet, `omitClaudeMd`, sin `Agent`) que recibe el pedido textual de
   Fak, la definición de hecho y el entregable, y devuelve «cumple / no cumple» por renglón con la cita. Se calibra con casos de
   respuesta conocida ANTES de usarlo: 3 entregables que Fak devolvió «no era lo pedido» (buscar en los transcripts: `feedback_responder_el_scope_exacto`, 06/10 y 14/10) y 3 aprobados.
   Lo llama la plantilla de `_encargo.mjs` (línea del cierre) y `_cierreSesion.mjs` lo mide (aviso, no freno, la primera semana).
2. **`REVIEW.md` del repo y uno por tipo de entregable** (post de code review del 15/10; chico cada uno): qué es «falla» acá
   (un guardián que afloja sin test, un número sin fuente, inglés suelto, «Claude» en un documento, un dato sin papel), tope de
   nits, rutas a saltear, «la evidencia es archivo y línea», «el resumen arranca con el conteo». Para hojas de proceso, AMFE y
   mails: las quejas de Fak convertidas en qué mirar (el «libro de observaciones» de la tanda 13 con el molde de ellos).
   El `auditor` y el `revisor-pedido` los leen al arrancar.
3. **El revisor de la casa = lentes en paralelo + verificadores que votan + etiquetas** (post del 15/10; mediano): la receta
   que se usó a mano el 16/10 sobre la rama de la impresora (Workflow de 4 lentes y un verificador por hallazgo TRUE_BUG) pasa a un
   workflow guardado en `.claude/workflows/revision-adversarial.js` con parámetros (rama, archivos, lentes) y el informe con el
   molde de `docs/auditorias/REVISION_impresora_workflow_2026-10-16.md`; cada hallazgo lleva Importante / Nit / Preexistente, y
   el que lo recibe anota qué hizo con él (arreglado / rechazado / a propósito / no importa) en el mismo informe: eso mide el
   ruido. Tope de 2 rondas autor↔revisor escrito en la plantilla de `_encargo.mjs` (hoy está en el texto de un encargo, no en la
   plantilla). Se compara contra `/code-review low` y `medium` sobre la bancada de la pieza 6.
4. **Banco de casos de RESULTADO por skill de entregable** (G4; chico el primer lote): `evals/` por skill con `claude plugin eval`
   apuntado a una carpeta chica (no al repo entero), 5 casos de AMFE y 5 de mail con respuesta conocida, baseline «sin skill»,
   3 corridas, umbral. La hora con Fak para el lote de AMFE queda pedida en el cierre, no frena: el primer lote se arma con los
   casos que ya existen (`_verificarAprendizajeAmfe.mjs`, `test_gates_entrega.py`, los mails devueltos en `feedback_mail_*`).
5. **Poda de CLAUDE.md y de las reglas sin `paths:`, con A/B** (G5; mediano). Primero `/doctor prompt-audit` (lo tipea Fak: va a
   su lista) o el `prompt-audit` de la skill `claude-api` si corre desde la sesión; después una propuesta de poda en
   `docs/PODA_CLAUDE_MD_2026-10.md`: qué se saca (lo estándar, lo duplicado, lo que ya tiene hook), qué pasa a una regla con
   `paths:` o a una memoria, qué queda (lo no estándar). La prueba: 10 tareas reales (los mensajes de Fak de la semana) con el
   contexto actual y el podado, mismas respuestas en lo que debe frenar; recién entonces se aplica, en un commit aparte.
6. **Calibrar al revisor** (mediano, una vez por modelo): bancada de 8 diffs (4 con defecto plantado real tomado de los
   auditores del 16/10, 4 limpios ya aprobados), 3 corridas por modelo; si Sonnet empata a Opus en la bancada, el `auditor`
   baja a Sonnet para lo mediano y Opus queda para lo grande; el número va al cierre y a `techo-agentes.md`.
7. **Retiro con vencimiento** (mediano: toca la cabecera de hooks y reglas, no su lógica): cada hook y cada regla con
   `revisar: AAAA-MM-DD` y `justifica: <número o incidente>` en su cabecera; `node scripts/_retirosVencidos.mjs` lista los
   vencidos y los que no se dispararon nunca (con el aviso «0 disparos no es inútil: se mide con casos plantados»);
   `_cierreSesion.mjs` lo nombra una vez por semana. Los retiros ya decididos (camino B el 23/10, `--espera-modelo`) entran acá.
8. **D7: verificar que la lección sirvió** (mediano): `correccionGuard --medir --despues <fecha>` cuenta reapariciones de la misma
   categoría de corrección después de graduada a hook o regla; y cada regla nueva nacida de una corrección se verifica
   adversarialmente (un caso que debe frenar y uno que no) antes de darla por implementada: se escribe en
   `lecciones-consolidacion.md` como paso del ciclo.
9. **Separar app y herramientas en CI** (F-B; mediano): dos workflows, el candado del repo público corre siempre, el deploy de
   GitHub Pages solo cuando cambian `modules/`, `components/`, `core/`, `utils/`, `index.*`, `package*.json` (lista medida con
   `git log --stat` de los deploys que sí cambiaron la app); un test de la Papelera no vuelve a dejar el CI rojo 23 min. **Ojo:
   no filtrar el candado** (`_gateRepoPublico.mjs`).
10. **PPM del asistente, v0** (F-C; chico): `node scripts/_cuatroNumeros.mjs` suma dos columnas que ya se pueden medir:
    reentregas (de `correccionGuard`) y hallazgos del auditor aceptados sobre emitidos (de los informes de `docs/auditorias/`,
    que desde la pieza 3 traen la etiqueta de respuesta); la hoja semanal es la misma del viernes. Fak valida los 4 números la
    primera semana contra lo que recuerda (va a su lista, no frena).
11. **Lo que se mide antes de tocar un hook** (anthropic_a_fondo b): contar en los registros de `cierre-guard`, `pregunta-guard` y
    `hora-guard` cuántos cierres evitó cada uno desde el 01/10; el número va a `docs/` y decide si `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP`
    se toca (hoy no: un número de regla lo cambia Fak).

## La prueba de la tanda (no se da por hecha sin esto)
El `revisor-pedido` marca los 3 entregables devueltos y pasa los 3 aprobados (pieza 1); el banco de 10 casos corre con y sin skill
y deja su informe (pieza 4); la hoja v0 reproduce el 15 de 54 de `correccionGuard` (pieza 10); el workflow de revisión corre
sobre un diff plantado con 2 defectos y los encuentra con sus etiquetas (pieza 3); `_retirosVencidos.mjs` lista al menos los dos
retiros ya decididos (pieza 7); la poda NO se aplica sin el A/B de 10 tareas (pieza 5).

## Qué puede romper
- Un revisor o un banco mal calibrado da verde a lo malo o rojo a lo bueno: cada pieza arranca con casos de respuesta conocida
  (3 devueltos / 3 aprobados) y 3 corridas, y la primera semana AVISA, no frena.
- La poda de CLAUDE.md puede sacar una práctica no estándar que un hook no cubre: por eso el A/B mira «lo que debe frenar sigue
  frenando» y la lista de lo que se saca va a Fak antes de aplicar.
- El filtro de rutas del deploy puede dejar de publicar un cambio real de la app: la lista sale de los deploys medidos y el candado
  no se filtra.

## Cómo se entrega
Rama del worktree, un commit por pieza con rutas, sin push; `npm test` entera corrida por la hija (agrega archivos y toca CI);
auditor Opus con el informe a `docs/auditorias/` (con las etiquetas de la pieza 3); en el último turno: rama, commits, los números
de la prueba de la tanda, lo que quedó sin hacer y por qué, y qué necesita de la madre o de Fak. Al cerrar la 9, la madre lanza
las hijas 11 (3D a fondo) y 12 (skills una por una), como dice el prompt.

## Qué necesita de Fak (no frena)
Una hora para el banco de casos de AMFE (pieza 4, segundo lote); tipear `/doctor prompt-audit` y pegar lo que devuelve (pieza 5);
validar los 4 números la primera semana (pieza 10). El resto, nada.
