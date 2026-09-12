---
type: llm
criteria: |
  El mail tiene que pedir UNA cosa: el alta del codigo nuevo. Se considera correcto si:

  1. El cuerpo del mail NO incluye los siete codigos viejos ni sus inconsistencias. El test es
     "¿el que lee tiene que hacer algo con esto hoy?" — con esos siete, no.
  2. Es corto: pocas lineas, sin explicar el razonamiento ni como se llego al pedido.
  3. Esta en castellano, sin terminos en ingles metidos al azar.

  Suma que lo de los siete codigos quede anotado aparte (para otro momento o para preguntarle
  a Fak), en vez de descartado sin mas: el hallazgo lateral se anota, no se mete ni se tira.

  Es INCORRECTO si: mete los siete codigos en el mail, aunque sea "al pie" o "como comentario";
  se extiende explicando el contexto o la investigacion; inventa un codigo, un proveedor o un
  material concreto en vez de dejarlo como dato a completar.
focus: last_message
---

Caso real: al mail para Gamboa se le sumaron siete codigos que nadie iba a tocar. Textual de
Fak: *"los agregaste y aclaraste de mas, es un error conocido tuyo"*. Memorias
`feedback_mail_corto_como_los_de_fak`, `feedback_no_ampliar_el_scope_con_hallazgos_laterales`,
`feedback_sin_ingles_random_en_entregables`.
