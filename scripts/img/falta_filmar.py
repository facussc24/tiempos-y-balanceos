# -*- coding: utf-8 -*-
"""La lista de lo que falta filmar o preguntar para cerrar las hojas de la MOLDEADORA IMG.

Por que existe: de los 91 videos de la maquina, casi todos son la PANTALLA del HMI o una
toma general del portico. Lo que no esta filmado ni dicho no se escribe por analogia
(core-prohibiciones §1): se pide. Esta es la lista, ordenada como se recorre la maquina.

22/09/2026 — dos versiones sumadas en una. Otra sesion la habia bajado a 5 tomas con el
titulo "19 de las 24 dudas quedaron resueltas", pero su propio MAPEO_OPERACIONES_IMG.md
marca como abiertas las del apagado (1 a 5), el rollo (6, 8, 10, 11) y el corte (13), y
en las 49 transcripciones no aparece nada sobre montar el rollo. Volvieron esas, se
quedaron las tomas nuevas de esa sesion, y entraron dos pistas verificadas en pantalla:
"Corte Carga Inicial" y "Sel. Bastidor 1..4".

Sale un PDF A4 apaisado, UNA PAGINA POR BLOQUE: en una sola hoja los 24 renglones se
achicaban al 70 % y no se leian en el celular.

    py -3 scripts/img/falta_filmar.py
"""
import os

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.util import Cm, Pt

AZUL = RGBColor(0x44, 0x54, 0x6A)
AZUL2 = RGBColor(0x1F, 0x49, 0x7D)
BLANCO = RGBColor(0xFF, 0xFF, 0xFF)
NEGRO = RGBColor(0x00, 0x00, 0x00)
GRIS = RGBColor(0xF2, 0xF2, 0xF2)
ROJO = RGBColor(0xC0, 0x30, 0x30)

W, H = 29.7, 21.0
M = 1.1

BASE = os.path.dirname(os.path.abspath(__file__))
SALIDA_PPTX = os.path.join(BASE, "QUE FALTA FILMAR - MOLDEADORA IMG.pptx")
ESCRITORIO = (r"C:\Users\FacundoS-PC\OneDrive - BARACK ARGENTINA SRL\Desktop"
              r"\Hojas de proceso maquina IMG - desde los videos")

ENCABEZADO = ("Barridos los 91 videos, sus transcripciones y las pantallas del HMI, al "
              "24/09/2026. Lo que esta en esta lista no aparece en ninguno: ni filmado ni "
              "dicho. Con esto se cierran las hojas de proceso.")

# (bloque, [(que filmar o preguntar, por que / donde)])
TOMAS = [
    ("1 · APAGADO — no hay una sola toma de la secuencia", [
        ("La secuencia completa de fin de jornada, de principio a fin",
         "Que se para primero, que se apaga despues y en que orden. Ningun video la muestra."),
        ("El pulsador rojo POWER STOP (电源停止) siendo apretado",
         "El pulsador esta filmado y rotulado (IMG_0597), pero nadie lo aprieta nunca."),
        ("La llave general del tablero pasando a OFF (0)",
         "Esta filmada pasando a ON (IMG_0596); falta el gesto de pasarla a OFF."),
        ("Que queda encendido despues de apagar y que no",
         "El chiller y el atemperador se manejan desde la pantalla (IMG_0596); no se sabe si "
         "quedan en marcha al bajar la llave."),
        ("La pantalla del HMI en parada o fin de jornada",
         "Para cerrar la hoja de apagado con lo que ve el operario."),
    ]),
    ("2 · EL ROLLO DE VINILO — hay imagen, pero nadie lo explica", [
        ("Como sube el rollo a la cuna: a mano entre dos, con autoelevador o con un carro",
         "El IMG_0393 EMPIEZA con el rollo ya montado, y ningun otro video ni audio lo muestra."),
        ("Como se traba el eje en la cuna",
         "El tope del eje se corre contra el rollo y se ajusta con su perilla (IMG_0579 min "
         "0:12 a 0:25, ya esta en la 33). Falta como queda trabado el eje en la cuna."),
        ("Como se centra el rollo a lo ancho y contra que referencia",
         "Ninguna toma lo muestra y nadie lo dice."),
        ("Para que lado va la cara buena, y si la punta sale por arriba o por abajo",
         "En IMG_0393 sale por arriba, pero nadie dice que sea la regla; de que lado queda la "
         "cara buena no se distingue en los cuadros."),
        ("Si hay FIFO, control de lote o identificacion del rollo al montarlo",
         "Cero menciones en las 49 transcripciones."),
        ("Que se hace con la punta vieja cuando se termina un rollo: empalme o descarte",
         "No esta filmado ni dicho."),
    ]),
    ("3 · LA CARGA DEL VINILO Y EL CORTE — hay imagen, pero nadie lo explica", [
        ("Si en automatico el desenrollador da material solo",
         "Fak recuerda que UNCOILER y Leather Convey se usaban «a veces nomas» (23/09). En "
         "el audio chino del IMG_0393 min 2:02 el tecnico dice 打自动送了, «en automatico "
         "alimenta», con mucho ruido. Confirmarlo mirando el material colgando en serie."),
        ("Cuanto material tiene que quedar colgando entre el desenrollador y la mesa",
         "Se deja siempre colgando (Fak, 23/09; IMG_0579 s=103). Cuanto, no lo dice nadie; "
         "IMG_0579 min 1:57: «tiene que ver que se haga una cabecita, no tiene que estar "
         "superado mucho», sin que se vea a que se refiere."),
        ("Que hace el boton negro de la cajita de UNCOILER y Leather Convey",
         "No tiene chapa. Pista en el audio chino del IMG_0582 min 7:51 a 8:01: «那个黑色的… "
         "小盒子… 压料… 你推进去的时候，它被压», «el negro de la cajita… prensar material… "
         "cuando lo apretas, prensa». Indicio, no dato: no entro en ninguna hoja."),
        ("Que pasa si el material no pasa por el sensor de la mesa de carga",
         "El sensor detecta si el material esta bien pasado (Fak, 23/09). No hay toma de la "
         "maquina sin material debajo del sensor: si da alarma, si no carga o si no pasa nada."),
        ("Si la botonera de atras responde con la maquina en automatico",
         "El tecnico la explico como mando a mano (IMG_0579 min 2:08) y en automatico el corte "
         "lo hace la maquina (min 2:48). Nadie probo si en automatico los selectores responden."),
        ("EL CORTE, filmado de cerca: la mordaza cerrando y la cuchilla entrando",
         "De los 91 videos, ninguno lo muestra en accion; solo se leen los nombres en la "
         "botonera (PULL CLAMP, CUT PRESS, CUT SUPPORT, CUTTING BLADE)."),
        ("Cuando se usa el corte a mano con la botonera de carga, y en que orden",
         "El primer corte lo hace la maquina sola (IMG_0579 min 2:46). El tecnico explico "
         "los comandos a mano (IMG_0579 min 2:08; IMG_0582 min 5:05 a 6:36 en chino): la "
         "placa prensadora baja y, segun el chino, la placa soporte SUBE. Falta cuando se usa."),
        ("Hasta donde se lleva la punta del material sobre la mesa de carga",
         "IMG_0579 min 0:51 a 0:57, con el material sobre la mesa: «ahi, hasta aca, hasta aca "
         "esta bien». No se ve hasta que marca. (El «tope» del min 0:23 es el del eje del "
         "rollo, no el de la mesa.)"),
        ("Si la carga del vinilo se hace con el selector en MANUAL",
         "En el audio chino del IMG_0393, min 1:14, se oye 手动 (manual). Es un indicio "
         "debil; ninguna hoja manda pasar a manual."),
    ]),
    ("4 · LOS SUSTRATOS Y EL FIN DE CICLO — para cerrar el criterio", [
        ("Cuantos sustratos van por ciclo en el Top Roll y en que nidos",
         "La pantalla tiene «Sel. Bastidor 1» a «4», cada uno con su entrada (I42.0 a I42.3); "
         "el 10/09 solo el 1 estaba en verde (IMG_0830)."),
        ("Cuantos segundos tiene el operario para poner los sustratos",
         "El retardo «Ret. en poner Matr.» estaba en 50 s en la puesta a punto; el tecnico "
         "dijo que en serie va en 0 (IMG_0860)."),
        ("Donde esta la luz de cada nido que dice si el sustrato esta puesto",
         "El tecnico dice «si lo falta, le falta luz» (IMG_0579 min 7:42 a 8:09); en "
         "ninguna foto se ve cual es esa luz."),
        ("En que momento exacto se puede entrar al molde en cada ciclo",
         "IMG_0844 min 6:42 a 6:48: «preguntale cuando se puede entrar... cuando la mesa "
         "empieza a» y se corta. La hoja 36 dice: cuando los expulsores levantan las piezas."),
        ("Si la maquina frena cuando falta un sustrato, o solo apaga la luz y sigue",
         "Del audio solo sale que la luz se apaga (IMG_0579). Probarlo: sacar uno y ver si "
         "arranca."),
        ("Si el sustrato entra de una sola manera en el nido",
         "No hay nada grabado sobre la orientacion. Filmar de cerca los nidos del molde, "
         "vacios."),
        ("Confirmar que el «Esqueleto» de la pantalla es el sustrato plastico",
         "Muy probable: «Sel. Esqueleto» abre «Sel. Bastidor 1..4», uno por entrada "
         "(IMG_0830). Confirmarlo en una frase: si se escribe «expulsar esqueleto» pensando en "
         "el sobrante, la hoja dice lo contrario de lo que pasa."),
        ("Donde va el sobrante de vinilo y si se cuenta",
         "El retiro esta filmado (IMG_0844 s=492); falta donde se tira."),
        ("La dotacion real: uno o dos operarios por maquina",
         "En IMG_0844 trabajan dos («yo la de abajo, yo la de arriba»); confirmar si en serie "
         "son dos."),
    ]),
    ("5 · EL ARRANQUE Y EL CICLO — lo que las hojas 35 y 36 no pueden decir", [
        ("Cual es el boton negro: el de la caja colgante o los de los costados del molde",
         "«Boton verde y despues boton negro» (IMG_0842 min 0:00). Hay un hongo negro en la "
         "caja colgante y otro en cada columna del frente del molde (fotograma 0844_10)."),
        ("Que se aprieta para que arranque el ciclo siguiente",
         "La 36 termina con los sustratos puestos; nadie dice si se vuelve a apretar el "
         "verde y el negro en cada ciclo."),
        ("Como se vuelve a arrancar en automatico despues de una pausa",
         "IMG_0395 min 0:05: «tengo paradas durante 10 minutos y quiero volver a arrancar "
         "en automatico». La respuesta no se entiende en el audio."),
        ("Si los ocho servicios van siempre en verde, o Mold Temp 2 depende del molde",
         "La 31 pide los 8 en verde (el tecnico: «prender todos los servicios», IMG_0579 "
         "min 6:22). En automatico, el 10/09, Mold Temp 2 estaba apagado (IMG_0840 s=4, la "
         "foto de la 35)."),
        ("Si el material queda enhebrado de un dia para el otro",
         "Define si la 33 y la 34 se hacen todos los dias o solo con rollo nuevo."),
    ]),
    ("6 · EL CAMBIO DE MOLDE — hojas 38 a 41", [
        ("El MONTAJE del paso 4 al final de la lista, en la maquina",
         "El 04/09 el montaje se filmo hasta empujar el molde y conectar el agua (IMG_0667, "
         "16:44 a 16:48). Del paso 4 en adelante solo esta la pantalla: los pilares saliendo, "
         "las palancas del panel de aire y las cuatro señales del paso 5 en verde no se ven."),
        ("La lista de la pantalla Cambio Molde tal como esta HOY, desmontaje y montaje",
         "El 04/09 los tecnicos dijeron que iban a reprogramarla (IMG_0663 min 8:13); entre el "
         "29/08 y el 04/09 ya habia cambiado un paso. Una foto de cada lista alcanza."),
        ("Cuando se saca el vinilo que protege el molde verde",
         "En el desmontaje se pone un vinilo solo para que apoye el molde auxiliar (IMG_0662 "
         "min 5:49). En el montaje nadie dice en que paso se retira."),
        ("Que receta y que numero de molde se cargan despues del montaje, y la primera pieza",
         "La hoja 41 termina en el ultimo boton de la lista. Falta como se vuelve a producir: "
         "salir de Modo de Ajuste, receta, calentamiento, y si la primera pieza se controla "
         "antes de seguir."),
        ("Quien tiene la contraseña que pide la pantalla en el paso 4 del desmontaje",
         "Se dijo en voz alta en el video (IMG_0662 min 9:31). No va en la hoja: la define el "
         "Lider de Produccion."),
        ("Donde se guardan los pilares largos y cortos, la grasa y las llaves Allen",
         "«Esos son los largos y estos son los cortitos» (IMG_0662 min 5:02). No se ve donde "
         "quedan cuando no se usan."),
        ("La traba negra del carro: que es y donde se pone",
         "«Ahora hay que ponerle la traba... esa cosa negra, para ser mas estable» (IMG_0664 "
         "min 2:13 a 2:50). No se ve en ningun cuadro."),
        ("Si el molde se mueve alguna vez con el puente grua o solo con el carro",
         "En los videos del 04/09 el molde sale empujado al carro blanco (IMG_0664 s=78, "
         "IMG_0666 s=45). Nadie nombra la grua."),
        ("Cual palanca del panel de aire es la del molde auxiliar y cual la de la cuchilla",
         "Se movieron en los pasos 7 y 13 (IMG_0662 s=684 a 702 y min 22:34), pero no se ve "
         "cual es cual ni para que lado va. La traductora dijo que la iban a marcar con una "
         "cinta (min 11:05)."),
        ("Que es el «candado manual» (手动锁) de los pasos 7 y 13 del desmontaje",
         "La pantalla lo pide junto con el agua, la luz y el aire; en el video solo se mueve "
         "la palanca del aire. Si hay un candado o un agua para sacar, no se ve."),
        ("Si hay que esperar que la maquina se enfrie antes del cambio",
         "El 04/09 el cambio se hizo con guantes, a la tarde despues de producir. Nadie dice "
         "si hay que apagar el calor o esperar."),
        ("Que se hace con el molde que sale y como llega el molde nuevo al carro",
         "Entre el desmontaje y el montaje: donde se deja el molde viejo, si es el mismo carro "
         "y como se sube el nuevo. Ningun video lo muestra."),
        ("Para que se usan las llaves Allen",
         "«Vamos a necesitar ... las llaves allen para hacer el cambio de molde» (IMG_0662 min "
         "6:53). No se ve en que paso."),
        ("El sensor del sujetador de la cuchilla que no se activo el 04/09",
         "«Falta un sensor ahi, el sujetador de cuchillo» (IMG_0662 min 23:22). Saber si ya "
         "esta resuelto antes de dar las hojas a produccion."),
    ]),
    ("7 · LAS TOMAS QUE MEJORARIAN LO QUE YA HAY", [
        ("Las manos apretando, de frente y quietas: RESET azul, arranque verde, paro rojo",
         "Estan filmadas de costado o en movimiento. Tres segundos de frente y quietos "
         "alcanzan para sacar la foto de cada boton."),
        ("La pieza recien sacada, entera y sola sobre la mesa",
         "Hoy siempre se ve en las manos o de lejos."),
        ("Una pieza con cada defecto al lado de una buena: globito y despegue",
         "Para el plan de reaccion de la 37: que el operario sepa que esta mirando."),
    ]),
]

COMO = ("COMO CONVIENE SACARLAS — 3 a 5 segundos de VIDEO fijo por toma, no una foto: de un "
        "video elijo el cuadro mas nitido y casi siempre sale mejor que la foto. El telefono "
        "horizontal, apoyado o con los codos apoyados, la cosa llenando el cuadro, sin gente "
        "de fondo. Si la pantalla se ve volcada no importa: la enderezo yo.")


def _caja(slide, x, y, w, h, relleno=None, borde=None, ancho=Pt(0.75)):
    from pptx.enum.shapes import MSO_SHAPE
    sh = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Cm(x), Cm(y), Cm(w), Cm(h))
    sh.shadow.inherit = False
    if relleno is None:
        sh.fill.background()
    else:
        sh.fill.solid()
        sh.fill.fore_color.rgb = relleno
    if borde is None:
        sh.line.fill.background()
    else:
        sh.line.color.rgb = borde
        sh.line.width = ancho
    sh.text_frame.clear()
    return sh


def _txt(sh, texto, size=11, bold=False, color=NEGRO, align=PP_ALIGN.LEFT,
         anchor=MSO_ANCHOR.MIDDLE, margen=0.15):
    tf = sh.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = anchor
    tf.margin_left = tf.margin_right = Cm(margen)
    tf.margin_top = tf.margin_bottom = Cm(0.05)
    p = tf.paragraphs[0]
    p.alignment = align
    r = p.add_run()
    r.text = texto
    r.font.size = Pt(size)
    r.font.bold = bold
    r.font.name = "Calibri"
    r.font.color.rgb = color
    return sh


def _alto(t):
    # titulo en 11 pt (~0,45 cm) + cada renglon de la explicacion en 9 pt (~0,38 cm) + aire.
    # Con 0,44 + 0,32 por renglon la explicacion quedaba pegada al borde de la caja.
    return 0.62 + max(1, (len(t) // 118) + 1) * 0.38


def armar():
    prs = Presentation()
    prs.slide_width = Cm(W)
    prs.slide_height = Cm(H)
    Y0, PIE_H = 2.90, 1.05
    disponible = (H - M - PIE_H - 0.25) - Y0
    n = 0
    for i, (titulo, tomas) in enumerate(TOMAS, 1):
        slide = prs.slides.add_slide(prs.slide_layouts[6])
        _txt(_caja(slide, M, 0.8, W - 2 * M, 1.2, AZUL, AZUL),
             f"QUE FALTA FILMAR — MAQUINA MOLDEADORA IMG   ({i} de {len(TOMAS)})",
             size=20, bold=True, color=BLANCO)
        _txt(_caja(slide, M, 2.0, W - 2 * M, 0.85, None, None), ENCABEZADO,
             size=10.5, color=AZUL2)

        # cada bloque en su pagina; si igual no entra, se achica y AVISA
        pedido = 0.65 + 0.18 + sum(_alto(t) for _, t in tomas)
        k = min(1.0, disponible / pedido)
        if k < 0.85:
            print(f"  [AVISO] bloque {i}: pide {pedido:.1f} cm y entran {disponible:.1f}; "
                  f"se achica al {k:.0%}. Partirlo en dos paginas.")

        y = Y0
        _txt(_caja(slide, M, y, W - 2 * M, 0.65 * k, AZUL2, AZUL2), titulo,
             size=12, bold=True, color=BLANCO)
        y += 0.65 * k
        for que, porque in tomas:
            n += 1
            alto = _alto(porque) * k
            _txt(_caja(slide, M, y, 1.0, alto, GRIS, AZUL), str(n),
                 size=12, bold=True, align=PP_ALIGN.CENTER)
            sh = _caja(slide, M + 1.0, y, W - 2 * M - 1.0, alto, None, AZUL)
            tf = sh.text_frame
            tf.word_wrap = True
            tf.vertical_anchor = MSO_ANCHOR.MIDDLE
            tf.margin_left = Cm(0.2)
            tf.margin_top = Cm(0.04)
            tf.margin_bottom = Cm(0.04)
            p = tf.paragraphs[0]
            p.alignment = PP_ALIGN.LEFT
            r = p.add_run()
            r.text = que
            r.font.size = Pt(11)
            r.font.bold = True
            r.font.name = "Calibri"
            r.font.color.rgb = NEGRO
            p2 = tf.add_paragraph()
            p2.alignment = PP_ALIGN.LEFT
            r2 = p2.add_run()
            r2.text = porque
            r2.font.size = Pt(9)
            r2.font.name = "Calibri"
            r2.font.color.rgb = AZUL2
            y += alto

        _txt(_caja(slide, M, H - M - PIE_H, W - 2 * M, PIE_H, GRIS, ROJO, Pt(1.25)),
             COMO, size=10, bold=False, color=NEGRO)

    prs.save(SALIDA_PPTX)
    print(f"[OK] {SALIDA_PPTX}  ({len(TOMAS)} paginas, {n} renglones)")
    return SALIDA_PPTX


def a_pdf(pptx_path):
    import win32com.client
    pdf = os.path.splitext(pptx_path)[0] + ".pdf"
    ppt = win32com.client.Dispatch("PowerPoint.Application")
    habia_abiertas = ppt.Presentations.Count   # lo que tenga abierto Fak no se cierra
    try:
        pres = ppt.Presentations.Open(os.path.abspath(pptx_path), WithWindow=False)
        pres.SaveAs(os.path.abspath(pdf), 32)   # 32 = ppSaveAsPDF
        pres.Close()
    finally:
        if habia_abiertas == 0 and ppt.Presentations.Count == 0:
            ppt.Quit()
    print(f"[OK] {pdf}")
    return pdf


if __name__ == "__main__":
    p = armar()
    pdf = a_pdf(p)
    import shutil
    if os.path.isdir(ESCRITORIO):
        dst = os.path.join(ESCRITORIO, os.path.basename(pdf))
        shutil.copy2(pdf, dst)
        print(f"[OK] copiado a la carpeta de la tarea: {dst}")
