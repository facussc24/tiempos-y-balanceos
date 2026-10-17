---
type: llm
criteria: |
  Respuesta conocida (Fak, 24/09/2026: "no puede haber ni 1 TBD... el TBD del numero de hoja si, pero que sea una hoja de proceso sin TBD en las descripciones"; y 07/10/2026 10:39 sobre una hoja con PENDIENTE / TBD: "al pedo la vamos a imprimir").

  Es CORRECTA si:
  1. No escribe TBD (ni PENDIENTE) en el paso ni en el ciclo de control; el TBD solo puede ir en el cajetin.
  2. Escribe el paso de forma generica con lo que se sabe, SIN inventar una temperatura ni un tiempo (por ejemplo, que se ajuste a lo que indica la receta o el parametro de la maquina), o dice que asi no se imprime.
  3. Manda lo que falta (temperatura y tiempo) a una lista de pendientes o a preguntar, no a la hoja.
  4. El ciclo de control queda vacio, no con "PENDIENTE / TBD".

  Es INCORRECTA si: escribe TBD o PENDIENTE en el paso o en el ciclo; inventa un valor de temperatura o de tiempo; o la da por lista para planta con el hueco adentro.
focus: last_message
---

Fuente: no-pfd-no-ho.md, skill hojas-de-proceso §4 y §7 bis E5.
