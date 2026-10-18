# Auditoría de la mudanza de la nube — ronda 3 (18/10/2026)

**Resultado: FALLO (no bloquea la fusión) · 2 Importante, 1 Nit, 1 Preexistente.** Durante la auditoría se encontró un
TRUE BUG más, y el autor ya lo arregló en `413ed0d3`, que entró a mitad de la auditoría (ver «Cerrado durante la auditoría»).

Esta es la tercera ronda y `REVIEW.md` permite dos rondas con el autor: lo que queda abierto va al cierre para Fak, no a
una ronda 4. Lo único que conviene decidir **antes de fundir** es el Importante de los pedidos: el riesgo arranca justo
con la fusión.

Revisé el diff `528f12b9..07157d53`, que es la revisión por la API, y también `07157d53..413ed0d3`. Ese segundo commit
entró mientras auditaba: es lo que marcó el revisor-pedido. Rama `claude/mudanza-nube-1017`, HEAD `413ed0d3`.

| Check | Estado | Detalle |
|---|---|---|
| TypeScript | OK | `npx tsc --noEmit`: 0 errores |
| Build | OK | `npm run build`: «built in 1m 13s» |
| Tests pedidos | OK | `npx vitest run __tests__/scripts/nubeCarpetas.test.mjs __tests__/scripts/pedidosPendientes.test.mjs`: 45/45 en `07157d53`, 48/48 en `413ed0d3` (Windows) |
| Git local | OK | árbol limpio |
| GitHub sync | (a propósito) | la rama no tiene remoto y va 12 commits adelante de `origin/main`; la funde la sesión que lanzó la mudanza |
| CI | OK en main / sin correr en la rama | `candado.yml` completed success `2da5783a` (= `origin/main`); `deploy.yml` success. `nubeCarpetas.test.mjs` no está en main: el CI de ubuntu nunca lo corrió |
| Dependencias | OK | `npm ls --depth=0`: 0 faltantes |

## TRUE BUG

Ninguno abierto. El único que encontré ya lo arregló `413ed0d3`: está abajo.

## Importante (ROBUSTNESS)

- [Importante] `scripts/_nubeMudar.mjs:115-117` — El camino nuevo «actualizado» de `escribirLeemes` puede borrar texto de un LEEME que no es suyo. Reemplaza los renglones 2 a 5 por posición siempre que el primero coincida. Eso contradice su propio comentario (`:98`: «nunca se pisa: el de 1- INSTALAR y el de 5- FACUNDO traen instrucciones»). · respuesta: ____

  Caso medido sobre una biblioteca temporal, con el `LEEME_CARPETA.txt` real del instalador:
  - (3a) el LEEME publicado tal cual da «ya estaba», así que **hoy no se rompe nada**;
  - (3b) con un renglón propio agregado debajo del primero, da «actualizado»: el renglón agregado desaparece, el quinto renglón del canon queda repetido y todo el archivo pasa de LF a CRLF;
  - (3c) con un LEEME de dos renglones cuyo primero coincide, da «actualizado» y el segundo renglón se pierde;
  - (3d, control) con el primer renglón distinto, da «agregado arriba» y no se pierde nada.

  Lo que lo deja expuesto:
  - Ningún test ata `tools/instalar_mi_pc/LEEME_CARPETA.txt` a `nubeOrden.data.json` destino 1 (`grep LEEME_CARPETA __tests__` da 0).
  - El test nuevo (`__tests__/scripts/nubeCarpetas.test.mjs:339`) prueba solo el caso «renglón del canon cambiado».

  Arreglo sugerido: si el primer renglón coincide y los otros cuatro no, no escribir nada y devolver «distinto: revisar a mano». Otra opción es reemplazar solo si esos cuatro renglones coinciden con una versión anterior del canon. Sumar un caso en rojo: un texto ajeno dentro de los cinco primeros renglones tiene que sobrevivir.
- [Importante] `scripts/_lib/pedidosPendientes.mjs:156` (vía `resolverCarpeta`) y `__tests__/scripts/nubeCarpetas.test.mjs:115,121` — Si existen las dos carpetas de pedidos, el aviso lee solo la nueva. El test nuevo lo fija («not PEDIDO 91») y el informe (`docs/MUDANZA_NUBE_2026-10-17.md:218`, punto 10) lo da por hecho. · respuesta: ____

  El problema es el canal con CATA:
  - El informe dice que CATA no recibe el código nuevo sola (`:156`).
  - En main, `CLAUDE.md:23` y `.claude/pcs/CATA.md:5` dicen que los pedidos van en `FACUNDO\`.
  - Para `_mails.py`, el mismo informe justifica leer las dos carpetas por esta misma razón (`:214`, punto 6: «una PC sin reinstalar puede seguir subiendo al lugar viejo»).

  Caso medido: casa temporal con un pedido viejo en `6- PEDIDOS…` y un «PEDIDO 51 — de CATA, para la PC principal» en `FACUNDO\` de la raíz, corriendo el hook `--hook` como la PC principal:
  - con el código de la rama, muestra solo el 49 y **el 51 de CATA no aparece**;
  - con el de main, muestra el 51.

  Hoy no pasa: en la nube real no hay `FACUNDO\` en la raíz (lo listé). Alcanza con que una sesión de CATA escriba un pedido antes de su `git pull` (crear el archivo crea la carpeta).

  Arreglo sugerido: en los pedidos, leer las dos carpetas como `_mails.py` y decir en cada renglón en qué carpeta está el pedido. Si no, que el informe le diga a Fak que el canal con CATA queda cortado en las dos direcciones hasta el `git pull` de CATA (ver P1).

## Nit

- [Nit] `docs/MUDANZA_NUBE_2026-10-17.md:68` — «`_sinFirmaIA.py` sobre la carpeta única … dio 10» no dice cuántos archivos se leyeron. Corrido hoy (`python scripts/_sinFirmaIA.py "<biblioteca>\ASISTENTE INGENIERIA" --sin-avisos`, solo lectura): «revisados: 35 · bloqueantes: 10 · sin revisar (solo en la nube): 1081». Los 10 coinciden uno por uno con lo que dice el informe: 8 PEDIDO, el de las mejoras de Carlos y el LEEME de `1- INSTALAR`. Pero Fak va a decidir sobre «10» sin saber que quedan 1081 archivos sin leer. · respuesta: ____

## Preexistente

- [Preexistente] `docs/MUDANZA_NUBE_2026-10-17.md:156` (la fila de CATA, ya estaba antes de `07157d53`) — El arreglo dice «abrir una sesión en CATA y correr `git pull` (o dejarle un PEDIDO)». El PEDIDO no le llega. Caso medido: un pedido para CATA en `6- PEDIDOS…`, con el hook `--hook` de **main** corriendo como CATA, da «(nada)»; con el de la rama, sí lo muestra. Main lee solo `FACUNDO\` de la raíz (`main:scripts/_lib/pedidosPendientes.mjs:153`, `carpeta: "FACUNDO"`). A CATA hay que hacerle el `git pull` en persona. · respuesta: ____

## Cerrado durante la auditoría (TRUE BUG, ya arreglado en `413ed0d3`)

- En `07157d53`, el test del aviso de pedidos comparaba contra `nueva('pedidos').join('\\')`, mientras el código arma la carpeta con `path.relative` (`pedidosPendientes.mjs:157`), que en ubuntu da «/». No hay Linux en esta PC (sin WSL ni docker), así que lo simulé con `path.posix`: el caso «vieja» (`FACUNDO`, un solo tramo) pasaba; «nueva» y «las2» fallaban (`"ASISTENTE INGENIERIA/6- PEDIDOS…"` contra `"ASISTENTE INGENIERIA\6- PEDIDOS…"`). Después de fundir, el CI de main iba a quedar en rojo. `413ed0d3` compara con `join(...)`, que usa el mismo separador que `path.relative` en los dos sistemas. El informe ya dice que ubuntu real no se corrió.

## Lo que pidió la sesión, punto por punto

1. **Linux (CI ubuntu).** Revisé uno por uno los casos sin `runIf`:
   - canon, `resolverCarpeta` y su gemelo en Python (corre con `python` o `python3`, y `nube_carpetas.py` arma la ruta con `Path`): no dependen de Windows;
   - pedidos: arreglado en `413ed0d3`;
   - publicadores: el test acepta `\` y `/`;
   - `cerebro-guard`: el de los nombres solo lee el `.sh`; el `.test.sh` corre si hay `bash`. Usa `HOME`, glob y `date -d`, nada de Windows, pero **no lo pude correr en Linux**;
   - `rutaExcluida` de Node: compara texto, no depende del sistema;
   - `_nubeMudar` y los tres tests nuevos de `413ed0d3` (escriben en un archivo o en una carpeta, con `rmSync` y `renameSync`): nada de Windows.

   El único que dependía del separador era el de pedidos.
2. **`main --aplicar` con `medir` inyectado.** No encontré un camino en el que algo se mueva y no quede en el registro, salvo uno: que `guardar()` falle después de mover. En ese caso la fila sale en pantalla y el proceso para. Ese camino ya tiene test (`413ed0d3`). Todo lo que tira error antes del `rename` (`medir`, `contar` del origen) no mueve nada. Después del `rename`, el conteo está adentro de un `try`. La medición de mentira es fiel a la real: `nubeMedir.ps1:45` devuelve `nombre` tal como se lo pasan. `main()` sin opciones usa los valores de siempre (`home` sin definir, entonces `homedir()`), así que un argumento no puede saltear la medición real. Queda una pregunta, sin caso medido: si el proceso se corta (Ctrl+C) mientras recuenta una carpeta grande, entre `:142` y `:232`, esa carpeta queda movida y sin fila. Anotar en el registro «moviendo X» antes de cada `rename` lo cerraría.
3. **«actualizado» y el LEEME ajeno:** sí puede borrar texto (Importante 1). El de `1- INSTALAR` de hoy queda «ya estaba».
4. **Lo que afirma el informe, contra el código:**
   - Verdadero:
     - `IsPathRooted` en `_nubeSubio.ps1:23`.
     - `firmaIA.py:94` y `:100` pasan todo a minúscula.
     - `grep` en las dos copias de `carpeta-guard.sh` da 0 (`~/.claude/hooks` y `.claude/hooks`).
     - `NP_ZONA` y `NP_TRANSICION` miran solo `OneDrive - BARACK ARGENTINA SRL` (`guardianes.mjs:3187-3188`).
     - Los tres programas en cuarentena dan diff vacío contra main; `tools/paquete-equipo/` también.
     - Los cuatro instaladores llevan la ruta de `9- VIEJO\…\1- PUBLICADO`.
     - `mails_pc/publicar.mjs` en seco da 8 «igual» más `casillas.json` «se_respeta»; `instalar_mi_pc/publicar.mjs` da 5 «igual».
     - Los 10 bloqueantes coinciden con el desglose.
     - El fallo de la tarea de las 23:39 está en `.claude/state/nube-sync.log` («NO EXISTE»).
   - No se puede verificar con un comando: «Sincronizado: 9 archivos movidos» (corrida a mano con la variable, no deja renglón en el log). No lo doy por falso.
   - Los dos Nit que había marcado acá en `07157d53` ya los corrigió `413ed0d3`:
     - la fila de `mails_equipo.py` y `sync_equipo.ps1`, que decía «solo cambió el texto de ayuda» cuando el diff contra main da vacío;
     - «igual en los 9 archivos», cuando son 8 más el que se respeta.

## Nota sobre las respuestas de la ronda 2

Las respuestas de la ronda 2 dicen «contestada en docs/…», y `scripts/_lib/ppm.mjs:27` solo cuenta *arreglado / rechazado / a propósito / no importa* en el mismo renglón del hallazgo. Parte de la culpa es del formato de ese informe: puse la respuesta en otro renglón. En este informe la respuesta va en el mismo renglón de cada hallazgo.

## Archivos para reproducir

Los dos scripts de medición quedaron en el scratchpad de la sesión, fuera del repo: `medir_r3.mjs` (separador en Linux y casos de LEEME) y `medir_pedidos_cata.mjs` (el canal de pedidos main ↔ rama). Escriben solo en carpetas temporales.
