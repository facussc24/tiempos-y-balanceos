"""Imagen de como va a quedar la pieza, con el color real de cada parte (antes de imprimir).

Uso (.venv-cad):
  vista_previa.py <pieza.3mf> <salida.png> --color 1=#111111 --color 2=#F4D31F
La miniatura que deja Bambu Studio por comando sale de un solo color: esta es la que se muestra.
Dos vistas (general y desde arriba) en una sola imagen, fondo blanco, motor foto3d.
"""
import sys
from pathlib import Path

import lib3mf
import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "cad-design" / "scripts"))
import foto3d as f3  # noqa: E402

entrada, salida = sys.argv[1], sys.argv[2]
colores = {}
for i, a in enumerate(sys.argv):
    if a == "--color":
        k, v = sys.argv[i + 1].split("=")
        colores[int(k)] = v

w = lib3mf.Wrapper()
m = w.CreateModel()
m.QueryReader("3mf").ReadFromFile(entrada)
it = m.GetMeshObjects()
esc = f3.Escena()
todo = []
n = 0
while it.MoveNext():
    ob = it.GetCurrentMeshObject()
    n += 1
    v = np.array([[p.Coordinates[0], p.Coordinates[1], p.Coordinates[2]] for p in ob.GetVertices()])
    t = np.array([[q.Indices[0], q.Indices[1], q.Indices[2]] for q in ob.GetTriangleIndices()])
    col = colores.get(n, "#808080")
    # un negro puro no deja ver el relieve (Fak, 13/10: "esta tan oscura que no se ven los
    # detalles"): lo muy oscuro se dibuja gris grafito; el color real va en el texto del mail
    r_, g_, b_ = (int(col[i:i + 2], 16) for i in (1, 3, 5))
    if max(r_, g_, b_) < 70:
        col = "#55595f"
    esc.agregar(v[t], col, f"parte{n}")
    todo.append(v)
esc.compilar()
P = np.vstack(todo)
c = (P.min(0) + P.max(0)) / 2
ancho = float(np.linalg.norm(P.max(0) - P.min(0))) * 1.12
vistas = []
for elev, azim, k in ((38, -62, 1.0), (89, -90, 0.95)):
    cam = f3.Camara(c, elev, azim, ancho * k, px=(1500, 820))
    img, prof, ident = f3.render(esc, cam)
    img = f3.contornos(img, prof, ident, cam=cam)
    vistas.append((np.clip(img, 0, 1) * 255).astype(np.uint8))
Image.fromarray(np.vstack(vistas)).save(salida)
print("escrito", salida, "| partes:", n)
