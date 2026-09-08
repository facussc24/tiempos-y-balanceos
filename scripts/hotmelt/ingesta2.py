# Ingesta de los 13 videos del 02/09 traidos del telefono.
import os, subprocess, json, time
FF = r"C:\Users\FacundoS-PC\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1-full_build\bin"
SRC = r"C:\Users\FACUND~1\AppData\Local\Temp\claude\C--Dev-BarackMercosul\c66b0fd1-ca90-4cc1-86f1-5c8410cdd456\scratchpad\telefono"
TAR = r"C:\Users\FacundoS-PC\OneDrive - BARACK ARGENTINA SRL\Desktop\Hojas de proceso maquina HOTMELT - desde los videos"
AUD = os.path.join(TAR, "_trabajo", "audio"); FRM = os.path.join(TAR, "frames")
LOG = os.path.join(TAR, "_trabajo", "ingesta_log2.json")
os.makedirs(AUD, exist_ok=True)
log = json.load(open(LOG, encoding="utf8")) if os.path.exists(LOG) else {}
vids = sorted(f for f in os.listdir(SRC) if f.lower().endswith(".mov"))
print(f"{len(vids)} videos", flush=True)
for i, v in enumerate(vids, 1):
    n = v.replace("IMG_", "").replace(".MOV", "")
    src = os.path.join(SRC, v); wav = os.path.join(AUD, n + ".wav"); fdir = os.path.join(FRM, n)
    if os.path.exists(wav) and os.path.isdir(fdir) and os.listdir(fdir):
        print(f"[{i}/{len(vids)}] {n} ya hecho", flush=True); continue
    os.makedirs(fdir, exist_ok=True); t0 = time.time()
    dur = float(subprocess.run([os.path.join(FF, "ffprobe.exe"), "-v", "error",
          "-show_entries", "format=duration", "-of", "csv=p=0", src],
          capture_output=True, text=True).stdout.strip())
    r = subprocess.run([os.path.join(FF, "ffmpeg.exe"), "-v", "error", "-y", "-i", src,
        "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", wav,
        "-vf", "fps=1/2", "-q:v", "5", os.path.join(fdir, n + "_%04d.jpg")],
        capture_output=True, text=True, timeout=3600)
    if r.returncode != 0:
        print(f"[{i}/{len(vids)}] {n} ERROR: {r.stderr[:200]}", flush=True); continue
    nf = len(os.listdir(fdir))
    log[n] = {"video": v, "dur_s": round(dur, 1), "frames": nf}
    json.dump(log, open(LOG, "w", encoding="utf8"), ensure_ascii=False, indent=1)
    print(f"[{i}/{len(vids)}] {n} {dur/60:5.1f} min  {nf:4d} frames  ({time.time()-t0:.0f}s)", flush=True)
print("LISTO", flush=True)
