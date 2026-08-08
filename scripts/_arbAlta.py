# -*- coding: utf-8 -*-
"""Dar de ALTA una linea nueva en la BOM de un producto del arb.

    python scripts/_arbAlta.py --producto "<PRODUCTO>" --insumo <INSUMO> \
        --cantidad 0.00000000 --modulo <MOD> --proceso <PROC> [--apply]

Este repo es PUBLICO: los ejemplos van con placeholders, nunca con codigos ni consumos
reales (regla `repo_publico_no_datos_empresa`).

Secuencia dictada por Fak (2026-08-07): al llegar a la ultima linea cargada y tabular de
nuevo, el foco cae en el primer renglon vacio. Ahi se carga rubro `1`, TAB, el codigo del
insumo, TAB (la descripcion y la unidad se saltean solas), el consumo, TAB, modulo, TAB,
proceso; y despues TAB hasta &Acepta.

Un alta NO se deshace tipeando el valor viejo, asi que:
  · se verifica CADA celda contra lo esperado antes de escribir la siguiente;
  · antes del ENTER se saca una FOTO y se leen las 5 celdas del renglon nuevo;
  · sin --apply no se aprieta ENTER (queda escrito en pantalla y se descarta con CANCELA).
"""
import argparse
import importlib.util
import os
import sys
import time

import win32con

_spec = importlib.util.spec_from_file_location(
    'ac', os.path.join(os.path.dirname(os.path.abspath(__file__)), '_arbCargar.py'))
ac = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(ac)

_spec2 = importlib.util.spec_from_file_location(
    'av', os.path.join(os.path.dirname(os.path.abspath(__file__)), '_arbVer.py'))
av = importlib.util.module_from_spec(_spec2)
_spec2.loader.exec_module(av)


def cadena_con_alta(bom):
    """La cadena normal + las 5 celdas del renglon nuevo (vacias) + el boton."""
    ch = []
    for i, f in enumerate(bom):
        ch.append(('fila %d rubro' % i, f['rubro'], False))
        ch.append(('fila %d codigo' % i, f['codigo'][:15], False))
        ch.append(('fila %d CANTIDAD' % i, f['cantidad'], True))
        ch.append(('fila %d modulo' % i, f['modulo'], False))
        ch.append(('fila %d proceso' % i, f['proceso'], False))
    for c in ('rubro', 'codigo', 'CANTIDAD', 'modulo', 'proceso'):
        ch.append(('ALTA %s' % c, '', False))
    ch.append(('BOTON &Acepta', 'Acepta', False))
    return ch


def alta(producto, insumo, cantidad, modulo, proceso, apply=False):
    v = ac.V()
    if not v:
        raise SystemExit('no encuentro la ventana Maestro de Relaciones')
    boms = ac.bom_del_export()
    bom = boms.get(producto)
    if not bom:
        raise SystemExit('no tengo la BOM de %s en el export' % producto)
    if any(f['codigo'] == insumo for f in bom):
        raise SystemExit('%s YA esta en la BOM de %s: esto seria un duplicado' % (insumo, producto))

    n = len(bom)
    print('%s: %d insumos. El renglon nuevo es la fila %d.' % (producto, n, n))
    ps, g = ac.traer(v, producto)
    filas = ac.chequear_pantalla(v, producto, bom)
    btn = ac.boton_acepta(v, filas[0][ac.IDX_CANTIDAD])
    if not ac.activar(v):
        raise SystemExit('no pude traer la ventana al frente (nada escrito)')

    # anclar en la ultima fila visible y tabular hasta el rubro del renglon nuevo
    ancla = len(filas) - 1
    if not ac.ir_a_celda(v, filas[ancla][ac.IDX_CANTIDAD]):
        raise SystemExit('no me pude parar en la ultima fila visible (nada escrito)')
    pos = ac.posicion_actual(v, ac.G(v), ps)
    if pos != ancla * 5 + 2:
        raise SystemExit('me pare en el paso %s y esperaba %d (nada escrito)' % (pos, ancla * 5 + 2))

    cadena = cadena_con_alta(bom)
    valores = {n * 5: '1', n * 5 + 1: insumo, n * 5 + 2: cantidad,
               n * 5 + 3: modulo, n * 5 + 4: proceso}
    escritas = []
    for p in range(pos + 1, n * 5 + 5):
        if not ac.al_frente(v):
            raise SystemExit('la ventana perdio el frente en el paso %d — no usar la PC' % p)
        ac.tecla(win32con.VK_TAB, 0.05)
        f = ac.foco_de(v)
        etiq, esp, esnum = cadena[p]
        real = ac.leer(f)
        if p not in valores:
            if not ac.coincide(real, esp, esnum):
                raise SystemExit('TAB %d: esperaba %s="%s" y cayo en "%s" (nada grabado)'
                                 % (p, etiq, esp, real))
            continue
        if real.strip():
            raise SystemExit('TAB %d: %s tendria que estar VACIA y dice "%s" — abortado'
                             % (p, etiq, real))
        ac.escribir_celda(f, valores[p])
        time.sleep(0.12)
        quedo = ac.leer(f)
        if quedo.strip()[:15] != valores[p].strip()[:15] and not ac.mismo_numero(quedo, valores[p]):
            raise SystemExit('TAB %d: escribi "%s" en %s y quedo "%s" — abortado (SIN grabar)'
                             % (p, valores[p], etiq, quedo))
        escritas.append((etiq, quedo))
        print('   %-16s <- %s' % (etiq, quedo))

    # GATE: mirar el renglon antes de grabar
    av.foto(v, '_alta_gate')
    fila_nueva = [ac.leer(h) for h in (ac.G(v)[-1] if ac.G(v) else [])]
    print('\nrenglon nuevo en pantalla: %s' % fila_nueva)
    if not apply:
        print('\nDRY-RUN: NO se apreta ENTER. Apreta CANCELA en el arb para descartar.')
        return
    # Despues de completar el renglon el arb abre OTRO renglon vacio, asi que un solo TAB
    # no cae en el boton. Se sigue tabulando hasta &Acepta, exigiendo que todo lo que se
    # pise en el camino este VACIO: si aparece algo escrito, el recorrido se desfaso.
    for _ in range(12):
        ac.tecla(win32con.VK_TAB, 0.05)
        f = ac.foco_de(v)
        if f == btn:
            break
        resto = ac.leer(f)
        if resto.strip():
            raise SystemExit('yendo al boton cai en una celda con "%s" — SIN grabar' % resto)
    else:
        raise SystemExit('no llegue a &Acepta despues de 12 TAB — SIN grabar')
    ac.tecla(win32con.VK_RETURN, 1.2)
    print('ENTER dado. Verificar con un export.')


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description='Dar de alta una linea en la BOM')
    ap.add_argument('--producto', required=True)
    ap.add_argument('--insumo', required=True)
    ap.add_argument('--cantidad', required=True)
    ap.add_argument('--modulo', required=True)
    ap.add_argument('--proceso', required=True)
    ap.add_argument('--apply', action='store_true')
    a = ap.parse_args()
    alta(a.producto, a.insumo, a.cantidad, a.modulo, a.proceso, a.apply)
