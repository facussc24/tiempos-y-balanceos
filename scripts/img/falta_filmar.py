# -*- coding: utf-8 -*-
"""La lista de tomas que faltan para cerrar las hojas de la MOLDEADORA IMG.

Por que existe: de los 96 videos de la maquina, casi todos son la PANTALLA del HMI o una
toma general del portico. Nadie filmo el encendido, nadie filmo el apagado y nadie filmo
la mano haciendo cada paso. Eso no se puede escribir por analogia (core-prohibiciones §1),
asi que en vez de inventarlo se pide: esta es la lista, ordenada como se recorre la maquina.

Sale un PDF A4 apaisado, para llevarlo al celular en planta.

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

# (bloque, [(que filmar, por que / donde)])
TOMAS = [
    ("1 · APAGADO — es lo unico que no esta filmado", [
        ("La secuencia completa de fin de jornada, de principio a fin",
         "Que se para primero, que se apaga despues y en que orden."),
        ("El pulsador rojo POWER STOP (电源停止) siendo apretado",
         "El pulsador esta filmado y rotulado (IMG_0597) pero nadie lo aprieta nunca."),
        ("La llave general de la puerta del tablero pasando a OFF (0)",
         "La llave esta filmada en ON; falta el gesto de pasarla a OFF."),
        ("Que queda encendido despues de apagar y que no",
         "El cartel dice TURN OFF MACHINE WHEN NOT IN USE, pero no dice si el chiller y "
         "el atemperador quedan en marcha."),
        ("La pantalla del HMI en parada o fin de jornada",
         "Para cerrar la hoja de apagado con lo que ve el operario."),
    ]),
    ("2 · EL ROLLO DE VINILO — el unico video del tema no tiene audio util", [
        ("Como sube el rollo a la cuna: a mano entre dos, con autoelevador o con un carro",
         "El IMG_0393 EMPIEZA con el rollo ya montado y ningun otro de los 89 videos lo "
         "muestra: subirlo no esta filmado."),
        ("Como se fija el eje al rollo y como se traba en la cuna",
         "Se ve un collar contra la cara del rollo; no se ve ni se dice como se fija."),
        ("Como se centra el rollo a lo ancho y contra que referencia",
         "Ninguna toma lo muestra y nadie lo dice."),
        ("Para que lado va la cara buena, y si la punta sale por arriba o por abajo",
         "En IMG_0393 sale por arriba, pero nadie dice que sea la regla."),
        ("Si hay FIFO, control de lote o identificacion del rollo al montarlo",
         "Cero menciones en las 49 transcripciones."),
        ("Que se hace con la punta vieja cuando se termina un rollo: empalme o descarte",
         "No esta filmado ni dicho."),
        ("Si el desbobinado en serie va en manual o en automatico",
         "Las dos entradas existen en la lista de E/S de la maquina."),
        ("EL CORTE, filmado de cerca: la mordaza cerrando y la cuchilla entrando",
         "De los 89 videos, ninguno los muestra en accion. Solo se leen sus nombres en "
         "la botonera (PULL CLAMP, CUT PRESS, CUT SUPPORT, CUTTING BLADE)."),
        ("En que ORDEN se tocan esos cuatro comandos para cortar la primera lamina",
         "La hoja 30.6 propone mordaza, prensadora, soporte y cuchilla. Lo unico "
         "respaldado es que la placa baja antes de cortar (IMG_0579 min 2:10). El resto "
         "lo tiene que confirmar el tecnico antes de que la hoja se apruebe."),
    ]),
    ("3 · LOS SUSTRATOS Y EL FIN DE CICLO — para cerrar el criterio", [
        ("Cuantos sustratos van por ciclo en el Top Roll y en que nidos",
         "El HMI habilita hasta 4 posiciones; el 03/09 solo la 1 estaba en verde."),
        ("Confirmar que 'Ret. en poner Matr.' es el tiempo para poner los sustratos, y "
         "cuantos segundos tiene el operario cuando ese retardo esta en 0",
         "En la puesta a punto estaba en 50 s; el tecnico dijo que en serie va en 0."),
        ("Si la maquina frena cuando falta un sustrato, o solo apaga la luz y sigue",
         "Del audio solo sale que la luz se apaga."),
        ("Si el sustrato lleva una orientacion y como se dan cuenta",
         "No hay nada grabado sobre poka-yoke."),
        ("Que es el 'Esqueleto' de la pantalla: el sustrato plastico o el sobrante de vinilo",
         "El HMI traduce 骨架 como Esqueleto y en este rubro 骨架 es el sustrato. Si se "
         "escribe 'expulsar esqueleto' pensando en el sobrante, la hoja dice lo contrario "
         "de lo que pasa. Es la pregunta que mas pesa."),
        ("Donde va el sobrante de vinilo y si se cuenta",
         "Nadie lo dice en ninguna toma."),
        ("La dotacion real: uno o dos operarios por maquina",
         "Lo unico grabado es 'dos minimos', dicho en una simulacion."),
    ]),
    ("4 · LO QUE MEJORARIA LO QUE YA HAY", [
        ("Las manos apretando, de frente y quietas: RESET, arranque y paro de ciclo",
         "Estan filmadas de costado y en movimiento. De frente y quietas se entienden mejor."),
        ("La pieza recien sacada, entera y sola sobre la mesa",
         "Hoy siempre se ve en las manos o de lejos."),
        ("Una pieza con el defecto tipico al lado de una buena",
         "Para el plan de reaccion: que el operario sepa que esta mirando."),
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


def armar():
    prs = Presentation()
    prs.slide_width = Cm(W)
    prs.slide_height = Cm(H)
    slide = prs.slides.add_slide(prs.slide_layouts[6])

    _txt(_caja(slide, M, 0.8, W - 2 * M, 1.2, AZUL, AZUL),
         "QUE FALTA FILMAR — MAQUINA MOLDEADORA IMG", size=20, bold=True, color=BLANCO)
    _txt(_caja(slide, M, 2.0, W - 2 * M, 0.85, None, None),
         "Barridos los 91 videos y las 31 fotos: el encendido, los servicios y los "
         "comandos YA estan filmados y ya entraron en las hojas. Lo unico que no "
         "tiene una sola toma es el APAGADO. 21/09/2026.", size=11, color=AZUL2)

    # todo tiene que entrar en una pagina: se mide primero y se escala si no cierra
    Y0, PIE_H = 2.90, 1.05
    disponible = (H - M - PIE_H - 0.25) - Y0
    def _alto(t):
        return 0.44 + max(1, (len(t) // 118) + 1) * 0.32
    pedido = sum(0.65 + 0.18 + sum(_alto(t) for _, t in ts) for _, ts in TOMAS)
    k = min(1.0, disponible / pedido) if pedido else 1.0
    if k < 1.0:
        print(f"  [AVISO] la lista pide {pedido:.1f} cm y entran {disponible:.1f}: "
              f"se achica al {k:.0%}. Si baja de 0,85 conviene partirla en dos paginas.")

    y = Y0
    n = 0
    for titulo, tomas in TOMAS:
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
            r2.font.size = Pt(8.5)
            r2.font.name = "Calibri"
            r2.font.color.rgb = AZUL2
            y += alto
        y += 0.18 * k

    _txt(_caja(slide, M, H - M - PIE_H, W - 2 * M, PIE_H, GRIS, ROJO, Pt(1.25)),
         COMO, size=10, bold=False, color=NEGRO)

    prs.save(SALIDA_PPTX)
    print(f"[OK] {SALIDA_PPTX}")
    return SALIDA_PPTX


def a_pdf(pptx_path):
    import win32com.client
    pdf = os.path.splitext(pptx_path)[0] + ".pdf"
    ppt = win32com.client.Dispatch("PowerPoint.Application")
    try:
        pres = ppt.Presentations.Open(os.path.abspath(pptx_path), WithWindow=False)
        pres.SaveAs(os.path.abspath(pdf), 32)   # 32 = ppSaveAsPDF
        pres.Close()
    finally:
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
