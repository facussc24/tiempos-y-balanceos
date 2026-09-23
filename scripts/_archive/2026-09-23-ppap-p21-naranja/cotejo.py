# Cotejo final flujograma 159 <-> AMFE 173, sobre los archivos del SERVIDOR (los que se mandan):
# numero de operacion, nombre y marca de caracteristica especial. Y que el PDF del flujograma del
# servidor sea el que sale del JSON actual.
import json, re, unicodedata, hashlib, openpyxl
GI_A = r"Y:/Ingenieria/Documentacion Gestion Ingenieria/13. Analisis del modo de falla y sus efectos ( I-AC-005.3)/2. AMFES DE PROCESO/SMRC/173 - APB P21 HILO NARANJA COSTURA SIMPLE/AMFE 173 - APB P21 HILO NARANJA COSTURA SIMPLE - Rev.A.xlsx"
GI_F = r"Y:/Ingenieria/Documentacion Gestion Ingenieria/8. Flujograma Sinóptico (I-IN-002III)/CLIENTES/SMRC/159 - APB P21 HILO NARANJA COSTURA SIMPLE/FLUJOGRAMA 159 - APB P21 HILO NARANJA COSTURA SIMPLE - Rev.A.png"
LEG_F = r"Y:/BARACK/CALIDAD/DOCUMENTACION SGC/PPAP CLIENTES/REYDEL-SMRC/APB P21/P21 SSRT-MY2026 HILO NARANJA/APQP/05 - Process Flow & Standar Work/FLUJOGRAMA 159 - APB P21 HILO NARANJA COSTURA SIMPLE - Rev.A.pdf"
LEG_A = GI_A
PNG_JSON = r"tmp/_rev173/flujo/FLUJOGRAMA_159-APB-P21-MY2026.png"
PDF_FLUJO = r"tmp/_rev173/flujo/FLUJOGRAMA_159.pdf"
GI_FPDF = GI_F[:-4] + ".pdf"

norm = lambda s: re.sub(r'[^A-Z0-9]+', ' ', unicodedata.normalize('NFD', str(s or '')).encode('ascii', 'ignore').decode().upper()).strip()
md5 = lambda p: hashlib.md5(open(p, 'rb').read()).hexdigest()

# --- flujograma (JSON del que sale el PNG) ---
j = json.load(open('tools/flowchart/data/159-APB-P21-MY2026.json', encoding='utf-8'))
flujo = {}
def walk(arr):
    for n in arr or []:
        if n.get('stepId'):
            flujo[n['stepId']] = (n.get('description', ''), (n.get('criticalType') or '').replace(' ', ''))
        for b in n.get('branches') or []:
            walk(b)
        if n.get('branchSide', {}).get('sequence'):
            walk(n['branchSide']['sequence'])
walk(j['flow'])

# --- AMFE (Excel del servidor) ---
ws = openpyxl.load_workbook(GI_A)['AMFE']
val = {(c.row, c.column): c.value for row in ws.iter_rows() for c in row}
for rng in ws.merged_cells.ranges:
    v = ws.cell(rng.min_row, rng.min_col).value
    for r in range(rng.min_row, rng.max_row + 1):
        for c in range(rng.min_col, rng.max_col + 1):
            val[(r, c)] = v
hdr = next(r for r in range(1, 30) if any('Causa' in str(val.get((r, c)) or '') for c in range(1, 40)))
col = {str(val.get((hdr, c))).strip(): c for c in range(1, ws.max_column + 1) if val.get((hdr, c))}
cop, cnom, csc = col['Nro. Op.'], col['Paso del Proceso'], [v for k, v in col.items() if 'Especial' in k or k.startswith('Car')][0]
amfe = {}
for r in range(hdr + 1, ws.max_row + 1):
    op = val.get((r, cop))
    if op is None or not str(op).strip().isdigit():
        continue
    nom, sc = val.get((r, cnom)), str(val.get((r, csc)) or '').strip()
    d = amfe.setdefault(str(op).strip(), [nom, set()])
    if sc:
        d[1].add(sc)

ok = True
print(f"{'OP':>4}  {'FLUJOGRAMA':<46} {'AMFE':<46} MARCA flujo / AMFE")
for op in sorted(set(flujo) | set(amfe), key=int):
    f, a = flujo.get(op), amfe.get(op)
    fn, fm = (f or ('—', ''))
    an, asc = (a or ('—', set()))
    marca_a = ','.join(sorted(asc))
    marca_f = ','.join(sorted(fm.split(','))) if fm else ''
    igual_nom = norm(fn) == norm(an)
    igual_marca = marca_f == marca_a
    if not (f and a and igual_nom and igual_marca):
        ok = False
    flag = '' if (f and a and igual_nom and igual_marca) else '   <-- DIFIERE'
    print(f"{op:>4}  {str(fn)[:46]:<46} {str(an)[:46]:<46} {marca_f or '-'} / {marca_a or '-'}{flag}")
print('\nOperaciones: flujograma', len(flujo), '| AMFE', len(amfe), '| TODO ALINEADO' if ok else '| HAY DIFERENCIAS')
print('PNG del servidor = el del JSON actual:', md5(GI_F) == md5(PNG_JSON), '| PDF del flujograma: GI = paquete (05) = generado:', md5(GI_FPDF) == md5(LEG_F) == md5(PDF_FLUJO))

print('Fecha de emision / revision flujograma:', j['header']['date'], '/', j['header'].get('revisionDate'), '| revision', j['header']['revision'])
