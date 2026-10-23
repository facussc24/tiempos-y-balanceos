# Proceso de diseño de utillajes (fases, revisiones, checklists, seguridad): lo que hay afuera
Consultado el 20/10/2026.

## Qué hay

| Qué | Qué dice, en una frase | Fuente (link) | Fecha | abierta/solo búsqueda |
|---|---|---|---|---|
| Hoffman, *Jig and Fixture Design* (texto de la 5ª ed.) | Dos principios todo el libro: simplicidad y economía; lo recargado sube el costo sin mejorar calidad; usar componentes estándar (clamps, locators, pins, resortes). | https://vdoc.pub/documents/jig-and-fixture-design-5e-delmar-learning-drafting-75kji78va5s0 y https://fliphtml5.com/zroi/qfam/JIG_AND_FIXTURE_DESIGN/ | s/f (libro 4ª ed. 1996) | solo búsqueda (copias de terceros) |
| Libro Carr Lane/Hoffman, resumen | Hoffman = proceso sistemático; Carr Lane = componentes estándar. | https://yicenprecision.com/handbook-of-jig-fixture-design-summary-for-modern-engineers/ | s/f | solo búsqueda (blog de taller) |
| Formlabs, white paper jigs y fixtures | Exacto/sub/sobre-restricción; sobre-restringir a veces es necesario; fixture flojo para piezas con variación; datums para inspeccionar; nervios y filetes; insertos roscados. | https://formlabs.com/white-papers/how-to-3d-print-in-house-jigs-fixtures-and-other-manufacturing-aids/ | s/f | abierta |
| Omni3D, 5 reglas para utillaje impreso | Definir cargas, deformación aceptable y «acceptance test» antes de imprimir; camino de carga y orientación juntos; interfaces reemplazables. | https://omni3d.com/3d-printed-jigs-and-fixtures/ | 15/10/2026 | abierta |
| Roche (fabricante de clamps), horizontal vs vertical | Capacidad de sujeción ≠ fuerza de apriete; el diseñador mira el CAD estático y no modela el barrido del mango; subir una clase; usar un solo estilo en la planta. | https://rocheclamp.com/blog/horizontal-vs-vertical-toggle-clamps/ | 05/05/2026 | abierta |
| LearnLeanSigma, poka-yoke | Prevenir antes que detectar; un poka-yoke puede fallar, saltearse o crear problemas nuevos; checklists y avisos son controles más débiles. | https://www.learnleansigma.com/guides/error-proofing-poka-yoke/ | 19/09/2026 | abierta |
| Atlas Copco, guía de ergonomía | Diámetro de mango 34 mm (montaje liviano) a 38 mm; muñeca recta; herramienta corta y liviana. | https://www.atlascopco.com/content/dam/atlas-copco/industrial-technique/general/documents/pocketguides/Pocket%20guide_the%20art%20of%20ergonomics.pdf | 2020 | abierta |
| ISO 13857:2019 (tablas por terceros) | Distancias de seguridad para alcanzar zonas peligrosas a través de aberturas de resguardos (dedo, mano, brazo). | https://www.zt-grassberger.at/en/r/ISO13857/Safety_Distance.html | s/f | solo búsqueda |
| Checklist APQP 1.1 | En fase 3 figuran «Tool Design and Tool FMEA», «Verification of Tool Functionality» y «Tool Design Review». | https://pdfcoffee.com/apqp-checklist-reportversion-11dtd-131108-pdf-free.html | 13/11/2008 | solo búsqueda |
| learnleansigma, DFMEA | Cadena función → efecto → modo de falla → causa de diseño; define alcance e interfaces antes. | https://www.learnleansigma.com/guides/design-failure-mode-and-effects-analysis-dfmea/ | ~ago/2026 | solo búsqueda |
| Stuart Bateman, guía de jigs | Lista: locators visibles y reemplazables, clamps sin piezas sueltas ni daño a manos, un mano, SMED. | https://stuartjbateman.com/designing-jigs-fixtures-the-right-way/ | ~ago/2026 | solo búsqueda (blog con autor) |
| Sovol, jigs impresos | FDM no sirve con cargas altas, calor o químicos; agujero para el pulgar; filetear. | https://www.sovol3d.com/blogs/news/3d-printed-jigs-and-fixtures-how-to-design-reliable-workshop-aids | ~sep/2026 | solo búsqueda (vendor) |
| PMC12383637, mangos impresos | Mango de rigidez media dio menos presión pico y mejor confort que uno rígido de PLA. | https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12383637/ | s/f | solo búsqueda |
| Ergoweb, fuerzas | Máx. fuerza de palanca manual 29 lb (~129 N). | https://ergoweb.com/force-guidelines/ | s/f (≈2013) | solo búsqueda |
| Ridiculous Machine Tools | Clamp con al menos 20 % sobre la fuerza calculada. | https://ridiculousmachinetools.com/blog/how-to-choose-the-right-vertical-toggle-clamp-for-your-needs-/ | ≈feb/2025 | solo búsqueda (vendor) |
| CARE, arXiv 2604.28043 | Agentes con fases y «stage gates» donde expertos aprueban artefactos de cada fase. | https://arxiv.org/pdf/2604.28043 | 2026 | solo búsqueda |
| Corrida anterior: jcproto | Revisión de 7 pasos; salida primero; el operario no cruza cantos vivos; poka-yoke «presente» vs «bien asentado». | https://jcproto.com/new/automotive-assembly-fixtures.html | 21/09/2026 | abierta |
| Corrida anterior: arXiv 2609.05559 | DFM Reviewer propone UNA mejora a la vez y otro agente verifica cada edición. | https://arxiv.org/abs/2609.05559 | 03/09/2026 | abierta |
| Corrida anterior: arXiv 2605.17448 | Agentes de código: 0 aciertos estrictos; un «blueprint» previo subió IoU de .444 a .592. | https://arxiv.org/abs/2605.17448 | 17/05/2026 | abierta |
| Corrida anterior: TU Delft, modelos de diseño | Pahl&Beitz: concepto débil no da detalle óptimo; fin de fase = decisión. | wikid.io.tudelft.nl (página Engineering_models_of_product_design) | s/f | abierta |
| Corrida anterior: idec, ISO 12100 | No crear cantos vivos; la medida de protección no debe crear peligros nuevos. | idec.com (artículo sobre ISO 12100) | 2026 | abierta |

## Fuentes
- Hoffman, texto 5ª ed. (vdoc.pub) — https://vdoc.pub/documents/jig-and-fixture-design-5e-delmar-learning-drafting-75kji78va5s0 — s/f — solo búsqueda
- Hoffman, extracto (fliphtml5) — https://fliphtml5.com/zroi/qfam/JIG_AND_FIXTURE_DESIGN/ — s/f — solo búsqueda
- Handbook Hoffman + Carr Lane (resumen) — https://yicenprecision.com/handbook-of-jig-fixture-design-summary-for-modern-engineers/ — s/f — solo búsqueda
- How to 3D Print In-House Jigs, Fixtures… (Formlabs) — https://formlabs.com/white-papers/how-to-3d-print-in-house-jigs-fixtures-and-other-manufacturing-aids/ — s/f — abierta
- 3D Printed Jigs and Fixtures: 5 Engineering Rules (Omni3D) — https://omni3d.com/3d-printed-jigs-and-fixtures/ — 15/10/2026 — abierta
- Horizontal vs Vertical Toggle Clamps (Roche) — https://rocheclamp.com/blog/horizontal-vs-vertical-toggle-clamps/ — 05/05/2026 — abierta
- Poka-Yoke: Error-Proofing (LearnLeanSigma) — https://www.learnleansigma.com/guides/error-proofing-poka-yoke/ — 19/09/2026 — abierta
- The Art of Ergonomics (Atlas Copco) — URL en la tabla — 2020 — abierta
- Safety Distances ISO 13857 (Grassberger) — https://www.zt-grassberger.at/en/r/ISO13857/Safety_Distance.html — s/f — solo búsqueda
- ISO 13857:2019 (copia parcial) — https://dqo52087pnd5x.cloudfront.net/posters/docs/gatesopenres-203066.pdf — 10/2019 — solo búsqueda
- APQP Checklist 1.1 — https://pdfcoffee.com/apqp-checklist-reportversion-11dtd-131108-pdf-free.html — 13/11/2008 — solo búsqueda
- DFMEA (LearnLeanSigma) — https://www.learnleansigma.com/guides/design-failure-mode-and-effects-analysis-dfmea/ — ~ago/2026 — solo búsqueda
- Jigs and Fixtures Design Guide (Bateman) — https://stuartjbateman.com/designing-jigs-fixtures-the-right-way/ — ~ago/2026 — solo búsqueda
- SMED y Poka Yoke en fixtures (Bateman) — https://stuartjbateman.com/you-really-need-to-apply-smed-and-poka-yoke-thinking-in-fixture-design/ — ~oct/2025 — solo búsqueda
- Jigs impresos (Sovol) — URL en la tabla — ~sep/2026 — solo búsqueda
- Jigs impresos (Siraya) — https://siraya.tech/blogs/news/3d-printed-jigs-and-fixtures — ~abr/2026 — solo búsqueda
- Mangos ergonómicos impresos — https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12383637/ — s/f — solo búsqueda
- Force Guidelines (Ergoweb) — https://ergoweb.com/force-guidelines/ — s/f — solo búsqueda
- Cam-lever grip (Firgelli) — https://www.firgelliauto.com/en-ee/blogs/mechanisms/cam-lever-grip — ~may/2026 — solo búsqueda (blog sin autor, tono generado)
- Single pivoted clamp (Firgelli) — https://www.firgelliauto.com/blogs/mechanisms/single-pivoted-clamp-with-fixed-side-piece — ~sep/2026 — solo búsqueda (ídem)
- CARE — https://arxiv.org/pdf/2604.28043 — 2026 — solo búsqueda
- EngDesign — https://arxiv.org/pdf/2509.16204 — sep/2025 — solo búsqueda
- Fuentes de la corrida anterior (jcproto, arXiv 2609.05559, 2605.17448, TU Delft, idec, Misumi ISO 13854 del 28/04/2016, TICK arXiv 2410.03608 de oct/2024): ver tabla y `run/trabajo/notas.md`.

(Corrección a informe_1: la nota de Bateman sobre SMED/poka-yoke es de ~ene/2026, no oct/2025.)

## Lo que CONFIRMA lo que hace el sistema
- **Primero que el mecanismo ande, después la forma.** Pahl&Beitz (TU Delft, s/f, abierta): un concepto débil no da un detalle óptimo y el fin de cada fase es un punto de decisión. Hoffman (texto en https://fliphtml5.com/zroi/qfam/JIG_AND_FIXTURE_DESIGN/, solo búsqueda) repite «simplicity and economy» y dice que lo recargado sube el costo sin mejorar calidad. Un diseñador con oficio tiene el orden: requisitos → concepto → detalle.
- **Reusar antes de dibujar.** Hoffman (https://vdoc.pub/documents/jig-and-fixture-design-5e-delmar-learning-drafting-75kji78va5s0, solo búsqueda): los clamps, locators, pins y resortes estándar se planean en el diseño, y las piezas estándar «se dibujan solo para claridad». Roche (05/05/2026, abierta) recomienda un solo estilo de clamp en toda la planta. Rehacer una palanca que ya existe va contra la práctica.
- **Simular el barrido, no solo la pose final.** Roche (abierta): los diseñadores miran el CAD en la posición trabada y no modelan el recorrido del mango. Drametal (de la corrida anterior, solo búsqueda) dice lo mismo: validar el recorrido completo. Es lo que hace manifold3d.
- **Una corrección a la vez, verificada.** arXiv 2609.05559 (03/09/2026, abierta): un revisor propone UNA mejora y otro agente verifica cada edición. Respalda no rehacer el modelo entero.
- **Cantos vivos y esquinas redondeadas** salen en todas las listas clásicas: «Round all corners» (https://www.pre-scient.com/us/design-principles-of-jigs-and-fixtures/, solo búsqueda), ISO 12100 (idec, abierta) y jcproto (21/09/2026, abierta).
- **Caja pelada ≠ solo estética:** Formlabs (s/f, abierta) y Sovol (~sep/2026, solo búsqueda) piden agarres, un agujero para el pulgar y alineación visual. Es función, no adorno.

## Lo que lo CONTRADICE o le pone en duda
- **Casi toda la literatura de fixtures es de maquinado** (virutas, refrigerante, fuerza de corte, endurecer locators). Hoffman, Bateman y las listas de slideshare hablan de eso. Para una prensa manual o un virolador de tapizado, una parte importante de esas listas no aplica. Una checklist larga mete ruido: oxmaint (~may/2026, solo búsqueda, corrida anterior) habla de fatiga con 60 ítems. (opinión: hay que filtrar, no copiar.)
- **«3-2-1» supone pieza rígida.** Formlabs (abierta): sobre-restringir puede ser necesario y un fixture menos restringido sirve para piezas con variación. jcproto (abierta): en piezas flexibles no se sobre-restringe y hay springback. Las piezas de tapizado son blandas (opinión), así que el 3-2-1 como regla fija puede ser la regla equivocada.
- **Simplicidad (Hoffman) vs. complejidad gratis (Formlabs).** Formlabs titula un apartado «Increase Geometric Complexity» y dice que la impresión da formas complejas sin costo extra. Hoffman dice lo contrario: lo sobre-elaborado solo suma costo. Para el sistema, la complejidad «gratis» es justo la tentación que ya le pasó (la estética antes que el mecanismo). Gana Hoffman; Formlabs es marketing de impresoras (opinión).
- **Las normas de seguridad que se piden aplican menos de lo que parece.** ISO 13857 regula distancias para alcanzar zonas peligrosas a través de aberturas de resguardos (Grassberger, solo búsqueda; ISO 2019); no es una norma de huecos de atrapamiento en una herramienta manual. Para eso está ISO 13854 (dedo 25 mm, mano 100 mm, de Misumi 2016, corrida anterior, solo crush). ISO 12100 no fija criterios de riesgo (idec). No encontré fuente que diga si un dispositivo impreso manual cae bajo esas normas (sin fuente). El umbral de «canto que lastima» no está en ninguna norma que haya podido abrir.
- **Los números de los blogs se contradicen.** Margen de seguridad del clamp: «al menos 20 %» (Ridiculous Machine Tools, ≈feb/2025) contra factor 2 a 3 y subir una clase (Roche, 05/05/2026). Relación de palanca «6:1 a 10:1» sale de Firgelli (blog sin autor, tono generado, ~sep/2026): no usarlo como dato.
- **Los controles de papel son los más flojos.** LearnLeanSigma (19/09/2026, abierta): warnings, labels y checklists son en general más débiles que un control físico o de sistema, y se degradan con carga y familiaridad. TICK (arXiv 2410.03608, oct/2024, solo búsqueda): el auto-refinamiento ingenuo de un LLM puede empeorar. O sea que una checklist que la IA «se lee» no alcanza.
- **Vendors de FDM piden ensayos, no confianza.** Omni3D (15/10/2026, abierta): no hay un porcentaje genérico de pérdida de resistencia en Z que sirva para todos; definir el ensayo de aceptación antes de imprimir.

## Lo que no se les había ocurrido
1. **Una puerta 0 con prueba de aceptación escrita antes del CAD.** Omni3D (abierta): qué ubica/sujeta, fuerzas, movimiento permitido y el ensayo de aceptación («acceptance test»). arXiv 2605.17448 (abierta) encontró que un blueprint previo subió IoU de .444 a .592; sus fallas eran interfaces mal puestas y falta de holgura.
2. **Usar el propio APQP de la casa como plantilla de revisión.** El checklist APQP (13/11/2008, solo búsqueda) lista en la fase 3 «Tool Design and Tool FMEA», «Verification of Tool Functionality» y «Tool Design Review». Fak ya trabaja con AMFE/APQP: la revisión del utillaje puede hablar ese idioma (opinión).
3. **Un DFMEA mínimo por herramienta, sin números.** LearnLeanSigma (~ago/2026, solo búsqueda): cadena función → efecto → modo de falla → causa de diseño, y «DFMEA does not assume process controls»: una falla de diseño no se deja para que el operario la agarre. Con 6 a 10 renglones por herramienta (se atasca, no cierra, pellizca, se afloja, rompe a las N veces, se carga al revés). Los S/O/D y el RPN tienen críticas (qualitydigest, ~2020, corrida anterior); ahí no hay evidencia a favor (opinión: sin números).
4. **Capacidad ≠ fuerza.** Roche (abierta): la fuerza real del clamp es 30 a 50 % de la capacidad nominal y depende de dónde va el husillo. Es un error típico de «ver solo la hoja de datos».
5. **Mango y fuerza humana con datos.** Atlas Copco (2020, abierta): 34 mm para montaje liviano y 38 mm para esfuerzo, muñeca recta. Ergoweb (≈2013, solo búsqueda): 29 lb de fuerza de palanca como máximo. Mango de rigidez media mejor que PLA rígido (PMC12383637, solo búsqueda). Son datos de herramientas eléctricas o generales, no de palancas de utillaje (aviso).
6. **Diseñar quién toca qué:** interfaces de contacto reemplazables y insertos (Omni3D, Formlabs, abiertas); que el utillaje se sostenga solo mientras se sujeta, a una mano, con expulsión asistida (Bateman, solo búsqueda); caras planas para poder medir el utillaje (Formlabs).
7. **Prevenir sobre detectar** (LearnLeanSigma, abierta) aplicado a la propia IA: lo que se puede convertir en chequeo automático del modelo (hueco < 25 mm en el barrido, canto sin radio, holgura, volumen de barrido contra el entorno) vale más que un renglón en la guía. Y una checklist debe nacer de la experiencia de quien chequea (researchgate, s/f, corrida anterior, solo búsqueda): las correcciones de Fak son la fuente (opinión).
8. **Fases con puerta aprobadas por el experto, también para construir el agente:** CARE (arXiv 2604.28043, 2026, solo búsqueda): artefactos por fase y el experto aprueba cada puerta. No es de utillajes; solo refuerza el patrón.

## Qué se buscó y no se encontró
- Ningún estudio que mida si las revisiones de diseño o las checklists reducen errores en utillajes. La evidencia es de blogs y práctica; la revisión sistemática que hallé (PMC3176176, 2011) es de hospitales y limitada.
- Henriksen y Rong: solo fichas de libros, no abrí el contenido. Hoffman: solo extractos de terceros, no el libro.
- Texto de ISO 12100, 13854 y 13857: solo tablas de terceros; no abrí las normas (de pago).
- Radio mínimo de canto para un utillaje manual impreso: solo MIL-STD-1472 (6,4 mm, mesas de trabajo, corrida anterior, solo búsqueda). Valor para pieza chica: sin fuente.
- Una revisión de diseño específica de FDM para utillajes publicada por un organismo independiente: no hallé.
- No busqué el tema de «Poka-yoke en piezas flexibles de tapizado» ni cómo se cuenta el tiempo de revisión por fase.

## Veredicto para este frente (2-4 frases; seguridad alta/media/baja y por qué)
Lo que conviene cambiar primero (opinión): una **puerta 0** (requisitos + prueba de aceptación + búsqueda de componentes estándar o ya hechos) antes de abrir el CAD, y un orden fijo **mecanismo → ergonomía y seguridad → forma**, con la verificación del barrido como puerta antes de tocar la estética. Segundo, convertir en chequeos automáticos del modelo (cantos, huecos de atrapamiento, holgura, volumen de barrido) lo que hoy marca el ingeniero, en vez de sumar texto a la guía. Seguridad **media-alta** en el orden de trabajo y en reusar piezas estándar (varias fuentes independientes, una de ellas el libro de referencia, pero solo extractos). Seguridad **baja** en cualquier número (radio de canto, fuerza, factor de seguridad, relación de palanca): las fuentes son blogs o vendors y se contradicen.