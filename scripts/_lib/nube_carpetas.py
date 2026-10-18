# -*- coding: utf-8 -*-
"""nube_carpetas.py — las carpetas del asistente en la nube de Ingenieria, para los programas en Python.

Gemelo de `resolverCarpeta()` de scripts/_lib/nubeRutas.mjs: lee el MISMO canon (`nubeCarpetas.data.json`, mudanza del
17/10/2026) y aplica la misma regla: la ruta nueva (adentro de «ASISTENTE INGENIERIA») si existe; si no, la primera
vieja que exista; si no existe ninguna, la nueva. Test de las dos resoluciones: __tests__/scripts/nubeCarpetas.test.mjs.
"""
import json
import os
import re
from pathlib import Path

_CANON = Path(__file__).with_name('nubeCarpetas.data.json')


def canon():
    with open(_CANON, encoding='utf-8') as f:
        return json.load(f)


def buscar_biblioteca(home=None):
    """La biblioteca de Ingenieria sincronizada en esta PC (con o sin tilde), o None."""
    org = Path(home or Path.home()) / 'BARACK ARGENTINA SRL'
    try:
        nombres = sorted(os.listdir(org))
    except OSError:
        return None
    cand = [org / n for n in nombres if re.match(r'^Ingenier.{1,2}a y Proyecto - General$', n, re.I) and (org / n).is_dir()]
    for c in cand:
        if (c / 'INGENIERIA BARACK (NUNCA BORRAR)').is_dir():
            return c
    return cand[0] if cand else None


def resolver_carpeta(clave, bib):
    """(ruta, cual) con cual en {'nueva', 'vieja', 'ninguna'}; bib es la carpeta de la biblioteca."""
    e = next((c for c in canon()['carpetas'] if c['clave'] == clave), None)
    if e is None:
        raise KeyError('nube_carpetas: no hay carpeta %r en nubeCarpetas.data.json' % clave)
    bib = Path(bib)
    nueva = bib.joinpath(*e['nueva'])
    if nueva.is_dir():
        return nueva, 'nueva'
    for t in e['viejas']:
        v = bib.joinpath(*t)
        if v.is_dir():
            return v, 'vieja'
    return nueva, 'ninguna'


def carpeta_nube(clave, home=None):
    """La ruta de esa carpeta en esta PC, o None si la biblioteca no esta sincronizada."""
    bib = buscar_biblioteca(home)
    return resolver_carpeta(clave, bib)[0] if bib else None


if __name__ == '__main__':  # para el test: python nube_carpetas.py <clave> <biblioteca>
    import sys
    r, cual = resolver_carpeta(sys.argv[1], sys.argv[2])
    print(json.dumps({'ruta': str(r), 'cual': cual}, ensure_ascii=False))
