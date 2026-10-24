# Lecciones del ejercicio 31 (Too Tall Toby 23-02-02 SM Hanger, chapa como sólido) — CATA, 24/10/2026

La fila 31 era de la principal; la pasó a CATA con el pedido 8 (24/10 11:05) cuando CATA terminó sus pares.
Corrida real: CATIA R21 (B21, 32 bits) de CATA, `%TEMP%\catia_cata_tanda\31_r1`, 11:12:10 a 11:13:03. **Verde al primer
intento**: 17 pasos sin falla, 52,7 s. Volumen 131 756,352 mm³ (el mismo que el ej54 de la práctica en la PC principal),
masa de CATIA 1 027,70 g contra 1 028 ± 10 de la guía, 0,003 mm³ contra la referencia de la guía (131 756,349, corrida en
CATA), STEP medido con build123d igual al sólido.

Para la centralización (LECCIONES_CATIA.md / catia.md):

1. **Chapa como sólido**: sin biblioteca de Sheet Metal por COM en la R21, la pieza de chapa sale igual exacta armada con
   perfiles gruesos (R interior y exterior en el croquis), un Fill + ThickSurface para el ensanche y dos simetrías.
2. **Sin gemelo propio, el cruce va contra un número de referencia con su fuente**: `referencia.py` es código de la guía de
   build123d (de terceros) y no entra al repo; se corrió acá y su volumen va en la CFG (`volumen_referencia`). El molde
   del 24 acepta eso y una tolerancia de masa por ejercicio (`tol_masa_g`: la guía de este dice ± 10 g).
3. Los perfiles del ej54 (`ej54_sm_hanger/*.json`) los generó `perfiles.py` de la práctica, que depende de herramientas
   que no están en el repo (`de_build123d`, la referencia): se copiaron solo los json.
