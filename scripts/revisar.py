# -*- coding: utf-8 -*-
"""revisar.py — el revisor de CONTENIDO de un entregable, antes de mostrarlo (tanda 16, pieza 2).

Por que existe: de 13 entregables que Fak devolvio por la forma, solo 3 fueron queja visual; los otros 10 volvieron por
CONTENIDO (notas de mas, columnas inventadas, recomendaciones que nadie pidio, jerga, el formulario equivocado, el orden).
Informe G de formatos (15/10/2026) y docs/FORMATO_CASA.md. No reinventa: encadena lo que ya existe
(scripts/_sinFirmaIA.py, scripts/_vozFak.mjs, el render a imagen) y suma las reglas de contenido de
scripts/_lib/formatoCasa.data.json, cada una con el reclamo de Fak del que sale.

Da ROJO o VERDE por regla, con el renglon, la celda o la lamina que lo frena. Sale 1 si hay algun ROJO.
El render nunca es VERDE: es «para mirar» (la imagen) o «no corrio» (y por que).

Uso:
  python scripts/revisar.py <archivo> [--tipo T] [--modo rearmado|correccion] [--oficial] [--documento "<tipo>"]
                            [--formulario <plantilla.xlsx>] [--pidio-recomendacion] [--sin-render] [--json]
  python scripts/revisar.py --selftest            los casos de respuesta conocida (scripts/_lib/revisarCasos.py)

  --tipo        proyectar | leer (PowerPoint: para proyectar en una reunion, o para mandar y leer; por defecto leer),
                una-pagina (PDF), excel, html (pantalla para Fak), mail, texto, explicacion. Sin --tipo sale de la extension.
  --modo        rearmado (por defecto: va limpio, sin amarillo ni notas) | correccion (archivo de OTRO: cada celda con
                color propio lleva un comentario «ANTES: ...»).
  --oficial     es un formulario oficial (SGC o cliente): corren el paso 0 y las reglas de contenido, nunca las de diseño.
  --documento   que es («hoja de proceso», «camino de inspeccion», «plan de control»...): si hay formulario oficial
                para eso y el archivo no lo lleva, ROJO (paso 0).
  --formulario  plantilla oficial: las columnas del entregable que la plantilla no tiene son columnas inventadas.
"""
import argparse
import io
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unicodedata

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
sys.path.insert(0, os.path.join(AQUI, "_lib"))

try:
    sys.stdout.reconfigure(encoding="utf-8")
except (AttributeError, ValueError):
    pass

DATOS = json.load(io.open(os.path.join(AQUI, "_lib", "formatoCasa.data.json"), encoding="utf-8"))["revisar"]
TEMA = json.load(io.open(os.path.join(AQUI, "_lib", "tema.json"), encoding="utf-8"))
INGLES = json.load(io.open(os.path.join(RAIZ, "core", "amfe", "forbiddenContent.data.json"), encoding="utf-8"))["ENGLISH_RANDOM_TERMS"]

TIPOS = ["proyectar", "leer", "a3", "una-pagina", "excel", "html", "mail", "texto", "explicacion"]
POR_EXTENSION = {".pptx": "leer", ".xlsx": "excel", ".xlsm": "excel", ".xltx": "excel", ".xls": "excel", ".pdf": "una-pagina",
                 ".html": "html", ".htm": "html", ".txt": "texto", ".md": "texto", ".docx": "una-pagina"}

ROJO, VERDE, NO_APLICA, NO_CORRIO, MIRAR, SIN_MIRAR = "ROJO", "VERDE", "no aplica", "NO CORRIO", "PARA MIRAR", "SIN MIRAR"


def v(clave):
    return DATOS[clave]["valor"]


def sin_tildes(s):
    return "".join(c for c in unicodedata.normalize("NFD", str(s)) if unicodedata.category(c) != "Mn")


def norm(s):
    return re.sub(r"\s+", " ", sin_tildes(s).lower()).strip()


def palabra_re(frases):
    """Regex de frases enteras, sin importar tildes ni mayusculas (se aplica sobre el texto normalizado)."""
    return re.compile(r"(?<![\w])(" + "|".join(re.escape(norm(f)) for f in frases) + r")(?![\w])")


# ---------------------------------------------------------------- lectura: cada archivo -> «pedazos» de texto con lugar
class Doc:
    def __init__(self):
        self.pedazos = []      # (lugar, texto)
        self.laminas = []      # pptx: [{n, texto, imagenes, tamanos:[(pt, lugar)], tablas}]
        self.excel = None      # {hojas: [{nombre, celdas:{(f,c): {...}}, oculta}]}
        self.ancho_cm = None   # pptx: ancho de la lamina


def leer_pptx(ruta, d):
    from pptx import Presentation
    from pptx.enum.shapes import MSO_SHAPE_TYPE
    prs = Presentation(ruta)
    d.ancho_cm = prs.slide_width / 360000

    def recorrer(shapes, lam):
        for sh in shapes:
            if sh.shape_type == MSO_SHAPE_TYPE.GROUP:
                recorrer(sh.shapes, lam)
                continue
            if sh.shape_type == MSO_SHAPE_TYPE.PICTURE or (getattr(sh, "is_placeholder", False) and hasattr(sh, "image")):
                lam["imagenes"] += 1
            if getattr(sh, "has_table", False) and sh.has_table:
                lam["tablas"] += 1
                for fila in sh.table.rows:
                    for c in fila.cells:
                        lam["textos"].append(c.text)
                        for p in c.text_frame.paragraphs:
                            for r in p.runs:
                                if r.font.size is not None:
                                    lam["tamanos"].append((r.font.size.pt, "tabla", r.text))
            if getattr(sh, "has_text_frame", False) and sh.has_text_frame:
                lam["textos"].append(sh.text_frame.text)
                for p in sh.text_frame.paragraphs:
                    for r in p.runs:
                        if r.font.size is not None and r.text.strip():
                            lam["tamanos"].append((r.font.size.pt, "texto", r.text))

    for i, sl in enumerate(prs.slides, 1):
        lam = {"n": i, "textos": [], "imagenes": 0, "tablas": 0, "tamanos": []}
        recorrer(sl.shapes, lam)
        lam["texto"] = "\n".join(lam["textos"])
        d.laminas.append(lam)
        for t in lam["textos"]:
            for renglon in t.splitlines():
                if renglon.strip():
                    d.pedazos.append((f"lamina {i}", renglon))


def color_hex(c):
    """openpyxl Color -> 'RRGGBB' o None (los colores de tema/indexados no se resuelven: None)."""
    try:
        if c is not None and c.type == "rgb" and isinstance(c.rgb, str) and len(c.rgb) >= 6:
            return c.rgb[-6:].upper()
    except AttributeError:
        pass
    return None


def es_gris(h):
    if not h:
        return False
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return max(r, g, b) - min(r, g, b) <= 16 and 0x55 <= r <= 0xDD


def leer_xlsx(ruta, d):
    import openpyxl
    from openpyxl.utils import get_column_letter
    wb = openpyxl.load_workbook(ruta)
    hojas = []
    for ws in wb.worksheets:
        celdas = {}
        for fila in ws.iter_rows():
            for c in fila:
                fondo = color_hex(c.fill.fgColor) if c.fill is not None and c.fill.fill_type == "solid" else None
                info = {"valor": c.value, "fondo": fondo, "letra": color_hex(c.font.color) if c.font else None,
                        "italica": bool(c.font and c.font.italic), "comentario": c.comment.text if c.comment else None}
                if c.value is None and not fondo and not info["comentario"]:
                    continue
                celdas[(c.row, c.column)] = info
                if c.value is not None and str(c.value).strip():
                    d.pedazos.append((f"pestaña {ws.title}, celda {get_column_letter(c.column)}{c.row}", str(c.value)))
        hojas.append({"nombre": ws.title, "celdas": celdas, "oculta": ws.sheet_state != "visible", "ancho": ws.max_column})
    d.excel = {"hojas": hojas}


def leer_xls(ruta, d):
    import xlrd
    libro = xlrd.open_workbook(ruta, formatting_info=True)
    hojas = []
    for sh in libro.sheets():
        celdas = {}
        notas = getattr(sh, "cell_note_map", {}) or {}
        for f in range(sh.nrows):
            for c in range(sh.ncols):
                val = sh.cell_value(f, c)
                fondo = None
                try:
                    xf = libro.xf_list[sh.cell_xf_index(f, c)]
                    if xf.background.fill_pattern:
                        rgb = libro.colour_map.get(xf.background.pattern_colour_index)
                        if rgb:
                            fondo = "%02X%02X%02X" % rgb
                except (IndexError, AttributeError):
                    pass
                nota = notas.get((f, c))
                if val in ("", None) and not fondo and not nota:
                    continue
                celdas[(f + 1, c + 1)] = {"valor": val if val != "" else None, "fondo": fondo, "letra": None, "italica": False,
                                         "comentario": nota.text if nota else None}
                if str(val).strip():
                    d.pedazos.append((f"pestaña {sh.name}, fila {f + 1} col {c + 1}", str(val)))
        hojas.append({"nombre": sh.name, "celdas": celdas, "oculta": sh.visibility != 0, "ancho": sh.ncols})
    d.excel = {"hojas": hojas}


def leer_pdf(ruta, d):
    import fitz
    with fitz.open(ruta) as doc:
        for i, p in enumerate(doc, 1):
            for renglon in p.get_text().splitlines():
                if renglon.strip():
                    d.pedazos.append((f"pagina {i}", renglon))


def leer_docx(ruta, d):
    import docx
    for i, p in enumerate(docx.Document(ruta).paragraphs, 1):
        if p.text.strip():
            d.pedazos.append((f"parrafo {i}", p.text))


def leer_html(ruta, d):
    t = io.open(ruta, encoding="utf-8", errors="replace").read()
    t = re.sub(r"(?is)<(style|script)\b.*?</\1>", " ", t)
    t = re.sub(r"(?is)<(br|/p|/div|/tr|/li|/h\d|/td|/th)\b[^>]*>", "\n", t)
    t = re.sub(r"(?s)<[^>]+>", " ", t)
    t = t.replace("&nbsp;", " ").replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", '"')
    for i, renglon in enumerate(t.splitlines(), 1):
        if renglon.strip():
            d.pedazos.append((f"renglon {i}", re.sub(r"\s+", " ", renglon).strip()))


def leer_texto(ruta, d):
    for i, renglon in enumerate(io.open(ruta, encoding="utf-8", errors="replace").read().splitlines(), 1):
        if renglon.strip():
            d.pedazos.append((f"renglon {i}", renglon))


LECTORES = {".pptx": leer_pptx, ".xlsx": leer_xlsx, ".xlsm": leer_xlsx, ".xltx": leer_xlsx, ".xls": leer_xls, ".pdf": leer_pdf,
            ".docx": leer_docx, ".html": leer_html, ".htm": leer_html, ".txt": leer_texto, ".md": leer_texto}


# ---------------------------------------------------------------- reglas
def r(regla, estado, donde="", que="", de=""):
    return {"regla": regla, "estado": estado, "donde": donde, "que": que, "de": de}


def primero(regla, hallados, que, de, max_donde=3):
    """ROJO con los primeros lugares encontrados, o VERDE."""
    if not hallados:
        return r(regla, VERDE, de=de)
    donde = "; ".join(f"{l}: «{t[:60]}»" for l, t in hallados[:max_donde])
    if len(hallados) > max_donde:
        donde += f"; y {len(hallados) - max_donde} mas"
    return r(regla, ROJO, donde, que, de)


def regla_firma(ruta, op):
    py = sys.executable or "python"
    # un solo archivo: tope alto (el detector corta a 60 MB por defecto y un PowerPoint real pesa 51,6) y que diga lo que
    # no pudo mirar entero (auditor 18/10: un pptx de 61 MB con «Armado por Claude» salia VERDE)
    args = [py, os.path.join(AQUI, "_sinFirmaIA.py"), "--json", "--marcar-parciales", "--max-mb", "1000", ruta]
    if not op.oficial:
        args.insert(3, "--logo-bloquea")
    try:
        p = subprocess.run(args, capture_output=True, text=True, encoding="utf-8", timeout=600)
        if p.returncode not in (0, 1):
            return r("firma-ia", NO_CORRIO, que=f"_sinFirmaIA.py salio con {p.returncode}: {(p.stderr or p.stdout)[-160:]}")
        hs = json.loads(p.stdout)
        if not isinstance(hs, list):
            raise ValueError("no devolvio una lista")
    except (subprocess.SubprocessError, ValueError, OSError) as e:
        return r("firma-ia", NO_CORRIO, que=f"_sinFirmaIA.py no corrio: {e}")
    malos = [h for h in hs if h.get("nivel") == "BLOQUEANTE"]
    de = "#14 listado de HO 08/10: «Claude» en CREADO POR y una pestaña oculta; logo oficial (core-prohibiciones §9)"
    if malos:
        return r("firma-ia", ROJO, "; ".join(f"{h.get('lugar')}: {h.get('que')}" for h in malos[:3]),
                 "el documento dice o deja ver que lo hizo una IA, o lleva un logo que no es el oficial", de)
    sin_mirar = [h for h in hs if h.get("regla") in ("grande", "ilegible", "revision-parcial")]
    if sin_mirar:
        return r("firma-ia", NO_CORRIO, "; ".join(f"{h.get('lugar')}: {h.get('que')}" for h in sin_mirar[:2]),
                 "no pudo mirar el archivo entero", de)
    return r("firma-ia", VERDE, de=de)


def regla_voz(ruta):
    node = shutil.which("node")
    if not node:
        return r("voz", NO_CORRIO, que="no hay node en esta PC")
    try:
        p = subprocess.run([node, os.path.join(AQUI, "_vozFak.mjs"), "--revisar", ruta], capture_output=True, text=True,
                           encoding="utf-8", timeout=120)
    except (subprocess.SubprocessError, OSError) as e:
        return r("voz", NO_CORRIO, que=f"_vozFak.mjs no corrio: {e}")
    salida = (p.stdout or "") + (p.stderr or "")
    de = "#13 mails 20/08-10/09 «le mandaste un testamento»"
    if "[ROJO]" in salida:
        motivo = " ".join(l.strip() for l in salida.splitlines()[1:4] if l.strip())
        return r("voz", ROJO, salida.splitlines()[0][:120], f"no suena a Fak: {motivo[:200]}", de)
    if "[VERDE]" in salida or "[AMARILLO]" in salida:
        return r("voz", VERDE, que=salida.splitlines()[0][:120], de=de)
    return r("voz", NO_CORRIO, que=f"_vozFak.mjs no dio semaforo: {salida[:120]}")


def regla_notas(d):
    rx = re.compile(v("notas_re"), re.I)
    hall = [(l, t) for l, t in d.pedazos if rx.search(t)]
    return primero("notas-de-mas", hall, "bloque de NOTAS / AVISOS / aclaraciones: afuera (va solo lo que contesta lo pedido)",
                   DATOS["notas_re"]["de"])


def regla_recomendaciones(d, op):
    if op.pidio_recomendacion:
        return r("recomendaciones", NO_APLICA, que="el pedido pide una recomendacion")
    rx = palabra_re(v("recomendaciones"))
    hall = [(l, t) for l, t in d.pedazos if rx.search(norm(t))]
    return primero("recomendaciones", hall, "recomendacion o «qué haría» que nadie pidio", DATOS["recomendaciones"]["de"])


def regla_jerga(d):
    rx = palabra_re(v("jerga_interna") + INGLES)
    hall = [(l, t) for l, t in d.pedazos if rx.search(norm(t))]
    return primero("jerga", hall, "jerga interna o ingles suelto: van las palabras de Fak y de planta",
                   DATOS["jerga_interna"]["de"])


def filas_de_texto(celdas):
    """{fila: {col: texto}} de las filas con 2 o mas celdas de texto (candidatas a cabecera de una tabla)."""
    filas = {}
    for (f, c), info in celdas.items():
        if isinstance(info["valor"], str) and info["valor"].strip():
            filas.setdefault(f, {})[c] = info["valor"].strip()
    return {f: x for f, x in filas.items() if len(x) >= 2}


def regla_columnas(d, op):
    de = DATOS["columnas_inventadas"]["de"]
    if not d.excel:
        return r("columnas-inventadas", NO_APLICA)
    plantilla = None
    if op.formulario:
        dp = Doc()
        LECTORES[os.path.splitext(op.formulario)[1].lower()](op.formulario, dp)
        plantilla = set()
        for h in dp.excel["hojas"]:
            for info in h["celdas"].values():
                if isinstance(info["valor"], str):
                    plantilla.add(norm(info["valor"]))
    lista = {norm(x) for x in v("columnas_inventadas")}
    hall = []
    for h in d.excel["hojas"]:
        if h["oculta"]:
            continue
        filas = filas_de_texto(h["celdas"])
        # la lista negra se busca en TODAS las filas tipo cabecera: un formulario lleva su encabezado arriba y la tabla
        # mas abajo (auditor 18/10: con «fecha» al lado del titulo, la columna «Fuente» de la tabla pasaba)
        for f, cab in sorted(filas.items()):
            for c, texto in sorted(cab.items()):
                if norm(texto) in lista:
                    hall.append((f"pestaña {h['nombre']}, fila {f} col {c}", texto))
        if plantilla is not None and filas:
            # contra la plantilla: la cabecera es la fila con mas textos de las primeras 30
            f = max((x for x in filas if x <= 30), key=lambda x: (len(filas[x]), -x), default=None)
            for c, texto in sorted((filas.get(f) or {}).items()):
                if norm(texto) not in plantilla and norm(texto) not in lista:
                    hall.append((f"pestaña {h['nombre']}, fila {f} col {c}", texto))
    que = "columna que no pide el formulario (la derive yo): afuera" if plantilla is not None else "columna inventada (Fuente, Notas, cálculo propio): afuera"
    return primero("columnas-inventadas", hall, que, de)


def codigo_oficial(d, codigos):
    """El primer codigo de formulario oficial que aparece en el documento, o None. Un codigo no cuenta si sigue un
    punto y un numero («I-IN-002» no es «I-IN-002.4»; auditor 18/10)."""
    todo = " ".join(t for _, t in d.pedazos).upper()
    for code in codigos:
        if re.search(re.escape(code.upper()) + r"(?![.\d])", todo):
            return code
    return None


def regla_formulario(d, op):
    de = DATOS["formularios"]["de"]
    if not op.documento:
        todos = [c for x in v("formularios").values() for c in x]
        code = codigo_oficial(d, todos)
        if code:
            return r("formulario-oficial", VERDE, que=f"lleva el formulario oficial {code}", de=de)
        # se DICE que no se miro (revisor-pedido 18/10: callaba y el cierre decia «VERDE en todas»)
        return r("formulario-oficial", SIN_MIRAR, que="falta --documento \"<que es>\": si para esto hay formulario oficial "
                 "(hoja de proceso, plan de control, AMFE, flujograma), el revisor no lo puede saber solo", de=de)
    clave = norm(op.documento)
    forms = {norm(k): x for k, x in v("formularios").items()}
    if clave not in forms:
        return r("formulario-oficial", VERDE, que=f"para «{op.documento}» no hay formulario oficial en la lista: va el formato de la casa", de=de)
    if codigo_oficial(d, forms[clave]):
        return r("formulario-oficial", VERDE, de=de)
    return r("formulario-oficial", ROJO, "todo el documento",
             f"para «{op.documento}» hay formulario oficial ({' o '.join(forms[clave])}) y este archivo no lo usa (paso 0)", de)


def regla_preambulo(d):
    rx = re.compile(v("preambulo_re"), re.I)
    primeros = d.pedazos[:2]
    hall = [(l, t) for l, t in primeros if rx.search(sin_tildes(t))]
    return primero("lo-importante-primero", hall, "la primera linea tiene que decir que pasa y que se necesita, no presentar el documento",
                   DATOS["preambulo_re"]["de"])


def regla_amarillo(d, op):
    de = DATOS["amarillos"]["de"]
    if not d.excel:
        return r("amarillo-y-antes", NO_APLICA)
    amar = set(v("amarillos"))
    hall = []
    for h in d.excel["hojas"]:
        # una fila pintada casi entera es una BANDA del formulario (en el plan de control oficial, «PLAN DE CONTROL» y
        # «REVISIONES» van en amarillo: medido el 18/10 en el .xls aceptado del 15/10), no una correccion
        por_fila = {}
        for (f, c), info in h["celdas"].items():
            if info["fondo"] in amar:
                por_fila[f] = por_fila.get(f, 0) + 1
        # ... pero solo si la fila es un TITULO: a lo sumo una celda con texto y ningun comentario (auditor 18/10: una fila de
        # datos pintada entera se escondia como banda)
        def es_titulo(f):
            celdas = [i for (ff, _c), i in h["celdas"].items() if ff == f]
            return sum(1 for i in celdas if i["valor"] not in (None, "")) <= 1 and not any(i["comentario"] for i in celdas)
        bandas = {f for f, n in por_fila.items() if h.get("ancho", 0) >= 4 and n >= 0.8 * h["ancho"] and es_titulo(f)}
        for (f, c), info in sorted(h["celdas"].items()):
            if f in bandas:
                continue
            lugar = f"pestaña {h['nombre']}, fila {f} col {c}"
            if op.modo == "rearmado":
                if info["fondo"] in amar:
                    hall.append((lugar, f"relleno {info['fondo']}"))
                elif info["comentario"]:
                    hall.append((lugar, f"comentario: {info['comentario']}"))
            else:  # correccion: toda celda con color propio lleva su «ANTES:»
                pintada = info["fondo"] and info["fondo"] not in ("FFFFFF", "000000")
                if pintada and info["fondo"] in amar and not re.search(r"ANTES\s*:", info["comentario"] or "", re.I):
                    hall.append((lugar, f"relleno {info['fondo']} sin «ANTES:»"))
    que = ("un rearmado va limpio: sin amarillo ni notas" if op.modo == "rearmado"
           else "corregir el archivo de otro: cada celda tocada lleva su comentario «ANTES: …»")
    return primero("amarillo-y-antes", hall, que, de)


def regla_b2(d):
    de = "#9 folio 03/09: fila 1 y columna A vacias, título en B2 («requisito directo del dueño»)"
    if not d.excel:
        return r("titulo-en-b2", NO_APLICA)
    hall = []
    for h in d.excel["hojas"]:
        if h["oculta"] or not h["celdas"]:
            continue
        con_valor = {k for k, i in h["celdas"].items() if i["valor"] not in (None, "")}
        fuera = sorted(k for k in con_valor if k[0] == 1 or k[1] == 1)
        if fuera:
            hall.append((f"pestaña {h['nombre']}", f"hay datos en la fila 1 o la columna A (primera: fila {fuera[0][0]} col {fuera[0][1]})"))
        elif (2, 2) not in con_valor:
            hall.append((f"pestaña {h['nombre']}", "B2 esta vacia: el título va en B2"))
    return primero("titulo-en-b2", hall, "fila 1 y columna A vacias, el título en B2", de)


def regla_gris_y_flechitas(d):
    de = DATOS["flechitas"]["de"]
    if not d.excel:
        return r("gris-y-flechitas", NO_APLICA)
    flechas = v("flechitas")
    hall = []
    for h in d.excel["hojas"]:
        for (f, c), info in sorted(h["celdas"].items()):
            val = info["valor"]
            if val in (None, ""):
                continue
            lugar = f"pestaña {h['nombre']}, fila {f} col {c}"
            if (info["italica"] or es_gris(info["letra"])) and f > 2:
                hall.append((lugar, f"aclaracion en gris o itálica: {val}"))
            elif any(x in str(val) for x in flechas):
                hall.append((lugar, f"flechita: {val}"))
    return primero("gris-y-flechitas", hall, "aclaraciones en gris o itálica y flechitas: afuera (título y datos)", de)


def regla_letra(d, tipo):
    if tipo == "a3":  # la hoja de una pagina A3 se mide con los minimos del A3 del tema (12 pt texto, 9 pt tablas)
        t = TEMA["tamanos"]["a3"]
        cuerpo, tabla = t["texto_min"], t["tabla_min"]
    else:
        t = TEMA["tamanos"]["pptx_proyectar" if tipo == "proyectar" else "pptx_leer"]
        cuerpo = t["cuerpo_min"]
        tabla = t.get("tabla_min", cuerpo)
    de = t["_fuente"]
    autor = TEMA["pie"]["autor"]

    def es_pie(txt):
        # el pie (titulo · fecha · autor) y el numero de pagina van mas chicos: medido en el PowerPoint del IMDS
        # aceptado el 09/10 (cuerpo 10 a 14 pt, pie y numero a 9 pt)
        return txt.strip().isdigit() or autor in txt
    hall = []
    for lam in d.laminas:
        # el pie se perdona solo en texto suelto: en una tabla un numero a 6 pt es un dato chico (auditor 18/10)
        chicos = [(pt, k, txt) for pt, k, txt in lam["tamanos"]
                  if pt < (tabla if k == "tabla" else cuerpo) and not (k == "texto" and es_pie(txt))]
        if chicos:
            pt, k, txt = min(chicos)
            hall.append((f"lamina {lam['n']}", f"{k} a {pt:g} pt (minimo {tabla if k == 'tabla' else cuerpo}): {txt[:40]}"))
    return primero("letra-minima", hall, f"letra por debajo del minimo para «{tipo}» (las que heredan del diseño no se miden)", de)


def regla_fuente_sin_captura(d):
    rx = re.compile(v("fuente_re"), re.I)
    hall = [(f"lamina {lam['n']}", rx.search(lam["texto"]).group(0)) for lam in d.laminas
            if rx.search(lam["texto"]) and lam["imagenes"] == 0]
    return primero("fuente-sin-captura", hall, "nombra una fuente y la lamina no tiene la captura del papel", DATOS["fuente_re"]["de"])


def regla_piezas_antes(d):
    de = DATOS["pantalla_re"]["de"]
    if not d.laminas:
        return r("piezas-antes-que-pasos", NO_APLICA)
    pant = re.compile(v("pantalla_re"), re.I)
    piez = re.compile(v("piezas_re"), re.I)

    def limpio(t):
        for x in v("cajetin_hoja"):
            t = t.replace(x, " ")
        return t
    con_pantalla = [lam for lam in d.laminas if pant.search(sin_tildes(lam["texto"]))]
    if not con_pantalla:
        return r("piezas-antes-que-pasos", NO_APLICA, que="no manda seguir una pantalla")
    primera = con_pantalla[0]["n"]
    # antes o en la misma lamina: las hojas aceptadas nombran lo que se mueve con «REF. n …» al lado de la foto
    antes = [lam for lam in d.laminas if lam["n"] <= primera and piez.search(sin_tildes(limpio(lam["texto"])))]
    if antes:
        return r("piezas-antes-que-pasos", VERDE, de=de)
    return r("piezas-antes-que-pasos", ROJO, f"lamina {primera}",
             "manda seguir una pantalla antes de nombrar las piezas que se mueven: primero la hoja-mapa", de)


def regla_contador_y_hora(d, tipo):
    de = DATOS["contador_re"]["de"] + "; " + DATOS["hora_re"]["de"]
    cont = re.compile(v("contador_re"), re.I)
    hora = re.compile(v("hora_re"))
    dia = re.compile(v("dia_re"), re.I)
    hall = [(l, t) for l, t in d.pedazos if cont.search(t)]
    if tipo == "html":
        # el dia puede estar en el renglon de al lado (la pagina del programita pone «dom 18/10» en una celda y la hora
        # en otra: falso rojo medido por el auditor el 18/10)
        p = d.pedazos
        for i, (l, t) in enumerate(p):
            if hora.search(t) and not any(dia.search(p[j][1]) for j in range(max(0, i - 1), min(len(p), i + 2))):
                hall.append((l, t))
    return primero("contador-y-hora", hall, "contador interno, o una hora sin su día", de)


def regla_medio(ruta):
    de = DATOS["medio_explicacion"]["de"]
    if os.path.splitext(ruta)[1].lower() in v("medio_explicacion"):
        return r("medio", ROJO, os.path.basename(ruta), "una explicación para Fak va en PDF con fotos reales, no en un .txt o un .html", de)
    return r("medio", VERDE, de=de)


# ---------------------------------------------------------------- render (nunca VERDE: para mirar o no corrio)
def render(ruta, carpeta):
    ext = os.path.splitext(ruta)[1].lower()
    os.makedirs(carpeta, exist_ok=True)
    base = os.path.join(carpeta, os.path.splitext(os.path.basename(ruta))[0])
    pdf = None
    try:
        if ext == ".pdf":
            pdf = ruta
        elif ext in (".xlsx", ".xlsm") and os.name == "nt":
            tmp = tempfile.mkdtemp(prefix="revisar_xlsx_")
            copia = os.path.join(tmp, os.path.basename(ruta))
            shutil.copy2(ruta, copia)
            subprocess.run([sys.executable, os.path.join(AQUI, "_xlsxAPdf.py"), tmp, "--apply"], capture_output=True, timeout=300)
            pdf = os.path.splitext(copia)[0] + ".pdf"
        elif ext == ".pptx" and os.name == "nt":
            # por PDF, que respeta el tamaño de la lamina (la imagen directa de exportar.py sale siempre A3: un 16:9 quedaba
            # deformado, auditor 18/10) y trae TODAS las laminas, no solo la primera
            pdf = base + ".pdf"
            subprocess.run([sys.executable, os.path.join(AQUI, "lamina_proceso", "exportar.py"), os.path.abspath(ruta),
                            base + "_exportar.png", pdf], capture_output=True, timeout=300, cwd=carpeta)
        else:
            return r("render", NO_CORRIO, que=f"para {ext} no hay render aca (o no es Windows): abrirlo y mirarlo")
        if not pdf or not os.path.isfile(pdf):
            return r("render", NO_CORRIO, que="no se genero el PDF para rasterizar")
        import fitz
        hechas = []
        with fitz.open(pdf) as doc:
            for i, pag in enumerate(doc, 1):
                if i > 20:
                    break
                destino = f"{base}_{i:02d}.png" if len(doc) > 1 else base + ".png"
                pag.get_pixmap(dpi=110).save(destino)
                hechas.append(destino)
        return r("render", MIRAR, "; ".join(hechas[:3]) + (f"; y {len(hechas) - 3} mas" if len(hechas) > 3 else ""),
                 "mirarla como la ve el que la recibe")
    except (subprocess.SubprocessError, OSError, RuntimeError, ImportError) as e:
        return r("render", NO_CORRIO, que=str(e)[:160])


# ---------------------------------------------------------------- armado
def revisar(ruta, op):
    ext = os.path.splitext(ruta)[1].lower()
    if ext not in LECTORES:
        raise SystemExit(f"no se leer {ext}: van {', '.join(sorted(LECTORES))}. No hago nada.")
    d = Doc()
    LECTORES[ext](ruta, d)
    tipo = op.tipo or ("a3" if ext == ".pptx" and (d.ancho_cm or 0) > 40 else POR_EXTENSION[ext])
    res = []
    # un formulario oficial se reconoce solo por su codigo: ahi no corren las reglas de diseño de la casa (revisor-pedido
    # 18/10: el plan de control aceptado daba ROJO en «titulo en B2» si se corria sin --oficial)
    code = codigo_oficial(d, [c for x in v("formularios").values() for c in x])
    if code and not op.oficial:
        op.oficial = True
        res.append(r("formulario-detectado", MIRAR, que=f"lleva el formulario oficial {code}: corren el paso 0 y las reglas de contenido, no las de diseño"))
    # la firma corre tambien en texto y html (auditor 18/10: «Lo revisé con Claude» en un mail salia VERDE)
    res += [regla_firma(ruta, op), regla_formulario(d, op), regla_notas(d), regla_recomendaciones(d, op), regla_jerga(d)]
    if tipo == "mail":
        res.append(regla_voz(ruta))
    if tipo in ("una-pagina", "html", "texto", "explicacion"):
        res.append(regla_preambulo(d))
    if tipo in ("html", "texto"):
        res.append(regla_contador_y_hora(d, tipo))
    if tipo == "explicacion":
        res.append(regla_medio(ruta))
    if d.excel:
        res += [regla_columnas(d, op), regla_amarillo(d, op)]
        if not op.oficial:
            res += [regla_b2(d), regla_gris_y_flechitas(d)]
    if d.laminas:
        res += [regla_fuente_sin_captura(d), regla_piezas_antes(d)]
        if not op.oficial and tipo in ("proyectar", "leer", "a3"):
            res.append(regla_letra(d, tipo))
    if not op.sin_render:
        res.append(render(ruta, op.render_en or os.path.join(tempfile.gettempdir(), "revisar")))
    return {"archivo": ruta, "tipo": tipo, "modo": op.modo, "oficial": op.oficial, "reglas": res,
            "rojos": sum(1 for x in res if x["estado"] == ROJO), "no_corrieron": sum(1 for x in res if x["estado"] == NO_CORRIO and x["regla"] != "render")}


def imprimir(rep):
    print(f"REVISAR {os.path.basename(rep['archivo'])}  (tipo {rep['tipo']}, {rep['modo']}{', formulario oficial' if rep['oficial'] else ''})")
    for x in rep["reglas"]:
        if x["estado"] == NO_APLICA:
            continue
        linea = f"  [{x['estado']}] {x['regla']}"
        if x["estado"] in (ROJO, NO_CORRIO, MIRAR, SIN_MIRAR):
            linea += f" — {x['que']}" + (f"\n      {x['donde']}" if x["donde"] else "")
        print(linea)
    if rep["rojos"]:
        print(f"  => ROJO: {rep['rojos']} regla(s) frenan")
    elif rep["no_corrieron"]:
        # una regla que no corrio no es un verde (auditor 18/10: sin node, el mail largo salia «VERDE en todas»)
        print(f"  => SIN VERDE: {rep['no_corrieron']} regla(s) no corrieron; lo demas esta en verde")
    else:
        print("  => VERDE en todas las reglas que corrieron")


def opciones(argv=None):
    ap = argparse.ArgumentParser(description="Revisor de contenido de un entregable (tanda 16).")
    ap.add_argument("archivo", nargs="?")
    ap.add_argument("--tipo", choices=TIPOS)
    ap.add_argument("--modo", choices=["rearmado", "correccion"], default="rearmado")
    ap.add_argument("--oficial", action="store_true")
    ap.add_argument("--documento")
    ap.add_argument("--formulario")
    ap.add_argument("--pidio-recomendacion", action="store_true")
    ap.add_argument("--sin-render", action="store_true")
    ap.add_argument("--render-en")
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--selftest", action="store_true")
    return ap.parse_args(argv)


def main():
    op = opciones()
    if op.selftest:
        import revisarCasos
        sys.exit(revisarCasos.selftest(revisar, opciones))
    if not op.archivo or not os.path.isfile(op.archivo):
        print("falta el archivo a revisar (o no existe). No hago nada.")
        sys.exit(2)
    rep = revisar(op.archivo, op)
    if op.json:
        print(json.dumps(rep, ensure_ascii=False, indent=1))
    else:
        imprimir(rep)
    sys.exit(1 if rep["rojos"] else (3 if rep["no_corrieron"] else 0))


if __name__ == "__main__":
    main()
