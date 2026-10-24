# Lecciones del ejercicio 12 (los tres mutantes del Tool Block) — CATA, 24/10/2026

Corrida real: CATIA R21 (B21, 32 bits) de CATA con el Python 3.12.10 del sistema, `%TEMP%\catia_cata_tanda\12_r1`,
09:33:04 a 09:34:13. **Verde al primer intento**: 24 pasos sin falla, 69,5 s (CATIA conectó a los 20,7 s; build123d de
los tres mutantes, ~9,6 s cada uno, se midió con CATIA ya abierta).

| Mutante | CATIA (mm³) | build123d del mal_*.py | cdg | Masa de CATIA | Lámina 12 | ¿Rojo? | Masa del mutante (tarea.yaml) |
|---|---:|---:|---:|---:|---:|---|---:|
| mal_1_q3 sin el agujero de 14 | 125 548,395 | 125 548,395 | 0,0004 | 986,810 g | 934,78 | sí (+52,03) | 986,81 (a mano) |
| mal_2_q5 sin la ranura R41 | 101 595,130 | 101 595,130 | 0,0005 | 798,538 g | 625,00 | sí (+173,54) | 798,54 |
| mal_3_q6 vaciado sin paredes | 52 951,827 | 52 951,827 | 0,0001 | 416,201 g | 430,39 | sí (−14,19) | 416,20 |

El STEP que exportó CATIA de cada mutante, medido con build123d, da lo mismo. Con el 07 (la BIEN a 0,004 g de la lámina)
el par queda completo: **el control de la masa deja pasar la BIEN y frena las tres MAL, también hecho en CATIA.**

Para la centralización (LECCIONES_CATIA.md / catia.md):

1. **Un juez de mutantes pide tres cosas, no una**: que CATIA reproduzca el modelo malo (cruce con el mal_*.py), que el
   control dé ROJO contra la respuesta del papel, y que la masa sea la del mutante. Solo «rojo» no alcanza: una pieza
   rota cualquiera también da rojo. Y la prueba sin CATIA tiene su gemelo: si CATIA hubiera hecho la pieza BIEN, la masa
   da la lámina y el juez dice que no (`test_juez_no_aprueba_la_pieza_buena`).
2. **El vaciado sin paredes se calcula en Python puro** con las regiones de `perfil_2d.py` del 07: hueco × (C − 12) menos
   (hueco ∩ disco R41) × 24 (lo que ya sacó la ranura) menos el agujero de 11 arriba de la ranura (π·5,5²·8). Da
   −26 565,057 mm³ = build123d (`region_menos_disco` sirve también para la intersección: área − área de lo que queda).
3. **El 07 se reusa entero importándolo** (`importlib`, como `e07`): sus croquis, planos y material; el 12 solo decide qué
   operación se saltea. Sin la ranura, el agujero de 11 corta la altura entera (π·5,5²·44), no C − 24 como en la BIEN.
4. **El cruce contra un mutante sale de su propio script**: `medir_b123d.py bien <mal_*.py>` escribe un STEP por pregunta
   (`<nombre>__q3.step`...) y se toma la que cambia. `correr_ejercicio` mide igual el bien.py del 13 (queda en
   `build123d_bien_aparte`, informativo).
5. Captura: con las partes corridas 300 y 450 en x, el encuadre (`Reframe`) incluye los planos de origen en x 0 y la
   pieza sale chica en la imagen (mal_2 y mal_3). No cambia ninguna medida; si la captura va a mostrarse, ocultar
   también `OriginElements`.
6. Los cuadros «Converting Data...» (un solo botón Cancel) al exportar el STEP aparecieron y el vigía no los tocó, como
   dice catia.md: se cierran solos.
7. **`juez_comun.comparar` mira solo las partes que midió build123d** (revisor Fable, 24/10): si un `mal_*.py` no se
   pudiera medir, ese mutante pasaba sin cruce y el juez daba verde con dos cruces de tres. `cerrar_con_juez` exige el
   cruce de los tres (re-corrido sobre la salida real de `12_r1`: sigue verde). Y la prueba tiene el borde: a 0,9 g de
   la lámina el control no da rojo, así que el juez no aprueba ese mutante.
