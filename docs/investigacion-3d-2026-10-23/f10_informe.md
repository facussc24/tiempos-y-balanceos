# Formación y automatización de CATIA V5: lo que hay afuera
Consultado el 20/10/2026.

## Qué hay

| Qué | Qué dice, en una frase | Fuente (link) | Fecha | abierta/solo búsqueda |
|---|---|---|---|---|
| pycatia (repo) | Módulo Python para la API COM de CATIA V5: 371 ★, 81 forks, 2.038 commits, MIT, se autodefine «alpha software». Fecha del último commit: la página no la muestra (sin fuente) | https://github.com/evereux/pycatia | 20/10/2026 | abierta |
| pycatia (CHANGELOG) | Última versión 0.10.1; trae wrappers de `kinematics_interfaces`, `general_knowledge_interfaces`, catálogos (`create_catalog_from_csv`) y clases nuevas de V5-6R2024 | https://github.com/evereux/pycatia/blob/master/CHANGELOG.md | s/f | abierta |
| pycatia (doc de Relations) | Desde Python se crean fórmulas, checks, programas/reglas, leyes, tablas de diseño (xls/txt) y un informe XML de los checks (`generate_xml_report_for_checks`). Doc autogenerada de la ayuda V5Automation R28 (2020) | https://pycatia.readthedocs.io/en/latest/api/pycatia/knowledge_interfaces/relations.html | ©2026 | abierta |
| pycatia en Snyk | Última release 7/9/2025, mantenimiento «Healthy» | https://snyk.io/advisor/python/pycatia | s/f | solo búsqueda |
| AstroQuestStudio/catia-v5-mcp | MCP por COM con lote validado antes de tocar CATIA (`dry_run`), 152 lecciones de trampas COM, vigilante de ventanas emergentes, volumen por feature, niveles de seguridad. 0 ★, 3 commits, MIT, validado en R19. Declara huecos: «formulas and design tables, materials, rib / slot, undo» | https://github.com/AstroQuestStudio/catia-v5-mcp | 20/10/2026 | abierta |
| Otros MCP de CATIA | Fork de daiemon12 con 6 roles de agentes (VladimirGarmanov/catia-AI, dice que sus tests offline no validan CATIA real), CATIClaude (pyCATIA, jul 2026), uno de abr 2026; un blog dice que no hay MCP oficial de Dassault | https://github.com/VladimirGarmanov/catia-AI · https://vagon.io/blog/how-to-use-catia-with-codex-mcp-computer-use-guide | 2026 | solo búsqueda |
| Doc oficial V5Automation (espejo) — DMU Kinematics | Una macro CATScript crea mecanismo, pieza fija, juntas y comandos: `GetTechnologicalObject("Mechanisms")`, `AddJoint`, `AddCommand`. 16 tipos de junta, se referencian con líneas/planos. Muestra crear, no correr la simulación | https://catiadesign.org/_doc/V5Automation/online/CAAScdDmuUseCases/CAAKiiMechanismCreation.htm | © 2001 | abierta |
| PowerCopy/UDF por macro | Se instancian por macro con `InstanceFactory` (`BeginInstanceFactory`, `PutInputData`, `Instantiate`); lo confirma un foro: CATScript y CATVBA lo soportan | http://catiadoc.free.fr/online/cfyugpkt_C2/cfyugpktmt0005.htm · https://www.coe.org/p/fo/et/thread=23458 | s/f | solo búsqueda (web_fetch bloqueado) |
| Bug de PowerCopy | IBM APAR: una PowerCopy con sets de parámetros/relaciones no los instancia bien | https://ibm.com/support/pages/apar/HD10899 | s/f | solo búsqueda |
| GoEngineer: V5 Knowledge-Based Engineering | Online, 4 medias jornadas, **USD 995**: parámetros, fórmulas, reglas, checks, tablas de diseño, Power Copy, UDF, Knowledge Pattern, catálogos, macros | https://store.goengineer.com/products/catia-v5-knowledge-based-engineering | s/f (imagen de sep 2025) | abierta |
| 3DS catálogo EDU V5 | Curso oficial de Knowledgeware: 8 h, V5-6R2024 a 2026 | https://www.3ds.com/assets/edu/document/learning-experiences-for-catiav5.pdf | s/f | solo búsqueda |
| Cursos de Automation (VBA/CATScript) | Technia, TriMech y Rand3D: 4 días; GoEngineer: 3 días; EDST e-learning: 12 h sugeridas, sin precio visible | https://www.technia.com/en/training/catia-v5-automation/ · https://www.goengineer.com/training/catia-v5-visual-basic-automation · https://edstelearning.com/cad/catia/catia-advanced/fundamentals-of-catia-v5-automation/ | s/f | solo búsqueda |
| Cursos de DMU Kinematics | GoEngineer 1 día; EDST 5 h, **USD 80**, acceso 90 días; CERN 2 días, 544 CHF (probablemente para su gente, sin verificar) | https://store.goengineer.com/products/catia-v5-dmu-kinematics · https://edstelearning.com/cad/catia/catia-advanced/catia-v5-dmu-kinematics/ · https://plm-service.web.cern.ch/index.php/training/kinematics | s/f | solo búsqueda |
| Libros | Ross, *VB Scripting for CATIA V5* (2015, 172 pp, USD 59,99); Ziethen, *Macro Programming with VBScript* (McGraw-Hill 2013, 560 pp, ~USD 97). Un usuario dice del de Ross: «cheap but very basic» | https://www.barnesandnoble.com/w/vb-scripting-for-catia-v5-emmett-ross/1115670191 · https://www.abebooks.com/9780071800020/CATIA-V5-Hardcover-Dieter-Ziethen-0071800026/plp · https://www.eng-tips.com/threads/catia-vba-programming-sources.447741/ | 2013–2015 | solo búsqueda |
| Licencias | KIN = DMU Kinematics Simulator, KWA = Knowledge Advisor (productos aparte); las reglas y checks piden Knowledge Advisor, parámetros y fórmulas no | https://www.eng-tips.com/threads/license-abbreviations.208296/ · http://catiadoc.free.fr/online/kwrug_C2/kwruggs04.htm | s/f (viejo) | solo búsqueda |
| Vigencia de V5 | Existe V5-6R2026 (2026-02-06). Un vendedor (ohmycad): «one release per year». Otro (acecloudhosting): la IA nueva de Dassault no llega a V5 | https://ohmycad.com/en/which-version-of-catia/ · https://www.acecloudhosting.com/blog/catia-v5-vs-3dexperience-cloud/ · https://type3-caa.com/official-download-page/ | sep–oct 2026 | solo búsqueda |
| AADvark (arXiv 2604.15184) | Ningún sistema agente armaba ensambles con piezas móviles; lo logra con un solver de restricciones con errores informativos. Tijera: 20 iteraciones, 4,14 h, USD 15,85 | https://arxiv.org/pdf/2604.15184 | CAIS'26, may 2026 | abierta |
| CADWorld (arXiv 2609.16251) | Siete agentes que manejan la pantalla (computer-use) en tareas CAD: el mejor resuelve 25 % | https://arxiv.org/html/2609.16251v1 | ~sep 2026 | solo búsqueda |
| Comunidades | Foro Eng-Tips «DASSAULT: CATIA products» (hilos de 2025), foro COE, GrabCAD catia-users (2018). Fuentes que repiten todos: la ayuda `V5Automation.chm` de la instalación y grabar macros | https://www.eng-tips.com/threads/catia-v5-automation-help-and-resources.481515/ · https://grabcad.com/groups/catia-users/discussions/catia-v5-macro-programming?page=1 | 2018–2025 | solo búsqueda (foros) |

## Fuentes
Los links están en la tabla, uno por fila. Hojas de trabajo en `notas.md`. Todo lo de foros, blogs de vendedores y espejos de documentación (catiadoc.free.fr, catiadesign.org, catiahelp.azurewebsites.net) es de terceros: el original de Dassault no se pudo abrir.

## Lo que CONFIRMA lo que hace el sistema

- **Manejar CATIA por COM desde Python es el camino que usa todo el mundo.** pycatia, los cuatro MCP que aparecieron y los hilos de foro apuntan a lo mismo (tabla, filas 1 a 6). Que `catia_medir.py` use `SystemService.Evaluate` coincide con lo que hace pycatia para el objeto de medición: según su README, con pywin32 solo algunos métodos de medición no andan, y por eso los corre por ese camino (https://github.com/Mithro86/pycatia-development, solo búsqueda).
- **Manejar la pantalla no sirve.** CADWorld mide 25 % de éxito para el mejor agente que mira y clickea. Va a favor de API y código, como hace el sistema (solo búsqueda).
- **Los controles automáticos del sistema son la idea correcta.** AstroQuest hace parecido: valida antes de ejecutar, reporta cuánto cambió el volumen en cada operación y guarda un libro de trampas. AADvark dice que un verificador fuerte con errores claros importa tanto como el agente (abierta). La revisión ciega y los gates de la skill van en esa línea.
- **Reusar lo hecho y probado tiene respaldo oficial.** CATIA trae para eso Power Copy, UDF y catálogos, y se instancian por macro (filas 8 y 9). Es el equivalente al problema de la palanca dibujada de cero.

## Lo que lo CONTRADICE o le pone en duda

- **Ningún proyecto abierto toca Knowledgeware desde una IA.** AstroQuest lo declara hueco: fórmulas y tablas de diseño no están. No hay MCP que cree PowerCopy, UDF, checks ni catálogos (no apareció ninguno). Que pycatia tenga las llamadas no prueba que una IA las use bien: no hay evidencia (sin fuente). Sería terreno propio.
- **Mecanismos: lo que hay es débil.** La doc oficial del espejo es de 2001 y muestra crear mecanismo, juntas y comandos, pero no correr la simulación ni leer posiciones. Los MCP no incluyen cinemática. AADvark dice que ni los sistemas de agentes de 2026 arman piezas móviles sin un solver especial. Y el sistema ya baja a segundos la simulación con manifold3d: DMU Kinematics por programa compite contra algo que ya funciona (opinión).
- **Hay una trampa de licencias.** Reglas y checks necesitan Knowledge Advisor (KWA), y la cinemática es el producto KIN, aparte. No hay fuente de qué licencias tiene la PC de Fak: hay que mirarlo antes de gastar un día en estudiar algo que no puede ejecutar.
- **Los cursos de «Automation» apuntan a otra persona.** Son 3 a 4 días de VBA/CATScript para quien escribe macros. Acá las escribe la IA. Lo que Fak necesita para supervisar es leer el árbol y entender parámetros, no programar (opinión).
- **Los libros están viejos.** Ross (2015) y Ziethen (2013) son de la época R19–R21; un usuario del foro dice que el de Ross es muy básico. Sirven para entender el modelo de objetos, no como receta actual.
- **Futuro de V5, dos versiones.** ohmycad (17 días atrás): V5 sigue con una release por año. acecloudhosting (39 días): las novedades de IA solo van a 3DEXPERIENCE. SPK (competidor que vende Creo, ~2025, sin fecha clara) afirma que Dassault dejó de actualizar V5, y la existencia de V5-6R2026 lo desmiente. Conclusión: V5 vive, pero con IA solo la que le pongas vos.
- **pycatia es «alpha», con fecha de último commit sin verificar.** Se generó con la ayuda de R28 (2020); la propia doc advierte que las notas son «reference only». Hay que probar cada llamada en la versión de Fak (R21 sin verificar, según la investigación del 17/10).

## Lo que no se les había ocurrido

1. **Un check de CATIA dentro del archivo + su informe XML.** `Relations.CreateCheck` y `GenerateXMLReportForChecks` dejan un chequeo (pared mínima, holgura, un valor máximo) viviendo en el `.CATPart`; el XML lo lee el script. Duplica los gates de Python pero viaja con la pieza (necesita KWA).
2. **Corrección sin rehacer: tabla de diseño escrita por Python.** `CreateDesignTable` toma un xls/txt. La IA edita una fila y CATIA regenera la pieza, en vez de reconstruir todo. Ataca directo «rehacía el modelo entero en cada corrección» (opinión; probar con una pieza).
3. **Catálogo de piezas probadas.** `create_catalog_from_csv` arma un catálogo desde un CSV. Podría guardar palancas, bujes y bases ya validados para que la IA elija en vez de dibujar (opinión; no vi un caso real de uso).
4. **Copiar las defensas de AstroQuest sin instalarlo:** vigilante de ventanas emergentes (un diálogo congela todas las llamadas), cambio de volumen por operación, limpieza de lo que dejó una llamada fallida, y «designar por puntos 3D, no por nombres». Además avisa que designar dos aristas en una pieza densa tarda 20–30 s.
5. **Del paper de AADvark:** darle al agente errores informativos y marcas únicas por cara/arista, no solo imágenes. Y el costo de referencia de una pieza móvil sencilla: ~USD 16 y 4 horas para una tijera.
6. **Configurar CATIA como pide pycatia:** caché CGR apagado y nombres de parámetros sin comilla invertida (README). Es un detalle que rompe cosas sin avisar.

## Qué se buscó y no se encontró

- Precio y duración de cursos de 3DS Academy / Companion de uso individual: solo apareció el catálogo (8 h de Knowledgeware, sin precio).
- Fecha del último commit de pycatia y fecha de la 0.10.1.
- Un ejemplo que **corra** una simulación DMU Kinematics por COM y lea resultados (solo crear mecanismo).
- Cursos en castellano o dictados en Argentina (no se buscó específicamente; sin fuente).
- Alguna declaración oficial de Dassault sobre el fin de V5.
- Un caso de IA creando UDF/PowerCopy/design tables por COM.

## Veredicto para este frente (2-4 frases; seguridad media)

No mandaría a Fak a un curso de VBA: la IA ya escribe COM, y la fuente de verdad (los hilos, los libros, la ayuda `V5Automation.chm`) es lo que ella necesita leer, no él. Lo de mayor rendimiento para utillajes es **Knowledgeware**: parámetros, tablas de diseño, Power Copy/UDF y catálogos, porque atacan la corrección sin rehacer y la palanca dibujada de cero; el curso oficial es de 8 h (GoEngineer online: USD 995, 4 medias jornadas) y lo mejor es probar primero una sola pieza con una tabla de diseño escrita por Python. Dejaría DMU Kinematics por programa para después (la evidencia es de 2001 y manifold3d ya resuelve el movimiento). Seguridad media y no alta: nadie demostró que una IA maneje Knowledgeware por COM, no sé qué licencias (KWA, KIN) tiene la PC, y pycatia es alpha con commits sin verificar.