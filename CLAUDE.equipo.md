# Base de Claude de Ingeniería - Barack Mercosul

Esta carpeta trae la base de Claude que arma Fak (Facundo Santoro) para el equipo de Ingeniería:
skills (recetas de trabajo, se ven con `/skills`), reglas y scripts para el arb, los consumos,
el legajo APQP, los flujogramas y la lectura de planos. Se usa como cualquier carpeta de Claude Code.

## Cómo trabajar

- **Nunca inventar datos técnicos** (valores, tolerancias, frecuencias, equipos, part numbers,
  acciones). Si falta un dato: escribir `TBD` y avisarle a la persona.
- **CC y SC (características especiales)**: las asigna el responsable del documento o el cliente,
  nunca Claude por su cuenta. El criterio de la casa: CC = severidad 9 o 10; SC = severidad 5 a 8
  y ocurrencia 4 o más. Una sigla se justifica con la S y la O de esa causa, no porque otro
  documento la tenía.
- Castellano argentino simple, con las palabras de planta. `SCRAP`, `PPAP` y `KLT` se quedan.
- Antes de entregar un archivo (Excel, PDF, PowerPoint): abrirlo y mirarlo.
- Antes de cargar algo en el arb: mostrarle a la persona la tabla con el valor actual al lado del
  nuevo y esperar su OK. El arb no se cierra sin consultarle.

## Las mejoras de Fak llegan solas

Fak publica mejoras en la nube y esta carpeta las recibe cada unas horas, en segundo plano. Nunca se
borra nada tuyo: ni skills, ni reglas, ni archivos que hayas agregado.

- **"¿Hay actualizaciones de Fak?"**: correr `node scripts/_paquete.mjs --ver`. Dice qué versión
  hay instalada, cuál es la última y qué cambió, en palabras simples. Contárselo a la persona así.
- **Al empezar una sesión**: si existe `.claude/paquete-pendientes.md` y tiene cambios, avisarle en
  una línea por archivo: "Por la sincronización te conviene cambiar tal archivo, ¿lo aplico?".
- **Un archivo con `.fak-nueva`** (por ejemplo `SKILL.md.fak-nueva`): la persona había cambiado ese
  archivo y Fak publicó una versión nueva, así que la nueva quedó al lado y **el de la persona no
  se tocó**. Comparar los dos, explicar simple qué cambia, y sugerir el cambio. Si la persona dice
  que sí, aplicarlo y, con su OK, borrar el `.fak-nueva`. Si dice que no, dejarlo como está.
- `node scripts/_paquete.mjs --actualizar --reponer` trae de vuelta lo que la persona hubiera
  sacado a propósito (solo si lo pide).

## Aportes: lo tuyo puede servirle al resto

- Quién es la persona: el instalador ya guardó su nombre y sector. Si no existe
  `.claude/perfil-equipo.json`, preguntar "¿Cuál es tu nombre y apellido y tu sector?" y correr
  `node scripts/_paquete.mjs --perfil "Nombre Apellido - Sector"`.
- Cuando la persona termine algo que puede servirles a otros (una skill, un script, una planilla
  modelo), preguntar: **"Esto que hicimos puede aportar valor a otros usuarios, ¿querés
  compartirlo en la nube?"**. Una sola vez por trabajo, sin insistir.
- Solo con un sí: `node scripts/_paquete.mjs --aportar <ruta> --que "<qué es, en una frase>"`. El
  aporte va a una carpeta con su nombre, pasa un filtro de claves y datos personales, y Fak decide
  si entra a la base oficial. Nunca se sube nada sin ese sí.
