#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""NUMEROS DE LA PAGINA — que ningun numero con unidad de la pagina de entrega este escrito a mano.

POR QUE EXISTE (fallo real, leccion 39 de reference/lecciones-caras.md y propuesta P13 de
docs/PROPUESTAS_SKILL_3D_2026-10-23.md l.481-500). El 20/10/2026 la pagina de avance del virolador manual salio con
numeros tipeados: «El tope de borde 2 queda a 0,1 mm del plastico del borde» (el auditor midio 0,5755; el 0,1 era la
luz de otra pieza, un macho) y «la barra queda 47 mm arriba del panel» (el 47 era el brazo B; la barra estaba a 69,6).
Los dos fueron numeros escritos a mano en pasos.json; los gates daban verde porque ninguno mira un texto
(AUDITORIA_auditor.md hallazgos 3 y 8). La leccion 39 lo dice: si el dato existe en el JSON, el documento lo LEE; si hay
que escribirlo a mano, es que falta publicarlo.

QUE HACE. Recibe las FUENTES de la pagina (pasos.json, un .md/.txt/.html que la arma) y uno o mas JSON de MEDIDAS del
modelo (manifest.json del workdir, params, registro de medidas, salida de gates). Saca de las fuentes cada numero con
unidad (mm, mm2, mm3, grados o °, N, g, kg, %, s y las que declara numerosCanon.data.json) y lo busca en las hojas
numericas de los JSON, con el redondeo con que esta escrito («0,58» calza con 0,577; intervalo de la cifra escrita,
calculado en Decimal). Cada numero queda en uno de estos estados:

    leido       el valor calza con una medida Y la frase nombra esa medida (comparten 2 palabras con contenido con el
                nombre de la clave: «tope» y «borde» en tope_borde_2_luz_mm). Verde.
    tipeado     no calza con ninguna medida y la frase no nombra ninguna. ROJO.
    contradice  la frase nombra una medida (tope_borde_2_luz_mm = 0,5755) y el numero escrito es otro, aunque ese
                numero calce por redondeo con la medida de OTRA cosa (0,1 calza con la luz de un macho de 0,1394). ROJO.
                Es la falla real del 20/10: buscar solo por valor deja pasar el 0,1.
    dudoso      el valor calza pero la frase no nombra esa medida (solo 1 palabra en comun o ninguna). AVISO, nunca frena.
    exento      0 % o 100 % que no calza con nada (canon: redondos_logicos).
Ademas, la «firma barata» de la leccion 39: un MISMO dato (misma unidad y frases que hablan de lo mismo) con DOS valores
cuyos intervalos de redondeo no se tocan, en lugares distintos de la pagina. ROJO.
Sin unidad no se juzga (cantidades de piezas, «53,7 x 13,0»); se cuentan en sin_unidad. Fechas, versiones («v16»),
normas («ISO 13854»), roscas («M5»), horas y codigos se enmascaran por FORMA (nunca por palabra): numerosCanon.data.json,
cada una con su motivo.

SI NO LE PASAN NINGUN JSON DE MEDIDAS, o ninguno trae un numero, o una fuente es a la vez medida (circular), o la fuente
no trae ningun numero con unidad: NO MEDIDO (exit 2). Nunca verde.

SALIDA PARA FAK. Hasta el 31/10/2026 un rojo AVISA (exit 0). Desde el 01/11 un rojo FRENA (exit 1) con una sola salida:
--acepto-numeros "<frase de Fak, 10+ caracteres>" con --workdir; queda en el manifest atada a la firma de la fuente
(patron de gate_aristas.py --acepto-cantos). Lo dudoso avisa siempre y no frena nunca.

AUTOTEST propio BIEN/MAL en CADA corrida (no se puede saltear): una pagina leida del JSON da verde; la falla real (0,1
contra una medida que dice 0,5755 con la luz de los machos en 0,1394 al lado), un numero tipeado y un mismo dato con dos
valores dan rojo, y las fechas, versiones y normas no dan falso rojo. Si no separa, sale con codigo 3 y NO juzga nada.

USO
    numeros_pagina.py --fuentes pasos.json [pagina.html ...] --medidas manifest.json [params.json ...]
                      [--workdir W] [--json out.json] [--acepto-numeros "<frase de Fak>"] [--detalle]
    numeros_pagina.py --solo-autotest            # probar el control sin juzgar ninguna pagina

CODIGOS DE SALIDA
    0  verde, AVISO (incluye el rojo hasta el 31/10) o ACEPTADO con la frase de Fak
    1  FRENO (rojo desde el 01/11), frase corta, frase usada para otra firma, aceptacion sin --workdir
    2  NO MEDIDO (sin JSON de medidas, fuente ilegible, circular, sin ningun numero con unidad): nunca verde
    3  el AUTOTEST fallo: el control no probo distinguir, no se juzga nada
"""
import argparse
import hashlib
import html
import json
import math
import os
import re
import sys
import time
import unicodedata
from decimal import Decimal, InvalidOperation

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
CANON = os.path.join(AQUI, "numerosCanon.data.json")

# un numero: con miles por espacio («1 200», «171 459,136»), o plano con coma o punto decimal
NUM = r"(?:\d{1,3}(?:[   ]\d{3})+(?:,\d+)?(?!\d)|\d+(?:[.,]\d+)*)"
SEP = r"(?:\s*[x×/–—-]\s*|\s+(?:a|y|al)\s+)"
SIN_LETRA_ANTES = r"(?<![\w.,])"
RE_CLAUSULA = re.compile(r"(?<=[.!?;])\s+|\s*[;\n]\s*|\s+[·•]\s+")
RE_SOLO_NUM = re.compile(r"(%s)" % NUM)


class NoMedido(Exception):
    """La medicion no se pudo hacer: el control NUNCA da verde en este caso (exit 2)."""


# =========================================================================================
# CANON, FECHA Y MODO
# =========================================================================================
def canon():
    with open(CANON, encoding="utf-8") as f:
        return json.load(f)


def hoy_numeros(hoy_arg=None):
    """La fecha de hoy. --hoy o CAD_HOY solo valen con CAD_GATE_TEST=1 (los tests); si no, el reloj."""
    from datetime import date
    simulada = hoy_arg or os.environ.get("CAD_HOY", "").strip() or None
    if simulada:
        if os.environ.get("CAD_GATE_TEST") != "1":
            raise NoMedido("--hoy / CAD_HOY solo valen con CAD_GATE_TEST=1 (fecha simulada de los tests)")
        return date.fromisoformat(simulada)
    return date.today()


def modo_numeros(veredicto, hoy, aviso_hasta, aceptada=False):
    """verde | aviso | aceptado | freno. Una sola funcion para el control, el gate de entrega y los tests.

    Solo un ROJO frena, y solo despues del aviso_hasta; el veredicto 'aviso' (solo numeros dudosos) nunca frena."""
    from datetime import date
    if isinstance(aviso_hasta, str):
        aviso_hasta = date.fromisoformat(aviso_hasta)
    if veredicto == "verde":
        return "verde"
    if veredicto == "aviso":
        return "aviso"
    if aceptada:
        return "aceptado"
    return "aviso" if hoy <= aviso_hasta else "freno"


def _dia_siguiente(iso):
    from datetime import date, timedelta
    return (date.fromisoformat(iso) + timedelta(days=1)).isoformat()


# =========================================================================================
# NUMEROS Y PALABRAS
# =========================================================================================
def parse_num(txt):
    """Lee un numero escrito a la argentina o a la inglesa. Devuelve [(Decimal, decimales)], el principal primero.

    «0,577» -> 0.577 (3 decimales). «2.016» es ambiguo (2,016 o dos mil dieciseis): devuelve los dos."""
    t = txt.replace(" ", " ").replace(" ", " ").strip()
    if " " in t:                                           # miles por espacio: «1 200,5»
        t = t.replace(" ", "")
        ent, _, dec = t.partition(",")
        return [(Decimal(ent + ("." + dec if dec else "")), len(dec))]
    if "," in t and "." in t:                              # el ultimo separador es el decimal
        i = max(t.rfind(","), t.rfind("."))
        ent = re.sub(r"[.,]", "", t[:i])
        dec = t[i + 1:]
        return [(Decimal(ent + "." + dec), len(dec))]
    if t.count(",") > 1 or t.count(".") > 1:               # solo miles: «1,234,567» / «1.234.567»
        return [(Decimal(re.sub(r"[.,]", "", t)), 0)]
    if "," in t:
        ent, dec = t.split(",")
        return [(Decimal(ent + "." + dec), len(dec))]
    if "." in t:
        ent, dec = t.split(".")
        principal = (Decimal(t), len(dec))
        if len(dec) == 3 and 1 <= len(ent) <= 3 and not ent.startswith("0"):
            return [principal, (Decimal(ent + dec), 0)]    # «2.016»: tambien puede ser 2016
        return [principal]
    return [(Decimal(t), 0)]


def cae(valor_escrito, decimales, medida):
    """El numero escrito (con sus decimales) es el redondeo de la medida? Intervalo de la ultima cifra, en Decimal."""
    tol = Decimal("0.5") * (Decimal(10) ** (-decimales))
    return abs(abs(medida) - abs(valor_escrito)) <= tol


def _sin_acentos(s):
    s = unicodedata.normalize("NFKD", s.lower())
    return "".join(ch for ch in s if not unicodedata.combining(ch))


def _stem(w):
    return w[:-1] if len(w) > 3 and w.endswith("s") else w


def tokens_texto(texto, ignorar):
    """(palabras con contenido, numeros sueltos) de una frase ya sin los numeros con unidad."""
    t = _sin_acentos(texto)
    palabras = set()
    for w in re.findall(r"[a-z][a-z0-9]*", t):
        w = _stem(w)
        if len(w) >= 2 and w not in ignorar:
            palabras.add(w)
    enteros = set(re.findall(r"(?<![\w.,])\d+(?![\w]|[.,]\d)", t))
    return palabras, enteros


def tokens_clave(clave, ignorar, pistas):
    """(palabras, numeros sueltos, ultima palabra) del nombre de una clave de JSON: tope_borde_2_luz_mm."""
    k = re.sub(r"([a-z])([A-Z])", r"\1_\2", str(clave))
    partes = [p for p in re.split(r"[^a-z0-9]+", _sin_acentos(k)) if p]
    palabras, enteros = set(), set()
    for p in partes:
        if p.isdigit():
            enteros.add(p)
            continue
        w = _stem(p)
        if len(w) >= 2 and w not in ignorar and w not in pistas:
            palabras.add(w)
    return palabras, enteros, (partes[-1] if partes else None)


# =========================================================================================
# REGLAS COMPILADAS DEL CANON
# =========================================================================================
class Reglas:
    def __init__(self, c):
        self.c = c
        self.mascaras = [(e["id"], re.compile(e["regex"], re.I if "i" in e.get("flags", "") else 0))
                         for e in c["enmascarar"]]
        self.forma_a_unidad = {}
        for uid, formas in c["unidades"].items():
            for f in formas:
                self.forma_a_unidad[f] = uid
        alt = "|".join(re.escape(f) for f in sorted(self.forma_a_unidad, key=len, reverse=True))
        self.re_principal = re.compile(
            SIN_LETRA_ANTES + r"(?P<signo>[-−])?(?P<cadena>" + NUM + r"(?:" + SEP + NUM + r")*)\s*"
            r"(?P<unidad>" + alt + r")(?![\w²³/])")
        simbolos = "".join(c["unidad_implicita"].keys())
        self.re_implicita = re.compile(
            SIN_LETRA_ANTES + r"(?P<simbolo>[" + re.escape(simbolos) + r"])\s*(?P<num>" + NUM + r")"
            r"(?:\s*(?P<unidad>" + alt + r")(?![\w²³/]))?")
        self.re_num = re.compile(NUM)
        self.ignorar = set(c["ignorar_palabras"])
        self.pistas = c["pistas_de_unidad_en_clave"]
        self.etiquetas = set(c["etiquetas_hermanas"])


def enmascarar(texto, reglas):
    """Reemplaza por espacios las fechas, versiones, normas, roscas, horas y codigos (misma longitud)."""
    for _, rx in reglas.mascaras:
        texto = rx.sub(lambda m: " " * len(m.group(0)), texto)
    return texto


def extraer_clausula(clausula, reglas):
    """Los numeros con unidad de una frase. -> (lista de dicts, cantidad sin unidad, palabras, enteros)."""
    masc = enmascarar(clausula, reglas)
    hallados, huecos = [], []
    for m in reglas.re_principal.finditer(masc):
        unidad = reglas.forma_a_unidad[m.group("unidad")]
        for nm in reglas.re_num.finditer(m.group("cadena")):
            hallados.append({"escrito": "%s %s" % (nm.group(0), m.group("unidad")), "texto_num": nm.group(0),
                             "unidad": unidad, "implicita": False, "inicio": m.start()})
        huecos.append((m.start(), m.end()))
    for m in reglas.re_implicita.finditer(masc):
        if any(a <= m.start() < b for a, b in huecos):
            continue
        if m.group("unidad"):
            unidad, esc = reglas.forma_a_unidad[m.group("unidad")], "%s%s %s" % (m.group("simbolo"), m.group("num"), m.group("unidad"))
        else:
            unidad, esc = reglas.c["unidad_implicita"][m.group("simbolo")], "%s%s" % (m.group("simbolo"), m.group("num"))
        hallados.append({"escrito": esc, "texto_num": m.group("num"), "unidad": unidad, "implicita": True,
                         "inicio": m.start()})
        huecos.append((m.start(), m.end()))
    resto = list(masc)
    for a, b in huecos:
        for i in range(a, b):
            resto[i] = " "
    resto = "".join(resto)
    sin_unidad = len(re.findall(SIN_LETRA_ANTES + NUM, resto))
    palabras, enteros = tokens_texto(resto, reglas.ignorar)
    for h in hallados:
        try:
            h["valores"] = parse_num(h["texto_num"])
        except (InvalidOperation, ValueError):
            h["valores"] = None
    hallados = [h for h in hallados if h["valores"]]
    hallados.sort(key=lambda h: h["inicio"])
    return hallados, sin_unidad, palabras, enteros


# =========================================================================================
# FUENTES (la pagina)
# =========================================================================================
def _leer_texto(ruta):
    try:
        with open(ruta, "rb") as f:
            crudo = f.read()
    except OSError as e:
        raise NoMedido("no se pudo leer la fuente %s: %s" % (ruta, e))
    try:
        return crudo.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise NoMedido("la fuente %s no es UTF-8" % ruta)


def _en_blanco(m):
    return re.sub(r"[^\n]", " ", m.group(0))


def _html_a_lineas(crudo):
    t = re.sub(r"(?is)<(script|style)\b.*?</\1\s*>", _en_blanco, crudo)
    t = re.sub(r"(?s)<!--.*?-->", _en_blanco, t)
    # los cortes de bloque separan frases (se cuentan como « · »); el resto de las etiquetas se borra
    t = re.sub(r"(?is)</?(?:p|li|ul|ol|h[1-6]|tr|td|th|div|section|br|details|summary|table|body|head|title)\b[^>]*>",
               lambda m: " · " + " " * max(0, len(m.group(0)) - 3), t)
    t = re.sub(r"(?s)<[^>]*>", _en_blanco, t)
    return [html.unescape(x) for x in t.split("\n")]


def leer_fuente(ruta):
    """Bloques de texto de una fuente: [{'fuente', 'linea', 'ruta', 'texto'}]. JSON: una por cada texto del arbol."""
    crudo = _leer_texto(ruta)
    ext = os.path.splitext(ruta)[1].lower()
    nombre = os.path.basename(ruta)
    bloques = []
    if ext == ".json":
        try:
            obj = json.loads(crudo)
        except ValueError as e:
            raise NoMedido("la fuente %s no es un JSON valido: %s" % (nombre, e))
        pos = [0]

        def linea_de(valor):
            for frag in (json.dumps(valor, ensure_ascii=False)[1:-1], json.dumps(valor)[1:-1]):
                i = crudo.find(frag, pos[0])
                if i >= 0:
                    pos[0] = i + 1
                    return crudo.count("\n", 0, i) + 1
            return None

        def rec(o, ruta_j):
            if isinstance(o, str):
                bloques.append({"fuente": nombre, "linea": linea_de(o), "ruta": ruta_j, "texto": o})
            elif isinstance(o, dict):
                for k, v in o.items():
                    rec(v, "%s.%s" % (ruta_j, k) if ruta_j else str(k))
            elif isinstance(o, list):
                for i, v in enumerate(o):
                    rec(v, "%s[%d]" % (ruta_j, i))
        rec(obj, "")
    else:
        lineas = _html_a_lineas(crudo) if ext in (".html", ".htm") else crudo.split("\n")
        for i, l in enumerate(lineas, 1):
            if l.strip():
                bloques.append({"fuente": nombre, "linea": i, "ruta": None, "texto": l})
    return bloques


def numeros_de_bloques(bloques, reglas):
    """Todos los numeros con unidad de las fuentes, cada uno con su frase y las palabras de su frase."""
    numeros, sin_unidad, n_clausula = [], 0, 0
    for b in bloques:
        for cl in RE_CLAUSULA.split(b["texto"]):
            if not cl or not cl.strip():
                continue
            hallados, su, palabras, enteros = extraer_clausula(cl, reglas)
            sin_unidad += su
            n_clausula += 1
            for h in hallados:
                h.update({"fuente": b["fuente"], "linea": b["linea"], "ruta": b["ruta"], "frase": cl.strip(),
                          "palabras": palabras, "enteros": enteros, "clausula": n_clausula,
                          "misma_unidad_en_frase": sum(1 for x in hallados if x["unidad"] == h["unidad"])})
                numeros.append(h)
    return numeros, sin_unidad


# =========================================================================================
# MEDIDAS (las hojas numericas de los JSON)
# =========================================================================================
def hojas_de(obj, archivo, reglas):
    """Las hojas numericas de un JSON, cada una con las palabras de su ruta de claves."""
    hojas = []

    def hoja(ruta, claves, extra, valor):
        pal, ent = set(extra[0]), set(extra[1])
        ultima = None
        for k in claves:
            p, e, ult = tokens_clave(k, reglas.ignorar, reglas.pistas)
            pal |= p
            ent |= e
            ultima = ult
        hojas.append({"archivo": archivo, "ruta": ruta, "valor": valor, "palabras": pal, "enteros": ent,
                      "pista": reglas.pistas.get(ultima) if ultima else None})

    def rec(o, ruta, claves, extra):
        if o is None or isinstance(o, bool):
            return
        if isinstance(o, (int, float)):
            if isinstance(o, float) and not math.isfinite(o):
                return
            hoja(ruta, claves, extra, Decimal(str(o)))
        elif isinstance(o, str):
            m = RE_SOLO_NUM.fullmatch(o.strip())
            if m:
                try:
                    hoja(ruta, claves, extra, parse_num(m.group(1))[0][0])
                except (InvalidOperation, ValueError):
                    pass
        elif isinstance(o, dict):
            # el texto de un campo-nombre ({"nombre": "tope_borde_2", "luz_mm": 0.5755}) solo ayuda a las hojas que
            # son hijas DIRECTAS de ese renglon; si bajara por todo el arbol, el «name» de la raiz de un perfil
            # (Bambu PLA Lite) le daria sus palabras a las 100 claves de abajo
            pal, ent = set(extra[0]), set(extra[1])
            for k, v in o.items():
                if k in reglas.etiquetas and isinstance(v, str) and len(v) <= 60:
                    p, e, _ = tokens_clave(v, reglas.ignorar, reglas.pistas)
                    pal |= p
                    ent |= e
            for k, v in o.items():
                es_hoja = isinstance(v, (int, float, str)) and not isinstance(v, bool)
                rec(v, "%s.%s" % (ruta, k) if ruta else str(k), claves + [str(k)], (pal, ent) if es_hoja else extra)
        elif isinstance(o, list):
            for i, v in enumerate(o):
                rec(v, "%s[%d]" % (ruta, i), claves, extra)
    rec(obj, "", [], (set(), set()))
    return hojas


def relacion(hoja, num, fuerte_min):
    """3 fuerte (2 palabras o mas en comun), 2 clave de una sola palabra que esta en la frase, 1 debil, 0 ninguna:
    cuanto nombra la frase del numero a la medida (por las palabras del nombre de la clave)."""
    if hoja["enteros"] and num["enteros"] and not (hoja["enteros"] & num["enteros"]):
        return 0                                          # «borde 1» no es «borde 2»
    comunes = len(hoja["palabras"] & num["palabras"])
    if comunes >= fuerte_min:
        return 3
    if len(hoja["palabras"]) == 1 and comunes == 1:
        return 2
    return 1 if comunes >= 1 else 0


def clasificar(num, hojas, c):
    """Estado de un numero: leido / contradice / dudoso / exento / tipeado (ver el docstring del modulo).

    Leido: el valor calza con una medida que la frase nombra con fuerza (relacion 3), o con una clave de una palabra
    que declara la misma unidad (relacion 2, choque_mm3). Contradice: la frase nombra con fuerza (relacion 3) una
    medida que declara la MISMA unidad en su clave (luz_mm, brazo_deg) y su valor es otro; una clave sin unidad no
    alcanza para decir que el numero la contradice (puede ser otra magnitud)."""
    fuerte_min = int(c["palabras_comunes_fuerte"])
    por_valor, fuertes, leidos = [], [], []
    # auditor 24/10: una clave repetida en los renglones de una SERIE (luz_min_mm en cada pose de sim_carga.json) con
    # valores distintos dejaba leer cualquiera («la luz queda en 0,2 mm» daba verde con la luz asentada en 0,096): la
    # frase no dice cual renglon es, asi que un numero que solo calza con un miembro de una serie queda DUDOSO
    import re as _re
    series = {}
    for h in hojas:
        series.setdefault((h["archivo"], _re.sub(r"\[\d+\]", "[]", h["ruta"])), set()).add(str(h["valor"]))
    for h in hojas:
        if h["pista"] and h["pista"] != num["unidad"]:
            continue
        rel = relacion(h, num, fuerte_min)
        calza = any(cae(v, d, h["valor"]) for v, d in num["valores"])
        es_serie = "[" in h["ruta"] and len(series[(h["archivo"], _re.sub(r"\[\d+\]", "[]", h["ruta"]))]) > 1
        if calza:
            por_valor.append((rel, h))
            # una clave de UNA palabra («mango») solo lee un numero si declara su unidad (mango_deg): r_mango es un
            # radio en mm y no puede ser el «14°» de la frase
            if not es_serie and (rel == 3 or (rel == 2 and h["pista"] == num["unidad"])):
                leidos.append(h)
        if rel == 3 and h["pista"] == num["unidad"]:
            fuertes.append(h)
    num["calza_por_valor"] = len(por_valor)
    if leidos:
        num["estado"] = "leido"
        num["medidas"] = [(h["archivo"], h["ruta"], str(h["valor"])) for h in leidos[:3]]
        return
    # con dos o mas numeros de la misma unidad en la frase («2° pasado el punto muerto ... a 14° queda...») la frase no
    # dice cual es cual: no se acusa contradiccion (queda dudoso o tipeado). Tampoco si la frase da EXACTAMENTE la misma
    # evidencia (las mismas palabras) para DOS o mas datos distintos del JSON: «luz 1,1 mm ... hace tope» comparte
    # «tope» y «luz» con tope_borde_1, tope_borde_2 y tope_lateral, y no dice de cual habla
    if fuertes:
        mejor = max(len(h["palabras"] & num["palabras"]) for h in fuertes)
        grupos = {}
        for h in fuertes:
            comunes = h["palabras"] & num["palabras"]
            if len(comunes) == mejor:
                grupos.setdefault(frozenset(comunes), set()).add(frozenset(h["palabras"] | h["enteros"]))
        if any(len(ids) > 1 for ids in grupos.values()):
            fuertes = []
    if fuertes and num["misma_unidad_en_frase"] == 1:
        num["estado"] = "contradice"
        num["medidas"] = [(h["archivo"], h["ruta"], str(h["valor"])) for h in fuertes[:3]]
        num["otras_por_valor"] = [(h["archivo"], h["ruta"], str(h["valor"])) for _, h in por_valor[:3]]
        return
    redondos = c.get("redondos_logicos", {}).get(num["unidad"], [])
    if por_valor:
        num["estado"] = "dudoso"
        num["medidas"] = [(h["archivo"], h["ruta"], str(h["valor"])) for _, h in por_valor[:3]]
        num["relacion"] = "debil" if any(r == 1 for r, _ in por_valor) else "ninguna"
        return
    if any(cae(v, d, Decimal(r)) for v, d in num["valores"] for r in redondos):
        num["estado"] = "exento"
        num["medidas"] = []
        return
    num["estado"] = "tipeado"
    num["medidas"] = []


def mismo_dato(a, b, c):
    """Dos numeros de frases distintas hablan del mismo dato? (criterio del canon: doble)."""
    if a["unidad"] != b["unidad"]:
        return False
    if a["enteros"] and b["enteros"] and not (a["enteros"] & b["enteros"]):
        return False
    comunes = a["palabras"] & b["palabras"]
    if len(comunes) < int(c["doble"]["palabras_comunes_min"]):
        return False
    union = a["palabras"] | b["palabras"]
    corta = min(len(a["palabras"]), len(b["palabras"]))
    return (len(comunes) / len(union) >= float(c["doble"]["jaccard_min"])
            or len(comunes) / corta >= float(c["doble"]["contenida_min"]))


def chocan(a, b):
    """Los intervalos de redondeo de los dos valores no se tocan (0,58 y 0,5755 no chocan; 0,58 y 0,8 si)."""
    va, da = a["valores"][0]
    vb, db = b["valores"][0]
    tol = Decimal("0.5") * (Decimal(10) ** (-da)) + Decimal("0.5") * (Decimal(10) ** (-db))
    return abs(abs(va) - abs(vb)) > tol


def dobles_de(numeros, c):
    """Pares de numeros que son el mismo dato con dos valores. Un par que se repite porque la misma frase esta en dos
    fuentes (pasos.json y la pagina que sale de el) cuenta una sola vez."""
    out, vistos = [], set()
    for i, a in enumerate(numeros):
        for b in numeros[i + 1:]:
            if a["clausula"] == b["clausula"] and a["fuente"] == b["fuente"]:
                continue                                   # dentro de una frase no se compara (listas y rangos)
            if mismo_dato(a, b, c) and chocan(a, b):
                clave = frozenset({(a["escrito"], a["frase"]), (b["escrito"], b["frase"])})
                if clave not in vistos:
                    vistos.add(clave)
                    out.append((a, b))
    return out


# =========================================================================================
# EVALUAR
# =========================================================================================
def evaluar_datos(bloques, medidas, c=None):
    """bloques: de leer_fuente. medidas: [(nombre, objeto json)]. Devuelve el resultado completo; NoMedido si no se puede."""
    c = c or canon()
    reglas = Reglas(c)
    if not medidas:
        raise NoMedido("no se paso ningun JSON de medidas (--medidas): sin medidas del modelo no hay contra que leer")
    hojas = []
    por_archivo = {}
    for nombre, obj in medidas:
        hs = hojas_de(obj, nombre, reglas)
        por_archivo[nombre] = len(hs)
        hojas.extend(hs)
    vacios = [n for n, k in por_archivo.items() if k == 0]
    if len(vacios) == len(por_archivo):
        raise NoMedido("ningun JSON de medidas trae un numero (%s)" % ", ".join(vacios))
    numeros, sin_unidad = numeros_de_bloques(bloques, reglas)
    if not numeros:
        raise NoMedido("las fuentes no traen ningun numero con unidad: no hay nada que juzgar (¿es la fuente correcta?)")
    for n in numeros:
        clasificar(n, hojas, c)
    dobles = dobles_de(numeros, c)
    cuentas = {k: sum(1 for n in numeros if n["estado"] == k) for k in ("leido", "tipeado", "contradice", "dudoso", "exento")}
    rojos = cuentas["tipeado"] + cuentas["contradice"] + len(dobles)
    veredicto = "rojo" if rojos else "aviso" if cuentas["dudoso"] else "verde"
    return {"numeros": numeros, "dobles": dobles, "cuentas": cuentas, "sin_unidad": sin_unidad, "rojos": rojos,
            "veredicto": veredicto, "hojas_por_archivo": por_archivo, "hojas": len(hojas)}


def _json_ruta(ruta):
    try:
        with open(ruta, "rb") as f:
            return json.loads(f.read().decode("utf-8-sig"))
    except (OSError, ValueError, UnicodeDecodeError) as e:
        raise NoMedido("no se pudo leer el JSON de medidas %s: %s" % (ruta, e))


def _firma(ruta):
    h = hashlib.sha1()
    with open(ruta, "rb") as f:
        for bloque in iter(lambda: f.read(1 << 20), b""):
            h.update(bloque)
    return "%d-%s" % (os.path.getsize(ruta), h.hexdigest()[:16])


def firma_fuentes(fuentes):
    """UNA firma para el conjunto de fuentes: cambia si cambia cualquiera (o la lista)."""
    partes = sorted("%s:%s" % (os.path.basename(f), _firma(f)) for f in fuentes)
    return "N-" + hashlib.sha1("|".join(partes).encode("utf-8")).hexdigest()[:16]


def evaluar(fuentes, medidas, c=None):
    """Lee los archivos y evalua. Levanta NoMedido (sin medidas, circular, ilegible, sin numeros)."""
    if not fuentes:
        raise NoMedido("falta --fuentes (la pagina o lo que la arma)")
    if not medidas:
        raise NoMedido("no se paso ningun JSON de medidas (--medidas): sin medidas del modelo no hay contra que leer")
    reales = {os.path.normcase(os.path.realpath(f)) for f in fuentes}
    firmas = {}
    for f in fuentes:
        if not os.path.isfile(f):
            raise NoMedido("no existe la fuente: %s" % f)
        firmas[_firma(f)] = f
    for m in medidas:
        if not os.path.isfile(m):
            raise NoMedido("no existe el JSON de medidas: %s" % m)
        if os.path.normcase(os.path.realpath(m)) in reales or _firma(m) in firmas:
            raise NoMedido("el JSON de medidas %s es la propia fuente (o una copia): una pagina no se prueba con ella "
                           "misma; la medida tiene que salir del build" % m)
    bloques = []
    for f in fuentes:
        bloques.extend(leer_fuente(f))
    res = evaluar_datos(bloques, [(os.path.basename(m), _json_ruta(m)) for m in medidas], c)
    res["fuentes_firma"] = firma_fuentes(fuentes)
    return res


# =========================================================================================
# AUTOTEST (BIEN / MAL propios, en cada corrida)
# =========================================================================================
def _medidas_trampa():
    """Las medidas del 20/10 (AUDITORIA_auditor.md l.57, 64 y 123-125) con la luz de los machos AL LADO del tope."""
    return {"tope_borde_1_luz_mm": 0.577, "tope_borde_2_luz_mm": 0.5755, "tope_lateral_luz_mm": 2.016,
            "macho_1_plastico_luz_mm": 0.1394, "macho_2_plastico_luz_mm": 0.1404, "macho_1_asentado_luz_mm": 0.096,
            "apoyo_luz_mm": 0.495, "barra_a_panel_mm": 69.6, "brazo_B_a_panel_mm": 47.208,
            "choque_mm3": 239.9993, "lista": [{"nombre": "pata_1", "separacion_mm": 0.004}]}


def _bloque(texto):
    return [{"fuente": "autotest", "linea": 1, "ruta": None, "texto": texto}]


def _estados(texto, medidas, c):
    r = evaluar_datos(_bloque(texto), medidas, c)
    return r, {n["escrito"]: n["estado"] for n in r["numeros"]}


def autotest(c=None):
    """Lista de problemas (vacia = el control separa BIEN de MAL)."""
    c = c or canon()
    prob = []
    M = [("medidas.json", _medidas_trampa())]

    # BIEN: una pagina leida del JSON (mismo dato con dos precisiones, fechas, versiones, normas, roscas, horas)
    bien = ("El tope de borde 2 queda a 0,58 mm del plástico del borde. Resumen: tope de borde 2, luz de 0,5755 mm. "
            "La barra queda 69,6 mm arriba del panel. Entre machos y plástico de la ranura quedan 0,14 mm. "
            "El choque simulado es de 240 mm³. El 20/10 a las 13:50 se midió con la v16 según ISO 13854, tornillo M4x16, "
            "3 patitas.")
    r, est = _estados(bien, M, c)
    if r["veredicto"] != "verde" or r["rojos"] or r["cuentas"]["dudoso"]:
        prob.append("BIEN (pagina leida del JSON): esperado verde, dio %s %s" % (r["veredicto"], r["cuentas"]))
    if r["cuentas"]["leido"] != 5:
        prob.append("BIEN: debia leer 5 numeros (0,58 / 0,5755 / 69,6 / 0,14 / 240), leyo %d" % r["cuentas"]["leido"])
    if r["sin_unidad"] < 1:
        prob.append("BIEN: «3 patitas» debia contarse sin unidad")

    # MAL 1: la falla real. El 0,1 calza POR VALOR con la luz de un macho; la frase nombra al tope (0,5755)
    r, est = _estados("El tope de borde 2 queda a 0,1 mm del plástico del borde.", M, c)
    n = r["numeros"][0]
    if n["calza_por_valor"] < 2:
        prob.append("MAL 1: el caso dejo de ser el dificil (el 0,1 debia calzar por valor con las luces de los machos)")
    if n["estado"] != "contradice" or r["veredicto"] != "rojo":
        prob.append("MAL 1 (0,1 mm contra tope_borde_2 = 0,5755): esperado contradice/rojo, dio %s/%s"
                    % (n["estado"], r["veredicto"]))
    # MAL 1b: el 47 es el brazo B (47,208); la barra esta a 69,6
    r, est = _estados("La barra queda 47 mm arriba del panel.", M, c)
    if r["numeros"][0]["estado"] != "contradice":
        prob.append("MAL 1b (47 mm contra barra_a_panel = 69,6): esperado contradice, dio %s" % r["numeros"][0]["estado"])
    # MAL 2: un numero que no sale de ninguna medida
    r, est = _estados("La rampa de entrada mide 12 mm.", M, c)
    if r["numeros"][0]["estado"] != "tipeado" or r["veredicto"] != "rojo":
        prob.append("MAL 2 (12 mm que no esta en ninguna medida): esperado tipeado/rojo, dio %s/%s"
                    % (r["numeros"][0]["estado"], r["veredicto"]))
    # MAL 3: el mismo dato con dos valores, y cada uno SALE de una medida (dos versiones del JSON)
    v1 = _medidas_trampa()
    v1["tope_borde_2_luz_mm"] = 0.8
    r = evaluar_datos(_bloque("El tope de borde 2 queda a 0,58 mm del plástico del borde. "
                              "Control: el tope de borde 2 queda a 0,8 mm."),
                      [("medidas.json", _medidas_trampa()), ("medidas_v1.json", v1)], c)
    if r["cuentas"]["tipeado"] or r["cuentas"]["contradice"] or len(r["dobles"]) != 1 or r["veredicto"] != "rojo":
        prob.append("MAL 3 (dos valores del mismo dato, ambos en un JSON): esperado 1 doble y 0 tipeados, dio %s dobles, %s"
                    % (len(r["dobles"]), r["cuentas"]))
    # NO dobles: lista con la misma frase, y datos que se distinguen por el numero suelto
    r, est = _estados("Las patitas: luz 0,004 / 0,08 / 0,004 mm. El tope de borde 1 queda a 0,58 mm. "
                      "El tope de borde 2 queda a 0,5755 mm.", M, c)
    if r["dobles"]:
        prob.append("BIEN 2: una lista (0,004 / 0,08) o «borde 1» y «borde 2» no son un mismo dato con dos valores")
    # unidades: °C no es un angulo, 100 % es un redondo logico
    r, est = _estados("El PLA se ablanda a 55 °C. Que funcione al 100 %.", M, c)
    if est.get("55 °C") != "tipeado" or est.get("100 %") != "exento":
        prob.append("unidades: «55 °C» debia ser tipeado (temperatura, nada la respalda) y «100 %%» exento: %s" % est)
    # sin medidas: NO MEDIDO
    try:
        evaluar_datos(_bloque("El tope queda a 0,58 mm."), [], c)
        prob.append("sin JSON de medidas debia ser NO MEDIDO")
    except NoMedido:
        pass
    return prob


# =========================================================================================
# CLI
# =========================================================================================
def _lugar(n):
    return "%s%s" % (n["fuente"], (":%d" % n["linea"]) if n["linea"] else "")


def _corto(t, k=150):
    t = re.sub(r"\s+", " ", t).strip()
    return t if len(t) <= k else t[:k - 1] + "…"


def _med(m):
    return "%s: %s = %s" % (m[0], m[1] or "(raiz)", m[2])


def imprimir(res, detalle=False):
    n = res["numeros"]
    cu = res["cuentas"]
    print("numeros con unidad: %d   leidos del modelo: %d   dudosos: %d   exentos: %d   tipeados: %d   contradicen su "
          "medida: %d   mismo dato con dos valores: %d   (sin unidad, no juzgados: %d)"
          % (len(n), cu["leido"], cu["dudoso"], cu["exento"], cu["tipeado"], cu["contradice"], len(res["dobles"]),
             res["sin_unidad"]))
    print("medidas: %s (%d hojas numericas)" % (", ".join("%s %d" % kv for kv in res["hojas_por_archivo"].items()),
                                               res["hojas"]))
    if detalle:
        print("  todos los numeros:")
        for x in n:
            print("   %-10s %-20s %-12s %s" % (x["estado"], _lugar(x), x["escrito"],
                                               "; ".join(_med(m) for m in x.get("medidas", [])) or "-"))
    for x in n:
        if x["estado"] == "tipeado":
            print("  [TIPEADO]    %s  «%s»  no sale de ninguna medida. Frase: %s" % (_lugar(x), x["escrito"], _corto(x["frase"])))
        elif x["estado"] == "contradice":
            otra = ("; calza por redondeo con otra cosa: " + "; ".join(_med(m) for m in x["otras_por_valor"])) \
                if x.get("otras_por_valor") else ""
            print("  [CONTRADICE] %s  «%s»  la frase nombra %s%s. Frase: %s"
                  % (_lugar(x), x["escrito"], "; ".join(_med(m) for m in x["medidas"]), otra, _corto(x["frase"])))
        elif x["estado"] == "dudoso":
            print("  [DUDOSO]     %s  «%s»  calza con %s pero la frase no nombra esa medida (%s). Frase: %s"
                  % (_lugar(x), x["escrito"], "; ".join(_med(m) for m in x["medidas"]),
                     "1 palabra en comun" if x.get("relacion") == "debil" else "ninguna palabra en comun", _corto(x["frase"])))
    for a, b in res["dobles"]:
        print("  [DOS VALORES] %s «%s»  contra  %s «%s»  (mismo dato)\n                 %s\n                 %s"
              % (_lugar(a), a["escrito"], _lugar(b), b["escrito"], _corto(a["frase"], 110), _corto(b["frase"], 110)))


def _resumen_json(res, cap):
    def fila(x):
        return {"estado": x["estado"], "lugar": _lugar(x), "ruta": x["ruta"], "numero": x["escrito"],
                "frase": _corto(x["frase"], 200), "medidas": [list(m) for m in x.get("medidas", [])],
                "otras_por_valor": [list(m) for m in x.get("otras_por_valor", [])]}
    mal = [fila(x) for x in res["numeros"] if x["estado"] in ("tipeado", "contradice")]
    dud = [fila(x) for x in res["numeros"] if x["estado"] == "dudoso"]
    dob = [{"a": _lugar(a), "numero_a": a["escrito"], "b": _lugar(b), "numero_b": b["escrito"],
            "frase_a": _corto(a["frase"], 120), "frase_b": _corto(b["frase"], 120)} for a, b in res["dobles"]]
    return {"numeros": len(res["numeros"]), "leidos": res["cuentas"]["leido"], "dudosos": res["cuentas"]["dudoso"],
            "exentos": res["cuentas"]["exento"], "tipeados": res["cuentas"]["tipeado"],
            "contradicen": res["cuentas"]["contradice"], "dobles": len(res["dobles"]),
            "sin_unidad": res["sin_unidad"], "rojos_detalle": mal[:cap], "dobles_detalle": dob[:cap],
            "dudosos_detalle": dud[:cap], "medidas_hojas": res["hojas_por_archivo"]}


def main(argv=None):
    # la pagina puede traer cualquier caracter (flechas, signo menos): la consola de Windows (cp1252) no los encodea y el
    # control se caeria al mostrarlos; con errors="replace" imprime un «?» y sigue (la linea JSON es ASCII)
    for flujo in (sys.stdout, sys.stderr):
        try:
            flujo.reconfigure(errors="replace")
        except (AttributeError, ValueError):
            pass
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--fuentes", nargs="+", default=None, help="la pagina o lo que la arma: pasos.json, .md, .txt, .html")
    ap.add_argument("--medidas", nargs="+", default=None, help="JSON de medidas del modelo (manifest, params, registro)")
    ap.add_argument("--solo-autotest", action="store_true")
    ap.add_argument("--detalle", action="store_true", help="lista cada numero con la medida contra la que calzo")
    ap.add_argument("--json", default=None)
    ap.add_argument("--workdir", default=None, help="workdir con manifest.json donde queda la evidencia")
    ap.add_argument("--acepto-numeros", default=None, metavar="FRASE",
                    help="Fak asume los numeros tipeados: frase de 10 caracteres o mas; queda en el manifest con fecha "
                         "y firma de la fuente (exige --workdir)")
    ap.add_argument("--hoy", default=None, help="fecha simulada AAAA-MM-DD (solo con CAD_GATE_TEST=1)")
    a = ap.parse_args(argv)
    t0 = time.time()
    try:
        c = canon()
    except (OSError, ValueError) as e:
        print("NO MEDIDO: no se pudo leer %s (%s)" % (CANON, e))
        return 2
    res = {"gate": "numeros_pagina", "medido": False, "veredicto": "no_medido", "modo": None,
           "fuentes": [os.path.basename(f) for f in (a.fuentes or [])], "fuentes_firma": None,
           "medidas": [os.path.basename(m) for m in (a.medidas or [])], "hoy": None, "aviso_hasta": c["aviso_hasta"],
           "motivo": None}

    def cerrar(codigo, texto):
        res["segundos"] = round(time.time() - t0, 1)
        print(texto)
        if a.workdir and not a.solo_autotest:
            try:
                from cadlib import workdir as _wd
                _wd.ensure_workdir(a.workdir)
                ev = {k: v for k, v in res.items() if k not in ("gate", "modo")}
                _wd.record_evidence(a.workdir, "numeros_pagina", **ev)
            except Exception as e:                               # pragma: no cover
                print("  (no se pudo escribir la evidencia en el manifest: %s)" % e)
        if a.json:
            with open(a.json, "w", encoding="utf-8") as f:
                json.dump(res, f, indent=1, ensure_ascii=False)
        print(json.dumps(res, ensure_ascii=True), flush=True)
        return codigo

    def no_medido(motivo):
        res["motivo"] = motivo
        return cerrar(2, "NO MEDIDO: %s. Un control que no midio nunca da verde." % motivo)

    try:
        hoy = hoy_numeros(a.hoy)
    except (NoMedido, ValueError) as e:
        return no_medido(str(e))
    res["hoy"] = hoy.isoformat()

    print("AUTOTEST del control de numeros de la pagina (BIEN/MAL propios)")
    prob = autotest(c)
    if prob:
        print("  [AUTOTEST FALLA]")
        for x in prob:
            print("    - " + x)
        print("  No se juzga ninguna pagina con un control que no probo distinguir.")
        return 3
    print("  [AUTOTEST OK] el control separa BIEN de MAL.\n")
    if a.solo_autotest:
        return 0
    if not a.fuentes:
        print("hace falta --fuentes (o --solo-autotest)")
        return 2
    if a.acepto_numeros is not None and len(a.acepto_numeros.strip()) < int(c["frase_minima"]):
        res["motivo"] = "frase corta"
        return cerrar(1, "NO SE ACEPTA: --acepto-numeros necesita la frase de Fak (%d caracteres o mas); llego '%s' "
                      "(frase corta)" % (int(c["frase_minima"]), a.acepto_numeros))
    if a.acepto_numeros is not None and not a.workdir:
        res["motivo"] = "aceptacion sin manifest"
        return cerrar(1, "NO SE ACEPTA: la aceptacion queda escrita en el manifest; falta --workdir")
    try:
        r = evaluar(a.fuentes, a.medidas or [], c)
    except NoMedido as e:
        return no_medido(str(e))
    except Exception as e:                                       # pragma: no cover
        return no_medido("error inesperado: %s: %s" % (type(e).__name__, e))
    res.update(medido=True, veredicto=r["veredicto"], fuentes_firma=r["fuentes_firma"])
    res.update(_resumen_json(r, int(c["max_rojos_en_json"])))
    print("paginas: %s   firma de la fuente %s" % (", ".join(res["fuentes"]), r["fuentes_firma"]))
    imprimir(r, a.detalle)

    aceptada = False
    if r["veredicto"] == "rojo" and a.acepto_numeros is not None:
        from cadlib import workdir as _wd
        frase = a.acepto_numeros.strip()
        man = _wd.load_manifest(a.workdir) if os.path.isfile(os.path.join(a.workdir, _wd.MANIFEST)) else {}
        otra = [e for e in man.get("evidence", []) if e.get("kind") == "numeros_aceptados"
                and (e.get("frase") or "").strip() == frase and e.get("fuentes_firma") != r["fuentes_firma"]]
        if otra:
            res["motivo"] = "frase usada para otra version"
            return cerrar(1, "NO SE ACEPTA: esa frase ya acepto otra version de la fuente (firma %s; hoy %s). Una "
                          "aceptacion vale para UNA firma: mirar la pagina nueva y escribir otra."
                          % (otra[-1].get("fuentes_firma"), r["fuentes_firma"]))
        _wd.ensure_workdir(a.workdir)
        _wd.record_evidence(a.workdir, "numeros_aceptados", fuentes=res["fuentes"], fuentes_firma=r["fuentes_firma"],
                            frase=frase, fecha=hoy.isoformat(), cantidad=r["rojos"],
                            tipeados=r["cuentas"]["tipeado"], contradicen=r["cuentas"]["contradice"],
                            dobles=len(r["dobles"]))
        res["aceptacion"] = {"frase": frase, "fecha": hoy.isoformat(), "cantidad": r["rojos"]}
        aceptada = True
    modo = modo_numeros(r["veredicto"], hoy, c["aviso_hasta"], aceptada)
    res["modo"] = modo
    salidas = "; ".join(c["salidas"])
    resumen = ("%d tipeados, %d que contradicen su medida y %d datos con dos valores"
               % (r["cuentas"]["tipeado"], r["cuentas"]["contradice"], len(r["dobles"])))
    if modo == "verde":
        return cerrar(0, "[OK] %d numeros con unidad, todos leidos del modelo o exentos por forma" % len(r["numeros"]))
    if modo == "aceptado":
        return cerrar(0, "[ACEPTADO] %s. Queda en el manifest: frase, fecha, firma de la fuente y cantidad." % resumen)
    if r["veredicto"] == "aviso":
        return cerrar(0, "AVISO: %d numeros dudosos (el valor calza con una medida que la frase no nombra); no frena. "
                      "Mirar si la frase habla de esa medida." % r["cuentas"]["dudoso"])
    if modo == "aviso":
        return cerrar(0, "AVISO: %s; freno desde %s. Salidas: %s" % (resumen, _dia_siguiente(c["aviso_hasta"]), salidas))
    return cerrar(1, "FRENO: %s. Salidas: %s" % (resumen, salidas))


def para_entregable(fuentes, medidas, c=None):
    """Para gate_entregable.py (G-E8). -> (nivel, [renglones]); nivel: 'ok' | 'aviso' | 'no_medido'. Nunca levanta.

    Siempre AVISO en la entrega: el freno desde el 01/11 es del comando (main), no de G-E8."""
    try:
        c = c or canon()
        prob = autotest(c)
        if prob:
            return "no_medido", ["el autotest del control no separa BIEN de MAL (%s): no se juzga la pagina" % prob[0]]
        r = evaluar(list(fuentes or []), list(medidas or []), c)
    except NoMedido as e:
        return "no_medido", [str(e)]
    except Exception as e:                                       # noqa: BLE001
        return "no_medido", ["error inesperado: %s: %s" % (type(e).__name__, e)]
    cu = r["cuentas"]
    if r["veredicto"] == "verde":
        return "ok", ["numeros de la pagina: VERDE — %d con unidad, todos leidos de las medidas o exentos por forma "
                      "(%d hojas numericas)" % (len(r["numeros"]), r["hojas"])]
    lineas = ["numeros de la pagina: %d tipeados, %d contradicen su medida, %d datos con dos valores, %d dudosos "
              "(de %d con unidad)" % (cu["tipeado"], cu["contradice"], len(r["dobles"]), cu["dudoso"], len(r["numeros"]))]
    for x in r["numeros"]:
        if x["estado"] in ("tipeado", "contradice") and len(lineas) <= 6:
            lineas.append("  %s «%s» (%s): %s" % (_lugar(x), x["escrito"], x["estado"], _corto(x["frase"], 90)))
    for a, b in r["dobles"][:2]:
        lineas.append("  dos valores para lo mismo: %s «%s» y %s «%s»" % (_lugar(a), a["escrito"], _lugar(b), b["escrito"]))
    return "aviso", lineas


if __name__ == "__main__":
    try:
        sys.exit(main())
    except SystemExit:
        raise
    except Exception as _e:                                       # pragma: no cover
        print("NO MEDIDO: error inesperado: %s: %s" % (type(_e).__name__, _e))
        sys.exit(2)
