# Memoria del auditor — patrones aprendidos

> Semilla 2026-07-17 (curada desde incidentes reales documentados). Agregar 1-2
> lineas por corrida cuando aparezca un falso positivo nuevo o un gotcha.

## Falsos positivos conocidos — NO reportar como hallazgo
- AP=H sin acciones de optimizacion (Fak decide; regla amfe.md §4).
- CC/SC "faltantes" o porcentajes de CC/SC (solo Fak los asigna; NO auditar).
- Errores TS en CavityCalculator = pre-existentes conocidos.
- `REGISTRO_TIEMPOS_INYECCION.xlsx` u otros xlsx de Fak untracked en la raiz.
- S=9-10 por seguridad del OPERARIO sin CC = correcto en AIAG-VDA (no "corregir").

## Errores de metodo que ya cometieron auditores anteriores
- Asumir que el codigo vive en `src/` — vive en la RAIZ del repo (incidente recurrente).
- Contar 0 causas por leer `fn.failureModes` (campo correcto: `fn.failures`) o por
  no autenticar con `signInWithPassword()` antes del query (RLS devuelve 0 filas).
- Flaggear placeholder "Pendiente definicion equipo APQP" como gap (es placeholder valido).
- Afirmar estado de un doc APQP desde dumps de tmp/ o backups/ (solo Supabase live).

## Gotchas del entorno (esta maquina)
- `gh` CLI puede no estar en el PATH del Bash tool → fallback:
  `curl -s https://api.github.com/repos/facussc24/tiempos-y-balanceos/actions/runs?per_page=1`
- Esta PC (`C:\Dev\BarackMercosul`) puede no tener `.env.local` → scripts de query
  fallan; en ese caso reportar "no verificable local" en vez de FALLO.

## Metodo que dio resultado (no solo leer codigo)
- 2026-07-27: script parser de datos (`_refreshArb.mjs`) con "chequeos de salud" propios
  y docstring seguro de si mismo NO alcanza como evidencia — hay que CORRER el parser
  (o una version instrumentada) contra el archivo fuente real (`C:\tmp\*.TXT`) y contar
  cuantos merges/filas quedan mal atribuidos. Encontre 29/58 "filas partidas" fusionadas
  con la fila VECINA equivocada (perdida silenciosa de fila + descripcion corrompida) que
  ninguno de los 6 chequeos de salud del script detecta. Bash con backslashes de rutas
  Windows rompe `node -e "..."` (se come el primer `\`) — usar Write a un .mjs en el
  scratchpad y `node archivo.mjs`, no `-e`.
