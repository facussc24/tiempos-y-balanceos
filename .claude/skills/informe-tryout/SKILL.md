---
name: informe-tryout
description: Informe de TryOut / T0 de Patagonia — el deck bilingue (castellano e ingles) de Carlos Baptista sobre la IMG y los moldes, que crece una jornada por corrida. Usar cuando haya que informar una corrida de prueba o sumarle una jornada a ese deck con las fotos, audios y partes del dia.
---

# Informe de TryOut — la jornada nueva se CLONA sobre el deck de Carlos

Skill armado el 22/09/2026 a partir de lo que ya estaba probado en seis jornadas (Dia 1 a 6,
27/08 a 08/09/2026). El detalle vive en dos memorias que se leen ENTERAS antes de empezar:

- `reference_informe_tryout_extender_deck_carlos` — como se clona, los layouts utiles, las 8
  trampas que costaron una vuelta cada una, el render de control y el cierre.
- `reference_informes_tryout_donde_viven` — donde vive el deck en el legajo NOVAX, el par ES/EN,
  y las SEIS fuentes de una jornada.

## El camino, en orden

1. **Juntar las seis fuentes antes de escribir**: fotos con epigrafe del chat de Fak, audios que
   Fak le manda a Carlos, mensajes de Carlos, el **parte de planta de Walter** (llega tarde, a
   veces por mail: esperarlo), el grupo de WhatsApp `Proyecto Patagonia VW` (ahi estuvo el unico
   dato duro del Dia 4) y el informe anterior. Como se sacan: memoria
   `reference_sacar_material_de_whatsapp_web` y `python scripts/_mails.py --buscar`.
2. **Partir del ULTIMO deck que mando Carlos**, no del mio: el deck crece y el lo reenvia entero.
   Si agrego slides suyas y pidio dejarlas al final, siguen ultimas.
3. **Clonar, no dibujar**: kit en `scripts/tryout/` (`clonlib.py` con dup / mover / set_pairs /
   set_txt; `contenido_diaN.py` solo texto ES+EN; `diaN_bilingue.py` el generador, que trae
   `set_pairs_exacto` / `set_lineas_exacto`; `mapear.py` para ver indice/id/texto de una slide). Se copia el par
   contenido+generador de la jornada anterior y se cambian indices y textos.
4. **El numero de Dia es el del INFORME, no el del calendario** (Dia 5 = 02/09, Dia 6 = 08/09).
5. **Antes/despues se ordena por lo que DICE la fuente** (quien lo rotulo, la pantalla, el audio),
   nunca por la hora de envio del archivo (trampa 8, Dia 6).

## Antes de entregar

- [ ] Cada archivo abre en **PowerPoint** (`Presentations.Open()`), con su gemelo roto
      (`scripts/tryout/_gemelo_roto.pptx`) rechazado: python-pptx abre archivos que PowerPoint no.
- [ ] Render de control a **1920x1080** (`Slide.Export`), mirado slide por slide: a 1280 se
      pierden los acentos.
- [ ] El bloque heredado da **0 diferencias** contra el deck de Carlos, y la tabla del plan de
      accion se compara fila por fila (`verificar6.py` es el modelo).
- [ ] Par ES/EN con la misma estructura (mismos textos, fotos y filas por slide).
- [ ] Revision ciega: UN `Agent` recibe solo el PDF de la jornada y contesta *"¿que paso en esta
      corrida y que queda pendiente?"*; si no coincide con las fuentes, el deck no se entiende.
- [ ] Donde queda: la subcarpeta de la corrida en el legajo (`28- Corrida de Produccion\01- TryOut\`,
      memoria `reference_informes_tryout_donde_viven`). Si `Y:` no esta mapeado, se dice con la ruta
      local; no se da por subido.
