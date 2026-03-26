---
description: Reglas del modulo AMFE (severidades, CC/SC, efectos, familias)
globs:
  - "modules/amfe/**/*.ts"
  - "modules/amfe/**/*.tsx"
---

# AMFE VDA

## Severidades calibradas — piezas de cabina interior (Insert, Armrest, Top Roll, Headrest)

| Rango | Aplica a | Ejemplos |
|-------|----------|----------|
| S=9-10 | Flamabilidad, emisiones VOC, interferencia airbag, bordes filosos | TL 1010 VW, normativa REACH |
| S=7-8 | Falla de encastre severa que para linea VW, desprendimiento en campo | Clips rotos, deformacion estructural |
| S=5-6 | Arrugas masivas, delaminacion, costura torcida, Squeak & Rattle, retrabajo offline | Burbuja en termoformado, costura corrida |
| S=3-4 | Cosmetico menor, hilo suelto, mancha limpiable, retrabajo in-station | Color desparejo visible solo con luz rasante |

## Clasificacion CC/SC

- **CC (Critica):** S >= 9 O requerimiento legal/seguridad. Benchmark: 1-5% de items.
- **SC (Significativa):** Cliente designo con simbolo O funcion primaria (S=7-8 encastre). Benchmark: 10-15%.
- **Estandar:** Todo lo demas. Benchmark: 80-90%.
- "Quitar pieza durante tapizado" NO es CC — riesgo al operador se gestiona con EPP, no con clasificacion de producto.
- Flamabilidad TL 1010 VW es OBLIGATORIA como CC en toda pieza de cabina interior.

## Efectos VDA — 3 niveles obligatorios

Todo modo de falla DEBE tener los 3 campos completados:
- `effectLocal` — efecto en la operacion actual
- `effectNextLevel` — efecto en la operacion siguiente o ensamble
- `effectEndUser` — efecto para el usuario final del vehiculo

NUNCA dejar ningun nivel vacio.

## Prioridad de Accion (AP)

- AP=H SIEMPRE requiere accion con responsable, fecha y estado.
- Sin excepcion: si AP=H y no hay accion definida, es un error grave.

## Familias de producto

- UN solo AMFE por familia de producto si el proceso es identico.
- Ejemplo: 4 colores del mismo headrest = 1 AMFE con todos los part numbers en `applicableParts`.
- NO crear AMFEs separados para variantes de color con proceso identico.

## Operaciones condicionales por variante

- Operaciones que no aplican a todos los PN de la familia: marcar "(Aplica solo a PN X, Y, Z)" en el nombre de la operacion. NUNCA crear documentos separados por esto.
- Ejemplo headrests: Costura Vista aplica solo a L1/L2/L3 (Rennes Black, Andino Gray, Dark Slate), no a L0 (Titan Black). Se documenta en 1 solo AMFE/CP/HO con la restriccion en el nombre.
- La HO de la operacion condicional debe incluir instruccion explicita de verificar numero de parte antes de ejecutar.

## Reglas especificas

- "Remito" NO es una operacion de proceso interno. Solo aplica en Recepcion de MP.
- "Almacenamiento WIP" NO es operacion de proceso. No debe tener AMFE propio.
- Transporte interno NO es operacion con controles.

## Guias obligatorias

Leer ANTES de modificar datos AMFE:
- `docs/GUIA_AMFE.md` — guia de autoria completa
- `docs/ERRORES_CONCEPTUALES_APQP.md` — errores graves ya detectados, NO repetirlos
