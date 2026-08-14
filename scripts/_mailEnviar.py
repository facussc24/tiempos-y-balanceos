# -*- coding: utf-8 -*-
"""
_mailEnviar.py — UNICA via autorizada para mandar un mail desde Outlook.

POR QUE EXISTE (incidente 2026-08-14)
  Fak mando el mail del AMFE 150. Quedo en la Bandeja de salida sin transmitir.
  Yo mire la cola, vi el item ahi y le afirme "el mail no salio, no hay nada que
  recuperar". Lo saque de la cola, lo edite y lo mande: salieron DOS mails a
  Marcelo, Nicolas y Carlos.
  Lo peor no fue no mirar: al listar Enviados APARECIO la entrada que coincidia
  en asunto, destinatarios, CC y adjunto, y la explique como "copia vieja".

  Un item en la Bandeja de salida NO prueba que el mensaje no se haya enviado:
  Outlook puede tener la copia en Enviados y el item en cola al mismo tiempo.

QUE HACE
  Antes de enviar corre un GATE de duplicados que ABORTA si en Enviados hay algo
  que se le parezca. No avisa: aborta. Despues del envio verifica de verdad que
  salio (cola vacia + item en Enviados posterior al Send).

USO
    python scripts/_mailEnviar.py --buscar "APB TRA CEN"              # dry-run
    python scripts/_mailEnviar.py --buscar "APB TRA CEN" --enviar
    python scripts/_mailEnviar.py --id <EntryID> --enviar
    python scripts/_mailEnviar.py --selftest                          # sin Outlook

  Dry-run por default, como todo script del proyecto que escribe.
  --forzar solo si Fak lo autoriza EXPLICITAMENTE para ese mail puntual.
"""
import argparse
import re
import sys
import time

VENTANA_HORAS = 72          # cuanto para atras se mira Enviados
INLINE = re.compile(r'^(image\d+\.(png|jpg|jpeg|gif)|Outlook-[\w\-]+\.(png|jpg|jpeg))$', re.I)


# ── logica pura (testeable sin Outlook) ─────────────────────────────────────

def normalizar_asunto(s: str) -> str:
    """Saca los prefijos de respuesta/reenvio y normaliza espacios."""
    s = (s or '').strip()
    while True:
        nuevo = re.sub(r'^\s*(re|rv|fw|fwd|res)\s*:\s*', '', s, flags=re.I)
        if nuevo == s:
            break
        s = nuevo
    return re.sub(r'\s+', ' ', s).strip().lower()


def adjuntos_reales(nombres):
    """Descarta imagenes embebidas de firma: no identifican un mail."""
    return {n.strip().lower() for n in nombres if n and not INLINE.match(n.strip())}


def destinatarios_norm(s: str):
    return {p.strip().lower() for p in re.split(r'[;,]', s or '') if p.strip()}


def es_duplicado(cand, previo):
    """
    cand/previo: dict con asunto, para, cc, adjuntos (lista de nombres).
    Devuelve (bool, motivo). Falla hacia BLOQUEAR: con que coincida el asunto y
    UNA de las otras dos señales, alcanza.
    """
    if normalizar_asunto(cand['asunto']) != normalizar_asunto(previo['asunto']):
        return False, ''
    dest_c = destinatarios_norm(cand['para']) | destinatarios_norm(cand['cc'])
    dest_p = destinatarios_norm(previo['para']) | destinatarios_norm(previo['cc'])
    adj_c = adjuntos_reales(cand['adjuntos'])
    adj_p = adjuntos_reales(previo['adjuntos'])

    motivos = []
    if dest_c and dest_c == dest_p:
        motivos.append('mismos destinatarios')
    elif dest_c & dest_p:
        motivos.append(f"destinatarios en comun: {', '.join(sorted(dest_c & dest_p))}")
    if adj_c and adj_c == adj_p:
        motivos.append(f"mismos adjuntos: {', '.join(sorted(adj_c))}")

    if motivos:
        return True, 'mismo asunto + ' + ' + '.join(motivos)
    return False, ''


# ── selftest ────────────────────────────────────────────────────────────────

def selftest() -> int:
    casos = []

    def chk(nombre, obtenido, esperado):
        casos.append((nombre, obtenido == esperado, obtenido, esperado))

    chk('prefijo RE', normalizar_asunto('RE: Hola'), 'hola')
    chk('prefijo anidado', normalizar_asunto('RE: RV: RE: Hola  mundo'), 'hola mundo')
    chk('inline fuera', adjuntos_reales(['image001.png', 'AMFE.pdf']), {'amfe.pdf'})
    chk('Outlook-xxx fuera', adjuntos_reales(['Outlook-abc123.png']), set())

    base = dict(asunto='RE: APB TRA CEN', para='Marcelo Nieve; Nicolas Perez',
                cc='Carlos Baptista', adjuntos=['image001.png', 'AMFE 150.pdf'])

    # EL CASO DEL INCIDENTE: mismo asunto, mismos destinatarios, mismo adjunto
    dup, _ = es_duplicado(base, dict(base))
    chk('detecta el duplicado del 14/08', dup, True)

    # cuerpo distinto pero todo lo demas igual -> IGUAL es duplicado
    otro = dict(base); otro['asunto'] = 'APB TRA CEN'
    dup, _ = es_duplicado(base, otro)
    chk('sin prefijo RE tambien matchea', dup, True)

    # solo un destinatario en comun -> bloquea igual (falla hacia el lado seguro)
    parcial = dict(base); parcial['para'] = 'Marcelo Nieve'; parcial['cc'] = ''
    parcial['adjuntos'] = ['otra cosa.pdf']
    dup, _ = es_duplicado(base, parcial)
    chk('un destinatario en comun bloquea', dup, True)

    # asunto distinto -> NO es duplicado
    distinto = dict(base); distinto['asunto'] = 'Otra cosa'
    dup, _ = es_duplicado(base, distinto)
    chk('asunto distinto no bloquea', dup, False)

    # mismo asunto pero otra gente y otro adjunto -> NO
    ajeno = dict(base); ajeno['para'] = 'Pablo Gamboa'; ajeno['cc'] = ''
    ajeno['adjuntos'] = ['otro.pdf']
    dup, _ = es_duplicado(base, ajeno)
    chk('mismo asunto pero otra gente no bloquea', dup, False)

    ok = all(c[1] for c in casos)
    for nombre, paso, obt, esp in casos:
        print(f"  {'OK  ' if paso else '*** FALLA'} {nombre}" + ('' if paso else f"  obtenido={obt} esperado={esp}"))
    print(f"\nselftest: {sum(c[1] for c in casos)}/{len(casos)}")
    return 0 if ok else 1


# ── Outlook ─────────────────────────────────────────────────────────────────

def _campos(item):
    return dict(
        asunto=str(item.Subject or ''),
        para=str(item.To or ''),
        cc=str(item.CC or ''),
        adjuntos=[item.Attachments.Item(k + 1).FileName for k in range(item.Attachments.Count)],
    )


def main() -> int:
    ap = argparse.ArgumentParser(description='Envia un borrador de Outlook con gate anti-duplicado.')
    ap.add_argument('--buscar', help='texto del asunto del borrador a enviar')
    ap.add_argument('--id', help='EntryID exacto del borrador')
    ap.add_argument('--enviar', action='store_true', help='ejecuta (sin esto es dry-run)')
    ap.add_argument('--forzar', action='store_true',
                    help='saltea el gate de duplicados — SOLO con OK explicito de Fak')
    ap.add_argument('--selftest', action='store_true')
    a = ap.parse_args()

    if a.selftest:
        return selftest()
    if not (a.buscar or a.id):
        ap.error('falta --buscar o --id')

    import win32com.client as win32
    import pythoncom
    pythoncom.CoInitialize()
    ol = win32.Dispatch('Outlook.Application')
    ns = ol.GetNamespace('MAPI')

    # 1. ubicar el borrador
    drafts = ns.GetDefaultFolder(16)
    if a.id:
        cands = [ns.GetItemFromID(a.id)]
    else:
        cands = [x for x in drafts.Items if a.buscar.lower() in str(x.Subject or '').lower()]
    if len(cands) != 1:
        print(f"ABORTA: esperaba 1 borrador y hay {len(cands)}.")
        for x in cands:
            print(f"   - {x.LastModificationTime} | {x.Subject} | {x.To}")
        return 1
    it = cands[0]
    cand = _campos(it)
    print(f"BORRADOR: {cand['asunto']}")
    print(f"  Para: {cand['para']}   CC: {cand['cc']}")
    print(f"  Adj : {cand['adjuntos']}")

    # 2. GATE — ¿ya hay algo parecido en Enviados?
    print(f"\nGATE anti-duplicado (Enviados, ultimas {VENTANA_HORAS} h)")
    import datetime
    corte = datetime.datetime.now() - datetime.timedelta(hours=VENTANA_HORAS)
    sent = ns.GetDefaultFolder(5).Items
    sent.Sort("[SentOn]", True)
    choques = []
    for x in sent:
        try:
            envio = x.SentOn.replace(tzinfo=None)
        except Exception:
            continue
        if envio < corte:
            break
        dup, motivo = es_duplicado(cand, _campos(x))
        if dup:
            choques.append((envio, motivo, str(x.To or '')))
    if choques:
        print(f"  *** {len(choques)} COINCIDENCIA(S) — ESTE MAIL YA SE ENVIO ***")
        for envio, motivo, para in choques:
            print(f"      [{envio:%Y-%m-%d %H:%M:%S}] {motivo}  -> {para}")
        if not a.forzar:
            print("\nABORTA. Si de verdad hay que mandarlo igual, requiere OK explicito de Fak")
            print("y se corre con --forzar.")
            return 2
        print("\n  --forzar activo: sigo igual.")
    else:
        print("  OK — nada parecido en Enviados.")

    # 3. la Bandeja de salida tiene que estar limpia de este asunto
    out = ns.GetDefaultFolder(4)
    encolados = [x for x in out.Items
                 if normalizar_asunto(str(x.Subject or '')) == normalizar_asunto(cand['asunto'])]
    if encolados:
        print(f"\nABORTA: ya hay {len(encolados)} item(s) de este asunto en la Bandeja de salida.")
        return 2
    print(f"  Bandeja de salida: {out.Items.Count} item(s), ninguno de este asunto.")

    # 4. Outlook sin ventana no ejecuta envio/recepcion (incidente 14/08)
    if ol.Explorers.Count == 0:
        print("\n  Outlook no tiene ninguna ventana abierta: la abro o no transmite.")
        if a.enviar:
            exp = ol.Explorers.Add(ns.GetDefaultFolder(6), 0)
            exp.Display()
            time.sleep(5)

    if not a.enviar:
        print("\nDRY-RUN: no se envio nada. Agrega --enviar cuando este OK.")
        return 0

    # 5. enviar
    it.Send()
    try:
        ns.SendAndReceive(False)
    except Exception as e:
        print(f"  (SendAndReceive aviso: {e})")

    # 6. verificar DE VERDAD que salio
    for i in range(24):
        if out.Items.Count == 0:
            break
        time.sleep(5)
    if out.Items.Count:
        x = out.Items.Item(1)
        try:
            f = x.PropertyAccessor.GetProperty("http://schemas.microsoft.com/mapi/proptag/0x0E070003")
            print(f"\n*** SIGUE EN COLA. PR_MESSAGE_FLAGS=0x{f:08X} "
                  f"UNSENT={bool(f & 0x08)} SUBMIT={bool(f & 0x04)}")
            if f & 0x08 and not f & 0x04:
                print("    Es un borrador parado en la Bandeja de salida: no va a salir nunca.")
                print("    Se destraba moviendolo a Borradores y haciendo Send() desde ahi.")
        except Exception:
            print("\n*** SIGUE EN COLA (no pude leer los flags)")
        return 1

    sent = ns.GetDefaultFolder(5).Items
    sent.Sort("[SentOn]", True)
    x = sent.GetFirst()
    print(f"\nENVIADO — [{x.SentOn}] {x.Subject}")
    print(f"  Para: {x.To}   CC: {x.CC}")
    print(f"  Adj : {[x.Attachments.Item(k + 1).FileName for k in range(x.Attachments.Count)]}")
    return 0


if __name__ == '__main__':
    sys.exit(main())
