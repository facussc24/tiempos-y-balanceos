# -*- coding: utf-8 -*-
"""_transcribirChino.py — la pasada en CHINO de los videos de maquina, que faltaba.

Pedido de Fak, 22/09/2026: *"muchos de los videos vas a tener que transcribirlos en
chino y en español porque a veces hablan chino"*.

Por que existe aparte: el fusionador de `_infoDeVideos.py audio` pide el chino con
`task="translate"`, y el modelo que corre en esta PC (`large-v3-turbo`) no traduce: lo
entrenaron solo para transcribir. Resultado medido el 22/09: de 49 transcripciones
"bilingues", 6 tenian algun renglon chino y ninguno estaba traducido. El chino de los
tecnicos de KingPower seguia sin transcribir.

Aca va `language="zh", task="transcribe"`: salen los caracteres chinos tal cual. La
traduccion la hace quien los lee, citando el renglon. Es mas fiel que una traduccion
automatica de un audio de planta, y queda el original para verificarla.

Deja `transcripciones/IMG_xxxx.zh.txt` al lado de las otras. No pisa ninguna.

Cuidados con OneDrive (memoria reference_onedrive_files_on_demand_liberar_espacio):
  - un video solo en la nube se pide con nube.asegurar_local, no se abre a ciegas;
  - si estaba en la nube ANTES, al terminar se devuelve a la nube: 91 videos son 12 GB.

    .venv-audio/Scripts/python.exe scripts/video/_transcribirChino.py "<carpeta>" [--solo 0393,0582]
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..",
                                ".claude", "skills", "hojas-de-proceso", "scripts"))
from nube import PINNED, UNPINNED, _k32, asegurar_local, en_la_nube  # noqa: E402

# Whisper escupe estas frases cuando el audio es ruido: no las dijo nadie.
SPAM = ("订阅", "点赞", "打赏", "转发", "字幕", "请不吝", "明镜", "感谢观看", "谢谢观看",
        "subscribe", "Thanks for watching", "amara.org")
# Primero los del vinilo: son los que tienen preguntas abiertas en las hojas.
PRIMERO = ["0393", "0582", "0585", "0579", "0583", "0580", "0586", "0584", "0581"]


def alucina(t: str, previas: list[str]) -> bool:
    return any(s.lower() in t.lower() for s in SPAM) or (
        len(previas) >= 3 and all(p == t for p in previas[-3:]))


def tag_de(n: str) -> str:
    import re
    m = re.search(r"IMG_E?(\d+)", n, re.IGNORECASE)
    return m.group(1) if m else os.path.splitext(n)[0][:12]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("carpeta")
    ap.add_argument("--solo", help="lista de numeros IMG separados por coma")
    a = ap.parse_args()
    dst_dir = os.path.join(a.carpeta, ".claude", "transcripciones")
    vids = sorted(n for n in os.listdir(a.carpeta) if n.lower().endswith((".mov", ".mp4")))
    if a.solo:
        pedidos = [x.strip().lstrip("IMG_") for x in a.solo.split(",")]
        vids = [v for v in vids if tag_de(v) in pedidos]
    vids.sort(key=lambda v: (PRIMERO.index(tag_de(v)) if tag_de(v) in PRIMERO else 99, v))

    from faster_whisper import WhisperModel
    print("cargando modelo...", flush=True)
    m = WhisperModel("large-v3-turbo", device="cpu", compute_type="int8")
    wav = os.path.join(tempfile.gettempdir(), "_zh.wav")
    for v in vids:
        t = tag_de(v)
        dst = os.path.join(dst_dir, f"IMG_{t}.zh.txt" if t.isdigit() else f"{t}.zh.txt")
        if os.path.exists(dst):
            print(f"skip {t}", flush=True)
            continue
        p = os.path.join(a.carpeta, v)
        estaba_en_nube = en_la_nube(p)
        if not asegurar_local(p):
            print(f"{t}: NO bajo de la nube, se saltea", flush=True)
            continue
        try:
            subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", p,
                            "-ac", "1", "-ar", "16000", wav], check=True)
            segs, info = m.transcribe(wav, language="zh", task="transcribe",
                                      vad_filter=True, beam_size=1)
            lineas, prev, n_mal = [], [], 0
            for s in segs:
                txt = s.text.strip()
                if not txt:
                    continue
                flag = ""
                if alucina(txt, prev):
                    flag, n_mal = " (ALUCINA)", n_mal + 1
                elif s.avg_logprob < -0.9:
                    flag = " (?)"
                lineas.append(f"[{int(s.start // 60):02d}:{int(s.start % 60):02d}] {txt}{flag}")
                prev.append(txt)
            cab = [f"# {v}",
                   f"# pasada CHINO (language=zh, task=transcribe) · solo detectaria "
                   f"{info.language} {info.language_probability:.2f}",
                   "# Caracteres tal cual los dijo el tecnico. La traduccion la hace quien lo lee",
                   "# y la cita con el minuto. (?) = poco seguro. (ALUCINA) = spam o repeticion.",
                   "# Si el video es todo castellano, aca salen frases inventadas: se leen con eso.",
                   ""]
            open(dst, "w", encoding="utf-8").write("\n".join(cab + lineas))
            print(f"{t}: {len(lineas)} renglones, {n_mal} ALUCINA", flush=True)
        except Exception as e:  # uno que falla no frena la tanda, pero no escribe nada
            print(f"{t}: FALLO {type(e).__name__}: {e}", flush=True)
        finally:
            if estaba_en_nube:        # vuelve a como estaba: no se llena el disco
                k = _k32()
                attr = k.GetFileAttributesW(p)
                k.SetFileAttributesW(p, (attr | UNPINNED) & ~PINNED)
    try:
        os.remove(wav)
    except OSError:
        pass
    print("LISTO", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
