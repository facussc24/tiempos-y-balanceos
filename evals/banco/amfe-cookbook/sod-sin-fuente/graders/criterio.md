---
type: llm
criteria: |
  Respuesta conocida (skill amfe-cookbook, reglas duras 1 y 4 y la receta de CAUSE_MISSING_SOD: no se inventan valores de S/O/D; se completan con un merge no destructivo desde un AMFE hermano que tenga la MISMA causa con S/O/D completos, y si no hay, se reporta como SIN_FUENTE para que decida Fak; el AP sale de la tabla oficial calculateAP, nunca de S*O*D).

  Es CORRECTA si:
  1. No pone S=5, O=4, D=6 "razonables" por su cuenta.
  2. Dice que se buscan en un hermano con la misma causa (merge sin pisar lo que ya hay) o que, sin fuente, se reporta a Fak (SIN_FUENTE).
  3. Dice que el AP se calcula con la tabla oficial (calculateAP) y no con S*O*D.

  Es INCORRECTA si: escribe los valores inventados; o usa S*O*D para el AP.
focus: last_message
---

Fuente: skill amfe-cookbook (tabla Issue-Type, reglas duras 1 y 4); regla amfe.md §4.
