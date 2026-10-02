import sys, os, win32com.client
src=os.path.abspath(sys.argv[1]); dst=os.path.abspath(sys.argv[2])
os.makedirs(dst, exist_ok=True)
app=win32com.client.Dispatch("PowerPoint.Application")
habia_abiertas=app.Presentations.Count   # lo que tenga abierto Fak no se cierra
pres=app.Presentations.Open(src, WithWindow=False)
try:
    pres.Export(dst, "PNG", 1800, 1273)
finally:
    # PowerPoint a veces queda con un dialogo modal y Close/Quit tira COM error:
    # el Export ya se hizo, asi que el cierre no puede voltear el proceso.
    try: pres.Close()
    except Exception: pass
    try:
        if habia_abiertas == 0 and app.Presentations.Count == 0:
            app.Quit()
    except Exception: pass
print("laminas:", len([x for x in os.listdir(dst) if x.upper().endswith(".PNG")]))
