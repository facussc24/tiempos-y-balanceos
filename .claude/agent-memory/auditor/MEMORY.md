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
