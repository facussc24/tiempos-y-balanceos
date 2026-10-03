# probar_multi.py ARCHIVO N : cada linea es  objetivo|texto_para_la_voz . Sintetiza N tomas, transcribe (beam 5) y cuenta
# cuantas veces el objetivo (palabras, sin tildes ni signos) aparece en lo oido.
import sys, re, unicodedata, tempfile, pathlib
sys.path.insert(0, r"C:\Dev\BarackMercosul\exports\CLAUDES_POR_AREA_20261001\fuentes\voz_ilusiona")
import narrar
from piper import PiperVoice, SynthesisConfig
from faster_whisper import WhisperModel

voz = PiperVoice.load(str(narrar.VOZ))
modelo = WhisperModel(narrar.MODELO_ASR, device="cpu", compute_type="int8", local_files_only=True)
cfg = SynthesisConfig(length_scale=1.18)
tmp = pathlib.Path(tempfile.gettempdir()) / "probar_multi.wav"


def plano(s):
    s = unicodedata.normalize("NFD", s.lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return " ".join(re.findall(r"[a-z0-9]+", s))


n = int(sys.argv[2])
for linea in open(sys.argv[1], encoding="utf-8"):
    linea = linea.rstrip("\n")
    if not linea.strip() or "|" not in linea:
        continue
    objetivo, texto = linea.split("|", 1)
    obj = plano(objetivo)
    bien, vistos = 0, []
    for k in range(n):
        datos, dur = narrar.tomar(voz, texto, cfg)
        narrar.escribir_wav(tmp, datos, voz.config.sample_rate)
        segs, _ = modelo.transcribe(str(tmp), language="es", beam_size=5, condition_on_previous_text=False)
        oido = " ".join(s.text.strip() for s in segs)
        ok = obj in plano(oido)
        bien += ok
        vistos.append(("OK  " if ok else "MAL ") + oido)
    print(f"\n[{bien}/{n}] «{objetivo}» <- {texto}")
    for v in vistos:
        print("     ", v)
    sys.stdout.flush()
print("FIN")
