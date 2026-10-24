# Lecciones del ejercicio 48 (el gancho de mochila v2 rehecho en CATIA) — CATA, 24/10/2026

Corridas reales: CATIA R21 (B21, 32 bits) de CATA con el Python 3.12.10 del sistema, en `%TEMP%\catia_cata_tanda\`.
- `48_r1` (13:53): ROJO, +461 mm³ contra la referencia (sobra 615, falta 154, distancia 2 mm): los dos rebajes sacaron
  120 mm³ cada uno en vez de 390. El vaciado fue hacia −X y comió 15 mm² × 8 del lomo en vez de 15 × 26 del ala: el
  control de dirección solo daba vuelta un vaciado que no sacaba NADA, y este sacaba, del lado equivocado.
- `48_r2` (13:55): ROJO, falta 33 mm³: el chaflán de entrada. Medida la referencia paso a paso con build123d: todos los
  pasos iguales a CATIA al mm³ (rebajes 390 y 390, R8 +701,981, R6 +170,435, alivios 1 992,286, R3 −131,336) salvo los
  chaflanes, 33 en build123d contra 66 en CATIA.
- `48_r3` (13:58): VERDE: sobra 0, falta 0, distancia máxima 0,0002 mm, centro igual, un sólido de cada lado; 40 505,558
  contra 40 505,593 mm³.

Para la centralización (LECCIONES_CATIA.md / catia.md):

1. **La referencia del gancho v2 tiene UN solo chaflán de entrada**: en `build_gancho.py` (bucle «entrada guiada», líneas
   209-217) el triángulo del lado +Y queda en sentido horario y `extrude(tri, amount=h)` lo lleva a z −28..0, debajo de
   la pieza: no corta nada. El de −Y va a z 0..28 y corta 33 mm³. El 49 de la principal dio lo mismo (pedido 11). Se
   reproduce lo entregado (`LADOS_CHAFLAN = (-1,)`, con la prueba que sondea el sólido de `construir_gancho()`: si alguien
   arregla el script, da rojo y avisa); `build_gancho.py` no se tocó: la principal se lo pregunta a Fak.
2. **Un vaciado se verifica por DÓNDE sacó, no por si sacó**: el centro de lo sacado, (V₀·c₀ − V₁·c₁)/(V₀ − V₁), tiene
   que caer del lado pedido; si no, se da vuelta, y si sigue sin caer, frena.
3. **Ante un rojo contra la referencia, la referencia se mide paso a paso antes de cambiar CATIA**: el script de
   build123d repetido con un volumen después de cada operación ubicó la diferencia en un paso en un minuto; el resto de
   los números ya coincidían al milímetro cúbico.
4. Las cotas que no se declaran (y_raiz, x0, ancho_X) se calculan como `derivadas()` de `build_gancho.py`, y la prueba
   las compara con las de build123d: si el script cambia, la pieza de CATIA no queda desincronizada en silencio.
5. Ruta a la skill por `jc.REPO` (el paquete del obrero no la trae; lección del 35).
6. **Revisor Sonnet (sin verde ni rojo en falso)**: la primera prueba del chaflán rehacía el bucle a mano y no tocaba
   `build_gancho.py` (si alguien lo arreglaba, seguía verde): ahora sondea con `is_inside` el sólido que arma
   `construir_gancho()` en un punto adentro de cada chaflán. Y un límite del paquete del obrero: el 48 y el 50 cargan el
   `catia.py` del 32 (por `revisar_comparacion`), que importa `practica_en_juez.py`, y `armar_obrero.py` no lo copia: desde
   el paquete el cierre daría rojo con la pieza bien (las corridas de hoy fueron desde el repo). Avisado a la principal.

**24/10, auditor de la tanda de CATA (Opus):** el juez no miraba la topología del STEP de CATIA. Con una cara suelta agregada al STEP
seguía dando verde (le pasó de verdad al 54 en 54_r1 y al 31 en 31_final3). Desde b12fc4d1 exige 1 sólido, 1 cáscara y 0
caras sueltas (el control del 24 y del 49), con su caso rojo en la prueba; la corrida real con el código nuevo da verde.
