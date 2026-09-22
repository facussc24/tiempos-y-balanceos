# -*- coding: utf-8 -*-
"""Leer y cambiar la `Unidad` de insumos en el maestro del arb (ABM de Insumos).

    python scripts/_arbUnidad.py --leer COD [COD ...]
    python scripts/_arbUnidad.py --tabla archivo.csv [--apply]   # csv: codigo,unidad_vieja,unidad_nueva

Dry-run por defecto: sin `--apply` trae el registro, lee la unidad y cierra sin grabar.

POR QUE EXISTE (22/09/2026, vinilos Sansuy de Patagonia)
  La unidad vive en el maestro y es UNA sola: la usan la OC y todas las BOM que cuelgan del
  codigo. Cambiarla le cambia la ETIQUETA a esos consumos sin tocar el numero, asi que va en
  la misma tanda que la conversion de los consumos (`_arbCargar.py`), nunca sola.
  Memoria `reference_cambio_de_unidad_pedido_por_compras`.

  Abrir, traer el registro, tabular por posicion y grabar es lo mismo que la descripcion:
  se reusa `_arbDescripcion.py` (probado 3/3 el 01/09). Lo unico propio es el campo.
"""
import csv
import importlib.util
import os
import sys

UNIDAD_XY = (194, 311)      # 'Unidad', relativo a la ventana (tab order medido el 31/08)
_AQUI = os.path.dirname(os.path.abspath(__file__))

_spec = importlib.util.spec_from_file_location('_arbDescripcion',
                                               os.path.join(_AQUI, '_arbDescripcion.py'))
ad = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(ad)


def _traer_unidad(codigo):
    """Deja el registro en pantalla con el foco en Unidad. Devuelve (h, hunidad, desc, unidad)
    o (None, None, motivo, None)."""
    ad.cerrar()
    h = ad.abrir()
    hdesc, desc = ad.traer(h, codigo)
    if not hdesc:
        return None, None, desc, None
    if not desc.strip():
        return None, None, 'el codigo no trajo descripcion: no existe o no se cargo', None
    hu = ad.tabular_hasta(h, UNIDAD_XY)
    if not hu:
        return None, None, 'no llegue al campo Unidad', None
    return h, hu, desc, ad._texto(hu).strip()


def leer(codigo):
    h, hu, desc, unidad = _traer_unidad(codigo)
    ad.cerrar()
    return desc, unidad


def fijar(codigo, vieja, nueva, apply_=False):
    """Devuelve (ok, mensaje). Ante cualquier gate en rojo: WM_CLOSE, no graba."""
    if [x for x in ad.av.ventanas() if ad.av.cls(x) == '#32770']:
        return False, 'hay un modal abierto en el arb'
    h, hu, desc, actual = _traer_unidad(codigo)
    if not hu:
        ad.cerrar()
        return False, desc
    print('   %r  unidad %r -> %r' % (desc.replace('\r\n', ' | '), actual, nueva))
    if actual == nueva:
        ad.cerrar()
        return True, 'ya estaba asi, no toco nada'
    if actual != vieja:
        ad.cerrar()
        return False, 'la unidad dice %r y esperaba %r' % (actual, vieja)
    if not apply_:
        ad.cerrar()
        return True, 'dry-run: no se escribio nada'
    quedo = ad._reemplazar(h, hu, nueva).strip()
    if quedo != nueva:
        ad.cerrar()
        return False, 'la unidad quedo %r y esperaba %r — cerrado SIN GRABAR' % (quedo, nueva)
    return ad.aceptar(h, forzar_papp=False)


def main(argv):
    apply_ = '--apply' in argv
    argv = [a for a in argv if a != '--apply']
    if not argv:
        print(__doc__)
        return 1

    if argv[0] == '--leer':
        for cod in argv[1:]:
            desc, unidad = leer(cod)
            print('%-16s %-6r %r' % (cod, unidad, (desc or '').replace('\r\n', ' | ')))
        return 0

    if argv[0] == '--tabla':
        if len(argv) < 2:
            print('Uso: --tabla archivo.csv [--apply]     (csv: codigo,unidad_vieja,unidad_nueva)')
            return 1
        with open(argv[1], encoding='utf-8-sig', newline='') as fh:
            filas = [r for r in csv.reader(fh) if r and r[0].strip()
                     and r[0].strip().lower() not in ('codigo', 'código')]
        cortas = [r[0].strip() for r in filas if len(r) < 3 or not r[1].strip() or not r[2].strip()]
        if cortas:
            print('ABORTADO: estas filas no traen unidad vieja y nueva: %s' % ', '.join(cortas))
            return 1
        print('%d codigo(s)  |  modo %s\n' % (len(filas), 'APPLY' if apply_ else 'dry-run'))
        malas = []
        for r in filas:
            cod, vieja, nueva = r[0].strip(), r[1].strip().upper(), r[2].strip().upper()
            print(cod)
            ok, msg = fijar(cod, vieja, nueva, apply_)
            print('   %s %s\n' % ('OK  ' if ok else 'FALLO', msg))
            if not ok:
                malas.append((cod, msg))
        print('=' * 60)
        print('%d/%d bien' % (len(filas) - len(malas), len(filas)))
        for c, m in malas:
            print('   PENDIENTE %s: %s' % (c, m))
        print('\nVERIFICAR contra el export (columna Unidad de RELACIONES): la pantalla NO prueba que grabo.')
        return 1 if malas else 0

    print(__doc__)
    return 1


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
