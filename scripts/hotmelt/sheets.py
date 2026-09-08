import sys, os, glob
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tool import froot
from PIL import Image, ImageDraw

def build(vids, outprefix, stride=1, cols=8, thumb=220, perpage=48, outdir=None):
    root = froot()
    items = []
    for vid in vids:
        fs = sorted(glob.glob(os.path.join(root, vid, "*.jpg")))
        for i, p in enumerate(fs):
            if i % stride: continue
            items.append((vid + "_" + os.path.basename(p)[-8:-4], p))
    pages = []
    for pi in range(0, len(items), perpage):
        chunk = items[pi:pi+perpage]
        ims = []
        for lbl, p in chunk:
            im = Image.open(p); w,h = im.size; s = thumb/max(w,h)
            ims.append((lbl, im.resize((int(w*s), int(h*s)), Image.LANCZOS)))
        tw = max(i.size[0] for _,i in ims); th = max(i.size[1] for _,i in ims)
        rows = (len(ims)+cols-1)//cols
        sheet = Image.new("RGB", (cols*tw, rows*(th+14)), (20,20,20))
        d = ImageDraw.Draw(sheet)
        for idx,(lbl,im) in enumerate(ims):
            r,c = divmod(idx, cols)
            sheet.paste(im, (c*tw + (tw-im.size[0])//2, r*(th+14)))
            d.text((c*tw+2, r*(th+14)+th+1), lbl, fill=(255,255,0))
        out = os.path.join(outdir, "%s_%02d.jpg" % (outprefix, pi//perpage))
        sheet.save(out, quality=85)
        pages.append(out); print(out, sheet.size, len(ims))
    return pages
