# -*- coding: utf-8 -*-
"""Corrige el texto de UNA hoja del PPTX que ya existe, sin regenerar el deck.

Se usa porque el deck lo edita Fak: regenerarlo le borraria lo suyo (ya le saco una foto
a la 20.5). Esto abre el archivo que hay, reescribe SOLO el bloque de descripcion de las
hojas indicadas, y deja todo lo demas intacto — incluidas las imagenes.

Antes de escribir: resguardo. Despues de escribir: se verifica que el texto de las OTRAS
laminas no se movio ni una coma.

  corregir_texto.py --pptx <ruta> [--dry-run]
"""
import argparse, difflib, os, shutil, sys
from datetime import datetime
from pptx import Presentation
from pptx.util import Pt

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hoja_pptx as HP
from hojas_spec import HOJAS

HOJAS_A_CORREGIR = ["20.2", "20.3"]
SPEC = {h["op"]: h for h in HOJAS}


def texto_completo(prs):
    out = []
    for s in prs.slides:
        cajas = sorted([(round(sh.top / 360000., 1), round(sh.left / 360000., 1),
                         sh.text_frame.text.strip())
                        for sh in s.shapes if sh.has_text_frame and sh.text_frame.text.strip()])
        out.append("\n".join(t for _, _, t in cajas))
    return out


def caja_descripcion(slide):
    """El bloque DESCRIPCION DE LA OPERACION: el marco de texto de la derecha."""
    for sh in slide.shapes:
        if not sh.has_text_frame:
            continue
        x, y = sh.left / 360000.0, sh.top / 360000.0
        if x > 16 and 5 < y < 15 and sh.height / 360000.0 > 5:
            return sh
    return None


def reescribir(sh, pasos, nota):
    """Rehace el contenido con el mismo formato que `bloque_pasos` del generador."""
    tf = sh.text_frame
    for p in list(tf.paragraphs)[1:]:
        p._element.getparent().remove(p._element)
    tf.paragraphs[0].clear()

    util_w = HP.DSC_W - 2 * 0.25 - 0.75
    util_h = (HP.BODY_H - 0.60) - 0.35
    size = 13
    while size > 7.5:
        lh = 1.22 * size * HP.PT_CM
        sep = (7 if size >= 11 else 5) * HP.PT_CM
        alto = sum(HP._lineas_wrap(t, size, util_w, False) * lh + sep for t in pasos)
        if nota:
            sn = max(size - 1, 8)
            alto += (HP._lineas_wrap(nota, sn, HP.DSC_W - 0.5, True) * 1.22 * sn * HP.PT_CM
                     + 6 * HP.PT_CM)
        if alto <= util_h:
            break
        size -= 0.5

    for i, texto in enumerate(pasos):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = HP.PP_ALIGN.LEFT
        p.space_after = Pt(7 if size >= 11 else 5)
        r = p.add_run(); r.text = "%d.  " % (i + 1)
        r.font.size = Pt(size); r.font.bold = True
        r.font.name = "Calibri"; r.font.color.rgb = HP.NEGRO
        r = p.add_run(); r.text = texto
        r.font.size = Pt(size); r.font.name = "Calibri"; r.font.color.rgb = HP.NEGRO
    if nota:
        p = tf.add_paragraph(); p.alignment = HP.PP_ALIGN.LEFT
        p.space_before = Pt(6)
        r = p.add_run(); r.text = nota
        r.font.size = Pt(max(size - 1, 8)); r.font.bold = True
        r.font.name = "Calibri"; r.font.color.rgb = HP.AZUL
    return size


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pptx", required=True)
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    prs = Presentation(a.pptx)
    antes = texto_completo(prs)

    objetivo = []
    for i, s in enumerate(prs.slides):
        for sh in s.shapes:
            if sh.has_text_frame and sh.text_frame.text.strip() in HOJAS_A_CORREGIR:
                objetivo.append((i, s, sh.text_frame.text.strip()))
                break
    if len(objetivo) != len(HOJAS_A_CORREGIR):
        sys.exit("esperaba %d hojas y encontre %d" % (len(HOJAS_A_CORREGIR), len(objetivo)))

    print("--- PLAN ---")
    for i, s, op in objetivo:
        caja = caja_descripcion(s)
        if caja is None:
            sys.exit("hoja %s: no encontre el bloque de descripcion" % op)
        h = SPEC[op]
        print("\nlamina %d  hoja %s" % (i + 1, op))
        for l in difflib.unified_diff(
                caja.text_frame.text.strip().split("\n"),
                ["%d.  %s" % (k + 1, t) for k, t in enumerate(h["pasos"])] +
                ([h["nota"]] if h.get("nota") else []),
                "ahora", "queda", lineterm="", n=0):
            if not l.startswith(("---", "+++", "@@")):
                print("   " + l)
    print("\nlaminas que se tocan: %d de %d" % (len(objetivo), len(antes)))
    if a.dry_run:
        print("DRY-RUN: no se toco nada.")
        return

    res = os.path.join(os.path.dirname(a.pptx),
                       "_resguardo texto %s.pptx" % datetime.now().strftime("%Y-%m-%d %H%M"))
    shutil.copy2(a.pptx, res)
    print("\nresguardo:", os.path.basename(res))

    tocadas = set()
    for i, s, op in objetivo:
        h = SPEC[op]
        cuerpo = reescribir(caja_descripcion(s), h["pasos"], h.get("nota"))
        tocadas.add(i)
        print("lamina %d (%s) reescrita, cuerpo %.1f pt" % (i + 1, op, cuerpo))
    prs.save(a.pptx)

    despues = texto_completo(Presentation(a.pptx))
    intrusos = [k + 1 for k, (x, y) in enumerate(zip(antes, despues))
                if x != y and k not in tocadas]
    if intrusos:
        sys.exit("ABORTAR: cambio texto en laminas que no tocaba: %s" % intrusos)
    print("las otras %d laminas: texto intacto." % (len(antes) - len(tocadas)))


main()
