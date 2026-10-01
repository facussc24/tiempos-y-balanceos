# -*- coding: utf-8 -*-
"""generar_hojas_v3.py — arma las hojas HOTMELT en el formato de una foto por paso (A3).

    py -3 scripts/hotmelt/generar_hojas_v3.py                # los dos juegos, con PDF
    py -3 scripts/hotmelt/generar_hojas_v3.py maquina        # solo la hoja de maquina
    py -3 scripts/hotmelt/generar_hojas_v3.py --sin-pdf
    py -3 scripts/hotmelt/generar_hojas_v3.py --sin-pdf --out <carpeta>   # probar sin pisar lo entregado

Contenido: `hojas_v3_spec.py`. Fotos: `fotos_v3.py` + `fotos_v3_lista.py`. Dibujo: `hoja_a3_fotos.py`.
Antes de dibujar cada hoja corren los controles de redaccion del skill hojas-de-proceso
(vocabulario de planta, infinitivo, sin TBD, denominacion) y el de fuente por paso.
"""
import os
import sys

from pptx import Presentation
from pptx.util import Cm

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
sys.path.insert(0, os.path.join(AQUI, "..", "..", ".claude", "skills", "hojas-de-proceso", "scripts"))
sys.stdout.reconfigure(encoding="utf-8")

import generar_hojas_hotmelt_a3 as base      # noqa: E402
import hoja_a3_fotos as H                     # noqa: E402
import hojas_v3_spec as spec                  # noqa: E402
from redaccion import gate_redaccion          # noqa: E402
import hoja_proceso_check as CHK              # noqa: E402

SALIDA = os.path.abspath(os.path.join(AQUI, "..", "..", "exports", "hojas-hotmelt-01-10"))
if "--out" in sys.argv:                       # para probar sin pisar lo ya entregado
    _i = sys.argv.index("--out")
    SALIDA = os.path.abspath(sys.argv[_i + 1])
    del sys.argv[_i:_i + 2]
FECHA = "01/10/2026"

JUEGOS = {
    "maquina": dict(hojas=spec.MAQUINA, archivo="HO-993 - LAMINADORA HOT MELT - HOJA DE MAQUINA",
                    cajetin=dict(ho="HO-993", sector="LAMINADO", pieza="LAMINADORA HOT MELT",
                                 modelo="PATAGONIA / VW427", cliente="VW / NOVAX")),
    "produccion": dict(hojas=spec.PRODUCCION, archivo="HO-992 - OP 20 ADHESIVADO HOT MELT - TOP ROLL",
                       cajetin=dict(ho="HO-992", sector="LAMINADO",
                                    pieza="TOP ROLL — N 216 / N 256 / N 285 / N 315",
                                    modelo="PATAGONIA / VW427", cliente="VW / NOVAX")),
}


def gate_fuente_por_paso(d):
    sin = [i for i, p in enumerate(d["pasos"], 1) if not p.get("fuentes")]
    if sin:
        raise SystemExit(f"OP {d['op']} {d['denominacion']}: los pasos {sin} no dicen de donde salen. "
                         "Sin fuente el paso no va (hojas-proceso.md punto 11).")


def para_redaccion(d):
    """El dict de la hoja, en la forma que lee gate_redaccion (pasos y pies como textos)."""
    pies = []
    for p in d["pasos"]:
        for f in p.get("fotos") or ([p] if p.get("foto") else []):
            pies.append(f.get("pie", ""))
    return dict(op=d["op"], denominacion=d["denominacion"], nota=d.get("aviso"),
                pasos=[p["texto"].replace("⚠", "").replace("“", '"').replace("”", '"') for p in d["pasos"]],
                pies=pies)


def generar(nombre, pdf=True):
    j = JUEGOS[nombre]
    if not j["hojas"]:
        print(f"[{nombre}] todavia no tiene hojas en el spec.")
        return None
    prs = Presentation()
    prs.slide_width, prs.slide_height = Cm(base.W), Cm(base.H)
    for h in j["hojas"]:
        d = dict(fecha=FECHA, rev="A", **j["cajetin"])
        d.update(h)
        gate_fuente_por_paso(d)
        gate_redaccion(para_redaccion(d))
        _, avisos = H.hoja(prs, d, logo=base.LOGO_BARACK)
        etiqueta = f"OP {d['op']} {d['denominacion']}" + (f" ({d['hoja_de'][0]}/{d['hoja_de'][1]})" if d.get("hoja_de") else "")
        print(f"  ok  {etiqueta}")
        for a in avisos:
            print(f"      aviso: {a}")
    os.makedirs(SALIDA, exist_ok=True)
    ruta = os.path.join(SALIDA, j["archivo"] + ".pptx")
    prs.save(ruta)
    print(f"[{nombre}] {len(j['hojas'])} hojas -> {ruta}")
    # el control duro del skill, sobre el ARCHIVO que quedo: fotos de menos de 25 cm2, mas de
    # 12 por hoja, una foto sin su cartel REF., un texto que no entra en su caja, vocabulario
    fallas = CHK.revisar(ruta, {"*": {"secuencia": True}})
    if fallas:
        print(CHK.informe(fallas))
        raise SystemExit(1)
    print(f"[{nombre}] control de la hoja impresa: pasa")
    if pdf:
        base.exportar_pdf_com(ruta)
    return ruta


if __name__ == "__main__":
    pedidos = [a for a in sys.argv[1:] if not a.startswith("--")] or list(JUEGOS)
    for n in pedidos:
        generar(n, pdf="--sin-pdf" not in sys.argv)
    if spec.FALTA:
        # la lista de lo que ninguna fuente contesta, agrupada por tema, al lado de las hojas
        temas = {}
        for tema, que in spec.FALTA:
            temas.setdefault(tema, []).append(que)
        lineas = ["HOJAS HOT MELT - LO QUE FALTA PREGUNTAR O FILMAR EN LA MAQUINA", f"Al {FECHA}", ""]
        for tema, items in temas.items():
            lineas.append(tema)
            lineas += [f"  - {q}" for q in items]
            lineas.append("")
        destino = os.path.join(SALIDA, "PENDIENTES - lo que falta preguntar o filmar.txt")
        with open(destino, "w", encoding="utf-8") as f:
            f.write("\n".join(lineas))
        print(f"\nPendientes de preguntar o filmar: {len(spec.FALTA)} -> {destino}")
