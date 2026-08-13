# Lecciones Aprendidas — Barack Mercosul APQP (destilado vivo)

Archivo mantenido por Claude Code. Se lee COMPLETO al inicio de cada sesion, por eso
contiene SOLO lo accionable que NO esta ya codificado como regla o gate ejecutable.
La historia completa de cada incidente vive en los snapshots.

- **Historico completo** (2026-03-30 a 2026-07-02): `docs/_archive/LECCIONES_APRENDIDAS_2026H1_completo.md`
- **Snapshot pre-poda 2026-07-23**: `docs/_archive/LECCIONES_APRENDIDAS_snapshot_2026-07-23.md`
- **Snapshot pre-poda 2026-08-09** (detalle integro de todo lo destilado abajo): `docs/_archive/LECCIONES_snapshot_2026-08-09.md`
- **Tabla incidente → regla**: `docs/_archive/INCIDENTES_REGLAS_AMFE.md`
- Lo ya codificado NO se repite aca: reglas de `.claude/rules/` y sus gates ejecutables
  (amfe.md + amfeValidator, database.md, verify-supabase-live.md, no-pfd-no-ho.md, techo-agentes.md, cad-3d.md).

## Verificacion y evidencia

- **12/08 — Le afirme a Fak que 112 caras sueltas eran el vinilo, y eran DOS capas.** 74 caras (99 % del area) estan a un offset constante de **0,5000 mm** y solo 10 —las paredes de la ranura— a 0,9692. Cualquier cota tomada fuera de la ranura arrastra 0,5 mm por lado, y ese 0,500 que ya habia aparecido en las mesetas de apoyo era esto. **Un grupo de caras libres no es UNA cosa: hay que agruparlas por OFFSET, no por conectividad** (las 112 son un solo shell conexo, y agrupadas por topologia el promedio no es ninguno de los dos valores). Queda `clasificar_caras_libres.py`, que separa CAPA DE MATERIAL / SUPERFICIE DE CONSTRUCCION / GEOMETRIA REAL con dos mediciones que no comparten codigo (proximidad y rayos) y sale con codigo 2 si no puede clasificar.
- **12/08 — Un mensaje de rechazo que culpa al filtro equivocado cuesta mas que el rechazo.** El buscador decia "no se cubre 70..200 kPa sin huecos" y el que rechazaba las 87 geometrias era un tope de precarga de 0,90 mm, por 0,02. Media hora buscando en el lugar equivocado. Ahora `cadlib.pipeline.Criba` **exige nombrar el filtro y el valor** para rechazar (un rechazo anonimo es TypeError) y revienta si los conteos no cierran.
- **12/08 — Cuando un script aborta, su salida ANTERIOR queda intacta y el paso siguiente la usa.** Paso tres veces en una cadena en segundo plano: el contrato daba "1 solo rojo" sobre la pieza equivocada. `cadlib.pipeline` renombra la salida a `.ABORTADO` con el motivo adentro, distingue "el proceso murio" de "aborto", sella las entradas con sha1 (el mtime solo miente) y **propaga la contaminacion**: una salida impecable cuya entrada esta podrida sale marcada. Era el agujero exacto — el archivo mas nuevo de la carpeta estaba construido sobre una corrida abortada.
- **12/08 — Una constante sin procedencia es una decision de diseno que nadie tomo.** Un tope de 0,90 mm en dos archivos, un piso de 40 kPa, un "SF >= 1,5" que traducido pedia 9 anos de vida a un consumible de 28 g. Y lo peor de la auditoria: **dos limites de fatiga distintos para el mismo PLA en el mismo skill (6,1 y 10,0 MPa, 1,64x)**, con `viga_voladizo.py` contradiciendo su propio docstring. Queda `cadlib.criterios`: la fuente es keyword-only sin default, un criterio sin procedencia no puede RECHAZAR (solo avisa), y uno DURO sin traduccion a unidad humana revienta.
- **13/08 — Evidencia documental para un mail: elegir la cita INEQUIVOCA y buscar el periodo que me contradice.** Cite "avancemos de esta forma (…) en las unidades habituales" — para compras las habituales son METROS: probaba lo contrario. El explicito ("seguimos con los consumos como hasta ahora, **En M2**", con el destinatario en copia) lo encontro un agente independiente. Y casi afirmo "siempre fue en m2" cuando en 08/2024 lo cargo Fak en METROS con 10 % de margen. **Leer la cita como la leeria el que no la quiere aceptar; buscar el periodo que la contradice antes de que lo encuentre el otro.**
- **13/08 — Afirme el modelo de un subagente sin verificarlo** ("lo lance en Fable 5" cuando solo lo habia PEDIDO): se verifica en `tasks/<id>.output` (`"model":`). **Un parametro aceptado no es un hecho ejecutado.**
- **10/08 — Fak encontro en el visor dos defectos que 17 controles verdes no vieron.** (a) El ensamble ENTREGADO salio con el panel a medias — armado con el cargador que descarta caras libres, faltaban las paredes internas de la ranura. Tercera aparicion del mismo bug y la primera que llego a sus manos. (b) El macho, descentrado 0,086 mm del centro REAL de la ranura: un flanco apretaba 0,17 mm menos. **Todo archivo que se entrega para mirar se arma con el mismo cargador con el que se mide**, y el centro de una cavidad se MIDE, no se hereda de un json de otra sesion.
- **10/08 — Un corte de verificacion cayo justo sobre un canal y dijo "no aprieta".** Los canales de despegue estan cada 2,5 mm y el medio EXACTO del dedo cae sobre uno: el hueco salio 0,3 mm mas grande y el dibujo contradecia al calculo. Misma familia que el aliaseo de barridos: **el punto de muestreo nunca en el centro de una feature periodica**.
- **10/08 — "Abarrilado" era desmoldeo.** La ranura varia 0,44 mm, pero NO a lo largo (entre dedos hay 0,05): varia con la PROFUNDIDAD, 3,1 grados de desmoldeo. Un dedo recto toca en el punto mas profundo de su banda. Antes de compensar una variacion hay que saber **en que eje** ocurre, o se corrige lo que no era.
- **10/08 — Un utillaje de virolado interfiere contra el LAMINADO, no contra el sustrato.** Tocando el plastico, el dedo flexiona los 0,92 de tela enteros = 1,81x el admisible a fatiga (**vida 4 dias**), y dos solidos rigidos en contacto vuelven la presion INDETERMINADA: el hueco ES el espesor de trabajo. Pero el reclamo tenia razon en el fondo — **toda la presion colgaba de un espesor de tela que nadie midio** (con -30 % cae a un cuarto). Se cubrio con variantes de macho por espesor.
- **10/08 — El cargador de STEP descartaba en silencio las caras libres, y ahi vivia la cota.** El default de gmsh (`highestDimOnly=True`) tiraba las paredes internas: el rayo media la envolvente (12,96) creyendo medir la luz (11,04), y el utillaje apretaba 4x. **Tres mediciones "independientes" mias dieron el mismo error porque compartian el cargador** — repetir una medicion no la valida si comparte la fuente del error; lo cazo una revision a ciegas sin mi numero. Arreglado en `cadlib.geom` + `check_collision`. Ojo: una cara libre tambien puede ser superficie de construccion.
- **10/08**: Un criterio adimensional esconde la decision. "SF fatiga >= 1,5" traducido son **9 anos** pedidos a un consumible impreso de 29 g con galga de desgaste. La barra pasa a **VIDA en anos**. Cambiar la FORMA del criterio y escribir por que no es bajarla; lo segundo se nota porque no se puede explicar.
- **10/08**: Dimensionar contra el promedio reparte mal el dano — con la mediana de la ranura, **un solo dedo se come toda la fatiga** (vida 2,0e5 → 7,4e4). Se dimensiona contra el punto MAS EXIGENTE: cambia variacion de VIDA (invisible) por variacion de PRESION (que la tela ya introduce).
- **10/08**: El modelo tiene que reproducir una medicion que NO ajusto. Con el ancho de referencia equivocado el error daba 6,6 %, pasaba el filtro del 12 % y se comia el margen de vida. Un modelo calibrado contra una geometria que no es la medida da bien y miente.
- **08/08**: El veredicto de un script se DERIVA de la evidencia que ya vio: si el log dice `auth OK`, no puede mandar a repetir la auth. El error real de una RPC de Supabase esta en los logs de Postgres (`get_logs`).
- **08/07**: Un conjunto de controles verdes no prueba que el diseño sea bueno: solo que no tiene el error que yo pense en buscar. Lo que Fak marca de un render es dato de ingenieria: ir al numero.
- **08/07**: Un fallo que vi hace cinco minutos es una foto: re-correr la comprobacion antes de reportarlo. Una limitacion escrita por mi ("esto no se puede") es hipotesis vieja con cara de dato: volver a probarla.
- **08/07**: De 3 hallazgos de un plan, 2 murieron al verificarlos. Antes de un plan: releer las memorias del area (no solo el indice); un gancho tiene que nombrar el dato que cambia decisiones.

## Automatizacion de interfaces / ERP

- **08/07**: Si la herramienta tiene interfaz, MIRARLA es el primer paso. Foreground NO es foco: solo un click real da foco de teclado. Tras una corrida fallida, resetear el estado antes de reintentar. Un chequeo que compara identidad y no contenido deja pasar el daño.
- **08/07**: Preguntarle al que usa la herramienta todos los dias es el camino corto; tantear es lo caro. "Es un limite del programa" casi siempre es un limite de lo que probe: no rendirse.
- **08/07**: Proceso que escribe un archivo compartido: gate "alguien lo tiene tomado?" + verificar mtime despues (Excel se lo queda y el export siguiente falla EN SILENCIO). Nunca aceptar un dialogo sin leerlo.

## CAD y 3D

- **08/07**: Barrido sobre algo periodico: el incremento nunca fraccion simple del periodo, y llevar el caso que DEBE fallar. `is_valid=True` no garantiza STL estanco: medir estanqueidad sobre el archivo entregado.
- **08/07**: Un fastener hereda sus cotas del agujero y de la cara donde apoya: "contra que monta?" va antes de la primera linea de geometria, midiendo el ARCHIVO 3D, no el croquis.

## Patrones de corte

- **10/08**: Le crei al NOMBRE de la maquina (`INKJET PLOTTER`) en vez de a lo que ya tenia escrito sobre como se comporta: deduje "imprime, no corta" y arme dos hojas con cruces X. Es de CORTE con cuchilla, y en una X la cuchilla entra de canto sin filo (marca buena: circulo Ø1). **Mi propio registro ya lo decia.** Una deduccion sobre QUE es una maquina no le gana a lo escrito sobre COMO se comporta: antes de construir sobre una inferencia propia, buscar si el registro la contradice. Detalle: memoria `plotter_inkjet_software_htv2a`.
- **10/08**: Un entregable que Fak ya toco es la REFERENCIA, no un borrador mio. Pidio cambiar las marcas "manteniendo como dejo el archivo"; yo asumi que seguia como lo genere y casi le restauro lo que el habia sacado. Lo cazo que **el bbox del archivo no coincidia con el que yo habia reportado (22 mm)**. Si un numero mio no reproduce el archivo actual, el archivo tiene razon.
- **10/08**: Verificar con la MISMA libreria que escribio el archivo no es verificar (DXF de ezdxf releidos con ezdxf; AutoCAD los rechazaba). Y un "no abre" puede tener **DOS causas a la vez**: arreglado el contenido, seguia fallando por la ruta de 304 caracteres. **Si arreglo una causa y el sintoma sigue, medir de cero y reproducir el camino EXACTO del usuario.** Codificado: regla `dxf-entregable.md` + skill `autocad-verificar`.

## Entregables y comunicacion con Fak

- **13/08 — Un mail en la Bandeja de salida parece enviado y NO salio** (Outlook se cerro antes). Al reabrirlo por COM se manda solo en el primer send/receive: **revisar el Outbox ANTES de tocar nada** (moverlo a Borradores lo congela). "Se envio?" se mira en Enviados por fecha, nunca en el borrador.
- **08/07**: El pedido incluye el DONDE: para usar ya = suelto en el Escritorio, sin subcarpetas, versiones ni informes. La verificacion la hago yo, no se la leo. Cerrar incluye archivar el rastro (`_escritorio.mjs --archivar`).
- **08/02**: Cuando Fak da por sentado que algo esta respaldado, verificar CUAL cuenta/carpeta/numero. Si pregunta algo que mi plan da por resuelto, el plan tiene un agujero.

## Agentes y maquinaria pesada

- **08/09**: Investigado a fondo (docs + mediciones): los agentes-rol por dominio NO ahorran tokens — multi-agente ≈ 15x. Los roles son las SKILLS (cargan al usarse); subagentes solo para batch/paralelo con salida pesada, techo 5.

## Scripts y archivos (operaciones peligrosas)

- **08/08**: Con sesiones concurrentes, commitear por pathspec (`git commit <archivos>`): mi commit se llevo un archivo stageado por otra sesion.
- **08/07**: Un script nuevo que borraba movio 942 archivos en vez de 17: dry-run con plan impreso + MIRAR EL CONTEO + Papelera (nunca borrado permanente) + reusar la herramienta segura existente. La jerarquia de carpetas es DATO.
- **08/02**: Migrar de maquina: el ZIP de Windows trae nombres en CP850 (fallan los nombres, no faltan datos); sacar junctions antes de borrar un repo; `git log --not --remotes` + `git stash list` antes de rearmar; script de migracion ajeno: auditar linea por linea.

## Repo publico


## Dominio APQP / Supabase

- NPR esta deprecado: hoy es AP (AIAG-VDA). Manual interno con "NPR>100" es info vieja.
- Severidad = efecto en el USUARIO (el scrap sube ocurrencia, no S). S9-10 SI cubre seguridad del operario. O=10 con controles declarados es indefendible.
- horas_maquina = golpes x ciclo (SIN cavidades); piezas = golpes x cavidades.
- `projects.data` es STRING JSON (al reves que `amfe_documents`). `exec_sql_write` falla en silencio con INSERTs complejos: verificar con SELECT despues.
- Sin `.env.local` en esta PC: Supabase se edita via MCP `execute_sql`, backup previo `CREATE TABLE AS`, AP replicando `calculateAP` (nunca S*O*D), strings SQL con comilla simple.
- Template externo: revisar TODAS las hojas (tambien ocultas); xlsx-populate no calcula caches (abrir/guardar con Excel COM). En un Excel importado los merges NO son confiables: asignar FM por CONTENIDO.

## Gotchas vigentes

- Keyword-regex amplio para calibrar severidad da ~90% falsos positivos: listas canonicas + leer contexto caso por caso.
- Severidades de fallas comunes entre variantes de una familia siguen inconsistentes: pendiente alinear con el equipo APQP.
- Antes de crear un script, mirar `scripts/_archive/` por si ya existe uno reutilizable.

## Como agregar lecciones nuevas

- Entrada en su seccion TEMATICA, formato `- **DD/MM**:` + 1-3 lineas: la regla de conducta, no la historia. El detalle largo va a una memoria o al proximo snapshot.
- Si amerita regla durable: `.claude/rules/` CON enforcement (skill `rule-enforcement-gate`) y aca queda solo una linea de referencia.
- Tope DURO: 20 KB, con aviso del hook. Al acercarse, podar a `docs/_archive/`.

### 2026-08-09 — El archivo de lecciones crecio a 126 KB y el hook lo inyectaba entero
El "destilado corto" se habia convertido en el mayor gasto fijo de cada sesion (~30k tokens), y encima el harness lo truncaba: ni siquiera se leia completo. Podado a menos de 15 KB (todo el detalle en `docs/_archive/LECCIONES_snapshot_2026-08-09.md`) y el hook ahora corta en 20 KB con aviso. **La leccion: un archivo que se lee en cada arranque necesita un tope DURO con enforcement, no una intencion de brevedad.**

### 2026-08-07 — El exportador escribió un archivo vacío y no dijo nada
Generé un tornillo, el script imprimió su JSON de medidas y la ruta del STL como si todo hubiera
salido bien. **El STL no existía y el STEP pesaba 1,6 KB.** El sólido tenía volumen 0 y aun así
`is_valid` devolvía **True** — un compound vacío es "válido". Lo agarré porque fui a medir el
archivo; si me hubiera quedado con la salida de consola, se lo mandaba a Fak para imprimir.

- **`is_valid` no prueba que exista geometría.** Todo generador cierra con dos asserts: volumen
  > 0 y **el archivo escrito existe y pesa lo que tiene que pesar**. Verificar la orden no es
  verificar el resultado (mismo patrón que el virolador).
- **La causa real: dos superficies TANGENTES.** El núcleo se construía exactamente al radio de
  la raíz de la rosca, así que los dos cilindros quedaban tangentes y el booleano se volvía
  inestable. Con paso 1,0 funcionaba de casualidad; con 1,5 devolvía un sólido vacío. Con
  0,10 mm de solape real fusiona siempre. **Dos superficies que se tocan sin solapar no son
  una unión, son una lotería.**
- **Y mi primer diagnóstico fue el equivocado.** Culpé al orden de la fusión porque cambiar el
  orden hacía desaparecer el síntoma — pero el orden nuevo devolvía un tornillo HUECO, una
  espiral sin alma. Pasó las cuatro comprobaciones que tenía (watertight, sin bordes abiertos,
  volumen > 0, gate de enrosque VERDE) y se lo entregué a Fak, que lo vio de un vistazo:
  *"hiciste como un resorte, no tiene sólido adentro"*. **Que el síntoma desaparezca no prueba
  que encontré la causa**, y ninguna de mis métricas miraba lo único que define un tornillo:
  que sea macizo. Ahora el generador lo verifica intersectando el sólido con un cilindro de
  Ø0,6 sobre el eje y exigiendo que el alma esté completa.

### 2026-08-07 — Seguí "mejorando" tres veces después de que Fak dijo que funcionaba
Fak imprimió una probeta y dijo *"enrosca muchísimo mejor"* (paso 1,0, holgura 0,35). Ahí
terminaba. Seguí: (1) subí la holgura a 0,55 porque él había probado de casualidad un par mal
apareado y dijo *"entra perfecto"* — lo tomé como especificación y **se trabó**; (2) para
arreglarlo subí el paso a 1,0→1,5 con un razonamiento correcto sobre tolerancias — **peor**;
(3) ese cambio destapó un bug y le entregué un tornillo hueco. Terminó en *"ya me cansé de
vos"*. La versión buena estaba en la carpeta desde tres iteraciones antes.

- **Cuando Fak confirma que algo anda, esa configuración se CONGELA con sus números.** Sólo
  cambia lo que él pide, de a una cosa, sin tocar lo validado. Si creo que otra cosa mejoraría,
  se lo digo; no lo aplico y se lo mando.
- **Un comentario al pasar sobre una prueba accidental no es una especificación.** Antes de
  convertirlo en cambio, preguntar.
- **En procesos con tolerancias reales la curva no es monótona.** Más holgura no es "más fácil":
  pasado el óptimo la tuerca entra torcida y se traba. Mi modelo mental predecía monotonía y la
  pieza en la mano decía otra cosa.
- **Un razonamiento correcto no es evidencia.** Los tres cambios estaban bien argumentados y los
  tres empeoraron el resultado. Lo único que contaba era qué había impreso y probado.

### 2026-08-10 — Todos mis controles medían material de MÁS; ninguno medía que la pieza ESTÉ
Una auditoría a ciegas del generador de tornillos encontró que los dos scripts sólo sabían detectar
**interferencia** — material sobrante. Un defecto que SACA material (rosca que no fusionó en un
tramo, alma vacía, cabeza separada del vástago) da *menos* interferencia, y los gates lo leían como
"mejor". Reproducido: un tornillo al que le falta un tercio de la rosca pasa `is_valid`, pasa el
control de volumen (−1,6 %), pasa el gate del alma (el eje está intacto) y el gate de enrosque da
**VERDE con exit 0**.

- **Por cada control de "no sobra", va uno de "no falta".** Se agregó el control positivo: cuánto
  material hay en la corona entre raíz y cresta a lo largo del tramo roscado (sano 40-60 %, sin
  rosca ~0), y `len(solids()) == 1` — con dos cuerpos sueltos `is_valid` sigue True y el volumen se
  SUMA, así que ningún otro control lo veía.
- **Se relee el archivo escrito y se compara contra el sólido.** `export_stl` devuelve `False` sin
  lanzar nada si el destino está bloqueado (abierto en el laminador, OneDrive sincronizando): el
  archivo de la corrida ANTERIOR quedaba en su lugar y el chequeo de tamaño lo aprobaba.
- **Casi todo el reporte salía de `vars(args)`, no del sólido.** El número que decide si el tornillo
  entra en su agujero mentía por 0,94 mm cuando una flag opcional faltaba. Ahora se MIDE sobre el STL.
- **`warnings.filterwarnings("ignore")` global apagaba justo los avisos de OCC sobre geometría
  degenerada** — la familia de fallas que ya había mordido dos veces.
- **ROJO antes que CONTROL CIEGO**: que las piezas se pisen es un hecho de la geometría; que el
  control no discrimine es un problema de la medición. Confundirlos manda a tocar el gate en vez de
  la pieza.
