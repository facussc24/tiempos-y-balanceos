-- PENDIENTE — cambios del AMFE 150 en Supabase (2026-08-03)
--
-- Los 17 Excel del servidor YA quedaron regenerados con estos valores. Falta
-- aplicarlos en Supabase para que la app y el proximo export coincidan.
--
-- No se pudo aplicar en la sesion del 2026-08-03: el hook `mcp-write-gate`
-- exige un backup verificado y `node scripts/_backup.mjs` aborta porque falta
-- VITE_AUTO_LOGIN_PASSWORD en .env.local (el gate hace bien en frenar).
--
-- COMO APLICARLO:
--   1. node scripts/_backup.mjs          (necesita la variable en .env.local)
--   2. node scripts/_restore.mjs --list  (confirmar que la carpeta nueva tiene filas > 0)
--   3. correr este SQL
--
-- QUE CAMBIA Y POR QUE (dato crudo antes -> despues):
--   header.rev                'B' -> 'A'   decision de Fak 2026-08-03: el producto no
--   header.revisionLevel      'B' -> 'A'   entro en serie, los cambios de desarrollo no
--   revision_level            'B' -> 'A'   suben la letra de revision
--   header.processResponsible 'Carlos Baptista' -> 'Paulo Centurión'
--        fuente: el AMFE 150 original dice "RESPONSABLE DEL PROCESO: PAULO CENTURION"
--        (4. OBSOLETO\...\AMFE - Apb Tra Rev.1 - Patagonia.xlsx, celda N6)
--   header.coreTeam           3 miembros con Carlos Baptista -> los 4 reales
--        fuente: el mismo archivo, fila 10; ya estaba guardado en header._coreTeamLegacy
--   revisions                 '[]' -> las 2 filas del historial real
--        fuente: el mismo archivo, filas 14 y 15. Ambas van con rev "A" por el
--        criterio de arriba. El texto se copia TAL CUAL, incluido el typo
--        "REUNÓN" del original.

update amfe_documents set
  data = jsonb_set(jsonb_set(jsonb_set(jsonb_set(
            data::jsonb,
            '{header,rev}',                '"A"'::jsonb),
            '{header,revisionLevel}',      '"A"'::jsonb),
            '{header,processResponsible}', '"Paulo Centurión"'::jsonb),
            '{header,coreTeam}',
            '["Paulo Centurión (Ingeniería)","Manuel Meszaros (Calidad)","Cristina Rabago (Seguridad e Higiene)","Mariana Vera (Producción)"]'::jsonb
         )::text,
  revision_level = 'A',
  revisions = '[{"rev":"A","date":"07/04/2025","item":"N/A.","description":"EMISION INICIAL.","pswDate":"","modifiedBy":"PC"},{"rev":"A","date":"23/09/2025","item":"10","description":"SE ACTUALIZAN LOS CONTROLES PREVENTIVOS Y DETECTIVOS TRAS REUNÓN CON EL INSPECTOR DE CALIDAD DE MATERIA PRIMA","pswDate":"","modifiedBy":"FS"}]',
  updated_at = now()
where amfe_number = '150';

-- Verificacion (tiene que devolver rev=A, resp=Paulo Centurión, equipo de 4, 2 revisiones):
select amfe_number,
       (data::jsonb)->'header'->>'rev'                as rev,
       (data::jsonb)->'header'->>'processResponsible' as resp_proceso,
       jsonb_array_length((data::jsonb)->'header'->'coreTeam') as miembros_equipo,
       jsonb_array_length(revisions::jsonb)           as filas_revisiones
from amfe_documents where amfe_number = '150';

-- ---------------------------------------------------------------------------
-- APARTE, PARA DECIDIR CON FAK — no se toca sin su OK:
-- 11 de los 17 AMFE tienen header.approvedBy = 'Gonzalo Cal'. Segun
-- .claude/rules/control-plan.md el campo approvedBy es de INGENIERIA (Carlos
-- Baptista) y Gonzalo Cal corresponde a plantApproval (Planta). El skill
-- amfe-export-oficial decia lo contrario y ya quedo corregido.
-- Para ver el estado actual:
--   select amfe_number, (data::jsonb)->'header'->>'approvedBy'    as aprobado_por,
--                       (data::jsonb)->'header'->>'plantApproval' as aprob_planta
--   from amfe_documents order by 2;
