# -*- coding: utf-8 -*-
"""Maestro de ARTICULOS del arb (`Maestro de Productos Terminados - BA`): dar de alta un
semielaborado como articulo, leer su ficha, exportar el maestro y salir de la ventana.

    python scripts/_arbArticulo.py abrir                       # desde `Producción`, con Relaciones CERRADA
    python scripts/_arbArticulo.py alta COD "DESCRIPCION" [--apply]
    python scripts/_arbArticulo.py leer COD [COD ...]
    python scripts/_arbArticulo.py export                      # deja C:\\tmp\\ARTICULO.TXT
    python scripts/_arbArticulo.py salir                       # solapa Escape + `Sí`
    python scripts/_arbArticulo.py salir-relaciones            # lo mismo sobre Maestro de Relaciones
    python scripts/_arbArticulo.py omitir                      # cartel de Visual C++ -> `Omitir`

POR QUE EXISTE (05/10/2026, semielaborado plastico + PU del apoyabrazo de puerta)
  Un semielaborado con BOM propia va dado de alta en DOS maestros: como INSUMO
  (`_arbInsumoCampos.py --alta`, Es Sub-Producto S) y como ARTICULO con `Es Subproducto = S`.
  Sin el articulo, Relaciones contesta `Artículo No Existe` y no deja cargarle la BOM
  (Fak: "semielaborados deben ser también producto"). El 05/10 se hizo con un script de
  prueba (4/4); el 06/10, con el Insert y el IP Pad, paso al repo.

LO QUE NO SE VE LEYENDO EL CODIGO
  - El alta copia la ficha del hermano `INY-APB0001-V1` (leida el 05/10/2026): Linea 095,
    Unidad UNID, Doble Medida N, Es Subproducto S, Stock Negativo N, Fabricacion Propia S,
    Cliente 95. En `Altas` los flags nacen en N y los numericos en 0.0000.
  - Los campos se reconocen por POSICION dentro de la ventana, y cada uno se verifica antes
    de tabular al siguiente. A la primera diferencia se corta SIN grabar.
  - Sin `--apply` llena la pantalla, deja el foco en `&Acepta` y saca la foto: no graba.
    Con `--apply` aprieta ENTER solo si el foco esta en `&Acepta` habilitado.
  - Las salidas son las del propio programa (solapa `Escape` -> cartel `Desea Finalizar ??`
    -> click real en `Sí`). Cerrar Relaciones de otra forma crashea el arb (regla
    `arb-no-cerrar.md`).
  - El export usa el mismo gate que `_arbVer.export()`: el combo `Salida` tiene que quedar
    en 3 (Tabla EXcel) antes del ENTER; en 1 es la impresora de la oficina.
"""
import ctypes
import os
import shutil
import sys
import time

_AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _AQUI)
import _arbInsumo as ai  # noqa: E402
import _arbVer as av  # noqa: E402

u, k = av.u, av.k
TITULO = 'Productos Terminados'
ARTICULO_TXT = r'C:\tmp\ARTICULO.TXT'
TOPE_DESC = 40

# (posicion del campo, valor) en orden de TAB, copiado del hermano INY-APB0001-V1
PLAN = [((184, 226), '095'), ((184, 254), ''), ((184, 283), 'UNID'),
        ((487, 283), 'N'), ((184, 311), ''), ((487, 311), ''), ((184, 340), 'S'),
        ((487, 340), 'N'), ((184, 368), 'S'), ((184, 397), ''), ((487, 397), ''),
        ((623, 397), ''), ((184, 425), '95')]
XY_DESC = (184, 169)
SOLAPA = {'altas': (52, 67), 'modificaciones': (160, 67), 'listado': (284, 67), 'escape': (651, 67)}
XY_CODIGO = (230, 152)


class Frenar(Exception):
    pass


def ventana():
    h = [x for x in av.ventanas() if TITULO in av.txt(x)]
    if not h:
        raise Frenar('no esta abierto Maestro de Productos Terminados (correr `abrir`)')
    return h[0]


def _texto(c):
    b = ctypes.create_unicode_buffer(512)
    u.SendMessageW(c, 0x000D, 512, ctypes.byref(b))
    return b.value


def _pos(h, c):
    r0, r = ai.rect(h), ai.rect(c)
    return (r.l - r0.l, r.t - r0.t)


def _en(h, c, xy, tol=6):
    p = _pos(h, c)
    return abs(p[0] - xy[0]) <= tol and abs(p[1] - xy[1]) <= tol


def _modales():
    return [x for x in av.ventanas() if av.cls(x) == '#32770']


def _vaciar(c):
    # EM_SETSEL(0,-1) por mensaje + UN backspace real (skill arb-operar)
    u.SendMessageW(c, 0x00B1, 0, -1)
    time.sleep(0.15)
    ai.tecla(0x08, 0.2)
    time.sleep(0.2)
    return not _texto(c).strip()


def contestar(cartel, boton):
    """Click real en `boton` del cartel que contenga alguno de los textos de `cartel`.
    Si el cartel abierto es otro, no toca nada."""
    for h in _modales():
        textos, botones = [], []

        def cb(hh, _l):
            t = av.txt(hh)
            if av.cls(hh) == 'Static' and t.strip():
                textos.append(t.strip())
            if av.cls(hh) == 'Button':
                botones.append((hh, t.replace('&', '').strip().lower()))
            return True
        u.EnumChildWindows(h, av.CB(cb), 0)
        if not any(c in t for t in textos for c in cartel):
            raise Frenar('el cartel abierto es otro: %r %r' % (textos, [b[1] for b in botones]))
        cual = [b for b, t in botones if t in boton]
        if len(cual) != 1:
            raise Frenar('no encuentro un unico boton %r en %r' % (boton, [b[1] for b in botones]))
        r = av.R()
        u.GetWindowRect(cual[0], ctypes.byref(r))
        tid = u.GetWindowThreadProcessId(cual[0], None)
        me = k.GetCurrentThreadId()
        u.AttachThreadInput(me, tid, True)
        try:
            u.SetCursorPos((r.l + r.r) // 2, (r.t + r.b) // 2)
            time.sleep(0.3)
            u.mouse_event(0x0002, 0, 0, 0, 0)
            time.sleep(0.09)
            u.mouse_event(0x0004, 0, 0, 0, 0)
            time.sleep(1.0)
        finally:
            u.AttachThreadInput(me, tid, False)
        return True
    return False


def omitir():
    return contestar(('Debug Error', 'Run-Time'), ('omitir',))


def abrir():
    if [x for x in av.ventanas() if TITULO in av.txt(x)]:
        return ventana()
    if [x for x in av.ventanas() if 'Relaciones' in av.txt(x)]:
        raise Frenar('Maestro de Relaciones esta abierta: salir antes con `salir-relaciones`')
    p = av.buscar('prod')
    av.click(p, 716, 43)            # solapa del ribbon `Productos Terminados`
    time.sleep(1.0)
    av.click(p, 70, 90)             # boton `Productos Terminados`
    time.sleep(2.5)
    return ventana()


def _salir(h, xy):
    av.click(h, *xy)
    time.sleep(1.5)
    if not contestar(('Desea Finalizar',), ('sí', 'si')):
        raise Frenar('no aparecio el cartel `Desea Finalizar ??`')
    time.sleep(2.0)


def salir():
    _salir(ventana(), SOLAPA['escape'])


def salir_relaciones():
    h = [x for x in av.ventanas() if 'Relaciones' in av.txt(x)]
    if not h:
        return
    _salir(h[0], (410, 68))


def _traer(h, solapa, codigo):
    ai.activar(h)
    time.sleep(0.4)
    ai.click(h, *SOLAPA[solapa])
    time.sleep(0.5)
    ai.click(h, *XY_CODIGO)
    time.sleep(0.3)
    f = ai.foco(h)
    if not f or ai.cls(f) != 'RichEdit20A' or abs(_pos(h, f)[1] - 140) > 6:
        raise Frenar('el foco no quedo en Codigo de Producto')
    if _texto(f).strip() and not _vaciar(f):
        raise Frenar('no pude vaciar el campo codigo (%r)' % _texto(f))
    ai.escribir(h, codigo)
    time.sleep(0.2)
    if _texto(f).strip() != codigo:
        raise Frenar('el codigo quedo %r' % _texto(f))
    ai.tecla(ai.TECLAS['TAB'])
    time.sleep(0.8)


def alta(codigo, descripcion, apply_):
    descripcion = descripcion.upper()
    if len(descripcion) > TOPE_DESC:
        raise Frenar('la descripcion mide %d y el campo es de %d' % (len(descripcion), TOPE_DESC))
    h = ventana()
    _traer(h, 'altas', codigo)
    if _modales():
        raise Frenar('al tabular el codigo aparecio un cartel: %r (ya existe?)'
                     % [av.txt(m) for m in _modales()])
    for xy, valor in [(XY_DESC, descripcion)] + PLAN:
        f = ai.foco(h)
        if not f or ai.cls(f) != 'RichEdit20A' or not _en(h, f, xy):
            raise Frenar('esperaba el campo en %s y el foco esta en %s %s'
                         % (xy, ai.cls(f) if f else None, _pos(h, f) if f else None))
        actual = _texto(f).strip()
        if actual != valor and not (valor == '' and actual in ('0.0000', '0,0000')):
            if actual:
                if len(actual) > 4:
                    raise Frenar('el campo %s tiene %r y esperaba %r' % (xy, actual, valor))
                if not _vaciar(f):
                    raise Frenar('no pude vaciar el campo %s (quedo %r)' % (xy, _texto(f)))
            if valor:
                ai.escribir(h, valor)
                time.sleep(0.2)
                if _texto(f).strip() != valor:
                    raise Frenar('el campo %s quedo %r y esperaba %r' % (xy, _texto(f), valor))
        ai.tecla(ai.TECLAS['TAB'])
        time.sleep(0.3)
    f = ai.foco(h)
    ai.foto(h, 'pt_alta_' + codigo)
    if not f or ai.cls(f) != 'Button' or 'Acepta' not in _texto(f) or not u.IsWindowEnabled(f):
        raise Frenar('el foco no quedo en &Acepta habilitado (%s %r)'
                     % (ai.cls(f) if f else None, _texto(f) if f else ''))
    if not apply_:
        return 'dry-run: pantalla llena, foco en &Acepta, SIN grabar (mirar la foto)'
    ai.tecla(ai.TECLAS['ENTER'])
    time.sleep(2.0)
    if _modales():
        raise Frenar('despues del ENTER aparecio un cartel: %r' % [av.txt(m) for m in _modales()])
    return 'grabado'


def leer(codigo):
    """Ficha campo por campo en `Modificaciones` (los RichEdit20A devuelven texto solo con
    foco). No graba nada."""
    h = ventana()
    _traer(h, 'modificaciones', codigo)
    ficha = []
    for _ in range(16):
        f = ai.foco(h)
        if not f or ai.cls(f) == 'Button':
            break
        ficha.append((_pos(h, f), _texto(f)))
        ai.tecla(ai.TECLAS['TAB'])
        time.sleep(0.25)
    return ficha


def export():
    h = ventana()
    antes = os.path.getmtime(ARTICULO_TXT) if os.path.exists(ARTICULO_TXT) else 0
    if antes:
        destino = os.path.join(_AQUI, '..', '.arb-cache', 'pre-cambio',
                               'ARTICULO_%s_antes_export.TXT' % time.strftime('%Y%m%d', time.localtime(antes)))
        shutil.copy2(ARTICULO_TXT, destino)
    r0 = av.R()
    u.GetWindowRect(h, ctypes.byref(r0))

    def tecla(vk, p=0.3):
        u.keybd_event(vk, 0, 0, 0)
        time.sleep(0.06)
        u.keybd_event(vk, 0, 0x0002, 0)
        time.sleep(p)

    def clic(dx, dy):
        u.SetCursorPos(r0.l + dx, r0.t + dy)
        time.sleep(0.2)
        u.mouse_event(0x0002, 0, 0, 0, 0)
        time.sleep(0.08)
        u.mouse_event(0x0004, 0, 0, 0, 0)
        time.sleep(0.6)

    combo = []

    def _cb(hh, _l):
        if av.cls(hh) == 'ComboBox' and u.IsWindowVisible(hh):
            combo.append(hh)
        return True

    tid = u.GetWindowThreadProcessId(h, None)
    me = k.GetCurrentThreadId()
    u.AttachThreadInput(me, tid, True)
    try:
        u.SetForegroundWindow(h)
        time.sleep(0.4)
        clic(*SOLAPA['listado'])
        clic(230, 148)                # Desde Linea -> foco real
        u.EnumChildWindows(h, av.CB(_cb), 0)
        for _ in range(4):
            tecla(0x09)               # Hasta Linea, Desde Producto, Hasta Producto, Salida
        for _ in range(8):
            tecla(0x26, 0.12)
        for _ in range(3):
            tecla(0x28, 0.25)
        idx = u.SendMessageW(combo[0], 0x0147, 0, 0) if combo else -1
        if idx != 3:
            raise Frenar('el combo Salida quedo en %s y se esperaba 3 (Tabla EXcel): no exporto' % idx)
        for _ in range(3):
            tecla(0x0D, 1.0)
    finally:
        u.AttachThreadInput(me, tid, False)

    prev, t0 = -1, time.time()
    while time.time() - t0 < 240:
        time.sleep(3)
        if not os.path.exists(ARTICULO_TXT):
            continue
        n, m = os.path.getsize(ARTICULO_TXT), os.path.getmtime(ARTICULO_TXT)
        if m > antes and n == prev and time.time() - m > 8:
            break
        prev = n
    av.cerrar_excel(archivos=list(av.ax.ARCHIVOS_EXPORT) + ['ARTICULO.TXT'])
    if not os.path.exists(ARTICULO_TXT) or os.path.getmtime(ARTICULO_TXT) <= antes:
        raise Frenar('ARTICULO.TXT no cambio')
    return '%d bytes, %s' % (os.path.getsize(ARTICULO_TXT),
                             time.strftime('%H:%M:%S', time.localtime(os.path.getmtime(ARTICULO_TXT))))


def main(argv):
    apply_ = '--apply' in argv
    argv = [a for a in argv if a != '--apply']
    if not argv:
        print(__doc__)
        return 1
    cmd, resto = argv[0], argv[1:]
    try:
        if cmd == 'abrir':
            abrir()
            print('Maestro de Productos Terminados abierto')
        elif cmd == 'alta' and len(resto) == 2:
            print('%s  %s' % (resto[0], alta(resto[0], resto[1], apply_)))
        elif cmd == 'leer' and resto:
            for cod in resto:
                print(cod)
                for pos, val in leer(cod):
                    print('   %-10s %r' % (pos, val))
        elif cmd == 'export':
            print('ARTICULO.TXT', export())
        elif cmd == 'salir':
            salir()
            print('sali del Maestro de Productos Terminados')
        elif cmd == 'salir-relaciones':
            salir_relaciones()
            print('sali de Maestro de Relaciones')
        elif cmd == 'omitir':
            print('click en Omitir' if omitir() else 'no hay cartel')
        else:
            print(__doc__)
            return 1
    except Frenar as e:
        print('ABORTO: %s' % e)
        return 2
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
