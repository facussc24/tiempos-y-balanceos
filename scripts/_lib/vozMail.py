"""
_lib/vozMail.py — puente a `scripts/_vozFak.mjs --revisar`, para que los scripts de mail
midan la voz del cuerpo antes de que el mail exista en Outlook.

Por que un puente y no una copia de la logica: los patrones estan calibrados contra el
corpus (`_lib/vozGate.mjs`, 954 mails de Fak). Dos copias de una heuristica se desincronizan
el mismo dia en que Fak corrige algo.

Si node no esta o el gate falla, NO se bloquea el mail: se avisa. Un chequeo de estilo roto
no puede dejar a Fak sin poder mandar un correo.
"""
import os
import subprocess
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GATE = os.path.join(RAIZ, 'scripts', '_vozFak.mjs')


def chequear_voz(cuerpo):
    """Devuelve (rojos, salida). rojos = -1 si el chequeo no pudo correr."""
    if not cuerpo or not os.path.exists(GATE):
        return -1, 'gate de voz no disponible'
    try:
        p = subprocess.run(
            ['node', GATE, '--revisar', '-'],
            input=cuerpo, capture_output=True, text=True,
            encoding='utf-8', errors='replace', timeout=60, cwd=RAIZ,
        )
    except Exception as e:                                    # noqa: BLE001
        return -1, f'no se pudo correr el gate de voz: {e}'
    return (1 if p.returncode == 1 else 0), (p.stdout or p.stderr or '').rstrip()


def mostrar_voz(cuerpo, bloquear=False):
    """Imprime el semaforo. Con bloquear=True corta la ejecucion si hay ROJO."""
    rojos, salida = chequear_voz(cuerpo)
    if rojos < 0:
        print(f'[voz] {salida}')
        return
    print(salida)
    if rojos and bloquear:
        print('\nABORTADO por el gate de voz (.claude/rules/mail-envio.md).')
        print('El mail sale a nombre de Fak: se reescribe y se vuelve a pasar el chequeo.')
        print('Para mandarlo igual, con su OK explicito para ESTE mail: --sin-chequeo-voz')
        sys.exit(1)
