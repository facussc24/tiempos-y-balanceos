"""Voladizos ANTES de laminar: mide cada parte de un .3mf (o un .stl) con dos votos y dice si queda algo en el aire.

Por que existe (22/10/2026, Fak, dos veces en el dia: «nunca usas soportes... siempre lo mismo»): el porta-bulon de la
placa probeta se imprimio con voladizos sin soporte; el control chequeo_voladizos2.py existia y nadie lo corrio antes de
laminar. Desde el 23/10 lo corre laminar_bambu.py solo, antes de crear la carpeta y antes de bambu-studio.exe.

Los dos votos, por parte (cada objeto de la placa por separado, con la orientacion del 3MF aplicada ANTES de medir):
  - voladizos2: evals/banco3d/correctores/chequeo_voladizos2.py tal cual (largo de hilo en el aire, capa por capa).
    OJO = ROJO del gate (puede frenar).
  - dfam: scripts/dfam/dfam_tool.py, solo _overhang_facts a 45 grados (area que mira hacia abajo). Arriba del umbral
    del canon = aviso informativo: NUNCA frena solo (marca puentes cortos que se imprimen bien).
Veredicto por parte: verde / aviso / freno / no_medido. Lo que no se pudo medir (tiempo, falta un modulo, un archivo
que no se lee) queda NO MEDIDO y nunca verde. Numeros y fecha de corte en voladizosCanon.data.json.

Uso:
  <python del 3D> voladizos_3mf.py <pieza.3mf|.gcode.3mf|.stl> [--tope 120]
      imprime UNA linea JSON con la medida y sale con 0 (verde o solo aviso), 1 (rojo de voladizos2), 2 (no medido)
  laminar_bambu.py --solo-voladizos <pieza>      lo mismo desde el Python del sistema, sin laminar
Desde laminar_bambu.py / imprimir_pieza.py (Python del sistema, sin trimesh): medir(), decidir(), aviso_de_carpeta().
Arriba de todo solo hay biblioteca estandar: trimesh, numpy y dfam se importan adentro de la medicion, que corre en el
Python del 3D (.venv-cad) por subproceso.

Variables (para los tests): BAMBU_HOY=AAAA-MM-DD, BAMBU_PY_CAD (Python del 3D), BAMBU_VOLADIZOS2 (ruta del script),
BAMBU_DFAM (ruta de dfam_tool.py), BAMBU_VOLADIZOS_TOPE (segundos).
"""
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
import time
import zipfile
from datetime import date
from pathlib import Path

AQUI = Path(__file__).resolve().parent
CANON = AQUI / "voladizosCanon.data.json"
REPO = AQUI.parents[3]
PY_CAD = Path(r"C:\Dev\BarackMercosul\.venv-cad\Scripts\python.exe")
V2_EN_EL_REPO = REPO / "evals" / "banco3d" / "correctores" / "chequeo_voladizos2.py"
V2_EN_LA_MADRE = Path(r"C:\Dev\BarackMercosul\evals\banco3d\correctores\chequeo_voladizos2.py")
DFAM = AQUI / "dfam" / "dfam_tool.py"
NS = "{http://schemas.microsoft.com/3dmanufacturing/core/2015/02}"
P_PATH = "{http://schemas.microsoft.com/3dmanufacturing/production/2015/06}path"
LINEA_V2 = re.compile(r"puente mas largo\s+([\d.]+)\s*\|\s*voladizo mas largo\s+([\d.]+)")


# ---------------- lo comun (biblioteca estandar: corre en el Python del sistema) ----------------
def canon():
    return json.loads(CANON.read_text(encoding="utf-8"))


def hoy():
    """La fecha de hoy: BAMBU_HOY=AAAA-MM-DD si esta (los tests), si no el reloj de la PC."""
    h = os.environ.get("BAMBU_HOY", "").strip()
    return date.fromisoformat(h) if h else date.today()


def frase_valida(frase, can=None):
    can = can or canon()
    return frase is not None and len(frase.strip()) >= int(can.get("frase_minima", 10))


def matriz(txt):
    """transform de 3MF ("m00 m01 m02 m10 m11 m12 m20 m21 m22 m30 m31 m32", el punto es vector FILA y los 3 ultimos
    son la traslacion) -> matriz 4x4 para vector COLUMNA (lista de listas)."""
    if not txt or not txt.strip():
        return [[1.0, 0, 0, 0], [0, 1.0, 0, 0], [0, 0, 1.0, 0], [0, 0, 0, 1.0]]
    v = [float(x) for x in txt.split()]
    if len(v) != 12:
        raise ValueError(f"transform de 3MF con {len(v)} numeros (van 12): {txt[:80]}")
    return [[v[0], v[3], v[6], v[9]], [v[1], v[4], v[7], v[10]], [v[2], v[5], v[8], v[11]], [0, 0, 0, 1.0]]


def aplicar(m, p):
    """Un punto (x, y, z) por una matriz 4x4 de matriz()."""
    return tuple(m[i][0] * p[0] + m[i][1] * p[1] + m[i][2] * p[2] + m[i][3] for i in range(3))


def _num(x, d=1):
    return "?" if x is None else f"{x:.{d}f}".replace(".", ",")


def python_del_3d():
    """(ruta, None) o (None, motivo). Orden: BAMBU_PY_CAD; el Python que corre, si tiene trimesh; el .venv-cad."""
    env = os.environ.get("BAMBU_PY_CAD")
    if env:
        return (env, None) if Path(env).exists() else (None, f"falta el Python del 3D: {env} no existe")
    try:
        import importlib.util
        if importlib.util.find_spec("trimesh") and importlib.util.find_spec("shapely"):
            return sys.executable, None
    except (ImportError, ValueError):
        pass
    if PY_CAD.exists():
        return str(PY_CAD), None
    return None, f"falta el Python del 3D ({PY_CAD}): el Python que corre ({sys.executable}) no tiene trimesh"


def no_medido(archivo, motivo, segundos=0.0):
    return {"control": "voladizos_3mf", "archivo": str(archivo), "veredicto": "no_medido", "motivo": motivo,
            "partes": [], "medidas": 0, "de": None, "faltan": [], "segundos": round(segundos, 1)}


def _matar_arbol(p):
    try:
        if os.name == "nt":
            subprocess.run(["taskkill", "/T", "/F", "/PID", str(p.pid)], capture_output=True, timeout=30)
        else:
            p.kill()
    except (OSError, subprocess.SubprocessError):
        pass


def medir(entrada, tope=None):
    """Mide `entrada` en el Python del 3D por subproceso. Siempre devuelve un dict (nunca levanta): si algo falla, el
    veredicto es no_medido con el motivo. El tope de adentro es el del canon; aca se espera ese tope + 20 s y se corta
    el arbol entero de procesos (taskkill /T) si no termino."""
    t0 = time.time()
    try:
        tope = float(tope or os.environ.get("BAMBU_VOLADIZOS_TOPE") or canon().get("tope_segundos", 120))
    except (OSError, ValueError) as e:
        return no_medido(entrada, f"no se pudo leer el canon {CANON.name}: {e}")
    py, motivo = python_del_3d()
    if not py:
        return no_medido(entrada, motivo)
    tmp = Path(tempfile.mkdtemp(prefix="voladizos_"))
    out_f, err_f = tmp / "salida.json", tmp / "errores.txt"
    cmd = [py, "-I", str(Path(__file__).resolve()), str(entrada), "--tope", str(tope)]
    try:
        with open(out_f, "w", encoding="utf-8") as fo, open(err_f, "w", encoding="utf-8") as fe:
            p = subprocess.Popen(cmd, stdout=fo, stderr=fe)
            try:
                p.wait(timeout=tope + 20)
            except subprocess.TimeoutExpired:
                _matar_arbol(p)
                return no_medido(entrada, f"TIEMPO AGOTADO: el control no termino en {tope + 20:.0f} s y se corto",
                                 time.time() - t0)
    except OSError as e:
        return no_medido(entrada, f"no se pudo correr el control con {py}: {e}", time.time() - t0)
    lineas = [x for x in out_f.read_text(encoding="utf-8", errors="replace").splitlines() if x.strip().startswith("{")]
    try:
        return json.loads(lineas[-1])
    except (IndexError, ValueError):
        err = err_f.read_text(encoding="utf-8", errors="replace").strip().splitlines()
        return no_medido(entrada, f"el control salio con {p.returncode} sin respuesta: {(err[-1] if err else '')[:300]}",
                         time.time() - t0)


def codigo(med):
    """0 verde o solo aviso informativo, 1 rojo de voladizos2, 2 no medido (algo sin medir y ningun rojo)."""
    v = med.get("veredicto")
    return {"verde": 0, "aviso": 0, "freno": 1}.get(v, 2)


def _renglon_parte(p):
    v2, df = p.get("voladizos2") or {}, p.get("dfam") or {}
    if v2.get("voto") == "NO MEDIDO":
        t2 = f"voladizos2 NO MEDIDO ({v2.get('motivo')})"
    else:
        t2 = (f"voladizos2 {v2.get('voto')}: voladizo {_num(v2.get('voladizo_mm'))} mm, puente "
              f"{_num(v2.get('puente_mm'))} mm" + (f", primero en z {_num(v2.get('z_mm'))}" if v2.get("z_mm") is not None
                                                   else ""))
    if df.get("voto") == "NO MEDIDO":
        tdf = f"dfam NO MEDIDO ({df.get('motivo')})"
    else:
        tdf = f"dfam {_num(p.get('dfam_mm2'))} mm2 (umbral {_num(df.get('umbral_mm2'), 0)}, {df.get('voto')})"
    igual = f" [igual a {p['igual_a']}]" if p.get("igual_a") else ""
    return f"  {p.get('parte')} (objeto {p.get('objeto')}): {t2} | {tdf}{igual}"


def decidir(med, hoy_=None, can=None, acepto=None, ajustes=()):
    """Puro. -> {estado, sigue, modo, texto: [renglones], ...}.
    estado: OK | aviso informativo (solo dfam) | aviso (rojo o no medido, hasta aviso_hasta) | FRENO (desde el dia
    siguiente) | aceptado (--acepto-voladizos con frase) | OK con soportes (--ajuste enable_support=1)."""
    can = can or canon()
    hoy_ = hoy_ or hoy()
    hasta = date.fromisoformat(can["aviso_hasta"])
    modo = "aviso" if hoy_ <= hasta else "freno"
    v = med.get("veredicto")
    partes = med.get("partes") or []
    rojas = [p for p in partes if p.get("veredicto") in ("freno", "no_medido")]
    avisos = [p for p in partes if p.get("veredicto") == "aviso"]
    verdes = [p for p in partes if p.get("veredicto") == "verde"]
    soportes = any(re.fullmatch(r"\s*enable_support\s*=\s*(1|true)\s*", str(x), re.I) for x in (ajustes or ()))
    cab_modo = (f"modo AVISO hasta el {hasta:%d/%m/%Y} inclusive; desde el dia siguiente frena" if modo == "aviso"
                else f"modo FRENO desde el {date.fromordinal(hasta.toordinal() + 1):%d/%m/%Y}")
    if v in ("verde", "aviso"):
        estado = "OK" if v == "verde" else "aviso informativo"
        sigue = True
    elif soportes:
        estado, sigue = "OK con soportes", True
    elif frase_valida(acepto, can):
        estado, sigue = "aceptado", True
    elif modo == "aviso":
        estado, sigue = "aviso", True
    else:
        estado, sigue = "FRENO", False
    texto = []
    titulo = {"OK": "VOLADIZOS: OK", "aviso informativo": "VOLADIZOS: aviso informativo (solo dfam: no frena)",
              "OK con soportes": "VOLADIZOS: OK con nota: soportes activados (--ajuste enable_support=1)",
              "aceptado": "VOLADIZOS: ACEPTADO por Fak (--acepto-voladizos)",
              "aviso": "VOLADIZOS: AVISO: queda algo en el aire o sin medir (se lamina igual)",
              "FRENO": "VOLADIZOS: FRENO: queda algo en el aire o sin medir. NO SE LAMINO (no se creo la carpeta)"}[estado]
    texto.append(f"{titulo} [{cab_modo}; {med.get('medidas', 0)} de {med.get('de') or len(partes)} partes medidas"
                 f" en {_num(med.get('segundos'))} s; dos votos: voladizos2 frena, dfam solo avisa]")
    if med.get("motivo"):
        texto.append(f"  NO MEDIDO: {med['motivo']}")
    if med.get("faltan"):
        texto.append(f"  TIEMPO AGOTADO o sin medir: faltan {', '.join(med['faltan'])}")
    for p in rojas + avisos:
        texto.append(_renglon_parte(p))
    if verdes:
        texto.append(f"  verdes ({len(verdes)}): " + ", ".join(f"{p.get('parte')}" for p in verdes))
    if estado == "aceptado":
        texto.append(f"  frase de Fak: «{acepto.strip()}» ({hoy_:%d/%m/%Y}); queda en resumen.json, voladizos.json y el registro")
    if estado in ("aviso", "FRENO"):
        texto.append("  Salidas: " + " | ".join(f"{i + 1}) {s}" for i, s in enumerate(can.get("salidas", []))))
    return {"estado": estado, "sigue": sigue, "modo": modo, "hoy": hoy_.isoformat(), "aviso_hasta": can["aviso_hasta"],
            "version_canon": can.get("version"), "frase": acepto.strip() if estado == "aceptado" else None,
            "soportes": soportes, "texto": texto,
            "partes": [{k: p.get(k) for k in ("parte", "objeto", "veredicto", "dfam_mm2", "igual_a")}
                       | {"voladizos2": p.get("voladizos2")} for p in partes],
            "veredicto_medida": v, "motivo": med.get("motivo"), "faltan": med.get("faltan") or []}


def aviso_de_carpeta(carpeta):
    """Para imprimir_pieza.py: el texto del control que dejo laminar_bambu.py en <carpeta>/voladizos.json (o en
    resumen.json), si no fue un OK limpio. None si no hay nada que avisar o no hay archivo."""
    for nom in ("voladizos.json", "resumen.json"):
        f = Path(carpeta) / nom
        try:
            d = json.loads(f.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        d = d.get("voladizos", d) if nom == "resumen.json" else d
        if not isinstance(d, dict) or "estado" not in d:
            continue
        return None if d.get("estado") == "OK" else "\n".join(d.get("texto") or [f"VOLADIZOS: {d.get('estado')}"])
    return None


# ---------------- la medicion (corre en el Python del 3D) ----------------
def _leer_partes(ruta):
    """[(nombre, objeto_id, vertices, caras, notas)]: una por objeto de la placa (item del build), con las transforms
    del item y de los componentes aplicadas. Lee el 3MF con zipfile + ElementTree (sin lxml)."""
    import numpy as np
    import xml.etree.ElementTree as ET
    ruta = Path(ruta)
    if ruta.suffix.lower() == ".stl":
        import trimesh
        m = trimesh.load(str(ruta), force="mesh")
        return [(ruta.stem, "stl", np.asarray(m.vertices, float), np.asarray(m.faces, np.int64), [])]
    z = zipfile.ZipFile(ruta)
    nombres_zip = set(z.namelist())
    cache = {}

    def modelo(path):
        path = path.lstrip("/")
        if path not in cache:
            if path not in nombres_zip:
                raise ValueError(f"el 3MF no trae {path}")
            raiz = ET.fromstring(z.read(path))
            cache[path] = (raiz, {o.get("id"): o for o in raiz.iter(NS + "object")})
        return cache[path]

    # nombres y tipo de cada parte que guarda Bambu Studio (los .gcode.3mf y los .3mf guardados con Bambu)
    nombre_obj, tipo_parte = {}, {}
    if "Metadata/model_settings.config" in nombres_zip:
        cfg = ET.fromstring(z.read("Metadata/model_settings.config"))
        for o in cfg.iter("object"):
            n = next((m.get("value") for m in o.findall("metadata") if m.get("key") == "name"), None)
            if n:
                nombre_obj[o.get("id")] = n
            for pa in o.findall("part"):
                tipo_parte[(o.get("id"), pa.get("id"))] = pa.get("subtype") or "normal_part"

    def juntar(path, oid, T, raiz_id, vs, fs, notas, prof=0):
        if prof > 8:
            raise ValueError("componentes anidados mas de 8 niveles")
        _, objs = modelo(path)
        o = objs.get(oid)
        if o is None:
            raise ValueError(f"el objeto {oid} no esta en {path}")
        malla = o.find(NS + "mesh")
        if malla is not None:
            V = np.array([[float(v.get("x")), float(v.get("y")), float(v.get("z"))]
                          for v in malla.find(NS + "vertices")], dtype=float)
            F = np.array([[int(t.get("v1")), int(t.get("v2")), int(t.get("v3"))]
                          for t in malla.find(NS + "triangles")], dtype=np.int64)
            if len(V) and len(F):
                V = (np.c_[V, np.ones(len(V))] @ np.array(T).T)[:, :3]
                fs.append(F + sum(len(x) for x in vs))
                vs.append(V)
        comps = o.find(NS + "components")
        if comps is not None:
            for c in comps.findall(NS + "component"):
                cid = c.get("objectid")
                sub = c.get(P_PATH) or path
                tipo = tipo_parte.get((raiz_id, cid), "normal_part")
                if tipo != "normal_part":
                    notas.append(f"parte {cid} es {tipo}: no se mide (no es material impreso)")
                    continue
                juntar(sub, cid, (np.array(T) @ np.array(matriz(c.get("transform")))).tolist(), raiz_id, vs, fs,
                       notas, prof + 1)

    raiz, objs = modelo("3D/3dmodel.model")
    build = raiz.find(NS + "build")
    out = []
    for it in (build.findall(NS + "item") if build is not None else []):
        oid = it.get("objectid")
        o = objs.get(oid)
        nombre = nombre_obj.get(oid) or (o.get("name") if o is not None else None) or f"objeto {oid}"
        if it.get("printable") == "0":
            out.append((nombre, oid, None, None, ["printable=0: Bambu no lo imprime; no se mide"]))
            continue
        vs, fs, notas = [], [], []
        juntar(it.get(P_PATH) or "3D/3dmodel.model", oid, matriz(it.get("transform")), oid, vs, fs, notas)
        if not vs:
            out.append((nombre, oid, None, None, notas + ["sin malla"]))
            continue
        out.append((nombre, oid, np.vstack(vs), np.vstack(fs), notas))
    if not out:
        raise ValueError("el 3MF no tiene objetos en <build>")
    return out


def _voladizos2(stl, v2, plazo):
    """Corre chequeo_voladizos2.py tal cual sobre un STL con timeout. -> dict del voto."""
    t = time.time()
    if plazo <= 0.2:
        return {"voto": "NO MEDIDO", "motivo": "TIEMPO AGOTADO antes de empezar", "segundos": 0.0}
    try:
        r = subprocess.run([sys.executable, "-I", str(v2), str(stl)], capture_output=True, timeout=plazo)
    except subprocess.TimeoutExpired:
        return {"voto": "NO MEDIDO", "motivo": f"TIEMPO AGOTADO a los {plazo:.0f} s", "segundos": round(time.time() - t, 1)}
    salida = r.stdout.decode("utf-8", errors="replace").strip().splitlines()
    linea = salida[-1] if salida else ""
    m = LINEA_V2.search(linea)
    if r.returncode != 0 or not (linea.startswith("OJO") or linea.startswith("OK ")) or not m:
        err = r.stderr.decode("utf-8", errors="replace").strip().splitlines()
        return {"voto": "NO MEDIDO", "motivo": f"chequeo_voladizos2.py salio con {r.returncode}: "
                                              f"{(err[-1] if err else linea)[:200]}", "segundos": round(time.time() - t, 1)}
    donde = re.findall(r"'(z [^']*)'", linea)
    zs = re.match(r"z ([\d.]+):", donde[0]) if donde else None
    return {"voto": "OJO" if linea.startswith("OJO") else "OK", "puente_mm": float(m.group(1)),
            "voladizo_mm": float(m.group(2)), "z_mm": float(zs.group(1)) if zs else None, "donde": donde,
            "segundos": round(time.time() - t, 1)}


def _dfam(V, F, can):
    """Voto dfam: _overhang_facts de dfam_tool.py a 45 grados sobre la malla ya orientada."""
    ruta = Path(os.environ.get("BAMBU_DFAM") or DFAM)
    umbral, ang = float(can["dfam"]["umbral_mm2"]), float(can["dfam"]["angulo_deg"])
    if not ruta.exists():
        return {"voto": "NO MEDIDO", "motivo": f"falta {ruta.name} ({ruta})", "umbral_mm2": umbral}, None
    try:
        import importlib.util
        import trimesh
        spec = importlib.util.spec_from_file_location("dfam_tool", str(ruta))
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        f = mod._overhang_facts(trimesh.Trimesh(vertices=V, faces=F, process=True), ang)
        area = float(f["down_facing_area_below_limit_mm2"])
    except Exception as e:  # noqa: BLE001 - un voto que no midio se dice, no se traga
        return {"voto": "NO MEDIDO", "motivo": f"{type(e).__name__}: {str(e)[:200]}", "umbral_mm2": umbral}, None
    peor = (f.get("largest_faces_below_limit") or [{}])[0].get("location_xyz")
    return {"voto": "ROJO" if area > umbral else "OK", "umbral_mm2": umbral, "angulo_deg": ang,
            "peor_cara_xyz": peor}, round(area, 2)


def medir_aca(entrada, tope):
    """La medicion en este proceso (Python del 3D). -> dict JSON."""
    t0 = time.time()
    fin = t0 + tope
    try:
        can = canon()
    except (OSError, ValueError) as e:
        return no_medido(entrada, f"no se pudo leer el canon {CANON.name}: {e}")
    for mod in ("numpy", "trimesh", "shapely"):
        try:
            __import__(mod)
        except ImportError:
            return no_medido(entrada, f"falta {mod} en {sys.executable}", time.time() - t0)
    import numpy as np
    import trimesh
    v2 = Path(os.environ.get("BAMBU_VOLADIZOS2") or (V2_EN_EL_REPO if V2_EN_EL_REPO.exists() else V2_EN_LA_MADRE))
    try:
        crudas = _leer_partes(entrada)
    except Exception as e:  # noqa: BLE001
        return no_medido(entrada, f"no se pudo leer {Path(entrada).name}: {type(e).__name__}: {str(e)[:200]}",
                         time.time() - t0)
    tmp = Path(tempfile.mkdtemp(prefix="voladizos_partes_"))
    partes, trabajos, vistos = [], {}, {}
    for i, (nombre, oid, V, F, notas) in enumerate(crudas):
        p = {"parte": nombre, "objeto": oid, "notas": notas}
        partes.append(p)
        if V is None:
            p.update({"veredicto": "no_medido", "voladizos2": {"voto": "NO MEDIDO", "motivo": "; ".join(notas)},
                      "dfam": {"voto": "NO MEDIDO", "motivo": "; ".join(notas)}, "dfam_mm2": None})
            if any("printable=0" in n for n in notas):
                p["veredicto"] = "verde"
            continue
        p["caja_mm"] = [round(float(x), 2) for x in (V.max(0) - V.min(0))]
        # dos objetos con la misma malla (copias en distinto lugar de la placa) se miden una vez
        clave = hashlib.sha1(np.round(V - V.min(0), 3).tobytes() + F.tobytes()).hexdigest()
        if clave in vistos:
            p["igual_a"] = vistos[clave]["parte"]
            trabajos[clave]["copias"].append(p)
            continue
        vistos[clave] = p
        stl = tmp / f"parte_{i + 1}.stl"
        trimesh.Trimesh(vertices=V, faces=F, process=True).export(str(stl))
        trabajos[clave] = {"p": p, "stl": stl, "V": V, "F": F, "copias": []}
    if not v2.exists():
        for t in trabajos.values():
            t["p"]["voladizos2"] = {"voto": "NO MEDIDO", "motivo": f"falta chequeo_voladizos2.py ({v2})"}
    else:
        from concurrent.futures import ThreadPoolExecutor
        with ThreadPoolExecutor(max_workers=max(1, min(6, os.cpu_count() or 2))) as ex:
            fut = {k: ex.submit(lambda t: _voladizos2(t["stl"], v2, fin - time.time()), t) for k, t in trabajos.items()}
            for k, f in fut.items():
                trabajos[k]["p"]["voladizos2"] = f.result()
    for t in trabajos.values():
        t["p"]["dfam"], t["p"]["dfam_mm2"] = _dfam(t["V"], t["F"], can)
        for c in t["copias"]:
            c["voladizos2"], c["dfam"], c["dfam_mm2"] = t["p"]["voladizos2"], t["p"]["dfam"], t["p"]["dfam_mm2"]
    for p in partes:
        if "veredicto" in p:
            continue
        v2v, dfv = p["voladizos2"]["voto"], p["dfam"]["voto"]
        p["veredicto"] = ("no_medido" if v2v == "NO MEDIDO" else "freno" if v2v == "OJO"
                          else "aviso" if dfv in ("ROJO", "NO MEDIDO") else "verde")
    faltan = [p["parte"] for p in partes if p["veredicto"] == "no_medido"]
    vs = {p["veredicto"] for p in partes}
    veredicto = ("freno" if "freno" in vs else "no_medido" if "no_medido" in vs else "aviso" if "aviso" in vs
                 else "verde")
    return {"control": "voladizos_3mf", "archivo": str(entrada), "version_canon": can.get("version"),
            "veredicto": veredicto, "motivo": None, "partes": partes, "medidas": len(partes) - len(faltan),
            "de": len(partes), "faltan": faltan, "segundos": round(time.time() - t0, 1),
            "voladizos2_script": str(v2), "tope_segundos": tope}


if __name__ == "__main__":
    args = sys.argv[1:]
    tope_ = 120.0
    if "--tope" in args:
        i = args.index("--tope")
        tope_ = float(args[i + 1])
        del args[i:i + 2]
    if len(args) != 1:
        print(json.dumps(no_medido("", "uso: voladizos_3mf.py <pieza.3mf|.stl> [--tope 120]")))
        sys.exit(2)
    if not Path(args[0]).exists():
        res = no_medido(args[0], f"no existe {args[0]}")
    else:
        try:
            res = medir_aca(args[0], tope_)
        except Exception as e:  # noqa: BLE001 - nunca silencio: lo que rompe queda NO MEDIDO con su motivo
            res = no_medido(args[0], f"{type(e).__name__}: {str(e)[:300]}")
    print(json.dumps(res, ensure_ascii=True), flush=True)
    sys.exit(codigo(res))
