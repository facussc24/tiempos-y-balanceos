"""
verificar_junto.py — chequea FLUJOGRAMAS_A3_PARA_IMPRIMIR.pdf contra los 8 PDF individuales de la carpeta FINAL:
8 paginas, cada una A3 exacta, orden 158, 155, 153, 154, 157, 160, 152, 151, y el texto de cada pagina igual al del PDF suelto.
"""
import fitz, glob, os, re, sys

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, '..', '..', '..', '..'))
FINAL = os.path.join(RAIZ, 'exports', 'flujogramas_a3_propuestas', 'FINAL')
ORDEN = ['158', '155', '153', '154', '157', '160', '152', '151']
junto = fitz.open(os.path.join(FINAL, 'FLUJOGRAMAS_A3_PARA_IMPRIMIR.pdf'))
fallas = []
print('paginas', len(junto))
if len(junto) != 8: fallas.append('no son 8 paginas')
sueltos = {}
for f in glob.glob(os.path.join(FINAL, 'FLUJOGRAMA *.pdf')):
    num = re.match(r'FLUJOGRAMA (\d+) - ', os.path.basename(f)).group(1)
    sueltos[num] = f
if sorted(sueltos) != sorted(ORDEN): fallas.append(f'sueltos {sorted(sueltos)}')
norm = lambda s: re.sub(r'\s+', ' ', s).strip()
for i, num in enumerate(ORDEN):
    p = junto[i]
    w, h = p.rect.width / 72 * 25.4, p.rect.height / 72 * 25.4
    ok = (abs(w - 297) < 0.1 and abs(h - 420) < 0.1) or (abs(w - 420) < 0.1 and abs(h - 297) < 0.1)
    s = fitz.open(sueltos[num])
    igual = norm(p.get_text('text')) == norm(s[0].get_text('text'))
    print(i + 1, num, f'{w:.2f} x {h:.2f} mm', 'A3 exacta' if ok else 'NO ES A3', 'texto igual al suelto' if igual else 'TEXTO DISTINTO', os.path.basename(sueltos[num]))
    if not ok: fallas.append(f'pagina {i + 1} tamano')
    if not igual: fallas.append(f'pagina {i + 1} texto')
print('indice del PDF:', [t[1] for t in junto.get_toc()])
print('FALLAS' if fallas else 'OK', fallas)
sys.exit(1 if fallas else 0)
