# -*- coding: utf-8 -*-
"""Sustituir el CODIGO de un insumo en una linea de BOM que ya existe, en el ERP arb.

    python scripts/_arbSustituir.py --tabla cambio.csv            DRY-RUN (default)
    python scripts/_arbSustituir.py --tabla cambio.csv --apply
    python scripts/_arbSustituir.py --tabla cambio.csv --solo <PRODUCTO>
    python scripts/_arbSustituir.py --verificar cambio.csv        contra el export

CSV: `producto,viejo,nuevo` (una fila por producto terminado).

POR QUE UN SCRIPT APARTE: `_arbCargar.py` pisa la celda `Cantidad` (indice 2 de las 5
tabulables de cada fila) y compara los valores como NUMEROS. Aca se pisa la celda `Medida`
—el codigo del insumo, indice 1— y la comparacion es de TEXTO. El resto del metodo es el
mismo y se reusa importando `_arbCargar`: ventana, boton desempatado, recorrido con teclado
real, y verificacion celda por celda contra el export antes de escribir.

ES REVERSIBLE: el export previo guarda el codigo viejo de cada linea, asi que un cambio
equivocado se deshace corriendo la tabla al reves. Eso es lo que lo distingue de un alta o
una baja de linea.

FALLA AL LADO SEGURO: si al cambiar el codigo el arb borra la cantidad o el modulo de esa
fila, el recorrido encuentra una celda que no coincide con el export y **aborta sin apretar
ENTER** — no queda nada grabado. Ese caso significa que la sustitucion en el lugar no sirve
y hay que ir por alta + baja.

MIENTRAS CORRE, NO TOCAR LA PC.
"""
import argparse
import csv
import importlib.util
import io
import os
import sys
import time

import win32con

_RUTA = os.path.join(os.path.dirname(os.path.abspath(__file__)), '_arbCargar.py')
_spec = importlib.util.spec_from_file_location('_arbCargar', _RUTA)
C = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(C)

Abortar = C.Abortar
POS_CODIGO = 1          # posicion de `Medida` dentro de las 5 celdas tabulables de la fila


def cadena_esperada(bom, codigos_nuevos):
    """[(etiqueta, texto_esperado, es_numero)] desde el arranque hasta &Acepta.

    `codigos_nuevos` = {indice_fila: codigo} para las filas ya reescritas.
    """
    ch = []
    for i, f in enumerate(bom):
        ch.append(('fila %d rubro' % i, f['rubro'], False))
        ch.append(('fila %d CODIGO' % i, codigos_nuevos.get(i, f['codigo'])[:15], False))
        ch.append(('fila %d cantidad' % i, f['cantidad'], True))
        ch.append(('fila %d modulo' % i, f['modulo'], False))
        ch.append(('fila %d proceso' % i, f['proceso'], False))
    ch.append(('fila de alta (vacia)', '', False))
    ch.append(('BOTON &Acepta', 'Acepta', False))
    return ch


def recorrer(v, btn, cadena, desde, escrituras, verboso=True):
    """TAB real verificando CADA celda contra el export. Aborta sin ENTER a la primera
    discrepancia. `escrituras` = {indice_cadena: codigo_nuevo} (texto, no numero)."""
    for p in range(desde + 1, len(cadena)):
        if not C.asegurar_frente(v):
            raise Abortar('la ventana perdio el frente en el paso %d — no usar la PC' % p)
        C.tecla(win32con.VK_TAB, 0.03)
        f = C.foco_de(v)
        etiq, esp, esnum = cadena[p]
        if etiq.startswith('BOTON'):
            if f != btn:
                raise Abortar('tras el TAB %d el foco no quedo en &Acepta' % (p + 1))
            if verboso:
                print('   TAB %2d -> >>> BOTON &Acepta <<<' % (p + 1))
            return True
        real = C.leer(f)
        ok = C.coincide(real, esp, esnum)
        if verboso:
            print('   TAB %2d -> %-22s "%s"%s' % (p + 1, etiq, real[:22], '' if ok else '  <-- NO'))
        if not ok:
            raise Abortar('TAB %d: esperaba %s="%s" y la celda dice "%s" (SIN grabar)'
                          % (p + 1, etiq, esp, real))
        if p in escrituras:
            nuevo = escrituras[p]
            C.escribir_celda(f, nuevo)
            quedo = C.leer(f)
            if quedo.strip() != nuevo.strip():
                raise Abortar('TAB %d: escribi "%s" y quedo "%s" (SIN grabar)'
                              % (p + 1, nuevo, quedo))
            if verboso:
                print('           %s -> %s' % (real, nuevo))
    raise Abortar('la cadena se agoto sin llegar al boton')


def sustituir_producto(v, producto, cambios, bom):
    """cambios: [(codigo_viejo, codigo_nuevo)]. Todas las lineas del producto en una pasada."""
    ps, g = C.traer(v, producto)
    filas = C.chequear_pantalla(v, producto, bom)

    escrituras, detalle, nuevos_por_fila = {}, [], {}
    for viejo, nuevo in cambios:
        i = C.ubicar(bom, viejo)
        if i is None:
            raise Abortar('no encuentro %s en la BOM de %s' % (viejo, producto))
        if len(nuevo) > 15:
            raise Abortar('%s tiene %d caracteres: no entra en el campo (15)' % (nuevo, len(nuevo)))
        if C.ubicar(bom, nuevo) is not None:
            raise Abortar('%s YA esta en la BOM de %s: quedaria duplicado' % (nuevo, producto))
        if i < len(filas):
            actual = C.leer(filas[i][C.IDX_CODIGO])
            if actual.strip() != viejo.strip():
                raise Abortar('la fila %d dice "%s" y esperaba "%s" — no la piso'
                              % (i, actual, viejo))
        else:
            actual = bom[i]['codigo'] + ' (del export)'
        escrituras[i * 5 + POS_CODIGO] = nuevo
        nuevos_por_fila[i] = nuevo
        detalle.append((producto, actual, nuevo, bom[i]['cantidad']))

    btn = C.boton_acepta(v, filas[0][C.IDX_CANTIDAD])
    if not C.activar(v):
        raise Abortar('no pude traer la ventana al frente (nada escrito)')

    primera = min(escrituras)
    C.journal({'t': time.strftime('%H:%M:%S'), 'producto': producto,
               'estado': 'por_escribir_codigo', 'detalle': detalle})

    fila0 = primera // 5
    if fila0 >= len(filas):
        ancla = len(filas) - 1
        if not C.ir_a_celda(v, filas[ancla][C.IDX_CANTIDAD]):
            raise Abortar('no me pude parar en la ultima fila visible (nada escrito)')
        pos = C.posicion_actual(v, C.G(v), ps)
        if pos != ancla * 5 + 2:
            raise Abortar('me pare en el paso %s y esperaba el %d (nada escrito)'
                          % (pos, ancla * 5 + 2))
        recorrer(v, btn, cadena_esperada(bom, nuevos_por_fila), pos, escrituras)
    else:
        celda = filas[fila0][C.IDX_CODIGO]
        if not C.ir_a_celda(v, celda):
            raise Abortar('no me pude parar en la celda del codigo (nada escrito)')
        pos = C.posicion_actual(v, C.G(v), ps)
        if pos != primera:
            raise Abortar('me pare en el paso %s y esperaba el %d (nada escrito)' % (pos, primera))
        C.escribir_celda(celda, escrituras[primera])
        quedo = C.leer(celda)
        if quedo.strip() != escrituras[primera].strip():
            raise Abortar('la escritura no entro (quedo "%s") — SIN grabar' % quedo)
        print('   celda %d: %s' % (primera, escrituras[primera]))
        resto = {kk: vv for kk, vv in escrituras.items() if kk != primera}
        recorrer(v, btn, cadena_esperada(bom, nuevos_por_fila), pos, resto)

    C.journal({'t': time.strftime('%H:%M:%S'), 'producto': producto, 'estado': 'por_grabar'})
    C.tecla(win32con.VK_RETURN, 1.2)              # <- esto es lo que graba
    C.journal({'t': time.strftime('%H:%M:%S'), 'producto': producto, 'estado': 'enter_ok'})
    return detalle


def leer_tabla(path):
    filas = []
    with io.open(path, encoding='utf-8-sig') as f:
        for r in csv.DictReader(f):
            r = {(kk or '').strip().lower(): (vv or '').strip() for kk, vv in r.items()}
            if not r.get('producto'):
                continue
            filas.append((r['producto'], r['viejo'], r['nuevo']))
    return filas


def agrupar(filas):
    orden, por = [], {}
    for prod, viejo, nuevo in filas:
        por.setdefault(prod, [])
        if prod not in orden:
            orden.append(prod)
        por[prod].append((viejo, nuevo))
    return [(p, por[p]) for p in orden]


def verificar(path):
    boms = C.bom_del_export() or {}
    ed = C.edad_export()
    print('export: %s  (%.0f min de antiguedad)' % (C.EXPORT, ed))
    if ed > 30:
        print('!! mas de media hora: puede ser anterior a la carga. Re-exporta.')
    print('=' * 82)
    print('%-16s %-16s %-16s %s' % ('PRODUCTO', 'DEBE SALIR', 'DEBE ESTAR', ''))
    bien = mal = 0
    for prod, viejo, nuevo in leer_tabla(path):
        codigos = [f['codigo'].strip() for f in boms.get(prod, [])]
        esta_nuevo = any(c[:15] == nuevo[:15] for c in codigos)
        esta_viejo = any(c[:15] == viejo[:15] for c in codigos)
        if esta_nuevo and not esta_viejo:
            print('%-16s %-16s %-16s OK' % (prod, viejo, nuevo))
            bien += 1
        else:
            que = []
            if not esta_nuevo:
                que.append('falta el nuevo')
            if esta_viejo:
                que.append('el viejo sigue')
            print('%-16s %-16s %-16s  <-- %s' % (prod, viejo, nuevo, ' y '.join(que)))
            mal += 1
    print('=' * 82)
    print('%d OK, %d mal' % (bien, mal))
    return 1 if mal else 0


def main():
    ap = argparse.ArgumentParser(description='Sustituir el codigo de un insumo en la BOM')
    ap.add_argument('--tabla', metavar='CSV')
    ap.add_argument('--apply', action='store_true', help='sin esto es dry-run')
    ap.add_argument('--solo', metavar='PRODUCTO')
    ap.add_argument('--verificar', metavar='CSV')
    a = ap.parse_args()

    if a.verificar:
        return verificar(a.verificar)
    if not a.tabla:
        ap.error('elegi --tabla o --verificar')

    grupos = agrupar(leer_tabla(a.tabla))
    if a.solo:
        grupos = [gr for gr in grupos if gr[0] == a.solo]
        if not grupos:
            sys.exit('%s no esta en la tabla' % a.solo)
    boms = C.bom_del_export() or {}

    if not a.apply:
        print('DRY-RUN — nada se toca. Agrega --apply para cargar de verdad.')
        print('%-16s %-16s %-16s %-8s %-8s %s' %
              ('PRODUCTO', 'VIEJO', 'NUEVO', 'FILA', 'INSUMOS', 'CONSUMO'))
        for prod, cambios in grupos:
            bom = boms.get(prod)
            if not bom:
                print('%-16s  <-- NO ESTA EN EL EXPORT' % prod)
                continue
            for viejo, nuevo in cambios:
                i = C.ubicar(bom, viejo)
                print('%-16s %-16s %-16s %-8s %-8d %s' %
                      (prod, viejo, nuevo, i if i is not None else 'NO ESTA',
                       len(bom), bom[i]['cantidad'] if i is not None else '-'))
        return 0

    ed = C.edad_export()
    if ed > 60:
        sys.exit('el export tiene %.0f min: re-exporta antes de escribir' % ed)

    v = C.V()
    if v is None:
        v = C.abrir()
    hechos, fallados = [], []
    for prod, cambios in grupos:
        bom = boms.get(prod)
        print('\n=== %s ===' % prod)
        if not bom:
            print('   NO esta en el export — lo salteo')
            fallados.append((prod, 'no esta en el export'))
            continue
        try:
            det = sustituir_producto(v, prod, cambios, bom)
            for d in det:
                print('   OK  %s : %s -> %s   (consumo %s, sin tocar)' % d)
            hechos.append(prod)
        except Abortar as e:
            print('   ABORTADO: %s' % e)
            fallados.append((prod, str(e)))
        except Exception as e:                      # noqa: BLE001
            print('   ERROR: %s' % e)
            fallados.append((prod, str(e)))

    print('\n%d productos escritos, %d fallados' % (len(hechos), len(fallados)))
    for p, e in fallados:
        print('   %s: %s' % (p, e))
    print('\nLA PANTALLA NO PRUEBA NADA: re-exporta RELACIONES y corre --verificar.')
    return 1 if fallados else 0


if __name__ == '__main__':
    sys.exit(main() or 0)
