import sys, os
from PIL import Image
BASE = r"C:\Users\FacundoS-PC\BARACK ARGENTINA SRL\Ingenieria y Proyecto - General"
ROOT = None
def froot():
    global ROOT
    if ROOT: return ROOT
    import glob
    cands = glob.glob(r"C:\Users\FacundoS-PC\BARACK ARGENTINA SRL\*\INGENIERIA BARACK (NUNCA BORRAR)\1- GENERAL\TAREAS CERRADAS\2026\2026-09-03 - Hojas de proceso maquina HOTMELT - desde los videos\frames")
    ROOT = cands[0]
    return ROOT

def path(vid, n):
    return os.path.join(froot(), vid, "%s_%04d.jpg" % (vid, n))

def contact(vid, nums, out, cols=8, thumb=270):
    ims = []
    for n in nums:
        p = path(vid, n)
        if not os.path.exists(p): continue
        im = Image.open(p)
        w,h = im.size
        s = thumb/ max(w,h)
        im = im.resize((int(w*s), int(h*s)))
        ims.append((n, im))
    if not ims: 
        print("none"); return
    tw = max(i.size[0] for _,i in ims); th = max(i.size[1] for _,i in ims)
    from PIL import ImageDraw
    rows = (len(ims)+cols-1)//cols
    sheet = Image.new("RGB", (cols*tw, rows*(th+14)), (30,30,30))
    d = ImageDraw.Draw(sheet)
    for idx,(n,im) in enumerate(ims):
        r,c = divmod(idx, cols)
        sheet.paste(im, (c*tw, r*(th+14)))
        d.text((c*tw+3, r*(th+14)+th+1), str(n), fill=(255,255,0))
    sheet.save(out, quality=88)
    print(out, sheet.size, len(ims))

def crop(vid, n, box, out, scale=3):
    im = Image.open(path(vid,n))
    W,H = im.size
    x0,y0,x1,y1 = [int(v) for v in box]
    c = im.crop((x0,y0,x1,y1))
    c = c.resize((int(c.size[0]*scale), int(c.size[1]*scale)), Image.LANCZOS)
    c.save(out, quality=95)
    print(out, c.size)

if __name__ == "__main__":
    print(froot())
