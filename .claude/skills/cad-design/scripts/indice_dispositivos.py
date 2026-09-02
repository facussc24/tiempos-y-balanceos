# -*- coding: utf-8 -*-
# Interprete: .venv-cad (Py3.12). Correr:
#   C:\Dev\BarackMercosul\.venv-cad\Scripts\python.exe indice_dispositivos.py --help
"""Indice de los dispositivos que Barack YA fabrico — el catalogo del RETORNO DE EXPERIENCIA.

Por que existe. Fak, 31/08/2026, despues de la segunda entrega del dispositivo de
adhesivado: relevar lo que la casa ya tiene hecho y funcionando ANTES de inventar uno
nuevo — "no entiendo por que no lo hacemos". La regla "reusar antes de crear" ya estaba
escrita en CLAUDE.md desde siempre y no se cumplia por una razon boba: no habia forma de
saber que hay. Una regla que no se puede consultar no se puede cumplir.

Que hace: recorre las raices de dispositivosRaices.data.json y arma el catalogo de lo que
existe — nombre, donde vive, de que cliente/proyecto cuelga, que archivos tiene y de
cuando es. Eso es lo que el disco puede afirmar.

Que NO hace, a proposito: NO dice que resuelve cada dispositivo. Eso no sale del nombre de
un archivo, sale de abrirlo — y escribirlo sin abrirlo seria inventar (core-prohibiciones
#1, y la memoria el_nombre_no_es_el_contenido). El campo 'resuelve' nace en null y lo
completa quien lo mira; el re-escaneo lo CONSERVA por id, asi que describir un dispositivo
se hace una sola vez.

Y la trampa que este script esta escrito para no pisar: una raiz que no responde (Y: sin
cable) daria un indice CORTO, no un error. Un indice corto se lee igual que "no hay nada
parecido", que es justo la conclusion falsa que habilita a inventar de cero. Por eso cada
raiz sale con su estado, y --check devuelve 1 si una raiz obligatoria no se pudo abrir.

Codigos de salida: 0 OK · 1 falla (raiz obligatoria caida, indice viejo o inexistente).
"""
import argparse
import datetime as dt
import json
import os
import re
import sys
import time
import unicodedata

AQUI = os.path.dirname(os.path.abspath(__file__))
CANON = os.path.join(AQUI, "dispositivosRaices.data.json")
SALIDA_JSON = os.path.join(AQUI, "..", "data", "dispositivos.json")
SALIDA_MD = os.path.join(AQUI, "..", "data", "INDICE_DISPOSITIVOS.md")

OK, FALLA = 0, 1


def _canon():
    with open(CANON, "r", encoding="utf-8") as f:
        return json.load(f)


def _slug(txt):
    t = unicodedata.normalize("NFD", txt)
    t = "".join(c for c in t if unicodedata.category(c) != "Mn").lower()
    return re.sub(r"-{2,}", "-", re.sub(r"[^a-z0-9]+", "-", t)).strip("-")


def _tipo_de(ext, exts):
    for tipo, lista in exts.items():
        if tipo.startswith("_"):
            continue
        if ext in lista:
            return tipo
    return None


def escanear(canon, verbose=True):
    """Devuelve (raices, dispositivos). Nunca lanza por una raiz caida: la marca."""
    exts = canon["extensiones"]
    podar = {n.lower() for n in canon["ignorar"]["podar"]}
    contenedores = {n.lower() for n in canon["ignorar"]["contenedores"]}
    interesantes = {"modelo3d", "corte2d", "fabricacion"}   # hacen que una carpeta sea dispositivo

    raices_out, dispositivos = [], []

    for r in canon["raices"]:
        base = r["ruta"]
        estado, n_disp = "ok", 0
        t0 = time.time()   # cada paso imprime sus minutos: un escaneo que se fue de escala
                           # se ve en la primera corrida (skill cad-design, GATE 3.9)
        if not os.path.isdir(base):
            estado = "no-alcanzable"
            if verbose:
                print("  RAIZ NO ALCANZABLE  %-22s %s" % (r["id"], base))
            raices_out.append({**{k: r[k] for k in ("id", "ruta", "que", "obligatoria")},
                               "estado": estado, "dispositivos": 0})
            continue

        # carpeta -> {tipo: [archivos]}
        porCarpeta = {}
        for dirpath, dirnames, filenames in os.walk(base):
            dirnames[:] = [d for d in dirnames if d.lower() not in podar]
            destino = dirpath
            # si el archivo cae en una carpeta de utileria (files/, images/), el dispositivo
            # es el padre: "CALIBRE MINIATURA 3CM/files/x.stl" es el calibre, no "files".
            while os.path.basename(destino).lower() in contenedores and os.path.dirname(destino) != destino:
                destino = os.path.dirname(destino)
            for fn in filenames:
                tipo = _tipo_de(os.path.splitext(fn)[1].lower(), exts)
                if tipo is None:
                    continue
                d = porCarpeta.setdefault(destino, {})
                d.setdefault(tipo, []).append(os.path.join(dirpath, fn))

        for carpeta, archivos in sorted(porCarpeta.items()):
            if not (set(archivos) & interesantes):
                continue          # solo planos o fotos: no es un dispositivo, es documentacion
            rel = os.path.relpath(carpeta, base).replace("\\", "/")
            if rel == ".":
                continue          # la raiz misma no es un dispositivo
            partes = rel.split("/")
            try:
                fecha = max(os.path.getmtime(p) for lst in archivos.values() for p in lst)
                fecha = dt.datetime.fromtimestamp(fecha).strftime("%Y-%m-%d")
            except OSError:
                fecha = None
            dispositivos.append({
                "id": "%s/%s" % (r["id"], _slug(rel)),
                "nombre": partes[-1],
                "raiz": r["id"],
                "ruta": carpeta,
                "contexto": partes[:-1],
                "archivos": {t: sorted(os.path.basename(p) for p in lst)
                             for t, lst in sorted(archivos.items())},
                "fecha": fecha,
                "resuelve": None,
                "notas": None,
            })
            n_disp += 1

        raices_out.append({**{k: r[k] for k in ("id", "ruta", "que", "obligatoria")},
                           "estado": estado, "dispositivos": n_disp})
        if verbose:
            print("  %-22s %3d dispositivos  (%.1f s)" % (r["id"], n_disp, time.time() - t0))

    return raices_out, dispositivos


def _fusionar_descripciones(nuevos, path_viejo):
    """Un 'resuelve' se escribe una sola vez: el re-escaneo no lo pisa."""
    if not os.path.isfile(path_viejo):
        return 0
    try:
        with open(path_viejo, "r", encoding="utf-8") as f:
            viejo = json.load(f)
    except (OSError, ValueError):
        return 0
    prev = {d["id"]: d for d in viejo.get("dispositivos", [])}
    n = 0
    for d in nuevos:
        p = prev.get(d["id"])
        if p and (p.get("resuelve") or p.get("notas")):
            d["resuelve"], d["notas"] = p.get("resuelve"), p.get("notas")
            n += 1
    return n


def _escribir_md(datos, path):
    L = ["# Dispositivos que Barack ya fabrico",
         "",
         "Generado por `indice_dispositivos.py` el %s. **No se edita a mano**: el campo"
         % datos["generado"],
         "`resuelve` se escribe en `dispositivos.json` y el re-escaneo lo conserva.",
         "",
         "Para que existe: antes de disenar un dispositivo nuevo hay que mirar los que ya",
         "andan (regla `cad-3d.md`, GATE DE PROCESO punto C). Sin este indice, *reusar antes",
         "de crear* no se puede cumplir aunque este escrito.",
         "",
         "## Raices escaneadas", ""]
    for r in datos["raices"]:
        marca = "OK" if r["estado"] == "ok" else "**NO ALCANZABLE**"
        L.append("- %s `%s` — %s (%d) — %s" % (marca, r["id"], r["que"], r["dispositivos"], r["ruta"]))
    L += ["", "## Dispositivos (%d)" % len(datos["dispositivos"]), "",
          "| Dispositivo | De donde cuelga | Archivos | Fecha | Que resuelve |",
          "|---|---|---|---|---|"]
    for d in sorted(datos["dispositivos"], key=lambda x: (x["raiz"], x["nombre"].lower())):
        arch = ", ".join("%s %d" % (t, len(v)) for t, v in d["archivos"].items())
        L.append("| %s | %s | %s | %s | %s |"
                 % (d["nombre"], " / ".join(d["contexto"]) or "-", arch,
                    d["fecha"] or "-", d["resuelve"] or "_TBD — nadie lo abrio todavia_"))
    L.append("")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(L))


def cargar_indice(path=SALIDA_JSON):
    if not os.path.isfile(path):
        return None
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def dias_de_antiguedad(datos):
    try:
        gen = dt.datetime.strptime(datos["generado"], "%Y-%m-%d %H:%M:%S")
    except (KeyError, ValueError):
        return 1e9
    return (dt.datetime.now() - gen).total_seconds() / 86400.0


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--check", action="store_true",
                    help="no escanea: verifica que el indice exista, sea fresco y no tenga raices caidas")
    ap.add_argument("--buscar", metavar="TEXTO",
                    help="lista los dispositivos cuyo nombre o contexto contenga TEXTO")
    ap.add_argument("--dias", type=int, default=30, help="antiguedad maxima para --check (default 30)")
    ap.add_argument("--json", default=SALIDA_JSON)
    args = ap.parse_args()

    if args.buscar:
        datos = cargar_indice(args.json)
        if datos is None:
            print("No hay indice todavia. Correr: indice_dispositivos.py")
            return FALLA
        t = _slug(args.buscar)
        hits = [d for d in datos["dispositivos"]
                if t in _slug(d["nombre"] + " " + " ".join(d["contexto"]))]
        print("%d dispositivo(s) para '%s' (indice del %s):\n" % (len(hits), args.buscar, datos["generado"]))
        for d in hits:
            print("  %s" % d["nombre"])
            print("     %s" % d["ruta"])
            print("     archivos: %s | %s" %
                  (", ".join("%s(%d)" % (k, len(v)) for k, v in d["archivos"].items()), d["fecha"]))
            print("     resuelve: %s\n" % (d["resuelve"] or "TBD — nadie lo abrio todavia"))
        return OK

    if args.check:
        datos = cargar_indice(args.json)
        if datos is None:
            print("[GATE indice] No existe %s — correr indice_dispositivos.py" % args.json)
            return FALLA
        dias = dias_de_antiguedad(datos)
        caidas = [r for r in datos["raices"] if r["obligatoria"] and r["estado"] != "ok"]
        print("indice del %s (%.1f dias) — %d dispositivos, %d raices"
              % (datos["generado"], dias, len(datos["dispositivos"]), len(datos["raices"])))
        for r in caidas:
            print("  RAIZ OBLIGATORIA CAIDA: %s (%s)" % (r["id"], r["ruta"]))
        if caidas:
            print("\nUn indice al que le falta una raiz obligatoria se lee igual que 'no hay nada\n"
                  "parecido', que es justo la conclusion que habilita a inventar de cero.")
            return FALLA
        if dias > args.dias:
            print("\nIndice de mas de %d dias: re-escanear antes de apoyarse en el." % args.dias)
            return FALLA
        return OK

    print("escaneando las raices de %s ..." % os.path.basename(CANON))
    canon = _canon()
    raices, dispositivos = escanear(canon)
    datos = {"generado": dt.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
             "raices": raices, "dispositivos": dispositivos}
    heredadas = _fusionar_descripciones(dispositivos, args.json)

    os.makedirs(os.path.dirname(args.json), exist_ok=True)
    with open(args.json, "w", encoding="utf-8") as f:
        json.dump(datos, f, indent=2, ensure_ascii=False)
    _escribir_md(datos, SALIDA_MD)

    sin_describir = sum(1 for d in dispositivos if not d["resuelve"])
    print("\n%d dispositivos -> %s" % (len(dispositivos), args.json))
    print("                -> %s" % SALIDA_MD)
    if heredadas:
        print("%d descripciones conservadas del indice anterior." % heredadas)
    if sin_describir:
        print("%d sin describir: el campo 'resuelve' se completa ABRIENDO el dispositivo, "
              "nunca deduciendolo del nombre." % sin_describir)
    caidas = [r for r in raices if r["obligatoria"] and r["estado"] != "ok"]
    return FALLA if caidas else OK


if __name__ == "__main__":
    sys.exit(main())
