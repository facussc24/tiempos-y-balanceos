"""
verificar_pdf.py <clave> [--base]  — chequeos sobre el PDF A3 ya generado (propuesta B).

  1. una sola pagina y tamano A3 (420 x 297 mm, apaisada o vertical)
  2. tamano de letra IMPRESO medido en el propio PDF (spans de texto, en pt): minimo y los 8 textos mas chicos
  3. contenido: cada stepId + descripcion + rotulo del JSON contra el texto del PDF (0 faltantes)
  4. nada fuera de la hoja (palabras dentro de la pagina, con margen) y textos que se pisan
Sale con codigo 1 si algo falla. No modifica nada.
"""
import json, re, sys, os
import fitz

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, '..', '..', '..', '..'))
clave = sys.argv[1]
base = '--base' in sys.argv
OUT = os.path.join(RAIZ, 'exports', 'flujogramas_a3_propuestas', 'B_compacto')
pdf = os.path.join(OUT, f'FLUJOGRAMA_{clave}{"_BASE" if base else ""}_A3.pdf')
datos = json.load(open(os.path.join(RAIZ, 'tools', 'flowchart', 'data', clave + '.json'), encoding='utf8'))

doc = fitz.open(pdf)
fallas = []
res = {'clave': clave, 'pdf': pdf}

# 1 pagina y tamano
w_pt, h_pt = doc[0].rect.width, doc[0].rect.height
a3 = (1190.55, 841.89)
tam_ok = (abs(w_pt - a3[0]) < 2 and abs(h_pt - a3[1]) < 2) or (abs(w_pt - a3[1]) < 2 and abs(h_pt - a3[0]) < 2)
res['paginas'] = len(doc)
res['tamano_mm'] = [round(w_pt / 72 * 25.4, 1), round(h_pt / 72 * 25.4, 1)]
if len(doc) != 1: fallas.append(f'{len(doc)} paginas')
if not tam_ok: fallas.append(f'tamano {res["tamano_mm"]} no es A3')

page = doc[0]

# 2 letra impresa (spans del PDF)
spans = []
for b in page.get_text('dict')['blocks']:
    for l in b.get('lines', []):
        for s in l['spans']:
            t = s['text'].strip()
            if not t:
                continue
            bb = s['bbox']
            spans.append({'t': t, 'size': s['size'], 'h': bb[3] - bb[1], 'w': bb[2] - bb[0], 'x': bb[0], 'y': bb[1]})
sizes = sorted(spans, key=lambda s: s['size'])
res['letra_min_pt_PDF'] = round(sizes[0]['size'], 2)
res['letra_min_texto'] = sizes[0]['t']
res['mas_chicos'] = [(round(s['size'], 2), s['t'][:40]) for s in sizes[:8]]
# distribucion por tamano
dist = {}
for s in spans:
    k = round(s['size'], 1)
    dist[k] = dist.get(k, 0) + 1
res['distribucion_pt'] = dict(sorted(dist.items()))

# 3 contenido
def norm(x):
    return re.sub(r'\s+', ' ', str(x)).strip().upper()
txt = norm(page.get_text('text'))
txt_ns = txt.replace(' ', '')
esp = []   # (tipo, texto)
def walk(seq):
    for nd in seq:
        for k in ['description', 'text', 'labelCondition']:
            if nd.get(k): esp.append((k, nd[k]))
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
# stepId: se cuenta la cantidad de apariciones de cada numero como palabra suelta (>=)
cont = {}
def walk_ids(seq):
    for nd in seq:
        for sid in [nd.get('stepId'), (nd.get('branchSide') or {}).get('stepId')]:
            if sid: cont[str(sid)] = cont.get(str(sid), 0) + 1
        if nd.get('incomingConnector'): cont['conn:' + nd['incomingConnector']] = cont.get('conn:' + nd['incomingConnector'], 0) + 1
        bs = nd.get('branchSide')
        if bs and bs.get('type') == 'connector': cont['conn:' + bs['text']] = cont.get('conn:' + bs['text'], 0) + 1
        for b in nd.get('branches', []) or []:
            walk_ids(b if isinstance(b, list) else b['sequence'])
        if bs and bs.get('sequence'): walk_ids(bs['sequence'])
walk_ids(datos['flow'])

faltan = []
vistos = {}
for tipo, t in esp:
    n = norm(t)
    vistos[n] = vistos.get(n, 0) + 1
for n, veces in vistos.items():
    if txt.count(n) < veces and txt_ns.count(n.replace(" ", "")) < veces:
        faltan.append((n, veces, txt.count(n)))
# numeros de paso y conectores: palabras sueltas
palabras = [norm(w[4]) for w in page.get_text('words')]
for sid, veces in cont.items():
    if sid.startswith('conn:'):
        letra = sid[5:]
        if palabras.count(letra.upper()) < veces: faltan.append((f'conector {letra}', veces, palabras.count(letra.upper())))
    elif palabras.count(sid.upper()) < veces:
        faltan.append((f'paso {sid}', veces, palabras.count(sid.upper())))
# pares (numero de paso, descripcion): el numero tiene que estar en la MISMA fila que la primera palabra de su descripcion
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

# 4 limites y pisadas
words = page.get_text('words')
fuera = [w[4] for w in words if w[0] < 8 or w[1] < 8 or w[2] > w_pt - 8 or w[3] > h_pt - 8]
res['palabras_fuera_de_margen_8pt'] = fuera[:10]
if fuera: fallas.append(f'{len(fuera)} palabras fuera del margen')
pisan = []
for i in range(len(words)):
    a = words[i]
    for j in range(i + 1, len(words)):
        b = words[j]
        if (a[5], a[6]) == (b[5], b[6]) and a[7] != b[7] and False: continue
        ix = min(a[2], b[2]) - max(a[0], b[0])
        iy = min(a[3], b[3]) - max(a[1], b[1])
        ha, hb = a[3] - a[1], b[3] - b[1]
        iy = min(a[3] - 0.22 * ha, b[3] - 0.22 * hb) - max(a[1] + 0.22 * ha, b[1] + 0.22 * hb)
        if ix > 0.8 and iy > 0.6:
            pisan.append((a[4], b[4], round(ix, 1), round(iy, 1)))
res['textos_que_se_pisan'] = pisan[:10]
res['n_pisan'] = len(pisan)
if pisan: fallas.append(f'{len(pisan)} pares de palabras se pisan')

res['fallas'] = fallas
print(json.dumps(res, ensure_ascii=False, indent=1))
sys.exit(1 if fallas else 0)
