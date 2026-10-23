# Prompt de arranque para un agente que trabaja horas solo: lo que hay afuera
Consultado el 20/10/2026.

Alcance: sale de lo oficial de Anthropic (abierto con web_fetch), dos estudios (arXiv) y lo de OpenAI/Google. Lo de Google es flaco (ver "Qué se buscó"). Los dos archivos que ya existían (`INVESTIGACION_3D_AFUERA...` y `ROADMAP.md`) no tocan prompts: este frente es nuevo.

## Qué hay

| Qué | Qué dice, en una frase | Fuente (link) | Fecha | abierta/solo búsqueda |
|---|---|---|---|---|
| Effective harnesses for long-running agents (Anthropic) | Sola, la compactación no alcanza: el primer prompt arma el entorno (lista de funciones en JSON con `passes:false`, archivo de avance, `init.sh`, git) y los siguientes avanzan de a UNA función. | https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents | 26/11/2025 (modif. 18/10/2026) | abierta |
| Harness design for long-running apps (Anthropic) | Un evaluador separado y escéptico rinde más que pedirle al generador que se juzgue; el «terminado» se acuerda ANTES de construir (sprint contract); el planificador no debe fijar detalle técnico. | https://www.anthropic.com/research/harness-design-long-running-apps | 24/03/2026 | abierta |
| Prompting best practices (docs de plataforma) | Explicar el porqué, instrucciones generales mejor que pasos prescritos, bajar el lenguaje agresivo en Opus 4.5+, estado en JSON + notas libres + git, avisarle que se compacta para que no corte antes. | https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices | s/f | abierta |
| Prompting Claude Fable 5.1 (docs de plataforma) | Trae un bloque literal para corridas sin supervisión («el usuario no mira, no preguntes "¿sigo?"»), uno de alcance, uno para qué conservar al compactar y uno de «editá quirúrgico, no reescribas todo». | https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5-1 | s/f (cita betas de ago/2026) | abierta |
| Best practices de Claude Code (docs) | «Dale un chequeo que pueda correr»; para corridas sin vos: `/goal` con evaluador aparte, Stop hook determinístico o subagente adversarial; CLAUDE.md corto. | https://code.claude.com/docs/en/best-practices | s/f | abierta |
| Claude Code best practices (blog viejo) | Recomienda afinar CLAUDE.md con «IMPORTANT»/«YOU MUST»; ya marcado como no mantenido. | https://www.anthropic.com/research/claude-code-best-practices | 18/04/2025 (movido 26/01/2026) | abierta |
| Effective context engineering (Anthropic) | Tres palancas para tareas largas: compactación, notas estructuradas fuera de la ventana, multiagente; cargar «justo a tiempo» por referencias. | https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents | 2025 (s/f exacta) | solo búsqueda |
| Evaluating AGENTS.md (ETH Zürich, arXiv 2602.11988) | Los archivos de contexto no mejoran en general el éxito y suben el costo más de 20 %; deben llevar solo lo que no está ya en el código. | https://arxiv.org/abs/2602.11988 | feb/2026 (por el ID) | solo búsqueda |
| Instruction Adherence in Coding Agent Configuration Files (McMillan, arXiv 2605.10039) | 1.650 sesiones: ni tamaño, posición, arquitectura ni contradicciones movieron el cumplimiento; sí cae a medida que la sesión genera más. | https://arxiv.org/pdf/2605.10039 | 11/05/2026 | solo búsqueda |
| Run long horizon tasks with Codex (OpenAI) | Una corrida de ~25 h salió de archivos durables: spec con «Done when», plan con hitos y comando de validación por hito, regla «si falla, reparar antes de seguir», notas de decisión. | https://developers.openai.com/blog/run-long-horizon-tasks-with-codex | s/f | solo búsqueda |
| Using PLANS.md for multi-hour problem solving (OpenAI cookbook) | Plan como documento vivo que el humano revisa antes de largar; hubo >7 h desde un solo prompt. | https://developers.openai.com/cookbook/articles/codex_exec_plans | s/f | solo búsqueda |
| Codex-maxxing for long-running work (OpenAI, white paper) | Meta débil = «implementá el plan»; meta fuerte = algo contra qué probar: comportamiento esperado, criterios de revisión, definición de terminado. | https://cdn.openai.com/pdf/8a9f00cf-d379-4e20-b06f-dd7ba5196a11/OAI_WhitePaper_Codex-maxxing26.pdf | s/f | solo búsqueda |
| anthropics/cwc-long-running-agents (GitHub) | Repo de Anthropic con las piezas de `/goal` (evaluador rápido aparte que revisa cada turno) como hooks y un subagente. | https://github.com/anthropics/cwc-long-running-agents | s/f (el buscador dice ~160 días); estrellas sin ver | solo búsqueda |
| Prompting Claude Opus 5 (resumen en daily.dev y blogs) | Opus 5 se auto-verifica: las órdenes de «chequeá de nuevo» heredadas hacen sobre-verificar; sí hay que fijar el alcance. | https://daily.dev/posts/qhbclckoe (el original oficial NO lo abrí) | jul/2026 | solo búsqueda |
| Guías de GEMINI.md (blogs y geminicli.com) | Repiten lo mismo que CLAUDE.md: corto, imports, jerarquía. Nada específico de corridas largas. | https://geminicli.com/docs/cli/tutorials/memory-management/ | s/f | solo búsqueda |

## Fuentes (título — link — fecha — abierta/solo búsqueda)

- Effective harnesses for long-running agents — https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents — 26/11/2025 — abierta
- Harness design for long-running application development — https://www.anthropic.com/research/harness-design-long-running-apps — 24/03/2026 — abierta
- Prompting best practices — https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices — s/f — abierta
- Prompting Claude Fable 5.1 — https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5-1 — s/f — abierta
- Best practices for Claude Code — https://code.claude.com/docs/en/best-practices — s/f — abierta
- Claude Code: Best practices for agentic coding (blog) — https://www.anthropic.com/research/claude-code-best-practices — 18/04/2025 — abierta
- Effective context engineering for AI agents — https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents — 2025 — solo búsqueda
- Evaluating AGENTS.md — https://arxiv.org/abs/2602.11988 — feb/2026 — solo búsqueda
- Instruction Adherence in Coding Agent Configuration Files — https://arxiv.org/pdf/2605.10039 — 11/05/2026 — solo búsqueda (reseñas: pith.science/paper/2605.10039)
- Run long horizon tasks with Codex — https://developers.openai.com/blog/run-long-horizon-tasks-with-codex — s/f — solo búsqueda
- Using PLANS.md for multi-hour problem solving — https://developers.openai.com/cookbook/articles/codex_exec_plans — s/f — solo búsqueda
- Codex-maxxing for long-running work — https://cdn.openai.com/pdf/8a9f00cf-d379-4e20-b06f-dd7ba5196a11/OAI_WhitePaper_Codex-maxxing26.pdf — s/f — solo búsqueda
- anthropics/cwc-long-running-agents — https://github.com/anthropics/cwc-long-running-agents — s/f — solo búsqueda
- Prompting Claude Opus 5 (resumen) — https://daily.dev/posts/qhbclckoe — jul/2026 — solo búsqueda (blog agregador, no oficial)
- Manage context and memory (Gemini CLI) — https://geminicli.com/docs/cli/tutorials/memory-management/ — s/f — solo búsqueda

## Lo que CONFIRMA lo que hace el sistema

Lo que sé del sistema: una skill con guía escrita, scripts y controles automáticos; el ingeniero corrige a mano lo que un diseñador ve solo.

- **Los controles automáticos son lo correcto.** Los docs de Claude Code dicen que sin un chequeo que la IA pueda correr, la señal es una sola: «Claude stops when the work looks done.» Y que un hook es determinístico mientras CLAUDE.md es consultivo ([best practices](https://code.claude.com/docs/en/best-practices), abierta). El Stop hook que bloquea el cierre hasta que pase el chequeo es el mecanismo oficial para corridas sin vos.
- **Que no se juzgue sola.** Anthropic midió que el generador alaba su propio trabajo aunque sea mediocre, sobre todo en diseño, y que separar al que hace del que juzga es la palanca fuerte ([harness design](https://www.anthropic.com/research/harness-design-long-running-apps), 24/03/2026, abierta). Explica la estética antes del mecanismo y las cajas «peladas» dadas por buenas.
- **Criterios gradables para lo subjetivo.** Esa misma nota convierte «¿es lindo?» en criterios concretos (calidad, originalidad, oficio, funcionalidad) que ven el generador y el evaluador. Es el camino de «criterio de diseñador» como lista de chequeo, no como adjetivos.
- **Poner el «terminado» antes de construir.** Anthropic lo llama sprint contract: se acuerda qué es hecho, con comportamientos probables, antes de escribir código (misma fuente). OpenAI llega a lo mismo: spec con «Done when», hitos con comando de validación y regla «si falla, reparar antes de seguir» ([OpenAI](https://developers.openai.com/blog/run-long-horizon-tasks-with-codex), solo búsqueda).
- **«Apuntale a lo que ya existe».** La guía de Claude Code recomienda señalar un patrón existente y seguirlo, en vez de pedir «hacé un widget» (docs, abierta). Es el caso de la palanca dibujada de cero.
- **Edición quirúrgica.** El doc de Fable 5.1 trae una línea para que no reescriba el archivo entero por un cambio chico ([Fable 5.1](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5-1), abierta). Habla de archivos de texto; para el modelo CAD la traducción a «cambiá el parámetro, no rehagas la pieza» es (opinión).
- **Archivos de estado + git, no memoria de la conversación.** Es la receta de Anthropic y de OpenAI: avance en archivo, commits, y arrancar cada ventana leyendo eso ([harnesses](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents), abierta).

## Lo que lo CONTRADICE o le pone en duda

1. **Prompt largo.** Los docs dicen que un CLAUDE.md largo hace que Claude ignore la mitad: «Bloated CLAUDE.md files cause Claude to ignore your actual instructions!» (docs, abierta). Pero el estudio más grande (1.650 sesiones, [McMillan, 11/05/2026](https://arxiv.org/pdf/2605.10039), solo búsqueda) no encontró efecto del tamaño ni de la posición ni de las contradicciones adyacentes. Ojo: medía una instrucción trivial (una anotación de una línea), en TypeScript, y figura «sin veredicto» en Pith. Las dos cosas pueden ser ciertas: la longitud no tapa una orden simple, pero el cumplimiento **cae a medida que la sesión genera más**. Lo que se desprende: no confiar en que la regla del prompt inicial siga viva a las 3 horas; hacerla chequeo.
2. **Contexto previo ≠ mejor.** ETH ([arXiv 2602.11988](https://arxiv.org/abs/2602.11988), solo búsqueda) halló que los archivos de contexto no mejoran en general el éxito y cuestan más de 20 % (hubo versión previa del resumen que decía «tienden a reducir»). Los escritos por personas dieron una ganancia marginal sin significancia. Conclusión de los autores: solo lo que no se deduce del código. Pega contra cargar todo el conocimiento de planta en el arranque. Límite: son tareas de corregir bugs en Python, no diseño.
3. **«IMPORTANT» no está prohibido.** La opinión de «las mayúsculas se ignoran» no sale tal cual de lo oficial. El blog viejo (18/04/2025) recomendaba subir adherencia con «IMPORTANT/YOU MUST»; los docs actuales de Claude Code dicen ponerlo en UNA línea, porque si enfatizás muchas ninguna destaca. La guía de modelos nuevos va en sentido opuesto: para Opus 4.5 y siguientes, «dial back any aggressive language» porque sobreactivan. El propio artículo de harness usa una frase fuerte para que no editen los tests. Fechas distintas, no hay medición controlada que decida (ver más abajo).
4. **«Verificá antes de declarar terminado» ya no es automático.** El doc oficial dice que Opus 5 se verifica solo y que esa orden heredada produce sobre-verificación (abierta, en la guía general; el detalle por modelo lo leí solo en resúmenes). Pero el artículo de harness dice lo contrario para tareas al borde: «Out of the box, Claude is a poor QA agent.» Se concilian así (opinión): sacar el «revisá de nuevo tu respuesta»; mantener un chequeo **externo y ejecutable** (render, medición, colisión), que no depende de que la IA se auto-juzgue.
5. **El evaluador aparte no siempre vale.** Con Opus 4.6 Anthropic sacó los sprints y puso el evaluador una sola vez al final; solo rinde cuando la tarea está al borde de lo que el modelo hace solo. Costó mucho: 20 min/$9 contra 6 h/$200 en su prueba. Tuvieron que afinarlo varias rondas leyendo sus logs.
6. **El planificador no debería detallar lo técnico.** Si falla un detalle del plan, el error se propaga (harness design). Choca con darle al agente la lista de pasos de diseño; mejor entregables y criterios.
7. **Preguntar vs decidir.** Fable 5.1 recomienda un bloque que prohíbe preguntar «¿sigo?» cuando el usuario no mira, y parar solo por destructivo o cambio de alcance. El mismo doc avisa que ese bloque puede hacerlo preguntar menos en pedidos ambiguos: probarlo (abierta).

## Lo que no se les había ocurrido

- **Lista de criterios en JSON que el agente no puede editar, solo marcar.** Anthropic usa `passes:false` por función y dice que JSON se pisa menos que Markdown. Acá: una lista de comprobaciones de diseño (el mecanismo completa su recorrido, cantos radiados, etc.). Dato clave de esa fuente: se la prohíbe editar con una frase fuerte.
- **Calibrar al evaluador con las correcciones del ingeniero.** El método de Anthropic: leer los logs del evaluador, buscar donde su juicio diverge del tuyo, y ajustar el prompt; además ejemplos con puntajes explicados. Las correcciones que Fak ya hizo («esto lastima», «esto ya existía») son ese material.
- **Ponderar al revés.** En su caso de frontend pesaron estética y originalidad más que oficio y funcionalidad, porque lo segundo salía bien solo. Para un mecanismo que debe funcionar es (opinión) lo contrario: funcionalidad primero. El orden de los criterios también empuja el resultado: una frase de un criterio terminó moldeando el estilo de todo lo generado.
- **Notas de decisión contra la oscilación.** OpenAI las lista en el plan (solo búsqueda). Evita que re-decida el mecanismo ya aprobado cuando después arregla la estética.
- **Primer prompt distinto del resto.** Una ventana inicial que arma la lista de comprobaciones y el archivo de avance, y ventanas siguientes que arrancan con «`pwd`, leé avance, leé lista, corré la prueba básica». Está en los docs (abierta).
- **Qué debe conservar la compactación.** El doc de Fable 5.1 trae un texto con seis cosas (decisiones, lo descartado y por qué, restricciones tal cual, estado actual, pendientes, datos difíciles de reconstruir). Sirve como `/compact` instrucciones.
- **Dos correcciones fallidas = empezar limpio.** Docs de Claude Code: tras dos correcciones del mismo error, `/clear` y prompt mejor.
- **Entrevista previa a largar.** Para quien no programa, se puede hacer que la IA lo entreviste y escriba una especificación, y ejecutarla en sesión nueva (docs). Choca con la regla de la casa de no llenarlo de preguntas: acotada a una vez (opinión).
- **Ansiedad de contexto.** Algunos modelos cierran antes por creer que se les acaba la ventana; la mitigación oficial es decirle que se compacta solo y que guarde el estado (guía general, abierta).

## Qué se buscó y no se encontró

- Nada de Google oficial sobre agentes largos; solo guías de GEMINI.md (blogs y la doc de memoria, solo búsqueda), que repiten lo de CLAUDE.md.
- Ninguna medición controlada de «IMPORTANT» o mayúsculas. Los blogs que dicen «salen peores» no citan datos; no los tomé.
- Nada sobre prompts para diseño mecánico autónomo (utillajes, CAD) en esta ronda.
- No pude abrir completos los dos papers ni el artículo de context engineering (tope de lecturas de la herramienta): los números salen de resúmenes y de reseñas de terceros. La página por modelo de Opus 5.5 tampoco.
- Ningún estudio que compare formatos de «definición de terminado».

## Veredicto para este frente

Cambiar primero lo que el consenso (Anthropic, OpenAI, los dos papers) más apoya: que el «terminado» sea una lista de comprobaciones ejecutables y externas, y que el agente no pueda aprobarse solo, con un evaluador o un Stop hook alimentado con las correcciones previas del ingeniero; y un arranque corto que fije resultado, orden (mecanismo antes que estética) y archivo de avance, con el bloque «no estoy mirando, no preguntes». Seguridad **media-alta** en la estructura (varias fuentes abiertas y coincidentes), **media-baja** en cuánto acortar el prompt o si conviene un evaluador aparte (evidencia mixta, estudios en otro dominio y sin abrir completos).