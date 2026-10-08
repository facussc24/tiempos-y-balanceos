"""
medir_aire.py <pdf> [--json] — mide el AIRE de un flujograma impreso, SOLO desde el PDF (vectorial), en mm de hoja A3.

Sirve igual para el dibujo original escalado a A3, para B y para D: no depende del motor que lo dibujo.

Que mide (todo por pagina; el resumen junta las paginas):
  1. LETRA: tamano (pt) de la descripcion de las operaciones (el texto mas comun de la zona del flujo) y minimo de TODO el documento.
  2. FILAS: separacion vertical entre dos figuras consecutivas de la misma columna (el trozo de linea que se ve), en mm y en "em"
     (em = el tamano de la letra de la descripcion). Tambien el paso de fila (de centro a centro).
  3. COLUMNAS: separacion horizontal LIBRE entre columnas vecinas de una rama paralela / reproceso: por cada franja de 0,5 mm de alto se mira el
     hueco sin texto ni figura que rodea el punto medio entre las dos columnas. Se informa el MINIMO (el punto mas apretado) y la MEDIANA.
  4. TEXTO CONTRA LA LINEA VECINA: para cada descripcion, distancia al elemento grafico (linea o figura) mas cercano que NO sea de su propia
     fila: arriba, abajo y a la derecha. (A la izquierda esta su propia figura: se informa aparte como "texto-figura".)
  5. MARGEN: distancia de la tinta al borde de la hoja.

Una figura se reconoce por su forma (elipse, circulo, triangulo, rombo, rectangulo de 3 a 30 mm); los varios trazos que Chromium usa
para una misma figura (relleno + borde) se juntan en una. Una linea es un rectangulo relleno de menos de 2,2 pt de grosor.
No modifica nada.
"""
import fitz, sys, json, statistics, math, re

MM = 25.4 / 72


def r_inter(a, b):
    return min(a[2], b[2]) - max(a[0], b[0]), min(a[3], b[3]) - max(a[1], b[1])


def leer_pagina(page):
    spans = []
    for b in page.get_text('dict')['blocks']:
        for l in b.get('lines', []):
            for s in l['spans']:
                t = s['text'].strip()
                if t:
                    spans.append({'t': t, 'size': s['size'], 'bb': tuple(s['bbox']), 'font': s.get('font', '')})
    lineas, cand = [], []
    for d in page.get_drawings():
        r = d['rect']
        w, h = r.width, r.height
        if w <= 0 and h <= 0:
            continue
        its = [i[0] for i in d['items']]
        typ = d['type']
        if w > 330 or h > 330:                      # marcos, fondo
            continue
        # linea: rectangulo relleno finito
        if typ == 'f' and its == ['re'] and min(w, h) <= 2.2 and max(w, h) > 2.0:
            fill = d.get('fill') or (1, 1, 1)
            if fill == (1.0, 1.0, 1.0):
                continue
            lineas.append((r.x0, r.y0, r.x1, r.y1, 'h' if w >= h else 'v'))
            continue
        # trazo sin relleno con varios segmentos (retornos): se parte en segmentos
        if typ == 's' and its and not d.get('fill') and (w > 30 or h > 30) and set(its) <= {'l', 'c'} and len(its) >= 2:
            for it in d['items']:
                if it[0] == 'l':
                    p, q = it[1], it[2]
                    bb = (min(p.x, q.x), min(p.y, q.y), max(p.x, q.x), max(p.y, q.y))
                    lineas.append((bb[0] - 0.4, bb[1] - 0.4, bb[2] + 0.4, bb[3] + 0.4, 'h' if (bb[2] - bb[0]) >= (bb[3] - bb[1]) else 'v'))
            continue
        # figura: de 3 a 30 mm de ancho y de 3 a 16 mm de alto (se acepta apaisada o alta)
        if typ == 'f' and its == ['re'] and (d.get('fill') or (1, 1, 1)) == (1.0, 1.0, 1.0):
            continue                                   # caja blanca de fondo de un texto o envoltorio de una figura
        if 3 <= w * MM <= 30 and 2.4 <= h * MM <= 16 and typ in ('f', 'fs', 's'):
            cols = [tuple(c) for c in (d.get('color'), d.get('fill')) if c and len(c) == 3 and min(c) <= 0.9]
            cand.append({'bb': (r.x0, r.y0, r.x1, r.y1), 'cols': cols, 'items': its})
    return spans, lineas, cand


def juntar_figuras(cand):
    """junta los trazos de una misma figura (mismo centro +-1,2 mm y bboxes que se contienen o casi)."""
    figs = []
    for c in sorted(cand, key=lambda c: -(c['bb'][2] - c['bb'][0]) * (c['bb'][3] - c['bb'][1])):
        bb = c['bb']
        cx, cy = (bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2
        for f in figs:
            fb = f['bb']
            fx, fy = (fb[0] + fb[2]) / 2, (fb[1] + fb[3]) / 2
            ix, iy = r_inter(bb, fb)
            if ix > 0 and iy > 0 and abs(cx - fx) < 1.2 / MM and abs(cy - fy) < 1.2 / MM:
                f['bb'] = (min(fb[0], bb[0]), min(fb[1], bb[1]), max(fb[2], bb[2]), max(fb[3], bb[3]))
                f['cols'] += c['cols']
                f['n'] += 1
                break
        else:
            figs.append({'bb': bb, 'cols': list(c['cols']), 'n': 1, 'items': c['items']})
    for f in figs:
        f['tipo'] = tipo_color(f['cols'])
    return figs


def tipo_color(cols):
    """azul = figura del flujo; rojo = terminal (SCRAP, reclamo); otro = conector circulo-letra (naranja / verde)."""
    if any(c[2] - c[0] > 0.25 and c[2] > 0.5 for c in cols):
        return 'azul'
    if any(c[0] - c[1] > 0.35 and abs(c[1] - c[2]) < 0.15 for c in cols):
        return 'rojo'
    return 'otro' if cols else None


def cubierto(lineas, cx, y0, y1, tol=1.0 / MM):
    """hay lineas verticales en x=cx (+-2 pt) que cubren seguidas todo [y0, y1] (los tramos de cada fila se juntan)."""
    seg = sorted((l[1], l[3]) for l in lineas if l[4] == 'v' and l[0] <= cx + 2 and l[2] >= cx - 2)
    pos = y0
    for a, b in seg:
        if b < pos - 0.01:
            continue
        if a > pos + tol:
            break
        pos = max(pos, b)
        if pos >= y1 - 0.01:
            return True
    return pos >= y1 - 0.01


def dist_rect(a, b):
    dx = max(a[0] - b[2], b[0] - a[2], 0)
    dy = max(a[1] - b[3], b[1] - a[3], 0)
    return dx, dy


def medir_pagina(page, vezmin=0):
    spans, lineas, cand = leer_pagina(page)
    figs = juntar_figuras(cand)
    H = page.rect.height
    Wp = page.rect.width
    # zona de la leyenda: arriba de "SIMBOLOS Y REFERENCIAS"
    leyenda_top = H
    for s in spans:
        if s['t'].upper().startswith('SÍMBOLOS Y REFERENCIAS') or s['t'].upper().startswith('SIMBOLOS Y REFERENCIAS'):
            leyenda_top = min(leyenda_top, s['bb'][1] - 4)
    figs = [f for f in figs if f['bb'][3] <= leyenda_top]
    lineas = [l for l in lineas if l[3] <= leyenda_top + 0.5]
    # figuras del flujo: las que tienen lineas de flujo o son de la columna; descartar terminales rojos y conectores para las FILAS
    flujo = [f for f in figs if f['tipo'] == 'azul']
    top = min([f['bb'][1] for f in flujo], default=0)
    zona_spans = [s for s in spans if s['bb'][1] >= top - 2.0 / MM and s['bb'][3] <= leyenda_top]
    # tamano de la descripcion = tamano mas comun entre los textos largos de la zona
    tam = {}
    for s in zona_spans:
        if len(s['t']) >= 6:
            k = round(s['size'], 1)
            tam[k] = tam.get(k, 0) + 1
    letra = max(tam.items(), key=lambda kv: kv[1])[0] if tam else (round(statistics.median(s['size'] for s in spans), 1) if spans else 0)
    em_mm = letra * 25.4 / 72

    # ---- 2. FILAS: figuras de la misma columna, consecutivas ----
    # columna = centro x +- 1,5 mm. Solo figuras del hilo principal (no conectores circulo-letra: son chicos y no estan en el hilo)
    hilo = [f for f in flujo if (f['bb'][2] - f['bb'][0]) * MM >= 3.0]
    cols = []
    for f in sorted(hilo, key=lambda f: (f['bb'][0] + f['bb'][2]) / 2):
        cx = (f['bb'][0] + f['bb'][2]) / 2
        for c in cols:
            if abs(c['cx'] - cx) < 1.5 / MM:
                c['figs'].append(f)
                c['cx'] = sum((g['bb'][0] + g['bb'][2]) / 2 for g in c['figs']) / len(c['figs'])
                break
        else:
            cols.append({'cx': cx, 'figs': [f]})
    gaps, pasos = [], []
    for c in cols:
        fs = sorted(c['figs'], key=lambda f: f['bb'][1])
        for a, b in zip(fs, fs[1:]):
            g = (b['bb'][1] - a['bb'][3]) * MM
            if g < 0:
                continue
            # tiene que haber una linea vertical que los una (si no, son filas sin relacion: otra rama)
            une = cubierto(lineas, c['cx'], a['bb'][3], b['bb'][1])
            if une and g < 80:
                gaps.append(g)
                pasos.append(((b['bb'][1] + b['bb'][3]) / 2 - (a['bb'][1] + a['bb'][3]) / 2) * MM)
    # ---- 3. COLUMNAS ----
    # espinas: columnas con al menos 3 figuras
    espinas = [c for c in cols if len(c['figs']) >= 2]
    tinta = []   # (x0,y0,x1,y1) de textos y figuras (sin lineas)
    for s in zona_spans:
        tinta.append(s['bb'])
    for f in figs:
        tinta.append(f['bb'])
    esp_info = []
    for c in espinas:
        ys = [f['bb'][1] for f in c['figs']] + [f['bb'][3] for f in c['figs']]
        esp_info.append((c['cx'], min(ys), max(ys)))
    esp_info.sort()
    huecos_min, huecos_med = [], []
    detalle_col = []
    for i in range(len(esp_info) - 1):
        a, b = esp_info[i], esp_info[i + 1]
        y0, y1 = max(a[1], b[1]), min(a[2], b[2])
        if (y1 - y0) * MM < 8:
            continue
        hs = []
        y = y0
        while y < y1:
            sl = (y, y + 0.5 / MM)
            lo, hi = a[0] - 3 / MM, b[0] + 12 / MM
            iv = sorted((max(t[0], lo), min(t[2], hi)) for t in tinta if t[3] >= sl[0] and t[1] <= sl[1] and t[2] > lo and t[0] < hi)
            # union de intervalos ocupados
            uni = []
            for p, q in iv:
                if uni and p <= uni[-1][1] + 0.01:
                    uni[-1][1] = max(uni[-1][1], q)
                else:
                    uni.append([p, q])
            # huecos acotados por tinta a los dos lados, que empiezan despues de la espina A y terminan antes de la espina B
            runs = [(uni[k + 1][0] - uni[k][1]) for k in range(len(uni) - 1) if uni[k][1] >= a[0] and uni[k + 1][0] <= b[0] + 12 / MM]
            if runs:
                hs.append(max(runs) * MM)
            y += 0.5 / MM
        if hs:
            huecos_min.append(min(hs))
            huecos_med.append(statistics.median(hs))
            detalle_col.append({'entre_mm_x': [round(a[0] * MM), round(b[0] * MM)], 'min_mm': round(min(hs), 1), 'mediana_mm': round(statistics.median(hs), 1)})
    # ---- 4. TEXTO contra la linea vecina ----
    elems = [(l[0], l[1], l[2], l[3]) for l in lineas] + [f['bb'] for f in figs]
    desc = [s for s in zona_spans if abs(s['size'] - letra) < 0.3 and len(s['t']) >= 6]
    arr, abj, der_, izq_ = [], [], [], []
    texto_figura = []
    for s in desc:
        bb = s['bb']
        h = bb[3] - bb[1]
        mejor = {'arr': None, 'abj': None, 'der': None, 'izq': None}
        for e in elems:
            if e[0] >= bb[0] - 0.2 and e[2] <= bb[2] + 0.2 and e[1] >= bb[1] - 0.2 and e[3] <= bb[3] + 0.2:
                continue                   # adentro del texto
            ix, iy = r_inter(bb, e)
            # vertical: se solapan en x
            if ix > 0.3 and iy <= 0:
                if e[3] <= bb[1]:
                    d = (bb[1] - e[3]) * MM
                    mejor['arr'] = d if mejor['arr'] is None else min(mejor['arr'], d)
                elif e[1] >= bb[3]:
                    d = (e[1] - bb[3]) * MM
                    mejor['abj'] = d if mejor['abj'] is None else min(mejor['abj'], d)
            # horizontal: se solapan en y (con un margen de la mitad de la altura de linea para no contar lo que roza una linea vecina del renglon)
            elif iy > 0.3 * h and ix <= 0:
                if e[2] <= bb[0]:
                    d = (bb[0] - e[2]) * MM
                    mejor['izq'] = d if mejor['izq'] is None else min(mejor['izq'], d)
                elif e[0] >= bb[2]:
                    d = (e[0] - bb[2]) * MM
                    mejor['der'] = d if mejor['der'] is None else min(mejor['der'], d)
        if mejor['arr'] is not None: arr.append(mejor['arr'])
        if mejor['abj'] is not None: abj.append(mejor['abj'])
        if mejor['der'] is not None: der_.append(mejor['der'])
        if mejor['izq'] is not None: texto_figura.append(mejor['izq'])
    # ---- 5. MARGEN ----
    x0 = y0 = 1e9; x1 = y1 = -1e9
    for d in page.get_drawings():
        r = d['rect']
        if d['type'] == 'f' and d.get('fill') == (1.0, 1.0, 1.0) and (r.width > 200 or r.height > 200):
            continue
        if r.width == 0 and r.height == 0:
            continue
        x0 = min(x0, r.x0); y0 = min(y0, r.y0); x1 = max(x1, r.x1); y1 = max(y1, r.y1)
    for s in spans:
        bb = s['bb']
        x0 = min(x0, bb[0]); y0 = min(y0, bb[1]); x1 = max(x1, bb[2]); y1 = max(y1, bb[3])
    margen = {'izq': x0 * MM, 'arriba': y0 * MM, 'der': (Wp - x1) * MM, 'abajo': (H - y1) * MM}
    med = lambda v: round(statistics.median(v), 2) if v else None
    mn = lambda v: round(min(v), 2) if v else None
    return {
        'tam_mm': [round(Wp * MM, 1), round(H * MM, 1)],
        'letra_desc_pt': letra, 'letra_min_pt': round(min(s['size'] for s in spans), 2) if spans else None,
        'letra_min_flujo_pt': round(min(s['size'] for s in zona_spans), 2) if zona_spans else None,
        'em_mm': round(em_mm, 2),
        'n_figuras': len(flujo), 'n_pares_filas': len(gaps),
        'fila_gap_mm': {'min': mn(gaps), 'mediana': med(gaps), 'max': round(max(gaps), 2) if gaps else None},
        'fila_gap_em': {'min': round(min(gaps) / em_mm, 2) if gaps else None, 'mediana': round(statistics.median(gaps) / em_mm, 2) if gaps else None},
        'fila_paso_mm_mediana': med(pasos),
        'cols_gutter_mm': {'min': mn(huecos_min), 'mediana': med(huecos_med)} if huecos_min else None,
        'cols_gutter_em': {'min': round(min(huecos_min) / em_mm, 2), 'mediana': round(statistics.median(huecos_med) / em_mm, 2)} if huecos_min else None,
        'cols_detalle': detalle_col,
        'texto_a_linea_mm': {'arriba_min': mn(arr), 'arriba_p10': round(sorted(arr)[max(0, int(len(arr) * 0.1))], 2) if arr else None,
                              'abajo_min': mn(abj), 'abajo_p10': round(sorted(abj)[max(0, int(len(abj) * 0.1))], 2) if abj else None,
                              'derecha_min': mn(der_), 'derecha_mediana': med(der_)},
        'texto_a_figura_izq_mm': {'min': mn(texto_figura), 'mediana': med(texto_figura)},
        'n_descripciones': len(desc),
        'margen_mm': {k: round(v, 1) for k, v in margen.items()},
    }


def medir(pdf):
    d = fitz.open(pdf)
    return [medir_pagina(p) for p in d]


def resumen(pags):
    """une las paginas: minimos de los minimos, medianas pesadas simples."""
    def juntar(f):
        v = [f(p) for p in pags]
        return [x for x in v if x is not None]
    gm = juntar(lambda p: p['fila_gap_mm']['min'])
    gmed = juntar(lambda p: p['fila_gap_mm']['mediana'])
    cm = juntar(lambda p: p['cols_gutter_mm']['min'] if p['cols_gutter_mm'] else None)
    cmed = juntar(lambda p: p['cols_gutter_mm']['mediana'] if p['cols_gutter_mm'] else None)
    letra = juntar(lambda p: p['letra_desc_pt'])
    em = juntar(lambda p: p['em_mm'])
    return {
        'paginas': len(pags),
        'letra_desc_pt': round(statistics.median(letra), 2) if letra else None,
        'letra_min_pt': min(juntar(lambda p: p['letra_min_pt'])),
        'fila_gap_mm_min': min(gm) if gm else None, 'fila_gap_mm_mediana': round(statistics.median(gmed), 2) if gmed else None,
        'fila_gap_em_mediana': round(statistics.median(gmed) / statistics.median(em), 2) if gmed else None,
        'fila_gap_em_min': round(min(gm) / statistics.median(em), 2) if gm else None,
        'cols_gutter_mm_min': min(cm) if cm else None, 'cols_gutter_mm_mediana': round(statistics.median(cmed), 2) if cmed else None,
        'cols_gutter_em_mediana': round(statistics.median(cmed) / statistics.median(em), 2) if cmed else None,
        'texto_arriba_min': min(juntar(lambda p: p['texto_a_linea_mm']['arriba_min'])) if juntar(lambda p: p['texto_a_linea_mm']['arriba_min']) else None,
        'texto_abajo_min': min(juntar(lambda p: p['texto_a_linea_mm']['abajo_min'])) if juntar(lambda p: p['texto_a_linea_mm']['abajo_min']) else None,
        'texto_derecha_min': min(juntar(lambda p: p['texto_a_linea_mm']['derecha_min'])) if juntar(lambda p: p['texto_a_linea_mm']['derecha_min']) else None,
        'margen_min_mm': min(min(p['margen_mm'].values()) for p in pags),
    }


if __name__ == '__main__':
    pdf = sys.argv[1]
    pags = medir(pdf)
    if '--json' in sys.argv:
        print(json.dumps({'paginas': pags, 'resumen': resumen(pags)}, ensure_ascii=False, indent=1))
    else:
        for i, p in enumerate(pags):
            print(f'--- pagina {i + 1}')
            for k, v in p.items():
                if k != 'cols_detalle':
                    print(f'  {k}: {v}')
            for c in p['cols_detalle']:
                print('   columnas', c)
        print('=== resumen', json.dumps(resumen(pags), ensure_ascii=False))
