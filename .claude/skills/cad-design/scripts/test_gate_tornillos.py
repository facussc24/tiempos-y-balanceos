# -*- coding: utf-8 -*-
"""Casos E1 a E5 del gate de tornillos (gate 3e, 23/10/2026) — test de regresion, no de humo.

Correr:  .venv-cad\\Scripts\\python.exe -I test_gate_tornillos.py [--out <carpeta>]

Los casos los escribio un critico ANTES del gate (viernes-23-plan-sistema/banco3d-material/casos_gates_3c_3f.md,
tabla 3e). Cada control se prueba en las DOS direcciones: el caso que tiene que dar rojo da rojo y el legitimo pasa.
Las piezas son sinteticas de build123d (tornillo = cilindro con cabeza, placas con agujero, tuerca = bloque con
agujero; medidas de ensayo, no son disenos de Barack). Si estan las piezas reales del M5 y del M4 (tornillo, tuerca y
arandela de C:/Dev/_catia_practica/virolador_auto/tornillos, no versionadas) E1 y E2 se corren tambien con ellas; si
no estan, se dice y se saltean. La fecha se simula con --hoy, que solo vale con CAD_GATE_TEST=1.

No borra nada: cada corrida usa una carpeta nueva con marca de tiempo.
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:                                            # pragma: no cover
    pass
SCR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCR)
PY = sys.executable
REAL = os.environ.get("CAD_TORNILLOS_REALES", "C:/Dev/_catia_practica/virolador_auto/tornillos")
_ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
_ap.add_argument("--out", default=None, help="carpeta donde armar los conjuntos y los workdirs del test")
_ARGS = _ap.parse_args()
W = os.path.join(_ARGS.out or tempfile.gettempdir(), "test_gate_tornillos_%s" % time.strftime("%Y%m%d_%H%M%S"))
ENV_TEST = {**os.environ, "PYTHONIOENCODING": "utf-8", "CAD_GATE_TEST": "1"}
ENV_REAL = {k: v for k, v in os.environ.items() if k not in ("CAD_GATE_TEST", "CAD_HOY")}
ENV_REAL["PYTHONIOENCODING"] = "utf-8"
GATE = os.path.join(SCR, "gate_tornillos.py")
MOTIVO = "pieza de ensayo del test, sin esfuerzo"


def run(args, env=ENV_TEST, timeout=900):
    t0 = time.time()
    p = subprocess.run([PY, "-I"] + args, capture_output=True, text=True, encoding="utf-8", errors="replace",
                       env=env, timeout=timeout)
    out = (p.stdout or "") + (p.stderr or "")
    j = None
    for linea in reversed((p.stdout or "").splitlines()):
        if linea.startswith('{"gate": "tornillos"'):
            j = json.loads(linea)
            break
    return p.returncode, out, j, round(time.time() - t0, 1)


def gate(step, tj, *args, **kw):
    return run([GATE, "--step", step, "--tornillos", tj] + list(args), **kw)


def guardar(nombre, solidos, tornillos, otros=None):
    """Exporta el conjunto con etiquetas y escribe el json. Devuelve (step, json)."""
    from build123d import Compound, export_step
    d = os.path.join(W, nombre)
    os.makedirs(d, exist_ok=True)
    hijos = []
    for n, s in solidos:
        s = s.solids()[0] if hasattr(s, "solids") and len(s.solids()) == 1 else s
        s.label = n
        hijos.append(s)
    step = os.path.join(d, nombre + ".step")
    export_step(Compound(children=hijos), step)
    tj = os.path.join(d, nombre + ".tornillos.json")
    decl = {"tornillos": tornillos}
    if otros:
        decl["otros_solidos"] = otros
    with open(tj, "w", encoding="utf-8") as f:
        json.dump(decl, f, indent=1, ensure_ascii=False)
    return step, tj


def tornillo(largo, D=5.0, inserto="tuerca_impresa", carga=0, tid="T1", punto=(0, 0, 0), **extra):
    t = {"id": tid, "diametro_mm": D, "paso_mm": 1.0, "largo_bajo_cabeza_mm": largo,
         "eje": {"punto": list(punto), "direccion": [0, 0, 1]}, "carga_N": carga, "inserto": inserto}
    if carga == 0:
        t["motivo_sin_carga"] = MOTIVO
    t.update(extra)
    return t


def main():
    from cadlib import workdir
    import gate_tornillos as gt
    from build123d import Align, Box, Cylinder, Location, import_step
    os.makedirs(W, exist_ok=True)
    fallos, filas = [], []
    A = (Align.CENTER, Align.CENTER, Align.MIN)
    sint = gt.conjunto_sintetico

    def check(caso, nombre, cond, detalle, evidencia=""):
        print(("  [OK]    " if cond else "  [FALLA] ") + "%s %s" % (caso, nombre))
        filas.append((caso, nombre, "OK" if cond else "FALLA", evidencia))
        if not cond:
            fallos.append("%s %s" % (caso, nombre))
            print("          " + str(detalle).strip()[-900:].replace("\n", "\n          "))

    def t1(j):
        return (j or {}).get("tornillos", [{}])[0] if j and j.get("tornillos") else {}

    hay_real = all(os.path.isfile(os.path.join(REAL, f)) for f in (
        "tornillo_macho_M5_tornillo.step", "tornillo_macho_M5_tuerca.step", "arandela_M5.step",
        "tornillo_macho_M4_tornillo.step", "tornillo_macho_M4_tuerca.step", "arandela_M4.step"))

    def real(nombre, z):
        return import_step(os.path.join(REAL, nombre)).solids()[0].moved(Location((0, 0, z)))

    def placa(esp, z, r):
        return (Box(40, 40, esp, align=A) - Cylinder(r, esp, align=A)).moved(Location((0, 0, z)))

    capas25 = [("placa", 19.0, "placa"), ("arandela", 1.0, "placa"), ("tuerca", 5.0, "tuerca")]

    print("E1 verde: M5 de 27 bajo la cabeza contra placa 19 + arandela 1 + tuerca 5 = 25")
    s1, j1 = guardar("e1_sintetico", sint(capas25, 27.0), [tornillo(27.0, pila=["placa", "arandela", "tuerca"])])
    rc, out, j, seg = gate(s1, j1, "--hoy", "2026-11-02")
    r = t1(j)
    check("E1", "sintetico: verde aun en fecha de freno, pila 25, sobresale 2", rc == 0 and j and j["veredicto"] ==
          "verde" and abs(r.get("pila_mm", 0) - 25) < 0.01 and abs(r.get("margen_mm", 0) - 2) < 0.01, out,
          "exit %s, pila %s, margen %s, %s s" % (rc, r.get("pila_mm"), r.get("margen_mm"), seg))
    if hay_real:
        sol = [("T1", real("tornillo_macho_M5_tornillo.step", 0)), ("placa", placa(19, 3, 2.75)),
               ("arandela", real("arandela_M5.step", 22.5)), ("tuerca", real("tornillo_macho_M5_tuerca.step", 23))]
        s1r, j1r = guardar("e1_real_M5", sol, [tornillo(27.0, punto=(0, 0, 3))])
        rc, out, j, seg = gate(s1r, j1r, "--hoy", "2026-11-02")
        r = t1(j)
        check("E1", "M5 real de make_screw_nut (cabeza 3, tuerca 5): verde, pila 25, sobresale 2", rc == 0 and j and
              j["veredicto"] == "verde" and abs(r.get("pila_mm", 0) - 25) < 0.05
              and abs(r.get("margen_mm", 0) - 2) < 0.05, out,
              "exit %s, largo %s, pila %s, margen %s, %s s" % (rc, r.get("largo_medido_mm"), r.get("pila_mm"),
                                                              r.get("margen_mm"), seg))
    else:
        print("  (no estan las piezas reales en %s: E1 real salteado)" % REAL)
        filas.append(("E1", "M5 real", "SALTEADO", "no estan las piezas reales"))

    print("\nE2 falla real: M4 de 22 bajo la cabeza contra brida 4 + placa 15 + arandela 1 + tuerca 4 = 24")
    capas24 = [("brida", 4.0, "placa"), ("placa", 15.0, "placa"), ("arandela", 1.0, "placa"), ("tuerca", 4.0, "tuerca")]
    s2, j2 = guardar("e2_sintetico", sint(capas24, 22.0, D=4.0, cabeza=(8.0, 3.0)), [tornillo(22.0, D=4.0)])
    rc, out, j, _ = gate(s2, j2, "--hoy", "2026-11-02")
    check("E2", "sintetico: rojo «faltan 2 mm» (FRENO, exit 1)", rc == 1 and j and j["veredicto"] == "rojo"
          and "faltan 2 mm" in out and abs(t1(j).get("margen_mm", 0) + 2) < 0.01, out, "exit %s" % rc)
    capas23 = [c for c in capas24 if c[0] != "arandela"]
    s2b, j2b = guardar("e2_sin_arandela", sint(capas23, 22.0, D=4.0, cabeza=(8.0, 3.0)), [tornillo(22.0, D=4.0)])
    rc, out, j, _ = gate(s2b, j2b, "--hoy", "2026-11-02")
    check("E2", "sin arandela: pila 23, falta 1", rc == 1 and "faltan 1 mm" in out, out, "exit %s" % rc)
    for largo, esp, rc_esp in ((24.0, "verde", 0), (23.9, "rojo", 1)):
        s, jj = guardar("e2_frontera_%s" % str(largo).replace(".", "_"), sint(capas24, largo, D=4.0, cabeza=(8.0, 3.0)),
                        [tornillo(largo, D=4.0)])
        rc, out, j, _ = gate(s, jj, "--hoy", "2026-11-02")
        check("E2", "frontera: largo %s contra pila 24 -> %s" % (largo, esp), rc == rc_esp and j and
              j["veredicto"] == esp, out, "exit %s, margen %s" % (rc, t1(j).get("margen_mm")))
    if hay_real:
        sol = [("T1", real("tornillo_macho_M4_tornillo.step", 0)), ("brida", placa(4, 3, 2.25)),
               ("placa", placa(15, 7, 2.25)), ("arandela", real("arandela_M4.step", 22.5)),
               ("tuerca", real("tornillo_macho_M4_tuerca.step", 23))]
        s2r, j2r = guardar("e2_real_M4", sol, [tornillo(22.0, D=4.0, punto=(0, 0, 3))])
        rc, out, j, seg = gate(s2r, j2r, "--hoy", "2026-11-02")
        check("E2", "M4 real (hallazgo 4): rojo «faltan 2 mm», pila 24", rc == 1 and j and j["veredicto"] == "rojo"
              and abs(t1(j).get("pila_mm", 0) - 24) < 0.05 and "faltan 2 mm" in out, out,
              "exit %s, pila %s, %s s" % (rc, t1(j).get("pila_mm"), seg))
    else:
        filas.append(("E2", "M4 real", "SALTEADO", "no estan las piezas reales"))

    print("\nE3 entra pero cargado: bloque 30x30x15 con agujero y rosca en la pieza")
    bloque = [("bloque", 15.0, "placa")]
    s3, j3 = guardar("e3_cargado", sint(bloque, 12.0, D=4.0, cabeza=(8.0, 3.0)),
                     [tornillo(12.0, D=4.0, inserto="ninguno", carga=50)])
    rc, out, j, _ = gate(s3, j3, "--hoy", "2026-11-02")
    check("E3", "carga 50 N sin inserto: rojo «rosca cargada en plastico sin inserto» (R5)", rc == 1 and
          "rosca cargada en plastico sin inserto" in out, out, "exit %s" % rc)
    ins = {"tipo": "inserto", "largo_mm": 8.0, "fuente": "valor de ensayo del test, no de catalogo"}
    s3b, j3b = guardar("e3_inserto", sint(bloque, 12.0, D=4.0, cabeza=(8.0, 3.0)),
                       [tornillo(12.0, D=4.0, inserto=ins, carga=50)])
    rc, out, j, _ = gate(s3b, j3b, "--hoy", "2026-11-02")
    check("E3", "la misma carga con inserto de 8: verde", rc == 0 and j and j["veredicto"] == "verde", out,
          "exit %s" % rc)
    ins14 = dict(ins, largo_mm=14.0)
    s3c, j3c = guardar("e3_inserto_largo", sint(bloque, 12.0, D=4.0, cabeza=(8.0, 3.0)),
                       [tornillo(12.0, D=4.0, inserto=ins14, carga=50)])
    rc, out, j, _ = gate(s3c, j3c, "--hoy", "2026-11-02")
    check("E3", "inserto de 14 con 12 de tornillo: rojo «no toma el inserto entero»", rc == 1 and
          "no toma el inserto entero" in out, out, "exit %s" % rc)
    s3d, j3d = guardar("e3_m5_6mm", sint(bloque, 6.0), [tornillo(6.0, inserto="ninguno")])
    rc, out, j, _ = gate(s3d, j3d, "--hoy", "2026-11-02")
    check("E3", "M5 sin carga con 6 mm de rosca: aviso con 1,5 D = 7,5 y 2,5 D = 12,5 (no frena)", rc == 0 and j
          and t1(j).get("veredicto") == "aviso" and "7,5" in out and "12,5" in out, out,
          "exit %s, %s" % (rc, t1(j).get("avisos")))
    s3e, j3e = guardar("e3_patas_M12_15", sint([("placa", 15.0, "placa")], 15.0, D=12.0, cabeza=(18.0, 6.0)),
                       [tornillo(15.0, D=12.0, inserto="ninguno")])
    rc, out, j, _ = gate(s3e, j3e, "--hoy", "2026-11-02")
    check("E3", "patas M12 en placa de 15 sin carga: rojo «no entra» (15 < 18, R3)", rc == 1 and "no entra" in out
          and "18" in out, out, "exit %s" % rc)
    s3f, j3f = guardar("e3_patas_M12_18", sint([("placa", 18.0, "placa")], 18.0, D=12.0, cabeza=(18.0, 6.0)),
                       [tornillo(18.0, D=12.0, inserto="ninguno")])
    rc, out, j, _ = gate(s3f, j3f, "--hoy", "2026-11-02")
    check("E3", "contraprueba: M12 en placa de 18 sin carga no es rojo (aviso: 18 < 2,5 D = 30)", rc == 0 and j
          and t1(j).get("veredicto") == "aviso", out, "exit %s" % rc)
    s3g, j3g = guardar("e3_fondo", sint([("bloque", 15.0, "macizo")], 10.0, hueco=10.0), [tornillo(10.0, inserto="ninguno")])
    rc, out, j, _ = gate(s3g, j3g, "--hoy", "2026-11-02")
    check("E3", "agujero ciego de 10 con tornillo de 10: rojo «toca el fondo»", rc == 1 and "toca el fondo" in out,
          out, "exit %s" % rc)
    s3h, j3h = guardar("e3_fondo_ok", sint([("bloque", 15.0, "macizo")], 9.5, hueco=10.0), [tornillo(9.5, inserto="ninguno")])
    rc, out, j, _ = gate(s3h, j3h, "--hoy", "2026-11-02")
    check("E3", "contraprueba: 9,5 en el ciego de 10 no toca (aviso de R3, no rojo)", rc == 0 and j and
          t1(j).get("veredicto") == "aviso", out, "exit %s" % rc)
    s3i, j3i = guardar("e3_atraviesa", sint(bloque, 17.0), [tornillo(17.0, inserto="ninguno")])
    rc, out, j, _ = gate(s3i, j3i, "--hoy", "2026-11-02")
    check("E3", "tornillo de 17 en bloque de 15 (rosca en la pieza): rojo «atraviesa»", rc == 1 and "atraviesa" in out,
          out, "exit %s" % rc)
    s3j, j3j = guardar("e3_tuerca_baja", sint([("placa", 10.0, "placa"), ("tuerca", 4.0, "tuerca")], 16.0),
                       [tornillo(16.0)])
    rc, out, j, _ = gate(s3j, j3j, "--hoy", "2026-11-02")
    check("E3", "tuerca impresa de 4 en M5: rojo (R2 pide altura >= D)", rc == 1 and "R2" in out, out, "exit %s" % rc)
    s3k, j3k = guardar("e3_tuerca_acero_baja", sint([("placa", 10.0, "placa"), ("tuerca", 4.0, "tuerca")], 16.0),
                       [tornillo(16.0, inserto="tuerca_acero", carga=200)])
    rc, out, j, _ = gate(s3k, j3k, "--hoy", "2026-11-02")
    check("E3", "contraprueba: tuerca de acero de 4 (0,8 D) con carga: verde (R2 es para la impresa)", rc == 0 and j
          and j["veredicto"] == "verde", out, "exit %s" % rc)

    print("\nE4 NO MEDIDO nunca verde")
    sol_extra = sint(capas25, 27.0) + [("tornillo_2", (Cylinder(2, 15, align=A) + Cylinder(4, 2, align=A).moved(
        Location((0, 0, -2)))).moved(Location((60, 0, 0))))]
    s4, j4 = guardar("e4_no_declarado", sol_extra, [tornillo(27.0)])
    rc, out, j, _ = gate(s4, j4)
    check("E4", "tornillo en el STEP que no esta en el json: exit 2 «¿es un tornillo sin declarar?»", rc == 2 and j
          and j["medido"] is False and "tornillo_2" in out and "sin declarar" in out, out, "exit %s" % rc)
    s4b, j4b = guardar("e4_otros", sol_extra, [tornillo(27.0)], otros=["tornillo_2"])
    rc, out, j, _ = gate(s4b, j4b)
    check("E4", "contraprueba: el mismo solido listado en otros_solidos -> mide (verde)", rc == 0 and j and
          j["medido"] is True, out, "exit %s" % rc)
    casos = (("sin largo", {"largo_bajo_cabeza_mm": None}, "largo_bajo_cabeza_mm"),
             ("sin diametro", {"diametro_mm": None}, "diametro_mm"),
             ("sin eje", {"eje": None}, "eje"),
             ("sin inserto", {"inserto": None}, "donde rosca"),
             ("carga 0 sin motivo", {"motivo_sin_carga": ""}, "motivo_sin_carga"),
             ("largo del json distinto del STEP", {"largo_bajo_cabeza_mm": 26.0}, "el json no habla"),
             ("eje corrido: no esta en el conjunto", {"eje": {"punto": [100, 0, 0], "direccion": [0, 0, 1]}},
              "no esta en el conjunto"),
             ("pila declarada distinta", {"pila": ["placa", "tuerca"]}, "no es la del STEP"))
    for nombre, cambio, texto in casos:
        t = tornillo(27.0)
        t.update(cambio)
        t = {k: v for k, v in t.items() if v is not None}
        tj = os.path.join(W, "e4_%s.json" % nombre.replace(" ", "_").replace(":", ""))
        with open(tj, "w", encoding="utf-8") as f:
            json.dump({"tornillos": [t]}, f)
        rc, out, j, _ = gate(s1, tj)
        check("E4", "%s: exit 2, medido false" % nombre, rc == 2 and j and j["medido"] is False and texto in out,
              out, "exit %s" % rc)
    t = tornillo(27.0)
    del t["carga_N"]
    tj = os.path.join(W, "e4_sin_carga.json")
    with open(tj, "w", encoding="utf-8") as f:
        json.dump({"tornillos": [t]}, f)
    rc, out, j, _ = gate(s1, tj)
    check("E4", "carga_N ausente: exit 2", rc == 2 and "carga_N" in out, out, "exit %s" % rc)
    s4c, j4c = guardar("e4_no_apiladas", sint(capas25, 27.0, luz=0.5), [tornillo(27.0)])
    rc, out, j, _ = gate(s4c, j4c)
    check("E4", "piezas separadas 0,5 mm: exit 2 «no apiladas»", rc == 2 and "no apilad" in out, out, "exit %s" % rc)
    trunc = os.path.join(W, "e4_truncado.step")
    data = open(s1, "rb").read()
    open(trunc, "wb").write(data[: len(data) // 2])
    rc, out, j, _ = gate(trunc, j1)
    check("E4", "STEP truncado: exit 2", rc == 2 and "truncado" in out, out, "exit %s" % rc)
    ileg = os.path.join(W, "e4_ilegible.step")
    open(ileg, "wb").write(b"ISO-10303-21;\nbasura\nEND-ISO-10303-21;\n")
    rc, out, j, _ = gate(ileg, j1)
    check("E4", "STEP ilegible: exit 2", rc == 2 and j and j["medido"] is False, out, "exit %s" % rc)
    rc, out, j, _ = gate(s1, j1, "--hoy", "2026-11-02", env=ENV_REAL)
    check("E4", "--hoy sin CAD_GATE_TEST=1: exit 2 (no juzga con fecha falsa)", rc == 2 and "CAD_GATE_TEST" in out,
          out, "exit %s" % rc)
    codigo = ("import sys; sys.path.insert(0, %r); import gate_tornillos as gt; "
              "gt.juzgar_tornillo = (lambda f: (lambda m, t, c: dict(f(m, t, c), veredicto='verde', rojos=[])))"
              "(gt.juzgar_tornillo); sys.exit(gt.main(['--step', %r, '--tornillos', %r]))" % (SCR, s2, j2))
    rc, out, j, _ = run(["-c", codigo])
    check("E4", "detector forzado a verde: autotest exit 3 y no juzga", rc == 3 and "AUTOTEST FALLA" in out
          and j is None, out, "exit %s" % rc)

    print("\nE5 salida y cableado")
    for hoy, rc_esp, texto in (("2026-10-25", 0, "AVISO"), ("2026-10-30", 0, "AVISO"), ("2026-10-31", 1, "FRENO"),
                               ("2026-11-02", 1, "FRENO")):
        rc, out, j, _ = gate(s2, j2, "--hoy", hoy)
        check("E5", "E2 con --hoy %s -> exit %d «%s»" % (hoy, rc_esp, texto), rc == rc_esp and texto in out and
              j and j["veredicto"] == "rojo", out, "exit %s, modo %s" % (rc, j and j.get("modo")))
    w5 = os.path.join(W, "w5")
    os.makedirs(os.path.join(w5, "out"), exist_ok=True)
    p5 = os.path.join(w5, "out", "conj_e2.step")
    shutil.copy2(s2, p5)
    for corta in ("ok", ""):
        rc, out, j, _ = gate(p5, j2, "--hoy", "2026-11-02", "--workdir", w5, "--acepto-tornillos", corta)
        check("E5", "frase «%s» -> exit 1 «frase corta»" % corta, rc == 1 and "frase corta" in out, out, "exit %s" % rc)
    frase = "Fak mide la pila en planta y alarga el tornillo"
    rc, out, j, _ = gate(p5, j2, "--hoy", "2026-11-02", "--workdir", w5, "--acepto-tornillos", frase)
    ac = workdir.find_evidence(w5, "tornillos_aceptados", fixture="conj_e2.step")
    f5 = workdir.file_signature(p5)
    check("E5", "con la frase -> exit 0 ACEPTADO; manifest con frase, fecha, firma del conjunto y los id",
          rc == 0 and "[ACEPTADO]" in out and ac and ac.get("frase") == frase and ac.get("fecha") == "2026-11-02"
          and ac.get("step_firma") == f5 and ac.get("ids") == ["T1"], out,
          "aceptacion %s" % (ac and {k: ac.get(k) for k in ("fecha", "step_firma", "ids")}))
    shutil.copy2(s2b, p5)
    rc, out, j, _ = gate(p5, j2b, "--hoy", "2026-11-02", "--workdir", w5, "--acepto-tornillos", frase)
    check("E5", "la misma frase sobre otro conjunto (otra firma) se niega (exit 1)", rc == 1 and
          "ya acepto otra version" in out, out, "exit %s" % rc)

    def wd_export(nombre, step, params=None):
        w = os.path.join(W, nombre)
        for d in ("in", "out", "renders", "cache"):
            os.makedirs(os.path.join(w, d), exist_ok=True)
        piece = os.path.join(w, "out", "conj.step")
        shutil.copy2(step, piece)
        workdir.ensure_workdir(w)
        workdir.record_evidence(w, "collision_check", fixture="conj.step", n_inside=0, contacto_ok=True,
                                fixture_firma=workdir.file_signature(piece))
        png = os.path.join(w, "renders", "cualquiera.png")
        open(png, "wb").write(b"\x89PNG\r\n\x1a\n")
        os.utime(png, None)
        if params:
            m = workdir.load_manifest(w)
            m.setdefault("params", {}).update(params)
            workdir.save_manifest(w, m)
        return w, piece

    def export(w, piece, destino, n, *extra):
        base = ["--workdir", w, "--pieces", piece, "--deliver", destino, "--skip-gate", "zona", "--skip-gate",
                "proceso", "--skip-gate", "ensamble", "--skip-gate", "cantos", "--reason", "test sintetico",
                "--ensamble", "conj:%d" % n]
        return run([os.path.join(SCR, "export_deliverables.py")] + base + list(extra))

    def vacia(d):
        return not os.path.isdir(d) or not os.listdir(d)

    # En la entrega el conjunto va con 0,02 mm de luz entre piezas (dentro de la tolerancia de apilado, 0,05): con las
    # caras apoyadas una contra otra el STL del conjunto sale abierto y con 18 cuerpos (medido el 24/10), y la entrega
    # frena antes en [GATE validez], que no es lo que se prueba aca. La pila medida queda 24,08 y el margen -2,08.
    s5, j5 = guardar("e5_export", sint(capas24, 22.0, D=4.0, cabeza=(8.0, 3.0), luz=0.02), [tornillo(22.0, D=4.0)])
    j2 = j5
    we, pe = wd_export("w_export", s5)
    d = os.path.join(we, "entrega_freno")
    rc, out, _, _ = export(we, pe, d, 5, "--tornillos", j2, "--hoy", "2026-11-02")
    check("E5", "export con E2 y --hoy 2026-11-02 -> SystemExit «[GATE tornillos]» y D vacia",
          rc != 0 and "[GATE tornillos]" in out and vacia(d), out, "exit %s, D vacia %s" % (rc, vacia(d)))
    d = os.path.join(we, "entrega_aviso")
    rc, out, _, _ = export(we, pe, d, 5, "--tornillos", j2, "--hoy", "2026-10-25")
    dl = workdir.find_evidence(we, "delivery", dest=d)
    tp = ((dl or {}).get("tornillos_por_pieza") or {}).get("conj.step") or {}
    tt = (tp.get("tornillos") or [{}])[0]
    check("E5", "--hoy 2026-10-25 -> AVISO y entrega", rc == 0 and "AVISO [GATE tornillos]" in out and
          "ENTREGA OK" in out and not vacia(d), out, "exit %s" % rc)
    check("E5", "el manifest de la entrega tiene pila, largo y margen por tornillo (modo aviso)",
          tp.get("modo") == "aviso" and abs((tt.get("pila_mm") or 0) - 24.08) < 0.01
          and abs((tt.get("largo_medido_mm") or 0) - 22.0) < 0.01 and abs((tt.get("margen_mm") or 0) + 2.08) < 0.01
          and tt.get("pila") and tp.get("step_firma") == workdir.file_signature(pe), out,
          "tornillos_por_pieza %s" % tt)
    workdir.record_evidence(we, "tornillos", fixture="conj.step", step=pe, step_firma=workdir.file_signature(pe),
                            medido=True, veredicto="verde", tornillos=[])
    d = os.path.join(we, "entrega_sembrada")
    rc, out, _, _ = export(we, pe, d, 5, "--tornillos", j2, "--hoy", "2026-11-02")
    check("E5", "evidencia sembrada (verde, firma correcta) no vale: frena igual", rc != 0 and "[GATE tornillos]" in out
          and vacia(d), out, "exit %s" % rc)
    fe = workdir.file_signature(pe)
    buena = {"gate": "tornillos", "medido": True, "step_firma": fe, "tornillos": [
        {"id": "T1", "largo_medido_mm": 22.0, "pila_mm": 24.0, "margen_mm": -2.0, "veredicto": "rojo"}]}
    malas = [dict(buena, medido=False), dict(buena, step_firma="x"), dict(buena, tornillos=[]),
             dict(buena, tornillos=[{"id": "T1", "veredicto": "verde"}])]
    check("E5", "el validador rechaza salida sin numeros, medido:false, otra firma o sin tornillos; acepta la completa",
          gt.salida_valida(buena, fe)[0] and not any(gt.salida_valida(m, fe)[0] for m in malas), "", "validador")
    workdir.record_evidence(we, "tornillos_aceptados", fixture="conj.step", step_firma=fe, frase="frase de otro id",
                            fecha="2026-11-02", ids=["OTRO"])
    d = os.path.join(we, "entrega_otro_id")
    rc, out, _, _ = export(we, pe, d, 5, "--tornillos", j2, "--hoy", "2026-11-02")
    check("E5", "una aceptacion de otro id no cubre a T1: frena", rc != 0 and "[GATE tornillos]" in out and vacia(d),
          out, "exit %s" % rc)
    rc, out, _, _ = gate(pe, j2, "--hoy", "2026-11-02", "--workdir", we, "--acepto-tornillos",
                         "Fak lo asume: la tuerca se cambia por una de acero")
    d = os.path.join(we, "entrega_aceptada")
    rc, out, _, _ = export(we, pe, d, 5, "--tornillos", j2, "--hoy", "2026-11-02")
    check("E5", "con la aceptacion de T1 para esa firma, la entrega pasa el 02/11 (ACEPTADO)", rc == 0 and
          "ACEPTADO" in out and not vacia(d), out, "exit %s" % rc)
    rc, out, _, _ = run([os.path.join(SCR, "export_deliverables.py"), "--workdir", we, "--pieces", pe, "--deliver",
                         os.path.join(we, "entrega_skip"), "--skip-gate", "tornillos"])
    check("E5", "--skip-gate tornillos sin --reason -> error", rc != 0 and "--skip-gate exige --reason" in out, out,
          "exit %s" % rc)
    d = os.path.join(we, "entrega_skip_ok")
    rc, out, _, _ = export(we, pe, d, 5, "--tornillos", j2, "--skip-gate", "tornillos", "--hoy", "2026-11-02")
    dl = workdir.find_evidence(we, "delivery", dest=d)
    check("E5", "contraprueba: --skip-gate tornillos con --reason entrega y deja la huella", rc == 0 and dl and
          "tornillos" in (dl.get("skipped_gates") or []), out, "exit %s" % rc)
    s5v, j5v = guardar("e5_export_verde", sint(capas25, 27.0, luz=0.02), [tornillo(27.0)])
    with open(j5v, encoding="utf-8") as f:
        en_linea = json.load(f)["tornillos"]
    wv, pv = wd_export("w_export_verde", s5v, params={"tornillos": en_linea})
    d = os.path.join(wv, "entrega")
    rc, out, _, _ = export(wv, pv, d, 4, "--hoy", "2026-11-02")
    check("E5", "contraprueba: E1 declarado en params.tornillos (en linea) se entrega el 02/11 (OK)", rc == 0 and
          "[GATE tornillos] 'conj.step': OK" in out and not vacia(d), out, "exit %s" % rc)
    s5n, _ = guardar("e5_sin_decl", sint(capas25, 27.0, luz=0.02) + sol_extra[-1:], [tornillo(27.0)],
                     otros=["tornillo_2"])
    wn, pn = wd_export("w_export_sin_decl", s5n)
    d = os.path.join(wn, "entrega")
    rc, out, _, _ = export(wn, pn, d, 5, "--hoy", "2026-11-02")
    check("E5", "sin tornillos declarados y un solido llamado tornillo: AVISO «¿que tornillo va aca?» y entrega",
          rc == 0 and "que tornillo va aca" in out and not vacia(d), out, "exit %s" % rc)
    with open(j5, encoding="utf-8") as f:
        otro = json.load(f)
    otro["conjunto"] = "conj_v2.step"
    jo = os.path.join(W, "e5_otro_conjunto.tornillos.json")
    with open(jo, "w", encoding="utf-8") as f:
        json.dump(otro, f)
    d = os.path.join(we, "entrega_otro_conjunto_freno")
    rc, out, _, _ = export(we, pe, d, 5, "--tornillos", jo, "--hoy", "2026-11-02")
    check("E5", "json que habla de otro conjunto (renombrado): el 02/11 NO MEDIDO «[GATE tornillos]» y D vacia",
          rc != 0 and "[GATE tornillos] NO MEDIDO" in out and "conj_v2.step" in out and vacia(d), out, "exit %s" % rc)
    d = os.path.join(we, "entrega_otro_conjunto_aviso")
    rc, out, _, _ = export(we, pe, d, 5, "--tornillos", jo, "--hoy", "2026-10-25")
    check("E5", "el mismo json el 25/10: AVISO NO MEDIDO y entrega (nunca verde por silencio)", rc == 0 and
          "AVISO [GATE tornillos] NO MEDIDO" in out and not vacia(d), out, "exit %s" % rc)

    print("\n| caso | resultado | evidencia |\n|---|---|---|")
    for caso, nombre, res, evid in filas:
        print("| %s %s | %s | %s |" % (caso, nombre, res, evid))
    print("\n" + ("TODOS LOS CONTROLES DAN LO ESPERADO" if not fallos else "FALLARON: %s" % ", ".join(fallos)))
    print("carpeta del test: %s" % W)
    return 1 if fallos else 0


if __name__ == "__main__":
    sys.exit(main())
