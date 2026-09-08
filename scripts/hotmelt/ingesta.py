# Ingesta de los videos de la maquina HOTMELT:
#   rehidrata -> audio WAV 16k mono + frames 1/2s -> vuelve a deshidratar (attrib +U -P)
# Resumible: si ya existe el WAV y la carpeta de frames con contenido, saltea.
import os, re, subprocess, sys, json, time

FF = r"C:\Users\FacundoS-PC\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1-full_build\bin"
SRC = r"C:\Users\FacundoS-PC\BARACK ARGENTINA SRL\Ingeniería y Proyecto - General\INGENIERIA BARACK (NUNCA BORRAR)\5- VIDEOS Y FOTOS\1- CLIENTES\NOVAX\TOP ROLL\MAQUINA HOTMELT"
TAR = r"C:\Users\FacundoS-PC\OneDrive - BARACK ARGENTINA SRL\Desktop\Hojas de proceso maquina HOTMELT - desde los videos"
AUD = os.path.join(TAR, "_trabajo", "audio")
FRM = os.path.join(TAR, "frames")
LOG = os.path.join(TAR, "_trabajo", "ingesta_log.json")
os.makedirs(AUD, exist_ok=True); os.makedirs(FRM, exist_ok=True)

def img(name):           # IMG_0347 -> 0347
    m = re.search(r"IMG_(\d+)", name)
    return m.group(1) if m else name

def libre_gb():
    import shutil
    return shutil.disk_usage("C:\\").free / 1e9

log = json.load(open(LOG, encoding="utf8")) if os.path.exists(LOG) else {}

vids = sorted(f for f in os.listdir(SRC) if f.lower().endswith(".mov"))
print(f"{len(vids)} videos | libre {libre_gb():.1f} GB", flush=True)

for i, v in enumerate(vids, 1):
    n = img(v)
    src = os.path.join(SRC, v)
    wav = os.path.join(AUD, f"{n}.wav")
    fdir = os.path.join(FRM, n)
    if os.path.exists(wav) and os.path.isdir(fdir) and os.listdir(fdir):
        print(f"[{i}/{len(vids)}] {n} ya hecho", flush=True); continue
    os.makedirs(fdir, exist_ok=True)
    t0 = time.time()
    # duracion (esto ya rehidrata el archivo)
    try:
        dur = float(subprocess.run([os.path.join(FF, "ffprobe.exe"), "-v", "error",
              "-show_entries", "format=duration", "-of", "csv=p=0", src],
              capture_output=True, text=True, timeout=1800).stdout.strip())
    except Exception as e:
        print(f"[{i}/{len(vids)}] {n} ERROR ffprobe: {e}", flush=True); continue
    # una sola pasada: audio 16k mono + frames 1 cada 2 s
    cmd = [os.path.join(FF, "ffmpeg.exe"), "-v", "error", "-y", "-i", src,
           "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", wav,
           "-vf", "fps=1/2", "-q:v", "5", os.path.join(fdir, f"{n}_%04d.jpg")]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=3600)
    if r.returncode != 0:
        print(f"[{i}/{len(vids)}] {n} ERROR ffmpeg: {r.stderr[:300]}", flush=True); continue
    nf = len(os.listdir(fdir))
    # deshidratar: vuelve a "solo online" y libera el disco
    subprocess.run(["attrib", "+U", "-P", src], capture_output=True, shell=True)
    log[n] = {"video": v, "dur_s": round(dur, 1), "frames": nf}
    json.dump(log, open(LOG, "w", encoding="utf8"), ensure_ascii=False, indent=1)
    print(f"[{i}/{len(vids)}] {n} {dur/60:5.1f} min  {nf:4d} frames  "
          f"({time.time()-t0:.0f}s)  libre {libre_gb():.1f} GB", flush=True)

tot = sum(x["dur_s"] for x in log.values())
print(f"LISTO. {len(log)} videos, {tot/60:.1f} min de video en total.", flush=True)
