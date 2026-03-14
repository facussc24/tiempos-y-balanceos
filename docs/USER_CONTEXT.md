# Contexto del Usuario y Reglas de Desarrollo

> Este documento existe para que cualquier agente de IA (Claude, etc.) que trabaje
> en este proyecto entienda el contexto sin tener que preguntar cada vez.
> Ultima actualizacion: 2026-03-11

---

## 1. Perfil del Usuario

- **No es programador**. No sabe TypeScript, React, ni CSS.
- Todas las explicaciones deben ser en **lenguaje simple**, sin jerga tecnica.
- Si hay que tomar una decision tecnica, explicar las opciones como si fuera
  a alguien que nunca programo.
- El usuario es ingeniero de calidad automotriz y entiende perfectamente AMFE,
  APQP, IATF 16949, Plan de Control, etc.

## 2. Como Testear

- **Usar Preview** (preview_start/preview_screenshot), NO Chrome MCP.
- **Viewport: 1920x1080** siempre (la app es de escritorio Tauri, pantalla completa).
  Si no se configura esto, la UI se ve comprimida y no representa la app real.
- La configuracion del preview esta en `C:\dev\.claude\launch.json`.

## 3. Que Es Este Software

Barack Mercosul es una herramienta **interna** de ingenieria de calidad automotriz.

**Modelo hibrido**: El software acelera el trabajo pero los entregables siguen siendo
Excel/PDF estandar que cualquiera puede abrir y editar sin software especial.
Esto es asi hasta que el software este 100% maduro y confiable.

En la practica:
- El usuario trabaja en el software (mas rapido, automatizado, con IA)
- Exporta a Excel/PDF para compartir con clientes, auditores, proveedores
- Si alguien edita el Excel externamente, el usuario actualiza el software manualmente
- Los documentos deben poder existir en ambos mundos (software Y Excel) sin conflicto

## 4. Stack Tecnico (referencia)

- **Frontend**: React 19 + TypeScript + TailwindCSS 3
- **Desktop**: Tauri 2 (Rust backend)
- **Build**: Vite 6
- **DB**: SQLite (via tauri-plugin-sql)
- **IA**: Google Gemini 2.5 Flash (sugerencias y chat copiloto)
- **Excel**: xlsx-js-style
- **PDF**: html2pdf.js
- **Tests**: Vitest con 2,362+ tests pasando

## 5. Reglas de Desarrollo

### NO hacer:
- No agregar features que no se pidieron
- No refactorizar codigo que funciona sin que se pida
- No crear archivos innecesarios
- No usar `as any` en TypeScript
- No hacer SQL directo (siempre usar repositories)
- No hardcodear strings de UI en ingles (todo en espaniol argentino)

### SI hacer:
- Siempre leer el archivo antes de editarlo
- Siempre verificar cambios con Preview despues de editar
- Siempre correr tests si se modifica logica (`npm test` en BarackMercosul)
- Usar los repositories tipados para acceso a datos
- Usar logger.ts para logs (no console.log)
- Importar modulos Tauri con dynamic import (pueden no existir en browser)

## 6. Estructura del Proyecto

```
C:\dev\BarackMercosul\
  src\
    modules\
      amfe\          -- AMFE VDA (modulo principal)
      pfd\           -- Diagrama de Flujo
      controlPlan\   -- Plan de Control
      hojaOperaciones\ -- Hojas de Operaciones
      tiempos\       -- Tiempos y Balanceos
      ...
    utils\
      repositories\  -- Acceso a SQLite (8 repos tipados)
    hooks\           -- Hooks compartidos
    components\      -- Componentes compartidos
  docs\              -- Documentacion del proyecto (ESTE directorio)
  .claude\rules\     -- Reglas contextuales por modulo
```

## 7. Problemas Conocidos (no repetir)

- **Tailwind en Preview**: Los paths de Windows rompen la deteccion de clases.
  Ver `.claude/memory/tailwind-windows-fix.md`.
- **API key de Gemini**: Nunca hardcodear. Usar el settings store.
- **XSS en inputs**: Sanitizar siempre con las utilidades existentes.
- **Hooks de React 19**: Algunos patterns de React 18 no funcionan igual.
  Ver `.claude/rules/testing.md`.
