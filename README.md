<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Barack Mercosul - Ingeniería & Procesos

Herramienta de balanceo de líneas y optimización de procesos industriales.

## 🚀 Desarrollo

### Prerequisites
- Node.js 18+
- Rust (para Tauri Desktop)

### Instalación

```bash
# Instalar dependencias
npm install

# Desarrollo Web
npm run dev

# Desarrollo Desktop (Tauri)
npm run tauri:dev

# Build Producción
npm run build
npm run tauri:build
```

### Ejecutar Tests

```bash
# Todos los tests
npm test

# Tests específicos
npm test -- __tests__/network_utils.test.ts --run
npm test -- __tests__/encryption_portable.test.ts --run
npm test -- __tests__/revision_history.test.ts --run

# Tests con watch mode
npm test -- --watch
```

---

## 🧪 Menú Diagnóstico / QA

En modo **Tauri (Desktop)**, hay un botón 🧪 (FlaskConical) en el header que abre el panel de QA.

### Pruebas Disponibles

| Prueba | Descripción |
|--------|-------------|
| **Escritura Atómica** | Crea temp file → verifica checksum → atomic rename → limpia |
| **Comportamiento Lock** | Crea lock → lee → verifica expiración → libera |
| **Lógica de Reintentos** | Simula error transitorio (ETIMEDOUT) → verifica backoff → éxito |
| **Conflicto Sin Retry** | Simula ConflictError → verifica que NO se reintenta |

### Modo Simulación de Fallos (Solo DEV)

En desarrollo, se puede activar simulación de errores:
- **ETIMEDOUT**: Simula timeout de red
- **EBUSY**: Simula archivo en uso
- **EACCES**: Simula permiso denegado
- **EIO**: Simula error de I/O

> ⚠️ Este modo NUNCA está disponible en producción.

### Exportar Diagnóstico

El botón "Exportar Diagnóstico" descarga un JSON con:
- Logs del sistema (sin datos sensibles)
- Metadata del sistema (OS, versión app, screen size)
- Ruta del proyecto (anonimizada)

---

## 📁 Uso en Drives de Red (Y:\ / Z:\)

### Checklist de Validación

| # | Prueba | Cómo Verificar | Esperado |
|---|--------|----------------|----------|
| a | Guardar normal | Modificar → Guardar | Toast ✅ success |
| b | Permiso denegado | Quitar permisos escritura | Toast ❌ con mensaje claro |
| c | Microcorte (retry) | Desconectar red brevemente | Logs de retry, luego éxito |
| d | ConflictError | Editar archivo externamente → Guardar | Modal de conflicto (sin retry) |
| e | Lock expirado | Dejar lock file >1min → Abrir | Limpieza automática de lock |

### Recomendaciones para Redes

1. **Latencia**: El sistema usa retry con backoff exponencial + jitter
2. **Locks**: TTL de 30s con heartbeat cada 10s durante guardados
3. **Backups**: Cada guardado crea backup en carpeta `Obsoletos/`
4. **Temporales**: Archivos `.tmp` huérfanos (>30min) se pueden limpiar

---

## 📂 Estructura del Proyecto

```
├── components/
│   ├── modals/
│   │   ├── ConflictModal.tsx    # Resolución de conflictos
│   │   ├── RevisionHistory.tsx  # Historial de versiones
│   │   └── DiagnosticQA.tsx     # Panel de QA
│   └── ui/
│       └── Toast.tsx            # Sistema de notificaciones
├── utils/
│   ├── networkUtils.ts          # Path normalization, retry, error classification
│   ├── logger.ts                # Logging profesional
│   ├── faultSimulation.ts       # Simulación de errores (DEV)
│   ├── tauri_smart_save.ts      # Guardado atómico Tauri
│   └── encryption_v2.ts         # Cifrado portable
├── __tests__/
│   ├── network_utils.test.ts    # 24 tests
│   ├── encryption_portable.test.ts # 23 tests
│   └── revision_history.test.ts # 6 tests
└── modules/
    └── ...                      # Módulos de la aplicación
```

---

## 🔐 Seguridad

- **Cifrado**: AES-256-GCM con PBKDF2 key derivation
- **Datos sensibles**: Campos `client`, `engineer` cifrados en archivo
- **Logs**: Datos sensibles auto-redactados (`[REDACTED]`)
- **Diagnósticos**: Sin contenido de proyectos, solo metadata del sistema
