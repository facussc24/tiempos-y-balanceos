# Lecciones del ejercicio 08 (C Clamp Base) — CATA, 24/10/2026

Corridas reales: CATIA R21 (B21, 32 bits) de CATA con el Python 3.12.10 del sistema (el del obrero). La primera
(`%TEMP%\catia_cata_tanda\08_r1`, 09:09:37 a 09:10:14) salió **verde al primer intento**; después del revisor se sacó el
camino de reserva por Groove (nunca se había usado) y se volvió a correr con el código que se sube (`08_r2`, 09:25:29):
9 pasos sin falla, 30,0 s en total = 9,0 s de build123d + ~8,9 s de arranque de CATIA (conectó a los 17,9 s) + 2,3 s de
los pasos + material, STEP, captura y apagar. Volumen 35 605,547 mm³ = build123d (diferencia 0,000), centro de gravedad a
0,0003 mm, el STEP que exportó CATIA medido con build123d da lo mismo, masa de CATIA 96,135 g contra 96,13 ± 1 de la
guía (0,005 g). Las dos corridas dieron los mismos números.

Para la centralización (LECCIONES_CATIA.md / catia.md), lo nuevo que dejó este ejercicio:

1. **Plano paralelo a YZ con `AddNewPlaneOffset(PlaneYZ, x, False)` queda en +x** (medido con `Measurable.GetPlane` por
   VBScript: origen (2,5; 0; 0) y (86; 0; 0), direcciones (0,1,0) y (0,0,1)). En un croquis de ese plano la H es Y y la
   V es Z, como en el YZ de origen. Antes no estaba medido: solo el XY.
2. **Leer la posición de un plano antes de dibujar en él**: `GetPlane` devuelve 9 valores (origen y dos direcciones)
   y solo sale por VBScript (`cb.evaluar`), como `GetCOG`. Es más directo que deducir el sentido por el volumen de la
   extrusión simétrica, que no mira el centro (`juez_comun.extruir` con `simetrico=True` controla solo el volumen).
3. **Densidad de un material del catálogo cambiada por programa**: el Aluminium del catálogo de B21 es 2 710 kg/m³; el
   parámetro `c_clamp_base\Aluminium\Aluminium.1\Density` (en `part.Parameters`, buscado por «densit» + el nombre del
   material) acepta `.Value = 2700` en kg/m³ y `SPAWorkbench.Inertias` lo toma después de `part.Update()` (densidad
   releída 2 700, masa / volumen = 2 700,001). Así la masa sale de CATIA con la densidad del rótulo del plano, no de una
   cuenta afuera.
4. **El avellanado del ej33 anda igual en la R21 de CATA**: `AddNewHoleFromPoint` sobre la cara elegida por topología del
   pad del tope (la de x −9: cdg en x −9 y z 34, una sola candidata), `Type 3`, `CounterSunkMode 0` (profundidad +
   ángulo), `HeadDepth 2,85`, `HeadAngle 90`, `BottomType 0`, `BottomLimit.LimitMode 2` (hasta el último): saca 1 068,505
   = la cuenta, sin dar vuelta el sentido. El modo 2 (ángulo + diámetro) falló en el ej02 de la práctica: no se probó acá.
5. **Los radios R18 y R7 como arcos del croquis, no como redondeos por COM**: con el sentido de cada arco elegido por su
   punto medio (`barrido()`), la mano del croquis ZX (H→Z, V→X, la contraria del mundo XZ) no importa.
6. La captura BMP muestra los planos de origen (XY, YZ, ZX) del documento: el STEP no los lleva (se midió con build123d),
   pero en la imagen se ven. Si la captura va a un entregable, ocultar también `OriginElements`.
