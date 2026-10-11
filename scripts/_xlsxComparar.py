# -*- coding: utf-8 -*-
"""Compara dos Excel y dice que cambio: la tabla «hoja, celda, antes, despues».

    python scripts/_xlsxComparar.py <antes.xlsx> <despues.xlsx>            # tabla en texto (markdown)
    python scripts/_xlsxComparar.py <antes.xlsx> <despues.xlsx> --json     # lo mismo, para un programa

Para que (cola HOY-18a): cuando se corrige el archivo de OTRO, Fak pide ver cada celda con su ANTES
(06/10/2026, el plan de control de Nico: "no me lo abras, auditalo... poneme el antes"). Hasta hoy esa
tabla se armaba a mano o salia del `verificar()` de `_xlsxCorregirTexto.py`, que solo corre al aplicar
un cambio propio. El metodo (hoja por hoja, celda por celda, hojas agregadas o quitadas, valor o formula,
codigos de salida) es el de github.com/rad03i2/excel-diff, rehecho con openpyxl, que ya esta instalada.

Que compara, por cada celda de cada hoja que esta en los dos libros:
  - la FORMULA (el texto que se escribio en la celda: `=B2*C2`, o el valor si no hay formula), y
  - el VALOR que Excel dejo calculado la ultima vez que guardo el libro.
Si cambio la formula, la fila dice «fórmula» (y trae los dos valores calculados si tambien cambiaron).
Si la formula es la misma y cambio el resultado, dice «valor». Una celda sin formula dice «valor».
Las hojas que estan en uno solo de los dos libros se listan aparte; sus celdas no se comparan.

Sale con 0 si son iguales · 1 si hay diferencias · 2 si no pudo comparar (falta un archivo, no es un
.xlsx/.xlsm, es el mismo archivo dos veces, o un argumento que no conoce).

SOLO LEE: abre los dos libros en modo lectura y no escribe en ningun lado.

LIMITES de esta version (lo que NO compara):
  - formatos (color, fuente, bordes, ancho de columna), celdas combinadas, comentarios, imagenes,
    graficos, macros y propiedades del libro;
  - una fila o columna INSERTADA corre todo lo de abajo: cada celda corrida figura como cambiada;
  - el valor calculado es el que guardo Excel: un libro escrito por un programa (openpyxl) y nunca
    abierto en Excel no tiene valores calculados para sus formulas (figuran vacios);
  - un salto de linea de Windows y uno de Unix adentro de un texto se toman por iguales;
  - una celda con un texto vacio y una celda vacia se toman por iguales (al guardar un libro con un
    programa, las primeras pasan a ser las segundas: para quien lee la hoja no cambio nada).

`leer_libro()` es la lectura que usa tambien `verificar()` de `_xlsxCorregirTexto.py`.
"""
import json
import os
import sys

EXTENSIONES = ('.xlsx', '.xlsm')


def _norm(v):
    """Un texto con saltos de linea de Windows o de Mac vale lo mismo que con los de Unix."""
    return v.replace('\r\n', '\n').replace('\r', '\n') if isinstance(v, str) else v


def leer_libro(ruta, data_only=True):
    """{hoja: {celda: valor}} de un libro, en modo lectura. `data_only=True` trae el valor que Excel
    dejo calculado; `False`, la formula tal como esta escrita. Las celdas vacias no entran."""
    import openpyxl
    wb = openpyxl.load_workbook(ruta, read_only=True, data_only=data_only)
    try:
        out = {}
        for ws in wb.worksheets:
            out[ws.title] = {c.coordinate: c.value for fila in ws.iter_rows() for c in fila
                             if hasattr(c, 'coordinate') and c.value is not None}
        return out
    finally:
        wb.close()


def _plano(v):
    """Para comparar: saltos de linea normalizados, y un texto vacio es una celda vacia."""
    v = _norm(v)
    return None if v == '' else v


def _orden_celda(celda):
    letras = ''.join(ch for ch in celda if ch.isalpha())
    numero = int(''.join(ch for ch in celda if ch.isdigit()) or 0)
    col = 0
    for ch in letras.upper():
        col = col * 26 + (ord(ch) - 64)
    return (numero, col)


def comparar(antes, despues):
    """Compara dos libros. Devuelve {'hojas_agregadas', 'hojas_quitadas', 'cambios': [...]}; cada cambio
    es {'hoja', 'celda', 'que' ('valor' | 'fórmula'), 'antes', 'despues'} y, si cambio la formula,
    tambien 'valor_antes' y 'valor_despues'."""
    fa, fb = leer_libro(antes, data_only=False), leer_libro(despues, data_only=False)
    va, vb = leer_libro(antes, data_only=True), leer_libro(despues, data_only=True)
    cambios = []
    for hoja in fa:                                   # en el orden del libro de antes
        if hoja not in fb:
            continue
        for celda in sorted(set(fa[hoja]) | set(fb[hoja]) | set(va[hoja]) | set(vb[hoja]), key=_orden_celda):
            f1, f2 = _plano(fa[hoja].get(celda)), _plano(fb[hoja].get(celda))
            v1, v2 = _plano(va[hoja].get(celda)), _plano(vb[hoja].get(celda))
            es_formula = any(isinstance(f, str) and f.startswith('=') for f in (f1, f2))
            if f1 != f2:
                if es_formula:
                    cambios.append({'hoja': hoja, 'celda': celda, 'que': 'fórmula', 'antes': f1, 'despues': f2,
                                    'valor_antes': v1, 'valor_despues': v2})
                else:
                    cambios.append({'hoja': hoja, 'celda': celda, 'que': 'valor', 'antes': f1, 'despues': f2})
            elif v1 != v2:                            # la misma formula con otro resultado guardado
                cambios.append({'hoja': hoja, 'celda': celda, 'que': 'valor', 'antes': v1, 'despues': v2})
    return {
        'hojas_agregadas': [h for h in fb if h not in fa],
        'hojas_quitadas': [h for h in fa if h not in fb],
        'cambios': cambios,
    }


def _mostrar(v):
    if v is None:
        return '(vacía)'
    if isinstance(v, str):
        return '«%s»' % v.replace('\n', ' ⏎ ').replace('|', '\\|')
    return str(v)


def en_texto(r, antes, despues):
    lineas = ['ANTES:   %s' % antes, 'DESPUÉS: %s' % despues, '']
    for h in r['hojas_quitadas']:
        lineas.append('Hoja QUITADA (está solo en el de antes): %s' % h)
    for h in r['hojas_agregadas']:
        lineas.append('Hoja AGREGADA (está solo en el de después): %s' % h)
    if r['hojas_quitadas'] or r['hojas_agregadas']:
        lineas.append('')
    if not r['cambios']:
        lineas.append('Sin diferencias en las celdas de las hojas que están en los dos libros.')
    else:
        lineas += ['| Hoja | Celda | Qué cambió | Antes | Después |', '|---|---|---|---|---|']
        for c in r['cambios']:
            a, d = _mostrar(c['antes']), _mostrar(c['despues'])
            if c['que'] == 'fórmula' and c.get('valor_antes') != c.get('valor_despues'):
                a += ' (daba %s)' % _mostrar(c.get('valor_antes'))
                d += ' (da %s)' % _mostrar(c.get('valor_despues'))
            lineas.append('| %s | %s | %s | %s | %s |' % (c['hoja'].replace('|', '\\|'), c['celda'], c['que'], a, d))
        lineas += ['', '%d celda(s) distinta(s).' % len(r['cambios'])]
    lineas += ['', 'Se compararon las fórmulas y los valores calculados. No se comparan formatos, celdas '
               'combinadas, comentarios ni imágenes.']
    return '\n'.join(lineas)


def main(argv):
    conocidos = ('--json',)
    rutas = [a for a in argv if not a.startswith('--')]
    raros = [a for a in argv if a.startswith('--') and a not in conocidos]
    if raros or len(rutas) != 2:
        print('No hago nada: %s.\nuso: python scripts/_xlsxComparar.py <antes.xlsx> <despues.xlsx> [--json]'
              % ('no conozco %s' % ', '.join(raros) if raros else 'van dos archivos, el de antes y el de después'))
        return 2
    antes, despues = rutas
    for r in (antes, despues):
        if not os.path.isfile(r):
            print('No existe el archivo: %s' % r)
            return 2
        if not r.lower().endswith(EXTENSIONES):
            print('No es un .xlsx ni un .xlsm: %s (un .xls viejo se guarda primero como .xlsx)' % r)
            return 2
    if os.path.realpath(antes).lower() == os.path.realpath(despues).lower():
        print('Los dos son el mismo archivo: %s' % antes)
        return 2
    try:
        r = comparar(antes, despues)
    except Exception as e:                                # un libro roto o con clave
        print('No pude leer uno de los dos libros: %s' % e)
        return 2
    distintos = bool(r['cambios'] or r['hojas_agregadas'] or r['hojas_quitadas'])
    if '--json' in argv:
        print(json.dumps({'antes': antes, 'despues': despues, 'iguales': not distintos, **r},
                         ensure_ascii=False, indent=1, default=str))
    else:
        print(en_texto(r, antes, despues))
    return 1 if distintos else 0


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
    sys.exit(main(sys.argv[1:]))
