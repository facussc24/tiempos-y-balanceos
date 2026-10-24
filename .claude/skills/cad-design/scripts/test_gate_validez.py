#!/usr/bin/env python
# -*- coding: utf-8 -*-
#   C:\Dev\BarackMercosul\.venv-cad\Scripts\python.exe test_gate_validez.py [--out <carpeta>] [--sin-reales]
"""Gate de validez del solido en la entrega (24/10/2026; control 1.1 de la decision de revision de diseno) en las dos
direcciones: el caso que tiene que dar rojo da rojo y el legitimo da verde (un gate que rechaza todo tambien es ciego).

  ROJO   anillo sintetico de 40 x 20 con esquinas R2,22 y el borde interior retirado 2,55 punto a punto (se cruza: da
         is_valid NO, 04_decision.md l.26); la v13 real del virolador (C:\\Dev\\_utrim\\out\\v13, sha256 f398e2dc18c6d772...).
  VERDE  el MISMO contorno con un retiro de verdad (shapely.buffer); una caja sana; la v14 real (e3ee1ad262c16f02...).
  NO MEDIDO  un STEP que no existe, uno truncado, uno sin solidos, y --hoy sin CAD_GATE_TEST=1.
  VERDE CON AVISO  solidos validos y triangulos con sentido inconsistente: la caja con una malla volteada (en proceso) y
         la TUERCA baja 5mm real de la nube (gate suelto; sha256 c31db4486e848049..., BANCO3D_TUERCA para otra ruta).

La fecha se simula con --hoy, que solo vale con CAD_GATE_TEST=1: 31/10/2026 es el ultimo dia de aviso y 01/11 el primero
de freno. Va en scripts/ como test_gates_entrega.py (la skill no tiene tests/). Las piezas sinteticas salen de los
scripts del banco (evals/banco3d/ejercicios/24_solido_valido). Las dos reales tardan entre 60 y 90 s cada una en
mallarse: si no estan en C:\\Dev\\_utrim (o BANCO3D_UTRIM) con ese sha256, se saltean y lo dice; --sin-reales las saltea.

No borra nada: cada corrida usa una carpeta nueva con marca de tiempo."""
import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
RAIZ = os.path.normpath(os.path.join(AQUI, "..", "..", "..", ".."))
EJ = os.path.join(RAIZ, "evals", "banco3d", "ejercicios", "24_solido_valido")
PY = sys.executable
ED = os.path.join(AQUI, "export_deliverables.py")
UTRIM = os.environ.get("BANCO3D_UTRIM", r"C:\Dev\_utrim")
REALES = {"v13": (os.path.join("out", "v13", "virolador_v10_two.step"), "f398e2dc18c6d772"),
          "v14": (os.path.join("out", "v14", "virolador_v10_two.step"), "e3ee1ad262c16f02")}
# una de las 4 tuercas sanas de la nube con el sentido de los triangulos inconsistente (is_valid SI): el caso del AVISO
TUERCA = (os.environ.get("BANCO3D_TUERCA", os.path.join(
    os.path.expanduser("~"), "BARACK ARGENTINA SRL", "Ingeniería y Proyecto - General", "INGENIERIA BARACK (NUNCA BORRAR)",
    "1- GENERAL", "5. 3D", "Tornillo y tuerca impresos - pin dispositivo TRA-IZQ", "FUENTE (STEP para modificar)",
    "TUERCA baja 5mm.step")), "c31db4486e848049")

_ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
_ap.add_argument("--out", default=None, help="carpeta donde armar las piezas y los workdirs del test")
_ap.add_argument("--sin-reales", action="store_true", help="saltear la v13 y la v14 reales (tardan unos 3 minutos)")
_ARGS = _ap.parse_args()
W = os.path.join(_ARGS.out or tempfile.gettempdir(), "test_gate_validez_%s" % time.strftime("%Y%m%d_%H%M%S"))
ENV_TEST = {**os.environ, "PYTHONIOENCODING": "utf-8", "CAD_GATE_TEST": "1"}
ENV_REAL = {k: v for k, v in os.environ.items() if k not in ("CAD_GATE_TEST", "CAD_HOY")}
ENV_REAL["PYTHONIOENCODING"] = "utf-8"

fallos = []
saltos = []


def chequear(cond, msg, detalle=""):
    print("   %s  %s" % ("ok  " if cond else "FALLA", msg))
    if not cond:
        fallos.append(msg)
        if detalle:
            print("          " + str(detalle).strip()[-900:].replace("\n", "\n          "))


def run(args, env=ENV_TEST, timeout=1800):
    p = subprocess.run([PY] + args, capture_output=True, text=True, encoding="utf-8", errors="replace", env=env,
                       timeout=timeout)
    out = (p.stdout or "") + (p.stderr or "")
    j = None
    for linea in reversed((p.stdout or "").splitlines()):
        if linea.startswith('{"gate": "validez"'):
            j = json.loads(linea)
            break
    return p.returncode, out, j


def validez(*args, **kw):
    return run([ED, "validez"] + list(args), **kw)


def armar_banco(script, carpeta):
    rc, out, _ = run([os.path.join(EJ, script), carpeta])
    if rc != 0:
        raise SystemExit("no se pudo armar %s: %s" % (script, out[-500:]))


def armar_codigo(codigo, carpeta):
    """Arma una pieza con un trozo de codigo que usa los helpers del ejercicio 24 (la carpeta sale por sys.argv[1])."""
    cab = "import sys; sys.argv = ['x', %r]; sys.path[:0] = [%r, %r]\n" % (carpeta, EJ, os.path.dirname(EJ))
    rc, out, _ = run(["-I", "-c", cab + codigo])
    if rc != 0:
        raise SystemExit("no se pudo armar la pieza: %s" % out[-500:])


def main():
    import trimesh  # noqa: F401  (el gate lo usa; falla aca y no a mitad del test si falta)
    import export_deliverables as ED_mod
    from cadlib import workdir
    os.makedirs(W, exist_ok=True)
    print("armando las piezas sinteticas en %s ..." % W)
    p_mal, p_bien, p_caja, p_cara = (os.path.join(W, d) for d in ("mal", "bien", "caja", "cara"))
    armar_banco("mal_2_anillo_sintetico.py", p_mal)
    armar_codigo("from _anillo import armar; armar(True, 'anillo_sano')", p_bien)
    armar_codigo("from _comun import carpeta_salida; from build123d import Box, export_step; import os\n"
                 "export_step(Box(40, 20, 10), os.path.join(carpeta_salida(), 'caja.step'))", p_caja)
    # una cara suelta: un STEP que abre bien pero no trae ningun solido
    armar_codigo("from _comun import carpeta_salida; from build123d import Rectangle, export_step; import os\n"
                 "export_step(Rectangle(10, 10), os.path.join(carpeta_salida(), 'cara.step'))", p_cara)
    mal = os.path.join(p_mal, "anillo_cruzado.step")
    sano = os.path.join(p_bien, "anillo_sano.step")
    caja = os.path.join(p_caja, "caja.step")
    cara = os.path.join(p_cara, "cara.step")
    truncado = os.path.join(W, "truncado.step")
    with open(mal, "rb") as f:
        datos = f.read()
    with open(truncado, "wb") as f:
        f.write(datos[: len(datos) // 2])
    inexistente = os.path.join(W, "no_existe.step")

    print("\nV0 el canon y la regla de fechas (31/10 ultimo dia de aviso, 01/11 primero de freno)")
    can = ED_mod.canon_validez()
    chequear(can["aviso_hasta"] == "2026-10-31" and int(can["frase_minima"]) >= 10,
             "validezCanon.data.json: aviso_hasta 2026-10-31 y frase de 10 caracteres o mas")
    chequear(all(k in can for k in ("fuente_de_la_falla", "limites_conocidos", "salidas")),
             "el canon trae la fuente de la falla, los limites conocidos y las salidas")
    from datetime import date
    hasta = date.fromisoformat(can["aviso_hasta"])
    m = ED_mod.modo_validez
    chequear(m(True, True, date(2026, 10, 31), hasta) == "aviso" and m(True, True, date(2026, 11, 1), hasta) == "freno",
             "rojo: 31/10 aviso, 01/11 freno")
    chequear(m(True, False, date(2026, 11, 2), hasta) == "verde", "verde: verde en cualquier fecha")
    chequear(m(True, True, date(2026, 11, 2), hasta, True) == "aceptado", "rojo con frase de Fak atada a la firma: aceptado")
    chequear(m(False, False, date(2026, 10, 25), hasta) == "aviso" and m(False, False, date(2026, 11, 2), hasta) == "freno"
             and m(False, False, date(2026, 11, 2), hasta, True) == "freno",
             "NO MEDIDO nunca da verde ni se acepta con frase: aviso hasta el 31/10 y freno desde el 01/11")

    print("\nV1 la medicion del STEP: is_valid de cada solido (en proceso, sin mallar)")
    n, malos = ED_mod.medir_solidos_step(mal)
    chequear(n == 1 and malos == [0], "anillo de 40 x 20 R2,22 retirado 2,55 punto a punto: 1 solido, is_valid NO",
             "solidos %s, invalidos %s" % (n, malos))
    n, malos = ED_mod.medir_solidos_step(sano)
    chequear(n == 1 and malos == [], "el mismo contorno con retiro de verdad (shapely.buffer): is_valid SI",
             "solidos %s, invalidos %s" % (n, malos))
    n, malos = ED_mod.medir_solidos_step(caja)
    chequear(n == 1 and malos == [], "caja de 40 x 20 x 10: is_valid SI", "solidos %s, invalidos %s" % (n, malos))
    for nombre, ruta, texto in (("STEP que no existe", inexistente, "no existe"), ("STEP truncado", truncado, "truncado"),
                                ("STEP sin solidos (una cara suelta)", cara, "no trae solidos")):
        try:
            r = ED_mod.medir_solidos_step(ruta)
            chequear(False, "%s: NO MEDIDO" % nombre, "midio %s" % (r,))
        except ED_mod.NoMedidoValidez as e:
            chequear(texto in str(e), "%s: NO MEDIDO («%s»)" % (nombre, e))

    print("\nV2 el gate suelto (export_deliverables.py validez) sobre el anillo cruzado: rojo, aviso hasta el 31/10")
    for hoy, rc_esp, modo in (("2026-10-25", 0, "aviso"), ("2026-10-31", 0, "aviso"), ("2026-11-01", 1, "freno"),
                              ("2026-11-02", 1, "freno")):
        rc, out, j = validez("--step", mal, "--hoy", hoy)
        chequear(rc == rc_esp and j and j["veredicto"] == "rojo" and j["modo"] == modo and j["medido"] is True
                 and j["solidos_invalidos"] == [0],
                 "--hoy %s -> exit %d, rojo, modo %s, solido 0 con is_valid NO" % (hoy, rc_esp, modo), out)
    chequear("freno desde 2026-11-01" in validez("--step", mal, "--hoy", "2026-10-25")[1],
             "el aviso dice desde cuando frena (2026-11-01)")
    rc, out, j = validez("--step", mal, "--hoy", "2026-11-02", env=ENV_REAL)
    chequear(rc == 2 and j and j["medido"] is False and j["veredicto"] == "no_medido",
             "--hoy sin CAD_GATE_TEST=1 no vale: NO MEDIDO (exit 2), no juzga con fecha falsa", out)

    print("\nV3 los gemelos sanos dan verde aun en fecha de freno")
    for nombre, ruta in (("el mismo anillo con retiro de verdad", sano), ("la caja de 40 x 20 x 10", caja)):
        rc, out, j = validez("--step", ruta, "--hoy", "2026-11-02")
        chequear(rc == 0 and j and j["veredicto"] == "verde" and j["medido"] is True and j["modo"] == "verde"
                 and j["sentido_consistente"] is True and j["malla_cerrada"] is True and j["solidos_invalidos"] == [],
                 "%s: verde (is_valid SI, malla cerrada, un solo sentido)" % nombre, out)

    print("\nV4 NO MEDIDO: nunca verde, ni siquiera en aviso")
    for nombre, ruta in (("STEP que no existe", inexistente), ("STEP truncado", truncado), ("STEP sin solidos", cara)):
        rc, out, j = validez("--step", ruta, "--hoy", "2026-10-25")
        chequear(rc == 2 and j and j["medido"] is False and j["veredicto"] == "no_medido" and j["no_medido"],
                 "%s -> exit 2, NO MEDIDO con su motivo" % nombre, out)

    print("\nV5 la salida de Fak: frase atada a la firma del STEP (patron de --acepto-cantos)")
    wd = workdir.ensure_workdir(os.path.join(W, "wd_acepto"))
    rc, out, j = validez("--step", mal, "--hoy", "2026-11-02", "--acepto-validez", "corta", "--workdir", wd)
    chequear(rc == 1 and "frase corta" in out, "una frase de menos de 10 caracteres no se acepta", out)
    rc, out, j = validez("--step", mal, "--hoy", "2026-11-02", "--acepto-validez", "Fak lo asume asi, ver el render")
    chequear(rc == 1 and "workdir" in out, "sin --workdir no se acepta (la aceptacion queda en el manifest)", out)
    chequear(workdir.find_evidence(wd, "validez_aceptada") is None, "lo rechazado no deja nada en el manifest")
    frase = "Fak lo asume asi, ver el render"
    rc, out, j = validez("--step", mal, "--hoy", "2026-11-02", "--acepto-validez", frase, "--workdir", wd)
    firma = workdir.file_signature(mal)
    ev = workdir.find_evidence(wd, "validez_aceptada", fixture=os.path.basename(mal), step_firma=firma)
    chequear(rc == 0 and j and j["modo"] == "aceptado" and j["veredicto"] == "rojo" and ev and ev["frase"] == frase
             and ev["fecha"] == "2026-11-02", "con frase y workdir: ACEPTADO en fecha de freno, queda frase, fecha y firma",
             out)
    otro = os.path.join(W, "anillo_cruzado_otra_version.step")
    shutil.copyfile(mal, otro)
    with open(otro, "ab") as f:
        f.write(b"\n")                                    # otro archivo (otra firma), mismo solido invalido
    rc, out, j = validez("--step", otro, "--hoy", "2026-11-02", "--acepto-validez", frase, "--workdir", wd)
    chequear(rc == 1 and "otra version" in out and j and j["modo"] != "aceptado",
             "la misma frase no acepta OTRA version del STEP (vale para una firma sola)", out)
    chequear(workdir.find_evidence(wd, "validez_aceptada", fixture=os.path.basename(otro)) is None,
             "la otra version no quedo aceptada en el manifest")
    rc, out, j = validez("--step", otro, "--hoy", "2026-11-02", "--workdir", wd)
    chequear(rc == 1 and j and j["modo"] == "freno", "sin frase, la otra version sigue frenando", out)
    rc, out, j = validez("--step", sano, "--hoy", "2026-11-02", "--acepto-validez", "otra frase de Fak larga",
                         "--workdir", wd)
    chequear(rc == 0 and j and j["veredicto"] == "verde" and workdir.find_evidence(wd, "validez_aceptada",
                                                                                   fixture=os.path.basename(sano)) is None,
             "una pieza sana no necesita frase: no se escribe ninguna aceptacion", out)

    print("\nV6 la entrega (export_deliverables.py): el freno sale ANTES de crear la carpeta destino")
    we = os.path.join(W, "wd_entrega")
    for d in ("in", "out", "renders", "cache"):
        os.makedirs(os.path.join(we, d), exist_ok=True)
    skip = ["--skip-gate", "zona", "--skip-gate", "proceso", "--skip-gate", "collision", "--skip-gate", "render",
            "--skip-gate", "cantos", "--reason", "test sintetico de validez"]
    pieza_mal = os.path.join(we, "out", "anillo_cruzado.step")
    pieza_sana = os.path.join(we, "out", "anillo_sano.step")
    shutil.copyfile(mal, pieza_mal)
    shutil.copyfile(sano, pieza_sana)

    def entregar(pieza, destino, hoy, w=we):
        return run([ED, "--workdir", w, "--pieces", pieza, "--deliver", destino, "--hoy", hoy] + skip)

    d1 = os.path.join(we, "entrega_freno")
    rc, out, _ = entregar(pieza_mal, d1, "2026-11-01")
    chequear(rc != 0 and "[GATE validez] 'anillo_cruzado.step'" in out and "no pasan is_valid" in out
             and "sentido inconsistente" in out and "Desde el 2026-11-01 esto frena la entrega" in out,
             "01/11: el anillo cruzado frena con [GATE validez], dice por que (is_valid y sentido) y desde cuando", out)
    chequear(not os.path.exists(d1), "y la carpeta destino NO se crea")
    d2 = os.path.join(we, "entrega_aviso")
    rc, out, _ = entregar(pieza_mal, d2, "2026-10-31")
    chequear(rc == 0 and "AVISO [GATE validez] 'anillo_cruzado.step'" in out and "freno desde 2026-11-01" in out
             and "ENTREGA OK" in out,
             "31/10 (ultimo dia de aviso): el anillo cruzado AVISA y se entrega, que es lo que pasaba antes del gate", out)
    d3 = os.path.join(we, "entrega_sana")
    rc, out, _ = entregar(pieza_sana, d3, "2026-11-02")
    chequear(rc == 0 and "ENTREGA OK" in out and "[GATE validez] 'anillo_sano.step': OK" in out
             and os.path.isfile(os.path.join(d3, "anillo_sano.step")) and os.path.isfile(os.path.join(d3, "anillo_sano.stl")),
             "01/11+: el gemelo sano se entrega (step y stl) y el gate dice OK", out)
    # la frase de Fak se escribe aparte (nunca en la corrida de la entrega) y la entrega solo la LEE del manifest
    frase_fak = "Fak lo asume asi, ver el render"
    rc, out, _ = run([ED, "validez", "--step", pieza_mal, "--workdir", we, "--hoy", "2026-11-02", "--acepto-validez",
                      frase_fak])
    chequear(rc == 0 and "[ACEPTADO]" in out, "la frase de Fak se registra con el gate suelto (workdir de la entrega)", out)
    d4 = os.path.join(we, "entrega_aceptada")
    rc, out, _ = entregar(pieza_mal, d4, "2026-11-02")
    chequear(rc == 0 and "ENTREGA OK" in out and "ACEPTADO por frase en el manifest" in out
             and os.path.isfile(os.path.join(d4, "anillo_cruzado.step")),
             "con la frase de Fak atada a esa firma, el mismo anillo cruzado pasa en fecha de freno como ACEPTADO", out)
    # si el archivo cambia despues de la frase, la aceptacion ya no vale
    with open(pieza_mal, "ab") as f:
        f.write(b"\n")
    d5 = os.path.join(we, "entrega_firma_distinta")
    rc, out, _ = entregar(pieza_mal, d5, "2026-11-02")
    chequear(rc != 0 and "[GATE validez] 'anillo_cruzado.step'" in out and not os.path.exists(d5),
             "si el STEP cambia despues de la frase (otra firma), vuelve a frenar y no crea la carpeta", out)
    # salida registrada: --skip-gate validez deja pasar el gate y queda escrito en el manifest
    d6 = os.path.join(we, "entrega_skip")
    rc, out, _ = run([ED, "--workdir", we, "--pieces", pieza_mal, "--deliver", d6, "--hoy", "2026-11-02",
                      "--skip-gate", "validez"] + skip[:-2] + ["--reason", "test: --skip-gate validez"])
    chequear(rc == 0 and "ENTREGA OK" in out and "[GATE validez] 'anillo_cruzado.step'" not in out,
             "--skip-gate validez (con --reason) saltea el gate y la entrega sigue", out)
    man = workdir.load_manifest(we)
    entregas = {os.path.basename(e["dest"]): e for e in man.get("evidence", []) if e.get("kind") == "delivery"}
    modos = {k: (entregas.get(k, {}).get("validez_por_pieza") or {}).get("anillo_cruzado.step", {}).get("modo")
             for k in ("entrega_aviso", "entrega_aceptada", "entrega_skip")}
    chequear(modos == {"entrega_aviso": "aviso", "entrega_aceptada": "aceptado", "entrega_skip": None}
             and "validez" in entregas["entrega_skip"]["skipped_gates"],
             "el manifest guarda validez_por_pieza (aviso, aceptado) y el --skip-gate validez de la entrega saltada",
             modos)

    print("\nV7 las piezas reales del virolador (C:\\Dev\\_utrim): v13 en rojo, v14 en verde")
    if _ARGS.sin_reales:
        saltos.append("V7: --sin-reales")
        print("   SALTEADO  --sin-reales")
    else:
        for clave, esperado in (("v13", "rojo"), ("v14", "verde")):
            rel, prefijo = REALES[clave]
            ruta = os.path.join(UTRIM, rel)
            if not os.path.isfile(ruta):
                saltos.append("V7 %s: no esta %s" % (clave, ruta))
                print("   SALTEADO  %s: no esta %s" % (clave, ruta))
                continue
            import hashlib
            h = hashlib.sha256(open(ruta, "rb").read()).hexdigest()
            if not h.startswith(prefijo):
                saltos.append("V7 %s: el sha256 cambio (%s)" % (clave, h[:16]))
                print("   SALTEADO  %s: el sha256 cambio (%s, se esperaba %s...)" % (clave, h[:16], prefijo))
                continue
            rc, out, j = validez("--step", ruta, "--hoy", "2026-11-02")
            if esperado == "rojo":
                chequear(rc == 1 and j and j["veredicto"] == "rojo" and j["solidos_invalidos"] == [0]
                         and j["malla_cerrada"] is True and j["sentido_consistente"] is False,
                         "v13 real (%s...): rojo, is_valid NO y triangulos con sentido inconsistente, con malla cerrada"
                         % prefijo, out)
            else:
                chequear(rc == 0 and j and j["veredicto"] == "verde" and j["solidos"] == 1
                         and j["sentido_consistente"] is True, "v14 real (%s...): verde" % prefijo, out)

    # V8 nace del auditor del 24/10 (AUDITORIA_control_validez.md, rojos 1 y 2): la rama «solidos validos + sentido malo
    # = verde con AVISO» no tenia caso, y el gate suelto perdia el aviso y escribia «un solo sentido».
    print("\nV8 solidos validos y triangulos con sentido inconsistente: verde con AVISO, nunca «un solo sentido»")
    import trimesh
    volteada = trimesh.creation.box(extents=(40, 20, 10))
    caras = volteada.faces.copy()
    caras[0] = caras[0][::-1]
    volteada = trimesh.Trimesh(vertices=volteada.vertices, faces=caras, process=False)
    chequear(volteada.is_watertight and not volteada.is_winding_consistent,
             "la malla de prueba (caja con un triangulo dado vuelta) es cerrada y con sentido inconsistente",
             "watertight %s, sentido %s" % (volteada.is_watertight, volteada.is_winding_consistent))
    r = ED_mod.evaluar_validez(caja, lambda: volteada)
    t = ED_mod.texto_validez(r)
    chequear(r["veredicto"] == "verde" and r["medido"] is True and r["solidos_invalidos"] == []
             and r["sentido_consistente"] is False and r.get("avisos") and "AVISO" in t and "un solo sentido" not in t,
             "caja sana + malla volteada: verde, sentido_consistente False, con AVISO en el texto", "%s | %s" % (r, t))
    r = ED_mod.evaluar_validez(mal, lambda: volteada)
    chequear(r["veredicto"] == "rojo" and any("sentido inconsistente" in m for m in r["motivos"]) and not r.get("avisos"),
             "anillo cruzado (is_valid NO) + malla volteada: rojo, y el sentido va a los motivos, no a un aviso",
             "%s" % r)
    # el gate SUELTO (main_validez) en proceso, con el mallador reemplazado por la malla volteada: caza en cualquier PC
    # que el modo suelto pierda el aviso (Nit 1 del auditor del 24/10: sin esto solo lo cuidaba la tuerca de la nube)
    import contextlib
    import io
    exp_orig, load_orig, hoy_orig = ED_mod._stl_export, trimesh.load, os.environ.get("CAD_GATE_TEST")
    salida = io.StringIO()
    try:
        ED_mod._stl_export = lambda *a, **k: None
        trimesh.load = lambda *a, **k: volteada
        os.environ["CAD_GATE_TEST"] = "1"
        with contextlib.redirect_stdout(salida):
            rc = ED_mod.main_validez(["--step", caja, "--hoy", "2026-11-02"])
    finally:
        ED_mod._stl_export, trimesh.load = exp_orig, load_orig
        if hoy_orig is None:
            os.environ.pop("CAD_GATE_TEST", None)
        else:
            os.environ["CAD_GATE_TEST"] = hoy_orig
    out = salida.getvalue()
    js = [x for x in out.splitlines() if x.startswith('{"gate": "validez"')]
    j = json.loads(js[-1]) if js else None
    chequear(rc == 0 and j and j["veredicto"] == "verde" and j.get("avisos") and "AVISO" in out
             and "un solo sentido" not in out,
             "gate suelto en proceso (caja sana + malla volteada, fecha de freno): verde con AVISO y el aviso en el JSON",
             out[-600:])
    if _ARGS.sin_reales:
        saltos.append("V8 tuerca real: --sin-reales")
        print("   SALTEADO  tuerca real: --sin-reales")
    elif not os.path.isfile(TUERCA[0]):
        saltos.append("V8 tuerca real: no esta %s" % TUERCA[0])
        print("   SALTEADO  tuerca real: no esta %s" % TUERCA[0])
    else:
        import hashlib
        h = hashlib.sha256(open(TUERCA[0], "rb").read()).hexdigest()
        if not h.startswith(TUERCA[1]):
            saltos.append("V8 tuerca real: el sha256 cambio (%s)" % h[:16])
            print("   SALTEADO  tuerca real: el sha256 cambio (%s, se esperaba %s...)" % (h[:16], TUERCA[1]))
        else:
            # el gate SUELTO (subproceso), que es donde se perdia el aviso
            rc, out, j = validez("--step", TUERCA[0], "--hoy", "2026-11-02")
            chequear(rc == 0 and j and j["veredicto"] == "verde" and j["solidos_invalidos"] == []
                     and j["malla_cerrada"] is True and j["sentido_consistente"] is False and j.get("avisos")
                     and "AVISO" in out and "un solo sentido" not in out,
                     "TUERCA baja 5mm real (%s...): verde en fecha de freno, sentido inconsistente informado como AVISO"
                     % TUERCA[1], out)

    print("")
    for s in saltos:
        print("   SALTEADO: %s" % s)
    print("RESULTADO:", "OK" if not fallos else "%d falla(s)" % len(fallos))
    for f in fallos:
        print("   - " + f)
    print("workdir del test: %s" % W)
    return 1 if fallos else 0


if __name__ == "__main__":
    sys.exit(main())
