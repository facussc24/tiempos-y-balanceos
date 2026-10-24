# Constructores de la casa y procedencia de cada pieza (GATE 1)

Propuesta 2 del informe del sistema 3D (`docs/INVESTIGACION_SISTEMA_3D_2026-10-23.md` §10.2), hecha el 24/10/2026. La
regla que la origina: «el redondeo es PROPIEDAD del constructor» (`utillajes-de-apriete.md`, 19/08). Esa propiedad vivía
en un build de agosto y el 20/10 se perdió al modelar en CATIA: las cajas salieron peladas.

## Antes de dibujar: el catálogo de la casa

```
python -m cadlib.constructores --buscar <qué>        # data/catalogo_casa.json (desde scripts/, con .venv-cad)
indice_dispositivos.py --buscar <mecanismo>          # después: lo fabricado y andando
```

Caja, placa, `colocar` y la palanca de MakerWorld (con sha256; no está en el repo público) ya están, cada una con su
caso del banco 3D (20, 21, 22).

## Los constructores

| Qué | build123d (`cadlib/constructores.py`) | CATIA (`scripts/catia/constructores_casa.py`, raíz del repo) |
|---|---|---|
| Caja o tope: R en las 4 verticales y el contorno de arriba (dos pasos: esquina esférica); abajo viva porque se funde | `caja(largo, ancho, alto, radio=None, motivo=None, centro=(0, 0, 0))` | `caja(ctx, …)` mismos parámetros |
| Placa: R arriba y en las verticales; chaflán a 45° en el contorno de la cama (G6) | `placa(largo, ancho, espesor, chaflan_cama=None, radio=None, motivo=None, centro=…, motivo_cama=None)` (un motivo por apartamiento) | `placa(ctx, …)`: Chamfer de dos largos iguales |
| Ubicar una pieza (propia o de afuera) | `colocar(forma, M)`: se niega con un espejo (det −1) o con escala; `marco(eje_x, eje_y, origen)` da det +1 | `colocar(c, forma, M)`: valida antes de `Position.SetComponents` |

- Los valores por defecto salen de `data/lenguaje_diseno.json` (radio de la mano = el umbral de `cantosCanon.data.json`,
  R3 donde se agarra, chaflán de cama 45° con el tamaño A DECIDIR, tornillería común de ferretería). Apartarse (radio
  menor, cama sin chaflán) pide `motivo` de 10 caracteres o más, que queda escrito.
- Ninguno devuelve otra cosa en silencio: si no entra o falta un dato, se niega con el motivo.
- La versión de CATIA usa el MISMO núcleo de Python (lenguaje, radios, matrices); `test_constructores.py` falla si los
  nombres, parámetros o valores por defecto se separan. La prueba de que salen iguales es el juez:
  `scripts/catia/ejercicios/20_constructor_caja` y `21_constructor_placa` (24/10: 0,0 mm³ de diferencia con build123d,
  y los correctores del banco en verde sobre el STEP que exporta CATIA).
- Lo que NO cubren todavía (medido sobre el virolador del 20/10): placa con nervios, viga doble T, pata cilíndrica,
  macho con bandas, y en CATIA un perfil redondeado con arcos de verdad (el 20/10 se dibujaron como polígonos de 6
  tramos y cada quiebre es un canto vivo para el gate).

## Procedencia de cada pieza

- «Catálogo de la casa» es fuente válida de lo que pone el constructor (radio, chaflán, tornillería). **Las cotas que
  se le pasan (largo, ancho, alto) siguen saliendo del CAD medido o de Fak** (GATE 1, `core-prohibiciones` #1).
- `registrar(workdir, pieza, forma, archivo)`: evidencia `procedencia` en el manifest, atada a la firma del STEP.
- `heredar(nueva, *origenes, cambio="…")`: una pieza que sale de operar piezas de la casa (restar un hueco, agujerear)
  conserva la procedencia con el cambio escrito; sin esto se perdía en el primer booleano.
- `declarar(workdir, pieza, medida | fak | de_cero | catalogo_comercial, …)`: lo que no sale de un constructor.
  «catalogo_casa» no se autodeclara. El catálogo COMERCIAL queda con `fuente_valida: false` (propuesta P5 sin habilitar:
  toca `core-prohibiciones` #1).
- `python -m cadlib.constructores --procedencias <workdir>`: cada pieza de `out/` con su procedencia y las que no
  tienen. Es lo que mide «cero piezas redibujadas que ya existían». Hoy es evidencia: ningún gate la exige todavía.
