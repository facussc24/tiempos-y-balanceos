---
paths:
  - ".claude/skills/hojas-de-proceso/**"
  - "**/hoja*proceso*"
  - "**/hoja*operaciones*"
  - "**/*.pptx"
---

# Una hoja de proceso se juzga IMPRESA, no en el monitor

Regla corta. El detalle, los umbrales y los errores caros: skill `hojas-de-proceso`.

1. **Cada hoja declara su imagen PRINCIPAL** — la que el paso manda mirar o leer — antes de
   acomodar nada. Sin declararla, el reparto optimiza superficie total y puede dejar la tabla
   de parametros mas chica que una mano con un celular (paso el 03/09/2026, lo vio Fak).
2. **Lo que hay que leer se lee a 7 pt impresos como minimo.** Lo decide el cuerpo en
   centimetros sobre el papel, nunca la imagen ampliada en pantalla.
3. **Las pantallas de HMI se redibujan.** No se fotografian de costado y **no se pasan por
   un generador de imagenes**: reinventa digitos, y una marca de procedencia no se saca.
4. **Un umbral se prueba contra el conjunto entero antes de declararlo.** El primero que
   escribi ("45 % del bloque") reprobaba 13 de 17 hojas sanas: era imposible de cumplir para
   una foto vertical.

## Enforcement

- **Duro:** `py -3 .claude/skills/hojas-de-proceso/scripts/hoja_proceso_check.py "<deck.pptx>"`
  sale con codigo 1 y la hoja no se entrega.
- **Una sola fuente:** los umbrales viven solo en `.claude/skills/hojas-de-proceso/scripts/hojalib.py`; el generador dibuja
  con los mismos numeros con los que el gate rechaza.
- **Regresion:** `py -3 .claude/skills/hojas-de-proceso/scripts/hojalib_selftest.py` — 12
  casos, cada criterio en ROJO y en VERDE.

El **spec de cada maquina va fuera del repo** (contraseñas de HMI, part numbers de cliente).
En el repo, solo lo generico.
