## 1. INVENTADO

Faltan dos adjuntos que el pedido dice que mandaste: **el pedido del ingeniero y la crítica interna (interna.md)**. Llegaron 10 archivos: el borrador más 3 frentes (f15, f16, f17), cada uno con 2 informes y 1 verificación. Por eso, lo que el borrador cita como [25] no se puede contrastar. Lo trato en la sección 5 y no acá.

Sin fuente en ningún adjunto:

- «Facundo mira una hoja a la mañana», «hoja para Facundo», «Facundo aprueba cada viñeta», «dispositivos que Facundo ya aprobó». En los adjuntos el ingeniero es siempre «Fak». El nombre «Facundo» no está en ningún adjunto. Si es correcto, sale del pedido, y hay que confirmarlo.
- «anexos f15, f16, f17 en docs/investigacion-3d-2026-10-23/»: la ruta no está en ningún adjunto.
- «Armar el banco en `evals/banco/cad/`»: la ruta no está en ningún adjunto. Como propuesta vale, pero tiene que ir marcada.
- «El virolador del 20/10»: la fecha no está en ningún adjunto. Los informes nombran la investigación del 17/10, no un virolador del 20/10.

Todos los números con fuente externa coinciden con los informes o las verificaciones: 38,8/60,5; 32,7/31,4; 0,84; 182–485; 63,9/62,7; 68,9/72,1; 18.282/122; 57/21 y 26/46; 20–23 %; 65 %/90 %; 106/200/50; 20–26 y 4 de 5; 68 %; 200+200 y 20.000 h. Los 25 links aparecen en algún adjunto.

## 2. ESTIRADO

- **«Lo que está menos probado es que así mejoren las reglas [17][18].»**
  - Qué dicen las fuentes: la verificación f17 dice que el estudio más directo (Skill Issue) dio ganancias «ninguno significativo». El veredicto de f17 da seguridad **baja** a que la evolución nocturna mejore las reglas: «nada probado en CAD, y la evidencia más rigurosa encontrada la contradice».
  - Corrección: «No está probado que así mejoren las reglas: el estudio más directo no encontró mejora significativa [18], y a igual gasto reintentar rindió igual o más [17]».

- **«Lo que más rindió afuera fue reintentar contra un corrector… GPT-5.5 pasó de 38,8 % a 60,5 %».**
  - Qué dice la fuente: la verificación f16 aclara que «es reparación dentro de la tarea, no aprendizaje entre tareas».
  - Por qué importa: en un resumen titulado «Cómo se mejora solo el sistema», esto se lee como automejora.
  - Corrección: agregar «Es reparar cada diseño con el diagnóstico, no que el sistema aprenda de un diseño para el siguiente».

- **«con Opus, el reintento no mejoró [9]»** y en el riesgo 4: «Opus 4.7… empeoró apenas con el reintento (32,7 → 31,4 %)».
  - Qué dice la fuente: según la verificación f16, ese dato es «en pieza única». En otra configuración, Opus dio resultados mixtos: 0,174→0,171 y 0,170→0,207.
  - Corrección: «con Opus 4.7, en pieza única, empeoró apenas; en otra prueba el resultado fue mixto».

- **«Las reglas que escribe la IA rinden menos que las curadas por personas [1][10].»**
  - Qué dicen las fuentes:
    - Verificación f15: «La IA sola no escribe buenos skills es más fuerte de lo que prueban los datos». En SkillsBench la IA escribió las skills antes de la tarea y sin devolución.
    - SkillLearnBench [10]: «all continual learning methods improve over the no-skill baseline».
    - Trace2Skill: con trazas y un verificador, la IA mejoró +18,6.
  - Corrección: «Escritas por la IA sin devolución no ayudan; con un corrector sí mejoran contra no tener reglas, pero quedan por debajo de las curadas por personas [1][3][10]».

- **«Lo único que no conviene automatizar es aprobar la regla nueva. Los agentes engañan al corrector cuando pueden [5][20].»**
  - Qué dicen las fuentes:
    - El veredicto f17 dice «no automatizar todavía; correr a mano los tres brazos».
    - EvilGenie (verificación f17) dice que el engaño «se dispara en problemas ambiguos» (Claude 33 %, Codex 44 %). No pasa «cuando pueden».
  - Corrección: «Todavía no conviene automatizar el lazo; primero, banco y tres brazos a mano (opinión, coincide con f17). Hay casos publicados de agentes que engañaron al corrector, sobre todo con consignas ambiguas [5][20][21]».

- **«en una prueba hecha por competidores no mejoró skills [3]»**
  - Qué dice la verificación f15: además, «los skills los usaban modelos Qwen, con un solo prompt y sin las evals del propio skill-creator».
  - Corrección: sumar esos dos reparos.

- **«Las skills aprendidas funcionaron en Claude Code; con Sonnet la ganancia fue casi nula [14]»**
  - Qué dice la fuente: las skills funcionaron con Haiku 4.5, un agente chico, en tareas que los autores admiten «simples» y sintéticas.
  - Corrección: «funcionaron en Claude Code con Haiku 4.5, en tareas simples; con Sonnet, casi nula».

- **«en GEPA, el resultado en la prueba subió de 68,9 % a 72,1 % [13]»**
  - Qué dice la verificación f17: el proponedor era gpt-5-mini, se usaron de 3.000 a 5.000 llamadas, y «una configuración bajó a 66,7».
  - Corrección: agregar las tres condiciones.

- **Caja 6: «evolucionar reglas no le ganó de forma pareja a reintentar [17]»**
  - Qué dice la fuente: Wang evoluciona el arnés (el programa que rodea al agente), en Terminal-Bench, no en CAD (f17 informe_2). Además, la cifra de 67,4 no se pudo ver.
  - Corrección: «evolucionar el arnés del agente, en tareas de terminal, no le ganó…».

- **«Entrenar casi no paga»**
  - Qué dice la fuente: el dato sale de un solo trabajo (ToolCAD).
  - Corrección: «En ToolCAD, entrenar casi no le ganó a GPT-4o sin entrenar [11]».

- **«Cada contexto agregado sube el costo 20–23 % [6]»**
  - Qué dice la fuente: ETH mide tener un archivo de contexto, no cada agregado.
  - Corrección: «Sumar un archivo de contexto subió el costo 20–23 % [6]».

- **«Esta práctica no gasta API [8]»**
  - Qué dice la fuente: «Costo: cero de API» es una opinión del informe f16, no algo que diga CADTests.
  - Corrección: «(opinión)».

- **«con huella verificada antes y después [22] (fuente sin abrir)»**
  - Qué dice la fuente: la huella (hash) es una propuesta propia de f17. Barbarians [22] solo recomienda restringir qué se puede editar.
  - Corrección: «con huella verificada (opinión de f17); restringir qué se edita lo recomienda [22] (fuente sin abrir)».

- **Riesgo 4, frenos: «el juez visual va último, como consejero [7][12]»**
  - Qué dice la verificación f16: «El juez visual no queda solo como último escalón». Un juez con 21 vistas, sumado a medidas deterministas, fue el primer salto grande para GPT (+6,3). El borrador lo calla.
  - Corrección: agregar «aunque en [9] un juez con 21 vistas sumado a medidas fue la primera mejora grande con GPT, no con Opus».

- **Ocultos: «~10 ocultos» en el ciclo y en el viernes, contra «con 20–26 ocultos, una mejora solo se detecta si gana 4 de cada 5 desacuerdos [18]».**
  - El borrador se contradice solo.
  - La verificación f17 dice explícitamente que el banco de 10 ocultos «no alcanza para separar una mejora del ruido».
  - Corrección: subir los ocultos, o decir que con 10 el lazo no puede demostrar nada y sirve solo como borrador para Fak.

- **«Reescribir todo hizo colapsar un contexto de 18.282 a 122 tokens [2]»**
  - Qué dice la verificación f15: es un caso de Dynamic Cheatsheet mostrado dentro del paper de ACE.
  - Corrección: «en un método anterior que reescribía todo».

- **«2–3 módulos enfocados… [1]» junto con «viñetas… [2]» (ACE)**
  - Qué dice la verificación f15: ACE «choca con chico y enfocado», porque defiende contextos largos y usa +117 % de tokens. Además, sus autores son de SambaNova y declaran no tener conflicto de interés.
  - Corrección: marcar la tensión.

## 3. SIN MARCAR

- **Opiniones presentadas como hechos:**
  - «Se puede armar casi todo automático…»: es una inferencia, no un hallazgo.
  - «Lo único que no conviene automatizar…»: la marca «(opinión)» solo cubre la frase de Facundo.
  - «Riesgo principal».
  - «Conviene usarlo para medir y no para escribir reglas»: es el veredicto de f15.
  - «Correr el banco costaría decenas de dólares y optimizar en serio, cientos»: es una cuenta propia, sin la cuenta a la vista.
  - Los frenos de los riesgos 1 a 3 («Ocultos que… se renuevan», «Una base congelada (impresora, material…)»): son propuestas, no hallazgos. La adaptación a impresora y material es de la verificación f17, no de Skill Issue.

- **Fuentes sin abrir que no llevan la marca:**
  - Fila CADSmith: lo de «Mide con OpenCASCADE… 3 vistas» también es solo búsqueda (f16). Hoy la marca está solo en la última columna.
  - La DGM [20] figura «abierta», pero la verificación f17 la confirmó «solo búsqueda (extractos)». Vale el blog abierto por f17. No es grave, pero hay que aclarar quién la abrió.

- **Primera persona falsa:** «solo vi el título en su sitio». Quien lo vio fue el informe f17, no quien escribe el borrador. Corrección: «f17 solo vio el título».

- **Paso 5 del viernes:** «GEPA y Claude como proponedor» se apoya en una guía sin abrir. La única evidencia abierta con Claude proponiendo es el tutorial del unicornio, que la verificación f17 marcó como parcial: un objeto, criterios estéticos y sin chequeo geométrico.

## 4. CONTRA EL PEDIDO

No tengo el pedido. Uso los requisitos que vos listaste.

- **No separa confirma / contradice / no se nos ocurrió.** Los tres informes lo hacen y el borrador lo mezcla todo en «lo que existe», «ciclo» y «riesgos». Lo que más se pierde es lo que contradice al sistema:
  - Trace2Skill muestra que la IA sí puede escribir reglas útiles con corrector.
  - La investigación del 17/10 decía que ningún paper mide función, y f16 encontró tres que sí.
  - Según CADEngBench, practicar un tipo de ejercicio no se traslada a otro: el ranking casi no se asocia entre tareas. Eso está sin verificar.
  - El juez visual sí ayudó a GPT.
- **Las 5 cosas con su porqué:** el «viernes» tiene 5 pasos, pero los porqués de los pasos 1, 4 y 5 son una cita entre corchetes y no una razón. No puedo confirmar que sean «las 5 cosas» del pedido.
- **Las preguntas:** no hay ninguna sección que responda preguntas explícitas. No puedo verificar cuáles eran.
- **Causas de raíz:** solo el riesgo 1 tiene «por qué pasa». No se dice por qué el sistema actual falló con el virolador (estética antes que mecanismo, redibujar la palanca) ni por qué las reglas no frenan.
- **Cómo implementarlo con repos:**
  - Hay una tabla de repos, pero no pasos concretos: qué se instala, qué archivo toca GEPA, cómo se conecta el corrector.
  - El repo de GEPA está sin abrir y el código de ACE no está probado con Claude.
  - El borrador termina en «dejar la noche corriendo con GEPA» sin decir cómo.
- **No darle la razón por darla:**
  - El primer renglón («Se puede armar casi todo automático») y «Lo único que no conviene automatizar» van en la dirección contraria al veredicto de f17 («no automatizar todavía»).
  - Faltan los niveles de confianza que dieron los tres frentes. f15 y f17 dicen media para la dirección y baja para que la mejora nocturna funcione. f16 dice media para la dirección y baja para cuánto mejora practicar.
- **Contradicción interna:** el virolador aparece a la vez como caso con defectos («palanca dibujada de cero, cantos vivos…»), como «virolador aprobado», que es la base buena para los mutantes, y como parte de «los diseños que ya andaban» de la regresión. No puede ser las tres cosas. Hay que decidir el papel de cada versión.
- **Jerga sin explicar para un ingeniero no programador:**
  - Herramientas y términos técnicos: FEA y CalculiX (se entienden a medias), OpenCASCADE, manifold3d, build123d, «tokens», «contexto», «SKILL.md», «GPU», «aprendizaje por refuerzo».
  - Términos de evaluación: «suite de regresión» y de «capacidad», «validación», «huella», «proponedor», «brazos», «4 de cada 5 desacuerdos» (sin explicar qué es un desacuerdo).
  - Hace falta un glosario de 10 líneas o explicarlos en el texto.

## 5. SOBRE EL SISTEMA REAL

La crítica interna no está adjunta, así que **ninguna** de estas afirmaciones se puede verificar. Antes de publicar, hay que chequearlas contra interna.md:

- «de las ~210 reglas de la skill, unas 170 son solo texto que nada dispara».
- «palanca dibujada de cero, cantos vivos, armado en espejo, tornillo corto y números tipeados». Los informes solo nombran la estética antes que el mecanismo, la palanca redibujada, las cajas peladas y el rehacer todo. «Armado en espejo», «tornillo corto» y «números tipeados» no están en ningún adjunto.
- «Ya se resolvieron decenas de CATIA. El cuello de botella fue leer el plano y el método».
- «manifold3d, que ya está instalado». f17 nombra «la simulación con manifold3d del sistema», pero no dice que esté instalado.
- «el control de cantos convexos, que hoy no existe».
- «Poda de lo que no frena nada».

Lo que sí sale de los adjuntos, y no de la crítica interna:

- «tope actual de USD 8 por corrida»: viene de f17, como «dato propio, regla api-claude».
- «CATIA afuera de la noche»: viene de f17.

## 6. VEREDICTO

**Sale con estas correcciones.** Los números y links son fieles. Lo que falla es el encuadre, demasiado optimista, y la estructura que pide el pedido.

1. «Lo que está menos probado es que así mejoren las reglas» → «No está probado que así mejoren las reglas: el estudio más directo no encontró mejora significativa [18]».
2. «Lo único que no conviene automatizar es aprobar la regla nueva. Los agentes engañan al corrector cuando pueden» → «Todavía no conviene automatizar el lazo: primero el banco y los tres brazos a mano (opinión, coincide con f17). Hay casos publicados de agentes que engañaron al corrector, sobre todo con consignas ambiguas [5][20][21]».
3. «Con eso, GPT-5.5 pasó…; con Opus, el reintento no mejoró» → sumar «es reparar cada diseño, no aprender entre diseños» y «con Opus 4.7, en pieza única, empeoró apenas; en otra prueba, mixto».
4. «Las reglas que escribe la IA rinden menos que las curadas» → «Sin devolución no ayudan; con corrector mejoran contra nada, pero quedan debajo de las curadas [1][3][10]».
5. «~10 ocultos» → subirlos a 20–26, o aclarar que con 10 el lazo no demuestra nada y que lo que produce es un borrador para Fak [18].
6. «Cada contexto agregado sube el costo 20–23 %» → «Sumar un archivo de contexto subió el costo 20–23 %».
7. «con huella verificada antes y después [22]» → «con huella verificada (opinión de f17); [22] recomienda restringir qué se edita (fuente sin abrir)».
8. «Esta práctica no gasta API [8]» → «… (opinión)».
9. «subió de 68,9 % a 72,1 %» → sumar «(proponedor gpt-5-mini; una configuración bajó a 66,7 %)».
10. «el juez visual va último» → sumar «aunque en [9] un juez con 21 vistas, más medidas, fue la primera mejora grande con GPT».
11. «evolucionar reglas no le ganó…» → «evolucionar el arnés del agente, en tareas de terminal, no le ganó…».
12. «solo vi el título» → «f17 solo vio el título».
13. «Facundo» → confirmar contra el pedido, o usar «Fak».
14. Resolver qué papel tiene el virolador: caso con defectos, base buena para los mutantes o regresión.
15. Agregar una sección con tres partes (confirma / contradice / no se nos ocurrió), con los niveles de confianza de cada frente y las causas de raíz.
16. Agregar un glosario corto y pasos concretos para instalar y conectar GEPA y el corrector.
17. Contrastar con interna.md todo lo que cita [25], antes de publicar.
