# Diseño generativo y optimización topológica (TO) para utillajes FDM: lo que hay afuera
Consultado el 20/10/2026.

## Qué hay

| Qué | Qué dice, en una frase | Fuente (link) | Fecha | abierta/solo búsqueda |
|---|---|---|---|---|
| Fusion: planes y precios | Generative design viene dentro de "Fusion for Design" (USD 2.190/año); en el Fusion base (USD 680/año) es "token-based" (se paga por uso); el análisis lineal estático sí está en el base | https://www.autodesk.com/products/fusion-360/blog/fusion-subscription-types/ | 12/03/2026 (mod. 22/09/2026) | abierta |
| Fusion: precio viejo | En 2021 la extensión de generative design bajó de USD 8.000 a 1.600/año, o 33 créditos (~USD 33) por estudio | https://www.digitalengineering247.com/article/autodesk-modifies-generative-design-extension-pricing/generative-design | jun 2021 | solo búsqueda |
| Fusion: precio según un tercero | Dice USD 1.600/año más la base; **choca** con la página oficial de 2026 (el modelo cambió) | https://arched.ai/resources/fusion-360-generative-design | s/f (~2026) | solo búsqueda (blog comercial) |
| SOLIDWORKS | El "Topology Study" exige Simulation Professional o Premium; solo piezas, lineal estático; el resultado es una malla | https://store.trimech.com/products/solidworks-simulation-professional-3-month-term-license y https://www.getleo.ai/blog/best-generative-design-plugins-solidworks | s/f (2026) | solo búsqueda |
| 3DEXPERIENCE Generative Design | Nube de Dassault; ensamblajes, no lineal; un revendedor lo llama "far more capable" (marketing) | https://www.goengineer.com/3dexperience/design/generative-design | s/f | abierta (solo trajo el menú; el dato es del fragmento de búsqueda) |
| nTop | Sin precio público; licencia educativa gratis solo no comercial; un tercero estima USD 10–20 mil por puesto/año (sin confirmar) | https://support.ntop.com/hc/en-us/articles/360060885534-What-is-the-support-policy-for-nTop-Educational-Licenses y https://gaugehow.com/tools/ntop | 05/06/2023 y s/f | abierta (ntop) / solo búsqueda (gaugehow) |
| Altair Inspire | Licencia por "Units" (bolsa de créditos compartida), prueba de 15 días; sin precio público | https://www.sculpteo.com/en/3d-learning-hub/create-3d-file/topology-optimization/ y https://www.trueinsight.io/blog/additive-manufacturing-altair | s/f | solo búsqueda |
| pyMOTO (Python) | TO 2D/3D modular, licencia MIT, 47 estrellas, 756 commits, `pip install pymoto`; usa numpy/scipy | https://github.com/aatmdelissen/pyMOTO | vista 20/10/2026 (último issue abierto 10/07/2026) | abierta |
| PyTopo3D (Python) | SIMP+OC, entra y sale STL, zonas "no tocar"; solo elástico lineal; 8.192 elementos × 200 iteraciones = 147 s en notebook | https://arxiv.org/pdf/2504.05604 | abr 2025 | abierta |
| ToPy | 575 estrellas, GPL; escrito 2005–2009, la versión estable es Python 2 | https://github.com/williamhunter/topy | s/f | solo búsqueda |
| TopOpt (zfergus) | MIT, "early stages", ejemplo 2D | https://pytopopt.readthedocs.io/en/latest/ | s/f | solo búsqueda |
| FEniCS | **No se buscó** (ver "no se encontró") | — | — | — |
| Jig loaders de SL Corp (autopartista coreana) | -40 % de peso y -10 % de plazo, pero con vaciado + estructuras internas de un software de preparación, **no TO**; sin dato de rigidez | https://www.materialise.com/en/inspiration/cases/3d-printed-jigs-fixtures-weight-reduction | 10/02/2018 | abierta |
| Fixture de ensayo con TO (ANSYS, PLA/TPU) | -40 % de masa con 60 % de retención; es un fixture de laboratorio | https://pmc.ncbi.nlm.nih.gov/articles/PMC12473619/ | 2025 | solo búsqueda (la página abrió con captcha) |
| Silla FDM con TO | 59,9 % menos peso en PLA (estudio teórico) | https://www.researchsquare.com/article/rs-7178669/v1 | ~2025 | solo búsqueda |
| Plantilla de taladrado Airbus (Inspire) | 1.020 g → 300 g, plazo 12 → 2 semanas, 1,4× el precio; **metal SLM, no FDM** | https://www.slideshare.net/slideshow/drilling-grid-alternative-with-3d-printing/55077143 | sep 2015 | solo búsqueda |
| Infill graduado por FEA | Ajustar el relleno según tensiones dio +84 % de resistencia sobre el peor patrón uniforme; el tiempo de impresión no subió de forma significativa | https://www.nature.com/articles/s41598-023-33181-4 | 2023 | abierta |
| BESO en FDM | El relleno "optimizado" sólido rindió **menos** que la probeta maciza; el multi-relleno rindió +46 % de rigidez vs rectilíneo | https://www.researchgate.net/publication/376533126_USING_TOPOLOGY_OPTIMISATION_TO_INFLUENCE_THE_INFILL_PLACEMENT_OF_FUSED_DEPOSITION_MODELLED_PARTS | ~2023 | solo búsqueda |
| Anisotropía y TO | Los criterios isótropos (von Mises) no sirven bien para FDM; alinear relleno y topología dio hasta +37 % de rigidez | https://www.sciencedirect.com/science/article/abs/pii/S2214860423003433 | 2023 | solo búsqueda |
| Pinzas calibre de freno | TO sirve más como "inspiración" que para fabricar | https://www.mdpi.com/2076-3417/11/4/1437 | 2021 | solo búsqueda |

## Fuentes
- Autodesk Fusion Subscription Types — https://www.autodesk.com/products/fusion-360/blog/fusion-subscription-types/ — 12/03/2026 (mod. 22/09/2026) — abierta
- pyMOTO (GitHub) — https://github.com/aatmdelissen/pyMOTO — vista 20/10/2026 — abierta
- PyTopo3D, arXiv 2504.05604 — https://arxiv.org/pdf/2504.05604 — abr 2025 — abierta
- Simplified local infill size optimization for FDM PLA parts (Sci Rep 13, 5933) — https://www.nature.com/articles/s41598-023-33181-4 — 2023 — abierta
- 3D-Printed Jigs and Fixtures with a 40% Weight Reduction (Materialise) — https://www.materialise.com/en/inspiration/cases/3d-printed-jigs-fixtures-weight-reduction — 10/02/2018 — abierta
- nTop Educational Licenses — https://support.ntop.com/hc/en-us/articles/360060885534-What-is-the-support-policy-for-nTop-Educational-Licenses — 05/06/2023 — abierta
- 3DEXPERIENCE Generative Design (GoEngineer) — https://www.goengineer.com/3dexperience/design/generative-design — s/f — abierta (solo menú)
- Autodesk Modifies Generative Design Extension Pricing — https://www.digitalengineering247.com/article/autodesk-modifies-generative-design-extension-pricing/generative-design — jun 2021 — solo búsqueda
- Fusion 360 Generative Design: Setup, Pricing (arched.ai) — https://arched.ai/resources/fusion-360-generative-design — s/f — solo búsqueda (blog comercial)
- SOLIDWORKS Simulation Professional (TriMech) — https://store.trimech.com/products/solidworks-simulation-professional-3-month-term-license — s/f — solo búsqueda
- Best Generative Design Plugins for SolidWorks (Leo AI) — https://www.getleo.ai/blog/best-generative-design-plugins-solidworks — ~2026 — solo búsqueda (blog comercial)
- nTop (GaugeHow) — https://gaugehow.com/tools/ntop — s/f — solo búsqueda (estimación sin autor)
- Topology Optimization in 3D Printing (Sculpteo) — https://www.sculpteo.com/en/3d-learning-hub/create-3d-file/topology-optimization/ — s/f — solo búsqueda
- Altair and additive (TrueInsight) — https://www.trueinsight.io/blog/additive-manufacturing-altair — s/f — solo búsqueda
- ToPy — https://github.com/williamhunter/topy — s/f — solo búsqueda
- TopOpt — https://pytopopt.readthedocs.io/en/latest/ — s/f — solo búsqueda
- Density-Based TO 3D-Printed Fixtures (PMC12473619) — https://pmc.ncbi.nlm.nih.gov/articles/PMC12473619/ — 2025 — solo búsqueda
- TO for weight saving of FDM objects (Research Square) — https://www.researchsquare.com/article/rs-7178669/v1 — ~2025 — solo búsqueda
- Agile Drilling Template (Airbus, slides) — https://www.slideshare.net/slideshow/drilling-grid-alternative-with-3d-printing/55077143 — sep 2015 — solo búsqueda
- Using TO to influence infill placement (BESO) — https://www.researchgate.net/publication/376533126_USING_TOPOLOGY_OPTIMISATION_TO_INFLUENCE_THE_INFILL_PLACEMENT_OF_FUSED_DEPOSITION_MODELLED_PARTS — ~2023 — solo búsqueda
- Printing-induced strength anisotropy in TO — https://www.sciencedirect.com/science/article/abs/pii/S2214860423003433 — 2023 — solo búsqueda
- Brake calipers with TO — https://www.mdpi.com/2076-3417/11/4/1437 — 2021 — solo búsqueda

## Lo que CONFIRMA lo que hace el sistema
- **No instalar nada de TO ahora.** Los papers dicen que la TO "demanda expertos" y que por eso casi siempre se imprime macizo (Sci Rep 2023, abierta, https://www.nature.com/articles/s41598-023-33181-4). Otro estudio de pinzas de freno la llama herramienta de inspiración más que de fabricación (MDPI 2021, solo búsqueda, https://www.mdpi.com/2076-3417/11/4/1437). El sistema ya no la usa y no hay evidencia de que le falte.
- **El caso de utillajes de autopartista con números (SL Corp) no usó TO**: vació la pieza y le puso estructura interna (-40 % de peso, -10 % de plazo; Materialise, 2018, abierta, https://www.materialise.com/en/inspiration/cases/3d-printed-jigs-fixtures-weight-reduction). Eso es lo que ya hace el laminador de la Bambu con el relleno (opinión).
- **Lo que manda es función e interfaces**, no rigidez: una guía de TO insiste en que agujeros, caras y alineaciones son "geometría sagrada" que se fija antes (https://3dprintingstreet.com/design-modeling/topology-optimization/, blog sin autor, solo búsqueda). Coincide con el error del virolador (mecanismo y cantos antes que optimizar).
- **Los gates de rigidez baratos alcanzan para baja carga**: un análisis lineal estático ya viene en el Fusion base (Autodesk, 12/03/2026, abierta). Y una guía de filamentos de jun 2026 (blog, solo búsqueda, https://filamentfeed.com/article/designing-for-strength-3d-prints-june-2026) dice que PETG/ABS con 3–4 paredes y 20–25 % de relleno alcanza para cargas de taller.

## Lo que lo CONTRADICE o le pone en duda
- **Mi duda sobre "no hace falta": no encontré ningún caso FDM de planta con peso, tiempo de impresión y rigidez juntos.** Los números que hay (-40 %, -60 %) vienen de laboratorio, de teoría o de metal; ninguno mide tiempo de impresión. Así que ni a favor ni en contra hay un caso comparable al nuestro.
- **El ahorro de peso en un utillaje de banco casi no vale nada** (opinión, sin fuente): pesa o cuesta tiempo solo si se lo sostiene en la mano o si la impresión dura horas. Sí vale en piezas que el operario levanta o mueve cada ciclo.
- **La TO estándar asume material isótropo; el FDM no lo es.** La unión entre capas rinde 50–80 % del material macizo (blog, jun 2026, solo búsqueda). Un artículo (ScienceDirect 2023, solo búsqueda) dice que los criterios sin dirección "pueden no servir" para FDM, y otro más viejo (NSF, ~2018, solo búsqueda) decía que no había método robusto. Lo que la herramienta comercial dibuja puede romper por Z.
- **El "óptimo" puede ser peor que el macizo al imprimirlo**: en un ensayo BESO, el relleno sólido optimizado rindió menos que la probeta maciza (ResearchGate ~2023, solo búsqueda). Los perímetros y los huecos chicos que el FDM no llena bien (Sci Rep 2023, abierta) se comen la ganancia.
- **Los "+84 %" y "+46 %" son contra un relleno uniforme malo**, no contra un diseñador que ya puso paredes y costillas donde van.
- **Marketing de licencias**: los precios de generative design cambiaron tres veces (USD 8.000 → 1.600 en 2021; hoy va incluido en Fusion for Design a 2.190/año, según Autodesk 2026). Un blog de 2026 todavía repite 1.600 + base: está desactualizado frente a la página oficial. El "Inspire one-time $239" de tiendas de reventa es sospechoso: no usar. El "far more capable" de 3DEXPERIENCE sale de un revendedor.
- **Fusion personal gratis es para uso no comercial** (Autodesk 2026, abierta): en una empresa no corresponde (opinión).

## Lo que no se les había ocurrido
1. **Gratis y de verdad: pyMOTO (MIT) y PyTopo3D** corren con `pip` en Python, sin licencia. PyTopo3D toma una STL como dominio, respeta zonas que no se tocan (agujeros, apoyos) y devuelve STL (arXiv 2025, abierta). **Límite**: son voxeles. 8.192 elementos tardaron 147 s; una pieza real a 1–2 mm de voxel tiene cientos de miles, así que sería bastante más lento (extrapolación mía, sin medir). El resultado es una malla suave, **no un árbol de operaciones CATIA/build123d**: hay que volver a modelar. ToPy está viejo (Python 2) y TopOpt es alfa 2D: descartarlos.
2. **Usar la TO como "mapa" y no como pieza**: correrla una vez para ver dónde va el material y después poner costillas o vaciados a mano en build123d, con redondeos y sin cantos vivos. Es la lectura de "inspiración" y encaja con el sistema (opinión).
3. **Grado intermedio entre uniforme y TO**: dar más relleno donde hay más tensión (Sci Rep 2023, abierta) o decidir la orientación de impresión según la carga. No probé si la Bambu A2L lo permite con modificadores de zona (sin fuente).
4. **Antes que TO: orientación de impresión y paredes.** Las capas son el eje débil; poner la carga paralela a ellas es gratis y probablemente rinde más que optimizar topología (opinión, apoyada en los dos puntos de anisotropía de arriba).
5. **Una prueba acotada es posible sin comprar**: Fusion da 30 días de prueba con acceso completo menos Manage (Autodesk 2026, abierta). Sirve para correr un solo caso (una pieza de mano pesada) y mirar el resultado, sin compromiso.

## Qué se buscó y no se encontró
- Caso de fixture FDM de planta con peso, tiempo de impresión **y** rigidez medidos con y sin TO: no apareció.
- Precio oficial de nTop y de Altair Inspire: no hay (el de nTop lo da un tercero sin respaldo).
- Cómo restringe Fusion el generative design para FDM (voladizos, apoyos): solo lo dice un blog comercial, sin ayuda oficial abierta.
- FEniCS/dolfinx para TO, FreeCAD FEM con CalculiX, y datos de la Bambu A2L: **no se buscaron** (se acabó el cupo de búsquedas por turno). Quedan pendientes. El ROADMAP del sistema ya tiene en cola un copiloto con CalculiX, pero no lo evalué.
- Fecha del último commit de pyMOTO: la página no la muestra. Hay 756 commits y un issue abierto por el autor el 10/07/2026 (buscador), señal de actividad, no prueba.
- Páginas que no abrí: PMC (captcha), ScienceDirect, ResearchGate, GoEngineer (solo menú). Esas filas dependen del fragmento de búsqueda.

## Veredicto para este frente
La TO y el diseño generativo **no son lo primero que haya que cambiar**: los problemas del virolador fueron de mecanismo, estética y cantos, que la TO no toca, y en piezas de baja carga la rigidez rara vez manda. Cuando sí valga (pieza de mano pesada o impresión larga), el camino barato es una prueba única con pyMOTO/PyTopo3D o los 30 días de Fusion, y usarla como mapa, no como pieza final. Seguridad **media**: la contra es sólida (varias fuentes abiertas y coherentes), pero no hay un caso de planta FDM con números para pesar a favor o en contra, y quedaron temas sin buscar.