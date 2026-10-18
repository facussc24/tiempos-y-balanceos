# -*- coding: utf-8 -*-
"""temaCasa.py — carga el tema de lo que entrega Ingenieria (scripts/_lib/tema.json) y verifica el logo.

El logo se compara por sha256 contra el que dice el tema (core-prohibiciones.md §9: el logo de Barack sale de UN solo
archivo). Si no coincide, o si no esta, NO devuelve el tema: frena con TemaError. Asi el hash se usa, no queda escrito.
Gemelo en JS: scripts/_lib/temaCasa.mjs. Tanda 16, pieza 3.

Uso desde un generador (cualquier carpeta de scripts/):
    sys.path.insert(0, os.path.join(<raiz del repo>, "scripts", "_lib"))
    import temaCasa
    AZUL = RGBColor.from_string(temaCasa.color("cabecera"))

    python scripts/_lib/temaCasa.py            # dice si el tema carga y si el logo es el oficial (sale 1 si no)
"""
import hashlib
import json
import os
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(os.path.dirname(AQUI))
TEMA_JSON = os.path.join(AQUI, "tema.json")


class TemaError(Exception):
    pass


def sha256(ruta):
    h = hashlib.sha256()
    with open(ruta, "rb") as f:
        for bloque in iter(lambda: f.read(1 << 16), b""):
            h.update(bloque)
    return h.hexdigest()


_CACHE = {}


def cargar(ruta_tema=TEMA_JSON, raiz=RAIZ):
    """El tema como dict, con 'logo.ruta' absoluta. Frena (TemaError) si el logo no es el oficial."""
    clave = (os.path.abspath(ruta_tema), os.path.abspath(raiz))
    if clave in _CACHE:
        return _CACHE[clave]
    try:
        with open(ruta_tema, encoding="utf-8") as f:
            tema = json.load(f)
    except (OSError, ValueError) as e:
        raise TemaError(f"no pude leer el tema {ruta_tema}: {e}")
    logo = os.path.join(raiz, tema["logo"]["ruta_repo"])
    if not os.path.isfile(logo):
        raise TemaError(f"no esta el logo oficial en {logo}")
    real = sha256(logo)
    if real != tema["logo"]["sha256"]:
        raise TemaError(f"el logo {logo} NO es el oficial (sha256 {real[:12]}..., el tema dice {tema['logo']['sha256'][:12]}...)")
    tema["logo"]["ruta"] = logo
    _CACHE[clave] = tema
    return tema


def color(nombre, **kw):
    """Hex sin '#' (ej. '44546A'), como lo pide RGBColor.from_string y openpyxl."""
    c = cargar(**kw)["colores"].get(nombre)
    if not isinstance(c, dict) or "valor" not in c:
        raise TemaError(f"el tema no tiene el color «{nombre}»")
    return c["valor"]


def letra(**kw):
    return cargar(**kw)["letra"]["nombre"]


def logo(**kw):
    return cargar(**kw)["logo"]["ruta"]


if __name__ == "__main__":
    try:
        t = cargar()
    except TemaError as e:
        print(f"ROJO: {e}")
        sys.exit(1)
    print(f"VERDE: tema cargado; logo oficial {t['logo']['sha256'][:12]}... en {t['logo']['ruta_repo']}; "
          f"letra {t['letra']['nombre']}; cabecera {color('cabecera')}; acento {color('acento')} ({t['colores']['acento']['estado'].split(':')[0]})")
