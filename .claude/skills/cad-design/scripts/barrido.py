# -*- coding: utf-8 -*-
# Interprete: .venv-cad (Py3.12). Correr: C:\Dev\BarackMercosul\.venv-cad\Scripts\python.exe -I barrido.py --help
"""GATE de BARRIDO del recorrido: la parte que se mueve, ¿choca, toca o pellizca en ALGUNA pose, no solo en los
extremos? (gate 3d, 23/10/2026; propuestas P3 y P12 de docs/PROPUESTAS_SKILL_3D_2026-10-23.md)

POR QUE EXISTE. Choques e interferencias que ningun control vio porque solo se miraban los extremos: el empujador del
posicionador Top Roll que atravesaba la pared (21/07/2026), las patas del carro que tocaban el marco por una arista
(19/10/2026), el virolador de cuatro barras del 20/10/2026. Un barrido con paso grueso es tan ciego como el que mira
solo 0 y 60: el mutante del banco que choca a 35 grados da VERDE con barrido_palanca.py --paso 60.

    barrido.py <conjunto.json> [--paso 2.5] [--dedo 25] [--mano 100] [--tope-seg 120] [--workdir W]
               [--acepto-barrido "<frase de Fak>"] [--hoy AAAA-MM-DD (solo con CAD_GATE_TEST=1)] [--json salida.json]
    barrido.py --solo-autotest

EL JSON DEL CONJUNTO (el del ejercicio 06 del banco, mas campos opcionales):
  "partes": ["base", "soporte", "palanca"], "archivos": {"base": "base.step", ...}: un STEP por parte (rutas relativas
      al json); una parte puede traer varios solidos.
  MODO EJE: "movil": "palanca" (o lista), "eje": {"origen": [x,y,z], "dir": [x,y,z]}, "rango_grados": [0, 60]. Giro
      positivo = regla de la mano derecha alrededor de dir; el STEP esta en la pose 0.
  MODO ESTADOS: "estados": [{"matrices": {parte: 4x4}, "<etiqueta>": valor}, ...] o "estados_archivo": "x.json" (con
      clave "estados", como palanca_makerworld/estados.json del virolador) y "estados_etiqueta": "mango_deg". Las
      partes con matriz son las moviles; las demas quedan fijas.
  "permitidos": [["base_A", "pedestal"], ...]: contactos legitimos (pivote, apoyo, tope, mordaza contra la pieza). Se
      informan aparte y frenan solo si se meten mas de permitido_hasta_mm3.
  "junta": ["soporte"]: la que sostiene el eje. El choque contra ella cuenta; su luz se informa aparte. Si su luz cambia
      a lo largo del recorrido no es soporte del eje y se juzga como parte comun.
  "lazos": [{"a": "biela_1", "pa": [x,y,z], "b": "brazo_A", "pb": [x,y,z]}]: el mismo perno visto desde las dos piezas
      que une (coordenadas de cada STEP). En cada estado los dos puntos tienen que coincidir (lazo_tol_mm).
  "entre_moviles": false. Con true tambien se cruzan las moviles entre si.

QUE MIDE, por pose y por par (movil contra fija): volumen de la interseccion de malla (manifold3d, la herramienta de
sim_rapida.py del 20/10) y luz minima (min_gap). Por par, a lo largo del recorrido: choque maximo y luz minima, con pose.
  CHOQUE o CONTACTO (volumen > umbral o luz < contacto_mm) en un par no declarado -> ROJO; frena desde el 31/10.
  LUZ < dedo (25 mm) -> ROJO por pellizco, pero queda como AVISO (P12: luces_frenan false, se revisa el 30/10).
  LUZ < mano (100 mm) -> aviso.
GUARDAS (cada una contra una falla callada; P3): STEP truncado o sin solidos, Manifold vacio o con error, volumen de
malla distinto del exacto, rango ausente o nulo, matriz que no es rotacion pura (espejo, det -1), lazo que no cierra,
paso mayor que la guarda (se refina en modo eje; NO MEDIDO en modo estados) y tope de tiempo con subproceso real. Todas
dan NO MEDIDO (exit 2), nunca verde. Par BIEN/MAL propio antes de cada corrida (y con --solo-autotest): si no los
separa, exit 3 y no juzga.
EXACTO EN LA POSE CRITICA (P3: «malla para barrer, exacto para decidir»): el par peor se repite con el booleano y la
distancia exactos de OpenCASCADE si los dos STEP son chicos (exacto_hasta_mb); si malla y exacto no coinciden, NO MEDIDO.

Salida: texto y UNA linea JSON {"gate": "barrido", ...} al final. Codigos: 0 verde, aviso o aceptado; 1 freno o frase
mal; 2 NO MEDIDO; 3 autotest. Con --workdir deja la evidencia "barrido" en el manifest (lo medido, no el modo).
Canon: barridoCanon.data.json. Origen del codigo: el giro, las poses con el extremo incluido y la luz por par salen de
evals/banco3d/correctores/barrido_palanca.py; la malla, el Manifold y las matrices por estado, de
C:/Dev/_catia_practica/virolador_auto/sim_rapida.py (20/10/2026). Copiados, no importados: barrido_palanca desvia el
stdout al importarse y sim_rapida corre entero al importarse.
"""
import argparse
import hashlib
import json
import math
import os
import subprocess
import sys
import threading
import time

AQUI = os.path.dirname(os.path.abspath(__file__))
if AQUI not in sys.path:
    sys.path.insert(0, AQUI)
CANON = os.path.join(AQUI, "barridoCanon.data.json")
MARCA = "@@barrido "


class NoMedido(Exception):
    """La medicion no se pudo hacer: el gate NUNCA da verde en este caso (exit 2)."""


# ----------------------------------------------------------------------------------------------------------------
# canon, fecha y modo (una sola funcion para barrido.py y para export_deliverables.py)
# ----------------------------------------------------------------------------------------------------------------
def canon_barrido():
    with open(CANON, encoding="utf-8") as f:
        return json.load(f)


def hoy_barrido(hoy_arg=None):
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


def modo_barrido(medido, duro, rojo, hoy, aviso_hasta, aceptada=False):
    """verde | aceptado | aviso | freno.

    duro = choque o contacto en un par no declarado (o NO MEDIDO): eso frena desde el dia siguiente a aviso_hasta.
    rojo = hay algo rojo (duro o luz menor que un dedo). La luz de dedo sola queda en aviso (luces_frenan false)."""
    from datetime import date
    if isinstance(aviso_hasta, str):
        aviso_hasta = date.fromisoformat(aviso_hasta)
    if medido and not rojo:
        return "verde"
    if medido and aceptada:
        return "aceptado"
    if medido and not duro:
        return "aviso"
    return "aviso" if hoy <= aviso_hasta else "freno"


def _mm(x, d=1):
    return ("%.*f" % (d, float(x))).replace(".", ",")


# ----------------------------------------------------------------------------------------------------------------
# lectura del conjunto (la hace el padre, antes de lanzar el subproceso: barata y sin OCC)
# ----------------------------------------------------------------------------------------------------------------
def _matriz(M, quien):
    import numpy as np
    try:
        A = np.asarray(M, dtype=float)
        assert A.shape == (4, 4)
    except Exception:
        raise NoMedido("la matriz de %s no es 4x4" % quien)
    R = A[:3, :3]
    if not np.allclose(A[3], [0, 0, 0, 1], atol=1e-9) or not np.allclose(R.T @ R, np.eye(3), atol=1e-5):
        raise NoMedido("la matriz de %s no es una rotacion pura con traslacion (escala o corte)" % quien)
    if np.linalg.det(R) < 0:
        raise NoMedido("la matriz de %s es un ESPEJO (det -1): una pieza en espejo no es la misma pieza" % quien)
    return A


def rot_eje(origen, d, grados):
    """Matriz 4x4 del giro de 'grados' alrededor de la recta (origen, d), regla de la mano derecha."""
    import numpy as np
    k = np.asarray(d, dtype=float)
    k = k / np.linalg.norm(k)
    t = math.radians(grados)
    c, s = math.cos(t), math.sin(t)
    K = np.array([[0, -k[2], k[1]], [k[2], 0, -k[0]], [-k[1], k[0], 0]])
    R = np.eye(3) * c + s * K + (1 - c) * np.outer(k, k)
    o = np.asarray(origen, dtype=float)
    M = np.eye(4)
    M[:3, :3] = R
    M[:3, 3] = o - R @ o
    return M


def poses_eje(a0, a1, paso):
    """Poses de a0 a a1 cada 'paso', la ultima INCLUIDA (barrido_palanca.py)."""
    out, a = [], a0
    while a < a1 - 1e-9:
        out.append(round(a, 6))
        a += paso
    out.append(a1)
    return out


def _cola_step(ruta):
    if not os.path.isfile(ruta):
        raise NoMedido("no existe el STEP: %s" % ruta)
    with open(ruta, "rb") as fh:
        fh.seek(max(0, os.path.getsize(ruta) - 4096))
        cola = fh.read()
    if b"END-ISO-10303-21" not in cola:
        raise NoMedido("STEP truncado o incompleto (no termina en END-ISO-10303-21;): %s" % os.path.basename(ruta))


def leer_conjunto(ruta_json, paso_pedido):
    """Lee y valida el json. Devuelve el 'spec' que recibe el subproceso. NoMedido si falta algo."""
    if not os.path.isfile(ruta_json):
        raise NoMedido("no existe el json del conjunto: %s" % ruta_json)
    try:
        with open(ruta_json, encoding="utf-8") as f:
            meta = json.load(f)
    except (OSError, ValueError) as e:
        raise NoMedido("json del conjunto ilegible: %s" % e)
    base = os.path.dirname(os.path.abspath(ruta_json))
    partes = meta.get("partes")
    arch = meta.get("archivos") or {}
    if isinstance(partes, dict):
        arch, partes = partes, list(partes)
    if not partes or not isinstance(partes, list):
        raise NoMedido("el json no declara 'partes'")
    rutas = {}
    for p in partes:
        if p not in arch:
            raise NoMedido("la parte '%s' no tiene STEP en 'archivos'" % p)
        r = arch[p] if os.path.isabs(arch[p]) else os.path.normpath(os.path.join(base, arch[p]))
        _cola_step(r)
        rutas[p] = r
    spec = {"json": os.path.abspath(ruta_json), "archivos": rutas, "partes": list(partes),
            "permitidos": [sorted([str(x[0]), str(x[1])]) for x in (meta.get("permitidos") or [])],
            "junta": [str(x) for x in (meta.get("junta") or [])], "entre_moviles": bool(meta.get("entre_moviles")),
            "estados_archivo": None}
    for par in spec["permitidos"]:
        for x in par:
            if x not in rutas:
                raise NoMedido("permitidos nombra '%s', que no es una parte del conjunto" % x)
    estados = meta.get("estados")
    etq = meta.get("estados_etiqueta")
    if meta.get("estados_archivo"):
        ea = meta["estados_archivo"]
        ea = ea if os.path.isabs(ea) else os.path.normpath(os.path.join(base, ea))
        try:
            with open(ea, encoding="utf-8") as f:
                estados = json.load(f).get("estados")
        except (OSError, ValueError, AttributeError) as e:
            raise NoMedido("estados_archivo ilegible: %s" % e)
        spec["estados_archivo"] = ea
    if estados is not None:
        if not isinstance(estados, list) or len(estados) < 2:
            raise NoMedido("modo estados con menos de 2 estados: no hay recorrido")
        moviles = sorted({p for e in estados for p in (e.get("matrices") or {}) if p in rutas})
        if not moviles:
            raise NoMedido("ningun estado trae matriz de una parte del conjunto: no hay movil")
        lista = []
        for i, e in enumerate(estados):
            mats = e.get("matrices") or {}
            fila = {}
            for p in moviles:
                if p not in mats:
                    raise NoMedido("el estado %d no trae la matriz de '%s'" % (i, p))
                fila[p] = _matriz(mats[p], "'%s' en el estado %d" % (p, i)).tolist()
            lista.append({"etiqueta": e.get(etq, i) if etq else e.get("etiqueta", i), "matrices": fila})
        spec.update(modo="estados", moviles=moviles, estados=lista, poses_planeadas=len(lista),
                    paso_pedido=None, ignoradas=sorted({p for e in estados for p in (e.get("matrices") or {})
                                                        if p not in rutas}))
        lazos = meta.get("lazos") or []
        _verificar_lazos(lazos, lista, rutas)
        spec["lazos"] = len(lazos)
    else:
        mov = meta.get("movil")
        mov = [mov] if isinstance(mov, str) else list(mov or [])
        if not mov:
            raise NoMedido("el json no declara 'movil' ni 'estados': no hay recorrido que barrer")
        for p in mov:
            if p not in rutas:
                raise NoMedido("el movil '%s' no es una parte del conjunto" % p)
        eje = meta.get("eje") or {}
        try:
            o, d = [float(x) for x in eje["origen"]], [float(x) for x in eje["dir"]]
            assert len(o) == 3 and len(d) == 3 and math.sqrt(sum(x * x for x in d)) > 1e-9
        except (KeyError, TypeError, ValueError, AssertionError):
            raise NoMedido("el json no declara un eje valido ({\"origen\": [x,y,z], \"dir\": [x,y,z]})")
        rg = meta.get("rango_grados")
        try:
            a0, a1 = float(rg[0]), float(rg[1])
        except (TypeError, ValueError, IndexError):
            raise NoMedido("rango_grados ausente o ilegible: no hay recorrido que barrer")
        if not a1 > a0:
            raise NoMedido("rango_grados %s es nulo o al reves (tiene que ser [desde, hasta] con hasta > desde)" % rg)
        if not paso_pedido or paso_pedido <= 0:
            raise NoMedido("--paso tiene que ser mayor que 0")
        spec.update(modo="eje", moviles=mov, eje={"origen": o, "dir": d}, rango=[a0, a1], paso_pedido=paso_pedido,
                    poses_planeadas=len(poses_eje(a0, a1, paso_pedido)), lazos=0, ignoradas=[])
    for j in spec["junta"]:
        if j not in rutas:
            raise NoMedido("junta nombra '%s', que no es una parte del conjunto" % j)
    spec["fijas"] = [p for p in partes if p not in spec["moviles"]]
    if not spec["fijas"] and not spec["entre_moviles"]:
        raise NoMedido("no queda ninguna parte fija contra la que medir")
    return spec


def _verificar_lazos(lazos, estados, rutas):
    import numpy as np
    tol = float(canon_barrido()["lazo_tol_mm"])
    for k, lz in enumerate(lazos):
        try:
            a, b = lz["a"], lz["b"]
            pa, pb = np.append(np.asarray(lz["pa"], float), 1.0), np.append(np.asarray(lz["pb"], float), 1.0)
        except (KeyError, TypeError, ValueError):
            raise NoMedido("el lazo %d se escribe {\"a\", \"pa\": [x,y,z], \"b\", \"pb\": [x,y,z]}" % k)
        for i, e in enumerate(estados):
            Ma = np.asarray(e["matrices"].get(a), float) if a in e["matrices"] else np.eye(4)
            Mb = np.asarray(e["matrices"].get(b), float) if b in e["matrices"] else np.eye(4)
            d = float(np.linalg.norm((Ma @ pa)[:3] - (Mb @ pb)[:3]))
            if d > tol:
                raise NoMedido("el lazo %s-%s no cierra en el estado %d (etiqueta %s): los dos puntos del perno "
                               "quedan a %.3f mm (tolerancia %s): las poses barren una trayectoria que no existe"
                               % (a, b, i, e["etiqueta"], d, _mm(tol, 2)))


def firma_conjunto(spec):
    """(firma, firmas por parte): la del json, la de cada STEP y la de los estados. Cambia si cambia cualquiera."""
    from cadlib import workdir
    firmas = {p: workdir.file_signature(r) for p, r in sorted(spec["archivos"].items())}
    todo = {"json": workdir.file_signature(spec["json"]), "partes": firmas,
            "estados": workdir.file_signature(spec["estados_archivo"]) if spec.get("estados_archivo") else None}
    h = hashlib.sha1(json.dumps(todo, sort_keys=True).encode("utf-8")).hexdigest()[:16]
    return "bc-" + h, firmas


# ----------------------------------------------------------------------------------------------------------------
# nucleo: mallas, poses con guarda, barrido y veredicto (corre en el subproceso)
# ----------------------------------------------------------------------------------------------------------------
def a_manifold(verts, faces):
    import numpy as np
    import manifold3d as m3
    mesh = m3.Mesh(vert_properties=np.asarray(verts, dtype=np.float32), tri_verts=np.asarray(faces, dtype=np.uint32))
    return m3.Manifold(mesh)


def _solido_valido(man, vol_occ, area_occ, tol, quien):
    import manifold3d as m3
    if man.status() != m3.Error.NoError or man.is_empty():
        raise NoMedido("la malla de %s no es estanca (Manifold: %s%s): un booleano sobre ella da vacio, un «no "
                       "choca» falso" % (quien, man.status(), ", vacio" if man.is_empty() else ""))
    vm = man.volume()
    lim = max(0.01 * abs(vol_occ), abs(area_occ) * tol)
    if vol_occ <= 0 or abs(vm - vol_occ) > lim:
        raise NoMedido("la malla de %s no coincide con el solido: volumen de malla %.3f mm3 y exacto %.3f mm3 "
                       "(margen %.3f)" % (quien, vm, vol_occ, lim))


def mallas_de(parte, ruta, tol, ang):
    """[{man, verts, occ, seccion, n_tri}] por solido. NoMedido si el STEP no trae solidos o la malla no sirve."""
    import numpy as np
    import trimesh
    from build123d import import_step
    try:
        forma = import_step(ruta)
    except Exception as e:
        raise NoMedido("STEP ilegible (%s): %s: %s" % (os.path.basename(ruta), type(e).__name__, e))
    solidos = list(forma.solids())
    if not solidos:
        raise NoMedido("el STEP de '%s' no trae solidos (cascara abierta o superficie): no se puede medir volumen"
                       % parte)
    out = []
    for i, s in enumerate(solidos):
        v, f = s.tessellate(tol, ang)
        if not f:
            raise NoMedido("el solido %d de '%s' no se pudo mallar" % (i, parte))
        tm = trimesh.Trimesh(np.array([[p.X, p.Y, p.Z] for p in v]), np.array(f), process=True)
        tm.merge_vertices()
        man = a_manifold(tm.vertices, tm.faces)
        _solido_valido(man, s.volume, s.area, tol, "'%s' (solido %d)" % (parte, i))
        out.append({"man": man, "verts": np.asarray(tm.vertices, dtype=float), "occ": s, "n_tri": len(tm.faces),
                    "tm": tm})
    return out


def seccion_min(tm):
    """La menor medida del solido: la menor entre la caja alineada a los ejes y la caja en sus ejes principales.

    Las dos son cotas de arriba del ancho minimo verdadero (ninguna direccion da menos que el ancho minimo); se toma la
    menor. La caja orientada de volumen minimo (trimesh bounding_box_oriented) es exacta pero tardo mas de 90 s con las
    piezas del virolador (23/10/2026)."""
    import numpy as np
    v = np.asarray(tm.vertices if hasattr(tm, "vertices") else [], dtype=float)
    ext = [float(x) for x in tm.extents]
    if len(v) >= 4:
        c = v - v.mean(axis=0)
        _, vec = np.linalg.eigh(c.T @ c)
        q = c @ vec
        ext += [float(x) for x in (q.max(axis=0) - q.min(axis=0))]
    return float(min(ext))


def _dist_eje(verts, o, d):
    import numpy as np
    k = np.asarray(d, float) / np.linalg.norm(d)
    w = verts - np.asarray(o, float)
    return np.linalg.norm(w - np.outer(w @ k, k), axis=1)


def plan_poses(spec, piezas, frac):
    """Poses [(etiqueta, {movil: M})] y la guarda. En modo eje refina el paso; en estados, NoMedido si no alcanza."""
    import numpy as np
    guarda = {"fraccion_seccion": frac}
    if spec["modo"] == "eje":
        o, d = spec["eje"]["origen"], spec["eje"]["dir"]
        lim_rad, peor = None, None
        for p in spec["moviles"]:
            for i, s in enumerate(piezas[p]):
                r = float(_dist_eje(s["verts"], o, d).max())
                sec = seccion_min(s["tm"])
                s["seccion"], s["r_max"] = sec, r
                if r <= 1e-9:
                    continue
                th = frac * sec / r
                if lim_rad is None or th < lim_rad:
                    lim_rad, peor = th, (p, i, sec, r)
        a0, a1 = spec["rango"]
        pedido = float(spec["paso_pedido"])
        guarda_deg = math.degrees(lim_rad) if lim_rad else 360.0
        if pedido > guarda_deg + 1e-9:
            n = int(math.ceil((a1 - a0) / guarda_deg - 1e-9))
            paso = (a1 - a0) / n
            angs = [a0 + k * paso for k in range(n)] + [a1]
            refinado = True
        else:
            paso, angs, refinado = pedido, poses_eje(a0, a1, pedido), False
        poses = [(round(a, 4), {m: rot_eje(o, d, a) for m in spec["moviles"]}) for a in angs]
        corr = max((s["r_max"] * math.radians(paso) / (frac * s["seccion"])
                    for p in spec["moviles"] for s in piezas[p] if s.get("seccion")), default=0.0)
        guarda.update(guarda_grados=round(guarda_deg, 4), paso_pedido=pedido, paso_grados=round(paso, 4),
                      refinado=refinado, corrimiento_ratio_max=round(corr, 4),
                      parte_guarda=peor[0] if peor else None, seccion_min_mm=round(peor[2], 3) if peor else None,
                      r_max_mm=round(peor[3], 3) if peor else None,
                      corrimiento_max_mm=round(peor[3] * math.radians(paso), 3) if peor else 0.0,
                      guarda_mm=round(frac * peor[2], 3) if peor else None)
        return poses, guarda
    poses = [(e["etiqueta"], {m: np.asarray(e["matrices"][m], float) for m in spec["moviles"]})
             for e in spec["estados"]]
    peor = (0.0, None)
    for p in spec["moviles"]:
        for i, s in enumerate(piezas[p]):
            s["seccion"] = sec = seccion_min(s["tm"])
            try:
                hv = np.asarray(s["tm"].convex_hull.vertices, float)
            except Exception:
                hv = s["verts"]
            H = np.hstack([hv, np.ones((len(hv), 1))])
            for k in range(len(poses) - 1):
                A, B = poses[k][1][p], poses[k + 1][1][p]
                dmax = float(np.linalg.norm((H @ (B - A).T)[:, :3], axis=1).max())
                ratio = dmax / (frac * sec) if sec > 0 else float("inf")
                if ratio > peor[0]:
                    peor = (ratio, (p, i, k, dmax, sec))
    guarda.update(paso_pedido=None, paso_grados=None, guarda_grados=None, refinado=False,
                  corrimiento_ratio_max=round(peor[0], 4))
    if peor[1]:
        p, i, k, dmax, sec = peor[1]
        guarda.update(parte_guarda=p, seccion_min_mm=round(sec, 3), corrimiento_max_mm=round(dmax, 3),
                      guarda_mm=round(frac * sec, 3), entre_estados=[k, k + 1])
        if peor[0] > 1 + 1e-9:
            raise NoMedido("entre el estado %d y el %d la pieza '%s' (solido %d) se corre %.2f mm, mas que la guarda "
                           "(%.2f mm = %s de su seccion minima %.2f mm): un obstaculo fino puede quedar entre los dos "
                           "estados; hacen falta estados mas juntos (sin cinematica no se refina)"
                           % (k, k + 1, p, i, dmax, frac * sec, _mm(frac, 2), sec))
    return poses, guarda


def _aabb(man):
    return man.bounding_box()


def _dist_cajas(a, b):
    dx = max(0.0, max(a[0], b[0]) - min(a[3], b[3]))
    dy = max(0.0, max(a[1], b[1]) - min(a[4], b[4]))
    dz = max(0.0, max(a[2], b[2]) - min(a[5], b[5]))
    return math.sqrt(dx * dx + dy * dy + dz * dz)


def barrer(spec, piezas, poses, cfg, emitir=None, t_limite=None):
    """Recorre todas las poses. Devuelve {par: registro} con el choque y la luz por pose.

    Luz: hasta dedo+1 mm en TODAS las poses y pares (min_gap de manifold3d; si no hay nada mas cerca, el resultado no
    es una luz y se guarda None = 'mas que el alcance'). Entre dedo+1 y mano+1 mm, tambien en todas las poses: con
    min_gap si el conjunto es chico (luz_completa) y, si es grande, con la distancia entre vertices de las dos mallas
    (arbol k-d): es una cota de arriba de la luz (la luz real es igual o menor), alcanza para afirmar el aviso de mano
    y puede no verlo si la luz real queda bajo la mano y los vertices mas cercanos no. Los pares permitidos se miden
    hasta 1 mm (para saber si tocan)."""
    import numpy as np
    dedo, mano = cfg["dedo_mm"], cfg["mano_mm"]
    L1, L2 = dedo + 1.0, mano + 1.0
    perm = {tuple(x) for x in spec["permitidos"]}
    pares = [(m, f) for m in spec["moviles"] for f in spec["fijas"]]
    if spec["entre_moviles"]:
        ms = spec["moviles"]
        pares += [(ms[i], ms[j]) for i in range(len(ms)) for j in range(i + 1, len(ms))]
    reg = {}
    for m, f in pares:
        clase = "permitido" if tuple(sorted([m, f])) in perm else ("junta" if (f in spec["junta"] or m in
                                                                              spec["junta"]) else "comun")
        reg[(m, f)] = {"clase": clase, "vol": [], "luz": [], "mano_hallada": None, "t": [0.0, 0.0, 0.0]}
    fijas_bb = {f: [(s["man"], _aabb(s["man"])) for s in piezas[f]] for f in spec["fijas"]}
    kd = not cfg["luz_completa"]
    if kd:          # conjunto grande: luz de mano por vertices y arbol k-d (min_gap a 101 mm tarda 3-8 s por par)
        from scipy.spatial import cKDTree
        arbol = {f: [cKDTree(np.asarray(s["tm"].vertices, float)) for s in piezas[f]] for f in spec["fijas"]}
        pts_mov = {m: [np.hstack([s["verts"], np.ones((len(s["verts"]), 1))]) for s in piezas[m]]
                   for m in spec["moviles"]}
    for k, (etq, mats) in enumerate(poses):
        movidos = {}
        for m in spec["moviles"]:
            M = np.asarray(mats[m], float)[:3, :4]
            movidos[m] = [(x, _aabb(x)) for x in (s["man"].transform(M) for s in piezas[m])]
        for (m, f), r in reg.items():
            otros = movidos[f] if f in movidos else fijas_bb[f]
            vol, luz, luz2 = 0.0, None, None
            for ia, (a, ba) in enumerate(movidos[m]):
                for ib, (b, bb) in enumerate(otros):
                    dc = _dist_cajas(ba, bb)
                    t1 = time.time()
                    if dc <= 0.0:
                        vol += (a ^ b).volume()
                    t2 = time.time()
                    r["t"][0] += t2 - t1
                    if r["clase"] == "permitido":
                        if dc <= 1.0:
                            g = a.min_gap(b, 1.0)
                            if g < 1.0 - 1e-9:
                                luz = g if luz is None else min(luz, g)
                        continue
                    if dc <= L1:
                        g = a.min_gap(b, L1)
                        if g < L1 - 1e-9:
                            luz = g if luz is None else min(luz, g)
                    t3 = time.time()
                    r["t"][1] += t3 - t2
                    if luz is None and dc <= L2:
                        if kd and f not in movidos:
                            P = pts_mov[m][ia] @ np.asarray(mats[m], float)[:3, :4].T
                            dd, _ = arbol[f][ib].query(P, k=1, distance_upper_bound=L2)
                            g = float(dd.min())
                        else:
                            g = a.min_gap(b, L2)
                        if g < L2 - 1e-9:
                            luz2 = g if luz2 is None else min(luz2, g)
                    r["t"][2] += time.time() - t3
            if vol > 0 and luz is None:
                luz = 0.0
            lz = luz if luz is not None else luz2
            r["vol"].append(round(vol, 4))
            r["luz"].append(None if lz is None else round(lz, 3))
            if lz is not None and lz < mano and r["mano_hallada"] is None:
                r["mano_hallada"] = k
        if emitir:
            emitir({"pose": k + 1, "de": len(poses)})
        if t_limite and time.time() > t_limite:
            raise NoMedido("TOPE")
    return reg


def evaluar(reg, poses, cfg):
    """Veredicto por par y del conjunto. La junta cuya luz cambia a lo largo del recorrido se juzga como comun."""
    etq = [p[0] for p in poses]
    umbral, cont, hasta = cfg["umbral_choque_mm3"], cfg["contacto_mm"], cfg["permitido_hasta_mm3"]
    dedo, mano = cfg["dedo_mm"], cfg["mano_mm"]
    var_junta = max(1.0, 4 * cfg["tol_cuerda_mm"])
    pares, choques, contactos, pellizcos, avisos, perm, junta = [], [], [], [], [], [], []
    for (m, f), r in reg.items():
        clase = r["clase"]
        nota = None
        if clase == "junta":
            vals = r["luz"]
            num = [v for v in vals if v is not None]
            if num and (len(num) != len(vals) or max(num) - min(num) > var_junta):
                clase = "comun"
                nota = ("declarada junta, pero su luz cambia a lo largo del recorrido (%s a %s mm): no es soporte del "
                        "eje y se juzga como parte comun" % (_mm(min(num)), "mas de %d" % (dedo + 1)
                                                            if len(num) != len(vals) else _mm(max(num))))
        vmax = max(r["vol"]) if r["vol"] else 0.0
        kv = r["vol"].index(vmax) if r["vol"] else None
        luces = [(v, k) for k, v in enumerate(r["luz"]) if v is not None]
        lmin, kl = min(luces) if luces else (None, None)
        if luces:       # empate dentro del error de malla: la primera pose (la meseta del cubo R15 da 55 en todas)
            kl = min(k for v, k in luces if v <= lmin + 2 * cfg["tol_cuerda_mm"])
        fila = {"par": [m, f], "clase": clase, "choque_max_mm3": round(vmax, 3),
                "pose_choque": etq[kv] if vmax > 0 and kv is not None else None,
                "luz_min_mm": None if lmin is None else round(lmin, 2), "pose_luz": etq[kl] if kl is not None else None,
                "poses_con_choque": [etq[k] for k, v in enumerate(r["vol"]) if v > (hasta if clase == "permitido"
                                                                                   else umbral)]}
        if nota:
            fila["nota"] = nota
        if clase == "permitido":
            fila["toca"] = bool(vmax > 0 or (lmin is not None and lmin < cont))
            perm.append(fila)
            if vmax > hasta:
                choques.append({"par": [m, f], "pose": fila["pose_choque"], "mm3": round(vmax, 3),
                                "nota": "par permitido, pero se mete mas de %s mm3" % _mm(hasta, 0)})
        else:
            if vmax > umbral:
                choques.append({"par": [m, f], "pose": fila["pose_choque"], "mm3": round(vmax, 3),
                                "poses": fila["poses_con_choque"]})
            elif lmin is not None and lmin < cont:
                contactos.append({"par": [m, f], "pose": fila["pose_luz"], "luz_mm": round(lmin, 3)})
            elif clase == "comun" and lmin is not None and lmin < dedo:
                pellizcos.append({"par": [m, f], "pose": fila["pose_luz"], "luz_mm": round(lmin, 2)})
            if clase == "comun" and lmin is not None and lmin < mano and vmax <= umbral:
                avisos.append({"par": [m, f], "pose": fila["pose_luz"], "luz_mm": round(lmin, 2)})
            if clase == "junta":
                junta.append(fila)
        pares.append(fila)
    con_luz = [p for p in pares if p["clase"] == "comun"]
    duro = bool(choques or contactos) or (cfg["luces_frenan"] and bool(pellizcos))
    rojo = bool(choques or contactos or pellizcos)
    peor = None
    if choques:
        c = max(choques, key=lambda x: x["mm3"])
        peor = {"pose": c["pose"], "par": c["par"], "que": "choque", "mm3": c["mm3"]}
    elif contactos:
        c = min(contactos, key=lambda x: x["luz_mm"])
        peor = {"pose": c["pose"], "par": c["par"], "que": "contacto", "luz_mm": c["luz_mm"]}
    else:
        medidas = [p for p in con_luz if p["luz_min_mm"] is not None]
        if medidas:
            c = min(medidas, key=lambda x: x["luz_min_mm"])
            peor = {"pose": c["pose_luz"], "par": c["par"], "que": "pellizco" if pellizcos else "luz minima",
                    "luz_mm": c["luz_min_mm"]}
    sin_luz = not con_luz
    return {"pares": pares, "choques": choques, "contactos": contactos, "pellizcos": pellizcos,
            "avisos_mano": avisos, "permitidos_informe": perm, "junta_informe": junta, "duro": duro, "rojo": rojo,
            "pose_peor": peor, "sin_parte_con_luz": sin_luz}


def exacto(spec, piezas, poses, ev, cfg):
    """Repite el par peor en su pose con OpenCASCADE (booleano con fuzzy 1e-3 y distancia exacta)."""
    pp = ev["pose_peor"]
    if not pp:
        return {"corrido": False, "motivo": "no hay par con luz o choque que repetir"}
    m, f = pp["par"]
    mb = sum(os.path.getsize(spec["archivos"][x]) for x in (m, f)) / 1e6
    if mb > cfg["exacto_hasta_mb"]:
        return {"corrido": False, "motivo": "STEP grandes (%.1f MB > %s MB): el exacto tarda minutos por pose"
                % (mb, _mm(cfg["exacto_hasta_mb"]))}
    from OCP.BRepAlgoAPI import BRepAlgoAPI_Common
    from OCP.BRepBuilderAPI import BRepBuilderAPI_Transform
    from OCP.BRepExtrema import BRepExtrema_DistShapeShape
    from OCP.BRepGProp import BRepGProp
    from OCP.GProp import GProp_GProps
    from OCP.gp import gp_Trsf
    k = [p[0] for p in poses].index(pp["pose"])

    def trsf(M):
        t = gp_Trsf()
        t.SetValues(*[float(M[i][j]) for i in range(3) for j in range(4)])
        return t
    t0 = time.time()
    mats = poses[k][1]
    A = [BRepBuilderAPI_Transform(s["occ"].wrapped, trsf(mats[m]), True).Shape() for s in piezas[m]]
    B = [BRepBuilderAPI_Transform(s["occ"].wrapped, trsf(mats[f]), True).Shape() if f in mats else s["occ"].wrapped
         for s in piezas[f]]
    vol, dist = 0.0, None
    for a in A:
        for b in B:
            op = BRepAlgoAPI_Common(a, b)
            op.SetFuzzyValue(1e-3)
            op.Build()
            if not op.IsDone():
                raise NoMedido("el booleano exacto de la pose critica no termino (%s contra %s)" % (m, f))
            g = GProp_GProps()
            BRepGProp.VolumeProperties_s(op.Shape(), g)
            vol += max(0.0, g.Mass())
            dd = BRepExtrema_DistShapeShape(a, b)
            if dd.IsDone():
                dist = dd.Value() if dist is None else min(dist, dd.Value())
    luz_malla = pp.get("luz_mm")
    malla_v = pp.get("mm3", 0.0)
    duro_malla = pp["que"] in ("choque", "contacto")
    duro_ex = vol > cfg["umbral_choque_mm3"] or (dist is not None and dist < cfg["contacto_mm"])
    coincide = duro_malla == duro_ex
    if coincide and not duro_ex and luz_malla is not None and dist is not None:
        coincide = abs(luz_malla - dist) <= 4 * cfg["tol_cuerda_mm"] + 0.05
    return {"corrido": True, "pose": pp["pose"], "par": [m, f], "choque_mm3": round(vol, 3),
            "luz_mm": None if dist is None else round(dist, 3), "malla_choque_mm3": malla_v,
            "malla_luz_mm": luz_malla, "coincide": coincide, "segundos": round(time.time() - t0, 2)}


def config(canon, a):
    return {"dedo_mm": float(a.dedo if a.dedo is not None else canon["dedo_mm"]),
            "mano_mm": float(a.mano if a.mano is not None else canon["mano_mm"]),
            "umbral_choque_mm3": float(canon["umbral_choque_mm3"]), "contacto_mm": float(canon["contacto_mm"]),
            "permitido_hasta_mm3": float(canon["permitido_hasta_mm3"]),
            "tol_cuerda_mm": float(canon["tol_cuerda_mm"]), "tol_angular_rad": float(canon["tol_angular_rad"]),
            "exacto_hasta_mb": float(canon["exacto_hasta_mb"]), "luces_frenan": bool(canon["luces_frenan"]),
            "guarda_fraccion_seccion": float(canon["guarda_fraccion_seccion"]), "luz_completa": True,
            "luz_completa_hasta_tri": int(canon["luz_completa_hasta_tri"])}


# ----------------------------------------------------------------------------------------------------------------
# autotest: par BIEN/MAL propio con primitivas de manifold (milisegundos)
# ----------------------------------------------------------------------------------------------------------------
def _caso_autotest(fijas, paso):
    """Barra 100 x 10 x 10 que gira de 0 a 90 grados alrededor de Y por el origen, contra 'fijas' (Manifolds)."""
    import manifold3d as m3
    import numpy as np
    barra = m3.Manifold.cube((100.0, 10.0, 10.0)).translate((0.0, -5.0, -5.0))
    v = np.asarray(barra.to_mesh().vert_properties, float)[:, :3]

    class _T:
        extents = (100.0, 10.0, 10.0)
    piezas = {"barra": [{"man": barra, "verts": v, "tm": _T()}]}
    for n, man in fijas.items():
        piezas[n] = [{"man": man}]
    spec = {"modo": "eje", "moviles": ["barra"], "fijas": list(fijas), "eje": {"origen": [0, 0, 0], "dir": [0, -1, 0]},
            "rango": [0.0, 90.0], "paso_pedido": paso, "permitidos": [], "junta": [], "entre_moviles": False}
    cfg = config(canon_barrido(), argparse.Namespace(dedo=None, mano=None))
    poses, guarda = plan_poses(spec, piezas, cfg["guarda_fraccion_seccion"])
    return evaluar(barrer(spec, piezas, poses, cfg), poses, cfg), guarda


def autotest():
    """Lista de problemas; vacia = el barrido separa BIEN de MAL en las dos direcciones."""
    import manifold3d as m3
    prob = []
    lejos = m3.Manifold.cube((20.0, 20.0, 20.0)).translate((150.0, -10.0, -60.0))
    tabique = m3.Manifold.cube((30.0, 20.0, 1.0)).translate((-15.0, -10.0, -0.5)).rotate((0.0, -45.0, 0.0)) \
        .translate((75.0 * math.cos(math.radians(45)), 0.0, 75.0 * math.sin(math.radians(45))))
    cerca = m3.Manifold.cube((20.0, 20.0, 20.0)).translate((-10.0, -10.0, 115.0))
    casos = (("BIEN barra libre (bloque lejos)", {"lejos": lejos}, 30.0, dict(rojo=False)),
             ("MAL tabique de 1 mm a 45 grados con --paso 30 (la guarda refina)", {"tabique": tabique}, 30.0,
              dict(rojo=True, choques=True)),
             ("MAL bloque a 15 mm de la punta a 90 grados (pellizco)", {"cerca": cerca}, 2.0,
              dict(rojo=True, choques=False, pellizcos=True)))
    for nombre, fijas, paso, esp in casos:
        try:
            ev, guarda = _caso_autotest(fijas, paso)
        except Exception as e:
            prob.append("%s: el barrido fallo (%s: %s)" % (nombre, type(e).__name__, e))
            continue
        obt = {"rojo": ev["rojo"], "choques": bool(ev["choques"]), "pellizcos": bool(ev["pellizcos"])}
        malos = {k: obt[k] for k in esp if obt[k] != esp[k]}
        if malos:
            prob.append("%s: esperado %s, dio %s" % (nombre, esp, malos))
    return prob


# ----------------------------------------------------------------------------------------------------------------
# subproceso trabajador
# ----------------------------------------------------------------------------------------------------------------
def _emitir(tipo, dato):
    sys.stdout.write(MARCA + json.dumps({"tipo": tipo, "dato": dato}, ensure_ascii=True) + "\n")
    sys.stdout.flush()


def trabajador():
    spec = json.loads(sys.stdin.read())
    cfg = spec["cfg"]
    try:
        _emitir("fase", "autotest")
        prob = autotest()
        if prob:
            _emitir("resultado", {"autotest": prob})
            return 0
        piezas, ntri = {}, 0
        for p, r in spec["archivos"].items():
            piezas[p] = mallas_de(p, r, cfg["tol_cuerda_mm"], cfg["tol_angular_rad"])
            ntri += sum(s["n_tri"] for s in piezas[p])
            _emitir("fase", "malla %s" % p)
        cfg["luz_completa"] = ntri <= cfg["luz_completa_hasta_tri"]
        poses, guarda = plan_poses(spec, piezas, cfg["guarda_fraccion_seccion"])
        _emitir("plan", {"poses": len(poses)})
        reg = barrer(spec, piezas, poses, cfg, emitir=lambda d: _emitir("pose", d))
        ev = evaluar(reg, poses, cfg)
        ex = exacto(spec, piezas, poses, ev, cfg)
        curva = []
        for k, (etq, _) in enumerate(poses):
            vs = [r["vol"][k] for r in reg.values() if r["clase"] != "permitido"]
            ls = [r["luz"][k] for r in reg.values() if r["clase"] == "comun" and r["luz"][k] is not None]
            curva.append({"pose": etq, "choque_mm3": max(vs) if vs else 0.0, "luz_mm": min(ls) if ls else None})
        costo = sorted(((sum(r["t"]), "%s-%s" % k, [round(x, 2) for x in r["t"]]) for k, r in reg.items()),
                       reverse=True)[:6]
        _emitir("resultado", {"costo_por_par": [[c[1], round(c[0], 2), c[2]] for c in costo], "evaluacion": ev, "guarda": guarda, "poses": len(poses), "exacto": ex, "curva": curva,
                              "luz_completa": cfg["luz_completa"], "triangulos": ntri})
    except NoMedido as e:
        _emitir("resultado", {"no_medido": str(e)})
    except Exception as e:  # noqa: BLE001
        _emitir("resultado", {"no_medido": "el barrido fallo: %s: %s" % (type(e).__name__, e)})
    return 0


def correr_trabajador(spec, tope_restante):
    """Lanza el subproceso y lo corta al tope. Devuelve (resultado o None, poses hechas, poses del plan)."""
    env = {**os.environ, "PYTHONIOENCODING": "utf-8"}
    p = subprocess.Popen([sys.executable, "-I", os.path.abspath(__file__), "--_trabajador"], stdin=subprocess.PIPE,
                         stdout=subprocess.PIPE, stderr=subprocess.STDOUT, env=env)
    estado = {"hechas": 0, "plan": spec["poses_planeadas"], "resultado": None, "fase": None}

    def leer():
        for linea in iter(p.stdout.readline, b""):
            t = linea.decode("utf-8", errors="replace").strip()
            if not t.startswith(MARCA):
                continue
            try:
                m = json.loads(t[len(MARCA):])
            except ValueError:
                continue
            if m["tipo"] == "pose":
                estado["hechas"] = m["dato"]["pose"]
            elif m["tipo"] == "plan":
                estado["plan"] = m["dato"]["poses"]
            elif m["tipo"] == "fase":
                estado["fase"] = m["dato"]
            elif m["tipo"] == "resultado":
                estado["resultado"] = m["dato"]
    hilo = threading.Thread(target=leer, daemon=True)
    hilo.start()
    try:
        p.stdin.write(json.dumps(spec).encode("utf-8"))
        p.stdin.close()
    except OSError:
        pass
    cortado = False
    try:
        p.wait(timeout=max(0.01, tope_restante))
    except subprocess.TimeoutExpired:
        cortado = True
        p.kill()
        p.wait()
    hilo.join(5)
    return estado["resultado"], estado["hechas"], estado["plan"], estado["fase"], cortado


# ----------------------------------------------------------------------------------------------------------------
# validacion de la salida (la usa export_deliverables.py: una evidencia sembrada no vale)
# ----------------------------------------------------------------------------------------------------------------
def salida_barrido_valida(j, firma):
    """(ok, motivo): la linea JSON del gate habla de ESTE conjunto y trae lo medido (poses, paso, guarda, pares)."""
    if not isinstance(j, dict) or j.get("gate") != "barrido":
        return False, "no hay salida del gate de barrido"
    if j.get("medido") is not True:
        return False, "NO MEDIDO: %s" % (j.get("motivo") or "medido no es true")
    if j.get("veredicto") not in ("verde", "rojo"):
        return False, "la salida no trae veredicto"
    n = j.get("poses")
    if not isinstance(n, int) or isinstance(n, bool) or n < 2:
        return False, "la salida no trae las poses barridas (minimo 2)"
    g = j.get("guarda") or {}
    r = g.get("corrimiento_ratio_max")
    if not isinstance(r, (int, float)) or isinstance(r, bool) or r < 0:
        return False, "la salida no trae la guarda del paso"
    if r > 1 + 1e-6:
        return False, ("el paso deja correr la pieza mas que la guarda (%s veces): un obstaculo fino puede quedar "
                       "entre dos poses" % r)
    if j.get("modo_mov") == "eje":
        pg, gg = g.get("paso_grados"), g.get("guarda_grados")
        if not isinstance(pg, (int, float)) or not isinstance(gg, (int, float)) or pg <= 0 or pg > gg + 1e-6:
            return False, "paso %s grados mayor que la guarda (%s grados) o ausente" % (pg, gg)
    pares = j.get("pares")
    if not isinstance(pares, list) or not pares:
        return False, "la salida no trae los pares medidos"
    if not firma or j.get("firma_conjunto") != firma:
        return False, ("la medicion no habla del conjunto que se entrega (firma %s, medido %s)"
                       % (firma, j.get("firma_conjunto")))
    return True, ""


# ----------------------------------------------------------------------------------------------------------------
# padre
# ----------------------------------------------------------------------------------------------------------------
def _texto_par(p):
    luz = "luz > alcance" if p["luz_min_mm"] is None else "luz min %s mm a %s" % (_mm(p["luz_min_mm"]), p["pose_luz"])
    ch = "choque max %s mm3 a %s" % (_mm(p["choque_max_mm3"], 3), p["pose_choque"]) if p["choque_max_mm3"] > 0 \
        else "sin choque"
    return "%s-%s (%s): %s; %s%s" % (p["par"][0], p["par"][1], p["clase"], ch, luz,
                                     (" [%s]" % p["nota"]) if p.get("nota") else "")


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("conjunto", nargs="?", help="json del conjunto (partes, archivos, movil/eje/rango o estados)")
    ap.add_argument("--paso", type=float, default=None, help="paso en grados del modo eje (canon: 2,5)")
    ap.add_argument("--dedo", type=float, default=None, help="luz minima de dedo [mm] (canon: 25)")
    ap.add_argument("--mano", type=float, default=None, help="luz minima de mano [mm] (canon: 100)")
    ap.add_argument("--tope-seg", type=float, default=None, help="tope del recorrido entero [s] (canon: 120)")
    ap.add_argument("--hoy", default=None, help="fecha simulada AAAA-MM-DD (solo con CAD_GATE_TEST=1)")
    ap.add_argument("--acepto-barrido", default=None, metavar="FRASE",
                    help="Fak asume el rojo: frase de 10 caracteres o mas; queda en el manifest con fecha, firma del "
                         "conjunto y pose peor (exige --workdir)")
    ap.add_argument("--workdir", default=None, help="workdir con manifest.json donde queda la evidencia")
    ap.add_argument("--json", default=None, help="volcar el resultado completo")
    ap.add_argument("--solo-autotest", action="store_true", help="probar el par BIEN/MAL propio y salir")
    ap.add_argument("--_trabajador", action="store_true", help=argparse.SUPPRESS)
    a = ap.parse_args(argv)
    if a._trabajador:
        return trabajador()
    t0 = time.time()
    try:
        can = canon_barrido()
    except (OSError, ValueError) as e:
        print("NO MEDIDO: no se pudo leer %s (%s)" % (CANON, e))
        return 2
    paso = a.paso if a.paso is not None else float(can["paso_grados"])
    tope = a.tope_seg if a.tope_seg is not None else float(can["tope_segundos"])
    cfg = config(can, a)
    res = {"gate": "barrido", "medido": False, "veredicto": "no_medido", "modo": None, "conjunto": a.conjunto,
           "firma_conjunto": None, "step_firmas": None, "modo_mov": None, "poses": None, "poses_planeadas": None,
           "guarda": None, "pares": None, "choques": None, "contactos": None, "pellizcos": None, "avisos_mano": None,
           "permitidos_informe": None, "junta_informe": None, "pose_peor": None, "exacto": None,
           "umbrales": {k: cfg[k] for k in ("dedo_mm", "mano_mm", "umbral_choque_mm3", "contacto_mm",
                                             "permitido_hasta_mm3", "tol_cuerda_mm")},
           "tope_seg": tope, "hoy": None, "aviso_hasta": can["aviso_hasta"], "no_cubierto": can["no_cubierto"],
           "motivo": None}

    def cerrar(codigo, texto):
        res["segundos"] = round(time.time() - t0, 1)
        print(texto)
        if a.workdir and a.conjunto:
            try:
                from cadlib import workdir as _wd
                _wd.ensure_workdir(a.workdir)
                ev = {k: v for k, v in res.items() if k not in ("gate", "modo", "curva", "no_cubierto")}
                _wd.record_evidence(a.workdir, "barrido", **ev)
            except Exception as e:  # pragma: no cover
                print("  (no se pudo escribir la evidencia en el manifest: %s)" % e)
        if a.json:
            with open(a.json, "w", encoding="utf-8") as f:
                json.dump(res, f, indent=1, ensure_ascii=False)
        print(json.dumps(res, ensure_ascii=True), flush=True)
        return codigo

    def no_medido(motivo):
        res["motivo"] = motivo
        return cerrar(2, "NO MEDIDO: %s. Un control que no midio nunca da verde." % motivo)

    try:
        hoy = hoy_barrido(a.hoy)
    except (NoMedido, ValueError) as e:
        return no_medido(str(e))
    res["hoy"] = hoy.isoformat()
    if a.solo_autotest:
        print("AUTOTEST del barrido (par BIEN/MAL propio con primitivas)")
        prob = autotest()
        for x in prob:
            print("  - " + x)
        print("  [AUTOTEST FALLA] no se juzga ningun conjunto" if prob else "  [AUTOTEST OK] el barrido separa BIEN "
              "de MAL (barra libre, tabique de 1 mm entre poses gruesas, pellizco)")
        return 3 if prob else 0
    if not a.conjunto:
        return no_medido("falta el json del conjunto (o --solo-autotest)")
    if a.acepto_barrido is not None and len(a.acepto_barrido.strip()) < int(can["frase_minima"]):
        res["motivo"] = "frase corta"
        return cerrar(1, "NO SE ACEPTA: --acepto-barrido necesita la frase de Fak (%d caracteres o mas); llego «%s» "
                      "(frase corta)" % (int(can["frase_minima"]), a.acepto_barrido))
    if a.acepto_barrido is not None and not a.workdir:
        res["motivo"] = "aceptacion sin manifest"
        return cerrar(1, "NO SE ACEPTA: la aceptacion queda escrita en el manifest; falta --workdir")
    try:
        spec = leer_conjunto(a.conjunto, paso)
        res["modo_mov"] = spec["modo"]
        res["poses_planeadas"] = spec["poses_planeadas"]
        res["firma_conjunto"], res["step_firmas"] = firma_conjunto(spec)
    except NoMedido as e:
        return no_medido(str(e))
    spec["cfg"] = cfg
    resultado, hechas, plan, fase, cortado = correr_trabajador(spec, tope - (time.time() - t0))
    seg = time.time() - t0
    if not cortado and resultado is None:
        return no_medido("el subproceso del barrido termino sin resultado (estaba en: %s)" % fase)
    if cortado:
        res["poses_hechas"] = hechas
        return no_medido("%d de %d poses en %.1f s: el recorrido entero no entro en el tope de %s s (P3: menos de 2 "
                         "minutos)%s" % (hechas, plan, seg, _mm(tope, 1),
                                         "; estaba en: %s" % fase if fase and not hechas else ""))
    if "autotest" in resultado:
        print("[AUTOTEST FALLA]")
        for x in resultado["autotest"]:
            print("  - " + x)
        print("No se juzga ningun conjunto con un barrido que no probo distinguir.")
        return 3
    if "no_medido" in resultado:
        return no_medido(resultado["no_medido"])
    ev, ex = resultado["evaluacion"], resultado["exacto"]
    res.update(poses=resultado["poses"], guarda=resultado["guarda"], pares=ev["pares"], choques=ev["choques"],
               contactos=ev["contactos"], pellizcos=ev["pellizcos"], avisos_mano=ev["avisos_mano"],
               permitidos_informe=ev["permitidos_informe"], junta_informe=ev["junta_informe"],
               pose_peor=ev["pose_peor"], exacto=ex, curva=resultado["curva"], luz_completa=resultado["luz_completa"],
               ignoradas=spec.get("ignoradas") or [], lazos=spec.get("lazos", 0),
               costo_por_par=resultado.get("costo_por_par"), triangulos=resultado.get("triangulos"))
    if ex.get("corrido") and not ex.get("coincide"):
        return no_medido("la malla y el exacto no coinciden en la pose critica %s (%s-%s: malla %s mm3 / luz %s, "
                         "exacto %s mm3 / luz %s)" % (ex["pose"], ex["par"][0], ex["par"][1], ex["malla_choque_mm3"],
                                                      ex["malla_luz_mm"], ex["choque_mm3"], ex["luz_mm"]))
    if ev["sin_parte_con_luz"] and not ev["duro"]:
        return no_medido("no queda ninguna parte con luz medida (todas las fijas son junta o permitidas): la luz de "
                         "dedo y de mano no se juzgo")
    if ev["sin_parte_con_luz"]:
        res["luz_sin_juzgar"] = "no queda ninguna parte comun: la luz de dedo y de mano no se juzgo (el choque si)"
    res["medido"] = True
    res["veredicto"] = "rojo" if ev["rojo"] else "verde"
    g = resultado["guarda"]
    print("BARRIDO %s (%s): %d poses%s" % (os.path.basename(a.conjunto), spec["modo"], resultado["poses"],
          (", paso %s grados (pedido %s; guarda %s grados = %s de la seccion %s mm a r %s mm)%s"
           % (_mm(g["paso_grados"], 2), _mm(g["paso_pedido"], 2), _mm(g["guarda_grados"], 2),
              _mm(g["fraccion_seccion"], 2), _mm(g["seccion_min_mm"] or 0), _mm(g["r_max_mm"] or 0),
              " REFINADO: el paso pedido dejaba saltar un obstaculo" if g["refinado"] else ""))
          if spec["modo"] == "eje" else ", corrimiento max %s mm entre estados (guarda %s mm)"
          % (_mm(g.get("corrimiento_max_mm") or 0, 2), _mm(g.get("guarda_mm") or 0, 2))))
    for p in ev["pares"]:
        print("  " + _texto_par(p))
    if ex.get("corrido"):
        print("  exacto en la pose critica %s (%s-%s): %s mm3, luz %s mm; coincide con la malla" % (
            ex["pose"], ex["par"][0], ex["par"][1], _mm(ex["choque_mm3"], 3),
            "-" if ex["luz_mm"] is None else _mm(ex["luz_mm"], 2)))
    else:
        print("  exacto en la pose critica: no corrido (%s)" % ex.get("motivo"))
    if not resultado["luz_completa"]:
        print("  [OJO] conjunto grande (%d triangulos): la luz hasta %s mm es de malla (min_gap) en todas las poses; "
              "entre %s y %s mm es la distancia entre vertices, una cota de arriba (la luz real es igual o menor)"
              % (resultado["triangulos"], _mm(cfg["dedo_mm"] + 1, 0), _mm(cfg["dedo_mm"] + 1, 0),
                 _mm(cfg["mano_mm"] + 1, 0)))
    motivos = []
    for c in ev["choques"]:
        motivos.append("CHOCA %s-%s: %s mm3 a %s%s" % (c["par"][0], c["par"][1], _mm(c["mm3"], 3), c["pose"],
                       (" (%d poses: %s a %s)" % (len(c["poses"]), c["poses"][0], c["poses"][-1]))
                       if c.get("poses") else ""))
    for c in ev["contactos"]:
        motivos.append("TOCA %s-%s a %s (luz %s mm, par no declarado en permitidos)"
                       % (c["par"][0], c["par"][1], c["pose"], _mm(c["luz_mm"], 3)))
    for c in ev["pellizcos"]:
        motivos.append("luz %s mm a %s < %s (dedo) entre %s y %s" % (_mm(c["luz_mm"]), c["pose"],
                                                                    _mm(cfg["dedo_mm"], 0), c["par"][0], c["par"][1]))
    resumen = "; ".join(motivos)
    for p in ev["permitidos_informe"]:
        if p["toca"]:
            print("  contacto declarado (permitidos) %s-%s: %s mm3 max%s" % (
                p["par"][0], p["par"][1], _mm(p["choque_max_mm3"], 3),
                (", luz min %s mm" % _mm(p["luz_min_mm"], 3)) if p["luz_min_mm"] is not None else ""))
    if ev["avisos_mano"]:
        print("  aviso: luz menor que una mano (%s mm) en %s" % (_mm(cfg["mano_mm"], 0), ", ".join(
            "%s-%s %s mm a %s" % (x["par"][0], x["par"][1], _mm(x["luz_mm"]), x["pose"]) for x in ev["avisos_mano"])))
    print("  no cubierto: cizalla y arrastre (ISO 13854 solo cubre aplastamiento)")
    aceptada = False
    if ev["rojo"] and a.acepto_barrido is not None:
        from cadlib import workdir as _wd
        frase = a.acepto_barrido.strip()
        man = _wd.load_manifest(a.workdir) if os.path.isfile(os.path.join(a.workdir, _wd.MANIFEST)) else {}
        otra = [e for e in man.get("evidence", []) if e.get("kind") == "barrido_aceptado"
                and (e.get("frase") or "").strip() == frase and e.get("firma_conjunto") != res["firma_conjunto"]]
        if otra:
            res["motivo"] = "frase usada para otra version"
            return cerrar(1, "NO SE ACEPTA: esa frase ya acepto otra version del conjunto (firma %s; hoy %s). Una "
                          "aceptacion vale para UNA firma: mirar el conjunto nuevo y escribir otra."
                          % (otra[-1].get("firma_conjunto"), res["firma_conjunto"]))
        _wd.ensure_workdir(a.workdir)
        _wd.record_evidence(a.workdir, "barrido_aceptado", conjunto=a.conjunto, firma_conjunto=res["firma_conjunto"],
                            frase=frase, fecha=hoy.isoformat(), pose_peor=ev["pose_peor"],
                            cantidad=len(ev["choques"]) + len(ev["contactos"]) + len(ev["pellizcos"]),
                            resumen=resumen)
        res["aceptacion"] = {"frase": frase, "fecha": hoy.isoformat(), "pose_peor": ev["pose_peor"]}
        aceptada = True
    elif not ev["rojo"] and a.acepto_barrido is not None:
        print("  (--acepto-barrido no hace falta: no hay rojo; no se escribe ninguna aceptacion)")
    modo = modo_barrido(True, ev["duro"], ev["rojo"], hoy, can["aviso_hasta"], aceptada)
    res["modo"] = modo
    if modo == "verde":
        pp = ev["pose_peor"]
        return cerrar(0, "[OK] recorre las %d poses sin choque ni contacto en pares no declarados%s"
                      % (resultado["poses"], "; luz minima %s mm a %s (%s-%s)" % (
                          _mm(pp["luz_mm"]), pp["pose"], pp["par"][0], pp["par"][1]) if pp else ""))
    if modo == "aceptado":
        return cerrar(0, "[ACEPTADO] %s. Queda en el manifest: frase, fecha, firma del conjunto y pose peor." % resumen)
    salidas = "; ".join(can["salidas"])
    if modo == "aviso":
        cuando = ("freno desde %s" % dia_siguiente(can["aviso_hasta"])) if ev["duro"] else \
            ("la luz de dedo queda como aviso hasta que Fak la revise (%s)" % can["luces_revisar"])
        return cerrar(0, "AVISO: %s; %s. Salidas: %s" % (resumen, cuando, salidas))
    return cerrar(1, "FRENO: %s. Salidas: %s" % (resumen, salidas))


if __name__ == "__main__":
    sys.exit(main())
