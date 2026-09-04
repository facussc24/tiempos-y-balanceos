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
las fuentes). La librería vive en `scripts/cadlib/` + CLIs genéricos con `--help`.

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

**Los 3 agujeros que tenía ese enforcement, cerrados el 2026-08-24** (auditoría independiente;
los tres se demostraron EN CORRIDA antes de arreglarlos — regresión: `test_gates_entrega.py`):

- **La evidencia se buscaba por NOMBRE de archivo.** Verificar la pieza, retocarla y entregarla
  daba **“ENTREGA OK” con 653 puntos DENTRO**, sin `--skip-gate` y sin huella. Ahora
  `check_collision` y `gate_ensamble` graban `file_signature()` (tamaño + sha1) del STEP y el
  export la compara contra el archivo que va a entregar. La regla ya estaba escrita para el
  caché de mallas (“un caché sin la firma del archivo miente”) y el almacén de evidencia —que es
  lo que decide la entrega— no la tenía.
- **El gate de ensamble se disparaba por el NOMBRE** (`"ENSAMBLE" in base.upper()`): un ensamble
  entregado como `conjunto.step` no lo disparaba. Ahora cuenta sólidos con OCC sin mallar
  (`_contar_solidos`). Es “el nombre no es el contenido” aplicada al gate que la violaba.
- **La confirmación de zona era autofirmable**: `--quien` venía con default `"Fak"` y
  `--evidencia` con default `""`. Ahora las dos son obligatorias y `--evidencia` tiene que
  apuntar a un **archivo que exista** (el render que Fak devolvió circulado, una foto, un mail);
  se copia a `renders/confirmacion_*` y se firma en el manifest. No es infalsificable: convierte
  una mentira cómoda (un flag) en una laboriosa, que es todo lo que un gate puede hacer acá.

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

> **DOS hipótesis mías que los datos refutaron el mismo día, para que nadie las reinvente.**
> 1. El primer G-E3b medía el **histograma de luminancia**: sin sombras la imagen colapsaría a
>    pocos tonos. Calibrado contra los renders reales **dio al revés** — el malo daba **70**
>    tonos para cubrir el 90 % de los píxeles y los buenos **26-28**, porque el malo eran líneas
>    finas con antialias y los buenos superficies grandes de color plano. Tirada.
> 2. Después la **saturación**, que con dos muestras malas (0,293 y 0,29) contra cuatro buenas
>    (0,42-0,76) parecía separar limpio, y salió **bloqueante** con umbral 0,35. Una auditoría
>    independiente la tumbó por los dos lados en el mismo día: la tercera muestra mala real
>    —`caballete_TODAS.png`, matplotlib, la misma masa ilegible— da **0,353 y pasaba por 0,003**;
>    y un render legítimo de foto3d de un dispositivo **de un solo material** (un caballete de
>    tubo pintado de un color, que es lo que Barack fabrica) da **0,000 y quedaba rechazado**.
>
> Dejaba pasar lo malo **y** frenaba lo bueno, que es la peor de las dos combinaciones: un control
> que molesta se termina desactivando entero. Quedó como medición informada. **Lo que aprendí de
> las dos: con n=2 en una clase no hay umbral, hay coincidencia** — y lo escribí como límite
> conocido en el canon *antes* de que el auditor lo probara, lo cual no me salvó de haberlo puesto
> a bloquear igual.

El motor bueno vive ahora **acá**: `scripts/foto3d.py` (trazado de rayos ortográfico, oclusión
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

## 1bis. Segunda opinión independiente — `build123d-mcp` (instalado 2026-08-29)

Servidor MCP configurado en `.mcp.json` (raíz del repo), versión **pineada 0.3.83**, con
`BUILD123D_IN_PROCESS=1` — **obligatorio en esta notebook**: el worker subprocess del server
se cuelga en Windows (medido: `import_cad_file` no responde ni con 300 s de budget; in-process
responde en 8 s). Sus tools aparecen como `mcp__build123d__*` en la sesión siguiente al enable.

**Rol: segunda opinión AL LADO de los gates, nunca reemplazo.** Mide con OCCT pero con una
implementación que no comparte una línea de código con `cadlib`. ICP (`register_icp.py`) y
colisión contra sustrato (`check_collision.py`) siguen siendo nuestros — el MCP no los hace.
Cuándo llamarlo: contra-verificar un volumen/bbox/solape que decide algo; `validate` antes de
entregar (watertight/manifold con diagnóstico: "4 open edges"); `compare kind='shape'` cuando
el cliente manda una revisión nueva de un STEP; `locate_gate_defects` cuando un export falla.

Tools reales de 0.3.83 (los nombres de la doc del branch main NO coinciden):
`import_cad_file(path, name)` · `measure(object_name)` · `validate(object_name)` ·
`compare(a, b, kind='shape'|'fit'|'align')` (fit = interferencia/clearance) ·
`cross_sections` · `locate_gate_defects` · `inspect_part` · `render_view` · `design_audit` ·
`execute` (código build123d con `show()`). El payload JSON viene anidado en
`structuredContent.result` como STRING.

**Evidencia de adopción** (test del propio criterio del ROADMAP, 2026-08-29):
`test_build123d_mcp.py` — volumen analítico 22.429,2037 mm³ exacto (desv 0,0000%), bbox exacto,
solape por construcción 4.500,0 mm³ exacto + status `interpenetrating`, par separado `apart` con
luz 10,0, `validate` ROJO sobre shell abierto y VERDE sobre sólido sano (los dos colores), y
agreement 0,000000% contra gmsh/OCC en un STEP real de 28 sólidos (34.186.208,822 mm³).
**Upgrade de versión = cambiar el pin y re-correr `test_build123d_mcp.py` (exit 0 = adoptar);
nunca subir el pin sin el test.**

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
   Después: ABRIR los archivos y mirarlos (verify-before-close).

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

## 5. Lecciones caras (el porqué de todo esto)

1. Confirmá CUÁL pieza ANTES de modelar (modifiqué la torre equivocada por adivinar).
2. Ensamble COMPLETO, no export parcial (sin él no se ven colisiones ni clips).
3. "Más presión" ≠ clavar la cara en la pared rígida: la ATRAVIESA. La presión sale del
   ángulo/cuña; interferencia solo contra compresión del material BLANDO (1-2 mm).
4. Luz de impresión: 0,3-0,5 mm/lado o el fixture impreso raspa/traba.
5. El ojo de Fak gana: "esto choca" = dato duro; reproducir y corregir, no defender el CAD.
6. **Una abertura NO se busca con `--find`** (2026-07-31, buscando ranuras): `--find` caza
   caras finas (grabados); con `--max-diag` grande escupe un cluster de 1465 caras que no dice
   nada. Las ranuras son **lazos internos** de la cara → `find_openings.py`. Y para ver cómo es
   una cara clase A: scatter de centroides de triángulos con normal +Z coloreados por Z — las
   aberturas aparecen como huecos, en segundos.
7. **El entregable impreso no va en coordenadas del cliente** (mismo día): entregué dos piezas en
   el frame del cliente, inclinadas y a metros del origen. Van apoyadas en z=0 y centradas →
   `a_plano.py` (paso 6 del flujo). El control de que no se tocó geometría es el **volumen idéntico**.
8. **Logo del Upper Trim (2026-07-31): 1 h 20 buscando un grabado a ojo en renders de 9 M de
   triángulos, y encima con el número MAL** — reporté −0,700 mm (el rebaje del pad) cuando la
   profundidad real es 0,000 mm: `removeEntities` no había recortado nada, así que "la cara con
   más nodos" era la clase A de alrededor y no el pad. Con las sondas del §3bis: 14 segundos y
   el dato correcto. Antes de mallar, leer la topología.

Las 9-17 salen del virolador del Upper Trim (08/2026, tres rondas: resorte → rígido → anillo):

9. **`addThruSections` con el default (spline) SE ABOMBA entre secciones.** Con secciones
   A, A, B la superficie infla entre las dos primeras: el macho midió 13,088 contra una ranura
   de 12,982 — 0,05 mm METIDO en la pared en vez de 0,09 de luz. `makeRuled=True` siempre que
   las secciones deban unirse recto. Se caza midiendo el sólido resultante, nunca asumiendo.
10. **Quitar un agujero puede SELLAR una cavidad interna.** El vaciado de la base era una
    cavidad que dos agujeros M5 ventilaban de casualidad; al sacar los M5 quedó aire encerrado:
    cuerpos de volumen NEGATIVO en el STL que el laminador tapa a ciegas. Gate en
    `export_deliverables.py`: `split()` → 1 cuerpo, 0 volúmenes negativos, o no entrega.
11. **Boolean con caras exactamente coincidentes deja la malla no-manifold** (watertight rojo
    sobre una pieza que antes cerraba). Solape de 0,05 mm en todo fuse de piezas apoyadas.
12. **El orden de construcción importa:** lo agregado ANTES de los cortes se lo comen los
    cortes (un alma quedó de 0,30 mm — menos de un cordón, no imprime). Los agregados que
    deben sobrevivir van DESPUÉS del `cut`, como fuse final. Y un fuse que debe dejar piezas
    SUELTAS (tope con luz) se verifica midiendo la luz en el resultado a varias alturas.
13. **Medir la luz de un anillo: el rayo desde el centro pega en la cara INTERNA.** Dio "luz
    2,550" sobre una pieza con luz 0,15 — y 2,550 = 0,15 + 2,40 (luz + espesor). **Un resultado
    que es la SUMA exacta de dos cotas conocidas es un error de cara, no un dato.**
14. **Un calibrador que se ajusta midiendo la pieza construida se CONTAMINA** si la pieza trae
    un agregado que su modelo no representa: el alma le subía k al flanco y el calibrador
    "corregía" hacia atrás (proponía volver a 157 kPa). Calibrar contra una referencia
    construida SIN el agregado, y guardar la calibración contaminada con nombre que lo diga.
15. **Dos controles que se contradicen no topean el diseño: lo dejan en el peor de los dos.**
    A7 exigía poder bajar a 70 kPa (estrategia vieja de 3 durezas) y A8 llegar a 200: ninguna
    pieza cumplía ambos y el optimizador entregaba EN SILENCIO la más blanda que pasaba A7 —
    59 kPa. Peor: una corrida había bajado la barra de 200 a 30 "para que cierre". Cuando el
    usuario cambia la ESTRATEGIA, buscar los controles que codificaban la vieja, no solo los
    parámetros. Bajar la barra hasta que el control pase no es calibrar.
16. **La banda de medición excluye el radio de entrada de la feature.** La boca redondeada de
    la ranura metía 17,03 mm en la estadística de una ranura de 12,95 y "midió" un abarrilado
    de 4,25 mm que no existe (el real, el desmoldeo, era 0,23). El dedo tampoco toca ahí.
17. **Nada de vida útil calculada en un entregable.** La fatiga sirve como criterio interno
    go/no-go; "dura X años" salido de una curva de bibliografía NO se afirma (Fak, 18/08:
    "dejá de decir pelotudeces como vida a fatiga"). Se entrega lo MEDIDO y el control físico
    (galga/calibre) para que el desgaste se detecte, no se prediga.
18. **El STEP del cliente es la pieza TERMINADA: el tapizado también cubre las caras de
    APOYO, no solo la feature que se trabaja.** (19-20/08, el "queda flotando".) Los apoyos
    de la v12 se midieron contra el sólido desnudo y sobre esas caras va una capa de 0,500
    (medida: 100 % de las zonas de apoyo, los dos steps) → pedestal 0,25-0,44 METIDO en el
    vinilo, panel flotando sobre material blando, anillo con ~0,75 de su banda de 1,2. UN
    error, los dos síntomas que reportó Fak. Tres reglas que deja: (a) toda superficie del
    utillaje que ENFRENTA al panel se cota contra la superficie real = sólido − capa —
    el mismo control A0b que ya existía para la ranura aplica a TODOS los contactos;
    (b) en un utillaje rígido **el tope de inserción ES el apoyo** (holgura chica 0,05
    para test e impresión, no 0,25 "para no marcar": eso deja la cadena de apoyo
    indefinida); (c) una capa a offset constante clasificada como "superficie de
    construcción" puede ser el MATERIAL real — la clasificación geométrica no le gana al
    síntoma físico, y la cara de apoyo puede además estar INCLINADA (0,78° acá): el tope
    plano se fija donde toca primero, medido por huella, no en la meseta de otro lado.

19. **El bounding box del CAD MIENTE sobre una pieza de NURBS recortadas — y mintió sobre la
    pieza de un proyecto real.** (2026-08-24, Insert SAB1740.) `gmsh.model.getBoundingBox` y
    `BRepBndLib` sin triangular acotan la superficie ENTERA sin recortar, no el trozo que
    existe: reportaban **625,11 × 86,32 × 289,96** para una pieza que mide **552,73 × 58,01 ×
    151,01** — el alto salía **1,9 veces** más grande. No es un redondeo: cambia el círculo de
    barrido, el balanceo y el tamaño del utillaje entero. El número inflado ya había viajado a
    un documento de ingeniería de la empresa y a una memoria mía.
    - **El síntoma que lo delata es gratis:** volumen y bbox tienen que ser compatibles. 219,30 cm³
      con pared media 2,27 mm son ~966 cm² de superficie media; la proyección de 625 × 290 sola
      ya da 1810 cm² — imposible. Con 553 × 151 (834 cm²) cierra. **Cuando el bbox y el volumen
      no se pueden dar la mano, el que miente es el bbox.**
    - Arreglado en `cadlib.geom.bbox_medido()` (muestrea las CURVAS de borde, que sí están
      recortadas exactas) + `aviso_bbox_inflado()`, y `analyze_step.py` ya reporta el medido y
      avisa. Concuerda con la triangulación fina (deflexión 0,1) en 0,02 mm sobre 552,73.
    - **Test del valor gemelo, y pasa:** sobre un STEP de cajas y cilindros primitivos el aviso
      da 0 y las cotas no cambian; sobre la pieza del cliente da 92 % y 99 %. Un control que
      avisara siempre no serviría.
    - Regla que deja: **toda cota que sale de un archivo de cliente se cruza contra una segunda
      magnitud** (volumen, área, masa) antes de usarla. Cuatro métodos coincidiendo (nodos de
      malla a dos lc distintos, triangulación OCC fina, muestreo de curvas) valen más que uno
      que "es el que siempre usamos".

20. **Un DISPOSITIVO no es una pieza impresa, y los gates de pieza le mienten.** (2026-08-24/25,
    dispositivo de adhesivado del Insert.) Cinco trampas, todas encontradas por control y
    ninguna a ojo:
    - **El gate de "1 solo cuerpo" es de pieza impresa.** En un ensamble las piezas van con luz
      a proposito, asi que el STL fusionado tiene tantos cuerpos como piezas y el gate lo
      rechaza. Lo que se valida es **cada pieza por separado** (1 cuerpo, cerrada, volumen
      positivo) y la envolvente solo sirve para interferencia.
      **IMPLEMENTADO el 2026-09-03, y CORREGIDO el mismo dia** — leer esto entero antes de
      tocar el techo de ese gate. Primero puse el techo en **`_contar_solidos(step)`**, y una
      auditoria independiente lo tumbo en corrida a las horas: **el techo y lo que se mide
      salian DEL MISMO ARCHIVO**. Un fuse que falla y deja 2 solidos da un STEP que declara 2
      y un STL con 2 cuerpos: coinciden SIEMPRE, el gate no dispara nunca, y encima imprimia
      *"es un ENSAMBLE, no una pieza partida"*. Para el bug que el control existe para cazar
      quedaba **tautologico** — y con el techo viejo (1 fijo) ese caso daba ROJO. Es la
      leccion 24 otra vez: subir el umbral hasta que el problema desaparece APAGA el control.
      Ademas cualquier resto de geometria de construccion olvidado en el STEP (un sliver
      disociado) subia el techo solo. **Como quedo: el techo es 1 salvo que una PERSONA
      declare `--ensamble NOMBRE:N`**, que se coteja contra los solidos del STEP y queda
      escrito en la evidencia `delivery` del manifest junto con los cuerpos medidos. Las
      cavidades selladas siguen siendo rojo SIEMPRE. Par BIEN/MAL: `test_gate_cuerpos.py`,
      **5 casos, 3 rojos**, y el 5o es el fuse roto que se colaba. **Lo que esto enseña de
      metodo: un techo que se lee del mismo archivo que se esta juzgando no es un techo.**
      Ojo: la envolvente concatenada
      puede salir con **normales invertidas aunque cada pieza este bien** — con el volumen
      negativo, `signed_distance` da vuelta adentro/afuera y la pieza entera aparece "metida"
      6 mm en el nido (medio espesor de placa). Chequear el signo del volumen en el export.
    - **Los tubos trazados de EJE a EJE se interpenetran media seccion.** Un travesano que
      llega al eje del larguero se mete 20 mm adentro: en el modelo es un cruce y en el taller
      es un corte que no existe. Van recortados a la CARA, y ese largo recortado es el que va a
      la lista de corte. Para distinguir un cruce real de una union en T: el cruce es cuando el
      acercamiento minimo cae en el **interior de los dos tramos**; si cae en la punta de uno,
      es una union a tope. Sin esa distincion el control marca las 17 uniones del marco como
      defectos.
    - **Las piezas compradas tienen altura de catalogo.** Una rueda giratoria O125 con placa
      mide ~160 mm: modelarla como un cilindro tangente al piso dejo todas las alturas
      ergonomicas verificadas 160 mm por debajo de la realidad. Y los nidos apoyados sobre la
      **linea de centro** de los travesanos quedaban embutidos 20 mm dentro del cano. Las dos
      cosas se ven lindas en el render y son falsas.
    - **Un bucle de correccion tiene que ACUMULAR.** El que ajustaba la altura de los apoyos
      guardaba el desvio pelado: el build lo aplicaba, el desvio pasaba a 0 y el build
      siguiente volvia a dejar el poste sin corregir. Oscilaba en vez de converger, y el
      sintoma es que "converge" en la segunda pasada pero no se queda. **Correr tres pasadas y
      exigir que la tercera no se mueva.**
    - **Los travesanos van donde APOYA la pieza, no repartidos parejo.** Con `linspace` caian
      en 0/195,7/391,3/587 y los nidos ocupaban 0-169/209-378/418-587: los bordes quedaban en
      el aire. Centrando cada travesano en la luz entre nidos, un mismo tubo toma el borde de
      arriba de uno y el de abajo del siguiente.

21. **Antes de dimensionar un apoyo blando, hace falta la cuenta de la fuerza.** Puse 8 pads
    de gomaespuma O18 bajo una pieza de 250 g: 2036 mm2. Para que esa espuma se comprima el
    25 % nominal hacen falta ~6 N y la pieza apoya con 1,73 N a 45 grados — o sea que la
    espuma la **empujaba hacia afuera** del nido en vez de sostenerla. El area sale de
    `area = F_normal / CFD25` (2,5-4,5 kPa en PU celda abierta 25-35 kg/m3): dio 578 mm2, o
    sea **3 pads de O15,7**. Y de paso 3 es lo unico que define un plano sin hiperestatismo;
    los tres se eligen de modo que la proyeccion del centro de masa caiga DENTRO del triangulo
    (margen medido: 35,5 mm). Corolario del mismo error: un **tope** que no carga lleva la
    espuma SIN comprimir, asi que se cota con el espesor entero mas su luz — cotizarlo con el
    espesor comprimido dejaba el disco metido 1 mm en la pieza.

22. **La pieza de la mano contraria se verifica, no se supone.** El Insert tiene mano izquierda
    y derecha y sus dos barrenos de localizacion estaban casi simetricos (44,4 y 36,0 mm de
    cada punta): la duda de si la mano equivocada podia calzar era legitima. Se espeja el STL
    real y se prueban **las dos formas** en que un operario puede presentarla (vuelta sobre el
    eje largo y vuelta de punta a punta). Dio que los pines erran los barrenos por 8 a 76 mm y
    que traba a 10-20 mm de altura contra la correcta que no toca: **el nido ya rechaza la
    mano contraria** y no hace falta bloque anti-error. Sin la medicion habria agregado un
    poste que no servia para nada.

23. **La cobertura de un rociado es una pregunta de acceso y se puede simular.** Antes de
    aceptar que un dispositivo tiene que girar, medir cuanto agrega girar: rayos desde un cono
    de posiciones de pistola, con umbral de incidencia y linea de vista contra la pieza Y el
    utillaje. En el Insert dio **+0,2 puntos porcentuales**, o sea que el giro no se paga. El
    resultado solo vale si aguanta la sensibilidad: se repitio con umbrales de incidencia
    30/45/60 grados y conos de +/-45 a +/-100, y con la cara A mirando abajo la cobertura se
    derrumba de 98,9 % a 0,0 % (el control puede dar rojo). **Ojo con la resolucion:** con el
    rayo saliendo 0,4 mm de una grilla de 3 mm quedaban 69 celdas "inalcanzables" que
    desaparecen al salir 3 mm — eran la grilla, no una sombra. Eso se demuestra con un barrido
    del offset, no se afirma.

24. **Subir la tolerancia de un control hasta que el problema desaparezca no lo corrige: APAGA
    el control.** (2026-08-25, revision independiente del dispositivo de adhesivado. Es la
    leccion mas cara de esta serie porque el numero apagado ya estaba entregado.)
    - El caso: la simulacion de rociado sobre una grilla de 3 mm daba 69 celdas
      "inalcanzables". Subi la salida del rayo de 0,4 a 3 mm, las celdas desaparecieron, y
      publique **100 % de cobertura**. Con el offset honesto la misma posicion daba 98,93 %.
    - **El sintoma que lo delata es de logica pura y no cuesta nada mirarlo:** agregar
      obstaculos no puede MEJORAR una cobertura. El caballete con 12 piezas y un marco de
      acero daba 100,0 % y la pieza sola al aire 99,1 %. Cuando un resultado mejora al
      agregarle estorbos, el control esta roto, no la geometria.
    - **La causa raiz era el modelo, no el parametro.** Un campo de alturas `ymax(x,z)` pone
      el punto en el centro de la celda, que NO esta sobre la superficie: el rayo sale
      rozando la celda vecina. La correccion no es un offset mas grande sino trabajar sobre
      los **triangulos de la malla**, cada uno con su normal y su area, y sacar el rayo **por
      su propia normal** (0,2 mm alcanzan: por construccion no puede re-entrar). De paso se
      arregla solo el sesgo que tenia: el gradiente perdia 230 celdas y el 100 % de ellas
      estaba a menos de 20 mm del borde, o sea que el porcentaje se calculaba sin la franja
      que mas importa.
    - **A un modelo hay que exigirle que RESPONDA antes de creerle una diferencia chica.** El
      viejo daba el mismo 99,1 % con un cono de pistola de +/-30 que con uno de +/-100: no
      estaba midiendo accesibilidad, y sin embargo la decision de sacarle el giro al
      dispositivo se apoyaba en el. El nuevo da 96,4 / 97,5 / 98,0 / 99,8 / 100 % para
      +/-20, +/-30, +/-45, +/-60 y +/-100. **Barrer el parametro que DEBERIA mover el
      resultado es el control del control.**
    - **Y buscar el argumento que no dependa del simulador.** El motivo real por el que ese
      dispositivo no necesita girar es que el **95,8 % del area de la cara A tiene su normal
      a menos de 30 grados de la direccion de rociado y la mas inclinada llega a 88,2**: no
      hay una sola zona que mire para atras. Eso es geometria de la pieza, se calcula en
      segundos, y convierte a la simulacion en confirmacion en vez de en argumento.

25. **Un control que aprende a NO marcar los falsos positivos suele quedarse ciego para el
    verdadero.** (misma revision.) El detector de tubos cruzados marcaba las 17 uniones en T
    del marco, asi que le puse "solo cuenta si el acercamiento cae en el interior de los dos
    tramos". Con eso dejo de marcar las uniones sanas — y tambien las uniones en T **metidas
    20 mm adentro del larguero**, que es exactamente la falla que se queria cazar (dan
    tc = 0,000). Se le escapaban 4 de 5 casos inyectados.
    - La salida no es aflojar el filtro sino **separar las dos preguntas**: (A) cruce = el
      acercamiento minimo cae en el interior de los dos, y (B) penetracion = la PUNTA de uno
      cae adentro del volumen del otro. Son fallas distintas y se buscan distinto.
    - Sacar tambien los factores de correccion inventados: el limite era (a1+a2)/2 * 0,72 y
      dejaba **12,2 mm de solape ciego** entre dos tubos de 40. Con (a1+a2)/2 pelado, un tubo
      tangente queda justo en el limite y uno que se pisa cae por debajo.
    - **El autotest de un caso no vale.** El que tenia probaba "un tubo que cruza por el
      medio", el unico que el control si detectaba. Ahora inyecta cinco fallas distintas
      (cruce al medio, cruce cerca de la punta, colineal solapado, union en T penetrada, ejes
      a 30 mm) y tiene que cazar las cinco.

26. **Tres cosas de armado que no se ven en el render y las encuentra el control:**
    (a) **el recorte a tope NO es lado/2** salvo que los tubos se encuentren a 90 grados: en
    angulo es (lado/2)/sen(theta), y con el recorte fijo las patas y los travesanos del
    vertice quedaban 5,9 mm metidos adentro del larguero;
    (b) **todo tramo tiene que TOCAR algo** — las manijas quedaron 20 mm afuera del larguero,
    flotando, y ningun control lo miraba porque todos buscaban solapes, no huerfanos;
    (c) **los travesanos van donde apoya la pieza**, no repartidos parejo con `linspace`.
    (d) **un tubo que llega en angulo no se ACORTA: se corta con un PLANO.** Acortar el eje
    deja las esquinas de la seccion metidas adentro del otro — 14,14 mm en un empalme a 45
    grados. En el taller eso es un inglete;
    (e) **el largo de la lista de corte se mide entre PLANOS DE CORTE, no entre nodos.** El
    X-brace del piso figuraba 1606,9 y el real era 1548,0, con 11 de 33 tramos mal. Con ese
    numero el herrero corta de mas y la pieza no entra;
    (f) **la orientacion de la seccion se fija a proposito.** Si la elige una convencion del
    codigo aparecen cortes compuestos que nadie puede ejecutar, y una diagonal se come 8 mm
    de un travesano. Y en una **esquina** donde las dos puntas coinciden no se corta ninguna
    de las dos, o el rincon queda hueco.

## 6. Utillajes de apriete — las decisiones de CONCEPTO (antes de la primera línea)

Todas del virolador del Upper Trim (08/2026). Son las que cambian el diseño de raíz; las
trampas de código de arriba no salvan un concepto equivocado.

- **La pregunta CERO: ¿de dónde sale la elasticidad?** Si la pieza del cliente ya trae un
  material blando (vinilo, tela, espuma), **el elástico ES ese material** y el utillaje va
  RÍGIDO — solo tiene que estar bien medido. Un resorte impreso solo se justifica cuando hay
  que definir una fuerza a través de un hueco desconocido. El resorte del virolador era el
  84 % de la pieza (48,4 mm, 40 g) y sobraba entero: la rígida hace lo mismo con 19,4 mm y
  19 g, sin fatiga, sin tope, sin calibración.
- **Requisito que cambia → RE-DERIVAR el diseño, no parchear.** "El dedo toca la pared" dejó
  al resorte sin función; en vez de sacarlo se le colgó un tope anti-rotura, un alma de unión
  y 1 mm más de brazo. Cada parche tenía una razón local válida; Fak vio el conjunto de un
  vistazo: *"no parece un diseño profesional, parece un parche mal hecho"*. **Test: si el
  requisito nuevo deja un subsistema sin función, el subsistema se VA — no se refuerza.**
- **El postizo se dimensiona contra el CONTORNO MEDIDO completo de la feature, no contra
  "ancho × largo".** La ranura medía 53,67 y el macho recto cubría 40: 6,5 mm sin apretar en
  cada punta, y Fak preguntó "¿ahí cómo planeás que se virole si no hay nada?". Además el eje
  NO era recto (se corre 3 mm a lo largo por los 25,6° de la cara). CLI: `medir_contorno.py`
  (contorno + normales); el postizo se construye retirado una LUZ CONSTANTE perpendicular a
  la pared — así el apriete sale parejo (84 % en todos lados contra 80-90 % del ancho fijo).
- **Un anillo cerrado pide margen de impresión más generoso que nervios sueltos:** si sale
  grande no entra por NINGÚN lado, y lijar un anillo es mucho peor que lijar dos nervios.
  (Se fue de luz 0,09 a 0,15 por esto.)
- **Features que YO agrego sin pedido se declaran o no van.** El grabado de identificación y
  los 2 agujeros M5 de amarre los agregué por iniciativa; Fak los circuló en el 3D preguntando
  "¿para qué son?" — dos veces en el mismo proyecto. Si una feature no la pidió y la considero
  necesaria: la listo con su porqué y "sacala si no la querés". La pieza más simple es la que
  no hay que explicar.
- **Verificar la CONCLUSIÓN de Fak aparte de su mecanismo.** "Los dedos más anchos harían más
  presión" era físicamente falso (presión = fuerza/área), pero la conclusión "esto es PLA, se
  va a partir" era CIERTA: ningún control miraba el maltrato, solo la carga de trabajo.
  Refutar el mecanismo no cierra el reclamo — la conclusión se verifica por separado.
- **ISOSTÁTICA: el panel/pieza lo ubica UN solo elemento (el más preciso); todo lo demás
  captura con holgura que NUNCA mande.** (19/08, y la pregunta la hizo Fak: "fijate si esto
  no está hiperestático".) El anillo del virolador ya restringía x, y y rotación con luz
  0,15; los 2 pasadores agregados con holgura 0,34 se la peleaban: el stack de tolerancias
  anillo↔pasador a 45 mm (impresión 0,16 + warp FDM 0,1 % + molde 0,075) da 0,28 en el peor
  caso > 0,19 de margen → el panel quedaba forzado o sin asentar. Se resolvió afinando el
  pasador (holgura 0,45: umbral 0,30 > 0,28). **La cuenta se hace SIEMPRE que haya más de un
  elemento ubicando el mismo grado de libertad**: umbral = holgura_secundario − luz_primario,
  contra el stack de tolerancias a la distancia que los separa.
- **Una corrección nueva se aplica a la CLASE, no al caso que la generó.** (19/08, causa
  raíz encontrada a pedido de Fak: "demostraste que no te estás automejorando".) El 18/08
  se redondearon los pedestales porque marcaban la pieza, y EN LA MISMA ITERACIÓN las
  orejas nuevas de los localizadores nacieron con canto vivo. Al corregir "los pedestales
  marcan" la regla real era "todo tope que enfrenta al panel va redondeado" — y una feature
  agregada en esa misma pasada es el primer lugar donde la regla se olvida. Enforcement:
  el redondeo es PROPIEDAD del constructor (`caja_tope_redondeado()` en el build), no un
  retoque por pieza; toda caja nueva orientada al panel pasa por ahí.
- **Lo que enseñó la PRIMERA PIEZA IMPRESA** (18/08, el dato que ningún cálculo reemplaza):
  (a) todo borde que TOCA la pieza del cliente va redondeado — no solo donde hay flexión: los
  pedestales de apoyo con canto vivo MARCAN la cara vista; (b) un encastre manual necesita
  FEEDBACK — entrada suave y el apriete concentrado al final, que se sienta el "asentó"; si
  hay que hacer fuerza sin sentir que trabó, el operador no confía; (c) un dispositivo donde
  se apoya una pieza necesita AUTO-UBICACIÓN — si el operador tiene que buscar el punto a
  tientas, la pieza se cae: guiado que la lleve solo (pilotos, rampas, topes); (d) las
  observaciones de la primera impresión se registran EL MISMO DÍA y generan la iteración
  siguiente — para eso se diseña fácil de medir y corregir.

27. **La POBLACION sobre la que medis decide el resultado mas que el metodo.** (Dispositivo
    de adhesivado, 08/2026 — el error mas caro de ese trabajo, y lo encontro una revision
    independiente, no yo.) Defini "la cara a rociar" como *lo que se ve primero mirando
    desde arriba* y ademas forcé las normales hacia el frente. Con esa definicion la pared
    del borde —que solo se ve en angulo— **no podia entrar**, y ninguna normal podia pasar
    de 90°. El 99 % de cobertura que reporte, y la conclusion "girar no aporta", eran
    **techos del modelo**, no propiedades de la pieza.
    - Rehecha por PROCESO (se engoma lo que toca el recubrimiento, medido contra el otro
      solido del STEP) la misma pieza dio 82,8 % sin girar. Tres tolerancias distintas, mismo
      resultado. **Una conclusion que cambia 16 puntos al cambiar la definicion de la
      poblacion no era una conclusion: era la definicion.**
    - Y despues hubo que partirla otra vez: 90 de esos 451 cm² miran para atras y **ningun
      utillaje los alcanza con la pieza apoyada** (atras es siempre el nido). Sobre lo que si
      se puede resolver, girar aporta +0,4. **Antes de comparar dos disenos, separar lo que
      el diseno puede cambiar de lo que no.**
    - Regla: la poblacion se define por el PROCESO (que se moja, que se pega, que se mide),
      nunca por lo que es comodo de calcular. Y se declara arriba del resultado, siempre.

28. **Cuatro veces seguidas escribi un control que no podia dar rojo.** Y las cuatro el
    autotest "generico" pasaba igual. El patron:
    - `gate_giro`: 0,00 mm en los 72 angulos — la luz no dependia del giro.
    - chequeo de marco: dos guardias (`comparten punta`, `entre 2 % y 98 %`) que tapaban
      justo las penetraciones reales. Una revision le inyecto 5 casos nuevos: **cazo 1**.
    - autotest de basculacion: bajaba el eje, cuando lo que topeaba era AXIAL.
    - cobertura: el autotest daba la pieza vuelta, que el modelo ya no podia representar.
    Es la misma familia que las lecciones 24 y 25, vista cuatro veces seguidas en un
    solo trabajo.
    **El valor gemelo tiene que ser la falla REAL de ESA geometria, no una perturbacion
    cualquiera.** Se elige preguntando "¿que tendria que estar mal para que esto fallara en
    planta?" y se inyecta ESO. Si el control sigue verde con la falla puesta, el control se
    tira, no se ajusta el umbral.

29. **Un bucle de autocorreccion que PISA en vez de acumular oscila, no converge.** El ajuste
    de altura de los apoyos guardaba el desvio pelado; el build lo aplicaba, el desvio pasaba
    a 0, y el build siguiente volvia a dejar el poste sin corregir. Se veia "0,00" mirando una
    sola pasada. **Se prueba corriendo TRES pasadas y exigiendo que la tercera no se mueva.**

30. **Abrir el archivo correcto no es usarlo.** (2026-08-28, dispositivo de adhesivado del
    Insert. Lo vio Fak de un vistazo: *"ojo que no estabas usando los 3D reales del insert"*.)
    El STEP del cliente estaba ahi, con el md5 del servidor. Pero TODA la geometria del nido
    salia de una cadena de proxys: malla `lc=3` -> grilla de 3 mm por **binning de vertices**
    -> contorno por marching squares -> **media movil de 5 puntos**. Sobre esa sombra pixelada
    se cortaba la placa CNC, se elegia la altura de los apoyos, se detectaban las torretas y
    se juzgaba la luz de los pines.
    - Lo que costo, medido: el contorno se desviaba hasta **5,01 mm** del real (mediana 1,71),
      con bbox 555,00 x 153,00 sobre una pieza de **552,71 x 151,00** y perimetro 1326,4 contra
      **1296,7**; la silueta figuraba 718,2 cm2 y son **695,3**. La orla de **6,00 mm** con la
      que se diseño la placa era en realidad de **1,70 a 6,92** (mediana 3,78). El area de
      torretas venia inflada **61 %** (4266 -> 2649 mm2). Las alturas de cara B usadas para los
      postes erraban hasta **8,97 mm** sobre un pad de espuma de 12.
    - **El control lo confesaba y nadie lo leyo.** El docstring de `verificar_nido` decia que
      con `lc=3` un O3,50 queda en 3 facetas con 0,51 mm de flecha, *17 veces* la luz de 0,05
      que ese mismo control decia verificar. Un control que explica por que no puede medir lo
      que mide **no es un control**: o se arregla la entrada o se saca.
    - **La resolucion de cada paso intermedio se declara AL LADO del numero, y se compara
      contra la tolerancia del entregable.** 3 mm de celda para cotar una placa de CNC y 0,05
      de luz de pin no conviven.
    - Como se arregla cada eslabon: silueta **exacta** (union de los triangulos proyectados)
      en vez de marching squares; muestreo por **AREA** en vez de binning de vertices; ventana
      de filtro en **milimetros** (45), no en celdas; y **Douglas-Peucker con tolerancia
      declarada** en vez de media movil — suavizar no tiene tolerancia, simplificar si.

31. **Tres formas de que una eleccion de diseño no sea una eleccion** (mismo trabajo, las tres
    aparecieron el mismo dia):
    - **Un INDICE no es un criterio.** El trio de apoyos vivia en `params` como
      `apoyos_trio: [5,6,8]`. Al re-medir la pieza la lista de candidatos cambio de largo y de
      orden, y esos tres numeros pasaron a apuntar a otros puntos **sin que nada fallara**. Lo
      que se guarda es el criterio; los indices los deriva un script.
    - **Un muestreo sin semilla vuelve el entregable irreproducible.** `sample_surface` usa el
      RNG global: tres corridas del mismo script sobre el mismo STEP dieron triangulos de apoyo
      de **144,3 / 159,9 / 190,5 cm2**. Un auditor que reproduce y no da lo mismo tiene razon.
    - **Y la semilla sola no alcanza si la eleccion la decide un desempate.** Tomar "los 8
      maximos de la transformada de distancia" con `argsort` deja la decision en manos del
      orden de empate. La salida no es estabilizar el desempate: es **enumerar todo el conjunto
      factible** (grilla de 10 mm sobre la superficie donde el pad entra entero, 155 posiciones)
      y **optimizar** sobre el — 120.284 trios validos, optimo 205,5 cm2 y 48,2 mm de margen,
      contra 11,0 cm2 y 0,0 mm del peor valido. Ahi el valor gemelo sale gratis y separa solo.

32. **Medir contra los VERTICES lo que se aparta de los SEGMENTOS rechaza lo que esta bien.**
    El control de la simplificacion del contorno reportaba **59,88 mm** de desvio sobre una
    poligonal que respetaba 0,1: con tramos de ~28 mm, el punto del medio esta a 14 mm del
    vertice mas cercano y a 0,02 de la recta. Es la leccion 13 (el rayo que pega en la cara
    interna) con otra ropa: **antes de creerle un numero grande a un control, mirar contra QUE
    lo esta midiendo.** Y el gemelo de ese control no es mover un vertice —si el movimiento cae
    a lo largo del borde no cambia nada—: es correr la MISMA simplificacion con la tolerancia
    20 veces mas floja y exigir que la mida.

33. **Antes de agregarle un MECANISMO a un dispositivo, barre los parametros ESTATICOS que
    hacen lo mismo.** (2026-08-28, caballete de adhesivado.) El basculante compraba +4,6
    puntos de cobertura en el frente y +14,2 en el borde, y con eso la discusion era "¿vale
    un eje con rodamientos?". La pregunta estaba mal planteada.
    - **Lo que la desbloqueo fue separar dos causas que el porcentaje mezcla:** de lo que
      faltaba, ¿cuanto es *nadie puede llegar ahi* y cuanto es *algo se interpone*? Se mide
      tirando los rayos contra cada cuerpo por separado en vez de contra la escena
      concatenada. Dio **16,71 de 16,75 cm2 del primer tipo**: el marco, las piezas vecinas
      y los nidos vecinos juntos tapaban 0,04. **Cuando lo que falta no lo tapa nadie, la
      respuesta no es sacar un obstaculo: es cambiar como esta PRESENTADA la pieza.**
    - La inclinacion de las caras era 45 grados **por decision, no por calculo**, y cambiarla
      no cuesta nada: es como se sueldan los largueros. Barrida de 15 a 75 grados, a 30 el
      caballete FIJO da 98,7 % de frente y 99,5 % de borde — lo mismo que el basculante — y
      el mecanismo pasa a valer **+0,2**.
    - **Y el escalon se corre con el parametro que uno asumio.** Repetido con conos de
      pistola de +/-70, 85, 100 y 120 grados, el angulo al que aparece el salto se mueve:
      con +/-85 hay que bajar a 20 grados, y con +/-70 no llega ninguno. O sea que la
      conclusion honesta no es "30 grados" sino **"inclinacion y alcance del operario se
      compensan"**, con la tabla al lado. Lo que si vale bajo las cuatro hipotesis, y por eso
      se puede afirmar: **45 era peor que mas plano en todas.**
    - Regla: cuando un mecanismo se justifica por una diferencia de porcentaje, listar
      primero los parametros que ya existen y no cuestan nada, y barrerlos. Un grado de
      soldadura es mas barato que un rodamiento.

34. **Un control tambien puede dar ROJO por su propia resolucion, y eso NO se arregla
    subiendo el umbral.** (Misma noche.) El detector de "tramos sueltos" reportaba 1,5 a
    1,7 mm en una junta que apoya **cara contra cara**, con luz cero: sembraba solo las
    cuatro caras LATERALES del tubo y no la cara de la punta, asi que el punto mas cercano al
    corte quedaba a medio paso de muestreo (2 mm) del plano de contacto. **Estaba midiendo su
    propio paso.**
    - La tentacion es subir `LUZ_CONTACTO` de 1 a 3 mm y seguir. Eso apaga el control (§24).
      Lo que corresponde es **sembrar la superficie completa**: la cara de la punta es
      superficie del tubo como cualquier otra.
    - Es el hermano de §28 y hay que buscarlo igual: **antes de creerle un numero CHICO a una
      medicion muestreada, comprobar que el muestreo cubre la feature que se esta midiendo.**
      Un contacto tangente se mide en la tangencia; si ahi no hay puntos, se mide el paso.

35. **Un arriostramiento que se toca A SI MISMO no esta arriostrando nada.** La cruz del piso
    del caballete tenia las dos puntas retiradas 150 mm en X **y** en Y para que no cayeran en
    la esquina: con eso quedaron flotando en el medio del hueco de la base, sin tocar ningun
    tubo. **El control de "tramos sueltos" no lo veia porque los tres tramos de la cruz se
    tocaban ENTRE SI**, y para el control eso ya es "toca a otro". Aparecio recien al cambiar
    la inclinacion, cuando dejaron de tocarse — o sea por casualidad.
    Regla: **un elemento que existe para unir A con B se verifica contra A y contra B, no
    contra "¿toca algo?"**. Y el retiro para no caer en un nudo se hace sobre UNA coordenada:
    retirar sobre las dos saca la punta de la pieza que tenia que tocar.

36. **LA ZONA QUE UN CONTROL EXCLUYE A PROPOSITO QUEDA SIN CONTROL.** (2026-09-03, carro
    giratorio de adhesivado del Insert. Es la leccion mas cara de esta tanda porque la
    exclusion estaba declarada, comentada Y contada, y aun asi tapo una interferencia dura
    durante dias.)
    - El caso: `verificar_giro_carro.py` excluye del barrido todo lo que esta a menos de
      32 mm del eje, con el motivo escrito (*"el nido va CALZADO en su eje: sus munones y el
      eje se tocan a proposito"*) y con el conteo de puntos excluidos impreso en cada
      corrida. Nadie miro **adentro**. Ahi el nido tenia un munon macizo O16 que quedaba
      ENTERO dentro del eje O20 del carro, y el eje ademas atravesaba una oreja de 90x90x10
      **sin agujero**. Ni el render ni el barrido de giro podian verlo: los dos miran los
      nidos contra el marco, y esto pasaba en la junta.
    - **Toda zona que un control saca de su universo necesita SU PROPIO control**, o la
      exclusion es una alfombra. El que se escribio (`verificar_calce_eje.py`) mide las dos
      cosas que hacen falta y que son distintas: **que no se pisen** y **que SI se toquen**
      — "0 puntos dentro" lo cumple igual un utillaje flotando (la leccion del 2026-08-07,
      otra vez). Su gemelo levanta el nido 5 mm: ahi deja de tocar y el control lo dice.
    - **Un muestreo no le gana a un booleano.** El "¿pasa el eje?" no se resolvio con rayos
      ni con nubes: se corta el cilindro del eje real contra el solido del nido y se mide el
      volumen de la interseccion. Da **0,000 cm³**, y el gemelo (el mismo eje 25 mm fuera de
      centro) **6,1 cm³**. Donde haya un booleano exacto disponible, el muestreo sobra.
    - **Partir el modelo en "lo que se mueve" y "lo que no" es en si mismo un control.** Al
      exportar el carro en tres grupos (`fijo` / `rot` / `traba`) para poder animarlo, la
      separacion por componente conexa destapo **dos defectos mas** que ningun gate miraba,
      porque pasaban entre piezas del carro y no entre el carro y los nidos: la manivela
      estaba a **15 mm** de la punta de su eje (flotando: no movia nada) y su mango se metia
      **12 mm** dentro del disco indexador de la fila de arriba, con lo que las dos piezas
      salian FUSIONADAS en el STL. El control quedo escrito en el build: *tantos cuerpos
      rotantes como ejes, y cada cuerpo toca UN solo eje*. Un cuerpo de mas = algo suelto;
      un cuerpo que toca dos ejes = dos piezas que se pisan.
    - Corolario de diseño, no de codigo: **si el eje ideal no entra, la posicion del eje se
      DERIVA del hueco que hay, y el precio se calcula y se declara.** El eje "por el CG"
      era imposible (el CG cae 2,9 mm sobre la cara de la placa). Se centro en el hueco
      medido entre la placa y el punto mas bajo de la pieza (21,69 mm), quedo 7,97 mm sobre
      el CG, y eso cuesta 0,0986 Nm por nido = 3,7 N en la manivela. Un numero chico que se
      publica vale mas que un "pasa por el CG" que no es cierto.

37. **Un gemelo que CONVERGE al caso bueno no es un gemelo.** (mismo dia.) El de la
    simulacion de encastre multiplicaba x1,6 el desvio lateral **derivado del chaflan**, y
    ese desvio ya vale 0 en los ultimos cuadros: justo donde la pieza llega a la altura del
    piloto, el "gemelo" estaba perfectamente centrado y daba **0 puntos de choque, igual que
    el diseño**. Con el desvio CLAVADO en 1,6 veces la captura garantizada: 10. Es la
    familia de la leccion 28 con otra ropa — el gemelo se elige preguntando *que tendria que
    estar mal para que esto fallara en planta*, no perturbando el parametro que uno tiene a
    mano.

38. **EL AGUJERO DONDE APOYAS LA RETENCION PUEDE SER CIEGO — y la zona que un control
    excluye se repite hasta que se le pone SU control.** (2026-09-04, carro de adhesivado
    del Insert. Fak miro el render y dijo *"veo que como que atraviesa la pieza"*; tenia
    razon, y cuatro gates verdes no lo veian.)
    - Los "barrenos O5,6" eran **torretas de tornillo CIEGAS**: tubo O7,9/O5,3 abierto
      hacia la cara B y cerrado por 2,6 mm de pared del lado vista. El clip con cabeza
      asomando sobre la cara A atravesaba esa pared. Nadie habia tirado UN rayo por el
      eje del agujero: se llamaba "barreno", se diseño como pasante. **Pasante se mide
      (dos rayos por el eje, uno de cada lado, y el perfil de radios a lo alto); una
      pieza con `huecos: 0` en la silueta no tiene NINGUN agujero pasante**, y con eso
      la retencion positiva es imposible: queda FRICCION. Primera solucion: horquilla
      de POM abrazando la torreta por FUERA. **La revision independiente del mismo dia la
      cambio por un PIN CON O-RING que entra por DENTRO del agujero ciego** (leccion 39):
      la pared interior del agujero es superficie moldeada contra nucleo y varia menos
      que el diametro exterior, que es la cara donde pega el rechupe. En los dos casos la
      fuerza se estima con mu DECLARADO y se MIDE con dinamometro.
    - Por que no lo vio el control: A excluia todo lo que estaba a 8 mm del eje de un
      pin o clip ("dentro de un barreno es artefacto"). Es la leccion 36 por tercera vez
      en dos dias (munon en el eje, clip en la torreta, y despues el pin en la bajada).
      **Una exclusion no se declara por RADIO: se declara por CRITERIO** — en la zona del
      pin es artefacto solo lo que esta DENTRO del radio del barreno; en la de la
      horquilla, solo hasta el apriete de diseño; y el maximo de cada zona se reporta.
    - **Y la zona se mueve con la pieza.** Con las zonas fijas en la posicion nominal, un
      pin metido en la pared de la torreta (pieza corrida 1,5 mm) quedaba a r<1,8 del
      eje NOMINAL y contaba como "boca". Corriendo las zonas junto con la pieza: 6
      choques donde antes daba 0. Eso destapo que **la cadena de entrada no cerraba**:
      luz del piloto 1,5 contra ventana del cono del pin 0,55, y el piloto centraba
      2 mm ANTES del asiento cuando el pin tocaba la torreta 8 mm antes. La cadena que
      cierra: luz del guia <= ventana del pin, y la cara vertical del guia sube hasta
      canto + engrane + margen (medido que la pieza no se ensancha ahi). El gemelo que
      vale es la falla real —el guia con mas luz de la que el pin captura— no un desvio
      cualquiera: 0 choques el diseño, 25 el gemelo.
    - Lo que dejo de metodo: (a) **antes de disenar sobre una feature de la pieza, medir
      lo que la feature ES** (pasante/ciego, radio exterior, donde empiezan los nervios);
      (b) **un ensamble se entrega con 1 cuerpo por pieza soldada/atornillada**: el nido
      tenia 5 cuerpos (2 orejas y 3 pilotos SUELTOS) y el gate lo dejo pasar como
      "ensamble de 5" — Fak lo vio como "cosas flotando"; (c) **una feature que no
      actua nunca se saca**: los topes con 4 mm de luz no podian actuar porque el pin ya
      topeaba a los 2; (d) **la pose de trabajo se mide con la pistola donde el operario
      la tiene**, no con un cono desde cualquier lado — acostada, el frente recibia el
      chorro a <45 en el 40 %; de frente a 75, en el 94 %.

39. **UN DISENO NUEVO NO REEMPLAZA AL VIEJO HASTA QUE SUS DOCUMENTOS TAMBIEN CAMBIAN
    — y el numero que un documento tiene TIPEADO no se entera de nada.** (2026-09-04,
    misma tarde. Fak pidio una revision independiente del encastre: *"quiero quedarme
    tranquilo de que va a encastrar facil"*. Salio bien — dos revisores sin contexto
    coincidieron solos y la retencion mejoro — y despues aparecio el costo.)
    - Cambiada la retencion (horquilla por fuera -> pin con o-ring por dentro) y los
      apoyos (espuma -> POM rigido), el SOLIDO quedo bien y los cuatro controles verdes.
      **Seis documentos siguieron describiendo el diseno anterior**: la lista de
      materiales (pin "O3,40 engrane 8" TIPEADO cuando el solido ya era O3,30 engrane 9
      — y esa lista es la que va al TORNERO), el plano del carro (mu 0,30 de la horquilla
      al lado de su propio detalle que dice 0,60, y un pie que decia *"abrazar la torreta
      por fuera es lo unico que la geometria deja"*), el plano del nido ("gomaespuma
      comprimida al X %" con espuma_util = 0), el pliego, un render de demo, y **la
      imagen del GATE 0 — la que se le manda a Fak para que confirme la zona, o sea que
      le preguntaba por un diseno que ya no existia**.
    - Ninguno fallo: todos corrieron en verde. Un texto no tiene control de coherencia,
      y un numero tipeado tampoco: **si el dato existe en el JSON, el documento lo LEE**
      (`nd["localizadores"]["d_barreno"] - luz_pin`, `NV["parametros"]["clip_mu"]`); si
      hay que escribirlo a mano, es que falta publicarlo.
    - Metodo, barato: despues de cambiar un concepto, **grep del nombre viejo por toda la
      carpeta** (`horquilla|abraza|gomaespuma|espuma`) y mirar CADA hit. El orden importa:
      primero lo que sale de la casa (la imagen que va a Fak, el plano del tornero),
      despues lo interno. Y el numero que aparece en dos lugares del MISMO documento y no
      coincide es la firma barata de esto — se busca a proposito.

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
`build123d-mcp` YA está instalado y verificado (§1bis); el resto sigue sin instalar.
