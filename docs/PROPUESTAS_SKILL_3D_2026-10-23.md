# Propuestas para la skill de diseño 3D (para decidir el 23/10/2026)
Anexos: `docs/investigacion-3d-2026-10-23/` (índice en su `README.md`). En este documento, `.../` abrevia esa carpeta.

Salen del informe de investigación (`docs/INVESTIGACION_SISTEMA_3D_2026-10-23.md`) y de la crítica interna (`.../00_critica_interna_skill_y_virolador.md`) sobre los archivos reales de `.claude/skills/cad-design/`.
No se aplicó nada: la skill, la memoria y los pendientes quedan como estaban. Todo esto pasa por auditoría y lo decidís vos el viernes.

**Palabras que se repiten**
- **Freno (gate):** un control que corta la cadena si falla. El script termina con un código de error, igual que hoy `export_deliverables.py`.
- **Par BIEN/MAL:** dos casos armados a propósito, uno sano y otro con la falla, que el control corre en cada invocación. Si no los distingue, no juzga nada. Es lo que hace hoy `gate_aristas.py`, que sale con código 3.
- **Evidencia en el manifest:** lo que un control deja escrito en el `manifest.json` del workdir, atado a la firma del archivo (`file_signature()`) para que otro paso lo pueda leer.
- **Banco:** la batería de casos con defectos conocidos (`evals/banco/cad/`) contra la que se prueba cada cambio.

**Cómo están ordenadas.** El orden es por impacto: cuántas causas de raíz toca cada propuesta y cuántas otras destraba.
- P1 a P4 cambian *cuándo* se dispara el control, que es el patrón de raíz.
- P5 a P11 atacan una causa concreta del 20/10 o el lazo de aprendizaje.
- P12 a P14 son controles puntuales.

Las 5 del informe (§10) son paraguas; acá están partidas en piezas que se pueden decidir por separado. **★ marca la pieza central de cada una de las 5.** Las demás dicen de cuál salen.

`catia.md`, `DONDE_QUEDO.md`, `AUDITORIA_auditor.md` y los scripts no vinieron adjuntos a esta redacción. La crítica interna (`.../00_critica_interna_skill_y_virolador.md`) sí leyó `catia.md`, `DONDE_QUEDO.md` y `AUDITORIA_auditor.md`, y acá se citan a través de ella. Los scripts no figuran en la lista de lo que ese anexo leyó (`.../README.md`). Lo que se dice de ellos también se cita a través de la crítica.

El tamaño sigue la tabla «El tamaño del cambio decide el camino» de `.claude/rules/codigo-madre.md`:
- **Chico:** un archivo, el diff cabe en una oración y no cambia lo que ves vos.
- **Mediano:** varios archivos, o cambia un comportamiento, o toca un hook, un guardián o una regla.
- **Grande:** una feature, un refactor, algo del sistema Claude que usás a diario, o cualquier cosa sin un caso anterior que se pueda nombrar.
- Ante la duda, el camino más largo.

| P | Qué | Causas que ataca | De las 5 | Tamaño |
|---|---|---|---|---|
| P1 ★ | Fases con freno en el medio | patrón «controles en los extremos», 1, 6 | #1 | grande |
| P2 ★ | Constructores de la casa | 3, espejo de la 2, chaflán | #2 | grande |
| P3 ★ | Barrido con guardas y cronómetro | 4, contradicción lección 36 / 2 min | #4 | grande |
| P4 | Contrato = pliego del GATE P ampliado | 1, 6 | #1 | mediano |
| P5 | Catálogo con procedencia | 2, GATE 1 en contra | #2 | mediano (las herramientas de catálogo, grande) |
| P6 ★ | Control de cantos convexos | 3 | #3 | mediano |
| P7 | Toda marca termina en constructor, control o ítem | patrón «la lección como relato», 6 | #5 | grande |
| P8 | Revisor al cierre de cada fase, calibrado | 6, patrón 1 | #1 y #5 | grande |
| P9 | Corregir por parámetros, no rearmar | 5, guardado callado | #4 | grande |
| P10 ★ | Dieta de la skill y cinco contradicciones | patrón «80 % texto», patrón «verificador, no método» | #5 | grande |
| P11 | Banco del virolador y comparación «sin skill» | 6 («memoria, no detección») | #5 | grande |
| P12 | Atrapamiento a lo largo del recorrido | seguridad mal ubicada | #3 | mediano (con P3 ya hecho) |
| P13 | La página lee los números del JSON | 6 (rojo con regla escrita) | #3 | mediano |
| P14 | Largo de agarre y de rosca | hallazgo 4, patas M12 | #3 | mediano |

---

### P1. Fases con criterio de salida y un freno en el medio
**De las 5 del informe: ★ #1** (la parte de fases; el contrato es P4 y el revisor, P8).

- **Qué problema ataca:** el patrón de raíz «los controles están en los dos extremos» y los problemas 1 (estética antes del mecanismo) y 6.
  - **Evidencia, `.../00_critica_interna_skill_y_virolador.md`, causa 1:** `SKILL.md` §3 es «una fila de nueve pasos … sin criterio de salida entre uno y otro», y «el único freno duro está al final».
  - **Evidencia, `.../00_critica_interna_skill_y_virolador.md`, patrón:** «En el medio (elegir el concepto, armar el mecanismo, iterar) nada se dispara».
  - **Evidencia de afuera:** en Tan, Otto y Wood, ICED17 (https://www.designsociety.org/publication/39558), lo significativo es el costo: 13 veces más retrabajo, porque el error temprano se detecta tarde (informe §1).
  - **La regla ya existe como frase:** «regla de Fak 20/10: no se pasa de fase sin cerrar la anterior» (`DONDE_QUEDO.md`). Lo que falta es el mecanismo.
- **Qué cambia, exactamente:**
  - **`SKILL.md` §3:** los nueve pasos pasan a cinco fases, cada una con un criterio de salida en una línea que se pueda verificar (informe §8):
    - **0, contrato:** P4, con los GATE P, 0, 1 y 2 de hoy, que son de antes de modelar.
    - **1, concepto y búsqueda:** 2 o 3 alternativas con tabla de decisión, y búsqueda (P5). Lo de las alternativas queda como texto: ningún control lo verifica, y la falta «Alternativas de concepto» (`.../00_critica_interna_skill_y_virolador.md` §6) sigue abierta.
    - **2, mecanismo con geometría cruda:** sale con el barrido verde (P3) y el atrapamiento revisado (P12).
    - **3, detalle con constructores:** P2. Sale con los cantos convexos en verde (P6).
    - **4, fabricación y entrega:** GATE 3, GATE E y `export_deliverables`.
  - **La seguridad entra en las fases del mecanismo y del detalle,** no al final como pone tu plan («Estética y seguridad — DESPUÉS», `.../00_critica_interna_skill_y_virolador.md` §4; en `SKILL.md` no hay nada que sacar): el atrapamiento se revisa en la fase 2 y el canto en la 3.
  - **Control ejecutable:** cada cierre de fase deja evidencia en `manifest.json` con la `file_signature()` del modelo, como ya hacen `check_collision` y `gate_ensamble`.
    - Los pasos de la fase siguiente leen esa evidencia y salen con error si falta o si el modelo cambió después.
    - El freno que más importa: **si el conjunto tiene partes móviles, sin barrido verde sobre el conjunto vigente no corren los constructores de detalle ni el armado del PDF de entrega (`pdf_entrega`)**. Los constructores de mecanismo (como la palanca validada de P2) quedan habilitados en las fases 1 y 2.
    - Se puede saltear con `--reason`, que deja huella, igual que `--skip-gate`.
  - **El mismo chequeo va en `catia_base`,** la entrada que usan los scripts de `scripts/catia/` según la receta de `catia.md`. El 20/10 se diseñó por ahí, y un freno que solo esté en `cadlib` no lo habría visto.
  - **`cad-guard.sh`** hoy «solo RECUERDA los gates 1×/hora» (`.../00_critica_interna_skill_y_virolador.md` §3: «avisa por reloj, no por evento»). Hay que ver si puede recordar el cierre de fase cuando se pide un paso de la fase siguiente. Si no puede, queda como está: el freno real está en los scripts.
  - **El control mira el resultado (evidencia y firma), no el orden de los pasos:** «calificar el resultado y no el camino» (Anthropic, informe §4.1).
  - **Se puede volver atrás:** en la fase 1 se permite un boceto crudo para ajustar requisitos (informe §3.4, Cross y críticas a Stage-Gate, fuentes sin abrir).
- **Tamaño:** grande. Es una feature nueva (fases con freno) que cambia el método de toda la skill, no tiene caso anterior en la casa, y además toca un hook (`cad-guard.sh`).
- **Riesgo:**
  - Burocracia que frena un boceto legítimo.
  - Dispositivos sin partes móviles (posicionador, gancho, nidos): si el freno no se condiciona, van a vivir de `--reason` y el bypass se vuelve costumbre. Por eso corre solo si hay partes que se mueven, como en P5.
  - Que la IA llene las evidencias solo para pasar: en Hephaestus, 3 de los 9 aprobados arreglaron el contrato del chequeador y no la física (informe §4.6).
  - Que el camino CATIA quede afuera si no se toca `catia_base`.
- **Cómo se prueba:**
  - Par BIEN/MAL: un conjunto con barrido verde deja correr la fase 3; el mismo conjunto tocado después del barrido (otra firma) la frena.
  - Con el virolador: reproducir la secuencia del 20/10 (renders y PDF armados con el mecanismo sin cerrar) tiene que terminar con error porque falta la evidencia del barrido sobre el conjunto vigente, no por el orden de los pasos.
  - Indicador del informe §10.1, textual: «en el próximo dispositivo, antes de la entrega existen el barrido verde y las holguras medidas, y bajan tus marcas por fase respecto del virolador».
- **Depende de:**
  - P3: sin la herramienta de barrido, la fase 2 no tiene criterio de salida.
  - P4 y P2.
  - Tu decisión sobre cuántas fases hay y qué cierres firmás vos. El informe propone que apruebes el contrato y el mecanismo.

### P2. Constructores de la casa, iguales en build123d y en CATIA
**De las 5 del informe: ★ #2** (la parte de biblioteca; el catálogo es P5).

- **Qué problema ataca:** el problema 3 (clase (a) para los cantos), la parte del 2 que es integrar mal (el espejo) y el chaflán de cama.
  - **Evidencia, `.../00_critica_interna_skill_y_virolador.md`, causa 3:** «el redondeo es PROPIEDAD del constructor (`caja_tope_redondeado()` en el build)» (`utillajes-de-apriete.md`). «El 20/10 se modeló con `scripts/catia/`, donde no existe: la protección quedó en un proyecto, no en la biblioteca».
  - **El chaflán ya es regla** (`ficha-fdm.md` G6), pero nadie lo pone solo (informe §5).
  - **La jerarquía del informe §9.1** pone primero la «propiedad del constructor (imposible hacerlo mal)».
  - **Afuera:** AssemCAD hace que la IA escriba la especificación y que la geometría la construya código fijo (https://arxiv.org/pdf/2607.05123). Ojo: su salto es del sistema completo, sin aislar la biblioteca (informe §3.5).
- **Qué cambia, exactamente:**
  - **Un módulo nuevo de constructores** en `cadlib/` y su gemelo en `scripts/catia/` (nombre a definir), con la misma lista y los mismos parámetros:
    - placa con chaflán en la cara de cama (G6);
    - caja con canto redondeado (se sube `caja_tope_redondeado()` del build de agosto);
    - pata;
    - alojamiento de inserto (R6, R7);
    - la palanca validada del 20/10, con su armado de matriz det +1.
  - **Redondeo por defecto: R1,5** (`ficha-utillajes.md` E5, CASA; el radio publicado para la mano es SIN FUENTE). Para no redondear hay que pedirlo explícitamente, con un motivo que queda escrito. Es el patrón que ya usa `make_screw_nut.py --tuerca-baja "<motivo>"` (`ficha-fdm.md` R2).
  - **Cara de cama contra G6:** el constructor recibe la cara de cama como parámetro; ahí pone chaflán y no el R1,5. Como la cara de cama se decide en la fase 4 (`a_plano.py`), después del constructor, en la fase 3 queda declarada como provisoria y, si en la fase 4 cambia, la pieza se regenera con el constructor.
  - **Cada constructor lleva su par BIEN/MAL en un test,** como `test_fijaciones.py`.
  - **`SKILL.md`, fase 3:** toda caja, placa, pata o inserto sale del constructor, y hacer uno a mano exige anotar por qué.
  - **`utillajes-de-apriete.md`:** el enforcement del redondeo apunta al módulo, no al build de agosto.
  - (opinión, apoyada en `.../00_critica_interna_skill_y_virolador.md` §6: «"Profesional" es consistencia, no adorno») El aspecto profesional, que hoy no tiene estándar, queda en los radios y chaflanes por defecto, no en una regla de texto.
- **Tamaño:** grande. Es una feature nueva en dos entornos y no hay caso anterior de una biblioteca compartida entre build123d y CATIA.
- **Riesgo:**
  - En CATIA, el redondeo por COM va «arista por arista … más de 10 min» (`catia.md`). Hay que medir si el constructor CATIA puede evitarlo. Ninguna propuesta ataca hoy esa causa (3, clase (c)): queda abierta, y sin resolverla la mitad CATIA de los constructores no sale.
  - Que las dos versiones se separen con el tiempo.
  - Un error en un constructor se copia a todos los diseños.
  - Con build123d 0.13, `measure` y `validate` daban falsos fallos de validez hasta el 15/10 (informe §8, fuente sin abrir): hay que fijar versiones.
- **Cómo se prueba:**
  - Rearmar las cajas del virolador del 20/10 con los constructores y pasarles P6: cero cantos vivos en la zona de mano.
  - La palanca de la biblioteca, colocada en el conjunto, tiene que dar det +1 (eso habría evitado el hallazgo 1).
  - El mismo par BIEN/MAL para la versión build123d y la CATIA: si una pasa y la otra no, no se adopta.
  - ¿Habría evitado el problema? Los cantos, sí. La palanca dibujada de cero, solo si la búsqueda de P5 la encuentra.
- **Depende de:** tu decisión sobre con qué se diseña (contradicción 5, P10); el dato de cuántas piezas se repiten entre tus dispositivos (informe §11), que el informe pide antes de construir grande, igual que acá se pide para PartCAD; P6 para medir; P11 como batería.

### P3. El barrido del mecanismo como herramienta de la skill, con guardas y cronómetro
**De las 5 del informe: ★ #4** (la parte de herramientas rápidas; la edición incremental es P9).

- **Qué problema ataca:** el problema 4 (clase (a) + (c)) y la contradicción entre la lección 36 y el presupuesto de 2 minutos. Además destraba el criterio de salida de la fase 2 (P1).
  - **Evidencia, `.../00_critica_interna_skill_y_virolador.md`, causa 4:** la regla de los 2 minutos existía (`SKILL.md` §3bis), pero «nada mide el tiempo».
  - **La contradicción:** la lección 36 dice «el muestreo sobra», y el booleano exacto tarda «~5 min por posición».
  - **Las herramientas de hoy no alcanzan:** el GATE 6 gira alrededor de un solo eje, y `manifold3d` está instalado pero no figura en §1.
  - **Ya está hecho en el caso del virolador** (informe §5): `sim_rapida.py`, «65 posiciones en 4,5 s».
  - **Poses sueltas dejan pasar choques:** en un brazo robot, con 2 poses se pierde el 19,6 % y con 32 el 0,13 % (arxiv.org/abs/2409.09918).
  - **Mirar solo la pose final es un error típico:** los diseñadores «look at static CAD models in the locked position» (Roche, https://rocheclamp.com/blog/horizontal-vs-vertical-toggle-clamps/).
- **Qué cambia, exactamente:**
  - **`scripts/` de la skill:** `sim_rapida.py` pasa del caso del virolador a CLI de la skill. Hoy vive en `C:\Dev\_catia_practica\virolador_auto\sim_rapida.py`; el nombre final, a definir. Lleva:
    - **poses calculadas con la cinemática,** no un solo eje;
    - **guardas** (informe §3.8 y §8 fase 2), cada una contra una falla callada:
      - `status()` y malla estanca antes de cada booleano: con malla inválida, Manifold devuelve vacío;
      - lista declarada de contactos permitidos (pivotes, topes);
      - paso entre poses menor que la holgura: r·Δθ con 100 mm de radio y 5° da 8,7 mm;
      - `MinGap` (manifoldcad.org/docs/html/classmanifold_1_1_manifold.html);
      - «no decidible» cuando la holgura cae bajo la tolerancia de cuerda del teselado, que se informa al lado de cada holgura (APAR HD64346);
    - **par BIEN/MAL propio** en cada corrida, con código 3 si no separa.
  - **`SKILL.md` §3bis:** cierra la contradicción con «malla para barrer, exacto para decidir». La malla recorre todas las poses y el booleano exacto (lección 36) se usa solo en la pose crítica. `lecciones-caras.md` 36 suma una línea que remite ahí.
  - **Cronómetro:** el CLI mide su propio tiempo, avisa al pasar los 2 minutos y deja registro.
    - El cronómetro común para cualquier consulta 3D va en `cadlib.envcheck` y en `catia_base`.
    - Hoy envcheck solo verifica el intérprete, y falta confirmar que todos los CLIs pasen por ahí.
    - Los «~5 min por posición» del 20/10 corrieron en CATIA: un cronómetro solo en `cadlib` repetiría el punto ciego que P1 le marca a un freno «solo en `cadlib`».
  - **`SKILL.md` §1:** se agrega `manifold3d` a la lista del entorno.
  - **`SKILL.md` GATE 6:** se aclara que sirve para un solo eje y que los mecanismos de más de un eje usan la herramienta nueva.
  - **Herramientas:**
    - `manifold3d`, ya instalado;
    - trimesh `set_transform` y `CollisionManager` (trimesh.org/trimesh.collision.html);
    - segundo juez opcional en la pose crítica: SPAWorkbench Clashes/Distances por pycatia (catiadesign.org/_doc/V5Automation/generated/interfaces/SpaceAnalysisInterfaces/interface_SPAWorkbench_36841.htm).
  - **Antes de usar SPAWorkbench hay que probar dos cosas:** la licencia DMU (sin verificar) y que la documentación de pycatia, que es de R28, sirva en tu R21 (sin verificar).
- **Tamaño:** grande. Es una feature: el freno de la fase 2 de todo mecanismo.
  - La cinemática de lazo cerrado (cuatro barras, informe §8) no tiene caso anterior, y de `sim_rapida.py` se hereda solo el barrido.
  - El cronómetro común toca todos los CLIs.
  - Si se parte en dos (barrido con guardas por un lado, cronómetro por el otro), el barrido sigue siendo grande y el cronómetro, mediano: varios archivos, sin cambiar lo que frena.
- **Riesgo:**
  - Falsos «no choca» si se saltea una guarda.
  - Astillas con caras coincidentes que dan falsos choques: «< 5% of the time», issue 1430, aunque es la estimación de un usuario, no una medición (informe §3.8).
  - Muchas poses «no decidibles» por el piso de teselado.
  - Poses mal calculadas en un cuatro barras, que barren una trayectoria que no existe.
  - Los números de velocidad son de un vendedor y de cajas (informe §3.8).
- **Cómo se prueba:**
  - Sobre el conjunto del virolador del 20/10, el barrido completo tiene que bajar de 2 minutos y coincidir con el booleano exacto en las poses críticas.
  - Gemelo: el mismo conjunto con la palanca en espejo, o con una pieza corrida, tiene que hacer caer la curva.
  - Una malla rota a propósito tiene que dar «no medido», no «libre».
  - ¿Habría evitado el problema 4? Sí: es la herramienta que ese día bajó el tiempo a segundos, disponible desde el arranque.
- **Depende de:** si CATIA es segundo juez, de tu respuesta sobre la licencia DMU. P1 depende de esta propuesta.

### P4. Contrato corto antes del CAD: el pliego del GATE P ampliado
**De las 5 del informe: parte de #1.**

- **Qué problema ataca:** los problemas 1 y 6, y los requisitos como causa raíz mayor (ICED17, informe §1).
  - **Evidencia:** Hephaestus pide envolventes, interfaces y criterios de aceptación antes del CAD (https://arxiv.org/pdf/2605.17448).
  - `verify_spec` revalida la intención después de cada corrección (https://github.com/pzfreo/build123d-mcp/blob/main/llms.md).
  - En cadbench.ai, partir de planos da 84,66 contra 50,87 desde texto (https://cadbench.ai/; es una recompensa media).
  - Omni3D: «define the acceptance test before printing» (https://omni3d.com/3d-printed-jigs-and-fixtures/).
  - En la casa, el criterio de aceptación ya existe como G-E7 (`criterio_aceptacion.json`), pero en AVISO y al final (`SKILL.md`, GATE E).
- **Qué cambia, exactamente:**
  - **No se crea un formato nuevo:** se amplía el pliego de `gate_proceso.py`, que ya se verifica y ya exige las fuerzas por etapa (pliego v2). Se suman:
    - función;
    - envolvente;
    - interfaces: con qué toca y con qué holgura;
    - recorridos: de dónde a dónde va cada parte que se mueve;
    - zona de mano: las caras que toca el operario o la pieza del cliente (la usa P6);
    - ciclos y temperatura;
    - «qué ya existe» (sale de P5);
    - el criterio de aceptación en el formato `{que, con, acepta}` de G-E7, adelantado al inicio;
    - la referencia a un croquis acotado tuyo.
  - **`gate_proceso.py verificar` falla si faltan campos.** Vos firmás con evidencia en disco, como en el `--confirmar --quien --evidencia` del GATE 0.
  - **Después de cada corrección se revalida lo medible:** envolvente y holguras de interfaz.
    - Lo corre `gate_proceso.py verificar` contra los valores del pliego, llamado desde el control «lo demás no cambió» de P9 (en `catia_base` y en el helper de `cadlib`), así no depende de acordarse.
    - Es la idea de `verify_spec`, sin depender de build123d-mcp: está apagado, `verify_spec` es experimental y no ve filetes ni chaflanes.
  - **Archivos que se tocan:** `scripts/gate_proceso.py`, `SKILL.md` (GATE P y fase 0), y `ficha-utillajes.md` K1, que pasa a remitir al pliego.
  - **G-E7 en `procesoCanon.data.json`:** hay que decidir qué pasa si el criterio ya se exige al principio. Ojo: la revisión de G-E5 a G-E7 vence el 24/10.
- **Tamaño:** mediano. Son varios archivos, cambia el comportamiento de un gate y toca una regla (`SKILL.md`), pero hay caso anterior: el pliego v2 y G-E7.
- **Riesgo:**
  - Que se vuelva otro formulario largo.
  - Que firmes sin leer.
  - Que se llenen campos sin contenido: «La máquina puede MATAR un dato, nunca APROBARLO».
  - Que se vuelva rígido: Cross dice que los diseñadores con experiencia definen problema y solución juntos (fuente sin abrir). Por eso el contrato se puede reabrir, con huella.
- **Cómo se prueba:**
  - Escribir a posteriori el contrato del virolador y ver si tenía los campos que fallaron: el recorrido del cuatro barras, la palanca existente como «qué ya existe», y la placa de 15 mm como interfaz de las patas.
  - Gemelo: un pliego sin recorridos para un dispositivo con partes móviles tiene que dar rojo.
- **Depende de:** P5 (el campo «qué ya existe»); P9 (el punto desde donde se revalida); tu decisión sobre qué campos firmás y si vas a traer croquis acotado.

### P5. Catálogo antes que dibujo, con procedencia y protocolo de integración
**De las 5 del informe: parte de #2.**

- **Qué problema ataca:** el problema 2 y una regla que juega en contra.
  - **Evidencia, `.../00_critica_interna_skill_y_virolador.md`, causa 2:** el GATE P (c) solo mira «lo que Barack ya tiene fabricado y andando».
  - **La pregunta llegó tarde:** la de catálogo (`preguntas-antes-de-disenar.md`, grupo 5) está fechada «Fak, 20/10/2026», o sea, después del error.
  - **La regla en contra:** el GATE 1 deja sin fuente válida a cualquier pieza comprada. Lo admite el propio `SKILL.md`: «para un rodamiento comprado no hay fuente válida posible».
  - **Al integrarla quedó en espejo:** «det = −1» (hallazgo 1), y la asignación mango/brazo no tiene respaldo (hallazgo 5).
  - **Hay vías concretas** (informe §2.5, §3.6, §4.9):
    - Misumi baja CATIA V5 nativo (https://us.misumi-ec.com/guide/category/ecatalog/file.html);
    - plugin 3Dfindit (https://3dfindit.freshdesk.com/en/support/solutions/articles/103000269048-plugin-3dfindit);
    - API de TraceParts (https://developers.traceparts.com/reference/developer-hub);
    - bd_warehouse 0.4.0 (https://github.com/gumyr/bd_warehouse/releases/tag/v0.4.0).
- **Qué cambia, exactamente:**
  - **`SKILL.md`, GATE 1:** «procedencia: catálogo» pasa a ser fuente válida de cota.
    - Exige archivo bajado, fabricante, código, fecha, y cotas medidas antes de diseñar alrededor.
    - Cierra la contradicción «cotas medidas o catálogo» y el hueco de «Lo que los gates NO cubren».
  - **`core-prohibiciones` #1:** el GATE 1 la extiende, así que se toca junto con él. Si no, quedan dos reglas que se contradicen.
  - **`gate_proceso.py verificar`, parte (c):** si hay piezas que se mueven, el pliego tiene que declarar la búsqueda en este orden (informe §8), o da rojo:
    1. `indice_dispositivos.py` y los constructores de P2;
    2. bd_warehouse;
    3. catálogo comercial, a una carpeta interna, en STEP antes que STL;
    4. repos imprimibles, solo como idea;
    5. de cero, con motivo.

    Convierte en control la pregunta ⊕ del grupo 5.
  - **Protocolo de integración (control ejecutable):** toda pieza de afuera se coloca con una matriz de determinante +1 (con −1 da rojo: es un espejo) y se declara qué sólido es cuál. Corre como guarda del barrido de P3 y de `catia_base`, así se dispara solo, antes de barrer.
  - **`ficha-utillajes.md`:** distingue lo comercial, que trae carga nominal, de lo de comunidad, que no trae ensayo y tiene licencia a revisar. La fuerza real de un sargento es el 30-50 % de la nominal (Roche).
  - **Qué probar antes de usar las herramientas:**
    - bd_warehouse pide build123d ≥ 0.12.0: hay que ver qué versión tiene `.venv-cad`;
    - 3Dfindit con CATIA V5: sin probar;
    - la clave de TraceParts se pide por formulario y tarda días (https://developers.traceparts.com/docs/requesting-apikey).
- **Tamaño:** mediano para el cambio de GATE 1, la búsqueda en el GATE P y el control det +1: son varios archivos, cambia el comportamiento de dos gates y toca una regla (`core-prohibiciones`), con caso anterior en el GATE 1 y el GATE P de hoy. Las herramientas de catálogo se prueban aparte, y adoptarlas es grande: no hay caso anterior en la casa.
- **Riesgo:**
  - **Licencias:** TraceParts permite usar los datos «only … for the purposes of computer-aided design or viewing», sin redistribuir; imprimir una réplica no está cubierto (https://developers.traceparts.com/docs/api-terms-of-use).
  - **Las descargas piden tu email, nombre y empresa.**
  - **«Biblioteca primero» está menos probado de lo que suena:** en ArtiCAD, 3,37 contra 3,41; en Rong et al., aplicación industrial «very limited» (informe §3.5).
  - **Una cota de catálogo mal medida entra como dato válido.**
- **Cómo se prueba:**
  - Con el virolador: si el pliego hubiera exigido declarar la búsqueda, la palanca «ya existía hecha y probada» tenía que aparecer en los pasos 1 a 3.
  - El control det +1 sobre el armado del 20/10 tiene que dar rojo, porque ahí dio −1.
- **Depende de:** tus decisiones sobre qué fuentes se permiten, quién baja los archivos y si se imprime algo de catálogo; P2 (paso 1 de la búsqueda); P3 (donde corre la guarda); la pregunta del informe sobre cuánto se repite entre dispositivos.

### P6. Control de cantos convexos en la zona de mano
**De las 5 del informe: ★ #3.**

- **Qué problema ataca:** el problema 3, clase (a): la regla existía y nada la disparó.
  - **Evidencia, `.../00_critica_interna_skill_y_virolador.md`, causa 3:** «`gate_aristas.py` caza "concentradores **cóncavos**" (fatiga). Los cantos que cortan la mano son **convexos**, y ningún control los mira».
  - **La regla existe:** `ficha-utillajes.md` E5, «Ningún canto que toque la mano … sin redondear».
  - **La pregunta está enterrada:** es la n.º 60 de 60.
  - **Afuera:** avisos y listas son controles «generally weaker than physical or system controls» (https://www.learnleansigma.com/guides/error-proofing-poka-yoke/).
- **Qué cambia, exactamente:**
  - **`scripts/gate_aristas.py`:** un modo nuevo que lista las aristas **convexas** sin radio, o con radio menor que el de la casa (R1,5, E5), en las caras que toca la mano o la pieza del cliente.
  - **Reutiliza lo que ya funciona:** la topología OCC que ya decide la concavidad en ese gate, con la normal y el signo de la tangente corregidos en 2026-08-09 (`enforcement-como-se-cerro.md`).
  - **La zona de mano sale del pliego** (campo nuevo de P4), porque dónde aprieta el operario es dato del proceso (U9).
    - Si no está declarada, se toman todas las caras exteriores, y ahí los falsos positivos masivos son seguros, no un riesgo.
    - Por eso el campo es obligatorio en el pliego.
  - **Lleva par BIEN/MAL propio:** una caja con un canto vivo contra una redondeada, con código 3 si no separa.
  - **Corre al cierre de la fase 3** y como condición en `export_deliverables.py`.
  - **`SKILL.md` GATE 3:** la descripción deja de prestarse a leerlo como «control de aristas» completo.
- **Tamaño:** mediano. Toca varios archivos (un gate, una condición de entrega y `SKILL.md`) y cambia lo que frena, con caso anterior: el modo cóncavo del mismo `gate_aristas.py`.
- **Riesgo:**
  - **Falsos positivos:** la cara de cama lleva chaflán y no filete (G6), y hay aristas que nadie toca. Un control que molesta se termina desactivando: es lo que pasó con G-E3b, en `enforcement-como-se-cerro.md`.
  - **El umbral no tiene fuente externa:** R1,5 es de la casa.
  - **Falta decidir si un chaflán cuenta como «no vivo».**
- **Cómo se prueba:**
  - Sobre las cajas del virolador del 20/10 tiene que marcarlas; sobre los topes redondeados de la v16, no.
  - El gemelo es la falla real de esa geometría (lección 28): una caja nueva que nace con canto vivo en la misma pasada, como las orejas del 18/08.
  - ¿Habría evitado el problema? El canto vivo no habría llegado a la entrega.
- **Depende de:** P4 (el campo «zona de mano» del pliego); tu decisión sobre el radio y sobre si la primera semana frena o solo avisa.

### P7. Toda marca termina en constructor, control o ítem de checklist, con registro
**De las 5 del informe: parte de #5.**

- **Qué problema ataca:** el patrón de raíz «cada lección se escribe donde nació, como relato», y el problema 6.
  - **Evidencia, `.../00_critica_interna_skill_y_virolador.md`, patrón:** «Tres de los seis problemas tenían la regla escrita (cantos, 2 minutos, número leído del JSON)».
  - **Lo aprendido el 20/10 quedó escondido:** alrededor de la palabra 11.000 de `catia.md`, debajo de una receta que dice lo contrario (`.../00_critica_interna_skill_y_virolador.md` §3).
  - **La semilla ya existe:** «Una corrección nueva se aplica a la CLASE» (`utillajes-de-apriete.md`).
  - **Afuera:** convertir cada corrección en una regla con ID dio 0 % de reincidencia en 11 sesiones, pero en un solo despliegue y sin grupo de control (https://arxiv.org/abs/2607.13091).
  - **El riesgo de guardar todo:** «inaccuracies in past experiences compound» (https://arxiv.org/abs/2505.16067).
- **Qué cambia, exactamente:**
  - **La regla de salida (informe §9.1) vive en el registro y en el chequeo, no como texto de lectura.** Ponerla arriba de `SKILL.md` sería el sexto «antes» de los cinco que ya compiten (`.../00_critica_interna_skill_y_virolador.md` §3). Toda marca (tuya, del auditor o de la primera pieza impresa) se convierte en lo primero que se pueda de esta lista:
    1. propiedad de un constructor (P2);
    2. control con par BIEN/MAL en la fase donde ocurre;
    3. ítem sí/no en la checklist de esa fase (P8).
  - **El relato va a un solo archivo de «por qué»** (informe §9.1), que sale de la lectura obligatoria (P10). Hoy hay dos candidatos, `lecciones-caras.md` y `enforcement-como-se-cerro.md`, y queda uno.
  - **Registro de marcas** en `data/` de la skill (nombre y formato a definir).
    - Campos: fecha, quién marcó, fase, clase (a/b/c), salida elegida, archivo donde quedó y fecha de revisión.
    - La fecha vive ahí, no en el texto (P10).
    - `ficha-utillajes.md` K5 manda la primera pieza impresa a ese mismo registro.
  - **Control:** cada vez que se toca la skill, junto con el banco (P11), un chequeo falla si una regla o lección nueva no trae salida, origen y fecha de revisión en el registro (informe §9.6).
  - **Indicador:** marcas tuyas por diseño, y qué porcentaje encontró el sistema antes que vos (informe §9.2). Reemplaza al «26/30» de exámenes escritos por otra IA.
- **Tamaño:** grande. Es una feature (registro más chequeo) que cambia cómo aprende la skill, y no tiene caso anterior en la casa.
- **Riesgo:**
  - Que el registro no se llene: no tiene disparador propio, nada lo llena cuando marcás algo, y el chequeo solo mira que una regla nueva traiga sus campos.
  - Que todo termine como ítem de checklist, que es lo más barato, en vez de constructor o control.
  - Que la clase (a/b/c) se ponga a ojo.
- **Cómo se prueba:** pasar por la regla las marcas del 20/10 y los 4 rojos del auditor. Cada una tiene que terminar en algo ejecutable:
  - cantos → P2 y P6;
  - espejo → P5;
  - números tipeados → P13;
  - guardado callado → P9;
  - tornillo corto → P14;
  - conjunto sin la parte fija → diff de P9.

  Si alguna solo puede quedar como texto, se dice.
- **Depende de:** P11 para verificar que cada salida frena de verdad; tu decisión sobre quién anota las marcas (vos, o la IA y vos confirmás) y sobre cuál es el archivo de «por qué».

### P8. Revisor al cierre de cada fase, con checklist corta de sí/no y calibrado
**De las 5 del informe: parte de #1 y de #5.**

- **Qué problema ataca:** el problema 6 y el patrón «controles en los extremos».
  - **Evidencia, `.../00_critica_interna_skill_y_virolador.md`, causa 6:** G-E4 corre «después del GATE E verde» y es «sin gate automático».
  - **El espejo no lo cazó ningún cierre de fase:** «el espejo lo cazó el auditor» (`DONDE_QUEDO.md`), que encontró 4 rojos medidos.
  - **Afuera:**
    - en CADSmith, la mayor parte de la mejora la aporta el juez aparte, pero la mediana casi no cambia (0,55 → 0,48) y hay una pieza que pasó todos los controles y estaba mal (https://github.com/jabarkle/CADSmith);
    - en DFM Reviewer, otro agente verifica cada edición (https://arxiv.org/abs/2609.05559);
    - con TICK, las checklists de sí/no *generadas para cada instrucción* mejoran la autocorrección, +7,8 % (https://arxiv.org/abs/2410.03608; informe §3.3). Las de P8 son fijas por fase y escritas a mano, así que TICK las apoya solo en parte;
    - sin feedback externo, los modelos «struggle to self-correct» (https://arxiv.org/abs/2310.01798).
- **Qué cambia, exactamente:**
  - **`scripts/revision_ciega.py`,** que hoy arma el expediente de G-E4 al final, recibe `--step <pieza>` y sale siempre con 0, pasa a:
    - aceptar la fase, la checklist de esa fase y el conjunto, no solo una pieza;
    - escribir evidencia con firma en el manifest (la respuesta y qué se hizo con cada objeción), que es lo que lee el cierre de fase de P1. Sin esa evidencia, la fase siguiente no corre: así deja de ser «sin gate automático».
    - El revisor recibe el modelo, los renders y las mediciones, sin el razonamiento.
    - La pregunta es la de G-E4 adaptada: «¿qué ves mal antes de pasar de fase?».
  - **Checklists por fase,** de 10 ítems de sí/no como máximo (opinión de `.../00_critica_interna_skill_y_virolador.md` §6), solo con lo que no pudo pasar a constructor o control (P7).
    - Viven en `preguntas-antes-de-disenar.md`, reorganizado: los 8 grupos quedan para la fase 0, y lo de concepto, mecanismo y fabricación se ordena por fase.
    - Ojo con el tope de P10: el archivo tiene ~3.800 palabras; cada fase lee solo su parte.
  - **Calibración:** el revisor no se usa si no vuelve a encontrar los defectos del virolador en el banco. Es el mismo criterio que el GATE A, que «no juzga una pieza nueva sin calibración vigente».
  - **Gemelo de cada ítem:** se le da un diseño viejo con el defecto puesto; si sigue verde, el ítem está mal escrito.
  - **El cierre de fase de P1 incluye la revisión:** lee la evidencia del revisor. Después aprobás vos.
- **Tamaño:** grande. Es una feature: el revisor pasa a frenar cada cierre de fase, y no hay caso anterior de un revisor que frene, porque hoy G-E4 sale siempre con 0. Además reorganiza un archivo de lectura obligatoria.
- **Riesgo:**
  - Costo y tiempo: la revisión por la API sale ~US$ 0,30 (`preguntas-antes-de-disenar.md`).
  - Objeciones sin fuente: lo que el revisor afirma sin fuente se verifica antes de usarlo.
  - Si revisor y diseñador son el mismo modelo, comparten puntos ciegos.
  - Que el diseñador aprenda la checklist y la conteste de memoria. Por eso hacen falta chequeos ocultos y muestreo humano (informe §9.7).
- **Cómo se prueba:** darle al revisor el estado del virolador al cierre del mecanismo, sin razonamiento. Tiene que encontrar el espejo y el tornillo que no toma la tuerca, lo mismo que encontró el auditor. Si no, no se usa.
- **Depende de:** P11 (calibración), P1 (fases) y P7 (qué queda como ítem).

### P9. Corregir por parámetros, no rearmar: reescribir la receta de `catia.md`
**De las 5 del informe: parte de #4.**

- **Qué problema ataca:** el problema 5 y el guardado que «falló callado» (un rojo del auditor que tenía regla escrita).
  - **Evidencia, `.../00_critica_interna_skill_y_virolador.md`, causa 5:** la receta, paso 2, manda `catia_base.correr(..., fresca=True)`.
  - **La regla contraria quedó al fondo del mismo archivo:** «No rearmar desde cero», sin tocar la receta.
  - **CATIA empuja a regenerar:** un `SaveAs` puede dejar «el archivo ESCRITO pero ROTO».
  - **El modo de falla de editar** es «edit the requested feature while changing unrelated parts» (informe §3.7).
  - **build123d elige caras por geometría,** no por nombre (build123d.readthedocs.io/en/stable/topology_selection.html).
  - **jarvis-onshape-mcp** devuelve un diff con cada cambio (https://github.com/ReshefElisha/jarvis-onshape-mcp).
  - **Para corregir alcanzaría con cambiar parámetros por COM y actualizar** (opinión del informe §4.8, sin probar).
- **Qué cambia, exactamente:**
  - **`reference/catia.md`, «Receta»:**
    - CATIA recién abierta solo para el primer armado;
    - las correcciones cambian parámetros por COM y actualizan;
    - «No rearmar desde cero» sube a la receta.
  - **Control «lo demás no cambió»:** antes y después de cada corrección se registra, por pieza, la caja, el volumen y el número de sólidos.
    - Si cambió algo que la corrección no nombró, frena y lo muestra.
    - Corre en `catia_base` y en los builds de build123d, que regeneran desde `params.json` (`.../00_critica_interna_skill_y_virolador.md` aclara que regenerar por script no es el problema).
    - Los builds no tienen un punto de entrada común: cada uno es un script de proyecto, como `examples/posicionador/build_v2b.py`. Por eso hace falta un helper en `cadlib` que cada build tenga que llamar.
  - **Guardado verificado en `catia_base`:** después de cada `SaveAs` reabre el archivo y compara firma y volumen; si no coinciden, error ruidoso. Convierte en control la regla «Después de un guardado con excepción se reabre el archivo».
  - **Herramientas:**
    - pycatia (https://github.com/evereux/pycatia; 371 ★, MIT, se declara «alpha»);
    - de catia-v5-mcp se copia el patrón de informar el cambio de volumen por operación, no se instala (https://github.com/AstroQuestStudio/catia-v5-mcp; 0 ★, probado en R19 en francés).
- **Tamaño:** grande. Editar por COM no tiene caso en la casa: el informe lo da como opinión y dice que no hay benchmark de COM. Además toca la receta, la base de CATIA y un helper nuevo en `cadlib`.
- **Riesgo:**
  - El modelo vivo acumula estado roto: por eso se rehacía, y «muchas mediciones en una misma sesión la tumban».
  - Los controles nuevos suman mediciones: el antes/después por pieza y la reapertura después de cada `SaveAs` son justo lo que «tumba» CATIA.
  - Las caras elegidas por geometría pueden cambiar al cambiar una cota.
  - La caché `gen_py` vieja hace «desaparecer» métodos (fuente sin abrir).
  - Hay que probar cada llamada COM nueva contra CATIA real: no hay benchmark de modelos escribiendo COM.
- **Cómo se prueba:**
  - Repetir una corrección chica del 20/10: se tiene que resolver sin reabrir CATIA, y el diff tiene que mostrar que solo cambió esa pieza.
  - Gemelo: una corrección que mueve otra pieza sin querer tiene que frenar.
  - Forzar un `SaveAs` que falla tiene que dar error visible, no silencio.
  - El conjunto guardado sin la parte fija tiene que saltar por el número de sólidos.
- **Depende de:** tu decisión sobre con qué se diseña (P10); la versión de V5 de tu PC (R21, sin verificar).

### P10. Dieta de la skill y las cinco contradicciones resueltas
**De las 5 del informe: ★ #5** (la parte de dieta; el lazo de aprendizaje es P7 y P11).

- **Qué problema ataca:** el patrón «80 % es solo texto» y el patrón «la skill es un verificador de piezas, no un método para diseñar mecanismos».
  - **Evidencia, `.../00_critica_interna_skill_y_virolador.md` §3:** ~210 reglas, ~170 solo texto, y ~35.000 palabras para leer «ANTES de modelar».
  - **Orden roto:** «## 4» va antes de «## 0».
  - **Un bloque ajeno:** el `paso0` habla de formularios del SGC, no de 3D.
  - **Una remisión rota:** `ROADMAP.md` remite a un «SKILL.md §1bis» que vive en `reference/build123d-mcp.md`.
  - **Estados con fecha que se van a pudrir:** «revisar el 24/10».
  - **Cinco «antes» que compiten.**
  - **Afuera:**
    - AGENTS.md «does not generally improve task success rates, while increasing inference cost by over 20%» (https://arxiv.org/abs/2602.11988);
    - skills enfocadas rinden más que las exhaustivas (SkillsBench, https://arxiv.org/abs/2602.12670);
    - SKILL.md de menos de 500 líneas y evals antes que documentación (https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices);
    - en contra hay un estudio con −28,64 % de tiempo (fuente sin abrir): lo que decide es qué se pone.
- **Qué cambia, exactamente:**
  - **`SKILL.md`:**
    - cuerpo por fases (P1). El tope de 500 líneas ya se cumple (ronda las 450, conteo aproximado de `.../91_refutacion_de_las_propuestas.md`) y no obliga a podar nada: el que muerde es el de palabras por fase;
    - la historia (agujeros cerrados, hipótesis caídas, el «LIMITE CONOCIDO de G-E2») pasa al archivo único de «por qué» de P7;
    - se ordenan las secciones;
    - el `paso0` sale de esta skill (adónde va lo decidís vos). Está entre los marcadores `<!-- paso0:inicio/fin -->`, señal de que lo inyecta un script: si se borra a mano puede volver solo, así que primero hay que encontrar el inyector;
    - los estados AVISO o freno quedan solo en `procesoCanon.data.json`, sin fecha en el texto.
  - **`ROADMAP.md`:** se corrige la remisión a §1bis.
  - **§5 deja de mandar leer todo:** cada fase nombra sus 1 o 2 archivos, con un tope de lectura del orden de 2.000 palabras (opinión del informe §9.8). Un chequeo cuenta las palabras por fase y falla si se pasa; corre con el banco cuando se toca la skill.
  - **Poda (informe §9.8, opinión):** una regla que en varios diseños no frenó nada pasa a archivo. El registro de P7 dice cuáles.
  - **Las cinco contradicciones, cada una con una decisión tuya:**
    1. **Tres o cuatro apoyos:** el GATE A da rojo con más de tres, y U8 manda cuatro. Si el GATE A pasa a freno en la revisión del 24/10, la v16 aceptada da «ROJO por la letra». El informe §3.13 sugiere revisar el 3-2-1 rígido para piezas blandas (opinión).
    2. **Booleano exacto o 2 minutos:** se resuelve en P3.
    3. **Cotas medidas o catálogo:** P5.
    4. **`fresca=True` o «no rearmar»:** P9.
    5. **Con qué se diseña:** §3 dice build123d y gmsh, y el 20/10 fue CATIA. Si entra el diseño de mecanismos, la `description` del frontmatter («importar … medirlo … verificar interferencia») tiene que decirlo.
- **Tamaño:** grande. Es un refactor del archivo principal de la skill y cambia qué se lee en cada diseño.
- **Riesgo:**
  - Al podar, perder una regla que sí importaba.
  - Referencias rotas desde scripts y hooks que citan secciones.
  - Que la IA lea menos y se le escape algo que el texto cubría.
  - El tope de ~2.000 palabras por fase implica reescribir `catia.md` (~11.000) y `lecciones-caras.md` (~9.000), y eso no está contado en el tamaño de nadie.
- **Cómo se prueba:**
  - Correr el banco (P11) antes y después: no puede empeorar.
  - Grep de remisiones rotas.
  - Contar palabras por fase.
  - ¿Habría evitado algo del virolador? De forma indirecta: la receta `fresca=True` y la nota contraria no habrían convivido en el mismo archivo.
- **Depende de:** P1 (la estructura); P7 (el archivo de «por qué»); tus cinco decisiones; P11.

### P11. Banco de evals con el virolador y comparación contra «sin skill»
**De las 5 del informe: parte de #5.**

- **Qué problema ataca:** «todos nacieron DESPUÉS de que una persona encontrara el bug … demuestran memoria, no capacidad de detección» (`SKILL.md` §0). Hoy nada mide si el sistema aprende.
  - **Evidencia, `.../00_critica_interna_skill_y_virolador.md` §7.2:** el único indicador es un examen escrito por otra IA.
  - **Anthropic** pide 20 a 50 tareas de fallas reales y varias corridas por tarea (https://anthropic.com/engineering/demystifying-evals-for-ai-agents).
  - **La sensación de ir rápido no prueba nada** (METR, https://metr.org/blog/2026-02-24-uplift-update/).
  - **En Hephaestus,** 3 de los 9 aprobados trampearon al chequeador (informe §4.6).
- **Qué cambia, exactamente:**
  - **`evals/banco/cad/`** (ya existe; se corre con `node scripts/_evalBanco.mjs --banco cad-design`) suma el virolador del 20/10 con sus seis defectos conocidos:
    - palanca de cero;
    - cantos vivos;
    - espejo;
    - tornillo corto;
    - números tipeados;
    - conjunto guardado sin la parte fija.
  - **Cada propuesta de este documento se prueba contra ese caso** antes de aplicarse.
  - **Se agrega la corrida «sin skill»,** el mismo modelo sin la guía: si sale igual, la guía sobra (informe §9.5).
  - **Una parte del banco queda oculta** para la IA que diseña.
  - **Línea base por dispositivo:** horas, vueltas y marcas (informe §4.14).
- **Tamaño:** grande. Sumar el caso solo sería mediano, porque el banco ya existe. Pero la corrida «sin skill», con parte oculta y varias corridas por tarea, no tiene caso anterior en la casa.
- **Riesgo:**
  - Con un solo caso la skill aprende el virolador y no el oficio.
  - Hace falta que los archivos del 20/10 (`DONDE_QUEDO.md`, `AUDITORIA_auditor.md`, los modelos) estén completos.
  - Costo de las varias corridas.
  - La comparación «sin skill» puede obligar a decisiones incómodas, y para eso está.
- **Cómo se prueba:** con la skill de hoy, el banco tiene que dar rojo en los defectos que hoy se escapan. Si da verde, el caso está mal armado: es el valor gemelo aplicado al banco.
- **Depende de:** ninguna otra propuesta; es la base. Tu decisión sobre cuántos casos más se suman.

### P12. Atrapamiento a lo largo del recorrido
**De las 5 del informe: parte de #3.**

- **Qué problema ataca:** la seguridad mal ubicada.
  - **Evidencia, `.../00_critica_interna_skill_y_virolador.md` §4:** tu plan pone «Estética y seguridad — DESPUÉS», y «el atrapamiento se decide en la fase del mecanismo».
  - **Hoy es texto:** «ningún punto de ATRAPAMIENTO de dedos» (`preguntas-antes-de-disenar.md`, grupo 4).
  - **Afuera:** ISO 13854 da 25 mm para el dedo y 100 mm para la mano, pero solo cubre aplastamiento, no cizalla ni arrastre (https://www.misumi-techcentral.com/tt/en/lca/2016/04/234-safety-design---6-safety-design-knowledge-on-machinery--2.html).
- **Qué cambia, exactamente:**
  - **El barrido de P3 suma una salida:** por cada par de partes, la luz mínima a lo largo del recorrido, marcando las que se cierran por debajo de 25 mm (dedo) y de 100 mm (mano), con la pose.
  - **Los contactos declarados como intencionales se reportan igual, aparte:** la lección 36 enseña que «la zona que un control excluye a propósito queda sin control».
  - **Cizalla y arrastre:** el informe §8 los pide además del aplastamiento, pero no hay número de fuente para ellos (ISO 13854 solo cubre aplastamiento). Por ahora la salida los marca como no cubiertos y quedan pendientes, no resueltos.
  - **Corre al cierre de la fase 2.** La viñeta del grupo 4 remite al control.
- **Tamaño:** mediano, si P3 ya está hecho. Es una salida más del barrido, cambia un comportamiento y toca dos archivos (la herramienta de P3 y `preguntas-antes-de-disenar.md`). Si se arma junto con P3, entra en el grande de P3.
- **Riesgo:**
  - Todo mecanismo de apriete se cierra por definición, así que va a haber muchos avisos. Por eso arranca como aviso para que lo revises vos, no como freno, hasta medir los falsos positivos.
  - No hay fuente que diga si un dispositivo manual impreso cae bajo ISO 12100 o 13854 (informe §11).
- **Cómo se prueba:**
  - En el cuatro barras del virolador tiene que listar las luces que se cierran entre brazo, mango y base.
  - Gemelo: una versión con un hueco que se cierra a menos de 25 mm tiene que aparecer.
  - Para ser honesto: el 20/10 nadie marcó un atrapamiento.
    - Contra el banco de P11, el virolador solo sirve para ver que no da falsos rojos; la prueba real es el gemelo.
    - Esto ataca dónde está ubicada la seguridad, no un problema de ese día.
- **Depende de:** P3; tu decisión sobre aviso o freno.

### P13. La página de entrega lee los números del JSON
**De las 5 del informe: parte de #3.**

- **Qué problema ataca:** el problema 6, clase (a).
  - **Evidencia, `.../00_critica_interna_skill_y_virolador.md`, causa 6:** había números tipeados en la página (el «0,1 mm» del tope, los «47 mm» de la barra), contra la lección 39: «si el dato existe en el JSON, el documento lo LEE».
  - **Según `.../00_critica_interna_skill_y_virolador.md` §6,** «el 20/10, `pasos.json` tenía números tipeados».
  - **El «grep del nombre viejo»** depende de que la IA se acuerde (`.../00_critica_interna_skill_y_virolador.md` §3).
- **Qué cambia, exactamente:**
  - **La página (y `pasos.json`) se arma con referencias a claves del JSON del modelo,** no con cifras escritas.
  - **`gate_entregable.py` (GATE E, que ya corre con `--final`)** hoy juzga la carpeta de entrega (PDF, STEP, renders), y del PDF no se sabe qué número fue tipeado. Pasa a recibir como entrada nueva las fuentes de la página, y da rojo por dos cosas:
    - una cifra con unidad escrita a mano en esas fuentes;
    - un mismo dato con dos valores distintos en el mismo documento, que es la «firma barata» de la lección 39.
  - **Lleva par BIEN/MAL.**
  - **`lecciones-caras.md` 39** remite al control.
- **Tamaño:** mediano. Toca varios archivos (el armado de la página, un gate de entrega y una lección) y cambia lo que frena el gate, con caso anterior: el GATE E de hoy y la lección 39.
- **Riesgo:**
  - Falsos rojos con números que no salen del modelo: fechas, «v16», nombres de normas.
  - Que se «arregle» pasando el número tipeado al JSON a mano. Por eso el JSON tiene que salir del build.
- **Cómo se prueba:** sobre la página del virolador del 20/10 tiene que marcar «0,1 mm» y «47 mm»; una página bien generada tiene que dar verde.
- **Depende de:** P11.

### P14. Largo de agarre y largo de rosca
**De las 5 del informe: parte de #3.**

- **Qué problema ataca:** el hallazgo 4, el tornillo que no toma la tuerca, que según `.../00_critica_interna_skill_y_virolador.md` «no tiene regla». También la propuesta de patas M12.
  - **Evidencia, informe §5:** «~M12 en la zona maciza de la placa», con una placa de 15 mm. Por `ficha-fdm.md` R3 (1,5 a 2,5·D), un M12 pide 18 a 30 mm de rosca: no entra.
  - **Rosca macheada en plástico:** «ineffective» (Formlabs, solidprint3d.co.uk/wp-content/uploads/2019/08/Jig-Fixture-Design_EN-Letter.pdf).
    - Ojo: es un vendedor y habla de SLA (informe §3.15).
    - Igual, el §3.12 dice que lo de afuera contradice R3 y que hay que usar inserto o tuerca.
  - **El apriete cae con el tiempo:** 3,3 % en PLA y 11,5 % en PETG (Amza et al., https://pmc.ncbi.nlm.nih.gov/articles/PMC8659210/).
- **Qué cambia, exactamente:**
  - **Un chequeo nuevo en `scripts/`** (nombre a definir) que, por cada tornillo:
    - suma lo que atraviesa (brida, placa, arandela, tuerca) y exige que pase la tuerca entera;
    - si la rosca va en plástico y el tornillo lleva carga, da rojo si no hay inserto o tuerca (R5 saca el plástico del camino de la carga; informe §3.12);
    - si va en plástico sin carga, compara el largo disponible con 1,5·D y con 2,5·D (R3 no está reconciliado: informa los dos) y descuenta el tramo inicial que no toma (R4).
  - **Mismo patrón que `make_screw_nut.py`,** que ya frena la tuerca baja (R2).
  - **Corre al cierre de la fase 4,** donde el informe §8 pone el chequeo de largo de agarre.
- **Tamaño:** mediano. Es un script nuevo más su lugar en las fases de P1 (varios archivos), y cambia lo que frena. Tiene caso anterior en `make_screw_nut.py`, con el mismo patrón. Un aviso suelto fuera de la cadena sería una más de las ~30 «herramientas que hay que acordarse de correr».
- **Riesgo:**
  - Necesita saber qué es tornillo y qué atraviesa. Con tornillos sin modelar o de catálogo sin datos, no puede juzgar y lo tiene que decir.
  - R3 sigue sin medir en la A2L.
- **Cómo se prueba:** sobre el conjunto del 20/10 tiene que dar rojo en el tornillo del hallazgo 4, y sobre las patas M12 en la placa de 15 mm también (15 < 18).
- **Depende de:** P2 (si los insertos y tornillos salen del constructor, ya traen sus datos), P5 y P1.

---

## Lo que NO propongo y por qué

- **Cursos oficiales de CATIA ahora.** Ninguno de los seis problemas fue de manejo de CATIA, y `catia.md` dice «Leer el plano es el cuello de botella, no CATIA». El de Knowledgeware, si lo hacés, es para que vos revises mejor, y después de saber qué licencias tenés (informe §5).
- **Más reglas o preguntas de texto sueltas,** incluida una regla escrita de «aspecto profesional».
  - El 80 % ya es texto y más texto encarece sin mejorar (arXiv 2602.11988).
  - El aspecto va por los valores por defecto de los constructores (P2).
  - La regla de salida de P7 vive en el registro y el chequeo, no como texto de lectura.
  - Las checklists de P8 son solo lo que no pudo pasar a constructor o control, con tope y gemelo.
- **Generación de CAD desde texto (text-to-cad y similares).**
  - CAD-bench da tareas funcionales «near zero», y el mismo Autodesk dice que «isn't dependable enough yet».
  - text-to-cad además manda telemetría por defecto.
  - `ROADMAP.md` ya lo cerró por 6 a 12 meses, pero lista la skill global `text-to-cad-harness` (earthtojake/text-to-cad), del mismo repo: hay que verificar si manda telemetría y apagarla (`uvx cadgen telemetry off`).
- **Instalar la cadena build123d-mcp → augura → estampo → bambox.** Es inmadura: augura tiene 1 ★ y es pre-alpha, y bambox solo está validado en una P1S, con licencia AGPL-3.0. Como mucho, augura se prueba más adelante en la fase 4.
- **Prender build123d-mcp por defecto o usar su `verify_spec` como contrato.**
  - `verify_spec` es experimental y no ve filetes ni chaflanes.
  - El costo no es hipotético: según `build123d-mcp.md`, un `.mcp.json` sin commitear ya cuesta hoy 30 s de espera en cada arranque.
  - La idea se copia en P4 sin depender de él.
- **Bajar modelos de MakerWorld, Printables o McMaster por programa.** MakerWorld prohíbe el acceso con «artificial intelligence service», McMaster es solo para clientes aprobados y Printables no prueba los modelos.
- **Imprimir réplicas de piezas de catálogo de TraceParts.** Las condiciones no lo cubren. Queda como pregunta tuya, no como práctica.
- **Checks de Knowledgeware dentro del `.CATPart` o PowerCopy por macro ahora.**
  - Piden KWA y KT1 sin verificar.
  - La PowerCopy por macro pierde colores (fuente sin abrir), y la tabla de diseño pierde el vínculo si se renombra el archivo.
  - Primero hay que ver las licencias.
- **Más razonamiento o generar N candidatos para elegir.** «higher reasoning effort does not consistently improve performance» (Hephaestus), y elegir el más central se agota hacia N≈9 sin verificador.
- **Que la IA diseñe sola sin vos en el lazo.** En el mejor estudio abierto, 0 de 400 primeros intentos pasan todo. Tu rol se ubica en los cierres de fase (P1), no se elimina.
- **Fases rígidas con aprobación en papel.** Stage-Gate es criticado por «too linear, too rigid» (fuente sin abrir). Por eso P1 es liviana y permite volver atrás.
- **Las patas M12 regulables como solución de la skill.** Tienen un error de cuenta, y (opinión del informe) cuatro patas regulables son un hiperestático que alguien tiene que nivelar. Es una decisión de ese diseño; P14 la detecta.
- **Guardar toda la experiencia en memoria sin filtro.** «inaccuracies in past experiences compound». En P7, cada regla entra con su control.
- **PartCAD como formato de la biblioteca de la casa, ahora.**
  - Es un gestor de paquetes CAD (Apache-2.0, 503 ★) que acepta build123d y STEP y arma la lista de materiales, y el informe lo pone como candidato (§8).
  - Pero en Windows no está verificado, y «biblioteca primero» está menos probado de lo que suena (informe §3.5).
  - Antes hay que saber cuántas piezas se repiten entre tus dispositivos y ver si los constructores de P2 se usan de verdad. Si eso pasa, se evalúa como formato.
- **Copilotos comerciales o un agente que maneje la pantalla de CATIA.**
  - Ningún copiloto comercial sirve para V5: la IA de Dassault vive en 3DEXPERIENCE, en la nube.
  - La skill ya trabaja por COM, que es el camino de pycatia.
- **Instalar jarvis-onshape-mcp o catia-v5-mcp.**
  - jarvis exige Onshape.
  - catia-v5-mcp tiene 0 ★ y está probado en R19 en francés.
  - De los dos se copia el patrón (diff por cambio, volumen por operación) en P9, sin instalar nada.
- **Cambiar el laminado a OrcaSlicer por línea de comandos o mandar a la impresora por un MCP con certificado extraído.**
  - Ninguno de los seis problemas fue de laminado ni de envío.
  - OrcaSlicer tiene crashes reportados en Windows.
  - Para enviar, el informe dice «nunca» al MCP con certificado extraído: las rutas oficiales son Bambu Connect y Local Server.
- **Un chequeo propio de fabricación (voladizos, cama, soportes) por ahora.**
  - `.../00_critica_interna_skill_y_virolador.md` lo marca como hueco, pero no causó ninguno de los problemas del 20/10.
  - Además, los números de afuera (Markforged) son de otra máquina y hay que rotularlos por eje.
  - Primero hay que leer el perfil real de la A2L e imprimir una pieza de prueba propia.
  - El chaflán de cama ya queda cubierto por el constructor de P2.
- **Un DFMEA o un checklist APQP por dispositivo ahora.** Las dos fuentes están sin abrir, y sumarían otro formulario de texto. Lo que tienen de útil (criterios, interfaces, revisión de diseño) entra por el contrato de P4 y el revisor de fase de P8.
- **Quedan sin propuesta, y lo dejo dicho:**
  - la unión con poscondición (informe §4.3, «barato de copiar») y `design_audit`, los dos del §8 fase 3;
  - el peso del útil (E4) calculado del modelo (`.../00_critica_interna_skill_y_virolador.md` §6).

## Orden sugerido para el viernes

1. **P11 primero:** es la base contra la que se prueba todo lo demás y no depende de nada. Hay que decidir cuántos casos se suman al virolador.
2. **Las cinco decisiones de P10, empezando por «con qué se diseña»** (de eso dependen P2 y P9).
   - También tres o cuatro apoyos, porque la revisión de G-E5 a G-E7 y del GATE A vence el 24/10, al día siguiente.
   - Junto con esto, revisar la versión de V5 y la licencia DMU para P3.
3. **P1, P3 y P4 juntas:** cuántas fases hay, qué cierres firmás vos, qué campos lleva el contrato y si CATIA es segundo juez del barrido.
4. **P2, P5 y P6:**
   - si se arma el módulo de constructores en los dos entornos, y con qué dato de repetición;
   - qué fuentes de catálogo se permiten y quién baja los archivos;
   - el radio de la casa y si el control de cantos frena o solo avisa la primera semana.
5. **El resto, después de lo anterior:**
   - P7 y P8: quién anota las marcas, cuál es el archivo de «por qué» y cómo se calibra el revisor;
   - P9: la receta de `catia.md`;
   - P12 a P14: aviso o freno.

## Agregado tras la segunda ronda (informe §12)

**Fila nueva para la tabla:**

| P | Qué | Causas que ataca | De las 5 | Tamaño |
|---|---|---|---|---|
| P15 | Cierre en planta: prueba de la pieza impresa en el puesto | patrón «controles en los extremos» (falta el de la planta), reuso de diseños sin probar | #1 y #5 | mediano |

### P15. Cierre en planta: la pieza impresa se prueba en el puesto antes de darla por buena
**De las 5 del informe: parte de #1 y de #5.**

- **Qué problema ataca:** hoy todos los controles miran el modelo. Ninguno mira la pieza impresa probada con el tapizado real (según P1-P14: K5 solo la registra). Además, el índice de lo «fabricado y andando», que es el paso 1 de la búsqueda (P5), puede recibir diseños que nunca se probaron.
  - **Evidencia, estándar de Marwood** (http://marwoodinternational.com/wp-content/uploads/2019/07/Marwood-Fixture-Standards.pdf):
    - pide «Written approval of the final design is required before proceeding with fixture build»;
    - el mismo texto aclara que aprobar el diseño no garantiza la función, porque lo que decide es la prueba (16.1). Esa prueba es un Gauge R&R, la repetibilidad de un calibre metálico de chapa: trasladarla a la pieza impresa en el puesto es analogía;
    - usa tres listas: diseño, recepción y cierre.
  - **Omni3D:** «define the acceptance test before printing» (https://omni3d.com/3d-printed-jigs-and-fixtures/; es un vendedor; solo búsqueda).
  - **Reusar puede copiar defectos** (fijación por ejemplos), y la evidencia está mezclada (informe §12.4, fuentes sin abrir). Lo que entra al índice tiene que estar probado.
  - **Una hoja de chequeo no tuvo efecto** en un aula; los autores lo atribuyen a la motivación (que sea por falta de consecuencia es lectura nuestra) (Booth, informe §12.2, fuente sin abrir).
  - **En la casa:** `ficha-utillajes.md` K5 ya pide la primera pieza impresa como dato, y P7 la manda al registro. Lo que falta es que tenga consecuencia.
- **Qué cambia, exactamente:**
  - **El criterio de aceptación del pliego** (P4, formato `{que, con, acepta}` de G-E7) se corre con la primera pieza impresa en el puesto, con la pieza del cliente o con una sustituta anotada como tal.
  - **Antes, una recepción corta:** las cotas que el pliego marca como interfaz (holguras, insertos) se miden sobre la pieza impresa y se comparan con el modelo.
  - **El resultado tiene tres estados:** pasa, falla o no probado. Se registra quién probó, la fecha y una foto o medida, en el registro de P7 con fase 4 (fabricación y entrega).
  - **Consecuencia:**
    - sin un «pasa», el dispositivo no entra a `indice_dispositivos.py` como «fabricado y andando»; lo ya fabricado y en uso entra como «pasa por uso» (fecha y quién) o «no probado» visible, nunca excluido (ver P5);
    - un «falla» entra con su defecto anotado, visible en la búsqueda, y vuelve al banco (P11) como caso.
  - **No frena la entrega del PDF:** frena el alta en el índice y el reuso.
- **Tamaño:** mediano. Toca varios archivos (pliego, registro e índice) y cambia lo que entra al índice. Tiene caso anterior: G-E7 y K5.
- **Riesgo:**
  - **Burocracia.** Tres puertas formales pueden ser sobrecarga para un único usuario (verificación del anexo f14); por eso es una sola puerta, al final.
  - **Que no haya pieza del cliente a mano.** Se acepta una sustituta, y queda anotado.
  - **Que «no probado» quede para siempre.** El índice lo muestra así, y no cuenta como reusable.
  - **Que no se carguen los datos.** Es el mismo riesgo que P7.
- **Cómo se prueba:**
  - El virolador del 20/10 tiene que quedar en el índice como «pasa», «falla» o «no probado», según lo que haya dado en la planta. Sin un «pasa», no cuenta como reusable.
  - Gemelo: un dispositivo sin evidencia que intenta entrar como «andando» tiene que dar rojo. Uno con «falla» tiene que aparecer con su defecto en la búsqueda de P5.
- **Depende de:**
  - P4 (el criterio de aceptación adelantado), P7 (el registro) y P5 (la búsqueda que lee el índice);
  - tus decisiones: qué cuenta como prueba (pieza real o sustituta, cuántos ciclos) y si la carga la hacés vos o la IA con tu confirmación.

**Cambios a propuestas existentes:**

- **P1:** en la fase 4, «fabricación y entrega», agregar al final el cierre en planta de P15. No frena la entrega; frena el alta como «andando». Motivo: aprobar el diseño no garantiza la función (Marwood 16.1, por analogía: allí la prueba es un Gauge R&R de un calibre metálico; informe §12.4 [150]).
- **P2:**
  - sumar a la lista de constructores una **placa de identificación** grabada o en relieve, con número, peso y secuencia de operación;
  - en la viñeta de opinión sobre el aspecto profesional, cambiar «queda en los radios y chaflanes por defecto» por «queda en los radios y chaflanes por defecto y en la identificación».

  Motivo: el estándar de Marwood pide identificación (placa con número, peso estampado, secuencia de cierre grabada) [150]. Llamar a eso «profesional» y que resuelva las «cajas peladas» es opinión.
- **P4:** agregar el campo **material previsto** al pliego, junto a «ciclos y temperatura». Motivo: Stratasys pone el material como «first step» y pide trabajar por debajo del HDT menos 28 °C [134]. Esa regla es de una guía para máquinas industriales: sirve como referencia, no como número de la A2L.
- **P5:**
  - en el paso 1 de la búsqueda, cambiar «`indice_dispositivos.py`» por «`indice_dispositivos.py`, solo dispositivos con "pasa" en P15; lo ya fabricado y en uso entra como "pasa por uso" (fecha y quién) o "no probado" visible, nunca excluido; los "falla" se muestran con su defecto»;
  - sumar como riesgo la fijación por ejemplos.

  Motivo: reusar puede copiar defectos y la evidencia está mezclada [154, 155] (fuentes sin abrir).
- **P6:**
  - **Chaflán.** En «Riesgo», cambiar «Falta decidir si un chaflán cuenta como "no vivo"» por «Falta decidir si un chaflán cuenta como "no vivo" a partir de un tamaño mínimo; lo decidís vos». Motivo: el estándar de Marwood usa el chaflán «to remove any burrs or sharp edges» [150], aunque solo en los rasgos que no son de control y en acero o aluminio, así que como apoyo es débil; la skill ya pone chaflán en la cara de cama (G6).
  - **Aviso inicial.** Si la primera semana solo avisa, que el aviso tenga una fecha de vencimiento escrita en `procesoCanon.data.json`, después de la cual pasa a frenar. Motivo: una hoja de chequeo no tuvo efecto en un aula; los autores lo atribuyen a la motivación (que sea por falta de consecuencia es lectura nuestra) [133] (fuente sin abrir).
- **P12:** en «Riesgo», el «aviso para que lo revises vos» queda igual, pero con fecha de revisión escrita y con registro de cada aviso descartado y su motivo. Mismo motivo que en P6, con la misma salvedad [133] (fuente sin abrir).
- **Lo que NO propongo, ítem Knowledgeware:**
  - sumar al final: «Knowledge Expert (KWE) también permite, por macro, bases de reglas, chequeos, informe y resaltado de lo que no cumple [144]. Es candidato para los controles de P6 dentro de CATIA, pero recién después de confirmar la licencia»;
  - en el «Orden sugerido», punto 2, agregar KWE a las licencias que hay que revisar.
- **Lo que NO propongo, ítem nuevo:** «Diseño generativo u optimización topológica. Ninguno de los seis problemas fue de peso o rigidez. La TO supone material isótropo y el FDM no lo es [118]. En un estudio con CF-PLA, la simulación sobreestimó la rigidez entre 14 y 52 % [122] (fuente sin abrir). Si algún día una pieza que el operario levanta pesa demasiado, se prueba una vez como mapa (PyTopo3D [115] o los 30 días de Fusion [113]) y las costillas se ponen con los constructores de P2.»
