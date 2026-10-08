# -*- coding: utf-8 -*-
"""
_vocabularioPlanta.py - arma y usa el corpus de palabras de Barack.

Fak, 08/10/2026, sobre un flujograma que decia «RESTITUCION DE CONTROL DE MATERIA PRIMA (IQC) CON
CUARENTENA»: «jamas podes poner algo que yo no pueda defender o que no entienda... nadie lo va a
entender, incluso los gerentes». Un documento para la planta lleva solo vocabulario que la gente de
Barack usa. El control (lista blanca con fuente) vive en `scripts/_lib/vocabulario_planta.py` y su
gemelo `vocabularioPlanta.mjs`; este script arma el corpus que leen los dos.

    python scripts/_vocabularioPlanta.py --construir            # recorre las fuentes y escribe el data.json
    python scripts/_vocabularioPlanta.py --construir --sin-fak   # solo servidor (sin los mensajes de Fak)
    python scripts/_vocabularioPlanta.py --construir --sin-servidor
    python scripts/_vocabularioPlanta.py --revisar "Colocar la pieza en el molde"
    python scripts/_vocabularioPlanta.py --selftest
    python scripts/_vocabularioPlanta.py --stats

DE DONDE SALE (todo es texto que escribieron PERSONAS de Barack, no Claude):
  1. Hojas de operaciones de Excel: `Y:\\BARACK\\CALIDAD\\DOCUMENTACION SGC\\HOJAS DE OPERACIONES\\`
     (.xlsx .xlsm .xls), modificadas ANTES del 01/08/2026.
  2. Procedimientos e instructivos: `...\\DOCUMENTACION SGC\\SISTEMA\\` (.docx .doc .xlsx .xlsm .xls
     .pdf de texto), con el mismo corte de fecha.
  3. Los mensajes que escribio Fak en `~/.claude/projects/C--Dev-BarackMercosul/*.jsonl`: solo
     rol usuario escrito por el (se sacan resultados de herramientas, avisos de sistema, avisos de
     tareas, resumenes de compactado, mensajes que arrancan con `<` y los encargos de otra sesion;
     la lista de lo que no es de Fak es la UNICA del repo: `correccionCanon.data.json`).

NO se copia nada al disco ni se usa Excel por COM: los .xlsx/.docx se abren como zip directo desde
Y:, los .xls con xlrd, los .doc con olefile (tabla de piezas del Word 97) y los .pdf con PyMuPDF.
Por que .xlsx va por zip y no por openpyxl: las hojas pesan 5-10 MB por las fotos; el zip permite leer
SOLO sharedStrings.xml y los cuadros de texto sin bajar las fotos por la red. Es el mismo texto de las
celdas. Si el zip no se puede leer, cae a openpyxl read_only.

CACHE: `.sgc-cache/vocabulario/archivos.json` (gitignoreado) guarda las palabras de cada archivo con su
tamano y fecha; un --construir segundo no vuelve a leer Y: salvo lo que cambio.

LO QUE EL --construir NO TOCA: `reglas`, `ignoradas`, `aprobadas` y `prohibidas` del data.json son a
mano (con fuente) y se conservan tal cual. Solo reescribe `corpus`, `corpus_fuentes` y `corpus_meta`.
"""
from __future__ import annotations

import argparse
import concurrent.futures as cf
import datetime as dt
import hashlib
import html
import io
import json
import os
import re
import struct
import sys
import time
import zipfile

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
sys.path.insert(0, os.path.join(AQUI, '_lib'))
import vocabulario_planta as vp  # noqa: E402

DATOS = vp.DATOS
CACHE_DIR = os.path.join(RAIZ, '.sgc-cache', 'vocabulario')
CACHE = os.path.join(CACHE_DIR, 'archivos.json')

SERVIDOR = r'Y:\BARACK\CALIDAD\DOCUMENTACION SGC'
RAICES = [
    ('ho', os.path.join(SERVIDOR, 'HOJAS DE OPERACIONES'), {'.xlsx', '.xlsm', '.xls'}),
    ('sgc', os.path.join(SERVIDOR, 'SISTEMA'), {'.docx', '.doc', '.xlsx', '.xlsm', '.xls', '.pdf'}),
]
CORTE = dt.datetime(2026, 8, 1)
PROYECTOS = os.path.join(os.path.expanduser('~'), '.claude', 'projects', 'C--Dev-BarackMercosul')
CANON_CORRECCION = os.path.join(AQUI, '_lib', 'correccionCanon.data.json')
CANON_EXPLICAR = os.path.join(AQUI, '_lib', 'explicarCanon.data.json')

# Programas que arman archivos solos: lo que dejan escrito no es de una persona de Barack.
GENERADORES = re.compile(r'openpyxl|python-docx|python-pptx|xlsxwriter|exceljs|claude', re.I)
MAX_BYTES_PDF = 40 * 1024 * 1024
MAX_BYTES_XLS = 60 * 1024 * 1024
MAX_LARGO_FAK = 6000

_T = re.compile(r'<(?:\w+:)?t(?:\s[^>]*)?>([^<]*)</(?:\w+:)?t>')
_CREADOR = re.compile(r'<(?:dc:creator|cp:lastModifiedBy)>([^<]*)</', re.I)


# ═════════════════════════ lectura de cada tipo de archivo ═════════════════════════
def _texto_xml(data):
    s = data.decode('utf-8', 'replace')
    return '\n'.join(html.unescape(p) for p in _T.findall(s))


def _generador_de(z):
    try:
        core = z.read('docProps/core.xml').decode('utf-8', 'replace')
    except KeyError:
        return ''
    for m in _CREADOR.findall(core):
        if GENERADORES.search(m):
            return m
    return ''


def leer_ooxml(ruta, partes_re):
    """xlsx/docx como zip: lee solo las partes con texto. Devuelve (texto, generador)."""
    with zipfile.ZipFile(ruta) as z:
        gen = _generador_de(z)
        out = []
        for n in z.namelist():
            if partes_re.match(n):
                out.append(_texto_xml(z.read(n)))
    return '\n'.join(out), gen


_XLSX_PARTES = re.compile(r'^xl/(sharedStrings\.xml|drawings/drawing\d*\.xml|comments\d*\.xml)$')
_DOCX_PARTES = re.compile(r'^word/(document|header\d*|footer\d*|footnotes|endnotes|comments)\.xml$')


def leer_xlsx(ruta):
    try:
        return leer_ooxml(ruta, _XLSX_PARTES)
    except (zipfile.BadZipFile, KeyError, OSError):
        import openpyxl
        wb = openpyxl.load_workbook(ruta, read_only=True, data_only=True)
        out = []
        for ws in wb.worksheets:
            for fila in ws.iter_rows(values_only=True):
                out.extend(v for v in fila if isinstance(v, str))
        wb.close()
        return '\n'.join(out), ''


def leer_docx(ruta):
    return leer_ooxml(ruta, _DOCX_PARTES)


def leer_xls(ruta):
    import xlrd
    if os.path.getsize(ruta) > MAX_BYTES_XLS:
        raise ValueError('xls de mas de 60 MB: no se lee')
    book = xlrd.open_workbook(ruta, on_demand=True, formatting_info=False, ignore_workbook_corruption=True)
    out = []
    try:
        for i in range(book.nsheets):
            sh = book.sheet_by_index(i)
            out.append(sh.name)
            for r in range(sh.nrows):
                for v in sh.row_values(r):
                    if isinstance(v, str) and v.strip():
                        out.append(v)
            book.unload_sheet(i)
    finally:
        book.release_resources()
    return '\n'.join(out), ''


def leer_doc(ruta):
    """Word 97-2003: el texto vive en la tabla de piezas (CLX) de la tabla 0Table/1Table."""
    import olefile
    ole = olefile.OleFileIO(ruta)
    try:
        wd = ole.openstream('WordDocument').read()
        if struct.unpack('<H', wd[:2])[0] != 0xA5EC:
            raise ValueError('no es Word 97 o mas nuevo')
        flags = struct.unpack('<H', wd[0x0A:0x0C])[0]
        tb = ole.openstream('1Table' if flags & 0x0200 else '0Table').read()
        fc_clx, lcb_clx = struct.unpack('<II', wd[0x01A2:0x01AA])
        clx = tb[fc_clx:fc_clx + lcb_clx]
        i = 0
        while i < len(clx) and clx[i] == 0x01:           # Prc: se saltea
            i += 3 + struct.unpack('<H', clx[i + 1:i + 3])[0]
        if i >= len(clx) or clx[i] != 0x02:
            raise ValueError('sin tabla de piezas')
        lcb = struct.unpack('<I', clx[i + 1:i + 5])[0]
        plc = clx[i + 5:i + 5 + lcb]
        n = (lcb - 4) // 12
        cps = struct.unpack('<%dI' % (n + 1), plc[:4 * (n + 1)])
        out = []
        for k in range(n):
            pcd = plc[4 * (n + 1) + 8 * k: 4 * (n + 1) + 8 * (k + 1)]
            fc = struct.unpack('<I', pcd[2:6])[0]
            nch = cps[k + 1] - cps[k]
            if nch <= 0 or nch > 5_000_000:
                continue
            if fc & 0x40000000:                           # 8 bits por caracter
                off = (fc & 0x3FFFFFFF) // 2
                out.append(wd[off:off + nch].decode('cp1252', 'replace'))
            else:                                         # UTF-16
                off = fc & 0x3FFFFFFF
                out.append(wd[off:off + 2 * nch].decode('utf-16-le', 'replace'))
        txt = '\n'.join(out)
    finally:
        ole.close()
    txt = re.sub(r'\x13[^\x14\x15]*\x14', ' ', txt)       # codigo de campo (HYPERLINK, PAGE...)
    txt = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', ' ', txt)
    return txt, ''


def leer_pdf(ruta):
    import fitz
    if os.path.getsize(ruta) > MAX_BYTES_PDF:
        raise ValueError('pdf de mas de 40 MB: no se lee')
    out = []
    with fitz.open(ruta) as d:
        for pg in list(d)[:300]:
            out.append(pg.get_text())
    return '\n'.join(out), ''


# Idioma de un documento. Las carpetas del servidor tienen hojas traducidas al ingles («Version ingles»),
# formularios de clientes en ingles (PSW, 8D) y documentos de Brasil: sus palabras NO son las que Barack
# usa para hablarle a su planta (medido: «compliance», «deadline», «ashtray», «bilaminate», «qualitats»).
# Se cuentan palabras funcionales que existen en un idioma y NO en castellano; un documento es de
# otro idioma si tiene 4+ de esas y mas que las castellanas. Un documento corto no se descarta.
_ES_FUNC = frozenset('de la el en los las del por con para una que se al lo su sus como pero sin sobre entre este esta '
                     'estos estas muy ya hasta desde cuando donde cada segun mediante'.split())
_EN_FUNC = frozenset('the of and to in is are for with that this be by on at or from not will shall must should all any '
                     'if it its has have when which each was were been they their we you your our can may than then '
                     'there these those such'.split())
_PT_FUNC = frozenset('nao sao uma pelo pela pelos pelas aos das mais tambem foi muito isso voce os com seu sua ou tem '
                     'deve pode podem devem onde apos ate sem estao'.split())


def idioma_de(palabras_doc):
    es = len(palabras_doc & _ES_FUNC)
    en = len(palabras_doc & _EN_FUNC)
    pt = len(palabras_doc & _PT_FUNC)
    if en >= 4 and en > es:
        return 'en'
    if pt >= 4 and pt > es:
        return 'pt'
    return 'es'


LECTORES = {'.xlsx': leer_xlsx, '.xlsm': leer_xlsx, '.xls': leer_xls, '.docx': leer_docx,
            '.doc': leer_doc, '.pdf': leer_pdf}


def leer_archivo(ruta):
    """(palabras, generador, error). `generador` no vacio = lo armo un programa: no cuenta."""
    ext = os.path.splitext(ruta)[1].lower()
    try:
        texto, gen = LECTORES[ext](ruta)
    except Exception as e:                                # un archivo roto no frena a los otros 3.000
        return None, '', f'{type(e).__name__}: {str(e)[:80]}'
    if gen:
        return None, gen, ''
    return sorted(set(vp.palabras(texto))), '', ''


# ═════════════════════════════ recorrido de Y: ═════════════════════════════
def recorrer(raiz, exts):
    """Archivos de `raiz` con su tamano y fecha. scandir trae la fecha en la misma llamada de la
    carpeta (en Windows no hay un viaje de red por archivo)."""
    pila = [raiz]
    while pila:
        d = pila.pop()
        try:
            with os.scandir(d) as it:
                for e in it:
                    try:
                        if e.is_dir(follow_symlinks=False):
                            pila.append(e.path)
                        elif os.path.splitext(e.name)[1].lower() in exts and not e.name.startswith('~$'):
                            st = e.stat()
                            yield e.path, st.st_size, st.st_mtime
                    except OSError:
                        continue
        except OSError:
            continue


def cargar_cache():
    try:
        with open(CACHE, encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def guardar_cache(c):
    os.makedirs(CACHE_DIR, exist_ok=True)
    tmp = CACHE + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(c, f, ensure_ascii=False, separators=(',', ':'))
    os.replace(tmp, CACHE)


def leer_servidor(hilos, solo_nuevos_log=True):
    """Lee Y: y devuelve (archivos, stats). archivos: [(tipo, ruta_relativa, set_palabras)] ordenado."""
    t0 = time.time()
    stats = {'listados': 0, 'por_fecha': 0, 'leidos': 0, 'del_cache': 0, 'generados_por_programa': 0,
             'errores': 0, 'sin_texto': 0, 'por_extension': {}, 'seg_listar': 0, 'seg_leer': 0,
             'errores_ejemplos': []}
    pendientes = []
    for tipo, raiz, exts in RAICES:
        if not os.path.isdir(raiz):
            raise SystemExit(f'No encuentro {raiz}. Y: no esta montado: no se arma el corpus del servidor.')
        for ruta, tam, mt in recorrer(raiz, exts):
            stats['listados'] += 1
            if dt.datetime.fromtimestamp(mt) >= CORTE:
                stats['por_fecha'] += 1
                continue
            pendientes.append((tipo, raiz, ruta, tam, mt))
    pendientes.sort(key=lambda x: x[2])
    stats['seg_listar'] = round(time.time() - t0, 1)
    print(f'  Y: {stats["listados"]} archivos de texto, {stats["por_fecha"]} sacados por fecha '
          f'(>= 01/08/2026), {len(pendientes)} a leer ({stats["seg_listar"]} s)', flush=True)

    cache = cargar_cache()
    resultados = {}                                       # ruta -> {'p': [...]} | {'g': gen} | {'e': error}
    por_leer = []
    for p in pendientes:
        clave = f'{p[2]}|{p[3]}|{int(p[4])}'
        if clave in cache:
            resultados[p[2]] = cache[clave]
            stats['del_cache'] += 1
        else:
            por_leer.append((p, clave))
    t1 = time.time()
    hechos = 0

    def trabajo(item):
        p, clave = item
        pal, gen, err = leer_archivo(p[2])
        return p, clave, pal, gen, err

    with cf.ThreadPoolExecutor(max_workers=hilos) as ex:
        futuros = [ex.submit(trabajo, it) for it in por_leer]
        for fu in cf.as_completed(futuros):
            p, clave, pal, gen, err = fu.result()
            hechos += 1
            if err:                                       # un error no se guarda en el cache: se reintenta
                resultados[p[2]] = {'e': err}
            elif gen:
                cache[clave] = resultados[p[2]] = {'g': gen}
            else:
                cache[clave] = resultados[p[2]] = {'p': pal}
            stats['leidos'] += 1
            if hechos % 100 == 0:
                guardar_cache(cache)
                print(f'    {hechos}/{len(por_leer)} leidos ({round(time.time() - t1)} s)', flush=True)
    if por_leer:
        guardar_cache(cache)
    stats['seg_leer'] = round(time.time() - t1, 1)

    archivos = []
    stats['descartados_por_idioma'] = {'en': 0, 'pt': 0, 'ejemplos': []}
    for tipo, raiz, ruta, tam, mt in pendientes:
        r = resultados.get(ruta, {})
        ext = os.path.splitext(ruta)[1].lower()
        stats['por_extension'][ext] = stats['por_extension'].get(ext, 0) + 1
        if 'p' in r:
            if r['p']:
                idioma = idioma_de(set(r['p']))
                if idioma != 'es':
                    stats['descartados_por_idioma'][idioma] += 1
                    if len(stats['descartados_por_idioma']['ejemplos']) < 6:
                        stats['descartados_por_idioma']['ejemplos'].append(f'{idioma}: {os.path.basename(ruta)}')
                    continue
                archivos.append((tipo, tipo.upper() + ':' + os.path.relpath(ruta, raiz).replace(os.sep, '/'), set(r['p'])))
            else:
                stats['sin_texto'] += 1
        elif 'g' in r:
            stats['generados_por_programa'] += 1
        elif 'e' in r:
            stats['errores'] += 1
            if len(stats['errores_ejemplos']) < 8:
                stats['errores_ejemplos'].append(f'{os.path.basename(ruta)}: {r["e"]}')
    stats['archivos_con_palabras'] = len(archivos)
    return archivos, stats


# ═════════════════════════ los mensajes de Fak ═════════════════════════
AVISOS_ADELANTE = re.compile(r'^(\s*<system-reminder>[\s\S]*?</system-reminder>)+')
_CREDENCIALES = re.compile(r'contrase[nñ]a|password|passwd|api[ _-]?key|secret|token|\bpin\b|bearer|sk-[a-z0-9]', re.I)


def _sin_avisos(t):
    s = AVISOS_ADELANTE.sub('', t)
    return t if len(s) == len(t) else s.lstrip()


def _texto_de(content):
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return '\n'.join(b.get('text', '') for b in content if isinstance(b, dict) and b.get('type') == 'text')
    return ''


def _limpiar_mensaje(t):
    t = re.sub(r'```.*?```', ' ', t, flags=re.S)
    t = re.sub(r'`[^`\n]*`', ' ', t)
    t = re.sub(r'\[Image[^\]]*\]', ' ', t)
    t = re.sub(r'[A-Za-z]:[\\/][^\s"\'<>|]+', ' ', t)         # rutas de Windows
    t = re.sub(r'\\\\[^\s"\'<>|]+', ' ', t)                  # rutas de red
    t = re.sub(r'(?:[\w.\-]+/){2,}[\w.\-]*', ' ', t)          # rutas con barras
    return t


def mensajes_de_fak(max_largo=MAX_LARGO_FAK):
    """Generador de (fecha_dd_mm, texto_limpio) de lo que escribio Fak. Cuenta todo lo que descarta."""
    with open(CANON_CORRECCION, encoding='utf-8') as f:
        marcas = json.load(f)['no_es_de_fak']
    no_es = re.compile(r'^\s*(' + '|'.join(re.escape(m) for m in marcas) + ')', re.I)
    with open(CANON_EXPLICAR, encoding='utf-8') as f:
        encargo = re.compile(json.load(f)['cierre']['encargo_re'])
    cuenta = {'archivos': 0, 'lineas_usuario': 0, 'aceptados': 0, 'duplicados': 0, 'automaticos': 0,
              'encargos': 0, 'empiezan_con_menor': 0, 'muy_largos': 0, 'con_credenciales': 0,
              'metas_o_subagente': 0, 'otro_origen': 0, 'vacios': 0, 'largos_ejemplo': []}
    vistos = set()
    archivos = sorted(f for f in os.listdir(PROYECTOS) if f.endswith('.jsonl'))
    cuenta['archivos'] = len(archivos)

    def candidatos():
        for nombre in archivos:
            with open(os.path.join(PROYECTOS, nombre), 'rb') as fh:
                for linea in fh:
                    es_user = b'"type":"user"' in linea and b'"tool_result"' not in linea \
                        and b'"toolUseResult"' not in linea
                    es_cola = b'"queued_command"' in linea
                    if not (es_user or es_cola):
                        continue
                    try:
                        o = json.loads(linea)
                    except ValueError:
                        continue
                    yield o

    for o in candidatos():
        if o.get('type') == 'attachment':
            a = o.get('attachment') or {}
            if a.get('type') != 'queued_command' or a.get('commandMode') != 'prompt':
                continue
            if (a.get('origin') or {}).get('kind') not in (None, 'human'):
                cuenta['otro_origen'] += 1
                continue
            crudo = _texto_de(a.get('prompt'))
        elif o.get('type') == 'user':
            cuenta['lineas_usuario'] += 1
            if o.get('isMeta') or o.get('isCompactSummary') or o.get('isSidechain'):
                cuenta['metas_o_subagente'] += 1
                continue
            if (o.get('origin') or {}).get('kind') not in (None, 'human'):
                cuenta['otro_origen'] += 1
                continue
            crudo = _texto_de((o.get('message') or {}).get('content'))
        else:
            continue
        if encargo.search(crudo):
            cuenta['encargos'] += 1
            continue
        t = _sin_avisos(crudo)
        if not t.strip():
            cuenta['vacios'] += 1
            continue
        if no_es.search(t):
            cuenta['automaticos'] += 1
            continue
        if t.lstrip().startswith('<'):
            cuenta['empiezan_con_menor'] += 1
            continue
        if _CREDENCIALES.search(t):
            cuenta['con_credenciales'] += 1
            continue
        if len(t) > max_largo:
            cuenta['muy_largos'] += 1
            continue
        ts = o.get('timestamp') or ''
        clave = hashlib.sha1((ts + '|' + t).encode('utf-8', 'replace')).hexdigest()
        if clave in vistos:
            cuenta['duplicados'] += 1
            continue
        vistos.add(clave)
        try:
            f = dt.datetime.fromisoformat(ts.replace('Z', '+00:00')) - dt.timedelta(hours=3)
            fecha = f.strftime('%d/%m')
        except ValueError:
            fecha = '??/??'
        cuenta['aceptados'] += 1
        yield fecha, ts, _limpiar_mensaje(t)
    yield 'CUENTA', '', cuenta


def leer_fak(max_largo):
    t0 = time.time()
    msgs = []
    cuenta = {}
    for fecha, ts, t in mensajes_de_fak(max_largo):
        if fecha == 'CUENTA':
            cuenta = t
        else:
            msgs.append((ts, fecha, set(vp.palabras(t))))
    msgs.sort(key=lambda x: x[0])
    cuenta['seg'] = round(time.time() - t0, 1)
    cuenta['con_palabras'] = sum(1 for m in msgs if m[2])
    return [(f, p) for _, f, p in msgs if p], cuenta


# ═════════════════════════════ armado del data.json ═════════════════════════════
FAK_CACHE = os.path.join(CACHE_DIR, 'fak.json')


def fak_agregado(args):
    """{palabra: [mensajes, 'Fak dd/mm', 'Fak dd/mm']}, cuenta. Lee los .jsonl (unos 200 s) o, con
    --sin-fak, el cache de la corrida anterior."""
    if args.sin_fak:
        try:
            with open(FAK_CACHE, encoding='utf-8') as f:
                j = json.load(f)
            print(f'  mensajes de Fak: del cache ({j["cuenta"].get("aceptados", 0)} mensajes)', flush=True)
            return j['palabras'], j['cuenta']
        except (OSError, ValueError, KeyError):
            print('  mensajes de Fak: no hay cache, la columna de Fak queda en cero', flush=True)
            return {}, {}
    print('Mensajes de Fak...', flush=True)
    mensajes, cuenta = leer_fak(args.max_largo_fak)
    print(f'  {cuenta.get("aceptados", 0)} mensajes de Fak ({cuenta["seg"]} s)', flush=True)
    agg = {}
    for fecha, pals in mensajes:                           # ya viene en orden de fecha
        for p in pals:
            e = agg.get(p)
            if e is None:
                agg[p] = [1, f'Fak {fecha}']
            else:
                e[0] += 1
                if len(e) < 3 and f'Fak {fecha}' not in e[1:]:
                    e.append(f'Fak {fecha}')
    os.makedirs(CACHE_DIR, exist_ok=True)
    with open(FAK_CACHE, 'w', encoding='utf-8') as f:
        json.dump({'cuenta': cuenta, 'palabras': agg}, f, ensure_ascii=False, separators=(',', ':'))
    return agg, cuenta


def construir(args):
    t0 = time.time()
    archivos, stats_srv = ([], {})
    if not args.sin_servidor:
        print('Servidor (Y:)...', flush=True)
        archivos, stats_srv = leer_servidor(args.hilos)
    fak, stats_fak = fak_agregado(args)

    fuentes, idx = [], {}

    def fid(nombre):
        if nombre not in idx:
            idx[nombre] = len(fuentes)
            fuentes.append(nombre)
        return idx[nombre]

    corpus = {}                                           # palabra -> [ho, sgc, fak, f1, f2]
    for tipo, nombre, pals in archivos:
        col = 0 if tipo == 'ho' else 1
        i = fid(nombre)
        for p in pals:
            e = corpus.get(p)
            if e is None:
                e = corpus[p] = [0, 0, 0]
            e[col] += 1
            if len(e) < 5 and i not in e[3:]:
                e.append(i)
    # Fak: columna de apoyo. Una palabra que SOLO dijo Fak se guarda si la dijo en `fak_solo_min`+ mensajes
    # (para poder promoverla a `aprobadas` con su fuente); el resto es chat y typos y no se guarda.
    solo_total = solo_guardadas = 0
    for p, (n, *fechas) in fak.items():
        e = corpus.get(p)
        if e is None:
            solo_total += 1
            if n < args.fak_solo_min:
                continue
            solo_guardadas += 1
            e = corpus[p] = [0, 0, 0]
        e[2] = n
        for fch in fechas:
            i = fid(fch)
            if len(e) < 5 and i not in e[3:]:
                e.append(i)

    # datos viejos: se conserva TODO lo manual
    try:
        with open(DATOS, encoding='utf-8') as f:
            d = json.load(f)
    except (OSError, ValueError):
        d = {}
    meta = {
        'armado': dt.datetime.now().strftime('%Y-%m-%d %H:%M'),
        'corte_fecha_servidor': CORTE.strftime('%Y-%m-%d'),
        'palabras': len(corpus),
        'palabras_en_documentos': sum(1 for e in corpus.values() if e[0] or e[1]),
        'palabras_solo_de_fak_guardadas': solo_guardadas,
        'palabras_solo_de_fak_descartadas': solo_total - solo_guardadas,
        'fak_solo_min_mensajes': args.fak_solo_min,
        'archivos_hojas_de_operaciones': sum(1 for a in archivos if a[0] == 'ho'),
        'archivos_sgc': sum(1 for a in archivos if a[0] == 'sgc'),
        'mensajes_fak': stats_fak.get('aceptados', 0),
        'segundos_totales': round(time.time() - t0, 1),
        'servidor': stats_srv,
        'fak': {k: v for k, v in stats_fak.items() if k != 'largos_ejemplo'},
        'columnas': 'palabra -> [documentos de hojas de operaciones, documentos del SGC, mensajes de Fak, '
                    'fuente1, fuente2] (las fuentes son indices a corpus_fuentes)',
    }
    d['corpus_meta'] = meta
    d['corpus_fuentes'] = fuentes
    d['corpus'] = {k: corpus[k] for k in sorted(corpus)}
    escribir_datos(d)
    print(f'\n{len(corpus)} palabras en el corpus ({meta["palabras_en_documentos"]} en documentos de Barack). '
          f'data.json: {os.path.getsize(DATOS) / 1e6:.2f} MB. Total {meta["segundos_totales"]} s.')
    return d


def donde(palabra):
    """De donde sale una palabra: lo que hay que citar para aprobarla en `aprobadas`."""
    cfg = vp.cargar()
    for pal in sorted(set(vp.palabras(palabra))):
        print(f'"{pal}"')
        for v in sorted(vp.variantes(pal)):
            e = cfg['corpus'].get(v)
            if e is not None:
                print(f'  {v}: {e[0]} hojas de operaciones, {e[1]} documentos del SGC, {e[2]} mensajes de Fak')
                for fu in vp._fuente_de(e, cfg['fuentes']):
                    print(f'      {fu}')
        try:
            with open(FAK_CACHE, encoding='utf-8') as f:
                fk = json.load(f)['palabras']
            for v in sorted(vp.variantes(pal)):
                if v in fk:
                    print(f'  {v} en mensajes de Fak: {fk[v][0]} mensajes ({", ".join(fk[v][1:])})')
        except (OSError, ValueError, KeyError):
            pass
        est, _ = vp.evaluar_palabra(pal, cfg)
        print(f'  => {"pasa" if est == "ok" else "NO pasa" if est == "fuera" else "PROHIBIDA"}')


def escribir_datos(d):
    """Cabecera a mano legible (reglas, ignoradas, aprobadas, prohibidas) y el corpus de a una palabra
    por renglon: el diff de un --construir es revisable y las listas a mano se siguen leyendo."""
    orden = ['_leeme', 'version', 'reglas', 'ignoradas', 'aprobadas', 'prohibidas', 'corpus_meta', 'corpus_fuentes']
    partes = []
    for k in orden:
        if k in d:
            partes.append(f'  {json.dumps(k)}: {json.dumps(d[k], ensure_ascii=False, indent=2).replace(chr(10), chr(10) + "  ")}')
    for k in d:
        if k not in orden and k != 'corpus':
            partes.append(f'  {json.dumps(k)}: {json.dumps(d[k], ensure_ascii=False)}')
    filas = ',\n'.join(f'    {json.dumps(k, ensure_ascii=False)}: {json.dumps(v, ensure_ascii=False, separators=(",", ":"))}'
                       for k, v in d['corpus'].items())
    partes.append('  "corpus": {\n' + filas + '\n  }')
    texto = '{\n' + ',\n'.join(partes) + '\n}\n'
    tmp = DATOS + '.tmp'
    with open(tmp, 'w', encoding='utf-8', newline='\n') as f:
        f.write(texto)
    json.loads(texto)                                     # que lo escrito se pueda leer
    os.replace(tmp, DATOS)


def stats():
    cfg = vp.cargar()
    c = cfg['corpus']
    m = cfg['datos'].get('corpus_meta', {})
    print(f'Corpus armado: {m.get("armado")}  ({len(c)} palabras)')
    print(f'  archivos de hojas de operaciones: {m.get("archivos_hojas_de_operaciones")}, '
          f'del SGC: {m.get("archivos_sgc")}, mensajes de Fak: {m.get("mensajes_fak")}')
    srv = sum(1 for e in c.values() if e[0] or e[1])
    solo_fak = [p for p, e in c.items() if not (e[0] or e[1])]
    print(f'  palabras que estan en algun documento de Barack: {srv}')
    minimo = cfg['reglas'].get('min_mensajes_fak')
    print(f'  palabras SOLO en mensajes de Fak (guardadas): {len(solo_fak)}  '
          + (f'cuentan las de {minimo}+ mensajes: {sum(1 for p in solo_fak if c[p][2] >= minimo)}'
             if minimo else '(apagado: lo que dice Fak en el chat no alcanza solo)'))
    print(f'  aprobadas a mano: {len(cfg["aprobadas"])}  prohibidas a mano: {len(cfg["prohibidas"])}')


def main():
    ap = argparse.ArgumentParser(description='Corpus de palabras de Barack y control de vocabulario')
    ap.add_argument('--construir', action='store_true')
    ap.add_argument('--sin-fak', action='store_true')
    ap.add_argument('--sin-servidor', action='store_true')
    ap.add_argument('--hilos', type=int, default=6)
    ap.add_argument('--max-largo-fak', type=int, default=MAX_LARGO_FAK)
    ap.add_argument('--fak-solo-min', type=int, default=3,
                    help='una palabra que solo dijo Fak se guarda si la dijo en tantos mensajes (def. 3)')
    ap.add_argument('--donde', metavar='PALABRA', help='de donde sale una palabra (para citarla al aprobarla)')
    ap.add_argument('--revisar', metavar='TEXTO')
    ap.add_argument('--revisar-json', action='store_true',
                    help='lee por stdin [[donde, texto], ...] y escribe los hallazgos como JSON (para el gemelo JS)')
    ap.add_argument('--stats', action='store_true')
    ap.add_argument('--selftest', action='store_true')
    a = ap.parse_args()
    if a.construir:
        construir(a)
        return 0
    if a.revisar is not None:
        hal = vp.revisar_textos([('texto', a.revisar)])
        print(vp.texto_de_hallazgos(hal) if hal else 'verde: todas las palabras son de Barack')
        return 1 if hal else 0
    if a.revisar_json:
        items = json.load(sys.stdin)
        hal = vp.revisar_textos([(d, t) for d, t in items])
        print(json.dumps([{'palabra': h['palabra'], 'motivo': h['motivo'], 'donde': h['donde']} for h in hal],
                         ensure_ascii=False))
        return 1 if hal else 0
    if a.donde:
        donde(a.donde)
        return 0
    if a.stats:
        stats()
        return 0
    if a.selftest:
        import vocabularioPlantaSelftest as st
        return st.correr()
    ap.print_help()
    return 2


if __name__ == '__main__':
    for _f in (sys.stdout, sys.stderr):
        try:
            _f.reconfigure(encoding='utf-8', errors='replace')
        except Exception:
            pass
    sys.exit(main())
