# -*- coding: utf-8 -*-
"""Copia ej30_post_cap.py y su gemelo (practica del 19/10) a scripts/catia/ejercicios/22_ttt_post_cap/ con los cambios
minimos. Uso: python portar_ej30.py <carpeta de la practica> <carpeta destino>"""
import io
import os
import sys

src, dst = sys.argv[1], sys.argv[2]


def portar(nombre, salida, cambios, cabecera):
    s = io.open(os.path.join(src, nombre), encoding="utf-8").read()
    for viejo, nuevo in cambios:
        if s.count(viejo) != 1:
            raise SystemExit(f"{nombre}: esperaba 1 vez {viejo[:70]!r} (hay {s.count(viejo)})")
        s = s.replace(viejo, nuevo)
    s = s.replace("# -*- coding: utf-8 -*-\n", "# -*- coding: utf-8 -*-\n" + cabecera, 1)
    io.open(os.path.join(dst, salida), "w", encoding="utf-8", newline="\n").write(s)
    print("ok", salida, len(s.splitlines()))


p = io.open(os.path.join(src, "ej30_post_cap.py"), encoding="utf-8").read()
fin_cuerpo = p[p.index("    def final():"):p.index('if __name__ == "__main__":')]
main_pieza = p[p.index('if __name__ == "__main__":'):]
portar("ej30_post_cap.py", "pieza_ej30.py", [
    ("from catia_base import captura, correr, guardar_pieza, medir, nueva_pieza, ref, topologia",
     "from catia_base import medir, nueva_pieza, ref, topologia"),
    ("    o = part.OriginElements\n", "    o = part.OriginElements\n    ctx = {\"planos\": []}\n"),
    ("        body.InsertHybridShape(pl)\n", "        body.InsertHybridShape(pl)\n        ctx[\"planos\"].append(pl)\n"),
    ("        v0 = vol()\n        ar = topologia(doc, body, \"Edge\")\n        cand =",
     "        v0 = vol()\n        ctx[\"vol_sin_r1\"] = v0\n        ar = topologia(doc, body, \"Edge\")\n        cand ="),
    (fin_cuerpo, "    ctx.update(doc=doc, part=part, body=body, sf=sf, vol=vol)\n    return ctx\n\n\n"),
    (main_pieza, ""),
], ("# Origen: ej30_post_cap.py de la practica del 19/10/2026 (C:\\Dev\\_catia_practica de la PC principal, copiado a CATA\n"
    "# por el PEDIDO PARA CATA 6). Cambios para el ejercicio 22 del banco de CATIA (24/10/2026), nada mas: 1) importa solo\n"
    "# medir, nueva_pieza, ref y topologia de catia_base (el del repo); 2) cuerpo(c, reg) devuelve ctx (doc, part, body,\n"
    "# el plano del asa para ocultarlo y el volumen ANTES del R1 del asa, que es lo que mide el gemelo); la masa, la\n"
    "# captura y el STEP los hace el catia.py; 3) sin el bloque __main__.\n"))
g = io.open(os.path.join(src, "ej30_post_cap_gemelo.py"), encoding="utf-8").read()
main_g = g[g.index('if __name__ == "__main__":'):]
portar("ej30_post_cap_gemelo.py", "gemelo_b123d.py", [
    (main_g, 'if __name__ == "__main__":\n    import json\n    import sys\n    s, va = pieza()\n'
             '    if len(sys.argv) > 1:\n        export_step(s, sys.argv[1])\n'
             '    print(json.dumps({"volumen": round(s.volume, 3), "asa": round(va, 3), "solidos": len(s.solids())}))\n'),
], ("# Origen: ej30_post_cap_gemelo.py de la practica del 19/10/2026 (copiado a CATA por el PEDIDO PARA CATA 6). Unico\n"
    "# cambio (24/10/2026, ejercicio 22): el STEP va a la ruta del 1.er argumento (antes, fija en C:\\Dev\\_catia_practica)\n"
    "# y la ultima linea es un JSON con el volumen. Sin los R1 del asa (como en la practica). Corre con .venv-cad.\n"))
