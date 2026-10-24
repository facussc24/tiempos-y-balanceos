# Lecciones del ejercicio 44 (perno diamante, Joshi ej. 2.1) — CATA, 24/10/2026

Corrida real: CATIA R21 (B21, 32 bits) de CATA con el Python 3.12.10 del sistema, en `%TEMP%\catia_cata_tanda\44_r1`
(13:11:08-13:11:31). VERDE al primer intento, con los mismos números que la práctica del 19/10 (PEDIDO 27). Después de
arreglar un texto del juez, `44_final` (13:12:46-13:13:12): los mismos números. El STEP de la
parte trae los dos cuerpos (76 874,691 mm³ = perno + placa). Después del revisor Sonnet (dos graves arreglados, puntos
4 y 6), `44_final2` (13:26:51-13:27:20) con el código que se sube: los mismos números y el STEP con 2 sólidos.

| Qué | CATA, 24/10 | Cuenta / papel |
|---|---:|---:|
| d = 2·√(D²/4 − V·W − V²) | — | 55,5384 (ficha de la principal: 55,538) |
| Perno (círculo d cortado por la franja de 2) | 1 110,528 mm³ | 1 110,528 |
| Placa 100 × 100 con el agujero de 55,55 | 75 764,164 mm³ | 75 764,164 |
| Choque del diamante, agujero en su lugar / corrido 0,15 | 0 / 0 mm³ | no choca |
| Choque del diamante corrido 0,20 | 0,006218 mm³ | choca |
| Gemelo: perno redondo de 55,538 corrido 0,15 | 78,312796 mm³ | choca |

Para la centralización (LECCIONES_CATIA.md / catia.md):

1. **El diamante toca justo en el límite de la tolerancia**: d sale de que la esquina de la franja apenas toque el agujero
   corrido V = 0,15, y la intersección exacta da 0; con 0,05 más (0,20) aparece choque (0,006 mm³). El gemelo redondo del
   mismo d choca 78 mm³ a 0,15: es lo que explica para qué sirve el diamante, medido con otro motor sobre el STEP de CATIA.
2. **El control de afuera vive en su archivo**: la práctica lo tenía como una cadena (`CONTROL`) pasada a `python -c`; acá
   es `choque_perno.py`, sin cambios, y la prueba lo corre sobre un STEP armado con build123d (perno y placa con las
   mismas cuentas) para ver que separa en las dos direcciones sin CATIA.
3. **La fuente vive en el informe de la principal** (`frente1_dispositivos.md`): la fórmula en la fila Ub10 (Joshi págs.
   32-34 y 40, «ABIERTA ... recalculada: el ej. 2.1 da 55,538») y los datos D, V y W en el párrafo «Reserva» del final de
   la sección E6 («Joshi p. 32, ejemplo 2.1»). El 55,538 es el recálculo de la principal, no una cifra leída del libro; el
   libro no se abrió desde CATA. El juez lo llama «ficha», no «publicado».
4. **Un perno de puntas planas pasaba** (revisor Sonnet): el rectángulo 2 × 2·yc, sin los arcos, pesa 0,481 mm³ menos que
   el diamante, por debajo del 0,5 de TOL_VOL, y el choque solo mira las esquinas. El perno se juzga ahora a 0,05 mm³ de
   su cuenta (CATIA da 0,0004). Una tolerancia común no vale para una pieza chica: se calcula cuánto pesa la falla.
5. **La esquina que toca es la del lado contrario al corrimiento** (revisor): con el agujero corrido +0,15, la esquina
   (−W/2, yc) queda a D/2 exacto (error 3,6e-15) y la (W/2, yc) 10,8 µm adentro. El veredicto es el de la práctica: 0
   exacto en su lugar, menos de 1e-3 corrido 0,15.
6. `choque_perno.py` toma perno y placa por orden de volumen (el más chico es el perno); por eso el juez exige que el STEP
   traiga exactamente 2 sólidos (medido: 2 sólidos, 2 cáscaras, 0 caras sueltas).
