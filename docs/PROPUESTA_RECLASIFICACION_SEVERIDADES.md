# Propuesta de Reclasificación de Severidades AMFE y CC/SC

**Fecha**: 2026-03-26
**Alcance**: 8 AMFEs maestros (503 causas totales)
**Objetivo**: Alinear severidades y clasificaciones CC/SC al benchmark de industria para piezas de cabina interior Tier 1

## Reglas de calibración aplicadas (AIAG-VDA, validadas para insert tapizado de puerta)

| Severidad | Criterio | Clasificación |
|-----------|----------|---------------|
| S=9-10 | Flamabilidad (TL 1010 VW), emisiones tóxicas/VOCs, interferencia airbag lateral, bordes filosos expuestos | CC obligatoria |
| S=7-8 | Falla de encastre severa que para línea VW (sustrato deformado, clips faltantes), desprendimiento en campo (clips por fatiga) | Candidato SC |
| S=5-6 | Arrugas masivas, delaminación, costuras torcidas, ruidos S&R, retrabajo offline | Estándar (sin clasif.) |
| S=3-4 | Hilo suelto, mancha limpiable, desvío milimétrico, retrabajo in-station | Estándar |

**Benchmark industria**: CC 1-5%, SC 10-15%, Estándar 80-90%

---

## Resumen ejecutivo

| Producto | Causas | CC actual | SC actual | CC+SC % | CC prop. | SC prop. | CC+SC % prop. |
|----------|--------|-----------|-----------|---------|----------|----------|---------------|
| Insert | 110 | 3 | 86 | **80.9%** | 0 | 12 | **10.9%** |
| Armrest | 109 | 1 | 46 | **43.1%** | 0 | 7 | **6.4%** |
| Top Roll | 49 | 3 | 15 | **36.7%** | 2 | 7 | **18.4%** |
| Headrest Front | 62 | 2 | 4 | 9.7% | 3 | 5 | **12.9%** |
| Headrest Rear Cen | 57 | 0 | 4 | 7.0% | 0 | 5 | **8.8%** |
| Headrest Rear Out | 57 | 0 | 4 | 7.0% | 0 | 5 | **8.8%** |
| Telas Planas | 38 | 2 | 0 | 5.3% | 2 | 4 | **15.8%** |
| Telas Termoformadas | 21 | 0 | 0 | 0% | 1 | 0 | **4.8%** |
| **TOTAL** | **503** | **11** | **159** | **33.8%** | **8** | **45** | **10.5%** |

**Hallazgo principal**: Insert y Armrest tienen severidades masivamente infladas. Los headrests y telas ya estaban mejor calibrados. Se proponen 3 CC nuevas (1 upgrade en Telas Termoformadas + 1 upgrade en Headrest Front) y se eliminan 6 CC existentes que no cumplen criterios de seguridad/legal.

---

## INSERT

**Estado actual**: 3 CC, 86 SC, 21 estándar sobre 110 causas (CC+SC = 80.9%)
**Propuesta**: 0 CC, 12 SC, 98 estándar (CC+SC = 10.9%)

### Cambios propuestos de Severidad

| OP | Modo de falla | S act. | S prop. | AP impacto | Justificación |
|----|---------------|--------|---------|------------|---------------|
| 100 | Operador quita pieza durante tapizado | 10 | 4 | H→L | Efecto end-user "No afecta". Seguridad del operador, no del producto. No es flamabilidad/airbag/emisiones/bordes filosos |
| 50 | Fallo/degradación componente máquina (suciedad, fricción) | 9 | 6 | H→M | Degradación de calidad de costura = defecto estético, no seguridad. Costura torcida = S=5-6 per calibración |
| 50 | Patrón costura no coincide con plantilla | 9 | 7 | H→H/M | Programa incorrecto puede producir pieza no ensamblable → mantiene SC como falla de ensamble, pero no es seguridad → baja de 9 a 7 |
| 110 | Defecto de aspecto no detectado en inspección final | 9 | 6 | H→L | Defecto estético no detectado ≠ seguridad. Manchas, roturas, despegues son cosméticos |
| 110 | Defecto de costura no detectado en inspección final | 9 | 6 | H→L | Costura que se abre en uso = durabilidad, no seguridad para un insert |
| 50 | Falla sensor detección plantilla / material con pliegues | 8 | 6 | H→M | Pliegues en costura = defecto estético/dimensional, no funcional |
| 50 | Ruptura/enredo del hilo, costura incompleta/saltada (5 causas) | 8 | 5 | H→M | Costura saltada/incompleta = retrabajo offline. Per calibración: costuras torcidas = S=5-6 |
| 60 | Parte ensamblada con material incorrecto | 8 | 5 | H→L | Espuma incorrecta en troquelado = retrabajo, no afecta encastre |
| 60 | Material fuera de posición | 8 | 5 | H→M | Espuma mal posicionada = cosmético/retrabajo |
| 80 | Pérdida de adherencia | 8 | 5 | M→L | Delaminación por adhesivo = S=5-6 per calibración |
| 90/91 | Adhesión insuficiente (6 causas) | 8 | 6 | H→M | Delaminación = S=5-6 per calibración. S=6 por ser proceso crítico con múltiples causas |
| 100 | Se coloca mal el vinilo / Falla proceso automático | 8 | 5 | M→L / H→M | Cosmético, retrabajo offline |
| 100 | Parámetros máquina fuera de spec (2 causas) | 8 | 6 | M→M | Despegue tapizado = delaminación = S=5-6 |
| 103 | Falta adhesivo / cobertura incompleta (3 causas) | 8 | 5 | H→M | Apariencia/ruido = S=5-6 per calibración (ruidos S&R) |
| 105 | Corte excesivo / Daño vinilo durante refilado | 8 | 5 | M→L | Defecto estético, retrabajo |
| 111 | Pieza NC clasificada como Conforme (3 causas) | 8 | 7 | H→H | Inspección que protege encastre. Peor NC escapable = sustrato deformado (S=8) → S=7 para el proceso de segregación |
| 111 | Mezcla NC con OK en embalaje (2 causas) | 8 | 7 | H→H | Mismo criterio: protege contra escape de NC de encastre |
| 110 | Vinilo despegado | 8 | 6 | H→M | Delaminación = S=5-6 |
| 20 | Selección incorrecta del material | 8 | 6 | M→L | Vinilo incorrecto = cosmético para insert. No afecta encastre |
| 10 | Falta de documentación o trazabilidad (3 causas) | 7 | 4 | L/H/M→L | Efecto end-user "No afecta". Proceso administrativo |
| 10 | Omisión verificación insumos en recepción (6 causas) | 7 | 5 | M→L | No verificar color de hilo, fecha adhesivo, etc. = riesgo de defecto estético. Retrabajo offline |
| 15 | Corte fuera de medida | 7 | 5 | H→H | Paño mal cortado = retrabajo offline, no afecta ensamble en VW |
| 20 | Vinilo mal identificado / Corte incompleto o irregular | 7 | 5 | H→M | Cosmético, retrabajo |
| 30/61/71/81/92 | Faltante/exceso/componente incorrecto/pieza dañada en kit (15 causas) | 7 | 5 | H→M | Kits mal armados = retrabajo offline. No afecta encastre |
| 60 | Troquel/herramental incorrecto | 7 | 5 | H→M | Troquelado errado = retrabajo |
| 70 | Rebaba excesiva / exceso de material (4 causas) | 7 | 5 | M/H→L/M | Rebaba = cosmético, no afecta encastre. Se recorta |
| 105 | Refilado incompleto / exceso material sobrante (2 causas) | 7 | 5 | H/M→M/L | Defecto estético, retrabajo |
| 111 | Etiqueta de Descarte/Retrabajo omitida (3 causas) | 5 | 4 | L→L | Sin efecto en usuario final |
| 120 | Pieza deformada por mal posicionamiento en embalaje | 7 | 4 | M→L | "El error se corrige antes de llegar al usuario" |
| 10 | Material golpeado o dañado (4 causas) | 6 | 5 | M→M | Ruido o falla estética = cosmético |
| 10 | Material con especificación errónea (2 causas) | 6 | 5 | L/M→L/M | Aspecto/comfort = cosmético |
| 10 | Contaminación/suciedad (2 causas) | 6 | 5 | M→M | Cosmético |
| 15 | Contaminación/suciedad en preparación (2 causas) | 5 | 4 | L→L | Cosmético menor, detectable en station |
| 25 | Omitir inspección con Mylar | 6 | 5 | M→M | Cosmético |
| 40 | Posicionado NOK / Refilado fuera de spec (3 causas) | 6 | 5 | M→M | Cosmético, retrabajo |
| 80 | Adhesión defectuosa prearmado | 6 | 5 | M→M | Cosmético, retrabajo |

### Reclasificación CC/SC

| OP | Característica | Clasif. actual | Clasif. propuesta | Justificación |
|----|---------------|----------------|-------------------|---------------|
| 100 | Quitar pieza durante tapizado | CC | Estándar | No cumple ningún criterio CC (no es flamabilidad/airbag/emisiones/bordes filosos). Seguridad del operador, no del producto |
| 110 | Defecto aspecto no detectado | CC | Estándar | Defecto cosmético ≠ seguridad. S propuesta = 6 |
| 110 | Defecto costura no detectado | CC | Estándar | Costura abierta en uso = durabilidad, no seguridad para insert. S propuesta = 6 |
| 10 | Material golpeado/dañado (4 causas) | SC | Estándar | S=5 (cosmético). SC requiere S=7-8 en encastre o designación de cliente |
| 10 | Material especificación errónea (2 causas) | SC | Estándar | S=5 (cosmético). No afecta función primaria |
| 10 | Contaminación/suciedad (2 causas) | SC | Estándar | S=5 (cosmético) |
| 15 | Corte fuera de medida / Contaminación (3 causas) | SC | Estándar | S=4-5 (retrabajo). No afecta encastre |
| 20 | Selección incorrecta / Vinilo mal identificado / Corte incompleto (3+) | SC | Estándar | Cosmético, no encastre |
| 25 | Omitir inspección Mylar | SC | Estándar | Cosmético |
| 30/61/71/81/92 | Kit assembly (15 causas) | SC | Estándar | Retrabajo offline, no función primaria |
| 40 | Posicionado NOK / Refilado (3 causas) | SC | Estándar | Cosmético |
| 50 | Falla sensor, ruptura hilo, fallo máquina (12 causas) | SC | Estándar | Costura = cosmético. S reducida a 5-6 |
| 60 | Material incorrecto/posición/troquel (3 causas) | SC | Estándar | Troquelado espuma = retrabajo |
| 70 | Rebaba excesiva (3 causas) | SC | Estándar | Cosmético, se recorta |
| 71 | Kit inyección plástica (3 causas) | SC | Estándar | Retrabajo |
| 80/81 | Adhesión defectuosa / kits prearmado (5 causas) | SC | Estándar | Delaminación espuma = cosmético |
| 90/91 | Adhesión insuficiente (6 causas) | SC | Estándar | Delaminación adhesivo = S=5-6 |
| 100 | Falla proceso / parámetros (2 causas) | SC | Estándar | Cosmético/delaminación |
| 103 | Falta/exceso adhesivo (4 causas) | SC | Estándar | Ruido/apariencia = S=5 |
| 105 | Refilado/corte/daño (4 causas) | SC | Estándar | Cosmético |
| 110 | Vinilo despegado / Aprobación NC (2 causas) | SC | Estándar | Delaminación / S=5 |
| 111 | Etiqueta omitida (3 causas) | SC | Estándar | Sin efecto end-user |

### Items que MANTIENEN CC (confirmados)

**Ninguno**. El AMFE del Insert NO contiene modos de falla de:
- Flamabilidad (TL 1010 VW)
- Emisiones tóxicas / VOCs
- Interferencia con despliegue de airbag lateral
- Bordes filosos expuestos al habitáculo

**ACCION REQUERIDA**: Si alguno de estos riesgos aplica al producto Insert, DEBEN agregarse al AMFE como nuevos modos de falla con S=9-10 y clasificación CC.

### Items que MANTIENEN SC (confirmados)

| OP | Característica | S | Justificación |
|----|---------------|---|---------------|
| 70 | Llenado incompleto de pieza inyectada (2 causas) | 8 | Sustrato deformado = falla de encastre que para línea VW. Criterio directo de SC |
| 70 | Omitir inspección dimensional de cotas index (2 causas) | 7 | Cotas index fuera de tolerancia = pieza no ensambla en VW. Dimensión de ensamble crítica |
| 50 | Patrón costura no coincide con plantilla (3 causas) | 7 (era 9) | Programa incorrecto produce pieza no-funcional → no ensambla. Equivalente a sustrato deformado en impacto |
| 111 | Pieza NC clasificada como Conforme (3 causas) | 7 (era 8) | Inspección que protege contra escape de NC de encastre (sustrato deformado). S alineada al peor defecto que puede escapar |
| 111 | Mezcla de NC con OK en embalaje (2 causas) | 7 (era 8) | Mismo criterio: barrera contra escape de pieza no-ensamblable a VW |

---

## ARMREST DOOR PANEL

**Estado actual**: 1 CC, 46 SC, 62 estándar sobre 109 causas (CC+SC = 43.1%)
**Propuesta**: 0 CC, 7 SC, 102 estándar (CC+SC = 6.4%)

### Cambios propuestos de Severidad

| OP | Modo de falla | S act. | S prop. | AP impacto | Justificación |
|----|---------------|--------|---------|------------|---------------|
| 90 | Operador quita pieza durante tapizado | 10 | 4 | L→L | Seguridad operador, no producto. "Riesgo para la salud del operador" no es criterio CC per calibración |
| 101 | Pieza NC clasificada como Conforme (3 causas) | 10 | 7 | H→H | Armrest no es pieza de seguridad. "Pérdida función primaria para conducción" es incorrecto: un apoyabrazos no afecta conducción. Peor caso = paro de línea VW |
| 60 | Llenado incompleto (2 causas) | 9 | 8 | H→M/H | Sustrato deformado = SC, pero no seguridad → baja de 9 a 8 |
| 60 | Omitir inspección cotas index (2 causas) | 8 | 7 | M→M | Dimensiones de ensamble. Mantiene SC |
| 50/51 | Costura descosida, desviada, puntadas irregulares (~18 causas) | 8 | 5 | M→L | "Defecto estético sin impacto funcional" (dice el propio efecto end-user). Costuras = S=5-6 |
| 51 | Rotura vinilo en zona costura (2 causas) | 8 | 5 | M→L | "Puede causar falla en uso" — para un apoyabrazos, el vinilo roto es cosmético |
| 51 | Largo/toma de puntada fuera de spec (2 causas) | 8 | 5 | M→L | Cosmético |
| 30/52/61/82 | Faltante/exceso/componente incorrecto en kit (~12 causas) | 7-8 | 5 | H→M / M→L | Retrabajo offline |
| 80/81 | Adhesión insuficiente (6 causas) | 8 | 6 | H→M / M→L | Delaminación adhesivo = S=5-6 |
| 90 | Se coloca pieza de otro producto / vinilo mal / pieza mal | 8 | 5 | L/M→L | Cosmético, retrabajo |
| 100 | Aprobación pieza NC / Vinilo despegado (2 causas) | 8 | 6 | H→M | Delaminación = S=6. Inspección general, no de seguridad |
| 103 | Falta/exceso adhesivo, mezcla NC, etiqueta omitida (10 causas) | 8 | 5-6 | H→M / M→L | Apariencia/ruido/proceso interno |
| 110 | Pieza deformada embalaje | 8 | 5 | M→L | Cosmético, retrabajo |
| 10 | Material golpeado/dañado (3 causas) | 7 | 5 | M/H→L/M | Ruido o falla estética = cosmético |
| 10 | Material especificación errónea (2 causas) | 7 | 5 | H/M→M/L | Aspecto/comfort |
| 10 | Falta documentación (3 causas) | 6 | 4 | M/L→L | Proceso administrativo, no end-user |
| 15 | Corte fuera de medida | 7 | 5 | H→M | Retrabajo offline |
| 20 | Desviación en corte (2 causas) | 7 | 5 | H→M | Retrabajo |
| 20 | Corte incompleto o irregular | 7 | 5 | H→M | Cosmético |
| 40 | Posicionado NOK / Refilado fuera de spec (3 causas) | 7 | 5 | H→M | Cosmético |
| 50 | Costura salteada (3 causas) | 7 | 5 | M→L | Cosmético |
| 70 | Inyección PU (8 causas) | 5 | 5 | — | Sin cambio de S. Ya correctamente calibrado |
| 72 | Ensamble sustrato con espuma (4 causas) | 5-7 | 5 | M→L | Retrabajo |
| 71 | Espuma se suelta | 7 | 5 | H→M | Ergonomía, no encastre. Comfort |

### Reclasificación CC/SC

| OP | Característica | Clasif. actual | Clasif. propuesta | Justificación |
|----|---------------|----------------|-------------------|---------------|
| 90 | Quitar pieza durante tapizado | CC | Estándar | Seguridad operador ≠ criterio CC de producto |
| 10 | Material golpeado/especificación/contaminación (6 causas) | SC (parcial) | Estándar | Cosmético, S=5 |
| 15/20 | Corte fuera de medida / incompleto | SC | Estándar | Retrabajo, S=5 |
| 25 | Omitir inspección Mylar | SC | Estándar | Cosmético |
| 30/52/61/82 | Kit assembly (12 causas) | SC | Estándar | Retrabajo offline |
| 40 | Refilado (3 causas) | SC | Estándar | Cosmético |
| 60 | Rebaba excesiva / Parámetros inyección (5+ causas) | SC (parcial) | Estándar | Cosmético, se recorta |
| 71 | Espuma se suelta | SC | Estándar | Comfort, no encastre |
| 80/81 | Adhesión insuficiente (6 causas) | SC | Estándar | Delaminación = cosmético |
| 90 | Vinilo despegado / mal vinilo (2 causas) | SC | Estándar | Delaminación |
| 100 | Vinilo despegado / Aprobación NC | SC | Estándar | Delaminación |
| 103 | Exceso adhesivo / mezcla NC (3 causas) | SC | Estándar | Cosmético/proceso |

### Items que MANTIENEN CC (confirmados)

**Ninguno**. Misma situación que Insert: no existen modos de falla de flamabilidad, emisiones, airbag, o bordes filosos.

**ACCION REQUERIDA**: Evaluar si aplican modos de falla de flamabilidad (TL 1010) al apoyabrazos. Si aplica, agregar como CC.

### Items que MANTIENEN SC (confirmados)

| OP | Característica | S | Justificación |
|----|---------------|---|---------------|
| 60 | Llenado incompleto de pieza inyectada (2 causas) | 8 (era 9) | Sustrato deformado = falla de encastre |
| 60 | Omitir inspección dimensional cotas index (2 causas) | 7 (era 8) | Dimensiones de ensamble críticas |
| 101 | Pieza NC clasificada como Conforme (3 causas) | 7 (era 10) | Inspección que protege contra escape de NC de encastre a VW |

---

## TOP ROLL

**Estado actual**: 3 CC, 15 SC, 31 estándar sobre 49 causas (CC+SC = 36.7%)
**Propuesta**: 2 CC, 7 SC, 40 estándar (CC+SC = 18.4%)

### Cambios propuestos de Severidad

| OP | Modo de falla | S act. | S prop. | AP impacto | Justificación |
|----|---------------|--------|---------|------------|---------------|
| 30 | Temperatura lámina TPO insuficiente | 10 | 5 | H→M | Efecto end-user "Deformaciones o pérdida de textura" = cosmético puro. S=10 totalmente injustificado |
| 20 | Posible quemadura en el operario | 10 | 4 | L→L | Seguridad operador, no producto |
| 70 | Tweeter dañado internamente (bobina abierta / membrana rota) | 10 | 5 | H→L | Pérdida de función de audio = comfort, no seguridad. Un tweeter roto no pone en riesgo al ocupante |
| 10 | Llenado incompleto de pieza inyectada (2 causas) | 9 | 8 | H→M | Sustrato deformado = SC, pero no seguridad → baja de 9 a 8 |
| 80 | Pieza mal identificada / etiqueta mixta | 9 | 7 | L→L | Pieza incorrecta en vehículo = paro línea VW, no seguridad |
| 5 | Material con especificación errónea (2 causas) | 8 | 6 | H→M | Aspecto/calidad, no función |
| 10 | Rebaba excesiva (2 causas) | 8 | 5 | H/M→M/L | Cosmético, se recorta |
| 11 | Componente incorrecto / Pieza dañada en kit | 8-7 | 5 | M→L | Retrabajo |
| 20 | Adhesión deficiente hot melt / quemaduras vinilo (3 causas) | 8 | 6 | H/M→M/L | Delaminación = S=5-6 |
| 20 | Peso vinilo adhesivado incorrecto | 8 | 6 | H→M | Calidad proceso |
| 40 | Contorno de corte desplazado | 8 | 5 | M→L | Ruidos S&R = S=5-6 per calibración |
| 5 | Material golpeado/dañado (3 causas) | 7 | 5 | H/M→M/L | Cosmético |
| 5 | Falta documentación | 7 | 4 | M→L | Proceso administrativo |
| 10 | Omitir inspección cotas index (2 causas) | 7 | 7 | — | Sin cambio. Mantiene SC |
| 60 | Soldadura fría / marca rechupe / refuerzo faltante | 7 | 5 | M/L→L | Ruidos o cosmético. El ensamble interno de refuerzos no es visible ni afecta seguridad |
| 70 | Soldadura fría tweeter / marca rechupe | 7 | 5 | M/L→L | Audio/cosmético |
| 80 | Fuga de defecto visual | 7 | 5 | H→M | Cosmético |
| 90 | Etiqueta incorrecta / piezas mezcladas | 7 | 7 | — | Sin cambio de S. Mantiene SC |

### Reclasificación CC/SC

| OP | Característica | Clasif. actual | Clasif. propuesta | Justificación |
|----|---------------|----------------|-------------------|---------------|
| 70 | Tweeter dañado internamente | CC | Estándar | Pérdida de audio ≠ seguridad. No cumple ningún criterio CC |
| 30 | Temperatura lámina TPO insuficiente | SC | Estándar | Cosmético (textura). S propuesta = 5 |
| 5 | Material golpeado/especificación (5 causas) | SC (parcial) | Estándar | Cosmético |
| 10 | Rebaba excesiva (2 causas) | SC | Estándar | Cosmético |
| 20 | Adhesión deficiente (1 causa) | SC | Estándar | Delaminación |
| 40 | Contorno corte desplazado | SC | Estándar | Ruidos S&R |

### Items que MANTIENEN CC (confirmados)

| OP | Característica | S | Justificación |
|----|---------------|---|---------------|
| 30 | Espesor de pared excesivo en zona de ruptura de Airbag | 10 | Interferencia directa con despliegue de airbag lateral. Criterio CC inequívoco. Espesor excesivo impide ruptura controlada de la zona de airbag |
| 80 | Pieza NC aceptada y enviada (Fuga de defecto de seguridad) | 10 | Inspección final que protege contra escape de la CC de airbag (OP30). Si falla, el defecto de seguridad llega a VW |

### Items que MANTIENEN SC (confirmados)

| OP | Característica | S | Justificación |
|----|---------------|---|---------------|
| 10 | Llenado incompleto de pieza inyectada (2 causas) | 8 (era 9) | Sustrato deformado = encastre |
| 10 | Omitir inspección dimensional cotas index (2 causas) | 7 | Dimensiones de ensamble críticas |
| 50 | Despegue parcial del material en zona de plegado (2 causas) | 7 | Desprendimiento de material decorativo en campo. Criterio directo de SC ("desprendimiento en campo") |
| 80 | Pieza mal identificada / etiqueta mixta | 7 (era 9) | Pieza incorrecta montada en vehículo. Paro de línea VW |
| 90 | Etiqueta incorrecta / piezas mezcladas | 7 | Mismo criterio: pieza incorrecta en vehículo |

---

## HEADREST FRONT (Apoyacabezas Delantero)

**Estado actual**: 2 CC, 4 SC, 56 estándar sobre 62 causas (CC+SC = 9.7%)
**Propuesta**: 3 CC, 5 SC, 54 estándar (CC+SC = 12.9%)

### Cambios propuestos de Severidad

| OP | Modo de falla | S act. | S prop. | AP impacto | Justificación |
|----|---------------|--------|---------|------------|---------------|
| 10 | Falta de documentación o trazabilidad (4 causas) | 8 | 4 | M/H→L | Efecto end-user "No afecta". S=8 para un problema administrativo es injustificado |
| 30/40 | Costura descosida o débil (6 causas) | 8 | 5 | M→L | Efecto "Descarte" es interno. Para headrest, costura defectuosa = retrabajo/descarte, no afecta ensamble en VW |
| 70 | Costura vista con desviación o imperfección estética (3 causas) | 8 | 7 | M→M | Efecto "Paro de línea >1 turno y reclamo severo" justifica S=7-8 y SC. Reduce a S=7 |
| 80 | Pieza deformada por mal posicionamiento en embalaje | 8 | 5 | M→L | Cosmético, retrabajo |

### Reclasificación CC/SC

| OP | Característica | Clasif. actual | Clasif. propuesta | Justificación |
|----|---------------|----------------|-------------------|---------------|
| 50 | EPP no insertado completamente en varilla (3ra causa: falla máquina) | Estándar | **CC** | Mismo modo de falla que las 2 causas ya CC. S=9, efecto "Riesgo de seguridad". EPP defectuoso = headrest no protege en impacto trasero |
| 10 | Material con especificación errónea (3 causas) | SC | Estándar | S=6 = estándar per calibración. Cosmético |
| 10 | Contaminación/suciedad (1 causa) | SC | Estándar | S=6 = estándar per calibración |
| 70 | Costura vista con desviación (3 causas) | Estándar | **SC** | S=7, efecto = paro de línea VW >1 turno. Cumple criterio SC |
| 90 | Dimensiones fuera de tolerancia (2 causas) | Estándar | **SC** | S=7, dimensional → afecta ensamble headrest en asiento. Dimensión de ensamble crítica |

### Items que MANTIENEN CC (confirmados)

| OP | Característica | S | Justificación |
|----|---------------|---|---------------|
| 50 | EPP no es completamente insertado en la varilla (3 causas) | 9 | **Seguridad del ocupante**. El insert de EPP (polipropileno expandido) es el componente que absorbe energía en impacto trasero. Si el EPP no está correctamente ensamblado en la varilla, el headrest no cumple su función de protección cervical. Requerimiento de seguridad del vehículo |

### Items que MANTIENEN SC (confirmados)

| OP | Característica | S | Justificación |
|----|---------------|---|---------------|
| 70 | Costura vista con desviación (3 causas) | 7 (era 8) | Efecto declarado: paro de línea VW >1 turno. Impacto en función de ensamble |
| 90 | Dimensiones fuera de tolerancia (2 causas) | 7 | Desgaste de moldes/variación inyección afecta dimensional → headrest no ensambla en asiento |

---

## HEADREST REAR CENTER (Apoyacabezas Trasero Central)

**Estado actual**: 0 CC, 4 SC, 53 estándar sobre 57 causas (CC+SC = 7.0%)
**Propuesta**: 0 CC, 5 SC, 52 estándar (CC+SC = 8.8%)

### Cambios propuestos de Severidad

| OP | Modo de falla | S act. | S prop. | AP impacto | Justificación |
|----|---------------|--------|---------|------------|---------------|
| 10 | Falta de documentación o trazabilidad (4 causas) | 8 | 4 | M/H→L | Efecto end-user "No afecta" |
| 30/40 | Costura descosida o débil (6 causas) | 8 | 5 | M→L | Descarte interno = retrabajo |
| 60 | Costura vista con desviación (3 causas) | 8 | 7 | M→M | Paro de línea VW >1 turno |
| 70 | Pieza deformada embalaje | 8 | 5 | M→L | Cosmético |

### Reclasificación CC/SC

| OP | Característica | Clasif. actual | Clasif. propuesta | Justificación |
|----|---------------|----------------|-------------------|---------------|
| 10 | Material con especificación errónea (3 causas) | SC | Estándar | S=6 = estándar per calibración |
| 10 | Contaminación/suciedad (1 causa) | SC | Estándar | S=6 = estándar |
| 60 | Costura vista con desviación (3 causas) | Estándar | **SC** | S=7, paro de línea VW |
| 90 | Dimensiones fuera de tolerancia (2 causas) | Estándar | **SC** | S=7, dimensional de ensamble |

### Items que MANTIENEN CC (confirmados)

**Ninguno**. El headrest trasero central no tiene varilla con EPP (a diferencia del delantero). No hay modos de falla de seguridad. Correcto que CC=0.

### Items que MANTIENEN SC (confirmados)

| OP | Característica | S | Justificación |
|----|---------------|---|---------------|
| 60 | Costura vista con desviación (3 causas) | 7 (era 8) | Paro de línea VW >1 turno |
| 90 | Dimensiones fuera de tolerancia (2 causas) | 7 | Dimensional de ensamble |

---

## HEADREST REAR OUTER (Apoyacabezas Trasero Lateral)

**Estado actual**: 0 CC, 4 SC, 53 estándar sobre 57 causas (CC+SC = 7.0%)
**Propuesta**: 0 CC, 5 SC, 52 estándar (CC+SC = 8.8%)

Análisis idéntico al Headrest Rear Center. Mismos modos de falla, mismas severidades, mismas propuestas.

*(Se omiten tablas duplicadas — aplicar exactamente los mismos cambios que Headrest Rear Center)*

---

## TELAS PLANAS (PWA)

**Estado actual**: 2 CC, 0 SC, 36 estándar sobre 38 causas (CC+SC = 5.3%)
**Propuesta**: 2 CC, 4 SC, 32 estándar (CC+SC = 15.8%)

### Cambios propuestos de Severidad

| OP | Modo de falla | S act. | S prop. | AP impacto | Justificación |
|----|---------------|--------|---------|------------|---------------|
| 80 | Menor de 25 piezas por medio | 8 | 4 | M→L | Efecto "Sin impacto directo en usuario final". Conteo incorrecto = proceso logístico |
| 80 | Error de identificación | 8 | 4 | M→L | "Sin impacto directo en usuario final" |
| 80 | Falta de identificación | 8 | 4 | M→L | "Sin impacto directo en usuario final" |
| 80 | Mayor de 25 piezas por medio | 7 | 4 | M→L | "Sin impacto directo en usuario final" |

**Nota**: La mayoría de ítems de telas planas tienen S=7 y O=2-6. El S=7 es debatible para telas que afectan dimensional en asiento, pero dado que no son piezas de encastre directo, se mantiene S=7 para los ítems que afectan ensamble en el cliente y se propone SC para los más críticos.

### Reclasificación CC/SC

| OP | Característica | Clasif. actual | Clasif. propuesta | Justificación |
|----|---------------|----------------|-------------------|---------------|
| 30 | Termoformado incompleto | Estándar | **SC** | S=7, pieza incompleta no ensambla en asiento del cliente |
| 30 | Termoformado con roturas | Estándar | **SC** | S=7, pieza con roturas afecta función en uso |
| 30 | Pieza con roturas | Estándar | **SC** | S=7, misma justificación |
| 40 | Corte perimetral incompleto | Estándar | **SC** | S=7, dimensional afecta ensamble |

### Items que MANTIENEN CC (confirmados)

| OP | Característica | S | Justificación |
|----|---------------|---|---------------|
| 10 | Flamabilidad fuera de especificación (100 mm/min) | 10 | **Flamabilidad (TL 1010 VW)**. Criterio CC inequívoco. Tela que no cumple velocidad de quemado = riesgo de seguridad ante incendio en vehículo |
| 10b | Flamabilidad fuera de especificación (punzonado con bi-componente) | 10 | Mismo criterio de flamabilidad para el material punzonado |

### Items que MANTIENEN SC (confirmados)

| OP | Característica | S | Justificación |
|----|---------------|---|---------------|
| 30 | Termoformado incompleto / con roturas / pieza con roturas (3 causas) | 7 | Pieza defectuosa no ensambla correctamente en línea del cliente (Toyota). Función primaria del componente |
| 40 | Corte perimetral incompleto | 7 | Dimensional fuera de spec afecta ensamble |

---

## TELAS TERMOFORMADAS (PWA)

**Estado actual**: 0 CC, 0 SC, 21 estándar sobre 21 causas (CC+SC = 0%)
**Propuesta**: 1 CC, 0 SC, 20 estándar (CC+SC = 4.8%)

### Cambios propuestos de Severidad

| OP | Modo de falla | S act. | S prop. | AP impacto | Justificación |
|----|---------------|--------|---------|------------|---------------|
| 30 | **Refuerzo costurado opuesto al airbag posicionado de manera inversa** | **7** | **10** | M→M | **UPGRADE CRITICO**. Efecto end-user = "Falla de protección ante despliegue de airbag". Esto ES interferencia directa con airbag lateral. S=7 es peligrosamente bajo. DEBE ser S=9-10 CC |
| 30 | Costura floja / deficiente | 8 | 5 | M→L | "Degradación prematura de la costura en uso" = durabilidad cosmética |
| 60 | Dimensional fuera de especificación | 8 | 6 | M→M | Dimensional puede afectar ensamble pero no es seguridad |
| 70 | Menor cantidad de piezas por medio | 8 | 4 | M→L | "Sin impacto directo en usuario final" |
| 70 | Error de identificación | 8 | 4 | M→L | "Sin impacto directo en usuario final" |
| 70 | Falta de identificación | 8 | 4 | M→L | "Sin impacto directo en usuario final" |

### Reclasificación CC/SC

| OP | Característica | Clasif. actual | Clasif. propuesta | Justificación |
|----|---------------|----------------|-------------------|---------------|
| 30 | **Refuerzo opuesto al airbag posicionado inversamente** | **Estándar** | **CC** | Interferencia directa con despliegue de airbag lateral. Si el refuerzo está invertido, el airbag no puede desplegarse correctamente. Criterio CC inequívoco |

### Items que MANTIENEN CC (confirmados)

| OP | Característica | S | Justificación |
|----|---------------|---|---------------|
| 30 | Refuerzo costurado opuesto al airbag posicionado de manera inversa | 10 (era 7) | **Interferencia con despliegue de airbag lateral**. El refuerzo costurado en el lado opuesto al airbag está diseñado para facilitar la ruptura controlada de la tela cuando el airbag se despliega. Si está invertido, la tela resiste el despliegue → riesgo directo para seguridad del ocupante |

### Items que MANTIENEN SC (confirmados)

**Ninguno**. Los modos de falla restantes son de calidad dimensional o proceso logístico, sin impacto en función primaria o ensamble crítico.

---

## Hallazgos transversales

### 1. Patrón: "Quitar pieza durante tapizado" con S=10 CC (Insert OP100 y Armrest OP90)
- Ambos AMFEs califican la extracción prematura de pieza como S=10 CC por riesgo al operador
- Per calibración AIAG-VDA para producto, la severidad se evalúa por efecto en el end-user, no en el operador
- Ambos declaran efecto end-user "No afecta" / "Riesgo para salud del operador"
- **Propuesta**: S=4 estándar. El riesgo al operador se gestiona con procedimientos de seguridad industrial (EPP, lockout/tagout), no con clasificación CC de producto
- **Nota**: Algunas interpretaciones de AIAG-VDA sí califican S=10 para riesgo al operador. Esta reclasificación es debatible y requiere consenso del equipo multidisciplinario

### 2. Patrón: Kit assembly repetido con S=7 SC (Insert tiene 5 operaciones de kit, Armrest tiene 4)
- Las operaciones de armado de kit (OP 30, 61, 71, 81, 92 en Insert; OP 30, 52, 61, 82 en Armrest) repiten el mismo patrón: faltante/exceso/componente incorrecto/pieza dañada
- Todas con S=7 SC cuando el efecto real es retrabajo offline
- **Propuesta**: S=5 estándar para todos. Los errores de kit se detectan y corrigen antes del envío

### 3. Patrón: Costura calificada como "pérdida de función primaria" con S=8-9
- En Insert OP50, múltiples modos de falla de costura están en S=8-9 con efecto "Pérdida de función primaria del vehículo"
- Para un insert tapizado, la costura es estética/durabilidad. "Función primaria del vehículo" aplica a frenos, dirección, airbags — no a costuras de un panel interior
- **Propuesta**: S=5-6 per calibración ("costuras torcidas", "delaminación")

### 4. GAP CRITICO: AMFEs sin modos de falla de flamabilidad
- **Insert y Armrest** no contienen modos de falla de flamabilidad (TL 1010 VW)
- Si estos productos usan materiales que deben cumplir TL 1010, DEBE agregarse un modo de falla con S=10 CC
- Telas Planas SÍ tiene este modo de falla correctamente calibrado

### 5. UPGRADE CRITICO: Telas Termoformadas — airbag a S=7 sin clasificación
- OP30 "Refuerzo opuesto al airbag posicionado inversamente" tiene S=7 sin clasificación
- El efecto declarado es "Falla de protección ante despliegue de airbag"
- Esto es una CC con S=10. Calificarla como S=7 estándar es un riesgo no aceptable

---

## Impacto global en AP (Action Priority)

La reducción de severidades produce los siguientes cambios en prioridad de acción:

| Cambio de AP | Cantidad estimada de causas | Productos más afectados |
|-------------|---------------------------|------------------------|
| H → M | ~45 causas | Insert (30), Armrest (10), Top Roll (5) |
| H → L | ~15 causas | Insert (8), Armrest (5), Top Roll (2) |
| M → L | ~60 causas | Insert (35), Armrest (20), Headrests (5) |
| Sin cambio | ~380 causas | Ya estaban en L, o el cambio de S no afecta AP |
| L → M (upgrade) | ~1 causa | Telas Termoformadas (airbag S=7→10) |

**Nota**: Los ítems que pasan de AP=H a AP=M o AP=L ya no requieren acciones de mitigación obligatorias per AIAG-VDA. Sin embargo, las acciones preventivas y de detección existentes en el AMFE siguen siendo válidas como buenas prácticas de manufactura.

---

## Próximos pasos (requieren decisión del equipo multidisciplinario)

1. **Revisar este reporte** con el equipo de calidad, ingeniería de proceso y el cliente (VW/Toyota)
2. **Validar la posición sobre S=10 por riesgo al operador** (quitar pieza de tapizado): ¿se mantiene como CC o se reclasifica?
3. **Agregar modos de falla de flamabilidad** a Insert y Armrest si aplica TL 1010
4. **Implementar el upgrade** de Telas Termoformadas OP30 (airbag) a S=10 CC de forma prioritaria
5. **Actualizar severidades** en AMFEs según este reporte
6. **Regenerar Planes de Control** para que la clasificación CC/SC se propague correctamente
7. **Revalidar acciones preventivas**: las acciones existentes en ítems que bajan de H a M/L pueden simplificarse

---

*Este reporte es una propuesta de revisión. NO se modificaron datos en Supabase. Todos los cambios requieren aprobación del equipo multidisciplinario antes de implementarse.*
