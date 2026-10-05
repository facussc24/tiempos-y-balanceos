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
AVISO_PARAMETROS = ("NO CAMBIAR LOS PARÁMETROS DE LA MÁQUINA DE CAPAS, TAMPOCO LA VELOCIDAD. "
                    "Cualquier ajuste lo hace solo mantenimiento.")

HOJAS = [
    # 10: pasos de la HO vieja (pestaña 10, Logistica). El paso 3 de esa pestaña era basura ("ssss") y
    # no se usa; "albaran" pasa a "remito", la palabra de Barack.
    dict(op="10", denominacion="RECEPCIÓN DE MATERIA PRIMA", sector="LOGÍSTICA", cuando="cada arranque",
         epp="recepcion", grilla=(2, 1),
         pasos=[
             dict(texto="Verificar que el embalaje recibido no esté dañado.",
                  sin_foto="falta foto de la recepcion de un embalaje",
                  fuentes=[HO + " 10, paso 1"]),
             dict(texto="Verificar que el remito coincida con la orden de compra y el número de artículo.",
                  sin_foto="falta foto del remito y la orden de compra",
                  fuentes=[HO + " 10, paso 2"]),
             dict(texto="Cargar la materia prima en ARB, imprimir la etiqueta, pegarla en el envase y colocar el "
                        "cono azul: Logística la controló.",
                  fotos=[dict(foto=f("10_cartel_colores"), pie="Código de colores"),
                         dict(foto=f("10_tablero_conos"), pie="Conos de colores")],
                  fuentes=[HO + " 10, paso 4"]),
             dict(texto="Guardar la materia prima en su lugar del depósito, o enviarla a producción si hace falta.",
                  sin_foto="falta foto del deposito de materia prima",
                  fuentes=[HO + " 10, paso 5"]),
             dict(texto="Hacer el remito de devolución y descontar la cantidad en ARB si parte del lote llegó en "
                        "malas condiciones.",
                  sin_foto="no corresponde foto: es un tramite en ARB",
                  fuentes=[HO + " 10, paso 6"]),
         ]),
    dict(op="20", hoja_de=(1, 3), denominacion="PREPARACIÓN Y CARGA DE VINILO", sector="MESA DE CORTE", grilla=(4, 2),
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
         ]),
    dict(op="20", hoja_de=(2, 3), denominacion="PREPARACIÓN Y CARGA DE VINILO", sector="MESA DE CORTE", grilla=(2, 2),
         cuando="cada rollo", aviso=AVISO_PARAMETROS, epp="corte",
         pasos=[
             dict(texto="Mover el vinilo con los botones izquierdo y derecho de la pantalla hasta que quede "
                        "acomodado detrás de los rodillos.",
                  fotos=[dict(foto=f("20_pantalla_flechas"), pie="Botones izquierdo y derecho"),
                         dict(foto=f("20_vinilo_detras_rodillos"), pie="Vinilo tras los rodillos")],
                  fuentes=[HO + " 22, paso 1"]),
             dict(texto="Dejar un sobrante de vinilo y apretar Function y después el ícono de la tijera, "
                        "para que la máquina corte el sobrante y arranque desde cero.",
                  fotos=[dict(foto=f("20_pantalla_function"), pie="Botón Function"),
                         dict(foto=f("20_pantalla_tijera"), pie="Ícono de la tijera")],
                  fuentes=[HO + " 22, pasos 2 y 3"]),
             dict(texto="Retirar el sobrante y tirarlo en el cajón de scrap.",
                  sin_foto="falta foto del cajón de scrap de la mesa de corte",
                  fuentes=[HO + " 22, paso 4"]),
         ]),
    dict(op="20", hoja_de=(3, 3), denominacion="PREPARACIÓN Y CARGA DE VINILO", sector="MESA DE CORTE",
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
             dict(texto="Verificar en la pantalla que la velocidad y la tensión sean las del instructivo de "
                        "parámetros del producto. Si no coinciden, no cambiarlas: avisar a mantenimiento.",
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
         cuando="durante la marcha", epp="cuchilla",
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
             dict(texto="Medir el ancho de la cuchilla con el calibre MC167, desde la punta de la cuchilla hasta "
                        "10 cm hacia su medio, antes de cada corte. Tiene que dar 4 mm como mínimo.",
                  foto=f("21_medir_cuchilla"), pie="Calibre MC167 en la cuchilla",
                  fuentes=[HO + " 25, paso 1", "mail de Fak a N. Perez 05/10/2026 10:02: cuchilla 4 mm minimo, calibre MC167"]),
             dict(texto="Abrir el control de corte en Cutting Control y cargar en el programa el mismo ancho de "
                        "cuchilla que se midió.",
                  foto=f("21_cutting_control"), pie="Control de corte",
                  fuentes=[HO + " 25, pasos 2 y 3"]),
             dict(texto="Retirar con cuidado los pedazos si la cuchilla se quiebra, tirarlos en el cajón amarillo "
                        "y pedir el cambio a mantenimiento por el sistema ARB.",
                  foto=f("21_cajon_cuchillas"), pie="Cajón amarillo",
                  fuentes=[HO + " 25, paso 4"]),
         ]),
    dict(op="21", hoja_de=(2, 2), denominacion="CORTE AUTOMÁTICO DE COMPONENTES", sector="MESA DE CORTE",
         grilla=(3, 3), cuando="durante la marcha", epp="corte",
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
                  misma_foto_que=2,
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
    # 30 y 41: pasos de la HO vieja (pestañas 30 y 41) con los valores del mail del 05/10/2026 y los
    # codigos de hilo del arb (FX284-E0PTO sin "TK": el arb es la fuente). Fotos de los videos de
    # 5- VIDEOS Y FOTOS\1- CLIENTES\NOVAX\APB\REFILADO Y COSTURA (12/12/2025), con su procedencia adentro.
    dict(op="30", denominacion="REFILADO", sector="COSTURA", cuando="durante la marcha", epp="cuchilla",
         pasos=[
             dict(texto="Colocar en la refiladora el extremo del lado donde va la costura: ese lado se refila "
                        "primero y el extremo opuesto no se refila.",
                  foto=f("30_extremo_refiladora"), pie="Extremo en la refiladora",
                  fuentes=[HO + " 30, paso 1", "Refilado 8 piezas.mp4 s10"]),
             dict(texto="Pisar el pedal para que la máquina refile ese extremo.",
                  foto=f("30_refilando"), pie="Refilado del extremo",
                  fuentes=[HO + " 30, paso 2", "Refilado 8 piezas.mp4 s18"]),
             dict(texto="Girar la pieza y refilar de la misma forma las dos puntas.",
                  foto=f("30_girar_pieza"), pie="Pieza girada",
                  fuentes=[HO + " 30, paso 3", "Refilado 8 piezas.mp4 s22"]),
         ]),
    # 40: pestaña 40 de la HO vieja + valores del mail del 05/10/2026. Fotos del video "Costura union 4
    # piezas.mp4"; Fak confirmo el 05/10/2026 que es el APB de puerta Patagonia.
    dict(op="40", denominacion="COSTURA UNIÓN", sector="COSTURA", cuando="durante la marcha", epp="corte",
         pasos=[
             dict(texto="Colocar los componentes sobre la mesa según la versión a producir. Verificar el código "
                        "de pieza y tener a la vista la muestra patrón liberada por Calidad.",
                  foto=f("40_componentes_mesa"), pie="Componentes sobre la mesa",
                  fuentes=[HO + " 40, paso 1", "Costura union 4 piezas.mp4 s2"]),
             dict(texto="Cargar el hilo: aguja N° 18 y, en aguja y bobina, hilo 30/3 FX284-E0PTO.",
                  sin_foto="falta foto de los conos de hilo y de la aguja cargada",
                  fuentes=[HO + " 40, paso 2", "mail de Fak a N. Perez 05/10/2026: aguja N 18 en la union, hilo 30/3",
                           "arb RELACIONES 05/10/2026: FX284-E0PTO"]),
             dict(texto="Coser la costura unión: 4 puntadas en 16 mm (±1), con margen de 8 mm (±1) y atraque de "
                        "3 a 4 puntadas al inicio y al final, una vez atrás y una adelante.",
                  foto=f("40_costura_union"), pie="Costura unión",
                  fuentes=[HO + " 40, paso 3", "mail de Fak a N. Perez 05/10/2026: 4 en 16 mm +-1, margen 8 mm +-1, atraque",
                           "Costura union 4 piezas.mp4 s10"]),
             dict(texto="Cortar los hilos al terminar cada pieza y separarla. No coser piezas en cadena sin separarlas.",
                  foto=f("40_separar_pieza"), pie="Pieza separada",
                  fuentes=[HO + " 40, paso 4", "Costura union 4 piezas.mp4 s28"]),
             dict(texto="Inspeccionar la costura: continua, sin puntadas flojas ni saltadas, y simétrica con la "
                        "muestra patrón. Ante un desvío, aplicar el plan de reacción.",
                  foto=f("40_piezas_cosidas"), pie="Piezas cosidas",
                  fuentes=[HO + " 40, paso 5", "Costura union 4 piezas.mp4 s46"]),
         ]),
    dict(op="41", denominacion="COSTURA VISTA (1 SOLA LÍNEA)", sector="COSTURA", cuando="durante la marcha",
         epp="corte",
         pasos=[
             dict(texto="Colocar la pieza en la máquina según la versión a producir. Verificar el código de pieza "
                        "y tener a la vista la muestra patrón liberada por Calidad.",
                  foto=f("41_pieza_maquina"), pie="Pieza en la máquina",
                  fuentes=[HO + " 41, paso 1", "Costura vista 8 Piezas.mp4 s2"]),
             dict(texto="Cargar el hilo: aguja N° 22 con hilo 20/3 FX483TK-E0PTO y bobina con hilo 30/3 FX284-E0PTO.",
                  sin_foto="falta foto de los conos de hilo y de la aguja cargada",
                  fuentes=[HO + " 41, paso 2", "mail de Fak a N. Perez 05/10/2026: aguja N 22 en la vista, bobina 30/3",
                           "arb RELACIONES 05/10/2026: FX483TK-E0PTO y FX284-E0PTO"]),
             dict(texto="Coser la costura vista de 1 sola línea sobre el borde superior: 6 puntadas en 25 mm "
                        "(±0,5), a 4 mm (±0,5) del borde, con atraque de 3 a 4 puntadas al inicio y al final, "
                        "una vez atrás y una adelante.",
                  foto=f("41_costura_vista"), pie="Costura vista de una línea",
                  fuentes=[HO + " 41, paso 3", "mail de Fak a N. Perez 05/10/2026: 6 en 25 mm, a 4 mm +-0,5, atraque",
                           "Costura vista 8 Piezas.mp4 s6"]),
             dict(texto="Cortar los hilos al terminar cada pieza y separarla. No coser piezas en cadena sin separarlas.",
                  sin_foto="falta foto del corte de hilos al terminar la pieza",
                  fuentes=[HO + " 41, paso 4"]),
             dict(texto="Inspeccionar la línea vista: alineada y continua, sin puntadas flojas ni saltadas, y "
                        "simétrica con la muestra patrón. Ante un desvío, aplicar el plan de reacción.",
                  foto=f("41_piezas_cosidas"), pie="Piezas cosidas",
                  fuentes=[HO + " 41, paso 5", "Costura vista 8 Piezas.mp4 s66"]),
         ]),
]

# Lo que ninguna fuente contesta todavia (no se imprime): va a la lista de lo que falta filmar o preguntar.
FALTA = [
    "OP 20: foto de la planilla de la mesa de corte y del cajón de scrap.",
    "OP 21: foto de la pantalla de Cutting Control con el archivo del APB (la que hay muestra programas de otras piezas).",
    "OP 20: cual de los dos Start de la pantalla de la maquina de capas se aprieta (abajo hay «<- Start» y «Start ->»).",
    "OP 20: foto del boton de bajada del rollo, de cerca; y del lado vista del vinilo.",
    "OP 21: que archivo de Cutting Control se abre para cada codigo (N 231, N 267, N 297, N 328).",
    "OP 21: como termina el corte: retirar las piezas, apagar la succion y que se hace con el nylon (no esta en la HO vieja).",
    "OP 21: foto de cerca del boton Plato y del laser rojo; la foto del icono de inicio esta borrosa.",
    "OP 20: el Start de la pantalla de la maquina de capas: preguntarle al operario de la mesa de corte cual se aprieta (Fak no lo sabe y la HO vieja no lo dice)."
]

# Las fotos salen de la HO-971 vieja (xl/media del xlsx): nombre -> imagen de origen.
ORIGEN_FOTOS = {
    "10_cartel_colores": "image7.jpeg", "10_tablero_conos": "image8.jpeg",
    "20_rollo_deposito": "image12.jpeg", "20_rollo_maquina": "image13.jpeg", "20_lado_vista": "image14.jpeg",
    "20_panel_capas": "image15.jpeg", "20_rodillos_abrir": "image21.jpeg", "20_vinilo_bajo_rodillos": "image22.jpeg",
    "20_rodillos_cerrar": "image24.jpeg", "20_vinilo_detras_rodillos": "image27.jpeg",
    "20_pantalla_tijera": ("image29.jpeg", (360, 230, 530, 360)), "20_pantalla_flechas": ("image29.jpeg", (360, 90, 530, 260)), "20_pantalla_function": ("image28.jpeg", (740, 300, 915, 534)), "20_medir_largo": "image31.jpeg", "20_pantalla_reset": "image32.jpeg",
    "20_pantalla_capas": "image33.jpeg", "20_acomodar_capa": "image34.jpeg", "20_botonera_mesa": "image30.jpeg",
    "21_botonera_mesa": "image30.jpeg", "21_panel_mesa": "image35.jpeg", "21_lineas_rojas": "image36.jpeg",
    "21_medir_cuchilla": "image40.jpeg", "21_cutting_control": ("image37.jpeg", (150, 40, 750, 330)), "21_cajon_cuchillas": "image41.jpeg",
    "21_nylon": "image44.jpeg", "21_panel_cabezal": ("image45.jpeg", (40, 0, 500, 256)), "21_laser_riel": ("image43.jpeg", (0, 215, 360, 445)),
    "21_laser_cruz": "image47.png", "21_icono_inicio": ("image48.jpeg", (480, 40, 820, 236)), "21_cartel_origen": ("image49.jpeg", (0, 30, 440, 250)),
    "21_start_pantalla": ("image50.jpeg", (420, 100, 1100, 560)),
}
