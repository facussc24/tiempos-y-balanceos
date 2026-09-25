# -*- coding: utf-8 -*-
"""
Hojas de proceso del APB P21 HILO NARANJA COSTURA SIMPLE (MY2026, SMRC) en el formato
PowerPoint nuevo (el de la moldeadora IMG, skill `hojas-de-proceso`).

Numeracion y nombres: FLUJOGRAMA 159 Rev.A. Los pasos salen de la HO 927 REV6 (la hoja de
serie del P21: misma pieza, mismos puestos) y la costura vista del LSC v1 del cliente
(SC 2.1 a 2.5), que es lo unico que cambia (ECR-0368291). Cada paso cita su fuente.

Fotos: las de la HO 927 donde NO se reconoce otra version de la pieza. Una por paso; el paso
que no tiene foto queda con su recuadro vacio y su numero (lista para sacar en planta).
La INSPECCION FINAL / MURO DE CALIDAD (OP 100) no va: la hoja de inspeccion es de Calidad
(CRITERIOS_HOJAS_DE_PROCESO 1.1). El ciclo de control va vacio (1.2).

    py -3 scripts/p21/generar_hojas_p21.py [--salida <carpeta>]
"""
import os
import sys
import argparse
import importlib.util

from pptx import Presentation
from pptx.util import Cm, Pt

AQUI = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location(
    "gen_img", os.path.join(AQUI, "..", "img", "generar_hojas_img.py"))
g = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(g)

A = os.path.join(AQUI, "assets_ho927")


def _f(n):
    return os.path.join(A, n) if n else None


ICO_RESPIRADOR = os.path.join(A, "ico_image17.png")   # de la HO 927 (hojas 70 y 80.x)
EPP_COSTURA = [g.ICO_ROPA, g.ICO_CALZADO, g.ICO_GUANTES, g.ICO_AUDITIVA]      # HO 927 hoja 40
EPP_LIMPIEZA = [g.ICO_ROPA, g.ICO_CALZADO, g.ICO_GUANTES]                     # HO 927 hoja 60
EPP_QUIMICOS = [g.ICO_ROPA, g.ICO_CALZADO, g.ICO_GUANTES, ICO_RESPIRADOR]     # HO 927 hoja 70
EPP_ADHESIVO = [g.ICO_ROPA, g.ICO_CALZADO, g.ICO_GUANTES, ICO_RESPIRADOR,
                g.ICO_ANTEOJOS]                                               # HO 927 80.1/80.2
EPP_TAPIZADO = [g.ICO_ROPA, g.ICO_CALZADO, g.ICO_GUANTES]                     # HO 927 90.x/100

CAJETIN = dict(
    titulo_hoja="HOJA DE OPERACIONES",
    ho="HO-991",
    form="I-IN-002.4-R01",
    modelo="P21",
    cliente="SMRC",
    pieza="00257327-01-NHZD RH / 00257328-01-NHZD LH — APB P21 HILO NARANJA",
    puesto="-",
    realizo="F. Santoro",
    aprobo="",          # lo firma Carlos cuando la apruebe (skill hojas-de-proceso §4)
    fecha="24/09/2026",
    rev="A",
)

PORTADA = dict(
    titulo="HOJAS DE PROCESO — APB P21 HILO NARANJA",
    subtitulo="Apoyabrazos delantero P21, costura simple · FLUJOGRAMA 159 Rev.A",
    ho="HO-991",
    form="I-IN-002.4-R01",
    op_flujo="30 a 110 — refilado, costura, adhesivado, horno, tapizado, troquelado y embalaje",
    cliente_modelo="SMRC / STELLANTIS — P21",
    pieza="00257327-01-NHZD RH / 00257328-01-NHZD LH",
    maquina="Costura, tapizado y troquelado",
    firmas="F. Santoro / C. Baptista",
    fecha_rev="24/09/2026  ·  Rev. A",
)

H927 = "HO 927 REV6 (APB P21 serie)"

# Donde se entrega (skill hojas-de-proceso §3 bis): al lado de la HO 927.
DESTINO = r"Y:\BARACK\CALIDAD\DOCUMENTACION SGC\HOJAS DE OPERACIONES\1- CLIENTES\REYDEL-SMRC\APB P21\HO 991 - APB P21 HILO NARANJA"

HOJAS = [
    dict(op="30", sector="COSTURA", denominacion="REFILADO DE COMPONENTES CORTADOS",
         imagenes=[_f("ho927_30_1.jpg"), None, None],
         pasos=[
             "Tomar las piezas de vinilo cortadas y apoyarlas en la mesa con la cara vista "
             "hacia arriba.",
             "Apoyar la pieza en el pie de la máquina contra la guía de referencia y refilar "
             "de A a B.",
             "Hacer el autocontrol y sellar con el legajo cerca del refilado.",
         ],
         parametros=[("Toma de refilado", "6,0 a 6,5 mm"), ("Máquina", "refiladora")],
         fuentes=[f"{H927}, hoja 30, pasos 1 y 2",
                  f"{H927}, hoja 30, pasos 3 y 4; ciclo: toma de refilado 6,5 mm -0,5",
                  f"{H927}, hoja 30, paso 5"],
         epp=EPP_COSTURA),

    dict(op="40", sector="COSTURA", denominacion="COSTURA DE UNIÓN",
         imagenes=[_f("ho927_40_1.jpg"), None, None],
         pasos=[
             "Tomar las dos piezas a coser, enfrentarlas por la cara vista y apoyarlas en el "
             "pie de la máquina contra la guía de referencia.",
             "Coser de A a B, con atraque al inicio y al final.",
             "Cortar los hilos, hacer el autocontrol y sellar con el legajo cerca de la costura.",
         ],
         parametros=[("Hilo de unión", "Linhanyl BX69 11527E negro (M40)"),
                     ("Máquina", "recta simple aguja triple arrastre"),
                     ("Largo de puntada", "2,5 mm -0/+1 (7 a 8 puntadas cada 20 mm)"),
                     ("Toma de costura", "6,0 a 6,5 mm"),
                     ("Aguja", "110 a 130 Nm / N° 18"),
                     ("Puntos de atraque", "2 a 3 como máximo"),
                     ("Desalineamiento", "máx. 2 mm entre bordes y entre referencias")],
         fuentes=[f"{H927}, hoja 40, pasos 1 a 3",
                  f"{H927}, hoja 40, pasos 4 a 6",
                  f"{H927}, hoja 40, pasos 7 y 8; hilo: LSC v1 SC 2.6 (M40 negro)"],
         epp=EPP_COSTURA),

    dict(op="41", sector="COSTURA", denominacion="COSTURA VISTA - PESPUNTE SIMPLE",
         imagenes=[None, None, None, None],
         pasos=[
             "Apoyar la pieza con la cara vista hacia arriba en el pie de la máquina, contra "
             "la guía de referencia.",
             "Coser UNA sola línea de A a B por arriba de la unión de los vinilos, con "
             "atraque al inicio y al final.",
             "Cortar los hilos y controlar con el calibre la cantidad de puntos.",
             "Firmar la pieza con la inicial en la parte no vista.",
         ],
         parametros=[("Tipo de costura", "pespunte simple, 1 línea"),
                     ("Posición", "4 +0 / -1 mm por arriba de la unión de vinilos"),
                     ("Puntos", "10 a 11 cada 50 mm"),
                     ("Hilo", "Linhanyl BX138, color 12124E naranja"),
                     ("Máquina", "recta simple aguja triple arrastre"),
                     ("Puntos de atraque", "2 a 3 como máximo")],
         fuentes=[f"{H927}, hoja 50, pasos 1 a 3",
                  "LSC v1 del cliente, SC 2.1 a 2.3; atraques: HO 927 hoja 50, pasos 4 a 6",
                  f"{H927}, hoja 50, pasos 7 y 8; puntos: LSC v1 SC 2.4",
                  f"{H927}, hoja 50, paso 9"],
         epp=EPP_COSTURA),

    dict(op="60", sector="TAPIZADO", denominacion="LIMPIEZA DE PIEZA PLÁSTICA",
         imagenes=[_f("ho927_60_1.jpg"), _f("ho927_60_2_recorte.jpg")],
         pasos=[
             "Apoyar la pieza plástica en la mesa de trabajo y revisarla en busca de "
             "contaminantes.",
             "Rociar la pieza con alcohol isopropílico y frotar toda la superficie hasta que "
             "no queden contaminantes ni aureolas; si quedan aureolas, repetir la limpieza.",
         ],
         parametros=[("Producto", "alcohol isopropílico")],
         fuentes=[f"{H927}, hoja 60, pasos 1 y 2",
                  f"{H927}, hoja 60, pasos 3 y 4; ciclo: no deben quedar aureolas"],
         epp=EPP_LIMPIEZA),

    dict(op="61", sector="TAPIZADO", denominacion="APLICACIÓN DE PRIMER",
         imagenes=[_f("ho927_70_1.jpg"), _f("ho927_70_2.jpg"), _f("ho927_70_3.jpg"),
                   _f("ho927_70_4.jpg")],
         pasos=[
             "Mezclar el primer parte A y parte B en la batea plástica.",
             "Apoyar el sustrato en la mesa de trabajo.",
             "Pasar el primer con el pincel por la cara superior de la pieza.",
             "Dejar secar la pieza e identificarla con una etiqueta con la hora en que se "
             "aplicó el primer.",
         ],
         parametros=[("Secado", "3 a 5 min"),
                     ("Mezcla abierta", "máx. 8 h"),
                     ("Pieza con primer sin adhesivo", "máx. 48 h")],
         nota="No usar mezcla de primer abierta hace más de 8 h. La pieza con primer tiene "
              "que pasar al adhesivado antes de las 48 h.",
         fuentes=[f"{H927}, hoja 70, paso 1",
                  f"{H927}, hoja 70, paso 2",
                  f"{H927}, hoja 70, paso 3",
                  f"{H927}, hoja 70, paso 4 y ciclo de control (etiqueta con la hora)"],
         epp=EPP_QUIMICOS),

    dict(op="70", hoja_de=(1, 2), sector="TAPIZADO",
         denominacion="ADHESIVADO DE PIEZA PLÁSTICA Y VINILO",
         imagenes=[_f("ho927_80.1_1.jpg"), _f("ho927_80.1_2.jpg"), _f("ho927_80.1_3.jpg"),
                   _f("ho927_80.1_4.jpg")],
         pies=["Adhesivo FA", "Pieza en la mesa", "Rociado de la pieza", "Secado en estantería"],
         pasos=[
             "Mezclar una lata de adhesivo FA con una botella de reticulante GV y cargar la "
             "mezcla en el tanque de adhesivo.",
             "Apoyar la pieza plástica en la mesa de trabajo.",
             "Rociar la pieza con la pistola de adhesivado, en forma pareja y sin grumos.",
             "Colocar la pieza adhesivada en la estantería para que seque.",
         ],
         parametros=[("Mezcla", "1 lata de FA con 1 botella de GV"),
                     ("Secado", "5 a 10 min"),
                     ("Pieza adhesivada sin tapizar", "máx. 24 h")],
         nota="La pieza adhesivada que pasa 24 h sin tapizar va a scrap.",
         fuentes=[f"{H927}, hoja 80.1, paso 1",
                  f"{H927}, hoja 80.1, paso 2",
                  f"{H927}, hoja 80.1, paso 3; ciclo: sin grumos",
                  f"{H927}, hoja 80.1, paso 4"],
         epp=EPP_ADHESIVO),

    dict(op="70", hoja_de=(2, 2), sector="TAPIZADO",
         denominacion="ADHESIVADO DE PIEZA PLÁSTICA Y VINILO",
         imagenes=[_f("ho927_80.2_1.jpg"), _f("ho927_80.2_2.jpg"), _f("ho927_80.2_3.jpg"),
                   _f("ho927_80.2_4.jpg")],
         pies=["Adhesivo FA", "Vinilo en la mesa", "Rociado del vinilo", "Secado en estantería"],
         pasos=[
             "Cargar el tanque con la mezcla de adhesivo FA y reticulante GV.",
             "Apoyar el vinilo en la mesa de trabajo.",
             "Rociar el vinilo con la pistola de adhesivado, en forma pareja y sin grumos.",
             "Colocar el vinilo adhesivado en la estantería para que seque.",
         ],
         parametros=[("Secado", "5 a 10 min"), ("Vinilo adhesivado sin tapizar", "máx. 24 h")],
         nota="El vinilo adhesivado que pasa 24 h sin tapizar va a scrap.",
         fuentes=[f"{H927}, hoja 80.2, paso 1",
                  f"{H927}, hoja 80.2, paso 2",
                  f"{H927}, hoja 80.2, paso 3; ciclo: sin grumos",
                  f"{H927}, hoja 80.2, paso 4"],
         epp=EPP_ADHESIVO),

    dict(op="80", sector="TAPIZADO", denominacion="ACTIVADO DEL ADHESIVO EN HORNO",
         imagenes=[_f("ho927_90.1_3.jpg"), _f("ho927_90.1_2.jpg"), _f("ho927_90.1_4.jpg"),
                   _f("ho927_90.1_1.jpg")],
         pies=["Temperatura del horno", "Juegos en la estantería", "Orden en el horno",
               "Salida del horno"],
         pasos=[
             "Prender el horno y verificar en el display la temperatura de corte; no calentar "
             "la primera pieza hasta que llegue a la mínima.",
             "Tomar de la estantería un juego de apoyabrazos (sustrato y vinilo).",
             "Colocar el sustrato y el vinilo en el horno, según el orden de referencia.",
             "Retirar las piezas calientes cuando se completa el ciclo del tapizado anterior.",
         ],
         parametros=[("Temperatura de corte", "66 °C"), ("Máxima de uso", "65 °C"),
                     ("Mínima para la 1ra pieza", "55 °C"),
                     ("Tiempo en horno", "150 a 180 s (ciclo del tapizado anterior)")],
         fuentes=[f"{H927}, hoja 90.1, paso 1",
                  f"{H927}, hoja 90.1, paso 2",
                  f"{H927}, hoja 90.1, paso 3",
                  f"{H927}, hoja 90.1, paso 4"],
         epp=EPP_TAPIZADO),

    dict(op="81", hoja_de=(1, 2), sector="TAPIZADO", denominacion="TAPIZADO",
         imagenes=[_f("ho927_90.2_1.jpg"), _f("ho927_90.2_2.jpg"), _f("ho927_90.2_3.jpg")],
         pasos=[
             "Apoyar la pieza plástica caliente sobre la mesa de tapizado.",
             "Alinear el vinilo caliente desde la curva delantera: la parte de arriba del talón "
             "de costura sobre el radio superior del sustrato.",
             "Mantener la misma alineación en toda la curva delantera.",
         ],
         fuentes=[f"{H927}, hoja 90.2, paso 1 (foto 1)",
                  f"{H927}, hoja 90.2, paso 2 (foto 2)",
                  f"{H927}, hoja 90.2, paso 3 (foto 3)"],
         epp=EPP_TAPIZADO),

    dict(op="81", hoja_de=(2, 2), sector="TAPIZADO", denominacion="TAPIZADO",
         imagenes=[None, _f("ho927_90.2_4.jpg"), _f("ho927_90.2_5.jpg"), None],
         pasos=[
             "Sujetar el extremo trasero una vez pasada la curva, alinear la parte recta y "
             "corregir el viboreo en caliente.",
             "Pasar la espátula desde el centro hacia los bordes, con movimientos firmes y "
             "continuos.",
             "Presionar con la mano la zona plana de la costura y con los dedos las curvas "
             "interiores, hasta que no queden arrugas.",
             "Controlar la alineación de la costura con la regla mylar: si no está alineada, "
             "la pieza va a scrap.",
         ],
         nota="El vinilo tapizado no se despega para volver a colocarlo.",
         fuentes=[f"{H927}, hoja 90.2, paso 3.a",
                  f"{H927}, hoja 90.2, paso 4",
                  f"{H927}, hoja 90.2, paso 4.a",
                  "Flujograma 159 Rev.A, OP 82 (NO -> SCRAP); HO 927 hoja 90.2, ciclo: regla mylar"],
         epp=EPP_TAPIZADO),

    dict(op="90", sector="TAPIZADO", denominacion="REFILADO CON MÁSCARA",
         imagenes=[_f("ho927_100_1.jpg"), _f("ho927_100_3.jpg"), _f("ho927_100_5.jpg"),
                   _f("ho927_100_4.jpg")],
         pies=["Máscara sobre la pieza", "Corte con cúter", "Biblia de defectos",
               "Carro de piezas refiladas"],
         pasos=[
             "Apoyar la pieza en la mesa y colocarle la máscara de refilado.",
             "Refilar con el cúter perpendicular a la pieza, siguiendo la máscara, con pasadas "
             "continuas y presión pareja.",
             "Verificar que los orificios queden libres y que no quede espuma ni vinilo en la "
             "zona de soldadura; ante la duda, comparar con la pieza patrón y la biblia de "
             "defectos.",
             "Colocar la etiqueta de identificación y dejar la pieza en el carro de la "
             "operación siguiente.",
         ],
         parametros=[("Etiqueta", "según IO-16 (impresión de etiquetas)")],
         fuentes=[f"{H927}, hoja 100, paso 1",
                  f"{H927}, hoja 100, paso 1 (corte a 90°)",
                  f"{H927}, hoja 100, pasos 2 y 3",
                  f"{H927}, hoja 100, paso 4"],
         epp=EPP_TAPIZADO),

    dict(op="91", hoja_de=(1, 2), sector="TAPIZADO", denominacion="TROQUELADO DE VINILO",
         imagenes=[_f("ho927_110.1_1.jpg"), _f("ho927_110.1_2.jpg"), _f("ho927_110.1_3.jpg")],
         pasos=[
             "Apoyar la pieza en la base del dispositivo, bien asentada sobre el posicionador "
             "y la base.",
             "Posicionar el troquel sobre la pieza.",
             "Colocar el bloque sobre el troquel antes de accionar el dispositivo.",
         ],
         fuentes=[f"{H927}, hoja 110.1, paso 1",
                  f"{H927}, hoja 110.1, paso 2",
                  f"{H927}, hoja 110.1, paso 3"],
         epp=EPP_TAPIZADO),

    dict(op="91", hoja_de=(2, 2), sector="TAPIZADO", denominacion="TROQUELADO DE VINILO",
         imagenes=[_f("ho927_110.1_4.jpg"), _f("ho927_110.1_5.jpg")],
         pasos=[
             "Accionar el dispositivo y retirar la pieza, respetando la zona de corte.",
             "Verificar que el vinilo quede al borde del plástico o con el sobrante máximo.",
         ],
         parametros=[("Sobrante de vinilo", "máx. 2 mm (plano, característica 18B01)")],
         fuentes=[f"{H927}, hoja 110.1, paso 4",
                  f"{H927}, hoja 110.1, paso 5"],
         epp=EPP_TAPIZADO),

    dict(op="110", sector="TAPIZADO", denominacion="EMBALAJE E IDENTIFICACIÓN",
         imagenes=[_f("ho927_130_2.jpg"), _f("ho927_130_3.jpg"), None, _f("ho927_130_4.jpg")],
         pasos=[
             "Tomar un cajón plástico y colocar un cartón en la base.",
             "Colocar las piezas cruzadas entre sí, con un cartón entre piso y piso.",
             "Colocar un recorte de cartón arriba del último piso.",
             "Colocar la etiqueta en el cajón al completar el embalaje.",
         ],
         parametros=[("Piezas por cajón", "20 (5 pisos de 4)"), ("Separador", "cartón")],
         fuentes=[f"{H927}, hoja 130, pasos 1 y 2",
                  f"{H927}, hoja 130, paso 3",
                  f"{H927}, hoja 130, ciclo: recorte de cartón al final",
                  f"{H927}, hoja 130, paso 4"],
         epp=EPP_TAPIZADO),
]


def bloque_imagenes_con_huecos(slide, imagenes, pies=None):
    """Como g.bloque_imagenes, pero el paso sin foto deja su celda VACIA con el numero:
    la foto que falta se ve en su lugar y no corre la numeracion de las demas."""
    g._banda(slide, g.IMG_X, g.BODY_Y, g.IMG_W, 0.60, "IMÁGENES", size=12)
    y0 = g.BODY_Y + 0.60
    h = g.BODY_H - 0.60
    g._caja(slide, g.IMG_X, y0, g.IMG_W, h, g.BLANCO, borde=g.NEGRO, ancho=Pt(1))
    if not imagenes or all(i is None for i in imagenes):
        return
    faltan = [i for i in imagenes if i and not os.path.exists(i)]
    if faltan:
        raise SystemExit("FOTOS QUE NO EXISTEN:\n  " + "\n  ".join(faltan))
    n = len(imagenes)
    pad, gap, pie_h = 0.15, 0.18, 0.52
    W_util, H_util = g.IMG_W - 2 * pad, h - 2 * pad
    from PIL import Image
    for k, ruta in enumerate(imagenes):
        fx, fy, fw, fh = g._REPARTO[n][k]
        cx = g.IMG_X + pad + fx * W_util + (gap / 2 if fx > 0 else 0)
        cy = y0 + pad + fy * H_util + (gap / 2 if fy > 0 else 0)
        cw = fw * W_util - (gap / 2 if fx > 0 else 0) - (gap / 2 if fx + fw < 1 else 0)
        ch = fh * H_util - (gap / 2 if fy > 0 else 0) - (gap / 2 if fy + fh < 1 else 0)
        texto_pie = pies[k] if pies and k < len(pies) and ruta else ""
        ch_foto = ch - (pie_h if texto_pie else 0)
        if not ruta:
            g._caja(slide, cx, cy, cw, ch, g.BLANCO, borde=g.GRISF, ancho=Pt(0.75))
            g._badge_numero(slide, cx + 0.10, cy + 0.10, k + 1)
            continue
        im = Image.open(ruta)
        ar = im.width / im.height
        iw, ih = (cw, cw / ar) if cw / ar <= ch_foto else (ch_foto * ar, ch_foto)
        px = cx + (cw - iw) / 2
        py = cy + (ch_foto - ih) / 2
        slide.shapes.add_picture(ruta, Cm(px), Cm(py), Cm(iw), Cm(ih))
        g._badge_numero(slide, px + 0.10, py + 0.10, k + 1)
        if texto_pie:
            g._pie_foto(slide, cx, cy + ch_foto, cw, pie_h, texto_pie)


def gate_foto_por_paso(d):
    op = d.get("op", "?")
    pasos, fotos = d.get("pasos", []), d.get("imagenes", [])
    if not 2 <= len(pasos) <= g.MAX_FOTOS:
        raise SystemExit(f"hoja {op}: {len(pasos)} pasos. Entran de 2 a {g.MAX_FOTOS}.")
    if fotos and len(fotos) != len(pasos):
        raise SystemExit(f"hoja {op}: {len(fotos)} lugares de foto y {len(pasos)} pasos. Va "
                         f"UNO por paso (None = el paso todavia no tiene foto).")


def hoja(prs, d):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    g.cajetin(slide, d, g.LOGO_BARACK)
    gate_foto_por_paso(d)
    g._gate_texto_para_el_operario(d)
    g._gate_cada_paso_con_fuente(d)
    g._gate_no_afirmar_de_mas(d)
    g.gate_redaccion(d)
    bloque_imagenes_con_huecos(slide, d.get("imagenes", []), d.get("pies"))
    g.bloque_pasos(slide, d.get("pasos", []), d.get("nota"), d.get("parametros"))
    g.bloque_ciclo(slide, [])
    g.bloque_epp(slide, d.get("epp", g.EPP_STD), ("OP - Operador de Producción",))
    g.bloque_plan(slide, d.get("disparador", 'SI DETECTA "PRODUCTO" O "PROCESO" NO CONFORME'),
                  d.get("acciones"))
    return slide


def faltan_fotos():
    """La lista de fotos que hay que sacar en planta: un renglon por paso sin foto."""
    out = []
    for h in HOJAS:
        for k, (foto, paso) in enumerate(zip(h.get("imagenes", []), h["pasos"]), 1):
            if not foto:
                hd = f" (hoja {h['hoja_de'][0]} de {h['hoja_de'][1]})" if h.get("hoja_de") else ""
                out.append(f"OP {h['op']}{hd} paso {k}: {paso}")
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--salida", default=DESTINO)
    a = ap.parse_args()
    if "ingenier" in a.salida.lower() and "hojas de operaciones" not in a.salida.lower():
        raise SystemExit("Las hojas de proceso van en HOJAS DE OPERACIONES del SGC, no en la "
                         "biblioteca de Ingenieria (Fak, 24/09/2026; skill hojas-de-proceso "
                         "§3 bis). Destino: " + DESTINO)
    prs = Presentation()
    prs.slide_width, prs.slide_height = Cm(g.W), Cm(g.H)
    indice = []
    for h in HOJAS:
        nom = h["denominacion"] + (f" ({h['hoja_de'][0]}/{h['hoja_de'][1]})" if h.get("hoja_de") else "")
        indice.append((h["op"], nom))
    g.portada(prs, PORTADA, logo=g.LOGO_BARACK, foto=None, indice=indice)
    for h in HOJAS:
        d = dict(CAJETIN)
        d.update(h)
        hoja(prs, d)
        print(f"  [OK] {h['op']} {h['denominacion']}")
    os.makedirs(a.salida, exist_ok=True)
    out = os.path.join(a.salida, "HO-991 - HOJAS DE PROCESO - APB P21 HILO NARANJA - Rev.A.pptx")
    prs.save(out)
    print("\nGuardado:", out)
    ff = faltan_fotos()
    print(f"\nFotos que faltan sacar en planta: {len(ff)}")
    for x in ff:
        print("  -", x)


if __name__ == "__main__":
    main()
