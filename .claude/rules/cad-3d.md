---
paths:
  - ".venv-cad/**"
  - ".claude/skills/cad-design/**"
  - "**/*.step"
  - "**/*.stp"
  - "**/*.stl"
  - "**/*.glb"
  - "**/*.iges"
---

# Diseño 3D / CAD — 3 gates (regla corta; detalle y scripts: skill `cad-design`)

Causa raíz de mis fallos 3D: sustituir la fuente real por un proxy + entregar sin verificar. Los
gates NO son opcionales (el hook `cad-guard.sh` los recuerda 1×/h; el gate DURO es
`export_deliverables.py`, que no entrega sin evidencia de colisión + render en manifest.json):

**GATE 0 — DÓNDE (antes que cualquier otra cosa).** Un utillaje no se define por sus cotas sino por
la ZONA de la pieza sobre la que actúa. Antes de medir nada:

1. Renderizar el 3D del cliente y **marcar sobre esa imagen la zona que entendí**, con el nombre de
   la feature ("el borde del hueco X", no "las ranuras").
2. **Pasarle esa imagen a Fak y esperar que confirme.** Él responde marcando con círculos sobre el
   render — es el formato que usa y es inequívoco.
3. Recién con la zona confirmada se mide y se modela.

Sin este gate se puede pasar un día entero midiendo con precisión de centésimas **la feature
equivocada**, y ninguna verificación posterior lo detecta: todas miden contra la zona que elegí yo.
Pasó el 2026-08-06 (se tomaron las ranuras de los listones en vez del borde del hueco del cargador;
tres versiones tiradas).

**GATE 0.1 — QUÉ es esa zona (ejecutable, antes de mandar el render).** Confirmar el DÓNDE sobre una
imagen no distingue una abertura de un rebaje: el mismo día, **ya con la zona confirmada**, se midió
el contorno de un rebaje de 125×65 creyendo que era el hueco — el panel era macizo ahí. En un render
los dos se ven igual: la confirmación humana es autoridad sobre la UBICACIÓN, nunca sobre la
topología. El "qué" se computa:

```
.venv-cad\Scripts\python.exe .claude\skills\cad-design\scripts\gate_zona.py \
    inventario <cliente.stp> --workdir <W> --render
```

Lista TODAS las aberturas por área y clasifica cada una PASANTE / REBAJE / ESCALÓN por **paridad de
rayos** (rayos adentro del contorno contra un anillo afuera: si adentro hay los mismos impactos que
afuera, ahí hay material). **Agrupa por tamaño y marca las familias repetidas** — una feature que se
repite casi nunca es "la" feature, y ahora eso se cuenta en vez de recordarse. Deja
`renders/gate0_mapa_<pieza>.png` con cada abertura numerada: **ése es el render que se le manda a
Fak**. Nunca auto-aprueba: sale con código 2 mientras falte `--confirmar <id> --quien Fak
--evidencia "..."`. **Enforcement duro:** `export_deliverables.py` no entrega sin `zona_confirmada`
en el manifest.

Ojo con la normal: sin `--normal` la deduce y puede errarle — pasarle la medida de la cara
(`geom.fit_plane`). Con la normal equivocada un pasante se reporta como resalte (comprobado).

**Dos cosas más que NO se verifican a ojo**, mismo CLI:
- **Un vano que tiene que ser AIRE:** `gate_zona.py macizo --pieza P.step --caja x0,y0,z0,x1,y1,z1
  --esperado aire`. Un cuello macizo no tiene nodos de malla adentro, así que buscarlos ahí devuelve
  "libre" cuando la lengüeta está FUNDIDA a la placa — pasó, y en el render no se veía.
- **Toda transformación que se aplica "para que algo quede en X" termina comprobando que quedó en X:**
  `gate_zona.py pose --pieza out/p.step --esperar-luz -0.20 --tol 0.05`. Reporta la luz CON SIGNO y
  avisa cuando el valor sale espejado. Sin ese assert se encadenan errores de signo — van cuatro.

**GATE 1 — PRE-MODELADO:** (1) ensamble COMPLETO, no export parcial (si es parcial → STOP, pedir
assembly); (2) confirmar CUÁL pieza + computar el ROL de cada sólido por código, no adivinar; (3) **si
existe el STEP REAL, PROHIBIDO usar dibujo genérico** — buscar la feature real ANTES; (4) toda cota se
EXTRAE del STEP medido o es dato de Fak — CERO dimensiones inventadas (extiende `core-prohibiciones` #1);
(5) **escribir la SECUENCIA DE LA OPERACIÓN en una línea** (quién apoya qué sobre qué, si hay calor,
presión, cuánto tiempo) y que Fak la confirme. El mecanismo sale de la operación, no al revés;
(6) si el utillaje aprieta: **¿de dónde sale la elasticidad?** Si la pieza del cliente trae material
blando (vinilo/tela/espuma), el elástico ES ese material y el utillaje va RÍGIDO — un resorte impreso
solo se justifica para definir fuerza a través de un hueco desconocido (el resorte del virolador era
el 84 % de la pieza y sobraba entero; detalle: skill `cad-design` §6).

**GATE 2 — UN SOLO FRAME, derivado de la pieza.** El 2026-08-07 se entregó un ensamble con el
dispositivo fuera de la ranura. La causa no fueron tres errores: fue **uno**. Había tres marcos
dando vueltas (`hueco_one.json`, `ranura_one.json` con `ex`/`ey` invertidos, `OP_cara_two.json`) y
se copió un offset de un informe **sin re-medirlo en el marco propio**. Ese marco estaba 1,637°
girado, y de ahí salieron a la vez: 1,88 mm de derrame en un eje (54,43·sen 1,98°), 6,8 mm en el
otro, el largo del macho girado 90°, y un "escalonamiento de 2,5 mm entre las dos ranuras" que **no
existe** (89,79·sen 1,637° = 2,56).

```
.venv-cad\Scripts\python.exe .claude\skills\cad-design\scripts\gate_frame.py \
    --normal x,y,z --eje-global Y --alineados x1,y1,z1 x2,y2,z2 --salida <W>\frame.json
```
1. **Los ejes los define la PIEZA, no yo**: dirección global limpia + normal medida, triedro por
   productos vectoriales. UN `frame.json` y todo cuelga de ahí.
2. **Ninguna cota cruza de un informe a otro sin re-medirse en el frame de destino.** Un número que
   viene de otro marco es un número de otra pieza.
3. **El frame se verifica con un invariante que sabe fallar**: dos features que la pieza tiene
   alineados tienen que dar diferencia 0,000 (`--alineados`). Si dan 2,5, el frame está girado — no
   es ruido. El CLI sale con código 1 y además imprime el valor que daría con el frame torcido.

**GATE 3 — PRE-ENTREGA: verificar el ARTEFACTO, con controles que puedan dar ROJO.**

- **Se verifica el archivo que se entrega, no el diseño.** Los controles C1-C4 del virolador dieron
  todos verde midiendo el STEP del dispositivo en coordenadas locales — el ensamble exportado nunca
  se tocó. Es el patrón "medir la orden y no el resultado".
- **Test del valor gemelo (obligatorio):** al lado de cada número, escribir **cuánto daría ese mismo
  número si la falla estuviera presente**. Si el valor bueno y el gemelo se parecen, ese control es
  ciego y hay que cambiarlo. Ejemplos reales de controles ciegos que dieron verde sobre un ensamble
  roto: **bbox** (un dispositivo corrido sigue cayendo dentro del bbox de una pieza más grande),
  **volumen** (no cambia al trasladar: de eso se trata trasladar), y **rayos que no impactan nada**
  (dan exactamente 0 mm de interferencia y 100 % de paso libre).
- **Todo barrido de rayos reporta qué % impactó.** Menos de ~40 % = la medición no es válida, no es
  un resultado.
- **Gate ejecutable e independiente:** `gate_ensamble.py --step <ens.step> --pareja x,y,z --render <dir>`
  mide, sobre el plano de la abertura real, distancia entre centros / fracción del saliente dentro
  del contorno / ocupación / relación de tamaños (un macho que entra en un agujero es MÁS CHICO que
  el agujero), más interferencia clasificada por zona con booleano OCC. Trae control sintético
  BIEN/MAL, así que se sabe que no es un script que siempre falla.
- **Un caché sin la firma del archivo miente.** El gate juzgó un ensamble ya corregido con la malla
  vieja porque la clave del caché no incluía tamaño+mtime. Toda clave de caché lleva la firma.

**GATE 4 — el resultado tiene que tener SENTIDO, no solo cerrar paso a paso.** El 2026-08-07 un
utillaje salió de 36 mm de alto y 166 cm³ de PLA para una pieza que aprieta 6 N. Fak lo vio de un
vistazo: *"tiene demasiada base, muy alta, se ve obvio que se puede"*. Los siete controles daban
verde — porque todos verificaban el encastre, ninguno el tamaño. Tres fallas de método:

1. **Copié un parámetro sin verificarlo con su propia fórmula, y era el que gobernaba todo el
   tamaño.** El informe decía k = 7,5 N/mm con t=1,8 y L=26; la fórmula da 2,49 (los 7,5 son L=18).
   El número era inconsistente consigo mismo y nunca hice la cuenta.
2. **Dimensioné en cadena y nunca miré el total:** brazo 26 → alto 36 → "huella ≥ alto" → 110×100 →
   166 cm³. Ningún eslabón era absurdo por separado. Mismo patrón que el incidente de los 40
   agentes: *cap por fase ≠ cap total*.
3. **Traté una solución como LA solución.** Fuerza y deformación son 2 ecuaciones con 3 incógnitas
   (t, L, δ): hay una **familia** con la misma fuerza y la misma deformación. Recalculado da 22 mm y
   55 cm³ — **66 % menos de material, gratis**.

Y el mismo error otra vez, en la misma sesión: **heredé la fuerza objetivo (6,4 N) sin recalcular el
área contra MI geometría.** Esa fuerza correspondía a una banda de 45,6 mm²; la mía es de 22,8 →
2,28 N. El dedo quedó cargado **2,8×**, y con el ángulo vivo daba **SF a fatiga 0,30–0,48: se
partía**. Lo vio Fak mirando el render (*"los cuadraditos se ven frágiles"*), antes que ningún
cálculo mío.

```
viga_voladizo.py --verificar --t 1.8 --brazo 26 --precarga 0.85 --b 12 --k-declarada 7.5
viga_voladizo.py --fuerza 2.28 --b 12 --eps-max 0.0035      # la familia, y la más baja
```
`--k-declarada` compara el número heredado contra la fórmula y, si no cierra, **dice cuál sería el
brazo correcto**.

**Reglas cortas:**
- Todo parámetro heredado que se propague a la geometría global se **recalcula** antes de usarlo —
  incluida la carga: una fuerza sin su área es un número de otra pieza.
- **Y el que defino YO se MIDE sobre el artefacto, no se declara.** 2026-08-24, gancho de mochila:
  el agarre depende de `a/L` y yo puse L = distancia entre centros de las almohadillas (26 mm);
  la geometría daba **40,7**, porque al bascular el clip apoya en los BORDES, no en los centros.
  `a/L` real 1,40 contra 1,67 exigido: **la pieza no agarraba.** Los seis controles daban verde
  porque medían "muerde arriba / muerde abajo", que se cumple con cualquier L. **El control tiene
  que medir la MAGNITUD QUE GOBIERNA, no una consecuencia visible de ella** — si el valor gemelo
  no cambia cuando esa magnitud cambia, el control no la está mirando. Es el test del valor gemelo
  aplicado al parámetro, no al resultado.
  *Enforcement (patrón a replicar):* `examples/gancho_mochila/verificar_gancho.py` mide L sobre el
  STL exportado y falla si `a/L` cae por debajo de `1/(2·µ)`; el `params.json` guarda el valor
  declarado al lado, así el desacuerdo salta.
- **Y el que DEPENDE de otra cota se deriva, nunca se escribe como número.** Mismo día, misma
  pieza: Fak probó el gancho impreso y dijo que a la boca le sobraban 3-4 mm. Al bajarla de 31,30
  a 27,80, `y_raiz` (la raíz del brazo) siguió siendo el literal **23,65**, que era `boca/2 + e_ala`
  de la boca vieja: **el brazo quedó 1,75 mm separado del ala y la pieza salió en DOS sólidos
  sueltos.** Y de paso apareció que `a` estaba escrito 57 cuando la geometría daba **54** — 3 mm
  de margen que yo creía tener. Un `params.json` con cotas derivadas escritas a mano se
  desincroniza en el primer cambio y nada avisa.
  *Enforcement ya cargado en esta sesión:* `build_gancho.py::derivadas()` las calcula en cada
  corrida y las pisa, más un `raise SystemExit` que aborta si la pieza sale en más de un sólido.
  **Y las claves muertas se BORRAN del json, no alcanza con dejar de leerlas:** el auditor las
  encontró ahí el mismo día, con el valor viejo, tapadas por el spread — inofensivas sólo hasta
  que alguien lea `p["brazo"]["y_raiz"]` directo o cambie el orden del merge. Lo destapó el gate de ensamble de `export_deliverables.py`; el bbox y el volumen
  no lo habrían visto.
- **Y hay fallas que sólo aparecen MIRANDO el render, con la pieza en su lugar de uso.** Mismo día:
  la nariz del gancho subía 14 mm por encima del clip y habría chocado contra la tapa del
  escritorio — ninguna cuenta lo veía, porque ninguna sabía que el gancho va pegado a la tapa.
  *Enforcement:* lo que se aprende mirando vuelve como assert en el propio build —
  `build_gancho.py` aborta si `z_punta > h_clip`, no queda como recordatorio.
- **El criterio de un elástico impreso es la FATIGA, no la deformación.** ε ≤ 0,6 % equivale a 15 MPa
  nominales, que con Kt ya supera el límite de fatiga del PLA en Z (10–16 MPa). El criterio es
  σ·Kt ≤ límite de fatiga → **ε ≤ 0,35 %**.
- **Ninguna esquina interna viva donde haya flexión.** Kt 2,2 con arista viva contra 1,2 con
  R ≥ 0,5·t: 45 % menos de tensión, gratis. Y la boquilla FDM no puede hacer la esquina viva igual —
  deja ~0,2 mm de radio que no alcanza y no es repetible. Las ranuras se construyen con el fondo
  redondeado (caja + cilindro), no con `addBox` sola.
- Antes de cerrar, comparar el tamaño del utillaje contra la magnitud de lo que hace. Un dispositivo
  que aprieta 6 N no puede pesar medio kilo — eso se ve sin calcular nada, y hay que mirarlo.
- **Requisito que cambia → RE-DERIVAR el diseño, no parchear.** Si el requisito nuevo deja un
  subsistema sin función, el subsistema se VA, no se refuerza (el resorte del virolador acumuló tope +
  alma + brazo extra antes de que Fak lo llamara "un parche mal hecho"; skill `cad-design` §6).

**PRE-ENTREGA (lo demás):** render + MIRAR yo el resultado + interferencia contra el sustrato RÍGIDO
≈ 0 (no vs el tapizado blando) + CADGenBench (validez→forma→interface→topología) + adjuntar evidencia.
Nunca decir "listo" sin esto — "un cambio rápido sin verificar no es rápido, es un ida-y-vuelta más".
Ojo con el **encuadre del render**: si el cuadro se calcula sobre la unión de las capas, cuanto más
corrido está el dispositivo más grande da el cuadro y **menos se ve el error**. Encuadre anclado a la
zona y proporcional al objeto.

**Dos calidades de render, y no se confunden** (medido el 14/08/2026): leer mis propios renders era
el **59 % de todo lo que entraba al contexto** — `render_views()` escupía 5 archivos de 1540×990 por
cada mirada y yo los leía los 5. Ahora entrega por default **una sola hoja de contacto**
`<out>_TODAS.png` con todas las vistas en grilla: 557 KB → 81 KB, **7×**. Esa es la que miro yo, y
alcanza — lo que DECIDE si algo encaja o choca es el número de `gate_ensamble.py`, no la imagen.
`--alta` (o `alta=True`) es para **el render que mira Fak** (GATE 0, mapa de zona, antes/después):
resolución de entregable más cada vista en su archivo. **Para verificar, nunca leer las vistas sueltas.**

**Cuál cara es cuál se computa, no se elige.** Van dos veces de agarrar el lado equivocado (la cara
interior del sustrato; y la cara de los clips creyendo que era la vista). La cara vista es la LISA:
sondear las dos y quedarse con la de menor dispersión (0,70 mm contra 5,41 mm en el Upper Trim), con
un assert que corte si sale la otra.

Entorno: TODO corre con `.venv-cad\Scripts\python.exe` (Py3.12: gmsh + build123d + trimesh).
Tolerancias de impresión: 0,3-0,5 mm/lado en lo que entra en un vano, panza ≥2 mm, inserto heat-set +
pin anti-giro. Autoridad de identidad = master real, no proxy (unifica con
`feedback_identidad_codigo_pieza_autoridad_destino`).
