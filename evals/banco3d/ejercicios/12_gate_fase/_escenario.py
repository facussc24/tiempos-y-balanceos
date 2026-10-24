# -*- coding: utf-8 -*-
"""Ayuda comun del ejercicio 12: arma un workdir NUEVO (carpeta con fecha y hora, no se borra nada) con el conjunto de la
palanca del 06 (base + soporte del eje + palanca que gira de 0 a 60 grados, armado con el _conjunto.py del 06 sin
tocarlo) y deja arriba un solo escenario.json con la secuencia de llamadas a gate_fase.py que corre el corrector.

La evidencia de la fase 0 (zona_confirmada y proceso_declarado) va SEMBRADA en el manifest: el GATE 0 y el GATE P se
prueban en sus propios tests; aca se prueba el freno entre fases. Piezas de ensayo del banco, medidas sin fuente de
Barack.

Uso desde bien.py / mal_*.py: escenario(pasos, retoque_dy=None) con pasos = [[op, fase, {opcion: valor}], ...]; los
valores "$STEP" y "$MOV" se cambian por el STEP y el json del conjunto. Si hay retoque, el paso ["retocar"] copia el
soporte corrido retoque_dy mm en Y (y el conjunto) sobre los de out/."""
import json
import os
import sys
import time

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.normpath(os.path.join(AQUI, "..", "..", "..", ".."))
sys.path.insert(0, os.path.join(AQUI, "..", "06_palanca_0_60"))
sys.path.insert(0, os.path.join(RAIZ, ".claude", "skills", "cad-design", "scripts"))


def escenario(pasos, retoque_dy=None):
    if len(sys.argv) < 2:
        print("uso: python <script> <carpeta de salida>", file=sys.stderr)
        sys.exit(2)
    sub = os.path.abspath(sys.argv[1])
    w = os.path.join(sub, "wd_%s" % time.strftime("%Y%m%d_%H%M%S"))
    out = os.path.join(w, "out")
    os.makedirs(out, exist_ok=True)
    from _conjunto import armar
    sys.argv[1] = out
    armar("palanca_0_60", chequeos=[(0, "libre"), (35, "libre"), (60, "libre")])
    sys.argv[1] = sub
    from cadlib import workdir
    workdir.ensure_workdir(w)
    workdir.record_evidence(w, "zona_confirmada", quien="Fak", ids=["banco"], evidencia="sembrada por el banco")
    workdir.record_evidence(w, "proceso_declarado", no_resueltas=[])
    copias = []
    if retoque_dy is not None:
        # en un proceso aparte: en el mismo proceso que ya corrio armar(), export_step falla con «Failed to write STEP
        # file» (medido el 24/10/2026; en un proceso nuevo los mismos solidos se exportan bien)
        import subprocess
        ret = os.path.join(w, "retocado")
        r = subprocess.run([sys.executable, "-I", os.path.abspath(__file__), "--retocar", out, ret, str(retoque_dy)],
                           capture_output=True, text=True, encoding="utf-8", errors="replace")
        if r.returncode != 0:
            print(r.stdout + r.stderr, file=sys.stderr)
            sys.exit(2)
        for nombre in ("palanca_0_60__soporte.step", "palanca_0_60.step"):
            copias.append([os.path.join(ret, nombre), os.path.join(out, nombre)])
    conj, mov = os.path.join(out, "palanca_0_60.step"), os.path.join(out, "palanca_0_60.json")
    lista = []
    for p in pasos:
        if p[0] == "retocar":
            lista.append({"copiar": copias})
            continue
        op, n, opc = p[0], p[1], dict(p[2] if len(p) > 2 else {})
        args = [op, "--workdir", w] + (["--fase", str(n)] if n is not None else [])
        for k, v in opc.items():
            args += ["--" + k, {"$STEP": conj, "$MOV": mov}.get(v, v)]
        lista.append({"args": args})
    with open(os.path.join(sub, "escenario.json"), "w", encoding="utf-8") as f:
        json.dump({"workdir": w, "pasos": lista, "nota": "piezas de ensayo del banco; la fase 0 va sembrada"}, f,
                  indent=1, ensure_ascii=False)
    print("ok", w)


def retocar(out, ret, dy):
    """El soporte del eje corrido dy mm en Y: escribe en ret/ su STEP y el del conjunto (los copia el corrector)."""
    from build123d import Compound, Pos, export_step, import_step
    os.makedirs(ret, exist_ok=True)
    partes = {}
    for p in ("base", "soporte", "palanca"):
        # el Compound de import_step no se puede volver a exportar ("Failed to write STEP file"): van sus solidos
        sol = import_step(os.path.join(out, "palanca_0_60__%s.step" % p)).solids()
        partes[p] = sol[0] if len(sol) == 1 else Compound(children=list(sol))
    partes["soporte"] = Pos(0, dy, 0) * partes["soporte"]
    export_step(partes["soporte"], os.path.join(ret, "palanca_0_60__soporte.step"))
    export_step(Compound(children=[partes["base"], partes["soporte"], partes["palanca"]]),
                os.path.join(ret, "palanca_0_60.step"))


if __name__ == "__main__" and len(sys.argv) == 5 and sys.argv[1] == "--retocar":
    retocar(sys.argv[2], sys.argv[3], float(sys.argv[4]))
