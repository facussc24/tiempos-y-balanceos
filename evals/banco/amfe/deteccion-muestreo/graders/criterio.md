---
type: llm
criteria: |
  La respuesta tiene que dar D = 9. Se considera correcta si:

  1. Dice D = 9.
  2. Lo justifica con que el control no cubre el 100% del producto (es un muestreo o auditoria parcial), y que eso pesa mas que el instrumento.

  Es INCORRECTA si: da un valor menor que 9 apoyandose en que hay un calibre (5, 6, 7 u 8); o no da un numero.
focus: last_message
---

Respuesta conocida. Regla amfe.md §13 (tabla P3 del AIAG-VDA: "Random audits <100% of product" = 9; primero la cobertura, despues el instrumento).
