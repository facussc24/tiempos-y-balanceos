# -*- coding: utf-8 -*-
"""auditar_cadena — que hay en este directorio de trabajo que NO es de esta corrida.

Recorre las salidas JSON de un directorio y dice cual esta VIEJA respecto de sus
entradas, cual quedo de una corrida ABORTADA y cual murio a mitad de camino.

Lo importante no es la lista: es la PROPAGACION. En el incidente que origino esto,
`params.json` era mas nuevo que `calibracion.json` — por fecha estaba impecable —
pero `calibracion.json` era el sobrante de una corrida que habia abortado. Todo lo
que colgaba de ahi estaba construido sobre el diseno anterior y ningun chequeo
local lo veia. Por eso una salida cuya entrada esta podrida se marca CONTAMINADA
aunque ella misma sea la mas nueva del directorio.

Solo LEE: no borra ni mueve nada (los `.ABORTADO` son la forensia de que paso).

USO
    auditar_cadena.py <dir> [--recursivo] [--patron *.json] [--exigir-sello]
                            [--json informe.json] [--solo-autotest]

CODIGOS DE SALIDA
    0 todo en orden · 1 hay salidas podridas · 2 error de uso
    3 el autotest del propio auditor fallo (no se audita nada con guardias ciegas)
"""
import argparse
import glob
import json
import os
import shutil
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from cadlib import pipeline as pl                                        # noqa: E402
from cadlib.pipeline import (ABORTADO, CORRIDA_MURIO, ENTRADA_FALTA, FIRMA_DISTINTA,  # noqa: E402
                             FRESCA, NO_EXISTE, SIN_SELLO, VIEJA, Paso, Frescura,
                             salida_fresca)

CONTAMINADA = "CONTAMINADA"
ORDEN = [CORRIDA_MURIO, ABORTADO, NO_EXISTE, ENTRADA_FALTA, FIRMA_DISTINTA, VIEJA,
         CONTAMINADA, SIN_SELLO, FRESCA]


def candidatos(directorio, patron="*.json", recursivo=False):
    """Salidas a auditar: los JSON vivos + los que solo dejaron marca de aborto."""
    raiz = os.path.abspath(directorio)
    pat = os.path.join(raiz, "**", patron) if recursivo else os.path.join(raiz, patron)
    vistos = {}
    for p in glob.glob(pat, recursive=recursivo):
        if not os.path.isfile(p):
            continue
        b = os.path.basename(p)
        if b.startswith(".tmp_") or b.endswith(".sello.json"):
            continue
        vistos[os.path.abspath(p)] = True
    # marcas: la salida puede no existir justamente porque aborto
    for suf in (pl.SUF_ABORTADO, pl.SUF_EN_CURSO):
        pat2 = (os.path.join(raiz, "**", "*" + suf) if recursivo
                else os.path.join(raiz, "*" + suf))
        for m in glob.glob(pat2, recursive=recursivo):
            vistos.setdefault(os.path.abspath(m[: -len(suf)]), True)
    # sidecars de salidas que no son JSON (.step, .npy)
    pat3 = (os.path.join(raiz, "**", "*.sello.json") if recursivo
            else os.path.join(raiz, "*.sello.json"))
    for s in glob.glob(pat3, recursive=recursivo):
        vistos.setdefault(os.path.abspath(s[: -len(".sello.json")]), True)
    return sorted(vistos)


def _entradas_declaradas(archivo):
    """Entradas que el archivo declara (sello propio o sidecar). [] si no declara."""
    base = os.path.dirname(os.path.abspath(archivo))
    sello = pl.leer_sello(archivo)
    if sello is None and os.path.isfile(archivo + ".sello.json"):
        sello = (pl.leer_sello(archivo + ".sello.json") or {})
    return [pl._resolver(k, base) for k in (sello or {}).get("entradas", {})]


def auditar(directorio, patron="*.json", recursivo=False, exigir_sello=False):
    """Lista de registros por salida, con la contaminacion ya propagada."""
    fichas = {}
    for p in candidatos(directorio, patron, recursivo):
        fr = salida_fresca(p, exigir_sello=exigir_sello)
        fichas[p] = {"archivo": p, "codigo": fr.codigo, "ok": fr.ok, "razon": fr.razon,
                     "entradas": _entradas_declaradas(p), "via": None}

    # --- propagacion: una salida impecable cuya ENTRADA esta podrida, tambien lo esta ---
    def sano(p, pila):
        f = fichas.get(p)
        if f is None:                       # entrada de hoja, fuera del directorio auditado
            fr = salida_fresca(p)
            return fr.ok or fr.codigo == SIN_SELLO, None
        if p in pila:                       # ciclo: no se cuelga
            return True, None
        if f.get("_resuelto"):
            return f["ok"], f["via"]
        f["_resuelto"] = True
        if not f["ok"]:
            return False, None
        for e in f["entradas"]:
            ok_e, _ = sano(e, pila | {p})
            if not ok_e:
                f.update({"ok": False, "codigo": CONTAMINADA, "via": e,
                          "razon": "es mas nueva que sus entradas, pero '%s' NO es de fiar: "
                                   "lo que se construyo con esto sale del diseno anterior"
                                   % os.path.basename(e)})
                return False, e
        return True, None

    for p in list(fichas):
        sano(p, frozenset())
    for f in fichas.values():
        f.pop("_resuelto", None)
    return sorted(fichas.values(),
                  key=lambda f: (ORDEN.index(f["codigo"]) if f["codigo"] in ORDEN else 0,
                                 f["archivo"]))


def informe(fichas, directorio, verbose=True, solo_hallazgos=False):
    """Imprime y devuelve la cantidad de salidas podridas."""
    malas = [f for f in fichas if not f["ok"]]
    if verbose:
        print("CADENA en %s  (%d salida(s))" % (os.path.abspath(directorio), len(fichas)))
        if not fichas:
            print("   (no hay salidas que auditar)")
        for f in (malas if solo_hallazgos else fichas):
            if f["codigo"] == SIN_SELLO:                  # 100 lineas iguales no informan
                print("   %-15s %-34s no declara sus entradas: no se puede juzgar"
                      % (f["codigo"], os.path.basename(f["archivo"])))
                continue
            marca = "  " if f["ok"] else "->"
            razon = "" if f["codigo"] == FRESCA else f["razon"].strip()
            corto = razon.splitlines()[0] if razon else ""
            if len(corto) > 150:
                corto = corto[:147] + "..."
            print("%s %-15s %-34s %s%s"
                  % (marca, f["codigo"], os.path.basename(f["archivo"]), corto,
                     " [...]" if corto != razon else ""))
        print("\n   %d en orden, %d podrida(s), %d sin sello"
              % (sum(1 for f in fichas if f["codigo"] == FRESCA), len(malas),
                 sum(1 for f in fichas if f["codigo"] == SIN_SELLO)))
        if malas:
            print("   NO encadenar nada sobre estas hasta volver a correr el paso que las "
                  "genera\n   y verificar que TERMINE (que escriba su salida, no que 'no "
                  "haya dado error').")
    return len(malas)


# =========================================================================================
# AUTOTEST — corre en cada invocacion. Sin par BIEN/MAL, deteccion declarada CERO.
# =========================================================================================
def autotest(verbose=True):
    prob = []
    di = print if verbose else (lambda *a, **k: None)
    d = tempfile.mkdtemp(prefix="autotest_auditar_")
    p = lambda *x: os.path.join(d, *x)
    a, b, c = p("medida.json"), p("calibracion.json"), p("params.json")
    try:
        # cadena sana: medida -> calibracion -> params
        pl._volcar_json(a, {"ranura": 12.96})
        with Paso("calibrar", entradas=[a], salidas=[b], base=d, verbose=False) as ps:
            ps.escribir_json(b, {"elegida": {"brazo": 25.0}})
        with Paso("aplicar", entradas=[b], salidas=[c], base=d, verbose=False) as ps:
            ps.escribir_json(c, {"durezas": {"media": 1.6}})

        f = {x["archivo"]: x for x in auditar(d)}
        n = informe(list(f.values()), d, verbose=False)
        di("    1 BIEN  cadena sana                    -> %d podrida(s), params=%s"
           % (n, f[c]["codigo"]))
        if n != 0:
            prob.append("1: una cadena sana da %d podridas: FALSO POSITIVO (%s)"
                        % (n, [x["razon"] for x in f.values() if not x["ok"]]))

        # --- MAL 2: el eslabon del medio queda de una corrida ABORTADA (el caso 1) -------
        try:
            with Paso("calibrar", entradas=[a], salidas=[b], base=d, verbose=False):
                raise SystemExit(1)
        except SystemExit:
            pass
        f = {x["archivo"]: x for x in auditar(d)}
        n = informe(list(f.values()), d, verbose=False)
        di("    2 MAL   calibracion ABORTADA           -> %d podrida(s): calibracion=%s "
           "params=%s" % (n, f[b]["codigo"], f[c]["codigo"]))
        if f[b]["ok"]:
            prob.append("2: el auditor no ve la salida abortada")
        if f[c]["ok"]:
            prob.append("2: params NO quedo marcado. Es el caso 1 tal cual: params es el "
                        "archivo mas nuevo del directorio y esta construido sobre una corrida "
                        "que aborto — si el auditor lo deja pasar, no sirve para nada")
        if n < 2:
            prob.append("2: solo marco %d salida(s); tienen que ser 2 (la abortada y la que "
                        "cuelga de ella)" % n)

        # --- MAL 3: contaminacion silenciosa (todo existe, todo parece nuevo) -----------
        with Paso("calibrar", entradas=[a], salidas=[b], base=d, verbose=False) as ps:
            ps.escribir_json(b, {"elegida": {"brazo": 25.0}})
        with Paso("aplicar", entradas=[b], salidas=[c], base=d, verbose=False) as ps:
            ps.escribir_json(c, {"durezas": {"media": 1.6}})
        t = os.stat(c).st_mtime_ns + 10 ** 9      # se re-midio la pieza DESPUES de todo
        os.utime(a, ns=(t, t))
        f = {x["archivo"]: x for x in auditar(d)}
        solo_c = salida_fresca(c)                 # el gemelo: c mirado solo, sin la cadena
        di("    3 MAL   se re-midio la entrada de raiz -> calibracion=%s params=%s   "
           "(gemelo: params mirado solo da %s)"
           % (f[b]["codigo"], f[c]["codigo"], solo_c.codigo))
        if f[b]["codigo"] != VIEJA:
            prob.append("3: calibracion tendria que dar VIEJA y dio '%s'" % f[b]["codigo"])
        if f[c]["ok"] or f[c]["codigo"] != CONTAMINADA:
            prob.append("3: params dio '%s': el auditor mira archivo por archivo y no sigue "
                        "la cadena — justo el agujero por donde se colo el incidente"
                        % f[c]["codigo"])
        if not solo_c.ok:
            prob.append("3: el caso no prueba nada (params ya daba mal mirado solo, no hacia "
                        "falta propagar)")

        # --- MAL 4: corrida muerta (proceso killed, queda .EN_CURSO) --------------------
        os.utime(a, ns=(os.stat(b).st_mtime_ns - 10 ** 9,) * 2)
        os.replace(b, b + pl.SUF_EN_CURSO)        # lo que deja un kill a mitad de camino
        f = {x["archivo"]: x for x in auditar(d)}
        di("    4 MAL   proceso muerto (.EN_CURSO)     -> calibracion=%s params=%s"
           % (f[b]["codigo"], f[c]["codigo"]))
        if f[b]["codigo"] != CORRIDA_MURIO:
            prob.append("4: una corrida muerta dio '%s' en vez de %s"
                        % (f[b]["codigo"], CORRIDA_MURIO))
        if f[c]["ok"]:
            prob.append("4: params sigue OK con su entrada a medio escribir")
    finally:
        shutil.rmtree(d, ignore_errors=True)
    return prob


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("directorio", nargs="?", help="directorio de trabajo de la cadena")
    ap.add_argument("--patron", default="*.json")
    ap.add_argument("--recursivo", action="store_true")
    ap.add_argument("--exigir-sello", action="store_true",
                    help="una salida que no declara sus entradas cuenta como hallazgo")
    ap.add_argument("--solo-hallazgos", action="store_true",
                    help="listar solo lo podrido (util en directorios grandes)")
    ap.add_argument("--json", default=None, help="volcar el informe")
    ap.add_argument("--solo-autotest", action="store_true")
    a = ap.parse_args()

    print("AUTOTEST del auditor (par BIEN/MAL: cadena sana vs cadena podrida)")
    if pl.correr_autotest(verbose=False):
        return pl.EXIT_AUTOTEST
    prob = autotest()
    if prob:
        print("  [AUTOTEST FALLA]")
        for x in prob:
            print("    - " + x)
        print("  No se audita ninguna cadena con un auditor que no probo detectar.")
        return pl.EXIT_AUTOTEST
    print("  [AUTOTEST OK] el auditor separa la cadena sana de la podrida "
          "(y sigue la contaminacion).\n")
    if a.solo_autotest:
        return 0
    if not a.directorio:
        print("Falta el directorio a auditar.", file=sys.stderr)
        return 2
    if not os.path.isdir(a.directorio):
        print("No es un directorio: %s" % a.directorio, file=sys.stderr)
        return 2

    fichas = auditar(a.directorio, a.patron, a.recursivo, a.exigir_sello)
    n = informe(fichas, a.directorio, solo_hallazgos=a.solo_hallazgos)
    if a.json:
        pl._volcar_json(a.json, {"directorio": os.path.abspath(a.directorio),
                                 "podridas": n, "salidas": fichas})
        print("   informe -> %s" % a.json)
    return 1 if n else 0


if __name__ == "__main__":
    sys.exit(main())
