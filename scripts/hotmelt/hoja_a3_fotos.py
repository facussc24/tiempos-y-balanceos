# -*- coding: utf-8 -*-
"""hoja_a3_fotos.py — la hoja de proceso A3 con UNA FOTO POR PASO (formato de P. Gamboa).

Mismo formulario I-IN-002.4-R01 y misma geometria que `generar_hojas_hotmelt_a3.py` (de ahi se
importan el cajetin, el plan de reaccion y las primitivas). Lo que cambia es lo que pidio Fak el
28/09/2026 mirando las hojas del HOTMELT ("con las FOTOS se tiene que entender exactamente que
hay que hacer... menos texto, mas visual"):

  - el bloque de fotos es una GRILLA de baldosas iguales, una por paso, cada una con su REF. n y
    su pie; la foto se recorta para LLENAR la baldosa (no queda chica con blanco alrededor);
  - cada paso termina en "– Ver REF. n" y apunta a su foto;
  - la advertencia de la hoja va en el cuadro AMARILLO, al lado de los elementos de seguridad;
  - el ciclo de control queda con sus filas vacias hasta que Calidad emita el plan de control
    (docs/CRITERIOS_HOJAS_DE_PROCESO.md 1.1 y 1.2).

Una hoja es un dict:
    {"op": "20", "hoja_de": (1, 4), "denominacion": "...", "ho": "HO-992", "sector": "...",
     "pasos": [{"texto": "...", "foto": "ruta.jpg", "pie": "..."}, ...],   # la foto es opcional
     "aviso": "texto del cuadro amarillo", "epp": [iconos]}
Un paso sin foto no lleva REF. Varias fotos seguidas pueden compartir paso con "ref_de": n.
"""
import os
import sys
import tempfile

from PIL import Image
from pptx.util import Cm, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import generar_hojas_hotmelt_a3 as base                      # noqa: E402

AMARILLO = RGBColor(0xFF, 0xFF, 0x00)
GRIS_BORDE = RGBColor(0xBF, 0xBF, 0xBF)

# columnas x filas segun la cantidad de fotos (la baldosa queda lo mas cerca posible de 4:3)
GRILLA = {1: (1, 1), 2: (2, 1), 3: (3, 1), 4: (2, 2), 5: (3, 2), 6: (3, 2), 7: (4, 2), 8: (4, 2),
          9: (3, 3), 10: (4, 3), 11: (4, 3), 12: (4, 3), 13: (5, 3), 14: (5, 3), 15: (5, 3)}
PAD = 0.18          # cm entre baldosas
PIE_H = 0.62        # cm del pie de foto
TMP = os.path.join(tempfile.gettempdir(), "hoja_a3_fotos")


def _recorte_a_baldosa(ruta, ancho_cm, alto_cm, ancla=(0.5, 0.5)):
    """Recorta la imagen a la relacion de la baldosa (cover) y la guarda en un temporal.
    `ancla` = centro del recorte en fracciones de la imagen, para no cortar lo que importa."""
    os.makedirs(TMP, exist_ok=True)
    im = Image.open(ruta).convert("RGB")
    rel = ancho_cm / alto_cm
    w, h = im.size
    if w / h > rel:                      # sobra ancho
        nw = int(round(h * rel))
        x0 = int(round((w - nw) * ancla[0]))
        im = im.crop((x0, 0, x0 + nw, h))
    else:                                # sobra alto
        nh = int(round(w / rel))
        y0 = int(round((h - nh) * ancla[1]))
        im = im.crop((0, y0, w, y0 + nh))
    # 150 dpi sobre el tamano impreso alcanza y mantiene liviano el archivo
    px = int(ancho_cm / 2.54 * 150)
    if im.width > px:
        im = im.resize((px, int(px / rel)), Image.LANCZOS)
    dst = os.path.join(TMP, f"{abs(hash((ruta, ancho_cm, alto_cm, ancla))):x}.jpg")
    im.save(dst, quality=90)
    return dst


def perdida_de_recorte(ruta, ancho_cm, alto_cm):
    """Cuanto de la imagen queda afuera al llenar la baldosa (0 a 1). Sirve para avisar."""
    w, h = Image.open(ruta).size
    rel = ancho_cm / alto_cm
    return 1 - (min(w / h, rel) / max(w / h, rel))


def _baldosa(cols, filas):
    """Ancho y alto (cm) de la FOTO de una baldosa en una grilla de cols x filas."""
    return ((base.IMG_W - PAD * (cols + 1)) / cols,
            (base.IMG_H - PAD * (filas + 1)) / filas - PIE_H)


RECORTE_MAX = 0.15      # si llenar la baldosa recorta mas que esto, la foto entra entera
AREA_MIN, LADO_MIN = 25.0, 3.5      # los pisos de hojalib (SECUENCIA_AREA_MIN / SECUENCIA_LADO_MIN)


def _como_queda(rel, aw, ah):
    """Ancho y alto impresos (cm) de una foto de proporcion `rel` en una baldosa de aw x ah:
    la llena si pierde poco; si no, entra entera y queda mas chica."""
    if 1 - min(rel, aw / ah) / max(rel, aw / ah) <= RECORTE_MAX:
        return aw, ah
    alto = min(ah, aw / rel)
    return alto * rel, alto


def elegir_grilla(fotos):
    """La grilla donde la foto MAS CHICA queda mas grande. El bloque es casi cuadrado: con seis
    pantallas apaisadas, 3 x 2 da baldosas verticales donde cada pantalla entra de 20 cm2 (una
    estampilla, y el control duro la rechaza); 2 x 3 las deja de 70. Se prueban las grillas sin
    una fila entera vacia; primero cuenta cuantas fotos quedan bajo el piso de 25 cm2 y 3,5 cm
    de lado, despues el tamano de la mas chica."""
    n = len(fotos)
    rel = []
    for f in fotos:
        w, h = Image.open(f["foto"]).size
        rel.append(w / h)
    mejor = None
    for cols in range(1, 6):
        for filas in range(1, 5):
            if cols * filas < n or cols * (filas - 1) >= n:
                continue
            aw, ah = _baldosa(cols, filas)
            if aw < 3.5 or ah < 3.5:
                continue
            medidas = [_como_queda(r, aw, ah) for r in rel]
            bajo_piso = sum(1 for w, h in medidas if w * h < AREA_MIN or min(w, h) < LADO_MIN)
            clave = (bajo_piso, -round(min(w * h for w, h in medidas), 1), -aw * ah)
            if mejor is None or clave < mejor[0]:
                mejor = (clave, (cols, filas))
    return mejor[1] if mejor else GRILLA[min(n, 15)]


def bloque_fotos(slide, fotos, grilla=None):
    """fotos = [{"foto": ruta, "pie": texto, "ancla": (fx, fy), "entera": bool}, ...] en orden REF."""
    base._caja(slide, base.IMG_X, base.IMG_Y, base.IMG_W, base.IMG_H, base.BLANCO, borde=base.NEGRO, ancho=Pt(1))
    n = len(fotos)
    if n == 0:
        return []
    for k, f in enumerate(fotos):
        if not os.path.exists(f["foto"]):
            raise FileNotFoundError(f"REF. {k + 1}: no existe la foto {f['foto']}")
    cols, filas = grilla or elegir_grilla(fotos)
    ancho = (base.IMG_W - PAD * (cols + 1)) / cols
    alto = (base.IMG_H - PAD * (filas + 1)) / filas
    avisos = []
    for k, f in enumerate(fotos):
        c, r = k % cols, k // cols
        x = base.IMG_X + PAD + c * (ancho + PAD)
        y = base.IMG_Y + PAD + r * (alto + PAD)
        base._caja(slide, x, y, ancho, alto, base.BLANCO, borde=GRIS_BORDE, ancho=Pt(0.75))
        fh = alto - PIE_H
        ruta = f["foto"]
        if not os.path.exists(ruta):
            raise FileNotFoundError(f"REF. {k + 1}: no existe la foto {ruta}")
        if f.get("entera") or perdida_de_recorte(ruta, ancho, fh) > RECORTE_MAX:
            # una pantalla o un plano que no se puede recortar, o una foto que al llenar la
            # baldosa perderia mas del 15 % (ahi se van los botones marcados o una columna): entra entera,
            # centrada. Queda mas chica, pero no se corta lo que el paso manda mirar.
            im = Image.open(ruta)
            rel = im.width / im.height
            ih = min(fh, ancho / rel)
            iw = ih * rel
            slide.shapes.add_picture(ruta, Cm(x + (ancho - iw) / 2), Cm(y + (fh - ih) / 2), Cm(iw), Cm(ih))
        else:
            p = perdida_de_recorte(ruta, ancho, fh)
            if p > 0.30:
                avisos.append(f"REF. {k + 1}: el recorte a la baldosa deja afuera el {p:.0%} de {os.path.basename(ruta)}")
            rec = _recorte_a_baldosa(ruta, ancho, fh, f.get("ancla", (0.5, 0.5)))
            slide.shapes.add_picture(rec, Cm(x), Cm(y), Cm(ancho), Cm(fh))
        # el cartel REF va arriba a la izquierda; si justo ahi esta lo que el paso manda tocar
        # (la casita de la pantalla), la foto lo pide abajo con "badge": "abajo"
        by = y + fh - 0.68 if f.get("badge") == "abajo" else y + 0.10
        base._badge_ref(slide, x + 0.10, by, k + 1, 1.70, 0.58)
        base._celda(slide, x, y + fh, ancho, PIE_H, f.get("pie", ""), relleno=base.BLANCO, borde=GRIS_BORDE,
                    ancho=Pt(0.75), color=base.NEGRO, size=9.5 if cols <= 3 else 8.5, bold=False,
                    align=PP_ALIGN.CENTER)
    return avisos


def _run(p, texto, size, bold=False, color=None, resaltado=False):
    r = p.add_run()
    r.text = texto
    r.font.size = Pt(size)
    r.font.bold = bold
    r.font.name = "Calibri"
    r.font.color.rgb = color or base.NEGRO
    if resaltado:
        rPr = r._r.get_or_add_rPr()
        hl = base.parse_xml(f'<a:highlight {base.nsdecls("a")}><a:srgbClr val="FFFF00"/></a:highlight>')
        latin = rPr.find('{http://schemas.openxmlformats.org/drawingml/2006/main}latin')
        if latin is not None:
            latin.addprevious(hl)
        else:
            rPr.append(hl)
    return r


def bloque_descripcion(slide, pasos, refs, aviso=None, epp=None):
    """pasos = lista de textos; refs[i] = lista de numeros REF del paso i (puede ser vacia)."""
    X, W = base.DSC_X, base.DSC_W
    base._banda(slide, X, base.DSC_Y, W, 0.70, "DESCRIPCIÓN DE LA OPERACIÓN", size=11.5)
    y = base.DSC_Y + 0.70
    h = base.NOTA_Y - y - 0.02
    caja = base._caja(slide, X, y, W, h, base.BLANCO, borde=base.NEGRO, ancho=Pt(1))
    tf = caja.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = MSO_ANCHOR.TOP
    tf.margin_left = tf.margin_right = Cm(0.30)
    tf.margin_top = Cm(0.25)
    largo = sum(len(t) for t in pasos) + 14 * len(pasos)
    size = 12.5 if largo <= 900 else (11.5 if largo <= 1150 else (10.5 if largo <= 1450 else 9.5))
    for i, texto in enumerate(pasos):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = PP_ALIGN.LEFT
        p.space_after = Pt(size * 0.55)
        _run(p, f"{i + 1}. ", size, bold=True)
        partes = texto.split("⚠")
        _run(p, partes[0].rstrip() if len(partes) > 1 else partes[0], size)
        for extra in partes[1:]:
            _run(p, " ", size)
            _run(p, "⚠ " + extra.strip(), size, bold=True, resaltado=True)
        if refs[i]:
            _run(p, " – Ver ", size)
            _run(p, "REF. " + ", ".join(str(n) for n in refs[i]), size, bold=True)

    # cuadro amarillo + elementos de seguridad (misma franja que usa Gamboa)
    w_av, w_epp = 8.98, 6.77
    x_epp = X + w_av
    if aviso:
        base._celda(slide, X, base.NOTA_Y, w_av, base.NOTA_H, aviso, relleno=AMARILLO, borde=base.NEGRO,
                    ancho=Pt(1), size=9.5 if len(aviso) <= 150 else 8.5, bold=True, color=base.NEGRO,
                    align=PP_ALIGN.CENTER, margen_x=0.15)
    else:
        base._caja(slide, X, base.NOTA_Y, w_av, base.NOTA_H, base.BLANCO, borde=base.NEGRO, ancho=Pt(1))
    base._caja(slide, x_epp, base.NOTA_Y, w_epp, base.NOTA_H, base.BLANCO, borde=base.NEGRO, ancho=Pt(1))
    iconos = [ic for ic in (epp or []) if os.path.exists(ic)]
    if iconos:
        cw = (w_epp - 0.20) / len(iconos)
        s = min(cw - 0.10, 1.10)
        for k, ic in enumerate(iconos):
            slide.shapes.add_picture(ic, Cm(x_epp + 0.10 + k * cw + (cw - s) / 2),
                                     Cm(base.NOTA_Y + 0.08 + (1.24 - s) / 2), Cm(s), Cm(s))
    base._celda(slide, x_epp, base.NOTA_Y + 1.38, w_epp, 0.52, "ELEMENTOS DE SEGURIDAD", relleno=base.AZUL2,
                borde=base.NEGRO, color=base.BLANCO, size=8.0, bold=True)

    # ciclo de control: la grilla del formulario, vacia hasta el plan de control de Calidad
    base._banda(slide, X, base.CIC_Y, 8.98, 0.66, "CICLO DE CONTROL", size=10.5)
    base._celda(slide, X + 8.98, base.CIC_Y, 6.77, 0.66, "Referencia: OP - Operador de Producción",
                relleno=base.BLANCO, borde=base.NEGRO, size=7.8, bold=True, align=PP_ALIGN.CENTER)
    cols = [("Características a controlar", 4.88), ("Método de control", 2.36), ("Resp.", 1.73),
            ("Frec.", 4.25), ("Registro", 2.53)]
    yh = base.CIC_Y + 0.66
    xc = X
    for nom, wc in cols:
        base._celda(slide, xc, yh, wc, 0.85, nom, relleno=base.AZUL, borde=base.NEGRO, color=base.BLANCO,
                    size=8.0, bold=True)
        xc += wc
    yf = yh + 0.85
    hf = (29.00 - yf) / 6
    for _ in range(6):
        xc = X
        for _, wc in cols:
            base._celda(slide, xc, yf, wc, hf, "", relleno=base.BLANCO, borde=base.NEGRO, ancho=Pt(1))
            xc += wc
        yf += hf


def armar(d):
    """Del dict de la hoja saca las fotos en orden REF y, por paso, a que REF apunta."""
    fotos, refs, textos = [], [], []
    for paso in d["pasos"]:
        mias = []
        if paso.get("misma_foto_que"):
            # el paso se apoya en la foto de un paso anterior de la misma hoja (dos botones de
            # la misma botonera): apunta a esa REF sin repetir la foto
            mias = list(refs[paso["misma_foto_que"] - 1])
        for f in paso.get("fotos") or ([paso] if paso.get("foto") else []):
            fotos.append({"foto": f["foto"], "pie": f.get("pie", ""), "ancla": f.get("ancla", (0.5, 0.5)),
                          "entera": f.get("entera", False), "badge": f.get("badge")})
            mias.append(len(fotos))
        refs.append(mias)
        textos.append(paso["texto"])
    return fotos, refs, textos


def hoja(prs, d, logo=None):
    fotos, refs, textos = armar(d)
    if len(fotos) > 15:
        raise ValueError(f"OP {d.get('op')}: {len(fotos)} fotos no entran en una hoja (tope 15): partirla")
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    base._caja(slide, base.X0, base.Y0, base.X1 - base.X0, base.Y1 - base.Y0, base.BLANCO, borde=base.NEGRO,
               ancho=Pt(1.5))
    caj = dict(d)
    if d.get("hoja_de"):
        caj["denominacion"] = f"{d['denominacion']} (HOJA {d['hoja_de'][0]} DE {d['hoja_de'][1]})"
    base.cajetin_a3(slide, caj, logo)
    avisos = bloque_fotos(slide, fotos, grilla=d.get("grilla"))
    base.bloque_plan_a3(slide)
    bloque_descripcion(slide, textos, refs, aviso=d.get("aviso"), epp=d.get("epp"))
    return slide, avisos
