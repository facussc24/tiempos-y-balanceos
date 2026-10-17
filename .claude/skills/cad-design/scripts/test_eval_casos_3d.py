#!/usr/bin/env python
# -*- coding: utf-8 -*-
#   python test_eval_casos_3d.py
"""Prueba de eval_casos_3d.py en las dos direcciones, con datos sintéticos (no necesita la carpeta de trabajo).

BIEN: tres apoyos + un ubicador -> A1 VERDE; un tope antivuelco no cuenta como apoyo. MAL: cuatro apoyos -> ROJO.
Ventana justo en el umbral -> VERDE; una décima menos -> ROJO. Una simulación que no reproduce el número publicado hace
fallar el eval (código 1) aunque la pieza dé ROJO como se esperaba. La v16 sin número publicado se juzga por umbral.
Y los casos reales del 13/10 (si la carpeta de trabajo está) dan lo esperado.
"""
import json
import os
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
import eval_casos_3d as ev  # noqa: E402

fallos = []


def chequear(cond, msg):
    print("   %s  %s" % ("ok  " if cond else "FALLA", msg))
    if not cond:
        fallos.append(msg)


U = json.load(open(os.path.join(AQUI, "..", "data", "casos_3d.json"), encoding="utf-8"))["umbrales"]
ap = lambda n, t="apoyo_z": {"nombre": n, "tipo": t, "rigido": True}  # noqa: E731

print("1. A1 apoyos")
tres = [ap("a"), ap("b"), ap("c"), ap("anillo", "ubicador_xy"), ap("tope", "antivuelco")]
chequear(ev.a1_apoyos(tres, U)["veredicto"] == "VERDE", "tres apoyos + un ubicador + un tope antivuelco: VERDE")
chequear(ev.a1_apoyos(tres + [ap("d")], U)["veredicto"] == "ROJO", "cuatro apoyos rígidos: ROJO (gemelo)")
chequear(ev.a1_apoyos(tres + [ap("pasador", "ubicador_xy")], U)["veredicto"] == "ROJO", "dos ubicadores en el plano: ROJO")

print("1b. A1b 4-2-1 coplanar (renglon aparte; A1 sigue dando ROJO con cuatro)")
cuatro = tres + [ap("d")]
chequear(ev.a1b_cuatro_coplanares(tres, None, U)["veredicto"] == "NO APLICA", "con tres apoyos no aplica")
chequear(ev.a1b_cuatro_coplanares(cuatro, {"superficies": 1, "dispersion_mm": 0.01}, U)["veredicto"] == "VERDE",
         "cuatro sobre una superficie con 0,01 de desnivel: VERDE")
chequear(ev.a1b_cuatro_coplanares(cuatro, {"superficies": 2, "dispersion_mm": 0.01}, U)["veredicto"] == "ROJO",
         "cuatro en dos superficies: ROJO (gemelo)")
chequear(ev.a1b_cuatro_coplanares(cuatro, {"superficies": 1, "dispersion_mm": 0.2}, U)["veredicto"] == "ROJO",
         "cuatro con 0,2 de desnivel: ROJO")
chequear(ev.a1b_cuatro_coplanares(cuatro + [ap("e")], {"superficies": 1, "dispersion_mm": 0.0}, U)["veredicto"] == "ROJO",
         "cinco apoyos: ROJO")
chequear(ev.a1_apoyos(cuatro, U)["veredicto"] == "ROJO", "A1 estricto no se afloja: cuatro sigue ROJO")

print("2. A2 ventana")
chequear(ev.a2_ventana({"banda": 1.0, "punta": 0.6}, U)["veredicto"] == "VERDE", "en el umbral: VERDE")
chequear(ev.a2_ventana({"banda": 0.9, "punta": 0.6}, U)["veredicto"] == "ROJO", "banda una décima corta: ROJO")
chequear(ev.a2_ventana({"banda": 1.2, "punta": 0.5}, U)["veredicto"] == "ROJO", "punta una décima corta: ROJO")

print("3. A3 asiento: reproducir lo publicado")
fila = lambda p, pct, mx=0.6, med=0.1, tap=True: {"pieza": p, "listones_tapados": tap, "pct_hamaca_mas_de_0_3": pct,  # noqa: E731
                                                  "hamaca_max_mm": mx, "hamaca_mediana_mm": med, "pct_anillo_toca_plastico": 0}
casos = {"umbrales": U, "versiones": {"vX": {"elementos": tres, "ventana_mm": {"banda": 1.2, "punta": 0.7},
                                             "sim_publicada": {"normal_tapados_pct": 28, "punta_mediana_mm": 1.69},
                                             "esperado": {"A3_asiento": "ROJO"}}}}
_, f = ev.evaluar(casos, [fila("vX", 28)], [fila("vX", 100, med=1.69)])
chequear(not f, "reproduce 28 % y 1,69 mm: sin fallas")
_, f = ev.evaluar(casos, [fila("vX", 60)], [fila("vX", 100, med=1.69)])
chequear(any("NO reproduce" in x for x in f), "da 60 % en vez de 28 %: FALLA aunque el veredicto ROJO coincida")

print("3b. un control que no pudo medir no da OK (auditor del 17/10, I3)")
_, f = ev.evaluar(casos, [], [])
chequear(any("SIN DATO" in x for x in f), "simulacion vacia: FALLA (antes daba OK)")
r, f = ev.evaluar(casos, [fila("vX", 28)], None)
chequear(r["vX"]["A3_asiento"]["reproduce_lo_publicado"] is None and any("no se pudo comparar" in x for x in f),
         "sin la corrida de la punta: reproduce = null y FALLA (no dice true sin comparar el 1,69)")
dos = {"umbrales": U, "versiones": {"vX": casos["versiones"]["vX"], "vY": {"elementos": tres, "esperado": {"A3_asiento": "ROJO"}}}}
_, f = ev.evaluar(dos, [fila("vX", 28)], [fila("vX", 100, med=1.69)], solo=["vX"])
chequear(not f, "--solo vX deja afuera a vY a proposito: sin fallas")
_, f = ev.evaluar(dos, [fila("vX", 28)], [fila("vX", 100, med=1.69)])
chequear(any("vY" in x and "SIN DATO" in x for x in f), "sin --solo, vY sin corrida es FALLA")

print("3c. ronda 2 del auditor (R2-I1): tampoco da OK sin ninguna simulacion, con una pieza que la corrida no trae ni con --solo mal escrito")
_, f = ev.evaluar(casos, None, None)
chequear(any("no se paso ninguna simulacion" in x for x in f), "sin --sim-normal: FALLA (antes OK)")
_, f = ev.evaluar(casos, None, None, sin_sim=True)
chequear(not f, "--sin-sim a proposito: sin fallas (A1/A2 solos)")
sin_esp = {"umbrales": U, "versiones": {"vX": casos["versiones"]["vX"], "vZ": {"elementos": tres}}}
_, f = ev.evaluar(sin_esp, [fila("vX", 28)], [fila("vX", 100, med=1.69)])
chequear(any("vZ" in x and "SIN DATO" in x for x in f), "una pieza SIN esperado que la corrida no trae (como la v16 real): FALLA")
try:
    ev.main(["--casos", os.path.join(AQUI, "..", "data", "casos_3d.json"), "--solo", "v61", "--sin-sim"])
    chequear(False, "--solo con una pieza que no existe tiene que dar error")
except SystemExit as e:
    chequear(e.code == 2, "--solo v61 (mal escrito): error, codigo 2")

print("4. A3 asiento: la pieza nueva se juzga por umbral")
nueva = {"umbrales": U, "versiones": {"v16": {"elementos": tres, "ventana_mm": {"banda": 1.2, "punta": 0.7}}}}
r, _ = ev.evaluar(nueva, [fila("v16", 5, mx=0.4)], [fila("v16", 0, med=0.3)])
chequear(r["v16"]["A3_asiento"]["veredicto"] == "VERDE", "5 %, máx 0,4, punta 0,3: VERDE")
r, _ = ev.evaluar(nueva, [fila("v16", 12, mx=0.4)], [fila("v16", 0, med=0.3)])
chequear(r["v16"]["A3_asiento"]["veredicto"] == "ROJO", "12 %: ROJO")
r, _ = ev.evaluar(nueva, [fila("v16", 5, mx=0.4)], None)
chequear(r["v16"]["A3_asiento"]["veredicto"] == "ROJO", "sin la corrida de la punta: ROJO (no se aprueba a medias)")

print("5. casos reales del 13/10 (si está la carpeta de trabajo)")
sn, sp = r"C:\Dev\_utrim\out\sim_asiento.json", r"C:\Dev\_utrim\out\sim_asiento_punta.json"
if os.path.exists(sn) and os.path.exists(sp):
    real = json.load(open(os.path.join(AQUI, "..", "data", "casos_3d.json"), encoding="utf-8"))
    real["versiones"] = {k: v for k, v in real["versiones"].items() if k in ("v14", "v15")}
    _, f = ev.evaluar(real, json.load(open(sn, encoding="utf-8")), json.load(open(sp, encoding="utf-8")))
    chequear(not f, "v14 y v15 dan lo esperado contra lo publicado el 13/10 (%s)" % f)
else:
    print("   (salteado: no está C:\\Dev\\_utrim)")

print("\nRESULTADO:", "OK" if not fallos else "FALLAS: %d" % len(fallos))
sys.exit(1 if fallos else 0)
