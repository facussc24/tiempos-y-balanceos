# Una sola nube: la de Ingeniería. En la nube personal de Fak no se guarda nada (always-on)

**Regla dura de Fak, 01/10/2026:** *"no quiero nada en mi nube personal... por ahora solo laburamos
en la nube de ingeniería... dejalo bien anotado como regla dura, no podemos volver a fallar"*.
Esta regla no lleva `paths:` a propósito: entra en todas las sesiones.

## Cuál es cuál

En la PC hay dos carpetas de OneDrive con nombre parecido. Las dos son de la empresa.

| Carpeta en la PC | Qué es | Quién la ve | ¿Se guarda ahí? |
|---|---|---|---|
| `BARACK ARGENTINA SRL\Ingeniería y Proyecto - General\` | **La nube de Ingeniería**: la biblioteca del sector | Todos los de Ingeniería | **SÍ. Todo va acá** |
| `OneDrive - BARACK ARGENTINA SRL\` | La nube de la **cuenta** de Fak (la "personal") | Solo Fak, y cualquier PC donde ponga su cuenta | **NO. Nada nuevo** |

## La regla

1. **Todo lo que guardo en una nube va a la de Ingeniería**, en su carpeta por tipo.
2. **En la nube personal no se crea, no se copia y no se mueve nada.** Leer de ahí y sacar cosas
   de ahí sí.
3. **Si Fak dijo dónde, es ahí** (lección del 30/09: pidió "en la nube del laburo" y lo quise
   llevar a la personal). No se elige otro lugar ni se vuelve a preguntar.
4. **"Está en la nube" se dice después de medirlo**: guardar en la carpeta sincronizada es guardar
   en la PC. `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/_nubeSubio.ps1` (sale con
   0 si subió todo).

## Las skills y la configuracion van a la nube de Ingenieria, para sincronizar las notebooks (Fak, 23/10/2026)

*"Me gustaría volver a subir la inteligencia a la nube para sincronizar entre mis notebooks... ya fue, skills todo;
necesito que mis notebooks siempre estén sincronizadas"*. Skills, reglas, agentes, comandos, hooks, planes y el settings
van a `claude-config\` de `ASISTENTE INGENIERIA\5- FACUNDO (memoria y configuracion)\`, junto a la memoria, los registros
de las charlas y las claves (`repo-privado\`, como siempre). Nunca a la nube personal.
- **Cada notebook las baja** con `node scripts/_nube.mjs --bajar --aplicar`. Necesita el repo clonado de GitHub (con este
  cambio traido por `git pull`), Node y la biblioteca de Ingenieria sincronizada con la cuenta de Fak. La tarea de cada
  2 h (`--sincronizar`) las intercambia sola: gana el mas nuevo, nada se borra. El settings va solo con `--subir`/`--bajar`
  (trae rutas de la PC de origen; al bajar se ajusta a la PC).
- **Los mods no van por la nube**: su fuente viaja por GitHub (`mods/`) y cada PC los instala con
  `node scripts/_modsInstalar.mjs --aplicar` (esa copia la cambia solo el instalador, que valida y prueba antes).
- En codigo: `scripts/_lib/soloLocal.mjs` (listas de solo-local vacias; test `soloLocal.test.mjs`). Los armadores de
  asistentes para compañeros siguen sin escribir en una nube.
- Historia: del 20 al 23/10/2026 estuvieron solo en las PC (*"quiero tenerlas en local"*) y viajaban por pendrive
  (`scripts/_pendriveAsistente.mjs`, que sigue andando para una PC sin la biblioteca). Memoria
  `feedback_skills_solo_en_la_pc_no_en_la_nube` (al pie, lo revertido).

## Lo que hoy sigue en la nube personal (falta mudar; cada mudanza con el OK de Fak)

| Qué | Dónde está hoy | Estado |
|---|---|---|
| Mi memoria y la configuración de Claude | **Mudada el 01/10/2026** a la nube de Ingeniería (aprobada por Fak) y el **17/10/2026** a la carpeta única: `BARACK ARGENTINA SRL\Ingeniería y Proyecto - General\ASISTENTE INGENIERIA\5- FACUNDO (memoria y configuracion)\` (todo lo del asistente vive en `ASISTENTE INGENIERIA`; cada carpeta, nueva y vieja, en `scripts/_lib/nubeCarpetas.data.json`). Sin permiso especial: Fak decidió que no hace falta (*"ya fue la privacidad"*); no volver a proponerlo | En la personal queda la copia vieja `Barack-cerebro\`, congelada: ya no se escribe ahí. Sacarla es borrar: con el OK de Fak |
| El Escritorio (la cola de tareas) | `OneDrive - BARACK ARGENTINA SRL\Desktop\` | Lo guarda ahí Windows, no yo. Sigue funcionando como está hasta que Fak decida |
| La copia de `docs-local` | `OneDrive - BARACK ARGENTINA SRL\Barack-docs-local\` | Sin mudar |

Cuando algo de esta tabla se muda, se saca de la tabla y de `NP_TRANSICION` en el guardián.

## Con Fak se habla en castellano simple

- No se le dice "el cerebro": es **"mi memoria"** (lo que aprendí trabajando con él) y **"la
  configuración"**. Fak, 01/10/2026: *"no me hace preguntas pelotudas tipo cerebro, o sea qué carajo"*.
- **Una PC nueva se arma sola**: baja lo que le falta sin preguntarle y avisa en una línea. Si no
  puede (la carpeta no está sincronizada en esa PC), le dice exactamente qué tiene que abrir y dónde
  hacer clic, sin jerga.

## Enforcement

- **Hook `nube-personal-guard`** (PreToolUse, `Bash|PowerShell|Write|Edit`, dentro de `_dispatcher.sh`;
  lógica en `scripts/_lib/guardianes.mjs`): bloquea guardar, copiar, mover o crear adentro de
  `OneDrive - BARACK ARGENTINA SRL\`. Deja pasar leer, sacar de ahí y el Escritorio.
  Probado en las dos direcciones: `__tests__/scripts/nubePersonalGuard.test.mjs`.
- Escape de un solo uso, solo si Fak dijo que ESE archivo va ahí: `: > ~/.claude/.nube-personal-ok # Fak DD/MM HH:MM: "su frase"` (la cita de ESE turno va en el mismo comando: `autonomy-contract.md` §G).
- Límite conocido: el guardián mira el texto del comando; un script que escribe ahí por dentro no
  lo nombra. Por eso `_nube.mjs` resuelve su destino con `buscarNube()` (`scripts/_lib/nubeRutas.mjs`),
  que devuelve SIEMPRE una ruta de la biblioteca de Ingeniería (test `nubeRutas.test.mjs`).
- Memorias: `feedback_solo_nube_de_ingenieria`, `reference_onedrive_dos_carpetas_barack`,
  `reference_onedrive_sync_colgado_como_detectarlo`.
