# Guía de Usuario del Simulador de Flujo

Esta guía explica cómo usar el simulador de flujo integrado con el módulo de balanceo.

## Introducción

El simulador de flujo permite visualizar y analizar el movimiento de piezas a través de las estaciones de producción, identificar cuellos de botella y optimizar la configuración logística.

## Inicio Rápido

### 1. Cargar Datos de Balanceo

El simulador carga automáticamente los datos del proyecto activo:
- **Estaciones**: Nombre, tiempo de ciclo, operadores
- **Turnos**: Horarios y descansos
- **Demanda**: Cantidad diaria y cálculo de takt

### 2. Configurar Parámetros

| Parámetro | Descripción | Rango |
|-----------|-------------|-------|
| **Piezas a procesar** | Cantidad total a simular | 10-500 |
| **Límite WIP** | Inventario máximo por estación | 1-10 |
| **Velocidad** | Multiplicador de tiempo | 1x, 2x, 5x, 10x |
| **Logística** | Habilitar consumo de material | On/Off |

### 3. Controles de Simulación

- **▶️ Play**: Iniciar simulación
- **⏸️ Pause**: Pausar sin perder estado
- **🔄 Reset**: Reiniciar a estado inicial

## Indicadores de Estado

### Semáforo de Estación

| Color | Estado |
|-------|--------|
| 🟢 Verde | OK - Operación normal |
| 🟡 Amarillo | Atención - Buffer bajo o bloqueado |
| 🔴 Rojo | Crítico - Sin material disponible |

### Indicadores de Inventario

```
📦 MATERIAL
[========  ] 32/40 pcs
     ↳ Nivel actual / Capacidad
```

### Indicador de Autonomía (Rollos)

```
🎞️ CINTAS
├─ Cinta XYZ
│  [████████░░] 8.5m
│  ⏱️ 15.2 min autonomía
```

## Panel APM (Activity Performance Monitoring)

El panel APM muestra el análisis de inactividad por estación:

### Razones de Inactividad

| Código | Descripción |
|--------|-------------|
| `LOGISTICS_STARVATION` | Sin piezas en buffer |
| `LOGISTICS_ROLL_DEPLETED` | Rollo consumible agotado |
| `BLOCKED_DOWNSTREAM` | Estación siguiente llena |
| `NO_WORK_AVAILABLE` | Sin trabajo disponible |

### Exportar Reportes

1. Clic en "📊 Panel APM"
2. Seleccionar formato: CSV o JSON
3. Descargar archivo

## Sincronización con Balanceo

### Sincronización Automática

Cuando el simulador está **pausado** o **idle**, los cambios en el balanceo se sincronizan automáticamente:
- Tiempos de ciclo
- Asignaciones de tareas
- Configuración de turnos

### Sincronización Manual

Si aparece el indicador "🔄 Sincronización pendiente":
1. Pausar la simulación
2. Clic en "Sincronizar"
3. Los inventarios se preservan

> [!NOTE]
> La sincronización solo actualiza configuraciones. El estado logístico (inventarios, posición del Milk Run) se preserva.

## Interpretar Resultados

### KPIs Principales

| KPI | Descripción | Meta |
|-----|-------------|------|
| **Throughput** | Piezas/hora producidas | ≈ Demanda / Turno |
| **Lead Time** | Tiempo promedio en línea | Minimizar |
| **Utilización** | % tiempo activo | > 85% |

### Identificar Cuellos de Botella

El panel APM ordena estaciones por tiempo de inactividad:
1. Estación con mayor inactividad = cuello de botella
2. Revisar razón principal (`bottleneckReason`)
3. Tomar acción según causa

## Solución de Problemas

### "Estaciones sin datos"

**Causa**: El proyecto no tiene `stationConfigs` definidas.

**Solución**: Configurar estaciones en el módulo de balanceo.

### "Simulación muy lenta"

**Causa**: Demasiadas piezas o estaciones.

**Solución**: Usar velocidad 10x o modo "Simulación Instantánea".

### "Sincronización no detecta cambios"

**Causa**: Solo se detectan cambios en: tiempos de ciclo, asignaciones, demanda.

**Solución**: Verificar que los cambios sean en estos campos específicos.
