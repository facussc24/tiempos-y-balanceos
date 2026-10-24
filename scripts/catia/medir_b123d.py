# -*- coding: utf-8 -*-
"""Mide con build123d (el otro motor) lo que el juez compara contra CATIA. Corre con .venv-cad:

    python -I medir_b123d.py bien <bien.py del banco> <carpeta>   corre el bien.py en <carpeta> y mide el STEP de cada
                                                                  parte (el .json del conjunto dice cuales); si no hay
                                                                  .json, cada .step de la carpeta
    python -I medir_b123d.py step <archivo.stp> [...]             mide esos STEP (los que exporto CATIA)

Ultima linea de la salida: un JSON {"partes": {parte: {"volumen", "cdg_mm", "solidos"}}, "seg"}. Volumen en mm3 y
centro de gravedad en mm (promedio de los centros de cada solido pesado por su volumen).
"""
import json
import os
import subprocess
import sys
import time


def medir(ruta):
    from build123d import CenterOf, import_step
    forma = import_step(ruta)
    solidos = forma.solids()
    vols = [s.volume for s in solidos]
    total = sum(vols)
    cdg = [0.0, 0.0, 0.0]
    for s, v in zip(solidos, vols):
        c = s.center(CenterOf.MASS)
        for i, x in enumerate((c.X, c.Y, c.Z)):
            cdg[i] += x * v / total
    return {"volumen": round(total, 3), "cdg_mm": [round(x, 4) for x in cdg], "solidos": len(solidos)}


def partes_del_conjunto(carpeta):
    """{parte: ruta} desde el .json del conjunto ("archivos"); si no hay .json, cada .step de la carpeta."""
    for n in sorted(os.listdir(carpeta)):
        if n.lower().endswith(".json"):
            try:
                d = json.load(open(os.path.join(carpeta, n), encoding="utf-8"))
            except ValueError:
                continue
            if isinstance(d.get("archivos"), dict):
                return {k: os.path.join(carpeta, v) for k, v in d["archivos"].items()}
    return {os.path.splitext(n)[0]: os.path.join(carpeta, n) for n in sorted(os.listdir(carpeta))
            if n.lower().endswith((".step", ".stp"))}


def main():
    t0 = time.time()
    if len(sys.argv) >= 4 and sys.argv[1] == "bien":
        bien, carpeta = os.path.abspath(sys.argv[2]), os.path.abspath(sys.argv[3])
        os.makedirs(carpeta, exist_ok=True)
        r = subprocess.run([sys.executable, "-I", bien, carpeta], capture_output=True, text=True, timeout=600)
        if r.returncode != 0:
            print(json.dumps({"error": f"bien.py salio con {r.returncode}: {(r.stderr or r.stdout)[-600:]}"}))
            return 1
        rutas = partes_del_conjunto(carpeta)
    elif len(sys.argv) >= 3 and sys.argv[1] == "step":
        rutas = {os.path.splitext(os.path.basename(a))[0]: os.path.abspath(a) for a in sys.argv[2:]}
    else:
        print(__doc__, file=sys.stderr)
        return 2
    out = {"partes": {}}
    for k, ruta in rutas.items():
        try:
            out["partes"][k] = {**medir(ruta), "archivo": ruta}
        except Exception as e:  # noqa: BLE001
            out["partes"][k] = {"error": repr(e)[:300], "archivo": ruta}
    out["seg"] = round(time.time() - t0, 1)
    print(json.dumps(out, ensure_ascii=True))
    return 0


if __name__ == "__main__":
    sys.exit(main())
