"""
armar_final.py — toma los PDF finales de trabajo (render.mjs --sufijo _final) y arma la carpeta FINAL:
  * un PDF por flujograma con el tamano EXACTO de la A3 (297 x 420 o 420 x 297 mm) y el nombre
    "FLUJOGRAMA <numero> - <producto> - Rev.<letra> - A3.pdf" (la revision sale del header del JSON);
  * FLUJOGRAMAS_A3_PARA_IMPRIMIR.pdf con los 8 juntos en el orden 158, 155, 153, 154, 157, 160, 152, 151.
No escribe nada fuera de la carpeta FINAL. Los JSON se leen como estan commiteados (git show HEAD:).
"""
import json, os, subprocess, sys
import fitz

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, '..', '..', '..', '..'))
TRABAJO = os.path.join(RAIZ, 'exports', 'flujogramas_a3_propuestas', 'B_final_trabajo')
FINAL = os.path.join(RAIZ, 'exports', 'flujogramas_a3_propuestas', 'FINAL')
os.makedirs(FINAL, exist_ok=True)

ORDEN = ['158-INSONOS-DUCTOS', '155-TOP-ROLL', '153-ARMREST-DOOR-PANEL', '154-INSERT',
         '157-IP-PAD', '160-UPPER-TRIM-PANEL', '152-APOYACABEZAS', '151-APB-TRASERO-CENTRAL']
# sufijo del PDF de trabajo elegido por clave (B por defecto, C si no llego a 8 pt)
SUFIJO = {}
if len(sys.argv) > 1:
    for a in sys.argv[1:]:
        k, v = a.split('=')
        SUFIJO[k] = v

A3W, A3H = 841.8898, 1190.5512   # 297 x 420 mm en pt
salidas = []
for clave in ORDEN:
    datos = json.loads(subprocess.run(['git', 'show', f'HEAD:tools/flowchart/data/{clave}.json'], cwd=RAIZ,
                                      capture_output=True, check=True).stdout.decode('utf8'))
    numero, producto = clave.split('-', 1)
    producto = producto.replace('-', ' ')
    rev = datos['header']['revision']
    nombre = f'FLUJOGRAMA {numero} - {producto} - Rev.{rev} - A3.pdf'
    suf = SUFIJO.get(clave, '_final')
    src = os.path.join(TRABAJO, f'FLUJOGRAMA_{clave}{suf}_A3.pdf')
    d = fitz.open(src)
    if len(d) != 1:
        raise SystemExit(f'{clave}: el PDF de trabajo tiene {len(d)} paginas (se espera 1): {src}')
    p = d[0]
    horizontal = p.rect.width > p.rect.height
    p.set_mediabox(fitz.Rect(0, 0, A3H if horizontal else A3W, A3W if horizontal else A3H))
    d.set_metadata({'title': f'FLUJOGRAMA {numero} - {producto} - Rev.{rev}', 'author': 'Barack Mercosul - Ingenieria',
                    'subject': datos['header'].get('title', ''), 'keywords': 'I-IN-002/III A3'})
    dst = os.path.join(FINAL, nombre)
    d.save(dst, garbage=4, deflate=True)
    d.close()
    salidas.append((clave, nombre, dst))
    print('ok', nombre, round(os.path.getsize(dst) / 1024), 'KB', 'apaisada' if horizontal else 'vertical')

junto = fitz.open()
toc = []
for clave, nombre, dst in salidas:
    s = fitz.open(dst)
    junto.insert_pdf(s)
    toc.append([1, nombre.replace(' - A3.pdf', ''), len(junto)])
    s.close()
junto.set_toc(toc)
junto.set_metadata({'title': 'Flujogramas A3 para imprimir (158, 155, 153, 154, 157, 160, 152, 151)', 'author': 'Barack Mercosul - Ingenieria'})
out = os.path.join(FINAL, 'FLUJOGRAMAS_A3_PARA_IMPRIMIR.pdf')
junto.save(out, garbage=4, deflate=True)
print('junto', out, len(junto), 'paginas', round(os.path.getsize(out) / 1024), 'KB')
