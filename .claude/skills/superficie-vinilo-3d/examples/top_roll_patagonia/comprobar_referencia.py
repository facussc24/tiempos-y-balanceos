# -*- coding: utf-8 -*-
"""Compara lo que dio sv_medir.py sobre el caso Top Roll contra numeros_referencia.json.

Se corre cada vez que se toca el medidor, despues de sv_selftest.py:
  python comprobar_referencia.py <carpeta_de_trabajo_con_del_numeros.json_y_tras_numeros.json>

El area total es EXACTA: tiene que dar lo mismo al centesimo. El reparto vista / doblez depende
de la malla: se acepta 1 %. Sale con 0 si todo cierra y con 1 si algo se movio.
(Si se toco sv_modelo.py, volver a generar los *_modelo.npz con --forzar antes: si no, se mide
sobre el cache viejo.)
"""
import json
import os
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
REF = json.load(open(os.path.join(AQUI, 'numeros_referencia.json'), encoding='utf-8'))
W = sys.argv[1]
mal = 0


def ver(nombre, valor, esperado, tol_abs=None, tol_rel=None):
    global mal
    tol = tol_abs if tol_abs is not None else abs(esperado) * tol_rel
    ok = abs(valor - esperado) <= tol
    mal += 0 if ok else 1
    print('  %s %-34s %10.2f  (referencia %10.2f, tolerancia %.2f)' % ('OK ' if ok else 'MAL', nombre, valor, esperado, tol))


for k in ('del', 'tras'):
    r = json.load(open(os.path.join(W, k + '_numeros.json'), encoding='utf-8')); e = REF[k]
    print(k)
    ver('total (exacto) cm2', r['total_cm2'], e['total_cm2'], tol_abs=0.05)
    ver('piel terminada (exacto) cm2', r['terminada']['exacta_cm2'], e['terminada_cm2'], tol_abs=0.05)
    ver('a la vista cm2', r['vista_cm2'], e['vista_cm2'], tol_rel=0.01)
    ver('a la vista, minimo del rango', r['vista_rango_cm2'][0], e['vista_rango_cm2'][0], tol_rel=0.01)
    ver('a la vista, maximo del rango', r['vista_rango_cm2'][1], e['vista_rango_cm2'][1], tol_rel=0.01)
    ver('doblez cm2', r['doblez_cm2'], e['doblez_cm2'], tol_rel=0.025)
    ver('espesor piel-sustrato mm', r['recortada']['espesor_mm'], e['espesor_mm'], tol_abs=0.03)
    ver('cara del sustrato bajo la piel cm2', r['cara_vista_sustrato']['area_cm2'], e['cara_vista_sustrato_cm2'], tol_abs=0.5)
    ver('sustrato cubierto (rayos) cm2', r['sustrato_cubierto_por_rayos_cm2'], e['sustrato_cubierto_por_rayos_cm2'], tol_rel=0.01)
    for n, v in e['huecos'].items():
        ver('hueco: ' + n, r.get('huecos', {}).get(n, -1.0), v, tol_rel=0.03)
    if (r['cara_vista_sustrato']['se_cuela_al_dorso'] != e['se_cuela_al_dorso'] or r['vista_m2_estable_a_2_decimales'] != e['estable_a_2_decimales']
            or r['n_pieles'] != 2):
        mal += 1
        print('  MAL cambio un veredicto: pieles=%s se_cuela=%s estable=%s'
              % (r['n_pieles'], r['cara_vista_sustrato']['se_cuela_al_dorso'], r['vista_m2_estable_a_2_decimales']))
    g = REF['_control_independiente_gmsh'][k]
    ver('vista vs control con gmsh cm2', r['vista_cm2'], g['coincide_0.3mm'], tol_rel=0.01)
    ver('total vs control con gmsh cm2', r['total_cm2'], g['recortada'], tol_abs=0.05)
print('\nreferencia Top Roll: %s' % ('TODO OK' if not mal else '%d valor(es) se movieron' % mal))
sys.exit(1 if mal else 0)
