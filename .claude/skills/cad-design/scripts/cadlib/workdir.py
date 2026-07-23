# -*- coding: utf-8 -*-
"""Workdir por pieza con manifest.json: transforms, frames, evidencia, caches.

Reemplaza el acoplamiento oculto via T_*.npy sueltos entre scripts: las transforms
viven en el manifest con procedencia, y la evidencia (colision OK, render hecho)
es lo que export_deliverables.py exige antes de entregar (gate duro).

Layout:  <workdir>/manifest.json + in/ + out/ + renders/ + cache/
"""
import json
import os
import time

import numpy as np

MANIFEST = "manifest.json"
SUBDIRS = ("in", "out", "renders", "cache")


def ensure_workdir(workdir):
    os.makedirs(workdir, exist_ok=True)
    for d in SUBDIRS:
        os.makedirs(os.path.join(workdir, d), exist_ok=True)
    p = os.path.join(workdir, MANIFEST)
    if not os.path.isfile(p):
        save_manifest(workdir, {"transforms": {}, "frames": {}, "evidence": [], "caches": {}, "params": {}})
    return workdir


def load_manifest(workdir):
    p = os.path.join(workdir, MANIFEST)
    if not os.path.isfile(p):
        raise FileNotFoundError(
            "No hay %s en %s — correr primero un script con --workdir para inicializarlo" % (MANIFEST, workdir))
    with open(p, "r", encoding="utf-8") as f:
        return json.load(f)


def save_manifest(workdir, m):
    p = os.path.join(workdir, MANIFEST)
    with open(p, "w", encoding="utf-8") as f:
        json.dump(m, f, indent=2, ensure_ascii=False)


def set_transform(workdir, name, T, **meta):
    """T = [tx,ty,tz] (ICP traslacion-only) o matriz 4x4 aplanada."""
    m = load_manifest(workdir)
    entry = {"T": np.asarray(T, dtype=float).ravel().tolist(), "date": _now()}
    entry.update(meta)
    m.setdefault("transforms", {})[name] = entry
    save_manifest(workdir, m)


def get_transform(workdir, name):
    m = load_manifest(workdir)
    tr = m.get("transforms", {})
    if name not in tr:
        raise KeyError("Transform '%s' no existe. Disponibles: %s" % (name, sorted(tr.keys()) or "(ninguna)"))
    return np.asarray(tr[name]["T"], dtype=float)


def set_frame(workdir, name, b, a_hint, **meta):
    m = load_manifest(workdir)
    entry = {"b": list(map(float, b)), "a_hint": list(map(float, a_hint)), "date": _now()}
    entry.update(meta)
    m.setdefault("frames", {})[name] = entry
    save_manifest(workdir, m)


def get_frame(workdir, name):
    """Devuelve la matriz M del frame (via geom.orthonormal_frame)."""
    from . import geom
    m = load_manifest(workdir)
    fr = m.get("frames", {})
    if name not in fr:
        raise KeyError("Frame '%s' no existe. Disponibles: %s" % (name, sorted(fr.keys()) or "(ninguno)"))
    return geom.orthonormal_frame(fr[name]["b"], fr[name]["a_hint"])


def record_evidence(workdir, kind, **payload):
    m = load_manifest(workdir)
    entry = {"kind": kind, "date": _now()}
    entry.update(payload)
    m.setdefault("evidence", []).append(entry)
    save_manifest(workdir, m)
    return entry


def find_evidence(workdir, kind, **match):
    """Ultima evidencia de ese kind cuyos campos coinciden con match (None si no hay)."""
    m = load_manifest(workdir)
    hits = [e for e in m.get("evidence", []) if e.get("kind") == kind
            and all(e.get(k) == v for k, v in match.items())]
    return hits[-1] if hits else None


def require_evidence(workdir, kind, hint="", **match):
    """Gate duro: si no hay evidencia, abortar con mensaje claro (exit 4)."""
    e = find_evidence(workdir, kind, **match)
    if e is None:
        raise SystemExit(
            "[GATE] Falta evidencia '%s'%s en %s/manifest.json.\n%s"
            % (kind, (" con %s" % match) if match else "", workdir,
               hint or "Correr el paso de verificacion correspondiente antes de entregar."))
    return e


def cache_path(workdir, name, filename):
    """Registra un cache pesado (ej. nube de puntos .npy) en el manifest y devuelve su ruta."""
    m = load_manifest(workdir)
    rel = os.path.join("cache", filename)
    m.setdefault("caches", {})[name] = rel
    save_manifest(workdir, m)
    return os.path.join(workdir, rel)


def get_cache(workdir, name):
    m = load_manifest(workdir)
    caches = m.get("caches", {})
    if name not in caches:
        raise KeyError("Cache '%s' no existe. Disponibles: %s" % (name, sorted(caches.keys()) or "(ninguno)"))
    p = os.path.join(workdir, caches[name])
    if not os.path.isfile(p):
        raise FileNotFoundError("Cache '%s' registrado pero el archivo no esta: %s" % (name, p))
    return p


def _now():
    return time.strftime("%Y-%m-%d %H:%M:%S")
