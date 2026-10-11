# HOY-18 · GitHub, segunda pasada: qué conviene incorporar según la forma de trabajar de Fak (10/10/2026)

Pedido de Fak, 10/10/2026 19:05: *"investigá en GitHub cosas que nos vendría bien incorporar... hay muchos repos
públicos con herramientas muy útiles; pensá en base a la forma que tengo de laburar si podríamos incorporar alguno o
parte de alguno"*. Encargo E261010-6b8e, fila HOY-18 de `docs/COLA_CAMBIOS_CODIGO.md`. Este documento **no instala ni
cambia nada**: junta candidatos, decide cada uno con su evidencia y deja una fila en la cola por cada aprobado.

La primera pasada fue el informe R8 del 08/10 (`.sgc-cache/investigacion-2026-10-08/R8_como_lo_resuelven_otros.md`),
que miró las herramientas del asistente en abstracto. Esta mira los frentes de trabajo reales: mails, el arb, AMFE y
plan de control, 3D y CATIA, patrones de corte, PowerPoint, Excel y PDF, flujogramas, tiempos por video, lectura de
planos y el sistema del asistente. Ningún candidato de R8 se repite.

## 1. En una pantalla

- **63 candidatos evaluados: 6 aprobados y 57 descartados.** Otros 24 que los buscadores nombraron se cayeron antes de
  evaluarlos; están listados en la sección 7 con el motivo.
- **De los 6 aprobados, ninguno es una herramienta para instalar tal cual.** Cinco son un método o una lista que se
  arma con piezas que el repo ya tiene (van a «Hacer ya») y uno es una librería nueva (va a «Proponer a Fak»).
- **Lo más útil que salió** son tres comparadores: de dos Excel (la tabla «celda, antes, después» que Fak pide cuando
  se corrige el archivo de otro), de dos PDF y de dos revisiones de una pieza 3D. De los tres ya hay una pieza a medio
  camino en el repo; lo que aporta GitHub es el método completo.
- **El resultado de fondo es que lo propio ya cubre casi todo.** La mayoría de los 57 descartes es «ya lo hace un
  script nuestro», con el nombre al lado: el arb, los renders, los flujogramas, la tabla de Prioridad de Acción, el
  control de texto que no entra en su caja y los controles del asistente.
- **Tres aprobados de la evaluación automática se cayeron al verificarlos**: un índice de búsqueda de mails (una
  búsqueda tarda 0,69 segundos), una referencia para Outlook (ya es código nuestro) y un medidor de texto en
  PowerPoint (el gate de hojas ya lo hace desde el 03/09). Se dice acá porque muestra el límite del método: la
  evaluación solo sabe lo que se le cuenta de lo nuestro.
- **Lo que se buscó y no existe en GitHub** también es un resultado (sección 6).

## 2. Cómo se hizo

| Paso | Qué | Dato |
|---|---|---|
| Búsqueda | 9 agentes `buscador` (Haiku), uno por frente, en paralelo; solo búsqueda web y lectura de páginas | 9 puntos del presupuesto de 40; 88 repos nombrados |
| Datos de cada repo | Los buscadores casi nunca pudieron leer la fecha del último commit. Se leyeron después, repo por repo, de la página pública de cada uno: estrellas, licencia, último commit y si redirige | `verificar_repos.mjs`; 64 de 65 leídos el 10/10/2026 a la noche; 1 da error 404 |
| Lo nuestro | Lista de scripts, skills y librerías instaladas, con lo que hace cada pieza relevante | `lo_nuestro.md` (tenía un error: decía que no había medición de texto en caja) |
| Evaluación | Por la API (Opus 5.5, esfuerzo medio): cada candidato contra lo nuestro, con las reglas de la casa | US$ 0,37; `evaluacion_api.md`; aprobó 9 |
| Verificación propia | Formato del caché de mails, cómo lee `_arbUI.py` la grilla, reglas del validador de AMFE, tiempo real de una búsqueda de mails, y el README de los aprobados | carpeta `readmes/` (8 README; el de pycatia no se bajó) |
| Auditor | Agente `auditor` (Opus) sobre el documento: releyó 25 repos, abrió los README y buscó en el repo lo que el documento decía que no existía | `.sgc-cache/auditorias/AUDITOR_HOY18_2026-10-10.md`; 7 errores reales, todos corregidos acá |

Todo el material de trabajo está en `.sgc-cache/investigacion-2026-10-11/` (no se versiona). **No se instaló, no se
clonó y no se ejecutó nada bajado.** De cada repo se leyó la página pública y, de los aprobados, el README.

La evaluación automática aprobó 9. Después de verificar quedan 6: dos se descartaron porque ya eran código nuestro
(`lihaokun/outlook-mcp` y `heroak2008/ppt-linter`), uno porque la medición lo desmiente (`JNevrly/pstq`), y uno que
la API había descartado y acá se había aprobado se volvió a descartar (`evereux/pycatia`: HOY-20 ya manejó CATIA sin
esa librería).

Dos candidatos quedaron fuera de la evaluación: `TeamMsgExtractor/msg-extractor` es la librería `extract-msg` que ya
usamos, y `sjnims/cc-plugin-eval` da error 404.

## 3. Los aprobados

Tamaño según `codigo-madre.md`. «HY» es Hacer ya; «PF» es Proponer a Fak.

| Fila | De dónde sale | Qué entra | De qué pieza nuestra parte y a dónde va | Tamaño | Cómo se prueba que sirvió | Va en |
|---|---|---|---|---|---|---|
| HOY-18a | [rad03i2/excel-diff](https://github.com/rad03i2/excel-diff) (MIT) | El método: comparar dos Excel hoja por hoja y celda por celda, valor y fórmula, con hojas agregadas o quitadas, y códigos de salida | Parte de `verificar()` de `scripts/_xlsxCorregirTexto.py`, que ya compara dos libros. Va a un programa nuevo `scripts/_xlsxComparar.py` con su tabla «hoja, celda, antes, después» | chico | Copiar un Excel real y cambiarle tres cosas (un valor, una fórmula, una celda de otra hoja): tienen que salir exactamente tres filas | HY |
| HOY-18b | [JustusRijke/DiffPDF](https://github.com/JustusRijke/DiffPDF) (MIT) | Las cuatro etapas en orden (hash, cantidad de páginas, texto, imagen con umbral) y la imagen que marca la diferencia | Parte de `tools/flowchart/propuestas/C_columnas/comparar_pdf_png.py`, que ya rasteriza y mide con umbral. Va a un programa nuevo `scripts/_pdfComparar.py`, con PyMuPDF y numpy | chico | El mismo PDF dos veces corta en la primera etapa. El PDF de una hoja antes y después de cambiar un texto marca solo esa zona | HY |
| HOY-18c | [mikelmyers/argus-diff](https://github.com/mikelmyers/argus-diff) (MIT) | La lista de qué comparar entre dos revisiones de una pieza (volumen, masa, caja, interferencia, huella de cada cuerpo) y la forma del informe | Ya estaba en el ROADMAP de `cad-design` desde el 29/08, como herramienta a instalar. Se arma con `register_icp.py`, `check_collision.py` y `foto3d.py`. Va a `scripts/_compararRevision3d.py` | mediano | Un STEP contra sí mismo da todo cero. Dos revisiones reales de una pieza de cliente: el informe señala la zona que el cliente dijo cambiar | HY |
| HOY-18d | [simonw/claude-code-transcripts](https://github.com/simonw/claude-code-transcripts) (Apache-2.0: solo la idea) | Una página con la línea de tiempo de una sesión: qué pidió Fak, qué archivos se tocaron, qué commits salieron | Parte de `relevarTranscript()` (`scripts/_lib/cierreGuard.mjs`), `scripts/_lib/archivosSesion.mjs` y `scripts/_lib/transcriptsFak.mjs`. Va a `scripts/_resumenSesion.mjs` | mediano | Sobre la sesión de ayer, la lista de archivos de la página coincide con `git log` de ese día | HY |
| HOY-18e | [migmcc/quality-docs-validator](https://github.com/migmcc/quality-docs-validator) (MIT) | Sus seis chequeos entre AMFE y plan de control, como casos de prueba | `docs/PLAN_P6_PLANES_DE_CONTROL_2026-10-10.md`, gate 8 | chico | Cada chequeo, contra un AMFE y un plan de control reales de una pieza: se anota cuál encuentra algo que hoy nadie revisa | HY |
| HOY-18f | [xavctn/img2table](https://github.com/xavctn/img2table) (MIT) | La librería: detecta tablas con o sin líneas y reparte el texto del OCR en celdas | `scripts/_leerPlano.py`, después de recortar la lista de materiales | mediano | Un plano cuya lista de materiales salió corrida: cada fila coincide con la lectura a mano | PF |

Además sale una fila que **no viene de GitHub**, sino del auditor al revisar este documento:

| Fila | Qué | Dónde | Tamaño | Va en |
|---|---|---|---|---|
| HOY-18g | El chequeo de «un texto no entra en su caja» del gate de hojas tiene tres huecos, según el auditor: mide todos los textos como Calibri, supone 11 puntos cuando el tamaño no está escrito, y no entra a las tablas ni a los grupos. Hay que confirmarlos con una hoja real antes de tocar | `.claude/skills/hojas-de-proceso/scripts/hoja_proceso_check.py` (`texto_no_entra`) y `hojalib.py` | mediano | HY |

**Riesgos que quedan, por fila:**

- **HOY-18a**: si alguien insertó una fila, todo lo de abajo figura como cambiado. No ve cambios de formato ni de
  imágenes. openpyxl lee la fórmula o el valor calculado, no los dos juntos: el archivo se abre dos veces.
- **HOY-18b**: el umbral se ajusta para que el suavizado de los bordes no dé ruido. Con páginas de distinto tamaño se
  informa «distinto» sin comparar la imagen.
- **HOY-18c**: si el cliente movió el origen de la pieza, la alineación puede salir mal y la diferencia ser falsa.
  Son 7 pedidos de 3D por mes: alcanza el informe básico.
- **HOY-18d**: el formato de los registros puede cambiar con una actualización del asistente. El resumen es mecánico,
  no un relato, y no sale de la PC.
- **HOY-18e**: con 0 estrellas, cada chequeo se valida contra el criterio de la casa antes de entrar.
- **HOY-18f**: no es una dependencia chica. Pide `opencv-contrib-python`, que ocupa el lugar del `opencv-python` que
  usan otros scripts, y el paquete `rapidocr`, distinto del `rapidocr-onnxruntime` instalado. Si Fak la quiere, se
  prueba en un entorno aparte. La alternativa sin dependencia es escribir la detección de líneas con el OpenCV que ya
  está, que solo sirve para tablas con líneas.

## 4. Los seis chequeos entre AMFE y plan de control (para el gate 8 de P6)

Tomados del README de `migmcc/quality-docs-validator` y de su `docs/FINDINGS.md`, leídos el 10/10/2026. Son la lista
de partida; el criterio de cada uno lo fija la casa.

| Chequeo del repo | Qué mira | Nivel que le da |
|---|---|---|
| `UNMATCHED_PROCESS_STEP` | Una operación que está en uno solo de los dos documentos. Va en los dos sentidos | aviso |
| `MISSING_CONTROL` | Una fila del plan de control sin método de control | crítico |
| `SPECIAL_CHARACTERISTIC_NOT_CONTROLLED` | Una característica especial del AMFE que el plan de control no marca como especial | crítico |
| `MISSING_REACTION_PLAN` | Severidad alta (el repo usa S de 8 para arriba) sin plan de reacción | crítico |
| `WEAK_DETECTION_METHOD` | El control de detección es una inspección visual | aviso |
| `HIGH_SEVERITY_WEAK_CONTROL` | Severidad alta con un control débil | aviso |

El repo aclara que sus hallazgos son «potenciales», para que los juzgue un ingeniero, y que no certifica conformidad
con ninguna norma. Su corte de «severidad alta» en 8 es de ese repo: en la casa la crítica es S 9 o 10. No trae el
chequeo que pidió Fak el 10/10 a las 18:58 (que los controles de detección del AMFE y los del plan de control sean
los mismos): ese ya está en el diseño del gate 8.

## 5. Todos los candidatos evaluados, con su veredicto

Estrellas, último commit y licencia: leídos de la página de cada repo el 10/10/2026 a la noche. La licencia es la que
GitHub reconoce por el archivo de licencia del repo: «propia o sin clasificar» quiere decir que no la reconoce como
una estándar, y «sin licencia visible», que no hay archivo (el README puede decir otra cosa). «Qué hace» y «Contra»
salen de lo que informó el agente que lo buscó; solo en los aprobados se cotejó contra el README.

### Mails (Outlook por COM)

| N.º | Repo | Estrellas | Último commit | Licencia | Windows | Qué hace | Veredicto y evidencia |
|---|---|---|---|---|---|---|---|
| 1 | [Aanerud/outlook-desktop-mcp](https://github.com/Aanerud/outlook-desktop-mcp) | 69 | 15/05/2026 | AGPL-3.0 | sí | Servidor MCP que maneja el Outlook clásico por COM: mail, calendario, tareas, adjuntos. Contra: AGPL-3.0. Trae un cambio de registro opcional que apaga el aviso de acceso por programa: es tocar seguridad y pide administrador | **DESCARTADO.** Licencia AGPL-3.0 y trae un cambio de registro que apaga un aviso de seguridad y pide administrador. Calendario y tareas ya están en la cola (HOY-19c). |
| 2 | [lihaokun/outlook-mcp](https://github.com/lihaokun/outlook-mcp) | 1 | 09/03/2026 | MIT | sí | Servidor MCP por win32com: lectura, contactos, calendario. Contra: Proyecto de 7 commits y 1 estrella | **DESCARTADO.** No trae nada que no esté. Identificar el mail por `EntryID` y redactar con `.Display()` ya son código nuestro (`scripts/_mails.py`, `_prepararMail.py`), y el filtro del lado de Outlook ya se midió en HOY-19, que lo tiene en la cola como HOY-19a. La API lo había aprobado; el auditor mostró que no suma. |
| 3 | [r-rohit/outlook-mcp-readonly](https://github.com/r-rohit/outlook-mcp-readonly) | 0 | 12/07/2026 | MIT | sí | Lectura de buzón y calendario por COM, sin ninguna herramienta que escriba. Contra: 2 commits, 0 estrellas | **DESCARTADO.** `scripts/_mails.py` ya es de solo lectura por construcción. |

### Mails (caché y búsqueda)

| N.º | Repo | Estrellas | Último commit | Licencia | Windows | Qué hace | Veredicto y evidencia |
|---|---|---|---|---|---|---|---|
| 4 | [JNevrly/pstq](https://github.com/JNevrly/pstq) | 0 | 03/09/2026 | MIT | sin verificar | Busca en un PST sin conexión: lo abre en solo lectura con pypff y arma un caché SQLite con índice de texto completo (FTS5) que se puede tirar y rehacer. Contra: 0 estrellas; no dice Windows | **DESCARTADO.** Medido el 10/10: `python scripts/_mails.py --buscar aplix --solo-fak` tarda 0,69 s sobre los 5.970 mails de `.mail-cache/mails.jsonl` (23,6 MB). La búsqueda por defecto, que además mira la nube del equipo, tardó 5,3 s y 1,8 s en dos corridas del auditor: ahí el tiempo se va en leer la nube, no en buscar. Un índice de texto completo no resuelve nada hoy. La API lo había aprobado sin esos datos. |

### arb (leer la ventana)

| N.º | Repo | Estrellas | Último commit | Licencia | Windows | Qué hace | Veredicto y evidencia |
|---|---|---|---|---|---|---|---|
| 5 | [pywinauto/pywinauto](https://github.com/pywinauto/pywinauto) | 6.206 | 23/05/2026 | BSD-3-Clause | sí | Automatización de ventanas de Windows desde Python: motor win32 para controles viejos (MFC, VB6, Delphi) y motor UIA. Contra: Dependencia nueva (usa pywin32 y comtypes). Hay que probar si el arb expone sus controles | **DESCARTADO.** `scripts/_arbUI.py` ya lee los controles Win32 del arb en segundo plano con WM_GETTEXT y arma la grilla agrupando por fila y columna (línea 95), sin robar el foco. Ya figuraba «para probar» en una nota del 30/09; con `_arbUI.py` no hizo falta. |
| 6 | [yinkaisheng/Python-UIAutomation-for-Windows](https://github.com/yinkaisheng/Python-UIAutomation-for-Windows) | 3.585 | 02/06/2026 | Apache-2.0 | sí | Envoltorio Python de UI Automation, con un inspector del árbol de controles. Contra: Dependencia nueva (comtypes). El README recomienda administrador | **DESCARTADO.** Lo cubre `scripts/_arbUI.py`, y su README recomienda permisos de administrador. |
| 7 | [FlaUI/FlaUI](https://github.com/FlaUI/FlaUI) | 3.170 | 13/08/2026 | MIT | sí | Librería de automatización de interfaces para .NET. Contra: Es C#: otro lenguaje | **DESCARTADO.** Es C#: otro lenguaje para algo que ya resuelve `_arbUI.py`. |
| 8 | [dangrazh/bromium](https://github.com/dangrazh/bromium) | 0 | 09/10/2026 | Apache-2.0 | sí | UI Automation para Python con núcleo en Rust y localizadores tipo XPath. Contra: 0 estrellas, proyecto nuevo | **DESCARTADO.** 0 estrellas y nada que no cubra `_arbUI.py`. |

### arb (leer los archivos Btrieve)

| N.º | Repo | Estrellas | Último commit | Licencia | Windows | Qué hace | Veredicto y evidencia |
|---|---|---|---|---|---|---|---|
| 9 | [mbbsemu/MBBSEmu](https://github.com/mbbsemu/MBBSEmu) | 153 | 09/10/2026 | MIT | sí | Emulador de un sistema viejo que trae un módulo que lee archivos Btrieve .DAT y los pasa a SQLite. Contra: Es C#, no trae soporte de diccionario DDF ni dice qué versiones de Btrieve lee | **DESCARTADO.** No leemos los archivos Btrieve: los datos salen del export de texto (`scripts/_refreshArb.mjs`). Queda como referencia si algún día hiciera falta. |

### AMFE y plan de control

| N.º | Repo | Estrellas | Último commit | Licencia | Windows | Qué hace | Veredicto y evidencia |
|---|---|---|---|---|---|---|---|
| 10 | [Open-Industry-System/OpenQMS](https://github.com/Open-Industry-System/OpenQMS) | 8 | 21/09/2026 | MIT | no aplica | Plataforma de gestión de calidad IATF 16949 con módulos de FMEA, 8D, SPC, MSA y APQP/PPAP. Contra: 8 estrellas. Su FMEA dice calcular RPN y AP; no se verificó cuál manda | **DESCARTADO.** Es una plataforma entera. El plan de control lo hace Calidad, y el cruce con el AMFE ya está diseñado como gate 8 en `docs/PLAN_P6_PLANES_DE_CONTROL_2026-10-10.md`. |
| 11 | [migmcc/quality-docs-validator](https://github.com/migmcc/quality-docs-validator) | 0 | 21/06/2026 | MIT | sin verificar | Programa de línea de comandos que valida la coherencia entre un AMFE de proceso y su plan de control leyendo los Excel. Contra: 0 estrellas, 12 commits | **APROBADO.** HOY-18e. Su README lista seis chequeos explícitos entre AMFE de proceso y plan de control (sección 4). Entran como casos de prueba del gate 8 de P6; no tenemos ningún validador de ese cruce. No se toma su programa. |
| 12 | [PerryLink/dsh-fmea-table-check](https://github.com/PerryLink/dsh-fmea-table-check) | 0 | 09/10/2026 | propia o sin clasificar | no aplica | Verifica completitud y consistencia de una tabla FMEA con 8 reglas (FM-001 a FM-008), en TypeScript con tests. Contra: 0 estrellas; usa RPN por defecto; el propio README dice que sus citas de norma no están verificadas; documentación en chino | **DESCARTADO.** Usa RPN, su README dice que sus citas de norma no están verificadas, y `scripts/_lib/amfeValidator.mjs` ya cubre completitud y textos de relleno (`FN_GENERIC_PLACEHOLDER`, `WE_GENERIC_PLACEHOLDER`, `CAUSE_MISSING_SOD`). La regla «acción con dueño y fecha» choca con la de la casa: un AP alto no obliga a definir una acción. |
| 13 | [Siddardth7/fmea-risk-analyzer](https://github.com/Siddardth7/fmea-risk-analyzer) | 3 | 14/06/2026 | MIT | no aplica | Calcula RPN y un AP simplificado. Contra: AP mal calculado | **DESCARTADO.** Su Prioridad de Acción es un atajo (RPN ≥ 200 o S ≥ 9), no la tabla oficial, que ya está en `modules/amfe/apTable.ts` con tests. Su README dice que el proyecto se mudó y quedó como archivo histórico. |

### 3D y CATIA

| N.º | Repo | Estrellas | Último commit | Licencia | Windows | Qué hace | Veredicto y evidencia |
|---|---|---|---|---|---|---|---|
| 14 | [evereux/pycatia](https://github.com/evereux/pycatia) | 375 | 05/09/2026 | MIT | sí | Módulo Python para automatizar CATIA V5 por COM: abrir CATPart y CATProduct, exportar, medir, leer el árbol y los parámetros. Contra: Dependencia nueva; se declara en etapa alfa | **DESCARTADO.** HOY-20 ya manejó CATIA V5 por programa con `pywin32` directo, sin esta librería (pieza, exportar a STEP, medir, ensamble). Sumarla sería una dependencia nueva, en etapa alfa, para algo que ya anda. Queda como referencia de los nombres de las llamadas. |
| 15 | [evereux/pycatia-tools](https://github.com/evereux/pycatia-tools) | 20 | 09/12/2025 | MIT | sí | Interfaz web sobre pycatia: exporta puntos y planos. Contra: Sin commits desde 12/2025 | **DESCARTADO.** Son ejemplos de pycatia, sin commits desde 12/2025. |
| 16 | [daiemon12/catia-v5-mcp-server](https://github.com/daiemon12/catia-v5-mcp-server) | 114 | 10/10/2026 | MIT | sí | Servidor MCP con 98 herramientas sobre CATIA V5 por COM, 6 de medición y capturas. Contra: Muchas herramientas escriben en el modelo; necesita CATIA con licencia | **DESCARTADO.** También maneja CATIA con `win32com` directo, como ya hizo HOY-20. Muchas de sus 98 herramientas escriben en el modelo. Sirve como lista de qué se puede llamar. |
| 17 | [f3d-app/f3d](https://github.com/f3d-app/f3d) | 4.753 | 09/10/2026 | BSD-3-Clause | sin verificar | Visor 3D rápido de línea de comandos: lee STEP, STL, glTF y saca una imagen con --output. Contra: Es un ejecutable de tercero que hay que instalar; el modo sin ventana en Windows no está verificado. Ya tenemos scripts/render3d y foto3d.py | **DESCARTADO.** `foto3d.py`, `render_step.py` y `scripts/render3d/capturarModelo3d.cjs` ya sacan la foto de un 3D, con el criterio de fondo blanco de la casa. |
| 18 | [yeicor-3d/yet-another-cad-viewer](https://github.com/yeicor-3d/yet-another-cad-viewer) | 142 | 04/10/2026 | MIT | sin verificar | Visor web de modelos de CadQuery y build123d. Contra: Otra herramienta para lo que ya hace el skill cad-design | **DESCARTADO.** Es un visor para mirar; el skill `cad-design` ya cubre el trabajo. |
| 19 | [mikelmyers/argus-diff](https://github.com/mikelmyers/argus-diff) | 1 | 14/07/2026 | MIT | sin verificar | Compara dos versiones de un STEP, STL o 3MF: diferencia de masa, volumen, caja, interferencias y desviación máxima, con render antes y después. Contra: 1 estrella y 30 commits; se declara en etapa alfa | **APROBADO.** HOY-18c. Su README confirma qué compara entre dos revisiones: volumen, masa, caja, interferencia entre sólidos y una huella por cuerpo (área, centro de masa, momentos de inercia). **No es nuevo como idea: está anotado en el ROADMAP del skill `cad-design` desde el 29/08**, como herramienta a instalar. Acá se confirma y se cambia el plan: no instalarla, tomar la lista y armar el informe con lo que ya hay (`register_icp.py` alinea, `check_collision.py` mide interferencia). |
| 20 | [mattmohandiss/cad-mcp-server](https://github.com/mattmohandiss/cad-mcp-server) | 5 | 05/10/2026 | MIT | sí | Servidor MCP para inspeccionar un STEP: buscar entidades, medir y comparar revisiones. Contra: 5 estrellas, pide Node 24 | **DESCARTADO.** `cadlib` ya mide e inspecciona un STEP; pide Node 24. |
| 21 | [shaise/FreeCAD_SheetMetal](https://github.com/shaise/FreeCAD_SheetMetal) | 347 | 30/09/2026 | LGPL-2.1 | sin verificar | Módulo de chapa para FreeCAD con desarrollo de piezas plegadas. Contra: Depende de FreeCAD | **DESCARTADO.** Aplana chapa, no un tapizado, y depende de FreeCAD. |

### Patrones de corte

| N.º | Repo | Estrellas | Último commit | Licencia | Windows | Qué hace | Veredicto y evidencia |
|---|---|---|---|---|---|---|---|
| 22 | [JeroenGar/sparrow](https://github.com/JeroenGar/sparrow) | 388 | 09/10/2026 | MIT | sin verificar | Motor de anidado de piezas irregulares en una tira de ancho fijo (el problema de la tizada). Contra: Está en Rust y hay que compilarlo; Windows sin verificar; entrada en SVG o JSON, no DXF; rotación restringida por el sentido del pelo sin verificar | **DESCARTADO.** El consumo de un material de corte sale de la planilla oficial o del mail de Mesa de Corte (`consumos-entregables.md` §6), y `scripts/_tizadaVsArb.py` ya cruza la tizada real con el arb. Además está en Rust, hay que compilarlo y no lee DXF. |
| 23 | [JeroenGar/spyrrow](https://github.com/JeroenGar/spyrrow) | 0 | 20/10/2025 | MIT | sin verificar | Envoltorio Python de sparrow, por PyPI. Contra: Sin commits desde 10/2025; ruedas precompiladas para Windows sin verificar | **DESCARTADO.** Envoltorio del anterior; sin commits desde 10/2025. |
| 24 | [jack000/SVGnest](https://github.com/jack000/SVGnest) | 2.609 | 11/04/2019 | MIT | sí | Anidado en el navegador. Contra: Sin commits desde 2019 | **DESCARTADO.** Sin commits desde 2019. |
| 25 | [Jack000/Deepnest](https://github.com/Jack000/Deepnest) | 1.171 | 26/08/2018 | sin licencia visible | sin verificar | Aplicación de anidado para láser. Contra: Sin commits desde 2018, sin licencia visible | **DESCARTADO.** Sin commits desde 2018 y sin licencia visible. |
| 26 | [cyprienh/chiplotle3](https://github.com/cyprienh/chiplotle3) | 14 | 10/03/2025 | GPL-3.0 | sí | Librería Python para mandar HPGL a un plotter por puerto serie. Contra: GPL-3.0 | **DESCARTADO.** GPL-3.0 y el plotter corta desde su propio programa. |
| 27 | [fashionfreedom/seamly2d](https://github.com/fashionfreedom/seamly2d) | 986 | 10/10/2026 | GPL-3.0 | sí | Programa libre de patronaje con tablas de talles. Contra: GPL-3.0, aplicación de escritorio | **DESCARTADO.** GPL-3.0; los patrones llegan hechos del cliente. |

### PowerPoint, Excel y PDF

| N.º | Repo | Estrellas | Último commit | Licencia | Windows | Qué hace | Veredicto y evidencia |
|---|---|---|---|---|---|---|---|
| 28 | [heroak2008/ppt-linter](https://github.com/heroak2008/ppt-linter) | 0 | 17/09/2026 | sin licencia visible | sí | Revisa un pptx antes de entregarlo: texto desbordado, fuera de página, solapes, marcadores sin reemplazar. Contra: Sin licencia. 2 commits | **DESCARTADO.** Ya lo tenemos: el gate `hoja_proceso_check.py` mide desde el 03/09 si un texto entra en su caja sin abrir PowerPoint (chequeo 4, `texto_no_entra`, con el ancho real de la fuente en `hojalib.ancho_cm`). El repo además no tiene licencia. El auditor encontró tres huecos en nuestro chequeo, que van a la cola como HOY-18g: no salen de este repo. |
| 29 | [sqmyou/sheetdelta](https://github.com/sqmyou/sheetdelta) | 1 | 07/10/2026 | MIT | sin verificar | Compara dos xlsx celda por celda (valores y fórmulas) sin Excel y sin dependencias. Contra: 1 estrella, muy nuevo | **DESCARTADO.** Hace lo mismo que el n.º 30, que usa openpyxl, ya instalada. Su lectura directa del XML queda como plan B. |
| 30 | [rad03i2/excel-diff](https://github.com/rad03i2/excel-diff) | 0 | 23/09/2026 | MIT | sí | Compara dos xlsx por hoja y por celda con openpyxl; códigos de salida y salida en texto o JSON. Contra: 0 estrellas | **APROBADO.** HOY-18a. Su README confirma el método: hoja por hoja y celda por celda, hojas agregadas o quitadas, valor o fórmula, y códigos de salida 0, 1 y 2. Fak pide la tabla «cada celda con su ANTES» cuando se corrige el archivo de otro. **La base ya existe**: `verificar()` de `scripts/_xlsxCorregirTexto.py` abre dos libros y compara todas las celdas; falta sacarla como programa propio con su tabla de salida. |
| 31 | [JustusRijke/DiffPDF](https://github.com/JustusRijke/DiffPDF) | 3 | 19/08/2026 | MIT | sí | Compara dos PDF por etapas: hash, cantidad de páginas, texto y después imagen con umbral; guarda la imagen de las diferencias. Contra: 3 estrellas; suma la librería pixelmatch-fast | **APROBADO.** HOY-18b. Su README confirma las cuatro etapas en orden: hash, cantidad de páginas, texto e imagen con umbral, cada una solo si pasó la anterior. **La base ya existe** para un caso: `tools/flowchart/propuestas/C_columnas/comparar_pdf_png.py` rasteriza con PyMuPDF y mide la diferencia con umbral. Falta un programa general para cualquier par de PDF, con esas etapas. |
| 32 | [vslavik/diff-pdf](https://github.com/vslavik/diff-pdf) | 4.325 | 28/03/2026 | GPL-2.0 | sí | Compara dos PDF visualmente. Contra: GPL-2.0, hay que compilarlo en Windows | **DESCARTADO.** GPL-2.0 y hay que compilarlo; lo cubre el n.º 31. |
| 33 | [mikewstone23/pptxtpl](https://github.com/mikewstone23/pptxtpl) | 0 | 08/07/2026 | MIT | sin verificar | Plantillas con marcadores Jinja para pptx. Contra: 0 estrellas | **DESCARTADO.** Las hojas se arman con `scripts/img/generar_hojas_img.py` y `hojalib` sobre el formulario oficial. |
| 34 | [iOfficeAI/OfficeCLI](https://github.com/iOfficeAI/OfficeCLI) | 31.813 | 09/10/2026 | Apache-2.0 | sí | Un ejecutable que lee, edita y valida docx, xlsx y pptx contra el esquema, sin Office. Contra: Ejecutable de tercero; telemetría sin verificar; un repo hermano ofrece una prueba en línea que manda el documento afuera | **DESCARTADO.** Es un ejecutable de tercero con telemetría sin verificar. Las hojas ya pasan por el gate `hoja_proceso_check.py` y se juzgan impresas. |
| 35 | [mikeebowen/OOXML-Validator](https://github.com/mikeebowen/OOXML-Validator) | 25 | 12/12/2024 | MIT | sin verificar | Valida docx, pptx y xlsx contra el esquema. Contra: Sin commits desde 12/2024, pide .NET | **DESCARTADO.** Sin commits desde 12/2024 y pide .NET. |

### Flujogramas

| N.º | Repo | Estrellas | Último commit | Licencia | Windows | Qué hace | Veredicto y evidencia |
|---|---|---|---|---|---|---|---|
| 36 | [kieler/elkjs](https://github.com/kieler/elkjs) | 2.811 | 06/10/2026 | propia o sin clasificar | sí (JavaScript) | Motor de acomodo automático de grafos por capas para JavaScript: calcula posiciones, no dibuja. Contra: Dependencia nueva de npm (paquete elkjs); nuestro generador tiene convenciones de dibujo validadas por Fak | **DESCARTADO.** `tools/flowchart/` tiene su propio acomodo con convenciones de dibujo que Fak validó. No hay evidencia de que no alcance. |
| 37 | [dagrejs/dagre](https://github.com/dagrejs/dagre) | 5.822 | 08/08/2026 | MIT | sí (JavaScript) | Acomodo jerárquico de grafos dirigidos. Contra: Menos control de cruces | **DESCARTADO.** Mismo motivo que el n.º 36. |
| 38 | [terrastruct/d2](https://github.com/d2lang/d2) (hoy `d2lang/d2`) | 25.596 | 02/10/2026 | MPL-2.0 | sin verificar | Lenguaje de texto a diagrama. Contra: Otro lenguaje (Go), licencia MPL-2.0 | **DESCARTADO.** No trae simbología de proceso y es otro lenguaje. |
| 39 | [hpcc-systems/hpcc-js-wasm](https://github.com/hpcc-systems/hpcc-js-wasm) | 392 | 01/10/2026 | Apache-2.0 | sí (JavaScript) | Graphviz compilado a WASM. Contra: Trae muchas librerías que no usamos | **DESCARTADO.** Mismo motivo que el n.º 36. |

### Balanceo y simulación

| N.º | Repo | Estrellas | Último commit | Licencia | Windows | Qué hace | Veredicto y evidencia |
|---|---|---|---|---|---|---|---|
| 40 | [FuchsTom/ProdSim](https://github.com/FuchsTom/ProdSim) | 40 | 29/12/2021 | MIT | sin verificar | Simulación de producción por eventos discretos sobre SimPy. Contra: Sin commits desde 12/2021 | **DESCARTADO.** Sin commits desde 12/2021; la app ya tiene simulador de flujo y balanceo. |
| 41 | [Nexedi/dream](https://github.com/Nexedi/dream) | 79 | 12/01/2022 | LGPL-3.0 | sin verificar | Bloques de manufactura sobre SimPy. Contra: Sin commits desde 01/2022, LGPL/GPL | **DESCARTADO.** Sin commits desde 01/2022. |

### Tiempos por video

| N.º | Repo | Estrellas | Último commit | Licencia | Windows | Qué hace | Veredicto y evidencia |
|---|---|---|---|---|---|---|---|
| 42 | [Breakthrough/PySceneDetect](https://github.com/Breakthrough/PySceneDetect) | 5.227 | 10/10/2026 | BSD-3-Clause | sí | Detecta cortes y cambios de escena en un video; tiene instalador para Windows. Contra: Dependencia nueva chica (usa OpenCV, que ya tenemos). Detecta cortes de cámara, no ciclos del operario | **DESCARTADO.** Detecta cortes de cámara, no los ciclos del operario. `scripts/_video.py` ya arma hojas de contacto. |
| 43 | [cvat-ai/cvat](https://github.com/cvat-ai/cvat) | 16.896 | 09/10/2026 | MIT | no | Plataforma web de anotación de video. Contra: Pide Docker y un servidor | **DESCARTADO.** Pide Docker y un servidor. |
| 44 | [google-ai-edge/mediapipe](https://github.com/google-ai-edge/mediapipe) | 37.215 | 10/10/2026 | Apache-2.0 | sin verificar | Detección de manos y de postura cuadro por cuadro, en CPU. Contra: Dependencia nueva que baja modelos; solo da puntos de la mano: la lógica de ciclos habría que escribirla | **DESCARTADO.** Es trabajo grande (la lógica de ciclos habría que escribirla) para 5 pedidos de video en 30 días. Se reconsidera si la toma de tiempos crece. |

### Leer planos y escaneos

| N.º | Repo | Estrellas | Último commit | Licencia | Windows | Qué hace | Veredicto y evidencia |
|---|---|---|---|---|---|---|---|
| 45 | [DS4SD/docling](https://github.com/docling-project/docling) (hoy `docling-project/docling`) | 68.647 | 10/10/2026 | MIT | sí | Convierte PDF e imágenes a un formato estructurado con tablas y OCR. Contra: Dependencias y modelos pesados; ya tenemos markitdown, rapidocr y PyMuPDF | **DESCARTADO.** Pesado; ya tenemos markitdown, rapidocr y PyMuPDF. |
| 46 | [xavctn/img2table](https://github.com/xavctn/img2table) | 899 | 10/05/2026 | MIT | sí | Detecta tablas en una imagen, con líneas o sin ellas, y reparte el texto del OCR en celdas. Contra: Pide `opencv-contrib-python`, que choca con el `opencv-python` instalado, y el paquete `rapidocr` | **APROBADO.** HOY-18f, para proponer. Detecta tablas con y sin líneas (`borderless_tables`) y reparte el texto del OCR en celdas; su README confirma que acepta RapidOCR. Ataca la lista de materiales de un plano que hoy sale corrida de columna. **No es una dependencia chica**: pide `opencv-contrib-python`, que ocupa el lugar del `opencv-python` instalado, y el paquete `rapidocr`, que no es el `rapidocr-onnxruntime` que tenemos. La decide Fak. |
| 47 | [opendatalab/MinerU](https://github.com/opendatalab/MinerU) | 81.415 | 08/10/2026 | propia o sin clasificar | sí | Convierte PDF e imagen a Markdown o JSON con tablas. Contra: Licencia propia con condiciones; tiene una opción que sube el documento | **DESCARTADO.** Licencia propia con condiciones y una opción que sube el documento. |
| 48 | [PaddlePaddle/PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR) | 90.895 | 16/09/2026 | Apache-2.0 | sí | OCR con análisis de estructura (PP-Structure): tablas con coordenadas de celdas, en CPU. Contra: Trae el framework Paddle, pesado; ya usamos rapidocr, que corre los mismos modelos de PaddleOCR en ONNX | **DESCARTADO.** `rapidocr`, que ya usamos, corre sus mismos modelos sin el framework Paddle. |
| 49 | [datalab-to/surya](https://github.com/datalab-to/surya) | 21.484 | 11/09/2026 | Apache-2.0 | sin verificar | OCR, layout y tablas en más de 90 idiomas. Contra: Los pesos tienen una licencia restrictiva; en CPU es lento | **DESCARTADO.** Los pesos tienen licencia restrictiva y sin placa de video es lento. |
| 50 | [libvips/pyvips](https://github.com/libvips/pyvips) | 813 | 30/08/2026 | MIT | sí | Procesa imágenes por tramos sin cargarlas enteras en memoria. Contra: Dependencia nueva con binario; scripts/_leerPlano.py ya corta mosaicos con otra librería: hay que medir si hoy falla | **DESCARTADO.** `scripts/_leerPlano.py` ya lee planos de más de 200 megapíxeles por partes. No hay una medición de que falle; si aparece, se reconsidera. |
| 51 | [sbrunner/deskew](https://github.com/sbrunner/deskew) | 529 | 02/10/2026 | MIT | sin verificar | Endereza un escaneo torcido. Contra: Ganancia chica | **DESCARTADO.** Ganancia chica y sin evidencia de que los escaneos torcidos sean un problema. |
| 52 | [mzucker/page_dewarp](https://github.com/mzucker/page_dewarp) | 1.530 | 02/10/2016 | MIT | sin verificar | Corrige páginas combadas. Contra: Sin commits desde 2016 | **DESCARTADO.** Sin commits desde 2016. |
| 53 | [javvi51/eDOCr](https://github.com/javvi51/eDOCr) | 90 | 31/01/2025 | MIT | sí | Digitaliza planos mecánicos: cajetín, cuadros de tolerancias geométricas y cotas. Contra: Pide TensorFlow y modelos viejos; sin commits desde 01/2025 | **DESCARTADO.** Pide TensorFlow y modelos viejos; `_leerPlano.py` ya recorta cajetín y lista de materiales. |
| 54 | [funstory-ai/BabelDOC](https://github.com/funstory-ai/BabelDOC) | 9.689 | 05/08/2026 | AGPL-3.0 | sin verificar | Traduce un PDF conservando el layout. Contra: AGPL-3.0; por defecto manda el texto a un servicio de afuera | **DESCARTADO.** AGPL-3.0 y por defecto manda el texto a un servicio de afuera. |
| 55 | [PDFMathTranslate/PDFMathTranslate-next](https://github.com/PDFMathTranslate/PDFMathTranslate-next) | 735 | 08/04/2026 | AGPL-3.0 | sí | Traduce un PDF conservando el layout. Contra: AGPL-3.0; usa servicios de afuera | **DESCARTADO.** AGPL-3.0 y usa servicios de afuera. |

### Sistema del asistente

| N.º | Repo | Estrellas | Último commit | Licencia | Windows | Qué hace | Veredicto y evidencia |
|---|---|---|---|---|---|---|---|
| 56 | [withLinda/claude-JSONL-browser](https://github.com/withLinda/claude-JSONL-browser) | 93 | 12/05/2026 | sin licencia visible | sin verificar | Convierte los registros de conversación a Markdown. Contra: Sin licencia visible, en mantenimiento | **DESCARTADO.** Sin licencia; `scripts/_lib/transcriptsFak.mjs` ya lee los registros. |
| 57 | [jordankzf/claude-transcript-viewer](https://github.com/jordankzf/claude-transcript-viewer) | 0 | 22/03/2026 | sin licencia visible | sin verificar | Un solo archivo HTML que abre un registro de conversación con búsqueda y filtro por rol. Contra: Sin archivo de licencia (el README dice MIT), 3 commits | **DESCARTADO.** 3 commits y 0 estrellas; `scripts/_lib/transcriptsFak.mjs` ya lee los registros. Su README dice MIT, aunque no tiene archivo de licencia. |
| 58 | [basicmachines-co/basic-memory](https://github.com/basicmachines-co/basic-memory) | 4.132 | 10/10/2026 | AGPL-3.0 | sin verificar | Memoria en Markdown local con índice SQLite y búsqueda semántica. Contra: AGPL-3.0; versión paga en la nube; telemetría | **DESCARTADO.** AGPL-3.0, con versión en la nube y telemetría. La memoria se busca hoy con grep sin que eso sea un problema medido. |
| 59 | [Suyann/claude-code-windows-hooks](https://github.com/Suyann/claude-code-windows-hooks) | 0 | 17/09/2026 | propia o sin clasificar | sí | Prueba en seco de hooks en Windows: dice si un hook bloquea o deja pasar y marca los que fallan abierto. Contra: Las pruebas automáticas están en una versión paga | **DESCARTADO.** Lo cubren `scripts/_probarMejora.mjs` y el test `hooksTienenTest`. |
| 60 | [MH4GF/tq](https://github.com/MH4GF/tq) | 15 | 13/06/2026 | sin licencia visible | sin verificar | Cola de trabajos para varias sesiones con un agente que reparte. Contra: Sin archivo de licencia (el README dice MIT); depende de una función nueva de Claude Code | **DESCARTADO.** Lo cubren `scripts/_encargo.mjs` y la skill `lanzar-sesion-hija`. Su README dice MIT, aunque no tiene archivo de licencia. |
| 61 | [RonitSachdev/ccnudge](https://github.com/RonitSachdev/ccnudge) | 15 | 29/10/2025 | MIT | sí | Sonido y aviso de escritorio en cada evento de hook. Contra: Escribe en la configuración global; sin commits desde 10/2025 | **DESCARTADO.** Escribe en la configuración global y no aporta. |
| 62 | [simonw/claude-code-transcripts](https://github.com/simonw/claude-code-transcripts) | 1.699 | 12/02/2026 | Apache-2.0 | sin verificar | Convierte una sesión en páginas HTML con un índice que lista los pedidos y los commits. Contra: Tiene una opción que sube el HTML a GitHub; se toma la idea, no la herramienta | **APROBADO.** HOY-18d. Solo la idea: una página con la línea de tiempo de una sesión. Su README confirma el índice con los pedidos y los commits. No tenemos nada que le arme a Fak esa página. **Las piezas ya existen**: `relevarTranscript()` de `scripts/_lib/cierreGuard.mjs` y `scripts/_lib/archivosSesion.mjs` sacan los archivos que tocó una sesión, y `transcriptsFak.mjs` sus mensajes. Su opción de subir la página a GitHub no se toma. |
| 63 | [vrppaul/claude-review](https://github.com/vrppaul/claude-review) | 2 | 05/10/2026 | MIT | sin verificar | Revisión en el navegador de diffs y de registros, con comentarios que vuelven al asistente. Contra: 2 estrellas | **DESCARTADO.** 2 estrellas y nada que se necesite hoy. |

## 6. Lo que se buscó y no existe en GitHub

Según las búsquedas de los nueve agentes. Que no haya aparecido no prueba que no exista, pero ninguno lo encontró.

| Frente | No apareció |
|---|---|
| Mails | Un repo en Python que combine el filtro del lado de Outlook con la lectura del hilo completo, y nada que documente la trampa del formato regional de fechas |
| arb | Un lector de archivos Btrieve con su diccionario en Python o Node, y un proyecto libre que automatice sistemas viejos leyendo sus grillas |
| AMFE | La tabla de Prioridad de Acción 2019 con tests que la cotejen contra el manual, un esquema abierto de plan de control, y conversores de los formatos de los programas comerciales de AMFE |
| 3D | Un lector libre de archivos de CATIA sin tener CATIA, reconocimiento de agujeros, espesores y ángulos de desmoldeo en Python, y una librería que aplane un tapizado 3D a patrón |
| Patrones de corte | Un lector libre de las tizadas de los sistemas de mesa de corte, y un lector de los formatos de la industria de la confección |
| PowerPoint y Excel | Algo que conserve las imágenes en celda de Excel, y un limpiador de propiedades que cubra Word, Excel, PowerPoint y PDF juntos |
| Flujogramas | Algo que genere diagramas con la simbología del diagrama de proceso |
| Balanceo y tiempos | Un balanceador de línea con tests y datos de referencia, y software libre de estudio de tiempos y movimientos o de cronometraje sobre video |
| Planos | Detección de los globos de un plano, algo que entienda qué cota cambió entre dos revisiones de un plano (HOY-18b compara dos PDF como imagen, no como plano), y un traductor de PDF que funcione seguro sin mandar el texto afuera |
| Sistema del asistente | Detección de notas de memoria duplicadas o contradictorias, y una cola de sesiones para Windows |

## 7. Lo que quedó sin mirar

**24 repos que los buscadores nombraron y no se evaluaron.** Se sacaron al armar la lista por uno de estos motivos, sin
leer más que lo que informó el agente:

| Motivo | Repos |
|---|---|
| Es una lista de enlaces, no una herramienta | `CadQuery/awesome-cadquery`, `ComposioHQ/awesome-claude-skills` |
| Copia de otro candidato, o 0 estrellas sin nada propio | `functionalprototype/Deepnest`, `Tonna/search-pst`, `saurabhkm/outlookAutomation`, `jatinpurba/outlook-legacy-mcp`, `Sixeight/cclog`, `alexmuetze/Production_Simulation_and_Analyses`, `1101-hub/netfold` |
| Sin licencia, o con todos los derechos reservados | `collero/winMCP`, `AegisNetLab/aegisnet-qualityflow`, `shawnparnell81/AccuQual`, `ddeltasolutions/UI-Automation-Studio` |
| No es del frente (otro tipo de AMFE, accesibilidad, Word, otro lenguaje) | `willtran87/project-py-sfmea`, `Community-Access/accessibility-agents`, `ThirstyHead/xlsx-a11y`, `elapouya/python-docx-template`, `ardata-fr/doconv`, `w1ne/kernelCAD-web`, `pyvista/setup-headless-display-action` |
| Sin commits recientes, sin Windows o con licencia que contagia | `atimmer/libnest2d`, `comawill/plottool`, `opendatalab/PDF-Extract-Kit` |
| Demasiado genérico para el uso | `mermaid-js/mermaid` |

Ninguno de los 24 se verificó en su página. Si alguno importa, se mira aparte.

**Frentes que no tuvieron candidatos propios:**

- **Abrir y buscar archivos, y la nube** (45 de los 254 pedidos de 30 días, el segundo frente de Fak): no se buscó.
  HOY-19 ya lo trata con lo que hay en el repo.
- **PPAP y legajo, IMDS, impresoras y Supabase**: no figuraban en el encargo y no se buscaron.
- **Skills de oficina**: se buscaron y solo apareció una lista de enlaces; no hay ninguna evaluada.

**Otros límites:**

- **Ningún candidato se instaló ni se corrió.** «Anda en Windows» es lo que dice el README de cada uno, no una prueba
  en esta PC. Donde el README no lo dice, la tabla pone «sin verificar».
- **De los 57 descartados se leyó la página del repo, no el código.**
- **El auditor releyó 25 de los 64 repos**: las fechas de último commit coincidieron en los 25. Las estrellas pueden
  moverse unas pocas de un día al otro.
- **Si un repo está archivado** se lee de la página y dio «no» en los 64; `Siddardth7/fmea-risk-analyzer` no está
  marcado así, pero su README dice que se mudó.
- **Los tamaños** de las filas aprobadas son una estimación con el criterio de `codigo-madre.md`; se confirman al
  abrir cada una.
