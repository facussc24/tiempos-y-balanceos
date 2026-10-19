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
# FILE_ATTRIBUTE_RECALL_ON_DATA_ACCESS | FILE_ATTRIBUTE_RECALL_ON_OPEN | FILE_ATTRIBUTE_OFFLINE (el segundo lo sumo el
# revisor por API del 18/10)
_SOLO_NUBE = 0x400000 | 0x40000 | 0x1000
_NUBE = ("BARACK ARGENTINA SRL", "ONEDRIVE")           # la biblioteca de Ingenieria y la nube personal


def en_la_nube(path):
    """True si el archivo vive en una carpeta de OneDrive (la biblioteca de Ingenieria o la nube personal): ahi un STEP
    es un entregable y reemplazarlo pide el OK de Fak (plan del sistema, tanda 2, punto 5)."""
    p = os.path.abspath(path).upper()
    return any(n in p for n in _NUBE)


def _fin_de_entidad(cab, ini):
    """Índice justo después del «;» que cierra la entidad que arranca en `ini`, respetando los textos entre comillas
    simples (en STEP una comilla adentro de un texto se escribe '') y los paréntesis. None si no cierra."""
    prof, i, n = 0, ini, len(cab)
    while i < n:
        ch = cab[i]
        if ch == "'":
            i += 1
            while i < n:
                if cab[i] == "'":
                    if i + 1 < n and cab[i + 1] == "'":
                        i += 2
                        continue
                    break
                i += 1
        elif ch == "(":
            prof += 1
        elif ch == ")":
            prof -= 1
        elif ch == ";" and prof == 0:
            return i + 1
        i += 1
    return None


def _tramos(cab):
    """{clave: (inicio, fin)} de cada una de las tres entidades dentro de la cabecera. Frena si falta alguna."""
    tr = {}
    for k in CLAVES:
        m = re.search(r"(?<![A-Z_])" + k + r"\s*\(", cab)
        if not m:
            raise ValueError("la cabecera no trae %s" % k)
        fin = _fin_de_entidad(cab, m.start())
        if fin is None:
            raise ValueError("la entidad %s de la cabecera no cierra" % k)
        tr[k] = (m.start(), fin)
    return tr


def cabecera_en_orden(texto):
    """(texto_corregido, orden_que_tenia). Intercambia las tres entidades EN SU LUGAR: lo demás de la cabecera
    (comentarios, FILE_POPULATION, finales de línea) queda como estaba (auditor del 17/10, N2: la versión anterior
    reescribía la cabecera entera y un «);» adentro de un texto la cortaba). Frena (ValueError) si falta alguna."""
    i, j = texto.index("HEADER;") + len("HEADER;"), texto.index("ENDSEC;")
    cab = texto[i:j]
    tr = _tramos(cab)
    orden = sorted(CLAVES, key=lambda k: tr[k][0])
    huecos = [tr[k] for k in orden]                     # las tres posiciones, de arriba hacia abajo
    nueva, ultimo = [], 0
    for (a, b), k in zip(huecos, CLAVES):                # en la primera posición va FILE_DESCRIPTION, etc.
        nueva.append(cab[ultimo:a])
        nueva.append(cab[tr[k][0]:tr[k][1]])
        ultimo = b
    nueva.append(cab[ultimo:])
    nueva = "".join(nueva)
    if sorted(cab[a:b] for a, b in tr.values()) != sorted(nueva[a:b] for a, b in _tramos(nueva).values()):
        raise ValueError("al reordenar cambio el texto de una entidad de la cabecera")
    return texto[:i] + nueva + texto[j:], orden


def solo_en_la_nube(path):
    """True si OneDrive lo tiene solo en la nube: leerlo lo DESCARGA (regla de la casa: no se hidrata sin pedido)."""
    try:
        return bool(getattr(os.stat(path), "st_file_attributes", 0) & _SOLO_NUBE)
    except OSError:
        return False


def orden_de_archivo(path, leer=2_000_000):
    """El orden de las tres entidades en la cabecera del archivo, leyendo hasta el ENDSEC de la cabecera (como mucho
    `leer` bytes); None si no se puede leer una cabecera (no es un STEP, o le falta alguna). Antes leía 20.000 bytes y
    una cabecera más larga daba None (revisor por API del 18/10)."""
    t = ""
    with open(path, "rb") as f:
        while len(t) < leer:
            trozo = f.read(65536)
            if not trozo:
                break
            t += trozo.decode("latin-1")
            if "ENDSEC;" in t:
                break
    if "HEADER;" not in t or "ENDSEC;" not in t:
        return None
    cab = t[t.index("HEADER;"):t.index("ENDSEC;")]
    try:
        tr = _tramos(cab)
    except ValueError:
        return None
    return tuple(sorted(CLAVES, key=lambda k: tr[k][0]))


def arreglar_archivo(path, conservar_fecha=True):
    """Reordena la cabecera EN EL LUGAR, sin tocar un byte del resto (latin-1 ida y vuelta, finales de línea como
    estaban) y conservando la fecha de modificación (G-E2 compara fechas). Devuelve (cambió, orden_que_tenía).
    Con `conservar_fecha=False` la fecha queda la de ahora: es lo que va en una carpeta de OneDrive, donde el mismo
    archivo con otro contenido y la MISMA fecha es un conflicto y OneDrive se queda con el de la nube (18/10/2026: el v14
    del virolador volvió a la cabecera al revés y el arreglo quedó en «...-DESKTOP-14JG95B.step»).
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
    if conservar_fecha:
        os.utime(path, (st.st_atime, st.st_mtime))
    if orden_de_archivo(path) != CLAVES:
        raise ValueError("despues de arreglar, la cabecera de %s sigue fuera de orden" % path)
    return True, tuple(orden)
