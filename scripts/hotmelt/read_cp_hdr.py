import openpyxl
wb = openpyxl.load_workbook(r"C:\Users\FACUND~1\AppData\Local\Temp\claude\C--Dev-BarackMercosul\c66b0fd1-ca90-4cc1-86f1-5c8410cdd456\scratchpad\docs_fuente\Plan de Control - TOP ROLL PATAGONIA.xlsx", data_only=True)
ws = wb.active
for r in range(11, 18):
    vals = [ws.cell(row=r, column=c).value for c in range(1, 22)]
    print(r, vals)
