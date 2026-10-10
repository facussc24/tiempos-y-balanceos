# -*- coding: utf-8 -*-
"""tbdImpresion.py - antes de imprimir un PDF, lista los TBD que quedaron escritos (cola P26).

POR QUE EXISTE: el 07/10/2026 se mando a imprimir un paquete de hojas de proceso y Fak, con la hoja en la
mano: "dice todo TBD". El chequeo de firma ya corria antes de imprimir (`firmaIA.exigir_sin_firma`); el de
TBD no. Este AVISA, no frena y no pregunta: un TBD puede ser legitimo (en un AMFE, "frecuencia TBD" es el
estado correcto de un dato que falta) y quien decide si se imprime igual es quien lo manda.

QUE RESPETA: en una hoja de proceso (formulario I-IN-002.4) el TBD del CAJETIN es valido (Fak, 24/09/2026:
"no puede haber ni 1 TBD... el TBD del numero de hoja si"). El cajetin se saltea SOLO si la pagina se
reconoce como hoja de proceso; en un flujograma, un AMFE o cualquier otro PDF no hay cajetin y cuenta todo.

UNA SOLA DEFINICION: la palabra, el tipo de pagina y donde termina el cajetin salen de
`scripts/_revisarPaqueteHO.py` (`PALABRAS`, `Pagina`, `y_cuerpo`). Solo lee el texto: no rasteriza.
"""
from __future__ import annotations

import os
import re
import sys

_AQUI = os.path.dirname(os.path.abspath(__file__))


def _revisor():
    """El revisor de paquetes de HO, cargado recien cuando hace falta (trae fitz, numpy y PIL)."""
    scripts = os.path.dirname(_AQUI)
    if scripts not in sys.path:
        sys.path.insert(0, scripts)
    import _revisarPaqueteHO as r
    return r


def paginas_a_revisar(paginas_txt: str | None, total: int) -> list[int]:
    """Las paginas que `_imprimir.py --paginas` va a mandar, leidas como las lee Ghostscript (-sPageList): "3" es
    una, "3-5" un rango y **"3-" va de la 3 hasta el final** (`parse_paginas` del revisor lee "3-" como la 3 sola:
    el aviso miraba una pagina y se imprimian todas las que seguian). Si el texto no se entiende o no deja ninguna
    pagina, se revisan TODAS: un aviso de mas es mejor que un TBD impreso sin avisar."""
    todas = list(range(1, total + 1))
    if not paginas_txt or not paginas_txt.strip():
        return todas
    out = set()
    try:
        for parte in paginas_txt.replace(' ', '').split(','):
            a, guion, b = parte.partition('-')
            ini = int(a)
            fin = total if (guion and not b) else (int(b) if b else ini)
            out.update(n for n in range(ini, fin + 1) if 1 <= n <= total)
    except ValueError:
        return todas
    return sorted(out) or todas


def _alrededor(texto: str, m: re.Match, ancho: int = 30) -> str:
    """El pedazo del renglon donde esta el TBD (un renglon largo recortado desde el principio lo dejaba afuera)."""
    a, b = max(0, m.start() - ancho), min(len(texto), m.end() + ancho)
    s = re.sub(r'\s+', ' ', texto[a:b]).strip()
    return ('…' if a else '') + s + ('…' if b < len(texto) else '')


def revisar_pdf(ruta: str, paginas_txt: str | None = None) -> dict:
    """{'hallados': [{pagina, veces, contexto: [str], tipo}], 'sin_texto': [paginas], 'revisadas': n}.
    `hallados`: cada pagina con TBD fuera del cajetin. `sin_texto`: paginas que no traen texto (una captura o un
    escaneo pegado): ahi un TBD no se puede leer, y se dice en vez de callar."""
    r = _revisor()
    rx = re.compile(dict(r.PALABRAS)['TBD'])
    hallados, sin_texto = [], []
    doc = r.fitz.open(ruta)
    try:
        nums = paginas_a_revisar(paginas_txt, len(doc))
        for n in nums:
            p = r.Pagina(doc, n - 1)
            if not p.lineas:
                sin_texto.append(n)
                continue
            # el cajetin existe solo en una hoja de proceso: ahi el TBD del numero de hoja es valido
            desde_y = r.y_cuerpo(p) if p.tipo == 'HO' else None
            ctx = []
            for l in p.lineas:
                if desde_y is not None and l.y0 < desde_y:
                    continue
                plano = r.sin_tildes(l.texto)            # mismo largo que el original: las posiciones valen
                ctx += [_alrededor(l.texto, m) for m in rx.finditer(plano.upper())]
            if ctx:
                hallados.append({'pagina': n, 'veces': len(ctx), 'contexto': ctx[:2], 'tipo': p.tipo})
    finally:
        doc.close()
    return {'hallados': hallados, 'sin_texto': sin_texto, 'revisadas': len(nums)}


def tbd_en_pdf(ruta: str, paginas_txt: str | None = None) -> list[dict]:
    """[{pagina, veces, contexto: [str], tipo}] por cada pagina con TBD fuera del cajetin."""
    return revisar_pdf(ruta, paginas_txt)['hallados']


def _decir(texto: str) -> None:
    """A stderr, sin romper si la consola no tiene la letra (cp1252 con un nombre de archivo en chino)."""
    try:
        print(texto, file=sys.stderr)
    except UnicodeEncodeError:
        cod = getattr(sys.stderr, 'encoding', None) or 'ascii'
        print(texto.encode(cod, 'replace').decode(cod, 'replace'), file=sys.stderr)
    except Exception:
        pass


def avisar(rutas: list[str], paginas_txt: str | None = None, quien: str = '') -> int:
    """Imprime por stderr un renglon OJO por pagina con TBD y un resumen. Nunca frena ni levanta: si no
    puede revisar un archivo lo dice y sigue. Devuelve cuantas paginas con TBD encontro."""
    de = (' (%s)' % quien) if quien else ''
    total = 0
    for ruta in rutas:
        nombre = os.path.basename(str(ruta))
        try:
            res = revisar_pdf(ruta, paginas_txt)
            hallados, sin_texto = res['hallados'], res['sin_texto']
            rangos = _revisor().rangos
        except Exception as e:                       # un aviso que falla no puede frenar la impresion
            _decir('  OJO%s: no pude revisar los TBD de %s (%s)' % (de, nombre, str(e)[:120]))
            continue
        try:
            if sin_texto:
                _decir('  OJO%s: %s tiene %d pagina(s) sin texto (son imagen): ahi no se puede leer si hay un TBD: p. %s' % (
                    de, nombre, len(sin_texto), rangos(sin_texto)))
            if not hallados:
                continue
            total += len(hallados)
            veces = sum(h['veces'] for h in hallados)
            _decir('  OJO%s: %s tiene %d TBD en %d pagina(s): p. %s' % (
                de, nombre, veces, len(hallados), rangos([h['pagina'] for h in hallados])))
            for h in hallados[:12]:
                _decir('       p.%-3d %s' % (h['pagina'], ' | '.join('«%s»' % c for c in h['contexto'])))
            if len(hallados) > 12:
                _decir('       … y %d pagina(s) mas' % (len(hallados) - 12))
        except Exception:
            pass
    return total


def _selftest() -> int:
    """En las dos direcciones, con PDF armados en la carpeta temporal. Sale 0 si todo da lo esperado."""
    import contextlib
    import io
    import tempfile
    r = _revisor()
    fitz = r.fitz

    def pagina(doc, renglones):
        p = doc.new_page(width=842, height=595)
        for y, texto in renglones:
            p.insert_text((40, y), texto, fontsize=10)

    HO_CAJETIN = [(30, 'HOJA DE OPERACIONES'), (45, 'HO-TBD'), (60, 'REV. A'), (75, 'N° DE OPERACION'), (90, '40')]
    HO_BANDAS = [(150, 'IMAGENES'), (165, 'DESCRIPCION DE LA OPERACION')]
    tmp = tempfile.mkdtemp(prefix='tbd_selftest_')
    ruta = os.path.join(tmp, 'paquete.pdf')
    doc = fitz.open()
    pagina(doc, HO_CAJETIN + HO_BANDAS + [(300, 'Aplicar adhesivo TBD en el borde'), (320, 'Presion: TBD / tiempo: TBD')])   # 1
    pagina(doc, HO_CAJETIN + HO_BANDAS + [(300, 'Aplicar adhesivo en el borde')])                                          # 2
    pagina(doc, [(30, 'FLUJOGRAMA DE PROCESO - Codigo TBD'), (300, 'OP 10 RECEPCION')])                                    # 3
    pagina(doc, [(30, 'AMFE DE PROCESO'), (300, 'PENDIENTE DE CONTROL'), (320, 'Autocontrol segun P-09/I')])              # 4
    pagina(doc, [(300, 'Frecuencia tbd'), (320, 'ESTABDO no es la palabra')])                                              # 5
    doc.save(ruta)
    doc.close()

    fallas = []

    def caso(nombre, ok):
        print('  %s  %s' % ('ok  ' if ok else 'MAL ', nombre))
        if not ok:
            fallas.append(nombre)

    h = {x['pagina']: x for x in tbd_en_pdf(ruta)}
    caso('ROJO: TBD en el cuerpo de una hoja de proceso (3 veces, sin contar el del cajetin)', h.get(1, {}).get('veces') == 3)
    caso('VERDE: hoja de proceso con TBD solo en el cajetin (HO-TBD)', 2 not in h)
    caso('ROJO: TBD arriba en una pagina que NO es hoja de proceso (no tiene cajetin)', h.get(3, {}).get('veces') == 1)
    caso('VERDE: PENDIENTE DE CONTROL y un texto sin TBD', 4 not in h)
    caso('ROJO: tbd en minuscula; VERDE: TBD adentro de otra palabra', h.get(5, {}).get('veces') == 1)
    caso('--paginas deja afuera las paginas con TBD', tbd_en_pdf(ruta, '2,4') == [])
    caso('--paginas 1-3 trae la 1 y la 3', [x['pagina'] for x in tbd_en_pdf(ruta, '1-3')] == [1, 3])

    err = io.StringIO()
    with contextlib.redirect_stderr(err):
        n = avisar([ruta], None, 'imprimir')
    t = err.getvalue()
    caso('avisar: un renglon OJO (imprimir) con el archivo, la cuenta y las paginas', n == 3 and 'OJO (imprimir): paquete.pdf tiene 5 TBD en 3 pagina(s): p. 1, 3, 5' in t)
    caso('avisar: el contexto de cada pagina', 'Aplicar adhesivo TBD en el borde' in t and 'Codigo TBD' in t)
    # --paginas se lee como la lee Ghostscript: "3-" es de la 3 al final (el revisor de HO la lee como la 3 sola)
    caso('--paginas 3- revisa de la 3 al final (la 3 y la 5 tienen TBD)', [x['pagina'] for x in tbd_en_pdf(ruta, '3-')] == [3, 5])
    caso('--paginas que no se entiende o no deja ninguna: se revisan todas', [x['pagina'] for x in tbd_en_pdf(ruta, 'abc')] == [1, 3, 5]
         and [x['pagina'] for x in tbd_en_pdf(ruta, '999')] == [1, 3, 5] and paginas_a_revisar(' 2 - 3 ,5', 5) == [2, 3, 5])

    otro = os.path.join(tmp, 'otro.pdf')
    doc = fitz.open()
    doc.new_page(width=595, height=842)                                                    # 1: sin texto (una captura)
    pagina(doc, [(300, ('palabra ' * 7) + 'frecuencia TBD del control ' + ('palabra ' * 7))])     # 2: renglon largo
    doc.save(otro)
    doc.close()
    res = revisar_pdf(otro)
    caso('una pagina sin texto se cuenta aparte (ahi no se puede leer un TBD)', res['sin_texto'] == [1])
    ctx = (res['hallados'] or [{'contexto': ['']}])[0]['contexto'][0]
    caso('el contexto de un renglon largo muestra el TBD, no el principio del renglon', 'TBD' in ctx and ctx.startswith('…'))
    err = io.StringIO()
    with contextlib.redirect_stderr(err):
        avisar([otro], None, 'imprimir')
    caso('avisar: dice cuantas paginas no tienen texto', 'otro.pdf tiene 1 pagina(s) sin texto (son imagen)' in err.getvalue())

    crudo = io.BytesIO()
    consola = io.TextIOWrapper(crudo, encoding='cp1252', errors='strict')
    raro = os.path.join(tmp, 'raro → 中.pdf')
    doc = fitz.open()
    pagina(doc, [(300, 'Frecuencia TBD')])
    doc.save(raro)
    doc.close()
    viejo, sys.stderr = sys.stderr, consola
    try:
        n = avisar([raro], None, 'imprimir')
        consola.flush()
    finally:
        sys.stderr = viejo
    caso('avisar: una consola cp1252 con un nombre de archivo que no puede escribir no levanta', n == 1 and b'tiene 1 TBD' in crudo.getvalue())
    for f in (otro, raro):
        try:
            os.remove(f)
        except OSError:
            pass
    err = io.StringIO()
    with contextlib.redirect_stderr(err):
        n = avisar([os.path.join(tmp, 'no_existe.pdf')], None, 'imprimir')
    caso('avisar: un archivo que no abre se dice y no levanta', n == 0 and 'no pude revisar los TBD de no_existe.pdf' in err.getvalue())
    err = io.StringIO()
    with contextlib.redirect_stderr(err):
        n = avisar([12345], None, 'imprimir')            # ni siquiera es una ruta: cualquier error se dice y se sigue
    caso('avisar: un error de cualquier tipo (no solo "no abre") tampoco levanta', n == 0 and 'no pude revisar los TBD de 12345' in err.getvalue())
    err = io.StringIO()
    with contextlib.redirect_stderr(err):
        n = avisar([ruta], '2,4', 'imprimir')
    caso('avisar: sin TBD no imprime nada', n == 0 and err.getvalue() == '')

    try:
        os.remove(ruta)
        os.rmdir(tmp)
    except OSError:
        pass
    print('selftest tbdImpresion: %s' % ('todo verde' if not fallas else '%d MAL' % len(fallas)))
    return 1 if fallas else 0


if __name__ == '__main__':                           # python scripts/_lib/tbdImpresion.py <pdf> [--paginas 1-3] | --selftest
    import argparse
    import json
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    if hasattr(sys.stderr, 'reconfigure'):
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    if '--selftest' in sys.argv[1:]:
        sys.exit(_selftest())
    ap = argparse.ArgumentParser(description='Lista los TBD de un PDF (fuera del cajetin de una hoja de proceso).')
    ap.add_argument('pdf')
    ap.add_argument('--paginas')
    ap.add_argument('--json', action='store_true')
    a = ap.parse_args()
    if a.json:
        print(json.dumps(tbd_en_pdf(a.pdf, a.paginas), ensure_ascii=False))
    else:
        n = avisar([a.pdf], a.paginas)
        print('%d pagina(s) con TBD' % n)
