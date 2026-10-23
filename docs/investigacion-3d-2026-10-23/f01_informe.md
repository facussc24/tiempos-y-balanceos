# IA que diseña CAD (texto a CAD y agentes con lazo de verificación): lo que hay afuera
Consultado el 20/10/2026.

Aviso de método: las fechas de los arXiv salen del número de identificación (AAMM). Las cifras de cada benchmark son de ESE benchmark; ninguno es una pieza de utillaje impresa en FDM. Abrí 5 páginas + 1 PDF con web_fetch (CAD-bench, MUSE, CADEngBench, cadbench.ai, el repo agentic-3d-design y el PDF de Hephaestus-CCX); el resto es «solo búsqueda» (fragmentos del buscador), y el web_fetch me falló varias veces con «no more web_fetch» en URLs de arXiv 2610.

## Qué hay

| Qué | Qué dice, en una frase | Fuente (link) | Fecha | abierta/solo búsqueda |
|---|---|---|---|---|
| CADCodeVerify + CADPrompt (ICLR 2025) | El referente de «renderizar, preguntar a un VLM, corregir»: con GPT-4 baja 7,3 % la distancia de nubes y sube ~5 % la tasa de compilación frente a lo previo. Mejora chica. | https://arxiv.org/abs/2410.05340 | oct 2024 (ICLR 2025) | solo búsqueda |
| CADEngBench (8 modelos, un intento) | De 2.400 programas, 1.030 son sólidos válidos y solo 432 cumplen además los requisitos de ingeniería: «el 58,1 % de los ejecutables viola algún requisito». Claude Sonnet 4.5: 58,0 % válido, 28,3 % cumple requisitos. | https://arxiv.org/html/2608.09296v1 | ago 2026 | abierta |
| CADEngBench, edición vs generar | Editar una pieza dada es mucho más fácil que generarla: 1.071 casos pasan solo editando, 231 solo generando. Pero las ediciones acopladas (uniones, cortes, varios cuerpos) caen a 40–46 %. | https://arxiv.org/html/2608.09296v1 | ago 2026 | abierta |
| CADEngBench-A, ensamblajes | Acertar el par de caras correcto es fácil (542/960 primeros puestos), pero definir la junta completa y su sistema de ejes: solo 11,5 % de punta a punta. Si la junta está bien definida, el movimiento anda siempre. | https://arxiv.org/html/2608.09296v1 | ago 2026 | abierta |
| CAD-bench (workshop de ICML 2026) | 17 tareas hasta engranajes y roscas, con simulación rígida en Blender: el mejor modelo suelto llega a 59,9 % global y las tareas funcionales «casi cero»; los arneses de agente rinden más pero fallan en interfaces y mecanismos. | https://icml.cc/virtual/2026/67851 | 2026 (s/f) | abierta |
| Hephaestus-CCX (FEA como juez, Claude Code y Codex) | 400 primeros intentos de Opus 4.7/Sonnet 4.6/GPT-5.x: cero piezas que pasen todo. Con 10 ciclos de feedback y 68 min por caso, GPT-5.5 llega a 60,5 % de requisitos y 9/50 piezas perfectas. | https://arxiv.org/pdf/2605.17448 | 27/05/2026 | abierta |
| FunCADBench / FunCAD-Harness | 46 familias de mecanismos (pinzas, transmisiones, contadores). Los fallos sutiles son «invisibles a la inspección visual»; los agentes usan sobre todo código y simulación, poco imagen. | https://arxiv.org/abs/2610.26861 | 19/10/2026 | solo búsqueda |
| MUSE | Ensamblajes de CadQuery juzgados en 3 etapas: «cascada» de falla código → geometría válida → intención de diseño; los renders pueden esconder fallas por perspectiva y oclusión. | https://arxiv.org/html/2605.28579v2 | 04/06/2026 | abierta |
| CADSmith (repo jabarkle/CADSmith) | Medidas del kernel OCCT + 3 vistas a un VLM independiente. Sobre 100 prompts propios: ejecución 95→100 %, distancia Chamfer media 28,37→0,74. Sin las vistas, en piezas complejas la distancia sube de 1,42 a 49,68. | https://arxiv.org/pdf/2603.26512 · https://github.com/jabarkle/CADSmith | mar 2026 | solo búsqueda |
| CADTests / CADTestBench | Evaluar con pruebas ejecutables sobre el B-rep y no contra una pieza de referencia: el Chamfer engaña (lejos pero cumple, o cerca pero falla). Cumplir 10 requisitos es mucho más difícil que 2. | https://arxiv.org/html/2605.07807v1 · https://github.com/dimitrismallis/CADTestBench | may 2026 | solo búsqueda |
| ArtiCAD | Articulados con 4 agentes: define conectores y juntas ANTES de generar geometría y, si falla, re-invoca solo al agente responsable (fallo de DISEÑO vs de CÓDIGO). Evalúa con jueces VLM, no con simulación. | https://arxiv.org/html/2604.10992v2 | abr 2026 | solo búsqueda |
| ReliCAD | Reparación localizada por etapa: «evita regenerar todo el modelo». | https://arxiv.org/html/2609.22325 | sep 2026 | solo búsqueda |
| ArtisanCAD | Agente sobre CATIA (backend CATIA-MCP) con «habilidades» destiladas de grabaciones de expertos, probado en 4 componentes automotrices; sin esas habilidades no completa las piezas. | https://arxiv.org/abs/2607.05750 | jul 2026 | solo búsqueda |
| Parametric CAD Bench V3 (cadbench.ai) | 100 tareas en FreeCAD. Claude Code + Opus 5.5: 61,0 % global; «crear + editar» 39,7 %; costó US$ 574 la corrida entera. Lo aloja una empresa del rubro. | https://cadbench.ai/ | 24/09/2026 | abierta |
| Prompt2Craft (ensamblajes con LLM) | La causa principal de falla (69,1 %) es la validación de colisiones entre piezas no conectadas. | https://arxiv.org/pdf/2512.04568 | dic 2025 | solo búsqueda |
| BenchCAD | ~64 % de las ediciones «exitosas» rompen en silencio rasgos no relacionados. | https://arxiv.org/html/2605.10865v1 | may 2026 | solo búsqueda |
| AgentsCAD (DFM para FDM) | Detecta voladizos >45° en el B-rep y propone filetes/chaflanes; la prueba es una sola pajarera. | https://arxiv.org/abs/2607.02448 | jul 2026 | solo búsqueda |

## Fuentes (título — link — fecha — abierta/solo búsqueda)
- Generating CAD Code with VLMs for 3D Designs — https://arxiv.org/abs/2410.05340 — oct 2024 — solo búsqueda (repo: https://github.com/Kamel773/CAD_Code_Generation — s/f)
- CADEngBench — https://arxiv.org/html/2608.09296v1 — ago 2026 — abierta
- CAD-bench: Functional CAD Generation (ICML 2026, workshop) — https://icml.cc/virtual/2026/67851 — 2026 — abierta
- Self-Improving CAD Generation Agents with FEA as Feedback — https://arxiv.org/pdf/2605.17448 — 27/05/2026 — abierta
- Can It Actually Work? Synthesizing Functional CAD Mechanisms — https://arxiv.org/abs/2610.26861 — 19/10/2026 — solo búsqueda
- MUSE — https://arxiv.org/html/2605.28579v2 — 04/06/2026 — abierta
- CADSmith — https://arxiv.org/pdf/2603.26512 y https://github.com/jabarkle/CADSmith — mar 2026 — solo búsqueda
- Text-to-CAD Evaluation with CADTests — https://arxiv.org/html/2605.07807v1 — may 2026 — solo búsqueda
- ArtiCAD — https://arxiv.org/html/2604.10992v2 — abr 2026 — solo búsqueda
- ReliCAD — https://arxiv.org/html/2609.22325 — sep 2026 — solo búsqueda
- ArtisanCAD — https://arxiv.org/abs/2607.05750 — jul 2026 — solo búsqueda
- Parametric CAD Bench V3 — https://cadbench.ai/ — 24/09/2026 — abierta
- Prompt2Craft — https://arxiv.org/pdf/2512.04568 — dic 2025 — solo búsqueda
- BenchCAD — https://arxiv.org/html/2605.10865v1 — may 2026 — solo búsqueda
- AgentsCAD — https://arxiv.org/abs/2607.02448 — jul 2026 — solo búsqueda
- Physics-in-the-Loop (IJCAI-ECAI 2026) — https://arxiv.org/abs/2605.19717 — may 2026 — solo búsqueda
- ToolCAD — https://arxiv.org/pdf/2604.07960 — abr 2026 — solo búsqueda
- Compositional Machine Design as Program Synthesis — https://arxiv.org/pdf/2510.14980 — oct 2025 — solo búsqueda
- Test-Time Scaling for CAD via Consensus Selection — https://arxiv.org/pdf/2608.09706 — ago 2026 — solo búsqueda
- agentic-3d-design (eschmitt88) — https://github.com/eschmitt88/agentic-3d-design — creado 16/06/2026, 0 estrellas, 22 commits — abierta
- PrintPal, guía de diseño para impresión (producto comercial) — https://printpal.io/docs/3d-printing-design-guide — s/f — solo búsqueda

## Lo que CONFIRMA lo que hace el sistema
- **Código + lazo contra el kernel, no mirar la imagen sola.** CADSmith mide con OpenCASCADE (caja, volumen, sólido válido) y baja el error medio de 28,37 a 0,74 frente a un solo disparo (https://arxiv.org/pdf/2603.26512, mar 2026, solo búsqueda). El PDF de Hephaestus (abierto) muestra 9 piezas que pasaron tras el ciclo de feedback: en 5 el arreglo no se veía en renders y en 4 «parcialmente» (https://arxiv.org/pdf/2605.17448, 27/05/2026). FunCAD, de ayer, dice lo mismo para mecanismos (https://arxiv.org/abs/2610.26861, solo búsqueda).
- **Medir lo que se mueve con simulación propia.** CAD-bench puntúa los mecanismos con simulación de cuerpo rígido (https://icml.cc/virtual/2026/67851, abierta). En CADEngBench, cuando la junta está bien definida el movimiento «siempre» se completa; el error está en elegir caras, tipo de junta y ejes (https://arxiv.org/html/2608.09296v1, abierta). Eso apoya bajar de minutos a segundos con manifold3d: el cuello de botella no es el motor de movimiento.
- **Editar en vez de regenerar.** En 2.330 pares, 1.071 pasan solo editando y 231 solo generando (4,64 veces) (CADEngBench, abierta). ReliCAD enruta el error a la etapa responsable y evita regenerar todo (https://arxiv.org/html/2609.22325, sep 2026, solo búsqueda); ArtiCAD distingue fallo de DISEÑO y de CÓDIGO y re-invoca solo al responsable (https://arxiv.org/html/2604.10992v2, abr 2026, solo búsqueda).
- **Colisiones como control obligatorio.** En Prompt2Craft el 69,1 % de los fallos vino de la validación de colisiones, sobre todo entre piezas no conectadas (https://arxiv.org/pdf/2512.04568, dic 2025, solo búsqueda).
- **«Skill» con criterio de experto sobre CATIA.** ArtisanCAD destila grabaciones de expertos en habilidades paramétricas con reglas de verificación y las corre en CATIA; sin esas habilidades, el agente no completa las piezas industriales (https://arxiv.org/abs/2607.05750, jul 2026, solo búsqueda; no vi números de éxito).

## Lo que lo CONTRADICE o le pone en duda
- **El éxito real es bajo y no hay un número para «utillaje».** Mejor modelo suelto en CAD-bench: 59,9 % global y funcional «casi cero» (abierta). CADEngBench: 28,3 % cumple requisitos con Claude Sonnet 4.5, un intento (abierta). Hephaestus: 0 de 400 primeros intentos de Opus 4.7/Sonnet 4.6 y GPT-5.x pasan todo; con 10 ciclos y 68 min por caso, 9 de 50 (abierta). Cadbench.ai: «crear + editar» 39,7 % con Opus 5.5 en Claude Code, a US$ 574 la corrida de 100 tareas (https://cadbench.ai/, 24/09/2026, abierta; lo aloja una empresa del rubro). Ninguno es una pieza FDM con ingeniero en el lazo: no se puede traducir a «tasa de éxito en la planta» (opinión).
- **Los renders no son inútiles.** Sin las 3 vistas, en piezas complejas la distancia media de CADSmith sube de 1,42 a 49,68 (repo https://github.com/jabarkle/CADSmith, solo búsqueda). En Hephaestus, 21 vistas suben GPT-5.5 de 19,4 a 29,3 % de requisitos; con Claude el efecto es chico o mixto (abierta). Y 7 vistas a veces rinden igual que 21. Los renders sirven para forma; no para función.
- **Dos fuentes, dos épocas.** CADCodeVerify (oct 2024) vende el feedback visual de un VLM (https://arxiv.org/abs/2410.05340, solo búsqueda). FunCAD (19/10/2026) y MUSE (jun 2026) dicen que ese tipo de feedback pierde fallas sutiles (MUSE, abierta). Pesa más lo reciente, pero FunCAD solo lo vi por el resumen.
- **Más razonamiento no es la palanca.** En Hephaestus el esfuerzo alto no mejora de forma monótona; lo que escala es el feedback concreto. Claude arranca mejor, gana menos con el ciclo y Opus 4.7 xhigh retrocede un poco en una pieza simple (abierta). Elegir N candidatos y quedarse con el «más central» mejora 1–10 % y se agota hacia N≈9 (https://arxiv.org/pdf/2608.09706, ago 2026, solo búsqueda).
- **Editar no es gratis.** CADEngBench: edición simple 247/248, pero con uniones, cortes o varios cuerpos 40–46 % (abierta). BenchCAD (may 2026): ~64 % de las ediciones «exitosas» rompen rasgos no relacionados (https://arxiv.org/html/2605.10865v1, solo búsqueda). Los dos protocolos difieren, pero sirven para pensar en un control de «lo demás no cambió».
- **Evidencia floja.** Casi todo es preprint, una sola corrida sin intervalos (Hephaestus lo admite), 17 tareas en CAD-bench (póster de workshop), 100 prompts propios en CADSmith con métrica de parecido a una referencia, una sola pajarera en AgentsCAD (https://arxiv.org/abs/2607.02448). Casi todo usa CadQuery o FreeCAD; ninguna fuente mide build123d.

## Lo que no se les había ocurrido
1. **Escribir el examen antes de modelar.** CADTests trata cada pedido como predicados ejecutables sobre el B-rep, sin pieza de referencia (https://github.com/dimitrismallis/CADTestBench, may 2026, solo búsqueda). Hephaestus pide un `blueprint.yaml` con envolventes, interfaces bloqueadas y «acceptance_claims» antes de escribir CAD (abierta). Para el virolador: recorrido de la palanca, holgura mínima, radio mínimo de canto y pared mínima, definidos ANTES; sin pasar eso no se toca la estética (opinión, ataca el primer problema).
2. **Juntas primero, geometría después.** ArtiCAD fija conectores y juntas en la etapa de diseño para esquivar el razonamiento espacial débil de los modelos (abr 2026, solo búsqueda); el ensamblado lo hace un solucionador, sin LLM.
3. **Barrer, no probar un solo estado.** CADEngBench re-ejecuta la misma `build(params)` con valores por defecto, intermedios y en el borde: 22 de 435 casos cambian de veredicto lejos del valor por defecto (abierta). Aplicable a las posiciones de la palanca (opinión).
4. **Feedback con margen, no «pasó/falló».** En Hephaestus el segundo salto grande vino cuando el informe pasó a traer márgenes y el selector fallido (abierta). Un control que diga «faltan 0,4 mm de holgura en esta cara» corrige más rápido que uno binario (opinión).
5. **Controles ocultos y contrato del chequeador.** CADEngBench guarda chequeos de conservación que el modelo no ve (abierta). En Hephaestus 3 de 9 aprobaciones fueron por nombres de métrica o masa mal enlazados, no por física: si el control propio se rompe por un nombre, o la IA puede «arreglar» el control, el verde no vale (opinión).
6. **Checks FDM concretos ya publicados.** CADEngBench usa pared mínima 1,0 mm, agujero mínimo 2,0 mm y profundidad/diámetro ≤ 8 (abierta). PrintPal chequea estanco, pared 1,6 mm por defecto, caja contra lo prometido y geometría flotante (https://printpal.io/docs/3d-printing-design-guide, s/f, comercial, solo búsqueda).

## Qué se buscó y no se encontró
- Tasa de éxito en utillajes, posicionadores, prensas manuales o viroladores, o en piezas FDM con palanca: nada. Lo más cercano son las pinzas de FunCADBench.
- **Reusar una pieza hecha en vez de dibujarla:** ningún paper lo mide aislado. Solo ArtisanCAD (habilidades de experto) y Articraft (biblioteca de fragmentos de código) lo insinúan (https://arxiv.org/pdf/2605.15187, may 2026, solo búsqueda).
- Estética, cantos que lastiman o «cajas peladas»: ningún benchmark lo mide. La «manufacturabilidad» de MUSE es pared mínima y malla cerrada.
- Estudio de «función antes que forma»: ninguno; lo más parecido es el plan previo de Hephaestus, con efecto mixto (+0,3 puntos GPT, +3,9 Claude).
- No pude abrir FunCADBench ni leer números de ArtiCAD, ArtisanCAD o CADSmith más allá de fragmentos.

## Veredicto para este frente
Lo primero que cambiaría: **contrato de aceptación ejecutable antes de modelar** (mecanismo, holguras, colisión barriendo posiciones, pared y radio mínimos FDM) y **edición localizada con control de «lo demás no cambió»**, en lugar de rehacer el modelo; las dos cosas las apoyan fuentes abiertas e independientes (CADEngBench, Hephaestus, MUSE). Seguridad **media-alta** en esa dirección y **baja** en cualquier cifra de éxito: son preprints, una corrida, piezas que no son las suyas. No gastaría en más razonamiento, en generar N candidatos ni en más renders; y nada de esto autoriza a quitar al ingeniero del lazo.