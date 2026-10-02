# -*- coding: utf-8 -*-
"""hojas_v3_spec.py — el contenido de las hojas HOTMELT en el formato de una foto por paso.

Dos juegos (decision de Fak, 01/10/2026):
  PRODUCCION — HO-992 TOP ROLL, operacion 20 ADHESIVADO HOT MELT (lo que se hace para producir).
  MAQUINA    — HO-993 LAMINADORA HOT MELT, hoja de maquina que va a 2- SECTORES; numera sus
               operaciones 10, 20, 30... como la HO 118 de la costura CNC.

Cada paso lleva `fuentes`: de donde sale lo que dice (pagina del manual del fabricante, cuadro
de la biblioteca de videos, o quien lo dijo). Eso NO se imprime: es para poder auditar la hoja.
Lo que ninguna fuente dice no se escribe como paso: va a FALTA (lista de lo que hay que
preguntar o filmar), que tampoco se imprime.
"""
import generar_hojas_hotmelt_a3 as base
from fotos_v3 import ruta

# El EPP sale del riesgo real de cada operacion, no de un juego igual para todas las hojas
# (hojas-proceso.md punto 16). Fak, 03/09/2026: "mas que nada mascara o sea barbijo para los gases
# y guantes para las quemaduras". Cada hoja lleva el juego que tenia SU operacion en el deck A3
# del 30/09 (el ultimo que Fak miro), leido de `generar_hojas_hotmelt_a3.py`:
#   pantalla sola (acceso al HMI, parametros, centrado y tension)        -> ropa y calzado
#   manos en el material o en la maquina (rollo, enhebrado, empalme,
#     cambio, arranque, parada)                                          -> + guantes
#   adhesivo o rodillos calientes (fusor, calentamiento, marcha, limpieza) -> + barbijo
# Que juego va en cada hoja lo decide Fak; esto es el punto de partida con fuente.
EPP_BASE = [base.ICO_ROPA, base.ICO_CALZADO]
EPP_MANOS = EPP_BASE + [base.ICO_GUANTES]
EPP_CALOR = EPP_MANOS + [base.ICO_BARBIJO]

# Tono (criterios 4.4): el aviso manda una accion, no lamenta una consecuencia.
AVISO_RODILLOS = ("RODILLOS CALIENTES: trabajar siempre con guantes para calor y barbijo. "
                  "No meter herramientas de metal entre los rodillos.")
# manual p. 23-24: "each shift must ensure that the rubber roller and metering roller are cleaned";
# IMG_0390 00:49 a 01:00: no se limpia con la maquina en funcionamiento.
AVISO_LIMPIEZA = "LIMPIAR LOS RODILLOS EN CADA TURNO. Usar guantes para calor y barbijo."
# manual p. 4 punto 3 y p. 5 punto 12
AVISO_MECANISMO = ("ANTES DE TOCAR UN MECANISMO O MATERIAL TRABADO: apretar la parada de emergencia y "
                   "cerrar el aire. Usar guantes para calor.")

AVISO_METAL = None
# Fak, 02/10/2026: el enhebrado completo es la excepcion; lo normal es el empalme.
AVISO_ENHEBRADO = ("SOLO CON LA MÁQUINA SIN MATERIAL PASADO. En el trabajo normal el rollo nuevo "
                   "se une con un empalme (HO-992, operación 20.3).")
AVISO_FRIO = "Girar y juntar los rodillos solo con los dos por encima de 150 °C."

MAQUINA = [
    dict(op="10", denominacion="ENCENDIDO DE LA MÁQUINA", aviso=AVISO_METAL, epp=EPP_BASE,
         pasos=[
             dict(texto="Retirar de la máquina todo lo que no es de la máquina y verificar que no haya "
                        "piezas metálicas entre los dos rodillos.",
                  foto=ruta("e_rodillos"), pie="Rodillos detrás de la ventana",
                  fuentes=["manual p. 6 punto 1.1", "IMG_0383 03:49 a 04:25",
                           "Fak 07/09/2026: verificar que no haya piezas metalicas, sin consecuencias"]),
             dict(texto="Abrir la llave de aire y verificar que el manómetro marque entre 0,4 y 0,7 MPa.",
                  fotos=[dict(foto=ruta("e_aire"), pie="Llave de aire"),
                         dict(foto=ruta("e_manometro"), pie="Manómetro de aire")],
                  fuentes=["manual p. 6 punto 1.2, p. 7 y p. 8"]),
             dict(texto="Girar la llave general a ON.",
                  foto=ruta("e_llave"), pie="Llave general",
                  fuentes=["IMG_9527 00:00 a 00:26", "manual p. 7"]),
             dict(texto="Esperar a que cargue la pantalla y apretar el botón de inicio (“Start”).",
                  foto=ruta("e_start"), pie="Pantalla al encender",
                  fuentes=["IMG_9527 01:07 a 01:20", "manual p. 9"]),
             dict(texto="Elegir el idioma inglés con el botón de arriba a la derecha de la pantalla principal.",
                  foto=ruta("e_idioma"), pie="Botón de idioma",
                  fuentes=["IMG_9527 01:41 a 01:58", "manual p. 10"]),
         ]),
    dict(op="20", denominacion="PUESTA EN MARCHA DEL FUSOR DE ADHESIVO", epp=EPP_CALOR,
         pasos=[
             dict(texto="Encender el interruptor rojo del fusor.",
                  foto=ruta("f_interruptor"), pie="Interruptor del fusor",
                  fuentes=["IMG_9527 05:22 a 05:39"]),
             dict(texto="Elegir el idioma y apretar el botón de entrada al sistema (“Enter the system”).",
                  foto=ruta("f_bienvenida"), pie="Pantalla de inicio del fusor",
                  fuentes=["IMG_9527 05:26 a 05:50"]),
             dict(texto="Apretar el primer botón del menú, ajuste de temperaturas.",
                  foto=ruta("f_menu"), pie="Menú del fusor",
                  fuentes=["IMG_9527 06:06", "manual p. 32"]),
             dict(texto="Apretar el botón de calentamiento de las cinco filas: tanque, dos mangueras y "
                        "dos pistolas. Verificar que queden en verde.",
                  foto=ruta("f_tabla"), pie="Botones de calentamiento",
                  fuentes=["IMG_9527 06:18 (cuadros 0378, 0459 y 0480)", "manual p. 33"]),
             dict(texto="Verificar que la temperatura programada sea 160 °C en las cinco filas. "
                        "⚠ No modificar ningún valor de esa pantalla.",
                  foto=ruta("f_tabla_consigna"), pie="Temperatura programada",
                  fuentes=["cuadro 9527_0384", "IMG_9527 06:48 a 07:30",
                           "memoria reference_maquina_hotmelt_parametros"]),
             dict(texto="Esperar a que las cinco filas lleguen a la temperatura programada antes de producir.",
                  fuentes=["IMG_9527 06:47 a 06:50 (llega a 160 y no calienta mas)",
                           "cuadros 9527_0459 y 9527_0480 (rampa)"]),
         ]),
    dict(op="30", denominacion="CALENTAMIENTO DE RODILLOS", aviso=AVISO_FRIO, epp=EPP_CALOR,
         pasos=[
             dict(texto="Verificar la receta cargada (HO-992, operación 20.1) y que no haya alarmas "
                        "activas (operación 50) antes de calentar.",
                  fuentes=["manual p. 11, Notice 1 y 2: confirmar receta y parametros, y sin alarmas"]),
             dict(texto="Apretar el botón de la pantalla de operación (“Operation screen F1”) en la "
                        "pantalla principal.",
                  foto=ruta("c_home_f1"), pie="Pantalla principal",
                  fuentes=["cuadro 0836_03", "manual p. 10"]),
             dict(texto="Apretar los dos botones de calentamiento de los rodillos (1 y 2). "
                        "Verificar que queden en verde.",
                  foto=ruta("c_calentar"), pie="Botones de calentamiento",
                  fuentes=["IMG_9527 02:07 a 02:11", "manual p. 11 paso 1"]),
             dict(texto="Esperar a que la temperatura de los dos rodillos, que se lee en esa misma "
                        "pantalla, supere los 150 °C.",
                  misma_foto_que=3,
                  fuentes=["IMG_9527 02:25 a 02:50", "cuadro 0836_11 (Foolproof Temp 150,0)",
                           "manual p. 30 punto 2"]),
             dict(texto="Poner en ON los dos interruptores de giro de los rodillos (1 y 2).",
                  foto=ruta("c_girar"), pie="Interruptores de giro",
                  fuentes=["IMG_9527 03:16 a 03:50", "manual p. 11 paso 2"]),
             dict(texto="Apretar el botón amarillo Reset.",
                  foto=ruta("c_reset"), pie="Botón Reset",
                  fuentes=["IMG_9527 03:56 a 04:02 (el técnico: girar, Reset y después juntar)"]),
             dict(texto="Apretar el botón de posición de encolado (“Glue Gap position”) para juntar "
                        "los rodillos.",
                  foto=ruta("c_gap"), pie="Botón de posición de encolado",
                  fuentes=["IMG_9527 03:43 a 04:13", "manual p. 11 paso 3"]),
         ]),
    dict(op="40", hoja_de=(1, 2), denominacion="LIMPIEZA DE RODILLOS",
         aviso=AVISO_LIMPIEZA, epp=EPP_CALOR,
         pasos=[
             dict(texto="Usar guantes para calor. Tener a mano el trapo y la parafina.",
                  fuentes=["manual p. 5 punto 12", "cuadro 0387_0063"]),
             dict(texto="Apretar el botón de la pantalla de limpieza (“Cleaning glue screen F3”) en la "
                        "pantalla principal.",
                  foto=ruta("l_home_f3"), pie="Pantalla principal",
                  fuentes=["cuadro 0836_03", "IMG_9527 81:14"]),
             dict(texto="Apretar el botón 1, inicio de limpieza (“Glue removal starts”), y esperar a que el punto de la esquina "
                        "del botón quede en rojo.",
                  foto=ruta("l_boton1"), pie="Botón 1",
                  fuentes=["manual p. 24 paso 1", "cuadro 0836_05", "IMG_9527 81:20 a 81:48"]),
             dict(texto="Abrir la puerta de los rodillos y colocar la bandeja debajo del rodillo. "
                        "Si suena la alarma, apretar el botón amarillo Reset.",
                  fotos=[dict(foto=ruta("l_bandeja"), pie="Bandeja debajo del rodillo"),
                         dict(foto=ruta("c_reset"), pie="Botón Reset")],
                  fuentes=["manual p. 24 paso 1", "cuadro 0387_0057", "IMG_9527 81:48 a 82:07",
                           "cuadro 9527_5300"]),
             dict(texto="Cerrar la puerta y apretar el botón 2, agregar parafina (“Add detergent”). "
                        "Esperar el punto rojo: los rodillos quedan girando.",
                  foto=ruta("l_boton2"), pie="Botón 2",
                  fuentes=["manual p. 24 paso 2", "cuadro 0836_05", "IMG_9527 82:12 a 82:21"]),
             dict(texto="Abrir la puerta y apoyar los bloques de parafina sobre los rodillos, que siguen "
                        "girando. Cerrar la puerta y apretar Reset. ⚠ No meter las manos entre los rodillos.",
                  foto=ruta("l_parafina"), pie="Parafina sobre el rodillo",
                  fuentes=["manual p. 24 paso 2", "cuadro 0387_0077", "IMG_9527 82:21 a 82:43"]),
             dict(texto="Dejar girar los rodillos de 5 a 10 minutos, hasta que la parafina ablande el pegamento.",
                  fuentes=["manual p. 24 paso 2 (10 minutos)", "IMG_9527 82:44 a 82:52 (unos 5 minutos)",
                           "IMG_0387 05:39 (4 o 5 minutos)"]),
         ]),
    dict(op="40", hoja_de=(2, 2), denominacion="LIMPIEZA DE RODILLOS",
         aviso=AVISO_RODILLOS, epp=EPP_CALOR,
         pasos=[
             dict(texto="Apretar el botón 3, detener el giro (“Stop spinning”), y esperar el punto rojo. "
                        "⚠ No abrir la puerta si el punto no está en rojo.",
                  foto=ruta("l_boton3"), pie="Botón 3",
                  fuentes=["manual p. 24 paso 3", "cuadro 0836_05", "IMG_9527 82:53 a 83:06"]),
             dict(texto="Abrir la puerta y pasar el trapo por el rodillo encolador y por el dosificador.",
                  foto=ruta("l_trapo"), pie="Trapo sobre el rodillo",
                  fuentes=["manual p. 24 paso 3", "cuadro 0389_0049"]),
             dict(texto="Apretar los botones de giro del rodillo (“Jog forward” o “Jog reverse”) para girarlo y "
                        "limpiar la otra cara con el trapo. ⚠ Retirar la mano y el trapo antes de apretar el giro.",
                  foto=ruta("l_giro"), pie="Botones de giro del rodillo",
                  fuentes=["manual p. 24 paso 3 (limpiar, girar y volver a limpiar)", "cuadro 0836_05",
                           "cuadro 0387_0145", "IMG_0390 00:49 a 01:00 (no se limpia en funcionamiento)"]),
             dict(texto="Repetir desde el botón 2 de la hoja 1 (agregar parafina) si queda pegamento en los rodillos.",
                  fuentes=["manual p. 24", "IMG_9527 83:10 a 83:18"]),
             # la bandeja sale ANTES del boton 4: es el orden del audio ("saca la cosa y pone esta") y
             # el lado seguro; lo que hace el boton 4 con el eje de elevacion sigue en FALTA
             dict(texto="Retirar la bandeja de abajo del rodillo y limpiarla con trapo fuera de la máquina.",
                  foto=ruta("l_bandeja_afuera"), pie="Bandeja fuera de la máquina",
                  fuentes=["manual p. 24 paso 4 (la bandeja debe retirarse)", "cuadro 0390_0010",
                           "IMG_9527 83:18 a 83:39: saca la bandeja y despues aprieta el fin"]),
             dict(texto="Cerrar la puerta y apretar el botón 4, fin de limpieza (“Glue removal finished”). "
                        "⚠ No apretar el botón 4 con la bandeja colocada.",
                  foto=ruta("l_boton4"), pie="Botón 4",
                  fuentes=["manual p. 24 paso 4", "cuadro 0836_05",
                           "IMG_9527 83:26 a 83:39 (no olvidar sacar la bandeja)"]),
         ]),
    dict(op="50", denominacion="CONTROL DE ALARMAS", aviso=AVISO_MECANISMO, epp=EPP_MANOS,
         pasos=[
             dict(texto="Mirar la torre de luces: amarilla, hay una alarma; roja, la máquina está "
                        "parada; verde, la máquina está en marcha.",
                  fuentes=["manual p. 45 y p. 46, encabezado (Warning lights)"]),
             dict(texto="Apretar el botón del registro de alarmas (“Alarm Record Screen F7”) en la "
                        "pantalla principal y leer las primeras filas de la lista.",
                  fotos=[dict(foto=ruta("a_home_f7"), pie="Pantalla principal"),
                         dict(foto=ruta("a_alarmas"), pie="Lista de alarmas")],
                  fuentes=["cuadros 0836_03 y 0836_10", "manual p. 45"]),
             dict(texto="Cerrar la puerta que nombra la alarma si el texto dice “door is not closed” "
                        "(puerta sin cerrar).",
                  fuentes=["manual p. 46 alarma 8", "cuadro 0836_10"]),
             dict(texto="Verificar que ningún botón de parada de emergencia esté apretado si el texto "
                        "dice “Emergency stop”: el del tablero (2) y los demás de la máquina.",
                  foto=ruta("a_botonera"), pie="Reset (1) y parada de emergencia (2)",
                  fuentes=["manual p. 45 alarma 1 (cada boton de parada de emergencia)", "cuadro 0836_10",
                           "cuadros 0347_0023 y 0364_0003 (otros botones en la maquina)"]),
             dict(texto="Apretar el botón amarillo Reset (1).",
                  misma_foto_que=4,
                  fuentes=["manual p. 12 y p. 45", "IMG_9527 81:48 a 82:07"]),
             dict(texto="Avisar al líder si el texto nombra una falla (“fault”, “failure” o "
                        "“malfunction”), si avisa nivel bajo de adhesivo (“low liquid level”) o si la "
                        "alarma vuelve a aparecer.",
                  fuentes=["manual p. 45 y p. 46 (alarmas de accionamientos: revisión del variador)",
                           "manual p. 46: falla y nivel bajo del fusor son avisos, no detienen la maquina"]),
         ]),
    # El enhebrado completo NO es del trabajo de todos los dias (Fak, 02/10/2026: "lo unico que
    # hay que hacer es un empalme con el rollo viejo y listo... no se pasa el vinilo siempre por
    # todos lados"). Por eso vive aca, en la hoja de la maquina, y no en la operacion 20.
    dict(op="60", hoja_de=(1, 2), denominacion="ENHEBRADO DEL MATERIAL", epp=EPP_MANOS,
         aviso=AVISO_ENHEBRADO,
         pasos=[
             dict(texto="Apretar el botón de la pantalla manual (“Hand-drawn screen F2”) en la "
                        "pantalla principal.",
                  foto=ruta("n_home_f2"), pie="Pantalla principal",
                  fuentes=["cuadro 0836_03", "IMG_9527 72:27"]),
             dict(texto="Apretar el botón del modo de enhebrado (“Feeding material Mode”). "
                        "Verificar que quede en verde.",
                  foto=ruta("n_modo"), pie="Pantalla manual",
                  fuentes=["manual p. 13", "cuadros 0836_04 y 9527_4580"]),
             dict(texto="Llevar la punta del material hacia arriba por el primer rodillo, del lado del frente.",
                  foto=ruta("n_rollo"), pie="Salida del rollo",
                  fuentes=["IMG_9415 00:00 a 00:45", "cuadro 9415_0002"]),
             dict(texto="Pasar el material por el acumulador de entrada: sube y baja tres veces.",
                  foto=ruta("n_acumulador"), pie="Acumulador de entrada",
                  fuentes=["IMG_9415 (sube, baja, sube, baja, sube, baja)", "manual p. 13 y p. 17"]),
             # "detector", no "sensor de borde": ninguna fuente le pone ese nombre (ver hoja 20.4)
             dict(texto="Pasar el borde del material por el detector negro que está sobre la regla.",
                  foto=ruta("r_sensor_borde"), pie="Detector sobre la regla",
                  fuentes=["IMG_9415 00:45 (tiene que pasar por este dispositivo negro)", "cuadro 9415_0024"]),
             dict(texto="Pasar el material por debajo del rodillo y subirlo hasta los rodillos de encolado.",
                  fuentes=["IMG_9415 01:00", "manual p. 13"]),
         ]),
    dict(op="60", hoja_de=(2, 2), denominacion="ENHEBRADO DEL MATERIAL", epp=EPP_MANOS,
         aviso=AVISO_ENHEBRADO,
         pasos=[
             # SIN FOTO a proposito: la unica toma (IMG_0360) muestra el material MAL pasado
             # ("esta esta mal pasada... es un modo de falla"). Lo que vale de ese video es el audio.
             dict(texto="Verificar que el material pase por adentro, entre el rodillo plateado y el verde.",
                  fuentes=["IMG_0360 00:00 (audio: el vinilo tiene que ir por adentro, entre el plateado y aca)"]),
             dict(texto="Pasar el material por la mesa de enfriamiento y por el acumulador de salida.",
                  foto=ruta("n_enfriamiento"), pie="Mesa de enfriamiento",
                  fuentes=["manual p. 13", "cuadros 0392_0020 a 0025 y 0361_0001 a 0025"]),
             dict(texto="Llevar el material sobre el rodillo cromado alto y bajarlo hasta el enrollador.",
                  foto=ruta("n_salida"), pie="Rodillo cromado alto",
                  fuentes=["cuadros 0361_0028 a 0040"]),
             dict(texto="Pegar la punta al tubo de cartón con cinta adhesiva y dar 3 vueltas a mano.",
                  foto=ruta("n_tubo"), pie="Punta pegada al tubo",
                  fuentes=["manual p. 15 pasos 4 y 5", "cuadros 0361_0041 a 0048"]),
             dict(texto="Inflar el eje del enrollador con la manguera naranja.",
                  foto=ruta("r_inflar"), pie="Boquilla en el orificio del eje",
                  fuentes=["manual p. 15 paso 6", "IMG_0355 2:58 a 3:10"]),
             dict(texto="Verificar que el material salga derecho.",
                  foto=ruta("n_derecho"), pie="Material a la salida",
                  fuentes=["IMG_0394 03:33", "cuadro 0394_0100"]),
         ]),
]

EPP_ROLLO = EPP_MANOS

AVISO_EMPALME = "EL EMPALME VA RECTO: cortar la punta recta y pegar la cinta adhesiva recta."
# INFERENCIA (ninguna fuente lo dice con estas palabras; esta en FALTA para confirmar). Lo que dicen
# las fuentes: al girar la llave de cambio corre el tiempo del cambio, y si no se termina la maquina
# se detiene (IMG_9527 33:19 a 33:40 y 40:35 a 40:54). De ahi sale que el rollo tiene que estar a mano.
# Fak, 02/10/2026: "lo unico que hay que hacer es un empalme con el rollo viejo y listo".
AVISO_SIGUE_EMPALME = ("EL ROLLO NUEVO SE UNE CON UN EMPALME AL MATERIAL QUE QUEDÓ PASADO EN LA MÁQUINA "
                       "(hoja 20.3). No hace falta volver a pasar el material por la máquina.")
AVISO_ROLLO_LISTO = "TENER EL ROLLO SIGUIENTE AL LADO DEL DESBOBINADOR ANTES DE QUE SUENE LA ALARMA DE FIN DE MATERIAL."

PRODUCCION = [
    dict(op="20.1", denominacion="CONTROL DE LA RECETA", epp=EPP_BASE, cuando="cada arranque",
         aviso="El encendido de la máquina, del fusor y de los rodillos está en la HO-993.",
         pasos=[
             dict(texto="Apretar el botón de receta (“Recipe F5”) en la pantalla principal.",
                  foto=ruta("v_home_f5"), pie="Pantalla principal",
                  fuentes=["IMG_9527 14:46 a 15:20", "cuadro 0836_03", "manual p. 10"]),
             dict(texto="Verificar que la receta sea la número 1 (1) y el modelo “tpo” (2). "
                        "⚠ No modificar los valores de la receta.",
                  foto=ruta("v_receta"), pie="Pantalla de receta",
                  fuentes=["cuadro 0836_08", "IMG_9527 14:46 a 15:20",
                           "manual p. 10 (cambiar la receta pide usuario y clave)"]),
             dict(texto="Verificar que no haya alarmas activas antes de arrancar (HO-993, operación 50).",
                  fuentes=["manual p. 11, aviso"]),
         ]),
    dict(op="20.2", denominacion="MONTAJE DEL ROLLO EN EL DESBOBINADOR", epp=EPP_ROLLO, cuando="cada rollo",
         aviso=AVISO_SIGUE_EMPALME,
         pasos=[
             dict(texto="Retirar el film de plástico del rollo nuevo.",
                  foto=ruta("r_film"), pie="Rollo nuevo sin el film",
                  fuentes=["IMG_0366 cuadros 0019 a 0025"]),
             dict(texto="Colocar el eje neumático por el tubo de cartón del rollo, con el rollo parado en el piso.",
                  foto=ruta("r_eje_tubo"), pie="Eje dentro del tubo del rollo",
                  fuentes=["IMG_0367 0:10 a 0:22"]),
             dict(texto="Trasladar el rollo con el eje entre dos personas y apoyar el extremo del eje en el "
                        "brazo del desbobinador.",
                  foto=ruta("r_volante"), pie="Extremo del eje en el brazo",
                  fuentes=["IMG_0367 0:24 a 0:30 (lo llevan dos personas)", "foto IMG_0365"]),
             dict(texto="Girar el volante cromado con las dos manos hasta trabar el eje.",
                  foto=ruta("r_volante_giro"), pie="Volante cromado",
                  fuentes=["IMG_0366 0:00 a 0:08", "manual p. 14 paso 3"]),
             dict(texto="Empujar el rollo sobre el eje hasta dejarlo centrado.",
                  foto=ruta("r_centrar"), pie="Rollo sobre el eje",
                  fuentes=["IMG_0359 cuadros 0001 a 0003 y audio 00:00",
                           "INFERENCIA: va antes de inflar porque el eje inflado sujeta el tubo (ver FALTA)"]),
             dict(texto="Colocar la boquilla de la manguera naranja en el orificio del eje e inflar el eje.",
                  foto=ruta("r_inflar"), pie="Boquilla en el orificio del eje",
                  fuentes=["IMG_0355 2:58 a 3:10", "manual p. 14 paso 4"]),
         ]),
    # El paso "verificar el sensor de borde sobre el borde del material" se saco el 02/10: ninguna
    # fuente llama "sensor de borde" al aparato de la regla (con el en cuadro, el audio habla del
    # detector de la cinta de aviso), y el guiador de borde se explica en otro lugar de la maquina.
    dict(op="20.4", denominacion="CENTRADO Y TENSIÓN DE LA BANDA", epp=EPP_BASE, cuando="cada rollo",
         pasos=[
             dict(texto="Verificar que el guiador de borde esté en automático. ⚠ No modificar sus valores.",
                  fuentes=["IMG_9527 46:34 a 49:11"]),
             dict(texto="Verificar que el controlador de tensión esté en automático.",
                  foto=ruta("r_tension"), pie="Controlador de tensión y contador de metros", entera=True,
                  fuentes=["cuadro 9527_2500", "memoria reference_maquina_hotmelt_parametros"]),
             dict(texto="Verificar en el contador de metros el valor de aviso cargado para el rollo.",
                  misma_foto_que=2,
                  fuentes=["IMG_9527 41:17 a 43:26", "cuadro 9527_2500"]),
         ]),
    dict(op="20.7", denominacion="CAMBIO DE ROLLO POR ALARMA DE FIN DE MATERIAL", epp=EPP_ROLLO, cuando="cada rollo",
         aviso=AVISO_ROLLO_LISTO,
         pasos=[
             # El paso 1 va SIN FOTO: en el cuadro 9527_2590 la banda azul esta pegada al RODILLO, no
             # es la cinta de aviso, y ninguna fuente muestra la cinta pegada.
             dict(texto="Pegar una cinta adhesiva como indicador para el cambio de rollo.",
                  fuentes=["IMG_9527 39:59 a 40:27 (tenemos que pegar una cinta como indicador)"]),
             # El detector SI tiene fuente: con ese aparato en cuadro (9527_2650 a 2670) el tecnico
             # dice "aca tiene un detector... veni a fijar si la cinta llega aca".
             dict(texto="Verificar en el desbobinador, cuando suena la alarma, que la cinta adhesiva "
                        "llegó al detector (1).",
                  foto=ruta("r_cinta_aviso"), pie="Detector de la cinta adhesiva (1)",
                  fuentes=["IMG_9527 40:27 a 40:35 y 41:17 a 41:38", "cuadros 9527_2590 y 9527_2650 a 2670"]),
             dict(texto="Girar la llave de cambio de rollo de OFF a ON. ⚠ La máquina se detiene si el "
                        "cambio no se termina a tiempo.",
                  foto=ruta("r_llave"), pie="Llave de cambio de rollo",
                  fuentes=["manual p. 14 paso 1", "IMG_9527 40:35 a 40:54", "cuadro 9527_2610"]),
             dict(texto="Girar el volante cromado para soltar el eje, sacar el aire del eje y retirar el eje "
                        "con el tubo vacío.",
                  foto=ruta("r_tubo_vacio"), pie="Tubo vacío en el eje",
                  fuentes=["IMG_0364 0:03", "IMG_0366 0:00 a 0:16", "manual p. 14 paso 3"]),
             dict(texto="Sacar el tubo vacío del eje. Montar el rollo nuevo como indica la hoja 20.2 y "
                        "empalmar como indica la hoja 20.3.",
                  foto=ruta("r_montado"), pie="Rollo nuevo montado",
                  fuentes=["cuadros 0366_0006 a 0012 (el eje sale del tubo vacío)", "IMG_0367 0:10 a 0:36",
                           "manual p. 14 pasos 3 y 4"]),
         ]),
    dict(op="20.3", denominacion="EMPALME DEL MATERIAL", aviso=AVISO_EMPALME, epp=EPP_ROLLO, cuando="cada rollo",
         pasos=[
             dict(texto="Llevar la punta del material nuevo hasta la mesa superior, junto a la barra amarilla.",
                  foto=ruta("r_punta"), pie="Punta del material nuevo",
                  fuentes=["IMG_0367 0:38 a 1:34", "manual p. 14 paso 5"]),
             dict(texto="Apretar la punta contra la mesa con la mano y alinearla con la punta del material que "
                        "quedó pasado en la máquina.",
                  foto=ruta("r_apretar"), pie="Mano sobre el material",
                  fuentes=["IMG_0367 cuadros 0049 a 0090", "manual p. 14 paso 6"]),
             dict(texto="Cortar la punta con el cúter, recta de lado a lado. ⚠ Usar guantes anticorte y "
                        "mantener la otra mano lejos de la cuchilla.",
                  fuentes=["IMG_0367 cuadro 0098 y audio 02:56", "IMG_0367 04:06 a 04:15",
                           "Fak 07-08/09/2026, sobre la lamina de CORTE DE LA PLANCHA: el corte va con guantes "
                           "anticorte. Aca se aplica al mismo riesgo (cuchilla en la mano); confirmar con Fak"]),
             dict(texto="Pegar la cinta adhesiva ancha a todo lo ancho del material, recta, y presionarla con la mano.",
                  foto=ruta("r_empalme_pegando"), pie="Cinta adhesiva del empalme",
                  fuentes=["IMG_0379 0:32 a 4:20", "manual p. 14 paso 7"]),
             dict(texto="Pegar una tira corta de cinta adhesiva en cada borde del empalme.",
                  foto=ruta("r_empalme"), pie="Empalme terminado",
                  fuentes=["IMG_0379 cuadros 0133 a 0141"]),
             dict(texto="Soltar la punta del material.",
                  fuentes=["manual p. 14 paso 8"]),
         ]),
    dict(op="20.5", denominacion="ARRANQUE Y ALINEACIÓN", epp=EPP_ROLLO, cuando="cada arranque",
         pasos=[
             dict(texto="Verificar en la pantalla de operación que la casilla de calentamiento completo "
                        "(“Heating complete”) esté en verde.",
                  foto=ruta("m_listo"), pie="Pantalla de operación",
                  fuentes=["manual p. 11, aviso", "cuadro 0836_01", "IMG_0391 00:18 a 01:20"]),
             dict(texto="Verificar que no haya piezas metálicas sobre el material ni entre los rodillos.",
                  fuentes=["Fak 07/09/2026 (el punto es el material y lo que queda entre los rodillos al pasarlo)",
                           "IMG_0383 03:38 a 04:25"]),
             dict(texto="Verificar que todas las puertas estén cerradas. Si suena la alarma, apretar el "
                        "botón amarillo Reset.",
                  fuentes=["manual p. 45 y p. 46", "IMG_9527 82:00"]),
             dict(texto="Apretar el botón verde Start.",
                  foto=ruta("m_start"), pie="Botón Start",
                  fuentes=["IMG_0392 cuadros 0001 a 0004", "IMG_0394 00:00 a 00:13", "manual p. 12"]),
             dict(texto="Verificar en la pantalla que el estado pase a marcha automática.",
                  foto=ruta("m_marcha"), pie="Estado en marcha automática",
                  fuentes=["cuadro 0392_0004"]),
             dict(texto="Verificar que el material salga derecho por el rodillo de salida.",
                  foto=ruta("n_derecho"), pie="Material a la salida",
                  fuentes=["IMG_0394 03:33", "cuadros 0394_0100 y 0394_0106"]),
         ]),
    # filas=[2]: la pantalla es la foto que el paso manda LEER (gate 1), va grande aunque el
    # acumulador quede mas chico que en baldosas iguales
    dict(op="20.6", denominacion="LAMINADO — CONTROL DURANTE LA MARCHA", epp=EPP_CALOR, filas=[2],
         cuando="durante la marcha",
         pasos=[
             dict(texto="Verificar en la pantalla que la temperatura de los dos rodillos se mantenga en "
                        "la programada, 185 °C. Si aparece una alarma de temperatura, avisar al líder.",
                  foto=ruta("m_temperaturas"), pie="Temperatura de los rodillos",
                  fuentes=["cuadros 0392_0004, 0394_0001 y 0836_12",
                           "cuadro 0836_01: Set temperature 185,0 en los dos rodillos, receta 1",
                           "IMG_9527 22:36 a 22:50 (185 para el adhesivo en uso)",
                           "cuadro 0836_11: alarma de temperatura alta y baja"]),
             dict(texto="Verificar que el adhesivo cubra todo el ancho del material, parejo, sin rayas y "
                        "sin zonas sin adhesivo. Si no, avisar al líder.",
                  fuentes=["IMG_9527 20:42 a 21:08 (rayas) y 22:48 a 23:01 (tiritas, adhesivo quemado)",
                           "IMG_0394 04:14 (sin adhesivo)"]),
             # los acumuladores bajan DESPUES de girar la llave de cambio (IMG_9527 40:35 a 40:54):
             # no son el aviso de fin de rollo. El aviso es la alarma.
             dict(texto="Verificar que los acumuladores estén arriba. Si suena la alarma de fin de "
                        "material, seguir la hoja 20.7.",
                  foto=ruta("n_acumulador"), pie="Acumulador",
                  fuentes=["IMG_9527 31:30 a 31:58 (en operación están arriba)", "IMG_9527 41:17 a 43:26",
                           "manual p. 17 y p. 18"]),
             dict(texto="Avisar al líder si aparece la alarma de nivel bajo de adhesivo (“low liquid level”).",
                  fuentes=["manual p. 46: Glue machine low liquid level es un aviso, no detiene la máquina"]),
         ]),
    dict(op="SIN FOTO", denominacion="CORTE DE LA PLANCHA", epp=EPP_CALOR, cuando="sin confirmar",
         aviso="No cortar en el piso. No cortar en cuadrado: los cortes cuadrados dan problemas en la máquina.",
         pasos=[
             dict(texto="Usar guantes anticorte.",
                  fuentes=["Fak, observaciones del 07-08/09/2026"]),
             dict(texto="Apoyar el material sobre una mesa.",
                  fuentes=["Fak, observaciones del 07-08/09/2026", "cuadros 0354_0035 a 0037"]),
             dict(texto="Cortar con el cúter empezando por el costado, nunca por el centro.",
                  fuentes=["Fak, 03/09/2026 (bitácora de las hojas)"]),
             dict(texto="Cortar con forma redondeada, sin esquinas en cuadrado.",
                  fuentes=["Fak, 03/09/2026 (bitácora de las hojas)"]),
         ]),
    dict(op="20.8", denominacion="PARADA DE LA MÁQUINA", aviso=AVISO_MECANISMO, epp=EPP_ROLLO,
         cuando="cada parada",
         pasos=[
             dict(texto="Apretar el botón Stop.",
                  foto=ruta("m_stop"), pie="Botón Stop",
                  fuentes=["manual p. 12"]),
             dict(texto="Verificar en la pantalla que el estado diga “Stopping” (detenido).",
                  foto=ruta("m_detenido"), pie="Estado detenido",
                  fuentes=["cuadros 0836_12 y 0836_13"]),
             dict(texto="Apretar el botón de parada de emergencia ante un riesgo para una persona "
                        "o para la máquina.",
                  foto=ruta("m_emergencia"), pie="Parada de emergencia",
                  fuentes=["manual p. 4 puntos 3 y 9, y p. 12"]),
         ]),
]


def _orden(h):
    return tuple(int(x) for x in h["op"].split(".")) + (h.get("hoja_de", (0,))[0],)


# La hoja de corte no se imprime todavia: no hay ninguna foto valida (todo lo filmado es en el
# piso y sin guantes) y falta confirmar que se corta y cuando. El texto son las reglas de Fak.
SIN_FOTO = [h for h in PRODUCCION if h["op"] == "SIN FOTO"]
PRODUCCION = sorted((h for h in PRODUCCION if h["op"] != "SIN FOTO"), key=_orden)

# Lo que ninguna fuente contesta. No se imprime en las hojas: sale en la lista de pendientes.
FALTA = [
    ("ENHEBRADO", "Qué cara del material va hacia arriba y cuál recibe el adhesivo."),
    ("ENHEBRADO", "Qué mueve el modo de enhebrado, si la tensión se pasa a manual para enhebrar y si se "
                  "enhebra con los rodillos calientes."),
    ("ENHEBRADO", "Fotos limpias del acumulador de entrada, de la entrada al encolado y de los tres pisos "
                  "de la mesa de enfriamiento."),
    ("MARCHA", "Cómo se controla que el adhesivo quede parejo, el peso y el espesor: lo define el plan de "
               "control de Calidad."),
    ("MARCHA", "Si la casilla “Low Level” de la pantalla de operación es el mismo aviso de nivel bajo que "
               "nombra el manual, y foto de la pantalla en inglés con la máquina en marcha."),
    ("PARADA", "Foto de alguien apretando Stop; cómo se prueba y cómo se suelta la parada de emergencia."),
    ("CORTE", "Filmar el corte como lo pidió Fak: sobre mesa, con guantes anticorte, forma redondeada y por "
              "el costado. Confirmar qué se corta y cuándo."),
    ("ROLLO", "Confirmar en la máquina que el rollo se centra ANTES de inflar el eje, y contra qué se centra."),
    ("ROLLO", "Si el rollo se mueve entre dos personas (así se ve en el video) y cuánto pesa."),
    ("ROLLO", "Verificar el código del rollo antes de montarlo: ninguna fuente dice cómo ni contra qué."),
    ("ROLLO", "Los videos IMG_0358 e IMG_0355 muestran un tubo VACÍO: confirmar si son del enrollador."),
    ("TENSIÓN", "Consigna de tensión vigente: la pantalla decía 20 kg el 25/08 y 25 kg el 28/08."),
    ("TENSIÓN", "Foto del guiador de borde en automático: la que hay lo muestra en manual."),
    ("TENSIÓN", "Valor de aviso del contador de metros: se vieron 105,00, 111,10 y 119,00."),
    ("TENSIÓN", "En qué momento se pasa la tensión de manual a automático: ninguna fuente lo muestra."),
    ("CAMBIO DE ROLLO", "Foto de la llave girada a ON, de la alarma y de los tres rodillos bajando; "
                        "cuánto tiempo da la máquina (el minuto sale solo del audio)."),
    ("CAMBIO DE ROLLO", "Cómo se saca el aire del eje y cuándo se vuelve la llave a OFF."),
    ("EMPALME", "Foto del corte de la punta: la única toma está tapada."),
    ("ENHEBRADO", "Foto del material BIEN pasado entre el rodillo plateado y el verde: la única toma "
                  "(IMG_0360) lo muestra mal pasado y por eso el paso va sin foto."),
    ("MARCHA", "Fotos del adhesivo bien aplicado y de los defectos que se miran en la marcha (rayas, "
               "tiritas, zonas sin adhesivo)."),
    ("ROLLO", "Sentido de giro del volante cromado para trabar el eje: el video que hay es de destrabar."),
    ("CAMBIO DE ROLLO", "Foto de la cinta de aviso pegada (dónde se pega y a cuánto del final del rollo). "
                        "Confirmar en la máquina qué es el detector negro de la regla: el técnico lo muestra "
                        "como el que lee la cinta, y no está claro si además guía el borde."),
    ("CAMBIO DE ROLLO", "Confirmar que conviene tener el rollo siguiente al lado del desbobinador antes de la "
                        "alarma (lo dice el aviso de la hoja 20.7; ninguna fuente lo dice así)."),
    ("EMPALME", "Confirmar con Fak que el corte de la punta va con guantes anticorte (su indicación fue para "
                "el corte de la plancha)."),
    ("SEGURIDAD", "Elementos de seguridad de cada hoja: hoy llevan los del juego anterior del 30/09 según la "
                  "operación (pantalla: ropa y calzado; manos en el material: más guantes; adhesivo o rodillos "
                  "calientes: más barbijo). Lo define Fak. Las fotos muestran manos sin guantes."),
    ("CAMBIO DE ROLLO", "Cambio del rollo terminado en el enrollador: el manual p. 15 da seis pasos y no "
                        "hay video. Cómo se identifica el rollo terminado y a dónde va."),
    ("EMPALME", "Contra qué guía se corta la punta (barra amarilla o varilla cromada) y si la máquina "
                "avanza durante el empalme."),
    ("FUSOR", "Cómo y cuándo se carga el adhesivo en el tanque. Qué adhesivo es: la caja filmada el 26/08 "
              "al lado de la máquina dice H.B. Fuller CQ 7080/5 y el AMFE 162 dice SikaMelt-171."),
    ("LIMPIEZA", "Confirmar el tiempo con la parafina: el manual dice 10 minutos y el técnico dijo 5 "
                 "(la hoja dice de 5 a 10)."),
    ("LIMPIEZA", "Marca de la parafina y dónde se guarda (que es parafina lo confirmó Fak el 30/09)."),
    ("LIMPIEZA", "Confirmar qué hace el botón 4 con la bandeja colocada: la hoja manda retirarla antes, "
                 "que es el orden del video."),
    ("LIMPIEZA", "Con qué se agrega la parafina (el manual dice con cuchara; en el video se apoyan bloques "
                 "a mano) y si la bandeja lleva papel."),
    ("ALARMAS", "Foto de la torre de luces y de los botones de parada de emergencia de los brazos."),
    ("PORTADA", "Foto de la máquina entera para la portada: la que hay es una vista parcial."),
    ("LIMPIEZA", "Para qué se usan las espátulas amarillas guardadas al lado del motor."),
    ("LIMPIEZA", "Foto de la pantalla de limpieza en inglés con la limpieza en marcha (punto rojo de cada botón)."),
    ("ENCENDIDO", "Si el botón Reset va antes o después de juntar los rodillos: el técnico dice girar, "
                  "Reset y juntar (el manual no nombra el Reset); en el video del 28/08 se ve juntar un segundo antes."),
    ("ENCENDIDO", "Si la ventana de alarmas (alarma 53) aparece en cada arranque y cómo se despeja."),
    ("ENCENDIDO", "Si se toca el botón de apertura de adhesivo (“Glue valve activated”) y el de enfriamiento: "
                  "el manual los pone como pasos 4 y 5 del arranque y en ningún video se tocan; en el "
                  "cuadro 0392_0004 la máquina está en marcha automática con ese botón sin activar."),
    ("ENCENDIDO", "En qué momento se aprieta el botón verde Start, y si el fusor se enciende antes que la máquina."),
    ("ENCENDIDO", "Fotos propias de la llave de aire, el manómetro y la llave general con la marca ON "
                  "(hoy son las del manual)."),
    ("FUSOR", "Fotos de la pantalla del fusor en inglés y con todo a 160 °C; cuánto tarda en llegar."),
    ("ALARMAS", "Qué hacer con las alarmas 3 y 53, que el manual no nombra; cómo se suelta la parada de emergencia."),
    ("APAGADO", "No hay ninguna fuente con el orden de apagado: hay que filmarlo con quien lo hace."),
    ("DESTRABE", "No hay foto ni video de cómo se saca el material enrollado en los rodillos."),
]
