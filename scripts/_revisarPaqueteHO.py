# -*- coding: utf-8 -*-
"""_revisarPaqueteHO.py - revisor automatico de un paquete de hojas de proceso (PDF).

POR QUE EXISTE: el 07/10/2026 se armo el paquete de hojas de proceso para imprimir y pegar en
planta (hojas de operaciones, formulario I-IN-002.4-R01, varios autores y varios generadores,
algunas salidas de Excel y otras de PowerPoint). Fak lo miro a ojo y encontro, una y otra vez,
errores que una maquina ve en un segundo: una portada metida entre las hojas, hojas sin numero de
HO o con la operacion en "-", el logo viejo (violeta), una hoja chica con media pagina en blanco,
hojas cortadas abajo, un plan de reaccion que no era el de las HO de Excel, textos con TBD o
PRELIMINAR, una hoja vertical entre las apaisadas, la misma hoja generica repetida en tres
productos. Los gates del generador miran UNA hoja de UN autor; este mira el PDF ya armado, como
lo va a ver quien lo imprime, y lista pagina por pagina lo que Fak iba a encontrar.

COMO SE USA (solo lee: no modifica ningun PDF):

    python scripts/_revisarPaqueteHO.py <paquete.pdf> [<otro.pdf> ...]
    python scripts/_revisarPaqueteHO.py <paquete.pdf> --paginas 1-5,47      # solo esas paginas
    python scripts/_revisarPaqueteHO.py <paquete.pdf> --json                # salida para otro programa
    python scripts/_revisarPaqueteHO.py <paquete.pdf> --solo-rojo           # sin los avisos

Cada hallazgo sale con la pagina, el HO y el N de operacion tal como estan impresos, para ubicar la
hoja sin abrir el PDF:   p.47   [HO | op 70] ROJO  SIN_HO   casillero HO sin numero de 3 digitos: "HO"

Sale con codigo 1 si hay algun defecto ROJO (el paquete no se imprime), 0 si solo hay avisos o
nada, 2 si un archivo no se pudo abrir. Con --paginas, TAMANO_MEZCLADO y REPETIDA comparan solo
entre las paginas elegidas. Tarda unos 0,3 s por pagina (renderiza cada una para medirla).

TIPOS DE PAGINA: "HO" es la que trae el casillero N de operacion, el titulo HOJA DE OPERACIONES o el
sello Form: I-IN-002.4 (incluye las hojas de embalaje, que no tienen casillero de operacion).
"CAMINO DE INSPECCION" (las laminas de grampas del paquete A3) es un anexo conocido: no se le pide HO,
operacion ni plan, pero si logo, tamano, palabras y que no este cortada. Cualquier otra pagina sin
esos sellos es PORTADA.

DEFECTOS (ROJO salvo que diga AVISO). Cada uno sale con codigo, pagina y la evidencia (el texto
o la medida que lo prueba):

  PORTADA           pagina que no es una hoja de operacion (portada o indice de un grupo)
  SIN_HO            casillero HO (arriba a la derecha) sin numero de 3 digitos
  SIN_OP            N de operacion vacio, "-", "TBD" o con coma decimal ("40,1")
  PALABRA_PROHIBIDA TBD, PENDIENTE, PRELIMINAR, BORRADOR, xxx, "x cantidad", ...
  LOGO_VIEJO        el logo de la esquina no es el oficial (compara por imagen)
  HOJA_CHICA        lo impreso ocupa poco de la hoja de papel (ROJO; AVISO si anda cerca)
  CORTADA           contenido que llega al borde o tabla sin su borde inferior
  PLAN_NO_ESTANDAR  el plan de reaccion no es el de las HO de Excel (AVISO si solo cambia el
                    disparador pero sigue empezando con "SI DETECTA")
  TAMANO_MEZCLADO   AVISO: paginas de distinto tamano u orientacion en el mismo PDF
  CAPTURA_PEGADA    AVISO: la descripcion es una captura pegada en vez de texto
  REPETIDA          AVISO: misma hoja generica repetida en varios productos (imprimir una)
  EPP_VACIO         AVISO: el recuadro ELEMENTOS DE SEGURIDAD sin iconos

UMBRALES: estan arriba, en la seccion CONSTANTES, cada uno con la medicion que lo justifica
(los PDF del 07/10/2026 y la prueba en las dos direcciones del test
__tests__/scripts/revisarPaqueteHO.test.mjs).
"""
import argparse
import collections
import colorsys
import io
import json
import os
import re
import sys
import unicodedata

# numpy trae su propio juego de hilos de OpenBLAS: en la notebook (poca memoria libre) reservarlos
# todos para sumar cuatro numeros hizo fallar el arranque ("Memory allocation still failed").
os.environ.setdefault('OPENBLAS_NUM_THREADS', '1')

import fitz  # PyMuPDF
import numpy as np
from PIL import Image, ImageFilter

# --------------------------------------------------------------------------------------
# CONSTANTES (todas medidas sobre los PDF del paquete del 07/10/2026)
# --------------------------------------------------------------------------------------

ROJO, AVISO = 'ROJO', 'AVISO'

#: el logo oficial (el mismo que usan los generadores de hojas). BARACK_LOGO_OFICIAL lo pisa.
LOGO_OFICIAL = os.environ.get('BARACK_LOGO_OFICIAL') or (
    r'C:\Users\FacundoS-PC\BARACK ARGENTINA SRL\Ingenier' + '\u00eda' + r' y Proyecto - General'
    r'\INGENIERIA BARACK (NUNCA BORRAR)\barack_logo.png')

#: Similitud de forma (correlacion de las manchas de tinta, 0 a 1) para dar un logo por oficial.
#: Medido sobre las 4 variantes que hay en los PDF (330 paginas): las copias del logo oficial,
#: sean nitidas, pixeladas o estiradas, dieron 0,963 o mas; el logo viejo (violeta, MERCOSUL del
#: tamano de BARACK) dio -0,01 en las 14 paginas. 0,85 deja la misma distancia de margen a los dos
#: lados del hueco que se midio.
LOGO_SIMILITUD_MIN = 0.85
#: Diferencia de matiz (grados) entre la tinta del recorte y la del oficial (208). El oficial es
#: azul (207-208 en todas las paginas), el viejo violeta (239).
LOGO_MATIZ_MAX = 15.0

#: HOJA_CHICA: de la hoja de papel en que se imprime, cuanto ocupa lo impreso. Se toma el lado que
#: mas ocupa (el que limita al escalar la hoja a pagina completa). Medido en 346 paginas: las tres
#: hojas chicas del paquete (504 x 356 pt dentro de un PDF A4) dieron 0,59 de ancho y 0,50 a 0,58 de
#: alto; la siguiente mas baja es una hoja de Excel con margen ancho (0,64 de ancho, 0,82 de alto);
#: todas las demas, 0,93 o mas. ROJO por debajo de 0,70 (mitad del camino entre 0,59 y 0,82, con
#: un hueco de 0,11 a cada lado); AVISO hasta 0,85 (atrapa la de 0,82 y deja afuera las de 0,93).
CHICA_ROJO_MAX = 0.70
CHICA_AVISO_MAX = 0.85

#: CORTADA. BORDE_TINTA_PT: tinta a menos de 2 pt del borde (las dos hojas con el recuadro pegado al
#: borde derecho dieron 0 pt; la mas cercana de las demas, 4 pt). FILO_MIN_FRACCION: la ultima fila
#: impresa de una hoja entera es una linea de cierre larga; en las seis hojas cortadas abajo la mas
#: larga midio 1 a 3 % del ancho impreso, y en las que no se cortan, 35 % como minimo (hojas de
#: embalaje, cuyo borde de abajo es el recuadro del plan, mas angosto que la hoja).
BORDE_TINTA_PT = 2.0
FILO_MIN_FRACCION = 0.20

#: PLAN_NO_ESTANDAR. La franja en blanco a la derecha del plan debe medir al menos 20 % del ancho de
#: la pagina para contar: las 7 hojas del plan angosto de la prensa de embossing dejaban 43 % en
#: blanco; en las hojas de Excel a la derecha del plan hay siempre tabla con tinta.
PLAN_BLANCO_MIN = 0.20
PLAN_BANDA = 'PLAN DE REACCION ANTE NO CONFORME'
PLAN_DISPARADOR = 'SIDETECTAPRODUCTOOPROCESONOCONFORME'
PLAN_RENGLONES = [
    ('DETENGA LA OPERACION', 'DETENGALAOPERACION'),
    ('NOTIFIQUE DE INMEDIATO A SU LIDER O SUPERVISOR', 'NOTIFIQUEDEINMEDIATOASULIDEROSUPERVISOR'),
    ('ESPERE LA DEFINICION DEL LIDER O SUPERVISOR', 'ESPERELADEFINICIONDELLIDEROSUPERVISOR'),
]

#: PALABRA_PROHIBIDA: (etiqueta, regex sobre el texto en mayuscula y sin tildes). Orden: lo mas
#: especifico primero, asi "FOTOS PENDIENTES" no sale tambien como "PENDIENTE".
PALABRAS = [
    ('FOTOS PENDIENTES', r'\bFOTOS?\s+PENDIENTES?\b'),
    ('EN DESARROLLO', r'\bEN\s+DESARROLLO\b'),
    ('POR COMPLETAR', r'\bPOR\s+COMPLETAR\b'),
    ('x CANTIDAD', r'\bX\s+CANTIDAD\b'),
    ('TBD', r'\bTBD\b'),
    # "PENDIENTE DE CONTROL" es texto normal de flujograma, no un pendiente de la hoja
    ('PENDIENTE', r'\bPENDIENTES?\b(?!\s+DE\s+CONTROL)'),
    ('PRELIMINAR', r'\bPRELIMINAR(?:ES)?\b'),
    ('BORRADOR', r'\bBORRADOR(?:ES)?\b'),
    ('xxx', r'\bX{3,}\b'),
]

TAM_TOLERANCIA_PT = 4.0
A4 = (595.0, 842.0)
A3 = (842.0, 1191.0)


# --------------------------------------------------------------------------------------
# texto
# --------------------------------------------------------------------------------------

def sin_tildes(s):
    """Quita tildes sin cambiar el largo (cada caracter vuelve a un solo caracter)."""
    out = []
    for c in s:
        dec = unicodedata.normalize('NFD', c)
        out.append(dec[0] if dec else c)
    return ''.join(out)


def norm(s):
    """Mayuscula, sin tildes, espacios colapsados."""
    return re.sub(r'\s+', ' ', sin_tildes(s).upper()).strip()


def clave(s):
    """Solo letras y numeros, mayuscula y sin tildes: para comparar textos con comillas raras."""
    return re.sub(r'[^A-Z0-9]', '', sin_tildes(s).upper())


def recorte(s, n=60):
    s = re.sub(r'\s+', ' ', s).strip()
    return s if len(s) <= n else s[:n - 1] + '\u2026'


# --------------------------------------------------------------------------------------
# lectura de una pagina
# --------------------------------------------------------------------------------------

class Linea:
    """Una linea de texto del PDF con su caja (en puntos, origen arriba a la izquierda)."""
    __slots__ = ('x0', 'y0', 'x1', 'y1', 'texto', 'n')

    def __init__(self, bbox, texto):
        self.x0, self.y0, self.x1, self.y1 = bbox
        self.texto = texto
        self.n = norm(texto)

    @property
    def cx(self):
        return (self.x0 + self.x1) / 2

    def __repr__(self):
        return 'Linea(%.0f,%.0f,%.0f,%.0f,%r)' % (self.x0, self.y0, self.x1, self.y1, self.texto)


def leer_lineas(page):
    out = []
    for b in page.get_text('dict').get('blocks', []):
        if b.get('type') != 0:
            continue
        for l in b.get('lines', []):
            t = ''.join(s['text'] for s in l.get('spans', []))
            if t.strip():
                out.append(Linea(l['bbox'], t))
    return out


def render_gris(page, dpi=72):
    """La pagina como la veria quien la imprime: matriz de grises (1 px = 1 pt a 72 dpi)."""
    pix = page.get_pixmap(dpi=dpi, colorspace=fitz.csGRAY, alpha=False)
    return np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width)


class Pagina:
    def __init__(self, doc, i):
        self.doc = doc
        self.i = i
        self.n = i + 1
        self.page = doc[i]
        self.W = self.page.rect.width
        self.H = self.page.rect.height
        self.lineas = leer_lineas(self.page)
        self.texto = self.page.get_text()
        self._gris = None
        self._dibujos = None
        self.tipo = self._tipo()

    @property
    def dibujos(self):
        if self._dibujos is None:
            self._dibujos = self.page.get_drawings()
        return self._dibujos

    def rect_banda(self, linea):
        """El rectangulo relleno (la banda de color de la celda) que contiene a la linea, o None."""
        c = fitz.Point(linea.cx, (linea.y0 + linea.y1) / 2)
        mejor = None
        for x in self.dibujos:
            r = x['rect']
            if x.get('fill') is not None and r.height < 30 and r.width >= (linea.x1 - linea.x0) and r.contains(c):
                if mejor is None or r.width < mejor.width:
                    mejor = r
        return mejor

    @property
    def gris(self):
        if self._gris is None:
            self._gris = render_gris(self.page)
        return self._gris

    def buscar(self, prefijo):
        """Primera linea cuyo texto normalizado empieza con `prefijo`."""
        for l in self.lineas:
            if l.n.startswith(prefijo):
                return l
        return None

    def _tipo(self):
        """HO = tiene el casillero N de operacion, el titulo HOJA DE OPERACIONES o el sello Form: I-IN-002.4
        (las hojas de embalaje no traen casillero de operacion; la portada solo cita el formulario)."""
        marcas = ('N° DE OPERACION', 'NO DE OPERACION', 'HOJA DE OPERACIONES', 'FORM: I-IN-002.4')
        for l in self.lineas:
            if l.n.startswith(marcas):
                return 'HO'
        if 'CAMINO DE INSPECCION' in norm(self.texto):
            return 'CAMINO'
        return 'PORTADA'


# --------------------------------------------------------------------------------------
# defectos
# --------------------------------------------------------------------------------------

def d(codigo, nivel, evidencia):
    return {'codigo': codigo, 'nivel': nivel, 'evidencia': evidencia}


# ---- 1 PORTADA ---------------------------------------------------------------------

def chequear_portada(p):
    if p.tipo != 'PORTADA':
        return []
    primera = recorte(p.lineas[0].texto, 70) if p.lineas else '(sin texto)'
    return [d('PORTADA', ROJO,
              'la pagina no es una hoja de operacion: no tiene el bloque "N\u00b0 DE OPERACION" ni el '
              'formulario I-IN-002.4; empieza con "%s"' % primera)]


# ---- 2 SIN_HO ----------------------------------------------------------------------

RE_HO = re.compile(r'^HO(?![A-Z])')
RE_HO_NUM = re.compile(r'^HO\s*[-\u2013\u2014]?\s*(?:N[\u00b0\u00ba]\.?\s*)?[-\u2013\u2014]?\s*(?<!\d)(\d{3})(?!\d)')


def texto_casillero_ho(p):
    """(texto, linea) del casillero HO de arriba a la derecha, o ('', None) si no hay ninguno."""
    tope = None
    for pref in ('N\u00b0 DE OPERACION', 'NO DE OPERACION', 'DENOMINACION'):
        l = p.buscar(pref)
        if l is not None:
            tope = l.y0
            break
    if tope is None:
        tope = 0.17 * p.H
    cand = [l for l in p.lineas
            if l.x0 > 0.5 * p.W and l.y1 <= tope + 1
            and 'FORM' not in l.n and 'I-IN-002' not in l.n and not l.n.startswith('HOJA')]
    ho = [l for l in cand if RE_HO.match(l.n)]
    if not ho:
        return '', None
    arriba = min(ho, key=lambda l: l.y0)
    # lo que este en la misma caja (misma franja vertical, a su derecha o debajo)
    resto = [l for l in cand if l is not arriba and l.y0 >= arriba.y0 - 2 and l.y0 <= arriba.y1 + 6
             and l.x0 >= arriba.x0 - 4]
    resto.sort(key=lambda l: (round(l.y0), l.x0))
    return ' '.join([arriba.texto.strip()] + [l.texto.strip() for l in resto]), arriba


def chequear_sin_ho(p):
    if p.tipo != 'HO':
        return []
    txt, _ = texto_casillero_ho(p)
    if not txt:
        return [d('SIN_HO', ROJO, 'no hay casillero con "HO" arriba a la derecha')]
    if not RE_HO_NUM.match(norm(txt)):
        return [d('SIN_HO', ROJO, 'casillero HO sin numero de 3 digitos: "%s"' % txt)]
    return []


# ---- 3 SIN_OP ----------------------------------------------------------------------

def valor_operacion(p):
    """(hay_etiqueta, texto del valor o None) del casillero N de operacion."""
    lab = p.buscar('N\u00b0 DE OPERACION') or p.buscar('NO DE OPERACION')
    if lab is None:
        return False, None
    den = p.buscar('DENOMINACION')
    sec = p.buscar('SECTOR')
    y_max = sec.y0 if (sec is not None and sec.y0 > lab.y1) else lab.y1 + 24
    x_max = (den.x0 + 3) if (den is not None and den.x0 > lab.x1) else lab.x1 + 60
    cand = [l for l in p.lineas
            if l.y0 >= lab.y1 - 1 and l.y0 < y_max - 1 and l.x1 <= x_max and l.x1 >= lab.x0 - 30]
    if not cand:
        return True, None
    best = min(cand, key=lambda l: abs(l.cx - lab.cx))
    return True, best.texto.strip()


RE_OP_OK = re.compile(r'^\d{1,3}(\.\d{1,2})?$')


def chequear_sin_op(p):
    if p.tipo != 'HO':
        return []
    hay, v = valor_operacion(p)
    if not hay:
        return []          # el formulario de embalaje no tiene casillero de operacion
    if v is None or v == '':
        return [d('SIN_OP', ROJO, 'el N\u00b0 de operacion esta vacio')]
    vn = norm(v)
    if vn in ('-', '--', '\u2013', '\u2014', '.', 'N/A', 'S/N') or 'TBD' in vn:
        return [d('SIN_OP', ROJO, 'N\u00b0 de operacion = "%s"' % v)]
    if re.match(r'^\d+,\d+$', v):
        return [d('SIN_OP', ROJO, 'N\u00b0 de operacion con coma decimal: "%s" (debe ser "%s")'
                  % (v, v.replace(',', '.')))]
    if not RE_OP_OK.match(v):
        return [d('SIN_OP', ROJO, 'N\u00b0 de operacion con formato raro: "%s"' % v)]
    return []


# ---- 4 PALABRA_PROHIBIDA -----------------------------------------------------------

def chequear_palabras(p):
    """Un defecto por palabra y por pagina, con cuantas veces aparece y el contexto de las dos primeras."""
    plano = re.sub(r'\s+', ' ', p.texto)
    up = sin_tildes(plano).upper()
    usados = []
    por_palabra = collections.OrderedDict()
    for etiqueta, rx in PALABRAS:
        for m in re.finditer(rx, up):
            if any(m.start() < b and a < m.end() for a, b in usados):
                continue
            usados.append((m.start(), m.end()))
            a, b = max(0, m.start() - 28), min(len(plano), m.end() + 28)
            por_palabra.setdefault(etiqueta, []).append(plano[a:b].strip())
    out = []
    for etiqueta, ctx in por_palabra.items():
        veces = '' if len(ctx) == 1 else ' (%d veces)' % len(ctx)
        out.append(d('PALABRA_PROHIBIDA', ROJO, '%s%s: %s' % (
            etiqueta, veces, ' | '.join('…%s…' % c for c in ctx[:2]))))
    return out


# ---- 5 LOGO_VIEJO ------------------------------------------------------------------

_LOGO_REF = {}


def _cobertura_croma(im):
    """Mancha de tinta de color: ignora el negro y el gris (bordes de celda, texto)."""
    a = np.asarray(im.convert('RGB')).astype(float)
    croma = a.max(axis=2) - a.min(axis=2)
    lum = a.mean(axis=2)
    cov = np.clip(croma / 120.0, 0, 1) * (lum < 235)
    return a, cov


def firma_logo(im):
    """(mancha 96x48 normalizada, matiz en grados, saturacion) o None si no hay tinta de color."""
    a, cov = _cobertura_croma(im)
    m = cov > 0.3
    ys, xs = np.where(m.any(axis=1))[0], np.where(m.any(axis=0))[0]
    if len(xs) == 0 or len(ys) == 0:
        return None
    y0, y1, x0, x1 = ys[0], ys[-1] + 1, xs[0], xs[-1] + 1
    sub = cov[y0:y1, x0:x1]
    mancha = Image.fromarray((sub * 255).astype('uint8')).resize((96, 48), Image.BILINEAR)
    mancha = np.asarray(mancha.filter(ImageFilter.GaussianBlur(1.2))).astype(float).ravel()
    ink = a[y0:y1, x0:x1][m[y0:y1, x0:x1]]
    lum_ink = ink.mean(axis=1)
    fuerte = ink[lum_ink <= np.percentile(lum_ink, 40)]
    if len(fuerte) == 0:
        fuerte = ink
    h, s, _ = colorsys.rgb_to_hsv(*(fuerte.mean(axis=0) / 255.0))
    return mancha, h * 360.0, s


def _correlacion(a, b):
    a = a - a.mean()
    b = b - b.mean()
    den = float(np.sqrt((a * a).sum() * (b * b).sum()))
    return float((a * b).sum() / den) if den > 0 else 0.0


def logo_referencia():
    if 'ref' not in _LOGO_REF:
        ref = None
        if os.path.exists(LOGO_OFICIAL):
            im = Image.open(LOGO_OFICIAL).convert('RGBA')
            fondo = Image.new('RGBA', im.size, 'white')
            fondo.alpha_composite(im)
            im = fondo.convert('RGB').resize((im.width * 3, im.height * 3), Image.LANCZOS)
            ref = firma_logo(im)
        _LOGO_REF['ref'] = ref
    return _LOGO_REF['ref']


def recorte_logo(p, dpi=200):
    """Imagen del logo (lo que se ve impreso en la esquina de arriba a la izquierda) o None."""
    cands = []
    for i in p.page.get_image_info():
        x0, y0, x1, y1 = i['bbox']
        if x0 < 0.2 * p.W and y0 < 0.2 * p.H and (x1 - x0) < 0.35 * p.W and (y1 - y0) < 0.15 * p.H \
                and (x1 - x0) > 25:
            cands.append((x0 + y0, fitz.Rect(i['bbox'])))
    if cands:
        clip = min(cands, key=lambda t: t[0])[1]
    else:
        clip = fitz.Rect(0, 0, 0.25 * p.W, 0.12 * p.H)     # sin imagen: se mira la esquina entera
    pix = p.page.get_pixmap(dpi=dpi, clip=clip, alpha=False)
    return Image.frombytes('RGB', (pix.width, pix.height), pix.samples)


def chequear_logo(p):
    if p.tipo == 'PORTADA':
        return []
    ref = logo_referencia()
    if ref is None:
        return [d('LOGO_VIEJO', AVISO, 'no se pudo comparar: falta el logo oficial en "%s"' % LOGO_OFICIAL)]
    f = firma_logo(recorte_logo(p))
    if f is None:
        return [d('LOGO_VIEJO', ROJO, 'no hay logo de color en la esquina superior izquierda')]
    sim = _correlacion(ref[0], f[0])
    dh = abs(f[1] - ref[1])
    dh = min(dh, 360 - dh)
    if sim < LOGO_SIMILITUD_MIN or dh > LOGO_MATIZ_MAX:
        return [d('LOGO_VIEJO', ROJO,
                  'el logo de la esquina no es el oficial: similitud %.2f con el oficial (minimo %.2f), '
                  'matiz de la tinta %d\u00b0 contra %d\u00b0 del oficial (violeta = logo viejo)'
                  % (sim, LOGO_SIMILITUD_MIN, round(f[1]), round(ref[1])))]
    return []


# ---- 6 HOJA_CHICA / 7 CORTADA ------------------------------------------------------

def hoja_de_papel(w, h):
    """La hoja (A4 o A3, en la orientacion de la pagina) en que se imprime esta pagina."""
    apaisada = w >= h
    for base in (A4, A3):
        bw, bh = (max(base), min(base)) if apaisada else (min(base), max(base))
        if w <= bw + TAM_TOLERANCIA_PT and h <= bh + TAM_TOLERANCIA_PT:
            return ('A4' if base is A4 else 'A3') + (' apaisada' if apaisada else ' vertical'), bw, bh
    return 'tamano propio', w, h


def caja_tinta(gris, umbral=235):
    """(x0, y0, x1, y1) en px de lo que no es blanco, o None."""
    m = gris < umbral
    ys = np.where(m.any(axis=1))[0]
    xs = np.where(m.any(axis=0))[0]
    if len(xs) == 0:
        return None
    return int(xs[0]), int(ys[0]), int(xs[-1]) + 1, int(ys[-1]) + 1


def chequear_hoja_chica(p, caja):
    if caja is None:
        return [d('HOJA_CHICA', ROJO, 'la pagina esta en blanco')]
    nombre, bw, bh = hoja_de_papel(p.W, p.H)
    ow = (caja[2] - caja[0]) / bw
    oh = (caja[3] - caja[1]) / bh
    lim = max(ow, oh)
    ev = ('lo impreso ocupa %d %% del ancho y %d %% del alto de la hoja %s (pagina de %d x %d pt)'
          % (round(100 * ow), round(100 * oh), nombre, round(p.W), round(p.H)))
    if lim < CHICA_ROJO_MAX:
        return [d('HOJA_CHICA', ROJO, ev + '; sale chica con media hoja en blanco (minimo %d %%)' % round(100 * CHICA_ROJO_MAX))]
    if lim < CHICA_AVISO_MAX:
        return [d('HOJA_CHICA', AVISO, ev + '; cerca del minimo (%d %%)' % round(100 * CHICA_ROJO_MAX))]
    return []


def corrida_mas_larga(fila_oscura):
    """Largo de la racha mas larga de True en un vector."""
    mejor = act = 0
    for v in fila_oscura:
        act = act + 1 if v else 0
        if act > mejor:
            mejor = act
    return mejor


def chequear_cortada(p, caja):
    if caja is None:
        return []
    g = p.gris
    h, w = g.shape
    out = []
    # contenido que llega al borde de la pagina
    cerca = []
    if caja[0] < BORDE_TINTA_PT:
        cerca.append('izquierdo')
    if caja[1] < BORDE_TINTA_PT:
        cerca.append('superior')
    if w - caja[2] < BORDE_TINTA_PT:
        cerca.append('derecho')
    if h - caja[3] < BORDE_TINTA_PT:
        cerca.append('inferior')
    if cerca:
        out.append(d('CORTADA', ROJO, 'hay tinta a menos de %.0f pt del borde %s de la pagina (se corta al imprimir)'
                     % (BORDE_TINTA_PT, ' y '.join(cerca))))
    # tabla o renglones sin su borde inferior: la ultima fila impresa debe ser una linea larga
    ancho = caja[2] - caja[0]
    filas = range(max(caja[1], caja[3] - 5), caja[3])
    run = max((corrida_mas_larga(g[y, caja[0]:caja[2]] < 140) for y in filas), default=0)
    frac = run / ancho if ancho else 0
    if frac < FILO_MIN_FRACCION and not cerca:
        ult = [l for l in p.lineas if l.y1 >= caja[3] - 14]
        txt = recorte(ult[-1].texto, 45) if ult else '(sin texto)'
        out.append(d('CORTADA', ROJO,
                     'no hay borde inferior debajo del ultimo renglon "%s": la linea de cierre mas larga mide '
                     '%d %% del ancho impreso (minimo %d %%); el pie de la hoja se corta'
                     % (txt, round(100 * frac), round(100 * FILO_MIN_FRACCION))))
    return out


# ---- 8 PLAN_NO_ESTANDAR ------------------------------------------------------------

RE_ACCION = re.compile(r'^\s*\d+\s*[.)]\s+\S')


def chequear_plan(p):
    if p.tipo != 'HO':
        return []
    banda = None
    for l in p.lineas:
        if l.n.startswith('PLAN DE REACCION'):
            banda = l
            break
    if banda is None:
        return [d('PLAN_NO_ESTANDAR', ROJO, 'la hoja no tiene la banda "PLAN DE REACCION ANTE NO CONFORME"')]
    def key(l):
        return clave(l.texto)
    detenga = None
    for l in p.lineas:
        if l.y0 >= banda.y1 - 2 and key(l).startswith('DETENGALAOPERACION'):
            detenga = l
            break
    problemas = []
    avisos = []
    if detenga is None:
        return [d('PLAN_NO_ESTANDAR', ROJO, 'falta el renglon "DETENGA LA OPERACION" debajo de la banda del plan')]
    izq = [l for l in p.lineas if l.y0 >= banda.y1 - 2 and abs(l.x0 - detenga.x0) < 8 and l.y0 < p.H]
    izq.sort(key=lambda l: l.y0)
    filas = [l for l in izq if l.y0 < detenga.y0 - 1]
    filas = [l for l in filas if l.y0 - banda.y1 < 60]
    # disparador: el/los renglones entre la banda y DETENGA
    disp = ' '.join(l.texto.strip() for l in filas)
    kd = clave(disp)
    if not kd:
        problemas.append('no hay renglon disparador "SI DETECTA ..." encima de "DETENGA LA OPERACION"')
    elif kd != PLAN_DISPARADOR:
        if kd.startswith('SIDETECTA'):
            avisos.append('disparador distinto del estandar pero empieza con "SI DETECTA": "%s"' % recorte(disp, 90))
        else:
            problemas.append('disparador propio de la maquina en vez de SI DETECTA "PRODUCTO" O "PROCESO" '
                             'NO CONFORME: "%s"' % recorte(disp, 90))
    # los tres renglones fijos, textuales y en orden
    for etiqueta, k in PLAN_RENGLONES:
        enc = [l for l in izq if l.y0 >= detenga.y0 - 1 and clave(l.texto) == k]
        if not enc:
            cerca = [l for l in izq if l.y0 >= detenga.y0 - 1 and k[:12] in clave(l.texto)]
            if cerca:
                problemas.append('el renglon "%s" fue modificado: "%s"' % (etiqueta, recorte(cerca[0].texto, 90)))
            else:
                problemas.append('falta el renglon "%s"' % etiqueta)
    # columna de acciones al costado: renglones numerados a la derecha de los del plan, a la altura del plan
    y_ini = (filas[0].y0 if filas else detenga.y0) - 3
    y_fin = max(l.y1 for l in izq) + 40 if izq else detenga.y1 + 40
    x_der = max((l.x1 for l in izq), default=detenga.x1)
    acciones = [l for l in p.lineas if l.x0 > x_der + 6 and y_ini <= l.y0 <= y_fin and RE_ACCION.match(l.texto)]
    if acciones:
        acciones.sort(key=lambda l: l.y0)
        problemas.append('columna de acciones al costado ("%s"...): el plan estandar no lleva acciones'
                         % recorte(acciones[0].texto, 50))
    # armado: el plan va abajo a la izquierda y el ciclo de control a su derecha (canon 4.5); un plan
    # angosto con toda la franja de su derecha en blanco es el armado que Fak rechazo el 07/10/2026
    rect = p.rect_banda(banda)
    if rect is not None and izq:
        y_a, y_b = int(banda.y0) - 2, int(min(p.H, max(l.y1 for l in izq) + 3))
        g = p.gris
        caja = caja_tinta(g)
        x_a = int(rect.x1) + 6
        x_b = (caja[2] - 6) if caja else g.shape[1]
        if caja and x_b - x_a >= PLAN_BLANCO_MIN * p.W and y_b > y_a:
            if int((g[y_a:y_b, x_a:x_b] < 235).sum()) <= 3:
                problemas.append('el plan llega hasta x=%d pt y a su derecha la hoja queda en blanco (%d pt de ancho '
                                 'sin tinta): no es el armado de las HO de Excel, que lleva el ciclo de control al lado'
                                 % (round(rect.x1), x_b - x_a))
    out = [d('PLAN_NO_ESTANDAR', ROJO, m) for m in problemas]
    if not problemas:
        out += [d('PLAN_NO_ESTANDAR', AVISO, m) for m in avisos]
    return out


# ---- 12 EPP_VACIO ------------------------------------------------------------------

def es_icono_o_tira(w, h):
    """Un icono de EPP suelto (casi cuadrado) o la tira de varios iconos (mucho mas ancha que alta);
    una foto chica (94 x 55 pt, aspecto 1,7) no es ninguno de los dos."""
    if not (14 <= w <= 220 and 14 <= h <= 90):
        return False
    a = w / h
    return 0.6 <= a <= 1.5 or 2.5 <= a <= 8


def chequear_epp(p):
    if p.tipo != 'HO':
        return []
    lab = p.buscar('ELEMENTOS DE SEGURIDAD')
    if lab is None:
        return [d('EPP_VACIO', AVISO, 'no hay recuadro ELEMENTOS DE SEGURIDAD')]
    # el recuadro es tan ancho como su banda de titulo; los iconos van arriba o abajo de ella
    banda = p.rect_banda(lab)
    x0c, x1c = (banda.x0 - 5, banda.x1 + 5) if banda is not None else (lab.x0 - 80, lab.x1 + 80)
    n = 0
    for i in p.page.get_image_info():
        x0, y0, x1, y1 = i['bbox']
        if not es_icono_o_tira(x1 - x0, y1 - y0):
            continue
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        if x0c <= cx <= x1c and lab.y1 - 80 <= cy <= lab.y1 + 90:
            n += 1
    if n == 0:
        return [d('EPP_VACIO', AVISO, 'el recuadro ELEMENTOS DE SEGURIDAD no tiene ningun icono')]
    return []


# ---- 10 CAPTURA_PEGADA -------------------------------------------------------------

CAPTURA_AREA_MIN = 0.30      # la imagen cubre al menos 30 % de la zona de descripcion...
CAPTURA_TEXTO_MAX = 60       # ...y la zona tiene menos de 60 caracteres de texto real


def zona_descripcion(p):
    """(x0, x1, y0, y1) de la zona de texto de DESCRIPCION DE LA OPERACION, o None."""
    lab = p.buscar('DESCRIPCION DE LA OPERACION')
    if lab is None:
        return None
    r = p.rect_banda(lab)
    if r is None:
        return None
    cierres = [l.y0 for l in p.lineas
               if l.y0 > r.y1 + 20 and r.x0 - 5 <= l.cx <= r.x1 + 5
               and l.n.startswith(('CICLO DE CONTROL', 'ELEMENTOS DE SEGURIDAD', 'PLAN DE REACCION'))]
    y1 = min(cierres) if cierres else r.y1 + 0.45 * p.H
    return r.x0, r.x1, r.y1, y1


def chequear_captura(p):
    if p.tipo != 'HO':
        return []
    z = zona_descripcion(p)
    if z is None:
        return []
    zx0, zx1, zy0, zy1 = z
    zona = (zx1 - zx0) * (zy1 - zy0)
    if zona <= 0:
        return []
    chars = sum(len(l.texto.strip()) for l in p.lineas if zy0 <= l.y0 < zy1 and zx0 - 2 <= l.cx <= zx1 + 2)
    mejor = 0.0
    for i in p.page.get_image_info():
        x0, y0, x1, y1 = i['bbox']
        ix0, ix1, iy0, iy1 = max(x0, zx0), min(x1, zx1), max(y0, zy0), min(y1, zy1)
        if ix1 > ix0 and iy1 > iy0 and (x1 - x0) >= 0.5 * (zx1 - zx0):
            mejor = max(mejor, (ix1 - ix0) * (iy1 - iy0) / zona)
    if mejor >= CAPTURA_AREA_MIN and chars < CAPTURA_TEXTO_MAX:
        return [d('CAPTURA_PEGADA', AVISO,
                  'la zona DESCRIPCION DE LA OPERACION tiene %d caracteres de texto y una imagen que cubre el %d %% '
                  'de la zona: la descripcion es una captura pegada, no texto' % (chars, round(100 * mejor)))]
    return []


# ---- 9 TAMANO_MEZCLADO -------------------------------------------------------------

def tamano_etiqueta(w, h):
    """A4/A3 con su orientacion si mide eso (con tolerancia); si no, el tamano propio."""
    for nombre, base in (('A4', A4), ('A3', A3)):
        for apaisada in (True, False):
            bw, bh = (max(base), min(base)) if apaisada else (min(base), max(base))
            if abs(w - bw) <= TAM_TOLERANCIA_PT and abs(h - bh) <= TAM_TOLERANCIA_PT:
                return nombre + (' apaisada' if apaisada else ' vertical')
    return 'otro tamano (%d x %d pt)' % (round(w), round(h))


def chequear_tamanos(paginas):
    """{n: [defectos]} para las paginas que no son del tamano/orientacion mayoritario del PDF."""
    out = {}
    if len(paginas) < 2:
        return out
    cuenta = collections.Counter(tamano_etiqueta(p.W, p.H) for p in paginas)
    comun, _ = cuenta.most_common(1)[0]
    for p in paginas:
        t = tamano_etiqueta(p.W, p.H)
        if t != comun:
            out[p.n] = [d('TAMANO_MEZCLADO', AVISO,
                          'pagina %s en un PDF de %d paginas que es %s (%d de ellas)'
                          % (t, len(paginas), comun, cuenta[comun]))]
    return out


# ---- 11 REPETIDA -------------------------------------------------------------------

DHASH_MAX = 10          # bits de 64 que pueden diferir para dar dos fotos por la misma (recompresion)
REPETIDA_TEXTO_MIN = 80  # una hoja casi sin texto no se compara por texto
FOTO_LADO_MIN = 70      # pt: una foto del cuerpo; los iconos de EPP (24 a 55 pt) quedan afuera


def y_cuerpo(p):
    """Donde termina el cajetin: arriba de las bandas IMAGENES / DESCRIPCION DE LA OPERACION."""
    tops = [l.y0 for l in p.lineas if l.n.startswith(('IMAGENES', 'DESCRIPCION DE LA OPERACION'))]
    if tops:
        return min(tops) - 1
    rev = [l.y1 for l in p.lineas if l.n.startswith('REV.')]
    return max(rev) if rev else 0.2 * p.H


def firma_cuerpo(p):
    """Los renglones de todo lo que esta debajo del cajetin, sin orden y solo con letras y numeros."""
    y = y_cuerpo(p)
    return tuple(sorted(k for k in (clave(l.texto) for l in p.lineas if l.y0 >= y) if k))


def dhash(doc, xref):
    """Huella de 64 bits de una imagen: aguanta que Excel la recomprima en cada exportacion."""
    try:
        im = Image.open(io.BytesIO(doc.extract_image(xref)['image'])).convert('L').resize((9, 8))
    except Exception:
        return None
    a = np.asarray(im).astype(int)
    bits = (a[:, 1:] > a[:, :-1]).ravel()
    return int(''.join('1' if b else '0' for b in bits), 2)


def fotos_del_cuerpo(p):
    y = y_cuerpo(p)
    out = []
    for i in sorted(p.page.get_image_info(xrefs=True), key=lambda i: (round(i['bbox'][1]), i['bbox'][0])):
        x0, y0, x1, y1 = i['bbox']
        if y0 >= y - 5 and (x1 - x0) >= FOTO_LADO_MIN and (y1 - y0) >= FOTO_LADO_MIN and i.get('xref'):
            h = dhash(p.doc, i['xref'])
            if h is not None:
                out.append(h)
    return out


def mismas_fotos(a, b):
    if len(a) != len(b):
        return False
    libres = list(b)
    for h in a:
        for j, g in enumerate(libres):
            if bin(h ^ g).count('1') <= DHASH_MAX:
                libres.pop(j)
                break
        else:
            return False
    return True


def chequear_repetidas(paginas):
    """{n: [defectos]}: paginas con el mismo cuerpo (descripcion, fotos, ciclo y plan) y distinto cajetin."""
    out = {}
    grupos = collections.defaultdict(list)
    for p in paginas:
        if p.tipo != 'HO':
            continue
        f = firma_cuerpo(p)
        if sum(len(k) for k in f) >= REPETIDA_TEXTO_MIN:
            grupos[f].append(p)
    for g in grupos.values():
        if len(g) < 2:
            continue
        fotos = {p.n: fotos_del_cuerpo(p) for p in g}
        resto = list(g)
        while resto:
            base = resto.pop(0)
            iguales = [base] + [q for q in resto if mismas_fotos(fotos[base.n], fotos[q.n])]
            resto = [q for q in resto if q not in iguales]
            if len(iguales) < 2:
                continue
            if not fotos[base.n] and sum(len(k) for k in firma_cuerpo(base)) < 200:
                continue            # sin fotos y con poco texto: no alcanza para decir que es la misma hoja
            hos = []
            for q in iguales:
                t = texto_casillero_ho(q)[0] or 'HO sin numero'
                if t not in hos:
                    hos.append(t)
            donde = ('en %d productos (%s)' % (len(hos), ', '.join(hos)) if len(hos) > 1
                     else 'en %d codigos de pieza dentro de %s' % (len(iguales), hos[0]))
            for q in iguales:
                otras = [str(x.n) for x in iguales if x is not q]
                out.setdefault(q.n, []).append(d(
                    'REPETIDA', AVISO,
                    'mismo cuerpo que las paginas %s (descripcion y fotos iguales; cambia solo el cajetin): esta hoja '
                    'generica se repite %s; imprimir una sola' % (', '.join(otras), donde)))
    return out


# ---- driver ------------------------------------------------------------------------

def revisar_pagina(p):
    defectos = []
    defectos += chequear_portada(p)
    defectos += chequear_sin_ho(p)
    defectos += chequear_sin_op(p)
    defectos += chequear_palabras(p)
    defectos += chequear_logo(p)
    caja = caja_tinta(p.gris)
    defectos += chequear_hoja_chica(p, caja)
    defectos += chequear_cortada(p, caja)
    defectos += chequear_plan(p)
    defectos += chequear_captura(p)
    defectos += chequear_epp(p)
    return defectos


def parse_paginas(txt, total):
    if not txt:
        return list(range(1, total + 1))
    out = []
    for parte in txt.split(','):
        a, _, b = parte.partition('-')
        a = int(a)
        b = int(b) if b else a
        out += [n for n in range(a, b + 1) if 1 <= n <= total]
    return sorted(set(out))


def identidad(p):
    """(HO, operacion) de la pagina tal como se leen impresas, para ubicar el hallazgo."""
    if p.tipo == 'PORTADA':
        return 'portada', '-'
    if p.tipo == 'CAMINO':
        return 'camino de inspeccion', '-'
    ho = texto_casillero_ho(p)[0] or '(sin HO)'
    hay, op = valor_operacion(p)
    return ho, ('(sin casillero)' if not hay else (op if op else '(vacio)'))


def revisar_pdf(ruta, paginas_txt=None):
    """(doc, paginas, {n: [defectos]}, {n: (ho, operacion)})."""
    doc = fitz.open(ruta)
    nums = parse_paginas(paginas_txt, len(doc))
    paginas = [Pagina(doc, n - 1) for n in nums]
    res = {p.n: revisar_pagina(p) for p in paginas}
    for chequeo in (chequear_tamanos, chequear_repetidas):
        for n, ds in chequeo(paginas).items():
            res[n] += ds
    ident = {p.n: identidad(p) for p in paginas if res[p.n]}
    return doc, paginas, res, ident


def rangos(nums):
    nums = sorted(set(nums))
    out = []
    i = 0
    while i < len(nums):
        j = i
        while j + 1 < len(nums) and nums[j + 1] == nums[j] + 1:
            j += 1
        out.append(str(nums[i]) if i == j else '%d-%d' % (nums[i], nums[j]))
        i = j + 1
    return ', '.join(out)


def main(argv=None):
    ap = argparse.ArgumentParser(description='Revisa un paquete de hojas de proceso (PDF).')
    ap.add_argument('pdf', nargs='+')
    ap.add_argument('--paginas', help='solo estas paginas, ej. 1-5,47')
    ap.add_argument('--json', action='store_true', help='salida JSON')
    ap.add_argument('--solo-rojo', action='store_true', help='no listar los avisos')
    args = ap.parse_args(argv)
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')

    todos = []
    hay_error = False
    por_pdf = []
    for ruta in args.pdf:
        try:
            doc, paginas, res, ident = revisar_pdf(ruta, args.paginas)
        except Exception as e:                      # archivo que no abre
            print('NO SE PUDO ABRIR %s: %s' % (ruta, e), file=sys.stderr)
            hay_error = True
            continue
        nombre = os.path.basename(ruta)
        for n in sorted(res):
            for x in res[n]:
                if args.solo_rojo and x['nivel'] != ROJO:
                    continue
                todos.append(dict(x, pdf=nombre, pagina=n, ho=ident[n][0], operacion=ident[n][1]))
        por_pdf.append((nombre, len(doc), len(paginas)))
    rojos = [x for x in todos if x['nivel'] == ROJO]
    if args.json:
        print(json.dumps({'defectos': todos, 'rojos': len(rojos), 'avisos': len(todos) - len(rojos)},
                         ensure_ascii=False, indent=1))
    else:
        for nombre, total, vistas in por_pdf:
            print('== %s  (%d paginas%s)' % (nombre, total, '' if vistas == total else ', reviso %d' % vistas))
            mios = [x for x in todos if x['pdf'] == nombre]
            for x in mios:
                print('  p.%-4d [%s | op %s] %-5s %-18s %s'
                      % (x['pagina'], x['ho'], x['operacion'], x['nivel'], x['codigo'], x['evidencia']))
            if not mios:
                print('  sin defectos')
        print()
        print('RESUMEN: %d ROJO, %d AVISO' % (len(rojos), len(todos) - len(rojos)))
        for pdf in sorted({x['pdf'] for x in todos}):
            print('  %s' % pdf)
            grupos = collections.OrderedDict()
            for x in todos:
                if x['pdf'] == pdf:
                    grupos.setdefault((x['codigo'], x['nivel']), []).append(x['pagina'])
            for (c, nv), pgs in sorted(grupos.items(), key=lambda kv: (kv[0][1] != ROJO, kv[0][0])):
                print('    %-18s %-5s %3d pag.: %s' % (c, nv, len(set(pgs)), rangos(pgs)))
    return 2 if hay_error and not rojos else (1 if rojos else 0)


if __name__ == '__main__':
    sys.exit(main())
