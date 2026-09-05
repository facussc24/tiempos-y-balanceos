---
name: verificacion-consumos
description: Checklist canonico + validador para tablas de consumo y cargas al ERP arb (BOMs, tizadas, insumos, etiquetas, quimicos). Usar SIEMPRE antes de entregar a Fak una tabla de consumos, una carga para el arb, o una auditoria de BOM — y cuando se trabaje con INSUMOS.txt, export RELACIONES, o fichas de embalaje. Nace de 6 fallos reales de 2026-07-14/16.
---

# Verificacion de consumos — checklist canonico

**REGLA MADRE: la regla canonica le gana al dato puntual de cualquier fuente**
(arb, BOM, mi propio analisis). Un valor fresco y concreto siempre "gana" dentro
del razonamiento — por eso el chequeo va sobre la **TABLA FINAL**, no sobre mi
cabeza. Enforcement: hook `consumos-entregable-guard.sh` + este checklist +
`scripts/_validarConsumos.mjs`.

## Checklist obligatorio (en orden)

1. **Fuentes por tipo de dato** (cada dato UN hogar):
   - Numeros de consumo: BOM de **Rev de numero MAYOR** del folder de consumo
     ACTUAL (`...\2. CONSUMO DE MATERIAL BOM\BOMS\`). Parsear el int de la Rev.
     **PROHIBIDO decir "no documentado" sin listar el folder y PEGAR la salida**
     (papelón BOM 127 Rev6 vs Rev7).
   - Vinilo/tela de SERIE: tabla tizadas Mesa de Corte (`CONSUMOS TIZADAS
     <fecha>.xlsx`, hoja por cliente, col ML) — le gana al arb y a BOMs.
     Ver memoria `reference_tabla_consumo_mesa_corte`.
   - Unidades: **NO se eligen, SE BUSCAN en el maestro del arb, y BOM = maestro =
     FACTURA del proveedor** (la OC copia la etiqueta del maestro, no prueba nada:
     `reference_unidad_oc_es_etiqueta_del_maestro`). Desde el 05/09/2026 el validador
     las busca solo (`scripts/_lib/unidadesArb.mjs`): INSUMOS.TXT **tabulado** →
     RELACIONES.TXT col Unidad → `.arb-cache/insumos.csv` → backup 02/08, la fuente mas
     nueva gana y el reporte dice cual uso. Ojo: el INSUMOS.TXT exportado el 28/08 es el
     **listado impreso, sin columna de unidad**: no sirve, hay que re-exportar el tabulado.
     Dos grafias de la misma familia (UN/UNI/UNID, MTS/MTL/ML) no son error; dos familias
     distintas (MT2 vs MTL, UN vs KG) si. Familias en `unidades_alias` del canon, medidas
     sobre la poblacion, no a ojo. Ver memoria `reference_arb_insumos_maestro`.
   - Piezas/caja: ficha GAMA EMBALAJE (`reference_fichas_embalaje_server`).
2. **Reglas canonicas** (detalle en `scripts/_lib/consumosCanon.data.json`):
   - Etiqueta 100x60/SATO = 1 por CAJA (1/pzas-caja), NUNCA por pieza.
   - Etiqueta 50x20 = 1 por pieza; 2 si la pieza lleva inyeccion propia.
   - Quimicos A+B con valor IGUAL en "LTS" = fraccion-de-envase sospechosa
     (envases distintos != 1:1) → gramos o unidades reales asimetricas.
   - El BOM documenta en gramos y el arb carga en LTS = cosas distintas; nunca
     asumir densidad 1.
3. **Export RELACIONES del arb**: cuando la descripcion es multi-linea, la fila
   se PARTE — el consumo esta en la fila +2 corrido 3 columnas, NO falta. Arbol
   por bloques de +7 cols/nivel. NUNCA saltear filas sin abrir el crudo.
   Ver memoria `reference_arb_export_estructura`.
4. **Correr el validador** sobre la tabla final:
   ```bash
   node scripts/_validarConsumos.mjs <tabla.xlsx|csv> \
     [--producto P703-EFG] [--pzas-caja N] [--compare consumo actual_arb] \
     [--arb-dir C:\tmp] [--arb-cache .arb-cache] [--insumos maestro_a_mano]
   ```
   Tolerancia **0,1%** — NUNCA 2% (tapa typos reales: poliol 0,22806 vs
   0,225806 = 1% y era error). Invariantes que cierran (ISO+POLI=0,35 exacto;
   suma vinilos variantes = RL1).
5. **Agente independiente**: ademas del script propio, lanzar UN agente con ojos
   frescos sobre la tabla (mi script solo chequea lo que yo pense chequear).
6. **Entrega a Fak**: mostrar dato crudo **before→after** con columna "actual en
   arb" al lado del correcto. NO asumir que mi analisis esta bien.
7. **Abrir el archivo generado** antes de entregarlo (regla verify-before-close
   paso 5 — leccion "gravisimo" 2026-07-15).

## Que hace el validador (automatico)

`CODIGO_DUPLICADO` (mismo codigo, valores distintos) · `QUIMICO_VALOR_IDENTICO`
(par A+B 1:1) · `ETIQUETA_100X60` (por pieza vs 1/caja) · `ETIQUETA_50X20`
(fuera de {1,2}) · **unidades contra el maestro del arb, sin flags**: `UNIDAD_VS_MAESTRO`
(FAIL, familia distinta) · `UNIDAD_GRAFIA` (INFO, misma unidad escrita distinto) ·
`UNIDAD_CAMBIO_ETIQUETA` (WARN: el codigo decia MT2 en una foto vieja y hoy MTL — si las OC
no movieron cantidad ni precio fue cambio de etiqueta y el consumo se reconvierte con el
factor fisico, caso aplix/Haartz 20/08) · `UNIDAD_CODIGO_SIN_MAESTRO` · `UNIDAD_MAESTRO_VACIA`
· `UNIDAD_VACIA_EN_TABLA` · `TABLA_SIN_UNIDAD` · `UNIDAD_FUENTE` (el INSUMOS.TXT es el
listado impreso, un codigo con dos unidades en RELACIONES) · `INVARIANTE`
(sumas por producto del canon) · `DIFF_SOBRE_TOLERANCIA` (compare 2 columnas al
0,1%). Exit 1 si hay FAIL.

## Al descubrir una regla canonica nueva

Agregarla a `scripts/_lib/consumosCanon.data.json` (con `fuente:` y fecha) EN LA
MISMA SESION en que Fak la revela — no solo a memoria (regla
rule-enforcement-gate). Si es automatizable, extender `_validarConsumos.mjs`.

## Memorias relacionadas (detalle vivo)

`reference_p703_consumos_verificacion` (3 reglas canonicas + incidentes) ·
`reference_arb_insumos_maestro` (regla madre unidades) ·
`reference_arb_export_estructura` (fila partida, arbol) ·
`reference_tabla_consumo_mesa_corte` (fuente vinilos serie) ·
`project_patagonia_carga_arb` (reglas de etiquetas de Fak).
