# -*- coding: utf-8 -*-
"""
_video.py — herramientas de edicion de video para Barack (skill `editar-video`).

Resuelve el problema central de editar video desde una sesion sin ojos: yo no puedo
"mirar" un .mov. Este script convierte el video en cosas que SI puedo leer — hojas de
contacto, numeros de nitidez, temblor y exposicion — para poder elegir planos con
criterio y despues armar el corte.

NO BORRA NI MUEVE NADA. Solo lee los originales y escribe archivos nuevos en --out.

Subcomandos (todos con --help):
  sondeo      metadata real de cada archivo + avisos de VFR / PTS duplicados / sin audio
  hojas       hojas de contacto (grillas de miniaturas con hora quemada) para MIRAR
  analizar    extrae 1 cuadro/seg y mide nitidez, exposicion, saturacion y movimiento
  candidatos  rankea ventanas de N segundos: nitidas, quietas y bien expuestas
  temblor     mide el temblor real de un clip (residuo de alta frecuencia del paneo)
  niveles     percentiles de luma y saturacion -> parametros de correccion de color

Uso tipico (ver SKILL.md `editar-video`):
  python scripts/_video.py sondeo   "D:/tomas/*.mov"
  python scripts/_video.py hojas    "D:/tomas/*.mov" --cada 8 --out .video/hojas
  python scripts/_video.py analizar "D:/tomas/*.mov" --out .video
  python scripts/_video.py candidatos --csv .video/analisis.csv --ventana 6
  python scripts/_video.py temblor  ".video/clips/*.mp4"
"""
from __future__ import annotations
import argparse, collections, csv, glob, json, math, os, subprocess, sys

# ---------------------------------------------------------------- utilidades

def _ffbin(nombre: str) -> str:
    """ffmpeg/ffprobe: del PATH, o del install de winget (Gyan) que es donde vive aca."""
    from shutil import which
    p = which(nombre)
    if p:
        return p
    cand = os.path.expandvars(
        rf"%LOCALAPPDATA%\Microsoft\WinGet\Packages"
        rf"\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe"
        rf"\ffmpeg-8.1-full_build\bin\{nombre}.exe")
    if os.path.exists(cand):
        return cand
    sys.exit(f"ERROR: no encuentro {nombre}. Instalalo o agregalo al PATH.")

FFMPEG  = _ffbin("ffmpeg")
FFPROBE = _ffbin("ffprobe")


def expandir(patrones: list[str]) -> list[str]:
    fs: list[str] = []
    for p in patrones:
        m = sorted(glob.glob(p))
        fs.extend(m if m else ([p] if os.path.exists(p) else []))
    if not fs:
        sys.exit(f"ERROR: ningun archivo coincide con {patrones}")
    return fs


def hms(s: float) -> str:
    return f"{int(s)//60:02d}:{int(s)%60:02d}"


def correr(cmd: list[str], check=True):
    return subprocess.run(cmd, check=check, capture_output=True, text=True)


def _cv2():
    try:
        import cv2, numpy  # noqa
        return cv2, numpy
    except ImportError:
        sys.exit("ERROR: falta opencv-python / numpy.  pip install opencv-python numpy")


# ---------------------------------------------------------------- sondeo

def cmd_sondeo(a):
    print(f"{'archivo':34} {'WxH':>10} {'fps':>8} {'dur':>8} {'Mbps':>6} {'codec':>6} {'audio':>6}")
    avisos = []
    for f in expandir(a.archivos):
        j = json.loads(correr([FFPROBE, "-v", "error", "-show_format", "-show_streams",
                               "-print_format", "json", f]).stdout)
        v = next((s for s in j["streams"] if s["codec_type"] == "video"), None)
        au = [s for s in j["streams"] if s["codec_type"] == "audio"]
        if not v:
            print(f"{os.path.basename(f)[:34]:34}  (sin pista de video)")
            continue
        dur = float(j["format"].get("duration", 0))
        br = float(j["format"].get("bit_rate", 0)) / 1e6
        num, den = (v.get("r_frame_rate", "0/1").split("/") + ["1"])[:2]
        fps = float(num) / float(den or 1)
        print(f"{os.path.basename(f)[:34]:34} {v['width']}x{v['height']:>4} {fps:8.3f} "
              f"{dur:8.1f} {br:6.1f} {v['codec_name']:>6} {('si' if au else 'NO'):>6}")
        if abs(fps - round(fps)) > 0.01:
            avisos.append(f"  {os.path.basename(f)}: fps no entero ({fps:.3f}) -> conformar a CFR antes de editar")
        if not au:
            avisos.append(f"  {os.path.basename(f)}: SIN pista de audio (no hay sonido ambiente para usar)")
        # PTS duplicados: rompen el filtro fps= y hacen perder cuadros en silencio
        r = correr([FFMPEG, "-hide_banner", "-v", "warning", "-i", f, "-f", "null", "-"], check=False)
        n = (r.stderr or "").count("non monotonically")
        if n:
            avisos.append(f"  {os.path.basename(f)}: {n} PTS duplicados -> 'fps=1' pierde cuadros; "
                          f"seleccionar por numero de cuadro (select='not(mod(n,N))')")
    if avisos:
        print("\nAVISOS:")
        for x in dict.fromkeys(avisos):
            print(x)


# ---------------------------------------------------------------- hojas de contacto

def cmd_hojas(a):
    os.makedirs(a.out, exist_ok=True)
    fuente = "C\\:/Windows/Fonts/arialbd.ttf"
    for i, f in enumerate(expandir(a.archivos), 1):
        eti = a.prefijo or f"V{i}"
        vf = (f"fps=1/{a.cada},scale={a.ancho}:{a.alto},"
              f"drawtext=fontfile='{fuente}':text='{eti} %{{pts\\:hms}}':x=6:y=6:"
              f"fontsize={a.fuente}:fontcolor=yellow:box=1:boxcolor=black@0.6:boxborderw=4,"
              f"tile={a.cols}x{a.filas}:margin=2:padding=2")
        sal = os.path.join(a.out, f"{eti}_hoja_%02d.png")
        correr([FFMPEG, "-hide_banner", "-loglevel", "error", "-i", f,
                "-vf", vf, "-an", "-y", sal])
        print(f"{eti}: {len(glob.glob(os.path.join(a.out, eti + '_hoja_*.png')))} hoja(s) -> {a.out}")
    print("\nAhora MIRALAS. Un video que no se miro no se edita.")


# ---------------------------------------------------------------- analisis

def _fps_nominal(f):
    s = correr([FFPROBE, "-v", "error", "-select_streams", "v:0",
                "-show_entries", "stream=r_frame_rate", "-of", "csv=p=0", f]).stdout.strip()
    num, den = (s.split("/") + ["1"])[:2]
    return float(num) / float(den or 1)


def _tiene_dup_pts(f):
    r = correr([FFMPEG, "-hide_banner", "-v", "warning", "-i", f, "-f", "null", "-"], check=False)
    return "non monotonically" in (r.stderr or "")


def _extraer_1fps(f, destino, dup_pts):
    """1 cuadro/seg. Si el archivo tiene PTS duplicados, selecciona por numero de cuadro:
    el filtro fps= descarta cuadros con marca de tiempo repetida y se pierde material
    en silencio (paso real distinto de 1 s)."""
    os.makedirs(destino, exist_ok=True)
    if dup_pts:
        fps = _fps_nominal(f)
        n = max(1, int(round(fps)))
        vf = f"select='not(mod(n\\,{n}))',scale=960:540"
        correr([FFMPEG, "-hide_banner", "-loglevel", "error", "-i", f, "-vf", vf,
                "-fps_mode", "passthrough", "-q:v", "4", "-an", "-y",
                os.path.join(destino, "%04d.jpg")])
        return n / fps                      # segundos reales por cuadro extraido
    correr([FFMPEG, "-hide_banner", "-loglevel", "error", "-i", f, "-vf", "fps=1,scale=960:540",
            "-q:v", "4", "-an", "-y", os.path.join(destino, "%04d.jpg")])
    return 1.0


def cmd_analizar(a):
    cv2, np = _cv2()
    os.makedirs(a.out, exist_ok=True)
    filas = []
    for i, f in enumerate(expandir(a.archivos), 1):
        eti = f"V{i}"
        dup = _tiene_dup_pts(f)
        d = os.path.join(a.out, "cuadros", eti)
        paso = _extraer_1fps(f, d, dup)
        js = sorted(glob.glob(os.path.join(d, "*.jpg")))
        print(f"{eti}: {len(js)} cuadros ({os.path.basename(f)})"
              f"{'  [PTS duplicados: paso %.4f s]' % paso if dup else ''}")
        prev = None
        for p in js:
            k = int(os.path.splitext(os.path.basename(p))[0]) - 1
            img = cv2.imread(p)
            if img is None:
                continue
            g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
            chico = cv2.resize(g, (160, 90))
            mov = 0.0 if prev is None else float(
                np.abs(chico.astype(np.int16) - prev.astype(np.int16)).mean())
            prev = chico
            filas.append(dict(
                vid=eti, archivo=os.path.basename(f), t=round(k * paso, 2),
                sharp=round(float(cv2.Laplacian(g, cv2.CV_64F).var()), 1),
                luma=round(float(g.mean()), 1), contrast=round(float(g.std()), 1),
                p1=round(float(np.percentile(g, 1)), 1), p50=round(float(np.percentile(g, 50)), 1),
                blown=round(float((g > 250).mean() * 100), 2),
                sat=round(float(hsv[:, :, 1].mean()), 1), motion=round(mov, 2)))
    csvp = os.path.join(a.out, "analisis.csv")
    with open(csvp, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=list(filas[0].keys()))
        w.writeheader()
        w.writerows(filas)
    print(f"\n{csvp}  ({len(filas)} cuadros)\n")
    por = collections.defaultdict(list)
    for r in filas:
        por[r["vid"]].append(r)
    print(f"{'vid':4} {'seg':>5} {'nitidez_med':>12} {'nitidez_p25':>12} {'luma':>6} {'sat':>6}")
    for v in sorted(por):
        x = por[v]
        med = lambda k: float(np.median([r[k] for r in x]))
        print(f"{v:4} {len(x):5d} {med('sharp'):12.1f} "
              f"{float(np.percentile([r['sharp'] for r in x], 25)):12.1f} {med('luma'):6.1f} {med('sat'):6.1f}")
    print("\nNitidez mediana < 20 = el archivo esta fuera de foco / con motion blur: se descarta entero.")


# ---------------------------------------------------------------- candidatos

def cmd_candidatos(a):
    _, np = _cv2()
    filas = list(csv.DictReader(open(a.csv, encoding="utf-8")))
    for r in filas:
        for k in ("t", "sharp", "luma", "contrast", "blown", "sat", "motion"):
            r[k] = float(r[k])
    por = collections.defaultdict(list)
    for r in filas:
        por[r["vid"]].append(r)
    W = a.ventana
    cands = []
    for v, x in por.items():
        x = sorted(x, key=lambda r: r["t"])
        for i in range(len(x) - W):
            seg = x[i:i + W]
            if min(r["sharp"] for r in seg) < a.nitidez_min:
                continue
            if max(r["motion"] for r in seg) > a.movimiento_max:
                continue
            sh = float(np.median([r["sharp"] for r in seg]))
            mo = float(np.median([r["motion"] for r in seg]))
            lu = float(np.median([r["luma"] for r in seg]))
            bl = float(np.median([r["blown"] for r in seg]))
            score = math.log(sh) * 30 - mo * 1.6 - bl * 2.0 - abs(lu - 150) * 0.25
            cands.append(dict(score=score, vid=v, archivo=seg[0]["archivo"], t0=seg[0]["t"],
                              t1=seg[-1]["t"], sharp=sh, motion=mo, luma=lu, blown=bl))
    cands.sort(key=lambda c: -c["score"])
    sel = []
    for c in cands:
        if all(not (c["vid"] == s["vid"] and c["t0"] < s["t1"] + a.separacion
                    and s["t0"] < c["t1"] + a.separacion) for s in sel):
            sel.append(c)
        if len(sel) >= a.cuantos:
            break
    sel.sort(key=lambda c: (c["vid"], c["t0"]))
    print(f"{'#':>3} {'vid':4} {'desde':>7} {'hasta':>7} {'nitidez':>8} {'mov':>6} {'luma':>6} {'quem%':>6}")
    for i, c in enumerate(sel, 1):
        c["n"] = i
        print(f"{i:3d} {c['vid']:4} {hms(c['t0']):>7} {hms(c['t1']):>7} "
              f"{c['sharp']:8.1f} {c['motion']:6.1f} {c['luma']:6.1f} {c['blown']:6.2f}")
    if a.json:
        json.dump(sel, open(a.json, "w"), indent=1)
        print(f"\n-> {a.json}")
    print("\nOJO: dos candidatos del MISMO archivo separados por pocos segundos son el mismo\n"
          "plano cortado al medio. Puestos seguidos se ven como un salto. Separalos o usa uno.")


# ---------------------------------------------------------------- temblor

def _temblor(path, ventana=9):
    cv2, np = _cv2()
    cap = cv2.VideoCapture(path)
    prev, d = None, []
    while True:
        ok, f = cap.read()
        if not ok:
            break
        g = cv2.cvtColor(cv2.resize(f, (640, 360)), cv2.COLOR_BGR2GRAY).astype(np.float32)
        if prev is not None:
            (dx, dy), _ = cv2.phaseCorrelate(prev, g)
            d.append((dx, dy))
        prev = g
    cap.release()
    if len(d) < ventana + 3:
        return None
    d = np.array(d)
    ker = np.ones(ventana) / ventana
    suave = np.stack([np.convolve(d[:, i], ker, mode="same") for i in range(2)], axis=1)
    tem = np.sqrt(((d - suave) ** 2).sum(1))
    return dict(paneo=float(np.sqrt((suave ** 2).sum(1)).mean()),
                temblor=float(tem.mean()), pico=float(tem.max()), n=len(d))


def cmd_temblor(a):
    print(f"{'clip':40} {'paneo':>7} {'TEMBLOR':>9} {'pico':>8}  veredicto")
    for f in expandir(a.clips):
        r = _temblor(f)
        if not r:
            print(f"{os.path.basename(f)[:40]:40}  (clip demasiado corto)")
            continue
        v = ("estable" if r["temblor"] < 1.2 else
             "aceptable" if r["temblor"] < 2.0 else "DESCARTAR")
        print(f"{os.path.basename(f)[:40]:40} {r['paneo']:7.2f} {r['temblor']:9.3f} "
              f"{r['pico']:8.1f}  {v}")
    print("\npx medidos sobre 640x360. Debajo de ~1,2 px el gimbal ya hizo el trabajo:\n"
          "estabilizar por software ahi EMPEORA (ver SKILL.md, seccion Estabilizacion).")


# ---------------------------------------------------------------- niveles / color

def cmd_niveles(a):
    cv2, np = _cv2()
    for f in expandir(a.clips):
        tmp = os.path.join(a.out, "niveles", os.path.splitext(os.path.basename(f))[0])
        os.makedirs(tmp, exist_ok=True)
        correr([FFMPEG, "-hide_banner", "-loglevel", "error", "-i", f, "-vf", "fps=1",
                "-q:v", "2", "-y", os.path.join(tmp, "n_%03d.jpg")])
        P, S = [], []
        for p in sorted(glob.glob(os.path.join(tmp, "n_*.jpg"))):
            img = cv2.imread(p)
            g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            P.append(np.percentile(g, [1, 50, 99]))
            S.append(cv2.cvtColor(img, cv2.COLOR_BGR2HSV)[:, :, 1].mean())
        if not P:
            print(f"{os.path.basename(f)}: sin cuadros")
            continue
        p1, p50, p99 = np.median(np.array(P), axis=0)
        rimin = float(np.clip(p1 / 255 - 0.010, 0.02, 0.22))
        m2 = float(np.clip((p50 / 255 - rimin) / (0.985 - rimin), 0.05, 0.95))
        gamma = float(np.clip(math.log(m2) / math.log(a.medio), 0.72, 1.35))
        print(f"\n{os.path.basename(f)}")
        print(f"  p1={p1:5.1f}  p50={p50:5.1f}  p99={p99:5.1f}  saturacion={np.median(S):5.1f}")
        if p1 > 20:
            print(f"  -> negros levantados a {p1/255:.1%}: ESA es la sensacion de 'lavado'.")
        print(f"  filtro sugerido:\n"
              f"    colorlevels=rimin={rimin:.4f}:gimin={rimin:.4f}:bimin={rimin:.4f}"
              f":rimax=0.985:gimax=0.985:bimax=0.985,"
              f"eq=contrast=1.06:saturation=1.35:gamma={gamma:.3f}")


# ---------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("sondeo", help="metadata real + avisos de VFR / PTS duplicados / sin audio")
    p.add_argument("archivos", nargs="+")
    p.set_defaults(f=cmd_sondeo)

    p = sub.add_parser("hojas", help="hojas de contacto para MIRAR el material")
    p.add_argument("archivos", nargs="+")
    p.add_argument("--cada", type=int, default=8, help="segundos entre miniaturas (def 8)")
    p.add_argument("--cols", type=int, default=5)
    p.add_argument("--filas", type=int, default=5)
    p.add_argument("--ancho", type=int, default=384)
    p.add_argument("--alto", type=int, default=216)
    p.add_argument("--fuente", type=int, default=20)
    p.add_argument("--prefijo", default=None)
    p.add_argument("--out", default=".video/hojas")
    p.set_defaults(f=cmd_hojas)

    p = sub.add_parser("analizar", help="nitidez / exposicion / saturacion / movimiento por segundo")
    p.add_argument("archivos", nargs="+")
    p.add_argument("--out", default=".video")
    p.set_defaults(f=cmd_analizar)

    p = sub.add_parser("candidatos", help="rankea ventanas nitidas y quietas")
    p.add_argument("--csv", default=".video/analisis.csv")
    p.add_argument("--ventana", type=int, default=6, help="largo de la ventana en segundos")
    p.add_argument("--nitidez-min", type=float, default=60.0)
    p.add_argument("--movimiento-max", type=float, default=55.0)
    p.add_argument("--separacion", type=float, default=2.0)
    p.add_argument("--cuantos", type=int, default=28)
    p.add_argument("--json", default=None)
    p.set_defaults(f=cmd_candidatos)

    p = sub.add_parser("temblor", help="mide el temblor real (decide si estabilizar o no)")
    p.add_argument("clips", nargs="+")
    p.set_defaults(f=cmd_temblor)

    p = sub.add_parser("niveles", help="percentiles de luma -> filtro de correccion de color")
    p.add_argument("clips", nargs="+")
    p.add_argument("--medio", type=float, default=0.57, help="luma media objetivo (def 0.57)")
    p.add_argument("--out", default=".video")
    p.set_defaults(f=cmd_niveles)

    a = ap.parse_args()
    a.f(a)


if __name__ == "__main__":
    main()
