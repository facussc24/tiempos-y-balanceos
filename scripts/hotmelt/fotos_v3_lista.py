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
    # ---------------- LIMPIEZA DE RODILLOS ----------------
    "l_home_f3": dict(fuente=cuadro("0836", 3), crop=(11, 16, 94, 96),
                      marcas=[(2, 6, 7, 7, "Casita"), (30, 42, 17, 11, "Cleaning glue screen F3")],
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
    "r_volante": dict(fuente=HEIC_0365, crop=(5, 0, 85, 62),
                      nota="Extremo del eje apoyado en el brazo y volante cromado de apriete"),
    "r_volante_giro": dict(fuente=cuadro("0366", 4), crop=(0, 10, 100, 100),
                           nota="Manos girando el volante cromado"),
    "r_inflar": dict(fuente=cuadro("0355", 94), crop=(0, 20, 100, 100),
                     nota="Boquilla de la manguera naranja en el orificio del eje"),
    "r_centrar": dict(fuente=cuadro("0359", 3), crop=(0, 10, 100, 100),
                      nota="Manos empujando el rollo sobre el eje, regla impresa a la vista"),
    "r_montado": dict(fuente=cuadro("9415", 5),
                      nota="Rollo montado en el brazo, volante cromado y orificio de aire"),
    "r_sensor_borde": dict(fuente=cuadro("9527", 2590), crop=(15, 12, 100, 52),
                           nota="Sensor de borde sobre la barra verde y borde del vinilo"),
    "r_guiador": dict(fuente=cuadro("9527", 3370), crop=(0, 10, 75, 55),
                      nota="Pantalla del guiador de borde BF5500S"),
    "r_tension": dict(fuente=cuadro("9527", 2500), crop=(3, 28, 75, 82),
                      nota="Controlador de tension BFTC-600 y contador de metros"),
    "r_contador": dict(fuente=cuadro("9527", 3110),
                       nota="Los tres instrumentos del tablero del desbobinador"),
    "r_llave": dict(fuente=cuadro("9527", 2610), crop=(0, 28, 75, 75),
                    nota="Llave de cambio de rollo OFF / ON"),
    "r_tubo_vacio": dict(fuente=cuadro("0364", 3),
                         nota="Tubo de carton vacio en el eje del brazo"),
    "r_sacar_eje": dict(fuente=cuadro("0366", 6),
                        nota="Sacando el eje con el tubo vacio"),
    "r_punta": dict(fuente=cuadro("0367", 22), crop=(0, 25, 100, 95),
                    nota="Dos manos llevando la punta del vinilo nuevo a la mesa"),
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
    "e_aire": dict(fuente=("manual", 7), crop=(54, 30, 85, 90),
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
    "e_idioma": dict(**PANT_HOME, marcas=[(2, 6, 7, 7, "Casita"), (84, 3, 12, 6, "Idioma")],
                     nota="Pantalla principal: casita y boton de idioma"),
    "c_calentar": dict(**PANT_OPERACION, marcas=[(21.5, 36, 11, 10, "Glue roller Heating"),
                                                 (22.5, 54, 11, 10, "Metering Roll Heat")],
                       nota="Pantalla de operacion, botones de calentamiento"),
    "c_girar": dict(**PANT_OPERACION, marcas=[(8, 36, 10, 10, "Glue roller Rotate"),
                                              (9, 54, 10, 10, "Measuring roller Rotate")],
                    nota="Pantalla de operacion, interruptores de giro"),
    "c_gap": dict(**PANT_OPERACION, marcas=[(4.5, 67.5, 10, 9, "Glue Gap position")],
                  nota="Pantalla de operacion, boton de posicion de encolado"),
    # ---------------- ALARMAS ----------------
    "a_alarmas": dict(fuente=cuadro("0836", 10), crop=(16, 20, 86, 86),
                      nota="Pantalla Alarm Information con la lista de alarmas"),
    "a_botonera": dict(fuente=cuadro("0836", 13), crop=(21, 5, 84, 100),
                       marcas=[(56, 78, 10, 12, "Reset"), (70, 73, 17, 23, "Parada de emergencia")],
                       nota="Tablero: pantalla y los cuatro pulsadores"),
    # ---------------- RECETA ----------------
    "v_receta": dict(fuente=cuadro("0836", 8), crop=(18, 19, 84, 81),
                     marcas=[(4, 13, 30, 9, "Product Part Number"), (45, 13, 26, 9, "Product Model")],
                     nota="Pantalla de receta (Material Number Formula)"),
})
