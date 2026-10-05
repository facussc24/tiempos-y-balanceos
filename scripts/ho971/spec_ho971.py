# -*- coding: utf-8 -*-
"""spec_ho971.py — contenido de la HO-971 (APB de puerta VW427 Patagonia) en el formato A3 de una
foto por paso, con la numeracion del flujograma 153 Rev.E (05/10/2026).

Cada paso lleva `fuentes` (no se imprimen): de donde sale lo que dice. La fuente principal es la
HO-971 vieja en Excel (APB PATAGONIA HO 971.xlsx, pestañas de Ingenieria, F. Santoro, 10/03/2026),
con los valores corregidos por el mail de Fak a Nicolas Perez del 05/10/2026 10:02 (cuchilla 4 mm
minimo con calibre MC167). Las fotos son las de esa misma HO (xl/media), copiadas a FOTOS con un
nombre que dice que muestran.

Lo que ninguna fuente contesta no se escribe como paso: va a FALTA.
"""
import os

FOTOS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "exports", "HO971_UNIFICADA", "fotos")


def f(nombre):
    return os.path.abspath(os.path.join(FOTOS, nombre + ".jpg"))


HO = "fuente: HO-971 vieja, pestaña"

# La aclaracion de la pestaña 22 de la HO vieja (F. Santoro, 10/03/2026), en el cuadro amarillo.
AVISO_PARAMETROS = ("NO CAMBIAR LOS PARÁMETROS DE LA MÁQUINA, TAMPOCO LA VELOCIDAD. "
                    "Cualquier ajuste lo hace solo mantenimiento.")

HOJAS = [
    dict(op="20", hoja_de=(1, 2), denominacion="PREPARACIÓN Y CARGA DE VINILO", sector="MESA DE CORTE", grilla=(5, 2),
         cuando="cada rollo", aviso=AVISO_PARAMETROS, epp="corte",
         pasos=[
             dict(texto="Verificar en la planilla de la mesa de corte el código del vinilo del próximo corte.",
                  sin_foto="falta foto de la planilla de la mesa de corte",
                  fuentes=[HO + " 20, paso 1"]),
             dict(texto="Buscar en el depósito de la mesa de corte el rollo que indica la planilla y llevarlo "
                        "hasta la máquina de capas.",
                  foto=f("20_rollo_deposito"), pie="Rollo en el depósito",
                  fuentes=[HO + " 20, paso 2"]),
             dict(texto="Colocar el rollo en la parte trasera de la máquina de capas, con la máquina arriba, y "
                        "cortar el plástico protector.",
                  foto=f("20_rollo_maquina"), pie="Rollo atrás de la máquina",
                  fuentes=[HO + " 20, paso 3"]),
             dict(texto="Colocar el lado vista como dice la planilla: si dice «lado vista abajo», el lado vista "
                        "va hacia afuera del rollo; si dice «lado vista arriba», hacia adentro.",
                  foto=f("20_lado_vista"), pie="Lado vista del rollo",
                  fuentes=[HO + " 20, paso 3"]),
             dict(texto="Mantener apretado el botón de bajada hasta que el rollo quede en la posición de trabajo.",
                  foto=f("20_panel_capas"), pie="Panel de la máquina",
                  fuentes=[HO + " 20, paso 4"]),
             dict(texto="Girar el rodillo superior izquierdo hacia la izquierda y después el derecho, para "
                        "abrir el paso del vinilo.",
                  foto=f("20_rodillos_abrir"), pie="Rodillos superiores",
                  fuentes=[HO + " 21, paso 1"]),
             dict(texto="Pasar el vinilo a mano hacia la mesa, por debajo de los rodillos.",
                  foto=f("20_vinilo_bajo_rodillos"), pie="Vinilo bajo los rodillos",
                  fuentes=[HO + " 21, paso 2"]),
             dict(texto="Volver a bajar los dos rodillos superiores a su posición.",
                  foto=f("20_rodillos_cerrar"), pie="Rodillos en posición",
                  fuentes=[HO + " 21, paso 3"]),
             dict(texto="Mover el vinilo con los botones izquierdo y derecho del panel hasta que quede "
                        "acomodado detrás de los rodillos.",
                  fotos=[dict(foto=f("20_panel_botones"), pie="Botones del panel"),
                         dict(foto=f("20_vinilo_detras_rodillos"), pie="Vinilo tras los rodillos")],
                  fuentes=[HO + " 22, paso 1"]),
             dict(texto="Dejar un sobrante de vinilo y apretar Function y después el ícono de la tijera, "
                        "para que la máquina corte el sobrante y arranque desde cero.",
                  foto=f("20_pantalla_tijera"), pie="Ícono de la tijera",
                  fuentes=[HO + " 22, pasos 2 y 3"]),
             dict(texto="Retirar el sobrante y tirarlo en el cajón de scrap.",
                  sin_foto="falta foto del cajón de scrap de la mesa de corte",
                  fuentes=[HO + " 22, paso 4"]),
         ]),
    dict(op="20", hoja_de=(2, 2), denominacion="PREPARACIÓN Y CARGA DE VINILO", sector="MESA DE CORTE",
         cuando="durante la marcha", aviso=AVISO_PARAMETROS, epp="corte",
         pasos=[
             dict(texto="Medir con la regla el largo que indica la planilla (largo de la tizada más la demasía).",
                  foto=f("20_medir_largo"), pie="Largo con la regla",
                  fuentes=[HO + " 23, paso 1"]),
             dict(texto="Apretar Reset si «Current layers» marca más de 0, para dejarlo en 0.",
                  foto=f("20_pantalla_reset"), pie="Current layers y Reset",
                  fuentes=[HO + " 23, paso 2"]),
             dict(texto="Cargar la cantidad de capas y el largo de la capa con la demasía, como dice la planilla.",
                  foto=f("20_pantalla_capas"), pie="Pantalla: capas y largo",
                  fuentes=[HO + " 23, paso 3"]),
             dict(texto="Verificar en la pantalla la velocidad y la tensión del producto. Si no coinciden con "
                        "las del producto, no cambiarlas: avisar a mantenimiento.",
                  misma_foto_que=3,
                  fuentes=[HO + " 23, paso 4", HO + " 22, aclaracion de parametros"]),
             dict(texto="Apretar Start en la pantalla para empezar el corte de las capas.",
                  misma_foto_que=3,
                  fuentes=[HO + " 23, paso 5"]),
             dict(texto="Tomar la punta del vinilo cuando la máquina llega a la posición final y acomodar la "
                        "capa alineada. Repetir hasta completar todas las capas.",
                  foto=f("20_acomodar_capa"), pie="Capa acomodada",
                  fuentes=[HO + " 23, paso 6"]),
             dict(texto="Apretar el botón verde de abajo de la mesa para mover el vinilo sobre la mesa. Al "
                        "terminar, apagarlo con el botón rojo.",
                  foto=f("20_botonera_mesa"), pie="Botonera de la mesa",
                  fuentes=[HO + " 23, paso 7"]),
         ]),
    dict(op="21", hoja_de=(1, 2), denominacion="CORTE AUTOMÁTICO DE COMPONENTES", sector="MESA DE CORTE", grilla=(3, 2),
         cuando="durante la marcha", aviso=AVISO_PARAMETROS, epp="corte",
         pasos=[
             dict(texto="Apretar el botón verde de abajo de la mesa para pasar las capas cortadas a la mesa de corte.",
                  foto=f("21_botonera_mesa"), pie="Botonera de la mesa",
                  fuentes=[HO + " 24, paso 1"]),
             dict(texto="Apretar Feed en el panel de la mesa de corte para que avance el vinilo.",
                  foto=f("21_panel_mesa"), pie="Feed y Stop",
                  fuentes=[HO + " 24, paso 2"]),
             dict(texto="Acompañar el vinilo a mano, con las capas rectas y alineadas, hasta las líneas rojas del "
                        "costado de la mesa, y ahí apretar Stop.",
                  foto=f("21_lineas_rojas"), pie="Líneas rojas del costado",
                  fuentes=[HO + " 24, pasos 3 y 4"]),
             dict(texto="Medir el ancho de la cuchilla con el calibre MC167, desde la punta hasta 10 cm hacia el "
                        "centro, antes de cada corte. Tiene que dar 4 mm como mínimo.",
                  foto=f("21_medir_cuchilla"), pie="Calibre MC167 en la cuchilla",
                  fuentes=[HO + " 25, paso 1", "mail de Fak a N. Perez 05/10/2026 10:02: cuchilla 4 mm minimo, calibre MC167"]),
             dict(texto="Abrir el control de corte en Cutting Control y cargar en el programa el mismo ancho de "
                        "cuchilla que se midió.",
                  foto=f("21_cutting_control"), pie="Control de corte",
                  fuentes=[HO + " 25, pasos 2 y 3"]),
             dict(texto="Retirar con cuidado los pedazos si la cuchilla se quiebra, tirarlos en el cajón amarillo "
                        "y pedir el cambio a mantenimiento por ARB.",
                  foto=f("21_cajon_cuchillas"), pie="Cajón amarillo",
                  fuentes=[HO + " 25, paso 4"]),
         ]),
    dict(op="21", hoja_de=(2, 2), denominacion="CORTE AUTOMÁTICO DE COMPONENTES", sector="MESA DE CORTE",
         grilla=(3, 3), cuando="durante la marcha", aviso=AVISO_PARAMETROS, epp="corte",
         pasos=[
             dict(texto="Extender el nylon sobre las capas hasta tapar toda la zona de succión.",
                  foto=f("21_nylon"), pie="Mesa cubierta con el nylon",
                  fuentes=[HO + " 26, paso 1"]),
             dict(texto="Apretar Start y después Cutting en el panel del cabezal para activar la succión.",
                  foto=f("21_panel_cabezal"), pie="Panel del cabezal",
                  fuentes=[HO + " 26, paso 2"]),
             dict(texto="Abrir en la computadora, en Cutting Control, el archivo de corte de la pieza.",
                  sin_foto="falta una foto de la pantalla de Cutting Control sin programas de otras piezas",
                  fuentes=[HO + " 26, paso 3"]),
             dict(texto="Llevar el cabezal con los botones de al lado de Shift hasta el extremo del vinilo, con "
                        "2,5 cm de margen como máximo por lado. Después llevarlo al otro extremo y verificar la "
                        "alineación con el láser rojo.",
                  fotos=[dict(foto=f("21_laser_riel"), pie="Láser rojo en el riel"),
                         dict(foto=f("21_laser_cruz"), pie="Cruz del láser")],
                  fuentes=[HO + " 26, paso 4"]),
             dict(texto="Hacer clic en el ícono de inicio de corte de Cutting Control.",
                  foto=f("21_icono_inicio"), pie="Ícono de inicio de corte",
                  fuentes=[HO + " 27, paso 1"]),
             dict(texto="Apretar Start debajo de la pantalla cuando aparece el cartel «Determine the cutting origin "
                        "and press Start button».",
                  fotos=[dict(foto=f("21_cartel_origen"), pie="Cartel de origen"),
                         dict(foto=f("21_start_pantalla"), pie="Start bajo la pantalla")],
                  fuentes=[HO + " 27, paso 1"]),
             dict(texto="Esperar que la máquina controle las medidas del vinilo con sus sensores y apretar Start "
                        "en el panel del cabezal.",
                  misma_foto_que=2,
                  fuentes=[HO + " 27, paso 2"]),
             dict(texto="Apretar el botón inferior de movimiento (Plato) cuando baja el cabezal, para subirlo.",
                  misma_foto_que=2,
                  fuentes=[HO + " 27, paso 3"]),
             dict(texto="Apretar Start en el panel, con el plato arriba, y Enter en la computadora para empezar el corte.",
                  misma_foto_que=2,
                  fuentes=[HO + " 27, paso 4"]),
         ]),
]

# Lo que ninguna fuente contesta todavia (no se imprime): va a la lista de lo que falta filmar o preguntar.
FALTA = [
    "OP 20: foto de la planilla de la mesa de corte y del cajón de scrap.",
    "OP 21: foto de la pantalla de Cutting Control con el archivo del APB (la que hay muestra programas de otras piezas).",
]

# Las fotos salen de la HO-971 vieja (xl/media del xlsx): nombre -> imagen de origen.
ORIGEN_FOTOS = {
    "20_rollo_deposito": "image12.jpeg", "20_rollo_maquina": "image13.jpeg", "20_lado_vista": "image14.jpeg",
    "20_panel_capas": "image15.jpeg", "20_rodillos_abrir": "image21.jpeg", "20_vinilo_bajo_rodillos": "image22.jpeg",
    "20_rodillos_cerrar": "image24.jpeg", "20_panel_botones": "image26.jpeg", "20_vinilo_detras_rodillos": "image27.jpeg",
    "20_pantalla_tijera": ("image29.jpeg", (360, 60, 530, 360)), "20_medir_largo": "image31.jpeg", "20_pantalla_reset": "image32.jpeg",
    "20_pantalla_capas": "image33.jpeg", "20_acomodar_capa": "image34.jpeg", "20_botonera_mesa": "image30.jpeg",
    "21_botonera_mesa": "image30.jpeg", "21_panel_mesa": "image35.jpeg", "21_lineas_rojas": "image36.jpeg",
    "21_medir_cuchilla": "image40.jpeg", "21_cutting_control": ("image37.jpeg", (150, 40, 750, 330)), "21_cajon_cuchillas": "image41.jpeg",
    "21_nylon": "image44.jpeg", "21_panel_cabezal": ("image45.jpeg", (40, 0, 500, 256)), "21_laser_riel": ("image43.jpeg", (0, 215, 360, 445)),
    "21_laser_cruz": "image47.png", "21_icono_inicio": ("image48.jpeg", (480, 40, 820, 236)), "21_cartel_origen": ("image49.jpeg", (0, 30, 440, 250)),
    "21_start_pantalla": ("image50.jpeg", (420, 100, 1100, 560)),
}
