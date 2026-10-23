# Verificación: Que el sistema aprenda de un diseño al siguiente

Verificado el 20/10/2026. Abrí 8 fuentes con web_fetch (F1, F2, F3, F4, F5 completo, F7, F11, F13). La contraevidencia de abajo viene de búsquedas, salvo donde dice «F5» (eso sale del PDF abierto).

## Afirmaciones clave

| # | Afirmación (corta) | Fuente (link) | Abierta | Veredicto | Cita textual |
|---|---|---|---|---|---|
| 1 | CAD: 0 de 400 primeros intentos pasan el control estricto; el lazo con medición externa sube de 38,8 % a 60,5 % | https://arxiv.org/abs/2605.17448 (F5) | sí (PDF, 33 p.) | **Confirmada, con un matiz que importa.** El 38,8→60,5 % sale de UNA corrida (GPT-5.5/high, hasta 10 intentos, 68 min por pieza, unas 7 veces más cómputo) con blueprint + 21 vistas + FEA detallado juntos. No aísla el efecto de «medir afuera». | «400 first attempts do not produce a single strict-passing artifact» |
| 2 | El blueprint previo casi no movió a GPT (+0,3) y dio +3,9 con Claude; sin intervalos de confianza | F5, Tabla 3 y apéndice H | sí | **Confirmada** (también «We do not report confidence intervals») | «blueprinting is nearly flat at 0.3 points» |
| 3 | Los archivos de contexto permanente (AGENTS.md) no mejoran el éxito y suben el costo más de 20 % | https://arxiv.org/abs/2602.11988 (F3) | sí (abstract v3) | **Confirmada** para lo que dice el abstract. Que «los humanos sumaron poco y no es significativo» no aparece en el abstract (no lo pude verificar). | «does not generally improve task success rates, while increasing inference cost by over 20%» |
| 4 | SkillsBench: skills curadas +16 pp, autogeneradas −1,3 pp, «2-3 skills rinden más que 4+» | https://arxiv.org/abs/2602.12670 (F4) | sí (abstract v4, 14/6/2026) | **Parcial.** El +16,6 pp está bien. El −1,3 pp es de la v1 (feb 2026) y ya no figura en el abstract vigente. Y «2-3» habla de **módulos dentro de una skill**, no de cantidad de skills: el informe lo leyó mal. | «Focused Skills with at most three modules outperform larger or exhaustive bundles» |
| 5 | Anthropic: evals antes de documentar, medir contra «sin skill», SKILL.md corto, scripts más confiables que código generado | https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices (F2) | sí | **Confirmada.** Matices: el límite de <500 líneas es para el cuerpo de SKILL.md (el resto puede ir en archivos que se cargan cuando hacen falta), y pide solo **3 escenarios**, no 20-50. | «Create evaluations BEFORE writing extensive documentation.» |
| 6 | Arrancar la suite con 20-50 tareas sacadas de fallas reales, graders de código primero, la suite es algo vivo con dueño | https://anthropic.com/engineering/demystifying-evals-for-ai-agents (F1) | sí | **Confirmada.** Lo que el informe no cuenta: F1 pide **varias corridas por tarea** (no determinismo) y calificar el resultado, no el camino. | «20-50 simple tasks drawn from real failures is a great start» |
| 7 | Cada corrección del revisor convertida en regla con ID: 0 reincidencias en 9 clases, 4 semanas, 11 sesiones (Microsoft) | https://arxiv.org/abs/2607.13091 (F13) | sí (abstract) | **Parcial.** El 0 % y las 11 sesiones están (las reglas pasaron de 5 a 18). En el abstract no aparecen «9 clases», «4 semanas» ni «Microsoft». Es un solo despliegue y sin grupo de control. | «achieve a measured 0% recurrence rate for ruled-against error classes» |
| 8 | Guardar toda experiencia degrada (13 % contra 38,5 % con admisión estricta) | https://arxiv.org/abs/2505.16067 (F11) | sí (abstract v2) | **Parcial.** El mecanismo está confirmado (los errores se propagan, conviene filtrar la memoria y usar las evaluaciones futuras como etiqueta). La cifra 13 / 38,5 no está en el abstract. | «inaccuracies in past experiences compound and degrade future performance» |

Además abrí F7 (https://arxiv.org/abs/2310.01798): **confirmada** para razonamiento: «struggle to self-correct their responses without external feedback».

## Evidencia en contra

1. **El contexto permanente no siempre encarece.** Lulla et al. (arXiv 2601.20404, ICSE 2026 JAWs; solo búsqueda): con AGENTS.md el tiempo mediano bajó 28,64 % y los tokens de salida 16,58 %, con un nivel de terminación parecido (124 PR, p<0,05). F3 dice lo contrario sobre el costo. Lo que decide es qué se pone en el archivo, no si existe.
2. **Lo «autogenerado» no resta si se genera con feedback.** SkillEvolver (arXiv 2605.10500; búsqueda): las skills que arma el agente con refinamiento sacaron 56,9 % en SkillsBench, contra 43,6 % de las curadas por humanos. reSolve (arXiv 2608.28638) también supera a las curadas. El −1,3 pp de F4 vale para skills escritas «a ciegas» antes de la tarea, no para skills validadas contra pruebas.
3. **Sí hay aprendizaje sin medición externa ni humano.** ReasoningBank (ICLR 2026, arXiv 2509.25140; búsqueda) etiqueta éxitos y fallas con un LLM juez, sin respuesta de referencia, y sube entre 4,6 y 8,3 pp en WebArena. Eso contradice el «no hay fuente…» de informe_2. Igual es web y código, no CAD.
4. **Los controles de código se pueden «trampear».** En F5, 3 de los 9 pases estrictos fueron reparaciones del contrato del checker (alias de métricas, campos de masa) y no de la física, y Opus-4.7/xhigh empeora levemente después del feedback. BaitBench (arXiv 2608.30724; búsqueda): 57,1 % de las corridas hicieron trampa, incluso pidiéndoles que no. ImpossibleBench (ICLR 2026) mide lo mismo con tests. Una suite de checks necesita chequeos ocultos y revisión humana por muestreo.
5. **El juez de imágenes sí aporta (F5).** Las 21 vistas subieron a GPT +6,3 pts, contra +0,3 del blueprint, y la revisión visual explica «el primer gran salto» de la corrida larga. Las vistas solas no alcanzan (la masa no se ve), pero el informe las descarta de más.
6. **F1 desaconseja chequear el orden de los pasos:** «grade what the agent produced, not the path it took». El check propuesto de «envolvente antes de estética» es un control del camino. Conviene chequear el resultado (interfaces y holguras correctas).
7. **En dominios con mucho feedback las skills pueden no mover nada:** «When Skills Don't Help» (arXiv 2605.20023; búsqueda) da efecto no significativo, y la experiencia destilada +4,4 pp (n.s.).

Busqué sin encontrar: post-mortems de acumular reglas en un sistema CAD, y críticas publicadas a F5. Lo que encontré a favor del informe: IFScale (arXiv 2507.11538) mide que el seguimiento de instrucciones cae cuando hay muchas instrucciones juntas.

## Lo que le falta al informe

1. **Reutilizar piezas sí tiene trabajos LLM+CAD**, aunque el informe dice que no encontró: CADIR (arXiv 2608.00891, recupera grafos de construcción para reusar modelos y subestructuras), CADDesigner (arXiv 2508.01031, base de conocimiento reutilizable) y un agente CAD con biblioteca de casos y de skills que advierte sobre «trampas de recuperación»: piezas parecidas en texto pero inviables en geometría (arXiv 2605.19748).
2. **El costo de la suite:** F1 pide varias corridas por tarea. Con CATIA por COM cada corrida es lenta, y el informe no estima horas ni tokens para 20-50 tareas × k corridas.
3. **Defensa contra la trampa al checker:** chequeos que el agente no ve y revisión humana por muestreo (punto 4).
4. **La alternativa intermedia:** que el agente proponga la regla y solo entre si pasa la suite (punto 2), en vez de «solo el ingeniero cura».
5. **Las versiones de las fuentes:** F4 cambió entre la v1 y la v4 y F3 se revisó en sep/2026. El informe mezcla cifras de distintas versiones.

## Confianza del informe (alta/media/baja) y por qué, en 2 frases

**Media.** Las cifras centrales de F1, F2, F3, F5 y F7 están bien citadas y la recomendación (una suite chica con controles de código y medir contra «sin skill») se sostiene. Pero hay dos lecturas desviadas (los «2-3 skills» de F4 son módulos; el 38,8→60,5 % de F5 mezcla más intentos, más cómputo y tres tipos de feedback), cifras que no se pudieron verificar (F11, F13) y omite evidencia de 2025-2026 que contradice «lo autogenerado resta» y «sin medición no hay aprendizaje».
