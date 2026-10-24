# -*- coding: utf-8 -*-
# Interprete: .venv-cad (Py3.12). Correr: C:\Dev\BarackMercosul\.venv-cad\Scripts\python.exe -I gate_tornillos.py --help
"""GATE de tornillos: largo de agarre y largo de rosca contra la PILA REAL del conjunto (gate 3e, P14; 23/10/2026).

Falla real: el tornillo que no toma la tuerca (hallazgo 4 de la auditoria del virolador del 20/10: un M4 de 25,
22 bajo la cabeza, contra brida 4 + placa 15 + arandela 1 + tuerca 4 = 24) y las patas M12 en una placa de 15
(un M12 pide 18 a 30 mm de rosca en plastico: no entra). Propuesta P14 de docs/PROPUESTAS_SKILL_3D_2026-10-23.md.

Uso:
  gate_tornillos.py --step conj.step --tornillos tornillos.json [--workdir W] [--acepto-tornillos "<frase>"]
  gate_tornillos.py --solo-autotest

Por cada tornillo declarado mide EN EL STEP DEL CONJUNTO:
  - el tornillo: el solido que corta su eje (punto y direccion del json); la punta sale de la linea sobre el eje y
    la cara de apoyo de la cabeza de las sondas paralelas al eje. El largo medido se compara con el del json.
  - la pila: las piezas apiladas bajo la cabeza, una detras de otra, medidas con sondas paralelas al eje a dos
    radios (sobre el eje no hay placas: es el agujero). Si no se tocan una con otra, NO MEDIDO.
  - la rosca, segun el campo inserto:
      tuerca_impresa / tuerca_acero: la ultima pieza de la pila es la tuerca y el tornillo la tiene que pasar entera
        (P14; lo que sobresale se informa). Tuerca impresa: altura >= D (R2). Con carga, tuerca impresa = rojo (R5).
      {"tipo": "inserto", "largo_mm": L, "fuente": "..."}: el tornillo tiene que tomar el inserto entero.
      ninguno (rosca en la pieza de plastico): la pieza tiene que tener 1,5 D de material (R3, rojo si no entra);
        con carga, rojo (R5); si toma menos de 2,5 D, aviso con los dos numeros (R3 no reconciliado).
  - el fondo: nada de otro solido sobre el eje entre la cabeza y la punta (toca el fondo o atraviesa: rojo).
Los numeros y su fuente estan en tornillosCanon.data.json.

NO MEDIDO (exit 2, nunca verde): STEP que no esta, truncado o ilegible; json sin largo, sin diametro, sin eje, sin
inserto o sin carga_N (carga 0 solo con motivo_sin_carga); tornillo declarado que no esta en el conjunto; largo del
json distinto del medido; cabeza que no apoya o piezas que no se tocan; solido del conjunto que no es tornillo
declarado, ni esta en una pila, ni en otros_solidos (¿es un tornillo sin declarar?).

Salida: 0 verde, aviso (hasta el 30/10) o aceptado; 1 rojo desde el 31/10 o frase mal; 2 NO MEDIDO; 3 autotest
fallido. La ultima linea es un JSON {"gate": "tornillos", ...} que lee export_deliverables.py.

Formato del json:
  {"conjunto": "conj.step",                 (opcional: a que STEP de la entrega se aplica)
   "otros_solidos": ["base"],               (solidos que no son tornillo ni estan en ninguna pila)
   "tornillos": [{"id": "T1", "diametro_mm": 5, "paso_mm": 1.0, "largo_bajo_cabeza_mm": 27,
                  "eje": {"punto": [0, 0, 3], "direccion": [0, 0, 1]},   (punto sobre el eje; direccion a la punta)
                  "pila": ["placa", "arandela", "tuerca"],                 (opcional: se coteja con la medida)
                  "carga_N": 0, "motivo_sin_carga": "sujeta una tapa, sin esfuerzo",
                  "inserto": "tuerca_impresa"}]}
"""
import argparse
import json
import math
import os
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCR)
CANON = os.path.join(SCR, "tornillosCanon.data.json")
TIPOS = ("tuerca_impresa", "tuerca_acero", "inserto", "ninguno")

try:
    from OCP.BRepAlgoAPI import BRepAlgoAPI_Common
    from OCP.BRepBuilderAPI import BRepBuilderAPI_MakeEdge
    from OCP.BRep import BRep_Tool
    from OCP.TopAbs import TopAbs_EDGE, TopAbs_VERTEX
    from OCP.TopExp import TopExp_Explorer
    from OCP.TopoDS import TopoDS
    from OCP.gp import gp_Pnt
    _OCP_ERROR = None
except Exception as _e:                                     # pragma: no cover
    _OCP_ERROR = "%s: %s" % (type(_e).__name__, _e)


class NoMedido(Exception):
    """La medicion no se pudo hacer: el gate NUNCA da verde en este caso (exit 2)."""


def canon():
    with open(CANON, encoding="utf-8") as f:
        return json.load(f)


def hoy_tornillos(hoy_arg=None):
    """La fecha de hoy. --hoy o CAD_HOY solo valen con CAD_GATE_TEST=1 (los tests); si no, el reloj."""
    from datetime import date
    simulada = hoy_arg or os.environ.get("CAD_HOY", "").strip() or None
    if simulada:
        if os.environ.get("CAD_GATE_TEST") != "1":
            raise NoMedido("--hoy / CAD_HOY solo valen con CAD_GATE_TEST=1 (fecha simulada de los tests)")
        return date.fromisoformat(simulada)
    return date.today()


def dia_siguiente(iso):
    from datetime import date, timedelta
    return (date.fromisoformat(iso) + timedelta(days=1)).isoformat()


def modo_tornillos(medido, n_rojos, hoy, aviso_hasta, aceptada=False):
    """verde | aceptado | aviso | freno. Una sola funcion para el gate y para la entrega."""
    from datetime import date
    if isinstance(aviso_hasta, str):
        aviso_hasta = date.fromisoformat(aviso_hasta)
    if medido and n_rojos == 0:
        return "verde"
    if medido and aceptada:
        return "aceptado"
    return "aviso" if hoy <= aviso_hasta else "freno"


def _num(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)


def salida_valida(j, firma):
    """(ok, motivo): la linea JSON del gate habla de ESTE archivo y trae lo medido por tornillo."""
    if not isinstance(j, dict) or j.get("gate") != "tornillos":
        return False, "no hay salida del gate de tornillos"
    if j.get("medido") is not True:
        return False, "NO MEDIDO: %s" % (j.get("motivo") or "medido no es true")
    ts = j.get("tornillos")
    if not isinstance(ts, list) or not ts:
        return False, "la salida no trae tornillos medidos"
    for t in ts:
        if not isinstance(t, dict) or not t.get("id"):
            return False, "un tornillo de la salida no trae id"
        for k in ("largo_medido_mm", "pila_mm", "margen_mm"):
            if not _num(t.get(k)):
                return False, "el tornillo %s no trae '%s'" % (t.get("id"), k)
        if t.get("veredicto") not in ("verde", "rojo", "aviso"):
            return False, "el tornillo %s no trae veredicto" % t.get("id")
    if not firma or j.get("step_firma") != firma:
        return False, ("la medicion no habla del archivo que se entrega (firma %s, medido %s)"
                       % (firma, j.get("step_firma")))
    return True, ""


def _mm(x):
    return ("%g" % round(float(x), 2)).replace(".", ",")


# ------------------------------------------------------------------ geometria
def _v(p):
    return [float(p[0]), float(p[1]), float(p[2])]


def _sub(a, b):
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]


def _add(a, b, k=1.0):
    return [a[0] + k * b[0], a[1] + k * b[1], a[2] + k * b[2]]


def _dot(a, b):
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def _cross(a, b):
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]


def _norm(a):
    n = math.sqrt(_dot(a, a))
    if n < 1e-12:
        raise NoMedido("direccion del eje nula")
    return [a[0] / n, a[1] / n, a[2] / n]


def solidos_con_nombre(shape):
    """[(nombre, solido)] de las hojas del conjunto. El nombre es la etiqueta del STEP; sin etiqueta, solido_N."""
    hojas = []

    def recorrer(s):
        hijos = list(getattr(s, "children", ()) or ())
        if hijos:
            for h in hijos:
                recorrer(h)
            return
        sols = s.solids() if hasattr(s, "solids") else []
        for k, so in enumerate(sols):
            nom = (getattr(s, "label", "") or "").strip()
            hojas.append([nom if len(sols) == 1 else ("%s_%d" % (nom, k + 1) if nom else ""), so])

    recorrer(shape)
    vistos = {}
    for i, h in enumerate(hojas):
        if not h[0]:
            h[0] = "solido_%d" % (i + 1)
        if h[0] in vistos:
            vistos[h[0]] += 1
            h[0] = "%s#%d" % (h[0], vistos[h[0]])
        else:
            vistos[h[0]] = 1
    return [(n, s) for n, s in hojas]


def _tramos(solido, P, u, largo):
    """Tramos [t0, t1] (t medido desde P a lo largo de u) donde la linea P + t u esta adentro del solido."""
    p0, p1 = _add(P, u, -largo), _add(P, u, largo)
    edge = BRepBuilderAPI_MakeEdge(gp_Pnt(*p0), gp_Pnt(*p1)).Edge()
    cm = BRepAlgoAPI_Common(solido.wrapped, edge)
    cm.Build()
    if not cm.IsDone():
        raise NoMedido("el booleano solido-linea no termino")
    out = []
    ex = TopExp_Explorer(cm.Shape(), TopAbs_EDGE)
    while ex.More():
        e = TopoDS.Edge_s(ex.Current())
        ts = []
        vx = TopExp_Explorer(e, TopAbs_VERTEX)
        while vx.More():
            q = BRep_Tool.Pnt_s(TopoDS.Vertex_s(vx.Current()))
            ts.append(_dot(_sub([q.X(), q.Y(), q.Z()], P), u))
            vx.Next()
        if len(ts) >= 2 and max(ts) - min(ts) > 1e-6:
            out.append([min(ts), max(ts)])
        ex.Next()
    return _unir(out, 1e-4)


def _unir(tramos, tol):
    tramos = sorted(tramos)
    res = []
    for a, b in tramos:
        if res and a <= res[-1][1] + tol:
            res[-1][1] = max(res[-1][1], b)
        else:
            res.append([a, b])
    return res


def medir_tornillo(solidos, t, can, largo_linea):
    """Mide un tornillo declarado sobre [(nombre, solido)]. Devuelve el dict de lo medido o NoMedido."""
    tid = t.get("id")
    D = float(t["diametro_mm"])
    P = _v(t["eje"]["punto"])
    u = _norm(_v(t["eje"]["direccion"]))
    tol_a = float(can["tolerancia_apilado_mm"])
    # el tornillo: el solido que corta el eje en P
    centro = {}
    for n, s in solidos:
        tr = _tramos(s, P, u, largo_linea)
        if tr:
            centro[n] = tr
    cands = [(n, tr) for n, tr in centro.items() if any(a - tol_a <= 0.0 <= b + tol_a for a, b in tr)]
    if not cands:
        raise NoMedido("el tornillo %s declarado no esta en el conjunto: ningun solido corta su eje en el punto %s"
                       % (tid, P))
    if t.get("solido"):
        cands = [c for c in cands if c[0] == t["solido"]]
        if not cands:
            raise NoMedido("el tornillo %s dice solido '%s' y ese solido no corta el eje en %s" % (tid, t["solido"], P))
    nom_t, tr_t = max(cands, key=lambda c: max(b - a for a, b in c[1]))
    tramo_t = [x for x in tr_t if x[0] - tol_a <= 0.0 <= x[1] + tol_a][0]
    punta = tramo_t[1]
    # sondas paralelas al eje
    a = [1.0, 0.0, 0.0] if abs(u[0]) < 0.9 else [0.0, 1.0, 0.0]
    e1 = _norm(_cross(u, a))
    e2 = _cross(u, e1)
    radios = [D / 2.0 + 0.6, 0.78 * D]
    sondas = []
    for r in radios:
        for k in range(int(can["sondas"]["angulos"])):
            ang = 2 * math.pi * k / int(can["sondas"]["angulos"])
            off = _add(_add([0, 0, 0], e1, r * math.cos(ang)), e2, r * math.sin(ang))
            sondas.append(_add(P, off))
    env = {}
    for n, s in solidos:
        todos = []
        for Q in sondas:
            todos += _tramos(s, Q, u, largo_linea)
        if todos:
            env[n] = _unir(todos, tol_a)
    cab = [x for x in env.get(nom_t, []) if x[0] <= tramo_t[1]]
    if not cab:
        raise NoMedido("no encuentro la cabeza del tornillo %s: las sondas a r %s y %s no la tocan (¿tornillo sin "
                       "cabeza o el eje esta corrido?)" % (tid, _mm(radios[0]), _mm(radios[1])))
    apoyo = max(b for _, b in cab)
    largo_med = punta - apoyo
    largo_decl = float(t["largo_bajo_cabeza_mm"])
    if abs(largo_med - largo_decl) > float(can["tolerancia_largo_mm"]):
        raise NoMedido("el json dice que %s mide %s bajo la cabeza y el STEP mide %s: el json no habla de ese "
                       "tornillo" % (tid, _mm(largo_decl), _mm(largo_med)))
    # la pila: piezas que arrancan donde termina la anterior
    pila, cur, usados = [], apoyo, {nom_t}
    while True:
        sig = [(n, x) for n, trs in env.items() if n not in usados for x in trs
               if abs(x[0] - cur) <= tol_a and x[1] > cur + tol_a]
        if not sig:
            break
        if len({n for n, _ in sig}) > 1:
            raise NoMedido("pila ambigua bajo %s: %s arrancan a la misma altura (%s desde la cabeza)"
                           % (tid, ", ".join(sorted({n for n, _ in sig})), _mm(cur - apoyo)))
        n, x = sig[0]
        pila.append({"nombre": n, "desde_mm": round(x[0] - apoyo, 3), "espesor_mm": round(x[1] - x[0], 3)})
        usados.add(n)
        cur = x[1]
    if not pila:
        cerca = sorted(((x[0] - apoyo, n) for n, trs in env.items() if n != nom_t for x in trs
                        if x[0] > apoyo - tol_a), key=lambda z: z[0])
        raise NoMedido("piezas no apiladas: la cabeza de %s no apoya en nada%s" % (
            tid, (" (lo mas cerca: %s a %s mm)" % (cerca[0][1], _mm(cerca[0][0]))) if cerca else ""))
    # una pieza que arranca dentro del largo pero no toca la pila: no apilada
    fin = cur
    for n, trs in env.items():
        if n in usados:
            continue
        for x in trs:
            if apoyo + tol_a < x[0] < min(fin, punta) - tol_a:
                raise NoMedido("piezas no apiladas bajo %s: %s arranca a %s de la cabeza y no toca la pieza de "
                               "arriba" % (tid, n, _mm(x[0] - apoyo)))
    if t.get("pila") is not None:
        decl = [str(x) for x in t["pila"]]
        med = [p["nombre"] for p in pila]
        if decl != med:
            raise NoMedido("la pila declarada de %s (%s) no es la del STEP (%s)" % (tid, ", ".join(decl),
                                                                                   ", ".join(med)))
    # el fondo: otro solido sobre el eje entre la cabeza y la punta (o tocando la punta)
    choque = None
    for n, trs in centro.items():
        if n == nom_t:
            continue
        for x in trs:
            if x[1] > apoyo + 1e-3 and x[0] <= punta + 0.01:
                if choque is None or x[0] < choque[1]:
                    choque = (n, x[0])
    return {"id": tid, "solido": nom_t, "D": D, "paso": t.get("paso_mm"), "apoyo": apoyo, "punta": punta,
            "largo_medido_mm": round(largo_med, 3), "pila": pila, "fin_pila": fin - apoyo,
            "choque": None if choque is None else {"solido": choque[0], "a_mm": round(choque[1] - apoyo, 3)},
            "centro": {n: [[round(a - apoyo, 3), round(b - apoyo, 3)] for a, b in trs] for n, trs in centro.items()
                       if n != nom_t},
            "usados": sorted(usados)}


def juzgar_tornillo(m, t, can):
    """Reglas con fuente (tornillosCanon) sobre lo medido. Devuelve el resumen por tornillo."""
    D = m["D"]
    largo = m["largo_medido_mm"]
    tipo = t["inserto"] if isinstance(t["inserto"], str) else t["inserto"].get("tipo")
    carga = float(t["carga_N"])
    rojos, avisos = [], []
    pila = m["pila"]
    ultima = pila[-1]
    lo, hi = can["rosca_en_plastico_D"]
    if tipo in ("tuerca_impresa", "tuerca_acero"):
        tuerca = ultima
        pila_mm = m["fin_pila"]
        margen = largo - pila_mm
        rosca_util = max(0.0, min(largo, pila_mm) - tuerca["desde_mm"])
        if margen < -1e-6:
            rojos.append("no pasa la tuerca %s: faltan %s mm (largo %s bajo la cabeza, pila %s)"
                         % (tuerca["nombre"], _mm(-margen), _mm(largo), _mm(pila_mm)))
        if tipo == "tuerca_impresa" and tuerca["espesor_mm"] < can["tuerca_impresa_altura_min_D"] * D - 1e-6:
            rojos.append("tuerca impresa %s de %s mm: R2 pide altura >= D = %s" % (
                tuerca["nombre"], _mm(tuerca["espesor_mm"]), _mm(D)))
        if tipo == "tuerca_impresa" and carga > 0:
            rojos.append("rosca cargada (%s N) en tuerca impresa: R5 saca el plastico del camino de la carga "
                         "(tuerca de acero o inserto metalico)" % _mm(carga))
        if can.get("sobresale_min_pasos") and m.get("paso") and margen >= 0:
            pide = float(can["sobresale_min_pasos"]) * float(m["paso"])
            if margen < pide - 1e-6:
                rojos.append("sobresale %s y el canon pide %s" % (_mm(margen), _mm(pide)))
        detalle = "sobresale %s de la tuerca" % _mm(margen) if margen >= 0 else "no llega al final de la tuerca"
    else:
        pieza = ultima
        pila_mm = pieza["desde_mm"]                      # lo apretado: todo lo que hay arriba de la pieza que rosca
        fin_pieza = pieza["desde_mm"] + pieza["espesor_mm"]
        fondo = None
        for x in m["centro"].get(pieza["nombre"], []):
            if x[0] > pieza["desde_mm"] - 1e-3:
                fondo = x[0] if fondo is None else min(fondo, x[0])
        disponible = (fondo if fondo is not None else fin_pieza) - pieza["desde_mm"]
        rosca_util = max(0.0, min(largo, fondo if fondo is not None else fin_pieza) - pieza["desde_mm"])
        if tipo == "inserto":
            li = float(t["inserto"]["largo_mm"])
            hol = float(can["inserto_holgura_mm"] or 0.0)
            margen = rosca_util - (li - hol)
            if margen < -1e-6:
                rojos.append("no toma el inserto entero: toma %s de %s mm (inserto en %s; fuente del largo: %s)"
                             % (_mm(rosca_util), _mm(li), pieza["nombre"], t["inserto"].get("fuente")))
            detalle = "toma %s del inserto de %s" % (_mm(rosca_util), _mm(li))
        else:
            margen = rosca_util - lo * D
            if disponible < lo * D - 1e-6:
                rojos.append("no entra: R3 pide %s D = %s mm de rosca en plastico (%s D = %s) y %s tiene %s"
                             % (_mm(lo), _mm(lo * D), _mm(hi), _mm(hi * D), pieza["nombre"], _mm(disponible)))
            if carga > 0:
                rojos.append("rosca cargada en plastico sin inserto (%s N): R5 pide tuerca de acero o inserto "
                             "metalico" % _mm(carga))
            if not rojos and rosca_util < hi * D - 1e-6:
                avisos.append("toma %s mm de rosca en %s: R3 da %s D = %s y %s D = %s (no reconciliado, a medir "
                              "en la A2L)" % (_mm(rosca_util), pieza["nombre"], _mm(lo), _mm(lo * D), _mm(hi),
                                              _mm(hi * D)))
            detalle = "toma %s mm de rosca en %s (hay %s)" % (_mm(rosca_util), pieza["nombre"], _mm(disponible))
        if largo > fin_pieza + 1e-6 and fondo is None:
            rojos.append("atraviesa %s: la punta sale %s mm del otro lado" % (pieza["nombre"], _mm(largo - fin_pieza)))
    if m["choque"] is not None:
        c = m["choque"]
        rojos.append("toca el fondo o choca: %s esta sobre el eje a %s mm de la cabeza y la punta llega a %s"
                     % (c["solido"], _mm(c["a_mm"]), _mm(largo)))
    return {"id": m["id"], "solido": m["solido"], "diametro_mm": D, "inserto": tipo, "carga_N": carga,
            "largo_declarado_mm": float(t["largo_bajo_cabeza_mm"]), "largo_medido_mm": round(largo, 3),
            "pila": [{"nombre": p["nombre"], "espesor_mm": p["espesor_mm"]} for p in pila],
            "pila_mm": round(pila_mm, 3), "margen_mm": round(margen, 3), "rosca_util_mm": round(rosca_util, 3),
            "detalle": detalle, "veredicto": "rojo" if rojos else ("aviso" if avisos else "verde"),
            "rojos": rojos, "avisos": avisos}


def validar_declaracion(t, can):
    """Campos obligatorios de un tornillo del json. NoMedido si falta algo."""
    tid = t.get("id") if isinstance(t, dict) else None
    if not tid:
        raise NoMedido("un tornillo del json no tiene id")
    for k in ("largo_bajo_cabeza_mm", "diametro_mm"):
        if not _num(t.get(k)) or t.get(k) <= 0:
            raise NoMedido("el tornillo %s no trae %s (un tornillo de catalogo sin largo no se puede juzgar)"
                           % (tid, k))
    eje = t.get("eje")
    try:
        assert isinstance(eje, dict)
        _v(eje["punto"]), _norm(_v(eje["direccion"]))
    except (AssertionError, KeyError, TypeError, ValueError, IndexError):
        raise NoMedido("el tornillo %s no trae eje {punto: [x,y,z], direccion: [dx,dy,dz]}" % tid)
    if "carga_N" not in t or not _num(t.get("carga_N")) or t["carga_N"] < 0:
        raise NoMedido("el tornillo %s no trae carga_N (0 solo con motivo_sin_carga)" % tid)
    if t["carga_N"] == 0 and len(str(t.get("motivo_sin_carga") or "").strip()) < int(can["frase_minima"]):
        raise NoMedido("el tornillo %s dice carga_N 0 sin motivo_sin_carga (%d caracteres o mas)"
                       % (tid, int(can["frase_minima"])))
    ins = t.get("inserto")
    tipo = ins if isinstance(ins, str) else (ins.get("tipo") if isinstance(ins, dict) else None)
    if tipo not in TIPOS:
        raise NoMedido("el tornillo %s no dice donde rosca: inserto = %s (o {tipo: inserto, largo_mm, fuente})"
                       % (tid, " | ".join(TIPOS)))
    if tipo == "inserto" and (not isinstance(ins, dict) or not _num(ins.get("largo_mm")) or ins["largo_mm"] <= 0
                              or not str(ins.get("fuente") or "").strip()):
        raise NoMedido("el inserto del tornillo %s no trae largo_mm y fuente (del catalogo)" % tid)


def medir_conjunto(solidos, decl, can):
    """Mide y juzga todos los tornillos del json sobre [(nombre, solido)]. Devuelve (lista, usados) o NoMedido."""
    ts = decl.get("tornillos") if isinstance(decl, dict) else decl
    if not isinstance(ts, list) or not ts:
        raise NoMedido("el json no trae tornillos")
    ids = [t.get("id") for t in ts if isinstance(t, dict)]
    if len(set(ids)) != len(ids):
        raise NoMedido("hay id de tornillo repetidos en el json")
    for t in ts:
        validar_declaracion(t, can)
    from build123d import Compound
    bb = Compound([s for _, s in solidos]).bounding_box()
    largo_linea = 2.0 * (bb.diagonal + 1.0)
    res, usados = [], set()
    for t in ts:
        m = medir_tornillo(solidos, t, can, largo_linea)
        usados |= set(m["usados"])
        res.append(juzgar_tornillo(m, t, can))
    otros = set(str(x) for x in (decl.get("otros_solidos") or [])) if isinstance(decl, dict) else set()
    sobran = [n for n, _ in solidos if n not in usados and n not in otros]
    if sobran:
        raise NoMedido("solidos del conjunto que no son tornillo declarado, ni estan en una pila, ni en "
                       "otros_solidos: %s (¿es un tornillo sin declarar?)" % ", ".join(sobran))
    return res


# ------------------------------------------------------------------ piezas sinteticas (autotest y tests)
def conjunto_sintetico(capas, largo, D=5.0, cabeza=(9.0, 3.0), hueco=None, nombre_tornillo="T1", luz=0.0):
    """[(nombre, solido)] de un tornillo (cilindro con cabeza, eje Z, apoyo en z=0, punta en z=largo) y una pila de
    capas [(nombre, espesor, tipo)] con tipo 'placa' (40x40 con agujero D+0,5) o 'tuerca' (20x20 con agujero D-1);
    'macizo' es una placa con agujero ciego de profundidad hueco. luz separa las capas (para el caso no apilado).
    Medidas de ensayo para el autotest y los tests: no son un diseno de Barack."""
    from build123d import Align, Box, Cylinder, Location
    A = (Align.CENTER, Align.CENTER, Align.MIN)
    hc, ec = cabeza
    tor = Cylinder(D / 2.0, largo, align=A) + Cylinder(hc / 2.0, ec, align=A).moved(Location((0, 0, -ec)))
    out = [(nombre_tornillo, tor)]
    z = 0.0
    for nom, esp, tipo in capas:
        z += luz
        if tipo == "tuerca":
            s = Box(20, 20, esp, align=A) - Cylinder(D / 2.0 - 0.5, esp, align=A)
        elif tipo == "macizo":
            s = Box(40, 40, esp, align=A) - Cylinder(D / 2.0 + 0.25, hueco, align=A)
        else:
            s = Box(40, 40, esp, align=A) - Cylinder(D / 2.0 + 0.25, esp, align=A)
        out.append((nom, s.moved(Location((0, 0, z)))))
        z += esp
    return out


def _decl(largo, inserto="tuerca_impresa", D=5.0, carga=0, pila=None, **extra):
    t = {"id": "T1", "diametro_mm": D, "paso_mm": 1.0, "largo_bajo_cabeza_mm": largo,
         "eje": {"punto": [0, 0, 0], "direccion": [0, 0, 1]}, "carga_N": carga,
         "motivo_sin_carga": "pieza de ensayo del autotest", "inserto": inserto}
    if pila is not None:
        t["pila"] = pila
    t.update(extra)
    return {"tornillos": [t]}


def autotest():
    """Piezas BIEN/MAL propias: el detector tiene que separarlas antes de juzgar nada. Devuelve la lista de fallas."""
    can = canon()
    prob = []
    capas = [("placa", 19.0, "placa"), ("arandela", 1.0, "placa"), ("tuerca", 5.0, "tuerca")]
    casos = (("BIEN M5 de 27 contra 25", conjunto_sintetico(capas, 27.0), _decl(27.0), "verde", 2.0),
             ("MAL M5 de 22 contra 25", conjunto_sintetico(capas, 22.0), _decl(22.0), "rojo", -3.0),
             ("frontera largo = pila", conjunto_sintetico(capas, 25.0), _decl(25.0), "verde", 0.0),
             ("frontera pila - 0,1", conjunto_sintetico(capas, 24.9), _decl(24.9), "rojo", -0.1))
    for nombre, sol, decl, esperado, margen in casos:
        try:
            r = medir_conjunto(sol, decl, can)[0]
        except NoMedido as e:
            prob.append("%s: NO MEDIDO (%s)" % (nombre, e))
            continue
        if r["veredicto"] != esperado or abs(r["margen_mm"] - margen) > 0.01 or abs(r["pila_mm"] - 25.0) > 0.01:
            prob.append("%s: esperado %s margen %s pila 25, dio %s margen %s pila %s"
                        % (nombre, esperado, margen, r["veredicto"], r["margen_mm"], r["pila_mm"]))
    try:
        medir_conjunto(conjunto_sintetico(capas, 27.0, luz=0.5), _decl(27.0), can)
        prob.append("piezas separadas 0,5: dio medido y tenia que ser NO MEDIDO")
    except NoMedido:
        pass
    return prob


# ------------------------------------------------------------------ CLI
def _leer_step(ruta):
    if not os.path.isfile(ruta):
        raise NoMedido("no existe el archivo: %s" % ruta)
    if not ruta.lower().endswith((".step", ".stp")):
        raise NoMedido("el gate de tornillos trabaja sobre el STEP del conjunto")
    with open(ruta, "rb") as fh:
        fh.seek(max(0, os.path.getsize(ruta) - 4096))
        cola = fh.read()
    if b"END-ISO-10303-21" not in cola:
        raise NoMedido("STEP truncado o incompleto (no termina en END-ISO-10303-21;)")
    from build123d import import_step
    try:
        sh = import_step(ruta)
    except Exception as e:
        raise NoMedido("STEP ilegible: %s: %s" % (type(e).__name__, e))
    sol = solidos_con_nombre(sh)
    if not sol:
        raise NoMedido("el STEP no trae solidos")
    return sol


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--step", help="STEP del conjunto (tornillos, piezas y tuercas)")
    p.add_argument("--tornillos", help="json con los tornillos declarados")
    p.add_argument("--workdir", default=None, help="workdir con manifest.json donde queda la evidencia")
    p.add_argument("--hoy", default=None, help="fecha simulada AAAA-MM-DD (solo con CAD_GATE_TEST=1)")
    p.add_argument("--acepto-tornillos", default=None, metavar="FRASE",
                   help="Fak asume los rojos: frase de 10 caracteres o mas; queda en el manifest con fecha, firma "
                        "del conjunto y los id aceptados (exige --workdir)")
    p.add_argument("--solo-autotest", action="store_true", help="probar el detector y salir")
    p.add_argument("--json", help="volcar el resultado")
    a = p.parse_args(argv)
    try:
        can = canon()
    except (OSError, ValueError) as e:
        print("NO MEDIDO: no se pudo leer %s (%s)" % (CANON, e))
        return 2
    res = {"gate": "tornillos", "medido": False, "veredicto": "no_medido", "modo": None, "step": a.step,
           "step_firma": None, "tornillos_json": a.tornillos, "tornillos": [], "rojos": [], "avisos": [],
           "hoy": None, "aviso_hasta": can["aviso_hasta"], "motivo": None}

    def cerrar(codigo, texto):
        print(texto)
        if a.workdir and a.step:
            try:
                from cadlib import workdir as _wd
                _wd.ensure_workdir(a.workdir)
                ev = {k: v for k, v in res.items() if k not in ("gate", "modo")}
                _wd.record_evidence(a.workdir, "tornillos", fixture=os.path.basename(a.step), **ev)
            except Exception as e:                            # pragma: no cover
                print("  (no se pudo escribir la evidencia en el manifest: %s)" % e)
        if a.json:
            with open(a.json, "w", encoding="utf-8") as f:
                json.dump(res, f, indent=1, ensure_ascii=False)
        print(json.dumps(res, ensure_ascii=True), flush=True)
        return codigo

    def no_medido(motivo):
        res["motivo"] = motivo
        return cerrar(2, "NO MEDIDO: %s. Un control que no midio nunca da verde." % motivo)

    if _OCP_ERROR is not None:
        return no_medido("falta OCP (el nucleo de OpenCASCADE): %s" % _OCP_ERROR)
    try:
        hoy = hoy_tornillos(a.hoy)
    except (NoMedido, ValueError) as e:
        return no_medido(str(e))
    res["hoy"] = hoy.isoformat()
    print("AUTOTEST del gate de tornillos (conjuntos BIEN/MAL propios)")
    prob = autotest()
    if prob:
        print("  [AUTOTEST FALLA]")
        for x in prob:
            print("    - " + x)
        print("  No se juzga ningun conjunto con un detector que no probo distinguir.")
        return 3
    print("  [AUTOTEST OK] el detector separa BIEN de MAL.\n")
    if a.solo_autotest:
        return 0
    if not a.step:
        return no_medido("hace falta --step (o --solo-autotest)")
    if a.acepto_tornillos is not None and len(a.acepto_tornillos.strip()) < int(can["frase_minima"]):
        res["motivo"] = "frase corta"
        return cerrar(1, "NO SE ACEPTA: --acepto-tornillos necesita la frase de Fak (%d caracteres o mas); llego "
                      "«%s» (frase corta)" % (int(can["frase_minima"]), a.acepto_tornillos))
    if a.acepto_tornillos is not None and not a.workdir:
        res["motivo"] = "aceptacion sin manifest"
        return cerrar(1, "NO SE ACEPTA: la aceptacion queda escrita en el manifest; falta --workdir")
    if os.path.isfile(a.step):
        from cadlib import workdir as _wd
        res["step_firma"] = _wd.file_signature(a.step)
    if not a.tornillos:
        return no_medido("falta --tornillos <json> (cada tornillo con id, largo bajo cabeza, eje, carga_N, inserto)")
    try:
        with open(a.tornillos, encoding="utf-8") as f:
            decl = json.load(f)
    except (OSError, ValueError) as e:
        return no_medido("no se pudo leer el json de tornillos %s (%s)" % (a.tornillos, e))
    try:
        sol = _leer_step(a.step)
        ts = medir_conjunto(sol, decl, can)
    except NoMedido as e:
        return no_medido(str(e))
    res["tornillos"] = ts
    res["medido"] = True
    rojos = [t["id"] for t in ts if t["veredicto"] == "rojo"]
    res["rojos"] = rojos
    res["avisos"] = [t["id"] for t in ts if t["veredicto"] == "aviso"]
    res["veredicto"] = "rojo" if rojos else "verde"
    print("conjunto: %s   %d tornillos" % (os.path.basename(a.step), len(ts)))
    for t in ts:
        print("  %-8s %-6s M%s largo %s, pila %s (%s), %s, margen %s" % (
            t["id"], t["veredicto"].upper(), _mm(t["diametro_mm"]), _mm(t["largo_medido_mm"]), _mm(t["pila_mm"]),
            " + ".join("%s %s" % (x["nombre"], _mm(x["espesor_mm"])) for x in t["pila"]), t["detalle"],
            _mm(t["margen_mm"])))
        for x in t["rojos"]:
            print("      ROJO: " + x)
        for x in t["avisos"]:
            print("      aviso: " + x)
    resumen = "; ".join("%s: %s" % (t["id"], " / ".join(t["rojos"])) for t in ts if t["rojos"])
    aceptada = False
    if rojos and a.acepto_tornillos is not None:
        from cadlib import workdir as _wd
        frase = a.acepto_tornillos.strip()
        man = _wd.load_manifest(a.workdir) if os.path.isfile(os.path.join(a.workdir, _wd.MANIFEST)) else {}
        otra = [e for e in man.get("evidence", []) if e.get("kind") == "tornillos_aceptados"
                and (e.get("frase") or "").strip() == frase and e.get("step_firma") != res["step_firma"]]
        if otra:
            res["motivo"] = "frase usada para otra version"
            return cerrar(1, "NO SE ACEPTA: esa frase ya acepto otra version del conjunto (firma %s; hoy %s). Una "
                          "aceptacion vale para UNA firma: mirar el conjunto nuevo y escribir otra."
                          % (otra[-1].get("step_firma"), res["step_firma"]))
        _wd.ensure_workdir(a.workdir)
        _wd.record_evidence(a.workdir, "tornillos_aceptados", fixture=os.path.basename(a.step), step=a.step,
                            step_firma=res["step_firma"], frase=frase, fecha=hoy.isoformat(), ids=rojos,
                            detalle={t["id"]: t["rojos"] for t in ts if t["rojos"]})
        res["aceptacion"] = {"frase": frase, "fecha": hoy.isoformat(), "ids": rojos}
        aceptada = True
    modo = modo_tornillos(True, len(rojos), hoy, can["aviso_hasta"], aceptada)
    res["modo"] = modo
    if modo == "verde":
        return cerrar(0, "[OK] %d tornillos: todos pasan la pila y toman su rosca%s" % (
            len(ts), (" (avisos: %s)" % ", ".join(res["avisos"])) if res["avisos"] else ""))
    if modo == "aceptado":
        return cerrar(0, "[ACEPTADO] %s. Queda en el manifest: frase, fecha, firma del conjunto y los id." % resumen)
    salidas = "; ".join(can["salidas"])
    if modo == "aviso":
        return cerrar(0, "AVISO: %s; freno desde %s. Salidas: %s" % (resumen, dia_siguiente(can["aviso_hasta"]),
                                                                      salidas))
    return cerrar(1, "FRENO: %s. Salidas: %s" % (resumen, salidas))


if __name__ == "__main__":
    sys.exit(main())
