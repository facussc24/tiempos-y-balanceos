# Plan — tanda 2 del plan del sistema, pieza grande: gate de apoyos y de asiento sobre blando (16/10/2026)

Lo escribió la sesión Fable 5.1 de la PC principal (`34df5f0e`) a partir de `10-PLAN_SISTEMA_2026-10-16.md` (tanda 2, decisión 2),
del informe `20-informes\afuera_3d.md` (CATA, 15/10; §0 punto 5, §3.2 puntos 1 y 2, §4 punto 4) y de lo que ya hay en esta PC:
`C:\Dev\_utrim\sim_asiento.py` (la simulación v14 contra v15 del 13/10) y los gates de `.claude/skills/cad-design/scripts/`.
**Es un cambio GRANDE** (módulo nuevo del sistema 3D, regla `codigo-madre.md`): este plan primero, **el sí de Fak al plan** después,
y recién ahí una hija Opus 5.5 en su worktree con revisor Opus al final. Hasta ese sí no se escribe código del gate.

## El problema, con las palabras de Fak

13/10/2026: *"no me convence nada… cómo diseñás el 3D, cómo lo simulás, está muy flojo todo"*; *"con el 3D ya deberías poder
solucionarlo solo, me preguntás al pedo"*. El virolador v14 **pasó todos los gates** (choque, aristas, giro, zona, entregable) y en
la planta se hamaca sobre el panel tapizado: es la tercera vez desde agosto que una pieza aprobada por los controles falla en el uso.
`SKILL.md` línea 233 lo admite: los gates miran la pieza fría y desnuda contra el archivo del cliente; nada verifica cómo asienta
sobre algo blando ni que haya UNA sola forma de montar el utillaje.

## Lo medido que manda (no se vuelve a medir)

- Simulación del 13/10 (`sim_asiento.py`, 150 casos sorteando cuánto cede el tapizado 0 a 0,6 mm, error de espesor ±0,2 mm y
  alabeo de la pieza ±0,2 mm, con la mano apretando en 15 lugares): **la v14 se hamaca en 68 a 100 de cada 100 casos; la v15 en
  28 de 100, y apretando en la punta se mueve 1,7 mm**. Son los dos casos de respuesta conocida: el gate tiene que dar ROJO a la
  v14 y reproducir el número de la v15 antes de mirar una pieza nueva. Si no los reproduce, no se usa.
- La v14 apoyaba en cuatro caras (documento de Fak del 13/10): dos apoyos rígidos controlaban el mismo movimiento. Carr Lane
  (fabricante de dispositivos de sujeción; fuente abierta citada en `afuera_3d.md` F3): no usar apoyos redundantes, separarlos lo
  más posible.
- Para apoyar sobre tapizado o espuma **no hay ninguna guía publicada** (buscado el 13/10 y el 15/10): el gate es 100 % de la
  casa y nace con la disciplina de la casa: par BIEN/MAL propio en cada corrida (`SKILL.md` 120-154).
- La regla vigente mide la interferencia contra el sustrato RÍGIDO (`cad-3d.md` 339-340): correcta para no clavar la pared,
  deja afuera justo lo que falló. No se cambia: se le suma el gate.

## Qué se construye (módulo `gate_asiento.py` en `.claude/skills/cad-design/scripts/`, con `cadlib`)

1. **Activación por etiqueta**, como `gate_proceso.py`: corre solo si el utillaje apoya sobre algo blando (tapizado, espuma, goma,
   chapa fina). Una pieza que apoya sobre chapa rígida NO lo dispara (caso de control en verde).
2. **Inventario de apoyos rígidos**: cuántas superficies de la pieza tocan al panel y qué movimiento controla cada una (traslación
   en Z, giro en X, giro en Y); **ROJO si dos apoyos rígidos controlan el mismo movimiento** (eso es la v14).
3. **Ventana de asiento**: cuánto puede variar la altura del panel (espesor del tapizado más su compresión) y la pieza sigue
   apretando sin tocar plástico contra plástico. Si la ventana es de décimas, ROJO aunque el choque dé cero (memoria del 13/10).
4. **Simulación apretando** en varios puntos con el blando variando: es `sim_asiento.py` llevado a `cadlib` y generalizado
   (hoy tiene las rutas y los parámetros del virolador adentro); devuelve «se hamaca en N de 100» y «se mueve X mm en la punta».
5. **Los datos de entrada se miden, no se le piden a Fak**: el espesor nominal del tapizado sale del STEP del cliente (como
   `clasificar_caras_libres.py`); su variación real, del escaneo con el CR-Scan Raptor cuando haya pieza (tanda 2, punto 6). Hasta
   entonces, la hipótesis declarada del 13/10 (cede 0 a 0,6 mm) con su renglón «hipótesis, no medición» en la salida.
6. **Salida**: como los otros gates, un veredicto por renglón y un JSON; `gate_entregable.py` lo exige cuando la etiqueta de
   blando está puesta; `SKILL.md` lo lista en el GATE E y `cad-3d.md` lo nombra al lado de la regla del sustrato rígido.

## Casos de respuesta conocida (escritos antes de codear; la prueba de la tanda)

| Caso | Entrada | Debe dar |
|---|---|---|
| v14 del virolador (`C:\Dev\_utrim`, geometría del 13/10) | STEP + etiqueta blando | ROJO en apoyos (dos controlan Z) y ROJO en asiento (se hamaca en ≥ 68 de 100) |
| v15 del virolador | ídem | apoyos en verde; asiento: 28 de 100 ± lo que dé el sorteo con la misma semilla, 1,7 mm en la punta |
| una pieza que apoya sobre chapa rígida (por ejemplo el posicionador del Top Roll) | STEP + etiqueta rígido | el gate no corre y lo dice en un renglón |
| una pieza con tres apoyos que controlan tres movimientos distintos sobre blando | caso sintético de `cadlib` | apoyos en verde |

## Qué puede romper

- El gate puede dar ROJO a piezas que hoy pasan y están bien: por eso se calibra con la v14 (debe fallar) y la v15 (debe dar el
  número) antes de usarlo con una pieza nueva, y arranca como AVISO una semana; pasa a freno con el sí de Fak y el número de
  falsos positivos medido.
- Un contacto con material blando no es un problema de FEM: lo que hay (`scikit-fem`, 1,3 % de error en viga) alcanza para la
  compresión bajo una fuerza dada; no se instala CalculiX ni PrePoMax (cambio de la PC: pediría el OK de Fak).
- `sim_asiento.py` tarda minutos con 150 casos: el gate usa menos casos por defecto y los 150 solo en la calibración.

## Cómo se entrega

Hija Opus 5.5 en su worktree (encargo por `_encargo.mjs --lanzada`), un commit por pieza (módulo, calibración con v14/v15,
etiqueta y enganche en `gate_entregable.py`, textos de `SKILL.md` y `cad-3d.md`), tests con los cuatro casos de arriba, `npm test`
entera no hace falta (es Python: corre `test_gates_entrega.py` y el nuevo), **revisor Opus** (auditor) con informe a
`docs/auditorias/`; la madre funde y publica. Las otras piezas de la tanda 2 (build123d-mcp 0.3.90, ficha de fijaciones, ficha
FDM, cabecera STEP, criterios de aceptación, auditar la skill de la impresora con lo de Leo) son chicas o medianas y van en la
misma hija, después del gate, en el orden del plan.

## Qué necesita de Fak

Su sí a este plan (un «dale» alcanza). Nada más: los datos se miden, el escaneo del panel se prueba el día que haya pieza, y el
filo de las ranuras lo decide el diseño en la tanda 11.

## Resultados (17/10/2026, escrito después de correr todo; lo de arriba no se tocó)

Hija Opus 5.5, encargo `E261017-91f6`, rama `claude/gate-asiento-tanda2`, sin push.

### Los casos de respuesta conocida

`gate_asiento.py calibrar` (150 casos, semilla 7) **reproduce EXACTO** lo publicado el 13/10, y deja el registro en
`.claude/skills/cad-design/data/asiento_calibracion.json` con la firma del núcleo: si `cadlib/asiento.py` o
`gate_asiento.py` cambian, `verificar` no juzga una pieza nueva (código 3) hasta volver a calibrar.

| | v14 | v15 | v16 (primera pieza nueva) | chapa rígida | 3 apoyos sintéticos |
|---|---|---|---|---|---|
| Apoyos (pose de diseño) | **ROJO**: 7 (4 bloques + 3 pasadores metidos 3,75 mm en el tapizado tapado) = los 7 que declara `casos_3d.json` | **ROJO**: 4 bloques | **ROJO por la letra**: 4; renglón 4-2-1 VERDE (una superficie, dispersión 0,000) | el gate NO CORRE y lo dice | **VERDE** (3) |
| Ventana banda / punta (mín. 1,0 / 0,6) | **ROJO** 0,23 / 0,24 (publicado 0,20 / 0,24) | VERDE 1,21 / 0,75 (publicado 1,19 / 0,75) | VERDE 1,21 / 0,75 | — | — |
| Asiento (% que se hamaca > 0,3 mm) | **100** tapados, **68** abiertos | **28**; en la punta **1,69 mm** | 0, máxima 0,16; punta NO APLICA (cae adentro de los apoyos): AVISO desde la ronda 1 | — | 0 |
| Gemelo, espesor desparejo (50 casos) | — | 66 %, máx. 1,31 (= tanda 11) | 8 %, máx. 0,54 (= tanda 11) | — | — |

Tolerancias, fijadas antes de medir: simulación exacta (0 % y 0,01 mm, las de `casos_3d.json`); ventana 0,05 mm.

### Decidí distinto del plan, con la evidencia

1. **La v15 da ROJO en apoyos, no verde** como decía la tabla de arriba: tiene cuatro bloques rígidos que controlan la
   altura. Es lo que midió la tanda 11 (`casos_3d.json`) y la simulación lo confirma (28 de 100). No se aflojó la regla.
2. **El labio de plástico no se mide: es una cota declarada de la escena.** La pared de la ranura tiene desmoldeo (0,4 mm
   en 7 mm) y no hay un borde en z −7,49; ese número es el arriba de la banda que apretaba el dedo de la v9
   (`ranura_z_one.json`). Lo que sí se mide es la banda recta de la PIEZA (rayos horizontales): −7,26 en la v14 y −6,28
   en la v15, contra −7,29 y −6,30 publicados.
3. **El inventario de apoyos usa una grilla de 0,25 mm, no la de 1 mm de la simulación**: la de 1 mm no ve el tercer
   pasador de la v14 (0,9 mm de ancho entre dos puntos). La simulación sigue con la de 1 mm (si no, no reproduce) y el
   gate avisa cada apoyo que ella no ve. Mirar el vértice más alto de cada celda se probó y se descartó: cerca de la
   ranura mezcla dos alturas del panel y dio 18 apoyos fantasma.
4. **Las esquinas que se miden son de cada pieza**: la v16 tiene placa de 168 mm y se mide en x −38,1 / 127,9 (como la
   tanda 11); la v14 y la v15, en −35 / 125.
5. **Pasa a freno con el sí de Fak**: hoy `procesoCanon.data.json` → `gateAsiento.modo = aviso`, revisar el 24/10.

### Las otras piezas de la tanda 2

| Pieza | Qué quedó | Archivo |
|---|---|---|
| build123d-mcp 0.3.90 | **No se probó**: en esta PC solo está la 0.3.83 y probar la nueva es bajarla (instalar). Procedimiento escrito para el sí de Fak | `reference/build123d-mcp.md` |
| Ficha de fijaciones | `make_screw_nut.py` no modela una tuerca impresa más baja que el diámetro (regla de Leo) sin `--tuerca-baja "<motivo>"` | `scripts/make_screw_nut.py`, `test_fijaciones.py`, `ficha-fdm.md` R2 |
| Ficha FDM | Ya existía (tanda 11). Se sumó lo que trae el perfil del laminador: agujeros 0, contorno 0, pie de elefante 0,15; y `cad-3d.md` la enlaza y deja de presentar la Elegoo como la máquina actual | `ficha-fdm.md` M4, `cad-3d.md` |
| Cabecera STEP | `export_deliverables.py` la arregla en la copia que entrega y la vuelve a leer; G-E6 avisa; `cabecera_step.py revisar` para lo ya entregado. En la nube (`5. 3D`): 63 STEP, 4 en la PC y en orden, **59 solo en la nube sin abrir** (abrirlos los descarga) | `cadlib/step_cabecera.py`, `cabecera_step.py`, `test_step_cabecera.py` |
| Criterios de aceptación | G-E7: `<workdir>/criterio_aceptacion.json` (qué se mide, con qué, con qué valor se acepta), aviso la primera semana | `gate_entregable.py`, `test_gate_entregable_tanda2.py` |
| Skill de la impresora con lo de Leo | Las dos observaciones de Leo (tuerca ≥ diámetro; más alta, más agarre) van a la ficha y al freno de `make_screw_nut.py`; la orientación ya no queda «pendiente»; enlaza la ficha FDM, el GATE A y el criterio. No hay otro mail ni audio de Leo en la carpeta del viernes: solo las dos notas de Fak | `impresion-3d-bambu/SKILL.md` |

### Ronda 1 del auditor Opus (18/10, madrugada): 8 importantes, todos arreglados

Informe y respuestas: `docs/auditorias/TANDA2_GATE_ASIENTO_auditor_2026-10-17.md`. Lo que cambió en el gate:
- **Inventario** (I1, I2): el corte es la luz más chica + 0,10 (no 0,10 fijo: una pieza 0,11 mm más lejos daba
  «0 apoyos» VERDE); cada zona dice qué controla (Z, y un giro si es larga); menos de tres restricciones, una superficie
  grande o una zona metida dan ROJO; sin panel enfrente, SIN DATO. v14 7, v15 4, v16 4, iguales alejadas 0,10 mm.
- **Activación** (I3): si el pliego, la escena o `--etiqueta` no coinciden, código 2; G-E5 avisa la omisión.
- **G-E5** (I4) coteja la firma de la pieza; **candado** (I5) firma también umbrales, escena y panel; **peor variante**
  (I6) por veredicto; **punta** (I7) se simula siempre y un NO APLICA deja el asiento en **AVISO**: la v16 pasa de
  «asiento VERDE» a «asiento AVISO» (la punta la decide la prueba física). Recalibrado: reproduce exacto.
- Detalles: el criterio de aceptación rechaza relleno («?», «pendiente»); la cabecera STEP se reordena en su lugar sin
  tocar comentarios ni otras entidades; una calibración de prueba corta no pisa el registro.

### Qué necesita de Fak, pieza por pieza

| Pieza | Qué necesita |
|---|---|
| Gate de asiento | Nada para usarlo como aviso. Para pasarlo a **freno** (después del 24/10): su sí, con el número de falsos positivos de la semana. Un candidato ya conocido: la v16 da ROJO en apoyos «por la letra» (cuatro apoyos coplanares, que la ficha de utillajes U7/U8 admite como 4-2-1); el veredicto de la v16 lo da su prueba física (apretar en cinco lugares), que sigue siendo de Fak |
| build123d-mcp 0.3.90 | Su sí para bajarla (es instalar) |
| Ficha de fijaciones, ficha FDM | Nada |
| Cabecera STEP | Nada para lo nuevo (`export_deliverables.py` la arregla). Para los **59 STEP ya entregados que están solo en la nube** (`5. 3D`): su sí para bajarlos y revisarlos (abrirlos los descarga) y, si salen al revés, su OK para reemplazarlos (son entregables) |
| Criterio de aceptación (G-E7) | Nada como aviso; su sí para pasarlo a freno, igual que el gate |
| Skill de la impresora | Nada. Si Leo mandó más observaciones (un mail o un audio) que no estén en la carpeta del viernes, que Fak las pase |

Las sesiones abiertas: los cambios están en esta rama; ninguna sesión los ve hasta que la madre funda la rama en `main`.
Después, la regla `cad-3d.md` (con `paths:`) entra cuando una sesión toca un archivo 3D; la que ya la cargó sigue con la
versión vieja hasta reabrirse. Las skills se leen al cargarlas.

### Regresión

Los tests de la skill que ya existían dan lo mismo que antes, renglón por renglón (`test_gates_entrega`,
`test_gates_proceso`, `test_eval_casos_3d`, `test_criterios`, `test_gate_cuerpos`, `eval_casos_3d.py` sobre las corridas
del 17/10, `test_catia_medir`); el banco `cad-design` pasa a 4 casos.
