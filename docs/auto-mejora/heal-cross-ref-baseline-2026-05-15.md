# Healing cross-ref baseline — 2026-05-15

Generado por `scripts/_healWeNameByCrossRef.mjs` en dry-run.

## Resumen

- AMFEs evaluados: 12 (filter=ninguno, field=both)
- WE.name reparados (PROPOSE_APPLY): 5
- fn.description reparados (PROPOSE_APPLY): 0
- Casos TBD (requieren Fak): 19
- Confidence breakdown: high=5 medium=0 low=0

## Cambios propuestos por AMFE

### AMFE-1

| OP | OP_TYPE | WE_TYPE | FIELD | CURRENT | CANDIDATE | SOURCE | FROM | CONFIDENCE | ACTION |
|----|---------|---------|-------|---------|-----------|--------|------|-----------|--------|
| 15 | corte | Machine | fn.description |  | (null) | tbd | — | low | TBD_NO_MATCH |

### AMFE-2

| OP | OP_TYPE | WE_TYPE | FIELD | CURRENT | CANDIDATE | SOURCE | FROM | CONFIDENCE | ACTION |
|----|---------|---------|-------|---------|-----------|--------|------|-----------|--------|
| 20 | corte | Material | WE.name | Cuchilla de corte | Cuchilla de corte | library | — | high | PROPOSE_APPLY |

### AMFE-ARM-PAT

| OP | OP_TYPE | WE_TYPE | FIELD | CURRENT | CANDIDATE | SOURCE | FROM | CONFIDENCE | ACTION |
|----|---------|---------|-------|---------|-----------|--------|------|-----------|--------|
| 10 | recepcion | Method | fn.description |  | (null) | tbd | — | low | TBD_NO_MATCH |
| 15 | corte | Material | WE.name | Cuchilla de corte | Cuchilla de corte | library | — | high | PROPOSE_APPLY |
| 15 | corte | Material | fn.description |  | (null) | tbd | — | low | TBD_NO_MATCH |
| 20 | corte | Material | WE.name | Cuchilla de corte | Cuchilla de corte | library | — | high | PROPOSE_APPLY |
| 20 | corte | Material | fn.description |  | (null) | tbd | — | low | TBD_NO_MATCH |

### AMFE-HF-PAT

| OP | OP_TYPE | WE_TYPE | FIELD | CURRENT | CANDIDATE | SOURCE | FROM | CONFIDENCE | ACTION |
|----|---------|---------|-------|---------|-----------|--------|------|-----------|--------|
| 50 | enfundado | Man | fn.description |  | (null) | tbd | — | low | TBD_NO_MATCH |
| 51 | varilla | Man | fn.description |  | (null) | tbd | — | low | TBD_NO_MATCH |

### AMFE-HRC-PAT

| OP | OP_TYPE | WE_TYPE | FIELD | CURRENT | CANDIDATE | SOURCE | FROM | CONFIDENCE | ACTION |
|----|---------|---------|-------|---------|-----------|--------|------|-----------|--------|
| 20 | corte | Machine | fn.description |  | (null) | tbd | — | low | TBD_NO_MATCH |
| 30 | costura | Machine | fn.description |  | (null) | tbd | — | low | TBD_NO_MATCH |
| 70 | varilla | Man | fn.description |  | (null) | tbd | — | low | TBD_NO_MATCH |

### AMFE-HRO-PAT

| OP | OP_TYPE | WE_TYPE | FIELD | CURRENT | CANDIDATE | SOURCE | FROM | CONFIDENCE | ACTION |
|----|---------|---------|-------|---------|-----------|--------|------|-----------|--------|
| 20 | corte | Machine | fn.description |  | (null) | tbd | — | low | TBD_NO_MATCH |
| 30 | costura | Machine | fn.description |  | (null) | tbd | — | low | TBD_NO_MATCH |
| 70 | varilla | Man | fn.description |  | (null) | tbd | — | low | TBD_NO_MATCH |

### AMFE-INS-PAT

| OP | OP_TYPE | WE_TYPE | FIELD | CURRENT | CANDIDATE | SOURCE | FROM | CONFIDENCE | ACTION |
|----|---------|---------|-------|---------|-----------|--------|------|-----------|--------|
| 5 | recepcion | Material | fn.description |  | (null) | tbd | — | low | TBD_NO_MATCH |
| 20 | corte | Material | WE.name | Cuchilla de corte | Cuchilla de corte | library | — | high | PROPOSE_APPLY |
| 20 | corte | Material | fn.description |  | (null) | tbd | — | low | TBD_NO_MATCH |

### AMFE-TR-PAT

| OP | OP_TYPE | WE_TYPE | FIELD | CURRENT | CANDIDATE | SOURCE | FROM | CONFIDENCE | ACTION |
|----|---------|---------|-------|---------|-----------|--------|------|-----------|--------|
| 10 | recepcion | Material | fn.description |  | (null) | tbd | — | low | TBD_NO_MATCH |
| 20 | inyeccion | Material | fn.description |  | (null) | tbd | — | low | TBD_NO_MATCH |

### VWA-PAT-IPPADS-001

| OP | OP_TYPE | WE_TYPE | FIELD | CURRENT | CANDIDATE | SOURCE | FROM | CONFIDENCE | ACTION |
|----|---------|---------|-------|---------|-----------|--------|------|-----------|--------|
| 20 | inyeccion | Material | fn.description |  | (null) | tbd | — | low | TBD_NO_MATCH |
| 30 | corte | Material | WE.name | Cuchilla de corte | Cuchilla de corte | library | — | high | PROPOSE_APPLY |
| 30 | corte | Material | fn.description |  | (null) | tbd | — | low | TBD_NO_MATCH |
| 70 |  | Environment | fn.description |  | (null) | tbd | — | low | TBD_NO_MATCH |

## Casos TBD que requieren input de Fak

1. **VWA-PAT-IPPADS-001 OP 20 (inyeccion) — Material fn.description**
   - Current: ``
   - Razon engine: Pasos 1,2,3,7 fallan para fn.description opType=inyeccion weType=Material weName=Mezcla de poliol e isocianato

2. **VWA-PAT-IPPADS-001 OP 30 (corte) — Material fn.description**
   - Current: ``
   - Razon engine: Pasos 1,2,3,7 fallan para fn.description opType=corte weType=Material weName=Cuchilla de corte

3. **VWA-PAT-IPPADS-001 OP 70 (null) — Environment fn.description**
   - Current: ``
   - Razon engine: Pasos 1,2,3,7 fallan para fn.description opType=unknown weType=Environment weName=Ventilacion

4. **AMFE-INS-PAT OP 5 (recepcion) — Material fn.description**
   - Current: ``
   - Razon engine: Pasos 1,2,3,7 fallan para fn.description opType=recepcion weType=Material weName=Material recibido

5. **AMFE-INS-PAT OP 20 (corte) — Material fn.description**
   - Current: ``
   - Razon engine: Pasos 1,2,3,7 fallan para fn.description opType=corte weType=Material weName=Cuchilla de corte

6. **AMFE-HF-PAT OP 50 (enfundado) — Man fn.description**
   - Current: ``
   - Razon engine: Pasos 1,2,3,7 fallan para fn.description opType=enfundado weType=Man weName=Operador de produccion

7. **AMFE-HF-PAT OP 51 (varilla) — Man fn.description**
   - Current: ``
   - Razon engine: Pasos 1,2,3,7 fallan para fn.description opType=varilla weType=Man weName=Operador de produccion

8. **AMFE-ARM-PAT OP 10 (recepcion) — Method fn.description**
   - Current: ``
   - Razon engine: Pasos 1,2,3,7 fallan para fn.description opType=recepcion weType=Method weName=Procedimiento de recepcion P-14

9. **AMFE-ARM-PAT OP 15 (corte) — Material fn.description**
   - Current: ``
   - Razon engine: Pasos 1,2,3,7 fallan para fn.description opType=corte weType=Material weName=Cuchilla de corte

10. **AMFE-ARM-PAT OP 20 (corte) — Material fn.description**
   - Current: ``
   - Razon engine: Pasos 1,2,3,7 fallan para fn.description opType=corte weType=Material weName=Cuchilla de corte

11. **AMFE-HRC-PAT OP 20 (corte) — Machine fn.description**
   - Current: ``
   - Razon engine: Pasos 1,2,3,7 fallan para fn.description opType=corte weType=Machine weName=Mesa de corte

12. **AMFE-HRC-PAT OP 30 (costura) — Machine fn.description**
   - Current: ``
   - Razon engine: Pasos 1,2,3,7 fallan para fn.description opType=costura weType=Machine weName=Maquina de coser industrial

13. **AMFE-HRC-PAT OP 70 (varilla) — Man fn.description**
   - Current: ``
   - Razon engine: Pasos 1,2,3,7 fallan para fn.description opType=varilla weType=Man weName=Operador de produccion

14. **AMFE-TR-PAT OP 10 (recepcion) — Material fn.description**
   - Current: ``
   - Razon engine: Pasos 1,2,3,7 fallan para fn.description opType=recepcion weType=Material weName=Material recibido

15. **AMFE-TR-PAT OP 20 (inyeccion) — Material fn.description**
   - Current: ``
   - Razon engine: Pasos 1,2,3,7 fallan para fn.description opType=inyeccion weType=Material weName=Mezcla de poliol e isocianato

16. **AMFE-1 OP 15 (corte) — Machine fn.description**
   - Current: ``
   - Razon engine: Pasos 1,2,3,7 fallan para fn.description opType=corte weType=Machine weName=Mesa de corte

17. **AMFE-HRO-PAT OP 20 (corte) — Machine fn.description**
   - Current: ``
   - Razon engine: Pasos 1,2,3,7 fallan para fn.description opType=corte weType=Machine weName=Mesa de corte

18. **AMFE-HRO-PAT OP 30 (costura) — Machine fn.description**
   - Current: ``
   - Razon engine: Pasos 1,2,3,7 fallan para fn.description opType=costura weType=Machine weName=Maquina de coser industrial

19. **AMFE-HRO-PAT OP 70 (varilla) — Man fn.description**
   - Current: ``
   - Razon engine: Pasos 1,2,3,7 fallan para fn.description opType=varilla weType=Man weName=Operador de produccion

## Comando para aplicar

```
node scripts/_healWeNameByCrossRef.mjs --apply
```
