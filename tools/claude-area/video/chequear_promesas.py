#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Control del video y del manual: no se le promete a la gente nada que no este PROBADO.

Lee promesas.json (una fila por cosa que el video dice que Claude hace) y sale con:
    0  todo lo que esta en el video esta probado y su archivo de prueba existe
    1  hay algo en el video sin probar, sin construir, o cuya prueba no esta en el disco
    2  promesas.json esta mal escrito

Uso:
    python chequear_promesas.py              la lista, con lo que falta
    python chequear_promesas.py --autoprueba comprueba que el control frena cuando tiene que frenar
"""
import io
import json
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
REPO = AQUI.parents[2]
ESTADOS = ("probado", "sin probar", "no existe")


def revisar(datos, raiz=REPO):
    """Devuelve (filas, problemas). Un problema = una promesa del video que no se puede sostener."""
    filas, problemas = [], []
    vistos = set()
    for p in datos.get("promesas", []):
        pid = p.get("id", "?")
        if pid in vistos:
            problemas.append("%s: el id esta repetido" % pid)
        vistos.add(pid)
        estado = p.get("estado")
        if estado not in ESTADOS:
            problemas.append("%s: estado '%s' no es uno de %s" % (pid, estado, ", ".join(ESTADOS)))
            continue
        if not p.get("pedido"):
            problemas.append("%s: no dice que pedido de Facundo la respalda" % pid)
        prueba_ok = bool(p.get("prueba")) and (Path(raiz) / p["prueba"]).exists()
        if estado == "probado" and not prueba_ok:
            problemas.append("%s: dice 'probado' y su prueba no esta en el disco (%s)" % (pid, p.get("prueba")))
        if p.get("en_el_video") and estado != "probado":
            problemas.append("%s: esta en el video y esta '%s'" % (pid, estado))
        filas.append((pid, estado, bool(p.get("en_el_video")), p.get("dice", "")))
    return filas, problemas


def autoprueba():
    """Las dos direcciones: lo bueno pasa, y cada forma de estar mal frena."""
    buena = {"promesas": [{"id": "a", "dice": "x", "pedido": "p", "en_el_video": True, "estado": "probado",
                           "prueba": "tools/claude-area/video/promesas.json"}]}
    casos = [("lo bueno pasa", buena, 0)]
    for nombre, cambio in (
        ("en el video y sin probar", {"estado": "sin probar", "prueba": None}),
        ("en el video y no existe", {"estado": "no existe", "prueba": None}),
        ("probado con una prueba que no esta", {"prueba": "no/existe.md"}),
        ("sin pedido que la respalde", {"pedido": ""}),
        ("estado inventado", {"estado": "casi"}),
    ):
        mala = json.loads(json.dumps(buena))
        mala["promesas"][0].update(cambio)
        casos.append((nombre, mala, 1))
    fuera = json.loads(json.dumps(buena))
    fuera["promesas"][0].update({"en_el_video": False, "estado": "no existe", "prueba": None})
    casos.append(("fuera del video y sin construir no frena", fuera, 0))
    fallas = 0
    for nombre, datos, espera in casos:
        _, problemas = revisar(datos)
        sale = 1 if problemas else 0
        ok = sale == espera
        fallas += 0 if ok else 1
        print("  [%s] %s" % ("OK " if ok else "MAL", nombre))
    print("AUTOPRUEBA: %s" % ("todo bien" if not fallas else "%d caso(s) mal" % fallas))
    return 1 if fallas else 0


def main(argv):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    if "--autoprueba" in argv:
        return autoprueba()
    try:
        datos = json.loads((AQUI / "promesas.json").read_text(encoding="utf-8"))
    except (OSError, ValueError) as e:
        print("ERROR: no pude leer promesas.json: %s" % e)
        return 2
    filas, problemas = revisar(datos)
    for pid, estado, en_video, dice in filas:
        marca = {"probado": "OK ", "sin probar": "?? ", "no existe": "NO "}[estado]
        print("  [%s] %-22s %s%s" % (marca, pid, dice, "" if en_video else "  (no va en el video)"))
    if problemas:
        print("\nNO SE PUEDE FILMAR ASI: %d cosa(s) por cerrar" % len(problemas))
        for x in problemas:
            print("  - " + x)
        return 1
    print("\nTodo lo que el video promete esta probado.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
