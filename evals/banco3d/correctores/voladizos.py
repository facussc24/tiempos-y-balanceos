"""Corrector 'voladizos': envoltorio fino de chequeo_voladizos2.py (copia byte a byte del control del 22/10; no se edita).
Lo llama con el mismo Python, lee su linea 'OJO'/'OK ' y la pasa al formato del banco.

Uso: python voladizos.py <archivo.stl> [--dada-vuelta]
Imprime UNA linea JSON {"corrector", "veredicto", "detalle", "medidas"} y sale con 0 (verde), 3 (rojo), 2 (error).
--dada-vuelta: la pieza se imprime dada vuelta (agrega el sufijo |V que entiende chequeo_voladizos2.py)."""
import json, os, re, subprocess, sys

AQUI = os.path.dirname(os.path.abspath(__file__))


def salir(veredicto, detalle, medidas=None, codigo=None):
    print(json.dumps({'corrector': 'voladizos', 'veredicto': veredicto, 'detalle': detalle, 'medidas': medidas or {}},
                     ensure_ascii=True), flush=True)
    sys.exit(codigo if codigo is not None else {'verde': 0, 'rojo': 3}.get(veredicto, 2))


def main():
    args = sys.argv[1:]
    dada = '--dada-vuelta' in args
    archivos = [a for a in args if not a.startswith('--')]
    if len(archivos) != 1:
        salir('error', 'uso: voladizos.py <archivo.stl> [--dada-vuelta]')
    f = archivos[0]
    if not f.lower().endswith('.stl'):
        salir('error', f'chequeo_voladizos2.py trabaja sobre STL; llego {os.path.basename(f)}')
    if not os.path.exists(f):
        salir('error', f'no existe {f}')
    r = subprocess.run([sys.executable, '-I', os.path.join(AQUI, 'chequeo_voladizos2.py'), f + ('|V' if dada else '')],
                       capture_output=True, timeout=1800)
    salida = r.stdout.decode('utf-8', errors='replace').strip().splitlines()
    linea = salida[-1] if salida else ''
    if r.returncode != 0 or not (linea.startswith('OJO') or linea.startswith('OK ')):
        err = r.stderr.decode('utf-8', errors='replace').strip().splitlines()
        salir('error', f'chequeo_voladizos2.py salio con {r.returncode}: {(err[-1] if err else linea)[:300]}')
    m = re.search(r'puente mas largo\s+([\d.]+)\s*\|\s*voladizo mas largo\s+([\d.]+)', linea)
    medidas = {'puente_mas_largo_mm': float(m.group(1)), 'voladizo_mas_largo_mm': float(m.group(2))} if m else {}
    medidas['dada_vuelta'] = dada
    medidas['limites'] = {'puente_mm': 12.0, 'voladizo_mm': 2.0}
    if linea.startswith('OJO'):
        resto = linea.split('->', 1)[1].strip() if '->' in linea else ''
        salir('rojo', f'queda en el aire: {resto}'[:500], medidas)
    salir('verde', 'nada en el aire: puentes hasta 12 mm, voladizos hasta 2 mm', medidas)


if __name__ == '__main__':
    main()
