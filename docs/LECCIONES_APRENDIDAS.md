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

- **10/08 — El cargador de STEP descartaba en silencio las caras libres, y ahi vivia la cota.** El default de gmsh (`highestDimOnly=True`) tiraba las paredes internas de la ranura: el rayo media la envolvente exterior (12,96) creyendo medir la luz (11,04), y el utillaje apretaba 4x. **Tres mediciones "independientes" mias dieron el mismo error porque las tres compartian el cargador** — repetir una medicion no la valida si comparte la fuente del error; lo cazo una revision a ciegas a la que NO le pase mi numero. Arreglado en `cadlib.geom` (descarte explicito por stderr, `caras_libres=True`) y en `check_collision`. Ojo: una cara libre tambien puede ser superficie de construccion (un offset constante a tres decimales no es una pieza inyectada).
- **10/08 — Un criterio adimensional esconde la decision.** El contrato pedia "SF fatiga >= 1,5" y ninguna geometria cerraba. Traducido a lo que significa —SF 1,5 sobre un limite dado a 1e5 ciclos son **9 anos** de produccion— se ve que le pedia 9 anos a un consumible impreso de 29 g que ademas trae su galga de desgaste, y costaba 50 % mas de pieza. La barra pasa a **VIDA en anos** (2, el doble de la vida de diseno). Cambiar la FORMA del criterio y escribir por que no es bajar la barra para pasar; lo segundo se nota porque no se puede explicar.
- **10/08 — Dimensionar contra el promedio reparte mal el dano.** La ranura mide 12,78 en las puntas y 12,96 en el centro. Con la mediana, el dedo de la zona angosta flexiona 20 % de mas y su vida cae de 2,0e5 a 7,4e4 ciclos: **un solo dedo se come toda la fatiga**. Se dimensiona contra el punto MAS EXIGENTE; los demas quedan mas flojos, que es la direccion segura. Se cambia variacion de VIDA (que no se ve venir) por variacion de PRESION (que la tela ya introduce).
- **10/08 — El modelo tiene que reproducir una medicion que no ajusto.** El calibrador exige que la viga escalonada le pegue a k y sigma medidos sobre el STEP dentro del 12 % o aborta. Con el ancho de dedo equivocado en la referencia (12 en vez de 8) el error era 6,6 %: pasaba el filtro y se comia justo el margen de vida. Un modelo calibrado contra una geometria que no es la medida da bien y miente.
- **08/08**: El veredicto de un script se DERIVA de la evidencia que ya vio: si el log dice `auth OK`, no puede mandar a repetir la auth. El error real de una RPC de Supabase esta en los logs de Postgres (`get_logs`).
- **08/07**: Un conjunto de controles verdes no prueba que el diseño sea bueno: solo que no tiene el error que yo pense en buscar. Lo que Fak marca de un render es dato de ingenieria: ir al numero.
- **08/07**: Un fallo que vi hace cinco minutos es una foto: re-correr la comprobacion antes de reportarlo. Una limitacion escrita por mi ("esto no se puede") es hipotesis vieja con cara de dato: volver a probarla.
- **08/07**: De 3 hallazgos de un plan, 2 murieron al verificarlos. Antes de un plan: releer las memorias del area (no solo el indice); un gancho tiene que nombrar el dato que cambia decisiones.
- **08/06**: Antes de sostener un valor derivado, calcular su incertidumbre: si es del orden de la diferencia en discusion, NO decide y gana el que tiene la pieza en la mano. Decirlo explicito.
- **08/06**: El ERP dice que se consume HOY, no a que pieza VA a ir un material: eso se mira en plano/PPAP. "Hoy no se consume en ninguna" ES una respuesta.
- **08/06**: Antes de declarar caida una infra, dos evidencias independientes. Unidad local delante de una ruta UNC en el error = mi escape (bash+PowerShell: comillas simples).
- **08/05**: El cache local del ERP es una foto: mirar el mtime del crudo antes de afirmar estado; el diff entre snapshots suele ser el entregable. Mismo numero en dos unidades no es invariante: diffear tambien las UNIDADES.
- **08/05**: Antes de explicar una falla, cruzar que tienen en comun los que fallaron y los que NO. Antes de sacar un paso "ineficiente", entender por que estaba.
- **08/04**: Un verde sin bloqueos no prueba un guardian: "que tendria que haber dado rojo, y lo dio alguna vez?". Un resultado uniforme es experimento roto, no hallazgo.
- **08/03**: La query por campo vacio sobre JSONB con alias historicos MIENTE: traer el objeto entero de UNA fila y mirar sus claves. Y GENERAR EL ARCHIVO Y MIRARLO encuentra lo que los tests en verde no (una fecha de documento nunca pasa por zona horaria).
- **08/03**: Vitest: `Failed Suites` + `no tests` = el modulo NI SE CARGO, no es un test rojo. Cache de Vite borrado antes de dar por buena una suite nueva. Memoria `vitest_forks_roto_notebook`.
- **07/30**: Medir el ARTEFACTO PUBLICADO (bundle servido, xlsx final, dato live), no el codigo ni el build local.
- **07/28**: Probar UNA causa no cierra el caso si sobra sintoma (defecto IDENTICO en todas las piezas = archivo/setup; DISTINTO = maquina). Una premisa que inferi yo se enuncia y se confirma ANTES de construir encima.

## Automatizacion de interfaces / ERP

- **08/07**: Si la herramienta tiene interfaz, MIRARLA es el primer paso. Foreground NO es foco: solo un click real da foco de teclado. Tras una corrida fallida, resetear el estado antes de reintentar. Un chequeo que compara identidad y no contenido deja pasar el daño.
- **08/07**: Preguntarle al que usa la herramienta todos los dias es el camino corto; tantear es lo caro. "Es un limite del programa" casi siempre es un limite de lo que probe: no rendirse.
- **08/07**: Proceso que escribe un archivo compartido: gate "alguien lo tiene tomado?" + verificar mtime despues (Excel se lo queda y el export siguiente falla EN SILENCIO). Nunca aceptar un dialogo sin leerlo.
- **08/06**: Un parser que alimenta una automatizacion se valida contra un conteo crudo independiente, o contra OTRO parser escrito aparte. Todo filtro que descarta lleva contador de descartes.
- **08/04**: Ante una caja negra, grabar al humano que la usa. Guarda obligatoria: confirmar el foco antes de escribir y abortar si no coincide. Parchear el sintoma no resuelve: MEDIR.
- **08/04**: Muestreo visual no es verificacion: revision programatica del 100% del entregable + mutation testing. Leer el README del formato antes del parser. El alcance lo fija el pedido.
- **08/04**: Una baja deja huellas: la BOM sobrevive al producto anulado. Antes de una lista para EJECUTAR: el objeto todavia existe? (cruzar contra el maestro).

## CAD y 3D

- **08/07**: Barrido sobre algo periodico: el incremento nunca fraccion simple del periodo, y llevar el caso que DEBE fallar. `is_valid=True` no garantiza STL estanco: medir estanqueidad sobre el archivo entregado.
- **08/07**: Un fastener hereda sus cotas del agujero y de la cara donde apoya: "contra que monta?" va antes de la primera linea de geometria, midiendo el ARCHIVO 3D, no el croquis.
- **08/06**: Dos o tres features candidatas parecidas = señal de PREGUNTAR, no de filtrar mejor. El mecanismo sale de la secuencia de la operacion real: escribirla en una linea y confirmarla.
- **08/06**: Cuando una metrica se calcula sobre una region que elegi yo, verificar primero que la region sea la correcta. Pieza suelta se verifica con test de INTERIOR, no con nodos de malla.
- **08/06**: Toda transformacion "para que quede en X" termina con un assert de que quedo en X. Cuando cambia el mecanismo cambia que cota manda: rehacer el anclaje.
- **08/05**: Desvio parejo en todo el barrido = error de ANCLAJE, no obstaculo. Aislar la medicion a UNA cara. Features simetricos dan varias poses con igual RMS: memoria `registrar_fixture_por_features`.
- **07/31**: El video/audio que manda Fak ES el pliego: extraerlo (PyAV + faster-whisper) antes de preguntar nada.
- **07/31**: Si algo "no aparece" en el 3D, sospechar del IMPORTADOR antes que de la busqueda. Antes de mallar: la metadata o un documento ya lo responde? Mostrar el primer resultado util apenas existe.
- **07/31**: El entregable impreso va apoyado plano en z=0 y centrado, nunca en coordenadas de vehiculo.

## Patrones de corte

- **10/08**: Le crei al NOMBRE de la maquina (`INKJET PLOTTER`) en vez de a lo que ya tenia escrito sobre como se comporta: deduje "imprime, no corta" y arme dos hojas con cruces X. Es de CORTE con cuchilla, y en una X la cuchilla entra de canto sin filo (marca buena: circulo Ø1). **Mi propio registro ya lo decia.** Una deduccion sobre QUE es una maquina no le gana a lo escrito sobre COMO se comporta: antes de construir sobre una inferencia propia, buscar si el registro la contradice. Detalle: memoria `plotter_inkjet_software_htv2a`.
- **10/08**: Un entregable que Fak ya toco es la REFERENCIA, no un borrador mio. Pidio cambiar las marcas "manteniendo como dejo el archivo"; yo asumi que seguia como lo genere y casi le restauro lo que el habia sacado. Lo cazo que **el bbox del archivo no coincidia con el que yo habia reportado (22 mm)**. Si un numero mio no reproduce el archivo actual, el archivo tiene razon.
- **10/08**: Verificar con la MISMA libreria que escribio el archivo no es verificar (di por buenos DXF de ezdxf releyendolos con ezdxf; AutoCAD los rechazaba). Y un "no abre" puede tener **DOS causas a la vez**: arreglado el contenido, seguia fallando por la ruta de 304 caracteres que el doble click trunca en 259. **Si arreglo una causa y el sintoma sigue, medir de cero y reproducir el camino EXACTO del usuario.** Todo codificado: regla `dxf-entregable.md` + skill `autocad-verificar`.
- **07/30**: Un chequeo automatico FRENA, no DECIDE: lo que Fak hizo fisicamente es dato duro, mi heuristica es hipotesis. Se reporta la consecuencia medida y decide el.
- **07/30**: Un coeficiente fisico solo sale de un antes/despues de la MISMA pieza. Si mi calculo contradice la documentacion Y al usuario, el que esta mal soy yo. Dos piezas espejo que difieren: primero verificar que se este LEYENDO lo mismo de las dos.
- **07/30**: Lo inferido se escribe como inferencia; solo lo que Fak confirma se escribe como hecho ("Fak dixit" + fecha). La geometria DESCARTA candidatos, no confirma cual es.

## Entregables y comunicacion con Fak

- **08/07**: El pedido incluye el DONDE: para usar ya = suelto en el Escritorio, sin subcarpetas, versiones ni informes. La verificacion la hago yo, no se la leo. Cerrar incluye archivar el rastro (`_escritorio.mjs --archivar`).
- **08/06**: Antes de preguntarle a un tercero, nombrar que fuente concreta podria contestarlo; si no puedo, la pregunta no sale. El primer codigo que encaja por descripcion NO es la respuesta: contar usos. No re-pedir datos ya dados.
- **08/06**: Antes de declarar un archivo inaccesible, buscarlo en el buzon (`_mails.py --buscar`). Sustituir la pieza pedida por otra "parecida" es ruido, no avance.
- **08/04**: Un dato de un tercero en un entregable que firma Fak pasa a ser compromiso SUYO. En una difusion va lo que cambio, no por que ni cuanto.
- **08/04**: Una tabla de carga se mide por si se ejecuta sin levantar la vista. Frenos en dos lineas ABAJO. Una preferencia de formato dicha una vez es una regla: a memoria en el momento.
- **08/02**: Cuando Fak da por sentado que algo esta respaldado, verificar CUAL cuenta/carpeta/numero. Si pregunta algo que mi plan da por resuelto, el plan tiene un agujero.
- **07/31**: "Hacelo y reporta" aplica al REPO; sus carpetas van con sintesis corta y OK previo. Un destino se abre y se mira antes de diseñar sobre el; en sus carpetas va el entregable exacto y nada mas (nada de `.md` mios).
- **07/28**: No inventar formatos: ABRIR el formulario oficial del SGC. Si Fak tiene el instrumento en la mano, primero la secuencia fisica de medicion.
- **07/28**: En un mail va primero el hecho que le sirve al que lo firma. El entregable no lleva mi razonamiento ni mis pendientes. Cambio geometrico = graficar antes/despues superpuesto.

## Agentes y maquinaria pesada

- **08/09**: Investigado a fondo (docs + mediciones): los agentes-rol por dominio NO ahorran tokens — multi-agente ≈ 15x. Los roles son las SKILLS (cargan al usarse); subagentes solo para batch/paralelo con salida pesada, techo 5.
- **08/06**: Lance 40 agentes para verificar algo ya respondido con 3 greps: verificar algo resuelto es RELEER LA FUENTE. Cap por fase no es cap total: contar fase1 + hallazgos x verificadores. Ninguna instruccion generica le gana a un limite de Fak. Enforcement: `techo-agentes.md`. Y sobre un requerimiento sin confirmar, los agentes multiplican el error en vez de encontrarlo.
- **08/03**: Al auditar un parser binario, pedir que FABRIQUE los casos no probados. Devolver basura sin error es peor que fallar. Un fixture con nombres reales tambien es codigo publicado.

## Scripts y archivos (operaciones peligrosas)

- **08/08**: Con sesiones concurrentes, commitear por pathspec (`git commit <archivos>`): mi commit se llevo un archivo stageado por otra sesion.
- **08/07**: Un script nuevo que borraba movio 942 archivos en vez de 17: dry-run con plan impreso + MIRAR EL CONTEO + Papelera (nunca borrado permanente) + reusar la herramienta segura existente. La jerarquia de carpetas es DATO.
- **08/04**: Un freno de emergencia que borra es un segundo incendio: fallo permanente se descarta, pasajero se reintenta con contador. Hooks y fork bomb: memoria `hooks_costo_y_fork_bomb`.
- **08/03**: No reescribir fuentes con scripts node: usar Edit. `node -e`/heredoc con rutas Windows colapsan backslashes: el payload va en archivo.
- **08/03**: El mtime miente tras copiar/mudar: la fecha firme vive ADENTRO del archivo; si se usa la del filesystem, decirlo.
- **08/03**: Si un gate bloquea, se rodea la NECESIDAD, no el control. Falsear la evidencia de un gate, nunca.
- **08/02**: Migrar de maquina: el ZIP de Windows trae nombres en CP850 (fallan los nombres, no faltan datos); sacar junctions antes de borrar un repo; `git log --not --remotes` + `git stash list` antes de rearmar; script de migracion ajeno: auditar linea por linea.
- **07/28**: Archivos Office: trabajar en scratchpad y copiar al destino al FINAL; verificar reabriendo el archivo de DESTINO.

## Repo publico

- **08/06**: Este archivo y todo el repo son PUBLICOS: las lecciones van en metodo puro (que fallo, por que, como se evita). Cliente, proyecto, rutas y medidas reales van a `.sgc-cache/` (gitignoreado). La pregunta "esto lo puede leer cualquiera?" va al ESCRIBIR, no al pushear. Vale tambien para mensajes de commit.
- **07/29**: Hubo 828 documentos de la empresa versionados; historial limpiado. Un force-push NO borra los objetos del servidor de GitHub; Fak decidio convivir con eso: cerrado, no reabrir.

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

### 2026-08-07 — El ajuste que "funciona" lo define la mano de Fak, no la tabla
Tres iteraciones de holgura de rosca: 0,125 mm radiales se trababa, 0,175 "mucho mejor", y el par
que Fak eligió fue uno **mal apareado que probó de casualidad** — 0,275 radiales, 49 % de flanco:
*"entra perfecto, que se mueva rápido, esa es la idea"*. Yo venía optimizando hacia el ajuste más
fino que enroscara.

- **Para utillaje impreso que se aprieta a mano, el objetivo es que gire rápido con los dedos**,
  no el ajuste justo. Apuntar a ~50 % de flanco.
- **Cuando Fak dice que algo "entra perfecto", ESO es la especificación**: medir ese par y copiar
  sus números, en vez de seguir la tabla.
- Y cuando aun así se trabó: el problema no era el modelo (lo medí, estaba suelto) sino la
  repetibilidad de la impresora. La respuesta correcta no es más holgura, es **más paso**: con
  paso 1,5 el filete es el doble de profundo y el mismo error de impresión pesa la mitad.
