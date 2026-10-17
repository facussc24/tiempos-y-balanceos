# Revisión adversarial sobre un diff plantado — prueba de la tanda 9, pieza 3 (17/10/2026)

**Qué se probó.** Un repo temporal con `scripts/_lib/revisorPedido.mjs` (rama `main`) y una rama `plantado` con **2 defectos
sembrados a propósito**: (1) `revisor ||= s.revisor` cambiado a `revisor = s.revisor` (la marca del revisor se pisa con la
última línea del registro) y (2) `evaluarRevisorPedido({leido:false})` cambiado de `aviso` a `ok` (falla abierto en
silencio, la falla 9 de `REVIEW.md`). Las lentes no sabían qué ni cuántos defectos había.

**Cómo corrió.** La tool Workflow está bloqueada por el hook global `agentes-guard.sh` («la tool Workflow está
deshabilitada en esta máquina»), aunque `techo-agentes.md` dice que Fak la prendió el 16/10; el pase lo tiene que pedir
Fak. Así que la receta se corrió **a mano**, con los prompts EXACTOS que arma `.claude/workflows/revision-adversarial.js`
(sacados del archivo con agentes de mentira): 4 lentes `investigador` (Sonnet) y 5 verificadores `investigador`
prompteados para refutar. El informe de abajo lo arma el código del workflow con esas respuestas reales.

**Resultado.** Las lentes de correctitud, controles e integración encontraron **los dos defectos plantados** (la de datos y
texto, ninguno: correcto, no había nada de su lente), cada uno con el caso medido contra `main`; los 5 verificadores los
**confirmaron** (0 refutados) con etiqueta Importante y «lo introduce el cambio, no es Preexistente». Además apareció un
hallazgo **Preexistente** real (una línea cortada del registro cuenta como «sin entregas» en silencio).

**Lo que la prueba le corrigió al workflow.** La primera versión contaba **6 Importante por 2 defectos** (tres lentes
encontraron los mismos) y gastó **5 verificadores en 2 defectos**. Desde este commit junta los hallazgos por archivo y
línea antes de verificar: el mismo informe da **2 Importante** y alcanzan **2 verificadores** (test nuevo en
`revisionAdversarialWorkflow.test.mjs`). Y la lente de integración marcó un hueco del test propio
(`revisorPedidoCierre.test.mjs` agregaba la llamada al revisor como última línea, así que no veía el defecto 1): arreglado;
el test nuevo **falla contra la rama plantada** (2 rojos) y pasa contra `main`.

**Costo.** 9 agentes Sonnet (36 de los 40 puntos de la ventana de 10 minutos).

## Respuesta a cada hallazgo (mide el ruido)

| Hallazgo | Respuesta |
|---|---|
| `revisorPedido.mjs:46` · la marca del revisor se pisa | **a propósito** (defecto plantado); encontrado por 3 de 4 lentes, confirmado |
| `revisorPedido.mjs:63` · falla abierto si no hay registro | **a propósito** (defecto plantado); encontrado por 3 de 4 lentes, confirmado |
| `revisorPedido.mjs:24` · línea cortada cuenta como sin señales (Preexistente) | **no importa** por ahora: el paso es un aviso y una línea cortada es rara; queda anotado |
| Hueco del test de punta a punta (lo marcó la lente de integración) | **arreglado** en este commit |

Ruido de esta corrida: 0 hallazgos rechazados de 3 distintos.

---

# Revisión adversarial de plantado contra main — 17/10/2026, prueba de la tanda 9 sobre un diff plantado

**2 Importante, 0 Nit, 1 Preexistente** (confirmados más sin verificar; los refutados no cuentan). 4 lentes (correctitud, controles, datos-y-texto, integracion), 7 hallazgos de las lentes, 3 distintos por archivo y linea, 2 verificados con 1 voto(s) cada uno, tope 6.

Al lado de cada hallazgo, quien lo recibe anota qué hizo: **arreglado / rechazado / a propósito / no importa** (REVIEW.md). Eso mide el ruido del revisor.

## Confirmados (2)
- [Importante] `scripts/_lib/revisorPedido.mjs:46` · TRUE_BUG · lentes correctitud, controles, integracion — relevarRevisorPedido pisa 'revisor' en cada linea del registro: el aviso de que el revisor no corrio sale aunque haya corrido · caso: Registro A (Agent revisor-pedido, despues Write de exports/informe.pptx) y B (Write, Agent, texto): main revisor:true / ok, la rama revisor:false / aviso; C (Agent como ultima linea): las dos ok. Lo introduce el cambio (main tiene ||=). · respuesta: ____
- [Importante] `scripts/_lib/revisorPedido.mjs:63` · TRUE_BUG · lentes correctitud, controles, integracion — Cuando no se pudo leer el registro de la sesion, el control devuelve 'ok' en vez de aviso (falla abierto en silencio) · caso: relevarRevisorPedido('C:/no/existe.jsonl') da leido:false; evaluarRevisorPedido: main 'aviso', rama 'ok' / 'sin registro'. _cierreSesion.mjs pasa {leido:false} sin CLAUDE_CODE_SESSION_ID: el cierre mostraria ok sin haber medido. Rompe revisorPedidoCierre.test.mjs:39. · respuesta: ____

## Refutados (0)

## Sin verificar (1: ROBUSTNESS, DOC y lo que pasó el tope; se juzgan al leerlos)
- [Preexistente] `scripts/_lib/revisorPedido.mjs:24` · ROBUSTNESS · lentes controles — Una linea del registro que no se puede parsear cuenta como 'sin senales' en silencio · caso: linea de Write recortada 10 caracteres: entregas [] y 'no-aplica'; igual en main · respuesta: ____