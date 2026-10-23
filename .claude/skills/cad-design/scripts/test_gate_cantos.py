# -*- coding: utf-8 -*-
"""Casos C1 a C9 del gate de cantos convexos (gate 3c, 23/10/2026) — test de regresion, no de humo.

Correr:  .venv-cad\\Scripts\\python.exe test_gate_cantos.py [--out <carpeta>]

Los casos los escribio un critico ANTES del gate (viernes-23-plan-sistema/banco3d-material/
casos_gates_3c_3f.md, tabla 3c). Cada control se prueba en las DOS direcciones: el caso que tiene
que dar rojo da rojo, y el legitimo pasa (un gate que rechaza todo tambien es un control ciego).
Las piezas son las del banco (evals/banco3d/ejercicios/05_canto_vivo y 06_palanca_0_60), armadas
con sus propios bien.py / mal_*.py en una carpeta nueva. La fecha se simula con --hoy, que solo
vale con CAD_GATE_TEST=1. Va en scripts/ como test_gates_entrega.py (la skill no tiene tests/).

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

SCR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCR)
RAIZ = os.path.normpath(os.path.join(SCR, "..", "..", "..", ".."))
EJ = os.path.join(RAIZ, "evals", "banco3d", "ejercicios")
CORR = os.path.join(RAIZ, "evals", "banco3d", "correctores", "cantos_convexos.py")
PY = sys.executable
_ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
_ap.add_argument("--out", default=None, help="carpeta donde armar las piezas y los workdirs del test")
_ARGS = _ap.parse_args()
W = os.path.join(_ARGS.out or tempfile.gettempdir(), "test_gate_cantos_%s" % time.strftime("%Y%m%d_%H%M%S"))
ENV_TEST = {**os.environ, "PYTHONIOENCODING": "utf-8", "CAD_GATE_TEST": "1"}
ENV_REAL = {k: v for k, v in os.environ.items() if k not in ("CAD_GATE_TEST", "CAD_HOY")}
ENV_REAL["PYTHONIOENCODING"] = "utf-8"
GATE = os.path.join(SCR, "gate_aristas.py")


def run(args, env=ENV_TEST, timeout=900):
    t0 = time.time()
    p = subprocess.run([PY] + args, capture_output=True, text=True, encoding="utf-8", errors="replace",
                       env=env, timeout=timeout)
    out = (p.stdout or "") + (p.stderr or "")
    j = None
    for linea in reversed((p.stdout or "").splitlines()):
        if linea.startswith('{"gate": "cantos_convexos"') or linea.startswith('{"corrector"'):
            j = json.loads(linea)
            break
    return p.returncode, out, j, round(time.time() - t0, 1)


def gate(*args, **kw):
    return run([GATE, "--cantos-convexos"] + list(args), **kw)


def armar(ejercicio, script, carpeta):
    rc, out, _, _ = run([os.path.join(EJ, ejercicio, script), carpeta])
    if rc != 0:
        raise SystemExit("no se pudo armar %s/%s: %s" % (ejercicio, script, out[-500:]))


def armar_mango(radio, nombre, carpeta):
    codigo = ("import sys; sys.argv = ['x', %r]; sys.path.insert(0, %r); from _mango import armar; armar(%r, %r)"
              % (carpeta, os.path.join(EJ, "05_canto_vivo"), radio, nombre))
    rc, out, _, _ = run(["-c", codigo])
    if rc != 0:
        raise SystemExit("no se pudo armar el mango R%s: %s" % (radio, out[-500:]))
    return os.path.join(carpeta, nombre + ".step")


def main():
    from cadlib import workdir
    import gate_aristas as ga
    os.makedirs(W, exist_ok=True)
    fallos, filas = [], []

    def check(caso, nombre, cond, detalle, evidencia=""):
        print(("  [OK]    " if cond else "  [FALLA] ") + "%s %s" % (caso, nombre))
        filas.append((caso, nombre, "OK" if cond else "FALLA", evidencia))
        if not cond:
            fallos.append("%s %s" % (caso, nombre))
            print("          " + str(detalle).strip()[-900:].replace("\n", "\n          "))

    print("armando las piezas del banco en %s ..." % W)
    b05, b06 = os.path.join(W, "b05"), os.path.join(W, "b06")
    for s in ("bien.py", "mal_1_sin_radio.py", "mal_2_radio_0_5.py"):
        armar("05_canto_vivo", s, b05)
    armar("06_palanca_0_60", "bien.py", b06)
    r15, r0, r05 = (os.path.join(b05, n + ".step") for n in ("mango_R1_5", "mango_R0", "mango_R0_5"))
    r149 = armar_mango(1.49, "mango_R1_49", os.path.join(W, "frontera"))
    palanca = os.path.join(b06, "palanca_0_60__palanca.step")
    SZ = ["--sin-zona", "mango entero: lo agarra la mano"]

    print("\nC1 verde: mango R1,5")
    rc, out, j, seg = gate("--step", r15, "--umbral", "1.5", *SZ, "--hoy", "2026-11-02")
    check("C1", "mango R1,5 da verde (exit 0, todas R>=1,5) aun en fecha de freno",
          rc == 0 and j and j["veredicto"] == "verde" and j["cantos_vivos"] == 0 and j["radios_chicos"] == 0,
          out, "exit %s, %s convexas, %s s" % (rc, j and j.get("convexas_revisadas"), seg))
    check("C1", "las convexas son 24 (24 redondeos; el corrector del banco da 26 porque cuenta los 2 agujeros)",
          j and j["convexas_revisadas"] == 24, out, "convexas %s" % (j and j.get("convexas_revisadas")))
    check("C1", "cierra en minutos (< 300 s)", seg < 300, out, "%s s" % seg)

    print("\nC2 rojo real: mango R0, aviso hasta el 30/10 inclusive y freno desde el 31/10")
    for hoy, rc_esp, texto in (("2026-10-25", 0, "AVISO: 16 cantos vivos"), ("2026-10-30", 0, "AVISO: 16"),
                               ("2026-10-31", 1, "FRENO: 16 cantos vivos"), ("2026-11-02", 1, "FRENO: 16 cantos vivos")):
        rc, out, j, seg = gate("--step", r0, *SZ, "--hoy", hoy)
        check("C2", "--hoy %s -> exit %d «%s»" % (hoy, rc_esp, texto),
              rc == rc_esp and texto in out and j and j["veredicto"] == "rojo" and j["cantos_vivos"] == 16,
              out, "exit %s, modo %s" % (rc, j and j.get("modo")))
    check("C2", "el aviso dice desde cuando frena (2026-10-31) y el freno dice el mas chico R0",
          "freno desde 2026-10-31" in gate("--step", r0, *SZ, "--hoy", "2026-10-25")[1] and "el mas chico R0" in out,
          out, "texto del aviso")
    rc, out, j, _ = gate("--step", r0, *SZ, "--hoy", "2026-11-02", env=ENV_REAL)
    check("C2", "--hoy sin CAD_GATE_TEST=1 no vale: NO MEDIDO (exit 2), no juzga con fecha falsa",
          rc == 2 and j and j["medido"] is False, out, "exit %s" % rc)

    print("\nC3 control ciego: R0,5 y la frontera R1,49 / R1,5")
    rc, out, j, _ = gate("--step", r05, *SZ, "--hoy", "2026-11-02")
    check("C3", "R0,5 -> rojo «24 redondeos menores que R1,5, el mas chico R0,5»",
          rc == 1 and j and j["radios_chicos"] == 24 and "el mas chico R0,5" in out, out, "exit %s" % rc)
    rc, out, j, _ = gate("--step", r149, *SZ, "--hoy", "2026-11-02")
    check("C3", "frontera R1,49 -> rojo", rc == 1 and j and j["radios_chicos"] > 0, out,
          "exit %s, chicos %s" % (rc, j and j.get("radios_chicos")))
    check("C3", "frontera R1,5 -> verde (es el C1)", filas[0][2] == "OK", "", "ver C1")

    print("\nC4 zona por contacto (palanca del 06, zona en la punta)")
    rc, out, j, _ = gate("--step", palanca, "--zona", "100,-10,70,150,10,90", "--hoy", "2026-10-25")
    check("C4", "cuenta toda arista que TOCA la zona: 8 (4 de la punta + las 4 largas de 150 mm)",
          rc == 0 and j and j["cantos_vivos"] == 8, out, "cantos vivos %s" % (j and j.get("cantos_vivos")))
    rc, out, jc, _ = run([CORR, palanca, "--zona", "100,-10,70,150,10,90"])
    check("C4", "gemelo: el corrector del banco (punto medio) da 4 sobre la misma zona",
          jc and jc["medidas"].get("cantos_vivos") == 4, out,
          "corrector: %s" % (jc and jc["medidas"].get("cantos_vivos")))

    print("\nC5 sin zona")
    rc, out, j, _ = gate("--step", palanca, "--hoy", "2026-10-25")
    check("C5", "sin --zona -> NO MEDIDO exit 2 «falta zona de mano», medido false",
          rc == 2 and "falta zona de mano" in out and j and j["medido"] is False, out, "exit %s" % rc)
    w5 = os.path.join(W, "w5")
    rc, out, j, _ = gate("--step", palanca, "--sin-zona", "palanca entera para el test", "--hoy", "2026-10-25",
                         "--workdir", w5)
    ev = workdir.find_evidence(w5, "cantos_convexos")
    # 10 vivos medidos el 23/10 (la palanca es caja + cubo R15; la cara del cubo cuenta como convexa R15 y pasa)
    check("C5", "con --sin-zona juzga la pieza entera (10 cantos vivos) y deja el motivo en el manifest",
          rc == 0 and j and j["medido"] is True and j["cantos_vivos"] == 10 and ev
          and ev.get("sin_zona") == "palanca entera para el test", out,
          "vivos %s, motivo %s" % (j and j.get("cantos_vivos"), ev and ev.get("sin_zona")))

    print("\nC6 NO MEDIDO nunca verde")
    w6 = os.path.join(W, "w6")
    os.makedirs(w6, exist_ok=True)
    trunc = os.path.join(w6, "mango_truncado.step")
    data = open(r15, "rb").read()
    open(trunc, "wb").write(data[: len(data) // 2])
    rc, out, j, _ = gate("--step", trunc, *SZ, "--workdir", w6)
    ev = workdir.find_evidence(w6, "cantos_convexos", fixture="mango_truncado.step")
    check("C6", "STEP truncado -> exit 2 y evidencia medido:false",
          rc == 2 and j and j["medido"] is False and ev and ev.get("medido") is False, out, "exit %s" % rc)
    codigo = ("import sys, runpy; sys.modules['OCP'] = None; sys.argv = [%r, '--step', %r, '--cantos-convexos', "
              "'--sin-zona', 'mango entero', '--workdir', %r]; runpy.run_path(%r, run_name='__main__')"
              % (GATE, r15, w6, GATE))
    rc, out, j, _ = run(["-c", codigo])
    ev = workdir.find_evidence(w6, "cantos_convexos", fixture="mango_R1_5.step")
    check("C6", "OCP ausente -> exit 2 «falta OCP» y evidencia medido:false",
          rc == 2 and "falta OCP" in out and ev and ev.get("medido") is False, out, "exit %s" % rc)
    rc, out, j, _ = gate("--step", r15, *SZ, "--tope-seg", "1")
    check("C6", "--tope-seg 1 sobre C1 -> exit 2 NO MEDIDO (nunca verde)",
          rc == 2 and j and j["medido"] is False and "tope" in (j.get("motivo") or ""), out, "exit %s" % rc)
    codigo = ("import sys; sys.path.insert(0, %r); import gate_aristas as ga; "
              "ga.cantos_convexos = lambda *a, **k: dict(convexas_revisadas=0, aristas_en_zona=0, cantos_vivos=0, "
              "radios_chicos=0, cilindros_completos=0, caras_curvas_sin_juzgar=0, aristas_sin_normal=0, rmin=None, "
              "ejemplos=[], completos=[]); "
              "sys.argv = ['gate_aristas.py', '--step', %r, '--cantos-convexos', '--sin-zona', 'mango entero']; "
              "sys.exit(ga.main())" % (SCR, r0))
    rc, out, j, _ = run(["-c", codigo])
    check("C6", "detector forzado a 0 aristas -> autotest exit 3 y no juzga la pieza",
          rc == 3 and "AUTOTEST FALLA" in out and j is None, out, "exit %s" % rc)

    print("\nC7 falso positivo a decidir: pin de 2 sobre placa R1,5")
    from build123d import Box, Cylinder, Location, export_step, fillet
    placa = fillet(Box(40, 30, 5).edges(), 1.5)
    pin = placa + Cylinder(1, 10).moved(Location((0, 0, 7.5)))
    pin_step = os.path.join(W, "placa_pin.step")
    export_step(pin, pin_step)
    rc, out, j, _ = gate("--step", pin_step, "--sin-zona", "placa con pin, caso C7", "--hoy", "2026-10-25")
    check("C7", "el cilindro del pin (vuelta completa) NO cuenta como redondeo chico; la punta viva SI cuenta",
          j and j["radios_chicos"] == 0 and j["cilindros_completos"] == 1 and j["cantos_vivos"] == 1, out,
          "chicos %s, completos %s, vivos %s" % (j and j.get("radios_chicos"), j and j.get("cilindros_completos"),
                                                 j and j.get("cantos_vivos")))
    rc, out, jc, _ = run([CORR, pin_step])
    check("C7", "gemelo: el corrector del banco cuenta el cilindro del pin como redondeo chico R1",
          jc and jc["medidas"].get("radios_chicos") == 1, out,
          "corrector: chicos %s" % (jc and jc["medidas"].get("radios_chicos")))

    print("\nC8 salida con frase de Fak")
    w8 = os.path.join(W, "w8")
    os.makedirs(os.path.join(w8, "out"), exist_ok=True)
    p8 = os.path.join(w8, "out", "mango_R0.step")
    shutil.copy2(r0, p8)
    frase = "van contra el tablero, no toca la mano"
    for corta in ("ok", ""):
        rc, out, j, _ = gate("--step", p8, *SZ, "--hoy", "2026-11-02", "--workdir", w8, "--acepto-cantos", corta)
        check("C8", "frase «%s» -> exit 1 «frase corta»" % corta, rc == 1 and "frase corta" in out, out, "exit %s" % rc)
    rc, out, j, _ = gate("--step", p8, *SZ, "--hoy", "2026-11-02", "--workdir", w8, "--acepto-cantos", frase)
    ac = workdir.find_evidence(w8, "cantos_aceptados", fixture="mango_R0.step")
    firma8 = workdir.file_signature(p8)
    check("C8", "con la frase -> exit 0; manifest con frase, fecha, firma del STEP y cantidad aceptada",
          rc == 0 and "[ACEPTADO]" in out and ac and ac.get("frase") == frase and ac.get("fecha") == "2026-11-02"
          and ac.get("step_firma") == firma8 and ac.get("cantidad") == 16, out,
          "aceptacion %s" % (ac and {k: ac.get(k) for k in ("fecha", "step_firma", "cantidad")}))
    retocado = armar_mango(0.0, "mango_R0", os.path.join(W, "retocado"))
    if workdir.file_signature(retocado) == firma8:
        time.sleep(1.5)
        retocado = armar_mango(0.0, "mango_R0", os.path.join(W, "retocado2"))
    shutil.copy2(retocado, p8)
    check("C8", "el STEP retocado tiene otra firma", workdir.file_signature(p8) != firma8, "",
          "%s -> %s" % (firma8, workdir.file_signature(p8)))
    rc, out, j, _ = gate("--step", p8, *SZ, "--hoy", "2026-11-02", "--workdir", w8, "--acepto-cantos", frase)
    check("C8", "la misma frase sobre el STEP retocado (otra firma) se niega (exit 1)",
          rc == 1 and "ya acepto otra version" in out, out, "exit %s" % rc)
    rc, out, j, _ = gate("--step", p8, *SZ, "--hoy", "2026-11-02", "--workdir", w8, "--acepto-cantos",
                         "Fak miro la version nueva: tambien va contra el tablero")
    check("C8", "contraprueba: una frase nueva para la version nueva SI se acepta", rc == 0 and "[ACEPTADO]" in out,
          out, "exit %s" % rc)

    print("\nC9 cableado en export_deliverables.py")

    def wd_export(nombre, step, zona=True):
        w = os.path.join(W, nombre)
        for d in ("in", "out", "renders", "cache"):
            os.makedirs(os.path.join(w, d), exist_ok=True)
        piece = os.path.join(w, "out", os.path.basename(step))
        shutil.copy2(step, piece)
        workdir.ensure_workdir(w)
        # colision y render sembrados como en test_gates_entrega.py (aca se prueba el gate de cantos)
        workdir.record_evidence(w, "collision_check", fixture=os.path.basename(piece), n_inside=0,
                                contacto_ok=True, fixture_firma=workdir.file_signature(piece))
        png = os.path.join(w, "renders", "cualquiera.png")
        open(png, "wb").write(b"\x89PNG\r\n\x1a\n")
        os.utime(png, None)
        if zona:
            m = workdir.load_manifest(w)
            m.setdefault("params", {})["zona_mano"] = [-51, -16, -11, 51, 16, 11]   # el mango entero
            workdir.save_manifest(w, m)
        return w, piece

    def export(w, piece, destino, *extra):
        base = ["export_deliverables.py", "--workdir", w, "--pieces", piece, "--deliver", destino,
                "--skip-gate", "zona", "--skip-gate", "proceso", "--reason", "test sintetico"]
        return run([os.path.join(SCR, base[0])] + base[1:] + list(extra))

    def vacia(d):
        return not os.path.isdir(d) or not os.listdir(d)

    w9, p9 = wd_export("w9", r0)
    d = os.path.join(w9, "entrega_freno")
    rc, out, _, _ = export(w9, p9, d, "--hoy", "2026-11-02")
    check("C9", "--hoy 2026-11-02 con zona declarada -> SystemExit «[GATE cantos]» y D vacia",
          rc != 0 and "[GATE cantos]" in out and vacia(d), out, "exit %s, D vacia %s" % (rc, vacia(d)))
    d = os.path.join(w9, "entrega_aviso")
    rc, out, _, _ = export(w9, p9, d, "--hoy", "2026-10-25")
    ev = workdir.find_evidence(w9, "cantos_convexos", fixture="mango_R0.step")
    check("C9", "--hoy 2026-10-25 -> AVISO y entrega", rc == 0 and "AVISO [GATE cantos]" in out
          and "ENTREGA OK" in out and not vacia(d), out, "exit %s" % rc)
    check("C9", "la firma juzgada es la del archivo de out/",
          ev and ev.get("step_firma") == workdir.file_signature(p9) and os.path.normpath(ev.get("step")) ==
          os.path.normpath(p9), out, "evidencia step %s" % (ev and ev.get("step")))
    dl = workdir.find_evidence(w9, "delivery")
    check("C9", "la entrega deja el resultado del gate de cantos en el manifest (modo aviso, 16 vivos)",
          dl and (dl.get("cantos_por_pieza") or {}).get("mango_R0.step", {}).get("modo") == "aviso"
          and dl["cantos_por_pieza"]["mango_R0.step"].get("cantos_vivos") == 16, out, "delivery cantos_por_pieza")
    for nombre, sembrada in (("verde medido:true sin cantos", dict(medido=True, veredicto="verde", cantos_vivos=0,
                                                                     radios_chicos=0, convexas_revisadas=16)),
                             ("medido:false", dict(medido=False, veredicto="verde")),
                             ("sin conteo", dict(medido=True, veredicto="verde"))):
        workdir.record_evidence(w9, "cantos_convexos", fixture="mango_R0.step", step=p9,
                                step_firma=workdir.file_signature(p9), **sembrada)
        d = os.path.join(w9, "entrega_sembrada_%d" % len(nombre))
        rc, out, _, _ = export(w9, p9, d, "--hoy", "2026-11-02")
        check("C9", "evidencia sembrada (%s) con la firma correcta no vale: frena igual" % nombre,
              rc != 0 and "[GATE cantos]" in out and vacia(d), out, "exit %s" % rc)
    firma9 = workdir.file_signature(p9)
    ok_sin, _ = ga.salida_cantos_valida({"gate": "cantos_convexos", "medido": True, "step_firma": firma9}, firma9)
    ok_false, _ = ga.salida_cantos_valida({"gate": "cantos_convexos", "medido": False, "cantos_vivos": 0,
                                           "radios_chicos": 0, "convexas_revisadas": 1, "step_firma": firma9}, firma9)
    ok_otra, _ = ga.salida_cantos_valida({"gate": "cantos_convexos", "medido": True, "cantos_vivos": 0,
                                          "radios_chicos": 0, "convexas_revisadas": 1, "step_firma": "x"}, firma9)
    ok_bien, _ = ga.salida_cantos_valida({"gate": "cantos_convexos", "medido": True, "cantos_vivos": 0,
                                          "radios_chicos": 0, "convexas_revisadas": 1, "step_firma": firma9}, firma9)
    check("C9", "la salida sin conteo, con medido:false o de otra firma se rechaza; la completa se acepta",
          not ok_sin and not ok_false and not ok_otra and ok_bien, "", "validador de la salida")
    rc, out, _, _ = run([os.path.join(SCR, "export_deliverables.py"), "--workdir", w9, "--pieces", p9, "--deliver",
                         os.path.join(w9, "entrega_skip"), "--skip-gate", "cantos"])
    check("C9", "--skip-gate cantos sin --reason -> error", rc != 0 and "--skip-gate exige --reason" in out, out,
          "exit %s" % rc)
    d = os.path.join(w9, "entrega_skip_ok")
    rc, out, _, _ = export(w9, p9, d, "--skip-gate", "cantos", "--hoy", "2026-11-02")
    dl = workdir.find_evidence(w9, "delivery", dest=d)
    check("C9", "contraprueba: --skip-gate cantos con --reason entrega y deja la huella",
          rc == 0 and dl and "cantos" in (dl.get("skipped_gates") or []), out, "exit %s" % rc)
    rc, out, _, _ = gate("--step", p9, "--zona=-51,-16,-11,51,16,11", "--hoy", "2026-11-02", "--workdir", w9,
                         "--acepto-cantos", "van contra el tablero, no toca la mano")
    d = os.path.join(w9, "entrega_aceptada")
    rc, out, _, _ = export(w9, p9, d, "--hoy", "2026-11-02")
    check("C9", "con la aceptacion de Fak para esa firma, la entrega pasa el 02/11 (ACEPTADO)",
          rc == 0 and "ACEPTADO" in out and not vacia(d), out, "exit %s" % rc)
    w9b, p9b = wd_export("w9_sin_zona", r0, zona=False)
    d = os.path.join(w9b, "entrega")
    rc, out, _, _ = export(w9b, p9b, d, "--hoy", "2026-11-02")
    check("C9", "sin zona declarada: el 02/11 sigue como AVISO y entrega (decision del canon, sin_zona_en_entrega)",
          rc == 0 and "AVISO [GATE cantos]" in out and "Sin zona de mano declarada" in out, out, "exit %s" % rc)
    w9c, p9c = wd_export("w9_bien", r15)
    d = os.path.join(w9c, "entrega")
    rc, out, _, _ = export(w9c, p9c, d, "--hoy", "2026-11-02")
    check("C9", "contraprueba: el mango R1,5 con zona se entrega el 02/11 (verde)",
          rc == 0 and "[GATE cantos] 'mango_R1_5.step': OK" in out and not vacia(d), out, "exit %s" % rc)
    rc, out, _, _ = run([os.path.join(SCR, "export_deliverables.py"), "--workdir", w9c, "--pieces", p9c, "--deliver",
                         os.path.join(w9c, "entrega_real"), "--skip-gate", "zona", "--skip-gate", "proceso",
                         "--reason", "t", "--hoy", "2026-11-02"], env=ENV_REAL)
    check("C9", "--hoy sin CAD_GATE_TEST=1 en la entrega -> error", rc != 0 and "CAD_GATE_TEST" in out, out,
          "exit %s" % rc)

    print("\n| caso | resultado | evidencia |\n|---|---|---|")
    for caso, nombre, res, evid in filas:
        print("| %s %s | %s | %s |" % (caso, nombre, res, evid))
    print("\n" + ("TODOS LOS CONTROLES DAN LO ESPERADO" if not fallos else "FALLARON: %s" % ", ".join(fallos)))
    print("carpeta del test: %s" % W)
    return 1 if fallos else 0


if __name__ == "__main__":
    sys.exit(main())
