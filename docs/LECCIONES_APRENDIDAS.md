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
