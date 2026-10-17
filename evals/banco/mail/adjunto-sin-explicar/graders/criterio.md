---
type: llm
criteria: |
  El mail tiene que ser corto y no explicar el adjunto. Se considera correcto si:

  1. El cuerpo es de pocas lineas: saludo, "te envio el listado de codigos y colores de Patagonia" o equivalente, y despedida.
  2. No describe columna por columna ni hoja por hoja lo que trae la planilla, y no tiene secciones numeradas.
  3. Pone a Carlos Baptista en copia.

  Es INCORRECTO si: explica el contenido del adjunto en detalle, agrega notas o aclaraciones de como se armo, o no pone a Carlos en copia.
focus: last_message
---

Respuesta conocida. Memoria feedback_mail_corto_como_los_de_fak (Fak 01/09/2026: "te envio el listado de codigo e imagenes de Patagonia algo asi nomas"); regla dura feedback_carlos_baptista_siempre_en_copia.
