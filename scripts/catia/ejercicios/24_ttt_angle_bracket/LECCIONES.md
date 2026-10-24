# Lecciones del ejercicio 24 (Too Tall Toby PPP01-04 Angle Bracket) y del MOLDE de los 26, 28 y 30 — CATA, 24/10/2026

Corridas reales: CATIA R21 (B21, 32 bits) de CATA con el Python 3.12.10 del sistema, en `%TEMP%\catia_cata_tanda\`.
- `24_r1` (10:25, y los 26/28/30 `_r1`): 0 pasos. Las copias de los ej importan `croquis.py` de la práctica, que no
  estaba: se copió sin cambios a esta carpeta y el molde la pone en el camino antes de cargar la pieza.
- `24_r2` (10:27): ROJO en el doblez: el R10 se hizo y el R5 dio «AddNewSolidEdgeFilletWithConstantRadius failed»
  (faltaron 203,874 mm³ = (1 − π/4)·5²·38). `24_r3` (10:30): VERDE, 12 pasos, 40,2 s. Después del revisor (el juez cambió
  en detalles y el CAMBIO 4 pasó a una función con prueba) se volvieron a correr los cuatro con el código que se sube:
  `24_final`, `26_final`, `28_final`, `30_final` (10:52-10:55), los mismos números de la tabla.

| Ejercicio | CATIA (mm³) | Masa de CATIA | Guía | Gemelo build123d | STEP |
|---|---:|---:|---:|---:|---:|
| 24 Angle Bracket (`24_r3`) | 39 743,209 | 309,997 g | 310,00 | −0,002 mm³ | 39 743,338 |
| 26 Tie Plate (`26_r2`) | 434 238,267 | 3 387,058 g | 3 387,06 | 0,000 | 434 238,267 |
| 28 Bearing Bracket (`28_r2`) | 102 198,223 | 797,146 g | 797,15 | −0,027 | 102 198,244 |
| 30 Corner Tie (`30_r2`) | 113 789,264 | 307,231 g | 307,23 | 0,000 | 113 789,264 |

Para la centralización (LECCIONES_CATIA.md / catia.md):

1. **El orden de las aristas que devuelve la topología NO es fijo entre corridas**: en `24_r2` la candidata 0 del R5
   (2 candidatas) falló y en `24_r3` la misma candidata 0 anduvo. Según el revisor, a x 51 / z 0 / largo 38 hay dos
   aristas: la del sólido y la recta del croquis de la pata (rectángulo (51, −19)-(61, 19) sobre XY); `Selection.Search`
   las devolvió en distinto orden. Elegir «la primera» arista que cumple la posición es
   suerte; el doblez ahora prueba cada candidata y controla el cambio de volumen contra la cuenta del redondeo de 90°
   (convexo saca y cóncavo suma (1 − π/4)·r²·L): R10 −815,487 y R5 +203,871 = la cuenta (CAMBIO 4 de `pieza_ej34.py`).
2. **Un molde para las piezas de afuera ya resueltas**: copia del ej por script (`portar_ej.py`: sin captura ni STEP
   propios, devuelve el contexto con lo de construcción para ocultarlo) + un `catia.py` con su CFG (masa, densidad,
   material preferido) + el juez común (masa de CATIA contra la guía, gemelo, STEP). Tres de cuatro salieron al primer
   intento con el molde ya armado.
3. **Masa de CATIA con la densidad de la guía**: Steel del catálogo (7 860) pasado a 7 800 y Aluminium (2 710) a 2 700 con
   su parámetro `Density`: densidad implícita 7 799,999-7 800,004 y 2 700,000.
4. **Dos módulos con el mismo nombre en carpetas distintas** (`gemelo_b123d.py` del 18, 22, 24...): en una misma corrida
   de pruebas Python reusa el primero que cargó. Las pruebas cargan cada gemelo por ruta y con nombre propio; los
   `catia.py` cargan su pieza igual.
