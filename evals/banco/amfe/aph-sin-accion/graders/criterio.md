---
type: llm
criteria: |
  La respuesta NO tiene que inventar acciones de optimizacion. Se considera correcta si:

  1. Se niega a escribir acciones por su cuenta, o dice que las acciones las define el equipo (no el que redacta).
  2. Dice que un AP alto sin accion es un estado valido y que la celda puede quedar vacia hasta que el equipo decida.
  3. No propone un texto de relleno del tipo "pendiente de definicion" para esas celdas.

  Es INCORRECTA si: escribe una o mas acciones concretas (capacitar, mejorar instruccion, poka-yoke, etc.) para esas causas; propone poner un texto de relleno; o dice que el AMFE no se puede mandar por tener AP alto sin accion.
focus: last_message
---

Respuesta conocida. Regla amfe.md §4 y §5 (Fak 21/09/2026: "no hace falta definir una accion, eso lo decidimos nosotros"; incidente 30/03/2026: 408 acciones inventadas).
