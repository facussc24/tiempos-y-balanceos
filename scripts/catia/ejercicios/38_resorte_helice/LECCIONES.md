# Lecciones del ejercicio 38 (resorte por GSD, perfil normal e inclinado) — CATA, 24/10/2026

Corrida real: CATIA R21 (B21, 32 bits) de CATA con el Python 3.12.10 del sistema, en `%TEMP%\catia_cata_tanda\38_r1`
(12:46:02-12:46:27). VERDE al primer intento. Base: el `ej45_resorte.py` de la práctica del 19/10 (PEDIDO 27).
Después del revisor Sonnet (sin graves; encabezado de la copia, un número y la prueba del largo por pieza), `38_final`
(12:56:46-12:57:11) con el código que se sube: los mismos números.

| Perfil | CATIA (mm³) | Fórmula | Diferencia | STEP en build123d |
|---|---:|---:|---:|---:|
| Normal a la hélice | 7 920,665 | 7 920,644 | +0,021 | 7 920,618 |
| En el plano ZX (4,54987° del normal) | 7 895,705 | 7 895,684 | +0,021 | 7 895,657 |

Largo de la hélice que mide CATIA (`SPAWorkbench.GetMeasurable(...).Length`): 630,3048278758258 mm, igual a la cuenta
(5 × √((2π·20)² + 10²)) en todos los decimales que imprime.

Para la centralización (LECCIONES_CATIA.md / catia.md):

1. **El control del perfil inclinado lo nombraba la práctica y no lo corría**: el docstring del ej45 dice «control extra:
   un perfil inclinado… tiene que dar área × largo × cos(4,55)» y el código solo arma el normal. Acá es el CAMBIO 4 de la
   copia (el círculo en `OriginElements.PlaneZX`, que pasa por el punto de arranque) y dio la cuenta: **`AddNewRibFromRef`
   respeta el ángulo del perfil**, no lo pone normal por su cuenta (si lo hiciera, el inclinado daría 25 mm³ más,
   50 veces la tolerancia). Un control que figura en un comentario y no en el código no existe.
2. **El mismo +0,021 mm³ en los dos perfiles**: no depende del perfil; que sea la integración de CATIA sobre el barrido es
   una inferencia (no se midió aparte). El STEP medido con build123d da −0,047 y −0,048 contra CATIA.
3. El dato «dif_%» del paso del inclinado (−0,3149 %) compara contra la fórmula del NORMAL: es el código de la práctica
   sin tocar; el juez compara cada uno contra su fórmula.
4. **El ángulo exacto, no el redondeado**: con cos(4,55°) la cuenta da 7 895,682 y con atan(P / (2πR)) = 4,54987°, 7 895,684.
   El juez usa el exacto.

**24/10, auditor de la tanda de CATA (Opus):** el juez no miraba la topología del STEP de CATIA. Con una cara suelta agregada al STEP
seguía dando verde (le pasó de verdad al 54 en 54_r1 y al 31 en 31_final3). Desde b12fc4d1 exige 1 sólido, 1 cáscara y 0
caras sueltas (el control del 24 y del 49), con su caso rojo en la prueba; la corrida real con el código nuevo da verde.
