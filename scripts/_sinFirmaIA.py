"""
_sinFirmaIA.py — revisa documentos y frena si alguno dice que lo hizo Claude o una IA.

Regla de Fak, 08/10/2026 (el listado de hojas de proceso decia "Claude" en CREADO POR y tenia una
pestaña oculta "_CONTEXTO_CLAUDE"): ningun documento de Barack nombra a Claude ni a una IA, ni en
lo que se ve ni en lo oculto (pestañas ocultas, notas, comentarios, propiedades del archivo).
La logica y las palabras: scripts/_lib/firmaIA.py + firmaIA.data.json.

Uso:
  python scripts/_sinFirmaIA.py <archivo o carpeta> [...]       # sale 1 si hay algo BLOQUEANTE
  python scripts/_sinFirmaIA.py <carpeta> --desde 2026-03-01   # solo lo modificado desde esa fecha
  python scripts/_sinFirmaIA.py <...> --json                   # salida para otro programa
  python scripts/_sinFirmaIA.py <...> --sin-avisos              # solo lo que frena
  python scripts/_sinFirmaIA.py <...> --logo-bloquea            # el logo NO oficial frena (listo para el cierre del turno si Fak
                                                                 decide que el formulario de HO pasa al oficial; hoy es aviso)
  python scripts/_sinFirmaIA.py <...> --incluir-nube            # tambien los de OneDrive "solo en la nube" (los baja)
  python scripts/_sinFirmaIA.py --selftest
  python scripts/_sinFirmaIA.py --arreglar <archivos o carpetas> [--apply]
        saca la marca del complemento "Claude para Excel/PowerPoint" y limpia las propiedades del
        archivo (autor = libreria, "generated using python-pptx"). Sin --apply solo dice que haria.
        Lo que este en el CONTENIDO (una celda, una diapositiva) no lo toca: se arregla a mano.
"""
import argparse
import datetime as dt
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '_lib'))
import firmaIA  # noqa: E402


def main() -> int:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('rutas', nargs='*')
    ap.add_argument('--desde', help='AAAA-MM-DD: solo archivos modificados desde esa fecha')
    ap.add_argument('--json', action='store_true')
    ap.add_argument('--sin-avisos', action='store_true')
    ap.add_argument('--incluir-nube', action='store_true')
    ap.add_argument('--logo-bloquea', action='store_true')
    ap.add_argument('--max-mb', type=float, default=60)
    ap.add_argument('--selftest', action='store_true')
    ap.add_argument('--arreglar', action='store_true')
    ap.add_argument('--apply', action='store_true')
    a = ap.parse_args()
    if a.selftest:
        import firmaIASelftest
        return firmaIASelftest.correr()
    if not a.rutas:
        ap.error('falta al menos una ruta')
    if a.arreglar:
        return arreglar(a.rutas, a.apply)
    desde = dt.datetime.strptime(a.desde, '%Y-%m-%d').timestamp() if a.desde else None
    hs, n, nube = firmaIA.revisar(a.rutas, desde, a.incluir_nube, a.max_mb, not a.sin_avisos, logo_bloquea=a.logo_bloquea)
    bloq = [h for h in hs if h.nivel == 'BLOQUEANTE']
    if a.json:
        print(firmaIA.a_json(hs))
    else:
        for h in hs:
            print(h.renglon())
        print(f'\nrevisados: {n} · bloqueantes: {len(bloq)} · avisos: {len(hs) - len(bloq)}'
              + (f' · sin revisar (solo en la nube): {len(nube)}' if nube else ''))
        for p in nube[:20]:
            print(f'  [NUBE] {p}')
    return 1 if bloq else 0


def arreglar(rutas, aplicar: bool) -> int:
    import shutil
    import tempfile
    pendientes = 0
    for p, _ in firmaIA.recorrer(rutas, incluir_nube=False):
        if os.path.splitext(p)[1].lower() not in firmaIA.OOXML:
            continue
        lock = os.path.join(os.path.dirname(p), '~$' + os.path.basename(p)[2:])
        if os.path.exists(os.path.join(os.path.dirname(p), '~$' + os.path.basename(p))) or os.path.exists(lock):
            print(f'  [ABIERTO] {p}: alguien lo tiene abierto, no se toca')
            pendientes += 1
            continue
        antes = [h for h in firmaIA.revisar_archivo(p) if h.nivel == 'BLOQUEANTE']
        if not antes:
            continue
        # se prueba sobre una copia: lo que diga la copia es lo que va a pasar
        with tempfile.TemporaryDirectory() as td:
            c = os.path.join(td, os.path.basename(p))
            shutil.copy2(p, c)
            try:
                hecho = firmaIA.quitar_complemento_claude(c) + firmaIA.limpiar_propiedades(c)
            except RuntimeError as e:
                print(f'  [A MANO] {p}: {e}')
                pendientes += 1
                continue
            queda = [h for h in firmaIA.revisar_archivo(c) if h.nivel == 'BLOQUEANTE']
            if hecho and aplicar:
                firmaIA.quitar_complemento_claude(p)
                firmaIA.limpiar_propiedades(p)
                queda = [h for h in firmaIA.revisar_archivo(p) if h.nivel == 'BLOQUEANTE']
        print(f'  [{"ARREGLADO" if aplicar and hecho else "ARREGLARIA" if hecho else "A MANO"}] {p}')
        for x in hecho:
            print(f'      - {x}')
        for h in queda:
            print(f'      queda: {h.lugar}: «{h.texto}»')
        pendientes += 1 if queda else 0
    print(f'\n{"aplicado" if aplicar else "dry-run (con --apply se escribe)"} · quedan a mano: {pendientes}')
    return 1 if pendientes else 0


if __name__ == '__main__':
    sys.exit(main())
