#!/usr/bin/env python
# -*- coding: utf-8 -*-
#   C:\Dev\BarackMercosul\.venv-cad\Scripts\python.exe test_gate_asiento.py [--completo]
"""Prueba de gate_asiento.py en las dos direcciones (tanda 2, 17/10/2026).

Sintéticos (no necesitan la carpeta de trabajo): el autotest separa; tres apoyos sobre blando dan VERDE en apoyos (caso
4 del plan) y cuatro ROJO; un pasador metido en el blando da ROJO; un pasador más angosto que la grilla de la
simulación sale en el aviso «no vistos»; la banda recta se mide donde termina la pared vertical; sin «apriete» la
ventana queda SIN DATO y eso no da OK; una pieza sobre rígido no dispara el gate (caso 3 del plan); sin etiqueta, uso
incorrecto; sin calibración vigente (o con la firma del núcleo cambiada) el gate no juzga (código 3).

Casos conocidos (si está C:\\Dev\\_utrim): el registro de calibración commiteado es de ESTA versión de las cuentas y dice
que reprodujo la v14 (100 % y 68 %, ROJO en apoyos, ventana y asiento) y la v15 (28 % y 1,69 mm; apoyos ROJO,
ventana VERDE, asiento ROJO). Con --completo vuelve a correr la calibración entera (minutos).
"""
import io
import json
import os
import sys
import tempfile
from contextlib import redirect_stdout

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
import numpy as np  # noqa: E402
import trimesh  # noqa: E402

import gate_asiento as G  # noqa: E402
from cadlib import asiento as A  # noqa: E402

fallos = []


def chequear(cond, msg):
    print("   %s  %s" % ("ok  " if cond else "FALLA", msg))
    if not cond:
        fallos.append(msg)


def caja(x0, x1, y0, y1, z0, z1):
    b = trimesh.creation.box(extents=[x1 - x0, y1 - y0, z1 - z0])
    b.apply_translation([(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2])
    return b


ESCENA = {"_nombre": "sintetica", "grilla": {"x": [0, 100], "y": [0, 40], "paso": 1.0, "desfase": 0.137},
          "rayos": {"panel_desde": -60, "pieza_desde": 20}, "zonas_plastico": [],
          "variantes": [{"nombre": "nominal", "abiertas": []}],
          "centro": [50, 20], "esquinas": [[0, 0], [100, 0], [0, 40], [100, 40]], "pose": {"z": 20, "giro": 0.2},
          "mano": [[25, 20], [40, 15], [40, 25], [60, 20]],
          "sorteo": {"cede": [0, 0.6], "espesor": 0.2, "espesor_Lx": 50, "espesor_Ly": 20, "alabeo": 0.2,
                     "alabeo_L": 50, "semilla": 7, "casos": 20, "hamaca_umbral_mm": 0.3}}
# panel: plastico de z 0,5 a 3; tapizado de 0 a 0,5 (la malla «con blando» es plastico + tapizado)
PLAST = caja(-5, 105, -5, 45, 0.5, 3.0)
BLANDO = trimesh.util.concatenate([PLAST, caja(-5, 105, -5, 45, 0.0, 0.5)])


def pieza(apoyos, alto=-0.05, lado=6.0, extra=()):
    partes = [caja(5, 95, 3, 37, -8.0, -5.0)]
    for x, y in apoyos:
        partes.append(caja(x - lado / 2, x + lado / 2, y - lado / 2, y + lado / 2, -5.0, alto))
    partes.extend(extra)
    return trimesh.util.concatenate(partes)


cx = G.Contexto(ESCENA, None, mallas=(PLAST, BLANDO))
U = G.umbrales()
TRES = [(15, 8), (15, 32), (85, 20)]
CUATRO = [(15, 8), (15, 32), (85, 8), (85, 32)]

print("1. autotest (par BIEN/MAL propio)")
sep, lin = G.autotest()
chequear(sep, "el autotest separa: " + " | ".join(lin))

print("2. apoyos sobre blando, pose de diseno")
peor, pv = G.fila_apoyos(cx, pieza(TRES), U)
chequear(pv[peor]["A1"]["veredicto"] == "VERDE" and pv[peor]["A1"]["apoyos_z"] == 3,
         "tres apoyos que controlan Z y los dos giros: VERDE (caso 4 del plan) — %s" % pv[peor]["A1"]["motivo"])
peor, pv = G.fila_apoyos(cx, pieza(CUATRO), U)
chequear(pv[peor]["A1"]["veredicto"] == "ROJO" and pv[peor]["A1"]["apoyos_z"] == 4, "cuatro apoyos: ROJO (gemelo)")
chequear(pv[peor]["A1b"]["veredicto"] == "VERDE", "cuatro sobre la misma superficie: renglon 4-2-1 VERDE (informativo)")
metido = caja(48, 50, 18, 22, -5.0, 0.4)                                   # 0,4 adentro del tapizado
peor, pv = G.fila_apoyos(cx, pieza(TRES, extra=[metido]), U)
chequear(pv[peor]["A1"]["veredicto"] == "ROJO" and "metido" in pv[peor]["A1"]["motivo"],
         "un pasador metido 0,4 mm en el blando: ROJO — %s" % pv[peor]["A1"]["motivo"])
angosto = caja(50.3, 50.9, 18, 22, -5.0, -0.05)                            # 0,6 mm entre x 50,137 y 51,137
peor, pv = G.fila_apoyos(cx, pieza(TRES, extra=[angosto]), U)
chequear(pv[peor]["A1"]["apoyos_z"] == 4 and pv[peor]["no_vistos_por_la_simulacion"],
         "un apoyo de 0,6 mm entre dos puntos de la grilla: el inventario lo cuenta y avisa que la simulacion no lo ve "
         "(%s)" % pv[peor]["no_vistos_por_la_simulacion"])

print("2b. ronda 1 del auditor (I1, I2, I6): lo que antes se esquivaba")
peor, pv = G.fila_apoyos(cx, pieza(CUATRO, alto=-0.16), U)
chequear(pv[peor]["A1"]["veredicto"] == "ROJO" and pv[peor]["A1"]["apoyos_z"] == 4,
         "cuatro apoyos diseñados 0,11 mm mas lejos: siguen siendo 4, ROJO (antes 0 apoyos, VERDE)")
peor, pv = G.fila_apoyos(cx, pieza(TRES, alto=-0.16), U)
chequear(pv[peor]["A1"]["veredicto"] == "VERDE", "tres apoyos 0,11 mm mas lejos: VERDE")
rieles = [caja(10, 90, 6, 10, -5.0, -0.05), caja(10, 90, 30, 34, -5.0, -0.05)]
peor, pv = G.fila_apoyos(cx, pieza([], extra=rieles), U)
chequear(pv[peor]["A1"]["veredicto"] == "ROJO", "dos rieles a lo largo: ROJO (cada uno cuenta por dos) — %s"
         % pv[peor]["A1"]["motivo"])
placa = [caja(8, 92, 5, 35, -5.0, -0.05)]
peor, pv = G.fila_apoyos(cx, pieza([], extra=placa), U)
chequear(pv[peor]["A1"]["veredicto"] == "ROJO", "una placa entera apoyada: ROJO (superficie grande)")
nervio = [caja(15, 85, 7, 9, -5.0, -0.09), caja(15, 85, 31, 33, -5.0, -0.09), caja(14, 16, 8, 32, -5.0, -0.09)]
peor, pv = G.fila_apoyos(cx, pieza(CUATRO, extra=nervio), U)
chequear(pv[peor]["A1"]["veredicto"] == "ROJO", "cuatro apoyos unidos por un nervio de luz 0,09: ROJO")
peor, pv = G.fila_apoyos(cx, pieza([(15, 8), (85, 20)]), U)
chequear(pv[peor]["A1"]["veredicto"] == "ROJO", "dos apoyos chicos: ROJO (no alcanzan para Z y los dos giros)")
lejos = pieza(TRES)
lejos.apply_translation([1000, 0, 0])
peor, pv = G.fila_apoyos(cx, lejos, U)
chequear(pv[peor]["A1"]["veredicto"] == "SIN DATO", "pieza fuera del frame: SIN DATO, no VERDE (%s)" % pv[peor]["A1"]["motivo"])
esc_v = dict(ESCENA, variantes=[{"nombre": "abre_R1", "abiertas": [{"cx": 70, "cy": 20, "hx": 3, "hy": 3}]},
                                {"nombre": "abre_R2", "abiertas": [{"cx": 30, "cy": 20, "hx": 3, "hy": 3}]}])
cxv = G.Contexto(esc_v, None, mallas=(PLAST, BLANDO))
m70 = caja(68, 72, 18, 22, -5.0, 0.4)                                      # metido, solo se ve cuando NO se abre en 70
peor, pv = G.fila_apoyos(cxv, pieza(TRES, extra=[m70]), U)
chequear(pv[peor]["A1"]["veredicto"] == "ROJO" and peor == "abre_R2",
         "dos variantes que abren zonas distintas: se informa la del ROJO (%s), no la VERDE" % peor)

print("2c. revisor por API (18/10) y ronda 2 del auditor: geometria de los apoyos y cobertura")
linea = [(15, 20), (50, 20), (85, 20)]
peor, pv = G.fila_apoyos(cx, pieza(linea), U)
chequear(pv[peor]["A1"]["veredicto"] == "ROJO" and pv[peor]["A1"]["en_linea"],
         "tres apoyos chicos EN LINEA: ROJO aunque sean tres (vuelca) — %s" % pv[peor]["A1"]["motivo"][-90:])
peor, pv = G.fila_apoyos(cx, pieza(TRES), U)
chequear(pv[peor]["A1"]["veredicto"] == "VERDE" and pv[peor]["A1"]["puntos_de_apoyo"] == 3 and not pv[peor]["A1"]["en_linea"],
         "tres apoyos que controlan tres movimientos distintos (triangulo): VERDE")
riel = caja(10, 90, 6, 10, -5.0, -0.05)
peor, pv = G.fila_apoyos(cx, pieza([(50, 32)], extra=[riel]), U)
chequear(pv[peor]["A1"]["veredicto"] == "VERDE" and pv[peor]["A1"]["puntos_de_apoyo"] == 3,
         "un riel y un apoyo afuera de su eje: tres puntos que no estan en linea, VERDE")
peor, pv = G.fila_apoyos(cx, pieza([(95 - 3, 8)], extra=[caja(10, 80, 6, 10, -5.0, -0.05)]), U)
chequear(pv[peor]["A1"]["veredicto"] == "ROJO", "un riel y un apoyo SOBRE su eje: en linea, ROJO")
peor, pv = G.fila_apoyos(cx, pieza([(50, 20)], extra=rieles), U)
chequear(pv[peor]["A1"]["veredicto"] == "ROJO", "dos rieles y un apoyo: cinco puntos, ROJO")
diag = trimesh.creation.box(extents=[70, 4, 4.95])
diag.apply_transform(trimesh.transformations.rotation_matrix(np.radians(20), [0, 0, 1]))
diag.apply_translation([50, 20, -2.525])
peor, pv = G.fila_apoyos(cx, pieza([(15, 32)], extra=[diag]), U)
tipos = sorted(a["tipo"] for a in pv[peor]["apoyos"])
chequear("superficie" not in tipos and "riel" in tipos, "un riel en DIAGONAL se mide como riel, no como superficie (%s)" % tipos)
afuera = pieza(TRES, extra=[caja(96, 104, 18, 22, -5.0, -0.05)])
peor, pv = G.fila_apoyos(cx, afuera, U)
chequear(pv[peor]["A1"]["veredicto"] == "SIN DATO", "un apoyo que cae afuera de la grilla: SIN DATO, no VERDE (ronda 2, R2-I2)")
chequear(G.PUNTOS_MIN == 3 and U["apoyos_z_max"] == 3, "el minimo (3, mecanico) va separado del maximo de casos_3d.json")

print("3. simulacion apretando")
f = G.fila_asiento(cx, pieza(TRES), U, 20, {"nominal": np.array(TRES, float)}, log=lambda *a: None)
chequear(f["veredicto"] == "VERDE", "tres apoyos con la mano adentro: no se hamaca (%s)" % f["motivo"])
esc_m = dict(ESCENA, mano=[[25, 20], [50, 20], [80, 30], [80, 10], [20, 30]])
BLANDO_M = trimesh.util.concatenate([PLAST, caja(-5, 105, -5, 45, 0.0, 0.5), ])
cxm = G.Contexto(esc_m, None, mallas=(PLAST, BLANDO_M))
cxm.Ht[(cxm.gr.XY[:, 0] - 85) ** 2 + (cxm.gr.XY[:, 1] - 32) ** 2 <= 25] = 0.4      # una meseta 0,4 mas lejos
f = G.fila_asiento(cxm, pieza(CUATRO), U, 20, {"nominal": np.array(CUATRO, float)}, log=lambda *a: None)
chequear(f["veredicto"] == "ROJO", "cuatro apoyos con uno sobre una meseta mas lejos: se hamaca (%s)" % f["motivo"])
esc_p = dict(ESCENA, mano_punta=[[30, 20], [70, 20]])
cxp = G.Contexto(esc_p, None, mallas=(PLAST, BLANDO))
f = G.fila_asiento(cxp, pieza(CUATRO), U, 5, {"nominal": np.array(CUATRO, float)}, log=lambda *a: None)
chequear(f["variantes"]["nominal"]["punta"].get("veredicto") == "NO APLICA" and f["veredicto"] == "VERDE"
         and "punta no aplica" in f["motivo"] and "hamaca_mediana_mm" in f["variantes"]["nominal"]["punta"],
         "la mano 'punta' adentro de los apoyos: NO APLICA por la GEOMETRIA, simulada igual, dicho en el motivo y sin AVISO "
         "(auditor ronda 2, R2-I3)")
cxm2 = G.Contexto(esc_p, None, mallas=(PLAST, BLANDO_M))
cxm2.Ht[(cxm2.gr.XY[:, 0] - 85) ** 2 + (cxm2.gr.XY[:, 1] - 32) ** 2 <= 25] = 0.4
f2 = G.fila_asiento(cxm2, pieza(CUATRO), U, 5, {"nominal": np.array(CUATRO, float)}, log=lambda *a: None)
chequear(f2["variantes"]["nominal"]["punta"].get("veredicto") == "NO APLICA",
         "los mismos apoyos sobre dos mesetas: NO APLICA igual (ya no depende de que la simulacion de cero)")
sd = G.veredicto_asiento({"x": {"normal": {"sin_dato": True, "motivo": "sin reposo"}}}, U, ESCENA)
chequear(sd[0] == "SIN DATO", "una simulacion sin reposo en ningun caso: SIN DATO, no revienta (revisor por API, punto 4)")
gr0 = A.Grilla([0, 10], [0, 4], 1.0, 0.137)
S0 = A.simular(np.full(len(gr0.XY), np.nan), np.full(len(gr0.XY), np.nan), np.full(len(gr0.XY), -5.0), gr0,
               dict(ESCENA, centro=[5, 2], esquinas=[[0, 0], [10, 4]]), np.zeros(len(gr0.XY), bool),
               np.zeros(len(gr0.XY), bool), np.zeros(len(gr0.XY), bool), [[5, 2]], 2, 7)
chequear(S0.get("sin_dato") is True or "pct_hamaca" in S0, "simular sin panel enfrente no revienta (%s)" % sorted(S0)[:3])

print("4. ventana")
pared = trimesh.util.concatenate([caja(-2, 2, 4.0, 5.0, -10.0, -6.0), caja(-2, 2, 4.0, 4.6, -6.0, -5.0)])
tb, yb = A.tope_de_banda(pared, {"x": 0.0, "y_desde": 20.0, "dir": -1}, -10.0, -4.99)
chequear(tb is not None and abs(tb - (-6.0)) <= 0.02 and abs(yb - 5.0) <= 0.01,
         "la banda recta termina donde la pared deja de ser vertical: %s (esperado -6,00)" % tb)
fv = G.fila_ventana(cx, pieza(TRES), U)
chequear(fv["veredicto"] == "SIN DATO", "sin 'apriete' en la escena la ventana queda SIN DATO")
chequear(G.veredicto_total({"apoyos": {"veredicto": "VERDE"}, "ventana": fv, "asiento": {"veredicto": "VERDE"}}) == "SIN DATO",
         "un control SIN DATO no da VERDE")

print("5. activacion por etiqueta")
casos = G._json(G.CASOS)
buf = io.StringIO()
with redirect_stdout(buf):
    rc = G.verificar(casos, "posicionador_toproll", "posicionador", None, None, None, None, None)
chequear(rc == 0 and "NO CORRE" in buf.getvalue(), "una pieza sobre chapa rigida no dispara el gate y lo dice (caso 3 del plan)")
sin = {"escenas": {"x": {"piezas": {}}}}
buf = io.StringIO()
with redirect_stdout(buf):
    rc = G.verificar(sin, "x", "p", None, None, None, None, None)
chequear(rc == 2, "sin etiqueta: codigo 2 (no adivina)")
with tempfile.TemporaryDirectory() as td:
    wd_ = os.path.join(td, "w")
    from cadlib import workdir as wd
    wd.ensure_workdir(wd_)
    wd.record_evidence(wd_, "proceso_declarado", tags=["hay-apriete", "apoya-sobre-rigido"])
    et, _, conf = G.etiqueta_de({"apoya_sobre": "blando"}, None, wd_)
    chequear(et is None and conf, "pliego «rigido» contra escena «blando»: conflicto, no se elige una (auditor I3)")
    buf = io.StringIO()
    with redirect_stdout(buf):
        rc = G.verificar(casos, "upper_trim_two", "v14", None, None, wd_, None, None)
    chequear(rc == 2 and "NO COINCIDEN" in buf.getvalue(), "la v14 con un pliego «rigido»: codigo 2, no «NO CORRE»")
    buf = io.StringIO()
    with redirect_stdout(buf):
        rc = G.verificar(casos, "upper_trim_two", "v14", None, "rigido", None, None, None)
    chequear(rc == 2, "la v14 con --etiqueta rigido: codigo 2")
    chequear(G.etiqueta_de({"apoya_sobre": "rigido"}, None, wd_)[0] == "rigido", "pliego y escena de acuerdo: corre")

print("6. sin calibracion vigente no juzga")
viejo = G.CALIB
with tempfile.TemporaryDirectory() as td:
    falso = os.path.join(td, "calib.json")
    json.dump({"reproduce": True, "firma_nucleo": "otra"}, open(falso, "w", encoding="utf-8"))
    G.CALIB = falso
    ok, msg = G.calibracion_vigente()
    chequear(not ok and "cambiaron" in msg, "firma del nucleo distinta: no vigente (%s)" % msg[:80])
    json.dump({"reproduce": False, "firma_nucleo": A.firma_nucleo(), "diferencias": ["x"]}, open(falso, "w", encoding="utf-8"))
    chequear(not G.calibracion_vigente()[0], "una calibracion que no reprodujo no habilita")
    G.CALIB = os.path.join(td, "no_existe.json")
    chequear(not G.calibracion_vigente()[0], "sin registro: no vigente")
    esc = casos["escenas"]["upper_trim_two"]
    json.dump({"reproduce": True, "firma_nucleo": A.firma_nucleo(), "escena": "upper_trim_two",
               "firma_escena": A.firma_escena(esc), "panel_firma": "P1"}, open(falso, "w", encoding="utf-8"))
    G.CALIB = falso
    chequear(G.calibracion_vigente("upper_trim_two", esc, "P1")[0], "misma escena y mismo panel: vigente")
    otra = json.loads(json.dumps(esc))
    otra["sorteo"]["cede"] = [0, 0]
    chequear(not G.calibracion_vigente("upper_trim_two", otra)[0], "un numero de la escena cambiado: no vigente (auditor I5)")
    chequear(not G.calibracion_vigente("upper_trim_two", esc, "P2")[0], "otro panel: no vigente")
G.CALIB = viejo

print("7. casos conocidos (registro de calibracion)")
if not os.path.isdir(r"C:\Dev\_utrim"):
    print("   (no esta C:\\Dev\\_utrim en esta PC: se saltea)")
else:
    if "--completo" in sys.argv:
        # la calibracion entera escribe su registro en un TEMPORAL: no pisa el commiteado (revisor por API, punto 5)
        with tempfile.TemporaryDirectory() as td:
            viejo = G.CALIB
            G.CALIB = os.path.join(td, "asiento_calibracion.json")
            try:
                rc = G.calibrar(casos, "upper_trim_two", r"C:\Dev\_utrim\gate_asiento")
                nuevo = G._json(G.CALIB) if os.path.isfile(G.CALIB) else {}
            finally:
                G.CALIB = viejo
        chequear(rc == 0 and nuevo.get("reproduce"), "calibrar corre entero (150 casos) y REPRODUCE, simulado hoy")
    else:
        print("   (sin --completo: lo de abajo se LEE de la calibracion guardada, no se vuelve a simular)")
    ok, msg = G.calibracion_vigente()
    chequear(ok, "la calibracion commiteada es de esta version de las cuentas: %s" % msg)
    c = G._json(G.CALIB)
    r = c.get("resultados", {})
    v14, v15 = r.get("v14", {}), r.get("v15", {})
    s14, s15 = v14.get("sim", {}), v15.get("sim", {})
    chequear(s14.get("listones_tapados", {}).get("pct_hamaca") == 100 and s14.get("listones_abiertos", {}).get("pct_hamaca") == 68,
             "v14: se hamaca en 100 y 68 de 100 (publicado 13/10)")
    chequear(v14.get("veredictos") == {"apoyos": "ROJO", "ventana": "ROJO", "asiento": "ROJO"}, "v14: ROJO en apoyos, ventana y asiento")
    chequear(v14.get("apoyos", {}).get("apoyos_z") == 7, "v14: 7 apoyos (4 bloques + 3 pasadores), como declara casos_3d.json")
    chequear(s15.get("listones_tapados", {}).get("pct_hamaca") == 28 and
             s15.get("listones_tapados_punta", {}).get("hamaca_mediana_mm") == 1.69,
             "v15: 28 de 100 y 1,69 mm apretando en la punta (publicado 13/10)")
    chequear(v15.get("veredictos") == {"apoyos": "ROJO", "ventana": "VERDE", "asiento": "ROJO"},
             "v15: apoyos ROJO (cuatro bloques), ventana VERDE, asiento ROJO")

print("")
print("RESULTADO:", "OK" if not fallos else "%d falla(s)" % len(fallos))
sys.exit(1 if fallos else 0)
