# -*- coding: utf-8 -*-
"""preparar_video.py — el paso fijo de toda hoja de proceso que sale de un VIDEO.

Por que existe (30/09/2026). En la sesion del IP Pad (IMG_0999.MOV) se reescribieron a mano
herramientas que ya estaban: transcribir con Whisper, elegir el cuadro mas nitido, armar la
plancha de contacto. Ese arranque se repite en cada hoja, asi que va en UN comando que deja
todo listo mientras uno ya esta leyendo:

    py -3 .claude/skills/hojas-de-proceso/scripts/preparar_video.py <video> [--salida <carpeta>]

Que hace (en este orden, y lo medido queda en `tiempos_s` del JSON):
  1. Saca el audio a WAV 16 kHz mono y lanza la TRANSCRIPCION EN SEGUNDO PLANO (proceso
     aparte, con el venv `.venv-audio`, consola invisible): large-v3-turbo int8, beam 1, sin
     word_timestamps, la mitad de los hilos de la PC, una pasada por idioma (`--idiomas es`
     por defecto; `es,zh` si hay tecnicos chinos hablando), `condition_on_previous_text=False`
     y las alucinaciones marcadas `(ALUCINA)` / `(?)` con la MISMA lista que `_infoDeVideos.py`.
     Con beam 1 una palabra de la casa se oye mal ("grampas" -> "gran paz"): `--vocab "grampas,
     engrampado"` se la pasa a Whisper como `hotwords`.
  2. Saca CUADROS CANDIDATOS: un cuadro por tramo de N segundos (~40 por video) y en cada tramo
     el MAS NITIDO (foco = `fotodevideo.foco`), a 960 px el lado largo. Decodifica solo los
     keyframes (~4 veces mas rapido; `--denso` decodifica todo). Marca con `igual_a` los que
     repiten el anterior.
  3. Arma las HOJAS DE CONTACTO numeradas (`contacto_01.jpg`, ...): miniatura + numero + segundo.
  4. Escribe `preparado.json`: rutas, duracion, rotacion, cuadros, hojas, tiempos y estado de la
     transcripcion.

La foto FINAL de la hoja no sale de aca: sale del video a resolucion completa con
`fotodevideo.py sacar --seg <el de la hoja de contacto> --radio 0.5 [--crop ...]`.

Seguimiento de la transcripcion (no bloquea):
    py -3 .../preparar_video.py --estado <carpeta>            # una linea; exit 0 listo, 2 corriendo, 1 fallo
    py -3 .../preparar_video.py --estado <carpeta> --esperar  # espera a que termine
    py -3 .../preparar_video.py --retranscribir <carpeta> [--idiomas es,zh] [--vocab "..."]   # solo el audio

Reusa, no copia: `fotodevideo` (foco, girar, dhash), `nube` (video solo en OneDrive) y
`scripts/video/_infoDeVideos.py` (CABECERA, _alucina con su lista de spam). No toca ninguno.
Las funciones de elegir_frame.py no se importan: ese script corre `main()` al importarlo y su
`foco` es la misma cuenta que la de fotodevideo.

Por que el worker no va DETACHED_PROCESS: murio dos veces con `forrtl: error (200): program
aborting due to window-CLOSE event` (runtime de Intel de CTranslate2). Va con CREATE_NO_WINDOW y
FOR_DISABLE_CONSOLE_CTRL_HANDLER=1.

Limite conocido: la rotacion del metadato puede estar mal y cambiar a mitad del video (IMG_0393,
IMG_0585). Ningun codigo lo caza: se MIRA la hoja de contacto, y si un cuadro sale acostado se
corrige con `--rot` (aca y en `fotodevideo.py sacar`).
"""
from __future__ import annotations

import argparse
import glob
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import traceback
from datetime import datetime

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, "..", "..", "..", ".."))
MODELO = "mobiuslabsgmbh/faster-whisper-large-v3-turbo"   # el nombre corto no resuelve a este repo
VERSION = 1

# Windows: el worker tiene que sobrevivir al comando que lo lanzo. DETACHED_PROCESS NO sirve: el
# worker murio dos veces con `forrtl: error (200): program aborting due to window-CLOSE event`
# (el runtime de Intel que trae CTranslate2 escucha el cierre de la consola de quien lo lanzo).
# Va con su propia consola invisible (CREATE_NO_WINDOW) + el handler apagado.
CREATE_NO_WINDOW = 0x08000000
NEW_PROCESS_GROUP = 0x00000200
BREAKAWAY = 0x01000000


# ============================================================================ utilidades
def _ahora() -> str:
    return datetime.now().isoformat(timespec="seconds")


def _mmss(seg: float) -> str:
    s = int(seg)
    return f"{s // 60:02d}:{s % 60:02d}"


def _escribir_json(ruta: str, obj: dict) -> None:
    """Escritura atomica: quien lee (--estado) nunca ve medio archivo."""
    tmp = ruta + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)
    for i in range(10):
        try:
            os.replace(tmp, ruta)
            return
        except PermissionError:         # Windows: otro proceso lo esta leyendo justo ahora
            time.sleep(0.1 * (i + 1))
    shutil.copyfile(tmp, ruta)


def _leer_json(ruta: str) -> dict | None:
    try:
        with open(ruta, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def _vivo(pid: int) -> bool:
    """Sin os.kill: en Windows, os.kill(pid, 0) no es 'preguntar', es mandar una senal."""
    if not pid:
        return False
    if os.name != "nt":
        try:
            os.kill(pid, 0)
            return True
        except OSError:
            return False
    import ctypes
    k = ctypes.windll.kernel32
    h = k.OpenProcess(0x1000, False, pid)           # PROCESS_QUERY_LIMITED_INFORMATION
    if not h:
        return False
    try:
        code = ctypes.c_ulong()
        k.GetExitCodeProcess(h, ctypes.byref(code))
        return code.value == 259                    # STILL_ACTIVE
    finally:
        k.CloseHandle(h)


def resolver_ffmpeg() -> tuple[str, str]:
    """ffmpeg/ffprobe: del PATH, o de WinGet (que no lo agrega). Deja el PATH listo para
    que `fotodevideo` (que llama a "ffmpeg" pelado) tambien lo encuentre."""
    ff, fp = shutil.which("ffmpeg"), shutil.which("ffprobe")
    if not (ff and fp):
        base = os.path.join(os.environ.get("LOCALAPPDATA", ""), "Microsoft", "WinGet", "Packages")
        for p in glob.glob(os.path.join(base, "Gyan.FFmpeg*", "*", "bin", "ffmpeg.exe")):
            ff, fp = p, os.path.join(os.path.dirname(p), "ffprobe.exe")
            os.environ["PATH"] = os.path.dirname(p) + os.pathsep + os.environ.get("PATH", "")
            break
    if not (ff and fp and os.path.exists(fp)):
        raise SystemExit("No encuentro ffmpeg/ffprobe (ni en el PATH ni en WinGet).")
    return ff, fp


def venv_audio() -> str | None:
    """python.exe del .venv-audio (faster-whisper). Puede no estar en un worktree: se busca."""
    cand = [os.environ.get("BARACK_VENV_AUDIO", ""),
            os.path.join(RAIZ, ".venv-audio"),
            r"C:\Dev\BarackMercosul\.venv-audio"]
    for c in cand:
        p = os.path.join(c, "Scripts", "python.exe")
        if c and os.path.exists(p):
            return p
    return None


def carpeta_por_defecto(video: str, tag: str) -> str:
    """tmp/ esta en .gitignore y fuera de OneDrive: son archivos de trabajo, no entregables."""
    return os.path.join(RAIZ, "tmp", "preparar_video", tag)


# ============================================================================ sonda
def sondear(video: str, ffprobe: str) -> dict:
    out = subprocess.run(
        [ffprobe, "-v", "error", "-show_entries",
         "format=duration,size:stream=index,codec_type,width,height:stream_side_data=rotation"
         ":stream_tags=rotate", "-of", "json", video],
        capture_output=True, text=True)
    try:
        j = json.loads(out.stdout or "{}")
    except ValueError:
        j = {}
    v = next((s for s in j.get("streams", []) if s.get("codec_type") == "video"), None)
    if not v:
        raise SystemExit(f"{video}: ffprobe no ve ningun stream de video (archivo roto o a medias).")
    rot = 0
    for sd in v.get("side_data_list", []):
        if "rotation" in sd:
            rot = int(round(float(sd["rotation"])))
    if not rot and v.get("tags", {}).get("rotate"):
        rot = int(v["tags"]["rotate"])
    w, h = int(v.get("width", 0)), int(v.get("height", 0))
    if abs(rot) % 180 == 90:                # ffmpeg aplica la rotacion: los cuadros salen asi
        w, h = h, w
    return {
        "duracion_s": round(float(j.get("format", {}).get("duration") or 0), 2),
        "ancho": w, "alto": h, "rotacion_declarada": rot,
        "orientacion_cuadros": "vertical" if h > w else "horizontal",
        "tiene_audio": any(s.get("codec_type") == "audio" for s in j.get("streams", [])),
    }


# ============================================================================ audio + worker
def sacar_audio(video: str, wav: str, ffmpeg: str) -> bool:
    subprocess.run([ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-i", video,
                    "-map", "0:a:0", "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", wav],
                   check=False)
    return os.path.exists(wav) and os.path.getsize(wav) > 44


def lanzar_transcripcion(wav: str, salida: str, idiomas: list[str], video: str, hilos: int,
                         vocab: str = "") -> dict:
    """Proceso aparte, desacoplado. Devuelve el bloque `transcripcion` del JSON."""
    wav, salida = os.path.abspath(wav), os.path.abspath(salida)     # el worker corre con cwd=salida
    est = os.path.join(salida, "transcripcion.estado.json")
    bloque = {"estado": "sin_lanzar", "archivo": os.path.join(salida, "transcripcion.txt"),
              "parcial": os.path.join(salida, "transcripcion.parcial.txt"),
              "estado_json": est, "log": os.path.join(salida, "transcripcion.log"),
              "idiomas": idiomas, "modelo": MODELO}
    py = venv_audio()
    if not py:
        bloque["estado"] = "sin_venv"
        bloque["aviso"] = ("No hay .venv-audio (faster-whisper). Memoria reference_extraer_video_audio_local; "
                           "o BARACK_VENV_AUDIO=<carpeta del venv>.")
        return bloque
    for p in (est, bloque["archivo"], bloque["parcial"]):   # que un estado viejo no pase por el nuevo
        if os.path.exists(p):
            os.replace(p, p + ".anterior")
    cmd = [py, os.path.abspath(__file__), "--worker", wav, salida, ",".join(idiomas),
           os.path.basename(video), str(hilos), vocab]
    log = open(bloque["log"], "w", encoding="utf-8")
    # prioridad NORMAL a proposito: a prioridad baja, con la PC saturada (LoadPercentage 100) el
    # worker tardo 4 minutos en arrancar. Lo que se cuida son los HILOS (la mitad de la PC).
    flags = CREATE_NO_WINDOW | NEW_PROCESS_GROUP
    env = dict(os.environ, FOR_DISABLE_CONSOLE_CTRL_HANDLER="1", HF_HUB_DISABLE_SYMLINKS="1",
               HF_HUB_DISABLE_XET="1")
    kw = dict(stdin=subprocess.DEVNULL, stdout=log, stderr=log, close_fds=True, cwd=salida, env=env)
    try:
        proc = subprocess.Popen(cmd, creationflags=flags | BREAKAWAY, **kw)
    except OSError:                          # el Job de quien nos llama no deja escapar
        proc = subprocess.Popen(cmd, creationflags=flags, **kw)
    bloque.update(estado="lanzado", pid=proc.pid, lanzado=_ahora(), hilos=hilos, vocab=vocab)
    return bloque


def _worker(argv: list[str]) -> int:
    """Corre en el venv de audio. Solo libreria estandar + faster_whisper (ahi no hay Pillow)."""
    wav, salida, idiomas_s, nombre, hilos = argv[0], argv[1], argv[2], argv[3], int(argv[4])
    vocab = argv[5] if len(argv) > 5 else ""
    idiomas = [i for i in idiomas_s.split(",") if i]
    os.environ["HF_HUB_DISABLE_SYMLINKS"] = "1"      # sin esto: WinError 1314 (no somos admin)
    os.environ["HF_HUB_DISABLE_XET"] = "1"
    est_path = os.path.join(salida, "transcripcion.estado.json")
    audio_s = max(0.0, (os.path.getsize(wav) - 44) / 32000.0)
    est = {"estado": "cargando_modelo", "pid": os.getpid(), "inicio": _ahora(), "audio_s": round(audio_s, 1),
           "idiomas": idiomas, "modelo": MODELO, "procesado_s": 0.0, "segmentos": 0,
           "config": {"beam_size": 1, "word_timestamps": False, "vad_filter": True,
                      "condition_on_previous_text": False, "compute_type": "int8", "cpu_threads": hilos}}

    def guardar(**kw):
        est.update(kw)
        _escribir_json(est_path, est)

    guardar()
    t_ini = time.perf_counter()
    try:
        sys.path.insert(0, os.path.join(RAIZ, "scripts", "video"))
        try:
            from _infoDeVideos import CABECERA, _alucina   # la lista de spam vive en UN lugar
        except ImportError as e:
            raise RuntimeError("no encuentro scripts/video/_infoDeVideos.py (lista de alucinaciones): "
                               "sin ella una transcripcion inventada pasaria por buena") from e
        from faster_whisper import WhisperModel

        modelo = WhisperModel(MODELO, device="cpu", compute_type="int8", cpu_threads=hilos,
                              local_files_only=True)
        t_modelo = time.perf_counter() - t_ini
        guardar(estado="transcribiendo", modelo_cargado_s=round(t_modelo, 1))

        crudo, detectado = [], []
        parcial = open(os.path.join(salida, "transcripcion.parcial.txt"), "w", encoding="utf-8")
        t_tr = time.perf_counter()
        for idi in idiomas:
            marca = idi.upper()
            # el chino se TRANSCRIBE: large-v3-turbo no traduce (memoria reference_extraer_video_audio_local)
            segs, info = modelo.transcribe(wav, language=idi, task="transcribe", vad_filter=True,
                                           beam_size=1, word_timestamps=False,
                                           condition_on_previous_text=False,
                                           hotwords=vocab or None)
            detectado.append(f"{marca}(detectaria {getattr(info, 'language', '?')} "
                             f"{getattr(info, 'language_probability', 0):.2f})")
            for s in segs:
                txt = s.text.strip()
                if not txt:
                    continue
                crudo.append((s.start, s.end, marca, txt, s.avg_logprob))
                parcial.write(f"[{_mmss(s.start)}] [{marca}] {txt}\n")
                parcial.flush()
                guardar(procesado_s=round(s.end, 1), segmentos=len(crudo), pasada=marca)
        t_tr = time.perf_counter() - t_tr
        parcial.close()

        # fusion tramo a tramo por confianza (igual que _infoDeVideos.audio): con una sola
        # pasada no cambia nada; con dos, evita decir todo dos veces
        crudo.sort(key=lambda c: (c[0], -c[4]))
        elegidos, fin_tomado = [], -1.0
        for ini, fin, marca, txt, lp in crudo:
            if ini < fin_tomado - 0.35:
                continue
            elegidos.append((ini, marca, txt, lp))
            fin_tomado = max(fin_tomado, fin)
        lineas = [f"# {nombre}", f"# pasadas: {' · '.join(detectado)}", CABECERA,
                  "# Config rapida: beam 1, sin word_timestamps. Un nombre propio dudoso se vuelve a "
                  "oir (segunda pasada con word_timestamps y clip_timestamps).", ""]
        previas: list[str] = []
        for ini, marca, txt, lp in elegidos:
            flag = " (ALUCINA)" if _alucina(txt, previas) else (" (?)" if lp < -0.9 else "")
            lineas.append(f"[{_mmss(ini)}] [{marca}] {txt}{flag}")
            previas.append(txt)
        if not elegidos:
            lineas.append("# (sin habla detectada por el VAD: el audio es ruido de maquina o esta mudo)")
        with open(os.path.join(salida, "transcripcion.txt"), "w", encoding="utf-8") as f:
            f.write("\n".join(lineas) + "\n")
        total = time.perf_counter() - t_ini
        guardar(estado="listo", fin=_ahora(), segmentos=len(elegidos), procesado_s=round(audio_s, 1),
                alucina=sum(1 for l in lineas if "(ALUCINA)" in l),
                dudosos=sum(1 for l in lineas if l.endswith("(?)")),
                tiempos_s={"modelo": round(t_modelo, 1), "transcribir": round(t_tr, 1),
                           "total": round(total, 1),
                           "transcribir_por_seg_de_audio": round(t_tr / audio_s, 2) if audio_s else None})
        return 0
    except BaseException as e:      # una pasada caida no puede dejar un archivo mudo: no se escribe nada
        guardar(estado="fallo", fin=_ahora(), error=f"{type(e).__name__}: {e}",
                traza=traceback.format_exc()[-1500:])
        return 1


# ============================================================================ cuadros candidatos
def elegir_tramo(dur: float, cada: float) -> float:
    """~40 candidatos por video, entre 2 y 10 s por tramo."""
    if cada > 0:
        return cada
    return min(10.0, max(2.0, round(dur / 40.0, 1)))


def extraer_muestras(video: str, ffmpeg: str, tmp: str, hilos: int, lado: int, muestreo: float,
                     tramos: int, denso: bool) -> tuple[list[str], list[float], str]:
    """(archivos, segundo de cada uno, modo). Por defecto decodifica SOLO los keyframes
    (`-skip_frame nokey`): en IMG_0999 (HEVC 1080p, ~1 keyframe por segundo) medido con la PC
    saturada fue unas 4 veces mas rapido que decodificar todo (9,9 s contra 43,6 s por 20 s de
    video), y la foto final se elige igual despues, a resolucion completa, con
    `fotodevideo sacar --radio`. Si el video tiene pocos keyframes (WhatsApp, grabacion de
    pantalla) cae al decode completo."""
    escala = f"scale='if(gt(iw,ih),{lado},-2)':'if(gt(iw,ih),-2,{lado})'"
    patron = os.path.join(tmp, "m_%05d.jpg")
    if not denso:
        r = subprocess.run([ffmpeg, "-hide_banner", "-loglevel", "info", "-skip_frame", "nokey",
                            "-threads", str(hilos), "-i", video, "-vf", escala + ",showinfo",
                            "-fps_mode", "passthrough", "-q:v", "4", patron],
                           capture_output=True, text=True)
        tiempos = [float(x) for x in re.findall(r"pts_time:\s*(-?[0-9.]+)", r.stderr)]
        archivos = sorted(glob.glob(os.path.join(tmp, "m_*.jpg")))
        if archivos and len(archivos) == len(tiempos) and len(archivos) >= 1.5 * tramos:
            return archivos, tiempos, "keyframes"
        for f in archivos:         # pocos keyframes o tiempos ilegibles: decode completo
            os.remove(f)           # (archivos de este mismo comando, en su carpeta temporal)
    subprocess.run([ffmpeg, "-hide_banner", "-loglevel", "error", "-threads", str(hilos), "-i", video,
                    "-vf", f"fps={muestreo},{escala}", "-q:v", "4", patron], check=False)
    archivos = sorted(glob.glob(os.path.join(tmp, "m_*.jpg")))
    return archivos, [k / muestreo for k in range(len(archivos))], "completo"


def sacar_candidatos(video: str, ffmpeg: str, salida: str, dur: float, cada: float,
                     muestreo: float, rot: int, hilos: int, denso: bool = False,
                     lado: int = 960) -> dict:
    """Un cuadro por tramo: el mas nitido de las muestras del tramo."""
    from concurrent.futures import ThreadPoolExecutor

    from PIL import Image
    from fotodevideo import dhash, foco, girar

    t = {}
    cuadros_dir = os.path.join(salida, "cuadros")
    os.makedirs(cuadros_dir, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="prepvid_") as tmp:
        t0 = time.perf_counter()
        muestras, segs, modo = extraer_muestras(video, ffmpeg, tmp, hilos, lado, muestreo,
                                                max(1, int(dur // cada) + 1), denso)
        t["extraer_muestras_s"] = round(time.perf_counter() - t0, 1)
        if not muestras:
            raise SystemExit("ffmpeg no saco ningun cuadro (video a medias o solo en la nube).")

        t0 = time.perf_counter()

        def medir(p: str) -> float:
            with Image.open(p) as im:
                return foco(im)

        with ThreadPoolExecutor(max_workers=max(2, hilos)) as ex:
            focos = list(ex.map(medir, muestras))
        t["medir_foco_s"] = round(time.perf_counter() - t0, 1)

        t0 = time.perf_counter()
        mejor: dict[int, tuple[float, int]] = {}
        for k, fc in enumerate(focos):
            seg = segs[k]
            tr = int(seg // cada)
            if tr not in mejor or fc > mejor[tr][0]:
                mejor[tr] = (fc, k)
        cands, previo = [], None
        for n, tr in enumerate(sorted(mejor), 1):
            fc, k = mejor[tr]
            seg = segs[k]
            im = girar(Image.open(muestras[k]).convert("RGB"), rot)
            h = dhash(im)
            igual = None
            if previo is not None and int((h != previo[1]).sum()) <= 12:
                igual = previo[0]
            else:
                previo = (n, h)
            nombre = f"c_{n:02d}_{seg:06.1f}s.jpg"
            im.save(os.path.join(cuadros_dir, nombre), quality=88)
            cands.append({"id": n, "seg": round(seg, 2), "foco": round(fc, 1), "igual_a": igual,
                          "archivo": os.path.join("cuadros", nombre)})
        t["guardar_candidatos_s"] = round(time.perf_counter() - t0, 1)
    return {"cada_s": cada, "modo_muestreo": modo, "muestreo_fps": muestreo if modo == "completo" else None,
            "lado_largo_px": lado, "muestras": len(muestras),
            "rot_aplicada": rot, "carpeta": "cuadros", "candidatos": cands, "tiempos_s": t}


# ============================================================================ hojas de contacto
def _fuente(px: int):
    from PIL import ImageFont
    for n in ("arialbd.ttf", "calibrib.ttf", "segoeuib.ttf"):
        p = os.path.join(os.environ.get("WINDIR", r"C:\Windows"), "Fonts", n)
        if os.path.exists(p):
            return ImageFont.truetype(p, px)
    return ImageFont.load_default()


def hacer_contactos(salida: str, cands: list[dict], nombre: str, vertical: bool) -> list[str]:
    """Hojas de ~1500 px de ancho (no se achican al mirarlas): 5x4 si es horizontal, 6x2 si es
    vertical. Cada celda: miniatura y debajo `#id mm:ss` + segundo exacto + foco."""
    from PIL import Image, ImageDraw
    cols, filas = (6, 2) if vertical else (5, 4)
    cw = 1500 // cols
    f_id, f_sm = _fuente(24), _fuente(16)
    primero = Image.open(os.path.join(salida, cands[0]["archivo"]))
    ch = int(cw * primero.height / primero.width)
    barra, cab = 50, 34
    por_hoja = cols * filas
    hojas = []
    for h0 in range(0, len(cands), por_hoja):
        grupo = cands[h0:h0 + por_hoja]
        nf = (len(grupo) + cols - 1) // cols
        hoja = Image.new("RGB", (cols * cw, cab + nf * (ch + barra)), (22, 22, 26))
        d = ImageDraw.Draw(hoja)
        nh = h0 // por_hoja + 1
        total = (len(cands) + por_hoja - 1) // por_hoja
        d.text((8, 6), f"{nombre}   hoja {nh} de {total}   cuadros #{grupo[0]['id']:02d} a "
                       f"#{grupo[-1]['id']:02d}   ({_mmss(grupo[0]['seg'])} a {_mmss(grupo[-1]['seg'])})",
               fill=(240, 240, 120), font=f_sm)
        for i, c in enumerate(grupo):
            x, y = (i % cols) * cw, cab + (i // cols) * (ch + barra)
            im = Image.open(os.path.join(salida, c["archivo"])).convert("RGB")
            im.thumbnail((cw - 6, ch - 4))
            hoja.paste(im, (x + (cw - im.width) // 2, y + (ch - im.height) // 2))
            d.text((x + 6, y + ch + 2), f"#{c['id']:02d}  {_mmss(c['seg'])}", fill=(255, 235, 60), font=f_id)
            extra = f"{c['seg']:.1f} s  foco {c['foco']:.0f}"
            d.text((x + 6, y + ch + 30), extra, fill=(150, 200, 255), font=f_sm)
            if c["igual_a"]:
                d.text((x + cw - 62, y + ch + 4), f"={'#%02d' % c['igual_a']}", fill=(255, 150, 60), font=f_id)
            d.rectangle([x, y, x + cw - 1, y + ch + barra - 1], outline=(50, 50, 58))
        ruta = os.path.join(salida, f"contacto_{nh:02d}.jpg")
        hoja.save(ruta, quality=88)
        hojas.append(os.path.basename(ruta))
    return hojas


# ============================================================================ estado
def leer_estado(carpeta: str) -> tuple[str, dict]:
    """(texto de una linea, bloque). Detecta un worker muerto que quedo en `transcribiendo`."""
    est = _leer_json(os.path.join(carpeta, "transcripcion.estado.json"))
    prep = _leer_json(os.path.join(carpeta, "preparado.json")) or {}
    if not est:
        bl = prep.get("transcripcion", {})
        if bl.get("estado") == "lanzado" and not _vivo(bl.get("pid", 0)):   # murio antes de escribir nada
            try:
                with open(os.path.join(carpeta, "transcripcion.log"), encoding="utf-8", errors="replace") as f:
                    cola = " | ".join(l.strip() for l in f.read().strip().splitlines()[-2:])
            except OSError:
                cola = "sin log"
            bl = dict(bl, estado="fallo", error=f"el worker no llego a arrancar: {cola}")
            return (f"transcripcion: FALLO  {bl['error']}  ->  repetir: --retranscribir \"{carpeta}\""), bl
        return f"transcripcion: {bl.get('estado', 'sin datos')} {bl.get('aviso', '')}".strip(), bl
    if est["estado"] in ("cargando_modelo", "transcribiendo") and not _vivo(est.get("pid", 0)):
        est["estado"] = "fallo"
        est["error"] = "el proceso murio sin terminar (ver transcripcion.log)"
    e = est["estado"]
    if e == "listo":
        tt = est.get("tiempos_s", {})
        txt = (f"transcripcion: LISTO  {est['segmentos']} segmentos, {est.get('alucina', 0)} ALUCINA, "
               f"{est.get('dudosos', 0)} dudosos, {tt.get('total', '?')} s "
               f"({tt.get('transcribir_por_seg_de_audio', '?')} s por seg de audio)  ->  "
               f"{os.path.join(carpeta, 'transcripcion.txt')}")
    elif e == "fallo":
        txt = (f"transcripcion: FALLO  {est.get('error', '?')}  (log: {os.path.join(carpeta, 'transcripcion.log')})"
               f"  ->  repetir solo la transcripcion: --retranscribir \"{carpeta}\"")
    else:
        a = est.get("audio_s") or 1
        txt = (f"transcripcion: {e}  {est.get('procesado_s', 0):.0f}/{a:.0f} s de audio "
               f"({100 * est.get('procesado_s', 0) / a:.0f} %)  lo que lleva: "
               f"{os.path.join(carpeta, 'transcripcion.parcial.txt')}")
    return txt, est


def accion_estado(carpeta: str, esperar: bool, limite: int = 3600) -> int:
    carpeta = os.path.abspath(carpeta)
    t0 = time.time()
    while True:
        txt, est = leer_estado(carpeta)
        if est.get("estado") in ("listo", "fallo", "sin_venv", "sin_audio") or not esperar \
                or time.time() - t0 > limite:
            break
        time.sleep(5)
    print(txt)
    prep_path = os.path.join(carpeta, "preparado.json")
    prep = _leer_json(prep_path)
    if prep and est:                                    # el JSON queda al dia con el estado real
        prep["transcripcion"].update({k: est[k] for k in est if k in
                                      ("estado", "segmentos", "alucina", "dudosos", "tiempos_s", "error")})
        _escribir_json(prep_path, prep)
    return {"listo": 0, "fallo": 1}.get(est.get("estado"), 2)


def accion_retranscribir(carpeta: str, idiomas: list[str], vocab: str, hilos: int) -> int:
    """Relanza SOLO la transcripcion con el audio.wav que ya esta (un worker muerto, otro idioma, un --vocab)."""
    carpeta = os.path.abspath(carpeta)
    prep_path = os.path.join(carpeta, "preparado.json")
    prep, wav = _leer_json(prep_path), os.path.join(carpeta, "audio.wav")
    if not prep or not os.path.exists(wav):
        raise SystemExit(f"{carpeta}: falta preparado.json o audio.wav (correr preparar_video.py sobre el video).")
    est = _leer_json(os.path.join(carpeta, "transcripcion.estado.json")) or {}
    if est.get("estado") in ("cargando_modelo", "transcribiendo") and _vivo(est.get("pid", 0)):
        raise SystemExit(f"Ya hay una transcripcion corriendo (pid {est['pid']}): --estado \"{carpeta}\" --esperar")
    prep["transcripcion"] = lanzar_transcripcion(wav, carpeta, idiomas, prep["video"], hilos, vocab)
    _escribir_json(prep_path, prep)
    print(f"transcripcion relanzada (pid {prep['transcripcion'].get('pid')}): --estado \"{carpeta}\" --esperar")
    return 0


# ============================================================================ principal
def main() -> int:
    if len(sys.argv) > 1 and sys.argv[1] == "--worker":
        return _worker(sys.argv[2:])

    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("video", nargs="?")
    ap.add_argument("--salida", help="carpeta de trabajo (por defecto <repo>/tmp/preparar_video/<IMG_xxxx>, "
                                     "fuera de OneDrive y de git)")
    ap.add_argument("--cada", type=float, default=0, help="segundos por tramo (0 = automatico, ~40 cuadros)")
    ap.add_argument("--denso", action="store_true",
                    help="decodificar todo el video (por defecto solo keyframes: ~4 veces mas rapido)")
    ap.add_argument("--muestreo", type=float, default=2.0,
                    help="con --denso (o si hay pocos keyframes): muestras por segundo")
    ap.add_argument("--idiomas", default="es", help="es | es,zh (tecnico chino hablando en el video)")
    ap.add_argument("--vocab", default="", help="palabras propias de la pieza/maquina que Whisper no conoce, "
                                                 "separadas por coma (ej 'grampas, engrampado'); beam 1 las oye mal sin esto")
    ap.add_argument("--hilos", type=int, default=0, help="hilos de Whisper y de ffmpeg (0 = la mitad de la PC)")
    ap.add_argument("--rot", type=int, default=0, help="rotacion a aplicar a los candidatos (horaria, 90/180/270)")
    ap.add_argument("--sin-audio", action="store_true", help="no transcribir")
    ap.add_argument("--no-bajar", action="store_true", help="si el video esta solo en la nube, cortar (no pedirlo a OneDrive)")
    ap.add_argument("--rehacer", action="store_true", help="repetir aunque este preparado")
    ap.add_argument("--estado", metavar="CARPETA", help="como va la transcripcion de una corrida")
    ap.add_argument("--esperar", action="store_true", help="con --estado: esperar a que termine")
    ap.add_argument("--retranscribir", metavar="CARPETA",
                    help="relanzar solo la transcripcion de una corrida (worker muerto, otro --idiomas o --vocab)")
    a = ap.parse_args()

    if a.estado:
        return accion_estado(a.estado, a.esperar)
    if a.retranscribir:
        return accion_retranscribir(a.retranscribir, [i.strip() for i in a.idiomas.split(",") if i.strip()],
                                    a.vocab, a.hilos or max(2, (os.cpu_count() or 4) // 2))
    if not a.video:
        ap.error("falta el video (o --estado <carpeta>)")
    video = os.path.abspath(a.video)
    if not os.path.isfile(video):
        raise SystemExit(f"No existe el video: {video}")

    T: dict[str, float] = {}
    t_total = time.perf_counter()
    ffmpeg, ffprobe = resolver_ffmpeg()
    sys.path.insert(0, AQUI)
    from nube import asegurar_local, en_la_nube
    hilos = a.hilos or max(2, (os.cpu_count() or 4) // 2)

    if en_la_nube(video):
        if a.no_bajar:
            raise SystemExit("El video esta solo en la nube y pediste --no-bajar. No se toco.")
        t0 = time.perf_counter()
        if not asegurar_local(video):
            raise SystemExit("El video no bajo de la nube.")
        T["bajar_de_la_nube_s"] = round(time.perf_counter() - t0, 1)

    from fotodevideo import _tag
    tag = _tag(video)
    salida = os.path.abspath(a.salida or carpeta_por_defecto(video, tag))
    os.makedirs(salida, exist_ok=True)
    prep_path = os.path.join(salida, "preparado.json")

    st = os.stat(video)
    previo = _leer_json(prep_path)
    if previo and not a.rehacer and previo.get("video_bytes") == st.st_size \
            and previo.get("video") == video:
        print(f"Ya preparado: {prep_path}  (--rehacer para repetir)")
        return accion_estado(salida, False)

    t0 = time.perf_counter()
    sonda = sondear(video, ffprobe)
    T["sonda_s"] = round(time.perf_counter() - t0, 1)
    print(f"preparar_video: {os.path.basename(video)}  {sonda['duracion_s']:.1f} s  "
          f"{sonda['ancho']}x{sonda['alto']} ({sonda['orientacion_cuadros']}, rotacion declarada "
          f"{sonda['rotacion_declarada']})", flush=True)

    # (a) audio y transcripcion en segundo plano
    idiomas = [i.strip() for i in a.idiomas.split(",") if i.strip()]
    wav = os.path.join(salida, "audio.wav")
    est_prev = _leer_json(os.path.join(salida, "transcripcion.estado.json")) if previo else None
    if a.sin_audio:
        trans = {"estado": "omitida", "aviso": "--sin-audio"}
    elif est_prev and previo.get("video") == video and previo.get("video_bytes") == st.st_size \
            and os.path.exists(wav) and (est_prev.get("estado") == "listo" or (
                est_prev.get("estado") in ("cargando_modelo", "transcribiendo") and _vivo(est_prev.get("pid", 0)))):
        # --rehacer (p. ej. con otro --rot) no repite ni pisa una transcripcion buena o en marcha
        trans = dict(previo.get("transcripcion", {}))
        trans["estado"] = est_prev["estado"]
        print("  transcripcion: se conserva la anterior (para repetirla: --retranscribir)", flush=True)
    elif not sonda["tiene_audio"]:
        trans = {"estado": "sin_audio", "aviso": "el video no tiene pista de audio"}
    else:
        t0 = time.perf_counter()
        if not sacar_audio(video, wav, ffmpeg):
            trans = {"estado": "fallo", "aviso": "ffmpeg no pudo sacar el audio"}
        else:
            T["audio_a_wav_s"] = round(time.perf_counter() - t0, 1)
            t0 = time.perf_counter()
            trans = lanzar_transcripcion(wav, salida, idiomas, video, hilos, a.vocab)
            T["lanzar_transcripcion_s"] = round(time.perf_counter() - t0, 1)
    print(f"  transcripcion: {trans['estado']}"
          f"{' (en segundo plano, pid ' + str(trans['pid']) + ')' if 'pid' in trans else ''}"
          f"{'  ' + trans['aviso'] if trans.get('aviso') else ''}", flush=True)

    # (b) cuadros candidatos   (c) hojas de contacto
    cada = elegir_tramo(sonda["duracion_s"], a.cada)
    cuad = sacar_candidatos(video, ffmpeg, salida, sonda["duracion_s"], cada, a.muestreo, a.rot, hilos,
                            a.denso)
    T.update(cuad.pop("tiempos_s"))
    t0 = time.perf_counter()
    hojas = hacer_contactos(salida, cuad["candidatos"], f"IMG_{tag}" if tag.isdigit() else tag,
                            sonda["orientacion_cuadros"] == "vertical")
    T["hojas_de_contacto_s"] = round(time.perf_counter() - t0, 1)
    T["preparacion_total_s"] = round(time.perf_counter() - t_total, 1)

    # (d) preparado.json
    obj = {"version": VERSION, "creado": _ahora(), "video": video, "video_nombre": os.path.basename(video),
           "video_bytes": st.st_size, "tag": tag, "salida": salida, **sonda,
           "rot_corregida_para_fotodevideo": a.rot,
           "aviso_rotacion": ("La rotacion se MIRA en las hojas de contacto: si un cuadro sale acostado, "
                              "repetir con --rot y usar el mismo --rot en fotodevideo.py sacar."),
           "audio": {"wav": wav if os.path.exists(wav) else None},
           "transcripcion": trans, "cuadros": cuad,
           "hojas_de_contacto": hojas, "tiempos_s": T}
    _escribir_json(prep_path, obj)

    print(f"  cuadros: {len(cuad['candidatos'])} candidatos ({cuad['muestras']} muestras por {cuad['modo_muestreo']}, un tramo de "
          f"{cada:g} s cada uno, {sum(1 for c in cuad['candidatos'] if c['igual_a'])} repiten el anterior)")
    print(f"  hojas de contacto: {', '.join(hojas)}  en {salida}")
    print("  tiempos (s): " + "  ".join(f"{k[:-2]} {v}" for k, v in T.items()))
    print(f"  preparado.json: {prep_path}")
    print("  MIRA las hojas de contacto (rotacion y encuadre no los caza ningun codigo) y lee la "
          "transcripcion ENTERA antes de escribir un paso.")
    print(f"  seguimiento: py -3 {os.path.relpath(__file__, RAIZ) if __file__.startswith(RAIZ) else __file__} "
          f"--estado \"{salida}\" [--esperar]")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
