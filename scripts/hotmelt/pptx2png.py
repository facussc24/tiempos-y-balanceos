import sys, os, win32com.client
src=os.path.abspath(sys.argv[1]); dst=os.path.abspath(sys.argv[2])
os.makedirs(dst, exist_ok=True)
app=win32com.client.Dispatch("PowerPoint.Application")
pres=app.Presentations.Open(src, WithWindow=False)
try:
    pres.Export(dst, "PNG", 1800, 1273)
finally:
    # PowerPoint a veces queda con un dialogo modal y Close/Quit tira COM error:
    # el Export ya se hizo, asi que el cierre no puede voltear el proceso.
    for f in (pres.Close, app.Quit):
        try: f()
        except Exception: pass
print("laminas:", len([x for x in os.listdir(dst) if x.upper().endswith(".PNG")]))
