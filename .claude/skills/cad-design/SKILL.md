---
name: cad-design
description: >
  Diseño y modificación de piezas 3D / CAD para Barack — importar un STEP/STL de cliente,
  medirlo, registrarlo contra otra pieza (ICP), modelar/modificar parametrico, verificar
  interferencia y holguras, y exportar STEP + STL + GLB + renders. Usar cuando Fak pida
  "diseñá/modificá esto en 3D", pase un archivo 3D (STEP/STL/IGES) para editar, pida un
  posicionador/fixture/utillaje impreso, o cualquier modelado de pieza. Incluye el entorno,
  la librería cadlib + CLIs genéricos y los errores caros que NO hay que repetir.
---

# cad-design — diseñar y modificar piezas 3D en Barack

Capacidad probada en el caso Posicionador Top Roll Trasero (ver
`examples/posicionador/README.md`: el caso completo, sus 4 errores caros y dónde viven
las fuentes). La librería y los CLIs viven en `.claude/skills/cad-design/scripts/` (`cadlib/` +
un CLI por gate, todos con `--help`). Acá se los nombra pelados (`gate_zona.py`); la ruta completa
es esa, **no** el `scripts/` de la raíz del repo, que es otro.

## 0. LOS GATES (bloqueantes)

> **Causa raíz de TODOS mis fallos 3D** (confirmada): bajo presión de "avanzar rápido"
> sustituyo la fuente real por un proxy (export parcial, capa blanda, dibujo genérico,
> "confío que salió") y salto la verificación → Fak termina siendo mi control de calidad.
>
> **Y la segunda causa raíz, encontrada el 02/09/2026 después de tres entregas rechazadas
> en tres días:** diseño la **ESTRUCTURA** (que aguante, que no vuelque, que entre por la
> puerta) y no diseño el **PROCESO** (qué le pasa a la pieza mientras la trabajan). En las
> tres entregas el cálculo estructural estaba bien. Todos los gates de abajo miran la pieza
> **quieta**: la zona, el frame, el ensamble, el tamaño. Un dispositivo puede pasarlos todos
> y no servir, porque lo que lo hace fallar pasa **mientras el operario trabaja**. Por eso
> el primer gate ya no es el 0.

**GATE P — EL PROCESO** (antes que todo lo demás, incluso antes de mirar la zona).

```
gate_proceso.py familias                                   # qué pregunta cada fuerza
gate_proceso.py plantilla --tags adhesivo-a-pistola,pieza-flexible,la-pieza-gira --out pliego.json
gate_proceso.py verificar pliego.json --workdir W --carpeta-pedido <carpeta del pedido>
```

Tres cosas, y cada una nace de un fallo real de la tanda de adhesivado (29-31/08/2026):

- **(a) LAS FUERZAS.** Por cada familia que aplica al proceso: qué magnitud tiene, **en qué
  ETAPA** actúa y **qué PIEZA del dispositivo la resuelve**. Una pieza que no está en la lista
  de piezas no es una respuesta; "se sujeta" tampoco; un número sin unidad ni fuente tampoco.
  Y **toda etapa de la secuencia tiene que tener al menos una fuerza analizada**: la etapa muda
  es la que nadie pensó, que es literalmente lo que pasó con *"mientras se rocía"*. El carro
  apoyaba la pieza y asumía que se quedaba quieta; el adhesivo va **a pistola**. Fak, textual:
  *"pones la tela ahí, le tirás adhesivo directamente, **SE VA A VOLAR LA TELA**"*.
- **(b) EL VIDEO ES EL PLIEGO.** Si el que pide mandó un video, un plano o una foto, se mira
  **antes** de diseñar. Con `--carpeta-pedido` el gate **busca los videos en la carpeta del
  pedido y falla si el pliego no los declara**: lo que hay que cazar es la OMISIÓN, no la
  mentira. El video de Carlos (7 min, adhesivado con rueda y plato giratorio) estaba desde el
  20/08 y no se usó en dos vueltas de diseño. Declarar `visto: true` exige evidencia en disco
  (los cuadros extraídos): marcarlo a mano es el verde vacío que el gate existe para no dar.
- **(c) RETORNO DE EXPERIENCIA.** Antes de inventar, mirar lo que Barack **ya tiene fabricado
  y andando** — Fak: *"no entiendo por qué no lo hacemos"*. El gate lo verifica contra el
  índice de `indice_dispositivos.py`: si el índice tiene dispositivos y el pliego no abrió
  ninguno, es rojo; descartar uno que ya funciona exige motivo. Y si el índice está viejo o le
  falta una raíz obligatoria, también — **un índice incompleto se lee igual que "no hay nada
  parecido"**, que es justo la conclusión falsa que habilita a inventar de cero.

Lo que este gate **no** hace: juzgar si la respuesta es buena. No sabe de adhesivos. Verifica
que la pregunta esté contestada, que apunte a una pieza que existe y que los números tengan
unidad o digan TBD con motivo. *La máquina puede MATAR un dato, nunca APROBARLO.*

Una fuerza puede quedar `no_resuelto` **durante el diseño** (queda marcada y a la vista), pero
`export_deliverables.py` **no entrega con eso**: pliego v2, *"un dispositivo con una fuerza sin
contestar no está terminado, por más que la estructura calcule perfecto"*.

**GATE 0 — LA ZONA** (antes de medir una sola cota). Un utillaje no se define por sus cotas sino
por la ZONA sobre la que actúa, y un número perfecto sobre la zona equivocada es peor que no medir:
da confianza. Se computa, no se mira.

```
gate_zona.py inventario <cliente.stp> --workdir W --render   # -> renders/gate0_mapa_<pieza>.png
# Fak circula cuál es sobre esa imagen
gate_zona.py inventario <cliente.stp> --workdir W --confirmar A3 --quien Fak --evidencia "..."
```

- Clasifica cada contorno PASANTE / REBAJE / ESCALÓN por **paridad de rayos**: un rebaje cosmético
  y una abertura tienen el mismo contorno y el mismo render; sólo se distinguen contando impactos
  adentro contra un anillo afuera.
- Agrupa por familias de tamaño: si la candidata mayor es una de varias iguales, sale AMBIGUO.
  Una feature que se repite casi nunca es "la" feature.
- Nunca auto-aprueba (exit 2 mientras falte `--confirmar`). Enforcement: `export_deliverables.py`
  exige `zona_confirmada` en el manifest.
- Pasarle `--normal` medida de la cara (`geom.fit_plane`): sin eso la deduce y puede reportar un
  pasante como resalte.

Hermanos del mismo CLI: `pasante` (un candidato puntual, en segundos), `macizo` (¿ese vano es aire
o material? — caza la lengüeta fundida que el render no muestra), `pose` (¿la transformación dejó
la pieza donde dije? — caza los errores de signo).

**GATE 1 — PRE-MODELADO** (antes de escribir geometría):
- ¿Tengo el ENSAMBLE completo, no un export parcial? Si es parcial → STOP, pedir el assembly.
- ¿Confirmé CUÁL pieza y computé el ROL de cada sólido por código (`cadlib.geom.contains_batched`
  + bboxes), sin adivinar?
- **¿Existe el 3D/STEP REAL? Si existe → PROHIBIDO usar un dibujo genérico/representativo.**
- Toda cota se EXTRAE del CAD medido (`cadlib.geom.extract_cylinder_axes`, `analyze_step.py`)
  o es dato de Fak. CERO dimensiones inventadas/redondeadas (extiende `core-prohibiciones` #1).

**GATE 2 — UN SOLO FRAME, derivado de la pieza** (`gate_frame.py`). Un marco 1,637° torcido
produjo tres errores que parecían independientes, y uno de ellos era un defecto **inventado** en
la pieza del cliente ("las dos ranuras están escalonadas 2,5 mm" — no lo están). Los ejes se
derivan por productos vectoriales de una dirección global limpia + la normal medida, y se
verifican con un invariante que sabe fallar: dos features que la pieza tiene alineados tienen
que dar **0,000**. *Si el sistema de medición empieza a reportar defectos en la pieza del
cliente, la primera hipótesis es el sistema de medición.*

**GATE 3 — PRE-ENTREGA: verificar el ARTEFACTO, con controles que puedan dar ROJO.**
- Render + **MIRAR yo** el resultado.
- `check_collision.py` — **los dos controles**: que no penetre Y **que asiente**. "0 puntos
  dentro" solo dice que no penetra: un utillaje flotando a 60 mm da exactamente lo mismo.
- `gate_ensamble.py --pareja x,y,z` — emparejamiento macho/hembra sobre el plano de la abertura
  real. El bbox y el volumen NO pueden ver un corrimiento (uno cae dentro igual, el otro no
  cambia al trasladar).
- `gate_aristas.py --t-fino <mm> --tension-nominal <MPa>` — concentradores **cóncavos** sin
  radio + factor de seguridad a fatiga. Una esquina interna viva multiplica ×2,2.
  **De vuelta en servicio (2026-08-09)** tras dos falsos verdes: la concavidad ya no se le
  pregunta a una malla sino a la topología OCC (normal invertida si la cara es `REVERSED`;
  la tangente **con el signo que la arista tiene dentro del wire de la cara** — ése era el
  bug que quedaba). Trae par sintético BIEN/MAL propio que corre en **cada** invocación: si
  no separa, sale con **código 3** y no juzga nada. `--verificar-material` da una segunda
  opinión con un método que no comparte una línea de código (fracción de material alrededor
  de la arista, `BRepClass3d_SolidClassifier`); sobre 5 piezas coincidieron en 1094/1094.
- `reconocer_caras.py --step <f> [--cilindros]` — tipo de cada cara (plano/cilindro/cono/
  esfera) **sin barrer rayos**: `GetType()` para las analíticas + `ShapeAnalysis_Canonical`
  `Recognition` para recuperar las que el STEP guardó como NURBS. Sobre nuestras salidas
  recupera **+28,8 %** de caras (221 planos escondidos en 504 NURBS); sobre el STEP del
  cliente sólo **+3,7 %**. Da los radios exactos de los cilindros — un agujero no se mide
  con rayos si el STEP ya sabe su diámetro. **Ojo con `--tol`:** con 5 mm casi todo es un
  plano (comprobado). También trae par BIEN/MAL y sale con código 3 si no separa.
- `clasificar_caras_libres.py <f.stp> --espesores 0.92,0.5` — **QUÉ SON las caras libres, antes
  de medir contra ellas.** Las agrupa por *offset* al sólido más cercano (por conectividad no
  alcanza: en el panel de un cliente las 112 caras libres son UN shell con **dos** offsets,
  0,500 y 0,969 mm) y cada grupo sale **CAPA DE MATERIAL** (offset constante que coincide con un
  espesor declarado) · **SUPERFICIE DE CONSTRUCCIÓN** (constante que no coincide con nada) ·
  **GEOMETRÍA REAL** (offset variable). Criterio: IQR (núcleo) **y** fracción-meseta, las dos —
  si se contradicen el grupo queda sin clasificar y sale con **código 2**. Par sintético BIEN/MAL
  propio en cada corrida (código 3 si no separa) + control por rayos que no comparte código con
  la proximidad. **Por qué existe:** medir contra la capa y después restarle otra vez el espesor
  de la tela lo contó DOS veces y el macho salió 2,11 mm angosto; dos verificaciones
  "independientes" lo confirmaron porque las tres medían con el mismo criterio.
- **Test del valor gemelo:** al lado de cada número, cuánto daría **si la falla estuviera
  presente**. Si se parecen, el control es ciego y se descarta. Mejor todavía: control sintético
  BIEN/MAL, como el de `gate_ensamble`.
- Todo barrido de rayos reporta **qué % impactó**: menos de ~40 % no es un resultado.

**GATE 4 — que el resultado tenga SENTIDO, no solo que cierre paso a paso.**
- `viga_voladizo.py --verificar --k-declarada` — todo parámetro heredado se **recalcula** contra
  su propia fórmula antes de usarlo. **Una fuerza sin su área es un número de otra pieza.**
- Modo propuesta: imprime la **familia** de soluciones (2 ecuaciones, 3 incógnitas → hay
  infinitas con la misma fuerza y la misma deformación) y marca la más baja.
- Antes de cerrar: comparar el tamaño de lo diseñado contra la magnitud de lo que hace. Un
  dispositivo que aprieta 6 N no puede pesar medio kilo — eso se ve sin calcular nada.

**Enforcement**: el hook `cad-guard.sh` solo RECUERDA los gates 1×/hora. El duro está en
`export_deliverables.py`: no entrega sin `proceso_declarado` **y sin ninguna fuerza en
`no_resuelto`**, sin `zona_confirmada`, sin `collision_check` con 0 puntos dentro **y
`contacto_ok`**, sin evidencia de `gate_ensamble` cuando el STEP trae ≥2 sólidos, y sin
un render posterior al STEP (override `--skip-gate` con `--reason`, deja huella).
Y con **`--final`** —la entrega que va a Fak, no una copia de trabajo— corre además el GATE E
sobre la carpeta destino: si sale rojo, los archivos quedan copiados pero **la entrega no se
certifica** (no se escribe la evidencia `delivery` y el script sale con código 1).

**Ese enforcement tuvo 3 agujeros, cerrados el 2026-08-24 por una auditoría independiente** (los
tres demostrados EN CORRIDA antes de arreglarlos; regresión `test_gates_entrega.py`). Cómo se
cerraron, y las dos hipótesis de umbral que se cayeron contra datos:
`reference/enforcement-como-se-cerro.md`.

**GATE 5 — TRAYECTORIA** (`gate_giro.py`, 24/08/2026). Todos los gates de arriba miran **una pose**. Un conjunto que gira no falla en la pose de carga: falla a 137 grados, con la máquina armada y el perfil comprado.

```
gate_giro.py --step conjunto.step --eje-punto 0,0,1050 --eje-dir 1,0,0 \
             --moviles 12,13,14,28 --paso 5 --luz-min 40 --workdir W --render
```

Gira los sólidos `--moviles` alrededor del eje y devuelve **la curva d(ángulo) entera**, no un número. Cuatro veredictos, y la distinción importó en la primera corrida real: **LIBRE** · **ROZA** · **CHOCA** · **ESTÁTICO** — la luz es chica pero **no cambia al girar**, así que el giro no es la causa y el que la juzga es `check_collision`. Sin esa cuarta clase el gate dio *0,00 mm en los 72 ángulos* sobre un concepto real: un control que devuelve lo mismo para toda la vuelta no está midiendo el giro. **La firma de un problema de trayectoria es una CAÍDA de la curva**, no un mínimo bajo.

Dos cosas que enseñó escribirlo: (a) sin decimar, una base de 620×480 con `lc=3` da millones de puntos y el barrido **no termina** — la celda de decimación es además **la resolución del resultado** y se informa; (b) el autotest nació fallado: su caso MAL también chocaba a 0°, así que un gate que mirara sólo la pose inicial lo habría cazado igual y el par no probaba nada. Ahora los dos postes están al mismo radio y ángulo, y el de BIEN corrido sobre el eje: **en la pose de carga los dos dan LIBRE** (106,3 y 70,0 mm) y sólo la vuelta entera los separa.

**GATE E — EL ENTREGABLE: que Fak pueda ENTENDERLO, no que esté documentado.**

```
gate_entregable.py --entrega <carpeta> --motor foto3d --render a.png b.png --workdir W
# o, en un solo paso, como parte de la entrega certificada:
export_deliverables.py --workdir W --pieces out/*.step --deliver <carpeta> \
                       --final --motor foto3d --render <carpeta>/render_*.png
```

De las tres entregas rechazadas, **dos no fallaron por el diseño: fallaron por cómo llegaron.**

- **G-E1 — formato.** Tienen que estar los tres: **PDF visual + STEP + simulación grabada**
  (mp4/gif de la secuencia: la pieza entra, se sujeta, se trabaja, sale). Un `.txt` o un
  `.html` pueden ir de anexo pero **no reemplazan al PDF**. Fak, textual: *"los txt son al
  pedo… lo único que debés hacer con los 3D es un PDF fácil de entender a prueba de boludos"*.
- **G-E2 — misma corrida.** Si el STEP se tocó después de armar el PDF, el PDF describe un
  modelo que ya no existe.
- **G-E3a — el motor de imagen se DECLARA** y tiene que ser uno de los aceptados de
  `procesoCanon.data.json`. **matplotlib está en los rechazados**: algoritmo del pintor, sin
  oclusión ni sombra, un caballete de tubos sale como una chapa. Fak miró 4 capturas y sacó 6
  preguntas; **5 de las 6 se contestaban con una imagen legible**. Con `--motor foto3d` el gate
  corre además el **autotest del propio motor** (una rampa pura no puede tener contorno, un
  escalón sí): que el motor ande se prueba, no se asume.
- **G-E3b — cuánto color tiene el render**, medido sobre los píxeles del objeto. **Se informa;
  no bloquea.** Un número bajo es una razón para mirar la imagen, no un veredicto.

El motor bueno vive ahora **acá**: `.claude/skills/cad-design/scripts/foto3d.py` (trazado de rayos ortográfico, oclusión
exacta, sombra proyectada, contorno por segunda derivada de la profundidad, maniquí a escala
para poner el operario en la escena, **fondo blanco** — Fak 02/09: *"necesito verlos bien los
modelos 3D, con fondo blanco"*). Nació suelto en la carpeta de trabajo del carro; vivir ahí
significaba que la tarea siguiente volvía a matplotlib, que es el fallo que existe para no
repetir.

> **Lo que los gates NO cubren, y hay que saberlo:** los siete nacieron cada uno DESPUÉS de que una persona encontrara el bug. Son tests de regresión: demuestran memoria, no capacidad de detección. Las dos clases que siguen abiertas: el **estado real del material** (el STEP es la pieza fría y desnuda; en uso tiene tela, adhesivo, calor y springback) y la **unicidad del posicionamiento** (nada verifica que haya UNA sola forma de montar el utillaje). Y falta lo que la auditoría del 24/08 dejó abierto para ensambles: **partes de catálogo con procedencia** (hoy GATE 1 exige que toda cota salga del CAD medido o de Fak — para un rodamiento comprado no hay fuente válida posible) y **cálculo del conjunto** (eje entre apoyos, vuelco, par en el volante): el único cálculo estructural del sistema es `viga_voladizo.py`, que sirve para láminas impresas en PLA.

## 1. Entorno — UN solo intérprete

Todo corre con **`C:\Dev\BarackMercosul\.venv-cad\Scripts\python.exe`** (Py3.12: gmsh 4.15 +
build123d + cadquery + trimesh + rtree + scipy + matplotlib, verificado 2026-07-23).

**`embreex` instalado el 2026-08-09 — los barridos de rayos van 133× más rápido.** trimesh lo
toma solo: `mesh.ray` pasa a ser `ray_pyembree.RayMeshIntersector`, no hay que cambiar código.
Medido sobre `virolador_v9` (51.020 tris, 40.000 rayos): **5,106 s → 0,038 s**, y los resultados
son **idénticos bit a bit** (36.530 impactos, desvío máximo 0,000e+00 mm) salvo en los rayos
**exactamente tangentes a la silueta**, donde "impacta o no" es ambiguo de por sí. Por eso una
rejilla de barrido **no debe arrancar en el borde del bbox**: hay que correrla hacia adentro
(`lo + paso·(i + 0,137)`), que además es la regla de no aliasear. Sin ese offset, python puro y
embree difieren en 460 de 40.000 rayos — todos sobre el borde exacto.
El venv **no tiene pip**: instalar con `uv pip install --python .venv-cad\Scripts\python.exe <pkg>`.

| Qué | Comando |
|---|---|
| Crear el venv (si no está) | `py -3.12 -m venv .venv-cad` + `pip install build123d cadquery trimesh rtree numpy scipy matplotlib gmsh embreex` |
| Correr un script | `PYTHONIOENCODING=utf-8 C:\Dev\BarackMercosul\.venv-cad\Scripts\python.exe <script> --help` |
| Autoverificar el entorno | `smoke_test.py --out <scratchpad>/cad-smoke` (8 checks, geometría sintética) |

Si un script se corre con el Python equivocado, `cadlib.envcheck` lo dice y sale con código 3.
(Fallback histórico: gmsh también corre en el Py3.14 del sistema, pero no hace falta.)

> Segunda opinión con `build123d-mcp` (instalado 29/08/2026, **apagado por defecto**, se levanta
> a demanda): `reference/build123d-mcp.md`.

## 2. Convención de workdir

Cada pieza/trabajo usa un workdir en el scratchpad con `manifest.json` (transforms con
procedencia, frames, evidencia de verificación, caches) + `in/` (STEPs cliente) + `out/`
(piezas producidas) + `renders/` + `cache/` (nubes .npy pesadas). Lo crea el primer CLI
con `--workdir`. Las transforms se leen con nombre (`--transform skeleton`) — si no existe,
el error lista las disponibles. Parámetros de modelado: variables nombradas en un
`params.json` del workdir (patrón `examples/posicionador/params_posicionador.json`), nunca
literales sueltos en el código.

## 3. Flujo punta a punta (CLIs de `scripts/`, todos con `--help`)

0. **Declarar el PROCESO** — mirar primero lo que mandó el que pide (video, plano, foto) y lo
   que Barack ya tiene hecho (`indice_dispositivos.py --buscar <mecanismo>`), y recién ahí
   `gate_proceso.py plantilla --tags <etiquetas> --out pliego.json` →
   `gate_proceso.py verificar pliego.json --workdir W --carpeta-pedido <carpeta del pedido>`.
   **Antes de esto no se abre un CAD.** Qué fuerzas actúan sobre la pieza en cada etapa y qué
   parte del dispositivo resuelve cada una.
0b. **Confirmar la ZONA** — `gate_zona.py inventario <cliente.stp> --workdir W --render`,
   mandarle `renders/gate0_mapa_<pieza>.png` a Fak, volver con `--confirmar <id>`. **Antes de
   esto no se mide nada.**
1. **Medir** — `analyze_step.py <file>` (sólidos, bbox, caras planas+normales, y las 3 sondas
   de topología del §3bis: `--zone` / `--neighbors` / `--offset`); `bbox_quick.py <files...>`.
2. **Entender el ensamble POR CÓDIGO** (no "ver": COMPUTAR): rol de cada sólido por bbox +
   relación de aspecto; quién toca/entra en quién con `contains_batched` + cKDTree; reportar
   en criollo + números ANTES de modelar. Si hay dudas → confirmar con Fak.
3. **Registrar** (alinear pieza↔fixture) — `register_icp.py --workdir W --source F.step
   --target P.step --name skeleton [--source-faces "BSpline surface,Torus"] [--seed x,y,z]`.
   ICP traslación-only trimmed; exit 1 si rms dudoso. Validar con features ÚNICOS (la caja
   lisa DESLIZA — es un assert del smoke test). Con nubes casi idénticas: `--trim 1.0`.
4. **Modelar** — build123d parametrico (variables derivadas de dimensiones clave, variantes
   por parámetro). Patrón gmsh OCC de referencia: `examples/posicionador/build_v2b.py`
   (construir en frame local → `occ.rotate` a global; **NUNCA `affineTransform`** con matriz
   casi-ortogonal → todo BSpline; tras cada boolean/fillet `synchronize()` + re-obtener el
   sólido, los tags renumeran). Frames: `cadlib.geom.orthonormal_frame`.
5. **Verificar** — `check_collision.py --workdir W --fixture out/p.step --substrate cliente.step
   [--substrate-keep 2] [--transform skeleton] [--zone X:455,505] --render` → evidencia en el
   manifest, exit 1 si choca, puntos rojos en el render. Planitud: `cadlib.geom.fit_plane`.
   Secciones: `render_sections.py --pieces a.step:gris b.step:rojo --axis X --stations ...`.
6. **Enderezar para imprimir** — `a_plano.py --normal=<nx,ny,nz> --out out_print pieza.step`
   lleva la pieza del frame del cliente al de impresión (apoyada en z=0, centrada en XY) y
   **aborta si cambia el volumen**. La normal sale de `geom.fit_plane` sobre la cara de apoyo,
   no se adivina. Sin esto el laminador recibe la pieza torcida y a metros del origen.
7. **Armar lo que Fak mira** — el PDF visual (imagen grande arriba, pocos renglones abajo, una
   idea por página), los renders con `foto3d.py` (**nunca matplotlib**, fondo blanco, con el
   operario a escala en la misma escena que el dispositivo cargado) y la **simulación grabada**
   de la secuencia del proceso.
8. **Entregar** — `export_deliverables.py --workdir W --pieces out_print/*.step --deliver <destino>
   [--glb] --final --motor foto3d --render <destino>/render_*.png` → exige evidencia (gates
   §0), exporta STL binario fino (curvatura 40) + GLB, copia, corre el GATE E sobre la carpeta
   destino y recién ahí registra la entrega. Sin `--final` queda registrada como entrega de
   TRABAJO y lo dice. Avisa si la pieza sale en coordenadas del cliente.
   Después: ABRIR los archivos y mirarlos (`git-deploy.md`, "Antes de decir listo").

## 3bis. Antes de mallar: LEER LA TOPOLOGÍA

**Presupuesto: si una consulta 3D va a tardar más de 2 minutos, está mal planteada.** Y el
primer resultado útil se le muestra a Fak apenas existe, no al final. Escalera de costo:

| Paso | Cómo (`analyze_step.py f.stp ...`) | Costo | Responde |
|---|---|---|---|
| buscar el feature | `--find [--only-free]` | instantáneo | DÓNDE está (sin saber tags) |
| buscar una ABERTURA | `find_openings.py f.stp` | instantáneo | ranuras/ventanas = lazos internos |
| acotar por ventana | `--zone X:a,b --zone Z:c,d` | instantáneo | qué hay en esta zona |
| vecinos (`getBoundary`) | `--neighbors t1,t2,...` | instantáneo | QUÉ es |
| muestreo paramétrico | `--offset t1,...` (la referencia se deduce) | segundos | CUÁNTO mide |
| mallar | los demás CLIs | minutos | último recurso, y solo la zona |

Todo junto: `--find --only-free --measure`. Motor en `cadlib.topo`; test: `topo_acceptance_test.py`.

- **Criterio duro: un feature SIN caras de flanco no tiene relieve.** Si las N caras del grupo
  comparten TODAS sus curvas con UNA sola vecina, es un contorno *imprentado* sobre la
  superficie: se ve en CATIA y en ningún visor de sólidos. Buscarlo a ojo en renders es tiempo
  tirado. Medirlo = offset contra el plano de esa vecina (0,000 mm ⇒ no hay cavidad).
- **Medir contra la cara equivocada da un número lindo y falso.** La referencia se deduce sola
  (la vecina que comparte más curvas); si se fuerza una que no está al lado, `measure_offset`
  ABORTA en vez de inventar. No forzarla sin correr `--neighbors` antes.
- **Las caras libres (sin sólido padre) se pierden con el default de gmsh**: `highestDimOnly=True`
  y el grabado directamente no existe (two_upholstered.stp: 2548 caras vs 2737). `cadlib.topo`
  carga con `False` y las marca `LIBRE`; el resto de los CLIs (mallado, colisión, render) NO las
  ve — por eso ningún render iba a mostrar el logo, por más triángulos que le pusiera.
  **Prenderlas sin saber qué son es igual de malo**: pueden ser el tapizado ya modelado. Antes de
  medir con `caras_libres=True`, correr `clasificar_caras_libres.py`.
- **`gmsh.model.removeEntities` NO recorta lo que se malla** (medido: caras 3→3, nodos 1344→1344).
  Para quedarse con parte del modelo: `occ.remove(..., recursive=True)` + `synchronize()` —
  es lo que hace `geom._load(keep=...)` (verificado end-to-end: 9405 → 356 pts).
- Ajuste de plano con nubes grandes: covarianza 3×3 (`geom.fit_plane`), **nunca**
  `np.linalg.svd(pts-ctr)` con `full_matrices=True` — con 490k puntos pide 1,75 TiB.

## 4. Verificar antes de cerrar — REGLA DURA

Render → MIRARLO → corregir, DESPUÉS de cada cambio (no post-export). Criterio CADGenBench
en orden: 1) validez (watertight/manifold), 2) forma, 3) interface/fit contra la pieza
destino, 4) topología (nº de agujeros/features). Más: reproducir cualquier choque que
reporte el cliente; tolerancias de impresión 0,3-0,5 mm/lado en vanos, panza ≥2 mm,
inserto heat-set + pin anti-giro.

## 5. Por qué cada gate dice lo que dice

Las **39 lecciones caras** —con su enforcement al lado— viven en `reference/lecciones-caras.md`.
Se leen **antes de modelar**, no después de que un gate dé rojo.

Las decisiones de **concepto** de un utillaje que aprieta (de dónde sale la elasticidad,
isostática, re-derivar en vez de parchear): `reference/utillajes-de-apriete.md`.

**LIMITE CONOCIDO de G-E2, encontrado el 04/09/2026 (anotado, NO parcheado).** El control
"PDF y STEP de la misma corrida" compara **mtime**, y `export_deliverables --final` copia las
piezas a la carpeta destino **justo antes** de correr el gate: la copia siempre queda mas
nueva que el PDF, asi que `--final` no puede cerrar en una sola corrida cuando el PDF no lo
copia el propio export. Sale ROJO por G-E2 con un PDF que describe exactamente ese solido.
Rodeo correcto (el orden real de trabajo, el PDF ultimo): `export_deliverables` sin `--final`
(copia las piezas y registra `delivery`) -> regenerar el PDF -> copiarlo a la entrega ->
`gate_entregable.py --entrega <carpeta>` (registra `entregable_ok`). Quedan las dos evidencias
que produce `--final` y el gate juzga exactamente la carpeta que se entrega.
El arreglo de fondo es el mismo aprendizaje del 24/08 sin aplicar aca: **comparar la FIRMA del
STEP** (`file_signature`, que `pdf_entrega` ya verifica en su control de misma corrida) en vez
del mtime de una copia. No se toco sobre la marcha: cambiar un gate para que pase la entrega
propia es justo lo que el gate existe para impedir, y merece su propio par BIEN/MAL.

Mejoras candidatas (cad-cae-copilot, argus-diff, etc.): ver `ROADMAP.md`. De esa lista,
`build123d-mcp` YA está instalado y verificado (`reference/build123d-mcp.md`); el resto sigue sin
instalar.
