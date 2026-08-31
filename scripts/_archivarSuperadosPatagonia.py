# -*- coding: utf-8 -*-
"""_archivarSuperadosPatagonia.py — manda a OBSOLETO\\ los AMFE que quedaron a la vista en
el legajo del cliente despues de ser reemplazados.

QUE ARCHIVA Y POR QUE

1. `AMFE DUCTOS REVA-4.xlsx` (21/08/2026) — legajo de VW, carpeta de insonos/ductos.
   Lo reemplazo el AMFE 172, emitido el 24/08/2026, que se rederivo entero al estandar de
   la casa en vez de parcharlo.

2. `AMFE - IP PAD REV.pdf` (03/07/2026) — legajo de VW, IP PADs. Convive con el
   `AMFE 149 - TRIM ASM-UPR WRAPPING - Rev.A.pdf` vigente en la misma carpeta.

Los dos son documentos superados en un casillero de PPAP que mira el cliente: quien abre la
carpeta ve dos AMFE y no sabe cual manda.

CONVENCION (la del maestro de Gestion Ingenieria): lo reemplazado se MUEVE a `OBSOLETO\\`
agregando la fecha de baja entre parentesis. No se borra nada.

Uso:  python scripts/_archivarSuperadosPatagonia.py            (dry-run: solo el plan)
      python scripts/_archivarSuperadosPatagonia.py --apply
"""
import os
import shutil
import sys
from datetime import date

PPAP = r'Y:\BARACK\CALIDAD\DOCUMENTACION SGC\PPAP CLIENTES'
VW427 = os.path.join(PPAP, 'VW', 'VW427-1LA_K-PATAGONIA')

SUPERADOS = [
    (os.path.join(VW427, 'Insonos ductos de calefaccion', '1-APQP', '22- FMEA de proceso'),
     'AMFE DUCTOS REVA-4.xlsx',
     'reemplazado por el AMFE 172 Rev.A del 24/08/2026'),
    (os.path.join(VW427, 'IP PADs', 'APQP', '22- FMEA de proceso'),
     'AMFE - IP PAD REV.pdf',
     'reemplazado por el AMFE 149 Rev.A'),
]

APLICAR = '--apply' in sys.argv
HOY = date.today().strftime('%d-%m-%Y')


def nombre_libre(carpeta, base, ext):
    """No pisa un archivado previo: agrega -2, -3... como hace _distribuirAmfesPatagonia."""
    cand = f'{base} ({HOY}){ext}'
    n = 2
    while os.path.exists(os.path.join(carpeta, cand)):
        cand = f'{base} ({HOY}-{n}){ext}'
        n += 1
    return cand


plan, problemas = [], []
for carpeta, archivo, motivo in SUPERADOS:
    origen = os.path.join(carpeta, archivo)
    if not os.path.exists(origen):
        problemas.append(f'ya no esta (¿archivado antes?): {origen}')
        continue
    obsoleto = os.path.join(carpeta, 'OBSOLETO')
    base, ext = os.path.splitext(archivo)
    plan.append({
        'origen': origen,
        'obsoleto': obsoleto,
        'destino_nombre': nombre_libre(obsoleto, base, ext) if os.path.isdir(obsoleto) else f'{base} ({HOY}){ext}',
        'crear_obsoleto': not os.path.isdir(obsoleto),
        'motivo': motivo,
        'bytes': os.path.getsize(origen),
    })

print(f'PLAN — {len(plan)} archivo(s) a mover a OBSOLETO\\  (no se borra nada)\n')
for p in plan:
    print(f'  {os.path.basename(p["origen"])}   [{p["bytes"]:,} b]')
    print(f'     {p["motivo"]}')
    print(f'     {p["obsoleto"]}' + ('   (se crea la carpeta)' if p['crear_obsoleto'] else ''))
    print(f'     -> {p["destino_nombre"]}')
if problemas:
    print('\n  AVISOS:')
    for x in problemas:
        print(f'    - {x}')

if not plan:
    sys.exit(0)
if not APLICAR:
    print('\nDRY-RUN. Agrega --apply para mover.')
    sys.exit(0)

movidos = 0
for p in plan:
    os.makedirs(p['obsoleto'], exist_ok=True)
    destino = os.path.join(p['obsoleto'], p['destino_nombre'])
    shutil.move(p['origen'], destino)
    ok = os.path.exists(destino) and not os.path.exists(p['origen'])
    print(f'  {"OK  " if ok else "FALLO"} {p["destino_nombre"]}  [{os.path.getsize(destino):,} b]' if ok
          else f'  FALLO {p["destino_nombre"]}')
    movidos += ok

print(f'\n=== MOVIDOS {movidos}/{len(plan)} ===')
sys.exit(0 if movidos == len(plan) else 1)
