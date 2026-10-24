# Lecciones del ejercicio 46 (molde macho de termoformado, RapidMade) — CATA, 24/10/2026

Corrida real: CATIA R21 (B21, 32 bits) de CATA con el Python 3.12.10 del sistema, en `%TEMP%\catia_cata_tanda\46_r1`
(13:14:43-13:15:13). VERDE al primer intento, con los mismos números que la práctica del 19/10 (PEDIDO 27). Después del
revisor Sonnet (punto 6), `46_final2` (13:27:20-13:27:44) con el código que se sube: los mismos números.

| Qué | Sin desmoldeo | Papel | Con 4° | Cuenta del tronco |
|---|---:|---:|---:|---:|
| Huella | 120,000 pulg² | 120 | 120,000 | 120 |
| Área formada (techo + 4 lados) | 208,000 pulg² | 208 | 201,018 | 201,018 |
| Relación de estirado | 1,7333 | 1,73 | 1,6752 | 1,67515 |
| Chapa de partida (× 0,100) | 0,1733 pulg (4,40 mm) | 0,173 | 0,1675 (4,25 mm) | — |
| Volumen de CATIA | 3 932 895,36 mm³ | — | 3 832 911,295 | prismatoide 3 832 911,295 |

Para la centralización (LECCIONES_CATIA.md / catia.md):

1. **Lo publicado y lo recalculado otra vez son dos números**: RapidMade escribe 1,73 y 0,173; 208 / 120 da 1,7333. La fila
   46 de la COLA cita 1,733 (recalculado). El juez compara la relación de CATIA con las dos cosas: con 1,73 a medio dígito y
   con 208 / 120 a 1e-4.
2. **El desmoldeo de 4° baja la relación un 3,4 %** (1,7333 → 1,6752) y la chapa de partida de 4,40 a 4,25 mm: el techo
   queda de (A − 2H·tan 4°) × (B − 2H·tan 4°) y los lados son trapecios de alto H / cos 4°. Sin papel para esto: la cuenta
   exacta del tronco, y CATIA la da en los decimales que imprime.
3. **El volumen de un tronco de base rectangular NO es el de la pirámide** (las dos bases no son semejantes: les sacan lo
   mismo a A y a B): es el del prismatoide, H/6·(A₁ + A₂ + 4·A_medio), y CATIA da exactamente eso.
4. **El sentido del desmoldeo se elige midiendo**, como hace la práctica: si el techo queda más grande que la huella, se da
   vuelta la dirección de extracción (`SetPullingDirection`). El paso no anota si la dio vuelta; no importa para el juez,
   que exige el área de la cuenta y la chapa más fina: un desmoldeo al revés agrandaría el techo y engordaría la chapa.
5. La práctica no exportaba STEP de los moldes; acá `cerrar_parte` exporta los dos y build123d los mide igual a CATIA.
6. **Revisor Sonnet (sin graves; página de RapidMade abierta)**: la página escribe 1,73, nunca 1,733 (ese es el
   recálculo de la ficha); la cuenta del tronco es exacta (4,01° ya da 0,017 pulg² de diferencia, 17 veces la
   tolerancia); el juez comparaba la chapa de 4° solo contra la de 0° (más fina): ahora también contra la cuenta
   (relación × 0,100). El `registro.json` dice `publicado_sin_desmoldeo.relacion = 1.733` porque la copia lo hereda tal
   cual de la práctica: lo publicado es 1,73. El comentario de `catia.py` pasó a `r"""` (las barras de la ruta daban
   «invalid escape sequence» en Python 3.12; lo mismo en el 44).

**24/10, auditor de la tanda de CATA (Opus):** el juez no miraba la topología del STEP de CATIA. Con una cara suelta agregada al STEP
seguía dando verde (le pasó de verdad al 54 en 54_r1 y al 31 en 31_final3). Desde b12fc4d1 exige 1 sólido, 1 cáscara y 0
caras sueltas (el control del 24 y del 49), con su caso rojo en la prueba; la corrida real con el código nuevo da verde.
