# Lecciones del ejercicio 36 (CSWA 2013 «Tool Block», etapas 1 y 2) — CATA, 24/10/2026

Corrida real: CATIA R21 (B21, 32 bits) de CATA con el Python 3.12.10 del sistema, en `%TEMP%\catia_cata_tanda\36_r1`
(12:41:26-12:42:00). VERDE al primer intento, las dos etapas en una sola CATIA. Base: el `ej41_tool_block.py` de la
práctica del 19/10 con su carpeta `ej41_tool_block/` (PEDIDO 27 de la principal), copiados sin cambios salvo la pieza.
Después del revisor Sonnet (sin graves; sumó el centro al juez), `36_final` (13:04:39-13:05:12) con el código que se sube:
los mismos números y el centro a 0,0004 mm del gemelo en las dos etapas.

| Etapa | CATIA (mm³) | Masa de CATIA | Examen | Gemelo build123d | STEP |
|---|---:|---:|---:|---:|---:|
| 1 (81 · 57 · 43) | 118 929,059 | 939,540 g | 939,54 | 0,000 mm³ | 118 929,059 |
| 2 (84 · 59 · 45) | 130 673,504 | 1 032,321 g | 1 032,32 | +0,001 mm³ | 130 673,504 |

Steel del catálogo (7 860) pasado a 7 900 con su parámetro `Density`: densidad implícita 7 900,004 y 7 900,002.

Para la centralización (LECCIONES_CATIA.md / catia.md):

1. **El papel no carga desde solidworks.com** (tiempo agotado por WebFetch y por curl, desde CATA y desde el revisor). La
   copia de web.archive.org de la misma URL (21/05/2024) sí: «CAD Instructor Guide», apéndice A; pregunta 3 «Tool Block –
   Step 1» en la pág. 4 del PDF (impresa 308; el dibujo en la 3), pregunta 4 «Step 2», respuestas en la pág. 9 (impresa
   313): «3 d) 939.54 g» y «4 1032.32 g». El texto del PDF no dice «2013»: solo el nombre del archivo (los metadatos dicen
   2012).
2. **Un perfil que viene de un JSON se vuelve a generar en la prueba**: `e1.json` y `e2.json` son lo que `de_build123d.py`
   saca del gemelo (`contornos.e1()` / `e2()`); la prueba `ContraBuild123d` lo repite y compara tramo por tramo. Si alguien
   toca el gemelo o el JSON, el perfil de CATIA y el del gemelo ya no son el mismo y la prueba lo dice.
3. **Dos etapas en una corrida, cada una en su CATPart y con su masa**: `construir` arma la etapa 1, le pone el material,
   la cierra (STEP + captura) y recién ahí arma la 2. El juez común ya maneja varias partes (`_steps`, un STEP medido por
   parte); la masa va por parte en `masa_catia_g`.
4. **Una prueba que reemplaza una función de `juez_comun` la devuelve** (`try/finally`): el módulo es uno solo para toda la
   suite, y sin devolverla las pruebas del 33 y el 35 (que corren después, por orden alfabético) habrían usado el
   reemplazo (se vio leyendo, antes de correr la suite; no se llegó a ver fallar). Igual con `sys.modules["gemelo"]` y el
   `sys.path` que agrega la prueba del gemelo: los `contornos.py` del 25, 27 y 29 importan OTRO `gemelo` (revisor).
5. **La masa no ve un agujero corrido ni un perfil espejado** (revisor Sonnet): el juez compara además el centro de CATIA
   con el del gemelo a TOL_CDG por eje (etapa 1: 44,622 · 33,308 · 21,5 contra 44,6224 · 33,3076 · 21,5). El agujero de
   14 corrido 3 mm en y mueve el centro 0,17 mm. Los moldes 22 y 24 juzgan solo masa y volumen: para la centralización.

**24/10, auditor de la tanda de CATA (Opus):** el juez no miraba la topología del STEP de CATIA. Con una cara suelta agregada al STEP
seguía dando verde (le pasó de verdad al 54 en 54_r1 y al 31 en 31_final3). Desde b12fc4d1 exige 1 sólido, 1 cáscara y 0
caras sueltas (el control del 24 y del 49), con su caso rojo en la prueba; la corrida real con el código nuevo da verde.
