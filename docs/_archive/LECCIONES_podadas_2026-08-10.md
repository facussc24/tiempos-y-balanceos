# Lecciones podadas de LECCIONES_APRENDIDAS.md el 2026-08-10

Salieron del destilado vivo por el tope de 20 KB. Son de julio y su contenido ya esta cubierto por reglas o gates ejecutables, o quedo superado por lecciones posteriores. Se guardan enteras porque el contexto de un incidente reaparece.

- **07/30**: Medir el ARTEFACTO PUBLICADO (bundle servido, xlsx final, dato live), no el codigo ni el build local.
- **07/28**: Probar UNA causa no cierra el caso si sobra sintoma (defecto IDENTICO en todas las piezas = archivo/setup; DISTINTO = maquina). Una premisa que inferi yo se enuncia y se confirma ANTES de construir encima.
- **07/31**: El video/audio que manda Fak ES el pliego: extraerlo (PyAV + faster-whisper) antes de preguntar nada.
- **07/31**: Si algo "no aparece" en el 3D, sospechar del IMPORTADOR antes que de la busqueda. Antes de mallar: la metadata o un documento ya lo responde? Mostrar el primer resultado util apenas existe.
- **07/31**: El entregable impreso va apoyado plano en z=0 y centrado, nunca en coordenadas de vehiculo.
- **07/30**: Un chequeo automatico FRENA, no DECIDE: lo que Fak hizo fisicamente es dato duro, mi heuristica es hipotesis. Se reporta la consecuencia medida y decide el.
- **07/30**: Un coeficiente fisico solo sale de un antes/despues de la MISMA pieza. Si mi calculo contradice la documentacion Y al usuario, el que esta mal soy yo. Dos piezas espejo que difieren: primero verificar que se este LEYENDO lo mismo de las dos.
- **07/30**: Lo inferido se escribe como inferencia; solo lo que Fak confirma se escribe como hecho ("Fak dixit" + fecha). La geometria DESCARTA candidatos, no confirma cual es.
- **07/31**: "Hacelo y reporta" aplica al REPO; sus carpetas van con sintesis corta y OK previo. Un destino se abre y se mira antes de diseñar sobre el; en sus carpetas va el entregable exacto y nada mas (nada de `.md` mios).
- **07/28**: No inventar formatos: ABRIR el formulario oficial del SGC. Si Fak tiene el instrumento en la mano, primero la secuencia fisica de medicion.
- **07/28**: En un mail va primero el hecho que le sirve al que lo firma. El entregable no lleva mi razonamiento ni mis pendientes. Cambio geometrico = graficar antes/despues superpuesto.
- **07/28**: Archivos Office: trabajar en scratchpad y copiar al destino al FINAL; verificar reabriendo el archivo de DESTINO.
- **07/29**: Hubo 828 documentos de la empresa versionados; historial limpiado. Un force-push NO borra los objetos del servidor de GitHub; Fak decidio convivir con eso: cerrado, no reabrir.

- **08/04**: Un verde sin bloqueos no prueba un guardian: "que tendria que haber dado rojo, y lo dio alguna vez?". Un resultado uniforme es experimento roto, no hallazgo.
- **08/03**: La query por campo vacio sobre JSONB con alias historicos MIENTE: traer el objeto entero de UNA fila y mirar sus claves. Y GENERAR EL ARCHIVO Y MIRARLO encuentra lo que los tests en verde no (una fecha de documento nunca pasa por zona horaria).
- **08/03**: Vitest: `Failed Suites` + `no tests` = el modulo NI SE CARGO, no es un test rojo. Cache de Vite borrado antes de dar por buena una suite nueva. Memoria `vitest_forks_roto_notebook`.
- **08/04**: Ante una caja negra, grabar al humano que la usa. Guarda obligatoria: confirmar el foco antes de escribir y abortar si no coincide. Parchear el sintoma no resuelve: MEDIR.
- **08/04**: Muestreo visual no es verificacion: revision programatica del 100% del entregable + mutation testing. Leer el README del formato antes del parser. El alcance lo fija el pedido.
- **08/04**: Una baja deja huellas: la BOM sobrevive al producto anulado. Antes de una lista para EJECUTAR: el objeto todavia existe? (cruzar contra el maestro).
- **08/04**: Un dato de un tercero en un entregable que firma Fak pasa a ser compromiso SUYO. En una difusion va lo que cambio, no por que ni cuanto.
- **08/04**: Una tabla de carga se mide por si se ejecuta sin levantar la vista. Frenos en dos lineas ABAJO. Una preferencia de formato dicha una vez es una regla: a memoria en el momento.
- **08/03**: Al auditar un parser binario, pedir que FABRIQUE los casos no probados. Devolver basura sin error es peor que fallar. Un fixture con nombres reales tambien es codigo publicado.
- **08/04**: Un freno de emergencia que borra es un segundo incendio: fallo permanente se descarta, pasajero se reintenta con contador. Hooks y fork bomb: memoria `hooks_costo_y_fork_bomb`.
- **08/03**: No reescribir fuentes con scripts node: usar Edit. `node -e`/heredoc con rutas Windows colapsan backslashes: el payload va en archivo.
- **08/03**: El mtime miente tras copiar/mudar: la fecha firme vive ADENTRO del archivo; si se usa la del filesystem, decirlo.
- **08/03**: Si un gate bloquea, se rodea la NECESIDAD, no el control. Falsear la evidencia de un gate, nunca.
