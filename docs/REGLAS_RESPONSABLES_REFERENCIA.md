# Reglas de Asignacion de Responsables — Deducidas de CPs de Referencia

Generado el 2026-03-25 a partir de docs/REFERENCIA_CP_ORIGINALES.md (12 CPs reales).

---

## Regla general

Todos los responsables en los CPs de referencia son **ROLES GENERICOS**, nunca nombres de personas.
Si un CP o HO tiene un nombre propio (ej: "Carlos Baptista", "Manuel Meszaros") como responsable, es INCORRECTO.

---

## Reglas por tipo de control

### 1. Recepcion de Materia Prima (Op 10 / Op 0.10)

| Control | Responsable | Registro | Reaccion |
|---------|-------------|----------|----------|
| Todo control de MP entrante (tipo, color, dimensional, aspecto, espesor, flamabilidad, gramaje, certificados, lotes, viscosidad, vencimiento) | **Recepcion de materiales** | P-10/I | P-14 |

**Excepcion**: En Tela Encosto (21-6567), los 3 primeros controles (peso, ancho, flamabilidad) dicen "Auditor de recepcion". El resto dice "Recepcion de materiales".

### 2. Set-up de Maquina (inicio de cada operacion de proceso)

| Control | Responsable | Registro | Reaccion |
|---------|-------------|----------|----------|
| Hoja de set-up, parametros, verificacion visual de setup | **Operador de produccion** | set up / Registro de Set-up | Segun P-09/I |
| Cantidad de capas, cuchilla, dimensional de corte, myler de control | **Operador de produccion** | Registro de Set-up | Segun P-09/I |
| Parametros espumado (temperatura molde, tiempo colada, caudal, relacion poliol/iso, presiones, tiempo crema, temperatura poliol/iso) | **Operador de produccion** | Hoja de set-up / Hoja de parametro de molde | Segun P-09/I |

### 3. Proceso — Corte (Op 0.25 / Op 15 / Op 20)

| Control | Responsable | Registro | Reaccion |
|---------|-------------|----------|----------|
| Tendido, capas, corte dimensional, apilado | **Operador de produccion** | Autocontrol / Registro de Set-up | Segun P-09/I |
| Control de forma con plantilla/mylar | **Operador de produccion** | Autocontrol | Segun P-09/I |

**Excepcion Tela Encosto**: Inspector de calidad en Op 20 corte (control de forma, aspecto/apariencia 1 pieza inicio de turno).

### 4. Proceso — Costura Union (Op 30)

| Control | Responsable | Registro | Reaccion |
|---------|-------------|----------|----------|
| Sin costura salteada, sin arrugas/pliegues, sin falta costura, sin costura floja | **Operador de produccion** | Autocontrol / Registro de control | Segun P-09/I |
| Aguja correcta | **Operador de produccion** | Registro de Set-up | Segun P-09/I |
| Aspecto general costura | **Operador de produccion** | Autocontrol | Segun P-09/I |

### 5. Proceso — Costura Vista (Op 31) — Solo Insert e IP Decorative

| Control | Responsable | Registro | Reaccion |
|---------|-------------|----------|----------|
| Puntada y costura vista (SC1), paralelismo entre costuras | **Operador de produccion** | Registro de control | Segun P-09/I |
| Sin arrugas, sin costura floja/deficiente, sin costura salteada | **Operador de produccion** | Autocontrol | Segun P-09/I |

### 6. Proceso — Adhesivado / Primer (Op 40 / Op 50)

| Control | Responsable | Registro | Reaccion |
|---------|-------------|----------|----------|
| Adhesivo en buen estado, vencimiento, adhesivado completo, primer | **Operador de produccion** | Autocontrol | Segun P-09/I |
| Temperatura / velocidad pistola laser | **Operador de produccion** | set up | Segun P-09/I |

### 7. Proceso — Tapizado (Op 20 / Op 50 / Op 60)

| Control | Responsable | Registro | Reaccion |
|---------|-------------|----------|----------|
| Vinilo posicionado, tapizado sin arrugas, sin marcas, talon en canaleta, adherencia | **Operador de produccion** | Autocontrol | Segun P-09/I |
| Costura alineada en perfil (con calibre) | **Operador de produccion** | Autocontrol | Segun P-09/I |

### 8. Proceso — Virolado + Refilado (Op 60 / Op 70)

| Control | Responsable | Registro | Reaccion |
|---------|-------------|----------|----------|
| Virolado contorno, pegado pliegues, zonas criticas, sin quemado | **Operador de produccion** | Autocontrol | Segun P-09/I |

### 9. Proceso — Espumado (Op 50 headrests)

| Control | Responsable | Registro | Reaccion |
|---------|-------------|----------|----------|
| Apariencia (sin marcas, sin rebabas) | **Operador de produccion** | Autocontrol + Registro de control | Segun P-09/I |
| Performance (libre de rebabas, atrapes, tiempo curado) | **Operador de produccion** | Segun hoja de operaciones | Segun P-09/I |
| Peso pieza (289 +/- 2 gr o segun producto) | **Operador de produccion** | Autocontrol | Segun P-09/I |

**Doble control** en performance y apariencia: 100% autocontrol por Op. produccion + 1 pieza inicio/fin turno por Op. calidad.

### 10. Proceso — Ensamble (Op 40 headrests)

| Control | Responsable | Registro | Reaccion |
|---------|-------------|----------|----------|
| Colocacion inserto, asta, clipado | **Operador de produccion** | Autocontrol | Segun P-09/I |
| Apariencia despegues/terminacion | **Operador de produccion** | Autocontrol | Segun P-09/I |

### 11. Inspeccion Final (Op 30 / Op 50 / Op 60 / Op 80)

| Control | Responsable | Registro | Reaccion |
|---------|-------------|----------|----------|
| Dimensional con calibre de control | **Metrologia** | Segun instructivo medicion de calibre | Segun P-09/I |
| Peeling (ensayo adhesivado con dinamometro) | **Metrologia** | Segun instructivo ensayo de peeling | Segun P-09/I |
| Apariencia final (sin despegues, cortes, manchas) | **Operador de produccion / Calidad** | Autocontrol | Segun P-09/I |
| Carga sistema ARB | **Operador de Calidad** | Autocontrol | Segun P-09/I |

**Excepcion Tela Encosto**: Inspector de calidad en Op 50 (aspecto, posicion, cantidad con pieza patron).

### 12. Embalaje (Op 40 / Op 70 / Op 90)

| Control | Responsable | Registro | Reaccion |
|---------|-------------|----------|----------|
| Identificacion segun codigo de pieza | **Operador de logistica** | Autocontrol | Segun P-09/I |
| Cantidad por medio | **Operador de logistica** | Autocontrol | Segun P-09/I |

**Excepcion Tela Encosto**: Operador de produccion en Op 70 embalaje.

### 13. Test de Lay Out (seccion final)

| Control | Responsable | Registro | Reaccion |
|---------|-------------|----------|----------|
| Flamabilidad horizontal (camara de combustion) | **Operador de calidad** | Registro de auditoria | Segun P-09/I |
| Dimensional completo (calibre de control, 30 muestras) | **Metrologo** | Informe de medicion | Segun P-09/I |

**Excepcion Tela Encosto**: Laboratorio en test dimensional (5 piezas anual).

---

## Resumen ejecutivo

| Rol | Usado en |
|-----|----------|
| Recepcion de materiales | TODA recepcion MP (excepto 3 items Tela Encosto = Auditor de recepcion) |
| Operador de produccion | TODO setup, proceso, autocontrol, espumado |
| Inspector de calidad | Tela Encosto: corte y costura (con pieza patron inicio turno) |
| Operador de calidad | Headrests: inspeccion final, carga ARB, flamabilidad lay out |
| Operador de produccion / Calidad | Inspeccion final apariencia (Insert, Top Roll, IP Decorative, Headrests, APB) |
| Metrologia | Dimensional con calibre, peeling (todas las familias) |
| Metrologo | Test lay out dimensional (todas las familias excepto Tela Encosto) |
| Laboratorio | Test lay out Tela Encosto |
| Operador de logistica | Embalaje (todas las familias excepto Tela Encosto) |
| Auditor de recepcion | Solo Tela Encosto: peso, ancho, flamabilidad |
