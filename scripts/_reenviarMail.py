# -*- coding: utf-8 -*-
"""Reenviar (Forward) un mail que YA se envio, agregando destinatarios.

    python scripts/_reenviarMail.py <config.json>

El JSON:
  {
    "entryid": "<EntryID del mail en Elementos enviados>",
    "para": ["Nombre Uno", "..."],
    "cc": ["..."],
    "encabezado": "una o dos lineas que van ARRIBA del mail reenviado"
  }

El EntryID sale de `scripts/_mails.py --buscar <asunto>`.

Por que un Forward y no un mail nuevo: el reenvio deja a la vista el mail original con su
fecha y sus destinatarios, asi que el que lo recibe ve que la difusion ya habia salido y a
quienes. Un mail nuevo lo oculta.

ESTE SCRIPT NO TRANSMITE NADA: solo `.Save()` y `.Display()`. El unico camino para que un
mail salga es `scripts/_mailEnviar.py`, con su gate anti-duplicado (regla `mail-envio.md`).
Y el mail ORIGINAL no se toca: un mail que Fak ya mando se reenvia, no se edita.

La firma no se escribe a mano: Outlook la agrega al mostrar el mensaje, y escribir el
`HTMLBody` de una la pisaria (memoria `dejar_el_mail_listo_para_enviar`).
"""
import json
import sys
import time

try:
    import win32com.client as win32
except ImportError:
    sys.exit('ERROR: falta pywin32 (win32com). No se puede hablar con Outlook.')


def reenviar(cfg):
    ol = win32.Dispatch('Outlook.Application')
    ns = ol.GetNamespace('MAPI')

    try:
        original = ns.GetItemFromID(cfg['entryid'])
    except Exception as e:
        sys.exit('no pude abrir el mail original con ese EntryID: %s' % e)
    print('original: %s  |  %s  |  para: %s'
          % (original.Subject, original.SentOn, original.To))

    # Resolver los destinatarios ANTES de armar nada: si uno no resuelve, mejor saberlo aca
    # que descubrirlo al apretar Enviar.
    sin_resolver = []
    for nombre in cfg.get('para', []) + cfg.get('cc', []):
        r = ns.CreateRecipient(nombre)
        r.Resolve()
        if not r.Resolved:
            sin_resolver.append(nombre)
    if sin_resolver:
        sys.exit('ABORTADO: estos destinatarios no resuelven en la libreta: %s'
                 % '; '.join(sin_resolver))

    fw = original.Forward()
    if cfg.get('para'):
        fw.To = '; '.join(cfg['para'])
    if cfg.get('cc'):
        fw.CC = '; '.join(cfg['cc'])

    # Display PRIMERO: ahi Outlook inserta la firma. Recien despues se mete el encabezado
    # arriba del <body>, sin tocar lo que ya esta.
    fw.Display()
    time.sleep(1.5)
    enc = (cfg.get('encabezado') or '').strip()
    if enc:
        html = fw.HTMLBody or ''
        bloque = ''.join(
            '<p style="font-family:Calibri,sans-serif;font-size:11pt;margin:0 0 6pt 0;">%s</p>'
            % linea for linea in enc.split('\n'))
        i = html.lower().find('<body')
        j = html.find('>', i) + 1 if i >= 0 else 0
        fw.HTMLBody = html[:j] + bloque + html[j:]
    fw.Save()

    h = fw.HTMLBody or ''
    print('\nReenvio abierto en Outlook y guardado en Borradores (sin transmitir).')
    print('  Para:     %s' % fw.To)
    print('  CC:       %s' % fw.CC)
    print('  Asunto:   %s' % fw.Subject)
    print('  Adjuntos: %d' % fw.Attachments.Count)
    for i in range(1, fw.Attachments.Count + 1):
        a = fw.Attachments.Item(i)
        print('     - %-45s %8.1f KB' % (a.FileName, a.Size / 1024.0))
    print('  Firma:    %s' % ('OK' if 'Santoro' in h else 'NO LA VEO — mirar antes de enviar'))


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    with open(sys.argv[1], encoding='utf-8') as fh:
        reenviar(json.load(fh))
