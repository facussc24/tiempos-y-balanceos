# Lecciones del ejercicio 59 (caja vaciada con AddNewShell) — CATA, 24/10/2026

Corrida real: CATIA R21 (B21, 32 bits) de CATA con el Python 3.12.10 del sistema, en `%TEMP%\catia_cata_tanda\59_r2`
(15:57, con el código del commit; la primera, 59_r1 a las 15:46, ya dio verde e igual). VERDE: 83 508,000 mm³ y centro (60 · 40 · 17,878), la cuenta; la cáscara sacó
396 492 mm³ (114 × 74 × 47) con su centro en z 26,5; contra la caja menos la caja interior puesta a mano, sobra 0, falta 0,
distancia 0,0 por malla y exacta, 11 caras de cada lado.

Para la centralización (LECCIONES_CATIA.md / catia.md):

1. **`AddNewShell(cara a sacar, espesor interno, espesor externo)` con (cara de arriba, 3, 0) da la pared de 3 hacia
   adentro**, como el ej04 de la práctica con 2 (NOTAS del 19/10); sobre una caja sin redondeos sale a la primera. Lo que
   falló en la práctica (ej81) fue sacar una cara rodeada de redondeos tangentes, no la llamada.
2. **Que la cáscara fue por la cara pedida no lo dice el volumen**: con la cara de abajo sacada el volumen sería el mismo
   (83 508) y cambiaría el centro (z 32,12 en vez de 17,88; cuenta, no corrida). El centro solo ya lo ve; el juez mira
   además lo sacado y la forma contra el gemelo, y la prueba tiene ese caso. Con la pared hacia afuera el volumen también
   bajaría (94 308, por cuenta): «bajó el volumen» no prueba «hacia adentro» (revisor del 59).
3. **La cara se elige por posición** (topología: la de centro en z 50 y 9 600 mm²), no por el nombre interno.
