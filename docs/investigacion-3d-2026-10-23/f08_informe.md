# Repos y arquitecturas para implementar el sistema entero: lo que hay afuera
Consultado el 20/10/2026. Ya estaban en la investigación del 17/10 (no se repiten): text-to-cad, build123d-mcp 0.3.83/0.3.90, catia-v5-mcp-server, freecad-mcp, Multi-Agent-CAD, cad-cae-copilot. Acá va lo nuevo o lo que lo cuestiona. Con web_fetch no se puede pedir la API de GitHub: donde no vi estrellas o último commit, lo digo.

## Qué hay

| Qué | Qué dice, en una frase | Fuente | Fecha | Estado |
|---|---|---|---|---|
| **text-to-cad** (earthtojake) | Plugin para Claude Code/Codex/Cursor: genera STEP/GLB/STL/3MF, chequeos DFM, planos. 21,4k ★, 2,1k forks, MIT, 1.459 commits. Corre con `uv` + Python 3.11+. **Manda telemetría por defecto** (se apaga con `uvx cadgen telemetry off`). | [repo](https://github.com/earthtojake/text-to-cad) | 20/10/2026; último commit no visible (17/10 según informe previo) | abierta |
| **build123d-mcp** (pzfreo) | Sesión persistente con snapshots; `measure`, `validate`, `clearance`, `cross_sections`, `design_audit`, `analyze_printability`, `verify_spec` (experimental), biblioteca de partes con `--library`. Sandbox sin `open`/`os`. Estrellas: 95 (caché de esta lectura), 113 (17/10), 27 (perfil del autor, s/f): no coinciden. Licencia Apache-2.0 (informe previo). Windows: no verificado hoy. | [llms.md](https://github.com/pzfreo/build123d-mcp/blob/main/llms.md) | s/f | abierta |
| **augura** (pzfreo) | Analiza imprimibilidad FDM sobre el STEP exacto: voladizos, pared mínima, vuelco por centro de masa, orientación óptima, ajuste a la cama. `--exit-code` sirve de gate. **1 ★, pre-alpha**, Apache-2.0, 74 commits. | [repo](https://github.com/pzfreo/augura) | 20/10/2026 | abierta |
| **estampo + bambox** (pzfreo / estampo) | estampo: un `.toml` fija piezas, perfil y versión del slicer (OrcaSlicer en Docker) para G-code idéntico. bambox: empaqueta G-code en `.gcode.3mf` de Bambu; se declara «experimental». ~11 y ~2 ★ (s/f). | [estampo.dev](https://estampo.dev/), [bambox](https://github.com/estampo/bambox) | s/f | solo búsqueda |
| **OrcaSlicer por línea de comandos** | Corre sin ventana: `--load-settings`, `--load-filaments`, `--slice 0`, `--export-3mf`; el `.gcode.3mf` es lo que consume Bambu. Hay un ejemplo con carpeta vigilada en Windows. | [wiki](https://www.orcaslicer.com/wiki/cli/cli_mode), [discusión #8593](https://github.com/OrcaSlicer/OrcaSlicer/discussions/8593) | s/f; discusión dic 2025 | solo búsqueda |
| **orca-mcp** (jeff-roche) | Envoltorio MCP del CLI: `get_model_info`, `slice_model`, `parameter_sweep`. Aviso propio: el CLI es un subconjunto de la GUI. | [repo](https://github.com/jeff-roche/orca-mcp) | s/f | solo búsqueda |
| **Envío a Bambu** | El firmware 2025 «Authorization Control» limita la LAN a terceros; MQTT/FTPS local pide modo solo-LAN + Developer Mode y cambia según modelo. Existe un MCP que saltea la autenticación con un certificado extraído. | [issue #85](https://github.com/HoffmanEngineering/printlog-bridge/issues/85), [bambu-mcp](https://glama.ai/mcp/servers/schwarztim/bambu-mcp) | issue: hace ~4 días; resto s/f | solo búsqueda |
| **jarvis-onshape-mcp** (ReshefElisha) | Cada cambio devuelve `{ok, status, error, changes, hints}` y un diff (caja, masa, nº de piezas); IDs de cara estables; skill que arma un árbol de features que el humano revisa antes de construir. 174 ★, 38 forks, MIT. Va contra Onshape (nube, cuenta). | [repo](https://github.com/ReshefElisha/jarvis-onshape-mcp) | 20/10/2026 | abierta |
| **Otros MCP de Onshape** | gpambrozio (87 tools), nakomis (51), Casys-AI (100). altendky se define «un ayudante para quien ya sabe Onshape». | [gpambrozio](https://github.com/gpambrozio/onshape-mcp), [altendky](https://github.com/altendky/onshape-mcp) | s/f | solo búsqueda |
| **MCP de Fusion** | Varios add-ins (frankhommers, faust-machines, AuraFriday 107 ★). kurby1996 avisa que agrupar operaciones en una llamada cuelga el add-in. | [frankhommers](https://github.com/frankhommers/autodesk-fusion-mcp), [kurby1996](https://github.com/kurby1996/fusion360-mcp-server) | s/f | solo búsqueda |
| **MCP de CadQuery** | El oficial vive en `cadquery-contrib/mcp-server`; rishigundakaram (`generate` es un stub); bertvanbrakel (biblioteca de partes, ~561 días sin tocar); Casys `mcp-build123d` (exporta con garantías solo en macOS/Linux). | [contrib](https://github.com/CadQuery/cadquery-contrib), [Casys](https://github.com/Casys-AI/mcp-build123d) | s/f | solo búsqueda |
| **bd_warehouse** (gumyr) | Partes paramétricas normalizadas: fijaciones, rodamientos, roscas, bridas, engranajes. Docs del 07/10/2026. Licencia: sin fuente. | [docs](https://bd-warehouse.readthedocs.io/_/downloads/en/latest/pdf/) | 07/10/2026 | solo búsqueda |
| **Son et al., FEA como feedback** | 400 primeros intentos de Claude Code y Codex: ningún aprobado estricto. Detalle en informe_2. | [arXiv 2605.17448](https://arxiv.org/abs/2605.17448) | 27/05/2026 | abierta |
| **CADSmith** (CMU) | Validación con el kernel OCC + juez independiente con modelo mayor + multivista; reporta distancia Chamfer 28,37 → 0,74 contra una sola pasada. | [alphaxiv](https://www.alphaxiv.org/abs/2603.26512v1) | 27/03/2026 | solo búsqueda |
| **Chequeos de imprimibilidad (otros)** | PR de `dfam-check` en text-to-cad (pared por rayos, ranking de 6 orientaciones; no sé si se aceptó). Issue en 3d-cli: en 3MF multicolor las interfaces se miden como paredes finas falsas. | [PR #265](https://github.com/earthtojake/text-to-cad/pull/265), [issue #81](https://github.com/alex-mextner/3d-cli/issues/81) | s/f; issue ~9 días | solo búsqueda |

## Fuentes (título — link — fecha — estado)
- text-to-cad README — https://github.com/earthtojake/text-to-cad — 20/10/2026 — abierta
- build123d-mcp llms.md — https://github.com/pzfreo/build123d-mcp/blob/main/llms.md — s/f — abierta
- augura README — https://github.com/pzfreo/augura — 20/10/2026 — abierta
- jarvis-onshape-mcp README — https://github.com/ReshefElisha/jarvis-onshape-mcp — 20/10/2026 — abierta
- Self-Improving CAD Generation Agents with FEA — https://arxiv.org/abs/2605.17448 — 27/05/2026 — abierta (PDF completo)
- estampo — https://estampo.dev/ — s/f — solo búsqueda
- bambox (PyPI) — https://pypi.org/project/bambox/ — s/f — solo búsqueda
- build123d-mcp CHANGELOG (analyze_printability v0.3.41, 09/06/2026) — https://github.com/pzfreo/build123d-mcp/blob/main/CHANGELOG.md — solo búsqueda
- OrcaSlicer CLI Mode — https://www.orcaslicer.com/wiki/cli/cli_mode — s/f — solo búsqueda
- Orca CLI reference (Printago, v2.4.0) — https://printago.io/blog/orca-slicer-cli-reference — s/f — solo búsqueda
- PR #16010 OrcaSlicer (crash del CLI con pantalla, Linux) — https://github.com/OrcaSlicer/OrcaSlicer/pull/16010 — s/f — solo búsqueda
- Bambu LAN/Authorization Control — https://github.com/HoffmanEngineering/printlog-bridge/issues/85 — hace ~4 días — solo búsqueda
- Foro Bambu sobre Bambu Connect (blog/foro: solo como indicio) — https://forum.bambulab.com/t/updates-and-third-party-integration-with-bambu-connect/137408?page=2 — s/f — solo búsqueda
- Bambu Lab MCP (certificado extraído) — https://glama.ai/mcp/servers/schwarztim/bambu-mcp — s/f — solo búsqueda
- AccelerationConsortium/bambu-server (solo monitoreo) — https://github.com/AccelerationConsortium/bambu-server — s/f — solo búsqueda
- build123d, herramientas externas (PartCAD, bd_warehouse) — https://build123d.readthedocs.io/en/stable/external.html — s/f — solo búsqueda
- IterCAD — https://arxiv.org/html/2606.13368v3 — 2026 — solo búsqueda
- Zero-to-CAD — https://arxiv.org/html/2604.24479 — 27/04/2026 — solo búsqueda

## Lo que CONFIRMA lo que hace el sistema
- **Medir antes que mirar.** build123d-mcp dice textual «Prefer measure() over render_view()» ([llms.md](https://github.com/pzfreo/build123d-mcp/blob/main/llms.md), abierta). Coincide con los gates numéricos de la skill.
- **Bucle generar → verificar → refinar con juez aparte.** CADSmith pone un validador independiente con un modelo más capaz ([alphaxiv](https://www.alphaxiv.org/abs/2603.26512v1), solo búsqueda, 27/03/2026). Es la revisión ciega que la casa ya tiene. Ojo: su métrica es distancia a una pieza de referencia, no que funcione.
- **Un controlador determinista aparte del agente.** El paper de Son et al. lo hace así: el controlador ejecuta, mide y valida; el agente decide ([arXiv](https://arxiv.org/abs/2605.17448), abierta, 27/05/2026).
- **Sesión persistente y sandbox**, sin `open` ni `os` ([llms.md](https://github.com/pzfreo/build123d-mcp/blob/main/llms.md), abierta). Es lo que ya usan.
- **manifold3d es de uso corriente** para booleanas rápidas en mallas ([issue 3d-cli #81](https://github.com/alex-mextner/3d-cli/issues/81), solo búsqueda). No encontré nada que contradiga el cambio que hicieron.

## Lo que lo CONTRADICE o le pone en duda
- **Pasar los controles no prueba que sirva.** Con 400 primeros intentos, Claude Code y Codex no lograron ni un aprobado estricto; la mejor configuración cumplió ~20 % de los requisitos ([arXiv](https://arxiv.org/abs/2605.17448), abierta). Varias fallas no se ven en el render (masa, densidad, nombres de métricas): «rendered-view feedback alone is insufficient». Un sistema que se autoverifica con geometría y vistas puede pasar de largo errores funcionales. (Son pruebas de estructuras con FEA, no utillajes impresos: la transferencia es una inferencia mía.)
- **La guía escrita ayuda menos de lo que se espera, y depende del modelo.** El «blueprint» previo movió casi nada en el puntaje de ingeniería de GPT (+0,3 puntos) y +3,9 en Claude; sí mejoró la geometría (~0,09 de IoU en GPT). Sin intervalos de confianza: los autores lo admiten.
- **Más razonamiento no es lo que mejora.** «high» a veces le gana a «xhigh»; lo que sube el puntaje es repetir con evidencia concreta (38,8 % → 60,5 %, 9/50 aprobados) a costa de pasar de 10 a 68 minutos por ítem. Opus xhigh fue mejor en el primer intento pero empeoró un poco al recibir feedback.
- **Madurez de lo que habría que copiar.** augura: 1 estrella y pre-alpha; bambox: «Experimental software — use at your own risk»; la cadena augura→estampo→bambox es de un solo autor. Las estrellas de build123d-mcp no coinciden entre fuentes (27/95/113). (opinión) No es base para depender sin pinear versiones.
- **Bambu no es plug-and-play.** Hubo un firmware que restringió la LAN a terceros; hoy hace falta modo solo-LAN + Developer Mode, y cambia por modelo ([issue #85](https://github.com/HoffmanEngineering/printlog-bridge/issues/85), solo búsqueda). Un foro cita que Bambu dijo que solo su slicer envía directo ([foro](https://forum.bambulab.com/t/updates-and-third-party-integration-with-bambu-connect/137408?page=2), solo búsqueda, foro: indicio). El MCP que saltea la autenticación con un certificado extraído **no lo recomendaría** (opinión: riesgo de garantía y de seguridad). No encontré mención de la A2L en ninguna fuente.
- **Windows.** `mcp-build123d` de Casys solo garantiza la exportación en macOS/Linux; estampo usa Docker; text-to-cad pide `uv` y manda telemetría. Los MCP de Onshape y Fusion exigen cuenta en la nube y no hablan con CATIA.
- **text-to-cad tiene 21k estrellas, pero eso mide popularidad, no calidad para utillajes** (opinión; el informe previo ya vio que no trata el asiento).

## Lo que no se les había ocurrido
1. **`verify_spec`**: se declara la intención una vez (caja, agujeros, pared mínima en un punto) y se vuelve a correr tras cada corrección. Cada línea dice PASS/FAIL/UNVERIFIED y con qué nivel de evidencia; nunca da «cumple» sin haber chequeado algo. Es experimental y viene apagado ([llms.md](https://github.com/pzfreo/build123d-mcp/blob/main/llms.md), abierta). Ataca el «rehacía el modelo entero».
2. **`design_audit`**: mueve cada parámetro ±10 % y revalida; detecta constantes mágicas y modelos frágiles. Barato de copiar.
3. **Cada corrección devuelve un diff** (caja, masa, nº de piezas) y una pista si falló ([jarvis](https://github.com/ReshefElisha/jarvis-onshape-mcp), abierta). Con eso el ingeniero ve el efecto sin rehacer nada.
4. **El árbol de features se revisa con el humano antes de construir**: según ese repo, la revisión humana le gana al modo autónomo (su RESEARCH.md no lo abrí).
5. **Pinear la impresión**: versión del slicer y perfil en un archivo versionado, como estampo ([estampo.dev](https://estampo.dev/), solo búsqueda). No hace falta usar estampo para copiar la idea.
6. **Pocas vistas alcanzan**: en el paper, 7 vistas a veces igualan a 21 (abierta).
7. **Aprobación humana antes de la impresora**: un gateway de laboratorio expone solo monitoreo y ningún control ([bambu-server](https://github.com/AccelerationConsortium/bambu-server), solo búsqueda).

## Qué se buscó y no se encontró
- Ningún repo que revise **cantos vivos o radio mínimo de filete**. augura mide voladizos, pared y escalón mínimo, no cantos (sin fuente de lo contrario).
- Ninguna biblioteca abierta de **palancas, pomos o elementos de utillaje**; bd_warehouse trae tornillería, rodamientos y roscas.
- Ningún proyecto de punta a punta que **simule el movimiento del mecanismo** como gate. Todos generan o controlan geometría.
- Windows verificado de build123d-mcp en esta corrida, la A2L en alguna lista de compatibilidad, y estrellas/último commit exactos (no hay API de GitHub acá).
- Un caso publicado de utillaje impreso con IA de punta a punta: sin fuente.

## Arquitectura de referencia (opinión: armada solo con piezas que existen; lo que falta está marcado)
1. **Contrato antes de geometría.** Un YAML corto: envolvente, interfaces, criterios numéricos y «qué ya existe». Lo firma el ingeniero (idea del paper y de jarvis).
2. **Buscar antes de dibujar**: biblioteca propia + `search_library` de build123d-mcp + bd_warehouse. *Falta*: cargar las palancas y pomos ya probados de la casa.
3. **Mecanismo primero, estética después**: cinemática con manifold3d (ya la tienen) + `clearance`. *Falta*: hacer de esto un gate que bloquee los filetes.
4. **Correcciones como diffs sobre la sesión persistente** (snapshots + diff al estilo jarvis), no rehacer.
5. **Gates**: `validate`, `verify_spec`, `design_audit`, medición en CATIA, augura con `--exit-code`, juez ciego aparte. *Falta*: control de cantos (hay que escribirlo).
6. **Humano revisa**; recién después, slice con CLI de Orca con perfil pineado → `.gcode.3mf`.
7. **Envío manual** (o Developer Mode), sin el certificado extraído.

## Veredicto para este frente
(opinión) Ningún repo implementa el sistema entero; lo más cercano es la cadena de un solo autor (build123d-mcp → augura → estampo → bambox), inmadura. Lo primero a copiar no es una herramienta sino tres patrones baratos: un contrato de intención reutilizable (`verify_spec`), el diff por corrección y el orden «mecanismo antes que estética». Dejaría para después estampo/bambox y no tocaría el envío a Bambu. Seguridad **media**: alta en que no hay solución lista (varias búsquedas, un paper abierto), baja en madurez de augura/estampo y en las estrellas, y el paper mide estructuras con FEA, no utillajes.