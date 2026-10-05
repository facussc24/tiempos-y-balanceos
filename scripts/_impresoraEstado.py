# -*- coding: utf-8 -*-
"""Estado de una impresora de red por SNMP v1: contador de paginas, texto del panel, estado y errores.

    python scripts/_impresoraEstado.py [ip]      # por defecto la de Fak, 192.168.1.105

Una impresion se verifica con el contador (sube 1 por hoja), no con la cola de Windows
(memoria reference_impresoras_ricoh_red_barack).
"""
import socket
import sys

OIDS = {
    'paginas': '1.3.6.1.2.1.43.10.2.1.4.1.1',
    'panel': '1.3.6.1.2.1.43.16.5.1.2.1.1',
    'estado': '1.3.6.1.2.1.25.3.5.1.1.1',
    'errores': '1.3.6.1.2.1.25.3.5.1.2.1',
}


def _len(n):
    return bytes([n]) if n < 128 else bytes([0x81, n])


def _tlv(t, v):
    return bytes([t]) + _len(len(v)) + v


def _oid(s):
    p = [int(x) for x in s.split('.')]
    out = bytes([p[0] * 40 + p[1]])
    for n in p[2:]:
        b = [n & 0x7F]
        n >>= 7
        while n:
            b.insert(0, (n & 0x7F) | 0x80)
            n >>= 7
        out += bytes(b)
    return out


def _leer(buf, i):
    t = buf[i]
    n = buf[i + 1]
    i += 2
    if n & 0x80:
        k = n & 0x7F
        n = int.from_bytes(buf[i:i + k], 'big')
        i += k
    return t, buf[i:i + n], i + n


def get(ip, oid, espera=3):
    varbind = _tlv(0x30, _tlv(0x06, _oid(oid)) + _tlv(0x05, b''))
    pdu = _tlv(0xA0, _tlv(0x02, b'\x01') + _tlv(0x02, b'\x00') + _tlv(0x02, b'\x00') + _tlv(0x30, varbind))
    msg = _tlv(0x30, _tlv(0x02, b'\x00') + _tlv(0x04, b'public') + pdu)
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.settimeout(espera)
    try:
        s.sendto(msg, (ip, 161))
        data = s.recvfrom(4096)[0]
    except OSError as e:
        return 'SIN RESPUESTA (%s)' % e
    finally:
        s.close()
    _, cuerpo, _ = _leer(data, 0)
    i = 0
    for _ in range(2):                      # version, community
        _, _, i = _leer(cuerpo, i)
    _, pdu, _ = _leer(cuerpo, i)
    i = 0
    for _ in range(3):                      # request-id, error, index
        _, _, i = _leer(pdu, i)
    _, lista, _ = _leer(pdu, i)
    _, vb, _ = _leer(lista, 0)
    _, _, j = _leer(vb, 0)
    t, v, _ = _leer(vb, j)
    if t in (0x02, 0x41, 0x42, 0x43):
        return int.from_bytes(v, 'big')
    if t == 0x04:
        try:
            txt = v.decode('latin-1')
            return txt if txt.isprintable() else v.hex()
        except Exception:
            return v.hex()
    return v.hex()


if __name__ == '__main__':
    ip = sys.argv[1] if len(sys.argv) > 1 else '192.168.1.105'
    for nombre, oid in OIDS.items():
        print('%-8s %s' % (nombre, get(ip, oid)))
