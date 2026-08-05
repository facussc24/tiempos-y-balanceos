# -*- coding: utf-8 -*-
"""
Cambiar consumos en el ERP arb: contando y verificando, no tanteando.

    python scripts/_arbCargar.py --diagnostico 21-8908    read-only puro, CERO teclas
    python scripts/_arbCargar.py --seco 21-8908           recorre sin escribir ni grabar
    python scripts/_arbCargar.py --tabla carga.csv        DRY-RUN (default)
    python scripts/_arbCargar.py --tabla carga.csv --apply
    python scripts/_arbCargar.py --verificar carga.csv    contra el export, tolerancia 0,1%

ALCANCE: cambia el CONSUMO de una linea que YA existe en la BOM. No da de alta ni borra
lineas (decision de Fak 2026-08-05).

=== LO QUE SE APRENDIO ROMPIENDO (no tocar sin releer esto) ===

1. HAY DOS BOTONES `&Acepta` en la misma ventana: el de la solapa Altas (graba la carga) y
   el de la solapa Listado (dispara el export). El segundo NACE recien cuando alguien usa
   esa solapa. Buscar "el Button que dice Acepta" agarra el que aparezca primero, y si es
   el equivocado el foco no llega nunca -> el recorrido tabula al vacio. Es la explicacion
   mas probable de por que el 04/08 anduvieron las primeras 9 piezas y fallaron las ultimas
   (Fak habia exportado en el medio). Aca el boton se DESEMPATA y se aborta si hay duda.

2. EL SCROLL NO ES UN PROBLEMA. Se grabaron OK piezas de 6 y 7 insumos, con la grilla
   scrolleando. Lo que NO sobrevive al scroll es un mapa de handles: los controles se
   reciclan. Por eso el recorrido se verifica por CONTENIDO contra la BOM, no por handle.

3. EL RECORRIDO VA CON TECLADO REAL. El TAB por mensaje lo procesa la grilla y cicla; el
   de teclado real lo procesa el dialogo y sale al boton. Escribir y leer si van por
   mensaje: no necesitan foco y son instantaneos.

4. LA FORMULA, medida de la grabacion de Fak (21-8909, 5 insumos, 27 TAB exactos):
       de `Parte Superior` a la Cantidad de la fila i (base 0):  3 + 5*i
       de `Parte Superior` al boton &Acepta, con N insumos:      5*N + 2
   Son 5 celdas tabulables por fila, no 7: `Descripcion` y `U.M.` existen como controles
   (por eso Cantidad es el indice 4 al leer) pero NO reciben el foco.

5. ESC NO CANCELA: en el arb avanza de campo. Para abandonar sin grabar se usa CANCELA.

6. LA PANTALLA NO PRUEBA QUE SE GRABO. Escribir por mensaje deja la pantalla con el valor
   nuevo y la base con el viejo. La unica prueba es --verificar contra el export.

MIENTRAS CORRE, NO TOCAR LA PC: el teclado real cae donde este el foco. Si la ventana deja
de estar al frente, se aborta el lote entero — no se reintenta, no se sigue con la siguiente.
"""
import argparse
import csv
import ctypes
import ctypes.wintypes as w
import io
import json
import os
import re
import sys
import time

import win32con
import win32gui
import win32process

u = ctypes.windll.user32
k32 = ctypes.windll.kernel32

# En 64 bits hay que declarar los tipos o los handles se truncan y parece fallo
# (misma trampa que el hook de _arbGrabar.py).
u.SetFocus.argtypes = [w.HWND]
u.SetFocus.restype = w.HWND
u.GetForegroundWindow.restype = w.HWND
u.GetParent.argtypes = [w.HWND]
u.GetParent.restype = w.HWND
u.GetNextDlgTabItem.argtypes = [w.HWND, w.HWND, w.BOOL]
u.GetNextDlgTabItem.restype = w.HWND
u.AttachThreadInput.argtypes = [w.DWORD, w.DWORD, w.BOOL]
u.AttachThreadInput.restype = w.BOOL
u.GetWindowLongW.argtypes = [w.HWND, ctypes.c_int]
u.GetWindowLongW.restype = ctypes.c_long
k32.GetCurrentThreadId.restype = w.DWORD

KEYUP = 0x0002
EM_SETSEL = 0x00B1
WM_GETDLGCODE = 0x0087
GWL_STYLE = -16
WS_TABSTOP = 0x00010000
WS_DISABLED = 0x08000000
ES_READONLY = 0x0800

COLS = ['rubro', 'codigo', 'descripcion', 'unidad', 'cantidad', 'modulo', 'proceso']
TABULABLES = [0, 1, 4, 5, 6]          # descripcion y unidad no reciben foco
IDX_CODIGO, IDX_CANTIDAD = 1, 4
EXPORT = r'C:\tmp\RELACIONES.TXT'
CACHE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.arb-cache')


class Abortar(Exception):
    """Algo no cuadra: se corta sin apretar ENTER. Nada toco la base."""


class GUITHREADINFO(ctypes.Structure):
    _fields_ = [('cbSize', w.DWORD), ('flags', w.DWORD), ('hwndActive', w.HWND),
                ('hwndFocus', w.HWND), ('hwndCapture', w.HWND), ('hwndMenuOwner', w.HWND),
                ('hwndMoveSize', w.HWND), ('hwndCaret', w.HWND), ('rcCaret', w.RECT)]


# ---------------------------------------------------------------- ventana y controles

def foco_de(hwnd):
    """hwndFocus del thread de la ventana. None si la ventana no esta activa."""
    tid, _ = win32process.GetWindowThreadProcessId(hwnd)
    gi = GUITHREADINFO()
    gi.cbSize = ctypes.sizeof(GUITHREADINFO)
    return gi.hwndFocus if u.GetGUIThreadInfo(tid, ctypes.byref(gi)) else None


def leer(h):
    if not h:
        return ''
    n = u.SendMessageW(h, win32con.WM_GETTEXTLENGTH, 0, 0)
    if n <= 0:
        return ''
    b = ctypes.create_unicode_buffer(n + 1)
    u.SendMessageW(h, win32con.WM_GETTEXT, n + 1, b)
    return b.value.strip()


def V():
    r = []

    def cb(h, _):
        if win32gui.IsWindowVisible(h) and 'Maestro de Relaciones' in win32gui.GetWindowText(h):
            r.append(h)
        return True
    win32gui.EnumWindows(cb, None)
    return r[0] if r else None


def C(v):
    """Todos los controles bajo v, deduplicados. (rect_relativo, hwnd, clase)

    El rect es RELATIVO a la ventana: con coordenadas de pantalla absolutas, mover la
    ventana de monitor rompia la deteccion de la grilla en silencio.
    """
    base = win32gui.GetWindowRect(v)
    vis, out = set(), []

    def rec(p):
        def cb(h, _):
            if h not in vis:
                vis.add(h)
                r = win32gui.GetWindowRect(h)
                out.append(((r[0] - base[0], r[1] - base[1]), h, win32gui.GetClassName(h)))
                rec(h)
            return True
        try:
            win32gui.EnumChildWindows(p, cb, None)
        except Exception:
            pass
    rec(v)
    return out


def G(v):
    """La grilla: filas de 7 handles ordenados por X. Sin umbrales magicos: una fila de la
    grilla es un grupo de >=5 controles editables a la misma altura."""
    por_y = {}
    for r, h, c in C(v):
        if c in ('RichEdit20A', 'Edit'):
            por_y.setdefault(r[1], []).append((r[0], h))
    return [[h for _, h in sorted(por_y[y])] for y in sorted(por_y) if len(por_y[y]) >= 5]


def campo_producto(v):
    """`Parte Superior`: el editable mas arriba que NO es parte de una fila de la grilla."""
    por_y = {}
    for r, h, c in C(v):
        if c in ('RichEdit20A', 'Edit'):
            por_y.setdefault(r[1], []).append((r[0], h))
    sueltos = [(y, sorted(por_y[y])[0][1]) for y in sorted(por_y) if len(por_y[y]) < 5]
    return sueltos[0][1] if sueltos else None


def estilo(h):
    return u.GetWindowLongW(h, GWL_STYLE)


def ancestros(h, tope):
    out = []
    while h and h != tope:
        h = u.GetParent(h)
        if h:
            out.append(h)
    return out


def botones_acepta(v):
    return [(r, h) for r, h, c in C(v)
            if c == 'Button' and leer(h).replace('&', '').strip().lower() == 'acepta']


def boton_acepta(v, ancla):
    """El &Acepta de la MISMA pagina que la grilla. Aborta si no puede desempatar.

    Hay dos en la ventana (Altas y Listado) y el de Listado nace al usar esa solapa.
    Agarrar el equivocado es tabular al vacio para siempre.
    """
    cands = botones_acepta(v)
    if not cands:
        raise Abortar('no encuentro ningun boton &Acepta')
    if len(cands) == 1:
        return cands[0][1]
    fam = set(ancestros(ancla, v))
    mismos = [(len(fam & set(ancestros(h, v))), h) for _, h in cands]
    mejor = max(m[0] for m in mismos)
    ganadores = [h for n, h in mismos if n == mejor]
    if mejor == 0 or len(ganadores) != 1:
        raise Abortar('hay %d botones &Acepta y no puedo desempatar cual es el de Altas '
                      '(handles: %s). No escribo nada.'
                      % (len(cands), ', '.join(str(h) for _, h in cands)))
    return ganadores[0]


def abrir():
    v = V()
    if v:
        return v
    prod = []

    def cb(h, _):
        if win32gui.IsWindowVisible(h) and win32gui.GetWindowText(h).strip() == 'Producción':
            prod.append(h)
        return True
    win32gui.EnumWindows(cb, None)
    if prod:
        try:
            win32gui.SetForegroundWindow(prod[0])
        except Exception:
            pass
        time.sleep(0.8)
    tecla(win32con.VK_MENU, 0.5)      # doble Alt muestra los KeyTips
    tecla(ord('V'), 0.7)
    tecla(ord('Y'), 0.25)
    tecla(ord('3'), 2.0)
    return V()


def al_frente(v):
    return u.GetForegroundWindow() == v


def activar(v):
    if not al_frente(v):
        try:
            win32gui.SetForegroundWindow(v)
        except Exception:
            pass
        time.sleep(0.3)
    return al_frente(v)


# ---------------------------------------------------------------- entrada

def tecla(vk, pausa=0.03):
    """Teclado REAL. Cae donde este el foco del sistema."""
    u.keybd_event(vk, 0, 0, 0)
    time.sleep(0.012)
    u.keybd_event(vk, 0, KEYUP, 0)
    time.sleep(pausa)


def escribir_celda(h, texto):
    """Selecciona todo y escribe encima, por mensaje. Sin foco, sin borrar de a un SUPR."""
    u.SendMessageW(h, EM_SETSEL, 0, -1)
    time.sleep(0.04)
    for ch in texto:
        u.PostMessageW(h, win32con.WM_CHAR, ord(ch), 0)
        time.sleep(0.012)
    time.sleep(0.12)


def msg_tab(h, pausa=0.15):
    """TAB por mensaje: sirve para traer la BOM, NO para recorrer."""
    u.PostMessageW(h, win32con.WM_KEYDOWN, win32con.VK_TAB, 0)
    time.sleep(0.03)
    u.PostMessageW(h, win32con.WM_KEYUP, win32con.VK_TAB, 0)
    time.sleep(pausa)


# ---------------------------------------------------------------- numeros

def num(s):
    try:
        return float(str(s).strip().replace(',', '.'))
    except (ValueError, AttributeError, TypeError):
        return None


def mismo_numero(a, b, tol=0.001):
    """Tolerancia 0,1% (regla consumos-entregables). La grilla muestra 0.0200000 y el
    export 0,02000000: comparar strings no sirve."""
    x, y = num(a), num(b)
    if x is None or y is None:
        return False
    if y == 0:
        return x == 0
    return abs(x - y) / abs(y) <= tol


# ---------------------------------------------------------------- el export

def bom_del_export(path=EXPORT):
    """{producto: [ {codigo, cantidad, modulo, proceso, rubro} ]} en el orden del archivo."""
    if not os.path.exists(path):
        return None
    d = {}
    for ln in io.open(path, encoding='latin-1').read().splitlines():
        c = ln.split('\t')
        if len(c) >= 8 and c[0].strip() and re.match(r'^[0-9]', c[0].strip()):
            d.setdefault(c[0].strip(), []).append(
                {'rubro': c[1].strip(), 'codigo': c[2].strip(), 'cantidad': c[5].strip(),
                 'modulo': c[6].strip(), 'proceso': c[7].strip()})
    return d


def edad_export(path=EXPORT):
    return (time.time() - os.path.getmtime(path)) / 60 if os.path.exists(path) else None


# ---------------------------------------------------------------- traer un producto

def en_solapa_altas(v):
    """La solapa de Altas es la unica que tiene la grilla de insumos.

    Sin este gate el script escribe a ciegas: estando en la solapa `Listado`,
    `campo_producto()` devuelve `Desde Articulo` y el codigo termina en el filtro
    del reporte. Inofensivo ahi, pero es la misma escritura a ciegas que en otra
    solapa podria caer en un dato.
    """
    return len(G(v)) > 0


def traer(v, producto):
    if not en_solapa_altas(v):
        raise Abortar('no veo la grilla de insumos: la ventana esta en otra solapa. '
                      'Anda a `Altas de Insumos de Un Producto` y volve a correr.')
    ps = campo_producto(v)
    if not ps:
        raise Abortar('no veo el campo `Parte Superior`')
    activar(v)
    escribir_con_foco(v, ps, producto)
    if leer(ps).strip() != producto:
        raise Abortar('no entro el codigo del producto (quedo "%s")' % leer(ps))
    msg_tab(ps, 1.6)
    return ps, G(v)


def filas_con_datos(g):
    return [f for f in g if len(f) > IDX_CANTIDAD and leer(f[IDX_CODIGO]).strip()]


def ubicar(bom, codigo):
    """Indice de la fila del insumo POR CODIGO, nunca por posicion."""
    for i, f in enumerate(bom):
        if f['codigo'] == codigo:
            return i
    return None


def chequear_pantalla(v, producto, bom):
    """La grilla visible tiene que coincidir con la BOM del export, en orden.
    Si no coincide, la ventana esta en un estado que no entendemos: no se escribe."""
    filas = filas_con_datos(G(v))
    if not filas:
        raise Abortar('la grilla quedo vacia: no se trajo la BOM de %s' % producto)
    n_vis = min(len(bom), len(filas))
    for i in range(n_vis):
        en_pant = leer(filas[i][IDX_CODIGO]).strip()
        # el export trunca el codigo a 15; la grilla tambien
        if en_pant[:15] != bom[i]['codigo'][:15]:
            raise Abortar('la pantalla no coincide con el export en la fila %d '
                          '("%s" vs "%s") — el export puede estar viejo. Re-exporta.'
                          % (i, en_pant, bom[i]['codigo']))
    return filas


# ---------------------------------------------------------------- la cadena de tabulacion

def cadena_esperada(bom, cambios_por_fila):
    """[(etiqueta, texto_esperado, es_numero)] desde `Parte Superior` hasta &Acepta.

    Se arma de la BOM (no de handles) para que sobreviva al scroll de la grilla.
    """
    ch = []
    for i, f in enumerate(bom):
        val = cambios_por_fila.get(i, f['cantidad'])
        ch.append(('fila %d rubro' % i, f['rubro'], False))
        ch.append(('fila %d codigo' % i, f['codigo'][:15], False))
        ch.append(('fila %d CANTIDAD' % i, val, True))
        ch.append(('fila %d modulo' % i, f['modulo'], False))
        ch.append(('fila %d proceso' % i, f['proceso'], False))
    ch.append(('fila de alta (vacia)', '', False))
    ch.append(('BOTON &Acepta', 'Acepta', False))
    return ch


def coincide(real, esperado, es_numero):
    if es_numero:
        return mismo_numero(real, esperado)
    r = re.sub(r'\s+', ' ', (real or '').replace('&', '')).strip().lower()
    e = re.sub(r'\s+', ' ', (esperado or '').replace('&', '')).strip().lower()
    return r == e[:len(r)] or e == r[:len(e)] if (r and e) else r == e


def ir_a_celda(v, celda, maxpasos=60):
    """Parar el foco en un control, tabulando con TECLADO REAL.

    OJO: el TAB por mensaje AVANZA DE A DOS celdas (medido 2026-08-05:
    fila0.codigo -> fila0.modulo -> fila1.rubro -> fila1.cantidad ...). El arb traduce el
    WM_KEYDOWN a un WM_CHAR y procesa los dos. Asi recorre solo la mitad de las posiciones
    segun la paridad, y por eso el 04/08 unas piezas cargaban y otras no: dependia de si
    la celda de Cantidad caia en la paridad alcanzable. El TAB real avanza de a una.
    """
    if not activar(v):
        raise Abortar('la ventana no esta al frente: no puedo tabular')
    for _ in range(maxpasos):
        f = foco_de(v)
        if f == celda:
            return True
        if f is None:
            raise Abortar('la ventana no esta activa: no puedo ubicar el foco')
        if not al_frente(v):
            raise Abortar('la ventana perdio el frente — no usar la PC')
        tecla(win32con.VK_TAB, 0.04)
    return False


def escribir_con_foco(v, h, texto):
    """En el arb, escribir por mensaje SOLO entra bien si el control tiene el foco.

    Medido 2026-08-05: sin foco, `21-8908` queda `218908` (se pierde el guion) y un valor
    escrito en una celda se revierte al valor viejo en cuanto el recorrido pasa por ahi.
    La skill decia que escribir no necesitaba foco: estaba mal, y es la razon de fondo por
    la que las cargas parecian entrar y no grababan.
    """
    if foco_de(v) != h and not ir_a_celda(v, h):
        raise Abortar('no pude poner el foco en el control antes de escribir')
    escribir_celda(h, texto)


def posicion_actual(v, g, ps):
    """Donde esta el foco AHORA, como indice en la cadena esperada.

    -1 = en `Parte Superior` (antes de la cadena). None = no lo puedo ubicar.
    Medir esto en vez de asumirlo: despues de traer la BOM el foco NO queda en
    `Parte Superior`, y arrancar a tabular dando por sentado el punto de partida
    desalinea toda la cadena desde el primer TAB.
    """
    f = foco_de(v)
    if f is None:
        return None
    if f == ps:
        return -1
    for i, fila in enumerate(g):
        for c, h in enumerate(fila):
            if h == f and c in TABULABLES:
                return i * 5 + TABULABLES.index(c)
    return None


def recorrer(v, btn, cadena, desde, pausa=0.03, verboso=False, escrituras=None):
    """TAB real desde `desde` (indice en la cadena) hasta el boton, verificando CADA paso.
    Ante la primera discrepancia aborta sin ENTER.

    `escrituras` = {indice_cadena: valor_nuevo}. Se escribe AL PASAR por la celda, con el
    foco puesto: el arb descarta lo que entra por mensaje en una celda que no tiene el
    foco — se ve en pantalla y al recorrer vuelve el valor viejo. Escribir durante el
    recorrido respeta ese mecanismo y ademas no cuesta una pasada extra.
    """
    escrituras = escrituras or {}
    for p in range(desde + 1, len(cadena)):
        if not al_frente(v):
            raise Abortar('la ventana perdio el frente en el paso %d — no usar la PC' % p)
        tecla(win32con.VK_TAB, pausa)
        f = foco_de(v)
        etiq, esp, esnum = cadena[p]
        if etiq.startswith('BOTON'):
            if f != btn:
                raise Abortar('tras el TAB %d el foco no quedo en &Acepta' % (p + 1))
            if verboso:
                print('   TAB %2d -> >>> BOTON &Acepta <<<' % (p + 1))
            return True
        real = leer(f)
        if verboso:
            print('   TAB %2d -> %-22s "%s"%s' % (p + 1, etiq, real[:20],
                                                  '' if coincide(real, esp, esnum) else '  <-- NO'))
        if not coincide(real, esp, esnum):
            raise Abortar('TAB %d: esperaba %s="%s" y el foco cayo en "%s"'
                          % (p + 1, etiq, esp, real))
        if p in escrituras:
            nuevo = escrituras[p]
            escribir_celda(f, nuevo)
            if not mismo_numero(leer(f), nuevo):
                raise Abortar('TAB %d: escribi %s en %s y quedo "%s" (SIN grabar)'
                              % (p + 1, nuevo, etiq, leer(f)))
            if verboso:
                print('           escrito: %s -> %s' % (real, nuevo))
    raise Abortar('la cadena se agoto sin llegar al boton')


# ---------------------------------------------------------------- diagnostico (cero teclas)

def diagnostico(v, producto):
    print('DIAGNOSTICO %s — read-only, no se aprieta NINGUNA tecla' % producto)
    print('=' * 74)
    ps, g = traer(v, producto)
    filas = filas_con_datos(g)
    print('insumos en pantalla: %d' % len(filas))

    cands = botones_acepta(v)
    print()
    print('--- botones &Acepta: %d ---' % len(cands))
    for r, h in cands:
        print('   hwnd=%-9d pos=%-14s padres=%s' % (h, str(r), ancestros(h, v)[:2]))
    if len(cands) > 1:
        print('   OJO: mas de uno. El de la solapa Listado aparece al usar esa solapa;')
        print('   agarrar el equivocado es lo que deja el recorrido tabulando al vacio.')
    try:
        btn = boton_acepta(v, filas[0][IDX_CANTIDAD]) if filas else None
        print('   -> desempatado: hwnd=%s' % btn)
    except Abortar as e:
        btn = None
        print('   -> NO SE PUEDE DESEMPATAR: %s' % e)

    print()
    print('--- estilos de la fila 0 (quien es tab stop de verdad) ---')
    if filas:
        for c, h in enumerate(filas[0]):
            s = estilo(h)
            dlg = u.SendMessageW(h, WM_GETDLGCODE, 0, 0)
            print('   %-12s hwnd=%-9d tabstop=%-3s readonly=%-3s dlgcode=0x%04X  "%s"'
                  % (COLS[c] if c < 7 else '?', h, 'SI' if s & WS_TABSTOP else 'no',
                     'SI' if s & ES_READONLY else 'no', dlg, leer(h)[:16]))
        print('   (esperado: tab stop en %s)' % ', '.join(COLS[i] for i in TABULABLES))

    print()
    print('--- cadena del dialogo (GetNextDlgTabItem, no mueve el foco) ---')
    if filas:
        padre = u.GetParent(filas[0][IDX_CANTIDAD])
        cur, vistos = filas[0][IDX_CANTIDAD], []
        for _ in range(60):
            nxt = u.GetNextDlgTabItem(padre, cur, False)
            if not nxt or nxt in vistos:
                break
            vistos.append(nxt)
            cur = nxt
            if btn and nxt == btn:
                break
        if vistos:
            print('   %d saltos desde Cantidad f0; llega al boton: %s'
                  % (len(vistos), 'SI' if btn and vistos[-1] == btn else 'no'))
        else:
            print('   no devuelve cadena (la grilla maneja su propio TAB)')

    bom = (bom_del_export() or {}).get(producto)
    print()
    print('--- pantalla vs export ---')
    if not bom:
        print('   %s no esta en el export (o el export no existe)' % producto)
    else:
        print('   export: %d insumos   pantalla: %d   edad del export: %.0f min'
              % (len(bom), len(filas), edad_export() or -1))
        try:
            chequear_pantalla(v, producto, bom)
            print('   coinciden en orden: OK')
        except Abortar as e:
            print('   NO COINCIDEN: %s' % e)
        print('   TAB predichos de `Parte Superior` a &Acepta: 5*%d+2 = %d'
              % (len(bom), 5 * len(bom) + 2))
    print()
    print('No se apreto ninguna tecla. Nada tocado.')
    return True


# ---------------------------------------------------------------- seco (sin escribir)

def seco(v, producto):
    print('RECORRIDO SECO %s — tabula sin escribir y SIN ENTER' % producto)
    print('=' * 74)
    bom = (bom_del_export() or {}).get(producto)
    if not bom:
        print('no tengo la BOM de %s en el export' % producto); return False
    ps, g = traer(v, producto)
    filas = chequear_pantalla(v, producto, bom)
    btn = boton_acepta(v, filas[0][IDX_CANTIDAD])
    if not activar(v):
        print('no pude traer la ventana al frente'); return False
    cadena = cadena_esperada(bom, {})
    pos = posicion_actual(v, G(v), ps)
    if pos is None:
        print('no puedo ubicar donde esta el foco: no arranco a tabular a ciegas')
        return False
    print('foco en: %s' % ('`Parte Superior`' if pos < 0 else cadena[pos][0]))
    try:
        recorrer(v, btn, cadena, pos, 0.05, verboso=True)
    except Abortar as e:
        print()
        print('CORTADO: %s' % e)
        print('Nada grabado. Apreta CANCELA en el arb (ESC NO cancela, avanza de campo).')
        return False
    print()
    print('CADENA CONFIRMADA: %d TAB (5*%d+2) y el foco quedo en &Acepta. No se apreto ENTER.'
          % (len(cadena), len(bom)))
    print('Apreta CANCELA en el arb para salir sin grabar.')
    return True


# ---------------------------------------------------------------- cargar

def journal(evento):
    os.makedirs(CACHE, exist_ok=True)
    p = os.path.join(CACHE, 'carga_%s.jsonl' % time.strftime('%Y%m%d'))
    with io.open(p, 'a', encoding='utf-8') as f:
        f.write(json.dumps(evento, ensure_ascii=False) + '\n')
        f.flush()
        os.fsync(f.fileno())


def cargar_producto(v, producto, cambios, bom):
    """cambios: [(codigo, nuevo, esperado)]. Todas las lineas del producto en UNA pasada."""
    ps, g = traer(v, producto)
    filas = chequear_pantalla(v, producto, bom)

    escrituras, detalle = {}, []
    for cod, nuevo, esperado in cambios:
        i = ubicar(bom, cod)
        if i is None:
            raise Abortar('no encuentro %s en la BOM de %s' % (cod, producto))
        if i >= len(filas):
            raise Abortar('%s esta en la fila %d y la grilla muestra %d: hay que scrollear '
                          'para escribirla, y eso no esta resuelto' % (cod, i, len(filas)))
        actual = leer(filas[i][IDX_CANTIDAD])
        if esperado and not mismo_numero(actual, esperado):
            raise Abortar('%s tiene %s y esperaba %s — no lo piso' % (cod, actual, esperado))
        escrituras[i * 5 + 2] = nuevo          # 2 = posicion de Cantidad dentro de la fila
        detalle.append((cod, actual, nuevo))

    btn = boton_acepta(v, filas[0][IDX_CANTIDAD])
    if not activar(v):
        raise Abortar('no pude traer la ventana al frente (nada escrito)')

    # pararse en la PRIMERA celda a cambiar, y recien ahi arrancar el recorrido real
    primera = min(escrituras)
    celda = filas[primera // 5][IDX_CANTIDAD]
    if not ir_a_celda(v, celda):
        raise Abortar('no me pude parar en la celda de %s (nada escrito)' % detalle[0][0])
    pos = posicion_actual(v, G(v), ps)
    if pos != primera:
        raise Abortar('me pare en el paso %s y esperaba el %d (nada escrito)' % (pos, primera))
    journal({'t': time.strftime('%H:%M:%S'), 'producto': producto,
             'estado': 'por_escribir', 'detalle': detalle})
    # la primera se escribe aca (el foco ya esta puesto); las demas, al pasar
    escribir_celda(celda, escrituras[primera])
    if not mismo_numero(leer(celda), escrituras[primera]):
        raise Abortar('la escritura no entro (quedo "%s") — SIN grabar' % leer(celda))
    resto = {k: val for k, val in escrituras.items() if k != primera}
    recorrer(v, btn, cadena_esperada(bom, {primera // 5: escrituras[primera]}), pos,
             escrituras=resto)
    journal({'t': time.strftime('%H:%M:%S'), 'producto': producto, 'estado': 'por_grabar'})
    tecla(win32con.VK_RETURN, 1.2)          # <- ESTO es lo que graba
    journal({'t': time.strftime('%H:%M:%S'), 'producto': producto, 'estado': 'enter_ok'})
    return detalle


# ---------------------------------------------------------------- tabla

def leer_tabla(path):
    filas = []
    with io.open(path, encoding='utf-8-sig') as f:
        for r in csv.DictReader(f):
            r = {(k or '').strip().lower(): (v or '').strip() for k, v in r.items()}
            if not r.get('producto'):
                continue
            filas.append((r['producto'], r['insumo'], r['valor_nuevo'],
                          r.get('valor_esperado', '')))
    return filas


def agrupar(filas):
    orden, por = [], {}
    for prod, cod, nuevo, esp in filas:
        if prod not in por:
            por[prod] = []
            orden.append(prod)
        por[prod].append((cod, nuevo, esp))
    return [(p, por[p]) for p in orden]


# ---------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser(description='Cambiar consumos en el arb')
    ap.add_argument('--diagnostico', metavar='PRODUCTO', help='read-only, cero teclas')
    ap.add_argument('--seco', metavar='PRODUCTO', help='recorre sin escribir ni grabar')
    ap.add_argument('--tabla', metavar='CSV')
    ap.add_argument('--apply', action='store_true', help='sin esto es dry-run')
    ap.add_argument('--solo', metavar='PRODUCTO', help='una sola pieza del lote')
    ap.add_argument('--verificar', metavar='CSV')
    a = ap.parse_args()

    if a.verificar:
        return verificar(a.verificar)
    if not (a.diagnostico or a.seco or a.tabla):
        ap.error('elegi --diagnostico, --seco, --tabla o --verificar')

    if a.tabla and not a.apply:
        grupos = agrupar(leer_tabla(a.tabla))
        if a.solo:
            grupos = [g for g in grupos if g[0] == a.solo]
        boms = bom_del_export() or {}
        print('DRY-RUN — nada se toca. Agrega --apply para cargar de verdad.')
        print('%-10s %-18s %-14s %-14s %-8s %s' %
              ('PRODUCTO', 'INSUMO', 'ESPERADO', 'NUEVO', 'INSUMOS', 'TAB'))
        for prod, cambios in grupos:
            bom = boms.get(prod)
            n = len(bom) if bom else 0
            for cod, nuevo, esp in cambios:
                print('%-10s %-18s %-14s %-14s %-8s %s' %
                      (prod, cod, esp or '-', nuevo, n or '?', 5 * n + 2 if n else '?'))
        print('\n%d producto(s), %d linea(s). Export: %.0f min de antiguedad.'
              % (len(grupos), sum(len(c) for _, c in grupos), edad_export() or -1))
        return 0

    v = abrir()
    if not v:
        sys.exit('no encuentro la ventana — abri el arb, logueate, y dejalo en '
                 'Menu de Insumos -> Relacion de Consumo')

    if a.diagnostico or a.seco:
        try:
            fn = diagnostico if a.diagnostico else seco
            return 0 if fn(v, a.diagnostico or a.seco) else 1
        except Abortar as e:
            print('CORTADO: %s' % e)
            return 1

    boms = bom_del_export()
    if boms is None:
        sys.exit('no encuentro %s — exporta RELACIONES antes de cargar' % EXPORT)
    ed = edad_export()
    if ed > 60:
        sys.exit('el export tiene %.0f min: puede no reflejar el estado real. Re-exporta.' % ed)

    grupos = agrupar(leer_tabla(a.tabla))
    if a.solo:
        grupos = [g for g in grupos if g[0] == a.solo]
    print('%d producto(s). NO TOQUES LA PC mientras corre.' % len(grupos))
    print('=' * 74)
    t0, res = time.time(), []
    for i, (prod, cambios) in enumerate(grupos, 1):
        bom = boms.get(prod)
        if not bom:
            print('%2d/%d  %-9s FALLO: no esta en el export (anulado?)' % (i, len(grupos), prod))
            res.append((prod, False, 'no esta en el export'))
            continue
        try:
            detalle = cargar_producto(v, prod, cambios, bom)
            res.append((prod, True, ''))
            for cod, antes, ahora in detalle:
                print('%2d/%d  %-9s %-18s %-13s -> %-13s grabado'
                      % (i, len(grupos), prod, cod, antes, ahora))
        except Abortar as e:
            res.append((prod, False, str(e)))
            print('%2d/%d  %-9s FALLO: %s' % (i, len(grupos), prod, e))
            journal({'t': time.strftime('%H:%M:%S'), 'producto': prod,
                     'estado': 'abortada', 'motivo': str(e)})
            if 'no usar la PC' in str(e) or 'frente' in str(e):
                print()
                print('LOTE CORTADO. La ventana quedo en %s con el valor escrito y SIN' % prod)
                print('grabar. Apreta CANCELA (NO ACEPTA, NO ESC). El resto no se intento.')
                break

    ok = sum(1 for r in res if r[1])
    seg = time.time() - t0
    print('=' * 74)
    print('GRABADOS: %d de %d   (%.0f seg, %.1f seg/producto)'
          % (ok, len(grupos), seg, seg / max(len(res), 1)))
    for prod, bien, msg in res:
        if not bien:
            print('   PENDIENTE %-9s %s' % (prod, msg))
    print()
    print('Esto NO prueba que se grabo. Exporta RELACIONES de nuevo y corre:')
    print('   python scripts/_arbCargar.py --verificar %s' % a.tabla)
    return 0 if ok == len(grupos) else 1


def verificar(path):
    boms = bom_del_export()
    if boms is None:
        sys.exit('no encuentro %s — exporta RELACIONES desde el arb primero' % EXPORT)
    ed = edad_export()
    print('export: %s  (%.0f min de antiguedad)' % (EXPORT, ed))
    if ed > 30:
        print('!! mas de media hora: puede ser anterior a la carga. Re-exporta.')
    print('=' * 78)
    print('%-10s %-18s %-15s %-15s %s' % ('PRODUCTO', 'INSUMO', 'EN EL ARB', 'ESPERADO', ''))
    bien = mal = 0
    for prod, cod, nuevo, _ in leer_tabla(path):
        fila = next((f for f in boms.get(prod, []) if f['codigo'][:15] == cod[:15]), None)
        real = fila['cantidad'] if fila else None
        if real is None:
            print('%-10s %-18s %-15s %-15s NO ESTA EN EL EXPORT' % (prod, cod, '-', nuevo))
            mal += 1
        elif mismo_numero(real, nuevo):
            print('%-10s %-18s %-15s %-15s OK' % (prod, cod, real, nuevo))
            bien += 1
        else:
            print('%-10s %-18s %-15s %-15s  <-- NO COINCIDE' % (prod, cod, real, nuevo))
            mal += 1
    print('=' * 78)
    print('%d OK, %d mal   (tolerancia 0,1%%)' % (bien, mal))
    return 1 if mal else 0


if __name__ == '__main__':
    sys.exit(main() or 0)
