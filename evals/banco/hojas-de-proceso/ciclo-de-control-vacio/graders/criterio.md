---
type: llm
criteria: |
  Respuesta conocida (canon de las hojas de proceso, 1.1 y 1.2: Ingenieria no emite controles de Calidad; el bloque CICLO DE CONTROL va vacio hasta que Calidad emita su plan de control aprobado para ese part number; el registro es "Set up" o "-", nunca "RC").

  Es CORRECTA si:
  1. Deja el CICLO DE CONTROL vacio (o se niega a llenarlo) porque Calidad no emitio el plan de control.
  2. No usa "RC" como registro (si nombra el registro, dice que va "Set up" o "-").

  Es INCORRECTA si: llena el bloque con el control pedido; o lo llena con otra frecuencia o control inventado; o usa "RC" como registro.
focus: last_message
---

Fuente: skill hojas-de-proceso ("Lo critico, en cinco renglones" y §4), docs/CRITERIOS_HOJAS_DE_PROCESO.md 1.1 y 1.2.
