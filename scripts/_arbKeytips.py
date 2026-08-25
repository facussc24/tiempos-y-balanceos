"""
_arbKeytips.py — LEE los KeyTips del ribbon del arb en vez de adivinarlos.

EL HALLAZGO (25/08/2026, dato de Fak: *"presionando 2 veces alt y la segunda manteniendo
te dice exactamente que teclas presionar para llegar a donde quieras"*).

Los KeyTips NO se ven en una captura con `PrintWindow` de la ventana principal — son
**ventanas top-level propias, de clase `KbxLabelClass`**, una por cada destino, y su TEXTO
es la tecla que hay que apretar. O sea que no hace falta fotografiarlos ni adivinar: se
enumeran y se leen, igual que cualquier control.

Eso corrige lo que decia la skill `arb-operar`, que daba la navegacion por teclado por
imposible ("las teclas sinteticas no abren el menu", "reabrir la ventana requiere una
persona"). El problema nunca fue el teclado: era que no sabiamos QUE tecla mandar, porque
los KeyTips son de dos caracteres (`Y3`, `M1`, `P2`) y estabamos probando de memoria.

Uso:
    python scripts/_arbKeytips.py            # lee los KeyTips que haya en pantalla ahora
    python scripts/_arbKeytips.py --esperar  # espera hasta 20 s a que aparezcan

El Alt lo tiene que apretar una persona: `keybd_event` activa el ribbon pero no dibuja los
KeyTips (medido). Una vez leidos, la tecla SI se puede mandar sintetica.
"""
import ctypes
import sys
import time

u = ctypes.windll.user32
CB = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_void_p, ctypes.c_void_p)


class R(ctypes.Structure):
    _fields_ = [('l', ctypes.c_long), ('t', ctypes.c_long), ('r', ctypes.c_long), ('b', ctypes.c_long)]


def _pids_arb():
    pids = set()

    def cb(h, _):
        n = ctypes.create_unicode_buffer(256)
        u.GetWindowTextW(h, n, 256)
        c = ctypes.create_unicode_buffer(256)
        u.GetClassNameW(h, c, 256)
        if 'ProdWindow' in c.value or 'Producci' in n.value:
            p = ctypes.c_ulong()
            u.GetWindowThreadProcessId(h, ctypes.byref(p))
            pids.add(p.value)
        return True

    u.EnumWindows(CB(cb), 0)
    return pids


def leer():
    """Devuelve [(tecla, x, y)] de los KeyTips visibles, ordenados por posicion."""
    # Sin filtro por PID: `KbxLabelClass` ya es especifico del ribbon del arb, y el filtro
    # por proceso fallaba — los KeyTips los crea un thread cuyo PID no matcheaba la busqueda.
    tips = []

    def cb(h, _):
        c = ctypes.create_unicode_buffer(64)
        u.GetClassNameW(h, c, 64)
        if c.value != 'KbxLabelClass':
            return True
        t = ctypes.create_unicode_buffer(64)
        u.GetWindowTextW(h, t, 64)
        # El texto trae un zero-width joiner pegado; se limpia.
        tecla = t.value.replace('‌', '').replace('​', '').strip()
        if not tecla:
            return True
        r = R()
        u.GetWindowRect(h, ctypes.byref(r))
        tips.append((tecla, r.l, r.t))
        return True

    u.EnumWindows(CB(cb), 0)
    # Arriba->abajo, izquierda->derecha: asi salen en el orden en que se leen en pantalla.
    return sorted(tips, key=lambda x: (x[2] // 20, x[1]))


def acumular(segundos=12.0):
    """Los KeyTips se dibujan de a poco y se destruyen al soltar Alt: una sola lectura agarra
    un subconjunto. Se poletea y se acumula la union."""
    vistos = {}
    fin = time.time() + segundos
    while time.time() < fin:
        for tecla, x, y in leer():
            vistos[(tecla, x, y)] = True
        time.sleep(0.25)
    return sorted(vistos, key=lambda t: (t[2] // 20, t[1]))


def main():
    esperar = '--esperar' in sys.argv
    if esperar:
        print('Apreta Alt, soltar, Alt SOSTENIDO. Acumulando 12 s...\n')
        tips = acumular(12.0)
    else:
        tips = leer()

    if not tips:
        print('No hay KeyTips en pantalla.')
        print('Una persona tiene que apretar Alt, soltar, y Alt de nuevo MANTENIENDOLO.')
        print('(keybd_event activa el ribbon pero no los dibuja — medido 25/08/2026.)')
        return 1

    print('KeyTips en pantalla: %d\n' % len(tips))
    print('  tecla   posicion (pantalla)')
    print('  -----   ------------------')
    for tecla, x, y in tips:
        print('  %-6s  (%4d, %4d)' % (tecla, x, y))
    print('\nLa tecla es el TEXTO. Los de dos caracteres se mandan seguidos (ej: Y luego 3).')
    return 0


if __name__ == '__main__':
    sys.exit(main())
