# DFM y DFA aplicados a dispositivos de planta (y DfAM en FDM): lo que hay afuera
Consultado el 20/10/2026.

Nota de método: se usaron 8 búsquedas (la herramienta cortó las siguientes) y se abrieron 4 fuentes enteras o casi. Las fechas con «~» son cálculo mío a partir del «hace N días» del buscador. Lo que no dice «abierta» es solo fragmento de búsqueda.

## Qué hay

| Qué | Qué dice, en una frase | Fuente (link) | Fecha | abierta/solo búsqueda |
|---|---|---|---|---|
| **augura** (pzfreo, Apache-2.0) | Analiza imprimibilidad leyendo el BREP exacto de build123d/STEP: voladizos, puentes, orientación, hermeticidad, vuelco, cabe en cama, brim, espesor de pared. Es «pre-alpha», 1 estrella, 74 commits. | https://github.com/pzfreo/augura | s/f (la página no muestra último commit) | abierta |
| **mcp-dfm** (Casys-AI, MIT) | Mide envolvente, área de voladizo y espesor mínimo sobre STEP (vía Gmsh) y lo compara con límites que pone quien llama; no declara «fabricable». 0 estrellas, 25 commits, v0.4.1. | https://github.com/Casys-AI/mcp-dfm | s/f | abierta |
| **printcheck** (keivanmalhani, MIT) | Sobre STL: voladizos (45° por defecto), paredes finas (muestreo, 0,8 mm), orientación entre 24 giros, cabe en cama. | https://github.com/keivanmalhani/printcheck | s/f | solo búsqueda |
| Issue #81 de **3d-cli** | Un chequeo de imprimibilidad en malla cuenta las interfaces entre volúmenes como pared fina y voladizo (falso positivo). | https://github.com/alex-mextner/3d-cli/issues/81 | ~11/10/2026 | solo búsqueda |
| **AgentsCAD** (CMU, arXiv 2607.02448) | Agente LLM que detecta voladizos >45° en un STEP y propone giros, filetes y chaflanes; probado con un solo caso (una casita de pájaros). | https://arxiv.org/html/2607.02448v2 | 07/07/2026 | abierta (parcial, hasta §4.2) |
| **LLM-Aided DFM** (arXiv 2609.05559) | Rediseño DFM como secuencia de cambios chicos, cada uno verificado; dice que un solo disparo es poco fiable. Informe preliminar. | https://arxiv.org/abs/2609.05559 | ~03/09/2026 | solo búsqueda |
| **Stratasys, guía de utillaje FDM** | Orientación, anisotropía (Nylon 12CF: 4.990 psi en Z contra 10.960 en XY), ángulos autosoportados, agujero «diamante» más reaparado, insertos térmicos, consolidar piezas solo si cada una se puede orientar. | https://www.stratasys.com/contentassets/b7785854f88542eb96af69c22af766f5/dg_fdm_designconsiderationsfdmtooling_0718a.pdf | 2016-2018 (©) | abierta |
| **Booth, hoja DfAM (Purdue)** | Hoja de 1 página de errores típicos de novatos, usada como filtro «pasa/no pasa» en un taller de mucho volumen. | https://engineering.purdue.edu/cdesign/wp/wp-content/uploads/2017/08/MD-17-1084.pdf | 2017 | solo búsqueda (el dominio no dejó abrirla) |
| **Índice DFA Boothroyd-Dewhurst** | Índice = 2,93 s × piezas mínimas teóricas ÷ tiempo de armado estimado, de 0 a 100. | https://www.dfma.com/forum/2019pdf/devenish.pdf | ~2019 | solo búsqueda |
| Guía de jigs FDM (3D-Demand, proveedor) | Pared estructural mínima 1,5 mm, 2-3 mm en jigs de producción; resistencia en Z = 50-70 % de XY. | https://www.3d-demand.com/blog/how-to-design-fdm-jigs-fixtures | ~04/2026 | solo búsqueda (blog comercial) |
| Guía de jigs (Sovol, fabricante de impresoras) | Checklist: datums, pines/llaves, patrón asimétrico para que cargar mal sea imposible, holguras de inserción, filetes. | https://www.sovol3d.com/blogs/news/3d-printed-jigs-and-fixtures-how-to-design-reliable-workshop-aids | ~09/2026 | solo búsqueda (blog comercial) |
| Innovation M2 (taller de servicios) | La regla de 45° es simplista: depende de material, temperatura, boquilla, altura de capa y solape. | https://innovationm2.com/en/blog/3d-print-fdm-guide/ | ~01/2024 | solo búsqueda |
| Wiki de Bambu Studio | La velocidad en voladizos se decide con un «grado de voladizo» en % por línea de extrusión, no con un ángulo. | https://wiki.bambulab.com/en/software/bambu-studio/slow-down-for-overhang | s/f | solo búsqueda |
| Holguras (3dprintbounty vs 3dprofilefix) | Una dice que la holgura es total sobre el diámetro; la otra, por lado y más ~0,2 mm porque el agujero sale chico. | https://3dprintbounty.com/blog/3d-printing-tolerances-guide y https://www.3dprofilefix.com/guides/clearance-fit-tolerance-guide.html | ~07/2026 | solo búsqueda (blogs) |
| Kalamazoo Makerspace | Fallas semanales: ignorar orientación y carga, confiar en los valores por defecto del slicer, imprimir en una pieza lo que debía ser ensamble. | https://kzoomakers.org/how-to-3d-print-failures-we-see-every-week.html | ~01/2026 | solo búsqueda (makerspace) |
| Fab Academy, prueba de reglas en una A1 mini | Imprime piezas de prueba de ángulo y espesor en la impresora propia en vez de confiar en tablas. | https://fabacademy.org/2025/labs/chaihuo/docs/week5/chaihuo/week05_group_assignment_3d_printer_test_en/ | 2025 | solo búsqueda |

## Fuentes

Abiertas (leídas con la herramienta de lectura de páginas):
- augura — https://github.com/pzfreo/augura — s/f — abierta
- mcp-dfm — https://github.com/Casys-AI/mcp-dfm — s/f — abierta
- AgentsCAD: Automated DFM of FDM Parts — https://arxiv.org/html/2607.02448v2 — 07/07/2026 — abierta
- Stratasys, Design Considerations: FDM Additive Manufacturing Tooling — enlace de la tabla — 2016-2018 — abierta

Solo búsqueda: las demás de la tabla, más:
- cadcrowd y layerx3d (pared mínima 0,8 / 1,2 mm) — https://www.cadcrowd.com/blog/design-for-3d-printing-dfam-rules-for-fdm-sla-and-sls-parts-that-actually-work/ y https://layerx3d.in/blog/fdm-design-rules-wall-thickness-overhangs-bridging-tolerances — ~08/2026 y ~06/2026 — solo búsqueda (blogs de servicios)
- garuda3d (puente hasta ~60 mm) — https://garuda3d.com/design-for-additive-manufacturing — s/f — solo búsqueda
- Foro de Bambu, «Make Overhang Printable» — https://forum.bambulab.com/t/more-options-at-bambu-studio-make-overhang-printable-option/126544 — ~12/2024 — solo búsqueda (foro)
- Protolabs, 7 errores — https://www.protolabs.com/resources/design-tips/7-mistakes-to-avoid-when-designing-3d-printed-parts/ — ~08/2025 — solo búsqueda

## Lo que CONFIRMA lo que hace el sistema

- **Chequeos automáticos de imprimibilidad desde código existen y son los mismos que el sistema quiere.** augura (https://github.com/pzfreo/augura, abierta) hace voladizos, espesor de pared, hermeticidad, cabe en cama, vuelco y búsqueda de orientación sobre build123d, y puede cortar con código de salida (`--exit-code`). mcp-dfm (https://github.com/Casys-AI/mcp-dfm, abierta) hace tres de los mismos sobre STEP. Es decir, construir esos controles no es inventar nada.
- **Un cambio chico y verificado por vez** es lo que propone el único trabajo que encontré sobre rediseño DFM con LLM (https://arxiv.org/abs/2609.05559, solo búsqueda): un disparo único «es poco fiable» y arma el rediseño como secuencia de transiciones verificadas. Coincide con tu queja de que la IA «rehacía el modelo entero» (opinión: es evidencia preliminar, el propio informe dice que la evaluación sigue en curso).
- **Requisitos antes que forma.** La guía de Stratasys (abierta) pone primero los requisitos del utillaje (datums, cargas, tolerancias, puntos de apoyo) y manda decidir el material «como primer paso». Esto apoya no empezar por la estética; pero ver la contradicción abajo.
- **La orientación es una decisión estructural, no de comodidad.** Stratasys (abierta) muestra Z a menos de la mitad de XY en Nylon 12CF; 3D-Demand (solo búsqueda, blog comercial) dice 50-70 %. Los tres chequeos de orientación que vi (augura, printcheck, mcp-dfm) piden que la orientación sea una entrada declarada.
- **Hardware duro en los puntos que mandan.** Stratasys recomienda bujes o insertos metálicos en puntos de montaje y agujeros un poco chicos para terminarlos después; insertos térmicos como opción preferida (abierta). Coincide con la idea de TPU/insertos de la investigación del 17/10.
- **Cantos.** Stratasys pide chaflanes y radios «cuanto más grandes, mejor» (abierta) y Sovol lista «filetes» en su checklist de jigs (solo búsqueda). Ojo: lo dicen por resistencia, no por lastimar a un operario; que un canto lastime es regla de seguridad, no DfAM (opinión; sin fuente para un chequeo de ergonomía).
- **Poka-yoke y datums como checklist de diseño.** Sovol (solo búsqueda): referencias, pines o llaves, patrón asimétrico para que cargar mal sea imposible.

## Lo que lo CONTRADICE o le pone en duda

1. **Los números no son consenso.** Pared mínima: 0,8 mm (https://www.cadcrowd.com/blog/design-for-3d-printing-dfam-rules-for-fdm-sla-and-sls-parts-that-actually-work/, ~08/2026), 1,2 mm (https://layerx3d.in/blog/fdm-design-rules-wall-thickness-overhangs-bridging-tolerances, ~06/2026) y 1,5 mm en jigs (3D-Demand, ~04/2026). Puente: 10 mm contra ~60 mm (garuda3d). Holgura: «total» (3dprintbounty, ~07/2026) contra «por lado más 0,2» (3dprofilefix, ~07/2026): la misma cifra da piezas distintas. Si el sistema trae esas tablas copiadas, importa la contradicción adentro. Todas son blogs comerciales, solo búsqueda.
2. **La regla de 45° es una simplificación.** Innovation M2 (~01/2024, solo búsqueda) la llama «tan limitante como simplista»; el wiki de Bambu (solo búsqueda) usa un grado de voladizo por línea, no un ángulo. augura, printcheck y AgentsCAD usan 45° por defecto (abiertas las dos primeras en lo que dice el README/paper). Un umbral fijo da falsos positivos y negativos.
3. **Un chequeo automático puede mentir.** mcp-dfm (abierta) dice que el espesor es «una muestra» y no una prueba del mínimo global, que el muestreo puede perder una zona fina, que no saca la cara apoyada en la cama y que no modela soportes, puentes ni material. El issue #81 de 3d-cli (~11/10/2026, solo búsqueda) muestra interfaces entre volúmenes contadas como pared fina. Si la IA recibe ruido, aprende a ignorar el control (opinión).
4. **La DFA de Boothroyd-Dewhurst mide armado de producto en serie.** Su índice usa 2,93 s por pieza ideal y tablas de tiempos de manipulación (dfma.com, solo búsqueda). Un virolador de una unidad no tiene costo de armado que valga; lo caro son horas de diseño, impresiones tiradas e iteraciones (opinión). Además la regla «fundí piezas» choca con FDM: Stratasys la acepta solo si cada pieza fusionada se puede orientar bien (abierta), y un makerspace lista «ensamblaje impreso en una pieza» como falla frecuente (~01/2026, solo búsqueda).
5. **Estética no es el enemigo.** Stratasys llama a la estética una característica «a menudo pasada por alto» y le dedica una sección con costuras y orientación de caras (abierta). Lo que falló en el virolador fue el orden, no la estética (opinión).
6. **Nada de esto detecta lo que pasó en el último diseño.** Dibujar de cero una palanca que ya existía, cajas peladas o un mecanismo que no funciona no son errores de DfAM: ningún chequeo que abrí mide eso. Todos son geométricos.
7. **La evidencia de frecuencia de errores es floja.** Lo único «con método» es la hoja de Booth, armada con expertos y estudiantes de un taller (2017, solo búsqueda, no pude abrirla); el resto son listas de blogs y un makerspace. No encontré un estudio que cuente qué error DfAM de FDM es el más frecuente.
8. **El único agente DFM-FDM con LLM probó un caso.** AgentsCAD (abierta, 07/07/2026) usa una casita de pájaros y dice resolver el problema «parcialmente»; usa Claude Sonnet más un verificador visual de otro proveedor.

## Lo que no se les había ocurrido

- **Resultado de tres estados: pasa / falla / no verificado.** mcp-dfm lo hace y «declara lo que no chequeó» (abierta). Un control que no pudo medir hoy da «OK» en silencio (opinión: es el riesgo mayor de los gates).
- **Usar augura como pieza, no como dependencia ciega.** Es de la misma persona que build123d-mcp (que ya usan) y su README lo ubica como paso «¿se imprime?» antes de la laminación; pero es pre-alpha con 1 estrella, así que lo sensato es compararlo contra piezas de verdad conocida (como ya hacen con build123d-mcp) o copiar la idea de sus nueve chequeos. Sin verificar que ande en Windows ni con CATIA (se le entrega un STEP).
- **Búsqueda de orientación como chequeo previo:** augura y printcheck puntúan las 24 orientaciones por área de voladizo con la cama como restricción dura. Evita que la IA diseñe una pieza que solo se imprime con soportes en una cara funcional.
- **Prueba de calibración propia en la A2L.** Fab Academy (solo búsqueda) y las guías de holgura recomiendan imprimir una pieza de prueba (escalera de holguras 0,0-0,4 mm; piezas de ángulo y espesor) y usar SUS números. Un solo cupón reemplaza los números en conflicto de arriba y quedan como constantes de la skill (opinión, sustentada en 3dprintbounty/3dprofilefix y Fab Academy).
- **Agujero rombo/lágrima + escariado** para ubicaciones críticas (Stratasys, abierta), y **agujero chico + buje** cuando la posición manda.
- **Las tres preguntas de Boothroyd-Dewhurst como control de concepto, no como tiempo:** ¿se mueve respecto de las demás?, ¿es de otro material?, ¿tiene que separarse para armar? Ese conteo (partes mínimas teóricas) se puede pedir a la IA al proponer un mecanismo (opinión; las tres preguntas salen de https://www.ijeat.org/wp-content/uploads/papers/v9i2/B4942129219.pdf, solo búsqueda, ~2019).
- **Jerarquía de la hoja de Booth:** marcas «críticas» que bloquean primero y puntajes después. Sirve de modelo para separar gates duros de avisos (opinión).

## Qué se buscó y no se encontró

- Guía oficial de diseño de Bambu Lab para la A2L: no apareció; solo pruebas de terceros con A1 mini y P1S. Reglas específicas de la A2L: sin fuente.
- Estudio que cuantifique los errores DfAM más frecuentes en FDM: no.
- DFA de Boothroyd-Dewhurst aplicada a utillajes impresos o a piezas de una sola unidad: no.
- Chequeo DfAM que corra sobre CATIA directamente: no. Las herramientas leen STEP/STL; que un STEP exportado de CATIA R21 las alimente sin problemas, sin verificar.
- Fecha del último commit de augura y mcp-dfm: la página abierta no la muestra; sin verificar.
- Hoja de Booth completa: el dominio no dejó abrirla. Libro de Boothroyd-Dewhurst: no abierto; la fórmula sale de páginas de la propia empresa y de un paper.
- Cobertura: 8 búsquedas hechas; la herramienta cortó las siguientes aunque quedaba cupo en el tope general.

## Veredicto para este frente (2-4 frases; seguridad alta/media/baja y por qué)

Qué cambiar primero: lo que más pesa de lo que pasó en el virolador no se arregla con DfAM; lo que sí tiene respaldo es (1) la secuencia requisitos → mecanismo → forma con cambios chicos verificados (Stratasys, 2609.05559) y (2) un gate chico de imprimibilidad con resultado de tres estados, calibrado con UN cupón impreso en la A2L antes de fijar umbrales (voladizo con orientación declarada, pared como múltiplo de boquilla, hermético, cabe en cama, vuelco). Seguridad **alta** en que esos chequeos existen y se automatizan; **media** en el orden recomendado, porque se apoya en un informe preliminar y en una guía de proveedor de 2016-2018, más opinión mía; **baja** en que reduzcan las correcciones del ingeniero, porque no hallé medición de eso con IA. DFA clásica (índice de tiempo de armado): dejarla afuera salvo las tres preguntas de partes mínimas.