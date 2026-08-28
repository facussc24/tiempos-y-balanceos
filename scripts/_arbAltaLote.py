# -*- coding: utf-8 -*-
"""Dar de ALTA la misma linea en la BOM de VARIOS productos, en una corrida.

    python scripts/_arbAltaLote.py --tabla <csv> [--apply]

El CSV lleva encabezado y una fila por producto terminado:

    producto,insumo,cantidad,modulo,proceso

Es el envoltorio de lote de `_arbAlta.py`, que hace UNA linea por invocacion. Cada alta
conserva todos sus gates (renglon vacio, verificacion celda por celda, foto antes de
grabar); lo que agrega este script es lo que hacia falta repetir a mano entre producto y
producto:

  · abre la ventana `Maestro de Relaciones` si no esta;
  · **despues de cada fallo resetea** (`WM_CLOSE` + reapertura) antes de seguir: una celda
    sucia sobrevive a reabrir el producto y envenena todas las altas siguientes;
  · sigue con el resto del lote en vez de cortar, y al final lista lo que quedo pendiente.

Un alta NO se deshace tipeando el valor viejo: sin `--apply` es dry-run (escribe el renglon
en pantalla, saca la foto y descarta con el reset).

Este repo es PUBLICO: el CSV con los codigos reales va a `.arb-cache/` (gitignoreado).
"""
import argparse
import csv
import importlib.util
import os
import sys
import time

_DIR = os.path.dirname(os.path.abspath(__file__))


def _mod(nombre, archivo):
    spec = importlib.util.spec_from_file_location(nombre, os.path.join(_DIR, archivo))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


ac = _mod('ac', '_arbCargar.py')
av = _mod('av', '_arbVer.py')
aa = _mod('aa', '_arbAlta.py')

COLS = ('producto', 'insumo', 'cantidad', 'modulo', 'proceso')


def leer_tabla(path):
    with open(path, newline='', encoding='utf-8-sig') as fh:
        filas = [r for r in csv.DictReader(fh)]
    if not filas:
        sys.exit('la tabla %s esta vacia' % path)
    faltan = [c for c in COLS if c not in filas[0]]
    if faltan:
        sys.exit('a la tabla le faltan columnas: %s' % ', '.join(faltan))
    return [{c: (f[c] or '').strip() for c in COLS} for f in filas]


def asegurar_ventana():
    """Devuelve la ventana `Maestro de Relaciones`, abriendola si hace falta."""
    v = ac.V()
    if v:
        return v
    return ac.abrir()


def main():
    ap = argparse.ArgumentParser(description='Alta de la misma linea en varias BOM')
    ap.add_argument('--tabla', required=True)
    ap.add_argument('--apply', action='store_true', help='sin esto es dry-run')
    ap.add_argument('--reset-primero', action='store_true',
                    help='resetear la ventana antes de arrancar (si quedo sucia)')
    a = ap.parse_args()

    filas = leer_tabla(a.tabla)
    if not asegurar_ventana():
        sys.exit('no encuentro ni pude abrir la ventana `Maestro de Relaciones`')
    if a.reset_primero and av.reset_relaciones() != 0:
        sys.exit('no pude resetear la ventana antes de arrancar (nada escrito)')

    print('%d alta(s).  %s.  NO TOQUES LA PC mientras corre.'
          % (len(filas), 'APPLY' if a.apply else 'DRY-RUN'))
    print('=' * 74)
    t0, res = time.time(), []
    for i, f in enumerate(filas, 1):
        print('\n--- %d/%d  %s' % (i, len(filas), f['producto']))
        try:
            if not asegurar_ventana():
                raise SystemExit('se perdio la ventana `Maestro de Relaciones`')
            aa.alta(f['producto'], f['insumo'], f['cantidad'], f['modulo'], f['proceso'],
                    apply=a.apply)
            res.append((f['producto'], True, ''))
        except SystemExit as e:
            motivo = str(e)
            res.append((f['producto'], False, motivo))
            print('FALLO: %s' % motivo)
        except Exception as e:                                  # noqa: BLE001
            motivo = '%s: %s' % (type(e).__name__, e)
            res.append((f['producto'], False, motivo))
            print('FALLO: %s' % motivo)
        # Reset SIEMPRE que no se haya grabado: en dry-run el renglon queda escrito en
        # pantalla, y despues de un fallo la celda sucia envenenaria la proxima alta.
        if not a.apply or not res[-1][1]:
            if av.reset_relaciones() != 0:
                print('no pude dejar la ventana limpia: corto el lote aca')
                break

    ok = sum(1 for r in res if r[1])
    seg = time.time() - t0
    print('\n' + '=' * 74)
    print('%s: %d de %d   (%.0f seg)'
          % ('GRABADAS' if a.apply else 'DRY-RUN OK', ok, len(filas), seg))
    for prod, bien, msg in res:
        if not bien:
            print('   PENDIENTE %-16s %s' % (prod, msg))
    if a.apply:
        print('\nEsto NO prueba que se grabo: re-exporta RELACIONES y verifica contra el export.')
    return 0 if ok == len(filas) else 1


if __name__ == '__main__':
    sys.exit(main())
