# Lecciones del ejercicio 14 (reglas del banco como controles adentro de la pieza) — CATA, 24/10/2026

Corridas reales: CATIA R21 (B21, 32 bits) de CATA con el Python 3.12.10 del sistema. `14_r1` (09:42) salió verde al
primer intento con el control «Radio >= 1.5mm»; el revisor Fable marcó que en «sin radio» el rojo lo ponía el script
(Radio 0), no el control: con los redondeos apagados y Radio en 1,5 el control quedaba VERDE con la pieza mal. Se agregó
el booleano «Redondeado» (lección 4) y se volvió a correr con el código que se sube: `14_r2`, 09:59:00 a 10:00:22, 21 pasos
sin falla, los mismos volúmenes y controles de abajo.

| Variante | Parámetro | CATIA (mm³) | build123d (script del banco) | Control | Esperado |
|---|---|---:|---:|---|---|
| mango_bien | Radio 1,5 | 57 651,580 | 57 651,580 (05/bien.py) | cumple | verde |
| mango_mal_2 | Radio 0,5 | 57 951,814 | 57 951,814 (05/mal_2_radio_0_5.py) | NO cumple | rojo |
| mango_mal_1 | Redondeado falso, Radio 1,5 | 57 989,381 | 57 989,381 (05/mal_1_sin_radio.py) | NO cumple | rojo |
| nido_bien | Luz 0,2 | 163 397,600 | 163 397,600 (04/bien.py, parte nido) | cumple | verde |
| nido_mal_1 | Luz 0 | 164 000,000 | 164 000,000 (04/mal_1_luz_cero.py) | NO cumple | rojo |
| nido_mal_2 | Luz 1 | 160 940,000 | 160 940,000 (04/mal_2_luz_1mm.py) | NO cumple | rojo |

Centros de gravedad a 0,0005 mm o menos en las seis. El STEP de la variante buena de cada pieza, medido con build123d,
da lo mismo.

Para la centralización (LECCIONES_CATIA.md / catia.md):

1. **El control va sobre un parámetro PROPIO que mueve la geometría, y el cruce de volumen prueba que la mueve**: si
   el control mirara un parámetro suelto (o nombres internos de cotas, la trampa de catia.md), quedaría verde con la
   pieza mal. Con `Radio` → `Radius` de los dos redondeos y `Luz` → las cuatro cotas del croquis, cada variante dio el
   volumen del script del banco: el parámetro y la geometría van juntos.
2. **Croquis acotado contra los ejes por COM**: cuatro rectas con `cb.poligono` (puntos compartidos), una restricción
   horizontal o vertical por recta (`AddMonoEltCst` 10 / 13) y una de distancia de cada recta al eje del croquis
   (`AddBiEltCst(1, recta, sk.AbsoluteAxis.HorizontalReference | VerticalReference)`) con su fórmula
   (`CreateFormula(nombre, "", restriccion.Dimension, "30mm + Luz")`). Cambiar `Luz` y `part.Update()` rehízo el
   bolsillo exacto en 0; 0,2 y 1.
3. **Las expresiones de un control aceptan `and`**: `Luz >= 0.1mm and Luz <= 0.4mm` dio `Diagnosis` True con 0,2 y False
   con 0 y con 1. Las constantes llevan unidad (`1.5mm`).
4. **«Sin radio» es APAGAR el redondeo, y el control tiene que verlo** (un redondeo de radio 0 no existe en CATIA).
   Cada operación tiene su parámetro `Activity` en `part.Parameters` (`mango_reglas\PartBody\EdgeFillet.1\Activity`, y
   el `.2`): una fórmula lo ata a un booleano propio (`Parameters.CreateBoolean("Redondeado", True)` +
   `CreateFormula("activo_paso_1", "", activity, "Redondeado")`) y el control lo nombra:
   `Radio >= 1.5mm and Redondeado == true`. Con Redondeado falso y Radio en 1,5, CATIA apagó los dos redondeos (volumen
   57 989,381 = 60 000 − 2 π·4²·20, el de la barra sin redondear) y el control dio rojo por sí mismo. Con
   `part.Inactivate(feature)` a mano (la primera versión) el control que mira solo Radio queda verde con la pieza mal:
   la prueba lo tiene como gemelo. Si una instalación no expone el `Activity`, el ejercicio vuelve a Inactivate + Radio 0
   y lo dice en `limite_control_mango`.
5. Los umbrales salen de los correctores del banco, no de la memoria: `cantos_convexos.py --umbral` 1,5 y
   `holgura_nido.py --min/--max` 0,1 / 0,4 (la prueba los lee del archivo).
6. **`juez_comun.comparar` mira solo las partes que midió build123d**: una variante que build123d no pudo medir pasaba
   sin cruce. El juez del ejercicio exige el cruce de las seis (revisor 24/10; vale para cualquier ejercicio con varias
   partes medidas aparte).
