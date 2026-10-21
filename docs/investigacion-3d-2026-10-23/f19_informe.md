# Plantillas de prompts para trabajo autónomo largo y repetible: lo que hay afuera
Consultado el 20/10/2026.

## Qué hay
Cada fila: estructura · cómo lee solo lo pendiente · cómo fuerza la verificación. «Abierta» = la leí con web_fetch.

| Qué | Qué dice, en una frase | Fuente (link) | Fecha | Estado |
|---|---|---|---|---|
| `/goal` (docs oficiales de Claude Code) | Una condición (hasta 4.000 caracteres) con un estado final medible, la prueba y restricciones; tras cada turno un modelo chico (Haiku por defecto) decide si se cumple. Solo ve lo que Claude mostró en la conversación: no corre comandos. Se acota con una cláusula de turnos o tiempo. Anda también en modo no interactivo (opción `-p`). | https://code.claude.com/docs/en/goal | s/f (comando desde v2.1.139, 11/05/2026 según un blog) | abierta |
| Anthropic, «Effective harnesses for long-running agents» | Un prompt para la primera sesión (crea `init.sh`, `claude-progress.txt`, `feature_list.json` con `"passes": false`) y otro fijo para las siguientes: `pwd` → leer log de git y progreso → elegir la función pendiente de mayor prioridad → UNA por sesión → prueba de punta a punta → commit + nota de progreso. Usan JSON porque el modelo lo pisa menos que Markdown. | https://anthropic.com/engineering/effective-harnesses-for-long-running-agents | 26/11/2025 (modif. 18/10/2026) | abierta |
| Anthropic, «Harness design for long-running apps» | Planificador + generador + evaluador aparte; antes de cada tramo acuerdan un «contrato» de qué es «hecho»; el evaluador puntúa criterios con umbral duro y se calibra con ejemplos. Costo: 6 h y $200 contra 20 min y $9 de una sola pasada. | https://www.anthropic.com/research/harness-design-long-running-apps | 24/03/2026 | abierta |
| Geoffrey Huntley, «Ralph Wiggum as a software engineer» | Un `PROMPT.md` fijo en un bucle; cada vuelta carga siempre `specs/*` + `fix_plan.md`; «una cosa por vuelta», el agente elige la más importante; dos prompts (planificar / construir); las fallas se corrigen agregando «carteles» al prompt; el plan se tira seguido y se regenera. | https://ghuntley.com/ralph/ | 14/07/2025 (modif. 19/02/2026) | abierta |
| awesomeclaude.ai, guía y plantillas de Ralph (comunidad, no oficial) | Plantillas con criterios de terminado, fases, tope de iteraciones y «si a las 15 vueltas no sale: documentá bloqueos y alternativas»; sugiere `/goal`, `/loop`, `/batch` antes que el plugin. Marca los resultados como anécdotas del autor, no medidos. | https://awesomeclaude.ai/ralph-wiggum | 12/06/2026 | abierta |
| Plugin `ralph-loop` (Anthropic, `claude-plugins-official`) | Un Stop hook devuelve el mismo prompt hasta que aparece una frase de cierre exacta o se acaban las vueltas; el estado vive en `.claude/ralph-loop.local.md`. | https://github.com/anthropics/claude-plugins-official/tree/main/plugins/ralph-loop | repo 33.339 ★ (de todo el repo), actualizado 27/07/2026 (vía claudeskills.info) | solo búsqueda |
| `snarktank/ralph` | Bucle bash con instancia nueva por vuelta; memoria = git + `progress.txt` (solo se agrega; sección «Codebase Patterns» que se lee primero) + `prd.json` (historias con `passes`); toma la de mayor prioridad con `passes:false`, corre typecheck/tests, commitea solo si pasan. | https://github.com/snarktank/ralph | ~ene/2026 (índice: «hace 286 días»); estrellas no vistas | solo búsqueda |
| Best practices de Claude Code (docs oficiales) | «Dale a Claude una verificación que pueda correr»: tests, build, script que compara contra un archivo de referencia, captura de pantalla; sin eso lo único que hay es «parece terminado». | https://code.claude.com/docs/en/best-practices | s/f | solo búsqueda |
| Skills / comandos (docs oficiales y guías) | Los comandos `.claude/commands/x.md` se fusionaron con las skills; frontmatter `disable-model-invocation` (solo se dispara a mano), `arguments`, `context: fork`; `!comando` inyecta datos vivos antes de que Claude lea el prompt. | https://code.claude.com/docs/en/slash-commands · https://codewithmukesh.com/blog/skills-claude-code/ | s/f · ~jul/2026 | solo búsqueda |
| `earthtojake/text-to-cad`, `skills/cad/SKILL.md` | Skill de CAD con tabla «tarea → primera acción → referencia» y la orden «leé solo las referencias que pide el pedido»; después de cambiar geometría hay que generar y mirar una captura propia; «una cuenta fallida no es un pase»; el informe final lista controles corridos y requisitos sin probar. | https://github.com/earthtojake/text-to-cad/blob/main/skills/cad/SKILL.md | s/f (227 líneas); estrellas no vistas | abierta |
| `santiariza15/agentcad` | Flujo obligatorio: inspeccionar → especificar (requisitos medibles; en ediciones, qué cambia y qué geometría debe quedar igual) → construir lo mínimo → validar; si falla, volver a la etapa más temprana equivocada. | https://github.com/santiariza15/agentcad | s/f | solo búsqueda |
| `cyberchitta/cad-khana` (CLAUDE.md) | El agente declara «afirmaciones» (sin interferencia, distancia mínima, pared imprimible); la herramienta las chequea en cada corrida y reporta también qué se chequeó. | https://github.com/cyberchitta/cad-khana/blob/main/CLAUDE.md | ~oct/2026 (índice: «hace 15 días») | solo búsqueda |
| `pzfreo/build123d-mcp`, issue 127 | Propone un orden fijo: medir (caras, volumen) tras cada operación booleana antes de renderizar; los LLM renderizan primero y se saltan el control numérico. | https://github.com/pzfreo/build123d-mcp/issues/127 | ~may/2026 (índice) | solo búsqueda |
| `eschmitt88/agentic-3d-design` | Escalera de verificación: validez OCCT → imprimibilidad → revisión de imagen → FEA; dice que el bucle es lo que funciona y que una sola pasada anda mucho peor. | https://github.com/eschmitt88/agentic-3d-design | ~jun/2026 | solo búsqueda |
| arXiv 2602.11988, «Evaluating AGENTS.md» (Gloaguen et al.) | Los archivos de contexto no mejoran en general el éxito y suben el costo más de 20 %; las instrucciones se siguen; los resúmenes del repo no ayudan; sirven para prácticas no estándar. | https://arxiv.org/abs/2602.11988 | feb/2026 | solo búsqueda |
| arXiv 2607.27250, «Do Context Files Help Coding Agents?» | En 3 repos Python no detecta beneficio de corrección; los fallos son de habilidad de implementación, no de conocimiento del repo. | https://arxiv.org/pdf/2607.27250 | jul/2026 | solo búsqueda |

## Fuentes
1. Keep Claude working toward a goal — https://code.claude.com/docs/en/goal — s/f — abierta
2. Effective harnesses for long-running agents — https://anthropic.com/engineering/effective-harnesses-for-long-running-agents — 26/11/2025 — abierta
3. Harness design for long-running application development — https://www.anthropic.com/research/harness-design-long-running-apps — 24/03/2026 — abierta
4. Ralph Wiggum as a "software engineer" — https://ghuntley.com/ralph/ — 14/07/2025 — abierta
5. Ralph Wiggum Loop (Awesome Claude) — https://awesomeclaude.ai/ralph-wiggum — 12/06/2026 — abierta
6. ralph-loop plugin — https://github.com/anthropics/claude-plugins-official/tree/main/plugins/ralph-loop — 27/07/2026 — solo búsqueda
7. snarktank/ralph (y su CLAUDE.md y prompt.md) — https://github.com/snarktank/ralph — ~ene/2026 — solo búsqueda
8. Best practices for Claude Code — https://code.claude.com/docs/en/best-practices — s/f — solo búsqueda
9. Slash commands / skills — https://code.claude.com/docs/en/slash-commands — s/f — solo búsqueda
10. text-to-cad, skills/cad/SKILL.md — https://github.com/earthtojake/text-to-cad/blob/main/skills/cad/SKILL.md — s/f — abierta
11. agentcad — https://github.com/santiariza15/agentcad — s/f — solo búsqueda
12. cad-khana CLAUDE.md — https://github.com/cyberchitta/cad-khana/blob/main/CLAUDE.md — ~oct/2026 — solo búsqueda
13. build123d-mcp issue 127 — https://github.com/pzfreo/build123d-mcp/issues/127 — ~may/2026 — solo búsqueda
14. agentic-3d-design — https://github.com/eschmitt88/agentic-3d-design — ~jun/2026 — solo búsqueda
15. Evaluating AGENTS.md — https://arxiv.org/abs/2602.11988 — feb/2026 — solo búsqueda
16. Do Context Files Help Coding Agents? — https://arxiv.org/pdf/2607.27250 — jul/2026 — solo búsqueda
17. Blog sobre /goal (fecha de la versión) — https://inventivehq.com/blog/claude-code-goal-command-guide — s/f — solo búsqueda (blog)

## Lo que CONFIRMA lo que hace el sistema
- **Un prompt fijo que lee el estado desde archivos es el patrón dominante.** Anthropic (fuente 2) usa un prompt de arranque idéntico en cada sesión que lee `claude-progress.txt`, el log de git y una lista de funciones con `passes:false`. Huntley (4) lo llama «asignar la pila igual en cada vuelta»: el plan y las especificaciones se cargan siempre. `snarktank/ralph` (7) lo copia con `prd.json` y `progress.txt`.
- **«Leer solo lo pendiente» se logra con un archivo de estado con marca por ítem**, no con un resumen: «elegí el de mayor prioridad con `passes:false`». La skill de text-to-cad (10) agrega una segunda vía: una tabla «tarea → primera acción → referencia» y la orden de leer solo las referencias que el pedido necesita.
- **La verificación tiene que ser algo que el agente corre y cuyo resultado queda a la vista.** Docs oficiales (1, 8): sin un chequeo ejecutable, «parece terminado» es la única señal. Anthropic (2) midió que sin pedirlo expresamente el agente marca «hecho» sin prueba de punta a punta.
- **Una cosa por vuelta, cambio mínimo.** Huntley («one item per loop») y Anthropic coinciden. agentcad (11) lo baja a CAD: en una edición, declarar qué cambia y qué geometría debe quedar igual. Eso apunta directo a «rehacía el modelo entero en cada corrección».
- **Buscar antes de crear.** Huntley (4) lo tiene como cartel permanente: no asumir que algo no está implementado y buscar antes. Es el caso de la palanca que ya existía.
- **Orden de verificación: números antes que imagen.** build123d-mcp issue 127 (13) y la escalera de agentic-3d-design (14) ponen primero medir y validar y después renderizar. Coincide con tener controles automáticos y gates.
- **Un cartel por cada falla observada** (Huntley): cada corrección del ingeniero se vuelve una regla. Es lo que ya hace el sistema con las lecciones.

## Lo que lo CONTRADICE o le pone en duda
- **Más reglas escritas no es mejor.** El paper de feb/2026 (15) halló que los archivos de contexto no mejoran el éxito y suben el costo más de 20 %; los agentes sí obedecen, y por eso hacen más exploración y pruebas. Recomienda dejar solo lo mínimo y no estándar. Otro trabajo de jul/2026 (16) no detecta beneficio en 3 repos Python. Hay una fuente que dice lo contrario en eficiencia (Lulla et al. 2026, citada dentro de 16, no abierta): bajan tiempo y tokens. Si el sistema de skills y reglas del 3D es largo, esto es una alerta; la lista de «carteles» tiene que ser corta y podarse.
- **Ralph no es para criterio de diseño.** La guía comunitaria (5) lista «decisiones de diseño» y «éxito subjetivo» como casos donde NO usarlo, y Huntley (4) dice que no lo usaría en un código ya existente. Un utillaje con piezas reutilizables y estética es justo ese terreno. Anthropic (3) sí lo hace en diseño, pero con evaluador separado, criterios escritos y ejemplos calibrados, no con un bucle ciego.
- **El «terminado» autodeclarado no sirve.** Anthropic (3): los agentes elogian su propio trabajo aun siendo mediocre, sobre todo en diseño; el evaluador separado tampoco es neutro, hubo que afinarlo varias rondas leyendo sus logs. Y `/goal` (1) usa un modelo chico que solo lee la conversación: si el agente no pega la salida de los controles, el evaluador no la ve.
- **El andamiaje envejece y cuesta.** Anthropic (3): con un modelo nuevo se sacó la división en tramos; el evaluador solo vale la pena si la tarea supera lo que el modelo hace solo. 6 h y $200 contra 20 min y $9. Un ritual de viernes con evaluador aparte para todo es probablemente sobrecarga (opinión).
- **No hay prompt perfecto.** Huntley dice que el suyo evolucionó mirando el comportamiento y que copiarlo textual no da lo mismo. Una plantilla «que nunca se cambia» choca con esto: lo estable tendría que ser el esqueleto, no los criterios.
- **JSON vs. Markdown para la lista.** Anthropic prefiere JSON (el modelo lo pisa menos). Un resumen de la discusión (sitio beri.net, solo búsqueda) dice que en Hacker News se objetó que eso reinventa un gestor de tareas. Sin más fuente.

## Lo que no se les había ocurrido
1. **El ritual semanal es afinar el evaluador, no correr más trabajo.** Anthropic (3) describe el ciclo: leer los registros, hallar dónde su juicio difirió del del autor y corregir el prompt del evaluador. Traducido: cada viernes se miran las correcciones que el ingeniero tuvo que marcar y cada una pasa a ser un control, un criterio o una entrada del catálogo.
2. **Contrato de «hecho» antes de modelar**: criterios medibles escritos y acordados antes del primer trazo (Anthropic 3, agentcad 11).
3. **Criterios gradables para lo «subjetivo»**: Anthropic (3) convierte «¿es lindo?» en preguntas puntuables con umbral duro. Para cajas peladas o cantos que lastiman muchos criterios se pueden volver chequeos geométricos (radio mínimo de cantos, espesor de pared); el resto, una lista que el revisor puntúa (opinión).
4. **El informe final dice qué NO se probó** (text-to-cad 10; cad-khana 12: reporta también qué se chequeó). Evita el verde falso.
5. **Datos vivos dentro del comando**: el `!comando` de las skills (9) puede meter el estado actual en el prompt antes de que el agente lo lea; así lee solo lo pendiente sin depender de que obedezca. En Windows hay que verificar el intérprete (hay un campo `shell`).
6. **Dos modos con el mismo esqueleto**: «planificar» (regenera la lista y la tira si se desvía) y «construir» (Huntley 4).
7. **Tope de intentos con salida limpia**: tras N fallos, marcar bloqueado y documentar lo probado (5, `/goal` con cláusula de turnos).

## Qué se buscó y no se encontró
- Una plantilla publicada de «ritual semanal de mejora» como tal: solo hay ideas sueltas (afinar tras mirar fallas). Nada específico para CAD ni para alguien que no programa.
- Medición independiente de que un prompt fijo repetido rinda más que uno ad hoc. Los resultados de Ralph (5) son anécdotas del autor.
- Estrellas de `snarktank/ralph` y de text-to-cad: la página no las mostró. No abrí la skill `autonomous-coding` de claude-quickstarts ni el artículo del compilador en C de Anthropic.
- La investigación previa del 17/10 no cubría este frente; no repetí nada de ella.

## Veredicto para este frente
Lo más urgente es lo que el sistema tiene a medias: un archivo de estado con una prueba por pendiente y un evaluador que mira evidencia pegada, no la palabra del agente. El prompt fijo es la parte barata; lo que lo hace servir es que cada corrección del ingeniero termine como control o criterio chico. Seguridad **media-alta** en el patrón (estado en archivos, uno por vuelta, evidencia obligatoria: fuentes oficiales y de varios autores coinciden); **baja** en que un prompt idéntico para siempre rinda bien en diseño de utillajes, porque nadie lo midió y hay dos fuentes que lo ponen en duda (5, 15).

## Estructura recomendada del prompt de los viernes (opinión)
Una skill de invocación manual (`disable-model-invocation`), de menos de 15 renglones, que apunta a archivos que el sistema mantiene:

**Archivos** (el sistema los actualiza; el prompt no cambia):
- `PENDIENTES.json`: por ítem, `id`, qué, `estado` (pendiente/hecho/bloqueado), `prueba` (medible), `evidencia` (ruta de la salida pegada).
- `CRITERIOS.md`: corto, solo lo que el agente erró antes (mecanismo antes que estética, reusar lo existente, cantos, cajas con detalle).
- `CORRECCIONES.md`: lo que el ingeniero tuvo que marcar, con fecha.
- `AVANCE.md`: se agrega, nunca se reemplaza; arriba, una sección «señales» corta.
- `CATALOGO.md`: piezas ya hechas y probadas.

**Esqueleto del prompt:**
1. Leé las últimas 30 líneas de AVANCE.md, CRITERIOS.md y solo los ítems de PENDIENTES.json que no están «hecho».
2. Convertí cada entrada nueva de CORRECCIONES.md en una propuesta: control, criterio o ítem de catálogo. Proponé, no apliques.
3. Elegí UN pendiente. Antes de modelar, buscá en CATALOGO.md y en el repo si ya existe.
4. Si no tiene `prueba` medible, escribila antes de tocar nada.
5. Cambio mínimo sobre el modelo existente; la prueba de movimiento tiene que pasar antes de cualquier trabajo de forma.
6. Corré los controles y pegá la salida; mirá tu propia captura. Un control no corrido o fallido no es un pase.
7. Si pasa: estado «hecho» con evidencia y una línea en AVANCE.md. Si falla 3 veces: «bloqueado» con lo probado, y seguí con el siguiente.
8. Cerrá con: hecho (con evidencia), bloqueado, no probado, y qué necesito del ingeniero. Parar a las N horas o M pasos.

Para correrlo sin supervisión, envolverlo en `/goal`: «ningún ítem queda pendiente sin evidencia, o 40 turnos», y que el último paso imprima un resumen del estado para que el evaluador lo vea. Una revisión con criterios aparte (subagente con contexto limpio) solo para lo estético, no para todo.