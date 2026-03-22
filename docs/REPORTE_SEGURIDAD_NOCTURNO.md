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
| Boton "Acceso rapido" en produccion | **Visible si .env.production tiene VITE_AUTO_LOGIN_EMAIL** | HALLAZGO |

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

## CRITICO: Boton "Acceso rapido" visible en produccion

**Archivo**: `components/auth/LoginPage.tsx:145`

La condicion para mostrar el boton de auto-login es:
```tsx
{import.meta.env.VITE_AUTO_LOGIN_EMAIL && (
    <button onClick={handleDevLogin}>Acceso rapido</button>
)}
```

El CLAUDE.md dice que esta "gateado con `import.meta.env.DEV`" pero **el codigo real NO usa `import.meta.env.DEV`**. Usa `VITE_AUTO_LOGIN_EMAIL` que es truthy en produccion si `.env.production` tiene esa variable.

**Impacto**: Cualquier visitante de la URL de produccion puede hacer click en "Acceso rapido" y entrar como admin sin conocer la password.

**Fix recomendado**: Cambiar la condicion a:
```tsx
{import.meta.env.DEV && import.meta.env.VITE_AUTO_LOGIN_EMAIL && (
```

## Archivos src/ — Limpios (excepto LoginPage)

- `utils/supabaseClient.ts`: usa `import.meta.env.VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` correctamente
- `components/auth/LoginPage.tsx`: NO esta gateado con `import.meta.env.DEV` como dice CLAUDE.md
- No hay API keys, tokens o passwords en ningun archivo `.ts` o `.tsx`

## Recomendaciones

1. **CRITICO**: Corregir LoginPage.tsx para usar `import.meta.env.DEV` como guard del boton "Acceso rapido"
2. **URGENTE**: Migrar `scripts/seed-family-inserto.mjs` y `exports/generate-apqp-package-insert.mjs` para usar `supabaseHelper.mjs` en vez de credenciales hardcodeadas
3. **URGENTE**: Cambiar la password `Barack2024!` si todavia es valida
4. **MENOR**: Considerar agregar `scripts/seed-*.mjs` y `exports/generate-*.mjs` a .gitignore si contienen datos sensibles
5. **INFO**: La anon key es publica por diseño pero es mejor practica no hardcodearla en scripts
