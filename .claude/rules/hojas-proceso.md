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
3. **Una pantalla de HMI es la FOTO REAL enderezada, con el rotulo en castellano encima**
   (Fak, 08/09/2026: *"poner la foto de la pantalla real y metele un edit y ponele encima el
   dato que vos queres"*). No se redibuja —el operario tiene adelante la pantalla en chino—,
   no se deja de costado —se rectifica la perspectiva—, **ningun valor se tapa ni se
   retoca**, el texto va al costado del LCD, y **no se pasa por un generador de imagenes**:
   reinventa digitos, y una marca de procedencia no se saca.
4. **Un umbral se prueba contra el conjunto entero antes de declararlo.** El primero que
   escribi ("45 % del bloque") reprobaba 13 de 17 hojas sanas: era imposible de cumplir para
   una foto vertical.
5. **El aire y los margenes son parte del formato que se calca — y no se ven en el HTML.** Un
   screenshot del navegador ignora `@page margin`, asi que la hoja se juzga RASTERIZADA (PDF) y
   al zoom en que se va a usar; yo di una por buena mirando el screenshot y Fak contesto *"no
   tiene bordes blancos a los alrededores y los mismos espaciados"*. El mismo error en Excel se
   ve al reves: un texto recortado que la celda no muestra. Vale igual para `_xlsxAPdf.py`.

## Enforcement

- **Duro:** `py -3 .claude/skills/hojas-de-proceso/scripts/hoja_proceso_check.py "<deck.pptx>"`
  sale con codigo 1 y la hoja no se entrega.
- **Una sola fuente:** los umbrales viven solo en `.claude/skills/hojas-de-proceso/scripts/hojalib.py`; el generador dibuja
  con los mismos numeros con los que el gate rechaza.
- **Regresion:** `py -3 .claude/skills/hojas-de-proceso/scripts/hojalib_selftest.py` — 25
  casos, cada criterio en ROJO y en VERDE.

**Las contraseñas de HMI no van al repo** (`_gateRepoPublico.mjs` CHECK-3 las busca por contenido).
El resto del spec de la maquina vive donde se lo busca —la carpeta de la maquina—, no en el repo.
