# -*- coding: utf-8 -*-
"""generar_ho971.py — arma las laminas A3 de la HO-971 (APB de puerta VW427 Patagonia) que salen de
`spec_ho971.py`, con el motor y los controles de las hojas A3 de la Hotmelt.

    py -3 scripts/ho971/generar_ho971.py              # pptx + pdf en exports/HO971_UNIFICADA/laminas
    py -3 scripts/ho971/generar_ho971.py --sin-pdf

Las fotos se copian de la HO-971 vieja descomprimida (xl/media) a exports/HO971_UNIFICADA/fotos con un
nombre que dice que muestran; la carpeta de origen se pasa con --media o se toma de MEDIA.
Antes de dibujar cada hoja corren: fuente por paso, cuando se hace, pieza nombrada que se ve, foto que
no es de una falla y el control de redaccion del skill hojas-de-proceso. Despues, el control duro sobre
el pptx guardado (hoja_proceso_check). El ciclo de control queda vacio (canon 1.2).
"""
import os
import shutil
import sys

from PIL import Image
from pptx import Presentation
from pptx.util import Cm

AQUI = os.path.dirname(os.path.abspath(__file__))
HOT = os.path.join(AQUI, "..", "hotmelt")
SKILL = os.path.join(AQUI, "..", "..", ".claude", "skills", "hojas-de-proceso", "scripts")
for p in (AQUI, HOT, SKILL):
    sys.path.insert(0, os.path.abspath(p))
sys.stdout.reconfigure(encoding="utf-8")

import generar_hojas_hotmelt_a3 as base      # noqa: E402
import hoja_a3_fotos as H                     # noqa: E402
import generar_hojas_v3 as v3                 # noqa: E402  (los controles de la hoja A3)
from redaccion import gate_redaccion          # noqa: E402
import hoja_proceso_check as CHK              # noqa: E402
import spec_ho971 as spec                     # noqa: E402

SALIDA = os.path.abspath(os.path.join(AQUI, "..", "..", "exports", "HO971_UNIFICADA", "laminas"))
MEDIA = os.environ.get("HO971_MEDIA", "")
if "--media" in sys.argv:
    MEDIA = sys.argv[sys.argv.index("--media") + 1]
FECHA = "05/10/2026"
CAJETIN = dict(ho="HO-971", pieza="APB DE PUERTA — N 231 / N 267 / N 297 / N 328", modelo="PATAGONIA / VW427",
               cliente="VW / NOVAX", realizo="F.SANTORO", aprobo="C.BAPTISTA", fecha=FECHA, rev="B")
AUDITIVA = os.path.join(base.EPP_DIR, "ico_12924.png")
EPP = {"corte": [base.ICO_ROPA, base.ICO_CALZADO, AUDITIVA],   # los de la HO vieja de la mesa de corte
       # + guantes donde se manipulan cuchillas (riesgo de corte que se ve en la foto; a confirmar por Fak)
       "cuchilla": [base.ICO_ROPA, base.ICO_CALZADO, AUDITIVA, base.ICO_GUANTES],
       "recepcion": [base.ICO_ROPA, base.ICO_CALZADO, base.ICO_GUANTES]}   # los de la pestaña 10 vieja


def copiar_fotos():
    os.makedirs(spec.FOTOS, exist_ok=True)
    for nombre, origen in spec.ORIGEN_FOTOS.items():
        dst = spec.f(nombre)
        archivo, caja = (origen, None) if isinstance(origen, str) else origen
        src = os.path.join(MEDIA, archivo)
        if not os.path.exists(src):
            if os.path.exists(dst):
                continue                      # ya copiada en una corrida anterior
            raise SystemExit(f"falta la imagen de origen {src} (pasar --media <carpeta xl/media de la HO vieja>)")
        im = Image.open(src).convert("RGB")
        if caja:                              # recorte sobre lo que el paso nombra
            im = im.crop(caja)
        im.save(dst, quality=92)


def main():
    copiar_fotos()
    v3.gate_lo_normal_en_produccion(spec.HOJAS)
    prs = Presentation()
    prs.slide_width, prs.slide_height = Cm(base.W), Cm(base.H)
    for h in spec.HOJAS:
        d = dict(CAJETIN)
        d.update(h)
        d["epp"] = EPP[h["epp"]]
        v3.gate_fuente_por_paso(d)
        v3.gate_foto_no_es_de_falla(d, fotos={})
        v3.gate_pieza_nombrada_se_ve(d, fotos={})
        gate_redaccion(v3.para_redaccion(d))
        _, avisos = H.hoja(prs, d, logo=base.LOGO_BARACK)
        print(f"  ok  OP {d['op']} {d['denominacion']}" + (f" ({d['hoja_de'][0]}/{d['hoja_de'][1]})" if d.get("hoja_de") else ""))
        for a in avisos:
            print(f"      aviso: {a}")
    os.makedirs(SALIDA, exist_ok=True)
    ruta = os.path.join(SALIDA, "HO-971 - LAMINAS A3 NUEVAS.pptx")
    prs.save(ruta)
    fallas = CHK.revisar(ruta, {"*": {"secuencia": True}})
    if fallas:
        print(CHK.informe(fallas))
        raise SystemExit(1)
    print(f"control de la hoja impresa: pasa -> {ruta}")
    if "--sin-pdf" not in sys.argv:
        base.exportar_pdf_com(ruta)
    if spec.FALTA:
        print("\nFALTA (no se imprime):")
        for x in spec.FALTA:
            print("  -", x)


if __name__ == "__main__":
    main()
