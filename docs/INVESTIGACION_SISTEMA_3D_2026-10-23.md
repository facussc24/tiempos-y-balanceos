# Investigación: el sistema de diseño 3D asistido por IA

Fecha: 20-21/10/2026 · Para leer el viernes 23/10

**Cómo se hizo.** Se investigaron 10 frentes por la API, con búsqueda y lectura web. Otro modelo verificó cada frente: abrió las fuentes clave y buscó evidencia en contra (anexos fNN, verificación). Además se hizo una crítica de la skill real (`SKILL.md`, `reference\`) y del caso del virolador (anexo 00).
- Lo que solo salió del buscador va marcado «(fuente sin abrir)».
- Lo que es mío va marcado «(opinión)».
- Cuando la verificación corrigió un dato, uso la versión corregida.
- En el cuerpo, cada afirmación lleva entre corchetes el número de su fuente en «Fuentes», al final.
- Cinco fuentes no tienen link en el material y van marcadas «(sin link)».
- Las afirmaciones que no tienen fuente en la lista van marcadas «(sin fuente)».

**Anexos.** El material de respaldo está en `docs/investigacion-3d-2026-10-23/`, con su README: la crítica interna, los informes por frente con su verificación y las refutaciones. En el cuerpo:
- «(anexo 00)» es la crítica interna de la skill y del virolador;
- «(anexo fNN)» es el informe del frente NN y su verificación.

Tres palabras que aparecen mucho:
- **Preprint:** artículo científico sin revisión de pares. Casi todo lo de IA y CAD es eso.
- **Benchmark:** banco de pruebas estandarizado.
- **Gate:** control automático que frena el avance si falla.

Glosario corto de otros términos:
- **API:** puerta para que un programa use otro programa o servicio.
- **JSON:** archivo de texto con datos estructurados, como el YAML.
- **Diff:** lista de lo que cambió entre dos versiones.
- **det ±1:** determinante de la matriz que ubica una pieza. +1 es una posición real; −1 es la pieza en espejo.
- **APAR:** reporte oficial de un defecto de CATIA en el soporte de IBM.
- **Issue / PR:** en GitHub, un reporte de problema / una propuesta de cambio al código.
- **★:** estrellas de GitHub. Miden popularidad, no calidad.
- **MIT / Apache:** licencias libres permisivas: se usa y se modifica sin publicar nada.
- **AGPL-3.0:** licencia libre que obliga a compartir el código modificado, aunque solo se use por red.
- **Creep:** deformación lenta de un plástico bajo carga sostenida.
- **HDT:** temperatura a la que el material cede bajo una carga estándar.
- **LiveBench:** benchmark general de tareas para modelos de lenguaje.

## En una página

**(opinión) El error de base no es de herramienta ni de falta de conocimiento: es de cuándo se aplica ese conocimiento.**

- El sistema guarda el criterio de diseñador como texto: unas 210 reglas, el 80 % solo prosa, y ~35.000 palabras para leer «antes de modelar» (anexo 00).
- Los controles están en los dos extremos: un cuestionario al principio y un export que frena al final. En el medio (elegir concepto, cerrar el mecanismo, iterar) no se dispara nada. Tres de los seis problemas del virolador tenían la regla escrita (anexo 00).
- La skill nació para verificar piezas contra el STEP del cliente. El 20/10 se usó para diseñar un mecanismo en CATIA, un camino que la skill no describe (anexo 00).
- Fuera de casos muy simplificados, ningún estudio muestra una IA que diseñe sola un mecanismo funcional:
  - en CAD-bench, las tareas funcionales quedan «near zero» [2];
  - en Hephaestus (estructuras con FEA), 0 de 400 primeros intentos pasan el control estricto [1].
- (opinión) Por eso tu presencia en el lazo no es un defecto a eliminar sino un rol a ubicar: aprobar el contrato y el mecanismo al cierre de cada fase, en vez de ser el control de calidad del final.

Las 5 cosas que cambiaría primero (§10), en lugar de sumar más texto (opinión):
1. fases con contrato y criterio de salida verificable, con la seguridad dentro del mecanismo;
2. biblioteca de constructores de la casa, más catálogo con procedencia;
3. las marcas que más importan, convertidas en código;
4. herramientas rápidas y edición incremental;
5. dieta de la skill y lazo de aprendizaje medido.

**Huecos:** no se cubrieron el diseño generativo, el DFM/DFA ni los copilotos de SolidWorks, Onshape y Creo (de estos últimos, solo datos sueltos; §4).

## 1. El diagnóstico: las causas de raíz del virolador

Clases: **(a)** la regla existía y nada la disparó; **(b)** la regla no existía; **(c)** faltaba una herramienta. La tabla sale de la crítica interna sobre los archivos reales (anexo 00).

| # | Problema del 20/10 | Causa de raíz (en los archivos) | Clase |
|---|---|---|---|
| 1 | Estética antes de que el mecanismo funcionara | `SKILL.md` §3 es una fila de nueve pasos sin criterio de salida entre uno y otro. El único freno duro está al final (`export_deliverables.py`). Lo que más se controla es la entrega visual: el GATE E y la revisión ciega G-E4, que recibe «**solo** el PDF y los renders». La regla de fases aparece recién en `DONDE_QUEDO.md` («regla de Fak 20/10»). | (b) |
| 2 | Palanca dibujada de cero | El GATE P (c) solo mira lo que Barack «ya tiene fabricado y andando» (`indice_dispositivos.py`); catálogo y comunidad no entran. La pregunta de catálogo (`preguntas-antes-de-disenar.md`, grupo 5) está fechada «Fak, 20/10/2026», o sea, después del error. El GATE 1 («Toda cota se EXTRAE del CAD medido … o es dato de Fak») deja sin fuente válida a cualquier pieza comprada, y eso empuja a dibujar. CATIA no traga mallas (`catia.md`). Al integrarla, la palanca quedó en espejo («det = −1», `AUDITORIA_auditor.md` hallazgo 1). | (b) + (c), con una regla en contra |
| 3 | Cajas peladas con cantos que lastiman | La regla existía (`ficha-utillajes.md` E5) y el mecanismo correcto también: «el redondeo es PROPIEDAD del constructor» (`utillajes-de-apriete.md`). Pero `caja_tope_redondeado()` quedó en el build123d de agosto y no en la biblioteca, y el 20/10 se modeló con `scripts/catia/`. `gate_aristas.py` caza aristas **cóncavas** (fatiga), mientras que los cantos que cortan la mano son **convexos** y nadie los mira. Redondear por COM (la vía por la que un programa maneja CATIA desde afuera) tarda «más de 10 min». Para «profesional» no hay estándar de aspecto. | (a) cantos · (b) aspecto · (c) CATIA |
| 4 | Simulaciones de minutos por posición | La regla «más de 2 minutos = mal planteada» existía (`SKILL.md` §3bis), pero nada mide el tiempo. Choca con la lección 36 («el muestreo sobra») cuando el booleano exacto (unir, restar o intersecar sólidos) tarda «~5 min por posición». El GATE 6 gira alrededor de un solo eje, y un cuatro barras no es eso. `manifold3d` estaba instalado pero no figura en `SKILL.md` §1. | (a) + (c), con contradicción |
| 5 | Rehacer todo en cada corrección | La receta lo manda: `catia.md` «Receta» paso 2, `fresca=True` (abrir desde cero). La regla contraria («No rearmar desde cero») nació el 20/10 al fondo del mismo archivo, sin tocar la receta. CATIA se cae con muchas mediciones, y un `SaveAs` (guardar como) puede dejar «el archivo ESCRITO pero ROTO». | (b) + (c), con la receta en contra |
| 6 | Tuviste que marcar lo obvio | Los gates «nacieron DESPUÉS de que una persona encontrara el bug … demuestran memoria, no capacidad de detección» (`SKILL.md` §0). El crítico (G-E4) corre al final y sin gate. De los 4 rojos del auditor, dos tenían regla escrita: números tipeados contra la lección 39, y un guardado que «falló callado». | (a), de mecanismo |

**El patrón** (crítica interna, anexo 00):
1. **Los controles están en los dos extremos.** En el medio no se dispara nada.
2. **La skill es un verificador de piezas, no un método para diseñar mecanismos.** Su descripción es «importar … medirlo, registrarlo … verificar interferencia». `catia.md` había dejado el diseño en CATIA para «si algún día se diseña EN CATIA por programa». Ese día llegó el 19/10 sin que nadie lo revisara.
3. **Cada lección se escribe donde nació, como relato.** No va al lugar donde se la va a necesitar.
4. **En números:**
   - Sin contar `catia.md`, hay ~210 reglas de diseño.
   - ~10 frenan la entrega (5 %).
   - ~30 tienen una herramienta que hay que acordarse de correr (15 %).
   - ~170 son solo texto (80 %).
   - Es un conteo a mano, ±15 %.
5. **Cinco contradicciones internas:**
   - tres o cuatro apoyos;
   - booleano exacto o 2 minutos;
   - cotas medidas o catálogo;
   - `fresca=True` o «no rearmar»;
   - diseñar con build123d o con CATIA.

**Lo que dice afuera sobre estas causas:**
- **Reglas que solo son texto.** Avisos y listas son controles «generally weaker than physical or system controls». Ojo: la misma guía aclara que no es una jerarquía rígida [30].
- **Cuándo se detecta el error.** En un estudio aeroespacial (Tan, Otto y Wood, ICED17), la causa raíz mayor de los defectos fueron los requisitos [40].
  - El propio paper dice que la *tasa* de defectos no difiere de forma significativa entre etapas.
  - Lo significativo es el *costo*: 13 veces más retrabajo, porque el error temprano se detecta tarde [40].
  - Lo caro no es equivocarse temprano: es enterarse tarde.
- (opinión) **No falta conocimiento: falta el momento en que se aplica.**

## 2. Lo que confirma lo que hacemos

1. **Medir con el motor geométrico, no solo mirar.**
   - build123d-mcp, un servidor para que la IA maneje build123d, lo dice textual: «Prefer measure() over render_view()» [94].
   - Zookeeper (Zoo) mide masa, centro de masa y volumen en cada vuelta [21].
   - catia-v5-mcp reporta el cambio de volumen de cada operación [23].
   - En Hephaestus [1] terminaron pasando 9 piezas. En 5 de ellas el arreglo no se veía en los renders, y en 4 se veía solo en parte.
2. **Controles que saben fallar y no aprueban de más.**
   - Dos reglas de la skill:
     - el par BIEN/MAL con «código 3» (`SKILL.md` GATE 3);
     - «la máquina puede MATAR un dato, nunca APROBARLO» (GATE P).
   - Coinciden con `verify_spec` de build123d-mcp, que contesta PASS/FAIL/UNVERIFIED y nunca dice «cumple» sin haber chequeado algo [94].
   - (opinión) Es lo mejor del sistema. Hay que conservarlo.
3. **Simular el recorrido, no la pose final.**
   - Simular el recorrido es oficio. Roche, que fabrica sargentos, dice que los diseñadores suelen mirar el CAD trabado («look at static CAD models in the locked position») y no modelan el barrido del mango [26].
   - CAD-bench (workshop de ICML 2026) puntúa los mecanismos con simulación de cuerpo rígido [2].
   - manifold3d dio resultados válidos en los 1000 pares de un benchmark [68], con condiciones (ver §3). En cajas dio 24/24 a ~10 ms [69].
   - trimesh mueve una pieza sin recrearla (`set_transform`) [72], así que «un modelo, N posiciones» es el patrón correcto.
4. **Revisor independiente.**
   - En CADSmith, según su repositorio, la mayor parte de la mejora la aporta el juez de imágenes aparte [4].
     - Pero la mediana casi no cambia.
     - Los autores documentan una pieza que pasó todos los controles y estaba mal [4].
   - En un preprint preliminar, un revisor propone una sola mejora por vez y otro agente verifica cada edición [29].
   - El auditor del 20/10 encontró 4 rojos medidos (anexo 00). (opinión) Sirve; hay que adelantarlo.
5. **Reusar antes de dibujar es oficio, no capricho.**
   - Hoffman repite «simplicity and economy» y pide componentes estándar [32].
   - CATIA trae PowerCopy y UDF (plantillas reutilizables de geometría) justamente para eso [107, 110] (fuente sin abrir).
   - Los sargentos de palanca son producto de catálogo [55] (fuente sin abrir), con CAD de Kipp, Ganter, norelem y Destaco (sin fuente).
   - Misumi baja CATIA V5 nativo (`.catpart`) [51].
6. **Criterio de aceptación escrito antes.**
   - Omni3D: «define the acceptance test before printing» [27]. Es un vendedor.
   - `ficha-utillajes.md` K1 y el plan de la v16 ya lo hacen (anexo 00).
7. **Lecciones metidas en el proceso, no en una base de consulta.**
   - catia-v5-mcp registra 152 trampas de COM y pega cada lección al error que la dispara [23].
   - En NASA las lecciones aprendidas no se consultaban, y la salida fue llevarlas a estándares [91] (fuente sin abrir).
8. **CATIA por COM desde Python.**
   - Es el camino de pycatia (371 ★, licencia MIT, se declara «alpha») [105] y de los MCP de CATIA que aparecieron [23]. Un MCP es un enchufe estándar para que un asistente de IA use un programa.
   - Un agente que maneja la pantalla saca 17,5 % en 200 tareas de FreeCAD (CADWorld) [17]. El estudio no compara contra agentes por API, así que no sirve a favor ni en contra.
9. **Regla FDM que ya tienen.** Chaflán, no filete, en la cara de cama (Markforged [63]; Ultimaker [67], fuente sin abrir). Es `ficha-fdm.md` G6.

## 3. Lo que lo contradice o lo pone en duda

1. **(opinión) La ambición va más lejos que lo demostrado.**
   - CAD-bench (17 tareas, póster de workshop): el mejor modelo suelto llega a 59,9 % global, y las tareas funcionales quedan «near zero» [2].
   - Hephaestus [1]:
     - 0 de 400 primeros intentos pasan el control estricto;
     - con 10 ciclos de corrección y 68 min por pieza se llegó a 60,5 % de requisitos y a 9 de 50 piezas perfectas, **pero eso es GPT-5.5 en Codex**;
     - con Claude Opus 4.7 (xhigh, pieza simple) el resultado empeoró levemente tras el feedback;
     - es una sola corrida, sin intervalos de confianza.
   - CADEngBench: de 1.030 programas que corren, 432 pasan los chequeos de ingeniería y fabricación [3]. Es un dato parcial, confirmado por resúmenes de terceros.
   - El propio Autodesk dice que pedir piezas por texto «isn't dependable enough yet for everyday use» [25].
   - Ningún copiloto comercial sirve para V5:
     - la IA de Dassault vive en 3DEXPERIENCE, en la nube [19];
     - que no haya planes para V5 lo dice un competidor, Leo AI [20].
2. **Más texto no es más criterio.**
   - Los archivos de instrucciones permanentes (AGENTS.md) «does not generally improve task success rates, while increasing inference cost by over 20%» [84].
   - SkillsBench: las skills enfocadas, de hasta tres módulos, rinden más que los paquetes exhaustivos [85]. Según la verificación, la lectura «2-3 skills» del informe del frente era errónea (anexo f07).
   - Anthropic pide un SKILL.md de menos de 500 líneas en el cuerpo, y que se escriban evals antes que documentación extensa [83]. Un eval es una batería de pruebas automáticas del comportamiento de la IA.
   - En contra: en otro estudio, AGENTS.md bajó 28,64 % el tiempo [89] (fuente sin abrir). Lo que decide es qué se pone, no si existe.
   - Hoy la lectura obligatoria es de ~35.000 palabras (anexo 00).
3. **Una checklist específica de la tarea, de sí/no, mejoró la autocorrección (TICK).**
   - El informe del frente de procesos citó TICK [31] para decir que la autocorrección empeora.
   - **La verificación lo desmintió** (anexo f03). El paper dice lo contrario: las checklists generadas para cada instrucción, con preguntas SÍ/NO, *mejoran* la autocorrección (+7,8 % en LiveBench) [31].
   - El control con código sigue siendo más fuerte, pero «nada de checklists» no se sostiene.
4. **Fases sí; rígidas no.**
   - Los diseñadores con experiencia «move rapidly to early solution conjectures» y definen problema y solución juntos (Cross [36], fuente sin abrir).
   - Stage-Gate, el método de fases con puertas de aprobación, es criticado por «too linear, too rigid» [37] (fuente sin abrir).
   - ICED17 [40] apoya *verificar temprano*, con un prototipo crudo y un chequeo cinemático, más que *aprobar en papel*.
5. **«Biblioteca primero» está menos probado de lo que suena.**
   - AssemCAD [14]:
     - Claude solo conserva la estructura del ensamble en 0,8 % de los casos; con el sistema completo llega a 82,5 %;
     - el salto es de todo el sistema (especificación, verificación y biblioteca), sin un ensayo que aísle la biblioteca, y lo juzga un modelo;
     - con GPT-5.5, la estructura sube pero el puntaje general baja un poco.
   - En ArtiCAD, sacar el almacén de experiencias casi no cambia la calidad: solo suma vueltas [15].
   - El diseño de utillajes asistido por computadora existe desde 1983 con bases de componentes, y su aplicación industrial es «very limited». Los requisitos operativos (facilidad de uso, a prueba de error) son «difficult to model» (Rong et al., 2010) [41] (sin link).
   - El −79 % del configurador académico vale para familias estandarizadas [103].
   - Conclusión: hay que medir cuánto se repite de verdad.
6. **Catálogo por programa: más difícil y con letra chica.**
   - La API de TraceParts se pide con un formulario y tarda días, y cada descarga exige email, nombre y empresa [43].
   - McMaster es solo para clientes aprobados [45].
   - Las condiciones de TraceParts [44]:
     - los datos son «only … for the purposes of computer-aided design or viewing»;
     - no se pueden redistribuir;
     - no hay garantía de exactitud;
     - imprimir una réplica del sargento no parece cubierto (lectura nuestra; conviene consultar).
   - MakerWorld prohíbe el acceso con «artificial intelligence service» [48].
   - Printables no prueba los modelos [49]. El autor de un cierre impreso dice «I have not tested this latch much» [50].
7. **Editar en vez de regenerar: sí, pero vigilando lo que no tocaste.**
   - La cifra que apoyaba editar (1.071 contra 231 en CADEngBench [3]) no se pudo verificar.
   - Un resumen de BenchCAD dice que editar es más difícil que generar [9].
   - El modo de falla documentado es «edit the requested feature while changing unrelated parts» [10].
   - build123d elige caras por geometría, no por nombre [76]. Si cambia una cota, «la cara de arriba» puede ser otra.
8. **manifold3d como juez tiene fallas calladas.**
   - Si la malla de entrada es inválida, devuelve un sólido vacío y marca error [70]. Si el script no mira `status()` (el código de error de la operación), la respuesta es «no choca» sin haber medido nada.
   - Con caras coincidentes (topes, pivotes) deja astillas «< 5% of the time», según el issue 1430 [71] (sin link). Pero es la estimación de un usuario («probably»), no una medición.
   - La holgura sobre malla tiene un piso. CATIA mismo calcula el choque sobre el teselado (la conversión del sólido a triángulos), y da «contacto» si la distancia es menor que la suma de las flechas de cuerda (APAR HD64346 de IBM) [78] (sin link).
   - Los benchmarks de velocidad son de un vendedor (uniones, en una Mac) [68] y de cajas [69].
9. **Probar poses sueltas deja pasar choques.** En un brazo robot, con 2 poses se pierde el 19,6 % de los choques, y con 32 poses, el 0,13 % [74].
10. **CATIA hace más de lo que supusieron dos frentes de la investigación.**
    - Por COM expone choques y distancias (SPAWorkbench → Clashes/Distances [79]), y pycatia lo envuelve [105]. Esto desmiente lo que dijeron esos frentes: que «solo se puede crear el mecanismo».
    - Un caso de uso oficial corre el solver de la cinemática con `PutCommandValues` [81] (sin link; fuente sin abrir).
11. **La impresora y el material ponen límites.**
    - La A2L declara PLA, PETG, TPU y PVA, y también PLA-CF y PETG-CF con boquilla templada. La cama llega a 80 °C como máximo [56].
    - PLA a 20 °C bajo carga durante 170 h: el módulo cae al 56 % y no se estabiliza (una sola probeta) [57].
    - Hay datos de creep de PETG validados a un mes (Alagheband et al., 2025) [58], así que «no hay datos de PETG» era falso (anexo f05).
    - El HDT de 54 °C del PLA de Bambu se midió con probetas recocidas: es optimista (hoja técnica de PLA de Bambu; sin link, vino truncada, ver nota en [65]).
    - Con un tornillo sobre una pieza impresa, la fuerza de apriete cayó 3,3 % en PLA y 11,5 % en PETG (Amza et al.) [59].
12. **Rosca en plástico: lo de afuera contradice las reglas.**
    - La rosca macheada en plástico es «ineffective» (Formlabs, guía de jigs para SLA) [62].
    - Eso contradice `ficha-fdm.md` R3 (1,5 a 2,5·D de rosca) y el «~M12» propuesto en `DONDE_QUEDO.md`.
    - Lo que conviene es usar insertos o tuerca.
13. **Tres apoyos como regla fija puede ser la regla equivocada para tapizado.**
    - Sobre-restringir «is sometimes necessary» (Formlabs, SLA/SLS) [28].
    - En piezas flexibles no se sobre-restringe, y hay springback (jcproto) [35].
    - (opinión) Con piezas blandas, el 3-2-1 rígido merece revisión, y eso además resuelve la contradicción de 3 contra 4 apoyos.
14. **Más razonamiento o más candidatos no es la palanca, salvo con un buen verificador.**
    - En Hephaestus, «higher reasoning effort does not consistently improve performance» [1].
    - Elegir el «más central» entre N candidatos se agota hacia N≈9 [5]. Pero eso se comparó contra elegir al azar y sin verificador; el mejor candidato del grupo sigue mejorando con N.
15. **Fuentes de vendedores: bajarles el peso.**
    - Formlabs es SLA [28, 62].
    - Roche se contradice: 2:1 y «2 to 3» [26].
    - La nota de «prensa» sobre Dassault copia a Leo AI, que es competidor [20].

## 4. Lo que no se nos había ocurrido

1. **Un contrato ejecutable antes del CAD.**
   - Hephaestus pide un `blueprint.yaml` con envolventes, interfaces y criterios de aceptación antes de escribir CAD [1]. YAML es un archivo de texto estructurado.
   - `verify_spec` declara la intención una vez y la revalida después de cada corrección [94].
   - AssemCAD hace que la IA escriba una *especificación* (partes, puntos de unión) y que la geometría la construya código fijo [14].
   - La evidencia a favor del contrato es de dirección, no de magnitud. En Hephaestus el blueprint dio +0,3 (GPT) y +3,9 (Claude) en el puntaje de ingeniería, sin intervalos de confianza [1].
   - Ojo: Anthropic recomienda calificar el resultado y no el camino [82]. El control tiene que mirar «interfaces y holguras correctas», no «hizo la envolvente antes que la estética».
2. **Juntas antes que geometría.** En ArtiCAD, sacar el paso de definir conectores en la etapa de diseño baja el éxito de 100 % a 89,2 % [15].
3. **Poscondiciones que gritan.** La unión de AssemCAD «never silently returns a disconnected compound», y se verifica que cada agujero declarado exista [14]. Es barato de copiar.
4. **Auditoría de fragilidad y diff por corrección.**
   - `design_audit` mueve cada parámetro ±10 % y revalida [94].
   - jarvis-onshape-mcp devuelve con cada cambio un diff: caja, masa y n.º de piezas [97].
5. **Darle a la IA un croquis acotado, no texto.** En cadbench.ai, Opus 5.5 saca 84,66 partiendo de planos, contra 50,87 creando desde texto [8]. Es una recompensa media, no una tasa de piezas que pasan.
6. **Los controles se pueden trampear.** En Hephaestus, 3 de los 9 aprobados fueron arreglos del contrato del chequeador (nombres de métricas, campos de masa), no de la física [1]. Hacen falta chequeos que el agente no vea y revisión humana por muestreo.
7. **Una regla para el paso del barrido.**
   - El desplazamiento entre dos poses (radio × Δθ en radianes) tiene que quedar por debajo de la holgura. Con 100 mm de radio, 5° son 8,7 mm.
   - Junto a cada holgura se informa la tolerancia de cuerda [78] (sin link).
   - En la pose crítica, CATIA puede ser el segundo juez [79].
8. **Knowledgeware es parte de CATIA V5, si tu licencia lo habilita (KWA, KT1: sin verificar).** Es el módulo de CATIA para parámetros, reglas y plantillas. pycatia crea por Python [106]:
   - checks que viven en el `.CATPart`, con informe XML;
   - tablas de diseño;
   - catálogos desde CSV.

   Letra chica:
   - Reglas y checks piden licencia Knowledge Advisor (KWA) [107] (fuente sin abrir).
   - Instanciar una PowerCopy desde una macro pediría KT1 [110] (fuente sin abrir). Por macro pierde colores y no se puede re-rutear («PERMANENT RESTRICTION», APAR HD70594 [108], fuente sin abrir).
   - La tabla de diseño pierde el vínculo si se renombra el archivo (HD59593 [109], fuente sin abrir).
   - (opinión) Para corregir sin rehacer, alcanzaría con cambiar parámetros por COM y actualizar.
9. **Vías concretas de catálogo.**
   - El plugin gratuito de 3Dfindit importa modelos de más de 6.000 fabricantes dentro del CAD, con capítulo para CATIA V5 en el manual [53, 52] (fuente sin abrir).
   - La clave de TraceParts se puede pedir ya [43].
   - PartCAD es un gestor de paquetes CAD (Apache-2.0, 503 ★) que acepta build123d y STEP y arma la lista de materiales [54].
   - bd_warehouse 0.4.0 trae tornillería, rodamientos, roscas y engranajes, y exige build123d ≥ 0.12.0 [46, 47].
   - Los STEP bajados van a una carpeta interna, y las cotas se miden antes de diseñar alrededor.
10. **FDM con números rotulados.**
    - Markforged da holguras **diametrales** y voladizo de 40° **desde la horizontal** [63]; los blogs mezclan «por lado» y vertical. Cada número de la skill tiene que llevar su eje.
    - Anisotropía según Bambu: PETG en tracción Z 35 contra XY 51 MPa; PLA, 31 contra 35 [65].
    - Hay que leer el perfil real de la A2L en el repositorio de BambuStudio [66].
    - Un usuario dice que la A2L no trae compensación de pata de elefante por defecto [66]. Si es así, el chaflán modelado es la única corrección.
    - Conviene imprimir una pieza de prueba propia de holguras e insertos.
11. **Seguridad con datos, en el idioma de la casa.**
    - ISO 13854 da 25 mm para el dedo y 100 mm para la mano, pero solo cubre aplastamiento, no cizalla ni arrastre [33].
    - La fuerza real de un sargento es el 30-50 % de su capacidad nominal (Roche) [26].
    - Mango de 34-38 mm (Atlas Copco, herramientas eléctricas) [34].
    - El checklist APQP tiene en la fase 3 «Tool Design and Tool FMEA» y «Tool Design Review» [38] (fuente sin abrir).
    - (opinión) Un DFMEA mínimo, sin números, por dispositivo [39] (fuente sin abrir) hablaría tu idioma.
12. **Probar con pieza sustituta y con el operario.** Formlabs usa «surrogate parts», pide operar con una mano y «pantomimar» los pasos [28].
13. **build123d sí está medido.**
    - En la tabla de CADGenBench que reproduce BenchLM, lidera «build123d-mcp + Claude Opus 5.5» con 86,9 % [11].
    - Advertencias: nadie verifica fila por fila, y los primeros puestos son del mismo autor del servidor.
    - CADClamp puntúa la imprimibilidad FDM de build123d y CadQuery [12] (fuente sin abrir).
14. **Medir el propio proceso.**
    - La sensación de ir rápido no prueba nada (METR; ellos mismos dicen que su estimación está sesgada hacia abajo) [92].
    - Hace falta una línea base de horas, vueltas y marcas por dispositivo.
    - Costo de referencia afuera: 68 min por pieza en Hephaestus [1] y ~US$ 5,7 por tarea en cadbench.ai [8].

**Huecos declarados.** Los copilotos de SolidWorks, Onshape y Creo quedaron casi sin cubrir. Hay datos sueltos, casi todos solo de búsqueda:
- Creo Automate trabaja sobre una copia aislada y espera la aprobación del ingeniero (verificado) [24] (anexo f02);
- Onshape AI Advisor no accede a tus datos (sin fuente);
- el Assistant de Inventor no crea features (sin fuente);
- de SOLIDWORKS no vino nada.

El diseño generativo y el DFM/DFA no se investigaron.

## 5. Tus ideas, una por una

| Idea | Veredicto | ¿Causa o síntoma? |
|---|---|---|
| Trabajar por fases | **Buena, incompleta** (opinión) | Causa: crea los controles que faltan en el medio |
| Catálogo antes de dibujar | **Buena, incompleta** (opinión) | Causa del problema 2 |
| Patas roscadas para imprimir sin soportes | **Buena puntual, con un error de cuenta** (opinión) | Síntoma |
| Chaflán en la cara de cama | **Correcta, ya existía** (opinión) | Síntoma de (a) |
| Simular más rápido | **Buena, a medio generalizar** (opinión) | Mitad causa, mitad síntoma |
| Cursos oficiales de CATIA | **Mala para estos problemas** (opinión) | No ataca ninguna causa |

**Fases.**
- Faltan un criterio de salida que se pueda verificar y una revisión por otro en cada fase. El espejo de la palanca lo encontró el auditor, no el cierre de fase (anexo 00).
- La seguridad está mal ubicada. El plan pone «Estética y seguridad — DESPUÉS», con «Cantos que toca el operario» en la fase 4. El atrapamiento se decide con el mecanismo, y el canto con el primer constructor.
- Falta una fase de concepto con alternativas.
- Las fases tienen que ser livianas y con vuelta atrás: se permite un boceto para ajustar requisitos (Cross [36]; críticas a Stage-Gate [37]; fuentes sin abrir).

**Catálogo.** Le falta:
- un orden de búsqueda (§8);
- STEP antes que STL;
- distinguir comercial (con carga nominal) de comunidad (sin ensayo, con licencia a revisar);
- un protocolo de integración: qué pieza es cuál y matrices con det +1, que es justo lo que falló en los hallazgos 1 y 5 (anexo 00);
- un GATE 1 que acepte «procedencia: catálogo»;
- las condiciones de uso [44, 48, 49].

(opinión) Antes de construirlo grande, fijate cuántas piezas se repiten entre tus dispositivos.

**Patas roscadas.**
- `DONDE_QUEDO.md` propone «~M12 en la zona maciza de la placa», y la placa mide 15 mm. Con `ficha-fdm.md` R3 (1,5 a 2,5·D), un M12 pide 18 a 30 mm de rosca: no entra.
- (opinión) Cuatro patas regulables son un hiperestático que alguien tiene que nivelar. Si el objetivo es solo imprimir sin soportes, alcanza con una pata atornillada impresa acostada.
- Si se rosca en plástico (ver §3.12):
  - en PLA, un inserto bueno arrancó 181 kg, contra 142 kg atornillando directo y 39 kg con un inserto barato [61] (fuente sin abrir);
  - en PETG el arrancado fue igual, pero el torque, de 1 a 3 Nm [60].

**Chaflán de cama.**
- Ya está: `ficha-fdm.md` G6.
- Falta que lo ponga el constructor de placas, o que lo revise un chequeo automático en la fase de fabricación.
- Antes de fijar el tamaño, mirá la compensación del laminador (el programa que convierte la pieza en instrucciones para la impresora). Prusa sugiere ~0,2 mm [64]. Que el chaflán «duplica» la compensación no lo dice Prusa, sino un usuario.

**Simular más rápido.** Ya está hecho: `sim_rapida.py`, «65 posiciones en 4,5 s» (anexo 00). Falta convertirlo en herramienta de la skill, con:
- poses calculadas por la cinemática;
- las guardas de §3 (`status()`, contactos permitidos, paso, piso de teselado);
- un cronómetro que avise a los 2 minutos;
- la regla «malla para barrer, exacto para decidir», que cierra la contradicción con la lección 36.

**Cursos de CATIA** (opinión).
- Ninguno de los seis problemas fue de manejo de CATIA. `catia.md` dice «Leer el plano es el cuello de botella, no CATIA».
- Los cursos de Automation (3 a 4 días de VBA [112], fuente sin abrir) son para quien escribe macros, y acá las escribe la IA.
- Si hacés uno, que sea **Knowledgeware**, para revisar mejor. Hacelo después de ver qué licencias tenés. Opciones:
  - el oficial dura 8 h [112] (fuente sin abrir);
  - el de GoEngineer es online, cuesta US$ 995 y son 4 medias jornadas en inglés, en horario de EE.UU. [111] (fuente sin abrir).
- Lo que falta es oficio de utillajes (Hoffman [32], Carr Lane, normas), y eso no lo da ningún curso de CATIA.

## 6. El orden del dibujo

«Experiencia > criterio de diseñador > herramientas > proceso de pensamiento» mezcla dos saberes, un medio y un método.

Para un diseñador humano tiene sentido: su experiencia vive en la cabeza y la aplica sin acordarse. (opinión) Para la IA no sirve:
- no acumula experiencia entre sesiones;
- todo lo que sabe de Barack está en archivos, y el 20/10 mostró que tenerlo escrito no alcanza;
- lo que faltó fue el proceso que dispara cada saber en su momento, y el dibujo lo pone último.

Afuera, lo mejor documentado es el feedback externo, con excepciones:
- sin él, los modelos «struggle to self-correct» en razonamiento (Huang et al.) [86];
- en Hephaestus ayudó, aunque con Claude rindió poco, y el arnés (las herramientas y controles alrededor del modelo) «is part of the measured system» [1].

Lo que yo dibujaría (opinión) es un ciclo, construido en este orden:
1. **Proceso.** Fases con criterio de salida, contrato y revisión. Es lo único que la IA ejecuta siempre; lo demás lo ejecuta si el proceso lo llama.
2. **Experiencia materializada.** Biblioteca de piezas probadas, catálogo y casos viejos con sus defectos. Para una IA, la experiencia no es una virtud: es un archivo que hay que abrir en el momento justo.
3. **Criterio.** Checklists cortas de sí/no por fase. Lo que se pueda pasa a constructor o a control.
4. **Herramientas.** Rápidas, con presupuesto de tiempo y al servicio de la fase.
5. **Retorno.** Prueba física, auditor y tus marcas, que realimentan el 2 y el 3.

Lo que cambiaría del dibujo:
- «proceso» arriba;
- «experiencia» como algo que se consulta, no como algo que se tiene;
- una flecha de vuelta desde la planta.

## 7. Herramientas, librerías, catálogos, cursos y métodos que no usamos

| Qué | Para qué nos sirve | Fuente | Madurez / estado |
|---|---|---|---|
| build123d-mcp: `verify_spec`, `design_audit`, `clearance`, `analyze_printability` | Contrato que se revalida, fragilidad de parámetros, holguras | llms.md [94] (abierta) | `verify_spec` experimental, apagado; no ve filetes ni chaflanes. Windows + Claude Code se colgaba hasta la v0.3.87 [95] (fuente sin abrir) |
| augura | Imprimibilidad sobre el STEP exacto, con salida que sirve de gate | [96] | 1 ★, pre-alpha. Solo frena por ERROR (no estanco, no entra, se vuelca); voladizos y paredes son aviso |
| CADClamp | Puntaje FDM de build123d/CadQuery | [12] | Fuente sin abrir |
| bd_warehouse 0.4.0 | Tornillería, rodamientos, roscas impresas compensadas | release v0.4.0 [46] (abierta) | Viva (07/10/2026); pide build123d ≥ 0.12 |
| PartCAD | Formato de biblioteca propia con STEP y lista de compras | [54] | Apache-2.0, 503 ★; Windows sin verificar |
| Plugin 3Dfindit | Catálogo de fabricantes dentro del CAD | freshdesk 3Dfindit [53] (abierta) | Gratis; integración con CATIA V5 sin probar |
| API de TraceParts | Bajar STEP por programa | developers.traceparts.com [42, 43, 44] (abierta) | Clave por formulario; uso solo para diseño |
| SPAWorkbench (Clashes/Distances) por pycatia | Segundo juez de choque y distancia en CATIA | doc V5Automation [79] (abierta) | Licencia DMU sin verificar |
| `Relations` de pycatia: checks + XML, tablas de diseño, catálogos CSV | Controles que viajan con la pieza; reusar | pycatia docs [106] (abierta) | Doc de R28; «reference only»; pide KWA [107] |
| `PutCommandValues` (CAAKiiMechanismSolve) | Correr la cinemática de CATIA por programa | espejo catiadoc [81] (sin link) | Fuente sin abrir |
| catia-v5-mcp (AstroQuest) | Copiar defensas: vigía de ventanas emergentes, volumen por operación, designar por puntos 3D | GitHub [23] (abierta) | 0 ★, 3 commits, probado en R19 en francés |
| trimesh `CollisionManager` + FCL; `MinGap` de Manifold | Distancia mínima y punto, mover sin recrear | docs [72, 70] (abiertas) | Maduras (opinión); contención reportada inconsistente (issue 2223 [73]) |
| jarvis-onshape-mcp | Patrón de diff por cambio y árbol revisado por humano | GitHub [97] (abierta) | 174 ★; exige Onshape |
| OrcaSlicer por línea de comandos (sin ventana) | Laminado reproducible con perfil fijado | PR #16010 [101] (abierta), wiki [102] (sin abrir) | Crashes en Windows reportados |
| Bambu Connect / Bambu Local Server | Envío oficial a la impresora | wiki oficial [100] (abierta) | Rutas oficiales; Local Server para Windows 10 |
| Guía de Markforged; hojas técnicas de Bambu; Fischbach; Alagheband | Números FDM con eje rotulado; creep | [63, 65, 57, 58] (abiertas) | Onyx/Markforged ≠ A2L: validar con pieza de prueba |
| ISO 13854 (vía Misumi); Roche; Omni3D | Atrapamiento, capacidad ≠ fuerza, ensayo de aceptación | [33, 26, 27] (abiertas) | Solo aplastamiento; vendedores |
| Guía de evals y de skills de Anthropic | Batería de fallas reales; medir contra «sin skill» | [82, 83] (abiertas) | Oficial |
| Curso Knowledgeware (3DS 8 h; GoEngineer US$ 995) | Que vos revises parámetros y plantillas | catálogo 3DS [112] (sin abrir); GoEngineer [111] (sin abrir) | Inglés; ver licencias antes |
| Hoffman, *Jig and Fixture Design* | Oficio: simplicidad y estándar | vdoc.pub [32] (abierta) | Supone maquinado: filtrar |

## 8. Cómo implementarlo en tu código: repos que ya lo hacen y una arquitectura de referencia

**En cinco líneas:**
1. Nadie tiene armado el sistema completo. Hay piezas sueltas en proyectos chicos o inmaduros, y de ellos conviene copiar ideas más que instalarlos.
2. La propuesta es trabajar por etapas: primero un contrato que firmás vos, después buscar lo que ya existe, después el mecanismo en bruto con su recorrido simulado.
3. Recién con el mecanismo probado se pasa a la forma, armada con piezas de la casa que ya traen resueltos los cantos y los chaflanes.
4. Cada etapa cierra con un revisor aparte y con tu aprobación, y las correcciones se hacen cambiando medidas, sin rehacer todo.
5. Todo se prueba contra el caso del virolador antes de usarse, y lo que pasa en la planta vuelve al sistema.

**Repos que ya lo hacen.** Un repo es un repositorio de código, en general en GitHub; las estrellas (★) miden popularidad, no calidad.
- Ninguno implementa el sistema entero.
- Lo más cercano es una cadena de un solo autor: build123d-mcp [94] → augura [96] → estampo [99] → bambox [98].
  - estampo fija la versión del laminador y el perfil (fuente sin abrir).
  - La cadena es inmadura: bambox solo está validado en una P1S con AMS, y su licencia incluye AGPL-3.0 [98].
- text-to-cad [93] tiene 21,4k ★, es MIT, genera STEP/STL/3MF y hace chequeos de fabricación.
  - Pero **manda telemetría por defecto**, es decir, datos de uso hacia afuera [93, 77 (sin link)].
  - Se apaga con `uvx cadgen telemetry off`.
- De los demás conviene copiar patrones, no instalarlos:
  - jarvis, el diff [97];
  - catia-v5-mcp, las defensas de COM [23];
  - AssemCAD, la especificación y las poscondiciones; es un paper [14].

**Arquitectura de referencia (opinión, armada solo con piezas que aparecen arriba).** Lo marcado *escribir* no existe en ningún lado.

0. **Base: registro y batería de pruebas.**
   - El virolador del 20/10 entra a `evals/banco/cad/` con sus defectos conocidos (anexo 00): palanca de cero, cantos vivos, espejo, tornillo corto, números tipeados, conjunto sin la parte fija.
   - Todo cambio de la skill se corre contra esa batería. La guía de evals de Anthropic pide 20-50 tareas de fallas reales, con varias corridas por tarea [82].
1. **Fase 0 — Contrato** (*escribir* el formato).
   - Un YAML corto con función, envolvente, interfaces, recorridos, cargas, ciclos y temperatura, criterios numéricos, «qué ya existe» y un croquis acotado tuyo.
   - Lo firmás vos.
   - Piezas: la idea de blueprint de Hephaestus [1] y `verify_spec` [94], sabiendo que no ve filetes.
2. **Fase 1 — Concepto y búsqueda.** Dos o tres alternativas con una tabla de decisión, y búsqueda en este orden:
   1. `indice_dispositivos.py` y la biblioteca de la casa;
   2. bd_warehouse [46];
   3. catálogo, por el plugin 3Dfindit en CATIA [53] o por TraceParts con clave [43], a una carpeta interna, midiendo cotas;
   4. repos imprimibles, solo como idea;
   5. de cero, anotando por qué.

   PartCAD [54] es candidato a formato de la biblioteca.
3. **Fase 2 — Mecanismo con geometría cruda** (rectas y cilindros).
   - Juntas de build123d con rango: el rango ya es el recorrido a barrer, aunque `connect_to` «does not bind them» [75].
     - Para una palanca simple alcanza una transformada a mano.
     - Un cuatro barras es un lazo cerrado: hay que resolver el cierre, a mano o con un solver.
   - Barrido con manifold3d o trimesh [70, 72], con guardas:
     - `status()` y malla estanca antes de cada booleano;
     - lista de contactos permitidos;
     - paso r·Δθ menor que la holgura;
     - `MinGap` [70];
     - «no decidible» por debajo del piso de teselado [78] (sin link).
   - Segundo juez en la pose crítica: SPAWorkbench por pycatia [79, 105].
   - Atrapamiento a lo largo del recorrido (*escribir*): luces bajo 25 mm [33], más cizalla y arrastre.
   - Cronómetro de 2 min.
   - **Sin barrido verde no se pasa a la forma.**
4. **Fase 3 — Detalle con constructores de la casa** (*escribir* el módulo, igual en build123d y en `scripts/catia/`).
   - Constructores: placa con chaflán de cama, caja con canto redondeado, pata, alojamiento de inserto, y la palanca validada con su armado det +1.
   - Controles:
     - unión con poscondición [14];
     - control de cantos **convexos** en zona de mano (*escribir*: nadie lo tiene);
     - `design_audit` [94].
   - Cada corrección es un cambio de `params.json` o de parámetros por COM, más un diff (caja, masa, n.º de piezas) [97] y un control de «lo demás no cambió».
   - No se reabre CATIA en cada corrección: se reescribe la receta de `catia.md`.
5. **Fase 4 — Fabricación.**
   - augura [96], que solo frena por ERROR, más un chequeo propio de voladizo con eje rotulado y de largo de agarre de tornillos (*escribir*).
   - Laminado con `laminar_bambu.py` u OrcaSlicer por línea de comandos [101], con el perfil real de la A2L fijado en un archivo versionado.
   - Envío por Bambu Connect o Local Server [100]. Nunca el MCP con certificado extraído (sin fuente).
6. **Cierre de cada fase.**
   - Un agente revisor recibe el modelo y la checklist de sí/no de esa fase, sin el razonamiento.
   - Solo se usa si vuelve a encontrar los defectos del banco.
   - Después aprobás vos.
7. **Retorno.** La primera pieza impresa y tus marcas van al registro (§9).

**Riesgos de implementación.**
- Fijá versiones de build123d y OCP (su núcleo geométrico), y tené piezas de prueba que avisen si algo cambia. Con build123d 0.13, `measure` y `validate` daban **falsos fallos de validez** hasta el 15/10/2026 [95] (fuente sin abrir).
- Las versiones no coinciden: la ayuda de pycatia salió de R28 [106], AstroQuest se probó en R19 [23] y tu PC sería R21 (sin verificar).
- Si la caché `gen_py` de pywin32 (la capa que conecta Python con COM) queda vieja, «desaparecen» métodos (sin fuente).
- No hay ningún benchmark de modelos escribiendo COM de CATIA, y en código general el 20,41 % de las alucinaciones son mal uso de APIs [18] (fuente sin abrir). Cada llamada nueva se prueba contra CATIA real.

**Nota: lo que el documento de propuestas descarta o pospone.** Varias piezas de esta arquitectura el documento de propuestas las descarta o las pospone: augura, PartCAD, OrcaSlicer por línea de comandos, `design_audit`, `verify_spec` y el chequeo propio de fabricación. Esta arquitectura es de referencia; la decisión está en `docs/PROPUESTAS_SKILL_3D_2026-10-23.md`.

## 9. Cómo debería aprender el sistema de un diseño al siguiente

1. **Toda marca tiene una salida, con jerarquía fija.** Venga de vos, del auditor o de la prueba física, se convierte en lo primero que se pueda de esta lista:
   1. propiedad del constructor (imposible hacerlo mal);
   2. control con par BIEN/MAL en la fase donde ocurre;
   3. ítem de sí/no en la checklist de esa fase.

   Además:
   - El relato va a un archivo de «por qué» que no se lee al diseñar.
   - La semilla ya existe: «Una corrección nueva se aplica a la CLASE» (`utillajes-de-apriete.md`, anexo 00).
   - Afuera, convertir cada corrección del revisor en una regla con ID dio 0 % de reincidencia en 11 sesiones, pero en un solo despliegue y sin grupo de control [88].
2. **Registro de marcas con métrica.**
   - Cada marca se anota con fase y clase (a, b o c).
   - Indicador: marcas tuyas por diseño, y qué porcentaje encontró el sistema antes que vos.
   - El «26/30» de exámenes escritos por otra IA no mide eso (anexo 00).
3. **Calibrar al revisor como al GATE A.** El revisor de fase no se usa si no vuelve a encontrar los defectos de los casos del banco.
4. **El valor gemelo, también para las checklists.** Se le da a la checklist un diseño viejo con el defecto puesto. Si sigue verde, el ítem está mal escrito.
5. **Medir contra «sin skill».** Anthropic pide evaluaciones antes de documentar y una comparación con el modelo sin la skill [82, 83]. Si sale igual de bien sin la guía, la guía sobra.
6. **Filtrar lo que entra.**
   - Guardar toda la experiencia hace que «inaccuracies in past experiences compound» [87].
   - Una regla nueva entra con su control, su origen y su fecha de revisión.
   - Alternativa intermedia: la IA propone la regla y entra solo si pasa la batería. Skills refinadas así superaron a las curadas por humanos [90] (fuente sin abrir).
7. **Chequeos ocultos y muestreo humano.** Por la trampa al chequeador (3 de 9 en Hephaestus [1]).
8. **Poda con presupuesto** (opinión). Un tope de lectura de ~2.000 palabras por fase. Una regla que en varios diseños no frenó nada pasa a archivo.
9. **La primera pieza impresa como dato.** `ficha-utillajes.md` K5 ya lo pide. Que use el mismo registro, con fase y clase.

## 10. Las 5 cosas que cambiaría primero

Todo esto queda propuesto, no aplicado: no toqué la skill.

**1. Fases con contrato y criterio de salida verificable, con la seguridad dentro del mecanismo (opinión).**
- **Qué:** contrato YAML firmado (§8, fase 0); fases livianas con vuelta atrás; sin barrido verde no se toca la forma; revisor de fase con checklist de sí/no.
- **Por qué:**
  - hoy no hay ningún control en el medio (anexo 00);
  - afuera se aplica lo mismo: blueprint de Hephaestus [1], especificación de AssemCAD [14], ensayo de aceptación de Omni3D [27];
  - la evidencia es de dirección, no de magnitud (§4.1);
  - ICED17 dice que lo caro es detectar tarde [40].
- **Causas que ataca:** 1, 6 y el patrón «controles en los extremos».
- **Cómo sabríamos que funcionó:** en el próximo dispositivo existen antes de la entrega el barrido verde y las holguras medidas, y bajan tus marcas por fase respecto del virolador.

**2. Biblioteca de constructores de la casa, más catálogo con procedencia (opinión).**
- **Qué:** un módulo igual en build123d y en `scripts/catia/` (placa con chaflán de cama, caja redondeada, palanca validada con det +1); orden de búsqueda antes de dibujar; GATE 1 con «procedencia: catálogo».
- **Por qué:** el redondeo ya se había inventado como propiedad del constructor y se perdió al cambiar de herramienta (anexo 00).
- **Causas que ataca:** 2 y 3, y la regla que empujaba a dibujar.
- **Cómo sabríamos que funcionó:** cero piezas redibujadas que ya existían; el control de cantos da cero cantos vivos en la zona de mano.

**3. Las marcas que más importan, convertidas en código (opinión).**
- **Qué:** control de cantos convexos; atrapamiento a lo largo del recorrido; largo de agarre de tornillos; página generada siempre leyendo del JSON. Cada uno con su par BIEN/MAL.
- **Por qué:** el 80 % de las reglas es texto (anexo 00), y (opinión) los controles con código son los únicos que se ejecutan sin acordarse.
- **Causas que ataca:** 3, 6 y el patrón «la lección como relato».
- **Cómo sabríamos que funcionó:** corridos sobre el virolador del 20/10, encuentran los defectos del banco sin que nadie los señale.

**4. Herramientas rápidas y edición incremental (opinión).**
- **Qué:**
  - `sim_rapida.py` pasa a ser herramienta, con poses de cinemática, las guardas de Manifold, la regla de paso y el cronómetro;
  - «malla para barrer, exacto para decidir»;
  - CATIA como segundo juez;
  - correcciones por parámetros, con diff y control de «lo demás no cambió»;
  - se reescribe la receta `fresca=True`.
- **Por qué:** dos causas eran de herramienta, y había reglas que se contradecían entre sí (anexo 00).
- **Causas que ataca:** 4 y 5.
- **Cómo sabríamos que funcionó:** menos de 2 min por barrido completo; una corrección chica se resuelve sin reabrir CATIA; el control «lo demás no cambió» queda verde.

**5. Dieta de la skill y lazo de aprendizaje medido (opinión).**
- **Qué:**
  - resolver las 5 contradicciones;
  - sacar la historia de `SKILL.md`;
  - un tope de lectura por fase;
  - registro de marcas;
  - banco de evals con el virolador;
  - comparación contra «sin skill»;
  - toda regla nueva entra con su control.
- **Por qué:** en general, más texto no mejora y encarece [84]; hay un estudio en contra [89] (§3.2). Y hoy nada mide si el sistema aprende.
- **Causas que ataca:** el patrón general y la 6.
- **Cómo sabríamos que funcionó:** la lectura por fase queda bajo el tope; sube el porcentaje de defectos que el sistema encuentra antes que vos; la batería sigue verde después de cada cambio.

## 11. Las preguntas que te deberías hacer

- ¿Querés que la IA diseñe el dispositivo entero, o que configure, verifique y documente mientras vos decidís el concepto? La evidencia de afuera respalda lo segundo.
- De tus últimos N dispositivos, ¿qué porcentaje de piezas se repitió? Sin ese dato, «biblioteca primero» es una suposición.
- ¿Qué versión de V5 y qué licencias tiene tu PC: KWA, KT1/PKT, KIN, DMU Space Analysis?
- ¿Necesitás CATIA para *diseñar*, o solo para medir y entregar? El §3 de la skill describe build123d y gmsh, no CATIA, y CATIA no traga mallas (anexo 00).
- ¿Cuántas horas y cuántas vueltas lleva hoy un dispositivo? Sin esa línea base, ninguna mejora se puede demostrar.
- ¿Qué cargas sostenidas, ciclos y temperaturas tiene cada puesto (hot melt, sol)? Con PLA y PETG en la A2L, eso decide dónde va metal.
- ¿Un dispositivo manual impreso cae bajo ISO 12100 o 13854? No encontré fuente que lo diga.
- Las piezas de tapizado son blandas: ¿el 3-2-1 sigue siendo tu regla?
- ¿Qué parte de las 35.000 palabras se leyó realmente el 20/10, y qué parte decidió algo?
- Si sacás la skill, ¿el próximo diseño sale peor? ¿Cuánto?
- ¿Quién revisa al revisor, y con qué casos lo calibrás?
- ¿Las patas regulables, para qué?
- ¿Podés imprimir una réplica de un STEP de catálogo? Las condiciones de TraceParts limitan el uso a diseño o visualización [44], y la réplica impresa no parece cubierta (lectura nuestra; conviene consultar).

## Fuentes

Los links de los frentes FDM y simulación vinieron sin prefijo de protocolo y así van.

**Crítica interna (archivos de la skill), anexo 00:**
- Archivos que cita la crítica interna: `SKILL.md`, `lecciones-caras.md`, `preguntas-antes-de-disenar.md`, `ficha-utillajes.md`, `ficha-fdm.md`, `utillajes-de-apriete.md`, `catia.md`, `enforcement-como-se-cerro.md`, `ROADMAP.md`, `DONDE_QUEDO.md` y `AUDITORIA_auditor.md`.
- No vino `ingenieria-de-producto.md`.
- La crítica está en `docs/investigacion-3d-2026-10-23/00_critica_interna_skill_y_virolador.md`.

**IA y CAD**
- [1] Self-Improving CAD Generation Agents with FEA as Feedback (Hephaestus) — https://arxiv.org/pdf/2605.17448 (también https://arxiv.org/html/2605.17448v2) — 27/05/2026 — abierta
- [2] CAD-bench (ICML 2026, workshop) — https://icml.cc/virtual/2026/67851 — 2026 — abierta
- [3] CADEngBench — https://arxiv.org/html/2608.09296v1 — ago 2026 — abierta (cortada; cifra 432/1.030 por resúmenes de terceros)
- [4] CADSmith (repo) — https://github.com/jabarkle/CADSmith — mar 2026 — abierta
- [5] Test-Time Scaling for CAD via Consensus — https://arxiv.org/pdf/2608.09706 — ago 2026 — abierta
- [6] ArtisanCAD — https://arxiv.org/abs/2607.05750 — jul 2026 — abierta
- [7] FunCAD — https://arxiv.org/abs/2610.26861 — 19/10/2026 — sin abrir
- [8] Parametric CAD Bench V3 — https://cadbench.ai/ — 24/09/2026 — abierta
- [9] BenchCAD — https://arxiv.org/html/2605.10865v1 — may 2026 — abierta (cortada)
- [10] MUSE — https://arxiv.org/html/2605.28579v2 — 04/06/2026 — abierta
- [11] CADGenBench vía BenchLM — https://benchlm.ai/benchmarks/cadgenbenchgeneration — 19/10/2026 — abierta
- [12] CADClamp — https://github.com/ChristianNHill/cadclamp — s/f — sin abrir
- [13] Text2CAD-Bench — https://arxiv.org/abs/2605.18430 — may 2026 — abierta
- [14] AssemCAD — https://arxiv.org/pdf/2607.05123 — 06/07/2026 — abierta
- [15] ArtiCAD — https://arxiv.org/html/2604.10992v1 — abr 2026 — abierta
- [16] AADvark — https://arxiv.org/abs/2604.15184 — may 2026 — abierta
- [17] CADWorld — https://arxiv.org/html/2609.16251v1 — ~sep 2026 — abierta
- [18] Mal uso de APIs en código generado — https://dl.acm.org/doi/10.1145/3728894 — s/f — sin abrir

**Copilotos comerciales**
- [19] Industrial AI in CATIA R2026x FD03 — https://blog.3ds.com/brands/catia/industrial-ai-catia-r2026x-fd03/ — 28/07/2026 — abierta
- [20] Best AI Tools for CATIA (Leo AI) — https://www.getleo.ai/blog/best-ai-tools-catia-2026 — ~abr 2026 — abierta
- [21] Zookeeper — https://zoo.dev/research/zookeeper — 05/02/2026 — abierta
- [22] Zoo FAQ — https://zoo.dev/docs/faq — s/f — abierta
- [23] catia-v5-mcp — https://github.com/AstroQuestStudio/catia-v5-mcp — s/f — abierta
- [24] PTC Creo — https://www.ptc.com/en/products/creo — ~oct 2026 — abierta
- [25] Autodesk, conector Claude–Fusion — https://www.autodesk.com/products/fusion-360/blog/how-to-improve-your-fusion-workflow-with-the-claude-desktop-connector/ — 29/06/2026 — abierta

**Proceso de utillajes**
- [26] Horizontal vs Vertical Toggle Clamps (Roche) — https://rocheclamp.com/blog/horizontal-vs-vertical-toggle-clamps/ — 05/05/2026 — abierta
- [27] 3D Printed Jigs and Fixtures (Omni3D) — https://omni3d.com/3d-printed-jigs-and-fixtures/ — 15/10/2026 — abierta
- [28] How to 3D Print In-House Jigs (Formlabs) — https://formlabs.com/white-papers/how-to-3d-print-in-house-jigs-fixtures-and-other-manufacturing-aids/ — s/f — abierta
- [29] DFM Reviewer — https://arxiv.org/abs/2609.05559 — 03/09/2026 — abierta
- [30] Poka-Yoke (LearnLeanSigma) — https://www.learnleansigma.com/guides/error-proofing-poka-yoke/ — 19/09/2026 — abierta
- [31] TICK — https://arxiv.org/abs/2410.03608 — oct 2024 — abierta
- [32] Hoffman, Jig and Fixture Design — https://vdoc.pub/documents/jig-and-fixture-design-5e-delmar-learning-drafting-75kji78va5s0 — s/f — abierta
- [33] ISO 13854 (Misumi) — https://www.misumi-techcentral.com/tt/en/lca/2016/04/234-safety-design---6-safety-design-knowledge-on-machinery--2.html — 2016 — abierta
- [34] Atlas Copco, The art of ergonomics — https://www.atlascopco.com/content/dam/atlas-copco/industrial-technique/general/documents/pocketguides/Pocket%20guide_the%20art%20of%20ergonomics.pdf — 2020 — abierta
- [35] jcproto, automotive fixtures — https://jcproto.com/new/automotive-assembly-fixtures.html — 21/09/2026 — abierta
- [36] Cross, Expertise in Professional Design — https://oro.open.ac.uk/54900/1/Expertise%20in%20Professional%20Design.preprint.pdf — s/f — sin abrir
- [37] Agile Stage-Gate (DTU) — https://backend.orbit.dtu.dk/ws/files/195528399/Agile_Stage_Gate_in_3_SMEs_preprint.pdf — 2020 — sin abrir
- [38] APQP Checklist 1.1 — https://pdfcoffee.com/apqp-checklist-reportversion-11dtd-131108-pdf-free.html — 2008 — sin abrir
- [39] DFMEA (LearnLeanSigma) — https://www.learnleansigma.com/guides/design-failure-mode-and-effects-analysis-dfmea/ — ~ago 2026 — sin abrir
- [40] Tan, Otto y Wood, ICED17 — https://www.designsociety.org/publication/39558 — 2017 — abierta (PDF por la página de descarga; esta pide membresía)
- [41] Rong et al., CAFD (SME) — (sin link) — 2010 — abierta

**Componentes y catálogos**
- [42] TraceParts Developer Hub — https://developers.traceparts.com/reference/developer-hub — 23/10/2025 — abierta
- [43] TraceParts, pedido de clave — https://developers.traceparts.com/docs/requesting-apikey — 29/12/2025 — abierta
- [44] TraceParts API Terms of Use — https://developers.traceparts.com/docs/api-terms-of-use — 25/09/2020 — abierta
- [45] McMaster-Carr API — https://www.mcmaster.com/help/api/ — 29/10/2019 — abierta
- [46] bd_warehouse v0.4.0 — https://github.com/gumyr/bd_warehouse/releases/tag/v0.4.0 — 07/10/2026 — abierta
- [47] bd_warehouse PR #87 — https://github.com/gumyr/bd_warehouse/pull/87 — 07/10/2026 — abierta
- [48] MakerWorld Terms — https://makerworld.com/en/user-agreement — 11/06/2024 — abierta
- [49] Printables Terms — https://www.prusa3d.com/page/terms-of-service-of-printables-com_231249/ — 15/10/2026 — abierta
- [50] Sturdy print-in-place draw latch — https://www.printables.com/model/130254-sturdy-print-in-place-draw-latch — 06/02/2022 — abierta
- [51] Misumi, formatos CAD — https://us.misumi-ec.com/guide/category/ecatalog/file.html — s/f — abierta
- [52] CADENAS eCatalog — https://partsolutions.com/ecatalog/ — s/f — abierta
- [53] Plugin 3Dfindit — https://3dfindit.freshdesk.com/en/support/solutions/articles/103000269048-plugin-3dfindit — s/f — abierta
- [54] PartCAD — https://github.com/partcad/partcad — s/f — abierta
- [55] TraceParts, toggle clamps — https://www.traceparts.com/en/search/traceparts-classification-mechanical-components-jig-and-fixture-construction-clamping-toggle-clamps?CatalogPath=TRACEPARTS%3ATP01007002004 — s/f — sin abrir

**FDM**
- [56] Bambu A2L specs — bambulab.com/en/a2l/specs — 2026 — abierta
- [57] Fischbach y Weinberg, creep de PLA — arxiv.org/pdf/2302.11240 — 16/08/2023 — abierta
- [58] Alagheband et al., creep de PETG — sciencedirect.com/science/article/abs/pii/S1350630725008611 — 2025 — abierta (resumen)
- [59] Amza et al., Polymers — https://pmc.ncbi.nlm.nih.gov/articles/PMC8659210/ — 2021 — abierta
- [60] CNC Kitchen, insertos en PETG — cnckitchen.com/blog/helicoils-threaded-insets-and-embedded-nuts-in-3d-prints-strength-amp-strength-assessment — 30/05/2020 — abierta
- [61] CNC Kitchen, insertos en PLA — cnckitchen.com/blog/threaded-inserts-for-3d-prints-cheap-vs-expensive — 2019 — sin abrir
- [62] Formlabs, Designing 3D Printed Jigs (SLA) — solidprint3d.co.uk/wp-content/uploads/2019/08/Jig-Fixture-Design_EN-Letter.pdf — 12/2017 — abierta
- [63] Markforged Composites Design Guide v1.4 — static.markforged.com/downloads/CompositesDesignGuide.pdf — ~2022 — abierta
- [64] Prusa, elephant foot — help.prusa3d.com/article/elephant-foot-compensation_114487 — s/f — abierta
- [65] Bambu PETG Basic TDS — store.bblcdn.com/s1/default/cb94589bf7994fdcbfa833badefae9cd/Bambu_PETG_Basic_Technical_Data_Sheet.pdf — V3.0 — abierta (la hoja de PLA vino con link truncado)
- [66] BambuStudio issue #2621 — github.com/bambulab/BambuStudio/issues/2621 — 08/06/2026 — abierta
- [67] Ultimaker, Setup to success — cimquest-inc.com/resource-center/Ultimaker/Setup_to_Success-3D_printing_for_manufacturers-CQ.pdf — s/f — sin abrir

**Simulación y edición**
- [68] Python mesh boolean benchmark — polydera.com/algorithms/python-mesh-boolean-libraries-2026 — 29/06/2026 — abierta
- [69] yapCAD PR 61 — github.com/rdevaul/yapCAD/pull/61 — 01/10/2026 — abierta
- [70] Manifold, clase (MinGap, status) — manifoldcad.org/docs/html/classmanifold_1_1_manifold.html — s/f — abierta
- [71] Manifold issue 1430 — (sin link) — s/f — abierta
- [72] trimesh.collision — trimesh.org/trimesh.collision.html — v5.1.1 — abierta
- [73] trimesh issue 2223 — github.com/mikedh/trimesh/issues/2223 — ~2024 — abierta
- [74] Swept volumes / poses discretas — arxiv.org/abs/2409.09918 — 2024 — abierta
- [75] build123d joints — build123d.readthedocs.io/en/stable/joints.html — v0.13.0 — abierta
- [76] build123d topology selection — build123d.readthedocs.io/en/stable/topology_selection.html — s/f — abierta
- [77] text-to-cad issue 371 — (sin link) — s/f — abierta
- [78] IBM APAR HD64346 — (sin link) — s/f — abierta
- [79] SPAWorkbench (V5Automation) — catiadesign.org/_doc/V5Automation/generated/interfaces/SpaceAnalysisInterfaces/interface_SPAWorkbench_36841.htm — s/f — abierta
- [80] CAAKiiMechanismCreation — https://catiadesign.org/_doc/V5Automation/online/CAAScdDmuUseCases/CAAKiiMechanismCreation.htm — 2001 — abierta
- [81] CAAKiiMechanismSolve — espejo catiadoc (sin link) — s/f — sin abrir

**Aprendizaje**
- [82] Demystifying evals for AI agents — https://anthropic.com/engineering/demystifying-evals-for-ai-agents — 09/01/2026 — abierta
- [83] Skill authoring best practices — https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices — s/f — abierta
- [84] Evaluating AGENTS.md — https://arxiv.org/abs/2602.11988 — v3 29/09/2026 — abierta (resumen)
- [85] SkillsBench — https://arxiv.org/abs/2602.12670 — v4 14/06/2026 — abierta (resumen)
- [86] LLMs Cannot Self-Correct Reasoning Yet — https://arxiv.org/abs/2310.01798 — oct 2023 — abierta
- [87] Experience-following — https://arxiv.org/abs/2505.16067 — 2025 — abierta (resumen)
- [88] Accumulated Behavioral Rules — https://arxiv.org/abs/2607.13091 — jul 2026 — abierta (resumen)
- [89] Lulla et al., AGENTS.md — arXiv 2601.20404 — 2026 — sin abrir
- [90] SkillEvolver — arXiv 2605.10500 — 2026 — sin abrir
- [91] NASA / GAO, lecciones aprendidas — https://www.gao.gov — 2001-2002 — sin abrir
- [92] METR uplift update — https://metr.org/blog/2026-02-24-uplift-update/ — 24/02/2026 — abierta

**Repos e implementación**
- [93] text-to-cad — https://github.com/earthtojake/text-to-cad — 20/10/2026 — abierta
- [94] build123d-mcp llms.md — https://github.com/pzfreo/build123d-mcp/blob/main/llms.md — s/f — abierta
- [95] build123d-mcp CHANGELOG (issues #452 y #488) — https://github.com/pzfreo/build123d-mcp/blob/main/CHANGELOG.md — 2026 — sin abrir
- [96] augura — https://github.com/pzfreo/augura — 20/10/2026 — abierta
- [97] jarvis-onshape-mcp — https://github.com/ReshefElisha/jarvis-onshape-mcp — 20/10/2026 — abierta
- [98] bambox — https://github.com/estampo/bambox — s/f — abierta
- [99] estampo — https://estampo.dev/ — s/f — sin abrir
- [100] Bambu, third-party integration — https://wiki.bambulab.com/en/software/third-party-integration — s/f — abierta
- [101] OrcaSlicer PR #16010 — https://github.com/OrcaSlicer/OrcaSlicer/pull/16010 — 30/09/2026 — abierta
- [102] OrcaSlicer discusión #8593 — https://github.com/OrcaSlicer/OrcaSlicer/discussions/8593 — dic 2025 — sin abrir
- [103] MDPI, configurador CAD-PLM — https://www.mdpi.com/2673-4052/7/5/146 — 17/09/2026 — abierta (resumen)
- [104] Kügler, revisión KBE — https://www.sciencedirect.com/science/article/abs/pii/S1474034623000204 — 2023 — abierta (resumen)

**CATIA**
- [105] pycatia — https://github.com/evereux/pycatia — 20/10/2026 — abierta
- [106] pycatia Relations — https://pycatia.readthedocs.io/en/latest/api/pycatia/knowledge_interfaces/relations.html — s/f — abierta
- [107] Knowledge Advisor R14 — https://catiadesign.org/_doc/docv5r14/Knowledge%20Advisor.pdf — s/f — sin abrir
- [108] IBM APAR HD70594 — https://www.ibm.com/support/pages/apar/HD70594 — s/f — sin abrir
- [109] IBM APAR HD59593 — https://www.ibm.com/support/pages/apar/HD59593 — s/f — sin abrir
- [110] Foro COE, PowerCopy por macro — https://www.coe.org/p/fo/et/thread=23458 — s/f — sin abrir
- [111] GoEngineer, CATIA V5 KBE — https://store.goengineer.com/products/catia-v5-knowledge-based-engineering — s/f — sin abrir
- [112] 3DS, catálogo EDU V5 — https://www.3ds.com/assets/edu/document/learning-experiences-for-catiav5.pdf — s/f — sin abrir
