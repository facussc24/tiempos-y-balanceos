import sys, openpyxl
p = sys.argv[1]
wb = openpyxl.load_workbook(p, data_only=True)
print("ARCHIVO:", p)
print("HOJAS:", wb.sheetnames)
for sn in wb.sheetnames[:2]:
    ws = wb[sn]
    print("="*70)
    print("HOJA:", sn, "dims:", ws.dimensions, "max_row", ws.max_row, "max_col", ws.max_column)
    print("MERGES:", sorted(str(m) for m in ws.merged_cells.ranges))
    for row in ws.iter_rows(min_row=1, max_row=min(ws.max_row,80), max_col=min(ws.max_column,25)):
        for c in row:
            if c.value not in (None, ""):
                print(f"  {c.coordinate}: {repr(c.value)}")
