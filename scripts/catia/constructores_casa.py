# -*- coding: utf-8 -*-
"""Constructores de la casa en CATIA V5 (Part Design por COM): el gemelo de
.claude/skills/cad-design/scripts/cadlib/constructores.py (build123d). Propuesta 2 del informe del sistema 3D
(docs/INVESTIGACION_SISTEMA_3D_2026-10-23.md §10.2).

Mismos nombres y parametros que build123d; el PRIMER parametro de cada uno es el contexto de CATIA (ctx o la aplicacion)
y despues va lo mismo, con los mismos valores por defecto: test_constructores_casa.py falla si se separan. Los radios,
el chaflan, los motivos y el control de las matrices NO se repiten aca: se importan del nucleo en Python puro de
cadlib.constructores (que lee data/lenguaje_diseno.json), asi un numero vive en un solo lugar.

  nueva(cb, c, nombre)                         -> Ctx (documento Part nuevo, con su ShapeFactory)
  caja(ctx, largo, ancho, alto, radio=None, motivo=None, centro=(0, 0, 0))
  placa(ctx, largo, ancho, espesor, chaflan_cama=None, radio=None, motivo=None, centro=(0, 0, 0))
  colocar(c, forma, M)                          -> valida M (rotacion propia, det +1) y recien ahi Position.SetComponents

Cada caja o placa va en su PROPIO cuerpo (la primera en el PartBody, las demas en un Body nuevo cada una), con el centro de lo agregado controlado por jc.extruir (el
sentido de la extrusion se mide, no se supone). El redondeo va en dos pasos, como el ejercicio 05 del juez (= build123d
a 0,000 mm3): las 4 verticales y despues el contorno de arriba con propagacion por tangencia. No se dibujan esquinas
con poligonos ni chaflanes con escalones (pulir.py del 20/10): las dos cosas el gate de cantos las cuenta como cantos
vivos (evals/banco3d, ejercicios 20 y 21). El chaflan de cama es un Chamfer de dos largos iguales (45 grados) con
propagacion por tangencia (AddNewChamfer, catia.md l.213).

Corre con C:\\Dev\\_catia_env\\Scripts\\python.exe (sin build123d): el nucleo de cadlib es Python puro.
"""
import os
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(AQUI))
if not os.path.isdir(os.path.join(REPO, ".claude", "skills", "cad-design")):
    REPO = os.environ.get("BARACK_REPO") or r"C:\Dev\BarackMercosul"       # paquete del obrero (como juez_comun)
_SKILL_SCRIPTS = os.path.join(REPO, ".claude", "skills", "cad-design", "scripts")
if _SKILL_SCRIPTS not in sys.path:
    sys.path.insert(0, _SKILL_SCRIPTS)
if AQUI not in sys.path:
    sys.path.insert(0, AQUI)
from cadlib import constructores as _k  # noqa: E402

NoSePuede, SinMotivo, NoEntra, FaltaDato, Espejo, NoEsRotacion = (_k.NoSePuede, _k.SinMotivo, _k.NoEntra, _k.FaltaDato,
                                                                  _k.Espejo, _k.NoEsRotacion)
marco = _k.marco
componentes = _k.componentes_catia
TOL = 1e-3                     # mm: para elegir aristas por posicion (catia.md: se eligen por POSICION, no por nombre)
VB_POS = """Function CATMain(p, a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11)
    Dim m(11)
    m(0) = a0: m(1) = a1: m(2) = a2: m(3) = a3: m(4) = a4: m(5) = a5
    m(6) = a6: m(7) = a7: m(8) = a8: m(9) = a9: m(10) = a10: m(11) = a11
    p.Position.SetComponents m
End Function"""


class Ctx:
    """Lo que necesita un constructor de CATIA: la base (catia_base), el documento, el Part y su ShapeFactory."""

    def __init__(self, cb, doc, part, sf):
        self.cb, self.doc, self.part, self.sf = cb, doc, part, sf
        self.cuerpos = []


def nueva(cb, c, nombre):
    doc, part, _body, sf = cb.nueva_pieza(c, nombre)
    return Ctx(cb, doc, part, sf)


def _jc():
    import juez_comun as jc
    return jc


def _cuerpo_con_pad(ctx, que, largo, ancho, alto, centro):
    """Cuerpo nuevo con el pad rectangular de largo x ancho x alto apoyado en z0 = centro[2], centrado en (cx, cy)."""
    jc = _jc()
    cb, doc, part, sf = ctx.cb, ctx.doc, ctx.part, ctx.sf
    cx, cy, z0 = (float(a) for a in centro)
    if not ctx.cuerpos:                      # el primero va al PartBody: un PartBody vacio no se puede medir (19/10)
        body = part.MainBody
    else:
        body = part.Bodies.Add()
        body.Name = f"{que}_{len(ctx.cuerpos) + 1}"
    part.InWorkObject = body
    plano = jc.plano_origen(part, "xy") if abs(z0) < 1e-9 else jc.plano_a(part, body, z0)
    sk = jc.croquis(cb, part, body, plano, rects=[(cx - largo / 2, cy - ancho / 2, cx + largo / 2, cy + ancho / 2)])
    pad, m, info = jc.extruir(cb, doc, part, body, sf, sk, alto, largo * ancho * alto, (cx, cy, z0 + alto / 2))
    ctx.cuerpos.append(body)
    return body, pad, plano, info


def _aristas(ctx, feat):
    return [d for d in ctx.cb.topologia(ctx.doc, feat, "Edge") if "cdg" in d]


def _redondear(ctx, pad, largo, ancho, alto, r, centro):
    """Paso 1: las 4 verticales; paso 2: el contorno de arriba con propagacion por tangencia (esquina esferica)."""
    cx, cy, z0 = (float(a) for a in centro)
    sf, part = ctx.sf, ctx.part
    vert = [d["ref"] for d in _aristas(ctx, pad) if abs(abs(d["cdg"][0] - cx) - largo / 2) < TOL
            and abs(abs(d["cdg"][1] - cy) - ancho / 2) < TOL and abs(d["cdg"][2] - (z0 + alto / 2)) < TOL]
    if len(vert) != 4:
        raise NoSePuede(f"aristas verticales de las esquinas: {len(vert)} (se esperaban 4)")
    f1 = sf.AddNewSolidEdgeFilletWithConstantRadius(vert[0], 0, float(r))
    for x in vert[1:]:
        f1.AddObjectToFillet(x)
    part.Update()
    arriba = [d["ref"] for d in _aristas(ctx, f1) if abs(d["cdg"][2] - (z0 + alto)) < TOL]
    if not arriba:
        arriba = [d["ref"] for d in _aristas(ctx, pad) if abs(d["cdg"][2] - (z0 + alto)) < TOL]
    if not arriba:
        raise NoSePuede("no encontre el contorno de arriba despues del paso 1")
    f2 = sf.AddNewSolidEdgeFilletWithConstantRadius(arriba[0], 1, float(r))        # 1: propaga por tangencia
    rechazadas = 0
    for x in arriba[1:]:
        try:
            f2.AddObjectToFillet(x)
        except Exception:  # noqa: BLE001  (en el ejercicio 05: ya la habia tomado la propagacion)
            rechazadas += 1
    part.Update()
    # Ojo (revisor 24/10): un rechazo por OTRO motivo dejaria una arista sin redondear y aca no se ve. Lo que lo caza es
    # el juez: mismo volumen que build123d y cantos_convexos sobre el STEP de CATIA (verificar_con_banco).
    ctx.rechazadas = rechazadas                     # las de ESTA pieza (revisor 24/10: se acumulaban entre piezas)
    return f1, f2


def _resultado(ctx, body, que, parametros, motivo):
    m = ctx.cb.medir(ctx.doc, ctx.part, body)
    L = _k.lenguaje()
    proc = {"procedencia": "catalogo_casa", "constructor": f"scripts/catia/constructores_casa.{que}",
            "parametros": parametros, "lenguaje_version": L["version"], "volumen": m.get("volume")}
    if _k._motivo_ok(motivo):
        proc["motivo"] = motivo.strip()
    return {"cuerpo": body, "volumen": m.get("volume"), "cdg_mm": m.get("cdg_mm"), "procedencia": proc,
            "aristas_rechazadas_por_catia": getattr(ctx, "rechazadas", 0)}


def _borrar(ctx, feat):
    sel = ctx.doc.Selection
    sel.Clear()
    sel.Add(feat)
    sel.Delete()
    sel.Clear()
    ctx.part.Update()


def _chaflan_cama(ctx, pad, f1, z0, c):
    """Chaflan de dos largos iguales (45 grados) en el contorno de la cama. Primero las 8 aristas sin propagacion (los
    arcos los creo el redondeo de las verticales, las rectas siguen siendo del pad); si CATIA no lo acepta, se borra y se
    prueba con UNA arista y propagacion por tangencia (el contorno de rectas y arcos es continuo). 24/10: el primer
    intento (una arista con propagacion + agregar las demas) dio «The method Update failed»."""
    arcos = [d["ref"] for d in _aristas(ctx, f1) if abs(d["cdg"][2] - z0) < TOL] if f1 is not None else []
    rectas = [d["ref"] for d in _aristas(ctx, pad) if abs(d["cdg"][2] - z0) < TOL]
    todas = arcos + rectas
    if not todas:
        raise NoSePuede("no encontre el contorno de la cama")
    # primero el patron probado (ej84 de la practica del 19/10: AddNewChamfer(arista, 0, 0, 0, K, K) + AddElementToChamfer;
    # medido el 24/10: CATIA acepta este al primer intento). La tangencia solo si hay redondeo de esquinas: con radio 0
    # las rectas no son tangentes y la propagacion se quedaria en una sola (revisor 24/10).
    intentos = [("sin propagacion, todas", todas, 0)]
    if f1 is not None:
        intentos.append(("tangencia desde una arista", todas[:1], 1))
    errores = []
    for que, refs, propagacion in intentos:
        ch = None
        try:
            ch = ctx.sf.AddNewChamfer(refs[0], propagacion, 0, 0, c, c)
            for x in refs[1:]:
                ch.AddElementToChamfer(x)
            ctx.part.Update()
            return {"chaflan": que, "aristas": len(refs), "errores_antes": errores}
        except Exception as e:  # noqa: BLE001
            errores.append(f"{que}: {e!r}"[:200])
            if ch is not None:
                _borrar(ctx, ch)
    raise NoSePuede(f"CATIA no acepto el chaflan de cama ({len(arcos)} arcos, {len(rectas)} rectas): {errores}")


def caja(ctx, largo, ancho, alto, radio=None, motivo=None, centro=(0.0, 0.0, 0.0)):
    r = _k.resolver_radio(radio, motivo)
    _k.chequear_caja(largo, ancho, alto, r)
    body, pad, _plano, _info = _cuerpo_con_pad(ctx, "caja", largo, ancho, alto, centro)
    if r > 0:
        _redondear(ctx, pad, largo, ancho, alto, r, centro)
    return _resultado(ctx, body, "caja", {"largo": largo, "ancho": ancho, "alto": alto, "radio": r,
                                          "centro": list(centro)}, motivo)


def placa(ctx, largo, ancho, espesor, chaflan_cama=None, radio=None, motivo=None, centro=(0.0, 0.0, 0.0),
          motivo_cama=None):
    r = _k.resolver_radio(radio, motivo)
    c = _k.resolver_chaflan(chaflan_cama, motivo_cama)
    _k.chequear_placa(largo, ancho, espesor, r, c)
    body, pad, _plano, _info = _cuerpo_con_pad(ctx, "placa", largo, ancho, espesor, centro)
    f1 = None
    if r > 0:
        f1, _f2 = _redondear(ctx, pad, largo, ancho, espesor, r, centro)
    como = _chaflan_cama(ctx, pad, f1, float(centro[2]), float(c)) if c > 0 else None
    res = _resultado(ctx, body, "placa", {"largo": largo, "ancho": ancho, "espesor": espesor, "chaflan_cama": c,
                                          "radio": r, "centro": list(centro)}, motivo)
    res["chaflan_como"] = como
    return res


def verificar_con_banco(step, lista, venv=None, repo=None):
    """Corre correctores del banco 3D (evals/banco3d/correctores/<nombre>.py) sobre un STEP que exporto CATIA, con el
    entorno CAD: [(nombre, opciones)] -> {nombre: {veredicto, detalle}}. El que no da verde queda a la vista."""
    import json
    import subprocess
    venv = venv or os.environ.get("VENV_CAD", r"C:\Dev\BarackMercosul\.venv-cad\Scripts\python.exe")
    base = os.path.join(repo or REPO, "evals", "banco3d", "correctores")
    res = {}
    for nombre, opciones in lista:
        r = subprocess.run([venv, "-I", os.path.join(base, nombre + ".py"), step] + list(opciones),
                           capture_output=True, text=True, timeout=900)
        linea = [x for x in (r.stdout or "").strip().splitlines() if x.startswith("{")]
        j = json.loads(linea[-1]) if linea else {"veredicto": "error", "detalle": (r.stderr or "")[-300:]}
        res[nombre] = {"veredicto": j.get("veredicto"), "detalle": j.get("detalle")}
    return res


def colocar(c, forma, M, tol=_k.TOL_ROTACION):
    """Ubica un componente de un CATProduct (forma = el Product del componente) con M 4x4. Valida ANTES: CATIA acepta
    una matriz espejo sin avisar, la muestra reflejada y al exportar el STEP la corre de lugar (AUDITORIA_auditor.md del
    20/10, hallazgo 1). Devuelve el estado de la matriz (det, error)."""
    e = _k.validar_matriz(M, tol)
    import catia_base as cb
    cb.evaluar(c, VB_POS, forma, *[float(x) for x in componentes(M)])
    return e
