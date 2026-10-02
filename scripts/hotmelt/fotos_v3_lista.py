# -*- coding: utf-8 -*-
"""fotos_v3_lista.py — de donde sale cada foto de las hojas HOTMELT (formato una foto por paso).

nombre -> fuente (cuadro de la biblioteca o pagina del manual), recorte en % del cuadro ya
derecho (x0, y0, x1, y1), giro en grados horarios, marcas en % del RECORTE (x, y, ancho, alto,
que es) y una nota de que muestra. Lo arma `fotos_v3.py`.

Los cuadros de 0387 estan guardados acostados: rot=-90 los endereza.
Cada foto fue mirada a tamano completo antes de entrar aca (01/10/2026).
"""
from fotos_v3 import cuadro

PANT_LIMPIEZA = dict(fuente=cuadro("0836", 5), crop=(11, 16, 89, 92))   # "Glue Removal Operation", en ingles

FOTOS = {
    # ---------------- PORTADA ----------------
    "p_maquina": dict(fuente=cuadro("0347", 23), crop=(0, 0, 100, 68),
                      nota="La laminadora de frente, vista desde el desbobinador (recorrida del 25/08)"),
    # ---------------- LIMPIEZA DE RODILLOS ----------------
    "l_home_f3": dict(fuente=cuadro("0836", 3), crop=(11, 16, 94, 96),
                      marcas=[(30, 42, 17, 11, "Cleaning glue screen F3")],
                      nota="Pantalla Home con el boton de la pantalla de limpieza"),
    "l_boton1": dict(**PANT_LIMPIEZA, marcas=[(16, 19, 19, 12, "Glue removal starts")],
                     nota="Pantalla de limpieza, boton 1"),
    "l_boton2": dict(**PANT_LIMPIEZA, marcas=[(17, 39, 18, 12, "Add detergent / Gap decreases")],
                     nota="Pantalla de limpieza, boton 2"),
    "l_boton3": dict(**PANT_LIMPIEZA, marcas=[(17, 57, 18, 12, "Stop spinning / Remove glue")],
                     nota="Pantalla de limpieza, boton 3"),
    "l_boton4": dict(**PANT_LIMPIEZA, marcas=[(18, 76, 17, 11, "Glue removal finished")],
                     nota="Pantalla de limpieza, boton 4"),
    "l_giro": dict(**PANT_LIMPIEZA, marcas=[(66, 53, 14, 11, "Rubber roller Jog reverse"),
                                            (66, 68, 14, 11, "Rubber roller Jog forward")],
                   nota="Pantalla de limpieza, botones de giro por pulsos"),
    "l_bandeja": dict(fuente=cuadro("0387", 57), rot=-90, crop=(20, 3, 72, 62),
                      nota="Mano colocando la bandeja debajo del rodillo"),
    "l_reset": dict(fuente=cuadro("9527", 5300), crop=(0, 50, 100, 78),
                    marcas=[(35, 36, 14, 25, "Reset")],
                    nota="Boton amarillo Reset de la botonera"),
    "l_parafina": dict(fuente=cuadro("0387", 77), rot=-90, crop=(14, 22, 100, 95),
                       nota="Bloques blancos de parafina apoyados sobre el rodillo"),
    "l_trapo": dict(fuente=cuadro("0389", 49), crop=(0, 34, 100, 66),
                    nota="Dos manos con guantes pasando el trapo por el rodillo"),
    "l_bandeja_afuera": dict(fuente=cuadro("0390", 10), crop=(22, 38, 95, 64),
                             nota="La bandeja afuera de la maquina, limpiandola con trapo"),
}

HEIC_0365 = (r"C:\Users\FacundoS-PC\BARACK ARGENTINA SRL\Ingeniería y Proyecto - General"
             r"\INGENIERIA BARACK (NUNCA BORRAR)\5- VIDEOS Y FOTOS\1- CLIENTES\NOVAX\TOP ROLL\MAQUINA HOTMELT"
             r"\2026-08-25 - detalle del eje del desbobinador y su plato de apriete (IMG_0365).HEIC")

FOTOS.update({
    # ---------------- ROLLO: MONTAJE, CENTRADO, CAMBIO Y EMPALME ----------------
    "r_film": dict(fuente=cuadro("0366", 24), crop=(25, 45, 95, 95),
                   nota="Rollo nuevo ya sin el film de plastico, una mano en el tubo"),
    "r_eje_tubo": dict(fuente=cuadro("0367", 7), crop=(8, 28, 100, 78),
                       nota="El eje entrando por el tubo del rollo parado en el piso"),
    # El recuadro marca el VOLANTE: un paso que nombra una pieza la muestra marcada (Fak, 02/10/2026:
    # "que es el volante cromado... pone una foto del volante").
    "r_volante": dict(fuente=HEIC_0365, crop=(5, 0, 85, 62),
                      marcas=[(42.5, 54, 42, 26, "Volante cromado")],
                      nota="Extremo del eje apoyado en el brazo del desbobinador y volante cromado de apriete"),
    "r_volante_giro": dict(fuente=cuadro("0366", 4), crop=(0, 10, 100, 100),
                           nota="Manos girando el volante cromado"),
    "r_inflar": dict(fuente=cuadro("0355", 94), crop=(0, 20, 100, 100),
                     nota="Boquilla de la manguera naranja en el orificio del eje"),
    "r_centrar": dict(fuente=cuadro("0359", 3), crop=(0, 10, 100, 100),
                      nota="Manos empujando el rollo sobre el eje, regla impresa a la vista"),
    "r_montado": dict(fuente=cuadro("9415", 5),
                      nota="Rollo montado en el brazo, volante cromado y orificio de aire"),
    # El aparato negro de la regla: "detector", no "sensor de borde". Con el en cuadro (9527_2650 a
    # 2670) el tecnico dice "aca tiene un detector" hablando de la cinta de aviso; ninguna fuente lo
    # llama sensor de borde. La banda azul esta pegada al RODILLO cromado: no es la cinta de aviso.
    "r_sensor_borde": dict(fuente=cuadro("9527", 2590), crop=(15, 12, 100, 52),
                           marcas=[(31, 38, 29, 22, "Detector")],
                           nota="Detector negro sobre la regla, con el borde del material adentro"),
    "r_cinta_aviso": dict(fuente=cuadro("9527", 2590), crop=(15, 12, 100, 52),
                          marcas=[(31, 38, 29, 22, "Detector")],
                          nota="Detector negro sobre la regla, el que el tecnico muestra para la cinta de aviso"),
    "r_guiador": dict(fuente=cuadro("9527", 3370), crop=(0, 10, 75, 55),
                      nota="Pantalla del guiador de borde BF5500S"),
    # el recuadro marca la luz "Auto": es lo que el paso manda mirar
    "r_tension": dict(fuente=cuadro("9527", 2500), crop=(3, 28, 75, 82),
                      marcas=[(21.5, 44.8, 9, 5.2, "Luz Auto")],
                      nota="Controlador de tension BFTC-600 y contador de metros"),
    # los dos aparatos que nombra la hoja 20.4, marcados en el tablero del desbobinador
    # Solo el guiador: el mismo cuadro muestra abajo el controlador de tension en MANUAL, y en la
    # hoja 20.4 eso contradecia a la foto de al lado, que lo muestra en automatico (lectura a ciegas
    # del 02/10). El controlador se ubica por su propia foto (r_tension).
    "r_tablero": dict(fuente=cuadro("9527", 3110), crop=(20, 28, 85, 60),
                      nota="Guiador de borde, el aparato de arriba en el tablero del desbobinador"),
    "r_contador": dict(fuente=cuadro("9527", 3110),
                       nota="Los tres instrumentos del tablero del desbobinador"),
    "r_llave": dict(fuente=cuadro("9527", 2610), crop=(0, 28, 75, 75),
                    nota="Llave de cambio de rollo OFF / ON"),
    "r_tubo_vacio": dict(fuente=cuadro("0364", 3),
                         nota="Tubo de carton vacio en el eje del brazo"),
    "r_sacar_eje": dict(fuente=cuadro("0366", 6),
                        nota="Sacando el eje con el tubo vacio"),
    "r_punta": dict(fuente=cuadro("0367", 22), crop=(0, 25, 100, 95),
                    marcas=[(0.5, 1, 65, 16, "Barra amarilla")],
                    nota="Dos manos llevando la punta del vinilo nuevo a la mesa superior, junto a la barra amarilla"),
    "r_apretar": dict(fuente=cuadro("0367", 62), crop=(0, 20, 88, 75),
                      nota="Mano plana sobre el vinilo contra la barra amarilla"),
    "r_cortar": dict(fuente=cuadro("0367", 98), crop=(0, 15, 100, 70),
                     nota="Corte de la punta a lo largo de la barra"),
    "r_cinta": dict(fuente=cuadro("0367", 127), crop=(0, 20, 100, 80),
                    nota="Tiras de cinta azul sobre el vinilo, paralelas a la barra amarilla"),
    "r_empalme_pegando": dict(fuente=cuadro("0379", 117), crop=(0, 10, 100, 80),
                              nota="Pegando la cinta blanca del empalme"),
    "r_empalme": dict(fuente=cuadro("0379", 139), crop=(0, 25, 100, 85),
                      nota="Empalme terminado: cinta blanca a lo ancho"),
})

PANT_OPERACION = dict(fuente=cuadro("0836", 1), crop=(14, 19, 90, 93))   # "Operation screen", en ingles
PANT_HOME = dict(fuente=cuadro("0836", 3), crop=(11, 16, 94, 96))

FOTOS.update({
    # ---------------- ENCENDIDO ----------------
    "e_rodillos": dict(fuente=cuadro("0383", 121), crop=(40, 25, 100, 70),
                       nota="Frente de la maquina: los dos rodillos detras de la ventana"),
    "e_aire": dict(fuente=("manual", 7), crop=(54, 30, 85, 85.5),
                   nota="Llave de aire (foto del manual del fabricante, p. 7)"),
    "e_manometro": dict(fuente=("manual", 8), crop=(30, 27, 80, 87),
                        nota="Manometro de aire (foto del manual del fabricante, p. 8)"),
    "e_llave": dict(fuente=cuadro("9527", 14), crop=(5, 30, 65, 75),
                    nota="Llave general: perilla roja sobre placa amarilla"),
    "e_start": dict(fuente=("manual", 9), crop=(38, 35, 72, 80),
                    marcas=[(35, 40, 28, 13, "Start")],
                    nota="Pantalla al encender, cuadro Start Center (manual p. 9)"),
    # ---------------- FUSOR ----------------
    "f_interruptor": dict(fuente=cuadro("9527", 339), crop=(0, 45, 45, 70),
                          nota="Interruptor rojo del fusor, rotulo Power Switch"),
    "f_bienvenida": dict(fuente=cuadro("9527", 345), crop=(0, 22, 100, 66),
                         nota="Pantalla de bienvenida del fusor con Enter the system"),
    "f_menu": dict(fuente=cuadro("9527", 366), crop=(0, 30, 100, 66),
                   nota="Menu del fusor, dedo sobre el boton de temperaturas"),
    "f_tabla": dict(fuente=cuadro("9527", 459), crop=(0, 34, 96, 72),
                    marcas=[(66, 37, 19, 39, "Botones de calentamiento")],
                    nota="Tabla de temperaturas del fusor con los cinco botones en verde"),
    "f_tabla_consigna": dict(fuente=cuadro("9527", 459), crop=(0, 34, 96, 72),
                             marcas=[(40, 28, 17, 38, "Consigna")],
                             nota="Tabla de temperaturas del fusor: columna de consigna en 160"),
    "f_consigna": dict(fuente=cuadro("9527", 384), crop=(15, 22, 100, 62),
                       nota="Columnas de limite superior, limite inferior y consigna del fusor"),
    # ---------------- CALENTAMIENTO DE RODILLOS ----------------
    "c_home_f1": dict(**PANT_HOME, marcas=[(30, 24.5, 17, 11, "Operation screen F1")],
                      nota="Pantalla principal con el boton de la pantalla de operacion"),
    "v_home_f5": dict(**PANT_HOME, marcas=[(30, 59.5, 17, 11, "Recipe F5")],
                      nota="Pantalla principal con el boton de receta"),
    "a_home_f7": dict(**PANT_HOME, marcas=[(30.5, 75.5, 17, 11, "Alarm Record Screen F7")],
                      nota="Pantalla principal con el boton del registro de alarmas"),
    "e_idioma": dict(**PANT_HOME, marcas=[(84, 3, 12, 6, "Idioma")],
                     nota="Pantalla principal con el boton de idioma (la pantalla ya esta en ingles)"),
    "c_reset": dict(fuente=cuadro("0836", 13), crop=(21, 5, 84, 100),
                    marcas=[(56, 78, 10, 12, "Reset")],
                    nota="Tablero con el boton amarillo Reset"),
    "c_calentar": dict(**PANT_OPERACION, marcas=[(21.5, 36, 11, 10, "Glue roller Heating"),
                                                 (22.5, 54, 11, 10, "Metering Roll Heat")],
                       nota="Pantalla de operacion, botones de calentamiento"),
    "c_girar": dict(**PANT_OPERACION, marcas=[(8, 36, 10, 10, "Glue roller Rotate"),
                                              (9, 54, 10, 10, "Measuring roller Rotate")],
                    nota="Pantalla de operacion, interruptores de giro"),
    "c_gap": dict(**PANT_OPERACION, marcas=[(4.5, 67.5, 10, 9, "Glue Gap position")],
                  nota="Pantalla de operacion, boton de posicion de encolado"),
    # ---------------- ALARMAS ----------------
    "a_torre": dict(fuente=cuadro("0347", 13), crop=(0, 10, 75, 65),
                    marcas=[(1.5, 14, 28.5, 54, "Torre de luces")],
                    nota="Torre de luces roja, amarilla y verde, al lado de la pantalla del fusor"),
    "a_alarmas": dict(fuente=cuadro("0836", 10), crop=(16, 20, 86, 86),
                      nota="Pantalla Alarm Information con la lista de alarmas"),
    "a_botonera": dict(fuente=cuadro("0836", 13), crop=(21, 5, 84, 100),
                       marcas=[(56, 78, 10, 12, "Reset"), (70, 73, 17, 23, "Parada de emergencia")],
                       nota="Tablero: pantalla y los cuatro pulsadores"),
    # ---------------- RECETA ----------------
    "v_receta": dict(fuente=cuadro("0836", 8), crop=(18, 19, 84, 81),
                     # la marca 2 arranca ANTES de la palabra "Product Model": arrancando en 45 la tachaba
                     marcas=[(4, 13, 30, 9, "Product Part Number"), (38.5, 13, 32.5, 9, "Product Model")],
                     nota="Pantalla de receta (Material Number Formula)"),
})

BOTONERA = dict(fuente=cuadro("0836", 13), crop=(21, 5, 84, 100))   # pantalla + los cuatro pulsadores

FOTOS.update({
    # ---------------- ENHEBRADO ----------------
    "n_home_f2": dict(**PANT_HOME, marcas=[(52, 24.5, 17.5, 11, "Hand-drawn screen F2")],
                      nota="Pantalla principal con el boton de la pantalla manual"),
    "n_modo": dict(fuente=cuadro("0836", 4), crop=(13, 17, 97, 96),
                   marcas=[(5, 88, 14, 10, "Feeding material Mode")],
                   nota="Pantalla manual con el boton del modo de enhebrado"),
    "n_rollo": dict(fuente=cuadro("9415", 2), crop=(0, 8, 100, 92),
                    nota="Rollo montado, el material sale hacia arriba por el primer rodillo"),
    "n_acumulador": dict(fuente=("manual", 17), crop=(4, 29, 18, 70),
                         nota="Acumulador de entrada con las flechas de sube y baja (manual p. 17)"),
    "n_debajo": dict(fuente=cuadro("9415", 32),
                     nota="Material envolviendo el rodillo de abajo antes de subir al encolado"),
    "n_adentro": dict(fuente=cuadro("0360", 8),
                      nota="Mano senalando el rodillo plateado envuelto por el material, entre dos verdes"),
    "n_enfriamiento": dict(fuente=cuadro("0392", 25),
                           nota="Mesa de enfriamiento con el material pasando"),
    "n_salida": dict(fuente=cuadro("0361", 33),
                     nota="Mano llevando el material sobre el rodillo cromado, barra amarilla"),
    "n_tubo": dict(fuente=cuadro("0361", 44), crop=(0, 38, 100, 95),
                   nota="Dos manos pegando la punta al tubo de carton con cinta azul, en el enrollador"),
    "n_derecho": dict(fuente=cuadro("0394", 100), crop=(0, 10, 100, 95),
                      nota="Material recto saliendo, tubo con cinta azul en los dos extremos"),
    # ---------------- ARRANQUE, MARCHA Y PARADA ----------------
    "m_listo": dict(**PANT_OPERACION, marcas=[(46.5, 13, 10, 11, "Heating complete")],
                    nota="Pantalla de operacion, casilla de calentamiento completo"),
    "m_start": dict(**BOTONERA, marcas=[(17.5, 79, 10, 12, "Start")],
                    nota="Tablero con el boton verde Start"),
    # recorte bajo: deja afuera las temperaturas del 26/08 (50,0 y 181,7), que no son las de la
    # pantalla del 10/09 que va en la misma hoja; lo que el paso manda mirar es el estado
    "m_marcha": dict(fuente=cuadro("0392", 4), crop=(28, 45, 62, 60),
                     marcas=[(29.5, 6, 42.5, 43, "Estado: marcha automatica")],
                     nota="Pantalla con el estado de marcha automatica (en chino, 26/08)"),
    # UNA sola marca (sin numerito): con dos, el circulo de la segunda tapaba el "°C" de al lado y
    # su borde tachaba el renglon "Glue coating roller". El recuadro abraza rotulo, valor y unidad.
    "m_temperaturas": dict(**PANT_OPERACION, marcas=[(35.6, 55.9, 27.6, 16.4, "Temperatura de los rodillos")],
                           nota="Pantalla de operacion, temperatura real de los dos rodillos"),
    "m_stop": dict(**BOTONERA, marcas=[(37, 79, 10, 12, "Stop")],
                   nota="Tablero con el boton rojo Stop"),
    "m_detenido": dict(**PANT_OPERACION, marcas=[(35.5, 71, 30, 17, "Stopping")],
                       nota="Pantalla de operacion con el estado Stopping"),
    "m_emergencia": dict(**BOTONERA, marcas=[(70, 73, 17, 23, "Parada de emergencia")],
                         nota="Tablero con el boton de parada de emergencia"),
    # ---------------- CORTE ----------------
    "k_mesa": dict(fuente=cuadro("0354", 35), crop=(20, 25, 75, 55),
                   nota="Cuter en la mano y la pieza apoyada en la mesa de salida"),
    "k_corte": dict(fuente=cuadro("0354", 37), crop=(30, 20, 85, 56),
                    nota="Corte con cuter sobre la mesa de salida"),
})
