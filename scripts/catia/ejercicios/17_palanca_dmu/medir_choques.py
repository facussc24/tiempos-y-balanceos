# -*- coding: utf-8 -*-
"""Choques y luces de la palanca del ejercicio 17 en cada pose, con OpenCASCADE (build123d) sobre los STEP que exporto
CATIA, moviendo la palanca con la posicion que dio el mecanismo de CATIA (DMU Kinematics). Corre con .venv-cad:

    python -I medir_choques.py <entrada.json>      -> ultima linea: JSON {"poses": {angulo: {fija: {"choque_mm3", "luz_mm"}}}}

entrada.json: {"palanca": <stp>, "fijas": {nombre: <stp>}, "poses": {angulo: [12 componentes de Position]}}.
Position de CATIA = ejes X, Y, Z de la instancia (3 + 3 + 3) y su origen (3), expresados en el producto: un punto p de la
pieza va a  o + p.x X + p.y Y + p.z Z."""
import json
import sys


def main():
    from build123d import Location, import_step
    from OCP.gp import gp_Trsf
    from OCP.TopLoc import TopLoc_Location
    with open(sys.argv[1], encoding="utf-8") as f:
        d = json.load(f)
    palanca = import_step(d["palanca"])
    fijas = {k: import_step(v) for k, v in d["fijas"].items()}
    # la luz del banco (_conjunto.py del 06) se mide contra la placa + el brazo, SIN el soporte del eje (que esta a 2 mm de
    # la palanca en toda pose): se resta la caja del soporte, si viene
    fijas_luz, out_resta = {}, {}
    if d.get("caja_soporte"):
        from build123d import Box, Pos
        x0, y0, z0, x1, y1, z1 = d["caja_soporte"]
        caja = Pos((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2) * Box(x1 - x0, y1 - y0, z1 - z0)
        fijas_luz = {k: f - caja for k, f in fijas.items()}
        # la caja tiene que sacar SOLO el soporte (revisor del 17: un brazo que pasara por ahi se cortaria sin aviso)
        v_sop = (x1 - x0) * (y1 - y0) * (z1 - z0)
        dif = {k: round(f.volume - fijas_luz[k].volume - v_sop, 3) for k, f in fijas.items()}
        out_resta = {"resta_soporte": dif, "resta_soporte_ok": all(abs(v) < 1e-3 for v in dif.values())}
    else:
        out_resta = {}
    out = {"poses": {}, **out_resta}
    for ang, a in d["poses"].items():
        X, Y, Z, o = a[0:3], a[3:6], a[6:9], a[9:12]
        t = gp_Trsf()                                  # build123d 0.11 no arma un Location desde una Matrix
        t.SetValues(X[0], Y[0], Z[0], o[0], X[1], Y[1], Z[1], o[1], X[2], Y[2], Z[2], o[2])
        p = palanca.moved(Location(TopLoc_Location(t)))
        r = {}
        for k, f in fijas.items():
            inter = p.intersect(f)
            vol = sum(s.volume for s in inter.solids()) if inter is not None else 0.0
            r[k] = {"choque_mm3": round(vol, 3), "luz_mm": round(p.distance_to(f), 4) if vol < 1e-3 else 0.0}
            if vol < 1e-3 and fijas_luz.get(k) is not None:
                r[k]["luz_sin_soporte_mm"] = round(p.distance_to(fijas_luz[k]), 4)
        out["poses"][ang] = r
    print(json.dumps(out))


if __name__ == "__main__":
    main()
