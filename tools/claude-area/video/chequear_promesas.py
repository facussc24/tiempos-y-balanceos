#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Control del video y del manual: no se le promete a la gente nada que no este PROBADO.

Lee promesas.json (una fila por cosa que el video dice que Claude hace) y sale con:
    0  todo lo que esta en el video esta probado, su archivo de prueba existe y la prueba es de ESTA version
    1  hay algo en el video sin probar, sin construir, con la prueba faltante, o probado sobre otras reglas
    2  promesas.json esta mal escrito

Una prueba vale para la version sobre la que se hizo: cada promesa probada lleva "probado_sobre" = la huella de
las reglas de la casa instaladas en la carpeta de demostracion cuando se probo (o el texto fijo
"no depende de las reglas" para lo que no contesta el asistente: una grabacion, una captura de la app).
Si las reglas instaladas hoy tienen otra huella, la prueba quedo vieja y hay que volver a correrla.

Uso:
    python chequear_promesas.py              la lista, con lo que falta
    python chequear_promesas.py --huella     la huella de las reglas instaladas hoy (para anotar una prueba nueva)
    python chequear_promesas.py --autoprueba comprueba que el control frena cuando tiene que frenar
"""
import hashlib
import io
import json
import os
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
REPO = AQUI.parents[2]
ESTADOS = ("probado", "sin probar", "no existe")
NO_DEPENDE = "no depende de las reglas"
REGLAS_INSTALADAS = Path(os.environ.get("CLAUDE_AREA_HOME", r"C:\ClaudeBarack")) / ".claude" / "rules" / "casa.md"


def huella_instalada(ruta=REGLAS_INSTALADAS):
    """Huella corta de las reglas de la casa instaladas, o None si la carpeta de demostracion no esta."""
    try:
        texto = Path(ruta).read_text(encoding="utf-8").replace("\r\n", "\n")
    except OSError:
        return None
    return hashlib.sha1(texto.encode("utf-8")).hexdigest()[:12]


def revisar(datos, raiz=REPO, huella="sin-mirar"):
    """Devuelve (filas, problemas). Un problema = una promesa del video que no se puede sostener."""
    if huella == "sin-mirar":
        huella = huella_instalada()
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
        vieja = False
        if estado == "probado":
            if not prueba_ok:
                problemas.append("%s: dice 'probado' y su prueba no esta en el disco (%s)" % (pid, p.get("prueba")))
            sobre = p.get("probado_sobre")
            if not sobre:
                problemas.append("%s: dice 'probado' y no dice sobre que version se probo (probado_sobre)" % pid)
            elif sobre != NO_DEPENDE:
                if huella is None:
                    problemas.append("%s: no puedo ver las reglas instaladas para saber si la prueba sigue valiendo" % pid)
                elif sobre != huella:
                    vieja = True
                    problemas.append("%s: la prueba es de otras reglas (%s) y hoy estan instaladas %s: volver a probar"
                                     % (pid, sobre, huella))
        if p.get("en_el_video") and estado != "probado":
            problemas.append("%s: esta en el video y esta '%s'" % (pid, estado))
        filas.append((pid, "prueba vieja" if vieja else estado, bool(p.get("en_el_video")), p.get("dice", "")))
    return filas, problemas


def autoprueba():
    """Las dos direcciones: lo bueno pasa, y cada forma de estar mal frena."""
    buena = {"promesas": [{"id": "a", "dice": "x", "pedido": "p", "en_el_video": True, "estado": "probado",
                           "prueba": "tools/claude-area/video/promesas.json", "probado_sobre": "abc123"}]}
    casos = [("lo bueno pasa", buena, "abc123", 0)]
    for nombre, cambio, huella in (
        ("en el video y sin probar", {"estado": "sin probar", "prueba": None}, "abc123"),
        ("en el video y no existe", {"estado": "no existe", "prueba": None}, "abc123"),
        ("probado con una prueba que no esta", {"prueba": "no/existe.md"}, "abc123"),
        ("sin pedido que la respalde", {"pedido": ""}, "abc123"),
        ("estado inventado", {"estado": "casi"}, "abc123"),
        ("probado sin decir sobre que version", {"probado_sobre": ""}, "abc123"),
        ("probado sobre otras reglas", {}, "zzz999"),
        ("no se pueden ver las reglas instaladas", {}, None),
    ):
        mala = json.loads(json.dumps(buena))
        mala["promesas"][0].update(cambio)
        casos.append((nombre, mala, huella, 1))
    fuera = json.loads(json.dumps(buena))
    fuera["promesas"][0].update({"en_el_video": False, "estado": "no existe", "prueba": None})
    casos.append(("fuera del video y sin construir no frena", fuera, "abc123", 0))
    fija = json.loads(json.dumps(buena))
    fija["promesas"][0]["probado_sobre"] = NO_DEPENDE
    casos.append(("lo que no depende de las reglas no envejece", fija, "zzz999", 0))
    fallas = 0
    for nombre, datos, huella, espera in casos:
        _, problemas = revisar(datos, huella=huella)
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
    if "--huella" in argv:
        print(huella_instalada() or "no encuentro las reglas instaladas en %s" % REGLAS_INSTALADAS)
        return 0
    try:
        datos = json.loads((AQUI / "promesas.json").read_text(encoding="utf-8"))
    except (OSError, ValueError) as e:
        print("ERROR: no pude leer promesas.json: %s" % e)
        return 2
    filas, problemas = revisar(datos)
    for pid, estado, en_video, dice in filas:
        marca = {"probado": "OK ", "sin probar": "?? ", "no existe": "NO ", "prueba vieja": "?? "}[estado]
        print("  [%s] %-22s %s%s" % (marca, pid, dice, "" if en_video else "  (no va en el video)"))
    print("  reglas instaladas hoy: %s" % (huella_instalada() or "no se ven"))
    if problemas:
        print("\nNO SE PUEDE FILMAR ASI: %d cosa(s) por cerrar" % len(problemas))
        for x in problemas:
            print("  - " + x)
        return 1
    print("\nTodo lo que el video promete esta probado, sobre las reglas instaladas hoy.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
