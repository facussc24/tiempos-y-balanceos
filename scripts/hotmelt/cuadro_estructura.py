# -*- coding: utf-8 -*-
"""Saca el cuadro de la Fase 1 a un Excel para que Fak lo revise antes de generar laminas.

   cuadro_estructura.py --salida <ruta.xlsx>

Una fila por paso: en que lamina cae, si es accion / pantalla / nota / remision, el texto,
la foto que lo muestra y si esa foto existe. La columna OK/NO es para que Fak la marque.
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import xlsxwriter                                                    # noqa: E402

import estructura_v2 as E                                            # noqa: E402

COLOR = {"ok": "#E8F3E8", "FALTA": "#FDE2E2", "ROTULAR": "#FFF3CD",
         "VERIFICAR": "#FFE0CC", "": "#FFFFFF"}
# "ok" en el spec significa QUE EL ARCHIVO EXISTE, no que la foto sirva. En el cuadro se
# escribe "hay" para no prometer de mas: de las 114 fotos recortadas, las que mire una por
# una muestran que varias no muestran lo que dice su nombre (h07_f_serpentina esta movida,
# h01_d_vista_general no es una vista general). La verificacion de a una va en su pasada.
ROTULO = {"ok": "hay", "FALTA": "FALTA", "ROTULAR": "ROTULAR", "VERIFICAR": "VERIFICAR",
          "": ""}
TIPO = {"A": "acción", "P": "pantalla", "N": "nota / ⚠", "R": "manda a otra hoja"}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--salida", required=True)
    a = ap.parse_args()

    wb = xlsxwriter.Workbook(a.salida)
    ws = wb.add_worksheet("estructura")
    tit = wb.add_format(dict(bold=True, font_color="white", bg_color="#44546A",
                             align="center", valign="vcenter", text_wrap=True, border=1))
    op_f = wb.add_format(dict(bold=True, bg_color="#D9E2F3", border=1, valign="vcenter"))
    nota_f = wb.add_format(dict(italic=True, bg_color="#F2F2F2", border=1, text_wrap=True,
                                valign="top", font_size=9))
    base = dict(border=1, text_wrap=True, valign="top", font_size=10)
    fmt = {k: wb.add_format(dict(base, bg_color=v)) for k, v in COLOR.items()}
    cen = {k: wb.add_format(dict(base, bg_color=v, align="center")) for k, v in COLOR.items()}

    ws.set_column(0, 0, 8)    # lamina
    ws.set_column(1, 1, 5)    # paso
    ws.set_column(2, 2, 14)   # tipo
    ws.set_column(3, 3, 60)   # texto
    ws.set_column(4, 4, 28)   # foto
    ws.set_column(5, 5, 11)   # veredicto
    ws.set_column(6, 6, 52)   # que se ve
    ws.set_column(7, 7, 10)   # OK de Fak
    ws.freeze_panes(1, 0)
    for k, t in enumerate(["Lámina", "Paso", "Qué es", "Texto del paso",
                           "Foto que lo muestra", "¿Sirve?",
                           "Qué se ve en esa foto (las miré una por una)", "OK / NO"]):
        ws.write(0, k, t, tit)
    ws.set_row(0, 34)

    r = 1
    cuenta = {"laminas": 0, "A": 0, "P": 0, "N": 0, "R": 0}
    faltan, redib, verif = [], [], []
    for h in E.PLAN:
        ls = E.laminas(h)
        ws.merge_range(r, 0, r, 7, "%s  %s        [%s]" % (h["op"], h["denom"], h["etapa"]),
                       op_f)
        r += 1
        if h.get("nota"):
            ws.merge_range(r, 0, r, 7, h["nota"], nota_f)
            r += 1
        for k, lam in enumerate(ls):
            cuenta["laminas"] += 1
            nom = E.nombre_lamina(h["op"], k, len(ls))
            for nro, tipo, texto, foto, estado in lam:
                cuenta[tipo] += 1
                ver, motivo = E.veredicto(foto)
                # el veredicto de MIRAR la foto le gana al estado declarado en el spec:
                # una foto que existe pero no muestra el paso es una foto que falta.
                if ver == "NO":
                    estado = "FALTA"
                elif ver == "rotular":
                    estado = "ROTULAR"
                elif ver == "floja" and estado == "ok":
                    estado = "VERIFICAR"
                ws.write(r, 0, nom, cen[estado])
                ws.write(r, 1, nro if nro else "", cen[estado])
                ws.write(r, 2, TIPO[tipo], fmt[estado])
                ws.write(r, 3, texto, fmt[estado])
                ws.write(r, 4, foto, fmt[estado])
                ws.write(r, 5, ver or ROTULO[estado], cen[estado])
                ws.write(r, 6, motivo, fmt[estado])
                ws.write(r, 7, "", fmt[""])
                if estado == "FALTA":
                    faltan.append((nom, nro, texto if not motivo
                                   else "%s   [la foto que hay no sirve — %s]"
                                        % (texto, motivo)))
                elif estado == "ROTULAR":
                    redib.append((nom, nro, "%s — %s" % (foto, motivo)))
                elif estado == "VERIFICAR":
                    verif.append((nom, nro, foto, motivo or texto))
                r += 1

    # ── hoja 2: lo que falta filmar ──────────────────────────────────────────
    w2 = wb.add_worksheet("falta filmar")
    w2.set_column(0, 0, 8); w2.set_column(1, 1, 5); w2.set_column(2, 2, 90)
    for k, t in enumerate(["Lámina", "Paso", "Qué hay que filmar o fotografiar"]):
        w2.write(0, k, t, tit)
    for i, (nom, nro, texto) in enumerate(faltan, 1):
        w2.write(i, 0, nom, cen["FALTA"]); w2.write(i, 1, nro, cen["FALTA"])
        w2.write(i, 2, texto, fmt["FALTA"])

    # ── hoja 3: pantallas a rotular y fotos a verificar ────────────────────
    w3 = wb.add_worksheet("pantallas y dudas")
    w3.set_column(0, 0, 8); w3.set_column(1, 1, 5); w3.set_column(2, 2, 34)
    w3.set_column(3, 3, 70)
    for k, t in enumerate(["Lámina", "Paso", "Imagen", "Qué hay que hacer con ella"]):
        w3.write(0, k, t, tit)
    i = 1
    for nom, nro, foto in redib:
        w3.write(i, 0, nom, cen["ROTULAR"]); w3.write(i, 1, nro, cen["ROTULAR"])
        w3.write(i, 2, foto, fmt["ROTULAR"])
        w3.write(i, 3, "Enderezar la FOTO real de la pantalla y ponerle encima los "
                       "números y el texto en castellano, a cuerpo legible impreso. "
                       "No se redibuja (Fak, 08/09).", fmt["ROTULAR"])
        i += 1
    for nom, nro, foto, texto in verif:
        w3.write(i, 0, nom, cen["VERIFICAR"]); w3.write(i, 1, nro, cen["VERIFICAR"])
        w3.write(i, 2, foto, fmt["VERIFICAR"])
        w3.write(i, 3, "La foto que hay puede contradecir al texto «%s». Mirar el video "
                       "antes de usarla." % texto[:60], fmt["VERIFICAR"])
        i += 1

    # ── hoja 4: vocabulario ─────────────────────────────────────────────────
    w4 = wb.add_worksheet("vocabulario")
    w4.set_column(0, 0, 26); w4.set_column(1, 1, 26); w4.set_column(2, 2, 86)
    for k, t in enumerate(["Dice hoy", "Diría", "Dónde aparece en Barack"]):
        w4.write(0, k, t, tit)
    for i, (viejo, nuevo, fuente) in enumerate(E.VOCABULARIO, 1):
        w4.write(i, 0, viejo, fmt["ok"]); w4.write(i, 1, nuevo, fmt["ok"])
        w4.write(i, 2, fuente, fmt["ok"])
    i = len(E.VOCABULARIO) + 2
    w4.write(i, 0, "SIN RESPALDO — te pregunto", tit)
    for viejo, preg in (
            ("mandril", "El eje que se infla dentro del rollo: ¿cómo lo llaman los "
                        "operarios? «mandril», «eje neumático» y «eje expansible» tienen "
                        "CERO apariciones en todo Barack fuera de esta hoja."),
            ("tubo de cartón", "¿tubo, núcleo, o algo que no está en ninguna lista? La "
                               "hoja dice tubo, la bitácora dice núcleo, ningún documento "
                               "liberado dice ninguna de las dos."),
            ("(sin nombre)", "La herramienta del corte de la plancha (20.14): ¿cuchillo, "
                             "cutter o cuchilla? La hoja no la nombra, el video se llama "
                             "«corte a cuchillo», I-AC-044 dice «Cutter».")):
        i += 1
        w4.write(i, 0, viejo, fmt["FALTA"])
        w4.merge_range(i, 1, i, 2, preg, fmt["FALTA"])

    wb.close()
    print("%d laminas (hoy 18)  ·  %d acciones + %d pantallas = %d pasos numerados  ·  "
          "%d notas  ·  %d remisiones"
          % (cuenta["laminas"] + 1, cuenta["A"], cuenta["P"],
             cuenta["A"] + cuenta["P"] + cuenta["R"], cuenta["N"], cuenta["R"]))
    print("fotos: %d FALTAN · %d a rotular · %d a verificar contra el video"
          % (len(faltan), len(redib), len(verif)))
    print("->", a.salida)


main()
