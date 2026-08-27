# -*- coding: utf-8 -*-
"""
_qrVerificacion.py — QR de verificacion para los documentos que emite Barack.

Tres cosas, un solo archivo:

  analizar   mide los QR de CUALQUIER PDF (propio o ajeno): donde esta, que tamano,
             que version, que nivel de correccion de error, que codifica. Solo lectura.
  sellar     pone el QR de verificacion de Barack en un PDF NUESTRO y lo anota en el
             registro. Se niega a tocar un papel de un tercero.
  verificar  lee el QR de un PDF sellado, lo busca en el registro y compara el SHA-256
             del archivo contra el que se anoto al emitirlo.

El diseno copia el mecanismo de los laboratorios que ya nos mandan reportes con QR
(medido sobre seis reportes reales, ver docs/QR_VERIFICACION.md), con un agregado:
ademas del puntero al registro, guardamos el hash del archivo emitido. Eso responde
dos preguntas en vez de una: "existe este documento?" y "es este archivo, sin tocar?".

QUE NO HACE, y no es un olvido: no pone un QR sobre un documento emitido por otro.
Regla .claude/rules/documentos-de-terceros.md — la verificacion la hace el emisor.

Uso:
  python scripts/_qrVerificacion.py analizar  "<archivo>"
  python scripts/_qrVerificacion.py sellar    "<archivo>" --tipo AMFE --numero 172 --rev 0 \
         --titulo "AMFE de proceso ductos" --producto "Ductos Patagonia" --emisor "Ingenieria"
  python scripts/_qrVerificacion.py verificar "<archivo>"
  python scripts/_qrVerificacion.py anular    <token> [--estado anulado|reemplazado]
  python scripts/_qrVerificacion.py registro  [--listar | --sql]
  python scripts/_qrVerificacion.py selftest

El registro (`public/verificacion/registro.json`) se sirve por HTTP y ademas vive en un
repo publico: TODO lo que se escribe ahi es publico. Lo unico que no sale del disco es la
clave de `.qr-secret`. Despues de sellar o anular hay que PUSHEAR, o la pagina no lo ve.
"""
from __future__ import annotations

import argparse
import hashlib
import hmac
import io
import json
import os
import re
import secrets
import sys
from datetime import datetime, timezone

import fitz  # PyMuPDF
import numpy as np
import cv2
import segno

# --------------------------------------------------------------------------------------
# Parametros del sello. Los numeros salen de medir seis reportes reales de laboratorio:
# QR version 8 (49x49 modulos) con correccion de error Q, 26,46 mm de lado, 200 dpi,
# quiet zone de 4 modulos, en la portada contra el margen derecho.
# --------------------------------------------------------------------------------------
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Un solo registro, y es el que sirve la web. Al principio habia dos —uno "interno" con el
# hash previo al sello y otro publicado sin el— pero los dos vivian en el mismo repo, que es
# publico: el filtro no filtraba nada. Se saco el campo en vez de esconderlo. Lo unico que
# de verdad no se publica es la clave, y esa esta afuera del repo.
REGISTRO = os.path.join(RAIZ, "public", "verificacion", "registro.json")
ARCHIVO_CLAVE = os.path.join(RAIZ, ".qr-secret")  # gitignoreado

URL_BASE = "https://facussc24.github.io/tiempos-y-balanceos/v.html#"
TOKEN_BYTES = 12          # 24 caracteres hex = 96 bits; el laboratorio usa 24 bytes (48 hex)
ECC = "q"                 # 25 % de recuperacion: el papel se fotocopia y se sella
LADO_MM = 26.46
MARGEN_DER_MM = 25.83     # medido en los reportes del laboratorio
MARGEN_INF_MM = 30.91
DPI_QR = 200
QUIET_ZONE = 4            # modulos, minimo que pide ISO/IEC 18004

LEYENDA = ("Este documento no es valido sin el codigo QR de verificacion de su portada. "
           "Un ejemplar sin QR, o cuyo QR no resuelva contra el registro de Barack "
           "Mercosul S.R.L., es una copia alterada.")

MM_PT = 72.0 / 25.4
PT_MM = 25.4 / 72.0

FINDER = np.array([
    [1, 1, 1, 1, 1, 1, 1], [1, 0, 0, 0, 0, 0, 1], [1, 0, 1, 1, 1, 0, 1],
    [1, 0, 1, 1, 1, 0, 1], [1, 0, 1, 1, 1, 0, 1], [1, 0, 0, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 1, 1]], dtype=np.uint8)

ECC_BITS = {(1, 1): "L", (1, 0): "M", (0, 1): "Q", (0, 0): "H"}

# Capacidad en modo byte por version y nivel (ISO/IEC 18004). No es de memoria: sale de
# tantear segno por biseccion, `scripts/_qrVerificacion.py` no adivina numeros de norma.
CAPACIDAD_BYTE = {
    (1, "L"): 17, (1, "M"): 14, (1, "Q"): 11, (1, "H"): 7,
    (2, "L"): 32, (2, "M"): 26, (2, "Q"): 20, (2, "H"): 14,
    (3, "L"): 53, (3, "M"): 42, (3, "Q"): 32, (3, "H"): 24,
    (4, "L"): 78, (4, "M"): 62, (4, "Q"): 46, (4, "H"): 34,
    (5, "L"): 106, (5, "M"): 84, (5, "Q"): 60, (5, "H"): 44,
    (6, "L"): 134, (6, "M"): 106, (6, "Q"): 74, (6, "H"): 58,
    (7, "L"): 154, (7, "M"): 122, (7, "Q"): 86, (7, "H"): 64,
    (8, "L"): 192, (8, "M"): 152, (8, "Q"): 108, (8, "H"): 84,
    (9, "L"): 230, (9, "M"): 180, (9, "Q"): 130, (9, "H"): 98,
    (10, "L"): 271, (10, "M"): 213, (10, "Q"): 151, (10, "H"): 119,
    (11, "L"): 321, (11, "M"): 251, (11, "Q"): 177, (11, "H"): 137,
    (12, "L"): 367, (12, "M"): 287, (12, "Q"): 203, (12, "H"): 155,
}


# ======================================================================================
# Utilidades
# ======================================================================================
def sha256(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for bloque in iter(lambda: f.read(1 << 20), b""):
            h.update(bloque)
    return h.hexdigest()


def clave_secreta() -> bytes:
    """La clave con la que se firma el token. Nunca va al repo."""
    env = os.environ.get("BARACK_QR_SECRET")
    if env:
        return env.encode("utf-8")
    if os.path.exists(ARCHIVO_CLAVE):
        with open(ARCHIVO_CLAVE, "r", encoding="utf-8") as f:
            return f.read().strip().encode("utf-8")
    nueva = secrets.token_hex(32)
    with open(ARCHIVO_CLAVE, "w", encoding="utf-8") as f:
        f.write(nueva)
    print(f"[clave] no habia clave: se genero una nueva en {ARCHIVO_CLAVE}")
    print("[clave] GUARDALA. Si se pierde, los tokens ya emitidos no se pueden recalcular")
    print("        (el registro los conserva igual, pero no se pueden re-derivar).")
    return nueva.encode("utf-8")


def calcular_token(doc_id: str, hash_base: str) -> str:
    """Token opaco y determinista: HMAC de la identidad del documento con la clave.

    Determinista para que el mismo documento de siempre el mismo token; opaco para que
    nadie pueda fabricar uno valido ni enumerar los que existen.
    """
    mac = hmac.new(clave_secreta(), f"{doc_id}|{hash_base}".encode("utf-8"), hashlib.sha256)
    return mac.hexdigest()[: TOKEN_BYTES * 2].upper()


def cargar_registro() -> dict:
    if os.path.exists(REGISTRO):
        with open(REGISTRO, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"documentos": {}}


# Todo lo que se escribe aca es publico por definicion: el registro se sirve por HTTP y ademas
# esta en un repo publico. Que no entre nada que no querriamos que lea un tercero.
CAMPOS = ("doc_id", "tipo", "numero", "revision", "titulo", "producto", "emisor",
          "empresa", "emitido", "archivo", "sha256", "estado", "reemplazado_por", "url")


def guardar_registro(reg: dict) -> None:
    reg["actualizado"] = datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")
    for token, d in reg["documentos"].items():
        sobra = set(d) - set(CAMPOS)
        if sobra:
            raise SystemExit(f"el registro es publico y {token} trae campos de mas: {sobra}")
    os.makedirs(os.path.dirname(REGISTRO), exist_ok=True)
    with open(REGISTRO, "w", encoding="utf-8") as f:
        json.dump(reg, f, ensure_ascii=False, indent=2)


# ======================================================================================
# analizar — medir los QR de un PDF cualquiera
# ======================================================================================
def _decodificar(img_bgr):
    det = cv2.QRCodeDetector()
    salidas = []
    try:
        ok, datos, _, _ = det.detectAndDecodeMulti(img_bgr)
        if ok:
            salidas += [d for d in datos if d]
    except cv2.error:
        pass
    if not salidas:
        try:
            t, _, _ = det.detectAndDecode(img_bgr)
            if t:
                salidas.append(t)
        except cv2.error:
            pass
    return salidas


def _grilla(crop: np.ndarray, N: int) -> np.ndarray:
    h, w = crop.shape
    M = np.zeros((N, N), np.uint8)
    for i in range(N):
        for j in range(N):
            y0, y1 = int(round(i * h / N)), int(round((i + 1) * h / N))
            x0, x1 = int(round(j * w / N)), int(round((j + 1) * w / N))
            M[i, j] = 1 if crop[y0:y1, x0:x1].mean() > 0.5 else 0
    return M


def medir_simbolo(gray: np.ndarray) -> dict | None:
    """Deduce version, nivel de ECC y quiet zone probando cada grilla posible.

    No se le cree a la primera que "casi" cierra: se exige que los tres patrones de
    busqueda esten exactos Y que los dos timing patterns alternen.
    """
    bw = (gray < 128).astype(np.uint8)
    if not bw.any():
        return None
    ys, xs = np.where(bw)
    crop = bw[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    for v in range(1, 15):
        N = 17 + 4 * v
        M = _grilla(crop, N)
        finders = (np.array_equal(M[0:7, 0:7], FINDER)
                   + np.array_equal(M[0:7, N - 7:N], FINDER)
                   + np.array_equal(M[N - 7:N, 0:7], FINDER))
        esperado = np.array([(k % 2 == 0) for k in range(N - 16)], np.uint8)
        timing = (np.array_equal(M[6, 8:N - 8], esperado)
                  + np.array_equal(M[8:N - 8, 6], esperado))
        if finders == 3 and timing == 2:
            mod_px = crop.shape[0] / N
            return {
                "version": v, "modulos": N, "modulo_px": mod_px,
                "ecc": ECC_BITS.get((int(M[8, 0]), int(M[8, 1])), "?"),
                "quiet_modulos": ys.min() / mod_px,
                "simbolo_px": crop.shape[0],
            }
    return None


def analizar(path: str, como_json: bool = False) -> list[dict]:
    doc = fitz.open(path)
    hallazgos = []
    for pno in range(doc.page_count):
        pag = doc[pno]
        for im in pag.get_images(full=True):
            xref = im[0]
            try:
                info = doc.extract_image(xref)
            except Exception:
                continue
            w, h = info["width"], info["height"]
            if h == 0 or not (0.85 <= w / h <= 1.18) or w < 60:
                continue
            gris = cv2.imdecode(np.frombuffer(info["image"], np.uint8), cv2.IMREAD_GRAYSCALE)
            if gris is None:
                continue
            payloads = _decodificar(cv2.cvtColor(gris, cv2.COLOR_GRAY2BGR))
            if not payloads:
                continue
            med = medir_simbolo(gris) or {}
            for r in pag.get_image_rects(xref):
                hallazgos.append({
                    "pagina": pno + 1,
                    "payload": payloads[0],
                    "imagen_px": [w, h],
                    "formato": info["ext"],
                    "rect_pt": [round(r.x0, 1), round(r.y0, 1), round(r.x1, 1), round(r.y1, 1)],
                    "lado_mm": round(r.width * PT_MM, 2),
                    "margen_derecho_mm": round((pag.rect.width - r.x1) * PT_MM, 2),
                    "margen_inferior_mm": round((pag.rect.height - r.y1) * PT_MM, 2),
                    "dpi": round(w / r.width * 72),
                    "hoja_mm": [round(pag.rect.width * PT_MM, 1), round(pag.rect.height * PT_MM, 1)],
                    **{k: (round(v, 2) if isinstance(v, float) else v) for k, v in med.items()},
                })
    doc.close()

    if como_json:
        print(json.dumps(hallazgos, ensure_ascii=False, indent=2))
        return hallazgos

    print(f"\n{os.path.basename(path)} — {len(hallazgos)} QR")
    if not hallazgos:
        print("  (ningun QR legible)")
    for q in hallazgos:
        print(f"\n  pagina {q['pagina']} | hoja {q['hoja_mm'][0]} x {q['hoja_mm'][1]} mm")
        print(f"    imagen ....... {q['imagen_px'][0]}x{q['imagen_px'][1]} px {q['formato']}, "
              f"{q['dpi']} dpi efectivos")
        print(f"    impreso ...... {q['lado_mm']} mm de lado")
        print(f"    posicion ..... {q['margen_derecho_mm']} mm del borde derecho, "
              f"{q['margen_inferior_mm']} mm del pie")
        if "version" in q:
            cap = CAPACIDAD_BYTE.get((q["version"], q["ecc"]))
            extra = f" (capacidad {cap} bytes)" if cap else ""
            print(f"    simbolo ...... version {q['version']} = {q['modulos']}x{q['modulos']} "
                  f"modulos, correccion {q['ecc']}{extra}")
            print(f"    modulo ....... {q['modulo_px']} px | quiet zone "
                  f"{q['quiet_modulos']} modulos (ISO 18004 pide {QUIET_ZONE})")
        print(f"    codifica ..... {q['payload']}")
        print(f"    largo ........ {len(q['payload'])} bytes")
    return hallazgos


# ======================================================================================
# sellar — poner NUESTRO QR en un PDF NUESTRO
# ======================================================================================
def _es_ajeno(path: str) -> str | None:
    """Devuelve el motivo si el PDF parece emitido por un tercero, o None."""
    for q in analizar_silencioso(path):
        url = q["payload"]
        if url.startswith(URL_BASE):
            continue
        return (f"ya tiene un QR de verificacion de otro emisor en la pagina {q['pagina']}: "
                f"{url}")
    return None


def analizar_silencioso(path: str) -> list[dict]:
    buf, sys.stdout = sys.stdout, io.StringIO()
    try:
        return analizar(path)
    finally:
        sys.stdout = buf


def hacer_qr_png(payload: str, lado_mm: float, dpi: int) -> tuple[bytes, dict]:
    qr = segno.make(payload, error=ECC, micro=False)
    lado_px = int(round(lado_mm / 25.4 * dpi))
    escala = max(1, round(lado_px / (qr.symbol_size(border=QUIET_ZONE)[0])))
    buf = io.BytesIO()
    qr.save(buf, kind="png", scale=escala, border=QUIET_ZONE, dark="#000000", light="#FFFFFF")
    ancho = qr.symbol_size(scale=escala, border=QUIET_ZONE)[0]
    return buf.getvalue(), {
        "version": qr.version, "ecc": qr.error.upper(),
        "modulos": 17 + 4 * qr.version if isinstance(qr.version, int) else qr.version,
        "escala": escala, "png_px": ancho,
    }


def sellar(path: str, meta: dict, salida: str | None, pagina: int,
           forzar: bool = False) -> dict:
    anteriores = [q for q in analizar_silencioso(path)
                  if q["payload"].startswith(URL_BASE)]
    motivo = _es_ajeno(path)
    if motivo and not forzar:
        print("\n[ABORTA] Este PDF " + motivo)
        print("  Un documento emitido por otro no lleva nuestro QR: la verificacion la hace")
        print("  el emisor. Si un campo esta mal, se pide la reemision al que lo emitio.")
        print("  Regla: .claude/rules/documentos-de-terceros.md")
        raise SystemExit(2)

    doc_id = f"{meta['tipo']}-{meta['numero']}-REV{meta['rev']}"
    hash_base = sha256(path)
    token = calcular_token(doc_id, hash_base)
    url = URL_BASE + token

    png, info_qr = hacer_qr_png(url, LADO_MM, DPI_QR)
    cap = CAPACIDAD_BYTE.get((info_qr["version"], info_qr["ecc"]))
    if cap and len(url) > cap:
        raise SystemExit(f"payload de {len(url)} bytes no entra en V{info_qr['version']}-"
                         f"{info_qr['ecc']} ({cap})")

    doc = fitz.open(path)
    pag = doc[pagina - 1]
    lado_pt = LADO_MM * MM_PT
    x1 = pag.rect.width - MARGEN_DER_MM * MM_PT
    y1 = pag.rect.height - MARGEN_INF_MM * MM_PT
    rect = fitz.Rect(x1 - lado_pt, y1 - lado_pt, x1, y1)

    # No tapar contenido: si donde va el QR ya hay texto se prueba el margen de arriba, y si
    # ese tampoco esta libre se avisa en vez de pisar el documento callado.
    if pag.get_text("text", clip=rect).strip():
        alto = fitz.Rect(x1 - lado_pt, MARGEN_INF_MM * MM_PT,
                         x1, MARGEN_INF_MM * MM_PT + lado_pt)
        if pag.get_text("text", clip=alto).strip():
            print("[AVISO] las dos posiciones del QR tienen texto encima: queda abajo a la")
            print("        derecha y PISA contenido. Mira la portada antes de mandarlo.")
        else:
            print("[aviso] habia texto donde iba el QR: se corrio al margen superior derecho")
            rect = alto

    pag.insert_image(rect, stream=png, keep_proportion=True)

    caja = fitz.Rect(rect.x0 - 250, rect.y1 + 2, rect.x1, rect.y1 + 26)
    pag.insert_textbox(caja, f"Verificar: {url}", fontsize=5.2, fontname="helv",
                       color=(0.35, 0.35, 0.35), align=fitz.TEXT_ALIGN_RIGHT)

    # Nunca guardar sobre el archivo que PyMuPDF tiene abierto: si el nombre no termina en
    # .pdf el sub() no cambia nada y destino seria el mismo path.
    destino = salida or re.sub(r"\.pdf$", "_sellado.pdf", path, flags=re.I)
    if os.path.abspath(destino) == os.path.abspath(path):
        destino = path + "_sellado.pdf"
    doc.save(destino, garbage=4, deflate=True)
    doc.close()

    hash_final = sha256(destino)
    reg = cargar_registro()

    # Re-sello de un documento propio: la version anterior deja de estar vigente. Sin esto,
    # una copia vieja que siga circulando se verifica como buena para siempre.
    reemplazados = []
    for q in anteriores:
        viejo = q["payload"][len(URL_BASE):].strip().upper()
        d = reg["documentos"].get(viejo)
        if d and viejo != token and d.get("estado") == "vigente":
            d["estado"] = "reemplazado"
            d["reemplazado_por"] = token
            reemplazados.append(viejo)

    reg["documentos"][token] = {
        "doc_id": doc_id, "tipo": meta["tipo"], "numero": str(meta["numero"]),
        "revision": str(meta["rev"]), "titulo": meta.get("titulo", ""),
        "producto": meta.get("producto", ""), "emisor": meta.get("emisor", "Ingenieria"),
        "empresa": "Barack Mercosul S.R.L.",
        "emitido": datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds"),
        "archivo": os.path.basename(destino),
        "sha256": hash_final,
        "estado": "vigente", "url": url,
    }
    guardar_registro(reg)

    print(f"\nSellado: {destino}")
    print(f"  documento ... {doc_id} — {meta.get('titulo','')}")
    print(f"  token ....... {token}")
    print(f"  URL ......... {url}")
    print(f"  QR .......... version {info_qr['version']} ({info_qr['modulos']} modulos), "
          f"correccion {info_qr['ecc']}, {LADO_MM} mm, {info_qr['png_px']} px")
    print(f"  posicion .... {MARGEN_DER_MM} mm del borde derecho, {MARGEN_INF_MM} mm del pie, "
          f"pagina {pagina}")
    print(f"  SHA-256 ..... {hash_final}")
    print(f"  registro .... {os.path.relpath(REGISTRO, RAIZ)}")
    for viejo in reemplazados:
        print(f"  reemplaza ... {viejo} (queda como 'reemplazado', ya no verifica vigente)")
    print(f"\n  Leyenda para el pie del documento:\n  \"{LEYENDA}\"")
    print("  Acordate de pushear: la pagina lee el registro desde GitHub Pages.")
    return {**reg["documentos"][token], "_sha256_sin_qr": hash_base}


# ======================================================================================
# verificar
# ======================================================================================
def verificar(path: str) -> int:
    hallazgos = analizar_silencioso(path)
    nuestros = [q for q in hallazgos if q["payload"].startswith(URL_BASE)]
    print(f"\n{os.path.basename(path)}")
    if not nuestros:
        ajenos = [q["payload"] for q in hallazgos]
        print("  SIN QR DE BARACK — no se puede verificar contra nuestro registro.")
        if ajenos:
            print(f"  Tiene QR de otro emisor: {ajenos[0]}")
            print("  Ese hay que verificarlo en el sitio del emisor, no aca.")
        else:
            print("  El documento no lleva ningun QR. Si deberia llevarlo, es una copia")
            print("  alterada o una impresion de un borrador sin sellar.")
        return 1

    reg = cargar_registro()["documentos"]
    salida = 0
    for q in nuestros:
        # El token es lo que sigue a URL_BASE, no "lo que va despues de la ultima barra":
        # la URL termina en v.html#<token> y esa cuenta se comia el nombre del archivo.
        token = q["payload"][len(URL_BASE):].strip().upper()
        d = reg.get(token)
        print(f"  token {token}")
        if not d:
            print("  NO FIGURA EN EL REGISTRO — documento no emitido por Barack, o registro")
            print("  desactualizado. No usar hasta aclararlo.")
            salida = 1
            continue
        actual = sha256(path)
        print(f"    documento . {d['doc_id']} — {d['titulo']}")
        print(f"    producto .. {d['producto']}")
        print(f"    emisor .... {d['emisor']}, {d['empresa']}")
        print(f"    emitido ... {d['emitido']}")
        print(f"    estado .... {d['estado']}")
        if actual == d["sha256"]:
            print("    integridad. OK — el archivo es identico al que se emitio")
        else:
            print("    integridad. NO COINCIDE — el archivo fue modificado despues de emitido")
            print(f"                emitido: {d['sha256']}")
            print(f"                actual:  {actual}")
            salida = 1
        if d["estado"] != "vigente":
            salida = 1
    return salida


# ======================================================================================
# registro
# ======================================================================================
SQL = """-- Tabla de verificacion para cuando el registro pase de archivo a Supabase.
create table if not exists documentos_verificacion (
  token          text primary key,
  doc_id         text not null,
  tipo           text not null,
  numero         text not null,
  revision       text not null,
  titulo         text,
  producto       text,
  emisor         text,
  empresa        text not null default 'Barack Mercosul S.R.L.',
  emitido        timestamptz not null default now(),
  archivo        text,
  sha256         text not null,
  estado         text not null default 'vigente'
                 check (estado in ('vigente','anulado','reemplazado')),
  reemplazado_por text references documentos_verificacion(token)
);
-- La pagina de verificacion lee sin login; nadie escribe desde el navegador.
alter table documentos_verificacion enable row level security;
create policy "lectura publica" on documentos_verificacion for select using (true);
"""


def mostrar_registro(listar: bool, sql: bool) -> None:
    if sql:
        print(SQL)
        return
    reg = cargar_registro()["documentos"]
    print(f"\n{len(reg)} documentos en {os.path.relpath(REGISTRO, RAIZ)}")
    for token, d in reg.items():
        marca = "" if d["estado"] == "vigente" else f"  -> {d.get('reemplazado_por', '')}"
        print(f"  {token}  {d['doc_id']:<24} {d['estado']:<12} {d['emitido'][:10]}  "
              f"{d['titulo']}{marca}")


def anular(token: str, estado: str, reemplazado_por: str | None) -> int:
    """Un documento superado no puede seguir verificando 'vigente': la copia vieja sigue
    circulando y el QR es el mismo. Se marca aca, y con el push deja de dar verde."""
    token = token.strip().upper()
    reg = cargar_registro()
    d = reg["documentos"].get(token)
    if not d:
        print(f"El token {token} no figura en el registro.")
        return 1
    if reemplazado_por:
        nuevo = reemplazado_por.strip().upper()
        if nuevo not in reg["documentos"]:
            print(f"El token de reemplazo {nuevo} no figura en el registro: sella primero el "
                  f"documento nuevo.")
            return 1
        d["reemplazado_por"] = nuevo
    d["estado"] = estado
    guardar_registro(reg)
    print(f"\n{token} — {d['doc_id']} quedo como '{estado}'"
          + (f", reemplazado por {d['reemplazado_por']}" if d.get("reemplazado_por") else ""))
    print("  Pushea para que la pagina lo refleje.")
    return 0


# ======================================================================================
# selftest — el ciclo entero sobre un PDF que se fabrica y se tira, sin tocar el registro
# ======================================================================================
def selftest() -> int:
    import tempfile
    global REGISTRO, ARCHIVO_CLAVE
    reg_real, clave_real = REGISTRO, ARCHIVO_CLAVE
    tmp = tempfile.mkdtemp(prefix="qrtest_")
    REGISTRO = os.path.join(tmp, "registro.json")
    # Tambien la clave: en un clon fresco, correr el selftest generaba y escribia la clave
    # REAL del repo como efecto colateral. Un test no crea la clave de produccion.
    ARCHIVO_CLAVE = os.path.join(tmp, "clave")
    ok = fallas = 0

    def caso(nombre, cond):
        nonlocal ok, fallas
        if cond:
            ok += 1
            print(f"  ok   {nombre}")
        else:
            fallas += 1
            print(f"  FALLA {nombre}")

    try:
        base = os.path.join(tmp, "doc.pdf")
        d = fitz.open()
        p = d.new_page(width=595.28, height=841.89)
        p.insert_text((60, 90), "Documento de prueba de Barack", fontsize=14)
        d.save(base)
        d.close()

        r = sellar(base, {"tipo": "TEST", "numero": "1", "rev": "0", "titulo": "prueba",
                          "producto": "", "emisor": "Ingenieria"},
                   os.path.join(tmp, "sellado.pdf"), 1)
        sellado = os.path.join(tmp, "sellado.pdf")

        qrs = analizar_silencioso(sellado)
        caso("el sellado tiene exactamente un QR", len(qrs) == 1)
        caso("el QR apunta a nuestra URL", qrs and qrs[0]["payload"].startswith(URL_BASE))
        # El bug que se comio el nombre del archivo: el token se saca por largo de URL_BASE,
        # nunca por "lo que va despues de la ultima barra".
        token = qrs[0]["payload"][len(URL_BASE):]
        caso("el token sale limpio de la URL", re.fullmatch(r"[0-9A-F]{%d}" % (TOKEN_BYTES * 2), token))
        caso("el token del QR es el del registro", token in cargar_registro()["documentos"])
        caso("correccion de error Q", qrs and qrs[0].get("ecc") == "Q")
        caso("quiet zone >= 4 modulos", qrs and qrs[0].get("quiet_modulos", 0) >= 4)
        caso("mide 26,46 mm", qrs and abs(qrs[0]["lado_mm"] - LADO_MM) < 0.1)
        caso("verificar un sellado intacto da 0", verificar(sellado) == 0)

        alterado = os.path.join(tmp, "alterado.pdf")
        d = fitz.open(sellado)
        d[0].insert_text((60, 200), "linea agregada despues de emitir", fontsize=9)
        d.save(alterado)
        d.close()
        caso("verificar un sellado alterado da 1", verificar(alterado) == 1)

        sin_sellar = os.path.join(tmp, "pelado.pdf")
        d = fitz.open()
        d.new_page()
        d.save(sin_sellar)
        d.close()
        caso("verificar un PDF sin QR da 1", verificar(sin_sellar) == 1)

        # sellar sobre un papel con QR de otro emisor: aborta
        ajeno = os.path.join(tmp, "ajeno.pdf")
        d = fitz.open()
        pg = d.new_page(width=595.28, height=841.89)
        png, _ = hacer_qr_png("http://lims.otro-emisor.example/#/ReportQRQuery/AB12", 26.46, 200)
        pg.insert_image(fitz.Rect(400, 600, 475, 675), stream=png)
        d.save(ajeno)
        d.close()
        try:
            sellar(ajeno, {"tipo": "TEST", "numero": "2", "rev": "0", "titulo": "",
                           "producto": "", "emisor": "Ingenieria"}, None, 1)
            caso("sellar un papel ajeno aborta", False)
        except SystemExit as e:
            caso("sellar un papel ajeno aborta con codigo 2", e.code == 2)

        # El registro se sirve por HTTP y ademas vive en un repo publico: no alcanza con
        # "filtrar al publicar", no puede existir un campo que no querriamos que se lea.
        guardado = json.load(open(REGISTRO, encoding="utf-8"))["documentos"][token]
        caso("el registro no guarda el hash previo al sello", "sha256_sin_qr" not in guardado)
        caso("el registro no tiene ningun campo fuera de los declarados",
             not (set(guardado) - set(CAMPOS)))
        caso("el token es determinista",
             calcular_token(r["doc_id"], r["_sha256_sin_qr"]) == token)

        # Un documento superado no puede seguir verificando vigente.
        resellado = os.path.join(tmp, "resellado.pdf")
        r2 = sellar(sellado, {"tipo": "TEST", "numero": "1", "rev": "1", "titulo": "prueba rev1",
                              "producto": "", "emisor": "Ingenieria"}, resellado, 1, forzar=True)
        docs = cargar_registro()["documentos"]
        caso("re-sellar marca la version anterior como reemplazada",
             docs[token]["estado"] == "reemplazado")
        caso("y deja apuntado cual la reemplaza",
             docs[token].get("reemplazado_por") == r2["url"][len(URL_BASE):])
        caso("el PDF viejo ya no verifica vigente", verificar(sellado) == 1)

        caso("anular un token inexistente da 1", anular("F" * (TOKEN_BYTES * 2), "anulado", None) == 1)
        nuevo = r2["url"][len(URL_BASE):]
        caso("anular un token existente da 0", anular(nuevo, "anulado", None) == 0)
        caso("y el anulado no verifica vigente", verificar(resellado) == 1)

        # Un nombre que no termina en .pdf no puede hacer que se guarde sobre si mismo.
        raro = os.path.join(tmp, "sin_extension")
        d = fitz.open()
        d.new_page()
        d.save(raro)
        d.close()
        antes = sha256(raro)
        sellar(raro, {"tipo": "TEST", "numero": "3", "rev": "0", "titulo": "",
                      "producto": "", "emisor": "Ingenieria"}, None, 1)
        caso("sellar no pisa el archivo de entrada", sha256(raro) == antes)
    finally:
        REGISTRO, ARCHIVO_CLAVE = reg_real, clave_real

    print(f"\nok={ok}  fallas={fallas}")
    return 1 if fallas else 0


# ======================================================================================
def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)

    a = sub.add_parser("analizar", help="medir los QR de un PDF (solo lectura)")
    a.add_argument("pdf")
    a.add_argument("--json", action="store_true")

    s = sub.add_parser("sellar", help="poner el QR de verificacion en un PDF propio")
    s.add_argument("pdf")
    s.add_argument("--tipo", required=True, help="AMFE, PC, HO, IT, INFORME...")
    s.add_argument("--numero", required=True)
    s.add_argument("--rev", required=True)
    s.add_argument("--titulo", default="")
    s.add_argument("--producto", default="")
    s.add_argument("--emisor", default="Ingenieria")
    s.add_argument("--pagina", type=int, default=1)
    s.add_argument("--salida", default=None)
    s.add_argument("--forzar", action="store_true",
                   help="solo para re-sellar un documento NUESTRO que ya tiene QR")

    v = sub.add_parser("verificar", help="comprobar un PDF sellado contra el registro")
    v.add_argument("pdf")

    sub.add_parser("selftest", help="probar el ciclo entero sin tocar el registro real")

    n = sub.add_parser("anular", help="marcar un documento como anulado o reemplazado")
    n.add_argument("token")
    n.add_argument("--estado", choices=("anulado", "reemplazado", "vigente"),
                   default="anulado")
    n.add_argument("--reemplazado-por", default=None,
                   help="token del documento que lo reemplaza (tiene que estar sellado)")

    r = sub.add_parser("registro", help="ver el registro de documentos emitidos")
    r.add_argument("--listar", action="store_true")
    r.add_argument("--sql", action="store_true")

    args = ap.parse_args()

    if args.cmd == "analizar":
        analizar(args.pdf, args.json)
        return 0
    if args.cmd == "sellar":
        sellar(args.pdf, {"tipo": args.tipo, "numero": args.numero, "rev": args.rev,
                          "titulo": args.titulo, "producto": args.producto,
                          "emisor": args.emisor},
               args.salida, args.pagina, args.forzar)
        return 0
    if args.cmd == "verificar":
        return verificar(args.pdf)
    if args.cmd == "selftest":
        return selftest()
    if args.cmd == "anular":
        return anular(args.token, args.estado, args.reemplazado_por)
    if args.cmd == "registro":
        mostrar_registro(args.listar, args.sql)
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())
