"""
_swapAdjuntosBorrador.py — cambia adjuntos puntuales de un borrador de Outlook SIN tocar el cuerpo.

POR QUE EXISTE
Un adjunto de un mail sin enviar envejece solo: el archivo se regenera, el mail sigue con el
viejo, y los dos se llaman igual (leccion del 22/08/2026 — 7 de 8 PDF subdeclaraban el AP).
`_prepararMail.py` crea un mail nuevo; aca el borrador YA existe y su cuerpo lo reescribio
Fak a mano, asi que recrearlo perderia ese texto. Esto cambia solo los adjuntos nombrados.

ESTE SCRIPT NO TRANSMITE NADA. Solo `.Save()` y, con --mostrar, `.Display()`. El unico
camino para transmitir es `scripts/_mailEnviar.py`, que tiene el gate anti-duplicado
(regla `mail-envio.md`).

Uso:
  python scripts/_swapAdjuntosBorrador.py --asunto "<parte del asunto>" \
      --archivo "C:\\ruta\\AMFE 151 ... .pdf" --archivo "C:\\ruta\\AMFE 153 ... .pdf"
  ...agregar --apply para escribir, y --mostrar para abrir la ventana al final.

El match es por NOMBRE DE ARCHIVO: cada --archivo reemplaza al adjunto que se llame igual.
Si el nombre no esta entre los adjuntos actuales, aborta (no agrega adjuntos nuevos por error).
"""
import argparse
import os
import sys

try:
    import win32com.client as win32
except ImportError:
    sys.exit('ERROR: falta pywin32 (win32com). No se puede hablar con Outlook.')

OL_FOLDER_DRAFTS = 16


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--asunto', required=True, help='substring del asunto del borrador')
    ap.add_argument('--archivo', action='append', required=True, help='ruta del archivo nuevo (repetible)')
    ap.add_argument('--apply', action='store_true', help='sin esto es dry-run')
    ap.add_argument('--mostrar', action='store_true', help='abrir la ventana del borrador al terminar')
    args = ap.parse_args()

    faltan = [a for a in args.archivo if not os.path.exists(a)]
    if faltan:
        print('ABORTADO: no existen estos archivos:')
        for f in faltan:
            print(f'   {f}')
        sys.exit(1)

    ns = win32.Dispatch('Outlook.Application').GetNamespace('MAPI')
    borradores = ns.GetDefaultFolder(OL_FOLDER_DRAFTS)

    candidatos = [m for m in borradores.Items if args.asunto.lower() in str(m.Subject or '').lower()]
    if not candidatos:
        sys.exit(f'ABORTADO: ningun borrador con "{args.asunto}" en el asunto.')
    if len(candidatos) > 1:
        print(f'ABORTADO: {len(candidatos)} borradores matchean "{args.asunto}":')
        for m in candidatos:
            print(f'   [{m.ReceivedTime}] {m.Subject}')
        sys.exit(1)

    mail = candidatos[0]
    actuales = {att.FileName: att.Size for att in mail.Attachments}
    print(f'\nBorrador: "{mail.Subject}"')
    print(f'Adjuntos hoy ({len(actuales)}): {", ".join(sorted(actuales))}\n')

    plan = []
    for ruta in args.archivo:
        nombre = os.path.basename(ruta)
        if nombre not in actuales:
            print(f'ABORTADO: "{nombre}" no esta entre los adjuntos actuales.')
            print('          Este script REEMPLAZA, no agrega. Revisar el nombre.')
            sys.exit(1)
        plan.append((nombre, ruta, actuales[nombre], os.path.getsize(ruta)))
        print(f'  {nombre}')
        print(f'     en el mail: {actuales[nombre]:>9,} b   ->   archivo nuevo: {os.path.getsize(ruta):>9,} b')

    intactos = sorted(set(actuales) - {n for n, *_ in plan})
    print(f'\n  SIN TOCAR ({len(intactos)}): {", ".join(intactos)}')
    print('  El CUERPO del mail no se toca.')

    if not args.apply:
        print('\n-> Dry-run: no se modifico nada. Agregar --apply.')
        return

    for nombre, ruta, _, _ in plan:
        # Borrar por indice descendente para no correr la coleccion mientras se itera.
        for i in range(mail.Attachments.Count, 0, -1):
            if mail.Attachments.Item(i).FileName == nombre:
                mail.Attachments.Item(i).Delete()
        mail.Attachments.Add(ruta)
    mail.Save()

    # Releer del propio Outlook: la verdad es lo que quedo guardado.
    final = {att.FileName: att.Size for att in mail.Attachments}
    print(f'\n  Adjuntos despues ({len(final)}):')
    ok = True
    for nombre, ruta, _, nuevo in plan:
        real = final.get(nombre)
        # Outlook agrega overhead de codificacion, asi que se compara con tolerancia.
        bien = real is not None and abs(real - nuevo) < max(4096, nuevo * 0.05)
        ok = ok and bien
        print(f'     {"OK " if bien else "MAL"} {nombre}: {real:,} b (archivo {nuevo:,} b)')
    for nombre in intactos:
        print(f'     ==  {nombre}: {final.get(nombre, 0):,} b (intacto)')
    if len(final) != len(actuales):
        print(f'\n  ATENCION: eran {len(actuales)} adjuntos y quedaron {len(final)}.')
        ok = False
    if not ok:
        sys.exit(1)

    if args.mostrar:
        mail.Display()
    print('\n  Listo. El mail sigue en Borradores, sin transmitir.')


if __name__ == '__main__':
    main()
