# -*- coding: utf-8 -*-
"""Gate de las hojas de proceso: sale con codigo 1 si una hoja no cumple los criterios.

Existe por el incidente del 03/09/2026, maquina HOTMELT. Fak miro la lamina 3 y pregunto
"un celular se ve mucho mas grande que una hoja con parametros, que clase de criterio estas
aplicando". Midiendo las 17 hojas salieron DOS problemas, no uno:

  · en 11 de 17, las tres imagenes tenian exactamente el mismo tamaño: no habia jerarquia
  · **ninguna de las 7 pantallas redibujadas se leia impresa**: 2,3 a 4,5 pt contra 7 de
    minimo. Yo las habia dado por buenas mirandolas ampliadas en el monitor.

Lo que chequea, con los umbrales de `hojalib`:

  1. la hoja declara COMO se miran sus fotos, en uno de los dos modos:
       · jerarquia — declara su imagen PRINCIPAL, y esa es la mas grande
       · secuencia — cada foto es un paso: lleva su NUMERO encima, ninguna es una
         estampilla y ninguna dobla a otra (si una manda, entonces hay jerarquia)
  2. lo que hay que leer, se lee: cuerpo impreso >= 7 pt
  3. como maximo 3 imagenes por hoja (4 en secuencia; con mas, la hoja se PARTE)
  4. ningun texto se sale de su caja

El N° de operacion se lee de la celda del cajetin debajo de "N° DE OPERACIÓN" (ver
`numero_de_operacion`): con cajetin y la celda vacia, la hoja da rojo en vez de saltearse.

    hoja_proceso_check.py <archivo.pptx> [--spec <modulo>] [--jerarquia op=idx,...]

`--spec` es un modulo python con una lista HOJAS de dicts {op, principal, leer, secuencia}.
Vive fuera del repo cuando trae datos de la maquina (contraseñas de HMI, part numbers del
cliente). `--jerarquia` es el atajo para chequear sin spec: 20.2=0,20.4=0
"""
import argparse
import os
import re
import sys
import unicodedata

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from pptx import Presentation  # noqa: E402

import hojalib as HL  # noqa: E402
import redaccion as RED

EMU = 360000.0


def es_contenido(sh):
    """Logo e iconos de EPP no son imagenes de contenido: se reconocen por donde estan."""
    if sh.shape_type != 13:
        return False
    x, y = sh.left / EMU, sh.top / EMU
    if y < HL.BODY_Y - 0.4:                            # cajetin (logo)
        return False
    if x > 17.0 and sh.width / EMU < 2.5:              # banda de EPP
        return False
    return True


def numeros_sueltos(s):
    """Centros (x, y) en cm de los circulos con un numero adentro: los badges de paso."""
    out = []
    for sh in s.shapes:
        if sh.shape_type != 1 or not sh.has_text_frame:      # 1 = AUTO_SHAPE
            continue
        if not sh.text_frame.text.strip().isdigit():
            continue
        out.append(((sh.left + sh.width / 2) / EMU, (sh.top + sh.height / 2) / EMU))
    return out


_ETIQUETA_OP = re.compile(r"N\S{0,3}\s*DE\s+OPERACION")    # "N° DE OPERACIÓN", "Nº de..."
_OP_SUELTO = re.compile(r"(\d+|TBD)\.\d+")                   # "20.1", "TBD.1"


def _normal(texto):
    """Mayusculas, sin tildes y con un espacio entre palabras."""
    t = unicodedata.normalize("NFKD", texto)
    t = "".join(c for c in t if not unicodedata.combining(c))
    return " ".join(t.upper().split())


def numero_de_operacion(s):
    """(op, tiene_cajetin) de una lamina. op es None si no se puede leer.

    El N° se lee de la celda que esta JUSTO DEBAJO de la etiqueta "N° DE OPERACIÓN" del
    cajetin, por posicion. Hasta el 24/09/2026 se buscaba por regex "NN.N" en cualquier
    texto, y las hojas de la IMG renumeradas a "31".."37" quedaban sin operacion: el gate
    salteaba todo el chequeo de imagenes y daba PASA. Un regex que aceptara "31" suelto
    tampoco sirve: los numeros de paso ("1", "2") tambien son solo digitos.

    Sin la etiqueta (un deck viejo, o el selftest) vale el N° suelto "20.1" o "TBD.1"
    ("TBD": la operacion todavia no tiene numero en un flujograma, prensa de embossing).
    """
    con_texto = [sh for sh in s.shapes if sh.has_text_frame]
    etiquetas = [sh for sh in con_texto if _ETIQUETA_OP.fullmatch(_normal(sh.text_frame.text))]
    ubicadas = [sh for sh in con_texto if None not in (sh.left, sh.top, sh.height)]
    for et in etiquetas:
        if None in (et.left, et.top, et.height):  # sin posicion propia no hay "debajo"
            continue
        abajo = et.top + et.height
        celdas = [sh for sh in ubicadas if sh.shape_id != et.shape_id
                  and abs(sh.left - et.left) < 0.3 * EMU and abs(sh.top - abajo) < 0.3 * EMU]
        for sh in sorted(celdas, key=lambda q: abs(q.top - abajo)):
            texto = " ".join(sh.text_frame.text.split())
            if texto:
                return texto, True
    if etiquetas:                 # con cajetin manda la celda: vacia es vacia, no se adivina
        return None, True
    for sh in con_texto:
        if _OP_SUELTO.fullmatch(sh.text_frame.text.strip()):
            return sh.text_frame.text.strip(), False
    return None, False


def texto_no_entra(sh):
    """Cuanto mas alto pide el texto que lo que la caja le da. None si entra."""
    tf = sh.text_frame
    w, h = sh.width / EMU, sh.height / EMU
    alto = 0.0
    for p in tf.paragraphs:
        texto = "".join(r.text for r in p.runs)
        if not texto.strip():
            continue
        # el run 0 de un paso es el numero "1. " y va en NEGRITA: medir el parrafo entero
        # en negrita infla el ancho y da un falso positivo.
        r0 = max(p.runs, key=lambda r: len(r.text))
        size = r0.font.size.pt if r0.font.size else 11
        ml = tf.margin_left / EMU if tf.margin_left else 0
        util = w - 2 * ml - 0.24
        if util < 0.3:
            continue
        alto += HL.lineas_wrap(texto, size, util, bool(r0.font.bold)) * 1.22 * size * HL.PT_CM
        if p.space_after:
            alto += p.space_after.pt * HL.PT_CM
        if p.space_before:
            alto += p.space_before.pt * HL.PT_CM
    mt = tf.margin_top / EMU if tf.margin_top else 0
    return alto - (h - mt + 0.02) if alto > h - mt + 0.02 else None


def revisar(ruta, declara=None):
    """Lista de infracciones (lamina, op, tipo, detalle). Vacia = pasa.

    `declara` es {op: {"principal": i, "leer": [i, ...]}}, o {op: [{...}, {...}]} cuando la
    operacion esta partida en varias hojas, en el orden del deck.
    """
    declara = declara or {}
    prs = Presentation(ruta)
    _, alto_bloque = HL.bloque_cm()
    bloque_cm2 = HL.IMG_W * alto_bloque
    fallas = []
    vistas = {}                                        # laminas ya recorridas de cada op

    for i, s in enumerate(prs.slides):
        op, con_cajetin = numero_de_operacion(s)
        quien = op or ("sin N°" if con_cajetin else "portada")

        for sh in s.shapes:                            # criterio 4, en TODAS las laminas
            if not sh.has_text_frame or not sh.text_frame.text.strip():
                continue
            sobra = texto_no_entra(sh)
            if sobra:
                fallas.append((i + 1, quien, "texto",
                               "un texto pide %.2f cm mas de los que tiene la caja: %r"
                               % (sobra, sh.text_frame.text.strip()[:52])))
            # el castellano de planta se chequea sobre el ARCHIVO ENTREGADO, no sobre el
            # generador: asi lo caza venga de donde venga el texto (canon 3.2)
            for hallado, reemplazo, _motivo, _fuente in RED.revisar_vocabulario(
                    sh.text_frame.text):
                fallas.append((i + 1, quien, "vocabulario",
                               "dice %r y aca se dice %r" % (hallado, reemplazo)))
            # la cocina interna tambien se mira sobre el ARCHIVO ENTREGADO: el 21/09 este
            # gate dio PASA sobre un deck con la nota "no esta documentado... preguntar
            # antes", porque la lista vivia solo adentro del generador
            for hallado, que in RED.revisar_cocina(sh.text_frame.text):
                fallas.append((i + 1, quien, "cocina",
                               "dice %s (%r): eso va a la bitacora, no a la hoja"
                               % (que, hallado)))
        if not op:
            # una hoja CON cajetin y sin numero no se saltea callada: sin op no se sabe
            # que declara, y el chequeo de imagenes no corre
            if con_cajetin:
                fallas.append((i + 1, quien, "sin operacion",
                               "la celda de N° DE OPERACIÓN esta vacia: sin el numero no "
                               "se chequean las imagenes de la hoja"))
            continue

        h = declara.get(op, {})
        if isinstance(h, list):
            # una operacion partida ("HOJA 1 DE 2") repite el N° y cada hoja trae su
            # declaracion: la n-esima lamina de la op usa la n-esima. Con un dict por op, la
            # 41 del cambio de molde (secuencia + rotulada) se juzgaba entera como rotulada
            n = vistas.get(op, 0)
            vistas[op] = n + 1
            h = h[min(n, len(h) - 1)] if h else {}

        fotos = sorted([sh for sh in s.shapes if es_contenido(sh)],
                       key=lambda q: (round(q.top / EMU, 1), round(q.left / EMU, 1)))
        if not fotos:
            continue                                   # recuadro vacio: permitido

        sec = bool(h.get("secuencia"))
        tope = HL.SECUENCIA_MAX if sec else HL.IMAGENES_MAX
        if len(fotos) > tope:                          # criterio 3
            fallas.append((i + 1, op, "cantidad",
                           "tiene %d imagenes; el maximo es %d%s"
                           % (len(fotos), tope, " (en secuencia se PARTE la hoja)" if sec
                              else "")))

        leer = set(h.get("leer", []))
        for k, sh in enumerate(fotos):                 # criterio 2
            ancho = sh.width / EMU
            pt = HL.cuerpo_impreso_pt(sh.image.blob, ancho)
            if pt is not None:
                if pt < HL.CUERPO_MIN_PT - HL.TOLERANCIA_PT:
                    m = HL.metrica(sh.image.blob) or {}
                    fallas.append((i + 1, op, "no se lee",
                                   "%s: %.1f pt impreso a %.1f cm (minimo %.0f; necesita "
                                   "%.1f cm de ancho, o menos campos)"
                                   % (m.get("que_es", "una pantalla"), pt, ancho,
                                      HL.CUERPO_MIN_PT,
                                      HL.ancho_minimo_cm(m["cuerpo_px"], m["ancho_px"]))))
            elif k in leer and ancho < HL.ANCHO_MIN_LEER_CM:
                fallas.append((i + 1, op, "no se lee",
                               "la imagen %d esta marcada `leer` y mide %.1f cm (minimo %.0f)"
                               % (k + 1, ancho, HL.ANCHO_MIN_LEER_CM)))

        if sec:                                        # criterio 1, modo SECUENCIA
            badges = numeros_sueltos(s)
            areas = [(x.width / EMU) * (x.height / EMU) for x in fotos]
            for k, sh in enumerate(fotos):
                x, y = sh.left / EMU, sh.top / EMU
                w, hh = sh.width / EMU, sh.height / EMU
                if not any(abs(bx - x) < 1.0 and abs(by - y) < 1.0 for bx, by in badges):
                    fallas.append((i + 1, op, "sin numero",
                                   "la imagen %d no tiene el numero del paso: nadie sabe a "
                                   "cual mirar" % (k + 1)))
                if areas[k] < HL.SECUENCIA_AREA_MIN or min(w, hh) < HL.SECUENCIA_LADO_MIN:
                    fallas.append((i + 1, op, "estampilla",
                                   "la imagen %d mide %.1f x %.1f cm = %.0f cm2 (minimo "
                                   "%.0f cm2 y %.1f cm de lado): se parte la hoja"
                                   % (k + 1, w, hh, areas[k], HL.SECUENCIA_AREA_MIN,
                                      HL.SECUENCIA_LADO_MIN)))
            if areas and min(areas) and max(areas) / min(areas) > HL.SECUENCIA_DISPARIDAD:
                fallas.append((i + 1, op, "despareja",
                               "la mayor (%.0f cm2) le saca %.1fx a la menor (%.0f cm2): si "
                               "una manda, se declara `principal`; si no, van con la misma "
                               "proporcion" % (max(areas), max(areas) / min(areas),
                                               min(areas))))
            continue

        if "principal" not in h:                       # criterio 1
            fallas.append((i + 1, op, "sin jerarquia",
                           "la hoja no declara cual es su imagen principal ni se declara "
                           "`secuencia`"))
            continue
        idx = h["principal"]
        if not (0 <= idx < len(fotos)):
            fallas.append((i + 1, op, "sin jerarquia",
                           "declara principal=%s y la lamina tiene %d imagenes"
                           % (idx, len(fotos))))
            continue
        areas = [(x.width / EMU) * (x.height / EMU) for x in fotos]
        area_pr, tinta = areas[idx], sum(areas)
        segunda = max([a for k, a in enumerate(areas) if k != idx] or [0])
        if tinta and area_pr / tinta < HL.PRINCIPAL_MIN:
            fallas.append((i + 1, op, "jerarquia",
                           "la principal es el %.0f%% de la foto de la hoja (minimo %.0f%%)"
                           % (area_pr / tinta * 100, HL.PRINCIPAL_MIN * 100)))
        if area_pr / bloque_cm2 < HL.PRINCIPAL_MIN_BLOQUE:
            fallas.append((i + 1, op, "jerarquia",
                           "la principal ocupa %.0f%% del bloque (minimo %.0f%%): queda chica"
                           % (area_pr / bloque_cm2 * 100, HL.PRINCIPAL_MIN_BLOQUE * 100)))
        if segunda and area_pr < segunda * HL.PRINCIPAL_VENTAJA:
            fallas.append((i + 1, op, "jerarquia",
                           "la principal (%.1f cm2) no le saca %.1fx a la segunda (%.1f cm2)"
                           % (area_pr, HL.PRINCIPAL_VENTAJA, segunda)))
    return fallas


def declaraciones(hojas):
    """{op: [declaracion, ...]} desde la lista HOJAS de un spec, en el orden del deck: una
    operacion partida repite el op y cada hoja conserva la suya (ver `revisar`)."""
    declara = {}
    for h in hojas:
        declara.setdefault(h["op"], []).append(h)
    return declara


def informe(fallas):
    if not fallas:
        return "hojas de proceso: PASA. Jerarquia, legibilidad, cantidad y textos, en regla."
    out = ["HOJAS DE PROCESO — %d infraccion(es)" % len(fallas), ""]
    ancho = max(len(f[2]) for f in fallas)
    for lam, op, tipo, det in fallas:
        out.append("  lam %-2d  %-6s  %-*s  %s" % (lam, op, ancho, tipo, det))
    out += ["", "Criterios: jerarquia — la principal >= %.0f%% de la foto de la hoja y %.1fx "
            "la segunda · secuencia — cada foto con su numero, >= %.0f cm2, y ninguna %.1fx "
            "otra · lo que hay que leer >= %.0f pt impreso · maximo %d imagenes (%d en "
            "secuencia)."
            % (HL.PRINCIPAL_MIN * 100, HL.PRINCIPAL_VENTAJA, HL.SECUENCIA_AREA_MIN,
               HL.SECUENCIA_DISPARIDAD, HL.CUERPO_MIN_PT, HL.IMAGENES_MAX, HL.SECUENCIA_MAX)]
    return "\n".join(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pptx")
    ap.add_argument("--spec", help="modulo con HOJAS = [{op, principal, leer}, ...]")
    ap.add_argument("--jerarquia", help="atajo sin spec, por ejemplo 20.2=0,20.4=0")
    a = ap.parse_args()

    declara = {}
    if a.spec:
        sys.path.insert(0, os.path.dirname(os.path.abspath(a.spec)) or os.getcwd())
        mod = __import__(os.path.splitext(os.path.basename(a.spec))[0])
        declara = declaraciones(mod.HOJAS)
    if a.jerarquia:
        for par in a.jerarquia.split(","):
            op, _, idx = par.partition("=")
            for h in declara.setdefault(op.strip(), [{}]):
                h["principal"] = int(idx)

    fallas = revisar(a.pptx, declara)
    print(informe(fallas))
    return 1 if fallas else 0


if __name__ == "__main__":
    sys.exit(main())
