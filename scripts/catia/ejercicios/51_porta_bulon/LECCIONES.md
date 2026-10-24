# Lecciones del ejercicio 51 (el porta-bulon M6 rehecho en CATIA) — CATA, 24/10/2026

Corrida real: CATIA R21 (B21, 32 bits) de CATA con el Python 3.12.10 del sistema, en `%TEMP%\catia_cata_tanda\51_r7`
(15:02:26-15:03:22, con el código del commit; la primera verde fue 51_r5 a las 14:42, igual). VERDE: sobra 0, falta 0,
distancia máxima 0,0003 / 0,0004 mm por malla y 0,0 / 0,0 exacta (compara.py del 32 con la distancia contra la cáscara,
PEDIDO PARA CATA 14; vuelta a juzgar a las 15:06), el mismo centro (0 · 0 · 3,2075) y un
sólido de cada lado; 1 612,483 mm³ los dos. Gemelos del banco medidos como malla: bien.py a 0,555 mm³ de CATIA,
mal_1 a 18,385 y mal_2 a 32,063.

| Paso | CATIA (mm³) | Cuenta |
|---|---:|---|
| Cilindro D22 x 3,8 + tetón 13,6 x 3,9 | 2 165,848 | π·11²·3,8 + 13,6²·3,9 |
| Alojamiento hexagonal 10,4 x 4,4 | −412,145 | 2√3·5,2²·4,4 |
| Ranura 14,0089 x 6,6 x 0,2 en z 4,4 | −17,952 | 13,6·6,6·0,2: la ranura pasa del tetón y se recorta en 13,6 |
| Cuadrado 6,6 x 0,2 en z 4,6 | −8,712 | 6,6²·0,2 |
| Agujero D6,6 de z 4,8 a 7,7 | −99,215 | π·3,3²·2,9 |
| Chaflán 0,5 en las cinco aristas de arriba | −9,356 | tetón 6,634 y agujero 2,722; ~0,125 por mm de arista |
| Boca del hexágono 11,2 x 0,4 | −5,986 | (hexágono 11,2 − hexágono 10,4)·0,4 |

Para la centralización (LECCIONES_CATIA.md / catia.md):

1. **La respuesta conocida es el GENERADOR, no el bien.py del banco.** El bien.py copia solo el STL: la malla da
   1 611,928 mm³ contra 1 612,483 del sólido exacto (0,555, más que los 0,5 de TOL_VOL), así que con `con_bien=True` un
   CATIA perfecto daría rojo. El generador de la nube escribe ese mismo STL byte por byte (se verifica su sha256 en cada
   corrida) y además el STEP, que se compara con compara.py del 32. Los gemelos del banco siguen sirviendo como control
   que separa: el bien.py a menos de 1 mm³ y cada mal_*.py a más de 5 (acordado con la principal, PEDIDO 30).
2. **El centro de lo que saca un vaciado chico se mide SIN redondear.** `medir()` de catia_base redondea el centro a
   0,001 mm; el centro de lo sacado se despeja de dos centros, y su error se multiplica por V0 / dV (la boca: 1 618 / 6
   ≈ 270). En 51_r3 la boca bien hecha dio z −0,04 en vez de +0,2 y el control la rechazó. Poner un margen para ese
   ruido fue peor: con un dV chico el margen crece sin techo, y en 51_r4 la ranura salió al revés (sacó 4,615 en vez de
   17,952; su centro, 0,1 abajo del plano, cayó dentro de un margen de ~0,4) y después el agujero también (sacó 6,842,
   la capa que la ranura dejó). Lo que anduvo: `medir_fino()` lee el volumen y el centro de CATIA sin redondear y el
   vaciado tiene que sacar más de 1 mm³ con su centro arriba de su plano (el piso es para un vaciado al revés que cae en
   un hueco y no saca nada: con la ranura bien, el agujero al revés sería ese caso, por cuenta). Centros medidos en
   51_r6: 2,2 · 4,5 · 4,7 · 6,25 · 0,2, los exactos.
3. **El chaflán de las cinco aristas, de a dos grupos**: en 51_r1 las cuatro del tetón y el borde del agujero juntas
   dieron «Update failed»; en dos chaflanes (las rectas y el círculo) salieron en 51_r3. No se aisló la causa. Un intento
   que falla se borra antes del siguiente (no se probó qué pasa si queda).
4. **`AddNewChamfer(ref, propagación, modo, orientación, L1, L2)`: modo 0 = largo + largo, modo 1 = largo + ÁNGULO.** En
   51_r2 se probó (modo 1, 0,5) y salió un chaflán de 0,5 con 0,5 grados: sacó 0,082 mm³ en vez de ~9,4 y el paso dio
   ok (lo atajaba recién el juez final). Ahora cada grupo se verifica por lo que saca: ~0,125 mm³ por mm de arista, ±20 %
   (`chaflan_saca_bien`, revisor del 51).
5. **Rutas de más de 260 caracteres**: en CATA la ruta del STL que copia el bien.py mide 308 caracteres y Windows dice
   que el archivo no existe. Los gemelos corren con `BANCO3D_NUBE_3D` con el prefijo `\\?\`.
6. **Los gemelos se juzgan como sólidos**: la malla tiene que estar cerrada y orientada; una malla rota queda «lejos» de
   todo y pasaría por un mal_*.py que el control separa (revisor del 51). El mal_2 (tapita) el banco no lo cuenta
   (`sin_respuesta`): el 51 le pide separarse porque es otro sólido.

**24/10, auditor de la tanda de CATA (Opus):** el juez no miraba la topología del STEP de CATIA. Con una cara suelta agregada al STEP
seguía dando verde (le pasó de verdad al 54 en 54_r1 y al 31 en 31_final3). Desde b12fc4d1 exige 1 sólido, 1 cáscara y 0
caras sueltas (el control del 24 y del 49), con su caso rojo en la prueba; la corrida real con el código nuevo da verde.
