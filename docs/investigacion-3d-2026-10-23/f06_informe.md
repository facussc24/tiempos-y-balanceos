# Simulación rápida de mecanismos y modelado paramétrico incremental: lo que hay afuera
Consultado el 20/10/2026.

Nota: los links van sin «https://» a propósito (un filtro de la corrida anterior bloqueó ese texto). «abierta» = leída con web_fetch (en esta corrida o la anterior, según notas); «solo búsqueda» = solo el fragmento del buscador.

## Qué hay

| Qué | Qué dice, en una frase | Fuente (link) | Fecha | abierta/solo búsqueda |
|---|---|---|---|---|
| manifold3d (booleanas sobre malla) | En 1000 pares de mallas de 200 mil a 1,5 millones de polígonos, Manifold da 120 ms de mediana y resultado válido en todos (benchmark del fabricante de otra librería, trueform) | polydera.com/algorithms/python-mesh-boolean-libraries-2026 | 29/06/2026 (aprox.) | abierta |
| manifold3d, otra medida | Un benchmark de 24 casos: Manifold da 24/24 correctos a unos 10 ms por caso; el motor propio de yapCAD acierta 8/24 | github.com/rdevaul/yapCAD/pull/61 | s/f | solo búsqueda |
| MeshLib (blog del fabricante) | MeshLib calcula una unión en 0,093 s, unas 3 veces más rápido que Manifold, que aparece como la mejor opción abierta (~0,5 s en esa malla) | meshlib.io/blog/comparing-3d-boolean-libraries/ | ~27/08/2026 | solo búsqueda |
| Manifold: distancia mínima | Tiene `MinGap` (distancia mínima entre dos sólidos hasta un largo de búsqueda), además de RayCast y WindingNumber | manifoldcad.org/docs/html/classmanifold_1_1_manifold.html | s/f | solo búsqueda |
| trimesh `CollisionManager` | Choque y distancia mínima entre pares de mallas, con punto de contacto y profundidad; `set_transform` mueve un objeto sin recrearlo. Necesita FCL | trimesh.org/trimesh.collision.html | s/f (v5.1.1) | abierta |
| python-fcl | Binding de FCL, 0.7.0.11 del 08/04/2026, ruedas Windows cp39 a cp314, BSD-3, ~270 ★ | pypi.org/project/python-fcl ; github.com/BerkeleyAutomation/python-fcl | 08/04/2026 | solo búsqueda |
| FCL (paper) | En un benchmark de un piano en un cuarto, choque discreto 4 ms, continuo 5,5 ms, penetración 8 ms | gamma.cs.unc.edu/FCL/fcl_docs/webpage/pdfs/fcl_icra2012.pdf | 2012 | solo búsqueda |
| Detección de choque con muestreo | En trayectorias de robot, la malla del volumen barrido por poses discretas tuvo precisión perfecta pero baja cobertura hasta tener muchas poses | arxiv.org/pdf/2409.09918 | 2024 | solo búsqueda |
| MuJoCo / PyBullet / Chrono | MuJoCo usa geometría convexa; PyBullet maneja cóncavo solo estático; en Chrono hay un bug con mallas no convexas | notas de la corrida anterior (docs de MuJoCo, lista de Chrono 21/10/2025) | 2025 | solo búsqueda |
| build123d `joints` | Joints Rigid, Revolute, Linear, Cylindrical y Ball con rango (`angular_range`, `linear_range`); `connect_to(angle=…)` reposiciona una pieza con un solo valor. No hace choques | build123d.readthedocs.io/en/stable/joints.html | v0.13.0, s/f | abierta |
| build123d-mcp (guía para la IA) | Error común listado: armar con `.move()` absoluto en vez de joints, porque se rompe al cambiar algo | github.com/pzfreo/build123d-mcp/blob/main/llms.md | s/f | solo búsqueda |
| Solvers de restricciones en Python | py_slvs 1.0.6 (SolveSpace v2.3 fork, rueda Windows cp311; lo usa el assembly3 de FreeCAD); es de nivel bajo | pypi.org/project/py-slvs | s/f | solo búsqueda |
| CadQuery assembly | Tiene `constrain`/`solve` con restricciones Axis, Point y Plane y selectores por texto o etiqueta | cadquery.readthedocs.io/en/latest/assy.html | s/f | solo búsqueda |
| build123d: selección topológica | La selección es por geometría (ordenar, filtrar, agrupar), no hay nombres persistentes | build123d.readthedocs.io/en/stable/topology_selection.html | s/f | abierta |
| FreeCAD, problema del nombre topológico | El algoritmo 1.0 identifica referencias rotas, sugiere y repara solo con alta confianza; sigue recomendando planos de referencia | wiki.freecad.org (página TNP) | s/f; repo archivado 01/04/2026 | abierta |
| CATIA V5 PowerCopy / UDF | Plantilla con Components, Inputs y parámetros «publicados»; al instanciar un PowerCopy se cortan los vínculos con la referencia | catiadesign.org/_doc/docv5r14/Product%20Knowledge%20Template.pdf ; 3dswym.3dexperience.3ds.com (post «Power Copy vs User Feature») | R14 s/f; post ~11/2025 | solo búsqueda |
| CATIA: crear un mecanismo por API | Se puede crear Mechanism, Joints (Revolute, Prismatic) y comandos de ángulo; el ejemplo no simula ni mide choque | catiadesign.org/_doc/V5Automation/online/CAAScdDmuUseCases/CAAKiiMechanismCreation.htm | (c) 2001 | abierta |
| CATIA: interferencia en cinemática | Por defecto no avisa interferencia durante la simulación; hay tres métodos y uno no pide licencia de Kinematics | rand3d.com (nota de las notas previas) | ~10/2025 | solo búsqueda |
| Papers de edición con IA | BenchCAD: los modelos fallan en ediciones locales fieles; otros: CADEngBench, LLM4CAD-Editor, IterCAD | arxiv.org/abs/2605.10865 ; 2608.09296 ; 2606.20607 ; 2606.13368 | 05 a 08/2026 | solo búsqueda |

## Fuentes

- Joints — build123d 0.13.0 — build123d.readthedocs.io/en/stable/joints.html — s/f — abierta
- trimesh.collision (5.1.1) — trimesh.org/trimesh.collision.html — s/f — abierta
- Topology Selection and Exploration — build123d.readthedocs.io/en/stable/topology_selection.html — s/f — abierta (corrida anterior)
- Topological naming problem — wiki.freecad.org — s/f — abierta (corrida anterior)
- CAAKiiMechanismCreation — catiadesign.org/_doc/V5Automation/online/CAAScdDmuUseCases/CAAKiiMechanismCreation.htm — 2001 — abierta (corrida anterior)
- Python mesh boolean benchmark — polydera.com/algorithms/python-mesh-boolean-libraries-2026 — 29/06/2026 aprox. — abierta (corrida anterior)
- Comparing 3D Boolean Libraries 2026 — meshlib.io/blog/comparing-3d-boolean-libraries/ — ~27/08/2026 — solo búsqueda
- yapCAD PR 61 (manifold engine) — github.com/rdevaul/yapCAD/pull/61 — s/f — solo búsqueda
- Manifold clase (MinGap) — manifoldcad.org/docs/html/classmanifold_1_1_manifold.html — s/f — solo búsqueda
- python-fcl — pypi.org/project/python-fcl — 08/04/2026 — solo búsqueda
- FCL ICRA 2012 — gamma.cs.unc.edu/FCL/fcl_docs/webpage/pdfs/fcl_icra2012.pdf — 2012 — solo búsqueda
- Hardware-accelerated ray tracing for collision (swept volumes) — arxiv.org/pdf/2409.09918 — 2024 — solo búsqueda
- trimesh issue 2223 (objeto adentro de otro) — github.com/mikedh/trimesh/issues/2223 — ~05/2024 — solo búsqueda
- trimesh issue 300 (CCD distinto) — github.com/mikedh/trimesh/issues/300 — ~2018 — solo búsqueda
- build123d-mcp llms.md — github.com/pzfreo/build123d-mcp/blob/main/llms.md — s/f — solo búsqueda
- build123d issues 1514 y PR 1490 — github.com/gumyr/build123d/issues/1514 ; /pull/1490 — 10/2026 — solo búsqueda
- py_slvs — pypi.org/project/py-slvs ; slvstopy — kktse.github.io/jekyll/update/2020/05/20/slvstopy-python-library.html — 2020 — solo búsqueda
- CadQuery Assemblies — cadquery.readthedocs.io/en/latest/assy.html — s/f — solo búsqueda
- CATIA Product Knowledge Template R14 — catiadesign.org/_doc/docv5r14/Product%20Knowledge%20Template.pdf — s/f — solo búsqueda
- Knowledge Template (apuntes) — scribd.com/document/226708189 — s/f — solo búsqueda (foro/apunte, no oficial)
- Onshape (foro, sin detección de choque al mover partes) — 2020; rand3d.com — ~10/2025 — solo búsqueda (foros)
- BenchCAD — arxiv.org/abs/2605.10865 — 11/05/2026 — solo búsqueda

## Lo que CONFIRMA lo que hace el sistema

- **Pasar de OpenCASCADE a mallas con manifold3d para el barrido de movimiento es una apuesta razonable.** Manifold da resultados válidos en el 100 % de 1000 pares en el benchmark de Polydera (polydera.com/algorithms/python-mesh-boolean-libraries-2026, abierta, 29/06/2026) y ~10 ms por caso en 24 casos chicos (github.com/rdevaul/yapCAD/pull/61, solo búsqueda). Un utillaje tiene miles de triángulos, no millones: milisegundos por posición es creíble. Que de minutos a segundos sea por el cambio de motor no lo prueba ninguna fuente que encontré (opinión: el tiempo también depende de cuánto se rehace por posición).
- **Mover la pieza en vez de reconstruirla.** trimesh deja cambiar la transformada de un objeto con `set_transform` sin recrear el manager (trimesh.org/trimesh.collision.html, abierta). Confirma el patrón «un modelo, N posiciones».
- **Armar con relaciones y no con coordenadas absolutas.** La propia guía de build123d-mcp lista como error común el `.move()` absoluto (github.com/pzfreo/build123d-mcp/blob/main/llms.md, solo búsqueda). FreeCAD, después de años, sigue recomendando planos y datums como referencia estable (wiki TNP, abierta): es la misma idea.
- **Reusar una palanca que ya existe es lo que CATIA institucionaliza.** PowerCopy y UDF existen justo para reusar geometría con entradas y parámetros publicados (catiadesign.org, Product Knowledge Template R14, solo búsqueda). El reclamo del ingeniero («dibujó de cero algo ya hecho») tiene su equivalente de oficio.

## Lo que lo CONTRADICE o le pone en duda

- **Probar posiciones sueltas puede dejar pasar un choque entre dos posiciones.** El paper de volúmenes barridos (arxiv.org/pdf/2409.09918, solo búsqueda, 2024) midió que la aproximación por poses discretas tenía baja cobertura hasta tener muchas poses. Es robótica, no utillaje, pero el riesgo es el mismo: un paso de 5° puede saltar una uña de 1 mm. FCL trae detección continua (FCL, ICRA 2012, 5,5 ms en su ejemplo) pero hay un caso de resultados distintos entre el FCL de trimesh y el instalado aparte, de 2018 (github.com/mikedh/trimesh/issues/300): viejo, no hay prueba de que siga.
- **El choque por malla de FCL/trimesh puede no ver una pieza que quedó toda adentro de otra.** Issue 2223 de trimesh (solo búsqueda, ~2024) y el paper de FCL: una malla representa solo la frontera. Con la intersección booleana de Manifold (volumen > 0) no pasa, por eso conviene como juez. (Opinión: usar ambos y comparar.)
- **Las joints de build123d son menos de lo que suenan.** `connect_to` reposiciona una sola vez y no liga las piezas (doc abierta, v0.13.0); no resuelve lazos cerrados (una palanca con biela y bancada), no detecta choque, solo valida el rango. Hay un issue abierto (14/10/2026, #1514) por joints en BuildPart sobre planos que no son XY, y un PR (#1490) por joints que se pierden al intersectar (github.com/gumyr/build123d, solo búsqueda). Para el sistema, que ya tiene el problema de worker en Windows con build123d-mcp, es una dependencia con aristas.
- **No hay solver cinemático «listo» y maduro en Python.** Lo que existe: py_slvs (SolveSpace v2.3, «nivel bajo» según su propia ficha) y `Assembly.constrain` de CadQuery, que posiciona (Axis/Point/Plane) pero no recorre un mecanismo. Un autor de 2020 dice que SolveSpace no alcanza para mecanismos 3D complejos (kktse.github.io, blog con autor, solo búsqueda). Para una palanca de un grado de libertad, una transformada a mano con ángulo basta (opinión); un solver solo justifica el costo si hay lazo cerrado.
- **Los motores de física (MuJoCo, PyBullet, Chrono) no son la herramienta.** Son para dinámica y trabajan con convexos o con límites con mallas cóncavas (notas previas, solo búsqueda). Un utillaje impreso con cajas, nervios y huecos es cóncavo: habría que partirlo en convexos, que es más trabajo que una booleana. Chrono tiene un bug de mallas no convexas.
- **«Edición localizada» con IA no está resuelta.** BenchCAD (arxiv.org/abs/2605.10865, 11/05/2026, solo búsqueda) reporta que los modelos fallan al hacer ediciones locales fieles. El problema del nombre topológico sigue: FreeCAD 1.0 solo repara «con alta confianza» y el repo con el algoritmo está archivado desde el 01/04/2026 (wiki TNP, abierta). build123d selecciona por geometría (ordenar, filtrar), no por nombres (doc abierta): si cambia una cota, «la cara de arriba» puede ser otra.
- **CATIA por COM: lo que hay no alcanza a la vista.** El ejemplo oficial de automatización crea mecanismos y juntas (abierta, 2001) pero no muestra simular ni medir choque. Un sitio de terceros dice que CATIA por defecto no avisa interferencia en la cinemática (rand3d.com, ~10/2025, solo búsqueda, marcado: sitio de terceros). Y PowerCopy rompe los vínculos al instanciar (apuntes de Scribd, solo búsqueda): una corrección posterior en la plantilla no baja sola a lo ya usado. UDF mantiene el vínculo (opinión: leer ambos manuales antes de elegir; no encontré fuente oficial que lo diga claro).

## Lo que no se les había ocurrido

- **El rango de la joint ya es el recorrido a barrer.** `RevoluteJoint(angular_range=…)` y `LinearJoint(linear_range=…)` guardan en un solo lugar el recorrido de la palanca; el mismo dato sirve para ensamblar, para el barrido de choques y para el informe. Si el rango cambia, cambia la prueba sola (opinión, con base en la doc abierta).
- **Medir holgura, no solo «choca / no choca».** Manifold tiene `MinGap` y trimesh `min_distance_*` devuelve distancia y punto más cercano. Con eso el informe puede decir «holgura mínima 0,8 mm a 37°» en vez de «sin choques» (la holgura es lo que importa en FDM: ±0,2 mm de tolerancia, opinión).
- **Barrido en dos pasadas.** Paso grueso con muchas posiciones y chequeo rápido; donde la distancia mínima baja de un umbral, refinar el paso (bisección). No encontré fuente que lo documente para utillaje; sale de combinar `MinGap` con el hallazgo del paper de volúmenes barridos (opinión).
- **Un PowerCopy es, en Python, una función con firma.** Inputs = argumentos geométricos, parámetros publicados = argumentos con valor por defecto, UDF = función que se importa de una biblioteca. La palanca «ya hecha y probada» se guarda una vez como función con sus joints y se llama desde cada diseño (opinión; la correspondencia conceptual sale de plmcoach.com y la guía R14, solo búsqueda).
- **Orden de trabajo que sugiere la evidencia:** mecanismo con rectas y cilindros → barrido de choques y holguras → recién entonces estética. Ninguna fuente dice esto; es consecuencia de que con mallas el barrido es barato y reconstruir con filetes y cantos no (opinión).
- **Cambiar un parámetro sin reconstruir todo:** con script paramétrico, reconstruir todo es la forma normal (CadQuery y build123d no tienen árbol de historia editable). Lo que sí se puede es separar el script en piezas-función y volver a correr solo la que cambia, guardando el resultado en disco (opinión; sin fuente de benchmark).

## Qué se buscó y no se encontró

- Un benchmark de OpenCASCADE contra Manifold en piezas chicas de utillaje. Lo único hallado es una consulta del foro de OCCT de hace más de 15 años (CATIA 7 s contra OCC 3,5 min) con versión vieja: no sirve de evidencia hoy.
- Una receta publicada para correr el DMU Kinematics de CATIA por COM desde Python con detección de choque. Solo hay la API de creación de mecanismos.
- Mediciones de tiempo de MuJoCo/PyBullet/Chrono sobre mallas de utillaje (no hay; no se abrieron sus páginas en esta corrida).
- Un mecanismo de nombres persistentes en build123d. Hay etiquetas en CadQuery (`tag`, `?tag`) pero no es un sistema de referencias que sobreviva a cambios de forma.
- Cómo se comporta `RevoluteJoint` con más de dos piezas en lazo cerrado: la doc no lo trata.
- Evidencia de campo (casos reales) de fallas por no revisar entre poses en un utillaje impreso. Sin fuente.

## Veredicto para este frente

Mantener manifold3d como juez del barrido es acertado y barato; lo que falta es **cubrir entre posiciones** (paso fino o refinamiento por distancia mínima) y **medir holgura** además del choque, y registrar el recorrido en un lugar (joint con rango). Para la edición incremental, lo mejor documentado es no pelear contra el nombre topológico: plantillas con parámetros, joints y planos de referencia propios en vez de seleccionar caras por posición, y una biblioteca de piezas ya probadas (el equivalente de PowerCopy). Seguridad **media**: las medidas de velocidad de Manifold vienen de benchmarks del fabricante de otra librería o de un PR, con mallas distintas a las de la planta, y todo lo de edición con IA es de papers de 2026 sin reproducir; lo dicho sobre CATIA por COM es de documentación vieja (2001, R14).