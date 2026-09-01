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

    # Posee PAPP/PSW: sin valor, &Acepta queda deshabilitado y el TAB se clava aca.
    base = ai.rect(h)
    hpapp = None
    for _ in range(MAX_TAB):
        ai.tecla(ai.TECLAS['TAB'], pausa=0.10)
        f = ai.foco(h)
        if not f:
            continue
        r = ai.rect(f)
        if abs(r.l - base.l - PAPP_XY[0]) < 8 and abs(r.t - base.t - PAPP_XY[1]) < 8:
            hpapp = f
            break
    if not hpapp:
        cerrar()
        return False, 'no llegue a Posee PAPP/PSW — cerrado sin grabar'
    if _texto(hpapp).strip() != PAPP_VALOR:
        papp = _reemplazar(h, hpapp, PAPP_VALOR)
        if papp.strip() != PAPP_VALOR:
            cerrar()
            return False, 'PAPP quedo %r y esperaba %r — cerrado SIN GRABAR' % (papp, PAPP_VALOR)

    ai.tecla(ai.TECLAS['TAB'], pausa=PAUSA_TECLA)
    boton = ai.foco(h)
    if not boton or ai.cls(boton) != 'Button':
        cerrar()
        return False, 'no cai en un boton sino en %s' % (ai.cls(boton) if boton else 'None')
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
