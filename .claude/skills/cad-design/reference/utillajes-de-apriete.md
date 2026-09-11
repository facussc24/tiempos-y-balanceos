# Utillajes de apriete — las decisiones de CONCEPTO

Todas del virolador del Upper Trim (08/2026). Cambian el diseno de raiz: **las trampas de codigo no
salvan un concepto equivocado**. Se leen antes de la primera linea de geometria, junto con el
GATE P de `../SKILL.md`.

## 6. Utillajes de apriete — las decisiones de CONCEPTO (antes de la primera línea)

Todas del virolador del Upper Trim (08/2026). Son las que cambian el diseño de raíz; las
trampas de código de arriba no salvan un concepto equivocado.

- **La pregunta CERO: ¿de dónde sale la elasticidad?** Si la pieza del cliente ya trae un
  material blando (vinilo, tela, espuma), **el elástico ES ese material** y el utillaje va
  RÍGIDO — solo tiene que estar bien medido. Un resorte impreso solo se justifica cuando hay
  que definir una fuerza a través de un hueco desconocido. El resorte del virolador era el
  84 % de la pieza (48,4 mm, 40 g) y sobraba entero: la rígida hace lo mismo con 19,4 mm y
  19 g, sin fatiga, sin tope, sin calibración.
- **Requisito que cambia → RE-DERIVAR el diseño, no parchear.** "El dedo toca la pared" dejó
  al resorte sin función; en vez de sacarlo se le colgó un tope anti-rotura, un alma de unión
  y 1 mm más de brazo. Cada parche tenía una razón local válida; Fak vio el conjunto de un
  vistazo: *"no parece un diseño profesional, parece un parche mal hecho"*. **Test: si el
  requisito nuevo deja un subsistema sin función, el subsistema se VA — no se refuerza.**
- **El postizo se dimensiona contra el CONTORNO MEDIDO completo de la feature, no contra
  "ancho × largo".** La ranura medía 53,67 y el macho recto cubría 40: 6,5 mm sin apretar en
  cada punta, y Fak preguntó "¿ahí cómo planeás que se virole si no hay nada?". Además el eje
  NO era recto (se corre 3 mm a lo largo por los 25,6° de la cara). CLI: `medir_contorno.py`
  (contorno + normales); el postizo se construye retirado una LUZ CONSTANTE perpendicular a
  la pared — así el apriete sale parejo (84 % en todos lados contra 80-90 % del ancho fijo).
- **Un anillo cerrado pide margen de impresión más generoso que nervios sueltos:** si sale
  grande no entra por NINGÚN lado, y lijar un anillo es mucho peor que lijar dos nervios.
  (Se fue de luz 0,09 a 0,15 por esto.)
- **Features que YO agrego sin pedido se declaran o no van.** El grabado de identificación y
  los 2 agujeros M5 de amarre los agregué por iniciativa; Fak los circuló en el 3D preguntando
  "¿para qué son?" — dos veces en el mismo proyecto. Si una feature no la pidió y la considero
  necesaria: la listo con su porqué y "sacala si no la querés". La pieza más simple es la que
  no hay que explicar.
- **Verificar la CONCLUSIÓN de Fak aparte de su mecanismo.** "Los dedos más anchos harían más
  presión" era físicamente falso (presión = fuerza/área), pero la conclusión "esto es PLA, se
  va a partir" era CIERTA: ningún control miraba el maltrato, solo la carga de trabajo.
  Refutar el mecanismo no cierra el reclamo — la conclusión se verifica por separado.
- **ISOSTÁTICA: el panel/pieza lo ubica UN solo elemento (el más preciso); todo lo demás
  captura con holgura que NUNCA mande.** (19/08, y la pregunta la hizo Fak: "fijate si esto
  no está hiperestático".) El anillo del virolador ya restringía x, y y rotación con luz
  0,15; los 2 pasadores agregados con holgura 0,34 se la peleaban: el stack de tolerancias
  anillo↔pasador a 45 mm (impresión 0,16 + warp FDM 0,1 % + molde 0,075) da 0,28 en el peor
  caso > 0,19 de margen → el panel quedaba forzado o sin asentar. Se resolvió afinando el
  pasador (holgura 0,45: umbral 0,30 > 0,28). **La cuenta se hace SIEMPRE que haya más de un
  elemento ubicando el mismo grado de libertad**: umbral = holgura_secundario − luz_primario,
  contra el stack de tolerancias a la distancia que los separa.
- **Una corrección nueva se aplica a la CLASE, no al caso que la generó.** (19/08, causa
  raíz encontrada a pedido de Fak: "demostraste que no te estás automejorando".) El 18/08
  se redondearon los pedestales porque marcaban la pieza, y EN LA MISMA ITERACIÓN las
  orejas nuevas de los localizadores nacieron con canto vivo. Al corregir "los pedestales
  marcan" la regla real era "todo tope que enfrenta al panel va redondeado" — y una feature
  agregada en esa misma pasada es el primer lugar donde la regla se olvida. Enforcement:
  el redondeo es PROPIEDAD del constructor (`caja_tope_redondeado()` en el build), no un
  retoque por pieza; toda caja nueva orientada al panel pasa por ahí.
- **Lo que enseñó la PRIMERA PIEZA IMPRESA** (18/08, el dato que ningún cálculo reemplaza):
  (a) todo borde que TOCA la pieza del cliente va redondeado — no solo donde hay flexión: los
  pedestales de apoyo con canto vivo MARCAN la cara vista; (b) un encastre manual necesita
  FEEDBACK — entrada suave y el apriete concentrado al final, que se sienta el "asentó"; si
  hay que hacer fuerza sin sentir que trabó, el operador no confía; (c) un dispositivo donde
  se apoya una pieza necesita AUTO-UBICACIÓN — si el operador tiene que buscar el punto a
  tientas, la pieza se cae: guiado que la lleve solo (pilotos, rampas, topes); (d) las
  observaciones de la primera impresión se registran EL MISMO DÍA y generan la iteración
  siguiente — para eso se diseña fácil de medir y corregir.
