# El código es sagrado: cada cambio con evidencia, plan a su medida, tests y revisor (always-on)

Fak, 09/10/2026 00:20, dejándome la noche: *"a partir de ahora el código madre es sagrado... mejoras o
correcciones deben ser analizadas, no pueden modificar todo el código sin evidencia... no quiero parches,
quiero decisiones tomadas en base a investigaciones"*. Él trabaja sobre este código todos los días.
Esta regla no lleva `paths:` a propósito: entra en todas las sesiones. El detalle y las fuentes:
`docs/PLAN_CLAUDE_BARACK_SISTEMA_2026-10-08.md` §1.8 a §1.10.

## El tamaño del cambio decide el camino (criterio oficial de Claude Code: «si el diff se describe en una oración, no hace falta plan»)

| Tamaño | Qué es | Camino obligatorio |
|---|---|---|
| **Chico** | un archivo, el diff cabe en una oración, no cambia lo que ve Fak (typo, texto de un aviso, un log, renombrar) | hacerlo directo · test del módulo si toca lógica · `npm run build` si toca la app · commit con rutas |
| **Mediano** | varios archivos, o cambia un comportamiento, o toca un hook, un guardián, una regla o `settings.json` | **plan corto escrito ANTES** en el chat (qué, por qué, evidencia, qué tests, qué puede romper) · leer entero cada archivo que se toca · tests de los módulos tocados · build · **auditor Opus** · commit con rutas · decir si las sesiones abiertas lo toman solas |
| **Grande** | una feature, un refactor, algo del sistema Claude que Fak usa a diario, o cualquier cosa que no puedo nombrar un caso anterior | investigación con fuentes → plan en `docs/` → **síntesis corta a Fak y su sí** → worktree o sesión aparte → tests + build → **revisor independiente** (auditor Opus; Fable si cambia la arquitectura) → commit → aviso de sesiones abiertas |

Reglas que valen para los tres: se lee el código completo antes de editar; **sin evidencia no se cambia**
(un informe de agente, una memoria o "me parece" no alcanzan: se abre la fuente o se mide); nada de
`as any`, `@ts-ignore` ni datos mock; lo que afloja un control lo prueba OTRO (`LECCIONES`); el commit
siempre con rutas (`git-deploy.md`). Ante la duda del tamaño, el camino más largo.

## Los pedidos chicos de Fak durante la semana

Cuando Fak encuentra algo mientras labura («cambiá esto», «esto no anda»), **no se corrige dentro de la
sesión de la tarea de Barack**: mezclar tareas llena el contexto de cosas ajenas (doc oficial: «kitchen
sink session»). Va a la cola **`docs/COLA_CAMBIOS_CODIGO.md`** con sus palabras, la fecha y el tamaño
estimado, y se le dice en un renglón que quedó anotado. Se hace en una sesión de código, de a uno, por
el camino de su tamaño. **Excepción**: si el defecto frena la tarea que Fak está haciendo, se arregla
ahí mismo por el camino chico y se anota igual. Al abrir una sesión de código se lee la cola primero.

## Dónde y con qué

- El código se toca en `C:\Dev\BarackMercosul` (los hooks y guardianes viven acá); cambios en paralelo,
  cada uno en su worktree; las tareas de Barack (AMFE, mails, arb) en otra sesión.
- Sesión principal de código: **Opus 5.5**. **Fable 5.1 solo para casos específicos**: un cambio de
  arquitectura del repo o del sistema Claude, una investigación de varias horas, o cuando Opus falló dos
  veces en lo mismo (guía oficial: «la mayoría de los trabajos arrancan con Opus 5.5; si en xhigh o max
  todavía falta, pasar a Fable 5.1»). Subagentes según `techo-agentes.md`.
- No hace falta permiso de administrador ni otra carpeta para nada de esto.
