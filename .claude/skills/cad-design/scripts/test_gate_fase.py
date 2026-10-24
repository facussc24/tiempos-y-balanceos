# -*- coding: utf-8 -*-
"""Casos F1 a F7 del gate de fases con criterio de salida (gate 3f, 24/10/2026) — test de regresion, no de humo.

Correr:  .venv-cad\\Scripts\\python.exe -I test_gate_fase.py [--out <carpeta>] [--sin-cantos]

Los casos los escribio un critico ANTES del gate (viernes-23-plan-sistema/banco3d-material/casos_gates_3c_3f.md,
tabla 3f). Cada control se prueba en las DOS direcciones: el caso que tiene que dar rojo da rojo, y el legitimo pasa.
Las piezas son las del banco (evals/banco3d/ejercicios/06_palanca_0_60 y 09_gate_cantos), armadas con sus propios
scripts en una carpeta nueva, mas algunas sinteticas armadas aca con build123d (medidas de ensayo, no son de Barack).
F7 mira tambien los dos STEP reales del virolador del 20/10 (C:/Dev/_catia_practica/virolador_auto/animacion, local,
no versionado; si no estan, se saltea con aviso). La fecha se simula con --hoy, que solo vale con CAD_GATE_TEST=1. Va
en scripts/ como test_gate_cantos.py y test_gate_barrido.py (la skill no tiene tests/).

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
VIR = "C:/Dev/_catia_practica/virolador_auto/animacion"
PY = sys.executable
_ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
_ap.add_argument("--out", default=None, help="carpeta donde armar las piezas y los workdirs del test")
_ap.add_argument("--sin-cantos", action="store_true", help="saltear el cierre de la fase 3 con cantos reales (~1 min)")
_ARGS = _ap.parse_args()
W = os.path.join(_ARGS.out or tempfile.gettempdir(), "test_gate_fase_%s" % time.strftime("%Y%m%d_%H%M%S"))
ENV_TEST = {**os.environ, "PYTHONIOENCODING": "utf-8", "CAD_GATE_TEST": "1"}
ENV_REAL = {k: v for k, v in os.environ.items() if k not in ("CAD_GATE_TEST", "CAD_HOY")}
ENV_REAL["PYTHONIOENCODING"] = "utf-8"
GATE = os.path.join(SCR, "gate_fase.py")
FRENO, AVISO = "2026-11-02", "2026-10-25"
OK0 = "Fak 24/10: el contrato y la zona estan bien, segui"
NOTA1 = "concepto: palanca con eje fijo; descartadas la corredera y el excentrico"


def run(args, env=ENV_TEST, timeout=900):
    t0 = time.time()
    p = subprocess.run([PY, "-I"] + args, capture_output=True, text=True, encoding="utf-8", errors="replace",
                       env=env, timeout=timeout)
    out = (p.stdout or "") + (p.stderr or "")
    j = None
    for linea in reversed((p.stdout or "").splitlines()):
        if linea.startswith('{"gate": "fase"'):
            j = json.loads(linea)
            break
    return p.returncode, out, j, round(time.time() - t0, 1)


def fase(*args, **kw):
    return run([GATE] + list(args), **kw)


def armar(ej, script, carpeta, nombre):
    rc, out, _, _ = run([os.path.join(EJ, ej, script), carpeta])
    if rc != 0:
        raise SystemExit("no se pudo armar %s/%s: %s" % (ej, script, out[-500:]))
    return os.path.join(carpeta, nombre)


def leer(w):
    with open(os.path.join(w, "fases.json"), encoding="utf-8") as f:
        return json.load(f)


def main():
    from cadlib import workdir
    from build123d import Box, Compound, Pos, export_step, import_step
    os.makedirs(W, exist_ok=True)
    fallos, filas = [], []

    def check(caso, nombre, cond, detalle, evidencia=""):
        print(("  [OK]    " if cond else "  [FALLA] ") + "%s %s" % (caso, nombre))
        filas.append((caso, nombre, "OK" if cond else "FALLA", evidencia))
        if not cond:
            fallos.append("%s %s" % (caso, nombre))
            print("          " + str(detalle).strip()[-1500:].replace("\n", "\n          "))

    def saltear(caso, nombre, motivo):
        print("  [SALTEA] %s %s: %s" % (caso, nombre, motivo))
        filas.append((caso, nombre, "SALTEADO", motivo))

    print("armando las piezas del banco en %s ..." % W)
    J = {s: armar("06_palanca_0_60", s + ".py", os.path.join(W, "b06", s), "palanca_0_60.json")
         for s in ("bien", "mal_1_choca_a_35")}

    def wd(nombre, origen_json=J["bien"]):
        """Workdir con out/ = los STEP del 06 (por parte y el del conjunto) + el json; GATE 0 y P sembrados (la fase 0
        lee la evidencia; zona y pliego se prueban en sus propios tests); colision y render para la entrega."""
        w = os.path.join(W, nombre)
        for d in ("in", "out", "renders", "cache"):
            os.makedirs(os.path.join(w, d), exist_ok=True)
        src = os.path.dirname(origen_json)
        for f in os.listdir(src):
            if f.endswith((".step", ".json")):
                shutil.copy2(os.path.join(src, f), os.path.join(w, "out", f))
        workdir.ensure_workdir(w)
        workdir.record_evidence(w, "zona_confirmada", quien="Fak", ids=["A1"], evidencia="render_test.png")
        workdir.record_evidence(w, "proceso_declarado", no_resueltas=[])
        piece = os.path.join(w, "out", "palanca_0_60.step")
        workdir.record_evidence(w, "collision_check", fixture=os.path.basename(piece), n_inside=0,
                                contacto_ok=True, fixture_firma=workdir.file_signature(piece))
        png = os.path.join(w, "renders", "cualquiera.png")
        open(png, "wb").write(b"\x89PNG\r\n\x1a\n")
        return w, piece, os.path.join(w, "out", "palanca_0_60.json")

    def cerrar_hasta_2(w, piece, mov, ok2):
        r = [fase("iniciar", "--workdir", w)]
        r.append(fase("cerrar", "--fase", "0", "--workdir", w, "--ok-fak", OK0, "--hoy", FRENO))
        r.append(fase("cerrar", "--fase", "1", "--workdir", w, "--nota", NOTA1, "--hoy", FRENO))
        r.append(fase("cerrar", "--fase", "2", "--workdir", w, "--step", piece, "--movimiento", mov, "--ok-fak", ok2,
                      "--hoy", FRENO))
        return r

    def correr_soporte(w, dy=0.5):
        """El soporte del eje corrido dy en Y: se reescriben su STEP y el del conjunto (mismos nombres)."""
        o = os.path.join(w, "out")
        # el Compound que devuelve import_step no se puede volver a exportar ("Failed to write STEP file", medido el
        # 24/10): se exportan sus solidos
        partes = {}
        for p in ("base", "soporte", "palanca"):
            sol = import_step(os.path.join(o, "palanca_0_60__%s.step" % p)).solids()
            partes[p] = sol[0] if len(sol) == 1 else Compound(children=list(sol))
        partes["soporte"] = Pos(0, dy, 0) * partes["soporte"]
        export_step(partes["soporte"], os.path.join(o, "palanca_0_60__soporte.step"))
        export_step(Compound(children=[partes["base"], partes["soporte"], partes["palanca"]]),
                    os.path.join(o, "palanca_0_60.step"))

    def medir(step):
        s = import_step(step)
        bb = s.bounding_box()
        return (round(bb.min.X, 3), round(bb.min.Y, 3), round(bb.min.Z, 3), round(bb.max.X, 3), round(bb.max.Y, 3),
                round(bb.max.Z, 3)), round(sum(x.volume for x in s.solids()), 2), len(s.solids())

    print("\nAUTOTEST")
    rc, out, _, _ = fase("--solo-autotest")
    check("F0", "--solo-autotest: el par BIEN/MAL propio separa (exit 0)", rc == 0 and "AUTOTEST OK" in out, out,
          "exit %s" % rc)
    codigo = ("import sys; sys.path.insert(0, %r); import gate_fase as gf; "
              "gf.evaluar_pasar = lambda *a, **k: {'ok': True, 'motivos': [], 'reabiertas': [], 'firma': None, "
              "'step': None}; sys.exit(gf.main(['--solo-autotest']))" % SCR)
    rc, out, _, _ = run(["-c", codigo])
    check("F0", "gate forzado a dejar pasar todo -> el autotest lo caza y sale con 3",
          rc == 3 and "AUTOTEST FALLA" in out, out, "exit %s" % rc)
    codigo = ("import sys; sys.path.insert(0, %r); import gate_fase as gf; "
              "gf.evaluar_pasar = lambda *a, **k: {'ok': True, 'motivos': [], 'reabiertas': [], 'firma': None, "
              "'step': None}; sys.exit(gf.main(['pasar', '--fase', '3', '--workdir', %r]))" % (SCR, W))
    rc, out, _, _ = run(["-c", codigo])
    check("F0", "el autotest corre antes de cada pasar: con el gate forzado a dejar pasar todo, pasar --fase 3 sale "
          "con 3 y no juzga", rc == 3 and "AUTOTEST FALLA" in out and "No se juzga" in out, out, "exit %s" % rc)

    # ------------------------------------------------------------------------------------------------------------
    print("\nF1 verde: el 06 bien con barrido verde")
    w1, p1, m1 = wd("w1")
    r = cerrar_hasta_2(w1, p1, m1, "Fak 24/10: la palanca gira bien, cerra el mecanismo")
    check("F1", "iniciar, cerrar 0 (zona + pliego + OK), cerrar 1 (nota) y cerrar 2 (barrido corrido aca + OK): "
          "los cuatro verdes, aun en fecha de freno", all(x[0] == 0 and x[2] and x[2]["veredicto"] == "verde"
                                                          for x in r), "\n".join(x[1] for x in r),
          "exits %s" % [x[0] for x in r])
    d = leer(w1)
    c2 = d["fases"].get("2") or {}
    ev2 = c2.get("evidencia") or {}
    check("F1", "fases.json deja la fase 2 cerrada con la firma del STEP, la firma del conjunto del barrido, la fecha de "
          "su evidencia y el OK de Fak textual", c2.get("estado") == "cerrada" and c2.get("step_firma") ==
          workdir.file_signature(p1) and ev2.get("firma_conjunto", "").startswith("bc-") and ev2.get("barrido_fecha")
          and ev2.get("barrido_veredicto") == "verde" and (c2.get("ok_fak") or {}).get("frase", "").startswith("Fak"),
          json.dumps(c2, indent=1)[:1500], "firma %s, conjunto %s, %s poses" % (c2.get("step_firma"),
                                                                                ev2.get("firma_conjunto"),
                                                                                ev2.get("poses")))
    rc, out, j, _ = fase("pasar", "--fase", "3", "--workdir", w1, "--hoy", FRENO)
    check("F1", "pasar --fase 3 -> exit 0, verde, fase actual 3", rc == 0 and j and j["veredicto"] == "verde"
          and leer(w1).get("actual") == 3, out, "exit %s" % rc)
    w1b, p1b, m1b = wd("w1_sin_2")
    fase("iniciar", "--workdir", w1b)
    fase("cerrar", "--fase", "0", "--workdir", w1b, "--ok-fak", OK0, "--hoy", FRENO)
    fase("cerrar", "--fase", "1", "--workdir", w1b, "--nota", NOTA1, "--hoy", FRENO)
    rc, out, j, _ = fase("pasar", "--fase", "3", "--workdir", w1b, "--hoy", FRENO)
    check("F1", "contraprueba: el mismo conjunto sin cerrar la fase 2 -> pasar --fase 3 FRENA (exit 1)",
          rc == 1 and j and j["veredicto"] == "rojo" and "fase 2 (mecanismo) no esta cerrada" in out, out,
          "exit %s" % rc)
    rc, out, j, _ = fase("cerrar", "--fase", "2", "--workdir", w1b, "--step", p1b, "--movimiento", m1b, "--hoy", FRENO)
    check("F1", "cerrar la 2 sin el OK de Fak -> no se cierra (la fase 2 la cierra Fak)",
          rc == 1 and "falta --ok-fak" in out and (leer(w1b)["fases"].get("2") is None), out, "exit %s" % rc)
    rc, out, j, _ = fase("cerrar", "--fase", "2", "--workdir", w1b, "--step", p1b, "--movimiento", m1b, "--ok-fak", "ok",
                         "--hoy", FRENO)
    check("F1", "OK de Fak de 2 letras («ok») -> NO SE ACEPTA (frase corta)", rc == 1 and "frase corta" in out, out,
          "exit %s" % rc)
    w1c, p1c, m1c = wd("w1_mal1", J["mal_1_choca_a_35"])
    fase("iniciar", "--workdir", w1c)
    fase("cerrar", "--fase", "0", "--workdir", w1c, "--ok-fak", OK0, "--hoy", AVISO)
    fase("cerrar", "--fase", "1", "--workdir", w1c, "--nota", NOTA1, "--hoy", AVISO)
    rc, out, j, _ = fase("cerrar", "--fase", "2", "--workdir", w1c, "--step", p1c, "--movimiento", m1c, "--ok-fak",
                         "Fak 24/10: dale que anda", "--hoy", AVISO)
    check("F1", "mal_1 (choca a 35) con OK y en fecha de aviso -> exit 0 AVISO pero la fase 2 NO queda cerrada (un "
          "aviso nunca escribe un cierre)", rc == 0 and "AVISO" in out and j and j["veredicto"] == "rojo"
          and leer(w1c)["fases"].get("2") is None, out, "exit %s" % rc)

    # ------------------------------------------------------------------------------------------------------------
    print("\nF2 misma apariencia: el soporte corrido 0,5 mm en Y despues del barrido")
    w2, p2, m2 = wd("w2")
    ok2 = "Fak 24/10: el mecanismo esta perfecto, no lo toques"
    cerrar_hasta_2(w2, p2, m2, ok2)
    antes = medir(p2)
    correr_soporte(w2, 0.5)
    despues = medir(p2)
    check("F2", "bbox, volumen y numero de solidos del conjunto iguales antes y despues (un control por bbox no lo ve)",
          antes == despues, "%s vs %s" % (antes, despues), "bbox %s, vol %s, %d solidos" % antes)
    rc, out, j, _ = fase("pasar", "--fase", "3", "--workdir", w2, "--hoy", FRENO)
    c2 = leer(w2)["fases"]["2"]
    check("F2", "pasar --fase 3 -> exit 1 «el conjunto cambio despues del barrido (firma X, evidencia Y)»",
          rc == 1 and "el conjunto cambio despues del barrido (firma" in out and "evidencia" in out, out,
          "exit %s" % rc)
    check("F2", "seguir optimizando despues del OK = rojo: la fase 2 queda REABIERTA en fases.json y el mensaje cita la "
          "frase de Fak", "SEGUIR OPTIMIZANDO DESPUES DEL OK" in out and ok2 in out and c2.get("estado") == "reabierta"
          and j and j["reabiertas"] == [2], out, "estado %s" % c2.get("estado"))
    rc, out, j, _ = fase("pasar", "--fase", "3", "--workdir", w2, "--hoy", AVISO)
    check("F2", "la misma llamada en fecha de aviso -> exit 0 con AVISO y veredicto rojo",
          rc == 0 and "AVISO" in out and j and j["veredicto"] == "rojo", out, "exit %s" % rc)
    rc, out, j, _ = fase("cerrar", "--fase", "2", "--workdir", w2, "--step", p2, "--movimiento", m2, "--ok-fak", ok2,
                         "--hoy", FRENO)
    check("F2", "volver a cerrar la 2 con el MISMO OK de Fak -> NO SE ACEPTA (el OK no se hereda despues de un cambio)",
          rc == 1 and "ya cerro otra fase o version" in out and leer(w2)["fases"]["2"]["estado"] == "reabierta", out,
          "exit %s" % rc)
    rc, out, j, _ = fase("cerrar", "--fase", "2", "--workdir", w2, "--step", p2, "--movimiento", m2, "--ok-fak",
                         "Fak 24/10: con el soporte corrido tambien va", "--hoy", FRENO)
    rc2, out2, j2, _ = fase("pasar", "--fase", "3", "--workdir", w2, "--hoy", FRENO)
    check("F2", "contraprueba: barrido nuevo del conjunto vigente + OK nuevo -> cierra y pasa a la 3",
          rc == 0 and rc2 == 0 and j2 and j2["veredicto"] == "verde", out + out2, "exits %s, %s" % (rc, rc2))

    # ------------------------------------------------------------------------------------------------------------
    print("\nF3 reexportado identico")
    w3, p3, m3 = wd("w3")
    cerrar_hasta_2(w3, p3, m3, "Fak 24/10: mecanismo aprobado, segui con el detalle")
    f_antes = workdir.file_signature(p3)
    time.sleep(1.5)
    otra = os.path.join(W, "b06", "bien_otra_vez")
    armar("06_palanca_0_60", "bien.py", otra, "palanca_0_60.json")
    shutil.copy2(os.path.join(otra, "palanca_0_60.step"), p3)
    import gate_fase as gf
    d3 = leer(w3)["fases"]["2"]
    datos_iguales = gf._firma_datos(p3) == d3.get("step_datos")
    rc, out, j, _ = fase("pasar", "--fase", "3", "--workdir", w3, "--hoy", FRENO)
    check("F3", "DECISION: el mismo conjunto reexportado (la firma de archivo cambia por la hora del FILE_NAME) FRENA "
          "con la salida «volver a correr el barrido (menos de 2 minutos)»; nunca verde por nombre o fecha",
          workdir.file_signature(p3) != f_antes and rc == 1 and j and j["veredicto"] == "rojo"
          and "barrido" in out and "volver a correr" in out, out,
          "firma %s -> %s; datos del STEP iguales: %s" % (f_antes, workdir.file_signature(p3), datos_iguales))
    check("F3", "el mensaje dice que es un reexportado cuando los datos del STEP (sin la cabecera) son iguales",
          (not datos_iguales) or "es un reexportado" in out, out,
          "datos iguales %s" % datos_iguales)

    # ------------------------------------------------------------------------------------------------------------
    print("\nF4 sin partes moviles")
    w4 = os.path.join(W, "w4")
    workdir.ensure_workdir(w4)
    workdir.record_evidence(w4, "zona_confirmada", quien="Fak")
    workdir.record_evidence(w4, "proceso_declarado", no_resueltas=[])
    pos = os.path.join(w4, "out", "posicionador.step")
    export_step(Box(80, 60, 20) - Pos(0, 0, 5) * Box(40, 30, 10), pos)
    fase("iniciar", "--workdir", w4)
    fase("cerrar", "--fase", "0", "--workdir", w4, "--ok-fak", OK0, "--hoy", FRENO)
    fase("cerrar", "--fase", "1", "--workdir", w4, "--nota", "nido fijo con apoyo plano; descartado el volteador")
    rc, out, j, _ = fase("cerrar", "--fase", "2", "--workdir", w4, "--step", pos, "--ok-fak",
                         "Fak 24/10: el nido esta bien, no se mueve nada", "--hoy", FRENO)
    check("F4", "posicionador sin movimiento ni «sin partes moviles» declarado -> no cierra la 2 (exit 1 en freno)",
          rc == 1 and "falta declarar el movimiento" in out and leer(w4)["fases"].get("2") is None, out,
          "exit %s" % rc)
    rc, out, j, _ = fase("cerrar", "--fase", "2", "--workdir", w4, "--step", pos, "--sin-moviles",
                         "nido fijo, la pieza se apoya y no hay nada que gire", "--ok-fak",
                         "Fak 24/10: el nido esta bien, no se mueve nada", "--hoy", FRENO)
    c4 = leer(w4)["fases"].get("2") or {}
    rc2, out2, j2, _ = fase("pasar", "--fase", "3", "--workdir", w4, "--hoy", FRENO)
    check("F4", "con «sin partes moviles» y su motivo -> cierra la 2 (queda anotado el motivo) y pasa a la 3",
          rc == 0 and (c4.get("evidencia") or {}).get("sin_moviles", "").startswith("nido fijo") and rc2 == 0, out + out2,
          "exits %s, %s" % (rc, rc2))
    rc, out, j, _ = fase("cerrar", "--fase", "2", "--workdir", w4, "--step", pos, "--sin-moviles", "fijo",
                         "--ok-fak", "Fak 24/10: el nido esta bien, no se mueve nada", "--hoy", FRENO)
    check("F4", "«sin partes moviles» con motivo de 4 letras -> NO SE ACEPTA", rc == 1, out, "exit %s" % rc)
    w4b, p4b, m4b = wd("w4_reason")
    fase("iniciar", "--workdir", w4b)
    fase("cerrar", "--fase", "0", "--workdir", w4b, "--ok-fak", OK0, "--hoy", FRENO)
    fase("cerrar", "--fase", "1", "--workdir", w4b, "--nota", NOTA1, "--hoy", FRENO)
    rc, out, j, _ = fase("pasar", "--fase", "3", "--workdir", w4b, "--reason", "test: boceto para mostrar el concepto",
                         "--hoy", FRENO)
    d4 = leer(w4b)
    check("F4", "conjunto con movil y sin barrido + --reason -> pasa con huella en fases.json pero NO cierra la fase 2",
          rc == 0 and j and j["modo"] == "salteado" and d4["fases"].get("2") is None
          and any(h.get("resultado") == "salteado" for h in d4["historial"]), out, "exit %s" % rc)

    # ------------------------------------------------------------------------------------------------------------
    print("\nF5 NO MEDIDO: nunca cierra ni pasa")
    w5, p5, m5 = wd("w5")
    cerrar_hasta_2(w5, p5, m5, "Fak 24/10: anda el mecanismo, segui")
    import barrido as gb
    firma = gb.firma_conjunto(gb.leer_conjunto(m5, 2.5))[0]
    workdir.record_evidence(w5, "barrido", medido=True, veredicto="verde", firma_conjunto=firma, ok=True)
    rc, out, j, _ = fase("pasar", "--fase", "3", "--workdir", w5, "--hoy", FRENO)
    check("F5", "evidencia de barrido sembrada a mano (ok:true, sin poses ni guarda ni pares, firma correcta) -> "
          "NO MEDIDO (exit 2)", rc == 2 and j and j["veredicto"] == "no_medido" and "no valida" in out, out,
          "exit %s" % rc)
    m = workdir.load_manifest(w5)
    buena = [e for e in m["evidence"] if e.get("kind") == "barrido" and e.get("poses")][-1]
    workdir.record_evidence(w5, "barrido", **dict({k: v for k, v in buena.items() if k not in ("kind", "date")},
                                                  guarda=dict(buena["guarda"], paso_grados=60.0, refinado=False,
                                                              corrimiento_ratio_max=15.7)))
    rc, out, j, _ = fase("pasar", "--fase", "3", "--workdir", w5, "--hoy", FRENO)
    check("F5", "evidencia con paso 60 (la del --paso 60 que daba verde) -> NO MEDIDO (exit 2)",
          rc == 2 and "guarda" in out, out, "exit %s" % rc)
    w5b, p5b, m5b = wd("w5b")
    cerrar_hasta_2(w5b, p5b, m5b, "Fak 24/10: anda el mecanismo, segui")
    open(os.path.join(w5b, "manifest.json"), "w").write("{esto no es json")
    rc, out, j, _ = fase("pasar", "--fase", "3", "--workdir", w5b, "--hoy", FRENO)
    check("F5", "manifest ilegible -> NO MEDIDO (exit 2)", rc == 2 and "manifest.json ilegible" in out, out,
          "exit %s" % rc)
    w5c, p5c, m5c = wd("w5c")
    cerrar_hasta_2(w5c, p5c, m5c, "Fak 24/10: anda el mecanismo, segui")
    open(os.path.join(w5c, "fases.json"), "w").write("{roto")
    rc, out, j, _ = fase("pasar", "--fase", "3", "--workdir", w5c, "--hoy", FRENO)
    check("F5", "fases.json ilegible -> NO MEDIDO (exit 2) y no se sobreescribe",
          rc == 2 and "ilegible" in out and open(os.path.join(w5c, "fases.json")).read() == "{roto", out,
          "exit %s" % rc)
    w5d, p5d, m5d = wd("w5d")
    rc, out, j, _ = fase("pasar", "--fase", "3", "--workdir", w5d, "--hoy", FRENO)
    check("F5", "workdir sin fases.json -> NO MEDIDO (exit 2) en gate_fase (la entrega solo avisa: F7)",
          rc == 2 and "no tiene fases.json" in out, out, "exit %s" % rc)
    fase("iniciar", "--workdir", w5d)
    fase("cerrar", "--fase", "0", "--workdir", w5d, "--ok-fak", OK0, "--hoy", FRENO)
    fase("cerrar", "--fase", "1", "--workdir", w5d, "--nota", NOTA1, "--hoy", FRENO)
    rc, out, j, _ = fase("cerrar", "--fase", "2", "--workdir", w5d, "--step", os.path.join(w5d, "out", "no.step"),
                         "--movimiento", m5d, "--ok-fak", "Fak 24/10: anda el mecanismo, segui", "--hoy", FRENO)
    check("F5", "STEP ausente -> NO MEDIDO (exit 2), no cierra", rc == 2 and "no esta" in out
          and leer(w5d)["fases"].get("2") is None, out, "exit %s" % rc)
    with open(m5d, encoding="utf-8") as f:
        jm = json.load(f)
    jm["rango_grados"] = [0, 0]
    m_nulo = os.path.join(w5d, "out", "rango_nulo.json")
    with open(m_nulo, "w", encoding="utf-8") as f:
        json.dump(jm, f)
    rc, out, j, _ = fase("cerrar", "--fase", "2", "--workdir", w5d, "--step", p5d, "--movimiento", m_nulo, "--ok-fak",
                         "Fak 24/10: anda el mecanismo, segui", "--hoy", FRENO)
    check("F5", "barrido NO MEDIDO (rango [0, 0]) -> NO MEDIDO (exit 2), no cierra",
          rc == 2 and "NO MEDIDO" in out and leer(w5d)["fases"].get("2") is None, out, "exit %s" % rc)
    rc, out, j, _ = fase("pasar", "--fase", "3", "--workdir", w1, "--hoy", FRENO, env=ENV_REAL)
    check("F5", "--hoy sin CAD_GATE_TEST=1 -> NO MEDIDO (exit 2)", rc == 2 and "CAD_GATE_TEST" in out, out,
          "exit %s" % rc)
    wB, pB, mB = wd("w5_fabricado")
    with open(os.path.join(wB, "fases.json"), "w", encoding="utf-8") as f:
        json.dump({"version": 1, "actual": 3, "fases": {str(k): {"estado": "cerrada"} for k in range(4)}}, f)
    rc, out, j, _ = fase("pasar", "--fase", "4", "--workdir", wB, "--hoy", FRENO)
    check("F5", "fases.json armado a mano con {\"estado\": \"cerrada\"} de la 0 a la 3 y nada mas (caso B del revisor) "
          "-> pasar --fase 4 el 02/11 da NO MEDIDO (exit 2), nunca verde", rc == 2 and j and j["veredicto"] ==
          "no_medido" and "sin lo que escribe gate_fase.py cerrar" in out, out, "exit %s" % rc)
    wC, pC, mC = wd("w5_sin_ok")
    dC = leer(w1)
    dC["fases"]["2"].pop("ok_fak", None)
    with open(os.path.join(wC, "fases.json"), "w", encoding="utf-8") as f:
        json.dump(dC, f)
    rc, out, j, _ = fase("pasar", "--fase", "3", "--workdir", wC, "--hoy", FRENO)
    check("F5", "un cierre legitimo de la 2 al que se le borro a mano el OK de Fak -> NO MEDIDO (exit 2)",
          rc == 2 and "el OK de Fak con su frase" in out, out, "exit %s" % rc)
    rc, out, j, _ = fase("pasar", "--fase", "3", "--workdir", w1, "--hoy", FRENO)
    check("F5", "contraprueba: el cierre legitimo de la F1 (escrito por cerrar) sigue en verde (exit 0)",
          rc == 0 and j and j["veredicto"] == "verde", out, "exit %s" % rc)

    # ------------------------------------------------------------------------------------------------------------
    print("\nF6 salida: aviso, freno y la frase de Fak")
    w6, p6, m6 = wd("w6")
    fase("iniciar", "--workdir", w6)
    fase("cerrar", "--fase", "0", "--workdir", w6, "--ok-fak", OK0, "--hoy", AVISO)
    fase("cerrar", "--fase", "1", "--workdir", w6, "--nota", NOTA1, "--hoy", AVISO)
    rc, out, j, _ = fase("pasar", "--fase", "3", "--workdir", w6, "--step", p6, "--hoy", "2026-10-30")
    check("F6", "fase 2 sin barrido, el 30/10 -> exit 0 «AVISO» (veredicto rojo, freno desde 2026-10-31)",
          rc == 0 and "AVISO" in out and "2026-10-31" in out and j["veredicto"] == "rojo", out, "exit %s" % rc)
    rc, out, j, _ = fase("pasar", "--fase", "3", "--workdir", w6, "--step", p6, "--hoy", "2026-10-31")
    check("F6", "la misma el 31/10 -> exit 1 FRENO", rc == 1 and "FRENO" in out, out, "exit %s" % rc)
    rc, out, j, _ = fase("pasar", "--fase", "3", "--workdir", w6, "--step", p6, "--acepto-fase", "ok", "--hoy", FRENO)
    check("F6", "--acepto-fase «ok» -> NO SE ACEPTA (frase corta)", rc == 1 and "frase corta" in out, out,
          "exit %s" % rc)
    frase = "Fak 24/10: paso al detalle, el barrido lo hago con la v2"
    rc, out, j, _ = fase("pasar", "--fase", "3", "--workdir", w6, "--step", p6, "--acepto-fase", frase, "--hoy", FRENO)
    ac = [x for x in leer(w6)["aceptaciones"] if x.get("frase") == frase]
    check("F6", "--acepto-fase con la frase -> exit 0 ACEPTADO; fases.json deja fase, firma, frase y fecha",
          rc == 0 and "[ACEPTADO]" in out and ac and ac[0]["fase"] == 3 and ac[0]["step_firma"] ==
          workdir.file_signature(p6) and ac[0]["fecha"] == FRENO, out, "exit %s" % rc)
    rc, out, j, _ = fase("pasar", "--fase", "4", "--workdir", w6, "--step", p6, "--hoy", FRENO)
    check("F6", "aceptar pasar a la 3 no acepta la 4 (la 2 y la 3 siguen abiertas) -> exit 1",
          rc == 1 and "FRENO" in out, out, "exit %s" % rc)
    rc, out, j, _ = fase("pasar", "--fase", "4", "--workdir", w6, "--step", p6, "--acepto-fase", frase, "--hoy", FRENO)
    check("F6", "la misma frase para otra fase -> NO SE ACEPTA", rc == 1 and "ya acepto otra fase" in out, out,
          "exit %s" % rc)

    # ------------------------------------------------------------------------------------------------------------
    print("\nF7 cableado en export_deliverables.py y caso real")
    n_sol = {}

    def export(w, piece, destino, *extra, env=ENV_TEST):
        if piece not in n_sol:
            import export_deliverables as ed
            n_sol[piece] = ed._contar_solidos(piece)
        base = ["--workdir", w, "--pieces", piece, "--deliver", destino, "--ensamble",
                "%s:%d" % (os.path.splitext(os.path.basename(piece))[0], n_sol[piece]),
                "--skip-gate", "ensamble", "--skip-gate", "cantos", "--reason", "test sintetico del gate de fases"]
        return run([os.path.join(SCR, "export_deliverables.py")] + base + list(extra), env=env)

    def vacia(d):
        return not os.path.isdir(d) or not os.listdir(d)

    w7, p7, m7 = wd("w7")
    cerrar_hasta_2(w7, p7, m7, "Fak 24/10: el mecanismo va, segui al detalle")
    rc, out, j, _ = fase("cerrar", "--fase", "3", "--workdir", w7, "--step", p7, "--acepto-fase",
                         "Fak 24/10: los cantos del ensayo los miro yo en la pieza", "--hoy", FRENO)
    c3 = leer(w7)["fases"]["3"]
    check("F7", "cerrar 3 sin zona de mano: los cantos corren de verdad sobre el conjunto y la fase cierra con AVISO "
          "(sin zona es aviso, como en la entrega); el --acepto-fase sobra y no se escribe",
          rc == 0 and c3["estado"] == "cerrada" and (c3.get("evidencia") or {}).get("cantos_estado") == "aviso sin zona"
          and "no hace falta" in out and not [x for x in leer(w7)["aceptaciones"] if int(x["fase"]) == 3], out,
          "exit %s, %s" % (rc, (c3.get("evidencia") or {}).get("aviso")))
    d = os.path.join(w7, "entrega_ok")
    rc, out, _, _ = export(w7, p7, d, "--movimiento", m7, "--hoy", FRENO)
    dl = workdir.find_evidence(w7, "delivery", dest=d)
    check("F7", "contraprueba: fases 0 a 3 cerradas y vigentes -> la entrega pasa el 02/11 y deja las fases en el "
          "manifest", rc == 0 and "[GATE fases] OK" in out and not vacia(d) and dl
          and (dl.get("fases") or {}).get("modo") == "verde", out, "exit %s" % rc)
    correr_soporte(w7, 0.5)
    m = workdir.load_manifest(w7)
    workdir.record_evidence(w7, "collision_check", fixture="palanca_0_60.step", n_inside=0, contacto_ok=True,
                            fixture_firma=workdir.file_signature(p7))
    open(os.path.join(w7, "renders", "otra.png"), "wb").write(b"\x89PNG\r\n\x1a\n")
    d = os.path.join(w7, "entrega_retocada")
    rc, out, _, _ = export(w7, p7, d, "--movimiento", m7, "--hoy", FRENO)
    check("F7", "el conjunto retocado despues de cerrar la fase (soporte 0,5 mm) -> SystemExit «[GATE fases]» con «despues "
          "del OK» y D vacia (el barrido de la entrega sigue verde: no lo ve)", rc != 0 and "[GATE fases]" in out
          and "DESPUES DEL OK" in out and "[GATE barrido] palanca_0_60.json: OK" in out and vacia(d), out,
          "exit %s, D vacia %s" % (rc, vacia(d)))
    d = os.path.join(w7, "entrega_retocada_aviso")
    rc, out, _, _ = export(w7, p7, d, "--movimiento", m7, "--hoy", AVISO)
    check("F7", "la misma entrega el 25/10 -> AVISO [GATE fases] y entrega", rc == 0 and "AVISO [GATE fases]" in out
          and "ENTREGA OK" in out, out, "exit %s" % rc)
    rc, out, _, _ = run([os.path.join(SCR, "export_deliverables.py"), "--workdir", w7, "--pieces", p7, "--deliver",
                         os.path.join(w7, "entrega_skip"), "--skip-gate", "fases"])
    check("F7", "--skip-gate fases sin --reason -> error", rc != 0 and "--skip-gate exige --reason" in out, out,
          "exit %s" % rc)
    d = os.path.join(w7, "entrega_skip_ok")
    rc, out, _, _ = export(w7, p7, d, "--skip-gate", "fases", "--movimiento", m7, "--hoy", FRENO)
    dl = workdir.find_evidence(w7, "delivery", dest=d)
    check("F7", "contraprueba: --skip-gate fases con --reason entrega y deja la huella",
          rc == 0 and dl and "fases" in (dl.get("skipped_gates") or []), out, "exit %s" % rc)
    rc, out, j, _ = fase("pasar", "--fase", "4", "--workdir", w7, "--step", p7, "--acepto-fase",
                         "Fak 24/10: el soporte corrido lo apruebo, entregar", "--hoy", FRENO)
    d = os.path.join(w7, "entrega_aceptada")
    rc2, out2, _, _ = export(w7, p7, d, "--movimiento", m7, "--hoy", FRENO)
    check("F7", "con la aceptacion de Fak para pasar a la 4 con esa firma, la entrega pasa el 02/11 (ACEPTADO)",
          rc == 0 and rc2 == 0 and "ACEPTADO por Fak en fases.json" in out2 and not vacia(d), out + out2,
          "exits %s, %s" % (rc, rc2))
    d = os.path.join(w6, "entrega_20_10")
    rc, out, _, _ = export(w6, p6, d, "--movimiento", m6, "--hoy", FRENO)
    check("F7", "la secuencia del 20/10 (entrega con el mecanismo sin cerrar: solo hay una aceptacion de pasar a la 3) "
          "-> SystemExit «[GATE fases]» y D vacia", rc != 0 and "[GATE fases]" in out
          and "fase 2 (mecanismo) no esta cerrada" in out and vacia(d), out, "exit %s" % rc)
    d = os.path.join(wB, "entrega_fabricada")
    rc, out, _, _ = export(wB, pB, d, "--movimiento", mB, "--hoy", FRENO)
    check("F7", "la entrega del 02/11 con el fases.json armado a mano (caso B del revisor) -> SystemExit «[GATE fases]» "
          "NO MEDIDO y D vacia (antes salia ENTREGA OK)", rc != 0 and "[GATE fases]" in out and "NO MEDIDO" in out
          and vacia(d), out, "exit %s, D vacia %s" % (rc, vacia(d)))
    wE, pE, mE = wd("w7_acepta_pieza")
    fase("iniciar", "--workdir", wE)
    fase("cerrar", "--fase", "0", "--workdir", wE, "--ok-fak", OK0, "--hoy", FRENO)
    fase("cerrar", "--fase", "1", "--workdir", wE, "--nota", NOTA1, "--hoy", FRENO)
    frase_e = "Fak 24/10: entregar asi, el mecanismo lo cierro en la v2"
    rc, out, j, _ = fase("pasar", "--fase", "4", "--workdir", wE, "--acepto-fase", frase_e, "--hoy", FRENO)
    check("F7", "--acepto-fase para la 4 sin ningun cierre con STEP y sin --step -> NO MEDIDO (la aceptacion necesita "
          "una firma)", rc == 2 and "ninguna fase cerro con STEP" in out, out, "exit %s" % rc)
    rc, out, j, _ = fase("pasar", "--fase", "4", "--workdir", wE, "--step", pE, "--acepto-fase", frase_e,
                         "--hoy", FRENO)
    d = os.path.join(wE, "entrega")
    rc2, out2, _, _ = export(wE, pE, d, "--movimiento", mE, "--hoy", FRENO)
    check("F7", "sin cierre con STEP y una sola pieza: la entrega usa la firma de esa pieza y reconoce la aceptacion de "
          "la 4 (ACEPTADO el 02/11)", rc == 0 and rc2 == 0 and "ACEPTADO por Fak en fases.json" in out2
          and not vacia(d), out + out2, "exits %s, %s" % (rc, rc2))
    w7b, p7b, m7b = wd("w7_sin_fases")
    d = os.path.join(w7b, "entrega")
    rc, out, _, _ = export(w7b, p7b, d, "--movimiento", m7b, "--hoy", FRENO)
    check("F7", "workdir viejo sin fases.json -> AVISA «sin fases declaradas» y entrega el 02/11 (compatibilidad)",
          rc == 0 and "sin fases declaradas" in out and "ENTREGA OK" in out, out, "exit %s" % rc)
    c_real = os.path.join(VIR, "conjunto_cerrado.stp")
    c_ctrl = os.path.join(VIR, "conjunto_cerrado_control.stp")
    if os.path.isfile(c_real) and os.path.isfile(c_ctrl):
        w7c = os.path.join(W, "w7_virolador")
        workdir.ensure_workdir(w7c)
        workdir.record_evidence(w7c, "zona_confirmada", quien="Fak")
        workdir.record_evidence(w7c, "proceso_declarado", no_resueltas=[])
        fase("iniciar", "--workdir", w7c)
        fase("cerrar", "--fase", "0", "--workdir", w7c, "--ok-fak", OK0, "--hoy", FRENO)
        fase("cerrar", "--fase", "1", "--workdir", w7c, "--nota", "virolador de cuatro barras (caso real del 20/10)")
        rc, out, j, _ = fase("cerrar", "--fase", "2", "--workdir", w7c, "--step", c_real, "--acepto-fase",
                             "test: el mecanismo de la version de las 12:20", "--hoy", FRENO)
        rc3, out3, j3, _ = fase("pasar", "--fase", "3", "--workdir", w7c, "--step", c_real, "--hoy", FRENO)
        rc2, out2, j2, _ = fase("pasar", "--fase", "3", "--workdir", w7c, "--step", c_ctrl, "--hoy", FRENO)
        check("F7", "virolador real: la fase 2 cerrada sobre conjunto_cerrado.stp (12:20) no vale para "
              "conjunto_cerrado_control.stp (15:27) -> exit 1; contraprueba con el de las 12:20 -> exit 0",
              rc == 0 and rc2 == 1 and "es otro" in out2 and rc3 == 0, out + out2 + out3,
              "exits %s, %s, %s" % (rc, rc2, rc3))
    else:
        saltear("F7", "virolador real (conjunto_cerrado.stp vs conjunto_cerrado_control.stp)", "no estan en %s" % VIR)
    saltear("F7", "catia_base (por donde se diseno el 20/10)", "NO CUBIERTO: catia_base.py no llama al gate todavia "
            "(faseCanon no_cubierto); no se abre CATIA en este test")

    # ------------------------------------------------------------------------------------------------------------
    print("\nfase 3 con los cantos medidos de verdad y fase 4")
    if _ARGS.sin_cantos:
        saltear("F1", "cerrar 3 con los cantos del 09", "--sin-cantos")
    else:
        for nombre, script, esperado in (("bien", "bien.py", 0), ("mal", "mal_1_canto_vivo_arriba.py", 1)):
            carpeta = os.path.join(W, "b09", nombre)
            rc, out, _, _ = run([os.path.join(EJ, "09_gate_cantos", script), carpeta])
            stp = [os.path.join(carpeta, f) for f in os.listdir(carpeta) if f.endswith(".step")][0]
            w9 = os.path.join(W, "w9_%s" % nombre)
            workdir.ensure_workdir(w9)
            workdir.record_evidence(w9, "zona_confirmada", quien="Fak")
            workdir.record_evidence(w9, "proceso_declarado", no_resueltas=[])
            m9 = workdir.load_manifest(w9)
            m9.setdefault("params", {})["zona_mano"] = [-31, -11, 12, 31, 11, 16]
            workdir.save_manifest(w9, m9)
            fase("iniciar", "--workdir", w9)
            fase("cerrar", "--fase", "0", "--workdir", w9, "--ok-fak", OK0, "--hoy", FRENO)
            fase("cerrar", "--fase", "1", "--workdir", w9, "--nota", "tope fijo de ensayo con la mano arriba")
            fase("cerrar", "--fase", "2", "--workdir", w9, "--step", stp, "--sin-moviles", "tope fijo, no se mueve",
                 "--ok-fak", "Fak 24/10: el tope en su lugar, segui", "--hoy", FRENO)
            rc, out, j, seg = fase("cerrar", "--fase", "3", "--workdir", w9, "--step", stp, "--hoy", FRENO)
            c3 = leer(w9)["fases"].get("3")
            check("F1", "cerrar 3 corre gate_aristas.py de verdad con la zona del manifest: tope del 09 %s -> exit %d"
                  % (nombre, esperado), rc == esperado and (bool(c3) == (esperado == 0)), out,
                  "exit %s en %s s; %s" % (rc, seg, (c3 or {}).get("evidencia")))
        rc, out, j, _ = fase("cerrar", "--fase", "4", "--workdir", os.path.join(W, "w9_bien"), "--hoy", FRENO)
        check("F1", "cerrar 4 sin una entrega --final despues del cierre de la 3 -> no cierra (exit 1)",
              rc == 1 and "no hay una entrega --final" in out, out, "exit %s" % rc)

    print("\n| caso | resultado | evidencia |\n|---|---|---|")
    for caso, nombre, res, evid in filas:
        print("| %s %s | %s | %s |" % (caso, nombre, res, evid))
    print("\n" + ("TODOS LOS CONTROLES DAN LO ESPERADO" if not fallos else "FALLARON: %s" % ", ".join(fallos)))
    print("carpeta del test: %s" % W)
    return 1 if fallos else 0


if __name__ == "__main__":
    sys.exit(main())
