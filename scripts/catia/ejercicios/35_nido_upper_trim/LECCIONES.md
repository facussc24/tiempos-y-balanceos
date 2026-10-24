# Lecciones del ejercicio 35 (nido que copia el panel del cliente del Upper Trim) — CATA, 24/10/2026

Corridas reales: CATIA R21 (B21, 32 bits) de CATA con el Python 3.12.10 del sistema, en `%TEMP%\catia_cata_tanda\`.
- `35_r1` (12:00:22-12:04:06): VERDE al primer intento. CATIA 27,6 s (`salida.json`, `segundos`); `choque_exacto.py`
  12:00:43-12:04:06, unos 3,4 min. Base: el `ej24_nido_cliente.py` de la práctica del 19/10 (PEDIDO 26 de la principal);
  el panel es la copia del 33, verificada por sha256.
- Después del revisor Sonnet (un grave: la ruta de `choque_exacto.py` colgaba de la carpeta del ejercicio y desde el
  paquete del obrero no existe; ahora cuelga de `jc.REPO`), `35_final` (12:17-12:20) con el código que se sube: los mismos números.

| Qué | CATA, 24/10 | Práctica, PC principal, 19/10 |
|---|---:|---:|
| Bloque en CATIA (cuenta 170 × 58 × 19 = 187 340) | 187 340,000 mm³ | 187 340,0 |
| Nido en CATIA | 171 459,136 mm³ | 171 459,136 |
| Huella (bloque − nido) | 15 880,864 mm³ | 15 880,864 |
| Nido en OpenCASCADE (STEP de CATIA) | 171 457,147 mm³ (−0,0012 %) | 171 457,147 |
| Intersección exacta (fuzz 1e-4 / 1e-3 / 1e-2) | 0 / 0 / 0 | 0 / 0 / 0 |
| Distancia mínima | 0 | 0 |
| Gemelo: nido subido 1 mm (dato, no decide) | 7 478,2023 mm³ | 7 478,2023 |
| Sólidos del nido | 5 | 5 |

Para la centralización (LECCIONES_CATIA.md / catia.md):

1. **El nido del ej24 no es una pieza: son 5 sólidos.** Medidos sobre el STEP de CATIA (`35_r1`) con build123d: uno de
   171 384,489 mm³ cuya caja envolvente es el bloque entero (x −40 a 130, y −29 a 29, z −25 a −6) y cuatro iguales de
   18,16 mm³ cada uno, con caja envolvente de 3,6 × 3,6 × 1,8 mm (no son prismas: la caja de 3,6 × 3,6 × 1,8 daría 23,3),
   arriba del bloque (z −7,78 a −6), en y 9,5 a 13,1 y x −24,8 / 23,8 / 65,0 / 113,6. Los cinco suman 171 457,13 contra
   los 171 457,147 de OpenCASCADE. Son material del bloque que el panel encierra y que queda suelto al restarlo. Las
   NOTAS de la práctica (19/10) dicen que los 5 pedazos salen de que «el panel atraviesa el bloque de lado a lado»; lo
   medido es una pieza que ocupa el bloque entero más esas cuatro islas. Como ejercicio cumple la fila (intersección 0,
   distancia 0). Como nido impreso, las cuatro islas no quedarían pegadas a nada. El juez informa la cantidad de sólidos y
   no decide por ella; si la fase 3 lleva este nido a una pieza real, el que decide es el diseño.
2. **El contacto lo decide la distancia exacta, no el gemelo** (`choque_exacto.py`, nota del auditor del 19/10). El gemelo
   (+1 mm, 7 478 mm³) solo dice que el control no está ciego en ese sentido: queda informado.
3. **El volumen del bloque no dice DÓNDE está**: un bloque de 170 × 58 corrido 10 mm da el mismo 187 340 y, si sigue
   tocando el panel, el mismo «toca». Lo que fija la posición es el volumen del nido contra el de la práctica (171 459,136
   a TOL_VOL), que es otra CATIA haciendo lo mismo con el mismo panel verificado; el juez lo exige (revisor Sonnet).
4. **El mismo resultado en las dos CATIA** (principal 19/10, CATA 24/10) hasta el último decimal: la práctica se reprodujo
   en otra PC sin tocar la geometría.
5. **Una ruta a la skill desde un ejercicio va por `jc.REPO`**, no por la carpeta del archivo: el paquete del obrero
   (`COLA 3D\obrero`) copia `ejercicios/` y no `.claude/skills` (es el arreglo del juez común para los 006/007/008 de CATA).
   Y el tope del choque (900 s) queda por debajo del corte del obrero (1 200 s, `obrero.py --timeout-seg`): con 1 800 el
   obrero mataba primero a `catia.py`.
6. **`choque_exacto.py` tardó unos 3,4 min en CATA** (en la práctica, 521 s en la principal; ahí corría como paso, con
   CATIA abierta). Corre en el post-proceso, con CATIA ya cerrada.
7. **La copia se verifica a sí misma**: se copia el STEP a la carpeta de trabajo y se le calcula el sha256 a la COPIA, que es
   lo que abre CATIA y mide el juez (antes se calculaba sobre el original y la copia no se volvía a leer). Igual en el 33.
8. Detalle menor del juez común: `cerrar_parte` llama «ocultar el plano antes de exportar» a todo lo que oculta. Acá oculta
   el cuerpo del panel pegado y el plano de z −25. El rótulo dice «plano» para los dos.
