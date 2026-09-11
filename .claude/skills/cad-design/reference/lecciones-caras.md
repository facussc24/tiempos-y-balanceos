# Las 39 lecciones caras del trabajo 3D en Barack

El porque de cada gate de `../SKILL.md`. **Se lee antes de modelar**, no despues de que un gate de
rojo: casi todas salieron de una entrega rechazada por Fak o por una revision independiente, no de
un error de calculo. Los casos fuente de los gates 3.5, 4, 3.6, 3.7 y 3.8 estan ademas en la
memoria `reference_cad_gates_casos_fuente_2026-08`.

## 5. Lecciones caras (el porqué de todo esto)

1. Confirmá CUÁL pieza ANTES de modelar (modifiqué la torre equivocada por adivinar).
2. Ensamble COMPLETO, no export parcial (sin él no se ven colisiones ni clips).
3. "Más presión" ≠ clavar la cara en la pared rígida: la ATRAVIESA. La presión sale del
   ángulo/cuña; interferencia solo contra compresión del material BLANDO (1-2 mm).
4. Luz de impresión: 0,3-0,5 mm/lado o el fixture impreso raspa/traba.
5. El ojo de Fak gana: "esto choca" = dato duro; reproducir y corregir, no defender el CAD.
6. **Una abertura NO se busca con `--find`** (2026-07-31, buscando ranuras): `--find` caza
   caras finas (grabados); con `--max-diag` grande escupe un cluster de 1465 caras que no dice
   nada. Las ranuras son **lazos internos** de la cara → `find_openings.py`. Y para ver cómo es
   una cara clase A: scatter de centroides de triángulos con normal +Z coloreados por Z — las
   aberturas aparecen como huecos, en segundos.
7. **El entregable impreso no va en coordenadas del cliente** (mismo día): entregué dos piezas en
   el frame del cliente, inclinadas y a metros del origen. Van apoyadas en z=0 y centradas →
   `a_plano.py` (paso 6 del flujo). El control de que no se tocó geometría es el **volumen idéntico**.
8. **Logo del Upper Trim (2026-07-31): 1 h 20 buscando un grabado a ojo en renders de 9 M de
   triángulos, y encima con el número MAL** — reporté −0,700 mm (el rebaje del pad) cuando la
   profundidad real es 0,000 mm: `removeEntities` no había recortado nada, así que "la cara con
   más nodos" era la clase A de alrededor y no el pad. Con las sondas del §3bis: 14 segundos y
   el dato correcto. Antes de mallar, leer la topología.

Las 9-17 salen del virolador del Upper Trim (08/2026, tres rondas: resorte → rígido → anillo):

9. **`addThruSections` con el default (spline) SE ABOMBA entre secciones.** Con secciones
   A, A, B la superficie infla entre las dos primeras: el macho midió 13,088 contra una ranura
   de 12,982 — 0,05 mm METIDO en la pared en vez de 0,09 de luz. `makeRuled=True` siempre que
   las secciones deban unirse recto. Se caza midiendo el sólido resultante, nunca asumiendo.
10. **Quitar un agujero puede SELLAR una cavidad interna.** El vaciado de la base era una
    cavidad que dos agujeros M5 ventilaban de casualidad; al sacar los M5 quedó aire encerrado:
    cuerpos de volumen NEGATIVO en el STL que el laminador tapa a ciegas. Gate en
    `export_deliverables.py`: `split()` → 1 cuerpo, 0 volúmenes negativos, o no entrega.
11. **Boolean con caras exactamente coincidentes deja la malla no-manifold** (watertight rojo
    sobre una pieza que antes cerraba). Solape de 0,05 mm en todo fuse de piezas apoyadas.
12. **El orden de construcción importa:** lo agregado ANTES de los cortes se lo comen los
    cortes (un alma quedó de 0,30 mm — menos de un cordón, no imprime). Los agregados que
    deben sobrevivir van DESPUÉS del `cut`, como fuse final. Y un fuse que debe dejar piezas
    SUELTAS (tope con luz) se verifica midiendo la luz en el resultado a varias alturas.
13. **Medir la luz de un anillo: el rayo desde el centro pega en la cara INTERNA.** Dio "luz
    2,550" sobre una pieza con luz 0,15 — y 2,550 = 0,15 + 2,40 (luz + espesor). **Un resultado
    que es la SUMA exacta de dos cotas conocidas es un error de cara, no un dato.**
14. **Un calibrador que se ajusta midiendo la pieza construida se CONTAMINA** si la pieza trae
    un agregado que su modelo no representa: el alma le subía k al flanco y el calibrador
    "corregía" hacia atrás (proponía volver a 157 kPa). Calibrar contra una referencia
    construida SIN el agregado, y guardar la calibración contaminada con nombre que lo diga.
15. **Dos controles que se contradicen no topean el diseño: lo dejan en el peor de los dos.**
    A7 exigía poder bajar a 70 kPa (estrategia vieja de 3 durezas) y A8 llegar a 200: ninguna
    pieza cumplía ambos y el optimizador entregaba EN SILENCIO la más blanda que pasaba A7 —
    59 kPa. Peor: una corrida había bajado la barra de 200 a 30 "para que cierre". Cuando el
    usuario cambia la ESTRATEGIA, buscar los controles que codificaban la vieja, no solo los
    parámetros. Bajar la barra hasta que el control pase no es calibrar.
16. **La banda de medición excluye el radio de entrada de la feature.** La boca redondeada de
    la ranura metía 17,03 mm en la estadística de una ranura de 12,95 y "midió" un abarrilado
    de 4,25 mm que no existe (el real, el desmoldeo, era 0,23). El dedo tampoco toca ahí.
17. **Nada de vida útil calculada en un entregable.** La fatiga sirve como criterio interno
    go/no-go; "dura X años" salido de una curva de bibliografía NO se afirma (Fak, 18/08:
    "dejá de decir pelotudeces como vida a fatiga"). Se entrega lo MEDIDO y el control físico
    (galga/calibre) para que el desgaste se detecte, no se prediga.
18. **El STEP del cliente es la pieza TERMINADA: el tapizado también cubre las caras de
    APOYO, no solo la feature que se trabaja.** (19-20/08, el "queda flotando".) Los apoyos
    de la v12 se midieron contra el sólido desnudo y sobre esas caras va una capa de 0,500
    (medida: 100 % de las zonas de apoyo, los dos steps) → pedestal 0,25-0,44 METIDO en el
    vinilo, panel flotando sobre material blando, anillo con ~0,75 de su banda de 1,2. UN
    error, los dos síntomas que reportó Fak. Tres reglas que deja: (a) toda superficie del
    utillaje que ENFRENTA al panel se cota contra la superficie real = sólido − capa —
    el mismo control A0b que ya existía para la ranura aplica a TODOS los contactos;
    (b) en un utillaje rígido **el tope de inserción ES el apoyo** (holgura chica 0,05
    para test e impresión, no 0,25 "para no marcar": eso deja la cadena de apoyo
    indefinida); (c) una capa a offset constante clasificada como "superficie de
    construcción" puede ser el MATERIAL real — la clasificación geométrica no le gana al
    síntoma físico, y la cara de apoyo puede además estar INCLINADA (0,78° acá): el tope
    plano se fija donde toca primero, medido por huella, no en la meseta de otro lado.

19. **El bounding box del CAD MIENTE sobre una pieza de NURBS recortadas — y mintió sobre la
    pieza de un proyecto real.** (2026-08-24, Insert SAB1740.) `gmsh.model.getBoundingBox` y
    `BRepBndLib` sin triangular acotan la superficie ENTERA sin recortar, no el trozo que
    existe: reportaban **625,11 × 86,32 × 289,96** para una pieza que mide **552,73 × 58,01 ×
    151,01** — el alto salía **1,9 veces** más grande. No es un redondeo: cambia el círculo de
    barrido, el balanceo y el tamaño del utillaje entero. El número inflado ya había viajado a
    un documento de ingeniería de la empresa y a una memoria mía.
    - **El síntoma que lo delata es gratis:** volumen y bbox tienen que ser compatibles. 219,30 cm³
      con pared media 2,27 mm son ~966 cm² de superficie media; la proyección de 625 × 290 sola
      ya da 1810 cm² — imposible. Con 553 × 151 (834 cm²) cierra. **Cuando el bbox y el volumen
      no se pueden dar la mano, el que miente es el bbox.**
    - Arreglado en `cadlib.geom.bbox_medido()` (muestrea las CURVAS de borde, que sí están
      recortadas exactas) + `aviso_bbox_inflado()`, y `analyze_step.py` ya reporta el medido y
      avisa. Concuerda con la triangulación fina (deflexión 0,1) en 0,02 mm sobre 552,73.
    - **Test del valor gemelo, y pasa:** sobre un STEP de cajas y cilindros primitivos el aviso
      da 0 y las cotas no cambian; sobre la pieza del cliente da 92 % y 99 %. Un control que
      avisara siempre no serviría.
    - Regla que deja: **toda cota que sale de un archivo de cliente se cruza contra una segunda
      magnitud** (volumen, área, masa) antes de usarla. Cuatro métodos coincidiendo (nodos de
      malla a dos lc distintos, triangulación OCC fina, muestreo de curvas) valen más que uno
      que "es el que siempre usamos".

20. **Un DISPOSITIVO no es una pieza impresa, y los gates de pieza le mienten.** (2026-08-24/25,
    dispositivo de adhesivado del Insert.) Cinco trampas, todas encontradas por control y
    ninguna a ojo:
    - **El gate de "1 solo cuerpo" es de pieza impresa.** En un ensamble las piezas van con luz
      a proposito, asi que el STL fusionado tiene tantos cuerpos como piezas y el gate lo
      rechaza. Lo que se valida es **cada pieza por separado** (1 cuerpo, cerrada, volumen
      positivo) y la envolvente solo sirve para interferencia.
      **IMPLEMENTADO el 2026-09-03, y CORREGIDO el mismo dia** — leer esto entero antes de
      tocar el techo de ese gate. Primero puse el techo en **`_contar_solidos(step)`**, y una
      auditoria independiente lo tumbo en corrida a las horas: **el techo y lo que se mide
      salian DEL MISMO ARCHIVO**. Un fuse que falla y deja 2 solidos da un STEP que declara 2
      y un STL con 2 cuerpos: coinciden SIEMPRE, el gate no dispara nunca, y encima imprimia
      *"es un ENSAMBLE, no una pieza partida"*. Para el bug que el control existe para cazar
      quedaba **tautologico** — y con el techo viejo (1 fijo) ese caso daba ROJO. Es la
      leccion 24 otra vez: subir el umbral hasta que el problema desaparece APAGA el control.
      Ademas cualquier resto de geometria de construccion olvidado en el STEP (un sliver
      disociado) subia el techo solo. **Como quedo: el techo es 1 salvo que una PERSONA
      declare `--ensamble NOMBRE:N`**, que se coteja contra los solidos del STEP y queda
      escrito en la evidencia `delivery` del manifest junto con los cuerpos medidos. Las
      cavidades selladas siguen siendo rojo SIEMPRE. Par BIEN/MAL: `test_gate_cuerpos.py`,
      **5 casos, 3 rojos**, y el 5o es el fuse roto que se colaba. **Lo que esto enseña de
      metodo: un techo que se lee del mismo archivo que se esta juzgando no es un techo.**
      Ojo: la envolvente concatenada
      puede salir con **normales invertidas aunque cada pieza este bien** — con el volumen
      negativo, `signed_distance` da vuelta adentro/afuera y la pieza entera aparece "metida"
      6 mm en el nido (medio espesor de placa). Chequear el signo del volumen en el export.
    - **Los tubos trazados de EJE a EJE se interpenetran media seccion.** Un travesano que
      llega al eje del larguero se mete 20 mm adentro: en el modelo es un cruce y en el taller
      es un corte que no existe. Van recortados a la CARA, y ese largo recortado es el que va a
      la lista de corte. Para distinguir un cruce real de una union en T: el cruce es cuando el
      acercamiento minimo cae en el **interior de los dos tramos**; si cae en la punta de uno,
      es una union a tope. Sin esa distincion el control marca las 17 uniones del marco como
      defectos.
    - **Las piezas compradas tienen altura de catalogo.** Una rueda giratoria O125 con placa
      mide ~160 mm: modelarla como un cilindro tangente al piso dejo todas las alturas
      ergonomicas verificadas 160 mm por debajo de la realidad. Y los nidos apoyados sobre la
      **linea de centro** de los travesanos quedaban embutidos 20 mm dentro del cano. Las dos
      cosas se ven lindas en el render y son falsas.
    - **Un bucle de correccion tiene que ACUMULAR.** El que ajustaba la altura de los apoyos
      guardaba el desvio pelado: el build lo aplicaba, el desvio pasaba a 0 y el build
      siguiente volvia a dejar el poste sin corregir. Oscilaba en vez de converger, y el
      sintoma es que "converge" en la segunda pasada pero no se queda. **Correr tres pasadas y
      exigir que la tercera no se mueva.**
    - **Los travesanos van donde APOYA la pieza, no repartidos parejo.** Con `linspace` caian
      en 0/195,7/391,3/587 y los nidos ocupaban 0-169/209-378/418-587: los bordes quedaban en
      el aire. Centrando cada travesano en la luz entre nidos, un mismo tubo toma el borde de
      arriba de uno y el de abajo del siguiente.

21. **Antes de dimensionar un apoyo blando, hace falta la cuenta de la fuerza.** Puse 8 pads
    de gomaespuma O18 bajo una pieza de 250 g: 2036 mm2. Para que esa espuma se comprima el
    25 % nominal hacen falta ~6 N y la pieza apoya con 1,73 N a 45 grados — o sea que la
    espuma la **empujaba hacia afuera** del nido en vez de sostenerla. El area sale de
    `area = F_normal / CFD25` (2,5-4,5 kPa en PU celda abierta 25-35 kg/m3): dio 578 mm2, o
    sea **3 pads de O15,7**. Y de paso 3 es lo unico que define un plano sin hiperestatismo;
    los tres se eligen de modo que la proyeccion del centro de masa caiga DENTRO del triangulo
    (margen medido: 35,5 mm). Corolario del mismo error: un **tope** que no carga lleva la
    espuma SIN comprimir, asi que se cota con el espesor entero mas su luz — cotizarlo con el
    espesor comprimido dejaba el disco metido 1 mm en la pieza.

22. **La pieza de la mano contraria se verifica, no se supone.** El Insert tiene mano izquierda
    y derecha y sus dos barrenos de localizacion estaban casi simetricos (44,4 y 36,0 mm de
    cada punta): la duda de si la mano equivocada podia calzar era legitima. Se espeja el STL
    real y se prueban **las dos formas** en que un operario puede presentarla (vuelta sobre el
    eje largo y vuelta de punta a punta). Dio que los pines erran los barrenos por 8 a 76 mm y
    que traba a 10-20 mm de altura contra la correcta que no toca: **el nido ya rechaza la
    mano contraria** y no hace falta bloque anti-error. Sin la medicion habria agregado un
    poste que no servia para nada.

23. **La cobertura de un rociado es una pregunta de acceso y se puede simular.** Antes de
    aceptar que un dispositivo tiene que girar, medir cuanto agrega girar: rayos desde un cono
    de posiciones de pistola, con umbral de incidencia y linea de vista contra la pieza Y el
    utillaje. En el Insert dio **+0,2 puntos porcentuales**, o sea que el giro no se paga. El
    resultado solo vale si aguanta la sensibilidad: se repitio con umbrales de incidencia
    30/45/60 grados y conos de +/-45 a +/-100, y con la cara A mirando abajo la cobertura se
    derrumba de 98,9 % a 0,0 % (el control puede dar rojo). **Ojo con la resolucion:** con el
    rayo saliendo 0,4 mm de una grilla de 3 mm quedaban 69 celdas "inalcanzables" que
    desaparecen al salir 3 mm — eran la grilla, no una sombra. Eso se demuestra con un barrido
    del offset, no se afirma.

24. **Subir la tolerancia de un control hasta que el problema desaparezca no lo corrige: APAGA
    el control.** (2026-08-25, revision independiente del dispositivo de adhesivado. Es la
    leccion mas cara de esta serie porque el numero apagado ya estaba entregado.)
    - El caso: la simulacion de rociado sobre una grilla de 3 mm daba 69 celdas
      "inalcanzables". Subi la salida del rayo de 0,4 a 3 mm, las celdas desaparecieron, y
      publique **100 % de cobertura**. Con el offset honesto la misma posicion daba 98,93 %.
    - **El sintoma que lo delata es de logica pura y no cuesta nada mirarlo:** agregar
      obstaculos no puede MEJORAR una cobertura. El caballete con 12 piezas y un marco de
      acero daba 100,0 % y la pieza sola al aire 99,1 %. Cuando un resultado mejora al
      agregarle estorbos, el control esta roto, no la geometria.
    - **La causa raiz era el modelo, no el parametro.** Un campo de alturas `ymax(x,z)` pone
      el punto en el centro de la celda, que NO esta sobre la superficie: el rayo sale
      rozando la celda vecina. La correccion no es un offset mas grande sino trabajar sobre
      los **triangulos de la malla**, cada uno con su normal y su area, y sacar el rayo **por
      su propia normal** (0,2 mm alcanzan: por construccion no puede re-entrar). De paso se
      arregla solo el sesgo que tenia: el gradiente perdia 230 celdas y el 100 % de ellas
      estaba a menos de 20 mm del borde, o sea que el porcentaje se calculaba sin la franja
      que mas importa.
    - **A un modelo hay que exigirle que RESPONDA antes de creerle una diferencia chica.** El
      viejo daba el mismo 99,1 % con un cono de pistola de +/-30 que con uno de +/-100: no
      estaba midiendo accesibilidad, y sin embargo la decision de sacarle el giro al
      dispositivo se apoyaba en el. El nuevo da 96,4 / 97,5 / 98,0 / 99,8 / 100 % para
      +/-20, +/-30, +/-45, +/-60 y +/-100. **Barrer el parametro que DEBERIA mover el
      resultado es el control del control.**
    - **Y buscar el argumento que no dependa del simulador.** El motivo real por el que ese
      dispositivo no necesita girar es que el **95,8 % del area de la cara A tiene su normal
      a menos de 30 grados de la direccion de rociado y la mas inclinada llega a 88,2**: no
      hay una sola zona que mire para atras. Eso es geometria de la pieza, se calcula en
      segundos, y convierte a la simulacion en confirmacion en vez de en argumento.

25. **Un control que aprende a NO marcar los falsos positivos suele quedarse ciego para el
    verdadero.** (misma revision.) El detector de tubos cruzados marcaba las 17 uniones en T
    del marco, asi que le puse "solo cuenta si el acercamiento cae en el interior de los dos
    tramos". Con eso dejo de marcar las uniones sanas — y tambien las uniones en T **metidas
    20 mm adentro del larguero**, que es exactamente la falla que se queria cazar (dan
    tc = 0,000). Se le escapaban 4 de 5 casos inyectados.
    - La salida no es aflojar el filtro sino **separar las dos preguntas**: (A) cruce = el
      acercamiento minimo cae en el interior de los dos, y (B) penetracion = la PUNTA de uno
      cae adentro del volumen del otro. Son fallas distintas y se buscan distinto.
    - Sacar tambien los factores de correccion inventados: el limite era (a1+a2)/2 * 0,72 y
      dejaba **12,2 mm de solape ciego** entre dos tubos de 40. Con (a1+a2)/2 pelado, un tubo
      tangente queda justo en el limite y uno que se pisa cae por debajo.
    - **El autotest de un caso no vale.** El que tenia probaba "un tubo que cruza por el
      medio", el unico que el control si detectaba. Ahora inyecta cinco fallas distintas
      (cruce al medio, cruce cerca de la punta, colineal solapado, union en T penetrada, ejes
      a 30 mm) y tiene que cazar las cinco.

26. **Tres cosas de armado que no se ven en el render y las encuentra el control:**
    (a) **el recorte a tope NO es lado/2** salvo que los tubos se encuentren a 90 grados: en
    angulo es (lado/2)/sen(theta), y con el recorte fijo las patas y los travesanos del
    vertice quedaban 5,9 mm metidos adentro del larguero;
    (b) **todo tramo tiene que TOCAR algo** — las manijas quedaron 20 mm afuera del larguero,
    flotando, y ningun control lo miraba porque todos buscaban solapes, no huerfanos;
    (c) **los travesanos van donde apoya la pieza**, no repartidos parejo con `linspace`.
    (d) **un tubo que llega en angulo no se ACORTA: se corta con un PLANO.** Acortar el eje
    deja las esquinas de la seccion metidas adentro del otro — 14,14 mm en un empalme a 45
    grados. En el taller eso es un inglete;
    (e) **el largo de la lista de corte se mide entre PLANOS DE CORTE, no entre nodos.** El
    X-brace del piso figuraba 1606,9 y el real era 1548,0, con 11 de 33 tramos mal. Con ese
    numero el herrero corta de mas y la pieza no entra;
    (f) **la orientacion de la seccion se fija a proposito.** Si la elige una convencion del
    codigo aparecen cortes compuestos que nadie puede ejecutar, y una diagonal se come 8 mm
    de un travesano. Y en una **esquina** donde las dos puntas coinciden no se corta ninguna
    de las dos, o el rincon queda hueco.

27. **La POBLACION sobre la que medis decide el resultado mas que el metodo.** (Dispositivo
    de adhesivado, 08/2026 — el error mas caro de ese trabajo, y lo encontro una revision
    independiente, no yo.) Defini "la cara a rociar" como *lo que se ve primero mirando
    desde arriba* y ademas forcé las normales hacia el frente. Con esa definicion la pared
    del borde —que solo se ve en angulo— **no podia entrar**, y ninguna normal podia pasar
    de 90°. El 99 % de cobertura que reporte, y la conclusion "girar no aporta", eran
    **techos del modelo**, no propiedades de la pieza.
    - Rehecha por PROCESO (se engoma lo que toca el recubrimiento, medido contra el otro
      solido del STEP) la misma pieza dio 82,8 % sin girar. Tres tolerancias distintas, mismo
      resultado. **Una conclusion que cambia 16 puntos al cambiar la definicion de la
      poblacion no era una conclusion: era la definicion.**
    - Y despues hubo que partirla otra vez: 90 de esos 451 cm² miran para atras y **ningun
      utillaje los alcanza con la pieza apoyada** (atras es siempre el nido). Sobre lo que si
      se puede resolver, girar aporta +0,4. **Antes de comparar dos disenos, separar lo que
      el diseno puede cambiar de lo que no.**
    - Regla: la poblacion se define por el PROCESO (que se moja, que se pega, que se mide),
      nunca por lo que es comodo de calcular. Y se declara arriba del resultado, siempre.

28. **Cuatro veces seguidas escribi un control que no podia dar rojo.** Y las cuatro el
    autotest "generico" pasaba igual. El patron:
    - `gate_giro`: 0,00 mm en los 72 angulos — la luz no dependia del giro.
    - chequeo de marco: dos guardias (`comparten punta`, `entre 2 % y 98 %`) que tapaban
      justo las penetraciones reales. Una revision le inyecto 5 casos nuevos: **cazo 1**.
    - autotest de basculacion: bajaba el eje, cuando lo que topeaba era AXIAL.
    - cobertura: el autotest daba la pieza vuelta, que el modelo ya no podia representar.
    Es la misma familia que las lecciones 24 y 25, vista cuatro veces seguidas en un
    solo trabajo.
    **El valor gemelo tiene que ser la falla REAL de ESA geometria, no una perturbacion
    cualquiera.** Se elige preguntando "¿que tendria que estar mal para que esto fallara en
    planta?" y se inyecta ESO. Si el control sigue verde con la falla puesta, el control se
    tira, no se ajusta el umbral.

29. **Un bucle de autocorreccion que PISA en vez de acumular oscila, no converge.** El ajuste
    de altura de los apoyos guardaba el desvio pelado; el build lo aplicaba, el desvio pasaba
    a 0, y el build siguiente volvia a dejar el poste sin corregir. Se veia "0,00" mirando una
    sola pasada. **Se prueba corriendo TRES pasadas y exigiendo que la tercera no se mueva.**

30. **Abrir el archivo correcto no es usarlo.** (2026-08-28, dispositivo de adhesivado del
    Insert. Lo vio Fak de un vistazo: *"ojo que no estabas usando los 3D reales del insert"*.)
    El STEP del cliente estaba ahi, con el md5 del servidor. Pero TODA la geometria del nido
    salia de una cadena de proxys: malla `lc=3` -> grilla de 3 mm por **binning de vertices**
    -> contorno por marching squares -> **media movil de 5 puntos**. Sobre esa sombra pixelada
    se cortaba la placa CNC, se elegia la altura de los apoyos, se detectaban las torretas y
    se juzgaba la luz de los pines.
    - Lo que costo, medido: el contorno se desviaba hasta **5,01 mm** del real (mediana 1,71),
      con bbox 555,00 x 153,00 sobre una pieza de **552,71 x 151,00** y perimetro 1326,4 contra
      **1296,7**; la silueta figuraba 718,2 cm2 y son **695,3**. La orla de **6,00 mm** con la
      que se diseño la placa era en realidad de **1,70 a 6,92** (mediana 3,78). El area de
      torretas venia inflada **61 %** (4266 -> 2649 mm2). Las alturas de cara B usadas para los
      postes erraban hasta **8,97 mm** sobre un pad de espuma de 12.
    - **El control lo confesaba y nadie lo leyo.** El docstring de `verificar_nido` decia que
      con `lc=3` un O3,50 queda en 3 facetas con 0,51 mm de flecha, *17 veces* la luz de 0,05
      que ese mismo control decia verificar. Un control que explica por que no puede medir lo
      que mide **no es un control**: o se arregla la entrada o se saca.
    - **La resolucion de cada paso intermedio se declara AL LADO del numero, y se compara
      contra la tolerancia del entregable.** 3 mm de celda para cotar una placa de CNC y 0,05
      de luz de pin no conviven.
    - Como se arregla cada eslabon: silueta **exacta** (union de los triangulos proyectados)
      en vez de marching squares; muestreo por **AREA** en vez de binning de vertices; ventana
      de filtro en **milimetros** (45), no en celdas; y **Douglas-Peucker con tolerancia
      declarada** en vez de media movil — suavizar no tiene tolerancia, simplificar si.

31. **Tres formas de que una eleccion de diseño no sea una eleccion** (mismo trabajo, las tres
    aparecieron el mismo dia):
    - **Un INDICE no es un criterio.** El trio de apoyos vivia en `params` como
      `apoyos_trio: [5,6,8]`. Al re-medir la pieza la lista de candidatos cambio de largo y de
      orden, y esos tres numeros pasaron a apuntar a otros puntos **sin que nada fallara**. Lo
      que se guarda es el criterio; los indices los deriva un script.
    - **Un muestreo sin semilla vuelve el entregable irreproducible.** `sample_surface` usa el
      RNG global: tres corridas del mismo script sobre el mismo STEP dieron triangulos de apoyo
      de **144,3 / 159,9 / 190,5 cm2**. Un auditor que reproduce y no da lo mismo tiene razon.
    - **Y la semilla sola no alcanza si la eleccion la decide un desempate.** Tomar "los 8
      maximos de la transformada de distancia" con `argsort` deja la decision en manos del
      orden de empate. La salida no es estabilizar el desempate: es **enumerar todo el conjunto
      factible** (grilla de 10 mm sobre la superficie donde el pad entra entero, 155 posiciones)
      y **optimizar** sobre el — 120.284 trios validos, optimo 205,5 cm2 y 48,2 mm de margen,
      contra 11,0 cm2 y 0,0 mm del peor valido. Ahi el valor gemelo sale gratis y separa solo.

32. **Medir contra los VERTICES lo que se aparta de los SEGMENTOS rechaza lo que esta bien.**
    El control de la simplificacion del contorno reportaba **59,88 mm** de desvio sobre una
    poligonal que respetaba 0,1: con tramos de ~28 mm, el punto del medio esta a 14 mm del
    vertice mas cercano y a 0,02 de la recta. Es la leccion 13 (el rayo que pega en la cara
    interna) con otra ropa: **antes de creerle un numero grande a un control, mirar contra QUE
    lo esta midiendo.** Y el gemelo de ese control no es mover un vertice —si el movimiento cae
    a lo largo del borde no cambia nada—: es correr la MISMA simplificacion con la tolerancia
    20 veces mas floja y exigir que la mida.

33. **Antes de agregarle un MECANISMO a un dispositivo, barre los parametros ESTATICOS que
    hacen lo mismo.** (2026-08-28, caballete de adhesivado.) El basculante compraba +4,6
    puntos de cobertura en el frente y +14,2 en el borde, y con eso la discusion era "¿vale
    un eje con rodamientos?". La pregunta estaba mal planteada.
    - **Lo que la desbloqueo fue separar dos causas que el porcentaje mezcla:** de lo que
      faltaba, ¿cuanto es *nadie puede llegar ahi* y cuanto es *algo se interpone*? Se mide
      tirando los rayos contra cada cuerpo por separado en vez de contra la escena
      concatenada. Dio **16,71 de 16,75 cm2 del primer tipo**: el marco, las piezas vecinas
      y los nidos vecinos juntos tapaban 0,04. **Cuando lo que falta no lo tapa nadie, la
      respuesta no es sacar un obstaculo: es cambiar como esta PRESENTADA la pieza.**
    - La inclinacion de las caras era 45 grados **por decision, no por calculo**, y cambiarla
      no cuesta nada: es como se sueldan los largueros. Barrida de 15 a 75 grados, a 30 el
      caballete FIJO da 98,7 % de frente y 99,5 % de borde — lo mismo que el basculante — y
      el mecanismo pasa a valer **+0,2**.
    - **Y el escalon se corre con el parametro que uno asumio.** Repetido con conos de
      pistola de +/-70, 85, 100 y 120 grados, el angulo al que aparece el salto se mueve:
      con +/-85 hay que bajar a 20 grados, y con +/-70 no llega ninguno. O sea que la
      conclusion honesta no es "30 grados" sino **"inclinacion y alcance del operario se
      compensan"**, con la tabla al lado. Lo que si vale bajo las cuatro hipotesis, y por eso
      se puede afirmar: **45 era peor que mas plano en todas.**
    - Regla: cuando un mecanismo se justifica por una diferencia de porcentaje, listar
      primero los parametros que ya existen y no cuestan nada, y barrerlos. Un grado de
      soldadura es mas barato que un rodamiento.

34. **Un control tambien puede dar ROJO por su propia resolucion, y eso NO se arregla
    subiendo el umbral.** (Misma noche.) El detector de "tramos sueltos" reportaba 1,5 a
    1,7 mm en una junta que apoya **cara contra cara**, con luz cero: sembraba solo las
    cuatro caras LATERALES del tubo y no la cara de la punta, asi que el punto mas cercano al
    corte quedaba a medio paso de muestreo (2 mm) del plano de contacto. **Estaba midiendo su
    propio paso.**
    - La tentacion es subir `LUZ_CONTACTO` de 1 a 3 mm y seguir. Eso apaga el control (§24).
      Lo que corresponde es **sembrar la superficie completa**: la cara de la punta es
      superficie del tubo como cualquier otra.
    - Es el hermano de §28 y hay que buscarlo igual: **antes de creerle un numero CHICO a una
      medicion muestreada, comprobar que el muestreo cubre la feature que se esta midiendo.**
      Un contacto tangente se mide en la tangencia; si ahi no hay puntos, se mide el paso.

35. **Un arriostramiento que se toca A SI MISMO no esta arriostrando nada.** La cruz del piso
    del caballete tenia las dos puntas retiradas 150 mm en X **y** en Y para que no cayeran en
    la esquina: con eso quedaron flotando en el medio del hueco de la base, sin tocar ningun
    tubo. **El control de "tramos sueltos" no lo veia porque los tres tramos de la cruz se
    tocaban ENTRE SI**, y para el control eso ya es "toca a otro". Aparecio recien al cambiar
    la inclinacion, cuando dejaron de tocarse — o sea por casualidad.
    Regla: **un elemento que existe para unir A con B se verifica contra A y contra B, no
    contra "¿toca algo?"**. Y el retiro para no caer en un nudo se hace sobre UNA coordenada:
    retirar sobre las dos saca la punta de la pieza que tenia que tocar.

36. **LA ZONA QUE UN CONTROL EXCLUYE A PROPOSITO QUEDA SIN CONTROL.** (2026-09-03, carro
    giratorio de adhesivado del Insert. Es la leccion mas cara de esta tanda porque la
    exclusion estaba declarada, comentada Y contada, y aun asi tapo una interferencia dura
    durante dias.)
    - El caso: `verificar_giro_carro.py` excluye del barrido todo lo que esta a menos de
      32 mm del eje, con el motivo escrito (*"el nido va CALZADO en su eje: sus munones y el
      eje se tocan a proposito"*) y con el conteo de puntos excluidos impreso en cada
      corrida. Nadie miro **adentro**. Ahi el nido tenia un munon macizo O16 que quedaba
      ENTERO dentro del eje O20 del carro, y el eje ademas atravesaba una oreja de 90x90x10
      **sin agujero**. Ni el render ni el barrido de giro podian verlo: los dos miran los
      nidos contra el marco, y esto pasaba en la junta.
    - **Toda zona que un control saca de su universo necesita SU PROPIO control**, o la
      exclusion es una alfombra. El que se escribio (`verificar_calce_eje.py`) mide las dos
      cosas que hacen falta y que son distintas: **que no se pisen** y **que SI se toquen**
      — "0 puntos dentro" lo cumple igual un utillaje flotando (la leccion del 2026-08-07,
      otra vez). Su gemelo levanta el nido 5 mm: ahi deja de tocar y el control lo dice.
    - **Un muestreo no le gana a un booleano.** El "¿pasa el eje?" no se resolvio con rayos
      ni con nubes: se corta el cilindro del eje real contra el solido del nido y se mide el
      volumen de la interseccion. Da **0,000 cm³**, y el gemelo (el mismo eje 25 mm fuera de
      centro) **6,1 cm³**. Donde haya un booleano exacto disponible, el muestreo sobra.
    - **Partir el modelo en "lo que se mueve" y "lo que no" es en si mismo un control.** Al
      exportar el carro en tres grupos (`fijo` / `rot` / `traba`) para poder animarlo, la
      separacion por componente conexa destapo **dos defectos mas** que ningun gate miraba,
      porque pasaban entre piezas del carro y no entre el carro y los nidos: la manivela
      estaba a **15 mm** de la punta de su eje (flotando: no movia nada) y su mango se metia
      **12 mm** dentro del disco indexador de la fila de arriba, con lo que las dos piezas
      salian FUSIONADAS en el STL. El control quedo escrito en el build: *tantos cuerpos
      rotantes como ejes, y cada cuerpo toca UN solo eje*. Un cuerpo de mas = algo suelto;
      un cuerpo que toca dos ejes = dos piezas que se pisan.
    - Corolario de diseño, no de codigo: **si el eje ideal no entra, la posicion del eje se
      DERIVA del hueco que hay, y el precio se calcula y se declara.** El eje "por el CG"
      era imposible (el CG cae 2,9 mm sobre la cara de la placa). Se centro en el hueco
      medido entre la placa y el punto mas bajo de la pieza (21,69 mm), quedo 7,97 mm sobre
      el CG, y eso cuesta 0,0986 Nm por nido = 3,7 N en la manivela. Un numero chico que se
      publica vale mas que un "pasa por el CG" que no es cierto.

37. **Un gemelo que CONVERGE al caso bueno no es un gemelo.** (mismo dia.) El de la
    simulacion de encastre multiplicaba x1,6 el desvio lateral **derivado del chaflan**, y
    ese desvio ya vale 0 en los ultimos cuadros: justo donde la pieza llega a la altura del
    piloto, el "gemelo" estaba perfectamente centrado y daba **0 puntos de choque, igual que
    el diseño**. Con el desvio CLAVADO en 1,6 veces la captura garantizada: 10. Es la
    familia de la leccion 28 con otra ropa — el gemelo se elige preguntando *que tendria que
    estar mal para que esto fallara en planta*, no perturbando el parametro que uno tiene a
    mano.

38. **EL AGUJERO DONDE APOYAS LA RETENCION PUEDE SER CIEGO — y la zona que un control
    excluye se repite hasta que se le pone SU control.** (2026-09-04, carro de adhesivado
    del Insert. Fak miro el render y dijo *"veo que como que atraviesa la pieza"*; tenia
    razon, y cuatro gates verdes no lo veian.)
    - Los "barrenos O5,6" eran **torretas de tornillo CIEGAS**: tubo O7,9/O5,3 abierto
      hacia la cara B y cerrado por 2,6 mm de pared del lado vista. El clip con cabeza
      asomando sobre la cara A atravesaba esa pared. Nadie habia tirado UN rayo por el
      eje del agujero: se llamaba "barreno", se diseño como pasante. **Pasante se mide
      (dos rayos por el eje, uno de cada lado, y el perfil de radios a lo alto); una
      pieza con `huecos: 0` en la silueta no tiene NINGUN agujero pasante**, y con eso
      la retencion positiva es imposible: queda FRICCION. Primera solucion: horquilla
      de POM abrazando la torreta por FUERA. **La revision independiente del mismo dia la
      cambio por un PIN CON O-RING que entra por DENTRO del agujero ciego** (leccion 39):
      la pared interior del agujero es superficie moldeada contra nucleo y varia menos
      que el diametro exterior, que es la cara donde pega el rechupe. En los dos casos la
      fuerza se estima con mu DECLARADO y se MIDE con dinamometro.
    - Por que no lo vio el control: A excluia todo lo que estaba a 8 mm del eje de un
      pin o clip ("dentro de un barreno es artefacto"). Es la leccion 36 por tercera vez
      en dos dias (munon en el eje, clip en la torreta, y despues el pin en la bajada).
      **Una exclusion no se declara por RADIO: se declara por CRITERIO** — en la zona del
      pin es artefacto solo lo que esta DENTRO del radio del barreno; en la de la
      horquilla, solo hasta el apriete de diseño; y el maximo de cada zona se reporta.
    - **Y la zona se mueve con la pieza.** Con las zonas fijas en la posicion nominal, un
      pin metido en la pared de la torreta (pieza corrida 1,5 mm) quedaba a r<1,8 del
      eje NOMINAL y contaba como "boca". Corriendo las zonas junto con la pieza: 6
      choques donde antes daba 0. Eso destapo que **la cadena de entrada no cerraba**:
      luz del piloto 1,5 contra ventana del cono del pin 0,55, y el piloto centraba
      2 mm ANTES del asiento cuando el pin tocaba la torreta 8 mm antes. La cadena que
      cierra: luz del guia <= ventana del pin, y la cara vertical del guia sube hasta
      canto + engrane + margen (medido que la pieza no se ensancha ahi). El gemelo que
      vale es la falla real —el guia con mas luz de la que el pin captura— no un desvio
      cualquiera: 0 choques el diseño, 25 el gemelo.
    - Lo que dejo de metodo: (a) **antes de disenar sobre una feature de la pieza, medir
      lo que la feature ES** (pasante/ciego, radio exterior, donde empiezan los nervios);
      (b) **un ensamble se entrega con 1 cuerpo por pieza soldada/atornillada**: el nido
      tenia 5 cuerpos (2 orejas y 3 pilotos SUELTOS) y el gate lo dejo pasar como
      "ensamble de 5" — Fak lo vio como "cosas flotando"; (c) **una feature que no
      actua nunca se saca**: los topes con 4 mm de luz no podian actuar porque el pin ya
      topeaba a los 2; (d) **la pose de trabajo se mide con la pistola donde el operario
      la tiene**, no con un cono desde cualquier lado — acostada, el frente recibia el
      chorro a <45 en el 40 %; de frente a 75, en el 94 %.

39. **UN DISENO NUEVO NO REEMPLAZA AL VIEJO HASTA QUE SUS DOCUMENTOS TAMBIEN CAMBIAN
    — y el numero que un documento tiene TIPEADO no se entera de nada.** (2026-09-04,
    misma tarde. Fak pidio una revision independiente del encastre: *"quiero quedarme
    tranquilo de que va a encastrar facil"*. Salio bien — dos revisores sin contexto
    coincidieron solos y la retencion mejoro — y despues aparecio el costo.)
    - Cambiada la retencion (horquilla por fuera -> pin con o-ring por dentro) y los
      apoyos (espuma -> POM rigido), el SOLIDO quedo bien y los cuatro controles verdes.
      **Seis documentos siguieron describiendo el diseno anterior**: la lista de
      materiales (pin "O3,40 engrane 8" TIPEADO cuando el solido ya era O3,30 engrane 9
      — y esa lista es la que va al TORNERO), el plano del carro (mu 0,30 de la horquilla
      al lado de su propio detalle que dice 0,60, y un pie que decia *"abrazar la torreta
      por fuera es lo unico que la geometria deja"*), el plano del nido ("gomaespuma
      comprimida al X %" con espuma_util = 0), el pliego, un render de demo, y **la
      imagen del GATE 0 — la que se le manda a Fak para que confirme la zona, o sea que
      le preguntaba por un diseno que ya no existia**.
    - Ninguno fallo: todos corrieron en verde. Un texto no tiene control de coherencia,
      y un numero tipeado tampoco: **si el dato existe en el JSON, el documento lo LEE**
      (`nd["localizadores"]["d_barreno"] - luz_pin`, `NV["parametros"]["clip_mu"]`); si
      hay que escribirlo a mano, es que falta publicarlo.
    - Metodo, barato: despues de cambiar un concepto, **grep del nombre viejo por toda la
      carpeta** (`horquilla|abraza|gomaespuma|espuma`) y mirar CADA hit. El orden importa:
      primero lo que sale de la casa (la imagen que va a Fak, el plano del tornero),
      despues lo interno. Y el numero que aparece en dos lugares del MISMO documento y no
      coincide es la firma barata de esto — se busca a proposito.
