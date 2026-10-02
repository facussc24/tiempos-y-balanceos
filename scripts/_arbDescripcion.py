# -*- coding: utf-8 -*-
"""Leer y reescribir la `Descripcion` de insumos en el maestro del arb (ABM de Insumos).

    python scripts/_arbDescripcion.py --leer COD [COD ...]
    python scripts/_arbDescripcion.py --fijar COD "TEXTO NUEVO" [--apply]
    python scripts/_arbDescripcion.py --tabla archivo.csv [--apply]     # csv: codigo,nuevo

Dry-run por defecto: sin `--apply` trae el registro, lo lee y cierra sin grabar.

POR QUE EXISTE (01/09/2026, los 3 hilos del "ERROR BOM" de Produccion)
  El campo son DOS RENGLONES DE 40. Cuando el nombre no entra en 40 se usa el segundo, y el
  reporte RELACIONES no lo sabe manejar: parte la fila y corre unidad/consumo/modulo/proceso
  3 columnas a la izquierda. Se arregla acortando la descripcion a <=40 — NO "sacando el
  salto", porque el texto no entra. Detalle: skill `arb-operar`.

LO QUE NO SE VE LEYENDO EL CODIGO
  - El EXPORT TRUNCA el segundo renglon: mostraba `GR` y el texto real era
    `GRAY VIOLET - TGA AT2`. Reescribir con lo del export borraba 19 caracteres reales.
    La descripcion de verdad solo sale de `WM_GETTEXT` sobre el RichEdit CON FOCO.
  - `&Acepta` esta DESHABILITADO mientras `Posee PAPP/PSW` este vacio, y ahi el TAB se clava:
    parece que fallan las teclas. Va SIEMPRE `S` (Fak, 01/09) — ver PAPP_VALOR.
  - `FIN` va al fin del RENGLON, no del texto. Se vacia con EM_SETSEL(0,-1) + UN BACKSPACE real.
  - Una tecla mandada muy rapido NO LLEGA Y NO DA ERROR: 90 BACKSPACE a 12 ms no borraron una
    sola letra. De ahi PAUSA_TECLA, y de ahi que cada paso se relea antes de seguir.
  - El conteo de TABs VARIA entre registros (17 y 19 en la misma tanda): los controles se
    identifican por POSICION o handle, nunca por cuantos TAB conte.
"""
import csv
import ctypes
import importlib.util
import os
import sys
import time

TOPE_RENGLON = 40           # medido: 470 descripciones llegan a 40 y ninguna pasa
PAPP_XY = (194, 511)        # 'Posee PAPP/PSW S/N', relativo a la ventana
PAPP_VALOR = 'S'            # Fak 01/09/2026: va siempre S, Calidad revisa despues
MAX_TAB = 30
PAUSA_TECLA = 0.25
WM_CLOSE, WM_GETTEXT, EM_SETSEL = 0x0010, 0x000D, 0x00B1
_AQUI = os.path.dirname(os.path.abspath(__file__))


def _mod(nombre, archivo):
    ruta = os.path.join(_AQUI, archivo)
    spec = importlib.util.spec_from_file_location(nombre, ruta)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


ai = _mod('_arbInsumo', '_arbInsumo.py')
av = _mod('_arbVer', '_arbVer.py')
u = ai.u


def maestro():
    for h in av.ventanas():
        if 'Maestro de Insumos' in av.txt(h):
            return h
    return None


def cerrar():
    """WM_CLOSE descarta la edicion sin grabar (probado: el registro queda intacto)."""
    m = maestro()
    if m:
        u.SendMessageW(m, WM_CLOSE, 0, 0)
        time.sleep(1.0)


def abrir():
    m = maestro()
    if m:
        return m
    for h in av.ventanas():                       # Relaciones deja Produccion deshabilitada
        if 'Maestro de Relaciones' in av.txt(h):
            u.SendMessageW(h, WM_CLOSE, 0, 0)
            time.sleep(1.0)
    p = av.buscar('prod')
    if not p:
        sys.exit('ABORTO: el arb no esta abierto (y esta sesion no tipea contraseñas)')
    av.click(p, 851, 43)                          # solapa Menu de Insumos
    time.sleep(0.5)
    av.click(p, 37, 90)                           # boton ABM de Insumos
    time.sleep(1.5)
    m = maestro()
    if not m:
        sys.exit('ABORTO: no se abrio Maestro de Insumos')
    return m


def _texto(h):
    if not h:
        return ''
    b = ctypes.create_unicode_buffer(1024)
    u.SendMessageW(h, WM_GETTEXT, 1024, ctypes.byref(b))
    return b.value.rstrip()


def _foco(h):
    f = ai.foco(h)
    return f, _texto(f)


def _reemplazar(h, hctrl, valor):
    """Vacia el control y tipea `valor` con teclado real. Devuelve lo que quedo."""
    u.SendMessageW(hctrl, EM_SETSEL, 0, -1)
    time.sleep(0.15)
    ai.tecla(ai.TECLAS['BACKSPACE'], pausa=PAUSA_TECLA)
    if _texto(hctrl).strip():
        return _texto(hctrl)
    ai.escribir(h, valor)
    time.sleep(0.25)
    return _texto(hctrl)


def traer(h, codigo):
    """Deja el registro en pantalla con el foco en Descripcion. Devuelve (handle, texto)."""
    ai.click(h, ai.SOLAPAS['modificaciones'], ai.Y_SOLAPA)
    time.sleep(0.3)
    ai.click(h, *ai.CAMPOS['rubro'])
    ai.escribir(h, '1')
    ai.tecla(ai.TECLAS['TAB'])
    ai.escribir(h, codigo)
    ai.tecla(ai.TECLAS['TAB'])
    time.sleep(0.6)
    f, t = _foco(h)
    if not f or ai.cls(f) != 'RichEdit20A':
        return None, 'el foco no quedo en un RichEdit (%s)' % (ai.cls(f) if f else 'None')
    return f, t


def leer(codigo):
    cerrar()
    h = abrir()
    f, t = traer(h, codigo)
    return t if f else None


def fijar(codigo, nuevo, apply_=False, esperado=None):
    """Devuelve (ok, mensaje). Ante cualquier gate en rojo: WM_CLOSE, no graba."""
    if len(nuevo) > TOPE_RENGLON:
        return False, 'el texto mide %d y el renglon es de %d' % (len(nuevo), TOPE_RENGLON)
    if '\r' in nuevo or '\n' in nuevo:
        return False, 'el texto nuevo no puede llevar saltos de linea'
    if [x for x in av.ventanas() if av.cls(x) == '#32770']:
        return False, 'hay un modal abierto en el arb'

    cerrar()
    h = abrir()
    hdesc, viejo = traer(h, codigo)
    if not hdesc:
        cerrar()
        return False, viejo
    print('   viejo: %r' % viejo)
    print('   nuevo: %r  (%d car)' % (nuevo, len(nuevo)))
    if esperado is not None and viejo != esperado:
        cerrar()
        return False, 'el campo dice %r y esperaba %r' % (viejo, esperado)
    if viejo == nuevo:
        cerrar()
        return True, 'ya estaba asi, no toco nada'
    if not apply_:
        cerrar()
        return True, 'dry-run: no se escribio nada'

    quedo = _reemplazar(h, hdesc, nuevo)
    if quedo != nuevo:
        cerrar()
        return False, 'la descripcion quedo %r y esperaba %r — cerrado SIN GRABAR' % (quedo, nuevo)
    return aceptar(h)


def tabular_hasta(h, xy):
    """TAB real hasta que el foco cae en el control de posicion `xy` (relativa a la ventana).
    Devuelve su handle, o None si no llego en MAX_TAB."""
    base = ai.rect(h)
    for _ in range(MAX_TAB):
        ai.tecla(ai.TECLAS['TAB'], pausa=0.10)
        f = ai.foco(h)
        if not f:
            continue
        r = ai.rect(f)
        if abs(r.l - base.l - xy[0]) < 8 and abs(r.t - base.t - xy[1]) < 8:
            return f
    return None


# Campos del registro donde el TAB se puede clavar (posicion relativa a la ventana)
CAMPOS_XY = {(194, 311): 'Unidad', (459, 311): 'Doble Medida', (194, 454): 'Es Sub-Producto',
             (194, 482): 'Tiene Vencimiento', (459, 482): 'Tipo de Descarga',
             (640, 482): 'Origen Descarga', (194, 511): 'Posee PAPP/PSW'}


def carteles():
    """[(titulo, texto)] de los #32770 visibles del arb. Se leen, no se adivinan."""
    out = []
    for m in [x for x in av.ventanas() if av.cls(x) == '#32770']:
        partes = []

        def cb(hh, _l):
            if av.cls(hh) == 'Static' and av.txt(hh).strip():
                partes.append(' '.join(av.txt(hh).split()))
            return True
        u.EnumChildWindows(m, av.CB(cb), 0)
        out.append((av.txt(m), ' | '.join(partes)))
    return out


def por_que_no_avanza(h):
    """Cuando el TAB no llega: PRIMERO el cartel (28/09/2026: 'Unidad Esta Anulado' tapado
    por un 'no llegue a PAPP'; Fak: *"si tomaras capturas te darias cuenta"*), despues el
    campo donde quedo el foco. Deja la foto en arb_fotos/fallo_maestro.png."""
    try:
        av.foto(h, 'fallo_maestro')
    except Exception:
        pass
    c = carteles()
    if c:
        av.cerrar_modales()
        return 'CARTEL DEL ARB: ' + '; '.join('%s: %s' % x for x in c)
    f = ai.foco(h)
    if not f:
        return 'sin foco'
    r, base = ai.rect(f), ai.rect(h)
    xy = (r.l - base.l, r.t - base.t)
    campo = next((n for (x, y), n in CAMPOS_XY.items()
                  if abs(xy[0] - x) < 8 and abs(xy[1] - y) < 8), 'campo en %s' % (xy,))
    return 'el TAB se clavo en %s = %r (vacio y obligatorio?)' % (campo, _texto(f))


def aceptar(h, forzar_papp=True):
    """Desde cualquier campo del registro: completa PAPP, cae en &Acepta y graba.
    `forzar_papp=False` solo lo llena si esta VACIO (un N queda N): para quien cambia otro
    campo y no quiere tocar este de rebote. Devuelve (ok, mensaje). Ante cualquier gate en
    rojo: WM_CLOSE, no graba."""
    # Posee PAPP/PSW: sin valor, &Acepta queda deshabilitado y el TAB se clava aca.
    hpapp = tabular_hasta(h, PAPP_XY)
    if not hpapp:
        motivo = por_que_no_avanza(h)
        cerrar()
        return False, 'no llegue a Posee PAPP/PSW (%s) — cerrado sin grabar' % motivo
    papp_hoy = _texto(hpapp).strip()
    # Un codigo viejo puede traer BASURA en este campo (FIELTRO330, 02/10/2026: 'ýýýýÝÝ...'):
    # el arb solo acepta S / N / X, con otra cosa deja &Acepta apagado. Basura = vacio.
    if papp_hoy.upper() not in ('S', 'N', 'X'):
        papp_hoy = ''
    if papp_hoy != PAPP_VALOR and (forzar_papp or not papp_hoy):
        papp = _reemplazar(h, hpapp, PAPP_VALOR)
        if papp.strip() != PAPP_VALOR:
            cerrar()
            return False, 'PAPP quedo %r y esperaba %r — cerrado SIN GRABAR' % (papp, PAPP_VALOR)

    ai.tecla(ai.TECLAS['TAB'], pausa=PAUSA_TECLA)
    boton = ai.foco(h)
    if not boton or ai.cls(boton) != 'Button':
        # 02/10/2026: "no cai en un boton sino en ''" no decia nada y costo tres aperturas.
        # Antes de cerrar se lee el cartel o el campo donde quedo el foco (y queda la foto).
        clase = ai.cls(boton) if boton else 'None'
        motivo = por_que_no_avanza(h)
        cerrar()
        return False, 'no cai en un boton sino en %r (%s) — cerrado sin grabar' % (clase, motivo)
    rot = _texto(boton).replace('&', '').strip().lower()
    if rot != 'acepta' or not u.IsWindowEnabled(boton):
        cerrar()
        return False, 'boton %r habilitado=%s' % (rot, bool(u.IsWindowEnabled(boton)))

    ai.tecla(ai.TECLAS['ENTER'])
    time.sleep(1.2)
    modales = [x for x in av.ventanas() if av.cls(x) == '#32770']
    if modales:
        # Un modal de validacion del arb despues de Acepta. Se limpia ACA, si no la fila
        # siguiente del lote muere con "hay un modal abierto" y el reporte final culpa a la
        # fila equivocada. WM_CLOSE no sirve con un modal encima: lo cierra un click real.
        rotulos = [av.txt(x) for x in modales]
        av.cerrar_modales()
        cerrar()
        return False, 'el arb abrio un modal al grabar: %r' % rotulos
    return True, 'GRABADO'


def main(argv):
    apply_ = '--apply' in argv
    argv = [a for a in argv if a != '--apply']
    if not argv:
        print(__doc__)
        return 1

    if argv[0] == '--leer':
        for cod in argv[1:]:
            t = leer(cod)
            print('%-16s %r' % (cod, t))
            if t and ('\r' in t or '\n' in t):
                p = t.replace('\r\n', '\n').split('\n')
                print('%-16s  ^ DOS RENGLONES -> parte la fila del export. Junto: %r (%d car)'
                      % ('', ' '.join(x.strip() for x in p), len(' '.join(x.strip() for x in p))))
        cerrar()
        return 0

    if argv[0] == '--fijar':
        if len(argv) < 3:
            print('Uso: --fijar COD "TEXTO NUEVO" [--apply]')
            return 1
        cod, nuevo = argv[1], argv[2]
        print('%s' % cod)
        ok, msg = fijar(cod, nuevo, apply_)
        print('   %s %s' % ('OK  ' if ok else 'FALLO', msg))
        return 0 if ok else 1

    if argv[0] == '--tabla':
        if len(argv) < 2:
            print('Uso: --tabla archivo.csv [--apply]     (csv: codigo,nuevo)')
            return 1
        with open(argv[1], encoding='utf-8-sig', newline='') as fh:
            crudas = [r for r in csv.reader(fh) if r and r[0].strip()
                      and r[0].strip().lower() not in ('codigo', 'código')]
        cortas = [r[0].strip() for r in crudas if len(r) < 2 or not r[1].strip()]
        if cortas:
            print('ABORTADO: estas filas no traen la descripcion nueva: %s' % ', '.join(cortas))
            return 1
        filas = crudas
        print('%d fila(s)  |  modo %s\n' % (len(filas), 'APPLY' if apply_ else 'dry-run'))
        malas = []
        for r in filas:
            cod, nuevo = r[0].strip(), r[1].strip()
            print('%s' % cod)
            ok, msg = fijar(cod, nuevo, apply_)
            print('   %s %s\n' % ('OK  ' if ok else 'FALLO', msg))
            if not ok:
                malas.append((cod, msg))
        print('=' * 60)
        print('%d/%d bien' % (len(filas) - len(malas), len(filas)))
        for c, m in malas:
            print('   PENDIENTE %s: %s' % (c, m))
        print('\nVERIFICAR contra el export: la pantalla NO prueba que grabo.')
        print('   python scripts/_arbVer.py reset && python scripts/_arbVer.py export')
        return 1 if malas else 0

    print(__doc__)
    return 1


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
