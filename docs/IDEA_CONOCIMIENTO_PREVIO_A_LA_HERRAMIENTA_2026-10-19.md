# Idea de Fak: el conocimiento del OFICIO que va antes de la herramienta (19/10/2026)

Estado: **idea anotada, sin diseñar ni implementar.** Es el encargo para el equipo de investigadores del viernes 23/10:
que piensen CÓMO implementarla. No se decidió nada todavía; lo que está acá marcado «a confirmar» es mío, no de Fak.

## La idea, con sus palabras

Fak, 19/10/2026, en dos mensajes seguidos (el segundo corrige cómo la había entendido yo):

> «me gustaría que en general detectes los huecos de conocimiento para automatizar en general las cosas... qué
> conocimientos tenés que tener antes de tocar los planos 2D de mi trabajo? skills? etc... todo eso está hoy en día
> en el código? probablemente no, no creo que hayamos creado eso... y tiene que estar porque aplica para todo... cuando
> detectemos esos huecos debemos completarlos más temprano que tarde»

> «no sé si entendiste bien la idea porque en realidad lo que pido no es hueco en diseño 3D por ejemplo, pido huecos de
> conocimientos de criterio de diseñador 3D, entendés? por ejemplo algo previo a eso: no podemos crear cosas y no
> entenderlas, no podés usar herramientas sin conocimientos del tema, entendés? no podés hacer BOMs sin conocer de
> diseños de tizadas, cálculos de consumos... anotalo de esa forma que un grupo de investigadores solo piense para
> pensar cómo implementarlo; lo importante es dejar anotada la idea bien completa»

Y un tercer mensaje, el mismo día, que suma la otra mitad:

> «y sí, obviamente también mejorar la skill, ya es parte, no? o sea... mejorar el uso de AutoCAD etc etc, sí,
> obviamente hacer nuevos exámenes, mejorarse, investigar nuevas herramientas, que seas vos el que piense todo eso,
> que seas vos, entendés?»

Y lo remarcó: *«sí, es la clave dominar la herramienta también, ambas cosas, entendés?... ambas cosas van juntas de la
mano»*.

O sea, **son dos capas y van juntas, de la mano, con el mismo peso**: (1) el conocimiento del oficio antes de la herramienta y (2) la herramienta misma
(mejorar las skills de uso —AutoCAD, CATIA, arb…—, exámenes nuevos, investigar herramientas nuevas). **Y el que lo piensa,
lo detecta y lo propone soy yo, no Fak**: él no tiene que ir pensando qué me falta.

## Qué es y qué no es

| No es (ya existe, en parte) | Es (lo que falta) |
|---|---|
| Saber USAR la herramienta: CATIA por programa, cargar el arb, generar un flujograma, exportar un DXF | El conocimiento del TEMA que hace falta antes de usarla: el criterio, los fundamentos, el «por qué» |
| Una skill que dice qué botón tocar o qué script correr | Saber qué está bien y qué está mal en lo que la herramienta produce |
| Un examen de la herramienta («la viga da 0,80 mm») | Un examen del criterio («este diseño no se puede fabricar / esta BOM no cierra con la tizada») |

Dicho en una frase: **no se crea algo que no se entiende, y no se usa una herramienta sin conocer el tema.**

## Los ejemplos que dio Fak

1. **Diseño 3D**: antes de diseñar en CATIA, el **criterio de diseñador**. Saber usar CATIA no alcanza para diseñar.
2. **BOM**: no se hace una BOM sin conocer el **diseño de tizadas** y los **cálculos de consumo**.
3. **Planos 2D de su trabajo**: qué hay que saber ANTES de tocarlos.
4. Y dijo que **aplica para todo**: cada tipo de trabajo tiene su conocimiento previo.

## Por qué importa (lo que dice Fak, y lo que se vio hoy)

- Fak quiere pasar a dar solo «el concepto o la idea en general» y que yo «corrija y sepa cómo hacer el diseño»; él
  como cliente y yo como diseñador, incluso simulando que funcione (mensaje del 19/10 anotado en la lista de la semana).
  Eso es imposible sin el conocimiento previo: con planos completos alcanza la herramienta; con una idea hace falta el
  criterio.
- Hoy, en la práctica de CATIA, los errores fueron casi todos de LECTURA y de CRITERIO, no de herramienta (leer un
  plano, elegir la lectura que tiene sentido); y la herramienta sola da números falsos sin avisar (la malla por defecto
  da −66 % en una simulación). Hace falta criterio para darse cuenta. *(dato mío, medido en la práctica del 19/10)*

## Lo que el equipo tiene que pensar (preguntas, no respuestas)

1. **Detectar el hueco**: ¿cómo me doy cuenta, ANTES de una tarea, de que me falta el conocimiento previo del tema? Hoy
   lo único parecido es la regla «la primera vez se pregunta» (`autonomy-contract.md` §F), que frena y pregunta pero no
   detecta qué falta ni lo completa. Problema conocido: no sé lo que no sé.
2. **Representarlo**: ¿dónde vive ese conocimiento? ¿Una parte «fundamentos / criterio» dentro de cada skill, un mapa
   por tipo de trabajo, otra cosa? ¿Cómo se relaciona con las skills que ya existen (`cad-design`, `leer-planos`,
   `patrones-corte-plotter`, `verificacion-consumos`, `carga-arb`, `amfe-domain`…)?
3. **Completarlo**: ¿de dónde sale? Los manuales de la casa (`4- MANUALES`), normas, el SGC, compañeros (Pablo Gamboa en
   corte, Carlos, Calidad), cursos, casos resueltos por Fak. ¿Cómo se completa «más temprano que tarde» sin que Fak tenga
   que pensarlo todo?
4. **Probarlo**: ¿cómo se demuestra que el criterio está? Para la herramienta sirve un caso con respuesta conocida;
   para el criterio, *a confirmar*: casos reales ya decididos por un ingeniero de la casa, donde se ve si llego a la misma
   decisión y por qué.
5. **Cuándo se usa**: ¿se mira antes de cada tarea, solo en las nuevas, o lo pide Fak?
6. **Por dónde empezar**: los tres ejemplos de Fak (criterio de diseñador 3D, tizadas y consumos antes de la BOM, planos
   2D de su trabajo).
7. **La capa de la herramienta**: ¿cómo se mantiene viva cada skill de uso (AutoCAD, CATIA, arb, plotter…)? Exámenes
   nuevos que la pongan a prueba, mejoras cuando un examen falla, e investigar herramientas nuevas que hagan mejor el
   trabajo. ¿Cada cuánto, disparado por qué?
8. **Que lo piense yo**: ¿qué mecanismo hace que yo detecte y proponga los huecos (de oficio y de herramienta) sin que
   Fak tenga que pensarlos? (El viernes ya es día de planificación con el equipo «fuera de la caja»: ¿entra ahí, o
   necesita algo propio que corra durante la semana?)

## Lo que NO se decidió

Nada de la forma. Ni el formato, ni dónde vive, ni cómo se detecta, ni cómo se prueba. Es un cambio grande del sistema
(regla `codigo-madre.md`): investigación con fuentes, plan, síntesis corta a Fak y su sí antes de implementar.
