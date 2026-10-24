# Lecciones del ejercicio 56 (chaflán en las 12 aristas de una caja) — CATA, 24/10/2026

Corrida real: CATIA R21 (B21, 32 bits) de CATA con el Python 3.12.10 del sistema, en `%TEMP%\catia_cata_tanda\56_r4`
(15:58, con el código de main; antes 56_r3 a las 15:33 y la primera verde 56_r2 a las 15:17, iguales). VERDE: 1 181 250,000 mm³ y centro (0 · 0 · 30), la cuenta exacta; contra el gemelo por planos sobra 0,
falta 0, distancia 0,0 por malla y exacta, 18 caras de cada lado.

| | Volumen (mm³) | Caras | Esquina |
|---|---:|---:|---|
| CATIA (AddNewChamfer modo 0, las 12 de una vez) | 1 181 250,000 | 18 | los tres planos se cortan en un punto |
| Gemelo por planos (la caja cortada por los 12 planos) | 1 181 250,000 | 18 | ídem |
| chamfer() de build123d | 1 181 166,667 | 26 | un triángulo en cada esquina |

Para la centralización (LECCIONES_CATIA.md / catia.md):

1. **CATIA cierra la esquina de tres chaflanes con los tres planos que se cortan en un punto; chamfer() de build123d
   (OpenCASCADE) le pone un triángulo.** En el cubo de esquina K × K × K queda K³/4 con CATIA y K³/6 con build123d: 8 ×
   K³/12 = 83,333 mm³ de diferencia, en 8 piezas de 10,4167 mm³, una por esquina (ubicadas restando los dos sólidos). Por
   eso la fila («chamfer() a 0,5 mm³») no podía dar verde con la pieza bien: el ej84 de la práctica ya había medido 0,0071 %.
2. **La referencia se arma sin la operación que se está probando**: la caja cortada por los 12 planos (`split` con cada
   plano a 45° entre sus dos caras, a K de la arista) es la geometría exacta de «tres planos que se cortan», y la cuenta
   lo confirma (la esquina K³/4 integrada rebanada por rebanada en la prueba). Comparar contra otra implementación de
   chamfer() compara dos criterios de esquina, no la pieza.
3. **`topologia()` sobre una operación cuenta las caras DE esa operación, no las del sólido**: sobre el chaflán dio 12
   (56_r1 y r2; no se juzga) y en 56_r1 el juez las comparó contra las 18 del gemelo y dio rojo con la pieza bien. Las del
   sólido se cuentan en el STEP con build123d (`gemelo_chaflan.py`): 18, y se exige 18 de los dos lados.
