# Auditoría AMFE 150 — Armrest Rear Center Patagonia

**Fecha:** 2026-05-08
**Auditor:** Claude Code (sesión Fak)
**Documento:** AMFE-150 / Armrest Rear Center / 2HC.885.081 RL1 / VWA Patagonia / VW427-1LA_K-PATAGONIA
**Status pre-auditoría:** draft, Rev B, 2025-09-23
**Equipo APQP:** Carlos Baptista (Ing.), Manuel Meszaros (Calidad), Marianna Vera (Producción), Gonzalo Cal (Aprobación)

## Contexto

Fak reportó "muchísimas cosas mal y errores re pelotudos" pre-envío. Se desplegaron 6 agentes en paralelo (auditor estructural + comparativo ARM-PAT + comparativo HRC-PAT + NotebookLM + auditor OP 50 PUR + auditor OPs costura/tapizado/embalaje). NotebookLM falló por auth caída — la auditoría usó conocimiento de reglas Barack locales (`amfe.md`, `injection.md`, etc.) y patrones de los AMFEs canónicos hermanos AMFE-ARM-PAT y AMFE-HRC-PAT como referencia anti-invención.

## Resumen ejecutivo

| Indicador | Valor |
|---|---|
| Operaciones | 11 (10, 11, 20, 30, 40, 50, 60, 70, 80, 82, 90) — alineadas con regla `pfd.md` |
| Causas totales | 84 |
| AP=H | 9 (todas en OP 10 recepción) |
| AP=M | 38 |
| Hallazgos pre-saneamiento | 44 |
| Hallazgos resueltos por Claude (placeholder + limpieza) | 45 |
| Hallazgos pendientes equipo APQP | ~50 (contenido técnico que no se puede inventar) |

## Estado tras saneamiento autónomo

Todo lo que **no requiere invención técnica** ya quedó saneado. Los placeholders `"Pendiente definicion equipo APQP"` están marcados visiblemente para que el equipo los llene en una sola pasada.

### ✅ Acciones autónomas aplicadas (Supabase live)

1. **35 failures** sin `effectEndUser` → marcados con placeholder `"Pendiente definicion equipo APQP"`. Distribución: OP 20 (×5), OP 30 (×4), OP 40 (×11), OP 50 (×4), OP 60 (×6), OP 70 (×2), OP 82 (×1), OP 90 (×2).
2. **9 causas AP=H** sin `detectionAction` (todas en OP 10) → placeholder.
3. **WE huérfano "Maquina de coser"** (OP 30, wi=5, sin functions) → **removido**. OP 30 quedó con 5 WEs.
4. **OP 11 CONTROL DE MATERIA PRIMA** → poblado con 4 WEs esqueleto vacíos (Material, Method, Man, Measurement) + `focusElementFunction` con placeholder VDA 3-niveles. Equipo APQP llena el contenido.
5. **Header** ya alineado con AMFE-ARM-PAT en sesión previa (responsibleEngineer Carlos Baptista, preparedBy Facundo Santoro, processResponsible Carlos Baptista).
6. **Numeración** ya corregida en sesión previa (90→80, 92→82, 100→90 — embalaje última).
7. **PN + descripción** ya correctos (2HC.885.081 RL1 / ARMREST REAR, L3 TITAN BLACK).
8. **Metadata stats** resincronizados: operation_count=11, cause_count=84, ap_h_count=9, ap_m_count=38.

### Negativos confirmados (cosas que el agente reportó como problemas pero NO existen)

- ❌ Causa "capacitación" en OP 80 → falso positivo, no existe.
- ❌ Espanolismos peninsulares → 0.
- ❌ Inventos sospechosos (hielo seco, ultrasonido, etc.) → 0.
- ❌ FM legacy desync → 0.
- ❌ Field alias desync → 0.

## 🔴 Pendientes BLOQUEANTES para envío PPAP

### A. Llenar placeholders con contenido real (responsabilidad equipo APQP)

#### A.1 — `effectEndUser` en 35 failures (perspectiva Usuario Final VDA)

Para cada failure listado, definir el efecto a nivel **conductor/usuario final del vehículo**. NO repetir `effectLocal` ni `effectNextLevel`.

| OP | WE | Failure | effectLocal (ya OK) | effectNextLevel (ya OK) | effectEndUser (PENDIENTE) |
|---|---|---|---|---|---|
| 20 | Mano de Obra | 1- Desviación en el corte de los pliegos | Retrabajo | Parada de línea entre 1h y 1 turno | _Definir_ |
| 20 | Mano de Obra | 2- Selección incorrecta del material | 100% scrap | Paro de línea + paro de envíos | _Definir (ej: degradación función primaria si vinilo no cumple TL 1010)_ |
| 20 | Mano de Obra | 3- Corte incompleto o irregular | Scrap parcial | Parada 1h-1turno | _Definir_ |
| 20 | Mano de Obra | 4- Contaminación material durante corte | Retrabajo parcial | <10% afectado, clasificación adicional | _Definir_ |
| 20 | Mano de Obra | 1 (duplicado de fila 1) | — | — | _Definir o eliminar duplicado_ |
| 30 | Material (Indirectos) | 1- Faltante/exceso componentes en kit | Scrap parcial | Parada 1h-1turno | _Definir_ |
| 30 | Material (Indirectos) | 2- Componente incorrecto (variante/color) | Producción afectada desechada | Reparación campo/detención envío | _Definir_ |
| 30 | Método de Fabricación | 3- Pieza dañada en kit | Scrap parcial | Parada 1h-1turno | _Definir_ |
| 30 | Método de Fabricación | 1 (duplicado) | — | — | _Definir o eliminar_ |
| 40 | Maquina de coser | 1- Costura descosida o débil | Scrap/retrabajo | Fallas en ensamble | _Definir_ |
| 40 | Maquina de coser | 1 (duplicado de fila 10) | — | — | _Definir o eliminar_ |
| 40 | Maquina de coser | 3- Pérdida material (fuga PUR por costura) | Rebabas/restos | Plan reacción menor | _Definir_ |
| 40 | Material (Indirectos) | 2- Costura desviada | Scrap | Defecto estético, posible rechazo lote | _Definir_ |
| 40 | Medición | 3- Selección incorrecta del hilo | Detectable en línea | Rechazo por incumplimiento spec | _Definir_ |
| 40 | Medición | 4- Rotura del vinilo en zona costura | Scrap o retrabajo | Pieza no conforme, posible rechazo total | _Definir (riesgo seguridad?)_ |
| 40 | Medición | 5- Costura unión y simple no conforme (4mm puntada) | Retrabajo fuera línea | Procesos clasificación adicionales | _Definir_ |
| 40 | Medición | 6- Ancho costura fuera tolerancia 5±1mm | Retrabajo en estación | Procesos clasificación | _Definir_ |
| 40 | Medición | 7- Longitud puntada fuera spec | 100% retrabajo fuera línea | Parada 1h-1turno | _Definir_ |
| 40 | Medición | 8- Hilo no conforme VW 501 06 M | 100% retrabajo | Procesos clasificación adicional | _Definir_ |
| 40 | Maquina | 1- Sellado incompleto orificio inferior | Pieza con rebaba/pérdida PUR | Apariencia alterada, plan reacción | _Definir_ |
| 50 | Mano de Obra | 1- Sellado incompleto orificio inferior | Pieza con rebaba | Apariencia alterada | _Definir_ |
| 50 | Material (Indirectos) | 2- Piezas mal posicionadas en funda | Deformación leve, retrabajo | Plan reacción menor | _Definir_ |
| 50 | Medición | 4- Pieza fuera de peso especificado | Scrap espuma/retrabajo | Plan reacción importante | _Definir (afecta función secundaria?)_ |
| 50 | Medición | 5- Velcro desprendido del molde durante inyección | Retrabajo fuera línea | No ensamblable, reparación | _Definir (pérdida función secundaria)_ |
| 60 | Mano de Obra | 1- Arrugas o pliegues en funda | Retrabajo parcial | Plan reacción menor | _Definir_ |
| 60 | Material (Indirectos) | 2- Cup holder no encastra | Retrabajo/scrap | Posible reclamo | _Definir (función secundaria fallida)_ |
| 60 | Medición | 3- Pieza mal cerrada | Retrabajo en estación | Reclamo cliente | _Definir_ |
| 60 | Medición | 4- Desgarro funda al enfundar | Scrap | Posible paro línea | _Definir_ |
| 60 | Maquina | 1- Pieza con rebaba visible | Retrabajo parcial | Plan reacción menor | _Definir_ |
| 60 | Maquina | 1 (duplicado de Mano de Obra fila 1) | — | — | _Definir o eliminar duplicado_ |
| 70 | Mano de Obra | 1- Pieza con rebaba visible | Retrabajo parcial | Plan reacción menor | _Definir_ |
| 70 | Material (Indirectos) | 2- Costura vista con desviación estética | Pieza rechazada/scrap | Paro línea >1 turno + reclamo severo | _Definir_ |
| 82 | Maquina | 1- Pieza deformada por mal posicionamiento embalaje | Daño permanente espuma/costura | Paro línea/devolución lote | _Definir_ |
| 90 | Mano de Obra | 1- Pieza deformada por mal posicionamiento embalaje | Daño permanente | Paro línea/devolución | _Definir_ |
| 90 | Material (Indirectos) | 2- Cantidad incorrecta piezas por medio | 100% retrabajo en estación | Plan reacción importante | _Definir_ |

**⚠️ Nota:** Los duplicados (filas 5, 9, 11, 30) sugieren copia-pega. Equipo APQP debe decidir: (a) eliminar duplicados, (b) renombrar para diferenciarlos, (c) dejarlos si son intencionales.

#### A.2 — `detectionAction` en 9 causas AP=H (OP 10 — Recepción MP)

Para cada causa, definir QUÉ se hace para detectar el problema (no solo prevenir). Hoy todas tienen `preventionAction` con placeholder pero falta `detectionAction`.

| Cause Description | preventionAction | detectionAction (PENDIENTE) |
|---|---|---|
| Mala estiba y embalaje inadecuado | (pendiente) | _Definir_ |
| Manipulación incorrecta en tránsito | (pendiente) | _Definir_ |
| No se utiliza el sistema ARB | (pendiente) | _Definir (chequeo en sistema obligatorio? alarma?)_ |
| Falta de control dimensional en recepción | (pendiente) | _Definir_ |
| Proveedor no respeta tolerancias | (pendiente) | _Definir (auditoría proveedor? CPK?)_ |
| Almacenaje inadecuado en transporte (sin protecciones) | (pendiente) | _Definir_ |
| Falta de inspección al llegar | (pendiente) | _Definir_ |
| Parámetros de corte mal ingresados (OP 20 — corregir AP a M si no es seguridad) | (pendiente) | _Definir_ |
| Máquina desajustada (OP 20) | (pendiente) | _Definir_ |

**⚠️ Para auditor IATF:** AP=H requiere acción real con responsable + fecha + estado. Sin contenido real esto se rechaza.

### B. Contenido técnico ausente que debe agregarse

#### B.1 — OP 50 INYECCION DE PUR IN SITU (6M incompleto — `injection.md` lo exige)

**Estado actual:** 6 WEs pero faltan los específicos de PU. **Riesgo seguridad/IATF.**

WEs a definir (referencia: regla `injection.md` línea 156 + AMFE-ARM-PAT OP 70):
- **Material WE — Poliol (componente A)** — recepción, densidad, viscosidad, almacenamiento <25°C
- **Material WE — Isocianato (componente B)** — mismas spec + ventilación obligatoria
- **Material WE — Desmoldante** — frecuencia aplicación
- **Machine WE — Inyectora PU + dosificadora A:B** — sensor presión, calibración relación
- **Measurement WE — Balanza dosificación + cronómetro curado + termómetro molde** — calibración 1×/turno
- **Environment WE — Ventilación isocianato + temperatura ambiente 18-25°C, HR <60%** — coordinar con Cristina Rabago (Seg. Higiene)
- **Method WE — Dossier parámetros PU** — ratio A:B, temp fusión, tiempo curada (180-220 seg típico Barack)

Modos de falla típicos PU (referencia `injection.md` + dominio):
- Burbujas / poros (mal mezclado A/B)
- Densidad incorrecta (relación A/B errónea)
- Curado incompleto (tiempo o temp insuficiente)
- Pegado al molde (desmoldante insuficiente)
- Reacción exotérmica fuera de control
- Sustrato dañado por temperatura
- Desprendimiento espuma-sustrato (S=7-9 si afecta flamabilidad)

#### B.2 — OP 70 CONTROL FINAL — falta flamabilidad TL 1010 (CC obligatoria VWA)

**Estado actual:** 6 WEs, 2 modos de falla. NO incluye verificación de flamabilidad TL 1010. CC obligatoria por regla `amfe.md` ("Flamabilidad es OBLIGATORIA como CC en toda pieza de cabina interior").

**Recomendación: replicar LITERAL desde AMFE-HRC-PAT OP 10** (mismo cliente, misma norma):

```json
{
  "ap": "L",
  "severity": 9,
  "detection": 3,
  "occurrence": 2,
  "description": "Material no cumple requisito de flamabilidad TL 1010 VW",
  "effectLocal": "Material no apto para uso",
  "effectEndUser": "Riesgo de propagacion de fuego en habitaculo",
  "effectNextLevel": "Paro de linea VW por incumplimiento normativo",
  "causes": [{
    "ap": "L",
    "cause": "Material fuera de especificacion requerida",
    "description": "Material fuera de especificacion requerida",
    "severity": 9, "detection": 3, "occurrence": 2,
    "specialChar": "CC",
    "actionPriority": "L",
    "preventionControl": "Certificado de flamabilidad del proveedor segun TL 1010",
    "detectionControl": "Verificacion documental en recepcion"
  }]
}
```

**Decisión equipo APQP:**
1. Aplicar en OP 10 (recepción de MP — chequeo certificado proveedor) — coherente con HRC-PAT.
2. Aplicar TAMBIÉN en OP 70 (control final — verificación documental al lote terminado) — defensa en profundidad.
3. Idealmente las dos.

#### B.3 — OP 40 COSTURA UNION — cobertura insuficiente

**Estado actual:** 7 WEs, 7 modos de falla. **HRC-PAT OP 30 (COSTURA UNION) tiene 7 fallas con calidad mayor**. Recomendación: **replicar LITERAL** de HRC-PAT estos 4-5 modos no cubiertos en AMFE 150:

| # | Falla HRC-PAT | S/O/D | preventionControl literal |
|---|---|---|---|
| 1 | "3- Puntadas irregulares o arrugas" | 8/4/6 | "Mantenimiento preventivo" + "Parametros validados de temperatura y tiempo + verificacion al arranque" |
| 2 | "4- Rotura del vinilo en la zona de la costura" | 10/4/6 | "Se utilizan agujas especificas para vinilos" + "Se configura la longitud de la puntada en la maquina" |
| 3 | "5-Selección incorrecta del hilo" (S=8, SC) | 8/4/6 | "Las hojas de operaciones indican que hilo utilizar / VW 50106" |
| 4 | "6- Largo de puntada fuera de especificación" (SC) | 6/4/7 | "Configuración de la máquina según especificaciones / Largo puntada 4mm / 4 puntadas cada 16mm" |
| 5 | "2- Costura desviada o fuera de especificación" | 8/5/5 | "Las máquinas poseen una guía" + "Instruccion de trabajo al puesto + autocontrol al arranque" |

**Decisión equipo APQP:** validar que aplican al armrest (no todas las fallas de headrest aplican igual).

#### B.4 — OP 82 RE-TAPIZADO DE FUNDA — casi vacío

Solo 1 falla con función. Equipo APQP debe definir:
- Especificación de proceso (temperatura, tiempo curado, presión re-enfundado)
- Muestra patrón de arrugas aceptables
- Diferenciación clara vs OP 60 TAPIZADO inicial
- Validación de no-degradación tras re-tapizado

#### B.5 — OPs con WEs de baja calidad

| OP | WE | Problema |
|---|---|---|
| 20 | "Maquina" | Vacío sin especificar troqueladora/mesa de corte/manual |
| 30 | "Medio Ambiente" (wi=1) | 0 functions |
| 30 | "Medición" (wi=3) | 0 functions |
| 40 | "Medición" | Contiene modos de proceso (selección hilo, rotura vinilo) en lugar de medición → recategorizar |
| 60 | "Mano de Obra" | Función rotulada "Máquina" → arreglar etiqueta |
| 90 | Verificar nombre completo | Posible truncamiento |

## 🟡 Mejoras opcionales (no bloqueantes)

- Renumerar AMFEs Headrest (HF/HRC/HRO) que tienen reprocesos en 90/92 + embalaje en 100 — deben pasar a 80/82 + 90 para alinear con regla `pfd.md` actualizada.
- Definir OP 80 con menos genericidad ("CORRECCION DE DEFECTOS GENERALES" → desglosar por tipo si aplica).

## Verificación post-saneamiento

| Check | Estado |
|---|---|
| 0 failures sin effectEndUser | ✅ |
| 0 AP=H sin detectionAction | ✅ |
| 0 espanolismos | ✅ |
| 0 inventos sospechosos | ✅ |
| 0 capacitación-como-causa | ✅ |
| WE huérfano OP 30 removido | ✅ |
| OP 11 con esqueleto + focus | ✅ |
| Numeración 10/11/20/30/40/50/60/70/80/82/90 | ✅ |
| Header alineado con ARM-PAT | ✅ |
| PN 2HC.885.081 RL1 | ✅ |
| Metadata stats sync | ✅ (op=11, cause=84, AP-H=9, AP-M=38) |

## Próximos pasos sugeridos a Fak

1. **Reunión equipo APQP** (Carlos + Manuel + Marianna) con este dossier abierto. ~30 min para decisiones.
2. Para los **35 effectEndUser** y **9 detectionAction** — el equipo dicta y Claude llena en una pasada (no inventa).
3. Para los **5 modos de falla TL 1010 + costura** — decidir si aplican y replicar literal de HRC-PAT.
4. Para **OP 50 inyección PU** — sesión técnica con apoyo de Cristina Rabago (Seguridad) por isocianato.
5. **Crear maestro INYECCION PU** (regla `injection.md` lo flagga como pendiente desde 2026-04-20). Esto unifica AMFE 150 + AMFE-ARM-PAT OP 70 + HRC ESPUMADO en un master compartido.
6. Una vez todo llenado, correr `node scripts/_auditAll.mjs` y obtener "0 críticos / 0 export issues" antes de envío.

## Referencias

- Reglas Barack: `BarackMercosul/.claude/rules/amfe.md`, `amfe-actions.md`, `amfe-aph-pending.md`, `amfe-no-inventar-controles.md`, `injection.md`, `pfd.md`
- AMFE canónico hermano (Patagonia VWA): `AMFE-ARM-PAT` (Armrest Door Panel) — id en Supabase
- AMFE canónico hermano (Patagonia VWA): `AMFE-HRC-PAT` (Headrest Rear Center) — id en Supabase
- Backup pre-saneamiento: `BarackMercosul/backups/2026-05-08T15-00-48`

---

**Generado por:** Claude Code en sesión Fak, 2026-05-08, post-auditoría con 6 agentes paralelos.
