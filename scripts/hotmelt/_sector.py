import sys, openpyxl, warnings, collections
warnings.filterwarnings("ignore")
for p in sys.argv[1:]:
    wb=openpyxl.load_workbook(p, data_only=True); tag=p.split("/")[-1][:6]
    print("###",tag)
    for sn in wb.sheetnames:
        ws=wb[sn]
        print(f"  hoja {sn:>4} | B6={ws['B6'].value!r:>8} | SECTOR B8={ws['B8'].value!r} | DENOM E6={str(ws['E6'].value)[:45]!r}")
