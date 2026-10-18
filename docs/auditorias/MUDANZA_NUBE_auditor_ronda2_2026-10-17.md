# Auditoría de la rama `claude/mudanza-nube-1017`, ronda 2 (la última) — 18/10/2026, 00:30

### Resultado: se puede fundir, con un aviso · 1 Importante, 3 Nit (y 1 más), 2 Preexistente

Lo que se revisó es solo el diff nuevo, `6c1f9532..41e06577`: 13 archivos. Antes de escribir volví a correr
`git log main..HEAD`: sigue arriba `41e06577` y no entró nada más.

- Las tres Importante de la ronda 1 están cerradas. La respuesta de cada una quedó anotada en
  `docs/auditorias/MUDANZA_NUBE_auditor_ronda1_2026-10-17.md`.
- El diff nuevo no rompe nada.
- La Importante de esta ronda es de texto: el informe dice que ningún programa depende de `9- VIEJO`, y hoy dependen tres
  instaladores. El código hace lo mismo que hacía main con la cuarentena en la raíz.

| Check | Estado | Detalle |
|---|---|---|
| TypeScript | OK | 0 errores (`npx tsc --noEmit`) |
| Build | OK | `npm run build`: «built in 1m 40s» (solo el aviso de siempre por el tamaño) |
| Git local | OK | el worktree está limpio. Lo único sin seguir es el informe de la ronda 1, que es mío |
| GitHub sync | OK (a propósito) | la rama no está subida: la funde la sesión que la lanzó |
| CI | sin verificar para la rama | `candado.yml` completed success en `2da5783a` (main, la base); `deploy.yml` completed success en `411f200f`. El test nuevo de I2 llama a `python`. Simulé las rutas de Linux del CI y Python da lo mismo; el CI instala Python 3.12 |
| Tests pedidos | OK | 5 archivos, 648 tests (`nubeCarpetas`, `claudeAreaMails`, `paquete`, `claudeAreaInstalar`, `instalarMiPc`) |
| Tests de lo que toca el diff | OK | 8 archivos más, 374 tests: `paqueteEquipo`, `claudeAreaVigia`, `mailsPcCalidad`, `mailsSoloNube`, `firmaIAGuard`, `nubeOrden`, `nubeRutas`, `programita` |
| Hook | OK | `bash .claude/hooks/cerebro-guard.test.sh`: «OK — 17 casos» |
| Dependencias | OK | `npm ls --depth=0`: 0 UNMET/ERR/missing; el diff no toca `package.json` |
| Escrituras prohibidas | OK | el diff no agrega escrituras en Supabase, arb, `Y:`, Outlook ni la nube personal. Lo que corrí contra la biblioteca solo lee: `buscarNube`, `_sinFirmaIA.py --sin-avisos`, `ls` y `cmp` |

## Hallazgos Importante

### I4 · [Importante · informe] El informe dice que ningún programa depende de `9- VIEJO`, y tres instaladores la usan
- **Dónde:**
  - `docs/MUDANZA_NUBE_2026-10-17.md:147-149`, texto nuevo de este diff: «ningún programa depende de esa carpeta, y es así: los
    que publican o instalan no la buscan».
  - `:93`, también nuevo: «Los nombres en cuarentena y `9- VIEJO` están solo en el canon de la mudanza».
  - El LEEME de `9- VIEJO` dice lo mismo (`scripts/_lib/nubeOrden.data.json:66-67`): «para que ninguno dependa de esta
    carpeta» y «No ejecutar nada de acá».
- **Qué pasa** (todo medido en la biblioteca real, solo lectura):
  - `tools/claude-area/mails_pc/instalar.ps1:94-107` busca `mails_privados.json` primero en
    `9- VIEJO (no usar)\_CUARENTENA_CLAUDE POR AREA\1- PUBLICADO\…`. Si no la encuentra, frena: «no encuentro la lista de lo
    privado…», y no tiene respaldo en la PC.
    - La única copia publicada de esa lista está ahí: ninguna carpeta de primer nivel de la biblioteca tiene otra.
    - Es el `Mails-PC-Calidad.cmd` que el informe (`:130`) le manda a correr a CATA. La copia publicada de `instalar.ps1` es
      igual a HEAD.
  - `tools/instalar_mi_pc/instalar_mi_pc.ps1:90-107`: en una PC sin Node copia el `node.exe` de
    `9- VIEJO\_CUARENTENA_CLAUDE POR AREA\…\barack-area\bin\node.exe` (existe, 85 MB) y lo usa para bajar la memoria.
    - Si no lo encuentra, frena: «no encuentro Node.js».
    - La copia publicada (`1- INSTALAR (doble clic)\1- Mi asistente completo\programa\instalar_mi_pc.ps1`) es igual a HEAD.
    - La fila `:86` del mismo informe dice que toma «el Node del paquete viejo».
  - `tools/claude-area/mails_solo/instalar_mails_solo.ps1:67-75` y `:105` sacan de ahí las listas y el `node.exe`. Para las
    listas tiene respaldo en la PC.
- **No es una regresión:** main hacía lo mismo con la cuarentena en la raíz, porque recorre las carpetas de primer nivel. La
  rama mantiene ese comportamiento. Lo que está mal es lo que dice el informe.
- **Por qué importa:** el LEEME dice «Se borra solo con el OK de Facundo». Si se da ese OK leyendo este informe, al borrar o
  vaciar `9- VIEJO`:
  - Calidad se queda sin instalador de mails;
  - el instalador de una PC nueva sin Node se queda sin Node.
- **En la ronda 1 se me pasó.** El texto anterior ya decía «ninguno de los que están en uso la necesita». El diff nuevo lo
  afirma más fuerte.
- **Qué decidir** (no bloquea la fusión), una de dos:
  - decir en el informe y en el LEEME de `9- VIEJO` qué programas leen de ahí y qué se rompe si se borra;
  - o sacar de `9- VIEJO` lo que se usa (la lista de lo privado y el Node) a una carpeta en uso.
- respuesta: contestada en docs/MUDANZA_NUBE_2026-10-17.md, «Respuestas a las revisiones» (18/10)

## Hallazgos Nit (tope 3; y 1 más)

1. **[Nit · informe] La copia publicada de Mails de Calidad quedó con el `mails_area.mjs` de antes de la ronda 1.**
   - `…\1- INSTALAR (doble clic)\2- Mails de Calidad\programa\mails_area.mjs` es igual a la de `6c1f9532`: todavía lleva
     `_CUARENTENA_CLAUDE POR AREA` en `AREA_VIEJA_TRAMOS`.
   - `instalar.ps1`, `subir.ps1`, `mails_pc.mjs`, `mails_outlook.ps1` y `casillas.json` son iguales a HEAD.
   - Hoy no cambia nada. El camino de Calidad es `subir.ps1:101` → `mails_pc.mjs --carpeta-mails` →
     `carpetaDeMailsIndicada`, y no pasa por `AREA_VIEJA_TRAMOS`.
   - El informe (`:130`) dice «ya publicado con la versión nueva». Hay que republicar después de fundir
     (`tools/claude-area/mails_pc/publicar.mjs`).

   respuesta: contestada en docs/MUDANZA_NUBE_2026-10-17.md, «Respuestas a las revisiones» (18/10)
2. **[Nit · textos] Siguen describiendo lo que se revirtió:**
   - `tools/paquete-equipo/sync_equipo.ps1:16-18`, `tools/paquete-equipo/mails_equipo.py:27-29` y `:551` dicen que
     `_paquete.mjs --donde` busca «Base Claude Ingenieria» primero en `9- VIEJO`. Medido contra la biblioteca real:
     `buscarNube(home, 'ingenieria')` da null, aunque la carpeta está en `9- VIEJO`.
   - `tools/claude-area/ensayo_pc_nueva.sh:18-20` dice que el programa «lo sigue reconociendo, igual que el nuevo,
     _CUARENTENA_CLAUDE POR AREA» y que «lo comprueba claudeAreaInstalar.test.mjs». Ese test volvió a la versión de main y no
     nombra `ensayo_pc_nueva` (`grep` en `__tests__` da 0).
   - `tools/claude-area/mails_area.mjs`:
     - `:72-74` dice que los nombres coinciden con `area_vieja` del canon. Ya no coinciden, y es a propósito, como explica
       `:80`.
     - `:443-444` nombra «la que quedo en `ASISTENTE INGENIERIA\9- VIEJO (no usar)`». El test `:995` prueba que esa da null.

   respuesta: contestada en docs/MUDANZA_NUBE_2026-10-17.md, «Respuestas a las revisiones» (18/10)
3. **[Nit · robustez] `scripts/_nubeMudar.mjs`: los caminos nuevos no tienen test.**
   - `main()` con `--aplicar` sigue sin test (`grep aplicar` en `nubeCarpetas.test.mjs` da 0). Eso deja sin test los tres
     caminos de este diff:
     - el registro que ya existe (`:207`);
     - el registro que no se puede escribir (`:210`);
     - el `contar` que falla después de mover (`:139-141`).
   - `guardar()` ya no atrapa el error:
     - el de `:210` frena antes de mover, y está bien;
     - los de `:218` y `:229`, si fallan después de un `rename`, cortan el programa con el error crudo, y esa carpeta queda
       movida sin su fila.
   - No bloquea: la mudanza ya está aplicada y en seco da «no queda nada por mover».

   respuesta: contestada en docs/MUDANZA_NUBE_2026-10-17.md, «Respuestas a las revisiones» (18/10)
- y 1 más: si también existe el registro con la hora, `:207` lo pisa. Pasa con dos corridas en el mismo minuto.

## Hallazgos Preexistentes (no se le cargan a la rama)

- **P1 · [Preexistente] `scripts/_lib/guardianes.mjs:537` (`FIRMA_EXENTOS_RE`).** Sigue como en la ronda 1. Se le suma un resto
  del canon:
  - `rutaExcluida('Y:\Ingeniería y Proyecto - General\ASISTENTE INGENIERIA\5- FACUNDO (memoria y configuracion)\x.docx')` da
    true. Sería una copia de la biblioteca entera en otro disco.
  - Es la misma comparación por «contiene» que usan las demás entradas (`\Claude Fak\`, `\.claude\`).
  - Lo que pedía la ronda 1, que la entrada lleve la biblioteca adelante, está hecho.

  respuesta: contestada en docs/MUDANZA_NUBE_2026-10-17.md, «Respuestas a las revisiones» (18/10)
- **P2 · [Preexistente] `main:scripts/_nube.mjs:445`.** El informe sigue sin el renglón «no correr `_nube.mjs --subir` desde main
  hasta fundir». Vale solo hasta que se funda. respuesta: contestada en docs/MUDANZA_NUBE_2026-10-17.md, «Respuestas a las revisiones» (18/10)

## Verificado como cerrado (el detalle está en las respuestas del informe de la ronda 1)
- **I1:**
  - `_paquete.mjs`, `sync_area.ps1`, el `.cmd` de hola, `paquete.test`, `paqueteEquipo.test` y `claudeAreaInstalar.test` son
    iguales a main.
  - `buscarNube` da null para `area` y para `ingenieria` en la biblioteca real.
  - `mails_area.mjs` tiene su caso ROJO.
- **I2:** la entrada quedó atada a `proyecto - general\`, con test en Node y en Python en las dos direcciones.
- **I3:** `:118-120` del informe.
- **Nit 1 de la ronda 1:** cerrado en tres de sus cuatro puntos; el cuarto es el Nit 3 de acá.
- **Nit 2 de la ronda 1:** la paridad contra el canon está en `instalarMiPc.test.mjs:259-263`.
- **Nit 3 de la ronda 1:** `_sinFirmaIA.py` vuelto a correr da 10 bloqueantes: 8 PEDIDO, las mejoras de Carlos y el LEEME de
  `1- INSTALAR`, como dice ahora el informe.
- **Rutas largas:** `:61` corregido.

## Descartado (no es falla)
- `mails_area.mjs` de la rama junto a `sync_area.ps1` de main: main le pasa `--raiz-nube` = la carpeta del área, la misma que
  antes. `claudeAreaMails.test` lo cubre.
- El test nuevo de I2 en el CI (ubuntu): `ruta_excluida()` con `abspath` de Linux y `os.sep = '/'` da los mismos 5 resultados.
- La nueva clave `nota_mudanza` en `firmaIA.data.json`: Node y Python leen solo `contiene`.

## Acciones requeridas
1. **I4:** corregir `:93` y `:147-149` del informe y el LEEME de `9- VIEJO`. O, si se prefiere, sacar la lista de lo privado y
   el Node de `9- VIEJO`. Lo decide la sesión principal con Fak.
2. **Después de fundir:** republicar Mails de Calidad (Nit 1) y agregar el renglón de P2, si todavía corre algo desde main.
3. **Nit 2 y Nit 3:** si se vuelve a tocar la rama. Esta fue la última ronda: lo que quede abierto va al cierre para Fak.
