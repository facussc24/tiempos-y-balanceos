# -*- coding: utf-8 -*-
"""
_infoDeVideos.py — convierte una carpeta de videos de maquina en material LEIBLE
y lo deja archivado al lado de los videos, en la biblioteca de Ingenieria.

Por que existe: un video de 3 minutos filmando un HMI son ~700 cuadros y ~20 pantallas
distintas. Lo que sirve son esas 20. Y el audio de planta con los tecnicos chinos no
sirve como fuente de un numero, pero si sirve cuando narra Facundo.

El audio es BILINGUE: el tecnico de KingPower habla chino y el operario contesta en
castellano. Por eso `audio` hace una pasada por idioma y las fusiona por confianza; con
una sola pasada, lo que queda afuera Whisper no lo transcribe, lo inventa.

Deja, dentro de la carpeta de los videos:
  .claude/
      fotogramas de cada video/<xxxx>/       el mas nitido de cada pantalla distinta
      transcripciones/IMG_<xxxx>.bilingue.txt  audio con marca de tiempo, ES + ZH
      LEEME - que hay aca.txt

En la RAIZ de la carpeta de la maquina van solo los originales (videos y fotos). Lo chequea
`node scripts/_videoBiblioteca.mjs --auditar`.

NO BORRA NADA (la biblioteca esta bajo control documental y lleva "NUNCA BORRAR" en el
nombre): si una carpeta ya tiene cuadros, la saltea.

Uso:
  python scripts/video/_infoDeVideos.py cuadros  "<carpeta de videos>" [--desde 2026-09-09] [--tope 24]
  python scripts/video/_infoDeVideos.py audio    "<carpeta de videos>" [--desde 2026-09-09] [--solo 0813,0820] [--idiomas es,zh]
  python scripts/video/_infoDeVideos.py todo     "<carpeta de videos>" [--desde 2026-09-09]

--desde filtra por la fecha que llevan los nombres de la casa
(AAAA-MM-DD - que se ve (IMG_xxxx).MOV). El audio necesita el entorno .venv-audio
(faster-whisper); los cuadros solo ffmpeg + Pillow.
"""
from __future__ import annotations
import argparse, os, re, shutil, subprocess, sys


def tag_de(nombre: str) -> str:
    m = re.search(r"IMG_E?(\d+)", nombre, re.IGNORECASE)
    return m.group(1) if m else os.path.splitext(nombre)[0][:12]


def fecha_de(nombre: str) -> str:
    m = re.match(r"(\d{4}-\d{2}-\d{2})", nombre)
    return m.group(1) if m else ""


def no_procesar(carpeta: str) -> set[str]:
    """Claves que NO se abren, por mas que el nombre diga que son de la maquina.

    Se declaran en `.claude/NO PROCESAR.txt`, una por linea. Existe porque un barrido del
    telefono por fecha arrastra material que no es de la fabrica, y sacarle cuadros lo
    desparrama por una carpeta compartida del equipo. Que salga de la lista lo decide Fak.
    """
    fuera = set()
    for d in (".claude", "_INFO SACADA DE LOS VIDEOS"):
        try:
            with open(os.path.join(carpeta, d, "NO PROCESAR.txt"), encoding="utf-8") as f:
                for linea in f:
                    m = re.search(r"IMG_E?(\d+)", linea, re.IGNORECASE)
                    if m:
                        fuera.add(m.group(1))
        except OSError:
            pass
    return fuera


def videos_de(carpeta: str, desde: str | None) -> list[str]:
    vs = [f for f in os.listdir(carpeta) if f.lower().endswith((".mov", ".mp4", ".m4v"))]
    if desde:
        vs = [f for f in vs if fecha_de(f) >= desde]
    fuera = no_procesar(carpeta)
    if fuera:
        quedan = [f for f in vs if tag_de(f) not in fuera]
        if len(quedan) != len(vs):
            print(f"NO PROCESAR: salteo {len(vs) - len(quedan)} video(s) declarados", flush=True)
        vs = quedan
    return sorted(vs)


def carpeta_info(carpeta: str) -> str:
    """Todo lo que genero yo va a `.claude`, al lado de los originales.

    Hasta el 21/09/2026 esta carpeta se llamaba `_INFO SACADA DE LOS VIDEOS`. Fak pidio que
    la carpeta de la maquina tenga SOLO los originales y que lo demas quede junto y aparte;
    las tres carpetas de la linea Top Roll ya estan mudadas. Si aparece una carpeta vieja sin
    migrar se usa esa, para no dejar el material partido en dos lugares.
    """
    viejo = os.path.join(carpeta, "_INFO SACADA DE LOS VIDEOS")
    d = viejo if os.path.isdir(viejo) else os.path.join(carpeta, ".claude")
    os.makedirs(d, exist_ok=True)
    return d


# ------------------------------------------------------------------ cuadros
def cuadros(carpeta: str, desde: str | None, tope: int, trabajo: str,
            solo: set[str] | None = None) -> None:
    import numpy as np
    from PIL import Image

    def dhash(im, s=16):
        g = np.asarray(im.convert("L").resize((s + 1, s)), dtype=np.int16)
        return (g[:, 1:] > g[:, :-1]).flatten()

    def nitidez(p):
        g = np.asarray(Image.open(p).convert("L").resize((320, 240)), dtype=np.float32)
        lap = g[:-2, 1:-1] + g[2:, 1:-1] + g[1:-1, :-2] + g[1:-1, 2:] - 4 * g[1:-1, 1:-1]
        return float(lap.var())

    destino = os.path.join(carpeta_info(carpeta), "fotogramas de cada video")
    vs = videos_de(carpeta, desde)
    if solo:  # el orden de la lista es el orden de prioridad
        vs = [v for t in solo for v in vs if tag_de(v) == t]
    for v in vs:
        t = tag_de(v)
        dst = os.path.join(destino, t)
        if os.path.isdir(dst) and os.listdir(dst):
            print(f"skip {t} (ya tiene {len(os.listdir(dst))})", flush=True)
            continue
        crudo = os.path.join(trabajo, t)
        os.makedirs(crudo, exist_ok=True)
        if not os.listdir(crudo):
            subprocess.run(
                ["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", os.path.join(carpeta, v),
                 "-vf", "fps=1/2,scale=1600:-1", "-q:v", "3",
                 os.path.join(crudo, f"{t}_%04d.jpg")], check=False)
        fs = sorted(os.path.join(crudo, f) for f in os.listdir(crudo) if f.lower().endswith(".jpg"))
        if not fs:
            print(f"{t}: SIN CUADROS", flush=True)
            continue
        grupos, actual, href = [], [], None
        for p in fs:
            try:
                h = dhash(Image.open(p))
            except Exception:
                continue
            if href is None or int((h != href).sum()) > 28:
                if actual:
                    grupos.append(actual)
                actual, href = [p], h
            else:
                actual.append(p)
        if actual:
            grupos.append(actual)
        total = len(grupos)
        if total > tope:
            paso = total / tope
            grupos = [grupos[int(i * paso)] for i in range(tope)]
        os.makedirs(dst, exist_ok=True)
        for i, g in enumerate(grupos, 1):
            shutil.copy2(max(g, key=nitidez), os.path.join(dst, f"{t}_{i:02d}.jpg"))
        print(f"{t}: {len(grupos)} cuadros (escenas {total}, crudos {len(fs)})", flush=True)


# ------------------------------------------------------------------ audio
PASADAS = [("es", "transcribe", "ES"), ("zh", "translate", "ZH")]
CABECERA = (
    "# OJO: el audio de planta con los tecnicos NO es fuente de un numero. Los numeros\n"
    "# salen de la pantalla del HMI. Lo que si sirve es lo que narra Facundo.\n"
    "# [ES] lo dijo en castellano. [ZH] lo dijo en chino y esto es la traduccion directa\n"
    "# del audio. (?) = Whisper poco seguro. (ALUCINA) = se repite o es spam: NO es fuente."
)
# Whisper escupe siempre las mismas frases cuando el audio es ruido de maquina sin habla.
SPAM = ("订阅", "点赞", "打赏", "转发", "字幕", "subscribe", "Thanks for watching",
        "请不吝", "明镜", "amara.org", "Subtitles by",
        # forzado a castellano escupe el mismo spam traducido: el IMG_0393 dio dos
        # "¡Suscribete al canal!" sobre 297 s de ruido de maquina
        "suscríbete", "suscribete", "subtítulos", "subtitulos")


def _alucina(texto: str, previas: list[str]) -> bool:
    """Una frase repetida o el pedido de suscribirse a un canal no es lo que dijo nadie."""
    if any(s.lower() in texto.lower() for s in SPAM):
        return True
    return len(previas) >= 3 and all(p == texto for p in previas[-3:])


def audio(carpeta: str, desde: str | None, solo: set[str] | None, trabajo: str,
          idiomas: list[str] | None = None) -> None:
    """Transcribe cada video UNA vez por idioma y FUSIONA por confianza.

    Pedido de Fak, 22/09/2026: *"muchos de los videos vas a tener que transcribirlos en
    chino y en español porque a veces hablan chino"*.

    El tecnico de KingPower habla chino y el operario contesta en castellano, muchas veces
    en la misma frase. Whisper elige UN idioma para todo el archivo, y lo que queda afuera
    no lo transcribe: lo INVENTA. El IMG_0393 —justo el video del rollo— salio con
    "打一瓶子" ("abrir una botella") veinte veces seguidas y termino pidiendo que te
    suscribas a un canal de YouTube: 297 segundos de material y ni una frase util.

    Asi que va una pasada por idioma y despues se fusiona TRAMO A TRAMO, quedandose con la
    que Whisper dio mas segura (`avg_logprob`). Del chino se pide `task="translate"`, que
    saca el significado directo del audio en vez de traducir una transcripcion ya dudosa.
    """
    from faster_whisper import WhisperModel

    pedidos = [p for p in PASADAS if not idiomas or p[0] in idiomas]
    destino = os.path.join(carpeta_info(carpeta), "transcripciones")
    os.makedirs(destino, exist_ok=True)
    print("cargando modelo...", flush=True)
    modelo = WhisperModel("large-v3-turbo", device="cpu", compute_type="int8")
    for v in videos_de(carpeta, desde):
        t = tag_de(v)
        if solo and t not in solo:
            continue
        dst = os.path.join(destino, f"IMG_{t}.bilingue.txt")
        if os.path.exists(dst):
            print(f"skip {t}", flush=True)
            continue
        wav = os.path.join(trabajo, f"{t}.wav")
        subprocess.run(
            ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", os.path.join(carpeta, v),
             "-ac", "1", "-ar", "16000", wav], check=False)
        crudo, detectado, rotas = [], [], []
        for idi, tarea, marca in pedidos:
            try:
                segs, info = modelo.transcribe(wav, language=idi, task=tarea,
                                               vad_filter=True, beam_size=1)
                detectado.append(f"{marca}(solo detectaria {info.language} "
                                 f"{info.language_probability:.2f})")
                for s in segs:
                    txt = s.text.strip()
                    if txt:
                        crudo.append((s.start, s.end, marca, txt, s.avg_logprob))
            except Exception as e:
                # Sin esto, una pasada que se cae por memoria devuelve CERO segmentos y el
                # archivo queda escrito como si en ese idioma nadie hubiera hablado. Paso:
                # la pasada ZH del IMG_0393 dio 0 y era `mkl_malloc: failed to allocate`.
                rotas.append(f"{marca}: {type(e).__name__} {e}")
                print(f"  {t} {marca}: FALLO -> {type(e).__name__}: {e}", flush=True)
                continue
            print(f"  {t} {marca}: {sum(1 for c in crudo if c[2] == marca)} seg", flush=True)
        if rotas:
            print(f"{t}: NO se escribe nada, {len(rotas)} pasada(s) fallaron:\n  "
                  + "\n  ".join(rotas), flush=True)
            continue
        # Fusion: recorro en orden y, cuando dos pasadas pisan el mismo tramo, gana la que
        # Whisper dio mas segura. Sin esto el archivo queda con todo dicho dos veces.
        crudo.sort(key=lambda c: (c[0], -c[4]))
        elegidos, fin_tomado = [], -1.0
        for ini, fin, marca, txt, lp in crudo:
            if ini < fin_tomado - 0.35:
                continue
            elegidos.append((ini, marca, txt, lp))
            fin_tomado = max(fin_tomado, fin)
        lineas = [f"# {v}", f"# pasadas: {' · '.join(detectado)}", CABECERA, ""]
        previas: list[str] = []
        for ini, marca, txt, lp in elegidos:
            flag = " (ALUCINA)" if _alucina(txt, previas) else (" (?)" if lp < -0.9 else "")
            lineas.append(f"[{int(ini // 60):02d}:{int(ini % 60):02d}] [{marca}] {txt}{flag}")
            previas.append(txt)
        open(dst, "w", encoding="utf-8").write("\n".join(lineas))
        try:
            os.remove(wav)
        except OSError:
            pass
        dudosas = sum(1 for l in lineas[4:] if "(ALUCINA)" in l)
        print(f"{t}: {len(elegidos)} segmentos fusionados, {dudosas} marcados ALUCINA "
              f"-> {os.path.basename(dst)}", flush=True)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("accion", choices=["cuadros", "audio", "todo"])
    ap.add_argument("carpeta")
    ap.add_argument("--desde", help="fecha AAAA-MM-DD; filtra por el nombre del archivo")
    ap.add_argument("--tope", type=int, default=24, help="maximo de cuadros por video (default 24)")
    ap.add_argument("--solo", help="lista de IMG_xxxx separados por coma; en 'cuadros' fija ademas el orden")
    ap.add_argument("--trabajo", default=os.path.join(os.environ.get("TEMP", "/tmp"), "_infoDeVideos"))
    ap.add_argument("--idiomas", default="es,zh",
                    help="idiomas a transcribir, separados por coma (default es,zh: el "
                         "tecnico habla chino y el operario castellano en la misma frase)")
    a = ap.parse_args()
    if not os.path.isdir(a.carpeta):
        print(f"No existe la carpeta: {a.carpeta}", file=sys.stderr)
        return 1
    os.makedirs(a.trabajo, exist_ok=True)
    solo = [x.strip() for x in a.solo.split(",")] if a.solo else None
    if a.accion in ("cuadros", "todo"):
        cuadros(a.carpeta, a.desde, a.tope, a.trabajo, solo)
    if a.accion in ("audio", "todo"):
        audio(a.carpeta, a.desde, solo, a.trabajo,
              [x.strip() for x in a.idiomas.split(",") if x.strip()])
    print("LISTO", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
