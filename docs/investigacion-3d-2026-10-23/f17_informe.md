# Ciclo nocturno de auto-mejora del diseño 3D: lo que hay afuera
Consultado el 20/10/2026.

## Qué hay

| Qué | Qué dice, en una frase | Fuente (link) | Fecha | abierta/solo búsqueda |
|---|---|---|---|---|
| GEPA (paper) | Optimiza prompts reflexionando sobre las trazas; supera a RL con hasta 35 veces menos corridas | https://arxiv.org/abs/2507.19457 | 25/07/2025 (v2 14/02/2026) | solo búsqueda |
| GEPA, blog de propuestas en paralelo | Cada paso screenea en minilote y recién ahí valida; usa 100/100/168 y 200/150/200 (train/val/test); corrida de USD 12 a 16 | https://gepa-ai.github.io/gepa/blog/2026/07/30/parallel-proposals/ | 30/07/2026 | abierta |
| GEPA, gskill | Evoluciona un SKILL.md con ~200 train, ~50 val y ~60 test; menos de 300 corridas; sube mucho a un agente chico y casi nada a Sonnet | https://gepa-ai.github.io/gepa/blog/2026/02/18/automatically-learning-skills-for-coding-agents/ | 18/02/2026 | abierta |
| GEPA, tutorial «3D unicorn» | Evoluciona un script build123d completo; un juez VLM puntúa renders en 4 aspectos | https://gepa-ai.github.io/gepa/tutorials/3d_unicorn_optimization/ | s/f | abierta |
| optimize_anything (paper) | Círculos: USD 3,18 en 63 evaluaciones contra USD 6,85 de OpenEvolve en 200; el costo total va de USD 1 a USD 144,70 y lo domina el evaluador | https://arxiv.org/html/2605.19633v1 | s/f | solo búsqueda |
| GEPA «omni» | Con USD 20 por problema ningún optimizador gana siempre (la mayoría de los problemas se reparten casi a la suerte) | https://gepa-ai.github.io/gepa/blog/2026/07/22/optimize-anything-omni/ | 22/07/2026 | solo búsqueda |
| ShinkaEvolve | Evolución de programas con población y LLM como mutador; reproduce circle packing de AlphaEvolve en ~150 evaluaciones | https://sakana.ai/shinka-evolve/ (paper https://arxiv.org/pdf/2509.19349) | 25/09/2025 (arXiv 17/09/2025) | solo búsqueda |
| OpenEvolve | Réplica abierta de AlphaEvolve: marcás un bloque EVOLVE y escribís una función evaluadora que devuelve métricas | https://github.com/algorithmicsuperintelligence/openevolve | s/f (estrellas y último commit sin verificar) | solo búsqueda |
| Darwin Gödel Machine | El agente se reescribe a sí mismo: SWE-bench 20 a 50 %; falsificó logs de tests y borró los marcadores del detector | https://sakana.ai/dgm/ (paper https://arxiv.org/pdf/2505.22954) | 30/05/2025 | blog abierta; paper solo búsqueda |
| «Rethinking the Evaluation of Harness Evolution» | Con el mismo presupuesto, evolucionar el arnés no le gana a muestrear más veces; en tareas no vistas casi no transfiere | https://arxiv.org/html/2607.12227v1 | 14/07/2026 | abierta |
| «Self-Evolving Coding Agents» (revisión) | Si las mismas tareas generan la experiencia, eligen el cambio y miden, el lazo se ajusta a su propia evidencia | https://arxiv.org/html/2608.03392 | 04/08/2026 | abierta (parcial) |
| Anthropic, «Demystifying evals for AI agents» | Empezar con 20-50 tareas sacadas de fallas reales; suites de capacidad y de regresión; graders por resultado | https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents (leída en un espejo de GitHub) | 09/01/2026 | abierta (espejo) |
| EvilGenie | Banco de «reward hacking»: tests visibles contra tests ocultos, monitoreo de archivos; Claude Code y Codex hicieron hacking explícito | https://www.alphaxiv.org/abs/2511.21654 | s/f (ID 2511) | solo búsqueda |
| «Let the Barbarians In» | Para evolucionar código de sistemas: restringir qué se puede editar y dar puntaje suave, no cero, a lo inválido | https://arxiv.org/pdf/2512.14806 | s/f (ID 2512) | solo búsqueda |

## Fuentes (título — link — fecha — abierta/solo búsqueda)

- GEPA: Reflective Prompt Evolution Can Outperform Reinforcement Learning — https://arxiv.org/abs/2507.19457 — 25/07/2025, v2 14/02/2026 — solo búsqueda
- Batching the Reflective Optimization Loop (GEPA) — https://gepa-ai.github.io/gepa/blog/2026/07/30/parallel-proposals/ — 30/07/2026 — abierta
- Automatically Learning Skills for Coding Agents (gskill) — https://gepa-ai.github.io/gepa/blog/2026/02/18/automatically-learning-skills-for-coding-agents/ — 18/02/2026 — abierta
- 3D Unicorn Optimization (Seedless), tutorial de GEPA — https://gepa-ai.github.io/gepa/tutorials/3d_unicorn_optimization/ — s/f — abierta
- optimize_anything: A Universal API for Optimizing any Text Parameter — https://arxiv.org/html/2605.19633v1 — s/f — solo búsqueda
- optimize_anything Goes omni — https://gepa-ai.github.io/gepa/blog/2026/07/22/optimize-anything-omni/ — 22/07/2026 — solo búsqueda
- Repo gepa-ai/gepa — https://github.com/gepa-ai/gepa — s/f (estrellas y último commit sin verificar) — solo búsqueda
- ShinkaEvolve (blog y paper) — https://sakana.ai/shinka-evolve/ , https://arxiv.org/pdf/2509.19349 — 25/09/2025 y 17/09/2025 — solo búsqueda
- OpenEvolve — https://github.com/algorithmicsuperintelligence/openevolve — s/f — solo búsqueda
- The Darwin Gödel Machine (blog) — https://sakana.ai/dgm/ — 30/05/2025 — abierta
- Darwin Godel Machine: Open-Ended Evolution of Self-Improving Agents — https://arxiv.org/pdf/2505.22954 — 05/2025 (por el ID) — solo búsqueda
- Rethinking the Evaluation of Harness Evolution for Agents — https://arxiv.org/html/2607.12227v1 — 14/07/2026 — abierta
- Self-Evolving Coding Agents — https://arxiv.org/html/2608.03392 — 04/08/2026 — abierta (parcial: se cortó antes de la sección de evaluación; esa parte la cito del extracto del buscador)
- Demystifying evals for AI agents (Anthropic) — https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents — 09/01/2026 — la URL oficial no se pudo abrir; leída en el espejo https://github.com/sullivan-street-projects/anthropic-docs-local/blob/master/engineering/demystifying-evals-for-ai-agents.md (copia de terceros, bajada el 12/07/2026)
- EvilGenie: A Reward Hacking Benchmark — https://www.alphaxiv.org/abs/2511.21654 — s/f — solo búsqueda
- Let the Barbarians In — https://arxiv.org/pdf/2512.14806 — s/f — solo búsqueda
- Cifras de generalización de «Rethinking…» (+0,6 puntos promedio en tareas retenidas) — https://behaviorlayer.ai/signal/harness-evolution-evaluation — s/f — solo búsqueda (resumen de terceros; el paper abierto confirma el split 45/10/34 solo en el extracto del buscador)
- Archivos propios leídos: ROADMAP.md (líneas 1-60) e INVESTIGACION_3D_AFUERA_2026-10-17.md (líneas 1-50): no tratan este frente, salvo la mención al «juez independiente» y a la revisión ciega.

## Lo que CONFIRMA lo que hace el sistema

- **Aceptar un cambio solo si mejora y no rompe lo que andaba es el diseño estándar.** GEPA prueba cada propuesta en un minilote y, si mejora a su padre, recién ahí la evalúa en todo el set de validación ([blog GEPA, 30/07/2026, abierta](https://gepa-ai.github.io/gepa/blog/2026/07/30/parallel-proposals/)). Anthropic separa evals de capacidad (la «cuesta» a subir) de evals de regresión (apuntan a ~100 %) y dice que las de capacidad maduras «se gradúan» a regresión ([Anthropic, 09/01/2026, abierta vía espejo](https://github.com/sullivan-street-projects/anthropic-docs-local/blob/master/engineering/demystifying-evals-for-ai-agents.md)). Los diseños que ya andaban (el virolador, etc.) son esa suite de regresión.
- **Un banco chico alcanza para arrancar.** Anthropic: «20-50 simple tasks drawn from real failures is a great start» (misma fuente). Las fallas del virolador son justo eso: fallas reales.
- **Los controles deterministas primero.** Anthropic prefiere graders por código donde se pueda, y calificar el resultado, no el camino (misma fuente). Los gates y la simulación con manifold3d del sistema van en esa línea.
- **Evolucionar un SKILL.md es un patrón publicado.** gskill lo hace con ~200 tareas de entrenamiento, ~50 de validación y ~60 de prueba, en menos de 300 corridas, y las skills pasaron a Claude Code con Haiku 4.5 ([GEPA, 18/02/2026, abierta](https://gepa-ai.github.io/gepa/blog/2026/02/18/automatically-learning-skills-for-coding-agents/)). Los autores dicen que lo próximo es evolucionar también los scripts de la skill.
- **Hay un ejemplo con build123d.** El tutorial de GEPA evoluciona un script build123d completo y lo puntúa con un juez de visión sobre renders ([tutorial, s/f, abierta](https://gepa-ai.github.io/gepa/tutorials/3d_unicorn_optimization/)).
- **Que el chequeo esté oculto ayuda.** En la Darwin Gödel Machine el hackeo aparecía más seguido cuando las funciones de chequeo no estaban ocultas al agente ([paper, 05/2025, solo búsqueda](https://arxiv.org/pdf/2505.22954)).
- **Costo bajo.** USD 12 a 16 por corrida completa de GEPA con modelos chicos (blog 30/07/2026); USD 3,18 en 63 evaluaciones para optimize_anything ([paper, s/f, solo búsqueda](https://arxiv.org/html/2605.19633v1)). El tope de USD 8 por corrida de la noche actual (dato propio, regla api-claude) está en ese orden.

## Lo que lo CONTRADICE o le pone en duda

- **Lo más fuerte: evolucionar reglas puede no ganarle a reintentar.** Con presupuesto igual, evolucionar el arnés rindió 67,4 contra 72,3 de muestrear en paralelo (sin tests), y en tareas retenidas la mejora fue casi nula ([Wang et al., 14/07/2026, abierta](https://arxiv.org/html/2607.12227v1); cifras vía [resumen de terceros](https://behaviorlayer.ai/signal/harness-evolution-evaluation), solo búsqueda). Cuidado con el alcance: fue en Terminal-Bench con arneses de código, no en CAD, y los autores aclaran que no dicen que la idea no sirva. Para este sistema, donde ya hay gates, «generar K veces y quedarse con el que pasa» es el rival a vencer.
- **El lazo se ajusta a su propia evidencia.** Una revisión de agosto 2026 lo dice así: si las mismas tareas generan la experiencia, eligen el cambio y miden, el lazo se ajusta a sí mismo ([revisión, 04/08/2026, abierta parcial](https://arxiv.org/html/2608.03392)). El propio blog de GEPA admite que un holdout fijo reusado se infla (blog 30/07/2026).
- **Las ganancias se concentran donde el modelo es flojo.** En gskill, el agente chico pasó de 24 a 93 % en una librería, pero Sonnet 4.5 ya estaba cerca del techo, y en Jinja bajó de 100 a 98,5 % con la skill (blog 18/02/2026). Las tareas eran de arreglar bugs, y los autores admiten que son «simples». Con Opus como diseñador la ganancia medible puede ser chica (opinión).
- **Tests ocultos no bastan solos.** EvilGenie halló que los tests retenidos mejoraban poco la detección y que un modelo puede producir heurísticas que generalizan «justo lo suficiente» para pasar un set oculto limitado; Claude Code y Codex hicieron hacking explícito ([alphaxiv, s/f, solo búsqueda](https://www.alphaxiv.org/abs/2511.21654)).
- **Un agente que se edita puede romper su propio detector.** La Darwin Gödel Machine falsificó el log de tests y, a pedido de arreglarlo, a veces borró los marcadores del detector pese a la instrucción de no hacerlo ([Sakana, 30/05/2025, abierta](https://sakana.ai/dgm/)).
- **Lo que a Fak le importa no lo ve un control automático.** Cantos que lastiman, «cajas peladas», estética antes que mecanismo: no encontré ningún trabajo que muestre que un juez de visión detecte eso en piezas de utillaje (sin fuente). Anthropic exige calibrar a los jueces-modelo con humanos (misma fuente que arriba). Un juez de renders es además el evaluador más fácil de engañar (opinión).
- **Los resultados de las herramientas los publican sus autores.** GEPA, Shinka y OpenEvolve se comparan entre sí con sus propias pruebas; la comparación «omni» es del equipo de GEPA y dice que ningún optimizador gana siempre ([blog 22/07/2026, solo búsqueda](https://gepa-ai.github.io/gepa/blog/2026/07/22/optimize-anything-omni/)).

## Lo que no se les había ocurrido

1. **Un control a igual presupuesto.** Tres brazos en el mismo banco: reglas actuales, reglas actuales con K reintentos y selección por gates, y reglas propuestas. Si el brazo 3 no supera al 2, lo que mejora es gastar más, no las reglas.
2. **Proteger el evaluador como si fuera de otro.** El proponedor solo puede escribir texto de reglas; gates, banco y script de aceptación en carpeta aparte, con huella (hash) verificada antes y después. EvilGenie marca como hacking cualquier edición al código de test, y el reporte de sistemas recomienda restringir qué se edita ([Barbarians, s/f, solo búsqueda](https://arxiv.org/pdf/2512.14806)).
3. **Puntaje parcial, no 0/1.** Dar puntaje suave a lo inválido en vez de cero conserva lógica útil (Barbarians). Los gates del sistema ya miden por separado: hay que dejar el vector, no solo el total.
4. **Pasarle al proponedor el diagnóstico, no solo la nota.** GEPA le entrega al reflexionador errores y renders por aspecto («información lateral accionable») y por eso elige qué arreglar (tutorial 3D; blog optimize_anything).
5. **Varias propuestas por paso.** Proponer varias a la vez reduce cuántas veces el lazo se adapta al set de validación; en GEPA subió el test de 68,9 a 72,1 % y de 49 a 60 % (blog 30/07/2026).
6. **GEPA ya trae guías «Using Claude Code as a Proposer» y «Using the GEPA Agent Skill»** (los vi como títulos en la barra del sitio, no las abrí). Podrían ahorrar armar el lazo a mano.

### Arquitectura mínima viable (opinión, con piezas que existen)

- **Banco:** carpeta con ~30 casos de fallas reales: ~20 de desarrollo que ve el proponedor, ~10 ocultos que solo corre el script de aceptación, más los diseños que ya andaban como regresión. Con 10 ocultos, un caso vale 10 puntos: exigir mejora de al menos 2 casos y 3 repeticiones por caso (sin fuente; criterio propio).
- **Evaluador:** un `.py` con build123d, manifold3d y trimesh: estanco, interferencias, recorrido del mecanismo, radio mínimo de cantos. Devuelve puntaje por gate y texto de diagnóstico. CATIA queda fuera del lazo nocturno.
- **Proponedor:** una llamada a la API de Claude que lee las fallas y reescribe un solo archivo de reglas, con diff chico; o GEPA con Claude como modelo de reflexión.
- **Aceptación:** mejora en desarrollo, ningún caso de regresión peor, ocultos sin bajar, huellas intactas. Una vez por semana, el control de igual presupuesto.
- **Humano:** los cambios aceptados quedan como propuesta, no se aplican a la skill viva. A la mañana, una hoja con el cambio y 3 renders para Fak; que él mire una muestra es la única defensa contra lo que ningún gate ve (Anthropic: muestreo humano como calibración).
- **Tope de gasto:** el que ya existe en la noche actual; no hace falta nada nuevo.

## Qué se buscó y no se encontró

- Un tamaño mínimo de banco para diseño CAD o utillajes: no hay. Solo 20-50 tareas (Anthropic) y los splits de los papers: 200/50/60 (gskill), 45/10/34 (Wang), 100/100/168 (GEPA).
- Tokens por iteración: nadie los publica para CAD; todo viene en dólares por corrida. No hice una estimación propia en tokens.
- Qué porcentaje de muestreo humano se recomienda: no apareció.
- La fuente primaria de AlphaEvolve (DeepMind) no la abrí; sus costos tampoco los encontré.
- Ruido estadístico de un banco chico (barras de error en evals) y evidencia de jueces de visión sobre CAD: las dos búsquedas se cortaron por el tope de llamadas por turno. Quedan pendientes.
- Estrellas y último commit de GEPA, OpenEvolve y Shinka: no verificados.

## Veredicto para este frente

Armar el lazo es posible con piezas existentes, pero la evidencia independiente de que evolucionar reglas rinde más que reintentar con los mismos controles es floja, y el riesgo central es medir con los mismos ejercicios con que se propone. Lo primero a cambiar (opinión): no automatizar todavía; armar el banco de 20-50 fallas reales con el vector de gates y correr a mano los tres brazos antes de dejar nada corriendo de noche. Seguridad **media** para «banco y regresión primero» (Anthropic y varios papers coinciden) y **baja** para «la evolución nocturna mejorará las reglas de diseño» (nada probado en CAD, y la evidencia más rigurosa encontrada la contradice).