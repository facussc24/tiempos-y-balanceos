"""
armar_D.py — toma los PDF de trabajo de D_aire (exports/flujogramas_a3_propuestas/D_aire_trabajo)
y arma la carpeta exports/flujogramas_a3_propuestas/D_aire:
  * un PDF por flujograma con el tamano EXACTO de la A3 (297 x 420 o 420 x 297 mm por hoja) y el nombre
    "FLUJOGRAMA <numero> - <producto> - Rev.<letra> - A3.pdf" (la revision sale del header del JSON);
  * FLUJOGRAMAS_A3_AIRE_PARA_IMPRIMIR.pdf con los 8 juntos.
"""
import json, os, subprocess, sys
import fitz

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, '..', '..', '..', '..'))
TRABAJO = os.path.join(RAIZ, 'exports', 'flujogramas_a3_propuestas', 'D_aire_trabajo')
FINAL = os.path.join(RAIZ, 'exports', 'flujogramas_a3_propuestas', 'D_aire')
os.makedirs(FINAL, exist_ok=True)

ORDEN = ['158-INSONOS-DUCTOS', '155-TOP-ROLL', '153-ARMREST-DOOR-PANEL', '154-INSERT',
         '157-IP-PAD', '160-UPPER-TRIM-PANEL', '152-APOYACABEZAS', '151-APB-TRASERO-CENTRAL']

A3W, A3H = 841.8898, 1190.5512   # 297 x 420 mm en pt
salidas = []
for clave in ORDEN:
    datos = json.loads(subprocess.run(['git', 'show', f'HEAD:tools/flowchart/data/{clave}.json'], cwd=RAIZ,
                                      capture_output=True, check=True).stdout.decode('utf8'))
    numero, producto = clave.split('-', 1)
    producto = producto.replace('-', ' ')
    rev = datos['header']['revision']
    nombre = f'FLUJOGRAMA {numero} - {producto} - Rev.{rev} - A3.pdf'
    src = os.path.join(TRABAJO, f'FLUJOGRAMA_{clave}_A3.pdf')
    if not os.path.exists(src):
        print(f'FALTA {src}')
        continue
    d = fitz.open(src)
    for p in d:
        horizontal = p.rect.width > p.rect.height
        p.set_mediabox(fitz.Rect(0, 0, A3H if horizontal else A3W, A3W if horizontal else A3H))
    d.set_metadata({'title': f'FLUJOGRAMA {numero} - {producto} - Rev.{rev} (AIRE)', 'author': 'Facundo Santoro',
                    'subject': datos['header'].get('title', ''), 'keywords': 'I-IN-002/III A3'})
    dst = os.path.join(FINAL, nombre)
    d.save(dst, garbage=4, deflate=True)
    n_pags = len(d)
    d.close()
    salidas.append((clave, nombre, dst, n_pags))
    print(f'ok {nombre} ({n_pags} pag{"s" if n_pags > 1 else ""}) {round(os.path.getsize(dst) / 1024)} KB')

junto = fitz.open()
toc = []
for clave, nombre, dst, n_pags in salidas:
    s = fitz.open(dst)
    start_pag = len(junto) + 1
    junto.insert_pdf(s)
    toc.append([1, nombre.replace(' - A3.pdf', ''), start_pag])
    s.close()
junto.set_toc(toc)
junto.set_metadata({'title': 'Flujogramas A3 con Aire para imprimir (158, 155, 153, 154, 157, 160, 152, 151)', 'author': 'Facundo Santoro'})
out = os.path.join(FINAL, 'FLUJOGRAMAS_A3_AIRE_PARA_IMPRIMIR.pdf')
junto.save(out, garbage=4, deflate=True)
print('junto', out, len(junto), 'paginas', round(os.path.getsize(out) / 1024), 'KB')
