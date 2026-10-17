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
