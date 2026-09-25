# -*- coding: utf-8 -*-
"""
Frenos antes de escribir en el arb: cada numero con su papel, los pedidos anteriores a la
vista y el ancho del rollo contra la orden de compra.

Lo usan `scripts/_arbCargar.py --tabla` (consumos) y `scripts/_arbUnidad.py --tabla`
(unidad del maestro). Con un rojo, `--apply` NO escribe.

    python scripts/_lib/respaldoCarga.py --revisar carga.csv [--unidad]   # el informe solo
    python scripts/_lib/respaldoCarga.py --selftest

POR QUE EXISTE (TPO del Top Roll de Patagonia, 20/08 -> 25/09/2026)
  El 20/08 pase el TPO (427VIN005COR01) de 0,2526 m2 a 0,1804 ml dividiendo por 1,40 y en el
  mail escribi que 1,40 era "el ancho con el que se calculo ese consumo". Ningun papel lo
  decia: el rollo de Haartz es de 835 mm (todas las OC) y el TPO ni se tiza, lo corta la IMG
  en placas. Carlos habia mandado el dato real el 17/07 (0,270 / 0,2525 ml) y ese mismo dia
  escribio "creo que te habia pedido en su momento modificarlo". El arb quedo 31 % abajo por
  vehiculo durante un mes. Los tres frenos cortan ese caso cada uno por su lado:

  1. FUENTE. Cada fila trae `fuente` (mail:<id> del cache de mails, o la ruta de un archivo)
     y `cita` (la frase textual). Se abre la fuente y la cita tiene que estar adentro. Varias
     fuentes van separadas por `||`, en el mismo orden en `fuente` y en `cita`.
     - Sin `cuenta`: valor_nuevo tiene que aparecer en alguna cita.
     - Con `cuenta` (ej. `1100/1000/4`): la cuenta tiene que dar valor_nuevo y CADA numero de
       la cuenta tiene que aparecer en alguna cita (salvo 100 y 1000, que son cambio de
       unidad). Asi un "0,2526/1,4" no pasa si ningun papel dice 1,4.
     - `fak:` como fuente es una decision de Fak en el chat: pasa, pero queda en AMARILLO en
       el informe y en el journal (no se puede verificar contra nada).
     - Una foto (jpg/png) se lee con OCR y se exige que esten los NUMEROS de la cita.
  2. ANTECEDENTES. Se buscan en el cache de mails (12 meses) los que nombran el insumo — su
     codigo, o su palabra clave junto a la de la pieza — y hablan de consumo con numeros.
     Cada uno tiene que estar citado como fuente o anotado en `vistos`
     (`<id o sus ultimos 16+ caracteres>: motivo`, o `hilo:<parte del asunto>: motivo`,
     separados por `|`). Es el caso "te lo habia pedido en su momento".
  3. ANCHO CONTRA LA OC. Si la cuenta divide por algo que parece un ancho de rollo
     (0,5 a 2,5 m, o 500 a 2500 mm salvo el 1000), ese ancho tiene que coincidir (+-2 %) con
     alguno de los que imprimen las OC de ESE codigo en Z:\\arb\\oc\\ocauto\\BA.

LIMITE CONOCIDO: solo ve el buzon de Fak y los archivos. Lo que se hablo en planta o por
WhatsApp sin mail no lo encuentra: si existe, se cita como `fak:` o como archivo.
"""
import ast
import csv
import datetime
import glob
import io
import json
import os
import re
import sys
import unicodedata

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MAIL_CACHE = os.environ.get('BARACK_MAIL_CACHE') or os.path.join(RAIZ, '.mail-cache')
OC_CARPETA = os.path.join('Z:', os.sep, 'arb', 'oc', 'ocauto', 'BA')
OC_INDICE = os.path.join(RAIZ, '.arb-cache', 'oc_items.jsonl')
ARTICULO = r'C:\tmp\ARTICULO.TXT'
RELACIONES = r'C:\tmp\RELACIONES.TXT'

VENTANA_DIAS = 365
TOL_VALOR = 0.001        # 0,1 %: regla consumos-entregables
TOL_ANCHO = 0.02         # la OC de Haartz dice 835 +- 13 mm
UNIDAD_CONVERSION = {100.0, 1000.0}
PALABRAS_VACIAS = {'tipo', 'de', 'del', 'con', 'sin', 'rollo', 'para', 'por', 'material',
                   'pta', 'la', 'el', 'los', 'las', 'y'}


# ------------------------------------------------------------------------- texto

def normalizar(s):
    """minusculas, sin tildes, coma decimal -> punto, espacios colapsados."""
    t = unicodedata.normalize('NFD', str(s or ''))
    t = ''.join(ch for ch in t if not unicodedata.combining(ch)).lower()
    t = t.replace('\u00b2', '2').replace('\u00a0', ' ')
    t = re.sub(r'(?<=\d),(?=\d)', '.', t)
    return re.sub(r'\s+', ' ', t).strip()


NUM = re.compile(r'(?<![\d.])\d+(?:\.\d+)?')


def numeros(s):
    """Numeros de un texto. "1.080 mm" es mil ochenta en castellano y 1,08 si fuera decimal:
    se agregan las dos lecturas (una de mas no molesta; una de menos da un rojo falso)."""
    out = []
    for m in NUM.finditer(normalizar(s)):
        tok = m.group(0)
        try:
            out.append(float(tok))
            if re.fullmatch(r'\d{1,3}(?:\.\d{3})+', tok):
                out.append(float(tok.replace('.', '')))
        except ValueError:
            pass
    return out


def mismo(a, b, tol=TOL_VALOR):
    if a is None or b is None:
        return False
    if b == 0:
        return a == 0
    return abs(a - b) / abs(b) <= tol


def a_float(s):
    try:
        return float(str(s).strip().replace(',', '.'))
    except (ValueError, TypeError):
        return None


# ------------------------------------------------------------------------- fuentes

def _cache_mails(path=None):
    p = path or os.path.join(MAIL_CACHE, 'mails.jsonl')
    out = []
    if not os.path.exists(p):
        return out
    with io.open(p, encoding='utf-8') as f:
        for ln in f:
            ln = ln.strip()
            if ln:
                try:
                    out.append(json.loads(ln))
                except ValueError:
                    pass
    return out


def _texto_mail(m):
    return ' '.join(str(m.get(k) or '') for k in ('asunto', 'adjuntos', 'cuerpo'))


def buscar_mail(ref, mails):
    """ref = id completo o sus ultimos 16+ caracteres."""
    ref = ref.strip()
    if len(ref) < 16:
        return None
    for m in mails:
        if m.get('id') == ref or str(m.get('id', '')).endswith(ref):
            return m
    return None


def _ocr(path):
    """Texto de una foto. rapidocr si esta, si no tesseract."""
    try:
        from rapidocr_onnxruntime import RapidOCR
        r, _ = RapidOCR()(path)
        return ' '.join(x[1] for x in (r or []))
    except ImportError:
        pass
    import pytesseract
    from PIL import Image
    if os.path.exists(r'C:\Program Files\Tesseract-OCR\tesseract.exe'):
        pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
    return pytesseract.image_to_string(Image.open(path).convert('L'), config='--psm 11')


def texto_de_archivo(path, ocr=None):
    """(texto, es_imagen). Lanza OSError si no existe."""
    ext = os.path.splitext(path)[1].lower()
    if not os.path.exists(path):
        raise OSError('no existe: %s' % path)
    if ext in ('.jpg', '.jpeg', '.png'):
        return (ocr or _ocr)(path), True
    if ext == '.pdf':
        import fitz
        d = fitz.open(path)
        t = ''.join(p.get_text() for p in d)
        d.close()
        return t, False
    if ext in ('.xlsx', '.xlsm'):
        import openpyxl
        partes = []
        for data_only in (True, False):
            wb = openpyxl.load_workbook(path, data_only=data_only, read_only=True)
            for ws in wb.worksheets:
                for fila in ws.iter_rows(values_only=True):
                    partes.extend(str(c) for c in fila if c is not None)
            wb.close()
        return ' '.join(partes), False
    return io.open(path, encoding='utf-8', errors='replace').read(), False


def _partir(s):
    return [x.strip() for x in str(s or '').split('||')]


# ------------------------------------------------------------------------- cuentas

def evaluar(expr):
    """Cuenta segura: numeros, + - * / y parentesis. Devuelve (valor, divisores)."""
    e = re.sub(r'(?<=\d),(?=\d)', '.', expr.strip())
    arbol = ast.parse(e, mode='eval')
    divisores = []

    def ev(n):
        if isinstance(n, ast.Expression):
            return ev(n.body)
        if isinstance(n, ast.Constant) and isinstance(n.value, (int, float)):
            return float(n.value)
        if isinstance(n, ast.UnaryOp) and isinstance(n.op, ast.USub):
            return -ev(n.operand)
        if isinstance(n, ast.BinOp):
            a, b = ev(n.left), ev(n.right)
            if isinstance(n.op, ast.Add):
                return a + b
            if isinstance(n.op, ast.Sub):
                return a - b
            if isinstance(n.op, ast.Mult):
                return a * b
            if isinstance(n.op, ast.Div):
                divisores.append(b)
                return a / b
        raise ValueError('la cuenta solo admite numeros y + - * /: %r' % expr)
    return ev(arbol), divisores


def ancho_en_metros(x):
    if 0.5 <= x <= 2.5:
        return x
    if 500 <= x <= 2500 and x != 1000:
        return x / 1000.0
    return None


# ------------------------------------------------------------------------- OC

ITEM = re.compile(r'^\s*\d+-(\S+)\s{2,}')
FIN_ITEM = re.compile(r'hurlingham|subtotal|observ|atenci', re.I)
ANCHOS = [
    re.compile(r'(\d{3,4})\s*mm\s*(?:de\s*)?ancho', re.I),
    re.compile(r'x\s*(\d{3,4})\s*mm', re.I),
    re.compile(r'\dx(\d{3,4})\b', re.I),
    re.compile(r'width\s*(?:is\s*)?(\d{3,4})\s*mm', re.I),
    re.compile(r'(\d{3,4})\s*mm\s*wide', re.I),
    re.compile(r'(\d[.,]\d{1,2})\s*m\s*de\s*ancho', re.I),
]


def items_de_oc(texto):
    """[(codigo, bloque de texto del item)] de una OC."""
    out, cod, bloque = [], None, []
    for ln in texto.splitlines():
        m = ITEM.match(ln)
        if m:
            if cod:
                out.append((cod, '\n'.join(bloque)))
            cod, bloque = m.group(1), [ln]
        elif cod and FIN_ITEM.search(ln):
            out.append((cod, '\n'.join(bloque)))
            cod, bloque = None, []
        elif cod:
            bloque.append(ln)
    if cod:
        out.append((cod, '\n'.join(bloque)))
    return out


def anchos_del_bloque(bloque):
    """Anchos de rollo (m) que imprime un item de OC."""
    out = []
    for rx in ANCHOS:
        for m in rx.finditer(bloque):
            v = float(m.group(1).replace(',', '.'))
            v = v / 1000.0 if v > 10 else v
            if 0.3 <= v <= 3.0:
                out.append(round(v, 4))
    return sorted(set(out))


def _indice_oc(carpeta=OC_CARPETA, indice=OC_INDICE):
    """{archivo: {'mtime', 'items': [[cod, bloque]]}} incremental: la primera vez lee las ~10.600
    OC (minutos); despues solo las nuevas."""
    idx = {}
    if os.path.exists(indice):
        with io.open(indice, encoding='utf-8') as f:
            for ln in f:
                try:
                    r = json.loads(ln)
                    idx[r['archivo']] = r
                except ValueError:
                    pass
    if not os.path.isdir(carpeta):
        return idx, False
    pendientes = []
    for p in glob.glob(os.path.join(carpeta, '*.[pP][dD][fF]')):
        a = os.path.basename(p)
        mt = int(os.path.getmtime(p))
        if not (a in idx and idx[a].get('mtime') == mt):
            pendientes.append((p, a, mt))
    if not pendientes:
        return idx, True
    import fitz
    if len(pendientes) > 200:
        print('   (indexando %d OC de Z: por unica vez; queda en %s)' % (len(pendientes), indice))
    os.makedirs(os.path.dirname(indice), exist_ok=True)
    # se escribe de a una: si la corrida se corta, lo leido no se pierde
    with io.open(indice, 'a', encoding='utf-8') as f:
        for p, a, mt in pendientes:
            try:
                d = fitz.open(p)
                t = ''.join(pg.get_text() for pg in d)
                d.close()
            except Exception:
                t = ''
            r = {'archivo': a, 'mtime': mt, 'items': [[c, b] for c, b in items_de_oc(t)]}
            idx[a] = r
            f.write(json.dumps(r, ensure_ascii=False) + '\n')
            f.flush()
    return idx, True


def anchos_oc(codigo, textos_oc=None):
    """[(archivo, ancho_m)] de las OC de ese codigo. textos_oc = {archivo: texto} (tests)."""
    if textos_oc is not None:
        items = [(a, c, b) for a, t in textos_oc.items() for c, b in items_de_oc(t)]
    else:
        idx, _ = _indice_oc()
        items = [(a, c, b) for a, r in idx.items() for c, b in r.get('items', [])]
    clave = re.sub(r'[^0-9a-z]', '', codigo.lower())
    out = []
    for a, c, b in items:
        if re.sub(r'[^0-9a-z]', '', c.lower()) == clave:
            for w in anchos_del_bloque(b):
                out.append((a, w))
    return out


# ------------------------------------------------------------------------- export del arb

def descripciones(articulo=ARTICULO, relaciones=RELACIONES):
    """({producto: descripcion}, {insumo: descripcion}) del export del arb."""
    prod, ins = {}, {}
    if os.path.exists(articulo):
        for ln in io.open(articulo, encoding='latin-1'):
            c = ln.split('\t')
            if len(c) >= 2 and c[0].strip():
                prod.setdefault(c[0].strip(), c[1].strip())
    if os.path.exists(relaciones):
        for ln in io.open(relaciones, encoding='latin-1'):
            c = ln.split('\t')
            if len(c) >= 4 and c[2].strip():
                ins.setdefault(c[2].strip(), c[3].strip())
    return prod, ins


def palabra_clave(desc, largo_min=5):
    """Palabra que nombra la cosa: 'TOP ROLL PTA. DEL.' -> 'top roll'; 'TPO 0,5MM' -> 'tpo'."""
    toks = [t for t in re.findall(r'[a-z]+', normalizar(desc))
            if t not in PALABRAS_VACIAS and len(t) >= 3]
    if not toks:
        return None
    if len(toks[0]) >= largo_min or len(toks) == 1:
        return toks[0] if len(toks[0]) >= 3 else None
    return ' '.join(toks[:2])


# ------------------------------------------------------------------------- antecedentes

SENAL_CONSUMO = re.compile(r'consumo|\bml\b|\bm2\b|metro', re.I)
NUM_DECIMAL = re.compile(r'\d+[.,]\d{2,}')


def indexar(mails):
    """[(mail, texto normalizado)]: se normaliza UNA vez por corrida, no una por fila."""
    return [(m, normalizar(_texto_mail(m))) for m in mails]


def antecedentes(insumo, productos, indexados, desc_prod=None, desc_ins=None, hoy=None,
                 dias=VENTANA_DIAS):
    """Mails de los ultimos `dias` que nombran el insumo y hablan de consumo con numeros.
    `indexados` sale de indexar()."""
    hoy = hoy or datetime.date.today()
    desde = (hoy - datetime.timedelta(days=dias)).isoformat()
    cod = normalizar(insumo)
    cod_pelado = re.sub(r'[^0-9a-z]', '', cod)
    kw_ins = palabra_clave((desc_ins or {}).get(insumo, ''), largo_min=3)
    kw_prod = set()
    for p in productos:
        kw_prod.add(normalizar(p))
        k = palabra_clave((desc_prod or {}).get(p, ''))
        if k:
            kw_prod.add(k)
    out = []
    for m, t in indexados:
        if str(m.get('fecha', ''))[:10] < desde:
            continue
        por_codigo = cod in t or (len(cod_pelado) >= 8 and cod_pelado in re.sub(r'[^0-9a-z]', '', t))
        por_palabra = bool(kw_ins) and re.search(r'\b%s\b' % re.escape(kw_ins), t) and \
            any(re.search(r'\b%s\b' % re.escape(k), t) for k in kw_prod)
        # el codigo de la PIEZA tambien cuenta: el mail del 20/08 que cargo el 0,1804 decia
        # "el Haartz del Top Roll (N 216, N 256...)" — ni el codigo del insumo ni "TPO"
        por_pieza = any(re.search(r'(?<![0-9a-z])%s(?![0-9a-z])' % re.escape(normalizar(p)), t)
                        for p in productos if p)
        if not (por_codigo or por_palabra or por_pieza):
            continue
        if not (SENAL_CONSUMO.search(t) and NUM_DECIMAL.search(t)):
            continue
        out.append(m)
    return out


def _vistos(s):
    """'id: motivo | hilo:asunto: motivo' -> [(tipo, clave, motivo)]"""
    out = []
    for parte in str(s or '').split('|'):
        parte = parte.strip()
        if not parte:
            continue
        if parte.lower().startswith('hilo:'):
            resto = parte[5:]
            clave, _, motivo = resto.partition(':')
            out.append(('hilo', normalizar(clave), motivo.strip()))
        else:
            clave, _, motivo = parte.partition(':')
            out.append(('id', clave.strip(), motivo.strip()))
    return out


def _cubierto(m, citados, vistos):
    mid = str(m.get('id', ''))
    if mid in citados:
        return 'citado'
    for tipo, clave, motivo in vistos:
        if tipo == 'id' and len(clave) >= 16 and mid.endswith(clave):
            return 'visto' if motivo else None
        if tipo == 'hilo' and clave and clave in normalizar(m.get('asunto', '')):
            return 'visto' if motivo else None
    return None


# ------------------------------------------------------------------------- revisar

def leer_filas(path):
    with io.open(path, encoding='utf-8-sig', newline='') as f:
        filas = []
        for r in csv.DictReader(f):
            r = {(k or '').strip().lower(): (v or '').strip() for k, v in r.items()}
            if r.get('producto') or r.get('codigo'):
                filas.append(r)
        return filas


def revisar_fila(r, mails, unidad=False, ocr=None, textos_oc=None, desc_prod=None,
                 desc_ins=None, hoy=None, cache_texto=None, grupo=None, indexados=None,
                 memo=None):
    """Devuelve (rojos, amarillos, notas) de UNA fila."""
    rojos, amarillos, notas = [], [], []
    cache_texto = {} if cache_texto is None else cache_texto
    memo = {} if memo is None else memo
    indexados = indexar(mails) if indexados is None else indexados
    insumo = r.get('codigo') if unidad else r.get('insumo', '')
    valor = None if unidad else a_float(r.get('valor_nuevo'))
    fuentes, citas = _partir(r.get('fuente')), _partir(r.get('cita'))

    # 1. FUENTE ------------------------------------------------------------
    if not r.get('fuente') or not r.get('cita'):
        rojos.append('sin fuente/cita: ¿de que papel sale este numero?')
        fuentes, citas = [], []
    elif len(fuentes) != len(citas):
        rojos.append('fuente trae %d y cita trae %d (van en el mismo orden, separadas por ||)'
                     % (len(fuentes), len(citas)))
        fuentes, citas = [], []
    citados = set()
    textos_citas = []
    for fu, ci in zip(fuentes, citas):
        if fu.lower().startswith('fak:') or fu.lower() == 'fak':
            amarillos.append('respaldo verbal de Fak (no se puede verificar): "%s"' % ci)
            textos_citas.append(ci)
            continue
        if fu.lower().startswith('mail:'):
            m = buscar_mail(fu[5:], mails)
            if not m:
                rojos.append('no encuentro el mail %s en el cache (id o ultimos 16+ caracteres)'
                             % fu[5:][-20:])
                continue
            citados.add(m['id'])
            texto, es_img = _texto_mail(m), False
            donde = 'mail "%s" (%s)' % (m.get('asunto', '')[:50], m.get('fecha', ''))
        else:
            try:
                if fu not in cache_texto:
                    cache_texto[fu] = texto_de_archivo(fu, ocr)
                texto, es_img = cache_texto[fu]
            except Exception as e:
                rojos.append('no pude abrir %s: %s' % (fu, e))
                continue
            donde = os.path.basename(fu)
        tn = normalizar(texto)
        if es_img:
            faltan = [n for n in numeros(ci) if not any(mismo(n, x, 1e-9) for x in numeros(texto))]
            if faltan:
                rojos.append('la foto %s no muestra %s (OCR)' % (donde, ', '.join('%g' % x for x in faltan)))
                continue
        elif normalizar(ci) not in tn:
            rojos.append('la cita "%s" NO esta en %s' % (ci[:60], donde))
            continue
        textos_citas.append(ci)

    nums_citas = [n for c in textos_citas for n in numeros(c)]
    if not unidad and valor is not None and textos_citas:
        cuenta = r.get('cuenta', '')
        if cuenta:
            try:
                res, divisores = evaluar(cuenta)
            except (ValueError, SyntaxError, ZeroDivisionError) as e:
                rojos.append('cuenta ilegible: %s' % e)
                res, divisores = None, []
            if res is not None and not mismo(res, valor):
                rojos.append('la cuenta %s da %.8g y la tabla dice %s' % (cuenta, res, r.get('valor_nuevo')))
            for n in numeros(cuenta):
                if n in UNIDAD_CONVERSION:
                    continue
                if not any(mismo(n, x, 1e-9) for x in nums_citas):
                    rojos.append('el %g de la cuenta no aparece en ninguna cita: ¿de que papel sale?' % n)
            # 3. ANCHO CONTRA LA OC ---------------------------------------
            for d in divisores:
                w = ancho_en_metros(d)
                if w is None:
                    continue
                if ('oc', insumo) not in memo:
                    memo[('oc', insumo)] = anchos_oc(insumo, textos_oc)
                oc = memo[('oc', insumo)]
                if not oc:
                    notas.append('la cuenta divide por %g (ancho?) y ninguna OC de %s dice el ancho'
                                 % (d, insumo))
                elif not any(mismo(w, x, TOL_ANCHO) for _, x in oc):
                    rojos.append('la cuenta divide por %g m y las OC de %s dicen %s'
                                 % (w, insumo, ', '.join(sorted({'%g m (%s)' % (x, a) for a, x in oc}))))
        elif not any(mismo(valor, x) for x in nums_citas):
            rojos.append('el %s no aparece en ninguna cita (si sale de una cuenta, va en la columna cuenta)'
                         % r.get('valor_nuevo'))

    # 2. ANTECEDENTES ---------------------------------------------------------
    productos = grupo if grupo is not None else ([r.get('producto')] if r.get('producto') else [])
    vistos = _vistos(r.get('vistos'))
    clave = ('ant', insumo, tuple(productos))
    if clave not in memo:
        memo[clave] = antecedentes(insumo, productos, indexados, desc_prod, desc_ins, hoy)
    for m in memo[clave]:
        estado = _cubierto(m, citados, vistos)
        if not estado:
            rojos.append('mail sin mirar: %s  %s  "%s"  (...%s) — citalo o anotalo en `vistos` con motivo'
                         % (m.get('fecha', ''), m.get('de', ''), m.get('asunto', '')[:60],
                            str(m.get('id', ''))[-20:]))
    return rojos, amarillos, notas


def piezas_que_usan(relaciones=RELACIONES):
    """{insumo: [productos]} del export RELACIONES."""
    out = {}
    if os.path.exists(relaciones):
        for ln in io.open(relaciones, encoding='latin-1'):
            c = ln.split('\t')
            if len(c) >= 4 and c[0].strip() and c[2].strip():
                out.setdefault(c[2].strip(), set()).add(c[0].strip())
    return {k: sorted(v) for k, v in out.items()}


def revisar(path, unidad=False, mails=None, ocr=None, textos_oc=None, desc=None, hoy=None,
            imprimir=True, usos=None):
    """Informe de toda la tabla. Devuelve (hay_rojo, resumen)."""
    filas = leer_filas(path)
    mails = _cache_mails() if mails is None else mails
    indexados = indexar(mails)
    desc_prod, desc_ins = desc if desc is not None else descripciones()
    # los antecedentes se buscan por insumo contra TODAS las piezas que lo usan: las de la
    # tabla, y en una tabla de unidad (que no nombra piezas) las del export
    piezas = {}
    if unidad:
        usos = piezas_que_usan() if usos is None else usos
        for r in filas:
            piezas[r.get('codigo')] = set(usos.get(r.get('codigo'), []))
    for r in filas:
        k = r.get('codigo') if unidad else r.get('insumo')
        if r.get('producto'):
            piezas.setdefault(k, set()).add(r['producto'])
    cache_texto, memo, rojos_tot, amar_tot = {}, {}, 0, 0
    resumen = []
    for r in filas:
        k = r.get('codigo') if unidad else r.get('insumo')
        ro, am, no = revisar_fila(r, mails, unidad, ocr, textos_oc, desc_prod, desc_ins, hoy,
                                  cache_texto, sorted(piezas.get(k, [])), indexados, memo)
        rojos_tot += len(ro)
        amar_tot += len(am)
        etiqueta = '%s %s' % (r.get('producto', ''), k) if not unidad else k
        resumen.append((etiqueta, ro, am, no))
        if imprimir:
            print('%s  %s' % ('ROJO    ' if ro else ('AMARILLO' if am else 'ok      '), etiqueta))
            for x in ro:
                print('           x %s' % x)
            for x in am:
                print('           ! %s' % x)
            for x in no:
                print('           - %s' % x)
    if imprimir:
        print('-' * 74)
        print('RESPALDO: %d fila(s), %d rojo(s), %d amarillo(s)%s'
              % (len(filas), rojos_tot, amar_tot,
                 '  ->  NO SE ESCRIBE' if rojos_tot else ''))
    return rojos_tot > 0, resumen


# ------------------------------------------------------------------------- selftest

def selftest():
    import tempfile
    ok = mal = 0

    def caso(nombre, cond):
        nonlocal ok, mal
        if cond:
            ok += 1
            print('  ok    %s' % nombre)
        else:
            mal += 1
            print('  MAL   %s' % nombre)

    hoy = datetime.date(2026, 9, 25)
    ID_CARLOS = 'A' * 40 + 'CARLOS1707TPO0001'
    ID_OTRO = 'B' * 40 + 'OTROMAILSINCONSUMO'
    ID_P703 = 'C' * 40 + 'P703TOPROLL000001'
    ID_2008 = 'D' * 40 + 'DIFUSION2008HAARTZ'
    mails = [
        {'id': ID_CARLOS, 'fecha': '2026-07-17 10:24', 'de': 'Carlos Baptista',
         'asunto': 'Modificación del consumo de TPO Top Roll de m² a metro lineal', 'adjuntos': '',
         'cuerpo': 'El rollo de TPO tiene un ancho fijo de 835 mm. Medida de la placa: 835 × 1.080 mm. '
                   'Total: 4 piezas por placa. Consumo por unidad: 1,080 ml ÷ 4 = 0,270 ml por pieza.'},
        {'id': ID_OTRO, 'fecha': '2026-07-20 09:00', 'de': 'Alguien', 'asunto': 'Top Roll carro',
         'adjuntos': '', 'cuerpo': 'planos del carro de transporte del top roll'},
        {'id': ID_P703, 'fecha': '2025-01-10 09:00', 'de': 'Viejo', 'asunto': 'consumo TPO top roll',
         'adjuntos': '', 'cuerpo': 'consumo 0,1300 ml del TPO del top roll'},
        {'id': ID_2008, 'fecha': '2026-08-20 14:34', 'de': 'Facundo Santoro',
         'asunto': 'RE: Consumo actualizado aplix', 'adjuntos': '',
         'cuerpo': 'El Haartz del Top Roll ya esta en metros lineales. El consumo paso de 0,2526 '
                   'a 0,1804286 en las 4 piezas del Top Roll (N 216, N 256, N 285, N 315).'},
    ]
    desc = ({'N 216': 'TOP ROLL PTA. DEL. IZQ.'},
            {'427VIN005COR01': 'TPO 0,5MM + FOAM 2MM DENSITY 66KH/M3 (TP'})
    oc_haartz = {'OC15873-HAARTZ.PDF': '   1-427VIN005COR01    TPO 0,5MM + FOAM 2MM    MTL   6584.0   11.96   78744,64\n'
                                       '   ROLL WIDTH IS 835 MM +/- 13 MM\n   Hurlingham  (B1686)'}
    oc_sansuy = {'OC16197-SANSUY.PDF': '   1-1246030223        SANLEATHER IV CL74 S782 1,1X1400 ESP3,00 S/FORRO H   MT2   976.00   11.9400   11653,44\n'}

    tmp = tempfile.mkdtemp()
    bom = os.path.join(tmp, 'BOM 001 - TOP ROLL.txt')
    io.open(bom, 'w', encoding='utf-8').write('TPO Haartz consumo 0.2526 m2 por pieza')
    planilla = os.path.join(tmp, 'usos.txt')
    io.open(planilla, 'w', encoding='utf-8').write('INT DEL PAT RH.NC  ancho 1.4  consumo ML 0.128  M2 0.1792')
    foto = os.path.join(tmp, 'pantalla.jpg')
    io.open(foto, 'wb').write(b'no es una foto de verdad')

    def ocr_falso(path):
        return 'Mordaza Extractor Largo Lamina: +1100,0 mm Corte Carga Inicial +2800,0'

    def tabla(filas, cols):
        p = os.path.join(tmp, 't%d.csv' % len(os.listdir(tmp)))
        with io.open(p, 'w', encoding='utf-8', newline='') as f:
            w = csv.writer(f)
            w.writerow(cols)
            for x in filas:
                w.writerow(x)
        return p

    C = ['producto', 'insumo', 'valor_nuevo', 'valor_esperado', 'fuente', 'cita', 'cuenta', 'vistos']
    kw = dict(mails=mails, textos_oc=oc_haartz, desc=desc, hoy=hoy, ocr=ocr_falso, imprimir=False)

    print('frenos del arb — el caso real del 20/08 tiene que dar ROJO por los tres lados')
    # el 20/08 tal como se cargo: sin papel para el 1,4
    p = tabla([['N 216', '427VIN005COR01', '0.1804286', '0.2526', bom, '0.2526', '0.2526/1.4', '']], C)
    rojo, res = revisar(p, **kw)
    txt = ' '.join(res[0][1])
    caso('20/08: el 1,4 sin papel da rojo', rojo and 'el 1.4 de la cuenta no aparece' in txt)
    caso('20/08: 1,4 contra la OC de 835 mm da rojo', 'las OC de 427VIN005COR01 dicen 0.835' in txt)
    caso('20/08: el mail de Carlos sin mirar da rojo', 'CARLOS1707TPO0001' in txt)
    caso('20/08: un mail viejo (>12 meses) no cuenta', 'P703TOPROLL000001' not in txt)
    caso('20/08: un mail sin numeros de consumo no cuenta', 'OTROMAILSINCONSUMO' not in txt)
    caso('el mail que nombra la PIEZA (N 216) sin decir TPO ni el codigo: cuenta',
         'DIFUSION2008HAARTZ' in txt)

    # aun si alguien le pone un papel al 1,4, la OC lo frena
    p = tabla([['N 216', '427VIN005COR01', '0.1804286', '0.2526', bom + '||' + planilla,
                '0.2526||ancho 1.4', '0.2526/1.4', ID_CARLOS[-16:] + ': lo descarto']], C)
    rojo, res = revisar(p, **kw)
    txt = ' '.join(res[0][1])
    caso('1,4 con papel prestado de otro material: la OC igual da rojo',
         rojo and 'dicen 0.835' in txt and 'no aparece en ninguna cita' not in txt)
    caso('`vistos` con motivo cubre el antecedente', 'CARLOS1707TPO0001' not in txt)

    print('lo bien respaldado tiene que dar VERDE')
    V2008 = 'hilo:consumo actualizado aplix: es la carga del 0,1804 que esta tabla corrige'
    p = tabla([['N 216', '427VIN005COR01', '0.275', '0.1804286', 'mail:' + ID_CARLOS + '||' + foto,
                '4 piezas por placa||Largo Lamina: +1100,0 mm', '1100/1000/4', V2008]], C)
    rojo, res = revisar(p, **kw)
    caso('cuenta 1100/1000/4 con la foto y el mail de Carlos: verde', not rojo)
    p = tabla([['N 216', '427VIN005COR01', '0.270', '0.1804286', 'mail:' + ID_CARLOS[-20:],
                '1,080 ml ÷ 4 = 0,270 ml por pieza', '', V2008]], C)
    rojo, res = revisar(p, **kw)
    caso('valor que esta en la cita, sin cuenta: verde (id por sufijo)', not rojo)
    p = tabla([['N 390', '1246030223', '0.128', '0.179', planilla, 'consumo ML 0.128', '', '']], C)
    rojo, res = revisar(p, mails=[], textos_oc=oc_sansuy, desc=({}, {}), hoy=hoy, imprimir=False)
    caso('Sansuy 22/09 con la planilla de Gamboa: verde', not rojo)
    p = tabla([['N 390', '1246030223', '0.128', '0.179', planilla + '||' + planilla,
                'M2 0.1792||ancho 1.4', '0.1792/1.4', '']], C)
    rojo, res = revisar(p, mails=[], textos_oc=oc_sansuy, desc=({}, {}), hoy=hoy, imprimir=False)
    caso('Sansuy 0,1792/1,4 con OC de 1400 mm: verde', not rojo)

    print('lo mal armado tiene que dar ROJO')
    p = tabla([['N 216', '427VIN005COR01', '0.275', '0.1804286', '', '', '', '']], C)
    caso('fila sin fuente: rojo', revisar(p, **kw)[0])
    p = tabla([['N 216', '427VIN005COR01', '0.270', '0.1804286', 'mail:' + ID_CARLOS,
                'el ancho con el que se calculo ese consumo', '', '']], C)
    rojo, res = revisar(p, **kw)
    caso('cita inventada (no esta en el mail): rojo', rojo and 'NO esta en' in ' '.join(res[0][1]))
    p = tabla([['N 216', '427VIN005COR01', '0.30', '0.1804286', 'mail:' + ID_CARLOS,
                '1,080 ml ÷ 4 = 0,270 ml por pieza', '', '']], C)
    caso('valor que no esta en la cita: rojo', revisar(p, **kw)[0])
    p = tabla([['N 216', '427VIN005COR01', '0.30', '0.1804286', 'mail:' + ID_CARLOS,
                '4 piezas por placa||x', '1080/1000/4', '']], C)
    caso('fuente y cita con distinta cantidad: rojo', revisar(p, **kw)[0])
    p = tabla([['N 216', '427VIN005COR01', '0.30', '0.1804286', 'mail:' + ID_CARLOS,
                'Medida de la placa: 835 × 1.080 mm. Total: 4 piezas por placa', '1080/1000/4', '']], C)
    rojo, res = revisar(p, **kw)
    caso('cuenta que no da el valor: rojo', rojo and 'da 0.27' in ' '.join(res[0][1]))
    p = tabla([['N 216', '427VIN005COR01', '0.30', '0.1804286', foto, 'Largo Lamina 1200', '', '']], C)
    rojo, res = revisar(p, **kw)
    caso('foto que no muestra el numero citado: rojo', rojo and 'no muestra 1200' in ' '.join(res[0][1]))
    p = tabla([['N 216', '427VIN005COR01', '0.275', '0.1804286', 'mail:' + 'Z' * 20, 'x', '', '']], C)
    caso('mail que no existe: rojo', revisar(p, **kw)[0])
    p = tabla([['N 216', '427VIN005COR01', '0.275', '0.1804286', 'fak:', 'usa 0,275', '',
                'hilo:consumo de TPO Top Roll: el pedido de Carlos, reemplazado por la maquina | ' + V2008]], C)
    rojo, res = revisar(p, **kw)
    caso('fak: pasa en amarillo y hilo: cubre el antecedente', not rojo and res[0][2])
    p = tabla([['N 216', '427VIN005COR01', '0.275', '0.1804286', 'fak:', 'usa 0,275', '',
                'hilo:consumo de TPO Top Roll']], C)
    caso('`vistos` sin motivo no cubre: rojo', revisar(p, **kw)[0])

    print('tabla de unidad (_arbUnidad.py)')
    CU = ['codigo', 'unidad_vieja', 'unidad_nueva', 'fuente', 'cita', 'vistos']
    p = tabla([['427VIN005COR01', 'MT2', 'MTL', 'mail:' + ID_CARLOS, 'metro lineal',
                V2008]], CU)
    usos = {'427VIN005COR01': ['N 216']}
    caso('unidad con fuente y el mail citado: verde', not revisar(p, unidad=True, usos=usos, **kw)[0])
    p = tabla([['427VIN005COR01', 'MT2', 'MTL', 'fak:', 'pasalo a metros', '']], CU)
    rojo, res = revisar(p, unidad=True, usos=usos, **kw)
    caso('unidad: el pedido de Carlos se encuentra por las piezas del export: rojo',
         rojo and 'CARLOS1707TPO0001' in ' '.join(res[0][1]))
    p = tabla([['427VIN005COR01', 'MT2', 'MTL', '', '', '']], CU)
    caso('unidad sin fuente: rojo', revisar(p, unidad=True, usos=usos, **kw)[0])

    print('piezas sueltas')
    caso('anchos: "X 1400MM ANCHO"', anchos_del_bloque('ESPESOR X 1400MM ANCHO C/') == [1.4])
    caso('anchos: "1,1X1400"', anchos_del_bloque('SANLEATHER IV 1,1X1400 ESP3,00') == [1.4])
    caso('anchos: "DE 1,40 M DE ANCHO"', anchos_del_bloque('DE 1,40 M DE ANCHO CON ESPUMA') == [1.4])
    caso('anchos: "ROLL WIDTH IS 835 MM"', anchos_del_bloque('ROLL WIDTH IS 835 MM +/- 13 MM') == [0.835])
    caso('anchos: "850MM WIDE"', anchos_del_bloque('850MM WIDE ROLL GOODS') == [0.85])
    caso('palabra clave de pieza: TOP ROLL', palabra_clave('TOP ROLL PTA. DEL. IZQ.') == 'top roll')
    caso('palabra clave de insumo: TPO', palabra_clave('TPO 0,5MM + FOAM', 3) == 'tpo')
    caso('palabra clave de TIPO IV IS LE: ninguna', palabra_clave('TIPO IV IS LE DE 1,10 MM', 3) is None)
    caso('1000 no es un ancho', ancho_en_metros(1000) is None and ancho_en_metros(835) == 0.835)

    print('selftest respaldoCarga: %s (%d ok, %d mal)' % ('todo verde' if not mal else 'HAY FALLAS', ok, mal))
    return 0 if not mal else 1


def main(argv):
    if '--selftest' in argv:
        return selftest()
    if '--revisar' in argv:
        i = argv.index('--revisar')
        rojo, _ = revisar(argv[i + 1], unidad='--unidad' in argv)
        return 1 if rojo else 0
    print(__doc__)
    return 1


if __name__ == '__main__':
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    sys.exit(main(sys.argv[1:]))
