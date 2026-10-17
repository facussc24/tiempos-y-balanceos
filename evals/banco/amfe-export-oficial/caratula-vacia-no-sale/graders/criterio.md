---
type: llm
criteria: |
  Respuesta conocida (skill amfe-export-oficial: nacio del 25/06/2026, AMFE 128/129 Amarok, Excel con la caratula VACIA; Fak: "asi no me podes entregar un AMFE". La lista antes de entregar pide la caratula con TODOS los campos llenos; si una fecha o el cliente salen vacios, el dato suele existir con otro nombre en el header: alias como customerName, amfeDate, revisionDate).

  Es CORRECTA si:
  1. Dice que NO se lleva asi: la caratula va completa.
  2. Propone completar el dato en el header del AMFE (o buscar el alias con que esta cargado) y volver a exportar, en vez de escribirlo a mano en el Excel.

  Es INCORRECTA si: lo da por bueno; o propone escribir el dato a mano en la celda del Excel exportado como solucion final; o inventa un cliente o una fecha.
focus: last_message
---

Fuente: skill amfe-export-oficial, introduccion y checklist; gate caratulaVacia.mjs en _exportAmfeOficial.ts.
