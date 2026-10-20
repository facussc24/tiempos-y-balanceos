# Copilotos comerciales de CAD: lo que hay afuera
Consultado el 20/10/2026.

## Qué hay
Regla para leer la tabla: lo que dice el fabricante es marketing hasta que alguien independiente lo prueba. Casi todo lo «agente» está en beta, alfa o preview.

| Qué | Qué dice, en una frase | Fuente (link) | Fecha | abierta / solo búsqueda |
|---|---|---|---|---|
| Dassault AURA / LEO / MARIE (3DEXPERIENCE y SOLIDWORKS) | Desde CATIA R2026x FD03 están «globalmente disponibles» en la plataforma SaaS; LEO «interfaz directo con CATIA» y crea sólidos, partes y ensambles | https://blog.3ds.com/brands/catia/industrial-ai-catia-r2026x-fd03/ | 28/07/2026 | abierta |
| Lo mismo, visto por prensa | Dassault no publicó metodología del «30 % menos de tiempo» ni datos de exactitud independientes; solo funciona dentro de 3DEXPERIENCE | https://engtechnica.com/catia-expands-built-in-ai-across-design-and-engineering-workflows/ | 15/10/2026 | abierta |
| AURA, primera versión | Es guía/consulta de documentación y de 3DSwym, no diseña | https://blogs.solidworks.com/solidworksblog/2025/10/whats-new-in-solidworks-2026-collaboration-and-data-management.html | 10/2025 | solo búsqueda |
| SOLIDWORKS 2026 con IA, prueba de uso (competidor, 6 semanas) | «Assembly Structure Designer» crea carpetas y partes VACÍAS; dibujos IA ~70 % del camino; todo beta | https://blog.texocad.ai/posts/solidworks-ai-features-2026 | 25/02/2026 | abierta (corrida anterior) |
| SOLIDWORKS 2027 | LEO: dibujo desde el modelo, STEP→paramétrico, «Spec to CAD» y «Drawing to parametric» listados como «en desarrollo» | https://www.solidsolutions.co.uk/ai-in-solidworks/ | ~oct/2026 | solo búsqueda |
| Autodesk Fusion: AutoConstrain, Assistant | AutoConstrain sugiere restricciones de sketch; Assistant en Fusion es «Tech Preview» (puede fallar o ser inconsistente) | https://www.autodesk.com/products/fusion-360/blog/autodesk-assistant-in-fusion-a-step-by-step-guide/ | s/f (~mar/2026) | solo búsqueda |
| Autodesk AU 2026: AutoTimeline, AutoAssemble | Convierte geometría importada en pieza paramétrica; es preview, el calendario viene en 2027 | https://www.apollotechnical.com/autodesk-ai-imported-cad-editable-models/ | ~oct/2026 | solo búsqueda |
| Fusion MCP + Claude | Conector oficial: Claude crea/modifica/consulta geometría en una sesión viva de Fusion | https://claude.com/connectors/autodesk-fusion | 28/04/2026 | solo búsqueda |
| Fusion MCP, lectura crítica (competidor) | Sirve para piezas simples y variaciones; en ensamble de producción con tolerancias «no»; tratarlo como «junior rápido» | https://www.colabsoftware.com/post/autodesk-fusion-mcp-faster-cad-same-bottleneck | 19/05/2026 | solo búsqueda |
| Autodesk Assistant en Inventor 2027, prueba de uso | No puede crear features; solo analiza y genera código iLogic para copiar a mano | https://forums.autodesk.com/t5/community-blog-d-m-english/autodesk-assistant-in-inventor/ba-p/14104913 | ~ago/2026 | solo búsqueda |
| Onshape AI Advisor | Responde sobre Onshape con su documentación; «no tiene acceso a tus datos» | https://www.onshape.com/en/resource-center/what-is-new/ai-advisor-configurable-variable-studios-simulation | ~dic/2025 | solo búsqueda |
| Siemens NX / Solid Edge Design Copilot | Chatbot de ayuda; lo «duro» es mates automáticos y hasta 80 % de vistas de dibujo | https://news.siemens.com/en-us/siemens-designcenter-solid-edge-2026/ | ~oct/2025 | solo búsqueda |
| PTC Creo 13 AI Assistant | Advise (docs) / Assist (beta, lee el modelo) / Automate (alfa; cambia en un sandbox y espera aprobación) | https://www.ptc.com/en/products/creo | ~oct/2026 | solo búsqueda |
| Zoo / Zookeeper | Agente que escribe KCL en bucle: planifica, ejecuta, mide masa/volumen, mira renders; sin solver de ensamble | https://zoo.dev/research/zookeeper | 05/02/2026 | abierta |
| Zoo FAQ | Reglas persistentes por proyecto (AGENTS.md), una feature por vez; admite que puede dar geometría incorrecta | https://zoo.dev/docs/faq | s/f (2026) | abierta (corrida anterior) |
| catia-v5-mcp (AstroQuestStudio) | MCP para CATIA V5 por COM: lote con validación previa, 152 «trampas» registradas, volumen tras cada feature | https://github.com/AstroQuestStudio/catia-v5-mcp | s/f (2026); 0 ★, 3 commits | abierta |
| Otros MCP/copilotos para CATIA V5 | daiemon12 (98 tools), martinwiesner (80), RayDutchman/CATIA-Copilot v2.1.0 (R28), VladimirGarmanov/catia-AI (6 roles, verificador independiente) | https://github.com/RayDutchman/CATIA-Copilot | 06/06/2026 | solo búsqueda |
| FunCAD (paper) | Diseña mecanismos funcionales con pruebas físicas simuladas; halla fallas «invisibles a la inspección visual» | https://arxiv.org/abs/2610.26861 | ~oct/2026 | solo búsqueda |

## Fuentes (título — link — fecha — abierta/solo búsqueda)
Las de la tabla más las que usa `informe_2.md`:
- Industrial AI in CATIA R2026x FD03 — https://blog.3ds.com/brands/catia/industrial-ai-catia-r2026x-fd03/ — 28/07/2026 — abierta
- CATIA Expands Built-In AI (ENGtechnica) — https://engtechnica.com/catia-expands-built-in-ai-across-design-and-engineering-workflows/ — 15/10/2026 — abierta
- Zookeeper (Zoo) — https://zoo.dev/research/zookeeper — 05/02/2026 — abierta
- Zoo FAQ — https://zoo.dev/docs/faq — s/f — abierta (corrida anterior)
- catia-v5-mcp — https://github.com/AstroQuestStudio/catia-v5-mcp — s/f — abierta
- SolidWorks AI features 2026 (texocad) — https://blog.texocad.ai/posts/solidworks-ai-features-2026 — 25/02/2026 — abierta (corrida anterior)
- Best AI Tools for CATIA (Leo AI, competidor) — https://www.getleo.ai/blog/best-ai-tools-catia-2026 — ~abr/2026 — solo búsqueda
- AURA review (Leo AI) — https://www.getleo.ai/blog/solidworks-aura-review-2026 — ~abr/2026 — solo búsqueda
- Zoo Text-to-CAD Review (Leo AI) — https://www.getleo.ai/blog/zoo-text-to-cad-review — 26/09/2026 — solo búsqueda
- Zoo review (texocad) — https://blog.texocad.ai/posts/zoo-text-to-cad-review — ~oct/2026 — solo búsqueda
- A tale of three chatbots (Engineering.com) — https://www.engineering.com/a-tale-of-three-chatbots-aura-leo-and-marie/ — s/f (2026) — solo búsqueda
- Siemens NX CAM copilot (Engineering.com) — https://www.engineering.com/siemens-nx-is-getting-an-ai-copilot-for-cam/ — ~sep/2025 — solo búsqueda
- Creo «Triple A» (DEVELOP3D) — https://develop3d.com/cad/creo-ai-ptc-advances-its-roadmap/ — ~ago/2026 — solo búsqueda
- Autodesk AU 2026 — https://adsknews.autodesk.com/en/news/autodesk-ai-design-manufacturing-au-2026/ — ~sep/2026 — solo búsqueda
- Fusion MCP en Claude (foro Autodesk) — https://forums.autodesk.com/t5/fusion-api-and-scripts-forum/fusion-mcp-feedback-dialog-visibility-limitation-with-claude/td-p/14120453 — ~oct/2026 — solo búsqueda
- Text2CAD-Bench — https://arxiv.org/pdf/2605.18430 — 05/2026 — solo búsqueda
- BenchCAD — https://arxiv.org/html/2605.10865v1 — 05/2026 — solo búsqueda
- OmniCAD — https://arxiv.org/abs/2608.22637 — 23/08/2026 — solo búsqueda
- CoLab, SOLIDWORKS AI — https://www.colabsoftware.com/post/solidworks-ai — ~sep/2026 — solo búsqueda
- Xometry, entrevista a Zoo — https://xometry.pro/en/articles/ai-interviews-zoo/ — ~sep/2026 — solo búsqueda
- Hawk Ridge, SOLIDWORKS 2027 — https://hawkridgesys.com/blog/solidworks-whats-new-sneak-peek-fall-release — ~oct/2026 — solo búsqueda
- daiemon12/catia-v5-mcp-server — https://github.com/daiemon12/catia-v5-mcp-server — s/f — solo búsqueda
- VladimirGarmanov/catia-AI — https://github.com/VladimirGarmanov/catia-AI — s/f — solo búsqueda

## Lo que CONFIRMA lo que hace el sistema
Las referencias entre corchetes son las fuentes de `informe_1.md`.

- **Verificar con mediciones, no mirando.** Zookeeper ejecuta el modelo seguido, mira vistas múltiples y mide masa, centro de masa y volumen (Zoo, 05/02/2026, abierta). catia-v5-mcp parte de que «corrió» no es «está bien»: reporta el cambio de volumen de cada feature y verifica las poses finales del ensamble (abierta). El paper FunCAD (~oct/2026, solo búsqueda del resumen) dice que sus pruebas físicas simuladas muestran fallas «invisibles a la inspección visual». Es lo mismo que les pasó a ustedes con el virolador, y apoya poner la simulación de movimiento (manifold3d) como control que bloquea.
- **Editar de a una feature, no rehacer todo.** Zoo FAQ: plan de diseño primero y una feature por vez (abierta, corrida anterior). Zoo lo plantea como requisito: ediciones posteriores que preserven la intención (05/02/2026, abierta). Es el remedio al «rehacía el modelo entero en cada corrección».
- **Reglas persistentes y lecciones.** Zoo usa un AGENTS.md por proyecto (abierta). catia-v5-mcp lleva un registro de 152 trampas de COM verificadas; las críticas viajan como instrucciones del servidor y la lección pertinente se pega al error que la disparó (abierta, 0 ★, 3 commits: es una fuente chica). Es la misma idea que la skill y LECCIONES.
- **El humano decide lo que importa.** Creo Automate cambia el modelo en un sandbox y espera aprobación (PTC, ~oct/2026). NX CAM Copilot ofrece tres estrategias y elige el ingeniero (Engineering.com, ~sep/2025). La guía de Fusion Assistant recomienda pedirle que proponga los pasos antes de ejecutar (s/f). Dassault dice que cada sugerencia de LEO vuelve al usuario (marketing).
- **Lo que ya funciona en el mercado es lo aburrido y verificable:** restricciones de sketch, mates automáticos, hasta 80 % de vistas de dibujo (Siemens, ~oct/2025), diagnóstico de errores del árbol. La parte «diseñar» sigue en beta, alfa o preview. Marketing: «los resultados se chequean contra física» (Dassault, 28/07/2026). Demostrado con pruebas de uso: carpetas vacías en vez de geometría (texocad, 25/02/2026), Inventor sin poder crear features (~ago/2026), y un dibujo cargado en Fusion MCP que dio «una forma significativamente distinta» (foro Autodesk, ~oct/2026, testimonio de un usuario).

## Lo que lo CONTRADICE o le pone en duda
- **No hay un producto que copiar ni comprar para este caso.** Ninguna fuente muestra un copiloto con criterio de diseñador para utillajes imprimibles. Dassault ofrece «chequeo de manufacturabilidad» sin datos independientes (ENGtechnica, 15/10/2026); no encontré nada de FDM. Que los grandes dejen el diseño al humano o detrás de aprobación sugiere que la ambición del sistema (que la IA diseñe con vos el dispositivo entero) va más lejos que lo demostrado afuera. (opinión)
- **Los modelos solos fallan en lo que ustedes sufren.** BenchCAD (05/2026): el modelo acierta la familia de la pieza pero falla detalles locales y ediciones localizadas; Opus 4.7 saca 0,526 de total. OmniMech (~ago/2026): features omitidas y cotas incorrectas. OmniCAD (23/08/2026): poses inválidas e interpenetración. Text2CAD-Bench (05/2026): 30,6 % de modelos inválidos con GPT-5.2 y 41,3 % con Claude-4.5-Sonnet; ojo, mide generar UNA pieza desde texto, no iterar con herramientas. Todos solo búsqueda.
- **Fuentes que se contradicen:**
  - SOLIDWORKS dice «AI-powered drawings» (2026); Leo AI (~abr/2026) dice que AURA no genera dibujos con IA; texocad (25/02/2026), con prueba propia, los ve ~70 % del camino.
  - Leo AI (15/05/2026) decía que Zoo genera malla; el mismo sitio (26/09/2026) dice paramétrico editable; Zoo documenta B-Rep.
  - Leo AI (~abr/2026) decía que LEO de Dassault no estaba lanzado; Dassault lo declara disponible el 28/07/2026. Es cuestión de fecha.
- **Conflicto de interés.** Leo AI, CoLab y texocad venden productos que compiten con los que critican. Zoo y Dassault venden lo que elogian. Casi no hay evaluación independiente. El A/B de Zoo (una sola evaluación, «un centésimo» de la mano de obra) es afirmación del fabricante (Xometry, ~sep/2026).
- **Solo CATIA 3DEXPERIENCE.** Los copilotos de Dassault no sirven para V5 (ver el veredicto).

## Lo que no se les había ocurrido
- **Un punto de control de plan antes de la geometría** (Fusion y Zoo): el mecanismo y los apoyos se aprueban en texto o croquis antes de modelar cualquier carcasa. Ataca «se metió en la estética antes que el mecanismo». (opinión)
- **Sandbox con antes/después** (Creo): cada corrección sobre una copia con reporte de volumen y diferencias; el original no se pisa hasta el OK. (opinión)
- **Roles por restricción, no por inteligencia.** Dassault admite que sus tres «compañeros» son la misma inteligencia con distinto contexto y restricciones: AURA «explora todo» sin importar si es realista y LEO solo propone lo fabricable (Engineering.com, s/f, solo búsqueda). Un rol «mecanismo-primero» y otro «revisor severo» serían así. Ya tienen revisión ciega; faltaría fijar el orden.
- **Recortar las herramientas que ve el modelo.** catia-v5-mcp anuncia solo el conjunto de tools que la tarea necesita porque más de 100 esquemas abruman a un modelo chico (abierta). También trae niveles de permiso lectura/escritura, un vigía que cierra ventanas emergentes que cuelgan CATIA, limpieza de la feature que falló y designar geometría por puntos 3D y no por nombres. Para leer, no para instalar.
- **Reusar es un problema de búsqueda.** Autodesk anuncia búsqueda en lenguaje natural en Vault (preview, ~oct/2026) y Leo AI vende «ver si hace falta geometría nueva» (blog de competidor). Ningún copiloto de generación mira lo ya existente (Leo AI sobre Zoo, 26/09/2026). La palanca ya hecha se resolvería con un índice de piezas propias consultado antes de dibujar. (opinión)
- **Importar y reconstruir lo probado.** AutoTimeline (preview) y STEP→paramétrico de SOLIDWORKS 2027 apuntan a no redibujar. (opinión: la palanca existente se importa tal cual.)
- **Contar tras cambios masivos.** En una prueba de Autodesk Assistant en Revit, un comando «completo» se saltó una hoja (Interscale, ~oct/2026, solo búsqueda; es AEC, no mecánica).
- **Ajustar con ejemplos propios.** Zoo ofrece afinar con ~100 modelos nativos de una familia (FAQ, abierta). Sin datos de resultado.

## Qué se buscó y no se encontró
- Ninguna prueba de uso independiente de LEO/AURA sobre CATIA después de FD03 (28/07/2026).
- Nada sobre copilotos que revisen estética, cantos vivos, ergonomía o apoyo sobre superficie blanda. Nada de FDM en utillajes.
- Nada oficial de Dassault para V5; Leo AI (~abr/2026, competidor) dice que no hay hoja de ruta de IA para V5.
- No pude abrir el paper FunCAD (se agotó el límite de lecturas): solo el resumen. No abrí las páginas de Siemens, PTC, Onshape ni Autodesk (solo búsqueda).
- Estrellas y último commit: solo medí catia-v5-mcp (0 ★, 3 commits). De los otros repos de V5 no tengo ese dato. Versión de V5 declarada: R19 (AstroQuest, en francés), «R2016+» (daiemon12, martinwiesner) y R28 (CATIA-Copilot). No sé cuál es la de ustedes.
- Precio o licencia de LEO: no lo leí.

## Veredicto para este frente (2-4 frases; seguridad alta/media/baja y por qué)
Ningún copiloto comercial sirve para CATIA V5 ni hace lo que necesitan; lo único cercano son MCP comunitarios chicos y sin madurez que ya hacen por COM lo que ustedes hacen. Lo que sí deja el mercado son tres cambios de proceso, en este orden (opinión): primero un control de plan donde el ingeniero aprueba el mecanismo y los apoyos antes de modelar la carcasa y la simulación de movimiento bloquea el avance a estética; segundo, buscar en un índice de piezas existentes antes de dibujar; tercero, correcciones sobre copia con reporte de volumen y diferencias. Seguridad **media**: la evidencia independiente es escasa y casi todo viene del fabricante o de un competidor, pero los patrones de verificar con herramientas, editar de a una feature y aprobar antes de aplicar aparecen en fuentes de bandos opuestos.