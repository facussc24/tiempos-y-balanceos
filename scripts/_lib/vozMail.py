"""
_lib/vozMail.py — puente a `scripts/_vozFak.mjs --revisar`, para que los scripts de mail
midan la voz del cuerpo antes de que el mail exista en Outlook.

Por que un puente y no una copia de la logica: los patrones estan calibrados contra el
corpus (`_lib/vozGate.mjs`, 935 mails de Fak). Dos copias de una heuristica se desincronizan
el mismo dia en que Fak corrige algo.

Si node no esta o el gate falla, NO se bloquea el mail: se avisa. Un chequeo de estilo roto
no puede dejar a Fak sin poder mandar un correo.
"""
import os
import subprocess
import sys

# Este archivo vive en `scripts/_lib/`, asi que UN dirname llega a `scripts/`. La primera
# version hacia dos y ademas volvia a agregar 'scripts': el gate apuntaba a
# `scripts/scripts/_vozFak.mjs`, que no existe, y `chequear_voz` devolvia "no disponible"
# SIEMPRE — el bloqueo del envio nunca corrio ni una vez, en silencio, porque el camino
# fail-open tapa justamente este error. Lo caza el `--selftest` de abajo.
SCRIPTS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GATE = os.path.join(SCRIPTS, '_vozFak.mjs')


def chequear_voz(cuerpo):
    """Devuelve (rojos, salida). rojos = -1 si el chequeo no pudo correr."""
    if not cuerpo or not os.path.exists(GATE):
        return -1, 'gate de voz no disponible'
    try:
        p = subprocess.run(
            ['node', GATE, '--revisar', '-'],
            input=cuerpo, capture_output=True, text=True,
            encoding='utf-8', errors='replace', timeout=60,
            cwd=os.path.dirname(SCRIPTS),          # la raiz del repo: el gate lee su perfil de ahi
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


def selftest():
    """
    La CADENA REAL: python -> subprocess node -> vozGate. En las dos direcciones.

    Existe porque el bug de ruta de arriba paso los 25 tests del gate sin despeinarse: esos
    importan `vozGate.mjs` directo, que es justo el tramo que nunca estuvo roto. Un chequeo
    con salida fail-open necesita un caso que pruebe que SI puede correr, no solo que no
    revienta.

        python scripts/_lib/vozMail.py --selftest
    """
    casos = [
        ('ROJO', 1, 'Carlos,\n\nCorregimos en el arb el punzonado de dos piezas.\n\nSaludos'),
        ('VERDE', 0, 'Carlos,\n\nCorregi en el arb el punzonado de dos piezas.\n\nSaludos'),
    ]
    fallas = 0
    if not os.path.exists(GATE):
        print(f'FALLA  el gate no esta donde vozMail.py lo busca: {GATE}')
        return 1
    for etiqueta, esperado, cuerpo in casos:
        rojos, salida = chequear_voz(cuerpo)
        ok = rojos == esperado
        fallas += 0 if ok else 1
        print(f"  {'OK  ' if ok else 'FALLA'}  {etiqueta}: rojos={rojos} (esperado {esperado})"
              f"{'' if ok else ' — ' + salida.splitlines()[0][:80]}")
    print(f"\nselftest: {len(casos) - fallas}/{len(casos)}")
    return 1 if fallas else 0


if __name__ == '__main__':
    sys.exit(selftest() if '--selftest' in sys.argv else 0)
