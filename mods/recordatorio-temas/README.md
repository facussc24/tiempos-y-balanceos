# recordatorio-temas (tanda 1.3.2 del plan del sistema, 16/10/2026)

Mod de Claude Code. Cuando un mensaje de Fak nombra un tema de la casa («el plotter de corte», «el otro plotter», «la hotmelera», «lo del tornillo CNC», «valores de costura IP PAD», «el 8D de la tapa»...), le agrega al modelo un `context` de un renglón por tema: *Tema «X»: leé `<ruta absoluta de la memoria>` antes de contestar.* No frena nada (siempre `next(e)`), no manda nada afuera.

Por qué: de 6 olvidos medidos, en 2 la memoria existía, estaba nombrada y no se leyó; nada en la casa la disparaba al nombrar el tema (informe `casa_memoria_olvidos.md`, nube de Ingeniería, `Claude Fak\viernes-17-plan-sistema\20-informes\`).

- **Temas y palabras**: `scripts/_lib/temasCanon.data.json` (en el repo, no en el mod). La cáscara lo lee en cada mensaje desde la raíz del proyecto de la sesión (`$.session.root()`): se edita en un solo lugar y lo prueban los tests. Una sesión fuera del repo no tiene canon y el mod calla.
- **Comparación**: por palabras enteras, sin acentos ni mayúsculas; el guion bajo queda adentro de la palabra (`IMG_0585` no es la moldeadora IMG). Lo específico sale antes que «el plotter» a secas; como mucho 3 temas por mensaje.
- **Una vez por hora por tema y por sesión** (`$.store`, clave `temasAvisados`, podada a 24 h): Fak habla con varias sesiones a la vez.
- **Solo lo que escribe Fak**: se descartan los orígenes `task-notification`, `scheduled-trigger`, `peer`, `peer-send-message`, `coordinator`, `plugin` y parecidos (lista en `hooks/temas.mjs`), los `isMeta` y los comandos de barra. El encargo de una sesión madre nombra los mismos temas y no es una pregunta de Fak. Con qué origen manda la app de escritorio un mensaje de Fak no está medido (16/10): el registro anota `origen=` en cada mensaje para saberlo.
- Parte pura: `hooks/temas.mjs` (sin `$`). Test con los mensajes reales de Fak: `__tests__/mods/recordatorio-temas.test.mjs`.
- Cáscara: `hooks/register.js` (`session.start`, `prompt.submit`). Test con el motor de Claude Code: `tests/recordatorio-temas.test.ts` (`claude plugin test mods/recordatorio-temas`; lo corre el instalador).
- Registro: `~/.claude/mods-log/recordatorio-temas.log`, una línea por mensaje (`AVISO <temas>`, `ningun tema`, `no es de Fak`, `sin canon`).

## Instalar, ver el estado y volver atrás

```bash
node scripts/_modsInstalar.mjs --aplicar   # valida, prueba, copia a ~/.claude/mods-casa, instala y verifica
node scripts/_modsInstalar.mjs --estado
claude plugin disable recordatorio-temas@mods-casa   # apagar solo este
```

Lo toman las sesiones NUEVAS; una ya abierta, con `/reload-plugins`.
