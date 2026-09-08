# -*- coding: utf-8 -*-
"""Fase 1 de la mejora de las hojas HOTMELT: que dice cada paso, en que lamina cae y con
que foto se muestra.

Por que existe este archivo y no se toca directo `hojas_spec.py`: el cuadro se le muestra a
Fak ANTES de generar las laminas. Aca esta la decision (que es paso, que es nota, que foto
va), en `hojas_spec.py` va el texto final ya aprobado.

Lo que cambia respecto del deck del 07/09, y por que:

  · **117 "pasos" no son 117 pasos.** 30 de ellos son advertencias y criterios
    ("no tocar", "no forzar", "sin ropa suelta"): numerados dentro de la secuencia,
    obligan a leer una lista de siete renglones para encontrar las tres cosas que hay
    que HACER. Van como nota o como triangulo en el paso donde el riesgo existe.
  · **cada paso que es un gesto lleva SU foto, con el numero encima.** Hoy hay 117 pasos
    contra 51 fotos, y ninguna dice a que paso pertenece.
  · **los pasos que miran la MISMA pantalla comparten una sola pantalla** con globos
    numerados. Es lo que arregla la 20.4, que hoy tiene 10 "verificar" y una pantalla.
  · el corte de lamina es por FOTOS (hasta 4), no por pasos: una pantalla compartida por
    cuatro verificaciones ocupa una sola foto.

Tipos:  A accion (foto propia) · P pantalla (comparte pantalla con globos)
        N nota o advertencia (sale de la lista numerada) · R remision a otra hoja

Estado de la foto: ok · FALTA (hay que filmarla o recortarla) · ROTULAR · VERIFICAR
(la foto que hay contradice al texto, hay que mirar el video antes de usarla)
"""

# fmt: off
PLAN = [
 dict(op="20.0", etapa="PREPARAR Y ARRANCAR", denom="LA MÁQUINA Y SUS PARTES",
      nota="Lámina NUEVA. No es una operación: es el mapa que las 17 hojas usan después. "
           "Sin esto, cada hoja nombra piezas que nadie ubica.",
      pasos=[
   ("A", "Foto general de la máquina con las partes rotuladas: desbobinador, eje neumático, "
         "rodillo de aplicación, dosificador, guía de borde, control de tensión, fusor, "
         "salida.", "h01_d_vista_general", "ok"),
   ("A", "Las tres zonas: desbobinador · rodillos de aplicación · salida del material.",
         "h01_a_desbobinador + h01_b_rodillos_reja + h01_c_rodillos_salida", "ok"),
 ]),

 dict(op="20.1", etapa="PREPARAR Y ARRANCAR", denom="ENCENDIDO Y PUESTA EN MARCHA",
      nota="Reformulada entera (observación 1). Los riesgos dejan de ser una lista al "
           "principio: cada uno va con ⚠ en el paso donde existe. El encendido SÍ estaba "
           "filmado: primer minuto de IMG_9527 (28/08), «darle ON a la llave interruptora». "
           "No hay tablero eléctrico aparte: la llave está sobre la propia máquina.",
      pasos=[
   ("A", "Girar a ON la llave general de la máquina, del lado del desbobinador.",
         "frames/9527/9527_0014", "ok"),
   ("A", "Abrir el aire comprimido: TBD — en ningún fotograma se ve una llave de paso, un "
         "filtro-regulador ni un manómetro de entrada de aire.", "", "FALTA"),
   ("A", "Verificar que no haya piezas metálicas ni herramientas entre los rodillos.",
         "h01_b_rodillos_reja", "ok"),
   ("A", "Verificar que los botones rojos de stop estén rearmados y accesibles.",
         "h15_a_stop", "ok"),
   ("N", "⚠ Los rodillos trabajan entre 150 y 185 °C: no tocarlos sin protección.", "", ""),
   ("N", "⚠ Sin ropa suelta, capucha ni cordones cerca de los rodillos.", "", ""),
   ("N", "⚠ El desbobinador trabaja con aire comprimido: cuidado al despresurizar.", "", ""),
 ]),

 dict(op="20.2", etapa="PREPARAR Y ARRANCAR", denom="PUESTA EN MARCHA DEL FUSOR DE ADHESIVO",
      nota="🔴 La hoja de hoy dice «encender el fusor ANTES que la laminadora» y NINGÚN "
           "video lo respalda: en IMG_9527 el orden filmado es el inverso (llave de la "
           "laminadora en el minuto 0, fusor recién pasado el minuto 5). Lo único que el "
           "material sí sostiene es que el adhesivo tenga que estar derretido antes de que "
           "los rodillos giren o se junten. El orden de encendido hay que confirmarlo en "
           "la máquina. Los pasos 3 a 5 miran la misma pantalla del fusor: globos ③④⑤.",
      pasos=[
   ("A", "Encender el fusor con el interruptor rojo «开关 / switch», abajo a la izquierda "
         "de su pantalla.", "frames/9527/9527_0450", "ok"),
   ("A", "Verificar que el tanque tenga adhesivo cargado.", "h02_e_tanque_adhesivo", "ok"),
   ("P", "Activar el calentamiento: el general, los de las dos mangueras y los de las dos "
         "pistolas.", "h02_a_panel_glsc", "ROTULAR"),
   ("P", "Verificar la consigna del adhesivo: 160 °C.", "(misma pantalla, globo ④)", "ok"),
   ("P", "Esperar a que el adhesivo se derrita por completo.", "(misma pantalla, globo ⑤)",
         "ok"),
   ("A", "Verificar que las dos pistolas de aplicación estén libres y sin obstrucción.",
         "", "FALTA"),
   ("N", "⚠ Si una pistola queda obstruida, no destaparla en caliente: dar aviso al líder.",
         "", ""),
 ]),

 dict(op="20.3", etapa="PREPARAR Y ARRANCAR", denom="ACCESO AL HMI Y RESET",
      nota="El paso «encender desde el tablero principal» sale de acá: la llave está sobre "
           "la máquina y ya se enciende en la 20.1. Lo que la bitácora llamaba «tablero» es "
           "el panel de los controladores de tensión BIANFU, que son instrumentos de "
           "proceso, no la acometida.",
      pasos=[
   ("A", "Esperar a que arranque el HMI y el PLC. La pantalla queda lista cuando desaparece "
         "el cuadradito del centro.", "frames/9527/9527_0040", "ok"),
   ("P", "En el HMI, ingresar la contraseña.", "h03_a_login_hmi", "ok"),
   ("A", "Si la máquina quedó con un error, presionar Reset (pulsador amarillo).",
         "h09_b_reset", "ok"),
   ("P", "Verificar en pantalla que no queden alarmas activas.", "h15_c_alarmas",
         "ROTULAR"),
 ]),

 dict(op="20.4", etapa="PREPARAR Y ARRANCAR", denom="CARGA DE PARÁMETROS DE PRODUCTO",
      nota="Hoy son 10 renglones de 'verificar' contra UNA pantalla: no hay forma de saber "
           "qué se mira. Cada valor pasa a ser un globo numerado sobre la pantalla "
           "real, enderezada. El HMI tiene modo INGLÉS (Home → English) y hay una captura nítida "
           "de la pantalla de operación en inglés: IMG_9527 fotograma 0957 — de ahí sale "
           "cómo se llama cada campo, sin traducir del chino a ojo.",
      pasos=[
   ("A", "Entrar a Selección de producto y elegir la receta del material a procesar.",
         "h04_d_seleccion_producto", "ROTULAR"),
   ("P", "Verificar el espesor de producto de la receta.", "(pantalla de operación, ②)",
         "ROTULAR"),
   ("P", "Verificar la luz entre rodillos de la receta.", "(pantalla de operación, ③)", "ok"),
   ("P", "Verificar la velocidad de línea: 3 m/min.", "(pantalla de operación, ④)", "ok"),
   ("P", "Verificar la velocidad del rodillo dosificador: 0,040 m/min.",
         "(pantalla de operación, ⑤)", "ok"),
   ("P", "Verificar la temperatura de consigna de los dos rodillos: 185 °C.",
         "frames/9527/9527_0957", "ROTULAR"),
   ("P", "Verificar la temperatura de protección: 150 °C. Por debajo, los rodillos no giran.",
         "(pantalla de temperaturas, ⑦)", "ok"),
   ("P", "Verificar las desviaciones de alarma: +10 °C y −10 °C.",
         "(pantalla de temperaturas, ⑧)", "ok"),
   ("P", "Verificar la alarma por sobretemperatura: 220 °C.",
         "(pantalla de temperaturas, ⑨)", "ok"),
   ("P", "Verificar la temperatura de espera (150 °C) y la de enfriamiento (100 °C).",
         "(pantalla de temperaturas, ⑩)", "ok"),
 ]),

 dict(op="20.5", etapa="PREPARAR Y ARRANCAR", denom="CALENTAMIENTO Y ESPERA",
      nota="De 6 renglones quedan 3 pasos: los otros 3 son criterios de espera, no acciones.",
      pasos=[
   ("A", "Con el calentamiento activo, esperar a que los rodillos lleguen a temperatura. "
         "Con la máquina fría puede tardar alrededor de 1 hora.", "h05_a_calentando", "ok"),
   ("P", "Esperar a que la pantalla indique calentamiento completado.",
         "h05_b_calentamiento_ok", "ROTULAR"),
   ("A", "Arrancar sólo con los rodillos a 185 °C y sin alarmas.", "h05_c_rodillo_pegamento",
         "ok"),
   ("N", "Los rodillos recién se habilitan a girar por encima de 150 °C.", "", ""),
   ("N", "⚠ No forzar el giro de los rodillos con el pegamento frío: se pega y se rompe.",
         "", ""),
 ]),

 dict(op="20.6", etapa="PREPARAR Y ARRANCAR", denom="MONTAJE DEL ROLLO EN EL DESBOBINADOR",
      nota="Se parte en dos: son 7 gestos seguidos y cada uno necesita su foto. "
           "'Mandril' queda pendiente del vocabulario de planta (observación 3) y el paso "
           "de centrado hay que reescribirlo (observación 4).",
      pasos=[
   ("A", "Verificar que el código y el lote del rollo coincidan con los de la orden.",
         "", "FALTA"),
   ("A", "Cerrar la punta suelta del rollo con cinta antes de moverlo.", "h06_a_cinta_azul",
         "ok"),
   ("A", "Colocar el mandril neumático «PALABRA A CONFIRMAR» dentro del tubo de cartón del "
         "rollo.", "h06_d_mandril_aire", "ok"),
   ("A", "Centrar el rollo sobre el mandril. [reescribir: 'escala del eje, valor TBD' no se "
         "entiende]", "", "FALTA"),
   ("A", "Inflar el mandril para que agarre el tubo.", "rollo_4_mandril", "ok"),
   ("A", "Levantar el rollo entre dos personas y calzarlo en el desbobinador.",
         "h06_b_montaje_eje", "ok"),
   ("A", "Llevar la perilla del desbobinador a ON.", "h06_c_perilla_onoff", "ok"),
 ]),

 dict(op="20.7", etapa="PREPARAR Y ARRANCAR", denom="ENHEBRADO DEL MATERIAL",
      nota="La operación más difícil, y hoy se explica sólo con palabras ('sube, baja, "
           "vuelve a subir'). Se parte en dos y la primera lámina lleva el ESQUEMA del "
           "recorrido dibujado, como cualquier manual de laminadora.",
      pasos=[
   ("A", "Colocar el rollo mirando hacia adelante.", "h07_a_rollo", "ok"),
   ("A", "Pasar el control de tensión a manual para poder tirar del material.",
         "h08_c_tablero_tension", "ok"),
   ("A", "Pasar el material por el primer rodillo, del lado del frente.",
         "h07_b_primer_rodillo", "ok"),
   ("A", "Seguir el recorrido de la serpentina.", "ESQUEMA dibujado + h07_f_serpentina",
         "FALTA"),
   ("A", "Pasar el material por la guía de borde que está abajo.", "h07_c_barra_guia", "ok"),
   ("A", "Pasar por debajo del rodillo y subir.", "enh_5_entrada", "ok"),
   ("A", "Meter el material dentro del rodillo de hot melt.", "h07_e_entrada_rodillo", "ok"),
 ]),

 dict(op="20.8", etapa="PREPARAR Y ARRANCAR", denom="CENTRADO Y TENSIÓN DE LA BANDA",
      nota="",
      pasos=[
   ("A", "Centrar el material contra la barra guía usando la regla.", "h08_a_centrado", "ok"),
   ("A", "Verificar que el sensor de borde tome el borde del material.", "h08_b_sensor_borde",
         "ok"),
   ("P", "Verificar la tensión en el controlador: consigna 20 kg. Si no da, ajustar antes "
         "de arrancar.", "h08_c_tablero_tension", "ROTULAR"),
   ("P", "Verificar que el control de guía esté en automático.", "", "FALTA"),
   ("A", "Volver a poner el control de tensión en automático antes de producir.",
         "h08_c_tablero_tension", "ok"),
   ("A", "Verificar que el material corra sin arrugas.", "h10_b_material_saliendo", "ok"),
 ]),

 dict(op="20.9", etapa="PREPARAR Y ARRANCAR", denom="ARRANQUE Y ALINEACIÓN",
      nota="",
      pasos=[
   ("A", "Verificar que los resguardos estén cerrados y que no haya nadie en la zona de "
         "rodillos.", "", "FALTA"),
   ("A", "Presionar el pulsador verde de arranque.", "", "FALTA"),
   ("A", "Probar el botón rojo de stop con la máquina en vacío: se tiene que detener.",
         "h15_a_stop", "ok"),
   ("A", "Rearmar el botón rojo de stop, presionar Reset y volver a arrancar.",
         "h09_b_reset", "ok"),
   ("P", "Verificar en pantalla que el estado pase a automático.", "h10_a_hmi_automatico",
         "ROTULAR"),
   ("A", "Controlar la alineación del material contra la marca del borde.",
         "h09_c_marca_cinta", "ok"),
   ("A", "Corregir la alineación antes de dejar correr la máquina.", "h09_b_rodillo_gira",
         "ok"),
 ]),

 dict(op="20.10", etapa="PRODUCIR", denom="LAMINADO — CONTROL DURANTE LA MARCHA",
      nota="Es la única hoja de la etapa PRODUCIR: acá pasa el turno. Los seis controles "
           "son lo que el operario mira una y otra vez, así que cada uno necesita mostrar "
           "QUÉ está bien y qué está mal.",
      pasos=[
   ("A", "Controlar que el material salga sin arrugas ni marcas.", "h10_b_material_saliendo",
         "ok"),
   ("A", "Controlar que el adhesivo quede parejo, sin faltantes ni excesos.",
         "h05_c_rodillo_pegamento", "VERIFICAR"),
   ("A", "Controlar que no haya quemaduras en el vinilo.", "", "FALTA"),
   ("A", "Controlar el peso del vinilo adhesivado con la balanza.", "", "FALTA"),
   ("P", "Verificar que las temperaturas de los rodillos se mantengan en consigna.",
         "h04_b_parametros_temp", "ok"),
   ("A", "Verificar que el enfriamiento a la salida esté funcionando.", "h10_c_enfriamiento",
         "ok"),
   ("N", "⚠ No meter la mano entre los rodillos con la máquina en marcha.", "", ""),
 ]),

 dict(op="20.11", etapa="SI PASA ALGO", denom="EMPALME DEL MATERIAL",
      nota="La foto que hay se llama 'corte diagonal' y el texto dice cortar RECTA: hay "
           "que mirar el video antes de usarla.",
      pasos=[
   ("R", "Detener la máquina según la hoja 20.15.", "", ""),
   ("A", "Cortar la punta del material recta, apoyada contra la barra amarilla de "
         "referencia (reglas de corte: hoja 20.14).", "h11_a_corte_diagonal", "VERIFICAR"),
   ("A", "Marcar el punto de referencia sobre la barra con cinta.", "h11_c_marca_referencia",
         "ok"),
   ("A", "Enfrentar las dos puntas a tope contra la barra amarilla.", "", "FALTA"),
   ("A", "Unir el empalme con cinta a lo largo de todo el ancho.", "h11_b_cinta_blanca",
         "ok"),
   ("A", "Verificar que el empalme quede recto antes de arrancar.", "", "FALTA"),
   ("A", "Marcar el tramo del empalme: la cinta pasa al producto.", "", "FALTA"),
   ("N", "⚠ Manos lejos del rodillo. Antes de rearrancar, verificar que no haya nadie en "
         "la zona de rodillos.", "", ""),
 ]),

 dict(op="20.12", etapa="SI PASA ALGO", denom="CAMBIO DE ROLLO POR ALARMA DE FIN DE MATERIAL",
      nota="",
      pasos=[
   ("P", "Al sonar la alarma de fin de material, la máquina se detiene.", "h12_a_alarma",
         "ROTULAR"),
   ("A", "Presionar el pulsador rojo del desbobinador.", "h12_a_pulsador_rojo", "ok"),
   ("A", "Sacarle la presión de aire al mandril con el volante.", "h12_c_volante_mandril",
         "ok"),
   ("A", "Verificar que quede despresurizado antes de desconectar la manguera.",
         "h12_b_panel", "VERIFICAR"),
   ("A", "Retirar el tubo de cartón vacío.", "h12_d_nucleo_vacio", "ok"),
   ("R", "Montar el rollo nuevo según la hoja 20.6.", "h12_e_rollo_nuevo", "ok"),
   ("R", "Empalmar el material según la hoja 20.11.", "", ""),
   ("N", "⚠ Antes de rearrancar, verificar que no haya nadie en la zona de rodillos.",
         "", ""),
 ]),

 dict(op="20.13", etapa="SI PASA ALGO", denom="DESTRABE DEL MATERIAL TRABADO",
      nota="",
      pasos=[
   ("R", "Si el material se frunce o se traba, detener la máquina según la hoja 20.15.",
         "h13_b_material_trabado", "ok"),
   ("A", "Esperar el paro total de los rodillos antes de tocar el material.",
         "h13_c_maquina_detenida", "ok"),
   ("A", "Revisar el punto donde la mesa pasa al rodillo.", "", "FALTA"),
   ("A", "Liberar el material sin tironear.", "", "FALTA"),
   ("A", "Verificar que el material esté pasado por dentro del rodillo, no por fuera.",
         "h13_a_vinilo_mal_pasado", "ok"),
   ("A", "Reanudar sólo con el material bien pasado y sin arrugas.", "", "FALTA"),
   ("N", "⚠ Antes de rearrancar, verificar que no haya nadie en la zona de rodillos.",
         "", ""),
 ]),

 dict(op="20.14", etapa="TERMINAR", denom="CORTE DE LA PLANCHA",
      nota="Observación 5: las dos fotos de hoy muestran lo contrario del texto — corte "
           "apoyado en el piso y sin guantes. Las dos se reemplazan; casi todos los pasos "
           "quedan sin foto hasta filmar el corte bien hecho.",
      pasos=[
   ("A", "Apoyar la plancha sobre una superficie plana y limpia.", "h14_a_corte_cuchillo",
         "VERIFICAR"),
   ("A", "Cortar con forma redondeada, siguiendo la guía. No cortar cuadrados: dan "
         "problemas en esta máquina.", "h14_b_guia_corte", "VERIFICAR"),
   ("A", "Empezar el corte por el costado, nunca por el centro.", "", "FALTA"),
   ("A", "Verificar que el borde quede limpio, sin hilachas.", "", "FALTA"),
   ("N", "⚠ Cortar siempre en dirección contraria al cuerpo.", "", ""),
   ("N", "⚠ La mano libre va detrás del filo, nunca sobre la línea de corte.", "", ""),
 ]),

 dict(op="20.15", etapa="TERMINAR", denom="PARADA DE LA MÁQUINA",
      nota="Observación 6. Ya no depende de la foto de Lucas. La pantalla NO se redibuja: va "
           "la FOTO real enderezada y los rotulos en castellano encima (Fak, 08/09). De "
           "0387_0105 "
           "(girado 90°) sale la columna de seguridad — %I0.0 paro de emergencia · %I0.1 "
           "puerta · %I0.2 arranque · %I0.3 parada · %I0.4 reset · %I0.5 y %I0.6 "
           "desbobinador · %I1.0 y %I1.1 enrollador. De 0379_0169 sale el encabezado, el "
           "layout real, los botones de navegación y las dos columnas de la derecha, "
           "nítidos y sin rotar (ahí la columna de seguridad está velada por el reflejo y "
           "el dedo tapa las últimas filas). En inglés NO existe: el HMI estuvo en inglés "
           "70 segundos y sólo abrieron Operation y Recipe; la de IO es una subpágina que "
           "ni figura en el menú.",
      pasos=[
   ("A", "Presionar el pulsador rojo de parada.", "frames/0392/0392_0004", "ok"),
   ("A", "Verificar que los rodillos frenen por completo.", "h13_c_maquina_detenida", "ok"),
   ("P", "Verificar en pantalla que el estado pase a detenido.", "h10_a_hmi_automatico",
         "ROTULAR"),
   ("P", "Verificar en la pantalla de señales de seguridad que el botón rojo de stop y la "
         "puerta figuren en estado correcto.", "_pantalla_seguridad.png", "ok"),
   ("A", "Dejar la máquina sin material trabado y la zona de rodillos despejada.", "",
         "FALTA"),
 ]),

 dict(op="20.16", etapa="TERMINAR", denom="APERTURA DE RODILLOS Y COLOCACIÓN DE LA BANDEJA",
      nota="",
      pasos=[
   ("P", "Con la máquina detenida, entrar en el HMI a la pantalla de limpieza y llevar el "
         "eje de elevación a la posición de limpieza.", "h17_a_pantalla_limpieza",
         "ROTULAR"),
   ("A", "Abrir la puerta de seguridad recién cuando el HMI indique que quedó liberada.",
         "h16_a_ejes_rotacion", "VERIFICAR"),
   ("A", "Colocar la bandeja de recolección de pegamento debajo de los rodillos.",
         "h16_b_plato_pegamento", "ok"),
   ("A", "Cubrir la bandeja con papel descartable.", "", "FALTA"),
   ("A", "Verificar que no quede ninguna herramienta metálica entre los rodillos.",
         "h16_c_plato_manchas", "VERIFICAR"),
 ]),

 dict(op="20.17", etapa="TERMINAR", denom="LIMPIEZA DE RODILLOS POR PASOS",
      nota="Los pasos 1 a 4 son la misma pantalla de limpieza del HMI: una sola pantalla "
           "real enderezada, con los globos ①②③④ encima, en vez de cuatro renglones sueltos.",
      pasos=[
   ("P", "En el HMI, entrar a la pantalla de limpieza de pegamento.", "h17_a_pantalla_limpieza",
         "ROTULAR"),
   ("P", "Paso 1 de la máquina: arrancar la limpieza. La puerta de seguridad queda liberada.",
         "(misma pantalla, globo ②)", "ok"),
   ("P", "Paso 2 de la máquina: agregar el líquido de limpieza. La luz entre rodillos se "
         "cierra y el rodillo gira continuo.", "h17_b_traductor_paso2", "ROTULAR"),
   ("P", "Paso 3 de la máquina: el rodillo deja de girar.", "(misma pantalla, globo ④)",
         "ok"),
   ("A", "Limpiar con trapo y rasqueta de plástico.", "h17_d_trapo", "ok"),
   ("A", "Verificar que los rodillos queden limpios. Si queda pegamento, repetir el Paso 2.",
         "h17_c_rodillos_pegamento", "ok"),
   ("A", "Retirar la bandeja y el papel, y dar por terminada la limpieza.", "", "FALTA"),
   ("R", "Antes de volver a producir, verificar que la luz entre rodillos vuelva al valor "
         "de la receta (hoja 20.4).", "", ""),
   ("N", "⚠ Nada de metal contra los rodillos. Antes de rearrancar, verificar que no haya "
         "nadie en la zona de rodillos.", "", ""),
 ]),
]
# fmt: on

# ── las 75 fotos con nombre, MIRADAS una por una el 08/09/2026 ───────────────
# Antes intente medirlas con un numero (varianza del laplaciano). No sirve para decidir:
# `h01_d_vista_general` puntua 1701 —de los valores mas altos— y sin embargo no es una
# vista general, es la reja amarilla de cerca y en diagonal; la malla llena de aristas
# infla el numero. El numero sirve para ORDENAR candidatos dentro de un mismo video, y
# para nada mas. El veredicto sale de mirar.
#   sirve = muestra lo que dice su nombre · floja = se entiende a medias
#   NO = no muestra lo que dice su nombre · rotular = pantalla: se endereza la FOTO
#   REAL y se le ponen los rotulos en castellano encima (decision de Fak, 08/09)
MIRADAS = {
 "enh_1_rollo":            ("sirve", "el rollo de vinilo, de punta"),
 "enh_2_rodillo":          ("NO", "es un panel blanco con rejillas: no se ve ningun rodillo"),
 "enh_3_barra_guia":       ("NO", "primer plano de una superficie amarilla, sin la barra"),
 "enh_4_sensor":           ("NO", "la reja amarilla tapa el sensor"),
 "enh_5_entrada":          ("floja", "el material entra, pero detras de la reja"),
 "h01_a_desbobinador":     ("sirve", "el desbobinador con el rollo montado y el eje"),
 "h01_b_rodillos_reja":    ("floja", "la reja amarilla se come la mitad de la foto"),
 "h01_c_rodillos_salida":  ("sirve", "buen lateral del tren de rodillos verdes"),
 "h01_d_vista_general":    ("floja", "no es una vista general: reja de cerca, en diagonal"),
 "h02_a_panel_glsc":       ("floja", "la pantalla del fusor con reflejo y una mano encima"),
 "h02_b_panel_glsc2":      ("rotular", "la pantalla del fusor, entera pero en chino"),
 "h02_c_unidad_fusor":     ("sirve", "la unidad azul del fusor, completa"),
 "h02_d_conector":         ("floja", "un conector sin contexto: no se sabe de que es"),
 "h02_e_hmi_pegamento":    ("NO", "tres personas paradas: no muestra ningun paso"),
 "h02_e_tanque_adhesivo":  ("sirve", "el tanque abierto con el adhesivo adentro"),
 "h02_f_cartel_caliente":  ("floja", "el cartel es chico y esta en chino"),
 "h03_a_login_hmi":        ("floja", "el HMI de lejos: la pantalla no se lee"),
 "h03_b_panel":            ("floja", "la maquina de lejos, el panel es un detalle"),
 "h03_c_operario_panel":   ("floja", "el operario de espaldas, la pantalla no se lee"),
 "h04_a_pantalla_operacion": ("rotular", "foto de la pantalla china con globos pegados "
                              "encima: los valores de abajo no se leen"),
 "h04_b_parametros_temp":  ("rotular", "idem: globos sobre una pantalla que no se lee"),
 "h04_c_teclado_130":      ("sirve", "el teclado numerico del HMI con el dedo tipeando"),
 "h04_d_seleccion_producto": ("floja", "el HMI en diagonal, la pantalla queda chica"),
 "h05_a_calentando":       ("floja", "se ve el panel; la pantalla, no"),
 "h05_b_calentamiento_ok": ("floja", "el panel de lejos"),
 "h05_c_rodillo_pegamento": ("sirve", "el rodillo con el adhesivo amarillo encima"),
 "h06_a_cinta_azul":       ("NO", "la espalda de una persona agachada ocupa la foto"),
 "h06_b_montaje_eje":      ("sirve", "las manos metiendo el eje en el tubo de carton"),
 "h06_c_perilla_onoff":    ("floja", "la cabeza del operario tapa la perilla"),
 "h06_d_mandril_aire":     ("sirve", "dos operarios en el desbobinador, con la manguera"),
 "h07_a_rollo":            ("sirve", "la misma que enh_1_rollo"),
 "h07_b_primer_rodillo":   ("sirve", "el material saliendo del rollo sobre el rodillo"),
 "h07_c_barra_guia":       ("NO", "la misma superficie amarilla de enh_3"),
 "h07_d_sensor_negro":     ("NO", "reja y manguera: no hay ningun sensor a la vista"),
 "h07_e_entrada_rodillo":  ("floja", "la entrada, detras de la reja"),
 "h07_f_serpentina":       ("NO", "movida, superficie negra sin ninguna referencia"),
 "h08_a_centrado":         ("floja", "manos sobre un eje; no se ve el centrado con la regla"),
 "h08_b_sensor_borde":     ("NO", "una persona agachada; el sensor no aparece"),
 "h08_c_tablero_tension":  ("sirve", "el controlador de tension con sus dos displays"),
 "h09_a_hmi_arranque":     ("rotular", "pantalla china con un globo en castellano"),
 "h09_b_reset":            ("sirve", "Start / Stop / Reset con la mano en el pulsador"),
 "h09_b_rodillo_gira":     ("floja", "los rodillos, detras de la reja"),
 "h09_c_marca_cinta":      ("NO", "la cabeza de una persona ocupa toda la foto"),
 "h10_a_hmi_automatico":   ("rotular", "pantalla china con un globo en castellano"),
 "h10_b_material_saliendo": ("sirve", "el material saliendo a la mesa, con el operario"),
 "h10_c_enfriamiento":     ("sirve", "los rodillos verdes con los ventiladores debajo"),
 "h11_a_corte_diagonal":   ("floja", "el nombre dice DIAGONAL y el paso dice cortar RECTA: "
                            "hay que mirar el video antes de usarla"),
 "h11_b_cinta_blanca":     ("NO", "la espalda de una persona agachada"),
 "h11_c_marca_referencia": ("NO", "la espalda de una persona agachada"),
 "h12_a_alarma":           ("NO", "dos personas y un dedo: no se ve ninguna alarma"),
 "h12_a_pulsador_rojo":    ("sirve", "el pulsador rojo del desbobinador, señalado"),
 "h12_b_panel":            ("floja", "un armario y una mano apuntando"),
 "h12_c_volante_mandril":  ("sirve", "las manos en la valvula de aire del eje"),
 "h12_d_nucleo_vacio":     ("sirve", "el tubo de carton vacio, parado en el piso"),
 "h12_e_rollo_nuevo":      ("NO", "casi toda la foto es piso"),
 "h13_a_vinilo_mal_pasado": ("sirve", "los rodillos verdes con el material mal pasado"),
 "h13_b_material_trabado": ("sirve", "el material sobre la barra amarilla"),
 "h13_c_maquina_detenida": ("floja", "la maquina en diagonal, sin foco en lo que importa"),
 "h14_a_corte_cuchillo":   ("NO", "el corte se hace EN EL PISO y de rodillas (observacion 5)"),
 "h14_b_guia_corte":       ("NO", "misma escena, en el piso (observacion 5)"),
 "h15_a_stop":             ("sirve", "Start / Stop / Reset y el hongo de emergencia"),
 "h15_b_io_seguridad":     ("rotular", "la pantalla de señales, entera en chino "
                            "(observacion 6)"),
 "h15_c_alarmas":          ("rotular", "la pantalla de alarmas, en chino"),
 "h16_a_ejes_rotacion":    ("floja", "un dedo sobre la pantalla; la pantalla no se lee"),
 "h16_b_plato_pegamento":  ("sirve", "las manos con la bandeja de recoleccion"),
 "h16_c_plato_manchas":    ("floja", "la bandeja en el piso, entre pies"),
 "h17_a_pantalla_limpieza": ("rotular", "pantalla china con dos globos en castellano"),
 "h17_b_traductor_paso2":  ("NO", "es la pantalla de un CELULAR con el traductor: no puede "
                            "ir en una hoja de operaciones"),
 "h17_c_rodillos_pegamento": ("sirve", "los rodillos con el pegamento, vista amplia"),
 "h17_d_trapo":            ("floja", "una persona limpiando, de espaldas"),
 "portada_maquina":        ("floja", "es la misma foto del enfriamiento, no una panoramica "
                            "(observacion 7)"),
 "rollo_1_cinta":          ("NO", "la espalda de una persona agachada"),
 "rollo_2_montaje":        ("sirve", "las manos metiendo el eje en el tubo"),
 "rollo_3_onoff":          ("sirve", "el operario llevando la perilla a ON"),
 "rollo_4_mandril":        ("sirve", "dos operarios calzando el rollo en el desbobinador"),
 # fotogramas nuevos, sacados de los 10.200 y mirados el 08/09. Todavia hay que recortarlos.
 "frames/9527/9527_0014":  ("sirve", "la llave general roja sobre base amarilla, embutida "
                            "en el gabinete, con el cartel de riesgo electrico encima"),
 "frames/9527/9527_0040":  ("sirve", "el HMI arrancando, con la botonera y el hongo"),
 "frames/9527/9527_0450":  ("floja", "el interruptor rojo del fusor se ve abajo a la "
                            "izquierda; la pantalla tiene reflejo"),
 "frames/9527/9527_0957":  ("rotular", "la pantalla de operacion EN INGLES, nitida: la "
                            "mejor base que hay: de ahi salen los nombres de los campos"),
 "frames/0387/0387_0105":  ("rotular", "la pantalla de señales, con el panel girado 90°; "
                            "rotada se leen los rotulos de seguridad — la unica que los da"),
 "frames/0379/0379_0169":  ("rotular", "la misma pantalla derecha y sin rotar: encabezado, "
                            "botones y las dos columnas de la derecha nitidos; la columna de "
                            "seguridad, velada por el reflejo y tapada por el dedo"),
 "_pantalla_seguridad.png": ("sirve", "la FOTO real de 0387_0105, enderezada por "
                             "perspectiva; las 4 filas de seguridad marcadas con banda "
                             "ambar y numero, y el nombre en castellano al COSTADO: nada "
                             "tapa la pantalla y ningun valor se toco. 7,2 pt impresos a "
                             "16,2 cm (minimo 7). La hace pantalla_seguridad.py"),
 "frames/0392/0392_0004":  ("sirve", "la botonera completa y rotulada: Start verde, Stop "
                            "rojo, Reset amarillo y el hongo de emergencia"),
}


def veredicto(campo):
    """El campo `foto` del PLAN puede traer una o dos fotos, o una remision entre parentesis.
    Devuelve (veredicto, motivo) juntando lo de cada una."""
    if not campo or campo.startswith("("):
        return "", ""
    partes = [p.strip() for p in campo.replace("+", "|").split("|")]
    vs, ms = [], []
    for p in partes:
        p = p.split(" ")[0]
        if p in MIRADAS:
            v, m = MIRADAS[p]
            vs.append(v)
            ms.append("%s: %s" % (p, m) if len(partes) > 1 else m)
    if not vs:
        return "sin mirar", ""
    orden = ["NO", "rotular", "floja", "sirve"]
    peor = min(vs, key=lambda v: orden.index(v) if v in orden else 9)
    return peor, " · ".join(ms)


# ── vocabulario: cada palabra que cambio, con el documento donde aparece ──────
# Barrido del 08/09/2026 sobre 3 HOs liberadas, 97 documentos del SGC, el AMFE y el Plan de
# Control de TOP ROLL, 44 transcripciones, 5.443 mails y 10.732 ordenes de compra.
# La regla: no se reemplaza una palabra inventada por otra inventada. Lo que no aparece en
# ningun documento de Barack queda como PREGUNTA, no como cambio.
VOCABULARIO = [
 ("paro de emergencia", "botón rojo de stop",
  "HO-968 APC DELANTERO REV.A.xlsx, hoja 52, celdas J14 e I16: «presionar de inmediato el "
  "BOTÓN ROJO DE STOP del panel de la máquina»"),
 ("bobina", "rollo",
  "HO-968 hoja 20 J14/J17/J25 y hoja 26 J11 · HO-986 ídem · HO-985 hoja 30 J14/J17/J25. "
  "OJO: en las HO de Barack «bobina» ya es la BOBINA DE HILO de coser (HO-968 hojas 30-34, "
  "10 apariciones): usarla para el rollo choca con las otras hojas"),
]
# Sin respaldo documental — se PREGUNTAN, no se cambian:
#   · mandril / eje neumático / eje expansible / eje inflable → CERO apariciones en Barack
#     fuera de esta misma hoja. Fak dijo que «mandril» no es palabra de planta, pero ningun
#     documento dice cual es.
#   · tubo de cartón vs núcleo → la hoja dice «tubo», la bitácora dice «núcleo», ningun
#     documento liberado dice ninguna de las dos.
#   · la herramienta del corte de la plancha → la hoja no la nombra; el video se llama
#     «corte a cuchillo», el unico instructivo con corte manual (I-AC-044, peeling de
#     laboratorio) dice «Cutter». Son tres cosas distintas.

MAX_FOTOS = 4          # por lamina; una pantalla compartida cuenta UNA
SUFIJO = "abcdef"


def laminas(h):
    """Parte una operacion en laminas de hasta MAX_FOTOS fotos. Las notas y las remisiones
    no cuentan: viajan con la lamina donde cae su paso, o con la ultima.

    Una ACCION ocupa lugar aunque su foto todavia no exista: el criterio es una foto por
    paso, asi que el dia que se filme tiene que entrar. Una PANTALLA ocupa lugar solo si
    trae una pantalla nueva — cuatro verificaciones sobre la misma pantalla son un globo
    cada una, no cuatro imagenes."""
    filas, vistas, nro, cupos = [], [], 0, 0
    for tipo, texto, foto, estado in h["pasos"]:
        if tipo in ("A", "P", "R"):
            nro += 1
        ocupa = tipo == "A" or (tipo == "P" and not foto.startswith("(")
                                and foto not in vistas)
        if ocupa:
            vistas.append(foto)
            cupos += 1
        filas.append((ocupa, (nro if tipo in ("A", "P", "R") else None, tipo, texto,
                              foto, estado)))
    # el reparto se hace PAREJO: 5 fotos en dos laminas van 3 y 2, no 4 y 1. Una lamina
    # con un solo paso es media hoja en blanco al lado de otra apretada.
    n_lam = max(1, -(-cupos // MAX_FOTOS))
    tope = -(-cupos // n_lam)
    out, act, usados = [], [], 0
    for ocupa, fila in filas:
        if ocupa and usados >= tope and act:
            out.append(act)
            act, usados = [], 0
        act.append(fila)
        usados += ocupa
    if act:
        out.append(act)
    return out


def nombre_lamina(op, k, total):
    return op if total == 1 else "%s%s" % (op, SUFIJO[k])
