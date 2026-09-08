# -*- coding: utf-8 -*-
"""Gate de las hojas de proceso: falla si una hoja no cumple los criterios de imagen.

Existe por el incidente del 03/09/2026: en la hoja 20.2 la imagen mas grande era una mano
con un CELULAR, y la tabla de parametros del fusor —lo que el paso manda verificar— era la
mas chica. Y midiendo despues salio algo peor: **ninguna de las 7 pantallas redibujadas se
leia impresa** (2,3 a 4,5 pt, contra 7 pt que es lo mas chico que Barack pone en estas hojas).

La causa era que el repartidor de imagenes maximiza la SUMA DE AREAS y no sabe cual importa.
Este chequeo le pone los umbrales que le faltaban:

  1. cada hoja declara su imagen PRINCIPAL, y es la mas grande de la hoja
  2. lo que hay que leer, se lee: cuerpo impreso >= 7 pt
  3. 2 o 3 imagenes por hoja, nunca 4
  4. ningun texto se sale de su caja  (absorbe el viejo _overflow.py)

Mide reusando las primitivas de `hoja_pptx.py`, no reimplementandolas: si cambia el motor de
layout, el chequeo cambia con el.

    _hojaProcesoCheck.py <archivo.pptx> [--spec <modulo>]

Sale con codigo 1 si hay alguna infraccion. `armar_deck.py` lo corre antes de guardar.
"""
import argparse
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from pptx import Presentation  # noqa: E402

import hoja_pptx as HP  # noqa: E402
import metrica_pantalla as MP  # noqa: E402

# ── umbrales (los criterios acordados con Fak el 03/09/2026) ─────────────────
# La fraccion se mide sobre la superficie de FOTO de la hoja, no sobre el bloque.
# Correccion del 03/09/2026: primero puse "45% del bloque" y 13 de 17 hojas lo violaban sin
# tener nada malo — una foto vertical 9:16 a la altura completa del bloque ocupa 32% y no
# hay forma de que ocupe mas. El umbral era imposible de cumplir para media biblioteca de
# fotos. Sobre la tinta el criterio si discrimina: la 20.2 con el celular daba 19%.
PRINCIPAL_MIN = 0.45      # la principal es al menos el 45% de la superficie de foto
PRINCIPAL_MIN_BLOQUE = 0.25   # y nunca una estampilla: 1/4 del bloque como piso
PRINCIPAL_VENTAJA = 1.6   # y al menos 1,6 veces el area de la segunda
CUERPO_MIN_PT = 7.0       # cuerpo impreso minimo de lo que hay que leer
ANCHO_MIN_LEER_CM = 7.0   # para una FOTO marcada `leer` (no lleva metrica adentro)
IMAGENES_MAX = 3

BLOQUE_CM2 = HP.IMG_W * (HP.BODY_H - 0.60)


def es_contenido(sh):
    """Logo e iconos de EPP no son imagenes de contenido: se reconocen por donde estan."""
    if sh.shape_type != 13:
        return False
    x, y = sh.left / 360000.0, sh.top / 360000.0
    if y < 4.5:                                       # cajetin (logo)
        return False
    if x > 17.0 and sh.width / 360000.0 < 2.5:        # banda de EPP
        return False
    return True


def texto_no_entra(sh):
    """El viejo _overflow: cuanto pide el texto contra el alto que tiene la caja."""
    tf = sh.text_frame
    w, h = sh.width / 360000.0, sh.height / 360000.0
    alto = 0.0
    for p in tf.paragraphs:
        texto = "".join(r.text for r in p.runs)
        if not texto.strip():
            continue
        # el run 0 de un paso es el numero "1.  " y va en NEGRITA: medir todo el parrafo
        # en negrita infla el ancho y da un falso positivo.
        r0 = max(p.runs, key=lambda r: len(r.text))
        size = r0.font.size.pt if r0.font.size else 11
        ml = tf.margin_left / 360000.0 if tf.margin_left else 0
        util = w - 2 * ml - 0.24
        if util < 0.3:
            continue
        alto += HP._lineas_wrap(texto, size, util, bool(r0.font.bold)) * 1.22 * size * HP.PT_CM
        if p.space_after:
            alto += p.space_after.pt * HP.PT_CM
        if p.space_before:
            alto += p.space_before.pt * HP.PT_CM
    mt = tf.margin_top / 360000.0 if tf.margin_top else 0
    return alto - (h - mt + 0.02) if alto > h - mt + 0.02 else None


def revisar(ruta, spec=None):
    """Devuelve la lista de infracciones. Vacia = pasa."""
    declara = {}
    if spec:
        declara = {h["op"]: h for h in spec.HOJAS}

    prs = Presentation(ruta)
    fallas = []

    for i, s in enumerate(prs.slides):
        op = None
        for sh in s.shapes:
            if sh.has_text_frame and re.fullmatch(r"20\.\d+", sh.text_frame.text.strip()):
                op = sh.text_frame.text.strip()
                break

        # ── textos que se salen de su caja (todas las laminas, portada incluida)
        for sh in s.shapes:
            if not sh.has_text_frame or not sh.text_frame.text.strip():
                continue
            sobra = texto_no_entra(sh)
            if sobra:
                fallas.append((i + 1, op or "portada", "texto",
                               "un texto pide %.2f cm mas de los que tiene la caja: %r"
                               % (sobra, sh.text_frame.text.strip()[:52])))

        if not op:
            continue

        fotos = sorted([sh for sh in s.shapes if es_contenido(sh)],
                       key=lambda q: -(q.width * q.height))
        if not fotos:
            continue                                   # recuadro vacio: permitido

        # ── criterio 3: cuantas
        if len(fotos) > IMAGENES_MAX:
            fallas.append((i + 1, op, "cantidad",
                           "tiene %d imagenes; el maximo es %d" % (len(fotos), IMAGENES_MAX)))

        areas = [(sh.width / 360000.0) * (sh.height / 360000.0) for sh in fotos]

        # ── criterio 2: lo que hay que leer, se lee
        h = declara.get(op, {})
        leer = set(h.get("leer", []))
        for k, sh in enumerate(fotos):
            ancho = sh.width / 360000.0
            pt = MP.cuerpo_impreso_pt(sh.image.blob, ancho)
            if pt is not None:
                if pt < CUERPO_MIN_PT:
                    m = MP.metrica(sh.image.blob) or {}
                    fallas.append((i + 1, op, "no se lee",
                                   "%s: %.1f pt impreso a %.1f cm (minimo %.0f pt; "
                                   "necesita %.1f cm o menos campos)"
                                   % (m.get("que_es", "una pantalla"), pt, ancho,
                                      CUERPO_MIN_PT,
                                      MP.ancho_minimo_cm(m["cuerpo_px"], m["ancho_px"]))))
            elif k in leer and ancho < ANCHO_MIN_LEER_CM:
                fallas.append((i + 1, op, "no se lee",
                               "la imagen %d esta marcada `leer` y mide %.1f cm (minimo %.0f)"
                               % (k + 1, ancho, ANCHO_MIN_LEER_CM)))

        # ── criterio 1: jerarquia
        if "principal" not in h:
            fallas.append((i + 1, op, "sin jerarquia",
                           "la hoja no declara cual es su imagen principal"))
            continue
        idx = h["principal"]
        # `fotos` esta ordenada por area; hay que ubicar la principal por su posicion
        # original, que es el orden en que el generador las coloco (arriba-izq a abajo-der)
        por_lugar = sorted([sh for sh in s.shapes if es_contenido(sh)],
                           key=lambda q: (round(q.top / 360000., 1), round(q.left / 360000., 1)))
        if idx >= len(por_lugar):
            fallas.append((i + 1, op, "sin jerarquia",
                           "declara principal=%d pero la lamina tiene %d imagenes"
                           % (idx, len(por_lugar))))
            continue
        pr = por_lugar[idx]
        area_pr = (pr.width / 360000.0) * (pr.height / 360000.0)
        tinta = sum((x.width / 360000.0) * (x.height / 360000.0) for x in por_lugar)
        frac = area_pr / tinta if tinta else 0.0
        frac_bloque = area_pr / BLOQUE_CM2
        segunda = max([a for sh, a in zip(por_lugar, [(x.width / 360000.0) * (x.height / 360000.0)
                                                      for x in por_lugar]) if sh is not pr] or [0])
        if frac < PRINCIPAL_MIN:
            fallas.append((i + 1, op, "jerarquia",
                           "la principal es el %.0f%% de la foto de la hoja (minimo %.0f%%)"
                           % (frac * 100, PRINCIPAL_MIN * 100)))
        if frac_bloque < PRINCIPAL_MIN_BLOQUE:
            fallas.append((i + 1, op, "jerarquia",
                           "la principal ocupa %.0f%% del bloque (minimo %.0f%%): queda chica"
                           % (frac_bloque * 100, PRINCIPAL_MIN_BLOQUE * 100)))
        if segunda and area_pr < segunda * PRINCIPAL_VENTAJA:
            fallas.append((i + 1, op, "jerarquia",
                           "la principal (%.1f cm2) no le saca %.1fx a la segunda (%.1f cm2)"
                           % (area_pr, PRINCIPAL_VENTAJA, segunda)))
    return fallas


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pptx")
    ap.add_argument("--spec", default="hojas_spec",
                    help="modulo con HOJAS (por defecto hojas_spec)")
    a = ap.parse_args()

    spec = None
    try:
        spec = __import__(a.spec)
    except Exception as e:
        print("aviso: no pude leer el spec %r (%s). Se chequea solo lo que se ve en el pptx."
              % (a.spec, e))

    fallas = revisar(a.pptx, spec)
    if not fallas:
        print("hojas de proceso: PASA. Jerarquia, legibilidad, cantidad y textos, todo en regla.")
        return 0

    print("HOJAS DE PROCESO — %d infraccion(es)\n" % len(fallas))
    ancho = max(len(f[2]) for f in fallas)
    for lam, op, tipo, det in fallas:
        print("  lam %-2d  %-6s  %-*s  %s" % (lam, op, ancho, tipo, det))
    print("\nCriterios: la principal >= %.0f%% del bloque y %.1fx la segunda · lo que hay que "
          "leer >= %.0f pt impreso · maximo %d imagenes."
          % (PRINCIPAL_MIN * 100, PRINCIPAL_VENTAJA, CUERPO_MIN_PT, IMAGENES_MAX))
    return 1


if __name__ == "__main__":
    sys.exit(main())
