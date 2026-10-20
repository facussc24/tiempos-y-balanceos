# Que el sistema aprenda de un diseño al siguiente: lo que hay afuera
Consultado el 20/10/2026.

Nota: en este archivo cada fuente lleva un código (F1, F2…) con su link en «Fuentes»; en `informe_2.md` las cito por ese código.

## Qué hay

| Qué | Qué dice, en una frase | Fuente | Fecha | Estado |
|---|---|---|---|---|
| Evals de agentes (Anthropic) | Armar 20-50 tareas de fallas reales, graders de código antes que LLM, leer transcripts, la suite es un artefacto vivo con dueño | F1 | 9/1/2026 (mod. 18/10/2026) | abierta (corrida anterior) |
| Buenas prácticas de skills (Anthropic) | Evals ANTES de documentar, medir contra «sin skill», skill corta, scripts hechos antes que código generado | F2 | s/f | abierta |
| Contexto permanente (AGENTS.md) | Archivos de contexto no mejoran el éxito y suben el costo >20 %; sirven para lo «no estándar» | F3 | 12/2/2026 (v3 29/9/2026) | abierta |
| SkillsBench | Skills curadas +16 pp; las autogeneradas −1,3 pp; 2-3 skills rinden más que 4+ | F4 | feb 2026 | solo búsqueda |
| Agentes CAD con feedback (Son et al.) | Primeros intentos: 0 de 400 pasan estricto; el lazo con medición externa sube de 38,8 % a 60,5 % | F5 | 27/5/2026 | abierta |
| CADSmith | Validar con el kernel OpenCASCADE (medidas exactas) bajó la distancia Chamfer de 28,37 a 0,74 | F6 | mar 2026 | solo búsqueda |
| Autocorrección sin feedback externo | No mejora y a veces empeora | F7 | 2023 (ICLR 2024) | solo búsqueda |
| Self-Refine | Feedback específico rinde más que genérico o ninguno; en matemática casi no ayuda | F8 | mar 2023 | solo búsqueda |
| Reflexion | Sube HumanEval a 91 % con tests; sin evaluador confiable no hay mejora | F9 | mar 2023 | solo búsqueda |
| Voyager | Biblioteca de código ejecutable; solo guarda lo que el entorno verificó | F10 | may 2023 | solo búsqueda |
| Memoria que crece (experience-following) | Guardar todo degrada (13 % vs 38,5 % con admisión estricta) | F11 | 2025 (ACL 2026) | solo búsqueda |
| ACE (contexto que evoluciona) | Reescribir todo el contexto lo colapsa; mejor deltas con ID | F12 | oct 2025 | solo búsqueda |
| Reglas acumuladas desde revisiones humanas | Cada corrección aceptada → regla con ID; 0 reincidencias en 9 clases | F13 | jul 2026 | abierta (corrida anterior) |
| LLM como juez | >80 % de acuerdo con humanos, pero sesgo de posición, longitud y auto-preferencia | F14 | jun 2023 | solo búsqueda |
| Lecciones aprendidas NASA | No se consultan; 23 % de gerentes cargó algo; la solución es meterlas en estándares | F15 | 2001-2002 | solo búsqueda |
| Design rationale (Regli) | Pocos sistemas llegaron a uso industrial; la captura cuesta y no da beneficio inmediato | F16 | 2000 | solo búsqueda |
| Mantenimiento de bases de casos (CBR) | El crecimiento sin control degrada la recuperación | F17 | ~1998 (s/f) | solo búsqueda |
| Checklist quirúrgico | En Ontario no redujo la mortalidad de forma significativa | F18 | 2014 | solo búsqueda |

## Fuentes

- F1 — Demystifying evals for AI agents — https://anthropic.com/engineering/demystifying-evals-for-ai-agents — 9/1/2026 (mod. 18/10/2026) — abierta
- F2 — Skill authoring best practices — https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices — s/f — abierta
- F3 — Evaluating AGENTS.md (Gloaguen et al.) — https://arxiv.org/abs/2602.11988 — 12/2/2026, v3 29/9/2026 — abierta (solo el resumen)
- F4 — SkillsBench — https://arxiv.org/abs/2602.12670 — feb 2026 — solo búsqueda (no peer-reviewed según un SoK, arXiv 2602.20867)
- F5 — Self-Improving CAD Generation Agents with FEA as Feedback — https://arxiv.org/pdf/2605.17448 — 27/5/2026 — abierta
- F6 — CADSmith — https://arxiv.org/pdf/2603.26512 — mar 2026 — solo búsqueda
- F7 — LLMs Cannot Self-Correct Reasoning Yet (Huang et al.) — https://arxiv.org/abs/2310.01798 — oct 2023 — solo búsqueda
- F8 — Self-Refine — https://arxiv.org/pdf/2303.17651 — mar 2023 — solo búsqueda
- F9 — Reflexion — https://arxiv.org/abs/2303.11366 — mar 2023 — solo búsqueda
- F10 — Voyager — https://arxiv.org/abs/2305.16291 — may 2023 — solo búsqueda
- F11 — Experience-following / add-all — https://arxiv.org/abs/2505.16067 — 2025 — solo búsqueda
- F12 — ACE — https://arxiv.org/abs/2510.04618 — oct 2025 — solo búsqueda
- F13 — Accumulated Behavioral Rules — https://arxiv.org/abs/2607.13091 — jul 2026 — abierta (corrida anterior)
- F14 — Judging LLM-as-a-Judge (Zheng et al.) — https://arxiv.org/abs/2306.05685 — jun 2023 — solo búsqueda
- F15 — GAO-02-195 y GAO-01-1015R; NASA LLIS lección 6856 — https://www.gao.gov (informes) — 2001-2002 — solo búsqueda (no tengo el link exacto verificado)
- F16 — Regli et al., survey de design rationale, Eng. with Computers 16:209 — s/link — 2000 — solo búsqueda
- F17 — Case-base maintenance — https://link.springer.com/chapter/10.1007/3-540-64574-8_436 — ~1998 (s/f) — solo búsqueda
- F18 — Urbach et al., NEJM 370:1029 (checklist quirúrgico Ontario) — s/link — 2014 — solo búsqueda
- F19 — Exact Feedback Is Not Control — https://arxiv.org/pdf/2609.28150 — 2026 — solo búsqueda
- F20 — Engineering Reliable Coding Agents — https://arxiv.org/pdf/2608.13867 — ago 2026 — solo búsqueda
- F21 — ReliCAD — https://arxiv.org/pdf/2609.22325 — sep 2026 — solo búsqueda
- F22 — CADCodeVerify (ICLR 2025) — https://proceedings.iclr.cc/paper_files/paper/2025/file/81a934cd364e18ea6fdeaf57a93c17d4-Paper-Conference.pdf — 2025 — solo búsqueda
- F23 — Blog sobre CBR (sin autor, marcado como blog) — https://www.teachfloor.com/blog/case-based-reasoning — s/f — solo búsqueda

## Lo que CONFIRMA lo que hace el sistema

- **Una skill con scripts y controles automáticos es el camino que recomienda Anthropic.** Dice que los scripts hechos de antemano son más confiables que código generado en el momento, y que conviene el patrón «plan → validar con script → ejecutar» (F2, abierta). Los controles automáticos de la skill van en esa línea.
- **Lo que el agente aprende tiene que venir de una medición externa, no de que se autocritique.** Sin feedback externo la autocorrección no mejora y a veces empeora (F7); Reflexion sin tests baja del punto de partida (F9, según un resumen secundario). En CAD, el lazo que medía con herramientas (OpenCASCADE, FEA) subió de 38,8 % a 60,5 % de requisitos cumplidos en 10 intentos (F5), y la validación geométrica exacta redujo muchísimo el error (F6, benchmark propio de los autores). Que el sistema mida con trimesh/manifold3d/OCC en vez de «mirar y opinar» está respaldado.
- **Fijar el mecanismo y las interfaces antes de modelar.** F5 mete una etapa previa («blueprint») que fija envolventes, caras de contacto y agujeros antes de escribir CAD. Es la versión formal de lo que le pasó al sistema (estética antes que mecanismo). Ojo con la fuerza de la evidencia: ver «Contradice».
- **Cada corrección del ingeniero convertida en regla con ID y origen.** F13 (Microsoft, 4 semanas, 11 sesiones, sin grupo control) reportó 0 reincidencias en 9 clases de error. Es la práctica más parecida a lo que haría el sistema, pero con evidencia chica.
- **Las lecciones aprendidas solas fallan; hay que meterlas en el proceso.** NASA: las lecciones no se consultan y solo el 23 % de los gerentes cargó alguna (F15). La conclusión de la propia NASA y de quienes la analizan es llevarlas a estándares y listas de control, no a una base de consulta (F15). Una skill con controles automáticos ya es «lección dentro del proceso».
- **Suite de regresión hecha con fallas reales.** F1: empezar con 20-50 tareas sacadas de fallas reales; una vez que una tarea de capacidad pasa a ~100 %, se vuelve de regresión. Los 6 problemas del último diseño son justo ese material.

## Lo que lo CONTRADICE o le pone en duda

- **Más texto en la skill no es mejor.** F3 (abierta): archivos de contexto permanente no mejoraron el éxito y subieron el costo más de 20 %; los generados por el modelo restaron un poco y los escritos por humanos sumaron poco (el propio paper dice que ninguna diferencia es estadísticamente significativa). Lo útil: instrucciones que el agente no puede deducir solo. F4 (solo búsqueda, no peer-reviewed): 2-3 skills rinden más que 4 o más y las «comprehensivas» restan. F2 pide menos de 500 líneas y «agregá solo lo que Claude no sabe». Si la skill del sistema crece con cada diseño, el riesgo medido es empeorar.
- **Pero hay una tensión entre fuentes.** F12 (ACE, oct 2025) encontró que comprimir el contexto a un resumen lo colapsó (66,7 % → 57,1 % en su benchmark) y propone deltas incrementales con ID. F2/F3/F4 dicen «cortito». No se resuelven entre sí: depende de qué se compacta (lo verificado sí; los resúmenes genéricos no).
- **Guardar todo degrada.** F11: sumar toda experiencia a la memoria dio 13 % contra 38,5 % con admisión estricta (benchmark de historia clínica, no de CAD). F17: la base de casos que crece sin control pierde calidad de recuperación. Los sistemas CBR fallan por mantenimiento, no por falta de casos (F17; F23 es un blog, solo orientativo).
- **El blueprint previo ayudó menos de lo que parece.** En F5, el blueprint dejó casi plano el puntaje de ingeniería de GPT (+0,3 pt) y dio +3,9 pt con Claude Code; en geometría sí mejoró (IoU de 0,444 a 0,592 con GPT-5.5, pero con Opus quedó igual o peor). Y F5 no publica intervalos de confianza: lo dicen ellos. No hay prueba sólida de que «planificar primero» arregle por sí solo la estética prematura.
- **El juez de imágenes no ve lo que importa.** F5: varios arreglos eran errores invisibles en el render (masa, densidad); además 7 vistas a veces rinden igual que 21, y el modelo mejor en el primer intento no es el mejor reparando. Mirar renders no reemplaza medir. (F21 dice lo mismo: las señales de render/ejecución verifican poco la intención de diseño.)
- **El juez LLM tiene sesgos medidos.** F14: >80 % de acuerdo con humanos, pero sesgo de posición, longitud y auto-preferencia (consistencia al invertir el orden 66 % en GPT-4). Para «¿se ve profesional?» un juez LLM no es base confiable sin calibrar contra el ingeniero (F1 lo recomienda: calibrar y dar salida «no sé»).
- **El sistema depende de que el ingeniero marque errores.** F13 también: depende de un humano que revisa, y las reglas malas se amplifican. No hay fuente que muestre aprendizaje entre proyectos sin ninguna señal humana ni medición: lo que funciona usa tests, simuladores o checkers como «etiquetas gratis» (F11, F5).
- **Los checklists no son magia.** F18: en Ontario el checklist quirúrgico no redujo la mortalidad de forma significativa (0,71 % → 0,65 %, p=0,13). Otros estudios dieron mejoras (secundario, no abierto). Lo que parece decidir es el cumplimiento real.

## Lo que no se les había ocurrido

1. **Medir la skill contra «sin skill».** F2 y F3 piden un baseline sin skill. Nadie dice que el sistema lo haga: si el diseño nuevo sale igual de bien sin la guía, la guía sobra o cuesta de más.
2. **Probar con modelos más chicos y con otra sesión (Claude A escribe, Claude B prueba)** en tareas reales (F2). Sirve para ver si la skill carga o se ignora.
3. **Una regla solo entra si trae su control** (script, medida o gate) y su origen (cuál diseño y qué marcó el ingeniero), con fecha de revisión y poda. Combina F13, F11 y F15 (opinión mía de síntesis).
4. **Separar «primer intento» de «reparación».** F5 muestra que son capacidades distintas: conviene medir ambas por separado (opinión).
5. **Contrato de requisitos por pieza con chequeos tipados** (envolvente, diámetro de agujero, holgura, radio mínimo de canto) como en F5; sirve también para «cantos que lastiman» (opinión: un chequeo de ángulo de aristas sobre la malla; no encontré fuente que lo pruebe).
6. **Leer los transcripts, no solo los resultados** (F1): ahí se ve por qué se metió en la estética o redibujó la palanca.

## Qué se buscó y no se encontró

- Evidencia medida de que un agente **reutilice piezas existentes** en vez de redibujarlas (catálogo de piezas + recuperación). Solo encontré CBR clásico y blogs; ningún estudio con LLM + CAD.
- Estudios de **edición incremental vs rehacer el modelo entero** en CAD con LLM. No apareció.
- Evaluación **con humano + IA colaborando en varios proyectos seguidos**: la crítica a F4 señala que no se testea; no hallé ningún estudio de largo plazo.
- Evidencia de captura de **design rationale** que mejore diseños futuros en la industria: solo el survey de 2000 (F16), que dice lo contrario (poco uso).
- Un estándar o guía oficial para **evaluar utillajes impresos en FDM**: fuera de este frente, no se buscó.
- No pude abrir F4, F6–F12, F14–F18 (solo fragmentos de búsqueda): sus cifras están sin verificar en el texto completo. Además el PDF de F5 tiene 33 páginas y puede haberme consumido el tope de páginas leídas de la corrida.

## Veredicto para este frente (2-4 frases; seguridad media-baja)

Lo primero que conviene cambiar no es agregar más reglas al texto de la skill sino convertir las fallas del virolador en una **suite chica de pruebas con controles de código** (envolvente/interfaces antes de estética, pieza existente reutilizada, aristas sin filo, un cambio de parámetro sin rehacer todo) y medir la skill contra «sin skill»; esto coincide con F1, F2 y F5. Después, solo entra una lección nueva si trae su chequeo y origen, y se poda lo que no cambia el resultado: la evidencia en contra de ensanchar la skill (F3, F4, F11) es más sólida que la a favor de acumular. Seguridad media-baja: la mayoría son preprints de 2025-2026 en benchmarks que no son de diseño de utillajes, F13 y F5 no tienen controles estadísticos, y varias cifras las vi solo en fragmentos de búsqueda.