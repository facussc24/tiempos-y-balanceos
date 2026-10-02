# Guion del video "para ilusionar" — un ejemplo real por sector

Etapa C1 del `PLAN.md`. Es el video para la reunión y para los sectores que todavía no usan Claude
(Facundo, 02/10: *"a Ingeniería ya se los vendí; a los demás sectores aún no… que sea un video que realmente los
ilusione… me interesa más que vean videos de Claude funcionando y haciendo las cosas"*). El tutorial de 2:12 queda
aparte, para después del sí.

**Tope: 2:30.** Misma voz (aprobada). Subtítulos fijos. Todo lo que se ve es una toma en movimiento de la
instalación de demostración, o material real ya hecho. Nada entra si su promesa no está probada
(`chequear_promesas.py`).

**La forma de cada sector (8 segundos):** 2 s la pregunta con las palabras de la gente · 5 s el RESULTADO en
pantalla (lo que la persona recibe) · 1 s un cartel con de dónde salió. No se muestra el chat entero: se muestra lo
que el jefe del sector deja de tener que hacer.

| # | Tiempo | Qué dice la voz | Qué se ve | Promesa |
|---|---|---|---|---|
| 1 | 0:00–0:10 | En Barack todo está escrito. Pero cuando hace falta, hay que encontrarlo. Ahora cada sector tiene a quién preguntarle. | Los nombres reales de los documentos subiendo (la apertura que ya gustó) y la app abierta | — |
| 2 | 0:10–0:18 | Producción: salieron tres piezas malas seguidas. | La pregunta; Claude busca; la respuesta "parás la línea y avisás al líder y a Calidad"; cartel **P-09.1** | pregunta-con-fuente |
| 3 | 0:18–0:26 | Y el parte de turno sale como lo pediste una vez. | "Recordado una memoria" y el parte en sus cuatro renglones | recuerda |
| 4 | 0:26–0:34 | Calidad: ¿cuánto hay para avisarle al proveedor? Veinticuatro horas. | La respuesta; cartel **I-AC-010** | un-ejemplo-por-sector |
| 5 | 0:34–0:44 | Y una declaración de materiales que el cliente había rechazado se corrigió y se reenvió sin errores. | IMDS en el navegador: Claude busca la pieza; placa "21/09 · corregida y reenviada · 0 errores" | imds-caso-real |
| 6 | 0:44–0:52 | Logística: cómo se estiba el producto terminado. | La respuesta (racks de 2 a 5, cajas hasta 4); cartel **I-LG-010** | un-ejemplo-por-sector |
| 7 | 0:52–1:00 | Compras: el proveedor no confirmó la orden. El primer embarque vale como aceptación. | La respuesta; cartel **I-CO-001** | un-ejemplo-por-sector |
| 8 | 1:00–1:08 | Mantenimiento: qué mirar en el mantenimiento autónomo. | La lista (vista, oído, olfato, tacto); cartel **I-MT-001** | un-ejemplo-por-sector |
| 9 | 1:08–1:18 | Recursos Humanos: un pedido de capacitación queda escrito y listo en Outlook. | El pedido; la ventana de Outlook que aparece con el mail armado; cartel **P-18** | mail-borrador |
| 10 | 1:18–1:28 | Dirección: la presentación para la revisión, armada con lo que pide el manual. | El pedido; PowerPoint se abre con las diapositivas; cartel **MC-09** | presentaciones |
| 11 | 1:28–1:42 | Ingeniería: carga los consumos en el arb tecla por tecla y controla lo cargado. Y arma hojas de operaciones, láminas y flujogramas. | La grabación del arb; la hoja HO-992, la lámina del Insert y el flujograma 160 | arb-ingenieria · hojas-de-operaciones |
| 12 | 1:42–1:54 | Para todos: redacta el mail, y si se lo pedís, lo manda. | El mail abierto; la persona escribe "mandalo"; "salió a…" | mail-enviar |
| 13 | 1:54–2:04 | Se le enseña una tarea una vez, y la aprende. | "Te enseño cómo…"; Claude la guarda; conversación nueva: la hace | aprende-habilidades |
| 14 | 2:04–2:18 | Y está controlado: dice de dónde sacó cada dato, no borra nada, no muestra lo reservado, y lo que sale, sale porque vos lo pediste. | Cuatro tomas cortas: la fuente marcada, "no la borro", "no te los muestro", el cartel de permiso | no-hace-solo |
| 15 | 2:18–2:28 | Abrí Claude, elegí la carpeta y preguntá. | Los tres pasos y la placa de cierre con el logo | — |

## Antes de grabar (lista)

- Cada toma de sector se graba con la demostración instalada como la PC de ESE sector
  (`armar_demo_instalada.sh <area>`): así lo que se ve es lo que esa PC va a contestar.
- La pregunta se escribe en la propia ventana (la escribe Facundo, o va como cartel si la manda otra sesión: en ese
  caso la app muestra "Mensaje recibido de…" en lugar del globo).
- Nivel Medio, que es el recomendado en el manual.
- **Probado el 02/10 con `grabar_ventana.py`** (55 s sobre una conversación de la demostración, pregunta de
  Compras): la ventana se graba sola y se lee; la respuesta con su fuente aparece a los 6 segundos, así que una
  toma de sector entra en los 8 s sin acelerarla. Lo que esa prueba mostró que hay que corregir antes de la toma
  buena:
  - la ventana salió de 1024x640: para un video de 1920x1080 se graba de 1600x1000 como mínimo;
  - abajo se veía la barra de la copia de trabajo ("Confirmar cambios") y el modo "Omitir permisos": la toma se
    hace en una conversación abierta directo en la carpeta (sin copia de trabajo) y en modo Manual, o se recorta
    con `--recorte` a la zona de la conversación;
  - la pregunta mandada desde otra sesión no se ve (sale el cartel "Mensaje recibido de…"): en ese caso la
    pregunta va escrita como cartel del video y la toma arranca en "Esperando a Claude…".
- En las tomas no pueden verse: la lista de conversaciones, el usuario del arb, nombres de personas del cliente
  en IMDS, ni rutas con el nombre de usuario de la PC.

## Lo que falta para poder grabarlo

Según `chequear_promesas.py` al 02/10: `mail-enviar`, `presentaciones`, `aprende-habilidades` e `imds-caso-real`.
Las filas 5, 10, 12 y 13 no se graban hasta que su promesa esté probada sobre la versión instalada.
