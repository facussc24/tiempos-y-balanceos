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
import hashlib
import math
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


def _recorte_a_baldosa(ruta, ancho_cm, alto_cm, ancla=(0.5, 0.5), dpi=150):
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
    px = int(ancho_cm / 2.54 * dpi)
    if im.width > px:
        im = im.resize((px, int(px / rel)), Image.LANCZOS)
    # nombre ESTABLE (el hash() de Python cambia en cada corrida y dejaba un temporal nuevo por
    # foto y por corrida: 296 archivos en un dia). Con la fecha del origen adentro, una foto
    # rehecha no reusa el recorte viejo.
    clave = f"{ruta}|{os.path.getmtime(ruta)}|{ancho_cm:.3f}|{alto_cm:.3f}|{tuple(ancla)}|{dpi}"
    dst = os.path.join(TMP, hashlib.md5(clave.encode("utf-8")).hexdigest() + ".jpg")
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


def _proporciones(fotos):
    rel = []
    for f in fotos:
        w, h = Image.open(f["foto"]).size
        rel.append(w / h)
    return rel


def elegir_grilla(fotos):
    """La grilla donde la foto MAS CHICA queda mas grande. El bloque es casi cuadrado: con seis
    pantallas apaisadas, 3 x 2 da baldosas verticales donde cada pantalla entra de 20 cm2 (una
    estampilla, y el control duro la rechaza); 2 x 3 las deja de 70. Se prueban las grillas sin
    una fila entera vacia; primero cuenta cuantas fotos quedan bajo el piso de 25 cm2 y 3,5 cm
    de lado, despues el tamano de la mas chica."""
    return _mejor_grilla(fotos)[1]


def _mejor_grilla(fotos):
    """(clave, (cols, filas)) de la mejor grilla; clave = (fotos bajo el piso, -area de la mas chica, ...)."""
    n = len(fotos)
    rel = _proporciones(fotos)
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
    return mejor if mejor else ((n, 0.0, 0.0), GRILLA[min(n, 15)])


# ── filas a medida: cuando la hoja mezcla pantallas acostadas con fotos paradas ─────────────
# Fak, sobre el deck anterior: "orientaciones mezcladas... no mezclar orientaciones (vertical/
# horizontal) a lo loco... acomodar ordenado". En una grilla de baldosas iguales, la pantalla
# acostada cae en una baldosa parada y queda chica, rodeada de blanco. Aca cada FILA tiene una
# sola altura y cada foto entra entera con su proporcion: la fila se llena de lado a lado.
FILAS_GANAN_POR = 1.15      # reemplazan a la grilla solo si las fotos crecen 15 % en conjunto...
FILAS_CHICA_TOLERA = 0.90   # ...y la mas chica de la hoja no se achica mas de 10 %
PIE_H_DOBLE = 1.02          # cm del pie cuando necesita dos renglones
SEPARA_FILAS_MAX = 0.60     # cm: lo que sobra de alto no se reparte en huecos grandes


def _alto_pie(texto, ancho_cm, size=9.5):
    """Un renglon si el pie entra en el ancho de la foto; si no, los que hagan falta (un pie largo
    en una foto angosta pide tres: con solo dos la caja quedaba corta)."""
    por_renglon = max(1, int((ancho_cm - 0.30) / (size * 0.0185)))
    renglones = max(1, -(-len(texto or "") // por_renglon))
    return PIE_H + (renglones - 1) * (PIE_H_DOBLE - PIE_H)


def _media(areas):
    """Media geometrica: sube cuando crecen todas las fotos, no cuando una sola se agranda."""
    return math.exp(sum(math.log(a) for a in areas) / len(areas))


def _repartir_alto(tope, cuantas, libre):
    """El alto de cada fila cuando no entran todas con el alto que llena el ancho (`tope`).
    El conjunto de fotos queda lo mas grande posible repartiendo el alto libre en proporcion a
    CUANTAS fotos tiene cada fila, sin pasar el tope de ninguna: lo que una fila no puede usar
    se lo llevan las otras."""
    if libre <= 0 or min(cuantas, default=0) < 1 or min(tope, default=0) <= 0:
        raise ValueError(f"no hay alto para repartir: libre={libre:.2f} cm, fotos por fila={list(cuantas)}")
    altos = [0.0] * len(tope)
    quedan = set(range(len(tope)))
    while quedan:
        total = sum(cuantas[r] for r in quedan)
        topadas = [r for r in quedan if libre * cuantas[r] / total >= tope[r]]
        if not topadas:
            for r in quedan:
                altos[r] = libre * cuantas[r] / total
            break
        for r in topadas:
            altos[r] = tope[r]
            libre -= tope[r]
            quedan.discard(r)
    return altos


def _filas_a_medida(rel, pies):
    """Todos los repartos de las fotos, en su orden, en filas consecutivas de altura propia.
    Devuelve [(fotos bajo el piso, area de la mas chica, media, [(alto_foto, alto_pie, [anchos])])]."""
    n = len(rel)
    repartos = []
    for mascara in range(1 << (n - 1)):
        grupos, ini = [], 0
        for i in range(n):
            if i == n - 1 or mascara >> i & 1:
                grupos.append(range(ini, i + 1))
                ini = i + 1
        if len(grupos) > 4 or max(len(g) for g in grupos) > 5:
            continue
        repartos.append(_medir_reparto(rel, pies, grupos))
    return repartos


def _medir_reparto(rel, pies, grupos):
    """Un reparto ya decidido (grupos = los indices de cada fila) con sus medidas:
    (fotos bajo el piso, area de la mas chica, media, [(alto_foto, alto_pie, [anchos])])."""
    # el alto con el que cada fila llena el ancho del bloque
    tope = [(base.IMG_W - PAD * (len(g) + 1)) / sum(rel[i] for i in g) for g in grupos]
    altos = list(tope)
    for _ in range(3):      # el alto del pie depende del ancho de la foto, y el ancho del alto
        pie = [max(_alto_pie(pies[i], altos[k] * rel[i]) for i in g) for k, g in enumerate(grupos)]
        altos = _repartir_alto(tope, [len(g) for g in grupos],
                               base.IMG_H - PAD * (len(grupos) + 1) - sum(pie))
    filas = [(altos[k], pie[k], [altos[k] * rel[i] for i in g]) for k, g in enumerate(grupos)]
    medidas = [(w, alto) for alto, _, anchos in filas for w in anchos]
    areas = [w * h for w, h in medidas]
    bajo_piso = sum(1 for w, h in medidas if w * h < AREA_MIN or min(w, h) < LADO_MIN)
    return bajo_piso, min(areas), _media(areas), filas


def filas_pedidas(fotos, cuantas):
    """El reparto que la hoja pide a mano con `filas=[2, 3]` (dos fotos arriba, tres abajo): para
    la hoja donde la foto que el paso manda LEER tiene que ganar tamano aunque otra se achique
    (gate 1 del skill: la imagen principal se declara, no la elige la geometria)."""
    if sum(cuantas) != len(fotos) or min(cuantas) < 1:
        raise ValueError(f"filas={cuantas!r} no reparte las {len(fotos)} fotos de la hoja")
    grupos, ini = [], 0
    for c in cuantas:
        grupos.append(range(ini, ini + c))
        ini += c
    bajo_piso, _, _, filas = _medir_reparto(_proporciones(fotos), [f.get("pie", "") for f in fotos], grupos)
    if bajo_piso:
        raise ValueError(f"filas={cuantas!r} deja {bajo_piso} foto(s) por debajo de 25 cm2 o de 3,5 cm de lado")
    return filas


def elegir_acomodo(fotos):
    """("grilla", (cols, filas)) o ("filas", [...]). La grilla de baldosas iguales es la forma por
    defecto. Las filas a medida entran en dos casos: cuando sacan una foto de abajo del piso, o
    cuando las fotos de la hoja crecen 15 % en conjunto sin que ninguna se achique mas de 10 %."""
    clave_g, grilla = _mejor_grilla(fotos)
    if len(fotos) < 2:
        return "grilla", grilla
    rel = _proporciones(fotos)
    aw, ah = _baldosa(*grilla)
    areas_g = [w * h for w, h in (_como_queda(r, aw, ah) for r in rel)]
    repartos = _filas_a_medida(rel, [f.get("pie", "") for f in fotos])
    if not repartos:
        return "grilla", grilla
    menos_bajo_piso = min(repartos, key=lambda r: (r[0], -r[1]))
    if menos_bajo_piso[0] < clave_g[0]:
        return "filas", menos_bajo_piso[3]
    validos = [r for r in repartos if r[0] <= clave_g[0] and r[1] >= min(areas_g) * FILAS_CHICA_TOLERA]
    if validos:
        mejor = max(validos, key=lambda r: r[2])
        if mejor[2] >= _media(areas_g) * FILAS_GANAN_POR:
            return "filas", mejor[3]
    return "grilla", grilla


def _dibujar_filas(slide, fotos, filas):
    usado = sum(alto + pie for alto, pie, _ in filas)
    separa = min(SEPARA_FILAS_MAX, max(PAD, (base.IMG_H - usado) / (len(filas) + 1)))
    y = base.IMG_Y + (base.IMG_H - usado - separa * (len(filas) - 1)) / 2
    k = 0
    avisos = []
    for alto, pie_h, anchos in filas:
        x = base.IMG_X + (base.IMG_W - sum(anchos) - PAD * (len(anchos) - 1)) / 2
        for w in anchos:
            f = fotos[k]
            base._caja(slide, x, y, w, alto + pie_h, base.BLANCO, borde=GRIS_BORDE, ancho=Pt(0.75))
            # la foto entra entera (misma proporcion que su casillero: no se recorta nada)
            slide.shapes.add_picture(_recorte_a_baldosa(f["foto"], w, alto, dpi=200), Cm(x), Cm(y), Cm(w), Cm(alto))
            by = y + alto - 0.68 if f.get("badge") == "abajo" else y + 0.10
            base._badge_ref(slide, x + 0.10, by, k + 1, 1.70, 0.58)
            base._celda(slide, x, y + alto, w, pie_h, f.get("pie", ""), relleno=base.BLANCO, borde=GRIS_BORDE,
                        ancho=Pt(0.75), color=base.NEGRO, size=9.5, bold=False, align=PP_ALIGN.CENTER)
            if w * alto < AREA_MIN or min(w, alto) < LADO_MIN:
                avisos.append(f"REF. {k + 1}: {os.path.basename(f['foto'])} queda de {w:.1f} x {alto:.1f} cm: "
                              "partir la hoja o recortar la foto")
            x += w + PAD
            k += 1
        y += alto + pie_h + separa
    return avisos


def bloque_fotos(slide, fotos, grilla=None, filas=None):
    """fotos = [{"foto": ruta, "pie": texto, "ancla": (fx, fy), "entera": bool}, ...] en orden REF.
    `grilla=(cols, filas)` fuerza baldosas iguales; `filas=[2, 3]` fuerza filas a medida."""
    base._caja(slide, base.IMG_X, base.IMG_Y, base.IMG_W, base.IMG_H, base.BLANCO, borde=base.NEGRO, ancho=Pt(1))
    n = len(fotos)
    if n == 0:
        return []
    for k, f in enumerate(fotos):
        if not os.path.exists(f["foto"]):
            raise FileNotFoundError(f"REF. {k + 1}: no existe la foto {f['foto']}")
    if filas is not None:
        return _dibujar_filas(slide, fotos, filas_pedidas(fotos, filas))
    if grilla is None:
        forma, acomodo = elegir_acomodo(fotos)
        if forma == "filas":
            return _dibujar_filas(slide, fotos, acomodo)
        grilla = acomodo
    cols, filas = grilla
    if cols * filas < n:
        raise ValueError(f"la grilla {cols} x {filas} no alcanza para {n} fotos: quedarian fuera del bloque")
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
        if f.get("entera") or perdida_de_recorte(ruta, ancho, fh) > RECORTE_MAX:
            # una pantalla o un plano que no se puede recortar, o una foto que al llenar la
            # baldosa perderia mas del 15 % (ahi se van los botones marcados o una columna): entra entera,
            # centrada. Queda mas chica, pero no se corta lo que el paso manda mirar.
            im = Image.open(ruta)
            rel = im.width / im.height
            ih = min(fh, ancho / rel)
            iw = ih * rel
            slide.shapes.add_picture(ruta, Cm(x + (ancho - iw) / 2), Cm(y + (fh - ih) / 2), Cm(iw), Cm(ih))
            if iw * ih < AREA_MIN or min(iw, ih) < LADO_MIN:
                avisos.append(f"REF. {k + 1}: {os.path.basename(ruta)} entra entera y queda de "
                              f"{iw:.1f} x {ih:.1f} cm: recortarla a la forma de la baldosa o partir la hoja")
        else:
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


def _sin_cortar(texto):
    """Un numero no se separa de su unidad al cambiar de renglon ("150" arriba y "°C" abajo)."""
    for unidad in ("°C", "MPa", "minutos", "vueltas"):
        texto = texto.replace(" " + unidad, " " + unidad)
    return texto


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
        partes = _sin_cortar(texto).split("⚠")
        _run(p, partes[0].rstrip() if len(partes) > 1 else partes[0], size)
        for extra in partes[1:]:
            _run(p, " ", size)
            _run(p, "⚠ " + extra.strip(), size, bold=True, resaltado=True)
        if refs[i]:
            _run(p, " – Ver ", size)
            _run(p, "REF. " + ", ".join(str(n) for n in refs[i]), size, bold=True)

    # cuadro amarillo + elementos de seguridad (misma franja que usa Gamboa)
    w_av, w_epp = 8.98, 6.77
    x_epp = X + w_av
    if aviso:
        base._celda(slide, X, base.NOTA_Y, w_av, base.NOTA_H, _sin_cortar(aviso), relleno=AMARILLO, borde=base.NEGRO,
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
        if "misma_foto_que" in paso:
            # el paso se apoya en la foto de un paso anterior de la misma hoja (dos botones de
            # la misma botonera): apunta a esa REF sin repetir la foto
            n = paso["misma_foto_que"]
            if not (isinstance(n, int) and 1 <= n <= len(refs)) or not refs[n - 1]:
                raise ValueError(f"misma_foto_que={n!r}: tiene que ser el numero de un paso ANTERIOR "
                                 f"de esta hoja que tenga foto (hay {len(refs)} antes)")
            mias = list(refs[n - 1])
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
    avisos = bloque_fotos(slide, fotos, grilla=d.get("grilla"), filas=d.get("filas"))
    base.bloque_plan_a3(slide)
    bloque_descripcion(slide, textos, refs, aviso=d.get("aviso"), epp=d.get("epp"))
    return slide, avisos


def portada(prs, titulo, subtitulo, ficha, indice, logo=None, foto=None, pie_foto=""):
    """La lamina 1 de un juego de hojas: cabecera, foto de la maquina, ficha e indice.

    La pide `docs/CRITERIOS_HOJAS_DE_PROCESO.md` seccion 5 para toda maquina con varias hojas
    (y a Fak le gusto la del deck anterior: "tiene sentido"). Cabecera con el logo sobre blanco,
    foto real de la maquina a la izquierda, ficha a la derecha y el indice con el numero de
    cada hoja. `ficha` = [(rotulo, valor)], `indice` = [(numero, denominacion)].
    """
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    X0, Y0, X1, Y1 = base.X0, base.Y0, base.X1, base.Y1
    base._caja(slide, X0, Y0, X1 - X0, Y1 - Y0, base.BLANCO, borde=base.NEGRO, ancho=Pt(1.5))
    cab = 3.40
    base._caja(slide, X0, Y0, X1 - X0, cab, base.BLANCO, borde=base.AZUL, ancho=Pt(1.5))
    base._caja(slide, X0, Y0 + cab - 0.10, X1 - X0, 0.10, base.AZUL, borde=base.AZUL)
    lw = 6.00
    if logo and os.path.exists(logo):
        im = Image.open(logo)
        ih = min(cab - 0.90, (lw - 1.00) / (im.width / im.height))
        iw = ih * im.width / im.height
        slide.shapes.add_picture(logo, Cm(X0 + (lw - iw) / 2), Cm(Y0 + (cab - 0.10 - ih) / 2), Cm(iw), Cm(ih))
    tx, tw = X0 + lw + 0.30, X1 - X0 - lw - 0.60
    base._celda(slide, tx, Y0 + 0.35, tw, 1.60, titulo, size=30, bold=True, color=base.AZUL,
                relleno=base.BLANCO, borde=None, align=PP_ALIGN.LEFT)
    base._celda(slide, tx, Y0 + 1.95, tw, 0.95, subtitulo, size=13, bold=False, color=base.AZUL2,
                relleno=base.BLANCO, borde=None, align=PP_ALIGN.LEFT)

    yb = Y0 + cab + 0.35
    hb = Y1 - yb - 0.25
    wf = 17.50
    base._caja(slide, X0 + 0.20, yb, wf, hb, base.BLANCO, borde=base.AZUL, ancho=Pt(1))
    if foto and os.path.exists(foto):
        hf = hb - (PIE_H if pie_foto else 0)
        rec = _recorte_a_baldosa(foto, wf - 0.20, hf - 0.20)
        slide.shapes.add_picture(rec, Cm(X0 + 0.30), Cm(yb + 0.10), Cm(wf - 0.20), Cm(hf - 0.20))
        if pie_foto:
            base._celda(slide, X0 + 0.20, yb + hf, wf, PIE_H, pie_foto, relleno=base.BLANCO, borde=base.AZUL,
                        ancho=Pt(1), color=base.NEGRO, size=9.5, bold=False, align=PP_ALIGN.CENTER)

    xd = X0 + 0.20 + wf + 0.35
    wd = X1 - xd - 0.20
    y = yb
    for rotulo, valor in ficha:
        base._celda(slide, xd, y, 5.40, 0.74, rotulo, relleno=base.AZUL, color=base.BLANCO, size=9.0,
                    bold=True, align=PP_ALIGN.LEFT, margen_x=0.15)
        base._celda(slide, xd + 5.40, y, wd - 5.40, 0.74, valor, relleno=base.BLANCO, color=base.NEGRO,
                    size=9.5, bold=True, align=PP_ALIGN.LEFT, margen_x=0.15)
        y += 0.82
    base._banda(slide, xd, y + 0.20, wd, 0.62, "ÍNDICE DE HOJAS", size=10.5)
    y += 0.82
    alto = min(0.80, (Y1 - 0.25 - y) / max(1, len(indice)))
    if alto < 0.50:      # a 9,5 pt un renglon necesita medio centimetro: mas bajo, el texto se sale
        raise ValueError(f"la portada no tiene lugar para {len(indice)} renglones de indice "
                         f"({alto:.2f} cm cada uno): partir el juego o acortar la ficha")
    for numero, nombre in indice:
        # "OP 20.1" y no "20.1" pelado: el control duro toma un numero suelto por el de la hoja
        base._celda(slide, xd, y, 2.40, alto, f"OP {numero}", size=9.5, bold=True)
        base._celda(slide, xd + 2.40, y, wd - 2.40, alto, nombre, size=9.5, bold=False,
                    align=PP_ALIGN.LEFT, margen_x=0.15)
        y += alto
    return slide
