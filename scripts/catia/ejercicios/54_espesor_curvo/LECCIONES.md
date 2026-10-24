# Lecciones del ejercicio 54 (espesor sobre una superficie curva) — CATA, 24/10/2026

Corrida real: CATIA R21 (B21, 32 bits) de CATA con el Python 3.12.10 del sistema, en `%TEMP%\catia_cata_tanda\54_r4`
(15:32:55-15:33:33, con el código del commit; la primera verde fue 54_r3 a las 15:12, igual). VERDE: el arco mide 310,0
(no el círculo) y cada lado da la cuenta del sector de anillo.

| Lado | Cuenta (mm³) | CATIA (mm³) | Centro de la cuenta | CATIA | STEP |
|---|---:|---:|---|---|---|
| Adentro (R 597-600) | 88 129,125 | 88 129,125 | (0 · 591,8665 · 47,5) | (0 · 591,866 · 47,5) | 1 sólido, 0 caras sueltas |
| Afuera (R 600-603) | 88 570,875 | 88 570,875 | (0 · 594,8332 · 47,5) | (0 · 594,833 · 47,5) | 1 sólido, 0 caras sueltas |

Para la centralización (LECCIONES_CATIA.md / catia.md):

1. **`AddNewThickSurface(superficie, 0, arriba, abajo)` sobre ESTE arco (de p1 a la izquierda a p3 a la derecha por
   p2 = (0, 600), extruido en +Z): (0, 3, 0) da el lado de ADENTRO y (0, 0, 3) el de AFUERA** (medido en 54_r1 a r3, igual
   las tres veces). No es una regla de CATIA: depende de la normal de la superficie, y en las NOTAS de la práctica un
   cilindro dio afuera con (0, 2, 0). Por eso el lado no se supone: se prueba una forma y se mira el centro de lo que quedó
   (adentro cae más cerca del centro del arco que el arco mismo, R sen(t/2) / (t/2) = 593,35); si cayó del otro lado, se
   borra y se prueba la siguiente (`elegir_forma`, probada con un CATIA de mentira).
2. **Ocultar (`VisProperties.SetShow`) en un documento que no es el activo no hace nada.** En 54_r1 y r2 se armaron las
   dos piezas y después se cerraron: en la de adentro (ya no activa) la superficie quedó a la vista (GetShow 0 en el
   CATPart guardado, y la captura la muestra) y su STEP salió con la superficie R600 suelta (1 sólido, 2 cáscaras). Cada
   pieza se cierra (ocultar, STEP, captura) mientras es el documento activo. Los otros ejercicios que ocultan y arman
   varias piezas (06, 13, 14, 17, 24) llaman a cerrar_parte al terminar cada una (mirado en sus catia.py el 24/10).
3. **La fila de la COLA trae 88 127,7 y 88 569,4 con la fórmula del sector de anillo, y la fórmula da 88 129,1 y
   88 570,9** (el ej83 de la práctica midió 88 129,12). Se juzga contra la fórmula, que el pedido 15 dice que es la
   respuesta; la prueba la cruza con el sector dibujado como polígono de 20 000 lados, que no la usa.
4. **El juez mira la topología entera del STEP** (`topologia_step.py`: 1 sólido, 1 cáscara, 6 caras, 12 aristas, 8
   vértices, nada suelto). El volumen y el centro solos no veían la cara suelta de 54_r1 (el sólido daba la cuenta igual),
   y esa cara venía con la curva del arco: 17 aristas (5 sueltas) y 17 vértices (9 sueltos) contra 12 y 8 (revisor del 54).
