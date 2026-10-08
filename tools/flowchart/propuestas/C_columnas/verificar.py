# -*- coding: utf-8 -*-
"""
verificar.py — PROPUESTA C. Verifica un PDF A3 generado por render.mjs.

1. CONTENIDO: lo que dice el JSON (stepId, descripcion, rombos, terminales, conectores, siglas, retrabajos,
   cabecera, codigos, revisiones) contra (a) el DOM que renderizo Chromium, rol por rol y con multiplicidad, y
   (b) las palabras del PDF final. Informa faltantes y sobrantes.
2. LETRA: tamaño en pt de cada trozo de texto del PDF (PyMuPDF), minimo general y minimo del flujo.
   Cuenta de control: px CSS x (mm por px de la hoja) / 0,3528 = pt.
3. HOJA: cantidad de paginas y tamaño real (420 x 297 mm = 1190,55 x 841,89 pt).

Uso: python verificar.py <clave>   (lee el JSON de tools/flowchart/data y la salida de exports/.../C_columnas)
"""
import sys, io, json, os, re
from collections import Counter

import fitz  # PyMuPDF

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, '..', '..', '..', '..'))
DATA = os.path.join(RAIZ, 'tools', 'flowchart', 'data')
SAL = os.path.join(RAIZ, 'exports', 'flujogramas_a3_propuestas', 'C_columnas')

clave = sys.argv[1]
datos = json.load(open(os.path.join(DATA, clave + '.json'), encoding='utf-8'))
pdf_path = os.path.join(SAL, f'FLUJOGRAMA_{clave}_C_columnas_A3.pdf')
info_path = os.path.join(SAL, f'{clave}_info.json')
info = json.load(open(info_path, encoding='utf-8'))
dom = info['dom']


def norm(t):
    return re.sub(r'\s+', ' ', (t or '')).strip().upper()


# ---------------------------------------------------------------- esperado desde el JSON
esp = {k: [] for k in ['id', 'desc', 'cond', 'terminal', 'conn', 'latdesc', 'labelNode', 'labelDown', 'critical', 'vienede', 'rework']}
sin_dibujo = []
pares_esp = []   # (stepId, descripcion) de cada nodo del JSON
DIBUJA_ID = {'operation', 'op-ins', 'storage', 'inspection'}


def walk(seq):
    for n in seq:
        t = n.get('type')
        if n.get('stepId') and t in DIBUJA_ID:
            esp['id'].append(norm(n['stepId']))
        elif n.get('stepId'):
            sin_dibujo.append(f"{t} {n['stepId']}")
        if n.get('description'):
            esp['desc'].append(norm(n['description']))
            pares_esp.append((norm(n.get('stepId')), norm(n['description'])))
        if t == 'condition' and n.get('labelCondition'):
            esp['cond'].append(norm(n['labelCondition']))
        if t == 'terminal' and n.get('text'):
            esp['terminal'].append(norm(n['text']))
        if n.get('labelDown'):
            esp['labelDown'].append(norm(n['labelDown']))
        if n.get('critical'):
            esp['critical'].append(norm(n.get('criticalType')))
        if n.get('incomingConnector'):
            esp['conn'].append(norm(n['incomingConnector']))
            esp['vienede'].append('VIENE DE')
        if n.get('rework'):
            rw = n['rework']
            esp['rework'].append(norm(rw.get('label') or f"RETRABAJO (A OP. {rw.get('targetId')})"))
        bs = n.get('branchSide')
        if bs:
            bt = bs.get('type')
            if bt == 'terminal' and bs.get('text'):
                esp['terminal'].append(norm(bs['text']))
            if bt == 'connector' and bs.get('text'):
                esp['conn'].append(norm(bs['text']))
            if bt in ('operation', 'inspection') and bs.get('stepId'):
                esp['id'].append(norm(bs['stepId']))
            if bs.get('description'):
                esp['latdesc'].append(norm(bs['description']))
            if bs.get('labelNode'):
                esp['labelNode'].append(norm(bs['labelNode']))
            if bs.get('sequence'):
                walk(bs['sequence'])
        for b in n.get('branches') or []:
            walk(b if isinstance(b, list) else b['sequence'])


walk(datos['flow'])

h = datos['header']
esp_hdr = [norm(h.get(k)) for k in ['documentCode', 'revision', 'date']] + [norm(h.get('revisionDate') or '—')] + [norm(h.get(k)) for k in ['preparedBy', 'reviewedBy', 'project', 'client']]
esp_title = norm(h['title'])
esp_leg = []
for p in datos['products']:
    for k in ['code', 'level', 'description', 'operations', 'version']:
        if p.get(k):
            esp_leg.append(norm(p[k]))
for r in datos['revisions']:
    for k in ['rev', 'date', 'item', 'details', 'pswDate', 'modifiedBy']:
        if r.get(k):
            esp_leg.append(norm(r[k]))
for sc in h.get('specialChars') or []:
    esp_leg += [norm(sc['mark']), norm(sc['meaning'])]
if h.get('footerNote'):
    esp_leg.append(norm(h['footerNote']))

# ---------------------------------------------------------------- DOM
dom_by = {}
for it in dom['items']:
    if it['role'] == 'id' and not norm(it['text']):
        continue   # figura de inspeccion sin numero en el JSON (igual que el motor original)
    dom_by.setdefault(it['role'], []).append(norm(it['text']))

faltan = []
sobran = []
resumen_roles = {}
for rol, lista in esp.items():
    c_esp, c_dom = Counter(lista), Counter(dom_by.get(rol, []))
    f = c_esp - c_dom
    s = c_dom - c_esp
    resumen_roles[rol] = (sum(c_esp.values()), sum(c_dom.values()))
    for k, v in f.items():
        faltan.append(f'[{rol}] falta x{v}: {k}')
    for k, v in s.items():
        sobran.append(f'[{rol}] sobra x{v}: {k}')
# pares stepId + descripcion: cada descripcion dibujada tiene que llevar el stepId de SU nodo (el motor lo deja en data-sid)
pares_dom = [(norm(it['sid']), norm(it['text'])) for it in dom['items'] if it['role'] == 'desc' and not norm(it['text']).startswith(('SIGUE EN COLUMNA', 'VIENE DE COLUMNA'))]
c_esp, c_dom = Counter(pares_esp), Counter(pares_dom)
for (sid, d), v in (c_esp - c_dom).items():
    faltan.append(f'[stepId+descripcion] falta x{v}: {sid or "(sin numero)"} {d}')
resumen_roles['stepId+desc'] = (len(pares_esp), len(pares_dom))
# cabecera / titulo / leyenda
c_esp, c_dom = Counter(esp_hdr), Counter(dom_by.get('hdr', []))
for k, v in (c_esp - c_dom).items():
    faltan.append(f'[hdr] falta x{v}: {k}')
resumen_roles['hdr'] = (len(esp_hdr), len(dom_by.get('hdr', [])))
if esp_title not in dom_by.get('title', []):
    faltan.append(f'[title] falta: {esp_title}')
c_esp, c_dom = Counter(esp_leg), Counter(dom_by.get('leg', []))
for k, v in (c_esp - c_dom).items():
    faltan.append(f'[leyenda] falta x{v}: {k}')
resumen_roles['leyenda'] = (len(esp_leg), len(dom_by.get('leg', [])))

# ---------------------------------------------------------------- PDF
doc = fitz.open(pdf_path)
pdf_words = Counter()
joined_parts = []
sizes = []   # (size_pt, text, page)
for pno, page in enumerate(doc, 1):
    for w in page.get_text('words'):
        pdf_words[norm(w[4])] += 1
        joined_parts.append(norm(w[4]))
    d = page.get_text('dict')
    for b in d['blocks']:
        for l in b.get('lines', []):
            for s in l['spans']:
                if s['text'].strip():
                    sizes.append((s['size'], s['text'].strip(), pno, s['bbox']))

joined = ''.join(joined_parts)
todas = []
for lista in esp.values():
    todas += lista
todas += esp_hdr + [esp_title] + esp_leg
tok_esp = Counter()
for s in todas:
    for t in s.split(' '):
        if t:
            tok_esp[t] += 1
faltan_pdf = []
partidas = []
for t, v in tok_esp.items():
    if pdf_words.get(t, 0) < v:
        # un token con guion o barra puede quedar partido entre dos renglones ("50-" / "52"): se acepta si sus pedazos estan
        # (se mira la cadena de palabras seguidas del PDF sin espacios: ahi el token vuelve a aparecer entero)
        if ('-' in t or '/' in t) and joined.count(t) >= v:
            partidas.append(t)
        else:
            faltan_pdf.append(f'{t} (esperado {v}, en PDF {pdf_words.get(t, 0)})')

# ---------------------------------------------------------------- letra
min_pdf = min(sizes, key=lambda x: x[0])
distintos = sorted({round(s[0], 2) for s in sizes})
# minimo del flujo: spans cuyo texto es de un rol del flujo (id, desc, cond, terminal, conn, latdesc, labelNode, labelDown, critical, vienede, rework, offpage)
roles_flujo = set(esp.keys()) | {'offpage'}
texto_flujo = set()
for it in dom['items']:
    if it['role'] in roles_flujo:
        for t in norm(it['text']).split(' '):
            texto_flujo.add(t)
# minimo por DOM (todo texto visible), separado por zona
fonts = dom['fonts']
min_dom_flujo = min(f['fontPx'] for f in fonts if f['inCol'])
min_dom_otros = min(f['fontPx'] for f in fonts if not f['inCol'])
peor_flujo = min((f for f in fonts if f['inCol']), key=lambda f: f['fontPx'])
peor_otros = min((f for f in fonts if not f['inCol']), key=lambda f: f['fontPx'])

PW_PT, PH_PT = 1190.55, 841.89
paginas = [(round(p.rect.width, 2), round(p.rect.height, 2)) for p in doc]
mm_por_px = 420.0 / info['info']['PW']
pt_por_px = mm_por_px / 0.3528

print(f'=== {clave} ===')
ok_tam = all(abs(a - PW_PT) < 0.1 and abs(b - PH_PT) < 0.1 for a, b in paginas)
print(f"Hojas: {len(doc)}   tamaño de cada una (pt): {set(paginas)}   esperado {PW_PT} x {PH_PT} (420 x 297 mm)  ->  {'OK' if ok_tam else 'NO COINCIDE'}")
print(f"Columnas: {info['info']['cols']}   problemas geometricos del render: {info['info']['problems'] or 'ninguno'}")
print(f"Escala real de la hoja: 420 mm / {info['info']['PW']:.1f} px CSS = {mm_por_px:.4f} mm/px  ->  1 px = {pt_por_px:.4f} pt")
print('Contenido esperado vs DOM (esperado, dibujado):')
for k, (a, b) in resumen_roles.items():
    print(f'   {k:10s} {a:4d} {b:4d}')
print(f'FALTANTES en DOM: {len(faltan)}')
for f in faltan:
    print('   ', f)
print(f'Sobrantes en DOM (solo se esperan los conectores de pagina): {len(sobran)}')
for s in sobran:
    print('   ', s)
print(f'Palabras del JSON que no estan en el texto del PDF: {len(faltan_pdf)}   (partidas entre dos renglones, pedazos presentes: {len(partidas)})')
for f in faltan_pdf[:20]:
    print('   ', f)
print(f'Tamaños de letra distintos en el PDF (pt): {distintos}')
print(f'MINIMO en el PDF: {min_pdf[0]:.2f} pt  ("{min_pdf[1][:40]}", hoja {min_pdf[2]})')
print(f'Minimo del FLUJO por DOM: {min_dom_flujo} px x {pt_por_px:.4f} = {min_dom_flujo * pt_por_px:.2f} pt  ("{peor_flujo["text"][:40]}", rol {peor_flujo["role"]})')
print(f'Minimo de cabecera/leyenda por DOM: {min_dom_otros} px x {pt_por_px:.4f} = {min_dom_otros * pt_por_px:.2f} pt  ("{peor_otros["text"][:40]}")')
if sin_dibujo:
    print('Nodos con stepId que el motor no dibuja (igual que el original):', sin_dibujo[:10])

res = {
    'clave': clave, 'hojas': len(doc), 'paginas_pt': paginas, 'columnas': info['info']['cols'], 'problemas': info['info']['problems'],
    'faltantes_dom': faltan, 'sobrantes_dom': sobran, 'faltantes_pdf': faltan_pdf,
    'min_pdf_pt': round(min_pdf[0], 3), 'min_flujo_pt': round(min_dom_flujo * pt_por_px, 3), 'min_cabecera_leyenda_pt': round(min_dom_otros * pt_por_px, 3),
    'mm_por_px': round(mm_por_px, 5), 'tamanos_pt': distintos, 'conteo_roles': resumen_roles,
}
json.dump(res, open(os.path.join(SAL, f'{clave}_verificacion.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
sys.exit(1 if faltan or faltan_pdf or info['info']['problems'] or min_pdf[0] < 7.0 else 0)
