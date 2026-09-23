# -*- coding: utf-8 -*-
"""Deja la BOM ULTIMO NIVEL del arb en el legajo APQP de una familia (casillero 7).

    python scripts/_bomLegajo.py --lista
    python scripts/_bomLegajo.py <familia> --fecha dd/mm/aaaa --act "..." [--act ...] [--apply]
    python scripts/_bomLegajo.py <familia> ... --legajo <carpeta>     # otra carpeta (pruebas)

Dry-run por defecto: dice que archivo crea y cuales pasan a Obsoleto, sin tocar nada.

POR QUE EXISTE (Fak, 22/09/2026)
  *"cada vez que modificamos la bom... la bom ultimo nivel ahi en el apqp... sino siempre me va
  a quedar desactualizado el apqp"*. Decidido ese dia: casillero 7, en la subcarpeta de BOM que
  ya tiene el legajo, y la anterior a su Obsoleto. En el legajo queda UNA sola: la ultima.

  - El PDF es de la familia ENTERA (todas sus piezas, de `_lib/bomLegajos.data.json`), no solo
    de las que cambiaron: lo que se archiva es el estado, no la modificacion.
  - Lo arma `_pdfBomArb.py` desde el export (`C:\\tmp\\RELACIONES.TXT`) con sus 6 gates: correrlo
    despues de cargar Y de re-exportar, igual que el PDF de difusion (skill `carga-arb` §4).
  - Nada se borra: el anterior se MUEVE a la carpeta obsoleta que ya exista en la subcarpeta
    (`Obsoleto`, `Obsoletos`, `0_Obsoleto`...) o a una `Obsoleto` nueva.
"""
import argparse
import glob
import json
import os
import shutil
import subprocess
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
DATOS = os.path.join(AQUI, '_lib', 'bomLegajos.data.json')
PREFIJO = 'BOM ARB ultimo nivel_'
TOPE_RUTA = 259             # mas largo no abre en Windows (memoria max_path_260)


def cargar():
    with open(DATOS, encoding='utf-8') as fh:
        return json.load(fh)['familias']


def carpeta_obsoleta(legajo):
    for n in sorted(os.listdir(legajo)):
        if 'obsolet' in n.lower() and os.path.isdir(os.path.join(legajo, n)):
            return os.path.join(legajo, n), False
    return os.path.join(legajo, 'Obsoleto'), True


def destino_libre(carpeta, nombre):
    base, ext = os.path.splitext(nombre)
    p, i = os.path.join(carpeta, nombre), 2
    while os.path.exists(p):
        p = os.path.join(carpeta, '%s (%d)%s' % (base, i, ext))
        i += 1
    return p


def main(argv):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('familia', nargs='?')
    ap.add_argument('--lista', action='store_true')
    ap.add_argument('--fecha')
    ap.add_argument('--act', action='append', default=[])
    ap.add_argument('--legajo', help='otra carpeta destino (para probar)')
    ap.add_argument('--relaciones')
    ap.add_argument('--apply', action='store_true')
    a = ap.parse_args(argv)
    fams = cargar()
    if a.lista or not a.familia:
        for k, v in fams.items():
            print('%-13s %2d piezas  %s' % (k, len(v['piezas']), v['legajo']))
        return 0
    if a.familia not in fams:
        print('ABORTADO: familia %r no esta en %s. Hay: %s' % (a.familia, DATOS, ', '.join(fams)))
        return 1
    if not a.fecha or not a.act:
        print('ABORTADO: --fecha y al menos un --act (el bloque ACTUALIZACIONES del PDF)')
        return 1
    fam = fams[a.familia]
    legajo = a.legajo or fam['legajo']
    if not os.path.isdir(legajo):
        print('ABORTADO: no existe la carpeta del legajo:\n   %s' % legajo)
        return 1
    d, m, y = a.fecha.split('/')
    nombre = '%s%s_%s%s%s.pdf' % (PREFIJO, a.familia, y, m, d)
    salida = os.path.join(legajo, nombre)
    if len(salida) > TOPE_RUTA:
        print('ABORTADO: la ruta mide %d caracteres (tope %d)' % (len(salida), TOPE_RUTA))
        return 1
    viejos = [p for p in glob.glob(os.path.join(legajo, PREFIJO + a.familia + '_*.pdf'))
              if os.path.basename(p) != nombre]
    obs, nueva = carpeta_obsoleta(legajo)
    largos = [p for p in viejos if len(os.path.join(obs, os.path.basename(p))) + 5 > TOPE_RUTA]
    if largos:     # +5: el sufijo " (N)" si hay que desempatar el nombre
        print('ABORTADO: en Obsoleto la ruta pasaria de %d caracteres: %s' % (TOPE_RUTA, largos))
        return 1

    print('familia  : %s (%d piezas)' % (a.familia, len(fam['piezas'])))
    print('crea     : %s' % salida)
    if os.path.exists(salida):
        print('           (ya existe con ese nombre: se regenera encima, es la misma fecha)')
    for p in viejos:
        print('a obsoleto: %s  ->  %s%s' % (os.path.basename(p), obs, '  (carpeta nueva)' if nueva else ''))
    if not a.apply:
        print('\ndry-run: no se toco nada. Agregar --apply.')
        return 0

    cmd = [sys.executable, os.path.join(AQUI, '_pdfBomArb.py'), '--piezas', ','.join(fam['piezas']),
           '--fecha', a.fecha, '--salida', salida]
    for t in a.act:
        cmd += ['--act', t]
    if a.relaciones:
        cmd += ['--relaciones', a.relaciones]
    r = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace')
    print(r.stdout[-600:])
    if r.returncode != 0 or not os.path.exists(salida):
        print('ABORTADO: _pdfBomArb.py no genero el PDF (el anterior NO se movio).\n%s' % r.stderr[-800:])
        return 1
    # recien con el nuevo en su lugar se mueve el anterior: nunca queda el legajo sin BOM
    for p in viejos:
        os.makedirs(obs, exist_ok=True)
        dst = destino_libre(obs, os.path.basename(p))
        shutil.move(p, dst)
        print('movido   : %s' % dst)
    quedan = glob.glob(os.path.join(legajo, PREFIJO + a.familia + '_*.pdf'))
    if [os.path.basename(q) for q in quedan] != [nombre]:
        print('OJO: en el legajo quedaron %s' % [os.path.basename(q) for q in quedan])
        return 1
    print('OK: en el legajo queda una sola BOM ultimo nivel de %s: %s' % (a.familia, nombre))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
