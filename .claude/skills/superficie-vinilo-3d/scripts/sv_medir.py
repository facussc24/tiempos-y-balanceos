# -*- coding: utf-8 -*-
"""sv_medir.py — del cache de sv_modelo.py a los NUMEROS: que es cada piel, cuanto mide,
cuanto queda a la vista y cuanto es borde que se dobla.

Que resuelve (caso Top Roll Patagonia, 01/10/2026). Un STEP de pieza tapizada trae el sustrato
(solido) y, sueltas, las superficies de la piel. Segun lo que traiga, esto es lo que informa:

  2 pieles  -> TODO. La TERMINADA (ya doblada, la del cliente) y la RECORTADA (como sale del
               refilado, con las solapas hacia afuera). Donde coinciden es la cara vista; donde
               se separan empieza el doblez. Es el unico modo que da "a la vista".
  1 piel    -> solo el TOTAL de esa piel (exacto). "A la vista" NO se informa: sin la segunda
               piel el limite del doblez habria que adivinarlo.
  0 pieles  -> ningun numero para informar: lista las dos caras continuas mas grandes del
               sustrato como CANDIDATAS, para elegir mirando la imagen.

Lo que NO hace: adivinar. Sale con codigo 2 y sin numero cuando no distingue las pieles, cuando
no coinciden, cuando una "piel" no esta apoyada en el sustrato o esta a una distancia que no es
un espesor de material, o cuando hay varios solidos y no puede saber cual es el sustrato.
(La auditoria del 01/10/2026 encontro que los modos de 1 y 0 pieles daban numeros falsos con
buena cara: por eso hoy informan menos.)

El AREA TOTAL de cada piel es EXACTA (suma de BRepGProp por cara). El reparto vista / doblez
se hace sobre una malla de la piel subdividida a 6 mm y se escala al area exacta: por eso el
total cierra al centesimo y el "a la vista" tiene un rango, que se informa.

Uso (Python de CAD):
  .venv-cad\\Scripts\\python.exe sv_medir.py <modelo.npz> <carpeta_salida> --clave del
        [--sustrato N] [--tol 0.3] [--apoyo 3.0] [--hueco "hueco del parlante:3495,3645,668,745"]

Codigos de salida: 0 = hay numeros (puede decir "a la vista: no se informa");  2 = no se puede
medir sin adivinar, no escribe nada.
Salidas: <clave>_numeros.json y <clave>_clases.npz (triangulos de cada piel con su clase:
0 = sin repartir, 1 = a la vista, 2 = doblez, 3 = hueco).
"""
import argparse
import json
import os
import sys
import warnings
from collections import defaultdict, deque

import numpy as np

TOL_COINCIDE = 0.3      # mm: las dos pieles "coinciden" si estan a menos de esto
APOYO = 3.0             # mm: la piel esta "apoyada" en el sustrato si esta a menos de esto
SE_CUELA = 0.60         # la "cara vista" del sustrato se colo al dorso si pasa el 60 % de su area total...
OPUESTAS = 0.25         # ...o si mas del 25 % de su area mira para el lado contrario al resto. Medido el 01/10/2026:
#                         la cara vista buena del Top Roll delantero da 0,10 (la pieza envuelve y el labio de abajo mira
#                         al reves) y la colada del trasero da 0,50. Con 0,10 de umbral la buena salia como colada.
PIEL_MINIMA_CM2 = 5.0   # superficies sueltas mas chicas que esto se listan y se ignoran
LADO_MAX = 6.0          # mm: la malla de la piel se subdivide hasta este lado de triangulo
ESPESOR = (0.3, 6.0)    # mm: a que distancia del sustrato puede estar una piel para ser una piel
APOYADA_MIN = 0.30      # una piel tiene que tener al menos el 30 % de su area apoyada en el sustrato
COINCIDE_MIN = 0.70     # la zona comun de las dos pieles tiene que ser al menos el 70 % de la terminada
MALLA_TOL = 0.005       # la malla de una piel no puede diferir mas del 0,5 % de su area exacta

GLOSARIO = {
    'total_cm2': 'area EXACTA de la piel principal (la recortada si hay dos; si hay una sola, esa)',
    'vista_cm2': 'piel apoyada en la cara vista hasta donde empieza el doblez. Solo con dos pieles',
    'vista_rango_cm2': 'el mismo numero corriendo el limite del doblez (coincidencia a 0,3 / 0,6 / 1,0 mm y piel apoyada)',
    'doblez_cm2': 'total menos a la vista',
    'sustrato_cubierto_por_rayos_cm2': 'plastico tapado por la piel TERMINADA, contando lo que tapa el doblez. NO es "a la vista"',
    'cara_vista_sustrato': 'cara continua del plastico que queda debajo de la piel. Si "se_cuela_al_dorso", no sirve',
}


class NoSePuede(Exception):
    """El script no puede clasificar sin adivinar. Se informa y se sale con codigo 2."""


def _area(tri):
    return 0.5 * np.linalg.norm(np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0]), axis=1)


def _cerca(malla, pts, margen=60.0):
    """Distancia de cada punto a la malla y el triangulo mas cercano (-1 si esta lejos).

    Los puntos que quedan a mas de `margen` de la caja de la malla NO se le pasan a
    closest_point: para ellos devuelve la distancia a la caja (una cota inferior, siempre mayor
    que `margen`). Y el resto va en tandas. Sin estas dos cosas, una superficie a 500 mm de la
    pieza pedia 2 GB y el script moria con MemoryError en vez de negarse (auditoria 01/10/2026)."""
    import trimesh
    from scipy.spatial import cKDTree
    pts = np.asarray(pts, float)
    b0, b1 = malla.bounds
    fuera = np.maximum(np.maximum(b0 - pts, pts - b1), 0.0)
    d = np.linalg.norm(fuera, axis=1)
    tid = np.full(len(pts), -1, np.int64)
    idx = np.where(d <= margen)[0]
    if len(idx):
        dv, _ = cKDTree(malla.vertices[np.unique(malla.faces)]).query(pts[idx])
        orden = idx[np.argsort(dv)]; dv = np.sort(dv)
        i = 0
        while i < len(orden):
            paso = 4000 if dv[i] < 10.0 else 400       # lejos de todo vertice hay muchos triangulos candidatos por punto
            j = orden[i:i + paso]
            with warnings.catch_warnings(), np.errstate(all='ignore'):
                warnings.simplefilter('ignore')
                _, dj, tj = trimesh.proximity.closest_point(malla, pts[j])
            d[j] = dj; tid[j] = tj
            i += paso
    return d, tid


def _subdividir(tri, lado):
    """Parte los triangulos grandes por su lado MAS LARGO hasta que ninguno pase de `lado` mm.

    Por que hace falta: en las pieles reales el 76 % del area esta en triangulos con un lado de
    mas de 10 mm (hasta 176 mm); clasificados por su centro, el limite vista/doblez queda grueso.
    Por que por el lado mas largo y no en cuatro (`trimesh.remesh.subdivide_to_size`): un triangulo
    finito y largo partido en cuatro sigue siendo finito y largo, y hay que partirlo de nuevo.
    El 01/10/2026 eso llevo un proceso a 5,9 GB y dejo la PC sin memoria. Partiendo por el lado
    mas largo la cantidad de triangulos la limita el AREA, no la esbeltez."""
    tri = np.array(tri, float)
    for _ in range(60):
        e = np.stack([np.linalg.norm(tri[:, 1] - tri[:, 2], axis=1), np.linalg.norm(tri[:, 2] - tri[:, 0], axis=1),
                      np.linalg.norm(tri[:, 0] - tri[:, 1], axis=1)], 1)      # e[:, i] = lado opuesto al vertice i
        grande = e.max(1) > lado
        if not grande.any():
            break
        t = tri[grande]; i = e[grande].argmax(1); n = np.arange(len(t))
        a_, b_, c_ = t[n, i], t[n, (i + 1) % 3], t[n, (i + 2) % 3]
        m = (b_ + c_) / 2.0
        tri = np.concatenate([tri[~grande], np.stack([a_, b_, m], 1), np.stack([a_, m, c_], 1)])
        if len(tri) > 600000:
            raise NoSePuede('la piel pasa de 600.000 triangulos al subdividir a %.0f mm: subir LADO_MAX' % lado)
    return tri


def _soup(tri):
    import trimesh
    return trimesh.Trimesh(vertices=tri.reshape(-1, 3), faces=np.arange(len(tri) * 3).reshape(-1, 3), process=False)


def _iou(a0, a1, b0, b1):
    i = np.clip(np.minimum(a1, b1) - np.maximum(a0, b0), 0, None).prod()
    u = (a1 - a0).prod() + (b1 - b0).prod() - i
    return float(i / u) if u > 0 else 0.0


def _parse_hueco(h):
    try:
        nombre, caja = h.rsplit(':', 1)
        x0, x1, z0, z1 = [float(t) for t in caja.split(',')]
    except Exception:
        raise NoSePuede('--hueco mal escrito: %r. Va "nombre:x0,x1,z0,z1" en mm' % h)
    if not (x0 < x1 and z0 < z1):
        raise NoSePuede('--hueco %r: la caja esta invertida (tiene que ser x0 < x1 y z0 < z1)' % h)
    return nombre.strip(), x0, x1, z0, z1


def medir(modelo, sustrato=None, tol=TOL_COINCIDE, apoyo=APOYO, huecos=(), verbose=True):
    import trimesh
    z = np.load(modelo, allow_pickle=False)
    area = z['area']; solid_of = z['solid_of']; shell_of = z['shell_of']; pares = z['pares']
    V, T, FID = z['V'], z['T'], z['FID']
    tri = V[T]; cen = tri.mean(1); at = _area(tri)
    t_solid = solid_of[FID]; t_shell = shell_of[FID]
    huecos = [_parse_hueco(h) for h in huecos]

    def dice(*a):
        if verbose:
            print(*a, flush=True)

    R = dict(modelo=os.path.abspath(modelo), tol_coincide_mm=tol, apoyo_mm=apoyo, avisos=[], glosario=GLOSARIO)
    nsol = len(z['sol_vol'])
    if nsol == 0:
        raise NoSePuede('el STEP no trae ningun solido: no hay sustrato contra el cual medir')

    # ---- pieles sueltas (antes de elegir el sustrato: la piel dice cual es)
    libres = solid_of == 0; libres[0] = False
    crudas = []
    for sh in sorted(set(shell_of[libres].tolist())):
        caras = libres & (shell_of == sh)
        ex = float(area[caras].sum()) / 100
        m = (t_solid == 0) & (t_shell == sh)
        if ex < PIEL_MINIMA_CM2 or not m.any():
            R['avisos'].append('superficie suelta de %.2f cm2 (shell %d) ignorada por chica' % (ex, sh))
            continue
        crudas.append(dict(shell=int(sh), m=m, exacta_cm2=ex))
    if len(crudas) > 2:
        raise NoSePuede('hay %d superficies sueltas grandes; el metodo esta probado con 0, 1 o 2 pieles. Areas: %s'
                        % (len(crudas), [round(p['exacta_cm2'], 1) for p in crudas]))

    # ---- cual solido es el sustrato
    lista = ', '.join('%d: %.0f cm3' % (i + 1, v) for i, v in enumerate(z['sol_vol']))
    if sustrato:
        if not 1 <= int(sustrato) <= nsol:
            raise NoSePuede('--sustrato %s no existe; los solidos son %s' % (sustrato, lista))
        S = int(sustrato); elegido = 'a mano'
    elif nsol == 1:
        S = 1; elegido = 'el unico solido'
    elif not crudas:
        raise NoSePuede('hay %d solidos y ninguna piel: decir cual es el sustrato con --sustrato N (%s)' % (nsol, lista))
    else:
        ch = min(crudas, key=lambda p: p['exacta_cm2'])          # la piel mas chica es la mas pegada a la pieza
        pv = tri[ch['m']].reshape(-1, 3); p0, p1 = pv.min(0), pv.max(0)
        iou = [_iou(p0, p1, z['sol_bbox'][i][:3], z['sol_bbox'][i][3:]) for i in range(nsol)]
        o = np.argsort(iou)[::-1]
        if iou[o[0]] - iou[o[1]] < 0.15:
            raise NoSePuede('no se distingue cual solido es el sustrato (la caja de la piel se parece a la de dos solidos: %s). '
                            'Decirlo con --sustrato N (%s)' % ([round(x, 2) for x in iou], lista))
        S = int(o[0]) + 1; elegido = 'el solido cuya caja coincide con la de la piel'
    R['sustrato'] = dict(solido=S, vol_cm3=float(z['sol_vol'][S - 1]), area_total_cm2=float(area[solid_of == S].sum()) / 100,
                         caja_mm=[float(x) for x in (z['sol_bbox'][S - 1][3:] - z['sol_bbox'][S - 1][:3])], elegido=elegido)
    dice('SUSTRATO: solido %d (%s), %.1f cm3' % (S, elegido, R['sustrato']['vol_cm3']))
    m_sub = t_solid == S
    idx_sub = np.where(m_sub)[0]
    ms = trimesh.Trimesh(vertices=V, faces=T[idx_sub], process=False)

    pieles = []
    for p in crudas:
        ts = _subdividir(tri[p['m']], LADO_MAX)
        w = _area(ts); c = ts.mean(1)
        k = p['exacta_cm2'] / (w.sum() / 100)                     # malla -> area exacta
        if abs(k - 1.0) > MALLA_TOL:
            raise NoSePuede('la malla de la piel (shell %d) da %.1f cm2 y el area exacta %.1f cm2 (%.1f %%): hay caras sin mallar. '
                            'Volver a correr sv_modelo.py con --defl mas chica.' % (p['shell'], w.sum() / 100, p['exacta_cm2'], 100 * (k - 1)))
        d, tid = _cerca(ms, c)
        ap = d < apoyo
        if w[ap].sum() / w.sum() < APOYADA_MIN:
            raise NoSePuede('la superficie suelta de %.1f cm2 (shell %d) no esta apoyada en el sustrato (solo el %.0f %% a menos de %.0f mm): '
                            'no es la piel de esta pieza, o el sustrato elegido no es el suyo.'
                            % (p['exacta_cm2'], p['shell'], 100 * w[ap].sum() / w.sum(), apoyo))
        o = np.argsort(d[ap]); cw = np.cumsum(w[ap][o]) / w[ap].sum()
        esp = float(d[ap][o][np.searchsorted(cw, 0.5)])
        if not ESPESOR[0] <= esp <= ESPESOR[1]:
            raise NoSePuede('la superficie suelta de %.1f cm2 (shell %d) esta a %.2f mm del sustrato: eso no es un espesor de material '
                            '(se espera entre %.1f y %.1f mm).' % (p['exacta_cm2'], p['shell'], esp, ESPESOR[0], ESPESOR[1]))
        pieles.append(dict(shell=p['shell'], tri=ts, w=w, c=c, d=d, tid=tid, k=k, exacta_cm2=p['exacta_cm2'],
                           apoyada_cm2=float(w[ap].sum()) / 100 * k, lejos_frac=float(w[~ap].sum() / w.sum()), espesor_mm=esp))
        dice('PIEL shell %d: %.2f cm2 exactos | apoyada en el sustrato %.1f cm2 | lejos %.0f %% | a %.2f mm (mediana) | %d triangulos'
             % (p['shell'], p['exacta_cm2'], pieles[-1]['apoyada_cm2'], 100 * pieles[-1]['lejos_frac'], esp, len(ts)))
    R['n_pieles'] = len(pieles)

    # ---- caras continuas del sustrato (caras tangentes entre si)
    adj = defaultdict(list)
    for f1, f2, ang in pares:
        f1, f2 = int(f1), int(f2)
        if solid_of[f1] == S and solid_of[f2] == S and 0 <= ang <= 15.0:
            adj[f1].append(f2); adj[f2].append(f1)
    comp = np.zeros(len(area), np.int32); nc = 0
    for f in np.where(solid_of == S)[0]:
        if comp[f]:
            continue
        nc += 1; comp[f] = nc; q = deque([int(f)])
        while q:
            x = q.popleft()
            for y in adj[x]:
                if not comp[y]:
                    comp[y] = nc; q.append(y)
    ar_comp = np.bincount(comp, weights=area, minlength=nc + 1); ar_comp[0] = 0
    n_sub = np.cross(tri[m_sub][:, 1] - tri[m_sub][:, 0], tri[m_sub][:, 2] - tri[m_sub][:, 0])     # normal x 2*area, hacia afuera
    comp_tri = comp[FID[idx_sub]]

    def cara(cc):
        """Una cara continua: area, hacia donde mira y si se colo al dorso."""
        nn = n_sub[comp_tri == cc]
        frac = float(ar_comp[cc] / area[solid_of == S].sum())
        if not len(nn):
            return dict(componente=int(cc), area_cm2=float(ar_comp[cc]) / 100, fraccion_del_sustrato=round(frac, 3), se_cuela_al_dorso=True)
        suma = nn.sum(0); tot = np.linalg.norm(nn, axis=1).sum()
        media = suma / max(np.linalg.norm(suma), 1e-12)
        opu = float(np.linalg.norm(nn[(nn @ media) < 0], axis=1).sum() / max(tot, 1e-12))
        return dict(componente=int(cc), area_cm2=float(ar_comp[cc]) / 100, fraccion_del_sustrato=round(frac, 3),
                    mira_hacia=[round(float(x), 2) for x in media], area_que_mira_al_reves=round(opu, 3),
                    se_cuela_al_dorso=bool(frac > SE_CUELA or opu > OPUESTAS))

    term = rec = None
    if len(pieles) == 2:
        a, b = sorted(pieles, key=lambda p: p['lejos_frac'])
        if not (b['exacta_cm2'] > a['exacta_cm2'] and b['lejos_frac'] > a['lejos_frac'] + 0.05):
            raise NoSePuede('no se distingue cual piel es la terminada y cual la recortada: areas %.1f / %.1f cm2, '
                            'fraccion lejos del sustrato %.2f / %.2f' % (a['exacta_cm2'], b['exacta_cm2'], a['lejos_frac'], b['lejos_frac']))
        term, rec = a, b
    elif len(pieles) == 1:
        if pieles[0]['lejos_frac'] > 0.10:
            rec = pieles[0]
        else:
            term = pieles[0]

    ref = term or rec
    capas = dict(sub_rol=np.where(m_sub, 1, np.where(t_solid > 0, 0, -1)).astype(np.int8),
                 cara_a=np.zeros(len(T), bool), cara_b=np.zeros(len(T), bool),
                 term_tri=term['tri'] if term is not None else np.zeros((0, 3, 3)),
                 rec_tri=rec['tri'] if rec is not None else np.zeros((0, 3, 3)),
                 principal=np.array('rec' if rec is not None else ('term' if term is not None else '')),
                 clase=np.zeros(0, np.int8))

    if ref is None:
        # ---- sin piel: no se informa ningun numero; se dejan las dos caras mas grandes como candidatas
        top = [int(c) for c in np.argsort(-ar_comp)[:2] if ar_comp[c] > 0]
        R['candidatas_cara_vista'] = [cara(c) for c in top]
        R['total_cm2'] = None; R['vista_cm2'] = None
        R['vista_metodo'] = 'no se informa: el STEP no trae la piel'
        R['avisos'].append('sin piel no hay numero para informar. Las dos caras continuas mas grandes del sustrato quedan como CANDIDATAS '
                           '(azul la primera, violeta la segunda en la foto): la cara vista se elige MIRANDO la imagen, y el tapizado mide '
                           'un poco mas que el plastico.')
        for i, c in enumerate(top):
            capas['cara_a' if i == 0 else 'cara_b'] = (comp[FID] == c) & m_sub
            q = R['candidatas_cara_vista'][i]
            dice('CANDIDATA %d: %.1f cm2, mira hacia %s%s' % (i + 1, q['area_cm2'], q.get('mira_hacia'),
                                                             '  (se cuela al dorso: no es una sola cara)' if q['se_cuela_al_dorso'] else ''))
        return R, capas

    ok_ref = ref['d'] < apoyo
    cob = np.bincount(comp[FID[idx_sub[ref['tid'][ok_ref]]]], weights=ref['w'][ok_ref], minlength=nc + 1)
    A = int(np.argmax(cob))
    R['cara_vista_sustrato'] = dict(metodo='caras tangentes (15 grados)', **cara(A))
    cuela = R['cara_vista_sustrato']['se_cuela_al_dorso']
    dice('CARA DEL SUSTRATO debajo de la piel: %.1f cm2 (%.0f %% del sustrato)%s'
         % (ar_comp[A] / 100, 100 * R['cara_vista_sustrato']['fraccion_del_sustrato'], '  << SE CUELA AL DORSO: no se usa' if cuela else ''))
    if cuela:
        R['avisos'].append('la cara vista del sustrato no se pudo separar por continuidad (se cuela al dorso por un borde redondeado)')
    capas['cara_a'] = (comp[FID] == A) & m_sub & (not cuela)

    if term is not None:     # sustrato cubierto, por rayos: camino que no comparte nada con la continuidad
        ln = np.linalg.norm(n_sub, axis=1, keepdims=True); n = n_sub / np.where(ln < 1e-12, 1, ln)
        loc, ir, _ = _soup(term['tri']).ray.intersects_location(cen[m_sub] + n * 0.01, n, multiple_hits=False)
        dd = np.full(int(m_sub.sum()), np.inf)
        if len(ir):
            dd[ir] = np.linalg.norm(loc - cen[m_sub][ir], axis=1)
        R['sustrato_cubierto_por_rayos_cm2'] = float(at[m_sub][dd < apoyo].sum()) / 100
        R['terminada'] = dict(exacta_cm2=term['exacta_cm2'], apoyada_cm2=term['apoyada_cm2'], espesor_mm=term['espesor_mm'])
    if rec is not None:
        R['recortada'] = dict(exacta_cm2=rec['exacta_cm2'], apoyada_cm2=rec['apoyada_cm2'], espesor_mm=rec['espesor_mm'])

    principal = rec or term
    R['total_cm2'] = principal['exacta_cm2']
    R['total_es'] = 'piel recortada, antes de doblar' if rec is not None else 'piel terminada, ya doblada'
    clase = np.zeros(len(principal['tri']), np.int8)          # 0 = sin repartir

    if term is None or rec is None:
        # ---- una sola piel: el total y nada mas
        R['vista_cm2'] = None
        R['vista_metodo'] = 'no se informa: con una sola piel el limite del doblez habria que adivinarlo'
        R['avisos'].append('con una sola piel se informa solo el TOTAL. Para "a la vista" hace falta el 3D con las dos pieles '
                           '(la terminada y la recortada), o medirlo sobre la pieza.')
        if term is not None:
            R['avisos'].append('este total es el de la piel YA DOBLADA: la pieza de material recortada, con sus solapas, mide mas.')
        capas['clase'] = clase
        return R, capas

    # ---- dos pieles: a la vista = donde coinciden
    d_o, _ = _cerca(_soup(term['tri']), rec['c'], margen=20.0)
    k = rec['k']; w = rec['w']
    coincide = float(w[d_o < tol].sum()) / 100 * k
    if coincide < COINCIDE_MIN * term['exacta_cm2']:
        raise NoSePuede('las dos pieles coinciden en %.1f cm2, menos del %.0f %% de la terminada (%.1f): no son la misma piel en dos '
                        'estados, estan corridas, o la recortada no cubre la cara. No se informa "a la vista".'
                        % (coincide, 100 * COINCIDE_MIN, term['exacta_cm2']))
    vista = d_o < tol
    R['vista_cm2'] = coincide
    R['vista_metodo'] = 'piel recortada que coincide con la terminada (< %.1f mm)' % tol
    R['vista_alternativas_cm2'] = {'coincide < 0.6 mm': float(w[d_o < 0.6].sum()) / 100 * k,
                                   'coincide < 1.0 mm': float(w[d_o < 1.0].sum()) / 100 * k,
                                   'apoyada < %.0f mm' % apoyo: rec['apoyada_cm2']}
    alts = [R['vista_cm2']] + list(R['vista_alternativas_cm2'].values())
    R['vista_rango_cm2'] = [min(alts), max(alts)]
    R['vista_m2_estable_a_2_decimales'] = len({round(x / 1e4, 2) for x in alts}) == 1
    R['doblez_cm2'] = R['total_cm2'] - R['vista_cm2']
    clase[:] = 2; clase[vista] = 1
    R['huecos'] = {}
    for nombre, x0, x1, z0, z1 in huecos:
        c = rec['c']
        mh = (~vista) & (c[:, 0] > x0) & (c[:, 0] < x1) & (c[:, 2] > z0) & (c[:, 2] < z1) & (rec['d'] < 40.0)
        clase[mh] = 3
        R['huecos'][nombre] = float(w[mh].sum()) / 100 * k
        if R['huecos'][nombre] > 0.5 * R['doblez_cm2']:
            R['avisos'].append('el hueco "%s" se lleva mas de la mitad del doblez (%.0f de %.0f cm2): revisar su caja'
                               % (nombre, R['huecos'][nombre], R['doblez_cm2']))
        if R['huecos'][nombre] == 0:
            R['avisos'].append('el hueco "%s" no agarro nada: revisar su caja' % nombre)
    if not cuela and R['vista_cm2'] < 0.97 * R['cara_vista_sustrato']['area_cm2']:
        # la piel va por FUERA del sustrato: la cara tapizada no puede medir menos que la del plastico
        R['avisos'].append('la cara tapizada (%.0f cm2) da menos que la cara vista del sustrato (%.0f cm2): revisar'
                           % (R['vista_cm2'], R['cara_vista_sustrato']['area_cm2']))
    capas['clase'] = clase
    return R, capas


def main():
    ap = argparse.ArgumentParser(description='pieles de un STEP: total, a la vista y doblez')
    ap.add_argument('modelo', help='el .npz que dejo sv_modelo.py')
    ap.add_argument('salida', help='carpeta donde quedan <clave>_numeros.json y <clave>_clases.npz')
    ap.add_argument('--clave', default='pieza', help='nombre corto de la pieza (del, tras...)')
    ap.add_argument('--sustrato', type=int, default=0,
                    help='numero del solido que es el sustrato (el del resumen de sv_modelo). Sin esto se toma el solido cuya caja coincide con la de la piel')
    ap.add_argument('--tol', type=float, default=TOL_COINCIDE, help='mm: hasta que distancia las dos pieles "coinciden" (0,3)')
    ap.add_argument('--apoyo', type=float, default=APOYO, help='mm: hasta que distancia la piel esta "apoyada" en el sustrato (3)')
    ap.add_argument('--hueco', action='append', default=[],
                    help='"nombre:x0,x1,z0,z1" en mm: la parte del doblez que cae dentro de esa caja X-Z se informa aparte (hueco de parlante)')
    a = ap.parse_args()
    try:
        R, capas = medir(a.modelo, a.sustrato or None, a.tol, a.apoyo, a.hueco)
    except NoSePuede as e:
        print('\nNO SE PUEDE MEDIR SIN ADIVINAR: %s' % e)
        return 2
    os.makedirs(a.salida, exist_ok=True)
    np.savez(os.path.join(a.salida, a.clave + '_clases.npz'), **capas)
    with open(os.path.join(a.salida, a.clave + '_numeros.json'), 'w', encoding='utf-8') as fh:
        json.dump(R, fh, indent=1, ensure_ascii=False, default=float)

    def f(x, d=1):
        return ('%.*f' % (d, x)).replace('.', ',')
    print('\n==== %s ====' % a.clave)
    if R.get('total_cm2'):
        print('  TOTAL (%s): %s cm2 = %s m2' % (R['total_es'], f(R['total_cm2']), f(R['total_cm2'] / 1e4, 3)))
    if R.get('vista_cm2') is None:
        print('  A LA VISTA: %s' % R['vista_metodo'])
    else:
        print('  A LA VISTA: %s cm2 = %s m2   [%s]' % (f(R['vista_cm2']), f(R['vista_cm2'] / 1e4, 3), R['vista_metodo']))
        print('     segun donde se corte el borde: de %s a %s cm2 -> a 2 decimales en m2 %s'
              % (f(R['vista_rango_cm2'][0], 0), f(R['vista_rango_cm2'][1], 0),
                 'es ESTABLE' if R['vista_m2_estable_a_2_decimales'] else 'CAMBIA: informar el rango, no un numero'))
        print('  BORDE QUE SE DOBLA: %s cm2' % f(R['doblez_cm2']))
    for n, v in R.get('huecos', {}).items():
        print('     de eso, %s: %s cm2' % (n, f(v)))
    for av in R['avisos']:
        print('  AVISO: ' + av)
    return 0


if __name__ == '__main__':
    sys.exit(main())
