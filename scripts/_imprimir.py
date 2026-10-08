# -*- coding: utf-8 -*-
"""Imprime un PDF en las impresoras de Ingenieria, sin pasar por la cola de Windows.

    python scripts/_imprimir.py <archivo.pdf> [--a3] [--paginas 1-3,7] [--seco]

  (sin --a3)  A4 en la "impresora para ingenieria" (Ricoh SP 3710SF, 192.168.1.105), blanco y negro.
  --a3        A3 color en la "impresora de arriba" (RICOH MP C2004, 192.168.1.104): los FLUJOGRAMAS van aca.
  --paginas   solo esas paginas (1 = la primera).
  --seco      arma el archivo de impresion y una vista previa PNG de la primera hoja, y NO manda nada.

Como: Ghostscript (el que trae PDFCreator) convierte el PDF a PCL XL ajustando cada pagina al
papel (gira la hoja si hace falta) y los bytes van crudos al puerto 9100. La C2004 esta instalada
en Windows por WSD con el driver V4, el combo que traba la cola; por eso se imprime sin Windows.
La IP 192.168.1.70 contesta como C2004 pero es otra entrada de la MISMA maquina (07/10/2026: una
hoja a cada IP salieron las dos arriba). Despues de mandar, lee el contador de paginas por SNMP:
que el trabajo salga de la PC no dice que la impresora lo imprimio
(memoria reference_impresoras_ricoh_red_barack).
"""
import argparse
import os
import socket
import subprocess
import sys
import tempfile
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _impresoraEstado import get as snmp_get  # noqa: E402

GS = r'C:\Program Files\PDFCreator\Ghostscript\Bin\gswin32c.exe'
IMPRESORAS = {
    'a4': {'ip': '192.168.1.105', 'nombre': 'impresora para ingenieria (SP 3710SF)', 'device': 'pxlmono', 'papel': 'a4'},
    'a3': {'ip': '192.168.1.104', 'nombre': 'impresora de arriba (RICOH MP C2004)', 'device': 'pxlcolor', 'papel': 'a3'},
}
OID_PAGINAS = '1.3.6.1.2.1.43.10.2.1.4.1.1'


def rango_paginas(texto):
    """'1-3,7' -> (1, 3) y 7 como lista de numeros. Ghostscript recibe -sPageList tal cual."""
    for parte in texto.split(','):
        a, _, b = parte.partition('-')
        if not a.strip().isdigit() or (b and not b.strip().isdigit()):
            raise SystemExit('--paginas mal escrito: %r (ejemplo: 1-3,7)' % texto)
    return texto.replace(' ', '')


def convertir(pdf, imp, paginas, destino, device=None):
    args = [GS, '-q', '-dBATCH', '-dNOPAUSE', '-dSAFER', '-sDEVICE=' + (device or imp['device']),
            '-sPAPERSIZE=' + imp['papel'], '-dFIXEDMEDIA', '-dPDFFitPage', '-dAutoRotatePages=/PageByPage']
    if device == 'png16m':
        args += ['-r40', '-dFirstPage=1', '-dLastPage=1']
    else:
        # a 600 dpi una hoja A3 color pesa ~190 MB; a 300 se lee igual y pesa la cuarta parte
        args.append('-r300' if imp['device'] == 'pxlcolor' else '-r600')
        if paginas:
            args.append('-sPageList=' + paginas)
    args += ['-sOutputFile=' + destino, pdf]
    r = subprocess.run(args, capture_output=True, text=True)
    if r.returncode != 0 or not os.path.exists(destino) or os.path.getsize(destino) == 0:
        raise SystemExit('Ghostscript fallo (%s): %s' % (r.returncode, (r.stderr or r.stdout)[-400:]))


def contador(ip):
    v = snmp_get(ip, OID_PAGINAS)
    return v if isinstance(v, int) else None


def main():
    ap = argparse.ArgumentParser(description='Imprime un PDF en la impresora para ingenieria (A4) o en la impresora de arriba (A3).')
    ap.add_argument('pdf')
    ap.add_argument('--a3', action='store_true', help='A3 color en la impresora de arriba (C2004)')
    ap.add_argument('--paginas', help='por ejemplo 1-3,7')
    ap.add_argument('--seco', action='store_true', help='no manda nada: arma el archivo y una vista previa')
    a = ap.parse_args()

    if not os.path.exists(a.pdf):
        raise SystemExit('No existe: %s' % a.pdf)
    # Ningun documento dice que lo hizo Claude o una IA (regla dura de Fak, 08/10/2026): no se imprime.
    sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '_lib'))
    import firmaIA
    firmaIA.exigir_sin_firma([a.pdf], 'imprimir')
    if not os.path.exists(GS):
        raise SystemExit('Falta Ghostscript en %s (viene con PDFCreator)' % GS)
    imp = IMPRESORAS['a3' if a.a3 else 'a4']
    paginas = rango_paginas(a.paginas) if a.paginas else None

    tmp = tempfile.mkdtemp(prefix='imprimir_')
    pxl = os.path.join(tmp, 'trabajo.pxl')
    convertir(a.pdf, imp, paginas, pxl)
    print('Archivo de impresion: %s (%d KB) -> %s %s' % (pxl, os.path.getsize(pxl) // 1024, imp['nombre'], imp['ip']))

    if a.seco:
        png = os.path.join(tmp, 'vista_previa.png')
        convertir(a.pdf, imp, None, png, device='png16m')
        print('Vista previa de la primera hoja: %s' % png)
        print('SECO: no se mando nada.')
        return

    antes = contador(imp['ip'])
    with socket.create_connection((imp['ip'], 9100), timeout=30) as s:
        with open(pxl, 'rb') as f:
            s.sendall(f.read())
    print('Mandado. Contador antes: %s' % antes)
    if antes is None:
        print('No pude leer el contador: mirar la bandeja.')
        return
    # el contador tarda; se lee hasta que deja de subir
    ultimo, quieto = antes, 0
    for _ in range(60):
        time.sleep(5)
        ahora = contador(imp['ip'])
        if ahora is None:
            continue
        if ahora == ultimo and ahora > antes:
            quieto += 1
            if quieto >= 3:
                break
        else:
            quieto = 0
        ultimo = ahora
    print('Contador despues: %s  ->  %s hojas impresas' % (ultimo, ultimo - antes))


if __name__ == '__main__':
    main()
