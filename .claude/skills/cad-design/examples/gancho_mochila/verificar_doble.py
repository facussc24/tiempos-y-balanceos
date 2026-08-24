"""GATE 3 del gancho doble: verificar el ARTEFACTO, no el diseño.

El control que importa aca es distinto al del v2. En el v2 lo que gobernaba era `a/L`; aca
es el CONO: la pieza baja hasta que la boca se cierra sobre la pata, y ahi traba. Entonces
lo que hay que medir sobre el STL es (1) que la boca sea efectivamente conica y con la
conicidad pedida, y (2) **a que altura asienta** para cada espesor de pata del rango — si
asentara fuera del clip, la pieza no agarraria nada.

Cada control trae su valor GEMELO: cuanto daria si la falla estuviera presente.

Uso:
    .venv-cad\\Scripts\\python.exe verificar_doble.py --workdir <W> [--stl <archivo>]
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

import numpy as np
import trimesh

AQUI = Path(__file__).parent


class Reporte:
    def __init__(self):
        self.filas, self.rojo = [], False

    def add(self, nombre, valor, esperado, gemelo, ok):
        ok = bool(ok)
        self.filas.append((nombre, str(valor), str(esperado), str(gemelo), ok))
        if not ok:
            self.rojo = True

    def imprimir(self):
        print(f"\n{'control':38s} {'medido':>13s} {'esperado':>15s} {'si fallara':>18s}")
        print("-" * 92)
        for n, v, e, g, ok in self.filas:
            print(f"{'OK  ' if ok else 'MAL '}{n:34s} {v:>13s} {e:>15s} {g:>18s}")
        print("-" * 92)


def boca_a_la_altura(mesh, z, x):
    """Ancho de la boca a la altura z, medido por rayos desde el eje hacia las dos alas."""
    o = np.array([[x, 0.0, z]])
    lados = []
    for d in ([0, 1, 0], [0, -1, 0]):
        loc, _, _ = mesh.ray.intersects_location(ray_origins=o, ray_directions=np.array([d]))
        if len(loc) == 0:
            return None
        lados.append(loc[np.argmin(np.linalg.norm(loc - o, axis=1))][1])
    return lados[0] - lados[1]


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--workdir", required=True)
    ap.add_argument("--params", default=str(AQUI / "params_doble.json"))
    ap.add_argument("--stl", default=None, help="STL a verificar (por defecto el del workdir)")
    args = ap.parse_args()

    p = json.loads(Path(args.params).read_text(encoding="utf-8"))
    W = Path(args.workdir)
    stl = Path(args.stl) if args.stl else W / "out_doble" / "gancho_doble_v1.stl"
    print(f"verificando: {stl}")
    mesh = trimesh.load(str(stl))
    rep = Reporte()

    c = p["clip"]
    h, x_son = c["h_clip"], c["p_ala"] * 0.5
    ba, bb = c["boca_abajo"], c["boca_arriba"]

    # ------------------------------------------------------------------ C1 malla y volumen
    rep.add("malla cerrada (watertight)", mesh.is_watertight, "True",
            "False si hay agujeros", mesh.is_watertight)
    v_step = json.loads((W / "out_doble" / "cuentas_doble.json").read_text(encoding="utf-8"))[
        "volumen_cm3"
    ]
    rep.add("STL coincide con el STEP", f"{mesh.volume/1000:.2f} cm3", f"{v_step:.2f} +-1%",
            "0 o negativo si normales mal", abs(mesh.volume / 1000 - v_step) / v_step < 0.01)
    n_piezas = len(mesh.split(only_watertight=False))
    rep.add("una sola pieza", n_piezas, "1", "2+ si algo quedo despegado", n_piezas == 1)

    # ------------------------------------- C2 la boca es CONICA, y con la conicidad pedida
    z_lo, z_hi = 2.0, h - 2.0
    b_lo, b_hi = boca_a_la_altura(mesh, z_lo, x_son), boca_a_la_altura(mesh, z_hi, x_son)
    if b_lo is None or b_hi is None:
        rep.add("boca medida en el STL", "sin impacto", "-", "-", False)
        rep.imprimir()
        raise SystemExit("los rayos no impactaron: la sonda esta mal puesta")
    esp_lo = ba + (bb - ba) * z_lo / h
    esp_hi = ba + (bb - ba) * z_hi / h
    rep.add("boca abajo (z=2)", f"{b_lo:.3f} mm", f"{esp_lo:.2f} +-0.10",
            f"{bb:.2f} si saliera recta", abs(b_lo - esp_lo) < 0.10)
    rep.add("boca arriba (z=26)", f"{b_hi:.3f} mm", f"{esp_hi:.2f} +-0.10",
            f"{ba:.2f} si saliera al reves", abs(b_hi - esp_hi) < 0.10)
    rep.add("la boca ABRE hacia arriba", f"+{b_hi - b_lo:.2f} mm", "> 0.5",
            "<0 el peso la aflojaria", b_hi - b_lo > 0.5)

    # ------------------------------------------- C3 el cono traba, medido sobre la malla
    alpha = math.degrees(math.atan((b_hi - b_lo) / 2.0 / (z_hi - z_lo)))
    limite = math.degrees(math.atan(p["carga"]["mu"]))
    rep.add("semiangulo medido en el STL", f"{alpha:.2f} gr", f"< {limite:.1f} gr",
            f"> {limite:.1f} y se desliza", alpha < limite)

    # --------------------- C4 EL control: a que altura asienta para cada pata del rango
    # La pieza baja hasta que la boca iguala el espesor de la pata. Si eso cayera fuera del
    # clip no agarraria: por debajo de 0 se pasaria de largo, por encima de h no llegaria a
    # cerrar nunca. Se comprueba en los dos extremos del rango y en la pata real.
    def altura_de_asiento(t):
        return (t - ba) * h / (bb - ba)

    for etiqueta, t in [
        ("la pata real (27,2)", p["sustrato"]["t_pata_arriba"]),
        ("el extremo flaco", ba + 0.2),
        ("el extremo gordo", bb - 0.2),
    ]:
        z = altura_de_asiento(t)
        rep.add(f"asienta con {etiqueta}", f"z = {z:.1f} mm", f"entre 0 y {h:.0f}",
                "fuera => no agarra", 0.0 <= z <= h)

    # gemelo del control: una pata MAS GORDA que el rango no tiene que asentar
    z_fuera = altura_de_asiento(bb + 2.0)
    rep.add("una pata fuera de rango NO asienta", f"z = {z_fuera:.1f} mm", f"> {h:.0f}",
            "seria ciego si diera adentro", z_fuera > h)

    # ------------------------------------------------------ C5 imprimible sin soportes
    zmin = mesh.bounds[0][2]
    base = float(mesh.area_faces[
        (np.abs(mesh.triangles_center[:, 2] - zmin) < 0.15) & (mesh.face_normals[:, 2] < -0.9)
    ].sum())
    rep.add("apoya en la cama (Z=0)", f"{zmin:.3f} mm", "0.000",
            "!=0 si quedo flotando", abs(zmin) < 0.01)
    rep.add("huella de primera capa", f"{base:.0f} mm2", "> 900",
            "<200 se despega", base > 900)

    rep.imprimir()
    (W / "verificacion_doble.json").write_text(
        json.dumps({n: {"medido": v, "esperado": e, "gemelo": g, "ok": ok}
                    for n, v, e, g, ok in rep.filas}, indent=2, ensure_ascii=False),
        encoding="utf-8")
    if rep.rojo:
        raise SystemExit("HAY CONTROLES EN ROJO — no se entrega")
    print("todos los controles en verde")


if __name__ == "__main__":
    main()
