# -*- coding: utf-8 -*-
"""El gerente de Ingenieria va SIEMPRE en el mail, como minimo en copia.

Regla dura de Fak, 02/10/2026, despues de que un mail a Compras saliera solo para el que lo
habia pedido: *"siempre pone a Carlos en copia, es mi gerente... minimo en copia debe estar"*,
*"el debe saber que Sebas me pide cosas"*.

Dos puntas, las dos usan este archivo:
  - los que ARMAN el borrador (`_prepararMail.py`, `_mailResponder.py`, `_reenviarMail.py`)
    llaman a `asegurar_gerente(item)`: si Carlos no esta, lo agrega en CC;
  - el que ENVIA (`_mailEnviar.py`) llama a `falta_gerente(direcciones)` y aborta si no esta,
    salvo `--sin-gerente` (solo con el OK de Fak para ESE mail).

    python scripts/_lib/gerenteCopia.py --selftest
"""
import sys

GERENTE_NOMBRE = 'Carlos Baptista'
GERENTE_SMTP = 'cbaptista@barackmercosul.com'      # 5.571 apariciones en el cache de mails


def es_gerente(nombre='', smtp=''):
    """True si ese destinatario es el gerente. Manda la casilla; el nombre mostrado solo vale
    cuando la casilla todavia no se resolvio (un borrador recien armado)."""
    s = (smtp or '').strip().lower()
    if '@' in s:
        return s == GERENTE_SMTP
    n = ' '.join((nombre or '').lower().split())
    return n == GERENTE_NOMBRE.lower() or n == GERENTE_SMTP


def falta_gerente(direcciones):
    """`direcciones` = [(nombre, smtp)] con la casilla REAL de cada destinatario (miembros de
    una lista incluidos). True si el gerente no esta en ninguna."""
    return not any(es_gerente(n, d) for n, d in direcciones)


def asegurar_gerente(item, sin_gerente=False):
    """Sobre un item de Outlook ya armado: si el gerente no esta entre los destinatarios, lo
    agrega en CC (con `Recipients.Add`, nunca como string en `.CC`: regla mail-envio.md).
    Devuelve True si lo agrego. Se llama ANTES del `ResolveAll()` del que arma."""
    if sin_gerente:
        print('  (sin_gerente: %s NO va en este mail — solo con el OK de Fak)' % GERENTE_NOMBRE)
        return False
    for k in range(item.Recipients.Count):
        r = item.Recipients.Item(k + 1)
        smtp = ''
        try:
            eu = r.AddressEntry.GetExchangeUser()
            smtp = eu.PrimarySmtpAddress if eu else ''
        except Exception:
            smtp = ''
        if es_gerente(str(r.Name or ''), smtp):
            return False
    item.Recipients.Add(GERENTE_NOMBRE).Type = 2          # olCC
    print('  + %s en copia (regla de Fak 02/10/2026: el gerente va siempre)' % GERENTE_NOMBRE)
    return True


def selftest():
    casos = [
        ('solo el que pidio: falta', falta_gerente([('Sebastian Rios', 'srios@barackmercosul.com')]), True),
        ('Carlos en copia: no falta', falta_gerente([('Sebastian Rios', 'srios@barackmercosul.com'),
                                                    ('Carlos Baptista', 'cbaptista@barackmercosul.com')]), False),
        ('la casilla con mayusculas vale', falta_gerente([('x', 'CBaptista@BarackMercosul.com')]), False),
        ('otro Baptista no es el gerente', falta_gerente([('Carlos Baptista', 'otro.baptista@barackmercosul.com')]), True),
        ('dominio parecido no vale', falta_gerente([('Carlos Baptista', 'cbaptista@barackmercosul.com.ar')]), True),
        ('sin destinatarios: falta', falta_gerente([]), True),
        ('sin casilla resuelta manda el nombre', es_gerente('Carlos  Baptista', ''), True),
        ('nombre parecido sin casilla no vale', es_gerente('Carlos Baptista Jr', ''), False),
        ('casilla tipeada a mano en el nombre', es_gerente('cbaptista@barackmercosul.com', ''), True),
    ]
    mal = [c for c in casos if c[1] != c[2]]
    for nombre, obt, esp in casos:
        print('  %s %s' % ('OK  ' if obt == esp else '*** FALLA', nombre))
    print('\nselftest: %d/%d' % (len(casos) - len(mal), len(casos)))
    return 1 if mal else 0


if __name__ == '__main__':
    if '--selftest' in sys.argv:
        sys.exit(selftest())
    sys.exit(__doc__)
