# Transcribe los WAV de la maquina HOTMELT con faster-whisper large-v3-turbo.
# Idioma AUTODETECTADO por video (hay audio en español y en chino).
# Resumible: si el .txt ya existe, saltea.
import os, sys, time, json
os.environ["HF_HUB_DISABLE_SYMLINKS"] = "1"
os.environ["HF_HUB_DISABLE_XET"] = "1"
from faster_whisper import WhisperModel

TAR = r"C:\Users\FacundoS-PC\OneDrive - BARACK ARGENTINA SRL\Desktop\Hojas de proceso maquina HOTMELT - desde los videos"
AUD = os.path.join(TAR, "_trabajo", "audio")
OUT = os.path.join(TAR, "transcripciones")
os.makedirs(OUT, exist_ok=True)

NOMBRES = {}
SRC = r"C:\Users\FacundoS-PC\BARACK ARGENTINA SRL\Ingeniería y Proyecto - General\INGENIERIA BARACK (NUNCA BORRAR)\5- VIDEOS Y FOTOS\1- CLIENTES\NOVAX\TOP ROLL\MAQUINA HOTMELT"
import re
for f in os.listdir(SRC):
    m = re.search(r"IMG_(\d+)", f)
    if m:
        NOMBRES[m.group(1)] = f.rsplit(" (IMG", 1)[0]
NOMBRES.setdefault("0389", "2026-08-26 - HMI durante la limpieza - BAJADO DE GOOGLE FOTOS")
NOMBRES.setdefault("9415", "2026-08-25 - maquina con resguardo de malla - SIN CLASIFICAR")

print("cargando modelo...", flush=True)
m = WhisperModel("large-v3-turbo", device="cpu", compute_type="int8",
                 cpu_threads=os.cpu_count() or 4)
print("modelo OK", flush=True)

wavs = sorted(f for f in os.listdir(AUD) if f.endswith(".wav"))
for i, w in enumerate(wavs, 1):
    n = w[:-4]
    dst = os.path.join(OUT, f"{n}.txt")
    if os.path.exists(dst):
        print(f"[{i}/{len(wavs)}] {n} ya hecho", flush=True); continue
    t0 = time.time()
    segs, info = m.transcribe(os.path.join(AUD, w), vad_filter=True, beam_size=5,
                              condition_on_previous_text=False)
    lines = []
    for s in segs:
        lines.append(f"[{int(s.start)//60:02d}:{int(s.start)%60:02d}] {s.text.strip()}")
    hdr = (f"# IMG_{n}  —  {NOMBRES.get(n,'?')}\n"
           f"# idioma detectado: {info.language} (prob {info.language_probability:.2f})"
           f"  |  duracion {info.duration:.0f} s  |  {len(lines)} segmentos\n"
           f"# Transcripcion automatica (faster-whisper large-v3-turbo). "
           f"NO es fuente para un numero: los parametros salen de la pantalla del HMI.\n\n")
    open(dst, "w", encoding="utf8").write(hdr + "\n".join(lines) + "\n")
    print(f"[{i}/{len(wavs)}] {n} {info.language} ({info.language_probability:.2f}) "
          f"{info.duration:.0f}s -> {len(lines)} seg  ({time.time()-t0:.0f}s)", flush=True)

print("TRANSCRIPCION LISTA", flush=True)
