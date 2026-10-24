#!/usr/bin/env python
# -*- coding: utf-8 -*-
#   C:\Dev\BarackMercosul\.venv-cad\Scripts\python.exe test_espesor_pared.py
"""El control de pared minima (espesor_pared.py, control 1.2 del 24/10/2026) en las dos direcciones.

Las piezas son las de 04_decision.md: un bloque de 40 x 20 x 10 con dos bolsillos que dejan un alma de 1,6 (verde),
0,30 (rojo) y 0,60 (aviso); un pin Ø5 con punta conica de 4 mm (verde: no da falso rojo, y la grilla SI llega a la
punta); una cuna de 100 x 60 que va de 3 a 0,3 mm (aviso, nunca rojo; es la que augura no ve). Agrego dos tubos de
pared 0,30 y 0,60 (caras curvas paralelas: rojo y aviso, con normales exactas) y los NO MEDIDO (STEP truncado, sin
solidos, malla abierta, tope de rayos, rayos que no impactan). Despues el camino de Fak: aviso hasta el 31/10, freno
desde el 01/11, --acepto-pared atada a la firma del STEP. Imprime lo medido y cuanto tarda cada pieza.

No borra nada: las piezas y los workdirs del test quedan en una carpeta nueva con marca de tiempo.
"""
import contextlib
import io
import json
import os
import subprocess
import sys
import tempfile
import time

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
os.environ["CAD_GATE_TEST"] = "1"        # --hoy (fecha simulada) solo vale con esto
import numpy as np  # noqa: E402
import espesor_pared as e  # noqa: E402
from build123d import Cylinder, export_step  # noqa: E402

W = os.path.join(tempfile.gettempdir(), "test_espesor_pared_%s" % time.strftime("%Y%m%d_%H%M%S"))
os.makedirs(W, exist_ok=True)
fallos = []


def chequear(cond, msg):
    print("   %s  %s" % ("ok  " if cond else "FALLA", msg))
    if not cond:
        fallos.append(msg)


def cerca(x, y, tol):
    return x is not None and abs(x - y) <= tol


C = e.canon()
print("canon: rojo < %s mm, aviso < %s mm, paso %s mm, aviso_hasta %s" % (
    C["umbral_rojo_mm"], C["umbral_aviso_mm"], C["paso_mm"], C["aviso_hasta"]))

# ------------------------------------------------------------------------------------------------
print("\n1. LAS PIEZAS DE 04_decision.md (medidas en proceso; segundos = solo la medicion)")
piezas = {
    "alma_1_6": e.pieza_alma(1.6), "alma_0_30": e.pieza_alma(0.30), "alma_0_60": e.pieza_alma(0.60),
    "pin": e.pieza_pin(), "cuna": e.pieza_cuna(),
    "tubo_0_30": Cylinder(10, 20) - Cylinder(9.7, 30), "tubo_0_60": Cylinder(10, 20) - Cylinder(9.4, 30),
    "bien_banco": e.alma_con_pin(1.6), "mal1_banco": e.alma_con_pin(0.30), "mal2_banco": e.alma_con_pin(0.60),
}
R, STEPS = {}, {}
for n, f in piezas.items():
    STEPS[n] = os.path.join(W, n + ".step")
    export_step(f, STEPS[n])
    R[n] = e.medir_formas(f.solids(), C)
    r = R[n]
    fj = r["fino_juzgado"]
    print("   %-11s %-5s min juzgado %-6s min de todos %-6s rayos %7d  impacto %5.1f %%  puntas %3d  %5.2f s" % (
        n, r["veredicto"], e._mm(fj["espesor_mm"]) if fj else "-", e._mm(r["espesor_min_todos_mm"]), r["rayos"],
        r["impacto_pct"], r["puntas_sin_juzgar_rayos"], r["segundos_medicion"]))

r = R["alma_1_6"]
chequear(r["veredicto"] == "verde" and cerca(r["espesor_min_todos_mm"], 1.6, 0.01),
         "alma de 1,6: verde, minimo %s (gemelo: 0,30 da rojo)" % r["espesor_min_todos_mm"])
r = R["alma_0_30"]
chequear(r["veredicto"] == "rojo" and cerca(r["fino_juzgado"]["espesor_mm"], 0.30, 0.01)
         and r["fino_juzgado"]["clase"] == "paralelas" and abs(r["fino_juzgado"]["punto"][2]) <= 0.2,
         "alma de 0,30: rojo, caras paralelas, el minimo %s esta en el alma (z %s)"
         % (r["fino_juzgado"]["espesor_mm"], r["fino_juzgado"]["punto"][2]))
chequear(cerca(r["paralelas_bajo_rojo_mm2"], 768.0, 2.0),
         "alma de 0,30: area bajo el umbral = 2 caras de 32 x 12 = 768 mm2 (da %s)" % r["paralelas_bajo_rojo_mm2"])
r = R["alma_0_60"]
chequear(r["veredicto"] == "aviso" and cerca(r["fino_juzgado"]["espesor_mm"], 0.60, 0.01) and r["rojos_rayos"] == 0,
         "alma de 0,60: aviso (no rojo), minimo %s" % r["fino_juzgado"]["espesor_mm"])
r = R["pin"]
chequear(r["veredicto"] == "verde" and r["rojos_rayos"] == 0 and r["avisos_rayos"] == 0,
         "pin con punta conica: verde, sin rojo ni aviso (no da falso rojo)")
chequear(r["puntas_sin_juzgar_rayos"] > 0 and r["espesor_min_todos_mm"] < 0.3,
         "pin: la grilla SI llego a la punta (minimo de todos %s mm, %d rayos de punta sin juzgar): el verde no es "
         "ceguera" % (r["espesor_min_todos_mm"], r["puntas_sin_juzgar_rayos"]))
r = R["cuna"]
chequear(r["veredicto"] == "aviso" and r["rojos_rayos"] == 0 and r["cunas"] is not None
         and cerca(r["cunas"]["espesor_mm"], 0.30, 0.01) and r["cunas"]["punto"][0] > 99.0,
         "cuna 100 x 60 de 3 a 0,3: aviso (nunca rojo), minimo %s en x = %s (la punta fina)"
         % (r["cunas"]["espesor_mm"], r["cunas"]["punto"][0]))
chequear(cerca(r["cunas"]["angulo_grados"], 1.547, 0.01),
         "cuna: angulo entre las caras %s grados (cuenta propia: atan(2,7 / 100) = 1,547)" % r["cunas"]["angulo_grados"])
chequear(cerca(r["cunas_bajo_aviso_mm2"], 2 * 60 * (0.8 - 0.3) / (2.7 / 100), 40.0),
         "cuna: area bajo 0,8 = 2 caras x 60 x 18,5 mm = 2220 mm2 (da %s)" % r["cunas_bajo_aviso_mm2"])
r = R["tubo_0_30"]
chequear(r["veredicto"] == "rojo" and r["fino_juzgado"]["clase"] == "paralelas"
         and cerca(r["fino_juzgado"]["espesor_mm"], 0.30, 0.02),
         "tubo de pared 0,30 (cilindros concentricos): rojo con normales exactas, minimo %s"
         % r["fino_juzgado"]["espesor_mm"])
r = R["tubo_0_60"]
chequear(r["veredicto"] == "aviso" and cerca(r["fino_juzgado"]["espesor_mm"], 0.60, 0.02),
         "tubo de pared 0,60: aviso, minimo %s" % r["fino_juzgado"]["espesor_mm"])
chequear(R["bien_banco"]["veredicto"] == "verde" and R["mal1_banco"]["veredicto"] == "rojo"
         and R["mal2_banco"]["veredicto"] == "aviso",
         "piezas del banco (bloque + pin): BIEN verde, MAL 0,30 rojo, MAL 0,60 aviso")
chequear(all(x["impacto_pct"] >= 99.0 for x in R.values()), "todas las piezas: impacto de los rayos >= 99 %")

# ------------------------------------------------------------------------------------------------
print("\n2. NO MEDIDO (nunca verde)")


def no_medido(nombre, f, texto):
    try:
        f()
    except e.NoMedido as ex:
        chequear(texto in str(ex), "%s: NO MEDIDO (%s)" % (nombre, str(ex)[:90]))
        return
    except Exception as ex:
        chequear(False, "%s: salio con %s: %s en vez de NoMedido" % (nombre, type(ex).__name__, ex))
        return
    chequear(False, "%s: tenia que ser NO MEDIDO y midio" % nombre)


with open(STEPS["alma_1_6"], "rb") as fh:
    crudo = fh.read()
trunc = os.path.join(W, "truncado.step")
with open(trunc, "wb") as fh:
    fh.write(crudo[:len(crudo) // 2])
no_medido("STEP truncado", lambda: e.leer_step(trunc), "truncado")
no_medido("archivo que no existe", lambda: e.leer_step(os.path.join(W, "no_existe.step")), "no existe")
from build123d import Box, Rectangle  # noqa: E402
plano = os.path.join(W, "solo_una_cara.step")
export_step(Rectangle(10, 10).faces()[0], plano)
no_medido("STEP sin solidos (una sola cara)", lambda: e.medir_formas(e.leer_step(plano).solids(), C), "no trae solidos")
caja = Box(40, 20, 10)
V, T, FID = e.mallar(caja.solids()[0], C["tol_malla_mm"], C["tol_angular_rad"])
sin_una_cara = FID != FID.max()
no_medido("caja a la que le falta una cara (la malla no cierra)",
          lambda: e.cerrar_malla(V, T[sin_una_cara], FID[sin_una_cara], "caja"), "no cierra")
no_medido("tope de rayos", lambda: e.medir_formas(piezas["cuna"].solids(), C, max_rayos=1000), "rayos")
no_medido("tope de tiempo", lambda: e.medir_formas(piezas["cuna"].solids(), C, tope_seg=-1.0), "tope")
# rayos que no impactan: con los rayos apuntando hacia AFUERA de un bloque cerrado no pega ninguno (gemelo del 100 %)
m, FID = e.cerrar_malla(V, T, FID, "caja")
P, TRI, _ = next(e.agrupar(e.lotes_de_muestras(m, 0.5), 10 ** 9))      # todas las muestras juntas
t_adentro, _ = e.lanzar(m, P, -m.face_normals[TRI])
t_afuera, _ = e.lanzar(m, P, m.face_normals[TRI])
pct_a = 100.0 * np.isfinite(t_adentro).mean()
pct_b = 100.0 * np.isfinite(t_afuera).mean()
chequear(pct_a > 99.0 and pct_b < 1.0,
         "impacto: rayos hacia adentro %.1f %% contra hacia afuera %.1f %% (el %% separa un solido bien orientado de "
         "uno al reves)" % (pct_a, pct_b))
C2 = dict(C)
C2["impacto_min_pct"] = 101
no_medido("menos de 40 % de impacto (umbral forzado a 101 para el ensayo)",
          lambda: e.medir_formas(piezas["alma_1_6"].solids(), C2), "impacto")

# ------------------------------------------------------------------------------------------------
print("\n3. AVISO HASTA EL 31/10, FRENO DESDE EL 01/11, --acepto-pared ATADA A LA FIRMA (en proceso, fecha simulada)")


def correr(*args):
    j = os.path.join(W, "salida_%d.json" % len(os.listdir(W)))
    with contextlib.redirect_stdout(io.StringIO()):          # lo que imprime el programa va al .json, no a la pantalla
        rc = e.main(list(args) + ["--json", j])
    with open(j, encoding="utf-8") as f:
        return rc, json.load(f)


wd = os.path.join(W, "wd")
rc, j = correr("--step", STEPS["alma_0_30"], "--hoy", "2026-10-31")
chequear(rc == 0 and j["veredicto"] == "rojo" and j["modo"] == "aviso", "rojo el 31/10: AVISO, exit 0 (dio %d, modo %s)" % (rc, j["modo"]))
rc, j = correr("--step", STEPS["alma_0_30"], "--hoy", "2026-11-01")
chequear(rc == 1 and j["modo"] == "freno", "rojo el 01/11: FRENO, exit 1 (dio %d, modo %s)" % (rc, j["modo"]))
rc, j = correr("--step", STEPS["alma_0_60"], "--hoy", "2026-11-01")
chequear(rc == 0 and j["veredicto"] == "aviso" and j["modo"] == "aviso", "aviso (0,60) el 01/11: no frena, exit 0")
rc, j = correr("--step", STEPS["cuna"], "--hoy", "2026-11-15")
chequear(rc == 0 and j["veredicto"] == "aviso", "cuna el 15/11: aviso, nunca freno, exit 0")
rc, j = correr("--step", STEPS["alma_1_6"], "--hoy", "2026-11-01")
chequear(rc == 0 and j["veredicto"] == "verde" and j["con_carga"] == "NO MEDIDO",
         "verde el 01/11: exit 0, y 'con carga' figura NO MEDIDO")
rc, j = correr("--step", STEPS["alma_0_30"], "--hoy", "2026-11-01", "--acepto-pared", "corta", "--workdir", wd)
chequear(rc == 1 and j["motivo"] == "frase corta", "frase corta: no se acepta, exit 1")
rc, j = correr("--step", STEPS["alma_0_30"], "--hoy", "2026-11-01", "--acepto-pared", "Fak lo asume asi esta vez")
chequear(rc == 1 and j["motivo"] == "aceptacion sin manifest", "frase sin --workdir: no se acepta, exit 1")
FRASE = "Fak: el alma de 0,30 es una prueba de apoyo, que quede asi"
rc, j = correr("--step", STEPS["alma_0_30"], "--hoy", "2026-11-01", "--acepto-pared", FRASE, "--workdir", wd)
chequear(rc == 0 and j["modo"] == "aceptado", "frase de Fak + workdir: ACEPTADO, exit 0")
with open(os.path.join(wd, "manifest.json"), encoding="utf-8") as f:
    man = json.load(f)
acep = [x for x in man["evidence"] if x["kind"] == "pared_aceptada"]
chequear(len(acep) == 1 and acep[0]["frase"] == FRASE and acep[0]["step_firma"] == j["step_firma"]
         and acep[0]["fecha"] == "2026-11-01" and cerca(acep[0]["espesor_min_mm"], 0.30, 0.01),
         "el manifest guarda frase, fecha, firma del STEP (%s) y minimo" % acep[0]["step_firma"])
rc, j = correr("--step", STEPS["mal1_banco"], "--hoy", "2026-11-01", "--acepto-pared", FRASE, "--workdir", wd)
chequear(rc == 1 and j["motivo"] == "frase usada para otra version",
         "la misma frase sobre OTRO STEP (otra firma): no vale, exit 1")
rc, j = correr("--step", STEPS["alma_1_6"], "--hoy", "2026-11-01", "--acepto-pared", FRASE, "--workdir", wd)
chequear(rc == 0 and j["veredicto"] == "verde", "frase sobre una pieza verde: no hacia falta, queda verde, exit 0")
rc, j = correr("--step", trunc)
chequear(rc == 2 and j["veredicto"] == "no_medido", "STEP truncado por el CLI: exit 2")

# ------------------------------------------------------------------------------------------------
print("\n4. EL PROGRAMA COMO LO CORRE EL ENTREGADOR (proceso aparte, -I, sin la fecha simulada)")
env = {k: v for k, v in os.environ.items() if k not in ("CAD_GATE_TEST", "CAD_HOY")}
env["PYTHONIOENCODING"] = "utf-8"
t0 = time.time()
p = subprocess.run([sys.executable, "-I", os.path.join(AQUI, "espesor_pared.py"), "--step", STEPS["alma_0_30"]],
                   capture_output=True, text=True, encoding="utf-8", errors="replace", env=env, timeout=900)
j = None
for linea in reversed(p.stdout.splitlines()):
    if linea.startswith('{"gate": "pared_minima"'):
        j = json.loads(linea)
        break
chequear("[AUTOTEST OK]" in p.stdout, "el autotest corre en cada invocacion y da OK")
chequear(j is not None and j["veredicto"] == "rojo" and j["hoy"] == time.strftime("%Y-%m-%d"),
         "linea JSON con veredicto rojo y la fecha del reloj (%s); exit %d, %.0f s con los import" % (
             j and j["hoy"], p.returncode, time.time() - t0))
p = subprocess.run([sys.executable, "-I", os.path.join(AQUI, "espesor_pared.py"), "--step", STEPS["alma_0_30"],
                    "--hoy", "2026-11-01"], capture_output=True, text=True, encoding="utf-8", errors="replace",
                   env=env, timeout=900)
chequear(p.returncode == 2 and "CAD_GATE_TEST" in p.stdout, "--hoy sin CAD_GATE_TEST=1: NO MEDIDO, exit 2")

# ------------------------------------------------------------------------------------------------
print("\n5. EL AUTOTEST SABE FALLAR (control roto a proposito: tiene que dar 3)")
def autotest_callado(canon_roto):
    with contextlib.redirect_stdout(io.StringIO()):
        return e.autotest(canon_roto)


roto = dict(C)
roto["umbral_rojo_mm"] = 0.2          # con este umbral el alma de 0,30 deja de ser roja: el autotest lo tiene que ver
prob = autotest_callado(roto)
chequear(any("alma de 0,30" in x for x in prob), "con el umbral de rojo en 0,2 el autotest cae en el alma de 0,30: %s"
         % (prob[:1] or "NO CAYO"))
roto = dict(C)
roto["cuna_extension_min_veces_umbral"] = 1000.0    # exige zonas finas 1000 veces mas largas: la cuna pasa a punta
prob = autotest_callado(roto)
chequear(any("cuna" in x for x in prob), "si la cuna se juzgara como punta, el autotest cae en la cuna: %s"
         % (prob[:1] or "NO CAYO"))
roto = dict(C)
roto["cuna_extension_min_veces_umbral"] = None      # todo par que converge avisa: el pin tambien -> el autotest cae
prob = autotest_callado(roto)
chequear(any("pin" in x for x in prob), "con 'todo par que converge avisa' el pin da aviso y el autotest cae: %s"
         % (prob[:1] or "NO CAYO"))
roto = dict(C)
roto["tol_paralelas_grados"] = 2.0                  # con 2 grados la cuna (1,55) pasaria por paralela y daria rojo
prob = autotest_callado(roto)
chequear(any("cuna" in x for x in prob), "si la cuna pasara por caras paralelas daria rojo y el autotest cae: %s"
         % (prob[:1] or "NO CAYO"))

print("")
print("carpeta del test (no se borra):", W)
print("RESULTADO:", "OK" if not fallos else "%d falla(s)" % len(fallos))
for x in fallos:
    print("  -", x)
sys.exit(1 if fallos else 0)
