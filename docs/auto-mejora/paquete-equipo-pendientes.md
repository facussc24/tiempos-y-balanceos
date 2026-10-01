# Base de Claude para el equipo — estado al 30/09/2026 (noche)

Nada se publicó en la nube real ni se tocó el pendrive. Todo lo de abajo está probado con nubes y pendrives de mentira.

## Hecho
- **Mecanismo**: `scripts/_paquete.mjs` (`--publicar --ver --actualizar --aportar --aportes --perfil`, más `--pendrive <carpeta>` y `--donde`), lista en `scripts/_lib/paquete.data.json`, tests `__tests__/scripts/paquete.test.mjs`.
- **Instalador del pendrive**: `tools/paquete-equipo/Instalar.cmd` + `Instalar.ps1` + `LEEME.txt`. Pide nombre y sector, elige carpeta (`C:\Dev\BarackMercosul` si existe, si no `C:\Dev\BarackIngenieria`), copia la base sin pisar, agrega `@CLAUDE.equipo.md` al `CLAUDE.md`, revisa Node/Python/pywin32 y registra la tarea `Barack - Base Claude y mails`. Flags: `-SinTareas`, `-VerTarea`, `-Destino`, `-Nombre/-Sector`, `-Base`, `-EstadoDir`, `-SinChequeos`.
- **Sincronización**: `tools/paquete-equipo/sync_equipo.ps1` (baja la base con `_paquete.mjs --actualizar` y sube los mails) y `mails_equipo.py` (con el filtro de lo privado y la cuarentena, ver abajo). Viajan por la nube: una corrección llega sola.
- **`CLAUDE.equipo.md`**: criterio de trabajo + cómo actualizar + `.fak-nueva` + aportes. No nombra la subida de mails (un test lo vigila).
- **Filtro**: las 3 líneas con el nombre de la PC de Fak ya están corregidas (`arb-no-cerrar.md`, `_arbLanzar.py`); `--publicar --simular` pasa limpio.
- **Decisiones de la lista** (`candidatos`): está escrito en `decisiones` de `paquete.data.json`.

## Cómo lo usa Fak
1. Crear una vez la carpeta `Base Claude Ingenieria` en la biblioteca de Ingeniería (primera vez: se pregunta) y dejar ahí `privados.json` (la lista de direcciones de Dirección/RRHH/sueldos; sin ese archivo los mails NO suben). Permisos: `contenido\`, `MANIFIESTO.json`, `VERSION.json`, `NOVEDADES.md` y `privados.json` solo Fak; `aportes\` y `mails\` con escritura para todos.
2. Para el pendrive: `node scripts/_paquete.mjs --pendrive D:\` (la carpeta tiene que existir). Deja `D:\Base\` + `Instalar.cmd`, `Instalar.ps1`, `LEEME.txt`.
3. Para la nube: `node scripts/_paquete.mjs --publicar --nota "qué cambió, simple"`.
4. Lo que mandan los compañeros: `node scripts/_paquete.mjs --aportes`.

## Lo que sigue abierto (decide Fak)
- **Mails**: los compañeros que tengan la tarea vieja `Claude Barack - sync` (Lucca) suben a otra carpeta (`Claude Barack\mails\`). La nueva sube a `Base Claude Ingenieria\mails\_entrada\<Nombre Apellido - Sector>\` (desde el 01/10/2026 la cuarentena —sueldos, licencias, sanciones— no sube: quedaba a la vista de todo el que tiene la biblioteca). Hay que sacar la vieja a mano (el instalador solo avisa) y decidir si lo que ya está en `Claude Barack\mails\` se mueve.
- **privados.json**: el que existe en `Claude Barack\` tiene 3 direcciones en TBD (dueño, RRHH, sueldos). Hasta completarlas **no sube ningún mail** (desde el 01/10/2026 el script se niega con un filtro sin completar: sale con 5 y lo dice).
- **Primera pasada de mails**: mira hasta 90 días hacia atrás (después, solo lo nuevo). Se cambia en `mails_dias` de `perfil.json`.
- **Outlook**: solo se sube si Outlook clásico YA está abierto (no se lo abre ni se muestra ventana). Si el compañero usa el Outlook nuevo, no sube nada; queda dicho en `%LOCALAPPDATA%\BarackEquipo\estado.json`.
- **Node** viaja en el pendrive desde el 01/10/2026 (`node\node.exe`, el mismo que corre `--pendrive`; pedido de Fak: *"¿el pendrive no puede instalar node si no lo tenés?"*). Si la PC no tiene Node, el instalador lo copia a `%LOCALAPPDATA%\BarackEquipo\node\`, lo suma al PATH del usuario y sigue; `sync_equipo.ps1` también lo busca ahí. Sin admin. Python + pywin32 siguen haciendo falta para los scripts del arb y los mails (avisa, pero instala igual): Python no viaja.
- **Prioridad baja**: la tarea corre con prioridad "debajo de lo normal". En una PC saturada (la de Fak hoy: `node --version` tardó 69 s contra 1,3 s) puede tardar mucho; el tope de 30 min la corta y se reintenta a las 4 h.
- **Accesos directos del arb** (`ARB.lnk`) y el vigilante: el instalador NO los crea; `_arbLanzar.py` viaja pero se lanza desde la terminal.
- **Fuera de la base pero nombrados por las skills** (`--publicar` los avisa, 13 hoy): `_bomLegajo.py`, `_mails.py`, `_flujograma.mjs`, `_consumo.py`, `arbRelaciones.py`... Los imports de Python no se verifican (solo los de `.mjs`).
- **Segunda PC real**: probar `--pendrive`, Instalar con doble click, tocar un archivo, republicar, esperar la tarea, antes de llevar el pendrive.

## Aportes de los compañeros (idea de Fak, 30/09)
- **Cómo sabe su Claude quién es**: el instalador lo guarda en `.claude/perfil-equipo.json`. Si no existe, Claude pregunta "¿Cuál es tu nombre y apellido y tu sector?" y corre `node scripts/_paquete.mjs --perfil "Nombre Apellido - Sector"`.
- **La pregunta, textual**, cuando termina algo que puede servir a otros: "Esto que hicimos puede aportar valor a otros usuarios, ¿querés compartirlo en la nube?" Solo con un sí corre `node scripts/_paquete.mjs --aportar <ruta> --que "<qué es, en una frase>"`.
- Va a `<nube>\aportes\<Nombre - Sector>\<AAAA-MM-DD>-<nombre>\` con un `LEEME.md`; nunca a `contenido\`, nunca pisa un aporte anterior (agrega `-2`), y pasa por el mismo filtro de secretos que `--publicar`.
- Fak mira con `node scripts/_paquete.mjs --aportes` y, si lo quiere, pasa el archivo a `incluir` y publica. Falta decidir cómo marcar lo ya revisado.
