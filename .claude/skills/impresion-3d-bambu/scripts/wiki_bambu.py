"""Baja una pagina de la wiki oficial de Bambu Lab y la deja como texto (y, opcional, como captura).

Uso: wiki_bambu.py <ruta de la wiki, p. ej. en/filament-acc/acc/pei-plate-clean-guide> <carpeta> [--captura]
- <carpeta>/<nombre>.html y <nombre>.txt (el contenido de la pagina, sin menus).
- con --captura, <nombre>.png de la pagina real (Playwright + Chromium, el del repo).
WebFetch devuelve 402 con esta wiki; pedida con un navegador comun contesta bien (13/10/2026).
"""
import html
import json
import re
import subprocess
import sys
import urllib.request
from pathlib import Path

ruta, carpeta = sys.argv[1].strip("/"), Path(sys.argv[2])
carpeta.mkdir(parents=True, exist_ok=True)
url = "https://wiki.bambulab.com/" + ruta
nombre = ruta.split("/")[-1]
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"
crudo = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=40).read().decode("utf-8", "replace")
(carpeta / f"{nombre}.html").write_text(crudo, encoding="utf-8")

# Wiki.js: el contenido viene dentro de <template slot="contents"> ... </template>
m = re.search(r'<template slot="contents">(.*?)</template>', crudo, re.S)
cuerpo = m.group(1) if m else crudo
titulo = re.search(r"<title>(.*?)</title>", crudo, re.S)
cuerpo = re.sub(r"<(script|style)\b.*?</\1>", " ", cuerpo, flags=re.S)
cuerpo = re.sub(r"<img[^>]*alt=\"([^\"]*)\"[^>]*>", r" [imagen: \1] ", cuerpo)
cuerpo = re.sub(r"</(p|div|li|h[1-6]|tr|blockquote)>|<br\s*/?>", "\n", cuerpo)
cuerpo = re.sub(r"<h([1-6])[^>]*>", lambda k: "\n" + "#" * int(k.group(1)) + " ", cuerpo)
cuerpo = re.sub(r"<li[^>]*>", "- ", cuerpo)
texto = html.unescape(re.sub(r"<[^>]+>", "", cuerpo))
texto = re.sub(r"[ \t]+", " ", texto)
texto = re.sub(r"\n\s*\n+", "\n\n", texto).strip()
cab = (f"FUENTE: {url}\nTITULO: {html.unescape(titulo.group(1)).strip() if titulo else ''}\n"
       f"BAJADA: {__import__('time').strftime('%d/%m/%Y %H:%M')}\n"
       "COMO SE OBTUVO: pagina publica de la wiki oficial de Bambu Lab, pedida por la web. Es el texto del\n"
       "cuerpo de la pagina, en su idioma original y en su orden, sin los menus. Donde dice [imagen: ...]\n"
       "la pagina trae una imagen; la pagina completa esta en el .png del mismo nombre.\n\n")
(carpeta / f"{nombre}.txt").write_text(cab + texto, encoding="utf-8")
print(f"{nombre}: {len(texto)} caracteres de texto -> {carpeta / (nombre + '.txt')}")

if "--captura" in sys.argv:
    js = ("const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();"
          "const p=await b.newPage({viewport:{width:1280,height:900}});"
          f"await p.goto({json.dumps(url)},{{waitUntil:'domcontentloaded',timeout:60000}});"
          "await p.waitForTimeout(6000);"
          f"await p.screenshot({{path:{json.dumps(str(carpeta / (nombre + '.png')))},fullPage:true}});"
          "await b.close();})().catch(e=>{console.error(String(e).slice(0,300));process.exit(1)});")
    r = subprocess.run(["node", "-e", js], capture_output=True, text=True, cwd=r"C:\Dev\BarackMercosul", timeout=180)
    print("captura:", "ok" if r.returncode == 0 else "FALLO " + (r.stderr or r.stdout)[-200:])
