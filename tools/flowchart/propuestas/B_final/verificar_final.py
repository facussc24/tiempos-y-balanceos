"""
verificar_final.py <pdf> <clave> [--sin-tamano-exacto]
Chequeos sobre el PDF A3 ya generado (B_final). No modifica nada. Sale con codigo 1 si algo falla.

  1. una sola pagina y tamano A3 exacto (297 x 420 o 420 x 297 mm, tolerancia 0,15 mm)
  2. letra impresa MEDIDA EN EL PDF (spans de texto, en pt): minimo >= 8,0 y los 8 textos mas chicos
  3. margen: ni un trazo ni una letra a menos de 10 mm de cada borde de la hoja
  4. contenido: cada operacion, numero, descripcion, decision, rama, conector, sigla, rotulo, producto y revision del JSON
     contra el texto del PDF (0 faltantes), y cada numero de paso en la MISMA fila que su descripcion
  5. textos que se pisan
Los datos se leen de datos/ (copia de los JSON emitidos; el 160 es la version commiteada).
"""
import json, re, sys, os
import fitz

AQUI = os.path.dirname(os.path.abspath(__file__))
pdf = sys.argv[1]
clave = sys.argv[2]
datos = json.load(open(os.path.join(AQUI, 'datos', clave + '.json'), encoding='utf8'))
PISO_PT = 8.0
MARGEN_MIN_MM = 10.0

doc = fitz.open(pdf)
page = doc[0]
fallas = []
res = {'clave': clave, 'pdf': pdf}

# 1 pagina y tamano
w_pt, h_pt = page.rect.width, page.rect.height
mm = lambda v: v / 72 * 25.4
res['paginas'] = len(doc)
res['tamano_mm'] = [round(mm(w_pt), 2), round(mm(h_pt), 2)]
ok_a = abs(mm(w_pt) - 297) < 0.15 and abs(mm(h_pt) - 420) < 0.15
ok_b = abs(mm(w_pt) - 420) < 0.15 and abs(mm(h_pt) - 297) < 0.15
if len(doc) != 1: fallas.append(f'{len(doc)} paginas')
if not (ok_a or ok_b): fallas.append(f'tamano {res["tamano_mm"]} no es A3 exacto')

# 2 letra impresa
spans = []
for b in page.get_text('dict')['blocks']:
    for l in b.get('lines', []):
        for s in l['spans']:
            t = s['text'].strip()
            if t:
                bb = s['bbox']
                spans.append({'t': t, 'size': s['size'], 'bbox': bb})
sizes = sorted(spans, key=lambda s: s['size'])
res['letra_min_pt_PDF'] = round(sizes[0]['size'], 2)
res['letra_min_texto'] = sizes[0]['t']
res['mas_chicos'] = [(round(s['size'], 2), s['t'][:40]) for s in sizes[:6]]
res['spans_menores_a_piso'] = len([s for s in spans if s['size'] < PISO_PT - 0.005])
if sizes[0]['size'] < PISO_PT - 0.005: fallas.append(f'letra minima {sizes[0]["size"]:.2f} pt < {PISO_PT}')

# 3 margenes: trazos + textos
x0 = y0 = 1e9; x1 = y1 = -1e9
for d in page.get_drawings():
    if d['type'] == 'f' and d.get('fill') == (1.0, 1.0, 1.0): continue   # fondo blanco de la hoja: no es tinta
    r = d['rect']
    if r.width == 0 and r.height == 0: continue
    x0 = min(x0, r.x0); y0 = min(y0, r.y0); x1 = max(x1, r.x1); y1 = max(y1, r.y1)
for s in spans:
    bb = s['bbox']
    x0 = min(x0, bb[0]); y0 = min(y0, bb[1]); x1 = max(x1, bb[2]); y1 = max(y1, bb[3])
mar = {'izq': mm(x0), 'arriba': mm(y0), 'der': mm(w_pt - x1), 'abajo': mm(h_pt - y1)}
res['margen_mm'] = {k: round(v, 2) for k, v in mar.items()}
if min(mar.values()) < MARGEN_MIN_MM - 0.05: fallas.append(f'margen minimo {min(mar.values()):.2f} mm < {MARGEN_MIN_MM}')

# 4 contenido
def norm(x):
    return re.sub(r'\s+', ' ', str(x)).strip().upper()
txt = norm(page.get_text('text'))
txt_ns = txt.replace(' ', '')
esp = []
def walk(seq):
    for nd in seq:
        for k in ['description', 'text', 'labelCondition']:
            if nd.get(k): esp.append((k, nd[k]))
        if nd.get('critical') and nd.get('criticalType'): esp.append(('sigla_nodo', nd['criticalType']))
        if nd.get('rework'):
            esp.append(('rework', nd['rework'].get('label') or f"RETRABAJO (A OP. {nd['rework']['targetId']})"))
        bs = nd.get('branchSide')
        if bs:
            for k in ['text', 'description']:
                if bs.get(k): esp.append(('lado_' + k, bs[k]))
        for b in nd.get('branches', []) or []:
            walk(b if isinstance(b, list) else b['sequence'])
        if bs and bs.get('sequence'): walk(bs['sequence'])
walk(datos['flow'])
h = datos['header']
for k in ['title', 'documentCode', 'revision', 'date', 'preparedBy', 'reviewedBy', 'project', 'client']:
    if h.get(k): esp.append(('cabecera', h[k]))
esp.append(('cabecera', h.get('revisionDate') or '—'))
for sc in h.get('specialChars', []) or []:
    esp.append(('sigla', sc['mark'])); esp.append(('sigla', sc['meaning']))
if h.get('footerNote'): esp.append(('nota', h['footerNote']))
for p in datos['products']:
    for k in ['code', 'level', 'description', 'operations', 'version']:
        if p.get(k): esp.append(('producto', p[k]))
for r in datos['revisions']:
    for k in ['rev', 'date', 'item', 'details', 'pswDate', 'modifiedBy']:
        if r.get(k): esp.append(('revision', r[k]))

# palabras sueltas esperadas: numeros de paso, conectores, SI / NO
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
        for b in nd.get('branches', []) or []:
            walk_ids(b if isinstance(b, list) else b['sequence'])
        if bs.get('sequence'): walk_ids(bs['sequence'])
walk_ids(datos['flow'])

faltan = []
vistos = {}
for tipo, t in esp:
    n = norm(t)
    vistos[n] = vistos.get(n, 0) + 1
for n, veces in vistos.items():
    if txt.count(n) < veces and txt_ns.count(n.replace(' ', '')) < veces:
        faltan.append((n, veces, txt.count(n)))
palabras = [norm(w[4]) for w in page.get_text('words')]
for sid, veces in cont.items():
    if sid.startswith('conn:'):
        letra = sid[5:].upper()
        if palabras.count(letra) < veces: faltan.append((f'conector {letra}', veces, palabras.count(letra)))
    elif sid.startswith('lbl:'):
        et = sid[4:].upper()
        if palabras.count(et) < veces: faltan.append((f'rotulo {et}', veces, palabras.count(et)))
    elif palabras.count(sid.upper()) < veces:
        faltan.append((f'paso {sid}', veces, palabras.count(sid.upper())))

# numero de paso y primera palabra de su descripcion en la MISMA fila
pares = []
def walk_pares(seq):
    for nd in seq:
        if nd.get('stepId') and nd.get('description'):
            pares.append((str(nd['stepId']).upper(), norm(nd['description']).split(' ')[0]))
        for b_ in nd.get('branches', []) or []:
            walk_pares(b_ if isinstance(b_, list) else b_['sequence'])
        if nd.get('branchSide') and nd['branchSide'].get('sequence'): walk_pares(nd['branchSide']['sequence'])
walk_pares(datos['flow'])
W = [(w[0], w[1], w[2], w[3], norm(w[4])) for w in page.get_text('words')]
req = {}
for p_ in pares: req[p_] = req.get(p_, 0) + 1
pares_mal = []
for (sid, tok), veces in req.items():
    hallados = 0
    for a_ in W:
        if a_[4] != sid: continue
        ya = (a_[1] + a_[3]) / 2
        for b_ in W:
            if b_[4] == tok and b_[0] > a_[2] - 1 and b_[0] - a_[2] < 90 and abs((b_[1] + b_[3]) / 2 - ya) < 12:
                hallados += 1; break
    if hallados < veces: pares_mal.append((sid, tok, veces, hallados))
res['pares_paso_descripcion'] = {'esperados': len(pares), 'sin_su_descripcion_en_la_fila': pares_mal}
if pares_mal: fallas.append(f'{len(pares_mal)} pasos sin su descripcion al lado')
res['contenido_esperado'] = len(vistos) + len(cont)
res['faltan'] = faltan
if faltan: fallas.append(f'faltan {len(faltan)} textos')

# 5 pisadas
words = page.get_text('words')
pisan = []
for i in range(len(words)):
    a = words[i]
    for j in range(i + 1, len(words)):
        b = words[j]
        ha, hb = a[3] - a[1], b[3] - b[1]
        ix = min(a[2], b[2]) - max(a[0], b[0])
        iy = min(a[3] - 0.22 * ha, b[3] - 0.22 * hb) - max(a[1] + 0.22 * ha, b[1] + 0.22 * hb)
        if ix > 0.8 and iy > 0.6:
            pisan.append((a[4], b[4], round(ix, 1), round(iy, 1)))
res['n_pisan'] = len(pisan)
res['textos_que_se_pisan'] = pisan[:10]
if pisan: fallas.append(f'{len(pisan)} pares de palabras se pisan')

res['fallas'] = fallas
print(json.dumps(res, ensure_ascii=False, indent=1))
sys.exit(1 if fallas else 0)
