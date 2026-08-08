# Lecciones Aprendidas — Barack Mercosul APQP (destilado vivo)

Archivo mantenido por Claude Code. Se lee COMPLETO al inicio de cada sesion, por eso
contiene SOLO lo accionable que NO esta ya codificado como regla o gate ejecutable.

- **Historico completo** (2026-03-30 a 2026-07-02): `docs/_archive/LECCIONES_APRENDIDAS_2026H1_completo.md`
- **Snapshot pre-poda 2026-07-23** (detalle integro de las secciones condensadas abajo):
  `docs/_archive/LECCIONES_APRENDIDAS_snapshot_2026-07-23.md`
- **Tabla incidente → regla**: `docs/_archive/INCIDENTES_REGLAS_AMFE.md`
- Los incidentes pre-junio ya codificados NO se repiten aca: todo consolidado en
  `.claude/rules/amfe.md` + gates de `amfeValidator.mjs`. Double-serialization JSONB y
  tabla AP oficial: `database.md`. Dumps stale: `verify-supabase-live.md`. PFD/HO: `no-pfd-no-ho.md`.

## Lecciones operativas vigentes

### 2026-08-07 — Dos limitaciones que yo mismo habia escrito, y ninguna existia
Automatizando la carga en el ERP me frene dos veces contra "esto no se puede", y las dos veces
el que lo destrabo fue Fak con una frase.

- **"Hay que scrollear y eso no esta resuelto".** El cargador abortaba cuando la linea caia
  debajo de las filas visibles de la grilla. Fak: *"llegas a la ultima linea de la sexta y le
  das TAB: automaticamente baja a la numero 7"*. La grilla scrollea sola. **Por esa limitacion
  inventada quedaron 13 lineas sin cargar** — y peor, se la conte como si el trabajo estuviera
  terminado. **Una limitacion escrita por mi mismo hace tres dias no es un hecho verificado: es
  una hipotesis vieja con cara de dato.**
- **"Dar de alta lineas esta fuera de alcance".** Me dicto la secuencia en dos renglones y
  entraron 27 de 27. Lo unico no obvio: al completar el renglon el programa abre OTRO vacio,
  asi que un solo TAB no llega al boton de aceptar.
- **El corolario que mas me va a servir:** cuando el que usa la herramienta todos los dias esta
  del otro lado del chat, preguntarle no es interrumpir — es el camino corto. Tantear contra una
  interfaz de 25 anios es lo caro.

### 2026-08-07 — Estuve una hora persiguiendo un sintoma que habia dejado yo
Una escritura fallida (mande el numero con coma y el campo esperaba punto) dejo el valor podrido
en la celda. Ese valor **sobrevive a volver a entrar el producto**, y el chequeo de pantalla no
lo cazaba porque **compara codigos, no valores**. Las tres corridas siguientes fallaron por la
basura de la primera, con mensajes que apuntaban a otro lado ("la ventana perdio el frente").

- **Despues de una corrida fallida, el estado no vuelve solo: hay que resetearlo antes de
  reintentar.** Si no, se depura el sintoma equivocado.
- **Un chequeo que compara identidad pero no contenido deja pasar exactamente el dano que se
  quiere evitar.** Ahora se comparan tambien los valores.
- Y la de fondo: **estaba operando a ciegas**. Se puede capturar la ventana y mirarla. Cuando
  saque la primera foto, el boton que buscaba estaba a la vista y la solapa que creia cerrada ya
  estaba abierta. Ver primero, actuar despues.

### 2026-08-07 — "Foreground" no es "foco", y por eso se perdian las teclas
Poner la ventana adelante devolvia exito, y las teclas no llegaban. Medido: `hwndFocus` era
`None` aun con la ventana al frente. **Un click real del mouse es lo unico que da foco de
teclado.** Fak lo intuyo antes que yo: *"no tenias el foco en el programa, por eso no
funcionaban las teclas"*. Cuando algo "no responde" y la explicacion tecnica no cierra, medir el
estado real (¿quien tiene el foco?) en vez de acumular hipotesis.

### 2026-08-07 — El export se comia a si mismo y no avisaba
El listado del ERP abre el archivo en Excel, y Excel **se lo queda**. El export siguiente falla
en silencio: mismo tamanio, mismo mtime, ningun cartel. Lo cazo Fak: *"es como que sale un error
de que tenes otro Excel abierto con el mismo nombre"*. Encima Excel ofrecia "quitar ceros
iniciales", que sobre un consumo lo destruye. **Todo proceso que escribe un archivo compartido
necesita un gate previo de "¿alguien lo tiene tomado?" — y verificar el mtime despues, porque el
exito silencioso es indistinguible del fracaso silencioso.**

### 2026-08-07 — El entregable va donde se usa, no donde a mi me queda ordenado
Fak pidio 4 archivos de corte para mandar al plotter. Los deje prolijos en una subcarpeta
nueva, con una version de respaldo partida en dos, una imagen de control y un informe de
verificacion largo. Respuesta: *"no entiendo, me los pones en el escritorio en una copia,
no voy a leer todo eso... dejalos en el escritorio y listo, no me la compliques"*.

- **El pedido incluye el DONDE, aunque no lo diga.** Si el archivo es para usarlo ya, va
  suelto y a mano — el Escritorio. Una carpeta mia con estructura propia es trabajo que le
  traslado a el: ahora tiene que navegar, elegir entre dos versiones y entender mi criterio.
- **La verificacion la hago yo, no se la leo.** Los 9 decimales, las invariantes y la imagen
  son para que yo pueda AFIRMAR que esta bien; en la respuesta va la afirmacion y las dos
  cosas que el necesita saber para decidir. El resto es ruido.
- Cerrar la tarea es parte de la tarea: sacar la carpeta del Escritorio con
  `node scripts/_escritorio.mjs --archivar`, sin que me lo pida.

### 2026-08-07 — Dos limitaciones que yo mismo habia escrito, y ninguna existia
Automatizando una carga repetitiva, dos cosas quedaron trabadas y las dos las destrabo el que
usa la herramienta todos los dias, no yo.

- **La primera la habia escrito yo en el codigo:** "hay que scrollear y eso no esta resuelto",
  y por esa linea 13 registros quedaron sin cargar. La realidad era que al tabular sobre el
  ultimo elemento visible **la lista baja sola**. **Un `raise` con un mensaje derrotista se
  convierte en la verdad del sistema**: nadie lo vuelve a cuestionar, y menos yo, que lo escribi.
  Cuando encuentre uno propio, tratarlo como hipotesis vieja y volver a probar.
- **La segunda fallaba EN SILENCIO.** Una exportacion abria el archivo en Excel, y Excel se
  quedaba con el archivo tomado; la exportacion siguiente no hacia nada — sin cartel, sin error,
  el archivo con la misma fecha. Media hora mirando un boton creyendo que estaba roto. Lo cazo
  Fak de una: *"es como que sale un error de que tenes otro Excel abierto con el mismo nombre"*.
  **Cuando una accion "no hace nada", la hipotesis numero uno es que el recurso esta tomado por
  otro proceso** — se chequea abriendo el archivo en modo append antes de culpar a la interfaz.
- **Y un dato que casi arruina el dato:** ese Excel ofrecia "quitar ceros iniciales". Sobre un
  valor como `0,00107250` eso lo destruye. Aceptar un dialogo sin leerlo es una forma de
  corromper datos que no deja rastro.

Balance del dia: **36 de 36 modificaciones cargadas y verificadas**, diff de la base entera en
0 altas, 0 bajas y ningun cambio fuera de lo pedido. Pero de las ~4 horas, la parte que produjo
valor fue chica; el resto fue perseguir sintomas de errores mios anteriores.

### 2026-08-07 — Estuve una hora peleando una interfaz a ciegas, pudiendo mirarla
Automatizando una carga en el ERP fallé cuatro corridas seguidas. Cada explicación que dí era
plausible y ninguna era la causa. Al final entré por donde tenía que haber entrado al minuto uno:
**capturar la ventana con `PrintWindow` y mirarla.** En la primera foto estaba todo — el botón que
buscaba, la solapa que yo creía cerrada ya abierta, y un combo vacío que explicaba por qué el
botón "no hacía nada".

- **Si la herramienta tiene interfaz, mirarla es el primer paso, no el último.** Adivinar
  coordenadas y deducir estado a partir de mensajes de error es más lento y da conclusiones falsas.
- **Foreground no es foco, y esa distinción me costó la mañana.** `SetForegroundWindow` devolvía
  éxito y `GetForegroundWindow()` confirmaba la ventana, pero `GetGUIThreadInfo().hwndFocus` daba
  `None`. Las teclas se perdían y yo concluí "las teclas sintéticas no sirven con este programa".
  Sí sirven: **un click real del mouse es lo único que da foco de teclado**. Fak lo dijo antes que
  yo — *"no tenías el foco en el programa, por eso no funcionaban las teclas"*.
- **Mi primer error envenenó todos los diagnósticos siguientes.** Escribí un número con el
  separador equivocado; quedó basura en la celda, esa basura **sobrevivió a reabrir el registro**,
  y las tres corridas siguientes fallaron por ella con mensajes que apuntaban a otro lado. **Tras
  una falla, resetear el estado antes de reintentar** — si no, se depura sobre ruido propio.
- **Me di por vencido dos veces y las dos veces había camino.** Dije "esto necesita una persona" y
  no lo necesitaba. Fak: *"no puede ser que te rindas"*. El patrón a vigilar: cuando escribo "esto
  es un límite del programa", casi siempre es un límite de lo que probé.
- **Y un gate que salió de un susto:** antes de apretar un botón que dispara algo, sacar la foto y
  leer el estado. En un combo que se resetea solo, la secuencia "de memoria" caía en *Impresora* —
  aceptar ahí mandaba un listado completo a la impresora de la oficina.

Cierre: 23 de 23 líneas cargadas, verificadas contra el export, y el diff completo de la base dio
0 altas, 0 bajas y ningún cambio fuera de lo pedido.

### 2026-08-07 — Armé un plan de 3 hallazgos y 2 se cayeron al verificarlos
Fak pidió detectar qué bloqueos duros faltaban. Presenté tres. Al empezar a implementarlos:

- **"`npx vitest run` no corre nada y sale exit 0"** → no se reproduce. De a un archivo pasa
  con cualquiera de los dos pools (14/14, exit 0). Lo que **sí** pasa es que la suite COMPLETA
  con `forks` da 3 archivos y 9 tests en rojo **espurios** por contención (`environment` acumuló
  1707 s). El hallazgo era real pero el mecanismo que yo describía, no.
- **"14 migraciones se marcan aplicadas aunque el CREATE falle"** → **inofensivo**.
  `utils/database.ts:1843` hace **no-op de TODO el DDL** por diseño: el esquema de Supabase se
  gestiona por Dashboard/CLI. Ni el `CREATE` ni el `INSERT INTO schema_version` se ejecutan
  nunca contra Postgres. `schema_version` vacía es lo esperado, no un bug. Arreglar el patrón
  no habría creado ninguna tabla.

- **Lo peor: ese segundo dato ya estaba en mi memoria desde el 30/07** (`supabase_adapter_sin_tests`
  lo decía con file:line). No abrí el archivo porque **el gancho del índice no lo mencionaba** —
  decía "cero tests; lectura fallida = []". El índice existe para decidir qué abrir: si el gancho
  no nombra el dato, la memoria no existe en la práctica. Ya lo corregí.
- **Y por ese diagnóstico equivocado le di a Fak una causa raíz falsa del bug del 8D** (dije que
  fallaba por `datetime('now')`). El fix real es crear la tabla en Supabase, no tocar el código.
- **Regla:** antes de escribir el plan, releer las memorias del área tocada — no sólo los ganchos.
  Y al escribir un gancho, que nombre **el dato que haría cambiar una decisión**, no el título del
  archivo. Verificar antes de implementar funcionó: los dos falsos positivos murieron sin costo.

### 2026-08-07 — Escribí un script que borraba, sin dry-run, y movió 942 archivos en vez de 17
Quería rescatar ~17 archivos CAD de la carpeta `REVISAR` (986 archivos, 1,76 GB). Escribí un `.ps1`
nuevo que copiaba, verificaba tamaño y después borraba el original. **Movió los 942**, a un árbol de
carpetas que ni siquiera era el correcto. Dos bugs de PowerShell, los dos **silenciosos**:

- **`.ps1` en UTF-8 sin BOM + `powershell -File`**: PowerShell 5.1 lo lee como ANSI. `Ingeniería` se
  convirtió en `IngenierÃ­a` y **creó un árbol paralelo completo** al lado del real, adentro de una
  carpeta sincronizada de SharePoint. Fix: BOM UTF-8, o `pwsh`, o cero caracteres no-ASCII en
  literales de ruta.
- **`Get-ChildItem -LiteralPath <dir> -Recurse -Include *.step`**: `-Include` se **ignora** salvo que
  el Path termine en `\*`. Devuelve todos los archivos. Fix: `-Filter`, `-Path "$dir\*"`, o
  `Where-Object { $_.Extension -in @(...) }`.

- **La causa de fondo no es PowerShell: es que reimplementé una operación peligrosa que ya estaba
  resuelta.** `scripts/_escritorio.mjs` tiene `--dry-run`, verificación de bytes y cero llamadas de
  borrado, justamente por esto. Escribí uno nuevo desde cero sin ninguna de esas protecciones.
- **Regla:** todo script que borre o mueva en lote va primero en dry-run imprimiendo el plan
  completo, y **hay que mirar el conteo**: si esperaba 17 y dice 942, ahí se termina. Verificar que
  el destino resuelto existe y es el que creía (no dejar que se cree solo). Y mandar a **Papelera**,
  nunca `Remove-Item -Force`.
- **Lo que no vuelve solo:** no se perdió un byte, pero los archivos quedaron **aplanados** — se
  perdió qué archivo vivía en qué subcarpeta (los PPAP estaban por número de parte). La jerarquía es
  dato, y un `Join-Path $dest $_.Name` la destruye aunque copie todo perfecto.

### 2026-08-06 — Mi número tenía ±1,5 mm y yo lo usaba para discutir 1,2 mm
Reconstruí un pin del dispositivo TRA/IZQ desde 9 fotos con calibre. Puse el agujero a **12,2 mm**
desde la punta, medido por fotogrametría. Fak miró el render: *"el círculo está centrado? me dio la
impresión en la imagen que no... creo que en el mío estaba centrado"*. El centro geométrico era
13,385 → discutíamos **1,2 mm**.

- Antes de defender mi valor lo audité: según cómo segmentara el tornillo en la foto, el centro me
  daba **10,6 o 11,8 mm**. **±1,5 mm de incertidumbre, más grande que la diferencia en juego.** Mi
  medición no tenía resolución para contradecirlo. Fue centrado.
- **Un número con dos decimales parece un dato aunque su barra de error se coma la conclusión.** El
  error no es equivocarse: es presentar como medición algo cuya incertidumbre es mayor que el efecto
  que pretende demostrar. Misma familia que la zona equivocada de acá abajo: precisión aparente
  tapando incertidumbre real.
- **Regla:** antes de sostener un valor derivado (fotogrametría, píxeles, escalado, regla de tres),
  calcular su incertidumbre y compararla con la diferencia en discusión. Si es del mismo orden o
  mayor, el valor **no decide** y gana el que tiene la pieza en la mano. Y decirlo explícito ("mi
  medición no alcanzaba para distinguir"), no ceder en silencio: Fak tiene que saber cuál de los dos
  números era el débil.
- Lo que **sí** funcionó y conviene repetir: validar que **las 7 lecturas del calibre entraran cada
  una en una cota, sin sobrar ninguna**. Con 7 de 7 ocupadas, acertar por casualidad es despreciable.
  Método completo en la memoria `reconstruir-pieza-de-fotos-con-calibre`.

### 2026-08-06 — Diseñé tres veces un utillaje para la zona equivocada de la pieza
Me pidieron un dispositivo para asegurar el tapizado en una zona donde al operario le cuesta llegar.
Medí todo con precisión de centésimas, verifiqué siete cosas, entregué tres versiones — **y había
agarrado la feature equivocada del 3D**. Tomé las ranuras donde entran los listones del cliente
cuando la zona era el borde del hueco del cargador, que está en otra parte de la pieza. Fak lo cerró
en un segundo: circuló la zona sobre un render y me lo mandó.

- **Ninguna de mis verificaciones podía detectarlo, y ese es el punto.** Todas medían contra la
  región que había elegido yo. Un número perfecto sobre la zona equivocada es peor que no medir,
  porque da confianza. **Verificar mucho no compensa no haber confirmado el "dónde".**
- **Gate 0, nuevo y bloqueante** (ya está en `.claude/rules/cad-3d.md`): antes de medir nada,
  renderizar el 3D del cliente, **marcar sobre esa imagen la zona que entendí** nombrando la feature,
  y que Fak la confirme. Él contesta marcando círculos sobre el render — lo pidió explícitamente:
  *"la próxima pedime unas fotos como las que te adjunté para entender exactamente dónde"*.
- **Si al buscar "la" feature aparecen dos o tres candidatas parecidas, eso no es un problema de
  filtrado: es la señal de que hay que preguntar.** Yo encontré dos líneas de ranuras y elegí la que
  encajaba con lo que ya me había imaginado.
- **El mecanismo sale de la secuencia de la operación, no al revés.** La operación real era
  *dispositivo en la mesa → pistola de calor → apoyar la pieza con algo de presión → esperar →
  retirar*. Yo había diseñado un clip a presión en frío. Escribir esa secuencia en una línea y
  confirmarla cuesta un minuto y define todo el concepto.
- **No lanzar agentes ni maquinaria pesada sobre un requerimiento sin confirmar:** multiplica el
  error en vez de encontrarlo. Primero se confirma el "dónde", después se despliega.

### 2026-08-06 — Diagnostiqué "el servidor está caído" cuando el bug era mi propio escape de comillas
Di por caído el disco de red durante toda una conversación. `net use` devolvía *"No se encuentra el
nombre de red especificado"* y lo leí como que el host no existía. El error real era otro: **estaba
invocando `powershell -Command "…\\\\host\\share…"` desde bash con comillas DOBLES, y bash se comía
las barras invertidas**, así que a PowerShell le llegaba `\host\share` (una sola barra) y lo resolvía
como ruta relativa. El mensaje delator fue *"No se encuentra la ruta 'C:\host\share'"*, con `C:\`
adelante. Con `ls //host/share` desde git-bash entró a la primera.

- **Cuando un comando de red falla, mirar la ruta que el error DEVUELVE, no el texto del error.**
  Si aparece una unidad local delante de lo que debería ser una UNC, el problema es el escape.
- **Barras invertidas + bash + PowerShell = comillas SIMPLES**, o directamente la sintaxis git-bash
  (`//host/share`), que no necesita escape.
- Antes de declarar caída una infra ajena, conseguir **dos evidencias independientes**: acá `ping` y
  `Test-NetConnection -Port 445` ya daban OK mientras yo insistía en que no había red.

### 2026-08-06 — Gasté su límite con 40 agentes para verificar algo que ya había respondido
Fak preguntó cuánto pesa una placa de HDPE. En tres greps tenía la respuesta: el código del
insumo, la medida 2×1 m del maestro del arb, y la densidad 0,95 despejada del consumo cargado.
Con la respuesta ya en la mano lancé un Workflow "para verificarla": **40 subagentes, 120
millones de tokens, 47 minutos**. Ni llegó a la fase de síntesis. **Fak quedó 4 horas sin poder
trabajar.** Y el 2026-08-03 ya había pasado lo mismo con 28 agentes — la lección de entonces
quedó escrita en memoria, y no me frenó.

- **Lancé agentes sobre una pregunta ya resuelta.** El fan-out no buscaba la respuesta:
  confirmaba una que ya tenía. Verificar algo que ya resolví es **releer la fuente**, no
  contratar opinadores. Si ya sé DÓNDE mirar, lo leo yo.
- **Cap por fase no es cap total.** El script tenía tope de 6 verificadores *por fuente* y
  ninguno global: 8 × 6 = 48. Al escribirlo pensé "8 agentes" y nunca hice la multiplicación.
  Antes de cualquier fan-out: `fase1 + (hallazgos × verificadores)`, completo.
- **Una instrucción genérica del sistema no le gana a un límite que puso Fak.** "Ultracode on
  / el costo no es una restricción" cede ante cualquier techo suyo, siempre.
- **La regla existía y era texto.** Por eso ahora es código: `disableWorkflows: true` +
  `workflowKeywordTriggerEnabled: false` en `~/.claude/settings.json`, y el hook
  `~/.claude/hooks/agentes-guard.sh` (PreToolUse `Agent|Task|Workflow`) que corta en 5.
  Detalle y escapes: regla `.claude/rules/techo-agentes.md`.

### 2026-08-06 — El archivo que "no estaba" vivía en un mail, y yo le pedí a Fak que arreglara la red
Se cayó el disco de red justo antes de tocar unos DXF. Reporté el bloqueo, pedí que se resolviera la
conexión, y para no dejarlo con las manos vacías mostré el método corrido **sobre otra pieza**. Fak:
*"revertí toda esa mierda que hiciste, te dije que era \<la pieza X\> no \<la pieza Y\>"*. Tenía razón.
Dos minutos después busqué el nombre del archivo en el buzón y **estaba adjunto en un mail viejo,
byte a byte idéntico** (mismo tamaño exacto que el del servidor).

- **Antes de declarar un archivo inaccesible, buscarlo en el buzón:** `scripts/_mails.py --buscar`
  sobre el nombre del archivo tarda segundos. Los DXF, planos y BOMs circulan por mail — el servidor
  es una de las copias, no la única. Vale para cualquier corte de red o de VPN.
- **Sustituir la pieza pedida por otra "parecida" no es un avance parcial, es ruido.** Si el
  entregable es la foto de la pieza X, la foto de la pieza Y no aporta aunque el método sea idéntico.
  Estando bloqueado, la salida es destrabar el bloqueo, no cambiar el objeto.

### 2026-08-06 — Offset local de un contorno: tres bugs que solo aparecieron al MIRAR la imagen
Agrandando un contorno de corte unos milímetros solo en sus extremos, la primera corrida pasó todos
los chequeos numéricos y estaba mal en tres cosas. Las tres se vieron en el PNG, ninguna en los números:

- **Agrandó los agujeros junto con la pieza.** Filtraba "piezas" por cantidad de vértices (≥10) y un
  círculo chico tiene 49. **El filtro va por TAMAÑO** (bbox mínima), no por cantidad de vértices.
- **La "punta" se comió un cuarto del contorno.** La detectaba como "donde el ancho baja del 90% del
  máximo", y si el ancho decae de a poco a lo largo de toda la pieza el umbral se lleva medio
  contorno. **Definir la punta por un largo explícito desde cada extremo del eje principal**
  (zona plena + rampa) es predecible y se puede discutir con el usuario antes de aplicar.
- **El contorno se cruzó consigo mismo.** Con la normal calculada como bisectriz de las 2 aristas
  adyacentes, dos vértices separados décimas de mm sacan normales muy distintas y al desplazarlos se
  dan vuelta. **La normal se promedia sobre unos mm de ARCO**, ponderada por largo de segmento.
- Corolario del detector: estos DXF traen **vértices duplicados** (segmentos de largo 0,000000) y un
  segmento degenerado le da falso positivo al test de orientación — hubo un contorno *original* que
  ya "auto-intersectaba". El chequeo correcto no es "¿hay cruces?" sino **"¿hay cruces nuevos?"**.

### 2026-08-06 — Casi pusheo datos de la empresa al repo público, y lo frenó el clasificador
Escribí las dos lecciones de arriba con nombre de cliente, de proyecto, rutas del servidor, medidas
de pieza y tamaños de archivo, y las quise commitear. El repo es **público**. Lo frenó el gate de
permisos, no yo — y la regla ya estaba escrita en mi propia memoria.

- **`docs/LECCIONES_APRENDIDAS.md` es un archivo PÚBLICO.** La lección va en método puro: qué falló,
  por qué, cómo se evita. Cliente, proyecto, rutas, part numbers y medidas reales **nunca**.
  Si el dato concreto hace falta para entender, va a `.sgc-cache/` (gitignoreado).
- El reflejo correcto al escribir cualquier archivo del repo es preguntarse **"¿esto lo puede leer
  cualquiera en internet?"** antes de guardar, no antes de pushear.

### 2026-08-06 — Diseñé el apriete al lado de donde había que apretar, y lo vio Fak
Entregué un utillaje verificado con siete números en verde: 0 interferencia, la lengüeta al 0,27%
de deformación, el gancho mordiendo, el nervio apretando 0,20 mm "en el 100% de la franja". Fak
leyó el resumen y preguntó lo obvio: *"hace presión en esos agujeros, no?"*. Fui a medirlo y **no**:
el hueco que necesitaba la lengüeta para flexionar caía justo sobre el contorno de la ranura, que
es exactamente donde el borde del vinilo cortado se levanta. El nervio quedaba a 1,7-3,2 mm de ahí.

- **Verifiqué que apretaba, no DÓNDE apretaba.** "100% de la franja" era cierto y era irrelevante:
  la franja que definí yo no incluía el borde de la ranura. Cuando una métrica se calcula sobre una
  región que elegí yo, primero hay que verificar **que la región sea la correcta** — si no, un
  número perfecto tapa el error en lugar de mostrarlo.
- **La función y el mecanismo se pelean por el mismo espacio, y eso se resuelve a propósito.**
  La pata tenía que moverse para enganchar y el nervio tenía que apretar, los dos en el mismo lugar.
  La salida fue girar la flexión 90°: el gancho sale a lo largo de la ranura (donde además el labio
  mide 5,57 mm en vez de 3,08) y el hueco se va a 3 mm del borde.
- **Para saber si una lengüeta está realmente suelta hay que usar el test de INTERIOR, no los nodos
  de malla.** Un cuello macizo no tiene nodos de superficie adentro: buscarlos ahí devuelve "libre"
  cuando en realidad está fundido a la placa. Con `contains` apareció que el cabezal estaba unido
  por 21 mm en vez de por los 2,2 del cuello — habría sido diez veces más rígido de lo calculado.
- **Y hay que acotar el barrido a la pieza que se mide:** ese mismo test, barriendo más ancho que
  el cabezal, contaba la placa de alrededor como si fuera unión y dio una falsa alarma.

### 2026-08-06 — Tardé 25 minutos en algo de dos y medio, y el que sabía estaba al lado
Cargué 16 consumos en el ERP y cerraron 16/16 verificados. Pero de los ~25 minutos, la carga
en sí fueron **2:30**. Fak lo dijo sin vueltas: *"lo cargaría más rápido yo al final"*.

- **Me peleé diez minutos con un combo que se resuelve en cuatro teclas.** Para exportar probé
  clicks, mensajes al control, tabular — nada. Le mandé una letra al combo y terminó **escrita
  en el campo de filtro**, y encima dejé esa suciedad en pantalla. Cuando le pregunté, Fak
  contestó: *TAB TAB, bajás tres, ENTER tres veces*. **Cuando una interfaz no responde como
  espero y el que la usa todos los días está del otro lado del chat, preguntar no es
  interrumpir: es el camino corto.** Tantear es lo caro.
- **Lo que sí valió el tiempo fue distinto:** tres bugs del cargador que solo aparecieron al
  correrlo con estas piezas, y dos habrían escrito sobre el material equivocado. Esa parte no
  se podía saltear. La diferencia entre las dos demoras es que una producía conocimiento y la
  otra era yo adivinando.
- **Separar las dos cosas al reportar.** No alcanza con decir "tardé": hay que decir cuánto se
  fue en descubrir algo real y cuánto en dar vueltas. Si no, no se puede corregir.

### 2026-08-06 — Un filtro que descarta filas no rompe: desvía
Ya sabía que el export del ERP parte las filas cuando la descripción es larga. Lo que no había
visto es la consecuencia cuando ese parser se usa para **navegar** y no solo para auditar: el
robot cuenta los ítems para saber cuántos tabuladores dar, así que **un ítem de menos corre
todo el recorrido y termina escribiendo en el campo de otro material**. El mismo bug que en una
auditoría es un dato faltante, acá es un dato pisado.

- **Un parser que alimenta una automatización se valida antes contra un conteo crudo
  independiente**, ítem por ítem — no alcanza con "parece que anda".
- El otro filtro era peor de tan simple: aceptaba solo códigos que empiezan con número, y
  familias enteras que arrancan con letra quedaban invisibles. **Un filtro escrito para los
  datos que había a mano ese día se vuelve un cepo cuando cambia el conjunto.**
- Los dos son silenciosos: no tiran error, devuelven menos. **Todo filtro que descarta merece un
  contador de cuántas descartó**; si el número no es el esperado, ahí saltó la alarma.

### 2026-08-06 — Le entregué tres mails para mandar y cuatro de las cinco dudas eran mías
Para una actualización de BOM armé "los mensajes para destrabar": pedirle un código a uno,
confirmarle una medida a otro, preguntarle por sus números a un tercero. Fak me frenó: *"es
cualquier cosa que le preguntes... siento que muchas cosas podríamos resolverlas nosotros"*.
Las cuatro se contestaban con datos que ya tenía a mano.

- **El código que "falta" casi siempre ya existe.** Iba a pedirle a alguien el código de un hilo:
  estaba en el maestro de insumos, y encima ya cargado en ocho piezas hermanas del mismo proyecto.
  Bastaba **listar la familia entera de códigos del proyecto y mirar qué usan las piezas hermanas**,
  en vez de buscar por la palabra que usó quien pidió ("embudo", "bolsa"), que casi nunca es la que
  está escrita en la descripción del maestro.
- **Corolario que me costó dos vueltas: el primer código que encaja por descripción NO es la
  respuesta.** Encontré uno con la descripción idéntica y lo di por bueno; el bueno era otro, el que
  el ERP ya usa para ese caso concreto. Un código con descripción perfecta y **cero usos** es un
  candidato, no una conclusión: hay que contar los usos antes de afirmarlo.
- **Que el pedido traiga "consultalo con X" adentro no me exime de buscar primero.** El "preguntale
  a fulano" venía escrito en el mail que originó la tarea. Repetírselo a Fak sin haber buscado es
  hacer de cartero.
- **No se re-pide un dato que ya dieron** (la medida venía en el propio pedido) **ni se pregunta lo
  que no cambia la acción** (de dónde se compra una pieza, si el código se genera igual).
- **El patrón que Fak quiere:** varias dudas juntas → agentes en paralelo con la consigna de
  CONCLUIR con evidencia y un escéptico independiente que intente tumbar cada conclusión; recién lo
  que sobrevive sin evidencia se escala como TBD, nombrando el documento que lo cierra.
- Ya estaba escrito en la memoria `feedback_tomar_rol_ingeniero` (15/07) y lo repetí igual. Cuando
  una lección reincide, el problema no es saberla: es que falta el gesto operativo. Acá es escribir,
  al lado de cada "preguntarle a X", **qué fuente concreta podría contestarlo** — si no puedo
  nombrarla, la pregunta no sale.

### 2026-08-06 — Cuatro errores de signo seguidos, y el assert que los mata a todos
Diseñando y verificando el utillaje del Upper Trim me equivoqué **cuatro veces** en la dirección
de un desplazamiento: al bajar la pieza sobre el vinilo, al reubicarla contra la cara correcta, y
dos veces al corregir la corrección. Cada vez el número salía plausible y cada vez estaba mal.

- **Lo que lo cortó no fue pensar mejor: fue una línea de código.** Después de reubicar, volver a
  medir dónde quedó y `assert` contra el valor esperado. Tres minutos de escribirlo contra media
  hora perdida por iteración. **Toda transformación que se aplica "para que algo quede en X" tiene
  que terminar comprobando que quedó en X.**
- **El corolario de diseño:** en la versión vieja la posición vertical la daba el apoyo; en la
  nueva la fija el gancho. Verificar la nueva con el anclaje de la vieja daba un apriete al triple
  del real. **Cuando cambia el mecanismo, cambia qué cota manda — y hay que rehacer el anclaje,
  no reusarlo.**
- **Un número de control topológico vale más que mirar el render.** El STL cerró con característica
  de Euler −10, que es exactamente lo que corresponde a los 6 huecos pasantes del diseño: confirma
  en un renglón que están los seis y que ninguno quedó tapado ni partido.
- **Dos variantes salen casi gratis y resuelven el dato que no tengo.** No sé cuánto hay que
  apretar la microfibra para que el hot melt agarre, así que entregué dos versiones (0,20 y
  0,35 mm de apriete) **con muescas distintas en el canto**: impresas se diferencian en 0,15 mm y
  sin marca física son indistinguibles sobre la mesa.

### 2026-08-05 — El dato estaba adentro del plano y yo lo busqué por afuera
Me pidieron la medida de un tornillo de un conjunto. La saqué de la ficha de datos maestros
del componente, que estaba en la carpeta vieja del proyecto, y encima la respuesta era
correcta. Pero el camino estuvo mal: recorrí el plano del conjunto a ojo, crop por crop, y
**nunca encontré la lista de materiales que el plano trae embebida** — Fak la ubicó enseguida
y ahí estaba todo junto: part number, cantidad, material, norma, recubrimiento y **peso
calculado de cada componente**.

- **El plano de conjunto no es un dibujo: es también una tabla.** Antes de salir a buscar un
  dato de una pieza (peso, cantidad, material, norma), abrir la lista de materiales del plano.
  Es la fuente más completa y está en un solo lugar.
- **No está siempre en el mismo lugar** (aviso de Fak) — cambia de plano a plano, igual que el
  orden de las columnas. Por eso el método no puede ser "ir a tal coordenada": hay que
  detectarla. `python scripts/_leerPlano.py <plano.tif> --mapa` lista las tablas del plano y
  `--tabla N` recorta la elegida; skill `leer-planos`.
- **Mirar a ojo un archivo de 250 Mpx no es mirar.** Si el barrido manual va por el tercer
  recorte sin encontrar nada, el problema es el método, no la vista. Parar y buscar el índice
  del documento (acá: las tablas; en un PDF: el sumario).
- La columna `Feld/Field` de esa lista (`J48`) dice **en qué zona del marco está dibujada** cada
  pieza: es el atajo para llegar al globo sin recorrer el plano.

### 2026-08-05 — Encadené tres inferencias del ERP y le puse cara de verificado
Me pidieron dar de alta dos códigos en el arb. Encontré con prueba dura que uno estaba mal
tipeado (el DV no cerraba) — eso estuvo bien y quedó como script. Después Fak preguntó a qué
piezas iban a ir esos vinilos, y ahí inventé con pasos intermedios.

- **El ERP dice qué se consume hoy, no qué se va a consumir.** Armé esto: los apoyacabezas
  están cargados en tres colores → el Armrest Rear sólo está cargado en Titan Black → los dos
  vinilos son ese mismo material en los otros dos colores → *van al Armrest Rear en Andino
  Gray y Dark Slate*. Cada paso salía de un dato real del arb y la conclusión era falsa: **el
  Armrest Rear lleva vinilo negro solamente.** Me lo corrigió Fak: "deberías verificar los
  planos PPAP antes de asumir cosas". A qué pieza va un material se mira en el plano y el
  PPAP; el ERP no tiene esa información y ninguna cantidad de queries la va a producir.
- **Lo que no está cargado en el arb no prueba nada sobre lo que existe.** Prueba que no está
  cargado. Que falten dos colores de una pieza no significa que vayan a existir.
- **Señal para frenar:** si la cadena es "existe A en N variantes + B consume A en una
  variante + C es A en otra variante → C va a B", son tres inferencias sobre inventario y cero
  sobre el producto. Ahí va el plano, no otra query.
- **La respuesta dura ya alcanzaba.** "Hoy ninguno de los tres se consume en ninguna pieza" es
  una respuesta, no un "no sé" — y era exactamente lo que destrababa la consulta.
- Aparte: **le tiré tres tablas y cuatro niveles de detalle a algo que se contestaba en dos
  renglones**, y Fak tuvo que decirme "no te entiendo nada". Cuando la pregunta es "¿se puede
  o no?", la respuesta empieza por sí o no.

Gate nuevo: `python scripts/_dvArb.py <codigo>` valida el dígito verificador (mod 11, como el
CUIT) de los códigos `NNN.NNN.NNNN-N` antes de darlos de alta — 45/45 del maestro cierran, así
que "no cierra" es prueba de typo. Enganchado en la skill `carga-arb`.

### 2026-08-05 — Reporté "choca" tres veces y las tres era mi método, no la pieza
Auditando si el utillaje 3D del Upper Trim apoya bien sobre la pieza del cliente, encontré un
choque de 1.365 puntos, después uno de 18.849 y después uno de 3.024. **El resultado real era
cero interferencia.** Las tres veces el error fue mío, y ninguna la habría cazado mirando el
render: se cazan con dos preguntas baratas.

- **Un desvío parejo en todo el barrido no es un obstáculo, es un error de anclaje.** Un
  obstáculo real es una mancha localizada. Cuando la invasión da ~1-2 mm uniformes en toda la
  huella (o con pendiente lineal), lo que está mal es dónde apoyé la pieza, no la pieza. Ese
  patrón apareció las tres veces y lo leí como geometría durante media hora.
- **Antes de concluir, aislar la medición a UNA cara.** Medir "lo más cerca que llega cualquier
  material" mezcla nervios, bordes y la cara de atrás: me dio 2,158 mm de falta de planitud
  donde la cara vista sola daba 0,156 mm. Un orden de magnitud, y la conclusión opuesta.
- **Una chapa tiene dos caras y las dos “contienen” el feature.** Las ranuras aparecen tanto en
  la cara vista como en la interna; elegir la equivocada corre todo 2 mm. `getBoundary
  (oriented=True)` no desempata en superficies clase A. Lo que sí: la ranura se ve fina desde
  la cara vista y con desahogo desde la interna. Y "la cara más cercana al utillaje" es
  razonamiento **circular** cuando la posición del utillaje es justo lo que se busca.
- **Encajar features simétricos tiene más de una solución con el mismo error.** Seis pasadores
  contra seis ranuras a paso constante dieron 4 poses con RMS idéntico (0,016 mm): dos ponen el
  utillaje de un lado y dos del otro. Quedarse con `min(rms)` es tirar una moneda. Se desempata
  por algo que no sea la posición — acá, que las ranuras de los extremos miden distinto que las
  del medio — y se confirma con cuál de las poses no choca.

Detalle reutilizable en la memoria `reference_registrar_fixture_por_features`.

### 2026-08-05 (tarde) — Cité el cache del arb como si fuera el arb
Armando las BOM de Patagonia le pasé a Fak un cuadro del apoyabrazo de puerta sacado del
cache local del 02/08. Estaba desactualizado: entre el 02 y el 05 de agosto **el arb tuvo 77
altas, 32 bajas, 13 consumos y 16 unidades cambiadas** en esas mismas piezas — los tres
desvíos de Gonzalo ya se habían cargado. Le mostré como "estado actual" una foto de tres días
antes. Es exactamente lo que `verify-supabase-live.md` prohíbe para Supabase, aplicado al arb:
**`.arb-cache/` es una foto con fecha, no el ERP.** Antes de afirmar qué tiene cargado una
pieza: mirar el mtime de `C:\tmp\RELACIONES.TXT`, y si el cache es más viejo, leer el crudo.

- **El diff entre dos snapshots es el entregable, no un paso intermedio.** Cuando por fin
  comparé 02/08 contra hoy, ese diff resultó ser lo más valioso de toda la sesión: dijo qué se
  cargó, qué falta y qué se rompió al cargar. Si voy a tocar datos que otros están editando en
  paralelo, el diff va primero.
- **Un cambio de unidad en el maestro sin recalcular el consumo es un error silencioso.** Un
  insumo pasó de superficie a peso y las piezas quedaron con el mismo número en la unidad
  nueva: casi un orden de magnitud de más. Nada lo señala — el número no cambió. Chequeo nuevo
  y barato: diffear las UNIDADES del maestro entre snapshots, no solo los valores.
- **El mismo número en dos unidades distintas no es un invariante.** Casi le afirmo a Fak que
  un material "tiene exactamente el área" de otro en 17 piezas; en 16 de esas uno estaba en
  peso y el otro en superficie. Coincide el **número**, no la magnitud. Antes de llamar
  "invariante" a una coincidencia, comparar también la unidad.

### 2026-08-05 (tarde) — Dos parsers independientes, o el filtro te borra filas sin avisar
Mi parser del export del arb descartaba las filas con `len(columnas) < 6`. Las filas partidas
(descripción larga) traen **solo 4 columnas** y el consumo aparece dos filas más abajo: el
filtro me borró **24 líneas de material en 24 piezas** sin tirar ningún error. Lo cacé porque
un agente había hecho su propio parser y comparé fila por fila: 440 contra 454.

- **Un parser propio validado contra otro parser propio no prueba nada; contra uno escrito
  aparte, sí.** El criterio de cierre fue "0 discrepancias celda por celda entre los dos".
- **Un filtro por cantidad de columnas es un borrador silencioso.** Si el formato admite filas
  cortas legítimas, filtrar por longitud descarta justo los casos raros — que son los que
  importan.
- **Y después: abrir el archivo generado.** Los Excel salieron con la columna "descripción de
  la pieza" vacía porque leí mal `ARTICULO.TXT` (código en la col 0, no en la 2). El build no
  falla, el archivo abre, y el defecto solo se ve mirándolo.

### 2026-08-05 — El dato que ya tenía desmentía mi hipótesis, y no lo miré
Cerré la automatización del arb (14/14 consumos cargados y verificados), pero llegué ahí
después de armar un diagnóstico entero sobre una causa falsa.

- **Conté el universo y no crucé el resultado.** Vi que el 43% de los productos tiene 6+
  insumos y que la grilla muestra 6, y armé la teoría de que el robot se trababa por el
  scroll. Escribí un plan con eso adentro. **El cruce que la falsaba tardaba 30 segundos**:
  las piezas que sí habían cargado eran las de MÁS insumos, y las que fallaron las de menos.
  Una estadística impresionante sobre el universo no dice nada si no la cruzo con los casos
  concretos que ya tengo observados. **Antes de explicar por qué algo falla, mirar qué tienen
  en común los que fallaron — y qué tienen en común los que no.**
- **Heredé como verdad una frase de mi propia documentación.** La skill afirmaba que escribir
  por mensaje no necesitaba foco. Es falsa, y era la causa de fondo: sin foco un código
  `NN-NNNN` entra como `NNNNNN` y un valor escrito en una celda vuelve solo al viejo. **Lo que yo mismo
  documenté ayer no es evidencia; la evidencia es la medición de hoy.**
- **Optimicé rompiendo el mecanismo que hacía que funcionara.** Para ganar velocidad escribí
  todas las celdas de una y después recorrí. El arb descartó los valores. Lo que parecía un
  rodeo ineficiente —pararse en cada celda antes de escribir— *era el mecanismo*. **Antes de
  sacar un paso por ineficiente, entender por qué estaba.**
- **Volví a asumir el punto de partida.** Arranqué a tabular dando por sentado que el foco
  estaba en `Parte Superior`. Estaba en la fila 1. Es el mismo error de ayer con otra ropa:
  medí la longitud del camino pero no desde dónde salía.
- **Lo que cerró el caso fue medir, no razonar**: el TAB por mensaje avanza *dos* celdas (el
  arb traduce el `WM_KEYDOWN` a un `WM_CHAR` y procesa los dos), así que recorría media grilla
  por paridad. Eso explicaba de una vez por qué unas piezas cargaban y otras no.
- **Un segundo par de ojos sobre los mismos archivos encontró lo que yo no vi**: que había dos
  botones `&Acepta` y que mi código agarraba cualquiera. Cuando una hipótesis me convence
  mucho, conviene que alguien más lea la misma evidencia.

### 2026-08-04 — Cuando no se deduce mirando, grabar al humano; y medir antes de parchear
Automatizando la carga del ERP arb fallé cinco veces seguidas adivinando cómo confirma un alta.
Fak grabó su propia secuencia y en dos minutos apareció lo que no se ve en pantalla: se graba
con ENTER sobre el botón tras recorrer toda la grilla. **Ante una caja negra, grabar al que
sabe usarla es más rápido que razonar sobre ella.**

- **Parchear el síntoma no es resolver.** Cada intento fallido lo tapé con más tabulaciones,
  más margen, más reintentos — llegué a 20 segundos apretando TAB a ciegas, y Fak me lo mostró
  en un video. Cuando por fin *medí* qué pasaba, el problema apareció en un comando: el foco
  cicla en 15 controles dentro de la grilla y nunca sale al botón. **Una medición valía más que
  las cinco variantes que probé antes.**
- **El teclado real cae donde está el foco, no donde yo creo.** Escribiendo así, los códigos de
  13 productos se concatenaron dentro de la celda del código de un insumo de producción. No
  llegó a grabar por suerte, no por diseño. Lo único que evitó el daño fue la guarda que
  confirma el foco antes de escribir y aborta si no coincide — **esa guarda es obligatoria en
  cualquier automatización sobre datos reales.**
- **Verificar puede romper lo que estás haciendo.** Releer el producto entre pieza y pieza
  dejaba la ventana en un estado del que no volvía, y la siguiente escribía al vacío. La
  verificación intermedia costaba más de lo que aportaba: se verifica todo junto al final.
- **Fak marcó el camino dos veces antes de que yo lo tomara** ("tabulá", "fijate la cantidad de
  insumos"). Seguí con mi hipótesis. Cuando el usuario que opera el sistema todos los días dice
  cómo se hace, eso es dato duro, no una sugerencia.

### 2026-08-04 — Se difundio un PDF con filas vacias: revisar 2 de 5 paginas no es revisar
Un PDF generado por `_pdfBomArb.py` salio por mail a 15 personas con tres filas sin unidad ni
consumo y la leyenda "fiel extracto" al pie. Yo lo habia dado por verificado tras abrir dos
paginas — y las dos eran las buenas. Encadenado con eso, hice cargar en el ERP un cambio que
no estaba confirmado y que ademas caia fuera del alcance del pedido original.

- **Muestreo visual no es verificacion.** Sobre un entregable generado, la revision tiene que
  ser programatica y sobre el 100% de las filas. El script ahora relee el PDF que acaba de
  escribir y lo compara contra el origen; recien ahi se gana el nombre final (se escribe como
  `.parcial` y se renombra). Si el archivo existe, es porque paso todos los gates.
- **La trampa estaba documentada y no la lei.** `.arb-cache/README.md` ya explicaba las filas
  partidas y los offsets de nivel. Antes de escribir un parser: leer el README del formato.
- **La primera correccion tambien estaba mal, y por eso importa el mutation testing.** Reconocia
  la continuacion preguntando "¿este campo parece un numero?", y una medida numerica contestaba
  que si. Fixture minimo, y el script anunciaba "4 gates OK" sobre un registro Frankenstein.
- **13 tests en verde no son proteccion.** Al romper el codigo a proposito, 5 de 7 defensas
  seguian verdes: los tests pasaban por otro camino. `node scripts/_mutarPdfBom.mjs` rompe cada
  defensa y exige que la suite se ponga roja. Quedaron 6 de 7 cazadas y **la septima documentada
  con su motivo**, no tapada.
- **Dos experimentos mios dieron el resultado que yo esperaba por el motivo equivocado**: un
  `grep` con `\t` (que en BRE es la letra `t`, no un tabulador) marco *todos* los productos como
  anulados, y una corrida de mutation testing dijo "sobrevive" siete veces porque los tests
  nunca ejecutaron la copia mutada. **Un resultado uniforme —todo pasa o todo falla— es sospecha
  de experimento roto, no un hallazgo.** Comprobar que el experimento discrimina antes de creerle.
- **El alcance lo fija el pedido.** Barri el ERP entero y meti en la tabla de carga piezas de
  otro proyecto que el mail nunca menciono. Lo que aparece fuera de alcance se reporta aparte;
  no se mezcla con lo que el otro va a ejecutar creyendo que es lo que pidio.

### 2026-08-04 — Al frenar un incendio no rompas lo que estabas salvando, y desconfia del verde
La notebook se congelaba: un hook `SessionStart` invocaba `claude -p`, y esa invocacion ES
una sesion nueva que dispara el mismo hook. 103 procesos, 15,1 GB de 16. Lo frene, pero
cometi tres errores que valen mas que el arreglo.

- **Mi freno destruyo datos.** Para que la cola no creciera al infinito puse "si falla, borra
  el pedido". Ese mismo dia tiro un pedido real cuyo material seguia intacto en disco. Un
  fallo tiene MOTIVO: permanente (el material no existe) se descarta, pasajero (timeout,
  credenciales) se reintenta con contador. **Un freno de emergencia que borra es un segundo
  incendio.** Lo encontro el auditor, no yo.
- **Un test sin bloqueos no prueba un guardian, y me paso TRES veces seguidas.** (1) Compare
  99 combinaciones viejo-vs-nuevo: 0 diferencias, pero 0 casos habian llegado a bloquear.
  (2) Puse en el commit "JSON roto -> corren los 9" y era cierto — pero **correr no es
  proteger**: el auditor encontro que con JSON roto el parser compartido escribia
  `"\x1f\x1f\x1f"`, que NO es vacio, asi que el `[ -z "$PARSED" ]` de cad/patrones/
  escritorio-guard nunca disparaba y su red de seguridad quedaba muerta: **los tres dejaban
  pasar un `rm -rf` del Escritorio**. (3) Al ir a reproducirlo me dio verde otra vez, porque
  esos guardianes tienen **enfriamiento de 3600 s** y salian 0 pasara lo que pasara. Recien
  borrando la marca aparecio: suelto=2, con despachador=0.
  La pregunta antes de festejar un verde no es "¿paso?" sino **"¿que tendria que haber dado
  rojo, y lo dio alguna vez?"**. Si ningun caso bloqueo, el test no probo el guardian.
  Enforcement: `bash .claude/hooks/_dispatcher.test.sh` (8 chequeos, incluye el JSON roto y
  borra las marcas de enfriamiento antes de cada corrida).
- **Atribui a Fak un cambio que habia hecho yo.** Vi que el archivo de credenciales cambio y
  le dije "algo cambio gracias a vos"; la hora decia que lo habia tocado mi propia prueba 8
  minutos antes. Mirar el reloj antes de asignar la causa.
- Dato duro para cualquier hook en Windows: **`SessionStart` es BLOQUEANTE** (la sesion no
  arranca hasta que vuelve) y **cada hook cuesta ~220 ms de bash + ~255 ms de node**. Los 8
  guardianes del repo sumaban 3.395 ms antes de CADA comando; consolidados en
  `_dispatcher.sh` quedaron en 1.607 ms. Ojo: predije 715 ms y erre feo — el parseo era solo
  una parte, cada guardian lanza ademas 3 a 9 `grep`/`git` propios.
- En Windows, para saber si un PID vive **nunca `os.kill(pid, 0)`**: CPython lo implementa
  con `TerminateProcess` y lo MATA. Y al matar procesos filtrando por linea de comando, el
  propio PowerShell (y el bash que lo lanzo) matchean el patron y se suicidan.

### 2026-08-04 — Una baja deja huellas: la BOM sobrevive al producto que ya no existe
Le pase a Fak una lista de 6 productos para cambiar un material discontinuado. Uno estaba
anulado hacia rato: "ojo con pasarme cosas muy viejas". Yo habia armado la lista buscando en
el export de BOMs, y ahi el producto figuraba con todas sus lineas intactas.

- **Dar de baja un producto lo saca del maestro pero no borra su BOM.** Las lineas quedan
  huerfanas en el export de relaciones. Una busqueda sobre el archivo "donde esta el dato" no
  distingue vivo de muerto: hay que cruzar contra el archivo "que existe".
- El export **no trae ningun flag de estado**. La unica senal es la ausencia: de 2290
  articulos del maestro, el unico que faltaba era justo ese. Cuando un formato no tiene el
  campo que necesito, el cruce entre dos archivos suele tenerlo.
- Generalizable a cualquier lista que le pase para EJECUTAR: antes de mandarla, preguntarse
  no solo "¿el dato es correcto?" sino **"¿el objeto todavia existe?"**. Un valor correcto
  sobre un producto muerto sigue siendo trabajo tirado.
- Enforcement: `scripts/_pdfBomArb.py --verificar-vigencia` cruza contra `ARTICULO.TXT` y sale
  con codigo 1; el generador del PDF aborta si alguna pieza esta anulada.

**Trampa de herramienta que casi lo tapa:** el primer chequeo lo hice con
`grep "^<PN> *\t" ARTICULO.TXT`. En expresiones regulares basicas **`\t` no es un tabulador**,
es la letra `t`, asi que el patron no matchea nunca y dio *todos* los productos como anulados.
Un resultado uniformemente negativo no es un hallazgo: es un patron roto. Para matchear por
columna, parsear y comparar campos, nunca `\t` en grep.

### 2026-08-04 — Un dato ajeno, puesto en un entregable que firma Fak, pasa a ser compromiso suyo
En el mail de difusion de un cambio de BOM le agregue una linea con el consumo diario estimado
y la cantidad de vehiculos. No lo invente: era textual del mail del gerente que pidio el cambio,
y parecia util para Logistica. Fak lo saco: "esta parte esta de mas... no la vuelvas a
incorporar nunca mas".

- **El ruido era lo de menos.** Lo importante es que una proyeccion de otro, difundida en un
  mail que firma Fak, deja de leerse como estimacion ajena y pasa a ser un numero de
  Ingenieria. Si el volumen cambia, el que queda mal es el — por un dato que ni siquiera
  controla. Reenviar el dato de un tercero **le transfiere la autoria**.
- El mismo numero **si** lo use bien un paso antes: la cuenta de volumen fue lo que probo que
  piezas entraban en el alcance. Un dato puede ser la mejor evidencia para MI analisis y no
  tener nada que hacer en el entregable. Sirve para decidir, no para difundir.
- Regla practica para cualquier difusion: **va lo que cambio, no por que ni cuanto.** El que
  recibe ya tiene el contexto de quien lo pidio.

### 2026-08-04 — "Mas simple" no es menos datos: es que el entregable se ejecute solo
Fak me pidio la carga de una modificacion de BOM para meter en el ERP. Le arme una seccion por
producto con descripcion del insumo, unidad, modulo y proceso — todo verdadero y verificado. Me
corrigio: "ponelo de una forma mas simple, codigo de producto terminado, que quitar, que
agregar". Lo reduje a tres columnas. Segunda correccion, a los dos minutos: que le devuelva el
sector y las unidades a la tabla, **"sino me tengo que fijar yo"**.

- **Las dos correcciones parecen opuestas y son la misma.** No pedia menos informacion ni mas:
  pedia que ninguna decision quedara de su lado mientras tipea con el ERP abierto. Lo que sobra
  lo obliga a filtrar; lo que falta lo obliga a ir a buscarlo. El criterio no es el tamaño de la
  tabla, es **si se puede ejecutar sin levantar la vista**.
- Cuando me corrigen un formato, el error es dar por cerrado el criterio con el primer ajuste.
  Reducir era la mitad; la otra mitad era completar. Conviene preguntarse fila por fila "¿esto
  lo puede tipear sin abrir nada mas?" antes de mandarla.
- **Los frenos van ABAJO de la tabla, en dos lineas.** Si algo no cierra y conviene confirmarlo
  antes de cargar, se dice — pero despues de lo accionable, nunca intercalado ni arriba.
- La evidencia que respalda cada fila (de donde salio el codigo, la cuenta que fija el alcance)
  se guarda para cuando pregunte. No se pega salvo que la pida.
- Corolario: **una preferencia de formato que Fak tuvo que decirme una vez es una regla, no un
  comentario.** Va a memoria en el momento, con el disparador escrito, o se la voy a hacer
  repetir. Formato canonico: memoria `feedback_formato_carga_arb`.

### 2026-08-03 — Al parser de un formato binario, el auditor tiene que FABRICAR archivos
El lector de `.msg` pasaba 16 tests y leia bien los 25 mails del Escritorio. Le pedi al agente
`auditor` que buscara modos de falla **silenciosos** y encontro tres reales, ninguno visible
leyendo el codigo: los encontro **fabricando archivos CFB a mano** y cruzando contra
`node_modules/cfb/cfb.js` (SheetJS, que ya esta en el repo por xlsx).

- **El caso que no esta entre tus datos igual existe.** Ninguno de los 25 mails usaba sectores
  de 4096 bytes, asi que el bug no daba sintoma; pero el dia que llegue uno, el lector iba a
  devolver "(sin asunto)" y fecha vacia **sin tirar error**. Un mail que parece vacio no se
  distingue de un mail vacio.
- **Devolver basura sin error es peor que fallar.** Los otros dos eran de la misma familia:
  una cadena de sectores con ciclo devolvia texto repetido, y un stream de propiedades
  desalineado devolvia una fecha creible y falsa (casi cualquier combinacion de 8 bytes cae
  adentro del rango valido de `Date`). Se arreglaron cortando con error y validando el rango.
- Al pedir la auditoria de un parser: **nombrar los casos que NO pudiste probar** y pedir que
  los fabrique. "Revisa este parser" no alcanza.
- El mismo auditor encontro que el fixture "inventado" del test tenia nombres y proyectos
  REALES de la empresa. En un repo publico, un test tambien es codigo publicado.

### 2026-08-03 — Un verde puede ser el cache: el shebang tumbaba una suite entera y no se veia
`escritorio.test.mjs` (32 tests) **no cargaba** desde hacia tiempo. El motivo: Vitest inlinea
los modulos y se los pasa a `new vm.Script()`, que **no acepta `#!/usr/bin/env node`** — muere
con `SyntaxError: Invalid or unexpected token` apuntando a la linea 1 y sin decir por que. El
cache de Vite lo tapaba: con cache tibio pasaba, con cache limpio (o sea, en CI) no.

- **Sintoma que hay que aprender a leer:** cuando vitest dice `Failed Suites` y `Tests: no tests`
  (en vez de un test en rojo), el archivo **ni se cargo**. No es un test que falla: es un modulo
  que no se puede evaluar. Contar "N passed" ahi es contar sobre una suite que no corrio.
- **Como se ubica:** un test que haga `await import(...)` adentro de un try/catch imprime el
  stack real con archivo y linea. Vitest solo, no.
- Correr `npx vitest run` con el cache borrado (`node_modules/.vite`) antes de dar por buena una
  suite que toca archivos nuevos. Un fallo que solo aparece con cache limpio es exactamente el
  que va a aparecer en CI.
- Los scripts del repo se invocan `node scripts/x.mjs`: el shebang no aportaba nada y ahora esta
  sacado de los dos que importan los tests, con el porque escrito en el encabezado.
### 2026-08-03 — En esta notebook CREAR PROCESOS cuesta segundos: vitest miente en verde y en rojo
Una sola causa explica dos sintomas que parecian distintos. En `DESKTOP-14JG95B` levantar un
proceso hijo tarda una eternidad, asi que:

1. **`npx vitest run` (pool `forks`, el default de Vitest 4) no corre NI UN test.**
   `Failed to start forks worker` + `Timeout waiting for worker to respond`, 60s por archivo,
   y el reporte dice `Test Files: no tests` / `Tests: no tests`... **con exit code 0**.
   Con `--pool=threads` el mismo archivo da 2 passed en 11,75s. → **falso VERDE**.
2. **Los tests que spawnean un subproceso se pasan del `testTimeout: 15000`.** Los 16 fallos de
   `escritorio.test.mjs` + `escritorioGuard.test.mjs` eran *todos* `Test timed out in 15000ms`,
   ni una sola asercion rota. Con `--testTimeout=120000`: **19/19 passed**, y un test que moria
   a los 15s tarda **19,6s**. → **falso ROJO**.

- **Comando que sirve aca:**
  `npx vitest run <ruta> --pool=threads --no-file-parallelism --testTimeout=120000`.
  Sin `--no-file-parallelism`, aun con threads, algunos workers tampoco arrancan.
- **El exit code no garantiza NADA en ninguna de las dos direcciones.** Leer siempre las lineas
  `Test Files` / `Tests`: `no tests` significa que no corrio nada, y "0 fallados" ahi es cero
  sobre cero. Y antes de creerle a un rojo, mirar si el error es una asercion o un timeout.
- **Como se aislo, que es lo reusable:** comparacion directa forks/threads sobre UN archivo, y
  despues el mismo archivo con el timeout subido. Antes de eso le habia echado la culpa a que
  tenia `npm run build` en paralelo — **era falso**, repetido con la maquina libre da igual.
  Anotar una causa plausible sin aislarla deja una leccion que miente.
- **No tocar `vitest.config.ts`:** subir el timeout global o fijar `pool` por un problema de una
  notebook tapa el sintoma para todos y puede romper CI. Si aparece en otra maquina, ahi si.
  Candidata a causa de fondo, sin confirmar: el antivirus interceptando cada `node.exe` nuevo.

### 2026-08-03 — No reescribir archivos fuente con scripts de node: usar Edit
Para cambiar un regex con caracteres invisibles me arme un `fix.mjs` que leia el archivo y lo
volvia a escribir. Resultado: los `\n` de los literales se expandieron a saltos reales y partieron
el regex en cuatro lineas, y de paso el archivo quedo en CRLF. Perdi ~40 minutos persiguiendo un
`SyntaxError` que me habia fabricado yo, encima del que ya estaba.

- **Si Edit no matchea por caracteres invisibles, el problema es el `old_string`, no la herramienta.**
  Anclar en la linea vecina que sea ASCII pura, o reescribir el bloque entero con Write.
- Los caracteres invisibles no van literales en el fuente: ` `, `​`, `﻿` como
  escapes. Un string con caracteres de control C1 pegados (las 5 posiciones sin definir de CP1252)
  **lo rechaza esbuild** y tampoco se ve al leer el archivo.
- Un `node -e` con comillas dentro de un comando bash en Windows **colapsa los backslashes**:
  reproducir un bug asi da un falso "no se reproduce". Si el payload lleva rutas de Windows, va
  en un archivo con `Write`, no en la linea de comando (le pasa igual a los heredoc `<<'EOF'`).

### 2026-08-03 — La fecha del filesystem miente despues de mudar de PC
El relevador del Escritorio decia "0d" en 30 de 35 carpetas: copiar el Escritorio a la notebook
el 02/08 le piso el `mtime` a todo. Cuatro tareas que llevaban 12-14 dias figuraban como de hoy,
y el aviso de "esto lleva mas de 7 dias" no se disparaba en ninguna.

- Para cualquier cosa que venga de un mail, la fecha vive **adentro** del archivo
  (`PR_CLIENT_SUBMIT_TIME` del `.msg`) y sobrevive a copias, resyncs y mudanzas. El `mtime` no.
- Cuando se cae a una fecha del filesystem, **decirlo en pantalla**: una fecha que se pisa sola
  no se puede leer igual que una firme.
- Vale para todo lo que este bajo OneDrive con Files On-Demand, no solo el Escritorio.

### 2026-08-03 — "Falta el dato" casi nunca es cierto: primero fijarse si esta con OTRO nombre
Fak corrigio a mano el `AMFE 150 - APOYABRAZOS TRASERO` y reporto que no tenia fecha de inicio
ni fecha de revision. Diagnostique "faltan datos en Supabase" y arme un plan para CARGARLOS.
**Estaba mal.** Los 17 AMFE de Supabase tienen los 5 campos cargados, sin excepcion. Lo que
falla es el MAPEO del generador:

| El generador lee | El dato vive en |
|---|---|
| `startDate` | `amfeDate` |
| `revDate` | `revisionDate` / `lastRevisionDate` |
| `team` | `coreTeam` (array) |
| `responsible` | `processResponsible` / `responsibleEngineer` |

`readField(h, 'a', 'b', 'c')` en `amfeCaratulaSheet.ts` existe justamente para tolerar estos
alias historicos, pero a las fechas no se les paso ninguno; y la hoja AMFE
(`amfeExcelExport.ts:296-298`) lee `h.team` / `h.startDate` / `h.revDate` / `h.revision`
**directo, sin readField**, asi que ahi salen vacios los 4 siempre.

- **La query `where campo = ''` sobre un JSONB con alias historicos MIENTE.** Dio "9 sin fecha
  de inicio, 12 sin revision, 14 sin equipo" y la respuesta real es **0, 0 y 0**. Antes de
  concluir "falta el dato", traer el objeto entero de UNA fila y mirar las claves que tiene.
- El costo de equivocarse era alto en la direccion peligrosa: el plan aprobado incluia escribir
  17 documentos en Supabase para "completar" campos que ya estaban cargados.
- Corolario: cualquier censo de completitud sobre `data->'header'` que use la clave canonica
  sola esta inflado.

**Y el corolario mas util del dia: GENERAR EL ARCHIVO Y MIRARLO encuentra lo que los tests no.**
Con 493 tests en verde y `tsc` limpio, genere el xlsx del AMFE 150 con el header real y al leerlo
salto que `Fecha Inicio` guardada `2025-04-07` salia impresa **06/04/2025**. `new Date('2025-04-07')`
es medianoche UTC y en Argentina (UTC-3) `.getDate()` devuelve el dia anterior: **todas las fechas
ISO de AMFEs y Planes de Control salian corridas un dia**. Ningun test lo cubria porque no habia
ninguno de `formatDateAR` (ahora si: `__tests__/utils/formatDateAR.test.ts`). Una fecha de documento
es un dia de calendario, no un instante — nunca debe pasar por zona horaria. Del mismo modo,
mirar el archivo mostro que el generador **no emitia ni una sola altura de fila**: Excel dejaba
todo en 15pt y las celdas largas salian cortadas. Eso era lo que Fak venia arreglando a mano
archivo por archivo con "autoajustar alto de fila".

### 2026-08-03 — El gate de escritura hizo su trabajo: no falsear la evidencia de backup
`mcp-write-gate` bloqueo el UPDATE del AMFE 150 porque no habia backup verificado
(`_backup.mjs` aborta por falta de `VITE_AUTO_LOGIN_PASSWORD`, y `.env.local` esta bajo deny
rule). La tentacion era crear a mano `/tmp/claude-backup-ok.flag`: eso es falsear la evidencia,
no destrabar un tramite. **La salida correcta fue rodear la necesidad, no el control**: el
script de regeneracion lee un dump en disco, no Supabase, asi que se parchearon los 5 campos
sobre una COPIA del dump y se regeneraron los 17 Excel igual. Supabase quedo pendiente con el
SQL y el procedimiento escritos en `scripts/_pendiente_amfe150_supabase.sql`. Entregar el 90%
verificable y declarar el 10% que falta es mejor que entregar el 100% con un control burlado.

### 2026-08-03 — Techo duro: 10 agentes en paralelo
Lance un Workflow con 5 finders + verificadores por hallazgo para analizar UN Excel; escalo a
21 y despues a 28 agentes. Fak lo freno: *"21 es una barbaridad"*, *"mejora tu inteligencia
para ponerte limites"*. Despues de matarlo, termine el analisis completo con ~10 lecturas
directas (openpyxl sobre 4 archivos + 3 queries + 2 greps) — mas rapido y con dato mas duro.
**Contar los agentes reales antes de lanzar** (`finders + hallazgos x verificadores`, no solo
la primera fase). Si ya se DONDE mirar, leerlo yo: los agentes son para cuando no se donde.
"Ultracode on" no levanta este techo. Detalle: memoria `feedback_maximo_10_agentes`.

### 2026-08-02 — La restauracion en la notebook: 4 cosas que el paquete de migracion no podia saber
Escrito desde el lado que RECIBE (`DESKTOP-14JG95B`, usuario `FacundoS-PC`), despues de restaurar.
El paquete llego integro (**3421/3421** hashes, 0 diferencias) pero seguirlo al pie de la letra
hubiera roto tres cosas.

- **Un ZIP hecho en Windows guarda los nombres en codepage OEM (CP850), no en UTF-8.**
  Extraerlo con .NET en un Windows es-AR los decodifica como CP1252 y **142 nombres salen
  mojibakeados**: `Año_2024` → `A¤o_2024`, `Política` → `Pol¡tica`, `N°` → `Nø`. El contenido
  queda intacto, pero `_verificar-hashes.ps1` reporta "142 faltantes" y la skill `docs-empresa`
  deja de encontrar los archivos por nombre. **El diagnostico correcto es "fallan los nombres",
  no "faltan datos"** — leer la alarma al reves lleva a la decision equivocada en las dos
  direcciones. Se arregla re-extrayendo con `entryNameEncoding = CP850`, o en Python leyendo
  `nombre.encode('cp437').decode('cp850')`. Los 4 nombres con `–` (guion largo) y `™` no
  sobreviven ni asi: el ZIP los degrado al crearse; se recuperan del manifiesto UTF-8.
- **El paquete es una foto; el remoto sigue vivo.** El ZIP se cerro 13:19 y a las **13:28** se
  pusheo un commit mas (`0ca192cd`). No estaba ni en el paquete ni en el clon de la notebook.
  **Despues de restaurar, antes de tocar nada: `git fetch && git merge --ff-only origin/main`.**
- **`bash` no es Git Bash y el falso positivo es facil.** El chequeo "Git Bash en el PATH" pasa
  si lo corres *desde* Git Bash, porque hereda `/usr/bin`. En el PATH **real del registro**
  (`HKLM\...\Session Manager\Environment` + `HKCU\Environment`) la unica entrada de Git era
  `Git\cmd`, que no tiene `bash.exe`, y `bash` resolvia a `C:\Windows\System32\bash.exe` = el
  lanzador de WSL, sin distros. Los 15 hooks del repo arrancan con `bash ` y morian todos, en
  silencio, incluidos `push-guard` y `mcp-write-gate`. **Agregar `Git\bin` al PATH de USUARIO no
  alcanza**: Windows arma el PATH como maquina + usuario, asi que `system32` sigue ganando.
  Requiere admin sobre el PATH de maquina.
- **Ojo con los junctions al borrar un repo viejo.** `docs-local/` era un junction al OneDrive de
  la empresa. Borrar el repo sin sacar primero el enlace puede llevarse los 37 archivos del
  destino. Sacarlo con `[System.IO.Directory]::Delete($ruta, $false)`, verificar que el destino
  siga entero, y recien despues borrar. Y **recrear el junction en el repo nuevo**, si no se
  rompe todo lo que lea `docs-local/`.
- **Corolario de metodo, que es el mismo de la leccion de abajo:** el `RESTAURAR.bat` se anuncia
  como 6 pasos y no cubre 2 de las 9 carpetas (`05-DOCS-ONEDRIVE`, `09-CONFIG`); su chequeo de
  memoria cuenta sin recursion y **siempre** termina en rojo; y el `settings.json` que la tabla
  §1 manda copiar pesa 38 bytes y borra la config entera del Claude de destino. Un script de
  migracion escrito por el que se va hay que **auditarlo linea por linea** antes de correrlo.

### 2026-08-02 — "Ya esta sincronizado" no es una verificacion: verificar CUAL cuenta (CORRECCION DE FAK)
- Fak pidio migrar todo a una notebook nueva y aclaro *"recorda que OneDrive ya esta en mi otra pc"*.
  Di el Escritorio por cubierto. **Estaba en la otra cuenta de OneDrive.**
- El Escritorio y Mis Documentos estan redirigidos por KFM a la cuenta **PERSONAL**, **no** a la
  de la empresa. Fak no lo sabia: *"el personal jamas lo usamos"*. Y esa cuenta esta
  **`overLimit`** (5,2 de 5,0 GB del plan gratuito). Detalle en la memoria local
  `reference_escritorio_onedrive_personal` (no va al repo: el repo es publico).
- **Fak lo detecto antes que yo**, leyendo mi plan: *"osea las cosas de mi escritorio tambien las
  mudas entonces?"*. Cuando pregunta algo que mi plan da por resuelto, **es que el plan tiene un
  agujero**, no que no entendio.
- **Regla:** cuando Fak da por sentado que algo esta respaldado/sincronizado, verificar **cual
  cuenta / cual carpeta / con que numero**, no si el servicio esta prendido.
- **Como se verifica de verdad que OneDrive subio algo** (el icono de la bandeja no alcanza):
  un archivo creado local y nunca subido queda con atributos **planos** (`0x20`), sin reparse
  point de Cloud Files. Enumerar atributos **no hidrata**; leer contenido **si**. Filtro:
  `-band 0x400` (ReparsePoint), `0x400000` (RecallOnDataAccess), `0x100000` (RecallOnOpen) — los
  tres en cero = **nunca subio**. Sobre 63.567 archivos dieron 0, o sea estaba todo.
- **Trampa de robocopy sobre OneDrive:** `/XJ` **NO** filtra placeholders (solo trata MOUNT_POINT
  y SYMLINK, no el tag CLOUD). El flag correcto es **`/XA:O`**. Sin el, robocopy abre cada
  placeholder y **dispara la descarga**: medido, 17,18 GB solo en la cuenta de empresa.
- Otras dos que aparecieron en el mismo relevamiento y valen para cualquier copia masiva:
  `AppData\Local\Datos de programa` es un junction **a si mismo** (loop infinito sin `/XJ`), y
  `/R` por defecto es **1.000.000 reintentos x 30 s** = un archivo en uso cuelga el job ~347 dias.
- **Lo que un `git clone` se lleva puesto:** habia **213 commits** locales en
  `auto-mejora/2026-05-08T2233Z` y un `stash@{0}` que no estaban en el remoto. Antes de rearmar un
  entorno en otra maquina: `git log <rama> --not --remotes` y `git stash list` en **todas** las
  ramas, y `git bundle create ... --all` como red de seguridad (incluye `refs/stash`).

### 2026-07-31 (noche) — El video ES el pliego: pregunte tres cosas que estaban ahi adentro (CORRECCION DE FAK)
- Fak dejo en el Escritorio (`diseñar en 3d`) un video de WhatsApp y un archivo vacio llamado
  *"para el upper trimming"*. Le pregunte con AskUserQuestion en que zona, para que modelo y como
  hacia la fuerza. Respuesta: *"pero loco te hice un video, no podes pensarlo vos, es bastante
  evidente... mira las fotos, ¿no?"*.
- **Que hice mal:** trate el video como contexto y no como especificacion. Las tres respuestas
  estaban en el archivo: los fotogramas muestran la zona, el audio dice el mecanismo, y el nombre
  del archivo vacio dice la pieza.
- **Regla:** cuando Fak manda un video/audio, **extraerlo antes de preguntar nada**. Cuesta
  minutos y esta todo instalado en esta PC:
  - fotogramas: `av` (PyAV) en el **Python del sistema** (`python`, no `.venv-cad`);
  - **audio a texto: `faster_whisper` con `large-v3` YA cacheado** en `~/.cache/huggingface/hub`
    (`WhisperModel('large-v3', device='cpu', compute_type='int8', local_files_only=True)`) —
    ~2 min para 26 s de audio, en espanol argentino, sin internet.
  - No hay `ffmpeg` en el PATH: no perder tiempo buscandolo.
- Recien **despues** de eso, si queda una ambiguedad real de dominio, se pregunta — y con el
  trabajo ya avanzado y una imagen al lado, no antes de empezar.

### 2026-07-31 (noche) — Dos trampas del CAD que ya tienen herramienta
- **Buscar aberturas (ranuras, ventanas) en un STEP: son los LAZOS INTERNOS de las caras grandes.**
  `getBoundary` de la cara + union-find por puntos compartidos = instantaneo y sin mallar. `--find`
  de `analyze_step.py` esta pensado para grabados (caras finas) y con `--max-diag` grande devuelve
  un cluster gigante inutil. Para "como es la cara vista": scatter de los centroides de triangulos
  con normal +Z coloreados por Z — las aberturas aparecen como huecos, en segundos.
- **El entregable impreso NO va en coordenadas del cliente.** Exporte las dos piezas en
  coordenadas de vehiculo: llegan al laminador inclinadas y a metros del origen. Hay que
  entregar la pieza **apoyada plana en z=0 y centrada** (script `a_plano.py`:
  transformada inversa del frame local medido; el volumen tiene que dar identico, es el control de
  que no se toco geometria).

### 2026-07-31 — Tarde 1h20 en mostrar una foto: el barrido caro antes del camino barato (CORRECCION DE FAK)
- Fak pidio el 3D del Upper Trim (VW427/Cozzuol) "con el logo" y una foto para verificarlo. Tarde
  **1 hora 20 minutos**. Sus palabras: *"es demasiado lento todo lo que haces, exageradamente
  lento"*, *"¿donde carajo esta el logo?"*, *"ya parece que me estas peloteando"*.
- **Que hice mal:** me puse a mallar la pieza entera (hasta 9 M de triangulos, corridas de 5-10 min
  cada una) para buscar el grabado a ojo en renders. La respuesta estaba en dos lugares de
  segundos: (a) el PDF del RFQ que **el propio Barack** le mando al proveedor, que muestra el
  simbolo dibujado, y (b) la **topologia** del STEP (`getBoundingBox` de las caras = instantaneo).
- **Regla:** antes de procesar geometria, preguntarse si un **documento del legajo** o la
  **metadata** (bboxes, nombres de caras, tablas) ya lo responde. Y **mostrar el primer resultado
  util apenas existe**, aunque sea parcial — no acumular 6 pasos para una entrega perfecta.
  Si pide "una foto de X", el entregable **es la foto de X**; el analisis va despues y solo si lo pidio.
- Cuando pide agentes en paralelo, respetar el numero que dice (*"otros 3"*, no 59): le cuesta limite.
- **Trampa tecnica que me costo un dato mal:** `gmsh.model.removeEntities` no recorto como esperaba,
  segui mallando la pieza completa y termine comparando el simbolo contra la superficie clase A de
  alrededor en vez de contra su pad → me dio -0,700 mm (que es el rebaje del PAD) en vez de 0,000.
  **Verificar siempre contra la vecina TOPOLOGICA real** (`getBoundary` → quien comparte curvas),
  no contra "la cara mas grande que agarre".
- Hallazgo que vale guardar: **un grabado modelado como particion de superficie no lo dibuja ningun
  visor de solidos, solo CATIA** — por eso Fak lo veia unicamente ahi. Detalle completo del caso
  (rutas, tags de caras, cotas, profundidad TBD) en la memoria `reference_logo_uppertrim_vw427`.
- **CIERRE (misma sesion, commit `e798a7b5`):** al llevar esto a la herramienta aparecio la causa de
  fondo, peor que la lentitud: **`cadlib.geom._load` importaba con `highestDimOnly=True`** (el
  default de gmsh), que descarta las caras LIBRES. En este STEP son 189 caras — y ahi vive el logo.
  Verificado a mano: con el default entran 2548 caras y el simbolo da **0/5**; con
  `highestDimOnly=False` entran 2737 y da **5/5**. O sea que **todos los CLI del skill venian
  ciegos a los grabados imprentados**: ningun render los podia mostrar, por mas triangulos que les
  pusiera. Mi script ad-hoc los vio de casualidad porque use `gmsh.merge`, que carga todo.
  Ahora hay `cadlib/topo.py` + las sondas `--find/--zone/--neighbors/--offset` de `analyze_step.py`:
  encuentran el feature **sin saber ningun tag** y lo miden en **14 s** (test de aceptacion
  `topo_acceptance_test.py`, 22,8 s; smoke 8/8). **Leccion de metodo: cuando algo "no aparece" en
  el 3D, sospechar del IMPORTADOR antes que de la busqueda.**

### 2026-07-31 — La sintesis va ANTES de tocar cosas de Fak (CORRECCION DE FAK)
- Me puse a construir la regla de archivado del Escritorio (script + hook + tests) y Fak me
  corto a mitad: *"tenes que explicarmelo de una forma sencilla de entender asi apruebo...
  osea sintesis asi apruebo"*. Y enseguida: *"no entendi en donde vamos a guardar esas cosas
  ¿en tu codigo? ¿en onedrive? ¿en donde?"*.
- **"Hacelo y reporta" aplica al REPO. Sus carpetas (Escritorio, OneDrive, Y:, ERP) van con
  sintesis corta y OK previo.** No se contradice con "nunca preguntar ¿queres que haga X?":
  ahi hablamos de mi trabajo, no de mover cosas suyas.
- La sintesis que funciono: **que hay hoy en numeros → que criterio propongo → que muevo
  exactamente hoy → ¿le doy?**. Cuando hay dos destinos posibles (repo publico vs OneDrive),
  **dibujar el arbol de carpetas**; con eso lo entendio de una.
- Detalle tecnico que casi me hace pasar un test por el motivo equivocado: los payloads de
  hook escritos a mano en el shell **colapsan los backslashes de Windows**, el hook cae en su
  rama de fallback y el test da verde igual. Los payloads de test se arman con
  `JSON.stringify`, nunca a mano.

### 2026-07-31 — Mirar el destino ANTES de diseñar donde archivar (CORRECCION DE FAK)
- Diseñe todo el archivado de tareas contra el Escritorio/OneDrive personal. Fak: *"no lo
  quiero en el escritorio y el one drive es aca el de la empresa jamas el personal"*.
- Al abrir la biblioteca real se cayo medio diseño: esta organizada **por tipo de documento**
  y bajo control documental (LISTADO MAESTRO I-IN-001, carpetas OBSOLETO). Archivar ahi la
  carpeta entera de una tarea **habria duplicado documentos que ya tienen casa** — el mismo
  problema de "un PN, una BOM vigente". **Un destino no se elige por nombre: se abre y se
  mira como esta organizado.**
- De ahi sale la regla: una tarea cerrada tiene dos mitades. El ENTREGABLE ya esta en su
  carpeta por tipo (eso ES haber terminado); se archiva solo el RASTRO, y el listado dice
  DONDE quedo el entregable.
- **Hay dos arboles paralelos por tipo** (`Y:\...\Documentacion Gestion Ingenieria\` numerado
  vs `1- GENERAL\` de la biblioteca) con contenido distinto. Y: es el maestro.
- Tres falsos positivos del guard que valen como patron: **`del` es alias de borrado y a la
  vez preposicion en español** (bloqueaba mis propios commits que decian "del Escritorio");
  los flags de `rd /s /q` se meten entre el verbo y la ruta (no bloqueaba un borrado real); y
  un test corrido sin cooldown medi­a el recordatorio en vez de la rama que queria medir.
  **Al escribir un guard, los vectores negativos (prosa en español) importan tanto como los
  positivos.**

### 2026-07-30 — Patrones de corte: el APLOMO va primero (CORRECCION DE FAK)
- Fak, al pasar: *"para mover los puntos primero debes asegurarte que el patron este derecho,
  mirandolo de frente apoyado sobre los bordes de abajo... no puede estar chueco sino se va a
  mover en diagonal"*. **Tenia razon y yo ya habia movido puntos sin chequearlo.**
- La **posicion 0** de la pieza es la recta sobre la que APOYA en la mesa = los 2 puntos del
  **envolvente convexo inferior**. Todo movimiento se mide desde ahi.
- **Trampa de medicion en la que casi caigo:** ajustar una recta por minimos cuadrados al borde
  inferior. Ese borde es CURVO, asi que el ajuste devuelve la curvatura, no el giro — me daba
  "CHUECO" en las 4 piezas cuando en realidad la mitad estaba a plomo. Un orden de magnitud de
  diferencia, y la medicion mala habria disparado un rework innecesario.
- Cerro bien porque **medi el impacto en mm en vez de discutir el veredicto**: un angulo chico
  mete centesimas de mm en un movimiento de pocos mm → irrelevante, y esas piezas quedaron
  validas; las que estaban a varios grados hay que enderezarlas antes de tocarlas. **La regla
  util no es el veredicto, es el error en mm que introduce.** (Los angulos y coordenadas reales
  de cada pieza: `.sgc-cache/patrones-corte/ESTADO_INSERT.md` — no van al repo, es publico.)
- Codificado: `gate_aplomo()` / `linea_de_apoyo()` en `patronlib`, regla `patrones-corte.md`,
  hook `patrones-guard.sh`, y `entregar()` que **no escribe el PLT** si el aplomo da CHUECO.
  Selftest: `patronlib_selftest.py` (7 casos, mide rotaciones con error 0.000000).
- **El patron de corte es una COMPENSACION, no un objeto geometrico (Fak dixit 30/07).** Textual:
  *"las estamos ajustando en base a como las tira la maquina, no podemos simplemente espejarla"*.
  Yo venia empujando "hagamos que una mano sea el espejo exacto de la otra" — mal. Cada mano pasa
  por la maquina distinto, asi que **la correccion de una NO es el espejo de la de la otra**;
  espejar es copiarle a una mano un error que la otra no tiene. El ajuste es **lazo cerrado sobre
  lo medido**: medir la pieza real → comparar con spec → mover el punto → cortar → medir. La
  simetria entre manos es un CHEQUEO, nunca el objetivo. **Prueba dura:** al modelarlo, las dos
  manos pedian correcciones de **signo opuesto**.
- **🔴 UN CONTORNO DE CORTE ABIERTO 81,9 mm, Y MI LIBRERIA LO LEIA COMO SI CERRARA.** El patron
  del trasero izquierdo tenia el contorno de la capa CORTE **abierto**, y el pedazo que faltaba
  —una pestaña de 81,9 x 9,1 mm— dibujado en la **capa 0**. `leer()` tomaba solo CORTE,
  `escribir_plt()` cerraba el hueco **con una recta**, y el PLT cortaba **4,5 cm2 de menos**, hasta
  7,6 mm de profundidad. Ningun gate lo veia porque el contorno "cerraba" numericamente.
- **Y me hizo diagnosticar exactamente al reves.** Como la mano derecha SI tenia esa pestaña en
  CORTE, al comparar las dos manos concluí que **el derecho tenia un defecto** y le propuse a Fak
  "repararle el contorno" copiando el del izquierdo. Era al reves: el derecho estaba bien y el
  izquierdo era el que perdia material. **Cuando dos piezas espejo difieren, antes de declarar
  defectuosa a una, verificar que se este LEYENDO lo mismo de las dos** (mismas capas, contornos
  cerrados, misma cantidad de entidades).
- Lo que lo destapó: tres numeros que cerraban solos. Los extremos de la capa 0 pegaban a
  **0,0000 mm** con los extremos del contorno; el alto pasaba de 217,544 a **221,347 = exactamente
  el de la otra mano**; y la LINE de capa 0 medía **69,616 mm = identico** al tramo que yo llamaba
  "piso de la muesca". Tres coincidencias exactas no son coincidencia.
- Codificado: `patronlib.leer()` levanta `ContornoAbierto` si hay geometria en otras capas cuyos
  extremos peguen con los del contorno (detector fuerte, no el hueco a secas: un cierre corto es
  normal). Verificado: rechaza el archivo roto, deja pasar los 4 sanos.
- **🔴 PUSE UN SIGNO AL REVES Y ENTREGUE LOS PATRONES INVERTIDOS.** La regla real (Fak dixit, y ya
  estaba escrita en la guia del agente anterior y en el PPTX del 28/07): **para SUBIR la costura
  hay que BAJAR los puntos** — el punto baja en el patron, la pieza queda empujada hacia arriba y
  la costura se va con ella. Yo puse lo contrario.
  **Causa raiz:** lei *"21 mm en el arranque contra 18-19 mm en la punta"* como un **antes/despues**
  cuando son **dos lugares de la misma pieza** (un gradiente espacial). Con eso "confirme"
  empiricamente un signo que contradecia las tres fuentes escritas — y en vez de frenar ante la
  contradiccion, le crei a mi lectura. **Antes de derivar un signo o un coeficiente de unos
  numeros, verificar que sean un antes/despues de la MISMA pieza y no dos posiciones.**
  Y cuando un calculo propio contradice a la documentacion Y al usuario, el que esta mal soy yo.
- **Corolario:** tambien estime el factor k comparando una mano contra la otra. Invalido por la
  misma razon por la que no se pueden espejar: son piezas que pasan por la maquina distinto, asi
  que esa diferencia no mide el efecto del punto. **Un coeficiente fisico solo sale de un
  antes/despues de la misma pieza.**
- **Lo que si funciono:** la verificacion geometrica dio una pista independiente y la ignore — con
  el signo malo, la correccion empujaba una cruz a 1,45 mm del filo con 2 de 4 puntas afuera; con
  el signo correcto la aleja a 2,42 mm con 0 afuera. **Cuando la correccion "correcta" empeora la
  geometria, sospechar del signo.**
- **Simular antes de prometer.** Modele la sensibilidad (cuanto se mueve la costura por cada mm de
  agujero) y aparecio algo que no se veia razonando: dos estaciones de medicion con normales
  parecidas **responden casi igual a cualquier movimiento del punto**, asi que una diferencia
  entre ellas es **irreducible por punto**. Si no calculas la sensibilidad primero, prometes una
  correccion que no existe. Herramienta: `costuralib.py` en el skill.
- **LA MAS CARA — invertí una direccion que Fak me habia dado explicita.** El me dijo hacia que
  lado mover los puntos. Mi chequeo de distancia al filo daba alarma (el punto caia por debajo
  del rango sano) y **apliqué lo contrario en vez de mostrarle la tabla y preguntar**. Entregue
  el patron al reves; lo detecto el mirando la imagen. **Un chequeo automatico FRENA, no
  DECIDE.** Lo que Fak dice que hizo fisicamente es dato duro; mi heuristica es una hipotesis.
  Cuando chocan, gana el dato y yo pregunto.
- Y la alarma era un **falso positivo con explicacion de negocio**: el punto ancla la pieza, asi
  que la costura se corre en sentido CONTRARIO al punto — *para que la costura vaya a la
  izquierda, el punto va a la derecha* (Fak dixit 30/07). Que el punto se acerque al filo era
  exactamente lo buscado. Lo correcto era reportar la **consecuencia medida** (distancia al filo
  y cuantos de los 4 extremos de la cruz quedan FUERA del contorno → la X se corta contra el
  borde) y dejar que decida el.
- **Agravante de metodo:** dejE mi inferencia equivocada ("Fak mira la hoja izquierda girada
  180 grados, su derecha es el -X") escrita **como hecho confirmado** en el skill, en el hook y
  en la memoria. Una suposicion mia disfrazada de dato verificado, que habria envenenado todas
  las sesiones siguientes. Regla: lo que infiero se escribe como inferencia con su evidencia;
  solo lo que Fak confirma se escribe como hecho, con "Fak dixit" y fecha.
- **Bug en mi propio enforcement:** el cooldown de `patrones-guard.sh` usaba `${TMPDIR:-/tmp}`,
  que en el entorno del hook viene distinto, asi que el recordatorio se disparaba en CADA
  llamada en vez de 1x/h. Corregido a `$HOME/.claude/patrones-guard.flag` con validacion de que
  el valor leido sea numerico. Un guard que grita siempre se vuelve ruido y se ignora.
- **Tercera correccion del mismo dia:** deje un `BITACORA.md` DENTRO de la carpeta de trabajo de
  Fak. El me lo marco: *"por que pusiste un md en esa carpeta? los md no deberias almacenarlos
  vos en tu propia carpeta?"*. Dos errores en uno: (a) en sus carpetas va **el entregable exacto
  y nada mas** — regla que ya estaba escrita; (b) `.md` es un formato MIO, el abre archivos con
  las apps de Windows y un `.md` no lo va a mirar. Lo habia justificado con que "el registro
  tiene que viajar con los archivos", que es cierto para un legajo — pero entonces va **PDF**,
  no markdown. Reparto correcto: entregables en su carpeta, registros en `.sgc-cache/`.
- **Segunda leccion del mismo dia, mas cara:** identifique el par de patrones por geometria
  (contornos espejo exacto + asimetria uniforme corregible con un corrimiento) y di con los
  DELANTEROS. Fak dijo tres veces que eran los TRASEROS. **Tenia razon el.** La geometria
  descarta candidatos, no confirma cual es: solo el que hizo el movimiento fisico sabe sobre
  que pieza lo hizo. Rehacer sobre lo que dice Fak, no defender el analisis propio.

### 2026-07-30 — Metodo: medir el ARTEFACTO PUBLICADO, no el codigo ni el build local
- Para saber si un secreto estaba expuesto, lo unico concluyente fue **bajar el bundle que
  sirve GitHub Pages** (`curl` sobre `assets/index-*.js`) y buscar el VALOR ahi. El `dist/`
  local NO lo tenia (se habia buildeado sin esa variable), asi que mirar local habria dado un
  falso "esta limpio"; y leer el codigo fuente tampoco alcanza, porque el valor lo inyecta el
  build de CI. **El artefacto que consume el usuario es el unico que dice la verdad.**
- Dos trampas de medicion que casi me hacen reportar mal: (1) `grep -c` sobre un bundle
  minificado devuelve cantidad de LINEAS, no de matches — con un archivo de 1 linea, "1" no
  prueba nada; usar `grep -oF | wc -l` + un control con una cadena imposible. (2) Buscar el
  NOMBRE de la variable matchea el texto del mensaje de error, no el secreto: buscar el valor.
- Generaliza a: xlsx/pdf entregados (abrir el archivo final), datos en Supabase (query live),
  y cualquier "esta arreglado" sobre algo que se compila o se transforma antes de llegar al uso.

### 2026-07-29 — El repo publico tenia 828 documentos de la empresa versionados (DECISION DE FAK)
- Verificado con la API de GitHub: `facussc24/tiempos-y-balanceos` es **`"private": false`**. Se
  descargo `docs/REFERENCIA_CP_ORIGINALES.md` por `raw.githubusercontent.com` **sin autenticacion**
  (HTTP 200, 71 KB) con codigos de hilo reales adentro. No era una hipotesis: estaba publicado.
- `docs/empresa-extracted/` tenia **828 archivos / 259 MB**: 341 de IATF-2025, 175 specs de
  cliente, 84 instructivos SGC, 70 alertas de calidad, 26 8D, 9 auditorias. Mas part numbers VW
  en 57 archivos versionados y nombres de proveedores (SMRC 20, Cozzuol 15, Novax 14, Sansuy 7).
- **El `.gitignore` YA tenia la regla escrita en tres lugares** (`docs-local/`, `.arb-cache/`,
  `.sgc-cache/`, todos con el comentario "repo es publico — NUNCA commitear"). La carpeta era
  anterior a esa regla y nunca se limpio. La regla existia; **faltaba el enforcement**.
- **Contexto de la decision:** Fak no puede pagar. GitHub Pages desde repo privado requiere plan
  pago, asi que "poner el repo en privado" no es opcion. **Pero repos privados son gratis** — lo
  que se paga es servir Pages desde uno privado. Solucion sin costo aplicada: el repo queda
  PUBLICO (Pages sigue andando gratis) y los documentos salen de git a `.sgc-cache/`, que ya
  estaba gitignoreado. Nada se borro: los 828 archivos siguen en disco.
- **Historial limpiado el mismo dia** (Fak: "si podes limpiarlo si queres", delego la decision).
  `git filter-repo --path docs/empresa-extracted --invert-paths` + `push --force-with-lease`.
  Resultado: 955 commits conservados, `.git` de **189 MB → 34 MB**, y el arbol de HEAD quedo con
  **el mismo hash exacto** (`c72fd353`) antes y despues — o sea que no se perdio ni un archivo del
  estado actual, solo se reescribio la historia. Backup previo: bundle de 185 MB con `--all`.
- ⚠️ **LIMITE QUE HAY QUE SABER: el force-push NO borra los objetos del servidor de GitHub.**
  Verificado despues del push: `raw.githubusercontent.com/<repo>/8106575/docs/empresa-extracted/...`
  **sigue devolviendo HTTP 200**. Los commits viejos ya no figuran en ningun listado ni en la UI,
  pero siguen accesibles para quien tenga el SHA exacto (y los SHA de repos publicos quedan en el
  archivo publico de eventos de GitHub). Para borrarlos de verdad hay dos caminos, los dos gratis:
  pedirle a GitHub Support que purgue las vistas cacheadas (es el procedimiento que documenta el
  propio GitHub para datos sensibles), o borrar y recrear el repo. **Fak decidio NO escribirle a
  GitHub (2026-07-29) y convivir con eso.** Cerrado, no reabrir salvo que el lo pida.
- **Part numbers: Fak decidio que NO son sensibles** ("no vamos a ser tan exagerados"). Estan en
  todos los planos que ya tiene el cliente. Por eso NO se tocaron los ~39 archivos que los
  contienen ni el skill `product-map`, que los necesita para funcionar. Lo sensible eran los
  documentos (alertas, 8D, auditorias IATF, specs de cliente), no la nomenclatura.
- **Regla:** antes de commitear, preguntarse si el archivo es dato de la empresa. Vale para el
  contenido de los archivos Y para el **mensaje del commit** (yo meti codigos de pieza reales en
  el mensaje de `8106575` el mismo dia que le explicaba a Fak que el repo era publico).

### 2026-07-29 — Un fix sin commitear estaba roto: arreglaba el sintoma y abria un agujero nuevo
- Al cerrar sesion encontre `scripts/_refreshArb.mjs` modificado y sin commitear (fix del parser
  de RELACIONES para no fusionar filas partidas). El diff se leia impecable, con comentario
  explicando el caso. **Corri el parser contra el TXT real y el codigo de hilo que el propio
  comentario decia rescatar NO estaba en el CSV de salida.**
- Causa: para detectar "fila real" el fix pedia solo codigo en la columna b+2. Las lineas de
  continuacion (`<resto desc> | <unidad> | <consumo> | <modulo> | <proceso>`) dejan el consumo
  justo en b+2, asi que se leian como fila de nivel 0 → **perdia 29 filas con codigo y ademas
  contaminaba `carry[0]`**, apareciendo un `prod_raiz` inventado (un fragmento de descripcion)
  en una fila de vinilo. Pedir codigo+descripcion
  tampoco alcanzo (la continuacion trae modulo y proceso). El discriminador que sirve es la
  **CANTIDAD**: la fila real trae numero en b+1, la continuacion trae ahi la unidad.
- **Metodo que lo encontro (reusable para cualquier parser):** no leer el diff — correr contra
  la fuente real y contar. Comparar los reglas candidatas midiendo sobre el archivo entero
  (viejo 6245 / desc 6299 / cantidad 6274 filas) y exigir un **control negativo**: "¿cuantas
  filas completas perderia esta regla?" → tiene que dar **0**. Verificacion final con diff
  antes/despues del CSV, no con los "chequeos de salud" del propio script (los 6 que tiene no
  detectaron nada de esto).
- **Regla:** un fix de parseo no esta terminado hasta correrlo contra el archivo fuente real y
  mostrar el before→after contado. Y trabajo ajeno sin commitear **no se commitea a ciegas**:
  se verifica primero: puede estar a medias.

### 2026-07-28 — Le arme a Fak un formato propio teniendo el formulario oficial del SGC al lado
- Fak pidio armar un estudio para demostrar que el punzon de la mesa de corte ubica mal el
  agujero de alineacion del Insert. Investigue bien el SGC, **le nombre los formularios oficiales
  con codigo y ruta… y despues le arme una planilla propia en openpyxl igual.**
- **Fak dixit: "memoriza que vos no inventas formatos a menos que te lo pida… la idea es usar
  los formatos oficiales de mi empresa no te parece?"** Tuvo que pedir que la borrara.
- **Verificar que un formulario existe NO es haberlo leido.** Cuando finalmente abri
  `I-AC-020.1 Aptitud del Proceso PpPpk A.xls` aparecieron requisitos que yo no habia previsto:
  **estabilidad, normalidad, sesgo (-1,1 a 1,1) y curtosis (2 a 4)**, determinacion del tamano de
  muestra y de la frecuencia, y grilla de carga fija (`B12:L32` en ESTUDIO PRELIMINAR, los mismos
  valores otra vez en `B13:L33` de SESGO Y KURTOSIS). Ningun formato inventado por mi iba a pedir eso.
- Barack esta certificado IATF: una planilla propia no tiene codigo, no esta en el `Catalogo SGC.xlsx`,
  no tiene control de revision y **no es registro auditable**. No se puede presentar como evidencia.
- **Regla:** antes de armar cualquier planilla/informe/formato, buscar el anexo oficial en
  `...\SISTEMA SGC\Instructivos\<AREA>\Anexos\` o `...\Procedimientos\Anexos\`, ABRIRLO (copia a
  scratchpad + Excel COM) y usar ese. Si de verdad no existe, decirlo con el listado del folder y
  el catalogo antes de inventar nada. Los .xlsx existentes de la empresa no los edito yo:
  instructivo celda por celda.
- Segundo error de la misma sesion: Fak estaba parado con el calibre y las piezas en la mano y yo
  seguia generando archivos. **"porque carajo estas haciendo un excel… ya tengo el calibre y los
  vinilos".** Cuando tiene la herramienta en la mano, primero la secuencia fisica de medicion.
- Memorias: `feedback_usar_formatos_oficiales_no_inventar`, `feedback_guiar_la_accion_fisica_primero`,
  `project_estudio_agujero_insert_patagonia`, `reference_openpyxl_excel2016_funciones`.

### 2026-07-28 — Puse el error propio de Fak arriba y escondi el de la maquina
- Fak necesitaba comunicar que **la mesa de corte corto todos los puntos fuera de posicion y hubo
  que fabricar plantillas para marcarlos a mano**. Yo le arme el mail con la desviacion de costura
  primero (que era causa del patron, o sea error propio) y la mesa en un parrafo suelto.
- **Fak: *"¿por qué en todo el cuerpo del mail ni en el asunto no le damos más importancia a que
  la mesa de corte me cortó todos los puntos mal y tuvimos que hacer plantillas?"***
- **El hecho mas fuerte no siempre es el que tiene el numero.** "Hubo que marcar a mano pieza por
  pieza" es impacto operativo verificable y pesa mas que cualquier Ppk. No hacia falta el estudio
  para comunicarlo.
- **Antes de ordenar un mail o un informe: preguntarse cual es el hecho que le sirve a QUIEN LO
  ESCRIBE.** Si un problema es propio y otro es de un tercero, el propio va despues y marcado
  como secundario ("Aparte de lo anterior"), no primero.
- Al mail final Fak le borro cuatro cosas mias: una promesa de accion futura que yo invente, un
  adjetivo de juicio ("no es sostenible"), un dato tecnico de mas (la tolerancia) y el cierre
  "Quedo atento". Detalle en memoria `feedback_entregable_no_lleva_mi_razonamiento`.

### 2026-07-28 — El deck que sale por mail no lleva mi razonamiento adentro
- Le arme a Fak 9 diapositivas que incluian mi encuadre ("son dos problemas, no uno"), el detalle
  metodologico de por que una cota no era medible, el plan de medicion, mis puntos debiles y los
  pendientes internos. **Fak: *"¿a quién le importa realmente? no pensás como una persona que va
  a recibir el mail y lee eso y no entiende nada"*** y *"¿para qué les sirve a ellos conocer mis
  puntos débiles o pendientes?"*.
- Lo rehice en **5 diapositivas**: el defecto con su medida · la causa con el historial · la
  correccion con lo que cambio · el archivo vigente. **Filtro: ¿esto lo necesita el que abre el
  mail, o lo necesito yo para justificarme? Si es lo segundo, va al chat.**
- Despues Fak lo edito y sus ediciones son el estandar real: corto la tabla de la correccion de
  5 filas a 2 (saco las consecuencias derivadas: largo, consumo, "el resto sin cambios"), borro
  el bloque de instrucciones al receptor, y **agrego dos graficos del contorno antes/despues
  superpuestos con zoom y flechas** — que yo no habia hecho.
- **Regla que me faltaba: cuando el cambio es geometrico, GRAFICARLO antes/despues superpuesto.**
  Vale mas que el numero. Tenia los dos DXF y no se me ocurrio.
- Detalle de las ediciones: memoria `feedback_entregable_no_lleva_mi_razonamiento`.

### 2026-07-28 — Encontre UNA causa y di por cerrado el caso; habia DOS problemas distintos
- Fak necesitaba justificarle al gerente que **la mesa de corte corta mal**. Encontre que el
  desvio de costura del Insert trasero derecho lo causaba un punto del archivo movido 8 mm, lo
  probe bien, y **concluí "no es la mesa, es el archivo"**. Eso le dejaba sin sustento lo que le
  habia pedido el gerente.
- **Fak: "es cierto que el trasero derecho tenia un pequeño desfase mio, mi culpa, pero en
  realidad salio mal la tirada general de hoy por ese error".** Y su propia foto ya lo decia:
  *"pese al error en los agujeros que se generaron en mesa de corte, los insertos traseros
  derechos generaron todos el mismo defecto de desviacion de costura"*.
- **Eran dos problemas con causas distintas**: la costura desviada (archivo, solo trasero
  derecho, identica en todas las piezas) y los agujeros (mesa, tirada general, variable). Yo los
  trate como uno y al probar el primero cancele el segundo.
- **Regla: haber probado una causa NO cierra el caso si el sintoma que reporto el usuario no
  queda explicado.** Antes de concluir, chequear que la causa encontrada cubra TODO el alcance
  del defecto (que piezas, desde cuando, con que patron). Si sobra sintoma, sobra causa.
- Corolario util que si sirvio: **defecto IDENTICO en todas las piezas = archivo o setup;
  defecto DISTINTO en cada pieza = maquina.** Sirve para separar sin medir nada.

### 2026-07-28 — El parser del arb quedo a medio arreglar: mejora 29 filas y rompe 1
- `scripts/_refreshArb.mjs` tiene cambios sin commitear de la sesion anterior. Los probe corriendo
  el parser viejo y el nuevo contra `C:\tmp\RELACIONES.TXT` y comparando los CSV: **29 de 6245
  filas mejoran** (el parser viejo le pegaba a la descripcion del hilo el codigo de OTRO producto),
  **pero 1 fila empeora**: el `prod_raiz` pasa a ser un fragmento de descripcion.
- Causa: el chequeo viejo era `g(r, b+2) && g(r, b+5)`; el nuevo dejo solo `g(r, b+2)`. En una
  linea de continuacion (`<fragmento> | <unidad> | <consumo>`) la columna 2 trae el consumo, asi que
  el nuevo la toma por fila con codigo. **NO COMMITEADO** hasta arreglar eso.
- Metodo que conviene repetir: para validar un cambio de parser, correr las dos versiones contra
  el archivo fuente real y **diffear la salida fila por fila**. Los contadores agregados (6245
  lineas, 58 fusionadas) dan IGUAL en las dos versiones y no detectan nada.

### 2026-07-28 — Arme un analisis entero sobre una premisa que nunca confirme, y era falsa
- Detecte que en los patrones del Insert las marcas de alineacion no estaban espejadas entre mano
  derecha e izquierda (6 a 10 mm de diferencia, con el contorno espejado al 0,000000000 mm). Lo
  di por hallazgo mayor, arme la imagen comparativa y dos diapositivas.
- **Fak: "no importa que las marcas esten distintas, si lo espejas es a proposito... estamos
  acusando a la mesa de corte no al archivo que NO ES ESPEJADO".** Todo ese tramo fue al tacho.
- **La premisa "si el contorno es espejo, las marcas tambien deberian serlo" era MIA, no del
  dominio.** Nunca la puse sobre la mesa como supuesto. Cuando una conclusion depende de una
  regla de negocio que yo inferi, hay que **enunciarla explicitamente y pedir confirmacion antes
  de construir encima**, no despues de armar el entregable.
- Segundo error del mismo tramo: reporte "la mesa de corte dispersa ~2 mm entre piezas"
  comparando lo medido contra la distancia marca→contorno del DXF. Dos de las cuatro marcas caen
  contra **bordes curvos** (radio ~600 mm y ~300 mm, sin tramo plano). En un borde curvo el valor
  cambia segun donde se apoya el calibre: esa dispersion era del metodo, no de la maquina.
  **Antes de comparar una medida contra un nominal de plano: verificar que el borde de referencia
  tenga tramo recto suficiente para apoyar el instrumento.**
- La causa raiz real la dio el historial del archivo, no la estadistica: el punto de anclaje se
  habia movido 8 mm el 23/7. **Regla de diagnostico: defecto IDENTICO en todas las piezas =
  archivo o setup; defecto DISTINTO en cada pieza = maquina.** Una mesa con juego no repite el
  mismo error nueve veces.

### 2026-07-28 — El formulario oficial I-AC-020.1 devuelve un Ppk FALSO si falta la especificacion
- Al cargar el estudio de aptitud del Insert en `I-AC-020.1 Aptitud del Proceso PpPpk A.xls`, con el
  campo Especificacion vacio el formulario devolvio **Pp = 0,00 y Ppk = 8,86**. No da error y no
  avisa: se lee como si el proceso fuera excelente.
- **Causa verificada en el propio libro:** `ISTEXT(I7)` da VERDADERO pero `I7+0` da **0** y
  `ABS("TBD"-0)` da **0** — el libro evalua el texto como cero en vez de tirar `#¡VALOR!`. Por eso
  poner "TBD" en la especificacion **tampoco** protege. Cadena: `INFORME!H5/I5` →
  `ESTUDIO PRELIMINAR!H7/I7` → `I42/I40` → `J44` (Pp) y `G47/G52/J50` (Ppk).
- Contramedida aplicada: aviso en texto rojo al lado de Pp y Ppk (`INFORME!G18` y `G19`).
  **Pendiente para Calidad: revisar los estudios ya cargados con este formulario.**
- La leccion general: un formulario oficial tampoco es confiable por ser oficial. Antes de reportar
  un indice, verificar que el numero se mueva cuando se mueve la entrada. Un valor que no cambia
  al cambiar la especificacion no esta calculando nada.

### 2026-07-28 — El Escritorio esta en OneDrive y descarta guardados por COM sin avisar
- Escribi el .xls con Excel COM en `C:\Users\facun\OneDrive\Escritorio\...`, `Save()` y `Close($true)`
  no dieron error, y la lectura en memoria devolvia los valores correctos. Al reabrir el archivo,
  **estaba vacio**: OneDrive habia pisado el guardado.
- Trabajar los archivos de Office en local (scratchpad) y **copiarlos al Escritorio recien al final**,
  verificando siempre reabriendo el archivo de DESTINO, no el de trabajo.

### 2026-07-28 — Las PCs de planta tienen Excel 2016: openpyxl escribe formulas que fallan MUDAS
- `STDEV.S`, `MAXIFS` y `MINIFS` escritas por openpyxl **sin el prefijo `_xlfn.`** dan `#NAME?`.
  Si estan envueltas en `IFERROR(...,"")` —lo natural para que la planilla se vea limpia vacia—
  **la celda queda en blanco y no avisa nada.** La planilla parece andar y no anda.
- Detectado solo porque abri el archivo con Excel COM y compare contra un calculo hecho aparte en
  Python. Abrirlo y mirarlo a ojo no lo detecta.
- Usar funciones clasicas (`STDEV`, `MAX`/`MIN` sobre bloques fijos de filas) y verificar con:
  copia + datos de prueba deterministas + `$xl.CalculateFullRebuild()` + barrido
  `UsedRange.SpecialCells(-4123, 16)`.

### 2026-07-27 — Descarte un hallazgo CORRECTO por mirar el encabezado en vez de los datos
- Un auditor independiente reporto que el offset del arbol de `RELACIONES.TXT` era +7 y que yo
  estaba parseando con +9. Lo **descarte** mostrando el encabezado del export, que efectivamente
  pone los titulos en las columnas 0/9/18/27. **Me equivoque: el encabezado y los datos tienen
  layouts DISTINTOS.** Las filas reales ponen el sub-articulo en la columna 7 (nivel 1) y 14
  (nivel 2) — offset **+7**, como decia el README.
- **Costo medido:** con +9 el parseo devuelve 5387 lineas; con +7, 6245. Se pierden **858
  sub-ensambles** (niveles 1 y 2 completos). El nivel 0 sale identico con los dos, asi que un
  chequeo que solo mire el nivel 0 NO detecta el error — por eso la verificacion de los vinilos
  dio bien igual (los 11 codigos estaban todos en nivel 0; reverificado con ambos offsets).
- **La leccion no es sobre el arb: es sobre como se refuta.** Cuando un verificador independiente
  contradice algo mio, la contra-evidencia tiene que ser del MISMO tipo de dato que el reclamo.
  El reclamo era sobre filas de datos; yo respondi con la fila de titulos. Sirvio para confirmar
  lo que ya creia, no para probarlo.
- Codificado en `scripts/_refreshArb.mjs` (parser unico, con los chequeos) y en el README de
  `.arb-cache/`. Memorias: `reference_arb_local_cache`, `feedback_leer_el_dato_completo_antes_de_afirmar`.

### 2026-07-27 — El codigo del cliente se carga TAL CUAL; el formato solo manda si no entra
- **Cierre de Fak: "hay que respetar lo que diga el cliente y punto."** Sansuy (Perticaro)
  mando los 10 definitivos pelados (`1246030198`…) y solo el naranja completo
  (`124.505.0372-7`). Se cargan pelados, tal cual. Frene la carga pidiendo el digito
  verificador —error—: Logistica estaba esperando esa carga para ingresar material.
- Antes habia hecho el camino largo: dije "falta el digito", encontre 3 insumos pelados en el
  maestro y me auto-corregi a "no es bloqueante", Fak me corrigio a mirar la distribucion
  (de 24 codigos `124*`, **21 tienen 14 car.** y 3 tienen 10 — uno de esos 3, `1246030228`,
  duplicado de `124.602.0228-1`), y el cierre real fue que el formato del maestro **no le
  gana al cliente**.
- **La sintesis que queda:** la distribucion de largos sirve para DEDUCIR como escribir un
  codigo cuando el sistema OBLIGA a adaptarlo, no para corregirle el codigo al cliente.
  Regla operativa: ¿entra en el campo? se carga tal cual. ¿No entra? recien ahi se aplica la
  convencion del maestro y se avisa. ARTICULO tope 15 car. — por eso el PN SMRC
  `00238887-04-V209` (16) se carga `0238887-04-V209`, con un cero menos, y los
  `00238887-04-V20` viejos son ese mismo PN con el `9` cortado.
- **Meta-leccion (2da vez): la regla canonica le gana al dato puntual** — un puñado de filas
  mal cargadas no redefine una convencion. Pero ojo: la convencion interna tampoco le gana a
  la autoridad del cliente. Memorias: `feedback_codigo_del_cliente_se_carga_tal_cual`,
  `feedback_ancho_campo_arb_es_identidad`.

### 2026-07-24 — Flujograma/HO NO viven en Supabase → van al legajo del server
- Pregunta de Fak por el flujograma del APB de Novax (Patagonia) y arranque buscando en Supabase.
  Correccion fuerte de Fak: "la decision correcta era el APQP; en Supabase NO tengo cargados los
  flujogramas; es un error de inteligencia". Barack no hace PFD/HO en la app (regla `no-pfd-no-ho`):
  los flujogramas y HOs reales son archivos del legajo/SGC en `Y:`. Routing correcto:
  HOs en `Y:\BARACK\CALIDAD\DOCUMENTACION SGC\HOJAS DE OPERACIONES\1- CLIENTES\<cliente>\<prog>\<pieza>\`
  (+ `2- SECTORES\` por proceso); flujogramas en el legajo de Ingenieria (`20- Flujograma`,
  `6-Diagramas de flujo`) o PPAP. Supabase solo para AMFE/CP, y aun asi el legajo manda para proceso.
  Detalle + memoria: `feedback_flujograma_ho_viven_en_legajo_no_supabase`. Caso: HO 971 APB Puerta
  ya tiene la inyeccion en op 50 (plasticas) y op 60 (PU) — `project_apb_puerta_novax_ho971`.

### 2026-07-24 — Monitores en background mueren con la sesion
- Un watcher de CI en background NO sobrevive al cierre de sesion/PC: prometi "te aviso
  cuando termine el deploy" y el aviso nunca llego — Fak creyo que el deploy llevaba 16 hs
  cuando habia terminado en 3 min (el run "cancelled" intermedio era el auto-cancel normal
  de GitHub al pushear un commit nuevo). Regla: para CI, chequear el estado DIRECTO y
  reportarlo en el momento; no prometer avisos diferidos salvo que la sesion siga activa.

### 2026-07-23 — NotebookLM RETIRADO → .sgc-cache propio (decision Fak)
- NotebookLM retirado por completo (ya estaba roto; Fak prefiere acceso directo a fuentes).
  Reemplazo: skill `docs-empresa` (mapa tema→documento real, rutas verificadas) + cache
  `.sgc-cache/` gitignoreado con extractos que citan `fuente:`+`rev:`+`extraido:`.
  Primera extraccion: Manual SGC completo + 19 procedimientos P-xx (rev mayor).
- Extraccion Word COM: copiar el archivo LOCALMENTE antes de abrir (.doc desde UNC cuelga
  Word — Vista Protegida) y usar `$doc.Content.Text` (SaveAs2-txt sale con encoding roto).
  Script: `scripts/_extraerSgc.ps1`.
- Los 8 notebooks viejos quedan en la nube de Google: no tocar, no citar.

### 2026-07-23 — Mantenimiento integral (auditoria de deuda + refactor CAD)
- Skill cad-design refactorizado: libreria `cadlib` + CLIs parametrizados con `--help`,
  UN interprete (`.venv-cad`, con rtree agregado), caso posicionador congelado en
  `examples/`. Gate DURO de entrega en `export_deliverables.py` (el hook solo recuerda).
- Candado CC/SC ejecutable en `runWithValidation` (bloquea `--apply` que AGREGA CC/SC;
  override `--allow-specialchar` solo con OK de Fak) + test en `__tests__/scripts/`.
- **SEGURIDAD: password de admin@barack.com estaba hardcodeada en `scripts/_archive/`
  (repo publico)** — archivos borrados; cambio de password + fixes RLS pendientes de Fak.
- **NotebookLM: los scripts globales y la registracion MCP NO EXISTEN mas** (verificado
  2026-07-23) — skills lo documentaban como vivo. RESUELTO el mismo dia: retirado (ver arriba).
- Practica 2026 para codigo generado con IA: auditoria de deuda cada ~2 semanas
  (agentes por area + verificacion manual de hallazgos; ~mitad de fixes fueron de docs
  que prometian enforcement inexistente).

### 2026-07-16 — Enforcement + meta-leccion
- Sistema de enforcement operativo (hooks SessionStart/consumos/push/validator/file-guard +
  `node scripts/_validarConsumos.mjs` + canon `scripts/_lib/consumosCanon.data.json`).
  Leccion nueva critica → candado ejecutable en la misma sesion, no prosa (skill `rule-enforcement-gate`).
- **Meta (incidente GKK/GKX):** al corregir una correccion, grep y actualizar TODAS las copias
  escritas de la version vieja (LECCIONES + memorias + docs), no solo la fuente principal.

### 2026-07-14/16 — Consumos y entregables (ya codificado)
- Todo el paquete esta codificado: regla `consumos-entregables.md` + skill `verificacion-consumos`
  + validador + canon JSON. Regla nueva de Fak → al canon EN LA MISMA SESION, con `fuente:`.
- Datos duros de planta no reglables viven en memorias: `project_p21_consumos`,
  `project_patagonia_carga_arb`, `reference_p703_consumos_verificacion`,
  `reference_tabla_consumo_mesa_corte`, `reference_arb_export_estructura`.

### 2026-07-14 — BOMs telas planas MHV (arb)
- "Aplix" = fijacion MAGNETICA al molde (= carga magnetica / iron load / MCA — NO distinguirlos,
  molesta a Fak); solo importa la CANTIDAD; cada aplix = 0,000256 m². Telas planas van DIRECTO
  a PT (sin semiterminado COR; los COR huerfanos → BAJA). BOM de terceros: verificar TODO contra
  planos (copy-paste real detectado). Detalle: memoria `project_boms_pwa_mhv_arb`.

### 2026-07-08 — Ciclo de vida AMFEs
- Sistema entregado (registro maestro, caratula, change-log, `_oficializarRevision.ts`) —
  detalle: memoria `project_amfe_lifecycle_system`. Nombres de archivo AMFE migran a LETRAS
  (decision Fak); no churnear nombres ya buenos.
- Tabla Supabase nueva = MCP `apply_migration` + replica DDL en `database.ts` (`CONFLICT_MAP`;
  si BIGSERIAL, `BIGSERIAL_TABLES`; el test de database cuenta CREATE TABLE — subir el numero).
- **NPR esta deprecado — hoy es AP (AIAG-VDA).** Manual interno I-AC-005 con "NPR>100" =
  info vieja; gana la practica de Fak. CC/SC sigue siendo solo de Fak.

### 2026-07-07 — Exports a cliente (Gate3 VW)
- Template externo: revisar TODAS las hojas (visibles y ocultas) buscando datos de ejemplo antes
  del primer envio (el gate3 salio a VW con el ejemplo aleman visible).
- xlsx-populate NO calcula caches → abrir y guardar con Excel (COM) antes de enviar. Si conviven
  2 metricas de carga, el LEEME explicita ambas. Detalle: memoria `reference_gate3_shared_machines`.

### 2026-07-06 — Inyeccion / capacidad de planta
- Tabla `projects`: `data` es STRING JSON (columna TEXT) — stringify SI aca, al reves que
  `amfe_documents`. Carga de tiempos: skill `apqp-schema` + memoria `project_registro_tiempos_inyeccion`.
- horas_maquina = golpes (TIROS reales) × ciclo — SIN cavidades; piezas = golpes × cavidades.
  Un numero que a Fak "le parece raro" puede ser real: verificar aritmetica Y supuestos antes de
  defenderlo (su intuicion es buen detector de errores de modelado). No re-preguntar datos ya dados.

### 2026-07-02/03 — IP PAD + calibracion AMFE
- L2 IP PAD = **GKK** (no GKX; confirmado arb+BOM006+revisor). Detalle: memoria `project_ippad_amfe`.
- Severidad = efecto en el USUARIO (el scrap sube ocurrencia/costo, no S). AIAG-VDA S9-10 SI cubre
  seguridad del OPERARIO (no "corregir" a la baja). O=10 con controles declarados es indefendible
  (error humano con instruccion+autocontrol ≈ O6). Calibraciones dudosas → multiples agentes contra
  el manual AIAG-VDA, no rebotarle la pregunta a Fak.

### 2026-07-02 — Editar Supabase desde esta PC (sin .env.local)
- `C:\Dev\BarackMercosul` NO tiene `.env.local` → no corren `_backup.mjs` ni `runWithValidation`.
  Se edita via MCP Supabase `execute_sql` (rol postgres, bypassa RLS). Backup previo = tabla
  `_backup_<doc>_<fecha>` via `CREATE TABLE AS`. Cirugia jsonb por lotes chicos + verificacion SQL pre/post.
- Recalcular AP con PL/pgSQL que replique `calculateAP` (apTable.ts). NUNCA S*O*D.
- SQL generado: strings con comilla SIMPLE (`"..."` en Postgres es identificador).
- Export Excel oficial por script node (`scripts/_exportOficial.ts`, usa `buildAmfeCompletoWorkbook`),
  NUNCA desde la app — Fak no exporta desde la app.

### 2026-06-26 — Candados + repos "estilo SQLite" que escriben en la NUBE
- Regla-en-prosa critica → check ejecutable en el gate existente (skill `rule-enforcement-gate`).
  Verificar el workflow real de Fak antes de elegir solucion. Deferido a proposito:
  `CONTROL_NOT_AUTHORIZED` (necesita whitelist con input de Fak); 16 warnings CLAUDE_PHRASE
  legacy (limpiar solo con OK de Fak).
- `settingsRepository`/`projectRepository`/`draftRepository` escriben en la NUBE: `getDatabase()`
  devuelve `SupabaseAdapter` (utils/database.ts) → RPC `exec_sql_read`/`exec_sql_write`.
  `exec_sql_write` falla SILENCIOSAMENTE con INSERTs complejos → despues de cada seed/insert,
  verificar con SELECT directo. `usePlantAssets` persiste en `settings` clave `plant_assets`.
- Podados 2026-06-26 con OK de Fak: kanban/heijunka/mizusumashi/logistics-backlog (no resucitar).

### 2026-06-26 — Scorecard "AMFE listo" (readiness ≠ validez)
- "Datos validos" (gate de `--apply`) ≠ "entregable". `node scripts/_readiness.mjs --summary`
  da el verdict por AMFE en el momento — NO afirmar entregabilidad desde este archivo.

### 2026-06-25 — Import Excel a mano + export oficial
- El Excel de Fak ES el estandar AIAG-VDA 2019; los merges NO son confiables → asignar cada FM a
  su operacion POR CONTENIDO, no por posicion. Rev AMFE >= rev del PC (en letras). JSON >10KB a
  Supabase: SERVICE_ROLE por variable de entorno a `_insertAmfeService.mjs` (nunca a archivo);
  verificar md5 + que `data` es objeto. Scripts reusables: `_parseAmfeXlsxAmarok.mjs` y familia.
- Export oficial: checklist completo en skill `amfe-export-oficial` (campos EXACTOS de caratula;
  Responsable = Carlos Baptista, Aprobado por = Gonzalo Cal). SIEMPRE abrir el .xlsx generado
  antes de entregar (regla `verify-before-close.md`).

### Gotchas tecnicos vigentes (no codificados en reglas)
- **Keyword-regex amplio para calibrar severidad genera ~90% falsos positivos** (25/28 en 2026-05-17).
  Antes de un fix masivo por heuristica: leer contexto real caso por caso. Listas canonicas +
  normalize, no regex parcial.
- **Severidades de fallas comunes entre los 3 Headrest siguen inconsistentes** (ej. "Puntadas
  irregulares": HF S=6 / HRC S=3 / HRO S=8). Pendiente alinear con equipo APQP.
- Pendientes historicos de datos (FM flamabilidad Telas Planas, part numbers PWA, gramajes) viven
  en el historico — verificar contra Supabase live antes de retomarlos.
- Antes de crear un script: mirar tambien `scripts/_archive/` por si existe uno reutilizable.

## Como agregar lecciones nuevas
- Agregar la entrada ARRIBA (mas nueva primero) dentro de "Lecciones operativas vigentes",
  formato `### fecha — titulo` + 2-4 lineas maximo: leccion accionable + como aplicarla.
- Si la leccion amerita regla durable → crearla en `.claude/rules/` CON enforcement ejecutable
  (skill `rule-enforcement-gate`) y dejar aca solo 1 linea de referencia, sin duplicar.
- Cuando este archivo supere ~15 KB: mover lo ya codificado al historico en `docs/_archive/`.

### 2026-08-07 — Un control puede dar verde sin haber mirado nada
Verificando que una tuerca impresa enrosca en su tornillo, barrí la tuerca por el eje **cada
0,5 mm sobre una rosca de paso 1,0 mm**. Dio 0 mm³ de interferencia girando bien y **0 mm³
girando al revés**. Parecía un éxito rotundo; era un control ciego: con muestreo = paso/2 los
dos sentidos caen exactamente en las mismas poses. Con incremento 0,137·paso, el mismo control
dio 0 girando bien y 7,5 mm³ girando al revés — recién ahí el 0 significaba algo.

- **En todo barrido sobre algo periódico** (roscas, hélices, engranajes, patrones repetidos)
  el incremento NO puede ser fracción simple del período. Lo detectó el propio gate porque
  llevaba el caso que DEBE fallar; sin eso me lo llevaba puesto.
- **La copia literal no es el diseño correcto.** El original era M4 paso 0,7; copiarlo tal
  cual en plástico no enrosca (la holgura que pide el FDM se come el 40 % del filete). Se
  mantuvo el diámetro —que es lo que tiene que seguir pasando por el agujero— y se subió el
  paso a 1,0. Copiar el número equivocado es tan malo como inventarlo.
- **Caras coincidentes = sólido no estanco.** Pegar la rosca a la cabeza con la cara de
  arranque coplanar con el cuello dio 663 bordes abiertos y un STL que no lamina, con el
  sólido reportando `is_valid=True`. La validez del CAD no garantiza que el STL cierre:
  hay que medir estanqueidad sobre el archivo que se entrega.
