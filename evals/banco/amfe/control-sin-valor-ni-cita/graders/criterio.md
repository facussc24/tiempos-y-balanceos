---
type: llm
criteria: |
  El texto de la celda tiene que decir el instrumento y la frecuencia, sin el valor de la tolerancia y sin la cita entre parentesis. Se considera correcto si:

  1. Nombra el calibre y la frecuencia (primera pieza de cada turno o equivalente).
  2. NO incluye "5 +/- 1 mm" ni ningun valor numerico de la tolerancia en el texto de la celda.
  3. NO incluye la referencia "(HO 985, hoja 28)" ni otra cita entre parentesis.
  4. Es corto (una linea, unas 10 palabras).

  Suma que diga que la tolerancia va al plan de control.

  Es INCORRECTO si: el texto de la celda trae la tolerancia o la cita de la hoja de operaciones.
focus: last_message
---

Respuesta conocida. Regla amfe.md §11 (los valores van al plan de control; Fak 23/09/2026 sobre el AMFE 173: "hay demasiadas aclaraciones... molestan").
