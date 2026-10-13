"""Filtro barato de fallas sobre las fotos de la camara, con el modelo de PrintGuard.

Uso (python de C:\\Dev\\_printguard\\.venv, que solo tiene onnxruntime + numpy + pillow):
  detector_fallas.py <foto.jpg | carpeta> [--recorte x0,y0,x1,y1] [--sensibilidad 1.0]

Que es: PrintGuard (github.com/oliverbravery/PrintGuard) clasifica una imagen como "success" o
"failure" comparando su huella contra dos prototipos (red de prototipos, modelo ONNX de 5 MB).
Aca se usa SOLO su modelo, sin su servidor web ni su conexion a la impresora, y sin torch:
- el preprocesado (lado corto a 256, gris en 3 canales, recorte central 224, normalizar) esta
  reescrito con Pillow/numpy, igual al de printguard/utils/backends/base_engine.py;
- prototypes.pkl es un pickle de tensores de torch: se lee con un desempaquetador RESTRINGIDO que
  solo acepta esos nombres y saca los numeros crudos, sin ejecutar nada mas.

NO DECIDE. Devuelve, por foto: clase mas cercana y las dos distancias. Es un filtro para elegir
cuando vale la pena que alguien mire la foto. Sale con 0 si ninguna foto da "failure", 2 si alguna da.
"""
import collections
import io
import json
import pickle
import sys
from pathlib import Path

import numpy as np
import onnxruntime as ort
from PIL import Image

MODELO = Path(r"C:\Dev\_printguard\modelo")
MEDIA, DESVIO = np.array([0.485, 0.456, 0.406], np.float32), np.array([0.229, 0.224, 0.225], np.float32)


class _Restringido(pickle.Unpickler):
    PERMITIDOS = {("torch._utils", "_rebuild_tensor_v2"), ("torch.storage", "_load_from_bytes"),
                  ("collections", "OrderedDict")}

    def find_class(self, modulo, nombre):
        if (modulo, nombre) not in self.PERMITIDOS:
            raise pickle.UnpicklingError(f"el archivo de prototipos pide {modulo}.{nombre}: no se abre")
        if nombre == "OrderedDict":
            return collections.OrderedDict
        if nombre == "_load_from_bytes":
            return lambda b: b                       # devuelve los bytes crudos del almacenamiento
        return lambda almac, desplaz, forma, paso, *resto: np.frombuffer(
            almac[-int(np.prod(forma)) * 4:], np.float32).reshape(forma).copy()


def cargar():
    d = _Restringido(io.BytesIO((MODELO / "prototypes.pkl").read_bytes())).load()
    protos, nombres = np.asarray(d["prototypes"], np.float32), list(d["class_names"])
    assert protos.ndim == 2 and len(nombres) == protos.shape[0] and np.isfinite(protos).all(), "prototipos raros"
    ses = ort.InferenceSession(str(MODELO / "model.onnx"), providers=["CPUExecutionProvider"])
    return ses, protos, nombres, int(d.get("defect_idx", nombres.index("failure")))


def preparar(img):
    w, h = img.size
    k = 256 / min(w, h)
    img = img.resize((round(w * k), round(h * k)), Image.BILINEAR).convert("L").convert("RGB")
    w, h = img.size
    x0, y0 = (w - 224) // 2, (h - 224) // 2
    a = np.asarray(img.crop((x0, y0, x0 + 224, y0 + 224)), np.float32) / 255.0
    return ((a - MEDIA) / DESVIO).transpose(2, 0, 1)[None].astype(np.float32)


def juzgar(ses, protos, nombres, i_falla, ruta, recorte=None, sensibilidad=1.0):
    img = Image.open(ruta).convert("RGB")
    if recorte:
        img = img.crop(recorte)
    emb = ses.run(None, {ses.get_inputs()[0].name: preparar(img)})[0].reshape(1, -1)
    dist = np.linalg.norm(emb - protos, axis=1)
    i = int(dist.argmin())
    # como PrintGuard: con sensibilidad > 1 se acepta "falla" aunque no sea la mas cercana
    if i != i_falla and dist[i_falla] <= dist[i] * sensibilidad:
        i = i_falla
    return nombres[i], {n: round(float(x), 3) for n, x in zip(nombres, dist)}


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    recorte = sens = None
    for j, a in enumerate(sys.argv):
        if a == "--recorte":
            recorte = tuple(int(v) for v in sys.argv[j + 1].split(","))
        if a == "--sensibilidad":
            sens = float(sys.argv[j + 1])
    args = [a for a in args if a not in (",".join(map(str, recorte)) if recorte else "", str(sens))]
    destino = Path(args[0])
    fotos = sorted(destino.glob("*.jpg")) if destino.is_dir() else [destino]
    ses, protos, nombres, i_falla = cargar()
    print(f"modelo: {protos.shape[0]} clases {nombres}, huella de {protos.shape[1]} numeros | recorte {recorte}")
    malas = 0
    for f in fotos:
        clase, dist = juzgar(ses, protos, nombres, i_falla, f, recorte, sens or 1.0)
        malas += clase == "failure"
        print(f"  {f.name:<28} {clase:<8} {json.dumps(dist)}")
    sys.exit(2 if malas else 0)
