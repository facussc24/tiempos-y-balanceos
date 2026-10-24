#!/usr/bin/env python
# -*- coding: utf-8 -*-
#   C:\Dev\BarackMercosul\.venv-cad\Scripts\python.exe test_numeros_pagina.py
"""El control de numeros de la pagina (numeros_pagina.py, propuesta P13 / leccion 39) en las dos direcciones.

Sale de la falla del 20/10/2026: pasos.json del virolador decia «El tope de borde 2 queda a 0,1 mm» y «la barra queda
47 mm arriba del panel» con las medidas del auditor al lado (0,5755 y 69,6; los machos, que valen 0,1394 y 0,1404, y el
brazo B, 47,208, estan en el mismo JSON). Secciones: 1 que numeros saca, 2 el redondeo, 3 el estado de cada numero
(leido / contradice / dudoso / tipeado / exento) con su valor gemelo, 4 el mismo dato con dos valores, 5 NO MEDIDO,
6 aviso hasta el 31/10 y freno desde el 01/11 con la frase de Fak atada a la firma, 7 el autotest que tiene que poder
fallar, 8 la integracion con gate_entregable.py (G-E8) y que sin la opcion todo queda igual.
No borra nada: usa carpetas temporales nuevas."""
import contextlib
import io
import json
import os
import subprocess
import sys
import tempfile
from decimal import Decimal

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
os.environ["CAD_GATE_TEST"] = "1"        # --hoy (fecha simulada) solo vale con esto
import numeros_pagina as np_  # noqa: E402

try:
    sys.stdout.reconfigure(errors="replace")      # la consola de Windows (cp1252) no encodea el signo menos U+2212
except (AttributeError, ValueError):
    pass

PY = sys.executable
GATE = os.path.join(AQUI, "numeros_pagina.py")
fallos = []


def chequear(cond, msg):
    print("   %s  %s" % ("ok  " if cond else "FALLA", msg))
    if not cond:
        fallos.append(msg)


C = np_.canon()
R = np_.Reglas(C)

# las medidas del auditor del 20/10 (AUDITORIA_auditor.md l.57 y l.122-125), con la luz de los machos AL LADO del tope
MED = {"tope_borde_1_luz_mm": 0.577, "tope_borde_2_luz_mm": 0.5755, "tope_lateral_luz_mm": 2.016,
       "macho_1_plastico_luz_mm": 0.1394, "macho_2_plastico_luz_mm": 0.1404, "apoyo_tapizado_luz_mm": 0.495,
       "barra_a_panel_mm": 69.6, "brazo_B_a_panel_mm": 47.208, "choque_mm3": 239.9993, "brazo_deg": -73.7,
       "r_mango": 14.0, "margen_mm": 14.0}


def bloque(texto):
    return [{"fuente": "t", "linea": 1, "ruta": None, "texto": texto}]


def evaluar(texto, medidas=None):
    return np_.evaluar_datos(bloque(texto), medidas or [("medidas.json", MED)], C)


def estado(texto, medidas=None):
    return [(n["escrito"], n["estado"]) for n in evaluar(texto, medidas)["numeros"]]


def extraer(texto):
    h, su, _, _ = np_.extraer_clausula(texto, R)
    return [(x["texto_num"], x["unidad"]) for x in h], su


# ------------------------------------------------------------------------------------------------
print("1. QUE NUMEROS SACA (con unidad) Y QUE DEJA AFUERA (por forma)")
casos = [
    ("quedan 0,58 mm de luz", [("0,58", "mm")]),
    ("el choque da 240 mm³ y 12 mm2 y 3 mm^3", [("240", "mm3"), ("12", "mm2"), ("3", "mm3")]),
    ("abre 74° y 2 ° y 1,55 grados", [("74", "°"), ("2", "°"), ("1,55", "°")]),
    ("el PLA se ablanda a ~55 °C", [("55", "°C")]),
    ("12 N, 30 g, 2 kg, 100 %, 3 s, 5 min", [("12", "N"), ("30", "g"), ("2", "kg"), ("100", "%"), ("3", "s"), ("5", "min")]),
    ("luz 0,004 / 0,08 / 0,004 mm", [("0,004", "mm"), ("0,08", "mm"), ("0,004", "mm")]),
    ("simulado de 30 a 6 mm", [("30", "mm"), ("6", "mm")]),
    ("bloque de 40 x 20 x 10 mm", [("40", "mm"), ("20", "mm"), ("10", "mm")]),
    ("chaflan de 3-4 mm", [("3", "mm"), ("4", "mm")]),
    ("pin Ø3,40 engrane 8", [("3,40", "mm")]),
    ("agujero Ø5 cm", [("5", "cm")]),
    ("corte a 1 200 s", [("1 200", "s")]),
    ("brazo -2,8° y −2,8°", [("2,8", "°"), ("2,8", "°")]),
]
for texto, esperado in casos:
    got, _ = extraer(texto)
    chequear(got == esperado, "«%s» -> %s" % (texto, got))
# lo que NO es una medida: fechas, horas, versiones, normas, roscas, codigos, cantidades sin unidad
for texto in ["el lunes 26/10 y el 20/10/2026 y 2026-10-24", "a las 13:50 y 14:23:07", "la v16 y la V3.2 y version 15",
              "segun ISO 13854 e IATF 16949 y VW 50180 y EN 349", "tornillo M5 y M4x16 y M12 y rev. 3",
              "pieza P0064829", "24 de octubre de 2026", "3 patitas, 65 posiciones y 15 solidos",
              "las ranuras miden 53,7 x 13,0 y se angostan", "5 seg y 3 ms y 10 mm/s y 4 N/mm"]:
    got, _ = extraer(texto)
    chequear(got == [], "«%s» no saca ningun numero con unidad (da %s)" % (texto, got))
got, su = extraer("3 patitas y 53,7 x 13,0 y M5")
chequear(su >= 3 and got == [], "los numeros sin unidad se CUENTAN en sin_unidad (%d)" % su)
chequear(extraer("la M5 de 5 mm")[0] == [("5", "mm")], "«M5» no se toma por «5 m»; «5 mm» si")
v = np_.parse_num("2.016")
chequear(len(v) == 2 and v[0] == (Decimal("2.016"), 3) and v[1] == (Decimal("2016"), 0),
         "«2.016» es ambiguo (2,016 o 2016): devuelve los dos")
chequear(np_.parse_num("0,577") == [(Decimal("0.577"), 3)] and np_.parse_num("1.234,5") == [(Decimal("1234.5"), 1)]
         and np_.parse_num("171 459,136") == [(Decimal("171459.136"), 3)] and np_.parse_num("0.577") == [(Decimal("0.577"), 3)],
         "formato argentino (coma decimal, punto de miles, espacio de miles) y el decimal con punto")

# ------------------------------------------------------------------------------------------------
print("\n2. EL REDONDEO (intervalo de la cifra escrita, en Decimal)")
D = Decimal
chequear(np_.cae(D("0.58"), 2, D("0.577")) and np_.cae(D("0.58"), 2, D(str(0.5755))), "0,58 calza con 0,577 y con 0,5755")
chequear(all(np_.cae(D("0.1"), 1, D(str(x))) for x in (0.096, 0.1394, 0.1404)),
         "0,1 calza con 0,096 / 0,1394 / 0,1404 (por eso buscar solo por valor deja pasar la falla del 20/10)")
chequear(not np_.cae(D("0.1"), 1, D("0.5755")) and not np_.cae(D("0.58"), 2, D("0.8")) and not np_.cae(D("47"), 0, D("69.6")),
         "0,1 no calza con 0,5755; 0,58 no con 0,8; 47 no con 69,6")
chequear(np_.cae(D("47"), 0, D("47.208")) and np_.cae(D("70"), 0, D("69.6")) and np_.cae(D("0.0"), 1, D("-0.04")),
         "47 calza con 47,208; 70 con 69,6; el signo no importa")
chequear(np_.cae(D("0.5755"), 4, D(str(0.5754999999999999))), "0,5755 calza con el 0.5754999999999999 que da OpenCASCADE")

# ------------------------------------------------------------------------------------------------
print("\n3. EL ESTADO DE CADA NUMERO (con su valor gemelo)")
r = evaluar("El tope de borde 2 queda a 0,1 mm del plástico del borde.")
n = r["numeros"][0]
chequear(n["calza_por_valor"] >= 2 and n["estado"] == "contradice" and r["veredicto"] == "rojo",
         "LA FALLA REAL: «tope de borde 2 a 0,1 mm» calza por valor con %d medidas (los machos) y aun asi CONTRADICE "
         "tope_borde_2_luz_mm = 0,5755" % n["calza_por_valor"])
chequear(estado("El tope de borde 2 queda a 0,58 mm del plástico del borde.") == [("0,58 mm", "leido")],
         "gemelo: el mismo texto con 0,58 (el redondeo de 0,5755) esta LEIDO")
r = evaluar("La barra queda 47 mm arriba del panel.")
chequear(r["numeros"][0]["estado"] == "contradice" and r["numeros"][0]["calza_por_valor"] >= 1,
         "«la barra queda 47 mm arriba del panel»: calza con el brazo B (47,208) y CONTRADICE barra_a_panel_mm = 69,6")
chequear(estado("La barra queda 69,6 mm arriba del panel.") == [("69,6 mm", "leido")], "gemelo: con 69,6 esta leido")
chequear(estado("La rampa de entrada mide 12 mm.") == [("12 mm", "tipeado")], "un numero que no sale de ninguna medida: tipeado")
chequear(estado("El choque es de 240 mm³.") == [("240 mm³", "leido")],
         "clave de una palabra con su unidad (choque_mm3 = 239,9993): 240 mm³ leido")
chequear(estado("Entre machos y plástico quedan 0,14 mm.") == [("0,14 mm", "leido")],
         "los machos (0,1394 y 0,1404): «machos» y «plastico» son 2 palabras de macho_1_plastico_luz_mm: leido")
chequear(estado("Entre machos y el borde quedan 0,14 mm.") == [("0,14 mm", "dudoso")],
         "la misma cifra con una frase que solo comparte 1 palabra («macho») con la clave: dudoso, no leido")
chequear(estado("Frena el mango a 14° del punto.")[0][1] != "leido",
         "r_mango = 14,0 (un radio, clave de una palabra SIN unidad) NO lee el «14°» de la frase")
chequear(estado("Frena el mango a 14° del punto.", [("m.json", {"margen_mm": 14.0})])[0][1] in ("tipeado", "dudoso"),
         "margen_mm = 14 no lee un angulo (la clave declara mm y el numero es °)")
chequear(estado("El brazo abre 74° del cierre.") == [("74 °", "leido")],
         "brazo_deg = -73,7 (clave de una palabra con su unidad) lee «74°»: leido")
chequear(estado("El PLA se ablanda a 55 °C.", [("m.json", {"brazo_deg": 55.0})]) == [("55 °C", "tipeado")],
         "55 °C es una temperatura: no la lee una medida en grados angulares")
chequear(estado("Que funcione al 100 %.") == [("100 %", "exento")], "«al 100 %» que no calza con nada: exento (canon: redondos_logicos)")
chequear(estado("Que funcione al 100 %.", [("m.json", {"impacto_pct": 100.0})]) == [("100 %", "dudoso")],
         "100 % si calza con una medida pero la frase no la nombra: dudoso, no exento")
r = evaluar("La rampa mide 12 mm. El 20/10 a las 13:50 con la v16 segun ISO 13854 y M4x16: 3 patitas.")
chequear(r["rojos"] == 1 and len(r["numeros"]) == 1 and r["sin_unidad"] >= 1,
         "fechas, horas, versiones, normas y roscas no dan falso rojo (solo el 12 mm tipeado; «3 patitas» se cuenta sin unidad)")
r = evaluar("Traba: el diente frena el mango 2° pasado el punto muerto (a 14° queda 0,02 mm).",
            [("m.json", {"sobre_punto_muerto_deg": 3.0})])
chequear(all(x["estado"] != "contradice" for x in r["numeros"]),
         "dos numeros de la misma unidad en una frase (2° y 14°): la frase no dice cual es cual, no se acusa contradiccion")
r = evaluar("Ubicada atrás del borde del panel: el brazo llega 58 mm hasta la barra.")
chequear(r["numeros"][0]["estado"] in ("contradice", "tipeado") and r["veredicto"] == "rojo",
         "«el brazo llega 58 mm hasta la barra» no sale de ninguna medida: rojo (con barra_a_panel y brazo_B_a_panel "
         "nombrados por palabras distintas, la etiqueta puede ser contradice o tipeado)")
r = evaluar("La barra queda 47 mm arriba del panel.", [("m.json", dict(MED, panel_arriba_mm=30))])
chequear(r["numeros"][0]["estado"] == "contradice",
         "el 47 de la barra sigue contradiciendo barra_a_panel = 69,6 aunque otro JSON tenga panel_arriba_mm (palabras distintas)")
r = evaluar("Mango contra pedestal en todo el recorrido: libre hasta 142° (luz 1,1 mm), ahí hace tope.")
chequear(all(x["estado"] != "contradice" for x in r["numeros"]),
         "«luz 1,1 mm ... hace tope»: «tope» y «luz» estan en tres claves (borde 1, borde 2, lateral): ambiguo, no contradice")
r = evaluar("El tope de borde 2 queda a 0,1 mm del plástico del borde.", [("a.json", MED), ("b.json", dict(MED, tope_borde_2_luz_mm=0.8))])
chequear(r["numeros"][0]["estado"] == "contradice",
         "la misma clave en dos JSON (nuevo y viejo) es UN dato: el 0,1 sigue contradiciendo (0,5755 y 0,8)")
chequear(estado("Resumen: tope de borde 2, luz de 0,5755 mm.") == [("0,5755 mm", "leido")], "tope_borde_2_luz_mm lee 0,5755")
chequear(estado("El tope de borde 1 queda a 0,58 mm.", [("m.json", {"tope_borde_2_luz_mm": 0.5755})])[0][1] != "leido",
         "«borde 1» no lee tope_borde_2 (el numero suelto distingue el dato)")

# ------------------------------------------------------------------------------------------------
print("\n4. EL MISMO DATO CON DOS VALORES (firma barata, leccion 39)")
V1 = dict(MED, tope_borde_2_luz_mm=0.8)
M2 = [("medidas.json", MED), ("medidas_v1.json", V1)]
r = evaluar("El tope de borde 2 queda a 0,58 mm del plástico. Resumen: el tope de borde 2 queda a 0,8 mm del plástico.", M2)
chequear(len(r["dobles"]) == 1 and r["cuentas"]["tipeado"] == 0 and r["cuentas"]["contradice"] == 0
         and r["cuentas"]["leido"] == 2 and r["veredicto"] == "rojo",
         "0,58 y 0,8 del mismo dato, cada uno leido de un JSON: 1 doble, 0 tipeados, 0 contradicen")
r = evaluar("El tope de borde 2 queda a 0,58 mm del plástico. Resumen: el tope de borde 2 queda a 0,5755 mm del plástico.")
chequear(not r["dobles"] and r["veredicto"] == "verde", "0,58 y 0,5755 (distinta precision) no chocan: verde")
r = evaluar("El tope de borde 2 queda a 0,58 mm del plástico. Resumen: el tope de borde 2 queda a 0,6 mm del plástico.")
chequear(not r["dobles"], "0,58 y 0,6 (intervalos que se tocan) no chocan")
r = evaluar("Las patitas apoyan al cerrar (luz 0,004 / 0,08 / 0,004 mm). Simulado de 30 a 6 mm.")
chequear(not r["dobles"], "una lista «0,004 / 0,08 / 0,004» o un rango «de 30 a 6» dentro de una frase no es un dato con dos valores")
r = evaluar("El tope de borde 1 queda a 0,58 mm del plástico. El tope de borde 2 queda a 0,8 mm del plástico.", M2)
chequear(not r["dobles"], "«borde 1» y «borde 2» son datos distintos")
r = evaluar("La barra queda 69,6 mm arriba del panel. La barra queda 12 N arriba del panel.", M2)
chequear(not r["dobles"], "unidades distintas (mm y N): no es el mismo dato")
r = evaluar("Entre el tope y el panel hay 0,58 mm de luz. Entre el macho y el soporte hay 0,8 mm de luz.", M2)
chequear(not r["dobles"], "dos frases que solo comparten «luz» no son el mismo dato")
a = evaluar("El tope de borde 2 queda a 0,58 mm del plástico.", [("medidas.json", MED)])["numeros"][0]
b = dict(a)
b["valores"] = [(Decimal("0.8"), 1)]
chequear(np_.chocan(a, b) and not np_.chocan(a, dict(a, valores=[(Decimal("0.5755"), 4)])), "chocan(): 0,58 contra 0,8 si; contra 0,5755 no")

# ------------------------------------------------------------------------------------------------
print("\n5. NO MEDIDO (nunca verde)")


def no_medido(nombre, f, texto):
    try:
        f()
    except np_.NoMedido as ex:
        chequear(texto in str(ex), "%s: NO MEDIDO (%s)" % (nombre, str(ex)[:80]))
        return
    except Exception as ex:                                      # noqa: BLE001
        chequear(False, "%s: se esperaba NoMedido y salio %s: %s" % (nombre, type(ex).__name__, ex))
        return
    chequear(False, "%s: se esperaba NoMedido y no levanto nada" % nombre)


W = os.path.join(tempfile.gettempdir(), "test_numeros_pagina_%s" % __import__("time").strftime("%Y%m%d_%H%M%S"))
os.makedirs(W, exist_ok=True)


def archivo(nombre, contenido):
    ruta = os.path.join(W, nombre)
    with open(ruta, "w", encoding="utf-8", newline="") as f:
        f.write(contenido if isinstance(contenido, str) else json.dumps(contenido, ensure_ascii=False, indent=1))
    return ruta


PAGINA_MAL = {"pasos": [{"titulo": "Fase 2", "decidido": ["El tope de borde 2 queda a 0,1 mm del plástico del borde.",
                                                           "La barra queda 47 mm arriba del panel."]}]}
PAGINA_BIEN = {"pasos": [{"titulo": "Fase 2", "decidido": ["El tope de borde 2 queda a 0,58 mm del plástico del borde.",
                                                            "La barra queda 69,6 mm arriba del panel."]}]}
f_mal, f_bien, f_med = archivo("mal.json", PAGINA_MAL), archivo("bien.json", PAGINA_BIEN), archivo("medidas.json", MED)
no_medido("sin ningun JSON de medidas", lambda: np_.evaluar([f_bien], []), "ningun JSON de medidas")
no_medido("sin ningun JSON de medidas (datos)", lambda: np_.evaluar_datos(bloque("Mide 0,58 mm."), []), "ningun JSON de medidas")
no_medido("un JSON de medidas sin un solo numero", lambda: np_.evaluar([f_bien], [archivo("vacio.json", {"a": "x", "b": [True, None]})]),
          "ningun JSON de medidas trae un numero")
no_medido("una fuente sin ningun numero con unidad", lambda: np_.evaluar([archivo("sin.json", {"t": "nada que medir, 3 patitas"})], [f_med]),
          "ningun numero con unidad")
no_medido("la fuente es a la vez medida", lambda: np_.evaluar([f_bien], [f_bien]), "es la propia fuente")
no_medido("la medida es una copia de la fuente", lambda: np_.evaluar([f_bien], [archivo("copia.json", PAGINA_BIEN)]), "es la propia fuente")
no_medido("una fuente que no existe", lambda: np_.evaluar([os.path.join(W, "no_esta.json")], [f_med]), "no existe la fuente")
no_medido("una fuente JSON rota", lambda: np_.evaluar([archivo("roto.json", "{no es json")], [f_med]), "no es un JSON valido")
no_medido("un JSON de medidas roto", lambda: np_.evaluar([f_bien], [archivo("medroto.json", "[1, 2")]), "no se pudo leer el JSON de medidas")

# ------------------------------------------------------------------------------------------------
print("\n6. AVISO HASTA EL 31/10, FRENO DESDE EL 01/11, CON LA FRASE DE FAK ATADA A LA FIRMA")
chequear(C["aviso_hasta"] == "2026-10-31", "el canon dice aviso_hasta 2026-10-31 (%s)" % C["aviso_hasta"])
from datetime import date  # noqa: E402
chequear(np_.modo_numeros("rojo", date(2026, 10, 31), C["aviso_hasta"]) == "aviso"
         and np_.modo_numeros("rojo", date(2026, 11, 1), C["aviso_hasta"]) == "freno"
         and np_.modo_numeros("rojo", date(2026, 11, 1), C["aviso_hasta"], True) == "aceptado"
         and np_.modo_numeros("verde", date(2026, 11, 1), C["aviso_hasta"]) == "verde"
         and np_.modo_numeros("aviso", date(2027, 1, 1), C["aviso_hasta"]) == "aviso",
         "modo: el 31/10 aviso, el 01/11 freno, aceptado con la frase, verde siempre verde, lo dudoso nunca frena")


def cli(args, hoy=None, env_extra=None, test=True):
    env = dict(os.environ)
    if test:
        env["CAD_GATE_TEST"] = "1"
    else:
        env.pop("CAD_GATE_TEST", None)
    env.update(env_extra or {})
    cmd = [PY, "-I", GATE] + args + (["--hoy", hoy] if hoy else [])
    r = subprocess.run(cmd, capture_output=True, env=env, timeout=300)
    out = r.stdout.decode("utf-8", errors="replace")
    lineas = [x for x in out.splitlines() if x.startswith('{"gate": "numeros_pagina"')]
    return r.returncode, out, (json.loads(lineas[-1]) if lineas else {})


rc, out, j = cli(["--fuentes", f_mal, "--medidas", f_med], hoy="2026-10-31")
chequear(rc == 0 and "AVISO" in out and j.get("veredicto") == "rojo" and j.get("modo") == "aviso" and j.get("contradicen") == 2,
         "pagina del 20/10 el 31/10: AVISO (exit 0), 2 contradicen su medida (0,1 y 47)")
chequear("0,1 mm" in out and "47 mm" in out and "tope_borde_2_luz_mm = 0.5755" in out and "barra_a_panel_mm = 69.6" in out,
         "dice cuales son los dos numeros y contra que medida chocan")
rc, out, j = cli(["--fuentes", f_mal, "--medidas", f_med], hoy="2026-11-01")
chequear(rc == 1 and "FRENO" in out and j.get("modo") == "freno", "el 01/11 la misma pagina FRENA (exit 1)")
rc, out, j = cli(["--fuentes", f_bien, "--medidas", f_med], hoy="2026-11-01")
chequear(rc == 0 and j.get("veredicto") == "verde" and j.get("leidos") == 2, "el 01/11 la pagina bien leida da verde (exit 0)")
rc, out, j = cli(["--fuentes", f_mal], hoy="2026-11-01")
chequear(rc == 2 and "NO MEDIDO" in out and j.get("veredicto") == "no_medido", "sin --medidas: NO MEDIDO (exit 2), el 01/11 tambien")
rc, out, j = cli(["--fuentes", f_bien, "--medidas", f_bien])
chequear(rc == 2 and "propia fuente" in out, "una fuente pasada tambien como medida: NO MEDIDO (exit 2)")
rc, out, j = cli(["--fuentes", f_mal, "--medidas", f_med], hoy="2026-10-31", test=False)
chequear(rc == 2 and "CAD_GATE_TEST" in out, "--hoy sin CAD_GATE_TEST=1 no se acepta (exit 2): la fecha simulada es solo de los tests")
wd = os.path.join(W, "wd")
FRASE = "Fak: asumo el 0,1 y el 47 de esa pagina"
rc, out, j = cli(["--fuentes", f_mal, "--medidas", f_med, "--acepto-numeros", "ok", "--workdir", wd], hoy="2026-11-01")
chequear(rc == 1 and "frase corta" in out, "--acepto-numeros con una frase corta: no se acepta (exit 1)")
rc, out, j = cli(["--fuentes", f_mal, "--medidas", f_med, "--acepto-numeros", FRASE], hoy="2026-11-01")
chequear(rc == 1 and "--workdir" in out, "la aceptacion sin --workdir no se acepta (queda en el manifest)")
rc, out, j = cli(["--fuentes", f_mal, "--medidas", f_med, "--acepto-numeros", FRASE, "--workdir", wd], hoy="2026-11-01")
chequear(rc == 0 and "ACEPTADO" in out and j.get("modo") == "aceptado", "con la frase de Fak y --workdir: ACEPTADO (exit 0)")
man = json.load(open(os.path.join(wd, "manifest.json"), encoding="utf-8"))
acep = [e for e in man["evidence"] if e["kind"] == "numeros_aceptados"]
chequear(len(acep) == 1 and acep[0]["frase"] == FRASE and acep[0]["fuentes_firma"] == j.get("fuentes_firma")
         and acep[0]["fecha"] == "2026-11-01" and acep[0]["cantidad"] == 2,
         "el manifest guarda la frase, la fecha, la firma de la fuente y la cantidad")
# la misma pagina retocada es otra firma: la frase vieja no vale
f_mal2 = archivo("mal2.json", dict(PAGINA_MAL, extra="otra cosa"))
os.replace(f_mal2, f_mal)
rc, out, j = cli(["--fuentes", f_mal, "--medidas", f_med, "--acepto-numeros", FRASE, "--workdir", wd], hoy="2026-11-01")
chequear(rc == 1 and "otra version" in out, "la pagina retocada es otra firma: la frase que acepto la anterior NO vale (exit 1)")
rc, out, j = cli(["--fuentes", f_mal, "--medidas", f_med, "--acepto-numeros", "Fak: miro esta version y la acepto", "--workdir", wd],
                 hoy="2026-11-01")
chequear(rc == 0 and "ACEPTADO" in out, "otra frase para la version nueva: ACEPTADO")
# html con entidades y etiquetas
f_html = archivo("pagina.html", "<!doctype html><html><head><style>p{color:red}</style></head><body>\n"
                 "<p>El tope de borde 2 queda a <b>0,58</b>&nbsp;mm del pl&aacute;stico del borde.</p>\n"
                 "<ul><li>La barra queda 69,6 mm arriba del panel</li><li>El 20/10 con la v16</li></ul></body></html>\n")
rc, out, j = cli(["--fuentes", f_html, "--medidas", f_med], hoy="2026-11-01")
chequear(rc == 0 and j.get("leidos") == 2 and j.get("numeros") == 2, "una pagina .html (etiquetas, &nbsp;, &aacute;): lee sus 2 numeros")
# la carpeta real del 20/10, si esta (informativo: el pasos.json de las 16:03 ya no tiene las dos frases)
REAL = r"C:\Dev\_catia_practica\virolador_auto"
SHA_REAL = "e656e907371b4c8c21c8591426109adf294f9dee0ecfc09d92db844691698987"
try:
    import hashlib
    ok_real = hashlib.sha256(open(os.path.join(REAL, "pasos.json"), "rb").read()).hexdigest() == SHA_REAL
except OSError:
    ok_real = False
if ok_real:
    meds = [os.path.join(REAL, x) for x in ("moviles.json", "palanca.json", "sim_carga.json", "sim_rapida.json",
                                            "tope_mango.json", os.path.join("medir", "geom.json"))]
    rc, out, j = cli(["--fuentes", os.path.join(REAL, "pasos.json"), "--medidas"] + meds, hoy="2026-10-24")
    chequear(rc == 0 and j.get("medido") is True and j.get("numeros") == 25 and j.get("tipeados", 0) >= 3,
             "pasos.json real de las 16:03 con los JSON del modelo: mide (25 numeros con unidad, %s tipeados, %s dudosos)"
             % (j.get("tipeados"), j.get("dudosos")))
else:
    print("   (la carpeta del 20/10 con pasos.json sha256 e656e907... no esta: se saltea la corrida real)")

# ------------------------------------------------------------------------------------------------
print("\n7. EL AUTOTEST PUEDE FALLAR (codigo 3)")
chequear(np_.autotest(C) == [], "el autotest del control sano no tiene problemas")
original = np_.clasificar


def solo_por_valor(num, hojas, c):
    """El control ciego: lee un numero si el valor calza con CUALQUIER medida, sin mirar de que habla la frase."""
    num["calza_por_valor"] = 0
    ok = [h for h in hojas if any(np_.cae(v, d, h["valor"]) for v, d in num["valores"])]
    num["calza_por_valor"] = len(ok)
    num["estado"] = "leido" if ok else "tipeado"
    num["medidas"] = [(h["archivo"], h["ruta"], str(h["valor"])) for h in ok[:3]]


np_.clasificar = solo_por_valor
try:
    prob = np_.autotest(C)
    chequear(any("MAL 1" in x for x in prob), "un control que busca solo por valor deja pasar el 0,1: el autotest lo delata (%d problema(s))" % len(prob))
    with contextlib.redirect_stdout(io.StringIO()) as buf:
        rc = np_.main(["--solo-autotest"])
    chequear(rc == 3 and "AUTOTEST FALLA" in buf.getvalue(), "main() con el control ciego sale con codigo 3 y no juzga nada")
finally:
    np_.clasificar = original
orig_rel = np_.relacion
np_.relacion = lambda *a, **k: 0
try:
    chequear(np_.autotest(C) != [], "un control que no relaciona frases con medidas tampoco pasa el autotest")
finally:
    np_.relacion = orig_rel
orig_dobles = np_.dobles_de
np_.dobles_de = lambda numeros, c: []
try:
    chequear(any("MAL 3" in x for x in np_.autotest(C)), "un control sin la regla del dato con dos valores no pasa el autotest")
finally:
    np_.dobles_de = orig_dobles
with contextlib.redirect_stdout(io.StringIO()) as buf:
    rc = np_.main(["--solo-autotest"])
chequear(rc == 0, "restaurado: el autotest vuelve a pasar (exit 0)")

# ------------------------------------------------------------------------------------------------
print("\n8. INTEGRACION CON gate_entregable.py (G-E8) Y QUE SIN LA OPCION TODO QUEDA IGUAL")
import gate_entregable as ge  # noqa: E402
from cadlib import workdir as wd_  # noqa: E402

ISO = ("ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION(('x'),'2;1');\nFILE_NAME('x','2026',('A'),('B'),'OC','OC','U');\n"
       "FILE_SCHEMA(('AUTOMOTIVE_DESIGN'));\nENDSEC;\nDATA;\nENDSEC;\nEND-ISO-10303-21;\n")


def entrega():
    td = tempfile.mkdtemp(dir=W)
    ent = os.path.join(td, "entrega")
    os.makedirs(ent)
    open(os.path.join(ent, "pieza.pdf"), "w").write("pdf")
    open(os.path.join(ent, "simulacion.mp4"), "w").write("mp4")
    open(os.path.join(ent, "pieza.step"), "w").write(ISO)
    os.utime(os.path.join(ent, "pieza.pdf"), None)
    return ent, wd_.ensure_workdir(os.path.join(td, "w"))


def correr(ent, w, **kw):
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        rc = ge.verificar(ent, "foto3d", [], w, sin_render=True, motivo_sin_render="test", **kw)
    return rc, buf.getvalue()


ent, w = entrega()
rc0, out0 = correr(ent, w)
chequear("G-E8" not in out0 and "numeros de la pagina" not in out0.lower(),
         "SIN las opciones nuevas no aparece ninguna linea nueva (G-E8 no se nombra)")
rc1, out1 = correr(ent, w, fuentes_pagina=[f_mal], medidas=[f_med])
chequear(rc1 == rc0 and "G-E8" in out1 and "AVISO" in out1 and "0,1 mm" in out1 and "47 mm" in out1,
         "con la pagina del 20/10: G-E8 AVISO nombra el 0,1 mm y el 47 mm y el gate no cambia de veredicto (rc %s)" % rc1)
chequear(rc1 == 0 and "ROJO" not in out1 and "VERDE — el entregable" in out1,
         "el G-E8 con rojo es AVISO: el entregable sigue en VERDE (el freno de este control es del comando)")
rc2, out2 = correr(ent, w, fuentes_pagina=[f_bien], medidas=[f_med])
chequear(rc2 == 0 and "G-E8 · numeros de la pagina: VERDE" in out2 and "AVISO  G-E8" not in out2,
         "con la pagina leida del JSON: G-E8 en verde, sin aviso")
rc3, out3 = correr(ent, w, fuentes_pagina=[f_bien])
chequear(rc3 == 0 and "G-E8 · NO MEDIDO" in out3 and "AVISO  G-E8" in out3,
         "pagina sin --medidas: G-E8 dice NO MEDIDO, nunca OK")
rc4, out4 = correr(ent, w, medidas=[f_med])
chequear(rc4 == 0 and "G-E8 · NO MEDIDO" in out4, "--medidas sin --fuentes-pagina: NO MEDIDO tambien")
rc5, out5 = correr(ent, w, fuentes_pagina=[f_bien], medidas=[f_bien])
chequear("G-E8 · NO MEDIDO" in out5 and "propia fuente" in out5, "la fuente como medida (circular): NO MEDIDO")
original_auto = np_.autotest
np_.autotest = lambda c=None: ["MAL 1: el control quedo ciego"]
try:
    rc6, out6 = correr(ent, w, fuentes_pagina=[f_mal], medidas=[f_med])
    chequear(rc6 == 0 and "G-E8 · NO MEDIDO" in out6 and "autotest" in out6, "si el autotest del control no separa, G-E8 no juzga y lo dice")
finally:
    np_.autotest = original_auto
# por la linea de comandos de gate_entregable.py (argparse)
r = subprocess.run([PY, "-I", os.path.join(AQUI, "gate_entregable.py"), "--entrega", ent, "--motor", "foto3d", "--sin-render",
                    "--reason", "test", "--fuentes-pagina", f_mal, "--medidas", f_med], capture_output=True, timeout=300)
sal = r.stdout.decode("utf-8", errors="replace")
chequear(r.returncode == 0 and "G-E8" in sal, "gate_entregable.py --fuentes-pagina <archivo> --medidas <json> por la linea de comandos: G-E8 en la salida")
r = subprocess.run([PY, "-I", os.path.join(AQUI, "gate_entregable.py"), "--entrega", ent, "--motor", "foto3d", "--sin-render",
                    "--reason", "test"], capture_output=True, timeout=300)
chequear(r.returncode == 0 and "G-E8" not in r.stdout.decode("utf-8", errors="replace"), "la misma linea de comandos sin las opciones nuevas: sin G-E8")

print("")
print("RESULTADO:", "OK" if not fallos else "%d falla(s)" % len(fallos))
print("(carpeta del test: %s)" % W)
sys.exit(1 if fallos else 0)
