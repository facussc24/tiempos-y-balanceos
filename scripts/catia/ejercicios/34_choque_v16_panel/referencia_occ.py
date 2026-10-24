# -*- coding: utf-8 -*-
"""Arma referencia_occ.json del ejercicio 34: choque_exacto.py (skill cad-design, OpenCASCADE) del v16 y del gemelo
contra el panel, con los sha256 de los tres archivos, la fecha y el comando. Corre en .venv-cad y tarda minutos.
Uso: python referencia_occ.py                         (corre choque_exacto.py dos veces)
     python referencia_occ.py --desde <v16.txt> <gemelo.txt> --fecha "AAAA-MM-DD HH:MM"
                                                       (lee la salida de dos corridas ya hechas con el mismo comando)"""
import json
import os
import subprocess
import sys
import time

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
import catia as ej  # noqa: E402

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(AQUI))))
CHOQUE = os.path.join(REPO, ".claude", "skills", "cad-design", "scripts", "catia", "choque_exacto.py")
DZ = "1.0"


def comando(caso):
    return ["<.venv-cad>/python", "-I", os.path.relpath(CHOQUE, REPO).replace("\\", "/"), ej.ruta(caso), ej.ruta("panel"), DZ]


def resumir(crudo):
    """De la salida de choque_exacto.py, lo que usa el juez. Una medida «SIN MEDIR» no entra a la referencia."""
    inter, dmin = crudo.get("interseccion_fuzz_0.0001"), crudo.get("distancia_min")
    if not isinstance(inter, (int, float)) or not isinstance(dmin, (int, float)):
        raise ValueError(f"choque_exacto.py no termino una medida: {crudo}")
    return {"vol_utillaje": crudo["vol_utillaje"], "interseccion": inter, "distancia_min": dmin,
            "veredicto": crudo["veredicto"], "crudo": crudo}


def ultima_linea_json(texto):
    return json.loads([x for x in texto.strip().splitlines() if x.startswith("{")][-1])


def main():
    malas = ej.entradas_malas()
    if malas:
        sys.exit("entradas: " + "; ".join(malas))
    ref = {"que": "choque_exacto.py (OpenCASCADE) del v16 y del gemelo contra el panel; el juez del 34 compara CATIA "
                  "contra esto", "sha256": {n: ej.ENTRADAS[n][2] for n in ej.ENTRADAS},
           "comando": {c: " ".join(comando(c)) for c in ej.CASOS}, "casos": {}}
    if len(sys.argv) >= 4 and sys.argv[1] == "--desde":
        for caso, txt in zip(ej.CASOS, sys.argv[2:4]):
            with open(txt, encoding="utf-8") as f:
                ref["casos"][caso] = resumir(ultima_linea_json(f.read()))
        ref["fecha"] = sys.argv[sys.argv.index("--fecha") + 1] if "--fecha" in sys.argv else "sin fecha"
        ref["origen"] = "salida de corridas ya hechas: " + ", ".join(os.path.basename(x) for x in sys.argv[2:4])
    else:
        py = os.path.join(REPO, ".venv-cad", "Scripts", "python.exe")
        for caso in ej.CASOS:
            t = time.time()
            r = subprocess.run([py] + comando(caso)[1:], capture_output=True, text=True, cwd=REPO)
            ref["casos"][caso] = resumir(ultima_linea_json(r.stdout))
            ref["casos"][caso]["seg"] = round(time.time() - t)
        ref["fecha"] = time.strftime("%Y-%m-%d %H:%M")
    with open(ej.REFERENCIA, "w", encoding="utf-8") as f:
        json.dump(ref, f, ensure_ascii=False, indent=1)
        f.write("\n")
    print(json.dumps({c: {k: v for k, v in d.items() if k != "crudo"} for c, d in ref["casos"].items()}))


if __name__ == "__main__":
    main()
