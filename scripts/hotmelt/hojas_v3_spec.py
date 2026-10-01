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

EPP_CALOR = [base.ICO_ROPA, base.ICO_CALZADO, base.ICO_GUANTES]

AVISO_RODILLOS = ("RODILLOS CALIENTES: trabajar siempre con guantes para calor. "
                  "No meter herramientas de metal entre los rodillos.")

AVISO_METAL = "No dejar herramientas ni objetos de metal entre los rodillos: se rompen al girar."
AVISO_FRIO = "No girar ni juntar los rodillos con el adhesivo frío: se rompe la máquina."

EPP_BASE = [base.ICO_ROPA, base.ICO_CALZADO]

MAQUINA = [
    dict(op="10", denominacion="ENCENDIDO DE LA MÁQUINA", aviso=AVISO_METAL, epp=EPP_BASE,
         pasos=[
             dict(texto="Retirar de la máquina todo lo que no es de la máquina y verificar que no haya "
                        "nada entre los dos rodillos.",
                  foto=ruta("e_rodillos"), pie="Rodillos detrás de la ventana",
                  fuentes=["manual p. 6 punto 1.1", "IMG_0383 03:49 a 04:25"]),
             dict(texto="Abrir la llave de aire y verificar que el manómetro marque entre 0,4 y 0,7 MPa.",
                  fotos=[dict(foto=ruta("e_aire"), pie="Llave de aire"),
                         dict(foto=ruta("e_manometro"), pie="Manómetro de aire")],
                  fuentes=["manual p. 6 punto 1.2, p. 7 y p. 8"]),
             dict(texto="Girar la llave general a ON.",
                  foto=ruta("e_llave"), pie="Llave general",
                  fuentes=["IMG_9527 00:00 a 00:26", "manual p. 7"]),
             dict(texto="Esperar a que cargue la pantalla y presionar el botón de inicio («Start»).",
                  foto=ruta("e_start"), pie="Pantalla al encender",
                  fuentes=["IMG_9527 01:07 a 01:20", "manual p. 9"]),
             dict(texto="Presionar la casita (1) y elegir el idioma inglés con el botón de arriba a la "
                        "derecha (2).",
                  foto=ruta("e_idioma"), pie="Pantalla principal", badge="abajo",
                  fuentes=["IMG_9527 01:41 a 01:58", "manual p. 10"]),
         ]),
    dict(op="20", denominacion="PUESTA EN MARCHA DEL FUSOR DE ADHESIVO", epp=EPP_BASE,
         pasos=[
             dict(texto="Encender el interruptor rojo del fusor.",
                  foto=ruta("f_interruptor"), pie="Interruptor del fusor",
                  fuentes=["IMG_9527 05:22 a 05:39"]),
             dict(texto="Elegir el idioma y presionar el botón de entrada al sistema («Enter the system»).",
                  foto=ruta("f_bienvenida"), pie="Pantalla de inicio del fusor",
                  fuentes=["IMG_9527 05:26 a 05:50"]),
             dict(texto="Presionar el primer botón del menú, ajuste de temperaturas.",
                  foto=ruta("f_menu"), pie="Menú del fusor",
                  fuentes=["IMG_9527 06:06", "manual p. 32"]),
             dict(texto="Presionar el botón de calentamiento de cada fila: tanque, mangueras y pistolas. "
                        "Verificar que queden en verde.",
                  foto=ruta("f_tabla"), pie="Botones de calentamiento en verde",
                  fuentes=["IMG_9527 06:18 (cuadros 0378, 0459 y 0480)", "manual p. 33"]),
             dict(texto="Verificar que la consigna sea 160 °C en las cinco filas. ⚠ No modificar los límites.",
                  foto=ruta("f_tabla_consigna"), pie="Columna de consigna",
                  fuentes=["cuadro 9527_0384", "IMG_9527 06:48 a 07:30",
                           "memoria reference_maquina_hotmelt_parametros"]),
             dict(texto="Esperar a que todas las filas lleguen a la consigna antes de producir.",
                  fuentes=["IMG_0391 00:18 a 01:20", "cuadros 9527_0459 y 9527_0480 (rampa)"]),
         ]),
    dict(op="30", denominacion="CALENTAMIENTO DE RODILLOS", aviso=AVISO_FRIO, epp=EPP_CALOR,
         pasos=[
             dict(texto="Presionar el botón de la pantalla de operación («Operation screen F1») en la "
                        "pantalla principal.",
                  foto=ruta("c_home_f1"), pie="Pantalla principal",
                  fuentes=["cuadro 0836_03", "manual p. 10"]),
             dict(texto="Presionar los dos botones de calentamiento de los rodillos (1 y 2). "
                        "Verificar que queden en verde.",
                  foto=ruta("c_calentar"), pie="Botones de calentamiento",
                  fuentes=["IMG_9527 02:07 a 02:11", "manual p. 11 paso 1"]),
             dict(texto="Esperar a que los dos rodillos superen los 150 °C.",
                  fuentes=["IMG_9527 02:25 a 02:50", "cuadro 0836_11 (Foolproof Temp 150,0)",
                           "manual p. 30 punto 2"]),
             dict(texto="Poner en ON los dos interruptores de giro de los rodillos (1 y 2).",
                  foto=ruta("c_girar"), pie="Interruptores de giro",
                  fuentes=["IMG_9527 03:16 a 03:50", "manual p. 11 paso 2"]),
             dict(texto="Apretar el botón amarillo Reset.",
                  foto=ruta("l_reset"), pie="Botón Reset",
                  fuentes=["IMG_9527 03:56 a 04:02 (el técnico: girar, Reset y después juntar)"]),
             dict(texto="Presionar el botón de posición de encolado («Glue Gap position») para juntar "
                        "los rodillos.",
                  foto=ruta("c_gap"), pie="Botón de posición de encolado",
                  fuentes=["IMG_9527 03:43 a 04:13", "manual p. 11 paso 3"]),
         ]),
    dict(op="40", hoja_de=(1, 2), denominacion="LIMPIEZA DE RODILLOS",
         aviso=AVISO_RODILLOS, epp=EPP_CALOR,
         pasos=[
             dict(texto="Usar guantes para calor. Tener a mano el trapo y la parafina.",
                  fuentes=["manual p. 5 punto 12", "cuadro 0387_0063"]),
             dict(texto="Presionar en la pantalla la casita (1) y después el botón de la pantalla de limpieza, «Cleaning glue screen F3» (2).",
                  foto=ruta("l_home_f3"), pie="Pantalla principal", badge="abajo",
                  fuentes=["cuadro 0836_03", "IMG_9527 81:14"]),
             dict(texto="Presionar el botón 1, inicio de limpieza («Glue removal starts»), y esperar a que el punto de la esquina "
                        "del botón quede en rojo.",
                  foto=ruta("l_boton1"), pie="Botón 1",
                  fuentes=["manual p. 24 paso 1", "cuadro 0836_05", "IMG_9527 81:20 a 81:48"]),
             dict(texto="Abrir la puerta de los rodillos y colocar la bandeja debajo del rodillo. "
                        "Si suena la alarma, apretar el botón amarillo Reset.",
                  fotos=[dict(foto=ruta("l_bandeja"), pie="Bandeja debajo del rodillo"),
                         dict(foto=ruta("l_reset"), pie="Botón Reset")],
                  fuentes=["manual p. 24 paso 1", "cuadro 0387_0057", "IMG_9527 81:48 a 82:07",
                           "cuadro 9527_5300"]),
             dict(texto="Cerrar la puerta y presionar el botón 2, agregar limpiador («Add detergent»). "
                        "Esperar el punto rojo con los rodillos girando.",
                  foto=ruta("l_boton2"), pie="Botón 2",
                  fuentes=["manual p. 24 paso 2", "cuadro 0836_05", "IMG_9527 82:12 a 82:21"]),
             dict(texto="Abrir la puerta y apoyar los bloques de parafina sobre los rodillos. "
                        "Cerrar la puerta y apretar Reset.",
                  foto=ruta("l_parafina"), pie="Parafina sobre el rodillo",
                  fuentes=["manual p. 24 paso 2", "cuadro 0387_0077", "IMG_9527 82:21 a 82:43"]),
             dict(texto="Dejar girar los rodillos hasta que la parafina ablande el pegamento.",
                  fuentes=["manual p. 24 paso 2", "IMG_9527 82:44"]),
         ]),
    dict(op="40", hoja_de=(2, 2), denominacion="LIMPIEZA DE RODILLOS",
         aviso=AVISO_RODILLOS, epp=EPP_CALOR,
         pasos=[
             dict(texto="Presionar el botón 3, detener el giro («Stop spinning»), y esperar el punto rojo. "
                        "⚠ No abrir la puerta si el punto no está en rojo.",
                  foto=ruta("l_boton3"), pie="Botón 3",
                  fuentes=["manual p. 24 paso 3", "cuadro 0836_05", "IMG_9527 82:53 a 83:06"]),
             dict(texto="Abrir la puerta y pasar el trapo por el rodillo encolador y por el dosificador.",
                  foto=ruta("l_trapo"), pie="Trapo sobre el rodillo",
                  fuentes=["manual p. 24 paso 3", "cuadro 0389_0049"]),
             dict(texto="Presionar los botones de giro del rodillo («Jog forward» o «Jog reverse») para girarlo y "
                        "limpiar la otra cara con el trapo.",
                  foto=ruta("l_giro"), pie="Botones de giro del rodillo",
                  fuentes=["manual p. 24 paso 3", "cuadro 0836_05", "cuadro 0387_0145"]),
             dict(texto="Repetir desde el botón 2 si queda pegamento en los rodillos.",
                  fuentes=["manual p. 24", "IMG_9527 83:10 a 83:18"]),
             dict(texto="Cerrar la puerta y presionar el botón 4, fin de limpieza («Glue removal finished»).",
                  foto=ruta("l_boton4"), pie="Botón 4",
                  fuentes=["manual p. 24 paso 4", "cuadro 0836_05"]),
             dict(texto="Retirar la bandeja de abajo del rodillo y limpiarla con trapo fuera de la "
                        "máquina. ⚠ No dejar la bandeja colocada.",
                  foto=ruta("l_bandeja_afuera"), pie="Bandeja fuera de la máquina",
                  fuentes=["manual p. 23 y p. 24", "IMG_9527 83:26", "cuadro 0390_0010"]),
         ]),
    dict(op="50", denominacion="CONTROL DE ALARMAS", epp=EPP_BASE,
         pasos=[
             dict(texto="Presionar el botón del registro de alarmas («Alarm Record Screen F7») en la "
                        "pantalla principal y leer la primera fila de la lista.",
                  fotos=[dict(foto=ruta("a_home_f7"), pie="Pantalla principal"),
                         dict(foto=ruta("a_alarmas"), pie="Lista de alarmas")],
                  fuentes=["cuadros 0836_03 y 0836_10", "manual p. 45"]),
             dict(texto="Cerrar la puerta que nombra la alarma si el texto dice «door is not closed» "
                        "(puerta sin cerrar).",
                  fuentes=["manual p. 46 alarma 8", "cuadro 0836_10"]),
             dict(texto="Verificar que ningún botón de parada de emergencia esté apretado si el texto "
                        "dice «Emergency stop».",
                  fuentes=["manual p. 45 alarma 1", "cuadro 0836_10"]),
             dict(texto="Apretar el botón amarillo Reset (1).",
                  foto=ruta("a_botonera"), pie="Reset (1) y parada de emergencia (2)",
                  fuentes=["manual p. 12 y p. 45", "IMG_9527 81:48 a 82:07"]),
             dict(texto="Avisar al líder si el texto nombra una falla («fault», «failure» o "
                        "«malfunction») o si la alarma vuelve a aparecer.",
                  fuentes=["manual p. 45 y p. 46 (alarmas de accionamientos: revisión del variador)"]),
         ]),
]

EPP_ROLLO = [base.ICO_ROPA, base.ICO_CALZADO]

AVISO_EMPALME = "EL EMPALME VA RECTO: una unión cruzada se rompe al pasar por los rodillos."

PRODUCCION = [
    dict(op="20.1", denominacion="CONTROL DE LA RECETA", epp=EPP_ROLLO,
         pasos=[
             dict(texto="Presionar el botón de receta («Recipe F5») en la pantalla principal.",
                  foto=ruta("v_home_f5"), pie="Pantalla principal",
                  fuentes=["IMG_9527 14:46 a 15:20", "cuadro 0836_03", "manual p. 10"]),
             dict(texto="Verificar que la receta sea la número 1 (1) y el modelo «tpo» (2).",
                  foto=ruta("v_receta"), pie="Pantalla de receta",
                  fuentes=["cuadro 0836_08", "IMG_9527 14:46 a 15:20"]),
             dict(texto="Verificar que no haya alarmas activas antes de arrancar.",
                  fuentes=["manual p. 11, aviso"]),
         ]),
    dict(op="20.2", denominacion="MONTAJE DEL ROLLO EN EL DESBOBINADOR", epp=EPP_ROLLO,
         pasos=[
             dict(texto="Retirar el film de plástico del rollo nuevo.",
                  foto=ruta("r_film"), pie="Rollo nuevo sin el film",
                  fuentes=["IMG_0366 cuadros 0019 a 0025"]),
             dict(texto="Colocar el eje inflable por el tubo de cartón del rollo, con el rollo parado en el piso.",
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
    dict(op="20.4", denominacion="CENTRADO Y TENSIÓN DE LA BANDA", epp=EPP_ROLLO,
         pasos=[
             dict(texto="Verificar que el sensor de borde quede sobre el borde del material.",
                  foto=ruta("r_sensor_borde"), pie="Sensor de borde",
                  fuentes=["IMG_9527 38:30 a 41:00", "manual p. 17"]),
             dict(texto="Verificar que el guiador de borde esté en automático. ⚠ No modificar sus valores.",
                  foto=ruta("r_guiador"), pie="Guiador de borde",
                  fuentes=["IMG_9527 46:34 a 49:11"]),
             dict(texto="Verificar que el controlador de tensión esté en automático.",
                  foto=ruta("r_tension"), pie="Controlador de tensión y contador de metros", entera=True,
                  fuentes=["cuadro 9527_2500", "memoria reference_maquina_hotmelt_parametros"]),
             dict(texto="Verificar en el contador de metros el valor de aviso cargado para el rollo.",
                  fuentes=["IMG_9527 41:17 a 43:26", "cuadro 9527_2500"]),
         ]),
    dict(op="20.7", denominacion="CAMBIO DE ROLLO POR ALARMA DE FIN DE MATERIAL", epp=EPP_ROLLO,
         pasos=[
             dict(texto="Pegar una cinta adhesiva de aviso sobre el material cuando el rollo está por terminar.",
                  foto=ruta("r_sensor_borde"), pie="Cinta adhesiva de aviso y sensor",
                  fuentes=["IMG_9527 39:59 a 40:35"]),
             dict(texto="Verificar en el desbobinador, cuando suena la alarma, que la cinta adhesiva llegó al sensor.",
                  fuentes=["IMG_9527 41:17 a 43:26"]),
             dict(texto="Girar la llave de cambio de rollo de OFF a ON. ⚠ La máquina se detiene si el "
                        "cambio no se termina a tiempo.",
                  foto=ruta("r_llave"), pie="Llave de cambio de rollo",
                  fuentes=["manual p. 14 paso 1", "IMG_9527 40:35 a 40:54", "cuadro 9527_2610"]),
             dict(texto="Girar el volante cromado para soltar el eje, sacar el aire del eje y retirar el eje "
                        "con el tubo vacío.",
                  foto=ruta("r_tubo_vacio"), pie="Tubo vacío en el eje",
                  fuentes=["IMG_0364 0:03", "IMG_0366 0:00 a 0:16", "manual p. 15 paso 4"]),
             dict(texto="Montar el rollo nuevo como indica la hoja 20.2.",
                  foto=ruta("r_montado"), pie="Rollo nuevo montado",
                  fuentes=["IMG_0367 0:10 a 0:36", "manual p. 14 pasos 3 y 4"]),
         ]),
    dict(op="20.8", denominacion="EMPALME DEL MATERIAL", aviso=AVISO_EMPALME, epp=EPP_ROLLO,
         pasos=[
             dict(texto="Llevar la punta del material nuevo hasta la mesa superior, junto a la barra amarilla.",
                  foto=ruta("r_punta"), pie="Punta del material nuevo",
                  fuentes=["IMG_0367 0:38 a 1:34", "manual p. 14 paso 5"]),
             dict(texto="Apretar la punta contra la mesa con la mano y alinear las dos puntas.",
                  foto=ruta("r_apretar"), pie="Mano sobre el material",
                  fuentes=["IMG_0367 cuadros 0049 a 0090", "manual p. 14 paso 6"]),
             dict(texto="Cortar la punta recta, a lo largo de la barra amarilla. ⚠ Mantener la otra mano "
                        "lejos de la cuchilla.",
                  fuentes=["IMG_0367 cuadro 0098 y audio 02:56", "IMG_0367 04:06 a 04:15"]),
             dict(texto="Pegar la cinta adhesiva ancha a todo lo ancho del material, recta, y presionarla con la mano.",
                  foto=ruta("r_empalme_pegando"), pie="Cinta adhesiva del empalme",
                  fuentes=["IMG_0379 0:32 a 4:20", "manual p. 14 paso 7"]),
             dict(texto="Pegar una tira corta de cinta adhesiva en cada borde del empalme.",
                  foto=ruta("r_empalme"), pie="Empalme terminado",
                  fuentes=["IMG_0379 cuadros 0133 a 0141"]),
             dict(texto="Soltar la punta del material.",
                  fuentes=["manual p. 14 paso 8"]),
         ]),
]

# Lo que ninguna fuente contesta. No se imprime en las hojas: sale en la lista de pendientes.
FALTA = [
    ("ROLLO", "Confirmar en la máquina que el rollo se centra ANTES de inflar el eje, y contra qué se centra."),
    ("ROLLO", "Si el rollo se mueve entre dos personas (así se ve en el video) y cuánto pesa."),
    ("ROLLO", "Verificar el código del rollo antes de montarlo: ninguna fuente dice cómo ni contra qué."),
    ("ROLLO", "Los videos IMG_0358 e IMG_0355 muestran un tubo VACÍO: confirmar si son del enrollador."),
    ("TENSIÓN", "Consigna de tensión vigente: la pantalla decía 20 kg el 25/08 y 25 kg el 28/08."),
    ("TENSIÓN", "Valor de aviso del contador de metros: se vieron 105,00, 111,10 y 119,00."),
    ("TENSIÓN", "En qué momento se pasa la tensión de manual a automático: ninguna fuente lo muestra."),
    ("CAMBIO DE ROLLO", "Foto de la llave girada a ON, de la alarma y de los tres rodillos bajando; "
                        "cuánto tiempo da la máquina (el minuto sale solo del audio)."),
    ("CAMBIO DE ROLLO", "Cómo se saca el aire del eje y cuándo se vuelve la llave a OFF."),
    ("EMPALME", "Foto del corte de la punta: la única toma está tapada."),
    ("LIMPIEZA", "Cuánto se deja girar con la parafina: el manual dice 10 minutos y el técnico dijo 5."),
    ("LIMPIEZA", "Marca de la parafina y dónde se guarda (que es parafina lo confirmó Fak el 30/09)."),
    ("LIMPIEZA", "Si la bandeja se retira antes o después de tocar el botón 4."),
    ("LIMPIEZA", "Para qué se usan las espátulas amarillas guardadas al lado del motor."),
    ("LIMPIEZA", "Foto de la pantalla de limpieza en inglés con la limpieza en marcha (punto rojo de cada botón)."),
    ("ENCENDIDO", "Si el botón Reset va antes o después de juntar los rodillos: el técnico y el manual dicen "
                  "girar, Reset y juntar; en el video del 28/08 se ve juntar un segundo antes del Reset."),
    ("ENCENDIDO", "Si la ventana de alarmas (alarma 53) aparece en cada arranque y cómo se despeja."),
    ("ENCENDIDO", "Si se toca el botón de apertura de adhesivo («Glue valve activated») y el de enfriamiento: "
                  "el manual los pone como pasos 4 y 5, y en ningún video se tocan."),
    ("ENCENDIDO", "En qué momento se aprieta el botón verde Start, y si el fusor se enciende antes que la máquina."),
    ("ENCENDIDO", "Fotos propias de la llave de aire, el manómetro y la llave general con la marca ON "
                  "(hoy son las del manual)."),
    ("FUSOR", "Fotos de la pantalla del fusor en inglés y con todo a 160 °C; cuánto tarda en llegar."),
    ("ALARMAS", "Qué hacer con las alarmas 3 y 53, que el manual no nombra; cómo se suelta la parada de emergencia."),
    ("APAGADO", "No hay ninguna fuente con el orden de apagado: hay que filmarlo con quien lo hace."),
    ("DESTRABE", "No hay foto ni video de cómo se saca el material enrollado en los rodillos."),
]
