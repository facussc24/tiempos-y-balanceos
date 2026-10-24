# Lecciones del ejercicio 42 (molde de dos mitades de un hisopo) — CATA, 24/10/2026

Corrida real: CATIA R21 (B21, 32 bits) de CATA con el Python 3.12.10 del sistema, en `%TEMP%\catia_cata_tanda\`.
- `42_r1` (12:55:11-12:55:40): VERDE al primer intento. Base: el `ej71_molde_hisopo.py` de la práctica del 19/10
  (PEDIDO 27). `42_final` (13:09:15-13:09:40), con el juez contra lo que yo creía publicado: los mismos números.
- El revisor Sonnet abrió el PDF del MIT y marcó tres graves (punto 1 y punto 2). `42_final2`, con el juez arreglado y el
  código que se sube: los mismos números, el centro y el STEP (1 sólido, 2 cáscaras, 0 caras sueltas).

| Qué | CATIA | Cuenta / papel |
|---|---:|---:|
| Pieza (revolución) | 1 129,94 mm³ | π(4,3²·15,4 + 1,5²·33,3) = 1 129,94 |
| Bloque / bloque con la cavidad | 61 830,00 / 60 700,06 mm³ | 61 830 / 60 700,06 |
| Cada mitad (AddNewSplit por XY, un lado y el otro) | 30 350,03 mm³, centro z ±7,61, una cara en z 0 | — |
| Cara de partición de cada mitad | 1 828,66 mm² | — |
| Área proyectada = 2 061 − 1 828,66 | 232,34 mm² (las dos mitades) | papel 0,00023234 m² = 232,34 |
| Fuerza por pieza (70 MPa × área) | 16,264 kN | producto del papel 16 264 N; impreso «16.2 kN» |
| Caben en 80 kN | 4 | papel 4 |
| Centro del molde | x 24,566 | cuenta 24,5655 |
| STEP del bloque con la cavidad | 60 700,06 mm³, 1 sólido, centro x 24,5655 | = CATIA |

Para la centralización (LECCIONES_CATIA.md / catia.md):

1. **Se cita el número que imprime el papel, y la razón de una diferencia no se inventa.** El PDF (págs. 3 a 5) imprime
   A = (0,0154 × 0,0086) + (0,0333 × 0,003) = 0,00023234 m², y para la fuerza escribe «16.2 kN» (el producto da
   16 264 N); el papel no dice por qué. La primera versión de este juez tomó el «2,32 × 10⁻⁴» de la ficha E13 del banco
   como si fuera lo impreso y le agregó una causa («redondea el área antes de multiplicar») que el papel no dice: el
   revisor abrió el PDF y la sacó (regla `core-prohibiciones.md` §1: la causa de un dato ajeno se cita o no se escribe).
   Una ficha que resume un papel no es el papel: si el original se puede abrir, se abre.
2. **Los volúmenes no ven una cavidad corrida, ni un STEP de dos sólidos** (revisor Sonnet): corrida 5 mm en x o en y, el
   volumen de la pieza, del bloque, de las mitades y el área de partición son los mismos. El juez compara además el centro
   del molde (x = 24,5655, la cuenta del bloque menos cabeza y cuerpo) en CATIA y en el STEP a TOL_CDG, y exige que el STEP
   sea 1 sólido sin caras sueltas (tiene 2 cáscaras: la de afuera y la de la cavidad cerrada).
3. **El área proyectada sale de MEDIR la cara de partición de las DOS mitades** (bloque menos la cara que queda en z 0): si
   una mitad no hubiera quedado con la huella, su área daría 0 y el juez lo ve en cualquiera de las dos.
4. **La fuente vive en el banco de la principal**: `repo-privado\.sgc-cache\criterio-disenador-2026-10-19\
   banco_ejercicios_diseno.md` (fichas E1 a E19, con su URL). Antes de buscar en la web, buscar ahí por nombre de archivo
   (no barrer OneDrive por contenido). Y un PDF que WebFetch devuelve comprimido queda guardado en el disco y se lee con
   pypdf (con la salida a un archivo en UTF-8).
5. Sin cambios de geometría respecto de la práctica: la copia no captura (la captura la hace `cerrar_parte` sobre el
   bloque con la cavidad, en BMP), no importa `correr`, `captura` ni `os` y devuelve el contexto (encabezado de
   `pieza_ej71.py`).
