"""Instala el detector de fallas en esta PC desde la carpeta de software de la nube de Ingenieria.

Uso (python del sistema):  instalar_detector.py [--probar]
- Copia el modelo desde `2- SOFTWARE\\DETECTOR DE FALLAS IMPRESION 3D (PrintGuard)\\modelo`
  a C:\\Dev\\_printguard\\modelo y arma el entorno C:\\Dev\\_printguard\\.venv (onnxruntime, numpy, pillow).
- Si ya esta instalado no toca nada. Con --probar corre el modelo sobre una imagen gris y
  comprueba que contesta.
Sale con 0 si quedo listo, 1 si falta algo (y dice que).
"""
import os
import shutil
import subprocess
import sys
from pathlib import Path

NUBE = (Path(os.environ["USERPROFILE"]) / "BARACK ARGENTINA SRL" / "Ingeniería y Proyecto - General"
        / "INGENIERIA BARACK (NUNCA BORRAR)" / "2- SOFTWARE" / "DETECTOR DE FALLAS IMPRESION 3D (PrintGuard)")
LOCAL = Path(r"C:\Dev\_printguard")
PY = LOCAL / ".venv" / "Scripts" / "python.exe"
ARCHIVOS = ("model.onnx", "prototypes.pkl", "opt.json")


def instalado():
    return PY.exists() and all((LOCAL / "modelo" / a).exists() for a in ARCHIVOS)


def instalar():
    if instalado():
        print("el detector ya esta instalado en", LOCAL)
        return 0
    if not (NUBE / "modelo" / "model.onnx").exists():
        print("No encuentro el detector en la nube de Ingenieria:\n  ", NUBE,
              "\nRevisar que esa carpeta este sincronizada en esta PC.")
        return 1
    (LOCAL / "modelo").mkdir(parents=True, exist_ok=True)
    for a in ARCHIVOS:
        if not (LOCAL / "modelo" / a).exists():
            shutil.copy2(NUBE / "modelo" / a, LOCAL / "modelo" / a)
    if not PY.exists():
        if shutil.which("uv"):
            pasos = [["uv", "venv", "--python", "3.12", str(LOCAL / ".venv")],
                     ["uv", "pip", "install", "--python", str(PY), "onnxruntime", "numpy", "pillow"]]
        else:
            pasos = [[sys.executable, "-m", "venv", str(LOCAL / ".venv")],
                     [str(PY), "-m", "pip", "install", "onnxruntime", "numpy", "pillow"]]
        for p in pasos:
            r = subprocess.run(p, capture_output=True, text=True)
            if r.returncode != 0:
                print("fallo:", " ".join(p), "\n", (r.stderr or r.stdout)[-400:])
                return 1
    print("detector instalado en", LOCAL)
    return 0 if instalado() else 1


def probar():
    codigo = ("import sys; sys.path.insert(0, r'%s'); import detector_fallas as d; from PIL import Image; "
              "import tempfile, os; p=os.path.join(tempfile.gettempdir(),'prueba_detector.jpg'); "
              "Image.new('RGB',(640,480),(128,128,128)).save(p); s=d.cargar(); print('contesta:', d.juzgar(*s, p))"
              % Path(__file__).resolve().parent)
    r = subprocess.run([str(PY), "-c", codigo], capture_output=True, text=True)
    print((r.stdout or r.stderr).strip()[-300:])
    return r.returncode


if __name__ == "__main__":
    rc = instalar()
    if rc == 0 and "--probar" in sys.argv:
        rc = probar()
    sys.exit(rc)
