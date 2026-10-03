# grilla_clip.py CLIP SEGUNDO [salida] : un cuadro del recorte con grilla de 50 px y los numeros, para ubicar camaras
import sys, subprocess, io
from PIL import Image, ImageDraw, ImageFont
clip, t = sys.argv[1], float(sys.argv[2])
r = subprocess.run(["ffmpeg","-v","error","-ss",f"{t}","-i",clip,"-frames:v","1","-f","image2pipe","-vcodec","png","-"],capture_output=True)
im = Image.open(io.BytesIO(r.stdout)).convert("RGB")
k = 2
im = im.resize((im.size[0]*k, im.size[1]*k), Image.LANCZOS)
d = ImageDraw.Draw(im)
f = ImageFont.truetype(r"C:\Windows\Fonts\segoeuib.ttf", 14)
for x in range(0, im.size[0]//k, 50):
    d.line([x*k,0,x*k,im.size[1]], fill=(0,160,255), width=1)
    d.text((x*k+2,2), str(x), font=f, fill=(255,200,0))
for y in range(0, im.size[1]//k, 50):
    d.line([0,y*k,im.size[0],y*k], fill=(0,160,255), width=1)
    d.text((2,y*k+2), str(y), font=f, fill=(255,200,0))
out = sys.argv[3] if len(sys.argv) > 3 else "g/grilla.png"
im.save(out); print(out, im.size[0]//k, im.size[1]//k)
