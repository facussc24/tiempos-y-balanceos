# Lecciones del ejercicio 16 (la palanca del 06 como ensamble) — CATA, 24/10/2026

Corridas reales: CATIA R21 (B21, 32 bits) de CATA con el Python 3.12.10 del sistema. `16_r1` (09:52) salió verde al
primer intento; después del revisor Fable se agregó el gemelo de la orientación (lección 1) y la posición de antes de
resolver, y se volvió a correr con el código que se sube: `16_r2`, 10:09:03 a 10:09:38, 9 pasos sin falla, 35,7 s.
Las 7 restricciones quedaron con estado 0 (resueltas). Antes de resolver, soporte y palanca estaban en el origen sin
girar (leído con `Position.GetComponents`); después: soporte en (0; −21; 10) sin rotar y palanca en (0; 0; 80) con sus ejes
X → (1, 0, 0), Y → (0, 0, 1), Z → (0, −1, 0): diferencia 0 contra lo esperado. Conjunto 478 517,325 mm³ = build123d del 06,
centro de gravedad (62,5718; −2,0143; 20,3109) = build123d en los cuatro decimales, y el STEP del producto medido con
build123d da el mismo volumen.

Para la centralización (LECCIONES_CATIA.md / catia.md):

1. **Una pieza que NO es de revolución necesita una tercera restricción para fijar el giro, y la orientación de esa
   restricción decide la pose (medido)**: el ej42 ató un eje cilíndrico con dos coincidencias punto-punto y le sobraba el
   giro sobre su eje; la palanca no. Dos puntos sobre el eje (coaxial con el del soporte) más un paralelismo de planos
   (`AddBiEltCst(8, plano, plano)`) con `.Orientation = 0` (catCstOrientSame) dejan la barra hacia +X. **Gemelo en la
   misma corrida**: con `.Orientation = 1` (catCstOrientOpposite) y `Update`, la palanca dio X → (−1, 0, 0) (la barra hacia
   −X); de vuelta a 0, X → (1, 0, 0) otra vez. Sin la orientación correcta el paralelo deja la barra al revés.
2. **Para que las restricciones MUEVAN algo, las piezas se dibujan en su propio sistema** y entran al ensamble en el
   origen (`AddComponentsFromFiles`; leído: origen (0, 0, 0) antes de `Update`). Si se dibujan ya en su lugar, el
   ensamble no prueba nada.
3. **Puntos y planos con nombre en un set geométrico** (`HybridBodies.Add`, `AppendHybridShape`, `.Name`) y la referencia
   por nombre `raíz/instancia/!Nombre` (como el ej42). Los planos son desplazados 0 de los de origen, con nombre propio:
   no hace falta saber cómo se llaman los planos de origen en esta instalación. El set se oculta ANTES de guardar cada
   pieza (CATIA exporta lo visible).
4. **`Position.GetComponents`** (por VBScript: el arreglo no vuelve a Python) da 12 números: los tres primeros son la
   dirección del X de la pieza en el ensamble, los tres siguientes la del Y, después la del Z y al final el origen
   (medido con la palanca girada: X (1,0,0), Y (0,0,1), Z (0,−1,0), origen (0,0,80); lo confirman las coincidencias, que
   mandan el Z de la palanca a −Y).
5. **El «contacto» del pedido no se puso**: en el banco la palanca no toca el soporte (2 mm de luz en Y); un contacto la
   correría 2 mm y el centro del conjunto 0,29 mm (2 × 68 617 / 478 517), que el cruce con el banco daría en rojo. La
   posición a lo largo del eje la fijan las dos coincidencias. Si un ejercicio pide contacto, primero se mide si las piezas
   se tocan.
6. Sin material, `Analyze.GetGravityCenter` del producto da el centro pesado por volumen: se compara directo con la suma
   pesada de build123d (la prueba exige la pesada, no el promedio).
7. El obrero copia a la nube solo lo que está en `archivos`: el CATProduct y los tres CATPart van ahí además del STEP.
