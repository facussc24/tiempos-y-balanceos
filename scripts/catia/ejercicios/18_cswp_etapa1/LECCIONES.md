# Lecciones del ejercicio 18 (CSWP Sample Exam 2, etapa 1 paramétrica) — CATA, 24/10/2026

Corrida real: CATIA R21 (B21, 32 bits) de CATA con el Python 3.12.10 del sistema, `%TEMP%\catia_cata_tanda\18_r1`,
10:14:54 a 10:15:48. **Verde al primer intento**: 18 pasos sin falla, 40,8 s.

| Etapa | A, B, C, D, E | CATIA (mm³) | Masa de CATIA | Examen | Gemelo build123d |
|---|---|---:|---:|---:|---:|
| 1 | 213, 200, 170, 130, 41 | 1 845 109,091 | 14 207,340 g | 14 207,34 | +0,025 mm³ |
| 2 | 225, 210, 176, 137, 39 | 2 141 619,109 | 16 490,467 g | 16 490,45 | 0,000 mm³ |
| 3 | 209, 218, 169, 125, 41 | 1 961 099,202 | 15 100,464 g | 15 100,47 | +0,100 mm³ |

El STEP de la etapa 1, medido con build123d, da 1 845 109,142 (0,05 mm³ más). Los volúmenes son los mismos que dio el ej27
de la práctica del 19/10 en la R21 de la PC principal: la pieza paramétrica se reproduce igual en otra PC.

Para la centralización (LECCIONES_CATIA.md / catia.md):

1. **Una pieza paramétrica del 19/10 se reusa entera** copiándola con cambios mínimos anotados en su encabezado
   (`pieza_ej27.py`: sin captura ni STEP propios, devuelve el contexto con los planos de construcción para ocultarlos) y
   el contrato del banco va en un `catia.py` aparte. La copia se armó con `portar_ej27.py` (en esta carpeta), no a mano.
2. **La masa sale de CATIA con la densidad del papel**: Steel del catálogo (7 860) con su `Density` pasada a 7 700
   (`poner_densidad` del 08) y `Inertias` en cada etapa: densidad implícita 7 700,000 en las tres.
3. **Los redondeos, chaflanes y sentidos elegidos con la etapa 1 sobreviven al cambio de parámetros** (ya lo decía la
   práctica; acá se volvió a ver en otra PC): las etapas 2 y 3 salieron cambiando solo A..E.
4. El gemelo de build123d difiere en décimas de mm³ en las etapas 1 y 3 (0,025 y 0,100) y en nada en la 2: es lo que
   cada programa hace distinto en algún encuentro de redondeos o chaflanes; está muy por debajo de 0,5 mm³ y de lo que
   mueve la masa (0,1 mm³ = 0,0008 g).
