# -*- coding: utf-8 -*-
"""gates_selftest.py — los seis gates del generador, cada uno en ROJO y en VERDE.

    py -3 scripts/img/gates_selftest.py     # sale 1 si alguno no hace lo que dice

Un gate que no puede dar rojo esta tan roto como el que no puede dar verde: lo unico que
prueba que sirve es verlo rechazar el caso que lo motivo.
"""
import os
import sys

sys.path.insert(0, os.path.abspath('scripts/img'))
import generar_hojas_img as G  # noqa: E402

F = lambda n: os.path.join('scripts', 'img', 'assets2', n)  # noqa: E731

CASOS = [
    # (gate, nombre del caso, dict, se_espera_rojo)
    (G._gate_una_foto_por_paso, "3 fotos y 4 pasos",
     dict(op='X', imagenes=[F('m1_entra.jpg')] * 3, pasos=['a', 'b', 'c', 'd']), True),
    (G._gate_una_foto_por_paso, "5 pasos en una hoja de secuencia",
     dict(op='X', imagenes=[F('m1_entra.jpg')] * 4, pasos=list('abcde')), True),
    (G._gate_una_foto_por_paso, "4 fotos y 4 pasos",
     dict(op='X', imagenes=[F('m1_entra.jpg')] * 4, pasos=list('abcd')), False),

    # la coma que falta: en una lista de Python, dos strings sin coma se pegan en silencio.
    # Me paso el 21/09 con los pies de la hoja de control y habria salido impreso.
    (G._gate_una_foto_por_paso, "2 pies para 3 fotos (falto una coma)",
     dict(op='X', modo='secuencia', imagenes=[F('m1_entra.jpg')] * 3, pasos=list('abc'),
          pies=["Pasar la mano", "Mirar la punta y el bordeAbrir la punta"]), True),
    (G._gate_una_foto_por_paso, "3 pies para 3 fotos",
     dict(op='X', modo='secuencia', imagenes=[F('m1_entra.jpg')] * 3, pasos=list('abc'),
          pies=["Pasar la mano", "Mirar la punta", "Abrir la punta"]), False),

    (G._gate_texto_para_el_operario, "la nota cita el numero de video",
     dict(op='X', nota='Las cuatro fotos son del IMG_0844.'), True),
    (G._gate_texto_para_el_operario, "un pendiente con el proveedor",
     dict(op='X', nota='Pendiente de confirmar con KINGPOWER.'), True),
    (G._gate_texto_para_el_operario, "la nota confiesa un hueco mio",
     dict(op='X', nota='Que hace exactamente el boton negro no esta documentado: preguntar '
                       'antes de usarlo de otra forma.'), True),
    (G._gate_texto_para_el_operario, "un TBD pelado, que si va",
     dict(op='X', parametros=[('Temperatura de molde', 'TBD')]), False),

    (G._gate_texto_para_el_operario, "una nota operativa",
     dict(op='X', nota='Nadie mete la mano hasta que la maquina abrio sola.'), False),

    (G._gate_no_afirmar_de_mas, "afirma que algo esta apagado",
     dict(op='X', pasos=['Las de afuera del contorno quedan apagadas o al minimo.']), True),
    (G._gate_no_afirmar_de_mas, "un numero con unidad sin declarar",
     dict(op='X', pasos=['Esperar a que llegue a 390 °C.']), True),
    (G._gate_no_afirmar_de_mas, "el mismo numero, declarado",
     dict(op='X', parametros=[('Tiempo de vacio', '19 s')], pasos=['Esperar los 19 s.']), False),

    (G._gate_cada_paso_con_fuente, "2 pasos y 1 fuente",
     dict(op='X', pasos=['a', 'b'], fuentes=['IMG_0801 s=1,1: se ve en la foto']), True),
    (G._gate_cada_paso_con_fuente, "una fuente que no es una fuente",
     dict(op='X', pasos=['a'], fuentes=['ok']), True),
    (G._gate_cada_paso_con_fuente, "una fuente por paso",
     dict(op='X', pasos=['a'], fuentes=['IMG_0801 (09-09-2026) s=1,1: la serigrafia']), False),

    # las dos correcciones de Fak del 23/09, con el texto exacto que el vio impreso
    (G._gate_corregido_por_fak, "las piezas en el caballete",
     dict(op='X', pies=['Las piezas en el caballete']), True),
    (G._gate_corregido_por_fak, "los tres puntitos en el disparador",
     dict(op='X', disparador='SI LA PIEZA SALE CON LOS TRES PUNTITOS'), True),
    (G._gate_corregido_por_fak, "las piezas sobre la mesa",
     dict(op='X', pasos=['Apoyar las piezas sobre la mesa sin que se toquen.']), False),

    (G._gate_transcripcion_leida, "manda algo desde un video sin transcripcion",
     dict(op='X', pasos=['Apretar el verde.'], fuentes=['IMG_9999 s=1: se ve']), True),
    (G._gate_transcripcion_leida, "DESCRIBE lo del mismo video sin transcripcion",
     dict(op='X', pasos=['El pulsador verde esta al lado del rojo.'],
          fuentes=['IMG_9999 s=1: se ve']), False),
    (G._gate_transcripcion_leida, "manda algo desde un video que SI tiene transcripcion",
     dict(op='X', pasos=['Apretar el verde.'], fuentes=['IMG_0801 s=1,1: la serigrafia']), False),

    (G._gate_secuencia_en_orden, "el paso 1 pasa despues del paso 2",
     dict(op='X', modo='secuencia',
          imagenes=[F('m3_abre.jpg'), F('m1_entra.jpg')]), True),
    (G._gate_secuencia_en_orden, "en el orden del reloj",
     dict(op='X', modo='secuencia',
          imagenes=[F('m1_entra.jpg'), F('m3_abre.jpg')]), False),
]


def _con_plancha(al_dia):
    """Arma un caso del gate de la plancha: `al_dia` decide si la plancha es mas nueva.

    El gate no juzga la foto —ninguna medida separa una foto buena de una movida, lo
    probe contra las 55 de la carpeta— sino que OBLIGA a mirarlas: exige que la plancha
    exista y sea posterior a la ultima foto que se toco.
    """
    def correr(_d):
        foto, plancha = F('m1_entra.jpg'), G.PLANCHA_DECK
        antes = os.path.exists(plancha) and os.path.getmtime(plancha)
        try:
            t = os.path.getmtime(foto)
            os.utime(plancha, (t + 10, t + 10) if al_dia else (t - 10, t - 10))
            G.gate_fotos_miradas([dict(op='X', imagenes=[foto])])
        finally:
            if antes:
                os.utime(plancha, (antes, antes))
    return correr


CASOS += [
    (_con_plancha(False), "una foto cambio despues de la plancha: nadie la miro", {}, True),
    (_con_plancha(True), "la plancha es posterior a la foto", {}, False),
]

print("LOS GATES, cada uno con un caso que debe RECHAZAR y otro que debe PASAR\n")
malos = 0
for fn, nombre, d, espera_rojo in CASOS:
    try:
        fn(d)
        real = 'VERDE'
    except SystemExit:
        real = 'ROJO'
    ok = (real == 'ROJO') == espera_rojo
    malos += not ok
    print(f"  {'ok  ' if ok else 'FALLA'}  {fn.__name__:34s} {real:5s}  {nombre}")

print(f"\n{len(CASOS)} casos, {malos} fallan.")
sys.exit(1 if malos else 0)
