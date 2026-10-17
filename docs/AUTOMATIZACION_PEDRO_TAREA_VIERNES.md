# Automatización de Barack para Pedro — la tarea de los viernes y de dónde salen los candidatos

Tanda 8 del plan del sistema (16/10/2026). Hecho el 17/10/2026 por una sesión lanzada por el orquestador (encargo E261017-bb67).

## Qué hay y dónde

| Pieza | Dónde | Quién la escribe |
|---|---|---|
| La cola de candidatos (antes medido, dueño, marcha atrás, fecha de revisión, costo, estado) | nube de Ingeniería, `AUTOMATIZACION BARACK\cola.md` (raíz de la biblioteca, hermana de la carpeta de mi memoria) | Fak, o una sesión con su OK. Nada automático la edita |
| Los borradores del mail a Pedro | `AUTOMATIZACION BARACK\borradores\AAAA-MM-DD - mail a Pedro.md` | la tarea de los viernes (el primero, del 17/10, a mano) |
| Los relevamientos de candidatos | `AUTOMATIZACION BARACK\relevamientos\AAAA-MM-DD - candidatos propuestos.md` | `node scripts/_automatizacionCandidatos.mjs --out <ruta>` |

El mail no sale de acá: Fak copia el borrador a un mail nuevo de Outlook. La tarea no toca Outlook.

## El script de candidatos

`node scripts/_automatizacionCandidatos.mjs [--dias 15] [--out <archivo>] [--cola <ruta>] [--mails <ruta>]`

- Busca en la copia local de los mails (`_mails.py --buscar` y `--ver`, nada más) los temas del canon
  `scripts/_lib/automatizacionCandidatos.data.json`: BeOn, ECR/ECO, arb, impresora y vigilancia, y «a mano / demora».
- Por tema: cuántos mails los nombran (búsqueda por texto: es un tope), el último, y hasta 3 citas del mail con remitente,
  fecha, asunto e id. Marca si el tema ya tiene fila en la cola.
- Descarta lo que no es un mail mandado (borradores, eliminados, conflictos), boletines, y los mails donde la palabra
  está adentro de otra («ecr» en «decrypt»). Tapa claves de API y la marca del asistente (la salida va a la nube).
- `--out` nunca pisa `cola.md`. Tarda unos 3 minutos (cada llamada a `_mails.py` carga los ~11.000 mails).
- Test: `__tests__/scripts/automatizacionCandidatos.test.mjs` (23 casos, con un `_mails.py` de mentira que anota lo que le piden).
- Desde un worktree encuentra solo el `_mails.py` del checkout principal (el que tiene `.mail-cache`).

## La tarea programada (QUEDÓ SIN CREAR: la app pidió la aprobación de una persona)

El 17/10 la herramienta de tareas programadas contestó «needs a person's approval, and nobody has opened this scheduled
run». No se armó por otro camino. Se crea con un clic de Fak en el cartel, desde una sesión con él en la ventana, con
estos valores:

- **taskId:** `borrador-mail-pedro-automatizacion`
- **título:** Borrador quincenal del mail a Pedro (automatización)
- **cron:** `0 9 * * 5` (viernes 09:00, hora local). Cron no sabe «cada dos semanas»: corre todos los viernes y la
  guarda del paso 1 sale sin escribir si el último borrador tiene menos de 14 días. Con el primero del 17/10: el 24/10
  no escribe, el 31/10 sí.
- **modo:** omitir permisos (la sesión que la crea está en ese modo; el resultado de la creación lo dice). Solo lee y
  escribe dos archivos en la nube.
- **notifyOnCompletion:** false.
- **prompt:** el bloque de abajo, entero.

```text
Tarea automática de los viernes: el borrador quincenal del mail de Facundo Santoro (Fak, Ingeniería de Barack) a Pedro Ergo (Director) sobre la automatización de Barack. Nadie mira esta corrida: no preguntes nada y no entres en modo plan. Trabajá en la carpeta C:\Dev\BarackMercosul.

REGLAS DURAS (no se negocian):
- Outlook NO se toca: no se arma ni se manda ningún mail, ni se guarda un borrador en Outlook. De `python scripts/_mails.py` solo --buscar y --ver, que leen la copia local; ninguna otra opción.
- Nada de Supabase, del arb ni del servidor Y:. No se lanzan subagentes. No se hacen commits.
- Lo único que se escribe son dos archivos dentro de `C:\Users\FacundoS-PC\BARACK ARGENTINA SRL\Ingeniería y Proyecto - General\AUTOMATIZACION BARACK\` (el borrador y el relevamiento de abajo). La cola `cola.md` NO se edita.
- Ningún archivo, carpeta ni texto nombra al asistente ni a su fabricante, ni dice «IA» o «inteligencia artificial» (regla de Fak: ningún documento de Barack dice que lo hizo una IA). Al asistente se lo llama «el asistente» o directamente se dice qué se hizo.
- No se promete una cadencia («una automatización cada dos semanas» no tiene fuente): se cuenta lo que avanzó.

PASOS:
1. Guarda de 14 días: listá `AUTOMATIZACION BARACK\borradores\`. Los archivos se llaman `AAAA-MM-DD - mail a Pedro.md`. Si el más nuevo tiene menos de 14 días respecto de hoy (medí la fecha con `date`), TERMINÁ sin escribir nada y decí en una línea: «No toca: el último borrador es del <fecha>; el próximo sale el viernes <fecha>». (El primero es del 17/10/2026: el 24/10 no toca, el 31/10 sí.)
2. Leé entera la cola `AUTOMATIZACION BARACK\cola.md` (estado de cada candidato, fechas de revisión, lo ya hecho) y el borrador anterior (para no repetirlo).
3. Mirá qué cambió en 14 días: `git -C C:\Dev\BarackMercosul log --since="14 days ago" --oneline` y quedate SOLO con lo que mueve una fila de la cola (BeOn, ECR/ECO, historia del arb, vigilancia de la impresora o la notebook fija, o algo de «Ya hecho»). Los commits del sistema interno (guardianes, hooks, reglas, tandas del plan) NO van al mail. También podés mirar `FACUNDO\` en la misma biblioteca (archivos `PEDIDO N - listo ...`) para ver qué se hizo en BeOn.
4. Relevamiento: si existe `C:\Dev\BarackMercosul\scripts\_automatizacionCandidatos.mjs`, corré `node scripts/_automatizacionCandidatos.mjs --out "C:\Users\FacundoS-PC\BARACK ARGENTINA SRL\Ingeniería y Proyecto - General\AUTOMATIZACION BARACK\relevamientos\<AAAA-MM-DD> - candidatos propuestos.md"` (unos 3 minutos; solo lee). Si no existe (rama sin fundir), seguí sin él y decilo al final.
5. Escribí `AUTOMATIZACION BARACK\borradores\<AAAA-MM-DD> - mail a Pedro.md` con este formato: primera línea `Borrador del DD/MM/AAAA. No se mandó: copiarlo a un mail nuevo de Outlook.`; después `Para: Pedro Ergo`, `CC: Carlos Baptista` (Carlos va siempre en copia: regla de Fak), `Asunto: Automatización - avance al DD/MM`, una línea `---` y el cuerpo. El cuerpo en la voz de Fak: arranca «Buen dia Pedro,», cierra «Saludos,», primera persona, frases cortas, castellano argentino simple, sin anglicismos, sin secciones numeradas ni tablas, MENOS de 585 caracteres (mejor cerca de 400): qué avanzó (con un número medido si lo hay, por ejemplo minutos antes y después), qué sigue (una sola cosa, la próxima de la cola) y, solo si hay algo, qué hace falta. Si no avanzó nada, se dice en una línea, sin rellenar.
6. Controles: `node scripts/_vozFak.mjs --revisar <archivo con solo el cuerpo>` tiene que dar VERDE (si da amarillo por largo, acortar y repetir); `python scripts/_sinFirmaIA.py "<ruta del borrador>"` con 0 bloqueantes (igual con el relevamiento si se generó).
7. Terminá con tres líneas: la ruta del borrador, la del relevamiento (o por qué no se generó) y el resultado de los dos controles.
```

## Lo que no hace y por qué

- No arma el mail en Outlook (regla del encargo de la tanda 8: el borrador es un `.md` que Fak copia).
- No decide qué sube a la cola: propone con cita; Fak decide (contrato de autonomía).
- El tiempo que se le dedica es una estimación en la cola, con su fuente (el ciclo de BeOn), no un compromiso.
