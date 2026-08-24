"""
_prepararMail.py — deja un mail ABIERTO en Outlook, listo para que Fak apriete Enviar.

Por que existe: dejar el cuerpo en un `.txt` no es dejar el mail listo. Obliga a abrir
Outlook, crear el mensaje, pegar, resolver destinatarios y adjuntar los archivos a mano.
"Listo para enviar" es que aparezca la ventana con todo puesto (memoria
`dejar_el_mail_listo_para_enviar`, 18/08/2026).

NUNCA hace `.Send()` — solo `.Display()`. Enviar es decision de Fak y tiene su propio
camino con gate anti-duplicado: `scripts/_mailEnviar.py` (regla `mail-envio.md`).

La firma NO se escribe en el cuerpo: Outlook agrega la suya al crear el mensaje. El 14/08
el mail salio con la firma duplicada, una tipeada y otra de Outlook.

Uso:  python scripts/_prepararMail.py <archivo.json>

El JSON:
  {
    "para": ["Marcelo Nieve"],
    "cc": ["Carlos Baptista"],
    "asunto": "...",
    "cuerpo": "texto plano, sin firma",
    "adjuntos": ["C:\\ruta\\uno.pdf", "..."]
  }

Opcional: en vez de "cuerpo" se puede pasar "cuerpo_html" con HTML ya armado, que va SIN
escapar. Sirve para mandar una tabla de verdad (<table>): con "cuerpo" los < y > se escapan
y los tags se verian como texto. La firma se sigue agregando abajo, igual que siempre.
"""
import json
import os
import sys

try:
    import win32com.client as win32
except ImportError:
    sys.exit('ERROR: falta pywin32 (win32com). No se puede hablar con Outlook.')


def preparar(cfg):
    faltan = [a for a in cfg.get('adjuntos', []) if not os.path.exists(a)]
    if faltan:
        print('ABORTADO: estos adjuntos no existen:')
        for f in faltan:
            print(f'  - {f}')
        sys.exit(1)

    ol = win32.Dispatch('Outlook.Application')
    mail = ol.CreateItem(0)  # olMailItem

    # Resolver cada destinatario contra la libreta ANTES de mostrar el mail: si un nombre
    # no resuelve, es mejor saberlo aca que descubrirlo al apretar Enviar.
    ns = ol.GetNamespace('MAPI')
    sin_resolver = []
    for nombre in cfg.get('para', []) + cfg.get('cc', []):
        r = ns.CreateRecipient(nombre)
        r.Resolve()
        if not r.Resolved:
            sin_resolver.append(nombre)
    if sin_resolver:
        print('ABORTADO: Outlook no resuelve estos destinatarios:')
        for n in sin_resolver:
            print(f'  - {n}')
        sys.exit(1)

    mail.To = '; '.join(cfg.get('para', []))
    if cfg.get('cc'):
        mail.CC = '; '.join(cfg['cc'])
    mail.Subject = cfg['asunto']

    # GetInspector fuerza a Outlook a cargar la firma en el HTML del cuerpo; el texto se
    # antepone para que la firma quede debajo, como en un mail escrito a mano.
    mail.GetInspector
    firma = mail.HTMLBody or ''
    if cfg.get('cuerpo_html'):
        # Cuerpo ya escrito en HTML: va TAL CUAL, sin escapar. Es la unica forma de mandar una
        # tabla de verdad — Calibri es proporcional y una "tabla" alineada con espacios sale
        # torcida. Quien usa esta clave se hace cargo de que el HTML este bien formado.
        cuerpo = cfg['cuerpo_html']
    else:
        cuerpo = cfg['cuerpo'].replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
        cuerpo = cuerpo.replace(chr(10), '<br>')
    mail.HTMLBody = f'<div style="font-family:Calibri,sans-serif;font-size:11pt">{cuerpo}</div>{firma}'

    for a in cfg.get('adjuntos', []):
        mail.Attachments.Add(a)

    # Save() antes de Display(): la ventana abierta sola no sobrevive a cerrar Outlook.
    # Guardado en Borradores, el mail sigue ahi mañana. NUNCA Send(): eso lo decide Fak.
    mail.Save()
    mail.Display()

    print('Mail abierto en Outlook Y guardado en Borradores (sin enviar).')
    print(f'  Para:     {mail.To}')
    print(f'  CC:       {mail.CC}')
    print(f'  Asunto:   {mail.Subject}')
    print(f'  Adjuntos: {mail.Attachments.Count}')
    for i in range(1, mail.Attachments.Count + 1):
        print(f'     - {mail.Attachments.Item(i).FileName}')


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit('Uso: python scripts/_prepararMail.py <archivo.json>')
    with open(sys.argv[1], encoding='utf-8') as fh:
        preparar(json.load(fh))
