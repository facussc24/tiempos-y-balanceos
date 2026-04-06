# Backup Supabase + Verificacion de Integridad

Ejecuta backup completo de Supabase Y verifica integridad de los datos.

## Pasos

1. Correr `node scripts/_backup.mjs` para snapshot de todas las tablas
2. Conectar a Supabase y verificar integridad de los 8 AMFEs + 8 CPs:

### Verificacion de integridad (de database.md reglas post-script)
Para cada documento APQP:
- `typeof data === 'object'` (NO string)
- AMFEs: `data.operations` es array, contar ops/WE/failures/causes
- CPs: `data.items` es array, contar items
- HOs: `data.sheets` es array, contar sheets
- PFDs: `data.steps` es array, contar steps

### Conteo esperado
- 8 amfe_documents (6 VWA + 2 PWA)
- 8 cp_documents
- 8 ho_documents
- 6 pfd_documents
- 8 product_families
- Si alguno falta, ALERTAR

3. Reportar resumen:
```
=== BACKUP + INTEGRIDAD ===
Backup: backups/YYYY-MM-DDTHH-MM-SS/
Tablas: 12 | Filas: XXX

INTEGRIDAD:
✅ 8/8 AMFEs: data es objeto, operations es array
✅ 8/8 CPs: data es objeto, items es array
✅ 8/8 HOs: data es objeto, sheets es array
✅ 6/6 PFDs: data es objeto, steps es array
⚠️ [alertas si hay]
```

## Formato de uso
```
/backup          # Backup + verificacion completa
```
