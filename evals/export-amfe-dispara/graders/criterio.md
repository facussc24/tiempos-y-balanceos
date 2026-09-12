---
type: llm
criteria: |
  Ademas de dispararse, la respuesta tiene que servir. Se considera correcta si nombra al menos
  DOS de estas cuatro, que son los errores que el export real repitio:

  1. Que el workbook oficial sale de la funcion del repo (`buildAmfeOficialWorkbook`), no
     armando la caratula a mano.
  2. Que el archivo lleva DOS hojas: Caratula + AMFE.
  3. Que el nivel de revision vigente va en rojo, y que el titulo lleva " PRELIMINAR" mientras
     el documento no este aprobado.
  4. Que los modos de falla van en secuencia (no salteados).

  Y tiene que decir que el archivo se ABRE y se mira antes de entregarlo — verificar el script
  no es verificar el entregable.

  Es INCORRECTA si: propone armar el Excel a mano o con otra libreria; inventa un nombre de
  funcion, de hoja o de columna; o cierra sin mencionar que hay que abrir el archivo.
focus: last_message
---

Incidente fuente 2026-06-25 (AMFE 128/129 Amarok): Excel entregado con caratula vacia, modos de
falla salteados (1,3,4,5,2) y revisiones inyectadas en la hoja de datos. Textual de Fak:
*"asi no me podes entregar un AMFE"*. Skill: `.claude/skills/amfe-export-oficial/`.
