"""
verificar_D.py <pdf> <clave> [--criterio] — chequeos sobre el PDF A3 de D (1 o 2 hojas). No modifica nada. Sale con 1 si algo falla.

  1. cantidad de hojas (1 o 2) y tamano A3 EXACTO de cada una (297 x 420 o 420 x 297 mm, tolerancia 0,15 mm)
  2. letra impresa MEDIDA EN EL PDF (spans de texto, en pt): minimo >= 8,0
  3. margen: ni un trazo ni una letra a menos de 10 mm de cada borde de CADA hoja
  4. contenido: cada operacion, numero, descripcion, decision, rama, conector, sigla, rotulo, producto y revision del JSON (como esta
     commiteado) contra el texto de TODAS las hojas juntas (0 faltantes) y cada numero de paso en la MISMA fila que su descripcion
  5. textos que se pisan, por hoja
  6. conectores de hoja: si son 2 hojas, "CONTINUA EN HOJA 2" en la 1 y "VIENE DE HOJA 1" en la 2; la leyenda (codigos e historial) solo en la ultima
  7. (--criterio) el AIRE: el criterio fijado antes de disenar, medido con medir_aire.py (ver CRITERIO abajo)
  8. retornos (REVERIFICAR / RETRABAJO): lo que dejo escrito el render en el JSON de medidas (todos dibujados hasta su operacion, 0 choques)

CRITERIO (fijado el 08/10/2026 a partir de la medicion del original y de B, ver D_aire/CRITERIO.md):
  letra >= 8 pt (D usa 9 pt en los 8, o 8,5 donde el ancho no deja) | margen >= 10 mm | linea entre dos figuras consecutivas >= 2,2 em de la
  letra Y >= 6,5 mm | separacion entre ramas (colGap) >= 3 em | texto de una descripcion a la linea o figura vecina (que no sea la suya) >= 1,5 mm
"""
import json, re, sys, os, subprocess
import fitz

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, '..', '..', '..', '..'))
sys.path.insert(0, AQUI)
pdf, clave = sys.argv[1], sys.argv[2]
datos = json.loads(subprocess.run(['git', 'show', f'HEAD:tools/flowchart/data/{clave}.json'], cwd=RAIZ, capture_output=True, check=True).stdout.decode('utf8'))
PISO_PT, MARGEN_MIN_MM = 8.0, 10.0
MM = 25.4 / 72
doc = fitz.open(pdf)
fallas, res = [], {'clave': clave, 'pdf': os.path.basename(pdf), 'paginas': len(doc)}
if len(doc) not in (1, 2): fallas.append(f'{len(doc)} hojas (se admiten 1 o 2)')

# 1 tamano
tam = []
for i, p in enumerate(doc):
    w, h = p.rect.width * MM, p.rect.height * MM
    tam.append([round(w, 2), round(h, 2)])
    if not ((abs(w - 297) < 0.15 and abs(h - 420) < 0.15) or (abs(w - 420) < 0.15 and abs(h - 297) < 0.15)):
        fallas.append(f'hoja {i + 1}: {w:.2f} x {h:.2f} mm no es A3 exacto')
res['tamano_mm'] = tam

# 2 letra y 3 margen, por hoja
spans_pag, mar_pag = [], []
letra_min = (1e9, '')
for i, p in enumerate(doc):
    spans = []
    for b in p.get_text('dict')['blocks']:
        for l in b.get('lines', []):
            for s in l['spans']:
                t = s['text'].strip()
                if t: spans.append({'t': t, 'size': s['size'], 'bbox': s['bbox']})
    spans_pag.append(spans)
    for s in spans:
        if s['size'] < letra_min[0]: letra_min = (s['size'], s['t'])
    x0 = y0 = 1e9; x1 = y1 = -1e9
    for d in p.get_drawings():
        if d['type'] == 'f' and d.get('fill') == (1.0, 1.0, 1.0): continue
        r = d['rect']
        if r.width == 0 and r.height == 0: continue
        x0 = min(x0, r.x0); y0 = min(y0, r.y0); x1 = max(x1, r.x1); y1 = max(y1, r.y1)
    for s in spans:
        bb = s['bbox']; x0 = min(x0, bb[0]); y0 = min(y0, bb[1]); x1 = max(x1, bb[2]); y1 = max(y1, bb[3])
    mar = {'izq': x0 * MM, 'arriba': y0 * MM, 'der': (p.rect.width - x1) * MM, 'abajo': (p.rect.height - y1) * MM}
    mar_pag.append({k: round(v, 2) for k, v in mar.items()})
    if min(mar.values()) < MARGEN_MIN_MM - 0.05: fallas.append(f'hoja {i + 1}: margen minimo {min(mar.values()):.2f} mm < {MARGEN_MIN_MM}')
res['letra_min_pt_PDF'] = round(letra_min[0], 2); res['letra_min_texto'] = letra_min[1]
if letra_min[0] < PISO_PT - 0.005: fallas.append(f'letra minima {letra_min[0]:.2f} pt < {PISO_PT}')
res['margen_mm'] = mar_pag

# 4 contenido (todas las hojas juntas)
norm = lambda x: re.sub(r'\s+', ' ', str(x)).strip().upper()
txt = norm(' '.join(p.get_text('text') for p in doc))
txt_ns = txt.replace(' ', '')
esp = []
def walk(seq):
    for nd in seq:
        for k in ['description', 'text', 'labelCondition']:
            if nd.get(k): esp.append((k, nd[k]))
        if nd.get('critical') and nd.get('criticalType'): esp.append(('sigla_nodo', nd['criticalType']))
        if nd.get('rework'): esp.append(('rework', nd['rework'].get('label') or f"RETRABAJO (A OP. {nd['rework']['targetId']})"))
        bs = nd.get('branchSide')
        if bs:
            for k in ['text', 'description']:
                if bs.get(k): esp.append(('lado_' + k, bs[k]))
        for b in nd.get('branches', []) or []: walk(b if isinstance(b, list) else b['sequence'])
        if bs and bs.get('sequence'): walk(bs['sequence'])
walk(datos['flow'])
h = datos['header']
for k in ['title', 'documentCode', 'revision', 'date', 'preparedBy', 'reviewedBy', 'project', 'client']:
    if h.get(k): esp.append(('cabecera', h[k]))
esp.append(('cabecera', h.get('revisionDate') or '—'))
for sc in h.get('specialChars', []) or []: esp.append(('sigla', sc['mark'])); esp.append(('sigla', sc['meaning']))
if h.get('footerNote'): esp.append(('nota', h['footerNote']))
for p_ in datos['products']:
    for k in ['code', 'level', 'description', 'operations', 'version']:
        if p_.get(k): esp.append(('producto', p_[k]))
for r in datos['revisions']:
    for k in ['rev', 'date', 'item', 'details', 'pswDate', 'modifiedBy']:
        if r.get(k): esp.append(('revision', r[k]))
cont = {}
def suma(k, n=1): cont[k] = cont.get(k, 0) + n
def walk_ids(seq):
    for nd in seq:
        bs = nd.get('branchSide') or {}
        for sid in [nd.get('stepId'), bs.get('stepId')]:
            if sid: suma(str(sid))
        if nd.get('incomingConnector'): suma('conn:' + nd['incomingConnector'])
        if bs.get('type') == 'connector': suma('conn:' + bs['text'])
        if nd.get('labelDown'): suma('lbl:' + nd['labelDown'])
        if bs.get('labelNode'): suma('lbl:' + bs['labelNode'])
        for b in nd.get('branches', []) or []: walk_ids(b if isinstance(b, list) else b['sequence'])
        if bs.get('sequence'): walk_ids(bs['sequence'])
walk_ids(datos['flow'])
faltan, vistos = [], {}
for tipo, t in esp:
    n_ = norm(t); vistos[n_] = vistos.get(n_, 0) + 1
for n_, veces in vistos.items():
    if txt.count(n_) < veces and txt_ns.count(n_.replace(' ', '')) < veces: faltan.append((n_, veces, txt.count(n_)))
palabras = [norm(w[4]) for p in doc for w in p.get_text('words')]
for sid, veces in cont.items():
    if sid.startswith('conn:'):
        letra = sid[5:].upper()
        if palabras.count(letra) < veces: faltan.append((f'conector {letra}', veces, palabras.count(letra)))
    elif sid.startswith('lbl:'):
        et = sid[4:].upper()
        if palabras.count(et) < veces: faltan.append((f'rotulo {et}', veces, palabras.count(et)))
    elif palabras.count(sid.upper()) < veces: faltan.append((f'paso {sid}', veces, palabras.count(sid.upper())))
res['contenido_esperado'] = len(vistos) + len(cont); res['faltan'] = faltan
if faltan: fallas.append(f'faltan {len(faltan)} textos')

# pasos con su descripcion en la misma fila (por hoja: el paso y su descripcion estan en la misma hoja)
pares = []
def walk_pares(seq):
    for nd in seq:
        if nd.get('stepId') and nd.get('description'): pares.append((str(nd['stepId']).upper(), norm(nd['description']).split(' ')[0]))
        for b_ in nd.get('branches', []) or []: walk_pares(b_ if isinstance(b_, list) else b_['sequence'])
        if nd.get('branchSide') and nd['branchSide'].get('sequence'): walk_pares(nd['branchSide']['sequence'])
walk_pares(datos['flow'])
Wd = [[(w[0], w[1], w[2], w[3], norm(w[4])) for w in p.get_text('words')] for p in doc]
req = {}
for p_ in pares: req[p_] = req.get(p_, 0) + 1
pares_mal = []
for (sid, tok), veces in req.items():
    hallados = 0
    for W in Wd:
        for a_ in W:
            if a_[4] != sid: continue
            ya = (a_[1] + a_[3]) / 2
            for b_ in W:
                if b_[4] == tok and b_[0] > a_[2] - 1 and b_[0] - a_[2] < 110 and abs((b_[1] + b_[3]) / 2 - ya) < 12:
                    hallados += 1; break
    if hallados < veces: pares_mal.append((sid, tok, veces, hallados))
res['pares_paso_descripcion'] = {'esperados': len(pares), 'sin_su_descripcion_en_la_fila': pares_mal}
if pares_mal: fallas.append(f'{len(pares_mal)} pasos sin su descripcion al lado')

# 5 pisadas
n_pisan = 0; ejemplos = []
for W in [p.get_text('words') for p in doc]:
    for i in range(len(W)):
        a = W[i]
        for j in range(i + 1, len(W)):
            b = W[j]
            ha, hb = a[3] - a[1], b[3] - b[1]
            ix = min(a[2], b[2]) - max(a[0], b[0])
            iy = min(a[3] - 0.22 * ha, b[3] - 0.22 * hb) - max(a[1] + 0.22 * ha, b[1] + 0.22 * hb)
            if ix > 0.8 and iy > 0.6:
                n_pisan += 1; ejemplos.append((a[4], b[4], round(ix, 1), round(iy, 1)))
res['n_pisan'] = n_pisan; res['textos_que_se_pisan'] = ejemplos[:10]
if n_pisan: fallas.append(f'{n_pisan} pares de palabras se pisan')

# 6 conectores de hoja y leyenda
if len(doc) == 2:
    t1, t2 = norm(doc[0].get_text('text')), norm(doc[1].get_text('text'))
    if 'CONTINÚA EN HOJA 2' not in t1: fallas.append('la hoja 1 no dice CONTINUA EN HOJA 2')
    if 'VIENE DE HOJA 1' not in t2.replace('\n', ' ') and 'VIENE DE HOJA 1' not in t2: fallas.append('la hoja 2 no dice VIENE DE HOJA 1')
    if 'HISTORIAL DE REVISIONES' in t1 or 'SÍMBOLOS Y REFERENCIAS' in t1: fallas.append('la leyenda esta en la hoja 1')
    if 'HISTORIAL DE REVISIONES' not in t2: fallas.append('el historial no esta en la hoja 2')
    res['hoja_n_de_n'] = ('HOJA 1 DE 2' in t1, 'HOJA 2 DE 2' in t2)
    if not all(res['hoja_n_de_n']): fallas.append('falta "HOJA n DE 2" en la cabecera')

# 8 retornos (sidecar del render)
side = pdf.replace('.pdf', '_medidas.json')
if os.path.exists(side):
    m = json.load(open(side, encoding='utf8'))
    rt = m['retornos']
    res['retornos'] = rt
    if rt['dibujados'] != rt['esperados'] or rt['conChoques'] or rt['problemas']:
        fallas.append(f"retornos: {rt['dibujados']}/{rt['esperados']} dibujados, {rt['conChoques']} con choques")

# 7 aire
if '--criterio' in sys.argv:
    import medir_aire as M
    pags = M.medir(pdf)
    r = M.resumen(pags)
    res['aire'] = r
    em_mm = statistics_em = None
    if r['fila_gap_em_min'] is not None and r['fila_gap_em_min'] < 2.2 - 0.05: fallas.append(f"linea entre figuras: minimo {r['fila_gap_em_min']} em < 2,2 em")
    if r['fila_gap_mm_min'] is not None and r['fila_gap_mm_min'] < 6.5 - 0.05: fallas.append(f"linea entre figuras: minimo {r['fila_gap_mm_min']} mm < 6,5 mm")
    if r['cols_gutter_mm_min'] is not None and r['cols_gutter_mm_min'] < 9.0: fallas.append(f"hueco entre ramas: minimo {r['cols_gutter_mm_min']} mm < 9 mm")
    tl = [v for v in (r['texto_arriba_min'], r['texto_abajo_min'], r['texto_derecha_min']) if v is not None]
    if tl and min(tl) < 1.5: fallas.append(f"texto a linea vecina: minimo {min(tl)} mm < 1,5 mm")

res['fallas'] = fallas
print(json.dumps(res, ensure_ascii=False, indent=1))
sys.exit(1 if fallas else 0)
