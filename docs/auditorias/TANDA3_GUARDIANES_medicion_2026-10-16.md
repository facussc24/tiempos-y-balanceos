# Tanda 3 — guardianes que frenan de más: la medición (16/10/2026)

Lo midió `scripts/_frenosMedir.mjs` sobre los 436 frenos reales de 30 días del informe de CATA del 15/10/2026
(`Claude Fak\viernes-17-plan-sistema\20-informes\casa_guardianes_frenos.md`, datos `scripts\frenos\clasif2.json` +
`frenos_bruto4.jsonl`, que no van al repo). Es diferencial: cada freno pasa por la BASE (main en `c157b9f9`, el punto de
partida de la rama) y por la NUEVA (la punta de `claude/guardianes-tanda3`), sin ejecutar nada, con un HOME y un TEMP de
prueba (sin permisos de un solo uso), sin COMPUTERNAME y con la carpeta de la sesión sacada del nombre de su carpeta de
registros (en vivo llega en el campo `cwd`). Se repite con:

```bash
git -C C:/Dev/BarackMercosul archive c157b9f9 scripts/_lib core/amfe scripts/_vozFak.mjs | tar -x -C <carpeta>
node scripts/_frenosMedir.mjs --base <carpeta>/scripts/_lib/guardianes.mjs --casos
```

## La tabla (lo que frena el guardián del freno: base → nueva)

| | Total | Se pueden repetir acá | Frenan con la base | Frenan con la nueva |
|---|---:|---:|---:|---:|
| **Falsos (F)**, sin script-inline | 51 | 51 | 38 | **8** |
| **Verdaderos (V)**, sin script-inline | 71 | 49 | 43 | **43** |
| **Sin determinar (SD)**, sin script-inline | 141 | 86 | 72 | 65 |
| script-inline: F / V / SD | 6 / 165 / 2 | todos | 6 / 165 / 2 | **0 / 165 / 0** |

- **Los 51 falsos**: 13 ya no frenaban con el código de hoy (cambios de antes de esta tanda y la carpeta de la sesión).
  De los 38 que frenaban, pasan 30. Los 8 que siguen frenando:
  - **arb-cerrar-guard, 4**: el plan no tiene pieza para este guardián;
  - **firma-ia-guard, 1**: tampoco tiene pieza;
  - **borrado-masivo, 1**: CATA lo contó como falso por el `rm -f placa*.3mf`, pero al final del mismo comando hay un
    `for g in …; do rm -rf "$D/lam_$g"`, con una variable del `for` que el guardián no resuelve;
  - **secretos, 1**: el del 21/09 11:14 saca la URL de `.env.local` con `grep -oE` adentro de un `$(…)`, que es leer el
    archivo (el plan lo deja frenando);
  - **apqp-cliente, 1**: el del 15/10 13:39 no era falso: el mismo comando escribe un script con `wb.Save()` sobre el
    listado de flujogramas y lo corre.
- **Los 71 verdaderos**: 22 no se pueden repetir (14 de coordinador-guard y 8 de agentes-guard, que son otros hooks).
  De los 49 que sí, 43 frenan con las dos versiones y **ninguno dejó de frenar**. Los 6 que no frenan, tampoco con la
  base: 5 de push-guard, que depende de dist/ y de los commits sin subir de esta PC, y 1 de apqp-cliente
  (`… && timeout 115 py -3 scripts/_registrarAmfe173.py --apply`: el `timeout` de adelante le esconde el intérprete a
  `APQP_REGISTRA`; es un agujero de antes). Ese mismo comando ahora lo frena el guardián nuevo de permisos, porque arma
  `.apqp-listado-ok` sin cita.
- **Los sin determinar que cambiaron (7 + 2), mirados uno por uno**:
  - 5 de borrado-masivo: borran la carpeta que el mismo script creó con `mkdtemp`, o citan el patrón en una expresión;
  - 1 de video-maquina: el caso del pendrive del 15/10, el que el plan pide destrabar;
  - 1 de apqp-cliente (15/10 13:55): el script que corría (`listado152.py`) ya no está en disco y la medición no lo
    puede leer. En vivo sí lo lee y frena; lo prueba `apqpClienteGuard.test.mjs`;
  - 2 de script-inline: agregan prosa a una memoria `.md` con la ruta en una variable.
- **Frenos nuevos**: solo los de `permiso-un-uso-guard`, 6 comandos que armaban un permiso de Fak sin cita (pieza 9, a
  propósito). Ningún guardián de las otras piezas frena algo que antes pasaba.

## Lo que la medición no puede ver

- Los frenos que no llegaron a los transcripts copiados (subagentes, logs locales de hooks): informe de CATA, sección 5.
- Las piezas 8 a 12 no aflojan frenos de esta lista: los retiros sacan hooks que no frenaban acá; los permisos, el
  despachador de MCP, el `onFailure` y el `PreModelSwitch` agregan controles, con sus tests en las dos direcciones.
