# -*- coding: utf-8 -*-
"""Cabecera de un STEP: ISO 10303-21 fija FILE_DESCRIPTION, FILE_NAME, FILE_SCHEMA, en ese orden.

Por qué existe (tanda 2 del plan del sistema, 17/10/2026). OpenCASCADE 7.8 (build123d, cadquery) escribe FILE_NAME antes
que FILE_DESCRIPTION, y CATIA V5 R21 lee ese STEP VACÍO sin avisar en pantalla (Fak lo midió el 13/10: «Invalid STEP21
file format: invalid header»). Medido el 17/10 sobre los STEP de esta PC (C:\\Dev\\_utrim y exports\\): 95 con la cabecera
al revés, todos de OpenCASCADE 7.8; en orden los de CATIA, los de OpenCASCADE 7.9 y los que ya pasaron por el arreglo.
Fuente de la regla: ISO 10303-21, «estructura fija ... en el orden dado» (Wikipedia, abierta el 15/10, informe
afuera_3d.md F1); la norma es paga y no se abrió.

Lo usan export_deliverables.py (arregla la COPIA que se entrega y la vuelve a leer), gate_entregable.py (G-E6, aviso),
catia_medir.py (copia temporal para CATIA) y cabecera_step.py (revisar sin tocar / arreglar a pedido).
"""
import os
import re

CLAVES = ("FILE_DESCRIPTION", "FILE_NAME", "FILE_SCHEMA")
_SOLO_NUBE = 0x400000 | 0x1000          # FILE_ATTRIBUTE_RECALL_ON_DATA_ACCESS | FILE_ATTRIBUTE_OFFLINE


def cabecera_en_orden(texto):
    """(texto_corregido, orden_que_tenia). Frena (ValueError) si falta alguna de las tres."""
    i, j = texto.index("HEADER;") + len("HEADER;"), texto.index("ENDSEC;")
    cab = texto[i:j]
    partes = {}
    for k in CLAVES:
        m = re.search(k + r"\s*\(.*?\)\s*;", cab, re.S)
        if not m:
            raise ValueError("la cabecera no trae %s" % k)
        partes[k] = m.group(0)
    orden = sorted(CLAVES, key=lambda k: cab.index(partes[k]))
    nueva = "\n" + "\n".join(partes[k] for k in CLAVES) + "\n"
    return texto[:i] + nueva + texto[j:], orden


def solo_en_la_nube(path):
    """True si OneDrive lo tiene solo en la nube: leerlo lo DESCARGA (regla de la casa: no se hidrata sin pedido)."""
    try:
        return bool(getattr(os.stat(path), "st_file_attributes", 0) & _SOLO_NUBE)
    except OSError:
        return False


def orden_de_archivo(path, leer=20000):
    """El orden de las tres entidades en la cabecera del archivo, leyendo solo el principio; None si no se puede leer
    una cabecera (no es un STEP, o le falta alguna)."""
    with open(path, "rb") as f:
        t = f.read(leer).decode("latin-1")
    if "HEADER;" not in t or "ENDSEC;" not in t:
        return None
    cab = t[t.index("HEADER;"):t.index("ENDSEC;")]
    pos = []
    for k in CLAVES:
        m = re.search(k + r"\s*\(", cab)
        if not m:
            return None
        pos.append((m.start(), k))
    return tuple(k for _, k in sorted(pos))


def arreglar_archivo(path):
    """Reordena la cabecera EN EL LUGAR, sin tocar un byte del resto (latin-1 ida y vuelta, finales de línea como
    estaban) y conservando la fecha de modificación (G-E2 compara fechas). Devuelve (cambió, orden_que_tenía).
    Después de escribir vuelve a LEER el archivo: si no quedó en orden, ValueError."""
    with open(path, "rb") as f:
        crudo = f.read()
    texto = crudo.decode("latin-1")
    nuevo, orden = cabecera_en_orden(texto)
    if tuple(orden) == CLAVES:
        return False, tuple(orden)
    st = os.stat(path)
    with open(path, "wb") as f:
        f.write(nuevo.encode("latin-1"))
    os.utime(path, (st.st_atime, st.st_mtime))
    if orden_de_archivo(path) != CLAVES:
        raise ValueError("despues de arreglar, la cabecera de %s sigue fuera de orden" % path)
    return True, tuple(orden)
