import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tool import froot, path
from PIL import Image
import numpy as np

def bezel_box(p, dbg=False):
    im = Image.open(p).convert("RGB")
    W,H = im.size
    small = im.resize((W//4, H//4), Image.BILINEAR)
    a = np.asarray(small).astype(np.int16)
    R,G,B = a[...,0],a[...,1],a[...,2]
    m = (B-R > 12) & (B-R < 75) & (R > 70) & (R < 190) & (G >= R) & (G <= B)
    # column/row profiles
    cs = m.mean(axis=0); rs = m.mean(axis=1)
    if m.mean() < 0.005: return None
    tc = max(cs.max()*0.25, 0.03); tr = max(rs.max()*0.25, 0.03)
    ci = np.where(cs>tc)[0]; ri = np.where(rs>tr)[0]
    if len(ci)<3 or len(ri)<3: return None
    x0,x1 = ci[0]*4, (ci[-1]+1)*4
    y0,y1 = ri[0]*4, (ri[-1]+1)*4
    return (x0,y0,x1,y1,W,H)

def zoom(p, out, box=None, scale=3, pad=0.06):
    im = Image.open(p)
    W,H = im.size
    if box is None:
        b = bezel_box(p)
        if b is None:
            box = (0,0,W,H)
        else:
            x0,y0,x1,y1,_,_ = b
            pw = int((x1-x0)*pad); ph = int((y1-y0)*pad)
            box = (max(0,x0-pw), max(0,y0-ph), min(W,x1+pw), min(H,y1+ph))
    c = im.crop(box)
    c = c.resize((int(c.size[0]*scale), int(c.size[1]*scale)), Image.LANCZOS)
    c.save(out, quality=95)
    return box, c.size
