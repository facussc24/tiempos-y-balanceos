# Lecciones del ejercicio 50 (el gancho de Leo rehecho en CATIA) — CATA, 24/10/2026

Corrida real: CATIA R21 (B21, 32 bits) de CATA con el Python 3.12.10 del sistema, en `%TEMP%\catia_cata_tanda\50_r1`
(14:02:13-14:03:19). VERDE al primer intento: sobra 0, falta 0, distancia máxima 0,0000 mm en los dos sentidos, el mismo
centro (0 · 23,326 · 17,5) y un sólido de cada lado; 97 335,187 mm³ los dos (la fila dice 97,34 cm³).

| Paso | CATIA |
|---|---:|
| Contorno de 16 vértices × 35 (pad) | 95 172,000 mm³ = área × profundidad |
| R8 fondo de la bocha, lado pared (cada lado) | +480,708 |
| R8 fondo de la bocha, lado labio (cada lado) | +480,708 |
| R4 esquina interna del hueco (cada lado) | +120,177 / +120,178 |

Para la centralización (LECCIONES_CATIA.md / catia.md):

1. **Un diseño hecho con cajas a lo largo de un mismo eje es UN perfil extruido**: el collar menos el hueco y las dos
   cunas menos su bocha de `build_gancho_leo.py` son el contorno de 16 vértices de un solo croquis, y la prueba lo
   compara con el sólido que arma `construir()` de `build_gancho_leo.py` sin los redondeos (mismo volumen y diferencia
   simétrica 0; la primera versión de la prueba copiaba las cajas, revisor Sonnet). Un solo pad en vez de cinco
   operaciones booleanas en CATIA, y los redondeos van sobre las mismas aristas.
2. **El bucle de los chaflanes que dejó la entrada del 48 de un solo lado no está en este script** (lo confirmó la
   principal, pedido 11): acá no hay nada que reproducir de más.
3. Las cotas derivadas (ui, U, u_punta, v_hombro, v_top) se calculan como `derivadas()` de `build_gancho_leo.py` y la
   prueba las compara; el R4 de la esquina del hueco es un literal en el script y acá también (`R_ESQUINA_HUECO`).
4. El juez es el del 48 (compara.py del 32 con `revisar_comparacion`, más el centro del STEP contra el de la referencia);
   `comparar` y `_max_eje` se toman de su `catia.py`.

**24/10, auditor de la tanda de CATA (Opus):** el juez no miraba la topología del STEP de CATIA. Con una cara suelta agregada al STEP
seguía dando verde (le pasó de verdad al 54 en 54_r1 y al 31 en 31_final3). Desde b12fc4d1 exige 1 sólido, 1 cáscara y 0
caras sueltas (el control del 24 y del 49), con su caso rojo en la prueba; la corrida real con el código nuevo da verde.
