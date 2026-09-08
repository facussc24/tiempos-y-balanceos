import sys, os, glob, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tool import froot
from PIL import Image
import numpy as np

def score(p):
    im = Image.open(p).convert("RGB")
    im.thumbnail((320,320), Image.BILINEAR)
    a = np.asarray(im).astype(np.int16)
    R,G,B = a[...,0], a[...,1], a[...,2]
    # Siemens WinCC light lavender button fill: bluish, light, B>R
    lav = (B - R > 12) & (B - R < 60) & (R > 150) & (R < 240) & (B > 175) & (G >= R-6) & (G <= B+4)
    # green status button
    grn = (G - R > 30) & (G - B > 30) & (G > 140)
    return float(lav.mean()), float(grn.mean())

if __name__ == "__main__":
    root = froot()
    out = {}
    vids = sys.argv[1:]
    for vid in vids:
        fs = sorted(glob.glob(os.path.join(root, vid, "*.jpg")))
        for p in fs:
            k = vid + "_" + os.path.basename(p)[-8:-4]
            out[k] = score(p)
    json.dump(out, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "scores_%s.json" % vids[0]), "w"))
    print(len(out))
