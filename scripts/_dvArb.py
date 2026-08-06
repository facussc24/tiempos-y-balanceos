# -*- coding: utf-8 -*-
r"""
Valida el digito verificador de los codigos NNN.NNN.NNNN-N del maestro del arb.

Los codigos de proveedor (Sansuy y cia.) llevan DV modulo 11, como el CUIT. Un codigo
que llega tipeado a mano (mail, planilla, WhatsApp) casi nunca cierra si tiene digitos
cambiados de lugar. Esto convierte "me parece que esta mal escrito" en prueba, ANTES de
darlo de alta y quedarte con dos codigos para el mismo material.

    python scripts/_dvArb.py 123.456.7890-0        # valida uno o varios codigos
    python scripts/_dvArb.py --maestro             # revisa todo INSUMOS.TXT
    python scripts/_dvArb.py --maestro --archivo D:\otro\INSUMOS.TXT

Salida: exit 0 si cierran todos, 1 si alguno no cierra.

Origen: 2026-08-05. Pidieron dar de alta un codigo cuyo DV no cerraba. El verificador que
traia correspondia a otro codigo con dos digitos cambiados de lugar, que ya estaba cargado
con el mismo material — crearlo dejaba dos codigos para lo mismo en deposito. Verificado
contra los 45 codigos de ese formato que habia en el maestro: cierran 45/45.
"""
import argparse
import io
import os
import re
import sys

MAESTRO = r'C:\tmp\INSUMOS.TXT'
PAT = re.compile(r'\b(\d{3})\.(\d{3})\.(\d{4})-(\d)\b')


def dv(base10):
    """DV modulo 11 sobre los 10 digitos sin el verificador (pesos 2..9 desde la derecha)."""
    peso, suma = 2, 0
    for d in reversed(base10):
        suma += int(d) * peso
        peso = peso + 1 if peso < 9 else 2
    r = suma % 11
    return 0 if r == 10 else r


def _partes(codigo):
    m = PAT.search(codigo.strip())
    if not m:
        return None
    return m.group(1) + m.group(2) + m.group(3), int(m.group(4))


def validar(codigos):
    fallas = 0
    for c in codigos:
        p = _partes(c)
        if not p:
            print('  %-18s formato no reconocido (se espera NNN.NNN.NNNN-N)' % c)
            fallas += 1
            continue
        base, real = p
        esperado = dv(base)
        if esperado == real:
            print('  %-18s OK' % c)
        else:
            print('  %-18s NO CIERRA — con esos numeros deberia terminar en -%d' % (c, esperado))
            fallas += 1
    return fallas


def revisar_maestro(ruta):
    if not os.path.exists(ruta):
        sys.exit('No encuentro %s.  Exporta el maestro desde el arb (por defecto va a C:\\tmp).' % ruta)
    vistos = {}
    with io.open(ruta, encoding='latin-1') as f:
        for linea in f:
            for m in PAT.finditer(linea):
                vistos[m.group(1) + m.group(2) + m.group(3)] = int(m.group(4))
    mal = [(b, d) for b, d in vistos.items() if dv(b) != d]
    print('archivo   : %s' % ruta)
    print('codigos   : %d' % len(vistos))
    print('cierran   : %d' % (len(vistos) - len(mal)))
    print('NO cierran: %d' % len(mal))
    for b, d in mal:
        print('   %s.%s.%s-%d   deberia terminar en -%d' % (b[:3], b[3:6], b[6:], d, dv(b)))
    return len(mal)


def main():
    ap = argparse.ArgumentParser(
        description='Valida el digito verificador de los codigos del maestro del arb.')
    ap.add_argument('codigos', nargs='*', metavar='CODIGO',
                    help='uno o mas codigos NNN.NNN.NNNN-N')
    ap.add_argument('--maestro', action='store_true', help='revisar todo el maestro')
    ap.add_argument('--archivo', default=MAESTRO, help='ruta del INSUMOS.TXT (default %s)' % MAESTRO)
    a = ap.parse_args()

    if a.maestro:
        sys.exit(1 if revisar_maestro(a.archivo) else 0)
    if not a.codigos:
        ap.print_help()
        sys.exit(0)
    sys.exit(1 if validar(a.codigos) else 0)


if __name__ == '__main__':
    main()
