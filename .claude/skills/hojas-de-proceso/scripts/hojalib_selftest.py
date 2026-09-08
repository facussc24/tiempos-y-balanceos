# -*- coding: utf-8 -*-
"""Selftest del gate de hojas de proceso: cada criterio, en ROJO y en VERDE.

Un gate que nunca vi fallar no se si funciona. Y uno que solo vi fallar tampoco sirve: si
rechaza todo, es un cartel, no un control. Por eso cada caso va en las dos direcciones.

Arma pptx sinteticos en memoria — nada de datos de cliente, el repo es publico.

    py -3 hojalib_selftest.py          ->  codigo 0 si todos pasan
"""
import os
import sys
import tempfile

from PIL import Image
from pptx import Presentation
from pptx.enum.shapes import MSO_SHAPE
from pptx.util import Cm, Pt

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import hoja_proceso_check as CK  # noqa: E402
import hojalib as HL  # noqa: E402

TMP = tempfile.mkdtemp(prefix="hojaselftest_")


def imagen(w_px, h_px, cuerpo_px=None, nombre=None):
    """Un PNG liso. Con `cuerpo_px`, ademas lleva la metrica de pantalla redibujada."""
    nombre = nombre or "im_%dx%d_%s.png" % (w_px, h_px, cuerpo_px)
    ruta = os.path.join(TMP, nombre)
    im = Image.new("RGB", (w_px, h_px), (200, 210, 230))
    if cuerpo_px:
        HL.guardar_pantalla(im, ruta, cuerpo_px=cuerpo_px, que_es="pantalla de prueba")
    else:
        im.save(ruta)
    return ruta


def hoja(imagenes, op="20.1", texto=None, caja=(6.0, 2.0), badges=False):
    """Un pptx de una lamina: el numero de operacion, las imagenes con su tamaño en cm, y
    opcionalmente un texto en una caja de `caja` cm. Con `badges`, cada foto lleva el
    circulito con el numero del paso, como lo dibuja el generador."""
    prs = Presentation()
    prs.slide_width, prs.slide_height = Cm(29.7), Cm(21.0)
    s = prs.slides.add_slide(prs.slide_masters[0].slide_layouts[6])
    c = s.shapes.add_textbox(Cm(0.6), Cm(3.0), Cm(2.0), Cm(0.6))
    c.text_frame.text = op
    for k, (ruta, (x, y, w, h)) in enumerate(imagenes):
        s.shapes.add_picture(ruta, Cm(x), Cm(y), Cm(w), Cm(h))
        if badges:
            b = s.shapes.add_shape(MSO_SHAPE.OVAL, Cm(x - 0.16), Cm(y - 0.16),
                                   Cm(0.70), Cm(0.70))
            b.text_frame.text = str(k + 1)
    if texto:
        t = s.shapes.add_textbox(Cm(18.0), Cm(5.0), Cm(caja[0]), Cm(caja[1]))
        tf = t.text_frame
        tf.word_wrap = True
        r = tf.paragraphs[0].add_run()
        r.text = texto
        r.font.size = Pt(11)
    d = os.path.join(TMP, "h_%s_%d.pptx" % (op.replace(".", "_"), len(os.listdir(TMP))))
    prs.save(d)
    return d


def tipos(fallas):
    return sorted({f[2] for f in fallas})


CASOS = []


def caso(nombre, ruta, declara, espera):
    """`espera` = None para verde, o el tipo de infraccion que TIENE que aparecer."""
    CASOS.append((nombre, ruta, declara, espera))


Y0 = HL.BODY_Y + HL.BANDA_H          # arriba del bloque de imagenes
X0 = HL.IMG_X

# ── 1. jerarquia ────────────────────────────────────────────────────────────
# ROJO: tres fotos del mismo tamaño. Es el caso real de 11 de las 17 hojas de la HOTMELT.
tres_iguales = [(imagen(900, 1600), (X0 + k * 5.4, Y0, 5.0, 8.9)) for k in range(3)]
caso("3 fotos iguales, sin declarar principal", hoja(tres_iguales), {}, "sin jerarquia")
caso("3 fotos iguales, con principal declarada", hoja(tres_iguales),
     {"20.1": {"principal": 0}}, "jerarquia")

# VERDE: la principal domina, como la deja el reparto de hojalib
grande = imagen(900, 1600)
chica = imagen(900, 1600)
domina = [(grande, (X0, Y0, 5.1, 9.1)),
          (chica, (X0 + 5.4, Y0, 2.5, 4.4)),
          (chica, (X0 + 5.4, Y0 + 4.6, 2.5, 4.4))]
caso("la principal domina", hoja(domina), {"20.1": {"principal": 0}}, None)

# ROJO: declara principal la que NO es la mas grande — el caso de la 20.2 con el celular
caso("declara principal la mas chica", hoja(domina), {"20.1": {"principal": 1}}, "jerarquia")

# ── 1 bis. secuencia: cada foto es un paso ──────────────────────────────────
# La grilla 2x2 del reparto: 4 fotos apaisadas de 7,8 x 4,4 cm = 34 cm2 cada una.
horiz = imagen(1600, 900)
cuatro_seq = [(horiz, (X0 + (k % 2) * 8.1, Y0 + (k // 2) * 4.6, 7.8, 4.4)) for k in range(4)]
SEQ = {"20.1": {"secuencia": True}}
# ROJO: las 4 fotos bien repartidas, pero sin el numero del paso encima
caso("secuencia sin los numeros", hoja(cuatro_seq), SEQ, "sin numero")
# VERDE: las mismas 4, numeradas
caso("secuencia de 4 numerada", hoja(cuatro_seq, badges=True), SEQ, None)
# ROJO: numeradas, pero una quedo de 2,5 x 4,5 — el tamaño de la MITAD de las fotos del
# deck publicado el 07/09, que es justo lo que no se entendia
estampilla = [(horiz, (X0, Y0, 7.8, 4.4)), (horiz, (X0 + 8.1, Y0, 7.8, 4.4)),
              (horiz, (X0, Y0 + 4.6, 4.5, 2.5))]
caso("secuencia con una estampilla", hoja(estampilla, badges=True), SEQ, "estampilla")
# El check de estampilla es un OR (area < 25 cm2 O lado < 3,5 cm) y el caso de arriba
# dispara las DOS condiciones juntas: nunca vi a ninguna fallar sola. Estas dos aislan
# cada rama — una tira larga y angosta tiene area de sobra, y un cuadradito tiene lado
# de sobra en el limite pero no llega al area.
tira = [(horiz, (X0, Y0, 7.8, 4.4)), (horiz, (X0 + 8.1, Y0, 7.8, 4.4)),
        (horiz, (X0, Y0 + 4.6, 11.0, 3.0))]          # 33 cm2: el area pasa, el lado no
caso("estampilla por el LADO, con area de sobra", hoja(tira, badges=True), SEQ, "estampilla")
cuadrito = [(horiz, (X0, Y0, 4.6, 4.6)), (horiz, (X0 + 5.0, Y0, 4.6, 4.6)),
            (horiz, (X0 + 10.0, Y0, 4.6, 4.6))]      # 21 cm2: el lado pasa, el area no
caso("estampilla por el AREA, con lado de sobra", hoja(cuadrito, badges=True), SEQ,
     "estampilla")
# ROJO: las dos entran holgadas, pero una dobla a la otra -> eso es jerarquia, no secuencia
caso("secuencia despareja",
     hoja([(horiz, (X0, Y0, 10.0, 5.6)), (horiz, (X0 + 10.4, Y0, 5.0, 5.0))], badges=True),
     SEQ, "despareja")
# ROJO: 5 pasos no entran en una lamina — se parte, no se achica
caso("5 fotos en secuencia",
     hoja([(horiz, (X0 + k * 3.2, Y0, 3.0, 1.7)) for k in range(5)], badges=True),
     SEQ, "cantidad")
# VERDE: 4 fotos numeradas SIN declarar principal — en jerarquia esto seria "sin jerarquia"
# y ademas "cantidad": el modo tiene que ser el que cambia el veredicto, no el dibujo.
caso("las mismas 4, pero declaradas como jerarquia", hoja(cuatro_seq, badges=True),
     {"20.1": {"principal": 0}}, "jerarquia")

# ── 2. legibilidad ──────────────────────────────────────────────────────────
# ROJO: pantalla de 1760 px con cuerpo 27 puesta a 5,4 cm -> 2,3 pt. Es la 20.15 del deck.
ilegible = imagen(1760, 1000, cuerpo_px=27, nombre="pant_chica.png")
caso("pantalla a 5,4 cm", hoja([(ilegible, (X0, Y0, 5.4, 3.1))]),
     {"20.1": {"principal": 0}}, "no se lee")
# VERDE: la misma pantalla, al ancho que la libreria dice que necesita (16,1 cm).
# Primero puse 16,0 "a ojo" y el caso verde salio rojo por 0,04 pt: el ancho de un caso
# verde no se elige, se pide.
_ancho_ok = HL.ancho_minimo_cm(27, 1760)
caso("la misma pantalla a %.1f cm" % _ancho_ok,
     hoja([(ilegible, (X0, Y0, _ancho_ok, _ancho_ok / 1.76))]),
     {"20.1": {"principal": 0}}, None)
# ROJO: foto SIN metrica marcada `leer` y angosta
caso("foto marcada leer, angosta",
     hoja([(imagen(1600, 900), (X0, Y0, 16.0, 9.0)),
           (imagen(1600, 900), (X0, Y0, 4.0, 2.2))]),
     {"20.1": {"principal": 0, "leer": [1]}}, "no se lee")

# ── 3. cantidad ─────────────────────────────────────────────────────────────
cuatro = [(imagen(1600, 900), (X0 + (k % 2) * 8.2, Y0 + (k // 2) * 4.6, 8.0, 4.4))
          for k in range(4)]
caso("4 imagenes", hoja(cuatro), {"20.1": {"principal": 0}}, "cantidad")
# 3 esta permitido, pero solo si hay jerarquia: tres iguales siguen siendo rojo, y por eso
# el caso verde de cantidad lleva la principal grande.
tres_con_jefe = [(imagen(1600, 900), (X0, Y0, 12.0, 6.7)),
                 (imagen(1600, 900), (X0 + 12.4, Y0, 3.4, 1.9)),
                 (imagen(1600, 900), (X0 + 12.4, Y0 + 2.2, 3.4, 1.9))]
caso("3 imagenes con jerarquia", hoja(tres_con_jefe), {"20.1": {"principal": 0}}, None)

# ── 4. texto que no entra ───────────────────────────────────────────────────
LARGO = ("Verificar la temperatura de consigna de los dos rodillos y la de proteccion, "
         "y dejar constancia en el registro de set up antes de arrancar la produccion.")
caso("texto que no entra en su caja",
     hoja([(grande, (X0, Y0, 16.0, 9.0))], texto=LARGO, caja=(4.0, 0.8)),
     {"20.1": {"principal": 0}}, "texto")
caso("el mismo texto en una caja que le da",
     hoja([(grande, (X0, Y0, 16.0, 9.0))], texto=LARGO, caja=(9.0, 4.0)),
     {"20.1": {"principal": 0}}, None)

# ── 5. una hoja sin fotos: el recuadro vacio esta PERMITIDO ──────────────────
caso("hoja sin imagenes", hoja([]), {}, None)


def sizing():
    """`ancho_que_le_toca_cm` es lo que el GATE 2 manda usar ANTES de dibujar una pantalla.
    Si mintiera por exceso, uno dimensiona una pantalla que despues no entra. El invariante
    que importa no es que acierte al centimetro: es que **nunca prometa mas ancho del que el
    reparto real le va a dar**."""
    malos = 0
    W, H = HL.bloque_cm()
    for (w_px, h_px), n in (((1260, 1052), 3), ((1400, 1004), 2), ((1760, 872), 1),
                            ((900, 1600), 3), ((1600, 900), 2)):
        promete = HL.ancho_que_le_toca_cm(w_px, h_px, n_imagenes=n)
        ars = [w_px / float(h_px)] + [0.5625] * (n - 1)
        real = HL.layout_principal(ars, W - 0.2, H - 0.2, 0)
        da = real[0][2] if real else 0.0
        ok = promete <= da + 1e-9
        print("  %s  %4dx%-4d con %d  promete %5.2f cm, el reparto da %5.2f"
              % ("ok  " if ok else "FALLA", w_px, h_px, n, promete, da))
        malos += not ok
    return malos


def main():
    ancho = max(len(c[0]) for c in CASOS)
    malos = 0
    for nombre, ruta, declara, espera in CASOS:
        fallas = CK.revisar(ruta, declara)
        t = tipos(fallas)
        if espera is None:
            ok = not fallas
            dice = "sin infracciones" if ok else "aparecio " + ", ".join(t)
        else:
            ok = espera in t
            dice = ("marca %s" % espera) if ok else "NO marco %s (dio %s)" % (espera, t or "nada")
        print("  %s  %-*s  %s" % ("ok  " if ok else "FALLA", ancho, nombre, dice))
        malos += not ok
    print("\n  -- el ancho que promete el GATE 2 nunca supera al que da el reparto --")
    malos += sizing()
    print("\n%d casos, %d fallan." % (len(CASOS) + 5, malos))
    return 1 if malos else 0


if __name__ == "__main__":
    sys.exit(main())
