"""
medir_todos.py [--sin-D] [--sets original,B,D] — corre medir_aire.py sobre los 8 flujogramas en sus tres versiones
(original escalado a A3, B FINAL y D) y deja la tabla en D_aire/medidas_aire.json + un texto legible por stdout.
"""
import glob, json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import medir_aire as M

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, '..', '..', '..', '..'))
EXP = os.path.join(RAIZ, 'exports', 'flujogramas_a3_propuestas')
NUMS = ['151', '152', '153', '154', '155', '157', '158', '160']
sets = sys.argv[sys.argv.index('--sets') + 1].split(',') if '--sets' in sys.argv else ['original', 'B', 'D']


def buscar(set_, num):
    if set_ == 'original':
        r = glob.glob(os.path.join(EXP, 'D_aire_trabajo', 'original', f'FLUJOGRAMA_{num}-*_ORIGINAL_A3.pdf'))
    elif set_ == 'B':
        r = [f for f in glob.glob(os.path.join(EXP, 'FINAL', f'FLUJOGRAMA {num} - *.pdf'))]
    else:
        r = [f for f in glob.glob(os.path.join(EXP, 'D_aire', f'FLUJOGRAMA {num} - *.pdf'))]
    r = [f for f in r if 'PARA_IMPRIMIR' not in f]
    return r[0] if r else None


salida = {}
for num in NUMS:
    for s in sets:
        pdf = buscar(s, num)
        if not pdf:
            continue
        pags = M.medir(pdf)
        salida.setdefault(num, {})[s] = {'pdf': os.path.basename(pdf), 'resumen': M.resumen(pags), 'paginas': pags}
        r = salida[num][s]['resumen']
        print(f"{num} {s:8s} hojas {r['paginas']} | letra {r['letra_desc_pt']} pt (min {r['letra_min_pt']}) | fila: linea {r['fila_gap_mm_mediana']} mm mediana / {r['fila_gap_mm_min']} min = {r['fila_gap_em_mediana']} em | "
              f"columnas: hueco min {r['cols_gutter_mm_min']} mm, mediana {r['cols_gutter_mm_mediana']} mm | texto a linea (arriba/abajo/der min) {r['texto_arriba_min']}/{r['texto_abajo_min']}/{r['texto_derecha_min']} mm | margen {r['margen_min_mm']}", flush=True)
out = os.path.join(AQUI, 'medidas_aire.json' if sets == ['original', 'B', 'D'] else 'medidas_aire_' + '_'.join(sets) + '.json')
json.dump(salida, open(out, 'w', encoding='utf8'), ensure_ascii=False, indent=1)
print('->', out)
