# -*- coding: utf-8 -*-
"""Mide con build123d (el otro motor) lo que el juez compara contra CATIA. Corre con .venv-cad:

    python -I medir_b123d.py bien <bien.py del banco> <carpeta>   corre el bien.py en <carpeta> y mide el STEP de cada
                                                                  parte (el .json del conjunto dice cuales); si no hay
                                                                  .json, cada .step de la carpeta
    python -I medir_b123d.py step <archivo.stp> [...]             mide esos STEP (los que exporto CATIA)
    python -I medir_b123d.py stl <archivo.stl> [...]              volumen con signo de cada STL (trimesh) y si cierra

Ultima linea de la salida: un JSON {"partes": {parte: {"volumen", "cdg_mm", "solidos", "area", "cascaras",
"caras_sueltas"}}, "seg"} (con stl: {"volumen_stl", "cerrado", "triangulos"}). Area en mm2, volumen en mm3 y centro de
gravedad en mm (promedio de los centros de cada solido pesado por su volumen).
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
    # 24/10/2026, ejercicio 09 (superficies): el area de la piel, y cascaras y caras sueltas del archivo (CATIA exporta lo
    # visible: con las superficies de construccion a la vista el STEP trae el solido Y cascaras sueltas, y solids() sigue
    # dando 1; NOTAS 19/10: «8 cascaras sueltas (968 caras)»)
    return {"volumen": round(total, 3), "cdg_mm": [round(x, 4) for x in cdg], "solidos": len(solidos),
            "area": round(sum(s.area for s in solidos), 3), "cascaras": len(forma.shells()),
            "caras_sueltas": len(forma.faces()) - sum(len(s.faces()) for s in solidos)}


def medir_stl(ruta):
    """Lo que dice la malla de un STL sobre el sentido de sus caras (trimesh). Un solido de CATIA con las caras hacia
    adentro tiene el volumen B-Rep bien y el STL RESTA esa parte (NOTAS 19/10, v16: 85 849,6 contra 89 278, -3,84 %, del
    orden del facetado: el porcentaje solo NO lo separa, revisor del 13, 24/10). Lo que lo separa:
    - una zona dada vuelta pegada al resto deja la orientacion de los triangulos inconsistente (orientacion_consistente);
    - una cascara dada vuelta suelta tiene volumen NEGATIVO (partes_negativas, cada cuerpo conectado por separado).
    No se pudo reproducir en CATIA (el 09 sin Invert dio el mismo STL, 24/10 09:48): el detector se prueba con mallas."""
    import trimesh
    m = trimesh.load(ruta, force="mesh")
    partes = m.split(only_watertight=False)
    return {"volumen_stl": round(float(m.volume), 3), "cerrado": bool(m.is_watertight),
            "orientacion_consistente": bool(m.is_winding_consistent), "partes": len(partes),
            "partes_negativas": sum(1 for p in partes if p.volume < 0), "triangulos": len(m.faces)}


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
    elif len(sys.argv) >= 3 and sys.argv[1] == "stl":
        out = {"partes": {}}
        for a in sys.argv[2:]:
            k = os.path.splitext(os.path.basename(a))[0]
            try:
                out["partes"][k] = {**medir_stl(a), "archivo": os.path.abspath(a)}
            except Exception as e:  # noqa: BLE001
                out["partes"][k] = {"error": repr(e)[:300], "archivo": os.path.abspath(a)}
        out["seg"] = round(time.time() - t0, 1)
        print(json.dumps(out, ensure_ascii=True))
        return 0
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
