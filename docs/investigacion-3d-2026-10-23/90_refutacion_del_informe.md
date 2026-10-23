**1. INVENTADO**

Nada. Contrasté contra los adjuntos todas las cifras, estrellas, fechas, versiones, números de APAR, issues, PR y links de «Fuentes». Todos aparecen en algún informe, en una verificación o en la crítica interna.

**2. ESTIRADO**

- **«Afuera nadie mostró una IA que diseñe sola un mecanismo que funcione: en el mejor estudio abierto, 0 de 400 primeros intentos pasan todo.»**
  - Lo que dicen las fuentes: Hephaestus trata ensamblajes estructurales evaluados con FEA, no mecanismos (verif. f08). ArtiCAD y AADvark sí arman piezas móviles, aunque en casos muy acotados: jueces VLM en ArtiCAD; solo prismas y juntas de revolución en AADvark.
  - Corregir: «Fuera de casos muy simplificados, ningún estudio muestra una IA que diseñe sola un mecanismo funcional. En CAD-bench las tareas funcionales quedan "near zero", y en Hephaestus (estructuras con FEA) 0 de 400 primeros intentos pasan el control estricto.»

- **§1: «El error 4 es típico del oficio: Roche… no modelan el barrido del mango.»**
  - Roche habla de *no modelar* el barrido. El error 4 fue que el barrido, que sí se hizo, era lento. Además, el subtítulo «Cantos, …» no tiene ninguna fuente detrás.
  - Corregir: «Simular el recorrido es oficio: Roche dice que los diseñadores suelen mirar el CAD trabado y no modelan el barrido.» Ya está en §2.3; se puede sacar de §1.

- **§2.8: CADWorld «apunta en la misma dirección».**
  - La verif. f10 dice que el estudio no compara contra agentes por API y que el paper defiende la pantalla como parte del trabajo real.
  - Corregir: sacarlo como apoyo, o escribir «no compara contra agentes por API: no sirve a favor ni en contra».

- **§3.3: «Una checklist sí le sirve a la IA, si es corta y de sí/no.»**
  - TICK usa checklists generadas para cada instrucción, con preguntas de sí/no. «Corta» no figura en la fuente.
  - Corregir: «Una checklist específica de la tarea, con preguntas de sí/no, mejoró la autocorrección (+7,8 % en LiveBench).»

- **§4.1 y §10.1: el contrato antes del CAD se presenta respaldado, pero se omite el único dato medido.**
  - En Hephaestus, el blueprint movió el puntaje de ingeniería +0,3 en GPT y +3,9 en Claude, sin intervalos de confianza. La suba de IoU fue del blueprint junto con las 21 vistas (verif. f03 y f07).
  - Corregir: agregar en §4.1 «La evidencia a favor del contrato es de dirección, no de magnitud: en Hephaestus el blueprint dio +0,3 (GPT) y +3,9 (Claude), sin intervalos.»

- **§4.8: «Knowledgeware ya está en la casa.»**
  - Las licencias KWA y KT1 no están verificadas (el mismo borrador lo dice más abajo).
  - Corregir: «Knowledgeware es parte de CATIA V5, si tu licencia lo habilita (KWA, KT1: sin verificar).»

- **§8, Fase 2: «Para un grado de libertad alcanza una transformada a mano.»**
  - El frente f06 pone una condición: «un solver solo justifica el costo si hay lazo cerrado». El virolador es un cuatro barras (crítica interna), o sea, un lazo cerrado.
  - Corregir: «Para una palanca simple alcanza una transformada a mano. Un cuatro barras es un lazo cerrado: hay que resolver el cierre, a mano o con un solver.»

- **§6: «Afuera pasa lo mismo: lo que mejora los resultados es la estructura del lazo y la medición externa.»**
  - Huang está confirmado solo para razonamiento. La verif. f07 trae ReasoningBank, que aprende sin medición externa. El salto de 38,8 % a 60,5 % de Hephaestus mezcla más intentos, más cómputo y tres tipos de feedback, y con Claude el feedback rindió poco o empeoró.
  - Corregir: «Lo mejor documentado afuera es el feedback externo (Huang, en razonamiento; Hephaestus, aunque con Claude rindió poco), con excepciones.»

- **§11: «Las condiciones de TraceParts dicen que no»**, y en §3.6 «no está cubierto», dicho como hecho.
  - Las condiciones dicen «only … for the purposes of computer-aided design or viewing». Que la réplica impresa quede afuera es interpretación de la verificación.
  - Corregir: «Las condiciones limitan el uso a diseño o visualización. Imprimir una réplica no parece cubierto (lectura nuestra; conviene consultar).»

- **§10.1: «cero filetes o estética antes del barrido verde».**
  - Ese indicador mide el camino, justo lo que §4.1 desaconseja citando a Anthropic.
  - Corregir: «Antes de la entrega existen el barrido verde y las holguras medidas, y bajan tus marcas por fase.»

- **Matices menores:**
  - §3.1: agregar «(xhigh, pieza simple)» al 32,7 → 31,4.
  - §2.4 (CADSmith): falta que la mediana casi no cambia (0,55 → 0,48) y que los autores documentan una pieza que pasó todos los controles y estaba mal.
  - §3.8: «< 5% of the time» es la estimación de un usuario («probably»), no una medición.
  - §10.5: «más texto no mejora y encarece» contradice el «En contra» que el propio §3.2 cita (Lulla).

**3. SIN MARCAR**

Opiniones presentadas como hechos:
- **Titular de «En una página»:** «El error de base no es de herramienta ni de falta de conocimiento: es de cuándo se aplica». En la crítica interna lleva «(opinión)»; acá va en negrita como hecho.
- **«Tu presencia en el lazo no es un defecto a eliminar sino un rol a ubicar…»**: opinión.
- **§3.1 «La ambición va más lejos que lo demostrado»**: en f02 está marcada «(opinión)».
- **§2.2 «Es lo mejor del sistema. Hay que conservarlo.» y §2.4 «sirve, hay que adelantarlo»**: juicios.
- **§4.8 «Para corregir sin rehacer, alcanza con cambiar parámetros por COM y actualizar»**: es una propuesta de la verificación, sin prueba. Marcar «(opinión)».
- **§4.11 «Un DFMEA mínimo, sin números… habla tu idioma»**: tanto «sin números» como «habla tu idioma» son opinión (f03).
- **§7, «Maduras» para trimesh y Manifold**: valoración sin fuente.
- **§10.3 «los controles con código son los únicos que se ejecutan sin acordarse»**: opinión.

Fuentes sin abrir que no llevan la marca:
- **§2.5 «CATIA trae PowerCopy y UDF…»**: en f06 y f10 sale solo de búsqueda. Falta «(fuente sin abrir)».
- **§4.8 «Reglas y checks piden licencia Knowledge Advisor (KWA)»**: la verif. f10 lo confirmó solo por búsqueda. «HD59593» va sin marca en el cuerpo, aunque en «Fuentes» figura sin abrir.
- **§5, Fases: «(Cross; críticas a Stage-Gate)»**: no lleva la marca que sí tiene en §3.4.
- **§5, Cursos: «GoEngineer… US$ 995, 4 medias jornadas…»**: en §7 y en «Fuentes» figura sin abrir; en el cuerpo no.

**4. CONTRA EL PEDIDO**

- **Links por afirmación.** El pedido dice «cada afirmación con su fuente (link)». El cuerpo cita por nombre y deja los links al final.
  - Cinco fuentes quedan «sin link en el material»: Rong 2010, issue 1430 de Manifold, issue 371 de text-to-cad, APAR HD64346 y CAAKiiMechanismSolve.
  - Los links de FDM y simulación van sin protocolo.
  - Arreglo mínimo: numerar las fuentes y poner el número al lado de cada cifra que mueve una decisión.
- **Estado del arte incompleto.** El pedido nombra copilotos de SolidWorks, Fusion y Onshape, y también diseño generativo y DFM/DFA.
  - El borrador trae solo Autodesk y Dassault. f02 tenía más: Creo Automate (trabaja sobre una copia aislada y espera la aprobación del ingeniero, verificado), Onshape AI Advisor (sin acceso a tus datos), el Assistant de Inventor (no crea features) y SOLIDWORKS (carpetas vacías). Casi todo es solo búsqueda, pero sirve para tu pregunta.
  - Diseño generativo y DFA no aparecen y tampoco se declaran como huecos.
- **Jerga sin explicar para un ingeniero no programador:**
  - «diff», «JSON», «API», «OCP», «caché gen_py de pywin32»;
  - «AGPL-3.0» (falta decir qué obliga), «MIT/Apache», «APAR», «issue/PR»;
  - «det ±1», «`status()`», «`fresca=True`», «SaveAs»;
  - «creep», «HDT», «LiveBench»;
  - la «★» se usa en §2.8 y recién se explica en §8;
  - «el informe» en §3.2 y §3.3 confunde: se refiere a los informes de cada frente, no a este.
- **Lo que sí cumple:** separa confirma, contradice y no se nos ocurrió; trae causas de raíz, las 5 cosas con su porqué, las preguntas, repos con arquitectura, y no le da la razón por darla (cursos, patas, dibujo).

**5. SOBRE EL SISTEMA REAL**

- **§2.9 «Reglas FDM que ya tienen… Rosca macheada en plástico es "ineffective"… insertos o tuerca».**
  - La crítica interna no muestra esa regla. Al contrario: R3 (1,5–2,5·D de rosca) y el «~M12» de `DONDE_QUEDO.md` suponen rosca en plástico.
  - Corregir: mover a §3 como algo que contradice lo que hay.
- **§3.10 «CATIA hace más de lo que la skill supone».**
  - La crítica interna no atribuye ese supuesto a la skill. «Solo se puede crear el mecanismo» lo dijeron los frentes de simulación y de CATIA.
  - Corregir: «CATIA hace más de lo que supusieron dos frentes de esta investigación.»
- **§11 «La skill nació en build123d».**
  - No está en la crítica interna, que solo dice que el §3 describe build123d y gmsh y que el redondeo vivía en el build123d de agosto.
  - Corregir: «El §3 de la skill describe build123d y gmsh, no CATIA.»
- **«Ahí estuvieron los seis problemas del virolador».**
  - La crítica interna dice que en el medio no se dispara nada; no ubica los seis problemas ahí.
  - Corregir: «Ahí no se dispara nada, y tres de los seis problemas tenían la regla escrita.»

**6. VEREDICTO**

**Sale con estas correcciones:**

1. «Afuera nadie mostró una IA que diseñe sola un mecanismo que funcione: en el mejor estudio abierto, 0 de 400…» → «Fuera de casos muy simplificados, ningún estudio muestra una IA que diseñe sola un mecanismo funcional: CAD-bench da "near zero" en tareas funcionales, y Hephaestus (estructuras con FEA) 0 de 400 al primer intento.»
2. «Para un grado de libertad alcanza una transformada a mano.» → «Para una palanca simple alcanza una transformada; un cuatro barras es un lazo cerrado y hay que resolver el cierre.»
3. «Knowledgeware ya está en la casa.» → «Knowledgeware es parte de CATIA V5, si tu licencia lo habilita (KWA, KT1: sin verificar).»
4. «Una checklist sí le sirve a la IA, si es corta y de sí/no.» → «Una checklist específica de la tarea, de sí/no, mejoró la autocorrección (TICK).»
5. «Las condiciones de TraceParts dicen que no.» → «Limitan el uso a diseño o visualización; la réplica impresa no parece cubierta (lectura nuestra).»
6. «Reglas FDM que ya tienen» (viñeta de rosca macheada) → pasarla a §3: «Contradice R3 y el M12 propuesto: usar insertos o tuerca.»
7. «CATIA hace más de lo que la skill supone.» → «…de lo que supusieron dos frentes de la investigación.»
8. «La skill nació en build123d» → «El §3 de la skill describe build123d y gmsh, no CATIA.»
9. «El error 4 es típico del oficio: Roche…» → sacarlo de §1; queda en §2.3.
10. §4.1: agregar el dato del blueprint (+0,3 GPT / +3,9 Claude, sin intervalos de confianza).
11. §10.1: «cero filetes o estética antes del barrido verde» → «barrido verde y holguras medidas antes de la entrega; bajan tus marcas por fase.»
12. Marcar «(opinión)» en el titular de «En una página» y en «tu presencia en el lazo…». Marcar «(fuente sin abrir)» en PowerCopy/UDF (§2.5), KWA y HD59593 (§4.8), Cross/Stage-Gate (§5) y GoEngineer (§5).
13. Agregar un glosario corto (diff, JSON, API, AGPL, APAR, det ±1, creep, HDT) y una línea que declare como huecos los copilotos de SolidWorks/Onshape/Creo, el diseño generativo y DFA.
