# Practicar diseño mecánico sin casos reales: lo que hay afuera
Consultado el 20/10/2026.

Nota de alcance: se agotó el cupo de búsquedas y lecturas de la corrida antes de abrir las fuentes más nuevas (FunCADBench, CAD-bench, CADEngBench). Esas quedan como «solo búsqueda»: sus números vienen de resúmenes o de páginas que resumen el paper, no del paper.

## Qué hay

| Qué | Qué dice, en una frase | Fuente (link) | Fecha | abierta/solo búsqueda |
|---|---|---|---|---|
| MUSE (benchmark) | 106 diseños con especificación (CNC, impresión 3D en PLA, láser); evalúa en cascada: código, validez geométrica (estanco, manifold, autointersección, solapes) y un juez de visión con rúbrica. Opus 4.7: ejecuta 76,4 %, geometría válida 58,5 %, puntaje final 39,5 %; GPT-5.5 llega a 52,4 % | https://arxiv.org/html/2605.28579v1 | may/2026 (s/f exacta) | abierta |
| CADTests / CADTestBench | Tests ejecutables sobre el sólido (conteos, cajas, volúmenes, contención) y «mutantes» (versiones rotas a propósito) para probar que los tests detectan fallas; los tests también sirven de realimentación al generar. 200 programas, 5.937 tests | https://arxiv.org/html/2605.07807v1 | 08/05/2026 | abierta (intro y método; no leí la tabla de resultados) |
| ToolCAD | Entrena un modelo chico con RL y «curriculum» por cantidad de piezas; sin curriculum llega a ~49,8 % de éxito y con curriculum a 63,9 %. Cuesta 8 GPU H20. Un juez de visión (Qwen2.5-VL) acierta 55,3 % al juzgar trayectorias vs 82,7 % del juez entrenado | https://arxiv.org/abs/2604.07960 | 20/04/2026 | abierta (PDF) |
| CADSmith | Planificador, programador, ejecutor (mide con OpenCASCADE: caja, volumen, caras, validez) y juez de visión independiente con 3 vistas; dos lazos de corrección. Usa API de Claude | https://github.com/jabarkle/CADSmith | 30/03/2026 | solo búsqueda (sin números leídos) |
| CAD-bench (ICML 2026) | Mide si el CAD «funciona»: dimensiones, interfaces de acople y simulación de cuerpos rígidos (Blender); reporta una caída fuerte de piezas estáticas a mecanismos | https://lacuna.tiptreesystems.com/work/cad-bench-benchmarking-language-models-on-functional-cad-generation/wrk_1c1de3cd03ec33239e10aa9237083db8 | ~sep/2026 | solo búsqueda (página que resume, no el paper) |
| «Can It Actually Work?» (FunCADBench) | 46 familias de mecanismos; 75 ensambles hechos por agentes, 38 pasan la evaluación completa; el arnés mide ciclos, rotación acumulada, separación de juntas y error de retorno | https://arxiv.org/html/2610.26861 | oct/2026 | solo búsqueda (fragmento del apéndice) |
| CADEngBench | De 1.030 programas que ejecutan, 432 pasan chequeos de ingeniería y fabricación; mejor modelo concuerda con elementos finitos en 46,3 %; solo 14,8 % de las hipótesis de junta de primer puesto aciertan; editar un CAD dado es más fácil que generarlo | https://pith.science/paper/2608.09296 | ago/2026 | solo búsqueda (resumen de terceros) |
| AssemCAD / AssemBench | Biblioteca de componentes + axiomas de ingeniería + verificación determinista; el benchmark sale del corpus de ensambles de Fusion 360 Gallery | https://arxiv.org/html/2607.05123v1 | jul/2026 | solo búsqueda |
| ArtiCAD | Ensambles articulados en FreeCAD con 5 tipos de junta resueltas por su solver; dice que CadQuery no trae juntas ni cinemática | https://arxiv.org/pdf/2604.10992 | abr/2026 | solo búsqueda |
| SkillsBench | 86 tareas: guías curadas por humanos suben +16,2 puntos; las que el modelo se escribe solo, −1,3; 2–3 módulos enfocados rinden más que documentación «completa» | https://huggingface.co/papers/2602.12670 | feb/2026 | solo búsqueda |
| MUSE-Autoskill | Agente que crea skills y las depura con tests: en Claude Code, sin skills 42,43 %, skills humanas 56,15 %, auto-creadas 44,27 % | https://arxiv.org/pdf/2605.27366 | may/2026 | solo búsqueda |
| CAD-RL / CAD-Coder / IterCAD | CAD-RL: 98,83 % ejecuta pero IoU 78,7 %. CAD-Coder: RL de 146 h en 8 A800. IterCAD: lazo generar-verificar-refinar, 0,64 % de salidas inválidas contra 47 % de Claude 3.7 solo | https://arxiv.org/html/2508.10118v2 · https://arxiv.org/html/2505.19713v3 · https://arxiv.org/html/2606.13368v3 | 2025–jun/2026 | solo búsqueda |
| Jueces de visión (3D-DefectBench, VLM-judge cruzado, animaciones físicas) | El modelo elegido domina la concordancia con humanos; dos jueces distintos con corrección de orden dan kappa 0,66; en animaciones, juez con video 87,8 % de acuerdo vs 69,1 % juez que solo lee código | https://arxiv.org/html/2607.10826 · https://arxiv.org/pdf/2606.18451 · https://arxiv.org/pdf/2602.10840 | 2026 | solo búsqueda |

## Fuentes (título — link — fecha — estado)
- MUSE: Benchmarking Manufacturable, Functional, and Assemblable Text-to-CAD — https://arxiv.org/html/2605.28579v1 — may/2026 — abierta
- Text-to-CAD Evaluation with CADTests — https://arxiv.org/html/2605.07807v1 — 08/05/2026 — abierta
- ToolCAD — https://arxiv.org/abs/2604.07960 — 20/04/2026 — abierta
- CADSmith (repo y paper 2603.26512) — https://github.com/jabarkle/CADSmith — 30/03/2026 — solo búsqueda
- CAD-bench (resumen) — https://lacuna.tiptreesystems.com/work/cad-bench-benchmarking-language-models-on-functional-cad-generation/wrk_1c1de3cd03ec33239e10aa9237083db8 — ~sep/2026 — solo búsqueda
- Can It Actually Work? Synthesizing Functional CAD Mechanisms — https://arxiv.org/html/2610.26861 — oct/2026 — solo búsqueda
- CADEngBench — https://arxiv.org/html/2608.09296v1 (resumen de terceros: pith.science/paper/2608.09296) — ago/2026 — solo búsqueda
- AssemCAD — https://arxiv.org/html/2607.05123v1 — jul/2026 — solo búsqueda
- ArtiCAD — https://arxiv.org/pdf/2604.10992 — abr/2026 — solo búsqueda
- SkillsBench — https://huggingface.co/papers/2602.12670 (crítica: https://arxiv.org/pdf/2602.20867, aclara que viene de un solo benchmark sin revisión de pares) — feb/2026 — solo búsqueda
- MUSE-Autoskill — https://arxiv.org/pdf/2605.27366 — may/2026 — solo búsqueda
- Memento-Skills (nota periodística, no CAD; GAIA 66,0 vs 52,3 con memoria estática) — https://venturebeat.com/orchestration/new-framework-lets-ai-agents-rewrite-their-own-skills-without-retraining-the — ~abr/2026 — solo búsqueda (medio de prensa)
- CAD-RL — https://arxiv.org/html/2508.10118v2 — ago/2025 — solo búsqueda
- CAD-Coder — https://arxiv.org/html/2505.19713v3 — may/2025 — solo búsqueda
- IterCAD — https://arxiv.org/html/2606.13368v3 — jun/2026 — solo búsqueda
- Text2CAD-Bench — https://arxiv.org/pdf/2605.18430 — may/2026 — solo búsqueda (admite que no probó multi-turno)
- 3D-DefectBench — https://arxiv.org/html/2607.10826 — jul/2026 — solo búsqueda
- Cross-Model VLM-Judge — https://arxiv.org/pdf/2606.18451 — jun/2026 — solo búsqueda
- Physics-inspired animations (juez de visión) — https://arxiv.org/pdf/2602.10840 — feb/2026 — solo búsqueda

## Lo que CONFIRMA lo que hace el sistema

- **Medir con el kernel antes que con la vista.** CADSmith hace lo mismo que la skill: mide con OpenCASCADE (caja, volumen, validez) y recién después deja opinar a un juez de visión independiente ([repo](https://github.com/jabarkle/CADSmith), solo búsqueda). En ToolCAD, el feedback textual del motor rinde más que el visual: 87,2 / 69,3 / 29,7 % de éxito en piezas de 1 / 3 / 5+ partes, contra 82,5 / 59,1 / 20,8 % del agente con feedback visual ([paper](https://arxiv.org/abs/2604.07960), abierta). Ojo: compara contra modelos viejos y los autores venden su método.
- **Mecanismo antes que estética.** MUSE muestra una cascada: Opus 4.7 ejecuta el código en 76,4 % de los casos, pero solo 58,5 % da geometría válida y 39,5 % el puntaje final. El control de piezas que se solapan es el que más cae ([MUSE](https://arxiv.org/html/2605.28579v1), abierta). CAD-bench habla de un «precipicio funcional» entre piezas estáticas y mecanismos ([resumen de terceros](https://lacuna.tiptreesystems.com/work/cad-bench-benchmarking-language-models-on-functional-cad-generation/wrk_1c1de3cd03ec33239e10aa9237083db8), solo búsqueda). En FunCADBench, 38 de 75 ensambles de agentes pasan la prueba completa de recorrido ([paper](https://arxiv.org/html/2610.26861), solo búsqueda).
- **No rehacer todo.** CADEngBench reporta que editar un CAD ya dado resulta más fácil que generarlo de cero ([resumen de terceros](https://pith.science/paper/2608.09296), solo búsqueda).
- **Reusar lo probado.** AssemCAD arma sus ensambles con una biblioteca de componentes y axiomas, más verificación determinista ([paper](https://arxiv.org/html/2607.05123v1), solo búsqueda). Es el caso de la palanca que ya existía.
- **Guías cortas y enfocadas.** En SkillsBench rinden más 2–3 módulos que documentación «completa» ([resumen](https://huggingface.co/papers/2602.12670), solo búsqueda).

## Lo que lo CONTRADICE o le pone en duda

- **Nadie midió que «practicar» mejore a un agente por API en CAD.** La mejora más grande que encontré es de ToolCAD: de ~41–44 % (ajuste supervisado) a ~62–64 % con RL y curriculum; sin curriculum queda en ~49,8 % ([abierta](https://arxiv.org/abs/2604.07960)). Pero es entrenar pesos de un modelo chico con 8 GPU H20, sobre piezas tipo DeepCAD. **Solo sirve para entrenar modelos: no nos sirve.** Lo mismo CAD-Coder (146 h de RL en 8 A800, [fuente](https://arxiv.org/html/2505.19713v3)) y CAD-RL (98,83 % ejecuta, IoU 78,7 %, [fuente](https://arxiv.org/html/2508.10118v2)), ambos solo búsqueda.
- **Los datasets públicos no son de dispositivos.** ToolCAD dice que en DeepCAD casi todo es una sola pieza; MUSE dice que los datasets previos son de piezas sueltas, sin restricciones de ensamble (ambas abiertas). El único con especificación de fabricación es MUSE y tiene 106 diseños (muebles, portatarjetas), no utillajes.
- **Que la IA escriba sus propias lecciones no está probado.** SkillsBench: skills curadas +16,2 puntos, auto-generadas −1,3 ([solo búsqueda](https://huggingface.co/papers/2602.12670)). MUSE-Autoskill: con Claude Code, 42,43 % sin skills, 44,27 % auto-creadas, 56,15 % humanas ([solo búsqueda](https://arxiv.org/pdf/2605.27366)). Matices: SkillsBench generó las skills antes de intentar la tarea, sin verificador de por medio; es un solo benchmark sin revisión de pares ([SoK](https://arxiv.org/pdf/2602.20867)); y MUSE-Autoskill es de quien vende el método.
- **El juez de visión no es confiable para geometría fina.** MUSE halla correlación con humanos de 0,71 por criterio y 0,83 por diseño, pero con solo 20 diseños y 4 anotadores (abierta). ToolCAD muestra casos de «falta una pieza» o error booleano que el juez de visión no distingue (abierta). Además el modelo elegido domina el resultado ([3D-DefectBench](https://arxiv.org/html/2607.10826), solo búsqueda). Lo único donde el juez visual anduvo bien fue un criterio visual (animaciones, 87,8 % de acuerdo, [fuente](https://arxiv.org/pdf/2602.10840), solo búsqueda).
- **Pone en duda la investigación del 17/10.** Esa decía que ningún paper mide función. Ahora hay tres (CAD-bench, FunCADBench, CADEngBench) que miden juntas y recorrido en simulación; todos solo búsqueda y ninguno mide apoyo sobre blando ni FDM.
- **La práctica puede no transferirse.** CADEngBench dice que el ranking de modelos casi no se asocia entre generar, editar, paramétrico y ensamble ([solo búsqueda](https://pith.science/paper/2608.09296)). Practicar un tipo de ejercicio no garantiza mejorar en otro (opinión: hay que diversificar el banco).

## Lo que no se les había ocurrido

1. **Mutantes para probar los controles, no a la IA.** CADTests rompe a propósito un diseño bueno (cambia cotas, saca rasgos) y exige que algún test lo rechace ([abierta](https://arxiv.org/html/2605.07807v1)). (Opinión) Con el virolador ya aprobado: holgura cero, canto vivo, pared fina, pasador sin recorrido; si los controles no los marcan, el control está flojo. Costo: cero de API, y es práctica sin casos reales.
2. **Tests de propiedades en vez de comparar con una pieza modelo.** Un ejercicio generado de catálogo tiene muchas soluciones válidas; el test chequea agujeros, cajas, contención (CADTests). Sirve con API.
3. **Puntaje por etapa, en cascada.** Ejecuta → válido → sin solapes → recorrido → fabricable → estética. Una etapa que falla anula las siguientes (MUSE). (Opinión) Obliga por construcción a no pulir la estética con el mecanismo roto.
4. **Ejercicio con especificación estructurada y rúbrica binaria.** MUSE usa grafo de piezas, rangos de parámetros válidos y proceso de fabricación, y 6 criterios sí/no en lugar de una nota global (abierta).
5. **Vistas de ingeniería en vez de perspectiva.** MUSE advierte que el render en perspectiva oculta fallas y usa planta, frente, lateral e isométrica con líneas ocultas sacadas del kernel (abierta). Un juez extra con orden invertido y otro modelo dio kappa 0,66, pero en mallas de imagen, no CAD ([fuente](https://arxiv.org/pdf/2606.18451), solo búsqueda).
6. **Escala de dificultad por cantidad de piezas y juntas.** ToolCAD sube de nivel cuando el modelo domina el anterior, medido por perplejidad (no disponible por API). (Opinión) Sustituible por tasa de aprobación del embudo en el nivel actual; 1 pieza → 2 con holgura → pivote con recorrido → palanca → multipieza imprimible.
7. **Receta de ejercicios de MUSE:** semillas hechas por diseñadores, un LLM las varía, se genera la especificación y una persona revisa (abierta). Semillas = dispositivos que Fak ya aprobó.

**Sirve con modelo por API:** el embudo, los mutantes, los tests de propiedades, las vistas de ingeniería, el juez con rúbrica como último escalón, la biblioteca de componentes. **Solo entrenar:** ToolCAD, CAD-Coder, CAD-RL, cadrille, Text2CAD y los corpus DeepCAD/Fusion 360 como material de entrenamiento.

## Qué se buscó y no se encontró

- Currículo automático medido en un agente que **no** se entrena (solo por API): no apareció.
- Bancos de ejercicios de sargentos, posicionadores o plantillas de taladrado con especificación: no hay; lo más cercano es MUSE.
- Tamaño, licencia y estado de DeepCAD, Fusion 360 Gallery, ABC y Text2CAD: no los abrí; no doy cifras.
- Chequeos automáticos de imprimibilidad FDM (voladizos, orientación) o de cantos vivos en benchmarks: nada. MUSE solo menciona espesor mínimo de pared en impresión (abierta).
- Estrellas y último commit de CADSmith y CADTestBench: no los consulté. Texto completo de CAD-bench, FunCADBench y CADEngBench: no abierto (cupo agotado).
- Cifras de costo en dólares de practicar por API: sin fuente.

## Veredicto para este frente (2-4 frases; seguridad media-baja)

Lo primero a cambiar: convertir los controles de la skill en un embudo con puntaje por etapa y probarlos con mutantes de un diseño bueno (el virolador), antes de armar un banco de ejercicios o un juez de visión; el juez va último y como complemento. Después, un banco chico (10–15) de ejercicios con tests de propiedades, de una pieza a mecanismo, con semillas aprobadas por Fak. No entrenar ni armar lazos de RL: la mejora medida afuera es de entrenar pesos. Seguridad **media** en la dirección (embudo, mutantes, juez secundario: varias fuentes independientes, tres abiertas) y **baja** en cuánto mejora practicar, porque nadie lo midió para un agente por API en CAD y las fuentes más pertinentes por función (CAD-bench, FunCADBench, CADEngBench) son solo búsqueda.