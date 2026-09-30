# Base de Claude para el equipo — lo que falta (30/09/2026)

Hecho: `scripts/_paquete.mjs` (`--publicar --ver --actualizar --aportar --aportes --perfil`), la lista en `scripts/_lib/paquete.data.json` y `__tests__/scripts/paquete.test.mjs`. Nada se publicó en la nube real.

## Falta construir
1. **Instalador del pendrive** (`Instalar.ps1` + doble click). Receta: `--publicar --nube <pendrive>\Base` arma la carpeta y el instalador corre `node <pendrive>\Base\contenido\scripts\_paquete.mjs --actualizar --nube <pendrive>\Base --destino <carpeta>`. Si no hay `CLAUDE.md` en el destino, lo crea con `@CLAUDE.equipo.md`; si hay, no lo toca. Pide nombre y sector y corre `--perfil`.
2. **Tarea de Windows**. Copiar el registro de `C:\Dev\barack-claude\instalador\Instalar-ClaudeBarack.ps1` líneas 399-445: `Register-ScheduledTask`, `-AllowStartIfOnBatteries -DontStopIfGoingOnBatteries`, `-MultipleInstances IgnoreNew`, S4U (sin ventana) con el plan B `Interactive`, y la comprobación de que corrió. Cambiar: acción `conhost.exe --headless node scripts\_paquete.mjs --actualizar`, límite 45 min, prioridad baja (`-Priority 7`, verificar en una PC de prueba), cada pocas horas. El script sale con 3 cuando OneDrive no terminó de bajar: no es un error, se reintenta solo.
3. **Mails**. Reusar `plugins\barack-core\scripts\mails_sync.py` y `barack_rutas.py` (`clasificar_local`: privado no sube, cuarentena aparte, entrada; `privados.json`) y el `Correr()` con tope de minutos y el log de `instalador\sync.ps1`. Sube a `<nube>\mails\_entrada|_cuarentena\<usuario>`. Dejar afuera política, perfiles y marketplace. Va en su propio archivo: NO se nombra en `CLAUDE.equipo.md`, ni en reglas sin `paths:`, ni en descripciones de skills (Fak, 30/09). Tampoco se escribe ninguna instrucción que lo oculte o lo niegue: si el compañero pregunta, su Claude lo investiga y le contesta.
4. **`CLAUDE.equipo.md`** (hoy no existe; está en la lista como opcional). Criterio de la base en palabras neutras, más la parte de aportes de abajo.
5. **Permisos en SharePoint**: `contenido\`, `MANIFIESTO.json`, `VERSION.json` y `NOVEDADES.md` solo Fak (lectura para el resto); `aportes\` con escritura para todos. Fak crea una vez la carpeta `Base Claude Ingenieria` en la biblioteca (primera vez: se pregunta).
6. **Probar en una segunda PC** antes del pendrive: `--publicar`, `--actualizar`, tocar un archivo, republicar, `--actualizar` de nuevo.

## Antes de la primera publicación real (lo decide Fak)
- El filtro hoy frena 3 líneas: `.claude/rules/arb-no-cerrar.md:30`, `scripts/_arbLanzar.py:332-333` (nombre de la PC de Fak). Hay que escribir "el nombre de la PC" sin el nombre; `_arbLanzar.py` lo está tocando otra sesión.
- Revisar cada entrada con `revisar` y las que quedaron en `candidatos` (hojas de proceso, patrones de corte, AMFE, IMDS, PPAP, CAD).
- Límites conocidos: los imports de Python no se verifican (solo los de `.mjs`); `--publicar` avisa qué archivos nombrados por las skills no viajan (13 hoy: `_bomLegajo.py`, `_mails.py`, `_flujograma.mjs`...).

## Aportes de los compañeros (idea de Fak, 30/09)
- **Cómo sabe su Claude quién es**: la primera vez no existe `.claude/perfil-equipo.json`. Claude pregunta "¿Cuál es tu nombre y apellido y tu sector?" y corre `node scripts/_paquete.mjs --perfil "Nombre Apellido - Sector"` (ej. "Federico Leonardo Lattanzi - Ingenieria"). Queda solo en esa PC. `--aportar` lo usa si no se pasa `--autor`.
- **La pregunta, textual**, cuando termina algo que puede servir a otros: "Esto que hicimos puede aportar valor a otros usuarios, ¿querés compartirlo en la nube?" Solo con un sí corre `node scripts/_paquete.mjs --aportar <ruta> --que "<qué es, en una frase>"`.
- Va a `<nube>\aportes\<Nombre - Sector>\<AAAA-MM-DD>-<nombre>\` con un `LEEME.md`; nunca a `contenido\`, nunca pisa un aporte anterior (agrega `-2`), y pasa por el mismo filtro de secretos que `--publicar` (más el usuario y la PC de quien aporta). Rechaza `.env`, `settings.json`, claves, ejecutables y buzones.
- Fak mira con `node scripts/_paquete.mjs --aportes` (por autor) y, si lo quiere, pasa el archivo a `incluir` y publica. Falta decidir cómo marcar lo ya revisado.
