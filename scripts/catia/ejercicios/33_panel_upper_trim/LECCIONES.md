# Lecciones del ejercicio 33 (el panel del cliente del Upper Trim abierto en CATIA) — CATA, 24/10/2026

Corridas reales: CATIA R21 (B21, 32 bits) de CATA con el Python 3.12.10 del sistema, en `%TEMP%\catia_cata_tanda\`.
- `33_r1` (11:49; 27,3 s de CATIA según `salida.json`): VERDE al primer intento con el primer juez (volumen y área contra
  build123d por defecto: +0,003 % y +0,0009 %). El STEP es la copia del panel en el marco del virolador que la PC principal
  dejó en `para CATA - practica 19-10\v14_choque\panel_marco_local.step` (PEDIDO 26, 11,2 MB, sha256 `fb74d977…4e1e`,
  verificado antes de abrir); su cabecera ya está en el orden de ISO 10303-21. Su `salida.json` quedó reescrito a las
  11:55 por la prueba del juez nuevo sobre esa carpeta: lo del primer juez no está en disco.
- Después del consejo del asesor (el juez no miraba la topología del STEP exportado y medía el original de la nube en vez
  de la copia) y del revisor Fable (sin graves; la afirmación del punto 3 no estaba probada), `33_final` con el código que
  se sube: los mismos números (`33_final` 11:56, `33_final2` 12:10 después del arreglo del revisor y `33_final3` 12:16,
  con el sha256 calculado sobre la copia que abre CATIA y no sobre el original, del revisor del 35; 26,2 y 29,4 s de
  CATIA; con el juez, unos 50 s de reloj).

| Qué | Volumen (mm³) | Área (mm²) | Centro (mm) |
|---|---:|---:|---|
| CATIA sobre la copia | 91 770,060 | 96 035,359 | 44,865 · −61,217 · −7,647 |
| OpenCASCADE fino (eps 1e-6) sobre la copia | 91 766,750 | 96 034,395 | 44,8686 · −61,2152 · −7,6461 |
| build123d por defecto sobre la copia | 91 767,169 | 96 034,520 | 44,8683 · −61,2152 · −7,6461 |
| OpenCASCADE fino sobre el STEP de CATIA | 91 763,081 | 96 033,918 | 44,8644 · −61,2160 · −7,6489 |
| build123d por defecto sobre el STEP de CATIA | **91 719,392** | 96 032,088 | **44,8100** · −61,2346 · −7,6631 |

CATIA contra OpenCASCADE fino: +0,0036 % de volumen, +0,0010 % de área, 0,0036 mm de centro. El STEP de CATIA contra la
copia: −0,0040 %, 0,0042 mm de centro, 1 sólido, 1 cáscara, 0 caras sueltas, válido para OpenCASCADE. Los centros, por eje
(el mayor de los tres; `juez_comun.comparar` usa la distancia, que acá daría 0,0051).

Para la centralización (LECCIONES_CATIA.md / catia.md):

1. **Los números de la COLA (91 765,561 de build123d, 91 791,099 de CATIA el 17/10) son de `two_wireless.stp`, no de esta
   copia**: la principal lo avisó en el PEDIDO 26 («medí esta antes de dar un número») y la copia da 91 767,169. Una
   respuesta conocida se mide sobre el archivo que se abre, identificado por su sha256.
2. **La integración por defecto de `medir_b123d.py` no alcanza para el STEP que exporta CATIA de una pieza toda NURBS**:
   da −0,052 % de volumen y el centro 0,058 mm corrido en X (más que TOL_CDG), y con la integración adaptativa
   (`BRepGProp.VolumeProperties_s(forma, props, 1e-6)`) el mismo archivo da −0,004 % y 0,0042 mm. La geometría no cambió:
   cambió la integración, sobre una representación de las superficies que no es la del original. **Antes de decir que
   CATIA perdió geometría al exportar, medir fino.** Para la principal: si `medir_b123d.py` gana la opción `eps` (es
   compartido: desde acá no se tocó; la medición fina vive en `medir_fino.py` de esta carpeta, 9 s para los dos STEP).
3. **El volumen no caza una cara perdida, la topología sí**: el 0,1 % son 92 mm³ y el ruido de la integración por defecto
   ya se comía 48; una cara chica que se cae al exportar cambia pocos mm³ y pasa. Medido con una caja 10 × 20 × 30
   exportada sin una cara (sólido armado sobre la cáscara abierta): build123d la lee como **0 sólidos y 5 caras sueltas**,
   y `BRepCheck_Analyzer` la da **válida** (la integración fina le da 4 800 mm³). El juez del 33 decide el STEP exportado
   por 1 sólido y 0 caras sueltas, además del volumen y el centro finos; la prueba `ContraOpenCascade` lo corre con
   OpenCASCADE de verdad (sana: verde; sin una cara: rojo). «Válido» de BRepCheck no alcanza para esto.
4. **Pieza del cliente fuera del repo**: el `catia.py` toma la ruta de `CATIA_PANEL_UPPER_TRIM` o de la carpeta de la nube,
   verifica el sha256 y abre una COPIA en la carpeta de trabajo; el juez mide esa copia (ya verificada y sin depender de
   que OneDrive tenga el original bajado). La prueba corre sin la pieza: STEP falso con su propio sha256 y mediciones
   inyectadas.
5. **El STEP de afuera se abre con `Documents.Open` y se toma `ActiveDocument`**, como dice catia.md: anduvo igual en la
   R21 de CATA (el cuadro «panel_copia.step» del import se aceptó solo; los de «Converting Data...» no se tocaron).
