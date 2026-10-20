# Cómo diseñan los equipos reales de utillajes: lo que hay afuera
Consultado el 20/10/2026.

Nota de método: de ~13 fuentes solo abrí completas 2 (Hashemi 2014 y el estándar de Marwood). El resto es «solo búsqueda»: leí fragmentos, no el texto entero. Lo que dependa de esas está marcado. Las páginas de arXiv 2026 no pude abrirlas (la herramienta rechazó la URL); sus datos salen de fragmentos del buscador.

## Qué hay

| Qué | Qué dice, en una frase | Fuente (link) | Fecha | abierta/solo búsqueda |
|---|---|---|---|---|
| Hashemi y otros, revisión de razonamiento por casos (CBR) en diseño de fixtures | 4 pasos (planificar el montaje, planificar el fixture, diseñar unidades, verificar) y 6 clases de requisitos (físico, colisión, restricciones, usabilidad, costo, tolerancia); CBR es la técnica «más exitosa» | https://journals.sagepub.com/doi/10.1155/2014/484928 | 2014 | abierta |
| Marwood, «Checking Fixture & Gauge Standards» (estándar de compra de un proveedor de herramental para automotriz) | Flujo cotización > revisión de diseño > aprobación escrita > recién ahí construir; tres listas (diseño, recepción, cierre); chaflán en todo borde; clamps sin pellizcos | http://marwoodinternational.com/wp-content/uploads/2019/07/Marwood-Fixture-Standards.pdf | rev. 15/06/2018 | abierta |
| Boyle, Rong y Brown, revisión de >75 herramientas CAFD | La investigación está «segmentada» y falta soporte cohesivo a todo el proceso | https://www.sciencedirect.com/science/article/abs/pii/S0736584510000499 | 2011 | solo búsqueda |
| Pehlivan y Summers, CAFD e información | Tres fases: definición del problema, síntesis, análisis; entre fases se pasa información (geometría, ubicadores, fuerzas, tolerancias) | https://www.researchgate.net/publication/239396076_A_review_of_computer-aided_fixture_design_with_respect_to_information_support_requirements | 2008 | solo búsqueda |
| Rong, Huang y Hou, libro «Advanced CAFD» | Hay «gran consenso» sobre el esquema del proceso; diseñar fixtures es complejo, intuitivo y ad hoc, ~10 años de práctica | https://www.researchgate.net/publication/316339310_Advanced_Computer-Aided_Fixture_Design | 2005 (fragmento citado por un paper posterior) | solo búsqueda |
| «Jigs and Fixtures in Production: A Systematic Literature Review», J. Manuf. Syst. 72 | Las reseñas arrancan del principio 3-2-1 | https://www.sciencedirect.com/science/article/pii/S0278612523002078 | feb 2024 | solo búsqueda |
| Fixture por rasgos para piezas aeronáuticas | El diseñador elige un caso recuperado «como punto de partida»; los componentes del caso se guardan paramétricos | https://www.sciencedirect.com/science/article/abs/pii/S0736584511000706 | ~2011 (inferido, s/f) | solo búsqueda |
| Revisión de diseño basado en casos (edificios) | Ciclo de 4 R: recuperar, reutilizar, revisar, retener | https://www.researchgate.net/publication/220306676_Case-based_design_A_review_and_analysis_of_building_design_applications | s/f | solo búsqueda |
| ArtiCAD (arXiv 2604.10992) | Agentes de diseño, generación, ensamble y revisión; las juntas (tipo y límites de movimiento) se definen antes de generar geometría; el ensamble lo resuelve un solver; si algo falla solo se regeneran las piezas afectadas | https://arxiv.org/html/2604.10992 | abr 2026 (preprint) | solo búsqueda |
| CADEngBench (arXiv 2608.09296) | Mide si el CAD «funciona», no si se ve bien: ensamble, juntas y simulación cinemática | https://arxiv.org/html/2608.09296v1 | ago 2026 (preprint) | solo búsqueda |
| Pahl y Beitz vía Kannengiesser y Gero, y WikID (TU Delft) | Cuatro fases (aclarar tarea, concepto, materialización, detalle); el concepto empieza por la estructura de funciones; las fases se superponen | https://www.cambridge.org/core/services/aop-cambridge-core/content/view/8BFE1D692F764BCE7D0CEF539ED3C580/S2053470117000245a.pdf/can_pahl_and_beitz_systematic_approach_be_a_predictive_modelof_designing.pdf y http://wikid.io.tudelft.nl/WikID/index.php/Engineering_models_of_product_design | 2017 / s/f | solo búsqueda |
| Gayer y otros, diseño automático de fixtures de inspección con aprendizaje por refuerzo | Lo actual no está totalmente automatizado: tiempos largos y ajustes manuales | https://www.sciencedirect.com/science/article/pii/S2212827125004640 | 2025 | solo búsqueda |
| jcproto, fixtures de ensamble automotriz (VENDEDOR) | Revisión de diseño en 6 pasos; el operario no debería sostener algo suelto mientras cierra un clamp ni cruzar la mano sobre cantos filosos | https://www.jcproto.com/new/automotive-assembly-fixtures.html | ~sep 2026 | solo búsqueda |
| Blogs de oficio (sin respaldo académico): rivcut, stuartjbateman, Fusion Design | Reglas repetidas: sin cantos filosos, tornillos hundidos, operación a una mano, pin redondo + pin diamante | https://www.rivcut.com/blog/fixture-design-principles-precision · https://stuartjbateman.com/designing-jigs-fixtures-the-right-way/ · https://www.fusiondesigninc.com/blog/2023/1/19/best-practices-for-designing-jigs-hand-tools-and-fixtures | 2023–2026 | solo búsqueda |

## Fuentes (título — link — fecha — abierta/solo búsqueda)

- Recent Developments on CAFD: Case Based Reasoning Approaches — https://journals.sagepub.com/doi/10.1155/2014/484928 — 2014 — abierta
- Marwood Checking Fixture & Gauge Standards — http://marwoodinternational.com/wp-content/uploads/2019/07/Marwood-Fixture-Standards.pdf — 15/06/2018 — abierta
- A review and analysis of current CAFD approaches (Boyle, Rong, Brown) — https://www.sciencedirect.com/science/article/abs/pii/S0736584510000499 — 2011 — solo búsqueda
- A review of CAFD with respect to information support requirements — https://www.researchgate.net/publication/239396076_A_review_of_computer-aided_fixture_design_with_respect_to_information_support_requirements — 2008 — solo búsqueda
- Advanced Computer-Aided Fixture Design — https://www.researchgate.net/publication/316339310_Advanced_Computer-Aided_Fixture_Design — 2005 — solo búsqueda
- Jigs and Fixtures in Production: SLR — https://www.sciencedirect.com/science/article/pii/S0278612523002078 — feb 2024 — solo búsqueda
- A feature-based fixture design methodology for aircraft structural parts — https://www.sciencedirect.com/science/article/abs/pii/S0736584511000706 — ~2011 — solo búsqueda
- Case-based design: building design applications — https://www.researchgate.net/publication/220306676_Case-based_design_A_review_and_analysis_of_building_design_applications — s/f — solo búsqueda
- ArtiCAD — https://arxiv.org/html/2604.10992 — abr 2026 — solo búsqueda
- CADEngBench — https://arxiv.org/html/2608.09296v1 — ago 2026 — solo búsqueda
- Can Pahl and Beitz' systematic approach be a predictive model of designing? — enlace en la tabla — 2017 — solo búsqueda
- WikID, Engineering models of product design — http://wikid.io.tudelft.nl/WikID/index.php/Engineering_models_of_product_design — s/f — solo búsqueda
- Automated fixture designs using reinforcement learning — https://www.sciencedirect.com/science/article/pii/S2212827125004640 — 2025 — solo búsqueda
- jcproto, Automotive Assembly Fixtures — https://www.jcproto.com/new/automotive-assembly-fixtures.html — ~sep 2026 — solo búsqueda (vendedor)
- Blogs rivcut / stuartjbateman / Fusion Design — links en la tabla — s/f (blogs) — solo búsqueda

## Lo que CONFIRMA lo que hace el sistema

- **Primero el problema, después la forma.** La literatura de fixtures lo dice de dos maneras parecidas: definición del problema → síntesis → análisis (Pehlivan y Summers 2008, solo búsqueda), o planificar montaje → planificar fixture → diseñar unidades → verificar (Hashemi 2014, abierta). Pahl y Beitz ponen la estructura de funciones antes de la materialización (WikID, solo búsqueda). Lo que pasó con el virolador (estética antes de que el mecanismo funcione) es lo que estos esquemas buscan evitar.
- **Reusar antes de dibujar.** CBR es la técnica «más exitosa» en diseño de fixtures según Hashemi (abierta), con una salvedad: es una revisión sobre CBR, o sea que defiende su tema. Lo concreto: Boyle separa dos bibliotecas, una de soluciones completas y otra de «unidades» (componentes sueltos) enlazada a la primera. En el caso aeronáutico el diseñador elige un caso recuperado como punto de partida y los componentes se guardan paramétricos (solo búsqueda). La palanca que ya existía es una «unidad» de manual.
- **Verificar es la parte más estudiada.** En la tabla de Hashemi, verificación pesa 35–47 % de los trabajos de cada período (abierta). Los controles automáticos del sistema van en la dirección que sigue la investigación.
- **Revisión de diseño por escrito antes de construir.** Marwood exige aprobación escrita del diseño antes de fabricar y usa tres listas distintas: de aprobación de diseño, de inspección de recepción y de cierre (abierta). La revisión ciega que ya tienen es parecida.
- **Cantos y pellizcos son requisito de norma, no gusto.** Marwood: chaflán en agujeros y bordes «to remove any burrs or sharp edges» (7.3) y clamps «no pinch points or knuckle busters» (12.6). Tres blogs y un vendedor dicen lo mismo (solo búsqueda, nivel bajo).
- **Reconstruir todo en cada corrección es evitable.** ArtiCAD guarda las piezas sin falla en un conjunto «keep» y regenera solo las afectadas (preprint, solo búsqueda).

## Lo que lo CONTRADICE o le pone en duda

- **La literatura es de fixtures de mecanizado.** Los requisitos de Hashemi (rigidez bajo fuerzas de corte, deformación, evacuación de viruta) y la verificación que se estudia son de máquina-herramienta. Un virolador manual de baja fuerza y mecanismo no es ese caso. No encontré nada sobre palancas, prensas manuales ni viroladores. Lo que se transfiere es el esquema de etapas y los requisitos de uso, no los cálculos.
- **El oficio es tácito.** Rong y coautores lo llaman «complex, intuitive and ad-hoc» y hablan de ~10 años de práctica (fragmento, solo búsqueda). Boyle dice que tras >75 herramientas el soporte sigue segmentado. Una skill con lista de control captura lo que se puede escribir; lo que el ingeniero «ve solo» probablemente quede afuera en parte. (opinión)
- **«Mecanismo primero, estética después» es demasiado simple.** Kannengiesser y Gero señalan que las fases de Pahl y Beitz se superponen, y WikID dice que al elegir el principio también cuentan uso, apariencia y costo, y que la materialización itera entre análisis y síntesis (solo búsqueda). Además, los cantos que lastiman no son estética: son seguridad y uso. Si el sistema pone «cantos» en la etapa de acabado estético, los va a dejar para el final; según Marwood y los blogs son un requisito de la etapa de detalle básico. (opinión)
- **CBR tiene costo de biblioteca.** Hashemi: la recuperación por adaptabilidad pide biblioteca chica y la recuperación por similitud prefiere una grande (abierta). Con pocos diseños previos, un CBR formal sobra: alcanza un catálogo corto de unidades probadas. (opinión)
- **El estándar de Marwood no es de este caso.** Es un estándar de compra de un proveedor para fixtures de chequeo de chapa (acero, aluminio, certificación con CMM, NAFTA). Muchos ítems no aplican. No es una norma de OEM ni de tier 1 de producción manual.
- **Dato sin respaldar.** Hashemi repite que ~40 % de piezas rechazadas se deben a mal diseño de fixture, pero lo cita de segunda mano; no lo usaría.
- **Evidencia de IA específica: casi nada.** No hay estudio de un LLM diseñando fixtures. ArtiCAD y CADEngBench son preprints de 2026 sobre ensambles articulados en general (FreeCAD), y no leí sus números.

## Lo que no se les había ocurrido

1. **Una ficha de «intención de diseño» antes de modelar** (Marwood 3.3, abierta): puntos de ubicación y sostén, material admisible, técnica de sujeción, ergonomía, esquema de datums, ambiente de uso. Es la fase de definición del problema, escrita y firmada por Fak antes de tocar geometría. (opinión: es el control más barato contra «se metió en la estética»)
2. **Tres puertas, no una:** diseño aprobado por escrito, inspección de recepción de la pieza impresa contra el diseño, y cierre con la pieza real en el puesto. Hoy el sistema parece controlar el modelo, no la pieza impresa probada con el tapizado real. (opinión, apoyada en Marwood)
3. **Conectores definidos antes de la geometría** (ArtiCAD): cada pieza declara puntos de unión con marco local, tipo de junta (fija, giratoria, deslizante…) y límites de recorrido; el ensamble sale de un solver sin modelo de lenguaje. Sirve para el mecanismo (el eje y el recorrido de la palanca existen antes que la forma) y para corregir una pieza sin rehacer las demás.
4. **Retener** (el cuarto paso del ciclo de 4 R): al cerrar cada diseño, guardar como «unidad» lo que anduvo (palanca, bisagra, tope). Sin eso, el próximo diseño vuelve a dibujar de cero.
5. **Controles de Marwood que se pueden medir con la malla:** ningún detalle sale del borde de la base «abierto o cerrado» (5.4); juego lateral del cabezal del clamp menor a 3 mm (12.5); luz estándar de 3 mm en el cuerpo (7.4); la base sobrepasa 50–150 mm los detalles según el tamaño. Con el barrido de movimiento en manifold3d, los primeros son comprobables. Un umbral de pellizco no lo encontré; habría que definirlo (sin fuente).
6. **Lo «profesional» en Marwood es información, no estilo:** placa con número, peso estampado, secuencia óptima de cierre grabada en cada clamp, puntos de color y letras, instrucciones de operación con secuencia, y «bridging» en vez de bloques macizos. Sirve para el problema de las cajas peladas: se arregla con identificación y función, no con adornos. Grabado en relieve o rebaje, es barato en FDM. (opinión)
7. **Pines con entrada que perdona:** Marwood pide entrada de 15° y que el pin tome agujeros hasta ±10 % fuera de medida. Para FDM y tapizado, que varían, el análogo es diseñar entradas guiadas en lugar de ajuste justo. (opinión, por analogía)
8. **Secuencia de carga** (jcproto, vendedor): ubicar estable → sujetar, sin sostener nada suelto con la otra mano. Es una pregunta de revisión, no una geometría.

## Qué se buscó y no se encontró

- Hoffman, Henriksen y Boyes: solo aparecen citados en fuentes secundarias (Henriksen en una reseña de 2023); no hay texto abierto. No puedo afirmar qué dicen.
- Las reseñas de Hunter y de Nee: no las abrí.
- Normas públicas de herramental de un OEM o prácticas de revisión de un tier 1 para dispositivos manuales de producción: nada público. Lo más cercano es Marwood.
- Estudios con diseñadores humanos usando bibliotecas (observación o protocolos): solo hay sistemas CBR propuestos, no estudios de uso.
- LLM o agentes aplicados a fixtures: nada. Lo más cercano es ArtiCAD.
- Radio mínimo de canto o umbral de pellizco con número: ninguna fuente lo da.
- No pude verificar nada de los preprints de 2026 más allá de fragmentos.

## Veredicto para este frente (2-4 frases; seguridad alta/media/baja y por qué)

Las etapas (problema → concepto/mecanismo → unidades → verificación), la reutilización de casos y la aprobación escrita antes de construir aparecen de forma repetida en fuentes independientes, así que cambiaría primero eso: una ficha de intención firmada por Fak, «buscar antes de dibujar» sobre una biblioteca corta de unidades probadas, y una lista de revisión con ítems medibles (cantos, pellizcos, barrido dentro de la base, pieza impresa probada). Seguridad **media**: el esquema está bien respaldado, pero casi todo es de fixtures de mecanizado y de lo que abrí solo dos fuentes; para IA aplicada a utillajes manuales no hay evidencia directa y lo que propongo ahí es opinión mía.