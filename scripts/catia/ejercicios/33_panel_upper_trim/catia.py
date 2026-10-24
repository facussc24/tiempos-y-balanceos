# -*- coding: utf-8 -*-
"""Ejercicio 33 del banco de CATIA (COLA_CATIA.md, fase 3: disenos reales de Barack, pedido 9 de la principal, 24/10/2026,
CATA): el panel del CLIENTE del Upper Trim (Patagonia) abierto en CATIA, con su volumen y su area contra build123d sobre el
MISMO STEP. No hay papel: la respuesta es la medicion del STEP real con otro motor (OpenCASCADE, por build123d).

El STEP es la copia del panel llevada al marco del virolador que usaron el ej15, el ej16 y el ej24 de la practica del 19/10
(v14_choque/panel_marco_local.step, 11,2 MB, sha256 fb74d977...4e1e): pieza del cliente, NO entra al repo. Se lee de la
variable CATIA_PANEL_UPPER_TRIM o de la carpeta «para CATA - practica 19-10» de la nube de Ingenieria, se verifica el
sha256 y se abre una COPIA en la carpeta de trabajo (el original no se toca; su cabecera ya esta en el orden de ISO
10303-21, la que CATIA R21 lee).

En CATIA: Documents.Open de la copia (el objeto que devuelve no expone Part: se toma ActiveDocument, catia.md), volumen,
area y centro de gravedad del cuerpo, y el CATPart + STEP + captura (cerrar_parte). El juez (cerrar_con_medicion):
OpenCASCADE con integracion fina (medir_fino.py) mide la copia que abrio CATIA y el STEP que exporto CATIA; volumen y
area a 0,1 % o menos (tolerancia de este ejercicio, sin fuente de Barack: el 17/10 CATIA y build123d difirieron 0,03 % en
el volumen de two_wireless.stp, catia.md «Que dio»; aca el ruido medido es 0,004 %) y el centro a TOL_CDG, por eje; el
STEP de CATIA, ademas, con 1 solido y 0 caras sueltas (medir_b123d), que es lo que caza una cara perdida: un STEP de una
caja sin una cara da 0 solidos y 5 caras sueltas, y BRepCheck lo da valido igual (prueba ContraOpenCascade). con_bien=False.

Uso: python catia.py <carpeta de trabajo>  ->  salida.json, el STEP que exporto CATIA y la captura.
"""
import hashlib
import json
import os
import shutil
import subprocess
import sys
import traceback

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(os.path.dirname(AQUI)))      # juez_comun y catia_base
import juez_comun as jc  # noqa: E402

EJ = "33_panel_upper_trim"
PARTE = "panel_upper_trim"
SHA256 = "fb74d9772b21fb48a915819a54968a863d9d6a35cd7cd78655c55b02955e4a1e"
NUBE = os.path.join(os.path.expanduser("~"), "BARACK ARGENTINA SRL", "Ingeniería y Proyecto - General",
                    "ASISTENTE INGENIERIA", "6- PEDIDOS ENTRE PC (FACUNDO)", "para CATA - practica 19-10", "v14_choque",
                    "panel_marco_local.step")
TOL_REL = 1e-3                      # 0,1 %: la de este ejercicio (ver el docstring)


def ruta_panel():
    return os.environ.get("CATIA_PANEL_UPPER_TRIM") or NUBE


def sha256(ruta):
    h = hashlib.sha256()
    with open(ruta, "rb") as f:
        for bloque in iter(lambda: f.read(1 << 20), b""):
            h.update(bloque)
    return h.hexdigest()


def construir(cb, c, reg, salida):
    origen = ruta_panel()
    salida["panel"] = {"origen": origen, "sha256_esperado": SHA256}

    def abrir():
        h = sha256(origen)
        salida["panel"]["sha256"] = h
        if h != SHA256:
            raise RuntimeError(f"el STEP del panel no es el esperado (sha256 {h})")
        copia = os.path.join(reg.carpeta, "panel_copia.step")
        shutil.copyfile(origen, copia)
        c.Documents.Open(copia)
        doc = c.ActiveDocument                      # Documents.Open no expone Part a pywin32 (catia.md)
        part = doc.Part
        salida["_doc"] = (doc, part, part.MainBody)
        return {"copia": copia, "cuerpos": part.Bodies.Count}

    if reg.paso("abrir una copia del panel del cliente (sha256 verificado)", abrir) is None:
        return
    doc, part, body = salida.pop("_doc")
    m = reg.paso("medir el panel en CATIA (volumen, area, centro)", lambda: cb.medir(doc, part, body))
    if m:
        salida["area_catia_mm2"] = m.get("area")
    jc.cerrar_parte(cb, c, reg, salida, doc, part, body, PARTE, PARTE)
    try:
        doc.Close()
    except Exception as e:  # noqa: BLE001
        salida["documento_sin_cerrar"] = repr(e)[:200]


def correr_medir_fino(rutas, correr=subprocess.run):
    """medir_fino.py (integracion adaptativa de OpenCASCADE) con .venv-cad: {"<archivo>": {vol, area, cdg, valido}}."""
    if not os.path.isfile(jc.VENV_CAD):
        return {"error": f"no esta el entorno CAD ({jc.VENV_CAD})"}
    try:
        r = correr([jc.VENV_CAD, "-I", os.path.join(AQUI, "medir_fino.py")] + list(rutas), capture_output=True, text=True,
                   timeout=600)
        return json.loads(r.stdout.strip().splitlines()[-1])
    except Exception as ex:  # noqa: BLE001
        return {"error": f"la medicion fina no corrio: {ex!r}"[:300]}


def _rel(a, b):
    return round((a - b) / b, 7)


def _parte(b):
    return next(iter((b.get("partes") or {}).values()), {}) if isinstance(b, dict) and "error" not in b else {}


def cerrar_con_medicion(carpeta, medir=None, medir_fino=None):
    """Despues de correr_ejercicio (con_bien=False). Decide con la integracion fina (medir_fino.py) sobre la COPIA que abrio
    CATIA (sha256 ya verificado en construir) y sobre el STEP que exporto CATIA: volumen y area a 0,1 % y centro a
    TOL_CDG, y el STEP exportado con 1 solido y 0 caras sueltas (medir_b123d). Lo que da medir_b123d por defecto queda
    informado y no decide (LECCIONES.md, punto 2)."""
    ruta = os.path.join(carpeta, "salida.json")
    with open(ruta, encoding="utf-8") as f:
        s = json.load(f)
    s["ok_pasos"] = bool(s.get("ok_pasos", s.get("ok")))
    s.pop("pendiente", None)
    problemas, juez = [], {}
    sub = os.path.join(carpeta, EJ)
    copia, export = os.path.join(sub, "panel_copia.step"), os.path.join(sub, PARTE + ".stp")
    medir = medir or jc.medir_b123d
    b_copia, b_export = _parte(medir(["step", copia])), _parte(medir(["step", export]))
    s["build123d_por_defecto"] = {"copia": b_copia, "export_catia": b_export}
    fino = (medir_fino or correr_medir_fino)([copia, export])
    fc = fino.get(os.path.basename(copia)) or {}
    fe = fino.get(os.path.basename(export)) or {}
    s["medicion_fina"] = fino
    vc, ac, cc = (s.get("volumen_catia") or {}).get(PARTE), s.get("area_catia_mm2"), (s.get("cdg_catia_mm") or {}).get(PARTE)
    if None in (vc, ac, cc):
        problemas.append("CATIA no midio el panel")
    if not all(isinstance(f.get(k), (int, float)) for f in (fc, fe) for k in ("vol", "area")) or not fc.get("cdg") \
            or not fe.get("cdg"):
        problemas.append(f"la medicion fina no midio los dos STEP: {fino.get('error') or fino}")
    elif None not in (vc, ac, cc):
        juez.update({"volumen_catia": vc, "volumen_fino": fc["vol"], "dif_volumen_rel": _rel(vc, fc["vol"]),
                     "area_catia": ac, "area_fina": fc["area"], "dif_area_rel": _rel(ac, fc["area"]),
                     "dif_cdg_mm": round(max(abs(x - y) for x, y in zip(cc, fc["cdg"])), 4),
                     "volumen_export_fino": fe["vol"], "dif_export_volumen_rel": _rel(fe["vol"], fc["vol"]),
                     "dif_export_area_rel": _rel(fe["area"], fc["area"]),
                     "dif_export_cdg_mm": round(max(abs(x - y) for x, y in zip(fe["cdg"], fc["cdg"])), 4)})
        for k, que in (("dif_volumen_rel", "volumen CATIA contra el STEP"), ("dif_area_rel", "area CATIA contra el STEP"),
                       ("dif_export_volumen_rel", "volumen del STEP de CATIA"), ("dif_export_area_rel", "area del STEP de CATIA")):
            if abs(juez[k]) > TOL_REL:
                problemas.append(f"{que}: {juez[k]:.4%}")
        for k, que in (("dif_cdg_mm", "centro de CATIA contra el STEP"), ("dif_export_cdg_mm", "centro del STEP de CATIA")):
            if juez[k] > jc.TOL_CDG:
                problemas.append(f"{que}: {juez[k]} mm")
    if fc and fe and not (fc.get("valido") and fe.get("valido")):
        problemas.append("OpenCASCADE no da valido alguno de los dos STEP")
    juez["export_solidos"], juez["export_caras_sueltas"] = b_export.get("solidos"), b_export.get("caras_sueltas")
    if juez["export_solidos"] != 1 or juez["export_caras_sueltas"] != 0:
        problemas.append(f"el STEP de CATIA no es 1 solido cerrado: {juez['export_solidos']} solidos, "
                         f"{juez['export_caras_sueltas']} caras sueltas")
    s["juez"] = juez
    s["ok"] = s["ok_pasos"] and not problemas
    if problemas:
        texto = "; ".join(problemas)
        s["error"] = f"{s['error']}; {texto}" if s.get("error") else texto
    with open(ruta, "w", encoding="utf-8") as f:
        json.dump(s, f, ensure_ascii=False, indent=1, default=str)
    print("FIN_MEDICION", json.dumps({"ok": s["ok"], "ok_pasos": s["ok_pasos"], **juez}))
    return s


if __name__ == "__main__":
    codigo = jc.correr_ejercicio(EJ, construir, con_bien=False)
    if codigo == 0 and len(sys.argv) >= 2:
        try:
            cerrar_con_medicion(os.path.abspath(sys.argv[1]))
        except Exception:  # noqa: BLE001
            print("no se pudo cerrar la medicion en salida.json:", traceback.format_exc()[-400:], file=sys.stderr)
            codigo = 1
    sys.exit(codigo)
