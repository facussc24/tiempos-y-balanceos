# -*- coding: utf-8 -*-
"""El renglon que un emisor de Python deja en la ficha de configuracion de la pieza (tanda 13 item 1).

Lo llaman `_emitirApqp.py` (flujograma y AMFE al servidor) y `_bomLegajo.py` (BOM ultimo nivel al
legajo) DESPUES de una emision que salio bien. Hay un solo escritor de la ficha, el comando de node
(`scripts/_fichaPieza.mjs --registrar`): aca solo se lo llama.

Nunca frena al emisor: si node no esta, tarda mas de un minuto o sale con error, se dice en un renglon
y la emision queda como estaba (ya se copio y se verifico). Lo que falto registrar lo levanta el
proximo `node scripts/_fichaPieza.mjs --relevar <pieza>`.
"""
import os
import subprocess

AQUI = os.path.dirname(os.path.abspath(__file__))
CLI = os.path.join(os.path.dirname(AQUI), '_fichaPieza.mjs')
TOPE_SEGUNDOS = 60


def registrar_en_ficha(campos, decir=print, correr=subprocess.run):
    """campos: dict con tipo y nombre (o numero y letra), destino, fecha, quien, familia.
    Devuelve True si quedo registrado o no habia ficha; False si fallo (y lo dijo)."""
    args = ['node', CLI, '--registrar']
    for clave in ('tipo', 'nombre', 'numero', 'letra', 'destino', 'fecha', 'quien', 'familia'):
        valor = campos.get(clave)
        if valor:
            args += ['--' + clave, str(valor)]
    try:
        r = correr(args, capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=TOPE_SEGUNDOS)
    except (OSError, subprocess.SubprocessError) as err:
        decir('  ficha de la pieza: no se pudo registrar (%s); la emision ya quedo hecha. '
              'Despues: node scripts/_fichaPieza.mjs --relevar <pieza>' % err)
        return False
    salida = (r.stdout or '').strip()
    if r.returncode != 0:
        decir('  ficha de la pieza: el registro salio con %s (%s); la emision ya quedo hecha'
              % (r.returncode, (r.stderr or salida).strip()[-200:]))
        return False
    for renglon in salida.splitlines():
        decir('  ' + renglon)
    return True
