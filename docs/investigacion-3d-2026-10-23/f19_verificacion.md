# Verificación: Plantillas publicadas de prompts para trabajo autónomo largo y repetible

Verificado el 21/10/2026. «Abierta» = la leí entera con lectura web. Tope del turno: 5 lecturas web y 9 búsquedas. Por eso las filas 7 y 8 se verificaron con el texto de la propia página que apareció en la búsqueda, y no las abrí.

## Afirmaciones clave
| # | Afirmación (corta) | Fuente (link) | Abierta | Veredicto | Cita textual |
|---|---|---|---|---|---|
| 1 | `/goal`: después de cada turno un modelo chico juzga la condición. No corre comandos: solo ve lo que quedó en la conversación. Acepta hasta 4.000 caracteres y una cláusula de turnos, y anda con `-p` | https://code.claude.com/docs/en/goal | sí | confirmada. Matiz: «Haiku por defecto» es el «small fast model» configurable. Si pasan varios turnos sin uso de herramientas, corta el bucle | "It doesn't run commands or read files independently" |
| 2 | Anthropic: lista JSON con `passes:false`, una función por sesión, arranque fijo (pwd → git log → progreso). Sin pedido explícito, el agente marca «hecho» sin prueba de punta a punta | https://anthropic.com/engineering/effective-harnesses-for-long-running-agents | sí | confirmada, con una condición que el informe no dice: los autores aclaran que está optimizado para apps web full-stack | "less likely to inappropriately change or overwrite JSON files" |
| 3 | Anthropic: los agentes elogian su propio trabajo, sobre todo en diseño. El evaluador separado hubo que afinarlo varias rondas | https://www.anthropic.com/research/harness-design-long-running-apps | sí | confirmada | "Out of the box, Claude is a poor QA agent." |
| 4 | Anthropic: 6 h y USD 200 contra 20 min y USD 9. El evaluador solo vale si la tarea supera al modelo. Con Opus 4.6 se sacó la división en tramos | misma | sí | confirmada. Falta un dato: la versión 2 costó 3 h 50 min y USD 124,70 | "the task sits beyond what the current model does reliably solo" |
| 5 | Huntley: una cosa por vuelta, buscar antes de crear y no usarlo en código existente | https://ghuntley.com/ralph/ | sí | parcial. Lo dice, pero su prompt actual pide «the most important 10 things», usa cientos de subagentes y él mismo dice que la regla se relaja | "There's no way in heck would I use Ralph in an existing code base" |
| 6 | Skills: `!comando` mete datos vivos antes de que Claude lea, `disable-model-invocation` la deja solo manual y hay un campo `shell` (PowerShell en Windows) | https://code.claude.com/docs/en/skills | sí | confirmada con condiciones: el `!` no corre en skills sincronizadas desde claude.ai, en Cowork ni con `disableSkillShellExecution`. Las sesiones en la nube no leen `~/.claude/skills` | "replaces the line with its output before Claude sees the skill content" |
| 7 | Guía comunitaria de Ralph: no usarlo para decisiones de diseño ni éxito subjetivo | https://awesomeclaude.ai/ralph-wiggum | no (texto de la página en la búsqueda) | confirmada. Lo mismo dicen otras cuatro guías de la comunidad (atcyrus, dev.to, apidog, sidbharath) | "Tasks requiring human judgment or design decisions" |
| 8 | arXiv 2602.11988: los archivos de contexto no mejoran el éxito y suben el costo más de 20 %. Sirven para prácticas no estándar | https://arxiv.org/abs/2602.11988 | no (resumen de arXiv en la búsqueda) | confirmada, pero el estudio es más chico de lo que sugiere el informe. Mide arreglos de bugs en repos Python (SWE-bench más 138 tareas de 12 repos), con resúmenes del repo: no mide criterios de dominio ni tareas largas. En la v1, los archivos escritos por desarrolladores daban +4 % y los generados por modelo, −3 % | "does not generally improve task success rates, while increasing inference cost by over 20%" |

No pude verificar, por el tope de lecturas, las filas de CAD del informe: agentcad, cad-khana, issue 127 de build123d-mcp, agentic-3d-design («una sola pasada anda mucho peor») y la frase de text-to-cad. Tampoco las best practices ni arXiv 2607.27250. De este último solo vi que existe: otro paper (arXiv 2608.13867) lo lista como «Null or conflicting result». El propio informe ya las marcaba «solo búsqueda»: son justo las que bajan el patrón a CAD.

## Evidencia en contra
- **El bucle mejora el puntaje parcial, pero casi no logra pasar una tarea de ingeniería entera.** El benchmark Hephaestus-CCX (https://arxiv.org/html/2605.17448v2) probó Claude Code y Codex. En 400 primeros intentos no hubo ni una pieza que pasara el control estricto, y una ronda de retroalimentación con FEA agregó un solo pase en otros 400. Alargar el bucle (de 10 a 70 min por pieza) sube el puntaje parcial, no el pase completo. Esto pone en duda envolver el ritual en `/goal` hasta que «ningún ítem quede pendiente»: es probable que se agoten las vueltas o se repase la pieza de más.
- **«Números antes que imagen» no está zanjado.** En CADDesigner (https://arxiv.org/html/2508.01031), sacar la retroalimentación visual fue lo que más bajó la coincidencia con la geometría pedida (IoU). ReliCAD (https://arxiv.org/pdf/2609.22325) dice lo contrario: el render y la consistencia visual verifican poco la intención de diseño. Hacen falta las dos cosas; no es una secuencia.
- **`/goal` tiene fallas abiertas en GitHub:**
  - #93744: el evaluador no ve la condición y termina declarándola imposible (falla reproducida).
  - #66448: el evaluador tiene un tope fijo de unos 30 s y por eso es «unreliable for abstract or long-context goals».
  - #94057: en sesiones largas, el evaluador falla sin dar veredicto y vuelve a dispararse en cada turno.
  - allaboard #113: el evaluador dio por cumplida una meta de 3 turnos después de 2.

  La meta que propone el informe («ningún ítem pendiente sin evidencia, o 40 turnos») es justo una meta abstracta y larga.
- **El tope de vueltas no controla la calidad.** agentpatterns.ai (https://www.agentpatterns.ai/loop-engineering/ralph-wiggum-loop/) dice que el tope frena el gasto pero no la calidad, y que el agente puede repasar de más y destruir lo hecho. También dice que la coherencia del diseño sufre. Leanware estima USD 50 a 100 o más por 50 vueltas.
- **Más vueltas no siempre es mejor en lo estético.** El mismo autor de Anthropic cuenta que seguido prefería una iteración del medio antes que la última. Y como Claude no oye, el bucle sirvió menos para juzgar el gusto musical. En CAD, el equivalente es el juicio visual.
- Huntley: su técnica es para proyectos nuevos y espera llegar a un 90 %. El sistema del ingeniero trabaja sobre piezas que ya existen.
- No encontré estudios que midan un «ritual semanal» de mejora de prompts. Busqué críticas a Ralph, issues de `/goal`, benchmarks de CAD con bucles y estudios de archivos de contexto. Tampoco encontré nada sobre fallas del plugin `ralph-loop` en Windows (una guía menciona que depende de jq): queda sin verificar.

## Lo que le falta al informe
1. Un Stop hook con un script propio es más confiable que el evaluador por modelo. La doc de `/goal` dice que un Stop hook «can run a script for deterministic checks». Ese script puede leer `PENDIENTES.json` sin depender del tope de 30 s ni de lo que el agente pegó en la conversación.
2. Evidencia medida en CAD: Hephaestus-CCX y CADDesigner (arriba). Todo lo de CAD en el informe son repos de GitHub sin mediciones.
3. Costo por corrida: el informe no lo estima. Referencias: Anthropic gastó USD 124,70 y casi 4 h en su versión 2, y 50 vueltas de Ralph cuestan USD 50 a 100 o más.
4. Hay herramientas oficiales para podar reglas: `/doctor prompt-audit` busca instrucciones viejas o contradictorias en CLAUDE.md y skills, y `/verify` con `/run-skill-generator` dejan grabada la receta de verificación (https://code.claude.com/docs/en/skills).
5. Si el ritual corre agendado en la nube, no lee las skills personales y el `!comando` puede no correr (fila 6).

## Confianza del informe (alta/media/baja) y por qué, en 2 frases
Media. Las fuentes centrales (docs de `/goal` y de skills, los dos posts de Anthropic, Huntley) dicen lo que el informe dice, con matices menores. Pero lo de CAD y los dos papers no los abrió nadie, y el informe omite la evidencia medida en CAD y las fallas conocidas de `/goal`, que pegan justo en su recomendación de «envolverlo en `/goal`».
