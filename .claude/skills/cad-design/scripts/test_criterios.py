#!/usr/bin/env python
# -*- coding: utf-8 -*-
# Interprete: .venv-cad (Py3.12).
#   C:\Dev\BarackMercosul\.venv-cad\Scripts\python.exe test_criterios.py
"""Prueba de cadlib.criterios con criterios REALES portados de los scripts de este skill,
y con los casos que TIENEN que fallar.

No modifica ningun script existente: los criterios se declaran aca para mostrar que pasaria
si el numero de cada script viviera en el modulo. Salida cruda, sin adornos.

Sale 0 si todo se comporta como corresponde (incluidos los fallos esperados).
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from cadlib.criterios import (  # noqa: E402
    Criterio, FaltaContexto, Nivel, Origen, ProcedenciaInsuficiente,
    SinProcedencia, SinTraduccion, ctx_req, kpa_a_gramos, sf_a_ciclos, tabla,
)

fallos = []


def chequear(cond, msg):
    print("   %s  %s" % ("ok  " if cond else "FALLA", msg))
    if not cond:
        fallos.append(msg)


# =========================================================================================
# 1. CRITERIOS REALES PORTADOS
# =========================================================================================
# Curva S-N del PLA impreso en Z: los dos puntos que YA estan en el repo, en
# gate_aristas.py:113-114 (PLA_Z_ESTATICO = 25-35 MPa, PLA_Z_FATIGA = 10-16 MPa a 1e5).
# Se usa la rama pesimista de las dos, que es la que decide.
S_1CICLO, S_FATIGA, N_REF = 25.0, 10.0, 1e5


def _humano_eps(v, ctx):
    """eps -> sigma nominal -> SF a fatiga -> ciclos -> cuantas veces la vida pedida."""
    E = ctx.get("E_MPa", 2500.0)          # viga_voladizo.py:38, PLA impreso
    kt = ctx.get("Kt", 1.20)              # gate_aristas.kt(R=0,5.t) = 1,20
    # sigma = E.eps en la fibra extrema. Coincide con la cuenta de viga_voladizo.py:134
    # (1,5.E.t.d/L^2), porque eps = 3.t.d/(2.L^2).
    sigma = E * v
    sigma_pico = sigma * kt
    sf = S_FATIGA / sigma_pico
    n = sf_a_ciclos(sf, S_1CICLO, S_FATIGA, N_REF) if sf > 0 else 0.0
    vida = ctx_req(ctx, "ciclos_pedidos", "eps -> vida util")
    return ("%.2f MPa nominales, %.2f MPa con Kt %.2f -> SF %.2f a fatiga = %.3g ciclos "
            "(%.2g veces los %g pedidos)" % (sigma, sigma_pico, kt, sf, n, n / vida, vida))


EPS_LAMINA_PLA = Criterio(
    "eps_max_lamina_PLA", 0.0035, "mm/mm", sentido="max",
    decide="deformacion maxima de una lamina elastica impresa; por encima la lamina se "
           "fisura por fatiga",
    origen=Origen.ENSAYO, nivel=Nivel.DURO,
    fuente="limite de fatiga del PLA impreso en Z 10-16 MPa a 1e5 ciclos "
           "(gate_aristas.PLA_Z_FATIGA); con E=2500 MPa y Kt=1,20 (R>=0,5.t), "
           "eps 0,0035 = 8,75 MPa nominales = 10,5 MPa pico -> SF 0,95 contra el "
           "extremo pesimista",
    a_humano=_humano_eps,
    ref="viga_voladizo.py:44 (EPS_PLA)")


def _humano_sf(v, ctx):
    n = sf_a_ciclos(v, S_1CICLO, S_FATIGA, N_REF)
    vida = ctx_req(ctx, "ciclos_pedidos", "SF -> vida util")
    txt = "SF %.2f le pide %.3g ciclos = %.0f veces los %g especificados" % (
        v, n, n / vida, vida)
    cd = ctx.get("ciclos_por_dia")
    if cd:
        dias = ctx.get("dias_por_anio", 250)
        txt += "; a %g ciclos/dia y %g dias/anio son %.0f anios" % (cd, dias,
                                                                   n / (cd * dias))
    return txt


# El SF 1,5 tal como esta hoy en viga_voladizo.py:137 y gate_aristas.py:507: NO tiene
# procedencia escrita. Declarado honestamente queda A_OJO, y entonces NO PUEDE RECHAZAR.
SF_FATIGA_MIN = Criterio(
    "sf_fatiga_min", 1.5, "-", sentido="min",
    decide="factor de seguridad minimo contra el limite de fatiga de un elastico impreso",
    origen=Origen.A_OJO, nivel=Nivel.AVISO,
    fuente="numero de manual generico, sin ensayo ni vida util detras. Aparece en "
           "viga_voladizo.py:137 y gate_aristas.py:507 sin justificacion",
    a_humano=_humano_sf,
    ref="viga_voladizo.py:137 / gate_aristas.py:507")


def _humano_presion(v, ctx):
    a = ctx_req(ctx, "area_mm2", "presion -> fuerza")
    return "%.0f gramos-fuerza sobre los %g mm2 de la banda de contacto" % (
        kpa_a_gramos(v, a), a)


PRESION_MIN = Criterio(
    "presion_min_contacto", 40.0, "kPa", sentido="min",
    decide="presion minima que un resorte del utillaje tiene que ejercer sobre la tela",
    origen=Origen.A_OJO, nivel=Nivel.AVISO,
    fuente="piso puesto a ojo. Rechazo la grilla entera de una busqueda cuando el diseno "
           "pedia un resorte blando; no hay ensayo ni especificacion de cliente detras",
    a_humano=_humano_presion,
    ref="piso de 40 kPa del incidente 2026-08")


ESPESOR_MIN_IMPRIMIBLE = Criterio(
    "espesor_min_imprimible", 1.2, "mm", sentido="min",
    decide="espesor minimo de una lamina que se pueda imprimir con paredes solidas",
    origen=Origen.CATALOGO, nivel=Nivel.DURO,
    fuente="3 perimetros de boquilla de 0,40 mm = 1,20 mm (boquilla real de la impresora)",
    a_humano=lambda v, ctx: "%.1f perimetros de boquilla 0,40 mm" % (v / 0.40),
    ref="viga_voladizo.py:63 (--t-min)")


MIN_FRAC_DENTRO = Criterio(
    "min_frac_saliente_dentro", 0.90, "-", sentido="min",
    decide="fraccion minima del saliente que tiene que caer dentro del contorno de la "
           "abertura para dar el ensamble por bueno",
    origen=Origen.A_OJO, nivel=Nivel.AVISO,
    fuente="umbral del gate sin procedencia escrita: no sale de la holgura de encastre ni "
           "de una medicion. Hoy en gate_ensamble.py:776 RECHAZA un ensamble entero",
    a_humano=lambda v, ctx: "un saliente de %g mm de ancho puede estar corrido %.2f mm "
                            "(aprox. rectangular)" % (
                                ctx_req(ctx, "ancho_mm", "fraccion -> corrimiento"),
                                (1.0 - v) * ctx_req(ctx, "ancho_mm",
                                                    "fraccion -> corrimiento")),
    ref="gate_ensamble.py:776 (--min-dentro)")


# =========================================================================================
print("=" * 88)
print("REGISTRO (que criterio puede tirar un diseno y cual solo avisa)")
print("=" * 88)
print(tabla())

print("\n" + "=" * 88)
print("2. EVALUACIONES REALES")
print("=" * 88)

print("\n-- A) el caso que motivo todo: una carrera que un tope sin procedencia rechazaba")
v = MIN_FRAC_DENTRO.evaluar(0.86, ancho_mm=12.0)
print(v.texto)
chequear(not v.rechaza,
         "un umbral A_OJO no puede rechazar (las 87 geometrias sobreviven)")
chequear(not v.cumple, "pero deja constancia de que no cumple")

print("\n-- B) el SF 1,5 traducido a vida util (el error que nadie tradujo)")
v = SF_FATIGA_MIN.evaluar(1.05, ciclos_pedidos=1e5, ciclos_por_dia=480,
                          dias_por_anio=250)
print(v.texto)
chequear(not v.rechaza, "SF sin procedencia: avisa, no rechaza")
n_15 = sf_a_ciclos(1.5, S_1CICLO, S_FATIGA, N_REF)
print("   -> SF 1,50 = %.4g ciclos ; SF 1,00 = %.4g ciclos (la vida especificada)"
      % (n_15, sf_a_ciclos(1.0, S_1CICLO, S_FATIGA, N_REF)))
chequear(n_15 / 1e5 > 100,
         "SF 1,5 pide >100x la vida especificada: por eso hacia falta traducirlo")

print("\n-- C) el piso de 40 kPa, en gramos")
v = PRESION_MIN.evaluar(22.0, area_mm2=47.7)
print(v.texto)
chequear(not v.rechaza, "piso de presion a ojo: no rechaza la grilla")
chequear(abs(kpa_a_gramos(40.0, 47.7) - 194.6) < 1.0,
         "40 kPa sobre 47,7 mm2 = 194,6 gf (cuenta verificable)")

print("\n-- D) un criterio CON procedencia si rechaza")
v = ESPESOR_MIN_IMPRIMIBLE.evaluar(1.05)
print(v.texto)
chequear(v.rechaza, "espesor de catalogo (boquilla): SI puede rechazar")
chequear(not bool(v), "bool(veredicto) es False cuando rechaza")
v = ESPESOR_MIN_IMPRIMIBLE.evaluar(1.6)
chequear(v.cumple and bool(v), "1,6 mm cumple (4 perimetros)")

print("\n-- E) el criterio de fatiga real (el que SI tiene que gobernar la lamina)")
v = EPS_LAMINA_PLA.evaluar(0.0042, ciclos_pedidos=1e5)
print(v.texto)
chequear(v.rechaza, "eps con procedencia de ensayo: rechaza 0,42 %")
v = EPS_LAMINA_PLA.evaluar(0.0030, ciclos_pedidos=1e5)
chequear(v.cumple, "0,30 % pasa")

print("\n" + "=" * 88)
print("3. LOS CASOS QUE TIENEN QUE FALLAR")
print("=" * 88)


def debe_reventar(exc, msg, fn):
    print("\n-- %s" % msg)
    try:
        fn()
    except exc as e:
        print("   [ESPERADO] %s: %s" % (exc.__name__, str(e).splitlines()[0]))
        for ln in str(e).splitlines()[1:]:
            print("              %s" % ln)
        chequear(True, msg)
        return
    except Exception as e:            # noqa: BLE001
        chequear(False, "%s -> levanto %s (esperaba %s)" % (msg, type(e).__name__,
                                                            exc.__name__))
        return
    chequear(False, "%s -> NO fallo (eso es el bug que este modulo evita)" % msg)


debe_reventar(
    TypeError, "F1: declarar un criterio SIN el argumento `fuente`",
    lambda: Criterio("tope_precarga", 0.90, "mm",
                     "tope de precarga de la lamina", Origen.FORMULA))

def _f2():
    c = Criterio("tope_precarga_vacio", 0.90, "mm",
                 "tope de precarga de la lamina", Origen.FORMULA, fuente="")
    return c.evaluar(0.92)          # el veneno revienta ACA, donde se usa

debe_reventar(SinProcedencia,
              "F2: fuente vacia -> se construye, pero revienta AL USARSE", _f2)


def _f3():
    c = Criterio("tope_precarga_tbd", 0.90, "mm",
                 "tope de precarga de la lamina", Origen.FORMULA, fuente="TBD")
    return float(c) * 2

debe_reventar(SinProcedencia, "F3: fuente 'TBD' -> float(criterio) revienta", _f3)


def _f4():
    return Criterio("tope_precarga_sin_numero", 0.90, "mm",
                    "tope de precarga de la lamina", Origen.FORMULA,
                    fuente="criterio de diseno habitual")

debe_reventar(SinProcedencia,
              "F4: fuente en prosa que no cita ningun numero ('criterio de diseno "
              "habitual')", lambda: _f4().evaluar(0.92))

debe_reventar(
    ProcedenciaInsuficiente,
    "F5: declarar DURO (puede rechazar) un numero puesto A_OJO",
    lambda: Criterio("piso_presion_duro", 40.0, "kPa",
                     "presion minima sobre la tela", Origen.A_OJO,
                     fuente="asi lo veniamos usando en 3 proyectos", nivel=Nivel.DURO,
                     sentido="min", a_humano=lambda v, c: "%.0f gf" % kpa_a_gramos(v, 47.7)))

debe_reventar(
    SinTraduccion,
    "F6: declarar DURO sin traduccion a unidad humana (el error del SF 1,5)",
    lambda: Criterio("sf_fatiga_duro", 1.5, "-",
                     "factor de seguridad minimo a fatiga", Origen.ENSAYO,
                     fuente="curva S-N PLA-Z, 10 MPa a 1e5 ciclos", nivel=Nivel.DURO,
                     sentido="min"))

debe_reventar(
    ValueError,
    "F7: un parametro HEREDADO de otro informe sin decir como se recalcula",
    lambda: Criterio("k_lamina_heredada", 7.5, "N/mm",
                     "rigidez de la lamina tomada del informe", Origen.HEREDADO,
                     fuente="informe de la variante anterior, tabla 3, k = 7,5 N/mm"))

debe_reventar(
    FaltaContexto,
    "F8: traducir a unidades humanas sin el dato que hace falta (no hay default inventado)",
    lambda: PRESION_MIN.evaluar(22.0))

print("\n-- F9: la tolerancia del 2 % que tapaba typos, traducida")
TOL_AUDITORIA = Criterio(
    "tol_auditoria_valores", 0.02, "-", sentido="max",
    decide="diferencia relativa tolerada al auditar un valor cargado contra el calculado",
    origen=Origen.A_OJO, nivel=Nivel.AVISO,
    fuente="tolerancia puesta a ojo. Con 2 % un consumo de 1,000 acepta hasta 1,020: tapa "
           "el typo de tipeo, que es el error que la auditoria busca",
    a_humano=lambda v, ctx: "sobre un valor de %g deja pasar hasta %.4g de error" % (
        ctx_req(ctx, "valor_tipico", "tolerancia -> error absoluto"),
        v * ctx_req(ctx, "valor_tipico", "tolerancia -> error absoluto")),
    ref="regla consumos-entregables.md (hoy ya corregida a 0,1 %)")
print(TOL_AUDITORIA.evaluar(0.015, valor_tipico=1.0).texto)
chequear(not TOL_AUDITORIA.evaluar(0.015, valor_tipico=1.0).rechaza,
         "tolerancia a ojo: avisa, no rechaza")

print("\n-- F10: el parametro heredado, recalculado, SI puede ser DURO")
K_HEREDADA = Criterio(
    "k_lamina_heredada", 7.5, "N/mm", sentido="min",
    decide="rigidez de la lamina que gobierna todo el tamano del utillaje",
    origen=Origen.HEREDADO,
    fuente="informe de la variante anterior, tabla 3: k = 7,5 N/mm",
    a_humano=lambda v, ctx: "%.2f N con la precarga de %g mm" % (
        v * ctx_req(ctx, "precarga_mm", "k -> fuerza"), ctx["precarga_mm"]),
    recalcular="k = E.b.t^3/(4.L^3) con la t, b y L medidas en MI geometria",
    ref="incidente 2026-08-07: el informe decia 7,5 y la formula daba 2,49")
chequear(not K_HEREDADA.puede_rechazar, "heredada sin recalcular: no puede rechazar")
K_PROPIA = K_HEREDADA.recalculado(
    2.49, nombre="k_lamina_propia", nivel=Nivel.DURO, origen=Origen.FORMULA,
    fuente="k = E.b.t^3/(4.L^3) = 2500*12*1,8^3/(4*26^3) = 2,49 N/mm (t=1,8 b=12 L=26 "
           "medidos sobre el STEP propio)")
chequear(K_PROPIA.puede_rechazar, "recalculada contra la geometria propia: ya puede rechazar")
print("   %s" % K_PROPIA.explicar(precarga_mm=0.85).splitlines()[0].strip())
print("   heredada 7,50 N/mm -> recalculada 2,49 N/mm  (3,01x de diferencia)")

print("\n" + "=" * 88)
if fallos:
    print("NO ANDA: %d comprobaciones fallaron" % len(fallos))
    for f in fallos:
        print("  - %s" % f)
    sys.exit(1)
print("ANDA: todas las comprobaciones dieron lo esperado, incluidos los 8 fallos "
      "que tienen que fallar.")
sys.exit(0)
