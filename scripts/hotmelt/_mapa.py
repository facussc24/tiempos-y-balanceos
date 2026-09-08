# -*- coding: utf-8 -*-
"""Tabla hoja -> fotos -> pasos, para que el analisis no tenga que adivinar."""
import io, os
import hojas_spec as H
FR = {}
for l in io.open("gen_fotos.py", encoding="utf-8"):
    l = l.strip()
    if l.startswith('("') and l.endswith('),'):
        p = l.strip("(),").replace('"', "").split(",")
        if len(p) == 3:
            FR[p[2].strip()] = (p[0].strip(), p[1].strip())
out = []
D = (r"C:\Users\FacundoS-PC\OneDrive - BARACK ARGENTINA SRL\Desktop"
     r"\Hojas de proceso maquina HOTMELT - desde los videos\_trabajo\fotos_hoja")
for h in H.HOJAS:
    out.append(f"\n### {h['op']}  {h['denominacion']}")
    out.append("PASOS:")
    for i, p in enumerate(h["pasos"], 1):
        out.append(f"  {i}. {p}")
    if h.get("nota"):
        out.append(f"  NOTA: {h['nota']}")
    out.append("FOTOS (en orden, izquierda a derecha):")
    for f in h["imagenes"]:
        n = os.path.basename(f)[:-4]
        v = FR.get(n)
        origen = f"video {v[0]}, segundo {v[1]}" if v else "(recortada a mano de un frame)"
        from PIL import Image
        im = Image.open(f)
        out.append(f"  - {n}.jpg   {im.width}x{im.height} px   origen: {origen}")
io.open("_mapa_fotos.txt", "w", encoding="utf-8").write("\n".join(out))
print("hojas:", len(H.HOJAS), "->", os.path.abspath("_mapa_fotos.txt"))
