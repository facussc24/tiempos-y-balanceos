# -*- coding: utf-8 -*-
"""Maestro de Insumos del arb: leer la ficha ENTERA de un codigo, marcar `Es Sub-Producto`,
y dar de ALTA codigos nuevos copiando la ficha de un hermano.

    python scripts/_arbInsumoCampos.py --leer COD [COD ...]
    python scripts/_arbInsumoCampos.py --subproducto COD [COD ...] [--apply]
    python scripts/_arbInsumoCampos.py --alta tabla.csv --como COD_HERMANO [--apply]
        (csv con encabezado: codigo,descripcion)

Dry-run por defecto: sin `--apply` llena la pantalla, saca la foto y cierra SIN grabar
(`WM_CLOSE` sobre `Maestro de Insumos` descarta la edicion — skill `arb-operar`).

POR QUE EXISTE (23/09/2026, semiterminados de inyeccion de Patagonia)
  Un semiterminado que se consume adentro de un producto terminado tiene que ser INSUMO
  (si solo es articulo no se puede poner en una BOM) y tiene que tener `Es Sub-Producto = S`
  (si no, su BOM no baja al producir el terminado: es propiedad del INSUMO, no del vinculo —
  memoria `reference_arb_explosion_subproducto`). El modelo es `INY-APB0005-V1`, la tapa
  inyectada de Amarok PA2.

LO QUE NO SE VE LEYENDO EL CODIGO (todo medido antes, ver `reference/maestro-de-insumos.md`)
  - Los campos se identifican por POSICION, nunca por cuantos TAB conte: el conteo varia
    entre registros (17 y 19 en la misma tanda del 01/09).
  - Los `RichEdit20A` devuelven su texto por WM_GETTEXT solo CON FOCO. Por eso la ficha se
    lee tabulando campo por campo, no de una.
  - En `Altas` el click por coordenada falla en silencio: UN solo click en `Rubro` y de ahi TAB.
  - `&Acepta` nace deshabilitado hasta que `Posee PAPP/PSW` tiene valor (va `S`, Fak 01/09).
  - Al grabar puede salir `Microsoft Visual C++ Runtime Library`: el boton lo eligio Fak y es
    `Omitir` (15/09). `Anular` cierra el arb y reabrirlo pide SU contraseña: aca nunca se toca.
    Si el cartel sale INVISIBLE con el foco en `Anular`, no se manda ninguna tecla: se para.
  - Los campos que el hermano tiene vacios quedan vacios: no se inventa ninguno.
"""
import csv
import ctypes
import importlib.util
import os
import sys
import time

_AQUI = os.path.dirname(os.path.abspath(__file__))


def _mod(nombre, archivo):
    spec = importlib.util.spec_from_file_location(nombre, os.path.join(_AQUI, archivo))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


ad = _mod('_arbDescripcion', '_arbDescripcion.py')
ai, av, u = ad.ai, ad.av, ad.u

# Esquina sup-izq de cada control, relativa a la ventana, en ORDEN DE TAB (medido 31/08/2026)
CAMPOS = [
    ('rubro', (194, 140)), ('medida', (297, 140)), ('descripcion', (194, 169)),
    ('cc_ingreso', (194, 254)), ('imp_ingreso', (459, 254)),
    ('cc_descarga', (194, 283)), ('imp_descarga', (459, 283)),
    ('unidad', (194, 311)), ('doble_medida', (459, 311)),
    ('stock_minimo', (194, 340)), ('lote_optimo', (459, 340)),
    ('unidad_minima', (194, 368)), ('tiempo_entrega', (459, 368)),
    ('proveedor1', (194, 397)), ('cod_original1', (459, 397)),
    ('proveedor2', (194, 425)), ('cod_original2', (459, 425)),
    ('sub_producto', (194, 454)), ('etiquetas', (459, 454)),
    ('vencimiento', (194, 482)), ('tipo_descarga', (459, 482)),
    ('origen_descarga', (640, 482)), ('papp_psw', (194, 511)),
]
XY = dict(CAMPOS)
TOL = 8
TOPE_DESC, TOPE_COD = 40, 15
# Lo que NO se copia del hermano: la identidad del codigo y lo que es del proveedor.
NO_COPIAR = {'rubro', 'medida', 'descripcion', 'proveedor1', 'cod_original1',
             'proveedor2', 'cod_original2'}
RUNTIME = 'Microsoft Visual C++ Runtime Library'


class Frenar(Exception):
    """Un gate en rojo. Quien la atrapa cierra sin grabar."""


def _campo_de(h, ctrl):
    base, r = ai.rect(h), ai.rect(ctrl)
    x, y = r.l - base.l, r.t - base.t
    for nombre, (cx, cy) in CAMPOS:
        if abs(x - cx) < TOL and abs(y - cy) < TOL:
            return nombre
    return None


def _modales():
    return [x for x in av.ventanas() if av.cls(x) == '#32770']


def _runtime_invisible():
    """El cartel de Visual C++ a veces es la ventana de primer plano SIN dibujarse, con el foco
    en `Anular` (22/09). `av.ventanas()` solo ve las visibles, por eso se mira el foreground."""
    fg = u.GetForegroundWindow()
    return bool(fg) and av.cls(fg) == '#32770' and not u.IsWindowVisible(fg)


def _omitir_runtime():
    """Click REAL en `Omitir` del cartel de Visual C++. Devuelve True si lo cerro."""
    for m in _modales():
        if RUNTIME not in av.txt(m):
            continue
        botones = []

        def cb(hh, _l):
            if av.cls(hh) == 'Button' and 'mitir' in av.txt(hh).replace('&', '').lower():
                botones.append(hh)
            return True
        u.EnumChildWindows(m, av.CB(cb), 0)
        if not botones:
            return False
        r = ai.rect(botones[0])
        tid = u.GetWindowThreadProcessId(botones[0], None)
        me = ai.k.GetCurrentThreadId()
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
        print('   cartel de Visual C++ -> Omitir (criterio de Fak, 15/09)')
    return not [m for m in _modales() if RUNTIME in av.txt(m)]


def _gate_sin_modales():
    if _runtime_invisible():
        raise SystemExit('ABORTO: hay un cartel de Visual C++ INVISIBLE con el foco en Anular. '
                         'No mando ninguna tecla: que lo mire Fak (un ENTER cierra el arb).')
    if _modales():
        raise Frenar('hay un modal abierto en el arb: %r' % [av.txt(x) for x in _modales()])


def leer_ficha(h):
    """Con el registro en pantalla y el foco en Descripcion: tabula hasta el boton leyendo
    cada campo con foco. Devuelve {campo: valor}. No escribe nada."""
    ficha = {}
    f = ai.foco(h)
    nombre = _campo_de(h, f) if f else None
    if nombre != 'descripcion':
        raise Frenar('esperaba el foco en Descripcion y esta en %r' % nombre)
    ficha['descripcion'] = ad._texto(f)
    anterior = f
    for _ in range(ad.MAX_TAB):
        ai.tecla(ai.TECLAS['TAB'], pausa=0.12)
        f = ai.foco(h)
        if not f:
            continue
        if ai.cls(f) == 'Button':
            break
        if f == anterior:          # PAPP vacio: el TAB se clava ahi (&Acepta deshabilitado)
            break
        anterior = f
        nombre = _campo_de(h, f)
        if nombre:
            ficha[nombre] = ad._texto(f).strip()
    return ficha


def traer_ficha(codigo):
    ad.cerrar()
    h = ad.abrir()
    _gate_sin_modales()
    f, t = ad.traer(h, codigo)
    if not f:
        raise Frenar(t)
    if _modales():
        raise Frenar('al traer %s el arb abrio un modal: %r'
                     % (codigo, [av.txt(x) for x in _modales()]))
    if not t.strip():
        raise Frenar('%s trae la descripcion vacia: no existe como insumo' % codigo)
    return h, leer_ficha(h)


def grabar(h):
    """Desde cualquier campo: PAPP (si esta vacio va S), TAB a &Acepta, gates y ENTER.
    Devuelve el mensaje; ante un gate en rojo levanta Frenar (el que llama cierra)."""
    hpapp = ad.tabular_hasta(h, XY['papp_psw'])
    if not hpapp:
        raise Frenar('no llegue a Posee PAPP/PSW')
    if not ad._texto(hpapp).strip():
        if ad._reemplazar(h, hpapp, ad.PAPP_VALOR).strip() != ad.PAPP_VALOR:
            raise Frenar('PAPP no quedo en %s' % ad.PAPP_VALOR)
    ai.tecla(ai.TECLAS['TAB'], pausa=ad.PAUSA_TECLA)
    boton = ai.foco(h)
    if not boton or ai.cls(boton) != 'Button':
        raise Frenar('no cai en un boton sino en %s' % (ai.cls(boton) if boton else 'None'))
    rot = ad._texto(boton).replace('&', '').strip().lower()
    if rot != 'acepta' or not u.IsWindowEnabled(boton):
        raise Frenar('boton %r habilitado=%s' % (rot, bool(u.IsWindowEnabled(boton))))
    ai.tecla(ai.TECLAS['ENTER'])
    time.sleep(1.5)
    if _runtime_invisible():
        raise SystemExit('ABORTO despues del ENTER: cartel de Visual C++ INVISIBLE. '
                         'No mando teclas: que lo mire Fak. El registro puede haber grabado.')
    if [m for m in _modales() if RUNTIME in av.txt(m)]:
        if not _omitir_runtime():
            raise SystemExit('ABORTO: no pude apretar Omitir en el cartel de Visual C++')
        return 'GRABADO (con cartel de Visual C++ omitido: verificar con --leer)'
    if _modales():
        rotulos = [av.txt(x) for x in _modales()]
        av.cerrar_modales()
        raise Frenar('el arb abrio un modal al grabar: %r' % rotulos)
    return 'GRABADO'


def subproducto(codigo, apply_):
    try:
        h, ficha = traer_ficha(codigo)
        actual = ficha.get('sub_producto', '')
        print('   Es Sub-Producto hoy: %r   (desc %r)' % (actual, ficha.get('descripcion')))
        if actual == 'S':
            ad.cerrar()
            return True, 'ya estaba en S, no toco nada'
        if not apply_:
            ad.cerrar()
            return True, 'dry-run: pasaria de %r a S' % actual
        ad.cerrar()                                   # la lectura dejo el foco al final
        h = ad.abrir()
        f, t = ad.traer(h, codigo)
        if not f:
            raise Frenar(t)
        hsp = ad.tabular_hasta(h, XY['sub_producto'])
        if not hsp:
            raise Frenar('no llegue a Es Sub-Producto')
        if ad._texto(hsp).strip() != actual:
            raise Frenar('Es Sub-Producto dice %r y lei %r' % (ad._texto(hsp), actual))
        if ad._reemplazar(h, hsp, 'S').strip() != 'S':
            raise Frenar('Es Sub-Producto no quedo en S')
        return True, grabar(h)
    except Frenar as e:
        ad.cerrar()
        return False, str(e)


def alta(codigo, descripcion, hermano, apply_):
    """`hermano` = ficha leida de un insumo que ya funciona como semiterminado."""
    if len(codigo) > TOPE_COD:
        return False, 'el codigo mide %d y el campo es de %d' % (len(codigo), TOPE_COD)
    if len(descripcion) > TOPE_DESC:
        return False, 'la descripcion mide %d y el renglon es de %d' % (len(descripcion), TOPE_DESC)
    try:
        ad.cerrar()
        h = ad.abrir()
        _gate_sin_modales()
        ai.click(h, ai.SOLAPAS['altas'], ai.Y_SOLAPA)
        time.sleep(0.4)
        ai.click(h, *ai.CAMPOS['rubro'])
        f = ai.foco(h)
        if _campo_de(h, f) != 'rubro':
            raise Frenar('el click no dejo el foco en Rubro (%r)' % _campo_de(h, f))
        pasos = [('rubro', '1'), ('medida', codigo), ('descripcion', descripcion)]
        for i, (campo, valor) in enumerate(pasos):
            if i:
                ai.tecla(ai.TECLAS['TAB'], pausa=ad.PAUSA_TECLA)
                time.sleep(0.4)
                if _modales():
                    raise Frenar('al salir de %s el arb abrio un modal: %r (ya existe?)'
                                 % (pasos[i - 1][0], [av.txt(x) for x in _modales()]))
            f = ai.foco(h)
            if _campo_de(h, f) != campo:
                raise Frenar('esperaba el foco en %s y esta en %r' % (campo, _campo_de(h, f)))
            if ad._texto(f).strip():
                raise Frenar('%s tendria que estar vacio y dice %r' % (campo, ad._texto(f)))
            ai.escribir(h, valor)
            time.sleep(0.25)
            if ad._texto(f).strip() != valor:
                raise Frenar('%s quedo %r y esperaba %r' % (campo, ad._texto(f), valor))
        copiados = []
        for campo, xy in CAMPOS:
            if campo in NO_COPIAR or campo == 'papp_psw':
                continue
            valor = 'S' if campo == 'sub_producto' else hermano.get(campo, '')
            if not valor:
                continue
            hc = ad.tabular_hasta(h, xy)
            if not hc:
                raise Frenar('no llegue al campo %s' % campo)
            if ad._reemplazar(h, hc, valor).strip() != valor:
                raise Frenar('%s no quedo en %r' % (campo, valor))
            copiados.append('%s=%s' % (campo, valor))
        print('   campos: %s' % ', '.join(copiados))
        if not apply_:
            ai.foto(h, 'alta_%s' % codigo.replace(' ', '_'))
            ad.cerrar()
            return True, 'dry-run: pantalla llena y cerrada SIN grabar (mirar la foto)'
        return True, grabar(h)
    except Frenar as e:
        ad.cerrar()
        return False, str(e)


def main(argv):
    apply_ = '--apply' in argv
    argv = [a for a in argv if a != '--apply']
    if not argv:
        print(__doc__)
        return 1
    modo, resto = argv[0], argv[1:]

    if modo == '--leer':
        for cod in resto:
            try:
                _h, ficha = traer_ficha(cod)
                print(cod)
                for campo, _xy in CAMPOS:
                    if campo in ficha:
                        print('   %-16s %r' % (campo, ficha[campo]))
            except Frenar as e:
                print('%s   NO SE PUDO LEER: %s' % (cod, e))
            ad.cerrar()
        return 0

    if modo == '--subproducto':
        malas = []
        for cod in resto:
            print(cod)
            ok, msg = subproducto(cod, apply_)
            print('   %s %s' % ('OK  ' if ok else 'FALLO', msg))
            if not ok:
                malas.append(cod)
        print('\n%d/%d bien%s' % (len(resto) - len(malas), len(resto),
                                  ('  | PENDIENTES: ' + ', '.join(malas)) if malas else ''))
        return 1 if malas else 0

    if modo == '--alta':
        if len(resto) < 3 or resto[1] != '--como':
            print('Uso: --alta tabla.csv --como COD_HERMANO [--apply]')
            return 1
        with open(resto[0], encoding='utf-8-sig', newline='') as fh:
            filas = [(r['codigo'].strip(), r['descripcion'].strip())
                     for r in csv.DictReader(fh) if (r.get('codigo') or '').strip()]
        try:
            _h, hermano = traer_ficha(resto[2])
        except Frenar as e:
            print('no pude leer el hermano %s: %s' % (resto[2], e))
            return 1
        ad.cerrar()
        print('hermano %s: %s\n' % (resto[2], ', '.join('%s=%s' % (c, hermano[c])
                                                      for c, _xy in CAMPOS if hermano.get(c))))
        print('%d alta(s)  |  modo %s\n' % (len(filas), 'APPLY' if apply_ else 'dry-run'))
        malas = []
        for cod, desc in filas:
            print('%s  %r' % (cod, desc))
            ok, msg = alta(cod, desc, hermano, apply_)
            print('   %s %s\n' % ('OK  ' if ok else 'FALLO', msg))
            if not ok:
                malas.append((cod, msg))
        print('=' * 60)
        print('%d/%d bien' % (len(filas) - len(malas), len(filas)))
        for c, m in malas:
            print('   PENDIENTE %s: %s' % (c, m))
        print('\nVERIFICAR releyendo la ficha: python scripts/_arbInsumoCampos.py --leer <COD...>')
        return 1 if malas else 0

    print(__doc__)
    return 1


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
