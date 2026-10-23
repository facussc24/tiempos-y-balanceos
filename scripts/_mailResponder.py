# -*- coding: utf-8 -*-
"""_mailResponder.py — arma la RESPUESTA A TODOS a un mail recibido, con adjuntos nuestros, y la deja
ABIERTA y guardada en Borradores. NO TRANSMITE NADA: solo .Save() y .Display(). El unico camino
para que salga es scripts/_mailEnviar.py, con su gate anti-duplicado (regla mail-envio.md).

    python scripts/_mailResponder.py <config.json>

El JSON:
  {
    "entryid": "<EntryID del mail recibido>",      (sale de scripts/_mails.py --buscar)
    "cuerpo": "texto, con \\n entre renglones",
    "adjuntos": ["Y:/.../uno.pdf", "..."],
    "cc_extra": ["Nombre", "..."],                 (opcional: suma copias a las del original)
    "reemplazar_borradores": false,                (opcional, ver abajo)
    "solo_remitente": false,                       (opcional: true = Responder, no Responder a todos)
    "imagenes": {"clave": "C:/.../foto.png"}       (opcional: un renglon del cuerpo que es exactamente
                                                    [[img:clave]] se reemplaza por esa foto DENTRO del mail)
  }

Fotos dentro del cuerpo (Fak, 23/10/2026: "pone las fotos directamente sobre el mail asi ni siquiera tienen que
abrir el power point"): cada foto va como adjunto oculto con su Content-ID y el cuerpo la muestra con
<img src="cid:...">, que es como Outlook guarda una imagen pegada.

Por que una respuesta y no un mail nuevo (PPAP del APB P21 hilo naranja, 23/09/2026): el mail
nuevo con "RE:" en el asunto no queda en la conversacion del cliente y no lleva abajo lo que el
pidio; y el que se armo con _prepararMail.py salio con el logo de la firma roto. ReplyAll trae la
conversacion, las copias del original y la firma completa.

Borradores repetidos: si ya hay en Borradores uno con el mismo asunto, ABORTA y los lista (el 23/09
quedaron tres iguales, dos sin adjuntos, y cualquiera podia salir). Con "reemplazar_borradores":
true los manda a Elementos eliminados antes de armar el nuevo (Delete() de COM mueve, no borra).
Mismo patron que scripts/_reenviarMail.py: Display primero para que Outlook ponga la firma, y
recien despues se escribe el texto arriba del <body>.
"""
import json, os, sys, time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _prepararMail import clave_asunto                                   # noqa: E402

try:
    import win32com.client as win32
except ImportError:
    sys.exit('ERROR: falta pywin32 (win32com). No se puede hablar con Outlook.')


def responder(cfg):
    sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '_lib'))
    from sinElevar import relanzar_si_elevado
    relanzar_si_elevado()   # como administrador no se habla con el Outlook de Fak: se repite sin elevar (sinElevar.py)
    ns = win32.Dispatch('Outlook.Application').GetNamespace('MAPI')
    for a in cfg.get('adjuntos', []):
        if not os.path.isfile(a):
            sys.exit(f'ABORTADO: no existe el adjunto {a}')
        if os.path.getsize(a) > 15 * 1024 * 1024:
            sys.exit(f'ABORTADO: {os.path.basename(a)} pesa {os.path.getsize(a) / 1e6:.0f} MB; Exchange lo rechaza '
                     '(el 23/09 un PDF de flujograma armado con PyMuPDF insert_image(filename=) pesaba 106 MB)')
    original = ns.GetItemFromID(cfg['entryid'])
    print('original:', original.Subject, '|', original.SentOn, '|', original.SenderName)

    # Se compara por clave_asunto (sin RE:/RV:): si el original ya es "RE: ...", Outlook no le suma
    # otro "RE:", y un 'RE: ' + Subject armado a mano no encontraba nunca el borrador repetido.
    clave = clave_asunto(original.Subject)
    drafts = ns.GetDefaultFolder(16)
    iguales = [it for it in list(drafts.Items) if clave_asunto(getattr(it, 'Subject', '')) == clave]
    if iguales and not cfg.get('reemplazar_borradores'):
        for it in iguales:
            print('   ya hay un borrador:', it.Subject, '|', it.LastModificationTime, '| adjuntos', it.Attachments.Count)
        sys.exit('ABORTADO: hay borradores con el mismo asunto. Con "reemplazar_borradores": true se mandan a Eliminados.')

    for nombre in cfg.get('cc_extra', []):
        r = ns.CreateRecipient(nombre)
        r.Resolve()
        if not r.Resolved:
            sys.exit(f'ABORTADO: "{nombre}" no resuelve en la libreta')

    # "solo_remitente": un mail del SQE a mucha gente (seguimiento de kick-off con 9 en copia) se
    # contesta SOLO a el cuando lo que va es una correccion nuestra (Fak, 23/09/2026: "respondele
    # solo a Capuana... con copia a Carlos").
    rp = original.Reply() if cfg.get('solo_remitente') else original.ReplyAll()
    for nombre in cfg.get('cc_extra', []):
        rp.Recipients.Add(nombre).Type = 2          # olCC; nunca como string en .CC (regla mail-envio.md)
    for a in cfg.get('adjuntos', []):
        rp.Attachments.Add(a)
    for clave, ruta in cfg.get('imagenes', {}).items():
        if not os.path.isfile(ruta):
            sys.exit(f'ABORTADO: no existe la imagen {ruta}')
        foto = rp.Attachments.Add(ruta, 1, 0)                       # 1 = olByValue
        foto.PropertyAccessor.SetProperty('http://schemas.microsoft.com/mapi/proptag/0x3712001F', clave)  # Content-ID
        foto.PropertyAccessor.SetProperty('http://schemas.microsoft.com/mapi/proptag/0x7FFE000B', True)  # oculto
    # El gerente va siempre, como minimo en copia (regla dura de Fak, 02/10/2026).
    # "sin_gerente": true lo saca, solo con el OK de Fak para ese mail.
    sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '_lib'))
    from gerenteCopia import asegurar_gerente
    asegurar_gerente(rp, cfg.get('sin_gerente', False))
    if not rp.Recipients.ResolveAll():
        sys.exit('ABORTADO: Outlook no pudo resolver todos los destinatarios')
    # Los repetidos van a Eliminados recien ahora, con la respuesta nueva ya armada: si algo de
    # arriba aborta, el borrador anterior sigue donde estaba.
    for it in iguales:
        print('a Elementos eliminados: borrador de', it.LastModificationTime, '| adjuntos', it.Attachments.Count)
        it.Delete()
    rp.Display()
    time.sleep(1.5)
    html = rp.HTMLBody or ''
    imagenes = cfg.get('imagenes', {})

    def renglon(linea):
        clave = linea.strip()[6:-2] if linea.strip().startswith('[[img:') and linea.strip().endswith(']]') else None
        if clave is not None:
            if clave not in imagenes:
                sys.exit(f'ABORTADO: el cuerpo pide la imagen "{clave}" y no esta en "imagenes"')
            return '<p style="margin:0 0 10pt 0;"><img src="cid:%s" width="900" style="max-width:100%%;"></p>' % clave
        return ('<p style="font-family:Calibri,sans-serif;font-size:11pt;margin:0 0 6pt 0;">%s</p>'
                % (linea or '&nbsp;'))

    bloque = ''.join(renglon(linea) for linea in cfg['cuerpo'].split('\n'))
    i = html.lower().find('<body')
    j = html.find('>', i) + 1 if i >= 0 else 0
    rp.HTMLBody = html[:j] + bloque + html[j:]
    rp.Save()
    # Queda anotado cuando lo vio Fak: el hook mail-guard no deja mandarlo si su ultimo mensaje
    # es anterior a este borrador (Fak, 08/10/2026).
    from _prepararMail import registrar_borrador
    registrar_borrador(rp, rp.Subject)

    h = rp.HTMLBody or ''
    print('\nRespuesta abierta en Outlook y guardada en Borradores (sin transmitir).')
    print('  Para:    ', rp.To)
    print('  CC:      ', rp.CC)
    print('  Asunto:  ', rp.Subject)
    print('  Adjuntos:', rp.Attachments.Count)
    for k in range(1, rp.Attachments.Count + 1):
        x = rp.Attachments.Item(k)
        print('     - %-70s %8.1f KB' % (x.FileName, x.Size / 1024.0))
    print('  Firma:   ', 'OK' if 'Santoro' in h else 'NO LA VEO - mirar antes de enviar')


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    with open(sys.argv[1], encoding='utf-8') as fh:
        responder(json.load(fh))
