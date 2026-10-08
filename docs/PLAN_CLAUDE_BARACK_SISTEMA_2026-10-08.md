# Plan del sistema Claude de Barack — decisiones del 08/10/2026

Lo pidió Fak el 08/10/2026 (texto del Escritorio «nuevo hallazgo (api relacionado).txt», dos audios de
WhatsApp y el chat): *«tomá las decisiones vos, las mejores... pensá todo de principio a fin... pensá
edge cases»*. Este archivo es el plan que sigo; a Fak se le cuenta en el chat, corto. Lo escribió la
sesión Fable 5.1 del 08/10 después de leer los 182 chats de Antigravity (`~/.gemini/antigravity`), los dos
informes de Gemini (`INFORME_MAESTRO_API_CLAUDE_BARACK.txt`, `docs/PLAN_MAESTRO_IMPLEMENTACION_API_CLAUDE.md`),
las memorias del asistente por área y de la nube, y la documentación oficial de Anthropic (advisor tool,
créditos de API, modos de permiso).

## 0. Lo que Fak pidió, en sus palabras (resumido)

1. Que yo decida qué agentes usar para cada tarea («capaz es una tarea rápida... Opus medio... si es más
   compleja...»), con la documentación como base. Que el techo de Sonnet solo es «absurdo»; el de 10
   agentes, «no tan absurdo».
2. Aprovechar los créditos de la API ($200 por mes del plan Max 20x): qué conviene hacer a la noche;
   «cambios 100 % seguros»; auto-mejora (leer novedades de Claude, probar las skills, mejorar código);
   un resumen de prioridades del día. La clave la crea él (Claudio ya vinculó la organización).
3. Actualizaciones automáticas entre SUS PC (la de Ingeniería y la notebook de Calidad, CATA) y hacia
   Carlos: a Carlos solo lo 100 % probado; que Carlos le pueda mandar mejoras y él decida si entran.
4. La nube de Ingeniería «es un desastre»: no está claro cómo una PC suya o Carlos le comparten archivos.
5. Qué rol cumplen GitHub y Supabase en todo esto.
6. En la notebook de Calidad el asistente «se puso restrictivo»; no quiere bloqueantes, quiere soluciones.
   Teme que a Pedro le pase lo mismo.
7. Un mail de Carlos con un consumo corregido quedó sin ver en una tarea abierta: «nunca más puede volver
   a pasar».
8. Lanzar Haiku hoy fue rápido y útil; incorporarlo.

## 1. Decisiones

### 1.1 Agentes: presupuesto por costo en vez de «10 agentes solo Sonnet»

Fak, 08/10 a la noche: *«ese techo de 10 lo puse yo, ni siquiera sé si es correcto... eficiencia no
significa siempre ahorrar tokens, significa trabajar de la mejor forma posible: algunas tareas van a
requerir Fable o muchos Opus»*. El guardián `agentes-guard.sh` pasa a medir **puntos por ventana de 10
minutos, según lo que cuesta cada modelo** (tabla oficial de precios): haiku 1, sonnet 4, opus 8, fable
20; presupuesto 40 (lo que valían los 10 Sonnet). La auditoría final (Opus) no descuenta.

| Trabajo | Agente / modelo | Esfuerzo | Peso | Entran en 40 |
|---|---|---|---|---|
| Buscar, listar, leer, extraer un dato, contar | **`buscador`** (Haiku 5.5, nuevo) | medium | 1 | 40 |
| Escribir, programar, analizar UNA fuente, investigar un frente | `investigador` / `explorador` (Sonnet 5.5) | xhigh | 4 | 10 |
| Criterio, cruzar fuentes, decidir, auditar contenido | `investigador` con Opus 5.5 | xhigh | 8 | 5 |
| Revisor independiente de un cambio grande | `investigador` con Fable 5.1 | xhigh | 20 | 2 |
| Auditoría final de una tarea de código | `auditor` (Opus) | xhigh | 0 | siempre |

La llamada puede bajar el esfuerzo (low, medium, high) pero nunca pedir `max` (Fak, 30/09: «el
anteúltimo»). Escapes: `.agent-limit` (N Sonnet = N×4 puntos, 12 h) y `.agent-opus-ok` (Opus y Fable
descuentan como Sonnet, 12 h); los escribo yo cuando Fak lo pide textual. La sesión principal sigue en
Opus 5.5 por defecto y en Fable para mejoras grandes de código (decisión del 04/09, no cambia). Lo que
mide si está bien calibrado: `scripts/_tokens.mjs`, que desde hoy cuenta cada mensaje una sola vez
(antes inflaba 2,15 veces).

Lo que NO se hace: el «advisor tool» de la API no existe en Claude Code (es una herramienta de la API:
un modelo barato ejecuta y consulta a uno caro). Donde sí sirve es en la noche de Claude: el refutador de
la pre-auditoría puede ser Sonnet con Opus de asesor. Va en la fase 3, cuando haya clave.

### 1.2 Dos circuitos de actualización, no uno

| Circuito | Entre quiénes | Qué viaja | Cómo |
|---|---|---|---|
| **Mis PC** (Ingeniería y CATA) | las PC de Fak, con su cuenta | memoria, reglas, skills, agentes, comandos, hooks, planes, claves | `node scripts/_nube.mjs --sincronizar`: baja y sube, gana el archivo más nuevo, no borra nunca; tarea de Windows «Barack - mi asistente al dia» al iniciar sesión y cada 2 h |
| **El equipo** (Carlos, Federico, Pedro) | de Fak hacia ellos | lo de Ingeniería filtrado por persona: memorias de empresa (sin lo personal de Facundo), texto de las skills, los dos ayudantes, el CLAUDE.md de la persona | el publicador firmado que ya existe (`scripts/_paquete.mjs`: versión, firma Ed25519, rollback, nunca pisa lo que la persona cambió), con un proyecto nuevo `equipo` y SIN hooks ni plugin |

De ellos hacia Fak: `--aportar` deja la mejora en `BUZON\aportes\<autor>\`; `vigia.mjs` me la muestra al
arrancar; yo la reviso contra el repo y, si entra, va a la próxima versión. **Fak decide con una línea
mía («Carlos mandó X; ¿entra?»)**, no revisando archivos.

«100 % probado» para el circuito del equipo significa, en este orden: pruebas del repo en verde, el
filtro `validarTexto` (nada de Facundo en el paquete), el ensayo de instalación en una PC de mentira, y un
auditor Opus que lea el candidato. Recién después se publica. Es lo que ya se hacía en el proyecto por
área antes de cada versión (bloques del 03 al 06/10 en `project_claudes_por_area`).

### 1.3 GitHub y Supabase: qué son y qué no

- **GitHub** es el código: el repo público `facussc24/tiempos-y-balanceos`, su CI y el deploy de la app
  a GitHub Pages. Las PC de Fak lo clonan y lo traen al día (`git pull --ff-only` cuando el árbol está
  limpio, dentro de `--sincronizar`). Carlos, Federico y Pedro reciben un `repo.zip` adentro del paquete
  firmado, porque la red de la empresa puede bloquear GitHub y ellos no usan git. **GitHub nunca lleva
  memoria, configuración ni claves**: el repo es público (decisión de Fak del 18/08, regla
  `git-deploy.md`).
- **Supabase** es la base de los documentos APQP (AMFE, Plan de Control) y nada más. Las claves viajan
  solo entre las PC de Fak (en `Claude Fak`, por decisión suya del 03/09). No es un canal de
  configuración ni un registro de PC: eso lo hace la nube, que ya está en todas las PC y no pide claves.
  La noche de Claude la lee en solo lectura (`supabaseSoloLectura.mjs`).
- **La nube de Ingeniería** (SharePoint sincronizado) es el único canal entre PC: memoria y
  configuración de Fak, paquete del equipo, buzón, mails del equipo. Es la que ve todo el mundo sin
  instalar nada.

### 1.4 La nube: una sola carpeta para todo lo de Claude

Hoy lo de Claude está repartido en ocho carpetas de la raíz de la biblioteca (`0- INSTALAR CLAUDE`,
`ACTUALIZACION_CLAUDE_LIMPIO`, `Base Claude Ingenieria`, `Claude Fak`, `INSTALAR EN UNA PC NUEVA`,
`_CUARENTENA_CLAUDE POR AREA`, `_CUARENTENA_Claude Barack`, más `FACUNDO`). Propuesta (es la biblioteca
compartida y mover rompe programas que buscan por nombre: **se hace con el OK de Fak**, con un script que
primero muestra qué movería):

```
Ingeniería y Proyecto - General\
  CLAUDE BARACK\
    1- INSTALAR (doble clic)\       lo que hoy está en INSTALAR EN UNA PC NUEVA + los .cmd de Carlos y Federico
    2- EQUIPO (publicado)\          el paquete firmado del equipo (versión, novedades, historial)
    3- BUZON (lo que mandan las PC)\ salud, aportes, avisos
    4- MAILS DEL EQUIPO\            lo que hoy está en _CUARENTENA_Claude Barack\mails (Carlos, Calidad, Fak)
    5- FACUNDO (memoria y configuración)\  lo que hoy es Claude Fak (permiso solo para él)
    9- VIEJO (no usar)\             las dos _CUARENTENA_ (sin los mails), Base Claude Ingenieria, 0- INSTALAR, ACTUALIZACION_CLAUDE_LIMPIO
```

Regla: cada carpeta con un `LEEME.txt` de cinco renglones; nada de Claude afuera de `CLAUDE BARACK\`.
Programas que buscan por nombre y hay que tocar en la misma tanda: `scripts/_lib/nubeRutas.mjs`
(`Claude Fak`), `scripts/_mails.py` y `tools/claude-area/mails_solo` (la carpeta de mails: la tarea de
Carlos la busca por nombre y hay que regenerar su `Mails-Carlos.cmd`), `tools/instalar_mi_pc/publicar.mjs`,
`tools/claude-area/mails_pc/publicar.mjs`, `tools/claude-area/vigia.mjs` (el buzón). Lo que hoy funciona
(los mails de Carlos y de CATA subiendo) no se corta: primero se publica el programa que busca en los dos
lugares, después se mueve.

### 1.5 La noche de Claude (créditos de la API)

Ya existe (`scripts/_nocturno.mjs`, regla `api-claude.md`): pre-auditoría de AMFE en solo lectura, una
línea por mail sin respuesta, novedades de Claude. Falta la clave: Fak la crea en platform.claude.com
y la pega con `node scripts/_claude.mjs --pegar-clave`; la tarea de las 06:30 se agenda sola.

Lo que se le suma, siempre «solo lectura + propuesta para la mañana», nunca aplicar:

1. **Propuestas sobre las skills**: un modelo lee cada SKILL.md contra sus casos de uso recientes y deja
   en `.sgc-cache/api/propuestas/` qué mejoraría; yo las miro a la mañana. Nada se edita de noche.
2. **Prioridades del día**: cuatro renglones (urgencia, pendientes de Ingeniería, mails que esperan,
   estado de la noche) para el arranque de la sesión y para Fak si lo pide.
3. **Novedades de Claude** más seguido: changelog y cuentas oficiales a diario (Haiku, barato), el resumen
   largo los lunes.
4. **Advisor tool** en el refutador (Sonnet ejecuta, Opus asesora) cuando esté medido que da igual
   resultado más barato.

Lo que NO: diseños 3D de noche (Fak mismo lo bajó de prioridad; y la noche no toca el repo ni los
archivos de trabajo), escribir en Supabase, el arb u Outlook (candados de `api-claude.md`).

### 1.6 Lo «restrictivo» en la notebook de Calidad y en la PC de Pedro

Dos causas distintas, las dos ya con solución:

1. El paquete «por área» en cuarentena quedó instalado en CATA (Gemini mandó a instalarlo el 07/10): su
   aviso de arranque dice «no instalo programas». `Instalar-Mi-PC.cmd` lo apaga (plugin y tarea). El
   instalador de Pedro hace lo mismo en su PC.
2. En CATA una sesión en `C:\Dev` corrió en modo **auto** de Claude Code: un clasificador de fábrica frena
   escrituras en sistemas externos (el IMDS). No es nuestro. Solución: modo Omitir permisos en esa
   carpeta, o la regla `autoMode.allow` escrita en `FACUNDO\Error IMDS - freno de permisos 08-10-2026.md`.

Lo que sí es nuestro y hay que revisar (fase 3): los guardianes de ESTE repo viajan con «mi asistente
completo». Están calibrados para frenar lo irreversible (mails, servidor, arb, Supabase). Se audita que
ninguno conteste «no puedo» sin dar el camino (regla de Fak, 06/10: «un control que contesta no puedo es
un error mío de diseño»).

### 1.7 El mail que no vi: hilos abiertos

`scripts/_hilosAbiertos.mjs`: por cada tarea abierta del Escritorio (a la vista y en `_EN ESPERA`), lee
los `.msg` que la originaron, arma la clave del hilo y busca en `.mail-cache/mails.jsonl` los mails de
ese hilo **posteriores** al último `.msg` guardado. Si hay, lo dice al arrancar la sesión (una línea por
tarea) y el detalle con `node scripts/_hilosAbiertos.mjs`. Es la red para el caso de Carlos y el
consumo: la respuesta llegó, la tarea seguía abierta y nadie cruzó las dos cosas.

## 2. Fases

**Fase 1 — hoy, 08/10 a la noche (esta sesión, código del repo, sin tocar nube ni PC ajenas):**
ruteo de agentes y guardián; `--sincronizar` + tarea para las PC de Fak; hilos abiertos; tests; build;
commit; push; auditor.

**Fase 2 — viernes 09/10 (cupo renovado a las 13:00, clave de API):** el circuito del equipo (proyecto
`equipo` del publicador, contenido por persona, tarea sin hooks, ensayo, auditor); la carpeta
`CLAUDE BARACK\` de la nube con el OK de Fak (script `--simular` primero); pegar la clave y correr la
primera noche a mano con `--simular`.

**Fase 3 — la semana que viene:** la noche ampliada (propuestas de skills, prioridades, novedades
diarias, advisor); auditoría de los guardianes («no puedo» → camino); telemetría de agentes
(`scripts/_tokens.mjs` cuenta 2,15 veces cada turno: arreglarlo antes de decidir con sus números).

## 3. Bordes (edge cases) y cómo quedan cubiertos

| Borde | Qué pasa si no se piensa | Cómo queda |
|---|---|---|
| Dos PC de Fak editan la misma memoria el mismo día | el espejo (`/MIR`) de una PC borra lo de la otra | `--sincronizar` no usa espejo; gana el más nuevo por archivo; antes de pisar un archivo local editado después del último sync, guarda copia en `_conflictos\<PC>\<fecha>\` |
| `settings.json` tiene rutas de la PC de origen | en CATA los hooks apuntan a `C:\Users\FacundoS-PC` | `settings.json` no entra en `--sincronizar`; lo ajusta `ajustar_settings.mjs` al instalar |
| `.mail-cache/mails.jsonl` lo escriben las dos PC | cada sync pisa el buzón de la otra | los caches (`.sgc-cache`, `.arb-cache`, `.mail-cache`) quedan solo en `--subir` / `--bajar` a mano |
| OneDrive bajó la nube a medias | se instala una versión incompleta | el publicador verifica todos los hashes antes de tocar y `VERSION.json` se escribe al final |
| Un archivo de la nube alterado por alguien | una PC instala algo que nadie publicó | firma Ed25519: sin firma válida no se toca nada; la versión nunca retrocede |
| Lo de Facundo se filtra al paquete del equipo | el Claude de Carlos cree que es Facundo (pasó el 07/10) | `validarTexto()` frena el armado si queda mail, ruta, «Fak» o una regla personal |
| Las claves viajan al equipo | Supabase y QR en la PC de Carlos | el proyecto `equipo` no tiene `.env.local` ni `.qr-secret` en su lista; `--publicar` se niega si detecta secretos |
| Los hooks viajan al equipo | el «virus» del 07/10 otra vez | el proyecto `equipo` no publica hooks ni plugin: solo memoria, skills, agentes y el CLAUDE.md de la persona |
| La red bloquea GitHub en una PC | el instalador no puede clonar | `instalar_mi_pc.ps1` lo dice; el equipo recibe `repo.zip` por la nube |
| Dos PC con `git` sobre el mismo `main` | commits cruzados, push rechazado | `--sincronizar` trae solo con `--ff-only` y árbol limpio; si hay commits sin pushear, avisa (ya lo hacía) |
| La tarea corre antes de que OneDrive termine de bajar | sincroniza con una nube vieja (le pasó a Pedro el 06/10) | la tarea de Fak corre al iniciar sesión **con demora** y cada 2 h; `_nubeSubio.ps1` mide si subió |
| Carlos mueve de lugar o renombra una memoria que le llegó | la próxima versión se la vuelve a poner | el publicador deja la nueva al lado como `.fak-nueva` y lo anota; nunca pisa lo que cambió la persona |
| La nube se reordena y un programa busca por el nombre viejo | los mails de Carlos dejan de subir sin aviso | primero se publica el programa que busca en los dos nombres, después se mueve; la salud de cada PC lo muestra |
| Un `.msg` del Escritorio es un puntero de OneDrive | leerlo baja megas al arrancar la sesión | `_hilosAbiertos` guarda lo leído por ruta, fecha y tamaño en `.claude/state/`; cada `.msg` se lee una vez |
| Muchos Opus en paralelo | se va el cupo semanal en una tanda | cupo de 3 Opus/Fable por ventana de 10 minutos; `.agent-opus-ok` lo levanta 12 h si Fak lo pide |
| La noche gasta de más | se van los $200 en una semana | tope mensual pasivo (`BARACK_API_PRESUPUESTO_USD`), ledger por llamada; en rojo no arranca |
| El clasificador del modo auto frena una tarea en CATA | la sesión queda esperando un cartel | en las carpetas de trabajo de Fak va Omitir permisos; la regla `autoMode.allow` queda escrita por si vuelve a elegir auto |

## 4. Lo que necesita a Fak (y nada más)

1. Crear la clave de API en platform.claude.com y pegarla: `node scripts/_claude.mjs --pegar-clave`.
2. Decir «sí» a la carpeta `CLAUDE BARACK\` de la nube cuando le muestre el `--simular`.
3. Decir «sí» al circuito del equipo antes de que la primera versión le llegue a Carlos (es la primera
   vez de este canal y toca su PC).
4. En CATA: hacer doble clic en `Instalar-Mi-PC.cmd` (apaga el asistente recortado) y elegir Omitir
   permisos en la carpeta `C:\Dev\BarackMercosul`.
