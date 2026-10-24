# -*- coding: utf-8 -*-
"""Casos D1 a D10 del gate de barrido del recorrido (gate 3d, 23/10/2026) — test de regresion, no de humo.

Correr:  .venv-cad\\Scripts\\python.exe test_gate_barrido.py [--out <carpeta>] [--sin-virolador]

Los casos los escribio un critico ANTES del gate (viernes-23-plan-sistema/banco3d-material/casos_gates_3c_3f.md,
tabla 3d). Cada control se prueba en las DOS direcciones: el caso que tiene que dar rojo da rojo, y el legitimo pasa
(un gate que rechaza todo tambien es un control ciego). Las piezas son las del banco
(evals/banco3d/ejercicios/06_palanca_0_60), armadas con sus propios bien.py / mal_*.py en una carpeta nueva, mas
algunas sinteticas armadas aca con build123d (medidas de ensayo, no son de Barack). D5 y D8 usan el virolador real de
C:/Dev/_catia_practica/virolador_auto (local, no versionado): si no esta, esos casos se saltean con aviso y lo dice
la tabla. La fecha se simula con --hoy, que solo vale con CAD_GATE_TEST=1. Va en scripts/ como test_gate_cantos.py
(la skill no tiene tests/).

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
CORR = os.path.join(RAIZ, "evals", "banco3d", "correctores", "barrido_palanca.py")
VIR = "C:/Dev/_catia_practica/virolador_auto"
PY = sys.executable
_ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
_ap.add_argument("--out", default=None, help="carpeta donde armar las piezas y los workdirs del test")
_ap.add_argument("--sin-virolador", action="store_true", help="saltear D5 y D8 (el virolador real tarda minutos)")
_ARGS = _ap.parse_args()
W = os.path.join(_ARGS.out or tempfile.gettempdir(), "test_gate_barrido_%s" % time.strftime("%Y%m%d_%H%M%S"))
ENV_TEST = {**os.environ, "PYTHONIOENCODING": "utf-8", "CAD_GATE_TEST": "1"}
ENV_REAL = {k: v for k, v in os.environ.items() if k not in ("CAD_GATE_TEST", "CAD_HOY")}
ENV_REAL["PYTHONIOENCODING"] = "utf-8"
GATE = os.path.join(SCR, "barrido.py")
FRENO, AVISO = "2026-11-02", "2026-10-25"


def run(args, env=ENV_TEST, timeout=900):
    t0 = time.time()
    p = subprocess.run([PY, "-I"] + args, capture_output=True, text=True, encoding="utf-8", errors="replace",
                       env=env, timeout=timeout)
    out = (p.stdout or "") + (p.stderr or "")
    j = None
    for linea in reversed((p.stdout or "").splitlines()):
        if linea.startswith('{"gate": "barrido"') or linea.startswith('{"corrector"'):
            j = json.loads(linea)
            break
    return p.returncode, out, j, round(time.time() - t0, 1)


def gate(*args, **kw):
    return run([GATE] + list(args), **kw)


def armar(script, carpeta):
    rc, out, _, _ = run([os.path.join(EJ, "06_palanca_0_60", script), carpeta])
    if rc != 0:
        raise SystemExit("no se pudo armar %s: %s" % (script, out[-500:]))
    return os.path.join(carpeta, "palanca_0_60.json")


def escribir_json(ruta, datos):
    os.makedirs(os.path.dirname(ruta), exist_ok=True)
    with open(ruta, "w", encoding="utf-8") as f:
        json.dump(datos, f, indent=1)
    return ruta


def variante(base_json, destino, **cambios):
    """Copia el json del 06 a otra carpeta con rutas absolutas a los STEP y los cambios pedidos."""
    with open(base_json, encoding="utf-8") as f:
        d = json.load(f)
    b = os.path.dirname(base_json)
    d["archivos"] = {k: os.path.join(b, v) for k, v in d["archivos"].items()}
    d.update(cambios)
    return escribir_json(destino, d)


def main():
    from cadlib import workdir
    import barrido as gb
    os.makedirs(W, exist_ok=True)
    fallos, filas = [], []

    def check(caso, nombre, cond, detalle, evidencia=""):
        print(("  [OK]    " if cond else "  [FALLA] ") + "%s %s" % (caso, nombre))
        filas.append((caso, nombre, "OK" if cond else "FALLA", evidencia))
        if not cond:
            fallos.append("%s %s" % (caso, nombre))
            print("          " + str(detalle).strip()[-1200:].replace("\n", "\n          "))

    def saltear(caso, nombre, motivo):
        print("  [SALTEA] %s %s: %s" % (caso, nombre, motivo))
        filas.append((caso, nombre, "SALTEADO", motivo))

    print("armando las piezas del banco en %s ..." % W)
    J = {s: armar(s + ".py", os.path.join(W, "b06", s)) for s in
         ("bien", "mal_1_choca_a_35", "mal_2_pellizco_15_a_50", "mal_3_choca_a_60")}

    print("\nAUTOTEST")
    rc, out, _, _ = gate("--solo-autotest")
    check("D0", "--solo-autotest: el par BIEN/MAL propio separa (exit 0)", rc == 0 and "AUTOTEST OK" in out, out,
          "exit %s" % rc)
    codigo = ("import sys; sys.path.insert(0, %r); import barrido as gb; _e = gb.evaluar; "
              "gb.evaluar = lambda *a, **k: dict(_e(*a, **k), rojo=False, choques=[], pellizcos=[]); "
              "prob = gb.autotest(); print('PROBLEMAS', len(prob)); gb.autotest = lambda: prob; "
              "sys.exit(gb.main(['--solo-autotest']))" % SCR)
    rc, out, _, _ = run(["-c", codigo])
    check("D0", "detector forzado a no ver nada -> el autotest lo caza (2 MAL sin cazar) y sale con 3",
          rc == 3 and "PROBLEMAS 2" in out and "AUTOTEST FALLA" in out, out, "exit %s" % rc)

    print("\nD1 verde: palanca 0-60 del banco")
    rc, out, j, seg = gate(J["bien"], "--hoy", FRENO)
    pp = (j or {}).get("pose_peor") or {}
    check("D1", "bien -> exit 0, verde, 25 poses aun en fecha de freno",
          rc == 0 and j and j["veredicto"] == "verde" and j["poses"] == 25, out,
          "exit %s, %s poses, %s s" % (rc, j and j.get("poses"), seg))
    check("D1", "luz minima 55 mm (cubo R15 a 65 mm sobre la base) con aviso «< 100 mm (mano)»",
          j and abs(pp.get("luz_mm", 0) - 55.0) <= 0.2 and j["avisos_mano"] and "menor que una mano" in out, out,
          "luz %s a %s" % (pp.get("luz_mm"), pp.get("pose")))
    check("D1", "la guarda no refina el paso de 2,5 (guarda 3,8 grados para seccion 20 a r 150)",
          j and not j["guarda"]["refinado"] and abs(j["guarda"]["guarda_grados"] - 3.81) < 0.02, out,
          "guarda %s" % (j and j["guarda"].get("guarda_grados")))
    check("D1", "el exacto de OpenCASCADE coincide con la malla en la pose critica",
          j and j["exacto"].get("corrido") and j["exacto"].get("coincide"), out, "exacto %s" % (j and j["exacto"]))
    for nom in ("bien", "mal_2_pellizco_15_a_50"):
        rc2, out2, jc, _ = run([CORR, J[nom]])
        rc3, out3, jg, _ = gate(J[nom], "--hoy", AVISO)
        cb = {c["g"]: c["luz"] for c in (jc or {}).get("medidas", {}).get("curva", [])}
        cg = {c["pose"]: c["luz_mm"] for c in (jg or {}).get("curva", [])}
        dif = [abs(cb[g] - cg[g]) for g in cb if g in cg and cb[g] is not None and cg[g] is not None]
        check("D1", "la curva de luz del gate (malla) coincide pose a pose con barrido_palanca.py (exacto) en %s" % nom,
              len(dif) == 25 and max(dif) <= 0.15, out2 + out3, "25 poses, dif max %.3f mm" % (max(dif) if dif else -1))

    print("\nD2 choque solo en el medio (mal_1) y el paso grueso")
    rc, out, j, _ = gate(J["mal_1_choca_a_35"], "--hoy", FRENO)
    ch = (j or {}).get("choques") or [{}]
    curva = {c["pose"]: c["choque_mm3"] for c in (j or {}).get("curva", [])}
    check("D2", "mal_1 -> rojo y FRENO (exit 1): choca de 25 a 45 grados, libre en 0 y 60",
          rc == 1 and j and j["veredicto"] == "rojo" and ch[0].get("poses", [None])[0] == 25.0
          and ch[0]["poses"][-1] == 45.0 and curva.get(0.0) == 0 and curva.get(60.0) == 0 and "FRENO" in out, out,
          "exit %s, poses %s" % (rc, ch[0].get("poses")))
    rc, out, j, _ = gate(J["mal_1_choca_a_35"], "--paso", "60", "--hoy", FRENO)
    g = (j or {}).get("guarda") or {}
    check("D2", "--paso 60 NO da verde: la guarda refina (paso <= 3,8 grados) y da rojo",
          j and j["veredicto"] == "rojo" and g.get("refinado") and g.get("paso_grados") <= g.get("guarda_grados")
          and "REFINADO" in out, out, "paso pedido 60 -> %s (guarda %s)" % (g.get("paso_grados"),
                                                                             g.get("guarda_grados")))
    rc, out, jc, _ = run([CORR, J["mal_1_choca_a_35"], "--paso", "60"])
    check("D2", "gemelo: barrido_palanca.py --paso 60 (sin guarda) da VERDE al mismo mutante",
          rc == 0 and jc and jc["veredicto"] == "verde", out, "corrector exit %s" % rc)
    rc, out, j, _ = gate(J["mal_1_choca_a_35"], "--hoy", AVISO)
    check("D2", "mal_1 el 25/10 -> exit 0 «AVISO: ... freno desde 2026-10-31»",
          rc == 0 and "AVISO: CHOCA" in out and "freno desde 2026-10-31" in out and j["veredicto"] == "rojo", out,
          "exit %s" % rc)

    print("\nD3 luz y extremo")
    rc, out, j, _ = gate(J["mal_2_pellizco_15_a_50"], "--hoy", FRENO)
    pz = ((j or {}).get("pellizcos") or [{}])[0]
    c50 = [c["luz_mm"] for c in (j or {}).get("curva", []) if c["pose"] == 50.0]
    check("D3", "mal_2 -> rojo «luz 15 mm a ... < 25 (dedo)»; en la curva, 15 mm a 50 grados (el bloque esta a 15 mm "
          "en Y: la luz queda en 15 desde que la palanca lo alcanza hasta 60; el gate informa la primera pose)",
          j and j["veredicto"] == "rojo" and abs(pz.get("luz_mm", 0) - 15.0) <= 0.2 and c50
          and abs(c50[0] - 15.0) <= 0.2 and "< 25 (dedo)" in out, out,
          "luz %s a %s; a 50: %s" % (pz.get("luz_mm"), pz.get("pose"), c50))
    check("D3", "la luz de dedo sola queda como AVISO tambien el 02/11 (luces_frenan false, P12)",
          rc == 0 and "AVISO" in out and j and j["modo"] == "aviso", out, "exit %s, modo %s" % (rc, j and j["modo"]))
    rc, out, j, _ = gate(J["mal_3_choca_a_60"], "--hoy", FRENO)
    ch = ((j or {}).get("choques") or [{}])[0]
    check("D3", "mal_3 -> rojo en la ULTIMA pose (60 grados: el extremo se incluye)",
          rc == 1 and j and 60.0 in ch.get("poses", []), out, "poses con choque %s" % ch.get("poses"))

    print("\nD4 salto entre poses: tabique de 1 mm a 25 grados")
    from build123d import Axis, Box, Pos, Rot, export_step, import_step
    import math
    d4 = os.path.join(W, "d4")
    os.makedirs(d4, exist_ok=True)
    tab = Pos(140 * math.cos(math.radians(25)), 0, 80 + 140 * math.sin(math.radians(25))) * Rot(0, -25, 0) * \
        Box(30, 20, 1)
    tab_step = os.path.join(d4, "tabique.step")
    export_step(tab, tab_step)
    pal = import_step(os.path.join(W, "b06", "bien", "palanca_0_60__palanca.step"))
    eje = Axis((0, 0, 80), (0, -1, 0))

    def vol_tab(g):
        x = pal.rotate(eje, g).intersect(tab)
        return sum(s.volume for s in x.solids()) if x is not None else 0.0
    v20, v25, v30 = vol_tab(20), vol_tab(25), vol_tab(30)
    check("D4", "el tabique (exacto) choca a 25 grados y esta libre a 20 y 30", v25 > 1 and v20 < 1e-3 and v30 < 1e-3,
          "", "vol 20/25/30: %.2f / %.2f / %.2f mm3" % (v20, v25, v30))
    with open(J["bien"], encoding="utf-8") as f:
        b = json.load(f)
    j4 = variante(J["bien"], os.path.join(d4, "conjunto.json"), partes=b["partes"] + ["tabique"])
    with open(j4, encoding="utf-8") as f:
        d = json.load(f)
    d["archivos"]["tabique"] = tab_step
    escribir_json(j4, d)
    rc, out, jc, _ = run([CORR, j4, "--paso", "10", "--dedo", "0"])
    check("D4", "gemelo: barrido_palanca.py --paso 10 (sin guarda, sin luz) da VERDE: el tabique cae entre 20 y 30",
          rc == 0 and jc and jc["veredicto"] == "verde", out, "corrector exit %s" % rc)
    rc, out, j, _ = gate(j4, "--paso", "10", "--hoy", FRENO)
    ch = [c for c in ((j or {}).get("choques") or []) if c["par"] == ["palanca", "tabique"]]
    check("D4", "el gate con --paso 10 refina y da ROJO: choca palanca-tabique entre 20 y 30 grados",
          rc == 1 and ch and all(20 < p < 30 for p in ch[0]["poses"]) and j["guarda"]["refinado"], out,
          "poses %s" % (ch and ch[0]["poses"]))

    print("\nD6 la junta que esconde")
    j6 = variante(J["mal_2_pellizco_15_a_50"], os.path.join(W, "d6", "junta.json"), junta=["soporte", "base"])
    rc, out, j, _ = gate(j6, "--hoy", FRENO)
    base = [p for p in (j or {}).get("pares", []) if p["par"] == ["palanca", "base"]]
    check("D6", "mal_2 con junta [soporte, base]: la base cambia de luz (55 a 15), se juzga como comun y sigue rojo",
          j and j["veredicto"] == "rojo" and base and base[0]["clase"] == "comun" and "no es soporte" in
          base[0].get("nota", ""), out, "clase %s" % (base and base[0]["clase"]))
    check("D6", "la luz contra la junta de verdad (soporte, 2 mm constante) se informa aparte",
          j and j["junta_informe"] and j["junta_informe"][0]["par"] == ["palanca", "soporte"]
          and abs(j["junta_informe"][0]["luz_min_mm"] - 2.0) <= 0.1, out, "junta %s" % (j and j["junta_informe"]))
    j6b = variante(J["bien"], os.path.join(W, "d6", "todo_junta.json"), junta=["soporte", "base"])
    rc, out, j, _ = gate(j6b, "--hoy", FRENO)
    check("D6", "bien con junta [soporte, base] (las dos de luz constante): no queda parte con luz -> NO MEDIDO",
          rc == 2 and j and j["medido"] is False and "ninguna parte con luz" in out, out, "exit %s" % rc)

    print("\nD7 NO MEDIDO nunca verde")
    d7 = os.path.join(W, "d7")
    os.makedirs(d7, exist_ok=True)
    trunc = os.path.join(d7, "palanca_truncada.step")
    data = open(os.path.join(W, "b06", "bien", "palanca_0_60__palanca.step"), "rb").read()
    open(trunc, "wb").write(data[: len(data) // 2])
    jt = variante(J["bien"], os.path.join(d7, "trunc.json"))
    with open(jt, encoding="utf-8") as f:
        d = json.load(f)
    d["archivos"]["palanca"] = trunc
    escribir_json(jt, d)
    rc, out, j, _ = gate(jt, "--workdir", os.path.join(d7, "w"))
    ev = workdir.find_evidence(os.path.join(d7, "w"), "barrido")
    check("D7", "STEP truncado -> exit 2 «STEP truncado» y evidencia medido:false",
          rc == 2 and "truncado" in out and ev and ev.get("medido") is False, out, "exit %s" % rc)
    from build123d import Shell, Solid
    caja = Pos(75, 0, 80) * Box(150, 20, 20)
    abierta = Shell(list(caja.faces())[:5])
    formas = [("cascara abierta (5 caras, sin solido)", abierta, "no trae solidos")]
    try:
        from OCP.BRepBuilderAPI import BRepBuilderAPI_MakeSolid
        formas.append(("solido armado con una cascara abierta",
                       Solid(BRepBuilderAPI_MakeSolid(abierta.wrapped).Solid()), "no es estanca"))
    except Exception as e:  # noqa: BLE001
        saltear("D7", "solido armado con una cascara abierta", "build123d no lo arma: %s" % e)
    for nombre, forma, texto in formas:
        ruta = os.path.join(d7, nombre.split()[0] + "_%d.step" % len(texto))
        export_step(forma, ruta)
        jm = variante(J["bien"], os.path.join(d7, "malla_%d.json" % len(texto)))
        with open(jm, encoding="utf-8") as f:
            d = json.load(f)
        d["archivos"]["palanca"] = ruta
        escribir_json(jm, d)
        rc, out, j, _ = gate(jm)
        check("D7", "%s -> exit 2 NO MEDIDO (un booleano vacio seria un «no choca» falso)" % nombre,
              rc == 2 and j and j["medido"] is False and ("no trae solidos" in out or "no es estanca" in out
                                                          or "no coincide" in out), out,
              "exit %s: %s" % (rc, (j or {}).get("motivo", "")[:90]))
    import trimesh
    caja_t = trimesh.creation.box((10.0, 10.0, 10.0))
    abierta_t = trimesh.Trimesh(caja_t.vertices, caja_t.faces[:-2], process=False)
    for nombre, (man, vol_occ), texto in (
            ("malla abierta (caja sin una cara)", (gb.a_manifold(abierta_t.vertices, abierta_t.faces), 1000.0),
             "no es estanca"),
            ("malla cerrada con volumen distinto del exacto (otra pieza)",
             (gb.a_manifold(caja_t.vertices, caja_t.faces), 1500.0), "no coincide")):
        try:
            gb._solido_valido(man, vol_occ, 600.0, 0.05, "'%s'" % nombre)
            ok, msg = False, "no levanto NoMedido"
        except gb.NoMedido as e:
            ok, msg = texto in str(e), str(e)
        check("D7", "%s -> NO MEDIDO «%s» antes de cualquier booleano" % (nombre, texto), ok, msg, msg[:90])
    for nombre, cambios in (("rango [0, 0]", {"rango_grados": [0, 0]}), ("rango ausente", {"rango_grados": None})):
        jr = variante(J["bien"], os.path.join(d7, "rango_%d.json" % len(nombre)), **cambios)
        rc, out, j, _ = gate(jr)
        check("D7", "%s -> exit 2 NO MEDIDO" % nombre, rc == 2 and j and j["medido"] is False and "rango" in out, out,
              "exit %s" % rc)
    rc, out, j, seg = gate(J["bien"], "--paso", "0.05", "--tope-seg", "0.3")
    check("D7", "--tope-seg 0.3 con --paso 0.05 -> exit 2 «NO MEDIDO: N de M poses en T s» (corta de verdad)",
          rc == 2 and j and j["medido"] is False and " de 1201 poses en " in out and seg < 60, out,
          "exit %s en %s s: %s" % (rc, seg, (j or {}).get("motivo", "")[:60]))
    angs = gb.poses_eje(0, 60, 2.5)
    est = [{"grados": a, "matrices": {"palanca": gb.rot_eje((0, 0, 80), (0, -1, 0), a).tolist()}} for a in angs]
    for nombre, pb, esperado in (("lazo que cierra (el punto del eje es fijo)", [0, 0, 80], 0),
                                 ("lazo con la biela +3 mm (no cierra)", [0, 0, 83], 2)):
        jl = variante(J["bien"], os.path.join(d7, "lazo_%d.json" % esperado), movil=None, eje=None, rango_grados=None,
                      estados=est, estados_etiqueta="grados",
                      lazos=[{"a": "palanca", "pa": [0, 0, 80], "b": "soporte", "pb": pb}])
        rc, out, j, _ = gate(jl, "--hoy", FRENO)
        check("D7", "%s -> exit %d" % (nombre, esperado),
              rc == esperado and (esperado == 2 and "no cierra" in out or esperado == 0 and j["veredicto"] == "verde"),
              out, "exit %s" % rc)
    import numpy as np
    esp = json.loads(json.dumps(est))
    M = np.asarray(esp[5]["matrices"]["palanca"])
    M[:3, 1] *= -1
    esp[5]["matrices"]["palanca"] = M.tolist()
    je = variante(J["bien"], os.path.join(d7, "espejo.json"), movil=None, eje=None, rango_grados=None, estados=esp)
    rc, out, j, _ = gate(je)
    check("D7", "una matriz en espejo (det -1, la palanca en espejo del 20/10) -> exit 2 «ESPEJO»",
          rc == 2 and "ESPEJO" in out, out, "exit %s" % rc)
    rc, out, j, _ = gate(J["mal_1_choca_a_35"], "--hoy", FRENO, env=ENV_REAL)
    check("D7", "--hoy sin CAD_GATE_TEST=1 no vale: NO MEDIDO (exit 2), no juzga con fecha falsa",
          rc == 2 and j and j["medido"] is False, out, "exit %s" % rc)

    print("\nD5 y D8 virolador real (%s)" % VIR)
    est_vir = os.path.join(VIR, "palanca_makerworld", "estados.json")
    PM = os.path.join(VIR, "palanca_makerworld", "catpart")
    arch = {"panel": os.path.join(os.path.dirname(VIR), "v14_choque", "panel_marco_local.step"),
            "parte_fija": os.path.join(VIR, "virolador_fijo.stp"),
            "pedestal": os.path.join(VIR, "pulido", "20_pedestal_palanca.stp"),
            "placa_v2": os.path.join(VIR, "pulido", "01_placa_v2.stp"),
            "barra": os.path.join(VIR, "pulido", "21_barra_apriete_v2b.stp")}
    for n in ("base_A", "base_B", "brazo_A", "brazo_B", "mango", "biela_1", "biela_2"):
        arch[n] = os.path.join(PM, "palanca_%s.stp" % n)
    hay_vir = os.path.isfile(est_vir) and all(os.path.isfile(r) for r in arch.values())
    if _ARGS.sin_virolador or not hay_vir:
        motivo = "--sin-virolador" if _ARGS.sin_virolador else "no esta el virolador en %s" % VIR
        for caso, nom in (("D5", "contacto declarado"), ("D8", "virolador real")):
            saltear(caso, nom, motivo)
    else:
        dv = os.path.join(W, "vir")

        def conj(nombre, partes, permitidos, estados=est_vir):
            return escribir_json(os.path.join(dv, nombre), {
                "partes": partes, "archivos": {p: arch[p] for p in partes}, "estados_archivo": estados,
                "estados_etiqueta": "mango_deg", "permitidos": permitidos,
                "nota": "virolador del 20/10/2026 (C:/Dev/_catia_practica/virolador_auto), las mismas piezas que "
                        "sim_rapida.py; armado por test_gate_barrido.py"})
        chico = ["pedestal", "base_A", "base_B", "mango"]
        rc, out, j, _ = gate(conj("d5_sin.json", chico, []), "--hoy", FRENO)
        ch = [c for c in (j or {}).get("choques") or [] if c["par"] == ["base_A", "pedestal"]]
        check("D5", "sin permitidos: base_A contra pedestal 0,062 mm3 constante (apoyo) -> rojo y FRENO",
              rc == 1 and ch and abs(ch[0]["mm3"] - 0.062) <= 0.005 and len(ch[0]["poses"]) == 65, out,
              "exit %s, %s" % (rc, ch and ch[0]["mm3"]))
        rc, out, j, _ = gate(conj("d5_con.json", chico, [["base_A", "pedestal"], ["base_B", "pedestal"]]),
                             "--hoy", FRENO)
        pi = [p for p in (j or {}).get("permitidos_informe") or [] if p["par"] == ["base_A", "pedestal"]]
        check("D5", "con permitidos [base_A, pedestal] y [base_B, pedestal]: sin choque ni contacto (no frena) y el "
              "contacto listado aparte", rc == 0 and j and not j["choques"] and not j["contactos"] and pi
              and pi[0]["toca"] and abs(pi[0]["choque_max_mm3"] - 0.062) <= 0.005, out,
              "exit %s, contacto aparte %s mm3" % (rc, pi and pi[0]["choque_max_mm3"]))
        rc, out, j, _ = gate(conj("d5_uno.json", chico, [["base_A", "pedestal"]]), "--hoy", FRENO)
        ct = [c for c in (j or {}).get("contactos") or [] if c["par"] == ["base_B", "pedestal"]]
        check("D5", "el mismo apoyo en un par no declarado (base_B contra pedestal, luz 0) -> rojo «TOCA»",
              rc == 1 and ct and "TOCA base_B-pedestal" in out, out, "exit %s" % rc)

        todas = ["panel", "parte_fija", "pedestal", "placa_v2", "base_A", "base_B", "brazo_A", "brazo_B", "mango",
                 "biela_1", "biela_2", "barra"]
        perm = [["base_A", "pedestal"], ["base_B", "pedestal"], ["barra", "panel"]]
        rc, out, j, seg = gate(conj("d8.json", todas, perm), "--hoy", FRENO)
        c142 = [c for c in (j or {}).get("curva", []) if c["pose"] == 142.0]
        check("D8", "virolador real, 65 estados (mismas piezas que sim_rapida): recorrido entero en menos de 2 minutos",
              j and j["medido"] is True and j["poses"] == 65 and j["segundos"] < 120, out,
              "%s poses en %s s (gate) / %s s (test)" % (j and j.get("poses"), j and j.get("segundos"), seg))
        check("D8", "sin choque ni contacto en pares no declarados; a 142 grados 0 mm3 como el exacto de sim_palanca",
              j and not j["choques"] and not j["contactos"] and c142 and c142[0]["choque_mm3"] == 0, out,
              "a 142: %s" % (c142 and c142[0]))
        luces = {tuple(p["par"]) for p in (j or {}).get("pellizcos") or []}
        check("D8", "P12: lista las luces que se cierran bajo el dedo entre palanca (mango, brazo) y su base",
              ("mango", "pedestal") in luces and ("brazo_A", "pedestal") in luces and j["modo"] == "aviso", out,
              "%d pares bajo el dedo" % len(luces))
        with open(est_vir, encoding="utf-8") as f:
            eg = json.load(f)
        eg["estados"][-1]["matrices"]["barra"][2][3] -= 2.0
        gem = escribir_json(os.path.join(dv, "estados_gemelo_barra_bajada_2mm.json"), eg)
        rc, out, j, _ = gate(conj("d8_gemelo.json", ["panel", "barra"], [["barra", "panel"]], estados=gem),
                             "--hoy", FRENO)
        ch = [c for c in (j or {}).get("choques") or [] if c["par"] == ["barra", "panel"]]
        check("D8", "gemelo barra bajada 2 mm en cerrado -> ~377,651 mm3 «barra contra panel» (rojo, aunque el par "
              "este permitido: se mete mas de 1 mm3)", rc == 1 and ch and abs(ch[0]["mm3"] - 377.651) <= 3.8, out,
              "exit %s, %s mm3" % (rc, ch and ch[0]["mm3"]))

    print("\nD9 salida con frase de Fak")
    w9 = os.path.join(W, "w9")
    for corta in ("ok", ""):
        rc, out, j, _ = gate(J["mal_1_choca_a_35"], "--hoy", FRENO, "--workdir", w9, "--acepto-barrido", corta)
        check("D9", "frase «%s» -> exit 1 «frase corta»" % corta, rc == 1 and "frase corta" in out, out,
              "exit %s" % rc)
    frase = "Fak lo vio: el travesano se corre en la v2"
    rc, out, j, _ = gate(J["mal_1_choca_a_35"], "--hoy", FRENO, "--workdir", w9, "--acepto-barrido", frase)
    ac = workdir.find_evidence(w9, "barrido_aceptado")
    check("D9", "con la frase -> exit 0 [ACEPTADO]; manifest con frase, fecha, firma del conjunto y pose peor",
          rc == 0 and "[ACEPTADO]" in out and ac and ac.get("frase") == frase and ac.get("fecha") == FRENO
          and ac.get("firma_conjunto") == j["firma_conjunto"] and (ac.get("pose_peor") or {}).get("pose") == 35.0,
          out, "aceptacion %s" % (ac and {k: ac.get(k) for k in ("fecha", "firma_conjunto", "pose_peor")}))
    rc, out, j, _ = gate(J["mal_3_choca_a_60"], "--hoy", FRENO, "--workdir", w9, "--acepto-barrido", frase)
    check("D9", "la misma frase sobre otro conjunto (otra firma) se niega (exit 1)",
          rc == 1 and "ya acepto otra version" in out, out, "exit %s" % rc)
    rc, out, j, _ = gate(J["mal_3_choca_a_60"], "--hoy", FRENO, "--workdir", w9, "--acepto-barrido",
                         "Fak miro la version del extremo: se acorta el recorrido")
    check("D9", "contraprueba: una frase nueva para la version nueva SI se acepta", rc == 0 and "[ACEPTADO]" in out,
          out, "exit %s" % rc)

    print("\nD10 cableado en export_deliverables.py")

    def wd_export(nombre, origen_json, conjunto_step=None):
        """Workdir con out/ = los STEP por parte + el json del conjunto + el STEP del conjunto que se entrega."""
        w = os.path.join(W, nombre)
        for d in ("in", "out", "renders", "cache"):
            os.makedirs(os.path.join(w, d), exist_ok=True)
        src = os.path.dirname(origen_json)
        for f in os.listdir(src):
            if f.endswith((".step", ".json")):
                shutil.copy2(os.path.join(src, f), os.path.join(w, "out", f))
        piece = os.path.join(w, "out", "palanca_0_60.step")
        if conjunto_step:
            shutil.copy2(conjunto_step, piece)
        workdir.ensure_workdir(w)
        workdir.record_evidence(w, "collision_check", fixture=os.path.basename(piece), n_inside=0,
                                contacto_ok=True, fixture_firma=workdir.file_signature(piece))
        png = os.path.join(w, "renders", "cualquiera.png")
        open(png, "wb").write(b"\x89PNG\r\n\x1a\n")
        os.utime(png, None)
        return w, piece, os.path.join(w, "out", "palanca_0_60.json")

    n_sol = {}

    def export(w, piece, destino, *extra, env=ENV_TEST):
        if piece not in n_sol:
            import export_deliverables as ed
            n_sol[piece] = ed._contar_solidos(piece)
        base = ["--workdir", w, "--pieces", piece, "--deliver", destino, "--ensamble",
                "%s:%d" % (os.path.splitext(os.path.basename(piece))[0], n_sol[piece]),
                "--skip-gate", "zona", "--skip-gate", "proceso", "--skip-gate", "ensamble", "--skip-gate", "cantos",
                "--reason", "test sintetico del gate de barrido"]
        return run([os.path.join(SCR, "export_deliverables.py")] + base + list(extra), env=env)

    def vacia(d):
        return not os.path.isdir(d) or not os.listdir(d)

    w10, p10, m10 = wd_export("w10", J["mal_1_choca_a_35"])
    d = os.path.join(w10, "entrega_freno")
    rc, out, _, _ = export(w10, p10, d, "--movimiento", m10, "--hoy", FRENO)
    check("D10", "mal_1 con --movimiento, --hoy 2026-11-02 -> SystemExit «[GATE barrido]» y D vacia",
          rc != 0 and "[GATE barrido]" in out and "choca palanca-base" in out and vacia(d), out,
          "exit %s, D vacia %s" % (rc, vacia(d)))
    d = os.path.join(w10, "entrega_aviso")
    rc, out, _, _ = export(w10, p10, d, "--movimiento", m10, "--hoy", AVISO)
    dl = workdir.find_evidence(w10, "delivery", dest=d)
    check("D10", "--hoy 2026-10-25 -> AVISO y entrega; la entrega deja el resultado del barrido en el manifest",
          rc == 0 and "AVISO [GATE barrido]" in out and "ENTREGA OK" in out and dl
          and (dl.get("barrido") or {}).get("modo") == "aviso", out, "exit %s" % rc)
    m = workdir.load_manifest(w10)
    m.setdefault("params", {})["movimiento"] = "out/palanca_0_60.json"
    workdir.save_manifest(w10, m)
    d = os.path.join(w10, "entrega_params")
    rc, out, _, _ = export(w10, p10, d, "--hoy", FRENO)
    check("D10", "el movimiento declarado en params.movimiento (pliego/manifest) tambien frena el 02/11",
          rc != 0 and "[GATE barrido]" in out and vacia(d), out, "exit %s" % rc)
    firma = gb.firma_conjunto(gb.leer_conjunto(m10, 2.5))[0]
    workdir.record_evidence(w10, "barrido", medido=True, veredicto="verde", firma_conjunto=firma, poses=25)
    d = os.path.join(w10, "entrega_sembrada")
    rc, out, _, _ = export(w10, p10, d, "--hoy", FRENO)
    check("D10", "evidencia sembrada verde con la firma correcta no vale: export corre el barrido y frena igual",
          rc != 0 and "[GATE barrido]" in out and vacia(d), out, "exit %s" % rc)
    rc, out, jv, _ = gate(m10, "--hoy", FRENO)
    completa = json.loads(json.dumps(jv))
    sembradas = {"sin poses": dict(completa, poses=None), "sin paso (sin guarda)": dict(completa, guarda=None),
                 "sin pares": dict(completa, pares=[]),
                 "con paso 60": dict(completa, guarda=dict(completa["guarda"], paso_grados=60.0, refinado=False,
                                                           corrimiento_ratio_max=15.7)),
                 "medido:false": dict(completa, medido=False), "de otra firma": dict(completa, firma_conjunto="bc-x")}
    malas = {k: gb.salida_barrido_valida(v, firma)[0] for k, v in sembradas.items()}
    check("D10", "la salida sin poses, sin paso, sin pares, con paso 60, medido:false o de otra firma se rechaza; la "
          "completa se acepta", not any(malas.values()) and gb.salida_barrido_valida(completa, firma)[0], "",
          "rechazadas %d de %d" % (sum(not x for x in malas.values()), len(malas)))
    w10b, p10b, m10b = wd_export("w10_bien_con_mal1", J["bien"],
                                 conjunto_step=os.path.join(os.path.dirname(J["mal_1_choca_a_35"]), "palanca_0_60.step"))
    d = os.path.join(w10b, "entrega")
    rc, out, _, _ = export(w10b, p10b, d, "--movimiento", m10b, "--hoy", FRENO)
    check("D10", "json de bien con el STEP del conjunto de mal_1 -> frena por solidos (no habla de lo que se entrega)",
          rc != 0 and "[GATE barrido]" in out and "no son los de las partes" in out and vacia(d), out, "exit %s" % rc)
    w10c, p10c, m10c = wd_export("w10_bien", J["bien"])
    d = os.path.join(w10c, "entrega")
    rc, out, _, _ = export(w10c, p10c, d, "--movimiento", m10c, "--hoy", FRENO)
    check("D10", "contraprueba: bien con su json se entrega el 02/11 (OK)",
          rc == 0 and "[GATE barrido] palanca_0_60.json: OK" in out and not vacia(d), out, "exit %s" % rc)
    d = os.path.join(w10c, "entrega_fuera")
    rc, out, _, _ = export(w10c, p10c, d, "--movimiento", J["bien"], "--hoy", FRENO)
    check("D10", "el json que apunta a STEP fuera de out/ -> NO MEDIDO y frena el 02/11",
          rc != 0 and "no estan en out/" in out and vacia(d), out, "exit %s" % rc)
    w10d, p10d, _ = wd_export("w10_sin_mov", J["bien"])
    from build123d import Cylinder
    placa = Box(60, 40, 10) - Cylinder(5.2, 10)
    perno = Cylinder(5.0, 30)
    from build123d import Compound
    coax = os.path.join(w10d, "out", "bisagra.step")
    export_step(Compound(children=[placa, perno]), coax)
    workdir.record_evidence(w10d, "collision_check", fixture="bisagra.step", n_inside=0, contacto_ok=True,
                            fixture_firma=workdir.file_signature(coax))
    open(os.path.join(w10d, "renders", "otro.png"), "wb").write(b"\x89PNG\r\n\x1a\n")
    d = os.path.join(w10d, "entrega")
    rc, out, _, _ = export(w10d, coax, d, "--hoy", FRENO)
    check("D10", "placa con agujero R5,2 + perno R5 coaxial y sin movimiento declarado -> AVISA «¿se mueve?» y "
          "entrega (no frena, ni el 02/11)", rc == 0 and "se mueve?" in out and "ENTREGA OK" in out, out,
          "exit %s" % rc)
    d = os.path.join(w10d, "entrega_conj")
    rc, out, _, _ = export(w10d, p10d, d, "--hoy", FRENO)
    check("D10", "contraprueba: el conjunto del 06 (un solo cilindro, el cubo) sin movimiento no avisa",
          rc == 0 and "se mueve?" not in out, out, "exit %s" % rc)
    m = workdir.load_manifest(w10d)
    m.setdefault("params", {})["sin_movimiento"] = "bisagra soldada, no gira (test)"
    workdir.save_manifest(w10d, m)
    d = os.path.join(w10d, "entrega_sin_mov")
    rc, out, _, _ = export(w10d, coax, d, "--hoy", FRENO)
    check("D10", "con params.sin_movimiento (motivo) no avisa y deja el motivo",
          rc == 0 and "se mueve?" not in out and "sin movimiento declarado" in out, out, "exit %s" % rc)
    rc, out, _, _ = run([os.path.join(SCR, "export_deliverables.py"), "--workdir", w10, "--pieces", p10, "--deliver",
                         os.path.join(w10, "entrega_skip"), "--skip-gate", "barrido"])
    check("D10", "--skip-gate barrido sin --reason -> error", rc != 0 and "--skip-gate exige --reason" in out, out,
          "exit %s" % rc)
    d = os.path.join(w10, "entrega_skip_ok")
    rc, out, _, _ = export(w10, p10, d, "--skip-gate", "barrido", "--movimiento", m10, "--hoy", FRENO)
    dl = workdir.find_evidence(w10, "delivery", dest=d)
    check("D10", "contraprueba: --skip-gate barrido con --reason entrega y deja la huella",
          rc == 0 and dl and "barrido" in (dl.get("skipped_gates") or []), out, "exit %s" % rc)
    rc, out, _, _ = gate(m10, "--hoy", FRENO, "--workdir", w10, "--acepto-barrido",
                         "Fak: el travesano se saca en la v2, entregar igual")
    d = os.path.join(w10, "entrega_aceptada")
    rc, out, _, _ = export(w10, p10, d, "--movimiento", m10, "--hoy", FRENO)
    check("D10", "con la aceptacion de Fak para esa firma, la entrega pasa el 02/11 (ACEPTADO)",
          rc == 0 and "ACEPTADO" in out and not vacia(d), out, "exit %s" % rc)
    rc, out, _, _ = export(w10c, p10c, os.path.join(w10c, "entrega_real"), "--movimiento", m10c, "--hoy", FRENO,
                           env=ENV_REAL)
    check("D10", "--hoy sin CAD_GATE_TEST=1 en la entrega -> error", rc != 0 and "CAD_GATE_TEST" in out, out,
          "exit %s" % rc)

    print("\n| caso | resultado | evidencia |\n|---|---|---|")
    for caso, nombre, res, evid in filas:
        print("| %s %s | %s | %s |" % (caso, nombre, res, evid))
    print("\n" + ("TODOS LOS CONTROLES DAN LO ESPERADO" if not fallos else "FALLARON: %s" % ", ".join(fallos)))
    print("carpeta del test: %s" % W)
    return 1 if fallos else 0


if __name__ == "__main__":
    sys.exit(main())
