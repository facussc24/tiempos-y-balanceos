import sys, openpyxl, warnings, collections
warnings.filterwarnings("ignore")
for p in sys.argv[1:]:
    wb = openpyxl.load_workbook(p, data_only=True)
    print("#"*80); print("ARCHIVO:", p.split("/")[-1]); print("HOJAS:", wb.sheetnames)
    labels = collections.Counter(); resp=collections.Counter(); frec=collections.Counter(); reg=collections.Counter()
    meth=collections.Counter(); blocks=collections.Counter(); planlines=collections.Counter()
    hdrsets=collections.Counter()
    for sn in wb.sheetnames:
        ws = wb[sn]
        # find header row of ciclo de control
        vals = {}
        for row in ws.iter_rows():
            for c in row:
                v = c.value
                if isinstance(v,str) and v.strip():
                    vals[c.coordinate]=v.strip()
        # block titles
        for co,v in vals.items():
            u=v.upper()
            for t in ["IMÁGENES","DESCRIPCION DE LA OPERACIÓN","CICLO DE CONTROL","ELEMENTOS DE SEGURIDAD","PLAN DE REACCION","SI DETECTA","DETENGA","NOTIFIQUE","ESPERE","Referencia:","HOJA DE OPERACIONES","Form:","HO N"]:
                if u.startswith(t.upper()):
                    blocks[v]+=1
        # cajetin labels row5/7 and N col
        for coord in ["B5","E5","K5","N5","Q3","Q2","B7","E7","K7","L7","N7","N8","F2"]:
            if coord in vals: labels[(coord,vals[coord])]+=1
        # header of ciclo: find cell with 'Características a controlar'
        hdr=None
        for co,v in vals.items():
            if v.startswith("Características a controlar"):
                hdr=co
        if hdr:
            col = ''.join(ch for ch in hdr if ch.isalpha()); r=int(''.join(ch for ch in hdr if ch.isdigit()))
            rowvals=[c.value for c in ws[r] if c.value not in (None,"")]
            hdrsets[tuple(str(x) for x in rowvals)]+=1
            # data rows below
            from openpyxl.utils import column_index_from_string, get_column_letter
            ci=column_index_from_string(col)
            for rr in range(r+1, r+16):
                a=ws.cell(rr,ci).value
                if a in (None,""): continue
                # find resp/frec/reg by matching header columns
                pass
    print("BLOQUES/TITULOS encontrados:")
    for k,v in sorted(blocks.items()): print(f"   [{v:3}] {k!r}")
    print("CAJETIN labels:")
    for k,v in sorted(labels.items()): print(f"   [{v:3}] {k}")
    print("HEADER ciclo de control (fila completa):")
    for k,v in hdrsets.items(): print(f"   [{v:3}] {k}")
