# Lecciones del ejercicio 40 (bloque en V de 90° como ensamble) — CATA, 24/10/2026

Corrida real: CATIA R21 (B21, 32 bits) de CATA con el Python 3.12.10 del sistema, en `%TEMP%\catia_cata_tanda\40_r1`
(12:51:13-12:51:42). VERDE al primer intento. Base: el `ej74_bloque_en_v.py` de la práctica del 19/10 (PEDIDO 27).

| D | z del eje (solucionador) | R·√2 | Restricciones |
|---|---:|---:|---|
| 160 | 113,1371 | 113,1371 | estado 0 y 0, valor 80 y 80 |
| 159,86 | 113,0381 | 113,0381 | estado 0 y 0, valor 79,93 y 79,93 |
| Diferencia | 0,0990 | 0,098995 (0,14 / (2 sen 45°)) | papel: 0,099 |

Para la centralización (LECCIONES_CATIA.md / catia.md):

1. **El papel de la fila, abierto**: Shuping Lv, «Discussion on Calculation Method of Positioning Error», ICMMCT 2018,
   Advances in Engineering Research vol. 152 (Atlantis Press), Example 1, págs. 265-266: «0,707 × 0,14 = 0,099 mm». WebFetch
   no pudo leer el PDF (lo devuelve comprimido), pero lo guardó en el disco y `pypdf` sí lo leyó (con la salida a un
   archivo en UTF-8: la consola de esta PC es cp1252 y el «Δ» del texto la corta).
2. **Lo que se juzga es la POSE que da el solucionador**, no un volumen: sin STEP ni gemelo de build123d. El gemelo del
   control: el eje arranca a z 200 (la «solución de afuera»), así que un solucionador que no lo mueve da z 200 y el juez lo
   ve; y un eje del otro lado del vértice (z negativa) también da rojo.
3. La práctica redondea z a 4 decimales en el paso (`round(z, 4)`): la diferencia contra la cuenta (1e-5 mm) está en el
   orden de ese redondeo; la tolerancia del juez (1e-3 mm) queda muy por arriba.
4. **El nombre del número es el del papel**: el 0,099 es el error de DESPLAZAMIENTO del eje (ΔY, «reference displacement
   error»); el error de POSICIONAMIENTO de la cota H del mismo ejemplo es 0,189 (0,09 de desalineado + 0,099). La fila 40 de
   la COLA y la primera versión de este juez lo llamaban «error de posicionamiento» (revisor Sonnet): quien lo compare con
   el papel encuentra el 0,189.
5. **Una comparación con `abs(x) > TOL` deja pasar un NaN** (`abs(nan) > TOL` es falso): el juez usa `not abs(x) <= TOL`.
   Hoy es inalcanzable desde CATIA, pero cuesta lo mismo.
6. La prueba de la copia (`test_la_copia_del_ej74`) busca textos, no el contenido: un `d / 3` en lugar de `d / 2` la pasa.
   Lo que caza eso es la corrida real (z dejaría de ser R·√2). Fijar el sha256 de la copia en la prueba se descartó: el
   fin de línea de git en Windows lo cambiaría.
