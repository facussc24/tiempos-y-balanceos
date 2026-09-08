import hojas_spec as H
print("hojas:", len(H.HOJAS))
print("con acciones propias:", [h["op"] for h in H.HOJAS if "acciones" in h])
faltan = []
import os
for h in H.HOJAS:
    for f in h["imagenes"]:
        if not os.path.exists(f): faltan.append((h["op"], os.path.basename(f)))
print("fotos faltantes:", faltan)
