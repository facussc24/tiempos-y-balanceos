import os, sys, traceback
import win32com.client

OUT = r"C:\Users\FacundoS-PC\AppData\Local\Temp\claude\C--Dev-BarackMercosul\c90f901f-4b01-4d5e-9522-1b0de41fa487\scratchpad\png"
os.makedirs(OUT, exist_ok=True)
BASE = r"C:\Users\FacundoS-PC\OneDrive - BARACK ARGENTINA SRL\Desktop\Informe TryOut IMG - Dia 5 (02-09)\04- Entregable"

jobs = [
    ("TryOut_IMG_Dia1a5.pptx", "ES", [42, 43, 44, 45, 46, 47]),
    ("TryOut_IMG_Day1to5_EN.pptx", "EN", [42, 43, 44, 45]),
    ("TryOut_IMG_Dia5.pptx", "D5", [1, 2, 3, 4]),
]

app = win32com.client.Dispatch("PowerPoint.Application")
for fname, tag, pages in jobs:
    path = os.path.join(BASE, fname)
    try:
        pres = app.Presentations.Open(path, ReadOnly=True, WithWindow=False)
    except Exception:
        print("OPEN-FAIL", fname)
        traceback.print_exc()
        continue
    print("OPEN-OK", fname, "slides=", pres.Slides.Count)
    for n in pages:
        if n > pres.Slides.Count:
            print("  skip", n)
            continue
        dst = os.path.join(OUT, "%s_%02d.png" % (tag, n))
        pres.Slides(n).Export(dst, "PNG", 1920, 1080)
        print("  exported", dst, os.path.getsize(dst))
    pres.Close()
app.Quit()
print("DONE")
