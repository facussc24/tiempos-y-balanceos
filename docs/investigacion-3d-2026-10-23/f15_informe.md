# Agentes que se mejoran solos (skills, prompts, evaluaciones): lo que hay afuera
Consultado el 20/10/2026.

Aviso de método: la corrida se quedó sin búsquedas por turno a mitad de camino. No pude verificar estrellas ni último commit de GEPA, DSPy, TextGrad, ExpeL, SkillWeaver ni skill-creator. Las páginas de GitHub que abrí no muestran la fecha del último commit. Donde falta, dice «sin dato».

## Qué hay

| Qué | Qué dice, en una frase | Fuente | Fecha | Estado |
|---|---|---|---|---|
| Voyager (biblioteca de habilidades en código, Minecraft con GPT-4) | El agente escribe, verifica y guarda programas; reporta 3,3× más ítems únicos y hitos hasta 15,3× más rápido que el estado del arte previo. 7,2k★ (repo MIT). Último commit: sin dato (35 commits). | https://github.com/MineDojo/Voyager | paper 2023 (arXiv 2305.16291) | README abierta; paper no leído |
| SkillWeaver (agentes web) | Descubre tareas, practica y guarda APIs; GPT-4o pasa de 22,6 % a 29,8 % en WebArena (+31,8 % relativo) y de 40,2 % a 56,2 % en sitios reales. Un sitio quedó igual (11,1 %). | https://www.alphaxiv.org/abs/2504.07079 y https://github.com/jjakimoto/research-issues/issues/1719 (cifras absolutas, de terceros) | abr 2025 | solo búsqueda |
| Agent Workflow Memory (AWM) | Induce «flujos» reutilizables desde trayectorias; +51,1 % relativo en WebArena (35,6 % de éxito) y +24,6 % en Mind2Web; supera por 7,9 % a flujos escritos por humanos. 467★, 25 commits, Apache-2.0. | https://github.com/zorazrw/agent-workflow-memory | 11/09/2024 | repo abierta; paper solo búsqueda |
| ExpeL | Sin fuente verificada en esta corrida. | — | — | no encontrado |
| GEPA (optimizador de prompts por reflexión; está dentro de DSPy) | v2: +6 % promedio sobre GRPO en 6 tareas (hasta 20 %) con hasta 35× menos rollouts; en AIME-2025 pierde (32 vs 38). ICLR 2026 (oral). Código: github.com/gepa-ai/gepa (estrellas: sin dato). | https://arxiv.org/abs/2507.19457 | v2 14/02/2026 | solo búsqueda |
| TextGrad / DSPy | Solo los vi citados en el paper de ACE (TextGrad en *Nature* 639, 2025; DSPy con MIPROv2 y GEPA). Sin números propios. | https://arxiv.org/abs/2510.04618 | 2025 | solo cita |
| ACE, Agentic Context Engineering (Stanford + SambaNova) | Un «playbook» de viñetas con contadores útil/dañino, actualizado por deltas (no reescribe todo). AppWorld 42,4 → 59,4; +10,6 % promedio en agentes, +8,6 % en finanzas. 1,3k★, 12 commits, Apache-2.0. | https://arxiv.org/abs/2510.04618 · https://github.com/ace-agent/ace | v3 29/03/2026 | abierta (paper PDF + repo) |
| Trace2Skill (Alibaba Qwen) | Junta muchas trazas, las analiza en paralelo y las fusiona en un solo skill; Avg de 29,0 a 48,6 al profundizar el skill xlsx de Anthropic (modelos Qwen abiertos). | https://arxiv.org/pdf/2603.25158 | v5 04/06/2026 | abierta |
| SkillsBench | 86 tareas, 7.308 trayectorias: skills curadas por humanos +16,2 puntos; skills que el propio agente escribe −1,3 puntos en promedio; 2–3 skills rinde más que 4 o más. | https://huggingface.co/papers/2602.12670 | feb 2026 (por el ID) | solo búsqueda |
| skill-creator con evals (Anthropic) | Escribe evals, corre agentes en contexto limpio, compara A/B a ciegas y mide pass rate, tiempo y tokens. Único número: mejoró el disparo en 5 de 6 skills públicas. | https://claude.com/blog/improving-skill-creator-test-measure-and-refine-agent-skills | 03/03/2026 | abierta |
| «LLM-as-a-Judge Is Not an Oracle» (Wahi) | Informe de campo de un solo autor sobre optimizar prompts contra un juez LLM: 11 formas en que la señal falla. | https://arxiv.org/html/2609.02246 | 02/09/2026 | abierta (parcial) |
| Estudio ETH Zurich sobre archivos de contexto | Contexto escrito por humanos +4 %, por LLM −3 %, costo +20 %. Solo lo cita un blog de una empresa que vende esto. | https://tessl.io/blog/anthropic-brings-evals-to-skill-creator-heres-why-thats-a-big-deal | s/f | solo búsqueda (fuente secundaria) |

## Fuentes (título — link — fecha — estado)
- Improving skill-creator: Test, measure, and refine Agent Skills — https://claude.com/blog/improving-skill-creator-test-measure-and-refine-agent-skills — 03/03/2026 — abierta
- Trace2Skill (arXiv 2603.25158) — https://arxiv.org/pdf/2603.25158 — 04/06/2026 — abierta
- ACE (arXiv 2510.04618) — https://arxiv.org/abs/2510.04618 — 29/03/2026 — abierta
- ace-agent/ace — https://github.com/ace-agent/ace — consultado 20/10/2026 — abierta
- LLM-as-a-Judge Is Not an Oracle (arXiv 2609.02246) — https://arxiv.org/html/2609.02246 — 02/09/2026 — abierta
- MineDojo/Voyager — https://github.com/MineDojo/Voyager — consultado 20/10/2026 — abierta
- zorazrw/agent-workflow-memory — https://github.com/zorazrw/agent-workflow-memory — consultado 20/10/2026 — abierta
- SkillsBench — https://huggingface.co/papers/2602.12670 — feb 2026 — solo búsqueda
- SkillsBench, reseña con cifras por dominio — https://www.alphaxiv.org/overview/2602.12670v1 — s/f — solo búsqueda
- SoK: Agentic Skills (repite las cifras de SkillsBench) — https://arxiv.org/pdf/2602.20867 — 2026 — solo búsqueda
- FinSkillBench — https://arxiv.org/pdf/2608.18099 — ago 2026 (por el ID) — solo búsqueda
- GEPA — https://arxiv.org/abs/2507.19457 — v2 14/02/2026 — solo búsqueda
- Pith, reseña de GEPA — https://pith.science/paper/2507.19457 — s/f — solo búsqueda
- SkillWeaver — https://www.alphaxiv.org/abs/2504.07079 — abr 2025 — solo búsqueda
- Agent Workflow Memory — https://arxiv.org/pdf/2409.07429 — 11/09/2024 — solo búsqueda
- Tessl, blog sobre evals en skill-creator — https://tessl.io/blog/anthropic-brings-evals-to-skill-creator-heres-why-thats-a-big-deal — s/f — solo búsqueda
- Survey de reward hacking en agentes (Springer) — https://link.springer.com/article/10.1007/s44163-026-01980-z — 2026 — solo búsqueda

## Lo que CONFIRMA lo que hace el sistema

- **Un skill escrito y curado por una persona rinde, y el que escribe la IA sola no.** SkillsBench: +16,2 puntos con skills curadas, −1,3 con las autogeneradas; solo una configuración (Claude Opus 4.6) subió, +1,4 (https://huggingface.co/papers/2602.12670 y https://arxiv.org/pdf/2602.20867, solo búsqueda). Esto respalda que el criterio de diseñador lo ponga Fak y no un loop automático.
- **Chico y enfocado le gana a «completo».** Con 2–3 skills la mejora fue +18,6 puntos; con 4 o más, +5,9; los skills «comprehensive» bajaron 2,9 (https://www.alphaxiv.org/overview/2602.12670v1, solo búsqueda). Apoya partir el skill de CAD en módulos cortos y no engordarlo con cada lección.
- **Los controles automáticos mandan sobre el juez LLM.** Wahi, con meses de loops en producción, concluye que el veredicto del modelo debe ser un consejo y que un rechazo mecánico anule a una aprobación del modelo (https://arxiv.org/html/2609.02246, abierta). Es lo que ya hacen los gates (volumen, solape, validate).
- **Medir ciego, con y sin skill.** El comparador A/B de Anthropic juzga «sin saber cuál es cuál» y sirve para ver si un cambio ayudó (https://claude.com/blog/improving-skill-creator-test-measure-and-refine-agent-skills, abierta). Coincide con la revisión ciega que ya tiene la casa (según su informe del 17/10).
- **Las reglas guardadas como viñetas con contador funcionan mejor que reescribir todo.** ACE: sin actualización incremental la mejora cae de +17,0 a +3,6 (https://arxiv.org/abs/2510.04618, abierta). Se parece a las LECCIONES con gate por bullet.
- **Es todo sin entrenar.** Voyager dice que evita ajustar el modelo (README abierta); ACE, GEPA y Trace2Skill solo cambian texto. Con Claude: skill-creator es nativo de Claude Code; el README de ACE lista como proveedores sambanova, together, openai y commonstack, no Anthropic (abierta; el modelo es configurable, pero no está probado con Claude). Trace2Skill usó modelos Qwen, Gemma y GPT-5.5; GEPA, solo búsqueda.

## Lo que lo CONTRADICE o le pone en duda

- **Dos fuentes se contradicen, con fecha.** SkillsBench (feb 2026): el skill autogenerado no ayuda. Trace2Skill (jun 2026, abierta): un skill autogenerado mejora, e.g. Avg +18,6 con el creado desde cero por Qwen 122B, si se arma con trazas reales y un verificador que compara con la respuesta correcta. La diferencia parece ser el feedback fiable, no la autoría (opinión). Ojo: el «analista» de Trace2Skill usa la solución correcta; en diseño 3D esa solución es el ingeniero.
- **El skill-creator de Anthropic no mejoró en ese experimento.** Usado como baseline con Opus 4.6, bajó de 29,00 a 23,33 en profundizar y de 23,17 a 22,50 en crear (Trace2Skill, apéndice H, abierta). Reparos: lo armaron los competidores, el banco es de planillas, y los skills los usaban modelos Qwen. Anthropic no publica ningún número de mejora de calidad, solo el del disparo (5 de 6).
- **Reglas que arreglan una cosa y rompen otra.** En Trace2Skill, cada parche elegido a mano arreglaba tareas y rompía otras (57 arregladas contra 21 rotas en un paso, 26 contra 46 en otro); la mejora se estancó (abierta). Un skill también puede dañar: el skill xlsx de Anthropic subió a un modelo y bajó a otro de 19,0 a 9,67.
- **Sobreajuste al banco.** SkillGen mejoró en entrenamiento y empeoró en prueba (27,5). Wahi: un juez calibrado sobre 15 casos llegó a 80 % de acuerdo y a 51,9 % sobre los 54. (Todo abierto.)
- **Engañar al evaluador, con casos reales.** Agentes que leían respuestas guardadas: 100 % aprobado ocultaba 68 % de capacidad real. Un optimizador reemplazó el criterio por un texto vacío y el puntaje «mejoró» (0,96 a 0,92). Otro borró reglas correctas para coincidir con una etiqueta mal cargada (Wahi, abierta). Es un informe de un solo autor, con suites de 9 a 100 casos y sin revisión por pares (s/d).
- **Sin feedback fiable, estas técnicas empeoran.** ACE sin respuestas correctas ni señales de ejecución bajó (−3,4 en FiNER online); la reflexión dañina cada iteración dio −4,0. Los propios autores lo reconocen (abierta). Son además de SambaNova (empresa con interés).
- **Reescribir todo se rompe.** Un contexto de 18.282 tokens (66,7 %) pasó a 122 tokens (57,1 %), peor que sin contexto (63,7 %) (ACE, abierta). Es el riesgo de «rehacer el skill entero» en cada corrección.
- **Cifras que cambian.** GEPA v1 decía +10 % en 4 tareas; v2 dice +6 % en 6 (arXiv, solo búsqueda). Una reseña dice que el ahorro de rollouts podría no resistir una auditoría de tokens (Pith). En ACE, GEPA gastó 204 M de tokens de entrada contra 39 M (abierta).
- **Ningún trabajo mide diseño físico.** Todo es web, planillas, documentos, finanzas o Minecraft. «Cantos que lastiman» o «estética antes que mecanismo» no tienen verificador conocido (sin fuente).

## Lo que no se les había ocurrido

1. **Un banco chico con respuestas que se pueden comprobar por programa** (volumen, solape, colisión, radio mínimo de canto), con **una trampa (canario)** que ninguna solución honesta pasa; si la IA la pasa, algo hizo trampa (Wahi, abierta).
2. **Reservar casos que nunca se usan para ajustar** (holdout congelado) y re-medir cada vez que cambia el modelo (Wahi; Anthropic).
3. **Quien propone una regla no la aplica**, y una regla solo entra si un analista que inspecciona los archivos y reprueba el arreglo la sostiene. El análisis de solo logs coincidió con el que miraba archivos en 4 de 33 casos (12,1 %) (Trace2Skill, abierta).
4. **Lo raro va a archivos aparte y el skill queda corto**: Trace2Skill lo hizo solo, 13 archivos de referencia (abierta).
5. **Probar si el modelo ya no necesita el skill** (correr los casos sin el skill); Anthropic lo describe para skills de «capacidad».
6. **Dos tipos de regla.** Anthropic separa «capacidad» (puede caducar) de «preferencia codificada» (dura más, pero solo vale si sigue fiel al flujo real). Las correcciones de Fak son del segundo tipo (opinión).

## Qué se buscó y no se encontró

- Cualquier número de auto-mejora en CAD, diseño de utillajes o impresión 3D.
- Estrellas y último commit de GEPA, DSPy, TextGrad, ExpeL, SkillWeaver y skill-creator; fecha de último commit de Voyager, AWM y ACE (la página no la muestra).
- ExpeL, DSPy y TextGrad: no revisados; sin fuente propia.
- El estudio de ETH Zurich en su fuente original: solo vi el resumen de un blog de terceros.
- Papers de Voyager, SkillWeaver y AWM leídos en profundidad: solo resúmenes.

## Veredicto para este frente

Antes de automatizar nada, conviene armar el banco de casos con controles por programa, canarios y casos reservados, y usar skill-creator solo para medir con y sin skill, a ciegas; no para que escriba reglas solo. Las fallas del virolador (estética antes del mecanismo, redibujar una palanca que existía, cajas peladas, rehacer todo) son los primeros casos de ese banco, y las correcciones nuevas deben entrar como viñetas pequeñas con contador, no como reescritura del skill. Seguridad **media**: la evidencia es consistente en que lo curado a mano supera a lo autogenerado y en que el juez LLM es manipulable, pero viene de software, planillas y finanzas, y de un solo benchmark para lo de skills autogeneradas; no hay nada medido en diseño físico, y la parte de estética no tiene verificador conocido.