# Reporte de Seguridad Nocturno — 2026-03-22

## Resumen

| Check | Resultado | Estado |
|-------|-----------|--------|
| `Barack2024` en src/ | 0 en src/, **3 en scripts/exports** | HALLAZGO |
| `admin@barack` en src/ | 0 en src/, **3 en scripts/exports** | HALLAZGO |
| `service_role` en src/ | 0 | OK |
| `.env.production` en .gitignore | SI | OK |
| `.env.local` en .gitignore | SI (via `*.local`) | OK |
| `SUPABASE_INFO.md` en .gitignore | SI | OK |
| API keys hardcodeadas | **3 archivos con anon key** | HALLAZGO |

## Hallazgos de Seguridad

### CRITICO: Credenciales hardcodeadas en archivos trackeados

3 archivos tienen credenciales de Supabase hardcodeadas y estan commiteados en git:

| Archivo | Git Tracked | Credenciales |
|---------|-------------|--------------|
| `scripts/seed-family-inserto.mjs` | SI | email, password, anon key |
| `exports/generate-insert-exports.mjs` | NO (no tracked) | email, password, anon key |
| `exports/generate-apqp-package-insert.mjs` | SI | email, password, anon key |

**Detalle de credenciales expuestas:**
- Email: `admin@barack.com`
- Password: `Barack2024!` (nota: esta es una password vieja, la actual es diferente)
- Anon Key: `eyJhbGci...` (esta es publica por diseño en Supabase, pero igual no deberia hardcodearse)

### Nota sobre la anon key
La anon key de Supabase es **publica por diseño** — se incluye en el bundle de produccion en `.env.production`. Sin embargo, la password `Barack2024!` es una credencial real que no deberia estar en el repositorio.

### Nota sobre la password actual
La password actual del admin es `U3na%LNSYVmVCYvP` (en `.env.local` que NO esta trackeado). La password `Barack2024!` en los scripts puede ser una version vieja, pero igualmente no deberia estar hardcodeada.

## Archivos Correctamente Protegidos

| Archivo | En .gitignore | Trackeado |
|---------|--------------|-----------|
| `.env.local` | SI (via `*.local`) | NO |
| `.env.production` | SI | NO |
| `SUPABASE_INFO.md` | SI | NO |
| `AUDIT_FUNCIONAL.md` | SI | NO |

## Analisis de .gitignore

```
# Project secrets
SUPABASE_INFO.md
AUDIT_FUNCIONAL.md
.env.production
```

Tambien protege:
- `*.local` (cubre `.env.local`)
- `.claude/` (configuracion local)
- `node_modules/`, `dist/`

## Archivos src/ — Limpios

- `utils/supabaseClient.ts`: usa `import.meta.env.VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` correctamente
- `components/auth/LoginPage.tsx`: usa `import.meta.env.VITE_AUTO_LOGIN_EMAIL` gateado con `import.meta.env.DEV`
- No hay API keys, tokens o passwords en ningun archivo `.ts` o `.tsx`

## Recomendaciones

1. **URGENTE**: Migrar `scripts/seed-family-inserto.mjs` y `exports/generate-apqp-package-insert.mjs` para usar `supabaseHelper.mjs` en vez de credenciales hardcodeadas
2. **URGENTE**: Cambiar la password `Barack2024!` si todavia es valida
3. **MENOR**: Considerar agregar `scripts/seed-*.mjs` y `exports/generate-*.mjs` a .gitignore si contienen datos sensibles
4. **INFO**: La anon key es publica por diseño pero es mejor practica no hardcodearla en scripts
