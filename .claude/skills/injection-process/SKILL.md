---
name: injection-process
description: Conocimiento del proceso de inyeccion Barack (plastica y PU) — 6M obligatorio, defectos tipicos validados por el gerente, retrabajos tipificados, controles de deteccion diferenciados, maestros Supabase (families 15/16/17), materiales higroscopicos, refrigeracion de tornillo, mantenimiento de molde. Usar cuando se edita un AMFE/CP con operaciones de inyeccion, se trabaja con los maestros de inyeccion, o se evaluan defectos/controles de inyectora.
---

# injection-process — inyeccion plastica y PU en Barack

Leer `docs/GUIA_INYECCION.md` antes de editar AMFE/CP de inyeccion (conocimiento validado por el gerente).

## Dos tipos de inyeccion — NO confundir, NO sincronizar entre si

**Inyeccion PLASTICA (termoplastico)** — maestro family 15. Materiales: PP, ABS, PC, PA, EPDM, PET. Inyectora, molde metalico, ciclo corto. Familias con esta OP: IP PAD (OP 20), Top Roll (OP 10), Insert (OP 70), Armrest (OP 60, carrier).

**Inyeccion PU (espuma poliuretano)** — maestro family 17 (Iny PUR Headrest). Mezcla quimica Poliol+Isocianato, reaccion en molde, curado 180+ seg, EPP completo. Familias: Armrest (OP 70, respaldo sobre carrier), Headrest x3 (OP ESPUMADO/INYECCION DE PU).

Sin inyeccion: Telas Planas PWA, Telas Termoformadas PWA.

**Antes de correr cualquier sync hacia una familia: leer las fallas/causas de la OP destino.** Si dicen "costura", "espumado", "poliol" → NO es inyeccion plastica. (Incidente 2026-04-20: el maestro plastico se propago a 3 Headrest que solo tienen PU; hubo que revertir a mano.)

## Maestros en Supabase

| Maestro | family_id | AMFE doc id | CP doc id | OPs |
|---|---|---|---|---|
| Inyeccion Plastica | 15 | 4a5fa0d1-46ee-4d6b-b699-2cbaeb14602c (AMFE-MAESTRO-INY-001) | 81b60cdd-1296-4821-a348-a8e3c2433b0d (CP-MAESTRO-INY-001) | 20 Inyeccion, 30 Control dim + corte colada |
| Logistica y Recepcion | 16 | ef327ae0-c147-4716-ba22-601cedf5b3d1 (AMFE-MAESTRO-LOG-REC-001) | 34943c75-b9ad-4284-8dd6-d491d1dccf95 (CP-MAESTRO-LOG-REC-001) | 10 Recepcion MP (transversal, AIAG CP 2024 "procesos interdependientes") |
| Iny PUR Headrest | 17 | ver memoria `project_maestro_pu_headrest` | — | 1 OP, aplica a 3 Headrest |

## 6M obligatorio en OP de INYECCION PLASTICA (los 6, 1M por linea)

| M | WE tipico | Funcion ejemplo |
|---|---|---|
| Machine | Inyectora (zonas temperatura, tornillo, fuerza cierre, refrigeracion) | Conformar pieza segun specs |
| Material | Indirectos: colorante, desmoldante. NO pellet directo (va en OP 10 recepcion) | Tenir pieza segun color |
| Method | Dossier de parametros, procedimiento arranque/cambio de molde | Aplicar parametros validados |
| Man | Verificacion parametros al arranque, visual 100% | Validar pieza antes de liberar |
| Measurement | Pirometros, calibre, balanza dosificacion | Medir vs especificacion |
| Environment | Aire comprimido filtrado, temperatura planta | Condiciones estables de ciclo |

La regla "6M completo" aplica SOLO a inyeccion plastica (dossier del gerente). Otras OPs tienen los WEs que el proceso real requiere — no flaggear "6M incompleto" sin confirmar que es inyeccion plastica leyendo el contenido.

## Defectos tipicos (validados por el gerente)

1. Falta de llenado (presion/volumen insuficiente, venteo obstruido) · 2. Rebabas/flashes (fuerza cierre, linea de junta, parametros) · 3. Orificios tapados (molde sucio, canales refrigeracion) · 4. Quemaduras (temperatura excesiva, venteo) · 5. Chupados/rechupes (compactacion, 2da presion) · 6. Deformada (enfriamiento) · 7. Flash visible (cierre, molde danado) · 8. Dimensional NOK (contraccion, temp molde, humedad) · 9. Color/apariencia NOK (mezcla colorante, temp fusion) · 10. Desprendimiento multi-material (adhesion).

## Retrabajos tipificados (NO "retrabajo fuera del puesto" generico)

Scrap (rebabas graves, dimensional fuera, quemaduras criticas) · Retrabajo in-station (corte de colada, limpieza leve) · Retrabajo laboratorio (dimensional con instrumento calibrado) · Ajuste de parametros (dossier, reset zona) · Cambio de molde (dano estructural).

## Controles de deteccion diferenciados (NO todo "autocontrol visual 100%")

| Defecto | Deteccion correcta |
|---|---|
| Dimensional | Calibre / instrumento calibrado |
| Rebabas | Visual 100% + calibre de referencia |
| Quemaduras | Visual con muestra patron de defectos |
| Color | Comparacion con muestra maestra bajo luz controlada |
| Humedad/secado | Control temp/tiempo de tolva secadora al arranque |
| Flamabilidad | Certificado de laboratorio por lote (TL 1010 VW) |
| Material contaminado | Certificado proveedor + filtro en aspiradora |

## Datos tecnicos del proceso

- **Higroscopicos (presecado obligatorio)**: ABS 80°C 2-4h; PC 120°C 2-4h; PA 80°C 2-6h; PET 120-150°C 4-6h. PP/PE no requieren. Si el proceso usa higroscopico: WE "Tolva secadora" en OP 10 con falla "Secado insuficiente / humedad residual".
- **Refrigeracion del tornillo**: la garganta/boca (primera zona) SIEMPRE refrigerada con agua; si falla, el material funde antes de tiempo y forma pasta que atasca. Falla tipica: "Boca de alimentacion atascada por pasta de material" ← "Refrigeracion de garganta fallando".
- **Mantenimiento de molde**: preventivo por golpes U horas (lo primero); correctivo ante defectos estructurales; al bajar molde: limpieza interna (soplete a canales para sacar agua) + externa + lubricacion ambas caras; superficie magnetica de la inyectora libre de suciedad/golpes/rebabas.
- **Estructura base maestro PU**: Material = Poliol (A) + Isocianato (B); Machine = inyectora PU con controlador de dosificacion; Method = relacion A:B, tiempo de crema, tiempo de colada, temp molde, presion; Man = verificacion parametros arranque; Measurement = balanza dosificacion, cronometro curado, termometro molde; Environment = ventilacion (gases), temp ambiente.
- Temperaturas/presiones/tiempos exactos: NUNCA inventar; usar rangos del gerente o TBD (regla core-prohibiciones).
